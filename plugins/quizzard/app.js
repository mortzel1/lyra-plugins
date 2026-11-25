'use strict';
/*
 * Quizzard – Quiz zu jedem Thema (aus deinen Unterlagen oder beliebig), als Spiel für dich allein: Countdown,
 * Zeitbonus, Serien, Joker, Highscores – und abwechslungsreiche Fragetypen. Alles in den Einstellungen anpassbar.
 */
const { h, mdElement } = lyra;

const TYPEN = {
  auswahl: ['Multiple Choice', 'eine richtige Antwort aus 4'],
  mehrfach: ['Mehrere richtig', 'alle richtigen ankreuzen'],
  wahrfalsch: ['Wahr oder falsch', 'eine Aussage beurteilen'],
  schaetzen: ['Schätzfrage', 'eine Zahl mit dem Regler treffen'],
  reihenfolge: ['Reihenfolge', 'Schritte oder Ereignisse ordnen'],
  zuordnen: ['Zuordnen', 'Paare verbinden'],
  luecke: ['Lückentext', 'das fehlende Wort eintippen'],
  bild: ['Bilderfrage', 'erkennen, was auf dem Foto zu sehen ist – echte Fotos aus Wikipedia (braucht Internet)'],
};

const STANDARD = {
  anzahl: 10,
  zeit: 20,
  schwierigkeit: 'gemischt',
  typen: Object.fromEntries(Object.keys(TYPEN).map((t) => [t, true])),
  quelle: 'beides',
  zeitbonus: true,
  serien: true,
  joker: { fuenfzig: true, zeit: true, ueberspringen: true },
  jokerAnzahl: 1,
  erklaerung: 'immer',
  autoWeiter: 0,
  toene: true,
  konfetti: true,
  mischen: true,
  sprache: 'de',
  ki: 'auto',
};

const SYSTEM = `Du bist der „Quizzard“ in Lyra: Du erstellst spannende, fachlich korrekte Quizfragen für Studierende. \
Jede Frage ist eindeutig, abwechslungsreich formuliert und hat genau eine fachlich richtige Lösung. Formeln in LaTeX \
zwischen $…$. Keine Fangfragen mit Wortklauberei.`;

// Schlüssel so gewählt, dass die alphabetische Reihenfolge Sinn ergibt (das lokale Modell schreibt sie so).
const SCHEMA = {
  type: 'object',
  properties: {
    fragen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          art: { type: 'string', enum: Object.keys(TYPEN) },
          bild: { type: 'string' },
          frage: { type: 'string' },
          max: { type: 'number' },
          min: { type: 'number' },
          optionen: { type: 'array', items: { type: 'string' } },
          paare: { type: 'array', items: { type: 'object', properties: { links: { type: 'string' }, rechts: { type: 'string' } }, required: ['links', 'rechts'] } },
          richtig: { type: 'array', items: { type: 'integer' } },
          schwierigkeit: { type: 'integer' },
          wert: { type: 'number' },
          wissenswert: { type: 'string' },
          zahl_einheit: { type: 'string' },
        },
        required: ['art', 'bild', 'frage', 'max', 'min', 'optionen', 'paare', 'richtig', 'schwierigkeit', 'wert', 'wissenswert', 'zahl_einheit'],
      },
    },
  },
  required: ['fragen'],
};

const z = {
  info: null,
  einst: structuredClone(STANDARD),
  lehrer: 'lyra',
  ansicht: 'lobby', // lobby | zaubern | bereit | countdown | frage | feedback | ende
  bereit: null, // fertig erstelltes Quiz (gespeichert) – jetzt spielen oder später
  meldung: '',
  thema: '',
  themen: [],
  spiel: null,
  pos: 0,
  eingabe: null, // Antwort-Zwischenstand der aktuellen Frage
  ergebnis: null, // Ergebnis der aktuellen Frage
  rekorde: {},
  spiele: [],
  fehler: null,
  hinweis: '',
  timer: null,
  zeitRest: 0,
  zeitGesamt: 0,
  fuenfzigWeg: [],
  bilder: {}, // id → Foto (data:-URL), aus dem Speicher geladen
};
const app = document.getElementById('app');
const online = () => z.lehrer !== 'lyra';
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const zahlFormat = (n) => Math.round(n).toLocaleString('de-DE');

// ================================================================== Töne und Konfetti

// Töne: weich ein- und ausgeblendet (kein Knacken), nur Sinus und Dreieck mit leisem Glocken-Oberton, alles über einen
// gemeinsamen Regler mit Begrenzer (überlagerte Töne übersteuern nicht). WebKit erlaubt Ton erst nach einem Klick oder
// Tastendruck – vorher wird nichts gespielt und auch nichts gesammelt, das später auf einmal losplärrt.
let audio = null;
// In einer Fusion: Material von anderen Plugins statt Auszügen aus den Unterlagen
let fusionMaterial = '';
let summe = null;
function audioBereit() {
  if (!audio) {
    try {
      audio = new AudioContext();
      const begrenzer = audio.createDynamicsCompressor();
      begrenzer.threshold.value = -16;
      begrenzer.knee.value = 12;
      begrenzer.ratio.value = 6;
      begrenzer.attack.value = 0.003;
      begrenzer.release.value = 0.2;
      summe = audio.createGain();
      summe.gain.value = 0.35;
      summe.connect(begrenzer).connect(audio.destination);
    } catch (_) {
      audio = null;
    }
  }
  return audio;
}
for (const ereignis of ['pointerdown', 'keydown']) {
  document.addEventListener(ereignis, () => {
    if (!z.einst.toene) return;
    const a = audioBereit();
    if (a && a.state !== 'running') a.resume().catch(() => {});
  }, true);
}

function note(freq, start, dauer, { typ = 'sine', laut = 0.22, glocke = true } = {}) {
  const t = audio.currentTime + 0.015 + start;
  const huelle = audio.createGain();
  huelle.gain.setValueAtTime(0, t);
  huelle.gain.linearRampToValueAtTime(laut, t + 0.012); // weich an
  huelle.gain.setTargetAtTime(0, t + 0.012, dauer / 4); // natürlich ausklingen
  huelle.connect(summe);
  const stimmen = [[freq, 1, typ]];
  if (glocke) stimmen.push([freq * 2, 0.22, 'sine'], [freq * 3, 0.08, 'sine']);
  for (const [f, anteil, art] of stimmen) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = art;
    o.frequency.setValueAtTime(f, t);
    g.gain.value = anteil;
    o.connect(g).connect(huelle);
    o.start(t);
    o.stop(t + dauer + 0.4);
  }
}

function ton(art) {
  if (!z.einst.toene || !audio || audio.state !== 'running') return;
  try {
    switch (art) {
      case 'richtig': note(783.99, 0, 0.16); note(1046.5, 0.08, 0.35); break; // G5 → C6
      case 'teils': note(880, 0, 0.25, { laut: 0.16 }); break; // A5
      case 'falsch': note(311.13, 0, 0.2, { typ: 'triangle', laut: 0.18, glocke: false }); note(233.08, 0.13, 0.32, { typ: 'triangle', laut: 0.18, glocke: false }); break;
      case 'tick': note(1318.5, 0, 0.05, { laut: 0.05, glocke: false }); break;
      case 'count': note(587.33, 0, 0.18, { typ: 'triangle', laut: 0.18 }); break;
      case 'los': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.07, 0.28, { laut: 0.16 })); break;
      case 'ende':
        [523.25, 659.25, 783.99].forEach((f, i) => note(f, i * 0.12, 0.3, { laut: 0.16 }));
        note(1046.5, 0.4, 0.8, { laut: 0.16 });
        note(1318.5, 0.4, 0.8, { laut: 0.1 });
        break;
    }
  } catch (_) {}
}

function konfetti(viel = 90) {
  if (!z.einst.konfetti) return;
  const farben = ['#ff5c8a', '#22c3a6', '#ffb020', '#4f8bff', '#b46cff', '#fde047'];
  for (let i = 0; i < viel; i++) {
    const k = document.createElement('div');
    k.className = 'konfetti';
    k.style.left = Math.random() * 100 + 'vw';
    k.style.background = farben[i % farben.length];
    k.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
    k.style.animationDelay = Math.random() * 0.4 + 's';
    k.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(k);
    setTimeout(() => k.remove(), 4200);
  }
}

// ================================================================== Start, Speicher

