'use strict';
/*
 * Launchpad – Testräume und Werkstatt (lädt nach app.js und nutzt dessen Bausteine).
 * Testräume: Unit-Tests, Szenarien (Eingabe → erwartete Ausgabe), Leistung (Laufzeit-Grenze) und Datenprüfung (CSV),
 * jeweils mit Verlauf; der Mitarbeiter kann sie ausführen, die Qualitätssicherung tut es vor jeder Abnahme.
 * Werkstatt: Spielwiese (Code in der Sandbox ausprobieren), Analyse (Kennzahlen, Importe, Datenprofil, Syntax),
 * KI-Code-Review (Funde übernimmst du einzeln als Aufgabe) und Versionen (vor jedem Lauf automatisch gesichert,
 * vergleichen, wiederherstellen). Nichts davon ändert den Arbeitsbereich ohne deinen Klick.
 */

Object.assign(ICONS, {
  labor: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7.5 14h9"/>',
  werkstatt: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  version: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="9" r="2.5"/><path d="M6 8.5v7M18 11.5c0 3-3 4-9.5 5"/>',
  analyse: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  review: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
});

const TESTARTEN = {
  unit: ['Unit-Tests', 'Testdateien ausführen (Python: alle test_*.py, sonst ein Testprogramm)', 'test'],
  szenario: ['Szenarien', 'Programm mit Eingaben starten und die Ausgabe prüfen', 'play'],
  leistung: ['Leistung', 'Laufzeit über mehrere Durchläufe gegen eine Grenze messen', 'uhr'],
  daten: ['Datenprüfung', 'CSV prüfen: Zeilen, Pflichtspalten, leere Werte, eindeutiger Schlüssel', 'datei'],
};
const VERGLEICHE = { gleich: 'genau gleich', enthaelt: 'enthält', regex: 'passt zu Muster (Regex)' };
const SCHWERE = { kritisch: ['Kritisch', 4], hoch: ['Hoch', 3], mittel: ['Mittel', 2], niedrig: ['Niedrig', 1] };
const WERKSTATT = [['spielwiese', 'Spielwiese', 'play'], ['analyse', 'Analyse', 'analyse'], ['review', 'Code-Review', 'review'], ['versionen', 'Versionen', 'version']];

z.werkstatt = 'spielwiese';
z.spiel = { sprache: 'python', code: 'from pathlib import Path\n\n# Alle Dateien des Arbeitsbereichs liegen im Arbeitsordner\nfor p in sorted(Path(".").rglob("*")):\n    if p.is_file():\n        print(p)\n', eingabe: '', ergebnis: null };
z.testOffen = null;
z.vergleich = null; // {id, titel, dateien, datei}
z.reviewDatei = '';

function werkstattFelder(p) {
  if (!p) return p;
  p.testraeume = Array.isArray(p.testraeume) ? p.testraeume : [];
  p.versionen = Array.isArray(p.versionen) ? p.versionen : [];
  if (p.review === undefined) p.review = null;
  return p;
}

// ================================================================== Gemeinsames

/** Sandbox-Lauf ohne Rückübernahme von Dateien (Tests und Spielwiese verändern den Arbeitsbereich nicht). */
function sandbox({ sprache, start, eingabe = '', sekunden = 40, tests = false, extra = {} }) {
  return lyra.code({ sprache, dateien: sandboxDateien(extra), start: tests ? 'unittest' : start, eingabe, sekunden });
}
const zeilenNorm = (t) => String(t || '').replace(/\r/g, '').split('\n').map((x) => x.replace(/\s+$/, '')).join('\n').trim();
function vergleichen(erhalten, erwartet, art) {
  if (art === 'regex') { try { return new RegExp(erwartet, 'm').test(erhalten); } catch (_) { return false; } }
  if (art === 'enthaelt') return zeilenNorm(erhalten).includes(zeilenNorm(erwartet));
  return zeilenNorm(erhalten) === zeilenNorm(erwartet);
}
function csvParsen(t, max = 20000) {
  const zeilen = String(t || '').replace(/\r/g, '').split('\n').filter((x) => x.length);
  const erste = zeilen[0] || '';
  const trenner = erste.split('\t').length > erste.split(',').length ? '\t' : erste.split(';').length > erste.split(',').length ? ';' : ',';
  const teilen = (s) => { const aus = []; let cur = '', q = false; for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '"') { if (q && s[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === trenner && !q) { aus.push(cur); cur = ''; } else cur += c; } aus.push(cur); return aus.map((x) => x.trim()); };
  return { kopf: teilen(erste), zeilen: zeilen.slice(1, max + 1).map(teilen), anzahl: Math.max(0, zeilen.length - 1) };
}
function unittestZahlen(gesamt, ok) {
  const ran = gesamt.match(/Ran (\d+) tests?/);
  const fehl = gesamt.match(/FAILED \(([^)]*)\)/);
  const zahl = (k) => { const m = fehl && fehl[1].match(new RegExp(k + '=(\\d+)')); return m ? +m[1] : 0; };
  return { gesamt: ran ? +ran[1] : null, fehl: fehl ? zahl('failures') + zahl('errors') : ok ? 0 : null };
}
const testStatusText = (e) => (!e ? 'noch nicht ausgeführt' : `${e.ok ? 'bestanden' : 'fehlgeschlagen'} · ${e.bestanden}/${e.gesamt} · ${e.dauerMs} ms · ${lyra.zeitText(e.zeit)}`);

// ================================================================== Testräume

