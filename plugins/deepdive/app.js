'use strict';
/*
 * Deep Dive 2.0 – dein persönlicher Professor. Führt dich vollständig und lückenlos durch ein Thema aus deinen
 * Unterlagen: Einstufung (Vorwissen prüfen, fehlende Grundlagen ergänzen) → Lernpfad mit Lernzielen je Kapitel →
 * Häppchen (erklären, Merksatz, Verständnisfrage) mit Lehrer-Werkzeugen (Beispiel, einfacher, tiefer, Analogie,
 * typische Fehler, Schaubild) und Tutor-Chat → Kapitel-Check mit gestuften Hinweisen → gemeistert erst, wenn kein
 * Lernziel mehr eine Lücke hat → Wiederholungsplan (1/3/7/16/35 Tage) → Probeklausur mit Note und Bericht.
 * Dazu: Skript mit Merksätzen, Glossar, Lernzeit und Serie. Daten nur in Lyras Speicher für dieses Plugin.
 */
const { h, md, mdElement } = lyra;

// ================================================================== Lehrkraft

const NIVEAU = {
  schule: ['Schule', 'Oberstufe/Abitur: anschaulich, ohne unnötigen Formalismus'],
  bachelor: ['Bachelor', 'Universität, Grundstudium: präzise Definitionen, Sätze mit Begründung'],
  master: ['Master', 'fortgeschritten: formal exakt, Beweise, Bezüge zu Nachbargebieten'],
};
const STIL = {
  tutor: ['Nachhilfelehrer', 'Geduldig und locker, viele Beispiele',
    'Du bist ein geduldiger, ermutigender Nachhilfelehrer: anschaulich, mit Beispielen aus dem Alltag, und du gehst auf Unsicherheiten ein.'],
  professor: ['Professorin', 'Präzise: Definition – Satz – Begründung – Beispiel',
    'Du bist eine erfahrene Professorin: präzise und strukturiert (Definition, Satz, Begründung, Beispiel), du nennst Voraussetzungen exakt und achtest auf saubere Begriffe.'],
  sokrates: ['Sokratisch', 'Führt mit Denkfragen zur Einsicht',
    'Du lehrst sokratisch: Du führst mit gezielten Denkfragen zur Einsicht, bevor du auflöst, und lässt die Person möglichst viel selbst entdecken.'],
};
const LAENGE = {
  kurz: 'in höchstens 5 Sätzen (etwa 70 bis 100 Wörter) und mit einem winzigen Beispiel',
  mittel: 'in etwa 130 bis 180 Wörtern und mit einem kleinen Beispiel',
  ausfuehrlich: 'in etwa 230 bis 320 Wörtern, mit Beispiel und einer kurzen Begründung, warum es so ist',
};
const TEMPO = {
  gruendlich: [5, 8, 'sehr kleine Häppchen – lieber eines mehr'],
  normal: [4, 6, 'kleine Häppchen'],
  zuegig: [3, 4, 'etwas größere Häppchen, die trotzdem jeweils nur ein Kernthema haben'],
};
const STANDARD = { ki: 'auto', tempo: 'normal', input: 'mittel', check: 3, schwelle: 75, niveau: 'bachelor', stil: 'professor', erinnern: false };
const INTERVALLE = [1, 3, 7, 16, 35, 90]; // Tage bis zur nächsten Wiederholung je Stufe
const VERTIEFUNG = {
  beispiel: ['Beispiel durchrechnen', 'beispiel', 'Rechne ein vollständiges, typisches Beispiel Schritt für Schritt vor – jeder Schritt mit kurzer Begründung.'],
  einfacher: ['Einfacher', 'einfach', 'Erkläre es noch einmal ganz einfach – wie für jemanden ohne Vorwissen, mit einem anschaulichen Bild.'],
  tiefer: ['Tiefer: Warum gilt das?', 'tiefe', 'Geh in die Tiefe: Herleitung oder Beweisidee, genaue Voraussetzungen, Grenzen (wann gilt es nicht?) und Zusammenhang zu verwandten Begriffen.'],
  analogie: ['Analogie', 'analogie', 'Gib eine treffende Analogie und erkläre genau, wo sie passt und wo sie hinkt.'],
  fehler: ['Typische Fehler', 'warnung', 'Nenne die 3 häufigsten Fehler oder Fehlvorstellungen dazu – je mit kurzem Gegenbeispiel und wie man sie vermeidet.'],
  anwendung: ['Wozu brauche ich das?', 'ziel', 'Zeig, wozu man das braucht: eine realistische Anwendung oder typische Prüfungsaufgabe, und wie genau dieses Wissen dabei hilft.'],
};
const CHAT_VORSCHLAEGE = ['Warum ist das so?', 'Gib mir ein Gegenbeispiel', 'Wie hängt das mit dem Vorigen zusammen?', 'Fass es in einem Satz zusammen'];

function system() {
  const st = STIL[z.einst.stil] || STIL.professor;
  const nv = NIVEAU[z.einst.niveau] || NIVEAU.bachelor;
  return `Du bist Lyra im Plugin „Deep Dive“ – eine persönliche Lehrkraft, die eine Person vollständig und lückenlos durch \
ein Thema führt. ${st[2]} Niveau: ${nv[0]} (${nv[1]}). Schreib auf Deutsch und sprich die Person mit „du“ an. Formeln in \
LaTeX zwischen $…$ (abgesetzt $$…$$). Stütze dich zuerst auf die Auszüge aus ihren Unterlagen – Bezeichnungen, \
Schreibweisen und Definitionen wie dort – und ergänze nur, wo sie lückenhaft sind. Erfinde keine Quellen oder \
Seitenzahlen. Verrate Lösungen von Übungsaufgaben nie ungefragt. Keine Begrüßung, keine Vorrede, keine Wiederholung von \
schon Erklärtem.`;
}

// ================================================================== Schemas (Schlüssel alphabetisch: so schreibt das lokale Modell sie)

const str = { type: 'string' };
const strListe = { type: 'array', items: str };
const zahlListe = { type: 'array', items: { type: 'integer' } };
const objekt = (props) => ({ type: 'object', properties: props, required: Object.keys(props) });
const SCHEMA_PLAN = objekt({
  kurstitel: str,
  schritte: { type: 'array', items: objekt({ bezeichnung: str, inhalte: strListe, ziel: str }) },
  voraussetzungen: strListe,
});
const SCHEMA_HAEPPCHEN = objekt({ haeppchen: { type: 'array', items: objekt({ bezeichnung: str, kern: str, lernziel: { type: 'integer' } }) } });
const SCHEMA_QUIZ = objekt({ art: str, frage: str, optionen: strListe, richtig: zahlListe, warum: str });
const SCHEMA_AUFGABEN = objekt({
  aufgaben: {
    type: 'array',
    items: objekt({ art: { type: 'string', enum: ['auswahl', 'erklaeren', 'loesen', 'beweisen'] }, frage: str, lernziel: { type: 'integer' }, optionen: strListe, richtig: zahlListe, tipp: str, vollstaendige_loesung: str }),
  },
});
const SCHEMA_PRUEFUNG = objekt({
  aufgaben: {
    type: 'array',
    items: objekt({ art: { type: 'string', enum: ['auswahl', 'erklaeren', 'loesen', 'beweisen'] }, frage: str, kapitel: str, optionen: strListe, richtig: zahlListe, vollstaendige_loesung: str }),
  },
});
const SCHEMA_MC = objekt({ fragen: { type: 'array', items: objekt({ frage: str, kapitel: str, optionen: strListe, richtig: zahlListe, thema: str, warum: str }) } });
const SCHEMA_BEWERTUNG = objekt({ begruendung: str, luecke: str, punkte: { type: 'integer' } });
const SCHEMA_GLOSSAR = objekt({ begriffe: { type: 'array', items: objekt({ begriff: str, definition: str }) } });

// ================================================================== Zustand

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  kurse: [],
  geladen: false,
  kurs: null,
  reiter: 'lernen', // uebersicht | lernen | skript | glossar | wiederholen | pruefung
  kapitel: 0,
  hp: 0,
  laeuft: null,
  hinweis: '',
  strom: '',
  fehler: null,
  fehlerBei: null,
  themen: [],
  eingaben: {},
  auswahl: {},
  offeneFrage: '',
  nachOben: false,
  zielOffen: false,
  einstufung: null, // {fragen, gewaehlt: {i: Set}}
  review: null, // {fragen, i, gewaehlt: Set, ergebnisse: []}
  pruefung: null, // {aufgaben, start, ende, minuten, bewertet}
  pruefungAnzahl: 6,
  pruefungMinuten: 0,
  graphit: false,
  glossarSuche: '',
  offenesKapitel: null, // Lernziele in der Leiste aufgeklappt
};
const app = document.getElementById('app');
const inVorbereitung = new Map();
let fusionMaterial = '';
const online = () => z.lehrer !== 'lyra';
const lehrerName = () => (z.info?.lehrer || []).find((l) => l.kennung === z.lehrer)?.name || 'Lyra';
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const ohneNummer = (t) => t.replace(/^\(?([0-9]+|[a-dA-D])[.)]\s+/, '').trim();
const ohnePraefix = (t) => text(t).replace(/^(Kapitel|Schritt|Teil|Häppchen)\s*\d+\s*[:.–-]\s*/i, '');
const meldung = (e) => String((e && e.message) || e);
function kuerzen(t, n) {
  t = String(t || '').trim();
  return t.length <= n ? t : t.slice(0, n).trimEnd() + ' …';
}
const heute = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const tagMs = 86400000;
const woerter = (t) => String(t || '').toLowerCase().split(/[^a-zäöüß0-9]+/).filter((x) => x.length > 3);
function bestesZiel(inhalte, t) {
  const w = woerter(t);
  let best = 0, bw = -1;
  inhalte.forEach((x, j) => { const s = woerter(x).filter((v) => w.includes(v)).length; if (s > bw) { bw = s; best = j; } });
  return best;
}
/** Kapitel einer Frage bestimmen – kleine Modelle zählen Nummern mal ab 0, mal ab 1; darum Titel und Inhalt vergleichen.
 *  → Index des Kapitels, oder -1 für eine Voraussetzung (nur mit `mitVoraussetzung`). */
function kapitelZuordnen(k, wert, inhalt, erlaubt, mitVoraussetzung) {
  const t = text(String(wert ?? ''));
  if (mitVoraussetzung && /voraussetz|vorkenntnis|vorwissen|grundlage/i.test(t)) return -1;
  const ww = woerter(t), wi = woerter(inhalt);
  let best = erlaubt[0], bw = -1;
  for (const i of erlaubt) {
    const s = k.schritte[i];
    const titel = woerter(s.titel), alles = woerter(`${s.titel} ${s.inhalte.join(' ')}`);
    const sc = ww.filter((x) => titel.includes(x)).length * 3 + wi.filter((x) => alles.includes(x)).length;
    if (sc > bw) { bw = sc; best = i; }
  }
  return best;
}

function note(p) {
  for (const [g, n] of [[95, '1,0'], [90, '1,3'], [85, '1,7'], [80, '2,0'], [75, '2,3'], [70, '2,7'], [65, '3,0'], [60, '3,3'], [55, '3,7'], [50, '4,0']]) if (p >= g) return n;
  return '5,0';
}
const dauer = (s) => (s < 3600 ? `${Math.max(1, Math.round(s / 60))} Min.` : `${Math.floor(s / 3600)} Std. ${Math.round((s % 3600) / 60)} Min.`);

