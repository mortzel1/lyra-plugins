'use strict';
/*
 * Quizzard Online – das Live-Quiz für viele gleichzeitig. Du bist Host (spielst nicht mit) und zeigst die Fragen; alle
 * anderen antworten auf ihrem Gerät. Wer richtig liegt, bekommt Punkte – je schneller, desto mehr. Am Ende gewinnt, wer die
 * meisten Punkte hat.
 *
 * Mitspielen können:
 *  - alle mit Link oder QR-Code im Browser – ohne Lyra, ohne Konto, von überall (Lyra öffnet eine Spielseite über einen
 *    Tunnel; Ende-zu-Ende-verschlüsselt), siehe gaeste/
 *  - alle in einem Raum von Lyra Campus mit ihrer Lyra (Ende-zu-Ende-verschlüsselt über Matrix)
 * Das Quiz entsteht vorher – per KI aus einem Thema (gern aus deinen Unterlagen) oder von Hand.
 */
const { h } = lyra;
const FARBEN = QOSpieler.FARBEN;
const FORMEN = QOSpieler.FORMEN;
const TYP = 'quizzard-online';

const STANDARD = { anzahl: 10, zeit: 20, quelle: 'beides', schwierigkeit: 'gemischt' };

const SYSTEM = `Du bist der „Quizzard“ in Lyra und erstellst Fragen für ein Live-Quiz, das eine ganze Gruppe gleichzeitig \
auf ihren Handys spielt. Jede Frage ist kurz (höchstens 120 Zeichen), eindeutig, fachlich korrekt und in wenigen Sekunden \
lesbar. Antwortmöglichkeiten sind kurz (höchstens 60 Zeichen), gleich lang wirkend und plausibel – genau eine ist richtig. \
Keine Fangfragen, keine Wortklauberei, keine „alle/keine der genannten“-Antworten. Formeln vermeiden.`;

const SCHEMA = {
  type: 'object',
  properties: {
    fragen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          art: { type: 'string', enum: ['auswahl', 'wahrfalsch'] },
          frage: { type: 'string' },
          optionen: { type: 'array', items: { type: 'string' } },
          richtig: { type: 'integer' },
          wissenswert: { type: 'string' },
        },
        required: ['art', 'frage', 'optionen', 'richtig', 'wissenswert'],
      },
    },
  },
  required: ['fragen'],
};

const z = {
  info: null,
  lehrer: 'lyra',
  einst: { ...STANDARD },
  ansicht: 'start', // start | zaubern | bearbeiten | lobby | frage | aufloesung | rangliste | ende | spieler
  quizze: [],
  runden: [],
  quiz: null, // in Bearbeitung
  thema: '',
  hinweis: '',
  fehler: null,
  kontext: null, // Lyra Campus: {raum, rolle, host, ich, inhalt}
  spiel: null,
  spielerAnsicht: null,
};
const app = document.getElementById('app');
const zahl = (n) => Math.round(n || 0).toLocaleString('de-DE');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const meldung = (e) => String((e && e.message) || e || '');
const abgebrochen = (e) => /ABGEBROCHEN|Abgebrochen/.test(meldung(e));

// ================================================================== Start

async function start() {
  try {
    z.info = await lyra.info();
  } catch (_) {
    z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' };
  }
  z.lehrer = z.info.standardLehrer || 'lyra';
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  await quizzeLaden();
  lyra.bei('gaeste', gastEreignis);
  lyra.bei('campus', campusEreignis);
  lyra.bei('zurueck', zurueck);
  try { z.kontext = await lyra.campus.kontext(); } catch (_) { z.kontext = null; }
  const k = z.kontext;
  if (k && k.inhalt && k.inhalt.typ === TYP) {
    const ichLeite = k.ich && k.inhalt.von === k.ich.id;
    if (!ichLeite) return spielerStarten(k);
    // Du leitest diese Live-Runde (aus dem Raum geöffnet): das Quiz dazu gleich in die Lobby
    const q = z.quizze.find((x) => x.id === (k.inhalt.daten && k.inhalt.daten.quiz));
    if (q) return lobbyOeffnen(q, { campus: true });
  }
  zeichnen();
}

async function quizzeLaden() {
  try { z.quizze = (await lyra.speicher.liste('quiz')).map((e) => e.wert).filter(Boolean).sort((a, b) => (b.geaendert || 0) - (a.geaendert || 0)); } catch (_) { z.quizze = []; }
  try { z.runden = (await lyra.speicher.liste('runden')).map((e) => e.wert).filter(Boolean).sort((a, b) => b.zeit - a.zeit).slice(0, 8); } catch (_) { z.runden = []; }
}

async function quizSichern(q) {
  q.geaendert = lyra.jetzt();
  try { await lyra.speicher.schreiben('quiz/' + q.id, q); } catch (e) { lyra.toast(meldung(e), 'fehler'); }
  const i = z.quizze.findIndex((x) => x.id === q.id);
  if (i >= 0) z.quizze[i] = q; else z.quizze.unshift(q);
}

async function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.ansicht === 'spieler') return lyra.zurueck();
  if (z.spiel) {
    const ok = await lyra.bestaetigen({ titel: 'Spiel beenden?', text: 'Alle Mitspielenden werden abgemeldet; der Spielstand geht verloren.', ja: 'Spiel beenden', nein: 'Weiterspielen', gefahr: true });
    if (ok) await spielBeenden();
    return;
  }
  if (z.ansicht === 'zaubern') { lyra.abbrechen(); return; }
  if (z.ansicht !== 'start') { z.ansicht = 'start'; z.quiz = null; return zeichnen(); }
  lyra.zurueck();
}

// ================================================================== Quiz per KI

function pruefen(f) {
  const frage = text(f.frage);
  if (!frage) return null;
  if (f.art === 'wahrfalsch') {
    if (f.richtig !== 0 && f.richtig !== 1) return null;
    return { frage, optionen: ['Wahr', 'Falsch'], richtig: f.richtig, wissenswert: text(f.wissenswert) };
  }
  let optionen = (f.optionen || []).map(text).filter(Boolean).slice(0, 4);
  if (optionen.length < 2 || !Number.isInteger(f.richtig) || f.richtig < 0 || f.richtig >= optionen.length) return null;
  // Mischen (KIs setzen die richtige Antwort gern an dieselbe Stelle)
  const richtigText = optionen[f.richtig];
  optionen = lyra.mischen(optionen);
  return { frage, optionen, richtig: optionen.indexOf(richtigText), wissenswert: text(f.wissenswert) };
}

