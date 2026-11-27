'use strict';
/*
 * Clavis – die Stimme: Ein Erzähler spricht wirklich (Szenen, Funde, Ereignisse, Wendungen, Intro und Outro), Anrufer klingen
 * wie am Telefon, Funksprüche knistern, Geister flüstern tief und langsam. Mit den Stimmen des Geräts – nur lokale Stimmen
 * (localService), damit kein Text das Gerät verlässt. Gibt es keine, bleibt es bei Untertiteln.
 *
 *   Clavis.stimme.sprechen(text, rolle) → Promise (wenn gesprochen)   rolle: erzaehler | telefon | funk | geist | kind | brief | trailer
 *   Clavis.stimme.stopp() · .an() · .schalten(bool) · .verfuegbar()
 */
Clavis.stimme = (() => {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  let an = true;
  try { an = localStorage.getItem('clavis:stimme') !== 'aus'; } catch (_) {}
  let stimmen = [];
  const laden = () => { try { stimmen = synth.getVoices().filter((v) => /^de/i.test(v.lang) && v.localService !== false); } catch (_) { stimmen = []; } };
  if (synth) { laden(); try { synth.addEventListener('voiceschanged', laden); } catch (_) { synth.onvoiceschanged = laden; } }

  const WUNSCH = {
    erzaehler: ['Markus', 'Petra', 'Anna', 'Yannick', 'Helena', 'Reed'],
    trailer: ['Markus', 'Yannick', 'Reed', 'Anna'],
    telefon: ['Yannick', 'Reed', 'Eddy', 'Flo', 'Petra', 'Sandy'],
    funk: ['Rocko', 'Eddy', 'Reed', 'Flo'],
    geist: ['Grandpa', 'Rocko', 'Reed', 'Markus', 'Anna'],
    kind: ['Shelley', 'Sandy', 'Flo', 'Anna'],
    brief: ['Grandma', 'Anna', 'Petra', 'Helena'],
  };
  const KLANG = {
    erzaehler: { rate: 0.96, pitch: 0.95, volume: 1 },
    trailer: { rate: 0.86, pitch: 0.72, volume: 1 },
    telefon: { rate: 1.03, pitch: 1.08, volume: 0.9 },
    funk: { rate: 1.08, pitch: 0.92, volume: 0.9 },
    geist: { rate: 0.7, pitch: 0.25, volume: 0.85 },
    kind: { rate: 1.0, pitch: 1.2, volume: 1 },
    brief: { rate: 0.92, pitch: 1.0, volume: 1 },
  };
  const merk = {};
  function stimmeFuer(rolle) {
    if (merk[rolle] && stimmen.includes(merk[rolle])) return merk[rolle];
    const name = (v) => v.name.split(' (')[0];
    const erzaehler = rolle !== 'erzaehler' ? stimmeFuer('erzaehler') : null;
    for (const w of WUNSCH[rolle] || WUNSCH.erzaehler) {
      const v = stimmen.find((x) => name(x) === w || x.name.startsWith(w));
      if (v && (rolle === 'trailer' || rolle === 'geist' || rolle === 'brief' || v !== erzaehler)) return (merk[rolle] = v);
    }
    return (merk[rolle] = stimmen.find((v) => v !== erzaehler) || stimmen[0] || null);
  }

  const verfuegbar = () => !!synth && stimmen.length > 0;
  let aktiv = 0;
  /** Einen Text sprechen. Ergebnis: Promise, das nach dem Sprechen erfüllt wird (oder sofort, wenn keine Stimme da ist) */
  function sprechen(text, rolle = 'erzaehler') {
    return new Promise((fertig) => {
      const t = String(text || '').replace(/[„“”"«»]/g, '').replace(/\s+/g, ' ').trim();
      if (!t || !an || !verfuegbar() || (Clavis.klang && !Clavis.klang.an()) || document.hidden) return fertig(false);
      let erledigt = false;
      const ende = (ok) => { if (erledigt) return; erledigt = true; aktiv = Math.max(0, aktiv - 1); if (!aktiv && Clavis.klang && Clavis.klang.ducken) Clavis.klang.ducken(false); fertig(ok); };
      try {
        const u = new SpeechSynthesisUtterance(t);
        const v = stimmeFuer(rolle);
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'de-DE';
        const k = KLANG[rolle] || KLANG.erzaehler;
        u.rate = k.rate; u.pitch = k.pitch; u.volume = k.volume;
        u.onend = () => ende(true);
        u.onerror = () => ende(false);
        aktiv++;
        if (Clavis.klang && Clavis.klang.ducken) Clavis.klang.ducken(true);
        synth.speak(u);
        // Sicherheitsnetz, falls ein Gerät „onend“ verschluckt
        setTimeout(() => ende(true), 2500 + t.length * 110);
      } catch (_) { ende(false); }
    });
  }
  function stopp() { try { if (synth) synth.cancel(); } catch (_) {} aktiv = 0; if (Clavis.klang && Clavis.klang.ducken) Clavis.klang.ducken(false); }
  function schalten(neu) { an = !!neu; try { localStorage.setItem('clavis:stimme', an ? 'an' : 'aus'); } catch (_) {} if (!an) stopp(); }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopp(); });
    addEventListener('pagehide', stopp);
  }
  /** Text in Sätze teilen (für Untertitel, die mit der Stimme mitlaufen) */
  const saetze = (text) => (String(text || '').match(/[^.!?…]+[.!?…]+[“”"«»)]*\s*|[^.!?…]+$/g) || []).map((s) => s.trim()).filter(Boolean);
  return { sprechen, stopp, schalten, an: () => an, verfuegbar, saetze, stimmeName: (r) => { const v = stimmeFuer(r); return v ? v.name : ''; } };
})();
