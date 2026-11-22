'use strict';
/*
 * Launchpad – von der Idee zum Plan, und dann Schritt für Schritt umgesetzt. Rückfragen → Plan mit Meilensteinen,
 * Terminen und Aufgaben → Launchpad packt mit an: Entwürfe und Konzepte schreiben, recherchieren, Anleitungen geben,
 * an passende Plugins übergeben. Immer sichtbar: der nächste Schritt. Der Coach schlägt Änderungen vor – übernommen wird
 * nur, was du bestätigst.
 */
const { h } = lyra;

// Plugins, an die Launchpad übergeben kann (nur installierte werden angeboten)
const WERKZEUGE = {
  scout: ['Scout', 'recherchiert ein Thema im Internet und schreibt ein Skript mit Quellen', (a) => 'thema/' + a],
  veritas: ['Veritas', 'prüft Behauptungen und Fakten', (a) => 'text/' + a],
  tinte: ['Tinte', 'schreibt Briefe und E-Mails'],
  kompass: ['Kompass', 'plant Lernzeit rückwärts von Fristen'],
  flow: ['Flow', 'Fokus-Timer für konzentriertes Arbeiten'],
  prisma: ['Prisma', 'analysiert Daten aus CSV/Excel'],
  zaster: ['Zaster', 'Budget und Haushaltsbuch'],
  sprungbrett: ['Sprungbrett', 'Bewerbungen und Lebenslauf'],
  recap: ['Recap', 'wertet Besprechungen aus: Entscheidungen und To-dos'],
  regie: ['Regie', 'plant ein Erklärvideo'],
  graphit: ['Graphit', 'zeichnet Schaubilder und Diagramme'],
  mindmap: ['Mindmap', 'vernetzt Begriffe'],
  deepdive: ['Deep Dive', 'erklärt ein Thema Schritt für Schritt'],
  flip: ['Flip', 'Karteikarten zum Lernen'],
  quizzard: ['Quizzard', 'Quiz, um Wissen zu testen'],
  sokrates: ['Sokrates', 'Nachhilfe im Dialog'],
  oase: ['Oase', 'gegen Stress, für Motivation'],
  echo: ['Echo', 'nimmt Gespräche auf und schreibt sie mit'],
  argus: ['Argus', 'prüft Verträge'],
};
const ARTEN = {
  text: ['✍️', 'Machen lassen', 'Launchpad erstellt das direkt'],
  recherche: ['🔎', 'Recherchieren', 'Launchpad recherchiert dazu'],
  werkzeug: ['🧰', 'Werkzeug', 'mit einem passenden Plugin'],
  selbst: ['🙋', 'Selbst machen', 'mit Schritt-für-Schritt-Anleitung'],
};
const IDEEN = [
  'Eine Lerngruppe für Analysis gründen', 'In 6 Wochen fit für die Statistik-Klausur', 'Einen Podcast über Nachhaltigkeit starten',
  'Ein Startup für gebrauchte Uni-Bücher', 'Ein Auslandssemester in Schweden organisieren', 'Eine eigene Portfolio-Website bauen',
  'Einen Halbmarathon im Frühjahr laufen', 'Eine App, die Mensa-Essen bewertet', 'Mein erstes Hackathon-Projekt', 'Werkstudentenjob finden',
];

const SYSTEM = `Du bist „Launchpad“ in Lyra: eine tatkräftige Projekt-Coachin für Studierende. Du sprichst mich mit „du“ an, \
schreibst klares, motivierendes Deutsch und bist konkret statt allgemein. Du zerlegst Vorhaben in kleine, machbare Schritte, \
planst realistisch (Uni, Klausuren und Pausen zählen mit) und schlägst vor, was sich sofort erledigen lässt.`;

const FRAGEN_SCHEMA = {
  type: 'object',
  properties: { fragen: { type: 'array', items: { type: 'object', properties: { frage: { type: 'string' }, vorschlaege: { type: 'array', items: { type: 'string' } } }, required: ['frage', 'vorschlaege'] } } },
  required: ['fragen'],
};
const AUFGABE = {
  type: 'object',
  properties: {
    art: { type: 'string', enum: Object.keys(ARTEN) },
    auftrag: { type: 'string' },
    beschreibung: { type: 'string' },
    minuten: { type: 'integer' },
    titel: { type: 'string' },
    werkzeug: { type: 'string' },
  },
  required: ['art', 'auftrag', 'beschreibung', 'minuten', 'titel', 'werkzeug'],
};
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    erfolg: { type: 'array', items: { type: 'string' } },
    meilensteine: { type: 'array', items: { type: 'object', properties: { aufgaben: { type: 'array', items: AUFGABE }, bis: { type: 'string' }, titel: { type: 'string' } }, required: ['aufgaben', 'bis', 'titel'] } },
    name: { type: 'string' },
    ressourcen: { type: 'array', items: { type: 'string' } },
    risiken: { type: 'array', items: { type: 'object', properties: { gegenmittel: { type: 'string' }, risiko: { type: 'string' } }, required: ['gegenmittel', 'risiko'] } },
    vision: { type: 'string' },
    ziel: { type: 'string' },
  },
  required: ['erfolg', 'meilensteine', 'name', 'ressourcen', 'risiken', 'vision', 'ziel'],
};
const COACH_SCHEMA = {
  type: 'object',
  properties: {
    antwort: { type: 'string' },
    vorschlaege: { type: 'array', items: { type: 'object', properties: { aufgabe: AUFGABE, begruendung: { type: 'string' }, meilenstein: { type: 'integer' } }, required: ['aufgabe', 'begruendung', 'meilenstein'] } },
  },
  required: ['antwort', 'vorschlaege'],
};