async function erstellen() {
  const thema = z.thema.trim();
  if (!thema) return;
  const anzahl = Math.max(3, Math.min(30, z.einst.anzahl));
  try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {}
  z.ansicht = 'zaubern';
  z.fehler = null;
  z.hinweis = 'Suche passende Stellen …';
  zeichnen();
  let block = '';
  if (z.einst.quelle !== 'wissen') {
    try { block = (await lyra.suchen(thema, z.lehrer === 'lyra' ? 7 : 12)).block || ''; } catch (_) {}
    if (!block && z.einst.quelle === 'unterlagen') {
      z.fehler = 'Dazu habe ich in deinen Unterlagen nichts gefunden – wähle „Unterlagen + Wissen“ oder „Allgemeinwissen“.';
      z.ansicht = 'start';
      return zeichnen();
    }
  }
  const schwierigkeit = { leicht: 'leicht (Grundwissen)', gemischt: 'gemischt: leicht, mittel und schwer', schwer: 'schwer (für Fortgeschrittene)' }[z.einst.schwierigkeit] || 'gemischt';
  let fragen = [];
  let leer = 0;
  while (fragen.length < anzahl && leer < 2) {
    const n = Math.min(z.lehrer === 'lyra' ? 8 : 15, anzahl - fragen.length);
    const schon = fragen.map((f) => '- ' + f.frage.slice(0, 90)).join('\n');
    let r = null;
    try {
      r = await lyra.ki({
        lehrer: z.lehrer,
        system: SYSTEM,
        prompt: `Thema: ${thema}\nSchwierigkeit: ${schwierigkeit}\nSprache: Deutsch\n\n` +
          (block ? `Auszüge aus meinen Unterlagen (stütze dich darauf${z.einst.quelle === 'beides' ? ', ergänze mit Allgemeinwissen' : ''}):\n\n${block}\n\n` : 'Nutze gesichertes Allgemeinwissen.\n\n') +
          (schon ? `Diese Fragen gibt es schon – nicht wiederholen:\n${schon}\n\n` : '') +
          `Erstelle genau ${n} neue Fragen. Meist "auswahl" mit genau 4 Antwortmöglichkeiten, gelegentlich "wahrfalsch" (dann "optionen": ["Wahr", "Falsch"]). ` +
          `"richtig" ist der Index der richtigen Antwort (0 bis 3). "wissenswert" erklärt die Lösung in einem kurzen Satz.\n\n` +
          `Antwort als JSON: {"fragen": [{"art": "auswahl", "frage": "…", "optionen": ["…", "…", "…", "…"], "richtig": 0, "wissenswert": "…"}]}`,
        schema: SCHEMA,
        zaehlen: { schluessel: 'frage', wort: 'Frage' },
      }, (e) => {
        if (e.art === 'hinweis') {
          const m = e.text.match(/Frage (\d+)/);
          z.hinweis = m ? `Frage ${Math.min(anzahl, fragen.length + Number(m[1]))} von ${anzahl} …` : e.text;
          const el = document.getElementById('hinweis');
          if (el) el.textContent = z.hinweis;
        }
      });
      if (r && r.lehrer && r.lehrer !== z.lehrer) z.lehrer = r.lehrer;
    } catch (e) {
      if (abgebrochen(e)) { z.ansicht = 'start'; return zeichnen(); }
      z.fehler = meldung(e);
      break;
    }
    const neu = ((r && r.json && r.json.fragen) || []).map(pruefen).filter(Boolean)
      .filter((f) => !fragen.some((g) => g.frage.toLowerCase() === f.frage.toLowerCase()));
    leer = neu.length ? 0 : leer + 1;
    fragen.push(...neu.slice(0, anzahl - fragen.length));
  }
  if (fragen.length < 3) {
    z.fehler = z.fehler || 'Das Quiz ist nicht gelungen – bitte nochmal versuchen.';
    z.ansicht = 'start';
    return zeichnen();
  }
  const quiz = { id: lyra.neueId(), titel: thema, fragen: fragen.map((f) => ({ ...f, zeit: z.einst.zeit })), erstellt: lyra.jetzt(), gespielt: 0 };
  await quizSichern(quiz);
  z.thema = '';
  // Erst ansehen und anpassen, dann spielen
  z.quiz = quiz;
  z.ansicht = 'bearbeiten';
  lyra.toast(`✓ ${fragen.length} Fragen – sieh sie dir an, bevor es losgeht`, 'ok');
  zeichnen();
}

// ================================================================== Spiel (Host)

/** Neues Spiel in der Lobby. campus: aus einem Raum geöffnet (Live-Runde läuft schon über Campus). */
function lobbyOeffnen(quiz, { campus = false } = {}) {
  z.spiel = {
    id: lyra.neueId(),
    quiz,
    i: -1,
    phase: 'lobby',
    spieler: new Map(), // id → {id, name, quelle, punkte, serie, richtig, zeitSumme, antworten, da, letzt}
    gaeste: null, // {url, qr}
    gaesteFehler: '',
    gaesteLaedt: false,
    campus: campus && z.kontext ? { raum: z.kontext.raum } : null,
    takt: null,
    lobbyTakt: null,
  };
  z.ansicht = 'lobby';
  zeichnen();
  if (campus) anAlle(lobbyNachricht());
  gaesteOeffnen();
}

async function gaesteOeffnen() {
  const s = z.spiel;
  if (!s || s.gaeste || s.gaesteLaedt) return;
  s.gaesteLaedt = true;
  s.gaesteFehler = '';
  zeichnen();
  try {
    const r = await lyra.gaeste.starten({ titel: s.quiz.titel });
    if (z.spiel !== s) return lyra.gaeste.beenden().catch(() => {});
    s.gaeste = r;
    for (const g of r.gaeste || []) spielerDazu(g.id, g.name, 'link');
  } catch (e) {
    s.gaesteFehler = abgebrochen(e) ? 'Ohne Spielseite können nur Campus-Mitglieder mitspielen.' : meldung(e);
  }
  s.gaesteLaedt = false;
  if (z.spiel === s) zeichnen();
}

