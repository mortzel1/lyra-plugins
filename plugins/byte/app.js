'use strict';
/*
 * Byte – Programmieraufgaben mit Tests, ausgeführt auf deinem Mac in Lyras Code-Sandkasten (Recht „code“: kein Internet,
 * kein Zugriff auf deine Dateien, Zeitlimit). Die KI stellt Aufgaben samt versteckten Tests; Byte prüft die Tests vorher
 * an der eigenen Musterlösung – was dort nicht besteht, fliegt raus. Hinweise ohne Lösung, Musterlösung nur auf Wunsch.
 */
const { h, mdElement } = lyra;

const STANDARD = { sprache: 'python', niveau: 'mittel', ki: 'auto' };
const SPRACHEN = { python: { name: 'Python', datei: 'loesung.py', endung: 'py' }, java: { name: 'Java', datei: 'Loesung.java', endung: 'java' } };
const MARKE = '@@ERGEBNIS@@';

const SYSTEM = `Du bist „Byte“ in Lyra: ein Tutor für Programmieren an der Hochschule. Du stellst klare, lösbare Aufgaben \
mit sauberen Tests und erklärst Fehler verständlich – ohne die Lösung vorwegzunehmen.`;
const SCHEMA = {
  type: 'object',
  properties: {
    aufgabe: { type: 'string' },
    loesung: { type: 'string' },
    tests: { type: 'array', items: { type: 'object', properties: { code: { type: 'string' }, name: { type: 'string' } }, required: ['code', 'name'] } },
    titel: { type: 'string' },
    vorlage: { type: 'string' },
  },
  required: ['aufgabe', 'loesung', 'tests', 'titel', 'vorlage'],
};

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  sprachen: [],
  aufgaben: [],
  a: null, // {id, sprache, titel, aufgabe, vorlage, code, tests, loesung, geloest, hinweise: [], zeit}
  spielwiese: null, // {sprache, code}
  thema: '',
  themen: [],
  eingabe: '',
  ausgabe: null, // {art: 'lauf'|'tests', ...}
  laeuft: false,
  status: '',
  fehler: null,
  zeigeLoesung: false,
};
const app = document.getElementById('app');

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { z.sprachen = await lyra.codeSprachen(); } catch (_) {}
  try { z.aufgaben = (await lyra.speicher.liste('aufgaben')).map((e) => e.wert).filter((a) => a && a.id).sort((a, b) => b.zeit - a.zeit); } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.a || z.spielwiese) { z.a = null; z.spielwiese = null; z.ausgabe = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  zeichnen();
  lyra.themen().then((t) => { z.themen = t || []; if (!z.a) zeichnen(); }).catch(() => {});
}

const vorhanden = (s) => (z.sprachen.find((x) => x.name === s) || {}).vorhanden;
function status(t) { z.status = t; const el = document.getElementById('status'); if (el) el.textContent = t; }

async function sichern() {
  if (!z.a) return;
  z.a.zeit = lyra.jetzt();
  try { await lyra.speicher.schreiben('aufgaben/' + z.a.id, z.a); } catch (_) {}
  z.aufgaben = [z.a, ...z.aufgaben.filter((x) => x.id !== z.a.id)];
}

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

// ================================================================== Tests ausführen

