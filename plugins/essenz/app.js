'use strict';
/*
 * Essenz – Formelblatt bzw. Spickzettel aus deinen Unterlagen: Formeln, Definitionen, Sätze und Merksätze je Thema,
 * kompakt in Spalten. Alles bearbeitbar; als PDF (Druckdialog von macOS), LaTeX oder Markdown sichern.
 */
const { h, mdElement } = lyra;

const ARTEN = { formel: ['Formel', 'ƒ'], definition: ['Definition', 'D'], satz: ['Satz', 'S'], merke: ['Merke', '!'] };
const STANDARD = { spalten: 2, groesse: 'normal', zusatz: true, ki: 'auto', anzahl: 10 };

const SYSTEM = `Du bist „Essenz“ in Lyra: Du destillierst aus Vorlesungsunterlagen das Wichtigste für einen Spickzettel – \
Formeln, Definitionen, Sätze und Merksätze. Kurz, exakt, fachlich korrekt. Formeln in LaTeX zwischen $…$ (im Text) \
oder $$…$$ (abgesetzt). Nichts erfinden, was nicht zum Thema gehört.`;

// Schlüssel so, dass die alphabetische Reihenfolge Sinn ergibt: Art, Bezeichnung, Inhalt, Zusatz
const SCHEMA = {
  type: 'object',
  properties: {
    eintraege: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          art: { type: 'string', enum: Object.keys(ARTEN) },
          bezeichnung: { type: 'string' },
          inhalt: { type: 'string' },
          zusatz: { type: 'string' },
        },
        required: ['art', 'bezeichnung', 'inhalt', 'zusatz'],
      },
    },
  },
  required: ['eintraege'],
};

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  blaetter: [],
  blatt: null, // {id, titel, abschnitte: [{titel, eintraege: [{art, bezeichnung, inhalt, zusatz}]}], zeit}
  themen: [],
  auswahl: new Set(),
  eigenes: '',
  laeuft: false,
  status: '',
  fehler: null,
  meldung: '',
};
const app = document.getElementById('app');
// In einer Fusion: Material von anderen Plugins statt Auszügen aus den Unterlagen
let fusionMaterial = '';
const text = (v) => (typeof v === 'string' ? v.trim() : '');

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try {
    z.blaetter = (await lyra.speicher.liste('blaetter')).map((e) => e.wert).filter((b) => b && b.id).sort((a, b) => b.zeit - a.zeit);
  } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.blatt) { z.blatt = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('blatt/')) z.blatt = z.blaetter.find((b) => b.id === route.slice(6)) || null;
  zeichnen();
  lyra.themen().then((t) => { z.themen = t || []; if (!z.blatt) zeichnen(); }).catch(() => {});
  if (route === 'einstellungen') einstellungen();
}

async function sichern() {
  if (!z.blatt) return;
  z.blatt.zeit = lyra.jetzt();
  try { await lyra.speicher.schreiben('blaetter/' + z.blatt.id, z.blatt); } catch (_) {}
  z.blaetter = [z.blatt, ...z.blaetter.filter((b) => b.id !== z.blatt.id)];
}

// ------------------------------------------------------------------ Erstellen

function pruefen(e) {
  const art = ARTEN[e.art] ? e.art : 'merke';
  const bezeichnung = text(e.bezeichnung).slice(0, 120);
  const inhalt = text(e.inhalt).slice(0, 1200);
  if (!inhalt) return null;
  return { art, bezeichnung, inhalt, zusatz: text(e.zusatz).slice(0, 400) };
}