const z = {
  info: null,
  lehrer: 'lyra',
  liste: [],
  werkzeuge: [], // installierte Kennungen aus WERKZEUGE
  ansicht: 'start', // start | fragen | projekt
  idee: '',
  fragen: [], // [{frage, vorschlaege, antwort}]
  p: null,
  laeuft: false,
  status: '',
  fehler: null,
  offen: null, // geöffnetes Ergebnis {mi, ai}
  coach: { text: '', antwort: '', vorschlaege: [] },
};
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const abgebrochen = (e) => /ABGEBROCHEN|Abgebrochen/.test(String((e && e.message) || e));
const meldung = (e) => String((e && e.message) || e);
const lehrerInfo = (k) => ((z.info && z.info.lehrer) || []).find((l) => l.kennung === k) || { kennung: k, name: k === 'lyra' ? 'Lyra (lokal)' : k };
const isoGueltig = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s + 'T12:00:00')) ? s : '');
const heuteIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const deDatum = (iso, kurz) => (isoGueltig(iso) ? new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', kurz ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'long' }) : '');
const tageBis = (iso) => (isoGueltig(iso) ? Math.round((new Date(iso + 'T12:00:00') - new Date(heuteIso() + 'T12:00:00')) / 86400000) : null);

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  let e = {};
  try { e = (await lyra.speicher.lesen('einstellungen')) || {}; } catch (_) {}
  const lehrer = z.info.lehrer || [];
  z.lehrer = lehrer.some((l) => l.kennung === e.lehrer) ? e.lehrer : z.info.standardLehrer || 'lyra';
  try { z.liste = ((await lyra.speicher.lesen('index')) || []).filter((x) => x && x.id); } catch (_) {}
  const da = await Promise.all(Object.keys(WERKZEUGE).map((k) => lyra.installiert(k).then((x) => (x ? k : null)).catch(() => null)));
  z.werkzeuge = da.filter(Boolean);
  lyra.bei('zurueck', zurueck);
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('projekt/')) await oeffnen(route.slice(8));
  zeichnen();
  startseite();
}

function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.laeuft) return lyra.abbrechen().catch(() => {});
  if (z.offen) { z.offen = null; return zeichnen(); }
  if (z.ansicht !== 'start') { z.ansicht = 'start'; z.p = null; return zeichnen(); }
  lyra.zurueck();
}

async function lehrerWaehlen(l) {
  z.lehrer = l;
  try { await lyra.speicher.schreiben('einstellungen', { lehrer: l }); } catch (_) {}
  zeichnen();
}

// ================================================================== Speichern, Startseite, Erinnerungen

const alleAufgaben = (p) => p.meilensteine.flatMap((m, mi) => m.aufgaben.map((a, ai) => ({ a, m, mi, ai })));
const fortschritt = (p) => { const l = alleAufgaben(p); return l.length ? l.filter((x) => x.a.erledigt).length / l.length : 0; };
const naechste = (p) => alleAufgaben(p).find((x) => !x.a.erledigt) || null;

async function sichern(p) {
  p.geaendert = lyra.jetzt();
  try { await lyra.speicher.schreiben('projekte/' + p.id, p); } catch (_) {}
  const n = naechste(p);
  const meta = { id: p.id, name: p.name, zeit: p.zeit, geaendert: p.geaendert, fortschritt: fortschritt(p), naechste: n ? n.a.titel : '', fertig: !n };
  z.liste = [meta, ...z.liste.filter((x) => x.id !== p.id)];
  try { await lyra.speicher.schreiben('index', z.liste); } catch (_) {}
  startseite();
}

async function oeffnen(id) {
  try {
    const p = await lyra.speicher.lesen('projekte/' + id);
    if (p && Array.isArray(p.meilensteine)) { z.p = p; z.ansicht = 'projekt'; z.offen = null; z.coach = { text: '', antwort: '', vorschlaege: [] }; }
  } catch (_) {}
}

async function entfernen(id) {
  const ok = await lyra.bestaetigen({ titel: 'Projekt löschen?', text: 'Plan, Ergebnisse und Erinnerungen dieses Projekts werden gelöscht.', ja: 'Löschen', gefahr: true });
  if (!ok) return;
  try { await lyra.speicher.loeschen('projekte/' + id); } catch (_) {}
  z.liste = z.liste.filter((x) => x.id !== id);
  try { await lyra.speicher.schreiben('index', z.liste); } catch (_) {}
  if (z.p && z.p.id === id) { z.p = null; z.ansicht = 'start'; }
  await erinnerungenSetzen();
  startseite();
  zeichnen();
}

function startseite() {
  const eintraege = z.liste.filter((x) => !x.fertig && x.naechste).slice(0, 2).map((x) => ({
    id: 'projekt-' + x.id,
    titel: `${x.name}: ${x.naechste}`,
    untertitel: `Nächster Schritt · ${Math.round((x.fortschritt || 0) * 100)} % geschafft`,
    route: 'projekt/' + x.id,
    zeigen_bis: lyra.jetzt() + 21 * 86400,
    geaendert: x.geaendert || x.zeit,
  }));
  lyra.startseite(eintraege).catch(() => {});
}

/** Erinnerungen an Meilensteine (am Vortag, 9 Uhr) – nur für Projekte, bei denen du sie eingeschaltet hast. */
async function erinnerungenSetzen() {
  const liste = [];
  for (const meta of z.liste) {
    let p = z.p && z.p.id === meta.id ? z.p : null;
    if (!p) { try { p = await lyra.speicher.lesen('projekte/' + meta.id); } catch (_) {} }
    if (!p || !p.erinnern) continue;
    p.meilensteine.forEach((m, mi) => {
      if (!isoGueltig(m.bis) || m.aufgaben.every((a) => a.erledigt)) return;
      const d = new Date(m.bis + 'T09:00:00');
      d.setDate(d.getDate() - 1);
      if (d.getTime() < Date.now()) return;
      liste.push({ id: `${p.id}-${mi}`, titel: `Morgen fällig: ${m.titel}`.slice(0, 120), text: `${p.name} · ${m.aufgaben.filter((a) => !a.erledigt).length} Aufgaben offen`, zeit: Math.round(d.getTime() / 1000) });
    });
  }
  try { return await lyra.erinnern(liste.slice(0, 60)); } catch (_) { return false; }
}

