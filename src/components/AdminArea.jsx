import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { 
  Search, Mail, Download, Settings, Plus, Kanban, Folder, BookOpen, 
  LayoutDashboard, User, Users, X, Edit, ExternalLink, Trash2, MapPin, 
  FileText, Share2, Link as LinkIcon, UploadCloud, Lock
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const KANBAN_COLUMNS = ['Offen', 'In Bearbeitung', 'Blockiert', 'Erledigt'];

const getKat = (t) => {
    if (!t) return 'Hochtour';
    if (t.kategorie) return t.kategorie;
    const title = (t.title || '').toLowerCase();
    return title.includes('kurs') ? 'Kurse' : title.includes('ski') ? 'Skitour' : title.includes('klett') ? 'Klettern' : 'Hochtour';
};
const getTech = (t) => t && t.technik ? Number(t.technik) : 2;
const getAusd = (t) => t && t.ausdauer ? Number(t.ausdauer) : 2;

export default function AdminArea({ user, touren, onLogout }) {
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
  
  // Dynamische Settings
  const [docKategorien, setDocKategorien] = useState(['Rechnungen', 'Konzepte', 'Sponsoring', 'Bilder']);
  const [docSubkategorien, setDocSubkategorien] = useState({});
  const [taskKategorien, setTaskKategorien] = useState(['Allgemein', 'Tourenplanung', 'Ausrüstung', 'Marketing', 'Finanzen']);
  const [protocolKategorien, setProtocolKategorien] = useState(['Teamsitzung', 'Tourenplanung', 'Ideen']);
  const [teamAttributes, setTeamAttributes] = useState([]); 

  // Aktive Attribute definieren (Fallback falls DB leer ist)
  const activeTeamAttributes = teamAttributes.length > 0 ? teamAttributes : ['Superkraft', 'Kryptonit', 'Touren-Snack', 'Lebensmotto'];

  // UI States
  const [selectedKunde, setSelectedKunde] = useState(null);
  const [isEditingKunde, setIsEditingKunde] = useState(false);
  const [kundenSearch, setKundenSearch] = useState('');
  const [notizInput, setNotizInput] = useState('');
  
  const [editingTour, setEditingTour] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editingProtocol, setEditingProtocol] = useState(null);
  const [editingTeamMember, setEditingTeamMember] = useState(null);
  
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

  const [isUploading, setIsUploading] = useState(false);
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
      onSnapshot(collection(db, 'logs'), snap => {
          const fetchedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          fetchedLogs.sort((a, b) => b.timestamp - a.timestamp); 
          setLogs(fetchedLogs);
      }),
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

  const teamMemberNames = [...new Set([...teamProfiles.map(t => t.name), 'Allgemein'])];

  const logAction = async (actionText) => {
    if (!user) return;
    try {
        await addDoc(collection(db, 'logs'), {
            user: user.email,
            action: actionText,
            timestamp: Date.now()
        });
    } catch (e) { console.error("Fehler beim Speichern des Logs", e); }
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

  const exportToExcel = (anmeldungen) => {
    const headers = ["Tour", "Vorname", "Name", "Email", "Telefon", "Adresse", "PLZ/Ort", "Ernaehrung", "Bemerkung", "Status", "Zuständig"];
    const rows = anmeldungen.map(a => [ a.tourTitle, a.vorname, a.name, a.email, `'${a.phone}`, a.adresse, a.plz_ort, a.ernaehrung, (a.besonderes || "").replace(/\n/g, " "), a.status || 'Neu', a.zustaendig || 'Unzugewiesen' ]);
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

  // --- SAVE TEAM MEMBER ---
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
                const storageRef = ref(storage, `team/${safeNameFolder}/${Date.now()}-${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                return await getDownloadURL(snapshot.ref);
            });
            imageUrls = await Promise.all(uploadPromises);
        }
        
        const combinedImages = [...(editingTeamMember.images || []), ...imageUrls];

        const data = {
            name: name,
            title: fd.get('title'),
            desc: fd.get('desc'),
            customFields: customFields,
            visible: editingTeamMember.visible !== false,
            image: combinedImages[0] || '', 
            images: combinedImages
        };

        if (editingTeamMember && editingTeamMember.id) {
            await updateDoc(doc(db, 'team_profiles', editingTeamMember.id), data);
            logAction(`Teammitglied aktualisiert: ${data.name}`);
        } else {
            await addDoc(collection(db, 'team_profiles'), data);
            logAction(`Neues Teammitglied erstellt: ${data.name}`);
        }
        setEditingTeamMember(null);
    } catch (err) { alert("Fehler beim Speichern."); } 
    finally { setIsUploading(false); }
  };

  const deleteTeamMember = async (id, name) => {
      if (!confirm(`Teammitglied "${name}" wirklich löschen?`)) return;
      try {
          await deleteDoc(doc(db, 'team_profiles', id));
          logAction(`Teammitglied gelöscht: ${name}`);
      } catch (e) { alert("Fehler beim Löschen."); }
  };

  // --- SAVE MATERIAL LIST ---
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

  const deleteMaterialList = async (id, name) => {
      if (!confirm(`Materialliste "${name}" wirklich löschen?`)) return;
      try {
          await deleteDoc(doc(db, 'material_lists', id));
          logAction(`Materialliste gelöscht: ${name}`);
      } catch (e) { alert("Fehler beim Löschen."); }
  };

  // --- SAVE TOUR ---
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
                const storageRef = ref(storage, `touren/${safeTitleFolder}/${Date.now()}-${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                return await getDownloadURL(snapshot.ref);
            });
            imageUrls = await Promise.all(uploadPromises);
        }
        
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
            kategorie: fd.get('kategorie') || 'Hochtour',
            technik: parseInt(fd.get('technik')) || 2,
            ausdauer: parseInt(fd.get('ausdauer')) || 2,
            
            image: combinedImages[0] || '/hochtour.jpg', 
            images: combinedImages, 
            maxPlaetze: parseInt(fd.get('maxPlaetze')) || 4,
            angemeldet: (editingTour && editingTour.id && !isMock) ? editingTour.angemeldet : 0
        };

        if (editingTour && editingTour.id && !isMock) {
            await updateDoc(doc(db, 'touren', editingTour.id), data);
            logAction(`Tour aktualisiert: ${data.title}`);
        } else {
            await addDoc(collection(db, 'touren'), data);
            logAction(`Neue Tour/Idee erstellt: ${data.title}`);
        }
        setEditingTour(null);
    } catch (err) { alert("Fehler beim Speichern der Tour."); } 
    finally { setIsUploading(false); }
  };

  const deleteTour = async (id, title) => {
      if (id.startsWith('mock-')) return alert("Mock-Daten können nicht gelöscht werden.");
      if (!confirm("Tour wirklich löschen? Alle dazugehörigen Anmeldungen werden ebenfalls unwiderruflich gelöscht!")) return;
      try {
          const zuLoeschendeAnmeldungen = anmeldungen.filter(anm => anm.tourId === id);
          await Promise.all(zuLoeschendeAnmeldungen.map(anm => deleteDoc(doc(db, 'anmeldungen', anm.id))));
          await deleteDoc(doc(db, 'touren', id));
          logAction(`Tour gelöscht: ${title || 'Unbekannt'}`);
          alert(`Tour gelöscht.`);
      } catch (e) { alert("Fehler beim Löschen."); }
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
    const data = { ...taskData, fileUrl, fileName };
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
                await addDoc(collection(db, 'docs'), { name, category, subcategory, isLink: true, url: fd.get('url'), size: 'Web-Link', createdAt: Date.now() });
                logAction(`Link hinzugefügt: ${name}`);
            } else {
                for (const file of uploadFiles) {
                    const fileRef = ref(storage, `docs/${Date.now()}_${file.name}`);
                    await uploadBytes(fileRef, file);
                    const url = await getDownloadURL(fileRef);
                    const size = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
                    const docName = uploadFiles.length > 1 ? file.name : (name || file.name);
                    await addDoc(collection(db, 'docs'), { name: docName, category, subcategory, isLink: false, url, size, createdAt: Date.now() });
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
    const data = { ...protocolData, fileUrl, fileName };
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
              {[ { id: 'dashboard', label: 'Übersicht', icon: LayoutDashboard }, { id: 'touren', label: 'Touren verwalten', icon: Settings }, { id: 'anmeldungen', label: 'Anmeldungen', icon: Share2 }, { id: 'anfragen', label: 'Anfragen', icon: Mail }, { id: 'kunden', label: 'Kundenstamm (CRM)', icon: User } ].map(item => (
                <button key={item.id} onClick={() => { setAdminSubView(item.id); setSelectedKunde(null); setIsEditingKunde(false); }} className={`w-full text-left py-2 px-4 text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ${adminSubView === item.id ? 'bg-black text-white' : 'hover:bg-zinc-100'}`}>
                  <item.icon size={14}/> {item.label}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2 px-4">Internes Team</p>
              <button onClick={() => setAdminSubView('team')} className={`w-full flex items-center gap-3 py-2 px-4 text-[10px] uppercase tracking-widest transition-all ${adminSubView === 'team' ? 'bg-zinc-200 text-black font-bold' : 'hover:bg-zinc-100'}`}><Users size={14}/> Team / Bergführer</button>
              <button onClick={() => setAdminSubView('material')} className={`w-full flex items-center gap-3 py-2 px-4 text-[10px] uppercase tracking-widest transition-all ${adminSubView === 'material' ? 'bg-zinc-200 text-black font-bold' : 'hover:bg-zinc-100'}`}><FileText size={14}/> Ausrüstung & Material</button>
              <button onClick={() => setAdminSubView('aufgaben')} className={`w-full flex items-center gap-3 py-2 px-4 text-[10px] uppercase tracking-widest transition-all ${adminSubView === 'aufgaben' ? 'bg-zinc-200 text-black font-bold' : 'hover:bg-zinc-100'}`}><Kanban size={14}/> Aufgaben</button>
              <button onClick={() => setAdminSubView('dokumente')} className={`w-full flex items-center gap-3 py-2 px-4 text-[10px] uppercase tracking-widest transition-all ${adminSubView === 'dokumente' ? 'bg-zinc-200 text-black font-bold' : 'hover:bg-zinc-100'}`}><Folder size={14}/> Dokumente</button>
              <button onClick={() => setAdminSubView('protokolle')} className={`w-full flex items-center gap-3 py-2 px-4 text-[10px] uppercase tracking-widest transition-all ${adminSubView === 'protokolle' ? 'bg-zinc-200 text-black font-bold' : 'hover:bg-zinc-100'}`}><BookOpen size={14}/> Protokolle & Ideen</button>
            </div>
          </aside>

          {/* Main Area */}
          <div className="flex-1 bg-white p-6 md:p-10 shadow-sm border border-zinc-100 min-h-[60vh] min-w-0 flex flex-col">
            
            {adminSubView === 'dashboard' && (
              <div className="fade-in space-y-12 max-w-7xl mx-auto w-full">
                <h3 className="serif text-3xl italic">Willkommen zurück</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="p-6 bg-zinc-50 border border-zinc-100"><p className="text-[8px] uppercase tracking-widest text-zinc-400 mb-2">Offene Aufgaben</p><p className="serif text-3xl italic">{tasks.filter(t => t.status !== 'Erledigt').length}</p></div>
                  <div className="p-6 bg-zinc-50 border border-zinc-100"><p className="text-[8px] uppercase tracking-widest text-zinc-400 mb-2">Neue Anfragen</p><p className="serif text-3xl italic">{anfragen.filter(a => !a.status || a.status === 'Neu').length}</p></div>
                  <div className="p-6 bg-zinc-50 border border-zinc-100"><p className="text-[8px] uppercase tracking-widest text-zinc-400 mb-2">Total Anmeldungen</p><p className="serif text-3xl italic">{anmeldungen.length}</p></div>
                  <div className="p-6 bg-zinc-50 border border-zinc-100"><p className="text-[8px] uppercase tracking-widest text-zinc-400 mb-2">Kontakte im CRM</p><p className="serif text-3xl italic">{kundenStamm.length}</p></div>
                </div>

                <div className="grid lg:grid-cols-2 gap-12 pt-8">
                    <div>
                        <h3 className="serif text-2xl italic mb-6">Letzte Anmeldungen</h3>
                        <div className="space-y-3">
                            {anmeldungen.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).slice(0, 8).map(anm => (
                                <div key={anm.id} className="p-4 bg-zinc-50 border border-zinc-100">
                                    <div className="flex justify-between items-start">
                                        <p className="font-bold text-sm uppercase tracking-widest">{anm.vorname} {anm.name}</p>
                                        <span className="text-[9px] text-zinc-400 bg-white px-2 py-1 border border-zinc-200">{anm.tourTitle}</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-2">Am {anm.timestamp ? new Date(anm.timestamp.seconds * 1000).toLocaleDateString('de-CH') : 'Kürzlich'}</p>
                                </div>
                            ))}
                            {anmeldungen.length === 0 && <p className="text-sm text-zinc-400 italic">Noch keine Buchungen eingegangen.</p>}
                        </div>
                    </div>

                    <div>
                        <h3 className="serif text-2xl italic mb-6">System Journal <span className="text-[10px] font-normal uppercase tracking-widest text-zinc-400 ml-2">(Wer macht was)</span></h3>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                            {logs.slice(0, 30).map(log => (
                                <div key={log.id} className="p-4 bg-zinc-50 border border-zinc-100 flex flex-col gap-2">
                                    <p className="text-sm font-bold">{log.action}</p>
                                    <div className="flex justify-between items-center text-[9px] uppercase tracking-widest text-zinc-400">
                                        <span className="flex items-center gap-1"><User size={10} className="mb-0.5"/> {log.user}</span>
                                        <span>{new Date(log.timestamp).toLocaleString('de-CH')}</span>
                                    </div>
                                </div>
                            ))}
                            {logs.length === 0 && <p className="text-sm text-zinc-400 italic">Noch keine System-Ereignisse protokolliert.</p>}
                        </div>
                    </div>
                </div>
              </div>
            )}

            {/* TEAM PROFILES ADMIN */}
            {adminSubView === 'team' && (
                <div className="fade-in max-w-6xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h3 className="serif text-3xl italic">Internes Team & Bergführer</h3>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <button onClick={() => setShowTeamAttributesModal(true)} className="flex-1 md:flex-none justify-center border border-zinc-300 p-3 px-6 text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 transition"><Settings size={14}/> Steckbrief-Felder anpassen</button>
                            <button onClick={() => setEditingTeamMember({ name: '', title: 'BERGFÜHRER IVBV', desc: '', visible: true })} className="flex-1 md:flex-none justify-center bg-black text-white p-3 px-6 text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-800 transition shadow-md"><Plus size={14}/> Neues Profil</button>
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
                                    {(editingTeamMember.images || (editingTeamMember.image ? [editingTeamMember.image] : [])).map((imgUrl, idx) => (
                                        <div key={idx} className="relative w-32 h-32 bg-zinc-100 border border-zinc-200 shadow-sm group/img">
                                            <img src={imgUrl} alt="Profilbild" className="w-full h-full object-cover" />
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const newImages = [...(editingTeamMember.images || (editingTeamMember.image ? [editingTeamMember.image] : []))];
                                                    newImages.splice(idx, 1);
                                                    setEditingTeamMember({...editingTeamMember, images: newImages});
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md opacity-100 md:opacity-0 group-hover/img:opacity-100 hover:scale-110 transition-all z-10"
                                                title="Bild entfernen"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                        </div>
                                    ))}
                                    {(editingTeamMember.images || (editingTeamMember.image ? [editingTeamMember.image] : [])).length === 0 && <p className="text-xs text-zinc-400 italic py-4">Noch keine Bilder hinzugefügt.</p>}
                                </div>

                                <div className="flex-1 border-2 border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 hover:border-black transition cursor-pointer flex flex-col justify-center items-center relative min-h-[8rem] p-6 group">
                                    <UploadCloud size={28} className="text-zinc-400 mb-3 group-hover:text-black transition" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-600 group-hover:text-black transition">Weitere Bilder hinzufügen</span>
                                    <span className="text-[9px] text-zinc-500 mt-2 uppercase tracking-widest text-center leading-relaxed">Klicken oder Dateien hineinziehen<br/>(Mehrfachauswahl möglich)</span>
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
                                <button type="button" onClick={() => setEditingTeamMember(null)} className="w-full sm:w-auto border border-zinc-300 px-10 py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition text-center">Abbrechen</button>
                                <button type="submit" disabled={isUploading} className="w-full sm:w-auto bg-black text-white px-12 py-4 text-[10px] font-bold uppercase tracking-widest shadow-xl hover:bg-zinc-800 transition text-center">{isUploading ? 'Lädt...' : 'Profil Speichern'}</button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4 fade-in">
                            <p className="text-sm text-zinc-500 mb-8">Verwalte hier die Personen in eurem Team. Sichtbare Profile erscheinen im "Kollektiv" auf der Webseite. Alle Namen stehen zudem in den Dropdowns für "Zuständig" bei Aufgaben und Anfragen zur Verfügung.</p>
                            
                            {teamProfiles.map(member => (
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
                                        <button onClick={() => setEditingTeamMember({...member, images: member.images || (member.image ? [member.image] : [])})} className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-black flex items-center gap-2"><Edit size={14}/> Bearbeiten</button>
                                        <button onClick={() => deleteTeamMember(member.id, member.name)} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600 flex items-center gap-2"><Trash2 size={14}/> Löschen</button>
                                    </div>
                                </div>
                            ))}
                            {teamProfiles.length === 0 && <p className="text-center p-12 text-sm text-zinc-400 uppercase tracking-widest border border-dashed border-zinc-300">Noch keine Teammitglieder in der Datenbank.</p>}
                        </div>
                    )}
                </div>
            )}

            {/* NEU: MATERIAL MANAGER ADMIN */}
            {adminSubView === 'material' && (
                <div className="fade-in max-w-6xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <h3 className="serif text-3xl italic">Ausrüstung & Materiallisten</h3>
                    </div>
                    <p className="text-sm text-zinc-500 mb-8 max-w-3xl">Lade hier verschiedene Ausrüstungs-PDFs (z.B. "Packliste Skitour", "Packliste Klettern") hoch. Diese kannst du anschliessend bei der Touren-Erstellung direkt verlinken.</p>

                    <div className="grid md:grid-cols-12 gap-8">
                        <div className="md:col-span-5 lg:col-span-4">
                            <form onSubmit={saveMaterialList} className="bg-zinc-50 border border-zinc-200 p-6 shadow-sm space-y-6">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest border-b border-zinc-200 pb-3">Neue Liste hochladen</h4>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Name der Liste</label>
                                    <input name="name" required placeholder="z.B. Packliste Hochtouren Sommer" className="w-full border border-zinc-300 p-3 text-sm mt-2 outline-none focus:border-black transition" />
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
                                {materialLists.map(list => (
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
                                            <button onClick={() => deleteMaterialList(list.id, list.name)} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600 transition flex items-center gap-2"><Trash2 size={14}/> Löschen</button>
                                        </div>
                                    </div>
                                ))}
                                {materialLists.length === 0 && <p className="text-center p-12 text-sm text-zinc-400 uppercase tracking-widest border border-dashed border-zinc-300">Noch keine Materiallisten vorhanden.</p>}
                            </div>
                        </div>
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
                                            <span>{k.touren.length} Touren</span><span className={k.newsletter ? "text-green-600" : "text-zinc-300"}><Mail className="w-3 h-3"/></span>
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
                                                    <button onClick={() => setIsEditingKunde(!isEditingKunde)} className={`p-2 rounded-full self-start transition ${isEditingKunde ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                                                        {isEditingKunde ? <X size={16}/> : <Edit size={16}/>}
                                                    </button>
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
                                                                    <p className="font-bold text-base mt-1">{anm.tourTitle}</p>
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

            {adminSubView === 'anfragen' && (
                <div className="fade-in max-w-5xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <h3 className="serif text-3xl italic">Anfragen über die Website</h3>
                    </div>
                    <div className="space-y-6">
                        {anfragen.map(a => (
                            <div key={a.id} className="p-5 md:p-8 border border-zinc-200 bg-zinc-50 relative group hover:border-black transition">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                                    <span className="text-[10px] uppercase tracking-widest font-bold bg-black text-white px-4 py-1.5 self-start">{a.thema || 'Allgemein'}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-zinc-400">{a.timestamp ? new Date(a.timestamp.seconds * 1000).toLocaleDateString('de-CH') : ''}</span>
                                        <button onClick={() => { if(confirm('Anfrage endgültig löschen?')) { deleteDoc(doc(db,'anfragen',a.id)); logAction(`Anfrage gelöscht (${a.vorname} ${a.name})`); } }} className="text-red-300 hover:text-red-500 opacity-100 md:opacity-0 group-hover:opacity-100 transition"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                                <p className="font-bold text-xl mt-4 break-words">{a.vorname} {a.name}</p>
                                <a href={`mailto:${a.email}`} className="text-sm text-blue-600 hover:underline mb-6 inline-block break-all">{a.email}</a>
                                <div className="mt-2 p-4 md:p-6 bg-white border border-zinc-100 text-base text-zinc-700 italic leading-relaxed whitespace-pre-line shadow-sm">
                                    "{a.nachricht}"
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-6 pt-6 border-t border-zinc-200">
                                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Wer bearbeitet diese Anfrage?</label>
                                    <select 
                                        value={a.assignee || ''} 
                                        onChange={async (e) => await updateDoc(doc(db, 'anfragen', a.id), { assignee: e.target.value })}
                                        className="border border-zinc-300 p-2 text-xs outline-none bg-white uppercase tracking-widest font-bold cursor-pointer hover:border-black transition w-full sm:w-auto"
                                    >
                                        <option value="">-- Frei / Niemand zugewiesen --</option>
                                        {teamMemberNames.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                        ))}
                        {anfragen.length === 0 && <p className="text-base text-zinc-500 p-8 border border-dashed border-zinc-300 text-center">Aktuell gibt es keine offenen Anfragen.</p>}
                    </div>
                </div>
            )}

            {adminSubView === 'touren' && (
                <div className="fade-in max-w-6xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h3 className="serif text-3xl italic">Touren Verwalten</h3>
                        <button onClick={() => setEditingTour({ title: '', visible: true, isExample: false, date: '', description: '', price: '', image: '', maxPlaetze: 4, leistungen: '', anforderungen: '', ablauf: '', material: '', kategorie: 'Hochtour', technik: 2, ausdauer: 2 })} className="bg-black text-white px-8 py-3 text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition shadow-md w-full md:w-auto text-center">+ Neue Tour erstellen</button>
                    </div>

                    {!editingTour && (
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
                                {['Alle', 'Hochtour', 'Skitour', 'Klettern', 'Kurse'].map(kat => (
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
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Max. Teilnehmer</label><input name="maxPlaetze" type="number" defaultValue={editingTour.maxPlaetze} required className="w-full border border-zinc-300 p-3 text-base mt-2 outline-none focus:border-black transition" /></div>
                            </div>
                            
                            <div className="pt-6 border-t border-zinc-200 md:col-span-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Bilder der Tour (Erstes Bild = Titelbild)</label>
                                
                                <div className="flex flex-wrap gap-4 mb-4">
                                    {(editingTour.images || []).map((imgUrl, idx) => (
                                        <div key={idx} className="relative w-32 h-32 bg-zinc-100 border border-zinc-200 shadow-sm group/img">
                                            <img src={imgUrl} alt="Tourbild" className="w-full h-full object-cover" />
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const newImages = [...editingTour.images];
                                                    newImages.splice(idx, 1);
                                                    setEditingTour({...editingTour, images: newImages});
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md opacity-100 md:opacity-0 group-hover/img:opacity-100 hover:scale-110 transition-all z-10"
                                                title="Bild entfernen"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                            {idx === 0 && <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[8px] uppercase tracking-widest text-center py-1.5 backdrop-blur-sm">Titelbild</div>}
                                        </div>
                                    ))}
                                    {(editingTour.images || []).length === 0 && <p className="text-xs text-zinc-400 italic py-4">Noch keine Bilder hinzugefügt.</p>}
                                </div>

                                <div className="flex-1 border-2 border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 hover:border-black transition cursor-pointer flex flex-col justify-center items-center relative min-h-[8rem] p-6 group">
                                    <UploadCloud size={28} className="text-zinc-400 mb-3 group-hover:text-black transition" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-600 group-hover:text-black transition">Weitere Bilder hinzufügen</span>
                                    <span className="text-[9px] text-zinc-500 mt-2 uppercase tracking-widest text-center leading-relaxed">Klicken oder Dateien hineinziehen<br/>(Mehrfachauswahl möglich)</span>
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
                                    <select name="kategorie" defaultValue={getKat(editingTour)} className="w-full border border-zinc-300 p-3 text-sm mt-2 outline-none focus:border-black transition cursor-pointer bg-white">
                                        <option value="Hochtour">Hochtour</option>
                                        <option value="Skitour">Skitour</option>
                                        <option value="Klettern">Klettern</option>
                                        <option value="Kurse">Kurse</option>
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
                            <div className="grid md:grid-cols-3 gap-8 pt-4 border-t border-zinc-200">
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Leistungen</label><textarea name="leistungen" defaultValue={editingTour.leistungen} className="w-full border border-zinc-300 p-4 text-sm h-64 resize-y mt-2 outline-none focus:border-black transition" /></div>
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Anforderungen</label><textarea name="anforderungen" defaultValue={editingTour.anforderungen} className="w-full border border-zinc-300 p-4 text-sm h-64 resize-y mt-2 outline-none focus:border-black transition" /></div>
                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Programm & Ablauf</label><textarea name="ablauf" defaultValue={editingTour.ablauf} className="w-full border border-zinc-300 p-4 text-sm h-64 resize-y mt-2 outline-none focus:border-black transition" /></div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Spezifisches Material (Ergänzend zum PDF)</label>
                                <textarea name="material" defaultValue={editingTour.material} className="w-full border border-zinc-300 p-4 text-sm h-24 resize-y mt-2 outline-none focus:border-black transition" />
                            </div>

                            <div className="pt-6 border-t border-zinc-200 md:col-span-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 mb-2"><Lock size={14}/> Interne Bemerkungen (Nur für Admin sichtbar)</label>
                                <textarea name="interneNotizen" defaultValue={editingTour.interneNotizen} placeholder="Z.B. Reservationsstatus, versteckte Infos, Bemerkungen für den Guide..." className="w-full border border-zinc-300 bg-[#fffdf0] p-4 text-sm h-24 resize-y outline-none focus:border-black transition" />
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 pt-8 border-t border-zinc-200">
                                <button type="button" onClick={() => setEditingTour(null)} className="w-full sm:w-auto border border-zinc-300 px-10 py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition text-center">Abbrechen</button>
                                <button type="submit" disabled={isUploading} className="w-full sm:w-auto bg-black text-white px-12 py-4 text-[10px] font-bold uppercase tracking-widest shadow-xl hover:bg-zinc-800 transition text-center">{isUploading ? 'Lädt...' : 'Tour Speichern'}</button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4 fade-in">
                            {touren.filter(t => {
                                const isVisible = t.visible !== false;
                                const isExample = t.isExample === true;
                                
                                if (tourStatusFilter === 'Beispieltouren' && !isExample) return false;
                                if (tourStatusFilter === 'Öffentlich' && (!isVisible || isExample)) return false;
                                if (tourStatusFilter === 'Versteckt' && isVisible) return false;
                                if (tourKatFilter !== 'Alle' && getKat(t) !== tourKatFilter) return false;
                                
                                return true;
                            }).map(t => (
                                <div key={t.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-5 md:p-6 border border-zinc-200 bg-white hover:border-black transition group">
                                    <div>
                                        <p className="text-sm font-bold uppercase tracking-widest mb-1 flex items-center flex-wrap gap-2">
                                            {t.title} 
                                            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 text-[8px] rounded-sm">{getKat(t)}</span>
                                            {t.isExample === true && <span className="text-blue-500 bg-blue-50 px-2 py-0.5 text-[8px]">[BEISPIELTOUR]</span>}
                                            {t.visible === false && <span className="text-red-500 bg-red-50 px-2 py-0.5 text-[8px]">[VERSTECKT]</span>}
                                            {t.interneNotizen && <span className="text-amber-600 bg-amber-50 px-2 py-0.5 text-[8px] flex items-center gap-1"><Lock size={10}/> NOTIZ</span>}
                                        </p>
                                        <p className="text-xs text-zinc-500">{t.date || 'Kein Datum'} — Level T{getTech(t)}/A{getAusd(t)}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-4 sm:gap-6 items-center opacity-100 md:opacity-70 group-hover:opacity-100 transition pt-2 sm:pt-0 border-t sm:border-0 border-zinc-100">
                                        <button onClick={() => setEditingTour({...t, images: t.images || (t.image ? [t.image] : [])})} className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-black flex items-center gap-2"><Edit size={14}/> Bearbeiten</button>
                                        <button onClick={() => deleteTour(t.id, t.title)} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600 flex items-center gap-2"><Trash2 size={14}/> Löschen</button>
                                    </div>
                                </div>
                            ))}
                            {touren.filter(t => {
                                const isVisible = t.visible !== false;
                                const isExample = t.isExample === true;
                                if (tourStatusFilter === 'Beispieltouren' && !isExample) return false;
                                if (tourStatusFilter === 'Öffentlich' && (!isVisible || isExample)) return false;
                                if (tourStatusFilter === 'Versteckt' && isVisible) return false;
                                if (tourKatFilter !== 'Alle' && getKat(t) !== tourKatFilter) return false;
                                return true;
                            }).length === 0 && (
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
                        <h3 className="serif text-3xl italic">Anmeldungen pro Tour</h3>
                        <button onClick={() => exportToExcel(anmeldungen)} className="w-full md:w-auto justify-center px-6 py-3 bg-black text-white text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-800 transition"><Download size={14}/> Excel Export</button>
                    </div>
                    <div className="space-y-16">
                        {Object.entries(anmeldungen.reduce((acc, anm) => { const k = anm.tourTitle; if(!acc[k]) acc[k]=[]; acc[k].push(anm); return acc; }, {})).map(([title, teilnehmer]) => (
                            <div key={title} className="bg-white border border-zinc-200 shadow-sm w-full">
                                <div className="p-5 md:p-6 bg-white border-b border-zinc-200">
                                    <h4 className="text-base md:text-lg font-bold uppercase tracking-widest leading-relaxed">
                                        {title} <span className="text-zinc-400 font-normal ml-2 block md:inline mt-1 md:mt-0">({teilnehmer.length} gebucht)</span>
                                    </h4>
                                </div>
                                <div className="w-full">
                                    <div className="hidden md:grid grid-cols-12 gap-4 bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-widest font-bold text-[10px] p-5">
                                        <div className="col-span-4">Name & Adresse</div>
                                        <div className="col-span-3">Kontakt</div>
                                        <div className="col-span-3">Infos & Ernährung</div>
                                        <div className="col-span-2 text-right">Aktion</div>
                                    </div>
                                    <div className="divide-y divide-zinc-100">
                                        {teilnehmer.map(a => (
                                            <div key={a.id} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 p-5 hover:bg-zinc-50 transition">
                                                <div className="col-span-4">
                                                    <span className="font-bold text-sm uppercase tracking-widest block mb-1">{a.vorname} {a.name}</span>
                                                    <span className="text-zinc-500 text-xs leading-relaxed">{a.adresse}<br/>{a.plz_ort}</span>
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
                                                    <button onClick={() => { if(confirm('Buchung wirklich löschen?')) { deleteDoc(doc(db,'anmeldungen',a.id)); logAction(`Anmeldung storniert: ${a.vorname} ${a.name} für ${title}`); } }} className="text-[10px] uppercase tracking-widest font-bold text-red-500 md:text-red-400 hover:text-red-600 transition border border-red-200 md:border-transparent px-4 py-2 md:p-0 rounded-sm md:rounded-none w-full md:w-auto bg-red-50 md:bg-transparent">
                                                        Stornieren
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {anmeldungen.length === 0 && <p className="text-center p-12 border border-dashed border-zinc-300 text-zinc-500 uppercase tracking-widest">Noch keine Anmeldungen vorhanden.</p>}
                    </div>
                </div>
            )}

            {adminSubView === 'aufgaben' && (
                <div className="fade-in flex flex-col h-full w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <h3 className="serif text-3xl italic">Team-Aufgaben</h3>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <button onClick={() => setShowTaskKategorienModal(true)} className="flex-1 md:flex-none justify-center border border-zinc-300 px-6 py-3 text-[10px] uppercase tracking-widest hover:bg-zinc-50 transition flex items-center gap-2"><Settings size={14}/> Kategorien</button>
                            <button onClick={() => setEditingTask({ title: '', status: 'Offen', category: taskKategorien[0] || 'Allgemein', assignee: '' })} className="flex-1 md:flex-none justify-center bg-black text-white px-6 py-3 text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-800 transition"><Plus size={14}/> Neue Aufgabe</button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-8 border-b border-zinc-100 pb-4 w-full">
                        {['Alle', ...taskKategorien].map(c => <button key={c} onClick={() => setTaskFilter(c)} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition border-b-2 ${taskFilter === c ? 'border-black text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}>{c}</button>)}
                    </div>
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8 md:overflow-x-auto pb-6 items-stretch md:items-start w-full">
                        {KANBAN_COLUMNS.map(col => (
                            <div key={col} className="w-full md:w-80 flex-shrink-0 bg-zinc-50 border border-zinc-200 p-5 rounded-sm">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6 flex justify-between border-b border-zinc-200 pb-3">
                                    {col} <span className="bg-zinc-200 px-2 rounded-full text-black">{tasks.filter(t => t.status === col && (taskFilter === 'Alle' || t.category === taskFilter)).length}</span>
                                </h4>
                                <div className="space-y-4">
                                    {tasks.filter(t => t.status === col && (taskFilter === 'Alle' || t.category === taskFilter)).map(t => (
                                        <div key={t.id} onClick={() => setEditingTask(t)} className="bg-white p-5 border border-zinc-200 cursor-pointer hover:border-black transition shadow-sm group">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="text-[8px] uppercase tracking-widest text-zinc-500 bg-zinc-100 px-2 py-1">{t.category}</span>
                                                {t.assignee && <span className="text-[8px] font-bold uppercase tracking-widest bg-blue-50 text-blue-700 px-2 py-1">{t.assignee}</span>}
                                            </div>
                                            <p className="text-base font-medium leading-relaxed mb-4">{t.title}</p>
                                            {t.description && <p className="text-xs text-zinc-400 line-clamp-2 italic mb-3">"{t.description}"</p>}
                                            <div className="flex justify-between items-center text-[10px] text-zinc-400 border-t border-zinc-100 pt-3">
                                                <span>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('de-CH') : ''}</span>
                                                {t.fileUrl && <LinkIcon size={14} className="text-black"/>}
                                            </div>
                                        </div>
                                    ))}
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
                            {docs.filter(d => (docFilter === 'Alle' || d.category === docFilter) && (docSubFilter === 'Alle' || d.subcategory === docSubFilter || docFilter === 'Alle')).map(d => (
                                <div key={d.id} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 p-5 hover:bg-zinc-50 transition group">
                                    <div className="col-span-6 flex gap-4 items-start md:items-center">
                                        <div className="p-3 bg-zinc-100 text-zinc-400 rounded-sm hidden sm:block flex-shrink-0"><FileText size={20}/></div>
                                        <div className="min-w-0 flex-1">
                                            <span className="font-bold text-sm md:text-base block mb-1 truncate leading-tight">{d.name}</span>
                                            <span className="text-[10px] text-zinc-400 tracking-widest">{d.size}</span>
                                        </div>
                                    </div>
                                    <div className="col-span-4 text-xs font-bold uppercase tracking-widest text-zinc-500 flex flex-col justify-center">
                                        {d.category}
                                        {d.subcategory && <span className="block text-[9px] text-zinc-400 mt-1 font-normal normal-case tracking-normal">{d.subcategory}</span>}
                                    </div>
                                    <div className="col-span-2 flex justify-start md:justify-end gap-3 mt-3 md:mt-0 pt-4 md:pt-0 border-t md:border-transparent border-zinc-100 items-center opacity-100 md:opacity-50 group-hover:opacity-100 transition">
                                        <button onClick={() => setEditingDoc(d)} className="hover:text-black flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold bg-zinc-100 md:bg-transparent px-4 md:px-0 py-2 md:py-0 rounded-sm md:rounded-none flex-1 md:flex-none justify-center"><Edit size={14}/> Edit</button>
                                        {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="hover:text-black flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold bg-zinc-100 md:bg-transparent px-4 md:px-0 py-2 md:py-0 rounded-sm md:rounded-none flex-1 md:flex-none justify-center"><ExternalLink size={14}/> Öffnen</a>}
                                    </div>
                                </div>
                            ))}
                            {docs.length === 0 && <div className="p-12 text-center text-zinc-400 text-sm uppercase tracking-widest">Keine Dokumente in dieser Ansicht.</div>}
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
                        {protocols.filter(p => protocolFilter === 'Alle' || p.category === protocolFilter).map(p => (
                            <div key={p.id} className="border border-zinc-200 p-6 md:p-8 hover:border-black transition bg-white flex flex-col justify-between group">
                                <div>
                                    <div className="flex justify-between items-start mb-6">
                                        <div><span className="text-[9px] uppercase tracking-widest font-bold bg-zinc-100 px-2 py-1 text-zinc-500">{p.category}</span><h4 className="font-bold text-xl mt-3">{p.title}</h4><span className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1 block">{new Date(p.date).toLocaleDateString('de-CH')}</span></div>
                                    </div>
                                    <p className="text-sm text-zinc-600 line-clamp-4 leading-relaxed mb-6">"{p.notes}"</p>
                                </div>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6 border-t border-zinc-100 opacity-100 md:opacity-60 group-hover:opacity-100 transition">
                                    <button onClick={() => generateAndSharePDF(p)} className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold hover:text-black"><Download size={14}/> PDF Export</button>
                                    <button onClick={() => setEditingProtocol(p)} className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold hover:text-black"><Edit size={14}/> Bearbeiten</button>
                                </div>
                            </div>
                        ))}
                        {protocols.filter(p => protocolFilter === 'Alle' || p.category === protocolFilter).length === 0 && <div className="col-span-full text-center p-12 border border-dashed border-zinc-300 text-zinc-400 uppercase tracking-widest text-sm">Noch keine Einträge in dieser Kategorie.</div>}
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

    </div>
  );
}