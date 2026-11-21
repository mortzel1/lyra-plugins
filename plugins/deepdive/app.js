'use strict';
/*
 * Deep Dive – ein Thema aus deinen Unterlagen in kleinen Häppchen meistern.
 * Lernpfad (Kapitel) → je Kapitel kleine Häppchen: kurz erklären, gleich eine Frage zum Anklicken, dann weiter →
 * am Kapitelende ein kurzer Check (Multiple Choice, erklären, lösen, beweisen) → gemeistert oder gezielt wiederholen.
 * Tempo und Erklärlänge stellst du ein; alle Inhalte eines Kapitels werden immer vollständig durchgegangen.
 * Daten nur in Lyras Speicher für dieses Plugin (kurse/…, einstellungen).
 */
const { h, mdElement, md, balken, lauf, fehlerBox, dialog, lehrerWahl } = lyra;

// ================================================================== Aufträge an den Lehrer

const TUTOR = `Du bist Lyra im Plugin „Deep Dive“: eine geduldige, genaue Tutorin für Studierende an einer deutschen \
Universität. Du bringst der Person ein Thema in kleinen Schritten vollständig bei. Schreib auf Deutsch und sprich die \
Person mit „du“ an. Formeln in LaTeX zwischen $…$ (abgesetzt $$…$$). Stütze dich zuerst auf die Auszüge aus ihren \
Unterlagen – Bezeichnungen, Schreibweisen und Definitionen wie dort – und ergänze nur, wo sie lückenhaft sind. Erfinde \
keine Quellen oder Seitenzahlen. Verrate Lösungen von Übungsaufgaben nie ungefragt. Keine Begrüßung, keine Vorrede, \
keine Wiederholung von schon Erklärtem.`;

const LAENGE = {
  kurz: 'in höchstens 4 Sätzen (etwa 60 bis 90 Wörter) und mit einem winzigen Beispiel',
  mittel: 'in etwa 120 bis 170 Wörtern und mit einem kleinen Beispiel',
  ausfuehrlich: 'in etwa 220 bis 300 Wörtern, mit Beispiel und einer kurzen Begründung, warum es so ist',
};
const TEMPO = {
  gruendlich: [5, 8, 'sehr kleine Häppchen – lieber eines mehr'],
  normal: [4, 6, 'kleine Häppchen'],
  zuegig: [3, 4, 'etwas größere Häppchen, die trotzdem jeweils nur ein Kernthema haben'],
};
const STANDARD = { ki: 'auto', tempo: 'normal', input: 'kurz', check: 3, schwelle: 75 };

const SCHEMA_PLAN = {
  type: 'object',
  properties: {
    kurstitel: { type: 'string' },
    schritte: {
      type: 'array',
      items: {
        type: 'object',
        properties: { bezeichnung: { type: 'string' }, inhalte: { type: 'array', items: { type: 'string' } }, ziel: { type: 'string' } },
        required: ['bezeichnung', 'inhalte', 'ziel'],
      },
    },
  },
  required: ['kurstitel', 'schritte'],
};
const SCHEMA_HAEPPCHEN = {
  type: 'object',
  properties: {
    haeppchen: {
      type: 'array',
      items: { type: 'object', properties: { bezeichnung: { type: 'string' }, kern: { type: 'string' } }, required: ['bezeichnung', 'kern'] },
    },
  },
  required: ['haeppchen'],
};
// Schlüssel alphabetisch sinnvoll: Das lokale Modell schreibt sie in dieser Reihenfolge.
const SCHEMA_QUIZ = {
  type: 'object',
  properties: {
    art: { type: 'string' },
    frage: { type: 'string' },
    optionen: { type: 'array', items: { type: 'string' } },
    richtig: { type: 'array', items: { type: 'integer' } },
    warum: { type: 'string' },
  },
  required: ['art', 'frage', 'optionen', 'richtig', 'warum'],
};
const SCHEMA_AUFGABEN = {
  type: 'object',
  properties: {
    aufgaben: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          art: { type: 'string', enum: ['auswahl', 'erklaeren', 'loesen', 'beweisen'] },
          frage: { type: 'string' },
          optionen: { type: 'array', items: { type: 'string' } },
          richtig: { type: 'array', items: { type: 'integer' } },
          tipp: { type: 'string' },
          vollstaendige_loesung: { type: 'string' },
        },
        required: ['art', 'frage', 'optionen', 'richtig', 'tipp', 'vollstaendige_loesung'],
      },
    },
  },
  required: ['aufgaben'],
};
const SCHEMA_BEWERTUNG = {
  type: 'object',
  properties: { begruendung: { type: 'string' }, luecke: { type: 'string' }, punkte: { type: 'integer' } },
  required: ['begruendung', 'luecke', 'punkte'],
};

// ================================================================== Zustand

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  kurse: [],
  geladen: false,
  kurs: null,
  kapitel: 0,
  hp: 0, // angezeigtes Häppchen
  laeuft: null, // was gerade sichtbar läuft („anlegen“, „planen“, „erklaeren“, „quiz“, „rueckfrage“, „check“, „abgeben:2“, „loesung:1“)
  hinweis: '',
  strom: '',
  fehler: null,
  fehlerBei: null,
  themen: [],
  eingaben: {},
  auswahl: {},
  offeneFrage: '',
  nachOben: false,
};
const app = document.getElementById('app');
/** Häppchen, die gerade still vorbereitet werden: „Kapitel:Häppchen“ → Promise. */
const inVorbereitung = new Map();
const online = () => z.lehrer !== 'lyra';
const lehrerName = () => (z.info?.lehrer || []).find((l) => l.kennung === z.lehrer)?.name || 'Lyra';

function kuerzen(t, n) {
  t = String(t || '').trim();
  return t.length <= n ? t : t.slice(0, n).trimEnd() + ' …';
}
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const ohneNummer = (t) => t.replace(/^\(?([0-9]+|[a-dA-D])[.)]\s+/, '').trim();

// ================================================================== Lehrer fragen, suchen, speichern

/** Den Lehrer fragen. Sichtbar: Zwischenstände und Text erscheinen; sonst still (z. B. das nächste Häppchen vorbereiten). */
async function ki(art, auftrag, sichtbar = true) {
  if (sichtbar) {
    z.laeuft = art;
    z.hinweis = '';
    z.strom = '';
    z.fehler = null;
    z.fehlerBei = null;
    zeichnen();
  }
  try {
    const r = await lyra.ki({ lehrer: z.lehrer, system: TUTOR, ...auftrag }, sichtbar ? stueck : null);
    if (r && r.lehrer && r.lehrer !== z.lehrer) z.lehrer = r.lehrer; // „Lieber Lyra lokal“ gewählt
    return r;
  } catch (e) {
    const m = String((e && e.message) || e);
    if (sichtbar && !/ABGEBROCHEN|Abgebrochen/.test(m)) {
      z.fehler = m;
      z.fehlerBei = art;
    }
    return null;
  } finally {
    if (sichtbar) {
      z.laeuft = null;
      zeichnen();
    }
  }
}

let stromPlan = 0;
function stueck(e) {
  if (e.art === 'hinweis') z.hinweis = e.text;
  else if (e.art === 'text') {
    z.strom += e.text;
    z.hinweis = '';
  } else if (e.art === 'ersetzen') z.strom = e.text;
  if (!stromPlan) {
    stromPlan = requestAnimationFrame(() => {
      stromPlan = 0;
      const s = document.getElementById('strom');
      if (s) s.innerHTML = md(z.strom);
      const hw = document.getElementById('hinweis');
      if (hw) hw.textContent = z.hinweis || standardHinweis();
    });
  }
}

async function stellen(suche, anzahl) {
  try {
    return await lyra.suchen(suche, anzahl);
  } catch (_) {
    return { block: '', quellen: [] };
  }
}
const unterlagen = (block) =>
  block ? `Auszüge aus meinen Unterlagen:\n\n${block}` : 'In meinen Unterlagen steht dazu nichts – stütze dich auf gesichertes Lehrbuchwissen.\n\n';

function fortschritt(k) {
  if (!k.schritte.length) return 0;
  const summe = k.schritte.reduce((s, x) => {
    if (x.stand === 'gemeistert') return s + 1;
    const n = x.haeppchen.length || 1;
    const fertig = x.haeppchen.filter((p) => p.ergebnis !== null && p.ergebnis !== undefined).length;
    const check = x.aufgaben.length ? x.aufgaben.filter((a) => a.bewertet).length / x.aufgaben.length : 0;
    return s + Math.min(0.95, (fertig / n) * 0.75 + check * 0.2);
  }, 0);
  return Math.max(0, Math.min(1, summe / k.schritte.length));
}

async function speichern(k) {
  k.geaendert = lyra.jetzt();
  k.fortschritt = fortschritt(k);
  try {
    await lyra.speicher.schreiben('kurse/' + k.id, k);
  } catch (_) {}
  const i = z.kurse.findIndex((x) => x.id === k.id);
  if (i >= 0) z.kurse[i] = k;
  else z.kurse.unshift(k);
  startseite();
}

