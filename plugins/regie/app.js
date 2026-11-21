'use strict';
/*
 * Regie – aus einem Thema ein kurzes Erklärvideo bzw. eine Präsentation: Szenen mit Sprechtext, Dauer und Bildidee.
 * Die Schaubilder zeichnet Graphit im Hintergrund (Recht „werkzeuge“). Vorführmodus mit Sprechernotizen, Export als
 * Drehbuch (Markdown) oder PDF.
 */
const { h, mdElement } = lyra;

const STANDARD = { laenge: 3, publikum: 'mitstudierende', ton: 'locker', ki: 'auto' };
const SYSTEM = `Du bist „Regie“ in Lyra: Du schreibst Drehbücher für kurze, anschauliche Erklärvideos und Präsentationen \
an der Hochschule. Klar gegliedert, ein Gedanke pro Szene, mit einem Bild, das genau diesen Gedanken zeigt. Fachlich \
korrekt, Formeln in LaTeX zwischen $…$.`;
const SCHEMA = {
  type: 'object',
  properties: {
    szenen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          abschnitt: { type: 'string' },
          bild: { type: 'string' },
          dauer_sekunden: { type: 'integer' },
          sprechtext: { type: 'string' },
        },
        required: ['abschnitt', 'bild', 'dauer_sekunden', 'sprechtext'],
      },
    },
    titel: { type: 'string' },
  },
  required: ['szenen', 'titel'],
};

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  projekte: [],
  p: null, // {id, thema, titel, szenen: [{abschnitt, bild, dauer, sprechtext, svg}], zeit}
  thema: '',
  graphit: false,
  laeuft: false,
  status: '',
  fehler: null,
  vorfuehren: -1,
  notizen: true,
};
const app = document.getElementById('app');
const dauerText = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** SVG von Graphit sicher einsetzen (nur Zeichnung – keine Skripte, keine Ereignisse, keine Links). */
function svgElement(svg, klasse) {
  const box = h('div', { class: klasse });
  if (!svg) return box;
  const sauber = String(svg).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/(href|xlink:href)\s*=\s*("[^#"][^"]*"|'[^#'][^']*')/gi, '');
  box.innerHTML = sauber;
  return box;
}

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { z.graphit = await lyra.installiert('graphit'); } catch (_) {}
  try { z.projekte = (await lyra.speicher.liste('projekte')).map((e) => e.wert).filter((p) => p && p.id).sort((a, b) => b.zeit - a.zeit); } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.vorfuehren >= 0) { z.vorfuehren = -1; return zeichnen(); }
    if (z.p) { z.p = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  document.addEventListener('keydown', (e) => {
    if (z.vorfuehren < 0 || document.querySelector('.dialog-grund')) return;
    if (['ArrowRight', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); z.vorfuehren = Math.min(z.p.szenen.length - 1, z.vorfuehren + 1); zeichnen(); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); z.vorfuehren = Math.max(0, z.vorfuehren - 1); zeichnen(); }
    if (e.key.toLowerCase() === 'n') { z.notizen = !z.notizen; zeichnen(); }
  });
  zeichnen();
  if ((z.info.route || location.hash.slice(1)) === 'einstellungen') einstellungen();
}

async function sichern() {
  if (!z.p) return;
  z.p.zeit = lyra.jetzt();
  try { await lyra.speicher.schreiben('projekte/' + z.p.id, z.p); } catch (_) {}
  z.projekte = [z.p, ...z.projekte.filter((x) => x.id !== z.p.id)];
}
function status(t) { z.status = t; const el = document.getElementById('status'); if (el) el.textContent = t; }

