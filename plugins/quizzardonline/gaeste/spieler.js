'use strict';
/*
 * Quizzard Online – Ansicht für Mitspielende (schlicht, hell oder dunkel wie das Gerät). Dieselbe Ansicht im Browser (Spielseite, ohne Lyra) und in
 * Lyra (über einen Campus-Raum). Ohne Abhängigkeiten; die Verbindung bringt der Aufrufer mit (senden, empfangen).
 *
 *   const s = QOSpieler.erstellen(wurzel, { senden: (daten) => …, ich: { id, name }, bild: (id) => dataUrl|null });
 *   s.empfangen({ typ: 'lobby' | 'frage' | 'zu' | 'aufloesung' | 'ende' | 'entfernt' | 'vorbei', … });
 *
 * Fragetypen wie im Offline-Quizzard: auswahl, mehrfach, wahrfalsch, bild (antippen bzw. ankreuzen), schaetzen (Regler),
 * reihenfolge (ordnen), zuordnen (Paare), luecke (eintippen). Die Lösung kennt nur der Host.
 */
const QOSpieler = (() => {
  /** Buchstaben der Antworten (die Töne bleiben als Klassen, der schlichte Stil nutzt sie nicht) */
  const ZEICHEN = ['A', 'B', 'C', 'D', 'E', 'F'];
  const TOENE = ['amethyst', 'smaragd', 'saphir', 'bernstein', 'rose', 'tuerkis'];
  const zahl = (n) => Math.round(n || 0).toLocaleString('de-DE');
  const fmt = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100).toLocaleString('de-DE');

  function el(tag, attr, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'style') Object.assign(e.style, v);
      else if (k === 'value') e.value = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kinder.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }

  /** Restzeit: schmaler Balken mit Sekunden. */
  function zeitAnzeige(anteil, sekunden, gross = false) {
    return el('div', { class: 'qo-zeit' + (gross ? ' gross' : '') + (anteil < 0.25 ? ' knapp' : '') },
      el('div', { class: 'qo-zeit-bahn' }, el('div', { class: 'qo-zeit-balken', style: { width: `${Math.max(0, Math.min(1, anteil)) * 100}%` } })),
      el('b', {}, String(sekunden)));
  }

  function erstellen(wurzel, { senden, ich, bild }) {
    const z = { phase: 'warten', titel: '', anzahl: 0, mitspieler: 0, frage: null, t0: 0, ende: 0, takt: null, ergebnis: null, aufl: null, schluss: null, eingabe: null };

    function stoppen() {
      if (z.takt) clearInterval(z.takt);
      z.takt = null;
    }

    function uhr() {
      const f = z.frage;
      const rest = Math.max(0, z.ende - performance.now());
      return zeitAnzeige(f && f.zeit ? rest / (f.zeit * 1000) : 0, Math.ceil(rest / 1000));
    }

    /** Antwort abschicken – je Fragetyp eine andere Form (siehe Kopf). */
    function abschicken(antwort) {
      if (z.phase !== 'frage') return;
      const ms = Math.max(0, Math.round(performance.now() - z.t0));
      try { navigator.vibrate && navigator.vibrate(25); } catch (_) {}
      Promise.resolve(senden({ typ: 'antwort', i: z.frage.i, antwort, ms })).catch(() => {});
      z.gesendet = antwort;
      z.phase = 'gesendet';
      malen();
    }

    function foto(f) {
      const daten = f.bild || (f.bildId && bild ? bild(f.bildId) : null);
      if (!daten) return null;
      const n = f.bildNachweis || {};
      return el('figure', { class: 'qo-foto' }, el('img', { src: daten, alt: 'Foto zur Frage' }),
        el('figcaption', {}, `Foto: ${n.urheber || 'unbekannt'}${n.lizenz ? ' · ' + n.lizenz : ''} · Wikimedia Commons`));
    }

    function karte(i, text, beiTipp, an = false) {
      return el('button', { class: `qo-karte ${TOENE[i % TOENE.length]}${an ? ' an' : ''}`, type: 'button', onclick: beiTipp },
        el('span', { class: 'qo-siegel' }, ZEICHEN[i % ZEICHEN.length]), el('span', { class: 'qo-karte-text' }, text));
    }

    function knopf(text, beiTipp, aus = false) {
      return el('button', { class: 'qo-knopf', type: 'button', disabled: aus, onclick: beiTipp }, text);
    }

    function eingabeFuer(f) {
      const e = z.eingabe;
      switch (f.art) {
        case 'mehrfach':
          return [
            el('p', { class: 'qo-hinweis' }, 'Mehrere sind richtig – wähle alle, dann „Abgeben“.'),
            el('div', { class: 'qo-karten' }, f.optionen.map((o, i) => karte(i, o, () => { e.has(i) ? e.delete(i) : e.add(i); malen(); }, e.has(i)))),
            knopf('Abgeben', () => abschicken([...e].sort()), !e.size),
          ];
        case 'schaetzen': {
          const schritt = f.schritt || 1;
          return [
            el('div', { class: 'qo-schaetz-wert' }, `${fmt(e.wert)}${f.einheit ? ' ' + f.einheit : ''}`),
            el('input', { class: 'qo-regler', type: 'range', min: f.min, max: f.max, step: schritt, value: e.wert, oninput: (ev) => { e.wert = Number(ev.target.value); e.bewegt = true; const w = wurzel.querySelector('.qo-schaetz-wert'); if (w) w.textContent = `${fmt(e.wert)}${f.einheit ? ' ' + f.einheit : ''}`; } }),
            el('div', { class: 'qo-regler-grenzen' }, el('span', {}, fmt(f.min)), el('span', {}, fmt(f.max))),
            knopf('Abgeben', () => abschicken(e.wert)),
          ];
        }
        case 'reihenfolge':
          return [
            el('p', { class: 'qo-hinweis' }, 'Bring es in die richtige Reihenfolge – mit den Pfeilen.'),
            el('ol', { class: 'qo-ordnen' }, e.map((k, pos) => el('li', { class: `qo-ordnen-zeile ${TOENE[k % TOENE.length]}` },
              el('span', { class: 'qo-siegel klein' }, String(pos + 1)),
              el('span', { class: 'qo-karte-text' }, f.optionen[k]),
              el('span', { class: 'qo-pfeile' },
                el('button', { type: 'button', disabled: pos === 0, 'aria-label': 'nach oben', onclick: () => { [e[pos - 1], e[pos]] = [e[pos], e[pos - 1]]; malen(); } }, '▲'),
                el('button', { type: 'button', disabled: pos === e.length - 1, 'aria-label': 'nach unten', onclick: () => { [e[pos + 1], e[pos]] = [e[pos], e[pos + 1]]; malen(); } }, '▼'))))),
            knopf('Abgeben', () => abschicken(e.slice())),
          ];
        case 'zuordnen':
          return [
            el('p', { class: 'qo-hinweis' }, 'Was gehört zusammen?'),
            el('div', { class: 'qo-paare' }, f.links.map((l, i) => el('label', { class: `qo-paar ${TOENE[i % TOENE.length]}` },
              el('span', { class: 'qo-paar-links' }, l),
              el('select', { class: 'qo-auswahl', onchange: (ev) => { e[i] = Number(ev.target.value); malen(); } },
                el('option', { value: '-1' }, '— wählen —'),
                f.rechts.map((r, j) => { const o = el('option', { value: String(j) }, r); if (e[i] === j) o.selected = true; return o; }))))),
            knopf('Abgeben', () => abschicken(e.slice()), e.some((x) => x < 0)),
          ];
        case 'luecke': {
          const feld = el('input', { class: 'qo-eingabe', placeholder: 'Deine Antwort', autocomplete: 'off', autocapitalize: 'off', enterkeyhint: 'send', value: e.text,
            oninput: (ev) => { e.text = ev.target.value; }, onkeydown: (ev) => { if (ev.key === 'Enter' && e.text.trim()) abschicken(e.text.trim()); } });
          setTimeout(() => feld.focus(), 30);
          return [feld, knopf('Abgeben', () => e.text.trim() && abschicken(e.text.trim()))];
        }
        default: // auswahl, wahrfalsch, bild
          return el('div', { class: `qo-karten${f.optionen.length === 2 ? ' zwei' : ''}` }, f.optionen.map((o, i) => karte(i, o, () => abschicken([i]))));
      }
    }

    function frageText(f) {
      if (f.art !== 'luecke') return f.frage;
      const teile = String(f.frage).split('___');
      return teile.flatMap((t, i) => (i ? [el('span', { class: 'qo-luecke' }, '      '), t] : [t]));
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
            el('div', { class: 'qo-orb' }, el('span', {}, '✓')),
            el('h1', {}, `Du bist dabei${ich && ich.name ? ', ' + ich.name : ''}!`),
            z.titel ? el('p', { class: 'qo-titel' }, z.titel) : null,
            el('p', { class: 'qo-leise' }, z.anzahl ? `${z.anzahl} ${z.anzahl === 1 ? 'Frage' : 'Fragen'} · gleich geht es los` : 'Gleich geht es los.'),
            z.mitspieler ? el('p', { class: 'qo-leise klein' }, `${z.mitspieler} ${z.mitspieler === 1 ? 'Person ist' : 'Leute sind'} dabei`) : null);
          break;
        case 'frage': {
          const f = z.frage;
          inhalt = el('div', { class: 'qo-frage-seite' },
            el('div', { class: 'qo-frage-kopf' }, el('span', { class: 'qo-pill' }, `Frage ${f.i + 1} von ${f.n}`), el('span', { class: 'qo-wachsen' }), uhr()),
            foto(f),
            el('h2', { class: 'qo-frage' }, frageText(f)),
            eingabeFuer(f));
          break;
        }
        case 'gesendet':
          inhalt = el('div', { class: 'qo-mitte' },
            el('div', { class: 'qo-orb gesendet' }, el('span', {}, '✓')),
            el('h1', {}, 'Antwort gesendet'),
            el('p', { class: 'qo-leise' }, 'Gleich kommt die Auflösung.'));
          break;
        case 'zu':
          inhalt = el('div', { class: 'qo-mitte' }, el('div', { class: 'qo-orb aus' }, el('span', {}, '–')), el('h1', {}, 'Die Zeit ist um'), el('p', { class: 'qo-leise' }, 'Gleich kommt die Auflösung.'));
          break;
        case 'aufloesung': {
          const e = z.ergebnis || {};
          const a = z.aufl || {};
          const voll = (e.teil || 0) >= 0.999;
          const teils = !voll && (e.teil || 0) > 0;
          inhalt = el('div', { class: `qo-mitte qo-ergebnis ${voll ? 'gut' : teils ? 'teils' : 'schlecht'}` },
            el('div', { class: 'qo-orb' }, el('span', {}, voll ? '✓' : teils ? '½' : e.beantwortet ? '✕' : '–')),
            el('h1', {}, voll ? 'Richtig!' : teils ? 'Teilweise richtig' : e.beantwortet ? 'Leider daneben' : 'Keine Antwort'),
            e.delta ? el('div', { class: 'qo-plus' }, `+${zahl(e.delta)}`) : null,
            e.serie >= 2 ? el('div', { class: 'qo-serie' }, `${e.serie} richtig in Folge`) : null,
            !voll && a.loesungText ? el('p', { class: 'qo-loesung' }, a.loesungText) : null,
            e.platz ? el('p', { class: 'qo-platz' }, `Platz ${e.platz} von ${a.spieler || '?'} · ${zahl(e.gesamt)} Punkte`) : null,
            a.wissenswert ? el('p', { class: 'qo-leise qo-wissen' }, a.wissenswert) : null);
          break;
        }
        case 'ende': {
          const s = z.schluss || {};
          const e = z.ergebnis || {};
          const podium = s.podium || [];
          inhalt = el('div', { class: 'qo-mitte qo-ende' },
            el('div', { class: 'qo-orb gold' }, el('span', {}, e.platz ? String(e.platz) : '✓')),
            el('h1', {}, e.platz === 1 ? 'Du hast gewonnen!' : e.platz ? `Platz ${e.platz}` : 'Das Spiel ist aus'),
            e.gesamt != null ? el('p', { class: 'qo-platz' }, `${zahl(e.gesamt)} Punkte · ${e.richtigGesamt || 0} richtig`) : null,
            podium.length ? el('div', { class: 'qo-podium' }, podium.map((p, i) => el('div', { class: `qo-stufe s${i + 1}` },
              el('div', { class: 'qo-stufe-name' }, p.name), el('div', { class: 'qo-stufe-punkte' }, `${zahl(p.punkte)}`), el('div', { class: 'qo-stufe-saeule' }, String(i + 1))))) : null);
          break;
        }
        case 'entfernt':
          inhalt = el('div', { class: 'qo-mitte' }, el('div', { class: 'qo-orb aus' }, el('span', {}, '–')), el('h1', {}, 'Du bist nicht mehr dabei'), el('p', { class: 'qo-leise' }, 'Der Host hat dich aus dem Spiel genommen.'));
          break;
        case 'vorbei':
          inhalt = el('div', { class: 'qo-mitte' }, el('div', { class: 'qo-orb aus' }, el('span', {}, '✓')), el('h1', {}, 'Das Spiel ist vorbei'), el('p', { class: 'qo-leise' }, 'Danke fürs Mitspielen!'));
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
        case 'frage': {
          stoppen();
          z.frage = d;
          z.eingabe = d.art === 'mehrfach' ? new Set()
            : d.art === 'schaetzen' ? { wert: d.start != null ? d.start : Math.round(((d.min + d.max) / 2) / (d.schritt || 1)) * (d.schritt || 1), bewegt: false }
              : d.art === 'reihenfolge' ? d.optionen.map((_, i) => i)
                : d.art === 'zuordnen' ? d.links.map(() => -1)
                  : d.art === 'luecke' ? { text: '' } : null;
          // Wer mitten in die Frage kommt, bekommt nur die restliche Zeit
          z.t0 = performance.now() - (d.vergangen || 0);
          z.ende = z.t0 + d.zeit * 1000;
          z.phase = 'frage';
          z.takt = setInterval(() => {
            const u = wurzel.querySelector('.qo-uhr');
            if (u) u.replaceWith(uhr());
            if (performance.now() >= z.ende && z.phase === 'frage') { stoppen(); z.phase = 'zu'; malen(); }
          }, 250);
          break;
        }
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

  return { erstellen, ZEICHEN, TOENE, zeitAnzeige };
})();
