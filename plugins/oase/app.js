'use strict';
/*
 * Oase – ein ruhiger Ort für Kopf und Alltag im Studium. Beim Öffnen fragt Oase aktiv, wie es dir geht (Emojis,
 * Schieberegler, Häkchen), wertet das aus und gibt dir kleine, ehrliche Ratschläge und einen Plan für heute.
 * Lyra (lokal) liest nur auf deinem Mac mit; mit Claude/ChatGPT/Gemini verlassen deine persönlichen Angaben den Mac –
 * darauf weist Oase sichtbar hin. Keine Therapie: bei einer Krise zeigt Oase sofort, wo es Hilfe gibt.
 */
const { h, mdElement, md } = lyra;

const SYSTEM = `Du bist Lyra im Plugin „Oase“: eine warmherzige, ruhige Begleiterin für Studierende – für Stress, \
Motivation, Lernalltag, Schlaf und alles, was im Kopf herumgeht. Du sprichst locker und herzlich mit „du“, auf Deutsch, \
kurz und konkret, nie belehrend, nie kitschig. Du bist keine Therapeutin und stellst keine Diagnosen. Du nimmst Gefühle \
ernst, machst Mut und schlägst kleine, machbare Schritte vor (Lernen, Pausen, Schlaf, Bewegung, Kontakte, Grenzen \
setzen). Wenn jemand von Suizidgedanken, Selbstverletzung oder einer akuten Krise schreibt, reagierst du mitfühlend, \
nimmst es ernst und ermutigst deutlich, sich sofort Hilfe zu holen (TelefonSeelsorge 0800 111 0 111 oder \
0800 111 0 222, kostenlos und rund um die Uhr; in Gefahr: Notruf 112).`;

const STANDARD = { ki: 'auto', erinnerung: true, fristen: true, kurz: false, ton: 'warm' };

const KRISE = /suizid|selbstmord|umbringen|nicht mehr leben|sterben will|will sterben|mir (was|etwas) antun|ritzen|selbstverletz|keinen sinn mehr|alles beenden|nicht mehr da sein/i;

const THEMEN = ['Prüfungen', 'Abgaben', 'Zu viel Stoff', 'Motivation', 'Konzentration', 'Schlaf', 'Einsamkeit',
  'Beziehungen', 'Familie', 'Geld', 'Zukunft & Studium', 'Gesundheit', 'Nichts Besonderes'];
const GUTES = ['Draußen gewesen', 'Bewegt', 'Genug getrunken', 'Richtig gegessen', 'Mit jemandem geredet',
  'Bildschirmfreie Pause', 'Etwas Schönes gemacht'];

function fragen(e) {
  const morgens = new Date().getHours() < 12;
  const alle = [
    { id: 'stimmung', art: 'emoji', frage: 'Wie geht es dir gerade?',
      optionen: [['😣', 'Gar nicht gut'], ['😕', 'Eher mies'], ['😐', 'Geht so'], ['🙂', 'Ganz gut'], ['😄', 'Richtig gut']] },
    { id: 'energie', art: 'skala', frage: 'Wie viel Energie hast du?', min: 0, max: 10, start: 5, links: '🪫 leer', rechts: 'voller Energie 🔋' },
    { id: 'stress', art: 'skala', frage: 'Wie gestresst fühlst du dich?', min: 0, max: 10, start: 4, links: '🌿 ganz entspannt', rechts: 'total unter Druck 🌋' },
    { id: 'schlaf', art: 'schlaf', frage: 'Wie hast du letzte Nacht geschlafen?' },
    { id: 'themen', art: 'mehrfach', frage: 'Was beschäftigt dich gerade?', hinweis: 'Tipp an, was passt – gern mehreres.', optionen: THEMEN },
    morgens
      ? { id: 'lernen', art: 'auswahl', frage: 'Was hast du heute vor?', optionen: ['Viel lernen', 'Vorlesungen & Übungen', 'Abgabe fertig machen', 'Ein entspannter Tag', 'Weiß noch nicht'] }
      : { id: 'lernen', art: 'auswahl', frage: 'Wie lief das Lernen heute?', optionen: ['Bin nicht dazu gekommen', 'Zäh', 'Okay', 'Gut', 'Richtig gut'] },
    { id: 'gutes', art: 'mehrfach', frage: morgens ? 'Was tut dir heute gut?' : 'Was hast du heute schon für dich getan?', hinweis: 'Alles zählt – auch Kleines.', optionen: GUTES },
    { id: 'text', art: 'text', frage: 'Magst du noch etwas loswerden?', platzhalter: 'Was dir durch den Kopf geht – nur wenn du magst …', optional: true },
  ];
  return e.kurz ? alle.filter((f) => ['stimmung', 'stress', 'themen', 'text'].includes(f.id)) : alle;
}

// ================================================================== Zustand

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  ansicht: 'start', // start | checkin | auswertung | atmen | verlauf
  schritt: 0,
  antworten: {},
  heute: null, // Check-in von heute (mit Auswertung, Plan, Gespräch)
  verlauf: [],
  laeuft: null,
  hinweis: '',
  strom: '',
  fehler: null,
  eingabe: '',
  fristen: [],
  nachfrageAntwort: null,
};
const app = document.getElementById('app');
const online = () => z.lehrer !== 'lyra';
const lehrerName = () => (z.info?.lehrer || []).find((l) => l.kennung === z.lehrer)?.name || 'Lyra';
const heuteSchluessel = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function gruss() {
  const s = new Date().getHours();
  if (s < 4) return 'Noch wach? 🌙';
  if (s < 11) return 'Guten Morgen ☀️';
  if (s < 17) return 'Schön, dass du da bist 🌤';
  return 'Guten Abend 🌙';
}

