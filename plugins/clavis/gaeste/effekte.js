'use strict';
/*
 * Clavis – Effekte auf der Bühne: Überraschungen (Stromausfall, Alarm, Schrei, Glas, Regen …), Jumpscares (je nach Alter
 * mild oder heftig, Blut nur ab 18), Konfetti und die Tür, die sich zum Raum öffnet. Alles CSS, SVG und WebAudio.
 */
(() => {
  const { el } = Clavis;
  const k = Clavis.klang;
  const zufall = (a, b) => a + Math.random() * (b - a);

  function schwarm(schicht, zeichen, n, klasse) {
    for (let i = 0; i < n; i++) {
      schicht.append(el('div', { class: 'cl-schwarm ' + klasse, style: { left: `${zufall(-10, 100)}%`, top: `${zufall(5, 85)}%`, '--dx': `${zufall(-60, 60)}vw`, '--dy': `${zufall(-40, 40)}vh`, '--r': `${zufall(-40, 40)}deg`, animationDelay: `${zufall(0, 0.6)}s`, fontSize: `${zufall(18, 40)}px` } }, zeichen));
    }
  }

  /** Überraschung zeigen; Ergebnis: Promise, wenn vorbei. opt: { alter, nurBild } */
  Clavis.effekt = (buehne, art, text, opt = {}) => new Promise((fertig) => {
    const e = Clavis.EREIGNISSE[art] || {};
    const kinder = opt.alter === 'kinder';
    const anzeigen = text || Clavis.ereignisText(art, opt.alter || 'ab14', false) || e.text || '';
    const schicht = el('div', { class: 'cl-effekt ' + art + (kinder ? ' kinder' : '') });
    const karte = (symbol) => el('div', { class: 'cl-effekt-karte' }, symbol ? el('div', { class: 'cl-effekt-symbol' }, symbol) : null, el('div', { class: 'cl-effekt-text' }, anzeigen));
    let dauer = 3800;
    if (e.ton) k.spielen(kinder && art === 'explosion' ? 'konfetti' : e.ton === 'spieluhr' && !kinder && opt.stark ? 'spieluhrSchief' : e.ton);
    const wackeln = (ms) => { buehne.classList.add('cl-wackeln'); setTimeout(() => buehne.classList.remove('cl-wackeln'), ms); };
    switch (art) {
      case 'stromausfall': dauer = 4200; if (!kinder) { buehne.classList.add('cl-notlicht'); setTimeout(() => buehne.classList.remove('cl-notlicht'), 25000); } schicht.append(karte()); break;
      case 'alarm': schicht.append(karte(kinder ? '⏰' : '!')); break;
      case 'brief': dauer = 6500; schicht.append(el('div', { class: 'cl-brief' }, el('div', { class: 'cl-brief-siegel' }), el('div', { class: 'cl-brief-text' }, anzeigen))); break;
      case 'anruf': case 'funkspruch': dauer = 6000; schicht.append(karte(art === 'anruf' ? '☏' : '📡')); break;
      case 'geheimtuer': case 'tuerknall': case 'beben': case 'ketten': wackeln(art === 'beben' ? 1800 : 900); schicht.append(karte()); break;
      case 'glitch': buehne.classList.add('cl-glitch'); setTimeout(() => buehne.classList.remove('cl-glitch'), 1400); schicht.append(karte()); break;
      case 'explosion': if (kinder) Clavis.konfetti(buehne); else wackeln(1400); schicht.append(karte(kinder ? '🎉' : null)); break;
      case 'glas': for (let i = 0; i < 18; i++) schicht.append(el('div', { class: 'cl-scherbe', style: { left: `${zufall(35, 65)}%`, top: `${zufall(35, 60)}%`, '--dx': `${zufall(-45, 45)}vw`, '--dy': `${zufall(-30, 50)}vh`, '--r': `${zufall(-400, 400)}deg` } })); schicht.append(karte()); break;
      case 'regen': schicht.append(el('div', { class: 'cl-regenguss' }), karte(kinder ? '🌈' : null)); dauer = 4800; break;
      case 'kraehen': schwarm(schicht, kinder ? '🦜' : '🐦‍⬛', kinder ? 3 : 9, 'flug'); schicht.append(karte()); break;
      case 'spieluhr': schwarm(schicht, '♪', 10, 'noten'); schicht.append(karte()); dauer = 4800; break;
      case 'konfetti': case 'kichern': Clavis.konfetti(buehne); schicht.append(karte(art === 'kichern' ? '✨' : '🎉')); break;
      case 'trommeln': schicht.append(karte('🥁')); break;
      case 'uhrschlag': schicht.append(karte('🕰')); dauer = 4400; break;
      case 'heulen': schicht.append(karte('🌕')); dauer = 4400; break;
      case 'schrei': case 'lachen': wackeln(500); schicht.append(karte()); dauer = 4200; break;
      default: schicht.append(karte());
    }
    buehne.append(schicht);
    const weg = () => { schicht.classList.add('weg'); setTimeout(() => { schicht.remove(); fertig(); }, 450); };
    const t = setTimeout(weg, dauer);
    schicht.addEventListener('click', () => { clearTimeout(t); weg(); });
  });

  // ---------------------------------------------------------------- Jumpscares
  function fratze(blut) {
    return el('svg', { viewBox: '0 0 200 240', class: 'cl-fratze' },
      el('defs', {}, el('filter', { id: 'cl-verzerrt' }, el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035', numOctaves: '2', seed: String(Math.floor(Math.random() * 99)) }), el('feDisplacementMap', { in: 'SourceGraphic', scale: '14' }))),
      el('g', { filter: 'url(#cl-verzerrt)' },
        el('ellipse', { cx: 100, cy: 118, rx: 74, ry: 100, fill: '#d6d0c2' }),
        el('ellipse', { cx: 100, cy: 140, rx: 70, ry: 80, fill: '#bdb6a6', opacity: '0.5' }),
        el('ellipse', { cx: 68, cy: 100, rx: 22, ry: 28, fill: '#050505' }), el('ellipse', { cx: 132, cy: 100, rx: 22, ry: 28, fill: '#050505' }),
        el('circle', { cx: 70, cy: 104, r: 3.2, fill: '#fff' }), el('circle', { cx: 130, cy: 104, r: 3.2, fill: '#fff' }),
        el('path', { d: 'M78 160 Q100 150 122 160 Q126 215 100 222 Q74 215 78 160 Z', fill: '#060404' }),
        el('path', { d: 'M86 166 l4 10 l4 -9 l4 10 l4 -10 l4 9 l4 -10', stroke: '#e8e2d2', 'stroke-width': '2', fill: 'none' }),
        blut ? [el('path', { d: 'M66 126 C64 150 70 170 64 200', stroke: '#8a0000', 'stroke-width': '5', fill: 'none', 'stroke-linecap': 'round' }),
          el('path', { d: 'M134 126 C138 146 130 160 136 186', stroke: '#8a0000', 'stroke-width': '4', fill: 'none', 'stroke-linecap': 'round' }),
          el('path', { d: 'M96 220 C95 230 99 236 97 240', stroke: '#8a0000', 'stroke-width': '6', fill: 'none' })] : null));
  }
  function puppe(blut) {
    return el('svg', { viewBox: '0 0 200 220', class: 'cl-fratze' },
      el('circle', { cx: 100, cy: 105, r: 82, fill: '#efe3d3' }),
      el('path', { d: 'M30 70 C40 10 160 10 170 70 C150 40 50 40 30 70 Z', fill: '#4a2a14' }),
      el('circle', { cx: 70, cy: 100, r: 21, fill: '#0a0a0a' }), el('circle', { cx: 130, cy: 100, r: 21, fill: '#0a0a0a' }),
      el('circle', { cx: 76, cy: 94, r: 5, fill: '#fff' }), el('circle', { cx: 124, cy: 94, r: 5, fill: '#fff' }),
      el('circle', { cx: 55, cy: 130, r: 10, fill: '#e8a0a0', opacity: '0.7' }), el('circle', { cx: 145, cy: 130, r: 10, fill: '#e8a0a0', opacity: '0.7' }),
      el('path', { d: 'M85 150 Q100 162 115 150', stroke: '#6b1a1a', 'stroke-width': '4', fill: 'none' }),
      el('path', { d: 'M120 30 L112 70 L126 92 L114 120', stroke: '#2a2a2a', 'stroke-width': '2.5', fill: 'none' }),
      blut ? el('path', { d: 'M70 121 C68 140 74 150 70 170', stroke: '#8a0000', 'stroke-width': '4', fill: 'none', 'stroke-linecap': 'round' }) : null);
  }
  function gestalt() {
    return el('svg', { viewBox: '0 0 200 300', class: 'cl-gestalt' },
      el('path', { d: 'M100 20 C80 20 74 40 76 60 C60 70 50 100 46 150 C40 210 30 260 20 300 L180 300 C170 260 160 210 154 150 C150 100 140 70 124 60 C126 40 120 20 100 20 Z', fill: '#020203' }),
      el('circle', { cx: 91, cy: 46, r: 3, fill: '#ff2a1a' }), el('circle', { cx: 109, cy: 46, r: 3, fill: '#ff2a1a' }));
  }
  function hand(blut) {
    return el('svg', { viewBox: '0 0 200 240', class: 'cl-hand' + (blut ? ' blut' : '') },
      el('path', { d: 'M60 230 C40 180 30 150 34 120 C36 105 52 104 56 118 L62 140 L58 52 C57 38 76 36 78 50 L84 118 L86 30 C86 14 106 14 106 30 L106 116 L114 40 C116 26 134 28 132 44 L126 122 L140 70 C144 56 162 60 158 76 L146 150 C140 190 132 210 130 230 Z', fill: 'currentColor' }));
  }

  /** Jumpscare – art: fratze | puppe | gestalt | hand (heftig) · fledermaeuse | spinnen | katze (mild) */
  Clavis.schreck = (buehne, art, { blut = false } = {}) => {
    const mild = ['fledermaeuse', 'spinnen', 'katze'].includes(art);
    const schicht = el('div', { class: 'cl-schreck ' + art + (blut ? ' blut' : '') });
    if (mild) {
      k.spielen('buh');
      if (art === 'fledermaeuse') schwarm(schicht, '🦇', 14, 'flatter');
      if (art === 'spinnen') schwarm(schicht, '🕷', 12, 'krabbel');
      if (art === 'katze') schicht.append(el('div', { class: 'cl-katze' }, el('span', {}, '🐈‍⬛'), el('b', {}, 'Fauch!')));
    } else {
      k.spielen('kreischen');
      schicht.append(art === 'puppe' ? puppe(blut) : art === 'gestalt' ? gestalt() : art === 'hand' ? hand(blut) : fratze(blut));
      if (blut) schicht.append(el('div', { class: 'cl-blutspritzer' }));
      buehne.classList.add('cl-wackeln');
      setTimeout(() => buehne.classList.remove('cl-wackeln'), 600);
    }
    buehne.append(schicht);
    setTimeout(() => { schicht.classList.add('weg'); setTimeout(() => schicht.remove(), 500); }, mild ? 2200 : 950);
  };

  /** Konfetti (für Kinder bei jedem gelösten Rätsel) */
  Clavis.konfetti = (buehne) => {
    const farben = ['#ff5d73', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c'];
    const schicht = el('div', { class: 'cl-konfetti' });
    for (let i = 0; i < 70; i++) {
      schicht.append(el('i', { style: { left: `${zufall(0, 100)}%`, background: farben[i % farben.length], '--dx': `${zufall(-20, 20)}vw`, '--r': `${zufall(200, 900)}deg`, animationDelay: `${zufall(0, 0.5)}s`, animationDuration: `${zufall(1.6, 2.8)}s`, width: `${zufall(6, 11)}px`, height: `${zufall(8, 15)}px` } }));
    }
    buehne.append(schicht);
    setTimeout(() => schicht.remove(), 3600);
  };

  /** Die Tür geht auf – Übergang in den Raum */
  Clavis.tuerAuf = (buehne) => new Promise((fertig) => {
    k.spielen('tueroeffnen');
    const t = el('div', { class: 'cl-tueren' }, el('div', { class: 'cl-tuerfluegel links' }, el('i')), el('div', { class: 'cl-tuerfluegel rechts' }, el('i')), el('div', { class: 'cl-tuerlicht' }));
    buehne.append(t);
    setTimeout(() => { t.remove(); fertig(); }, 1700);
  });
})();