async function testraumAusfuehren(t, { aufgabe: aid = null, leise = false } = {}) {
  const t0 = Date.now();
  const details = [];
  let ausgabe = '';
  if (t.art === 'unit') {
    const sprache = t.sprache || 'python';
    const discover = sprache === 'python' && !t.start;
    if (!discover && z.dateien[t.start] === undefined) details.push({ name: t.start || '(keine Startdatei)', ok: false, info: 'Testprogramm fehlt im Arbeitsbereich' });
    else if (discover && !Object.keys(z.dateien).some((x) => /^test[^/]*\.py$/.test(x))) details.push({ name: 'test_*.py', ok: false, info: 'Keine Testdateien test_*.py im Hauptordner' });
    else {
      const r = await sandbox({ sprache, start: t.start, tests: discover, sekunden: 60 });
      ausgabe = tracebackSaeubern(`${r.ausgabe || ''}\n${r.fehler || ''}`).trim();
      const re = /^(\w+) \(([^)]+)\)[^\n]*?\.\.\. (ok|FAIL|ERROR|skipped[^\n]*)$/gm;
      let m;
      while ((m = re.exec(ausgabe))) details.push({ name: `${m[2].split('.').slice(-2, -1)[0] || m[2]}.${m[1]}`, ok: m[3] === 'ok' || m[3].startsWith('skipped'), info: m[3] === 'ok' ? '' : m[3] });
      if (!details.length) {
        const { gesamt, fehl } = unittestZahlen(ausgabe, r.ok);
        details.push({ name: t.start || 'Testlauf', ok: !!r.ok && !r.zeitUm, info: r.zeitUm ? 'Zeitlimit überschritten' : gesamt !== null ? `${gesamt - (fehl || 0)} von ${gesamt} bestanden` : r.ok ? 'Exit-Code 0' : `Exit-Code ${r.code}` });
      }
    }
  } else if (t.art === 'szenario') {
    if (z.dateien[t.start] === undefined) details.push({ name: t.start || '(keine Startdatei)', ok: false, info: 'Programm fehlt im Arbeitsbereich' });
    for (const f of z.dateien[t.start] === undefined ? [] : (t.faelle || []).slice(0, 12)) {
      const r = await sandbox({ sprache: t.sprache || SPRACHE_VON_ENDUNG[endung(t.start)] || 'python', start: t.start, eingabe: f.eingabe || '', sekunden: 20 });
      const erhalten = String(r.ausgabe || '');
      const ok = !!r.ok && vergleichen(erhalten, f.erwartet || '', f.vergleich || 'gleich');
      details.push({ name: f.name || 'Fall', ok, info: r.zeitUm ? 'Zeitlimit' : !r.ok ? `Fehler (Code ${r.code})` : ok ? '' : 'Ausgabe weicht ab', erwartet: f.erwartet || '', erhalten: kurz(erhalten, 3000), fehler: r.ok ? '' : kurz(tracebackSaeubern(r.fehler || ''), 1500), vergleich: f.vergleich || 'gleich' });
    }
  } else if (t.art === 'leistung') {
    if (z.dateien[t.start] === undefined) details.push({ name: t.start || '(keine Startdatei)', ok: false, info: 'Programm fehlt im Arbeitsbereich' });
    else {
      const n = Math.max(1, Math.min(5, t.wiederholungen || 3));
      const zeiten = [];
      let fehler = '';
      for (let i = 0; i < n; i++) {
        const r = await sandbox({ sprache: t.sprache || SPRACHE_VON_ENDUNG[endung(t.start)] || 'python', start: t.start, eingabe: t.eingabe || '', sekunden: 60 });
        if (!r.ok) { fehler = r.zeitUm ? 'Zeitlimit überschritten' : `Fehler (Code ${r.code}): ${kurz(tracebackSaeubern(r.fehler || ''), 400)}`; break; }
        zeiten.push(r.dauerMs);
      }
      const schnitt = zeiten.length ? Math.round(zeiten.reduce((s, x) => s + x, 0) / zeiten.length) : 0;
      details.push({ name: `${zeiten.length} Durchläufe`, ok: !fehler && schnitt <= (t.grenzeMs || 1000), info: fehler || `Ø ${schnitt} ms (min ${Math.min(...zeiten)} · max ${Math.max(...zeiten)}) – Grenze ${t.grenzeMs || 1000} ms` });
    }
  } else if (t.art === 'daten') {
    const inhalt = z.dateien[t.datei];
    if (inhalt === undefined) details.push({ name: t.datei || '(keine Datei)', ok: false, info: 'Datei fehlt im Arbeitsbereich' });
    else {
      const { kopf, zeilen, anzahl } = csvParsen(inhalt, 200000);
      if (t.minZeilen) details.push({ name: `Mindestens ${t.minZeilen} Zeilen`, ok: anzahl >= t.minZeilen, info: `${anzahl.toLocaleString('de-DE')} Datenzeilen` });
      const pflicht = String(t.spalten || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (pflicht.length) {
        const fehlen = pflicht.filter((x) => !kopf.includes(x));
        details.push({ name: 'Pflichtspalten', ok: !fehlen.length, info: fehlen.length ? `fehlt: ${fehlen.join(', ')}` : pflicht.join(', ') });
      }
      if (t.keineLeeren) {
        let leer = 0;
        zeilen.forEach((r) => kopf.forEach((_, i) => { if (!r[i]) leer++; }));
        details.push({ name: 'Keine leeren Werte', ok: leer === 0, info: leer ? `${leer} leere ${leer === 1 ? 'Zelle' : 'Zellen'}` : 'alle Zellen gefüllt' });
      }
      const breite = zeilen.filter((r) => r.length !== kopf.length).length;
      details.push({ name: 'Gleich viele Spalten je Zeile', ok: breite === 0, info: breite ? `${breite} Zeilen mit abweichender Spaltenzahl` : `${kopf.length} Spalten` });
      if (t.schluessel) {
        const i = kopf.indexOf(t.schluessel);
        const werte = i >= 0 ? zeilen.map((r) => r[i]) : [];
        const doppelt = werte.length - new Set(werte).size;
        details.push({ name: `„${t.schluessel}“ eindeutig`, ok: i >= 0 && doppelt === 0, info: i < 0 ? 'Spalte fehlt' : doppelt ? `${doppelt} ${doppelt === 1 ? 'doppelter Wert' : 'doppelte Werte'}` : 'eindeutig' });
      }
    }
  }
  const e = { zeit: lyra.jetzt(), ok: details.length > 0 && details.every((d) => d.ok), bestanden: details.filter((d) => d.ok).length, gesamt: details.length, dauerMs: Date.now() - t0, details, ausgabe: kurz(ausgabe, 6000) };
  t.letzte = e;
  t.verlauf = [...(t.verlauf || []), { zeit: e.zeit, ok: e.ok, bestanden: e.bestanden, gesamt: e.gesamt, dauerMs: e.dauerMs }].slice(-20);
  protokollieren('test', `Testraum „${t.name}“: ${e.ok ? 'bestanden' : 'fehlgeschlagen'} (${e.bestanden}/${e.gesamt})`,
    details.map((d) => `${d.ok ? '✓' : '✗'} ${d.name}${d.info ? ' – ' + d.info : ''}`).join('\n') + (ausgabe ? `\n\n${kurz(ausgabe, 1500)}` : ''), { aufgabe: aid, ok: e.ok });
  if (!leise) zeichnen();
  return e;
}

/** Alle Testräume nacheinander – für dich, für den Mitarbeiter und für die Qualitätssicherung. */
async function alleTestraeume({ aufgabe: aid = null } = {}) {
  const p = z.p;
  const liste = (p && p.testraeume) || [];
  const zeilen = [];
  let gruen = 0;
  for (const t of liste) {
    status(`Testraum „${t.name}“ läuft …`);
    const e = await testraumAusfuehren(t, { aufgabe: aid, leise: true });
    if (e.ok) gruen++;
    zeilen.push(`${e.ok ? '✓' : '✗'} ${t.name} (${TESTARTEN[t.art][0]}): ${e.bestanden}/${e.gesamt}${e.ok ? '' : ' – ' + e.details.filter((d) => !d.ok).slice(0, 4).map((d) => `${d.name}${d.info ? ': ' + d.info : ''}${d.erwartet !== undefined && !d.ok ? `\n    erwartet: ${kurz(d.erwartet, 200)}\n    erhalten: ${kurz(d.erhalten, 200)}` : ''}`).join('; ')}`);
  }
  await sichern(p);
  return { ok: gruen === liste.length, gruen, gesamt: liste.length, text: zeilen.join('\n') || '(keine Testräume)' };
}

async function testsLaufenLassen(t) {
  if (z.laeuft) return;
  z.laeuft = { art: 'tests' };
  z.fehler = null;
  status(t ? `Testraum „${t.name}“ läuft …` : 'Alle Testräume laufen …');
  zeichnen();
  try {
    if (t) { await testraumAusfuehren(t, { leise: true }); z.testOffen = t.id; await sichern(); }
    else { const e = await alleTestraeume(); lyra.toast(`${e.gruen} von ${e.gesamt} Testräumen grün`, e.ok ? 'ok' : 'fehler'); }
  } catch (e) { if (!abgebrochen(e)) z.fehler = meldung(e); }
  z.laeuft = null;
  zeichnen();
}

const FAELLE_SCHEMA = {
  type: 'object',
  properties: { faelle: { type: 'array', items: { type: 'object', properties: { eingabe: { type: 'string' }, erwartet: { type: 'string' }, name: { type: 'string' }, vergleich: { type: 'string', enum: Object.keys(VERGLEICHE) } }, required: ['eingabe', 'erwartet', 'name', 'vergleich'] } } },
  required: ['faelle'],
};

/** Testfälle für ein Programm vorschlagen lassen – übernommen wird erst mit „Speichern“. */
async function faelleVorschlagen(start, bisher) {
  const quelle = z.dateien[start];
  if (quelle === undefined) throw new Error('Wähle zuerst das Programm.');
  const r = await lyra.ki({
    lehrer: z.lehrer, system: MITARBEITER, schema: FAELLE_SCHEMA,
    prompt: `${projektKontext(z.p)}\n\nProgramm ${start}:\n${kurz(quelle, gross() ? 20000 : 6000)}\n\n${bisher.length ? `Vorhandene Fälle: ${bisher.map((f) => f.name).join(', ')}\n\n` : ''}\
Schlag 3 bis 6 Szenario-Tests für dieses Programm vor: typische Eingaben, Grenzfälle und eine fehlerhafte Eingabe. Je "name", \
"eingabe" (Standardeingabe, genau wie getippt, Zeilen mit \\n), "erwartet" (die Ausgabe, die das Programm liefern MUSS) und \
"vergleich": "gleich" (ganze Ausgabe), "enthaelt" (ein kennzeichnender Teil – meist die beste Wahl) oder "regex". Liest das \
Programm keine Eingabe, bleibt "eingabe" leer.\n\nAntwort als JSON: {"faelle": [{"eingabe": "", "erwartet": "", "name": "", "vergleich": "enthaelt"}]}`,
  });
  return (((r && r.json) || {}).faelle || []).filter((f) => f && text(f.name)).slice(0, 8)
    .map((f) => ({ name: text(f.name).slice(0, 80), eingabe: String(f.eingabe || ''), erwartet: String(f.erwartet || ''), vergleich: VERGLEICHE[f.vergleich] ? f.vergleich : 'enthaelt' }));
}