// ================================================================== Lehrer und Speicher

async function ki(auftrag, sichtbar = true) {
  if (sichtbar) {
    z.laeuft = auftrag.art || 'ki';
    z.hinweis = '';
    z.strom = '';
    z.fehler = null;
    zeichnen();
  }
  try {
    const r = await lyra.ki({ lehrer: z.lehrer, system: SYSTEM, ...auftrag }, sichtbar ? stueck : null);
    if (r && r.lehrer && r.lehrer !== z.lehrer) z.lehrer = r.lehrer;
    return r;
  } catch (e) {
    const m = String((e && e.message) || e);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
    return null;
  } finally {
    if (sichtbar) {
      z.laeuft = null;
      zeichnen();
    }
  }
}

let plan = 0;
function stueck(e) {
  if (e.art === 'hinweis') z.hinweis = e.text;
  else if (e.art === 'text') z.strom += e.text;
  else if (e.art === 'ersetzen') z.strom = e.text;
  if (!plan) {
    plan = requestAnimationFrame(() => {
      plan = 0;
      const s = document.getElementById('strom');
      if (s) s.innerHTML = md(z.strom);
    });
  }
}

async function speichern() {
  if (!z.heute) return;
  try {
    await lyra.speicher.schreiben('checkins/' + z.heute.datum, z.heute);
  } catch (_) {}
  const i = z.verlauf.findIndex((c) => c.datum === z.heute.datum);
  if (i >= 0) z.verlauf[i] = z.heute;
  else z.verlauf.unshift(z.heute);
  startseite();
}

/** Auf Lyras Startseite: eine Einladung wie „Wie war dein Tag?“ – und, wenn es einen gibt, der Plan für heute. */
function startseite() {
  const morgen = new Date();
  morgen.setHours(24 + 4, 0, 0, 0);
  const heuteFertig = z.heute && z.heute.auswertung;
  const eintraege = [];
  if (z.einst.erinnerung) {
    eintraege.push({
      id: 'einladung',
      art: 'frage',
      titel: 'Wie geht es dir heute?',
      untertitel: 'Kurzer Check-in, 2 Minuten',
      route: 'checkin',
      zeigen_ab: heuteFertig ? Math.floor(morgen.getTime() / 1000) : null,
      varianten: [
        { ab: 0, bis: 4, titel: 'Noch wach? Wie geht es dir?', untertitel: 'Kurz durchatmen – 2 Minuten' },
        { ab: 4, bis: 11, titel: 'Guten Morgen! Wie hast du geschlafen?', untertitel: 'Kurzer Check-in, 2 Minuten' },
        { ab: 11, bis: 17, titel: 'Wie läuft dein Tag bisher?', untertitel: 'Kurzer Check-in, 2 Minuten' },
        { ab: 17, bis: 24, titel: 'Wie war dein Tag?', untertitel: 'Erzähl kurz – 2 Minuten' },
      ],
      geaendert: lyra.jetzt(),
    });
  }
  if (heuteFertig && z.heute.plan && z.heute.plan.length) {
    const erledigt = z.heute.plan.filter((p) => p.erledigt).length;
    eintraege.push({
      id: 'plan',
      titel: 'Dein Plan für heute',
      untertitel: `${erledigt} von ${z.heute.plan.length} erledigt`,
      fortschritt: erledigt / z.heute.plan.length,
      route: 'heute',
      zeigen_bis: Math.floor(morgen.getTime() / 1000),
      geaendert: lyra.jetzt(),
    });
  }
  lyra.startseite(eintraege).catch(() => {});
}

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
    z.verlauf = (await lyra.speicher.liste('checkins')).map((e) => e.wert).filter(Boolean).sort((a, b) => (a.datum < b.datum ? 1 : -1));
  } catch (_) {}
  z.heute = z.verlauf.find((c) => c.datum === heuteSchluessel()) || null;
  if (z.einst.fristen) lyra.fristen().then((f) => (z.fristen = f || [])).catch(() => {});
  lyra.bei('zurueck', zurueck);
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  // Oase spricht dich direkt an: ohne Check-in heute geht es gleich mit der ersten Frage los
  if (route === 'einstellungen') {
    zeichnen();
    einstellungen();
  } else if (route === 'atmen') atmenStarten();
  else if (z.heute && z.heute.auswertung && route !== 'checkin') {
    z.ansicht = 'auswertung';
    zeichnen();
  } else checkinStarten();
  startseite();
}

function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.laeuft) lyra.abbrechen();
  if (z.ansicht === 'checkin' && z.schritt > 0) {
    z.schritt--;
    return zeichnen();
  }
  if (z.ansicht !== 'start') {
    atmenStoppen();
    z.ansicht = 'start';
    return zeichnen();
  }
  lyra.zurueck();
}

function checkinStarten() {
  z.ansicht = 'checkin';
  z.schritt = 0;
  z.antworten = { schlafStunden: 7, schlafGut: 'okay' };
  fragen(z.einst).forEach((f) => { if (f.art === 'skala') z.antworten[f.id] = f.start; });
  zeichnen();
}

function weiterFrage() {
  const liste = fragen(z.einst);
  if (z.schritt < liste.length - 1) {
    z.schritt++;
    zeichnen();
  } else auswerten();
}

