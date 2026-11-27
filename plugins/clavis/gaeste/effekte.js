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

  // ---------------------------------------------------------------- Überraschungen – im Raum, animiert, nicht zu übersehen
  // Sichtbares passiert im Raum (Regen fällt, Blitze zucken, Vögel fliegen vorbei, Rauch quillt herein). Der Text geht an den
  // Erzähler (opt.sagen) und ins Notizbuch – er verschwindet nicht durch einen Klick. Telefon und Funk klingeln, bis man abnimmt.
  const DAUER = { regen: 24000, gewitter: 16000, alarm: 16000, stromausfall: 11000, beben: 6000, explosion: 9000, kraehen: 6500, schritte: 8000, fluestern: 9000, glitch: 3200,
    fackel: 7000, schrei: 3500, lachen: 5000, heulen: 9000, ketten: 9000, uhrschlag: 7500, spieluhr: 9000, konfetti: 4000, kichern: 4000, trommeln: 7000, glas: 5000, geheimtuer: 6000, tuerknall: 2600, brief: 4200 };

  function tropfen(schicht, n, kinder) {
    for (let e = 0; e < 3; e++) {
      const l = el('div', { class: `cl-regen-ebene e${e}` });
      schicht.append(l);
    }
    const pfuetzen = el('div', { class: 'cl-regen-boden' });
    for (let i = 0; i < n; i++) pfuetzen.append(el('i', { style: { left: `${zufall(0, 100)}%`, top: `${zufall(5, 95)}%`, animationDelay: `${zufall(0, 1.4).toFixed(2)}s`, animationDuration: `${zufall(0.9, 1.5).toFixed(2)}s` } }));
    schicht.append(pfuetzen, el('div', { class: 'cl-regen-nass' }));
    if (kinder) schicht.append(el('div', { class: 'cl-regenbogen' }));
  }
  function blitz(schicht) {
    const x = zufall(10, 90);
    const pfad = (() => { let d = `M${x} 0`; let px = x; for (let y = 8; y <= 70; y += zufall(6, 12)) { px += zufall(-6, 6); d += ` L${px.toFixed(1)} ${y.toFixed(1)}`; } return d; })();
    const b = el('div', { class: 'cl-blitz' });
    b.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${pfad}" class="glut"/><path d="${pfad}" class="kern"/></svg>`;
    schicht.append(b, el('div', { class: 'cl-blitz-licht' }));
    setTimeout(() => { b.remove(); schicht.querySelectorAll('.cl-blitz-licht').forEach((x2) => x2.remove()); }, 900);
  }
  function voegel(schicht, n, kinder) {
    for (let i = 0; i < n; i++) {
      const v = el('div', { class: 'cl-vogel' + (kinder ? ' bunt' : ''), style: { top: `${zufall(8, 45)}%`, animationDelay: `${zufall(0, 1.8).toFixed(2)}s`, animationDuration: `${zufall(3.2, 5).toFixed(2)}s`, '--h': `${zufall(-18, 18).toFixed(0)}vh`, '--s': zufall(0.6, 1.3).toFixed(2) } });
      v.innerHTML = '<svg viewBox="0 0 60 30"><path class="fluegel" d="M0 14 Q15 0 30 14 Q45 0 60 14 Q45 8 30 18 Q15 8 0 14 Z"/></svg>';
      schicht.append(v);
    }
  }
  function staub(schicht, n, klasse = 'staub') {
    for (let i = 0; i < n; i++) schicht.append(el('i', { class: 'cl-' + klasse, style: { left: `${zufall(0, 100)}%`, animationDelay: `${zufall(0, 2.5).toFixed(2)}s`, animationDuration: `${zufall(1.6, 3.4).toFixed(2)}s`, '--g': `${zufall(2, 6).toFixed(1)}px` } }));
  }
  function ketten(schicht) {
    for (let i = 0; i < 4; i++) {
      const k2 = el('div', { class: 'cl-kette', style: { left: `${12 + i * 24 + zufall(-5, 5)}%`, animationDelay: `${zufall(0, 0.6).toFixed(2)}s`, '--l': `${zufall(30, 62).toFixed(0)}%` } });
      k2.innerHTML = `<svg viewBox="0 0 20 300" preserveAspectRatio="xMidYMin slice">${Array.from({ length: 20 }, (_, j) => `<ellipse cx="10" cy="${j * 15 + 7}" rx="${j % 2 ? 3 : 6}" ry="8" fill="none" stroke="#8a8f94" stroke-width="2.4"/>`).join('')}</svg>`;
      schicht.append(k2);
    }
  }

  /** Telefon, Funk: klingelt, bis jemand abnimmt (spätestens nach 30 s läuft der Anrufbeantworter) */
  function klingeln(buehne, art, text, opt) {
    const funk = art === 'funkspruch';
    let fertig = false;
    let ring = null;
    const ding = el('button', { class: 'cl-ev-ding ' + (funk ? 'funk' : 'telefon'), type: 'button', title: funk ? 'Funk annehmen' : 'Abnehmen' },
      el('div', { class: 'cl-ev-ding-bild' }), el('i', { class: 'cl-ring' }), el('i', { class: 'cl-ring zwei' }), el('b', {}, funk ? 'Funk annehmen' : 'Abnehmen'));
    ding.querySelector('.cl-ev-ding-bild').innerHTML = funk
      ? '<svg viewBox="0 0 60 60"><rect x="8" y="20" width="44" height="32" rx="5" fill="#3a4448"/><rect x="14" y="26" width="18" height="10" fill="#5ad2ff" class="cl-a-blinken"/><circle cx="42" cy="31" r="5" fill="#222"/><circle cx="42" cy="44" r="4" fill="#222"/><path d="M14 42 h18 M14 46 h18" stroke="#222" stroke-width="2"/><line x1="44" y1="20" x2="50" y2="2" stroke="#3a4448" stroke-width="3"/></svg>'
      : '<svg viewBox="0 0 60 60"><path d="M6 22 Q6 10 30 10 Q54 10 54 22 L46 26 L40 18 H20 L14 26 Z" fill="#1a1a1a"/><path d="M14 30 H46 L52 54 H8 Z" fill="#2a2a2a"/><circle cx="30" cy="40" r="9" fill="#e8dcc0"/><circle cx="30" cy="40" r="3" fill="#2a2a2a"/>' + Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 1.6 + 0.9; return `<circle cx="${(30 + Math.cos(a) * 6.3).toFixed(1)}" cy="${(40 + Math.sin(a) * 6.3).toFixed(1)}" r="1.1" fill="#2a2a2a"/>`; }).join('') + '</svg>';
    const ende = (abgenommen) => {
      if (fertig) return;
      fertig = true;
      clearInterval(ring);
      ding.classList.add(abgenommen ? 'ab' : 'weg');
      setTimeout(() => ding.remove(), 600);
      if (abgenommen) { k.spielen(funk ? 'funk' : 'klick'); if (opt.sagen) opt.sagen(text, funk ? 'funk' : 'telefon'); }
      else if (opt.sagen) opt.sagen((funk ? 'Der Funk rauscht – dann, ganz leise: ' : 'Der Anrufbeantworter springt an: ') + text, funk ? 'funk' : 'telefon');
    };
    ding.addEventListener('click', () => ende(true));
    k.spielen(e2(art).ton || (funk ? 'funk' : 'telefon'));
    ring = setInterval(() => { if (!ding.isConnected) return clearInterval(ring); k.spielen(funk ? 'funk' : 'telefon'); }, funk ? 2600 : 3200);
    buehne.append(ding);
    if (opt.sagen) opt.sagen(funk ? 'Der Funk knistert. Jemand will dich sprechen – nimm an!' : 'Das Telefon klingelt! Geh ran – unten rechts.', 'hilfe');
    setTimeout(() => ende(false), 30000);
  }
  const e2 = (art) => Clavis.EREIGNISSE[art] || {};

  /** Überraschung zeigen; Ergebnis: Promise, wenn vorbei. opt: { alter, raum (Element), sagen(text, art), stark } */
  Clavis.effekt = (buehne, art, text, opt = {}) => new Promise((fertig) => {
    const e = e2(art);
    const kinder = opt.alter === 'kinder';
    const anzeigen = text || Clavis.ereignisText(art, opt.alter || 'ab14', false) || e.text || '';
    const ort = opt.raum && opt.raum.isConnected ? opt.raum : buehne;
    if ((art === 'anruf' || art === 'funkspruch') && !opt.stumm) { klingeln(buehne, art, anzeigen, opt); return fertig(); }
    if (art === 'anruf' || art === 'funkspruch') {
      // Bei einer Wendung erklärt die Karte alles – nur kurz klingeln lassen, ohne Abnehmen
      k.spielen(art === 'funkspruch' ? 'funk' : 'telefon');
      const kurz = el('div', { class: 'cl-ev-ding kurz ' + (art === 'funkspruch' ? 'funk' : 'telefon') }, el('div', { class: 'cl-ev-ding-bild' }, art === 'funkspruch' ? '📡' : '☎'), el('i', { class: 'cl-ring' }));
      buehne.append(kurz);
      setTimeout(() => { kurz.classList.add('weg'); setTimeout(() => kurz.remove(), 600); }, 3200);
      return fertig();
    }
    const schicht = el('div', { class: 'cl-ev ev-' + art + (kinder ? ' kinder' : '') });
    const dauer = DAUER[art] || 5000;
    const wackeln = (ms) => { ort.classList.remove('cl-wackeln'); void ort.offsetWidth; ort.classList.add('cl-wackeln'); setTimeout(() => ort.classList.remove('cl-wackeln'), ms); };
    const nochmal = (ton, alle, bis) => { const t = setInterval(() => { if (!schicht.isConnected) return clearInterval(t); k.spielen(ton); }, alle); setTimeout(() => clearInterval(t), bis); };
    if (e.ton) k.spielen(kinder && art === 'explosion' ? 'konfetti' : e.ton === 'spieluhr' && !kinder && opt.stark ? 'spieluhrSchief' : e.ton);
    switch (art) {
      case 'regen': tropfen(schicht, 26, kinder); nochmal('regen', 3300, dauer - 3000); break;
      case 'gewitter': tropfen(schicht, 18, false); setTimeout(() => blitz(schicht), 80); [4200, 9500].forEach((t) => setTimeout(() => { if (schicht.isConnected) { blitz(schicht); k.spielen('gewitter'); } }, t)); nochmal('regen', 3300, dauer - 3000); break;
      case 'alarm': schicht.append(el('div', { class: 'cl-rundumlicht links' }), el('div', { class: 'cl-rundumlicht rechts' }), el('div', { class: 'cl-alarm-rot' })); nochmal(kinder ? 'plopp' : 'alarm', 2300, 9000); break;
      case 'stromausfall': schicht.append(el('div', { class: 'cl-stromlos' })); ort.classList.add('ev-strom-aus'); setTimeout(() => ort.classList.remove('ev-strom-aus'), dauer - 800); break;
      case 'beben': wackeln(2200); staub(schicht, 60); staub(schicht, 8, 'brocken'); break;
      case 'explosion': if (kinder) { Clavis.konfetti(buehne); schicht.append(el('div', { class: 'cl-puff' })); } else { wackeln(1400); schicht.append(el('div', { class: 'cl-explosion-licht' }), el('div', { class: 'cl-rauch' }), el('div', { class: 'cl-rauch zwei' })); staub(schicht, 30, 'brocken'); } break;
      case 'glas': for (let i = 0; i < 22; i++) schicht.append(el('div', { class: 'cl-scherbe', style: { left: `${zufall(30, 70)}%`, top: `${zufall(20, 45)}%`, '--dx': `${zufall(-35, 35)}vw`, '--dy': `${zufall(20, 60)}vh`, '--r': `${zufall(-400, 400)}deg`, animationDelay: `${zufall(0, 0.2).toFixed(2)}s` } })); break;
      case 'kraehen': voegel(schicht, kinder ? 4 : 11, kinder); break;
      case 'schritte': schicht.append(el('div', { class: 'cl-tuerschlitz' }, el('i', { class: 'fuss' }), el('i', { class: 'fuss zwei' }))); break;
      case 'fluestern': schicht.append(el('div', { class: 'cl-kaltnebel' }), el('div', { class: 'cl-kaltnebel zwei' })); break;
      case 'glitch': ort.classList.add('cl-glitch'); setTimeout(() => ort.classList.remove('cl-glitch'), 1600); schicht.append(el('div', { class: 'cl-glitch-streifen' })); break;
      case 'fackel': schicht.append(el('div', { class: 'cl-aufflammen' })); ort.classList.add('ev-flammen'); setTimeout(() => ort.classList.remove('ev-flammen'), dauer); break;
      case 'schrei': wackeln(500); schicht.append(el('div', { class: 'cl-schrei-rot' })); break;
      case 'lachen': wackeln(300); schicht.append(el('div', { class: 'cl-echo' }, anzeigen)); break;
      case 'heulen': schicht.append(el('div', { class: 'cl-vollmond' }, el('i'))); break;
      case 'ketten': ketten(schicht); nochmal('ketten', 2400, 6000); break;
      case 'uhrschlag': { const u = el('div', { class: 'cl-grosse-uhr' }); u.innerHTML = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="2"/>' + Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<line x1="${50 + Math.sin(a) * 38}" y1="${50 - Math.cos(a) * 38}" x2="${50 + Math.sin(a) * 44}" y2="${50 - Math.cos(a) * 44}" stroke="currentColor" stroke-width="2"/>`; }).join('') + '<line class="zeiger gross" x1="50" y1="50" x2="50" y2="14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line class="zeiger klein" x1="50" y1="50" x2="50" y2="26" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>'; schicht.append(u); break; }
      case 'spieluhr': schwarm(schicht, '♪', 14, 'noten'); schwarm(schicht, '♫', 6, 'noten'); break;
      case 'konfetti': case 'kichern': Clavis.konfetti(buehne); schwarm(schicht, '✨', 8, 'noten'); break;
      case 'trommeln': for (let i = 0; i < 10; i++) setTimeout(() => { if (!schicht.isConnected) return; ort.classList.remove('ev-schlag'); void ort.offsetWidth; ort.classList.add('ev-schlag'); }, i * (340 - i * 20)); break;
      case 'geheimtuer': wackeln(900); staub(schicht, 30); schicht.append(el('div', { class: 'cl-wand-schiebt' })); break;
      case 'tuerknall': wackeln(700); schicht.append(el('div', { class: 'cl-luftzug' })); ort.classList.add('ev-flackern'); setTimeout(() => ort.classList.remove('ev-flackern'), 1800); break;
      case 'brief': schicht.append(el('div', { class: 'cl-umschlag-rutscht' })); break;
      default:
    }
    ort.append(schicht);
    if (opt.sagen) { if (anzeigen) setTimeout(() => opt.sagen(anzeigen, 'ereignis'), art === 'stromausfall' ? 1400 : 500); }
    else if (!opt.stumm && anzeigen) schicht.append(el('div', { class: 'cl-ev-text' }, anzeigen));
    const weg = () => { schicht.classList.add('weg'); setTimeout(() => { schicht.remove(); fertig(); }, 1400); };
    setTimeout(weg, dauer);
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

  /**
   * Jumpscare – art: fratze | puppe | gestalt | hand (heftig) · fledermaeuse | spinnen | katze (mild).
   * staerke 1–10 (je Gerät einstellbar): 1–2 nur ein Schrei · 3–4 Schrei und flackerndes Licht · 5–6 ein Schatten huscht
   * vorbei, kurzer Blitz · 7–8 eine Fratze taucht auf, der Raum wackelt · 9–10 Blitz, riesige Gestalt, Schrei, Beben (Blut nur ab 18).
   */
  Clavis.schreck = (buehne, art, { blut = false, staerke = 6 } = {}) => {
    const st = Math.max(1, Math.min(10, Math.round(staerke)));
    const mild = ['fledermaeuse', 'spinnen', 'katze'].includes(art);
    const raum = buehne.querySelector('.cl-raum') || buehne;
    const wackeln = (ms) => { buehne.classList.remove('cl-wackeln'); void buehne.offsetWidth; buehne.classList.add('cl-wackeln'); setTimeout(() => buehne.classList.remove('cl-wackeln'), ms); };
    const flackern = (ms) => { raum.classList.add('ev-flackern'); setTimeout(() => raum.classList.remove('ev-flackern'), ms); };
    const schicht = el('div', { class: `cl-schreck ${art} stufe-${st <= 6 ? 'leicht' : st <= 8 ? 'mittel' : 'voll'}${blut ? ' blut' : ''}` });
    let dauer = 900;
    if (mild) {
      k.spielen('buh');
      if (st <= 2) return;
      if (art === 'fledermaeuse') schwarm(schicht, '🦇', 4 + st * 2, 'flatter');
      if (art === 'spinnen') schwarm(schicht, '🕷', 3 + st * 2, 'krabbel');
      if (art === 'katze') schicht.append(el('div', { class: 'cl-katze' }, el('span', {}, '🐈‍⬛'), el('b', {}, 'Fauch!')));
      if (st >= 4) flackern(700);
      dauer = 2200;
    } else if (st <= 2) {
      // Nur ein Schrei aus dem Nichts
      k.spielen(st === 1 ? 'schrei' : 'kreischen');
      return;
    } else if (st <= 4) {
      k.spielen('schrei');
      flackern(1100);
      if (st === 4) setTimeout(() => k.spielen('atem'), 900);
      return;
    } else if (st <= 6) {
      // Ein Schatten huscht durchs Bild, kurzer Blitz
      k.spielen('kreischen');
      schicht.append(el('div', { class: 'cl-schreck-licht' }), el('div', { class: 'cl-schreck-schatten' }, gestalt()));
      flackern(800);
      dauer = 1300;
    } else {
      k.spielen('kreischen');
      if (st >= 10) setTimeout(() => k.spielen('schrei'), 350);
      const figur = art === 'puppe' ? puppe(blut) : art === 'gestalt' ? gestalt() : art === 'hand' ? hand(blut) : fratze(blut);
      if (st >= 9) schicht.append(el('div', { class: 'cl-schreck-licht voll' }), el('div', { class: 'cl-schreck-rot' }));
      schicht.append(figur);
      if (blut && st >= 7) schicht.append(el('div', { class: 'cl-blutspritzer' }));
      wackeln(st >= 9 ? 900 : 600);
      if (st >= 9) flackern(1400);
      dauer = st >= 10 ? 1400 : st >= 9 ? 1150 : 800;
    }
    buehne.append(schicht);
    setTimeout(() => { schicht.classList.add('weg'); setTimeout(() => schicht.remove(), 500); }, dauer);
  };

  /** Beschreibung der Stärke (für den Regler) */
  Clavis.schreckText = (st, mild) => (mild
    ? (st <= 2 ? 'Nur ein kurzes „Buh!“' : st <= 3 ? 'Ein paar Fledermäuse oder Spinnen' : 'Ein ganzer Schwarm – und das Licht flackert')
    : st <= 2 ? 'Nur ein Schrei aus dem Nichts' : st <= 4 ? 'Ein Schrei – und das Licht flackert' : st <= 6 ? 'Ein Schatten huscht vorbei, kurzer Blitz' : st <= 8 ? 'Eine Fratze taucht auf, der Raum wackelt' : 'Blitz, eine riesige Gestalt, Schrei und Beben');

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