async function testraumDialog(id) {
  const p = z.p;
  const alt = id ? p.testraeume.find((t) => t.id === id) : null;
  const programme = Object.keys(z.dateien).filter((x) => SPRACHE_VON_ENDUNG[endung(x)]).sort();
  const daten = Object.keys(z.dateien).filter((x) => ['csv', 'tsv'].includes(endung(x))).sort();
  const d = alt ? JSON.parse(JSON.stringify(alt)) : { name: '', art: 'unit', sprache: 'python', start: '', faelle: [], wiederholungen: 3, grenzeMs: 1000, eingabe: '', datei: daten[0] || '', minZeilen: 1, spalten: '', keineLeeren: true, schluessel: '' };
  const box = h('div', { class: 'lp-formular lp-testform' });
  let meldungText = '';
  const feld = (wert, ph, beiEingabe, zeilen) => {
    const f = zeilen ? h('textarea', { class: 'eingabe', rows: zeilen, placeholder: ph, spellcheck: 'false' }) : h('input', { class: 'eingabe', placeholder: ph });
    f.value = wert ?? '';
    f.addEventListener('input', () => beiEingabe(f.value));
    return f;
  };
  const wahl = (werte, aktuell, beiWahl) => { const s = h('select', { class: 'eingabe' }, werte.map(([w, n]) => h('option', { value: w }, n))); s.value = aktuell; s.addEventListener('change', () => beiWahl(s.value)); return s; };
  const zeile = (name, el) => h('label', { class: 'lp-feld' }, h('span', {}, name), el);
  const malen = () => {
    const teile = [
      h('div', { class: 'lp-formular-raster' },
        zeile('Name', feld(d.name, 'z. B. Rechner – Grundfälle', (v) => { d.name = v; })),
        zeile('Art', wahl(Object.entries(TESTARTEN).map(([k, v]) => [k, v[0]]), d.art, (v) => { d.art = v; malen(); }))),
      h('div', { class: 'lp-mini' }, TESTARTEN[d.art][1]),
    ];
    if (d.art !== 'daten') {
      teile.push(h('div', { class: 'lp-formular-raster' },
        zeile('Sprache', wahl(Object.entries(SPRACHEN).map(([k, v]) => [k, v[0]]), d.sprache || 'python', (v) => { d.sprache = v; })),
        zeile(d.art === 'unit' ? 'Testprogramm (Python: leer = alle test_*.py)' : 'Programm', wahl([['', d.art === 'unit' ? '— alle test_*.py —' : '— wählen —'], ...programme.map((x) => [x, x])], d.start, (v) => { d.start = v; if (SPRACHE_VON_ENDUNG[endung(v)]) d.sprache = SPRACHE_VON_ENDUNG[endung(v)]; malen(); }))));
    }
    if (d.art === 'szenario') {
      teile.push(h('div', { class: 'lp-label', style: { marginTop: '6px' } }, `Fälle · ${d.faelle.length}`));
      d.faelle.forEach((f, i) => teile.push(h('div', { class: 'lp-fall-form' },
        h('div', { class: 'zeile', style: { gap: '6px' } }, feld(f.name, 'Name des Falls', (v) => { f.name = v; }),
          wahl(Object.entries(VERGLEICHE), f.vergleich || 'enthaelt', (v) => { f.vergleich = v; }),
          h('button', { class: 'knopf symbol', title: 'Fall entfernen', onclick: () => { d.faelle.splice(i, 1); malen(); } }, ic('x', 14))),
        h('div', { class: 'lp-formular-raster' }, feld(f.eingabe, 'Eingabe (stdin)', (v) => { f.eingabe = v; }, 2), feld(f.erwartet, 'Erwartete Ausgabe', (v) => { f.erwartet = v; }, 2)))));
      teile.push(h('div', { class: 'zeile', style: { gap: '6px' } },
        h('button', { class: 'knopf rand klein', onclick: () => { d.faelle.push({ name: `Fall ${d.faelle.length + 1}`, eingabe: '', erwartet: '', vergleich: 'enthaelt' }); malen(); } }, ic('plus', 13), 'Fall'),
        h('button', { class: 'knopf tonal klein', onclick: async () => {
          meldungText = 'Launchpad schlägt Fälle vor …'; malen();
          try { const neu = await faelleVorschlagen(d.start, d.faelle); d.faelle.push(...neu); meldungText = neu.length ? `${neu.length} Fälle vorgeschlagen – prüf die erwarteten Ausgaben, bevor du speicherst.` : 'Keine Vorschläge bekommen.'; }
          catch (e) { meldungText = meldung(e); }
          malen();
        } }, ic('ki', 13), 'Fälle vorschlagen (KI)'),
        meldungText ? h('span', { class: 'lp-mini' }, meldungText) : null));
    }
    if (d.art === 'leistung') {
      teile.push(h('div', { class: 'lp-formular-raster' },
        zeile('Durchläufe (1–5)', feld(d.wiederholungen, '3', (v) => { d.wiederholungen = Math.max(1, Math.min(5, +v || 3)); })),
        zeile('Grenze Ø in ms', feld(d.grenzeMs, '1000', (v) => { d.grenzeMs = Math.max(1, +v || 1000); }))),
      zeile('Eingabe (optional)', feld(d.eingabe, 'stdin für jeden Durchlauf', (v) => { d.eingabe = v; }, 2)));
    }
    if (d.art === 'daten') {
      teile.push(h('div', { class: 'lp-formular-raster' },
        zeile('Datei', wahl([['', '— wählen —'], ...daten.map((x) => [x, x])], d.datei, (v) => { d.datei = v; malen(); })),
        zeile('Mindestens Zeilen', feld(d.minZeilen, '1', (v) => { d.minZeilen = Math.max(0, +v || 0); }))),
      h('div', { class: 'lp-formular-raster' },
        zeile('Pflichtspalten (mit Komma)', feld(d.spalten, d.datei && z.dateien[d.datei] ? csvParsen(z.dateien[d.datei], 1).kopf.slice(0, 4).join(', ') : 'datum, betrag', (v) => { d.spalten = v; })),
        zeile('Eindeutiger Schlüssel (Spalte)', feld(d.schluessel, 'z. B. id', (v) => { d.schluessel = v; }))),
      lyra.schalter({ wert: d.keineLeeren, text: 'Keine leeren Werte erlaubt', beiWahl: (w) => { d.keineLeeren = w; } }));
    }
    box.replaceChildren(...teile);
  };
  malen();
  const w = await lyra.dialog(alt ? 'Testraum bearbeiten' : 'Neuer Testraum', box, [{ text: 'Abbrechen', art: 'text', wert: null }, { text: 'Speichern', wert: () => d }]);
  if (!w) return;
  w.name = text(w.name) || `${TESTARTEN[w.art][0]} ${p.testraeume.length + 1}`;
  if (alt) Object.assign(alt, w);
  else p.testraeume.push({ ...w, id: neueId(), verlauf: [], letzte: null });
  protokollieren('nutzer', `${alt ? 'Testraum bearbeitet' : 'Testraum angelegt'}: ${w.name}`, '');
  await sichern();
  zeichnen();
}

async function testraumLoeschen(id) {
  const t = z.p.testraeume.find((x) => x.id === id);
  if (!t || !(await lyra.bestaetigen({ titel: 'Testraum löschen?', text: `„${t.name}“ und sein Verlauf werden gelöscht. Dateien bleiben.`, ja: 'Löschen', gefahr: true }))) return;
  z.p.testraeume = z.p.testraeume.filter((x) => x.id !== id);
  await sichern();
  zeichnen();
}

/** Bei einem Szenario: die tatsächliche Ausgabe als neue Erwartung übernehmen (dein Klick = deine Zustimmung). */
async function ausgabeUebernehmen(t, name) {
  const f = (t.faelle || []).find((x) => x.name === name);
  const d = t.letzte && t.letzte.details.find((x) => x.name === name);
  if (!f || !d) return;
  f.erwartet = d.erhalten;
  f.vergleich = 'gleich';
  protokollieren('nutzer', `Erwartung übernommen: ${t.name} – ${name}`, d.erhalten);
  await sichern();
  zeichnen();
}

// ================================================================== Versionen

function fingerabdruck(dateien) {
  let x = 5381;
  for (const k of Object.keys(dateien).sort()) {
    const t = k + ':' + dateien[k].length + ':' + dateien[k].slice(0, 200) + dateien[k].slice(-200);
    for (let i = 0; i < t.length; i++) x = ((x << 5) + x + t.charCodeAt(i)) | 0;
  }
  return String(x);
}

async function versionSichern(titel, { auto = false } = {}) {
  const p = z.p;
  if (!p || !Object.keys(z.dateien).length) return null;
  werkstattFelder(p);
  const fp = fingerabdruck(z.dateien);
  if (auto && p.versionen[0] && p.versionen[0].fp === fp) return null; // nichts geändert seit der letzten Version
  const id = lyra.neueId();
  try { await lyra.speicher.schreiben(`versionen/${p.id}/${id}`, z.dateien); } catch (e) { if (!auto) lyra.toast(meldung(e), 'fehler'); return null; }
  p.versionen = [{ id, zeit: lyra.jetzt(), titel: String(titel).slice(0, 120), anzahl: Object.keys(z.dateien).length, groesse: arbeitsbereichGroesse(), auto, fp }, ...p.versionen];
  for (const v of p.versionen.slice(12)) lyra.speicher.loeschen(`versionen/${p.id}/${v.id}`).catch(() => {});
  p.versionen = p.versionen.slice(0, 12);
  await sichern(p);
  return id;
}