/** Deine Themen auf Lyras Startseite – ein Klick führt direkt zum Kapitel. */
function startseite() {
  const liste = z.kurse
    .slice()
    .sort((a, b) => (a.schritte.every((s) => s.stand === 'gemeistert') - b.schritte.every((s) => s.stand === 'gemeistert')) || b.geaendert - a.geaendert)
    .slice(0, 3)
    .map((k) => {
      const fertig = k.schritte.every((s) => s.stand === 'gemeistert');
      return {
        id: k.id,
        titel: k.titel,
        untertitel: fertig
          ? 'gemeistert'
          : `Kapitel ${Math.min(k.aktuell + 1, k.schritte.length)} von ${k.schritte.length}: ${(k.schritte[k.aktuell]?.titel || '').replace(/^(Kapitel|Schritt|Teil)\s*\d+\s*[:.–-]\s*/i, '')}`,
        fortschritt: k.fortschritt || 0,
        route: 'kurs/' + k.id,
        geaendert: k.geaendert,
      };
    });
  lyra.startseite(liste).catch(() => {});
}

function schwierigkeit(k, n, thema, notiz) {
  thema = kuerzen(thema, 90);
  if (!thema) return;
  const d = k.schwierigkeiten.find((x) => x.schritt === n && x.thema.toLowerCase() === thema.toLowerCase());
  if (d) {
    d.anzahl++;
    d.notiz = kuerzen(notiz, 300);
    d.geloest = false;
  } else k.schwierigkeiten.push({ schritt: n, thema, notiz: kuerzen(notiz, 300), anzahl: 1, geloest: false });
}

const offeneSchwierigkeiten = (k, nur) =>
  k.schwierigkeiten
    .filter((d) => !d.geloest && (nur === undefined || d.schritt === nur))
    .slice(-8)
    .map((d) => `- ${d.thema} (Kapitel ${d.schritt + 1})`)
    .join('\n');

const pfad = (k, n) => k.schritte.map((s, i) => `${i === n ? '→' : s.stand === 'gemeistert' ? '✓' : ' '} ${i + 1}. ${s.titel}`).join('\n');

// ================================================================== Ablauf

async function start() {
  try {
    z.info = await lyra.info();
  } catch (_) {
    z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' };
  }
  try {
    z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) };
  } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try {
    z.kurse = (await lyra.speicher.liste('kurse')).map((e) => normalisieren(e.wert)).filter(Boolean);
    z.kurse.sort((a, b) => b.geaendert - a.geaendert);
  } catch (_) {}
  z.geladen = true;
  lyra.bei('zurueck', zurueck);
  lyra.bei('einstellungen', einstellungenZeigen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('kurs/')) await oeffnen(route.slice(5));
  else zeichnen();
  if (route === 'einstellungen') einstellungenZeigen();
  lyra.themen().then((t) => { z.themen = t || []; if (!z.kurs) zeichnen(); }).catch(() => {});
  startseite();
}

function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.kurs) {
    if (z.laeuft) lyra.abbrechen();
    z.kurs = null;
    lyra.titel('');
    zeichnen();
  } else lyra.zurueck();
}

async function anlegen() {
  const thema = (z.eingaben.thema || '').trim();
  const ziel = (z.eingaben.ziel || '').trim();
  if (!thema || z.laeuft) return;
  z.laeuft = 'anlegen';
  z.hinweis = 'Suche das Thema in deinen Unterlagen …';
  zeichnen();
  const { block } = await stellen(`${thema} ${ziel}`, online() ? 10 : 6);
  const r = await ki('anlegen', {
    prompt: `Thema, das ich vollständig lernen möchte: ${thema}\n${ziel ? `Mein Ziel: ${ziel}\n` : ''}\n${unterlagen(block)}\
Erstelle einen Lernpfad, der mir genau dieses Thema vollständig beibringt. Bleib streng beim Thema „${thema}“: Auszüge, \
die zu anderen Themen oder Fächern gehören, ignorierst du – keine Kapitel über andere Gebiete. 4 bis 8 Kapitel, die aufeinander aufbauen – zuerst \
die nötigen Grundlagen und Begriffe, dann Schritt für Schritt bis zu den anspruchsvollen Teilen (Sätze und Beweise, \
Verfahren, Anwendungen, typische Aufgaben). Jedes Kapitel hat einen klaren Titel, ein Ziel („Danach kannst du …“) und \
2 bis 6 Kerninhalte, die zusammen alles Wichtige des Kapitels abdecken.\n\n\
Antwort als JSON: {"kurstitel": "kurzer Titel des Themas", "schritte": [{"bezeichnung": "Titel des Kapitels", "inhalte": ["…"], "ziel": "Danach kannst du …"}]}`,
    schema: SCHEMA_PLAN,
    zaehlen: { schluessel: 'ziel', wort: 'Kapitel' },
  });
  const v = r && r.json;
  const schritte = ((v && v.schritte) || [])
    .map((s) => ({
      titel: text(s.bezeichnung || s.titel).replace(/^(Kapitel|Schritt|Teil)\s*\d+\s*[:.–-]\s*/i, ''),
      ziel: text(s.ziel),
      inhalte: (s.inhalte || []).map(text).filter(Boolean),
      stand: 'offen',
      haeppchen: [],
      pos: 0,
      aufgaben: [],
      runde: 0,
      punkte: 0,
      letzte: 0,
    }))
    .filter((s) => s.titel)
    .slice(0, 10);
  if (!r) return;
  if (schritte.length < 2) {
    z.fehler = 'Der Lernpfad ist nicht gelungen – bitte noch einmal versuchen oder das Thema genauer angeben.';
    z.fehlerBei = 'anlegen';
    return zeichnen();
  }
  const k = {
    id: lyra.neueId(),
    titel: kuerzen(text(v.kurstitel || v.titel) || thema, 80),
    thema,
    ziel,
    erstellt: lyra.jetzt(),
    geaendert: lyra.jetzt(),
    ohneUnterlagen: !block,
    schritte,
    aktuell: 0,
    schwierigkeiten: [],
    fortschritt: 0,
  };
  z.eingaben.thema = '';
  z.eingaben.ziel = '';
  await speichern(k);
  await oeffnen(k.id);
}

/** Kurse aus der früher eingebauten Fassung (ohne Häppchen) ins neue Format bringen – Gemeistertes bleibt. */
function normalisieren(k) {
  if (!k || !Array.isArray(k.schritte)) return null;
  k.schwierigkeiten = k.schwierigkeiten || [];
  if (k.ohneUnterlagen === undefined) k.ohneUnterlagen = !!k.ohne_unterlagen;
  k.schritte = k.schritte.map((s) => {
    if (Array.isArray(s.haeppchen)) return s;
    const gemeistert = s.stand === 'gemeistert';
    return {
      titel: text(s.titel).replace(/^(Kapitel|Schritt|Teil)\s*\d+\s*[:.–-]\s*/i, ''),
      ziel: s.ziel || '',
      inhalte: s.inhalte || [],
      stand: gemeistert ? 'gemeistert' : 'offen',
      haeppchen: [],
      pos: 0,
      aufgaben: [],
      runde: s.runde || 0,
      punkte: s.punkte || 0,
      letzte: s.letzte || 0,
    };
  });
  k.aktuell = Math.max(0, Math.min(k.aktuell || 0, k.schritte.length - 1));
  k.fortschritt = fortschritt(k);
  return k;
}

async function oeffnen(id) {
  let k = z.kurse.find((x) => x.id === id);
  if (!k) {
    try {
      k = normalisieren(await lyra.speicher.lesen('kurse/' + id));
    } catch (_) {}
  }
  if (!k) return zeichnen();
  z.kurs = k;
  z.kapitel = Math.min(k.aktuell, k.schritte.length - 1);
  z.hp = k.schritte[z.kapitel].pos;
  z.fehler = null;
  z.nachOben = true;
  lyra.titel(k.titel);
  zeichnen();
  weiter();
}

/** Bringt das aktuelle Kapitel voran: Häppchen planen, erklären, Frage stellen, nächstes vorbereiten. */
async function weiter() {
  const k = z.kurs;
  if (!k || z.laeuft) return;
  const n = z.kapitel;
  const s = k.schritte[n];
  if (s.stand === 'gemeistert' && s.haeppchen.length) return zeichnen();
  if (!s.haeppchen.length) {
    if (!(await planen(n))) return;
  }
  if (s.stand === 'offen') {
    s.stand = 'lernen';
    await speichern(k);
  }
  if (s.stand === 'check' || s.stand === 'wiederholen') {
    if (s.stand === 'check' && !s.aufgaben.length) await checkStellen(n);
    return zeichnen();
  }
  const hp = s.haeppchen[z.hp];
  if (!hp) return zeichnen();
  const schluessel = n + ':' + z.hp;
  if (!hp.erklaerung && inVorbereitung.has(schluessel)) {
    // Wird schon im Hintergrund erklärt – darauf warten statt doppelt
    z.laeuft = 'erklaeren';
    z.strom = '';
    z.hinweis = '';
    zeichnen();
    await inVorbereitung.get(schluessel);
    z.laeuft = null;
  }
  if (!hp.erklaerung) {
    if (!(await erklaeren(n, z.hp, hp.anders))) return;
  }
  if (!hp.quiz) await quizStellen(n, z.hp);
  zeichnen();
  vorbereiten(n, z.hp + 1);
}