// ================================================================== Idee → Rückfragen → Plan

function status(t) { z.status = t; const el = document.getElementById('status'); if (el) el.textContent = t; }

async function rueckfragen(idee) {
  const t = text(idee);
  if (!t || z.laeuft) return;
  z.idee = t;
  z.laeuft = true;
  z.fehler = null;
  status('Launchpad denkt über deine Idee nach …');
  zeichnen();
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer, system: SYSTEM, schema: FRAGEN_SCHEMA,
      prompt: `Meine Idee bzw. mein Vorhaben: „${t}“\n\nStelle 3 bis 4 kurze Rückfragen, deren Antworten den Plan deutlich besser machen \
(z. B. bis wann, wie viel Zeit pro Woche, Budget, Vorwissen, was genau „geschafft“ heißt, wer mitmacht). Nur, was sich nicht \
schon aus der Idee ergibt. Je Frage 3–4 typische, kurze Antwortvorschläge.\n\nAntwort als JSON: {"fragen": [{"frage": "", "vorschlaege": [""]}]}`,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    z.fragen = (((r && r.json) || {}).fragen || []).filter((f) => f && text(f.frage)).slice(0, 4)
      .map((f) => ({ frage: frageReparieren(text(f.frage)), vorschlaege: (f.vorschlaege || []).map(text).filter(Boolean).slice(0, 4), antwort: '' }));
    z.ansicht = 'fragen';
    if (!z.fragen.length) { z.laeuft = false; return planen(); }
  } catch (e) {
    if (!abgebrochen(e)) z.fehler = meldung(e);
  }
  z.laeuft = false;
  zeichnen();
}

/** Kleine Modelle beenden JSON-Text gern am deutschen Anführungszeichen – dann fehlt das Ende der Frage. */
function frageReparieren(q) {
  let f = q;
  if ((f.match(/„/g) || []).length > (f.match(/[“”]/g) || []).length) f += '“';
  if (!/[?.!:]$/.test(f)) f += '?';
  return f;
}

function werkzeugListe() {
  return z.werkzeuge.length ? z.werkzeuge.map((k) => `- "${k}": ${WERKZEUGE[k][0]} – ${WERKZEUGE[k][1]}`).join('\n') : '(keine – nutze dann keine Aufgaben der Art "werkzeug")';
}

function aufgabePruefen(a) {
  if (!a || !text(a.titel)) return null;
  let art = ARTEN[a.art] ? a.art : 'selbst';
  const werkzeug = text(a.werkzeug).toLowerCase();
  if (art === 'werkzeug' && !z.werkzeuge.includes(werkzeug)) art = 'text';
  return {
    id: lyra.neueId() + Math.random().toString(36).slice(2, 6),
    titel: text(a.titel).slice(0, 120),
    beschreibung: text(a.beschreibung).slice(0, 500),
    art,
    werkzeug: art === 'werkzeug' ? werkzeug : '',
    auftrag: text(a.auftrag).slice(0, 700) || text(a.titel),
    minuten: Math.max(5, Math.min(600, Math.round(Number(a.minuten) || 30))),
    erledigt: false,
    ergebnis: '',
  };
}