async function start() {
  try {
    z.info = await lyra.info();
  } catch (_) {
    z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' };
  }
  try {
    const e = (await lyra.speicher.lesen('einstellungen')) || {};
    z.einst = { ...structuredClone(STANDARD), ...e, typen: { ...STANDARD.typen, ...(e.typen || {}) }, joker: { ...STANDARD.joker, ...(e.joker || {}) } };
  } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { z.rekorde = (await lyra.speicher.lesen('rekorde')) || {}; } catch (_) {}
  try {
    z.spiele = (await lyra.speicher.liste('spiele')).map((e) => e.wert).filter(Boolean).sort((a, b) => b.zeit - a.zeit);
  } catch (_) {}
  lyra.bei('zurueck', zurueck);
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  // Von der Startseite: ein gespeichertes Quiz direkt zum Spielen anbieten
  const q = route.startsWith('spiel/') && z.spiele.find((x) => x.id === route.slice(6));
  if (q) {
    z.bereit = q;
    z.ansicht = 'bereit';
  }
  // Aus einem Raum von Lyra Campus geöffnet: geteiltes Quiz als Aufgabe oder Live-Runde
  if (route === 'campus') await campusStarten();
  zeichnen();
  if (route === 'einstellungen') einstellungen();
  lyra.themen().then((t) => { z.themen = t || []; if (z.ansicht === 'lobby') zeichnen(); }).catch(() => {});
  startseite();
}

async function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.ansicht === 'lobby' || istCampusAnsicht(z.ansicht)) return lyra.zurueck();
  if (z.ansicht === 'bereit') z.meldung = '';
  if (z.ansicht === 'zaubern') lyra.abbrechen();
  if ((z.ansicht === 'frage' || z.ansicht === 'feedback') && !(await lyra.bestaetigen({ titel: 'Quiz abbrechen?', text: 'Dein Spielstand geht verloren.', ja: 'Quiz abbrechen', nein: 'Weiterspielen', gefahr: true }))) return;
  stoppeTimer();
  // Aus einem Raum: zurück zur Aufgabe bzw. den Ergebnissen statt in die eigene Lobby
  const k = online2.kontext;
  z.ansicht = k ? (k.host ? (k.inhalt.modus === 'live' ? 'liveHost' : 'campusHost') : (k.inhalt.modus === 'live' ? 'liveWarten' : 'campusAufgabe')) : 'lobby';
  zeichnen();
}

function startseite() {
  const eintraege = [];
  // Gespeichert, aber noch nicht gespielt: „Quiz bereit“ (die zwei neuesten)
  for (const q of z.spiele.filter((x) => !x.gespielt).slice(0, 2)) {
    eintraege.push({
      id: 'bereit-' + q.id,
      titel: `Quiz bereit: ${q.thema}`,
      untertitel: `${q.fragen.length} Fragen – jetzt spielen?`,
      route: 'spiel/' + q.id,
      zeigen_bis: q.zeit + 14 * 86400,
      geaendert: q.zeit,
    });
  }
  const letztes = z.spiele.find((x) => x.gespielt);
  if (letztes) {
    const rekord = z.rekorde[letztes.thema.toLowerCase()];
    eintraege.push({
      id: 'revanche',
      titel: `Quiz: ${letztes.thema}`,
      untertitel: rekord ? `Rekord ${zahlFormat(rekord.punkte)} Punkte – Revanche?` : 'Nochmal spielen?',
      route: 'spiel/' + letztes.id,
      zeigen_bis: (letztes.gespieltAm || letztes.zeit) + 7 * 86400,
      geaendert: letztes.gespieltAm || letztes.zeit,
    });
  }
  lyra.startseite(eintraege).catch(() => {});
}

/** Quiz sichern (gleich nach dem Erstellen – gespielt wird, wann du willst). */
async function quizSichern(q) {
  try { await lyra.speicher.schreiben('spiele/' + q.id, q); } catch (_) {}
  z.spiele = [q, ...z.spiele.filter((x) => x.id !== q.id)];
  startseite();
}

async function quizLoeschen(q) {
  if (!(await lyra.bestaetigen({ titel: `Quiz „${q.thema}“ löschen?`, text: `Die ${q.fragen.length} Fragen sind dann weg (dein Rekord bleibt).`, ja: 'Löschen', nein: 'Abbrechen', gefahr: true }))) return;
  try { await lyra.speicher.loeschen('spiele/' + q.id); } catch (_) {}
  for (const f of q.fragen) if (f.art === 'bild' && f.bild) { try { await lyra.speicher.loeschen('bilder/' + f.bild.id); } catch (_) {} delete z.bilder[f.bild.id]; }
  z.spiele = z.spiele.filter((x) => x.id !== q.id);
  startseite();
  zeichnen();
}

// ================================================================== Quiz erstellen

function typenText() {
  const an = Object.keys(TYPEN).filter((t) => z.einst.typen[t]);
  const b = {
    auswahl: '"auswahl": genau 4 "optionen", genau eine richtig ("richtig": [Nummer ab 0])',
    mehrfach: '"mehrfach": 4 bis 5 "optionen", zwei oder drei richtig ("richtig": [Nummern])',
    wahrfalsch: '"wahrfalsch": "frage" ist eine Aussage; "richtig": [0] wenn wahr, [1] wenn falsch',
    schaetzen: '"schaetzen": Antwort ist eine Zahl in "wert" (mit "zahl_einheit"), "min" und "max" geben einen sinnvollen Bereich für einen Schieberegler',
    reihenfolge: '"reihenfolge": 3 bis 5 "optionen" in der RICHTIGEN Reihenfolge (die App mischt sie)',
    zuordnen: '"zuordnen": 3 bis 4 "paare" aus "links" und "rechts", die zusammengehören',
    luecke: '"luecke": "frage" enthält ___ für das fehlende Wort; "optionen" sind die akzeptierten Antworten (Schreibweisen)',
    bild: '"bild": Bilderfrage – "bild" ist NUR der Titel eines deutschen Wikipedia-Artikels (1–3 Wörter, z. B. „Rotfuchs“, '
      + '„Kolosseum“, „Mona Lisa“ – keine Bildbeschreibung), dessen Hauptbild das Gesuchte eindeutig zeigt (ein Bauwerk, Tier, '
      + 'eine Pflanze, ein Kunstwerk, eine Person, ein Gerät, Ort oder Organ); "frage" fragt danach, '
      + 'ohne es zu verraten (z. B. „Welches Bauwerk ist hier zu sehen?“); genau 4 "optionen", eine richtig ("richtig": [Nummer ab 0]). '
      + 'Nur, wenn es zum Thema passende, gut erkennbare Motive gibt – höchstens jede dritte Frage',
  };
  return an.map((t) => '- ' + b[t]).join('\n');
}

/** Schema nur mit den eingeschalteten Fragetypen (sonst greift ein kleines Modell gern zu „auswahl“). */
function schemaFuer() {
  const s = structuredClone(SCHEMA);
  s.properties.fragen.items.properties.art.enum = Object.keys(TYPEN).filter((t) => z.einst.typen[t]);
  return s;
}

function schwierigkeitText() {
  return {
    leicht: 'leicht – Grundbegriffe und Einstieg',
    mittel: 'mittel – solides Verständnis nötig',
    schwer: 'schwer – Details, Zusammenhänge, knifflige Anwendungen',
    gemischt: 'gemischt – von leicht bis schwer',
    steigend: 'steigend – die ersten leicht, die letzten schwer, in dieser Reihenfolge',
  }[z.einst.schwierigkeit];
}

function pruefen(f) {
  const art = Object.keys(TYPEN).includes(f.art) ? f.art : null;
  const frage = text(f.frage);
  if (!art || !frage) return null;
  const optionen = (f.optionen || []).map(text).filter(Boolean);
  const richtig = [...new Set((f.richtig || []).filter((x) => Number.isInteger(x)))];
  const q = { art, frage, wissenswert: text(f.wissenswert), schwierigkeit: f.schwierigkeit || 2 };
  switch (art) {
    case 'auswahl':
      if (optionen.length < 2 || richtig.length !== 1 || richtig[0] >= optionen.length) return null;
      return { ...q, optionen: optionen.slice(0, 6), richtig };
    case 'mehrfach':
      if (optionen.length < 3 || !richtig.length || richtig.some((r) => r >= optionen.length)) return null;
      return { ...q, optionen: optionen.slice(0, 6), richtig: richtig.sort() };
    case 'wahrfalsch':
      if (richtig[0] !== 0 && richtig[0] !== 1) return null;
      return { ...q, optionen: ['Wahr', 'Falsch'], richtig: [richtig[0]] };
    case 'schaetzen': {
      const wert = Number(f.wert);
      if (!Number.isFinite(wert)) return null;
      let min = Number(f.min);
      let max = Number(f.max);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max || wert < min || wert > max) {
        const spanne = Math.abs(wert) || 10;
        min = wert >= 0 ? 0 : wert - spanne;
        max = wert + spanne;
      }
      return { ...q, wert, min, max, einheit: text(f.zahl_einheit) };
    }
    case 'reihenfolge':
      if (optionen.length < 3) return null;
      return { ...q, optionen: optionen.slice(0, 6) };
    case 'zuordnen': {
      const paare = (f.paare || []).map((p) => ({ links: text(p.links), rechts: text(p.rechts) })).filter((p) => p.links && p.rechts).slice(0, 5);
      if (paare.length < 3) return null;
      return { ...q, paare };
    }
    case 'luecke':
      if (!optionen.length) return null;
      return { ...q, frage: frage.includes('___') ? frage : frage + ' ___', optionen };
    case 'bild':
      if (!text(f.bild) || optionen.length < 2 || richtig.length !== 1 || richtig[0] >= optionen.length) return null;
      return { ...q, optionen: optionen.slice(0, 6), richtig, begriff: text(f.bild).slice(0, 120) };
  }
  return null;
}