async function planen(n) {
  const k = z.kurs;
  const s = k.schritte[n];
  const [min, max, art] = TEMPO[z.einst.tempo] || TEMPO.normal;
  const { block } = await stellen(`${k.thema} ${s.titel} ${s.inhalte.join(', ')}`, online() ? 8 : 5);
  const r = await ki('planen', {
    prompt: `Lernpfad zu „${k.titel}“:\n${pfad(k, n)}\n\nKapitel ${n + 1}: ${s.titel}\nZiel: ${s.ziel}\nInhalte: ${s.inhalte.join('; ')}\n\n${unterlagen(block)}\
Teile dieses Kapitel in ${min} bis ${max} Lernhäppchen auf (${art}), die ich nacheinander lerne. Jedes Häppchen behandelt \
genau eine Idee – einen Begriff, eine Aussage, einen Rechenschritt oder ein Beispiel – und baut auf den vorigen auf, vom \
Einfachen zum Schweren. Zusammen müssen sie ALLE Inhalte des Kapitels vollständig und gründlich abdecken – lass nichts weg.\n\n\
Antwort als JSON: {"haeppchen": [{"bezeichnung": "kurzer Titel", "kern": "was genau in diesem Häppchen erklärt wird (ein Satz)"}]}`,
    schema: SCHEMA_HAEPPCHEN,
    zaehlen: { schluessel: 'kern', wort: 'Häppchen' },
  });
  const liste = ((r && r.json && r.json.haeppchen) || [])
    .map((p) => ({ bezeichnung: text(p.bezeichnung).replace(/^(Häppchen|Schritt)\s*\d+\s*[:.–-]\s*/i, ''), kern: text(p.kern), erklaerung: '', quiz: null, ergebnis: null, erster: null, rueckfragen: [], quellen: [] }))
    .filter((p) => p.bezeichnung)
    .slice(0, 10);
  if (!r) return false;
  if (!liste.length) {
    z.fehler = 'Die Häppchen sind nicht gelungen – bitte noch einmal versuchen.';
    z.fehlerBei = 'planen';
    zeichnen();
    return false;
  }
  s.haeppchen = liste;
  s.pos = 0;
  z.hp = 0;
  await speichern(k);
  return true;
}

function erklaerAuftrag(k, n, i, block, anders) {
  const s = k.schritte[n];
  const p = s.haeppchen[i];
  const vorher = s.haeppchen.slice(0, i).map((x) => x.bezeichnung).join('; ');
  const danach = s.haeppchen.slice(i + 1).map((x) => x.bezeichnung).join('; ');
  const schwer = offeneSchwierigkeiten(k, n);
  return `Thema „${k.titel}“ – Kapitel ${n + 1} „${s.titel}“ – Häppchen ${i + 1} von ${s.haeppchen.length}: ${p.bezeichnung}\n\
Worum es geht: ${p.kern}\n${vorher ? `Schon gelernt: ${vorher}\n` : ''}${danach ? `Kommt danach (noch nicht erklären): ${danach}\n` : ''}\
${schwer ? `Damit hatte ich Schwierigkeiten:\n${schwer}\n` : ''}${anders ? 'Beim ersten Mal hat es nicht geklappt – erkläre es diesmal anders: andere Herangehensweise, anderes Beispiel.\n' : ''}\n\
${unterlagen(block)}Erkläre mir NUR dieses eine Häppchen ${LAENGE[z.einst.input] || LAENGE.kurz}. Klar und anschaulich, \
Formeln in LaTeX. Keine Überschrift, keine Einleitung, kein Ausblick, keine Übungsaufgabe – eine Frage dazu kommt gleich separat.`;
}

async function erklaeren(n, i, anders = false) {
  const k = z.kurs;
  const p = k.schritte[n].haeppchen[i];
  const { block, quellen } = await stellen(`${k.thema} ${k.schritte[n].titel} ${p.bezeichnung} ${p.kern}`, online() ? 6 : 4);
  const r = await ki('erklaeren', { prompt: erklaerAuftrag(k, n, i, block, anders) });
  if (!r || !r.text.trim()) return false;
  p.erklaerung = r.text.trim();
  p.quellen = quellen;
  p.anders = false;
  await speichern(k);
  return true;
}

/** Das nächste Häppchen schon vorbereiten, während du liest und antwortest (still im Hintergrund). */
async function vorbereiten(n, i) {
  const k = z.kurs;
  const p = k && k.schritte[n] && k.schritte[n].haeppchen[i];
  const schluessel = n + ':' + i;
  if (!p || p.erklaerung || inVorbereitung.has(schluessel)) return;
  let fertig;
  inVorbereitung.set(schluessel, new Promise((f) => (fertig = f)));
  try {
    const { block, quellen } = await stellen(`${k.thema} ${k.schritte[n].titel} ${p.bezeichnung} ${p.kern}`, online() ? 6 : 4);
    const r = await ki('vorbereiten', { prompt: erklaerAuftrag(k, n, i, block, p.anders) }, false);
    if (r && r.text.trim() && !p.erklaerung) {
      p.erklaerung = r.text.trim();
      p.quellen = quellen;
      p.anders = false;
      await speichern(k);
    }
  } finally {
    inVorbereitung.delete(schluessel);
    fertig();
  }
}

async function quizStellen(n, i, neu = false) {
  const k = z.kurs;
  const p = k.schritte[n].haeppchen[i];
  const r = await ki('quiz', {
    prompt: `Häppchen „${p.bezeichnung}“ – ${p.kern}\n\nDeine Erklärung, die ich gerade gelesen habe:\n${p.erklaerung}\n\n\
${neu && p.quiz ? `Stelle eine ANDERE Frage als diese: ${p.quiz.frage}\n\n` : ''}\
Stelle mir genau eine Multiple-Choice-Frage, die prüft, ob ich genau dieses Häppchen verstanden habe – nicht nur \
auswendig gelernt. 3 oder 4 Antwortmöglichkeiten in "optionen"; die falschen sind typische Fehlvorstellungen; eine oder \
mehrere sind richtig (ihre Nummern ab 0 in "richtig"). "warum" erklärt in 1 bis 2 Sätzen, warum die richtige Antwort stimmt.\n\n\
Antwort als JSON: {"art": "auswahl", "frage": "…", "optionen": ["…"], "richtig": [0], "warum": "…"}`,
    schema: SCHEMA_QUIZ,
  });
  const v = r && r.json;
  if (!v) return false;
  const optionen = (v.optionen || []).map((o) => ohneNummer(text(o))).filter(Boolean);
  const richtig = [...new Set((v.richtig || []).filter((x) => Number.isInteger(x) && x >= 0 && x < optionen.length))].sort();
  if (optionen.length < 2 || !richtig.length || !text(v.frage)) {
    z.fehler = 'Die Frage ist nicht gelungen – bitte noch einmal versuchen.';
    z.fehlerBei = 'quiz';
    return false;
  }
  p.quiz = { frage: text(v.frage), optionen, richtig, warum: text(v.warum) };
  p.gewaehlt = [];
  p.ergebnis = null;
  delete z.auswahl[i];
  await speichern(k);
  return true;
}

async function pruefen(i) {
  const k = z.kurs;
  const n = z.kapitel;
  const p = k.schritte[n].haeppchen[i];
  const g = [...(z.auswahl[i] || [])].sort();
  if (!g.length || !p.quiz) return;
  const ok = g.length === p.quiz.richtig.length && g.every((x, j) => x === p.quiz.richtig[j]);
  p.gewaehlt = g;
  p.ergebnis = ok;
  if (p.erster === null || p.erster === undefined) p.erster = ok;
  if (!ok) schwierigkeit(k, n, p.bezeichnung, `Frage falsch beantwortet: ${p.quiz.frage}`);
  await speichern(k);
  zeichnen();
}

/** Nächstes offenes Häppchen – oder der Check, wenn alle durch sind. */
async function naechstes() {
  const k = z.kurs;
  const n = z.kapitel;
  const s = k.schritte[n];
  const j = s.haeppchen.findIndex((p, x) => x > z.hp && (p.ergebnis === null || p.ergebnis === undefined));
  const k2 = j >= 0 ? j : s.haeppchen.findIndex((p) => p.ergebnis === null || p.ergebnis === undefined);
  if (k2 >= 0) {
    s.pos = k2;
    z.hp = k2;
  } else {
    s.stand = 'check';
    s.aufgaben = [];
    z.hp = s.haeppchen.length;
  }
  z.nachOben = true;
  await speichern(k);
  zeichnen();
  weiter();
}

async function nochEineFrage(i) {
  if (z.laeuft) return;
  await quizStellen(z.kapitel, i, true);
  zeichnen();
}

