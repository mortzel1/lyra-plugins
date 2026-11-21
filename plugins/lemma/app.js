'use strict';
/*
 * Lemma – Beweise Schritt für Schritt selbst führen. Die KI prüft jeden Schritt (richtig / Lücke / falsch) und sagt,
 * was fehlt – verrät aber nie die Lösung. Tipps in zwei Stufen; die Musterlösung nur, wenn du ausdrücklich danach fragst.
 */
const { h, mdElement } = lyra;

const STANDARD = { ki: 'auto', streng: 'normal' };
const BEISPIELE = [
  'Für alle $n \\in \\mathbb{N}$ gilt: $1 + 3 + 5 + \\dots + (2n-1) = n^2$.',
  '$\\sqrt{2}$ ist irrational.',
  'Es gibt unendlich viele Primzahlen.',
  'Jede konvergente Folge reeller Zahlen ist beschränkt.',
  'Ist $f: A \\to B$ injektiv und $g: B \\to C$ injektiv, dann ist $g \\circ f$ injektiv.',
  'Für alle $n \\geq 1$ ist $n^3 - n$ durch $6$ teilbar.',
];

const SYSTEM = `Du bist „Lemma“, ein geduldiger, präziser Mathematik-Tutor in Lyra. Studierende führen einen Beweis selbst, \
Schritt für Schritt. Du prüfst streng auf logische Richtigkeit und Vollständigkeit. GANZ WICHTIG: Du verrätst NIE den \
nächsten Schritt oder die Lösung, außer wenn ausdrücklich nach der Musterlösung gefragt wird. Rückmeldungen sind kurz, \
konkret und ermutigend; Formeln in LaTeX zwischen $…$.`;

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    beweisbar: { type: 'boolean' },
    geheimer_plan: { type: 'array', items: { type: 'string' } },
    methode: { type: 'string' },
    ziel: { type: 'string' },
  },
  required: ['beweisbar', 'geheimer_plan', 'methode', 'ziel'],
};
const VOLL_SCHEMA = {
  type: 'object',
  properties: { fehlt: { type: 'string' }, vollstaendig: { type: 'boolean' } },
  required: ['fehlt', 'vollstaendig'],
};
const PRUEF_SCHEMA = {
  type: 'object',
  properties: {
    bewertung: { type: 'string', enum: ['richtig', 'luecke', 'falsch', 'fertig'] },
    rueckmeldung: { type: 'string' },
  },
  required: ['bewertung', 'rueckmeldung'],
};

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  beweise: [],
  b: null, // {id, satz, plan, methode, ziel, schritte: [{text, bewertung, rueckmeldung}], tipps: [], fertig, loesung, zeit}
  entwurf: '',
  satzEntwurf: '',
  laeuft: false,
  status: '',
  fehler: null,
};
const app = document.getElementById('app');
const BEW = { richtig: ['✓', 'Richtig'], luecke: ['◐', 'Lücke'], falsch: ['✗', 'Falsch'], fertig: ['∎', 'Beweis vollständig'] };

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { z.beweise = (await lyra.speicher.liste('beweise')).map((e) => e.wert).filter((b) => b && b.id).sort((a, b) => b.zeit - a.zeit); } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.b) { z.b = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('beweis/')) z.b = z.beweise.find((x) => x.id === route.slice(7)) || null;
  zeichnen();
  if (route === 'einstellungen') einstellungen();
}

async function sichern() {
  if (!z.b) return;
  z.b.zeit = lyra.jetzt();
  try { await lyra.speicher.schreiben('beweise/' + z.b.id, z.b); } catch (_) {}
  z.beweise = [z.b, ...z.beweise.filter((x) => x.id !== z.b.id)];
  const offen = z.beweise.find((x) => !x.fertig);
  lyra.startseite(offen ? [{ id: 'offen', titel: `Beweis: ${offen.satz.replace(/\$/g, '').slice(0, 60)}`, untertitel: `${offen.schritte.length} Schritte – weiterbeweisen?`,
    route: 'beweis/' + offen.id, geaendert: offen.zeit, zeigen_bis: offen.zeit + 7 * 86400 }] : []).catch(() => {});
}