// ================================================================== Bilder (echte Fotos aus Wikipedia)

/** Foto auf höchstens 900 px verkleinern (JPEG) – spart Platz im Speicher. */
function verkleinern(daten) {
  return new Promise((fertig) => {
    const img = new Image();
    img.onload = () => {
      try {
        const f = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * f));
        c.height = Math.max(1, Math.round(img.naturalHeight * f));
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        const klein = c.toDataURL('image/jpeg', 0.84);
        fertig(klein.length < daten.length ? klein : daten);
      } catch (_) { fertig(daten); }
    };
    img.onerror = () => fertig(null);
    img.src = daten;
  });
}

/** Passt ein Artikeltitel zu einem Begriff? (wie im Kern: einer steckt im anderen und macht den Großteil davon aus) */
function titelPasst(begriff, titel) {
  const norm = (t) => String(t || '').split('(')[0].toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 's').replace(/[^a-z0-9]/g, '');
  const a = norm(begriff), b = norm(titel);
  const [kurz, lang] = a.length <= b.length ? [a, b] : [b, a];
  return kurz.length >= 3 && lang.includes(kurz) && kurz.length * 10 >= lang.length * 6;
}

/** Zeigt das Foto wirklich das Gesuchte? Nein, wenn sein Artikel zu einer falschen Antwort passt. */
function fotoPasst(f, b) {
  if (!b || !b.gefunden) return false;
  const falsche = f.optionen.filter((_, i) => !f.richtig.includes(i));
  return !falsche.some((o) => titelPasst(o, b.artikel));
}

/** Holt die Fotos zu den Bilderfragen (Hauptbild des Wikipedia-Artikels) und speichert sie einzeln. Fragen ohne
 *  passendes Foto fallen weg. → {fragen, meldung} */
async function bilderHolen(quizId, fragen) {
  const bild = fragen.filter((f) => f.art === 'bild');
  if (!bild.length) return { fragen, meldung: '' };
  z.hinweis = `Hole ${bild.length} Foto${bild.length === 1 ? '' : 's'} aus Wikipedia …`;
  const el = document.getElementById('hinweis');
  if (el) el.textContent = z.hinweis;
  let liste = [];
  let meldung = '';
  try {
    liste = await lyra.bilder(bild.map((f) => f.begriff));
    // Zweiter Versuch mit der richtigen Antwort als Begriff, wo nichts Passendes kam
    const nochmal = bild.map((f, i) => (fotoPasst(f, liste[i]) ? null : i)).filter((i) => i !== null);
    if (nochmal.length) {
      const zweite = await lyra.bilder(nochmal.map((i) => bild[i].optionen[bild[i].richtig[0]]));
      nochmal.forEach((i, k) => { if (fotoPasst(bild[i], zweite[k])) liste[i] = zweite[k]; });
    }
  } catch (e) { meldung = 'Fotos ließen sich nicht laden (' + String((e && e.message) || e) + ') – die Bilderfragen fallen weg.'; }
  for (const [i, f] of bild.entries()) {
    const b = fotoPasst(f, liste[i]) ? liste[i] : null;
    const daten = b && b.gefunden ? await verkleinern(b.bild) : null;
    if (!daten) { f.weg = true; continue; }
    const id = `${quizId}-${i}`;
    try { await lyra.speicher.schreiben('bilder/' + id, daten); } catch (_) { f.weg = true; continue; }
    z.bilder[id] = daten;
    f.bild = { id, urheber: text(b.urheber), lizenz: text(b.lizenz), lizenzUrl: text(b.lizenzUrl), dateiUrl: text(b.dateiUrl), artikel: text(b.artikel), artikelUrl: text(b.artikelUrl) };
  }
  const weg = bild.filter((f) => f.weg).length;
  if (weg && !meldung) meldung = weg === 1 ? 'Zu einer Bilderfrage gab es kein passendes Foto – sie fällt weg.' : `Zu ${weg} Bilderfragen gab es kein passendes Foto – sie fallen weg.`;
  return { fragen: fragen.filter((f) => !f.weg), meldung };
}

/** Fotos eines Quiz laden (vor dem Spielen). Fehlt eins, fällt die Frage weg. */
async function bilderLaden(fragen) {
  for (const f of fragen) {
    if (f.art !== 'bild' || !f.bild || z.bilder[f.bild.id]) continue;
    try { const d = await lyra.speicher.lesen('bilder/' + f.bild.id); if (d) z.bilder[f.bild.id] = d; } catch (_) {}
  }
  return fragen.filter((f) => f.art !== 'bild' || (f.bild && z.bilder[f.bild.id]));
}

function foto(f, fertig) {
  const b = f.bild;
  const link = (t, url) => (url ? h('button', { class: 'foto-link', onclick: () => lyra.link(url).catch(() => {}) }, t) : t);
  return h('figure', { class: 'foto' },
    h('img', { src: z.bilder[b.id], alt: fertig ? b.artikel : 'Foto zur Frage' }),
    h('figcaption', {},
      'Foto: ', b.urheber || 'unbekannt', b.lizenz ? ` · ${b.lizenz}` : '', ' · ', link('Wikimedia Commons', b.dateiUrl),
      fertig && b.artikelUrl ? [' · Mehr dazu: ', link(`Wikipedia – ${b.artikel}`, b.artikelUrl)] : null));
}