async function andersErklaeren(i) {
  if (z.laeuft) return;
  const p = z.kurs.schritte[z.kapitel].haeppchen[i];
  if (await erklaeren(z.kapitel, i, true)) {
    p.quiz = null;
    await quizStellen(z.kapitel, i);
  }
  zeichnen();
}

async function rueckfrage(i) {
  const k = z.kurs;
  const n = z.kapitel;
  const p = k.schritte[n].haeppchen[i];
  const f = (z.eingaben['frage' + i] || '').trim();
  if (!f || z.laeuft) return;
  z.offeneFrage = f;
  z.eingaben['frage' + i] = '';
  const { block } = await stellen(`${k.thema} ${p.bezeichnung} ${f}`, 4);
  const frueher = p.rueckfragen.slice(-3).map(([a, b]) => `Meine frühere Frage: ${a}\nDeine Antwort: ${kuerzen(b, 1200)}`).join('\n\n');
  const r = await ki('rueckfrage', {
    prompt: `Wir sind bei „${k.titel}“, Kapitel ${n + 1} „${k.schritte[n].titel}“, Häppchen „${p.bezeichnung}“.\n\nDeine Erklärung dazu:\n${p.erklaerung}\n\n\
${p.quiz && p.ergebnis === null ? `Gerade beantworte ich diese Frage (verrate die Lösung nicht, hilf mir nur, sie selbst zu finden): ${p.quiz.frage}\n\n` : ''}\
${frueher ? frueher + '\n\n' : ''}${block ? unterlagen(block) : ''}Meine Frage: ${f}\n\nAntworte genau auf diese Frage – kurz, verständlich, mit Beispiel, wenn es hilft.`,
  });
  if (r && r.text.trim()) {
    p.rueckfragen.push([f, r.text.trim()]);
    await speichern(k);
  }
  zeichnen();
}

// ---------------------------------------------------------------- Check am Kapitelende

async function checkStellen(n) {
  const k = z.kurs;
  const s = k.schritte[n];
  const anzahl = Math.max(2, Math.min(5, z.einst.check || 3));
  const { block } = await stellen(`${k.thema} ${s.titel} ${s.inhalte.join(', ')}`, online() ? 8 : 5);
  const schwer = offeneSchwierigkeiten(k, n);
  const r = await ki('check', {
    prompt: `Lernpfad zu „${k.titel}“:\n${pfad(k, n)}\n\nKapitel ${n + 1}: ${s.titel}\nZiel: ${s.ziel}\nInhalte: ${s.inhalte.join('; ')}\n\
Gelernte Häppchen: ${s.haeppchen.map((p) => p.bezeichnung).join('; ')}\n\n\
${s.runde > 0 ? `Das ist meine ${s.runde + 1}. Runde – stelle neue Aufgaben${schwer ? `, besonders zu:\n${schwer}` : ''}.\n\n` : ''}\
${unterlagen(block)}Stelle mir zum Abschluss des Kapitels genau ${anzahl} Aufgaben, die prüfen, ob ich es wirklich \
verstanden habe – von leicht nach schwer und gemischt:\n\
- "auswahl": Multiple Choice mit 4 Antwortmöglichkeiten, eine oder mehrere richtig (Nummern ab 0 in "richtig")\n\
- "erklaeren": etwas in eigenen Worten erklären oder begründen\n\
- "loesen": etwas berechnen, anwenden oder ein Verfahren durchführen\n\
- "beweisen": eine Aussage zeigen oder beweisen (nur, wenn das Thema das hergibt)\n\
Mindestens eine offene Aufgabe. Bei offenen Aufgaben bleiben "optionen" und "richtig" leer. "tipp" ist ein Denkanstoß, \
der die Lösung nicht verrät. "vollstaendige_loesung" ist die Musterlösung mit Weg – ich sehe sie erst, wenn ich sie \
ausdrücklich aufrufe, schreib sie aber vollständig aus.\n\n\
Antwort als JSON: {"aufgaben": [{"art": "auswahl", "frage": "…", "optionen": ["…"], "richtig": [0], "tipp": "…", "vollstaendige_loesung": "…"}]}`,
    schema: SCHEMA_AUFGABEN,
    zaehlen: { schluessel: 'frage', wort: 'Aufgabe' },
  });
  const liste = ((r && r.json && r.json.aufgaben) || [])
    .map((a) => {
      let art = ['auswahl', 'erklaeren', 'loesen', 'beweisen'].includes(a.art) ? a.art : 'erklaeren';
      const optionen = (a.optionen || []).map((o) => ohneNummer(text(o))).filter(Boolean);
      const richtig = [...new Set((a.richtig || []).filter((x) => Number.isInteger(x) && x >= 0 && x < optionen.length))].sort();
      if (art === 'auswahl' && (optionen.length < 2 || !richtig.length)) art = 'erklaeren';
      return {
        art,
        frage: text(a.frage),
        optionen: art === 'auswahl' ? optionen : [],
        richtig: art === 'auswahl' ? richtig : [],
        tipp: text(a.tipp),
        loesung: text(a.vollstaendige_loesung || a.loesung),
        antwort: '',
        gewaehlt: [],
        bewertet: false,
        punkte: 0,
        rueckmeldung: '',
        luecke: '',
        tippGesehen: false,
        aufgeloest: false,
      };
    })
    .filter((a) => a.frage)
    .slice(0, anzahl + 1);
  if (!r) return false;
  if (!liste.length) {
    z.fehler = 'Es kamen keine brauchbaren Aufgaben – bitte noch einmal versuchen.';
    z.fehlerBei = 'check';
    return false;
  }
  s.aufgaben = liste;
  s.stand = 'check';
  await speichern(k);
  return true;
}

function rundePruefen(k, n) {
  const s = k.schritte[n];
  if (!s.aufgaben.length || s.aufgaben.some((a) => !a.bewertet)) return;
  const quiz = s.haeppchen.filter((p) => p.erster !== null && p.erster !== undefined);
  const quizAnteil = quiz.length ? quiz.filter((p) => p.erster).length / quiz.length : 1;
  const check = s.aufgaben.reduce((x, a) => x + a.punkte, 0) / s.aufgaben.length;
  const p = 0.35 * quizAnteil + 0.65 * check;
  s.runde++;
  s.letzte = p;
  s.punkte = Math.max(s.punkte, p);
  if (p * 100 >= (z.einst.schwelle || 75)) {
    s.stand = 'gemeistert';
    k.schwierigkeiten.filter((d) => d.schritt === n).forEach((d) => (d.geloest = true));
    const i = k.schritte.findIndex((x, j) => j > n && x.stand !== 'gemeistert');
    const j = i >= 0 ? i : k.schritte.findIndex((x) => x.stand !== 'gemeistert');
    k.aktuell = j >= 0 ? j : n;
  } else {
    s.stand = 'wiederholen';
  }
}

async function auswahlPruefen(i) {
  const k = z.kurs;
  const n = z.kapitel;
  const a = k.schritte[n].aufgaben[i];
  const g = [...(z.auswahl['a' + i] || [])].sort();
  if (!g.length || a.bewertet) return;
  const treffer = g.filter((x) => a.richtig.includes(x)).length;
  const falsch = g.length - treffer;
  const genau = g.length === a.richtig.length && g.every((x, j) => x === a.richtig[j]);
  a.punkte = genau ? 1 : Math.max(0, Math.min(0.9, (treffer - falsch) / a.richtig.length));
  a.gewaehlt = g;
  a.bewertet = true;
  a.rueckmeldung = genau ? 'Richtig!' : a.punkte > 0 ? 'Teilweise richtig.' : 'Leider nicht richtig.';
  if (a.punkte < 0.7) schwierigkeit(k, n, a.frage, 'Multiple Choice im Check falsch');
  rundePruefen(k, n);
  await speichern(k);
  zeichnen();
}

async function abgeben(i) {
  const k = z.kurs;
  const n = z.kapitel;
  const s = k.schritte[n];
  const a = s.aufgaben[i];
  const antwort = (z.eingaben['antwort' + i] || '').trim();
  if (!antwort || z.laeuft) return;
  const art = a.art === 'loesen' ? 'lösen' : a.art === 'beweisen' ? 'beweisen' : 'erklären';
  const r = await ki('abgeben:' + i, {
    prompt: `Thema: ${k.titel} – Kapitel ${n + 1}: ${s.titel}\n\nAufgabe (${art}): ${a.frage}\n\nMusterlösung (nur für dich, nicht verraten): \
${a.loesung || '(keine – prüfe selbst sorgfältig)'}\n\nMeine Antwort:\n${antwort}\n\n\
Bewerte meine Antwort fair, aber genau wie ein guter Tutor – nur, was wirklich dasteht. Maßstab für die Punkte (0 bis \
100): 100 vollständig und korrekt; 70 bis 90 im Kern richtig mit kleinen Lücken; 40 bis 60 richtiger Ansatz, aber \
Wesentliches fehlt; 10 bis 30 nur ansatzweise; 0 falsch oder leer. Fehlt etwas, das die Aufgabe ausdrücklich verlangt, \
höchstens 50. Andere korrekte Wege zählen voll. In "begruendung" sprichst du mich direkt an: zuerst, was gut ist, dann \
konkret, was fehlt oder falsch ist und warum – verrate die Musterlösung nicht, außer meine Antwort ist schon fast \
richtig. In "luecke" nennst du in wenigen Wörtern das Konzept, das mir noch fehlt (leer, wenn nichts fehlt).\n\n\
Antwort als JSON: {"begruendung": "…", "luecke": "…", "punkte": 0}`,
    schema: SCHEMA_BEWERTUNG,
  });
  const v = r && r.json;
  if (!v) return;
  a.antwort = antwort;
  a.punkte = Math.max(0, Math.min(1, (Number(v.punkte) || 0) / 100));
  a.rueckmeldung = text(v.begruendung || v.rueckmeldung);
  a.luecke = text(v.luecke);
  a.bewertet = true;
  if (a.punkte < 0.7) schwierigkeit(k, n, a.luecke || a.frage, a.rueckmeldung);
  rundePruefen(k, n);
  await speichern(k);
  zeichnen();
}