const ICONS = {
  zurueck: '<path d="M15 6l-6 6 6 6"/>', pfeil: '<path d="M9 6l6 6-6 6"/>', haken: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', kreuz: '<path d="M6 6l12 12M18 6L6 18"/>',
  buch: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  uebersicht: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  lernen: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  skript: '<path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h4"/>',
  glossar: '<path d="M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM9 7h5M9 11h3"/>',
  wiederholen: '<path d="M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0 0 12.4 2.3M18.5 9A7 7 0 0 0 6.1 6.7"/>',
  pruefung: '<path d="M9 3h6v3H9zM7 5H5v16h14V5h-2"/><path d="M8.5 13l2 2 4-4.5"/>',
  ziel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  uhr: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', flamme: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.3 3 2.5 3 0-3 0-5.5 0-8z"/>',
  beispiel: '<path d="M4 7h16M4 12h10M4 17h7"/><circle cx="18" cy="16" r="3"/>', einfach: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01"/>',
  tiefe: '<path d="M12 3v14M6 11l6 6 6-6M5 21h14"/>', analogie: '<path d="M7 7h10v10H7z" opacity=".4"/><path d="M4 12h3M17 12h3M12 4v3M12 17v3"/>',
  warnung: '<path d="M12 3l10 18H2zM12 10v5M12 18v.01"/>', bild: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  neu: '<path d="M4 4v6h6M5.5 15a7 7 0 1 0 1.6-7.3L4 10"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/>', tipp: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  druck: '<path d="M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>', sichern: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', kopie: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  muell: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', karten: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', lupe: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', stern: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  kappe: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M22 9v6"/>', einstellung: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
};
function ic(name, groesse = 16) {
  const s = h('span', { class: 'ic' });
  s.innerHTML = `<svg viewBox="0 0 24 24" width="${groesse}" height="${groesse}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return s;
}
function ring(anteil, groesse = 44, dicke = 4) {
  const r = 20 - dicke / 2, u = 2 * Math.PI * r;
  const box = h('div', { class: 'dd-ring', style: { width: groesse + 'px', height: groesse + 'px' } });
  box.innerHTML = `<svg viewBox="0 0 40 40" width="${groesse}" height="${groesse}"><circle cx="20" cy="20" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".13" stroke-width="${dicke}"/>
    <circle cx="20" cy="20" r="${r}" fill="none" stroke="var(--dd-akzent)" stroke-width="${dicke}" stroke-linecap="round" stroke-dasharray="${(u * Math.max(0, Math.min(1, anteil))).toFixed(1)} ${u.toFixed(1)}" transform="rotate(-90 20 20)"/></svg>`;
  box.appendChild(h('span', {}, `${Math.round(anteil * 100)}`));
  return box;
}

// ================================================================== Lehrer fragen, suchen, speichern

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
    const r = await lyra.ki({ lehrer: z.lehrer, system: system(), ...auftrag }, sichtbar || z.statusHook ? stueck : null);
    if (r && r.lehrer && r.lehrer !== z.lehrer) z.lehrer = r.lehrer;
    return r;
  } catch (e) {
    const m = meldung(e);
    if (sichtbar && !/ABGEBROCHEN|Abgebrochen/.test(m)) {
      z.fehler = m;
      z.fehlerBei = art;
    }
    if (!sichtbar) z.stillerFehler = m;
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
  else if (e.art === 'text') { z.strom += e.text; z.hinweis = ''; }
  else if (e.art === 'ersetzen') z.strom = e.text;
  if (z.statusHook && e.art === 'hinweis') z.statusHook(e.text);
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
  if (fusionMaterial) return { block: fusionMaterial, quellen: [] };
  try { return await lyra.suchen(suche, anzahl); } catch (_) { return { block: '', quellen: [] }; }
}
const unterlagen = (block) =>
  block ? `Auszüge aus meinen Unterlagen:\n\n${block}\n\n` : 'In meinen Unterlagen steht dazu nichts – stütze dich auf gesichertes Lehrbuchwissen.\n\n';

// ------------------------------------------------------------------ Lernziele, Fortschritt

const zielStatus = (g) => (!g || g.wert === null || g.wert === undefined ? 'offen' : g.wert >= 0.75 ? 'sicher' : g.wert >= 0.5 ? 'unsicher' : 'luecke');
const ZIEL_NAME = { offen: 'noch offen', sicher: 'sicher', unsicher: 'unsicher', luecke: 'Lücke' };
function zielAktualisieren(s, j, x) {
  if (!Number.isInteger(j) || !s.ziele[j]) return;
  const g = s.ziele[j];
  g.wert = g.wert === null || g.wert === undefined ? x : Math.round((0.45 * g.wert + 0.55 * x) * 100) / 100;
  g.n = (g.n || 0) + 1;
}
const alleZiele = (k) => k.schritte.flatMap((s) => s.ziele);
const sichereZiele = (k) => alleZiele(k).filter((g) => zielStatus(g) === 'sicher').length;

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
const fertigKurs = (k) => k.schritte.length > 0 && k.schritte.every((s) => s.stand === 'gemeistert');
const faellig = (k) => k.schritte.map((s, i) => [s, i]).filter(([s]) => s.stand === 'gemeistert' && s.wiederholung && s.wiederholung.faellig <= Date.now()).map(([, i]) => i);
function naechsteWiederholung(k) {
  const t = k.schritte.filter((s) => s.stand === 'gemeistert' && s.wiederholung).map((s) => s.wiederholung.faellig);
  return t.length ? Math.min(...t) : null;
}
function serie(k) {
  const tage = k.tage || {};
  let n = 0;
  const d = new Date();
  if (!(tage[heute()] >= 60)) d.setDate(d.getDate() - 1); // heute noch nicht gelernt: zählt ab gestern
  for (;;) {
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!(tage[s] >= 60)) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
function datumText(ms) {
  const t = Math.round((new Date(new Date(ms).toDateString()) - new Date(new Date().toDateString())) / tagMs);
  if (t <= 0) return 'heute';
  if (t === 1) return 'morgen';
  if (t < 7) return `in ${t} Tagen`;
  return new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

let speicherUhr = null;
async function speichern(k, { leise = false } = {}) {
  k.geaendert = lyra.jetzt();
  k.fortschritt = fortschritt(k);
  try { await lyra.speicher.schreiben('kurse/' + k.id, k); } catch (e) { if (!leise) lyra.toast(meldung(e), 'fehler'); }
  const i = z.kurse.findIndex((x) => x.id === k.id);
  if (i >= 0) z.kurse[i] = k;
  else z.kurse.unshift(k);
  startseite();
  clearTimeout(speicherUhr);
  speicherUhr = setTimeout(erinnerungenSetzen, 1500);
}

/** Auf Lyras Startseite: zuerst fällige Wiederholungen, dann Weiterlernen. */
function startseite() {
  const wdh = z.kurse.filter((k) => faellig(k).length).map((k) => ({
    id: 'wdh-' + k.id,
    titel: `${k.titel}: Wiederholung fällig`,
    untertitel: `${faellig(k).length} Kapitel · etwa 3 Minuten`,
    fortschritt: k.fortschritt || 0,
    route: 'wiederholen/' + k.id,
    geaendert: lyra.jetzt(),
  }));
  const weiter = z.kurse.filter((k) => !fertigKurs(k)).sort((a, b) => b.geaendert - a.geaendert).map((k) => ({
    id: k.id,
    titel: k.titel,
    untertitel: `Kapitel ${Math.min(k.aktuell + 1, k.schritte.length)} von ${k.schritte.length}: ${ohnePraefix(k.schritte[k.aktuell]?.titel || '')}`,
    fortschritt: k.fortschritt || 0,
    route: 'kurs/' + k.id,
    geaendert: k.geaendert,
  }));
  lyra.startseite([...wdh, ...weiter].slice(0, 3)).catch(() => {});
}

/** Erinnerungen an fällige Wiederholungen (9 Uhr am Fälligkeitstag) – nur, wenn du sie eingeschaltet hast. */
async function erinnerungenSetzen() {
  if (!z.einst.erinnern) return;
  const liste = [];
  for (const k of z.kurse) {
    const t = naechsteWiederholung(k);
    if (!t) continue;
    const d = new Date(t);
    d.setHours(9, 0, 0, 0);
    if (d.getTime() < Date.now()) continue;
    liste.push({ id: 'wdh-' + k.id, titel: `Deep Dive: ${k.titel}`, text: 'Zeit für eine kurze Wiederholung – so bleibt es hängen.', zeit: Math.round(d.getTime() / 1000) });
  }
  try { return await lyra.erinnern(liste.slice(0, 40)); } catch (_) { return false; }
}

/** „Monotonie_Bedingung“ → „Monotonie Bedingung“ – aber nur außerhalb von Formeln ($y_n$ bleibt). */
const ohneUnterstrich = (t) => String(t || '').split(/(\$\$[\s\S]*?\$\$|\$[^$]*\$)/).map((teil, i) => (i % 2 ? teil : teil.replace(/([A-Za-zÄÖÜäöüß]{2})_(?=[A-Za-zÄÖÜäöüß]{2})/g, '$1 '))).join('');
/** Gleiches Thema, anders geschrieben („Monotonie-Bedingung“, „Monotonie_Bedingung“) zählt als eines. */
const themaSchluessel = (t) => String(t || '').toLowerCase().replace(/[^a-zäöüß0-9]+/g, ' ').trim();
function schwierigkeit(k, n, thema, notiz) {
  thema = kuerzen(ohneUnterstrich(text(thema)), 90);
  if (!thema) return;
  const d = k.schwierigkeiten.find((x) => x.schritt === n && themaSchluessel(x.thema) === themaSchluessel(thema));
  if (d) { d.anzahl++; d.notiz = kuerzen(notiz, 300); d.geloest = false; }
  else k.schwierigkeiten.push({ schritt: n, thema, notiz: kuerzen(notiz, 300), anzahl: 1, geloest: false });
}
const offeneSchwierigkeiten = (k, nur) => k.schwierigkeiten.filter((d) => !d.geloest && (nur === undefined || d.schritt === nur)).slice(-8).map((d) => `- ${d.thema} (Kapitel ${d.schritt + 1})`).join('\n');
const pfad = (k, n) => k.schritte.map((s, i) => `${i === n ? '→' : s.stand === 'gemeistert' ? '✓' : ' '} ${i + 1}. ${s.titel}`).join('\n');
const zielListe = (s) => s.inhalte.map((x, j) => `${j + 1}. ${x}`).join('\n');

// ------------------------------------------------------------------ Lernzeit (nur, solange du wirklich dabei bist)

let letzteAktivitaet = Date.now();
['pointerdown', 'keydown', 'wheel', 'scroll'].forEach((ev) => document.addEventListener(ev, () => { letzteAktivitaet = Date.now(); }, { passive: true, capture: true }));
let zeitZaehler = 0;
setInterval(() => {
  const k = z.kurs;
  if (!k || document.hidden || Date.now() - letzteAktivitaet > 150000) return;
  k.lernzeit = (k.lernzeit || 0) + 30;
  k.tage = k.tage || {};
  k.tage[heute()] = (k.tage[heute()] || 0) + 30;
  const tage = Object.keys(k.tage).sort();
  if (tage.length > 90) tage.slice(0, tage.length - 90).forEach((t) => delete k.tage[t]);
  if (++zeitZaehler % 4 === 0) speichern(k, { leise: true });
}, 30000);

// ================================================================== Start

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try {
    z.kurse = (await lyra.speicher.liste('kurse')).map((e) => normalisieren(e.wert)).filter(Boolean);
    z.kurse.sort((a, b) => b.geaendert - a.geaendert);
  } catch (_) {}
  try { z.graphit = !!(await lyra.installiert('graphit')); } catch (_) {}
  z.geladen = true;
  lyra.bei('zurueck', zurueck);
  lyra.bei('einstellungen', einstellungenZeigen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('kurs/')) await oeffnen(route.slice(5));
  else if (route.startsWith('wiederholen/')) { await oeffnen(route.slice(12), 'wiederholen'); if (z.kurs) wiederholungStarten(false); }
  else if (route.startsWith('neu?')) { const q = new URLSearchParams(route.slice(4)); z.eingaben.thema = q.get('thema') || ''; z.eingaben.ziel = q.get('ziel') || ''; zeichnen(); }
  else if (route !== 'fusion') zeichnen();
  if (route === 'einstellungen') einstellungenZeigen();
  if (route !== 'fusion') lyra.themen().then((t) => { z.themen = t || []; if (!z.kurs) zeichnen(); }).catch(() => {});
  startseite();
  document.addEventListener('keydown', tasten);
}

function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.laeuft) { lyra.abbrechen(); return; }
  if (z.kurs) {
    if (z.pruefung && !z.pruefung.bewertet) return lyra.toast('Gib die Probeklausur erst ab (oder brich sie ab).');
    if (z.reiter !== 'lernen' && z.reiter !== 'uebersicht') { z.reiter = 'lernen'; return zeichnen(); }
    z.kurs = null;
    z.review = null;
    z.einstufung = null;
    lyra.titel('');
    zeichnen();
  } else lyra.zurueck();
}

/** Tastatur im Lernen: 1–4 wählt, Enter prüft bzw. geht weiter. */
function tasten(e) {
  if (!z.kurs || z.reiter !== 'lernen' || z.laeuft || document.querySelector('.dialog-grund')) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  const s = z.kurs.schritte[z.kapitel];
  const p = s && s.haeppchen[z.hp];
  if (!p || !p.quiz) return;
  const beantwortet = p.ergebnis === true || p.ergebnis === false;
  if (/^[1-6]$/.test(e.key) && !beantwortet) {
    const j = +e.key - 1;
    if (j >= p.quiz.optionen.length) return;
    const g = new Set(z.auswahl[z.hp] || []);
    if (g.has(j)) g.delete(j); else { if (p.quiz.richtig.length < 2) g.clear(); g.add(j); }
    z.auswahl[z.hp] = g;
    zeichnen();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (!beantwortet && (z.auswahl[z.hp] || new Set()).size) pruefen(z.hp);
    else if (beantwortet) naechstes();
  }
}

// ================================================================== Kurs anlegen, Einstufung

async function anlegen() {
  const thema = (z.eingaben.thema || '').trim();
  const ziel = (z.eingaben.ziel || '').trim();
  if (!thema || z.laeuft) return;
  const k = await kursAnlegen(thema, ziel);
  if (!k) return;
  z.eingaben.thema = '';
  z.eingaben.ziel = '';
  z.zielOffen = false;
  await oeffnen(k.id, 'uebersicht');
}

async function kursAnlegen(thema, ziel, { sichtbar = true } = {}) {
  if (sichtbar) { z.laeuft = 'anlegen'; z.hinweis = 'Suche das Thema in deinen Unterlagen …'; zeichnen(); }
  const { block } = await stellen(`${thema} ${ziel}`, online() ? 10 : 6);
  const r = await ki('anlegen', {
    prompt: `Thema, das ich vollständig lernen möchte: ${thema}\n${ziel ? `Mein Ziel: ${ziel}\n` : ''}Niveau: ${NIVEAU[z.einst.niveau][0]}\n\n${unterlagen(block)}\
Erstelle einen Lernpfad, der mir genau dieses Thema vollständig und lückenlos beibringt. Bleib streng beim Thema \
„${thema}“: Auszüge zu anderen Themen ignorierst du. 4 bis 8 Kapitel, die aufeinander aufbauen – zuerst die nötigen \
Grundlagen und Begriffe, dann Schritt für Schritt bis zu den anspruchsvollen Teilen (Sätze und Beweise, Verfahren, \
Anwendungen, typische Aufgaben). Jedes Kapitel: klarer Titel, ein Ziel („Danach kannst du …“) und 2 bis 6 Lernziele in \
"inhalte" – konkret und prüfbar, zusammen alles Wichtige des Kapitels. "voraussetzungen": 2 bis 5 Vorkenntnisse, die \
man für dieses Thema schon können muss (kurz, z. B. „Bruchrechnung“, „Ableitungen“).\n\n\
Antwort als JSON: {"kurstitel": "kurzer Titel des Themas", "schritte": [{"bezeichnung": "Titel des Kapitels", "inhalte": ["…"], "ziel": "Danach kannst du …"}], "voraussetzungen": ["…"]}`,
    schema: SCHEMA_PLAN,
    zaehlen: { schluessel: 'ziel', wort: 'Kapitel' },
  }, sichtbar);
  const v = r && r.json;
  const schritte = ((v && v.schritte) || []).map((s) => neuesKapitel(ohnePraefix(s.bezeichnung || s.titel), text(s.ziel), (s.inhalte || []).map(text).filter(Boolean)))
    .filter((s) => s.titel && s.inhalte.length).slice(0, 10);
  if (!r) return null;
  if (schritte.length < 2) {
    z.fehler = 'Der Lernpfad ist nicht gelungen – bitte noch einmal versuchen oder das Thema genauer angeben.';
    z.fehlerBei = 'anlegen';
    zeichnen();
    return null;
  }
  const k = normalisieren({
    v: 2, id: lyra.neueId(), titel: kuerzen(text(v.kurstitel || v.titel) || thema, 80), thema, ziel,
    erstellt: lyra.jetzt(), geaendert: lyra.jetzt(), ohneUnterlagen: !block, schritte, aktuell: 0, schwierigkeiten: [],
    voraussetzungen: (v.voraussetzungen || []).map((x) => kuerzen(text(x).replace(/[.;]+$/, ''), 70)).filter(Boolean).slice(0, 6), einstufung: null,
  });
  await speichern(k);
  return k;
}

function neuesKapitel(titel, ziel, inhalte) {
  return { titel, ziel, inhalte: inhalte.slice(0, 8), stand: 'offen', haeppchen: [], pos: 0, aufgaben: [], runde: 0, punkte: 0, letzte: 0, ziele: inhalte.slice(0, 8).map(() => ({ wert: null, n: 0 })), zusammenfassung: '', wiederholung: null, vorwissen: false };
}

/** Kurse älterer Fassungen ins neue Format bringen – Gemeistertes und Erklärtes bleiben. */
function normalisieren(k) {
  if (!k || !Array.isArray(k.schritte)) return null;
  // Schwierigkeiten säubern und Doppelte zusammenführen (ältere Fassungen schrieben Themen mit Unterstrich)
  const schwer = [];
  (k.schwierigkeiten || []).forEach((d) => {
    const t = ohneUnterstrich(text(d.thema));
    const da = schwer.find((x) => x.schritt === d.schritt && themaSchluessel(x.thema) === themaSchluessel(t));
    if (da) { da.anzahl += d.anzahl || 1; da.geloest = da.geloest && d.geloest; da.notiz = d.notiz || da.notiz; }
    else schwer.push({ ...d, thema: t });
  });
  k.schwierigkeiten = schwer;
  if (k.ohneUnterlagen === undefined) k.ohneUnterlagen = !!k.ohne_unterlagen;
  k.voraussetzungen = k.voraussetzungen || [];
  k.pruefungen = k.pruefungen || [];
  k.glossar = k.glossar || [];
  k.lernzeit = k.lernzeit || 0;
  k.tage = k.tage || {};
  k.schritte = k.schritte.map((s) => {
    let x = s;
    if (!Array.isArray(s.haeppchen)) {
      // Allererste Fassung (ohne Häppchen): Gemeistertes bleibt gemeistert – mit Lernzielen und Wiederholungsplan
      const gem = s.stand === 'gemeistert';
      const neu = neuesKapitel(ohnePraefix(s.titel), s.ziel || '', s.inhalte || []);
      x = { ...neu, stand: gem ? 'gemeistert' : 'offen', runde: s.runde || 0, punkte: s.punkte || 0, letzte: s.letzte || 0,
        ziele: neu.ziele.map(() => ({ wert: gem ? 0.8 : null, n: 0 })), wiederholung: gem ? { stufe: 0, faellig: Date.now() + tagMs } : null };
    }
    x.inhalte = x.inhalte && x.inhalte.length ? x.inhalte : [x.titel];
    x.ziele = Array.isArray(x.ziele) && x.ziele.length === x.inhalte.length ? x.ziele : x.inhalte.map(() => ({ wert: x.stand === 'gemeistert' ? 0.8 : null, n: 0 }));
    x.zusammenfassung = x.zusammenfassung || '';
    if (x.wiederholung === undefined) x.wiederholung = x.stand === 'gemeistert' ? { stufe: 0, faellig: Date.now() + tagMs } : null;
    x.haeppchen.forEach((p) => {
      p.merke = p.merke || '';
      p.vertiefungen = p.vertiefungen || [];
      p.bilder = p.bilder || [];
      p.rueckfragen = p.rueckfragen || [];
      if (!Number.isInteger(p.lernziel) || !x.inhalte[p.lernziel]) p.lernziel = bestesZiel(x.inhalte, `${p.bezeichnung} ${p.kern}`);
    });
    x.aufgaben.forEach((a) => { a.hinweise = a.hinweise || (a.tippGesehen && a.tipp ? [a.tipp] : []); });
    return x;
  });
  if (k.einstufung === undefined) k.einstufung = k.schritte.some((s) => s.stand !== 'offen') ? { uebersprungen: true } : null;
  k.aktuell = Math.max(0, Math.min(k.aktuell || 0, k.schritte.length - 1));
  // Steht der Zeiger auf einem gemeisterten Kapitel, geht es beim ersten offenen weiter
  if (k.schritte[k.aktuell].stand === 'gemeistert') {
    const offen = k.schritte.findIndex((s) => s.stand !== 'gemeistert');
    if (offen >= 0) k.aktuell = offen;
  }
  k.fortschritt = fortschritt(k);
  return k;
}

async function oeffnen(id, reiter) {
  let k = z.kurse.find((x) => x.id === id);
  if (!k) { try { k = normalisieren(await lyra.speicher.lesen('kurse/' + id)); } catch (_) {} }
  if (!k) return zeichnen();
  z.kurs = k;
  z.kapitel = Math.min(k.aktuell, k.schritte.length - 1);
  const s = k.schritte[z.kapitel];
  z.hp = s.stand === 'check' || s.stand === 'wiederholen' ? s.haeppchen.length : s.pos;
  z.reiter = reiter || (!k.einstufung && k.schritte.every((x) => x.stand === 'offen') ? 'uebersicht' : 'lernen');
  z.fehler = null;
  z.nachOben = true;
  z.review = null;
  z.pruefung = null;
  z.einstufung = null;
  lyra.titel(k.titel);
  zeichnen();
  if (z.reiter === 'lernen') weiter();
}

async function einstufungStarten() {
  const k = z.kurs;
  if (!k || z.laeuft) return;
  const kapitel = k.schritte.slice(0, 6).map((s, i) => `${i + 1}. ${s.titel}: ${s.inhalte.slice(0, 3).join('; ')}`).join('\n');
  const r = await ki('einstufung', {
    prompt: `Ich will „${k.titel}“ lernen. Bevor wir anfangen, möchtest du herausfinden, was ich schon kann.\n\nVoraussetzungen:\n${k.voraussetzungen.map((x, i) => `- ${x}`).join('\n') || '- (keine genannt)'}\n\nKapitel:\n${kapitel}\n\n\
Stelle mir einen kurzen Einstufungstest: je eine Multiple-Choice-Frage zu ${Math.min(3, k.voraussetzungen.length)} \
Voraussetzungen ("kapitel": "Voraussetzung") und zu den ersten ${Math.min(4, k.schritte.length)} Kapiteln ("kapitel": genau der Titel des Kapitels). \
Die Fragen prüfen echtes Verständnis, nicht Begriffe. Je 4 Antwortmöglichkeiten, genau eine richtig (Nummer ab 0 in \
"richtig"), falsche sind typische Fehlvorstellungen. "thema": was die Frage prüft (2–4 Wörter). "warum": 1 Satz Erklärung.\n\n\
Antwort als JSON: {"fragen": [{"frage": "…", "kapitel": "Voraussetzung", "optionen": ["…"], "richtig": [0], "thema": "…", "warum": "…"}]}`,
    schema: SCHEMA_MC,
    zaehlen: { schluessel: 'frage', wort: 'Frage' },
  });
  const fragen = mcBereinigen(r && r.json && r.json.fragen, k, k.schritte.slice(0, 6).map((_, i) => i), true).slice(0, 8);
  if (!r) return;
  if (fragen.length < 2) { z.fehler = 'Der Einstufungstest ist nicht gelungen – bitte noch einmal versuchen.'; z.fehlerBei = 'einstufung'; return zeichnen(); }
  z.einstufung = { fragen, gewaehlt: {} };
  zeichnen();
}

function mcBereinigen(liste, k, erlaubt, mitVoraussetzung) {
  return (liste || []).map((f) => {
    const optionen = (f.optionen || []).map((o) => ohneNummer(text(o))).filter(Boolean).slice(0, 5);
    const richtig = [...new Set((f.richtig || []).filter((x) => Number.isInteger(x) && x >= 0 && x < optionen.length))];
    const kap = kapitelZuordnen(k, f.kapitel, `${f.thema} ${f.frage}`, erlaubt, mitVoraussetzung);
    return { frage: text(f.frage), optionen, richtig: richtig.slice(0, 1), kapitel: kap, thema: ohneUnterstrich(text(f.thema)), warum: text(f.warum) };
  }).filter((f) => f.frage && f.optionen.length >= 2 && f.richtig.length);
}

async function einstufungAuswerten() {
  const k = z.kurs;
  const e = z.einstufung;
  if (!k || !e) return;
  const ergebnisse = e.fragen.map((f, i) => ({ f, ok: (e.gewaehlt[i] ?? -1) === f.richtig[0] }));
  const fehlend = ergebnisse.filter((x) => !x.ok && x.f.kapitel === -1).map((x) => x.f.thema || x.f.frage.slice(0, 60));
  ergebnisse.filter((x) => x.f.kapitel >= 0).forEach((x) => {
    const s = k.schritte[x.f.kapitel];
    if (!s) return;
    if (x.ok) s.vorwissen = true;
    else schwierigkeit(k, x.f.kapitel, x.f.thema || 'Einstufung', 'Im Einstufungstest falsch');
  });
  k.einstufung = { zeit: lyra.jetzt(), richtig: ergebnisse.filter((x) => x.ok).length, gesamt: ergebnisse.length, fehlend };
  if (fehlend.length) {
    // Fehlende Grundlagen als eigenes erstes Kapitel – keine Lücke bleibt offen
    k.schritte.unshift(neuesKapitel('Grundlagen auffrischen', 'Danach sitzen die Vorkenntnisse, auf denen das Thema aufbaut.', fehlend.slice(0, 5)));
    k.schwierigkeiten.forEach((d) => { d.schritt += 1; });
    k.aktuell = 0;
    z.kapitel = 0;
    z.hp = 0;
  }
  z.einstufung = { ...e, fertig: true, ergebnisse };
  await speichern(k);
  zeichnen();
}

async function einstufungUeberspringen() {
  z.kurs.einstufung = { uebersprungen: true };
  z.einstufung = null;
  await speichern(z.kurs);
  zuLernen();
}

function zuLernen() {
  z.reiter = 'lernen';
  z.einstufung = null;
  z.nachOben = true;
  zeichnen();
  weiter();
}

// ================================================================== Lernen: Häppchen

async function weiter() {
  const k = z.kurs;
  if (!k || z.laeuft || z.reiter !== 'lernen') return;
  const n = z.kapitel;
  const s = k.schritte[n];
  if (s.stand === 'gemeistert' && s.haeppchen.length) return zeichnen();
  if (!s.haeppchen.length) { if (!(await planen(n))) return; }
  if (s.stand === 'offen') { s.stand = 'lernen'; await speichern(k); }
  if (s.stand === 'check' || s.stand === 'wiederholen') {
    if (s.stand === 'check' && !s.aufgaben.length) await checkStellen(n);
    return zeichnen();
  }
  const hp = s.haeppchen[z.hp];
  if (!hp) return zeichnen();
  const schluessel = n + ':' + z.hp;
  if (!hp.erklaerung && inVorbereitung.has(schluessel)) {
    z.laeuft = 'erklaeren'; z.strom = ''; z.hinweis = '';
    zeichnen();
    await inVorbereitung.get(schluessel);
    z.laeuft = null;
  }
  if (!hp.erklaerung) { if (!(await erklaeren(n, z.hp, hp.anders))) return; }
  if (!hp.quiz) await quizStellen(n, z.hp);
  zeichnen();
  vorbereiten(n, z.hp + 1);
}

async function planen(n) {
  const k = z.kurs;
  const s = k.schritte[n];
  const [min0, max0, art] = TEMPO[z.einst.tempo] || TEMPO.normal;
  // Wenige Lernziele → wenige Häppchen (ein kurzes Auffrisch-Kapitel braucht keine sechs)
  const min = Math.min(min0, Math.max(2, s.inhalte.length * 2));
  const max = Math.min(max0, Math.max(min, s.inhalte.length * 2 + 1));
  const { block } = await stellen(`${k.thema} ${s.titel} ${s.inhalte.join(', ')}`, online() ? 8 : 5);
  const r = await ki('planen', {
    prompt: `Lernpfad zu „${k.titel}“:\n${pfad(k, n)}\n\nKapitel ${n + 1}: ${s.titel}\nZiel: ${s.ziel}\nLernziele:\n${zielListe(s)}\n\n${unterlagen(block)}\
Teile dieses Kapitel in ${min} bis ${max} Lernhäppchen auf (${art}), die ich nacheinander lerne. Jedes Häppchen behandelt \
genau eine Idee – einen Begriff, eine Aussage, einen Rechenschritt oder ein Beispiel – und baut auf den vorigen auf, vom \
Einfachen zum Schweren. "lernziel" ist die Nummer des Lernziels oben, zu dem das Häppchen gehört. Zusammen müssen die \
Häppchen ALLE Lernziele vollständig abdecken – jedes Lernziel mindestens ein Häppchen. Nichts, was nicht zu diesen \
Lernzielen gehört: Die übrigen Kapitel des Lernpfads kommen später.\n\n\
Antwort als JSON: {"haeppchen": [{"bezeichnung": "kurzer Titel", "kern": "was genau in diesem Häppchen erklärt wird (ein Satz)", "lernziel": 1}]}`,
    schema: SCHEMA_HAEPPCHEN,
    zaehlen: { schluessel: 'kern', wort: 'Häppchen' },
  });
  let liste = ((r && r.json && r.json.haeppchen) || []).map((p) => {
    const b = ohnePraefix(p.bezeichnung);
    const lz = Math.round(Number(p.lernziel)) - 1;
    return neuesHaeppchen(b, text(p.kern), Number.isInteger(lz) && s.inhalte[lz] ? lz : bestesZiel(s.inhalte, `${b} ${p.kern}`));
  }).filter((p) => p.bezeichnung).slice(0, 10);
  if (!r) return false;
  if (!liste.length) {
    z.fehler = 'Die Häppchen sind nicht gelungen – bitte noch einmal versuchen.';
    z.fehlerBei = 'planen';
    zeichnen();
    return false;
  }
  // Lückenlos: Lernziele ohne Häppchen bekommen eines
  s.inhalte.forEach((inh, j) => { if (!liste.some((p) => p.lernziel === j)) liste.push(neuesHaeppchen(kuerzen(inh, 70), inh, j)); });
  liste = liste.map((p, i) => [p, i]).sort((a, b) => a[0].lernziel - b[0].lernziel || a[1] - b[1]).map(([p]) => p);
  s.haeppchen = liste;
  s.pos = 0;
  z.hp = 0;
  await speichern(k);
  return true;
}

const neuesHaeppchen = (bezeichnung, kern, lernziel) => ({ bezeichnung, kern, lernziel, erklaerung: '', merke: '', quiz: null, ergebnis: null, erster: null, rueckfragen: [], quellen: [], vertiefungen: [], bilder: [] });

function erklaerAuftrag(k, n, i, block, anders) {
  const s = k.schritte[n];
  const p = s.haeppchen[i];
  const vorher = s.haeppchen.slice(0, i).map((x) => x.bezeichnung).join('; ');
  const danach = s.haeppchen.slice(i + 1).map((x) => x.bezeichnung).join('; ');
  const schwer = offeneSchwierigkeiten(k, n);
  return `Thema „${k.titel}“ – Kapitel ${n + 1} „${s.titel}“ – Häppchen ${i + 1} von ${s.haeppchen.length}: ${p.bezeichnung}\n\
Worum es geht: ${p.kern}\nLernziel: ${s.inhalte[p.lernziel] || s.ziel}\n${vorher ? `Schon gelernt: ${vorher}\n` : ''}${danach ? `Kommt danach (noch nicht erklären): ${danach}\n` : ''}\
${schwer ? `Damit hatte ich Schwierigkeiten:\n${schwer}\n` : ''}${anders ? 'Beim ersten Mal hat es nicht geklappt – erkläre es diesmal anders: andere Herangehensweise, anderes Beispiel.\n' : ''}\n\
${unterlagen(block)}Erkläre mir NUR dieses eine Häppchen ${LAENGE[z.einst.input] || LAENGE.mittel}. Klar und anschaulich, \
Formeln in LaTeX. Keine Überschrift, keine Einleitung, kein Ausblick, keine Übungsaufgabe – eine Frage dazu kommt gleich \
separat. Schließe mit einer eigenen letzten Zeile „Merke: …“ – der eine Satz, den ich mir unbedingt merken soll.`;
}

/** „Merke: …“ am Ende abtrennen – kommt als eigener Kasten. */
function merkeTrennen(t) {
  const m = String(t || '').match(/\n\s*(?:[>*_]\s*)*(?:\*\*)?Merke(?:satz)?\s*:?\s*(?:\*\*)?\s*:?\s*([\s\S]+?)\s*$/i);
  if (!m || m[1].length > 500) return { erklaerung: String(t || '').trim(), merke: '' };
  return { erklaerung: t.slice(0, m.index).trim(), merke: m[1].replace(/\*\*/g, '').replace(/^[„"]|[“"]$/g, '').trim() };
}

async function erklaeren(n, i, anders = false) {
  const k = z.kurs;
  const p = k.schritte[n].haeppchen[i];
  const { block, quellen } = await stellen(`${k.thema} ${k.schritte[n].titel} ${p.bezeichnung} ${p.kern}`, online() ? 6 : 4);
  const r = await ki('erklaeren', { prompt: erklaerAuftrag(k, n, i, block, anders) });
  if (!r || !r.text.trim()) return false;
  Object.assign(p, merkeTrennen(r.text));
  p.quellen = quellen;
  p.anders = false;
  await speichern(k);
  return true;
}

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
      Object.assign(p, merkeTrennen(r.text));
      p.quellen = quellen;
      p.anders = false;
      await speichern(k, { leise: true });
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
  const s = k.schritte[n];
  const p = s.haeppchen[i];
  const g = [...(z.auswahl[i] || [])].sort();
  if (!g.length || !p.quiz) return;
  const ok = g.length === p.quiz.richtig.length && g.every((x, j) => x === p.quiz.richtig[j]);
  p.gewaehlt = g;
  p.ergebnis = ok;
  if (p.erster === null || p.erster === undefined) { p.erster = ok; zielAktualisieren(s, p.lernziel, ok ? 1 : 0.25); }
  else zielAktualisieren(s, p.lernziel, ok ? 0.65 : 0.2);
  if (!ok) schwierigkeit(k, n, p.bezeichnung, `Frage falsch beantwortet: ${p.quiz.frage}`);
  await speichern(k);
  zeichnen();
}

async function naechstes() {
  const k = z.kurs;
  const s = k.schritte[z.kapitel];
  const j = s.haeppchen.findIndex((p, x) => x > z.hp && (p.ergebnis === null || p.ergebnis === undefined));
  const k2 = j >= 0 ? j : s.haeppchen.findIndex((p) => p.ergebnis === null || p.ergebnis === undefined);
  if (k2 >= 0) { s.pos = k2; z.hp = k2; }
  else { s.stand = 'check'; s.aufgaben = []; z.hp = s.haeppchen.length; }
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
  if (await erklaeren(z.kapitel, i, true)) { p.quiz = null; await quizStellen(z.kapitel, i); }
  zeichnen();
}

/** Lehrer-Werkzeuge: Beispiel, einfacher, tiefer, Analogie, typische Fehler, Anwendung. */
async function vertiefen(i, art) {
  const k = z.kurs;
  const n = z.kapitel;
  const p = k.schritte[n].haeppchen[i];
  if (z.laeuft || !VERTIEFUNG[art]) return;
  z.offeneVertiefung = art;
  const r = await ki('vertiefen:' + art, {
    prompt: `Thema „${k.titel}“ – Kapitel ${n + 1} „${k.schritte[n].titel}“ – Häppchen „${p.bezeichnung}“: ${p.kern}\n\nDeine Erklärung:\n${p.erklaerung}\n\n\
${VERTIEFUNG[art][2]} Bleib genau bei diesem Häppchen. Keine Überschrift, keine Vorrede, Formeln in LaTeX.`,
  });
  z.offeneVertiefung = null;
  if (!r || !r.text.trim()) return zeichnen();
  p.vertiefungen = [...p.vertiefungen.filter((v) => v.art !== art), { art, text: r.text.trim() }];
  await speichern(k);
  zeichnen();
}

async function schaubild(i) {
  const k = z.kurs;
  const p = k.schritte[z.kapitel].haeppchen[i];
  if (z.laeuft) return;
  z.laeuft = 'schaubild';
  z.hinweis = 'Graphit zeichnet ein Schaubild …';
  zeichnen();
  try {
    const r = await lyra.werkzeug('graphit', `${p.bezeichnung}: ${p.kern}\n(Schaubild zum Lernen, Thema „${k.titel}“. Kontext: ${kuerzen(p.erklaerung, 500)})`,
      (e) => { if (e.art === 'hinweis') { z.hinweis = `Graphit: ${e.text}`; const hw = document.getElementById('hinweis'); if (hw) hw.textContent = z.hinweis; } }, z.lehrer);
    let src = '';
    if (r && r.svg && r.svg.length < 400000) src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg);
    else if (r && r.png) src = r.png.startsWith('data:') ? r.png : 'data:image/png;base64,' + r.png;
    if (!src || src.length > 700000) throw new Error('Graphit hat kein passendes Schaubild geliefert.');
    p.bilder = [{ titel: text(r.titel) || p.bezeichnung, src }];
    await speichern(k);
  } catch (e) {
    if (!/ABGEBROCHEN|Abgebrochen/.test(meldung(e))) { z.fehler = meldung(e); z.fehlerBei = 'schaubild'; }
  }
  z.laeuft = null;
  zeichnen();
}

async function rueckfrage(i, vorgabe) {
  const k = z.kurs;
  const n = z.kapitel;
  const p = k.schritte[n].haeppchen[i];
  const f = (vorgabe || z.eingaben['frage' + i] || '').trim();
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
  if (r && r.text.trim()) { p.rueckfragen.push([f, r.text.trim()]); await speichern(k); }
  zeichnen();
}

// ================================================================== Kapitel-Check

async function checkStellen(n) {
  const k = z.kurs;
  const s = k.schritte[n];
  const anzahl = Math.max(2, Math.min(5, z.einst.check || 3));
  const { block } = await stellen(`${k.thema} ${s.titel} ${s.inhalte.join(', ')}`, online() ? 8 : 5);
  const schwer = offeneSchwierigkeiten(k, n);
  const schwach = s.inhalte.map((x, j) => [x, j]).filter(([, j]) => ['luecke', 'unsicher'].includes(zielStatus(s.ziele[j]))).map(([x, j]) => `${j + 1}. ${x}`);
  const r = await ki('check', {
    prompt: `Lernpfad zu „${k.titel}“:\n${pfad(k, n)}\n\nKapitel ${n + 1}: ${s.titel}\nZiel: ${s.ziel}\nLernziele:\n${zielListe(s)}\n\
Gelernte Häppchen: ${s.haeppchen.map((p) => p.bezeichnung).join('; ')}\n\n\
${s.runde > 0 ? `Das ist meine ${s.runde + 1}. Runde – stelle neue Aufgaben.\n` : ''}${schwach.length ? `Besonders prüfen (hier hakt es noch):\n${schwach.join('\n')}\n` : ''}${schwer ? `Schwierigkeiten bisher:\n${schwer}\n` : ''}\n\
${unterlagen(block)}Bleib streng bei diesem Kapitel: Auszüge zu anderen Themen ignorierst du.\n\
Stelle mir zum Abschluss des Kapitels genau ${anzahl} Aufgaben, die prüfen, ob ich es wirklich \
verstanden habe – von leicht nach schwer, gemischt, und so verteilt, dass möglichst alle Lernziele vorkommen ("lernziel" = Nummer oben):\n\
- "auswahl": Multiple Choice mit 4 Antwortmöglichkeiten, eine oder mehrere richtig (Nummern ab 0 in "richtig")\n\
- "erklaeren": etwas in eigenen Worten erklären oder begründen\n\
- "loesen": etwas berechnen, anwenden oder ein Verfahren durchführen\n\
- "beweisen": eine Aussage zeigen oder beweisen (nur, wenn das Thema das hergibt)\n\
Mindestens eine offene Aufgabe. Bei offenen Aufgaben bleiben "optionen" und "richtig" leer. "tipp" ist ein Denkanstoß, \
der die Lösung nicht verrät. "vollstaendige_loesung" ist die Musterlösung mit Weg – ich sehe sie erst, wenn ich sie \
ausdrücklich aufrufe, schreib sie aber vollständig aus.\n\n\
Antwort als JSON: {"aufgaben": [{"art": "auswahl", "frage": "…", "lernziel": 1, "optionen": ["…"], "richtig": [0], "tipp": "…", "vollstaendige_loesung": "…"}]}`,
    schema: SCHEMA_AUFGABEN,
    zaehlen: { schluessel: 'frage', wort: 'Aufgabe' },
  });
  const liste = aufgabenBereinigen(r && r.json && r.json.aufgaben, (a) => {
    const lz = Math.round(Number(a.lernziel)) - 1;
    return Number.isInteger(lz) && s.inhalte[lz] ? lz : bestesZiel(s.inhalte, a.frage);
  }).slice(0, anzahl + 1);
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

function aufgabenBereinigen(roh, zuordnen) {
  return (roh || []).map((a) => {
    let art = ['auswahl', 'erklaeren', 'loesen', 'beweisen'].includes(a.art) ? a.art : 'erklaeren';
    const optionen = (a.optionen || []).map((o) => ohneNummer(text(o))).filter(Boolean);
    const richtig = [...new Set((a.richtig || []).filter((x) => Number.isInteger(x) && x >= 0 && x < optionen.length))].sort();
    if (art === 'auswahl' && (optionen.length < 2 || !richtig.length)) art = 'erklaeren';
    return {
      art, frage: text(a.frage), lernziel: zuordnen(a), kapitel: -1, kapitelRoh: a.kapitel,
      optionen: art === 'auswahl' ? optionen : [], richtig: art === 'auswahl' ? richtig : [],
      tipp: text(a.tipp), loesung: text(a.vollstaendige_loesung || a.loesung),
      antwort: '', gewaehlt: [], bewertet: false, punkte: 0, rueckmeldung: '', luecke: '', hinweise: [], aufgeloest: false,
    };
  }).filter((a) => a.frage);
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
  const luecken = s.ziele.map((g, j) => (zielStatus(g) === 'luecke' ? j : -1)).filter((j) => j >= 0);
  s.lueckenBeiAbschluss = luecken;
  if (p * 100 >= (z.einst.schwelle || 75) && !luecken.length) {
    s.stand = 'gemeistert';
    s.gemeistertAm = lyra.jetzt();
    s.wiederholung = { stufe: 0, faellig: Date.now() + INTERVALLE[0] * tagMs };
    k.schwierigkeiten.filter((d) => d.schritt === n).forEach((d) => (d.geloest = true));
    const i = k.schritte.findIndex((x, j) => j > n && x.stand !== 'gemeistert');
    const j = i >= 0 ? i : k.schritte.findIndex((x) => x.stand !== 'gemeistert');
    k.aktuell = j >= 0 ? j : n;
    glossarErgaenzen(n, false);
  } else {
    s.stand = 'wiederholen';
  }
}

async function auswahlPruefen(i) {
  const k = z.kurs;
  const n = z.kapitel;
  const s = k.schritte[n];
  const a = s.aufgaben[i];
  const g = [...(z.auswahl['a' + i] || [])].sort();
  if (!g.length || a.bewertet) return;
  const treffer = g.filter((x) => a.richtig.includes(x)).length;
  const falsch = g.length - treffer;
  const genau = g.length === a.richtig.length && g.every((x, j) => x === a.richtig[j]);
  a.punkte = genau ? 1 : Math.max(0, Math.min(0.9, (treffer - falsch) / a.richtig.length));
  a.punkte = Math.max(0, a.punkte - 0.1 * a.hinweise.length);
  a.gewaehlt = g;
  a.bewertet = true;
  a.rueckmeldung = genau ? 'Richtig!' : a.punkte > 0 ? 'Teilweise richtig.' : 'Leider nicht richtig.';
  zielAktualisieren(s, a.lernziel, a.punkte);
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
  const v = await bewerten(k, s.titel, a, antwort, 'abgeben:' + i);
  if (!v) return;
  zielAktualisieren(s, a.lernziel, a.punkte);
  if (a.punkte < 0.7) schwierigkeit(k, n, a.luecke || a.frage, a.rueckmeldung);
  rundePruefen(k, n);
  await speichern(k);
  zeichnen();
}

/** Offene Antwort bewerten (Check und Probeklausur). */
async function bewerten(k, kapitelTitel, a, antwort, art, sichtbar = true) {
  const name = a.art === 'loesen' ? 'lösen' : a.art === 'beweisen' ? 'beweisen' : 'erklären';
  const r = await ki(art, {
    prompt: `Thema: ${k.titel} – ${kapitelTitel}\n\nAufgabe (${name}): ${a.frage}\n\nMusterlösung (nur für dich, nicht verraten): \
${a.loesung || '(keine – prüfe selbst sorgfältig)'}\n\nMeine Antwort:\n${antwort}\n\n${a.hinweise.length ? `Ich habe ${a.hinweise.length} Hinweis(e) genutzt.\n\n` : ''}\
Bewerte meine Antwort fair, aber genau wie ein guter Prüfer – nur, was wirklich dasteht. Maßstab für die Punkte (0 bis \
100): 100 vollständig und korrekt; 70 bis 90 im Kern richtig mit kleinen Lücken; 40 bis 60 richtiger Ansatz, aber \
Wesentliches fehlt; 10 bis 30 nur ansatzweise; 0 falsch oder leer. Fehlt etwas, das die Aufgabe ausdrücklich verlangt, \
höchstens 50. Andere korrekte Wege zählen voll. In "begruendung" sprichst du mich direkt an: zuerst, was gut ist, dann \
konkret, was fehlt oder falsch ist und warum. In "luecke" nennst du in wenigen Wörtern das Konzept, das mir noch fehlt \
(leer, wenn nichts fehlt).\n\nAntwort als JSON: {"begruendung": "…", "luecke": "…", "punkte": 0}`,
    schema: SCHEMA_BEWERTUNG,
  }, sichtbar);
  const v = r && r.json;
  if (!v) return null;
  a.antwort = antwort;
  a.punkte = Math.max(0, Math.min(1, (Number(v.punkte) || 0) / 100 - 0.1 * a.hinweise.length));
  a.rueckmeldung = text(v.begruendung || v.rueckmeldung);
  a.luecke = text(v.luecke);
  a.bewertet = true;
  return v;
}

/** Gestufte Hinweise: Denkanstoß → Ansatz → erster Schritt. Jeder kostet 10 Prozentpunkte. */
async function hinweisGeben(i) {
  const k = z.kurs;
  const s = k.schritte[z.kapitel];
  const a = s.aufgaben[i];
  if (z.laeuft || a.hinweise.length >= 3) return;
  if (!a.hinweise.length && a.tipp) { a.hinweise.push(a.tipp); await speichern(k); return zeichnen(); }
  const stufe = a.hinweise.length + 1;
  const r = await ki('hinweis:' + i, {
    prompt: `Aufgabe: ${a.frage}\n\nMusterlösung (nur für dich, NICHT verraten): ${a.loesung || '(keine)'}\n\n${a.hinweise.length ? `Bisherige Hinweise:\n${a.hinweise.map((x, j) => `${j + 1}. ${x}`).join('\n')}\n\n` : ''}\
${(z.eingaben['antwort' + i] || '').trim() ? `Mein bisheriger Versuch:\n${z.eingaben['antwort' + i]}\n\n` : ''}\
Gib mir Hinweis Stufe ${stufe} von 3 – ${stufe === 1 ? 'ein Denkanstoß, der in die richtige Richtung lenkt' : stufe === 2 ? 'nenne den Ansatz bzw. die Methode, mit der man die Aufgabe löst' : 'mach den ersten konkreten Schritt vor und sag, wie es danach weitergeht'}. \
Höchstens 3 Sätze. Verrate nicht die ganze Lösung.`,
  });
  if (r && r.text.trim()) { a.hinweise.push(r.text.trim()); await speichern(k); }
  zeichnen();
}

async function loesungZeigen(i) {
  const k = z.kurs;
  const n = z.kapitel;
  const s = k.schritte[n];
  const a = s.aufgaben[i];
  if (z.laeuft) return;
  if (!a.bewertet) {
    const ok = await lyra.bestaetigen({ titel: 'Lösung zeigen?', text: 'Versuch es ruhig erst selbst – ein Hinweis hilft oft schon weiter. Wenn du die Lösung jetzt ansiehst, zählt die Aufgabe in dieser Runde als nicht gelöst.', ja: 'Lösung zeigen', nein: 'Lieber selbst versuchen' });
    if (!ok) return;
    a.bewertet = true;
    a.punkte = 0;
    a.rueckmeldung = 'Lösung angesehen – zählt in dieser Runde als nicht gelöst.';
    zielAktualisieren(s, a.lernziel, 0.2);
    schwierigkeit(k, n, a.frage, 'Lösung angesehen');
    rundePruefen(k, n);
  }
  a.aufgeloest = true;
  if (!a.loesung) {
    const r = await ki('loesung:' + i, {
      prompt: `Thema: ${k.titel} – Kapitel ${n + 1}: ${s.titel}\n\nAufgabe: ${a.frage}\n\n${a.antwort ? `Meine Antwort war:\n${a.antwort}\n\n` : ''}\
Schreib eine vollständige Musterlösung mit Weg und Begründung – verständlich, Schritt für Schritt. Schließe mit „**Ergebnis:**“.`,
    });
    if (r) a.loesung = r.text.trim();
  }
  await speichern(k);
  zeichnen();
}

/** Nach einer schwachen Runde: gezielt die Lernziele mit Lücken neu erklären, dann ein neuer Check. */
async function wiederholen(nurZiel) {
  const k = z.kurs;
  const n = z.kapitel;
  const s = k.schritte[n];
  const schwacheZiele = nurZiel !== undefined ? [nurZiel] : s.ziele.map((g, j) => (['luecke', 'unsicher'].includes(zielStatus(g)) ? j : -1)).filter((j) => j >= 0);
  let ziel = s.haeppchen.map((p, i) => (schwacheZiele.includes(p.lernziel) ? i : -1)).filter((i) => i >= 0);
  if (!ziel.length) ziel = s.haeppchen.map((p, i) => (p.erster === false ? i : -1)).filter((i) => i >= 0);
  if (!ziel.length) ziel = s.haeppchen.map((_, i) => i);
  ziel.forEach((i) => Object.assign(s.haeppchen[i], { erklaerung: '', merke: '', quiz: null, ergebnis: null, erster: null, anders: true, vertiefungen: [] }));
  s.aufgaben = [];
  s.stand = 'lernen';
  s.pos = ziel[0];
  z.hp = ziel[0];
  z.nachOben = true;
  z.reiter = 'lernen';
  await speichern(k);
  zeichnen();
  weiter();
}

async function gezieltUeben(n, j) {
  if (z.laeuft) return;
  const k = z.kurs;
  z.kapitel = n;
  k.aktuell = n;
  const s = k.schritte[n];
  if (!s.haeppchen.length) { z.reiter = 'lernen'; z.hp = 0; zeichnen(); return weiter(); }
  if (s.stand === 'gemeistert') s.stand = 'lernen';
  await wiederholen(j);
}

async function neuerCheck() {
  const s = z.kurs.schritte[z.kapitel];
  s.aufgaben = [];
  s.stand = 'check';
  z.hp = s.haeppchen.length;
  await speichern(z.kurs);
  zeichnen();
  weiter();
}

/** Bei erkanntem Vorwissen: Häppchen überspringen und gleich den Check machen. */
async function direktZumCheck(n) {
  const k = z.kurs;
  const s = k.schritte[n];
  if (!s.haeppchen.length && !(await planen(n))) return;
  s.stand = 'check';
  s.aufgaben = [];
  z.hp = s.haeppchen.length;
  await speichern(k);
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
  z.reiter = 'lernen';
  speichern(z.kurs);
  zeichnen();
  weiter();
}

// ================================================================== Wiederholen (verteilt über Tage)

async function wiederholungStarten(frei) {
  const k = z.kurs;
  if (!k || z.laeuft) return;
  let kapitel = frei ? [] : faellig(k);
  if (!kapitel.length) {
    kapitel = k.schritte.map((s, i) => [s, i]).filter(([s]) => s.stand === 'gemeistert' || s.haeppchen.some((p) => p.erklaerung))
      .sort((a, b) => ((a[0].wiederholung || {}).faellig || 0) - ((b[0].wiederholung || {}).faellig || 0)).map(([, i]) => i);
  }
  kapitel = kapitel.slice(0, 3);
  if (!kapitel.length) return lyra.toast('Noch nichts zum Wiederholen – lerne erst ein Kapitel.');
  z.reiter = 'wiederholen';
  const inhalt = kapitel.map((i) => {
    const s = k.schritte[i];
    const merke = s.haeppchen.filter((p) => p.merke).map((p) => `- ${p.merke}`).slice(0, 8).join('\n');
    return `Kapitel ${i + 1}: ${s.titel}\nLernziele: ${s.inhalte.join('; ')}${merke ? `\nMerksätze:\n${merke}` : ''}`;
  }).join('\n\n');
  const je = kapitel.length === 1 ? 4 : 2;
  const r = await ki('wiederholung', {
    prompt: `Ich wiederhole „${k.titel}“ nach einigen Tagen Pause:\n\n${inhalt}\n\n${offeneSchwierigkeiten(k) ? `Früher hatte ich Schwierigkeiten mit:\n${offeneSchwierigkeiten(k)}\n\n` : ''}\
Stelle mir je ${je} kurze Multiple-Choice-Fragen pro Kapitel (in "kapitel" genau der Titel des Kapitels), die das Wichtigste \
abrufen – Verständnis statt Auswendiglernen, abwechslungsreich. Je 4 Antwortmöglichkeiten, genau eine richtig (Nummer ab \
0 in "richtig"). "thema" in 2–4 Wörtern, "warum" 1 Satz Erklärung.\n\n\
Antwort als JSON: {"fragen": [{"frage": "…", "kapitel": "${k.schritte[kapitel[0]].titel.replace(/"/g, '')}", "optionen": ["…"], "richtig": [0], "thema": "…", "warum": "…"}]}`,
    schema: SCHEMA_MC,
    zaehlen: { schluessel: 'frage', wort: 'Frage' },
  });
  const fragen = mcBereinigen(r && r.json && r.json.fragen, k, kapitel, false).slice(0, 8);
  if (!r) return;
  if (!fragen.length) { z.fehler = 'Die Wiederholung ist nicht gelungen – bitte noch einmal versuchen.'; z.fehlerBei = 'wiederholung'; return zeichnen(); }
  z.review = { kapitel, fragen, i: 0, gewaehlt: null, ergebnisse: [] };
  zeichnen();
}