async function ki(prompt, schema, hinweis) {
  status(hinweis);
  const r = await lyra.ki({ lehrer: z.lehrer, system: SYSTEM, prompt, schema }, (e) => { if (e.art === 'hinweis') status(e.text); });
  if (r && r.lehrer) z.lehrer = r.lehrer;
  return r;
}
function status(t) {
  z.status = t;
  const el = document.getElementById('status');
  if (el) el.textContent = t;
}
async function laufen(f) {
  if (z.laeuft) return;
  z.laeuft = true;
  z.fehler = null;
  zeichnen();
  try {
    await f();
  } catch (e) {
    const m = String((e && e.message) || e);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
}

// ------------------------------------------------------------------ Beweis beginnen

function beginnen(satz) {
  satz = String(satz || '').trim();
  if (!satz) return;
  return laufen(async () => {
    const r = await ki(`Aussage, die bewiesen werden soll:\n${satz}\n\n\
Bereite dich als Tutor vor: Ist die Aussage (so formuliert) wahr und beweisbar? Lege für DICH einen kurzen Beweisplan \
in 3 bis 8 Schritten an (der bleibt geheim). "methode": passende Beweismethode in wenigen Worten (z. B. „Vollständige \
Induktion“). "ziel": was genau zu zeigen ist, sauber formuliert (mit Voraussetzungen).\n\n\
Antwort als JSON: {"beweisbar": true, "geheimer_plan": ["…"], "methode": "…", "ziel": "…"}`, PLAN_SCHEMA, 'Lemma liest die Aussage …');
    const j = (r && r.json) || {};
    if (j.beweisbar === false) throw new Error('So formuliert scheint die Aussage nicht zu stimmen – prüf sie noch einmal (Voraussetzungen? Quantoren?).');
    z.b = { id: lyra.neueId(), satz, plan: (j.geheimer_plan || []).map(String), methode: String(j.methode || ''), ziel: String(j.ziel || satz),
      schritte: [], tipps: [], fertig: false, loesung: '', zeit: lyra.jetzt() };
    z.entwurf = '';
    await sichern();
  });
}

// ------------------------------------------------------------------ Schritt prüfen, Tipps, Lösung

function bisher(b) {
  return b.schritte.filter((s) => s.bewertung === 'richtig' || s.bewertung === 'fertig').map((s, i) => `${i + 1}. ${s.text}`).join('\n') || '(noch keine)';
}

function pruefen() {
  const text = z.entwurf.trim();
  const b = z.b;
  if (!text || !b) return;
  return laufen(async () => {
    const streng = { locker: 'Sei großzügig bei Formalien, achte auf die Idee.', normal: 'Achte auf Logik und Begründungen wie in einer Übung.', streng: 'Sei streng wie in einer Klausur: jede Folgerung braucht eine Begründung.' }[z.einst.streng];
    const r = await ki(`Zu beweisen: ${b.ziel}\nGeheimer Plan (NICHT verraten): ${b.plan.join(' | ')}\n\nBisher akzeptierte Schritte:\n${bisher(b)}\n\n\
Neuer Schritt der/des Studierenden:\n${text}\n\n${streng}\n\
Bewerte NUR diesen neuen Schritt: "richtig" (gültig und bringt voran), "luecke" (Idee stimmt, aber eine Begründung oder ein \
Fall fehlt), "falsch" (logischer oder rechnerischer Fehler), "fertig" (richtig UND damit ist der GESAMTE Beweis vollständig – \
alle Fälle, bei Induktion Anfang UND Schritt, bei „genau dann“ beide Richtungen; im Zweifel "richtig"). \
"rueckmeldung": 1 bis 3 Sätze – was gut ist, was genau fehlt oder falsch ist. Verrate NICHT, wie es weitergeht und nicht \
den richtigen Schritt. Andere Wege als dein Plan sind erlaubt, wenn sie korrekt sind.\n\n\
Antwort als JSON: {"bewertung": "richtig", "rueckmeldung": "…"}`, PRUEF_SCHEMA, 'Lemma prüft deinen Schritt …');
    const j = (r && r.json) || {};
    let bewertung = BEW[j.bewertung] ? j.bewertung : 'luecke';
    let rueckmeldung = String(j.rueckmeldung || '');
    if (bewertung === 'fertig') {
      // Gegenprobe: ist wirklich alles gezeigt? (Kleine Modelle erklären einen Beweis gern zu früh für fertig.)
      const alle = `${bisher(b) === '(noch keine)' ? '' : bisher(b) + '\n'}${b.schritte.filter((s) => s.bewertung === 'richtig').length + 1}. ${text}`;
      const v = await ki(`Zu beweisen: ${b.ziel}\nGeheimer Plan (NICHT verraten): ${b.plan.join(' | ')}\n\nAlle Schritte der/des Studierenden:\n${alle}\n\n\
Ist die Aussage damit VOLLSTÄNDIG bewiesen? Prüfe genau: alle Fälle, bei Induktion Induktionsanfang UND Induktionsschritt, \
bei „genau dann“ beide Richtungen, alle Voraussetzungen benutzt. "fehlt": was noch fehlt (ein Satz, ohne zu verraten, wie \
es geht) – oder "". "vollstaendig": true nur, wenn wirklich nichts fehlt.\n\nAntwort als JSON: {"fehlt": "…", "vollstaendig": false}`,
      VOLL_SCHEMA, 'Lemma macht die Gegenprobe …');
      const vj = (v && v.json) || {};
      if (vj.vollstaendig !== true) {
        bewertung = 'richtig';
        rueckmeldung = `${rueckmeldung} – Aber fertig ist der Beweis noch nicht: ${String(vj.fehlt || 'Es fehlt noch ein Teil.').trim()}`;
      }
    }
    b.schritte.push({ text, bewertung, rueckmeldung });
    if (bewertung === 'richtig' || bewertung === 'fertig') z.entwurf = '';
    if (bewertung === 'fertig') b.fertig = true;
    await sichern();
  });
}

function tipp() {
  const b = z.b;
  const stufe = Math.min(2, b.tipps.length + 1);
  return laufen(async () => {
    const r = await ki(`Zu beweisen: ${b.ziel}\nGeheimer Plan: ${b.plan.join(' | ')}\n\nBisher akzeptierte Schritte:\n${bisher(b)}\n\n\
Gib einen Tipp der Stufe ${stufe} für den NÄCHSTEN Schritt: ${stufe === 1 ? 'Stufe 1 = nur die Richtung (welche Idee, welches Werkzeug, welche Definition hilft) – ohne Rechnung.' : 'Stufe 2 = konkreter (womit anfangen, was umformen), aber den Schritt NICHT selbst ausführen.'} \
Höchstens 2 Sätze. Antworte nur mit dem Tipp (Text, kein JSON).`, null, 'Lemma überlegt einen Tipp …');
    b.tipps.push({ stufe, text: String((r && r.text) || '').trim(), nachSchritt: b.schritte.length });
    await sichern();
  });
}

async function loesung() {
  const ok = await lyra.dialog('Musterlösung zeigen?', h('p', {}, 'Am meisten lernst du, wenn du selbst draufkommst – versuch es ruhig noch mit einem Tipp. Trotzdem die ganze Lösung zeigen?'), [
    { text: 'Lieber einen Tipp', art: 'text', wert: 'tipp' },
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Ja, zeigen', wert: true },
  ]);
  if (ok === 'tipp') return tipp();
  if (!ok) return;
  const b = z.b;
  return laufen(async () => {
    const r = await ki(`Zu beweisen: ${b.ziel}\nPlan: ${b.plan.join(' | ')}\n\nDie/der Studierende bittet ausdrücklich um die vollständige Musterlösung. \
Schreibe einen sauberen, vollständigen Beweis in Markdown (Formeln in LaTeX), knüpfe wenn möglich an die bisherigen \
richtigen Schritte an:\n${bisher(b)}\n\nNur der Beweis, endet mit ∎.`, null, 'Lemma schreibt die Musterlösung …');
    b.loesung = String((r && r.text) || '').trim();
    await sichern();
  });
}

function alsMarkdown(b) {
  const richtige = b.schritte.filter((s) => s.bewertung === 'richtig' || s.bewertung === 'fertig');
  return [`**Satz.** ${b.satz}`, '', `**Beweis** (${b.methode}).`, '', ...richtige.map((s) => s.text), '', '∎',
    ...(b.loesung ? ['', '---', '', '**Musterlösung**', '', b.loesung] : [])].join('\n');
}

// ------------------------------------------------------------------ Ansichten

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  app.replaceChildren(h('div', { class: 'seite' }, z.b ? beweisAnsicht() : startAnsicht()));
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); try { e.setSelectionRange(e.value.length, e.value.length); } catch (_) {} }
  lyra.titel(z.b ? (z.b.fertig ? 'Bewiesen ∎' : 'Beweis') : '');
}