async function erstellen() {
  const thema = z.thema.trim();
  if (!thema) return;
  const anzahl = Math.max(3, Math.min(50, z.einst.anzahl));
  z.ansicht = 'zaubern';
  z.fehler = null;
  z.meldung = '';
  z.hinweis = 'Suche passende Stellen …';
  zeichnen();
  let block = fusionMaterial;
  if (!block && z.einst.quelle !== 'wissen') {
    try { block = (await lyra.suchen(thema, online() ? 12 : 7)).block || ''; } catch (_) {}
    if (!block && z.einst.quelle === 'unterlagen') {
      z.fehler = 'Dazu habe ich in deinen Unterlagen nichts gefunden – wähle „Beides“ oder „Allgemeinwissen“ und versuch es nochmal.';
      z.ansicht = 'lobby';
      return zeichnen();
    }
  }
  let fragen = [];
  const proRunde = online() ? 15 : 8;
  let leer = 0;
  while (fragen.length < anzahl && leer < 2) {
    const n = Math.min(proRunde, anzahl - fragen.length);
    const schon = fragen.map((f) => '- ' + f.frage.slice(0, 100)).join('\n');
    let r = null;
    try {
      r = await lyra.ki({
        lehrer: z.lehrer,
        system: SYSTEM,
        prompt: `Thema des Quiz: ${thema}\nSchwierigkeit: ${schwierigkeitText()}\nSprache der Fragen: ${z.einst.sprache === 'en' ? 'Englisch' : 'Deutsch'}\n\n\
${block ? `Auszüge aus meinen Unterlagen (stütze dich darauf${z.einst.quelle === 'beides' ? ', ergänze mit Allgemeinwissen' : ''}):\n\n${block}` : 'Nutze gesichertes Allgemeinwissen.\n\n'}\
${schon ? `Diese Fragen gibt es schon – keine davon wiederholen:\n${schon}\n\n` : ''}\
Erstelle genau ${n} neue Quizfragen. Mische diese Fragetypen möglichst gleichmäßig (nie mehrmals hintereinander derselbe):\n${typenText()}\n\n\
Alle Felder sind Pflicht – was ein Typ nicht braucht, bleibt leer ("bild": "", "optionen": [], "paare": [], "richtig": [], "wert": 0, "min": 0, "max": 0, "zahl_einheit": ""). \
"wissenswert" erklärt in 1 bis 2 Sätzen die Lösung, gern mit einem Aha-Fakt. "schwierigkeit": 1 leicht, 2 mittel, 3 schwer.\n\n\
Antwort als JSON: {"fragen": [{"art": "auswahl", "bild": "", "frage": "…", "max": 0, "min": 0, "optionen": ["…"], "paare": [], "richtig": [0], "schwierigkeit": 1, "wert": 0, "wissenswert": "…", "zahl_einheit": ""}]}`,
        schema: schemaFuer(),
        zaehlen: { schluessel: 'frage', wort: 'Frage' },
      }, (e) => {
        if (e.art === 'hinweis') {
          const m = e.text.match(/Frage (\d+)/);
          z.hinweis = m ? `Frage ${Math.min(anzahl, fragen.length + Number(m[1]))} von ${anzahl} …` : e.text;
          const el = document.getElementById('hinweis');
          if (el) el.textContent = z.hinweis;
        }
      });
      if (r && r.lehrer && r.lehrer !== z.lehrer) z.lehrer = r.lehrer;
    } catch (e) {
      const m = String((e && e.message) || e);
      if (/ABGEBROCHEN|Abgebrochen/.test(m)) { z.ansicht = 'lobby'; return zeichnen(); }
      z.fehler = m;
      break;
    }
    const neu = ((r && r.json && r.json.fragen) || []).map(pruefen).filter(Boolean)
      .filter((f) => !fragen.some((g) => g.frage.toLowerCase() === f.frage.toLowerCase()));
    leer = neu.length ? 0 : leer + 1;
    fragen.push(...neu.slice(0, anzahl - fragen.length));
  }
  const id = lyra.neueId();
  const mitBildern = await bilderHolen(id, fragen);
  fragen = mitBildern.fragen;
  if (fragen.length < 3) {
    z.fehler = z.fehler || mitBildern.meldung || 'Das Quiz ist nicht gelungen – bitte nochmal versuchen.';
    z.ansicht = 'lobby';
    return zeichnen();
  }
  if (z.einst.schwierigkeit === 'steigend') fragen.sort((a, b) => a.schwierigkeit - b.schwierigkeit);
  // Erst sichern, dann fragen: jetzt spielen oder später?
  const quiz = { id, thema, fragen, zeit: lyra.jetzt(), gespielt: 0 };
  z.meldung = mitBildern.meldung;
  await quizSichern(quiz);
  z.bereit = quiz;
  z.ansicht = 'bereit';
  z.thema = '';
  ton('los');
  zeichnen();
}

// ================================================================== Spielen

async function spielStarten(quiz, nurDiese) {
  const fragen = (await bilderLaden(nurDiese || quiz.fragen)).map((f) => vorbereiten(f));
  if (!fragen.length) { z.fehler = 'Die Fotos dieses Quiz fehlen – bitte erstelle es neu.'; z.ansicht = 'lobby'; return zeichnen(); }
  const jk = z.einst.jokerAnzahl;
  z.spiel = {
    quiz,
    fragen,
    antworten: [],
    punkte: 0,
    serie: 0,
    besteSerie: 0,
    start: Date.now(),
    joker: { fuenfzig: z.einst.joker.fuenfzig ? jk : 0, zeit: z.einst.joker.zeit ? jk : 0, ueberspringen: z.einst.joker.ueberspringen ? jk : 0 },
  };
  z.pos = 0;
  countdown();
}

/** Antworten mischen (die richtigen Nummern merken). */
function vorbereiten(f) {
  const q = structuredClone(f);
  if ((q.art === 'auswahl' || q.art === 'mehrfach' || q.art === 'bild') && z.einst.mischen) {
    const reihe = lyra.mischen(q.optionen.map((o, i) => ({ o, i })));
    q.optionen = reihe.map((x) => x.o);
    q.richtig = reihe.map((x, neu) => (f.richtig.includes(x.i) ? neu : -1)).filter((x) => x >= 0);
  }
  if (q.art === 'reihenfolge') {
    q.loesung = q.optionen.slice();
    let m = lyra.mischen(q.optionen);
    if (m.every((x, i) => x === q.loesung[i])) m = m.slice().reverse();
    q.optionen = m;
  }
  if (q.art === 'zuordnen') q.rechtsGemischt = lyra.mischen(q.paare.map((p) => p.rechts));
  return q;
}

function countdown() {
  z.ansicht = 'countdown';
  let n = 3;
  const schritt = () => {
    if (z.ansicht !== 'countdown') return;
    if (n === 0) {
      ton('los');
      return frageZeigen();
    }
    ton('count');
    app.replaceChildren(h('div', { class: 'countdown', key: n }, String(n)));
    n--;
    setTimeout(schritt, 800);
  };
  schritt();
}

function frageZeigen() {
  const f = z.spiel.fragen[z.pos];
  z.ansicht = 'frage';
  z.ergebnis = null;
  z.fuenfzigWeg = [];
  z.frageGemalt = false;
  z.eingabe = f.art === 'reihenfolge' ? f.optionen.slice() : f.art === 'schaetzen' ? schaetzStart(f) : f.art === 'zuordnen' ? { aktiv: 0, zu: {} } : f.art === 'luecke' ? '' : [];
  z.zeitGesamt = z.einst.zeit ? z.einst.zeit * (['reihenfolge', 'zuordnen', 'luecke'].includes(f.art) ? 1.5 : 1) : 0;
  z.zeitRest = z.zeitGesamt;
  zeichnen();
  stoppeTimer();
  if (z.zeitGesamt) {
    let letzterTick = Math.ceil(z.zeitRest);
    z.timer = setInterval(() => {
      z.zeitRest = Math.max(0, z.zeitRest - 0.1);
      const b = document.querySelector('.zeitbalken > div');
      if (b) b.style.width = `${(z.zeitRest / z.zeitGesamt) * 100}%`;
      const s = document.getElementById('sekunden');
      if (s) s.textContent = `${Math.ceil(z.zeitRest)} s`;
      if (Math.ceil(z.zeitRest) !== letzterTick) {
        letzterTick = Math.ceil(z.zeitRest);
        if (letzterTick <= 5 && letzterTick > 0) ton('tick');
      }
      if (z.zeitRest <= 0) abgeben(true);
    }, 100);
  }
}

/** Startwert des Schätz-Reglers: zufällig, aber nie nah an der Lösung (sonst gäbe es Punkte fürs Nichtstun). */
function schaetzStart(f) {
  const spanne = f.max - f.min || 1;
  let v = f.min + spanne / 2;
  for (let i = 0; i < 20; i++) {
    v = f.min + spanne * (0.1 + Math.random() * 0.8);
    if (Math.abs(v - f.wert) > spanne * 0.2) break;
  }
  const schritt = spanne / 200;
  f.start = Math.round(v / schritt) * schritt;
  return f.start;
}

function stoppeTimer() {
  if (z.timer) clearInterval(z.timer);
  z.timer = null;
}

