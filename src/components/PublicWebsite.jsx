import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, doc, increment, serverTimestamp, onSnapshot, setDoc } from "firebase/firestore";
import { FileText, Tag, Filter, Search, Info, Hand, X, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

// ==========================================
// FIREBASE KONFIGURATION
// ==========================================
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

const loadEmailJS = () => new Promise((resolve, reject) => {
    if (window.emailjs) return resolve(window.emailjs);
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js";
    script.onload = () => {
        window.emailjs.init("tr07IrpBTKjp_Isq6");
        resolve(window.emailjs);
    };
    script.onerror = reject;
    document.head.appendChild(script);
});

// Instagram Icon als SVG
const Instagram = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
);

const DEFAULT_ANGEBOTE = [
    { id: "mock-s1", title: "Hochtouren", season: "Sommer", desc: "Von einfachen Gletschertrekkings bis zu den grossen 4000ern.", longDesc: "Erlebe die Welt der Gletscher und Viertausender. Ob Einsteiger-Tour oder technischer Gipfel – wir führen dich sicher auf die höchsten Punkte der Alpen.", image: "/hochtour.jpg" },
    { id: "mock-s2", title: "Alpinklettern", season: "Sommer", desc: "In den besten Granit- und Kalkwänden der Schweiz.", longDesc: "Mehrseillängen-Träume in bestem Fels. Von der Furka bis ins Bergell – wir finden die perfekte Linie für dein Level.", image: "/alpinklettern.jpg" },
    { id: "mock-s3", title: "Kletterkurse", season: "Sommer", desc: "Vom ersten Griff in der Halle bis zum Vorstieg im Fels.", longDesc: "Sicherheit steht an erster Stelle. Wir vermitteln dir das nötige Know-how in Seiltechnik, Standplatzbau und Vorstiegstaktik.", image: "/kletterkurs.jpg" },
    { id: "mock-s4", title: "Gratüberschreitungen", season: "Sommer", desc: "Luftige Grate und endlose Aussichten.", longDesc: "Die eleganteste Art, einen Gipfel zu besteigen. Klassiker wie der Eiger- oder Biancograt warten auf dich.", image: "/grat.jpg" },
    { id: "mock-w1", title: "Skitouren", season: "Winter", desc: "Unberührter Pulverschnee und einsame Gipfelerlebnisse.", longDesc: "Vom Berner Oberland bis ins Wallis – wir finden für dich den besten Powder und unverspurte Hänge fernab der Massen.", image: "/skitour.jpg" },
    { id: "mock-w2", title: "Eisklettern", season: "Winter", desc: "Die faszinierende Welt der gefrorenen Wasserfälle.", longDesc: "Steile Eiszapfen und blaues Eis. Wir zeigen dir die richtige Schlagtechnik und den Standplatzbau.", image: "/eisklettern.jpg" },
    { id: "mock-w3", title: "Freeriden", season: "Winter", desc: "Die besten Lines in den Alpen mit Fokus auf Sicherheit.", longDesc: "Maximale Abfahrt bei minimalem Aufstieg. Wir nutzen die Bergbahnen und zeigen dir die versteckten Runs.", image: "/freeride.jpg" },
    { id: "mock-w4", title: "Lawinenkurse", season: "Winter", desc: "Fundiertes Wissen für deine Sicherheit im Backcountry.", longDesc: "Prävention, Beobachtung und Rettung. Ein essenzieller Kurs für alle, die sich im Winter abseits der Pisten bewegen.", image: "/lawine.jpg" }
];

const getKat = (t, defaultCats) => {
    if (!t) return defaultCats[0] || 'Hochtour';
    if (t.kategorie) return t.kategorie;
    return defaultCats[0] || 'Hochtour';
};
const getTech = (t) => t.technik ? Number(t.technik) : 2;
const getAusd = (t) => t.ausdauer ? Number(t.ausdauer) : 2;

const techDetails = {
    1: "Wenig bis mässig steiles Gelände. Tritte und Griffe sind gut vorhanden. Basiskenntnisse genügen.",
    2: "Steileres Gelände, teilweise ausgesetzt. Sicheres Steigen und grundlegende Seiltechnik erforderlich.",
    3: "Sehr steiles, anspruchsvolles Gelände. Sehr gute Klettertechnik, absolute Trittsicherheit und Schwindelfreiheit obligatorisch."
};
const ausdDetails = {
    1: "Kurze Etappen (3-5 Stunden). Gemütliches Tempo, wenig Höhenmeter (bis ca. 800m).",
    2: "Mittlere Etappen (5-7 Stunden). Moderates Tempo, mittlere Höhenmeter (ca. 800-1200m).",
    3: "Lange, anstrengende Etappen (ab 7 Stunden). Hohes Tempo, viele Höhenmeter (über 1200m)."
};