function reviewAntwort(j) {
  const r = z.review;
  if (!r || r.gewaehlt !== null) return;
  r.gewaehlt = j;
  r.ergebnisse[r.i] = j === r.fragen[r.i].richtig[0];
  zeichnen();
}

async function reviewWeiter() {
  const r = z.review;
  if (!r) return;
  if (r.i < r.fragen.length - 1) { r.i++; r.gewaehlt = null; return zeichnen(); }
  // Auswertung je Kapitel → Wiederholungsplan anpassen
  const k = z.kurs;
  r.kapitel.forEach((n) => {
    const s = k.schritte[n];
    const ids = r.fragen.map((f, i) => (f.kapitel === n ? i : -1)).filter((i) => i >= 0);
    if (!ids.length) return;
    const anteil = ids.filter((i) => r.ergebnisse[i]).length / ids.length;
    const w = s.wiederholung || { stufe: 0, faellig: 0 };
    if (anteil >= 0.75) w.stufe = Math.min(INTERVALLE.length - 1, w.stufe + 1);
    else w.stufe = Math.max(0, w.stufe - 1);
    w.faellig = Date.now() + (anteil >= 0.75 ? INTERVALLE[w.stufe] : 1) * tagMs;
    w.zuletzt = Math.round(anteil * 100);
    if (s.stand === 'gemeistert') s.wiederholung = w;
    ids.filter((i) => !r.ergebnisse[i]).forEach((i) => schwierigkeit(k, n, r.fragen[i].thema || r.fragen[i].frage, 'Bei der Wiederholung falsch'));
  });
  r.fertig = true;
  await speichern(k);
  zeichnen();
}