async function versionLaden(id) {
  const d = await lyra.speicher.lesen(`versionen/${z.p.id}/${id}`);
  if (!d || typeof d !== 'object') throw new Error('Diese Version ist nicht mehr vorhanden.');
  return d;
}

async function versionWiederherstellen(id) {
  const v = z.p.versionen.find((x) => x.id === id);
  if (!v || z.laeuft) return;
  if (!(await lyra.bestaetigen({ titel: 'Version wiederherstellen?', text: `Der Arbeitsbereich wird auf „${v.titel}“ (${lyra.zeitText(v.zeit)}, ${v.anzahl} Dateien) zurückgesetzt. Der jetzige Stand wird vorher als eigene Version gesichert.`, ja: 'Wiederherstellen' }))) return;
  try {
    const d = await versionLaden(id);
    await versionSichern('Vor dem Wiederherstellen', { auto: true });
    z.dateien = d;
    stand++;
    await dateienSichern();
    protokollieren('nutzer', `Version wiederhergestellt: ${v.titel}`, `${Object.keys(d).length} Dateien`);
    z.vergleich = null;
    lyra.toast('Wiederhergestellt', 'ok');
  } catch (e) { lyra.toast(meldung(e), 'fehler'); }
  zeichnen();
}

async function versionLoeschen(id) {
  if (!(await lyra.bestaetigen({ titel: 'Version löschen?', text: 'Diese gesicherte Version wird gelöscht.', ja: 'Löschen', gefahr: true }))) return;
  lyra.speicher.loeschen(`versionen/${z.p.id}/${id}`).catch(() => {});
  z.p.versionen = z.p.versionen.filter((x) => x.id !== id);
  if (z.vergleich && z.vergleich.id === id) z.vergleich = null;
  await sichern();
  zeichnen();
}

async function vergleichOeffnen(id) {
  const v = z.p.versionen.find((x) => x.id === id);
  try { z.vergleich = { id, titel: v ? v.titel : '', dateien: await versionLaden(id), datei: null }; } catch (e) { lyra.toast(meldung(e), 'fehler'); }
  zeichnen();
}