async function laufen(f) {
  if (z.laeuft) return;
  z.laeuft = true;
  z.fehler = null;
  zeichnen();
  try { await f(); } catch (e) {
    const m = String((e && e.message) || e);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
}

// ------------------------------------------------------------------ Drehbuch schreiben

function schreiben() {
  const thema = z.thema.trim();
  if (!thema) return;
  return laufen(async () => {
    status('Regie sucht passende Stellen in deinen Unterlagen …');
    let block = '';
    try { block = ((await lyra.suchen(thema, 6)).block || '').slice(0, z.lehrer === 'lyra' ? 5000 : 12000); } catch (_) {}
    const szenen = Math.max(3, Math.min(12, Math.round(z.einst.laenge * 2.2)));
    const publikum = { erstis: 'Studierende im ersten Semester ohne Vorwissen', mitstudierende: 'Mitstudierende mit Grundlagen', laien: 'interessierte Laien' }[z.einst.publikum];
    const r = await lyra.ki({
      lehrer: z.lehrer,
      system: SYSTEM,
      prompt: `Thema: ${thema}\nLänge: etwa ${z.einst.laenge} Minuten (${szenen} Szenen)\nPublikum: ${publikum}\nTon: ${z.einst.ton === 'locker' ? 'locker, anschaulich, mit Alltagsbezug' : 'sachlich und präzise'}\n\n\
${block ? `Auszüge aus meinen Unterlagen (halte dich an deren Inhalte und Bezeichnungen):\n\n${block}\n\n` : ''}\
Schreibe das Drehbuch: ein Einstieg, der neugierig macht, dann Schritt für Schritt erklären, zum Schluss eine kurze \
Zusammenfassung. Je Szene: "abschnitt" (Überschrift, kurz), "sprechtext" (was gesagt wird, natürlich gesprochen), \
"dauer_sekunden", "bild" (genaue Beschreibung EINES Schaubilds für diese Szene, so dass ein Zeichner es umsetzen kann – \
was ist zu sehen, was ist beschriftet). "titel": Titel des Videos.\n\n\
Antwort als JSON: {"szenen": [{"abschnitt": "…", "bild": "…", "dauer_sekunden": 20, "sprechtext": "…"}], "titel": "…"}`,
      schema: SCHEMA,
      zaehlen: { schluessel: 'abschnitt', wort: 'Szene' },
    }, (e) => { if (e.art === 'hinweis') status(e.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    const j = (r && r.json) || {};
    const liste = (j.szenen || []).map((s) => ({
      abschnitt: String(s.abschnitt || '').trim(), bild: String(s.bild || '').trim(), sprechtext: String(s.sprechtext || '').trim(),
      dauer: Math.max(5, Math.min(180, Math.round(Number(s.dauer_sekunden) || 20))), svg: '',
    })).filter((s) => s.sprechtext);
    if (!liste.length) throw new Error('Das Drehbuch kam nicht zustande – bitte nochmal versuchen.');
    z.p = { id: lyra.neueId(), thema, titel: String(j.titel || thema).trim(), szenen: liste, zeit: lyra.jetzt() };
    z.thema = '';
    await sichern();
  });
}

/** Schaubilder mit Graphit zeichnen – eine Szene oder alle, denen noch eins fehlt. */
function zeichnenLassen(nur) {
  const p = z.p;
  const ziele = nur !== undefined ? [nur] : p.szenen.map((s, i) => (s.svg || !s.bild ? -1 : i)).filter((i) => i >= 0);
  if (!ziele.length) return;
  return laufen(async () => {
    for (const [k, i] of ziele.entries()) {
      const s = p.szenen[i];
      status(`Graphit zeichnet Szene ${i + 1}${ziele.length > 1 ? ` (${k + 1}/${ziele.length})` : ''} …`);
      const r = await lyra.werkzeug('graphit', `${s.bild}\n(Schaubild für ein Erklärvideo über „${p.titel}“, Szene „${s.abschnitt}“)`, (e) => {
        if (e.art === 'hinweis') status(`Szene ${i + 1}: ${e.text}`);
      });
      s.svg = (r && r.svg) || '';
      await sichern();
      zeichnen();
    }
  });
}

function alsMarkdown(p) {
  const gesamt = p.szenen.reduce((a, s) => a + s.dauer, 0);
  return [`# ${p.titel}`, '', `Thema: ${p.thema} · Länge: ${dauerText(gesamt)} min · ${p.szenen.length} Szenen`, '',
    ...p.szenen.flatMap((s, i) => [`## Szene ${i + 1}: ${s.abschnitt} (${s.dauer} s)`, '', `**Bild:** ${s.bild}`, '', s.sprechtext, ''])].join('\n');
}

// ------------------------------------------------------------------ Ansichten

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  app.replaceChildren(z.vorfuehren >= 0 && z.p ? vorfuehrung() : h('div', { class: 'seite regie' }, z.p ? projektAnsicht() : startAnsicht()));
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); try { e.setSelectionRange(e.value.length, e.value.length); } catch (_) {} }
  lyra.titel(z.p ? z.p.titel : '');
}

function laufZeile() {
  return z.laeuft ? h('div', { style: { marginTop: '12px' } }, lyra.arbeit(z.status || 'Regie arbeitet …')) : null;
}
function fehlerZeile(nochmal) {
  return z.fehler ? h('div', { style: { marginTop: '12px' } }, lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; zeichnen(); } : null,
    () => { z.fehler = null; zeichnen(); }, nochmal ? () => { z.fehler = null; nochmal(); } : null)) : null;
}

