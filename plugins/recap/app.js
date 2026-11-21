'use strict';
/*
 * Recap – aus Besprechungsnotizen, Transkripten oder Protokollen wird in Sekunden: Kurzfassung, Entscheidungen,
 * To-dos (wer, bis wann) und offene Fragen. To-dos lassen sich abhaken, mit Fristen erinnern Mitteilungen von macOS.
 * Export als Markdown, PDF oder fertige Follow-up-Mail.
 */
const { h } = lyra;

const STANDARD = { ki: 'auto', erinnern: true, uhrzeit: '09:00', name: '' };
const PRIO = { hoch: ['Hoch', '#E5484D'], mittel: ['Mittel', '#F59E0B'], niedrig: ['Niedrig', '#94A3B8'] };

const SYSTEM = `Du bist „Recap“ in Lyra: Du wertest Besprechungsnotizen, Transkripte und Protokolle aus – präzise, \
knapp, ohne etwas zu erfinden. Du übernimmst nur, was im Text steht. Aufgaben sind konkrete Handlungen mit einem \
Verb („Angebot an Firma X schicken“), möglichst mit verantwortlicher Person und Termin. Datumsangaben rechnest du \
relativ zum Besprechungsdatum in JJJJ-MM-TT um; ohne Termin bleibt das Feld leer. Antworte auf Deutsch.`;

// Schlüssel alphabetisch sinnvoll: abriss (Kurzfassung) zuerst, titel zuletzt
const SCHEMA = {
  type: 'object',
  properties: {
    abriss: { type: 'string' },
    aufgaben: {
      type: 'array',
      items: {
        type: 'object',
        properties: { aufgabe: { type: 'string' }, bis: { type: 'string' }, prioritaet: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'] }, wer: { type: 'string' } },
        required: ['aufgabe', 'bis', 'prioritaet', 'wer'],
      },
    },
    entscheidungen: { type: 'array', items: { type: 'string' } },
    offeneFragen: { type: 'array', items: { type: 'string' } },
    titel: { type: 'string' },
  },
  required: ['abriss', 'aufgaben', 'entscheidungen', 'offeneFragen', 'titel'],
};

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  treffen: [], // [{id, titel, datum, teilnehmer, abriss, entscheidungen, aufgaben: [{id, aufgabe, wer, bis, prioritaet, erledigt}], offeneFragen, quelle, zeit}]
  offen: null,
  eingabe: { text: '', titel: '', datum: '', teilnehmer: '', datei: '' },
  laeuft: false,
  status: '',
  fehler: null,
  meldung: '',
};
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const heuteIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const deDatum = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : '');
const isoGueltig = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s + 'T12:00:00')) ? s : '');

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { z.treffen = (await lyra.speicher.liste('treffen')).map((e) => e.wert).filter((t) => t && t.id).sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || b.zeit - a.zeit); } catch (_) {}
  z.eingabe.datum = heuteIso();
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.offen) { z.offen = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('treffen/')) z.offen = z.treffen.find((t) => t.id === route.slice(8)) || null;
  zeichnen();
  nachaussen();
  if (route === 'einstellungen') einstellungen();
}

async function sichern(t = z.offen) {
  if (!t) return;
  t.zeit = lyra.jetzt();
  try { await lyra.speicher.schreiben('treffen/' + t.id, t); } catch (_) {}
  if (!z.treffen.includes(t)) z.treffen.unshift(t);
  nachaussen();
}

function offeneAufgaben() {
  const l = [];
  for (const t of z.treffen) for (const a of t.aufgaben || []) if (!a.erledigt) l.push({ t, a });
  return l.sort((x, y) => (x.a.bis || '9999').localeCompare(y.a.bis || '9999'));
}

