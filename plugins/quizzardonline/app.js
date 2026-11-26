'use strict';
/*
 * Quizzard Online – das Live-Quiz unter demselben Sternenhimmel. Du bist Host (spielst nicht mit) und zeigst die Fragen;
 * alle anderen antworten auf ihrem Gerät. Wer richtig liegt, bekommt Punkte – je schneller, desto mehr. Am Ende gewinnt,
 * wer die meisten Punkte hat.
 *
 * Fragetypen wie im Offline-Quizzard: eine richtig, mehrere richtig, wahr/falsch, Schätzen, Reihenfolge, Zuordnen,
 * Lückentext und Bilderfragen mit echten Fotos aus Wikipedia. Die Lösung bleibt immer beim Host – an die Geräte gehen nur
 * die Frage, die (gemischten) Antwortteile und bei Schätzfragen der Bereich.
 *
 * Mitspielen können:
 *  - alle mit Link oder QR-Code im Browser – ohne Lyra, ohne Konto, von überall (Lyra öffnet eine Spielseite über einen
 *    Tunnel; Ende-zu-Ende-verschlüsselt), siehe gaeste/
 *  - alle in einem Raum von Lyra Campus mit ihrer Lyra (Ende-zu-Ende-verschlüsselt über Matrix)
 */
const { h } = lyra;
const { ZEICHEN, TOENE, sternUhr } = QOSpieler;
const TYP = 'quizzard-online';

const TYPEN = {
  auswahl: ['Eine richtig', 'eine richtige Antwort aus mehreren'],
  mehrfach: ['Mehrere richtig', 'alle richtigen ankreuzen'],
  wahrfalsch: ['Wahr oder falsch', 'eine Aussage beurteilen'],
  schaetzen: ['Schätzen', 'eine Zahl mit dem Regler treffen'],
  reihenfolge: ['Reihenfolge', 'Schritte oder Ereignisse ordnen'],
  zuordnen: ['Zuordnen', 'Paare finden'],
  luecke: ['Lückentext', 'das fehlende Wort eintippen'],
  bild: ['Bilderfrage', 'erkennen, was auf dem Foto ist – echte Fotos aus Wikipedia'],
};
const WAHL = ['auswahl', 'mehrfach', 'wahrfalsch', 'bild'];

const STANDARD = { anzahl: 10, zeit: 20, quelle: 'beides', schwierigkeit: 'gemischt', typen: Object.fromEntries(Object.keys(TYPEN).map((t) => [t, true])) };

const SYSTEM = `Du bist der „Quizzard“ in Lyra und erstellst Fragen für ein Live-Quiz, das eine ganze Gruppe gleichzeitig \
auf ihren Handys spielt. Jede Frage ist kurz (höchstens 120 Zeichen), eindeutig, fachlich korrekt und in wenigen Sekunden \
lesbar. Antwortteile sind kurz (höchstens 60 Zeichen) und plausibel. Keine Fangfragen, keine Wortklauberei, keine \
„alle/keine der genannten“-Antworten. Formeln vermeiden.`;

// Schlüssel alphabetisch (das lokale Modell schreibt sie so)
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
          wert: { type: 'number' },
          wissenswert: { type: 'string' },
          zahl_einheit: { type: 'string' },
        },
        required: ['art', 'bild', 'frage', 'max', 'min', 'optionen', 'paare', 'richtig', 'wert', 'wissenswert', 'zahl_einheit'],
      },
    },
  },
  required: ['fragen'],
};

const z = {
  info: null,
  lehrer: 'lyra',
  einst: structuredClone(STANDARD),
  ansicht: 'start', // start | zaubern | bearbeiten | lobby | frage | aufloesung | rangliste | ende | spieler
  quizze: [],
  runden: [],
  bilder: {}, // Bild-ID → data:-URL (aus dem Speicher)
  quiz: null, // in Bearbeitung
  thema: '',
  hinweis: '',
  fehler: null,
  meldung: '',
  kontext: null, // Lyra Campus: {raum, rolle, host, ich, inhalt}
  spiel: null,
  spielerAnsicht: null,
};
const app = document.getElementById('app');
const zahl = (n) => Math.round(n || 0).toLocaleString('de-DE');
const fmt = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100).toLocaleString('de-DE');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const meldung = (e) => String((e && e.message) || e || '');
const abgebrochen = (e) => /ABGEBROCHEN|Abgebrochen/.test(meldung(e));
const normal = (t) => String(t).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');

// ================================================================== Start, Speicher

async function start() {
  try {
    z.info = await lyra.info();
  } catch (_) {
    z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' };
  }
  z.lehrer = z.info.standardLehrer || 'lyra';
  try {
    const e = (await lyra.speicher.lesen('einstellungen')) || {};
    z.einst = { ...structuredClone(STANDARD), ...e, typen: { ...STANDARD.typen, ...(e.typen || {}) } };
  } catch (_) {}
  await quizzeLaden();
  lyra.bei('gaeste', gastEreignis);
  lyra.bei('campus', campusEreignis);
  lyra.bei('zurueck', zurueck);
  try { z.kontext = await lyra.campus.kontext(); } catch (_) { z.kontext = null; }
  const k = z.kontext;
  if (k && k.inhalt && k.inhalt.typ === TYP) {
    const ichLeite = k.ich && k.inhalt.von === k.ich.id;
    if (!ichLeite) return spielerStarten(k);
    // Du leitest diese Live-Runde (aus dem Raum geöffnet): das Quiz dazu gleich in die Lobby
    const q = z.quizze.find((x) => x.id === (k.inhalt.daten && k.inhalt.daten.quiz));
    if (q) return lobbyOeffnen(q, { campus: true });
  }
  zeichnen();
}

/** Fragen aus Version 1.0 (nur „eine richtig“, richtig als Zahl) in die neue Form bringen. */
function normalisieren(f) {
  if (f.art) return f;
  const wf = f.optionen && f.optionen.length === 2 && f.optionen[0] === 'Wahr' && f.optionen[1] === 'Falsch';
  return { ...f, art: wf ? 'wahrfalsch' : 'auswahl', richtig: Array.isArray(f.richtig) ? f.richtig : [f.richtig] };
}

async function quizzeLaden() {
  try {
    z.quizze = (await lyra.speicher.liste('quiz')).map((e) => e.wert).filter(Boolean)
      .map((q) => ({ ...q, fragen: (q.fragen || []).map(normalisieren) }))
      .sort((a, b) => (b.geaendert || 0) - (a.geaendert || 0));
  } catch (_) { z.quizze = []; }
  try { z.runden = (await lyra.speicher.liste('runden')).map((e) => e.wert).filter(Boolean).sort((a, b) => b.zeit - a.zeit).slice(0, 8); } catch (_) { z.runden = []; }
}

async function quizSichern(q) {
  q.geaendert = lyra.jetzt();
  try { await lyra.speicher.schreiben('quiz/' + q.id, q); } catch (e) { lyra.toast(meldung(e), 'fehler'); }
  const i = z.quizze.findIndex((x) => x.id === q.id);
  if (i >= 0) z.quizze[i] = q; else z.quizze.unshift(q);
}

async function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.ansicht === 'spieler') return lyra.zurueck();
  if (z.spiel) {
    const ok = await lyra.bestaetigen({ titel: 'Spiel beenden?', text: 'Alle Mitspielenden werden abgemeldet; der Spielstand geht verloren.', ja: 'Spiel beenden', nein: 'Weiterspielen', gefahr: true });
    if (ok) await spielBeenden();
    return;
  }
  if (z.ansicht === 'zaubern') { lyra.abbrechen(); return; }
  if (z.ansicht !== 'start') { z.ansicht = 'start'; z.quiz = null; return zeichnen(); }
  lyra.zurueck();
}

// ================================================================== Fotos (echte Fotos aus Wikipedia, wie im Offline-Quizzard)

/** Foto auf höchstens 800 px verkleinern (JPEG) – klein genug für alle Geräte. */
function verkleinern(daten) {
  return new Promise((fertig) => {
    const img = new Image();
    img.onload = () => {
      try {
        const f = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * f));
        c.height = Math.max(1, Math.round(img.naturalHeight * f));
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        const klein = c.toDataURL('image/jpeg', 0.8);
        fertig(klein.length < daten.length ? klein : daten);
      } catch (_) { fertig(daten); }
    };
    img.onerror = () => fertig(null);
    img.src = daten;
  });
}

/** Passt ein Artikeltitel zu einem Begriff? (einer steckt im anderen und macht den Großteil davon aus) */
function titelPasst(begriff, titel) {
  const norm = (t) => String(t || '').split('(')[0].toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 's').replace(/[^a-z0-9]/g, '');
  const a = norm(begriff), b = norm(titel);
  const [kurz, lang] = a.length <= b.length ? [a, b] : [b, a];
  return kurz.length >= 3 && lang.includes(kurz) && kurz.length * 10 >= lang.length * 6;
}

/** Zeigt das Foto wirklich das Gesuchte? Nein, wenn sein Artikel zu einer falschen Antwort passt. */
function fotoPasst(f, b) {
  if (!b || !b.gefunden) return false;
  return !f.optionen.filter((_, i) => !f.richtig.includes(i)).some((o) => titelPasst(o, b.artikel));
}

async function fotoMerken(id, b) {
  const daten = await verkleinern(b.bild);
  if (!daten) return null;
  await lyra.speicher.schreiben('bilder/' + id, daten);
  z.bilder[id] = daten;
  return { id, urheber: text(b.urheber), lizenz: text(b.lizenz), lizenzUrl: text(b.lizenzUrl), dateiUrl: text(b.dateiUrl), artikel: text(b.artikel), artikelUrl: text(b.artikelUrl) };
}