async function campusTeilen() {
  const s = z.spiel;
  let raeume = [];
  try { raeume = await lyra.campus.raeume(); } catch (e) { return lyra.toast(meldung(e), 'fehler'); }
  if (!raeume.length) {
    return lyra.dialog('Noch kein Campus', h('p', { class: 'leise', style: { maxWidth: '420px', lineHeight: 1.5 } },
      'Melde dich in Lyra bei Campus an und tritt einem Campus bei – dann können seine Mitglieder mit ihrer Lyra mitspielen.'), [{ text: 'OK', wert: true }]);
  }
  let raum = raeume[0].id;
  const ok = await lyra.dialog('In einen Campus-Raum teilen', h('div', { class: 'spalte', style: { minWidth: '420px', gap: '12px' } },
    lyra.auswahl({ titel: 'Raum', symbol: '👥', optionen: raeume.map((r) => [r.id, r.name, `${r.mitglieder} Mitglieder`]), wert: raum, beiWahl: (w) => { raum = w; }, breit: true }),
    h('p', { class: 'leise klein', style: { lineHeight: 1.5 } }, 'Die Mitglieder sehen die Live-Runde in ihrem Campus und spielen mit ihrer Lyra mit – Ende-zu-Ende-verschlüsselt. Ihre Antworten gehen nur an dich.')),
  [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Teilen', wert: true }]);
  if (!ok || z.spiel !== s) return;
  try {
    await lyra.campus.teilen({
      raum, typ: TYP, modus: 'live', selbst: true,
      titel: `Quizzard Online: ${s.quiz.titel}`,
      beschreibung: `Live-Quiz mit ${s.quiz.fragen.length} Fragen – öffnen und mitspielen`,
      daten: { quiz: s.quiz.id, titel: s.quiz.titel, anzahl: s.quiz.fragen.length },
    });
    z.kontext = await lyra.campus.kontext();
    if (z.kontext) {
      s.campus = { raum: z.kontext.raum };
      anAlle(lobbyNachricht());
      lyra.toast(`✓ Live-Runde in „${z.kontext.raum.name}“ – die Mitglieder können jetzt beitreten`, 'ok');
    }
  } catch (e) {
    if (!abgebrochen(e)) lyra.toast(meldung(e), 'fehler');
  }
  zeichnen();
}

function anAlle(d) {
  const s = z.spiel;
  if (!s) return;
  if (s.gaeste) lyra.gaeste.senden(d).catch(() => {});
  if (s.campus) {
    lyra.campus.live(d).catch((e) => {
      if (abgebrochen(e)) { s.campus = null; lyra.toast('Campus-Mitspieler sind nicht dabei (ohne deine Zustimmung).', ''); zeichnen(); }
    });
  }
}

function anEinen(sp, d) {
  if (sp.quelle === 'link' && z.spiel && z.spiel.gaeste) lyra.gaeste.senden(d, sp.id).catch(() => {});
}

const aktiv = () => [...z.spiel.spieler.values()].filter((p) => p.da);

function lobbyNachricht() {
  const s = z.spiel;
  return { typ: 'lobby', titel: s.quiz.titel, anzahl: s.quiz.fragen.length, spieler: aktiv().length };
}

function lobbyMelden() {
  const s = z.spiel;
  if (!s || s.phase !== 'lobby') return;
  clearTimeout(s.lobbyTakt);
  s.lobbyTakt = setTimeout(() => z.spiel === s && anAlle(lobbyNachricht()), 700);
}

function frageNachricht(spaet) {
  const s = z.spiel;
  const f = s.quiz.fragen[s.i];
  return { typ: 'frage', i: s.i, n: s.quiz.fragen.length, frage: f.frage, optionen: f.optionen, zeit: f.zeit, vergangen: spaet ? Math.max(0, Date.now() - s.gesendetUm) : 0 };
}

function spielerDazu(id, name, quelle) {
  const s = z.spiel;
  if (!s || !id) return;
  let p = s.spieler.get(id);
  if (!p) {
    if (s.spieler.size >= 200) return;
    p = { id, name: String(name || 'Gast').slice(0, 24), quelle, punkte: 0, serie: 0, richtig: 0, zeitSumme: 0, antworten: {}, da: true, letzt: null };
    s.spieler.set(id, p);
    if (s.phase !== 'lobby') lyra.toast(`${p.name} ist dazugekommen`);
  } else {
    p.da = true;
  }
  // Wer später kommt, bekommt den Stand
  anEinen(p, lobbyNachricht());
  if (s.phase === 'frage') anEinen(p, frageNachricht(true));
  lobbyMelden();
  zeichnen();
}

function spielerWeg(id) {
  const p = z.spiel && z.spiel.spieler.get(id);
  if (!p) return;
  p.da = false;
  if (z.spiel.phase === 'lobby') z.spiel.spieler.delete(id);
  lobbyMelden();
  zeichnen();
  if (z.spiel.phase === 'frage' && alleDa()) schliessenBald();
}

async function spielerEntfernen(p) {
  const ok = await lyra.bestaetigen({ titel: `${p.name} entfernen?`, text: 'Der Name verschwindet aus dem Spiel.', ja: 'Entfernen', gefahr: true });
  if (!ok || !z.spiel) return;
  if (p.quelle === 'link') lyra.gaeste.entfernen(p.id).catch(() => {});
  z.spiel.spieler.delete(p.id);
  lobbyMelden();
  zeichnen();
}

function gastEreignis(e) {
  if (!z.spiel || !e) return;
  if (e.art === 'beigetreten') spielerDazu(e.id, e.name, 'link');
  else if (e.art === 'gegangen') spielerWeg(e.id);
  else if (e.art === 'nachricht') eingang(e.id, e.daten || {}, e.zeit);
}

function campusEreignis(e) {
  if (!e) return;
  if (z.ansicht === 'spieler') {
    if (e.art === 'live' && e.daten && z.spielerAnsicht) {
      // Der Host öffnet die Lobby (vielleicht erst nach dir): noch einmal „bin da“ sagen – höchstens alle 5 s
      if (e.daten.typ === 'lobby' && Date.now() - (z.daZuletzt || 0) > 5000) {
        z.daZuletzt = Date.now();
        lyra.campus.anHost({ typ: 'da' }, 'Deine Teilnahme an der Live-Runde').catch(() => {});
      }
      z.spielerAnsicht.empfangen(e.daten);
    }
    return;
  }
  const s = z.spiel;
  if (!s || !s.campus || e.art !== 'ergebnis') return;
  const d = e.daten || {};
  if (d.typ === 'da') spielerDazu(e.von, e.name, 'campus');
  else eingang(e.von, d, e.zeit);
}

/** Eine Antwort kommt an. Die Zeit misst das Gerät der Spielenden (fair bei langsamer Verbindung) – aber nie schneller als
 *  physikalisch möglich. */
function eingang(id, d, ankunft) {
  const s = z.spiel;
  if (!s || d.typ !== 'antwort' || s.phase !== 'frage' || d.i !== s.i) return;
  const p = s.spieler.get(id);
  if (!p || p.antworten[s.i]) return;
  const f = s.quiz.fragen[s.i];
  const T = f.zeit * 1000;
  const wahl = Number(d.wahl);
  if (!Number.isInteger(wahl) || wahl < 0 || wahl >= f.optionen.length) return;
  let ms = Number(d.ms);
  if (!Number.isFinite(ms)) ms = T;
  const unterwegs = (Number(ankunft) || Date.now()) - s.gesendetUm;
  ms = Math.max(ms, unterwegs - (p.quelle === 'campus' ? 8000 : 4000));
  ms = Math.min(Math.max(0, ms), T);
  p.antworten[s.i] = { wahl, ms };
  const n = document.getElementById('beantwortet');
  if (n) n.textContent = beantwortetText();
  if (alleDa()) schliessenBald();
}

const alleDa = () => {
  const a = aktiv();
  return a.length > 0 && a.every((p) => p.antworten[z.spiel.i]);
};

function beantwortetText() {
  const a = aktiv();
  return `${a.filter((p) => p.antworten[z.spiel.i]).length} von ${a.length} haben geantwortet`;
}

function spielStarten() {
  const s = z.spiel;
  if (!s || !aktiv().length) return;
  s.quiz.gespielt = (s.quiz.gespielt || 0) + 1;
  quizSichern(s.quiz);
  frageStarten(0);
}

function frageStarten(i) {
  const s = z.spiel;
  clearInterval(s.takt);
  s.i = i;
  s.phase = 'frage';
  s.gesendetUm = Date.now();
  const f = s.quiz.fragen[i];
  s.ende = s.gesendetUm + f.zeit * 1000;
  s.schliessenGeplant = false;
  anAlle(frageNachricht(false));
  z.ansicht = 'frage';
  ton('frage');
  zeichnen();
  s.takt = setInterval(() => {
    const rest = Math.max(0, s.ende - Date.now());
    const el = document.getElementById('restzeit');
    if (el) el.textContent = String(Math.ceil(rest / 1000));
    const ring = document.getElementById('zeitring');
    if (ring) ring.style.setProperty('--anteil', String(rest / (f.zeit * 1000)));
    // Kurz nachwarten: Antworten aus der letzten Sekunde sind noch unterwegs
    if (Date.now() >= s.ende + 1500) schliessen();
  }, 200);
}

function schliessenBald() {
  const s = z.spiel;
  if (s.schliessenGeplant) return;
  s.schliessenGeplant = true;
  setTimeout(() => z.spiel === s && schliessen(), 600);
}

function rangliste() {
  return [...z.spiel.spieler.values()].sort((a, b) => b.punkte - a.punkte || a.zeitSumme - b.zeitSumme || a.name.localeCompare(b.name));
}

function standKarte(rang) {
  const stand = {};
  rang.forEach((p, k) => {
    stand[p.id] = { gesamt: p.punkte, delta: p.letzt ? p.letzt.delta : 0, korrekt: p.letzt ? p.letzt.korrekt : false, beantwortet: p.letzt ? p.letzt.beantwortet : false, serie: p.serie, platz: k + 1, richtigGesamt: p.richtig };
  });
  return stand;
}

function schliessen() {
  const s = z.spiel;
  if (!s || s.phase !== 'frage') return;
  clearInterval(s.takt);
  s.phase = 'aufloesung';
  const f = s.quiz.fragen[s.i];
  const T = f.zeit * 1000;
  const verteilung = f.optionen.map(() => 0);
  for (const p of s.spieler.values()) {
    const a = p.antworten[s.i];
    if (a) verteilung[a.wahl]++;
    const korrekt = !!a && a.wahl === f.richtig;
    let delta = 0;
    if (korrekt) {
      p.serie++;
      // Bis 1000 Punkte, je schneller desto mehr (mindestens 500) – dazu ein Bonus für Serien
      delta = Math.round(1000 * (1 - a.ms / T / 2)) + (p.serie >= 2 ? Math.min(500, (p.serie - 1) * 100) : 0);
      p.richtig++;
      p.zeitSumme += a.ms;
    } else {
      p.serie = 0;
    }
    p.punkte += delta;
    p.letzt = { korrekt, delta, beantwortet: !!a };
  }
  const rang = rangliste();
  s.verteilung = verteilung;
  anAlle({ typ: 'aufloesung', i: s.i, richtig: f.richtig, richtigText: f.optionen[f.richtig], wissenswert: f.wissenswert, verteilung, stand: standKarte(rang), spieler: rang.length });
  z.ansicht = 'aufloesung';
  ton('aufloesung');
  zeichnen();
}

function weiter() {
  const s = z.spiel;
  if (z.ansicht === 'aufloesung') { z.ansicht = 'rangliste'; return zeichnen(); }
  if (s.i + 1 < s.quiz.fragen.length) return frageStarten(s.i + 1);
  spielEnde();
}

async function spielEnde() {
  const s = z.spiel;
  clearInterval(s.takt);
  s.phase = 'ende';
  const rang = rangliste();
  const podium = rang.slice(0, 3).map((p) => ({ name: p.name, punkte: p.punkte }));
  anAlle({ typ: 'ende', podium, stand: standKarte(rang), spieler: rang.length });
  const runde = { id: s.id, quiz: s.quiz.titel, zeit: lyra.jetzt(), fragen: s.quiz.fragen.length, rangliste: rang.map((p) => ({ name: p.name, punkte: p.punkte, richtig: p.richtig, quelle: p.quelle })) };
  try { await lyra.speicher.schreiben('runden/' + s.id, runde); } catch (_) {}
  z.runden.unshift(runde);
  z.ansicht = 'ende';
  ton('ende');
  konfetti(140);
  zeichnen();
}

async function spielBeenden() {
  const s = z.spiel;
  if (!s) return;
  clearInterval(s.takt);
  if (s.phase !== 'ende') anAlle({ typ: 'vorbei' });
  try { await lyra.gaeste.beenden(); } catch (_) {}
  z.spiel = null;
  z.ansicht = 'start';
  await quizzeLaden();
  zeichnen();
}

function csvSichern() {
  const rang = rangliste();
  const zeilen = [['Platz', 'Name', 'Punkte', 'Richtig', 'Über'].join(';'),
    ...rang.map((p, i) => [i + 1, `"${p.name.replace(/"/g, '""')}"`, p.punkte, `${p.richtig}/${z.spiel.quiz.fragen.length}`, p.quelle === 'campus' ? 'Campus' : 'Link'].join(';'))];
  lyra.speichern(`Quizzard Online – ${z.spiel.quiz.titel}.csv`, '﻿' + zeilen.join('\n')).catch(() => {});
}

// ================================================================== Mitspielen mit Lyra (aus einem Campus-Raum)

async function spielerStarten(k) {
  z.ansicht = 'spieler';
  app.replaceChildren();
  z.spielerAnsicht = QOSpieler.erstellen(app, {
    ich: { id: k.ich.id, name: k.ich.name },
    senden: (d) => lyra.campus.anHost(d, 'Deine Antworten in der Live-Runde').catch((e) => {
      if (abgebrochen(e)) z.spielerAnsicht.empfangen({ typ: 'vorbei' });
    }),
  });
  z.spielerAnsicht.empfangen({ typ: 'lobby', titel: (k.inhalt.daten && k.inhalt.daten.titel) || k.inhalt.titel, anzahl: k.inhalt.daten && k.inhalt.daten.anzahl });
  try {
    z.daZuletzt = Date.now();
    await lyra.campus.anHost({ typ: 'da' }, 'Deine Teilnahme an der Live-Runde');
  } catch (e) {
    z.spielerAnsicht.empfangen({ typ: 'vorbei' });
    if (!abgebrochen(e)) lyra.toast(meldung(e), 'fehler');
  }
}

// ================================================================== Töne, Konfetti

let audio = null;
function ton(art) {
  try {
    audio = audio || new AudioContext();
    const noten = { frage: [523, 659], aufloesung: [659, 784], ende: [523, 659, 784, 1047] }[art] || [440];
    noten.forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const t = audio.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
  } catch (_) {}
}

function konfetti(viel = 90) {
  const farben = ['#ef4565', '#3d7bfd', '#f5a524', '#1fb978', '#a855f7', '#fde047'];
  for (let i = 0; i < viel; i++) {
    const k = document.createElement('div');
    k.className = 'konfetti';
    k.style.left = Math.random() * 100 + 'vw';
    k.style.background = farben[i % farben.length];
    k.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
    k.style.animationDelay = Math.random() * 0.5 + 's';
    document.body.appendChild(k);
    setTimeout(() => k.remove(), 4500);
  }
}

// ================================================================== Ansichten

function zeichnen() {
  if (z.ansicht === 'spieler') return;
  const ansicht = { start: startAnsicht, zaubern: zauberAnsicht, bearbeiten: bearbeitenAnsicht, lobby: lobbyAnsicht, frage: frageAnsicht, aufloesung: aufloesungAnsicht, rangliste: ranglistenAnsicht, ende: endeAnsicht }[z.ansicht] || startAnsicht;
  app.replaceChildren(h('div', { class: 'buehne' + (z.spiel ? ' im-spiel' : '') }, ansicht()));
}

function pille(titel, optionen, schluessel) {
  return lyra.auswahl({ titel, optionen, wert: z.einst[schluessel], beiWahl: (w) => { z.einst[schluessel] = isNaN(Number(w)) ? w : Number(w); zeichnen(); } });
}

function startAnsicht() {
  const k = z.kontext;
  const leite = k && k.inhalt && k.inhalt.typ === TYP;
  return [
    h('div', { class: 'logo' }, 'Quizzard Online'),
    h('p', { class: 'slogan' }, 'Ein Quiz, alle gleichzeitig – wer schneller richtig liegt, holt mehr Punkte.'),
    leite ? h('div', { class: 'hinweis-band' }, `Live-Runde in „${k.raum.name}“: Wähle unten ein Quiz und öffne die Lobby – die Mitglieder spielen mit ihrer Lyra mit.`) : null,
    h('div', { class: 'panel' },
      h('h2', {}, '✨ Neues Quiz mit KI'),
      h('div', { class: 'zeile', style: { gap: '10px' } },
        h('input', {
          class: 'eingabe wachsen', placeholder: 'Thema, z. B. „Photosynthese“ oder „Französische Revolution“', value: z.thema,
          oninput: (e) => { z.thema = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') erstellen(); },
        }),
        h('button', { class: 'knopf', onclick: erstellen }, 'Erstellen')),
      h('div', { class: 'zeile umbruch', style: { gap: '8px', marginTop: '12px' } },
        pille('Fragen', [[5, '5'], [8, '8'], [10, '10'], [15, '15'], [20, '20']], 'anzahl'),
        pille('Zeit je Frage', [[10, '10 s'], [20, '20 s'], [30, '30 s'], [45, '45 s'], [60, '60 s']], 'zeit'),
        pille('Woraus', [['beides', 'Unterlagen + Wissen'], ['unterlagen', 'Nur Unterlagen'], ['wissen', 'Allgemeinwissen']], 'quelle'),
        pille('Schwierigkeit', [['leicht', 'Leicht'], ['gemischt', 'Gemischt'], ['schwer', 'Schwer']], 'schwierigkeit'),
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null),
      z.fehler ? h('div', { style: { marginTop: '12px' } }, lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); })) : null,
      h('button', { class: 'knopf text', style: { marginTop: '8px' }, onclick: () => neuesLeeresQuiz() }, 'Oder selbst Fragen schreiben →')),
    h('h2', { class: 'zwischen' }, 'Deine Quizze'),
    z.quizze.length
      ? h('div', { class: 'liste' }, z.quizze.map((q) => h('div', { class: 'quiz-zeile' },
        h('div', { class: 'wachsen', onclick: () => { z.quiz = q; z.ansicht = 'bearbeiten'; zeichnen(); } },
          h('div', { class: 'quiz-titel' }, q.titel),
          h('div', { class: 'leise klein' }, `${q.fragen.length} Fragen${q.gespielt ? ` · ${q.gespielt}× gespielt` : ''}`)),
        h('button', { class: 'knopf tonal', title: 'Bearbeiten', onclick: () => { z.quiz = q; z.ansicht = 'bearbeiten'; zeichnen(); } }, '✏️'),
        h('button', { class: 'knopf tonal', title: 'Löschen', onclick: () => quizLoeschen(q) }, '🗑'),
        h('button', { class: 'knopf', onclick: () => lobbyOeffnen(q, { campus: leite }) }, 'Live spielen ▶'))))
      : h('p', { class: 'leise' }, 'Noch keine Quizze – erstelle oben das erste.'),
    z.runden.length ? h('h2', { class: 'zwischen' }, 'Letzte Runden') : null,
    z.runden.length ? h('div', { class: 'liste' }, z.runden.map((r) => h('div', { class: 'quiz-zeile' },
      h('div', { class: 'wachsen' },
        h('div', { class: 'quiz-titel' }, `🏆 ${(r.rangliste[0] && r.rangliste[0].name) || '–'}`),
        h('div', { class: 'leise klein' }, `${r.quiz} · ${r.rangliste.length} Mitspielende · ${lyra.zeitText(r.zeit)}`))))) : null,
  ];
}