/** Zeilen-Diff (längste gemeinsame Teilfolge) → [[art, text, altNr, neuNr]]; null, wenn zu groß. */
function diffZeilen(a, b) {
  const A = String(a || '').split('\n'), B = String(b || '').split('\n');
  const n = A.length, m = B.length;
  if (n * m > 4000000) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const aus = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { aus.push([' ', A[i], i + 1, j + 1]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { aus.push(['-', A[i], i + 1, null]); i++; }
    else { aus.push(['+', B[j], null, j + 1]); j++; }
  }
  while (i < n) { aus.push(['-', A[i], i + 1, null]); i++; }
  while (j < m) { aus.push(['+', B[j], null, j + 1]); j++; }
  return aus;
}

function diffAnsicht(alt, neu) {
  const d = diffZeilen(alt, neu);
  if (!d) return h('div', { class: 'lp-mini' }, 'Die Datei ist zu groß für einen Zeilenvergleich.');
  const plus = d.filter((x) => x[0] === '+').length, minus = d.filter((x) => x[0] === '-').length;
  if (!plus && !minus) return h('div', { class: 'lp-mini' }, 'Keine Unterschiede.');
  const zeigen = new Set();
  d.forEach((x, i) => { if (x[0] !== ' ') for (let k = Math.max(0, i - 3); k <= Math.min(d.length - 1, i + 3); k++) zeigen.add(k); });
  const zeilen = [];
  let luecke = 0;
  d.forEach((x, i) => {
    if (!zeigen.has(i)) { luecke++; return; }
    if (luecke) { zeilen.push(h('div', { class: 'lp-diff-luecke' }, `… ${luecke} unveränderte Zeilen`)); luecke = 0; }
    zeilen.push(h('div', { class: 'lp-diff-zeile ' + (x[0] === '+' ? 'plus' : x[0] === '-' ? 'minus' : '') },
      h('span', { class: 'lp-diff-nr' }, x[2] ?? ''), h('span', { class: 'lp-diff-nr' }, x[3] ?? ''), h('span', { class: 'lp-diff-zeichen' }, x[0]), h('span', { class: 'lp-diff-text' }, x[1])));
  });
  if (luecke) zeilen.push(h('div', { class: 'lp-diff-luecke' }, `… ${luecke} unveränderte Zeilen`));
  return h('div', {}, h('div', { class: 'lp-mini', style: { marginBottom: '6px' } }, h('span', { class: 'lp-gut' }, `+${plus}`), ' · ', h('span', { class: 'lp-schlecht' }, `−${minus}`), ' Zeilen (alt → jetzt)'), h('div', { class: 'lp-diff' }, zeilen));
}

// ================================================================== Analyse

function codeKennzahlen(pfad, t) {
  const e = endung(pfad);
  const zeilen = String(t).split('\n');
  const kommentar = e === 'py' || e === 'rb' ? /^\s*#/ : /^\s*(\/\/|\/\*|\*)/;
  let leer = 0, komm = 0, tiefe = 0, maxTiefe = 0;
  for (const z1 of zeilen) {
    if (!z1.trim()) { leer++; continue; }
    if (kommentar.test(z1)) { komm++; continue; }
    if (e === 'py' || e === 'rb') maxTiefe = Math.max(maxTiefe, Math.floor((z1.match(/^\s*/)[0].replace(/\t/g, '    ').length) / (e === 'rb' ? 2 : 4)));
    else { for (const c of z1) { if (c === '{') { tiefe++; maxTiefe = Math.max(maxTiefe, tiefe); } else if (c === '}') tiefe = Math.max(0, tiefe - 1); } }
  }
  const zaehle = (re) => (String(t).match(re) || []).length;
  const funktionen = e === 'py' ? zaehle(/^\s*(async\s+)?def\s+\w+/gm) : e === 'rb' ? zaehle(/^\s*def\s+/gm) : e === 'swift' ? zaehle(/\bfunc\s+\w+/g)
    : zaehle(/^\s*(?:(?:public|private|protected|static|final|inline|virtual|const|unsigned|signed)\s+)*[\w:<>*&[\]]+\s+\**\w+\s*\([^;{}]*\)\s*(?:const\s*)?\{/gm);
  return { pfad, sprache: SPRACHEN[SPRACHE_VON_ENDUNG[e]] ? SPRACHEN[SPRACHE_VON_ENDUNG[e]][0] : e, zeilen: zeilen.length, code: zeilen.length - leer - komm, kommentare: komm, funktionen, klassen: zaehle(/\b(class|struct)\s+\w+/g), todos: zaehle(/\b(TODO|FIXME|XXX)\b/g), tiefe: maxTiefe };
}

function pythonImporte() {
  const module = new Map(Object.keys(z.dateien).filter((x) => endung(x) === 'py').map((x) => [x.replace(/\.py$/, '').replace(/\//g, '.'), x]));
  const kanten = [];
  for (const [mod, pfad] of module) {
    const t = z.dateien[pfad];
    const re = /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w., ]+))/gm;
    let m;
    const ziele = new Set();
    while ((m = re.exec(t))) (m[1] ? [m[1]] : m[2].split(',').map((x) => x.trim().split(/\s+/)[0])).forEach((x) => { if (module.has(x) && x !== mod) ziele.add(x); });
    kanten.push([mod, [...ziele]]);
  }
  return kanten;
}

function datenprofil(pfad) {
  const { kopf, zeilen, anzahl } = csvParsen(z.dateien[pfad], 20000);
  const spalten = kopf.slice(0, 16).map((name, i) => {
    const werte = zeilen.map((r) => r[i] ?? '');
    const gefuellt = werte.filter((x) => x !== '');
    const zahlen = gefuellt.map((x) => Number(x.replace(',', '.'))).filter((x) => Number.isFinite(x));
    const typ = gefuellt.length && zahlen.length / gefuellt.length >= 0.9 ? 'Zahl' : gefuellt.length && gefuellt.filter((x) => /^\d{4}-\d{2}-\d{2}/.test(x)).length / gefuellt.length >= 0.9 ? 'Datum' : 'Text';
    const s = { name, typ, leer: werte.length - gefuellt.length, eindeutig: new Set(gefuellt).size };
    if (typ === 'Zahl' && zahlen.length) { s.min = Math.min(...zahlen); s.max = Math.max(...zahlen); s.mittel = zahlen.reduce((a, b) => a + b, 0) / zahlen.length; }
    if (typ === 'Datum') { const sortiert = gefuellt.slice().sort(); s.min = sortiert[0]; s.max = sortiert[sortiert.length - 1]; }
    return s;
  });
  return { anzahl, spalten, mehr: Math.max(0, kopf.length - 16), gekuerzt: anzahl > zeilen.length };
}

async function syntaxAllePruefen() {
  const py = Object.keys(z.dateien).filter((x) => endung(x) === 'py');
  if (!py.length || z.laeuft) return;
  z.laeuft = { art: 'syntax' };
  status('Prüft die Syntax aller Python-Dateien …');
  zeichnen();
  try {
    const pruefer = `import ast\nfor p in ${JSON.stringify(py)}:\n    try:\n        ast.parse(open(p, encoding='utf-8').read())\n        print('OK  ' + p)\n    except SyntaxError as e:\n        print(f'FEHLER  {p}:{e.lineno}: {e.msg}')\n`;
    const r = await sandbox({ sprache: 'python', start: 'lp_syntax_alle.py', extra: { 'lp_syntax_alle.py': pruefer }, sekunden: 30 });
    z.syntaxErgebnis = { zeit: lyra.jetzt(), zeilen: String(r.ausgabe || r.fehler || '').trim().split('\n').filter(Boolean) };
  } catch (e) { if (!abgebrochen(e)) z.fehler = meldung(e); }
  z.laeuft = null;
  zeichnen();
}

// ================================================================== Code-Review

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    funde: { type: 'array', items: { type: 'object', properties: { beschreibung: { type: 'string' }, datei: { type: 'string' }, schwere: { type: 'string', enum: Object.keys(SCHWERE) }, titel: { type: 'string' }, vorschlag: { type: 'string' }, zeile: { type: 'integer' } }, required: ['beschreibung', 'datei', 'schwere', 'titel', 'vorschlag', 'zeile'] } },
    zusammenfassung: { type: 'string' },
  },
  required: ['funde', 'zusammenfassung'],
};

async function reviewStarten() {
  const p = z.p;
  if (z.laeuft) return;
  const dateien = (z.reviewDatei ? [z.reviewDatei] : Object.keys(z.dateien).filter((x) => SPRACHE_VON_ENDUNG[endung(x)] || ['js', 'html', 'css', 'sql'].includes(endung(x))))
    .filter((x) => z.dateien[x] !== undefined).sort((a, b) => (/^test/.test(a.split('/').pop()) ? 1 : 0) - (/^test/.test(b.split('/').pop()) ? 1 : 0));
  if (!dateien.length) return lyra.toast('Es gibt noch keinen Code zum Prüfen.');
  let budget = gross() ? 45000 : 10000;
  const teile = [];
  for (const x of dateien) {
    const t = z.dateien[x];
    if (t.length > budget) { if (!teile.length) teile.push(`--- ${x} (gekürzt) ---\n${t.slice(0, budget).split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n')}`); continue; }
    teile.push(`--- ${x} ---\n${t.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n')}`);
    budget -= t.length;
  }
  z.laeuft = { art: 'review' };
  z.fehler = null;
  status('Launchpad liest den Code …');
  zeichnen();
  try {
    const tests = p.testraeume.filter((t) => t.letzte).map((t) => `${t.name}: ${t.letzte.ok ? 'grün' : 'rot'}`).join(', ');
    const r = await lyra.ki({
      lehrer: z.lehrer, system: MITARBEITER, schema: REVIEW_SCHEMA,
      prompt: `${projektKontext(p)}\n${tests ? `Testräume: ${tests}\n` : ''}\nCode (mit Zeilennummern):\n${teile.join('\n\n')}\n\n\
Mach ein gründliches Code-Review wie ein erfahrener Senior-Entwickler. Finde echte Probleme: Fehler und Randfälle, die \
falsche Ergebnisse oder Abstürze verursachen, unsichere Eingabeverarbeitung, fehlende Fehlerbehandlung, fehlende Tests für \
wichtige Fälle, unklare oder doppelte Logik, Leistung. Höchstens 10 Funde, die wichtigsten zuerst – je "datei", "zeile" \
(Zeilennummer oder 0), "schwere" (kritisch, hoch, mittel, niedrig), "titel" (kurz), "beschreibung" (was genau und warum) und \
"vorschlag" (konkrete Änderung). Erfinde keine Probleme; ist der Code gut, gib wenige oder keine Funde. "zusammenfassung": \
2–3 Sätze Gesamturteil.\n\nAntwort als JSON: {"funde": [{"beschreibung": "", "datei": "", "schwere": "mittel", "titel": "", "vorschlag": "", "zeile": 0}], "zusammenfassung": ""}`,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    const j = (r && r.json) || {};
    const funde = (j.funde || []).filter((f) => f && text(f.titel)).slice(0, 12).map((f) => ({
      id: neueId(), datei: z.dateien[text(f.datei)] !== undefined ? text(f.datei) : (pfadAus(f.datei) || text(f.datei)), zeile: Math.max(0, Math.round(Number(f.zeile) || 0)),
      schwere: SCHWERE[f.schwere] ? f.schwere : 'mittel', titel: text(f.titel).slice(0, 140), beschreibung: text(f.beschreibung), vorschlag: text(f.vorschlag), uebernommen: null,
    })).sort((a, b) => SCHWERE[b.schwere][1] - SCHWERE[a.schwere][1]);
    p.review = { zeit: lyra.jetzt(), umfang: z.reviewDatei || 'alle', dateien: dateien.length, zusammenfassung: text(j.zusammenfassung), funde };
    protokollieren('notiz', `Code-Review: ${funde.length} Funde`, funde.map((f) => `[${SCHWERE[f.schwere][0]}] ${f.datei}:${f.zeile} – ${f.titel}`).join('\n'));
    await sichern(p);
  } catch (e) { if (!abgebrochen(e)) z.fehler = meldung(e); }
  z.laeuft = null;
  zeichnen();
}

async function fundUebernehmen(id) {
  const p = z.p;
  const f = p.review && p.review.funde.find((x) => x.id === id);
  if (!f || f.uebernommen) return;
  const phase = p.abschnitte.find((s) => p.aufgaben.some((a) => a.abschnitt === s.id && a.status !== 'erledigt')) || p.abschnitte[p.abschnitte.length - 1];
  const a = aufgabeAus({
    titel: `Beheben: ${f.titel}`.slice(0, 140), art: 'code', sprache: SPRACHE_VON_ENDUNG[endung(f.datei)] || 'python', prioritaet: f.schwere === 'kritisch' || f.schwere === 'hoch' ? 'hoch' : f.schwere === 'mittel' ? 'mittel' : 'niedrig',
    beschreibung: `${f.datei}${f.zeile ? `, Zeile ${f.zeile}` : ''}: ${f.beschreibung}\nVorschlag: ${f.vorschlag}`, kriterien: ['Der Fund aus dem Code-Review ist behoben', 'Ein Test deckt den Fall ab', 'Alle Tests und Testräume sind grün'],
    abschnitt: p.abschnitte.indexOf(phase) + 1, minuten: 30,
  }, p.abschnitte);
  p.aufgaben.push(a);
  f.uebernommen = a.id;
  protokollieren('nutzer', `Review-Fund als Aufgabe übernommen: ${f.titel}`, '', { aufgabe: a.id });
  await sichern(p);
  lyra.toast('Als Aufgabe übernommen', 'ok');
  zeichnen();
}

// ================================================================== Spielwiese

async function spielAusfuehren() {
  if (z.laeuft) return;
  const s = z.spiel;
  const name = s.sprache === 'java' ? 'Spielwiese.java' : `spielwiese_lp.${SPRACHEN[s.sprache][1]}`;
  z.laeuft = { art: 'spiel' };
  status('Läuft in der Sandbox …');
  zeichnen();
  try {
    const r = await sandbox({ sprache: s.sprache, start: name, eingabe: s.eingabe, extra: { [name]: s.code }, sekunden: 40 });
    const neu = Object.keys(r.dateien || {}).filter((x) => x !== name);
    s.ergebnis = { r, neu: neu.map((x) => [x, r.dateien[x]]), zeit: lyra.jetzt() };
    protokollieren('code', `Spielwiese (${SPRACHEN[s.sprache][0]}): ${r.ok ? 'OK' : 'Fehler'}`, codeZusammenfassung(r, []), { ok: !!r.ok });
  } catch (e) { if (!abgebrochen(e)) z.fehler = meldung(e); }
  z.laeuft = null;
  zeichnen();
}

async function spielDateienUebernehmen() {
  const e = z.spiel.ergebnis;
  if (!e || !e.neu.length) return;
  try { for (const [pfad, inhalt] of e.neu) dateiSetzen(pfad, inhalt); } catch (err) { return lyra.toast(meldung(err), 'fehler'); }
  await dateienSichern();
  protokollieren('nutzer', `Aus der Spielwiese übernommen: ${e.neu.map(([x]) => x).join(', ')}`, '');
  lyra.toast(`${e.neu.length} Datei${e.neu.length === 1 ? '' : 'en'} übernommen`, 'ok');
  e.neu = [];
  zeichnen();
}

async function spielAlsDatei() {
  const s = z.spiel;
  const f = h('input', { class: 'eingabe', placeholder: `z. B. werkzeuge/test.${SPRACHEN[s.sprache][1]}` });
  const w = await lyra.dialog('Als Datei sichern', h('div', { style: { minWidth: '340px' } }, f), [{ text: 'Abbrechen', art: 'text', wert: null }, { text: 'Sichern', wert: () => f.value }]);
  const pfad = pfadSauber(w);
  if (!w) return;
  if (!pfad) return lyra.toast('Ungültiger Dateiname', 'fehler');
  if (z.dateien[pfad] !== undefined && !(await lyra.bestaetigen({ titel: 'Datei ersetzen?', text: `„${pfad}“ gibt es schon.`, ja: 'Ersetzen' }))) return;
  try { dateiSetzen(pfad, s.code); } catch (e) { return lyra.toast(meldung(e), 'fehler'); }
  await dateienSichern();
  protokollieren('nutzer', `Spielwiese gesichert als ${pfad}`, '');
  lyra.toast('Gesichert', 'ok');
  zeichnen();
}

// ================================================================== Ansichten

function sparkline(verlauf) {
  return h('div', { class: 'lp-spark', title: 'Verlauf der letzten Läufe' }, (verlauf || []).slice(-16).map((v) => h('span', { class: v.ok ? 'gut' : 'schlecht', title: `${lyra.zeitText(v.zeit)}: ${v.bestanden}/${v.gesamt}` })));
}

function testsReiter(p) {
  const liste = p.testraeume;
  const gruen = liste.filter((t) => t.letzte && t.letzte.ok).length;
  const laeuft = z.laeuft && z.laeuft.art === 'tests';
  return h('div', {},
    h('div', { class: 'lp-werkzeuge' },
      h('button', { class: 'knopf klein', disabled: !!z.laeuft, onclick: () => testraumDialog(null) }, ic('plus', 14), 'Testraum'),
      h('button', { class: 'knopf rand klein', disabled: !!z.laeuft || !liste.length, onclick: () => testsLaufenLassen(null) }, ic('play', 13), 'Alle ausführen'),
      h('span', { class: 'wachsen' }),
      liste.length ? h('span', { class: 'lp-mini' }, `${gruen} von ${liste.length} grün · laufen auch vor jeder Abnahme`) : null),
    laeuft ? h('div', { style: { marginBottom: '12px' } }, lyra.arbeit(z.status, { abbrechen: false })) : null,
    !liste.length ? h('div', { class: 'lp-karte lp-leer-gross' }, ic('labor', 28), h('div', { class: 'fett' }, 'Noch keine Testräume'),
      h('div', { class: 'lp-mini', style: { maxWidth: '520px' } }, 'Ein Testraum prüft dein Projekt immer wieder gleich: Unit-Tests, Szenarien (Eingabe → erwartete Ausgabe), Leistung oder Datenqualität. Launchpad führt alle Testräume vor jeder Abnahme aus und kann sie während der Arbeit selbst starten.'),
      h('div', { class: 'zeile', style: { gap: '8px', marginTop: '10px', justifyContent: 'center', flexWrap: 'wrap' } }, Object.entries(TESTARTEN).map(([k, v]) =>
        h('button', { class: 'knopf rand klein', onclick: async () => { await testraumDialogMitArt(k); } }, ic(v[2], 13), v[0]))))
      : h('div', { class: 'lp-testraeume' }, liste.map((t) => testraumKarte(t))));
}

async function testraumDialogMitArt(art) {
  // Leerer Testraum mit vorgewählter Art: kurz anlegen, dann bearbeiten
  const p = z.p;
  const t = { id: neueId(), name: `${TESTARTEN[art][0]} ${p.testraeume.length + 1}`, art, sprache: 'python', start: '', faelle: [], wiederholungen: 3, grenzeMs: 1000, eingabe: '', datei: Object.keys(z.dateien).find((x) => endung(x) === 'csv') || '', minZeilen: 1, spalten: '', keineLeeren: true, schluessel: '', verlauf: [], letzte: null };
  p.testraeume.push(t);
  const vorher = p.testraeume.length;
  await testraumDialog(t.id);
  // Abgebrochen und noch nie gespeichert: wieder weg
  if (p.testraeume.length === vorher && !t.verlauf.length && t.name === `${TESTARTEN[art][0]} ${vorher}` && !t.start && !t.faelle.length && art !== 'unit' && art !== 'daten') p.testraeume = p.testraeume.filter((x) => x.id !== t.id);
  await sichern(p);
  zeichnen();
}

function testraumKarte(t) {
  const e = t.letzte;
  const offen = z.testOffen === t.id;
  return h('div', { class: 'lp-testraum ' + (e ? (e.ok ? 'gut' : 'schlecht') : '') },
    h('div', { class: 'lp-test-kopf', onclick: () => { z.testOffen = offen ? null : t.id; zeichnen(); } },
      h('span', { class: 'lp-test-status' }, ic(e ? (e.ok ? 'check' : 'x') : TESTARTEN[t.art][2], 15)),
      h('div', { class: 'wachsen' },
        h('div', { class: 'fett' }, t.name),
        h('div', { class: 'lp-mini' }, [TESTARTEN[t.art][0], t.art === 'daten' ? t.datei : t.start || (t.art === 'unit' ? 'alle test_*.py' : ''), t.art === 'szenario' ? `${(t.faelle || []).length} Fälle` : '', testStatusText(e)].filter(Boolean).join(' · '))),
      sparkline(t.verlauf),
      h('button', { class: 'knopf tonal klein', disabled: !!z.laeuft, onclick: (ev) => { ev.stopPropagation(); testsLaufenLassen(t); } }, ic('play', 13), 'Ausführen'),
      h('button', { class: 'knopf symbol', title: 'Bearbeiten', disabled: !!z.laeuft, onclick: (ev) => { ev.stopPropagation(); testraumDialog(t.id); } }, ic('stift', 14)),
      h('button', { class: 'knopf symbol', title: 'Löschen', disabled: !!z.laeuft, onclick: (ev) => { ev.stopPropagation(); testraumLoeschen(t.id); } }, ic('muell', 14))),
    offen && e ? h('div', { class: 'lp-test-details' },
      e.details.map((d) => h('div', { class: 'lp-fall ' + (d.ok ? 'gut' : 'schlecht') },
        h('div', { class: 'zeile', style: { gap: '8px' } }, h('span', { class: d.ok ? 'lp-gut' : 'lp-schlecht' }, ic(d.ok ? 'check' : 'x', 13)), h('span', { class: 'fett wachsen' }, d.name), d.info ? h('span', { class: 'lp-mini' }, d.info) : null,
          t.art === 'szenario' && !d.ok && d.erhalten !== undefined && !d.fehler ? h('button', { class: 'knopf text klein', onclick: () => ausgabeUebernehmen(t, d.name) }, 'Ausgabe als erwartet übernehmen') : null),
        d.erwartet !== undefined && !d.ok ? h('div', { class: 'lp-fall-vergleich' },
          h('div', {}, h('div', { class: 'lp-label' }, `Erwartet (${VERGLEICHE[d.vergleich] || ''})`), h('pre', { class: 'lp-terminal klein' }, d.erwartet || '(leer)')),
          h('div', {}, h('div', { class: 'lp-label' }, 'Erhalten'), h('pre', { class: 'lp-terminal klein' + (d.fehler ? ' fehler' : '') }, d.fehler || d.erhalten || '(keine Ausgabe)'))) : null)),
      e.ausgabe ? h('details', { class: 'lp-test-ausgabe' }, h('summary', { class: 'lp-label' }, 'Komplette Ausgabe'), h('pre', { class: 'lp-terminal' }, e.ausgabe)) : null)
      : offen ? h('div', { class: 'lp-test-details lp-mini' }, 'Noch nicht ausgeführt.') : null);
}

function werkstattReiter(p) {
  return h('div', {},
    h('div', { class: 'lp-unterreiter' }, WERKSTATT.map(([k, n, i]) => h('button', { class: z.werkstatt === k ? 'an' : '', onclick: () => { z.werkstatt = k; zeichnen(); } }, ic(i, 14), n,
      k === 'versionen' && p.versionen.length ? h('span', { class: 'lp-reiter-zahl' }, String(p.versionen.length)) : null,
      k === 'review' && p.review && p.review.funde.length ? h('span', { class: 'lp-reiter-zahl' }, String(p.review.funde.filter((f) => !f.uebernommen).length)) : null))),
    z.fehler ? h('div', { style: { marginBottom: '12px' } }, lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); })) : null,
    z.werkstatt === 'analyse' ? analyseAnsicht(p) : z.werkstatt === 'review' ? reviewAnsicht(p) : z.werkstatt === 'versionen' ? versionenAnsicht(p) : spielwieseAnsicht());
}