// ================================================================== Probeklausur

async function pruefungStarten() {
  const k = z.kurs;
  if (!k || z.laeuft) return;
  const gelernt = k.schritte.map((s, i) => [s, i]).filter(([s]) => s.stand !== 'offen');
  // Erst ab zwei begonnenen Kapiteln nur das Gelernte – sonst der ganze Kurs
  const kapitel = gelernt.length >= 2 ? gelernt : k.schritte.map((s, i) => [s, i]);
  const anzahl = z.pruefungAnzahl;
  // Nur der Stoff des Kurses – Suchauszüge können andere Fächer enthalten und die Klausur verwässern
  const stoff = kapitel.map(([s, i]) => {
    const merke = s.haeppchen.filter((p) => p.merke).map((p) => `  - ${p.merke}`).slice(0, 6).join('\n');
    return `${i + 1}. ${s.titel}\n  Lernziele: ${s.inhalte.join('; ')}${merke ? `\n  Merksätze:\n${merke}` : ''}`;
  }).join('\n');
  const r = await ki('pruefung', {
    prompt: `Probeklausur zu „${k.titel}“ (Niveau ${NIVEAU[z.einst.niveau][0]}).\n\nStoff der Klausur:\n${stoff}\n\n\
WICHTIG: Jede Aufgabe gehört zu einem dieser Kapitel von „${k.titel}“ – keine Aufgaben zu anderen Themen oder Fächern.\n\
Stelle eine realistische Probeklausur mit genau ${anzahl} Aufgaben wie in einer echten Prüfung – über die Kapitel verteilt \
("kapitel" = genau der Titel des Kapitels), von leicht nach schwer, gemischt: "auswahl" (4 Antwortmöglichkeiten, eine oder mehrere richtig, \
Nummern ab 0 in "richtig"), "erklaeren", "loesen", "beweisen" (nur, wo das Thema es hergibt). Mindestens die Hälfte offene \
Aufgaben. Bei offenen Aufgaben bleiben "optionen" und "richtig" leer. "vollstaendige_loesung" ist die Musterlösung mit Weg.\n\n\
Antwort als JSON: {"aufgaben": [{"art": "loesen", "frage": "…", "kapitel": "Titel des Kapitels", "optionen": [], "richtig": [], "vollstaendige_loesung": "…"}]}`,
    schema: SCHEMA_PRUEFUNG,
    zaehlen: { schluessel: 'frage', wort: 'Aufgabe' },
  });
  const erlaubt = kapitel.map(([, i]) => i);
  const roh = (r && r.json && r.json.aufgaben) || [];
  const aufgaben = aufgabenBereinigen(roh, () => null).map((a) => ({ ...a, kapitel: kapitelZuordnen(k, a.kapitelRoh, a.frage, erlaubt, false) })).slice(0, anzahl + 2);
  if (!r) return;
  if (aufgaben.length < 2) { z.fehler = 'Die Probeklausur ist nicht gelungen – bitte noch einmal versuchen.'; z.fehlerBei = 'pruefung'; return zeichnen(); }
  z.pruefung = { id: lyra.neueId(), aufgaben, start: Date.now(), minuten: z.pruefungMinuten, ende: z.pruefungMinuten ? Date.now() + z.pruefungMinuten * 60000 : 0, bewertet: false };
  Object.keys(z.eingaben).filter((x) => x.startsWith('pr')).forEach((x) => delete z.eingaben[x]);
  Object.keys(z.auswahl).filter((x) => String(x).startsWith('pr')).forEach((x) => delete z.auswahl[x]);
  zeichnen();
}

setInterval(() => {
  const p = z.pruefung;
  if (!p || p.bewertet || !p.ende) return;
  const rest = p.ende - Date.now();
  const el = document.getElementById('dd-timer');
  if (el) el.textContent = rest > 0 ? `${Math.floor(rest / 60000)}:${String(Math.floor((rest % 60000) / 1000)).padStart(2, '0')}` : '0:00';
  if (rest <= 0 && !z.laeuft && !p.abgabe) { lyra.toast('Die Zeit ist um – deine Klausur wird abgegeben.'); pruefungAbgeben(true); }
}, 1000);

async function pruefungAbgeben(zeitUm = false) {
  const k = z.kurs;
  const p = z.pruefung;
  if (!p || p.bewertet || p.abgabe) return;
  const leer = p.aufgaben.filter((a, i) => (a.art === 'auswahl' ? !(z.auswahl['pr' + i] || new Set()).size : !(z.eingaben['pr' + i] || '').trim())).length;
  if (!zeitUm && leer && !(await lyra.bestaetigen({ titel: 'Abgeben?', text: `${leer} Aufgabe${leer === 1 ? ' ist' : 'n sind'} noch leer und zählen dann 0 Punkte.`, ja: 'Abgeben' }))) return;
  p.abgabe = Date.now();
  z.laeuft = 'korrektur';
  z.hinweis = 'Die Klausur wird korrigiert …';
  zeichnen();
  for (let i = 0; i < p.aufgaben.length; i++) {
    const a = p.aufgaben[i];
    if (a.art === 'auswahl') {
      const g = [...(z.auswahl['pr' + i] || [])].sort();
      const treffer = g.filter((x) => a.richtig.includes(x)).length;
      a.gewaehlt = g;
      a.punkte = g.length === a.richtig.length && treffer === a.richtig.length ? 1 : Math.max(0, (treffer - (g.length - treffer)) / a.richtig.length * 0.9);
      a.bewertet = true;
    } else {
      const antwort = (z.eingaben['pr' + i] || '').trim();
      if (!antwort) { Object.assign(a, { antwort: '', punkte: 0, bewertet: true, rueckmeldung: 'Keine Antwort abgegeben.' }); continue; }
      const hw = document.getElementById('hinweis');
      if (hw) hw.textContent = `Korrigiere Aufgabe ${i + 1} von ${p.aufgaben.length} …`;
      const v = await bewerten(k, `Kapitel ${a.kapitel + 1}: ${k.schritte[a.kapitel].titel}`, a, antwort, 'korrektur-' + i, false);
      if (!v) Object.assign(a, { antwort, punkte: 0, bewertet: true, rueckmeldung: 'Konnte nicht automatisch korrigiert werden – vergleiche mit der Musterlösung.' });
    }
  }
  const prozent = Math.round((p.aufgaben.reduce((s, a) => s + a.punkte, 0) / p.aufgaben.length) * 100);
  p.prozent = prozent;
  p.note = note(prozent);
  // Je Kapitel auswerten; Schwaches kommt früher zur Wiederholung
  const jeKapitel = {};
  p.aufgaben.forEach((a) => { (jeKapitel[a.kapitel] = jeKapitel[a.kapitel] || []).push(a.punkte); if (a.punkte < 0.5) schwierigkeit(k, a.kapitel, a.luecke || a.frage, 'In der Probeklausur nicht gelöst'); });
  p.kapitel = Object.entries(jeKapitel).map(([n, w]) => ({ n: +n, prozent: Math.round((w.reduce((s, x) => s + x, 0) / w.length) * 100) }));
  p.kapitel.forEach(({ n, prozent: pr }) => { const s = k.schritte[n]; if (s && s.stand === 'gemeistert' && pr < 60 && s.wiederholung) s.wiederholung.faellig = Date.now(); });
  z.laeuft = null;
  const r = await ki('bericht', {
    prompt: `Probeklausur zu „${k.titel}“: ${prozent} % (Note ${p.note}).\n\n${p.aufgaben.map((a, i) => `Aufgabe ${i + 1} (Kapitel ${a.kapitel + 1}, ${a.art}): ${Math.round(a.punkte * 100)} %\n${kuerzen(a.frage, 200)}${a.luecke ? `\nLücke: ${a.luecke}` : ''}`).join('\n\n')}\n\n\
Schreib mir als meine Prüferin einen kurzen Prüfungsbericht in Markdown: „**Gesamteindruck**“ (2 Sätze), „**Das sitzt**“ \
(Stichpunkte), „**Hier fehlt noch etwas**“ (Stichpunkte, konkret), „**Mein Plan für dich**“ (3 konkrete nächste Schritte). Ehrlich und ermutigend.`,
  });
  p.bericht = r && r.text ? r.text.trim() : '';
  p.bewertet = true;
  k.pruefungen = [{ id: p.id, zeit: lyra.jetzt(), prozent, note: p.note, anzahl: p.aufgaben.length, minuten: Math.round((p.abgabe - p.start) / 60000), kapitel: p.kapitel, bericht: p.bericht }, ...k.pruefungen].slice(0, 12);
  await speichern(k);
  z.nachOben = true;
  zeichnen();
}

// ================================================================== Glossar, Skript

async function glossarErgaenzen(n, sichtbar = true) {
  const k = z.kurs;
  const s = k && k.schritte[n];
  if (!s || !s.haeppchen.some((p) => p.erklaerung)) return;
  const inhalt = s.haeppchen.filter((p) => p.erklaerung).map((p) => `### ${p.bezeichnung}\n${kuerzen(p.erklaerung, online() ? 1500 : 600)}${p.merke ? `\nMerke: ${p.merke}` : ''}`).join('\n\n');
  const r = await ki('glossar', {
    prompt: `Kapitel ${n + 1} „${s.titel}“ aus „${k.titel}“:\n\n${inhalt}\n\nSchreib die wichtigsten Fachbegriffe dieses Kapitels als Glossar (3 bis 8): "begriff" und eine präzise, \
eigenständig verständliche "definition" in 1–2 Sätzen (Formeln in LaTeX).\n\nAntwort als JSON: {"begriffe": [{"begriff": "…", "definition": "…"}]}`,
    schema: SCHEMA_GLOSSAR,
  }, sichtbar);
  const neu = ((r && r.json && r.json.begriffe) || []).map((b) => ({ begriff: text(b.begriff), definition: text(b.definition), kapitel: n })).filter((b) => b.begriff && b.definition);
  if (!neu.length) return;
  neu.forEach((b) => {
    const i = k.glossar.findIndex((x) => x.begriff.toLowerCase() === b.begriff.toLowerCase());
    if (i >= 0) k.glossar[i] = b; else k.glossar.push(b);
  });
  await speichern(k, { leise: !sichtbar });
  if (sichtbar || z.reiter === 'glossar') zeichnen();
}