function startAnsicht() {
  const pille = (schl, titel, optionen) => lyra.auswahl({ titel, optionen, wert: z.einst[schl], beiWahl: async (w) => { z.einst[schl] = w; try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {} zeichnen(); } });
  return h('div', {},
    lyra.kopf({ titel: 'Dein Erklärvideo', unter: 'Vom Thema zum fertigen Drehbuch: Szenen mit Sprechtext, Schaubilder von Graphit und eine Vorführung zum Üben.' }),
    lyra.verfasser({
      wert: z.thema,
      feld: 'thema',
      zeilen: 1,
      platzhalter: 'Worüber soll das Video gehen? z. B. „Wie funktioniert der Dijkstra-Algorithmus?“',
      beiEingabe: (v) => { z.thema = v; },
      beiSenden: (v) => { z.thema = v; schreiben(); },
      knopf: 'Drehbuch schreiben',
      symbol: '✍️',
      deaktiviert: !!z.laeuft,
      unten: [
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        pille('laenge', 'Länge', [[1, '1 min'], [3, '3 min'], [5, '5 min']]),
        pille('publikum', 'Für', [['erstis', 'Erstis'], ['mitstudierende', 'Mitstudierende'], ['laien', 'Laien']]),
        pille('ton', 'Ton', [['locker', 'Locker'], ['sachlich', 'Sachlich']]),
      ],
    }),
    laufZeile(), fehlerZeile(schreiben),
    !z.graphit ? h('div', { class: 'kasten warn klein', style: { marginTop: '12px' } }, 'Für die Schaubilder braucht Regie das Plugin Graphit – installier es im Plugin-Menü, dann zeichnet es die Bilder zu jeder Szene.') : null,
    z.projekte.length ? lyra.abschnitt('Deine Drehbücher', h('div', { class: 'raster' }, z.projekte.map((p) => h('div', { class: 'karte klickbar projekt-karte', onclick: () => { z.p = p; zeichnen(); } },
      svgElement((p.szenen.find((s) => s.svg) || {}).svg, 'mini'),
      h('div', { class: 'fett' }, p.titel),
      h('div', { class: 'klein leise' }, `${p.szenen.length} Szenen · ${dauerText(p.szenen.reduce((a, s) => a + s.dauer, 0))} min · ${lyra.zeitText(p.zeit || lyra.jetzt())}`))))) : null);
}