const normal = (t) => String(t).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
function abstand(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Wie richtig ist die Antwort? 0–1 */
function bewerten(f, e, zeitAus) {
  switch (f.art) {
    case 'auswahl':
    case 'bild':
    case 'wahrfalsch':
      return e.length === 1 && f.richtig.includes(e[0]) ? 1 : 0;
    case 'mehrfach': {
      if (!e.length) return 0;
      const treffer = e.filter((x) => f.richtig.includes(x)).length;
      const falsch = e.length - treffer;
      return treffer === f.richtig.length && !falsch ? 1 : Math.max(0, (treffer - falsch) / f.richtig.length) * 0.8;
    }
    case 'schaetzen': {
      if (zeitAus && e === f.start) return 0; // Regler nicht bewegt
      const spanne = f.max - f.min || 1;
      const daneben = Math.abs(e - f.wert) / spanne;
      return daneben <= 0.02 ? 1 : Math.max(0, 1 - daneben / 0.25);
    }
    case 'reihenfolge':
      return e.filter((x, i) => x === f.loesung[i]).length / f.loesung.length;
    case 'zuordnen': {
      const richtige = f.paare.filter((p, i) => e.zu[i] === p.rechts).length;
      return richtige / f.paare.length;
    }
    case 'luecke': {
      const a = normal(e);
      if (!a) return 0;
      return f.optionen.some((o) => { const b = normal(o); return a === b || (b.length >= 5 && abstand(a, b) <= 1); }) ? 1 : 0;
    }
  }
  return 0;
}

function abgeben(zeitAus = false) {
  if (z.ansicht !== 'frage') return;
  stoppeTimer();
  const s = z.spiel;
  const f = s.fragen[z.pos];
  const teil = bewerten(f, z.eingabe, zeitAus);
  let punkte = 0;
  if (teil > 0) {
    const anteil = z.einst.zeitbonus && z.zeitGesamt ? 0.5 + 0.5 * (z.zeitRest / z.zeitGesamt) : 1;
    punkte = 1000 * anteil * teil * (0.85 + 0.15 * (f.schwierigkeit || 2));
    if (z.fuenfzigWeg.length) punkte *= 0.5;
  }
  if (teil >= 0.999) {
    s.serie++;
    s.besteSerie = Math.max(s.besteSerie, s.serie);
    if (z.einst.serien && s.serie > 1) punkte += Math.min(s.serie - 1, 5) * 100;
  } else s.serie = 0;
  punkte = Math.round(punkte);
  s.punkte += punkte;
  s.antworten.push({ teil, punkte, eingabe: structuredClone(z.eingabe), zeitAus });
  z.ergebnis = { teil, punkte, zeitAus };
  // Live-Runde: Antwort an den Host, aufgelöst wird für alle gemeinsam
  if (s.live) return liveAbgegeben(teil, punkte);
  z.ansicht = 'feedback';
  ton(teil >= 0.999 ? 'richtig' : teil > 0 ? 'teils' : 'falsch');
  if (teil >= 0.999 && s.serie >= 3) konfetti(40);
  zeichnen();
  if (z.einst.autoWeiter) setTimeout(() => { if (z.ansicht === 'feedback' && s === z.spiel) weiter(); }, z.einst.autoWeiter * 1000);
}

function weiter() {
  const s = z.spiel;
  if (z.pos < s.fragen.length - 1) {
    z.pos++;
    frageZeigen();
  } else ende();
}

async function ende() {
  const s = z.spiel;
  z.ansicht = 'ende';
  const schluessel = s.quiz.thema.toLowerCase();
  const alt = z.rekorde[schluessel];
  s.neuerRekord = !alt || s.punkte > alt.punkte;
  if (s.neuerRekord) {
    z.rekorde[schluessel] = { thema: s.quiz.thema, punkte: s.punkte, richtig: s.antworten.filter((a) => a.teil >= 0.999).length, anzahl: s.fragen.length, zeit: lyra.jetzt() };
    try { await lyra.speicher.schreiben('rekorde', z.rekorde); } catch (_) {}
  }
  s.quiz.gespielt = (s.quiz.gespielt || 0) + 1;
  s.quiz.gespieltAm = lyra.jetzt();
  await quizSichern(s.quiz);
  ton('ende');
  konfetti(s.neuerRekord ? 160 : 70);
  zeichnen();
  if (s.campus) campusAbgeben(s);
}

function joker(art) {
  const s = z.spiel;
  const f = s.fragen[z.pos];
  if (!s.joker[art] || z.ansicht !== 'frage') return;
  if (art === 'fuenfzig') {
    if ((f.art !== 'auswahl' && f.art !== 'bild') || z.fuenfzigWeg.length) return;
    const falsche = lyra.mischen(f.optionen.map((_, i) => i).filter((i) => !f.richtig.includes(i)));
    z.fuenfzigWeg = falsche.slice(0, Math.max(1, f.optionen.length - 2));
  } else if (art === 'zeit') {
    if (!z.zeitGesamt) return;
    z.zeitRest += 10;
    z.zeitGesamt += 10;
  } else if (art === 'ueberspringen') {
    s.joker[art]--;
    stoppeTimer();
    s.antworten.push({ teil: 0, punkte: 0, eingabe: null, uebersprungen: true });
    z.ergebnis = { teil: 0, punkte: 0, uebersprungen: true };
    z.ansicht = 'feedback';
    zeichnen();
    return;
  }
  s.joker[art]--;
  zeichnen();
}

// ================================================================== Einstellungen

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = structuredClone(z.einst);
  const wahl = (pfad, optionen) => {
    const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
    const lesen = () => pfad.split('.').reduce((o, k) => o[k], e);
    const setzen = (w) => { const t = pfad.split('.'); const l = t.pop(); t.reduce((o, k) => o[k], e)[l] = w; };
    const malen = () => box.replaceChildren(...optionen.map(([w, name]) =>
      h('button', { class: 'chip' + (lesen() === w ? ' an' : ''), onclick: () => { setzen(w); malen(); } }, name)));
    malen();
    return box;
  };
  const typen = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
  const typenMalen = () => typen.replaceChildren(...Object.entries(TYPEN).map(([t, [name, erkl]]) =>
    h('button', {
      class: 'chip' + (e.typen[t] ? ' an' : ''), title: erkl,
      onclick: () => { e.typen[t] = !e.typen[t]; if (!Object.values(e.typen).some(Boolean)) e.typen[t] = true; typenMalen(); },
    }, (e.typen[t] ? '✓ ' : '') + name)));
  typenMalen();
  const anzahlWert = h('b', {}, String(e.anzahl));
  const anzahl = h('input', { type: 'range', min: 3, max: 50, step: 1, value: e.anzahl });
  anzahl.addEventListener('input', () => { e.anzahl = Number(anzahl.value); anzahlWert.textContent = anzahl.value; });
  const gruppe = (titel, inhalt, erkl) => h('div', { class: 'einst-gruppe' }, h('div', { class: 'fett' }, titel), erkl ? h('div', { class: 'leise klein', style: { marginBottom: '6px' } }, erkl) : null, inhalt);
  const ok = await lyra.dialog('Quizzard – alles einstellen', h('div', {},
    gruppe('Fragen pro Quiz', h('div', { class: 'zeile' }, anzahl, anzahlWert)),
    gruppe('Zeitlimit pro Frage', wahl('zeit', [[0, 'Kein Zeitlimit'], [10, '10 s'], [15, '15 s'], [20, '20 s'], [30, '30 s'], [45, '45 s'], [60, '60 s'], [90, '90 s']]),
      'Ohne Zeitlimit läuft keine Uhr (und es gibt keinen Zeitbonus). Bei Reihenfolge, Zuordnen und Lückentext gibt es 50 % mehr Zeit.'),
    gruppe('Schwierigkeit', wahl('schwierigkeit', [['leicht', 'Leicht'], ['mittel', 'Mittel'], ['schwer', 'Schwer'], ['gemischt', 'Gemischt'], ['steigend', 'Steigend']])),
    gruppe('Fragetypen', typen, 'Mindestens einer bleibt an.'),
    gruppe('Woher die Fragen kommen', wahl('quelle', [['unterlagen', 'Nur meine Unterlagen'], ['beides', 'Unterlagen + Wissen'], ['wissen', 'Allgemeinwissen']])),
    gruppe('Sprache der Fragen', wahl('sprache', [['de', 'Deutsch'], ['en', 'Englisch']])),
    gruppe('Punkte', h('div', { class: 'spalte', style: { gap: '6px' } },
      wahl('zeitbonus', [[true, 'Mit Zeitbonus'], [false, 'Ohne Zeitbonus']]),
      wahl('serien', [[true, 'Serien-Bonus 🔥'], [false, 'Ohne Serien-Bonus']]))),
    gruppe('Joker', h('div', { class: 'spalte', style: { gap: '6px' } },
      wahl('joker.fuenfzig', [[true, '50:50 an'], [false, '50:50 aus']]),
      wahl('joker.zeit', [[true, '+10 s an'], [false, '+10 s aus']]),
      wahl('joker.ueberspringen', [[true, 'Überspringen an'], [false, 'Überspringen aus']]),
      wahl('jokerAnzahl', [[1, '1× pro Spiel'], [2, '2× pro Spiel'], [3, '3× pro Spiel']]))),
    gruppe('Erklärung nach jeder Frage', wahl('erklaerung', [['immer', 'Immer'], ['fehler', 'Nur bei Fehlern'], ['nie', 'Erst am Ende']])),
    gruppe('Automatisch weiter', wahl('autoWeiter', [[0, 'Nein'], [3, 'Nach 3 s'], [5, 'Nach 5 s'], [8, 'Nach 8 s']])),
    gruppe('Antworten mischen', wahl('mischen', [[true, 'Ja'], [false, 'Nein']])),
    gruppe('Effekte', h('div', { class: 'spalte', style: { gap: '6px' } },
      wahl('toene', [[true, '🔊 Töne an'], [false, '🔇 Töne aus']]),
      wahl('konfetti', [[true, '🎉 Konfetti an'], [false, 'Konfetti aus']]))),
    gruppe('Wer die Fragen zaubert', wahl('ki', [['auto', 'Automatisch (Claude, ChatGPT, Gemini – wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']]),
      'Mit Claude, ChatGPT oder Gemini gehen dein Thema und die passenden Auszüge an den Anbieter.')), [
    { text: 'Zurücksetzen', art: 'text', wert: 'reset' },
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = ok === 'reset' ? structuredClone(STANDARD) : e;
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {}
  zeichnen();
}

async function schnellSetzen(schluessel, wert) {
  z.einst[schluessel] = wert;
  try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {}
  zeichnen();
}

// ================================================================== Ansichten

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  // Innerhalb einer Frage nicht jedes Mal die Rein-Animationen abspielen
  const ruhig = (z.ansicht === 'frage' || z.ansicht === 'feedback') && z.frageGemalt;
  app.replaceChildren(h('div', { class: 'buehne' + (ruhig ? ' ruhig' : '') }, ansicht()));
  if (z.ansicht === 'frage') z.frageGemalt = true;
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) e.focus();
  else if (z.ansicht === 'frage') { const l = document.querySelector('[data-feld="luecke"]'); if (l) l.focus(); }
  lyra.titel(z.spiel && ['frage', 'feedback', 'ende'].includes(z.ansicht) ? z.spiel.quiz.thema : '');
}