function antwortText(a) {
  const s = ['gar nicht gut', 'eher mies', 'geht so', 'ganz gut', 'richtig gut'];
  const zeilen = [];
  if (a.stimmung !== undefined) zeilen.push(`Stimmung: ${s[a.stimmung]} (${a.stimmung + 1}/5)`);
  if (a.energie !== undefined) zeilen.push(`Energie: ${a.energie}/10`);
  if (a.stress !== undefined) zeilen.push(`Stress: ${a.stress}/10`);
  if (a.schlafStunden !== undefined && fragen(z.einst).some((f) => f.id === 'schlaf')) zeilen.push(`Schlaf letzte Nacht: ${a.schlafStunden} Stunden, ${a.schlafGut}`);
  if (a.themen && a.themen.length) zeilen.push(`Was mich beschäftigt: ${a.themen.join(', ')}`);
  if (a.lernen) zeilen.push(`${new Date().getHours() < 12 ? 'Vorhaben heute' : 'Lernen heute'}: ${a.lernen}`);
  if (a.gutes && a.gutes.length) zeilen.push(`Was ich für mich getan habe: ${a.gutes.join(', ')}`);
  if (a.text && a.text.trim()) zeilen.push(`Was ich noch loswerden will: ${a.text.trim()}`);
  return zeilen.join('\n');
}

function trend() {
  const frueher = z.verlauf.filter((c) => c.datum !== heuteSchluessel()).slice(0, 5);
  if (!frueher.length) return '';
  return 'Meine letzten Check-ins:\n' + frueher.map((c) => {
    const a = c.antworten || {};
    return `- ${c.datum}: Stimmung ${a.stimmung !== undefined ? a.stimmung + 1 : '?'}/5, Stress ${a.stress ?? '?'}/10${a.energie !== undefined ? `, Energie ${a.energie}/10` : ''}${a.themen && a.themen.length ? `, Themen: ${a.themen.join(', ')}` : ''}`;
  }).join('\n') + '\n\n';
}

const SCHEMA = {
  type: 'object',
  properties: {
    beobachtung: { type: 'string' },
    ermutigung: { type: 'string' },
    fokus: { type: 'array', items: { type: 'object', properties: { punkt: { type: 'string' }, warum: { type: 'string' } }, required: ['punkt', 'warum'] } },
    hilfe_noetig: { type: 'boolean' },
    nachfrage: {
      type: 'object',
      properties: {
        art: { type: 'string', enum: ['skala', 'auswahl', 'mehrfach', 'text'] },
        frage: { type: 'string' },
        links: { type: 'string' },
        optionen: { type: 'array', items: { type: 'string' } },
        rechts: { type: 'string' },
      },
      required: ['art', 'frage', 'links', 'optionen', 'rechts'],
    },
    tagesplan: { type: 'array', items: { type: 'object', properties: { dauer_min: { type: 'integer' }, schritt: { type: 'string' }, tipp: { type: 'string' } }, required: ['dauer_min', 'schritt', 'tipp'] } },
  },
  required: ['beobachtung', 'ermutigung', 'fokus', 'hilfe_noetig', 'nachfrage', 'tagesplan'],
};

async function auswerten() {
  const a = z.antworten;
  const krise = KRISE.test(a.text || '');
  z.heute = { datum: heuteSchluessel(), zeit: lyra.jetzt(), antworten: a, auswertung: null, plan: [], gespraech: [], krise };
  z.ansicht = 'auswertung';
  await speichern();
  const fristen = z.einst.fristen && z.fristen.length
    ? `Meine nächsten Abgaben:\n${z.fristen.slice(0, 5).map((f) => `- ${f.titel} (${f.fach}) – ${f.wann}`).join('\n')}\n\n`
    : '';
  const r = await ki({
    art: 'auswerten',
    prompt: `Mein Check-in gerade (${new Date().toLocaleString('de-DE', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}):\n${antwortText(a)}\n\n${trend()}${fristen}\
Schau dir das in Ruhe an und antworte mir als JSON:\n\
- "beobachtung": 2 bis 3 warme, ehrliche Sätze, was du aus meinen Antworten liest (direkt an mich, ohne Zahlen aufzuzählen)\n\
- "fokus": 2 bis 3 Punkte, auf die ich heute achten sollte – "punkt" kurz, "warum" in einem Satz\n\
- "tagesplan": 2 bis 4 konkrete, kleine Schritte für heute, besonders fürs Lernen und Arbeiten (z. B. Lernblöcke mit Pausen, \
womit anfangen, wann aufhören, was mir guttut) – "schritt" kurz, "tipp" ein Satz, "dauer_min" grob in Minuten\n\
- "ermutigung": ein Satz, der mir wirklich Mut macht – persönlich, nicht kitschig\n\
- "nachfrage": genau eine Rückfrage, die dir hilft, mich besser zu verstehen – als "skala" (dann "links"/"rechts" für die \
Enden), "auswahl" oder "mehrfach" (dann 3 bis 6 "optionen") oder "text"\n\
- "hilfe_noetig": true nur, wenn meine Angaben auf eine Krise oder Gefahr hindeuten`,
    schema: SCHEMA,
  });
  const v = r && r.json;
  if (!v) return zeichnen();
  const text = (x) => (typeof x === 'string' ? x.trim() : '');
  z.heute.auswertung = {
    beobachtung: text(v.beobachtung),
    ermutigung: text(v.ermutigung),
    fokus: (v.fokus || []).map((f) => ({ punkt: text(f.punkt), warum: text(f.warum) })).filter((f) => f.punkt).slice(0, 4),
    nachfrage: v.nachfrage && text(v.nachfrage.frage) ? {
      art: ['skala', 'auswahl', 'mehrfach', 'text'].includes(v.nachfrage.art) ? v.nachfrage.art : 'text',
      frage: text(v.nachfrage.frage),
      optionen: (v.nachfrage.optionen || []).map(text).filter(Boolean).slice(0, 7),
      links: text(v.nachfrage.links),
      rechts: text(v.nachfrage.rechts),
    } : null,
    lehrer: z.lehrer,
  };
  z.heute.krise = z.heute.krise || !!v.hilfe_noetig;
  z.heute.plan = (v.tagesplan || []).map((p) => ({ schritt: text(p.schritt), tipp: text(p.tipp), minuten: Number(p.dauer_min) || 0, erledigt: false })).filter((p) => p.schritt).slice(0, 5);
  await speichern();
  zeichnen();
}