function laufZeile() {
  return z.laeuft ? h('div', { style: { marginTop: '12px' } }, lyra.arbeit(z.status || 'Lemma denkt nach …')) : null;
}
function fehlerZeile() {
  return z.fehler ? lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; zeichnen(); } : null, () => { z.fehler = null; zeichnen(); }) : null;
}

async function beweisLoeschen(b) {
  if (!(await lyra.bestaetigen({ titel: 'Beweis löschen?', text: 'Alle Schritte und Rückmeldungen dazu werden gelöscht.', ja: 'Löschen', gefahr: true }))) return;
  try { await lyra.speicher.loeschen('beweise/' + b.id); } catch (_) {}
  z.beweise = z.beweise.filter((x) => x.id !== b.id);
  const offen = z.beweise.find((x) => !x.fertig);
  lyra.startseite(offen ? [{ id: 'offen', titel: `Beweis: ${offen.satz.replace(/\$/g, '').slice(0, 60)}`, untertitel: `${offen.schritte.length} Schritte – weiterbeweisen?`,
    route: 'beweis/' + offen.id, geaendert: offen.zeit, zeigen_bis: offen.zeit + 7 * 86400 }] : []).catch(() => {});
  zeichnen();
}

function startAnsicht() {
  const vorschau = h('div', { class: 'vorschau' });
  const malen = () => vorschau.replaceChildren(z.satzEntwurf.trim() ? mdElement(z.satzEntwurf) : h('span', { class: 'leise klein' }, 'Hier erscheint dein Satz mit gesetzten Formeln.'));
  malen();
  const offen = z.beweise.filter((b) => !b.fertig), fertig = z.beweise.filter((b) => b.fertig);
  const eintrag = (b) => lyra.eintrag({
    symbol: b.fertig ? '∎' : '✎',
    farbe: b.fertig ? 'var(--ok)' : '',
    titel: b.satz.replace(/\$/g, '').slice(0, 120),
    unter: `${b.schritte.length} Schritt${b.schritte.length === 1 ? '' : 'e'}${b.methode ? ` · ${b.methode}` : ''} · ${lyra.zeitText(b.zeit)}`,
    beiKlick: () => { z.b = b; zeichnen(); },
    aktionen: [{ symbol: '🗑', titel: 'Löschen', bei: () => beweisLoeschen(b) }],
  });
  return h('div', {},
    lyra.kopf({ titel: 'Was willst du beweisen?', unter: 'Du führst den Beweis selbst – Schritt für Schritt. Lemma prüft jeden Schritt ehrlich und verrät nichts, solange du nicht fragst.' }),
    lyra.verfasser({
      wert: z.satzEntwurf,
      feld: 'satz',
      platzhalter: 'Satz eingeben – Formeln in LaTeX, z. B. „Für alle $n$ gilt $\\sum_{k=1}^n k = \\frac{n(n+1)}{2}$.“',
      beiEingabe: (v) => { z.satzEntwurf = v; malen(); },
      beiSenden: (v) => beginnen(v),
      knopf: 'Beweis beginnen',
      deaktiviert: !!z.laeuft,
      unten: [z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null],
    }),
    vorschau,
    laufZeile(), fehlerZeile(),
    offen.length ? lyra.abschnitt('Weiterbeweisen', h('div', { class: 'ly-liste' }, offen.map(eintrag))) : null,
    lyra.abschnitt('Zum Üben', h('div', { class: 'beispiele' }, BEISPIELE.map((b) => h('button', { class: 'beispiel', onclick: () => { z.satzEntwurf = b; zeichnen(); const f = document.querySelector('[data-feld="satz"]'); if (f) f.focus(); } }, mdElement(b))))),
    fertig.length ? lyra.abschnitt('Bewiesen ∎', h('div', { class: 'ly-liste' }, fertig.map(eintrag))) : null);
}

