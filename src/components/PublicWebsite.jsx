import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, doc, increment, serverTimestamp, onSnapshot, setDoc } from "firebase/firestore";
import { FileText, Tag, Filter, Search, Info, Hand, X, ChevronLeft, ChevronRight, Mail, ArrowRight } from 'lucide-react';

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
                    {/* VIDEO WIRD NUN DYNAMISCH GELADEN */}
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
                            <div key={item.id || i} onClick={() => setSelectedAngebot(item)} className="p-8 border border-zinc-100 bg-[#fdfdfc] cursor-pointer hover:border-black transition-all group flex flex-col justify-between min-h-[250px]">
                                <div>
                                    <h3 className="serif text-xl italic mb-4 group-hover:translate-x-1 transition-transform">{item.title}</h3>
                                    <p className="text-zinc-500 text-xs leading-relaxed font-light">{item.desc}</p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-zinc-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-[8px] uppercase tracking-widest text-zinc-400">Details & Anfrage →</p>
                                </div>
                            </div>
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
                                <div key={tour.id} className="tour-card group cursor-pointer" onClick={() => { setSelectedTour(tour); setIsBookingMode(false); setIsInquiryMode(false); }}>
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
                                                <div className="flex flex-col gap-1.5 items-end">
                                                    <DifficultyDots label="Technik" level={getTech(tour)} />
                                                    <DifficultyDots label="Ausdauer" level={getAusd(tour)} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
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
                            <p className="text-sm text-zinc-500 uppercase tracking-widest">Die Gesichter hinter den Touren</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                            {visibleTeamProfiles.map(member => (
                                <div key={member.id} className="group cursor-pointer" onClick={() => setSelectedTeamMember(member)}>
                                    <div className="team-img-container aspect-[3/4] overflow-hidden bg-zinc-100 mb-6 grayscale group-hover:grayscale-0 transition-all duration-1000">
                                        <img src={(member.images || [member.image])[0]} className="w-full h-full object-cover transform transition-transform duration-1000 group-hover:scale-105" alt={member.name} />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-xl font-light mb-2 uppercase tracking-widest">{member.name}</h3>
                                        <p className="text-[10px] text-zinc-400 uppercase tracking-[0.2em]">{member.title}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="kontakt" className="py-32 px-6 bg-[#f9f9f7]">
                    <div className="max-w-4xl mx-auto text-center">
                        <h2 className="serif text-4xl italic mb-12">Lass uns reden</h2>
                        <a href="mailto:hallo@bergkollektiv.ch" className="text-2xl md:text-4xl font-light hover:text-zinc-500 transition-colors border-b border-transparent hover:border-zinc-300 pb-2">hallo@bergkollektiv.ch</a>
                        <div className="mt-20 flex justify-center gap-8">
                            <a href="#" className="p-4 border border-zinc-200 rounded-full hover:bg-black hover:text-white transition-all"><Instagram /></a>
                        </div>
                    </div>
                </section>

                <footer className="py-12 px-6 bg-black text-white text-center text-[10px] uppercase tracking-widest">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                        <p>&copy; {new Date().getFullYear()} Berg Kollektiv. Alle Rechte vorbehalten.</p>
                        <div className="flex gap-6">
                            <a href="#" className="hover:text-zinc-400 transition-colors">Impressum</a>
                            <a href="#" className="hover:text-zinc-400 transition-colors">AGB</a>
                            <a href="#" className="hover:text-zinc-400 transition-colors">Datenschutz</a>
                        </div>
                    </div>
                </footer>

            </main>

            {/* --- MODALS (Tourenliste, Ideenboard, Detailansichten) --- */}
            
            {/* Alle Touren Modal */}
            {isAllToursModalOpen && (
                <div className="fixed inset-0 z-[100] bg-white overflow-y-auto fade-in">
                    <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-zinc-100 px-6 py-6 md:px-12 flex justify-between items-center">
                        <h2 className="serif text-2xl md:text-3xl italic">Alle Touren</h2>
                        <button onClick={() => setIsAllToursModalOpen(false)} className="text-black hover:opacity-50 transition p-2"><X size={28} strokeWidth={1} /></button>
                    </div>

                    <div className="px-6 md:px-12 py-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-8 items-start">
                        <div className="w-full md:w-64 flex-shrink-0 sticky top-32">
                            <div className="flex items-center gap-2 mb-6 font-bold uppercase tracking-widest text-[11px] text-black border-b border-zinc-200 pb-3">
                                <Filter size={14}/> Filter
                            </div>
                            
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-[9px] uppercase tracking-widest text-zinc-400 mb-3 font-bold">Kategorie</h4>
                                    <div className="flex flex-col gap-2">
                                        <label className="flex items-center gap-3 text-sm cursor-pointer group">
                                            <input type="radio" checked={filterKategorie === 'Alle'} onChange={() => setFilterKategorie('Alle')} className="accent-black w-3 h-3" />
                                            <span className="group-hover:text-black text-zinc-600 transition">Alle Kategorien</span>
                                        </label>
                                        {tourKategorien.map(kat => (
                                            <label key={kat} className="flex items-center gap-3 text-sm cursor-pointer group">
                                                <input type="radio" checked={filterKategorie === kat} onChange={() => setFilterKategorie(kat)} className="accent-black w-3 h-3" />
                                                <span className="group-hover:text-black text-zinc-600 transition">{kat}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="border-t border-zinc-100 pt-6">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Technik</h4>
                                        <button onClick={() => setShowLevelInfo(!showLevelInfo)} className="text-zinc-400 hover:text-black transition"><Info size={12}/></button>
                                    </div>
                                    <div className="flex gap-2">
                                        {['Alle', '1', '2', '3'].map(lvl => (
                                            <button key={lvl} onClick={() => setFilterTechnik(lvl)} className={`flex-1 py-1.5 text-xs font-bold border transition ${filterTechnik === lvl ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}>{lvl}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="border-t border-zinc-100 pt-6">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Ausdauer</h4>
                                    </div>
                                    <div className="flex gap-2">
                                        {['Alle', '1', '2', '3'].map(lvl => (
                                            <button key={lvl} onClick={() => setFilterAusdauer(lvl)} className={`flex-1 py-1.5 text-xs font-bold border transition ${filterAusdauer === lvl ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}>{lvl}</button>
                                        ))}
                                    </div>
                                </div>

                                {showLevelInfo && (
                                    <div className="bg-[#f9f9f7] p-4 text-xs text-zinc-600 leading-relaxed border border-zinc-100 fade-in">
                                        <p className="font-bold mb-2">Level Info:</p>
                                        <p className="mb-2"><b>1:</b> Einfach / Basis (Einsteiger)</p>
                                        <p className="mb-2"><b>2:</b> Mittel / Fortgeschritten</p>
                                        <p><b>3:</b> Schwer / Experte (Hohes Level)</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1">
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                                {filteredTours.map(tour => (
                                    <div key={tour.id} className="tour-card group cursor-pointer" onClick={() => { setSelectedTour(tour); setIsBookingMode(false); setIsInquiryMode(false); setIsAllToursModalOpen(false); }}>
                                        <div className="aspect-[4/5] overflow-hidden bg-zinc-100 mb-6 grayscale group-hover:grayscale-0 transition-all duration-1000 relative">
                                            <img src={tour.image} loading="lazy" decoding="async" className="w-full h-full object-cover" alt={tour.title} />
                                            <div className="absolute top-4 right-4 bg-white/95 px-4 py-2 text-[8px] uppercase tracking-[0.2em] font-bold">
                                                {tour.maxPlaetze - tour.angemeldet > 0 ? `${tour.maxPlaetze - tour.angemeldet} Plätze` : 'Voll'}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-400 mb-2">{tour.date}</p>
                                            <h3 className="text-lg font-light mb-2 tracking-wide uppercase">{tour.title}</h3>
                                            <div className="flex justify-between items-end mt-4 pt-4 border-t border-zinc-100">
                                                <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold pb-1">{tour.price}</p>
                                                <div className="flex flex-col gap-1.5 items-end">
                                                    <DifficultyDots label="Technik" level={getTech(tour)} />
                                                    <DifficultyDots label="Ausdauer" level={getAusd(tour)} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {filteredTours.length === 0 && (
                                <div className="text-center py-20 border border-dashed border-zinc-200">
                                    <p className="text-zinc-400 italic mb-4">Keine Touren gefunden, die deinen Kriterien entsprechen.</p>
                                    <button onClick={() => { setFilterKategorie('Alle'); setFilterTechnik('Alle'); setFilterAusdauer('Alle'); }} className="text-[10px] uppercase tracking-widest border border-zinc-300 px-6 py-2 hover:border-black transition">Filter zurücksetzen</button>
                                </div>
                            )}

                            <div className="mt-20 pt-12 border-t border-zinc-200 text-center">
                                <h3 className="serif text-2xl italic mb-4">Nichts passendes dabei?</h3>
                                <p className="text-sm text-zinc-500 mb-8 max-w-lg mx-auto">Schau doch mal in unserem Ideenboard vorbei. Dort findest du Inspiration für Touren, die wir auf Anfrage für dich organisieren können.</p>
                                <button onClick={() => { setIsAllToursModalOpen(false); setIsIdeenBoardOpen(true); }} className="border border-black px-12 py-4 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-black hover:text-white transition-all inline-block">Zum Ideenboard</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Ideenboard Modal (Beispieltouren) */}
            {isIdeenBoardOpen && (
                <div className="fixed inset-0 z-[100] bg-[#f9f9f7] overflow-y-auto fade-in">
                    <div className="sticky top-0 bg-[#f9f9f7]/90 backdrop-blur-md z-10 border-b border-zinc-200 px-6 py-6 md:px-12 flex justify-between items-center">
                        <h2 className="serif text-2xl md:text-3xl italic">Touren Ideen</h2>
                        <button onClick={() => setIsIdeenBoardOpen(false)} className="text-black hover:opacity-50 transition p-2"><X size={28} strokeWidth={1} /></button>
                    </div>
                    
                    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto text-center max-w-3xl mb-8">
                        <p className="text-base text-zinc-600 leading-relaxed">Hier findest du eine Auswahl an Klassikern und Traumtouren, die wir nicht im festen Programm haben, aber <b>jederzeit auf Anfrage</b> für dich (und deine Freunde) organisieren können.</p>
                    </div>

                    <div className="px-6 md:px-12 pb-20 max-w-7xl mx-auto flex flex-col md:flex-row gap-8 items-start">
                        <div className="w-full md:w-64 flex-shrink-0 sticky top-32">
                            <div className="flex items-center gap-2 mb-6 font-bold uppercase tracking-widest text-[11px] text-black border-b border-zinc-200 pb-3">
                                <Filter size={14}/> Filter (Ideen)
                            </div>
                            
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-[9px] uppercase tracking-widest text-zinc-400 mb-3 font-bold">Kategorie</h4>
                                    <div className="flex flex-col gap-2">
                                        <label className="flex items-center gap-3 text-sm cursor-pointer group">
                                            <input type="radio" checked={filterKategorie === 'Alle'} onChange={() => setFilterKategorie('Alle')} className="accent-black w-3 h-3" />
                                            <span className="group-hover:text-black text-zinc-600 transition">Alle Ideen</span>
                                        </label>
                                        {tourKategorien.map(kat => (
                                            <label key={kat} className="flex items-center gap-3 text-sm cursor-pointer group">
                                                <input type="radio" checked={filterKategorie === kat} onChange={() => setFilterKategorie(kat)} className="accent-black w-3 h-3" />
                                                <span className="group-hover:text-black text-zinc-600 transition">{kat}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1">
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                                {filteredExampleTours.map(tour => (
                                    <div key={tour.id} className="tour-card group cursor-pointer bg-white p-4 border border-zinc-100 hover:border-black transition" onClick={() => { setSelectedTour(tour); setIsBookingMode(false); setIsInquiryMode(true); setIsIdeenBoardOpen(false); }}>
                                        <div className="aspect-square overflow-hidden bg-zinc-100 mb-6 grayscale group-hover:grayscale-0 transition-all duration-1000">
                                            <img src={tour.image} loading="lazy" decoding="async" className="w-full h-full object-cover" alt={tour.title} />
                                        </div>
                                        <div>
                                            <span className="text-[8px] uppercase tracking-widest bg-zinc-100 text-zinc-500 px-2 py-1 mb-3 inline-block">Auf Anfrage</span>
                                            <h3 className="text-lg font-light mb-2 tracking-wide uppercase">{tour.title}</h3>
                                            <div className="flex justify-between items-end mt-4 pt-4 border-t border-zinc-100">
                                                <p className="text-[10px] uppercase tracking-widest text-black font-bold flex items-center gap-1 group-hover:gap-2 transition-all">Anfragen <ArrowRight size={12}/></p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {filteredExampleTours.length === 0 && (
                                <div className="text-center py-20 border border-dashed border-zinc-300">
                                    <p className="text-zinc-500 italic mb-4">Keine Ideen in dieser Kategorie vorhanden.</p>
                                    <button onClick={() => setFilterKategorie('Alle')} className="text-[10px] uppercase tracking-widest border border-zinc-300 bg-white px-6 py-2 hover:border-black transition">Filter zurücksetzen</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Selected Angebot / Anfrage Modal (mit spezifischem Spontantouren Bereich) */}
            {selectedAngebot && (
                <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md overflow-y-auto fade-in">
                    <button onClick={() => setSelectedAngebot(null)} className="fixed top-8 right-8 md:top-12 md:right-12 z-50 p-4 bg-white/80 hover:bg-white rounded-full text-black hover:scale-110 transition-transform shadow-lg"><X size={24} strokeWidth={1.5} /></button>
                    
                    <div className="max-w-4xl mx-auto px-6 py-20 md:py-32">
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 mb-4 block">{selectedAngebot.season}</span>
                        <h2 className="serif text-4xl md:text-5xl italic mb-12">{selectedAngebot.title}</h2>
                        
                        <div className="prose prose-zinc prose-p:font-light prose-p:leading-relaxed max-w-none text-base md:text-lg text-zinc-600 mb-16 whitespace-pre-line">
                            {selectedAngebot.longDesc || selectedAngebot.desc}
                        </div>

                        {(selectedAngebot.images || (selectedAngebot.image ? [selectedAngebot.image] : [])).length > 0 && (
                            <div className="grid grid-cols-2 gap-4 mb-16">
                                {(selectedAngebot.images || (selectedAngebot.image ? [selectedAngebot.image] : [])).slice(0, 2).map((img, idx) => (
                                    <div key={idx} className={`aspect-[4/3] bg-zinc-100 ${idx === 0 ? 'col-span-2' : ''}`}>
                                        <img src={img} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" alt="" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedAngebot.season === 'Spontantouren' ? (
                            <div className="mt-12 bg-[#fdfcf9] border border-amber-100 p-8 md:p-12 shadow-sm">
                                <h3 className="serif text-2xl italic mb-4">Bist du spontan?</h3>
                                <p className="text-zinc-600 text-sm leading-relaxed mb-6">
                                    Unsere kurzfristigen Spontantouren werden direkt unter den <button onClick={() => { setSelectedAngebot(null); setIsAllToursModalOpen(true); }} className="underline font-bold text-amber-700 hover:text-black transition">aktuellen Touren</button> ausgeschrieben. 
                                    <br/><br/>
                                    Willst du als Erste/r davon erfahren? Trag dich unten für die E-Mail-Benachrichtigung ein!
                                </p>
                                
                                {bookingStatus ? (
                                    <div className="p-6 bg-green-50 text-green-800 text-center font-bold text-sm uppercase tracking-widest">{bookingStatus}</div>
                                ) : (
                                    <form onSubmit={handleSpontanNewsletter} className="space-y-6">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div><label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Vorname</label><input name="vorname" required className="w-full border-b border-zinc-300 p-3 bg-transparent outline-none focus:border-black" /></div>
                                            <div><label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Nachname</label><input name="name" required className="w-full border-b border-zinc-300 p-3 bg-transparent outline-none focus:border-black" /></div>
                                        </div>
                                        <div><label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">E-Mail</label><input name="email" type="email" required className="w-full border-b border-zinc-300 p-3 bg-transparent outline-none focus:border-black" /></div>
                                        
                                        <div className="pt-4">
                                            <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white px-8 py-5 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-zinc-800 transition">
                                                {isSubmitting ? 'Wird eingetragen...' : 'Für Benachrichtigung eintragen'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        ) : (
                            <div className="mt-12 bg-[#f9f9f7] p-8 md:p-12 border border-zinc-100">
                                <h3 className="serif text-2xl italic mb-4">Benötigst du Ideen?</h3>
                                <p className="text-zinc-600 text-sm leading-relaxed mb-8">Schau dir unsere <button onClick={() => { setSelectedAngebot(null); setIsIdeenBoardOpen(true); }} className="underline font-bold text-black">Touren Ideen</button> an oder schreibe uns eine unverbindliche Anfrage in diesem Bereich.</p>
                                
                                {bookingStatus ? (
                                    <div className="p-6 bg-green-50 text-green-800 text-center font-bold text-sm uppercase tracking-widest">{bookingStatus}</div>
                                ) : (
                                    <form onSubmit={handleAnfrage} className="space-y-6">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div><label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Vorname</label><input name="vorname" required className="w-full border-b border-zinc-300 p-3 bg-transparent outline-none focus:border-black transition" /></div>
                                            <div><label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Nachname</label><input name="name" required className="w-full border-b border-zinc-300 p-3 bg-transparent outline-none focus:border-black transition" /></div>
                                        </div>
                                        <div><label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">E-Mail</label><input name="email" type="email" required className="w-full border-b border-zinc-300 p-3 bg-transparent outline-none focus:border-black transition" /></div>
                                        <div><label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Deine Nachricht / Idee</label><textarea name="nachricht" required rows="4" className="w-full border-b border-zinc-300 p-3 bg-transparent outline-none focus:border-black transition resize-y"></textarea></div>
                                        
                                        <div className="pt-4">
                                            <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white px-8 py-5 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-zinc-800 transition">
                                                {isSubmitting ? 'Wird gesendet...' : 'Unverbindlich Anfragen'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Selected Tour Modal */}
            {selectedTour && (
                <div className="fixed inset-0 z-[100] bg-white overflow-y-auto fade-in">
                    <button onClick={() => { setSelectedTour(null); setIsBookingMode(false); setIsInquiryMode(false); }} className="fixed top-6 right-6 md:top-12 md:right-12 z-50 p-3 md:p-4 bg-white/80 hover:bg-white rounded-full text-black hover:scale-110 transition-transform shadow-lg"><X size={24} strokeWidth={1.5} /></button>
                    
                    <div className="flex flex-col lg:flex-row min-h-screen">
                        <div className="w-full lg:w-1/2 lg:fixed lg:h-screen bg-zinc-100 flex flex-col p-6 md:p-12 justify-center relative overflow-hidden group/gallery">
                            <div className="absolute top-6 left-6 z-20"><span className="text-[9px] bg-white px-3 py-1 font-bold uppercase tracking-widest">{selectedTour.isExample ? 'Tour Idee / Anfrage' : 'Tour Detail'}</span></div>
                            
                            {(selectedTour.images || (selectedTour.image ? [selectedTour.image] : [])).length > 0 ? (
                                <div className="relative w-full h-[50vh] lg:h-full flex items-center justify-center">
                                    <div className="w-full h-full overflow-x-auto snap-x snap-mandatory flex hide-scrollbar" 
                                         onScroll={() => setHasScrolledGallery(true)}>
                                        {(selectedTour.images || (selectedTour.image ? [selectedTour.image] : [])).map((img, idx) => (
                                            <div key={idx} id={`gallery-img-${idx}`} className="w-full h-full flex-shrink-0 snap-center relative cursor-zoom-in" onClick={() => setIsLightboxOpen(idx)}>
                                                <img src={img} loading="lazy" decoding="async" className="w-full h-full object-cover" alt={`${selectedTour.title} - Bild ${idx + 1}`} />
                                            </div>
                                        ))}
                                    </div>
                                    {(selectedTour.images || []).length > 1 && !hasScrolledGallery && (
                                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 text-[9px] uppercase tracking-widest rounded-full backdrop-blur-sm pointer-events-none animate-swipe-hint flex items-center gap-2 lg:hidden">
                                            <Hand size={12}/> Wischen für mehr Bilder
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center"><p className="text-zinc-400 text-sm uppercase tracking-widest italic">Kein Bild verfügbar</p></div>
                            )}
                        </div>
                        
                        <div className="w-full lg:w-1/2 lg:ml-[50%] p-6 md:p-16 lg:p-24 bg-white relative">
                            {isBookingMode ? (
                                <div className="fade-in">
                                    <button onClick={() => setIsBookingMode(false)} className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 hover:text-black mb-12 flex items-center gap-2 transition-colors"><ChevronLeft size={14}/> Zurück zur Übersicht</button>
                                    <h2 className="serif text-3xl italic mb-4">Anmeldung</h2>
                                    <p className="text-xl font-light uppercase tracking-widest mb-10 pb-6 border-b border-zinc-100">{selectedTour.title}</p>
                                    
                                    {bookingStatus ? (
                                        <div className="p-8 bg-[#f9f9f7] text-center border border-zinc-200">
                                            <p className="text-green-700 font-bold text-sm uppercase tracking-widest mb-4">Erfolgreich!</p>
                                            <p className="text-zinc-600 leading-relaxed">{bookingStatus}</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleBooking} className="space-y-8">
                                            <div className="grid md:grid-cols-2 gap-8">
                                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Vorname *</label><input name="vorname" required className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition" /></div>
                                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nachname *</label><input name="name" required className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition" /></div>
                                            </div>
                                            <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">E-Mail *</label><input name="email" type="email" required className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition" /></div>
                                            <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Telefon *</label><input name="phone" type="tel" required className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition" /></div>
                                            <div className="pt-4 border-t border-zinc-100"><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Strasse / Nr. *</label><input name="adresse" required className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition" /></div>
                                            <div className="grid md:grid-cols-3 gap-8">
                                                <div className="md:col-span-1"><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">PLZ *</label><input name="plz" required className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition" /></div>
                                                <div className="md:col-span-2"><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Ort *</label><input name="ort" required className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition" /></div>
                                            </div>
                                            <div className="pt-4 border-t border-zinc-100">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Ernährung (Vegi, Vegan, Allergien)</label>
                                                <input name="ernaehrung" placeholder="Falls zutreffend..." className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Besonderes / Anmerkungen</label>
                                                <textarea name="besonderes" rows="3" placeholder="Gibt es sonst noch etwas, das wir wissen sollten?" className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition resize-y" />
                                            </div>
                                            
                                            <div className="pt-6 border-t border-zinc-200">
                                                <label className="flex items-start gap-4 cursor-pointer group">
                                                    <input type="checkbox" name="agb_accept" required className="mt-1 accent-black w-4 h-4 cursor-pointer" />
                                                    <span className="text-xs text-zinc-500 leading-relaxed group-hover:text-black transition">Ich habe die <a href="#" className="underline">Allgemeinen Geschäftsbedingungen (AGB)</a> gelesen und akzeptiere diese verbindlich.</span>
                                                </label>
                                            </div>
                                            
                                            <div className="pt-8">
                                                <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white px-8 py-5 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-zinc-800 transition">
                                                    {isSubmitting ? 'Wird gesendet...' : 'Verbindlich Anmelden'}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            ) : isInquiryMode ? (
                                <div className="fade-in">
                                    <button onClick={() => setIsInquiryMode(false)} className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 hover:text-black mb-12 flex items-center gap-2 transition-colors"><ChevronLeft size={14}/> Zurück zur Idee</button>
                                    <h2 className="serif text-3xl italic mb-4">Tour Anfragen</h2>
                                    <p className="text-xl font-light uppercase tracking-widest mb-10 pb-6 border-b border-zinc-100">{selectedTour.title}</p>
                                    
                                    {bookingStatus ? (
                                        <div className="p-8 bg-[#f9f9f7] text-center border border-zinc-200">
                                            <p className="text-green-700 font-bold text-sm uppercase tracking-widest mb-4">Erfolgreich!</p>
                                            <p className="text-zinc-600 leading-relaxed">{bookingStatus}</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleIdeaInquiry} className="space-y-8">
                                            <p className="text-sm text-zinc-500 mb-8 leading-relaxed">Du interessierst dich für diese Tour? Genial! Schreib uns einfach deine Wunschtermine oder sonstige Vorstellungen. Wir melden uns dann mit einem unverbindlichen Vorschlag bei dir.</p>
                                            
                                            <div className="grid md:grid-cols-2 gap-8">
                                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Vorname *</label><input name="vorname" required className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition" /></div>
                                                <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nachname *</label><input name="name" required className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition" /></div>
                                            </div>
                                            <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">E-Mail *</label><input name="email" type="email" required className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition" /></div>
                                            
                                            <div className="pt-4 border-t border-zinc-100">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Deine Vorstellungen (Termine, Anzahl Personen, Fragen...)</label>
                                                <textarea name="nachricht" required rows="5" className="w-full border-b border-zinc-200 p-3 mt-1 outline-none focus:border-black transition resize-y" />
                                            </div>
                                            
                                            <div className="pt-8">
                                                <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white px-8 py-5 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-zinc-800 transition">
                                                    {isSubmitting ? 'Wird gesendet...' : 'Unverbindlich Anfragen'}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            ) : (
                                <div className="fade-in">
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400 mb-4">{getKat(selectedTour, tourKategorien)}</p>
                                    <h2 className="serif text-4xl md:text-5xl italic mb-8">{selectedTour.title}</h2>
                                    
                                    <div className="flex flex-wrap gap-x-12 gap-y-6 mb-12 pb-8 border-b border-zinc-100">
                                        {!selectedTour.isExample && (
                                            <>
                                                <div><p className="text-[9px] uppercase tracking-widest text-zinc-400 mb-1">Datum</p><p className="font-medium text-sm">{selectedTour.date}</p></div>
                                                <div><p className="text-[9px] uppercase tracking-widest text-zinc-400 mb-1">Preis</p><p className="font-medium text-sm">{selectedTour.price}</p></div>
                                                <div><p className="text-[9px] uppercase tracking-widest text-zinc-400 mb-1">Verfügbar</p><p className="font-medium text-sm">{selectedTour.maxPlaetze - selectedTour.angemeldet > 0 ? `${selectedTour.maxPlaetze - selectedTour.angemeldet} von ${selectedTour.maxPlaetze} Plätzen` : 'Ausgebucht'}</p></div>
                                            </>
                                        )}
                                        <div className="w-full sm:w-auto"><p className="text-[9px] uppercase tracking-widest text-zinc-400 mb-2">Anforderung</p><div className="flex flex-col gap-2"><DifficultyDots label="Technik" level={getTech(selectedTour)} info="Beschreibt die technischen Schwierigkeiten (Klettern, Gelände)"/><DifficultyDots label="Ausdauer" level={getAusd(selectedTour)} info="Konditionelle Anforderung (Höhenmeter, Distanz)"/></div></div>
                                        {selectedTour.guide && (
                                            <div className="w-full sm:w-auto"><p className="text-[9px] uppercase tracking-widest text-zinc-400 mb-1">Guide</p><p className="font-medium text-sm">{selectedTour.guide}</p></div>
                                        )}
                                    </div>

                                    <div className="prose prose-zinc prose-p:font-light prose-p:leading-relaxed max-w-none text-base md:text-lg text-zinc-600 mb-16 whitespace-pre-line">
                                        {selectedTour.description}
                                    </div>

                                    {!selectedTour.isExample && (
                                        <div className="mb-16">
                                            <Accordion title="Programm / Ablauf" content={selectedTour.ablauf} />
                                            <Accordion title="Leistungen" content={selectedTour.leistungen} />
                                            <Accordion title="Anforderungen" content={selectedTour.anforderungen} />
                                            <Accordion title="Material">
                                                <div className="pb-4">
                                                    {selectedTour.material && <p className="text-zinc-600 leading-relaxed font-light text-sm whitespace-pre-line mb-4">{selectedTour.material}</p>}
                                                    {selectedTour.materialUrl && (
                                                        <a href={selectedTour.materialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-6 py-3 border border-zinc-200 text-[10px] uppercase font-bold tracking-widest hover:border-black transition">
                                                            <FileText size={14} /> Materialliste PDF
                                                        </a>
                                                    )}
                                                    {!selectedTour.material && !selectedTour.materialUrl && <p className="text-zinc-400 italic text-sm">Keine spezielle Materialliste hinterlegt.</p>}
                                                </div>
                                            </Accordion>
                                        </div>
                                    )}

                                    <div className="sticky bottom-0 bg-white pt-8 pb-8 border-t border-zinc-100 z-10">
                                        {selectedTour.isExample ? (
                                            <button onClick={() => setIsInquiryMode(true)} className="w-full bg-black text-white px-8 py-5 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-zinc-800 transition">
                                                Unverbindlich Anfragen
                                            </button>
                                        ) : selectedTour.maxPlaetze - selectedTour.angemeldet > 0 ? (
                                            <button onClick={() => setIsBookingMode(true)} className="w-full bg-black text-white px-8 py-5 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-zinc-800 transition">
                                                Jetzt Anmelden
                                            </button>
                                        ) : (
                                            <button disabled className="w-full bg-zinc-200 text-zinc-500 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.3em] cursor-not-allowed">
                                                Ausgebucht
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Selected Team Member Modal */}
            {selectedTeamMember && (
                <div className="fixed inset-0 z-[100] bg-white overflow-y-auto fade-in">
                    <button onClick={() => setSelectedTeamMember(null)} className="fixed top-6 right-6 md:top-12 md:right-12 z-50 p-3 md:p-4 bg-white/80 hover:bg-white rounded-full text-black hover:scale-110 transition-transform shadow-lg"><X size={24} strokeWidth={1.5} /></button>
                    
                    <div className="flex flex-col lg:flex-row min-h-screen">
                        <div className="w-full lg:w-1/2 lg:fixed lg:h-screen bg-zinc-100 flex flex-col p-6 md:p-12 justify-center relative overflow-hidden group/gallery">
                            <div className="absolute top-6 left-6 z-20"><span className="text-[9px] bg-white px-3 py-1 font-bold uppercase tracking-widest">Kollektiv / Guide</span></div>
                            
                            {(selectedTeamMember.images || (selectedTeamMember.image ? [selectedTeamMember.image] : [])).length > 0 ? (
                                <div className="relative w-full h-[50vh] lg:h-full flex items-center justify-center">
                                    <div className="w-full h-full overflow-x-auto snap-x snap-mandatory flex hide-scrollbar" 
                                         onScroll={() => setHasScrolledGallery(true)}>
                                        {(selectedTeamMember.images || (selectedTeamMember.image ? [selectedTeamMember.image] : [])).map((img, idx) => (
                                            <div key={idx} id={`gallery-img-${idx}`} className="w-full h-full flex-shrink-0 snap-center relative cursor-zoom-in" onClick={() => setIsLightboxOpen(idx)}>
                                                <img src={img} loading="lazy" decoding="async" className="w-full h-full object-cover" alt={`${selectedTeamMember.name} - Bild ${idx + 1}`} />
                                            </div>
                                        ))}
                                    </div>
                                    {(selectedTeamMember.images || []).length > 1 && !hasScrolledGallery && (
                                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 text-[9px] uppercase tracking-widest rounded-full backdrop-blur-sm pointer-events-none animate-swipe-hint flex items-center gap-2 lg:hidden">
                                            <Hand size={12}/> Wischen
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center"><p className="text-zinc-400 text-sm uppercase tracking-widest italic">Kein Bild verfügbar</p></div>
                            )}
                        </div>

                        <div className="w-full lg:w-1/2 lg:ml-[50%] p-6 md:p-16 lg:p-24 bg-white flex flex-col justify-center">
                            <div className="fade-in max-w-xl mx-auto w-full">
                                <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400 mb-4">{selectedTeamMember.title}</p>
                                <h2 className="serif text-4xl md:text-5xl italic mb-12">{selectedTeamMember.name}</h2>
                                
                                <div className="prose prose-zinc prose-p:font-light prose-p:leading-relaxed max-w-none text-base md:text-lg text-zinc-600 mb-16 whitespace-pre-line">
                                    {selectedTeamMember.desc}
                                </div>

                                <div className="space-y-6 pt-12 border-t border-zinc-100">
                                    {activeTeamAttributes.map(attr => {
                                        const val = selectedTeamMember.customFields?.[attr] || getLegacyTeamField(selectedTeamMember, attr);
                                        if(!val) return null;
                                        return (
                                            <div key={attr} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6">
                                                <span className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold w-32 shrink-0 pt-1">{attr}</span>
                                                <span className="text-sm font-light text-zinc-700 italic leading-relaxed">"{val}"</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox Modal für Bildergalerie */}
            {(() => {
                const activeItem = selectedTour || selectedTeamMember || selectedAngebot;
                if (!activeItem || isLightboxOpen === null) return null;
                const imgs = activeItem.images || (activeItem.image ? [activeItem.image] : []);
                if (imgs.length === 0) return null;

                return (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 md:p-8 fade-in select-none" onClick={() => setIsLightboxOpen(null)}>
                    <button className="absolute top-6 right-6 md:top-10 md:right-10 text-white p-4 hover:scale-110 transition-transform z-[210]"><X size={32} strokeWidth={1} /></button>
                    
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 text-zinc-500 text-[10px] uppercase tracking-widest font-bold z-[210]">
                        {isLightboxOpen + 1} / {imgs.length}
                    </div>

                    {imgs.length > 1 && (
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50 text-[10px] uppercase tracking-widest z-[210] flex gap-8">
                            <span className="hidden md:inline">← Pfeiltasten →</span>
                            <span className="md:hidden flex items-center gap-2"><Hand size={14}/> Wischen</span>
                        </div>
                    )}

                    {(() => {
                        let handlers = {};
                        if (imgs.length > 1) {
                            let touchStartX = 0;
                            handlers = {
                                onTouchStart: e => touchStartX = e.touches[0].clientX,
                                onTouchEnd: e => {
                                    const diffX = e.changedTouches[0].clientX - touchStartX;
                                    if (diffX > 50) setIsLightboxOpen((prev) => (prev - 1 + imgs.length) % imgs.length);
                                    else if (diffX < -50) setIsLightboxOpen((prev) => (prev + 1) % imgs.length);
                                }
                            };
                        }
                        return (
                            <div className="relative w-full h-full flex items-center justify-center" {...handlers}>
                                {imgs.length > 1 && (
                                    <>
                                        <button onClick={(e) => { e.stopPropagation(); setIsLightboxOpen((prev) => (prev - 1 + imgs.length) % imgs.length); }} className="absolute left-4 md:left-12 top-1/2 -translate-y-1/2 text-white p-4 hover:scale-110 transition-transform z-[210] md:hidden"><ChevronLeft size={32} strokeWidth={1} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); setIsLightboxOpen((prev) => (prev + 1) % imgs.length); }} className="absolute right-4 md:right-12 top-1/2 -translate-y-1/2 text-white p-4 hover:scale-110 transition-transform z-[210] md:hidden"><ChevronRight size={32} strokeWidth={1} /></button>
                                    </>
                                )}
                                <div className="hidden md:flex absolute inset-0 items-center justify-center z-[210]">
                                    {imgs.length > 1 && (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); setIsLightboxOpen((prev) => (prev - 1 + imgs.length) % imgs.length); }} className="absolute left-8 top-1/2 -translate-y-1/2 text-white text-6xl p-8 hover:scale-110 transition-transform z-[220]">&#8249;</button>
                                            <button onClick={(e) => { e.stopPropagation(); setIsLightboxOpen((prev) => (prev + 1) % imgs.length); }} className="absolute right-8 top-1/2 -translate-y-1/2 text-white text-6xl p-8 hover:scale-110 transition-transform z-[220]">&#8250;</button>
                                        </>
                                    )}
                                </div>
                                <img
                                    src={imgs[isLightboxOpen]}
                                    loading="lazy"
                                    decoding="async"
                                    className="max-w-full max-h-[85vh] object-contain shadow-2xl transition-all duration-300 pointer-events-none z-[210]"
                                    alt=""
                                />
                            </div>
                        );
                    })()}
                </div>
                );
            })()}
        </div>
    );
}