function testDateien(sprache, code, tests) {
  if (sprache === 'python') {
    const runner = `import json, sys, io, contextlib
ergebnisse = []
TESTS = json.loads(${JSON.stringify(JSON.stringify(tests.map((t) => ({ name: t.name, code: t.code }))))})
try:
    with contextlib.redirect_stdout(io.StringIO()):
        import loesung
    umgebung = {k: getattr(loesung, k) for k in dir(loesung) if not k.startswith('__')}
except Exception as e:
    print(${JSON.stringify(MARKE)} + json.dumps([{"name": "Dein Code lässt sich laden", "ok": False, "fehler": type(e).__name__ + ": " + str(e)}]))
    sys.exit(0)
for t in TESTS:
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            exec(t["code"], dict(umgebung))
        ergebnisse.append({"name": t["name"], "ok": True})
    except AssertionError as e:
        ergebnisse.append({"name": t["name"], "ok": False, "fehler": str(e) or "Erwartung nicht erfüllt"})
    except Exception as e:
        ergebnisse.append({"name": t["name"], "ok": False, "fehler": type(e).__name__ + ": " + str(e)})
print(${JSON.stringify(MARKE)} + json.dumps(ergebnisse, ensure_ascii=False))
`;
    return { dateien: { 'loesung.py': code, 'tests_byte.py': runner }, start: 'tests_byte.py' };
  }
  const javaStr = (s) => JSON.stringify(String(s)).split(String.fromCharCode(0x2028)).join(' ').split(String.fromCharCode(0x2029)).join(' ');
  const runner = `import java.util.*;
public class TestsByte {
  static void erwarte(boolean b, String m) { if (!b) throw new AssertionError(m); }
  static String esc(String s) { return s == null ? "" : s.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"").replace("\\n", " "); }
  interface T { void lauf() throws Exception; }
  public static void main(String[] args) {
    String[] namen = { ${tests.map((t) => javaStr(t.name)).join(', ')} };
    T[] tests = {
${tests.map((t) => `      () -> { ${t.code} }`).join(',\n')}
    };
    List<String> aus = new ArrayList<>();
    java.io.PrintStream echt = System.out;
    for (int i = 0; i < tests.length; i++) {
      System.setOut(new java.io.PrintStream(new java.io.ByteArrayOutputStream()));
      try { tests[i].lauf(); aus.add("{\\"name\\":\\"" + esc(namen[i]) + "\\",\\"ok\\":true}"); }
      catch (Throwable e) { aus.add("{\\"name\\":\\"" + esc(namen[i]) + "\\",\\"ok\\":false,\\"fehler\\":\\"" + esc(e.getClass().getSimpleName() + (e.getMessage() != null ? ": " + e.getMessage() : "")) + "\\"}"); }
      finally { System.setOut(echt); }
    }
    System.out.println(${javaStr(MARKE)} + "[" + String.join(",", aus) + "]");
  }
}
`;
  return { dateien: { 'Loesung.java': code, 'TestsByte.java': runner }, start: 'TestsByte' };
}

/** Python: Erwartungswerte fehlgeschlagener `assert ausdruck == wert` aus der Musterlösung neu berechnen (die KI verrechnet
 *  sich bei Erwartungen öfter als in der Lösung). → neue Testcodes (oder null, wo es nicht geht). */
async function testsReparieren(code, tests) {
  const runner = `import json, io, re, contextlib
TESTS = json.loads(${JSON.stringify(JSON.stringify(tests.map((t) => t.code)))})
with contextlib.redirect_stdout(io.StringIO()):
    import loesung
umgebung = {k: getattr(loesung, k) for k in dir(loesung) if not k.startswith('__')}
aus = []
for c in TESTS:
    m = re.match(r'^assert\\s+(.+?)\\s*==\\s*(.+?)(\\s*,\\s*(.+))?$', c.strip(), re.S)
    if not m:
        aus.append(None)
        continue
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            wert = eval(m.group(1), dict(umgebung))
        aus.append("assert " + m.group(1) + " == " + repr(wert) + ", " + repr(m.group(1) + " soll " + repr(wert) + " sein"))
    except Exception:
        aus.append(None)
print(${JSON.stringify(MARKE)} + json.dumps(aus, ensure_ascii=False))
`;
  const r = await lyra.code({ sprache: 'python', dateien: { 'loesung.py': code, 'reparieren_byte.py': runner }, start: 'reparieren_byte.py', sekunden: 15 });
  const zeile = (r.ausgabe || '').split('\n').find((l) => l.startsWith(MARKE));
  try { return zeile ? JSON.parse(zeile.slice(MARKE.length)) : null; } catch (_) { return null; }
}

/** Tests laufen lassen → {ergebnisse: [{name, ok, fehler}], roh} */
async function testsLaufen(sprache, code, tests) {
  const { dateien, start } = testDateien(sprache, code, tests);
  const r = await lyra.code({ sprache, dateien, start, sekunden: 15 });
  const zeile = (r.ausgabe || '').split('\n').find((l) => l.startsWith(MARKE));
  let ergebnisse = null;
  if (zeile) try { ergebnisse = JSON.parse(zeile.slice(MARKE.length)); } catch (_) {}
  return { ergebnisse, roh: r };
}