/** Fotos zu den Bilderfragen holen; Fragen ohne passendes Foto fallen weg. → {fragen, meldung} */
async function bilderHolen(quizId, fragen) {
  const bild = fragen.filter((f) => f.art === 'bild');
  if (!bild.length) return { fragen, meldung: '' };
  z.hinweis = `Hole ${bild.length} Foto${bild.length === 1 ? '' : 's'} aus Wikipedia …`;
  const el = document.getElementById('hinweis');
  if (el) el.textContent = z.hinweis;
  let liste = [];
  let m = '';
  try {
    liste = await lyra.bilder(bild.map((f) => f.begriff));
    const nochmal = bild.map((f, i) => (fotoPasst(f, liste[i]) ? null : i)).filter((i) => i !== null);
    if (nochmal.length) {
      const zweite = await lyra.bilder(nochmal.map((i) => bild[i].optionen[bild[i].richtig[0]]));
      nochmal.forEach((i, k) => { if (fotoPasst(bild[i], zweite[k])) liste[i] = zweite[k]; });
    }
  } catch (e) { m = 'Fotos ließen sich nicht laden (' + meldung(e) + ') – die Bilderfragen fallen weg.'; }
  for (const [i, f] of bild.entries()) {
    const b = fotoPasst(f, liste[i]) ? liste[i] : null;
    try { f.bild = b ? await fotoMerken(`${quizId}-${i}-${lyra.neueId()}`, b) : null; } catch (_) { f.bild = null; }
    if (!f.bild) f.weg = true;
  }
  const weg = bild.filter((f) => f.weg).length;
  if (weg && !m) m = weg === 1 ? 'Zu einer Bilderfrage gab es kein passendes Foto – sie fällt weg.' : `Zu ${weg} Bilderfragen gab es kein passendes Foto – sie fallen weg.`;
  return { fragen: fragen.filter((f) => !f.weg), meldung: m };
}

async function bilderLaden(fragen) {
  for (const f of fragen) {
    if (f.art !== 'bild' || !f.bild || z.bilder[f.bild.id]) continue;
    try { const d = await lyra.speicher.lesen('bilder/' + f.bild.id); if (d) z.bilder[f.bild.id] = d; } catch (_) {}
  }
}

function foto(f, gross = false) {
  const b = f.bild;
  if (!b || !z.bilder[b.id]) return h('div', { class: 'foto fehlt' }, 'Foto fehlt');
  return h('figure', { class: 'foto' + (gross ? ' gross' : '') },
    h('img', { src: z.bilder[b.id], alt: 'Foto zur Frage' }),
    h('figcaption', {}, `Foto: ${b.urheber || 'unbekannt'}${b.lizenz ? ' · ' + b.lizenz : ''} · `,
      b.dateiUrl ? h('button', { class: 'foto-link', onclick: () => lyra.link(b.dateiUrl).catch(() => {}) }, 'Wikimedia Commons') : 'Wikimedia Commons'));
}

// ================================================================== Quiz per KI

function typenText() {
  const b = {
    auswahl: '"auswahl": genau 4 "optionen", genau eine richtig ("richtig": [Nummer ab 0])',
    mehrfach: '"mehrfach": 4 bis 5 "optionen", zwei oder drei richtig ("richtig": [Nummern])',
    wahrfalsch: '"wahrfalsch": "frage" ist eine Aussage; "richtig": [0] wenn wahr, [1] wenn falsch',
    schaetzen: '"schaetzen": Antwort ist eine Zahl in "wert" (mit "zahl_einheit"), "min" und "max" geben einen sinnvollen Bereich für einen Schieberegler',
    reihenfolge: '"reihenfolge": 3 bis 5 "optionen" in der RICHTIGEN Reihenfolge (die App mischt sie)',
    zuordnen: '"zuordnen": 3 bis 4 "paare" aus "links" und "rechts", die zusammengehören',
    luecke: '"luecke": "frage" enthält ___ für das fehlende Wort; "optionen" sind die akzeptierten Antworten (Schreibweisen)',
    bild: '"bild": Bilderfrage – "bild" ist NUR der Titel eines deutschen Wikipedia-Artikels (1–3 Wörter, z. B. „Rotfuchs“, '
      + '„Kolosseum“, „Mona Lisa“ – keine Bildbeschreibung), dessen Hauptbild das Gesuchte eindeutig zeigt; "frage" fragt danach, '
      + 'ohne es zu verraten (z. B. „Welches Bauwerk ist hier zu sehen?“); genau 4 "optionen", eine richtig ("richtig": [Nummer ab 0]). '
      + 'Nur, wenn es zum Thema passende, gut erkennbare Motive gibt – höchstens jede dritte Frage',
  };
  return Object.keys(TYPEN).filter((t) => z.einst.typen[t]).map((t) => '- ' + b[t]).join('\n');
}

function schemaFuer() {
  const s = structuredClone(SCHEMA);
  s.properties.fragen.items.properties.art.enum = Object.keys(TYPEN).filter((t) => z.einst.typen[t]);
  return s;
}

/** Zeit je Frage: Ordnen, Zuordnen, Tippen und Schätzen brauchen etwas länger. */
function zeitFuer(art) {
  const t = z.einst.zeit;
  if (art === 'reihenfolge' || art === 'zuordnen') return Math.max(t, 30);
  if (art === 'luecke' || art === 'schaetzen' || art === 'mehrfach') return Math.max(t, 25);
  return t;
}

