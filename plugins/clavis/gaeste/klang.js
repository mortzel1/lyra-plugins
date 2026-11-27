'use strict';
/*
 * Clavis – Klang: Soundtrack je Welt (Akkorde, Rhythmus, Motive, Geräuschkulisse – alles mit WebAudio erzeugt, keine
 * Dateien) und über 40 Soundeffekte (Schrei, Alarm, Regen, Telefon, Glas, Ketten, Wolfsheulen, Spieluhr …).
 * Musik und Effekte lassen sich getrennt ausschalten. intensitaet(0…1) macht die Musik schneller und dichter.
 */
Clavis.klang = (() => {
  let ctx = null;
  let haupt = null;
  let hall = null;
  let musikBus = null;
  let an = true;
  let musikAn = true;
  try { an = localStorage.getItem('clavis:ton') !== 'aus'; musikAn = localStorage.getItem('clavis:musik') !== 'aus'; } catch (_) {}

  // Seite verdeckt (Plugin geschlossen, Tab im Hintergrund): kein Ton – auch keine einzelnen Effekte
  let verdeckt = typeof document !== 'undefined' && document.hidden;
  let warAn = false; // lief beim Verdecken Musik (oder sollte sie starten)?

  function bereit() {
    if (!an || verdeckt) return false;
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        haupt = ctx.createGain();
        haupt.gain.value = 0.6;
        haupt.connect(ctx.destination);
        // Hall: Verzögerung mit Rückkopplung, gedämpft
        const d = ctx.createDelay(1);
        d.delayTime.value = 0.23;
        const fb = ctx.createGain();
        fb.gain.value = 0.38;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2600;
        hall = ctx.createGain();
        hall.gain.value = 0.5;
        hall.connect(d);
        d.connect(lp).connect(fb).connect(d);
        lp.connect(haupt);
        musikBus = ctx.createGain();
        musikBus.gain.value = 0.32;
        musikBus.connect(haupt);
        const sende = ctx.createGain();
        sende.gain.value = 0.35;
        musikBus.connect(sende).connect(hall);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    } catch (_) { return false; }
  }

  // ---------------------------------------------------------------- Bausteine
  function ton(f, dauer, { typ = 'sine', laut = 0.12, ab = 0, gleit = null, ziel = haupt, angriff = 0.012, vibrato = 0 } = {}) {
    const t = ctx.currentTime + ab;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = typ;
    o.frequency.setValueAtTime(f, t);
    if (gleit) o.frequency.exponentialRampToValueAtTime(Math.max(20, gleit), t + dauer);
    if (vibrato) { const l = ctx.createOscillator(); const lg = ctx.createGain(); l.frequency.value = 6; lg.gain.value = vibrato; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dauer + 0.05); }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(laut, t + angriff);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dauer);
    o.connect(g).connect(ziel);
    o.start(t);
    o.stop(t + dauer + 0.05);
    return o;
  }

  let rauschPuffer = null;
  function rauschQuelle() {
    if (!rauschPuffer) {
      rauschPuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = rauschPuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const q = ctx.createBufferSource();
    q.buffer = rauschPuffer;
    q.loop = true;
    return q;
  }

  function rauschen(dauer, { laut = 0.1, filter = 'bandpass', f = 1000, q = 1, ab = 0, f2 = null, ziel = haupt, angriff = null } = {}) {
    const t = ctx.currentTime + ab;
    const s = rauschQuelle();
    const fi = ctx.createBiquadFilter();
    fi.type = filter;
    fi.frequency.setValueAtTime(f, t);
    if (f2) fi.frequency.exponentialRampToValueAtTime(f2, t + dauer);
    fi.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(laut, t + (angriff ?? Math.min(0.08, dauer / 4)));
    g.gain.exponentialRampToValueAtTime(0.0008, t + dauer);
    s.connect(fi).connect(g).connect(ziel);
    s.start(t);
    s.stop(t + dauer + 0.05);
  }

  const glocke = (f, ab = 0, laut = 0.07, ziel = haupt, dauer = 1.6) => { ton(f, dauer, { laut, ab, ziel }); ton(f * 2.76, dauer * 0.6, { laut: laut * 0.4, ab, ziel }); ton(f * 5.4, dauer * 0.3, { laut: laut * 0.2, ab, ziel }); };
  const stimme = (f, dauer, ab, laut, formant = 800, ziel = haupt) => {
    const t = ctx.currentTime + ab;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * 0.88, t + dauer);
    const b = ctx.createBiquadFilter();
    b.type = 'bandpass';
    b.frequency.value = formant;
    b.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(laut, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dauer);
    o.connect(b).connect(g).connect(ziel);
    o.start(t);
    o.stop(t + dauer + 0.05);
  };

  function schrei(laut = 0.16, tief = 1) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(480 * tief, t);
    o.frequency.linearRampToValueAtTime(1050 * tief, t + 0.22);
    o.frequency.linearRampToValueAtTime(880 * tief, t + 0.8);
    o.frequency.linearRampToValueAtTime(620 * tief, t + 1.5);
    const l = ctx.createOscillator();
    const lg = ctx.createGain();
    l.frequency.value = 7.5;
    lg.gain.value = 28 * tief;
    l.connect(lg).connect(o.frequency);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1000; f1.Q.value = 2.5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2600; f2.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(laut, t + 0.06);
    g.gain.setValueAtTime(laut, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(f1).connect(g);
    o.connect(f2).connect(g);
    g.connect(haupt);
    g.connect(hall);
    o.start(t); l.start(t);
    o.stop(t + 1.7); l.stop(t + 1.7);
    rauschen(1.4, { laut: laut * 0.35, f: 3200, q: 2, ziel: hall });
  }

  // ---------------------------------------------------------------- Effekte
  const EFFEKTE = {
    klick: () => ton(1800, 0.04, { typ: 'square', laut: 0.04 }),
    rad: () => { ton(2400, 0.025, { typ: 'square', laut: 0.03 }); rauschen(0.03, { laut: 0.05, f: 3000, q: 4 }); },
    auf: () => { rauschen(0.08, { laut: 0.12, f: 900, q: 3 }); [523, 784, 1047, 1568].forEach((f, i) => ton(f, 0.5, { laut: 0.08, ab: 0.08 + i * 0.07, typ: 'triangle' })); },
    falsch: () => { ton(140, 0.28, { typ: 'sawtooth', laut: 0.08 }); ton(110, 0.32, { typ: 'sawtooth', laut: 0.06, ab: 0.12 }); },
    erfolg: () => [392, 523, 659, 784, 1047].forEach((f, i) => ton(f, 0.7, { laut: 0.07, ab: i * 0.09, typ: 'triangle' })),
    ende: () => [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => ton(f, 0.9, { laut: 0.07, ab: i * 0.13, typ: 'triangle' })),
    hinweis: () => { ton(880, 0.3, { laut: 0.06 }); ton(1320, 0.4, { laut: 0.05, ab: 0.1 }); },
    papier: () => rauschen(0.35, { laut: 0.08, filter: 'highpass', f: 2500, f2: 5000 }),
    alarm: () => { for (let i = 0; i < 4; i++) ton(620, 0.45, { typ: 'square', laut: 0.05, ab: i * 0.5, gleit: 920 }); },
    sirene: () => { for (let i = 0; i < 6; i++) ton(i % 2 ? 760 : 980, 0.42, { typ: 'triangle', laut: 0.07, ab: i * 0.42 }); },
    donner: () => { rauschen(2.6, { laut: 0.35, filter: 'lowpass', f: 400, f2: 60, q: 0.7 }); rauschen(0.25, { laut: 0.25, filter: 'highpass', f: 1200 }); },
    blitz: () => rauschen(0.2, { laut: 0.2, filter: 'highpass', f: 2500 }),
    gewitter: () => { EFFEKTE.blitz(); setTimeout(() => EFFEKTE.donner(), 350); },
    telefon: () => { for (let r = 0; r < 2; r++) for (let i = 0; i < 10; i++) { ton(1300, 0.045, { typ: 'square', laut: 0.035, ab: r * 1.4 + i * 0.05 }); ton(1700, 0.045, { typ: 'square', laut: 0.03, ab: r * 1.4 + i * 0.05 + 0.025 }); } },
    schritte: () => { for (let i = 0; i < 5; i++) { ton(70, 0.18, { laut: 0.2, ab: i * 0.55 }); rauschen(0.1, { laut: 0.07, filter: 'lowpass', f: 500, ab: i * 0.55 }); } },
    glitch: () => { for (let i = 0; i < 8; i++) ton(200 + Math.random() * 3000, 0.05, { typ: 'square', laut: 0.04, ab: i * 0.045 }); },
    tuer: () => { ton(180, 1.2, { typ: 'sawtooth', laut: 0.04, gleit: 95 }); rauschen(1.2, { laut: 0.05, f: 300, q: 8, f2: 160 }); },
    beben: () => { rauschen(2.2, { laut: 0.3, filter: 'lowpass', f: 120, q: 1 }); ton(45, 2, { laut: 0.2 }); },
    fluestern: () => { rauschen(1.6, { laut: 0.06, f: 2400, q: 6, f2: 1800, ziel: hall }); rauschen(1.2, { laut: 0.05, f: 3200, q: 7, ab: 0.6, f2: 2600 }); },
    funk: () => { rauschen(0.7, { laut: 0.08, f: 1800, q: 1 }); ton(1000, 0.12, { typ: 'square', laut: 0.04, ab: 0.75 }); },
    fackel: () => rauschen(1.4, { laut: 0.12, filter: 'lowpass', f: 900, q: 0.5 }),
    stromaus: () => { ton(120, 0.6, { typ: 'sawtooth', laut: 0.06, gleit: 40 }); rauschen(0.15, { laut: 0.1, filter: 'highpass', f: 3000 }); },
    herz: () => { ton(58, 0.16, { laut: 0.32 }); ton(52, 0.2, { laut: 0.24, ab: 0.22 }); },
    atem: () => { rauschen(1.1, { laut: 0.05, f: 700, q: 0.8, f2: 1100 }); rauschen(1.3, { laut: 0.04, f: 900, q: 0.8, ab: 1.3, f2: 600 }); },
    knarren: () => { ton(240, 0.9, { typ: 'sawtooth', laut: 0.025, gleit: 170 }); rauschen(0.9, { laut: 0.03, f: 500, q: 10, f2: 380 }); },
    falle: () => { rauschen(0.12, { laut: 0.25, filter: 'highpass', f: 3000 }); ton(90, 0.5, { typ: 'square', laut: 0.12, gleit: 45 }); ton(1900, 0.25, { typ: 'square', laut: 0.03, ab: 0.05 }); },
    schrei: () => schrei(0.15),
    kreischen: () => { [311, 330, 466, 622].forEach((f) => ton(f, 0.9, { typ: 'sawtooth', laut: 0.09, gleit: f * 1.3 })); rauschen(0.7, { laut: 0.3, filter: 'highpass', f: 1500, angriff: 0.005 }); schrei(0.2, 1.15); },
    buh: () => { ton(160, 0.4, { typ: 'square', laut: 0.08, gleit: 90 }); rauschen(0.3, { laut: 0.12, f: 900, q: 1, angriff: 0.005 }); },
    glas: () => { for (let i = 0; i < 9; i++) ton(2500 + Math.random() * 3800, 0.3 + Math.random() * 0.6, { laut: 0.04, ab: Math.random() * 0.25 }); rauschen(0.4, { laut: 0.18, filter: 'highpass', f: 3500, angriff: 0.003 }); },
    tuerknall: () => { ton(85, 0.45, { laut: 0.35, gleit: 38, angriff: 0.003 }); rauschen(0.35, { laut: 0.25, filter: 'lowpass', f: 700, angriff: 0.003, ziel: hall }); },
    heulen: () => { ton(380, 2.6, { laut: 0.07, gleit: 520, vibrato: 9, angriff: 0.5, ziel: hall }); ton(190, 2.4, { laut: 0.03, gleit: 260, vibrato: 6, angriff: 0.6 }); },
    lachen: () => { for (let i = 0; i < 6; i++) stimme(190 - i * 8, 0.13, i * 0.21, 0.13, 700, hall); },
    kichern: () => { for (let i = 0; i < 8; i++) stimme(620 + (i % 2) * 90, 0.07, i * 0.11, 0.07, 1500); },
    ketten: () => { for (let i = 0; i < 16; i++) ton(1700 + Math.random() * 2600, 0.12, { typ: 'square', laut: 0.025, ab: Math.random() * 1.3 }); rauschen(1.3, { laut: 0.05, f: 3000, q: 3 }); },
    uhrschlag: () => { for (let i = 0; i < 4; i++) glocke(196, i * 0.95, 0.08, hall, 2.4); },
    regen: () => { rauschen(3.5, { laut: 0.12, filter: 'highpass', f: 1400, angriff: 0.8 }); for (let i = 0; i < 12; i++) ton(1300 + Math.random() * 900, 0.06, { laut: 0.02, ab: Math.random() * 3, gleit: 700 }); },
    explosion: () => { rauschen(3, { laut: 0.42, filter: 'lowpass', f: 900, f2: 70, angriff: 0.005 }); ton(52, 1.4, { laut: 0.35, gleit: 30, angriff: 0.005 }); },
    kraehen: () => { for (let i = 0; i < 3; i++) { stimme(620, 0.22, i * 0.38, 0.12, 1300); rauschen(0.2, { laut: 0.05, f: 1600, q: 4, ab: i * 0.38 }); } },
    spieluhr: () => { const n = [1047, 1319, 1568, 1319, 1175, 1047, 988, 1047]; n.forEach((f, i) => glocke(f, i * 0.32, 0.04, hall, 0.9)); },
    spieluhrSchief: () => { const n = [1047, 1245, 1480, 1245, 1109, 1047, 932, 1047]; n.forEach((f, i) => glocke(f * (1 + (Math.random() - 0.5) * 0.03), i * 0.42, 0.04, hall, 1.1)); },
    konfetti: () => { ton(500, 0.12, { laut: 0.12, gleit: 160, angriff: 0.003 }); for (let i = 0; i < 14; i++) ton(1500 + Math.random() * 2500, 0.15, { laut: 0.03, ab: 0.05 + Math.random() * 0.6 }); },
    trommeln: () => { for (let i = 0; i < 10; i++) ton(120, 0.25, { laut: 0.2 - i * 0.008, ab: i * (0.34 - i * 0.02), gleit: 55 }); },
    braam: () => { [55, 55.5, 82.4, 110].forEach((f) => { const o = ton(f, 3.2, { typ: 'sawtooth', laut: 0.055, angriff: 0.06 }); }); ton(41, 3, { laut: 0.2, angriff: 0.04 }); rauschen(0.5, { laut: 0.08, filter: 'lowpass', f: 300, angriff: 0.01 }); },
    riser: () => { rauschen(2.6, { laut: 0.1, filter: 'highpass', f: 300, f2: 6000, angriff: 2.2 }); ton(180, 2.6, { typ: 'sawtooth', laut: 0.025, gleit: 900, angriff: 2.2 }); },
    whoosh: () => rauschen(0.7, { laut: 0.14, f: 300, q: 1.5, f2: 2600, angriff: 0.35 }),
    plopp: () => ton(620, 0.14, { laut: 0.12, gleit: 200, angriff: 0.003 }),
    fanfare: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => { ton(f, 0.35, { typ: 'sawtooth', laut: 0.03, ab: i * 0.14 }); ton(f, 0.4, { typ: 'triangle', laut: 0.06, ab: i * 0.14 }); }),
    zischen: () => rauschen(1.1, { laut: 0.1, filter: 'highpass', f: 4000 }),
    tropfen: () => ton(1400, 0.1, { laut: 0.06, gleit: 650, ziel: hall }),
    klopf: () => { ton(150, 0.1, { laut: 0.34, gleit: 80, angriff: 0.002 }); rauschen(0.06, { laut: 0.16, filter: 'lowpass', f: 700, angriff: 0.002 }); },
    zuenden: () => { rauschen(0.5, { laut: 0.12, f: 1400, q: 0.8, f2: 600, angriff: 0.01 }); ton(220, 0.3, { laut: 0.03, gleit: 330, ab: 0.05 }); },
    strahl: () => { ton(880, 0.5, { typ: 'triangle', laut: 0.05, gleit: 1760 }); ton(1320, 0.6, { laut: 0.03, ab: 0.08, gleit: 2640 }); },
    einrasten: () => { ton(320, 0.06, { typ: 'square', laut: 0.08, angriff: 0.002 }); ton(640, 0.12, { laut: 0.06, ab: 0.05 }); },
    tueroeffnen: () => { EFFEKTE.tuer(); rauschen(1.6, { laut: 0.06, f: 200, q: 0.6, ab: 0.4, f2: 900 }); },
  };

  function spielen(name) {
    if (!bereit()) return;
    try { (EFFEKTE[name] || EFFEKTE.klick)(); } catch (_) {}
  }
  function piep(f = 700, dauer = 0.12) { if (bereit()) try { ton(f, dauer, { typ: 'sine', laut: 0.07 }); } catch (_) {} }

  // ---------------------------------------------------------------- Soundtrack je Welt
  const MUSIK = {
    noir: { grund: 110, skala: [0, 3, 5, 7, 10, 12, 15], tempo: 68, pad: 'warm', puls: 'bass', motiv: 'klavier', textur: 'regen' },
    labor: { grund: 98, skala: [0, 1, 5, 7, 8, 12, 13], tempo: 92, pad: 'kalt', puls: 'ping', motiv: 'glocke', textur: 'brummen' },
    wueste: { grund: 73.4, skala: [0, 1, 4, 5, 7, 8, 11, 12], tempo: 64, pad: 'warm', puls: 'trommel', motiv: 'floete', textur: 'wind' },
    orbit: { grund: 55, skala: [0, 2, 3, 7, 10, 12, 14], tempo: 70, pad: 'kalt', puls: 'sonar', motiv: 'glocke', textur: 'drohne' },
    spuk: { grund: 65.4, skala: [0, 1, 3, 6, 7, 8, 12], tempo: 52, pad: 'duester', puls: 'herz', motiv: 'spieluhr', textur: 'wind', schief: true },
    bibliothek: { grund: 87.3, skala: [0, 2, 3, 5, 7, 8, 10, 12], tempo: 60, pad: 'warm', puls: 'ticken', motiv: 'cembalo', textur: null },
    see: { grund: 98, skala: [0, 2, 3, 5, 7, 9, 10, 12], tempo: 84, pad: 'warm', puls: 'trommel', motiv: 'akkordeon', textur: 'wellen' },
    akademie: { grund: 130.8, skala: [0, 2, 4, 7, 9, 12, 14], tempo: 66, pad: 'weich', puls: null, motiv: 'klavier', textur: null },
    zirkus: { grund: 130.8, skala: [0, 2, 4, 5, 7, 9, 11, 12], tempo: 124, pad: null, puls: 'humpa', motiv: 'glocke', textur: null },
    dschungel: { grund: 98, skala: [0, 2, 4, 7, 9, 12, 14], tempo: 100, pad: 'warm', puls: 'trommeln', motiv: 'floete', textur: 'voegel' },
    tiefsee: { grund: 82.4, skala: [0, 2, 4, 6, 7, 9, 11, 12], tempo: 54, pad: 'kalt', puls: 'blasen', motiv: 'glocke', textur: 'tief' },
    spielzeug: { grund: 261.6, skala: [0, 2, 4, 5, 7, 9, 11, 12], tempo: 104, pad: null, puls: 'ticken', motiv: 'spieluhr', textur: null },
    western: { grund: 82.4, skala: [0, 3, 5, 6, 7, 10, 12], tempo: 78, pad: null, puls: 'hufe', motiv: 'gitarre', textur: 'wind' },
    sanatorium: { grund: 61.7, skala: [0, 1, 6, 7, 12, 13], tempo: 46, pad: 'duester', puls: 'tropfen', motiv: 'spieluhr', textur: 'brummen', schief: true },
  };
  let m = null;
  let schlag = 0;
  let musikTakt = null;
  let intens = 0.2;
  let texturKnoten = [];
  let texturTakt = null;
  let aktuell = null; // {welt, alter, stimmung}

  const hz = (stufe, oktave = 0) => m.grund * 2 ** ((m.skala[((stufe % m.skala.length) + m.skala.length) % m.skala.length] + 12 * (oktave + Math.floor(stufe / m.skala.length))) / 12);

  function instrument(art, f, ab, laut = 0.06, dauer = 0.6) {
    const ziel = musikBus;
    const schief = m.schief ? 1 + (Math.random() - 0.5) * 0.025 : 1;
    switch (art) {
      case 'klavier': ton(f, 1.6, { laut, ab, ziel }); ton(f * 2, 0.9, { laut: laut * 0.3, ab, ziel }); break;
      case 'glocke': glocke(f * 2, ab, laut * 0.8, ziel, 1.4); break;
      case 'spieluhr': glocke(f * 4 * schief, ab, laut * 0.6, ziel, 0.9); break;
      case 'floete': ton(f * 2, dauer + 0.3, { laut: laut * 0.8, ab, ziel, angriff: 0.08, vibrato: 4 }); break;
      case 'gitarre': ton(f, 1.1, { typ: 'sawtooth', laut: laut * 0.35, ab, ziel, angriff: 0.004 }); ton(f * 2, 0.6, { typ: 'triangle', laut: laut * 0.3, ab, ziel, angriff: 0.004 }); break;
      case 'akkordeon': ton(f, dauer, { typ: 'sawtooth', laut: laut * 0.25, ab, ziel, angriff: 0.05 }); ton(f * 1.004, dauer, { typ: 'sawtooth', laut: laut * 0.25, ab, ziel, angriff: 0.05 }); break;
      case 'cembalo': ton(f * 2, 0.5, { typ: 'square', laut: laut * 0.25, ab, ziel, angriff: 0.003 }); break;
      case 'bass': ton(f / 2, 0.5, { typ: 'triangle', laut: laut * 1.6, ab, ziel, angriff: 0.005 }); break;
      case 'tupfer': ton(f * 2, 0.25, { typ: 'triangle', laut: laut * 0.8, ab, ziel, angriff: 0.003 }); break;
      default: ton(f, dauer, { laut, ab, ziel });
    }
  }

  function pad(stufen) {
    if (!m.pad) return;
    const dauer = (60 / tempo()) * 16;
    const t = ctx.currentTime;
    const typ = { warm: 'sawtooth', kalt: 'triangle', duester: 'sawtooth', weich: 'triangle' }[m.pad] || 'triangle';
    const fi = ctx.createBiquadFilter();
    fi.type = 'lowpass';
    fi.frequency.value = m.pad === 'duester' ? 420 : m.pad === 'warm' ? 750 : 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(m.pad === 'weich' ? 0.05 : 0.035, t + 2);
    g.gain.setValueAtTime(m.pad === 'weich' ? 0.05 : 0.035, t + dauer - 1.5);
    g.gain.linearRampToValueAtTime(0, t + dauer + 0.5);
    fi.connect(g).connect(musikBus);
    for (const s of stufen) {
      for (const verstimmt of [0.996, 1.004]) {
        const o = ctx.createOscillator();
        o.type = typ;
        o.frequency.value = hz(s, -1) * verstimmt;
        o.connect(fi);
        o.start(t);
        o.stop(t + dauer + 0.6);
      }
    }
  }

  const tempo = () => m.tempo * (1 + intens * 0.3);

  function puls(b, ab) {
    const takt = b % 4;
    switch (m.puls) {
      case 'bass': instrument('bass', hz([0, 2, 4, 3][takt] + akkord), ab, 0.07); break;
      case 'ping': if (b % 8 === 0) { ton(hz(4, 3), 1.8, { laut: 0.04, ab, ziel: hall }); } break;
      case 'sonar': if (b % 8 === 0) { ton(1180, 2.4, { laut: 0.05, ab, ziel: hall }); } break;
      case 'trommel': if (takt === 0) ton(110, 0.3, { laut: 0.16, ab, gleit: 50, ziel: musikBus }); if (takt === 2) ton(140, 0.2, { laut: 0.08, ab, gleit: 70, ziel: musikBus }); break;
      case 'trommeln': for (const [o, l] of [[0, 0.14], [0.5, 0.06], [0.75, 0.09]]) ton(takt % 2 ? 170 : 120, 0.18, { laut: l, ab: ab + o * (60 / tempo()), gleit: 60, ziel: musikBus }); break;
      case 'herz': if (takt === 0) { ton(58, 0.16, { laut: 0.2, ab, ziel: musikBus }); ton(52, 0.2, { laut: 0.15, ab: ab + 0.22, ziel: musikBus }); } break;
      case 'ticken': ton(b % 2 ? 2100 : 1700, 0.03, { typ: 'square', laut: 0.012, ab, ziel: musikBus }); break;
      case 'humpa': if (takt % 2 === 0) instrument('bass', hz(takt === 0 ? akkord : akkord + 4), ab, 0.08); else [0, 2, 4].forEach((s) => ton(hz(akkord + s, 1), 0.15, { typ: 'triangle', laut: 0.025, ab, ziel: musikBus })); break;
      case 'blasen': if (Math.random() < 0.35) ton(400 + Math.random() * 500, 0.12, { laut: 0.03, ab, gleit: 900, ziel: musikBus }); break;
      case 'hufe': for (const o of [0, 0.2, 0.45]) ton(900, 0.04, { typ: 'square', laut: 0.015, ab: ab + o * (60 / tempo()), ziel: musikBus }); break;
      case 'tropfen': if (Math.random() < 0.3) ton(1400 + Math.random() * 400, 0.1, { laut: 0.04, ab, gleit: 700, ziel: hall }); break;
      case 'tupfer': if (takt % 2 === 1) instrument('tupfer', hz(akkord + [0, 2, 4][Math.floor(Math.random() * 3)]), ab, 0.05); break;
      default:
    }
    // Spannung: bei hoher Intensität ein treibendes Ticken auf den Zwischenschlägen
    if (intens > 0.6) rauschen(0.04, { laut: 0.02 + intens * 0.02, filter: 'highpass', f: 7000, ab: ab + (30 / tempo()), ziel: musikBus });
  }

  let akkord = 0;
  function schritt() {
    if (!m || !ctx) return;
    const ab = 0.05;
    const b = schlag++;
    if (b % 16 === 0) {
      akkord = [0, 3, 4, 5, 0, 2, 4, 3][Math.floor(b / 16) % 8] % m.skala.length;
      pad([akkord, akkord + 2, akkord + 4]);
    }
    puls(b, ab);
    if (b % 4 === 0 && m.motiv && Math.random() < 0.22 + intens * 0.25) {
      const n = 2 + Math.floor(Math.random() * 3);
      let s = akkord + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) { instrument(m.motiv, hz(s, 1), ab + i * (30 / tempo()), 0.05); s += [-1, 1, 2, -2][Math.floor(Math.random() * 4)]; }
    }
    musikTakt = setTimeout(schritt, (60 / tempo()) * 1000);
  }

  function texturStarten(art) {
    const dauerton = (f, laut, typ = 'sine') => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = typ; o.frequency.value = f; g.gain.value = laut; o.connect(g).connect(musikBus); o.start(); texturKnoten.push(o, g); return { o, g }; };
    const dauerRauschen = (f, q, laut, filter = 'bandpass') => { const s = rauschQuelle(); const fi = ctx.createBiquadFilter(); fi.type = filter; fi.frequency.value = f; fi.Q.value = q; const g = ctx.createGain(); g.gain.value = laut; s.connect(fi).connect(g).connect(musikBus); s.start(); texturKnoten.push(s, fi, g); return { s, fi, g }; };
    const lfo = (param, f, tiefe) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = f; g.gain.value = tiefe; o.connect(g).connect(param); o.start(); texturKnoten.push(o, g); };
    if (art === 'regen') { dauerRauschen(1400, 0.4, 0.05, 'highpass'); dauerRauschen(500, 0.6, 0.03); }
    if (art === 'brummen') { dauerton(60, 0.03, 'sawtooth'); dauerton(120, 0.015); }
    if (art === 'wind') { const r = dauerRauschen(500, 1.2, 0.05); lfo(r.fi.frequency, 0.08, 260); lfo(r.g.gain, 0.05, 0.03); }
    if (art === 'drohne') { dauerton(55, 0.05, 'triangle'); dauerton(82.5, 0.02); }
    if (art === 'wellen') { const r = dauerRauschen(380, 0.5, 0.05, 'lowpass'); lfo(r.g.gain, 0.12, 0.04); }
    if (art === 'tief') { const a = dauerton(41, 0.06, 'triangle'); lfo(a.g.gain, 0.1, 0.03); texturTakt = setInterval(() => { if (Math.random() < 0.3) ton(300, 3, { laut: 0.025, gleit: 180, vibrato: 4, ziel: hall, angriff: 0.8 }); }, 5000); }
    if (art === 'voegel') { const r = dauerRauschen(2500, 0.8, 0.012); lfo(r.g.gain, 0.2, 0.008); texturTakt = setInterval(() => { if (Math.random() < 0.6) { const f = 1800 + Math.random() * 1600; for (let i = 0; i < 3; i++) ton(f, 0.08, { laut: 0.025, ab: i * 0.12, gleit: f * 1.3, ziel: musikBus }); } }, 2200); }
  }

  function musikStoppen() {
    clearTimeout(musikTakt);
    musikTakt = null;
    clearInterval(texturTakt);
    texturTakt = null;
    for (const k of texturKnoten) { try { k.stop ? k.stop() : k.disconnect(); } catch (_) {} }
    texturKnoten = [];
  }

  /** Soundtrack zur Welt starten (Kinder: Dur, heller, ohne düstere Geräusche) */
  function musik(welt, alter, stimmung) {
    aktuell = { welt, alter, stimmung };
    musikStoppen();
    if (verdeckt && an && musikAn && welt) { warAn = true; return; }
    if (!an || !musikAn || !bereit() || !welt) return;
    const basis = MUSIK[(Clavis.WELTEN[welt] || {}).musik] || MUSIK.akademie;
    m = { ...basis };
    if (alter === 'kinder') {
      Object.assign(m, { skala: [0, 2, 4, 7, 9, 12, 14], tempo: basis.tempo * 1.2, pad: basis.pad ? 'weich' : null, motiv: ['spieluhr', 'glocke'].includes(basis.motiv) ? basis.motiv : 'glocke', schief: false,
        puls: ['humpa', 'trommeln', 'ticken'].includes(basis.puls) ? basis.puls : 'tupfer', textur: ['voegel', 'wellen'].includes(basis.textur) ? basis.textur : null });
      if (m.grund < 100) m.grund *= 2;
    } else if (stimmung && stimmung.grusel >= 7) {
      m.schief = true;
    }
    schlag = 0;
    try { if (m.textur) texturStarten(m.textur); } catch (_) {}
    schritt();
  }

  // ---------------------------------------------------------------- Geräuschkulisse je Welt (unabhängig von der Musik)
  // Regen an der Scheibe, Sturm, Wellen, Grillen, das Summen der Röhren … läuft, solange man im Raum ist (Ton an).
  const AMBIENTE = {
    krimi: ['regen', 'ticken', 'verkehr'], labor: ['summen', 'blubbern', 'piepen'], grab: ['wind', 'knistern', 'rieseln'], station: ['brummen', 'luefter', 'piepen'],
    spuk: ['sturm', 'knarren', 'ticken'], bibliothek: ['ticken', 'knistern', 'windLeise'], pirat: ['wellen', 'knarren', 'moewen'], akademie: ['summen', 'ticken', 'windLeise'],
    zirkus: ['zeltwind', 'knarren'], dschungel: ['grillen', 'voegel', 'tropfen'], unterwasser: ['tief', 'blubbern', 'sonar', 'knarren'], spielzeug: ['ticken', 'windLeise'],
    western: ['wind', 'knarren'], sanatorium: ['summen', 'tropfen', 'knarren'],
  };
  const KINDER_OHNE = ['sturm', 'knarren', 'tropfen', 'tief'];
  let amb = { knoten: [], takte: [], welt: null, alter: null, bus: null };
  let wetterSchichten = [];
  let verfallSchicht = null;
  function ambBus() {
    if (!amb.bus) { amb.bus = ctx.createGain(); amb.bus.gain.value = 0.55; amb.bus.connect(haupt); }
    return amb.bus;
  }
  function dauerGeraeusch(f, q, laut, filter = 'bandpass', ziel) {
    const s = rauschQuelle(); const fi = ctx.createBiquadFilter(); fi.type = filter; fi.frequency.value = f; fi.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(laut, ctx.currentTime + 2.5);
    s.connect(fi).connect(g).connect(ziel || ambBus()); s.start();
    return { s, fi, g, knoten: [s, fi, g] };
  }
  function dauerSchwingung(f, laut, typ = 'sine', ziel) {
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = typ; o.frequency.value = f; g.gain.value = 0; g.gain.linearRampToValueAtTime(laut, ctx.currentTime + 2.5);
    o.connect(g).connect(ziel || ambBus()); o.start();
    return { o, g, knoten: [o, g] };
  }
  function schwanken(param, f, tiefe, liste) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = f; g.gain.value = tiefe; o.connect(g).connect(param); o.start(); liste.push(o, g); }
  function zufallsTakt(liste, min, max, f) { const h = { t: null, aus: false, stopT() { h.aus = true; clearTimeout(h.t); } }; const los = () => { if (h.aus) return; h.t = setTimeout(() => { try { if (ctx && !verdeckt) f(); } catch (_) {} los(); }, min + Math.random() * (max - min)); }; los(); liste.push(h); }
  function schichtBauen(art, liste, takte, ziel, staerke = 1) {
    const L = (x) => x * staerke;
    const merk = (r) => { liste.push(...r.knoten); return r; };
    const z = ziel || ambBus();
    switch (art) {
      case 'regen': merk(dauerGeraeusch(1500, 0.5, L(0.075), 'highpass', z)); merk(dauerGeraeusch(450, 0.6, L(0.03), 'bandpass', z));
        zufallsTakt(takte, 40, 160, () => ton(1500 + Math.random() * 2500, 0.03, { laut: L(0.012), ziel: z })); break;
      case 'starkregen': merk(dauerGeraeusch(1200, 0.4, L(0.13), 'highpass', z)); merk(dauerGeraeusch(380, 0.5, L(0.06), 'bandpass', z));
        zufallsTakt(takte, 20, 80, () => ton(1200 + Math.random() * 3000, 0.03, { laut: L(0.016), ziel: z })); break;
      case 'sturm': { const r = merk(dauerGeraeusch(420, 1.1, L(0.08), 'bandpass', z)); schwanken(r.fi.frequency, 0.09, 260, liste); schwanken(r.g.gain, 0.06, L(0.05), liste);
        zufallsTakt(takte, 6000, 14000, () => rauschen(3, { laut: L(0.12), f: 300, q: 1.2, f2: 900, ziel: z })); break; }
      case 'wind': case 'windLeise': { const r = merk(dauerGeraeusch(500, 1.2, L(art === 'wind' ? 0.05 : 0.025), 'bandpass', z)); schwanken(r.fi.frequency, 0.07, 200, liste); schwanken(r.g.gain, 0.05, L(0.02), liste); break; }
      case 'zeltwind': { const r = merk(dauerGeraeusch(380, 1, L(0.035), 'bandpass', z)); schwanken(r.g.gain, 0.08, L(0.02), liste);
        zufallsTakt(takte, 4000, 11000, () => rauschen(0.5, { laut: L(0.07), filter: 'lowpass', f: 260, ziel: z })); break; }
      case 'ticken': { let a = 0; const t = setInterval(() => { if (ctx && !verdeckt) ton((a++ % 2) ? 2100 : 1650, 0.03, { typ: 'square', laut: L(0.012), ziel: z }); }, 1000); takte.push({ stopT: () => clearInterval(t) }); break; }
      case 'summen': merk(dauerSchwingung(100, L(0.012), 'sawtooth', z)); merk(dauerSchwingung(200, L(0.006), 'sine', z));
        zufallsTakt(takte, 5000, 15000, () => { for (let i = 0; i < 4; i++) ton(100, 0.05, { typ: 'square', laut: L(0.02), ab: i * 0.07, ziel: z }); }); break;
      case 'brummen': merk(dauerSchwingung(50, L(0.04), 'triangle', z)); merk(dauerSchwingung(100, L(0.015), 'sine', z)); break;
      case 'luefter': merk(dauerGeraeusch(650, 0.5, L(0.035), 'lowpass', z)); break;
      case 'piepen': zufallsTakt(takte, 6000, 14000, () => { ton(1250, 0.09, { laut: L(0.03), ziel: z }); ton(1250, 0.09, { laut: L(0.03), ab: 0.18, ziel: z }); }); break;
      case 'blubbern': zufallsTakt(takte, 300, 2200, () => ton(280 + Math.random() * 300, 0.14, { laut: L(0.03), gleit: 700 + Math.random() * 400, ziel: z })); break;
      case 'knistern': zufallsTakt(takte, 60, 420, () => rauschen(0.02 + Math.random() * 0.03, { laut: L(0.03 + Math.random() * 0.04), filter: 'highpass', f: 2500, angriff: 0.002, ziel: z })); break;
      case 'rieseln': merk(dauerGeraeusch(5200, 0.7, L(0.012), 'highpass', z)); break;
      case 'knarren': zufallsTakt(takte, 9000, 22000, () => { ton(220 + Math.random() * 60, 1, { typ: 'sawtooth', laut: L(0.02), gleit: 160, ziel: z }); rauschen(0.9, { laut: L(0.025), f: 480, q: 9, f2: 360, ziel: z }); }); break;
      case 'wellen': { const r = merk(dauerGeraeusch(480, 0.5, L(0.05), 'lowpass', z)); schwanken(r.g.gain, 0.11, L(0.045), liste);
        zufallsTakt(takte, 7000, 15000, () => rauschen(2.6, { laut: L(0.08), filter: 'lowpass', f: 900, f2: 300, angriff: 0.6, ziel: z })); break; }
      case 'moewen': zufallsTakt(takte, 11000, 26000, () => { for (let i = 0; i < 2; i++) ton(1500, 0.32, { typ: 'triangle', laut: L(0.02), gleit: 1150, ab: i * 0.4, ziel: z }); }); break;
      case 'grillen': zufallsTakt(takte, 900, 2600, () => { for (let i = 0; i < 6; i++) ton(4300, 0.025, { laut: L(0.012), ab: i * 0.045, ziel: z }); }); break;
      case 'voegel': zufallsTakt(takte, 2000, 6000, () => { const f = 1800 + Math.random() * 1600; for (let i = 0; i < 3; i++) ton(f, 0.08, { laut: L(0.018), ab: i * 0.12, gleit: f * 1.2, ziel: z }); }); break;
      case 'tropfen': zufallsTakt(takte, 1500, 4200, () => ton(1300 + Math.random() * 500, 0.1, { laut: L(0.035), gleit: 650, ziel: hall })); break;
      case 'tief': { const a = merk(dauerSchwingung(41, L(0.05), 'triangle', z)); schwanken(a.g.gain, 0.1, L(0.025), liste); break; }
      case 'sonar': zufallsTakt(takte, 7000, 11000, () => ton(1180, 2.2, { laut: L(0.03), ziel: hall })); break;
      case 'verkehr': zufallsTakt(takte, 14000, 30000, () => { ton(330, 0.5, { typ: 'square', laut: L(0.008), ziel: z }); ton(262, 0.6, { typ: 'square', laut: L(0.008), ab: 0.5, ziel: z }); }); break;
      case 'wasser': { const r = merk(dauerGeraeusch(700, 0.7, L(0.06), 'lowpass', z)); schwanken(r.g.gain, 0.3, L(0.02), liste); break; }
      case 'sand': merk(dauerGeraeusch(4500, 0.6, L(0.03), 'highpass', z)); break;
      case 'funken': zufallsTakt(takte, 300, 1400, () => { for (let i = 0; i < 3; i++) rauschen(0.03, { laut: L(0.05), filter: 'highpass', f: 4000, ab: i * 0.04, angriff: 0.002, ziel: z }); }); break;
      case 'flackern': zufallsTakt(takte, 800, 2500, () => { for (let i = 0; i < 3; i++) ton(120, 0.04, { typ: 'square', laut: L(0.02), ab: i * 0.06, ziel: z }); }); break;
      case 'ranken': zufallsTakt(takte, 1500, 4000, () => rauschen(0.6, { laut: L(0.03), f: 2200, q: 2, ziel: z })); break;
      case 'risse': zufallsTakt(takte, 3000, 8000, () => { ton(90, 0.6, { laut: L(0.06), gleit: 50, ziel: z }); rauschen(0.4, { laut: L(0.04), filter: 'lowpass', f: 500, ziel: z }); }); break;
      case 'spielzeug': zufallsTakt(takte, 3000, 7000, () => glocke(1320 + Math.random() * 600, 0, L(0.025), hall, 0.8)); break;
      default:
    }
  }
  function schichtenStoppen(liste, takte) {
    for (const t of takte) try { t.stopT(); } catch (_) {}
    for (const k of liste) { try { if (k.gain && ctx) k.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8); } catch (_) {} }
    setTimeout(() => { for (const k of liste) { try { k.stop ? k.stop() : k.disconnect(); } catch (_) {} } }, 900);
  }
  function ambienteStoppen(vergessen = true) {
    schichtenStoppen(amb.knoten, amb.takte);
    amb.knoten = []; amb.takte = [];
    if (vergessen) { amb.welt = null; amb.alter = null; }
    wetterSchichten.forEach((w) => w.stop()); wetterSchichten = [];
    if (verfallSchicht) { verfallSchicht.stop(); verfallSchicht = null; }
  }
  /** Geräuschkulisse der Welt starten (läuft, bis ambienteStoppen) */
  function ambiente(welt, alter) {
    if (amb.welt === welt && amb.knoten.length + amb.takte.length) return;
    ambienteStoppen();
    amb.welt = welt; amb.alter = alter;
    if (!an || verdeckt || !bereit() || !welt) return;
    for (const art of AMBIENTE[welt] || []) {
      if (alter === 'kinder' && KINDER_OHNE.includes(art)) continue;
      try { schichtBauen(art, amb.knoten, amb.takte); } catch (_) {}
    }
  }
  /** Wetter für eine Weile (Regen, Sturm) – z. B. während eines Ereignisses */
  function wetter(art, sekunden = 20) {
    if (!bereit()) return;
    const liste = []; const takte = [];
    try { schichtBauen(art, liste, takte); } catch (_) {}
    const w = { stop: () => schichtenStoppen(liste, takte) };
    wetterSchichten.push(w);
    setTimeout(() => { w.stop(); wetterSchichten = wetterSchichten.filter((x) => x !== w); }, sekunden * 1000);
  }
  /** Verfall hörbar machen (0 = aus, 1–3 lauter) */
  function verfall(art, stufe) {
    if (verfallSchicht && verfallSchicht.art === art && verfallSchicht.stufe === stufe) return;
    if (verfallSchicht) { verfallSchicht.stop(); verfallSchicht = null; }
    if (!stufe || !bereit()) return;
    const liste = []; const takte = [];
    try { schichtBauen(art, liste, takte, null, 0.6 + stufe * 0.45); } catch (_) {}
    verfallSchicht = { art, stufe, stop: () => schichtenStoppen(liste, takte) };
  }

  let geduckt = false;
  function intensitaet(x) { intens = Math.max(0, Math.min(1, x)); if (musikBus && !geduckt) musikBus.gain.value = 0.28 + intens * 0.12; }
  /** Musik und Kulisse leiser, solange jemand spricht */
  function ducken(ja) {
    geduckt = !!ja;
    if (!ctx) return;
    const t = ctx.currentTime;
    try {
      if (musikBus) { musikBus.gain.cancelScheduledValues(t); musikBus.gain.setTargetAtTime(ja ? 0.1 : 0.28 + intens * 0.12, t, 0.25); }
      if (amb.bus) { amb.bus.gain.cancelScheduledValues(t); amb.bus.gain.setTargetAtTime(ja ? 0.22 : 0.55, t, 0.25); }
    } catch (_) {}
  }

  function schalten(neu) {
    an = !!neu;
    try { localStorage.setItem('clavis:ton', an ? 'an' : 'aus'); } catch (_) {}
    if (!an) { musikStoppen(); const w = amb.welt; const a2 = amb.alter; ambienteStoppen(); amb.welt = w; amb.alter = a2; } else { if (aktuell) musik(aktuell.welt, aktuell.alter, aktuell.stimmung); if (amb.welt) { const w = amb.welt; amb.welt = null; ambiente(w, amb.alter); } }
  }
  function musikSchalten(neu) {
    musikAn = !!neu;
    try { localStorage.setItem('clavis:musik', musikAn ? 'an' : 'aus'); } catch (_) {}
    if (!musikAn) musikStoppen(); else if (aktuell) musik(aktuell.welt, aktuell.alter, aktuell.stimmung);
  }

  // Verdeckt: Musik anhalten und den Klang einfrieren; wieder sichtbar: weiter, falls noch ein Spiel läuft.
  // Geschlossen (pagehide): alles aus.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      verdeckt = document.hidden;
      if (verdeckt) {
        warAn = !!musikTakt;
        musikStoppen();
        { const w = amb.welt; const a2 = amb.alter; ambienteStoppen(); amb.welt = w; amb.alter = a2; amb.pausiert = !!w; }
        if (ctx) ctx.suspend().catch(() => {});
      } else {
        if (ctx && an) ctx.resume().catch(() => {});
        if (warAn && aktuell && document.querySelector('.cl-spiel')) musik(aktuell.welt, aktuell.alter, aktuell.stimmung);
        if (amb.pausiert && amb.welt && document.querySelector('.cl-raum')) { const w = amb.welt; amb.welt = null; amb.pausiert = false; ambiente(w, amb.alter); }
        warAn = false;
      }
    });
    addEventListener('pagehide', () => {
      warAn = false;
      aktuell = null;
      musikStoppen();
      ambienteStoppen();
      if (ctx) { try { ctx.close(); } catch (_) {} }
      ctx = null;
    });
  }

  return {
    spielen, piep, bereit, musik, musikStoppen, intensitaet, schalten, musikSchalten, ambiente, ambienteStoppen, wetter, verfall, ducken, ambienteWelt: () => amb.welt,
    /** Eine Glocke mit Tonhöhe f (für Rätsel) */
    klingen: (f, dauer = 1.6) => { if (bereit()) try { glocke(f, 0, 0.08, hall, dauer); } catch (_) {} },
    /** Ein Ton mit Tonhöhe f, kurz (für Rätsel) */
    tonHoehe: (f, dauer = 0.25, typ = 'triangle') => { if (bereit()) try { ton(f, dauer, { typ, laut: 0.07 }); } catch (_) {} },
    an: () => an, musikAn: () => musikAn,
    /** Für Tests: läuft Musik, in welchem Zustand ist der Klang? */
    zustand: () => ({ musik: !!musikTakt, klang: ctx ? ctx.state : 'keiner', verdeckt }),
    // Ältere Namen
    atmo: (welt, stimmung) => musik(welt, (aktuell && aktuell.alter) || 'ab14', stimmung), atmoStoppen: musikStoppen,
  };
})();
