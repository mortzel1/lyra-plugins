'use strict';
/* Gezeichnete Schauplätze: feste Kameras, Licht und Raumtiefe statt einer Reihe von Rätsel-Karten. */
(() => {
  let serie = 0;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
  const tree = (x, y, s, c, r = 0) => `<g transform="translate(${x} ${y}) scale(${s}) rotate(${r})"><path d="M-4 0 H4 L2 -156 H-2Z" fill="${c}"/><path d="M0 -230 L-32 -150 H-18 L-48 -105 H-28 L-65 -50 H-37 L-80 0 H80 L37 -50 H65 L28 -105 H48 L18 -150 H32Z" fill="${c}"/></g>`;
  const silhouette = (x, y, s = 1, cls = '') => `<g class="${cls}" transform="translate(${x} ${y}) scale(${s})"><ellipse cy="-56" rx="8" ry="11" fill="#080f11"/><path d="M-8 -45 Q-21 -31 -16 0 H16 Q21 -31 8 -45Z" fill="#080f11"/><path d="M-10 0 L-12 30 M10 0 L12 30" stroke="#080f11" stroke-width="8"/></g>`;
  function forest(r, proche = false) {
    let s = '';
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 14; i++) {
      const x = -80 + i * 100 + r() * 55, y = 380 + layer * 55, scale = 0.65 + layer * 0.35 + r() * 0.3;
      s += tree(x, y, scale, ['#203c40', '#142c31', '#0c1e23'][layer]);
    }
    if (proche) s += tree(35, 760, 3.4, '#050e13', 5) + tree(1240, 760, 3.2, '#050e13', -6);
    return s;
  }
  function cabin(r, power) {
    let s = '<path d="M400 525 V280 L665 120 L930 280 V525Z" fill="#17252a" stroke="#081319" stroke-width="9"/><path d="M363 281 L665 92 L967 281 L948 300 L665 127 L381 300Z" fill="#09161c"/>';
    for (let y = 287; y < 520; y += 18) s += `<path d="M408 ${y} H921" stroke="#354039" opacity=".35" stroke-width="3"/>`;
    for (const x of [448, 762]) s += rect(x - 8, 314, 126, 138, '#071217') + rect(x, 322, 110, 121, power ? '#a47b3d' : '#314a48') + `<path d="M${x + 55} 322 V443 M${x} 380 H${x + 110}" stroke="#111c1c" stroke-width="8"/>` + rect(x - 16, 443, 142, 10, '#0e191c');
    s += rect(609, 319, 116, 206, '#091419') + rect(619, 330, 96, 190, '#24332d') + rect(629, 340, 76, 94, '#101d20') + '<circle cx="698" cy="444" r="4" fill="#c39d64"/><path d="M589 525 H746 V546 H579Z" fill="#38423c"/><path d="M568 547 H756 V560 H555Z" fill="#222f30"/>';
    s += '<text x="665" y="277" font-family="Georgia,serif" font-size="19" letter-spacing="6" text-anchor="middle" fill="#b1ae92">FORSTREVIER 17</text>';
    if (power) s += '<path class="px-warmth" d="M448 443 L200 760 H870 L558 443Z" fill="#d49a4b" opacity=".055"/>';
    return s;
  }
  function room(r, power) {
    let s = rect(0, 0, 1280, 760, '#0b171d') + '<path d="M0 0 H1280 L1130 90 H150Z" fill="#101d20"/><path d="M0 0 L150 90 V510 L0 760Z" fill="#0a151a"/><path d="M1280 0 L1130 90 V510 L1280 760Z" fill="#101d21"/>' + rect(150, 90, 980, 420, '#20302d');
    for (let x = 155; x <= 1130; x += 35) s += `<path d="M${x} 90 V510" stroke="#0d2020" stroke-width="3"/>`;
    s += '<path d="M150 510 H1130 L1280 760 H0Z" fill="#1c2625"/>';
    for (let x = -900; x <= 2200; x += 160) s += `<path d="M640 400 L${x} 760" stroke="#080f12" stroke-width="3" opacity=".6"/>`;
    for (let y = 535; y < 760; y += (y - 490) * 0.42) s += `<path d="M0 ${y} H1280" stroke="#080f12" stroke-width="2"/>`;
    s += rect(820, 145, 240, 240, '#071119') + '<svg x="830" y="155" width="220" height="220" viewBox="0 0 300 300"><rect width="300" height="300" fill="#203a41"/>' + tree(65, 310, 1.4, '#0b2027') + tree(180, 330, 1.6, '#0c1b23') + '</svg><path d="M940 145 V385 M820 265 H1060" stroke="#09161c" stroke-width="12"/>' + rect(804, 385, 272, 14, '#0c191c');
    if (power) s += '<ellipse cx="550" cy="280" rx="540" ry="350" fill="#d09c50" opacity=".055"/>';
    return s;
  }
  const PAPER = '<g transform="translate(280 465) rotate(-5)"><rect width="150" height="110" fill="#b5b197"/><path d="M18 20 H128 M18 38 H110 M18 56 H132 M18 74 H100" stroke="#4e5648" stroke-width="3" opacity=".6"/></g>';
  function bild(ort, zustand = {}) {
    const id = 'px' + (++serie), r = Clavis.zufall([...ort].reduce((a, c) => a * 31 + c.charCodeAt(0), 1717) >>> 0);
    const solved = zustand.geloest || {}, choices = zustand.entscheidungen || {}, power = !!solved.strom;
    let s = `<defs><linearGradient id="${id}s" x2="0" y2="1"><stop stop-color="#172d3d"/><stop offset="1" stop-color="#49605a"/></linearGradient><radialGradient id="${id}v"><stop offset=".25" stop-color="#020b10" stop-opacity="0"/><stop offset="1" stop-color="#02070d" stop-opacity=".8"/></radialGradient><linearGradient id="${id}w" x2="0" y2="1"><stop stop-color="#9bb8b1" stop-opacity=".35"/><stop offset="1" stop-color="#203e45" stop-opacity=".1"/></linearGradient></defs>`;
    if (['hof', 'pfad', 'wehr', 'turm', 'straße'].includes(ort)) s += rect(0, 0, 1280, 760, `url(#${id}s)`) + '<circle cx="915" cy="120" r="43" fill="#cad6cb" opacity=".37"/><ellipse cx="900" cy="140" rx="300" ry="38" fill="#273e4b" opacity=".65"/>' + forest(r);
    else s += room(r, power);
    if (ort === 'hof' || ort === 'straße') {
      s += '<path d="M0 525 Q540 460 1280 525 V760 H0Z" fill="#14272b"/><path d="M510 760 L616 520 H711 L875 760Z" fill="#35433e" opacity=".7"/>' + cabin(r, power);
      s += '<g transform="translate(145 480)"><path d="M-10 52 L26 2 H197 L247 52 V128 H-10Z" fill="#223631" stroke="#0a181d" stroke-width="5"/><path d="M36 10 H186 L218 54 H8Z" fill="#101e28"/><path d="M112 10 V54" stroke="#35443b" stroke-width="5"/><rect x="9" y="74" width="218" height="37" rx="4" fill="#172724"/><path d="M47 78 V104 M67 78 V104 M87 78 V104 M107 78 V104 M127 78 V104 M147 78 V104 M167 78 V104" stroke="#0b1619" stroke-width="5"/><rect x="8" y="63" width="32" height="17" fill="#b3aa82" opacity=".4"/><rect x="193" y="63" width="32" height="17" fill="#b3aa82" opacity=".4"/><rect x="4" y="111" width="30" height="50" fill="#071116"/><rect x="199" y="111" width="30" height="50" fill="#071116"/></g>';
      s += '<path d="M966 370 V590" stroke="#303c32" stroke-width="11"/><path d="M900 379 L1035 370 L1044 440 L906 453Z" fill="#76826a"/><text x="969" y="408" text-anchor="middle" font-size="12" letter-spacing="2" fill="#1a2926">SPERRGEBIET</text><text x="972" y="428" text-anchor="middle" font-size="10" fill="#1a2926">REVIER 17</text>' + tree(13, 770, 3.3, '#06131b') + tree(1300, 790, 3.8, '#06131b');
    } else if (ort === 'buero') {
      s += '<path d="M225 455 H1000 L1100 550 H157Z" fill="#5c5140"/><path d="M157 550 H1100 V575 H157Z" fill="#263329"/><path d="M200 575 V745 M1040 575 V745" stroke="#172521" stroke-width="28"/>';
      s += '<g transform="translate(218 235)"><rect width="165" height="140" fill="#142827" stroke="#8b8b68" stroke-width="7"/><path d="M14 110 Q80 33 151 55 M28 7 V132 M55 7 V132 M82 7 V132 M109 7 V132 M136 7 V132 M7 25 H158 M7 50 H158 M7 75 H158 M7 100 H158 M7 125 H158" stroke="#8b9b7c" stroke-width="1" opacity=".5"/></g>';
      s += rect(532, 224, 145, 152, '#132524', 'stroke="#65705b" stroke-width="5"') + [0, 1, 2, 3, 4, 5].map(i => `<rect x="${550 + (i % 3) * 38}" y="${249 + Math.floor(i / 3) * 62}" width="18" height="29" rx="3" fill="${power && i < 3 ? '#8cbd82' : '#394b43'}"/><circle cx="${559 + (i % 3) * 38}" cy="${239 + Math.floor(i / 3) * 62}" r="4" fill="${power ? '#b8bc7c' : '#596359'}"/>`).join('');
      s += '<path d="M720 472 V407 L680 386" stroke="#263c32" stroke-width="10"/><path d="M650 370 H717 L735 405 H630Z" fill="#69856c"/><ellipse cx="686" cy="405" rx="50" ry="8" fill="#d6bb7c" opacity=".45"/><path d="M655 410 L530 520 H864 L717 410Z" fill="#d6bb7c" opacity=".07"/>' + PAPER + '<g transform="translate(897 463) rotate(8)"><rect width="80" height="55" fill="#d1bba1"/><rect x="6" y="5" width="68" height="42" fill="#2c413c"/><circle cx="26" cy="23" r="8" fill="#9e9680"/><circle cx="47" cy="20" r="8" fill="#8f9d84"/></g>';
    } else if (ort === 'funk') {
      s += '<path d="M140 474 H1135 L1250 620 H40Z" fill="#4b493a"/><path d="M40 620 H1250 V648 H40Z" fill="#1b302a"/>';
      s += '<g transform="translate(403 336)"><rect width="305" height="175" rx="9" fill="#263f37" stroke="#0a181b" stroke-width="7"/><rect x="18" y="17" width="269" height="65" fill="#081e20"/><path class="px-wave" d="M28 50 h30 l10 -20 12 40 11 -30 10 10 h30 l12 -15 10 30 10 -15 h95" fill="none" stroke="#9cc49a" stroke-width="2"/><text x="153" y="70" text-anchor="middle" font-size="12" letter-spacing="3" fill="#9cc49a">REVIER · NACHTKANAL</text><circle cx="64" cy="130" r="30" fill="#0b1e23" stroke="#657567" stroke-width="3"/><circle cx="244" cy="130" r="30" fill="#0b1e23" stroke="#657567" stroke-width="3"/><rect x="112" y="109" width="75" height="40" fill="#091b1d"/><path d="M150 109 V149" stroke="#475e4d" stroke-width="2"/></g>';
      s += '<g transform="translate(160 443)"><rect width="210" height="110" rx="4" fill="#5b5847"/>' + [53, 157].map(x => `<g class="px-reel" style="transform-origin:${x}px 42px"><circle cx="${x}" cy="42" r="36" fill="#a6a68b"/><circle cx="${x}" cy="42" r="27" fill="#39483d"/><path d="M${x} 10 V74 M${x - 30} 42 H${x + 30}" stroke="#8f9c80" stroke-width="5"/><circle cx="${x}" cy="42" r="8" fill="#141e1d"/></g>`).join('') + '<path d="M53 78 H157" stroke="#141e1d" stroke-width="3"/><rect x="70" y="88" width="70" height="12" fill="#1b3027"/></g>';
      s += '<g transform="translate(900 225) rotate(2)"><rect width="156" height="142" fill="#b9b897"/><text x="78" y="28" text-anchor="middle" font-size="15" fill="#283a30">NACHTFREQUENZ</text><path d="M18 47 H136 M18 70 H130 M18 93 H136 M18 116 H92" stroke="#5d6c53" stroke-width="3"/></g>';
    } else if (ort === 'pfad') {
      s += '<path d="M535 430 Q680 500 615 760 H290 Q470 570 535 430Z" fill="#3a463b"/><path d="M535 430 Q790 500 1040 760 H760 Q620 520 535 430Z" fill="#253c34"/>' + forest(r, true);
      s += '<path d="M395 760 Q348 410 429 0" stroke="#727f72" stroke-width="54"/><path d="M397 460 l30 -9 M390 440 l30 -9 M385 420 l30 -9 M408 305 l20 -6" stroke="#172e2e" stroke-width="7"/><path d="M847 390 L809 580 L857 620 L903 580 L885 388Z" fill="#536650" stroke="#152b26" stroke-width="5"/><path d="M847 390 L866 460 L885 388" fill="#1a342c"/>';
      s += '<path d="M654 395 V529 M605 415 L708 400 L714 437 L611 451Z" fill="#374b35" stroke="#1a3028" stroke-width="7"/><text x="657" y="433" text-anchor="middle" font-size="15" fill="#a6b09a">ALTES WEHR</text>';
      if (choices.funk === 'antworten') s += silhouette(1020, 490, .65, 'px-watcher');
    } else if (ort === 'wehr') {
      s += '<path d="M0 540 L280 470 L510 570 L850 500 L1280 580 V760 H0Z" fill="#1b3231"/><path d="M410 500 L830 495 L1110 760 H220Z" fill="#31565c"/><path class="px-water" d="M445 555 Q600 580 820 550 M400 620 Q620 650 900 615 M320 710 Q640 740 1020 700" fill="none" stroke="#a9c4b8" opacity=".25" stroke-width="3"/>';
      s += '<path d="M240 450 H1100 L1140 505 H210Z" fill="#6c7761"/><path d="M240 505 V575 H450 V520 H820 V575 H1100 V505Z" fill="#3e5145"/><path d="M250 455 H1100 M270 450 V370 M1060 450 V370 M270 389 H1060" stroke="#263d35" stroke-width="12"/>';
      s += '<path d="M740 330 V198 L890 122 L1040 198 V413 H740Z" fill="#334840"/><path d="M721 200 L891 107 L1058 200Z" fill="#10262a"/>' + rect(805, 232, 145, 181, '#0b2024') + [0, 1, 2, 3, 4, 5].map(i => `<path d="M${815 + i * 24} 235 V410" stroke="#4f6557" stroke-width="7"/>`).join('');
      if (choices.nora !== 'retten') s += '<path d="M862 390 q-14 -36 7 -48 q28 -8 34 17 l-6 31Z" fill="#5e6a4e"/><circle cx="877" cy="331" r="11" fill="#9caa88"/>';
      s += '<g transform="translate(510 409)"><rect x="-66" y="-35" width="246" height="112" rx="4" fill="#1e3835"/>' + [0, 1, 2].map(i => `<g transform="translate(${i * 72} 20)"><circle r="26" fill="none" stroke="#9b7555" stroke-width="7"/><path d="M-26 0 H26 M0 -26 V26" stroke="#8a7255" stroke-width="5"/><circle r="7" fill="#6b6a53"/></g>`).join('') + '</g>';
      s += '<path d="M298 312 L390 290 L411 402 L287 412Z" fill="#6b7a64"/><path d="M307 335 l13 -12 13 12 -13 12Z M349 329 l11 15 -11 12 -11 -12Z M307 375 h22 M350 370 l10 -12 10 12 -10 12Z" fill="none" stroke="#bac1a4" opacity=".55" stroke-width="3"/>';
    } else if (ort === 'keller') {
      s += rect(150, 90, 980, 420, '#233c39');
      for (let y = 100; y < 510; y += 42) s += `<path d="M150 ${y} H1130" stroke="#0e2326" stroke-width="3"/>` + Array.from({ length: 8 }, (_, i) => `<path d="M${150 + i * 135 + (y % 84 ? 65 : 0)} ${y} v42" stroke="#0e2326" stroke-width="3"/>`).join('');
      s += '<path d="M590 90 V164 Q590 190 650 190 H730 V360" fill="none" stroke="#1a292c" stroke-width="18"/><path d="M790 90 V160 H1020 V390" fill="none" stroke="#38483b" stroke-width="11"/>';
      s += '<g transform="translate(610 272)"><rect width="238" height="235" fill="#10272a" stroke="#516a57" stroke-width="7"/>' + Array.from({ length: 18 }, (_, i) => `<circle cx="${25 + (i % 6) * 38}" cy="${35 + Math.floor(i / 6) * 62}" r="9" fill="${solved.relais ? '#a7c587' : i % 3 ? '#516d56' : '#aa7357'}" class="${solved.relais ? '' : 'px-led'}" style="animation-delay:-${i * .17}s"/>`).join('') + '</g>';
      s += '<g transform="translate(240 270)"><rect width="220" height="177" fill="#68654e" stroke="#1b302b" stroke-width="8"/>' + Array.from({ length: 6 }, (_, i) => `<rect x="${13 + i % 3 * 68}" y="${14 + Math.floor(i / 3) * 78}" width="57" height="66" fill="#b9b99b" transform="rotate(${i % 2 ? 4 : -3} ${13 + i % 3 * 68} ${14 + Math.floor(i / 3) * 78})"/>`).join('') + '</g>';
      s += '<g transform="translate(941 260) rotate(3)"><rect width="110" height="150" fill="#a5ad91"/><path d="M20 25 H90 M20 48 H80 M20 70 H90 M20 95 H75 M20 120 H90" stroke="#415f4c" stroke-width="3"/></g><path d="M148 510 L255 648 H455 L400 510Z" fill="#3e4635"/><circle cx="256" cy="565" r="22" fill="#849171"/><circle cx="333" cy="565" r="22" fill="#849171"/>';
    } else if (ort === 'turm') {
      s += '<path d="M0 490 Q300 330 640 410 Q980 300 1280 460 V760 H0Z" fill="#0c282b"/>';
      for (let i = 0; i < 30; i++) s += tree(i * 49, 630 + r() * 100, .7 + r() * .4, '#0a2024');
      s += '<path d="M0 610 L1280 610 V760 H0Z" fill="#304139"/><path d="M0 590 H1280 M0 500 H1280" stroke="#526558" stroke-width="14"/>' + [0, 200, 400, 600, 800, 1000, 1280].map(x => `<path d="M${x} 500 V760" stroke="#344e43" stroke-width="17"/>`).join('');
      s += '<path d="M282 760 L411 490 H620 L750 760Z" fill="#203b34"/><g transform="translate(408 310)"><rect width="215" height="190" rx="8" fill="#263d33" stroke="#7b8060" stroke-width="5"/><circle cx="106" cy="75" r="56" fill="#a2aa7c" opacity=".55"/><circle cx="106" cy="75" r="44" fill="#c4c59b" opacity=".55"/><path d="M48 75 H165 M106 19 V131" stroke="#344e3d" stroke-width="6"/><rect x="48" y="149" width="117" height="20" fill="#101f22"/></g>';
      s += '<path d="M560 0 L510 300 M490 0 L490 300" stroke="#172d29" stroke-width="12"/><path d="M535 30 h-80 M529 75 h-80 M520 120 h-80" stroke="#3a5544" stroke-width="4"/>';
      if (solved.leuchtfeuer) s += '<path class="px-beacon" d="M514 380 L1180 60 L1280 300Z" fill="#e7dca5" opacity=".16"/><circle cx="1090" cy="465" r="4" fill="#f8e7b4"/><path d="M1090 465 L900 520 L1280 520Z" fill="#dddfb3" opacity=".08"/>';
      if (choices.nora === 'retten') s += silhouette(290, 605, 1.2);
    }
    s += rect(0, 0, 1280, 760, `url(#${id}v)`);
    return `<svg class="px-art" viewBox="0 0 1280 760" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(({ hof: 'Das Forsthaus zwischen hohen Nadelbäumen', buero: 'Noras verlassene Nachtwache', funk: 'Analoge Funkgeräte und Magnetbänder', pfad: 'Zwei schmale Pfade im dunklen Wald', wehr: 'Das Pegelhaus über dem Waldbach', keller: 'Rufanlage und Archiv unter dem Haus', turm: 'Der Feuerturm über den Baumkronen' })[ort] || 'Eine Straße durch den Wald')}">${s}</svg>`;
  }
  Clavis.PremiumWelt = { bild };
})();