function nachaussen() {
  const offen = offeneAufgaben();
  const e = [];
  if (offen.length) {
    const naechste = offen.find((x) => x.a.bis);
    e.push({
      id: 'todos',
      titel: `${offen.length} offene${offen.length === 1 ? 's' : ''} To-do${offen.length === 1 ? '' : 's'} aus Besprechungen`,
      untertitel: naechste ? `Als Nächstes: ${naechste.a.aufgabe} · ${deDatum(naechste.a.bis)}` : offen[0].a.aufgabe,
      route: '',
      geaendert: Date.now() / 1000,
    });
  }
  lyra.startseite(e).catch(() => {});
  if (!z.einst.erinnern) return lyra.erinnern([]).catch(() => {});
  const [hh, mm] = (z.einst.uhrzeit || '09:00').split(':').map(Number);
  const liste = [];
  for (const { t, a } of offen) {
    if (!a.bis) continue;
    const d = new Date(a.bis + 'T00:00:00');
    d.setHours(hh || 9, mm || 0, 0, 0);
    if (d.getTime() < Date.now()) continue;
    liste.push({ id: 'aufgabe-' + a.id, titel: `Heute fällig: ${a.aufgabe}`.slice(0, 120), text: `Aus „${t.titel}“${a.wer ? ` · ${a.wer}` : ''}`, zeit: Math.round(d.getTime() / 1000) });
  }
  lyra.erinnern(liste.slice(0, 50)).catch(() => {});
}

// ================================================================== Auswerten

function teilen(t, max) {
  if (t.length <= max) return [t];
  const teile = [];
  let rest = t;
  while (rest.length > max) {
    let schnitt = rest.lastIndexOf('\n\n', max);
    if (schnitt < max * 0.5) schnitt = rest.lastIndexOf('\n', max);
    if (schnitt < max * 0.5) schnitt = max;
    teile.push(rest.slice(0, schnitt));
    rest = rest.slice(schnitt);
  }
  if (rest.trim()) teile.push(rest);
  return teile;
}

/** Kalender der nächsten drei Wochen ab der Besprechung – damit „bis Montag“ ohne Rechnen zum richtigen Datum wird. */
function kalender(iso) {
  const start = new Date(iso + 'T12:00:00');
  const zeilen = [];
  for (let i = 0; i <= 24; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const tag = d.toLocaleDateString('de-DE', { weekday: 'long' });
    const j = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    zeilen.push(`${i === 0 ? 'heute (Besprechung)' : i === 1 ? 'morgen' : i <= 7 ? 'kommender ' + tag : i <= 14 ? 'übernächster ' + tag : tag + ' in drei Wochen'}: ${tag}, ${j}`);
  }
  return zeilen.join('\n');
}

function status(t) {
  z.status = t;
  const el = document.getElementById('status');
  if (el) el.textContent = t;
}

const neuId = (() => { let n = 0; return () => `${Date.now()}${n++}`; })();

