import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, doc, increment, serverTimestamp, onSnapshot } from "firebase/firestore";
import { FileText, Tag, Filter, Search, Info, Hand } from 'lucide-react';

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

const app = initializeApp(firebaseConfig);
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

const ANGEBOT_SOMMER = [
    { id: "s1", title: "Hochtouren", desc: "Von einfachen Gletschertrekkings bis zu den grossen 4000ern.", image: "/hochtour.jpg", longDesc: "Erlebe die Welt der Gletscher und Viertausender. Ob Einsteiger-Tour oder technischer Gipfel – wir führen dich sicher auf die höchsten Punkte der Alpen." },
    { id: "s2", title: "Alpinklettern", desc: "In den besten Granit- und Kalkwänden der Schweiz.", image: "/alpinklettern.jpg", longDesc: "Mehrseillängen-Träume in bestem Fels. Von der Furka bis ins Bergell – wir finden die perfekte Linie für dein Level." },
    { id: "s3", title: "Kletterkurse", desc: "Vom ersten Griff in der Halle bis zum Vorstieg im Fels.", image: "/kletterkurs.jpg", longDesc: "Sicherheit steht an erster Stelle. Wir vermitteln dir das nötige Know-how in Seiltechnik, Standplatzbau und Vorstiegstaktik." },
    { id: "s4", title: "Gratüberschreitungen", desc: "Luftige Grate und endlose Aussichten.", image: "/grat.jpg", longDesc: "Die eleganteste Art, einen Gipfel zu besteigen. Klassiker wie der Eiger- oder Biancograt warten auf dich." }
];

const ANGEBOT_WINTER = [
    { id: "w1", title: "Skitouren", desc: "Unberührter Pulverschnee und einsame Gipfelerlebnisse.", image: "/skitour.jpg", longDesc: "Vom Berner Oberland bis ins Wallis – wir finden für dich den besten Powder und unverspurte Hänge fernab der Massen." },
    { id: "w2", title: "Eisklettern", desc: "Die faszinierende Welt der gefrorenen Wasserfälle.", image: "/eisklettern.jpg", longDesc: "Steile Eiszapfen und blaues Eis. Wir zeigen dir die richtige Schlagtechnik und den Standplatzbau." },
    { id: "w3", title: "Freeriden", desc: "Die besten Lines in den Alpen mit Fokus auf Sicherheit.", image: "/freeride.jpg", longDesc: "Maximale Abfahrt bei minimalem Aufstieg. Wir nutzen die Bergbahnen und zeigen dir die versteckten Runs." },
    { id: "w4", title: "Lawinenkurse", desc: "Fundiertes Wissen für deine Sicherheit im Backcountry.", image: "/lawine.jpg", longDesc: "Prävention, Beobachtung und Rettung. Ein essenzieller Kurs für alle, die sich im Winter abseits der Pisten bewegen." }
];

const getKat = (t) => t.kategorie || (t.title.toLowerCase().includes('kurs') ? 'Kurse' : t.title.toLowerCase().includes('ski') ? 'Skitour' : t.title.toLowerCase().includes('klett') ? 'Klettern' : 'Hochtour');
const getTech = (t) => t.technik ? Number(t.technik) : 2;
const getAusd = (t) => t.ausdauer ? Number(t.ausdauer) : 2;

const techDetails = {
    1: "Einfach – Keine besonderen technischen Vorkenntnisse nötig. Trittsicherheit auf Bergwegen reicht aus.",
    2: "Mittel – Schwindelfreiheit erforderlich. Leichte Kletterstellen oder steileres Gelände können vorkommen.",
    3: "Schwer – Sehr gute Klettertechnik, absolute Schwindelfreiheit und sicheres Gehen in exponiertem Gelände zwingend."
};
const ausdDetails = {
    1: "Einfach – Gemütliches Tempo, Gehzeiten von bis zu 4 Stunden pro Tag mit ausreichend Pausen.",
    2: "Mittel – Gute Grundkondition erforderlich. Gehzeiten von 4 bis 7 Stunden pro Tag.",
    3: "Schwer – Sehr gute Kondition für lange, anstrengende Etappen mit über 7 Stunden Gehzeit pro Tag."
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
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                {children ? children : <p className="text-zinc-600 leading-relaxed font-light text-sm whitespace-pre-line pb-4">{content}</p>}
            </div>
        </div>
    );
};