async function tippZeigen(i) {
  const a = z.kurs.schritte[z.kapitel].aufgaben[i];
  a.tippGesehen = true;
  await speichern(z.kurs);
  zeichnen();
}

/** Lösung nur auf Wunsch; ohne eigenen Versuch zählt die Aufgabe als nicht gelöst. */
async function loesungZeigen(i) {
  const k = z.kurs;
  const n = z.kapitel;
  const a = k.schritte[n].aufgaben[i];
  if (z.laeuft) return;
  if (!a.bewertet) {
    const ok = (await lyra.bestaetigen({ titel: 'Lösung zeigen?', text: 'Versuch es ruhig erst selbst – ein Tipp hilft oft schon weiter. Wenn du die Lösung jetzt ansiehst, zählt die Aufgabe in dieser Runde als nicht gelöst.', ja: 'Lösung zeigen', nein: 'Lieber selbst versuchen', gefahr: false }));
    if (!ok) return;
    a.bewertet = true;
    a.punkte = 0;
    a.rueckmeldung = 'Lösung angesehen – zählt in dieser Runde als nicht gelöst.';
    schwierigkeit(k, n, a.frage, 'Lösung angesehen');
    rundePruefen(k, n);
  }
  a.aufgeloest = true;
  if (!a.loesung) {
    const r = await ki('loesung:' + i, {
      prompt: `Thema: ${k.titel} – Kapitel ${n + 1}: ${k.schritte[n].titel}\n\nAufgabe: ${a.frage}\n\n${a.antwort ? `Meine Antwort war:\n${a.antwort}\n\n` : ''}\
Ich möchte jetzt die Lösung sehen: Schreib eine vollständige Musterlösung mit Weg und Begründung – verständlich, Schritt \
für Schritt. Schließe mit „**Ergebnis:**“.`,
    });
    if (r) a.loesung = r.text.trim();
  }
  await speichern(k);
  zeichnen();
}

/** Nach einer schwachen Runde: die Häppchen, bei denen es gehakt hat, anders erklären – dann ein neuer Check. */
async function wiederholen() {
  const k = z.kurs;
  const n = z.kapitel;
  const s = k.schritte[n];
  const schwach = s.haeppchen.map((p, i) => (p.erster === false ? i : -1)).filter((i) => i >= 0);
  // Was im Check gehakt hat, ordnen wir den Häppchen grob über Wörter zu; sonst alle Häppchen noch einmal anders.
  const ziel = schwach.length ? schwach : s.haeppchen.map((_, i) => i);
  ziel.forEach((i) => {
    const p = s.haeppchen[i];
    p.erklaerung = '';
    p.quiz = null;
    p.ergebnis = null;
    p.erster = null;
    p.anders = true;
  });
  s.aufgaben = [];
  s.stand = 'lernen';
  s.pos = ziel[0];
  z.hp = ziel[0];
  z.nachOben = true;
  await speichern(k);
  zeichnen();
  weiter();
}

async function neuerCheck() {
  const s = z.kurs.schritte[z.kapitel];
  s.aufgaben = [];
  s.stand = 'check';
  await speichern(z.kurs);
  zeichnen();
  weiter();
}

function kapitelWaehlen(n) {
  if (z.laeuft || !z.kurs) return;
  const s = z.kurs.schritte[n];
  z.kapitel = n;
  z.hp = s.stand === 'check' || s.stand === 'wiederholen' ? s.haeppchen.length : s.pos;
  z.kurs.aktuell = n;
  z.fehler = null;
  z.nachOben = true;
  speichern(z.kurs);
  zeichnen();
  weiter();
}

async function loeschen(k) {
  if (!(await lyra.bestaetigen({ titel: `„${k.titel}“ löschen?`, text: `Lernpfad, Erklärungen, Fragen und Fortschritt werden endgültig gelöscht.`, ja: 'Löschen', nein: 'Abbrechen', gefahr: true }))) return;
  try {
    await lyra.speicher.loeschen('kurse/' + k.id);
  } catch (_) {}
  z.kurse = z.kurse.filter((x) => x.id !== k.id);
  startseite();
  zeichnen();
}

async function mitFlip(k) {
  const schwer = k.schwierigkeiten.map((d) => d.thema).slice(0, 8).join('; ');
  const wunsch = `Wiederholen, was ich im Deep Dive zu „${k.titel}“ gelernt habe – die wichtigsten Begriffe, Sätze und Verfahren${schwer ? `, besonders: ${schwer}` : ''}`;
  const ok = await lyra.plugin('flip', `neu?thema=${encodeURIComponent(k.titel)}&wunsch=${encodeURIComponent(wunsch)}`);
  if (!ok) await dialog('Flip ist nicht installiert', h('p', {}, 'Installiere Flip unter „Plugins“ (oben rechts), dann kannst du das Gelernte mit Karteikarten festigen.'));
}

// ---------------------------------------------------------------- Einstellungen

