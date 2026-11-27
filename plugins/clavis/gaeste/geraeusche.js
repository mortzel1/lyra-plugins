'use strict';
/*
 * Clavis – Geräusche statt Stimme. Alles wird im Gerät erzeugt (WebAudio, keine Dateien): Atmen, Flüstern, gedämpfte Stimmen
 * hinter der Wand, ein Chor aus dem Untergrund, Seufzen, Summen, Stöhnen, Schluchzen, Schritte auf Holz, Stein, Metall, Sand und
 * Wasser, Kratzen in der Wand, Poltern, Schreibmaschine, Getriebe, Dampf, Hydraulik, Steinmahlen, Münzen, Eule, Affen, Pferd,
 * Sporen, ferne Klaviertöne, Geisterapplaus, Drehorgel, Spielzeugquietschen, Aufziehwerk, Herzmonitor, Zauberklang … – links oder
 * rechts, nah oder fern, mit Hall.
 *
 *   Clavis.geraeusch(name, { pan, ferne, hall, laut, … })   ein einzelnes Geräusch
 *   Clavis.klangszene(art, { welt, alter, stark, dauer })    Geräusch-Inszenierung für Ereignisse, Wendungen, Outro
 *   Clavis.praesenz(welt, alter, stimmung)                   ein zufälliges „Da ist jemand“-Geräusch im Raum
 *   Clavis.loesungsklang(welt, alter)                        Klang, wenn ein Rätsel aufgeht – je Welt
 */
