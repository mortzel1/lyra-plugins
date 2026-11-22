'use strict';
/*
 * Crux – Kreuzworträtsel aus deinem Lernstoff. Die KI liefert Begriffe und Rätselfragen (aus deinen Unterlagen oder frei),
 * Crux baut daraus ein Gitter (eigener Layout-Algorithmus) und macht ein Spiel daraus: Uhr, Punkte, Joker, Rekorde.
 */
const { h } = lyra;

const GROESSEN = { klein: ['Klein', '8 Wörter', 8], mittel: ['Mittel', '12 Wörter', 12], gross: ['Groß', '16 Wörter', 16] };
const STUFEN = { leicht: ['Leicht', 'direkte Fragen'], mittel: ['Mittel', 'etwas Nachdenken'], schwer: ['Schwer', 'knifflig umschrieben'] };
const QUELLEN = [['beides', 'Unterlagen + Wissen', ''], ['unterlagen', 'Nur meine Unterlagen', ''], ['wissen', 'Allgemeinwissen', '']];
const IDEEN = ['Photosynthese', 'Französische Revolution', 'Datenstrukturen', 'Zellbiologie', 'Analysis Grundbegriffe', 'Planeten', 'Römisches Reich', 'Chemische Bindungen', 'Elektrotechnik', 'Psychologie Grundbegriffe'];
const PUNKTE = { wort: 100, buchstabe: 30, wortAufdecken: 120, pruefen: 20 };

const SYSTEM = `Du bist „Crux“ in Lyra und erfindest Kreuzworträtsel für Studierende: fachlich korrekte Begriffe und kurze, \
eindeutige Rätselfragen auf Deutsch. Eine Rätselfrage verrät das Lösungswort nie direkt und enthält es nicht.`;
const SCHEMA = {
  type: 'object',
  properties: { begriffe: { type: 'array', items: { type: 'object', properties: { antwort: { type: 'string' }, hinweis: { type: 'string' } }, required: ['antwort', 'hinweis'] } }, titel: { type: 'string' } },
  required: ['begriffe', 'titel'],
};

const z = {
  info: null,
  lehrer: 'lyra',
  einst: { groesse: 'mittel', stufe: 'mittel', quelle: 'beides', toene: true },
  thema: '',
  themen: [],
  liste: [],
  r: null, // aktuelles Rätsel
  ansicht: 'start', // start | spiel
  laeuft: false,
  status: '',
  fehler: null,
  wahl: { x: 0, y: 0, dir: 'h' },
  uhr: null,
};
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const k = (x, y) => `${x},${y}`;
const abgebrochen = (e) => /ABGEBROCHEN|Abgebrochen/.test(String((e && e.message) || e));

// ================================================================== Töne und Konfetti

let audio = null;
function ton(art) {
  if (!z.einst.toene) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const noten = { tipp: [[880, 0, 0.05, 0.05]], wort: [[660, 0, 0.12, 0.12], [880, 0.09, 0.16, 0.12]], fertig: [[523, 0, 0.18, 0.14], [659, 0.12, 0.18, 0.14], [784, 0.24, 0.18, 0.14], [1047, 0.36, 0.4, 0.14]], falsch: [[220, 0, 0.18, 0.1]] }[art] || [];
    for (const [f, t, d, laut] of noten) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = art === 'falsch' ? 'triangle' : 'sine';
      o.frequency.value = f;
      const s = audio.currentTime + t;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(laut, s + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s + d);
      o.connect(g).connect(audio.destination);
      o.start(s);
      o.stop(s + d + 0.05);
    }
  } catch (_) {}
}

function konfetti(n = 120) {
  const farben = ['#0369a1', '#38bdf8', '#fbbf24', '#f472b6', '#34d399', '#a78bfa'];
  for (let i = 0; i < n; i++) {
    const s = h('div', { class: 'konfetti', style: { left: `${Math.random() * 100}vw`, background: farben[i % farben.length], animationDelay: `${Math.random() * 0.6}s`, animationDuration: `${1.8 + Math.random() * 1.4}s`, transform: `rotate(${Math.random() * 360}deg)` } });
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 3800);
  }
}

// ================================================================== Start und Speichern

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...z.einst, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  const lehrer = z.info.lehrer || [];
  z.lehrer = lehrer.some((l) => l.kennung === z.einst.lehrer) ? z.einst.lehrer : z.info.standardLehrer || 'lyra';
  try { z.liste = ((await lyra.speicher.lesen('index')) || []).filter((x) => x && x.id); } catch (_) {}
  lyra.bei('zurueck', zurueck);
  lyra.bei('einstellungen', einstellungen);
  document.addEventListener('keydown', taste);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('raetsel/')) await oeffnen(route.slice(8));
  zeichnen();
  lyra.themen().then((t) => { z.themen = t || []; if (z.ansicht === 'start') zeichnen(); }).catch(() => {});
  startseite();
}

