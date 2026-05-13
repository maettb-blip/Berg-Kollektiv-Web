import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from './firebase';
import { Loader2 } from 'lucide-react';

// Wir importieren unsere zwei ausgelagerten Bereiche
import PublicWebsite from './components/PublicWebsite';
import AdminArea from './components/AdminArea';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home'); // 'home' oder 'admin'
  const [touren, setTouren] = useState([]);
  
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Überwacht, ob jemand eingeloggt ist
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) setView('admin');
    });
    return () => unsubscribe();
  }, []);

  // Lädt die Touren aus Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'touren'), (snap) => {
       setTouren(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try { await signInWithEmailAndPassword(auth, emailInput, passwordInput); } 
    catch (error) { setLoginError('Falsche E-Mail oder Passwort.'); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView('home');
  };

  if (loading) return (
      <div className="min-h-screen bg-[#f9f9f7] flex flex-col items-center justify-center">
         <Loader2 className="animate-spin text-black w-8 h-8 mb-4" />
         <p className="text-[10px] tracking-widest uppercase animate-pulse">Lade System...</p>
      </div>
  );

  // --- ADMIN BEREICH ODER LOGIN ---
  if (view === 'admin') {
    if (!user) {
      return (
        <div className="min-h-screen bg-[#f9f9f7] text-black selection:bg-black selection:text-white">
          <nav className="fixed w-full z-50 px-6 md:px-12 py-8 flex justify-between items-center bg-white border-b border-zinc-200">
            <div className="text-lg md:text-xl tracking-[0.3em] uppercase cursor-pointer" onClick={() => setView('home')}>BERG <span className="font-bold">KOLLEKTIV</span></div>
            <button onClick={() => setView('home')} className="text-[10px] uppercase tracking-widest hover:opacity-70 transition">Zur Website</button>
          </nav>
          <div className="pt-32 pb-20 px-6 flex flex-col items-center justify-center min-h-[70vh] fade-in">
              <form onSubmit={handleLogin} className="w-full max-w-sm space-y-8 text-center">
                  <h2 className="serif text-3xl italic mb-4">Admin Login</h2>
                  <div className="border-b border-black py-4">
                      <input type="email" placeholder="E-MAIL" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full bg-transparent outline-none text-center tracking-[0.2em] text-xs mb-4" />
                      <input type="password" placeholder="PASSWORT" required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-transparent outline-none text-center tracking-[0.5em] text-xs" />
                  </div>
                  {loginError && <p className="text-[10px] text-red-500 uppercase tracking-widest">{loginError}</p>}
                  <button type="submit" className="bg-black text-white px-12 py-4 text-[9px] uppercase tracking-[0.4em] hover:bg-zinc-800 transition">Einloggen</button>
              </form>
          </div>
        </div>
      );
    }
    // Wenn eingeloggt: Zeige AdminArea und gib ihr die nötigen Daten mit
    return <AdminArea user={user} touren={touren} onLogout={handleLogout} />;
  }

  // --- ÖFFENTLICHE WEBSEITE ---
  // Wir übergeben "onGoToAdmin" als Prop an die Webseite
  return <PublicWebsite touren={touren} onGoToAdmin={() => setView('admin')} />;
}