import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
// import { db } from './deineFirebaseConfig'; // Entsprechend anpassen

export default function NewsletterEditor({ db, editingNewsletter, clearEditMode }) {
  // 1. Initialer State für alle Eingabefelder
  const initialData = {
    betreff: '',
    title: '',
    newsText: '',
    tipTitle: '',
    materialText: '',
    imageUrl: '',
    selectedTours: [] // Falls du Touren verknüpfst
  };

  const [formData, setFormData] = useState(initialData);
  const [previewHtml, setPreviewHtml] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // 2. Wenn ein alter Entwurf geladen wird (übergeben via Props), State befüllen
  useEffect(() => {
    if (editingNewsletter && editingNewsletter.formData) {
      setFormData(editingNewsletter.formData);
    } else {
      setFormData(initialData);
    }
  }, [editingNewsletter]);

  // 3. HTML-Preview bei jeder Änderung des formData-States neu generieren
  useEffect(() => {
    setPreviewHtml(generateMailHTML(formData));
  }, [formData]);

  // 4. Zentraler Handler für alle Inputs
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // 5. Firebase Speicher-Logik
  const handleSaveDraft = async () => {
    try {
      const payload = {
        status: 'Entwurf',
        datum: serverTimestamp(),
        betreff: formData.betreff || 'Ohne Betreff',
        htmlInhalt: previewHtml,
        formData: formData // Rohdaten für späteres Editieren speichern
      };

      if (editingNewsletter?.id) {
        // Bestehenden Entwurf updaten
        await updateDoc(doc(db, 'newsletters', editingNewsletter.id), payload);
        setStatusMsg('Änderungen gespeichert!');
      } else {
        // Neuen Entwurf anlegen
        await addDoc(collection(db, 'newsletters'), payload);
        setStatusMsg('Neuer Entwurf gespeichert!');
      }
      
      setTimeout(() => setStatusMsg(''), 3000); // Meldung nach 3s ausblenden
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      setStatusMsg('Fehler beim Speichern.');
    }
  };

  // 6. Clipboard-Export (Vanilla-JS Logik auf React adaptiert)
  const copyForGmail = async () => {
    try {
      const type = "text/html";
      const blob = new Blob([previewHtml], { type });
      const data = [new ClipboardItem({ [type]: blob })];
      await navigator.clipboard.write(data);
      setStatusMsg('Erfolgreich für Gmail in die Zwischenablage kopiert!');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (error) {
      console.error("Clipboard Fehler:", error);
      setStatusMsg('Kopieren fehlgeschlagen.');
    }
  };

  return (
    <div className="newsletter-editor-container" style={{ display: 'flex', gap: '2rem' }}>
      
      {/* LINKE SEITE: Formular */}
      <div className="editor-form" style={{ flex: 1 }}>
        <h3>{editingNewsletter ? 'Entwurf bearbeiten' : 'Neuer Newsletter'}</h3>
        
        <div className="form-group">
          <label>Mail-Betreff (CRM & Speicherung)</label>
          <input 
            type="text" 
            name="betreff" 
            value={formData.betreff} 
            onChange={handleInputChange} 
            placeholder="z.B. Neuigkeiten im Mai..."
          />
        </div>

        <div className="form-group">
          <label>Titel (H1 in der Mail)</label>
          <input 
            type="text" 
            name="title" 
            value={formData.title} 
            onChange={handleInputChange} 
          />
        </div>

        <div className="form-group">
          <label>News-Text</label>
          <textarea 
            name="newsText" 
            value={formData.newsText} 
            onChange={handleInputChange} 
            rows="5"
          />
        </div>

        {/* Weitere Inputs (Material, Bilder, Touren) folgen hier analog */}

        <div className="action-buttons" style={{ marginTop: '1rem', display: 'flex', gap: '10px' }}>
          <button onClick={handleSaveDraft}>💾 Speichern</button>
          <button onClick={copyForGmail}>✉️ Für Gmail kopieren</button>
          {editingNewsletter && (
            <button onClick={clearEditMode}>Abbrechen</button>
          )}
        </div>

        {statusMsg && <p className="status-msg">{statusMsg}</p>}
      </div>

      {/* RECHTE SEITE: Live-Preview */}
      <div className="preview-pane" style={{ flex: 1, border: '1px solid #ccc', padding: '1rem', background: '#fff' }}>
        <h3>Live-Vorschau</h3>
        {/* dangerouslySetInnerHTML rendert den HTML-String direkt ins DOM */}
        <div 
          className="mail-preview"
          dangerouslySetInnerHTML={{ __html: previewHtml }} 
        />
      </div>

    </div>
  );
}

// 7. Ausgelagerte HTML-Generierungsfunktion
function generateMailHTML(data) {
  // Hier kommt dein bisheriges HTML-Template rein, aber mit den Variablen aus 'data'
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h1 style="color: #2c3e50;">${data.title || 'Titel hier eingeben...'}</h1>
      <p style="line-height: 1.5;">${data.newsText ? data.newsText.replace(/\n/g, '<br/>') : 'Text hier eingeben...'}</p>
      
      <!-- Hier können weitere Blöcke wie Tipps, Material etc. angehängt werden -->
    </div>
  `;
}