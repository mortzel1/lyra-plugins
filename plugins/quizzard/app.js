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
        required: ['art', 'frage', 'max', 'min', 'optionen', 'paare', 'richtig', 'schwierigkeit', 'wert', 'wissenswert', 'zahl_einheit'],
      },
    },
  },
  required: ['fragen'],
};

const z = {
  info: null,
  einst: structuredClone(STANDARD),
  lehrer: 'lyra',
  ansicht: 'lobby', // lobby | zaubern | countdown | frage | feedback | ende
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
};
const app = document.getElementById('app');
const online = () => z.lehrer !== 'lyra';
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const zahlFormat = (n) => Math.round(n).toLocaleString('de-DE');

// ================================================================== Töne und Konfetti

let audio = null;
function ton(art) {
  if (!z.einst.toene) return;
  try {
    audio = audio || new AudioContext();
    const t0 = audio.currentTime;
    const spielen = (freq, start, dauer, typ = 'sine', laut = 0.12) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = typ;
      o.frequency.value = freq;
      g.gain.setValueAtTime(laut, t0 + start);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + start + dauer);
      o.connect(g).connect(audio.destination);
      o.start(t0 + start);
      o.stop(t0 + start + dauer);
    };
    if (art === 'richtig') { spielen(660, 0, 0.12); spielen(880, 0.1, 0.22); }
    else if (art === 'falsch') { spielen(180, 0, 0.35, 'sawtooth', 0.08); }
    else if (art === 'tick') spielen(1200, 0, 0.05, 'square', 0.03);
    else if (art === 'count') spielen(520, 0, 0.18, 'triangle', 0.12);
    else if (art === 'los') { spielen(520, 0, 0.12); spielen(780, 0.1, 0.12); spielen(1040, 0.2, 0.3); }
    else if (art === 'ende') [523, 659, 784, 1046].forEach((f, i) => spielen(f, i * 0.13, 0.35, 'triangle', 0.1));
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
  zeichnen();
  if ((z.info.route || location.hash.slice(1)) === 'einstellungen') einstellungen();
  lyra.themen().then((t) => { z.themen = t || []; if (z.ansicht === 'lobby') zeichnen(); }).catch(() => {});
  startseite();
}

function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.ansicht === 'lobby') return lyra.zurueck();
  if (z.ansicht === 'zaubern') lyra.abbrechen();
  if ((z.ansicht === 'frage' || z.ansicht === 'feedback') && !window.confirm('Quiz abbrechen?\n\nDein Spielstand geht verloren.')) return;
  stoppeTimer();
  z.ansicht = 'lobby';
  zeichnen();
}

function startseite() {
  const letztes = z.spiele[0];
  if (!letztes) return lyra.startseite([]).catch(() => {});
  const rekord = z.rekorde[letztes.thema.toLowerCase()];
  lyra.startseite([{
    id: 'revanche',
    titel: `Quiz: ${letztes.thema}`,
    untertitel: rekord ? `Rekord ${zahlFormat(rekord.punkte)} Punkte – Revanche?` : 'Nochmal spielen?',
    route: 'lobby',
    zeigen_bis: letztes.zeit + 7 * 86400,
    geaendert: letztes.zeit,
  }]).catch(() => {});
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
  };
  return an.map((t) => '- ' + b[t]).join('\n');
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
  }
  return null;
}