async function merken() {
  try { await lyra.speicher.schreiben('einstellungen', { ...z.einst, lehrer: z.lehrer }); } catch (_) {}
}

function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.laeuft) return lyra.abbrechen().catch(() => {});
  if (z.ansicht === 'spiel') { sichern(); uhrStopp(); z.ansicht = 'start'; z.r = null; return zeichnen(); }
  lyra.zurueck();
}

const meta = (r) => ({ id: r.id, titel: r.titel, zeit: r.zeit, woerter: r.woerter.length, anteil: anteil(r), geloest: r.geloest, punkte: r.punkte, rekord: r.rekord || 0, geaendert: r.geaendert || r.zeit });

async function sichern(r = z.r) {
  if (!r) return;
  r.geaendert = lyra.jetzt();
  try { await lyra.speicher.schreiben('raetsel/' + r.id, r); } catch (_) {}
  z.liste = [meta(r), ...z.liste.filter((x) => x.id !== r.id)].slice(0, 200);
  try { await lyra.speicher.schreiben('index', z.liste); } catch (_) {}
  startseite();
}

async function oeffnen(id) {
  try {
    const r = await lyra.speicher.lesen('raetsel/' + id);
    if (r && Array.isArray(r.woerter)) { z.r = r; z.ansicht = 'spiel'; ersteZelle(); uhrStart(); }
  } catch (_) {}
}

async function entfernen(id) {
  if (!(await lyra.bestaetigen({ titel: 'Rätsel löschen?', text: 'Das Rätsel und dein Spielstand sind dann weg.', ja: 'Löschen', gefahr: true }))) return;
  try { await lyra.speicher.loeschen('raetsel/' + id); } catch (_) {}
  z.liste = z.liste.filter((x) => x.id !== id);
  try { await lyra.speicher.schreiben('index', z.liste); } catch (_) {}
  startseite();
  zeichnen();
}

function startseite() {
  const offen = z.liste.filter((x) => !x.geloest && x.anteil > 0).slice(0, 1).map((x) => ({
    id: 'weiter-' + x.id, titel: `Kreuzworträtsel: ${x.titel}`, untertitel: `${Math.round(x.anteil * 100)} % gelöst – weiterknobeln?`,
    route: 'raetsel/' + x.id, zeigen_bis: lyra.jetzt() + 10 * 86400, geaendert: x.geaendert,
  }));
  lyra.startseite(offen).catch(() => {});
}

// ================================================================== Begriffe und Gitter

/** Großbuchstaben wie im Kreuzworträtsel: Ä → AE, ß → SS, nur A–Z. */
function normal(w) {
  return String(w || '').toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ẞ|ß/g, 'SS')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, '');
}

function pruefen(b) {
  const roh = text(b && b.antwort);
  // Nur einzelne Wörter (Bindestrich-Wörter werden zusammengezogen)
  if (!roh || /\s/.test(roh.replace(/-/g, ''))) return null;
  const wort = normal(roh);
  const hinweis = text(b.hinweis).replace(/\s+/g, ' ').slice(0, 140);
  if (wort.length < 3 || wort.length > 14 || !hinweis) return null;
  if (normal(hinweis).includes(wort)) return null; // verrät die Lösung
  // Kleine Modelle geben manchmal Anweisungen statt einer Rätselfrage zurück
  if (/^(falsch|richtig|achtung|hinweis|antwort|frage|lösung)\b/i.test(hinweis) || /\bkeine\s+(formeln|zahlen|abkürzungen|englischen|leerzeichen)\b|rätselfrage|buchstaben\)/i.test(hinweis)) return null;
  if (hinweis.split(/\s+/).length < 2) return null;
  return { wort, anzeige: roh, hinweis };
}

/** Wörter ins Gitter legen: viele Versuche, das dichteste Gitter mit den meisten Wörtern gewinnt. */
function gitterBauen(begriffe, ziel) {
  let bestes = null;
  for (let versuch = 0; versuch < 80; versuch++) {
    const reihe = versuch === 0 ? [...begriffe].sort((a, b) => b.wort.length - a.wort.length)
      : [...begriffe].map((b) => ({ b, s: b.wort.length + Math.random() * 6 })).sort((a, b) => b.s - a.s).map((x) => x.b);
    const g = legen(reihe, ziel);
    const flaeche = (g.maxX - g.minX + 1) * (g.maxY - g.minY + 1);
    const seiten = Math.max(g.maxX - g.minX + 1, g.maxY - g.minY + 1) / Math.min(g.maxX - g.minX + 1, g.maxY - g.minY + 1);
    g.wert = g.woerter.length * 1000 + g.kreuzungen * 40 - flaeche - seiten * 15;
    if (!bestes || g.wert > bestes.wert) bestes = g;
  }
  return bestes;
}