/** KI-Ergebnis prüfen und in die Form des Quiz bringen (wie im Offline-Quizzard). */
function pruefen(f) {
  const art = Object.keys(TYPEN).includes(f.art) ? f.art : null;
  const frage = text(f.frage);
  if (!art || !frage) return null;
  const optionen = (f.optionen || []).map(text).filter(Boolean);
  const richtig = [...new Set((f.richtig || []).filter((x) => Number.isInteger(x)))];
  const q = { art, frage, wissenswert: text(f.wissenswert), zeit: zeitFuer(art) };
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

async function erstellen() {
  const thema = z.thema.trim();
  if (!thema) return;
  if (!Object.values(z.einst.typen).some(Boolean)) z.einst.typen.auswahl = true;
  const anzahl = Math.max(3, Math.min(30, z.einst.anzahl));
  try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {}
  z.ansicht = 'zaubern';
  z.fehler = null;
  z.meldung = '';
  z.hinweis = 'Suche passende Stellen …';
  zeichnen();
  let block = '';
  if (z.einst.quelle !== 'wissen') {
    try { block = (await lyra.suchen(thema, z.lehrer === 'lyra' ? 7 : 12)).block || ''; } catch (_) {}
    if (!block && z.einst.quelle === 'unterlagen') {
      z.fehler = 'Dazu habe ich in deinen Unterlagen nichts gefunden – wähle „Unterlagen + Wissen“ oder „Allgemeinwissen“.';
      z.ansicht = 'start';
      return zeichnen();
    }
  }
  const schwierigkeit = { leicht: 'leicht (Grundwissen)', gemischt: 'gemischt: leicht, mittel und schwer', schwer: 'schwer (für Fortgeschrittene)' }[z.einst.schwierigkeit] || 'gemischt';
  let fragen = [];
  let leer = 0;
  while (fragen.length < anzahl && leer < 2) {
    const n = Math.min(z.lehrer === 'lyra' ? 8 : 15, anzahl - fragen.length);
    const schon = fragen.map((f) => '- ' + f.frage.slice(0, 90)).join('\n');
    let r = null;
    try {
      r = await lyra.ki({
        lehrer: z.lehrer,
        system: SYSTEM,
        prompt: `Thema: ${thema}\nSchwierigkeit: ${schwierigkeit}\nSprache: Deutsch\n\n` +
          (block ? `Auszüge aus meinen Unterlagen (stütze dich darauf${z.einst.quelle === 'beides' ? ', ergänze mit Allgemeinwissen' : ''}):\n\n${block}\n\n` : 'Nutze gesichertes Allgemeinwissen.\n\n') +
          (schon ? `Diese Fragen gibt es schon – nicht wiederholen:\n${schon}\n\n` : '') +
          `Erstelle genau ${n} neue Fragen. Mische diese Fragetypen möglichst gleichmäßig (nie mehrmals hintereinander derselbe):\n${typenText()}\n\n` +
          'Alle Felder sind Pflicht – was ein Typ nicht braucht, bleibt leer ("bild": "", "optionen": [], "paare": [], "richtig": [], "wert": 0, "min": 0, "max": 0, "zahl_einheit": ""). ' +
          '"wissenswert" erklärt die Lösung in einem kurzen Satz.\n\n' +
          'Antwort als JSON: {"fragen": [{"art": "auswahl", "bild": "", "frage": "…", "max": 0, "min": 0, "optionen": ["…"], "paare": [], "richtig": [0], "wert": 0, "wissenswert": "…", "zahl_einheit": ""}]}',
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
      if (abgebrochen(e)) { z.ansicht = 'start'; return zeichnen(); }
      z.fehler = meldung(e);
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
    z.ansicht = 'start';
    return zeichnen();
  }
  const quiz = { id, titel: thema, fragen, erstellt: lyra.jetzt(), gespielt: 0 };
  await quizSichern(quiz);
  z.thema = '';
  z.meldung = mitBildern.meldung;
  // Erst ansehen und anpassen, dann spielen
  z.quiz = quiz;
  z.ansicht = 'bearbeiten';
  lyra.toast(`✦ ${fragen.length} Fragen – sieh sie dir an, bevor es losgeht`, 'ok');
  zeichnen();
}

// ================================================================== Spiel (Host)

/** Neues Spiel in der Lobby. campus: aus einem Raum geöffnet (Live-Runde läuft schon über Campus). */
async function lobbyOeffnen(quiz, { campus = false } = {}) {
  await bilderLaden(quiz.fragen);
  z.spiel = {
    id: lyra.neueId(),
    quiz,
    i: -1,
    q: null, // aktuelle Frage, fürs Spiel vorbereitet (gemischt)
    phase: 'lobby',
    spieler: new Map(), // id → {id, name, quelle, punkte, serie, richtig, zeitSumme, antworten, da, letzt}
    gaeste: null, // {url, qr}
    gaesteFehler: '',
    gaesteLaedt: false,
    campus: campus && z.kontext ? { raum: z.kontext.raum } : null,
    takt: null,
    lobbyTakt: null,
  };
  z.ansicht = 'lobby';
  zeichnen();
  if (campus) anAlle(lobbyNachricht());
  gaesteOeffnen();
}

async function gaesteOeffnen() {
  const s = z.spiel;
  if (!s || s.gaeste || s.gaesteLaedt) return;
  s.gaesteLaedt = true;
  s.gaesteFehler = '';
  zeichnen();
  try {
    const r = await lyra.gaeste.starten({ titel: s.quiz.titel });
    if (z.spiel !== s) return lyra.gaeste.beenden().catch(() => {});
    s.gaeste = r;
    for (const g of r.gaeste || []) spielerDazu(g.id, g.name, 'link');
  } catch (e) {
    s.gaesteFehler = abgebrochen(e) ? 'Ohne Spielseite können nur Campus-Mitglieder mitspielen.' : meldung(e);
  }
  s.gaesteLaedt = false;
  if (z.spiel === s) zeichnen();
}

async function campusTeilen() {
  const s = z.spiel;
  let raeume = [];
  try { raeume = await lyra.campus.raeume(); } catch (e) { return lyra.toast(meldung(e), 'fehler'); }
  if (!raeume.length) {
    return lyra.dialog('Noch kein Campus', h('p', { class: 'leise', style: { maxWidth: '420px', lineHeight: 1.5 } },
      'Melde dich in Lyra bei Campus an und tritt einem Campus bei – dann können seine Mitglieder mit ihrer Lyra mitspielen.'), [{ text: 'OK', wert: true }]);
  }
  let raum = raeume[0].id;
  const ok = await lyra.dialog('In einen Campus-Raum teilen', h('div', { class: 'spalte', style: { minWidth: '420px', gap: '12px' } },
    lyra.auswahl({ titel: 'Raum', symbol: '👥', optionen: raeume.map((r) => [r.id, r.name, `${r.mitglieder} Mitglieder`]), wert: raum, beiWahl: (w) => { raum = w; }, breit: true }),
    h('p', { class: 'leise klein', style: { lineHeight: 1.5 } }, 'Die Mitglieder sehen die Live-Runde in ihrem Campus und spielen mit ihrer Lyra mit – Ende-zu-Ende-verschlüsselt. Ihre Antworten gehen nur an dich.')),
  [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Teilen', wert: true }]);
  if (!ok || z.spiel !== s) return;
  // Fotos gehen einmal mit der Runde mit (verschlüsselt) – die Fragen verweisen nur darauf
  const bilder = {};
  for (const f of s.quiz.fragen) if (f.art === 'bild' && f.bild && z.bilder[f.bild.id]) bilder[f.bild.id] = z.bilder[f.bild.id];
  try {
    await lyra.campus.teilen({
      raum, typ: TYP, modus: 'live', selbst: true,
      titel: `Quizzard Online: ${s.quiz.titel}`,
      beschreibung: `Live-Quiz mit ${s.quiz.fragen.length} Fragen – öffnen und mitspielen`,
      daten: { quiz: s.quiz.id, titel: s.quiz.titel, anzahl: s.quiz.fragen.length, bilder },
    });
    z.kontext = await lyra.campus.kontext();
    if (z.kontext) {
      s.campus = { raum: z.kontext.raum };
      anAlle(lobbyNachricht());
      lyra.toast(`✦ Live-Runde in „${z.kontext.raum.name}“ – die Mitglieder können jetzt beitreten`, 'ok');
    }
  } catch (e) {
    if (!abgebrochen(e)) lyra.toast(meldung(e), 'fehler');
  }
  zeichnen();
}

/** An alle – Gäste im Browser bekommen auf Wunsch eine eigene Fassung (z. B. mit dem Foto). */
function anAlle(d, fuerGaeste) {
  const s = z.spiel;
  if (!s) return;
  if (s.gaeste) lyra.gaeste.senden(fuerGaeste || d).catch(() => {});
  if (s.campus) {
    lyra.campus.live(d).catch((e) => {
      if (abgebrochen(e)) { s.campus = null; lyra.toast('Campus-Mitspieler sind nicht dabei (ohne deine Zustimmung).', ''); zeichnen(); }
    });
  }
}

function anEinen(sp, d) {
  if (sp.quelle === 'link' && z.spiel && z.spiel.gaeste) lyra.gaeste.senden(d, sp.id).catch(() => {});
}

const aktiv = () => [...z.spiel.spieler.values()].filter((p) => p.da);

function lobbyNachricht() {
  const s = z.spiel;
  return { typ: 'lobby', titel: s.quiz.titel, anzahl: s.quiz.fragen.length, spieler: aktiv().length };
}

function lobbyMelden() {
  const s = z.spiel;
  if (!s || s.phase !== 'lobby') return;
  clearTimeout(s.lobbyTakt);
  s.lobbyTakt = setTimeout(() => z.spiel === s && anAlle(lobbyNachricht()), 700);
}

/** Schrittweite des Reglers zur Spanne (100 Stufen) */
function schrittFuer(spanne) {
  return Math.max(0.01, Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, spanne) / 100))));
}

/** Frage fürs Spiel vorbereiten: Antworten mischen (für alle gleich), Reihenfolge und Zuordnen mischen. */
function vorbereiten(f) {
  const q = structuredClone(f);
  if (q.art === 'auswahl' || q.art === 'mehrfach' || q.art === 'bild') {
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
  if (q.art === 'zuordnen') {
    q.links = q.paare.map((p) => p.links);
    q.rechts = lyra.mischen(q.paare.map((p) => p.rechts));
  }
  if (q.art === 'schaetzen') {
    q.schritt = schrittFuer(q.max - q.min);
    q.start = Math.round((q.min + q.max) / 2 / q.schritt) * q.schritt;
  }
  return q;
}

/** Die Frage für die Geräte – ohne Lösung. */
function frageNachricht(spaet, mitFoto = false) {
  const s = z.spiel;
  const q = s.q;
  const d = { typ: 'frage', i: s.i, n: s.quiz.fragen.length, art: q.art, frage: q.frage, zeit: q.zeit, vergangen: spaet ? Math.max(0, Date.now() - s.gesendetUm) : 0 };
  if (WAHL.includes(q.art) || q.art === 'reihenfolge') d.optionen = q.optionen;
  if (q.art === 'schaetzen') Object.assign(d, { min: q.min, max: q.max, einheit: q.einheit || '', schritt: q.schritt, start: q.start });
  if (q.art === 'zuordnen') Object.assign(d, { links: q.links, rechts: q.rechts });
  if (q.art === 'bild' && q.bild) {
    d.bildId = q.bild.id;
    d.bildNachweis = { urheber: q.bild.urheber, lizenz: q.bild.lizenz };
    if (mitFoto) d.bild = z.bilder[q.bild.id];
  }
  return d;
}

function spielerDazu(id, name, quelle) {
  const s = z.spiel;
  if (!s || !id) return;
  let p = s.spieler.get(id);
  if (!p) {
    if (s.spieler.size >= 200) return;
    p = { id, name: String(name || 'Gast').slice(0, 24), quelle, punkte: 0, serie: 0, richtig: 0, zeitSumme: 0, antworten: {}, da: true, letzt: null };
    s.spieler.set(id, p);
    if (s.phase !== 'lobby') lyra.toast(`${p.name} ist dazugekommen`);
  } else {
    p.da = true;
  }
  // Wer später kommt, bekommt den Stand
  anEinen(p, lobbyNachricht());
  if (s.phase === 'frage') anEinen(p, frageNachricht(true, true));
  lobbyMelden();
  zeichnen();
}

function spielerWeg(id) {
  const p = z.spiel && z.spiel.spieler.get(id);
  if (!p) return;
  p.da = false;
  if (z.spiel.phase === 'lobby') z.spiel.spieler.delete(id);
  lobbyMelden();
  zeichnen();
  if (z.spiel.phase === 'frage' && alleDa()) schliessenBald();
}

async function spielerEntfernen(p) {
  const ok = await lyra.bestaetigen({ titel: `${p.name} entfernen?`, text: 'Der Name verschwindet aus dem Spiel.', ja: 'Entfernen', gefahr: true });
  if (!ok || !z.spiel) return;
  if (p.quelle === 'link') lyra.gaeste.entfernen(p.id).catch(() => {});
  z.spiel.spieler.delete(p.id);
  lobbyMelden();
  zeichnen();
}

function gastEreignis(e) {
  if (!z.spiel || !e) return;
  if (e.art === 'beigetreten') spielerDazu(e.id, e.name, 'link');
  else if (e.art === 'gegangen') spielerWeg(e.id);
  else if (e.art === 'nachricht') eingang(e.id, e.daten || {}, e.zeit);
}

function campusEreignis(e) {
  if (!e) return;
  if (z.ansicht === 'spieler') {
    if (e.art === 'live' && e.daten && z.spielerAnsicht) {
      // Der Host öffnet die Lobby (vielleicht erst nach dir): noch einmal „bin da“ sagen – höchstens alle 5 s
      if (e.daten.typ === 'lobby' && Date.now() - (z.daZuletzt || 0) > 5000) {
        z.daZuletzt = Date.now();
        lyra.campus.anHost({ typ: 'da' }, 'Deine Teilnahme an der Live-Runde').catch(() => {});
      }
      z.spielerAnsicht.empfangen(e.daten);
    }
    return;
  }
  const s = z.spiel;
  if (!s || !s.campus || e.art !== 'ergebnis') return;
  const d = e.daten || {};
  if (d.typ === 'da') spielerDazu(e.von, e.name, 'campus');
  else eingang(e.von, d, e.zeit);
}

/** Ist die Antwort in sich gültig (Form passt zum Fragetyp)? */
function antwortGueltig(q, a) {
  const ganz = (x, n) => Number.isInteger(x) && x >= 0 && x < n;
  switch (q.art) {
    case 'auswahl': case 'wahrfalsch': case 'bild': return Array.isArray(a) && a.length === 1 && ganz(a[0], q.optionen.length);
    case 'mehrfach': return Array.isArray(a) && a.length > 0 && a.length <= q.optionen.length && a.every((x) => ganz(x, q.optionen.length));
    case 'schaetzen': return Number.isFinite(Number(a));
    case 'reihenfolge': return Array.isArray(a) && a.length === q.optionen.length && new Set(a).size === a.length && a.every((x) => ganz(x, q.optionen.length));
    case 'zuordnen': return Array.isArray(a) && a.length === q.links.length && a.every((x) => x === -1 || ganz(x, q.rechts.length));
    case 'luecke': return typeof a === 'string' && a.length <= 200;
  }
  return false;
}

/** Wie richtig ist die Antwort? 0–1 (wie im Offline-Quizzard) */
function bewerten(q, a) {
  switch (q.art) {
    case 'auswahl': case 'bild': case 'wahrfalsch':
      return q.richtig.includes(a[0]) ? 1 : 0;
    case 'mehrfach': {
      const e = [...new Set(a)];
      const treffer = e.filter((x) => q.richtig.includes(x)).length;
      const falsch = e.length - treffer;
      return treffer === q.richtig.length && !falsch ? 1 : Math.max(0, (treffer - falsch) / q.richtig.length) * 0.8;
    }
    case 'schaetzen': {
      const daneben = Math.abs(Number(a) - q.wert) / (q.max - q.min || 1);
      return daneben <= 0.02 ? 1 : Math.max(0, 1 - daneben / 0.25);
    }
    case 'reihenfolge':
      return a.map((i) => q.optionen[i]).filter((x, i) => x === q.loesung[i]).length / q.loesung.length;
    case 'zuordnen':
      return q.paare.filter((p, i) => a[i] >= 0 && q.rechts[a[i]] === p.rechts).length / q.paare.length;
    case 'luecke': {
      const t = normal(a);
      if (!t) return 0;
      return q.optionen.some((o) => { const b = normal(o); return t === b || (b.length >= 5 && abstand(t, b) <= 1); }) ? 1 : 0;
    }
  }
  return 0;
}

function abstand(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Eine Antwort kommt an. Die Zeit misst das Gerät der Spielenden (fair bei langsamer Verbindung) – aber nie schneller als
 *  physikalisch möglich. */
function eingang(id, d, ankunft) {
  const s = z.spiel;
  if (!s || d.typ !== 'antwort' || s.phase !== 'frage' || d.i !== s.i) return;
  const p = s.spieler.get(id);
  if (!p || p.antworten[s.i]) return;
  const q = s.q;
  // Ältere Fassung (1.0) schickte „wahl“ statt „antwort“
  const antwort = d.antwort !== undefined ? d.antwort : (Number.isInteger(d.wahl) ? [d.wahl] : undefined);
  if (!antwortGueltig(q, antwort)) return;
  const T = q.zeit * 1000;
  let ms = Number(d.ms);
  if (!Number.isFinite(ms)) ms = T;
  const unterwegs = (Number(ankunft) || Date.now()) - s.gesendetUm;
  ms = Math.max(ms, unterwegs - (p.quelle === 'campus' ? 8000 : 4000));
  ms = Math.min(Math.max(0, ms), T);
  p.antworten[s.i] = { antwort, ms, teil: bewerten(q, antwort) };
  const n = document.getElementById('beantwortet');
  if (n) n.textContent = beantwortetText();
  if (alleDa()) schliessenBald();
}

const alleDa = () => {
  const a = aktiv();
  return a.length > 0 && a.every((p) => p.antworten[z.spiel.i]);
};

function beantwortetText() {
  const a = aktiv();
  return `${a.filter((p) => p.antworten[z.spiel.i]).length} von ${a.length} haben geantwortet`;
}

function spielStarten() {
  const s = z.spiel;
  if (!s || !aktiv().length) return;
  s.quiz.gespielt = (s.quiz.gespielt || 0) + 1;
  quizSichern(s.quiz);
  frageStarten(0);
}

function frageStarten(i) {
  const s = z.spiel;
  clearInterval(s.takt);
  s.i = i;
  s.q = vorbereiten(s.quiz.fragen[i]);
  s.phase = 'frage';
  s.gesendetUm = Date.now();
  s.ende = s.gesendetUm + s.q.zeit * 1000;
  s.schliessenGeplant = false;
  anAlle(frageNachricht(false), s.q.art === 'bild' ? frageNachricht(false, true) : null);
  z.ansicht = 'frage';
  ton('frage');
  zeichnen();
  s.takt = setInterval(() => {
    const rest = Math.max(0, s.ende - Date.now());
    const u = document.querySelector('.host-uhr .qo-uhr');
    if (u) u.replaceWith(sternUhr(rest / (s.q.zeit * 1000), Math.ceil(rest / 1000), true));
    // Kurz nachwarten: Antworten aus der letzten Sekunde sind noch unterwegs
    if (Date.now() >= s.ende + 1500) schliessen();
  }, 250);
}

function schliessenBald() {
  const s = z.spiel;
  if (s.schliessenGeplant) return;
  s.schliessenGeplant = true;
  setTimeout(() => z.spiel === s && schliessen(), 600);
}

function rangliste() {
  return [...z.spiel.spieler.values()].sort((a, b) => b.punkte - a.punkte || a.zeitSumme - b.zeitSumme || a.name.localeCompare(b.name));
}

function standKarte(rang) {
  const stand = {};
  rang.forEach((p, k) => {
    const l = p.letzt || {};
    stand[p.id] = { gesamt: p.punkte, delta: l.delta || 0, teil: l.teil || 0, korrekt: (l.teil || 0) >= 0.999, beantwortet: !!l.beantwortet, serie: p.serie, platz: k + 1, richtigGesamt: p.richtig };
  });
  return stand;
}

function loesungText(q) {
  switch (q.art) {
    case 'auswahl': case 'bild': case 'mehrfach': case 'wahrfalsch': return 'Richtig: ' + q.richtig.map((i) => q.optionen[i]).join(', ');
    case 'schaetzen': return `Richtig: ${fmt(q.wert)}${q.einheit ? ' ' + q.einheit : ''}`;
    case 'reihenfolge': return 'Richtig: ' + q.loesung.join(' → ');
    case 'zuordnen': return q.paare.map((p) => `${p.links} – ${p.rechts}`).join(' · ');
    case 'luecke': return 'Richtig: ' + q.optionen[0];
  }
  return '';
}

function schliessen() {
  const s = z.spiel;
  if (!s || s.phase !== 'frage') return;
  clearInterval(s.takt);
  s.phase = 'aufloesung';
  const q = s.q;
  const T = q.zeit * 1000;
  const verteilung = WAHL.includes(q.art) ? q.optionen.map(() => 0) : null;
  const zaehler = { voll: 0, teils: 0, daneben: 0, ohne: 0 };
  for (const p of s.spieler.values()) {
    const a = p.antworten[s.i];
    if (a && verteilung) for (const x of a.antwort) verteilung[x]++;
    const teil = a ? a.teil : 0;
    let delta = 0;
    if (teil >= 0.999) {
      p.serie++;
      p.richtig++;
    } else {
      p.serie = 0;
    }
    if (teil > 0) {
      // Bis 1000 Punkte, je schneller desto mehr (mindestens die Hälfte) – teilweise richtig anteilig, dazu ein Serienbonus
      delta = Math.round(teil * 1000 * (1 - a.ms / T / 2)) + (teil >= 0.999 && p.serie >= 2 ? Math.min(500, (p.serie - 1) * 100) : 0);
      p.zeitSumme += a.ms;
    }
    if (!a) zaehler.ohne++; else if (teil >= 0.999) zaehler.voll++; else if (teil > 0) zaehler.teils++; else zaehler.daneben++;
    p.punkte += delta;
    p.letzt = { teil, delta, beantwortet: !!a };
  }
  const rang = rangliste();
  s.verteilung = verteilung;
  s.zaehler = zaehler;
  anAlle({ typ: 'aufloesung', i: s.i, art: q.art, loesungText: loesungText(q), wissenswert: q.wissenswert, verteilung, stand: standKarte(rang), spieler: rang.length });
  z.ansicht = 'aufloesung';
  ton('aufloesung');
  zeichnen();
}

function weiter() {
  const s = z.spiel;
  if (z.ansicht === 'aufloesung') { z.ansicht = 'rangliste'; return zeichnen(); }
  if (s.i + 1 < s.quiz.fragen.length) return frageStarten(s.i + 1);
  spielEnde();
}

async function spielEnde() {
  const s = z.spiel;
  clearInterval(s.takt);
  s.phase = 'ende';
  const rang = rangliste();
  const podium = rang.slice(0, 3).map((p) => ({ name: p.name, punkte: p.punkte }));
  anAlle({ typ: 'ende', podium, stand: standKarte(rang), spieler: rang.length });
  const runde = { id: s.id, quiz: s.quiz.titel, zeit: lyra.jetzt(), fragen: s.quiz.fragen.length, rangliste: rang.map((p) => ({ name: p.name, punkte: p.punkte, richtig: p.richtig, quelle: p.quelle })) };
  try { await lyra.speicher.schreiben('runden/' + s.id, runde); } catch (_) {}
  z.runden.unshift(runde);
  z.ansicht = 'ende';
  ton('ende');
  sternschnuppen(110);
  zeichnen();
}

async function spielBeenden() {
  const s = z.spiel;
  if (!s) return;
  clearInterval(s.takt);
  if (s.phase !== 'ende') anAlle({ typ: 'vorbei' });
  try { await lyra.gaeste.beenden(); } catch (_) {}
  z.spiel = null;
  z.ansicht = 'start';
  await quizzeLaden();
  zeichnen();
}

function csvSichern() {
  const rang = rangliste();
  const zeilen = [['Platz', 'Name', 'Punkte', 'Volltreffer', 'Über'].join(';'),
    ...rang.map((p, i) => [i + 1, `"${p.name.replace(/"/g, '""')}"`, p.punkte, `${p.richtig}/${z.spiel.quiz.fragen.length}`, p.quelle === 'campus' ? 'Campus' : 'Link'].join(';'))];
  lyra.speichern(`Quizzard Online – ${z.spiel.quiz.titel}.csv`, '﻿' + zeilen.join('\n')).catch(() => {});
}

// ================================================================== Mitspielen mit Lyra (aus einem Campus-Raum)

async function spielerStarten(k) {
  z.ansicht = 'spieler';
  app.replaceChildren();
  const daten = k.inhalt.daten || {};
  z.spielerAnsicht = QOSpieler.erstellen(app, {
    ich: { id: k.ich.id, name: k.ich.name },
    bild: (id) => (daten.bilder || {})[id] || null,
    senden: (d) => lyra.campus.anHost(d, 'Deine Antworten in der Live-Runde').catch((e) => {
      if (abgebrochen(e)) z.spielerAnsicht.empfangen({ typ: 'vorbei' });
    }),
  });
  z.spielerAnsicht.empfangen({ typ: 'lobby', titel: daten.titel || k.inhalt.titel, anzahl: daten.anzahl });
  try {
    z.daZuletzt = Date.now();
    await lyra.campus.anHost({ typ: 'da' }, 'Deine Teilnahme an der Live-Runde');
  } catch (e) {
    z.spielerAnsicht.empfangen({ typ: 'vorbei' });
    if (!abgebrochen(e)) lyra.toast(meldung(e), 'fehler');
  }
}

// ================================================================== Klang, Sternschnuppen

let audio = null;
function ton(art) {
  try {
    audio = audio || new AudioContext();
    // Glöckchen in einer Pentatonik – klingt nach Spieluhr statt Spielhalle
    const noten = { frage: [784, 1175], aufloesung: [880, 1319, 1760], ende: [659, 784, 988, 1319, 1568] }[art] || [880];
    noten.forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = audio.currentTime + i * 0.11;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + 1);
    });
  } catch (_) {}
}

function sternschnuppen(viel = 80) {
  for (let i = 0; i < viel; i++) {
    const k = document.createElement('div');
    k.className = 'schnuppe';
    k.textContent = ['✦', '✧', '⋆', '★'][i % 4];
    k.style.left = Math.random() * 100 + 'vw';
    k.style.fontSize = 10 + Math.random() * 18 + 'px';
    k.style.animationDuration = 2.2 + Math.random() * 2 + 's';
    k.style.animationDelay = Math.random() * 0.8 + 's';
    document.body.appendChild(k);
    setTimeout(() => k.remove(), 5200);
  }
}

// ================================================================== Ansichten

function zeichnen() {
  if (z.ansicht === 'spieler') return;
  const ansicht = { start: startAnsicht, zaubern: zauberAnsicht, bearbeiten: bearbeitenAnsicht, lobby: lobbyAnsicht, frage: frageAnsicht, aufloesung: aufloesungAnsicht, rangliste: ranglistenAnsicht, ende: endeAnsicht }[z.ansicht] || startAnsicht;
  app.replaceChildren(h('div', { class: 'buehne' + (z.spiel ? ' im-spiel' : '') }, ansicht()));
}

function pille(titel, optionen, schluessel) {
  return lyra.auswahl({ titel, optionen, wert: z.einst[schluessel], beiWahl: (w) => { z.einst[schluessel] = isNaN(Number(w)) ? w : Number(w); zeichnen(); } });
}

function startAnsicht() {
  const k = z.kontext;
  const leite = k && k.inhalt && k.inhalt.typ === TYP;
  return [
    h('div', { class: 'logo' }, h('span', { class: 'logo-stern' }, '✦'), ' Quizzard Online'),
    h('p', { class: 'slogan' }, 'Ein Quiz unter demselben Sternenhimmel – alle gleichzeitig, wer schneller richtig liegt, strahlt am hellsten.'),
    leite ? h('div', { class: 'hinweis-band' }, `Live-Runde in „${k.raum.name}“: Wähle unten ein Quiz und öffne das Portal – die Mitglieder spielen mit ihrer Lyra mit.`) : null,
    h('div', { class: 'panel' },
      h('h2', {}, '✦ Neues Quiz mit KI'),
      h('div', { class: 'zeile', style: { gap: '10px' } },
        h('input', {
          class: 'eingabe wachsen', placeholder: 'Thema, z. B. „Photosynthese“ oder „Französische Revolution“', value: z.thema,
          oninput: (e) => { z.thema = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') erstellen(); },
        }),
        h('button', { class: 'knopf', onclick: erstellen }, 'Erschaffen')),
      h('div', { class: 'zeile umbruch', style: { gap: '8px', marginTop: '12px' } },
        pille('Fragen', [[5, '5'], [8, '8'], [10, '10'], [15, '15'], [20, '20']], 'anzahl'),
        pille('Zeit je Frage', [[10, '10 s'], [20, '20 s'], [30, '30 s'], [45, '45 s'], [60, '60 s']], 'zeit'),
        pille('Woraus', [['beides', 'Unterlagen + Wissen'], ['unterlagen', 'Nur Unterlagen'], ['wissen', 'Allgemeinwissen']], 'quelle'),
        pille('Schwierigkeit', [['leicht', 'Leicht'], ['gemischt', 'Gemischt'], ['schwer', 'Schwer']], 'schwierigkeit'),
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null),
      h('div', { class: 'typen' },
        h('span', { class: 'leise klein' }, 'Fragetypen:'),
        Object.entries(TYPEN).map(([t, [name, unter]]) => h('button', {
          class: 'typ-chip' + (z.einst.typen[t] ? ' an' : ''), title: unter,
          onclick: () => { z.einst.typen[t] = !z.einst.typen[t]; zeichnen(); },
        }, name))),
      z.fehler ? h('div', { style: { marginTop: '12px' } }, lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); })) : null,
      h('button', { class: 'knopf text', style: { marginTop: '8px' }, onclick: () => neuesLeeresQuiz() }, 'Oder selbst Fragen schreiben →')),
    h('h2', { class: 'zwischen' }, 'Deine Quizze'),
    z.quizze.length
      ? h('div', { class: 'liste' }, z.quizze.map((q) => h('div', { class: 'quiz-zeile' },
        h('div', { class: 'wachsen', onclick: () => { z.quiz = q; z.ansicht = 'bearbeiten'; zeichnen(); } },
          h('div', { class: 'quiz-titel' }, q.titel),
          h('div', { class: 'leise klein' }, `${q.fragen.length} Fragen · ${[...new Set(q.fragen.map((f) => TYPEN[f.art] ? TYPEN[f.art][0] : ''))].filter(Boolean).join(', ')}${q.gespielt ? ` · ${q.gespielt}× gespielt` : ''}`)),
        h('button', { class: 'knopf tonal', title: 'Bearbeiten', onclick: () => { z.quiz = q; z.ansicht = 'bearbeiten'; zeichnen(); } }, '✎'),
        h('button', { class: 'knopf tonal', title: 'Löschen', onclick: () => quizLoeschen(q) }, '✕'),
        h('button', { class: 'knopf', onclick: () => lobbyOeffnen(q, { campus: leite }) }, 'Portal öffnen ✦'))))
      : h('p', { class: 'leise' }, 'Noch keine Quizze – erschaffe oben das erste.'),
    z.runden.length ? h('h2', { class: 'zwischen' }, 'Letzte Runden') : null,
    z.runden.length ? h('div', { class: 'liste' }, z.runden.map((r) => h('div', { class: 'quiz-zeile' },
      h('div', { class: 'wachsen' },
        h('div', { class: 'quiz-titel' }, `♛ ${(r.rangliste[0] && r.rangliste[0].name) || '–'}`),
        h('div', { class: 'leise klein' }, `${r.quiz} · ${r.rangliste.length} Mitspielende · ${lyra.zeitText(r.zeit)}`))))) : null,
  ];
}