async function auswerten() {
  const e = z.eingabe;
  if (!text(e.text) || z.laeuft) return;
  z.laeuft = true;
  z.fehler = null;
  zeichnen();
  const datum = isoGueltig(e.datum) || heuteIso();
  const teile = teilen(e.text.trim(), z.lehrer === 'lyra' ? 9000 : 60000);
  const sammel = { abriss: [], aufgaben: [], entscheidungen: [], offeneFragen: [], titel: '' };
  try {
    for (const [i, teil] of teile.entries()) {
      status(teile.length > 1 ? `Lese Teil ${i + 1} von ${teile.length} …` : 'Lese die Besprechung …');
      const r = await lyra.ki({
        lehrer: z.lehrer,
        system: SYSTEM,
        prompt: `Besprechung vom ${datum} (${new Date(datum + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long' })})${e.titel ? `, Thema „${e.titel}“` : ''}${e.teilnehmer ? `, dabei: ${e.teilnehmer}` : ''}.\
${teile.length > 1 ? ` Dies ist Teil ${i + 1} von ${teile.length}.` : ''}\n\n---\n${teil}\n---\n\n\
Kalender zum Nachschlagen (nicht selbst rechnen – „bis Montag“ ist der kommende Montag, „nächste Woche Freitag“ der \
Freitag der Folgewoche, „Ende November“ der letzte Tag im November):\n${kalender(datum)}\n\n\
Werte aus. "abriss": 2–4 Sätze, worum es ging und was herauskam. "aufgaben": jede vereinbarte Aufgabe (aufgabe mit \
Verb; wer: Name oder ""; bis: JJJJ-MM-TT oder ""; prioritaet: hoch, mittel oder niedrig). "entscheidungen": was \
beschlossen wurde. "offeneFragen": was ungeklärt blieb. "titel": kurzer Titel der Besprechung.\n\n\
Antwort als JSON: {"abriss": "…", "aufgaben": [{"aufgabe": "…", "bis": "", "prioritaet": "mittel", "wer": ""}], "entscheidungen": ["…"], "offeneFragen": ["…"], "titel": "…"}`,
        schema: SCHEMA,
        zaehlen: { schluessel: 'aufgabe', wort: 'To-do' },
      }, (x) => { if (x.art === 'hinweis') status(x.text); });
      if (r && r.lehrer) z.lehrer = r.lehrer;
      const j = (r && r.json) || {};
      if (text(j.abriss)) sammel.abriss.push(text(j.abriss));
      if (!sammel.titel && text(j.titel)) sammel.titel = text(j.titel);
      for (const a of Array.isArray(j.aufgaben) ? j.aufgaben : []) {
        const aufgabe = text(a && a.aufgabe).slice(0, 300);
        if (!aufgabe || sammel.aufgaben.some((x) => x.aufgabe.toLowerCase() === aufgabe.toLowerCase())) continue;
        sammel.aufgaben.push({ id: neuId(), aufgabe, wer: text(a.wer).slice(0, 80), bis: isoGueltig(text(a.bis)), prioritaet: PRIO[a.prioritaet] ? a.prioritaet : 'mittel', erledigt: false });
      }
      for (const k of ['entscheidungen', 'offeneFragen']) {
        for (const x of Array.isArray(j[k]) ? j[k] : []) {
          const s = text(x).slice(0, 400);
          if (s && !sammel[k].some((y) => y.toLowerCase() === s.toLowerCase())) sammel[k].push(s);
        }
      }
    }
    let abriss = sammel.abriss.join(' ');
    if (sammel.abriss.length > 1) {
      status('Fasse alles zusammen …');
      try {
        const r = await lyra.ki({ lehrer: z.lehrer, system: SYSTEM, prompt: `Fasse diese Teil-Zusammenfassungen einer Besprechung in 3–4 Sätzen zusammen:\n\n${sammel.abriss.join('\n\n')}` });
        if (text(r && r.text)) abriss = text(r.text);
      } catch (_) {}
    }
    if (!abriss && !sammel.aufgaben.length && !sammel.entscheidungen.length) throw new Error('Daraus ließ sich nichts auswerten – sind das wirklich Besprechungsnotizen?');
    const t = {
      id: lyra.neueId(),
      titel: text(e.titel) || sammel.titel || 'Besprechung',
      datum,
      teilnehmer: text(e.teilnehmer),
      abriss,
      entscheidungen: sammel.entscheidungen,
      aufgaben: sammel.aufgaben,
      offeneFragen: sammel.offeneFragen,
      quelle: e.text.slice(0, 200000),
      datei: e.datei,
      zeit: lyra.jetzt(),
    };
    z.treffen = [t, ...z.treffen];
    z.offen = t;
    z.eingabe = { text: '', titel: '', datum: heuteIso(), teilnehmer: '', datei: '' };
    await sichern(t);
  } catch (x) {
    const m = String((x && x.message) || x);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
}

async function dateiLaden() {
  try {
    const d = await lyra.dateiOeffnen({ arten: ['txt', 'md', 'docx', 'pdf'], titel: 'Notizen und Protokolle' });
    if (!d) return;
    z.eingabe.text = d.art === 'tabelle' ? (d.zeilen || []).map((r) => r.join('\t')).join('\n') : d.text || '';
    z.eingabe.datei = d.name;
    if (!z.eingabe.titel) z.eingabe.titel = d.name.replace(/\.[^.]+$/, '');
  } catch (e) { z.fehler = String((e && e.message) || e); }
  zeichnen();
}

// ================================================================== Export

function alsMarkdown(t) {
  const l = [`# ${t.titel}`, '', `**Datum:** ${deDatum(t.datum) || t.datum}${t.teilnehmer ? `  \n**Dabei:** ${t.teilnehmer}` : ''}`, '', '## Kurzfassung', '', t.abriss || '–', ''];
  if (t.entscheidungen.length) l.push('## Entscheidungen', '', ...t.entscheidungen.map((x) => `- ${x}`), '');
  if (t.aufgaben.length) {
    l.push('## To-dos', '', '| Erledigt | Aufgabe | Wer | Bis |', '|:-:|---|---|---|');
    for (const a of t.aufgaben) l.push(`| ${a.erledigt ? '✓' : ''} | ${a.aufgabe.replace(/\|/g, '/')} | ${a.wer || '–'} | ${a.bis ? deDatum(a.bis) : '–'} |`);
    l.push('');
  }
  if (t.offeneFragen.length) l.push('## Offene Fragen', '', ...t.offeneFragen.map((x) => `- ${x}`), '');
  return l.join('\n');
}

function alsMail(t) {
  const l = [`Betreff: Zusammenfassung – ${t.titel} (${deDatum(t.datum)})`, '', 'Hallo zusammen,', '', `danke für die Besprechung! Hier das Wichtigste in Kürze:`, '', t.abriss, ''];
  if (t.entscheidungen.length) l.push('Entschieden:', ...t.entscheidungen.map((x) => `• ${x}`), '');
  const offen = t.aufgaben.filter((a) => !a.erledigt);
  if (offen.length) l.push('Nächste Schritte:', ...offen.map((a) => `• ${a.aufgabe}${a.wer ? ` – ${a.wer}` : ''}${a.bis ? ` (bis ${deDatum(a.bis)})` : ''}`), '');
  if (t.offeneFragen.length) l.push('Noch offen:', ...t.offeneFragen.map((x) => `• ${x}`), '');
  l.push('Falls ich etwas vergessen habe, gebt gern Bescheid.', '', 'Viele Grüße', z.einst.name || '');
  return l.join('\n').trim() + '\n';
}

async function mailZeigen(t) {
  const feld = h('textarea', { class: 'eingabe', rows: 18, style: { minWidth: '560px', fontSize: '13.5px' } });
  feld.value = alsMail(t);
  const w = await lyra.dialog('Follow-up-Mail', h('div', {},
    h('p', { class: 'leise klein', style: { marginBottom: '8px' } }, 'Fertig zum Einfügen in dein Mailprogramm – du kannst alles anpassen.'), feld), [
    { text: 'Schließen', art: 'text', wert: false },
    { text: 'Als Text sichern …', art: 'tonal', wert: 'sichern' },
    { text: 'Kopieren', wert: 'kopieren' },
  ]);
  if (w === 'kopieren') {
    kopieren(feld.value);
    z.meldung = '✓ In die Zwischenablage kopiert';
  } else if (w === 'sichern') {
    const ok = await lyra.speichern(`${t.titel} – Follow-up.txt`, feld.value);
    z.meldung = ok ? '✓ Gesichert' : '';
  }
  zeichnen();
}

function kopieren(s) {
  const f = h('textarea', { style: { position: 'fixed', opacity: '0' } });
  f.value = s;
  document.body.appendChild(f);
  f.select();
  try { document.execCommand('copy'); } catch (_) {}
  f.remove();
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  app.replaceChildren(z.offen ? treffenAnsicht(z.offen) : startAnsicht());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); try { if (e.tagName === 'TEXTAREA' || e.type === 'text') e.setSelectionRange(e.value.length, e.value.length); } catch (_) {} }
  lyra.titel(z.offen ? z.offen.titel : '');
}