async function erstellen() {
  const thema = z.thema.trim();
  if (!thema) return;
  const anzahl = Math.max(3, Math.min(50, z.einst.anzahl));
  z.ansicht = 'zaubern';
  z.fehler = null;
  z.hinweis = 'Suche passende Stellen …';
  zeichnen();
  let block = '';
  if (z.einst.quelle !== 'wissen') {
    try { block = (await lyra.suchen(thema, online() ? 12 : 7)).block || ''; } catch (_) {}
    if (!block && z.einst.quelle === 'unterlagen') {
      z.fehler = 'Dazu habe ich in deinen Unterlagen nichts gefunden – wähle „Beides“ oder „Allgemeinwissen“ und versuch es nochmal.';
      z.ansicht = 'lobby';
      return zeichnen();
    }
  }
  const fragen = [];
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
Alle Felder sind Pflicht – was ein Typ nicht braucht, bleibt leer ("optionen": [], "paare": [], "richtig": [], "wert": 0, "min": 0, "max": 0, "zahl_einheit": ""). \
"wissenswert" erklärt in 1 bis 2 Sätzen die Lösung, gern mit einem Aha-Fakt. "schwierigkeit": 1 leicht, 2 mittel, 3 schwer.\n\n\
Antwort als JSON: {"fragen": [{"art": "auswahl", "frage": "…", "max": 0, "min": 0, "optionen": ["…"], "paare": [], "richtig": [0], "schwierigkeit": 1, "wert": 0, "wissenswert": "…", "zahl_einheit": ""}]}`,
        schema: SCHEMA,
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
  if (fragen.length < 3) {
    z.fehler = z.fehler || 'Das Quiz ist nicht gelungen – bitte nochmal versuchen.';
    z.ansicht = 'lobby';
    return zeichnen();
  }
  if (z.einst.schwierigkeit === 'steigend') fragen.sort((a, b) => a.schwierigkeit - b.schwierigkeit);
  spielStarten({ id: lyra.neueId(), thema, fragen, zeit: lyra.jetzt() });
}

// ================================================================== Spielen

function spielStarten(quiz, nurDiese) {
  const fragen = (nurDiese || quiz.fragen).map((f) => vorbereiten(f));
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
  if ((q.art === 'auswahl' || q.art === 'mehrfach') && z.einst.mischen) {
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
  z.ansicht = 'feedback';
  ton(teil >= 0.999 ? 'richtig' : teil > 0 ? 'richtig' : 'falsch');
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
  s.quiz.zeit = lyra.jetzt();
  try { await lyra.speicher.schreiben('spiele/' + s.quiz.id, s.quiz); } catch (_) {}
  z.spiele = [s.quiz, ...z.spiele.filter((q) => q.id !== s.quiz.id)].slice(0, 30);
  startseite();
  ton('ende');
  konfetti(s.neuerRekord ? 160 : 70);
  zeichnen();
}

function joker(art) {
  const s = z.spiel;
  const f = s.fragen[z.pos];
  if (!s.joker[art] || z.ansicht !== 'frage') return;
  if (art === 'fuenfzig') {
    if (f.art !== 'auswahl' || z.fuenfzigWeg.length) return;
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
    gruppe('Zeit pro Frage', wahl('zeit', [[0, 'Ohne Zeit'], [10, '10 s'], [15, '15 s'], [20, '20 s'], [30, '30 s'], [45, '45 s'], [60, '60 s']]), 'Bei Reihenfolge, Zuordnen und Lückentext gibt es 50 % mehr Zeit.'),
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
    default:
      return lobby();
  }
}

function lobby() {
  const chip = (schluessel, wert, name) => h('button', { class: 'chip' + (z.einst[schluessel] === wert ? ' an' : ''), onclick: () => schnellSetzen(schluessel, wert) }, name);
  const t = h('input', { class: 'eingabe', 'data-feld': 'thema', placeholder: 'Worum soll’s gehen? z. B. Vollständige Induktion, Photosynthese, 80er-Musik …', style: { fontSize: '18px', padding: '16px 18px' } });
  t.value = z.thema;
  t.addEventListener('input', () => {
    z.thema = t.value;
    const k = document.getElementById('los');
    if (k) k.disabled = !z.thema.trim();
  });
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter') erstellen(); });
  return h('div', {},
    h('div', { class: 'logo' }, 'Quizzard'),
    h('div', { class: 'slogan' }, 'Ein Thema rein – ein Quiz raus. Bereit? ⚡'),
    h('div', { class: 'panel spalte', style: { gap: '14px' } },
      t,
      z.themen.length && z.einst.quelle !== 'wissen' ? h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, z.themen.slice(0, 10).map((x) =>
        h('button', { class: 'chip', onclick: () => { z.thema = x; zeichnen(); } }, x))) : null,
      h('div', { class: 'zeile umbruch', style: { gap: '6px' } },
        h('span', { class: 'leise klein' }, 'Quelle'), chip('quelle', 'unterlagen', '📚 Unterlagen'), chip('quelle', 'beides', '✨ Beides'), chip('quelle', 'wissen', '🌍 Allgemeinwissen')),
      h('div', { class: 'zeile umbruch', style: { gap: '6px' } },
        h('span', { class: 'leise klein' }, 'Fragen'), ...[5, 10, 15, 20, 30].map((n) => chip('anzahl', n, String(n))),
        h('span', { class: 'leise klein', style: { marginLeft: '10px' } }, 'Zeit'), ...[[10, '10 s'], [20, '20 s'], [30, '30 s'], [0, '∞']].map(([n, s]) => chip('zeit', n, s))),
      h('div', { class: 'zeile umbruch', style: { gap: '6px' } },
        h('span', { class: 'leise klein' }, 'Level'), chip('schwierigkeit', 'leicht', 'Leicht'), chip('schwierigkeit', 'mittel', 'Mittel'), chip('schwierigkeit', 'schwer', 'Schwer'), chip('schwierigkeit', 'gemischt', 'Gemischt'), chip('schwierigkeit', 'steigend', 'Steigend')),
      h('div', { class: 'zeile', style: { marginTop: '6px' } },
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        h('button', { class: 'knopf text', onclick: einstellungen }, '⚙ Alle Einstellungen'),
        h('span', { class: 'wachsen' }),
        h('button', { class: 'knopf riesig', id: 'los', disabled: !z.thema.trim(), onclick: erstellen }, 'Quiz starten ⚡')),
      z.fehler ? lyra.fehlerBox(z.fehler, online() && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; zeichnen(); } : null, () => { z.fehler = null; zeichnen(); }) : null),
    z.spiele.length ? h('div', { class: 'panel', style: { marginTop: '18px' } },
      h('h3', { style: { marginBottom: '10px' } }, '🏆 Deine Quizze'),
      z.spiele.slice(0, 6).map((q) => {
        const r = z.rekorde[q.thema.toLowerCase()];
        return h('div', { class: 'zeile', style: { padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.08)' } },
          h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, q.thema), h('div', { class: 'leise klein' }, `${q.fragen.length} Fragen${r ? ` · Rekord ${zahlFormat(r.punkte)}` : ''}`)),
          h('button', { class: 'knopf tonal', onclick: () => spielStarten(q) }, 'Nochmal ▶'));
      })) : null);
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
    !fertig && j.fuenfzig && f.art === 'auswahl' ? h('button', { class: 'knopf tonal klein', onclick: () => joker('fuenfzig'), title: 'Zwei falsche Antworten weg (halbe Punkte)' }, `50:50 ×${j.fuenfzig}`) : null,
    !fertig && j.zeit && z.zeitGesamt ? h('button', { class: 'knopf tonal klein', onclick: () => joker('zeit') }, `+10 s ×${j.zeit}`) : null,
    !fertig && j.ueberspringen ? h('button', { class: 'knopf tonal klein', onclick: () => joker('ueberspringen') }, `⏭ ×${j.ueberspringen}`) : null,
    z.zeitGesamt && !fertig ? h('span', { class: 'pill', id: 'sekunden' }, `${Math.ceil(z.zeitRest)} s`) : null);
  const balken = z.zeitGesamt ? h('div', { class: 'zeitbalken' }, h('div', { style: { width: `${fertig ? 0 : (z.zeitRest / z.zeitGesamt) * 100}%` } })) : h('div', { style: { height: '14px' } });
  const frage = h('div', { class: 'frage-box' }, h('div', { class: 'typ' }, TYPEN[f.art][0]), mdElement(f.frage.replace('___', '＿＿＿')));
  return h('div', {}, kopf, balken, frage, antwortBereich(f, fertig), fertig ? feedback(f) : null);
}

function antwortBereich(f, fertig) {
  const e = z.eingabe;
  const buchstaben = ['A', 'B', 'C', 'D', 'E', 'F'];
  switch (f.art) {
    case 'auswahl':
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
          }, mdElement(p.links), fertig ? h('div', { class: 'klein', style: { marginTop: '4px', opacity: 0.9 } }, (zu[i] === p.rechts ? '✓ ' : '✗ ') + p.rechts) : null))),
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
            }, mdElement(r));
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
        fertig ? h('div', { class: 'mitte fett', style: { fontSize: '20px' } }, `Richtig: ${f.optionen[0]}`) :
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
    h('div', { style: { fontSize: '70px' } }, quote >= 80 ? '🏆' : quote >= 50 ? '🥈' : '🌱'),
    s.neuerRekord ? h('div', { class: 'pill', style: { display: 'inline-block', marginBottom: '8px' } }, '✨ Neuer Rekord!') : null,
    h('div', { class: 'punkte-gross' }, zahlFormat(s.punkte)),
    h('div', { class: 'leise' }, 'Punkte'),
    h('div', { class: 'werte' },
      h('div', { class: 'wert' }, h('b', {}, `${richtig}/${s.fragen.length}`), 'richtig'),
      h('div', { class: 'wert' }, h('b', {}, `${quote} %`), 'Quote'),
      h('div', { class: 'wert' }, h('b', {}, `🔥 ${s.besteSerie}`), 'beste Serie'),
      h('div', { class: 'wert' }, h('b', {}, `${Math.floor(dauer / 60)}:${String(dauer % 60).padStart(2, '0')}`), 'Zeit')),
    h('div', { class: 'zeile', style: { justifyContent: 'center', margin: '8px 0 20px' } },
      h('button', { class: 'knopf', onclick: () => spielStarten(s.quiz) }, '🔁 Nochmal'),
      falsche.length ? h('button', { class: 'knopf tonal', onclick: () => spielStarten(s.quiz, falsche) }, `Nur die ${falsche.length} Falschen`) : null,
      h('button', { class: 'knopf tonal', onclick: () => { z.ansicht = 'lobby'; z.thema = ''; zeichnen(); } }, 'Neues Quiz')),
    h('div', { class: 'panel rueckblick', style: { textAlign: 'left' } },
      h('h3', { style: { marginBottom: '6px' } }, 'Rückblick'),
      s.fragen.map((f, i) => {
        const a = s.antworten[i] || { teil: 0 };
        return h('div', { class: 'zeile-r' },
          h('span', { style: { fontSize: '20px' } }, a.teil >= 0.999 ? '✅' : a.teil > 0 ? '🟡' : '❌'),
          h('div', { class: 'wachsen' }, mdElement(f.frage), h('div', { class: 'leise klein' }, loesungText(f)),
            z.einst.erklaerung === 'nie' && f.wissenswert ? h('div', { class: 'klein', style: { marginTop: '4px' } }, mdElement('💡 ' + f.wissenswert)) : null),
          h('span', { class: 'fett' }, a.punkte ? `+${zahlFormat(a.punkte)}` : ''));
      })));
}

function loesungText(f) {
  switch (f.art) {
    case 'auswahl': case 'mehrfach': case 'wahrfalsch': return 'Richtig: ' + f.richtig.map((i) => f.optionen[i]).join(', ');
    case 'schaetzen': return `Richtig: ${fmt(f.wert)} ${f.einheit}`;
    case 'reihenfolge': return 'Reihenfolge: ' + f.loesung.join(' → ');
    case 'zuordnen': return f.paare.map((p) => `${p.links} – ${p.rechts}`).join(' · ');
    case 'luecke': return 'Richtig: ' + f.optionen[0];
  }
  return '';
}

start();