// ================================================================== Aufgabe erstellen

function erstellen() {
  const thema = z.thema.trim();
  const sprache = z.einst.sprache;
  if (!thema || !vorhanden(sprache)) return;
  return laufen(async () => {
    let block = '';
    try { block = ((await lyra.suchen(`${thema} Programmieren Übung`, 4)).block || '').slice(0, 4000); } catch (_) {}
    let aufgabe = null;
    let rueck = '';
    for (let versuch = 0; versuch < 3 && !aufgabe; versuch++) {
      status(versuch ? 'Byte bessert die Aufgabe nach …' : 'Byte denkt sich eine Aufgabe aus …');
      const sp = SPRACHEN[sprache];
      const r = await lyra.ki({
        lehrer: z.lehrer,
        system: SYSTEM,
        prompt: `Sprache: ${sp.name}\nThema: ${thema}\nNiveau: ${{ leicht: 'Einstieg (eine Funktion, wenige Zeilen)', mittel: 'Übungsblatt (Schleifen, Fallunterscheidungen, Hilfsfunktionen)', schwer: 'anspruchsvoll (Algorithmus, Randfälle, Effizienz)' }[z.einst.niveau]}\n\n\
${block ? `Auszüge aus meinen Vorlesungsunterlagen (gern daran anlehnen):\n${block}\n\n` : ''}\
Stelle eine Programmieraufgabe. Felder:\n\
- "titel": kurz\n- "aufgabe": Aufgabenstellung in Markdown mit Beispielen (Eingabe → Ausgabe) und der genauen Signatur\n\
- "loesung": vollständige, korrekte Musterlösung (geheim) als ${sp.datei}\n\
- "vorlage": Startcode für ${sp.datei} mit der Signatur und TODO – ohne Lösung\n\
- "tests": 4 bis 6 Tests mit "name" (kurz, was geprüft wird) und "code": ${sprache === 'python'
          ? 'Python mit assert, z. B. "assert summe([1, 2, 3]) == 6, \'summe([1,2,3]) soll 6 sein\'" (die Funktionen der Lösung sind direkt aufrufbar)'
          : 'Java-Anweisungen, die mit erwarte(bedingung, "Meldung"); prüfen, z. B. "erwarte(Loesung.summe(new int[]{1,2,3}) == 6, \\"summe soll 6 sein\\");" – die Klasse heißt public class Loesung'}\n\
Decke Randfälle ab (leer, eins, negativ …). Keine Ein-/Ausgabe über die Konsole in den Tests.${rueck}\n\n\
Antwort als JSON: {"aufgabe": "…", "loesung": "…", "tests": [{"code": "…", "name": "…"}], "titel": "…", "vorlage": "…"}`,
        schema: SCHEMA,
        zaehlen: { schluessel: 'name', wort: 'Test' },
      }, (e) => { if (e.art === 'hinweis') status(e.text); });
      if (r && r.lehrer) z.lehrer = r.lehrer;
      const j = (r && r.json) || {};
      const code = (s) => String(s || '').replace(/^```[a-z]*\n?|```\s*$/g, '').trim();
      const kandidat = { titel: String(j.titel || thema).trim(), aufgabe: String(j.aufgabe || '').trim(), loesung: code(j.loesung), vorlage: code(j.vorlage),
        tests: (j.tests || []).map((t) => ({ name: String(t.name || 'Test').trim().slice(0, 100), code: String(t.code || '').trim() })).filter((t) => t.code) };
      if (!kandidat.aufgabe || !kandidat.loesung || !kandidat.tests.length) { rueck = '\n\nAchtung: Es fehlten Felder – gib alles vollständig an.'; continue; }
      // Tests an der eigenen Musterlösung prüfen
      status('Byte prüft die Tests an der Musterlösung …');
      let { ergebnisse, roh } = await testsLaufen(sprache, kandidat.loesung, kandidat.tests);
      if (!ergebnisse) { rueck = `\n\nAchtung: Lösung und Tests ließen sich nicht ausführen:\n${(roh.fehler || roh.ausgabe || '').slice(0, 800)}\nKorrigiere das.`; continue; }
      if (sprache === 'python' && ergebnisse.some((x) => !x.ok)) {
        status('Byte rechnet die Erwartungen der Tests an der Musterlösung nach …');
        const neu = await testsReparieren(kandidat.loesung, kandidat.tests);
        if (neu) {
          kandidat.tests = kandidat.tests.map((t, i) => (ergebnisse[i] && !ergebnisse[i].ok && neu[i] ? { ...t, code: neu[i] } : t));
          ({ ergebnisse, roh } = await testsLaufen(sprache, kandidat.loesung, kandidat.tests));
          if (!ergebnisse) { rueck = '\n\nAchtung: Lösung und Tests ließen sich nicht ausführen. Korrigiere das.'; continue; }
        }
      }
      const gute = kandidat.tests.filter((t, i) => ergebnisse[i] && ergebnisse[i].ok);
      if (gute.length < 2) { rueck = `\n\nAchtung: Deine Musterlösung bestand deine eigenen Tests nicht (${ergebnisse.filter((x) => !x.ok).map((x) => x.fehler).slice(0, 3).join('; ')}). Korrigiere Lösung oder Tests.`; continue; }
      aufgabe = { ...kandidat, tests: gute, verworfen: kandidat.tests.length - gute.length };
    }
    if (!aufgabe) throw new Error('Byte hat keine stimmige Aufgabe hinbekommen – nochmal versuchen (mit Claude, ChatGPT oder Gemini klappt es zuverlässiger).');
    z.a = { id: lyra.neueId(), sprache, ...aufgabe, code: aufgabe.vorlage || '', geloest: false, hinweise: [], zeit: lyra.jetzt() };
    z.ausgabe = null;
    z.zeigeLoesung = false;
    z.thema = '';
    await sichern();
  });
}