async function zusammenfassungen() {
  const k = z.kurs;
  for (const [s, n] of k.schritte.map((s, n) => [s, n])) {
    if (s.zusammenfassung || !s.haeppchen.some((p) => p.erklaerung)) continue;
    const r = await ki('zusammenfassung', {
      prompt: `Kapitel ${n + 1} „${s.titel}“ aus „${k.titel}“ – Lernziele: ${s.inhalte.join('; ')}\n\n${s.haeppchen.filter((p) => p.erklaerung).map((p) => `### ${p.bezeichnung}\n${kuerzen(p.erklaerung, online() ? 1800 : 700)}`).join('\n\n')}\n\n\
Fasse das Kapitel für mein Skript zusammen: 4 bis 7 Stichpunkte mit den Kernaussagen (Definitionen, Sätze, Verfahren), \
dazu die wichtigsten Formeln. Nur Markdown-Stichpunkte, keine Überschrift.`,
    });
    if (!r) break;
    s.zusammenfassung = r.text.trim();
    await speichern(k);
  }
  zeichnen();
}

function skriptMarkdown(k) {
  const z1 = [`# ${k.titel}`, '', k.ziel ? `_Ziel: ${k.ziel}_` : '', ''];
  k.schritte.forEach((s, n) => {
    const erklaert = s.haeppchen.filter((p) => p.erklaerung);
    if (!erklaert.length && !s.zusammenfassung) return;
    z1.push(`## ${n + 1}. ${s.titel}`, '', s.ziel ? `_${s.ziel}_` : '', '');
    if (s.zusammenfassung) z1.push('**Auf einen Blick**', '', s.zusammenfassung, '');
    erklaert.forEach((p) => {
      z1.push(`### ${p.bezeichnung}`, '', p.erklaerung, '');
      if (p.merke) z1.push(`> **Merke:** ${p.merke}`, '');
      p.vertiefungen.forEach((v) => z1.push(`#### ${VERTIEFUNG[v.art] ? VERTIEFUNG[v.art][0] : 'Vertiefung'}`, '', v.text, ''));
    });
  });
  if (k.glossar.length) {
    z1.push('## Glossar', '');
    k.glossar.slice().sort((a, b) => a.begriff.localeCompare(b.begriff, 'de')).forEach((b) => z1.push(`- **${b.begriff}:** ${b.definition}`));
  }
  z1.push('', '---', '_Erstellt mit Deep Dive in Lyra._');
  return z1.join('\n');
}

async function loeschen(k) {
  if (!(await lyra.bestaetigen({ titel: `„${k.titel}“ löschen?`, text: 'Lernpfad, Erklärungen, Fortschritt, Wiederholungsplan und Prüfungen werden endgültig gelöscht.', ja: 'Löschen', gefahr: true }))) return;
  try { await lyra.speicher.loeschen('kurse/' + k.id); } catch (_) {}
  z.kurse = z.kurse.filter((x) => x.id !== k.id);
  startseite();
  erinnerungenSetzen();
  zeichnen();
}

async function mitFlip(k) {
  const schwer = k.schwierigkeiten.map((d) => d.thema).slice(0, 8).join('; ');
  const wunsch = `Wiederholen, was ich im Deep Dive zu „${k.titel}“ gelernt habe – die wichtigsten Begriffe, Sätze und Verfahren${schwer ? `, besonders: ${schwer}` : ''}`;
  const ok = await lyra.plugin('flip', `neu?thema=${encodeURIComponent(k.titel)}&wunsch=${encodeURIComponent(wunsch)}`);
  if (!ok) await lyra.dialog('Flip ist nicht installiert', h('p', {}, 'Installiere Flip im Plugin-Center, dann kannst du das Gelernte mit Karteikarten festigen.'));
}

// ================================================================== Einstellungen

async function einstellungSetzen(schl, wert) {
  z.einst[schl] = wert;
  try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {}
  zeichnen();
}

async function einstellungenZeigen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const wahl = (schluessel, optionen) => {
    const box = h('div', { class: 'dd-wahl' });
    const malen = () => box.replaceChildren(...optionen.map(([wert, name, unter]) =>
      h('button', { class: 'dd-wahl-knopf' + (e[schluessel] === wert ? ' an' : ''), onclick: () => { e[schluessel] = wert; malen(); } }, h('div', { class: 'fett' }, name), unter ? h('div', { class: 'dd-mini' }, unter) : null)));
    malen();
    return box;
  };
  const zeile = (titel, erkl, inhalt) => h('div', { class: 'dd-einst' }, h('div', { class: 'fett' }, titel), erkl ? h('div', { class: 'dd-mini', style: { margin: '2px 0 8px' } }, erkl) : null, inhalt);
  const erinnern = lyra.schalter({ wert: e.erinnern, text: 'An Wiederholungen erinnern', unter: 'Mitteilung von macOS am Tag, an dem eine Wiederholung fällig ist (9 Uhr)', beiWahl: (w) => { e.erinnern = w; } });
  const inhalt = h('div', { class: 'dd-einst-liste' },
    zeile('Deine Lehrkraft', '', wahl('stil', Object.entries(STIL).map(([k, v]) => [k, v[0], v[1]]))),
    zeile('Niveau', '', wahl('niveau', Object.entries(NIVEAU).map(([k, v]) => [k, v[0], v[1]]))),
    zeile('Tempo', 'Wie groß die Häppchen sind – alle Lernziele werden trotzdem vollständig durchgenommen.', wahl('tempo', [['gruendlich', 'Gründlich'], ['normal', 'Normal'], ['zuegig', 'Zügig']])),
    zeile('Erklärungen', 'Wie viel Text vor jeder Frage kommt.', wahl('input', [['kurz', 'Kurz'], ['mittel', 'Mittel'], ['ausfuehrlich', 'Ausführlich']])),
    zeile('Kapitel-Check', 'So viele Aufgaben prüfen am Kapitelende, ob es sitzt.', wahl('check', [[2, '2 Aufgaben'], [3, '3 Aufgaben'], [4, '4 Aufgaben'], [5, '5 Aufgaben']])),
    zeile('Gemeistert ab', 'Dazu darf kein Lernziel mehr eine Lücke haben.', wahl('schwelle', [[60, '60 %'], [70, '70 %'], [75, '75 %'], [80, '80 %'], [90, '90 %']])),
    zeile('Wer unterrichtet', 'Automatisch: Claude bzw. ChatGPT, wenn verbunden (gründlicher, braucht Internet) – sonst Lyra lokal.', wahl('ki', [['auto', 'Automatisch'], ['lyra', 'Immer Lyra (lokal)']])),
    erinnern,
    h('div', { class: 'dd-mini', style: { marginTop: '10px' } }, '🔒 Lösungen gibt es nur, wenn du sie aufrufst. Deine Kurse liegen nur auf deinem Mac.'));
  const ok = await lyra.dialog('Deep Dive – Einstellungen', inhalt, [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Sichern', wert: true }]);
  if (!ok) return;
  z.einst = e;
  if (e.ki === 'lyra') z.lehrer = 'lyra';
  else if (z.lehrer === 'lyra' && z.info.standardLehrer) z.lehrer = z.info.standardLehrer;
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
  if (e.erinnern) { const ok2 = await erinnerungenSetzen(); if (ok2 === false) lyra.toast('Erinnerungen kommen nur, wenn Lyra Mitteilungen senden darf.', 'fehler'); }
  else lyra.erinnern([]).catch(() => {});
  zeichnen();
}

// ================================================================== Ansicht: Grundbausteine

function standardHinweis() {
  const n = lehrerName();
  const l = String(z.laeuft || '');
  return {
    anlegen: 'Der Lernpfad wird geplant …', planen: 'Das Kapitel wird in Häppchen aufgeteilt …', erklaeren: `${n} erklärt …`,
    quiz: 'Die Verständnisfrage wird vorbereitet …', rueckfrage: `${n} antwortet …`, check: 'Der Kapitel-Check wird vorbereitet …',
    einstufung: 'Der Einstufungstest wird vorbereitet …', wiederholung: 'Die Wiederholung wird vorbereitet …', pruefung: 'Die Probeklausur wird erstellt …',
    korrektur: 'Die Klausur wird korrigiert …', bericht: 'Der Prüfungsbericht wird geschrieben …', glossar: 'Das Glossar wird ergänzt …',
    zusammenfassung: 'Die Zusammenfassungen werden geschrieben …', schaubild: 'Graphit zeichnet …',
  }[l] || (l.startsWith('abgeben') ? `${n} sieht sich deine Antwort an …` : l.startsWith('hinweis') ? 'Der nächste Hinweis kommt …' : l.startsWith('vertiefen') ? `${n} vertieft …` : `${n} schreibt …`);
}

function laufZeile() {
  return h('div', { class: 'dd-lauf' }, h('div', { class: 'lade' }), h('span', { class: 'wachsen', id: 'hinweis' }, z.hinweis || standardHinweis()),
    h('button', { class: 'knopf text klein', onclick: () => lyra.abbrechen() }, 'Abbrechen'));
}

function nochmal(art) {
  z.fehler = null;
  const nr = +String(art).split(':')[1];
  if (art === 'anlegen') return anlegen();
  if (art === 'quiz') return quizStellen(z.kapitel, z.hp, true).then(zeichnen);
  if (art === 'check') return neuerCheck();
  if (art === 'rueckfrage') return rueckfrage(z.hp);
  if (art === 'einstufung') return einstufungStarten();
  if (art === 'wiederholung') return wiederholungStarten(false);
  if (art === 'pruefung') return pruefungStarten();
  if (art === 'schaubild') return schaubild(z.hp);
  if (String(art).startsWith('abgeben:')) return abgeben(nr);
  if (String(art).startsWith('loesung:')) return loesungZeigen(nr);
  if (String(art).startsWith('hinweis:')) return hinweisGeben(nr);
  if (String(art).startsWith('vertiefen:')) return vertiefen(z.hp, String(art).split(':')[1]);
  zeichnen();
  return weiter();
}

function fehlerZeile(art) {
  if (z.fehlerBei !== art || !z.fehler) return null;
  return h('div', { style: { marginTop: '12px' } }, lyra.fehlerBox(z.fehler,
    online() ? () => { z.lehrer = 'lyra'; z.fehler = null; zeichnen(); nochmal(art); } : null,
    () => { z.fehler = null; zeichnen(); },
    () => nochmal(art)));
}

function feld(name, e) {
  return h(e.zeilen ? 'textarea' : 'input', {
    class: 'eingabe' + (e.klasse ? ' ' + e.klasse : ''), 'data-feld': name, placeholder: e.platzhalter, rows: e.zeilen, spellcheck: e.zeilen ? 'true' : null,
    disabled: !!z.laeuft && !e.immer, value: z.eingaben[name] || '',
    oninput: (ev) => { z.eingaben[name] = ev.target.value; },
    onkeydown: (ev) => { if (ev.key === 'Enter' && (!e.zeilen || ev.metaKey) && e.beiEnter) { ev.preventDefault(); e.beiEnter(); } },
  });
}

let letzterOrt = '';
function zeichnen() {
  if (lyra.fusion.aktiv()) return;
  const aktiv = document.activeElement;
  const name = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const auswahl = name ? [aktiv.selectionStart, aktiv.selectionEnd] : null;
  const alt = document.querySelector('[data-scroll="haupt"]');
  const pos = alt ? alt.scrollTop : 0;
  const leiste = document.querySelector('[data-scroll="leiste"]');
  const posLeiste = leiste ? leiste.scrollTop : 0;
  const ort = `${z.kurs ? z.kurs.id : ''}|${z.reiter}|${z.kapitel}|${z.hp}`;
  if (ort !== letzterOrt) { z.nachOben = true; letzterOrt = ort; }
  app.replaceChildren(z.kurs ? kursAnsicht() : bibliothek());
  if (name) {
    const e = document.querySelector(`[data-feld="${name}"]`);
    if (e && !e.disabled) { e.focus(); try { e.setSelectionRange(auswahl[0], auswahl[1]); } catch (_) {} }
  }
  const neu = document.querySelector('[data-scroll="haupt"]');
  if (neu) neu.scrollTop = z.nachOben ? 0 : pos;
  const neuL = document.querySelector('[data-scroll="leiste"]');
  if (neuL) neuL.scrollTop = posLeiste;
  z.nachOben = false;
}

function kursFarbe(t) {
  let x = 0;
  for (const c of String(t)) x = (x * 31 + c.charCodeAt(0)) % 360;
  return [(x + 180) % 360, 195 + (x % 40)];
}

// ================================================================== Ansicht: Bibliothek (Start)

function bibliothek() {
  const laufend = z.kurse.filter((k) => !fertigKurs(k));
  const gemeistert = z.kurse.filter(fertigKurs);
  const wdh = z.kurse.filter((k) => faellig(k).length);
  const pille = (titel, wert, optionen, schl) => lyra.auswahl({ titel, wert, optionen, beiWahl: (w) => einstellungSetzen(schl, w) });
  const zielZeile = z.zielOffen || z.eingaben.ziel
    ? h('div', { class: 'dd-zielzeile' }, ic('ziel', 15), feld('ziel', { platzhalter: 'Dein Ziel – z. B. „Klausur in drei Wochen“ oder „Beweise selbst führen können“', beiEnter: anlegen, immer: true }))
    : null;
  return h('div', { class: 'dd-bib', 'data-scroll': 'haupt' },
    h('div', { class: 'dd-held' },
      h('div', { class: 'dd-held-inhalt' },
        h('div', { class: 'dd-eyebrow' }, ic('lernen', 14), 'Deep Dive · dein persönlicher Professor'),
        h('h1', {}, 'Was willst du wirklich verstehen?'),
        h('p', {}, 'Nenne ein Thema aus deinen Unterlagen. Deep Dive prüft dein Vorwissen, plant einen lückenlosen Lernpfad, erklärt Schritt für Schritt, stellt Fragen, korrigiert deine Lösungen und begleitet dich bis zur Prüfung.'),
        lyra.verfasser({
          wert: z.eingaben.thema || '', feld: 'thema', zeilen: 1,
          platzhalter: 'Thema, z. B. Eigenwerte, Vollständige Induktion, Thermodynamik …',
          beiEingabe: (v) => { z.eingaben.thema = v; },
          beiSenden: (v) => { z.eingaben.thema = v; anlegen(); },
          knopf: 'Lernpfad erstellen', deaktiviert: !!z.laeuft,
          unten: [
            z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
            pille('Lehrkraft', z.einst.stil, Object.entries(STIL).map(([k, v]) => [k, v[0], v[1]]), 'stil'),
            pille('Niveau', z.einst.niveau, Object.entries(NIVEAU).map(([k, v]) => [k, v[0], v[1]]), 'niveau'),
            pille('Tempo', z.einst.tempo, [['gruendlich', 'Gründlich', 'Sehr kleine Häppchen'], ['normal', 'Normal', 'Kleine Häppchen'], ['zuegig', 'Zügig', 'Größere Häppchen']], 'tempo'),
            !zielZeile ? h('button', { class: 'ly-pille', onclick: () => { z.zielOffen = true; zeichnen(); setTimeout(() => { const f = document.querySelector('[data-feld="ziel"]'); if (f) f.focus(); }); } }, '＋ Ziel') : null,
          ],
        }),
        zielZeile,
        z.themen.length && !z.laeuft ? h('div', { style: { marginTop: '12px' } }, lyra.vorschlaege(z.themen, (t) => { z.eingaben.thema = t; zeichnen(); const f = document.querySelector('[data-feld="thema"]'); if (f) f.focus(); }, { titel: 'Aus deinen Unterlagen:', max: 6 })) : null,
        z.laeuft === 'anlegen' ? h('div', { style: { marginTop: '14px' } }, lyra.arbeit(z.hinweis || standardHinweis(), { id: 'hinweis' })) : null,
        fehlerZeile('anlegen'))),
    h('div', { class: 'dd-bib-inhalt' },
      wdh.length ? h('section', { class: 'dd-abschnitt' },
        h('div', { class: 'dd-abschnitt-kopf' }, ic('wiederholen', 16), h('h2', {}, 'Heute wiederholen'), h('span', { class: 'dd-mini' }, 'Kurz abrufen, damit es dauerhaft sitzt')),
        h('div', { class: 'dd-wdh-liste' }, wdh.map((k) => h('button', { class: 'dd-wdh', onclick: async () => { await oeffnen(k.id, 'wiederholen'); wiederholungStarten(false); } },
          h('div', { class: 'dd-wdh-symbol' }, ic('wiederholen', 18)),
          h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, k.titel), h('div', { class: 'dd-mini' }, `${faellig(k).length} Kapitel fällig · etwa 3 Minuten`)),
          ic('pfeil', 16))))) : null,
      laufend.length ? h('section', { class: 'dd-abschnitt' },
        h('div', { class: 'dd-abschnitt-kopf' }, ic('lernen', 16), h('h2', {}, 'Weiterlernen')),
        h('div', { class: 'dd-karten' }, laufend.map(kursKarte))) : null,
      gemeistert.length ? h('section', { class: 'dd-abschnitt' },
        h('div', { class: 'dd-abschnitt-kopf' }, ic('stern', 16), h('h2', {}, 'Gemeistert')),
        h('div', { class: 'dd-karten' }, gemeistert.map(kursKarte))) : null,
      !z.kurse.length ? h('section', { class: 'dd-features' }, [
        ['ziel', 'Einstufung', 'Prüft dein Vorwissen und ergänzt fehlende Grundlagen'],
        ['lernen', 'Lückenloser Lernpfad', 'Jedes Lernziel wird erklärt, abgefragt und geprüft'],
        ['tiefe', 'Lehrer-Werkzeuge', 'Beispiel, einfacher, tiefer, Analogie, typische Fehler, Schaubild'],
        ['tipp', 'Gestufte Hinweise', 'Erst ein Denkanstoß, dann der Ansatz – die Lösung nur auf Wunsch'],
        ['wiederholen', 'Wiederholungsplan', 'Nach 1, 3, 7, 16 Tagen – damit es dauerhaft bleibt'],
        ['pruefung', 'Probeklausur', 'Mit Zeitlimit, Note und Prüfungsbericht'],
        ['skript', 'Skript & Glossar', 'Merksätze, Zusammenfassungen, zum Drucken'],
        ['uhr', 'Lernzeit & Serie', 'Sieh, wie viel du schon geschafft hast'],
      ].map(([i, t, u]) => h('div', { class: 'dd-feature' }, h('div', { class: 'dd-feature-symbol' }, ic(i, 18)), h('div', { class: 'fett' }, t), h('div', { class: 'dd-mini' }, u)))) : null,
      h('div', { class: 'dd-mini dd-fuss' }, online()
        ? `${lehrerName()} unterrichtet über dein Abo (braucht Internet, Lyra fragt vorher). Lösungen gibt es nur, wenn du sie aufrufst.`
        : '🔒 Lyra unterrichtet lokal – nichts verlässt deinen Mac. Lösungen gibt es nur, wenn du sie aufrufst.')));
}

function kursKarte(k) {
  const [farbe1, farbe2] = kursFarbe(k.titel);
  const fertig = fertigKurs(k);
  const gem = k.schritte.filter((s) => s.stand === 'gemeistert').length;
  const ziele = alleZiele(k).length;
  const naechste = naechsteWiederholung(k);
  const s = k.schritte[Math.min(k.aktuell || 0, k.schritte.length - 1)];
  return h('div', { class: 'dd-karte', tabindex: 0, onclick: () => oeffnen(k.id), onkeydown: (e) => { if (e.key === 'Enter') oeffnen(k.id); } },
    h('div', { class: 'dd-karte-band', style: { background: `linear-gradient(120deg, hsl(${farbe1} 70% 45%), hsl(${farbe2} 75% 55%))` } },
      h('div', { class: 'dd-karte-band-text' }, fertig ? 'Gemeistert' : `Kapitel ${(k.aktuell || 0) + 1} von ${k.schritte.length}`),
      ring(k.fortschritt || 0, 46, 4)),
    h('div', { class: 'dd-karte-inhalt' },
      h('div', { class: 'dd-karte-titel' }, k.titel),
      h('div', { class: 'dd-mini eine-zeile' }, fertig ? `Alle ${k.schritte.length} Kapitel gemeistert` : `Als Nächstes: ${s ? s.titel : ''}`),
      h('div', { class: 'dd-karte-meta' },
        h('span', {}, ic('ziel', 13), `${sichereZiele(k)}/${ziele} Lernziele`),
        k.lernzeit ? h('span', {}, ic('uhr', 13), dauer(k.lernzeit)) : null,
        naechste ? h('span', { class: naechste <= Date.now() ? 'dd-faellig' : '' }, ic('wiederholen', 13), datumText(naechste)) : null,
        h('span', {}, `${gem}/${k.schritte.length} Kapitel`))),
    h('div', { class: 'dd-karte-aktionen' },
      h('button', { class: 'knopf symbol', title: 'Mit Flip festigen', onclick: (e) => { e.stopPropagation(); mitFlip(k); } }, ic('karten', 15)),
      h('button', { class: 'knopf symbol', title: 'Löschen', onclick: (e) => { e.stopPropagation(); loeschen(k); } }, ic('muell', 15))));
}

// ================================================================== Ansicht: Kurs

function kursAnsicht() {
  const k = z.kurs;
  const inhalt = z.reiter === 'uebersicht' ? kursUebersicht(k)
    : z.reiter === 'skript' ? skriptAnsicht(k)
      : z.reiter === 'glossar' ? glossarAnsicht(k)
        : z.reiter === 'wiederholen' ? wiederholenAnsicht(k)
          : z.reiter === 'pruefung' ? pruefungAnsicht(k)
            : lernenAnsicht(k);
  return h('div', { class: 'dd-kurs' }, leiste(k), h('main', { class: 'dd-haupt', 'data-scroll': 'haupt' }, inhalt));
}

function leiste(k) {
  const gem = k.schritte.filter((s) => s.stand === 'gemeistert').length;
  const anzahlFaellig = faellig(k).length;
  const nav = [
    ['uebersicht', 'Übersicht', 'uebersicht'], ['lernen', 'Lernen', 'lernen'], ['skript', 'Skript', 'skript'],
    ['glossar', 'Glossar', 'glossar', k.glossar.length || null], ['wiederholen', 'Wiederholen', 'wiederholen', anzahlFaellig || null], ['pruefung', 'Probeklausur', 'pruefung'],
  ];
  return h('aside', { class: 'dd-leiste' },
    h('button', { class: 'dd-zurueck', onclick: () => { if (z.pruefung && !z.pruefung.bewertet) return lyra.toast('Gib die Probeklausur erst ab.'); if (z.laeuft) lyra.abbrechen(); z.kurs = null; z.review = null; z.einstufung = null; lyra.titel(''); zeichnen(); } }, ic('zurueck', 15), 'Alle Kurse'),
    h('div', { class: 'dd-leiste-kopf' },
      ring(k.fortschritt || 0, 54, 4.5),
      h('div', { class: 'wachsen' }, h('div', { class: 'dd-leiste-titel' }, k.titel), h('div', { class: 'dd-mini' }, `${gem} von ${k.schritte.length} Kapiteln · ${sichereZiele(k)}/${alleZiele(k).length} Lernziele sicher`))),
    h('nav', { class: 'dd-nav' }, nav.map(([w, n, i, zahl]) => h('button', {
      class: z.reiter === w ? 'an' : '',
      onclick: () => {
        if (z.pruefung && !z.pruefung.bewertet && w !== 'pruefung') return lyra.toast('Gib die Probeklausur erst ab.');
        if (z.laeuft && w !== z.reiter) lyra.abbrechen();
        z.reiter = w; z.fehler = null; zeichnen();
        if (w === 'lernen') weiter();
      },
    }, ic(i, 16), h('span', { class: 'wachsen' }, n), zahl ? h('span', { class: 'dd-zahl' + (w === 'wiederholen' ? ' warm' : '') }, String(zahl)) : null))),
    h('div', { class: 'dd-label' }, 'Lernpfad'),
    h('div', { class: 'dd-pfad', 'data-scroll': 'leiste' }, k.schritte.map((s, i) => {
      const offen = z.offenesKapitel === i || (z.offenesKapitel === null && i === z.kapitel);
      return h('div', { class: `dd-kap ${s.stand} ${i === z.kapitel && z.reiter === 'lernen' ? 'aktiv' : ''}` },
        h('div', { class: 'dd-kap-kopf', onclick: () => kapitelWaehlen(i) },
          h('div', { class: 'dd-kap-nr' }, s.stand === 'gemeistert' ? ic('haken', 12) : String(i + 1)),
          h('div', { class: 'wachsen' }, h('div', { class: 'dd-kap-titel' }, s.titel),
            s.haeppchen.length ? h('div', { class: 'dd-punkte' }, s.haeppchen.map((p, j) => h('span', { class: 'dd-punkt ' + (p.ergebnis === true ? 'ok' : p.ergebnis === false ? 'falsch' : i === z.kapitel && j === z.hp ? 'jetzt' : '') }))) : null),
          h('button', { class: 'dd-kap-auf', title: 'Lernziele', onclick: (e) => { e.stopPropagation(); z.offenesKapitel = offen ? -1 : i; zeichnen(); } }, offen ? '▾' : '▸')),
        offen ? h('div', { class: 'dd-ziele' }, s.inhalte.map((x, j) => h('div', { class: 'dd-ziel ' + zielStatus(s.ziele[j]), title: ZIEL_NAME[zielStatus(s.ziele[j])] }, h('span', { class: 'dd-ziel-punkt' }), h('span', {}, x)))) : null);
    })),
    h('div', { class: 'dd-leiste-fuss' }, z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; z.fehler = null; zeichnen(); }) : null));
}

