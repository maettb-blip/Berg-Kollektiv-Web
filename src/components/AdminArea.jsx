import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, setDoc, getFirestore, increment, query, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject, getStorage } from "firebase/storage";
import { initializeApp, getApps, getApp } from "firebase/app";
import NewsletterEditor from './NewsletterEditor'; // Pfad ggf. anpassen
import { 
  Search, Mail, Download, Settings, Plus, Kanban, Folder, BookOpen, 
  LayoutDashboard, User, Users, X, Edit, ExternalLink, Trash2, MapPin, 
  FileText, Share2, Link as LinkIcon, UploadCloud, Lock, Layers, Monitor, RotateCcw, Archive,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, AlertCircle, Clock
} from 'lucide-react';

const firebaseConfig = {
    apiKey: "AIzaSyDaiMO8pVyDPNut5HzHw9-kj6aldyBi36Q",
    authDomain: "berk-kollektiv.firebaseapp.com",
    projectId: "berk-kollektiv",
    storageBucket: "berk-kollektiv.firebasestorage.app",
    messagingSenderId: "339999917389",
    appId: "1:339999917389:web:006588c1030742f6c62304",
    measurementId: "G-J0YRE7EC1D"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);

const KANBAN_COLUMNS = ['Offen', 'In Bearbeitung', 'Blockiert', 'Erledigt'];
const ANFRAGEN_STATUS = ['Neu / Offen', 'In Bearbeitung', 'Geantwortet', 'Erfolgreich gebucht', 'Absage'];

// --- HELPER ---
const getDaysUntil = (dateString) => {
    if (!dateString) return null;
    const target = new Date(dateString);
    if (isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    target.setHours(0,0,0,0);
    const diffTime = target - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const loadCompressor = () => new Promise((resolve, reject) => {
    if (window.imageCompression) return resolve(window.imageCompression);
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js";
    script.onload = () => resolve(window.imageCompression);
    script.onerror = reject;
    document.head.appendChild(script);
});

const compressImage = async (file) => {
    if (!file.type.startsWith('image/')) return file;
    try {
        const imageCompression = await loadCompressor();
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
        return await imageCompression(file, options);
    } catch (error) {
        console.error("Kompression fehlgeschlagen, lade Original hoch:", error);
        return file;
    }
};

const compressVideo = (file, onProgress) => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.muted = true; 
        video.playsInline = true;

        video.onloadedmetadata = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let targetWidth = 1920;
            let targetHeight = 1080;
            if (video.videoWidth < video.videoHeight) {
                targetWidth = 1080;
                targetHeight = 1920;
            }
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            video.play().catch(reject);

            const stream = canvas.captureStream(30);
            
            const recorder = new MediaRecorder(stream, { 
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 3500000 
            });
            
            const chunks = [];
            recorder.ondataavailable = e => chunks.push(e.data);
            
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const webmFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + "_compressed.webm", { type: 'video/webm' });
                resolve(webmFile);
            };

            let interval;
            video.onplay = () => {
                recorder.start();
                interval = setInterval(() => {
                    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
                    if (onProgress) onProgress(Math.round((video.currentTime / video.duration) * 100));
                    if (video.ended) {
                        clearInterval(interval);
                        recorder.stop();
                    }
                }, 1000 / 30);
            };
            video.onerror = () => {
                clearInterval(interval);
                reject(new Error("Video konnte nicht verarbeitet werden."));
            };
        };
    });
};

const DEFAULT_ANGEBOTE = [
    { id: "mock-s1", title: "Hochtouren", season: "Sommer", desc: "Von einfachen Gletschertrekkings bis zu den grossen 4000ern.", longDesc: "Erlebe die Welt der Gletscher und Viertausender. Ob Einsteiger-Tour oder technischer Gipfel – wir führen dich sicher auf die höchsten Punkte der Alpen.", image: "/hochtour.jpg" },
    { id: "mock-s2", title: "Alpinklettern", season: "Sommer", desc: "In den besten Granit- und Kalkwänden der Schweiz.", longDesc: "Mehrseillängen-Träume in bestem Fels. Von der Furka bis ins Bergell – wir finden die perfekte Linie für dein Level.", image: "/alpinklettern.jpg" },
    { id: "mock-s3", title: "Kletterkurse", season: "Sommer", desc: "Vom ersten Griff in der Halle bis zum Vorstieg im Fels.", longDesc: "Sicherheit steht an erster Stelle. Wir vermitteln dir das nötige Know-how in Seiltechnik, Standplatzbau und Vorstiegstaktik.", image: "/kletterkurs.jpg" },
    { id: "mock-s4", title: "Gratüberschreitungen", season: "Sommer", desc: "Luftige Grate und endlose Aussichten.", longDesc: "Die eleganteste Art, einen Gipfel zu besteigen. Klassiker wie der Eiger- oder Biancograt warten auf dich.", image: "/grat.jpg" }
];

const getKat = (t, defaultCats) => {
    if (!t) return defaultCats[0] || 'Hochtour';
    if (t.kategorie) return t.kategorie;
    return defaultCats[0] || 'Hochtour';
};
const getTech = (t) => t && t.technik ? Number(t.technik) : 2;
const getAusd = (t) => t && t.ausdauer ? Number(t.ausdauer) : 2;