// ================================================================== Ausführen, Prüfen, Hinweis

function ausfuehren() {
  const ziel = z.a || z.spielwiese;
  return laufen(async () => {
    status('Läuft …');
    const sp = SPRACHEN[ziel.sprache];
    const r = await lyra.code({ sprache: ziel.sprache, dateien: { [sp.datei]: ziel.code }, start: ziel.sprache === 'python' ? sp.datei : 'Loesung', eingabe: z.eingabe, sekunden: 10 });
    z.ausgabe = { art: 'lauf', ...r };
  });
}

function pruefen() {
  const a = z.a;
  return laufen(async () => {
    status('Tests laufen …');
    const { ergebnisse, roh } = await testsLaufen(a.sprache, a.code, a.tests);
    z.ausgabe = { art: 'tests', ergebnisse, roh };
    if (ergebnisse && ergebnisse.every((e) => e.ok)) a.geloest = true;
    await sichern();
  });
}

function hinweis() {
  const a = z.a;
  const t = z.ausgabe && z.ausgabe.art === 'tests' && z.ausgabe.ergebnisse ? z.ausgabe.ergebnisse.filter((e) => !e.ok).map((e) => `${e.name}: ${e.fehler}`).join('\n') : '';
  return laufen(async () => {
    const r = await lyra.ki({
      lehrer: z.lehrer,
      system: SYSTEM,
      prompt: `Aufgabe:\n${a.aufgabe}\n\nMusterlösung (GEHEIM, nicht verraten, keinen Code daraus zeigen):\n${a.loesung}\n\nCode der/des Studierenden:\n${a.code}\n\n${t ? `Fehlgeschlagene Tests:\n${t}\n\n` : ''}\
Gib EINEN hilfreichen Hinweis (2 bis 3 Sätze): wo liegt das Problem bzw. woran sollte sie/er als Nächstes denken? Keinen fertigen Code, höchstens einen kleinen Ausschnitt-Gedanken. Antworte nur mit dem Hinweis.`,
    }, (e) => { if (e.art === 'hinweis') status(e.text); });
    a.hinweise.push(String((r && r.text) || '').trim());
    await sichern();
  });
}

async function loesungZeigen() {
  const ok = await lyra.dialog('Musterlösung zeigen?', h('p', {}, 'Versuch es ruhig noch mit einem Hinweis – selbst draufkommen bringt am meisten. Trotzdem zeigen?'), [
    { text: 'Lieber Hinweis', art: 'text', wert: 'hinweis' },
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Ja, zeigen', wert: true },
  ]);
  if (ok === 'hinweis') return hinweis();
  if (ok) { z.zeigeLoesung = true; zeichnen(); }
}