async function quizLoeschen(q) {
  const ok = await lyra.bestaetigen({ titel: `„${q.titel}“ löschen?`, text: 'Das Quiz verschwindet mit allen Fragen.', ja: 'Löschen', gefahr: true });
  if (!ok) return;
  try { await lyra.speicher.loeschen('quiz/' + q.id); } catch (_) {}
  z.quizze = z.quizze.filter((x) => x.id !== q.id);
  zeichnen();
}

function neuesLeeresQuiz() {
  z.quiz = { id: lyra.neueId(), titel: z.thema.trim() || 'Mein Quiz', fragen: [], erstellt: lyra.jetzt(), gespielt: 0 };
  z.thema = '';
  z.ansicht = 'bearbeiten';
  zeichnen();
  frageBearbeiten(null);
}

function zauberAnsicht() {
  return h('div', { class: 'mitte' },
    h('div', { class: 'zauber' }, '🧙'),
    h('h2', {}, 'Der Quizzard zaubert …'),
    h('p', { class: 'leise', id: 'hinweis' }, z.hinweis),
    h('button', { class: 'knopf text', onclick: () => lyra.abbrechen() }, 'Abbrechen'));
}

function bearbeitenAnsicht() {
  const q = z.quiz;
  return [
    h('div', { class: 'zeile', style: { gap: '10px', marginBottom: '14px' } },
      h('button', { class: 'knopf tonal', onclick: () => { z.ansicht = 'start'; z.quiz = null; zeichnen(); } }, '←'),
      h('input', { class: 'eingabe wachsen titel-eingabe', value: q.titel, onchange: (e) => { q.titel = e.target.value.trim() || q.titel; quizSichern(q); } }),
      h('button', { class: 'knopf', disabled: q.fragen.length < 1, onclick: () => lobbyOeffnen(q, { campus: !!(z.kontext && z.kontext.inhalt && z.kontext.inhalt.typ === TYP) }) }, 'Live spielen ▶')),
    h('p', { class: 'leise klein' }, `${q.fragen.length} Fragen · Prüfe sie vor dem Spiel – tippe auf eine Frage, um sie zu ändern.`),
    h('div', { class: 'liste' }, q.fragen.map((f, i) => h('div', { class: 'frage-karte', onclick: () => frageBearbeiten(i) },
      h('div', { class: 'zeile', style: { gap: '10px', alignItems: 'flex-start' } },
        h('span', { class: 'nr' }, String(i + 1)),
        h('div', { class: 'wachsen' },
          h('div', { class: 'fett' }, f.frage),
          h('div', { class: 'optionen-mini' }, f.optionen.map((o, j) => h('span', { class: `opt ${FARBEN[j]}${j === f.richtig ? ' richtig' : ''}` }, `${FORMEN[j]} ${o}`)))),
        h('span', { class: 'leise klein' }, `${f.zeit} s`),
        h('div', { class: 'spalte', style: { gap: '4px' } },
          i > 0 ? h('button', { class: 'knopf symbol', title: 'Nach oben', onclick: (e) => { e.stopPropagation(); [q.fragen[i - 1], q.fragen[i]] = [q.fragen[i], q.fragen[i - 1]]; quizSichern(q); zeichnen(); } }, '↑') : null,
          h('button', { class: 'knopf symbol', title: 'Löschen', onclick: (e) => { e.stopPropagation(); q.fragen.splice(i, 1); quizSichern(q); zeichnen(); } }, '✕')))))),
    h('button', { class: 'knopf tonal', style: { marginTop: '12px' }, onclick: () => frageBearbeiten(null) }, '+ Frage hinzufügen'),
  ];
}