(() => {
  const K = () => Clavis.klang;
  const I = () => Clavis.klang.intern;
  const zz = (a, b) => a + Math.random() * (b - a);
  const wahl = (l) => l[Math.floor(Math.random() * l.length)];
  let bus = null;
  let hallRaum = null;
  const bereit = () => K().an() && K().bereit() && !I().verdeckt();

  function grund() {
    const ctx = I().ctx();
    if (!bus) {
      bus = ctx.createGain(); bus.gain.value = 0.95; bus.connect(I().haupt());
      // Raumhall: Faltung mit abklingendem Rauschen (wie ein großer, steinerner Raum)
      const sek = 2.8; const n = Math.floor(ctx.sampleRate * sek);
      const puffer = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = puffer.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
      const f = ctx.createConvolver(); f.buffer = puffer;
      const g = ctx.createGain(); g.gain.value = 0.55;
      f.connect(g).connect(I().haupt());
      hallRaum = f;
    }
    return ctx;
  }
  /** Ein Kanal: Panorama, Ferne (dumpfer, leiser), Hall – gibt den Eingang zurück */
  function kanal({ pan = 0, ferne = 0, hall = 0.3, laut = 1, gedaempft = false } = {}) {
    const ctx = grund();
    const ein = ctx.createGain(); ein.gain.value = laut * (1 - ferne * 0.55);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = gedaempft ? 520 : 14000 - ferne * 10500;
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    ein.connect(lp).connect(p).connect(bus);
    const s = ctx.createGain(); s.gain.value = hall + ferne * 0.3; p.connect(s).connect(hallRaum);
    setTimeout(() => { try { ein.disconnect(); p.disconnect(); s.disconnect(); } catch (_) {} }, 20000);
    return ein;
  }
  const ton = (ziel, f, dauer, o = {}) => I().ton(f, dauer, { ...o, ziel });
  const rau = (ziel, dauer, o = {}) => I().rauschen(dauer, { ...o, ziel });

  /** Eine Silbe: stimmhaft (Sägezahn) oder gehaucht (Rauschen) durch zwei Formantfilter */
  function silbe(ziel, ab, dauer, { f0 = 120, f0e = null, F1 = 600, F2 = 1400, laut = 0.1, stimmhaft = true } = {}) {
    const ctx = I().ctx();
    const t = ctx.currentTime + ab;
    let quelle;
    if (stimmhaft) { quelle = ctx.createOscillator(); quelle.type = 'sawtooth'; quelle.frequency.setValueAtTime(f0, t); if (f0e) quelle.frequency.linearRampToValueAtTime(f0e, t + dauer); }
    else quelle = I().rauschQuelle();
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(laut, t + Math.min(0.04, dauer / 3)); g.gain.exponentialRampToValueAtTime(0.0008, t + dauer);
    for (const [F, q, a] of [[F1, stimmhaft ? 5 : 3, 1], [F2, stimmhaft ? 8 : 5, 0.6]]) {
      const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = F; b.Q.value = q;
      const ga = ctx.createGain(); ga.gain.value = a; quelle.connect(b).connect(ga).connect(g);
    }
    g.connect(ziel);
    quelle.start(t); quelle.stop(t + dauer + 0.05);
  }
  const VOKALE = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870], [440, 1020], [660, 1700]];

  // ================================================================ Menschen (ohne Worte)
  const G = {
    /** Atmen: tempo ruhig | schwer | panisch, n Züge */
    atmen(o = {}) {
      const z = kanal({ hall: 0.15, ...o });
      const tempo = o.tempo || 'schwer';
      const [ein, aus, pause, laut] = { ruhig: [1.3, 1.7, 0.6, 0.05], schwer: [0.9, 1.2, 0.3, 0.09], panisch: [0.32, 0.4, 0.08, 0.08] }[tempo];
      let t = 0;
      for (let i = 0; i < (o.n || 3); i++) {
        rau(z, ein, { laut, filter: 'bandpass', f: 850, q: 0.9, f2: 1500, ab: t, angriff: ein * 0.7 });
        if (tempo === 'schwer') rau(z, ein, { laut: laut * 0.5, filter: 'lowpass', f: 320, ab: t, angriff: ein * 0.7 });
        t += ein + 0.06;
        rau(z, aus, { laut: laut * 1.1, filter: 'bandpass', f: 1300, q: 0.8, f2: 650, ab: t, angriff: 0.08 });
        t += aus + pause;
      }
      return t;
    },
    /** Flüstern: unverständliches Gewisper, mehrere Stimmen, rundherum */
    fluestern(o = {}) {
      const n = o.stimmen || 2; const dauer = o.dauer || 3;
      for (let s = 0; s < n; s++) {
        const z = kanal({ pan: n > 1 ? -0.9 + (1.8 * s) / (n - 1) + zz(-0.1, 0.1) : o.pan || 0, ferne: o.ferne || 0, hall: o.hall ?? 0.45, laut: o.laut || 1 });
        let t = zz(0, 0.4);
        while (t < dauer) {
          const wort = Math.floor(zz(2, 5));
          for (let w = 0; w < wort && t < dauer; w++) {
            const [F1, F2] = wahl(VOKALE);
            const d = zz(0.08, 0.15);
            silbe(z, t, d, { F1: F1 * 1.3, F2: F2 * 1.2, laut: 0.12, stimmhaft: false });
            if (Math.random() < 0.3) rau(z, zz(0.05, 0.12), { laut: 0.05, filter: 'highpass', f: 5200, ab: t + d * 0.6, angriff: 0.01 });
            t += d + zz(0.02, 0.06);
          }
          t += zz(0.15, 0.45);
        }
      }
      return dauer;
    },
    /** Murmeln: eine Stimme spricht, man versteht kein Wort (Telefon, Funk, durch die Wand) */
    murmeln(o = {}) {
      const z = kanal({ hall: o.telefon || o.funk ? 0.05 : 0.3, ...o });
      const ctx = I().ctx();
      let ziel = z;
      if (o.telefon || o.funk) {
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = o.funk ? 500 : 320;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.funk ? 2600 : 3300;
        const ws = ctx.createWaveShaper(); const kurve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; kurve[i] = Math.tanh(x * (o.funk ? 4 : 2.2)); } ws.curve = kurve;
        hp.connect(lp).connect(ws).connect(z); ziel = hp;
      }
      const grundton = { mann: 110, frau: 200, kind: 290, alt: 95 }[o.stimme || 'mann'];
      const dauer = o.dauer || 3;
      let t = 0;
      while (t < dauer) {
        const satz = Math.floor(zz(4, 9));
        let f = grundton * zz(1.05, 1.2);
        for (let w = 0; w < satz && t < dauer; w++) {
          const [F1, F2] = wahl(VOKALE);
          const d = zz(0.09, 0.2);
          const fe = f * zz(0.9, 1.04);
          silbe(ziel, t, d, { f0: f, f0e: fe, F1, F2, laut: o.laut ? 0.12 * o.laut : 0.12 });
          if (Math.random() < 0.35) rau(ziel, 0.05, { laut: 0.03, filter: 'highpass', f: 4000, ab: t + d, angriff: 0.01 });
          f = fe; t += d + zz(0.01, 0.05);
        }
        t += zz(0.25, 0.6);
      }
      if (o.funk) for (let i = 0; i < dauer * 3; i++) rau(ziel, zz(0.05, 0.25), { laut: 0.06, filter: 'bandpass', f: zz(1200, 3000), q: 1, ab: zz(0, dauer) });
      return dauer;
    },
    /** Viele gedämpfte Stimmen aus dem Untergrund – ein unheimlicher Chor */
    chor(o = {}) {
      const n = o.stimmen || 4; const dauer = o.dauer || 4;
      for (let i = 0; i < n; i++) G.murmeln({ stimme: wahl(['mann', 'frau', 'alt']), dauer, pan: zz(-0.8, 0.8), ferne: 0.7, gedaempft: true, laut: 0.8 });
      const z = kanal({ ferne: 0.6, gedaempft: true, hall: 0.6 });
      ton(z, 98, dauer, { typ: 'sawtooth', laut: 0.03, angriff: 1.2, vibrato: 3 }); ton(z, 147, dauer, { typ: 'sawtooth', laut: 0.02, angriff: 1.5, vibrato: 4 });
      return dauer;
    },
    seufzen(o = {}) {
      const z = kanal({ hall: 0.25, ...o });
      rau(z, 1.4, { laut: 0.08, filter: 'bandpass', f: 1200, q: 0.8, f2: 600, angriff: 0.15 });
      silbe(z, 0.1, 1.2, { f0: o.stimme === 'frau' ? 210 : 130, f0e: o.stimme === 'frau' ? 160 : 95, F1: 500, F2: 900, laut: 0.04 });
      return 1.5;
    },
    /** Summen: eine Melodie mit geschlossenem Mund (fern, unheimlich – oder fröhlich für Kinder) */
    summen(o = {}) {
      const z = kanal({ hall: 0.5, ...o });
      const froh = o.froh;
      const noten = froh ? [523, 587, 659, 523, 659, 784, 659] : [330, 311, 294, 330, 247, 262, 247];
      let t = 0;
      for (const f of noten) { const d = zz(0.38, 0.55); ton(z, f / (froh ? 2 : 1.5), d + 0.1, { typ: 'triangle', laut: 0.05, ab: t, angriff: 0.08, vibrato: 3 }); t += d; }
      return t;
    },
    stoehnen(o = {}) {
      const z = kanal({ hall: 0.5, ...o });
      silbe(z, 0, 2.2, { f0: 92, f0e: 70, F1: 420, F2: 800, laut: 0.09 });
      silbe(z, 1.6, 1.6, { f0: 85, f0e: 66, F1: 380, F2: 760, laut: 0.06 });
      return 3.2;
    },
    schluchzen(o = {}) {
      const z = kanal({ hall: 0.4, ...o });
      let t = 0;
      for (let i = 0; i < 6; i++) { silbe(z, t, 0.16, { f0: 260, f0e: 200, F1: 600, F2: 1500, laut: 0.05 }); rau(z, 0.3, { laut: 0.04, filter: 'bandpass', f: 1000, ab: t + 0.12 }); t += zz(0.35, 0.7); }
      return t;
    },
    kichern(o = {}) { const z = kanal({ hall: 0.35, ...o }); for (let i = 0; i < 7; i++) silbe(z, i * 0.11, 0.08, { f0: o.kind === false ? 220 : 520 + (i % 2) * 80, F1: 700, F2: 1800, laut: 0.06 }); return 0.9; },
    // ================================================================ Schritte, Hände, Dinge
    schritte(o = {}) {
      const z = kanal({ hall: 0.25, ...o });
      const boden = o.boden || 'holz'; const n = o.n || 6; const schritt = o.tempo || 0.55;
      for (let i = 0; i < n; i++) {
        const t = i * schritt * zz(0.92, 1.08);
        const lauter = o.naeher ? 0.35 + (0.65 * i) / n : o.weg ? 1 - (0.7 * i) / n : 1;
        if (boden === 'holz') { ton(z, 75, 0.14, { laut: 0.22 * lauter, ab: t, angriff: 0.004 }); rau(z, 0.08, { laut: 0.06 * lauter, filter: 'lowpass', f: 600, ab: t }); if (Math.random() < 0.25) rau(z, 0.4, { laut: 0.025 * lauter, f: 480, q: 9, f2: 360, ab: t + 0.05 }); }
        if (boden === 'stein') { rau(z, 0.05, { laut: 0.1 * lauter, filter: 'highpass', f: 1800, ab: t, angriff: 0.003 }); ton(z, 95, 0.08, { laut: 0.12 * lauter, ab: t, angriff: 0.003 }); }
        if (boden === 'metall') { ton(z, 410, 0.35, { typ: 'triangle', laut: 0.05 * lauter, ab: t, angriff: 0.002 }); ton(z, 690, 0.25, { typ: 'triangle', laut: 0.03 * lauter, ab: t, angriff: 0.002 }); ton(z, 70, 0.1, { laut: 0.14 * lauter, ab: t }); }
        if (boden === 'sand') { rau(z, 0.16, { laut: 0.07 * lauter, filter: 'highpass', f: 2500, ab: t, angriff: 0.01 }); rau(z, 0.12, { laut: 0.05 * lauter, filter: 'bandpass', f: 900, ab: t + 0.02 }); }
        if (boden === 'wasser') rau(z, 0.25, { laut: 0.09 * lauter, filter: 'bandpass', f: 700, q: 1, f2: 2200, ab: t, angriff: 0.01 });
        if (boden === 'teppich') ton(z, 60, 0.12, { laut: 0.12 * lauter, ab: t });
      }
      return n * schritt;
    },
    kratzen(o = {}) {
      const z = kanal({ hall: 0.2, gedaempft: o.inWand, ...o });
      let t = 0;
      for (let i = 0; i < (o.n || 5); i++) { const d = zz(0.18, 0.4); rau(z, d, { laut: 0.07, filter: 'bandpass', f: zz(2000, 3500), q: 3, f2: zz(1500, 4000), ab: t, angriff: 0.02 }); t += d + zz(0.1, 0.4); }
      return t;
    },
    poltern(o = {}) { const z = kanal({ hall: 0.4, ...o }); let t = 0; for (let i = 0; i < 6; i++) { ton(z, zz(60, 140), 0.25, { laut: zz(0.1, 0.25), ab: t, gleit: 45, angriff: 0.003 }); rau(z, 0.15, { laut: 0.08, filter: 'lowpass', f: 900, ab: t }); t += zz(0.08, 0.35); } return t; },
    schreibmaschine(o = {}) { const z = kanal({ hall: 0.2, ...o }); let t = 0; for (let i = 0; i < 18; i++) { rau(z, 0.03, { laut: 0.08, filter: 'highpass', f: 2500, ab: t, angriff: 0.002 }); ton(z, 180, 0.04, { typ: 'square', laut: 0.02, ab: t }); t += zz(0.07, 0.18); } I().glocke(2100, t + 0.1, 0.05, I().haupt(), 1); return t + 1; },
    getriebe(o = {}) { const z = kanal({ hall: 0.3, ...o }); for (let i = 0; i < 16; i++) ton(z, 900, 0.03, { typ: 'square', laut: 0.025, ab: i * 0.09 }); ton(z, 110, 0.5, { laut: 0.12, ab: 1.5, angriff: 0.003, gleit: 70 }); return 2; },
    dampf(o = {}) { const z = kanal({ hall: 0.2, ...o }); rau(z, o.dauer || 2, { laut: 0.12, filter: 'highpass', f: 3200, angriff: 0.05 }); return o.dauer || 2; },
    hydraulik(o = {}) { const z = kanal({ hall: 0.3, ...o }); rau(z, 1.4, { laut: 0.1, f: 300, q: 1.2, f2: 1400, angriff: 0.2 }); ton(z, 80, 0.4, { laut: 0.18, ab: 1.4, angriff: 0.003 }); rau(z, 0.6, { laut: 0.06, filter: 'highpass', f: 4000, ab: 1.5 }); return 2.2; },
    steinmahlen(o = {}) { const z = kanal({ hall: 0.55, ...o }); for (let i = 0; i < 24; i++) rau(z, 0.18, { laut: zz(0.05, 0.12), filter: 'lowpass', f: zz(200, 500), ab: i * 0.12 }); ton(z, 45, 3, { laut: 0.08, angriff: 0.4 }); return 3; },
    muenzen(o = {}) { const z = kanal({ hall: 0.25, ...o }); for (let i = 0; i < 9; i++) ton(z, zz(2600, 4200), zz(0.15, 0.4), { laut: 0.03, ab: zz(0, 0.7), angriff: 0.002 }); return 1; },
    // ================================================================ Tiere und Welt
    eule(o = {}) { const z = kanal({ ferne: 0.5, hall: 0.5, ...o }); ton(z, 420, 0.4, { laut: 0.05, gleit: 380 }); ton(z, 400, 0.7, { laut: 0.05, ab: 0.55, gleit: 340, vibrato: 4 }); return 1.4; },
    affe(o = {}) { const z = kanal({ ferne: 0.4, hall: 0.4, ...o }); for (let i = 0; i < 5; i++) silbe(z, i * 0.16, 0.12, { f0: 700, f0e: 1100, F1: 800, F2: 1800, laut: 0.05 }); return 1; },
    pferd(o = {}) { const z = kanal({ ferne: 0.5, hall: 0.35, ...o }); silbe(z, 0, 1.2, { f0: 600, f0e: 300, F1: 700, F2: 1500, laut: 0.06 }); ton(z, 500, 1, { typ: 'sawtooth', laut: 0.01, vibrato: 18, gleit: 280 }); return 1.4; },
    sporen(o = {}) { const z = kanal({ hall: 0.2, ...o }); for (let i = 0; i < 6; i++) { const t = i * 0.55; ton(z, 4200, 0.12, { laut: 0.025, ab: t, angriff: 0.002 }); ton(z, 3600, 0.1, { laut: 0.02, ab: t + 0.04, angriff: 0.002 }); } return 3.3; },
    klavierFern(o = {}) { const z = kanal({ ferne: 0.6, hall: 0.6, ...o }); [262, 330, 392, 349, 294].forEach((f, i) => { ton(z, f, 1.6, { laut: 0.05, ab: i * 0.5 }); ton(z, f * 2, 0.9, { laut: 0.015, ab: i * 0.5 }); }); return 3; },
    applaus(o = {}) { const z = kanal({ ferne: 0.6, hall: 0.7, ...o }); for (let i = 0; i < 90; i++) rau(z, 0.03, { laut: 0.03 * (1 - i / 120), filter: 'bandpass', f: zz(1500, 3500), q: 1, ab: zz(0, 2.5), angriff: 0.002 }); return 2.5; },
    drehorgel(o = {}) { const z = kanal({ ferne: 0.5, hall: 0.5, ...o }); [523, 659, 784, 659, 587, 698, 880, 698].forEach((f, i) => ton(z, f, 0.3, { typ: 'square', laut: 0.012, ab: i * 0.28, vibrato: 5 })); return 2.4; },
    quietschen(o = {}) { const z = kanal({ hall: 0.2, ...o }); ton(z, 900, 0.18, { typ: 'triangle', laut: 0.05, gleit: 1600 }); ton(z, 1500, 0.15, { typ: 'triangle', laut: 0.04, ab: 0.2, gleit: 800 }); return 0.4; },
    aufziehen(o = {}) { const z = kanal({ hall: 0.2, ...o }); for (let i = 0; i < 14; i++) ton(z, 1200, 0.03, { typ: 'square', laut: 0.02, ab: i * 0.07 }); ton(z, 300, 1.6, { typ: 'sawtooth', laut: 0.012, ab: 1, vibrato: 14, gleit: 180 }); return 2.6; },
    herzmonitor(o = {}) { const z = kanal({ ferne: 0.4, hall: 0.3, ...o }); for (let i = 0; i < 5; i++) ton(z, 1000, 0.1, { laut: 0.04, ab: i * 0.85 }); if (o.flach) ton(z, 1000, 2.5, { laut: 0.035, ab: 4.3 }); return o.flach ? 6.8 : 4.3; },
    summer(o = {}) { const z = kanal({ hall: 0.2, ...o }); ton(z, 120, 0.7, { typ: 'square', laut: 0.04 }); return 0.7; },
    // ================================================================ Kleine Klänge für Momente der Geschichte
    zauber(o = {}) { const z = kanal({ hall: 0.6, ...o }); [1047, 1319, 1568, 2093].forEach((f, i) => I().glocke(f, i * 0.08, 0.035, z, 1.6)); rau(z, 1.2, { laut: 0.02, filter: 'highpass', f: 6000, f2: 9000, angriff: 0.3 }); return 1.6; },
    seite(o = {}) { const z = kanal({ hall: 0.15, ...o }); rau(z, 0.35, { laut: 0.07, filter: 'highpass', f: 2500, f2: 5000, angriff: 0.05 }); rau(z, 0.2, { laut: 0.05, filter: 'highpass', f: 3000, ab: 0.3 }); return 0.6; },
    riegel(o = {}) { const z = kanal({ hall: 0.25, ...o }); rau(z, 0.35, { laut: 0.06, filter: 'bandpass', f: 1800, q: 4, f2: 1200 }); ton(z, 220, 0.12, { typ: 'square', laut: 0.05, ab: 0.35, angriff: 0.002 }); return 0.6; },
    rueckwaerts(o = {}) { const z = kanal({ hall: 0.4, ...o }); rau(z, 1, { laut: 0.12, f: 2600, q: 1.5, f2: 300, angriff: 0.9 }); return 1; },
    fallen(o = {}) { const z = kanal({ hall: 0.4, ...o }); ton(z, 700, 1.2, { typ: 'triangle', laut: 0.06, gleit: 120 }); return 1.2; },
    tickenSchnell(o = {}) { const z = kanal({ hall: 0.2, ...o }); let t = 0; let d = 0.5; for (let i = 0; i < 18; i++) { ton(z, i % 2 ? 2100 : 1700, 0.03, { typ: 'square', laut: 0.03, ab: t }); t += d; d = Math.max(0.09, d * 0.86); } return t; },
    stromAus(o = {}) { const z = kanal({ hall: 0.3, ...o }); ton(z, 220, 1.6, { typ: 'sawtooth', laut: 0.05, gleit: 30 }); rau(z, 0.1, { laut: 0.1, filter: 'highpass', f: 3000, ab: 0.05 }); return 1.6; },
    fackelAus(o = {}) { const z = kanal({ hall: 0.4, ...o }); rau(z, 1.2, { laut: 0.14, f: 500, q: 0.6, f2: 2000, angriff: 0.4 }); rau(z, 0.8, { laut: 0.04, filter: 'highpass', f: 4000, ab: 1 }); return 2; },
  };

  /** Ein Geräusch abspielen – Ergebnis: Dauer in Sekunden (0, wenn kein Ton) */
  Clavis.geraeusch = (name, o = {}) => {
    if (!bereit() || !G[name]) return 0;
    try { return G[name](o) || 0; } catch (e) { console.error(e); return 0; }
  };

  const BODEN = { krimi: 'holz', labor: 'stein', grab: 'sand', station: 'metall', spuk: 'holz', bibliothek: 'holz', pirat: 'holz', akademie: 'stein', zirkus: 'sand', dschungel: 'stein', unterwasser: 'metall', spielzeug: 'teppich', western: 'holz', sanatorium: 'stein' };
  const TECHNIK = ['labor', 'station', 'unterwasser'];
  const ALT = ['grab', 'dschungel'];

  /** Geräusch-Inszenierung für ein Ereignis, eine Wendung oder einen Moment der Geschichte */
  Clavis.klangszene = (art, { welt = 'krimi', alter = 'ab14', stark = false, dauer = 4 } = {}) => {
    if (!bereit()) return;
    const kinder = alter === 'kinder';
    const g = (n, o) => Clavis.geraeusch(n, o);
    const spaeter = (ms, f) => setTimeout(() => { if (bereit()) f(); }, ms);
    const boden = BODEN[welt] || 'holz';
    switch (art) {
      // ---- Ereignisse
      case 'fluestern':
        if (kinder) { g('kichern', { pan: -0.6 }); spaeter(900, () => g('kichern', { pan: 0.6 })); break; }
        g('fluestern', { stimmen: stark ? 4 : 2, dauer: Math.max(3, dauer) });
        if (stark) spaeter(1800, () => g('atmen', { tempo: 'ruhig', n: 2, pan: zz(-0.9, 0.9) }));
        break;
      case 'stimmen': // Stimmen aus dem Untergrund, hinter der Wand …
        if (kinder) { g('summen', { froh: true, ferne: 0.4 }); break; }
        g('chor', { stimmen: stark ? 6 : 4, dauer: Math.max(3.5, dauer) });
        spaeter(1500, () => g('fluestern', { stimmen: 2, dauer: 2.5, ferne: 0.2 }));
        break;
      case 'schritte':
        g('schritte', { boden, n: 7, naeher: true, pan: zz(-0.6, 0.6), ferne: 0.25 });
        if (!kinder) spaeter(4300, () => g('atmen', { tempo: stark ? 'schwer' : 'ruhig', n: 2, ferne: 0.3 }));
        break;
      case 'anruf': spaeter(1700, () => g('murmeln', { telefon: true, stimme: wahl(['mann', 'frau']), dauer: Math.max(2.5, dauer - 1.5) })); break;
      case 'funkspruch': spaeter(1700, () => g('murmeln', { funk: true, stimme: wahl(['mann', 'frau']), dauer: Math.max(2.5, dauer - 1.5) })); break;
      case 'brief': spaeter(500, () => g('seite')); spaeter(1800, () => g('seite')); break;
      case 'stromausfall': g(ALT.includes(welt) || welt === 'spuk' || welt === 'bibliothek' || welt === 'pirat' || welt === 'western' ? 'fackelAus' : 'stromAus'); if (!kinder && stark) spaeter(2400, () => g('atmen', { tempo: 'schwer', n: 2, pan: zz(-1, 1), ferne: 0.05 })); break;
      case 'lachen': if (!kinder) spaeter(1600, () => g('fluestern', { stimmen: 1, dauer: 1.5, ferne: 0.6 })); break;
      case 'schrei': if (!kinder) spaeter(1400, () => g('atmen', { tempo: 'panisch', n: 4, ferne: 0.6, pan: zz(-0.7, 0.7) })); break;
      case 'ketten': if (!kinder) spaeter(900, () => g('stoehnen', { ferne: 0.6, gedaempft: true })); break;
      case 'geheimtuer': g(ALT.includes(welt) ? 'steinmahlen' : TECHNIK.includes(welt) ? 'hydraulik' : 'getriebe'); break;
      case 'beben': case 'explosion': spaeter(500, () => g('poltern', { pan: zz(-0.6, 0.6) })); break;
      case 'tuerknall': if (!kinder) spaeter(900, () => g('schritte', { boden, n: 5, weg: true, ferne: 0.4, pan: zz(-0.6, 0.6) })); break;
      case 'glitch': g('murmeln', { funk: true, dauer: 1.5, ferne: 0.3 }); break;
      case 'spieluhr': if (kinder) spaeter(1500, () => g('kichern')); else spaeter(2000, () => g('summen', { ferne: 0.4 })); break;
      case 'uhrschlag': if (!kinder && stark) spaeter(3500, () => g('seufzen', { ferne: 0.5 })); break;
      case 'heulen': spaeter(2600, () => g('eule')); break;
      case 'kraehen': break;
      case 'fackel': g('fackelAus'); break;
      // ---- Wendungen
      case 'w_countdown': g('tickenSchnell'); if (TECHNIK.includes(welt)) spaeter(600, () => g('summer')); break;
      case 'w_dunkel': g(ALT.includes(welt) || ['spuk', 'bibliothek', 'pirat', 'western'].includes(welt) ? 'fackelAus' : 'stromAus'); if (!kinder && stark) spaeter(1800, () => g('atmen', { tempo: 'ruhig', n: 2, pan: zz(-1, 1) })); break;
      case 'w_nebel': g('dampf', { dauer: 2.5 }); break;
      case 'w_geheimfach': g(ALT.includes(welt) ? 'steinmahlen' : TECHNIK.includes(welt) ? 'hydraulik' : 'getriebe'); spaeter(2200, () => g('zauber')); break;
      case 'w_tipp': case 'w_buchstabe': g('zauber'); break;
      case 'w_zeitplus': g('rueckwaerts'); spaeter(900, () => g('zauber')); break;
      case 'w_zeitminus': g('fallen'); spaeter(400, () => g('tickenSchnell')); break;
      case 'w_blockiert': g('riegel'); break;
      // ---- Momente
      case 'geschichte': g('seite'); spaeter(300, () => g('zauber', { laut: 0.6 })); break;
      case 'eintreten': spaeter(600, () => g('schritte', { boden, n: 3, ferne: 0.1 })); break;
      case 'outro_geschafft': g('riegel'); spaeter(800, () => g('rueckwaerts')); spaeter(2400, () => (kinder || ['zirkus', 'spielzeug'].includes(welt) ? g('applaus', { ferne: 0.2 }) : g('zauber'))); break;
      case 'outro_gescheitert':
        if (kinder) { g('fallen'); spaeter(1200, () => g('kichern')); break; }
        g('schritte', { boden, n: 4, naeher: true, ferne: 0.2 }); spaeter(2400, () => g('atmen', { tempo: 'schwer', n: 3, ferne: 0.05 }));
        if (welt === 'sanatorium') spaeter(3000, () => g('herzmonitor', { flach: true }));
        break;
      default:
    }
  };

  /** Ein „Da ist jemand“-Geräusch – passend zu Welt, Spuk und Grusel (für Kinder nur Freundliches) */
  Clavis.praesenz = (welt, alter, st = {}) => {
    if (!bereit()) return;
    const kinder = alter === 'kinder';
    const boden = BODEN[welt] || 'holz';
    const seite = () => wahl([-0.95, -0.7, 0.7, 0.95]);
    const l = [];
    const WELT = {
      krimi: [['schreibmaschine', { ferne: 0.7, pan: seite() }], ['murmeln', { gedaempft: true, ferne: 0.6, dauer: 3, pan: seite() }], ['schritte', { boden, n: 5, ferne: 0.7, pan: seite() }]],
      labor: [['dampf', { ferne: 0.5, pan: seite(), dauer: 1.2 }], ['summer', { ferne: 0.6 }], ['hydraulik', { ferne: 0.6, pan: seite() }]],
      grab: [['steinmahlen', { ferne: 0.7, pan: seite() }], ['kratzen', { inWand: true, pan: seite() }]],
      station: [['hydraulik', { ferne: 0.6, pan: seite() }], ['murmeln', { funk: true, ferne: 0.6, dauer: 2 }], ['schritte', { boden, n: 5, ferne: 0.8, pan: seite() }]],
      spuk: [['schritte', { boden, n: 5, ferne: 0.75, pan: seite() }], ['klavierFern', {}], ['eule', {}]],
      bibliothek: [['seite', { ferne: 0.4, pan: seite() }], ['schritte', { boden, n: 4, ferne: 0.8, pan: seite() }], ['eule', {}]],
      pirat: [['schritte', { boden, n: 4, ferne: 0.7, pan: seite() }], ['muenzen', { ferne: 0.6, pan: seite() }]],
      akademie: [['schritte', { boden, n: 6, ferne: 0.8, pan: seite() }], ['murmeln', { gedaempft: true, ferne: 0.7, dauer: 2.5 }]],
      zirkus: [['drehorgel', {}], ['applaus', {}], ['quietschen', { pan: seite(), ferne: 0.4 }]],
      dschungel: [['affe', { pan: seite() }], ['eule', {}], ['kratzen', { pan: seite(), ferne: 0.4 }]],
      unterwasser: [['hydraulik', { ferne: 0.7, pan: seite() }], ['murmeln', { funk: true, ferne: 0.7, dauer: 2 }], ['kratzen', { pan: seite(), ferne: 0.3 }]],
      spielzeug: [['aufziehen', { pan: seite() }], ['quietschen', { pan: seite() }], ['kichern', { pan: seite(), ferne: 0.4 }]],
      western: [['sporen', { ferne: 0.6, pan: seite() }], ['pferd', {}], ['klavierFern', {}]],
      sanatorium: [['herzmonitor', { ferne: 0.6 }], ['schritte', { boden, n: 5, ferne: 0.7, pan: seite() }], ['murmeln', { gedaempft: true, ferne: 0.7, dauer: 3 }]],
    };
    l.push(...(WELT[welt] || []));
    if (kinder) {
      l.push(['kichern', { pan: seite(), ferne: 0.4 }], ['summen', { froh: true, ferne: 0.5, pan: seite() }], ['quietschen', { pan: seite() }]);
      const freundlich = l.filter(([n]) => !['murmeln', 'kratzen', 'schritte', 'stoehnen', 'atmen', 'fluestern', 'herzmonitor', 'steinmahlen'].includes(n));
      const [n, o] = wahl(freundlich.length ? freundlich : l);
      return Clavis.geraeusch(n, o);
    }
    const spuk = st.spuk || 0; const grusel = st.grusel || 0;
    if (spuk >= 4) l.push(['fluestern', { stimmen: 1, dauer: 2, pan: seite(), ferne: 0.15 }], ['summen', { ferne: 0.6, pan: seite() }]);
    if (spuk >= 7) l.push(['chor', { stimmen: 3, dauer: 3 }], ['fluestern', { stimmen: 3, dauer: 3 }]);
    if (grusel >= 4) l.push(['atmen', { tempo: 'ruhig', n: 2, pan: seite(), ferne: 0.05 }], ['kratzen', { inWand: true, pan: seite() }], ['seufzen', { pan: seite(), ferne: 0.4 }]);
    if (grusel >= 7) l.push(['atmen', { tempo: 'schwer', n: 3, pan: seite(), ferne: 0 }], ['stoehnen', { ferne: 0.6, gedaempft: true }], ['schluchzen', { ferne: 0.7, pan: seite() }]);
    const [n, o] = wahl(l);
    return Clavis.geraeusch(n, o);
  };

  /** Klang, wenn ein Rätsel aufgeht – je Welt ein eigener */
  Clavis.loesungsklang = (welt, alter) => {
    if (!bereit()) return;
    const g = (n, o) => Clavis.geraeusch(n, o);
    switch (welt) {
      case 'grab': case 'dschungel': g('steinmahlen', { laut: 0.7 }); break;
      case 'station': case 'labor': case 'unterwasser': g('hydraulik', { laut: 0.7 }); break;
      case 'krimi': g('riegel'); break;
      case 'pirat': g('muenzen'); break;
      case 'western': g('sporen', { laut: 0.6 }); break;
      case 'zirkus': g('applaus', { laut: 0.6, ferne: 0.3 }); break;
      case 'spielzeug': g('quietschen'); break;
      case 'bibliothek': case 'akademie': g('seite'); break;
      case 'spuk': g('riegel'); break;
      case 'sanatorium': g('summer'); break;
      default: g('riegel');
    }
    if (alter === 'kinder') g('kichern', { ferne: 0.3 });
  };
})();