async function erstellen() {
  const themen = [...z.auswahl, ...z.eigenes.split(/[;\n]/).map((t) => t.trim()).filter(Boolean)];
  if (!themen.length || z.laeuft) return;
  z.laeuft = true;
  z.fehler = null;
  zeichnen();
  const blatt = { id: lyra.neueId(), titel: themen.length === 1 ? themen[0] : themen.slice(0, 3).join(', ') + (themen.length > 3 ? ' …' : ''), abschnitte: [], zeit: lyra.jetzt() };
  try {
    for (const [i, thema] of themen.entries()) {
      status(`Suche „${thema}“ in deinen Unterlagen …`, i, themen.length);
      let block = fusionMaterial.slice(0, z.lehrer === 'lyra' ? 6000 : 14000);
      if (!block) try { block = ((await lyra.suchen(thema, z.lehrer === 'lyra' ? 6 : 10)).block || '').slice(0, z.lehrer === 'lyra' ? 6000 : 14000); } catch (_) {}
      status(`Destilliere „${thema}“ …`, i, themen.length);
      const r = await lyra.ki({
        lehrer: z.lehrer,
        system: SYSTEM,
        prompt: `Thema: ${thema}\n\n${block ? `Auszüge aus meinen Unterlagen (halte dich an deren Schreibweise und Bezeichnungen):\n\n${block}\n\n` : 'Keine passenden Auszüge gefunden – nutze gesichertes Standardwissen.\n\n'}\
Erstelle bis zu ${z.einst.anzahl} Einträge für einen Spickzettel zu diesem Thema – die wichtigsten zuerst. \
"art": formel, definition, satz oder merke. "bezeichnung": kurzer Name (z. B. „Satz von Pythagoras“, „Eigenwert“). \
"inhalt": die Formel bzw. die knappe Aussage (Formeln in LaTeX). "zusatz": höchstens ein Satz zu Bedingungen oder \
Bedeutung der Variablen – oder "".\n\nAntwort als JSON: {"eintraege": [{"art": "formel", "bezeichnung": "…", "inhalt": "$$…$$", "zusatz": "…"}]}`,
        schema: SCHEMA,
        zaehlen: { schluessel: 'bezeichnung', wort: 'Eintrag' },
      }, (e) => { if (e.art === 'hinweis') status(`„${thema}“: ${e.text}`, i, themen.length); });
      if (r && r.lehrer) z.lehrer = r.lehrer;
      const gesehen = new Set();
      const eintraege = ((r && r.json && r.json.eintraege) || []).map(pruefen).filter(Boolean).filter((e) => {
        const k = (e.bezeichnung || e.inhalt).toLowerCase().replace(/\s+/g, ' ');
        if (gesehen.has(k)) return false;
        gesehen.add(k);
        return true;
      });
      if (eintraege.length) blatt.abschnitte.push({ titel: thema, eintraege });
    }
    if (!blatt.abschnitte.length) throw new Error('Dazu kam nichts Brauchbares zurück – versuch ein genaueres Thema.');
    z.blatt = blatt;
    z.auswahl = new Set();
    z.eigenes = '';
    await sichern();
  } catch (e) {
    const m = String((e && e.message) || e);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
}

function status(t, i, n) {
  z.status = n > 1 ? `${t} (${i + 1}/${n})` : t;
  const el = document.getElementById('status');
  if (el) el.textContent = z.status;
}

// ------------------------------------------------------------------ Export

/** Text für LaTeX maskieren – nur außerhalb von $…$ */
function latexText(t) {
  return String(t).split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g).map((teil, i) => {
    if (i % 2) return teil.startsWith('$$') ? `\\[${teil.slice(2, -2)}\\]` : teil;
    return teil.replace(/\\/g, '\\textbackslash{}').replace(/([&%#_{}])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}')
      .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}');
  }).join('');
}

function alsLatex(b) {
  const z1 = [
    '\\documentclass[10pt,a4paper]{article}',
    '\\usepackage[utf8]{inputenc}\\usepackage[T1]{fontenc}\\usepackage[ngerman]{babel}',
    '\\usepackage{amsmath,amssymb}\\usepackage{multicol}\\usepackage[margin=1.2cm]{geometry}',
    '\\setlength{\\parindent}{0pt}\\setlength{\\columnsep}{1.2em}',
    '\\begin{document}',
    `\\section*{${latexText(b.titel)}}`,
    `\\begin{multicols}{${Math.max(1, z.einst.spalten)}}`,
  ];
  for (const a of b.abschnitte) {
    if (b.abschnitte.length > 1) z1.push(`\\subsection*{${latexText(a.titel)}}`);
    for (const e of a.eintraege) {
      z1.push(`\\paragraph{${ARTEN[e.art][0]}${e.bezeichnung ? ': ' + latexText(e.bezeichnung) : ''}} ${latexText(e.inhalt)}`);
      if (e.zusatz && z.einst.zusatz) z1.push(`{\\small\\itshape ${latexText(e.zusatz)}}`);
      z1.push('');
    }
  }
  z1.push('\\end{multicols}', '\\end{document}');
  return z1.join('\n');
}

function alsMarkdown(b) {
  const z1 = [`# ${b.titel}`, ''];
  for (const a of b.abschnitte) {
    if (b.abschnitte.length > 1) z1.push(`## ${a.titel}`, '');
    for (const e of a.eintraege) {
      z1.push(`**${ARTEN[e.art][0]}${e.bezeichnung ? ': ' + e.bezeichnung : ''}** – ${e.inhalt}`);
      if (e.zusatz && z.einst.zusatz) z1.push(`*${e.zusatz}*`);
      z1.push('');
    }
  }
  return z1.join('\n');
}

async function exportieren(art) {
  const b = z.blatt;
  const name = (b.titel || 'Essenz').replace(/[/\\:*?"<>|]/g, ' ').slice(0, 60);
  try {
    if (art === 'pdf') return void (await lyra.drucken());
    const ok = await lyra.speichern(`${name}.${art}`, art === 'tex' ? alsLatex(b) : alsMarkdown(b));
    z.meldung = ok ? `✓ ${art === 'tex' ? 'LaTeX' : 'Markdown'} gesichert` : '';
  } catch (e) {
    z.meldung = String((e && e.message) || e);
  }
  zeichnen();
}

// ------------------------------------------------------------------ Bearbeiten

async function eintragBearbeiten(ai, ei) {
  const neu = ei === undefined;
  const e = neu ? { art: 'formel', bezeichnung: '', inhalt: '', zusatz: '' } : { ...z.blatt.abschnitte[ai].eintraege[ei] };
  const artBox = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
  const artMalen = () => artBox.replaceChildren(...Object.entries(ARTEN).map(([k, [n]]) => h('button', { class: 'chip' + (e.art === k ? ' an' : ''), onclick: () => { e.art = k; artMalen(); } }, n)));
  artMalen();
  const bez = h('input', { class: 'eingabe', placeholder: 'Bezeichnung, z. B. Satz des Pythagoras', value: e.bezeichnung });
  const inh = h('textarea', { class: 'eingabe mono', rows: 4, placeholder: 'Inhalt – Formeln in LaTeX: $$a^2 + b^2 = c^2$$' });
  inh.value = e.inhalt;
  const zus = h('input', { class: 'eingabe', placeholder: 'Zusatz (optional): Bedingungen, Bedeutung der Variablen', value: e.zusatz });
  const vorschau = h('div', { class: 'vorschau' });
  const malen = () => vorschau.replaceChildren(mdElement(inh.value || '…'));
  inh.addEventListener('input', malen);
  malen();
  const w = await lyra.dialog(neu ? 'Eintrag hinzufügen' : 'Eintrag bearbeiten', h('div', { class: 'spalte', style: { minWidth: '480px', gap: '10px' } },
    artBox, bez, inh, vorschau, zus), [
    ...(neu ? [] : [{ text: 'Löschen', art: 'text', wert: 'loeschen' }]),
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: neu ? 'Hinzufügen' : 'Sichern', wert: true },
  ]);
  if (!w) return;
  const liste = z.blatt.abschnitte[ai].eintraege;
  if (w === 'loeschen') liste.splice(ei, 1);
  else {
    const x = pruefen({ ...e, bezeichnung: bez.value, inhalt: inh.value, zusatz: zus.value });
    if (!x) return;
    if (neu) liste.push(x); else liste[ei] = x;
  }
  await sichern();
  zeichnen();
}

async function verschieben(ai, ei, d) {
  const l = z.blatt.abschnitte[ai].eintraege;
  const n = ei + d;
  if (n < 0 || n >= l.length) return;
  [l[ei], l[n]] = [l[n], l[ei]];
  await sichern();
  zeichnen();
}

// ------------------------------------------------------------------ Ansichten

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  app.replaceChildren(z.blatt ? blattAnsicht() : start_ansicht());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); try { e.setSelectionRange(e.value.length, e.value.length); } catch (_) {} }
  lyra.titel(z.blatt ? z.blatt.titel : '');
}