async function nachfrageBeantworten() {
  const n = z.heute.auswertung.nachfrage;
  const w = z.nachfrageAntwort;
  if (!n || w === null || w === undefined || (Array.isArray(w) && !w.length) || (typeof w === 'string' && !w.trim())) return;
  const antwort = Array.isArray(w) ? w.join(', ') : n.art === 'skala' ? `${w}/10 (0 = ${n.links}, 10 = ${n.rechts})` : String(w);
  z.heute.nachfrageAntwort = antwort;
  z.heute.gespraech.push(['ich', `${n.frage} → ${antwort}`]);
  if (KRISE.test(antwort)) z.heute.krise = true;
  await speichern();
  await antworten(`Deine Rückfrage war: „${n.frage}“. Meine Antwort: ${antwort}. Geh kurz darauf ein (3 bis 5 Sätze) und gib mir, wenn es passt, einen konkreten Tipp dazu.`);
}

async function schreiben() {
  const t = z.eingabe.trim();
  if (!t || z.laeuft) return;
  z.eingabe = '';
  z.heute.gespraech.push(['ich', t]);
  if (KRISE.test(t)) z.heute.krise = true;
  await speichern();
  await antworten(t);
}

async function antworten(nachricht) {
  const a = z.heute.auswertung || {};
  const verlauf = z.heute.gespraech.slice(-8, -1).map(([r, t]) => `${r === 'ich' ? 'Ich' : 'Du'}: ${t}`).join('\n');
  const r = await ki({
    art: 'antworten',
    prompt: `Mein Check-in heute:\n${antwortText(z.heute.antworten)}\n\nDeine Einschätzung: ${a.beobachtung || ''}\n\n${verlauf ? `Unser Gespräch bisher:\n${verlauf}\n\n` : ''}\
${nachricht}\n\nAntworte mir direkt – herzlich, kurz (höchstens etwa 120 Wörter), mit einem konkreten nächsten Schritt, wenn es passt.`,
  });
  if (r && r.text.trim()) {
    z.heute.gespraech.push(['oase', r.text.trim()]);
    if (KRISE.test(r.text) && /telefonseelsorge|112/i.test(r.text)) z.heute.krise = true;
    await speichern();
  }
  zeichnen();
}

async function planUmschalten(i) {
  const p = z.heute.plan[i];
  p.erledigt = !p.erledigt;
  await speichern();
  zeichnen();
}

// ---------------------------------------------------------------- Atemübung (4 ein – 4 halten – 6 aus)

let atemTimer = null;
function atmenStarten() {
  z.ansicht = 'atmen';
  zeichnen();
  const kreis = () => document.querySelector('.atemkreis');
  const phasen = [['Einatmen', 4000, 1], ['Halten', 4000, 1], ['Ausatmen', 6000, 0.6]];
  let runde = 0;
  let i = 0;
  const schritt = () => {
    const k = kreis();
    if (!k || z.ansicht !== 'atmen') return;
    const [text, dauer, groesse] = phasen[i];
    k.textContent = text;
    k.style.transition = `transform ${dauer}ms ease-in-out`;
    k.style.transform = `scale(${groesse})`;
    i = (i + 1) % phasen.length;
    if (i === 0) runde++;
    const r = document.getElementById('runden');
    if (r) r.textContent = runde >= 6 ? 'Schön gemacht. Wie fühlst du dich jetzt?' : `Runde ${runde + 1} von 6`;
    if (runde < 6) atemTimer = setTimeout(schritt, dauer);
    else k.textContent = '🌿';
  };
  atemTimer = setTimeout(schritt, 600);
}
function atmenStoppen() {
  if (atemTimer) clearTimeout(atemTimer);
  atemTimer = null;
}