async function quizLoeschen(q) {
  const ok = await lyra.bestaetigen({ titel: `„${q.titel}“ löschen?`, text: 'Das Quiz verschwindet mit allen Fragen und Fotos.', ja: 'Löschen', gefahr: true });
  if (!ok) return;
  try { await lyra.speicher.loeschen('quiz/' + q.id); } catch (_) {}
  for (const f of q.fragen) if (f.art === 'bild' && f.bild) { try { await lyra.speicher.loeschen('bilder/' + f.bild.id); } catch (_) {} delete z.bilder[f.bild.id]; }
  z.quizze = z.quizze.filter((x) => x.id !== q.id);
  zeichnen();
}

function neuesLeeresQuiz() {
  z.quiz = { id: lyra.neueId(), titel: z.thema.trim() || 'Mein Quiz', fragen: [], erstellt: lyra.jetzt(), gespielt: 0 };
  z.thema = '';
  z.ansicht = 'bearbeiten';
  zeichnen();
  frageBearbeiten(null);
}

function zauberAnsicht() {
  return h('div', { class: 'mitte' },
    h('div', { class: 'orb' }, h('span', {}, '✦')),
    h('h2', { class: 'serif' }, 'Die Sterne ordnen sich …'),
    h('p', { class: 'leise', id: 'hinweis' }, z.hinweis),
    h('button', { class: 'knopf text', onclick: () => lyra.abbrechen() }, 'Abbrechen'));
}