async function planen() {
  if (z.laeuft) return;
  z.laeuft = true;
  z.fehler = null;
  status('Launchpad baut deinen Plan …');
  zeichnen();
  let fristen = [];
  try { fristen = ((await lyra.fristen()) || []).slice(0, 12); } catch (_) {}
  const antworten = z.fragen.filter((f) => text(f.antwort)).map((f) => `- ${f.frage} → ${text(f.antwort)}`).join('\n');
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer, system: SYSTEM, schema: PLAN_SCHEMA, zaehlen: { schluessel: 'titel', wort: 'Schritt' },
      prompt: `Heute ist ${deDatum(heuteIso())} (${heuteIso()}).\nMein Vorhaben: „${z.idee}“\n${antworten ? `Meine Antworten:\n${antworten}\n` : ''}\
${fristen.length ? `Meine nächsten Abgaben und Klausuren (plane drumherum, nicht in die Tage davor):\n${fristen.map((f) => `- ${f.titel || f.fach || 'Termin'}: ${String(f.termin || f.wann || '').slice(0, 16)}`).join('\n')}\n` : ''}
Erstelle einen umsetzbaren Plan:
- "name": kurzer Projektname (2–4 Wörter). "vision": 1 Satz, wofür es sich lohnt. "ziel": messbares Ziel mit Datum.
- "erfolg": 2–4 Kriterien, woran ich merke, dass es geklappt hat.
- "meilensteine": 3 bis 6, in sinnvoller Reihenfolge, je "titel", "bis" (Datum JJJJ-MM-TT, realistisch verteilt bis zum Ziel) und \
2 bis 5 "aufgaben". Der erste Meilenstein beginnt mit einem schnellen Erfolg, den ich heute schaffe.
- Jede Aufgabe: "titel" (Verb zuerst, konkret), "beschreibung" (1 Satz), "minuten" (realistischer Aufwand) und "art":
  "text" = Launchpad erstellt das Ergebnis direkt (Entwurf, Konzept, Text, Checkliste, Tabelle, Budget, Pitch …) – "auftrag" beschreibt genau, was entstehen soll;
  "recherche" = Launchpad recherchiert – "auftrag" ist die Recherchefrage;
  "werkzeug" = ein Lyra-Plugin aus der Liste hilft – "werkzeug" ist seine Kennung, "auftrag" was dort zu tun ist;
  "selbst" = nur ich kann es tun (z. B. Leute ansprechen, Termin wahrnehmen) – "auftrag" ist ein konkreter Tipp.
  Wo möglich "text" oder "recherche", damit ich sofort Ergebnisse habe. "werkzeug" sonst "".
- "risiken": 2–3 mit "gegenmittel". "ressourcen": nützliche Hilfsmittel, Anlaufstellen, Kosten.

Verfügbare Lyra-Plugins:\n${werkzeugListe()}

Antwort als JSON: {"erfolg": [""], "meilensteine": [{"aufgaben": [{"art": "text", "auftrag": "", "beschreibung": "", "minuten": 30, "titel": "", "werkzeug": ""}], "bis": "", "titel": ""}], "name": "", "ressourcen": [""], "risiken": [{"gegenmittel": "", "risiko": ""}], "vision": "", "ziel": ""}`,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    const j = (r && r.json) || {};
    let letztes = heuteIso();
    const meilensteine = (j.meilensteine || []).filter((m) => m && text(m.titel)).slice(0, 7).map((m) => {
      let bis = isoGueltig(text(m.bis));
      if (!bis || bis < letztes) bis = '';
      if (bis) letztes = bis;
      return { titel: text(m.titel).slice(0, 120), bis, aufgaben: (m.aufgaben || []).map(aufgabePruefen).filter(Boolean).slice(0, 8) };
    }).filter((m) => m.aufgaben.length);
    if (!meilensteine.length) throw new Error('Der Plan ist nicht gelungen – beschreib deine Idee etwas genauer und versuch es noch einmal.');
    const p = {
      id: lyra.neueId(),
      zeit: lyra.jetzt(),
      idee: z.idee,
      antworten: z.fragen.filter((f) => text(f.antwort)).map((f) => ({ frage: f.frage, antwort: text(f.antwort) })),
      name: text(j.name).slice(0, 60) || z.idee.slice(0, 60),
      vision: text(j.vision).slice(0, 300),
      ziel: text(j.ziel).slice(0, 400),
      erfolg: (j.erfolg || []).map(text).filter(Boolean).slice(0, 5),
      risiken: (j.risiken || []).filter((x) => x && text(x.risiko)).slice(0, 4).map((x) => ({ risiko: text(x.risiko).slice(0, 200), gegenmittel: text(x.gegenmittel).slice(0, 300) })),
      ressourcen: (j.ressourcen || []).map(text).filter(Boolean).slice(0, 8),
      meilensteine,
      erinnern: false,
      verlauf: [],
    };
    await sichern(p);
    z.p = p;
    z.ansicht = 'projekt';
    z.idee = '';
    z.fragen = [];
    lyra.toast('🚀 Dein Plan steht!', 'ok');
  } catch (e) {
    if (!abgebrochen(e)) z.fehler = meldung(e);
  }
  z.laeuft = false;
  zeichnen();
}

// ================================================================== Aufgaben erledigen lassen

function kontext(p, m, a) {
  const erledigt = alleAufgaben(p).filter((x) => x.a.erledigt).map((x) => `- ${x.a.titel}`).slice(-12).join('\n');
  return `Projekt: ${p.name} – ${p.ziel}\nVorhaben: ${p.idee}\n${p.antworten.length ? p.antworten.map((x) => `${x.frage} → ${x.antwort}`).join('\n') + '\n' : ''}\
Meilenstein: ${m.titel}${m.bis ? ` (bis ${deDatum(m.bis)})` : ''}\nAufgabe: ${a.titel} – ${a.beschreibung}\nAuftrag: ${a.auftrag}\n${erledigt ? `Schon erledigt:\n${erledigt}\n` : ''}`;
}

async function machen(mi, ai) {
  const p = z.p;
  const m = p.meilensteine[mi], a = m.aufgaben[ai];
  if (z.laeuft) return;
  if (a.art === 'werkzeug' && WERKZEUGE[a.werkzeug]) {
    const route = WERKZEUGE[a.werkzeug][2] ? WERKZEUGE[a.werkzeug][2](a.auftrag) : '';
    lyra.toast(`Öffne ${WERKZEUGE[a.werkzeug][0]} …`);
    await lyra.plugin(a.werkzeug, route).catch(() => {});
    return;
  }
  z.laeuft = true;
  z.fehler = null;
  z.offen = { mi, ai };
  a.ergebnis = '';
  status(a.art === 'recherche' ? 'Launchpad recherchiert …' : a.art === 'selbst' ? 'Launchpad schreibt eine Anleitung …' : 'Launchpad arbeitet daran …');
  zeichnen();
  const live = (x) => {
    if (x.art === 'hinweis') status(x.text);
    else if (x.art === 'text' || x.art === 'ersetzen') {
      a.ergebnis = x.art === 'text' ? a.ergebnis + x.text : x.text;
      const el = document.getElementById('ergebnis-live');
      if (el) el.textContent = a.ergebnis.slice(-3000);
    }
  };
  try {
    let r;
    const web = lehrerInfo(z.lehrer).web === true;
    if (a.art === 'recherche') {
      let belege = '';
      if (!web) {
        try {
          status('Schlage in Wikipedia & Co. nach …');
          const funde = await lyra.nachschlagen(a.auftrag, 5);
          belege = (funde || []).map((b, i) => `[${i + 1}] ${b.quelle} – ${b.titel} (${b.url})\n${b.text}`).join('\n\n');
        } catch (e) { if (abgebrochen(e)) throw e; }
      }
      r = await lyra.ki({
        lehrer: z.lehrer, system: SYSTEM, web,
        prompt: `${kontext(p, m, a)}\nRecherchiere: ${a.auftrag}\n\n${web ? 'Suche im Internet nach aktuellen, seriösen Quellen.' : belege ? `Stütze dich auf diese Auszüge:\n${belege}\n` : 'Du hast keinen Internetzugang – nutze dein Wissen und kennzeichne Unsicheres.'}
Schreib eine kompakte Zusammenfassung in Markdown (200–450 Wörter): die wichtigsten Erkenntnisse als Stichpunkte, konkrete Zahlen, \
Anlaufstellen oder Beispiele, und am Ende „## Was das für dein Projekt heißt“ mit 2–3 Konsequenzen.${web || belege ? ' Nenne die Quellen als Markdown-Links.' : ''}`,
      }, live);
    } else if (a.art === 'selbst') {
      r = await lyra.ki({
        lehrer: z.lehrer, system: SYSTEM,
        prompt: `${kontext(p, m, a)}\nDiese Aufgabe muss ich selbst erledigen. Gib mir eine kurze, konkrete Anleitung in Markdown: 3–7 nummerierte \
Schritte, typische Stolpersteine, und wenn passend eine Vorlage (z. B. Nachricht zum Kopieren). Höchstens 300 Wörter.`,
      }, live);
    } else {
      r = await lyra.ki({
        lehrer: z.lehrer, system: SYSTEM,
        prompt: `${kontext(p, m, a)}\nErstelle das Ergebnis jetzt direkt – sofort verwendbar (fertiger Text, Konzept, Checkliste, Tabelle …), in \
Markdown, ohne Vorrede. Fehlen persönliche Angaben, setz einen gut erkennbaren Platzhalter in [eckigen Klammern].`,
      }, live);
    }
    if (r && r.lehrer) z.lehrer = r.lehrer;
    a.ergebnis = text(r && r.text);
    if (!a.ergebnis) throw new Error('Es kam kein Ergebnis zurück – bitte noch einmal versuchen.');
    a.ergebnisZeit = lyra.jetzt();
    await sichern(p);
  } catch (e) {
    if (!abgebrochen(e)) z.fehler = meldung(e);
    if (!a.ergebnisZeit) a.ergebnis = '';
  }
  z.laeuft = false;
  zeichnen();
}