// ------------------------------------------------------------------ Kurs: Übersicht

function kpi(wert, name, unter, symbol) {
  return h('div', { class: 'dd-kpi' }, h('div', { class: 'dd-kpi-kopf' }, ic(symbol, 14), name), h('div', { class: 'dd-kpi-wert' }, wert), unter ? h('div', { class: 'dd-mini' }, unter) : null);
}

function kursUebersicht(k) {
  const naechste = naechsteWiederholung(k);
  const s = k.schritte[k.aktuell] || k.schritte[0];
  const offen = k.schwierigkeiten.filter((d) => !d.geloest);
  const zielGesamt = alleZiele(k).length;
  const tage = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * tagMs); const s1 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; tage.push([d, (k.tage || {})[s1] || 0]); }
  const maxTag = Math.max(600, ...tage.map(([, x]) => x));
  return h('div', { class: 'dd-seite' },
    h('div', { class: 'dd-eyebrow' }, 'Kursübersicht'),
    h('h1', { class: 'dd-titel' }, k.titel),
    k.ziel ? h('p', { class: 'dd-unter' }, ic('ziel', 14), k.ziel) : null,
    h('div', { class: 'dd-kpis' },
      kpi(`${Math.round((k.fortschritt || 0) * 100)} %`, 'Fortschritt', `${k.schritte.filter((x) => x.stand === 'gemeistert').length} von ${k.schritte.length} Kapiteln`, 'lernen'),
      kpi(`${sichereZiele(k)}/${zielGesamt}`, 'Lernziele sicher', alleZiele(k).some((g) => zielStatus(g) === 'luecke') ? `${alleZiele(k).filter((g) => zielStatus(g) === 'luecke').length} Lücken offen` : 'keine Lücken offen', 'ziel'),
      kpi(k.lernzeit ? dauer(k.lernzeit) : '–', 'Lernzeit', serie(k) ? `${serie(k) === 1 ? '1 Tag' : `${serie(k)} Tage`} in Folge 🔥` : 'heute noch nicht gelernt', 'uhr'),
      kpi(naechste ? datumText(naechste) : '–', 'Nächste Wiederholung', naechste ? `${faellig(k).length} Kapitel fällig` : 'nach dem ersten gemeisterten Kapitel', 'wiederholen')),
    !k.einstufung || z.einstufung ? einstufungKarte(k) : null,
    k.einstufung && !z.einstufung ? h('div', { class: 'dd-cta' },
      h('div', { class: 'wachsen' }, h('div', { class: 'dd-label' }, fertigKurs(k) ? 'Geschafft' : `Weiter mit Kapitel ${k.aktuell + 1}`), h('div', { class: 'dd-cta-titel' }, fertigKurs(k) ? 'Alle Kapitel gemeistert – jetzt festigen' : s.titel),
        h('div', { class: 'dd-mini' }, fertigKurs(k) ? 'Wiederhole regelmäßig und teste dich mit einer Probeklausur.' : s.ziel)),
      fertigKurs(k) ? h('button', { class: 'knopf', onclick: () => { z.reiter = 'pruefung'; zeichnen(); } }, ic('pruefung', 15), 'Probeklausur')
        : h('button', { class: 'knopf', onclick: () => kapitelWaehlen(k.aktuell) }, 'Weiterlernen', ic('pfeil', 15))) : null,
    h('section', { class: 'dd-block' },
      h('div', { class: 'dd-block-kopf' }, h('h2', {}, 'Kompetenzen'), h('div', { class: 'dd-legende' }, ['sicher', 'unsicher', 'luecke', 'offen'].map((x) => h('span', { class: 'dd-ziel ' + x }, h('span', { class: 'dd-ziel-punkt' }), ZIEL_NAME[x])))),
      k.schritte.map((s1, n) => {
        const sicher = s1.ziele.filter((g) => zielStatus(g) === 'sicher').length;
        return h('div', { class: 'dd-kompetenz' },
          h('div', { class: 'dd-kompetenz-kopf' },
            h('span', { class: 'dd-kap-nr klein ' + s1.stand }, s1.stand === 'gemeistert' ? ic('haken', 11) : String(n + 1)),
            h('span', { class: 'fett wachsen', onclick: () => kapitelWaehlen(n), style: { cursor: 'pointer' } }, s1.titel),
            s1.vorwissen && s1.stand !== 'gemeistert' ? h('button', { class: 'knopf text klein', onclick: () => { z.kapitel = n; k.aktuell = n; z.reiter = 'lernen'; direktZumCheck(n); } }, 'Vorwissen: direkt zum Check') : null,
            h('span', { class: 'dd-mini' }, `${sicher}/${s1.inhalte.length}`)),
          h('div', { class: 'dd-zielchips' }, s1.inhalte.map((x, j) => {
            const st = zielStatus(s1.ziele[j]);
            return h('button', { class: 'dd-zielchip ' + st, title: `${ZIEL_NAME[st]} – ${st === 'luecke' || st === 'unsicher' ? 'klicken, um gezielt zu üben' : x}`, onclick: () => (st === 'luecke' || st === 'unsicher' ? gezieltUeben(n, j) : kapitelWaehlen(n)) }, h('span', { class: 'dd-ziel-punkt' }), x);
          })));
      })),
    offen.length ? h('section', { class: 'dd-block' },
      h('div', { class: 'dd-block-kopf' }, h('h2', {}, 'Schwachstellen'), h('span', { class: 'dd-mini' }, 'Hier hakt es noch – üb gezielt')),
      offen.slice(-8).reverse().map((d) => h('div', { class: 'dd-schwach' },
        h('span', { class: 'dd-schwach-punkt' }), h('div', { class: 'wachsen' }, mdElement(d.thema, 'dd-schwach-text'), h('div', { class: 'dd-mini' }, `Kapitel ${d.schritt + 1}${d.anzahl > 1 ? ` · ${d.anzahl}×` : ''} · ${d.notiz}`)),
        h('button', { class: 'knopf tonal klein', disabled: !!z.laeuft, onclick: () => { const s1 = k.schritte[d.schritt]; gezieltUeben(d.schritt, s1 ? bestesZiel(s1.inhalte, d.thema) : undefined); } }, 'Gezielt üben')))) : null,
    h('div', { class: 'dd-zwei' },
      h('section', { class: 'dd-block' },
        h('div', { class: 'dd-block-kopf' }, h('h2', {}, 'Lernzeit'), h('span', { class: 'dd-mini' }, 'letzte 14 Tage')),
        h('div', { class: 'dd-balken' }, tage.map(([d, x]) => h('div', { class: 'dd-balken-tag', title: `${d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}: ${x ? dauer(x) : '–'}` },
          h('div', { class: 'dd-balken-wert', style: { height: `${Math.max(x ? 6 : 2, (x / maxTag) * 100)}%` } }), h('div', { class: 'dd-balken-name' }, d.toLocaleDateString('de-DE', { weekday: 'narrow' })))))),
      h('section', { class: 'dd-block' },
        h('div', { class: 'dd-block-kopf' }, h('h2', {}, 'Probeklausuren')),
        k.pruefungen.length ? k.pruefungen.slice(0, 5).map((p) => h('div', { class: 'dd-pr-zeile' }, h('span', { class: 'dd-note' }, p.note), h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, `${p.prozent} % · ${p.anzahl} Aufgaben`), h('div', { class: 'dd-mini' }, lyra.zeitText(p.zeit)))))
          : h('div', { class: 'dd-mini' }, 'Noch keine. Teste dich, sobald ein paar Kapitel sitzen.'),
        h('button', { class: 'knopf rand klein', style: { marginTop: '10px' }, onclick: () => { z.reiter = 'pruefung'; zeichnen(); } }, ic('pruefung', 14), 'Probeklausur schreiben'))),
    k.ohneUnterlagen ? h('p', { class: 'dd-mini', style: { marginTop: '18px' } }, 'In deinen Unterlagen stand zu diesem Thema wenig – der Lernpfad stützt sich auf allgemeines Lehrbuchwissen.') : null);
}

function einstufungKarte(k) {
  const e = z.einstufung;
  if (!e) {
    return h('div', { class: 'dd-einstufung' },
      h('div', { class: 'dd-einstufung-symbol' }, ic('ziel', 22)),
      h('div', { class: 'wachsen' },
        h('div', { class: 'dd-cta-titel' }, 'Einstufungstest · etwa 2 Minuten'),
        h('div', { class: 'dd-mini' }, `Ein paar Fragen zu deinen Vorkenntnissen${k.voraussetzungen.length ? ` – ${k.voraussetzungen.slice(0, 3).map((x) => kuerzen(x.replace(/\s*\(.*?\)/g, ''), 40)).join(' · ')} –` : ''} und zu den ersten Kapiteln. Fehlende Grundlagen ergänzt Deep Dive als eigenes Kapitel; was du schon kannst, darfst du direkt mit dem Check abschließen.`),
        z.laeuft === 'einstufung' ? h('div', { style: { marginTop: '12px' } }, laufZeile()) : null,
        fehlerZeile('einstufung')),
      z.laeuft !== 'einstufung' ? h('div', { class: 'dd-einstufung-knoepfe' },
        h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: einstufungStarten }, 'Test starten'),
        h('button', { class: 'knopf text klein', disabled: !!z.laeuft, onclick: einstufungUeberspringen }, 'Überspringen')) : null);
  }
  if (e.fertig) {
    const k1 = z.kurs.einstufung;
    return h('div', { class: 'dd-einstufung fertig' },
      h('div', { class: 'dd-einstufung-symbol' }, ic('haken', 22)),
      h('div', { class: 'wachsen' },
        h('div', { class: 'dd-cta-titel' }, `Einstufung: ${k1.richtig} von ${k1.gesamt} richtig`),
        h('div', { class: 'dd-mini' }, k1.fehlend.length ? `Neu am Anfang: „Grundlagen auffrischen“ (${k1.fehlend.join(', ')}). So bleibt keine Lücke.` : 'Deine Grundlagen sitzen – es kann direkt losgehen.'),
        e.ergebnisse.some((x) => x.ok && x.f.kapitel >= 0) ? h('div', { class: 'dd-mini', style: { marginTop: '4px' } }, 'Bei Kapiteln mit erkanntem Vorwissen kannst du direkt den Check machen (siehe Kompetenzen).') : null),
      h('button', { class: 'knopf', onclick: zuLernen }, 'Loslegen', ic('pfeil', 15)));
  }
  const alle = e.fragen.every((_, i) => e.gewaehlt[i] !== undefined);
  return h('div', { class: 'dd-block dd-test' },
    h('div', { class: 'dd-block-kopf' }, h('h2', {}, 'Einstufungstest'), h('span', { class: 'dd-mini' }, `${Object.keys(e.gewaehlt).length} von ${e.fragen.length} beantwortet`)),
    e.fragen.map((f, i) => h('div', { class: 'dd-testfrage' },
      h('div', { class: 'dd-label' }, f.kapitel === -1 ? `Vorkenntnis · ${f.thema || ''}` : `Kapitel ${f.kapitel + 1} · ${f.thema || ''}`),
      mdElement(f.frage, 'dd-frage-text'),
      h('div', { class: 'dd-optionen' }, f.optionen.map((o, j) => h('div', { class: 'dd-option' + (e.gewaehlt[i] === j ? ' gewaehlt' : ''), onclick: () => { e.gewaehlt[i] = j; zeichnen(); } }, h('span', { class: 'dd-marke' }, String.fromCharCode(65 + j)), mdElement(o)))))),
    h('div', { class: 'zeile', style: { justifyContent: 'flex-end', marginTop: '10px' } },
      h('button', { class: 'knopf text', onclick: einstufungUeberspringen }, 'Abbrechen'),
      h('button', { class: 'knopf', disabled: !alle, onclick: einstufungAuswerten }, 'Auswerten')));
}

// ------------------------------------------------------------------ Kurs: Lernen

function lernenAnsicht(k) {
  const n = z.kapitel;
  const s = k.schritte[n];
  return h('div', { class: 'dd-seite dd-lesen' },
    fertigKurs(k) ? h('div', { class: 'dd-fertig' }, h('div', { class: 'dd-fertig-symbol' }, '🏆'),
      h('div', { class: 'wachsen' }, h('div', { class: 'dd-cta-titel' }, `Du hast „${k.titel}“ gemeistert!`), h('div', { class: 'dd-mini' }, 'Jetzt festigen: Wiederholungsplan, Probeklausur oder Karteikarten.')),
      h('button', { class: 'knopf rand klein', onclick: () => { z.reiter = 'pruefung'; zeichnen(); } }, 'Probeklausur'), h('button', { class: 'knopf rand klein', onclick: () => mitFlip(k) }, 'Mit Flip festigen')) : null,
    h('div', { class: 'dd-eyebrow' }, `Kapitel ${n + 1} von ${k.schritte.length}`, s.stand === 'gemeistert' ? h('span', { class: 'dd-status gruen' }, 'gemeistert') : s.stand === 'wiederholen' ? h('span', { class: 'dd-status orange' }, 'wiederholen') : null),
    h('h1', { class: 'dd-titel' }, s.titel),
    s.ziel ? h('p', { class: 'dd-unter' }, s.ziel) : null,
    s.vorwissen && s.stand !== 'gemeistert' && s.stand !== 'check' ? h('div', { class: 'dd-vorwissen' }, ic('stern', 15), h('span', { class: 'wachsen' }, 'Laut Einstufung kennst du dich hier schon aus.'), h('button', { class: 'knopf text klein', disabled: !!z.laeuft, onclick: () => direktZumCheck(n) }, 'Direkt zum Check')) : null,
    stepper(s),
    z.laeuft === 'planen' ? h('div', { class: 'dd-karte-weiss' }, laufZeile()) : null,
    !s.haeppchen.length && z.laeuft !== 'planen' ? h('div', { class: 'dd-karte-weiss' }, fehlerZeile('planen') || h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: weiter }, 'Kapitel beginnen', ic('pfeil', 15))) : null,
    s.haeppchen.length ? (z.hp >= s.haeppchen.length ? checkAnsicht(k, n, s) : haeppchenAnsicht(k, n, s, z.hp)) : null);
}