function legen(reihe, ziel) {
  const zellen = new Map(); // key → {c, dirs:Set}
  const woerter = [];
  let kreuzungen = 0;
  const g = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const setzen = (b, x, y, dir) => {
    const dx = dir === 'h' ? 1 : 0, dy = dir === 'v' ? 1 : 0;
    for (let i = 0; i < b.wort.length; i++) {
      const key = k(x + dx * i, y + dy * i);
      const z0 = zellen.get(key) || { c: b.wort[i], dirs: new Set() };
      z0.dirs.add(dir);
      zellen.set(key, z0);
      g.minX = Math.min(g.minX, x + dx * i); g.maxX = Math.max(g.maxX, x + dx * i);
      g.minY = Math.min(g.minY, y + dy * i); g.maxY = Math.max(g.maxY, y + dy * i);
    }
    woerter.push({ ...b, x, y, dir });
  };
  const passt = (w, x, y, dir) => {
    const dx = dir === 'h' ? 1 : 0, dy = dir === 'v' ? 1 : 0;
    if (zellen.has(k(x - dx, y - dy)) || zellen.has(k(x + dx * w.length, y + dy * w.length))) return -1;
    let kr = 0;
    for (let i = 0; i < w.length; i++) {
      const cx = x + dx * i, cy = y + dy * i;
      const c = zellen.get(k(cx, cy));
      if (c) {
        if (c.c !== w[i] || c.dirs.has(dir)) return -1;
        kr++;
      } else if (zellen.has(k(cx + dy, cy + dx)) || zellen.has(k(cx - dy, cy - dx))) return -1;
    }
    return kr;
  };
  if (!reihe.length) return { woerter, kreuzungen, ...g, zellen };
  setzen(reihe[0], 0, 0, 'h');
  const rest = reihe.slice(1);
  // Mehrere Runden: Wörter, die erst später einen Kreuzungspunkt finden, bekommen eine zweite Chance
  for (let runde = 0; runde < 2 && woerter.length < ziel; runde++) {
    for (const b of [...rest]) {
      if (woerter.length >= ziel) break;
      if (woerter.some((w) => w.wort === b.wort)) continue;
      let bester = null;
      for (const p of woerter) {
        for (let i = 0; i < p.wort.length; i++) {
          for (let j = 0; j < b.wort.length; j++) {
            if (p.wort[i] !== b.wort[j]) continue;
            const dir = p.dir === 'h' ? 'v' : 'h';
            const cx = p.dir === 'h' ? p.x + i : p.x, cy = p.dir === 'h' ? p.y : p.y + i;
            const x = dir === 'h' ? cx - j : cx, y = dir === 'v' ? cy - j : cy;
            const kr = passt(b.wort, x, y, dir);
            if (kr < 1) continue;
            const breite = Math.max(g.maxX, dir === 'h' ? x + b.wort.length - 1 : x) - Math.min(g.minX, x) + 1;
            const hoehe = Math.max(g.maxY, dir === 'v' ? y + b.wort.length - 1 : y) - Math.min(g.minY, y) + 1;
            const s = kr * 100 - breite * hoehe - Math.abs(breite - hoehe) * 3;
            if (!bester || s > bester.s) bester = { x, y, dir, s, kr };
          }
        }
      }
      if (bester) { setzen(b, bester.x, bester.y, bester.dir); kreuzungen += bester.kr; }
    }
  }
  return { woerter, kreuzungen, ...g };
}