export default function PublicWebsite({ touren = [], onGoToAdmin }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [angebotTab, setAngebotTab] = useState('sommer');
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
    
    const [isAllToursModalOpen, setIsAllToursModalOpen] = useState(false);
    const [isIdeenBoardOpen, setIsIdeenBoardOpen] = useState(false);
    const [filterKategorie, setFilterKategorie] = useState('Alle');
    const [filterTechnik, setFilterTechnik] = useState('Alle');
    const [filterAusdauer, setFilterAusdauer] = useState('Alle');
    const [showLevelInfo, setShowLevelInfo] = useState(false);

    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [hasScrolledGallery, setHasScrolledGallery] = useState(false);

    const visibleTours = touren.filter(t => t.visible !== false && t.isExample !== true);
    const exampleTours = touren.filter(t => t.isExample === true);
    const recentTours = visibleTours.slice(0, 3);

    const visibleTeamProfiles = teamProfiles.filter(t => t.visible !== false);
    const activeTeamAttributes = teamAttributes.length > 0 ? teamAttributes : ['Superkraft', 'Kryptonit', 'Touren-Snack', 'Lebensmotto'];

    const filteredTours = visibleTours.filter(t => {
        if (filterKategorie !== 'Alle' && getKat(t) !== filterKategorie) return false;
        if (filterTechnik !== 'Alle' && getTech(t) !== parseInt(filterTechnik)) return false;
        if (filterAusdauer !== 'Alle' && getAusd(t) !== parseInt(filterAusdauer)) return false;
        return true;
    });
    
    const filteredExampleTours = exampleTours.filter(t => {
        if (filterKategorie !== 'Alle' && getKat(t) !== filterKategorie) return false;
        return true;
    });

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 100);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    
    useEffect(() => {
        const unsub1 = onSnapshot(collection(db, 'team_profiles'), snap => {
            setTeamProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsub2 = onSnapshot(doc(db, 'settings', 'team_attributes'), snap => {
            if (snap.exists() && snap.data().labels) setTeamAttributes(snap.data().labels);
        });
        return () => { unsub1(); unsub2(); };
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
    }, [touren, teamProfiles, angebotTab, isAllToursModalOpen, isIdeenBoardOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isLightboxOpen === null || (!selectedTour && !selectedTeamMember)) return;
            const activeItem = selectedTour || selectedTeamMember;
            const imgs = activeItem.images || (activeItem.image ? [activeItem.image] : []);
            if (imgs.length <= 1) return;
            if (e.key === 'ArrowRight') setIsLightboxOpen((prev) => (prev + 1) % imgs.length);
            else if (e.key === 'ArrowLeft') setIsLightboxOpen((prev) => (prev - 1 + imgs.length) % imgs.length);
            else if (e.key === 'Escape') setIsLightboxOpen(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLightboxOpen, selectedTour, selectedTeamMember]);

    useEffect(() => {
        if (isLightboxOpen !== null && window.innerWidth < 768) {
            setHasScrolledGallery(false);
            setTimeout(() => {
                const el = document.getElementById(`gallery-img-${isLightboxOpen}`);
                if (el) el.scrollIntoView({ behavior: 'instant', inline: 'center' });
            }, 50);
        }
    }, [isLightboxOpen]);

    const handleAnfrage = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const thema = selectedAngebot ? selectedAngebot.title : 'Allgemeine Anfrage';
        
        const data = {
            thema: thema,
            vorname: fd.get('vorname'), name: fd.get('name'), email: fd.get('email'),
            nachricht: fd.get('nachricht'), timestamp: serverTimestamp()
        };

        try {
            await addDoc(collection(db, 'anfragen'), data);
            const emailjs = await loadEmailJS();
            await emailjs.send(
                "service_b02rsz7", "template_ewn7qhm", 
                { vorname: data.vorname, name: data.name, email: data.email, thema: data.thema, nachricht: data.nachricht }
            );
            setBookingStatus("Anfrage erfolgreich gesendet! Wir melden uns bald.");
            setTimeout(() => { setSelectedAngebot(null); setBookingStatus(null); }, 3000);
        } catch (err) { alert("Fehler beim Senden der Anfrage. Bitte versuche es später erneut."); }
    };

    const handleIdeaInquiry = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        const fd = new FormData(e.target);
        
        const data = {
            thema: `Idee: ${selectedTour.title}`,
            vorname: fd.get('vorname'), name: fd.get('name'), email: fd.get('email'),
            nachricht: fd.get('nachricht'), timestamp: serverTimestamp()
        };

        try {
            await addDoc(collection(db, 'anfragen'), data);
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

        const data = {
            tourId: selectedTour.id, tourTitle: selectedTour.title,
            name: fd.get('name'), vorname: fd.get('vorname'), adresse: fd.get('adresse'),
            plz_ort: `${fd.get('plz')} ${fd.get('ort')}`, email: fd.get('email'), phone: fd.get('phone'),
            geburtstag: fd.get('geburtstag'), ernaehrung: fd.get('ernaehrung'), besonderes: fd.get('besonderes'),
            timestamp: serverTimestamp()
        };

        try {
            if (!selectedTour.id.startsWith('mock-')) {
                await addDoc(collection(db, 'anmeldungen'), data);
                await updateDoc(doc(db, 'touren', selectedTour.id), { angemeldet: increment(1) });
                
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
                    <video autoPlay muted loop playsInline preload="auto" onCanPlay={() => setIsVideoLoaded(true)} onLoadedData={() => setIsVideoLoaded(true)} className={`absolute inset-0 w-full h-full object-cover grayscale transition-opacity duration-1000 ${isVideoLoaded ? 'opacity-60' : 'opacity-0'}`}>
                        <source src="/hero-video.mp4" type="video/mp4" />
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
                            <div className="flex justify-center space-x-12 text-sm md:text-base font-semibold uppercase tracking-widest">
                                <button onClick={() => setAngebotTab('sommer')} className={`pb-2 opacity-40 transition-all ${angebotTab === 'sommer' ? 'border-b-2 border-black opacity-100' : ''}`}>Sommer</button>
                                <button onClick={() => setAngebotTab('winter')} className={`pb-2 opacity-40 transition-all ${angebotTab === 'winter' ? 'border-b-2 border-black opacity-100' : ''}`}>Winter</button>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {(angebotTab === 'sommer' ? ANGEBOT_SOMMER : ANGEBOT_WINTER).map((item, i) => (
                            <div key={i} onClick={() => setSelectedAngebot(item)} className="p-8 border border-zinc-100 bg-[#fdfdfc] cursor-pointer hover:border-black transition-all group flex flex-col justify-between min-h-[250px]">
                                <div>
                                    <h3 className="serif text-xl italic mb-4 group-hover:translate-x-1 transition-transform">{item.title}</h3>
                                    <p className="text-zinc-500 text-xs leading-relaxed font-light">{item.desc}</p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-zinc-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-[8px] uppercase tracking-widest text-zinc-400">Details & Anfrage →</p>
                                </div>
                            </div>
                        ))}
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
                                                    <DifficultyDots label="Technik" level={getTech(tour)} info="1 = Einfach | 2 = Mittel | 3 = Schwer" />
                                                    <DifficultyDots label="Ausdauer" level={getAusd(tour)} info="1 = Einfach | 2 = Mittel | 3 = Schwer" />
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

                <section id="kollektiv" className="py-40 px-6 bg-white">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-24"><h2 className="serif text-4xl italic">Das Kollektiv</h2></div>
                        <div className="grid md:grid-cols-3 gap-16 md:gap-8 lg:gap-16">
                            {visibleTeamProfiles.map((member, i) => (
                                <div key={i} onClick={() => setSelectedTeamMember(member)} className="text-center flex flex-col items-center group cursor-pointer">
                                    <div className="team-img-container aspect-[4/5] w-full bg-zinc-100 mb-10 overflow-hidden relative">
                                        <img src={(member.images || [member.image])[0] || '/adrian.jpg'} alt={member.name} loading="lazy" decoding="async" className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000" />
                                    </div>
                                    <div className="space-y-4 max-w-[280px]">
                                        <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] group-hover:text-zinc-500 transition-colors">{member.name}</h3>
                                        <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-400 font-medium">{member.title}</p>
                                        <div className="h-px w-8 bg-zinc-200 mx-auto my-6"></div>
                                        <p className="text-zinc-500 text-[10px] leading-loose font-light tracking-wide uppercase line-clamp-3">{member.desc}</p>
                                        <div className="pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[8px] uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-1">Steckbrief ansehen</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <footer id="kontakt" className="py-32 md:py-48 bg-[#f9f9f7] border-t border-zinc-100 px-6">
                    <div className="max-w-7xl mx-auto flex flex-col items-center">
                        <p className="uppercase tracking-[0.5em] text-[10px] mb-12 opacity-50 text-center">Kontaktiere uns</p>
                        <a href="mailto:hallo@bergkollektiv.ch" className="serif text-3xl md:text-6xl italic hover:text-zinc-400 transition-colors duration-500 block text-center mb-20">hallo@bergkollektiv.ch</a>
                        <div className="w-full grid md:grid-cols-3 gap-12 items-center">
                            <div className="flex flex-col items-center md:items-start space-y-6">
                                <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className="footer-icon-link flex items-center gap-4 group">
                                    <Instagram size={20} /> <span className="text-[9px] uppercase tracking-widest font-bold border-b border-transparent group-hover:border-black">Instagram</span>
                                </a>
                                <a href="/agb.pdf" target="_blank" rel="noreferrer" className="footer-icon-link flex items-center gap-4 group">
                                    <FileText size={20} /> <span className="text-[9px] uppercase tracking-widest font-bold border-b border-transparent group-hover:border-black">Allgemeine Geschäftsbedingungen</span>
                                </a>
                                <a href="/tarife.pdf" target="_blank" rel="noreferrer" className="footer-icon-link flex items-center gap-4 group">
                                    <Tag size={20} /> <span className="text-[9px] uppercase tracking-widest font-bold border-b border-transparent group-hover:border-black">Allgemeine Tarife</span>
                                </a>
                            </div>
                            <div className="flex flex-col items-center space-y-4">
                                <img src="/Logo IVBV negativ.svg" alt="IVBV Logo" loading="lazy" decoding="async" className="h-20 w-auto object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-500" />
                                <p className="text-[8px] uppercase tracking-[0.3em] text-zinc-400 text-center">Internationaler Verband der<br/>Bergführervereinigungen</p>
                            </div>
                            <div className="flex flex-col items-center md:items-end text-center md:text-right space-y-2">
                                <div className="text-lg tracking-[0.3em] uppercase mb-4">BERG <span className="font-bold">KOLLEKTIV</span></div>
                                <p className="text-[8px] uppercase tracking-widest text-zinc-400">&copy; 2026 Berg Kollektiv<br/>Alle Rechte vorbehalten.</p>
                                <button onClick={() => { onGoToAdmin && onGoToAdmin(); window.scrollTo(0,0); }} className="mt-6 text-[8px] uppercase tracking-[0.2em] text-zinc-300 hover:text-black transition-colors md:hidden">— Admin Login —</button>
                            </div>
                        </div>
                    </div>
                </footer>
            </main>

            {/* =========================================
                MODAL: ALLE TOUREN & FILTER 
               ========================================= */}
            {isAllToursModalOpen && (
                <div className="fixed inset-0 z-[150] flex flex-col bg-[#f9f9f7] overflow-y-auto fade-in">
                    
                    <div className="p-6 md:px-12 md:py-8 flex justify-between items-center bg-white border-b border-zinc-200 sticky top-0 z-20">
                        <h2 className="serif text-3xl md:text-4xl italic">Tourenübersicht</h2>
                        <button onClick={() => setIsAllToursModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-zinc-100 hover:bg-black hover:text-white rounded-full transition-colors text-2xl">&times;</button>
                    </div>
                    
                    <div className="p-6 md:px-12 md:py-8 bg-white border-b border-zinc-200">
                        <div className="max-w-7xl mx-auto">
                            <div className="flex flex-col lg:flex-row gap-8 justify-between items-start lg:items-center">
                                <div className="flex flex-col sm:flex-row gap-6">
                                    <div className="flex items-center gap-3">
                                        <Filter size={16} className="text-zinc-400" />
                                        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Kategorie</span>
                                        <select value={filterKategorie} onChange={e => setFilterKategorie(e.target.value)} className="border-b border-zinc-300 py-2 text-xs outline-none bg-transparent cursor-pointer font-medium focus:border-black">
                                            <option value="Alle">Alle Kategorien</option>
                                            <option value="Kurse">Kurse</option>
                                            <option value="Klettern">Klettern</option>
                                            <option value="Skitour">Skitour</option>
                                            <option value="Hochtour">Hochtour</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Technik</span>
                                        <select value={filterTechnik} onChange={e => setFilterTechnik(e.target.value)} className="border-b border-zinc-300 py-2 text-xs outline-none bg-transparent cursor-pointer font-medium focus:border-black">
                                            <option value="Alle">Alle Level</option>
                                            <option value="1">1 - Einfach</option>
                                            <option value="2">2 - Mittel</option>
                                            <option value="3">3 - Schwer</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Ausdauer</span>
                                        <select value={filterAusdauer} onChange={e => setFilterAusdauer(e.target.value)} className="border-b border-zinc-300 py-2 text-xs outline-none bg-transparent cursor-pointer font-medium focus:border-black">
                                            <option value="Alle">Alle Level</option>
                                            <option value="1">1 - Einfach</option>
                                            <option value="2">2 - Mittel</option>
                                            <option value="3">3 - Schwer</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={() => setShowLevelInfo(!showLevelInfo)} 
                                    className={`flex items-center gap-2 px-4 py-2 border transition-colors text-[10px] uppercase tracking-widest font-bold ${showLevelInfo ? 'bg-black text-white border-black' : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100 hover:text-black'}`}
                                >
                                    <Info size={14} /> Info Technik & Ausdauer
                                </button>
                            </div>
                            
                            {showLevelInfo && (
                                <div className="mt-6 p-6 md:p-8 bg-[#f9f9f7] border border-zinc-200 text-xs font-light leading-relaxed relative fade-in">
                                    <button onClick={() => setShowLevelInfo(false)} className="absolute top-4 right-4 text-2xl text-zinc-400 hover:text-black leading-none">&times;</button>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-black mb-4 border-b border-zinc-200 pb-2">Level Technik</h4>
                                            <ul className="space-y-3 text-zinc-600">
                                                <li><span className="font-bold text-black">Level 1:</span> {techDetails[1]}</li>
                                                <li><span className="font-bold text-black">Level 2:</span> {techDetails[2]}</li>
                                                <li><span className="font-bold text-black">Level 3:</span> {techDetails[3]}</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-black mb-4 border-b border-zinc-200 pb-2">Level Ausdauer</h4>
                                            <ul className="space-y-3 text-zinc-600">
                                                <li><span className="font-bold text-black">Level 1:</span> {ausdDetails[1]}</li>
                                                <li><span className="font-bold text-black">Level 2:</span> {ausdDetails[2]}</li>
                                                <li><span className="font-bold text-black">Level 3:</span> {ausdDetails[3]}</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-6 md:p-12 max-w-7xl mx-auto w-full">
                        {filteredTours.length > 0 ? (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16">
                                {filteredTours.map(tour => (
                                    <div key={tour.id} className="tour-card group cursor-pointer bg-white p-6 shadow-sm hover:shadow-xl transition-all border border-transparent hover:border-zinc-200" onClick={() => { setSelectedTour(tour); setIsBookingMode(false); setIsInquiryMode(false); }}>
                                        <div className="aspect-[4/3] overflow-hidden bg-zinc-100 mb-6 relative">
                                            <img src={tour.image} loading="lazy" decoding="async" className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000" alt={tour.title} />
                                            <div className="absolute top-4 right-4 bg-white/95 px-3 py-1.5 text-[8px] uppercase tracking-[0.2em] font-bold">
                                                {tour.maxPlaetze - tour.angemeldet > 0 ? `${tour.maxPlaetze - tour.angemeldet} Plätze` : 'Voll'}
                                            </div>
                                            <div className="absolute top-4 left-4 bg-black text-white px-3 py-1.5 text-[8px] uppercase tracking-[0.2em] font-bold">
                                                {getKat(tour)}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-2">{tour.date}</p>
                                            <h3 className="text-xl font-medium mb-4 uppercase">{tour.title}</h3>
                                            <div className="flex justify-between items-end border-t border-zinc-100 pt-4 mt-4">
                                                <p className="text-zinc-700 text-sm font-bold pb-1">{tour.price}</p>
                                                <div className="flex flex-col gap-1.5 items-end">
                                                    <DifficultyDots label="Technik" level={getTech(tour)} info="1 = Einfach | 2 = Mittel | 3 = Schwer" />
                                                    <DifficultyDots label="Ausdauer" level={getAusd(tour)} info="1 = Einfach | 2 = Mittel | 3 = Schwer" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-32 text-zinc-400">
                                <Filter size={48} className="mx-auto mb-6 opacity-20" />
                                <p className="text-lg uppercase tracking-widest">Keine Touren für diese Filterkombination gefunden.</p>
                                <button onClick={() => { setFilterKategorie('Alle'); setFilterTechnik('Alle'); setFilterAusdauer('Alle'); }} className="mt-8 border-b border-black text-black text-[10px] uppercase tracking-widest pb-1 hover:text-zinc-500 transition-colors">Filter zurücksetzen</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* =========================================
                MODAL IDEEN-BOARD (Beispieltouren)
               ========================================= */}
            {isIdeenBoardOpen && (
                <div className="fixed inset-0 z-[150] flex flex-col bg-[#f9f9f7] overflow-y-auto fade-in">
                    <div className="p-6 md:px-12 md:py-8 flex justify-between items-center bg-white border-b border-zinc-200 sticky top-0 z-20">
                        <h2 className="serif text-3xl md:text-4xl italic">Touren Ideen & Inspiration</h2>
                        <button onClick={() => setIsIdeenBoardOpen(false)} className="w-12 h-12 flex items-center justify-center bg-zinc-100 hover:bg-black hover:text-white rounded-full transition-colors text-2xl">&times;</button>
                    </div>
                    
                    <div className="p-6 md:px-12 md:py-8 bg-white border-b border-zinc-200">
                        <div className="max-w-7xl mx-auto flex flex-wrap gap-4 items-center">
                            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mr-4">Filter:</span>
                            {['Alle', 'Hochtour', 'Skitour', 'Klettern', 'Kurse'].map(kat => (
                                <button key={kat} onClick={() => setFilterKategorie(kat)} className={`px-4 py-2 text-[10px] uppercase tracking-widest transition-colors font-bold ${filterKategorie === kat ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}>
                                    {kat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 md:p-12 max-w-7xl mx-auto w-full">
                        {filteredExampleTours.length > 0 ? (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16">
                                {filteredExampleTours.map(tour => (
                                    <div key={tour.id} className="tour-card group cursor-pointer bg-white p-6 shadow-sm hover:shadow-xl transition-all border border-transparent hover:border-zinc-200" onClick={() => { setSelectedTour(tour); setIsBookingMode(false); setIsInquiryMode(false); }}>
                                        <div className="aspect-[4/3] overflow-hidden bg-zinc-100 mb-6 relative">
                                            <img src={tour.image} loading="lazy" decoding="async" className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000" alt={tour.title} />
                                            <div className="absolute top-4 left-4 bg-black text-white px-3 py-1.5 text-[8px] uppercase tracking-[0.2em] font-bold">
                                                {getKat(tour)}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-medium mb-4 uppercase">{tour.title}</h3>
                                            <div className="flex justify-end items-end border-t border-zinc-100 pt-4 mt-4">
                                                <div className="flex flex-col gap-1.5 items-end">
                                                    <DifficultyDots label="Technik" level={getTech(tour)} info="1 = Einfach | 2 = Mittel | 3 = Schwer" />
                                                    <DifficultyDots label="Ausdauer" level={getAusd(tour)} info="1 = Einfach | 2 = Mittel | 3 = Schwer" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-32 text-zinc-400">
                                <p className="text-lg uppercase tracking-widest">Keine Ideen für diese Kategorie gefunden.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* =========================================
                MODAL FÜR ANGEBOTE
               ========================================= */}
            {selectedAngebot && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center md:p-8">
                    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md" onClick={() => setSelectedAngebot(null)}></div>
                    
                    <div className="relative bg-white w-full max-w-[100vw] lg:max-w-7xl h-full md:h-[95vh] md:shadow-2xl flex flex-col md:flex-row overflow-y-auto md:overflow-hidden fade-in">
                        
                        <div className="w-full md:w-1/2 h-[60vh] md:h-full relative flex-shrink-0 bg-black group flex flex-col">
                            <img src={selectedAngebot.image} loading="lazy" decoding="async" className="w-full h-full object-cover" alt="" />
                            
                            <div className="absolute inset-x-0 bottom-0 h-48 z-[20] flex flex-col justify-end pointer-events-none">
                                <div className="absolute inset-0 backdrop-blur-[8px] [mask-image:linear-gradient(to_bottom,transparent,black)]"></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-[21]"></div>
                                <div className="relative z-[30] p-6 md:p-10">
                                    <h2 className="serif text-3xl md:text-5xl lg:text-6xl italic text-white leading-tight">{selectedAngebot.title}</h2>
                                </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedAngebot(null); }} className="md:hidden fixed top-4 right-4 text-white text-3xl z-[60] bg-black/40 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md pointer-events-auto">&times;</button>
                        </div>
                        
                        <div className="w-full md:w-1/2 h-auto md:h-full md:overflow-y-auto bg-white relative z-10 flex flex-col">
                            <button onClick={() => { setSelectedAngebot(null); }} className="hidden md:flex absolute top-6 right-6 text-zinc-400 hover:text-black text-4xl z-10 transition-colors w-12 h-12 items-center justify-center bg-zinc-50 hover:bg-zinc-100 rounded-full">&times;</button>
                            
                            <div className="p-6 md:p-10 lg:p-16 flex-1 flex flex-col">
                                {bookingStatus ? ( <div className="text-center py-12 serif italic text-xl flex-1 flex flex-col items-center justify-center"><div className="text-4xl mb-6">✓</div>{bookingStatus}</div> ) : (
                                    <div className="space-y-10 flex-1 flex flex-col">
                                        <p className="text-zinc-600 text-base leading-relaxed font-light">{selectedAngebot.longDesc}</p>
                                        
                                        <div className="bg-[#f9f9f7] p-6 md:p-8 border border-zinc-100 flex flex-col items-center text-center mt-6">
                                            <h3 className="serif text-2xl italic mb-3">Benötigst du Ideen?</h3>
                                            <p className="text-xs text-zinc-500 mb-6">Lass dich von unseren Tourenvorschlägen im Bereich {selectedAngebot.title} inspirieren.</p>
                                            <button onClick={() => { 
                                                setSelectedAngebot(null); 
                                                setFilterKategorie(selectedAngebot.title.includes('Klett') ? 'Klettern' : (selectedAngebot.title.includes('Hoch') ? 'Hochtour' : (selectedAngebot.title.includes('Ski') ? 'Skitour' : 'Alle')));
                                                setIsIdeenBoardOpen(true); 
                                            }} className="border border-black px-8 py-3 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black hover:text-white transition-all w-full">
                                                Zu den Touren-Ideen
                                            </button>
                                        </div>

                                        <form onSubmit={handleAnfrage} className="space-y-6 pt-8 border-t border-zinc-100 mt-auto">
                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Oder direkt eine Anfrage senden:</h4>
                                            <div className="grid grid-cols-2 gap-6">
                                                <input name="vorname" placeholder="VORNAME" required className="border-b p-2 text-xs outline-none focus:border-black transition-colors bg-transparent" />
                                                <input name="name" placeholder="NAME" required className="border-b p-2 text-xs outline-none focus:border-black transition-colors bg-transparent" />
                                            </div>
                                            <input name="email" type="email" placeholder="EMAIL" required className="w-full border-b p-2 text-xs outline-none focus:border-black transition-colors bg-transparent" />
                                            <textarea name="nachricht" placeholder="DEINE NACHRICHT..." required className="w-full border-b p-2 text-xs outline-none focus:border-black transition-colors bg-transparent h-28 resize-y" />
                                            <button type="submit" className="w-full bg-black text-white py-5 text-[9px] font-bold uppercase tracking-[0.4em] hover:bg-zinc-800 transition-all shadow-xl">Anfrage Senden</button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================
                MODAL FÜR BERGFÜHRER
               ========================================= */}
            {selectedTeamMember && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center md:p-8">
                    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md" onClick={() => setSelectedTeamMember(null)}></div>
                    
                    <div className="relative bg-white w-full max-w-[100vw] lg:max-w-7xl h-full md:h-[95vh] md:shadow-2xl flex flex-col md:flex-row overflow-y-auto md:overflow-hidden fade-in">
                        
                        <div className="w-full md:w-1/2 h-[60vh] md:h-full relative flex-shrink-0 bg-black group flex flex-col">
                            
                            <div className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory hide-scrollbar z-10 scroll-smooth" onScroll={() => setHasScrolledGallery(true)}>
                                {(selectedTeamMember.images || (selectedTeamMember.image ? [selectedTeamMember.image] : [])).map((img, idx) => (
                                    <div key={idx} onClick={() => setIsLightboxOpen(idx)} className="relative w-full h-full flex-shrink-0 snap-start cursor-pointer">
                                        <img src={img} loading="lazy" decoding="async" className="w-full h-full object-cover" alt="" />
                                    </div>
                                ))}
                            </div>
                            
                            <div className="hidden md:flex absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors duration-500 z-[25] pointer-events-none items-center justify-center">
                                <span className="bg-black/60 backdrop-blur-md text-white px-6 py-3 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0">
                                    <Search size={14}/> Bilder ansehen
                                </span>
                            </div>

                            <div className="absolute inset-x-0 bottom-0 h-48 z-[20] flex flex-col justify-end pointer-events-none">
                                <div className="absolute inset-0 backdrop-blur-[8px] [mask-image:linear-gradient(to_bottom,transparent,black)]"></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-[21]"></div>
                                <div className="relative z-[30] p-6 md:p-10">
                                    <p className="text-[10px] uppercase tracking-widest text-white/80 font-bold mb-2">{selectedTeamMember.title}</p>
                                    <h2 className="serif text-3xl md:text-5xl lg:text-6xl italic text-white leading-tight">{selectedTeamMember.name}</h2>
                                </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedTeamMember(null); }} className="md:hidden fixed top-4 right-4 text-white text-3xl z-[60] bg-black/40 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md pointer-events-auto">&times;</button>
                        </div>
                        
                        <div className="w-full md:w-1/2 h-auto md:h-full md:overflow-y-auto bg-white relative z-10 flex flex-col">
                            <button onClick={() => setSelectedTeamMember(null)} className="hidden md:flex absolute top-6 right-6 text-zinc-400 hover:text-black text-4xl z-10 transition-colors w-12 h-12 items-center justify-center bg-zinc-50 hover:bg-zinc-100 rounded-full">&times;</button>
                            
                            <div className="p-6 md:p-10 lg:p-16 flex-1 flex flex-col">
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 pb-2 border-b border-zinc-100 text-zinc-400">Steckbrief</h3>
                                <p className="text-zinc-600 leading-relaxed font-light text-base whitespace-pre-line mb-8">{selectedTeamMember.desc}</p>
                                
                                <div className="space-y-6 pt-4 border-t border-zinc-100 flex-1">
                                    {activeTeamAttributes.map(attr => {
                                        const val = selectedTeamMember.customFields?.[attr] || getLegacyTeamField(selectedTeamMember, attr);
                                        if (!val) return null;
                                        return (
                                            <div key={attr} className="grid grid-cols-12 gap-4 border-b border-zinc-100 pb-4">
                                                <span className="col-span-12 md:col-span-4 text-[9px] uppercase tracking-widest font-bold text-zinc-400">{attr}</span>
                                                <span className="col-span-12 md:col-span-8 text-xs text-zinc-700 leading-relaxed whitespace-pre-line">{val}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================
                GROSSES TOUR DETAIL MODAL
               ========================================= */}
            {selectedTour && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center md:p-8">
                    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md" onClick={() => setSelectedTour(null)}></div>
                    
                    <div className="relative bg-white w-full max-w-[100vw] lg:max-w-7xl h-full md:h-[95vh] md:shadow-2xl flex flex-col md:flex-row overflow-y-auto md:overflow-hidden fade-in">
                        
                        <div className="w-full md:w-1/2 h-[60vh] md:h-full relative flex-shrink-0 bg-black group flex flex-col">
                            
                            {/* Main Detail Image Slider (100% breite, kein Wisch-Hinweis) */}
                            <div className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory hide-scrollbar z-10 scroll-smooth">
                                {(selectedTour.images || [selectedTour.image]).map((img, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setIsLightboxOpen(idx)}
                                        className="relative w-full h-full flex-shrink-0 snap-start cursor-pointer" 
                                    >
                                        <img src={img} loading="lazy" decoding="async" className="w-full h-full object-cover" alt="" />
                                    </div>
                                ))}
                            </div>
                            
                            {/* Hover Overlay Desktop */}
                            <div className="hidden md:flex absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors duration-500 z-[25] pointer-events-none items-center justify-center">
                                <span className="bg-black/60 backdrop-blur-md text-white px-6 py-3 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0">
                                    <Search size={14}/> Galerie öffnen
                                </span>
                            </div>

                            <div className="absolute inset-x-0 bottom-0 h-48 z-[20] flex flex-col justify-end pointer-events-none">
                                <div className="absolute inset-0 backdrop-blur-[8px] [mask-image:linear-gradient(to_bottom,transparent,black)]"></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-[21]"></div>
                                <div className="relative z-[30] p-6 md:p-10">
                                    <div className="flex gap-3 items-center mb-3">
                                        <span className="bg-white text-black px-2 py-1 text-[8px] uppercase tracking-widest font-bold">{getKat(selectedTour)}</span>
                                        {selectedTour.isExample && <span className="bg-blue-500 text-white px-2 py-1 text-[8px] uppercase tracking-widest font-bold">Idee</span>}
                                    </div>
                                    <h2 className="serif text-3xl md:text-5xl lg:text-6xl italic text-white leading-tight">{selectedTour.title}</h2>
                                </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedTour(null); setIsInquiryMode(false); }} className="md:hidden fixed top-4 right-4 text-white text-3xl z-[60] bg-black/40 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md pointer-events-auto">&times;</button>
                        </div>
                        
                        <div className="w-full md:w-1/2 h-auto md:h-full md:overflow-y-auto bg-white relative z-10 flex flex-col">
                            <button onClick={() => { setSelectedTour(null); setIsInquiryMode(false); }} className="hidden md:flex absolute top-6 right-6 text-zinc-400 hover:text-black text-4xl z-10 transition-colors w-12 h-12 items-center justify-center bg-zinc-50 hover:bg-zinc-100 rounded-full">&times;</button>
                            
                            <div className="p-6 md:p-10 lg:p-16 flex-1 flex flex-col">
                                {!isBookingMode && !isInquiryMode ? (
                                    <div className="fade-in space-y-12 flex-1 flex flex-col">
                                        
                                        <div className="space-y-8 flex-1">
                                            <div>
                                                <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4 pb-2 border-b border-zinc-100 text-zinc-400">Beschreibung</h3>
                                                <p className="text-zinc-600 leading-relaxed font-light text-base whitespace-pre-line">{selectedTour.description}</p>
                                            </div>
                                            
                                            <div className="space-y-0 mt-8 border-t border-zinc-100 pt-4">
                                                {(!selectedTour.isExample || selectedTour.date) && (
                                                    <Accordion title="Datum & Durchführung">
                                                        <div className="text-zinc-600 font-light text-sm pb-2">
                                                            {selectedTour.date || 'Auf Anfrage'}
                                                            {selectedTour.guide && (
                                                                <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center gap-2">
                                                                    <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Voraussichtliche Leitung:</span>
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const guideProfile = teamProfiles.find(p => p.name === selectedTour.guide);
                                                                            if (guideProfile) setSelectedTeamMember(guideProfile);
                                                                        }} 
                                                                        className="font-bold underline hover:text-black text-zinc-600 transition-colors text-xs"
                                                                    >
                                                                        {selectedTour.guide}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Accordion>
                                                )}

                                                {!selectedTour.isExample && <Accordion title="Programm & Ablauf" content={selectedTour.ablauf} />}
                                                
                                                <Accordion title="Anforderungen & Level">
                                                    <div className="pb-4 space-y-6">
                                                        <div className="space-y-4 text-xs text-zinc-500 font-light leading-relaxed">
                                                            <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                                                                <div className="flex items-center gap-3 w-32 flex-shrink-0 pt-0.5">
                                                                    <span className="text-[9px] uppercase tracking-widest font-bold text-black">Technik</span>
                                                                    <div className="flex gap-1">
                                                                        {[1, 2, 3].map(i => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= getTech(selectedTour) ? 'bg-black' : 'bg-zinc-200'}`}></div>)}
                                                                    </div>
                                                                </div>
                                                                <p>{techDetails[getTech(selectedTour)]}</p>
                                                            </div>
                                                            <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                                                                <div className="flex items-center gap-3 w-32 flex-shrink-0 pt-0.5">
                                                                    <span className="text-[9px] uppercase tracking-widest font-bold text-black">Ausdauer</span>
                                                                    <div className="flex gap-1">
                                                                        {[1, 2, 3].map(i => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= getAusd(selectedTour) ? 'bg-black' : 'bg-zinc-200'}`}></div>)}
                                                                    </div>
                                                                </div>
                                                                <p>{ausdDetails[getAusd(selectedTour)]}</p>
                                                            </div>
                                                        </div>
                                                        {selectedTour.anforderungen && (
                                                            <div className="pt-4 border-t border-zinc-100">
                                                                <p className="text-zinc-600 font-light text-sm whitespace-pre-line">{selectedTour.anforderungen}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </Accordion>
                                            </div>
                                            
                                            {!selectedTour.isExample && (
                                                <div className="grid md:grid-cols-2 gap-6 pt-4">
                                                    <div className="p-6 bg-[#f9f9f7] border border-zinc-100">
                                                        <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-3">Material</p>
                                                        {selectedTour.materialUrl ? (
                                                            <a href={selectedTour.materialUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:text-zinc-500 mb-4 underline underline-offset-4">
                                                                <FileText size={16}/> {selectedTour.materialName || 'Material gemäss PDF'}
                                                            </a>
                                                        ) : (
                                                            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
                                                                <FileText size={16}/> Keine Liste hinterlegt
                                                            </span>
                                                        )}
                                                        <p className="text-xs text-zinc-500 italic leading-relaxed whitespace-pre-line">{selectedTour.material || 'Keine speziellen Ergänzungen.'}</p>
                                                    </div>
                                                    <div className="p-6 bg-[#f9f9f7] border border-zinc-100 flex flex-col justify-center">
                                                        <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-2">Preis & Leistungen</p>
                                                        <p className="serif text-3xl italic mb-3">{selectedTour.price}</p>
                                                        <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-line">{selectedTour.leistungen || 'Führung durch dipl. Bergführer.'}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {selectedTour.isExample ? (
                                            <button onClick={() => setIsInquiryMode(true)} className="mt-8 w-full py-6 text-[10px] font-bold uppercase tracking-[0.2em] transition-all bg-black text-white hover:bg-zinc-800 shadow-xl">
                                                Interesse wecken / Unverbindlich anfragen
                                            </button>
                                        ) : (
                                            <button onClick={() => setIsBookingMode(true)} disabled={selectedTour.maxPlaetze <= selectedTour.angemeldet} className={`mt-8 w-full py-6 text-[10px] uppercase tracking-[0.4em] transition-all ${selectedTour.maxPlaetze <= selectedTour.angemeldet ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-black text-white hover:bg-zinc-800 shadow-xl'}`}>
                                                {selectedTour.maxPlaetze <= selectedTour.angemeldet ? 'Ausgebucht' : 'Verbindlich Anmelden'}
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="fade-in max-w-2xl mx-auto w-full">
                                        {bookingStatus ? (
                                            <div className="text-center space-y-8 py-20"><div className="text-4xl">✓</div><p className="serif text-2xl italic">{bookingStatus}</p><button onClick={() => { setSelectedTour(null); setIsBookingMode(false); setIsInquiryMode(false); }} className="text-[10px] uppercase tracking-widest border-b border-black pb-1">Zurück</button></div>
                                        ) : (
                                            isInquiryMode ? (
                                                <form onSubmit={handleIdeaInquiry} className="space-y-8">
                                                    <div className="flex justify-between items-end mb-10"><h3 className="serif text-3xl italic">Unverbindliche Anfrage</h3><button type="button" onClick={() => setIsInquiryMode(false)} className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition">Abbrechen</button></div>
                                                    <p className="text-xs text-zinc-500 mb-6">Wir freuen uns über dein Interesse an der Tour-Idee "{selectedTour.title}". Lass uns wissen, wann du Zeit hast und wir schauen die Details gemeinsam an.</p>
                                                    <div className="grid grid-cols-2 gap-8">
                                                        <div className="space-y-1 border-b border-zinc-200 pb-2"><label className="text-[8px] uppercase tracking-widest text-zinc-400">Vorname *</label><input name="vorname" required className="w-full bg-transparent outline-none text-sm" /></div>
                                                        <div className="space-y-1 border-b border-zinc-200 pb-2"><label className="text-[8px] uppercase tracking-widest text-zinc-400">Name *</label><input name="name" required className="w-full bg-transparent outline-none text-sm" /></div>
                                                    </div>
                                                    <div className="space-y-1 border-b border-zinc-200 pb-2"><label className="text-[8px] uppercase tracking-widest text-zinc-400">E-Mail *</label><input type="email" name="email" required className="w-full bg-transparent outline-none text-sm" /></div>
                                                    <div className="space-y-1 border-b border-zinc-200 pb-2"><label className="text-[8px] uppercase tracking-widest text-zinc-400">Deine Nachricht (Wunschdatum, Gruppengröße...)</label><textarea name="nachricht" rows="4" required className="w-full bg-transparent outline-none text-sm resize-y"></textarea></div>
                                                    <button type="submit" disabled={isSubmitting} className={`w-full py-6 text-[10px] font-bold uppercase tracking-[0.2em] transition-all shadow-xl ${isSubmitting ? 'bg-zinc-400 text-white cursor-not-allowed' : 'bg-black text-white hover:bg-zinc-800'}`}>
                                                        {isSubmitting ? 'Wird gesendet...' : 'Anfrage Senden'}
                                                    </button>
                                                </form>
                                            ) : (
                                                <form onSubmit={handleBooking} className="space-y-8">
                                                    <div className="flex justify-between items-end mb-10"><h3 className="serif text-3xl italic">Anmeldung</h3><button type="button" onClick={() => setIsBookingMode(false)} className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition">Abbrechen</button></div>
                                                    <div className="grid grid-cols-2 gap-8">
                                                        <div className="space-y-1 border-b border-zinc-200 pb-2"><label className="text-[8px] uppercase tracking-widest text-zinc-400">Vorname *</label><input name="vorname" required className="w-full bg-transparent outline-none text-sm" /></div>
                                                        <div className="space-y-1 border-b border-zinc-200 pb-2"><label className="text-[8px] uppercase tracking-widest text-zinc-400">Name *</label><input name="name" required className="w-full bg-transparent outline-none text-sm" /></div>
                                                    </div>
                                                    <div className="space-y-1 border-b border-zinc-200 pb-2"><label className="text-[8px] uppercase tracking-widest text-zinc-400">Adresse *</label><input name="adresse" required className="w-full bg-transparent outline-none text-sm" /></div>
                                                    <div className="grid grid-cols-2 gap-8">
                                                        <div className="grid grid-cols-3 gap-4 border-b border-zinc-200 pb-2">
                                                            <div className="col-span-1 space-y-1">
                                                                <label className="text-[8px] uppercase tracking-widest text-zinc-400">PLZ *</label>
                                                                <input name="plz" required className="w-full bg-transparent outline-none text-sm" />
                                                            </div>
                                                            <div className="col-span-2 space-y-1">
                                                                <label className="text-[8px] uppercase tracking-widest text-zinc-400">Ort *</label>
                                                                <input name="ort" required className="w-full bg-transparent outline-none text-sm" />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1 border-b border-zinc-200 pb-2">
                                                            <label className="text-[8px] uppercase tracking-widest text-zinc-400">Geburtstag *</label>
                                                            <input type="date" name="geburtstag" required className="w-full bg-transparent outline-none text-sm cursor-pointer" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-8">
                                                        <div className="space-y-1 border-b border-zinc-200 pb-2"><label className="text-[8px] uppercase tracking-widest text-zinc-400">E-Mail *</label><input type="email" name="email" required className="w-full bg-transparent outline-none text-sm" /></div>
                                                        <div className="space-y-1 border-b border-zinc-200 pb-2"><label className="text-[8px] uppercase tracking-widest text-zinc-400">Telefon *</label><input type="tel" name="phone" required className="w-full bg-transparent outline-none text-sm" /></div>
                                                    </div>
                                                    <div className="space-y-1 border-b border-zinc-200 pb-2"><label className="text-[8px] uppercase tracking-widest text-zinc-400">Ernährung (Allergien, Vegetarisch...)</label><input name="ernaehrung" className="w-full bg-transparent outline-none text-sm" /></div>
                                                    <div className="space-y-1 border-b border-zinc-200 pb-2"><label className="text-[8px] uppercase tracking-widest text-zinc-400">Besonderes / Bemerkungen</label><textarea name="besonderes" rows="2" className="w-full bg-transparent outline-none text-sm resize-none"></textarea></div>
                                                    <div className="flex items-start gap-4 py-6 group cursor-pointer">
                                                        <div className="relative flex items-center">
                                                            <input type="checkbox" id="agb_check" name="agb_accept" required className="peer appearance-none w-5 h-5 border border-zinc-300 rounded-none bg-white checked:bg-black checked:border-black transition-all cursor-pointer" />
                                                            <svg className="absolute w-3 h-3 text-white pointer-events-none hidden peer-checked:block left-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        </div>
                                                        <label htmlFor="agb_check" className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-widest cursor-pointer select-none flex-1">
                                                            Ich habe die <a href="/agb.pdf" target="_blank" rel="noreferrer" className="underline hover:text-black transition-colors" onClick={(e) => e.stopPropagation()}>allgemeinen Geschäftsbedingungen</a> gelesen und akzeptiere diese. * <span className="block mt-2 text-zinc-400 normal-case italic tracking-normal text-[11px]">Der Abschluss einer Annullationskostenversicherung wird dringend empfohlen.</span>
                                                        </label>
                                                    </div>
                                                    <button type="submit" disabled={isSubmitting} className={`w-full py-6 text-[10px] uppercase tracking-[0.4em] transition-all shadow-xl ${isSubmitting ? 'bg-zinc-400 text-white cursor-not-allowed' : 'bg-black text-white hover:bg-zinc-800'}`}>
                                                        {isSubmitting ? 'Wird gesendet...' : 'Verbindlich Anmelden'}
                                                    </button>
                                                </form>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Vollbild Lightbox mit Touch/Swipe (Kombiniert für Touren & Team) */}
            {isLightboxOpen !== null && (selectedTour || selectedTeamMember) && (() => {
                const activeItem = selectedTour || selectedTeamMember;
                const imgs = activeItem.images || (activeItem.image ? [activeItem.image] : []);
                
                return (
                <div className="fixed inset-0 z-[400] bg-black flex items-center justify-center fade-in">
                    <div className="absolute inset-0" onClick={() => setIsLightboxOpen(null)}></div>
                    <button onClick={() => setIsLightboxOpen(null)} className="absolute top-4 right-4 md:top-8 md:right-8 text-white text-4xl md:text-5xl z-[450] w-12 h-12 flex items-center justify-center bg-black/40 rounded-full md:bg-transparent md:w-auto md:h-auto">&times;</button>
                    
                    {/* --- MOBILE GALLERY (Native Scroll) --- */}
                    <div className="md:hidden absolute inset-0 flex overflow-x-auto snap-x snap-mandatory hide-scrollbar items-center z-[410]" onScroll={() => setHasScrolledGallery(true)}>
                        {(!hasScrolledGallery && imgs.length > 1) && (
                            <div className="absolute inset-0 z-[450] flex items-center justify-center pointer-events-none">
                                <div className="bg-black/70 backdrop-blur-md text-white px-6 py-3 rounded-full text-xs uppercase tracking-widest flex items-center gap-3 animate-swipe-hint">
                                    <Hand size={18}/> Bilder wischen
                                </div>
                            </div>
                        )}
                        {imgs.map((img, idx) => (
                            <div key={idx} id={`gallery-img-${idx}`} className={`relative h-auto max-h-[85vh] flex-shrink-0 snap-center flex items-center justify-center ${imgs.length > 1 ? 'w-[85%] px-2' : 'w-full'}`}>
                                <img src={img} loading="lazy" decoding="async" className="max-w-full max-h-[85vh] object-contain shadow-2xl pointer-events-none" alt="" />
                            </div>
                        ))}
                    </div>

                    {/* --- DESKTOP GALLERY (Arrows) --- */}
                    {(() => {
                        if (imgs.length <= 1) return (
                            <div className="hidden md:flex relative max-w-full max-h-full items-center justify-center z-[410] p-12 pointer-events-none">
                                <img src={imgs[0]} className="max-w-full max-h-full object-contain shadow-2xl" alt="" />
                            </div>
                        );
                        return (
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
                        );
                    })()}
                </div>
                );
            })()}
        </div>
    );
}