const DifficultyDots = ({ label, level, info }) => (
    <div className="flex items-center gap-2 relative group/tooltip" title={info}>
        <span className="text-[9px] uppercase tracking-widest text-zinc-500 w-16">{label}</span>
        <div className="flex gap-1.5">
            {[1, 2, 3].map(i => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= level ? 'bg-black' : 'bg-zinc-200'}`}></div>
            ))}
        </div>
        {info && <Info size={10} className="text-zinc-300 group-hover/tooltip:text-black transition-colors" />}
    </div>
);

const Accordion = ({ title, content, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    if (!content && !children) return null;
    return (
        <div className="border-b border-zinc-100 py-4">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center group focus:outline-none">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-400 group-hover:text-black transition-colors">{title}</h3>
                <span className="text-xl font-light text-zinc-400 group-hover:text-black transition-colors">{isOpen ? '−' : '+'}</span>
            </button>
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[5000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                {children ? children : <p className="text-zinc-600 leading-relaxed font-light text-sm whitespace-pre-line pb-4">{content}</p>}
            </div>
        </div>
    );
};

export default function PublicWebsite({ touren = [], onGoToAdmin }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    
    // UI und Filter States
    const [selectedAngebot, setSelectedAngebot] = useState(null);
    const [selectedTour, setSelectedTour] = useState(null);
    const [selectedTeamMember, setSelectedTeamMember] = useState(null);
    const [isBookingMode, setIsBookingMode] = useState(false);
    const [isInquiryMode, setIsInquiryMode] = useState(false);
    const [isLightboxOpen, setIsLightboxOpen] = useState(null);
    const [bookingStatus, setBookingStatus] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [teamProfiles, setTeamProfiles] = useState([]);
    const [teamAttributes, setTeamAttributes] = useState([]);
    const [angebote, setAngebote] = useState([]);
    
    // Settings
    const [websiteSettings, setWebsiteSettings] = useState({ heroVideos: [], categoryOrder: [], tabOrder: ['Sommer', 'Winter', 'Spontantouren'] });
    const [angebotTab, setAngebotTab] = useState('Sommer');

    const [isAllToursModalOpen, setIsAllToursModalOpen] = useState(false);
    const [isIdeenBoardOpen, setIsIdeenBoardOpen] = useState(false);
    const [filterKategorie, setFilterKategorie] = useState('Alle');
    const [filterTechnik, setFilterTechnik] = useState('Alle');
    const [filterAusdauer, setFilterAusdauer] = useState('Alle');
    const [showLevelInfo, setShowLevelInfo] = useState(false);

    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [hasScrolledGallery, setHasScrolledGallery] = useState(false);
    const [activeHeroVideo, setActiveHeroVideo] = useState('/hero-video.mp4');

    useEffect(() => {
        if (websiteSettings.heroVideos && websiteSettings.heroVideos.length > 0) {
            const randomVideo = websiteSettings.heroVideos[Math.floor(Math.random() * websiteSettings.heroVideos.length)];
            setActiveHeroVideo(randomVideo);
        } else {
            setActiveHeroVideo('/hero-video.mp4');
        }
    }, [websiteSettings.heroVideos]);

    const visibleTours = touren.filter(t => t.visible !== false && t.isExample !== true && !t.isDeleted);
    const exampleTours = touren.filter(t => t.isExample === true && !t.isDeleted);
    const recentTours = visibleTours.slice(0, 3);

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

    const RUBRIKEN = websiteSettings.tabOrder || ['Sommer', 'Winter', 'Spontantouren'];
    const renderedAngebote = sortedAngebote.filter(a => a.season === angebotTab);
    const tourKategorien = [...new Set(sortedAngebote.map(a => a.title))];

    const visibleTeamProfiles = teamProfiles.filter(t => t.visible !== false && !t.isDeleted);
    const activeTeamAttributes = teamAttributes.length > 0 ? teamAttributes : ['Superkraft', 'Kryptonit', 'Touren-Snack', 'Lebensmotto'];

    const filteredTours = visibleTours.filter(t => {
        if (filterKategorie !== 'Alle' && getKat(t, tourKategorien) !== filterKategorie) return false;
        if (filterTechnik !== 'Alle' && getTech(t) !== parseInt(filterTechnik)) return false;
        if (filterAusdauer !== 'Alle' && getAusd(t) !== parseInt(filterAusdauer)) return false;
        return true;
    });
    
    const filteredExampleTours = exampleTours.filter(t => {
        if (filterKategorie !== 'Alle' && getKat(t, tourKategorien) !== filterKategorie) return false;
        if (filterTechnik !== 'Alle' && getTech(t) !== parseInt(filterTechnik)) return false;
        if (filterAusdauer !== 'Alle' && getAusd(t) !== parseInt(filterAusdauer)) return false;
        return true;
    });

    // --- DEEP LINKING (Routing via URL) ---
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tourId = params.get('tour');
        const angebotId = params.get('angebot');
        const teamId = params.get('team');

        if (tourId && touren.length > 0) {
            const t = touren.find(t => t.id === tourId);
            if (t) setSelectedTour(t);
        }
        if (angebotId && angebote.length > 0) {
            const a = angebote.find(a => a.id === angebotId);
            if (a) setSelectedAngebot(a);
        }
        if (teamId && teamProfiles.length > 0) {
            const p = teamProfiles.find(t => t.id === teamId);
            if (p) setSelectedTeamMember(p);
        }
    }, [touren, angebote, teamProfiles]);

    // --- SEO & URL UPDATE BEI KLICK ---
    useEffect(() => {
        const url = new URL(window.location);
        
        if (selectedTour) url.searchParams.set('tour', selectedTour.id);
        else url.searchParams.delete('tour');

        if (selectedAngebot) url.searchParams.set('angebot', selectedAngebot.id);
        else url.searchParams.delete('angebot');

        if (selectedTeamMember) url.searchParams.set('team', selectedTeamMember.id);
        else url.searchParams.delete('team');

        window.history.replaceState({}, '', url);

        // Dynamisches SEO für Tab-Titel und Google-Description
        let title = "Berg Kollektiv | Bergführer IVBV";
        let desc = "Dein Bergführer für Hochtouren, Skitouren, Klettern und mehr im Kollektiv.";
        
        if (selectedTour) {
            title = `${selectedTour.title} | Berg Kollektiv`;
            if(selectedTour.description) desc = selectedTour.description.substring(0, 150) + '...';
        } else if (selectedAngebot) {
            title = `${selectedAngebot.title} | Berg Kollektiv`;
            if(selectedAngebot.desc) desc = selectedAngebot.desc;
        } else if (selectedTeamMember) {
            title = `${selectedTeamMember.name} - ${selectedTeamMember.title} | Berg Kollektiv`;
        }

        document.title = title;
        
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = "description";
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = desc;

    }, [selectedTour, selectedAngebot, selectedTeamMember]);

    useEffect(() => {
        if(!angebotTab && websiteSettings.tabOrder?.length > 0) {
            setAngebotTab(websiteSettings.tabOrder[0]);
        }
    }, [websiteSettings.tabOrder]);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 100);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    
    useEffect(() => {
        const logError = (err) => console.error("Fehler beim Laden aus Firebase.", err);
        
        const unsub1 = onSnapshot(collection(db, 'team_profiles'), 
            snap => setTeamProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() }))), logError
        );
        const unsub2 = onSnapshot(doc(db, 'settings', 'team_attributes'), 
            snap => { if (snap.exists() && snap.data().labels) setTeamAttributes(snap.data().labels); }, logError
        );
        const unsub3 = onSnapshot(collection(db, 'angebote'), 
            snap => setAngebote(snap.docs.map(d => ({ id: d.id, ...d.data() }))), logError
        );
        const unsub4 = onSnapshot(doc(db, 'settings', 'website'), 
            snap => { if (snap.exists()) setWebsiteSettings(prev => ({...prev, ...snap.data()})); }, logError
        );
        return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
    }, []);

    useEffect(() => {
        if (selectedTour || selectedTeamMember || selectedAngebot) setHasScrolledGallery(false);
    }, [selectedTour, selectedTeamMember, selectedAngebot]);

    useEffect(() => {
        if (window.matchMedia("(hover: hover)").matches) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('mobile-focus');
                } else {
                    entry.target.classList.remove('mobile-focus');
                }
            });
        }, {
            root: null,
            rootMargin: '-30% 0px -30% 0px',
            threshold: 0
        });

        setTimeout(() => {
            const elements = document.querySelectorAll('.tour-card, .team-img-container, #angebot .group');
            elements.forEach(el => observer.observe(el));
        }, 100);

        return () => observer.disconnect();
    }, [touren, teamProfiles, angebote, angebotTab, isAllToursModalOpen, isIdeenBoardOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isLightboxOpen === null || (!selectedTour && !selectedTeamMember && !selectedAngebot)) return;
            const activeItem = selectedTour || selectedTeamMember || selectedAngebot;
            const imgs = activeItem.images || (activeItem.image ? [activeItem.image] : []);
            if (imgs.length <= 1) return;
            if (e.key === 'ArrowRight') setIsLightboxOpen((prev) => (prev + 1) % imgs.length);
            else if (e.key === 'ArrowLeft') setIsLightboxOpen((prev) => (prev - 1 + imgs.length) % imgs.length);
            else if (e.key === 'Escape') setIsLightboxOpen(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLightboxOpen, selectedTour, selectedTeamMember, selectedAngebot]);

    useEffect(() => {
        if (isLightboxOpen !== null && window.innerWidth < 768) {
            setHasScrolledGallery(false);
            setTimeout(() => {
                const el = document.getElementById(`gallery-img-${isLightboxOpen}`);
                if (el) el.scrollIntoView({ behavior: 'instant', inline: 'center' });
            }, 50);
        }
    }, [isLightboxOpen]);

    const saveCustomerData = async (email, data) => {
        if (!email) return;
        try {
            await setDoc(doc(db, 'kunden_notizen', email.toLowerCase().trim()), data, { merge: true });
        } catch (e) { console.error("Konnte Kunde nicht im CRM anlegen", e); }
    };

    const handleAnfrage = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const thema = selectedAngebot ? selectedAngebot.title : 'Allgemeine Anfrage';
        
        const email = fd.get('email');
        const vorname = fd.get('vorname');
        const name = fd.get('name');

        const data = {
            thema: thema,
            vorname, name, email,
            nachricht: fd.get('nachricht'), timestamp: serverTimestamp(),
            status: 'Neu / Offen'
        };

        try {
            await addDoc(collection(db, 'anfragen'), data);
            await saveCustomerData(email, { email: email.toLowerCase().trim(), vorname, name });

            const emailjs = await loadEmailJS();
            await emailjs.send(
                "service_b02rsz7", "template_ewn7qhm", 
                { vorname: data.vorname, name: data.name, email: data.email, thema: data.thema, nachricht: data.nachricht }
            );
            setBookingStatus("Anfrage erfolgreich gesendet! Wir melden uns bald.");
            setTimeout(() => { setSelectedAngebot(null); setBookingStatus(null); }, 3000);
        } catch (err) { alert("Fehler beim Senden der Anfrage. Bitte versuche es später erneut."); }
    };

    const handleSpontanNewsletter = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const fd = new FormData(e.target);
        const email = fd.get('email');
        const vorname = fd.get('vorname');
        const name = fd.get('name');

        try {
            await saveCustomerData(email, { email: email.toLowerCase().trim(), vorname, name, newsletter: true });
            
            const anfrageData = {
                thema: 'Newsletter & Spontantouren Anmeldung',
                vorname, name, email,
                nachricht: 'Kunde möchte für den Newsletter bzw. für Spontantouren eingeschrieben werden.',
                timestamp: serverTimestamp(),
                status: 'Geantwortet'
            };
            await addDoc(collection(db, 'anfragen'), anfrageData);

            setBookingStatus("Erfolgreich für News & Spontantouren eingetragen!");
            setTimeout(() => { setSelectedAngebot(null); setBookingStatus(null); setIsSubmitting(false); }, 3000);
        } catch(err) {
            setBookingStatus("Fehler bei der Anmeldung. Bitte später versuchen.");
            setIsSubmitting(false);
        }
    };

    const handleIdeaInquiry = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        const fd = new FormData(e.target);
        
        const email = fd.get('email');
        const vorname = fd.get('vorname');
        const name = fd.get('name');

        const data = {
            thema: `Idee: ${selectedTour.title}`,
            vorname, name, email,
            nachricht: fd.get('nachricht'), timestamp: serverTimestamp(),
            status: 'Neu / Offen'
        };

        try {
            await addDoc(collection(db, 'anfragen'), data);
            await saveCustomerData(email, { email: email.toLowerCase().trim(), vorname, name });

            const emailjs = await loadEmailJS();
            
            await emailjs.send(
                "service_b02rsz7", "template_ewn7qhm", 
                { vorname: data.vorname, name: data.name, email: data.email, thema: data.thema, nachricht: data.nachricht }
            );
            
            setBookingStatus("Anfrage erfolgreich gesendet! Wir melden uns bald bei dir.");
            setTimeout(() => { setSelectedTour(null); setIsInquiryMode(false); setBookingStatus(null); setIsSubmitting(false); }, 4000);
        } catch (err) { 
            setBookingStatus("Fehler beim Senden der Anfrage. Bitte später erneut versuchen."); 
            setIsSubmitting(false); 
        }
    };

    const handleBooking = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        const fd = new FormData(e.target);

        if (!fd.get('agb_accept')) { alert("Bitte akzeptiere die AGB, um fortzufahren."); setIsSubmitting(false); return; }

        const email = fd.get('email');
        const vorname = fd.get('vorname');
        const name = fd.get('name');
        const phone = fd.get('phone');
        const adresse = fd.get('adresse');
        const plz = fd.get('plz');
        const ort = fd.get('ort');

        const data = {
            tourId: selectedTour.id, tourTitle: selectedTour.title,
            name, vorname, adresse,
            plz_ort: `${plz} ${ort}`, email, phone,
            geburtstag: fd.get('geburtstag'), ernaehrung: fd.get('ernaehrung'), besonderes: fd.get('besonderes'),
            timestamp: serverTimestamp()
        };

        try {
            if (!selectedTour.id.startsWith('mock-')) {
                await addDoc(collection(db, 'anmeldungen'), data);
                await updateDoc(doc(db, 'touren', selectedTour.id), { angemeldet: increment(1) });
                
                await saveCustomerData(email, { email: email.toLowerCase().trim(), vorname, name, phone, adresse, plz_ort: `${plz} ${ort}` });

                const emailjs = await loadEmailJS();
                await emailjs.send(
                    "service_b02rsz7", "template_1uovyru", 
                    { vorname: data.vorname, name: data.name, email: data.email, tour_title: data.tourTitle, tour_date: selectedTour.date, price: selectedTour.price }
                );
            }
            setBookingStatus("Herzlichen Dank! Die Bestätigung deiner Anmeldung ist zu dir unterwegs.");
            setTimeout(() => { setSelectedTour(null); setIsBookingMode(false); setBookingStatus(null); setIsSubmitting(false); }, 4000);
        } catch (err) { setBookingStatus("Anmeldung gespeichert, aber Mail-Versand fehlgeschlagen."); setIsSubmitting(false); }
    };

    const getLegacyTeamField = (member, attr) => {
        if (!member) return '';
        if (attr === 'Superkraft') return member.superkraft || '';
        if (attr === 'Kryptonit') return member.schwaeche || '';
        if (attr === 'Touren-Snack') return member.snack || '';
        if (attr === 'Lebensmotto') return member.zitat || '';
        return '';
    };

    return (
        <div className="min-h-screen bg-bg text-accent selection:bg-black selection:text-white">
            <style dangerouslySetInnerHTML={{__html: `
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@200;400;700&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
                body { font-family: 'Outfit', sans-serif !important; }
                .serif { font-family: 'Playfair Display', serif !important; }
                
                .hide-scrollbar {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
                .hide-scrollbar::-webkit-scrollbar {
                    display: none; /* Chrome, Safari, Opera */
                }

                @media (hover: none) {
                    .tour-card.mobile-focus .grayscale { filter: grayscale(0%) !important; }
                    .tour-card.mobile-focus .transform { transform: translateX(0.75rem) !important; }
                    .tour-card.mobile-focus .w-8 { width: 4rem !important; }
                    .team-img-container.mobile-focus img { filter: grayscale(0%) !important; transform: scale(1.05) !important; }
                    #angebot .group.mobile-focus { border-color: black !important; }
                    #angebot .group.mobile-focus h3 { transform: translateX(0.25rem) !important; }
                    #angebot .group.mobile-focus .opacity-0 { opacity: 1 !important; }
                }

                @keyframes swipeHint {
                    0% { transform: translateX(10px); opacity: 0; }
                    50% { transform: translateX(-10px); opacity: 1; }
                    100% { transform: translateX(-30px); opacity: 0; }
                }
                .animate-swipe-hint {
                    animation: swipeHint 2s infinite ease-in-out;
                }
            `}} />

            <nav className={`fixed w-full z-50 px-6 md:px-12 py-8 flex justify-between items-center transition-colors duration-1000 ${isVideoLoaded ? 'text-white mix-blend-difference' : 'text-black'}`}>
                <div className="text-lg md:text-xl tracking-[0.3em] uppercase cursor-pointer z-50" onClick={() => window.scrollTo(0,0)}>BERG <span className="font-bold">KOLLEKTIV</span></div>
                <div className="hidden md:flex space-x-12 text-[10px] uppercase tracking-[0.2em]">
                    <a href="#angebot" className="nav-link">Angebot</a>
                    <a href="#touren" className="nav-link">Aktuelle Touren</a>
                    <a href="#kollektiv" className="nav-link">Kollektiv</a>
                    <a href="#kontakt" className="nav-link">Kontakt</a>
                    <button onClick={onGoToAdmin} className="opacity-30 hover:opacity-100 transition border-l border-current pl-6">Admin</button>
                </div>
                <button 
                    className={`md:hidden z-50 relative text-xl w-10 h-10 flex items-center justify-center backdrop-blur-md rounded-full border border-current drop-shadow-md transition-all ${!isMobileMenuOpen && isScrolled ? (isVideoLoaded ? 'bg-black/60 text-white' : 'bg-white/60 text-black') : 'bg-transparent text-current'}`}
                    onClick={() => !isMobileMenuOpen && isScrolled ? window.scrollTo({ top: 0, behavior: 'smooth' }) : setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    {isMobileMenuOpen ? '✕' : (isScrolled ? '↑' : '☰')}
                </button>
                <div className={`fixed inset-0 bg-black/98 backdrop-blur-lg flex flex-col items-center justify-center space-y-10 transition-all duration-500 md:hidden z-40 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto text-white' : 'opacity-0 pointer-events-none'}`}>
                    {['angebot', 'touren', 'kollektiv', 'kontakt'].map(link => (
                        <a key={link} href={`#${link}`} onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-light uppercase tracking-[0.2em] hover:text-zinc-400 transition-colors">{link}</a>
                    ))}
                    <button onClick={() => { onGoToAdmin(); setIsMobileMenuOpen(false); }} className="text-xs uppercase tracking-[0.2em] text-zinc-500 mt-12 pt-8 border-t border-zinc-800">Admin Login</button>
                </div>
            </nav>

            <main className="fade-in">
                <header className={`relative h-screen flex items-center justify-center overflow-hidden px-4 transition-colors duration-1000 ${isVideoLoaded ? 'bg-black' : 'bg-white'}`}>
                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 z-0 ${isVideoLoaded ? 'opacity-0' : 'opacity-100'}`}>
                        <span className="text-xs md:text-sm uppercase tracking-[0.4em] text-zinc-300 font-bold">Berg Kollektiv</span>
                    </div>
                    <video key={activeHeroVideo} autoPlay muted loop playsInline preload="auto" onCanPlay={() => setIsVideoLoaded(true)} onLoadedData={() => setIsVideoLoaded(true)} className={`absolute inset-0 w-full h-full object-cover grayscale transition-opacity duration-1000 ${isVideoLoaded ? 'opacity-60' : 'opacity-0'}`}>
                        <source src={activeHeroVideo} type="video/mp4" />
                    </video>
                    <div className={`relative z-10 text-center text-white w-full max-w-[95vw] mx-auto mix-blend-difference transition-all duration-1000 ${isMobileMenuOpen || !isVideoLoaded ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                        <p className="uppercase tracking-[0.6em] text-[10px] mb-8 opacity-70">Bergführer IVBV</p>
                        <h1 className="font-normal leading-tight whitespace-nowrap text-[4.8vw] sm:text-[4vw] md:text-[3.5vw] lg:text-5xl xl:text-6xl uppercase tracking-[0.1em] sm:tracking-[0.2em] md:tracking-[0.3em] lg:tracking-[0.4em]">
                            Berg &nbsp;·&nbsp; Mensch &nbsp;·&nbsp; Erlebnis
                        </h1>
                    </div>
                </header>

                <section id="angebot" className="py-32 px-6 bg-white">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-20">
                            <h2 className="serif text-4xl italic mb-6">Unser Angebot</h2>
                            <div className="flex justify-center space-x-6 md:space-x-12 text-sm md:text-base font-semibold uppercase tracking-widest flex-wrap gap-y-4">
                                {RUBRIKEN.map(tab => (
                                    <button key={tab} onClick={() => setAngebotTab(tab)} className={`pb-2 opacity-40 transition-all ${angebotTab === tab ? 'border-b-2 border-black opacity-100' : ''}`}>{tab}</button>
                                ))}
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {renderedAngebote.map((item, i) => (
                            <article key={item.id || i} onClick={() => setSelectedAngebot(item)} className="p-8 border border-zinc-100 bg-[#fdfdfc] cursor-pointer hover:border-black transition-all group flex flex-col justify-between min-h-[250px]">
                                <div>
                                    <h3 className="serif text-xl italic mb-4 group-hover:translate-x-1 transition-transform">{item.title}</h3>
                                    <p className="text-zinc-500 text-xs leading-relaxed font-light">{item.desc}</p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-zinc-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-[8px] uppercase tracking-widest text-zinc-400">Details & Anfrage →</p>
                                </div>
                            </article>
                        ))}
                        {renderedAngebote.length === 0 && <p className="col-span-full text-center py-12 text-zinc-400 italic">Noch keine Angebote in dieser Kategorie.</p>}
                        </div>
                    </div>
                </section>

                <section id="touren" className="py-32 px-6 md:px-12 bg-[#f9f9f7]">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex justify-between items-end mb-20 border-b border-zinc-200 pb-8">
                            <h2 className="serif text-4xl italic">Aktuelle Touren</h2>
                        </div>
                        
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-20">
                            {recentTours.map(tour => (
                                <article key={tour.id} className="tour-card group cursor-pointer" onClick={() => { setSelectedTour(tour); setIsBookingMode(false); setIsInquiryMode(false); }}>
                                    <div className="aspect-[4/5] overflow-hidden bg-zinc-100 mb-6 grayscale group-hover:grayscale-0 transition-all duration-1000 relative">
                                        <img src={tour.image} loading="lazy" decoding="async" className="w-full h-full object-cover" alt={tour.title} />
                                        <div className="absolute top-4 right-4 bg-white/95 px-4 py-2 text-[8px] uppercase tracking-[0.2em] font-bold">
                                            {tour.maxPlaetze - tour.angemeldet > 0 ? `${tour.maxPlaetze - tour.angemeldet} Plätze` : 'Voll'}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <div className="transform transition-transform duration-500 group-hover:translate-x-3 w-full">
                                            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-2">{tour.date}</p>
                                            <h3 className="text-xl font-light mb-2 tracking-wide uppercase">{tour.title}</h3>
                                            <div className="flex justify-between items-end mt-4 pt-4 border-t border-zinc-200">
                                                <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold pb-1">{tour.price}</p>
                                                <div className="flex flex-col gap-1 items-end">
                                                    <DifficultyDots label="Technik" level={getTech(tour)} info={techDetails[getTech(tour)]} />
                                                    <DifficultyDots label="Ausdauer" level={getAusd(tour)} info={ausdDetails[getAusd(tour)]} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                        <div className="mt-20 text-center">
                            <button onClick={() => setIsAllToursModalOpen(true)} className="border border-black px-12 py-5 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-black hover:text-white transition-all">
                                Alle Touren & Filter öffnen
                            </button>
                        </div>
                    </div>
                </section>

                <section id="kollektiv" className="py-32 px-6 bg-white">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-20">
                            <h2 className="serif text-4xl italic mb-6">Das Kollektiv</h2>
                            <p className="text-zinc-500 font-light max-w-2xl mx-auto">Wir sind staatlich geprüfte Bergführer IVBV und teilen die Leidenschaft für die Berge.</p>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {visibleTeamProfiles.map(member => (
                                <article key={member.id} onClick={() => setSelectedTeamMember(member)} className="cursor-pointer group">
                                    <div className="team-img-container aspect-[3/4] overflow-hidden bg-zinc-100 mb-6">
                                        <img src={(member.images || [member.image])[0]} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt={member.name} />
                                    </div>
                                    <h3 className="text-lg uppercase tracking-widest mb-1">{member.name}</h3>
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">{member.title}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="kontakt" className="py-32 px-6 bg-[#f9f9f7]">
                    <div className="max-w-4xl mx-auto text-center">
                        <h2 className="serif text-4xl italic mb-6">Kontakt</h2>
                        <p className="text-zinc-500 font-light mb-12">Fragen, Wünsche oder eigene Tourenideen? Schreib uns.</p>
                        <a href="mailto:info@berg-kollektiv.ch" className="text-2xl hover:text-zinc-500 transition-colors border-b border-black pb-2">info@berg-kollektiv.ch</a>
                        <div className="mt-12 flex justify-center gap-6">
                            <a href="#" className="p-4 border border-zinc-200 hover:border-black transition-colors rounded-full"><Instagram /></a>
                        </div>
                    </div>
                </section>

                <footer className="py-12 px-6 bg-black text-white text-center text-[10px] uppercase tracking-widest">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center opacity-60">
                        <p>&copy; {new Date().getFullYear()} Berg Kollektiv</p>
                        <div className="flex gap-6 mt-6 md:mt-0">
                            <a href="#" className="hover:text-zinc-400 transition-colors">Impressum</a>
                            <a href="#" className="hover:text-zinc-400 transition-colors">AGB</a>
                            <a href="#" className="hover:text-zinc-400 transition-colors">Datenschutz</a>
                        </div>
                    </div>
                </footer>
            </main>
            
            {/* --- MODAL: ALLE TOUREN & IDEEN --- */}
            {isAllToursModalOpen && (
                <div className="fixed inset-0 z-[100] bg-white overflow-y-auto fade-in">
                    <button onClick={() => setIsAllToursModalOpen(false)} className="absolute top-6 right-6 p-4 z-50 text-black hover:opacity-50 transition-opacity"><X size={32} strokeWidth={1} /></button>
                    <div className="max-w-7xl mx-auto px-6 py-20 min-h-screen flex flex-col">
                        <h2 className="serif text-4xl italic mb-12">Touren Programm</h2>
                        
                        <div className="flex gap-6 mb-12 border-b border-zinc-200">
                            <button onClick={() => setIsIdeenBoardOpen(false)} className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all ${!isIdeenBoardOpen ? 'border-b-2 border-black' : 'text-zinc-400 hover:text-black'}`}>Aktuelle Touren</button>
                            <button onClick={() => setIsIdeenBoardOpen(true)} className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all ${isIdeenBoardOpen ? 'border-b-2 border-black' : 'text-zinc-400 hover:text-black'}`}>Ideen Board</button>
                        </div>
                        
                        <div className="flex flex-col md:flex-row gap-4 mb-12">
                            <div className="flex-1">
                                <label className="text-[8px] uppercase tracking-widest text-zinc-400 block mb-2">Kategorie</label>
                                <select value={filterKategorie} onChange={e => setFilterKategorie(e.target.value)} className="w-full border-b border-zinc-300 py-2 text-sm uppercase tracking-widest outline-none bg-transparent cursor-pointer font-bold text-zinc-600 focus:border-black transition-colors">
                                    <option value="Alle">Alle Kategorien</option>
                                    {tourKategorien.map(kat => <option key={kat} value={kat}>{kat}</option>)}
                                </select>
                            </div>
                            <div className="flex-1 relative">
                                <div className="flex items-center gap-2 mb-2">
                                    <label className="text-[8px] uppercase tracking-widest text-zinc-400 block">Level Technik</label>
                                    <Info size={10} className="text-zinc-400 cursor-pointer hover:text-black" onClick={() => setShowLevelInfo(!showLevelInfo)} />
                                </div>
                                <select value={filterTechnik} onChange={e => setFilterTechnik(e.target.value)} className="w-full border-b border-zinc-300 py-2 text-sm uppercase tracking-widest outline-none bg-transparent cursor-pointer font-bold text-zinc-600 focus:border-black transition-colors">
                                    <option value="Alle">Beliebig</option>
                                    <option value="1">Level 1 (Einfach)</option>
                                    <option value="2">Level 2 (Mittel)</option>
                                    <option value="3">Level 3 (Schwer)</option>
                                </select>
                            </div>
                            <div className="flex-1 relative">
                                <div className="flex items-center gap-2 mb-2">
                                    <label className="text-[8px] uppercase tracking-widest text-zinc-400 block">Level Ausdauer</label>
                                    <Info size={10} className="text-zinc-400 cursor-pointer hover:text-black" onClick={() => setShowLevelInfo(!showLevelInfo)} />
                                </div>
                                <select value={filterAusdauer} onChange={e => setFilterAusdauer(e.target.value)} className="w-full border-b border-zinc-300 py-2 text-sm uppercase tracking-widest outline-none bg-transparent cursor-pointer font-bold text-zinc-600 focus:border-black transition-colors">
                                    <option value="Alle">Beliebig</option>
                                    <option value="1">Level 1 (Einfach)</option>
                                    <option value="2">Level 2 (Mittel)</option>
                                    <option value="3">Level 3 (Schwer)</option>
                                </select>
                            </div>
                        </div>

                        {showLevelInfo && (
                            <div className="bg-zinc-50 border border-zinc-200 p-6 mb-12 text-sm relative fade-in">
                                <button onClick={() => setShowLevelInfo(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-black"><X size={16}/></button>
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="font-bold uppercase tracking-widest mb-4">Technik</h4>
                                        <ul className="space-y-3 text-zinc-600">
                                            <li><b>Level 1:</b> {techDetails[1]}</li>
                                            <li><b>Level 2:</b> {techDetails[2]}</li>
                                            <li><b>Level 3:</b> {techDetails[3]}</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold uppercase tracking-widest mb-4">Ausdauer</h4>
                                        <ul className="space-y-3 text-zinc-600">
                                            <li><b>Level 1:</b> {ausdDetails[1]}</li>
                                            <li><b>Level 2:</b> {ausdDetails[2]}</li>
                                            <li><b>Level 3:</b> {ausdDetails[3]}</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1">
                            {isIdeenBoardOpen ? (
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-20 fade-in">
                                    {filteredExampleTours.map(tour => (
                                        <article key={tour.id} className="tour-card group cursor-pointer" onClick={() => { setSelectedTour(tour); setIsBookingMode(false); setIsInquiryMode(false); }}>
                                            <div className="aspect-[4/5] overflow-hidden bg-zinc-100 mb-6 grayscale group-hover:grayscale-0 transition-all duration-1000 relative">
                                                <img src={tour.image} loading="lazy" decoding="async" className="w-full h-full object-cover" alt={tour.title} />
                                                <div className="absolute top-4 right-4 bg-white/95 px-4 py-2 text-[8px] uppercase tracking-[0.2em] font-bold text-blue-600">
                                                    Ideenpool
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-start">
                                                <div className="transform transition-transform duration-500 group-hover:translate-x-3 w-full">
                                                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-2">{getKat(tour, tourKategorien)}</p>
                                                    <h3 className="text-xl font-light mb-2 tracking-wide uppercase">{tour.title}</h3>
                                                    <div className="flex justify-between items-end mt-4 pt-4 border-t border-zinc-200">
                                                        <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold pb-1 text-blue-500">Auf Anfrage</p>
                                                        <div className="flex flex-col gap-1 items-end">
                                                            <DifficultyDots label="Technik" level={getTech(tour)} info={techDetails[getTech(tour)]} />
                                                            <DifficultyDots label="Ausdauer" level={getAusd(tour)} info={ausdDetails[getAusd(tour)]} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                    {filteredExampleTours.length === 0 && <p className="col-span-full text-zinc-400 text-center py-20 italic">Keine Ideen gefunden.</p>}
                                </div>
                            ) : (
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-20 fade-in">
                                    {filteredTours.map(tour => (
                                        <article key={tour.id} className="tour-card group cursor-pointer" onClick={() => { setSelectedTour(tour); setIsBookingMode(false); setIsInquiryMode(false); }}>
                                            <div className="aspect-[4/5] overflow-hidden bg-zinc-100 mb-6 grayscale group-hover:grayscale-0 transition-all duration-1000 relative">
                                                <img src={tour.image} loading="lazy" decoding="async" className="w-full h-full object-cover" alt={tour.title} />
                                                <div className="absolute top-4 right-4 bg-white/95 px-4 py-2 text-[8px] uppercase tracking-[0.2em] font-bold">
                                                    {tour.maxPlaetze - tour.angemeldet > 0 ? `${tour.maxPlaetze - tour.angemeldet} Plätze` : 'Voll'}
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-start">
                                                <div className="transform transition-transform duration-500 group-hover:translate-x-3 w-full">
                                                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-2">{tour.date}</p>
                                                    <h3 className="text-xl font-light mb-2 tracking-wide uppercase">{tour.title}</h3>
                                                    <div className="flex justify-between items-end mt-4 pt-4 border-t border-zinc-200">
                                                        <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold pb-1">{tour.price}</p>
                                                        <div className="flex flex-col gap-1 items-end">
                                                            <DifficultyDots label="Technik" level={getTech(tour)} info={techDetails[getTech(tour)]} />
                                                            <DifficultyDots label="Ausdauer" level={getAusd(tour)} info={ausdDetails[getAusd(tour)]} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                    {filteredTours.length === 0 && <p className="col-span-full text-zinc-400 text-center py-20 italic">Keine Touren gefunden, die deinen Kriterien entsprechen.</p>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: SINGLE TOUR DETAILS --- */}
            {selectedTour && (
                <div className="fixed inset-0 z-[200] bg-white overflow-y-auto fade-in flex">
                    <div className="w-full md:w-[45%] h-[35vh] md:h-screen fixed top-0 left-0">
                        {(() => {
                            const images = selectedTour.images || (selectedTour.image ? [selectedTour.image] : []);
                            return (
                                <div className="w-full h-full relative bg-zinc-100 group cursor-pointer" onClick={() => setIsLightboxOpen(0)}>
                                    <img src={images[0]} className="w-full h-full object-cover" alt="" />
                                    {images.length > 1 && (
                                        <div className="absolute bottom-6 left-6 bg-black text-white px-4 py-2 text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition">
                                            + {images.length - 1} weitere Bilder
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                    <div className="w-full md:w-[55%] ml-auto mt-[35vh] md:mt-0 min-h-screen bg-white relative">
                        <button onClick={() => { setSelectedTour(null); setIsBookingMode(false); setIsInquiryMode(false); setBookingStatus(null); }} className="fixed top-6 right-6 p-4 z-50 text-black hover:opacity-50 transition bg-white/80 backdrop-blur-sm rounded-full"><X size={24} strokeWidth={1} /></button>
                        
                        <div className="px-6 md:px-16 lg:px-24 py-20 pb-32 max-w-3xl">
                            {bookingStatus ? (
                                <div className="h-full flex flex-col justify-center items-center text-center py-32 fade-in">
                                    <div className="w-16 h-16 border border-green-500 rounded-full flex items-center justify-center text-green-500 mb-8"><span className="text-2xl font-light">✓</span></div>
                                    <h3 className="serif text-3xl italic mb-4">Fantastisch.</h3>
                                    <p className="text-zinc-500 font-light text-lg">{bookingStatus}</p>
                                    <button onClick={() => { setSelectedTour(null); setBookingStatus(null); setIsBookingMode(false); setIsInquiryMode(false); }} className="mt-12 border-b border-black pb-1 uppercase tracking-widest text-[10px] font-bold">Zurück zur Übersicht</button>
                                </div>
                            ) : (isBookingMode || isInquiryMode) ? (
                                <div className="fade-in">
                                    <button onClick={() => { setIsBookingMode(false); setIsInquiryMode(false); }} className="text-[10px] uppercase tracking-widest text-zinc-400 hover:text-black transition mb-12 flex items-center gap-2">← Zurück zur Tour</button>
                                    <h2 className="serif text-3xl md:text-4xl italic mb-4">{isBookingMode ? 'Anmeldung' : 'Anfrage Senden'}</h2>
                                    <p className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-12">{selectedTour.title}</p>
                                    
                                    <form onSubmit={isBookingMode ? handleBooking : handleIdeaInquiry} className="space-y-8">
                                        <div className="grid md:grid-cols-2 gap-8">
                                            <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-3">Vorname *</label><input name="vorname" required className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black transition" /></div>
                                            <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-3">Nachname *</label><input name="name" required className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black transition" /></div>
                                        </div>
                                        <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-3">Email *</label><input name="email" type="email" required className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black transition" /></div>
                                        
                                        {isBookingMode && (
                                            <>
                                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-3">Telefonnummer *</label><input name="phone" required className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black transition" /></div>
                                                <div className="pt-8 border-t border-zinc-100">
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-6">Adresse</label>
                                                    <div className="space-y-6">
                                                        <input name="adresse" placeholder="Strasse & Nr. *" required className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black transition" />
                                                        <div className="grid grid-cols-3 gap-6">
                                                            <input name="plz" placeholder="PLZ *" required className="col-span-1 border-b border-zinc-300 py-2 outline-none focus:border-black transition" />
                                                            <input name="ort" placeholder="Ort *" required className="col-span-2 border-b border-zinc-300 py-2 outline-none focus:border-black transition" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="pt-8 border-t border-zinc-100">
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-3">Geburtsdatum</label>
                                                    <input name="geburtstag" type="date" className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black transition" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-3">Ernährungsgewohnheiten / Allergien</label>
                                                    <input name="ernaehrung" placeholder="Vegetarisch, Vegan, Laktosefrei..." className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black transition" />
                                                </div>
                                            </>
                                        )}

                                        <div className="pt-8 border-t border-zinc-100">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-3">{isBookingMode ? 'Besonderes / Bemerkungen' : 'Deine Nachricht / Anfrage *'}</label>
                                            <textarea name={isBookingMode ? "besonderes" : "nachricht"} required={!isBookingMode} rows="4" className="w-full border border-zinc-300 p-4 resize-none outline-none focus:border-black transition" placeholder={isBookingMode ? "Optionale Anmerkungen..." : "Hallo, ich interessiere mich für..."}></textarea>
                                        </div>

                                        {isBookingMode && (
                                            <div className="pt-4 flex gap-3 items-start">
                                                <input type="checkbox" name="agb_accept" id="agb_accept" required className="mt-1" />
                                                <label htmlFor="agb_accept" className="text-xs text-zinc-500 leading-relaxed cursor-pointer">
                                                    Ich habe die <a href="#" className="underline">Allgemeinen Geschäftsbedingungen (AGB)</a> gelesen und bin einverstanden.
                                                </label>
                                            </div>
                                        )}
                                        
                                        <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white py-5 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition shadow-xl mt-8">
                                            {isSubmitting ? 'Wird gesendet...' : (isBookingMode ? 'Kostenpflichtig Buchen' : 'Anfrage Absenden')}
                                        </button>
                                    </form>
                                </div>
                            ) : (
                                <div className="fade-in">
                                    <div className="flex flex-wrap gap-4 items-center mb-8">
                                        <span className="text-[9px] uppercase tracking-widest font-bold bg-zinc-100 px-3 py-1 text-zinc-500">{getKat(selectedTour, tourKategorien)}</span>
                                        {selectedTour.isExample && <span className="text-[9px] uppercase tracking-widest font-bold bg-blue-50 text-blue-600 px-3 py-1">Ideenpool</span>}
                                    </div>
                                    <h2 className="serif text-4xl md:text-5xl italic mb-6 leading-tight">{selectedTour.title}</h2>
                                    
                                    <div className="flex flex-wrap gap-8 items-center border-b border-zinc-100 pb-8 mb-10">
                                        {!selectedTour.isExample && (
                                            <>
                                                <div><p className="text-[9px] uppercase tracking-widest text-zinc-400 mb-1">Datum</p><p className="font-bold text-sm">{selectedTour.date || 'Auf Anfrage'}</p></div>
                                                <div><p className="text-[9px] uppercase tracking-widest text-zinc-400 mb-1">Preis pro Person</p><p className="font-bold text-sm">{selectedTour.price || 'Auf Anfrage'}</p></div>
                                                <div><p className="text-[9px] uppercase tracking-widest text-zinc-400 mb-1">Status</p><p className="font-bold text-sm">{selectedTour.maxPlaetze - selectedTour.angemeldet > 0 ? `${selectedTour.maxPlaetze - selectedTour.angemeldet} Plätze frei` : 'Ausgebucht'}</p></div>
                                            </>
                                        )}
                                        {selectedTour.isExample && (
                                            <div><p className="text-[9px] uppercase tracking-widest text-zinc-400 mb-1">Verfügbarkeit</p><p className="font-bold text-sm text-blue-600">Auf Anfrage</p></div>
                                        )}
                                    </div>

                                    <div className="flex gap-12 mb-12 bg-[#f9f9f7] p-6 border border-zinc-100">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest font-bold mb-3">Level Technik</p>
                                            <DifficultyDots label={`T${getTech(selectedTour)}`} level={getTech(selectedTour)} info={techDetails[getTech(selectedTour)]} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest font-bold mb-3">Level Ausdauer</p>
                                            <DifficultyDots label={`A${getAusd(selectedTour)}`} level={getAusd(selectedTour)} info={ausdDetails[getAusd(selectedTour)]} />
                                        </div>
                                    </div>

                                    <div className="mb-12">
                                        <p className="text-zinc-600 leading-relaxed font-light whitespace-pre-line text-lg">{selectedTour.description}</p>
                                    </div>

                                    <div className="space-y-2 mb-16">
                                        <Accordion title="Ablauf & Programm" content={selectedTour.ablauf} />
                                        <Accordion title="Leistungen & Preisinfo" content={selectedTour.leistungen} />
                                        <Accordion title="Voraussetzungen">
                                            <p className="text-zinc-600 leading-relaxed font-light text-sm whitespace-pre-line pb-4">{selectedTour.anforderungen}</p>
                                            <div className="bg-zinc-50 p-4 border border-zinc-100 mt-4">
                                                <p className="text-[10px] font-bold uppercase tracking-widest mb-2">Kurzinfo Levels:</p>
                                                <p className="text-xs text-zinc-500 mb-2"><b>Technik:</b> {techDetails[getTech(selectedTour)]}</p>
                                                <p className="text-xs text-zinc-500"><b>Ausdauer:</b> {ausdDetails[getAusd(selectedTour)]}</p>
                                            </div>
                                        </Accordion>
                                        <Accordion title="Ausrüstung & Material">
                                            {selectedTour.material && <p className="text-zinc-600 leading-relaxed font-light text-sm whitespace-pre-line pb-6">{selectedTour.material}</p>}
                                            {selectedTour.materialUrl && (
                                                <a href={selectedTour.materialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-black px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition">
                                                    <FileText size={14}/> Materialliste PDF Download
                                                </a>
                                            )}
                                        </Accordion>
                                        {selectedTour.guide && (
                                            <Accordion title="Voraussichtliche Leitung">
                                                <p className="text-zinc-600 leading-relaxed font-light text-sm pb-4">Diese Tour wird voraussichtlich von <b>{selectedTour.guide}</b> durchgeführt.</p>
                                            </Accordion>
                                        )}
                                    </div>

                                    <div className="sticky bottom-8 z-40 bg-white/90 backdrop-blur-md p-4 border border-zinc-200 shadow-2xl">
                                        {selectedTour.isExample ? (
                                            <button onClick={() => setIsInquiryMode(true)} className="w-full bg-black text-white py-5 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition">
                                                Unverbindlich Anfragen
                                            </button>
                                        ) : selectedTour.maxPlaetze - selectedTour.angemeldet > 0 ? (
                                            <button onClick={() => setIsBookingMode(true)} className="w-full bg-black text-white py-5 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition">
                                                Jetzt Buchen
                                            </button>
                                        ) : (
                                            <button disabled className="w-full bg-zinc-200 text-zinc-500 py-5 text-[10px] font-bold uppercase tracking-widest cursor-not-allowed">
                                                Leider Ausgebucht
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: ANGEBOT DETAILS --- */}
            {selectedAngebot && (
                <div className="fixed inset-0 z-[200] bg-white overflow-y-auto fade-in flex">
                    <div className="w-full md:w-[45%] h-[35vh] md:h-screen fixed top-0 left-0">
                        {(() => {
                            const images = selectedAngebot.images || (selectedAngebot.image ? [selectedAngebot.image] : []);
                            return (
                                <div className="w-full h-full relative bg-zinc-100 group cursor-pointer" onClick={() => setIsLightboxOpen(0)}>
                                    <img src={images[0]} className="w-full h-full object-cover" alt="" />
                                    {images.length > 1 && (
                                        <div className="absolute bottom-6 left-6 bg-black text-white px-4 py-2 text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition">
                                            + {images.length - 1} weitere Bilder
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                    <div className="w-full md:w-[55%] ml-auto mt-[35vh] md:mt-0 min-h-screen bg-white relative">
                        <button onClick={() => { setSelectedAngebot(null); setBookingStatus(null); }} className="fixed top-6 right-6 p-4 z-50 text-black hover:opacity-50 transition bg-white/80 backdrop-blur-sm rounded-full"><X size={24} strokeWidth={1} /></button>
                        
                        <div className="px-6 md:px-16 lg:px-24 py-20 pb-32 max-w-3xl">
                            {bookingStatus ? (
                                <div className="h-full flex flex-col justify-center items-center text-center py-32 fade-in">
                                    <div className="w-16 h-16 border border-green-500 rounded-full flex items-center justify-center text-green-500 mb-8"><span className="text-2xl font-light">✓</span></div>
                                    <h3 className="serif text-3xl italic mb-4">Erfolgreich.</h3>
                                    <p className="text-zinc-500 font-light text-lg">{bookingStatus}</p>
                                    <button onClick={() => { setSelectedAngebot(null); setBookingStatus(null); }} className="mt-12 border-b border-black pb-1 uppercase tracking-widest text-[10px] font-bold">Fenster Schließen</button>
                                </div>
                            ) : (
                                <div className="fade-in">
                                    <h2 className="serif text-4xl md:text-5xl italic mb-6 leading-tight">{selectedAngebot.title}</h2>
                                    <div className="mb-12">
                                        <p className="text-zinc-600 leading-relaxed font-light whitespace-pre-line text-lg">{selectedAngebot.longDesc}</p>
                                    </div>
                                    
                                    <div className="bg-[#f9f9f7] border border-zinc-200 p-8 md:p-10">
                                        {selectedAngebot.season === 'Spontantouren' ? (
                                            <>
                                                <h3 className="serif text-2xl italic mb-4">Der Wetterbericht sieht gut aus?</h3>
                                                <p className="text-sm text-zinc-500 leading-relaxed mb-8">Trag dich in unsere Liste ein und wir informieren dich, sobald wir kurzfristig eine geniale Tour aufgleisen, weil die Bedingungen einfach zu gut sind, um zu Hause zu bleiben.</p>
                                                <form onSubmit={handleSpontanNewsletter} className="space-y-6">
                                                    <div className="grid md:grid-cols-2 gap-6">
                                                        <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Vorname</label><input name="vorname" required className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black bg-transparent" /></div>
                                                        <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Nachname</label><input name="name" required className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black bg-transparent" /></div>
                                                    </div>
                                                    <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">E-Mail</label><input name="email" type="email" required className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black bg-transparent" /></div>
                                                    <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition mt-4">
                                                        {isSubmitting ? 'Wird eingetragen...' : 'Eintragen (Unverbindlich)'}
                                                    </button>
                                                </form>
                                            </>
                                        ) : (
                                            <>
                                                <h3 className="serif text-2xl italic mb-4">Interesse geweckt?</h3>
                                                <p className="text-sm text-zinc-500 leading-relaxed mb-8">Schreib uns, was dir vorschwebt. Egal ob du schon ein konkretes Ziel hast oder einfach mal in diese Welt reinschnuppern möchtest.</p>
                                                <form onSubmit={handleAnfrage} className="space-y-6">
                                                    <div className="grid md:grid-cols-2 gap-6">
                                                        <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Vorname</label><input name="vorname" required className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black bg-transparent" /></div>
                                                        <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Nachname</label><input name="name" required className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black bg-transparent" /></div>
                                                    </div>
                                                    <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">E-Mail</label><input name="email" type="email" required className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black bg-transparent" /></div>
                                                    <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Deine Nachricht</label><textarea name="nachricht" required rows="3" className="w-full border-b border-zinc-300 py-2 outline-none focus:border-black bg-transparent resize-none"></textarea></div>
                                                    <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition mt-4">
                                                        {isSubmitting ? 'Sende Anfrage...' : 'Anfrage Senden'}
                                                    </button>
                                                </form>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: TEAM MEMBER --- */}
            {selectedTeamMember && (
                <div className="fixed inset-0 z-[200] bg-white overflow-y-auto fade-in flex">
                    <div className="w-full md:w-[45%] h-[40vh] md:h-screen fixed top-0 left-0">
                        {(() => {
                            const images = selectedTeamMember.images || (selectedTeamMember.image ? [selectedTeamMember.image] : []);
                            return (
                                <div className="w-full h-full relative bg-zinc-100 group cursor-pointer" onClick={() => setIsLightboxOpen(0)}>
                                    <img src={images[0]} className="w-full h-full object-cover" alt={selectedTeamMember.name} />
                                    {images.length > 1 && (
                                        <div className="absolute bottom-6 left-6 bg-black text-white px-4 py-2 text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition">
                                            + {images.length - 1} weitere Bilder
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                    <div className="w-full md:w-[55%] ml-auto mt-[40vh] md:mt-0 min-h-screen bg-white relative">
                        <button onClick={() => setSelectedTeamMember(null)} className="fixed top-6 right-6 p-4 z-50 text-black hover:opacity-50 transition bg-white/80 backdrop-blur-sm rounded-full"><X size={24} strokeWidth={1} /></button>
                        
                        <div className="px-6 md:px-16 lg:px-24 py-20 pb-32 max-w-3xl">
                            <h2 className="serif text-4xl md:text-5xl italic mb-2 leading-tight">{selectedTeamMember.name}</h2>
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 mb-12">{selectedTeamMember.title}</p>
                            
                            <div className="mb-16">
                                <p className="text-zinc-600 leading-relaxed font-light whitespace-pre-line text-lg">{selectedTeamMember.desc}</p>
                            </div>

                            <div className="space-y-6">
                                {activeTeamAttributes.map(attr => {
                                    const val = selectedTeamMember.customFields?.[attr] || getLegacyTeamField(selectedTeamMember, attr);
                                    if(!val) return null;
                                    return (
                                        <div key={attr} className="flex flex-col sm:flex-row gap-2 sm:gap-8 border-b border-zinc-100 pb-6">
                                            <span className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 sm:w-1/3 pt-1">{attr}</span>
                                            <span className="text-zinc-700 font-light sm:w-2/3">{val}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- LIGHTBOX --- */}
            {isLightboxOpen !== null && (() => {
                const activeItem = selectedTour || selectedTeamMember || selectedAngebot;
                if (!activeItem) return null;
                const imgs = activeItem.images || (activeItem.image ? [activeItem.image] : []);
                if (imgs.length === 0) return null;
                return (
                    <div className="fixed inset-0 z-[400] bg-black/95 flex flex-col justify-center items-center backdrop-blur-md fade-in" onClick={() => setIsLightboxOpen(null)}>
                        <button onClick={() => setIsLightboxOpen(null)} className="absolute top-6 right-6 text-white p-2 hover:bg-white/10 rounded-full transition-colors z-[420]"><X size={32}/></button>
                        <p className="absolute top-8 left-1/2 -translate-x-1/2 text-white text-[10px] uppercase tracking-widest opacity-50 z-[420]">
                            {isLightboxOpen + 1} / {imgs.length}
                        </p>
                        
                        {/* Mobile Swipe Gallery */}
                        <div className="w-full h-full overflow-x-auto flex md:hidden snap-x snap-mandatory hide-scrollbar items-center" onScroll={() => setHasScrolledGallery(true)}>
                            {imgs.map((src, i) => (
                                <div key={i} id={`gallery-img-${i}`} className="min-w-full w-full h-full flex-shrink-0 flex items-center justify-center snap-center p-4">
                                    <img src={src} loading="lazy" decoding="async" className="max-w-full max-h-[80vh] object-contain" alt="" />
                                </div>
                            ))}
                            {!hasScrolledGallery && imgs.length > 1 && (
                                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/70 flex flex-col items-center gap-2 pointer-events-none">
                                    <Hand size={24} className="animate-swipe-hint" />
                                    <span className="text-[10px] uppercase tracking-widest">Wischen für mehr</span>
                                </div>
                            )}
                        </div>

                        {/* Desktop Buttons & Image */}
                        <div className="hidden md:flex absolute inset-0 items-center justify-center z-[410]">
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsLightboxOpen((prev) => (prev - 1 + imgs.length) % imgs.length); }}
                                className="absolute left-8 top-1/2 -translate-y-1/2 text-white text-6xl p-8 hover:scale-110 transition-transform z-[420]"
                            >&#8249;</button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsLightboxOpen((prev) => (prev + 1) % imgs.length); }}
                                className="absolute right-8 top-1/2 -translate-y-1/2 text-white text-6xl p-8 hover:scale-110 transition-transform z-[420]"
                            >&#8250;</button>
                            <img
                                src={imgs[isLightboxOpen]}
                                loading="lazy"
                                decoding="async"
                                className="max-w-full max-h-[90vh] object-contain shadow-2xl transition-all duration-500 pointer-events-none px-24"
                                alt=""
                            />
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}