/** Gitter auf 0,0 verschieben und nummerieren wie im Rätselheft. */
function raetselAus(g, titel, thema) {
  const woerter = g.woerter.map((w) => ({ ...w, x: w.x - g.minX, y: w.y - g.minY }));
  const breite = g.maxX - g.minX + 1, hoehe = g.maxY - g.minY + 1;
  const starts = [...new Set(woerter.map((w) => k(w.x, w.y)))].map((s) => s.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const nr = new Map(starts.map((s, i) => [k(s[0], s[1]), i + 1]));
  woerter.forEach((w) => { w.nr = nr.get(k(w.x, w.y)); });
  const loesung = {};
  for (const w of woerter) for (let i = 0; i < w.wort.length; i++) loesung[k(w.x + (w.dir === 'h' ? i : 0), w.y + (w.dir === 'v' ? i : 0))] = w.wort[i];
  return {
    id: lyra.neueId(), zeit: lyra.jetzt(), titel, thema, breite, hoehe, woerter, loesung, nummern: Object.fromEntries(nr),
    eingabe: {}, aufgedeckt: {}, falsch: {}, sekunden: 0, joker: 0, punkte: 0, geloest: false, geloestWoerter: [],
  };
}

// ================================================================== Rätsel erstellen

function status(t) { z.status = t; const el = document.getElementById('status'); if (el) el.textContent = t; }

async function erstellen() {
  const thema = text(z.thema);
  if (!thema || z.laeuft) return;
  const ziel = GROESSEN[z.einst.groesse][2];
  z.laeuft = true;
  z.fehler = null;
  status('Crux sucht passende Begriffe …');
  zeichnen();
  try {
    let block = '';
    if (z.einst.quelle !== 'wissen') {
      try { block = (await lyra.suchen(thema, z.lehrer === 'lyra' ? 6 : 10)).block || ''; } catch (_) {}
      if (!block && z.einst.quelle === 'unterlagen') throw new Error('Dazu habe ich in deinen Unterlagen nichts gefunden – wähl „Unterlagen + Wissen“ oder „Allgemeinwissen“.');
    }
    const anzahl = ziel + 8; // mehr Begriffe als nötig: nicht jedes Wort lässt sich kreuzen
    let begriffe = [];
    let titel = '';
    for (let versuch = 0; versuch < 2 && begriffe.length < ziel + 2; versuch++) {
      const schon = begriffe.map((b) => b.anzeige).join(', ');
      const r = await lyra.ki({
        lehrer: z.lehrer, system: SYSTEM, schema: SCHEMA, zaehlen: { schluessel: 'antwort', wort: 'Begriff' },
        prompt: `Thema: ${thema}\nSchwierigkeit der Rätselfragen: ${STUFEN[z.einst.stufe][0]} (${STUFEN[z.einst.stufe][1]})\n\n${block ? `Auszüge aus meinen Unterlagen (nimm die Begriffe vorrangig daraus${z.einst.quelle === 'beides' ? ', ergänze mit Wissen' : ''}):\n${block}\n\n` : ''}\
${schon ? `Diese Begriffe habe ich schon – nimm andere: ${schon}\n\n` : ''}Finde ${anzahl} wichtige Fachbegriffe zum Thema für ein Kreuzworträtsel. \
"antwort": GENAU EIN Wort ohne Leerzeichen (3–13 Buchstaben, keine Abkürzungen, keine Formeln, keine Zahlen). "hinweis": kurze Rätselfrage \
(höchstens 12 Wörter), die das Wort beschreibt, ohne es oder seinen Wortstamm zu nennen. Mische kurze und lange Wörter. "titel": \
ein kurzer, witziger Titel für das Rätsel.\n\nAntwort als JSON: {"begriffe": [{"antwort": "", "hinweis": ""}], "titel": ""}`,
      }, (x) => { if (x.art === 'hinweis') status(x.text); });
      if (r && r.lehrer) z.lehrer = r.lehrer;
      const j = (r && r.json) || {};
      titel = titel || text(j.titel);
      for (const b of (j.begriffe || []).map(pruefen).filter(Boolean)) if (!begriffe.some((x) => x.wort === b.wort)) begriffe.push(b);
    }
    if (begriffe.length < 5) throw new Error('Crux hat zu wenige brauchbare Begriffe gefunden – versuch ein anderes Thema oder „Allgemeinwissen“.');
    status('Crux baut das Gitter …');
    await new Promise((ok) => setTimeout(ok, 30));
    const g = gitterBauen(begriffe, ziel);
    if (g.woerter.length < Math.min(5, ziel)) throw new Error('Die Begriffe ließen sich nicht gut kreuzen – bitte noch einmal versuchen.');
    z.r = raetselAus(g, (titel || thema).slice(0, 80), thema);
    await sichern();
    z.ansicht = 'spiel';
    z.thema = '';
    ersteZelle();
    uhrStart();
    ton('wort');
  } catch (e) {
    if (!abgebrochen(e)) z.fehler = String((e && e.message) || e);
  }
  z.laeuft = false;
  zeichnen();
}

// ================================================================== Spielen

const anteil = (r) => { const n = Object.keys(r.loesung).length; return n ? Object.keys(r.loesung).filter((key) => r.eingabe[key] === r.loesung[key]).length / n : 0; };
const zellenVon = (w) => Array.from({ length: w.wort.length }, (_, i) => k(w.x + (w.dir === 'h' ? i : 0), w.y + (w.dir === 'v' ? i : 0)));
const wortAn = (x, y, dir) => z.r.woerter.find((w) => w.dir === dir && zellenVon(w).includes(k(x, y)));
const aktivesWort = () => wortAn(z.wahl.x, z.wahl.y, z.wahl.dir) || wortAn(z.wahl.x, z.wahl.y, z.wahl.dir === 'h' ? 'v' : 'h');

function ersteZelle() {
  const w = [...z.r.woerter].sort((a, b) => a.nr - b.nr)[0];
  const frei = zellenVon(w).find((key) => !z.r.eingabe[key]) || k(w.x, w.y);
  const [x, y] = frei.split(',').map(Number);
  z.wahl = { x, y, dir: w.dir };
}

function uhrStart() {
  uhrStopp();
  if (!z.r || z.r.geloest) return;
  z.uhr = setInterval(() => {
    if (!z.r || z.r.geloest || document.hidden) return;
    z.r.sekunden++;
    const el = document.getElementById('uhr');
    if (el) el.textContent = zeitText(z.r.sekunden);
    if (z.r.sekunden % 15 === 0) sichern();
  }, 1000);
}
function uhrStopp() { if (z.uhr) clearInterval(z.uhr); z.uhr = null; }
const zeitText = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function waehlen(x, y) {
  if (!z.r.loesung[k(x, y)]) return;
  if (z.wahl.x === x && z.wahl.y === y) {
    const anders = z.wahl.dir === 'h' ? 'v' : 'h';
    if (wortAn(x, y, anders)) z.wahl.dir = anders;
  } else {
    z.wahl.x = x; z.wahl.y = y;
    if (!wortAn(x, y, z.wahl.dir)) z.wahl.dir = z.wahl.dir === 'h' ? 'v' : 'h';
  }
  gitterMalen();
}

function wortWaehlen(w) {
  const frei = zellenVon(w).find((key) => z.r.eingabe[key] !== z.r.loesung[key]) || k(w.x, w.y);
  const [x, y] = frei.split(',').map(Number);
  z.wahl = { x, y, dir: w.dir };
  gitterMalen();
}

function schritt(d) {
  const dx = z.wahl.dir === 'h' ? d : 0, dy = z.wahl.dir === 'v' ? d : 0;
  const nx = z.wahl.x + dx, ny = z.wahl.y + dy;
  if (z.r.loesung[k(nx, ny)]) { z.wahl.x = nx; z.wahl.y = ny; }
}

function naechstesWort(rueck = false) {
  const liste = [...z.r.woerter].sort((a, b) => (a.dir === b.dir ? a.nr - b.nr : a.dir === 'h' ? -1 : 1));
  const akt = aktivesWort();
  let i = liste.indexOf(akt);
  for (let n = 0; n < liste.length; n++) {
    i = (i + (rueck ? -1 : 1) + liste.length) % liste.length;
    if (zellenVon(liste[i]).some((key) => z.r.eingabe[key] !== z.r.loesung[key])) return wortWaehlen(liste[i]);
  }
}

function eintragen(c) {
  const key = k(z.wahl.x, z.wahl.y);
  if (z.r.geloest) return;
  if (!z.r.aufgedeckt[key]) { z.r.eingabe[key] = c; delete z.r.falsch[key]; }
  ton('tipp');
  const w = aktivesWort();
  schritt(1);
  pruefeFortschritt(w);
}

function pruefeFortschritt(w) {
  const r = z.r;
  if (w && !r.geloestWoerter.includes(w.nr + w.dir) && zellenVon(w).every((key) => r.eingabe[key] === r.loesung[key])) {
    r.geloestWoerter.push(w.nr + w.dir);
    r.punkte += PUNKTE.wort;
    ton('wort');
    const el = document.querySelector(`[data-wort="${w.nr}${w.dir}"]`);
    if (el) el.classList.add('neu-geloest');
    if (!Object.keys(r.loesung).every((key) => r.eingabe[key] === r.loesung[key])) naechstesWort(); // weiter zur nächsten offenen Frage
  }
  if (Object.keys(r.loesung).every((key) => r.eingabe[key] === r.loesung[key])) return geloest();
  gitterMalen();
}

async function geloest() {
  const r = z.r;
  r.geloest = true;
  uhrStopp();
  const zeitBonus = Math.max(0, r.woerter.length * 40 - r.sekunden) * 2;
  r.punkte = Math.max(0, r.punkte + zeitBonus);
  r.sterne = r.joker === 0 ? 3 : r.joker <= 2 ? 2 : 1;
  r.neuerRekord = r.punkte > (r.rekord || 0);
  if (r.neuerRekord) r.rekord = r.punkte;
  await sichern();
  ton('fertig');
  konfetti();
  zeichnen();
}

function taste(e) {
  if (z.ansicht !== 'spiel' || !z.r || document.querySelector('.dialog-grund')) return;
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.key;
  if (/^[a-zA-ZäöüÄÖÜß]$/.test(t)) {
    e.preventDefault();
    for (const c of normal(t)) eintragen(c);
    return;
  }
  const pfeile = { ArrowRight: ['h', 1], ArrowLeft: ['h', -1], ArrowDown: ['v', 1], ArrowUp: ['v', -1] };
  if (pfeile[t]) {
    e.preventDefault();
    const [dir, d] = pfeile[t];
    if (z.wahl.dir !== dir && wortAn(z.wahl.x, z.wahl.y, dir)) z.wahl.dir = dir;
    else {
      // zur nächsten Rätselzelle in diese Richtung springen
      for (let i = 1; i < 20; i++) {
        const nx = z.wahl.x + (dir === 'h' ? d * i : 0), ny = z.wahl.y + (dir === 'v' ? d * i : 0);
        if (z.r.loesung[k(nx, ny)]) { z.wahl.x = nx; z.wahl.y = ny; if (!wortAn(nx, ny, z.wahl.dir)) z.wahl.dir = dir; break; }
      }
    }
    return gitterMalen();
  }
  if (t === 'Backspace') {
    e.preventDefault();
    const key = k(z.wahl.x, z.wahl.y);
    if (z.r.eingabe[key] && !z.r.aufgedeckt[key]) delete z.r.eingabe[key];
    else { schritt(-1); const k2 = k(z.wahl.x, z.wahl.y); if (!z.r.aufgedeckt[k2]) delete z.r.eingabe[k2]; }
    delete z.r.falsch[k(z.wahl.x, z.wahl.y)];
    return gitterMalen();
  }
  if (t === ' ') { e.preventDefault(); return waehlen(z.wahl.x, z.wahl.y); }
  if (t === 'Tab' || t === 'Enter') { e.preventDefault(); return naechstesWort(e.shiftKey); }
}

function joker(art) {
  const r = z.r;
  if (r.geloest) return;
  const w = aktivesWort();
  if (art === 'buchstabe') {
    const key = k(z.wahl.x, z.wahl.y);
    if (r.eingabe[key] === r.loesung[key]) return lyra.toast('Dieser Buchstabe stimmt schon.');
    r.eingabe[key] = r.loesung[key];
    r.aufgedeckt[key] = true;
    delete r.falsch[key];
    r.punkte -= PUNKTE.buchstabe;
    r.joker++;
    schritt(1);
    return pruefeFortschritt(w);
  }
  if (art === 'wort' && w) {
    for (const key of zellenVon(w)) { if (r.eingabe[key] !== r.loesung[key]) { r.eingabe[key] = r.loesung[key]; r.aufgedeckt[key] = true; } delete r.falsch[key]; }
    r.punkte -= PUNKTE.wortAufdecken;
    r.joker++;
    return pruefeFortschritt(w);
  }
  if (art === 'pruefen') {
    let falsch = 0;
    for (const key of Object.keys(r.eingabe)) if (r.eingabe[key] && r.eingabe[key] !== r.loesung[key]) { r.falsch[key] = true; falsch++; }
    r.punkte -= PUNKTE.pruefen;
    r.joker++;
    if (falsch) ton('falsch');
    lyra.toast(falsch ? `${falsch} Buchstabe${falsch === 1 ? '' : 'n'} falsch – rot markiert` : '✓ Alles, was drinsteht, stimmt!', falsch ? '' : 'ok');
    sichern();
    return gitterMalen();
  }
}

async function aufloesen() {
  if (!(await lyra.bestaetigen({ titel: 'Lösung zeigen?', text: 'Das Rätsel ist dann beendet – ohne Punkte und Rekord.', ja: 'Lösung zeigen' }))) return;
  const r = z.r;
  for (const key of Object.keys(r.loesung)) if (r.eingabe[key] !== r.loesung[key]) { r.eingabe[key] = r.loesung[key]; r.aufgedeckt[key] = true; }
  r.geloest = true;
  r.aufgegeben = true;
  r.punkte = 0;
  r.sterne = 0;
  uhrStopp();
  await sichern();
  zeichnen();
}

async function nochmal() {
  const r = z.r;
  Object.assign(r, { eingabe: {}, aufgedeckt: {}, falsch: {}, sekunden: 0, joker: 0, punkte: 0, geloest: false, geloestWoerter: [], aufgegeben: false, neuerRekord: false });
  await sichern();
  ersteZelle();
  uhrStart();
  zeichnen();
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  app.replaceChildren(z.ansicht === 'spiel' && z.r ? spielAnsicht(z.r) : startAnsicht());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) e.focus();
  lyra.titel(z.ansicht === 'spiel' && z.r ? z.r.titel : '');
}