async function abhaken(mi, ai, wert) {
  const p = z.p;
  const a = p.meilensteine[mi].aufgaben[ai];
  a.erledigt = wert;
  a.erledigtAm = wert ? lyra.jetzt() : null;
  const m = p.meilensteine[mi];
  await sichern(p);
  if (wert && m.aufgaben.every((x) => x.erledigt)) lyra.toast(`🎉 Meilenstein geschafft: ${m.titel}`, 'ok');
  else if (wert && !naechste(p)) lyra.toast('🚀 Alles erledigt – Projekt geschafft!', 'ok');
  if (p.erinnern) erinnerungenSetzen();
  zeichnen();
}

// ================================================================== Coach

async function coachFragen() {
  const p = z.p;
  const t = text(z.coach.text);
  if (!t || z.laeuft) return;
  z.laeuft = true;
  z.fehler = null;
  status('Launchpad schaut sich deinen Stand an …');
  zeichnen();
  const stand = p.meilensteine.map((m, i) => `${i + 1}. ${m.titel}${m.bis ? ` (bis ${m.bis})` : ''}: ${m.aufgaben.map((a) => `${a.erledigt ? '✓' : '○'} ${a.titel}`).join('; ')}`).join('\n');
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer, system: SYSTEM, schema: COACH_SCHEMA,
      prompt: `Heute ist ${heuteIso()}.\nProjekt: ${p.name} – ${p.ziel}\nStand:\n${stand}\n\nMein Check-in: „${t}“\n\n"antwort": ehrliches, \
ermutigendes Feedback in 2–4 Sätzen mit einem konkreten Rat. "vorschlaege": 0 bis 3 neue Aufgaben, die jetzt helfen (z. B. ein \
Hindernis aus dem Weg räumen) – je "meilenstein" (Nummer von oben), "begruendung" (1 Satz) und "aufgabe" wie im Plan (art text, \
recherche, werkzeug oder selbst). Verfügbare Plugins:\n${werkzeugListe()}\n\nAntwort als JSON: {"antwort": "", "vorschlaege": [{"aufgabe": \
{"art": "text", "auftrag": "", "beschreibung": "", "minuten": 30, "titel": "", "werkzeug": ""}, "begruendung": "", "meilenstein": 1}]}`,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    const j = (r && r.json) || {};
    z.coach.antwort = text(j.antwort);
    z.coach.vorschlaege = (j.vorschlaege || []).map((v) => ({ aufgabe: aufgabePruefen(v && v.aufgabe), begruendung: text(v && v.begruendung), meilenstein: Math.max(1, Math.min(p.meilensteine.length, Math.round(Number(v && v.meilenstein) || 1))) - 1 }))
      .filter((v) => v.aufgabe).slice(0, 3);
    p.verlauf = [...(p.verlauf || []), { zeit: lyra.jetzt(), checkin: t, antwort: z.coach.antwort }].slice(-30);
    await sichern(p);
    z.coach.text = '';
  } catch (e) {
    if (!abgebrochen(e)) z.fehler = meldung(e);
  }
  z.laeuft = false;
  zeichnen();
}

async function vorschlagUebernehmen(i) {
  const v = z.coach.vorschlaege[i];
  if (!v) return;
  z.p.meilensteine[v.meilenstein].aufgaben.push(v.aufgabe);
  z.coach.vorschlaege.splice(i, 1);
  await sichern(z.p);
  lyra.toast('✓ Aufgabe übernommen', 'ok');
  zeichnen();
}

// ================================================================== Export