/** Kurzfassung einer Frage für die Liste im Editor */
function frageKurz(f) {
  switch (f.art) {
    case 'schaetzen': return [h('span', { class: 'opt richtig' }, `≈ ${fmt(f.wert)}${f.einheit ? ' ' + f.einheit : ''}`), h('span', { class: 'leise klein' }, ` (${fmt(f.min)} bis ${fmt(f.max)})`)];
    case 'reihenfolge': return h('span', { class: 'leise klein' }, f.optionen.join(' → '));
    case 'zuordnen': return h('span', { class: 'leise klein' }, f.paare.map((p) => `${p.links} – ${p.rechts}`).join(' · '));
    case 'luecke': return h('span', { class: 'opt richtig' }, f.optionen.join(' / '));
    default: return h('div', { class: 'optionen-mini' }, f.optionen.map((o, j) => h('span', { class: `opt ${TOENE[j % TOENE.length]}${f.richtig.includes(j) ? ' richtig' : ''}` }, `${ZEICHEN[j % ZEICHEN.length]} ${o}`)));
  }
}

function bearbeitenAnsicht() {
  const q = z.quiz;
  return [
    h('div', { class: 'zeile', style: { gap: '10px', marginBottom: '14px' } },
      h('button', { class: 'knopf tonal', onclick: () => { z.ansicht = 'start'; z.quiz = null; zeichnen(); } }, '←'),
      h('input', { class: 'eingabe wachsen titel-eingabe', value: q.titel, onchange: (e) => { q.titel = e.target.value.trim() || q.titel; quizSichern(q); } }),
      h('button', { class: 'knopf', disabled: q.fragen.length < 1, onclick: () => lobbyOeffnen(q, { campus: !!(z.kontext && z.kontext.inhalt && z.kontext.inhalt.typ === TYP) }) }, 'Portal öffnen ✦')),
    z.meldung ? h('div', { class: 'hinweis-band' }, z.meldung) : null,
    h('p', { class: 'leise klein' }, `${q.fragen.length} Fragen · Prüfe sie vor dem Spiel – tippe auf eine Frage, um sie zu ändern.`),
    h('div', { class: 'liste' }, q.fragen.map((f, i) => h('div', { class: 'frage-karte', onclick: () => frageBearbeiten(i) },
      h('div', { class: 'zeile', style: { gap: '12px', alignItems: 'flex-start' } },
        h('span', { class: 'nr' }, String(i + 1)),
        f.art === 'bild' && f.bild && z.bilder[f.bild.id] ? h('img', { class: 'mini-foto', src: z.bilder[f.bild.id], alt: '' }) : null,
        h('div', { class: 'wachsen' },
          h('div', { class: 'typ-marke' }, TYPEN[f.art] ? TYPEN[f.art][0] : f.art),
          h('div', { class: 'fett' }, f.frage),
          h('div', { style: { marginTop: '6px' } }, frageKurz(f))),
        h('span', { class: 'leise klein' }, `${f.zeit} s`),
        h('div', { class: 'spalte', style: { gap: '4px' } },
          i > 0 ? h('button', { class: 'knopf symbol', title: 'Nach oben', onclick: (e) => { e.stopPropagation(); [q.fragen[i - 1], q.fragen[i]] = [q.fragen[i], q.fragen[i - 1]]; quizSichern(q); zeichnen(); } }, '↑') : null,
          h('button', { class: 'knopf symbol', title: 'Löschen', onclick: (e) => { e.stopPropagation(); q.fragen.splice(i, 1); quizSichern(q); zeichnen(); } }, '✕')))))),
    h('button', { class: 'knopf tonal', style: { marginTop: '12px' }, onclick: () => frageBearbeiten(null) }, '+ Frage hinzufügen'),
  ];
}