function stepper(s) {
  if (!s.haeppchen.length) return null;
  const offen = s.haeppchen.findIndex((p) => p.ergebnis === null || p.ergebnis === undefined);
  return h('div', { class: 'dd-stepper' },
    s.haeppchen.map((p, i) => h('button', {
      class: 'dd-step ' + (i === z.hp ? 'jetzt' : p.ergebnis === true ? 'ok' : p.ergebnis === false ? 'falsch' : ''),
      title: p.bezeichnung, disabled: !!z.laeuft || (!p.erklaerung && i !== s.pos),
      onclick: () => { z.hp = i; zeichnen(); },
    }, p.ergebnis === true ? ic('haken', 12) : String(i + 1))),
    h('span', { class: 'dd-step-linie' }),
    h('button', {
      class: 'dd-step check ' + (z.hp >= s.haeppchen.length ? 'jetzt' : ''),
      disabled: !!z.laeuft || (offen >= 0 && !['check', 'wiederholen', 'gemeistert'].includes(s.stand)),
      onclick: () => { z.hp = s.haeppchen.length; zeichnen(); },
    }, ic('pruefung', 13), 'Check'));
}

function haeppchenAnsicht(k, n, s, i) {
  const p = s.haeppchen[i];
  const erklaertGerade = z.laeuft === 'erklaeren' && i === z.hp;
  const erklaerung = erklaertGerade ? null : p.erklaerung;
  const q = p.quiz;
  const beantwortet = p.ergebnis === true || p.ergebnis === false;
  const gewaehlt = beantwortet ? new Set(p.gewaehlt) : z.auswahl[i] || new Set();
  const mehrere = q && q.richtig.length > 1;
  const quellen = erklaerung && p.quellen && p.quellen.length ? [...new Map(p.quellen.map((x) => [x.titel + '#' + x.seite, x])).values()].slice(0, 6) : [];
  const werkzeuge = [...Object.entries(VERTIEFUNG).map(([art, [name, icon]]) => ({ art, name, icon, bei: () => vertiefen(i, art) })),
    ...(z.graphit ? [{ art: 'schaubild', name: 'Schaubild', icon: 'bild', bei: () => schaubild(i) }] : []),
    { art: 'anders', name: 'Ganz anders erklären', icon: 'neu', bei: () => andersErklaeren(i) }];
  return h('div', {},
    h('article', { class: 'dd-lektion' },
      h('div', { class: 'dd-lektion-kopf' }, h('span', { class: 'dd-label' }, `Häppchen ${i + 1} von ${s.haeppchen.length}`), h('span', { class: 'dd-lernziel' }, ic('ziel', 12), s.inhalte[p.lernziel] || '')),
      h('h2', {}, p.bezeichnung),
      erklaertGerade ? h('div', {}, h('div', { class: 'md dd-text', id: 'strom', html: md(z.strom) }), laufZeile()) : null,
      erklaerung ? mdElement(erklaerung, 'dd-text') : null,
      erklaerung && p.merke ? h('div', { class: 'dd-merke' }, h('div', { class: 'dd-merke-titel' }, ic('tipp', 14), 'Merke'), mdElement(p.merke)) : null,
      quellen.length ? h('div', { class: 'dd-quellen' }, quellen.map((x) => h('button', { class: 'dd-quelle', onclick: () => lyra.oeffnen(x) }, ic('buch', 12), x.seite ? `${x.titel} · S. ${x.seite}` : x.titel))) : null,
      !erklaerung && !erklaertGerade ? (fehlerZeile('erklaeren') || h('button', { class: 'knopf', onclick: weiter, disabled: !!z.laeuft }, 'Erklären')) : null),
    erklaerung ? h('div', { class: 'dd-werkzeuge' },
      h('div', { class: 'dd-label' }, 'Deine Lehrkraft kann außerdem'),
      h('div', { class: 'dd-werkzeug-reihe' }, werkzeuge.map((w) => h('button', {
        class: 'dd-werkzeug' + (p.vertiefungen.some((v) => v.art === w.art) || (w.art === 'schaubild' && p.bilder.length) ? ' an' : ''),
        disabled: !!z.laeuft, onclick: w.bei,
      }, ic(w.icon, 14), w.name)))) : null,
    (String(z.laeuft || '').startsWith('vertiefen') || z.laeuft === 'schaubild') && i === z.hp ? h('div', { class: 'dd-vertiefung' }, h('div', { class: 'dd-vertiefung-titel' }, VERTIEFUNG[z.offeneVertiefung] ? VERTIEFUNG[z.offeneVertiefung][0] : 'Schaubild'),
      z.laeuft !== 'schaubild' ? h('div', { class: 'md dd-text', id: 'strom', html: md(z.strom) }) : null, laufZeile()) : null,
    fehlerZeile('schaubild'), Object.keys(VERTIEFUNG).map((a) => fehlerZeile('vertiefen:' + a)),
    p.bilder.map((b) => h('figure', { class: 'dd-bild' }, h('img', { src: b.src, alt: b.titel }), h('figcaption', {}, b.titel, ' · gezeichnet mit Graphit'))),
    p.vertiefungen.map((v) => h('details', { class: 'dd-vertiefung', open: true },
      h('summary', { class: 'dd-vertiefung-titel' }, ic(VERTIEFUNG[v.art] ? VERTIEFUNG[v.art][1] : 'tiefe', 14), VERTIEFUNG[v.art] ? VERTIEFUNG[v.art][0] : 'Vertiefung'),
      mdElement(v.text, 'dd-text'))),
    erklaerung ? h('div', { class: 'dd-quiz' },
      h('div', { class: 'dd-quiz-kopf' }, h('span', { class: 'dd-label' }, mehrere ? 'Verständnisfrage · mehrere richtig' : 'Verständnisfrage'), q && !beantwortet ? h('span', { class: 'dd-mini' }, 'Tasten 1–4 wählen · Enter prüft') : null),
      z.laeuft === 'quiz' && i === z.hp ? laufZeile() : null,
      !q && z.laeuft !== 'quiz' ? (fehlerZeile('quiz') || h('button', { class: 'knopf tonal', disabled: !!z.laeuft, onclick: async () => { await quizStellen(n, i); zeichnen(); } }, 'Frage stellen')) : null,
      q ? h('div', {},
        mdElement(q.frage, 'dd-frage-text'),
        h('div', { class: 'dd-optionen' }, q.optionen.map((o, j) => {
          const richtig = q.richtig.includes(j);
          const cls = beantwortet ? (richtig ? 'richtig' : gewaehlt.has(j) ? 'falsch' : 'aus') : gewaehlt.has(j) ? 'gewaehlt' : '';
          return h('div', {
            class: `dd-option ${cls}`,
            onclick: beantwortet ? null : () => { const g = new Set(z.auswahl[i] || []); if (g.has(j)) g.delete(j); else { if (!mehrere) g.clear(); g.add(j); } z.auswahl[i] = g; zeichnen(); },
          }, h('span', { class: 'dd-marke' }, beantwortet && richtig ? '✓' : beantwortet && gewaehlt.has(j) ? '✕' : String(j + 1)), mdElement(o));
        })),
        !beantwortet ? h('div', { class: 'zeile', style: { justifyContent: 'flex-end' } }, h('button', { class: 'knopf', disabled: !gewaehlt.size, onclick: () => pruefen(i) }, 'Prüfen')) : null,
        beantwortet ? h('div', { class: 'dd-feedback ' + (p.ergebnis ? 'gut' : 'schlecht') }, h('div', { class: 'fett' }, p.ergebnis ? '✓ Richtig!' : '✕ Nicht ganz'), q.warum ? mdElement(q.warum) : null) : null,
        beantwortet ? h('div', { class: 'dd-weiter' },
          !p.ergebnis ? h('button', { class: 'knopf tonal', disabled: !!z.laeuft, onclick: () => nochEineFrage(i) }, 'Noch eine Frage dazu') : null,
          !p.ergebnis ? h('button', { class: 'knopf rand', disabled: !!z.laeuft, onclick: () => andersErklaeren(i) }, 'Anders erklären') : null,
          h('span', { class: 'wachsen' }),
          h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: naechstes }, s.haeppchen.slice(i + 1).some((x) => x.ergebnis === null || x.ergebnis === undefined) ? 'Weiter' : 'Zum Kapitel-Check', ic('pfeil', 15))) : null) : null) : null,
    erklaerung ? h('div', { class: 'dd-chat' },
      h('div', { class: 'dd-label' }, ic('chat', 13), `Frag ${lehrerName()}`),
      p.rueckfragen.map(([f, a]) => h('div', {}, h('div', { class: 'dd-blase du' }, f), h('div', { class: 'dd-blase lehrer' }, mdElement(a, 'dd-text')))),
      z.laeuft === 'rueckfrage' && i === z.hp ? h('div', {}, h('div', { class: 'dd-blase du' }, z.offeneFrage), h('div', { class: 'dd-blase lehrer' }, h('div', { class: 'md dd-text', id: 'strom', html: md(z.strom) }), laufZeile())) : null,
      fehlerZeile('rueckfrage'),
      !p.rueckfragen.length && !z.laeuft ? h('div', { class: 'dd-chips' }, CHAT_VORSCHLAEGE.map((v) => h('button', { class: 'dd-chip', onclick: () => rueckfrage(i, v) }, v))) : null,
      h('div', { class: 'dd-chat-eingabe' },
        feld('frage' + i, { platzhalter: 'Was ist unklar? Frag nach …', beiEnter: () => rueckfrage(i) }),
        h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: () => rueckfrage(i) }, 'Fragen'))) : null);
}

function checkAnsicht(k, n, s) {
  const fertig = s.aufgaben.length && s.aufgaben.every((a) => a.bewertet);
  return h('div', {},
    h('div', { class: 'dd-check-kopf' },
      h('div', { class: 'dd-check-symbol' }, ic('pruefung', 20)),
      h('div', { class: 'wachsen' }, h('h2', {}, 'Kapitel-Check'), h('div', { class: 'dd-mini' }, `Zeig, dass alle ${s.inhalte.length} Lernziele sitzen. Hinweise helfen (je −10 Punkte), Lösungen gibt es nur auf Wunsch.`))),
    z.laeuft === 'check' ? h('div', { class: 'dd-karte-weiss' }, laufZeile()) : null,
    !s.aufgaben.length && z.laeuft !== 'check' ? h('div', { class: 'dd-karte-weiss' }, fehlerZeile('check') || h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: neuerCheck }, 'Check starten')) : null,
    s.aufgaben.map((a, i) => aufgabeKarte(k, s, i, a)),
    fertig ? ergebnisKarte(k, n, s) : null);
}

const artName = (a) => ({ auswahl: a.richtig.length > 1 ? 'Multiple Choice · mehrere richtig' : 'Multiple Choice', loesen: 'Lösen', beweisen: 'Beweisen' })[a.art] || 'Erklären';
const punkteKlasse = (p) => (p >= 0.8 ? 'gut' : p >= 0.5 ? 'mittel' : 'schlecht');

function aufgabeKarte(k, s, i, a) {
  const g = a.bewertet ? new Set(a.gewaehlt) : z.auswahl['a' + i] || new Set();
  const mehrere = a.richtig.length > 1;
  const zeigeLoesung = a.loesung && (a.aufgeloest || (a.art === 'auswahl' && a.bewertet));
  return h('div', { class: 'dd-aufgabe' + (a.bewertet ? ' ' + punkteKlasse(a.punkte) : '') },
    h('div', { class: 'dd-aufgabe-kopf' },
      h('span', { class: 'dd-aufgabe-nr' }, String(i + 1)),
      h('span', { class: 'dd-label wachsen' }, artName(a), s.inhalte[a.lernziel] ? h('span', { class: 'dd-lernziel' }, ic('ziel', 11), kuerzen(s.inhalte[a.lernziel], 50)) : null),
      a.bewertet ? h('span', { class: 'dd-punkte ' + punkteKlasse(a.punkte) }, `${Math.round(a.punkte * 100)} %`) : null),
    mdElement(a.frage, 'dd-frage-text'),
    a.art === 'auswahl'
      ? h('div', {},
        h('div', { class: 'dd-optionen' }, a.optionen.map((o, j) => {
          const richtig = a.richtig.includes(j);
          const cls = a.bewertet ? (richtig ? 'richtig' : g.has(j) ? 'falsch' : 'aus') : g.has(j) ? 'gewaehlt' : '';
          return h('div', {
            class: `dd-option ${cls}`,
            onclick: a.bewertet ? null : () => { const x = new Set(z.auswahl['a' + i] || []); if (x.has(j)) x.delete(j); else { if (!mehrere) x.clear(); x.add(j); } z.auswahl['a' + i] = x; zeichnen(); },
          }, h('span', { class: 'dd-marke' }, String.fromCharCode(65 + j)), mdElement(o));
        })),
        !a.bewertet ? h('div', { class: 'dd-aufgabe-fuss' },
          a.hinweise.length < 3 ? h('button', { class: 'knopf text klein', disabled: !!z.laeuft, onclick: () => hinweisGeben(i) }, ic('tipp', 14), a.hinweise.length ? `Nächster Hinweis (${a.hinweise.length}/3)` : 'Hinweis') : null,
          h('span', { class: 'wachsen' }),
          h('button', { class: 'knopf', disabled: !g.size, onclick: () => auswahlPruefen(i) }, 'Prüfen')) : null)
      : a.bewertet
        ? (a.antwort ? h('div', { class: 'dd-antwort' }, h('div', { class: 'dd-label' }, 'Deine Antwort'), mdElement(a.antwort, 'dd-text')) : null)
        : h('div', {},
          feld('antwort' + i, { zeilen: 6, klasse: 'dd-antwortfeld', platzhalter: a.art === 'beweisen' ? 'Dein Beweis … (Formeln gern als $…$)' : a.art === 'loesen' ? 'Dein Lösungsweg … (Formeln gern als $…$)' : 'Erklär es in eigenen Worten …' }),
          z.laeuft === 'abgeben:' + i ? laufZeile() : h('div', { class: 'dd-aufgabe-fuss' },
            a.hinweise.length < 3 ? h('button', { class: 'knopf text klein', disabled: !!z.laeuft, onclick: () => hinweisGeben(i) }, ic('tipp', 14), a.hinweise.length ? `Nächster Hinweis (${a.hinweise.length}/3)` : 'Hinweis') : null,
            h('button', { class: 'knopf leise klein', disabled: !!z.laeuft, onclick: () => loesungZeigen(i) }, 'Lösung zeigen'),
            h('span', { class: 'wachsen' }),
            h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: () => abgeben(i) }, 'Abgeben')),
          fehlerZeile('abgeben:' + i)),
    z.laeuft === 'hinweis:' + i ? laufZeile() : null,
    fehlerZeile('hinweis:' + i),
    a.hinweise.length ? h('div', { class: 'dd-hinweise' }, a.hinweise.map((x, j) => h('div', { class: 'dd-hinweis' }, h('span', { class: 'dd-hinweis-stufe' }, `Hinweis ${j + 1}`), mdElement(x, 'dd-text')))) : null,
    a.bewertet && a.rueckmeldung ? h('div', { class: 'dd-feedback ' + punkteKlasse(a.punkte) }, h('div', { class: 'fett' }, 'Rückmeldung'), mdElement(a.rueckmeldung, 'dd-text'),
      a.luecke && a.punkte < 0.8 ? h('div', { class: 'dd-mini fett', style: { marginTop: '6px' } }, 'Noch üben: ' + a.luecke) : null) : null,
    z.laeuft === 'loesung:' + i ? h('div', { class: 'dd-loesung' }, h('div', { class: 'md dd-text', id: 'strom', html: md(z.strom) }), laufZeile())
      : zeigeLoesung ? h('div', { class: 'dd-loesung' }, h('div', { class: 'dd-label' }, a.art === 'auswahl' ? 'Erklärung' : 'Musterlösung'), mdElement(a.loesung, 'dd-text'))
        : a.bewertet ? h('button', { class: 'knopf text klein', style: { marginTop: '8px' }, disabled: !!z.laeuft, onclick: () => loesungZeigen(i) }, a.art === 'auswahl' ? 'Erklärung ansehen' : 'Musterlösung ansehen') : null,
    fehlerZeile('loesung:' + i));
}

function ergebnisKarte(k, n, s) {
  const p = Math.round((s.letzte || 0) * 100);
  const gemeistert = s.stand === 'gemeistert';
  const luecken = (s.lueckenBeiAbschluss || []).map((j) => s.inhalte[j]).filter(Boolean);
  const naechster = k.schritte.findIndex((x, j) => j > n && x.stand !== 'gemeistert');
  return h('div', { class: 'dd-ergebnis ' + (gemeistert ? 'gut' : 'mittel') },
    h('div', { class: 'dd-ergebnis-zahl' }, `${p} %`),
    h('div', { class: 'wachsen' },
      h('div', { class: 'dd-cta-titel' }, gemeistert ? 'Kapitel gemeistert!' : luecken.length && p >= (z.einst.schwelle || 75) ? 'Fast geschafft – eine Lücke bleibt' : `Ab ${z.einst.schwelle} % geht es weiter`),
      h('div', { class: 'dd-mini' }, gemeistert
        ? `Die erste Wiederholung ist ${datumText(s.wiederholung.faellig)}. ${naechster >= 0 ? `Weiter mit Kapitel ${naechster + 1}: ${k.schritte[naechster].titel}.` : 'Das war das letzte Kapitel.'}`
        : luecken.length ? `Noch nicht sicher: ${luecken.join(', ')}. ${lehrerName()} erklärt genau das noch einmal anders, dann kommt ein neuer Check.`
          : `${lehrerName()} erklärt die Häppchen, bei denen es gehakt hat, noch einmal anders. Danach kommt ein neuer Check.`),
      h('div', { class: 'dd-weiter' },
        gemeistert && naechster >= 0 ? h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: () => kapitelWaehlen(naechster) }, 'Nächstes Kapitel', ic('pfeil', 15)) : null,
        gemeistert && naechster < 0 ? h('button', { class: 'knopf', onclick: () => { z.reiter = 'pruefung'; zeichnen(); } }, ic('pruefung', 15), 'Probeklausur') : null,
        !gemeistert ? h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: () => wiederholen() }, 'Gezielt wiederholen') : null,
        h('button', { class: 'knopf rand', disabled: !!z.laeuft, onclick: neuerCheck }, gemeistert ? 'Noch ein Check' : 'Gleich neuer Check'))));
}

// ------------------------------------------------------------------ Kurs: Skript, Glossar

function skriptAnsicht(k) {
  const fehlen = k.schritte.filter((s) => !s.zusammenfassung && s.haeppchen.some((p) => p.erklaerung)).length;
  const hatInhalt = k.schritte.some((s) => s.haeppchen.some((p) => p.erklaerung));
  return h('div', { class: 'dd-seite' },
    h('div', { class: 'dd-werkzeugleiste' },
      h('div', { class: 'wachsen' }, h('div', { class: 'dd-eyebrow' }, 'Dein Skript'), h('div', { class: 'dd-mini' }, 'Alle Erklärungen, Merksätze und Vertiefungen – wächst mit jedem Häppchen.')),
      fehlen ? h('button', { class: 'knopf rand klein', disabled: !!z.laeuft, onclick: zusammenfassungen }, ic('skript', 14), `Zusammenfassungen (${fehlen})`) : null,
      h('button', { class: 'knopf rand klein', disabled: !hatInhalt, onclick: () => lyra.kopieren(skriptMarkdown(k), 'Skript kopiert') }, ic('kopie', 14), 'Kopieren'),
      h('button', { class: 'knopf rand klein', disabled: !hatInhalt, onclick: async () => { try { if (await lyra.speichern(`${k.titel.replace(/[^\wäöüÄÖÜß -]+/g, '').trim().replace(/\s+/g, '-') || 'Skript'}.md`, skriptMarkdown(k))) lyra.toast('Gesichert', 'ok'); } catch (e) { lyra.toast(meldung(e), 'fehler'); } } }, ic('sichern', 14), 'Sichern'),
      h('button', { class: 'knopf klein', disabled: !hatInhalt, onclick: () => lyra.drucken() }, ic('druck', 14), 'Drucken / PDF')),
    z.laeuft === 'zusammenfassung' ? h('div', { class: 'dd-karte-weiss' }, laufZeile()) : null,
    hatInhalt ? h('div', { class: 'dd-skript' }, mdElement(skriptMarkdown(k), 'dd-text'))
      : h('div', { class: 'dd-leer' }, ic('skript', 28), h('div', { class: 'fett' }, 'Dein Skript ist noch leer'), h('div', { class: 'dd-mini' }, 'Sobald du die ersten Häppchen gelernt hast, steht hier alles sauber geordnet – zum Nachlesen und Drucken.')));
}