function projektAnsicht() {
  const p = z.p;
  const fehlen = p.szenen.filter((s) => !s.svg && s.bild).length;
  const gesamt = p.szenen.reduce((a, s) => a + s.dauer, 0);
  return h('div', {},
    h('div', { class: 'zeile umbruch', style: { marginBottom: '12px', gap: '6px' } },
      h('button', { class: 'knopf text', onclick: () => { z.p = null; zeichnen(); } }, '← Alle Drehbücher'),
      h('span', { class: 'wachsen' }),
      z.graphit && fehlen ? h('button', { class: 'knopf tonal', disabled: z.laeuft, onclick: () => zeichnenLassen() }, `🖌 ${fehlen} Bild${fehlen > 1 ? 'er' : ''} zeichnen`) : null,
      h('button', { class: 'knopf', onclick: () => { z.vorfuehren = 0; zeichnen(); } }, '▶ Vorführen'),
      h('button', { class: 'knopf tonal', onclick: () => lyra.drucken() }, '🖨 PDF'),
      h('button', { class: 'knopf tonal', onclick: async () => { try { await lyra.speichern(`${p.titel.replace(/[/\\:*?"<>|]/g, ' ')}.md`, alsMarkdown(p)); } catch (_) {} } }, 'Drehbuch (.md)'),
      h('button', { class: 'knopf text', onclick: async () => {
        if (!(await lyra.bestaetigen({ titel: `„${p.titel}“ löschen?`, text: ``, ja: 'Löschen', nein: 'Abbrechen', gefahr: true }))) return;
        try { await lyra.speicher.loeschen('projekte/' + p.id); } catch (_) {}
        z.projekte = z.projekte.filter((x) => x.id !== p.id);
        z.p = null;
        zeichnen();
      } }, '🗑')),
    h('h1', {}, p.titel),
    h('div', { class: 'leise klein', style: { marginBottom: '12px' } }, `${p.szenen.length} Szenen · ${dauerText(gesamt)} min · Sprechtexte zum Bearbeiten anklicken`),
    laufZeile(), fehlerZeile(),
    p.szenen.map((s, i) => {
      const text = h('div', { class: 'sprechtext', contenteditable: 'true', 'data-feld': 'text-' + i }, s.sprechtext);
      text.addEventListener('blur', () => { s.sprechtext = text.innerText.trim(); sichern(); });
      return h('div', { class: 'szene' },
        h('div', { class: 'szene-bild' },
          s.svg ? svgElement(s.svg, 'bild') : h('div', { class: 'bild-platz' }, h('div', { class: 'klein leise' }, s.bild || 'Kein Bild geplant'),
            z.graphit && s.bild ? h('button', { class: 'knopf tonal klein', disabled: z.laeuft, onclick: () => zeichnenLassen(i) }, '🖌 Zeichnen') : null),
          s.svg && z.graphit ? h('button', { class: 'knopf text klein nur-bildschirm', disabled: z.laeuft, onclick: () => zeichnenLassen(i) }, '↻ Neu zeichnen') : null),
        h('div', { class: 'szene-text' },
          h('div', { class: 'zeile' }, h('span', { class: 'szene-nr' }, String(i + 1)), h('div', { class: 'fett wachsen' }, s.abschnitt), h('span', { class: 'etikett' }, `${s.dauer} s`)),
          text,
          h('div', { class: 'klein leise' }, `🎨 ${s.bild}`)));
    }));
}

function vorfuehrung() {
  const p = z.p;
  const s = p.szenen[z.vorfuehren];
  return h('div', { class: 'buehne' },
    h('div', { class: 'buehne-kopf' },
      h('span', { class: 'klein' }, `${z.vorfuehren + 1} / ${p.szenen.length}`),
      h('span', { class: 'wachsen fett' }, s.abschnitt),
      h('button', { class: 'knopf text klein', onclick: () => { z.notizen = !z.notizen; zeichnen(); } }, z.notizen ? 'Notizen aus (N)' : 'Notizen an (N)'),
      h('button', { class: 'knopf text klein', onclick: () => { z.vorfuehren = -1; zeichnen(); } }, '✕ Ende')),
    h('div', { class: 'folie' }, s.svg ? svgElement(s.svg, 'folie-bild') : h('div', { class: 'folie-titel' }, s.abschnitt)),
    z.notizen ? h('div', { class: 'notizen' }, mdElement(s.sprechtext)) : null,
    h('div', { class: 'fortschritt' }, p.szenen.map((_, i) => h('span', { class: i <= z.vorfuehren ? 'an' : '', onclick: () => { z.vorfuehren = i; zeichnen(); } }))));
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
  const ok = await lyra.dialog('Regie – Einstellungen', h('div', { class: 'spalte', style: { minWidth: '420px', gap: '12px' } },
    h('div', { class: 'fett' }, 'Wer schreibt das Drehbuch'), wahl('ki', [['auto', 'Automatisch (Claude & Co., wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']]),
    h('div', { class: 'leise klein' }, 'Die Schaubilder zeichnet Graphit mit seinen eigenen Einstellungen.')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  z.lehrer = e.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
}

start();