/** Eine Frage bearbeiten oder neu anlegen – mit Feldern je Fragetyp. */
async function frageBearbeiten(i) {
  const q = z.quiz;
  const alt = i == null ? null : q.fragen[i];
  // Arbeitskopie mit Feldern für alle Typen (beim Wechseln des Typs geht nichts verloren)
  const f = {
    art: alt ? alt.art : 'auswahl',
    frage: alt ? alt.frage : '',
    zeit: alt ? alt.zeit : z.einst.zeit,
    wissenswert: alt ? alt.wissenswert || '' : '',
    optionen: alt && alt.optionen ? alt.optionen.slice() : ['', '', '', ''],
    richtig: alt && alt.richtig ? alt.richtig.slice() : [0],
    wert: alt && alt.wert != null ? alt.wert : 0, min: alt && alt.min != null ? alt.min : 0, max: alt && alt.max != null ? alt.max : 100, einheit: alt ? alt.einheit || '' : '',
    paare: alt && alt.paare ? alt.paare.map((p) => ({ ...p })) : [{ links: '', rechts: '' }, { links: '', rechts: '' }, { links: '', rechts: '' }],
    bild: alt ? alt.bild || null : null,
    begriff: alt ? alt.begriff || '' : '',
  };
  const box = h('div', { class: 'spalte editor', style: { minWidth: '560px', gap: '10px' } });
  const feld = (wert, platz, aendern, extra = {}) => h('input', { class: 'eingabe', value: wert, placeholder: platz, oninput: (e) => aendern(e.target.value), ...extra });
  const malen = () => {
    const art = f.art;
    const teile = [
      lyra.auswahl({ titel: 'Fragetyp', optionen: Object.entries(TYPEN).map(([t, [n, u]]) => [t, n, u]), wert: art, beiWahl: (w) => {
        f.art = w;
        if (w === 'wahrfalsch') { f.optionen = ['Wahr', 'Falsch']; f.richtig = [f.richtig[0] === 1 ? 1 : 0]; }
        else if (f.optionen.length === 2 && f.optionen[0] === 'Wahr') f.optionen = ['', '', '', ''];
        if (w !== 'mehrfach' && f.richtig.length > 1) f.richtig = [f.richtig[0]];
        malen();
      }, breit: true }),
      h('textarea', { class: 'eingabe', rows: 2, placeholder: art === 'luecke' ? 'Satz mit ___ für die Lücke' : art === 'wahrfalsch' ? 'Die Aussage' : 'Die Frage', value: f.frage, oninput: (e) => { f.frage = e.target.value; } }),
    ];
    if (art === 'bild') {
      teile.push(h('div', { class: 'zeile', style: { gap: '8px' } },
        feld(f.begriff, 'Was soll das Foto zeigen? (Wikipedia-Artikel, z. B. „Kolosseum“)', (v) => { f.begriff = v; }, { class: 'eingabe wachsen' }),
        h('button', { class: 'knopf tonal', onclick: async (e) => {
          const knopf = e.target;
          if (!f.begriff.trim()) return lyra.toast('Gib zuerst an, was zu sehen sein soll.', 'fehler');
          knopf.disabled = true;
          knopf.textContent = 'Suche …';
          try {
            const [b] = await lyra.bilder([f.begriff.trim()]);
            if (!b || !b.gefunden) lyra.toast('Dazu gibt es kein Foto in Wikipedia – versuch einen anderen Begriff.', 'fehler');
            else f.bild = await fotoMerken(`${q.id}-${lyra.neueId()}`, b);
          } catch (err) { lyra.toast(meldung(err), 'fehler'); }
          malen();
        } }, f.bild ? 'Anderes Foto' : 'Foto suchen')));
      if (f.bild) teile.push(foto(f));
    }
    if (WAHL.includes(art)) {
      const mehr = art === 'mehrfach';
      teile.push(...f.optionen.map((o, j) => h('div', { class: 'zeile', style: { gap: '8px' } },
        h('button', { class: `richtig-wahl ${TOENE[j % TOENE.length]}${f.richtig.includes(j) ? ' an' : ''}`, title: mehr ? 'Richtig – an oder aus' : 'Diese ist richtig',
          onclick: () => { if (mehr) f.richtig = f.richtig.includes(j) ? f.richtig.filter((x) => x !== j) : [...f.richtig, j]; else f.richtig = [j]; malen(); } }, f.richtig.includes(j) ? '✓' : ZEICHEN[j % ZEICHEN.length]),
        art === 'wahrfalsch' ? h('span', { class: 'wachsen fett' }, o)
          : feld(o, j < 2 ? `Antwort ${j + 1}` : `Antwort ${j + 1} (optional)`, (v) => { f.optionen[j] = v; }, { class: 'eingabe wachsen' }),
        art !== 'wahrfalsch' && f.optionen.length > 2 ? h('button', { class: 'knopf symbol', title: 'Entfernen', onclick: () => { f.optionen.splice(j, 1); f.richtig = f.richtig.filter((x) => x !== j).map((x) => (x > j ? x - 1 : x)); if (!f.richtig.length) f.richtig = [0]; malen(); } }, '✕') : null)));
      if (art !== 'wahrfalsch' && f.optionen.length < 6) teile.push(h('button', { class: 'knopf text', onclick: () => { f.optionen.push(''); malen(); } }, '+ Antwort'));
      teile.push(h('p', { class: 'leise klein' }, mehr ? 'Tippe links alle richtigen an.' : 'Tippe links auf das Zeichen der richtigen Antwort.'));
    }
    if (art === 'schaetzen') {
      teile.push(h('div', { class: 'zeile', style: { gap: '8px' } },
        h('label', { class: 'spalte wachsen' }, h('span', { class: 'leise klein' }, 'Richtige Zahl'), feld(String(f.wert), '42', (v) => { f.wert = Number(String(v).replace(',', '.')); }, { inputmode: 'decimal' })),
        h('label', { class: 'spalte wachsen' }, h('span', { class: 'leise klein' }, 'Einheit'), feld(f.einheit, 'z. B. km', (v) => { f.einheit = v; })),
        h('label', { class: 'spalte wachsen' }, h('span', { class: 'leise klein' }, 'Regler von'), feld(String(f.min), '0', (v) => { f.min = Number(String(v).replace(',', '.')); }, { inputmode: 'decimal' })),
        h('label', { class: 'spalte wachsen' }, h('span', { class: 'leise klein' }, 'bis'), feld(String(f.max), '100', (v) => { f.max = Number(String(v).replace(',', '.')); }, { inputmode: 'decimal' }))),
      h('p', { class: 'leise klein' }, 'Volle Punkte bis 2 % daneben, dann immer weniger – ab einem Viertel des Bereichs daneben keine.'));
    }
    if (art === 'reihenfolge') {
      while (f.optionen.length < 3) f.optionen.push('');
      teile.push(h('p', { class: 'leise klein' }, 'In der RICHTIGEN Reihenfolge eintragen – gemischt wird beim Spielen.'),
        ...f.optionen.map((o, j) => h('div', { class: 'zeile', style: { gap: '8px' } }, h('span', { class: 'nr' }, String(j + 1)), feld(o, `Schritt ${j + 1}`, (v) => { f.optionen[j] = v; }, { class: 'eingabe wachsen' }),
          f.optionen.length > 3 ? h('button', { class: 'knopf symbol', onclick: () => { f.optionen.splice(j, 1); malen(); } }, '✕') : null)),
        f.optionen.length < 6 ? h('button', { class: 'knopf text', onclick: () => { f.optionen.push(''); malen(); } }, '+ Schritt') : null);
    }
    if (art === 'zuordnen') {
      teile.push(h('p', { class: 'leise klein' }, 'Paare, die zusammengehören – die rechte Seite wird beim Spielen gemischt.'),
        ...f.paare.map((p, j) => h('div', { class: 'zeile', style: { gap: '8px' } },
          feld(p.links, 'links', (v) => { p.links = v; }, { class: 'eingabe wachsen' }), h('span', { class: 'leise' }, '↔'),
          feld(p.rechts, 'rechts', (v) => { p.rechts = v; }, { class: 'eingabe wachsen' }),
          f.paare.length > 3 ? h('button', { class: 'knopf symbol', onclick: () => { f.paare.splice(j, 1); malen(); } }, '✕') : null)),
        f.paare.length < 5 ? h('button', { class: 'knopf text', onclick: () => { f.paare.push({ links: '', rechts: '' }); malen(); } }, '+ Paar') : null);
    }
    if (art === 'luecke') {
      teile.push(h('label', { class: 'spalte' }, h('span', { class: 'leise klein' }, 'Richtige Antworten (mehrere Schreibweisen mit Komma)'),
        feld(f.optionen.filter(Boolean).join(', '), 'z. B. Mitochondrien, Mitochondrium', (v) => { f.optionen = v.split(',').map((x) => x.trim()); })),
        h('p', { class: 'leise klein' }, 'Groß/klein und Akzente zählen nicht; bei längeren Wörtern ist ein Tippfehler erlaubt.'));
    }
    teile.push(h('div', { class: 'zeile umbruch', style: { gap: '8px' } },
      lyra.auswahl({ titel: 'Zeit', optionen: [[10, '10 s'], [20, '20 s'], [30, '30 s'], [45, '45 s'], [60, '60 s'], [90, '90 s']], wert: f.zeit, beiWahl: (w) => { f.zeit = Number(w); } })),
    feld(f.wissenswert, 'Erklärung nach der Auflösung (optional)', (v) => { f.wissenswert = v; }));
    box.replaceChildren(...teile.filter(Boolean));
  };
  malen();
  const ok = await lyra.dialog(i == null ? 'Neue Frage' : `Frage ${i + 1}`, box, [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Speichern', wert: true }]);
  if (!ok) return;
  const neu = fertigeFrage(f);
  if (typeof neu === 'string') { lyra.toast(neu, 'fehler'); return frageBearbeiten(i); }
  if (alt && alt.bild && (!neu.bild || neu.bild.id !== alt.bild.id)) { try { await lyra.speicher.loeschen('bilder/' + alt.bild.id); } catch (_) {} }
  if (i == null) q.fragen.push(neu); else q.fragen[i] = neu;
  await quizSichern(q);
  zeichnen();
}

/** Aus der Arbeitskopie die gespeicherte Frage machen – oder ein Satz, was noch fehlt. */
function fertigeFrage(f) {
  const frage = text(f.frage);
  const basis = { art: f.art, frage, zeit: f.zeit, wissenswert: text(f.wissenswert) };
  if (!frage) return 'Die Frage fehlt.';
  switch (f.art) {
    case 'auswahl': case 'mehrfach': case 'bild': case 'wahrfalsch': {
      const gefuellt = f.optionen.map((o, j) => [text(o), j]).filter(([o]) => o);
      const richtig = gefuellt.map(([, j], neu) => (f.richtig.includes(j) ? neu : -1)).filter((x) => x >= 0);
      if (gefuellt.length < 2) return 'Es braucht mindestens zwei Antworten.';
      if (!richtig.length) return 'Markiere die richtige Antwort.';
      if (f.art !== 'mehrfach' && richtig.length !== 1) return 'Genau eine Antwort ist richtig.';
      if (f.art === 'bild' && !f.bild) return 'Such zuerst ein Foto aus.';
      return { ...basis, optionen: gefuellt.map(([o]) => o), richtig, ...(f.art === 'bild' ? { bild: f.bild, begriff: text(f.begriff) } : {}) };
    }
    case 'schaetzen':
      if (![f.wert, f.min, f.max].every(Number.isFinite) || f.min >= f.max || f.wert < f.min || f.wert > f.max) return 'Die richtige Zahl muss zwischen „von“ und „bis“ liegen.';
      return { ...basis, wert: f.wert, min: f.min, max: f.max, einheit: text(f.einheit) };
    case 'reihenfolge': {
      const o = f.optionen.map(text).filter(Boolean);
      if (o.length < 3) return 'Es braucht mindestens drei Schritte.';
      return { ...basis, optionen: o };
    }
    case 'zuordnen': {
      const paare = f.paare.map((p) => ({ links: text(p.links), rechts: text(p.rechts) })).filter((p) => p.links && p.rechts);
      if (paare.length < 3) return 'Es braucht mindestens drei Paare.';
      return { ...basis, paare };
    }
    case 'luecke': {
      const o = f.optionen.map(text).filter(Boolean);
      if (!o.length) return 'Gib die richtige Antwort an.';
      return { ...basis, frage: frage.includes('___') ? frage : frage + ' ___', optionen: o };
    }
  }
  return 'Unbekannter Fragetyp.';
}

// ---------------------------------------------------------------- Spiel-Ansichten

function spielerChips() {
  const l = aktiv();
  if (!l.length) return h('p', { class: 'leise warte-text' }, 'Noch ist niemand durchs Portal gekommen …');
  return h('div', { class: 'chips' }, l.map((p) => h('button', { class: 'spieler-chip', title: 'Entfernen', onclick: () => spielerEntfernen(p) }, `${p.quelle === 'campus' ? '👥 ' : '✦ '}${p.name}`)));
}

function lobbyAnsicht() {
  const s = z.spiel;
  const g = s.gaeste;
  return [
    h('div', { class: 'zeile', style: { gap: '10px', marginBottom: '6px' } },
      h('div', { class: 'wachsen' }, h('div', { class: 'leise klein' }, 'Das Portal ist offen'), h('h1', { class: 'spiel-titel' }, s.quiz.titel)),
      h('button', { class: 'knopf text', onclick: () => zurueck() }, 'Schließen')),
    h('div', { class: 'lobby-raster' },
      h('div', { class: 'panel beitritt' },
        h('h2', {}, '✦ Mit Link oder QR-Code'),
        h('p', { class: 'leise klein' }, 'Von überall, im Browser – ohne Lyra, ohne Konto. Ende-zu-Ende-verschlüsselt.'),
        g ? h('div', { class: 'portal' },
          g.qr ? h('div', { class: 'portal-ring' }, h('img', { class: 'qr', src: g.qr, alt: 'QR-Code zum Mitspielen' })) : null,
          h('div', { class: 'link-zeile' },
            h('code', { class: 'link' }, g.url.replace(/^https:\/\//, '').replace(/#.*$/, '#…')),
            h('button', { class: 'knopf tonal klein', onclick: () => lyra.kopieren(g.url) }, 'Link kopieren')))
          : s.gaesteLaedt ? h('div', { class: 'leise', style: { padding: '30px 0' } }, h('div', { class: 'lade' }), ' Das Portal öffnet sich …')
            : h('div', {}, s.gaesteFehler ? h('p', { class: 'fehler-text' }, s.gaesteFehler) : null, h('button', { class: 'knopf', onclick: gaesteOeffnen }, 'Spielseite öffnen'))),
      h('div', { class: 'panel' },
        h('h2', {}, '👥 Mit Lyra über Campus'),
        s.campus
          ? h('p', { class: 'leise klein' }, `Live in „${s.campus.raum.name}“ – die Mitglieder öffnen die Runde in ihrem Campus und spielen mit.`)
          : [h('p', { class: 'leise klein' }, 'Teile die Runde in einen Campus-Raum – die Mitglieder spielen mit ihrer Lyra mit.'),
            h('button', { class: 'knopf tonal', onclick: campusTeilen }, 'In einen Raum teilen …')],
        h('h2', { style: { marginTop: '18px' } }, `Dabei: ${aktiv().length}`),
        spielerChips())),
    h('div', { class: 'mitte', style: { marginTop: '18px' } },
      h('button', { class: 'knopf riesig', disabled: !aktiv().length, onclick: spielStarten }, `Runde beginnen ✦ (${s.quiz.fragen.length} Fragen)`),
      h('p', { class: 'leise klein' }, 'Du bist Host und spielst nicht mit – zeig diesen Bildschirm am besten groß für alle.')),
  ];
}

function kopfzeile() {
  const s = z.spiel;
  return h('div', { class: 'leiste-oben' },
    h('span', { class: 'pill' }, `Frage ${s.i + 1} / ${s.quiz.fragen.length}`),
    s.q ? h('span', { class: 'pill leise' }, TYPEN[s.q.art] ? TYPEN[s.q.art][0] : '') : null,
    h('span', { class: 'wachsen' }),
    s.gaeste ? h('span', { class: 'pill leise', title: s.gaeste.url }, '✦ Portal offen') : null,
    s.campus ? h('span', { class: 'pill leise' }, `👥 ${s.campus.raum.name}`) : null,
    h('span', { class: 'pill' }, `${aktiv().length} dabei`));
}

function karte(i, inhalt, extra = '') {
  return h('div', { class: `host-karte ${TOENE[i % TOENE.length]} ${extra}` }, h('span', { class: 'siegel' }, ZEICHEN[i % ZEICHEN.length]), h('span', { class: 'wachsen' }, inhalt));
}

function frageText(q) {
  if (q.art !== 'luecke') return q.frage;
  return String(q.frage).split('___').flatMap((t, i) => (i ? [h('span', { class: 'luecke' }, ' '), t] : [t]));
}

function frageAnsicht() {
  const s = z.spiel;
  const q = s.q;
  const rest = Math.max(0, s.ende - Date.now());
  let inhalt;
  if (WAHL.includes(q.art)) inhalt = h('div', { class: `host-karten n${q.optionen.length}` }, q.optionen.map((o, i) => karte(i, o)));
  else if (q.art === 'schaetzen') inhalt = h('div', { class: 'aufgabe-hinweis' }, h('div', { class: 'gross-zeichen' }, '≈'), `Schätzt auf euren Geräten – zwischen ${fmt(q.min)} und ${fmt(q.max)}${q.einheit ? ' ' + q.einheit : ''}.`);
  else if (q.art === 'reihenfolge') inhalt = [h('p', { class: 'aufgabe-hinweis' }, 'Bringt es auf euren Geräten in die richtige Reihenfolge:'), h('div', { class: 'host-karten n2' }, q.optionen.map((o, i) => karte(i, o)))];
  else if (q.art === 'zuordnen') {
    inhalt = [h('p', { class: 'aufgabe-hinweis' }, 'Was gehört zusammen?'), h('div', { class: 'zuordnen-spalten' },
      h('div', { class: 'spalte', style: { gap: '8px' } }, q.links.map((l, i) => karte(i, l))),
      h('div', { class: 'spalte', style: { gap: '8px' } }, q.rechts.map((r) => h('div', { class: 'host-karte schlicht' }, r))))];
  } else if (q.art === 'luecke') inhalt = h('div', { class: 'aufgabe-hinweis' }, h('div', { class: 'gross-zeichen' }, '✎'), 'Tippt die fehlende Antwort auf euren Geräten ein.');
  return [
    kopfzeile(),
    q.art === 'bild' ? foto(q, true) : null,
    h('div', { class: 'frage-gross' }, frageText(q)),
    h('div', { class: 'zeile', style: { justifyContent: 'center', gap: '24px', margin: '6px 0 16px' } },
      h('div', { class: 'host-uhr' }, sternUhr(rest / (q.zeit * 1000), Math.ceil(rest / 1000), true)),
      h('div', { class: 'leise', id: 'beantwortet' }, beantwortetText())),
    inhalt,
    h('div', { class: 'mitte', style: { marginTop: '16px' } }, h('button', { class: 'knopf tonal', onclick: schliessen }, 'Jetzt auflösen')),
  ];
}

function aufloesungAnsicht() {
  const s = z.spiel;
  const q = s.q;
  const zz = s.zaehler || {};
  let inhalt;
  if (WAHL.includes(q.art)) {
    const max = Math.max(1, ...s.verteilung);
    inhalt = h('div', { class: `host-karten n${q.optionen.length}` }, q.optionen.map((o, i) => {
      const richtig = q.richtig.includes(i);
      return h('div', { class: `host-karte ${TOENE[i % TOENE.length]} ${richtig ? 'richtig' : 'falsch'}` },
        h('span', { class: 'siegel' }, richtig ? '✓' : ZEICHEN[i % ZEICHEN.length]),
        h('span', { class: 'wachsen' }, o),
        h('span', { class: 'anzahl' }, String(s.verteilung[i])),
        h('span', { class: 'balken', style: { width: `${(100 * s.verteilung[i]) / max}%` } }));
    }));
  } else if (q.art === 'schaetzen') {
    const tipps = aktiv().map((p) => [p, p.antworten[s.i]]).filter(([, a]) => a).map(([p, a]) => [p.name, Number(a.antwort)]);
    const mittel = tipps.length ? tipps.reduce((x, [, w]) => x + w, 0) / tipps.length : null;
    const naechste = tipps.slice().sort((a, b) => Math.abs(a[1] - q.wert) - Math.abs(b[1] - q.wert)).slice(0, 3);
    inhalt = h('div', { class: 'mitte' },
      h('div', { class: 'schaetz-gross' }, `${fmt(q.wert)}${q.einheit ? ' ' + q.einheit : ''}`),
      mittel != null ? h('p', { class: 'leise' }, `Durchschnitt der Schätzungen: ${fmt(mittel)}${q.einheit ? ' ' + q.einheit : ''}`) : null,
      naechste.length ? h('div', { class: 'chips' }, naechste.map(([n, w], k) => h('span', { class: 'spieler-chip ruhig' }, `${['♛', '✦', '✧'][k]} ${n}: ${fmt(w)}`))) : null);
  } else if (q.art === 'reihenfolge') {
    inhalt = h('ol', { class: 'loesung-liste' }, q.loesung.map((o) => h('li', {}, o)));
  } else if (q.art === 'zuordnen') {
    inhalt = h('div', { class: 'loesung-liste' }, q.paare.map((p) => h('div', { class: 'paar-zeile' }, h('span', {}, p.links), h('span', { class: 'gold' }, '↔'), h('span', {}, p.rechts))));
  } else if (q.art === 'luecke') {
    const falsch = {};
    for (const p of aktiv()) { const a = p.antworten[s.i]; if (a && a.teil < 0.999 && a.antwort.trim()) falsch[a.antwort.trim()] = (falsch[a.antwort.trim()] || 0) + 1; }
    const oft = Object.entries(falsch).sort((a, b) => b[1] - a[1]).slice(0, 3);
    inhalt = h('div', { class: 'mitte' }, h('div', { class: 'schaetz-gross' }, q.optionen[0]),
      oft.length ? h('p', { class: 'leise' }, 'Auch versucht: ' + oft.map(([t, n]) => `„${t}“${n > 1 ? ` (${n}×)` : ''}`).join(', ')) : null);
  }
  return [
    kopfzeile(),
    q.art === 'bild' ? foto(q) : null,
    h('div', { class: 'frage-gross klein' }, frageText(q)),
    inhalt,
    h('p', { class: 'mitte fett zaehler' }, [`${zz.voll || 0} Volltreffer`, zz.teils ? `${zz.teils} teilweise` : null, `${zz.daneben || 0} daneben`, zz.ohne ? `${zz.ohne} ohne Antwort` : null].filter(Boolean).join(' · ')),
    q.wissenswert ? h('p', { class: 'mitte leise wissen' }, `✦ ${q.wissenswert}`) : null,
    h('div', { class: 'mitte', style: { marginTop: '14px' } }, h('button', { class: 'knopf riesig', onclick: weiter }, 'Sternenrang →')),
  ];
}

function ranglistenAnsicht() {
  const s = z.spiel;
  const rang = rangliste();
  const letzte = s.i + 1 >= s.quiz.fragen.length;
  return [
    kopfzeile(),
    h('h1', { class: 'mitte serif' }, letzte ? 'Vor dem Finale' : 'Sternenrang'),
    h('div', { class: 'rangliste' }, rang.slice(0, 5).map((p, i) => h('div', { class: 'rang-zeile' + (i === 0 ? ' erster' : '') },
      h('span', { class: 'platz' }, i === 0 ? '♛' : String(i + 1)),
      h('span', { class: 'wachsen name' }, p.name),
      p.serie >= 2 ? h('span', { class: 'serie' }, `✦ ${p.serie}`) : null,
      p.letzt && p.letzt.delta ? h('span', { class: 'delta' }, `+${zahl(p.letzt.delta)}`) : null,
      h('span', { class: 'gesamt' }, zahl(p.punkte))))),
    rang.length > 5 ? h('p', { class: 'mitte leise klein' }, `… und ${rang.length - 5} weitere`) : null,
    h('div', { class: 'mitte', style: { marginTop: '16px' } }, h('button', { class: 'knopf riesig', onclick: weiter }, letzte ? 'Zum Endstand ♛' : 'Nächste Frage →')),
  ];
}

function endeAnsicht() {
  const rang = rangliste();
  const podium = rang.slice(0, 3);
  return [
    h('div', { class: 'logo klein' }, 'Am hellsten strahlt …'),
    podium[0] ? h('h1', { class: 'gewinner' }, `♛ ${podium[0].name}`) : h('h1', { class: 'mitte' }, 'Niemand hat mitgespielt'),
    h('div', { class: 'podium' }, podium.map((p, i) => h('div', { class: `stufe s${i + 1}` },
      h('div', { class: 'stufe-name' }, p.name),
      h('div', { class: 'stufe-punkte' }, `${zahl(p.punkte)} · ${p.richtig}/${z.spiel.quiz.fragen.length}`),
      h('div', { class: 'stufe-saeule' }, h('span', {}, ['♛', '✦', '✧'][i]))))),
    rang.length > 3 ? h('div', { class: 'rangliste klein' }, rang.slice(3).map((p, i) => h('div', { class: 'rang-zeile' },
      h('span', { class: 'platz' }, String(i + 4)), h('span', { class: 'wachsen name' }, p.name), h('span', { class: 'gesamt' }, zahl(p.punkte))))) : null,
    h('div', { class: 'zeile', style: { justifyContent: 'center', gap: '10px', marginTop: '20px' } },
      h('button', { class: 'knopf tonal', onclick: csvSichern }, 'Ergebnisse als CSV'),
      h('button', { class: 'knopf tonal', onclick: () => nochmal() }, 'Nochmal spielen'),
      h('button', { class: 'knopf', onclick: spielBeenden }, 'Fertig')),
  ];
}

/** Gleiches Quiz, gleiche Leute: Spielseite und Campus bleiben offen. */
function nochmal() {
  const alt = z.spiel;
  const spieler = new Map([...alt.spieler.values()].filter((p) => p.da).map((p) => [p.id, { ...p, punkte: 0, serie: 0, richtig: 0, zeitSumme: 0, antworten: {}, letzt: null }]));
  z.spiel = { ...alt, id: lyra.neueId(), i: -1, q: null, phase: 'lobby', spieler, takt: null };
  z.ansicht = 'lobby';
  anAlle(lobbyNachricht());
  zeichnen();
}

start();
