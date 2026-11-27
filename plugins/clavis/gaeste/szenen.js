'use strict';
/*
 * Clavis – Zwischenszenen und Outro. Passiert etwas (Alarm, Anruf, Brief, Gewitter, eine Wendung), friert das Spiel ein:
 * Kinobalken fahren herein, die Kamera geht in den Raum, die Szene spielt sich ab (Nahaufnahme, Effekte, Klang), der Text läuft
 * als Untertitel. Überspringen geht nur über den Knopf am Rand – ein Klick irgendwo sonst tut nichts. Am Ende: ein Outro –
 * die Tür springt auf und die Kamera fährt hinaus ins Morgenlicht, oder die Zeit läuft ab und der Raum behält dich.
 *
 *   Clavis.Szenen.zeigen(spiel, { art, titel, text, alter, welt, gut, wendung, stil, sprecher }) → Promise
 *   Clavis.Szenen.outro(spiel, { raum, ergebnis, kinder }) → Promise
 */
(() => {
  const { el } = Clavis;
  const k = () => Clavis.klang;
  const schlange = [];
  let laeuft = false;

  // ---------------------------------------------------------------- Nahaufnahmen (SVG, animiert über CSS)
  const NAH = {
    lampe: (welt) => (['grab', 'dschungel'].includes(welt)
      ? '<svg viewBox="0 0 120 160"><rect x="50" y="70" width="20" height="90" fill="#5a3a1c"/><path d="M40 66 h40 l-6 14 h-28 Z" fill="#6a5030"/><g class="zs-flamme"><path d="M60 8 Q86 40 78 58 Q70 74 60 70 Q50 74 42 58 Q34 40 60 8 Z" fill="#ff8a1a"/><path d="M60 28 Q72 46 68 58 Q60 66 52 58 Q48 46 60 28 Z" fill="#ffd166"/></g></svg>'
      : ['spuk', 'bibliothek'].includes(welt)
        ? '<svg viewBox="0 0 120 160"><path d="M20 156 H100 M60 156 V120 M30 120 H90" stroke="#b8893a" stroke-width="6" fill="none"/><rect x="48" y="60" width="24" height="60" fill="#efe6cf"/><g class="zs-flamme"><path d="M60 14 Q76 36 72 46 Q66 56 60 54 Q54 56 48 46 Q44 36 60 14 Z" fill="#ffb347"/></g></svg>'
        : '<svg viewBox="0 0 120 160"><line x1="60" y1="0" x2="60" y2="50" stroke="#333" stroke-width="3"/><rect x="48" y="46" width="24" height="16" fill="#555"/><g class="zs-flamme"><circle cx="60" cy="90" r="30" fill="#ffe7a0"/></g><circle cx="60" cy="90" r="30" fill="none" stroke="#999" stroke-width="2"/></svg>'),
    rundumlicht: () => '<svg viewBox="0 0 160 160"><rect x="40" y="120" width="80" height="24" rx="4" fill="#333"/><path d="M48 120 Q48 56 80 52 Q112 56 112 120 Z" fill="#c21d1d"/><path d="M48 120 Q48 56 80 52 Q112 56 112 120 Z" fill="#ff4a4a" class="zs-blink"/><g class="zs-dreh" style="transform-origin:80px 90px"><path d="M80 90 L180 50 L180 130 Z" fill="#ff5a5a" opacity="0.35"/><path d="M80 90 L-20 50 L-20 130 Z" fill="#ff5a5a" opacity="0.2"/></g></svg>',
    telefon: () => '<svg viewBox="0 0 160 140"><g class="zs-klingeln"><path d="M20 50 Q20 20 80 20 Q140 20 140 50 L118 60 L106 42 H54 L42 60 Z" fill="#1d1d1d"/><path d="M42 70 H118 L132 128 H28 Z" fill="#2a2a2a"/><circle cx="80" cy="98" r="22" fill="#e8dcc0"/><circle cx="80" cy="98" r="7" fill="#2a2a2a"/></g><path class="zs-welle" d="M146 36 q8 10 0 22 M154 28 q14 18 0 38" stroke="#ffd166" stroke-width="4" fill="none" stroke-linecap="round"/><path class="zs-welle" d="M14 36 q-8 10 0 22 M6 28 q-14 18 0 38" stroke="#ffd166" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
    funk: () => '<svg viewBox="0 0 160 140"><rect x="20" y="40" width="120" height="86" rx="10" fill="#3a4448"/><rect x="32" y="54" width="54" height="28" rx="3" fill="#0b1a1c"/><path class="zs-welle-bild" d="M34 68 q6 -12 12 0 t12 0 t12 0 t12 0" stroke="#5ad2ff" stroke-width="2" fill="none"/><circle cx="114" cy="66" r="14" fill="#222"/><circle cx="114" cy="104" r="10" fill="#222"/><line x1="118" y1="40" x2="134" y2="4" stroke="#3a4448" stroke-width="5"/><circle class="zs-blink" cx="134" cy="4" r="5" fill="#ff3d5a"/><path d="M36 96 H86 M36 106 H86" stroke="#222" stroke-width="4"/></svg>',
    tuerspalt: () => '<svg viewBox="0 0 220 120"><rect width="220" height="96" fill="#2a1a0c"/><rect y="96" width="220" height="24" fill="#120a04"/><rect x="0" y="94" width="220" height="5" fill="#ffe7a0" class="zs-licht"/><g class="zs-schatten"><ellipse cx="80" cy="96" rx="16" ry="4" fill="#000"/><ellipse cx="112" cy="96" rx="16" ry="4" fill="#000"/></g></svg>',
    brief: () => '<svg viewBox="0 0 220 140"><rect width="220" height="100" fill="#2a1a0c"/><rect y="100" width="220" height="40" fill="#120a04"/><rect x="0" y="98" width="220" height="4" fill="#ffe7a0"/><g class="zs-rutschen"><rect x="70" y="104" width="80" height="30" rx="2" fill="#efe2c0"/><path d="M70 104 L110 122 L150 104" stroke="#a08a5a" stroke-width="2" fill="none"/><circle cx="110" cy="120" r="6" fill="#9c2b2b"/></g></svg>',
    fenster: (welt) => { try { return Clavis.Kulisse.fensterInnen(welt); } catch (_) { return ''; } },
    riss: () => '<svg viewBox="0 0 200 140"><rect width="200" height="140" fill="#6a5a48"/><path class="zs-riss" d="M100 0 L94 30 L110 52 L96 80 L112 104 L100 140 M94 30 L70 40 M110 52 L140 60 M96 80 L64 96 M112 104 L146 118" stroke="#1a120a" stroke-width="4" fill="none"/></svg>',
    uhr: () => '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="#efe6cf" stroke="#b8893a" stroke-width="6"/>' + Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<line x1="${60 + Math.sin(a) * 42}" y1="${60 - Math.cos(a) * 42}" x2="${60 + Math.sin(a) * 50}" y2="${60 - Math.cos(a) * 50}" stroke="#2a1a10" stroke-width="3"/>`; }).join('') + '<line class="zs-zeiger" x1="60" y1="60" x2="60" y2="16" stroke="#2a1a10" stroke-width="4" stroke-linecap="round"/><line x1="60" y1="60" x2="60" y2="28" stroke="#2a1a10" stroke-width="6" stroke-linecap="round"/><circle cx="60" cy="60" r="5" fill="#2a1a10"/></svg>',
    sanduhr: () => '<svg viewBox="0 0 100 140"><g class="zs-drehen-langsam" style="transform-origin:50px 70px"><rect x="14" y="6" width="72" height="10" rx="3" fill="#7a4b2a"/><rect x="14" y="124" width="72" height="10" rx="3" fill="#7a4b2a"/><path d="M22 16 Q22 56 48 70 Q22 84 22 124 H78 Q78 84 52 70 Q78 56 78 16 Z" fill="#cfe8ff" opacity="0.35" stroke="#cfe8ff"/><path d="M30 28 Q32 52 50 64 Q68 52 70 28 Z" fill="#e8c27a" class="zs-sand-oben"/><path d="M28 124 Q50 96 72 124 Z" fill="#e8c27a"/></g></svg>',
    spieluhr: () => '<svg viewBox="0 0 140 140"><rect x="20" y="86" width="100" height="44" rx="6" fill="#7a4b2a"/><ellipse cx="70" cy="86" rx="50" ry="10" fill="#a0673a"/><g class="zs-dreh" style="transform-origin:70px 60px"><circle cx="70" cy="36" r="7" fill="#f4d2c0"/><path d="M70 43 L64 70 L76 70 Z" fill="#ff9fbe"/><path d="M52 68 Q70 58 88 68 Q70 78 52 68 Z" fill="#ffb8cf"/></g></svg>',
    trommel: () => '<svg viewBox="0 0 160 120"><g class="zs-schlag"><ellipse cx="80" cy="40" rx="56" ry="16" fill="#e8d6b0"/><path d="M24 40 V92 Q80 116 136 92 V40" fill="#9a3b2a"/><path d="M24 50 L136 86 M24 86 L136 50" stroke="#e8d6b0" stroke-width="3"/></g></svg>',
    tuer: () => '<svg viewBox="0 0 120 170"><rect x="10" y="6" width="100" height="164" fill="#120a04"/><g class="zs-tuer-zu" style="transform-origin:14px 88px"><rect x="14" y="10" width="92" height="160" fill="#5a3a1c"/><rect x="24" y="22" width="72" height="56" fill="none" stroke="#3a2414" stroke-width="4"/><rect x="24" y="96" width="72" height="62" fill="none" stroke="#3a2414" stroke-width="4"/><circle cx="92" cy="90" r="5" fill="#d9a84a"/></g></svg>',
    geheimtuer: () => '<svg viewBox="0 0 160 170"><rect width="160" height="170" fill="#000"/><rect x="0" y="0" width="160" height="170" fill="#6a5a48" class="zs-schiebt"/><path d="M0 40 H160 M0 80 H160 M0 120 H160 M60 0 V40 M100 40 V80 M40 80 V120 M120 120 V170" stroke="#3a3020" stroke-width="3" class="zs-schiebt"/></svg>',
    monitor: () => '<svg viewBox="0 0 160 130"><rect x="10" y="6" width="140" height="96" rx="8" fill="#222"/><rect x="20" y="16" width="120" height="76" fill="#061012"/><g class="zs-glitch"><rect x="20" y="30" width="120" height="8" fill="#39f5c6" opacity="0.6"/><rect x="20" y="58" width="120" height="5" fill="#ff3d8b" opacity="0.6"/><text x="80" y="64" text-anchor="middle" font-family="Menlo,monospace" font-size="20" fill="#39f5c6">LAUF</text></g><rect x="66" y="102" width="28" height="16" fill="#333"/></svg>',
    ketten: () => '<svg viewBox="0 0 160 160">' + [30, 80, 130].map((x, i) => `<g class="zs-pendeln" style="transform-origin:${x}px 0;animation-delay:-${i * 0.4}s">${Array.from({ length: 9 }, (_, j) => `<ellipse cx="${x}" cy="${j * 16 + 8}" rx="${j % 2 ? 4 : 7}" ry="9" fill="none" stroke="#9aa4ae" stroke-width="3"/>`).join('')}</g>`).join('') + '</svg>',
    mond: () => '<svg viewBox="0 0 160 160"><circle cx="90" cy="70" r="50" fill="#f6f0d4"/><circle cx="90" cy="70" r="70" fill="#f6f0d4" opacity="0.15"/><path d="M20 160 L28 120 L20 100 L32 90 L36 70 L46 86 L56 60 L60 92 L72 106 L68 160 Z" fill="#000" class="zs-heulen"/></svg>',
    notiz: () => '<svg viewBox="0 0 140 140"><g class="zs-schweben"><rect x="24" y="20" width="92" height="104" rx="3" fill="#efe6cf" transform="rotate(-4 70 70)"/><path d="M36 46 H104 M36 62 H100 M36 78 H96 M36 94 H84" stroke="#8a7a5a" stroke-width="3" transform="rotate(-4 70 70)"/></g><circle cx="70" cy="70" r="60" fill="#ffe7a0" opacity="0.15" class="zs-blink"/></svg>',
    zeitbombe: () => '<svg viewBox="0 0 180 120"><rect x="10" y="20" width="160" height="80" rx="10" fill="#1a1a1a" stroke="#ff3d3d" stroke-width="3"/><text x="90" y="76" text-anchor="middle" font-family="Menlo,monospace" font-size="44" font-weight="700" fill="#ff3d3d" class="zs-zaehler">1:30</text><circle cx="160" cy="30" r="5" fill="#ff3d3d" class="zs-blink"/></svg>',
    nebel: () => '<svg viewBox="0 0 200 120"><g class="zs-wabern"><ellipse cx="60" cy="80" rx="60" ry="22" fill="#dcdce6" opacity="0.7"/><ellipse cx="130" cy="70" rx="70" ry="26" fill="#dcdce6" opacity="0.6"/><ellipse cx="100" cy="96" rx="90" ry="20" fill="#e8e8f0" opacity="0.7"/></g></svg>',
    ketteSchloss: () => '<svg viewBox="0 0 160 160"><path d="M40 70 V50 a40 40 0 0 1 80 0 V70" stroke="#9aa4ae" stroke-width="12" fill="none"/><rect x="28" y="70" width="104" height="74" rx="10" fill="#6a7480"/><circle cx="80" cy="102" r="10" fill="#222"/><rect x="76" y="106" width="8" height="20" fill="#222"/><g class="zs-zu"><path d="M10 40 L150 130 M150 40 L10 130" stroke="#9aa4ae" stroke-width="8" stroke-dasharray="14 8"/></g></svg>',
    konfetti: () => '<svg viewBox="0 0 160 160"><g class="zs-schlag"><path d="M40 140 L80 60 L120 140 Z" fill="#ff5d73"/><path d="M60 100 H100" stroke="#ffd166" stroke-width="6"/></g></svg>',
  };
  const NAH_FUER = {
    alarm: 'rundumlicht', stromausfall: 'lampe', anruf: 'telefon', funkspruch: 'funk', brief: 'brief', schritte: 'tuerspalt', gewitter: 'fenster', regen: 'fenster', kraehen: 'fenster', glas: 'fenster', heulen: 'mond',
    beben: 'riss', explosion: 'riss', uhrschlag: 'uhr', spieluhr: 'spieluhr', trommeln: 'trommel', tuerknall: 'tuer', geheimtuer: 'geheimtuer', glitch: 'monitor', ketten: 'ketten', fackel: 'lampe', konfetti: 'konfetti', kichern: 'konfetti',
    // Wendungen
    w_countdown: 'zeitbombe', w_dunkel: 'lampe', w_nebel: 'nebel', w_geheimfach: 'geheimtuer', w_tipp: 'notiz', w_buchstabe: 'notiz', w_zeitplus: 'sanduhr', w_zeitminus: 'sanduhr', w_blockiert: 'ketteSchloss',
  };

  const warte = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Untertitel, die sich eintippen – Ergebnis: Promise, wenn fertig getippt */
  function tippen(ziel, text, tempo) {
    return new Promise((fertig) => {
      let i = 0;
      const schritt = () => { if (!ziel.isConnected) return fertig(); ziel.textContent = text.slice(0, i); i += 1; if (i <= text.length) setTimeout(schritt, tempo); else fertig(); };
      schritt();
    });
  }
  /** Die Sprechteile nacheinander: Stimme (wenn vorhanden) und Untertitel laufen zusammen */
  async function sprechenUndZeigen(huelle, untertitel, teile, kinder, abgebrochen) {
    for (const t of teile) {
      if (abgebrochen()) return;
      untertitel.className = 'cl-zs-text ' + (t.rolle || '');
      if (t.fluestern) k().spielen('fluestern');
      const tempo = t.rolle === 'geist' ? 60 : t.rolle === 'telefon' || t.rolle === 'funk' ? 34 : 28;
      const getippt = tippen(untertitel, t.text, tempo);
      const gesprochen = Clavis.stimme ? await Clavis.stimme.sprechen(t.text, t.rolle || (kinder ? 'kind' : 'erzaehler')) : false;
      await getippt;
      if (abgebrochen()) return;
      await warte(gesprochen ? 450 : 1300 + t.text.length * 40);
    }
  }

  function abspielen(spiel, o) {
    return new Promise((fertig) => {
      const kinder = o.alter === 'kinder';
      const raum = spiel.querySelector('.cl-raum');
      const nahName = NAH_FUER[o.wendung ? 'w_' + o.wendung : o.art];
      const nah = nahName && NAH[nahName] ? NAH[nahName](o.welt) : '';
      const teile = (o.sprache && o.sprache.length ? o.sprache : [{ text: String(o.text || ''), rolle: o.sprecher || (kinder ? 'kind' : 'erzaehler') }]).filter((t) => t.text);
      const untertitel = el('div', { class: 'cl-zs-text' });
      const weiter = el('button', { class: 'cl-zs-weiter', type: 'button' }, 'Überspringen ›');
      const huelle = el('div', { class: 'cl-zs' + (kinder ? ' kinder' : '') + (o.wendung ? ' wendung ' + (o.gut ? 'gut' : 'schlecht') : ' ereignis') + ' zs-' + (o.wendung || o.art), role: 'dialog', 'aria-label': o.titel || 'Zwischenszene' },
        el('div', { class: 'cl-zs-balken oben' }), el('div', { class: 'cl-zs-vignette' }),
        nah ? el('div', { class: 'cl-zs-nah' + (nahName === 'fenster' ? ' fenster-nah' : '') }) : null,
        o.titel ? el('div', { class: 'cl-zs-titel' }, o.titel) : null,
        el('div', { class: 'cl-zs-balken unten' }, untertitel, weiter));
      if (nah) huelle.querySelector('.cl-zs-nah').innerHTML = nah;
      // Klicks gehen nirgendwohin – nur der Knopf am Rand beendet die Szene
      huelle.addEventListener('pointerdown', (e) => { if (e.target !== weiter) { e.stopPropagation(); } }, true);
      huelle.addEventListener('click', (e) => { if (e.target !== weiter) { e.stopPropagation(); e.preventDefault(); } }, true);
      spiel.append(huelle);
      if (raum) raum.classList.add('film');
      requestAnimationFrame(() => huelle.classList.add('an'));
      const telefon = o.art === 'anruf' || o.art === 'funkspruch';
      if (telefon) {
        k().spielen(o.art === 'anruf' ? 'telefon' : 'funk');
        setTimeout(() => { if (!huelle.isConnected) return; huelle.classList.add('abgenommen'); k().spielen(o.art === 'anruf' ? 'klick' : 'funk'); }, 1600);
      }
      let ende = false;
      const schluss = () => {
        if (ende) return;
        ende = true;
        clearTimeout(notbremse);
        if (Clavis.stimme) Clavis.stimme.stopp();
        huelle.classList.remove('an');
        huelle.classList.add('weg');
        if (raum) raum.classList.remove('film');
        setTimeout(() => { huelle.remove(); fertig(); }, 650);
      };
      const notbremse = setTimeout(schluss, 45000);
      weiter.addEventListener('click', schluss);
      (async () => {
        await warte(telefon ? 1900 : 900);
        await sprechenUndZeigen(huelle, untertitel, teile, kinder, () => ende);
        if (!ende) { await warte(500); schluss(); }
      })();
    });
  }

  /** Eine Zwischenszene einreihen und abspielen (nacheinander, nie zwei auf einmal) */
  function zeigen(spiel, o) {
    return new Promise((fertig) => {
      schlange.push({ spiel, o, fertig });
      if (!laeuft) naechste();
    });
  }
  async function naechste() {
    const s = schlange.shift();
    if (!s) { laeuft = false; return; }
    laeuft = true;
    if (s.spiel.isConnected) { if (Clavis.stimme) Clavis.stimme.stopp(); if (s.o.vorher) try { s.o.vorher(); } catch (_) {} await abspielen(s.spiel, s.o); }
    s.fertig();
    naechste();
  }
  const aktiv = () => laeuft;

  // ---------------------------------------------------------------- Outro
  function outro(spiel, { raum, ergebnis, kinder }) {
    return new Promise((fertig) => {
      const geschafft = ergebnis && ergebnis.geschafft;
      const welt = raum.welt;
      let bild = '';
      try { bild = (Clavis.Kino.AUSSEN[welt] || Clavis.Kino.AUSSEN.akademie)(kinder).svg; } catch (_) { bild = ''; }
      const scheitern = ((Clavis.SCHEITERN || {})[welt]) || {};
      const text = geschafft ? (raum.outro || 'Die Tür springt auf – du bist frei.') : (kinder ? scheitern.kinder || 'Die Zeit ist um – aber du warst ganz nah dran! Nochmal?' : scheitern.text || 'Die Zeit ist abgelaufen. Die Tür bleibt zu.');
      const untertitel = el('div', { class: 'cl-zs-text' });
      const weiter = el('button', { class: 'cl-zs-weiter', type: 'button' }, 'Überspringen ›');
      const aussen = el('div', { class: 'cl-outro-aussen' });
      aussen.innerHTML = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" class="cl-aussen">${bild}</svg>`;
      const huelle = el('div', { class: `cl-zs cl-outro ${geschafft ? 'geschafft' : 'gescheitert'} welt-${welt}${kinder ? ' kinder' : ''}` },
        el('div', { class: 'cl-outro-blitz' }), el('div', { class: 'cl-outro-verfall' }), aussen, el('div', { class: 'cl-outro-morgen' }),
        el('div', { class: 'cl-zs-balken oben' }),
        el('div', { class: 'cl-outro-titel' }, el('small', {}, geschafft ? 'Entkommen' : 'Die Zeit ist um'), el('b', {}, geschafft ? (kinder ? 'Geschafft!' : 'Frei!') : (kinder ? 'Fast!' : 'Gefangen'))),
        el('div', { class: 'cl-zs-balken unten' }, untertitel, weiter));
      huelle.addEventListener('click', (e) => { if (e.target !== weiter) { e.stopPropagation(); e.preventDefault(); } }, true);
      spiel.append(huelle);
      requestAnimationFrame(() => huelle.classList.add('an'));
      if (geschafft) { k().spielen('tueroeffnen'); setTimeout(() => k().spielen(kinder ? 'fanfare' : 'erfolg'), 1400); }
      else { k().spielen('falle'); setTimeout(() => k().spielen(kinder ? 'plopp' : 'braam'), 900); }
      let ende = false;
      const schluss = () => { if (ende) return; ende = true; clearTimeout(t); if (Clavis.stimme) Clavis.stimme.stopp(); huelle.classList.add('weg'); setTimeout(() => { huelle.remove(); fertig(); }, 700); };
      const t = setTimeout(schluss, 45000);
      weiter.addEventListener('click', schluss);
      (async () => {
        await warte(2600);
        await sprechenUndZeigen(huelle, untertitel, [{ text, rolle: kinder ? 'kind' : 'erzaehler' }], kinder, () => ende);
        if (!ende) { await warte(1800); schluss(); }
      })();
    });
  }

  Clavis.Szenen = { zeigen, outro, aktiv };
})();