function eingabeFeld(schl, attr) {
  const f = h(attr.rows ? 'textarea' : 'input', { class: 'eingabe', 'data-feld': 'e-' + schl, ...attr });
  f.value = z.eingabe[schl];
  f.addEventListener('input', () => {
    z.eingabe[schl] = f.value;
    const k = document.getElementById('los');
    if (k) k.disabled = z.laeuft || !z.eingabe.text.trim();
    if (schl === 'text') { const n = document.getElementById('zeichen'); if (n) n.textContent = zeichenText(); }
  });
  return f;
}

const zeichenText = () => (z.eingabe.text ? `${z.eingabe.text.trim().split(/\s+/).length.toLocaleString('de-DE')} Wörter${z.eingabe.datei ? ` · aus ${z.eingabe.datei}` : ''}` : '');

function startAnsicht() {
  const offen = offeneAufgaben();
  return h('div', { class: 'seite breit' },
    lyra.kopf({ titel: 'Besprechung auswerten', unter: 'Notizen, Transkript oder Protokoll rein – Kurzfassung, Entscheidungen, To-dos mit Terminen und offene Fragen raus.' }),
    h('div', { class: 'raster-start' },
      h('div', { class: 'flaeche spalte', style: { gap: '10px' } },
        h('div', { class: 'zeile' },
          h('div', { class: 'ueberschrift-klein wachsen' }, 'Neue Besprechung'),
          h('button', { class: 'knopf tonal klein', onclick: dateiLaden }, 'Datei öffnen …')),
        eingabeFeld('text', { rows: 10, placeholder: 'Notizen, Transkript oder Protokoll hier einfügen – Stichpunkte reichen.\n\nz. B. „Lisa schickt bis Freitag das Angebot. Budget für Q3 bleibt bei 20k. Offen: wer übernimmt die Präsentation?“' }),
        h('div', { class: 'leise klein', id: 'zeichen' }, zeichenText()),
        h('div', { class: 'drei' },
          h('label', { class: 'feld' }, 'Titel (optional)', eingabeFeld('titel', { placeholder: 'wird sonst vorgeschlagen' })),
          h('label', { class: 'feld' }, 'Datum', eingabeFeld('datum', { type: 'date' })),
          h('label', { class: 'feld' }, 'Wer war dabei (optional)', eingabeFeld('teilnehmer', { placeholder: 'Lisa, Tom, ich' }))),
        h('div', { class: 'zeile' },
          z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
          h('span', { class: 'wachsen' }),
          h('button', { class: 'knopf gross', id: 'los', disabled: z.laeuft || !z.eingabe.text.trim(), onclick: auswerten }, '✨ Auswerten')),
        z.laeuft ? lyra.arbeit(z.status || 'Recap liest die Besprechung …') : null,
        z.fehler ? lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; auswerten(); } : null,
          () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; auswerten(); }) : null),
      h('div', { class: 'flaeche' },
        h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, `Meine To-dos${offen.length ? ` · ${offen.length}` : ''}`),
        offen.length ? h('div', { class: 'spalte', style: { gap: '2px' } }, offen.slice(0, 14).map(({ t, a }) => h('div', { class: 'todo-mini' },
          h('input', { type: 'checkbox', onchange: () => { a.erledigt = true; sichern(t); zeichnen(); } }),
          h('div', { class: 'wachsen', style: { minWidth: 0 } },
            h('div', { class: 'eine-zeile' }, a.aufgabe),
            h('div', { class: 'klein leise eine-zeile', onclick: () => { z.offen = t; zeichnen(); }, style: { cursor: 'pointer' } }, [t.titel, a.wer, a.bis ? deDatum(a.bis) : ''].filter(Boolean).join(' · '))),
          a.bis && a.bis < heuteIso() ? h('span', { class: 'ueberfaellig' }, 'überfällig') : null)))
          : h('div', { class: 'leise klein' }, 'Keine offenen To-dos. 🎉'))),
    z.treffen.length ? h('div', { style: { marginTop: '20px' } },
      h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, 'Besprechungen'),
      h('div', { class: 'ly-liste' }, z.treffen.map((t) => {
        const n = t.aufgaben.length, f = t.aufgaben.filter((a) => a.erledigt).length;
        return lyra.eintrag({
          symbol: f === n && n ? '✓' : '🗒',
          farbe: f === n && n ? 'var(--ok)' : '',
          titel: t.titel,
          unter: `${deDatum(t.datum)} · ${t.entscheidungen.length} Entscheidungen · ${f}/${n} To-dos erledigt`,
          fortschritt: n ? f / n : null,
          beiKlick: () => { z.offen = t; zeichnen(); },
          aktionen: [{ symbol: '🗑', titel: 'Löschen', bei: () => loeschen(t) }],
        });
      }))) : null);
}