// ---------------------------------------------------------------- Einstellungen

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const wahl = (schluessel, optionen) => {
    const box = h('div', { class: 'chips' });
    const malen = () => box.replaceChildren(...optionen.map(([wert, name]) =>
      h('button', { class: 'chip' + (e[schluessel] === wert ? ' an' : ''), onclick: () => { e[schluessel] = wert; malen(); } }, name)));
    malen();
    return box;
  };
  const zeile = (titel, erkl, inhalt) => h('div', { class: 'spalte', style: { gap: '6px', marginBottom: '16px' } },
    h('div', { class: 'fett' }, titel), h('div', { class: 'leise klein' }, erkl), inhalt);
  const ok = await lyra.dialog('Oase – Einstellungen', h('div', {},
    zeile('Wer antwortet', 'Automatisch: Claude, ChatGPT bzw. Gemini, wenn verbunden – dann verlassen deine persönlichen Angaben deinen Mac. Mit „Immer Lyra (lokal)“ bleibt alles bei dir.',
      wahl('ki', [['auto', 'Automatisch'], ['lyra', 'Immer Lyra (lokal)']])),
    zeile('Check-in', 'Ausführlich mit Energie, Schlaf und Alltag – oder kurz in vier Fragen.', wahl('kurz', [[false, 'Ausführlich'], [true, 'Kurz']])),
    zeile('Einladung auf der Startseite', 'Oase fragt dich auf Lyras Startseite, wie dein Tag war.', wahl('erinnerung', [[true, 'An'], [false, 'Aus']])),
    zeile('Abgaben einbeziehen', 'Oase berücksichtigt deine nächsten Abgaben bei den Tipps.', wahl('fristen', [[true, 'Ja'], [false, 'Nein']])),
    h('div', { class: 'leise klein' }, '🔒 Deine Check-ins liegen nur auf deinem Mac. Unter „Verlauf“ kannst du alles löschen.')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  z.lehrer = e.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
  startseite();
  zeichnen();
}

async function allesLoeschen() {
  if (!(await lyra.bestaetigen({ titel: 'Alle Check-ins löschen?', text: 'Dein ganzer Verlauf in Oase wird endgültig gelöscht.', ja: 'Alles löschen', nein: 'Abbrechen', gefahr: true }))) return;
  for (const c of z.verlauf) {
    try { await lyra.speicher.loeschen('checkins/' + c.datum); } catch (_) {}
  }
  z.verlauf = [];
  z.heute = null;
  startseite();
  z.ansicht = 'start';
  zeichnen();
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const pos = app.scrollTop;
  app.replaceChildren(h('div', { class: 'inhalt' }, ansicht()));
  if (feld) {
    const e = document.querySelector(`[data-feld="${feld}"]`);
    if (e) e.focus();
  }
  app.scrollTop = z.ansicht === 'checkin' ? 0 : pos;
  lyra.titel(z.ansicht === 'checkin' ? 'Check-in' : z.ansicht === 'verlauf' ? 'Verlauf' : z.ansicht === 'atmen' ? 'Durchatmen' : '');
}

function ansicht() {
  switch (z.ansicht) {
    case 'checkin': return checkinAnsicht();
    case 'auswertung': return auswertungAnsicht();
    case 'atmen': return atmenAnsicht();
    case 'verlauf': return verlaufAnsicht();
    default: return startAnsicht();
  }
}

/** Wer liest mit – deutlich, aber freundlich. */
function privatHinweis() {
  if (online()) {
    return h('div', { class: 'privat online' }, h('span', { style: { fontSize: '18px' } }, '🌐'),
      h('span', { class: 'wachsen' }, h('b', {}, `${lehrerName()} antwortet – `), 'deine persönlichen Angaben verlassen dafür deinen Mac und gehen an den Anbieter.'),
      h('button', { class: 'knopf tonal klein', onclick: () => { z.lehrer = 'lyra'; zeichnen(); } }, 'Lieber privat mit Lyra'));
  }
  const andere = (z.info?.lehrer || []).filter((l) => l.kennung !== 'lyra');
  return h('div', { class: 'privat lokal' }, h('span', { style: { fontSize: '18px' } }, '🔒'),
    h('span', { class: 'wachsen' }, h('b', {}, 'Ganz privat: '), 'Lyra antwortet nur auf deinem Mac – nichts geht hinaus.'),
    andere.length ? h('button', { class: 'knopf text klein', onclick: () => { z.lehrer = andere[0].kennung; zeichnen(); } }, `${andere[0].name} nutzen`) : null);
}

function hilfeKarte() {
  return h('div', { class: 'hilfe erscheinen' },
    h('div', { class: 'fett', style: { fontSize: '17px', marginBottom: '8px' } }, 'Du musst da nicht allein durch 💛'),
    h('div', { style: { lineHeight: '1.6' } },
      h('div', {}, '📞 ', h('b', {}, 'TelefonSeelsorge: 0800 111 0 111'), ' oder 0800 111 0 222 – kostenlos, anonym, rund um die Uhr'),
      h('div', {}, '💬 Chat & Mail: ', h('button', { class: 'link', onclick: () => lyra.link('https://online.telefonseelsorge.de') }, 'online.telefonseelsorge.de')),
      h('div', {}, '🚑 In akuter Gefahr: ', h('b', {}, 'Notruf 112')),
      h('div', {}, '🎓 Die psychologische Beratung deiner Hochschule bzw. des Studierendenwerks hilft meist kostenlos und schnell.')));
}

function startAnsicht() {
  const fertig = z.heute && z.heute.auswertung;
  return h('div', { class: 'erscheinen' },
    h('h1', { class: 'gruss' }, gruss()),
    h('p', { class: 'untertitel' }, fertig ? 'Du hast heute schon eingecheckt – schön! Magst du weiterreden oder kurz durchatmen?' : 'Wie geht es dir heute? Lass uns kurz gemeinsam hinschauen.'),
    h('div', { style: { margin: '22px 0 14px' } }, privatHinweis()),
    h('div', { class: 'glas', style: { textAlign: 'center' } },
      h('div', { style: { fontSize: '44px' } }, fertig ? '🌿' : '☁️'),
      h('p', { class: 'untertitel', style: { margin: '6px 0 18px' } }, fertig ? 'Dein Check-in von heute ist gespeichert.' : 'Ein paar kurze Fragen – tippen statt tippen-tippen. Dauert etwa 2 Minuten.'),
      h('div', { class: 'zeile', style: { justifyContent: 'center' } },
        fertig ? h('button', { class: 'knopf gross', onclick: () => { z.ansicht = 'auswertung'; zeichnen(); } }, 'Zu deinem Tag') : null,
        h('button', { class: 'knopf gross' + (fertig ? ' tonal' : ''), onclick: checkinStarten }, fertig ? 'Neuer Check-in' : 'Check-in starten'))),
    h('div', { class: 'kacheln' },
      h('button', { class: 'kachel-o', onclick: atmenStarten }, h('div', { class: 'gross' }, '🫧'), h('div', { class: 'fett' }, 'Durchatmen'), h('div', { class: 'leise klein' }, '1 Minute zur Ruhe kommen')),
      h('button', { class: 'kachel-o', onclick: () => { z.ansicht = 'verlauf'; zeichnen(); } }, h('div', { class: 'gross' }, '📈'), h('div', { class: 'fett' }, 'Verlauf'), h('div', { class: 'leise klein' }, 'Wie es dir zuletzt ging')),
      h('button', { class: 'kachel-o', onclick: einstellungen }, h('div', { class: 'gross' }, '⚙️'), h('div', { class: 'fett' }, 'Einstellungen'), h('div', { class: 'leise klein' }, 'Wer antwortet, Check-in'))),
    h('p', { class: 'leise-fuss' }, 'Oase ersetzt keine Therapie. Wenn es dir richtig schlecht geht: TelefonSeelsorge 0800 111 0 111 – kostenlos, rund um die Uhr.'));
}

function checkinAnsicht() {
  const liste = fragen(z.einst);
  const f = liste[z.schritt];
  const a = z.antworten;
  const letzte = z.schritt === liste.length - 1;
  let eingabe;
  let beantwortet = true;
  switch (f.art) {
    case 'emoji':
      beantwortet = a[f.id] !== undefined;
      eingabe = h('div', { class: 'emojis' }, f.optionen.map(([e, t], i) =>
        h('button', { class: 'emoji' + (a[f.id] === i ? ' an' : ''), onclick: () => { a[f.id] = i; zeichnen(); setTimeout(weiterFrage, 350); } },
          h('span', { class: 'e' }, e), h('span', { class: 't' }, t))));
      break;
    case 'skala': {
      const wert = h('div', { class: 'regler-wert' }, String(a[f.id]), h('small', {}, ' / 10'));
      const r = h('input', { type: 'range', class: 'weich', min: f.min, max: f.max, step: 1, value: a[f.id] });
      r.addEventListener('input', () => { a[f.id] = Number(r.value); wert.firstChild.textContent = r.value; });
      eingabe = h('div', { class: 'regler-box' }, wert, r, h('div', { class: 'regler-enden' }, h('span', {}, f.links), h('span', {}, f.rechts)));
      break;
    }
    case 'schlaf': {
      const wert = h('div', { class: 'regler-wert' }, String(a.schlafStunden), h('small', {}, ' Stunden'));
      const r = h('input', { type: 'range', class: 'weich', min: 2, max: 12, step: 0.5, value: a.schlafStunden });
      r.addEventListener('input', () => { a.schlafStunden = Number(r.value); wert.firstChild.textContent = r.value; });
      eingabe = h('div', { class: 'regler-box' }, wert, r, h('div', { class: 'regler-enden' }, h('span', {}, '2 h'), h('span', {}, '12 h')),
        h('div', { class: 'chips', style: { justifyContent: 'center', marginTop: '18px' } }, [['erholsam', '😴 erholsam'], ['okay', '🙂 okay'], ['unruhig', '😵‍💫 unruhig'], ['kaum', '🥱 kaum geschlafen']].map(([w, t]) =>
          h('button', { class: 'chip' + (a.schlafGut === w ? ' an' : ''), onclick: () => { a.schlafGut = w; zeichnen(); } }, t))));
      break;
    }
    case 'mehrfach':
      a[f.id] = a[f.id] || [];
      eingabe = h('div', {}, f.hinweis ? h('p', { class: 'leise', style: { marginBottom: '12px' } }, f.hinweis) : null,
        h('div', { class: 'chips' }, f.optionen.map((o) => h('button', {
          class: 'chip' + (a[f.id].includes(o) ? ' an' : ''),
          onclick: () => { const l = a[f.id]; if (l.includes(o)) l.splice(l.indexOf(o), 1); else l.push(o); zeichnen(); },
        }, (a[f.id].includes(o) ? '✓ ' : '') + o))));
      break;
    case 'auswahl':
      beantwortet = !!a[f.id];
      eingabe = h('div', { class: 'spalte' }, f.optionen.map((o) => h('button', {
        class: 'chip' + (a[f.id] === o ? ' an' : ''), style: { padding: '13px 18px', textAlign: 'left' },
        onclick: () => { a[f.id] = o; zeichnen(); setTimeout(weiterFrage, 300); },
      }, o)));
      break;
    default: {
      const t = h('textarea', { class: 'eingabe', rows: 5, 'data-feld': 'checkin-text', placeholder: f.platzhalter });
      t.value = a.text || '';
      t.addEventListener('input', () => { a.text = t.value; });
      eingabe = h('div', { class: 'spalte' }, t, KRISE.test(a.text || '') ? hilfeKarte() : null);
    }
  }
  return h('div', {},
    h('div', { class: 'punkte' }, liste.map((_, i) => h('i', { class: i <= z.schritt ? 'an' : '' }))),
    h('div', { class: 'glas erscheinen', key: z.schritt },
      z.schritt === 0 ? h('div', { class: 'leise', style: { marginBottom: '4px' } }, gruss()) : null,
      h('div', { class: 'frage' }, f.frage),
      eingabe,
      h('div', { class: 'unten' },
        z.schritt > 0 ? h('button', { class: 'knopf text', onclick: () => { z.schritt--; zeichnen(); } }, '← Zurück') : h('span'),
        letzte
          ? h('button', { class: 'knopf gross', onclick: auswerten }, 'Fertig – was meinst du? ✨')
          : h('button', { class: 'knopf' + (beantwortet ? '' : ' tonal'), onclick: weiterFrage }, beantwortet ? 'Weiter →' : 'Überspringen'))),
    letzte ? h('div', { style: { marginTop: '16px' } }, privatHinweis()) : null);
}

function auswertungAnsicht() {
  const c = z.heute;
  if (!c) return startAnsicht();
  const a = c.auswertung;
  const teile = [];
  if (c.krise) teile.push(hilfeKarte());
  if (!a) {
    if (z.laeuft) {
      teile.push(h('div', { class: 'glas atmen-warten' }, h('div', { class: 'puls' }), h('div', {}, z.hinweis || `${lehrerName()} schaut sich das in Ruhe an …`),
        h('button', { class: 'knopf text klein', onclick: () => lyra.abbrechen() }, 'Abbrechen')));
    } else {
      teile.push(h('div', { class: 'glas' }, h('p', {}, z.fehler || 'Die Auswertung fehlt noch.'),
        h('div', { class: 'zeile', style: { marginTop: '12px' } },
          h('button', { class: 'knopf', onclick: () => { z.antworten = c.antworten; auswerten(); } }, 'Nochmal versuchen'),
          online() && lyra.istOffline(z.fehler) ? h('button', { class: 'knopf tonal', onclick: () => { z.lehrer = 'lyra'; z.antworten = c.antworten; auswerten(); } }, 'Mit Lyra lokal') : null)));
    }
    return h('div', {}, teile);
  }
  teile.push(h('h1', { class: 'gruss erscheinen', style: { fontSize: '26px', marginBottom: '14px' } }, 'Danke, dass du dir die Zeit nimmst 💛'));
  teile.push(h('div', { class: 'karte-o erscheinen' }, h('h3', {}, '👀 Was ich sehe'), mdElement(a.beobachtung)));
  if (a.fokus.length) {
    teile.push(h('div', { class: 'karte-o erscheinen' }, h('h3', {}, '🎯 Darauf solltest du heute achten'),
      a.fokus.map((f) => h('div', { style: { marginBottom: '8px' } }, h('div', { class: 'fett' }, f.punkt), h('div', { class: 'leise' }, f.warum)))));
  }
  if (c.plan.length) {
    const fertig = c.plan.filter((p) => p.erledigt).length;
    teile.push(h('div', { class: 'karte-o erscheinen' }, h('h3', {}, '🗓 Dein Plan für heute', h('span', { class: 'leise klein wachsen', style: { textAlign: 'right' } }, `${fertig} von ${c.plan.length}`)),
      c.plan.map((p, i) => h('div', { class: 'plan-punkt' + (p.erledigt ? ' fertig' : ''), onclick: () => planUmschalten(i) },
        h('div', { class: 'haken' }, p.erledigt ? '✓' : ''),
        h('div', { class: 'wachsen was' }, h('div', { class: 'fett' }, p.schritt), h('div', { class: 'leise klein' }, p.tipp)),
        p.minuten ? h('div', { class: 'dauer' }, `${p.minuten} Min.`) : null))));
  }
  if (a.ermutigung) teile.push(h('div', { class: 'karte-o zitat erscheinen' }, '„', a.ermutigung, '“'));
  // Rückfrage mit Schieberegler, Auswahl oder Text
  const n = a.nachfrage;
  if (n && !c.nachfrageAntwort) {
    let feld;
    if (n.art === 'skala') {
      if (z.nachfrageAntwort === null || typeof z.nachfrageAntwort !== 'number') z.nachfrageAntwort = 5;
      const wert = h('div', { class: 'regler-wert' }, String(z.nachfrageAntwort), h('small', {}, ' / 10'));
      const r = h('input', { type: 'range', class: 'weich', min: 0, max: 10, step: 1, value: z.nachfrageAntwort });
      r.addEventListener('input', () => { z.nachfrageAntwort = Number(r.value); wert.firstChild.textContent = r.value; });
      feld = h('div', { class: 'regler-box' }, wert, r, h('div', { class: 'regler-enden' }, h('span', {}, n.links), h('span', {}, n.rechts)));
    } else if (n.art === 'auswahl' || n.art === 'mehrfach') {
      if (!Array.isArray(z.nachfrageAntwort)) z.nachfrageAntwort = [];
      feld = h('div', { class: 'chips' }, n.optionen.map((o) => h('button', {
        class: 'chip' + (z.nachfrageAntwort.includes(o) ? ' an' : ''),
        onclick: () => {
          const l = z.nachfrageAntwort;
          if (l.includes(o)) l.splice(l.indexOf(o), 1);
          else { if (n.art === 'auswahl') l.length = 0; l.push(o); }
          zeichnen();
        },
      }, o)));
    } else {
      const t = h('textarea', { class: 'eingabe', rows: 3, 'data-feld': 'nachfrage', placeholder: 'Deine Antwort …' });
      t.value = typeof z.nachfrageAntwort === 'string' ? z.nachfrageAntwort : '';
      t.addEventListener('input', () => { z.nachfrageAntwort = t.value; });
      feld = t;
    }
    teile.push(h('div', { class: 'karte-o erscheinen' }, h('h3', {}, '💭 Noch eine Frage an dich'), h('div', { class: 'frage', style: { fontSize: '19px', margin: '4px 0 14px' } }, n.frage), feld,
      h('div', { class: 'zeile', style: { justifyContent: 'flex-end', marginTop: '14px' } }, h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: nachfrageBeantworten }, 'Antworten'))));
  }
  // Gespräch
  const gespraech = c.gespraech.map(([r, t]) => r === 'ich' ? h('div', { class: 'blase ich' }, t) : h('div', { class: 'blase oase' }, mdElement(t)));
  if (z.laeuft === 'antworten') gespraech.push(h('div', { class: 'blase oase' }, h('div', { class: 'md', id: 'strom', html: md(z.strom) || '…' })));
  teile.push(h('div', { style: { marginTop: '6px' } }, gespraech));
  if (z.fehler && !z.laeuft) teile.push(lyra.fehlerBox(z.fehler, online() ? () => { z.lehrer = 'lyra'; z.fehler = null; zeichnen(); } : null, () => { z.fehler = null; zeichnen(); }));
  const t = h('input', { class: 'eingabe', 'data-feld': 'chat', placeholder: 'Schreib mir, was dich beschäftigt …', value: z.eingabe });
  t.addEventListener('input', () => { z.eingabe = t.value; });
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); schreiben(); } });
  teile.push(h('div', { class: 'zeile', style: { marginTop: '12px' } }, t, h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: schreiben }, 'Senden')));
  teile.push(h('div', { style: { marginTop: '14px' } }, privatHinweis()));
  teile.push(h('div', { class: 'zeile', style: { justifyContent: 'center', marginTop: '14px' } },
    h('button', { class: 'knopf tonal', onclick: atmenStarten }, '🫧 Durchatmen'),
    h('button', { class: 'knopf text', onclick: () => { z.ansicht = 'verlauf'; zeichnen(); } }, '📈 Verlauf')));
  teile.push(h('p', { class: 'leise-fuss' }, 'Oase ersetzt keine Therapie. Wenn es dir richtig schlecht geht: TelefonSeelsorge 0800 111 0 111 – kostenlos, rund um die Uhr.'));
  return h('div', {}, teile);
}