export default function AdminArea({ user, touren = [], onLogout }) {
  const [adminSubView, setAdminSubView] = useState('dashboard');
  
  // Data States
  const [anmeldungen, setAnmeldungen] = useState([]);
  const [anfragen, setAnfragen] = useState([]);
  const [kundenNotizen, setKundenNotizen] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [docs, setDocs] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [logs, setLogs] = useState([]); 
  const [teamProfiles, setTeamProfiles] = useState([]);
  const [materialLists, setMaterialLists] = useState([]);
  const [angebote, setAngebote] = useState([]);
  const [websiteSettings, setWebsiteSettings] = useState({ heroVideos: [], categoryOrder: [] });
  const [newsletters, setNewsletters] = useState([]);
  const [editingNewsletter, setEditingNewsletter] = useState(null);
  
  // Dynamische Settings
  const [docKategorien, setDocKategorien] = useState(['Rechnungen', 'Konzepte', 'Sponsoring', 'Bilder']);
  const [docSubkategorien, setDocSubkategorien] = useState({});
  const [taskKategorien, setTaskKategorien] = useState(['Allgemein', 'Tourenplanung', 'Ausrüstung', 'Marketing', 'Finanzen']);
  const [protocolKategorien, setProtocolKategorien] = useState(['Teamsitzung', 'Tourenplanung', 'Ideen']);
  const [teamAttributes, setTeamAttributes] = useState([]); 

  const activeTeamAttributes = teamAttributes.length > 0 ? teamAttributes : ['Superkraft', 'Kryptonit', 'Touren-Snack', 'Lebensmotto'];
  
  const activeAngebote = angebote.filter(a => !a.isDeleted);
  const activeAngeboteFallback = activeAngebote.length > 0 ? activeAngebote : DEFAULT_ANGEBOTE;
  
  const categoryOrder = websiteSettings.categoryOrder || DEFAULT_ANGEBOTE.map(a => a.id);
  const sortedAngebote = [...activeAngeboteFallback].sort((a, b) => {
      let indexA = categoryOrder.indexOf(a.id);
      let indexB = categoryOrder.indexOf(b.id);
      if (indexA === -1) indexA = 999;
      if (indexB === -1) indexB = 999;
      return indexA - indexB;
  });
  
  const tourKategorien = [...new Set(sortedAngebote.map(a => a.title))];

  // UI States
  const [selectedKunde, setSelectedKunde] = useState(null);
  const [isEditingKunde, setIsEditingKunde] = useState(false);
  const [kundenSearch, setKundenSearch] = useState('');
  const [notizInput, setNotizInput] = useState('');
  
  const [editingTour, setEditingTour] = useState(null);
  const [exportingTour, setExportingTour] = useState(null); // NEU: Export State
  const [editingTask, setEditingTask] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editingProtocol, setEditingProtocol] = useState(null);
  const [editingTeamMember, setEditingTeamMember] = useState(null);
  const [editingAngebot, setEditingAngebot] = useState(null);
  
  const [pendingDeletes, setPendingDeletes] = useState([]);

  const [showDocKategorienModal, setShowDocKategorienModal] = useState(false);
  const [showTaskKategorienModal, setShowTaskKategorienModal] = useState(false);
  const [showProtocolKategorienModal, setShowProtocolKategorienModal] = useState(false);
  const [showTeamAttributesModal, setShowTeamAttributesModal] = useState(false);
  
  const [taskFilter, setTaskFilter] = useState('Alle');
  const [docFilter, setDocFilter] = useState('Alle');
  const [docSubFilter, setDocSubFilter] = useState('Alle');
  const [protocolFilter, setProtocolFilter] = useState('Alle');
  
  const [tourStatusFilter, setTourStatusFilter] = useState('Öffentlich');
  const [tourKatFilter, setTourKatFilter] = useState('Alle');

  const [anfragenStatusFilter, setAnfragenStatusFilter] = useState('Alle');
  const [anfragenSearch, setAnfragenSearch] = useState('');

  const [anmeldungenView, setAnmeldungenView] = useState('active'); 
  const [trashTab, setTrashTab] = useState('touren');

  const [isUploading, setIsUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      onSnapshot(collection(db, 'anmeldungen'), snap => setAnmeldungen(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'anfragen'), snap => setAnfragen(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'kunden_notizen'), snap => setKundenNotizen(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'tasks'), snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'docs'), snap => setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'protocols'), snap => setProtocols(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'team_profiles'), snap => setTeamProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'material_lists'), snap => setMaterialLists(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'angebote'), snap => setAngebote(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'logs'), snap => {
          const fetchedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          fetchedLogs.sort((a, b) => b.timestamp - a.timestamp); 
          setLogs(fetchedLogs);
      }),
      onSnapshot(doc(db, 'settings', 'website'), snap => { if(snap.exists()) setWebsiteSettings({...websiteSettings, ...snap.data()}); }),
      onSnapshot(doc(db, 'settings', 'dokumente'), snap => { 
          if (snap.exists()) {
              if (snap.data().kategorien) setDocKategorien(snap.data().kategorien); 
              if (snap.data().subkategorien) {
                  const subs = snap.data().subkategorien;
                  if (Array.isArray(subs)) setDocSubkategorien({ 'Allgemein': subs });
                  else setDocSubkategorien(subs);
              }
          }
      }),
      onSnapshot(doc(db, 'settings', 'aufgaben'), snap => { if (snap.exists() && snap.data().kategorien) setTaskKategorien(snap.data().kategorien); }),
      onSnapshot(doc(db, 'settings', 'protokolle'), snap => { if (snap.exists() && snap.data().kategorien) setProtocolKategorien(snap.data().kategorien); }),
      onSnapshot(doc(db, 'settings', 'team_attributes'), snap => { if (snap.exists() && snap.data().labels) setTeamAttributes(snap.data().labels); })
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, [user]);

    useEffect(() => {
    // Query erstellt eine Liste, sortiert nach Datum absteigend (neueste zuerst)
    const q = query(collection(db, 'newsletters'), orderBy('datum', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const nlData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
        }));
        setNewsletters(nlData);
    });

    // Listener aufräumen, wenn die Komponente unmounted wird
    return () => unsubscribe();
    }, []); // Leeres Array bedeutet, das läuft einmal beim Starten der AdminArea

  const teamMemberNames = [...new Set([...teamProfiles.filter(t => !t.isDeleted).map(t => t.name), 'Allgemein'])];

  const logAction = async (actionText) => {
    if (!user) return;
    try {
        await addDoc(collection(db, 'logs'), { user: user.email, action: actionText, timestamp: Date.now() });
    } catch (e) { console.error("Fehler beim Speichern des Logs", e); }
  };

  const deleteStorageFile = async (url) => {
      if (!url || !url.includes('firebasestorage')) return;
      try {
          const fileRef = ref(storage, url);
          await deleteObject(fileRef);
      } catch (e) { 
          // Fehler abfangen, damit übergeordnete Prozesse (wie hardDelete) nicht abbrechen
          console.error("Konnte Datei nicht aus dem Storage löschen:", url, e); 
      }
  };

  const moveImage = (array, setArray, idx, dir) => {
      const newArr = [...array];
      if (idx + dir < 0 || idx + dir >= newArr.length) return;
      const temp = newArr[idx];
      newArr[idx] = newArr[idx + dir];
      newArr[idx + dir] = temp;
      setArray(newArr);
  };

  const moveAngebot = async (idx, dir) => {
      const newOrder = sortedAngebote.map(a => a.id);
      if (idx + dir < 0 || idx + dir >= newOrder.length) return;
      const temp = newOrder[idx];
      newOrder[idx] = newOrder[idx + dir];
      newOrder[idx + dir] = temp;
      await setDoc(doc(db, 'settings', 'website'), { categoryOrder: newOrder }, { merge: true });
  };

  const deleteAnmeldung = async (anm, title) => {
      if(!confirm(`Anmeldung von ${anm.vorname} ${anm.name} wirklich löschen/stornieren?\n\nHinweis: Der Kontakt bleibt im Kundenstamm gespeichert.`)) return;
      try {
          await deleteDoc(doc(db, 'anmeldungen', anm.id));
          if (!anm.isArchived && anm.tourId && !anm.tourId.startsWith('mock-')) {
              await updateDoc(doc(db, 'touren', anm.tourId), { angemeldet: increment(-1) });
          }
          logAction(`Anmeldung storniert/gelöscht: ${anm.vorname} ${anm.name} für ${title}`);
      } catch (e) {
          alert("Fehler beim Löschen.");
      }
  };

  const archiveTourBookings = async (title, teilnehmer) => {
      const archiveLabel = prompt(`Möchtest du alle aktuellen Anmeldungen für "${title}" ins Archiv verschieben?\n\nGib ein Datum/Saison als Label ein (z.B. "Sommer 2024"). Dieses Label wird im Kundenstamm sichtbar sein.\n\nDie gebuchten Plätze der Tour werden danach auf 0 gesetzt.`, new Date().toLocaleDateString('de-CH', { month: '2-digit', year: 'numeric' }));
      if (!archiveLabel) return; 
      
      try {
          await Promise.all(teilnehmer.map(anm => updateDoc(doc(db, 'anmeldungen', anm.id), { isArchived: true, archivedAt: Date.now(), archiveLabel: archiveLabel })));
          
          const tourId = teilnehmer[0]?.tourId;
          if (tourId && !tourId.startsWith('mock-')) {
              await updateDoc(doc(db, 'touren', tourId), { angemeldet: 0 });
          }
          
          logAction(`Saison-Reset: Anmeldungen für "${title}" archiviert (${archiveLabel}).`);
          alert("Erfolgreich archiviert! Die Tour hat nun wieder 0 Buchungen.");
      } catch (e) {
          alert("Fehler beim Archivieren.");
      }
  };

  const softDelete = async (colName, id, title) => {
      if (id.startsWith('mock-')) return alert("Beispieldaten können nicht gelöscht werden.");
      if (!confirm(`"${title}" in den Papierkorb verschieben?`)) return;
      try {
          await updateDoc(doc(db, colName, id), { isDeleted: true, deletedAt: Date.now() });
          logAction(`${colName} in Papierkorb verschoben: ${title}`);
      } catch (e) { alert("Fehler beim Löschen."); }
  };

  const restoreItem = async (colName, id, title) => {
      try {
          await updateDoc(doc(db, colName, id), { isDeleted: false });
          logAction(`${colName} wiederhergestellt: ${title}`);
      } catch (e) { alert("Fehler beim Wiederherstellen."); }
  };

  const hardDelete = async (colName, item, title) => {
      if (!confirm(`"${title}" ENDGÜLTIG löschen?\nDas löscht auch alle dazugehörigen Dateien (Bilder/PDFs) auf dem Server und kann nicht rückgängig gemacht werden.`)) return;
      
      try {
          let urls = [];
          
          // Sichere Überprüfung auf Arrays und Strings, um TypeErrors zu vermeiden
          if (typeof item.image === 'string' && item.image) urls.push(item.image);
          if (Array.isArray(item.images)) urls.push(...item.images);
          if (typeof item.url === 'string' && item.url && !item.isLink) urls.push(item.url);
          if (typeof item.fileUrl === 'string' && item.fileUrl) urls.push(item.fileUrl);

          const storageUrls = urls.filter(u => u && u.includes('firebasestorage.googleapis.com'));
          
          // Wir warten auf das Löschen der Dateien, blockieren aber nicht bei Fehlern
          for (const u of storageUrls) {
              await deleteStorageFile(u);
          }

          // Dokument endgültig löschen
          await deleteDoc(doc(db, colName, item.id));
          logAction(`${colName} endgültig gelöscht: ${title}`);
      } catch (e) {
          console.error("Fehler beim endgültigen Löschen:", e);
          alert(`Fehler beim endgültigen Löschen: ${e.message}`);
      }
  };

  const kundenStamm = useMemo(() => {
    const map = {};
    kundenNotizen.forEach(n => {
        const email = n.id.toLowerCase().trim();
        if (!map[email]) map[email] = { email, vorname: '', name: '', phone: '', adresse: '', plz: '', ort: '', plz_ort_legacy: '', touren: [], anfragen: [] };
    });
    const processItem = (item) => {
      if (!item.email) return;
      const email = item.email.toLowerCase().trim();
      if (!map[email]) map[email] = { email, vorname: item.vorname || '', name: item.name || '', phone: item.phone || '', adresse: item.adresse || '', plz: '', ort: '', plz_ort_legacy: item.plz_ort || '', touren: [], anfragen: [] };
      if (item.adresse && !map[email].adresse) map[email].adresse = item.adresse;
      if (item.phone && !map[email].phone) map[email].phone = item.phone;
      if (item.plz_ort && !map[email].plz && !map[email].ort) {
          const parts = item.plz_ort.trim().split(' ');
          map[email].plz = parts[0] || '';
          map[email].ort = parts.slice(1).join(' ') || '';
      }
    };
    anmeldungen.forEach(a => { processItem(a); map[a.email.toLowerCase().trim()].touren.push(a); });
    anfragen.forEach(a => { processItem(a); map[a.email.toLowerCase().trim()].anfragen.push(a); });

    return Object.values(map).map(k => {
      const settings = kundenNotizen.find(n => n.id === k.email) || {};
      return { 
        ...k, 
        vorname: settings.vorname || k.vorname, name: settings.name || k.name, phone: settings.phone || k.phone,
        adresse: settings.adresse || k.adresse, plz: settings.plz || k.plz, ort: settings.ort || k.ort,
        stammkunde_von: settings.stammkunde_von || '', newsletter: settings.newsletter !== undefined ? settings.newsletter : true, 
        notizText: settings.text || '' 
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [anmeldungen, anfragen, kundenNotizen]);

  const filteredKunden = kundenStamm.filter(k => k.name.toLowerCase().includes(kundenSearch.toLowerCase()) || k.vorname.toLowerCase().includes(kundenSearch.toLowerCase()) || k.email.toLowerCase().includes(kundenSearch.toLowerCase()));

  const exportToExcel = (exportData) => {
    const headers = ["Tour", "Vorname", "Name", "Email", "Telefon", "Adresse", "PLZ/Ort", "Ernaehrung", "Bemerkung", "Status", "Zuständig", "Archiviert", "Archiv-Datum"];
    const rows = exportData.map(a => [ a.tourTitle, a.vorname, a.name, a.email, `'${a.phone}`, a.adresse, a.plz_ort, a.ernaehrung, (a.besonderes || "").replace(/\n/g, " "), a.status || 'Neu', a.zustaendig || 'Unzugewiesen', a.isArchived ? 'Ja' : 'Nein', a.archiveLabel || '' ]);
    let csvContent = "\uFEFF" + headers.join(";") + "\r\n";
    rows.forEach(row => { csvContent += row.join(";") + "\r\n"; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Anmeldungen_${new Date().toLocaleDateString()}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportKundenExcel = (kunden) => {
    const headers = ["Vorname", "Name", "Email", "Telefon", "Adresse", "PLZ", "Ort", "Newsletter", "Stammkunde_von"];
    const rows = kunden.map(k => [k.vorname, k.name, k.email, `'${k.phone}`, k.adresse, k.plz, k.ort, k.newsletter ? 'Ja' : 'Nein', k.stammkunde_von]);
    const csvContent = "\uFEFF" + headers.join(";") + "\r\n" + rows.map(e => e.join(";")).join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Kundenstamm_${new Date().toLocaleDateString()}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const copyNewsletterBCC = () => {
    const emails = filteredKunden.filter(k => k.newsletter).map(k => k.email).join(', ');
    navigator.clipboard.writeText(emails);
    alert("BCC Adressen kopiert!");
  };

  const toggleNewsletter = async (email, currentVal) => {
    try { await setDoc(doc(db, 'kunden_notizen', email), { newsletter: !currentVal }, { merge: true }); } 
    catch (e) { console.error("Fehler", e); }
  };

  const getLegacyTeamField = (member, attr) => {
      if (!member) return '';
      if (attr === 'Superkraft') return member.superkraft || '';
      if (attr === 'Kryptonit') return member.schwaeche || '';
      if (attr === 'Touren-Snack') return member.snack || '';
      if (attr === 'Lebensmotto') return member.zitat || '';
      return '';
  };

  const handleHeroVideoUpload = async (e) => {
      const files = Array.from(e.target.files);
      if(files.length === 0) return;
      setIsUploading(true);
      setVideoProgress(0);
      
      try {
          const newUrls = [];
          for(const file of files) {
              let finalFile = file;
              try {
                  finalFile = await compressVideo(file, setVideoProgress);
              } catch (err) {
                  console.error("Fehler bei Video-Komprimierung, lade Original hoch.", err);
              }

              setVideoProgress(null); 
              
              const storageRef = ref(storage, `website/hero-${Date.now()}-${finalFile.name}`);
              const snap = await uploadBytes(storageRef, finalFile);
              const url = await getDownloadURL(snap.ref);
              newUrls.push(url);
          }
          const updatedVideos = [...(websiteSettings.heroVideos || []), ...newUrls];
          await setDoc(doc(db, 'settings', 'website'), { heroVideos: updatedVideos }, { merge: true });
          logAction(`${files.length} Startseiten-Video(s) hochgeladen.`);
      } catch(e) {
          alert("Fehler beim Video-Upload.");
      }
      setIsUploading(false);
      setVideoProgress(null);
  };

  const deleteHeroVideo = async (url) => {
      if(!confirm("Video wirklich löschen?")) return;
      try {
          await deleteStorageFile(url);
          const updatedVideos = (websiteSettings.heroVideos || []).filter(u => u !== url);
          await setDoc(doc(db, 'settings', 'website'), { heroVideos: updatedVideos }, { merge: true });
          logAction("Startseiten-Video gelöscht.");
      } catch(e) { alert("Fehler beim Löschen."); }
  };

  const saveAngebot = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    const fd = new FormData(e.target);
    const imageFiles = fd.getAll('angebot_files');
    let imageUrls = [];

    const title = fd.get('title');
    const safeNameFolder = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'angebot';

    try {
        if (imageFiles && imageFiles.length > 0 && imageFiles[0].size > 0) {
            const uploadPromises = Array.from(imageFiles).map(async (file) => {
                const compressedFile = await compressImage(file);
                const storageRef = ref(storage, `angebote/${safeNameFolder}/${Date.now()}-${compressedFile.name}`);
                const snapshot = await uploadBytes(storageRef, compressedFile);
                return await getDownloadURL(snapshot.ref);
            });
            imageUrls = await Promise.all(uploadPromises);
        }
        
        await Promise.all(pendingDeletes.map(url => deleteStorageFile(url)));
        
        const isMock = editingAngebot && editingAngebot.id ? editingAngebot.id.startsWith('mock-') : false;
        const combinedImages = [...(editingAngebot.images || []), ...imageUrls];

        const data = {
            title: title,
            season: fd.get('season'),
            desc: fd.get('desc'),
            longDesc: fd.get('longDesc'),
            image: combinedImages[0] || '', 
            images: combinedImages,
            isDeleted: false
        };

        if (editingAngebot && editingAngebot.id && !isMock) {
            await updateDoc(doc(db, 'angebote', editingAngebot.id), data);
            logAction(`Angebot aktualisiert: ${data.title}`);
        } else {
            await addDoc(collection(db, 'angebote'), data);
            logAction(`Neues Angebot erstellt: ${data.title}`);
        }
        setPendingDeletes([]);
        setEditingAngebot(null);
    } catch (err) { alert("Fehler beim Speichern."); } 
    finally { setIsUploading(false); }
  };

  const saveTeamMember = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    const fd = new FormData(e.target);
    const imageFiles = fd.getAll('team_files');
    let imageUrls = [];

    const name = fd.get('name');
    const safeNameFolder = name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'team';
    
    const customFields = {};
    activeTeamAttributes.forEach(attr => {
        customFields[attr] = fd.get(`custom_${attr}`) || '';
    });

    try {
        if (imageFiles && imageFiles.length > 0 && imageFiles[0].size > 0) {
            const uploadPromises = Array.from(imageFiles).map(async (file) => {
                const compressedFile = await compressImage(file);
                const storageRef = ref(storage, `team/${safeNameFolder}/${Date.now()}-${compressedFile.name}`);
                const snapshot = await uploadBytes(storageRef, compressedFile);
                return await getDownloadURL(snapshot.ref);
            });
            imageUrls = await Promise.all(uploadPromises);
        }
        
        await Promise.all(pendingDeletes.map(url => deleteStorageFile(url)));

        const combinedImages = [...(editingTeamMember.images || []), ...imageUrls];

        const data = {
            name: name,
            title: fd.get('title'),
            desc: fd.get('desc'),
            customFields: customFields,
            visible: editingTeamMember.visible !== false,
            image: combinedImages[0] || '', 
            images: combinedImages,
            isDeleted: false
        };

        if (editingTeamMember && editingTeamMember.id) {
            await updateDoc(doc(db, 'team_profiles', editingTeamMember.id), data);
            logAction(`Teammitglied aktualisiert: ${data.name}`);
        } else {
            await addDoc(collection(db, 'team_profiles'), data);
            logAction(`Neues Teammitglied erstellt: ${data.name}`);
        }
        setPendingDeletes([]);
        setEditingTeamMember(null);
    } catch (err) { alert("Fehler beim Speichern."); } 
    finally { setIsUploading(false); }
  };

  const saveMaterialList = async (e) => {
      e.preventDefault();
      setIsUploading(true);
      const fd = new FormData(e.target);
      const file = fd.get('file');
      const name = fd.get('name');

      try {
          const fileRef = ref(storage, `material/${Date.now()}_${file.name}`);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          
          await addDoc(collection(db, 'material_lists'), { name, url, createdAt: Date.now() });
          logAction(`Materialliste hochgeladen: ${name}`);
          e.target.reset();
          alert("Erfolgreich hochgeladen!");
      } catch (err) {
          alert("Fehler beim Hochladen.");
      } finally {
          setIsUploading(false);
      }
  };

  const saveTour = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    const fd = new FormData(e.target);
    const imageFiles = fd.getAll('tour_files');
    let imageUrls = [];

    const tourTitle = fd.get('title');
    const safeTitleFolder = tourTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'tour';

    const statusStr = fd.get('tour_status');
    let isVisible = true;
    let isExample = false;
    
    if (statusStr === 'hidden') {
        isVisible = false;
    } else if (statusStr === 'example') {
        isVisible = true; 
        isExample = true;
    }

    const materialListId = fd.get('material_list_id') || '';
    const selectedMaterial = materialLists.find(m => m.id === materialListId);

    try {
        if (imageFiles && imageFiles.length > 0 && imageFiles[0].size > 0) {
            const uploadPromises = Array.from(imageFiles).map(async (file) => {
                const compressedFile = await compressImage(file);
                const storageRef = ref(storage, `touren/${safeTitleFolder}/${Date.now()}-${compressedFile.name}`);
                const snapshot = await uploadBytes(storageRef, compressedFile);
                return await getDownloadURL(snapshot.ref);
            });
            imageUrls = await Promise.all(uploadPromises);
        }
        
        await Promise.all(pendingDeletes.map(url => deleteStorageFile(url)));
        
        const isMock = editingTour && editingTour.id ? editingTour.id.startsWith('mock-') : false;
        const combinedImages = [...(editingTour.images || []), ...imageUrls];

        const data = {
            title: tourTitle, 
            visible: isVisible,
            isExample: isExample,
            date: fd.get('date') || '',
            description: fd.get('description'), 
            price: fd.get('price') || '', 
            leistungen: fd.get('leistungen') || '',
            anforderungen: fd.get('anforderungen') || '', 
            ablauf: fd.get('ablauf') || '', 
            material: fd.get('material') || '',
            materialListId: materialListId,
            materialName: selectedMaterial ? selectedMaterial.name : '',
            materialUrl: selectedMaterial ? selectedMaterial.url : '',
            guide: fd.get('guide') || '',
            interneNotizen: fd.get('interneNotizen') || '',
            stornoFrist: fd.get('stornoFrist') || '',
            kategorie: fd.get('kategorie') || tourKategorien[0] || 'Hochtour',
            technik: parseInt(fd.get('technik')) || 2,
            ausdauer: parseInt(fd.get('ausdauer')) || 2,
            minPlaetze: parseInt(fd.get('minPlaetze')) || 1,
            maxPlaetze: parseInt(fd.get('maxPlaetze')) || 4,
            image: combinedImages[0] || '/hochtour.jpg', 
            images: combinedImages, 
            angemeldet: (editingTour && editingTour.id && !isMock) ? editingTour.angemeldet : 0,
            isDeleted: false
        };

        if (editingTour && editingTour.id && !isMock) {
            await updateDoc(doc(db, 'touren', editingTour.id), data);
            logAction(`Tour aktualisiert: ${data.title}`);
        } else {
            await addDoc(collection(db, 'touren'), data);
            logAction(`Neue Tour/Idee erstellt: ${data.title}`);
        }
        setPendingDeletes([]);
        setEditingTour(null);
    } catch (err) { alert("Fehler beim Speichern der Tour."); } 
    finally { setIsUploading(false); }
  };

  const saveTask = async (taskData, fileObject) => {
    setIsUploading(true);
    let fileUrl = taskData.fileUrl || null;
    let fileName = taskData.fileName || null;
    if (fileObject) {
        const fileRef = ref(storage, `tasks/${Date.now()}_${fileObject.name}`);
        await uploadBytes(fileRef, fileObject);
        fileUrl = await getDownloadURL(fileRef);
        fileName = fileObject.name;
    }
    const data = { ...taskData, fileUrl, fileName, isDeleted: false };
    if (data.id) {
        await updateDoc(doc(db, 'tasks', data.id), data);
        logAction(`Aufgabe aktualisiert: ${data.title}`);
    } else {
        await addDoc(collection(db, 'tasks'), { ...data, createdAt: Date.now() });
        logAction(`Aufgabe erstellt: ${data.title}`);
    }
    setEditingTask(null); setIsUploading(false);
  };

  const saveDoc = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    const fd = new FormData(e.target);
    const name = fd.get('name');
    const category = fd.get('category');
    const subcategory = fd.get('subcategory') || '';
    
    try {
        if (editingDoc.id) {
            const data = { ...editingDoc, name, category, subcategory };
            if (editingDoc.isLink) data.url = fd.get('url');
            await updateDoc(doc(db, 'docs', editingDoc.id), data);
            logAction(`Dokument aktualisiert: ${name}`);
        } else {
            if (editingDoc.isLink) {
                await addDoc(collection(db, 'docs'), { name, category, subcategory, isLink: true, url: fd.get('url'), size: 'Web-Link', createdAt: Date.now(), isDeleted: false });
                logAction(`Link hinzugefügt: ${name}`);
            } else {
                for (let file of uploadFiles) {
                    const compressedFile = await compressImage(file);
                    const fileRef = ref(storage, `docs/${Date.now()}_${compressedFile.name}`);
                    await uploadBytes(fileRef, compressedFile);
                    const url = await getDownloadURL(fileRef);
                    const size = `${(compressedFile.size / (1024 * 1024)).toFixed(2)} MB`;
                    const docName = uploadFiles.length > 1 ? compressedFile.name : (name || compressedFile.name);
                    await addDoc(collection(db, 'docs'), { name: docName, category, subcategory, isLink: false, url, size, createdAt: Date.now(), isDeleted: false });
                }
                logAction(`${uploadFiles.length} Dokument(e) hochgeladen`);
            }
        }
    } catch (err) {
        alert("Fehler beim Speichern der Dokumente.");
    }

    setEditingDoc(null);
    setUploadFiles([]);
    setIsUploading(false);
  };

  const saveProtocol = async (protocolData, fileObject) => {
    setIsUploading(true);
    let fileUrl = protocolData.fileUrl || null;
    let fileName = protocolData.fileName || null;
    if (fileObject) {
        const fileRef = ref(storage, `protocols/${Date.now()}_${fileObject.name}`);
        await uploadBytes(fileRef, fileObject);
        fileUrl = await getDownloadURL(fileRef);
        fileName = fileObject.name;
    }
    const data = { ...protocolData, fileUrl, fileName, isDeleted: false };
    if (data.id) {
        await updateDoc(doc(db, 'protocols', data.id), data);
        logAction(`Protokoll aktualisiert: ${data.title}`);
    } else {
        await addDoc(collection(db, 'protocols'), { ...data, createdAt: Date.now() });
        logAction(`Protokoll erstellt: ${data.title}`);
    }
    setEditingProtocol(null); setIsUploading(false);
  };

  const loadScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const generateAndSharePDF = async (protocol) => {
    try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
        
        const { jsPDF } = window.jspdf;
        const d = new jsPDF();
        
        d.setFontSize(22); 
        d.text(`Protokoll: ${protocol.title}`, 14, 20);
        
        d.setFontSize(11); 
        d.setTextColor(100);
        d.text(`Datum: ${new Date(protocol.date).toLocaleDateString('de-CH')} | Kategorie: ${protocol.category}`, 14, 30);
        if (protocol.participants) d.text(`Teilnehmer: ${protocol.participants}`, 14, 36);
        
        let yPos = 46;
        if (protocol.notes) {
            d.setFontSize(14); 
            d.setTextColor(0); 
            d.text('Notizen:', 14, yPos); 
            yPos += 6;
            
            d.setFontSize(11); 
            d.setTextColor(80);
            const splitNotes = d.splitTextToSize(protocol.notes, 180);
            d.text(splitNotes, 14, yPos); 
            yPos += (splitNotes.length * 5) + 10;
        }
        
        if (protocol.decisions && protocol.decisions.length > 0) {
            d.autoTable({ 
                startY: yPos, 
                head: [['Beschluss / Aufgabe', 'Zuständig']], 
                body: protocol.decisions.map(dec => [dec.text, dec.assignee || '-']), 
                theme: 'grid', 
                headStyles: { fillColor: [0, 0, 0] } 
            });
        }
        
        d.save(`Protokoll_${protocol.title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
        logAction(`Protokoll PDF exportiert: ${protocol.title}`);
    } catch (err) {
        console.error("PDF Export Fehler:", err);
        alert("Fehler beim Erstellen des PDFs.");
    }
  };

  // --- NEUE EXPORT FUNKTIONEN FÜR TOUREN ---
  const generateTourText = (t) => {
      let txt = `🏔️ *${t.title}*\n\n`;
      if (!t.isExample && t.date) txt += `📅 Datum: ${t.date}\n`;
      if (!t.isExample && t.price) txt += `💰 Preis: ${t.price}\n`;
      txt += `\n${t.description}\n\n`;
      if (!t.isExample && t.leistungen) txt += `✅ Leistungen:\n${t.leistungen}\n\n`;
      if (!t.isExample && t.ablauf) txt += `📍 Ablauf:\n${t.ablauf}\n\n`;
      txt += `Bist du dabei? Melde dich bei uns! 🧗‍♂️`;
      return txt;
  };

  const copyTourText = (t) => {
      const text = generateTourText(t);
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
          document.execCommand('copy');
          alert("Erfolgreich in die Zwischenablage kopiert!");
      } catch (err) {
          alert("Kopieren fehlgeschlagen.");
      }
      document.body.removeChild(textArea);
  };

  const generateTourPDF = async (t) => {
      try {
          await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
          const { jsPDF } = window.jspdf;
          const d = new jsPDF();

          const checkPageBreak = (heightNeeded) => {
              if (yPos + heightNeeded > 280) {
                  d.addPage();
                  yPos = 20;
              }
          };

          let yPos = 20;
          d.setFontSize(22);
          const titleSplit = d.splitTextToSize(t.title, 180);
          d.text(titleSplit, 14, yPos);
          yPos += (titleSplit.length * 8) + 5;

          d.setFontSize(11);
          d.setTextColor(100);
          if (!t.isExample) {
              d.text(`Datum: ${t.date || 'Auf Anfrage'} | Preis: ${t.price || '-'}`, 14, yPos);
              yPos += 10;
          }

          d.setFontSize(12);
          d.setTextColor(0);
          const splitDesc = d.splitTextToSize(t.description || '', 180);
          checkPageBreak(splitDesc.length * 6);
          d.text(splitDesc, 14, yPos);
          yPos += (splitDesc.length * 6) + 10;

          if (!t.isExample && t.ablauf) {
              checkPageBreak(20);
              d.setFontSize(14);
              d.setTextColor(0);
              d.text('Ablauf', 14, yPos);
              yPos += 6;

              d.setFontSize(11);
              d.setTextColor(80);
              const splitAblauf = d.splitTextToSize(t.ablauf, 180);
              checkPageBreak(splitAblauf.length * 5);
              d.text(splitAblauf, 14, yPos);
              yPos += (splitAblauf.length * 5) + 10;
          }

          if (!t.isExample && t.leistungen) {
              checkPageBreak(20);
              d.setFontSize(14);
              d.setTextColor(0);
              d.text('Leistungen', 14, yPos);
              yPos += 6;

              d.setFontSize(11);
              d.setTextColor(80);
              const splitLeist = d.splitTextToSize(t.leistungen, 180);
              checkPageBreak(splitLeist.length * 5);
              d.text(splitLeist, 14, yPos);
              yPos += (splitLeist.length * 5) + 10;
          }

          if (!t.isExample && t.anforderungen) {
              checkPageBreak(20);
              d.setFontSize(14);
              d.setTextColor(0);
              d.text('Anforderungen', 14, yPos);
              yPos += 6;

              d.setFontSize(11);
              d.setTextColor(80);
              const splitAnf = d.splitTextToSize(t.anforderungen, 180);
              checkPageBreak(splitAnf.length * 5);
              d.text(splitAnf, 14, yPos);
          }

          d.save(`Tour_${t.title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
          logAction(`Tour PDF exportiert: ${t.title}`);
      } catch (err) {
          console.error("PDF Export Fehler:", err);
          alert("Fehler beim Erstellen des PDFs.");
      }
  };
  // ------------------------------------------

  const getFilteredAnfragen = () => {
      let filtered = (anfragen || []).filter(a => !a.isDeleted);
      if (anfragenStatusFilter !== 'Alle') {
          if (anfragenStatusFilter === 'Neu / Offen') {
              filtered = filtered.filter(a => !a.status || a.status === 'Neu / Offen');
          } else {
              filtered = filtered.filter(a => a.status === anfragenStatusFilter);
          }
      }
      if (anfragenSearch.trim() !== '') {
          const lower = anfragenSearch.toLowerCase();
          filtered = filtered.filter(a => 
              (a.name && a.name.toLowerCase().includes(lower)) || 
              (a.vorname && a.vorname.toLowerCase().includes(lower)) || 
              (a.email && a.email.toLowerCase().includes(lower))
          );
      }
      return filtered.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  };

  const displayedAnmeldungen = anmeldungen.filter(a => anmeldungenView === 'active' ? !a.isArchived : a.isArchived);

  // --- BERECHNUNG DER FRISTEN (WARNINGS) ---
  const urgentTours = (touren || []).filter(t => !t.isDeleted && !t.isExample && t.visible !== false && t.stornoFrist && getDaysUntil(t.stornoFrist) !== null && getDaysUntil(t.stornoFrist) <= 3 && getDaysUntil(t.stornoFrist) >= -30);
  const urgentTasks = (tasks || []).filter(t => !t.isDeleted && t.status !== 'Erledigt' && t.dueDate && getDaysUntil(t.dueDate) !== null && getDaysUntil(t.dueDate) <= 3 && getDaysUntil(t.dueDate) >= -30);

  return (
    <div className="min-h-screen bg-bg text-accent selection:bg-black selection:text-white">
      <nav className="fixed w-full z-50 px-6 md:px-12 py-8 flex justify-between items-center mix-blend-difference text-white">
        <div className="text-lg md:text-xl tracking-[0.3em] uppercase cursor-pointer" onClick={onLogout}>
          BERG <span className="font-bold">KOLLEKTIV</span>
        </div>
        <div className="flex items-center gap-6">
            <span className="hidden md:inline-block text-[10px] uppercase tracking-widest opacity-60 bg-white/10 px-3 py-1 rounded-full">Eingeloggt: {user?.email}</span>
            <button onClick={onLogout} className="text-[10px] uppercase tracking-widest hover:opacity-70 transition">Zurück zur Website</button>
        </div>
      </nav>

      <div className="pt-32 pb-20 px-6 md:px-12 max-w-full mx-auto fade-in">
        <div className="flex flex-col md:flex-row gap-12">
          {/* Sidebar */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <h2 className="serif text-2xl italic mb-8">Workspace</h2>
            
            <div className="space-y-1 mb-8">
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2 px-4">Kunden & Website</p>
              {[ 
                { id: 'dashboard', label: 'Übersicht', icon: LayoutDashboard }, 
                { id: 'website', label: 'Startseite & Design', icon: Monitor },
                { id: 'angebote', label: 'Angebote verwalten', icon: Layers },
                { id: 'touren', label: 'Touren verwalten', icon: Settings }, 
                { id: 'anmeldungen', label: 'Anmeldungen', icon: Share2 }, 
                { id: 'anfragen', label: 'Anfragen', icon: Mail }, 
                { id: 'kunden', label: 'Kundenstamm (CRM)', icon: User } 
              ].map(item => (
                <button key={item.id} onClick={() => { setAdminSubView(item.id); setSelectedKunde(null); setIsEditingKunde(false); }} className={`w-full text-left py-2 px-4 text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ${adminSubView === item.id ? 'bg-black text-white' : 'hover:bg-zinc-100'}`}>
                  <item.icon size={14}/> {item.label}
                </button>
              ))}
            </div>

            <div className="space-y-1 mb-8">
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2 px-4">Internes Team</p>
              <button onClick={() => setAdminSubView('team')} className={`w-full flex items-center gap-3 py-2 px-4 text-[10px] uppercase tracking-widest transition-all ${adminSubView === 'team' ? 'bg-zinc-200 text-black font-bold' : 'hover:bg-zinc-100'}`}><Users size={14}/> Team / Bergführer</button>
              <button onClick={() => setAdminSubView('material')} className={`w-full flex items-center gap-3 py-2 px-4 text-[10px] uppercase tracking-widest transition-all ${adminSubView === 'material' ? 'bg-zinc-200 text-black font-bold' : 'hover:bg-zinc-100'}`}><FileText size={14}/> Ausrüstung & Material</button>
              <button onClick={() => setAdminSubView('aufgaben')} className={`w-full flex items-center gap-3 py-2 px-4 text-[10px] uppercase tracking-widest transition-all ${adminSubView === 'aufgaben' ? 'bg-zinc-200 text-black font-bold' : 'hover:bg-zinc-100'}`}><Kanban size={14}/> Aufgaben</button>
              <button onClick={() => setAdminSubView('dokumente')} className={`w-full flex items-center gap-3 py-2 px-4 text-[10px] uppercase tracking-widest transition-all ${adminSubView === 'dokumente' ? 'bg-zinc-200 text-black font-bold' : 'hover:bg-zinc-100'}`}><Folder size={14}/> Dokumente</button>
              <button onClick={() => setAdminSubView('protokolle')} className={`w-full flex items-center gap-3 py-2 px-4 text-[10px] uppercase tracking-widest transition-all ${adminSubView === 'protokolle' ? 'bg-zinc-200 text-black font-bold' : 'hover:bg-zinc-100'}`}><BookOpen size={14}/> Protokolle & Ideen</button>
              <button 
                onClick={() => {
                    setAdminSubView('newsletter');
                    setEditingNewsletter(null);
                }}
                className={`w-full flex items-center gap-3 py-2 px-4 text-[10px] uppercase tracking-widest transition-all ${adminSubView === 'newsletter' ? 'bg-zinc-200 text-black font-bold' : 'hover:bg-zinc-100'}`}
                >
                <Mail size={14}/> Newsletter
                </button>
            </div>

            <div className="space-y-1">
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2 px-4">System</p>
              <button onClick={() => setAdminSubView('trash')} className={`w-full flex items-center gap-3 py-2 px-4 text-[10px] uppercase tracking-widest transition-all ${adminSubView === 'trash' ? 'bg-red-500 text-white font-bold' : 'text-red-500 hover:bg-red-50'}`}><RotateCcw size={14}/> Papierkorb</button>
            </div>
          </aside>

          {/* Main Area */}
          <div className="flex-1 bg-white p-6 md:p-10 shadow-sm border border-zinc-100 min-h-[60vh] min-w-0 flex flex-col">
            
            {adminSubView === 'dashboard' && (
              <div className="fade-in space-y-12 max-w-7xl mx-auto w-full">
                <h3 className="serif text-3xl italic">Willkommen zurück</h3>

                {/* --- FRISTEN & WARNINGS --- */}
                {(urgentTours.length > 0 || urgentTasks.length > 0) && (
                    <div className="bg-amber-50 border border-amber-200 p-6 shadow-sm">
                        <h4 className="text-amber-800 font-bold uppercase tracking-widest text-[11px] mb-4 flex items-center gap-2"><AlertCircle size={16}/> Achtung: Anstehende Fristen & Deadlines</h4>
                        <div className="space-y-3">
                            {urgentTours.map(t => {
                                const days = getDaysUntil(t.stornoFrist);
                                const isOverdue = days < 0;
                                return (
                                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 border border-amber-100 cursor-pointer hover:border-black transition" onClick={() => { setAdminSubView('touren'); setEditingTour({...t, images: t.images || (t.image ? [t.image] : [])}); }}>
                                        <div className="mb-2 sm:mb-0">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-100 px-2 py-0.5 mr-3 rounded-sm">Tour Stornofrist</span>
                                            <span className="font-bold text-sm">{t.title}</span>
                                        </div>
                                        <span className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-sm ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                            {isOverdue ? `Abgelaufen vor ${Math.abs(days)} Tag(en)` : (days === 0 ? 'Frist endet HEUTE!' : `Frist endet in ${days} Tag(en)`)}
                                        </span>
                                    </div>
                                );
                            })}
                            {urgentTasks.map(t => {
                                const days = getDaysUntil(t.dueDate);
                                const isOverdue = days < 0;
                                return (
                                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 border border-amber-100 cursor-pointer hover:border-black transition" onClick={() => { setAdminSubView('aufgaben'); setEditingTask(t); }}>
                                        <div className="mb-2 sm:mb-0">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-100 px-2 py-0.5 mr-3 rounded-sm">Aufgabe</span>
                                            <span className="font-bold text-sm">{t.title}</span>
                                        </div>
                                        <span className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-sm ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                            {isOverdue ? `Fällig seit ${Math.abs(days)} Tag(en)` : (days === 0 ? 'Fällig HEUTE!' : `Fällig in ${days} Tag(en)`)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="p-6 bg-zinc-50 border border-zinc-100"><p className="text-[8px] uppercase tracking-widest text-zinc-400 mb-2">Offene Aufgaben</p><p className="serif text-3xl italic">{(tasks || []).filter(t => t.status !== 'Erledigt' && !t.isDeleted).length}</p></div>
                  <div className="p-6 bg-zinc-50 border border-zinc-100"><p className="text-[8px] uppercase tracking-widest text-zinc-400 mb-2">Neue Anfragen</p><p className="serif text-3xl italic">{(anfragen || []).filter(a => (!a.status || a.status === 'Neu / Offen') && !a.isDeleted).length}</p></div>
                  <div className="p-6 bg-zinc-50 border border-zinc-100"><p className="text-[8px] uppercase tracking-widest text-zinc-400 mb-2">Total Anmeldungen</p><p className="serif text-3xl italic">{(anmeldungen || []).length}</p></div>
                  <div className="p-6 bg-zinc-50 border border-zinc-100"><p className="text-[8px] uppercase tracking-widest text-zinc-400 mb-2">Kontakte im CRM</p><p className="serif text-3xl italic">{(kundenStamm || []).length}</p></div>
                </div>

                <div className="grid lg:grid-cols-2 gap-12 pt-8">
                    <div>
                        <h3 className="serif text-2xl italic mb-6">Letzte Anmeldungen</h3>
                        <div className="space-y-3">
                            {(anmeldungen || []).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).slice(0, 8).map(anm => (
                                <div key={anm.id} className="p-4 bg-zinc-50 border border-zinc-100">
                                    <div className="flex justify-between items-start">
                                        <p className="font-bold text-sm uppercase tracking-widest">{anm.vorname} {anm.name}</p>
                                        <span className="text-[9px] text-zinc-400 bg-white px-2 py-1 border border-zinc-200">{anm.tourTitle}</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-2">Am {anm.timestamp ? new Date(anm.timestamp.seconds * 1000).toLocaleDateString('de-CH') : 'Kürzlich'}</p>
                                </div>
                            ))}
                            {(anmeldungen || []).length === 0 && <p className="text-sm text-zinc-400 italic">Noch keine Buchungen eingegangen.</p>}
                        </div>
                    </div>

                    <div>
                        <h3 className="serif text-2xl italic mb-6">System Journal <span className="text-[10px] font-normal uppercase tracking-widest text-zinc-400 ml-2">(Wer macht was)</span></h3>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                            {(logs || []).slice(0, 30).map(log => (
                                <div key={log.id} className="p-4 bg-zinc-50 border border-zinc-100 flex flex-col gap-2">
                                    <p className="text-sm font-bold">{log.action}</p>
                                    <div className="flex justify-between items-center text-[9px] uppercase tracking-widest text-zinc-400">
                                        <span className="flex items-center gap-1"><User size={10} className="mb-0.5"/> {log.user}</span>
                                        <span>{new Date(log.timestamp).toLocaleString('de-CH')}</span>
                                    </div>
                                </div>
                            ))}
                            {(logs || []).length === 0 && <p className="text-sm text-zinc-400 italic">Noch keine System-Ereignisse protokolliert.</p>}
                        </div>
                    </div>
                </div>
              </div>
            )}

            {/* WEBSITE / HERO VIDEO ADMIN */}
            {adminSubView === 'website' && (
                <div className="fade-in max-w-6xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h3 className="serif text-3xl italic">Startseite & Design</h3>
                    </div>
                    <p className="text-sm text-zinc-500 mb-8 max-w-3xl">Hier kannst du das Hintergrund-Video (Hero-Video) für die Startseite austauschen. Lädst du mehrere Videos hoch, wird bei jedem Aufruf der Webseite zufällig eines davon abgespielt.</p>

                    <div className="bg-zinc-50 border border-zinc-200 p-6 shadow-sm mb-12 relative overflow-hidden">
                        <h4 className="text-[11px] font-bold uppercase tracking-widest border-b border-zinc-200 pb-3 mb-6">Neues Video hochladen & komprimieren</h4>
                        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                            <input 
                                type="file" 
                                accept="video/mp4,video/webm,video/quicktime" 
                                multiple
                                onChange={handleHeroVideoUpload}
                                className="w-full md:w-auto text-sm cursor-pointer border border-zinc-300 bg-white p-2" 
                            />
                            {videoProgress !== null && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-black bg-amber-200 px-4 py-2">
                                    Verarbeite Video ({videoProgress}%)... Bitte diesen Tab offen lassen!
                                </span>
                            )}
                            {(isUploading && videoProgress === null) && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 animate-pulse">
                                    Lädt hoch...
                                </span>
                            )}
                        </div>
                        {videoProgress !== null && (
                            <div className="absolute bottom-0 left-0 h-1 bg-amber-400 transition-all duration-300 ease-out" style={{ width: `${videoProgress}%` }}></div>
                        )}
                    </div>

                    <h4 className="text-[11px] font-bold uppercase tracking-widest border-b border-zinc-200 pb-3 mb-6">Aktive Startseiten-Videos ({(websiteSettings.heroVideos || []).length})</h4>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(websiteSettings.heroVideos || []).map((url, idx) => (
                            <div key={idx} className="relative bg-black group rounded-sm overflow-hidden aspect-video border border-zinc-200">
                                <video src={url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" muted loop playsInline onMouseOver={e=>e.target.play()} onMouseOut={e=>e.target.pause()} />
                                <button 
                                    onClick={() => deleteHeroVideo(url)} 
                                    className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-full shadow-lg opacity-100 md:opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                                    title="Video löschen"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        ))}
                        {(websiteSettings.heroVideos || []).length === 0 && (
                            <div className="col-span-full p-12 border border-dashed border-zinc-300 text-center text-zinc-400 text-[10px] uppercase tracking-widest">
                                Standard-Video aktiv. (Keine eigenen hochgeladen)
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ANGEBOTE ADMIN */}
            {adminSubView === 'angebote' && (
                <div className="fade-in max-w-6xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h3 className="serif text-3xl italic">Angebote (Kategorien) verwalten</h3>
                        <button onClick={() => { setEditingAngebot({ title: '', season: 'Sommer', desc: '', longDesc: '', image: '' }); setPendingDeletes([]); }} className="bg-black text-white px-8 py-3 text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition shadow-md w-full md:w-auto text-center">+ Neues Angebot</button>
                    </div>

                    {editingAngebot ? (
                        <form onSubmit={saveAngebot} className="space-y-8 bg-zinc-50 p-5 md:p-8 border border-zinc-200 shadow-sm fade-in">
                            <div className="flex justify-between items-center border-b border-zinc-200 pb-4 mb-6">
                                <h3 className="serif text-2xl italic">{editingAngebot.id ? 'Angebot bearbeiten' : 'Neues Angebot'}</h3>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-8">
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Titel / Name der Kategorie</label><input name="title" defaultValue={editingAngebot.title} required className="w-full border border-zinc-300 p-3 text-base mt-2 outline-none focus:border-black transition" /></div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Saison (Tab auf Webseite)</label>
                                    <select name="season" defaultValue={editingAngebot.season} className="w-full border border-zinc-300 p-3 text-base mt-2 outline-none focus:border-black transition cursor-pointer bg-white">
                                        <option value="Sommer">Sommer</option>
                                        <option value="Winter">Winter</option>
                                        <option value="Spontantouren">Spontantouren</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="pt-6 border-t border-zinc-200">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Bilder für dieses Angebot</label>
                                
                                <div className="flex flex-wrap gap-4 mb-4">
                                    {(editingAngebot.images || (editingAngebot.image ? [editingAngebot.image] : [])).map((imgUrl, idx, arr) => (
                                        <div key={idx} className="relative w-32 h-32 bg-zinc-100 border border-zinc-200 shadow-sm group/img">
                                            <img src={imgUrl} alt="Angebotbild" className="w-full h-full object-cover" />
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setPendingDeletes([...pendingDeletes, imgUrl]);
                                                    const newImages = [...arr];
                                                    newImages.splice(idx, 1);
                                                    setEditingAngebot({...editingAngebot, images: newImages});
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md opacity-100 md:opacity-0 group-hover/img:opacity-100 hover:scale-110 transition-all z-20"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                            <div className="absolute bottom-0 w-full flex justify-between bg-black/50 p-1 opacity-100 md:opacity-0 group-hover/img:opacity-100 transition-opacity z-10">
                                                {idx > 0 ? <button type="button" onClick={() => moveImage(arr, newArr => setEditingAngebot({...editingAngebot, images: newArr}), idx, -1)} className="p-1 hover:bg-white/20 rounded"><ChevronLeft size={16} className="text-white"/></button> : <div/>}
                                                {idx < arr.length - 1 ? <button type="button" onClick={() => moveImage(arr, newArr => setEditingAngebot({...editingAngebot, images: newArr}), idx, 1)} className="p-1 hover:bg-white/20 rounded"><ChevronRight size={16} className="text-white"/></button> : <div/>}
                                            </div>
                                            {idx === 0 && <div className="absolute bottom-8 inset-x-0 bg-black/70 text-white text-[8px] uppercase tracking-widest text-center py-1.5 backdrop-blur-sm pointer-events-none">Titelbild</div>}
                                        </div>
                                    ))}
                                    {(editingAngebot.images || (editingAngebot.image ? [editingAngebot.image] : [])).length === 0 && <p className="text-xs text-zinc-400 italic py-4">Noch keine Bilder hinzugefügt.</p>}
                                </div>

                                <div className="flex-1 border-2 border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 hover:border-black transition cursor-pointer flex flex-col justify-center items-center relative min-h-[8rem] p-6 group">
                                    <UploadCloud size={28} className="text-zinc-400 mb-3 group-hover:text-black transition" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-600 group-hover:text-black transition">Weitere Bilder hinzufügen</span>
                                    <input type="file" name="angebot_files" accept="image/*" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-zinc-200">
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Kurzbeschreibung (Übersicht)</label><textarea name="desc" defaultValue={editingAngebot.desc} className="w-full border border-zinc-300 p-4 text-sm h-32 resize-y mt-2 outline-none focus:border-black transition" /></div>
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Langer Text (Detailansicht)</label><textarea name="longDesc" defaultValue={editingAngebot.longDesc} className="w-full border border-zinc-300 p-4 text-sm h-32 resize-y mt-2 outline-none focus:border-black transition" /></div>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 pt-8 border-t border-zinc-200">
                                <button type="button" onClick={() => { setEditingAngebot(null); setPendingDeletes([]); }} className="w-full sm:w-auto border border-zinc-300 px-10 py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition text-center">Abbrechen</button>
                                <button type="submit" disabled={isUploading} className="w-full sm:w-auto bg-black text-white px-12 py-4 text-[10px] font-bold uppercase tracking-widest shadow-xl hover:bg-zinc-800 transition text-center">{isUploading ? 'Lädt...' : 'Speichern'}</button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4 fade-in">
                            <p className="text-sm text-zinc-500 mb-8">Diese Angebote erscheinen direkt auf der Hauptseite. Ihre Namen fungieren gleichzeitig als Kategorien für die einzelnen Touren. <b>Hier kannst du ihre Reihenfolge festlegen.</b></p>
                            
                            {sortedAngebote.map((angebot, i) => (
                                <div key={angebot.id || i} className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-5 md:p-6 border border-zinc-200 bg-white hover:border-black transition group">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-12 overflow-hidden bg-zinc-100 flex-shrink-0">
                                            {(angebot.images || angebot.image) ? <img src={(angebot.images || [angebot.image])[0]} className="w-full h-full object-cover" alt="" /> : <Layers className="w-full h-full p-3 text-zinc-300"/>}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold uppercase tracking-widest mb-1 flex items-center flex-wrap gap-2">
                                                {angebot.title} 
                                            </p>
                                            <p className="text-xs text-zinc-500">Saison: {angebot.season}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-4 sm:gap-6 items-center opacity-100 md:opacity-70 group-hover:opacity-100 transition pt-2 sm:pt-0 border-t sm:border-0 border-zinc-100">
                                        <div className="flex gap-1 border-r border-zinc-300 pr-4 mr-2">
                                            <button onClick={() => moveAngebot(i, -1)} disabled={i === 0} className={`p-1 rounded-sm transition ${i === 0 ? 'text-zinc-200 cursor-not-allowed' : 'text-zinc-400 hover:text-black hover:bg-zinc-100'}`}><ChevronUp size={16}/></button>
                                            <button onClick={() => moveAngebot(i, 1)} disabled={i === sortedAngebote.length - 1} className={`p-1 rounded-sm transition ${i === sortedAngebote.length - 1 ? 'text-zinc-200 cursor-not-allowed' : 'text-zinc-400 hover:text-black hover:bg-zinc-100'}`}><ChevronDown size={16}/></button>
                                        </div>
                                        <button onClick={() => { setEditingAngebot({...angebot, images: angebot.images || (angebot.image ? [angebot.image] : [])}); setPendingDeletes([]); }} className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-black flex items-center gap-2"><Edit size={14}/> Bearbeiten</button>
                                        <button onClick={() => softDelete('angebote', angebot.id, angebot.title)} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600 flex items-center gap-2"><Trash2 size={14}/> Löschen</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TEAM PROFILES ADMIN */}
            {adminSubView === 'team' && (
                <div className="fade-in max-w-6xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h3 className="serif text-3xl italic">Internes Team & Bergführer</h3>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <button onClick={() => setShowTeamAttributesModal(true)} className="flex-1 md:flex-none justify-center border border-zinc-300 p-3 px-6 text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 transition"><Settings size={14}/> Steckbrief-Felder anpassen</button>
                            <button onClick={() => { setEditingTeamMember({ name: '', title: 'BERGFÜHRER IVBV', desc: '', visible: true }); setPendingDeletes([]); }} className="flex-1 md:flex-none justify-center bg-black text-white p-3 px-6 text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-800 transition shadow-md"><Plus size={14}/> Neues Profil</button>
                        </div>
                    </div>

                    {editingTeamMember ? (
                        <form onSubmit={saveTeamMember} className="space-y-8 bg-zinc-50 p-5 md:p-8 border border-zinc-200 shadow-sm fade-in">
                            <div className="flex justify-between items-center border-b border-zinc-200 pb-4 mb-6">
                                <h3 className="serif text-2xl italic">{editingTeamMember.id ? 'Profil bearbeiten' : 'Neues Profil'}</h3>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-8">
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Name</label><input name="name" defaultValue={editingTeamMember.name} required className="w-full border border-zinc-300 p-3 text-base mt-2 outline-none focus:border-black transition" /></div>
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Titel / Ausbildung</label><input name="title" defaultValue={editingTeamMember.title} required className="w-full border border-zinc-300 p-3 text-base mt-2 outline-none focus:border-black transition" /></div>
                                
                                <div className="flex items-center h-full pt-4 md:col-span-2">
                                    <label className="relative flex items-center gap-4 bg-white p-5 border border-zinc-300 hover:border-black transition w-full cursor-pointer select-none group">
                                        <div className="relative flex items-center justify-center w-6 h-6 flex-shrink-0">
                                            <input 
                                                type="checkbox" 
                                                checked={editingTeamMember.visible !== false} 
                                                onChange={(e) => setEditingTeamMember({ ...editingTeamMember, visible: e.target.checked })} 
                                                className="peer appearance-none w-full h-full border-2 border-zinc-300 rounded-none bg-white checked:bg-black checked:border-black transition-all cursor-pointer m-0" 
                                            />
                                            <svg className="absolute w-4 h-4 text-white pointer-events-none hidden peer-checked:block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </div>
                                        <span className="text-sm font-bold uppercase tracking-widest text-zinc-600 group-hover:text-black transition">Profil auf Webseite anzeigen (Bergführer-Seite)</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div className="pt-6 border-t border-zinc-200 md:col-span-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Profilbilder (Erstes Bild = Avatar)</label>
                                
                                <div className="flex flex-wrap gap-4 mb-4">
                                    {(editingTeamMember.images || (editingTeamMember.image ? [editingTeamMember.image] : [])).map((imgUrl, idx, arr) => (
                                        <div key={idx} className="relative w-32 h-32 bg-zinc-100 border border-zinc-200 shadow-sm group/img">
                                            <img src={imgUrl} alt="Profilbild" className="w-full h-full object-cover" />
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setPendingDeletes([...pendingDeletes, imgUrl]);
                                                    const newImages = [...arr];
                                                    newImages.splice(idx, 1);
                                                    setEditingTeamMember({...editingTeamMember, images: newImages});
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md opacity-100 md:opacity-0 group-hover/img:opacity-100 hover:scale-110 transition-all z-20"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                            <div className="absolute bottom-0 w-full flex justify-between bg-black/50 p-1 opacity-100 md:opacity-0 group-hover/img:opacity-100 transition-opacity z-10">
                                                {idx > 0 ? <button type="button" onClick={() => moveImage(arr, newArr => setEditingTeamMember({...editingTeamMember, images: newArr}), idx, -1)} className="p-1 hover:bg-white/20 rounded"><ChevronLeft size={16} className="text-white"/></button> : <div/>}
                                                {idx < arr.length - 1 ? <button type="button" onClick={() => moveImage(arr, newArr => setEditingTeamMember({...editingTeamMember, images: newArr}), idx, 1)} className="p-1 hover:bg-white/20 rounded"><ChevronRight size={16} className="text-white"/></button> : <div/>}
                                            </div>
                                            {idx === 0 && <div className="absolute bottom-8 inset-x-0 bg-black/70 text-white text-[8px] uppercase tracking-widest text-center py-1.5 backdrop-blur-sm pointer-events-none">Avatar</div>}
                                        </div>
                                    ))}
                                    {(editingTeamMember.images || (editingTeamMember.image ? [editingTeamMember.image] : [])).length === 0 && <p className="text-xs text-zinc-400 italic py-4">Noch keine Bilder hinzugefügt.</p>}
                                </div>

                                <div className="flex-1 border-2 border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 hover:border-black transition cursor-pointer flex flex-col justify-center items-center relative min-h-[8rem] p-6 group">
                                    <UploadCloud size={28} className="text-zinc-400 mb-3 group-hover:text-black transition" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-600 group-hover:text-black transition">Weitere Bilder hinzufügen</span>
                                    <input type="file" name="team_files" accept="image/*" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Beschreibung (Haupttext)</label>
                                <textarea name="desc" defaultValue={editingTeamMember.desc} required className="w-full border border-zinc-300 p-5 text-base h-32 resize-y mt-2 outline-none focus:border-black transition" />
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-zinc-200">
                                {activeTeamAttributes.map(attr => (
                                    <div key={attr}>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{attr}</label>
                                        <textarea 
                                            name={`custom_${attr}`} 
                                            defaultValue={editingTeamMember.customFields?.[attr] || getLegacyTeamField(editingTeamMember, attr)} 
                                            className="w-full border border-zinc-300 p-4 text-sm h-24 resize-y mt-2 outline-none focus:border-black transition" 
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 pt-8 border-t border-zinc-200">
                                <button type="button" onClick={() => { setEditingTeamMember(null); setPendingDeletes([]); }} className="w-full sm:w-auto border border-zinc-300 px-10 py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition text-center">Abbrechen</button>
                                <button type="submit" disabled={isUploading} className="w-full sm:w-auto bg-black text-white px-12 py-4 text-[10px] font-bold uppercase tracking-widest shadow-xl hover:bg-zinc-800 transition text-center">{isUploading ? 'Lädt...' : 'Profil Speichern'}</button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4 fade-in">
                            <p className="text-sm text-zinc-500 mb-8">Verwalte hier die Personen in eurem Team. Sichtbare Profile erscheinen im "Kollektiv" auf der Webseite.</p>
                            
                            {teamProfiles.filter(t => !t.isDeleted).map(member => (
                                <div key={member.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-5 md:p-6 border border-zinc-200 bg-white hover:border-black transition group">
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-100 flex-shrink-0">
                                            {(member.images || member.image) ? <img src={(member.images || [member.image])[0]} className="w-full h-full object-cover" alt="" /> : <User className="w-full h-full p-3 text-zinc-300"/>}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold uppercase tracking-widest mb-1 flex items-center flex-wrap gap-2">
                                                {member.name} 
                                                {member.visible === false && <span className="text-red-500 bg-red-50 px-2 py-0.5 text-[8px]">[VERSTECKT]</span>}
                                            </p>
                                            <p className="text-xs text-zinc-500">{member.title}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-4 sm:gap-6 items-center opacity-100 md:opacity-70 group-hover:opacity-100 transition pt-2 sm:pt-0 border-t sm:border-0 border-zinc-100">
                                        <button onClick={() => { setEditingTeamMember({...member, images: member.images || (member.image ? [member.image] : [])}); setPendingDeletes([]); }} className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-black flex items-center gap-2"><Edit size={14}/> Bearbeiten</button>
                                        <button onClick={() => softDelete('team_profiles', member.id, member.name)} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600 flex items-center gap-2"><Trash2 size={14}/> Löschen</button>
                                    </div>
                                </div>
                            ))}
                            {teamProfiles.filter(t => !t.isDeleted).length === 0 && <p className="text-center p-12 text-sm text-zinc-400 uppercase tracking-widest border border-dashed border-zinc-300">Noch keine aktiven Teammitglieder.</p>}
                        </div>
                    )}
                </div>
            )}

            {/* MATERIAL MANAGER ADMIN */}
            {adminSubView === 'material' && (
                <div className="fade-in max-w-6xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <h3 className="serif text-3xl italic">Ausrüstung & Materiallisten</h3>
                    </div>

                    <div className="grid md:grid-cols-12 gap-8">
                        <div className="md:col-span-5 lg:col-span-4">
                            <form onSubmit={saveMaterialList} className="bg-zinc-50 border border-zinc-200 p-6 shadow-sm space-y-6">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest border-b border-zinc-200 pb-3">Neue Liste hochladen</h4>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Name der Liste</label>
                                    <input name="name" required placeholder="z.B. Packliste Hochtouren" className="w-full border border-zinc-300 p-3 text-sm mt-2 outline-none focus:border-black transition" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block">PDF Datei auswählen</label>
                                    <input type="file" accept=".pdf" name="file" required className="w-full text-sm cursor-pointer border border-zinc-300 bg-white p-2" />
                                </div>
                                <button type="submit" disabled={isUploading} className="w-full bg-black text-white px-6 py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition shadow-xl text-center">
                                    {isUploading ? 'Wird hochgeladen...' : 'Liste Speichern'}
                                </button>
                            </form>
                        </div>
                        <div className="md:col-span-7 lg:col-span-8">
                            <div className="space-y-3">
                                {(materialLists || []).map(list => (
                                    <div key={list.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-4 md:p-5 border border-zinc-200 bg-white hover:border-black transition group">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-zinc-100 text-zinc-400 rounded-sm flex-shrink-0"><FileText size={20}/></div>
                                            <div>
                                                <p className="font-bold text-sm">{list.name}</p>
                                                <p className="text-[9px] uppercase tracking-widest text-zinc-400">{list.createdAt ? new Date(list.createdAt).toLocaleDateString('de-CH') : ''}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 border-t sm:border-0 border-zinc-100 pt-3 sm:pt-0">
                                            <a href={list.url} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest hover:text-black text-zinc-500 transition flex items-center gap-2"><ExternalLink size={14}/> PDF</a>
                                            <button onClick={() => deleteDoc(doc(db, 'material_lists', list.id))} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600 transition flex items-center gap-2"><Trash2 size={14}/> Löschen</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {adminSubView === 'newsletter' && (
            <div className="newsletter-dashboard" style={{ display: 'flex', gap: '2rem' }}>
                
                {/* LINKE SPALTE: Liste der Entwürfe */}
                <div className="newsletter-list" style={{ width: '250px', borderRight: '1px solid #ddd', paddingRight: '1rem' }}>
                    <h3>Gespeicherte Entwürfe</h3>
                    <button 
                        onClick={() => setEditingNewsletter(null)}
                        style={{ width: '100%', marginBottom: '1rem' }}
                        className="bg-black text-white p-2 text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition"
                    >
                        + Neuer Newsletter
                    </button>

                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {newsletters.map(nl => (
                        <li 
                            key={nl.id} 
                            onClick={() => setEditingNewsletter(nl)}
                            style={{ 
                            padding: '10px', 
                            cursor: 'pointer', 
                            background: editingNewsletter?.id === nl.id ? '#eee' : 'transparent',
                            borderBottom: '1px solid #eee'
                            }}
                        >
                            <strong>{nl.betreff || 'Ohne Betreff'}</strong><br/>
                            <small>
                            {nl.datum ? nl.datum.toDate().toLocaleDateString('de-CH') : ''}
                            </small>
                        </li>
                        ))}
                    </ul>
                </div>

                {/* RECHTE SPALTE: Hier kommt dein Newsletter-Fenster (Editor) hin! */}
                <div className="newsletter-editor" style={{ flex: 1 }}>
                    <NewsletterEditor 
                        // Hier übergibst du den aktuell ausgewählten Entwurf an den Editor
                        currentNewsletter={editingNewsletter} 
                        // Eventuelle weitere Props, die dein Editor benötigt:
                        // onSave={...} 
                    />
                </div>
            </div>
            )}

            {adminSubView === 'kunden' && (
                <div className="fade-in w-full max-w-[1600px] mx-auto">
                    {!selectedKunde ? (
                        <div className="fade-in">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                                <div>
                                    <h3 className="serif text-3xl italic">Kundenstamm</h3>
                                    <p className="text-[10px] uppercase tracking-widest text-zinc-400 mt-1">{filteredKunden.length} Kontakte gefiltert</p>
                                </div>
                                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                    <button onClick={() => { setSelectedKunde({ email: '', vorname: '', name: '', phone: '', adresse: '', plz: '', ort: '', stammkunde_von: '', touren: [], anfragen: [], isNew: true }); setIsEditingKunde(true); }} className="bg-white border border-zinc-300 px-4 py-2 text-[9px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 font-bold"><Plus size={14}/> Neuer Kunde</button>
                                    <button onClick={() => exportKundenExcel(filteredKunden)} className="border border-zinc-200 px-4 py-2 text-[9px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50"><Download className="w-3 h-3"/> Excel</button>
                                    <button onClick={copyNewsletterBCC} className="bg-black text-white px-4 py-2 text-[9px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-800"><Mail className="w-3 h-3"/> Newsletter (BCC)</button>
                                </div>
                            </div>
                            <div className="mb-8 relative w-full md:max-w-sm">
                                <Search className="absolute left-3 top-3 text-zinc-400 w-4 h-4" />
                                <input type="text" placeholder="Suchen nach Name, Email..." value={kundenSearch} onChange={(e) => setKundenSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 text-sm outline-none focus:border-black" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredKunden.map((k, i) => (
                                    <div key={i} onClick={() => { setSelectedKunde(k); setNotizInput(k.notizText || ''); setIsEditingKunde(false); }} className="p-6 border border-zinc-100 bg-zinc-50 cursor-pointer hover:border-black group flex flex-col justify-between transition">
                                        <div>
                                            <div className="flex justify-between items-start gap-2">
                                                <p className="font-bold text-sm uppercase tracking-widest mb-1 break-words">{k.vorname || k.name ? `${k.vorname} ${k.name}` : <span className="italic text-zinc-400">Ohne Name</span>}</p>
                                                {k.stammkunde_von && <span className="text-[8px] bg-zinc-200 px-1.5 py-0.5 uppercase font-bold tracking-widest whitespace-nowrap">{k.stammkunde_von}</span>}
                                            </div>
                                            <p className="text-[10px] text-zinc-500 lowercase truncate mb-3">{k.email}</p>
                                            
                                            {(k.adresse || k.plz || k.ort || k.plz_ort_legacy) && (
                                                <div className="flex items-start gap-2 text-[10px] text-zinc-400 mt-2">
                                                    <MapPin size={12} className="flex-shrink-0 mt-0.5" />
                                                    <span className="truncate line-clamp-2">
                                                        {k.adresse && <>{k.adresse}<br/></>}
                                                        {k.plz} {k.ort} {(!k.plz && !k.ort) ? k.plz_ort_legacy : ''}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-6 pt-4 border-t border-zinc-200 text-[9px] uppercase tracking-widest text-zinc-400 flex justify-between items-center">
                                            <span>{k.touren.length} Touren | {k.anfragen.length} Anfragen</span>
                                            <span className={k.newsletter ? "text-green-600" : "text-zinc-300"}><Mail className="w-3 h-3"/></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="fade-in">
                            {(() => {
                                const currentKunde = kundenStamm.find(k => k.email === selectedKunde.email) || selectedKunde;
                                return (
                                    <>
                                        <button onClick={() => { setSelectedKunde(null); setIsEditingKunde(false); }} className="text-[10px] uppercase tracking-widest text-zinc-400 hover:text-black mb-8 border-b border-transparent hover:border-black pb-1 transition inline-block">← Zurück zur Liste</button>
                                        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16">
                                            
                                            <div className="lg:col-span-4 space-y-8">
                                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-zinc-100 pb-6">
                                                    <div>
                                                        <h2 className="serif text-4xl italic mb-2 break-words">{currentKunde.vorname} {currentKunde.name}</h2>
                                                        {!isEditingKunde && currentKunde.stammkunde_von && <span className="inline-block mt-2 text-[9px] uppercase tracking-widest bg-zinc-100 font-bold px-2 py-1">Stammkunde von {currentKunde.stammkunde_von}</span>}
                                                        {currentKunde.isNew && <span className="inline-block mt-2 text-[9px] uppercase tracking-widest bg-blue-100 text-blue-700 font-bold px-2 py-1">Neue Erfassung</span>}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setIsEditingKunde(!isEditingKunde)} className={`p-2 rounded-full self-start transition ${isEditingKunde ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                                                            {isEditingKunde ? <X size={16}/> : <Edit size={16}/>}
                                                        </button>
                                                        {/* DSGVO LÖSCHEN BUTTON */}
                                                        {!currentKunde.isNew && (
                                                            <button onClick={async () => {
                                                                if(confirm(`ACHTUNG DSGVO LÖSCHUNG:\nWillst du ${currentKunde.vorname} ${currentKunde.name} WIRKLICH inklusive ALLER Anmeldungen und Anfragen unwiderruflich aus dem System löschen?`)) {
                                                                    try {
                                                                        const emailId = currentKunde.email.toLowerCase().trim();
                                                                        
                                                                        // 1. Notizen löschen
                                                                        await deleteDoc(doc(db, 'kunden_notizen', emailId));
                                                                        
                                                                        // 2. Alle Anmeldungen dieses Kunden löschen
                                                                        for (const a of currentKunde.touren) {
                                                                            await deleteDoc(doc(db, 'anmeldungen', a.id));
                                                                            if (!a.isArchived && a.tourId && !a.tourId.startsWith('mock-')) {
                                                                                await updateDoc(doc(db, 'touren', a.tourId), { angemeldet: increment(-1) });
                                                                            }
                                                                        }
                                                                        
                                                                        // 3. Alle Anfragen dieses Kunden löschen
                                                                        for (const anf of currentKunde.anfragen) {
                                                                            await deleteDoc(doc(db, 'anfragen', anf.id));
                                                                        }
                                                                        
                                                                        logAction(`Kunde komplett gelöscht (DSGVO): ${emailId}`);
                                                                        setSelectedKunde(null);
                                                                    } catch (e) {
                                                                        console.error("Fehler beim Löschen des Kunden:", e);
                                                                        alert("Es gab ein Problem beim Löschen. Bitte Konsole prüfen.");
                                                                    }
                                                                }
                                                            }} className="p-2 rounded-full self-start transition bg-red-50 text-red-500 hover:bg-red-500 hover:text-white" title="Kunde komplett löschen">
                                                                <Trash2 size={16}/>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {isEditingKunde ? (
                                                    <form onSubmit={async (e) => {
                                                        e.preventDefault();
                                                        const fd = new FormData(e.target);
                                                        const emailToSave = currentKunde.isNew ? fd.get('email').toLowerCase().trim() : currentKunde.email;
                                                        
                                                        const dataToSave = {
                                                            vorname: fd.get('vorname'), name: fd.get('name'), phone: fd.get('phone'),
                                                            adresse: fd.get('adresse'), plz: fd.get('plz'), ort: fd.get('ort'), stammkunde_von: fd.get('stammkunde_von')
                                                        };
                                                        await setDoc(doc(db, 'kunden_notizen', emailToSave), dataToSave, { merge: true });
                                                        logAction(`Kunde bearbeitet/erstellt: ${dataToSave.vorname} ${dataToSave.name}`);
                                                        setSelectedKunde({ ...currentKunde, ...dataToSave, email: emailToSave, isNew: false });
                                                        setIsEditingKunde(false);
                                                    }} className="space-y-5 bg-zinc-50 p-5 md:p-6 border border-zinc-200 fade-in shadow-inner">
                                                        
                                                        {currentKunde.isNew && (
                                                            <div className="pb-4 border-b border-zinc-200">
                                                                <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">E-Mail Adresse (Eindeutige ID) *</label>
                                                                <input name="email" type="email" required defaultValue={currentKunde.email} placeholder="E-Mail ist zwingend..." className="w-full border border-zinc-300 p-2.5 text-sm outline-none focus:border-black mt-1 bg-white" />
                                                            </div>
                                                        )}
                                                        
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <div><label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Vorname</label><input name="vorname" defaultValue={currentKunde.vorname} className="w-full border border-zinc-200 p-2.5 text-sm outline-none focus:border-black bg-white mt-1" /></div>
                                                            <div><label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Name</label><input name="name" defaultValue={currentKunde.name} className="w-full border border-zinc-200 p-2.5 text-sm outline-none focus:border-black bg-white mt-1" /></div>
                                                        </div>
                                                        <div><label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Telefon</label><input name="phone" defaultValue={currentKunde.phone} className="w-full border border-zinc-200 p-2.5 text-sm outline-none focus:border-black bg-white mt-1" /></div>
                                                        <div className="pt-2 border-t border-zinc-200">
                                                            <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Strasse & Hausnr.</label>
                                                            <input name="adresse" defaultValue={currentKunde.adresse} className="w-full border border-zinc-200 p-2.5 text-sm outline-none focus:border-black bg-white mt-1" />
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                            <div className="sm:col-span-1"><label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">PLZ</label><input name="plz" defaultValue={currentKunde.plz} className="w-full border border-zinc-200 p-2.5 text-sm outline-none focus:border-black bg-white mt-1" /></div>
                                                            <div className="sm:col-span-2"><label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Ort</label><input name="ort" defaultValue={currentKunde.ort} className="w-full border border-zinc-200 p-2.5 text-sm outline-none focus:border-black bg-white mt-1" /></div>
                                                        </div>
                                                        <div className="pt-2 border-t border-zinc-200">
                                                            <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Stammkunde bei (Zuweisung)</label>
                                                            <select name="stammkunde_von" defaultValue={currentKunde.stammkunde_von} className="w-full border border-zinc-200 p-3 text-xs uppercase tracking-widest outline-none bg-white cursor-pointer mt-1">
                                                                <option value="">- Niemand speziell zugewiesen -</option>
                                                                {teamMemberNames.map(m => <option key={m} value={m}>{m}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
                                                            <button type="button" onClick={() => currentKunde.isNew ? setSelectedKunde(null) : setIsEditingKunde(false)} className="w-full sm:w-auto px-5 py-3 text-[9px] uppercase tracking-widest border border-zinc-200 hover:bg-zinc-100 transition bg-white text-center">Abbrechen</button>
                                                            <button type="submit" className="w-full sm:w-auto bg-black text-white px-5 py-3 text-[9px] uppercase tracking-widest hover:bg-zinc-800 transition text-center">Speichern</button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <div className="space-y-6 fade-in">
                                                        <div className="p-5 bg-[#f9f9f7] border border-zinc-100">
                                                            <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 mb-2">E-Mail</p>
                                                            <a href={`mailto:${currentKunde.email}`} className="text-sm text-blue-600 hover:underline break-all">{currentKunde.email}</a>
                                                            
                                                            <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 mb-2 mt-4">Telefon</p>
                                                            <p className="text-sm text-zinc-700">{currentKunde.phone || <span className="italic text-zinc-400">Nicht erfasst</span>}</p>
                                                        </div>
                                                        
                                                        <div className="p-5 bg-[#f9f9f7] border border-zinc-100">
                                                            <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Postadresse</p>
                                                            <p className="text-sm text-zinc-700 leading-relaxed">
                                                                {(currentKunde.adresse || currentKunde.plz || currentKunde.ort || currentKunde.plz_ort_legacy) ? (
                                                                    <>
                                                                        {currentKunde.adresse && <>{currentKunde.adresse}<br/></>}
                                                                        {currentKunde.plz} {currentKunde.ort} {(!currentKunde.plz && !currentKunde.ort) ? currentKunde.plz_ort_legacy : ''}
                                                                    </>
                                                                ) : <span className="italic text-zinc-400">Nicht erfasst</span>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="bg-[#f9f9f7] p-5 border border-zinc-100">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest">Newsletter Status</p>
                                                        <button onClick={() => toggleNewsletter(currentKunde.email, currentKunde.newsletter)} className={`w-12 h-6 rounded-full relative transition-colors ${currentKunde.newsletter ? 'bg-green-500' : 'bg-zinc-300'}`}>
                                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${currentKunde.newsletter ? 'translate-x-6' : 'translate-x-0'}`}></span>
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="bg-[#f9f9f7] p-5 border border-zinc-100">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest mb-3">Interne Notizen zum Kunden</p>
                                                    <textarea value={notizInput} onChange={(e) => setNotizInput(e.target.value)} placeholder="Z.B. Benötigt oft Leihmaterial..." className="w-full h-32 p-4 text-sm border border-zinc-200 bg-white outline-none mb-4 resize-y focus:border-black transition" />
                                                    <button onClick={() => { setDoc(doc(db, 'kunden_notizen', currentKunde.email), { text: notizInput }, { merge: true }); alert('Notiz gespeichert!'); logAction(`Kunden-Notiz gespeichert für ${currentKunde.email}`); }} className="w-full bg-black text-white py-3 text-[9px] uppercase tracking-widest hover:bg-zinc-800 transition">Notiz Speichern</button>
                                                </div>
                                            </div>

                                            <div className="lg:col-span-8 space-y-12">
                                                <div>
                                                    <h3 className="text-[11px] font-bold uppercase tracking-widest border-b border-zinc-200 pb-3 mb-6">Gebuchte Touren ({currentKunde.touren.length})</h3>
                                                    <div className="grid gap-4">
                                                        {currentKunde.touren.map(anm => (
                                                            <div key={anm.id} className="p-5 bg-zinc-50 border border-zinc-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-black transition">
                                                                <div>
                                                                    <span className="text-[9px] text-zinc-400 tracking-widest">{anm.timestamp ? new Date(anm.timestamp.seconds * 1000).toLocaleDateString('de-CH') : ''}</span>
                                                                    <p className="font-bold text-base mt-1">
                                                                        {anm.tourTitle}
                                                                        {anm.isArchived && <span className="ml-2 text-[8px] bg-zinc-200 text-zinc-500 px-2 py-0.5 rounded-sm uppercase tracking-widest font-bold">Archiviert {anm.archiveLabel && `(${anm.archiveLabel})`}</span>}
                                                                    </p>
                                                                    {anm.besonderes && <p className="text-sm text-zinc-600 mt-2 italic bg-white p-3 border border-zinc-100">"{anm.besonderes}"</p>}
                                                                </div>
                                                                <span className="text-[10px] uppercase tracking-widest bg-zinc-200 px-3 py-1.5 font-bold self-start sm:self-auto">{anm.status || 'Erfolgreich'}</span>
                                                            </div>
                                                        ))}
                                                        {currentKunde.touren.length === 0 && <p className="text-sm text-zinc-400 italic">Dieser Kunde hat noch keine Touren gebucht.</p>}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="text-[11px] font-bold uppercase tracking-widest border-b border-zinc-200 pb-3 mb-6">Formular Anfragen ({currentKunde.anfragen.length})</h3>
                                                    <div className="grid gap-4">
                                                        {currentKunde.anfragen.map(anf => (
                                                            <div key={anf.id} className="p-5 bg-zinc-50 border border-zinc-100 hover:border-black transition">
                                                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 border-b border-zinc-100 pb-3">
                                                                    <p className="font-bold text-sm">Betrifft: {anf.thema || 'Allgemein'}</p>
                                                                    <span className="text-[9px] text-zinc-400">{anf.timestamp ? new Date(anf.timestamp.seconds * 1000).toLocaleDateString('de-CH') : ''}</span>
                                                                </div>
                                                                <p className="text-sm text-zinc-700 italic leading-relaxed">"{anf.nachricht}"</p>
                                                            </div>
                                                        ))}
                                                        {currentKunde.anfragen.length === 0 && <p className="text-sm text-zinc-400 italic">Dieser Kunde hat noch keine allgemeinen Anfragen gesendet.</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {/* ANFRAGEN ADMIN */}
            {adminSubView === 'anfragen' && (
                <div className="fade-in max-w-5xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <h3 className="serif text-3xl italic">Anfragen über die Website</h3>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4 mb-8 bg-zinc-50 p-4 border border-zinc-200">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                            <input 
                                type="text" 
                                placeholder="Suchen nach Name, Email..." 
                                value={anfragenSearch} 
                                onChange={(e) => setAnfragenSearch(e.target.value)} 
                                className="w-full pl-10 pr-4 py-3 border border-zinc-300 text-sm outline-none focus:border-black bg-white" 
                            />
                        </div>
                        <div className="flex-1 md:max-w-xs">
                            <select 
                                value={anfragenStatusFilter} 
                                onChange={e => setAnfragenStatusFilter(e.target.value)} 
                                className="w-full border border-zinc-300 p-3 text-sm outline-none bg-white cursor-pointer"
                            >
                                <option value="Alle">Alle Status anzeigen</option>
                                {ANFRAGEN_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {getFilteredAnfragen().map(a => (
                            <div key={a.id} className="p-5 md:p-8 border border-zinc-200 bg-zinc-50 relative group hover:border-black transition">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                                    <span className="text-[10px] uppercase tracking-widest font-bold bg-black text-white px-4 py-1.5 self-start">{a.thema || 'Allgemein'}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-zinc-400">{a.timestamp ? new Date(a.timestamp.seconds * 1000).toLocaleDateString('de-CH') : ''}</span>
                                        <button onClick={() => softDelete('anfragen', a.id, `${a.vorname} ${a.name}`)} className="text-red-300 hover:text-red-500 opacity-100 md:opacity-0 group-hover:opacity-100 transition"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                                <p className="font-bold text-xl mt-4 break-words">{a.vorname} {a.name}</p>
                                <a href={`mailto:${a.email}`} className="text-sm text-blue-600 hover:underline mb-6 inline-block break-all">{a.email}</a>
                                <div className="mt-2 p-4 md:p-6 bg-white border border-zinc-100 text-base text-zinc-700 italic leading-relaxed whitespace-pre-line shadow-sm">
                                    "{a.nachricht}"
                                </div>
                                <div className="grid md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-zinc-200">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Wer bearbeitet diese Anfrage?</label>
                                        <select 
                                            value={a.assignee || ''} 
                                            onChange={async (e) => await updateDoc(doc(db, 'anfragen', a.id), { assignee: e.target.value })}
                                            className="border border-zinc-300 p-2 text-xs outline-none bg-white uppercase tracking-widest font-bold cursor-pointer hover:border-black transition"
                                        >
                                            <option value="">-- Frei / Niemand zugewiesen --</option>
                                            {teamMemberNames.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Aktueller Status</label>
                                        <select 
                                            value={a.status || 'Neu / Offen'} 
                                            onChange={async (e) => await updateDoc(doc(db, 'anfragen', a.id), { status: e.target.value })}
                                            className={`border p-2 text-xs outline-none uppercase tracking-widest font-bold cursor-pointer transition
                                                ${(!a.status || a.status === 'Neu / Offen') ? 'border-amber-300 bg-amber-50 text-amber-700' : ''}
                                                ${a.status === 'In Bearbeitung' ? 'border-blue-300 bg-blue-50 text-blue-700' : ''}
                                                ${a.status === 'Geantwortet' ? 'border-purple-300 bg-purple-50 text-purple-700' : ''}
                                                ${a.status === 'Erfolgreich gebucht' ? 'border-green-300 bg-green-50 text-green-700' : ''}
                                                ${a.status === 'Absage' ? 'border-zinc-300 bg-zinc-200 text-zinc-600' : ''}
                                            `}
                                        >
                                            {ANFRAGEN_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {getFilteredAnfragen().length === 0 && <p className="text-base text-zinc-500 p-8 border border-dashed border-zinc-300 text-center">Keine Anfragen gefunden, die den Filtern entsprechen.</p>}
                    </div>
                </div>
            )}

            {/* TOUREN ADMIN */}
            {adminSubView === 'touren' && (
                <div className="fade-in max-w-6xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h3 className="serif text-3xl italic">Touren Verwalten</h3>
                        <button onClick={() => { setEditingTour({ title: '', visible: true, isExample: false, date: '', description: '', price: '', image: '', minPlaetze: 1, maxPlaetze: 4, leistungen: '', anforderungen: '', ablauf: '', material: '', stornoFrist: '', kategorie: tourKategorien[0] || 'Hochtour', technik: 2, ausdauer: 2 }); setPendingDeletes([]); }} className="bg-black text-white px-8 py-3 text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition shadow-md w-full md:w-auto text-center">+ Neue Tour erstellen</button>
                    </div>

                    {!editingTour && !exportingTour && (
                        <div className="flex flex-col gap-4 mb-8 bg-zinc-50 p-4 md:p-6 border border-zinc-200">
                            <div className="flex flex-wrap gap-4 border-b border-zinc-200 pb-4">
                                {['Öffentlich', 'Versteckt', 'Beispieltouren', 'Alle'].map(status => (
                                    <button 
                                        key={status} 
                                        onClick={() => setTourStatusFilter(status)}
                                        className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${tourStatusFilter === status ? 'bg-black text-white' : 'bg-white text-zinc-500 border border-zinc-200 hover:border-black hover:text-black'}`}
                                    >
                                        {status === 'Öffentlich' ? 'Öffentliche Touren' : status === 'Versteckt' ? 'Versteckte Entwürfe' : status}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-[10px] uppercase tracking-widest text-zinc-400 mr-2 font-bold w-full sm:w-auto">Kategorie:</span>
                                {['Alle', ...tourKategorien].map(kat => (
                                    <button 
                                        key={kat} 
                                        onClick={() => setTourKatFilter(kat)}
                                        className={`px-3 py-1.5 text-[9px] uppercase tracking-widest transition-colors border-b-2 ${tourKatFilter === kat ? 'border-black text-black font-bold' : 'border-transparent text-zinc-500 hover:text-black'}`}
                                    >
                                        {kat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {editingTour ? (
                        <form onSubmit={saveTour} className="space-y-8 bg-zinc-50 p-5 md:p-8 border border-zinc-200 shadow-sm fade-in">
                            <div className="flex justify-between items-center border-b border-zinc-200 pb-4 mb-6">
                                <h3 className="serif text-2xl italic">{editingTour.id ? 'Tour bearbeiten' : 'Neue Tour anlegen'}</h3>
                            </div>
                            
                            <div className="bg-white p-6 border border-zinc-300 shadow-sm md:col-span-2 mb-8">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4 block">Sichtbarkeit & Status der Tour</label>
                                <select 
                                    name="tour_status" 
                                    defaultValue={editingTour.isExample ? 'example' : (editingTour.visible === false ? 'hidden' : 'public')}
                                    className="w-full border-b border-zinc-300 p-3 text-base outline-none focus:border-black transition cursor-pointer bg-transparent font-medium"
                                >
                                    <option value="public">Öffentlich publizierte Tour (Sichtbar für alle)</option>
                                    <option value="hidden">Versteckter Entwurf (Nicht sichtbar)</option>
                                    <option value="example">Beispieltour / Ideenpool (Ohne Preis/Termin, dient als Inspiration)</option>
                                </select>
                                <p className="text-xs text-zinc-400 mt-3">Beispieltouren erscheinen in einer speziellen "Ideen-Ansicht" und bieten statt einer Buchung ein unverbindliches Anfrageformular an.</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Titel der Tour</label><input name="title" defaultValue={editingTour.title} required className="w-full border border-zinc-300 p-3 text-base mt-2 outline-none focus:border-black transition" /></div>
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Datum / Zeitraum <span className="font-normal normal-case">(optional bei Beispieltouren)</span></label><input name="date" defaultValue={editingTour.date} className="w-full border border-zinc-300 p-3 text-base mt-2 outline-none focus:border-black transition" /></div>
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Preis <span className="font-normal normal-case">(optional bei Beispieltouren)</span></label><input name="price" defaultValue={editingTour.price} className="w-full border border-zinc-300 p-3 text-base mt-2 outline-none focus:border-black transition" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Min. Teilnehmer</label><input name="minPlaetze" type="number" defaultValue={editingTour.minPlaetze || 1} required className="w-full border border-zinc-300 p-3 text-base mt-2 outline-none focus:border-black transition" /></div>
                                    <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Max. Teilnehmer</label><input name="maxPlaetze" type="number" defaultValue={editingTour.maxPlaetze} required className="w-full border border-zinc-300 p-3 text-base mt-2 outline-none focus:border-black transition" /></div>
                                </div>
                            </div>
                            
                            <div className="pt-6 border-t border-zinc-200 md:col-span-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Bilder der Tour (Erstes Bild = Titelbild)</label>
                                
                                <div className="flex flex-wrap gap-4 mb-4">
                                    {(editingTour.images || []).map((imgUrl, idx, arr) => (
                                        <div key={idx} className="relative w-32 h-32 bg-zinc-100 border border-zinc-200 shadow-sm group/img">
                                            <img src={imgUrl} alt="Tourbild" className="w-full h-full object-cover" />
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setPendingDeletes([...pendingDeletes, imgUrl]);
                                                    const newImages = [...arr];
                                                    newImages.splice(idx, 1);
                                                    setEditingTour({...editingTour, images: newImages});
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md opacity-100 md:opacity-0 group-hover/img:opacity-100 hover:scale-110 transition-all z-20"
                                                title="Bild entfernen"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                            <div className="absolute bottom-0 w-full flex justify-between bg-black/50 p-1 opacity-100 md:opacity-0 group-hover/img:opacity-100 transition-opacity z-10">
                                                {idx > 0 ? <button type="button" onClick={() => moveImage(arr, newArr => setEditingTour({...editingTour, images: newArr}), idx, -1)} className="p-1 hover:bg-white/20 rounded"><ChevronLeft size={16} className="text-white"/></button> : <div/>}
                                                {idx < arr.length - 1 ? <button type="button" onClick={() => moveImage(arr, newArr => setEditingTour({...editingTour, images: newArr}), idx, 1)} className="p-1 hover:bg-white/20 rounded"><ChevronRight size={16} className="text-white"/></button> : <div/>}
                                            </div>
                                            {idx === 0 && <div className="absolute bottom-8 inset-x-0 bg-black/70 text-white text-[8px] uppercase tracking-widest text-center py-1.5 backdrop-blur-sm pointer-events-none">Titelbild</div>}
                                        </div>
                                    ))}
                                    {(editingTour.images || []).length === 0 && <p className="text-xs text-zinc-400 italic py-4">Noch keine Bilder hinzugefügt.</p>}
                                </div>

                                <div className="flex-1 border-2 border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 hover:border-black transition cursor-pointer flex flex-col justify-center items-center relative min-h-[8rem] p-6 group">
                                    <UploadCloud size={28} className="text-zinc-400 mb-3 group-hover:text-black transition" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-600 group-hover:text-black transition">Weitere Bilder hinzufügen</span>
                                    <span className="text-[9px] text-zinc-500 mt-2 uppercase tracking-widest text-center leading-relaxed">Klicken oder Dateien hineinziehen<br/>(Mehrfachauswahl möglich - Bilder werden der Liste hinzugefügt)</span>
                                    <input type="file" name="tour_files" accept="image/*" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8 pt-6 border-t border-zinc-200">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Voraussichtliche Leitung (Guide)</label>
                                    <select name="guide" defaultValue={editingTour.guide || ''} className="w-full border border-zinc-300 p-3 text-sm mt-2 outline-none focus:border-black transition cursor-pointer bg-white">
                                        <option value="">-- Nicht festgelegt --</option>
                                        {teamMemberNames.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Materialliste (PDF) verknüpfen</label>
                                    <select name="material_list_id" defaultValue={editingTour.materialListId || ''} className="w-full border border-zinc-300 p-3 text-sm mt-2 outline-none focus:border-black transition cursor-pointer bg-white">
                                        <option value="">-- Keine Liste verknüpft --</option>
                                        {materialLists.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6 pt-6 border-t border-zinc-200">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Hauptkategorie</label>
                                    <select name="kategorie" defaultValue={getKat(editingTour, tourKategorien)} className="w-full border border-zinc-300 p-3 text-sm mt-2 outline-none focus:border-black transition cursor-pointer bg-white">
                                        {tourKategorien.length === 0 && <option value="Hochtour">Hochtour</option>}
                                        {tourKategorien.map(kat => <option key={kat} value={kat}>{kat}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Level Technik (1-3)</label>
                                    <select name="technik" defaultValue={getTech(editingTour)} className="w-full border border-zinc-300 p-3 text-sm mt-2 outline-none focus:border-black transition cursor-pointer bg-white">
                                        <option value="1">1 - Einfach / Basis</option>
                                        <option value="2">2 - Mittel / Fortgeschritten</option>
                                        <option value="3">3 - Schwer / Experte</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Level Ausdauer (1-3)</label>
                                    <select name="ausdauer" defaultValue={getAusd(editingTour)} className="w-full border border-zinc-300 p-3 text-sm mt-2 outline-none focus:border-black transition cursor-pointer bg-white">
                                        <option value="1">1 - Einfach / Basis</option>
                                        <option value="2">2 - Mittel / Fortgeschritten</option>
                                        <option value="3">3 - Schwer / Hohes Level</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Beschreibung (Haupttext)</label>
                                <textarea name="description" defaultValue={editingTour.description} required className="w-full border border-zinc-300 p-5 text-base h-48 resize-y mt-2 outline-none focus:border-black transition" />
                            </div>
                            <div className="pt-4 border-t border-zinc-200">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Programm & Ablauf</label>
                                <textarea name="ablauf" defaultValue={editingTour.ablauf} className="w-full border border-zinc-300 p-5 text-base h-48 resize-y mt-2 outline-none focus:border-black transition" />
                            </div>
                            <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-zinc-200">
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Leistungen</label><textarea name="leistungen" defaultValue={editingTour.leistungen} className="w-full border border-zinc-300 p-4 text-sm h-64 resize-y mt-2 outline-none focus:border-black transition" /></div>
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Anforderungen</label><textarea name="anforderungen" defaultValue={editingTour.anforderungen} className="w-full border border-zinc-300 p-4 text-sm h-64 resize-y mt-2 outline-none focus:border-black transition" /></div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Spezifisches Material (Ergänzend zum PDF)</label>
                                <textarea name="material" defaultValue={editingTour.material} className="w-full border border-zinc-300 p-4 text-sm h-24 resize-y mt-2 outline-none focus:border-black transition" />
                            </div>

                            <div className="pt-6 border-t border-zinc-200 md:col-span-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 mb-2"><Lock size={14}/> Interne Bemerkungen (Nur für Admin sichtbar)</label>
                                <textarea name="interneNotizen" defaultValue={editingTour.interneNotizen} placeholder="Z.B. Reservationsstatus, versteckte Infos, Bemerkungen für den Guide..." className="w-full border border-zinc-300 bg-[#fffdf0] p-4 text-sm h-24 resize-y outline-none focus:border-black transition" />
                                
                                <div className="mt-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">Kostenlose Stornierung bis (Deadline):</label>
                                    <div className="w-full sm:flex-1">
                                        <input type="date" name="stornoFrist" defaultValue={editingTour.stornoFrist || ''} className="w-full sm:w-auto border border-zinc-300 p-3 text-sm outline-none focus:border-black transition" />
                                        <p className="text-xs text-zinc-400 mt-2">Wenn diese Frist in weniger als 3 Tagen abläuft, erhältst du eine Warnung auf dem Dashboard.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 pt-8 border-t border-zinc-200">
                                <button type="button" onClick={() => { setEditingTour(null); setPendingDeletes([]); }} className="w-full sm:w-auto border border-zinc-300 px-10 py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition text-center">Abbrechen</button>
                                <button type="submit" disabled={isUploading} className="w-full sm:w-auto bg-black text-white px-12 py-4 text-[10px] font-bold uppercase tracking-widest shadow-xl hover:bg-zinc-800 transition text-center">{isUploading ? 'Lädt...' : 'Tour Speichern'}</button>
                            </div>
                        </form>
                    ) : exportingTour ? (
                        <div className="space-y-8 bg-white p-5 md:p-8 border border-zinc-200 shadow-sm fade-in max-w-2xl mx-auto mt-8">
                            <div className="flex justify-between items-center border-b border-zinc-100 pb-4">
                                <h3 className="serif text-2xl italic">Tour Exportieren</h3>
                                <button onClick={() => setExportingTour(null)} className="hover:text-red-500 transition p-2"><X size={20}/></button>
                            </div>
                            <div className="space-y-6">
                                <p className="text-sm text-zinc-600">Exportiere die Details der Tour <b>"{exportingTour.title}"</b>, um sie mit Kunden oder Teilnehmern zu teilen.</p>
            
                                <div className="bg-zinc-50 border border-zinc-200 p-4 max-h-64 overflow-y-auto text-xs whitespace-pre-line font-mono text-zinc-500">
                                    {generateTourText(exportingTour)}
                                </div>
            
                                <div className="flex flex-col gap-3 pt-4 border-t border-zinc-100">
                                    <button onClick={() => copyTourText(exportingTour)} className="w-full bg-black text-white py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition flex justify-center items-center gap-2">
                                        <Share2 size={16}/> Text Kopieren (Für WhatsApp / Mail)
                                    </button>
                                    <button onClick={() => generateTourPDF(exportingTour)} className="w-full border border-zinc-300 bg-white py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-50 transition flex justify-center items-center gap-2">
                                        <Download size={16}/> Als PDF Generieren
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 fade-in">
                            {(touren || []).filter(t => {
                                const isVisible = t.visible !== false;
                                const isExample = t.isExample === true;
                                
                                if (t.isDeleted) return false;
                                if (tourStatusFilter === 'Beispieltouren' && !isExample) return false;
                                if (tourStatusFilter === 'Öffentlich' && (!isVisible || isExample)) return false;
                                if (tourStatusFilter === 'Versteckt' && isVisible) return false;
                                if (tourKatFilter !== 'Alle' && getKat(t, tourKategorien) !== tourKatFilter) return false;
                                
                                return true;
                            }).map(t => (
                                <div key={t.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-5 md:p-6 border border-zinc-200 bg-white hover:border-black transition group">
                                    <div>
                                        <p className="text-sm font-bold uppercase tracking-widest mb-1 flex items-center flex-wrap gap-2">
                                            {t.title} 
                                            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 text-[8px] rounded-sm">{getKat(t, tourKategorien)}</span>
                                            {t.isExample === true && <span className="text-blue-500 bg-blue-50 px-2 py-0.5 text-[8px]">[BEISPIELTOUR]</span>}
                                            {t.visible === false && <span className="text-red-500 bg-red-50 px-2 py-0.5 text-[8px]">[VERSTECKT]</span>}
                                            {t.interneNotizen && <span className="text-amber-600 bg-amber-50 px-2 py-0.5 text-[8px] flex items-center gap-1"><Lock size={10}/> NOTIZ</span>}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                            {t.date || 'Kein Datum'} — Level T{getTech(t)}/A{getAusd(t)}
                                            {t.stornoFrist && <span className="ml-3 px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-sm">Storno bis: {new Date(t.stornoFrist).toLocaleDateString('de-CH')}</span>}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-4 sm:gap-6 items-center opacity-100 md:opacity-70 group-hover:opacity-100 transition pt-2 sm:pt-0 border-t sm:border-0 border-zinc-100">
                                        <button onClick={() => setExportingTour(t)} className="text-[10px] font-bold uppercase tracking-widest text-blue-500 hover:text-blue-700 flex items-center gap-2"><Share2 size={14}/> Export</button>
                                        <button onClick={() => { setEditingTour({...t, images: t.images || (t.image ? [t.image] : [])}); setPendingDeletes([]); }} className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-black flex items-center gap-2"><Edit size={14}/> Bearbeiten</button>
                                        <button onClick={() => softDelete('touren', t.id, t.title)} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600 flex items-center gap-2"><Trash2 size={14}/> Löschen</button>
                                    </div>
                                </div>
                            ))}
                            {(touren || []).filter(t => !t.isDeleted && (tourStatusFilter === 'Beispieltouren' ? t.isExample : (tourStatusFilter === 'Öffentlich' ? (t.visible !== false && !t.isExample) : (t.visible === false))) && (tourKatFilter === 'Alle' || getKat(t, tourKategorien) === tourKatFilter)).length === 0 && (
                                <div className="text-center p-12 border border-dashed border-zinc-200 text-zinc-400">
                                    <p className="text-sm italic">Keine Touren gefunden, die zu den aktuellen Filtern passen.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {adminSubView === 'anmeldungen' && (
                <div className="fade-in max-w-7xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <h3 className="serif text-3xl italic">Anmeldungen</h3>
                            <div className="bg-zinc-100 p-1 flex gap-1 rounded-sm ml-0 sm:ml-4">
                                <button onClick={() => setAnmeldungenView('active')} className={`px-4 py-1.5 text-[10px] uppercase tracking-widest font-bold transition-all ${anmeldungenView === 'active' ? 'bg-white shadow-sm text-black' : 'text-zinc-400 hover:text-black'}`}>Aktuell</button>
                                <button onClick={() => setAnmeldungenView('archived')} className={`px-4 py-1.5 text-[10px] uppercase tracking-widest font-bold transition-all flex items-center gap-1 ${anmeldungenView === 'archived' ? 'bg-white shadow-sm text-black' : 'text-zinc-400 hover:text-black'}`}><Archive size={12}/> Archiv</button>
                            </div>
                        </div>
                        <button onClick={() => exportToExcel(displayedAnmeldungen)} className="w-full md:w-auto justify-center px-6 py-3 bg-black text-white text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-800 transition"><Download size={14}/> Excel Export</button>
                    </div>
                    <div className="space-y-16">
                        {Object.entries(displayedAnmeldungen.reduce((acc, anm) => { const k = anm.tourTitle; if(!acc[k]) acc[k]=[]; acc[k].push(anm); return acc; }, {})).map(([title, teilnehmer]) => (
                            <div key={title} className="bg-white border border-zinc-200 shadow-sm w-full">
                                <div className="p-5 md:p-6 bg-zinc-50 border-b border-zinc-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <h4 className="text-base md:text-lg font-bold uppercase tracking-widest leading-relaxed">
                                        {title} <span className="text-zinc-400 font-normal ml-2 block md:inline mt-1 md:mt-0">({teilnehmer.length} {anmeldungenView === 'active' ? 'gebucht' : 'archiviert'})</span>
                                    </h4>
                                    {anmeldungenView === 'active' && (
                                        <button onClick={() => archiveTourBookings(title, teilnehmer)} className="text-[10px] uppercase tracking-widest bg-zinc-200 hover:bg-zinc-300 text-black px-4 py-2 font-bold transition flex items-center gap-2">
                                            <Archive size={12}/> Ins Archiv verschieben & Tour resetten
                                        </button>
                                    )}
                                </div>
                                <div className="w-full">
                                    <div className="hidden md:grid grid-cols-12 gap-4 bg-white border-b border-zinc-200 text-zinc-500 uppercase tracking-widest font-bold text-[10px] p-5">
                                        <div className="col-span-4">Name & Adresse</div>
                                        <div className="col-span-3">Kontakt</div>
                                        <div className="col-span-3">Infos & Ernährung</div>
                                        <div className="col-span-2 text-right">Aktion</div>
                                    </div>
                                    <div className="divide-y divide-zinc-100 bg-white">
                                        {teilnehmer.map(a => (
                                            <div key={a.id} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 p-5 hover:bg-zinc-50 transition">
                                                <div className="col-span-4">
                                                    <span className="font-bold text-sm uppercase tracking-widest block mb-1">{a.vorname} {a.name}</span>
                                                    <span className="text-zinc-500 text-xs leading-relaxed">{a.adresse}<br/>{a.plz_ort}</span>
                                                    {a.isArchived && a.archiveLabel && <span className="mt-2 text-[8px] bg-zinc-200 px-2 py-0.5 rounded-sm uppercase font-bold inline-block">Archiv: {a.archiveLabel}</span>}
                                                </div>
                                                <div className="col-span-3">
                                                    <a href={`mailto:${a.email}`} className="text-blue-600 hover:underline block mb-1 break-all text-xs">{a.email}</a>
                                                    <span className="text-zinc-600 text-xs">{a.phone}</span>
                                                </div>
                                                <div className="col-span-3">
                                                    {a.ernaehrung && <p className="text-orange-600 font-bold mb-1 text-[10px] uppercase tracking-widest">Essen: {a.ernaehrung}</p>}
                                                    {a.besonderes && <p className="text-zinc-600 italic text-xs leading-relaxed">"{a.besonderes}"</p>}
                                                    {!a.ernaehrung && !a.besonderes && <p className="text-zinc-400 text-xs italic hidden md:block">Keine Anmerkungen</p>}
                                                </div>
                                                <div className="col-span-2 flex items-center md:justify-end mt-3 md:mt-0 pt-4 md:pt-0 border-t md:border-transparent border-zinc-100">
                                                    <button onClick={() => deleteAnmeldung(a, title)} className="text-[10px] uppercase tracking-widest font-bold text-red-500 md:text-red-400 hover:text-red-600 transition border border-red-200 md:border-transparent px-4 py-2 md:p-0 rounded-sm md:rounded-none w-full md:w-auto bg-red-50 md:bg-transparent flex items-center justify-center gap-2">
                                                        <Trash2 size={12}/> {anmeldungenView === 'active' ? 'Stornieren' : 'Löschen'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {displayedAnmeldungen.length === 0 && <p className="text-center p-12 border border-dashed border-zinc-300 text-zinc-500 uppercase tracking-widest">Keine {anmeldungenView === 'active' ? 'aktuellen' : 'archivierten'} Anmeldungen vorhanden.</p>}
                    </div>
                </div>
            )}

            {adminSubView === 'aufgaben' && (
                <div className="fade-in flex flex-col h-full w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <h3 className="serif text-3xl italic">Team-Aufgaben</h3>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <button onClick={() => setShowTaskKategorienModal(true)} className="flex-1 md:flex-none justify-center border border-zinc-300 px-6 py-3 text-[10px] uppercase tracking-widest hover:bg-zinc-50 transition flex items-center gap-2"><Settings size={14}/> Kategorien</button>
                            <button onClick={() => setEditingTask({ title: '', status: 'Offen', category: taskKategorien[0] || 'Allgemein', assignee: '', dueDate: '' })} className="flex-1 md:flex-none justify-center bg-black text-white px-6 py-3 text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-800 transition"><Plus size={14}/> Neue Aufgabe</button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-8 border-b border-zinc-100 pb-4 w-full">
                        {['Alle', ...taskKategorien].map(c => <button key={c} onClick={() => setTaskFilter(c)} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition border-b-2 ${taskFilter === c ? 'border-black text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}>{c}</button>)}
                    </div>
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8 md:overflow-x-auto pb-6 items-stretch md:items-start w-full">
                        {KANBAN_COLUMNS.map(col => (
                            <div key={col} className="w-full md:w-80 flex-shrink-0 bg-zinc-50 border border-zinc-200 p-5 rounded-sm">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6 flex justify-between border-b border-zinc-200 pb-3">
                                    {col} <span className="bg-zinc-200 px-2 rounded-full text-black">{(tasks || []).filter(t => !t.isDeleted && t.status === col && (taskFilter === 'Alle' || t.category === taskFilter)).length}</span>
                                </h4>
                                <div className="space-y-4">
                                    {(tasks || []).filter(t => !t.isDeleted && t.status === col && (taskFilter === 'Alle' || t.category === taskFilter)).map(t => {
                                        const daysToDue = getDaysUntil(t.dueDate);
                                        const isUrgent = daysToDue !== null && daysToDue <= 3;
                                        const isOverdue = daysToDue !== null && daysToDue < 0;

                                        return (
                                        <div key={t.id} onClick={() => setEditingTask(t)} className="bg-white p-5 border border-zinc-200 cursor-pointer hover:border-black transition shadow-sm group">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="text-[8px] uppercase tracking-widest text-zinc-500 bg-zinc-100 px-2 py-1">{t.category}</span>
                                                {t.assignee && <span className="text-[8px] font-bold uppercase tracking-widest bg-blue-50 text-blue-700 px-2 py-1">{t.assignee}</span>}
                                            </div>
                                            <p className="text-base font-medium leading-relaxed mb-4">{t.title}</p>
                                            {t.description && <p className="text-xs text-zinc-400 line-clamp-2 italic mb-3">"{t.description}"</p>}
                                            
                                            {t.dueDate && (
                                                <div className={`text-[10px] flex items-center gap-1.5 font-bold mb-3 ${isOverdue ? 'text-red-500' : (isUrgent ? 'text-amber-500' : 'text-zinc-500')}`}>
                                                    <Clock size={12} /> Deadline: {new Date(t.dueDate).toLocaleDateString('de-CH')}
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center text-[10px] text-zinc-400 border-t border-zinc-100 pt-3">
                                                <span>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('de-CH') : ''}</span>
                                                {t.fileUrl && <LinkIcon size={14} className="text-black"/>}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {adminSubView === 'dokumente' && (
                <div className="fade-in max-w-7xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"><h3 className="serif text-3xl italic">Zentrale Dokumente</h3>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <button onClick={() => setShowDocKategorienModal(true)} className="flex-1 md:flex-none justify-center border border-zinc-300 p-3 px-6 text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 transition"><Settings size={14}/> Ordner</button>
                            <button onClick={() => { setEditingDoc({ name: '', category: docKategorien[0] || '', subcategory: '' }); setUploadFiles([]); }} className="flex-1 md:flex-none justify-center bg-black text-white p-3 px-6 text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-800 transition"><Plus size={14}/> Upload</button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 mb-8">
                        <div className="flex flex-wrap gap-2 pb-2 border-b border-zinc-100 items-center w-full">
                            <span className="text-[10px] uppercase tracking-widest text-zinc-400 mr-2 block w-full md:w-auto mb-2 md:mb-0">Hauptordner:</span>
                            {['Alle', ...docKategorien].map(c => <button key={c} onClick={() => { setDocFilter(c); setDocSubFilter('Alle'); }} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition border-b-2 ${docFilter === c ? 'border-black text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}>{c}</button>)}
                        </div>
                        {docFilter !== 'Alle' && (docSubkategorien[docFilter] && docSubkategorien[docFilter].length > 0) && (
                            <div className="flex flex-wrap gap-2 pb-2 border-b border-zinc-100 items-center w-full fade-in">
                                <span className="text-[10px] uppercase tracking-widest text-zinc-400 mr-2 block w-full md:w-auto mb-2 md:mb-0">Unterordner:</span>
                                {['Alle', ...docSubkategorien[docFilter]].map(c => <button key={c} onClick={() => setDocSubFilter(c)} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition border-b-2 ${docSubFilter === c ? 'border-black text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}>{c}</button>)}
                            </div>
                        )}
                    </div>
                    
                    <div className="bg-white border border-zinc-200 w-full">
                        <div className="hidden md:grid grid-cols-12 gap-4 bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-widest font-bold text-[10px] p-5">
                            <div className="col-span-6">Dateiname</div>
                            <div className="col-span-4">Ordner / Kategorie</div>
                            <div className="col-span-2 text-right">Aktionen</div>
                        </div>
                        <div className="divide-y divide-zinc-100">
                            {(docs || []).filter(d => !d.isDeleted && (docFilter === 'Alle' || d.category === docFilter) && (docSubFilter === 'Alle' || d.subcategory === docSubFilter || docFilter === 'Alle')).map(d => (
                                <div key={d.id} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 p-5 hover:bg-zinc-50 transition group">
                                    <div className="col-span-6 flex gap-4 items-start md:items-center">
                                        <div className="p-3 bg-zinc-100 text-zinc-400 rounded-sm hidden sm:block flex-shrink-0"><FileText size={20}/></div>
                                        <div className="min-w-0 flex-1">
                                            {d.url ? (
                                                <a href={d.url} target="_blank" rel="noreferrer" className="font-bold text-sm md:text-base block mb-1 truncate leading-tight hover:underline hover:text-blue-600 cursor-pointer">{d.name}</a>
                                            ) : (
                                                <span className="font-bold text-sm md:text-base block mb-1 truncate leading-tight">{d.name}</span>
                                            )}
                                            <span className="text-[10px] text-zinc-400 tracking-widest">{d.size}</span>
                                        </div>
                                    </div>
                                    <div className="col-span-4 text-xs font-bold uppercase tracking-widest text-zinc-500 flex flex-col justify-center">
                                        {d.category}
                                        {d.subcategory && <span className="block text-[9px] text-zinc-400 mt-1 font-normal normal-case tracking-normal">{d.subcategory}</span>}
                                    </div>
                                    <div className="col-span-2 flex justify-start md:justify-end gap-3 mt-3 md:mt-0 pt-4 md:pt-0 border-t md:border-transparent border-zinc-100 items-center opacity-100 md:opacity-50 group-hover:opacity-100 transition">
                                        <button onClick={() => setEditingDoc(d)} className="hover:text-black flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold bg-zinc-100 md:bg-transparent px-4 md:px-0 py-2 md:py-0 rounded-sm md:rounded-none flex-1 md:flex-none justify-center"><Edit size={14}/> Edit</button>
                                        <button onClick={() => softDelete('docs', d.id, d.name)} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600 transition flex items-center gap-2"><Trash2 size={14}/> Löschen</button>
                                    </div>
                                </div>
                            ))}
                            {(docs || []).filter(d => !d.isDeleted && (docFilter === 'Alle' || d.category === docFilter) && (docSubFilter === 'Alle' || d.subcategory === docSubFilter || docFilter === 'Alle')).length === 0 && <div className="p-12 text-center text-zinc-400 text-sm uppercase tracking-widest">Keine Dokumente in dieser Ansicht.</div>}
                        </div>
                    </div>
                </div>
            )}

            {adminSubView === 'protokolle' && (
                <div className="fade-in max-w-7xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <h3 className="serif text-3xl italic">Protokolle & Ideen</h3>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <button onClick={() => setShowProtocolKategorienModal(true)} className="flex-1 md:flex-none justify-center border border-zinc-300 p-3 px-6 text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 transition"><Settings size={14}/> Kategorien</button>
                            <button onClick={() => setEditingProtocol({ title: '', date: new Date().toISOString().split('T')[0], category: protocolKategorien[0] || 'Allgemein', decisions: [] })} className="flex-1 md:flex-none justify-center bg-black text-white px-6 py-3 text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-800 transition shadow-md"><Plus size={14}/> Neu</button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-8 border-b border-zinc-100 pb-4 w-full">
                        {['Alle', ...protocolKategorien].map(c => <button key={c} onClick={() => setProtocolFilter(c)} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition border-b-2 ${protocolFilter === c ? 'border-black text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}>{c}</button>)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {(protocols || []).filter(p => !p.isDeleted && (protocolFilter === 'Alle' || p.category === protocolFilter)).map(p => (
                            <div key={p.id} className="border border-zinc-200 p-6 md:p-8 hover:border-black transition bg-white flex flex-col justify-between group">
                                <div>
                                    <div className="flex justify-between items-start mb-6">
                                        <div><span className="text-[9px] uppercase tracking-widest font-bold bg-zinc-100 px-2 py-1 text-zinc-500">{p.category}</span><h4 className="font-bold text-xl mt-3">{p.title}</h4><span className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1 block">{new Date(p.date).toLocaleDateString('de-CH')}</span></div>
                                    </div>
                                    <p className="text-sm text-zinc-600 line-clamp-4 leading-relaxed mb-6">"{p.notes}"</p>
                                </div>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6 border-t border-zinc-100 opacity-100 md:opacity-60 group-hover:opacity-100 transition">
                                    <button onClick={() => setEditingProtocol(p)} className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold hover:text-black"><Edit size={14}/> Bearbeiten</button>
                                    <button onClick={() => softDelete('protocols', p.id, p.title)} className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold text-red-400 hover:text-red-600"><Trash2 size={14}/> Löschen</button>
                                </div>
                            </div>
                        ))}
                        {(protocols || []).filter(p => !p.isDeleted && (protocolFilter === 'Alle' || p.category === protocolFilter)).length === 0 && <div className="col-span-full text-center p-12 border border-dashed border-zinc-300 text-zinc-400 uppercase tracking-widest text-sm">Noch keine Einträge in dieser Kategorie.</div>}
                    </div>
                </div>
            )}

            {/* PAPIERKORB ADMIN */}
            {adminSubView === 'trash' && (
                <div className="fade-in max-w-6xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h3 className="serif text-3xl italic text-red-600 flex items-center gap-3"><RotateCcw size={28}/> Papierkorb</h3>
                    </div>
                    <p className="text-sm text-zinc-500 mb-8 max-w-3xl">Gelöschte Einträge können hier endgültig vernichtet werden (Löscht auch die verknüpften Bild/PDF-Dateien auf dem Server) oder wiederhergestellt werden.</p>

                    <div className="flex flex-wrap gap-2 mb-8 border-b border-zinc-100 pb-4 w-full">
                        {[
                            { id: 'touren', label: `Touren (${(touren || []).filter(t => t.isDeleted).length})` },
                            { id: 'angebote', label: `Angebote (${(angebote || []).filter(a => a.isDeleted).length})` },
                            { id: 'team_profiles', label: `Team (${(teamProfiles || []).filter(t => t.isDeleted).length})` },
                            { id: 'docs', label: `Dokumente (${(docs || []).filter(d => d.isDeleted).length})` },
                            { id: 'tasks', label: `Aufgaben (${(tasks || []).filter(t => t.isDeleted).length})` },
                            { id: 'protocols', label: `Protokolle (${(protocols || []).filter(p => p.isDeleted).length})` }
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setTrashTab(tab.id)} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition border-b-2 ${trashTab === tab.id ? 'border-red-500 text-red-600' : 'border-transparent text-zinc-400 hover:text-black'}`}>{tab.label}</button>
                        ))}
                    </div>

                    <div className="bg-white border border-zinc-200">
                        {/* Render based on selected Tab */}
                        {trashTab === 'touren' && (touren || []).filter(t => t.isDeleted).map(item => (
                            <div key={item.id} className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-zinc-100 gap-4">
                                <div><p className="font-bold text-sm uppercase tracking-widest">{item.title}</p><p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Gelöscht am: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : 'Unbekannt'}</p></div>
                                <div className="flex gap-4"><button onClick={() => restoreItem('touren', item.id, item.title)} className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-black">Wiederherstellen</button><button onClick={() => hardDelete('touren', item, item.title)} className="text-[10px] uppercase tracking-widest font-bold bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2">Endgültig Löschen</button></div>
                            </div>
                        ))}
                        {trashTab === 'angebote' && (angebote || []).filter(a => a.isDeleted).map(item => (
                            <div key={item.id} className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-zinc-100 gap-4">
                                <div><p className="font-bold text-sm uppercase tracking-widest">{item.title}</p><p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Gelöscht am: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : 'Unbekannt'}</p></div>
                                <div className="flex gap-4"><button onClick={() => restoreItem('angebote', item.id, item.title)} className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-black">Wiederherstellen</button><button onClick={() => hardDelete('angebote', item, item.title)} className="text-[10px] uppercase tracking-widest font-bold bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2">Endgültig Löschen</button></div>
                            </div>
                        ))}
                        {trashTab === 'team_profiles' && (teamProfiles || []).filter(t => t.isDeleted).map(item => (
                            <div key={item.id} className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-zinc-100 gap-4">
                                <div><p className="font-bold text-sm uppercase tracking-widest">{item.name}</p><p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Gelöscht am: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : 'Unbekannt'}</p></div>
                                <div className="flex gap-4"><button onClick={() => restoreItem('team_profiles', item.id, item.name)} className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-black">Wiederherstellen</button><button onClick={() => hardDelete('team_profiles', item, item.name)} className="text-[10px] uppercase tracking-widest font-bold bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2">Endgültig Löschen</button></div>
                            </div>
                        ))}
                        {trashTab === 'docs' && (docs || []).filter(d => d.isDeleted).map(item => (
                            <div key={item.id} className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-zinc-100 gap-4">
                                <div><p className="font-bold text-sm uppercase tracking-widest">{item.name}</p><p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Gelöscht am: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : 'Unbekannt'}</p></div>
                                <div className="flex gap-4"><button onClick={() => restoreItem('docs', item.id, item.name)} className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-black">Wiederherstellen</button><button onClick={() => hardDelete('docs', item, item.name)} className="text-[10px] uppercase tracking-widest font-bold bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2">Endgültig Löschen</button></div>
                            </div>
                        ))}
                        {trashTab === 'tasks' && (tasks || []).filter(t => t.isDeleted).map(item => (
                            <div key={item.id} className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-zinc-100 gap-4">
                                <div><p className="font-bold text-sm uppercase tracking-widest">{item.title}</p><p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Gelöscht am: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : 'Unbekannt'}</p></div>
                                <div className="flex gap-4"><button onClick={() => restoreItem('tasks', item.id, item.title)} className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-black">Wiederherstellen</button><button onClick={() => hardDelete('tasks', item, item.title)} className="text-[10px] uppercase tracking-widest font-bold bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2">Endgültig Löschen</button></div>
                            </div>
                        ))}
                        {trashTab === 'protocols' && (protocols || []).filter(p => p.isDeleted).map(item => (
                            <div key={item.id} className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-zinc-100 gap-4">
                                <div><p className="font-bold text-sm uppercase tracking-widest">{item.title}</p><p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Gelöscht am: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : 'Unbekannt'}</p></div>
                                <div className="flex gap-4"><button onClick={() => restoreItem('protocols', item.id, item.title)} className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-black">Wiederherstellen</button><button onClick={() => hardDelete('protocols', item, item.title)} className="text-[10px] uppercase tracking-widest font-bold bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2">Endgültig Löschen</button></div>
                            </div>
                        ))}

                        {/* Empty States */}
                        {((trashTab === 'touren' && (touren || []).filter(t => t.isDeleted).length === 0) ||
                          (trashTab === 'angebote' && (angebote || []).filter(a => a.isDeleted).length === 0) ||
                          (trashTab === 'team_profiles' && (teamProfiles || []).filter(t => t.isDeleted).length === 0) ||
                          (trashTab === 'docs' && (docs || []).filter(d => d.isDeleted).length === 0) ||
                          (trashTab === 'tasks' && (tasks || []).filter(t => t.isDeleted).length === 0) ||
                          (trashTab === 'protocols' && (protocols || []).filter(p => p.isDeleted).length === 0)) && (
                            <div className="p-12 text-center text-zinc-400 text-[10px] uppercase tracking-widest border border-dashed border-zinc-200">
                                Dieser Papierkorb ist leer.
                            </div>
                        )}
                    </div>
                </div>
            )}

          </div>
        </div>
      </div>

      {/* --- MODALS SETTINGS --- */}

      {showTeamAttributesModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
            <div className="bg-white p-5 md:p-10 w-full max-w-sm shadow-2xl">
                <div className="flex justify-between items-center mb-8 border-b border-zinc-100 pb-4"><h3 className="serif text-2xl italic">Steckbrief-Felder</h3><button onClick={() => setShowTeamAttributesModal(false)} className="hover:text-red-500 transition p-2"><X/></button></div>
                <div className="space-y-3 mb-8 max-h-[50vh] overflow-y-auto">
                    {activeTeamAttributes.map((k, i) => (
                        <div key={i} className="flex justify-between items-center p-4 bg-zinc-50 border border-zinc-200 text-xs font-bold uppercase tracking-widest">
                            {k}
                            <button onClick={() => setDoc(doc(db, 'settings', 'team_attributes'), { labels: activeTeamAttributes.filter(item => item !== k) }, { merge: true })} className="text-zinc-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
                <form onSubmit={e => { e.preventDefault(); const v=e.target.k.value.trim(); if(v && !activeTeamAttributes.includes(v)) { setDoc(doc(db, 'settings', 'team_attributes'), { labels: [...activeTeamAttributes, v] }, { merge: true }); e.target.k.value=''; } }} className="flex gap-2">
                    <input name="k" placeholder="Neues Feld..." className="flex-1 border border-zinc-300 p-3 text-sm outline-none focus:border-black transition w-full"/>
                    <button className="bg-black text-white px-4 md:px-6 text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition">Erstellen</button>
                </form>
            </div>
        </div>
      )}
      
      {showDocKategorienModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
            <div className="bg-white p-5 md:p-10 w-full max-w-sm shadow-2xl">
                <div className="flex justify-between items-center mb-8 border-b border-zinc-100 pb-4"><h3 className="serif text-2xl italic">Dokument Ordner</h3><button onClick={() => setShowDocKategorienModal(false)} className="hover:text-red-500 transition p-2"><X/></button></div>
                
                <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4">Hauptordner Verwalten</h4>
                <div className="space-y-3 mb-4 max-h-[30vh] overflow-y-auto">
                    {docKategorien.map((k, i) => (
                        <div key={i} className="flex justify-between items-center p-4 bg-zinc-50 border border-zinc-200 text-xs font-bold uppercase tracking-widest">
                            {k}
                            <button onClick={() => setDoc(doc(db, 'settings', 'dokumente'), { kategorien: docKategorien.filter(item => item !== k) }, { merge: true })} className="text-zinc-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
                <form onSubmit={e => { e.preventDefault(); const v=e.target.k.value.trim(); if(v && !docKategorien.includes(v)) { setDoc(doc(db, 'settings', 'dokumente'), { kategorien: [...docKategorien, v] }, { merge: true }); e.target.k.value=''; } }} className="flex gap-2">
                    <input name="k" placeholder="Neuer Ordnername..." className="flex-1 border border-zinc-300 p-3 text-sm outline-none focus:border-black transition w-full"/>
                    <button className="bg-black text-white px-4 md:px-6 text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition">Erstellen</button>
                </form>

                <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4 mt-10 border-t border-zinc-100 pt-6">Unterordner Verwalten</h4>
                <div className="space-y-6 mb-4 max-h-[40vh] overflow-y-auto pr-2">
                    {docKategorien.map(mainCat => (
                        <div key={mainCat} className="border border-zinc-200 p-4 bg-zinc-50">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">{mainCat}</p>
                            <div className="space-y-2 mb-3">
                                {(docSubkategorien[mainCat] || []).map((sub, i) => (
                                    <div key={i} className="flex justify-between items-center p-2 bg-white border border-zinc-100 text-xs font-bold uppercase tracking-widest">
                                        {sub}
                                        <button onClick={() => {
                                            const newSubs = { ...docSubkategorien };
                                            newSubs[mainCat] = newSubs[mainCat].filter(item => item !== sub);
                                            setDoc(doc(db, 'settings', 'dokumente'), { subkategorien: newSubs }, { merge: true });
                                        }} className="text-zinc-300 hover:text-red-500 transition"><Trash2 size={14}/></button>
                                    </div>
                                ))}
                                {(!docSubkategorien[mainCat] || docSubkategorien[mainCat].length === 0) && <p className="text-[9px] text-zinc-400 italic uppercase">Keine Unterordner</p>}
                            </div>
                            <form onSubmit={e => { 
                                e.preventDefault(); 
                                const v = e.target.sub_k.value.trim(); 
                                if(v) { 
                                    const newSubs = { ...docSubkategorien };
                                    if (!newSubs[mainCat]) newSubs[mainCat] = [];
                                    if (!newSubs[mainCat].includes(v)) {
                                        newSubs[mainCat].push(v);
                                        setDoc(doc(db, 'settings', 'dokumente'), { subkategorien: newSubs }, { merge: true }); 
                                    }
                                    e.target.sub_k.value=''; 
                                } 
                            }} className="flex gap-2">
                                <input name="sub_k" placeholder="Neuer Unterordner..." className="flex-1 border border-zinc-300 p-2 text-xs outline-none focus:border-black transition w-full"/>
                                <button className="bg-black text-white px-3 md:px-4 text-[9px] uppercase tracking-widest hover:bg-zinc-800 transition">Hinzufügen</button>
                            </form>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {showTaskKategorienModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
            <div className="bg-white p-5 md:p-10 w-full max-w-sm shadow-2xl">
                <div className="flex justify-between items-center mb-8 border-b border-zinc-100 pb-4"><h3 className="serif text-2xl italic">Aufgaben Labels</h3><button onClick={() => setShowTaskKategorienModal(false)} className="hover:text-red-500 transition p-2"><X/></button></div>
                <div className="space-y-3 mb-8 max-h-[50vh] overflow-y-auto">
                    {taskKategorien.map((k, i) => (
                        <div key={i} className="flex justify-between items-center p-4 bg-zinc-50 border border-zinc-200 text-xs font-bold uppercase tracking-widest">
                            {k}
                            <button onClick={() => setDoc(doc(db, 'settings', 'aufgaben'), { kategorien: taskKategorien.filter(item => item !== k) }, { merge: true })} className="text-zinc-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
                <form onSubmit={e => { e.preventDefault(); const v=e.target.k.value.trim(); if(v && !taskKategorien.includes(v)) { setDoc(doc(db, 'settings', 'aufgaben'), { kategorien: [...taskKategorien, v] }, { merge: true }); e.target.k.value=''; } }} className="flex gap-2">
                    <input name="k" placeholder="Neues Label..." className="flex-1 border border-zinc-300 p-3 text-sm outline-none focus:border-black transition w-full"/>
                    <button className="bg-black text-white px-4 md:px-6 text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition">Erstellen</button>
                </form>
            </div>
        </div>
      )}

      {showProtocolKategorienModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
            <div className="bg-white p-5 md:p-10 w-full max-w-sm shadow-2xl">
                <div className="flex justify-between items-center mb-8 border-b border-zinc-100 pb-4"><h3 className="serif text-2xl italic">Protokoll Kategorien</h3><button onClick={() => setShowProtocolKategorienModal(false)} className="hover:text-red-500 transition p-2"><X/></button></div>
                <div className="space-y-3 mb-8 max-h-[50vh] overflow-y-auto">
                    {protocolKategorien.map((k, i) => (
                        <div key={i} className="flex justify-between items-center p-4 bg-zinc-50 border border-zinc-200 text-xs font-bold uppercase tracking-widest">
                            {k}
                            <button onClick={() => setDoc(doc(db, 'settings', 'protokolle'), { kategorien: protocolKategorien.filter(item => item !== k) }, { merge: true })} className="text-zinc-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
                <form onSubmit={e => { e.preventDefault(); const v=e.target.k.value.trim(); if(v && !protocolKategorien.includes(v)) { setDoc(doc(db, 'settings', 'protokolle'), { kategorien: [...protocolKategorien, v] }, { merge: true }); e.target.k.value=''; } }} className="flex gap-2">
                    <input name="k" placeholder="Neue Kategorie..." className="flex-1 border border-zinc-300 p-3 text-sm outline-none focus:border-black transition w-full"/>
                    <button className="bg-black text-white px-4 md:px-6 text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition">Erstellen</button>
                </form>
            </div>
        </div>
      )}

      {/* --- BEARBEITUNGS MODALS --- */}
      {editingTask && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
            <div className="bg-white p-5 md:p-10 w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl">
                <div className="flex justify-between items-center mb-8 border-b border-zinc-200 pb-6">
                    <h3 className="serif text-2xl md:text-3xl italic">{editingTask.id ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h3>
                    <button onClick={() => setEditingTask(null)} className="text-zinc-400 hover:text-black transition-colors bg-zinc-100 p-2 rounded-full"><X size={20}/></button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); saveTask(editingTask, e.target.file.files[0]); }} className="space-y-8">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Titel der Aufgabe</label>
                        <input required value={editingTask.title} onChange={e => setEditingTask({...editingTask, title: e.target.value})} placeholder="Kurzer, prägnanter Titel" className="w-full border-b-2 border-zinc-200 p-3 outline-none mt-2 text-lg md:text-xl focus:border-black transition" />
                    </div>
                    
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Beschreibung & Details</label>
                        <textarea value={editingTask.description || ''} onChange={e => setEditingTask({...editingTask, description: e.target.value})} placeholder="Was genau muss gemacht werden?" rows="6" className="w-full border border-zinc-300 p-4 md:p-5 text-base mt-3 resize-y bg-zinc-50 focus:bg-white transition-colors outline-none focus:border-black" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 pt-6 border-t border-zinc-100">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</label>
                            <select value={editingTask.status} onChange={e => setEditingTask({...editingTask, status: e.target.value})} className="w-full border border-zinc-300 p-4 text-xs uppercase tracking-widest mt-3 bg-white outline-none focus:border-black transition cursor-pointer">{KANBAN_COLUMNS.map(c => <option key={c}>{c}</option>)}</select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Label / Kategorie</label>
                            <select value={editingTask.category} onChange={e => setEditingTask({...editingTask, category: e.target.value})} className="w-full border border-zinc-300 p-4 text-xs uppercase tracking-widest mt-3 bg-white outline-none focus:border-black transition cursor-pointer">
                                {taskKategorien.length === 0 && <option value="">- Leer -</option>}
                                {taskKategorien.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Zuständig</label>
                            <select value={editingTask.assignee || ''} onChange={e => setEditingTask({...editingTask, assignee: e.target.value})} className="w-full border border-zinc-300 p-4 text-xs uppercase tracking-widest mt-3 bg-white outline-none focus:border-black transition cursor-pointer"><option value="">-- Frei --</option>{teamMemberNames.map(a => <option key={a}>{a}</option>)}</select>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-zinc-100">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Fälligkeitsdatum / Deadline (Optional)</label>
                        <input type="date" value={editingTask.dueDate || ''} onChange={e => setEditingTask({...editingTask, dueDate: e.target.value})} className="border border-zinc-300 p-3 text-sm outline-none focus:border-black transition w-full sm:w-auto" />
                        <p className="text-xs text-zinc-400 mt-2">Wenn dieses Datum in weniger als 3 Tagen erreicht ist, erscheint eine Warnung auf dem Dashboard.</p>
                    </div>
                    
                    <div className="pt-6 border-t border-zinc-100">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Dateianhang</label>
                        <div className="mt-3 border border-zinc-300 p-4 md:p-6 bg-zinc-50 flex flex-col md:flex-row items-center justify-between gap-4">
                            <input type="file" name="file" className="text-sm cursor-pointer w-full md:w-auto" />
                            {editingTask.fileUrl && <a href={editingTask.fileUrl} target="_blank" rel="noreferrer" className="w-full md:w-auto text-[10px] uppercase font-bold text-blue-600 hover:text-blue-800 hover:underline flex justify-center items-center gap-2 bg-white px-4 py-2 border border-zinc-200"><ExternalLink size={14}/> Bisherige Datei öffnen</a>}
                        </div>
                    </div>

                    <div className="flex flex-col-reverse md:flex-row justify-between items-center pt-8 border-t border-zinc-200 gap-4">
                        {editingTask.id ? <button type="button" onClick={() => { softDelete('tasks', editingTask.id, editingTask.title); setEditingTask(null); }} className="w-full md:w-auto justify-center text-red-500 font-bold text-[10px] uppercase tracking-widest hover:text-red-700 hover:bg-red-50 px-4 py-3 transition flex items-center gap-2"><Trash2 size={16}/> Aufgabe löschen</button> : <div/>} 
                        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                            <button type="button" onClick={() => setEditingTask(null)} className="w-full md:w-auto border border-zinc-300 px-8 py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition text-center">Abbrechen</button>
                            <button type="submit" disabled={isUploading} className="w-full md:w-auto bg-black text-white px-10 py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition shadow-xl text-center">{isUploading ? 'Speichert...' : 'Aufgabe speichern'}</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
}