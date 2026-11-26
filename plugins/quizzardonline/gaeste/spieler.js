'use strict';
/*
 * Quizzard Online – Ansicht für Mitspielende. Dieselbe Ansicht im Browser (Spielseite im WLAN, ohne Lyra) und in Lyra
 * (über einen Campus-Raum). Ohne Abhängigkeiten; die Verbindung bringt der Aufrufer mit (senden, empfangen).
 *
 *   const s = QOSpieler.erstellen(wurzel, { senden: (daten) => …, ich: { id, name } });
 *   s.empfangen({ typ: 'lobby' | 'frage' | 'zu' | 'aufloesung' | 'ende' | 'entfernt', … });
 */
const QOSpieler = (() => {
  const FARBEN = ['rot', 'blau', 'gelb', 'gruen'];
  const FORMEN = ['▲', '◆', '●', '■'];
  const zahl = (n) => Math.round(n || 0).toLocaleString('de-DE');

  function el(tag, attr, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr || {})) {
      if (v == null || v === false) continue;
      if (k === 'onclick') e.addEventListener('click', v);
      else if (k === 'style') Object.assign(e.style, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kinder.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }

  function erstellen(wurzel, { senden, ich }) {
    const z = { phase: 'warten', titel: '', anzahl: 0, mitspieler: 0, frage: null, gewaehlt: null, t0: 0, ende: 0, takt: null, ergebnis: null, aufl: null, schluss: null };

    function stoppen() {
      if (z.takt) clearInterval(z.takt);
      z.takt = null;
    }

    function zeitLeiste() {
      const f = z.frage;
      const rest = Math.max(0, z.ende - performance.now());
      const anteil = f && f.zeit ? rest / (f.zeit * 1000) : 0;
      return el('div', { class: 'qo-zeit' }, el('div', { class: 'qo-zeit-bahn' }, el('div', { class: 'qo-zeit-balken', style: { width: `${Math.round(anteil * 100)}%` } })),
        el('span', { class: 'qo-zeit-zahl' }, String(Math.ceil(rest / 1000))));
    }

    function waehlen(i) {
      if (z.phase !== 'frage' || z.gewaehlt != null) return;
      z.gewaehlt = i;
      const ms = Math.max(0, Math.round(performance.now() - z.t0));
      try { navigator.vibrate && navigator.vibrate(30); } catch (_) {}
      Promise.resolve(senden({ typ: 'antwort', i: z.frage.i, wahl: i, ms })).catch(() => {});
      z.phase = 'gesendet';
      malen();
    }

    function malen() {
      let inhalt;
      const kopf = el('div', { class: 'qo-kopf' },
        el('span', { class: 'qo-marke' }, 'Quizzard Online'),
        el('span', { class: 'qo-name' }, ich && ich.name ? ich.name : ''),
        z.ergebnis && z.ergebnis.gesamt != null ? el('span', { class: 'qo-punkte' }, `${zahl(z.ergebnis.gesamt)} P.`) : null);
      switch (z.phase) {
        case 'warten':
          inhalt = el('div', { class: 'qo-mitte' },
            el('div', { class: 'qo-gross-symbol qo-schweben' }, '🎉'),
            el('h1', {}, `Du bist dabei${ich && ich.name ? ', ' + ich.name : ''}!`),
            z.titel ? el('p', { class: 'qo-titel' }, z.titel) : null,
            el('p', { class: 'qo-leise' }, z.anzahl ? `${z.anzahl} ${z.anzahl === 1 ? 'Frage' : 'Fragen'} · gleich geht es los` : 'Gleich geht es los – schau nach vorn.'),
            z.mitspieler ? el('p', { class: 'qo-leise' }, `${z.mitspieler} ${z.mitspieler === 1 ? 'Person ist' : 'Leute sind'} dabei`) : null,
            el('div', { class: 'qo-punkte-lauf' }, el('i'), el('i'), el('i')));
          break;
        case 'frage': {
          const f = z.frage;
          inhalt = el('div', { class: 'qo-frage-seite' },
            el('div', { class: 'qo-frage-kopf' }, el('span', { class: 'qo-pill' }, `Frage ${f.i + 1} von ${f.n}`), zeitLeiste()),
            el('h2', { class: 'qo-frage' }, f.frage),
            el('div', { class: `qo-kacheln n${f.optionen.length}` },
              f.optionen.map((o, i) => el('button', { class: `qo-kachel ${FARBEN[i]}`, onclick: () => waehlen(i) },
                el('span', { class: 'qo-form' }, FORMEN[i]), el('span', { class: 'qo-option' }, o)))));
          break;
        }
        case 'gesendet':
          inhalt = el('div', { class: 'qo-mitte' },
            el('div', { class: `qo-gewaehlt ${FARBEN[z.gewaehlt] || ''}` }, FORMEN[z.gewaehlt] || '✓'),
            el('h1', {}, 'Antwort ist raus!'),
            el('p', { class: 'qo-leise' }, 'Mal sehen, ob du richtig liegst …'),
            el('div', { class: 'qo-punkte-lauf' }, el('i'), el('i'), el('i')));
          break;
        case 'zu':
          inhalt = el('div', { class: 'qo-mitte' }, el('div', { class: 'qo-gross-symbol' }, '⏰'), el('h1', {}, 'Zeit um!'), el('p', { class: 'qo-leise' }, 'Gleich kommt die Auflösung.'));
          break;
        case 'aufloesung': {
          const e = z.ergebnis || {};
          const a = z.aufl || {};
          const richtig = e.korrekt === true;
          inhalt = el('div', { class: `qo-mitte qo-ergebnis ${richtig ? 'gut' : 'schlecht'}` },
            el('div', { class: 'qo-gross-symbol' }, richtig ? '✓' : e.beantwortet ? '✗' : '⏰'),
            el('h1', {}, richtig ? 'Richtig!' : e.beantwortet ? 'Leider falsch' : 'Keine Antwort'),
            richtig ? el('div', { class: 'qo-plus' }, `+${zahl(e.delta)}`) : null,
            e.serie >= 2 ? el('div', { class: 'qo-serie' }, `🔥 ${e.serie} richtig in Folge`) : null,
            !richtig && a.richtigText ? el('p', { class: 'qo-loesung' }, `Richtig war: ${a.richtigText}`) : null,
            e.platz ? el('p', { class: 'qo-platz' }, `Platz ${e.platz} von ${a.spieler || '?'} · ${zahl(e.gesamt)} Punkte`) : null,
            a.wissenswert ? el('p', { class: 'qo-leise qo-wissen' }, a.wissenswert) : null);
          break;
        }
        case 'ende': {
          const s = z.schluss || {};
          const e = z.ergebnis || {};
          const podium = s.podium || [];
          inhalt = el('div', { class: 'qo-mitte qo-ende' },
            el('div', { class: 'qo-gross-symbol' }, e.platz === 1 ? '🏆' : e.platz && e.platz <= 3 ? '🥳' : '🎉'),
            el('h1', {}, e.platz === 1 ? 'Du hast gewonnen!' : e.platz ? `Platz ${e.platz}` : 'Spiel vorbei'),
            e.gesamt != null ? el('p', { class: 'qo-platz' }, `${zahl(e.gesamt)} Punkte · ${e.richtigGesamt || 0} richtig`) : null,
            podium.length ? el('div', { class: 'qo-podium' }, podium.map((p, i) => el('div', { class: `qo-stufe s${i + 1}` },
              el('div', { class: 'qo-stufe-name' }, p.name), el('div', { class: 'qo-stufe-punkte' }, `${zahl(p.punkte)} P.`), el('div', { class: 'qo-stufe-block' }, String(i + 1))))) : null);
          break;
        }
        case 'entfernt':
          inhalt = el('div', { class: 'qo-mitte' }, el('div', { class: 'qo-gross-symbol' }, '👋'), el('h1', {}, 'Du bist nicht mehr dabei'), el('p', { class: 'qo-leise' }, 'Der Host hat dich aus dem Spiel genommen.'));
          break;
        case 'vorbei':
          inhalt = el('div', { class: 'qo-mitte' }, el('div', { class: 'qo-gross-symbol' }, '🏁'), el('h1', {}, 'Das Spiel ist vorbei'), el('p', { class: 'qo-leise' }, 'Danke fürs Mitspielen!'));
          break;
        default:
          inhalt = el('div');
      }
      wurzel.replaceChildren(el('div', { class: 'qo-spieler' }, kopf, inhalt));
    }

    function empfangen(d) {
      if (!d || typeof d !== 'object') return;
      switch (d.typ) {
        case 'lobby':
          z.titel = d.titel || z.titel;
          z.anzahl = d.anzahl || z.anzahl;
          z.mitspieler = d.spieler || 0;
          if (z.phase !== 'frage' && z.phase !== 'gesendet') { stoppen(); z.phase = 'warten'; }
          break;
        case 'frage':
          stoppen();
          z.frage = d;
          z.gewaehlt = null;
          // Wer mitten in die Frage kommt, bekommt nur die restliche Zeit
          z.t0 = performance.now() - (d.vergangen || 0);
          z.ende = z.t0 + d.zeit * 1000;
          z.phase = 'frage';
          z.takt = setInterval(() => {
            const zl = wurzel.querySelector('.qo-zeit');
            if (zl) zl.replaceWith(zeitLeiste());
            if (performance.now() >= z.ende && z.phase === 'frage') { stoppen(); z.phase = 'zu'; malen(); }
          }, 200);
          break;
        case 'zu':
          if (z.phase === 'frage') { stoppen(); z.phase = 'zu'; }
          break;
        case 'aufloesung':
          stoppen();
          z.aufl = d;
          z.ergebnis = (d.stand && ich && d.stand[ich.id]) || { beantwortet: false, gesamt: z.ergebnis && z.ergebnis.gesamt };
          z.phase = 'aufloesung';
          break;
        case 'ende':
          stoppen();
          z.schluss = d;
          if (d.stand && ich && d.stand[ich.id]) z.ergebnis = d.stand[ich.id];
          z.phase = 'ende';
          break;
        case 'entfernt':
          stoppen();
          z.phase = 'entfernt';
          break;
        case 'vorbei':
          stoppen();
          z.phase = 'vorbei';
          break;
        default:
          return;
      }
      malen();
    }

    malen();
    return { empfangen, ich: (x) => { ich = x; malen(); } };
  }

  return { erstellen, FARBEN, FORMEN };
})();