async function einstellungenZeigen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const wahl = (schluessel, optionen) => {
    const box = h('div', { class: 'wahl' });
    const malen = () =>
      box.replaceChildren(...optionen.map(([wert, name]) =>
        h('button', { class: 'chip' + (e[schluessel] === wert ? ' an' : ''), onclick: () => { e[schluessel] = wert; malen(); } }, name)));
    malen();
    return box;
  };
  const zeile = (titel, erklaerung, inhalt) =>
    h('div', { class: 'einst-zeile' }, h('div', { class: 'fett' }, titel), h('div', { class: 'leise klein' }, erklaerung), inhalt);
  const inhalt = h('div', {},
    zeile('Tempo', 'Wie groß die Häppchen sind. Egal wie schnell: Alle Inhalte jedes Kapitels werden vollständig durchgegangen.',
      wahl('tempo', [['gruendlich', 'Gründlich'], ['normal', 'Normal'], ['zuegig', 'Zügig']])),
    zeile('Erklärungen', 'Wie viel Text vor jeder Frage kommt.',
      wahl('input', [['kurz', 'Kurz'], ['mittel', 'Mittel'], ['ausfuehrlich', 'Ausführlich']])),
    zeile('Check am Kapitelende', 'So viele Aufgaben prüfen am Ende jedes Kapitels, ob es sitzt.',
      wahl('check', [[2, '2 Aufgaben'], [3, '3 Aufgaben'], [4, '4 Aufgaben']])),
    zeile('Weiter ab', 'Ab diesem Ergebnis gilt ein Kapitel als gemeistert.',
      wahl('schwelle', [[60, '60 %'], [70, '70 %'], [75, '75 %'], [80, '80 %'], [90, '90 %']])),
    zeile('Wer unterrichtet', 'Automatisch: Claude bzw. ChatGPT, wenn verbunden (besser, braucht Internet) – sonst Lyra lokal.',
      wahl('ki', [['auto', 'Automatisch'], ['lyra', 'Immer Lyra (lokal)']])),
    h('div', { class: 'leise klein' }, '🔒 Lösungen gibt es nur, wenn du sie aufrufst. Deine Kurse liegen nur auf deinem Mac.'));
  const ok = await dialog('Deep Dive – Einstellungen', inhalt, [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  if (e.ki === 'lyra') z.lehrer = 'lyra';
  else if (z.lehrer === 'lyra' && z.info.standardLehrer) z.lehrer = z.info.standardLehrer;
  try {
    await lyra.speicher.schreiben('einstellungen', e);
  } catch (_) {}
  zeichnen();
}

// ================================================================== Ansicht

function standardHinweis() {
  return {
    anlegen: 'Lernpfad wird geplant …',
    planen: 'Kapitel wird in Häppchen aufgeteilt …',
    erklaeren: `${lehrerName()} erklärt …`,
    quiz: 'Frage wird vorbereitet …',
    rueckfrage: `${lehrerName()} antwortet …`,
    check: 'Check wird vorbereitet …',
  }[z.laeuft] || (String(z.laeuft).startsWith('abgeben') ? `${lehrerName()} sieht sich deine Antwort an …` : `${lehrerName()} schreibt …`);
}

function laufZeile() {
  return h('div', { class: 'lauf' }, h('div', { class: 'lade' }), h('span', { class: 'wachsen', id: 'hinweis' }, z.hinweis || standardHinweis()),
    h('button', { class: 'knopf text klein', onclick: () => lyra.abbrechen() }, 'Abbrechen'));
}

function nochmal(art) {
  z.fehler = null;
  const nr = +String(art).split(':')[1];
  if (art === 'anlegen') return anlegen();
  if (art === 'quiz') return quizStellen(z.kapitel, z.hp, true).then(zeichnen);
  if (art === 'check') return neuerCheck();
  if (art === 'rueckfrage') return rueckfrage(z.hp);
  if (String(art).startsWith('abgeben:')) return abgeben(nr);
  if (String(art).startsWith('loesung:')) return loesungZeigen(nr);
  zeichnen();
  return weiter();
}

function fehlerZeile(art) {
  if (z.fehlerBei !== art || !z.fehler) return null;
  return h('div', { style: { marginTop: '12px' } }, fehlerBox(z.fehler,
    online() ? () => { z.lehrer = 'lyra'; z.fehler = null; zeichnen(); nochmal(art); } : null,
    () => { z.fehler = null; zeichnen(); },
    () => nochmal(art)));
}

function feld(name, eigenschaften) {
  const e = h(eigenschaften.zeilen ? 'textarea' : 'input', {
    class: 'eingabe',
    'data-feld': name,
    placeholder: eigenschaften.platzhalter,
    rows: eigenschaften.zeilen,
    disabled: !!z.laeuft && !eigenschaften.immer,
    value: z.eingaben[name] || '',
    oninput: (ev) => { z.eingaben[name] = ev.target.value; if (eigenschaften.beiEingabe) eigenschaften.beiEingabe(); },
    onkeydown: (ev) => {
      if (ev.key === 'Enter' && (!eigenschaften.zeilen || ev.metaKey) && eigenschaften.beiEnter) { ev.preventDefault(); eigenschaften.beiEnter(); }
    },
  });
  return e;
}

function zeichnen() {
  const aktiv = document.activeElement;
  const name = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const auswahl = name ? [aktiv.selectionStart, aktiv.selectionEnd] : null;
  const alt = document.querySelector('.haupt, .uebersicht');
  const pos = alt ? alt.scrollTop : 0;
  app.replaceChildren(z.kurs ? kursAnsicht() : uebersicht());
  if (name) {
    const e = document.querySelector(`[data-feld="${name}"]`);
    if (e && !e.disabled) {
      e.focus();
      try { e.setSelectionRange(auswahl[0], auswahl[1]); } catch (_) {}
    }
  }
  const neu = document.querySelector('.haupt, .uebersicht');
  if (neu) neu.scrollTop = z.nachOben ? 0 : pos;
  z.nachOben = false;
}

async function einstellungSetzen(schl, wert) {
  z.einst[schl] = wert;
  try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {}
  zeichnen();
}

function uebersicht() {
  const fertig = (k) => k.schritte.every((s) => s.stand === 'gemeistert');
  const laufend = z.kurse.filter((k) => !fertig(k));
  const gemeistert = z.kurse.filter(fertig);
  const kursEintrag = (k) => {
    const gem = k.schritte.filter((s) => s.stand === 'gemeistert').length;
    const offen = k.schwierigkeiten.filter((d) => !d.geloest).length;
    const naechstes = k.schritte[Math.min(k.aktuell || 0, k.schritte.length - 1)];
    return lyra.eintrag({
      symbol: fertig(k) ? '🏆' : '🤿',
      farbe: fertig(k) ? 'var(--ok)' : '',
      titel: k.titel,
      unter: fertig(k)
        ? `Alle ${k.schritte.length} Kapitel gemeistert · ${lyra.zeitText(k.geaendert)}`
        : `Kapitel ${gem + 1 > k.schritte.length ? k.schritte.length : (k.aktuell || 0) + 1} von ${k.schritte.length}: ${naechstes ? naechstes.titel : ''}${offen ? ` · ${offen} offen${offen === 1 ? 'e Schwierigkeit' : 'e Schwierigkeiten'}` : ''}`,
      fortschritt: k.fortschritt || 0,
      rechts: h('div', { class: 'prozent-klein' }, `${Math.round((k.fortschritt || 0) * 100)} %`),
      beiKlick: () => oeffnen(k.id),
      aktionen: [
        { symbol: '🃏', titel: 'Mit Flip festigen', bei: () => mitFlip(k) },
        { symbol: '🗑', titel: 'Löschen', bei: () => loeschen(k) },
      ],
    });
  };
  const zielZeile = z.zielOffen || z.eingaben.ziel
    ? h('div', { class: 'ziel-zeile' }, h('span', { class: 'leise klein' }, 'Ziel'),
      feld('ziel', { platzhalter: 'z. B. „Klausur in drei Wochen“ oder „Beweise selbst führen können“', beiEnter: anlegen, immer: true }))
    : null;
  const seite = h('div', { class: 'seite' },
    lyra.kopf({ titel: 'Was willst du lernen?', unter: `Nenne ein Thema – ${lehrerName()} baut daraus einen Lernpfad und bringt ihn dir in kleinen Häppchen bei: kurz erklären, gleich eine Frage, dann weiter.` }),
    lyra.verfasser({
      wert: z.eingaben.thema || '',
      feld: 'thema',
      zeilen: 1,
      platzhalter: 'Thema, z. B. Eigenwerte, Vollständige Induktion, Rekursion …',
      beiEingabe: (v) => { z.eingaben.thema = v; },
      beiSenden: (v) => { z.eingaben.thema = v; anlegen(); },
      knopf: 'Lernpfad erstellen',
      deaktiviert: !!z.laeuft,
      unten: [
        z.info ? lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        lyra.auswahl({ titel: 'Tempo', wert: z.einst.tempo, beiWahl: (w) => einstellungSetzen('tempo', w), optionen: [
          ['gruendlich', 'Gründlich', 'Sehr kleine Häppchen – lieber eines mehr'], ['normal', 'Normal', 'Kleine Häppchen'], ['zuegig', 'Zügig', 'Größere Häppchen, weniger Fragen']] }),
        lyra.auswahl({ titel: 'Erklärungen', wert: z.einst.input, beiWahl: (w) => einstellungSetzen('input', w), optionen: [
          ['kurz', 'Kurz', 'Ein paar Sätze mit Mini-Beispiel'], ['mittel', 'Mittel', 'Etwa ein Absatz mit Beispiel'], ['ausfuehrlich', 'Ausführlich', 'Mit Beispiel und Begründung']] }),
        !zielZeile ? h('button', { class: 'ly-pille', onclick: () => { z.zielOffen = true; zeichnen(); setTimeout(() => { const f = document.querySelector('[data-feld="ziel"]'); if (f) f.focus(); }); } }, '＋ Ziel') : null,
      ],
    }),
    zielZeile,
    z.themen.length && !z.laeuft ? lyra.vorschlaege(z.themen, (t) => { z.eingaben.thema = t; zeichnen(); const f = document.querySelector('[data-feld="thema"]'); if (f) f.focus(); }, { titel: 'Aus deinen Unterlagen:' }) : null,
    z.laeuft === 'anlegen' ? h('div', { style: { marginTop: '14px' } }, lyra.arbeit(z.hinweis || standardHinweis(), { id: 'hinweis' })) : null,
    fehlerZeile('anlegen'),
    laufend.length ? lyra.abschnitt('Weiterlernen', h('div', { class: 'ly-liste' }, laufend.map(kursEintrag))) : null,
    gemeistert.length ? lyra.abschnitt('Gemeistert', h('div', { class: 'ly-liste' }, gemeistert.map(kursEintrag))) : null,
    !z.kurse.length && !z.laeuft ? h('div', { class: 'leise klein hinweis-unten' }, online()
      ? `${lehrerName()} unterrichtet über dein Abo (braucht Internet). Lösungen gibt es nur, wenn du sie aufrufst.`
      : '🔒 Lyra unterrichtet lokal – nichts verlässt deinen Mac. Lösungen gibt es nur, wenn du sie aufrufst.') : null);
  return h('div', { class: 'uebersicht', style: { height: '100vh', overflow: 'auto' } }, seite);
}

function kursAnsicht() {
  const k = z.kurs;
  const n = z.kapitel;
  const s = k.schritte[n];
  return h('div', { class: 'kurs' }, seitenleiste(k), h('div', { class: 'haupt' }, h('div', { class: 'seite' },
    k.schritte.every((x) => x.stand === 'gemeistert') ? fertigBanner(k) : null,
    h('div', { class: 'zeile', style: { marginBottom: '4px' } },
      h('div', { class: 'kopf-kapitel wachsen' }, `Kapitel ${n + 1} von ${k.schritte.length}`),
      z.info ? lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; z.fehler = null; zeichnen(); }) : null),
    h('h1', {}, s.titel),
    s.ziel ? h('p', { class: 'leise', style: { marginTop: '6px' } }, s.ziel) : null,
    haeppchenLeiste(s),
    inhaltDesKapitels(k, n, s))));
}