function glossarAnsicht(k) {
  const q = z.glossarSuche.trim().toLowerCase();
  const liste = k.glossar.filter((b) => !q || b.begriff.toLowerCase().includes(q) || b.definition.toLowerCase().includes(q)).sort((a, b) => a.begriff.localeCompare(b.begriff, 'de'));
  const ohne = k.schritte.map((s, n) => [s, n]).filter(([s, n]) => s.haeppchen.some((p) => p.erklaerung) && !k.glossar.some((b) => b.kapitel === n));
  const suche = h('input', { class: 'eingabe', 'data-feld': 'glossar', placeholder: 'Begriff suchen …', value: z.glossarSuche });
  suche.addEventListener('input', () => { z.glossarSuche = suche.value; zeichnen(); });
  let buchstabe = '';
  return h('div', { class: 'dd-seite' },
    h('div', { class: 'dd-werkzeugleiste' },
      h('div', { class: 'wachsen' }, h('div', { class: 'dd-eyebrow' }, 'Glossar'), h('div', { class: 'dd-mini' }, `${k.glossar.length} Fachbegriffe – wird nach jedem gemeisterten Kapitel ergänzt.`)),
      ohne.length ? h('button', { class: 'knopf rand klein', disabled: !!z.laeuft, onclick: async () => { for (const [, n] of ohne) await glossarErgaenzen(n); } }, ic('plus', 14), `Ergänzen (${ohne.length} Kapitel)`) : null),
    k.glossar.length ? suche : null,
    z.laeuft === 'glossar' ? h('div', { class: 'dd-karte-weiss' }, laufZeile()) : null,
    liste.length ? h('div', { class: 'dd-glossar' }, liste.map((b) => {
      const b1 = b.begriff[0].toUpperCase();
      const kopf = b1 !== buchstabe ? h('div', { class: 'dd-glossar-buchstabe' }, (buchstabe = b1)) : null;
      return [kopf, h('div', { class: 'dd-glossar-eintrag' }, h('div', { class: 'dd-glossar-begriff' }, b.begriff, h('span', { class: 'dd-mini' }, ` · Kapitel ${b.kapitel + 1}`)), mdElement(b.definition, 'dd-text'))];
    })) : h('div', { class: 'dd-leer' }, ic('glossar', 28), h('div', { class: 'fett' }, k.glossar.length ? 'Nichts gefunden' : 'Noch keine Begriffe'), h('div', { class: 'dd-mini' }, 'Das Glossar füllt sich, sobald du Kapitel gelernt hast.')));
}

// ------------------------------------------------------------------ Kurs: Wiederholen

function wiederholenAnsicht(k) {
  const r = z.review;
  const plan = k.schritte.map((s, n) => [s, n]).filter(([s]) => s.stand === 'gemeistert' && s.wiederholung);
  if (r && !r.fertig) {
    const f = r.fragen[r.i];
    const beantwortet = r.gewaehlt !== null;
    return h('div', { class: 'dd-seite dd-review' },
      h('div', { class: 'dd-review-kopf' }, h('span', { class: 'dd-label' }, `Wiederholung · Frage ${r.i + 1} von ${r.fragen.length}`), h('span', { class: 'dd-mini' }, `Kapitel ${f.kapitel + 1}: ${k.schritte[f.kapitel].titel}`)),
      h('div', { class: 'dd-fortschritt' }, h('div', { style: { width: `${(r.i / r.fragen.length) * 100}%` } })),
      h('div', { class: 'dd-review-karte' },
        mdElement(f.frage, 'dd-frage-text gross'),
        h('div', { class: 'dd-optionen' }, f.optionen.map((o, j) => {
          const cls = beantwortet ? (j === f.richtig[0] ? 'richtig' : j === r.gewaehlt ? 'falsch' : 'aus') : '';
          return h('div', { class: 'dd-option ' + cls, onclick: () => reviewAntwort(j) }, h('span', { class: 'dd-marke' }, String.fromCharCode(65 + j)), mdElement(o));
        })),
        beantwortet ? h('div', { class: 'dd-feedback ' + (r.ergebnisse[r.i] ? 'gut' : 'schlecht') }, h('div', { class: 'fett' }, r.ergebnisse[r.i] ? '✓ Sitzt!' : '✕ Noch nicht'), f.warum ? mdElement(f.warum) : null) : null,
        beantwortet ? h('div', { class: 'dd-weiter' }, h('span', { class: 'wachsen' }), h('button', { class: 'knopf', onclick: reviewWeiter }, r.i < r.fragen.length - 1 ? 'Weiter' : 'Auswerten', ic('pfeil', 15))) : null));
  }
  return h('div', { class: 'dd-seite' },
    h('div', { class: 'dd-eyebrow' }, 'Wiederholen'),
    h('h1', { class: 'dd-titel' }, 'Damit es dauerhaft bleibt'),
    h('p', { class: 'dd-unter' }, 'Gemeisterte Kapitel kommen nach 1, 3, 7, 16 und 35 Tagen wieder – immer dann, wenn du sie fast vergessen hättest. Was sitzt, rückt weiter nach hinten; was wackelt, kommt bald wieder.'),
    r && r.fertig ? h('div', { class: 'dd-ergebnis gut' }, h('div', { class: 'dd-ergebnis-zahl' }, `${r.ergebnisse.filter(Boolean).length}/${r.fragen.length}`),
      h('div', { class: 'wachsen' }, h('div', { class: 'dd-cta-titel' }, 'Wiederholung abgeschlossen'), h('div', { class: 'dd-mini' }, r.kapitel.map((n) => `${k.schritte[n].titel}: nächste ${k.schritte[n].wiederholung ? datumText(k.schritte[n].wiederholung.faellig) : '–'}`).join(' · ')))) : null,
    z.laeuft === 'wiederholung' ? h('div', { class: 'dd-karte-weiss' }, laufZeile()) : null,
    fehlerZeile('wiederholung'),
    h('div', { class: 'dd-weiter', style: { margin: '14px 0 22px' } },
      h('button', { class: 'knopf', disabled: !!z.laeuft || !faellig(k).length, onclick: () => wiederholungStarten(false) }, ic('wiederholen', 15), faellig(k).length ? `Fällige wiederholen (${faellig(k).length})` : 'Heute nichts fällig'),
      h('button', { class: 'knopf rand', disabled: !!z.laeuft || !k.schritte.some((s) => s.haeppchen.some((p) => p.erklaerung)), onclick: () => wiederholungStarten(true) }, 'Freies Training'),
      h('button', { class: 'knopf rand', onclick: () => mitFlip(k) }, ic('karten', 15), 'Mit Flip')),
    h('section', { class: 'dd-block' },
      h('div', { class: 'dd-block-kopf' }, h('h2', {}, 'Wiederholungsplan')),
      plan.length ? plan.map(([s, n]) => h('div', { class: 'dd-plan-zeile' },
        h('span', { class: 'dd-kap-nr klein gemeistert' }, ic('haken', 11)),
        h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, s.titel), h('div', { class: 'dd-mini' }, `Stufe ${s.wiederholung.stufe + 1} von ${INTERVALLE.length}${s.wiederholung.zuletzt !== undefined ? ` · zuletzt ${s.wiederholung.zuletzt} %` : ''}`)),
        h('div', { class: 'dd-stufen' }, INTERVALLE.map((_, j) => h('span', { class: j <= s.wiederholung.stufe ? 'an' : '' }))),
        h('span', { class: 'dd-plan-datum' + (s.wiederholung.faellig <= Date.now() ? ' dd-faellig' : '') }, datumText(s.wiederholung.faellig))))
        : h('div', { class: 'dd-mini' }, 'Sobald du ein Kapitel gemeistert hast, erscheint es hier mit seinem Wiederholungsplan.')));
}

// ------------------------------------------------------------------ Kurs: Probeklausur

function pruefungAnsicht(k) {
  const p = z.pruefung;
  if (p && !p.bewertet) {
    return h('div', { class: 'dd-seite' },
      h('div', { class: 'dd-pr-kopf' },
        h('div', { class: 'wachsen' }, h('div', { class: 'dd-eyebrow' }, 'Probeklausur'), h('div', { class: 'fett' }, `${p.aufgaben.length} Aufgaben · keine Hinweise, keine Lösungen bis zur Abgabe`)),
        p.ende ? h('div', { class: 'dd-timer' }, ic('uhr', 16), h('span', { id: 'dd-timer' }, '…')) : null,
        z.laeuft === 'korrektur' || z.laeuft === 'bericht' ? null : h('button', { class: 'knopf', onclick: () => pruefungAbgeben(false) }, 'Abgeben')),
      z.laeuft === 'korrektur' || z.laeuft === 'bericht' || p.abgabe ? h('div', { class: 'dd-karte-weiss' }, laufZeile()) : null,
      p.aufgaben.map((a, i) => h('div', { class: 'dd-aufgabe' },
        h('div', { class: 'dd-aufgabe-kopf' }, h('span', { class: 'dd-aufgabe-nr' }, String(i + 1)), h('span', { class: 'dd-label wachsen' }, `${artName(a)} · Kapitel ${a.kapitel + 1}`)),
        mdElement(a.frage, 'dd-frage-text'),
        a.art === 'auswahl'
          ? h('div', { class: 'dd-optionen' }, a.optionen.map((o, j) => {
            const g = z.auswahl['pr' + i] || new Set();
            return h('div', { class: 'dd-option' + (g.has(j) ? ' gewaehlt' : ''), onclick: () => { const x = new Set(g); if (x.has(j)) x.delete(j); else { if (a.richtig.length < 2) x.clear(); x.add(j); } z.auswahl['pr' + i] = x; zeichnen(); } }, h('span', { class: 'dd-marke' }, String.fromCharCode(65 + j)), mdElement(o));
          }))
          : feld('pr' + i, { zeilen: 6, klasse: 'dd-antwortfeld', immer: true, platzhalter: 'Deine Lösung … (Formeln gern als $…$)' }))),
      !p.abgabe ? h('div', { class: 'dd-weiter' }, h('button', { class: 'knopf text', onclick: async () => { if (await lyra.bestaetigen({ titel: 'Klausur abbrechen?', text: 'Deine Antworten gehen verloren.', ja: 'Abbrechen', nein: 'Weiterschreiben', gefahr: true })) { z.pruefung = null; zeichnen(); } } }, 'Abbrechen'), h('span', { class: 'wachsen' }), h('button', { class: 'knopf', onclick: () => pruefungAbgeben(false) }, 'Abgeben')) : null);
  }
  if (p && p.bewertet) {
    return h('div', { class: 'dd-seite' },
      h('div', { class: 'dd-pr-ergebnis' },
        h('div', { class: 'dd-pr-note' }, h('div', { class: 'dd-mini' }, 'Note'), h('div', { class: 'dd-pr-note-wert' }, p.note)),
        h('div', { class: 'wachsen' },
          h('div', { class: 'dd-cta-titel' }, `${p.prozent} % · ${p.aufgaben.length} Aufgaben · ${Math.max(1, Math.round((p.abgabe - p.start) / 60000))} Min.`),
          h('div', { class: 'dd-kapitelwerte' }, p.kapitel.map(({ n, prozent }) => h('div', { class: 'dd-kapitelwert' }, h('span', { class: 'eine-zeile' }, `${n + 1}. ${k.schritte[n].titel}`), h('div', { class: 'dd-fortschritt klein' }, h('div', { class: punkteKlasse(prozent / 100), style: { width: `${prozent}%` } })), h('span', { class: 'dd-mini' }, `${prozent} %`))))),
        h('button', { class: 'knopf rand klein', onclick: () => { z.pruefung = null; zeichnen(); } }, 'Neue Klausur')),
      p.bericht ? h('section', { class: 'dd-block' }, h('div', { class: 'dd-block-kopf' }, h('h2', {}, 'Prüfungsbericht')), mdElement(p.bericht, 'dd-text')) : null,
      p.aufgaben.map((a, i) => h('div', { class: 'dd-aufgabe ' + punkteKlasse(a.punkte) },
        h('div', { class: 'dd-aufgabe-kopf' }, h('span', { class: 'dd-aufgabe-nr' }, String(i + 1)), h('span', { class: 'dd-label wachsen' }, `${artName(a)} · Kapitel ${a.kapitel + 1}`), h('span', { class: 'dd-punkte ' + punkteKlasse(a.punkte) }, `${Math.round(a.punkte * 100)} %`)),
        mdElement(a.frage, 'dd-frage-text'),
        a.art === 'auswahl' ? h('div', { class: 'dd-optionen' }, a.optionen.map((o, j) => h('div', { class: 'dd-option ' + (a.richtig.includes(j) ? 'richtig' : a.gewaehlt.includes(j) ? 'falsch' : 'aus') }, h('span', { class: 'dd-marke' }, String.fromCharCode(65 + j)), mdElement(o))))
          : a.antwort ? h('div', { class: 'dd-antwort' }, h('div', { class: 'dd-label' }, 'Deine Antwort'), mdElement(a.antwort, 'dd-text')) : null,
        a.rueckmeldung ? h('div', { class: 'dd-feedback ' + punkteKlasse(a.punkte) }, mdElement(a.rueckmeldung, 'dd-text')) : null,
        a.loesung ? h('details', { class: 'dd-loesung' }, h('summary', { class: 'dd-label' }, 'Musterlösung'), mdElement(a.loesung, 'dd-text')) : null)));
  }
  const wahl = (titel, wert, optionen, beiWahl) => h('div', { class: 'dd-pr-wahl' }, h('div', { class: 'dd-label' }, titel), h('div', { class: 'dd-wahl' }, optionen.map(([w, n]) => h('button', { class: 'dd-wahl-knopf' + (wert === w ? ' an' : ''), onclick: () => { beiWahl(w); zeichnen(); } }, n))));
  return h('div', { class: 'dd-seite' },
    h('div', { class: 'dd-eyebrow' }, 'Probeklausur'),
    h('h1', { class: 'dd-titel' }, 'Teste dich wie in der Prüfung'),
    h('p', { class: 'dd-unter' }, 'Aufgaben über alle gelernten Kapitel, gemischt und von leicht nach schwer. Keine Hinweise, keine Lösungen bis zur Abgabe – danach bekommst du Note, Auswertung je Kapitel, Musterlösungen und einen Prüfungsbericht. Schwaches kommt automatisch früher zur Wiederholung.'),
    h('div', { class: 'dd-block' },
      wahl('Umfang', z.pruefungAnzahl, [[4, '4 Aufgaben'], [6, '6 Aufgaben'], [8, '8 Aufgaben'], [10, '10 Aufgaben']], (w) => { z.pruefungAnzahl = w; }),
      wahl('Zeit', z.pruefungMinuten, [[0, 'Ohne Zeitlimit'], [20, '20 Min.'], [45, '45 Min.'], [90, '90 Min.']], (w) => { z.pruefungMinuten = w; }),
      z.laeuft === 'pruefung' ? laufZeile() : h('button', { class: 'knopf gross', style: { marginTop: '8px' }, disabled: !!z.laeuft, onclick: pruefungStarten }, ic('pruefung', 16), 'Probeklausur starten'),
      fehlerZeile('pruefung')),
    k.pruefungen.length ? h('section', { class: 'dd-block' }, h('div', { class: 'dd-block-kopf' }, h('h2', {}, 'Bisherige Klausuren')),
      k.pruefungen.map((x) => h('details', { class: 'dd-pr-alt' }, h('summary', {}, h('span', { class: 'dd-note' }, x.note), h('span', { class: 'fett wachsen' }, `${x.prozent} % · ${x.anzahl} Aufgaben · ${x.minuten || 1} Min.`), h('span', { class: 'dd-mini' }, lyra.zeitText(x.zeit))),
        x.bericht ? mdElement(x.bericht, 'dd-text') : null))) : null);
}

// ================================================================== Fusion (mehrere Plugins, eine Aufgabe)

function kursMarkdown(k) {
  return [`# Lernkurs: ${k.titel}`, '', k.voraussetzungen.length ? `**Voraussetzungen:** ${k.voraussetzungen.join(', ')}` : '', '',
    ...k.schritte.flatMap((s, i) => [`## ${i + 1}. ${s.titel}`, s.ziel ? `_${s.ziel}_` : '', '', ...s.inhalte.map((x) => `- ${x}`), '']),
    '_In Deep Dive öffnen, um den Kurs Schritt für Schritt mit Fragen, Checks, Wiederholungen und Probeklausur zu lernen._'].join('\n');
}

function fusionAnbieten() {
  lyra.fusion.anbieten({
    kurs: async (a, { status }) => {
      z.lehrer = a.lehrer || z.lehrer;
      fusionMaterial = lyra.fusion.materialOhneAufgabe(a, online() ? 12000 : 6000);
      z.statusHook = status;
      // Das Thema der Aufgabe – nicht der Titel eines Ergebnisses (sonst hieße der Kurs „Recherche: …“)
      const thema = String(lyra.fusion.thema(a) || a.anweisung || a.aufgabe || '').replace(/^(Lernkurs|Kurs|Recherche)\s*(zu|über|:)\s*/i, '').slice(0, 160);
      let k;
      try { k = await kursAnlegen(thema, text(a.anweisung) !== thema ? text(a.anweisung).slice(0, 300) : '', { sichtbar: false }); } finally { fusionMaterial = ''; z.statusHook = null; }
      if (!k) throw new Error(z.stillerFehler || z.fehler || 'Deep Dive konnte keinen Lernkurs anlegen.');
      return {
        art: 'plan', titel: `Lernkurs: ${k.titel}`, markdown: kursMarkdown(k),
        daten: { name: k.titel, voraussetzungen: k.voraussetzungen, meilensteine: k.schritte.map((s) => ({ titel: s.titel, ziel: s.ziel, aufgaben: s.inhalte.map((x) => ({ titel: x })) })) },
        oeffnen: 'kurs/' + k.id,
      };
    },
    lektion: async (a, { status }) => {
      z.lehrer = a.lehrer || z.lehrer;
      const thema = lyra.fusion.thema(a);
      const material = lyra.fusion.materialOhneAufgabe(a, online() ? 14000 : 6000);
      z.statusHook = status;
      let r;
      try {
        r = await ki('lektion', {
          prompt: `Halte eine vollständige Lektion zu: ${thema}\n${a.aufgabe && a.aufgabe !== thema ? `(Teil der Aufgabe: ${a.aufgabe})\n` : ''}\n${material ? `Material aus anderen Plugins – nutze es, korrigiere aber, was falsch ist:\n${material}\n\n` : ''}\
Schreib sie wie ein exzellentes Lehrbuchkapitel in Markdown: „## Worum es geht“ (Motivation, 3–4 Sätze), „## Grundbegriffe“ \
(präzise Definitionen), „## Kernideen“ (Schritt für Schritt, mit Begründung), „## Durchgerechnetes Beispiel“, „## Typische \
Fehler“, „## Merksätze“ (Stichpunkte) und „## Teste dich“ (3 Fragen, darunter die Antworten in einem Abschnitt \
„### Antworten“). Formeln in LaTeX. Gründlich, lückenlos und verständlich.`,
        }, false);
      } finally { z.statusHook = null; }
      const md1 = text(r && r.text);
      if (!md1) throw new Error(z.stillerFehler || 'Deep Dive konnte die Lektion nicht schreiben.');
      return { art: 'dokument', titel: `Lektion: ${kuerzen(thema, 70)}`, markdown: md1 };
    },
  });
}

start().catch(() => {}).then(fusionAnbieten);