function spielwieseAnsicht() {
  const s = z.spiel;
  const e = s.ergebnis;
  const editor = h('textarea', { class: 'lp-editor lp-spiel-editor', 'data-feld': 'spiel', spellcheck: 'false' });
  editor.value = s.code;
  editor.addEventListener('input', () => { s.code = editor.value; });
  editor.addEventListener('keydown', (ev) => {
    if (ev.key === 'Tab') { ev.preventDefault(); const a = editor.selectionStart; editor.setRangeText('    ', a, editor.selectionEnd, 'end'); s.code = editor.value; }
    if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') { ev.preventDefault(); spielAusfuehren(); }
  });
  const eingabe = h('textarea', { class: 'eingabe lp-mono', rows: 3, 'data-feld': 'spiel-eingabe', placeholder: 'Standardeingabe (optional)' });
  eingabe.value = s.eingabe;
  eingabe.addEventListener('input', () => { s.eingabe = eingabe.value; });
  return h('div', { class: 'lp-spiel' },
    h('div', { class: 'lp-karte' },
      h('div', { class: 'lp-karte-kopf' },
        h('h3', { class: 'wachsen' }, 'Spielwiese'),
        lyra.auswahl({ titel: 'Sprache', optionen: Object.entries(SPRACHEN).map(([k, v]) => [k, v[0]]), wert: s.sprache, beiWahl: (w) => { s.sprache = w; zeichnen(); } }),
        h('button', { class: 'knopf rand klein', onclick: spielAlsDatei }, ic('sichern', 13), 'Als Datei'),
        h('button', { class: 'knopf klein', disabled: !!z.laeuft, onclick: spielAusfuehren }, ic('play', 13), 'Ausführen')),
      h('div', { class: 'lp-mini', style: { marginBottom: '8px' } }, 'Probier Code aus, ohne den Arbeitsbereich zu verändern: Alle Projektdateien liegen im Arbeitsordner (z. B. import deines Moduls oder eine CSV einlesen). Dateien, die dabei entstehen, übernimmst du nur auf Wunsch. ⌘↩ führt aus.'),
      editor,
      h('div', { style: { marginTop: '8px' } }, eingabe)),
    z.laeuft && z.laeuft.art === 'spiel' ? h('div', { style: { marginTop: '12px' } }, lyra.arbeit(z.status, { abbrechen: false })) : null,
    e ? h('div', { class: 'lp-karte', style: { marginTop: '12px' } },
      h('div', { class: 'lp-karte-kopf' }, h('span', { class: (e.r.ok ? 'lp-gut' : 'lp-schlecht') + ' fett wachsen' }, e.r.zeitUm ? 'Zeitlimit' : e.r.ok ? `OK · ${e.r.dauerMs} ms` : `Fehler (Code ${e.r.code})${e.r.schritt === 'uebersetzen' ? ' beim Übersetzen' : ''}`), h('span', { class: 'lp-mini' }, lyra.zeitText(e.zeit))),
      h('pre', { class: 'lp-terminal' + (e.r.ok ? '' : ' fehler') }, [e.r.ausgabe, tracebackSaeubern(e.r.fehler || '')].filter((x) => text(x)).join('\n') || '(keine Ausgabe)'),
      e.neu.length ? h('div', { class: 'zeile', style: { marginTop: '8px', gap: '8px' } }, h('span', { class: 'lp-mini wachsen' }, `Neu entstanden: ${e.neu.map(([x]) => x).join(', ')}`), h('button', { class: 'knopf tonal klein', onclick: spielDateienUebernehmen }, 'In den Arbeitsbereich übernehmen')) : null) : null);
}