function ansicht() {
  if (istCampusAnsicht(z.ansicht) || z.ansicht === 'liveAbgelehnt') return campusAnsicht();
  switch (z.ansicht) {
    case 'zaubern':
      return h('div', { class: 'zaubern' }, h('div', { class: 'hut' }, '🧙'), h('h2', { style: { marginTop: '14px' } }, 'Der Quizzard zaubert dein Quiz …'),
        h('p', { class: 'leise', id: 'hinweis', style: { marginTop: '8px' } }, z.hinweis),
        h('button', { class: 'knopf tonal', style: { marginTop: '20px' }, onclick: () => lyra.abbrechen() }, 'Abbrechen'));
    case 'frage':
    case 'feedback':
      return frageAnsicht();
    case 'ende':
      return endeAnsicht();
    case 'bereit':
      return bereitAnsicht();
    default:
      return lobby();
  }
}

const OPT = {
  quelle: [['unterlagen', '📚 Unterlagen', 'Nur aus deinen Unterlagen'], ['beides', '✨ Beides', 'Unterlagen, ergänzt um Wissen'], ['wissen', '🌍 Allgemeinwissen', 'Jedes Thema – auch ohne Unterlagen']],
  anzahl: [5, 10, 15, 20, 30, 40, 50].map((n) => [n, String(n)]),
  zeit: [[0, 'Aus', 'Keine Uhr, kein Zeitbonus'], [10, '10 s'], [15, '15 s'], [20, '20 s'], [30, '30 s'], [45, '45 s'], [60, '60 s'], [90, '90 s']],
  schwierigkeit: [['leicht', 'Leicht'], ['mittel', 'Mittel'], ['schwer', 'Schwer'], ['gemischt', 'Gemischt'], ['steigend', 'Steigend', 'Wird von Frage zu Frage schwerer']],
};

function lobby() {
  const pille = (schl, titel) => lyra.auswahl({ titel, optionen: OPT[schl], wert: z.einst[schl], beiWahl: (w) => schnellSetzen(schl, w) });
  return h('div', {},
    h('div', { class: 'logo' }, 'Quizzard'),
    h('div', { class: 'slogan' }, 'Ein Thema rein – ein Quiz raus. Bereit? ⚡'),
    lyra.verfasser({
      wert: z.thema,
      feld: 'thema',
      zeilen: 1,
      platzhalter: 'Worum soll’s gehen? z. B. Vollständige Induktion, Photosynthese, 80er-Musik …',
      beiEingabe: (v) => { z.thema = v; },
      beiSenden: (v) => { z.thema = v; erstellen(); },
      knopf: 'Quiz zaubern',
      symbol: '⚡',
      unten: [
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        pille('quelle', ''), pille('anzahl', 'Fragen'), pille('zeit', '⏱'), pille('schwierigkeit', 'Level'),
        h('button', { class: 'ly-pille', onclick: einstellungen, title: 'Fragetypen, Joker, Punkte, Effekte …' }, '⚙ Mehr'),
      ],
    }),
    z.themen.length && z.einst.quelle !== 'wissen' ? lyra.vorschlaege(z.themen, (x) => { z.thema = x; zeichnen(); const f = document.querySelector('[data-feld="thema"]'); if (f) f.focus(); }, { titel: 'Aus deinen Unterlagen:' }) : null,
    z.fehler ? h('div', { style: { marginTop: '12px' } }, lyra.fehlerBox(z.fehler, online() && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; zeichnen(); } : null,
      () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; erstellen(); })) : null,
    z.meldung ? h('div', { class: 'meldung' }, z.meldung) : null,
    z.spiele.length ? lyra.abschnitt('🏆 Deine Quizze', h('div', { class: 'ly-liste' }, z.spiele.map((q) => {
      const r = z.rekorde[q.thema.toLowerCase()];
      const neu = !q.gespielt;
      return lyra.eintrag({
        symbol: neu ? '✨' : '🏆',
        titel: q.thema,
        unter: `${q.fragen.length} Fragen · ${neu ? 'noch nicht gespielt' : `${q.gespielt}× gespielt`}${r ? ` · Rekord ${zahlFormat(r.punkte)}` : ''} · ${datum(q.zeit)}`,
        beiKlick: () => { z.meldung = ''; spielStarten(q); },
        rechts: h('button', { class: neu ? 'knopf klein' : 'knopf tonal klein', onclick: (e) => { e.stopPropagation(); z.meldung = ''; spielStarten(q); } }, neu ? 'Spielen ▶' : 'Nochmal ▶'),
        aktionen: [{ symbol: '👥', titel: 'In einen Raum teilen – als Aufgabe oder Live-Runde (Lyra Campus)', bei: () => raumTeilen(q) }, { symbol: '🗑', titel: 'Löschen', bei: () => quizLoeschen(q) }],
      });
    }))) : null);
}

/** Zeitlimit fürs nächste Spiel (gilt auch für gespeicherte Quizze). */
function zeitlimitZeile() {
  return lyra.auswahl({ titel: '⏱ Zeitlimit', optionen: OPT.zeit, wert: z.einst.zeit, beiWahl: (w) => schnellSetzen('zeit', w) });
}

const datum = (t) => new Date(t * 1000).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

/** Das Quiz ist fertig (und schon gesichert): jetzt spielen – oder später. */
function bereitAnsicht() {
  const q = z.bereit;
  if (!q) return lobby();
  const anzahl = {};
  for (const f of q.fragen) anzahl[f.art] = (anzahl[f.art] || 0) + 1;
  return h('div', { class: 'bereit' },
    h('div', { style: { fontSize: '64px' } }, '🎉'),
    h('div', { class: 'logo', style: { fontSize: '40px', marginTop: '6px' } }, 'Dein Quiz ist fertig!'),
    h('div', { class: 'slogan' }, `${q.fragen.length} Fragen zu „${q.thema}“`),
    h('div', { class: 'zeile umbruch', style: { justifyContent: 'center', gap: '6px', margin: '10px 0 18px' } },
      Object.entries(anzahl).map(([a, n]) => h('span', { class: 'pill' }, `${n}× ${TYPEN[a][0]}`))),
    z.meldung ? h('div', { class: 'meldung', style: { maxWidth: '520px', margin: '0 auto 14px' } }, z.meldung) : null,
    h('div', { class: 'zeile', style: { justifyContent: 'center', marginBottom: '22px' } }, zeitlimitZeile()),
    h('div', { class: 'zeile', style: { justifyContent: 'center', gap: '12px' } },
      h('button', { class: 'knopf riesig', onclick: () => { const x = z.bereit; z.bereit = null; spielStarten(x); } }, 'Jetzt spielen ▶'),
      h('button', { class: 'knopf tonal riesig', onclick: () => {
        z.bereit = null;
        z.ansicht = 'lobby';
        z.meldung = `💾 Gespeichert – „${q.thema}“ wartet unter „Deine Quizze“ (und auf Lyras Startseite).`;
        zeichnen();
      } }, 'Später spielen 💾'),
      h('button', { class: 'knopf tonal riesig', title: 'Als Aufgabe oder Live-Runde in einen Raum von Lyra Campus', onclick: () => raumTeilen(q) }, 'In Raum teilen 👥')),
    h('div', { class: 'leise klein', style: { marginTop: '16px' } }, 'Das Quiz ist schon gesichert – du kannst es jederzeit spielen, auch mehrmals.'));
}