function beweisAnsicht() {
  const b = z.b;
  const feld = h('textarea', { class: 'eingabe', 'data-feld': 'schritt', rows: 4, placeholder: b.schritte.length ? 'Nächster Schritt …' : 'Dein erster Schritt – z. B. „Induktionsanfang: Für $n = 1$ gilt …“' });
  feld.value = z.entwurf;
  const vorschau = h('div', { class: 'vorschau' });
  const malen = () => vorschau.replaceChildren(z.entwurf.trim() ? mdElement(z.entwurf) : h('span', { class: 'leise klein' }, 'Vorschau deiner Formeln'));
  feld.addEventListener('input', () => { z.entwurf = feld.value; malen(); const k = document.getElementById('pruefen'); if (k) k.disabled = !!z.laeuft || !z.entwurf.trim(); });
  feld.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) pruefen(); });
  malen();
  const tippsBis = (n) => b.tipps.filter((t) => t.nachSchritt === n);
  return h('div', {},
    h('div', { class: 'zeile', style: { marginBottom: '10px' } },
      h('button', { class: 'knopf text', onclick: () => { z.b = null; zeichnen(); } }, '← Alle Beweise'),
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf text', onclick: async () => { try { await lyra.speichern('Beweis.md', alsMarkdown(b)); } catch (_) {} } }, '⬇ Als Markdown')),
    h('div', { class: 'satz-karte' },
      h('div', { class: 'ueberschrift-klein' }, 'Satz'), mdElement(b.satz),
      b.methode ? h('div', { class: 'klein leise', style: { marginTop: '6px' } }, `Methode: ${b.methode}`) : null),
    h('div', { class: 'schritte' },
      tippsBis(0).map(tippKarte),
      b.schritte.map((s, i) => [
        h('div', { class: `schritt ${s.bewertung}` },
          h('div', { class: 'schritt-kopf' }, h('span', { class: 'nr' }, String(i + 1)), h('span', { class: 'bew' }, `${BEW[s.bewertung][0]} ${BEW[s.bewertung][1]}`),
            h('span', { class: 'wachsen' }),
            h('button', { class: 'knopf text klein', title: 'Diesen Schritt löschen', onclick: async () => { b.schritte.splice(i, 1); b.fertig = b.schritte.some((x) => x.bewertung === 'fertig'); await sichern(); zeichnen(); } }, '🗑')),
          mdElement(s.text),
          s.rueckmeldung ? h('div', { class: 'rueck' }, mdElement(s.rueckmeldung)) : null),
        ...tippsBis(i + 1).map(tippKarte),
      ])),
    b.fertig ? h('div', { class: 'fertig-karte' }, h('div', { class: 'gross' }, '∎'), h('div', { class: 'fett' }, 'Bewiesen – stark!'),
      h('div', { class: 'leise klein' }, 'Dein Beweis ist vollständig. Unten kannst du ihn als Markdown sichern.')) : h('div', { class: 'flaeche spalte', style: { gap: '8px' } },
      feld, vorschau,
      h('div', { class: 'zeile umbruch' },
        h('button', { class: 'knopf tonal', disabled: z.laeuft, onclick: tipp }, b.tipps.length ? '💡 Noch ein Tipp' : '💡 Tipp'),
        h('button', { class: 'knopf text', disabled: z.laeuft, onclick: loesung }, 'Musterlösung …'),
        h('span', { class: 'wachsen' }),
        h('span', { class: 'klein leise' }, '⌘↩'),
        h('button', { class: 'knopf', id: 'pruefen', disabled: z.laeuft || !z.entwurf.trim(), onclick: pruefen }, 'Schritt prüfen')),
      laufZeile(), fehlerZeile()),
    b.loesung ? h('details', { class: 'loesung', open: true }, h('summary', {}, 'Musterlösung'), mdElement(b.loesung)) : null);
}