function liste(t, schl, titel, symbol, platz) {
  const l = t[schl];
  return h('div', { class: 'flaeche abschnitt' },
    h('div', { class: 'zeile', style: { marginBottom: '8px' } },
      h('div', { class: 'ueberschrift-klein wachsen' }, `${symbol} ${titel}`),
      h('button', { class: 'knopf symbol nur-bildschirm', title: 'Hinzufügen', onclick: () => { l.push(''); sichern(t); zeichnen(); setTimeout(() => { const f = document.querySelector(`[data-feld="${schl}-${l.length - 1}"]`); if (f) f.focus(); }); } }, '+')),
    l.length ? h('div', { class: 'spalte', style: { gap: '4px' } }, l.map((x, i) => {
      const f = h('textarea', { class: 'still', rows: 1, 'data-feld': `${schl}-${i}` });
      f.value = x;
      const hoehe = () => { f.style.height = 'auto'; f.style.height = f.scrollHeight + 'px'; };
      f.addEventListener('input', () => { l[i] = f.value; hoehe(); });
      f.addEventListener('change', () => { if (!f.value.trim()) l.splice(i, 1); sichern(t); zeichnen(); });
      setTimeout(hoehe);
      return h('div', { class: 'punkt' }, h('span', { class: 'punkt-zeichen' }, '•'), f);
    })) : h('div', { class: 'leise klein' }, platz));
}