function analyseAnsicht(p) {
  const code = Object.keys(z.dateien).filter((x) => SPRACHE_VON_ENDUNG[endung(x)]).sort().map((x) => codeKennzahlen(x, z.dateien[x]));
  const summe = (k) => code.reduce((s, x) => s + x[k], 0);
  const daten = Object.keys(z.dateien).filter((x) => ['csv', 'tsv'].includes(endung(x))).sort();
  const importe = pythonImporte().filter(([, z1]) => z1.length);
  const testdateien = Object.keys(z.dateien).filter((x) => /^test/.test(x.split('/').pop()) && SPRACHE_VON_ENDUNG[endung(x)]);
  const testZeilen = testdateien.reduce((s, x) => s + zeilenZahl(z.dateien[x]), 0);
  const kpi1 = (wert, name) => h('div', { class: 'lp-kpi' }, h('div', { class: 'lp-kpi-wert' }, wert), h('div', { class: 'lp-kpi-name' }, name));
  return h('div', {},
    h('div', { class: 'lp-kpis', style: { marginBottom: '14px' } },
      kpi1(summe('code').toLocaleString('de-DE'), 'Codezeilen'), kpi1(String(summe('funktionen')), 'Funktionen'),
      kpi1(summe('code') ? `${Math.round((testZeilen / Math.max(1, summe('zeilen'))) * 100)} %` : '–', 'Anteil Testcode'), kpi1(String(summe('todos')), 'TODO/FIXME')),
    h('section', { class: 'lp-karte', style: { marginBottom: '14px' } },
      h('div', { class: 'lp-karte-kopf' }, ic('code', 15), h('h3', { class: 'wachsen' }, 'Code'),
        Object.keys(z.dateien).some((x) => endung(x) === 'py') ? h('button', { class: 'knopf rand klein', disabled: !!z.laeuft, onclick: syntaxAllePruefen }, 'Python-Syntax prüfen') : null),
      z.syntaxErgebnis ? h('div', { class: 'lp-syntax' }, z.syntaxErgebnis.zeilen.map((l) => h('div', { class: l.startsWith('OK') ? 'lp-gut' : 'lp-schlecht' }, l))) : null,
      code.length ? h('table', { class: 'lp-tabelle klein' },
        h('thead', {}, h('tr', {}, ['Datei', 'Sprache', 'Zeilen', 'Code', 'Kommentare', 'Funktionen', 'Klassen', 'Tiefe', 'TODO'].map((x) => h('th', {}, x)))),
        h('tbody', {}, code.map((c) => h('tr', { onclick: () => { z.reiter = 'dateien'; z.datei = c.pfad; zeichnen(); }, style: { cursor: 'pointer' } },
          h('td', { class: 'lp-mono' }, c.pfad), h('td', {}, c.sprache), h('td', {}, String(c.zeilen)), h('td', {}, String(c.code)), h('td', {}, String(c.kommentare)), h('td', {}, String(c.funktionen)), h('td', {}, String(c.klassen)),
          h('td', { class: c.tiefe >= 5 ? 'lp-schlecht' : '' }, String(c.tiefe)), h('td', { class: c.todos ? 'lp-schlecht' : '' }, String(c.todos))))))
        : h('div', { class: 'lp-mini' }, 'Noch kein Code im Arbeitsbereich.'),
      code.length ? h('div', { class: 'lp-mini', style: { marginTop: '8px' } }, 'Tiefe = größte Verschachtelung (ab 5 schwer lesbar). Ein Klick öffnet die Datei.') : null),
    importe.length ? h('section', { class: 'lp-karte', style: { marginBottom: '14px' } },
      h('div', { class: 'lp-karte-kopf' }, ic('version', 15), h('h3', {}, 'Abhängigkeiten (Python)')),
      importe.map(([m, ziele]) => h('div', { class: 'lp-import' }, h('span', { class: 'lp-mono fett' }, m), h('span', { class: 'lp-mini' }, ' → '), ziele.map((x) => h('span', { class: 'lp-import-ziel lp-mono' }, x))))) : null,
    h('section', { class: 'lp-karte' },
      h('div', { class: 'lp-karte-kopf' }, ic('datei', 15), h('h3', {}, 'Datenprofil')),
      daten.length ? daten.map((pfad) => {
        const d = datenprofil(pfad);
        return h('div', { class: 'lp-profil' },
          h('div', { class: 'zeile', style: { marginBottom: '6px' } }, h('span', { class: 'lp-mono fett wachsen' }, pfad), h('span', { class: 'lp-mini' }, `${d.anzahl.toLocaleString('de-DE')} Zeilen · ${d.spalten.length + d.mehr} Spalten${d.gekuerzt ? ' · Profil aus den ersten 20.000 Zeilen' : ''}`)),
          h('table', { class: 'lp-tabelle klein' }, h('thead', {}, h('tr', {}, ['Spalte', 'Typ', 'Leer', 'Eindeutig', 'Min', 'Max', 'Mittel'].map((x) => h('th', {}, x)))),
            h('tbody', {}, d.spalten.map((s) => h('tr', {}, h('td', { class: 'fett' }, s.name), h('td', {}, s.typ), h('td', { class: s.leer ? 'lp-schlecht' : '' }, String(s.leer)), h('td', {}, String(s.eindeutig)),
              h('td', {}, s.min === undefined ? '–' : typeof s.min === 'number' ? s.min.toLocaleString('de-DE') : s.min), h('td', {}, s.max === undefined ? '–' : typeof s.max === 'number' ? s.max.toLocaleString('de-DE') : s.max),
              h('td', {}, s.mittel === undefined ? '–' : s.mittel.toLocaleString('de-DE', { maximumFractionDigits: 2 })))))));
      }) : h('div', { class: 'lp-mini' }, 'Keine CSV-Dateien im Arbeitsbereich.')));
}