function frageAnsicht() {
  const s = z.spiel;
  const f = s.fragen[z.pos];
  const fertig = z.ansicht === 'feedback';
  const j = s.joker;
  const kopf = h('div', { class: 'leiste-oben' },
    h('span', { class: 'pill' }, `${z.pos + 1} / ${s.fragen.length}`),
    h('span', { class: 'pill' }, `⭐ ${zahlFormat(s.punkte)}`),
    s.serie >= 2 ? h('span', { class: 'pill serie' }, `🔥 ${s.serie}`) : null,
    h('span', { class: 'wachsen' }),
    !fertig && j.fuenfzig && (f.art === 'auswahl' || f.art === 'bild') ? h('button', { class: 'knopf tonal klein', onclick: () => joker('fuenfzig'), title: 'Zwei falsche Antworten weg (halbe Punkte)' }, `50:50 ×${j.fuenfzig}`) : null,
    !fertig && j.zeit && z.zeitGesamt ? h('button', { class: 'knopf tonal klein', onclick: () => joker('zeit') }, `+10 s ×${j.zeit}`) : null,
    !fertig && j.ueberspringen ? h('button', { class: 'knopf tonal klein', onclick: () => joker('ueberspringen') }, `⏭ ×${j.ueberspringen}`) : null,
    z.zeitGesamt && !fertig ? h('span', { class: 'pill', id: 'sekunden' }, `${Math.ceil(z.zeitRest)} s`) : null);
  const balken = z.zeitGesamt ? h('div', { class: 'zeitbalken' }, h('div', { style: { width: `${fertig ? 0 : (z.zeitRest / z.zeitGesamt) * 100}%` } })) : h('div', { style: { height: '14px' } });
  const frage = h('div', { class: 'frage-box' + (f.art === 'bild' ? ' mit-foto' : '') }, h('div', { class: 'typ' }, TYPEN[f.art][0]),
    f.art === 'bild' && f.bild && z.bilder[f.bild.id] ? foto(f, fertig) : null, mdElement(f.frage.replace('___', '＿＿＿')));
  return h('div', {}, kopf, balken, frage, antwortBereich(f, fertig), fertig ? feedback(f) : null);
}

function antwortBereich(f, fertig) {
  const e = z.eingabe;
  const buchstaben = ['A', 'B', 'C', 'D', 'E', 'F'];
  switch (f.art) {
    case 'auswahl':
    case 'bild':
    case 'mehrfach':
    case 'wahrfalsch': {
      const mehrere = f.art === 'mehrfach';
      const kacheln = f.optionen.map((o, i) => {
        let cls = `antwort c${f.art === 'wahrfalsch' ? (i === 0 ? 1 : 0) : i % 6}`;
        if (z.fuenfzigWeg.includes(i)) cls += ' weg';
        if (e.includes(i)) cls += ' gewaehlt';
        if (fertig) cls += f.richtig.includes(i) ? ' richtig' : ' falsch';
        return h('button', {
          class: cls, style: { animationDelay: `${i * 0.07}s` }, disabled: fertig,
          onclick: () => {
            if (mehrere) { const k = e.indexOf(i); if (k >= 0) e.splice(k, 1); else e.push(i); zeichnen(); }
            else { z.eingabe = [i]; abgeben(); }
          },
        }, f.art === 'wahrfalsch' ? (i === 0 ? '✓ Wahr' : '✗ Falsch') : [h('span', { class: 'buchstabe' }, mehrere ? (e.includes(i) ? '✓' : '') : buchstaben[i]), mdElement(o)]);
      });
      return h('div', {}, h('div', { class: 'antworten' + (f.art === 'wahrfalsch' ? ' wf' : '') }, kacheln),
        mehrere && !fertig ? h('div', { class: 'zeile', style: { justifyContent: 'center', marginTop: '16px' } },
          h('span', { class: 'leise' }, 'Wähle alle richtigen aus'), h('button', { class: 'knopf', disabled: !e.length, onclick: () => abgeben() }, 'Abgeben')) : null);
    }
    case 'schaetzen': {
      const schritt = (f.max - f.min) / 200;
      const rund = (x) => Math.round(x / schritt) * schritt;
      const wert = h('div', { class: 'schaetz-wert' }, `${fmt(e)} ${f.einheit}`);
      const r = h('input', { type: 'range', min: f.min, max: f.max, step: schritt, value: e, disabled: fertig, style: { width: '100%' } });
      r.addEventListener('input', () => { z.eingabe = rund(Number(r.value)); wert.textContent = `${fmt(z.eingabe)} ${f.einheit}`; });
      return h('div', { class: 'panel' }, wert, r, h('div', { class: 'zeile leise' }, h('span', { class: 'wachsen' }, fmt(f.min)), h('span', {}, fmt(f.max))),
        fertig ? h('div', { class: 'mitte fett', style: { marginTop: '10px', fontSize: '20px' } }, `Richtig: ${fmt(f.wert)} ${f.einheit}`) :
          h('div', { class: 'zeile', style: { justifyContent: 'center', marginTop: '14px' } }, h('button', { class: 'knopf', onclick: () => abgeben() }, 'Einloggen 🎯')));
    }
    case 'reihenfolge': {
      const bewegen = (i, d) => { const n = i + d; if (n < 0 || n >= e.length) return; [e[i], e[n]] = [e[n], e[i]]; zeichnen(); };
      return h('div', { class: 'panel liste-sortieren' },
        h('div', { class: 'leise', style: { marginBottom: '10px' } }, fertig ? 'Richtige Reihenfolge:' : 'Bring es in die richtige Reihenfolge (oben = zuerst):'),
        (fertig ? f.loesung : e).map((o, i) => h('div', { class: 'eintrag', style: fertig ? { outline: `2px solid ${e[i] === f.loesung[i] ? 'var(--richtig)' : 'var(--falsch)'}` } : null },
          h('span', { class: 'nr' }, String(i + 1)), h('span', { class: 'wachsen' }, mdElement(o)),
          !fertig ? h('button', { class: 'knopf tonal klein', disabled: i === 0, onclick: () => bewegen(i, -1) }, '▲') : null,
          !fertig ? h('button', { class: 'knopf tonal klein', disabled: i === e.length - 1, onclick: () => bewegen(i, 1) }, '▼') : null)),
        !fertig ? h('div', { class: 'zeile', style: { justifyContent: 'center', marginTop: '10px' } }, h('button', { class: 'knopf', onclick: () => abgeben() }, 'Fertig sortiert')) : null);
    }
    case 'zuordnen': {
      const zu = e.zu;
      const verbundenRechts = Object.values(zu);
      const farbeVon = (i) => `c${i % 6}`;
      return h('div', { class: 'panel' },
        h('div', { class: 'leise', style: { marginBottom: '10px' } }, fertig ? 'Richtige Paare:' : 'Tippe links, dann das passende rechts:'),
        h('div', { class: 'paare' },
          h('div', { class: 'spalte', style: { gap: '10px' } }, f.paare.map((p, i) => h('button', {
            class: `paar ${zu[i] !== undefined || e.aktiv === i ? farbeVon(i) : ''} ${e.aktiv === i ? 'aktiv' : ''}`,
            style: zu[i] === undefined && e.aktiv !== i ? { background: 'rgba(255,255,255,0.12)' } : null,
            disabled: fertig,
            onclick: () => { e.aktiv = i; zeichnen(); },
          }, h('span', { class: 'paar-nr' }, String(i + 1)), mdElement(p.links), fertig ? h('div', { class: 'klein', style: { marginTop: '4px', opacity: 0.9 } }, (zu[i] === p.rechts ? '✓ ' : '✗ ') + p.rechts) : null))),
          h('div', { class: 'spalte', style: { gap: '10px' } }, f.rechtsGemischt.map((r) => {
            const von = Object.keys(zu).find((k) => zu[k] === r);
            return h('button', {
              class: `paar ${von !== undefined ? farbeVon(Number(von)) + ' verbunden' : ''}`,
              style: von === undefined ? { background: 'rgba(255,255,255,0.12)' } : null,
              disabled: fertig || e.aktiv === null,
              onclick: () => {
                for (const k of Object.keys(zu)) if (zu[k] === r) delete zu[k];
                zu[e.aktiv] = r;
                const frei = f.paare.findIndex((_, i) => zu[i] === undefined);
                e.aktiv = frei >= 0 ? frei : null;
                zeichnen();
              },
            }, von !== undefined ? h('span', { class: 'paar-nr' }, String(Number(von) + 1)) : null, mdElement(r));
          }))),
        !fertig ? h('div', { class: 'zeile', style: { justifyContent: 'center', marginTop: '14px' } },
          h('button', { class: 'knopf', disabled: verbundenRechts.length < f.paare.length, onclick: () => abgeben() }, 'Abgeben')) : null);
    }
    case 'luecke': {
      const t = h('input', { class: 'eingabe', 'data-feld': 'luecke', placeholder: 'Deine Antwort …', disabled: fertig, style: { fontSize: '22px', textAlign: 'center', padding: '16px' } });
      t.value = e;
      t.addEventListener('input', () => { z.eingabe = t.value; });
      t.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') abgeben(); });
      return h('div', { class: 'panel spalte' }, t,
        fertig ? mdElement(`Richtig: ${f.optionen[0]}`, 'mitte fett gross-text') :
          h('div', { class: 'zeile', style: { justifyContent: 'center' } }, h('button', { class: 'knopf', onclick: () => abgeben() }, 'Abgeben')));
    }
  }
  return null;
}