function treffenAnsicht(t) {
  const titel = h('input', { class: 'titel-feld', 'data-feld': 'titel', value: t.titel });
  titel.addEventListener('change', () => { t.titel = titel.value.trim() || t.titel; sichern(t); lyra.titel(t.titel); });
  const abriss = h('textarea', { class: 'still abriss', 'data-feld': 'abriss', rows: 3 });
  abriss.value = t.abriss;
  abriss.addEventListener('input', () => { t.abriss = abriss.value; abriss.style.height = 'auto'; abriss.style.height = abriss.scrollHeight + 'px'; });
  abriss.addEventListener('change', () => sichern(t));
  setTimeout(() => { abriss.style.height = abriss.scrollHeight + 'px'; });
  const erledigt = t.aufgaben.filter((a) => a.erledigt).length;
  return h('div', { class: 'seite breit treffen' },
    h('div', { class: 'zeile nur-bildschirm', style: { marginBottom: '6px' } },
      h('button', { class: 'knopf text klein', style: { paddingLeft: 0 }, onclick: () => { z.offen = null; zeichnen(); } }, '← Alle Besprechungen'),
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf tonal klein', onclick: () => mailZeigen(t) }, '✉︎ Follow-up-Mail'),
      h('button', { class: 'knopf tonal klein', onclick: async () => { const ok = await lyra.speichern(`${t.titel}.md`, alsMarkdown(t)); z.meldung = ok ? '✓ Als Markdown gesichert' : ''; zeichnen(); } }, 'Markdown'),
      h('button', { class: 'knopf tonal klein', onclick: () => lyra.drucken() }, 'PDF / Drucken'),
      h('button', { class: 'knopf symbol', title: 'Löschen', onclick: () => loeschen(t) }, '🗑')),
    z.meldung ? h('div', { class: 'meldung nur-bildschirm' }, z.meldung) : null,
    titel,
    h('div', { class: 'zeile leise klein', style: { gap: '10px', marginBottom: '14px' } },
      h('input', { class: 'datum-feld', type: 'date', value: t.datum, onchange: (e) => { t.datum = isoGueltig(e.target.value) || t.datum; sichern(t); } }),
      t.teilnehmer ? h('span', {}, `· ${t.teilnehmer}`) : null,
      t.datei ? h('span', {}, `· aus ${t.datei}`) : null),
    h('div', { class: 'flaeche abschnitt abriss-flaeche' }, h('div', { class: 'ueberschrift-klein', style: { marginBottom: '6px' } }, '📝 Kurzfassung'), abriss),
    h('div', { class: 'flaeche abschnitt' },
      h('div', { class: 'zeile', style: { marginBottom: '8px' } },
        h('div', { class: 'ueberschrift-klein wachsen' }, `✅ To-dos · ${erledigt}/${t.aufgaben.length}`),
        h('button', { class: 'knopf symbol nur-bildschirm', title: 'To-do hinzufügen', onclick: () => { t.aufgaben.push({ id: neuId(), aufgabe: '', wer: '', bis: '', prioritaet: 'mittel', erledigt: false }); zeichnen(); setTimeout(() => { const f = document.querySelector(`[data-feld="a-${t.aufgaben.length - 1}"]`); if (f) f.focus(); }); } }, '+')),
      t.aufgaben.length ? h('div', { class: 'aufgaben' }, t.aufgaben.map((a, i) => aufgabeZeile(t, a, i))) : h('div', { class: 'leise klein' }, 'Keine Aufgaben vereinbart.')),
    h('div', { class: 'zwei' },
      liste(t, 'entscheidungen', 'Entscheidungen', '🔨', 'Keine Entscheidungen festgehalten.'),
      liste(t, 'offeneFragen', 'Offene Fragen', '❓', 'Nichts offen geblieben.')),
    t.quelle ? h('details', { class: 'quelle nur-bildschirm' }, h('summary', { class: 'leise klein' }, 'Ursprünglicher Text'), h('pre', {}, t.quelle)) : null);
}