// ================================================================== Ansichten

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const pos = aktiv && 'selectionStart' in aktiv ? [aktiv.selectionStart, aktiv.selectionEnd, aktiv.scrollTop] : null;
  app.replaceChildren(z.a || z.spielwiese ? labor() : startAnsicht());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); if (pos) { try { e.setSelectionRange(pos[0], pos[1]); e.scrollTop = pos[2]; } catch (_) {} } }
  lyra.titel(z.a ? z.a.titel : z.spielwiese ? 'Spielwiese' : '');
}

function laufZeile() {
  return z.laeuft ? h('div', { style: { marginTop: '12px' } }, lyra.arbeit(z.status || 'Byte arbeitet …')) : null;
}

function fehlerZeile() {
  return z.fehler ? lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; zeichnen(); } : null, () => { z.fehler = null; zeichnen(); }) : null;
}

async function aufgabeLoeschen(a) {
  if (!(await lyra.bestaetigen({ titel: `„${a.titel}“ löschen?`, text: 'Aufgabe, dein Code und die Tests werden gelöscht.', ja: 'Löschen', gefahr: true }))) return;
  try { await lyra.speicher.loeschen('aufgaben/' + a.id); } catch (_) {}
  z.aufgaben = z.aufgaben.filter((x) => x.id !== a.id);
  zeichnen();
}

function startAnsicht() {
  const fehlt = z.sprachen.filter((s) => !s.vorhanden);
  const setzen = async (schl, w) => { z.einst[schl] = w; try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {} zeichnen(); };
  const spielwiese = () => {
    z.spielwiese = { sprache: z.einst.sprache, code: z.einst.sprache === 'python' ? 'print("Hallo, Byte!")\n' : 'public class Loesung {\n    public static void main(String[] args) {\n        System.out.println("Hallo, Byte!");\n    }\n}\n' };
    z.ausgabe = null;
    zeichnen();
  };
  return h('div', { class: 'seite' },
    lyra.kopf({
      titel: 'Programmieren üben',
      unter: 'Eine Aufgabe mit Tests – du schreibst den Code, Byte führt ihn abgeschottet auf deinem Mac aus und zeigt, welche Tests bestehen.',
      aktionen: [h('button', { class: 'knopf tonal klein', disabled: !vorhanden(z.einst.sprache), onclick: spielwiese }, '🧪 Spielwiese')],
    }),
    lyra.verfasser({
      wert: z.thema,
      feld: 'thema',
      zeilen: 1,
      platzhalter: 'Thema der Aufgabe, z. B. Rekursion, Listen umdrehen, Primzahlen, Klassen & Objekte',
      beiEingabe: (v) => { z.thema = v; },
      beiSenden: (v) => { z.thema = v; erstellen(); },
      knopf: 'Aufgabe stellen',
      deaktiviert: !!z.laeuft || !vorhanden(z.einst.sprache),
      unten: [
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        lyra.auswahl({ titel: 'Sprache', wert: z.einst.sprache, beiWahl: (w) => setzen('sprache', w),
          optionen: Object.entries(SPRACHEN).map(([k, s]) => [k, s.name + (vorhanden(k) ? '' : ' (fehlt)'), vorhanden(k) ? '' : 'Auf diesem Mac nicht installiert']) }),
        lyra.auswahl({ titel: 'Niveau', wert: z.einst.niveau, beiWahl: (w) => setzen('niveau', w),
          optionen: [['leicht', 'Einstieg', 'Ein Konzept, wenige Zeilen'], ['mittel', 'Übungsblatt', 'Wie im Studium'], ['schwer', 'Knobelei', 'Für Tüftler']] }),
      ],
    }),
    z.themen.length && !z.laeuft ? lyra.vorschlaege(z.themen, (x) => { z.thema = x; zeichnen(); const f = document.querySelector('[data-feld="thema"]'); if (f) f.focus(); }, { titel: 'Aus deinen Unterlagen:' }) : null,
    laufZeile(), fehlerZeile(),
    fehlt.length ? h('div', { class: 'kasten warn klein', style: { marginTop: '12px' } }, `Nicht installiert: ${fehlt.map((s) => `${SPRACHEN[s.name] ? SPRACHEN[s.name].name : s.name} – dafür ${s.hinweis}`).join('; ')}. Lyra installiert nichts von selbst.`) : null,
    z.aufgaben.length ? lyra.abschnitt('Deine Aufgaben', h('div', { class: 'ly-liste' }, z.aufgaben.map((a) => lyra.eintrag({
      symbol: a.geloest ? '✓' : '{ }',
      farbe: a.geloest ? 'var(--ok)' : '',
      titel: a.titel,
      unter: `${SPRACHEN[a.sprache].name} · ${a.tests.length} Tests${a.geloest ? ' · gelöst' : ''} · ${lyra.zeitText(a.zeit || lyra.jetzt())}`,
      beiKlick: () => { z.a = a; z.ausgabe = null; z.zeigeLoesung = false; zeichnen(); },
      aktionen: [{ symbol: '🗑', titel: 'Löschen', bei: () => aufgabeLoeschen(a) }],
    })))) : null,
    h('div', { class: 'leise klein', style: { marginTop: '20px', textAlign: 'center' } }, '🔒 Dein Code läuft abgeschottet: ohne Internet, ohne Zugriff auf deine Dateien, mit Zeitlimit.'));
}