function atmenAnsicht() {
  return h('div', { class: 'glas erscheinen', style: { textAlign: 'center' } },
    h('div', { class: 'frage', style: { marginBottom: '0' } }, 'Komm kurz zur Ruhe'),
    h('p', { class: 'untertitel' }, 'Atme mit dem Kreis: 4 Sekunden ein, 4 halten, 6 aus.'),
    h('div', { class: 'atemkreis' }, 'Bereit?'),
    h('p', { class: 'leise', id: 'runden' }, 'Runde 1 von 6'),
    h('div', { class: 'zeile', style: { justifyContent: 'center', marginTop: '14px' } },
      h('button', { class: 'knopf tonal', onclick: () => { atmenStoppen(); atmenStarten(); } }, 'Nochmal'),
      h('button', { class: 'knopf', onclick: () => { atmenStoppen(); z.ansicht = z.heute && z.heute.auswertung ? 'auswertung' : 'start'; zeichnen(); } }, 'Fertig')));
}

function verlaufAnsicht() {
  const liste = z.verlauf.slice(0, 14).reverse();
  const emoji = ['😣', '😕', '😐', '🙂', '😄'];
  let grafik = null;
  if (liste.length >= 2) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'verlauf');
    svg.setAttribute('viewBox', '0 0 600 160');
    svg.setAttribute('preserveAspectRatio', 'none');
    const linie = (werte, max, farbe) => {
      const p = document.createElementNS(ns, 'polyline');
      p.setAttribute('points', werte.map((w, i) => `${(i / (werte.length - 1)) * 580 + 10},${150 - (w / max) * 130}`).join(' '));
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', farbe);
      p.setAttribute('stroke-width', '3.5');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(p);
    };
    linie(liste.map((c) => (c.antworten.stimmung ?? 2) * 2.5), 10, 'var(--akzent)');
    linie(liste.map((c) => c.antworten.stress ?? 5), 10, '#9b8cf2');
    if (liste.some((c) => c.antworten.energie !== undefined)) linie(liste.map((c) => c.antworten.energie ?? 5), 10, 'var(--mild)');
    grafik = h('div', { class: 'karte-o' }, h('h3', {}, 'Die letzten Tage'), svg,
      h('div', { class: 'zeile leise klein', style: { gap: '16px' } },
        h('span', { style: { color: 'var(--akzent)' } }, '● Stimmung'), h('span', { style: { color: '#9b8cf2' } }, '● Stress'), h('span', { style: { color: 'var(--mild)' } }, '● Energie')));
  }
  return h('div', { class: 'erscheinen' },
    h('h1', { class: 'gruss', style: { fontSize: '26px' } }, 'Dein Verlauf'),
    h('p', { class: 'untertitel', style: { marginBottom: '18px' } }, z.verlauf.length ? 'So ging es dir zuletzt. Muster zu erkennen hilft – ohne Bewertung.' : 'Noch keine Check-ins. Der erste ist der wichtigste 🌱'),
    grafik,
    z.verlauf.slice(0, 14).map((c) => h('div', { class: 'karte-o', style: { display: 'flex', gap: '14px', alignItems: 'center' } },
      h('div', { style: { fontSize: '30px' } }, emoji[c.antworten.stimmung ?? 2]),
      h('div', { class: 'wachsen' },
        h('div', { class: 'fett' }, new Date(c.datum + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })),
        h('div', { class: 'leise klein' }, [c.antworten.stress !== undefined ? `Stress ${c.antworten.stress}/10` : null,
          c.antworten.themen && c.antworten.themen.length ? c.antworten.themen.slice(0, 3).join(', ') : null,
          c.plan && c.plan.length ? `Plan ${c.plan.filter((p) => p.erledigt).length}/${c.plan.length}` : null].filter(Boolean).join(' · '))))),
    z.verlauf.length ? h('div', { class: 'zeile', style: { justifyContent: 'center', marginTop: '18px' } },
      h('button', { class: 'knopf text', onclick: allesLoeschen }, 'Alle Check-ins löschen')) : null);
}

start();