function seitenleiste(k) {
  const gem = k.schritte.filter((s) => s.stand === 'gemeistert').length;
  const offen = k.schwierigkeiten.filter((d) => !d.geloest);
  return h('div', { class: 'leiste' },
    h('div', { class: 'zeile' }, h('span', { class: 'prozent' }, `${Math.round((k.fortschritt || 0) * 100)} %`),
      h('span', { class: 'leise klein' }, `${gem} von ${k.schritte.length} Kapiteln gemeistert`)),
    h('div', { style: { margin: '8px 0 20px' } }, balken(k.fortschritt)),
    h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, 'Lernpfad'),
    k.schritte.map((s, i) => h('div', { class: `kapitel ${s.stand} ${i === z.kapitel ? 'aktiv' : ''}`, onclick: () => kapitelWaehlen(i) },
      h('div', { class: 'nr' }, s.stand === 'gemeistert' ? '✓' : String(i + 1)),
      h('div', { class: 'wachsen' }, h('div', { class: 'titel' }, s.titel),
        s.haeppchen.length ? h('div', { class: 'punkt-reihe' }, s.haeppchen.map((p, j) =>
          h('div', { class: 'punkt ' + (p.ergebnis === true ? 'ok' : p.ergebnis === false ? 'falsch' : i === z.kapitel && j === z.hp ? 'jetzt' : '') }))) : null))),
    h('div', { class: 'ueberschrift-klein', style: { margin: '22px 0 8px' } }, offen.length ? `Schwierigkeiten · ${offen.length}` : 'Schwierigkeiten'),
    offen.length
      ? offen.slice(-10).map((d) => h('div', { class: 'schwer', title: d.notiz }, h('div', {}, d.thema,
        h('div', { class: 'leise', style: { fontSize: '11px' } }, `Kapitel ${d.schritt + 1}${d.anzahl > 1 ? ` · ${d.anzahl}×` : ''}`))))
      : h('div', { class: 'leise klein' }, k.schwierigkeiten.length ? 'Alles geklärt.' : 'Noch keine – Lyra merkt sich, wo es hakt.'),
    k.ohneUnterlagen ? h('p', { class: 'leise', style: { fontSize: '11.5px', marginTop: '16px' } }, 'In deinen Unterlagen stand dazu wenig – der Lernpfad stützt sich auf allgemeines Wissen.') : null);
}

function haeppchenLeiste(s) {
  if (!s.haeppchen.length) return h('div', { style: { height: '14px' } });
  const offen = s.haeppchen.findIndex((p) => p.ergebnis === null || p.ergebnis === undefined);
  return h('div', { class: 'haeppchen-leiste' },
    s.haeppchen.map((p, i) => h('button', {
      class: 'hp ' + (i === z.hp ? 'jetzt' : p.ergebnis === true ? 'ok' : p.ergebnis === false ? 'falsch' : ''),
      title: p.bezeichnung,
      disabled: !!z.laeuft || (!p.erklaerung && i !== s.pos),
      onclick: () => { z.hp = i; z.nachOben = true; zeichnen(); },
    }, String(i + 1))),
    h('button', {
      class: 'hp ' + (z.hp >= s.haeppchen.length ? 'jetzt' : ''),
      disabled: !!z.laeuft || (offen >= 0 && s.stand !== 'check' && s.stand !== 'wiederholen' && s.stand !== 'gemeistert'),
      onclick: () => { z.hp = s.haeppchen.length; z.nachOben = true; zeichnen(); },
    }, 'Check'));
}

function inhaltDesKapitels(k, n, s) {
  if (z.laeuft === 'planen') return h('div', { class: 'haeppchen' }, laufZeile());
  if (!s.haeppchen.length) {
    return h('div', { class: 'haeppchen' }, fehlerZeile('planen') ||
      h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: weiter }, 'Los geht’s'));
  }
  if (z.hp >= s.haeppchen.length) return checkAnsicht(k, n, s);
  return haeppchenAnsicht(k, n, s, z.hp);
}

function haeppchenAnsicht(k, n, s, i) {
  const p = s.haeppchen[i];
  const erklaertGerade = z.laeuft === 'erklaeren' && i === z.hp;
  const erklaerung = erklaertGerade ? null : p.erklaerung;
  const q = p.quiz;
  const beantwortet = p.ergebnis === true || p.ergebnis === false;
  const gewaehlt = beantwortet ? new Set(p.gewaehlt) : z.auswahl[i] || new Set();
  const mehrere = q && q.richtig.length > 1;
  return h('div', { class: 'haeppchen' },
    h('div', { class: 'leise klein fett', style: { marginBottom: '4px' } }, `Häppchen ${i + 1} von ${s.haeppchen.length}`),
    h('h2', {}, p.bezeichnung),
    erklaertGerade ? h('div', {}, h('div', { class: 'md', id: 'strom', html: md(z.strom) }), laufZeile()) : null,
    erklaerung ? mdElement(erklaerung) : null,
    erklaerung && p.quellen && p.quellen.length ? h('div', { class: 'zeile umbruch', style: { gap: '6px', marginTop: '12px' } },
      [...new Map(p.quellen.map((x) => [x.titel + '#' + x.seite, x])).values()].slice(0, 6).map((x) =>
        h('button', { class: 'chip', onclick: () => lyra.oeffnen(x) }, '📄 ', x.seite ? `${x.titel} · S. ${x.seite}` : x.titel))) : null,
    !erklaerung && !erklaertGerade ? (fehlerZeile('erklaeren') || h('button', { class: 'knopf', onclick: weiter, disabled: !!z.laeuft }, 'Erklären')) : null,
    // Frage zum Anklicken
    erklaerung ? h('div', { class: 'quiz' },
      z.laeuft === 'quiz' && i === z.hp ? laufZeile() : null,
      !q && z.laeuft !== 'quiz' ? (fehlerZeile('quiz') || h('button', { class: 'knopf tonal', disabled: !!z.laeuft, onclick: async () => { await quizStellen(n, i); zeichnen(); } }, 'Frage stellen')) : null,
      q ? h('div', {},
        h('div', { class: 'leise klein fett', style: { marginBottom: '6px' } }, mehrere ? 'Kurze Frage · mehrere richtig' : 'Kurze Frage'),
        mdElement(q.frage, 'fett'),
        h('div', { style: { marginTop: '12px' } }, q.optionen.map((o, j) => {
          const richtig = q.richtig.includes(j);
          const cls = beantwortet ? (richtig ? 'richtig' : gewaehlt.has(j) ? 'falsch' : 'aus') : gewaehlt.has(j) ? 'gewaehlt' : '';
          return h('div', {
            class: `option ${cls} ${mehrere ? 'mehrere' : ''}`,
            onclick: beantwortet ? null : () => {
              const g = new Set(z.auswahl[i] || []);
              if (g.has(j)) g.delete(j);
              else { if (!mehrere) g.clear(); g.add(j); }
              z.auswahl[i] = g;
              zeichnen();
            },
          }, h('div', { class: 'marke' }, beantwortet && (richtig || gewaehlt.has(j)) ? h('span', { style: { color: 'white', fontSize: '12px' } }, richtig ? '✓' : '✕') : null), mdElement(o));
        })),
        !beantwortet ? h('div', { class: 'zeile', style: { justifyContent: 'flex-end' } },
          h('button', { class: 'knopf', disabled: !gewaehlt.size, onclick: () => pruefen(i) }, 'Prüfen')) : null,
        beantwortet ? h('div', { class: 'kasten ' + (p.ergebnis ? 'ok' : 'falsch'), style: { marginTop: '6px' } },
          h('div', { class: 'titel' }, p.ergebnis ? '✓ Richtig!' : '✕ Nicht ganz'),
          q.warum ? mdElement(q.warum) : null) : null,
        beantwortet ? h('div', { class: 'zeile umbruch', style: { marginTop: '14px' } },
          !p.ergebnis ? h('button', { class: 'knopf tonal', disabled: !!z.laeuft, onclick: () => nochEineFrage(i) }, 'Noch eine Frage dazu') : null,
          !p.ergebnis ? h('button', { class: 'knopf rand', disabled: !!z.laeuft, onclick: () => andersErklaeren(i) }, 'Anders erklären') : null,
          h('span', { class: 'wachsen' }),
          h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: naechstes },
            s.haeppchen.slice(i + 1).some((x) => x.ergebnis === null || x.ergebnis === undefined) ? 'Weiter →' : 'Zum Check →')) : null) : null) : null,
    // Rückfragen
    erklaerung ? h('div', { style: { marginTop: '20px' } },
      p.rueckfragen.map(([f, a]) => h('div', {}, h('div', { class: 'rueckfrage' }, h('div', {}, f)), mdElement(a))),
      z.laeuft === 'rueckfrage' && i === z.hp ? h('div', {}, h('div', { class: 'rueckfrage' }, h('div', {}, z.offeneFrage)),
        h('div', { class: 'md', id: 'strom', html: md(z.strom) }), laufZeile()) : null,
      fehlerZeile('rueckfrage'),
      h('div', { class: 'zeile', style: { marginTop: '10px' } },
        feld('frage' + i, { platzhalter: 'Unklar? Frag nach …', beiEnter: () => rueckfrage(i) }),
        h('button', { class: 'knopf tonal', disabled: !!z.laeuft, onclick: () => rueckfrage(i) }, 'Fragen'))) : null);
}