function alsMarkdown(p) {
  const z1 = [`# ${p.name}`, '', p.vision ? `> ${p.vision}` : '', '', `**Ziel:** ${p.ziel}`, ''];
  if (p.erfolg.length) z1.push('**Erfolgreich, wenn:**', ...p.erfolg.map((e) => `- ${e}`), '');
  p.meilensteine.forEach((m, i) => {
    z1.push(`## ${i + 1}. ${m.titel}${m.bis ? ` (bis ${deDatum(m.bis)})` : ''}`, '');
    m.aufgaben.forEach((a) => {
      z1.push(`- [${a.erledigt ? 'x' : ' '}] **${a.titel}** (${a.minuten} min) – ${a.beschreibung}`);
      if (a.ergebnis) z1.push('', ...a.ergebnis.split('\n').map((l) => '  > ' + l), '');
    });
    z1.push('');
  });
  if (p.risiken.length) z1.push('## Risiken', ...p.risiken.map((r) => `- **${r.risiko}** → ${r.gegenmittel}`), '');
  if (p.ressourcen.length) z1.push('## Ressourcen', ...p.ressourcen.map((r) => `- ${r}`), '');
  z1.push('---', '_Geplant mit Launchpad in Lyra._');
  return z1.join('\n');
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  app.replaceChildren(z.ansicht === 'fragen' ? fragenAnsicht() : z.ansicht === 'projekt' && z.p ? projektAnsicht(z.p) : startAnsicht());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) e.focus();
  lyra.titel(z.ansicht === 'projekt' && z.p ? z.p.name : '');
}

function ring(anteil, groesse = 46) {
  const r = 18, u = 2 * Math.PI * r;
  const box = h('div', { class: 'ring', style: { width: groesse + 'px', height: groesse + 'px' } });
  box.innerHTML = `<svg viewBox="0 0 44 44" width="${groesse}" height="${groesse}"><circle cx="22" cy="22" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="5"/>
    <circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--akzent)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(u * anteil).toFixed(1)} ${u.toFixed(1)}" transform="rotate(-90 22 22)"/></svg>`;
  box.appendChild(h('span', {}, `${Math.round(anteil * 100)}`));
  return box;
}

function startAnsicht() {
  return h('div', { class: 'seite' },
    h('div', { class: 'held' },
      h('div', { class: 'held-zeichen' }, '🚀'),
      h('h1', {}, 'Was willst du starten?'),
      h('div', { class: 'leise' }, 'Erzähl von deiner Idee oder deinem Vorhaben – Launchpad macht einen Plan daraus und packt Schritt für Schritt mit an.')),
    lyra.verfasser({
      wert: z.idee,
      platzhalter: 'z. B. „Ich will eine Lerngruppe für Analysis gründen“ oder „Ein Podcast über Nachhaltigkeit“',
      beiEingabe: (v) => { z.idee = v; },
      beiSenden: rueckfragen,
      knopf: 'Abheben',
      symbol: '🚀',
      deaktiviert: z.laeuft,
      feld: 'idee',
      unten: z.info ? lyra.lehrerWahl(z.info, z.lehrer, lehrerWaehlen) : null,
    }),
    z.laeuft ? lyra.arbeit(z.status) : null,
    z.fehler ? lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; rueckfragen(z.idee); }) : null,
    !z.laeuft && !z.idee.trim() ? h('div', { style: { marginTop: '14px' } }, lyra.vorschlaege(lyra.mischen(IDEEN), (t) => { z.idee = t; zeichnen(); }, { max: 5, titel: 'Ideen' })) : null,
    z.liste.length ? lyra.abschnitt(`Deine Projekte · ${z.liste.length}`, h('div', { class: 'projekte' }, z.liste.map((x) =>
      h('div', { class: 'projekt-karte', onclick: async () => { await oeffnen(x.id); zeichnen(); } },
        ring(x.fortschritt || 0),
        h('div', { class: 'wachsen', style: { minWidth: 0 } },
          h('div', { class: 'fett eine-zeile' }, x.name),
          h('div', { class: 'klein leise eine-zeile' }, x.fertig ? '🎉 Geschafft' : `Als Nächstes: ${x.naechste}`)),
        h('button', { class: 'knopf symbol', title: 'Löschen', onclick: (e) => { e.stopPropagation(); entfernen(x.id); } }, '🗑'))))) : null);
}

function fragenAnsicht() {
  return h('div', { class: 'seite' },
    h('button', { class: 'knopf text klein', style: { paddingLeft: 0 }, onclick: () => { z.ansicht = 'start'; zeichnen(); } }, '← Zurück'),
    h('h2', { style: { margin: '8px 0 4px' } }, 'Kurz nachgefragt'),
    h('div', { class: 'leise', style: { marginBottom: '14px' } }, `„${z.idee}“ – je genauer, desto besser der Plan. Alles optional.`),
    h('div', { class: 'spalte', style: { gap: '12px' } }, z.fragen.map((f, i) => {
      const feld = h('input', { class: 'eingabe', 'data-feld': 'f' + i, placeholder: 'Eigene Antwort …', value: f.antwort });
      feld.addEventListener('input', () => { f.antwort = feld.value; });
      return h('div', { class: 'frage-karte' },
        h('div', { class: 'fett' }, f.frage),
        h('div', { class: 'zeile umbruch', style: { gap: '6px', margin: '8px 0' } }, f.vorschlaege.map((v) =>
          h('button', { class: 'chip' + (f.antwort === v ? ' an' : ''), onclick: () => { f.antwort = f.antwort === v ? '' : v; zeichnen(); } }, v))),
        feld);
    })),
    z.laeuft ? lyra.arbeit(z.status) : null,
    z.fehler ? lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; planen(); }) : null,
    !z.laeuft ? h('div', { class: 'zeile', style: { justifyContent: 'flex-end', gap: '8px', marginTop: '16px' } },
      h('button', { class: 'knopf text', onclick: () => { z.fragen.forEach((f) => { f.antwort = ''; }); planen(); } }, 'Ohne Antworten planen'),
      h('button', { class: 'knopf gross', onclick: planen }, '🚀 Plan erstellen')) : null);
}