function startAnsicht() {
  const optionen = h('div', { class: 'zeile umbruch', style: { gap: '8px' } },
    z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; merken(); zeichnen(); }) : null,
    lyra.auswahl({ titel: 'Größe', optionen: Object.entries(GROESSEN).map(([w, [n, u]]) => [w, n, u]), wert: z.einst.groesse, beiWahl: (w) => { z.einst.groesse = w; merken(); zeichnen(); } }),
    lyra.auswahl({ titel: 'Fragen', optionen: Object.entries(STUFEN).map(([w, [n, u]]) => [w, n, u]), wert: z.einst.stufe, beiWahl: (w) => { z.einst.stufe = w; merken(); zeichnen(); } }),
    lyra.auswahl({ symbol: '📚', optionen: QUELLEN, wert: z.einst.quelle, beiWahl: (w) => { z.einst.quelle = w; merken(); zeichnen(); }, breit: true }));
  return h('div', { class: 'seite' },
    h('div', { class: 'held' },
      h('div', { class: 'held-gitter' }, ...'CRUX'.split('').map((c, i) => h('span', { style: { animationDelay: `${i * 0.12}s` } }, c))),
      h('h1', {}, 'Kreuzworträtsel aus deinem Lernstoff'),
      h('div', { class: 'leise' }, 'Nenn ein Thema – Crux baut dir ein Rätsel. Knobeln, kreuzen, Rekord jagen.')),
    lyra.verfasser({
      wert: z.thema, platzhalter: 'Thema, z. B. „Zellbiologie“ oder „Datenstrukturen“', beiEingabe: (v) => { z.thema = v; }, beiSenden: erstellen,
      knopf: 'Rätsel bauen', symbol: '✏️', deaktiviert: z.laeuft, feld: 'thema', unten: optionen,
    }),
    z.laeuft ? lyra.arbeit(z.status) : null,
    z.fehler ? lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; erstellen(); }) : null,
    !z.laeuft && !z.thema.trim() ? h('div', { style: { marginTop: '14px' } },
      lyra.vorschlaege(z.themen.length ? z.themen : lyra.mischen(IDEEN), (t) => { z.thema = t; zeichnen(); }, { max: 6, titel: z.themen.length ? 'Aus deinen Unterlagen' : 'Ideen' })) : null,
    z.liste.length ? lyra.abschnitt(`Deine Rätsel · ${z.liste.length}`, h('div', { class: 'raetsel-liste' }, z.liste.map((x) =>
      h('div', { class: 'raetsel-karte', onclick: async () => { await oeffnen(x.id); zeichnen(); } },
        h('div', { class: 'mini-gitter' }, x.geloest ? '✓' : `${Math.round((x.anteil || 0) * 100)}%`),
        h('div', { class: 'wachsen', style: { minWidth: 0 } },
          h('div', { class: 'fett eine-zeile' }, x.titel),
          h('div', { class: 'klein leise' }, [`${x.woerter} Wörter`, x.geloest ? 'gelöst' : x.anteil ? 'angefangen' : 'neu', x.rekord ? `🏆 ${x.rekord}` : ''].filter(Boolean).join(' · '))),
        h('button', { class: 'knopf symbol', title: 'Löschen', onclick: (e) => { e.stopPropagation(); entfernen(x.id); } }, '🗑'))))) : null);
}