function editor(ziel) {
  const ta = h('textarea', { class: 'code', 'data-feld': 'code', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off' });
  ta.value = ziel.code;
  const nummern = h('div', { class: 'nummern' });
  const zaehlen = () => { nummern.textContent = ziel.code.split('\n').map((_, i) => i + 1).join('\n'); };
  let plan = null;
  ta.addEventListener('input', () => { ziel.code = ta.value; zaehlen(); if (z.a) { clearTimeout(plan); plan = setTimeout(sichern, 700); } });
  ta.addEventListener('scroll', () => { nummern.scrollTop = ta.scrollTop; });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart;
      ta.setRangeText('    ', s, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    } else if (e.key === 'Enter' && !e.metaKey) {
      // Einrückung der Zeile übernehmen
      const s = ta.selectionStart;
      const zeile = ta.value.slice(0, s).split('\n').pop();
      const einr = (zeile.match(/^\s*/) || [''])[0] + (/[:{]\s*$/.test(zeile) ? '    ' : '');
      e.preventDefault();
      ta.setRangeText('\n' + einr, s, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    } else if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      z.a ? pruefen() : ausfuehren();
    }
  });
  zaehlen();
  return h('div', { class: 'editor' }, nummern, ta);
}

function konsole() {
  const o = z.ausgabe;
  if (!o) return h('div', { class: 'konsole leer' }, h('span', { class: 'leise' }, z.a ? '▶ Ausführen oder ✓ Tests prüfen (⌘↩)' : '▶ Ausführen (⌘↩)'));
  if (o.art === 'tests') {
    const e = o.ergebnisse;
    if (!e) {
      return h('div', { class: 'konsole' }, h('div', { class: 'k-kopf schlecht' }, o.roh.schritt === 'übersetzen' ? '✗ Lässt sich nicht übersetzen' : o.roh.zeitUm ? '⏱ Zeitlimit überschritten' : '✗ Tests ließen sich nicht ausführen'),
        h('pre', {}, (o.roh.fehler || o.roh.ausgabe || '').slice(0, 4000)));
    }
    const ok = e.filter((x) => x.ok).length;
    return h('div', { class: 'konsole' },
      h('div', { class: 'k-kopf ' + (ok === e.length ? 'gut' : 'schlecht') }, ok === e.length ? `🎉 Alle ${e.length} Tests bestanden!` : `${ok} von ${e.length} Tests bestanden`),
      e.map((x) => h('div', { class: 'test-zeile ' + (x.ok ? 'gut' : 'schlecht') }, h('span', {}, x.ok ? '✓' : '✗'), h('div', { class: 'wachsen' }, h('div', {}, x.name), x.ok ? null : h('div', { class: 'klein mono' }, x.fehler)))));
  }
  return h('div', { class: 'konsole' },
    h('div', { class: 'k-kopf ' + (o.ok ? 'gut' : 'schlecht') }, o.zeitUm ? '⏱ Zeitlimit überschritten (Endlosschleife?)' : o.schritt === 'übersetzen' ? '✗ Übersetzungsfehler' : o.ok ? `✓ Fertig (${o.dauerMs} ms)` : `✗ Beendet mit Code ${o.code}`),
    o.ausgabe ? h('pre', {}, o.ausgabe) : null,
    o.fehler ? h('pre', { class: 'fehler-text' }, o.fehler.slice(0, 4000)) : null,
    !o.ausgabe && !o.fehler ? h('div', { class: 'leise klein' }, '(keine Ausgabe)') : null);
}

function labor() {
  const a = z.a;
  const ziel = a || z.spielwiese;
  const ein = h('input', { class: 'eingabe klein-eingabe', 'data-feld': 'eingabe', placeholder: 'Eingabe für input() / Scanner (optional)', value: z.eingabe });
  ein.addEventListener('input', () => { z.eingabe = ein.value; });
  return h('div', { class: 'labor' },
    h('div', { class: 'leiste' },
      h('button', { class: 'knopf text', onclick: () => { z.a = null; z.spielwiese = null; z.ausgabe = null; zeichnen(); } }, '← Zurück'),
      h('div', { class: 'fett wachsen' }, a ? a.titel : `Spielwiese · ${SPRACHEN[ziel.sprache].name}`),
      a && a.geloest ? h('span', { class: 'etikett gut' }, '✓ Gelöst') : null,
      h('button', { class: 'knopf tonal', disabled: z.laeuft, onclick: ausfuehren }, '▶ Ausführen'),
      a ? h('button', { class: 'knopf', disabled: z.laeuft, onclick: pruefen }, '✓ Tests prüfen') : null),
    h('div', { class: 'labor-mitte' },
      a ? h('div', { class: 'aufgabe-spalte' },
        mdElement(a.aufgabe),
        h('div', { class: 'ueberschrift-klein', style: { margin: '12px 0 6px' } }, `Tests (${a.tests.length})`),
        a.tests.map((t) => h('div', { class: 'klein test-name' }, '• ' + t.name)),
        a.hinweise.length ? h('div', { style: { marginTop: '12px' } }, a.hinweise.map((x, i) => h('div', { class: 'hinweis' }, h('b', {}, `💡 Hinweis ${i + 1}: `), mdElement(x)))) : null,
        h('div', { class: 'zeile', style: { marginTop: '12px', gap: '6px' } },
          h('button', { class: 'knopf tonal klein', disabled: z.laeuft, onclick: hinweis }, '💡 Hinweis'),
          h('button', { class: 'knopf text klein', disabled: z.laeuft, onclick: loesungZeigen }, 'Musterlösung …'),
          h('button', { class: 'knopf text klein', onclick: async () => { if (!(await lyra.bestaetigen({ titel: 'Code auf die Vorlage zurücksetzen?', text: '', ja: 'Zurücksetzen', nein: 'Abbrechen', gefahr: true }))) return; a.code = a.vorlage; await sichern(); zeichnen(); } }, 'Zurücksetzen')),
        z.zeigeLoesung ? h('div', { class: 'loesung' }, h('div', { class: 'ueberschrift-klein' }, 'Musterlösung'), h('pre', {}, a.loesung)) : null)
        : null,
      h('div', { class: 'code-spalte' },
        editor(ziel),
        h('div', { class: 'zeile', style: { gap: '8px' } }, ein),
        laufZeile(), fehlerZeile(),
        konsole())));
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
  const ok = await lyra.dialog('Byte – Einstellungen', h('div', { class: 'spalte', style: { minWidth: '420px', gap: '12px' } },
    h('div', { class: 'fett' }, 'Wer stellt Aufgaben und gibt Hinweise'), wahl('ki', [['auto', 'Automatisch (Claude & Co., wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']]),
    h('div', { class: 'leise klein' }, 'Ausgeführt wird immer nur auf deinem Mac. An Claude & Co. gehen höchstens das Thema, passende Auszüge und – für Hinweise – dein Code.')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  z.lehrer = e.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
}

start();