function ergebnisPanel(p) {
  const { mi, ai } = z.offen;
  const m = p.meilensteine[mi], a = m && m.aufgaben[ai];
  if (!a) return null;
  return h('div', { class: 'ergebnis-panel' },
    h('div', { class: 'zeile', style: { marginBottom: '8px' } },
      h('div', { class: 'wachsen' }, h('div', { class: 'ueberschrift-klein' }, `${ARTEN[a.art][0]} ${ARTEN[a.art][1]}`), h('h3', {}, a.titel)),
      h('button', { class: 'knopf symbol', title: 'Schließen', onclick: () => { z.offen = null; zeichnen(); } }, '✕')),
    z.laeuft ? h('div', {}, lyra.arbeit(z.status), h('pre', { class: 'live', id: 'ergebnis-live' }, a.ergebnis.slice(-3000)))
      : a.ergebnis ? h('div', {},
        lyra.mdElement(a.ergebnis, 'ergebnis-text'),
        h('div', { class: 'zeile umbruch', style: { gap: '6px', marginTop: '12px' } },
          h('button', { class: 'knopf tonal klein', onclick: () => lyra.kopieren(a.ergebnis) }, 'Kopieren'),
          h('button', { class: 'knopf tonal klein', onclick: async () => { try { if (await lyra.speichern(a.titel.replace(/[^\wäöüÄÖÜß -]+/g, '').trim().replace(/\s+/g, '-').slice(0, 50) + '.md', `# ${a.titel}\n\n${a.ergebnis}\n`)) lyra.toast('✓ Gesichert', 'ok'); } catch (e) { lyra.toast(meldung(e), 'fehler'); } } }, 'Sichern'),
          h('button', { class: 'knopf tonal klein', onclick: () => machen(mi, ai) }, '🔁 Neu'),
          h('span', { class: 'wachsen' }),
          !a.erledigt ? h('button', { class: 'knopf klein', onclick: () => { abhaken(mi, ai, true); z.offen = null; } }, '✓ Erledigt') : h('span', { class: 'klein leise' }, '✓ erledigt')))
        : z.fehler ? lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; machen(mi, ai); }) : null);
}

function aktionKnopf(a, mi, ai, gross = false) {
  const cls = 'knopf ' + (gross ? '' : 'tonal klein');
  if (a.art === 'werkzeug' && WERKZEUGE[a.werkzeug]) return h('button', { class: cls, onclick: () => machen(mi, ai) }, `🧰 In ${WERKZEUGE[a.werkzeug][0]} öffnen`);
  if (a.ergebnis) return h('button', { class: cls, onclick: () => { z.offen = { mi, ai }; zeichnen(); } }, '📄 Ergebnis ansehen');
  const name = { text: '✍️ Machen lassen', recherche: '🔎 Recherchieren', selbst: '🙋 Anleitung' }[a.art] || 'Los';
  return h('button', { class: cls, disabled: z.laeuft, onclick: () => machen(mi, ai) }, name);
}