function checkAnsicht(k, n, s) {
  const teile = [];
  teile.push(h('h2', { style: { margin: '4px 0 6px' } }, 'Check'),
    h('p', { class: 'leise', style: { marginBottom: '14px' } }, 'Zum Abschluss des Kapitels: Zeig, dass es sitzt. Tipps und Lösungen gibt es nur, wenn du sie aufrufst.'));
  if (z.laeuft === 'check') teile.push(h('div', { class: 'haeppchen' }, laufZeile()));
  if (!s.aufgaben.length && z.laeuft !== 'check') {
    teile.push(fehlerZeile('check') || h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: neuerCheck }, 'Check starten'));
  }
  s.aufgaben.forEach((a, i) => teile.push(aufgabeKarte(i, a)));
  const fertig = s.aufgaben.length && s.aufgaben.every((a) => a.bewertet);
  if (fertig) teile.push(ergebnis(k, n, s));
  return h('div', {}, teile);
}

const artName = (a) => ({ auswahl: a.richtig.length > 1 ? 'Multiple Choice · mehrere richtig' : 'Multiple Choice', loesen: 'Lösen', beweisen: 'Beweisen' })[a.art] || 'Erklären';
const punkteFarbe = (p) => (p >= 0.8 ? 'var(--ok)' : p >= 0.5 ? 'var(--bernstein)' : 'var(--falsch)');

function aufgabeKarte(i, a) {
  const g = a.bewertet ? new Set(a.gewaehlt) : z.auswahl['a' + i] || new Set();
  const mehrere = a.richtig.length > 1;
  const zeigeLoesung = a.loesung && (a.aufgeloest || (a.art === 'auswahl' && a.bewertet));
  return h('div', { class: 'aufgabe', style: a.bewertet ? { borderColor: `color-mix(in srgb, ${punkteFarbe(a.punkte)} 50%, transparent)` } : null },
    h('div', { class: 'zeile' },
      h('span', { class: 'fett klein wachsen', style: { color: 'var(--farbe)' } }, `Aufgabe ${i + 1} · ${artName(a)}`),
      a.bewertet ? h('span', { class: 'punkte', style: { color: punkteFarbe(a.punkte), background: `color-mix(in srgb, ${punkteFarbe(a.punkte)} 13%, transparent)` } }, `${Math.round(a.punkte * 100)} %`) : null),
    h('div', { style: { margin: '8px 0 10px' } }, mdElement(a.frage)),
    a.art === 'auswahl'
      ? h('div', {},
        a.optionen.map((o, j) => {
          const richtig = a.richtig.includes(j);
          const cls = a.bewertet ? (richtig ? 'richtig' : g.has(j) ? 'falsch' : 'aus') : g.has(j) ? 'gewaehlt' : '';
          return h('div', {
            class: `option ${cls} ${mehrere ? 'mehrere' : ''}`,
            onclick: a.bewertet ? null : () => {
              const s = new Set(z.auswahl['a' + i] || []);
              if (s.has(j)) s.delete(j); else { if (!mehrere) s.clear(); s.add(j); }
              z.auswahl['a' + i] = s;
              zeichnen();
            },
          }, h('div', { class: 'marke' }), mdElement(o));
        }),
        !a.bewertet ? h('div', { class: 'zeile', style: { justifyContent: 'flex-end' } },
          a.tipp && !a.tippGesehen ? h('button', { class: 'knopf text', onclick: () => tippZeigen(i) }, '💡 Tipp') : null,
          h('button', { class: 'knopf', disabled: !g.size, onclick: () => auswahlPruefen(i) }, 'Prüfen')) : null)
      : a.bewertet
        ? (a.antwort ? h('div', { class: 'kasten', style: { '--kfarbe': 'var(--leise)' } }, h('div', { class: 'titel' }, 'Deine Antwort'), mdElement(a.antwort)) : null)
        : h('div', {},
          feld('antwort' + i, { zeilen: 5, platzhalter: a.art === 'beweisen' ? 'Dein Beweis … (Formeln gern als $…$)' : a.art === 'loesen' ? 'Dein Lösungsweg … (Formeln gern als $…$)' : 'Erklär es in eigenen Worten …' }),
          z.laeuft === 'abgeben:' + i ? laufZeile() : h('div', { class: 'zeile', style: { marginTop: '8px' } },
            a.tipp && !a.tippGesehen ? h('button', { class: 'knopf text', disabled: !!z.laeuft, onclick: () => tippZeigen(i) }, '💡 Tipp') : null,
            h('button', { class: 'knopf leise', disabled: !!z.laeuft, onclick: () => loesungZeigen(i) }, 'Lösung zeigen'),
            h('span', { class: 'wachsen' }),
            h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: () => abgeben(i) }, 'Abgeben')),
          fehlerZeile('abgeben:' + i)),
    a.tippGesehen && a.tipp && !a.bewertet ? h('div', { class: 'kasten warn', style: { marginTop: '10px' } }, h('div', { class: 'titel' }, '💡 Tipp'), mdElement(a.tipp)) : null,
    a.bewertet && a.rueckmeldung ? h('div', { class: 'kasten ' + (a.punkte >= 0.8 ? 'ok' : a.punkte >= 0.5 ? 'warn' : 'falsch'), style: { marginTop: '12px' } },
      h('div', { class: 'titel' }, 'Rückmeldung'), mdElement(a.rueckmeldung),
      a.luecke && a.punkte < 0.8 ? h('div', { class: 'klein fett leise', style: { marginTop: '6px' } }, 'Noch üben: ' + a.luecke) : null) : null,
    z.laeuft === 'loesung:' + i ? h('div', { style: { marginTop: '12px' } }, h('div', { class: 'md', id: 'strom', html: md(z.strom) }), laufZeile())
      : zeigeLoesung ? h('div', { class: 'kasten', style: { marginTop: '12px' } }, h('div', { class: 'titel' }, a.art === 'auswahl' ? 'Erklärung' : 'Musterlösung'), mdElement(a.loesung))
        : a.bewertet ? h('button', { class: 'knopf text', style: { marginTop: '6px' }, disabled: !!z.laeuft, onclick: () => loesungZeigen(i) }, a.art === 'auswahl' ? 'Erklärung ansehen' : 'Musterlösung ansehen') : null,
    fehlerZeile('loesung:' + i));
}

function ergebnis(k, n, s) {
  const p = Math.round((s.letzte || 0) * 100);
  const gemeistert = s.stand === 'gemeistert';
  const naechster = k.schritte.findIndex((x, j) => j > n && x.stand !== 'gemeistert');
  const farbe = gemeistert ? 'var(--ok)' : 'var(--bernstein)';
  return h('div', { class: 'ergebnis', style: { borderColor: `color-mix(in srgb, ${farbe} 45%, transparent)`, background: `color-mix(in srgb, ${farbe} 8%, transparent)` } },
    h('h3', {}, gemeistert ? `🏆 ${p} % – Kapitel gemeistert!` : `${p} % – ab ${z.einst.schwelle} % geht es weiter.`),
    h('p', { class: 'leise', style: { margin: '6px 0 14px' } }, gemeistert
      ? (naechster >= 0 ? `Weiter mit Kapitel ${naechster + 1}: ${k.schritte[naechster].titel}.` : 'Das war das letzte Kapitel.')
      : `Kein Problem – ${lehrerName()} erklärt die Häppchen, bei denen es gehakt hat, noch einmal anders. Danach kommt ein neuer Check.`),
    h('div', { class: 'zeile umbruch' },
      gemeistert && naechster >= 0 ? h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: () => kapitelWaehlen(naechster) }, 'Weiter zum nächsten Kapitel →') : null,
      !gemeistert ? h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: wiederholen }, 'Schwierige Stellen wiederholen') : null,
      h('button', { class: 'knopf rand', disabled: !!z.laeuft, onclick: neuerCheck }, gemeistert ? 'Noch ein Check' : 'Gleich neuer Check')));
}

function fertigBanner(k) {
  return h('div', { class: 'fertig-banner' },
    h('div', { style: { fontSize: '38px' } }, '🏆'),
    h('div', { class: 'wachsen' }, h('h3', {}, `Du hast „${k.titel}“ gemeistert!`),
      h('p', { class: 'leise', style: { marginTop: '4px' } }, `Alle ${k.schritte.length} Kapitel geschafft. Mit Karteikarten bleibt es langfristig hängen.`)),
    h('button', { class: 'knopf', onclick: () => mitFlip(k) }, 'Mit Flip festigen'));
}

start();