function gitterMalen() {
  const el = document.getElementById('gitter');
  if (!el) return zeichnen();
  el.replaceWith(gitter(z.r));
  const hw = document.getElementById('aktiv-hinweis');
  const w = aktivesWort();
  if (hw && w) hw.replaceChildren(h('b', {}, `${w.nr} ${w.dir === 'h' ? '→' : '↓'}`), ' ', w.hinweis, h('span', { class: 'leise' }, ` (${w.wort.length})`));
  document.querySelectorAll('.hinweis-zeile').forEach((e) => {
    const id = e.dataset.wort;
    e.classList.toggle('aktiv', !!w && id === w.nr + w.dir);
    e.classList.toggle('fertig', z.r.geloestWoerter.includes(id));
  });
  const p = document.getElementById('punkte');
  if (p) p.textContent = `⭐ ${z.r.punkte}`;
  const f = document.getElementById('fortschritt');
  if (f) f.style.width = `${Math.round(anteil(z.r) * 100)}%`;
  sichernSpaeter();
}
let sicherZeit = null;
function sichernSpaeter() { clearTimeout(sicherZeit); sicherZeit = setTimeout(() => sichern(), 1500); }

function gitter(r) {
  const w = aktivesWort();
  const imWort = new Set(w ? zellenVon(w) : []);
  // Zellgröße passend zur Fensterbreite (neben der Frageliste bzw. darunter)
  const platz = window.innerWidth > 820 ? Math.min(window.innerWidth, 1100) - 400 : window.innerWidth - 70;
  const zelle = Math.max(24, Math.min(40, Math.floor(platz / r.breite) - 2));
  const el = h('div', { class: 'gitter', id: 'gitter', style: { gridTemplateColumns: `repeat(${r.breite}, var(--zelle))`, '--zelle': zelle + 'px' } });
  for (let y = 0; y < r.hoehe; y++) {
    for (let x = 0; x < r.breite; x++) {
      const key = k(x, y);
      if (!r.loesung[key]) { el.appendChild(h('div', { class: 'leer' })); continue; }
      const cls = ['zelle'];
      if (imWort.has(key)) cls.push('im-wort');
      if (z.wahl.x === x && z.wahl.y === y) cls.push('aktiv');
      if (r.falsch[key]) cls.push('falsch');
      if (r.aufgedeckt[key]) cls.push('aufgedeckt');
      if (r.geloest) cls.push('fertig');
      el.appendChild(h('div', { class: cls.join(' '), onclick: () => waehlen(x, y) },
        r.nummern[key] ? h('span', { class: 'nr' }, String(r.nummern[key])) : null,
        h('span', { class: 'buchstabe' }, r.eingabe[key] || '')));
    }
  }
  return el;
}