function fmt(n) {
  const r = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100;
  return r.toLocaleString('de-DE');
}

function feedback(f) {
  const e = z.ergebnis;
  const gut = e.teil >= 0.999;
  const teils = e.teil > 0 && !gut;
  const zeigen = z.einst.erklaerung === 'immer' || (z.einst.erklaerung === 'fehler' && !gut);
  const letzte = z.pos === z.spiel.fragen.length - 1;
  return h('div', { class: 'ergebnis-box ' + (gut || teils ? 'gut' : 'schlecht') },
    h('div', { class: 'gross' }, e.uebersprungen ? '⏭ Übersprungen' : gut ? pick(['Richtig! 🎉', 'Stark! 💪', 'Volltreffer! 🎯', 'Genau so! ✨']) : teils ? 'Fast! 👌' : e.zeitAus ? '⏰ Zeit um!' : pick(['Knapp daneben 😅', 'Leider nicht 🙈', 'Nicht ganz …'])),
    e.punkte ? h('div', { class: 'punkte-plus' }, `+${zahlFormat(e.punkte)}`) : null,
    zeigen && f.wissenswert ? h('div', { style: { marginTop: '10px', fontSize: '15.5px' } }, mdElement('💡 ' + f.wissenswert)) : null,
    h('div', { style: { marginTop: '16px' } }, h('button', { class: 'knopf', onclick: weiter }, letzte ? 'Zum Ergebnis 🏁' : 'Weiter →')));
}

const pick = (l) => l[Math.floor(Math.random() * l.length)];

function endeAnsicht() {
  const s = z.spiel;
  const richtig = s.antworten.filter((a) => a.teil >= 0.999).length;
  const dauer = Math.round((Date.now() - s.start) / 1000);
  const quote = Math.round((richtig / s.fragen.length) * 100);
  const falsche = s.fragen.map((f, i) => (s.antworten[i] && s.antworten[i].teil < 0.999 ? s.quiz.fragen.find((q) => q.frage === f.frage) : null)).filter(Boolean);
  return h('div', { class: 'podest' },
    s.campus ? campusStatusBox() : null,
    h('div', { style: { fontSize: '70px' } }, quote >= 80 ? '🏆' : quote >= 50 ? '🥈' : '🌱'),
    s.neuerRekord && richtig > 0 ? h('div', { class: 'pill', style: { display: 'inline-block', marginBottom: '8px' } }, '✨ Neuer Rekord!') : null,
    h('div', { class: 'punkte-gross' }, zahlFormat(s.punkte)),
    h('div', { class: 'leise' }, 'Punkte'),
    h('div', { class: 'werte' },
      h('div', { class: 'wert' }, h('b', {}, `${richtig}/${s.fragen.length}`), 'richtig'),
      h('div', { class: 'wert' }, h('b', {}, `${quote} %`), 'Quote'),
      h('div', { class: 'wert' }, h('b', {}, `🔥 ${s.besteSerie}`), 'beste Serie'),
      h('div', { class: 'wert' }, h('b', {}, `${Math.floor(dauer / 60)}:${String(dauer % 60).padStart(2, '0')}`), 'Zeit')),
    h('div', { class: 'zeile', style: { justifyContent: 'center', margin: '8px 0 20px' } },
      h('button', { class: 'knopf', onclick: () => (s.campus ? aufgabeStarten() : spielStarten(s.quiz)) }, '🔁 Nochmal'),
      falsche.length ? h('button', { class: 'knopf tonal', onclick: () => spielStarten(s.quiz, falsche) }, `Nur die ${falsche.length} Falschen`) : null,
      h('button', { class: 'knopf tonal', onclick: () => { z.ansicht = 'lobby'; z.thema = ''; zeichnen(); } }, 'Neues Quiz')),
    h('div', { class: 'panel rueckblick', style: { textAlign: 'left' } },
      h('h3', { style: { marginBottom: '6px' } }, 'Rückblick'),
      s.fragen.map((f, i) => {
        const a = s.antworten[i] || { teil: 0 };
        return h('div', { class: 'zeile-r' },
          h('span', { style: { fontSize: '20px' } }, a.teil >= 0.999 ? '✅' : a.teil > 0 ? '🟡' : '❌'),
          f.art === 'bild' && f.bild && z.bilder[f.bild.id] ? h('img', { class: 'foto-mini', src: z.bilder[f.bild.id], alt: f.bild.artikel, title: `Foto: ${f.bild.urheber || 'unbekannt'} · ${f.bild.lizenz} · Wikimedia Commons` }) : null,
          h('div', { class: 'wachsen' }, mdElement(f.frage), mdElement(loesungText(f), 'leise klein'),
            z.einst.erklaerung === 'nie' && f.wissenswert ? h('div', { class: 'klein', style: { marginTop: '4px' } }, mdElement('💡 ' + f.wissenswert)) : null),
          h('span', { class: 'fett' }, a.punkte ? `+${zahlFormat(a.punkte)}` : ''));
      })));
}

function loesungText(f) {
  switch (f.art) {
    case 'auswahl': case 'bild': case 'mehrfach': case 'wahrfalsch': return 'Richtig: ' + f.richtig.map((i) => f.optionen[i]).join(', ');
    case 'schaetzen': return `Richtig: ${fmt(f.wert)} ${f.einheit}`;
    case 'reihenfolge': return 'Reihenfolge: ' + f.loesung.join(' → ');
    case 'zuordnen': return f.paare.map((p) => `${p.links} – ${p.rechts}`).join(' · ');
    case 'luecke': return 'Richtig: ' + f.optionen[0];
  }
  return '';
}

// ================================================================== Fusion (mehrere Plugins, eine Aufgabe)

const anzahlAus = (a, std, max) => { const m = /(\d+)\s*(Karte|Frage|Begriff|Wort|Wörter|Eintr)/i.exec(String(a.anweisung || '')); const n = Number((a.optionen && a.optionen.anzahl) || (m && m[1]) || std); return Math.max(3, Math.min(max, n || std)); };
function fusionAnbieten() {
  lyra.fusion.anbieten({
    quiz: async (a, { status }) => {
      const material = lyra.fusion.materialOhneAufgabe(a, online() ? 14000 : 8000);
      z.lehrer = a.lehrer || z.lehrer;
      fusionMaterial = material ? `Auftrag: ${a.anweisung || ''}\n\n${material}` : '';
      z.thema = lyra.fusion.kurzthema(a) || String(a.anweisung || '').slice(0, 80);
      z.einst.anzahl = anzahlAus(a, 10, 25);
      const vorher = z.bereit;
      const uhr = setInterval(() => { if (z.hinweis) status(z.hinweis); }, 1200);
      try { await erstellen(); } finally { clearInterval(uhr); fusionMaterial = ''; }
      const q = z.bereit;
      if (!q || q === vorher) throw new Error(z.fehler || 'Das Quiz ist nicht gelungen.');
      return {
        art: 'quiz',
        titel: `Quiz: ${q.thema}`,
        markdown: `# Quiz: ${q.thema}\n\n` + q.fragen.map((f, i) => `**${i + 1}. ${f.frage}** _(${TYPEN[f.art][0]})_  \n${loesungText(f)}${f.wissenswert ? `  \n💡 ${f.wissenswert}` : ''}`).join('\n\n'),
        daten: { fragen: q.fragen.map((f) => ({ art: f.art, frage: f.frage, optionen: f.optionen, richtig: f.richtig, wert: f.wert, einheit: f.einheit, paare: f.paare, wissenswert: f.wissenswert })) },
        oeffnen: 'spiel/' + q.id,
      };
    },
  });
}

start().catch(() => {}).then(fusionAnbieten);
