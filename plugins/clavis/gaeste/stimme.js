'use strict';
/* Natürliche lokale Stimmen: keine Spaßstimmen, kein künstliches Tieferpitchen. */
Clavis.stimme = (() => {
    const synth = window.speechSynthesis || null, lesen = (k, d) => { try {
        return localStorage.getItem(k) ?? d;
    }
    catch (_) {
        return d;
    } }, sichern = (k, v) => { try {
        localStorage.setItem(k, v);
    }
    catch (_) { } };
    let an = lesen('clavis:stimme', 'aus') === 'an', auswahl = lesen('clavis:stimme:wahl', ''), stimmen = [];
    const laufend = new Set(), effekte = /eddy|flo\b|grandma|grandpa|rocko|reed|sandy|shelley|wobble|whisper|trinoids|zarvox|bad news|good news|bells|boing|bubbles|cellos|organ|jester|superstar|bahh/i;
    const bewerten = v => (/premium|enhanced|neural|natural|siri/i.test(v.name) ? 100 : 0) + (/anna|markus|petra|helena|yannick/i.test(v.name) ? 20 : 0) + (/de[-_]DE/i.test(v.lang) ? 10 : 0);
    function laden() { try {
        stimmen = synth ? synth.getVoices().filter(v => /^de(?:-|_)/i.test(v.lang) && v.localService === true && !effekte.test(v.name)) : [];
    }
    catch (_) {
        stimmen = [];
    } stimmen.sort((a, b) => bewerten(b) - bewerten(a) || a.name.localeCompare(b.name)); }
    const stimme = () => stimmen.find(v => v.voiceURI === auswahl || v.name === auswahl) || stimmen[0] || null;
    function stopp() { try {
        synth?.cancel();
    }
    catch (_) { } for (const f of [...laufend])
        f(false); Clavis.klang?.ducken?.(false); }
    function sprechen(text, rolle = 'erzaehler') { return new Promise(resolve => { const t = String(text || '').replace(/[„“”«»]/g, '').replace(/\s+/g, ' ').trim(), v = stimme(); if (!an || !v || !t || document.hidden || !Clavis.klang?.an())
        return resolve(false); let erledigt = false, timer; const fertig = ok => { if (erledigt)
        return; erledigt = true; clearTimeout(timer); laufend.delete(fertig); if (!laufend.size)
        Clavis.klang?.ducken?.(false); resolve(ok); }; try {
        const u = new SpeechSynthesisUtterance(t);
        u.voice = v;
        u.lang = v.lang;
        u.pitch = 1;
        u.rate = rolle === 'trailer' || rolle === 'brief' ? .93 : .98;
        u.volume = .88;
        u.onend = () => fertig(true);
        u.onerror = () => fertig(false);
        laufend.add(fertig);
        Clavis.klang?.ducken?.(true);
        timer = setTimeout(() => fertig(false), 5000 + t.length * 115);
        synth.speak(u);
    }
    catch (_) {
        fertig(false);
    } }); }
    function schalten(neu) { an = !!neu; sichern('clavis:stimme', an ? 'an' : 'aus'); if (!an)
        stopp(); }
    function waehlen(uri) { if (!stimmen.some(v => v.voiceURI === uri || v.name === uri))
        return false; stopp(); auswahl = uri; sichern('clavis:stimme:wahl', uri); return true; }
    laden();
    if (synth)
        synth.addEventListener?.('voiceschanged', laden);
    document.addEventListener('visibilitychange', () => { if (document.hidden)
        stopp(); });
    window.addEventListener('pagehide', stopp);
    const saetze = text => (String(text || '').match(/[^.!?…]+[.!?…]+[“”"«»)]*\s*|[^.!?…]+$/g) || []).map(s => s.trim()).filter(Boolean);
    return { sprechen, stopp, schalten, an: () => an, verfuegbar: () => !!stimme(), saetze, stimmeName: () => stimme()?.name || '', stimmen: () => stimmen.map(v => ({ id: v.voiceURI, name: v.name, sprache: v.lang })), waehlen, auswahl: () => stimme()?.voiceURI || '' };
})();