function projektAnsicht(p) {
  const n = naechste(p);
  const anteil = fortschritt(p);
  const heute = heuteIso();
  const ueberfaellig = p.meilensteine.find((m) => m.bis && m.bis < heute && m.aufgaben.some((a) => !a.erledigt));
  const kopf = h('div', { class: 'zeile', style: { marginBottom: '10px' } },
    h('button', { class: 'knopf text klein', style: { paddingLeft: 0 }, onclick: () => { z.ansicht = 'start'; z.p = null; z.offen = null; zeichnen(); } }, '← Alle Projekte'),
    h('span', { class: 'wachsen' }),
    lyra.schalter({ wert: p.erinnern, text: 'Erinnern', beiWahl: async (w) => { p.erinnern = w; await sichern(p); const ok = await erinnerungenSetzen(); if (w && !ok) lyra.toast('Erinnerungen kommen nur, wenn Lyra Mitteilungen senden darf.', 'fehler'); zeichnen(); } }),
    h('button', { class: 'knopf tonal klein', onclick: () => lyra.kopieren(alsMarkdown(p), 'Plan kopiert') }, 'Kopieren'),
    h('button', { class: 'knopf tonal klein', onclick: async () => { try { if (await lyra.speichern((p.name || 'Plan').replace(/[^\wäöüÄÖÜß -]+/g, '').trim().replace(/\s+/g, '-') + '.md', alsMarkdown(p))) lyra.toast('✓ Gesichert', 'ok'); } catch (e) { lyra.toast(meldung(e), 'fehler'); } } }, 'Sichern'));
  const held = h('div', { class: 'projekt-held' },
    ring(anteil, 76),
    h('div', { class: 'wachsen', style: { minWidth: 0 } },
      h('h1', {}, p.name),
      p.vision ? h('div', { class: 'vision' }, p.vision) : null,
      h('div', { class: 'ziel' }, h('b', {}, '🎯 Ziel: '), p.ziel)));
  const naechsterSchritt = n ? h('div', { class: 'naechster' },
    h('div', { class: 'ueberschrift-klein' }, 'Dein nächster Schritt'),
    h('div', { class: 'zeile', style: { gap: '12px', marginTop: '6px', alignItems: 'center' } },
      h('div', { class: 'wachsen', style: { minWidth: 0 } },
        h('div', { class: 'naechster-titel' }, n.a.titel),
        h('div', { class: 'klein leise' }, [n.a.beschreibung, `⏱ ${n.a.minuten} min`, ARTEN[n.a.art][2]].filter(Boolean).join(' · '))),
      aktionKnopf(n.a, n.mi, n.ai, true),
      h('button', { class: 'knopf text klein', onclick: () => abhaken(n.mi, n.ai, true) }, '✓ Erledigt'))) : h('div', { class: 'naechster geschafft' }, '🎉 Alles erledigt – stark! Zeit, das nächste Projekt zu starten?');
  const plan = h('div', { class: 'zeitleiste' }, p.meilensteine.map((m, mi) => {
    const fertig = m.aufgaben.every((a) => a.erledigt);
    const t = tageBis(m.bis);
    return h('section', { class: 'meilenstein' + (fertig ? ' fertig' : '') },
      h('div', { class: 'meilenstein-punkt' }, fertig ? '✓' : String(mi + 1)),
      h('div', { class: 'meilenstein-inhalt' },
        h('div', { class: 'zeile', style: { gap: '8px' } },
          h('h3', { class: 'wachsen' }, m.titel),
          m.bis ? h('span', { class: 'termin' + (!fertig && t !== null && t < 0 ? ' spaet' : !fertig && t !== null && t <= 3 ? ' bald' : '') }, `${deDatum(m.bis, true)}${!fertig && t !== null ? (t < 0 ? ' · überfällig' : t === 0 ? ' · heute' : ` · in ${t} T.`) : ''}`) : null),
        h('div', { class: 'aufgaben' }, m.aufgaben.map((a, ai) => h('div', { class: 'aufgabe' + (a.erledigt ? ' erledigt' : '') },
          h('input', { type: 'checkbox', checked: a.erledigt, onchange: (e) => abhaken(mi, ai, e.target.checked), title: 'Erledigt' }),
          h('div', { class: 'wachsen', style: { minWidth: 0 } },
            h('div', { class: 'aufgabe-titel' }, a.titel),
            h('div', { class: 'klein leise' }, [`${ARTEN[a.art][0]} ${a.minuten} min`, a.beschreibung].filter(Boolean).join(' · '))),
          !a.erledigt || a.ergebnis ? aktionKnopf(a, mi, ai) : null)))));
  }));
  const coach = h('div', { class: 'coach' },
    h('div', { class: 'ueberschrift-klein' }, '💬 Check-in mit deinem Coach'),
    (() => {
      const t = h('textarea', { class: 'eingabe', rows: 2, 'data-feld': 'coach', placeholder: 'Wie läuft’s? Was hakt, was hat sich geändert? – z. B. „Ich finde keine Mitglieder“' });
      t.value = z.coach.text;
      t.addEventListener('input', () => { z.coach.text = t.value; });
      return t;
    })(),
    h('div', { class: 'zeile', style: { justifyContent: 'flex-end', marginTop: '8px' } }, h('button', { class: 'knopf klein', disabled: z.laeuft, onclick: coachFragen }, 'Feedback holen')),
    z.coach.antwort ? h('div', { class: 'coach-antwort' }, lyra.mdElement(z.coach.antwort)) : null,
    z.coach.vorschlaege.length ? h('div', { class: 'spalte', style: { gap: '8px', marginTop: '10px' } },
      h('div', { class: 'klein leise' }, 'Vorschläge – übernommen wird nur, was du bestätigst:'),
      z.coach.vorschlaege.map((v, i) => h('div', { class: 'vorschlag' },
        h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, `${ARTEN[v.aufgabe.art][0]} ${v.aufgabe.titel}`), h('div', { class: 'klein leise' }, `→ ${p.meilensteine[v.meilenstein].titel} · ${v.begruendung}`)),
        h('button', { class: 'knopf text klein', onclick: () => { z.coach.vorschlaege.splice(i, 1); zeichnen(); } }, 'Nein'),
        h('button', { class: 'knopf klein', onclick: () => vorschlagUebernehmen(i) }, 'Übernehmen')))) : null);
  const seite = h('aside', { class: 'seitenleiste' },
    p.erfolg.length ? lyra.abschnitt('✅ Geschafft, wenn …', h('ul', { class: 'liste' }, p.erfolg.map((e) => h('li', {}, e)))) : null,
    p.risiken.length ? lyra.abschnitt('⚠️ Risiken', h('div', { class: 'spalte', style: { gap: '8px' } }, p.risiken.map((r) => h('div', { class: 'risiko' }, h('div', { class: 'fett' }, r.risiko), h('div', { class: 'klein leise' }, '→ ' + r.gegenmittel))))) : null,
    p.ressourcen.length ? lyra.abschnitt('🧭 Ressourcen', h('ul', { class: 'liste' }, p.ressourcen.map((e) => h('li', {}, e)))) : null,
    h('div', { class: 'klein leise', style: { marginTop: '10px' } }, `Wer hilft: `, z.info ? lyra.lehrerWahl(z.info, z.lehrer, lehrerWaehlen, { web: true, wiki: true }) : null));
  return h('div', { class: 'seite breit' }, kopf, held,
    ueberfaellig ? h('div', { class: 'hinweis-spaet' }, `⏰ „${ueberfaellig.titel}“ ist überfällig. Erzähl deinem Coach unten, was los ist – gemeinsam findet ihr einen neuen Weg.`) : null,
    naechsterSchritt,
    z.offen ? ergebnisPanel(p) : null,
    z.fehler && !z.offen ? lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); }) : null,
    h('div', { class: 'projekt-raster' }, h('div', { style: { minWidth: 0 } }, lyra.abschnitt('Dein Plan', plan), coach), seite),
    z.laeuft && !z.offen ? lyra.arbeit(z.status) : null);
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  await lyra.dialog('Launchpad', h('div', { style: { maxWidth: '460px', lineHeight: 1.55 } },
    h('p', {}, 'Launchpad plant mit dir, schreibt Entwürfe, recherchiert und übergibt an passende Plugins. Den Plan ändert es nie von selbst – Vorschläge des Coachs übernimmst nur du.'),
    h('p', { class: 'leise', style: { marginTop: '8px' } }, 'Mit Lyra (lokal) bleibt alles auf deinem Mac. Mit Claude, ChatGPT oder Gemini gehen Idee und Plan an den Anbieter (Lyra fragt vorher).'),
    h('p', { class: 'leise', style: { marginTop: '8px' } }, `Werkzeuge, die Launchpad nutzen kann: ${z.werkzeuge.map((k) => WERKZEUGE[k][0]).join(', ') || 'noch keine (installier z. B. Scout oder Tinte)'}.`)), [
    { text: 'Fertig', wert: true },
  ]);
}

start();