function spielAnsicht(r) {
  const liste = (dir) => [...r.woerter].filter((w) => w.dir === dir).sort((a, b) => a.nr - b.nr).map((w) =>
    h('div', { class: 'hinweis-zeile' + (r.geloestWoerter.includes(w.nr + w.dir) ? ' fertig' : ''), 'data-wort': w.nr + w.dir, onclick: () => wortWaehlen(w) },
      h('b', {}, String(w.nr)), h('span', {}, w.hinweis, h('span', { class: 'leise' }, ` (${w.wort.length})`))));
  const w = aktivesWort();
  const kopf = h('div', { class: 'spiel-kopf' },
    h('button', { class: 'knopf text klein', style: { paddingLeft: 0 }, onclick: zurueck }, '← Rätsel'),
    h('div', { class: 'wachsen', style: { minWidth: 0 } }, h('div', { class: 'fett eine-zeile' }, r.titel)),
    h('span', { class: 'pill', id: 'uhr' }, zeitText(r.sekunden)),
    h('span', { class: 'pill', id: 'punkte' }, `⭐ ${r.punkte}`));
  const ende = r.geloest ? h('div', { class: 'ende' + (r.aufgegeben ? ' aufgegeben' : '') },
    r.aufgegeben ? h('div', { class: 'fett' }, 'Lösung aufgedeckt – beim nächsten Mal klappt’s!')
      : h('div', {},
        h('div', { class: 'sterne' }, '★'.repeat(r.sterne || 0) + '☆'.repeat(3 - (r.sterne || 0))),
        h('div', { class: 'ende-titel' }, r.neuerRekord ? '🏆 Neuer Rekord!' : '🎉 Gelöst!'),
        h('div', { class: 'leise' }, `${r.punkte} Punkte · ${zeitText(r.sekunden)} · ${r.joker} Joker`)),
    h('div', { class: 'zeile', style: { justifyContent: 'center', gap: '8px', marginTop: '10px' } },
      h('button', { class: 'knopf', onclick: nochmal }, '🔁 Nochmal'),
      h('button', { class: 'knopf tonal', onclick: () => { z.thema = r.thema; z.ansicht = 'start'; z.r = null; zeichnen(); } }, '✏️ Neues Rätsel zum Thema'))) : null;
  return h('div', { class: 'seite breit spiel' }, kopf,
    h('div', { class: 'fortschritt-balken' }, h('div', { id: 'fortschritt', style: { width: `${Math.round(anteil(r) * 100)}%` } })),
    ende,
    !r.geloest ? h('div', { class: 'aktiv-hinweis', id: 'aktiv-hinweis' }, w ? [h('b', {}, `${w.nr} ${w.dir === 'h' ? '→' : '↓'}`), ' ', w.hinweis, h('span', { class: 'leise' }, ` (${w.wort.length})`)] : null) : null,
    h('div', { class: 'spiel-raster' },
      h('div', { class: 'gitter-rahmen' }, gitter(r),
        !r.geloest ? h('div', { class: 'joker' },
          h('button', { class: 'knopf tonal klein', onclick: () => joker('buchstabe'), title: `−${PUNKTE.buchstabe} Punkte` }, '🔤 Buchstabe'),
          h('button', { class: 'knopf tonal klein', onclick: () => joker('wort'), title: `−${PUNKTE.wortAufdecken} Punkte` }, '🔠 Wort'),
          h('button', { class: 'knopf tonal klein', onclick: () => joker('pruefen'), title: `−${PUNKTE.pruefen} Punkte` }, '✔︎ Prüfen'),
          h('button', { class: 'knopf text klein', onclick: aufloesen }, 'Lösung')) : null,
        !r.geloest ? h('div', { class: 'klein leise tipp' }, 'Tippen zum Ausfüllen · Leertaste oder zweiter Klick wechselt die Richtung · Tab: nächste Frage') : null),
      h('div', { class: 'hinweise' },
        h('div', { class: 'ueberschrift-klein' }, 'Waagerecht →'), h('div', { class: 'spalte' }, liste('h')),
        h('div', { class: 'ueberschrift-klein', style: { marginTop: '14px' } }, 'Senkrecht ↓'), h('div', { class: 'spalte' }, liste('v')))));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const ok = await lyra.dialog('Crux', h('div', { style: { minWidth: '380px' } },
    lyra.schalter({ wert: e.toene, text: 'Töne', unter: 'Kurze Klänge beim Tippen und Lösen', beiWahl: (w) => { e.toene = w; } }),
    h('p', { class: 'klein leise', style: { marginTop: '10px', lineHeight: 1.5 } }, 'Mit Lyra (lokal) bleibt alles auf deinem Mac. Mit Claude, ChatGPT oder Gemini gehen Thema und passende Auszüge aus deinen Unterlagen an den Anbieter (Lyra fragt vorher).')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  merken();
}

window.addEventListener('resize', () => { if (z.ansicht === 'spiel' && z.r) gitterMalen(); });

start();