function aufgabeZeile(t, a, i) {
  const f = h('input', { class: 'still aufgabe-text', 'data-feld': `a-${i}`, value: a.aufgabe, placeholder: 'Was ist zu tun?' });
  f.addEventListener('change', () => { a.aufgabe = f.value.trim(); if (!a.aufgabe) t.aufgaben.splice(i, 1); sichern(t); zeichnen(); });
  const wer = h('input', { class: 'still wer', value: a.wer, placeholder: 'wer?' });
  wer.addEventListener('change', () => { a.wer = wer.value.trim(); sichern(t); });
  const bis = h('input', { class: 'still bis', type: 'date', value: a.bis });
  bis.addEventListener('change', () => { a.bis = isoGueltig(bis.value); sichern(t); zeichnen(); });
  const prio = PRIO[a.prioritaet] || PRIO.mittel;
  return h('div', { class: 'aufgabe' + (a.erledigt ? ' erledigt' : '') },
    h('input', { type: 'checkbox', checked: a.erledigt, onchange: (e) => { a.erledigt = e.target.checked; sichern(t); zeichnen(); } }),
    h('button', { class: 'prio', title: 'Priorität ändern', style: { '--p': prio[1] }, onclick: () => { const k = Object.keys(PRIO); a.prioritaet = k[(k.indexOf(a.prioritaet) + 1) % k.length]; sichern(t); zeichnen(); } }, prio[0]),
    f, wer, bis,
    a.bis && !a.erledigt && a.bis < heuteIso() ? h('span', { class: 'ueberfaellig' }, 'überfällig') : null);
}

async function loeschen(t) {
  const ok = await lyra.dialog('Besprechung löschen?', h('p', {}, `„${t.titel}“ samt To-dos wird gelöscht.`), [
    { text: 'Abbrechen', art: 'text', wert: false }, { text: 'Löschen', wert: true }]);
  if (!ok) return;
  try { await lyra.speicher.loeschen('treffen/' + t.id); } catch (_) {}
  z.treffen = z.treffen.filter((x) => x !== t);
  z.offen = null;
  nachaussen();
  zeichnen();
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
  const name = h('input', { class: 'eingabe', value: e.name, placeholder: 'für den Gruß in Follow-up-Mails' });
  const zeit = h('input', { class: 'eingabe', type: 'time', value: e.uhrzeit, style: { width: '120px' } });
  const ok = await lyra.dialog('Recap – Einstellungen', h('div', { style: { minWidth: '440px' } },
    g('Dein Name', name),
    g('Erinnerung an fällige To-dos', wahl('erinnern', [[true, 'Ja'], [false, 'Nein']])),
    g('Uhrzeit der Erinnerung', zeit),
    g('Wer wertet aus', wahl('ki', [['auto', 'Automatisch (Claude & Co., wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']]))), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = { ...e, name: name.value.trim(), uhrzeit: zeit.value || '09:00' };
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {}
  nachaussen();
  zeichnen();
}

start();