async function frageBearbeiten(i) {
  const q = z.quiz;
  const f = i == null ? { frage: '', optionen: ['', '', '', ''], richtig: 0, zeit: z.einst.zeit, wissenswert: '' } : structuredClone(q.fragen[i]);
  while (f.optionen.length < 4) f.optionen.push('');
  const box = h('div', { class: 'spalte', style: { minWidth: '520px', gap: '10px' } });
  const malen = () => box.replaceChildren(
    h('textarea', { class: 'eingabe', rows: 2, placeholder: 'Die Frage', value: f.frage, oninput: (e) => { f.frage = e.target.value; } }),
    ...f.optionen.map((o, j) => h('div', { class: 'zeile', style: { gap: '8px' } },
      h('button', { class: `richtig-wahl ${FARBEN[j]}${f.richtig === j ? ' an' : ''}`, title: 'Diese ist richtig', onclick: () => { f.richtig = j; malen(); } }, f.richtig === j ? '✓' : FORMEN[j]),
      h('input', { class: 'eingabe wachsen', value: o, placeholder: j < 2 ? `Antwort ${j + 1}` : `Antwort ${j + 1} (optional)`, oninput: (e) => { f.optionen[j] = e.target.value; } }))),
    h('div', { class: 'zeile umbruch', style: { gap: '8px' } },
      lyra.auswahl({ titel: 'Zeit', optionen: [[10, '10 s'], [20, '20 s'], [30, '30 s'], [45, '45 s'], [60, '60 s'], [90, '90 s']], wert: f.zeit, beiWahl: (w) => { f.zeit = Number(w); } })),
    h('input', { class: 'eingabe', value: f.wissenswert || '', placeholder: 'Erklärung nach der Auflösung (optional)', oninput: (e) => { f.wissenswert = e.target.value; } }),
    h('p', { class: 'leise klein' }, 'Tippe links auf das Zeichen der richtigen Antwort.'));
  malen();
  const ok = await lyra.dialog(i == null ? 'Neue Frage' : `Frage ${i + 1}`, box, [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Speichern', wert: true }]);
  if (!ok) return;
  const optionen = f.optionen.map(text);
  const gefuellt = optionen.map((o, j) => [o, j]).filter(([o]) => o);
  if (!text(f.frage) || gefuellt.length < 2 || !optionen[f.richtig]) {
    lyra.toast('Eine Frage braucht Text, mindestens zwei Antworten und eine richtige.', 'fehler');
    return;
  }
  const neu = { frage: text(f.frage), optionen: gefuellt.map(([o]) => o), richtig: gefuellt.findIndex(([, j]) => j === f.richtig), zeit: f.zeit, wissenswert: text(f.wissenswert) };
  if (i == null) q.fragen.push(neu); else q.fragen[i] = neu;
  await quizSichern(q);
  zeichnen();
}

function spielerChips() {
  const s = z.spiel;
  const l = aktiv();
  if (!l.length) return h('p', { class: 'leise warte-text' }, 'Warte auf Mitspielende …');
  return h('div', { class: 'chips' }, l.map((p) => h('button', { class: 'spieler-chip', title: 'Entfernen', onclick: () => spielerEntfernen(p) }, `${p.quelle === 'campus' ? '👥 ' : ''}${p.name}`)));
}

function lobbyAnsicht() {
  const s = z.spiel;
  const g = s.gaeste;
  return [
    h('div', { class: 'zeile', style: { gap: '10px', marginBottom: '6px' } },
      h('div', { class: 'wachsen' }, h('div', { class: 'leise klein' }, 'Lobby'), h('h1', { class: 'spiel-titel' }, s.quiz.titel)),
      h('button', { class: 'knopf text', onclick: () => zurueck() }, 'Abbrechen')),
    h('div', { class: 'lobby-raster' },
      h('div', { class: 'panel beitritt' },
        h('h2', {}, '📱 Mit Link oder QR-Code'),
        h('p', { class: 'leise klein' }, 'Von überall, im Browser – ohne Lyra, ohne Konto. Ende-zu-Ende-verschlüsselt.'),
        g ? h('div', { class: 'qr-box' },
          g.qr ? h('img', { class: 'qr', src: g.qr, alt: 'QR-Code zum Mitspielen' }) : null,
          h('div', { class: 'link-zeile' },
            h('code', { class: 'link' }, g.url.replace(/^https:\/\//, '').replace(/#.*$/, '#…')),
            h('button', { class: 'knopf tonal klein', onclick: () => lyra.kopieren(g.url) }, 'Link kopieren')))
          : s.gaesteLaedt ? h('div', { class: 'leise', style: { padding: '30px 0' } }, h('div', { class: 'lade' }), ' Spielseite wird geöffnet …')
            : h('div', {}, s.gaesteFehler ? h('p', { class: 'fehler-text' }, s.gaesteFehler) : null, h('button', { class: 'knopf', onclick: gaesteOeffnen }, 'Spielseite öffnen'))),
      h('div', { class: 'panel' },
        h('h2', {}, '👥 Mit Lyra über Campus'),
        s.campus
          ? h('p', { class: 'leise klein' }, `Live in „${s.campus.raum.name}“ – die Mitglieder öffnen die Runde in ihrem Campus und spielen mit.`)
          : [h('p', { class: 'leise klein' }, 'Teile die Runde in einen Campus-Raum – die Mitglieder spielen mit ihrer Lyra mit.'),
            h('button', { class: 'knopf tonal', onclick: campusTeilen }, 'In einen Raum teilen …')],
        h('h2', { style: { marginTop: '18px' } }, `Dabei: ${aktiv().length}`),
        spielerChips())),
    h('div', { class: 'mitte', style: { marginTop: '18px' } },
      h('button', { class: 'knopf riesig', disabled: !aktiv().length, onclick: spielStarten }, `Spiel starten ▶ (${s.quiz.fragen.length} Fragen)`),
      h('p', { class: 'leise klein' }, 'Du bist Host und spielst nicht mit – zeig diesen Bildschirm am besten groß für alle.')),
  ];
}

function kopfzeile() {
  const s = z.spiel;
  return h('div', { class: 'leiste-oben' },
    h('span', { class: 'pill' }, `Frage ${s.i + 1} / ${s.quiz.fragen.length}`),
    h('span', { class: 'wachsen' }),
    s.gaeste ? h('span', { class: 'pill leise', title: s.gaeste.url }, '📱 Link offen') : null,
    s.campus ? h('span', { class: 'pill leise' }, `👥 ${s.campus.raum.name}`) : null,
    h('span', { class: 'pill' }, `${aktiv().length} dabei`));
}

function frageAnsicht() {
  const s = z.spiel;
  const f = s.quiz.fragen[s.i];
  const rest = Math.max(0, s.ende - Date.now());
  return [
    kopfzeile(),
    h('div', { class: 'frage-gross' }, f.frage),
    h('div', { class: 'zeile', style: { justifyContent: 'center', gap: '24px', margin: '8px 0 18px' } },
      h('div', { class: 'zeitring', id: 'zeitring', style: { '--anteil': String(rest / (f.zeit * 1000)) } }, h('span', { id: 'restzeit' }, String(Math.ceil(rest / 1000)))),
      h('div', { class: 'leise', id: 'beantwortet' }, beantwortetText())),
    h('div', { class: `host-kacheln n${f.optionen.length}` }, f.optionen.map((o, i) => h('div', { class: `host-kachel ${FARBEN[i]}` }, h('span', { class: 'form' }, FORMEN[i]), h('span', {}, o)))),
    h('div', { class: 'mitte', style: { marginTop: '16px' } }, h('button', { class: 'knopf tonal', onclick: schliessen }, 'Jetzt auflösen')),
  ];
}

function aufloesungAnsicht() {
  const s = z.spiel;
  const f = s.quiz.fragen[s.i];
  const max = Math.max(1, ...s.verteilung);
  const richtigAnz = s.verteilung[f.richtig] || 0;
  return [
    kopfzeile(),
    h('div', { class: 'frage-gross klein' }, f.frage),
    h('div', { class: 'verteilung' }, f.optionen.map((o, i) => h('div', { class: `saeule ${FARBEN[i]}${i === f.richtig ? ' richtig' : ' falsch'}` },
      h('div', { class: 'saeule-zahl' }, String(s.verteilung[i])),
      h('div', { class: 'saeule-balken', style: { height: `${20 + 140 * (s.verteilung[i] / max)}px` } }),
      h('div', { class: 'saeule-text' }, `${FORMEN[i]} ${o}${i === f.richtig ? ' ✓' : ''}`)))),
    h('p', { class: 'mitte fett' }, `${richtigAnz} von ${aktiv().length} lagen richtig`),
    f.wissenswert ? h('p', { class: 'mitte leise wissen' }, `💡 ${f.wissenswert}`) : null,
    h('div', { class: 'mitte', style: { marginTop: '14px' } }, h('button', { class: 'knopf riesig', onclick: weiter }, 'Rangliste →')),
  ];
}

function ranglistenAnsicht() {
  const s = z.spiel;
  const rang = rangliste();
  const letzte = s.i + 1 >= s.quiz.fragen.length;
  return [
    kopfzeile(),
    h('h1', { class: 'mitte' }, letzte ? 'Vor dem Finale' : 'Zwischenstand'),
    h('div', { class: 'rangliste' }, rang.slice(0, 5).map((p, i) => h('div', { class: 'rang-zeile' + (i === 0 ? ' erster' : '') },
      h('span', { class: 'platz' }, String(i + 1)),
      h('span', { class: 'wachsen name' }, p.name),
      p.serie >= 2 ? h('span', { class: 'serie' }, `🔥 ${p.serie}`) : null,
      p.letzt && p.letzt.delta ? h('span', { class: 'delta' }, `+${zahl(p.letzt.delta)}`) : null,
      h('span', { class: 'gesamt' }, zahl(p.punkte))))),
    rang.length > 5 ? h('p', { class: 'mitte leise klein' }, `… und ${rang.length - 5} weitere`) : null,
    h('div', { class: 'mitte', style: { marginTop: '16px' } }, h('button', { class: 'knopf riesig', onclick: weiter }, letzte ? 'Zum Endstand 🏆' : 'Nächste Frage →')),
  ];
}

function endeAnsicht() {
  const rang = rangliste();
  const podium = rang.slice(0, 3);
  return [
    h('div', { class: 'logo klein' }, 'Gewonnen hat …'),
    podium[0] ? h('h1', { class: 'gewinner' }, `🏆 ${podium[0].name}`) : h('h1', { class: 'mitte' }, 'Niemand hat mitgespielt'),
    h('div', { class: 'podium' }, podium.map((p, i) => h('div', { class: `stufe s${i + 1}` },
      h('div', { class: 'stufe-name' }, p.name),
      h('div', { class: 'stufe-punkte' }, `${zahl(p.punkte)} P. · ${p.richtig}/${z.spiel.quiz.fragen.length}`),
      h('div', { class: 'stufe-block' }, String(i + 1))))),
    rang.length > 3 ? h('div', { class: 'rangliste klein' }, rang.slice(3).map((p, i) => h('div', { class: 'rang-zeile' },
      h('span', { class: 'platz' }, String(i + 4)), h('span', { class: 'wachsen name' }, p.name), h('span', { class: 'gesamt' }, zahl(p.punkte))))) : null,
    h('div', { class: 'zeile', style: { justifyContent: 'center', gap: '10px', marginTop: '20px' } },
      h('button', { class: 'knopf tonal', onclick: csvSichern }, 'Ergebnisse als CSV'),
      h('button', { class: 'knopf tonal', onclick: () => { const q = z.spiel.quiz; const campus = !!z.spiel.campus; const g = z.spiel.gaeste; nochmal(q, campus, g); } }, 'Nochmal spielen'),
      h('button', { class: 'knopf', onclick: spielBeenden }, 'Fertig')),
  ];
}

/** Gleiches Quiz, gleiche Leute: Spielseite und Campus bleiben offen. */
function nochmal(q, campus, gaeste) {
  const alt = z.spiel;
  const spieler = new Map([...alt.spieler.values()].filter((p) => p.da).map((p) => [p.id, { ...p, punkte: 0, serie: 0, richtig: 0, zeitSumme: 0, antworten: {}, letzt: null }]));
  z.spiel = { ...alt, id: lyra.neueId(), i: -1, phase: 'lobby', spieler, gaeste, campus: campus ? alt.campus : null, takt: null };
  z.ansicht = 'lobby';
  anAlle(lobbyNachricht());
  zeichnen();
}

start();