async function einstellungSetzen(schl, w) {
  z.einst[schl] = w;
  try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {}
  zeichnen();
}

async function blattLoeschen(b) {
  if (!(await lyra.bestaetigen({ titel: `„${b.titel}“ löschen?`, text: 'Das Formelblatt wird gelöscht.', ja: 'Löschen', gefahr: true }))) return;
  try { await lyra.speicher.loeschen('blaetter/' + b.id); } catch (_) {}
  z.blaetter = z.blaetter.filter((x) => x.id !== b.id);
  zeichnen();
}

function start_ansicht() {
  const n = z.auswahl.size + z.eigenes.split(/[;\n]/).map((t) => t.trim()).filter(Boolean).length;
  const alleThemen = z.themen.slice(0, z.alleThemen ? 40 : 12);
  return h('div', { class: 'seite' },
    lyra.kopf({ titel: 'Dein Formelblatt', unter: 'Wähle Themen – Essenz zieht Formeln, Definitionen, Sätze und Merksätze aus deinen Unterlagen und setzt sie kompakt auf ein Blatt.' }),
    z.themen.length ? h('div', { class: 'themenwahl' },
      h('div', { class: 'zeile', style: { marginBottom: '8px' } },
        h('div', { class: 'ueberschrift-klein wachsen' }, 'Aus deinen Unterlagen'),
        z.auswahl.size ? h('button', { class: 'knopf text klein', onclick: () => { z.auswahl = new Set(); zeichnen(); } }, 'Auswahl leeren') : null),
      h('div', { class: 'zeile umbruch', style: { gap: '6px' } },
        alleThemen.map((t) => h('button', {
          class: 'chip' + (z.auswahl.has(t) ? ' an' : ''),
          onclick: () => { if (z.auswahl.has(t)) z.auswahl.delete(t); else z.auswahl.add(t); zeichnen(); },
        }, (z.auswahl.has(t) ? '✓ ' : '') + t)),
        z.themen.length > 12 ? h('button', { class: 'ly-vorschlag mehr', onclick: () => { z.alleThemen = !z.alleThemen; zeichnen(); } }, z.alleThemen ? 'weniger' : `+ ${z.themen.length - 12} mehr`) : null)) : null,
    lyra.verfasser({
      wert: z.eigenes,
      feld: 'eigen',
      zeilen: 1,
      platzhalter: z.themen.length ? 'Eigene Themen dazu – mehrere mit Semikolon, z. B. „Eigenwerte; Determinante“' : 'Themen – mehrere mit Semikolon, z. B. „Eigenwerte; Determinante; Taylorreihe“',
      beiEingabe: (v) => { z.eigenes = v; },
      leerErlaubt: z.auswahl.size > 0,
      beiSenden: (v) => { z.eigenes = v; erstellen(); },
      knopf: n > 1 ? `✨ Blatt aus ${n} Themen` : '✨ Blatt erstellen',
      deaktiviert: !!z.laeuft,
      unten: [
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        lyra.auswahl({ titel: 'Spalten', wert: z.einst.spalten, beiWahl: (w) => einstellungSetzen('spalten', w), optionen: [[1, '1'], [2, '2'], [3, '3']] }),
        lyra.auswahl({ titel: 'Je Thema', wert: z.einst.anzahl, beiWahl: (w) => einstellungSetzen('anzahl', w), optionen: [[6, '6 Einträge'], [10, '10 Einträge'], [15, '15 Einträge'], [20, '20 Einträge']] }),
      ],
    }),
    z.laeuft ? h('div', { style: { marginTop: '12px' } }, lyra.arbeit(z.status || 'Essenz arbeitet …')) : null,
    z.fehler ? h('div', { style: { marginTop: '12px' } }, lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; erstellen(); } : null,
      () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; erstellen(); })) : null,
    z.blaetter.length ? lyra.abschnitt('Deine Blätter', h('div', { class: 'ly-liste' }, z.blaetter.map((b) => lyra.eintrag({
      symbol: 'Σ',
      titel: b.titel,
      unter: `${b.abschnitte.reduce((a, x) => a + x.eintraege.length, 0)} Einträge · ${b.abschnitte.length} Themen · ${lyra.zeitText(b.zeit)}`,
      beiKlick: () => { z.blatt = b; zeichnen(); },
      aktionen: [{ symbol: '🗑', titel: 'Löschen', bei: () => blattLoeschen(b) }],
    })))) : null);
}