function tippKarte(t) {
  return h('div', { class: 'tipp' }, h('span', { class: 'fett' }, `💡 Tipp ${t.stufe}: `), mdElement(t.text));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const wahl = (schl, opt) => {
    const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
    const m = () => box.replaceChildren(...opt.map(([w, n]) => h('button', { class: 'chip' + (e[schl] === w ? ' an' : ''), onclick: () => { e[schl] = w; m(); } }, n)));
    m();
    return box;
  };
  const ok = await lyra.dialog('Lemma – Einstellungen', h('div', { class: 'spalte', style: { minWidth: '420px', gap: '12px' } },
    h('div', { class: 'fett' }, 'Wie streng prüfen?'), wahl('streng', [['locker', 'Locker (Idee zählt)'], ['normal', 'Wie in der Übung'], ['streng', 'Wie in der Klausur']]),
    h('div', { class: 'fett' }, 'Wer prüft'), wahl('ki', [['auto', 'Automatisch (Claude & Co., wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']]),
    h('div', { class: 'leise klein' }, 'Beweise zu prüfen ist anspruchsvoll – Claude, ChatGPT oder Gemini urteilen hier deutlich zuverlässiger als das kleine lokale Modell. Mit ihnen gehen deine Aussage und deine Schritte an den Anbieter.')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  z.lehrer = e.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
}

start();