function reviewAnsicht(p) {
  const r = p.review;
  const code = Object.keys(z.dateien).filter((x) => SPRACHE_VON_ENDUNG[endung(x)] || ['js', 'html', 'css', 'sql'].includes(endung(x))).sort();
  return h('div', {},
    h('div', { class: 'lp-werkzeuge' },
      lyra.auswahl({ titel: 'Umfang', optionen: [['', 'Alle Code-Dateien'], ...code.map((x) => [x, x])], wert: z.reviewDatei, beiWahl: (w) => { z.reviewDatei = w; zeichnen(); } }),
      h('button', { class: 'knopf klein', disabled: !!z.laeuft || !code.length, onclick: reviewStarten }, ic('review', 14), r ? 'Neues Review' : 'Review starten'),
      h('span', { class: 'wachsen' }),
      r ? h('span', { class: 'lp-mini' }, `${lyra.zeitText(r.zeit)} · ${r.dateien} Datei${r.dateien === 1 ? '' : 'en'} geprüft`) : null),
    z.laeuft && z.laeuft.art === 'review' ? h('div', { style: { marginBottom: '12px' } }, lyra.arbeit(z.status)) : null,
    !r ? h('div', { class: 'lp-karte lp-leer-gross' }, ic('review', 28), h('div', { class: 'fett' }, 'Code-Review wie von einem Senior-Entwickler'),
      h('div', { class: 'lp-mini', style: { maxWidth: '480px' } }, 'Launchpad liest den Code und findet Fehler, Randfälle, fehlende Tests und unklare Stellen – mit Datei, Zeile und konkretem Vorschlag. Was du davon umsetzen willst, übernimmst du einzeln als Aufgabe.'))
      : h('div', {},
        r.zusammenfassung ? h('div', { class: 'lp-karte', style: { marginBottom: '12px' } }, h('div', { class: 'lp-label' }, 'Gesamturteil'), lyra.mdElement(r.zusammenfassung)) : null,
        !r.funde.length ? h('div', { class: 'lp-karte lp-mini' }, 'Keine Funde – der Code macht einen soliden Eindruck.') : null,
        r.funde.map((f) => h('div', { class: 'lp-fund lp-fund-' + f.schwere },
          h('div', { class: 'zeile', style: { gap: '8px' } },
            h('span', { class: 'lp-schwere lp-schwere-' + f.schwere }, SCHWERE[f.schwere][0]),
            h('span', { class: 'fett wachsen' }, f.titel),
            z.dateien[f.datei] !== undefined ? h('button', { class: 'lp-dateichip', onclick: () => { z.reiter = 'dateien'; z.datei = f.datei; zeichnen(); } }, ic('code', 12), `${f.datei}${f.zeile ? ':' + f.zeile : ''}`) : h('span', { class: 'lp-mini lp-mono' }, f.datei),
            f.uebernommen ? h('span', { class: 'lp-gut lp-mini' }, ic('check', 12), 'Aufgabe angelegt')
              : h('button', { class: 'knopf tonal klein', onclick: () => fundUebernehmen(f.id) }, ic('plus', 13), 'Als Aufgabe')),
          h('div', { class: 'lp-text', style: { marginTop: '6px' } }, f.beschreibung),
          f.vorschlag ? h('div', { class: 'lp-vorschlag' }, h('span', { class: 'lp-label' }, 'Vorschlag'), lyra.mdElement(f.vorschlag)) : null))));
}

function versionenAnsicht(p) {
  const v = z.vergleich;
  let vergleich = null;
  if (v) {
    const alle = [...new Set([...Object.keys(v.dateien), ...Object.keys(z.dateien)])].sort();
    const zustandVon = (x) => (v.dateien[x] === undefined ? 'neu' : z.dateien[x] === undefined ? 'geloescht' : v.dateien[x] === z.dateien[x] ? 'gleich' : 'geaendert');
    const geaendert = alle.filter((x) => zustandVon(x) !== 'gleich');
    vergleich = h('section', { class: 'lp-karte', style: { marginTop: '14px' } },
      h('div', { class: 'lp-karte-kopf' }, ic('version', 15), h('h3', { class: 'wachsen' }, `Vergleich: „${v.titel}“ → jetzt`), h('button', { class: 'knopf symbol', onclick: () => { z.vergleich = null; zeichnen(); } }, ic('x', 14))),
      !geaendert.length ? h('div', { class: 'lp-mini' }, 'Seitdem hat sich nichts geändert.') : h('div', { class: 'lp-vergleich' },
        h('div', { class: 'lp-vergleich-liste' }, geaendert.map((x) => h('button', { class: 'lp-vergleich-datei' + (v.datei === x ? ' an' : ''), onclick: () => { v.datei = x; zeichnen(); } },
          h('span', { class: 'lp-vz lp-vz-' + zustandVon(x) }, { neu: 'neu', geloescht: 'gelöscht', geaendert: 'geändert' }[zustandVon(x)]), h('span', { class: 'lp-mono eine-zeile' }, x)))),
        h('div', { class: 'lp-vergleich-inhalt' }, v.datei ? diffAnsicht(v.dateien[v.datei] || '', z.dateien[v.datei] || '') : h('div', { class: 'lp-mini' }, 'Wähle eine Datei.'))));
  }
  return h('div', {},
    h('div', { class: 'lp-werkzeuge' },
      h('button', { class: 'knopf klein', disabled: !!z.laeuft || !Object.keys(z.dateien).length, onclick: async () => {
        const f = h('input', { class: 'eingabe', placeholder: 'z. B. Vor dem Umbau des Parsers' });
        const w = await lyra.dialog('Stand sichern', h('div', { style: { minWidth: '340px' } }, f), [{ text: 'Abbrechen', art: 'text', wert: null }, { text: 'Sichern', wert: () => f.value || 'Manuell gesichert' }]);
        if (w) { await versionSichern(w); protokollieren('nutzer', `Version gesichert: ${w}`, ''); zeichnen(); }
      } }, ic('sichern', 14), 'Stand sichern'),
      h('span', { class: 'wachsen' }),
      h('span', { class: 'lp-mini' }, 'Vor jedem Lauf des Mitarbeiters wird automatisch gesichert · die letzten 12 Versionen bleiben')),
    !p.versionen.length ? h('div', { class: 'lp-karte lp-leer-gross' }, ic('version', 28), h('div', { class: 'fett' }, 'Noch keine Versionen'), h('div', { class: 'lp-mini' }, 'Sobald Launchpad eine Aufgabe bearbeitet, wird der Stand davor hier gesichert – du kannst jederzeit vergleichen und zurück.'))
      : h('div', { class: 'lp-karte' }, p.versionen.map((x) => h('div', { class: 'lp-version' + (v && v.id === x.id ? ' an' : '') },
        h('span', { class: 'lp-version-punkt' + (x.auto ? ' auto' : '') }),
        h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, x.titel), h('div', { class: 'lp-mini' }, `${lyra.zeitText(x.zeit)} · ${x.anzahl} Dateien · ${groesse(x.groesse || 0)}${x.auto ? ' · automatisch' : ''}`)),
        h('button', { class: 'knopf text klein', onclick: () => vergleichOeffnen(x.id) }, 'Vergleichen'),
        h('button', { class: 'knopf rand klein', disabled: !!z.laeuft, onclick: () => versionWiederherstellen(x.id) }, 'Wiederherstellen'),
        h('button', { class: 'knopf symbol', title: 'Löschen', onclick: () => versionLoeschen(x.id) }, ic('muell', 14))))),
    vergleich);
}