function blattAnsicht() {
  const b = z.blatt;
  const titel = h('input', { class: 'blatt-titel-feld', 'data-feld': 'titel', value: b.titel });
  titel.addEventListener('change', () => { b.titel = titel.value.trim() || b.titel; sichern(); lyra.titel(b.titel); });
  const spaltenWahl = h('div', { class: 'zeile', style: { gap: '4px' } }, [1, 2, 3].map((n) => h('button', {
    class: 'chip' + (z.einst.spalten === n ? ' an' : ''), title: `${n} Spalte${n > 1 ? 'n' : ''}`,
    onclick: async () => { z.einst.spalten = n; try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {} zeichnen(); },
  }, `${n}▥`)));
  return h('div', { class: 'seite breit' },
    h('div', { class: 'werkzeuge zeile umbruch' },
      h('button', { class: 'knopf text', onclick: () => { z.blatt = null; zeichnen(); } }, '← Alle Blätter'),
      h('span', { class: 'wachsen' }),
      spaltenWahl,
      h('button', { class: 'knopf tonal', onclick: () => exportieren('pdf'), title: 'Druckdialog – dort „Als PDF sichern“' }, '🖨 Drucken / PDF'),
      h('button', { class: 'knopf tonal', onclick: () => exportieren('tex') }, 'LaTeX'),
      h('button', { class: 'knopf tonal', onclick: () => exportieren('md') }, 'Markdown'),
      h('button', { class: 'knopf text', onclick: async () => {
        if (!(await lyra.bestaetigen({ titel: `„${b.titel}“ löschen?`, text: ``, ja: 'Löschen', nein: 'Abbrechen', gefahr: true }))) return;
        try { await lyra.speicher.loeschen('blaetter/' + b.id); } catch (_) {}
        z.blaetter = z.blaetter.filter((x) => x.id !== b.id);
        z.blatt = null;
        zeichnen();
      } }, '🗑')),
    z.meldung ? h('div', { class: 'klein leise', style: { textAlign: 'right', margin: '4px 0' } }, z.meldung) : null,
    h('div', { class: `blatt groesse-${z.einst.groesse}`, style: { columnCount: z.einst.spalten } },
      titel,
      b.abschnitte.map((a, ai) => h('section', { class: 'abschnitt' },
        b.abschnitte.length > 1 ? h('h2', {}, a.titel) : null,
        a.eintraege.map((e, ei) => h('div', { class: `eintrag ${e.art}` },
          h('div', { class: 'eintrag-kopf' },
            h('span', { class: 'marke' }, ARTEN[e.art][1]),
            h('span', { class: 'bez' }, e.bezeichnung || ARTEN[e.art][0]),
            h('span', { class: 'aktionen' },
              h('button', { title: 'Nach oben', onclick: () => verschieben(ai, ei, -1) }, '↑'),
              h('button', { title: 'Nach unten', onclick: () => verschieben(ai, ei, 1) }, '↓'),
              h('button', { title: 'Bearbeiten', onclick: () => eintragBearbeiten(ai, ei) }, '✎'))),
          mdElement(e.inhalt),
          e.zusatz && z.einst.zusatz ? h('div', { class: 'zusatz' }, mdElement(e.zusatz)) : null)),
        h('button', { class: 'knopf text klein nur-bildschirm', onclick: () => eintragBearbeiten(ai) }, '+ Eintrag')))));
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
  const g = (t, x) => h('div', { style: { marginBottom: '12px' } }, h('div', { class: 'fett', style: { marginBottom: '4px' } }, t), x);
  const ok = await lyra.dialog('Essenz – Einstellungen', h('div', { style: { minWidth: '420px' } },
    g('Spalten', wahl('spalten', [[1, '1'], [2, '2'], [3, '3']])),
    g('Schrift', wahl('groesse', [['klein', 'Kompakt (viel auf ein Blatt)'], ['normal', 'Normal']])),
    g('Zusätze (Bedingungen, Variablen)', wahl('zusatz', [[true, 'Zeigen'], [false, 'Weglassen']])),
    g('Einträge je Thema', wahl('anzahl', [[6, '6'], [10, '10'], [15, '15'], [20, '20']])),
    g('Wer destilliert', wahl('ki', [['auto', 'Automatisch (Claude & Co., wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']]))), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  z.lehrer = e.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
  zeichnen();
}

// ================================================================== Fusion (mehrere Plugins, eine Aufgabe)

function fusionAnbieten() {
  lyra.fusion.anbieten({
    formelblatt: async (a, { status }) => {
      z.lehrer = a.lehrer || z.lehrer;
      fusionMaterial = lyra.fusion.materialOhneAufgabe(a, 14000);
      z.auswahl = new Set();
      z.eigenes = lyra.fusion.kurzthema(a) || String(a.anweisung || '').slice(0, 80);
      const vorher = z.blatt;
      const uhr = setInterval(() => { if (z.status) status(z.status); }, 1200);
      try { await erstellen(); } finally { clearInterval(uhr); fusionMaterial = ''; }
      const b = z.blatt;
      if (!b || b === vorher) throw new Error(z.fehler || 'Essenz konnte kein Formelblatt erstellen.');
      return { art: 'dokument', titel: `Formelblatt: ${b.titel}`, markdown: alsMarkdown(b), daten: { abschnitte: b.abschnitte }, oeffnen: 'blatt/' + b.id };
    },
  });
}

start().catch(() => {}).then(fusionAnbieten);
