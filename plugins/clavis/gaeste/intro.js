'use strict';
/*
 * Clavis – das Kino-Intro mit Bildern: eine Außenansicht jeder Welt (gezeichnet, mit Wetter und Bewegung), die Kamera fährt auf
 * die Tür zu, hinein in den dunklen Raum (dieselbe Kulisse wie im Spiel), eine Taschenlampe streift durch – dann der Titel.
 *
 *   Clavis.Kino.zeigen(wurzel, { raum, kinder, zeilen, titelBlock, beiTakt(ms, f), ton(name) })
 */
(() => {
  const { el } = Clavis;
  let nr = 0;
  const id = (p) => `${p}k${++nr}`;
  const R = (a, b) => a + Math.random() * (b - a);
  const sterne = (n, h = 500) => Array.from({ length: n }, () => `<circle cx="${R(0, 1600).toFixed(0)}" cy="${R(0, h).toFixed(0)}" r="${R(0.6, 2).toFixed(1)}" fill="#fff" class="cl-a-funkeln" style="animation-delay:${R(0, 4).toFixed(1)}s"/>`).join('');
  const himmel = (g, oben, unten, mitte) => `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${oben}"/>${mitte ? `<stop offset="0.6" stop-color="${mitte}"/>` : ''}<stop offset="1" stop-color="${unten}"/></linearGradient></defs><rect width="1600" height="900" fill="url(#${g})"/>`;
  const mond = (x, y, r2, farbe = '#f6f0d4') => `<circle cx="${x}" cy="${y}" r="${r2 * 3}" fill="${farbe}" opacity="0.08"/><circle cx="${x}" cy="${y}" r="${r2}" fill="${farbe}"/><circle cx="${x - r2 * 0.3}" cy="${y - r2 * 0.2}" r="${r2 * 0.18}" fill="#000" opacity="0.08"/><circle cx="${x + r2 * 0.3}" cy="${y + r2 * 0.25}" r="${r2 * 0.12}" fill="#000" opacity="0.08"/>`;
  const fenster = (x, y, w, h, farbe = '#ffcf6a', klasse = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${farbe}" class="${klasse}"/>`;
  const fensterReihe = (x0, y0, nx, ny, w, h, dx, dy, an = 0.4, farbe = '#ffcf6a') => {
    let s = '';
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) s += fenster(x0 + i * dx, y0 + j * dy, w, h, Math.random() < an ? farbe : '#11131c', Math.random() < 0.15 ? 'cl-a-flackern' : '');
    return s;
  };

  // ---------------------------------------------------------------- Außenansichten (1600×900) – fokus: wohin die Kamera fährt
  const AUSSEN = {
    krimi: (k) => ({ fokus: [33, 47], wetter: 'regen', svg: himmel(id('h'), '#0e1422', '#2a2436') +
      `<g class="e1">${Array.from({ length: 14 }, (_, i) => { const x = i * 120 - 20; const h = R(260, 520); return `<rect x="${x}" y="${900 - h - 160}" width="${R(90, 130).toFixed(0)}" height="${h.toFixed(0)}" fill="#0b0e18"/>` + fensterReihe(x + 10, 900 - h - 140, 4, Math.floor(h / 50), 10, 16, 24, 40, 0.18, '#f3c46b'); }).join('')}</g>` +
      `<g class="e2"><rect x="300" y="200" width="460" height="560" fill="#2a1c18"/>${Array.from({ length: 22 }, (_, j) => `<line x1="300" y1="${210 + j * 25}" x2="760" y2="${210 + j * 25}" stroke="#1d130f" stroke-width="2"/>`).join('')}` +
      `<rect x="420" y="330" width="220" height="150" fill="#ffcf6a" class="cl-a-flackern-sanft"/>${Array.from({ length: 9 }, (_, j) => `<rect x="420" y="${336 + j * 16}" width="220" height="7" fill="#3a2414" opacity="0.85"/>`).join('')}` +
      `<path d="M500 480 v-60 q0 -20 18 -20 q18 0 18 20 v60 Z" fill="#1a120c" opacity="0.8"/><text x="530" y="470" text-anchor="middle" font-family="Didot,Georgia,serif" font-size="22" fill="#2a1c10" opacity="0.8">DETEKTEI</text>` +
      `<rect x="400" y="320" width="260" height="10" fill="#1a110c"/><rect x="470" y="600" width="120" height="160" fill="#140d09"/><rect x="480" y="610" width="100" height="70" fill="#ffcf6a" opacity="0.25"/>` +
      `<g class="cl-a-neon"><rect x="1030" y="250" width="270" height="80" rx="10" fill="none" stroke="#ff3d5a" stroke-width="6"/><text x="1165" y="306" text-anchor="middle" font-family="Futura,Arial,sans-serif" font-size="52" font-weight="700" fill="#ff3d5a">HOTEL</text></g>` +
      `<rect x="1000" y="340" width="330" height="420" fill="#1a1620"/>${fensterReihe(1020, 360, 5, 6, 30, 40, 62, 66, 0.3)}</g>` +
      `<g class="e3"><rect x="0" y="760" width="1600" height="140" fill="#0d0f16"/><rect x="0" y="760" width="1600" height="140" fill="#ffcf6a" opacity="0.04"/>` +
      `<path d="M880 900 L880 420 Q880 400 900 400 L960 400" stroke="#0a0a0e" stroke-width="12" fill="none"/><path d="M930 400 h60 l-10 18 h-40 Z" fill="#0a0a0e"/><path d="M940 418 L860 900 H1080 Z" fill="#ffe6a0" opacity="0.08"/>` +
      `<ellipse cx="960" cy="830" rx="180" ry="16" fill="#ffe6a0" opacity="0.12"/><ellipse cx="530" cy="840" rx="160" ry="12" fill="#ffcf6a" opacity="0.1"/><ellipse cx="1165" cy="860" rx="160" ry="10" fill="#ff3d5a" opacity="0.12"/>` +
      `<path d="M120 900 q10 -120 60 -150 q30 -10 50 10 l30 140 Z" fill="#050508"/><ellipse cx="190" cy="740" rx="70" ry="12" fill="#050508"/></g>` }),
    labor: (k) => ({ fokus: [50, 63], wetter: 'nebel', svg: himmel(id('h'), '#04101a', '#10262c') + sterne(40, 400) +
      `<g class="cl-a-suchlicht" style="transform-origin:1180px 520px"><path d="M1180 520 L900 0 L1060 0 Z" fill="#bffff0" opacity="0.08"/></g>` +
      `<g class="e1"><path d="M0 700 Q400 640 800 690 T1600 670 V900 H0 Z" fill="#071418"/></g>` +
      `<g class="e2"><rect x="380" y="420" width="840" height="300" fill="#0e1c20"/><rect x="380" y="410" width="840" height="14" fill="#1c3238"/>${fensterReihe(420, 460, 12, 3, 40, 26, 64, 54, 0.45, '#39f5c6')}` +
      `<rect x="740" y="590" width="120" height="130" fill="#061012"/><rect x="750" y="600" width="100" height="120" fill="#39f5c6" opacity="0.22" class="cl-a-gluehen"/>` +
      `<rect x="1160" y="160" width="10" height="260" fill="#1c3238"/><path d="M1130 420 L1165 160 L1200 420" stroke="#1c3238" stroke-width="4" fill="none"/><circle cx="1165" cy="156" r="8" fill="#ff3d5a" class="cl-a-blinken"/>` +
      `<rect x="1150" y="500" width="60" height="44" fill="#ffd166"/><path d="M1180 506 l18 32 h-36 Z" fill="#111"/><text x="1180" y="534" text-anchor="middle" font-size="20" font-weight="900" fill="#ffd166">!</text></g>` +
      `<g class="e3"><rect x="0" y="790" width="1600" height="110" fill="#030a0c"/>${Array.from({ length: 34 }, (_, i) => `<rect x="${i * 48}" y="700" width="4" height="100" fill="#0a1a1c"/>`).join('')}<path d="M0 712 H1600 M0 750 H1600" stroke="#0a1a1c" stroke-width="3"/>` +
      `<path d="M0 700 L1600 700" stroke="#0f2628" stroke-width="1" stroke-dasharray="6 6"/></g>` }),
    grab: (k) => ({ fokus: [52, 66], wetter: 'sand', svg: himmel(id('h'), k ? '#22305e' : '#0c0a1e', k ? '#c58a5a' : '#5a3a3a', k ? '#5a4a8a' : '#2a1d36') + sterne(70, 450) + mond(1260, 180, 70) +
      `<g class="e1"><path d="M0 640 Q300 560 600 620 T1200 600 T1600 620 V900 H0 Z" fill="#4a2e1e"/></g>` +
      `<g class="e2"><path d="M520 700 L840 200 L1160 700 Z" fill="#8a6038"/><path d="M840 200 L1160 700 L960 700 Z" fill="#5e3e22"/>${Array.from({ length: 14 }, (_, j) => `<line x1="${840 - (j + 1) * 22.8}" y1="${200 + (j + 1) * 35.7}" x2="${840 + (j + 1) * 22.8}" y2="${200 + (j + 1) * 35.7}" stroke="#6a4628" stroke-width="2"/>`).join('')}` +
      `<path d="M800 700 V620 Q800 590 832 590 Q864 590 864 620 V700 Z" fill="#1a0e06"/><path d="M806 700 V624 Q806 598 832 598 Q858 598 858 624 V700 Z" fill="#ff9a3a" opacity="0.45" class="cl-a-flackern-sanft"/>` +
      `<path d="M240 700 L380 480 L520 700 Z" fill="#6a4a2a" opacity="0.8"/></g>` +
      `<g class="e3"><path d="M0 760 Q400 700 800 760 T1600 740 V900 H0 Z" fill="#a8743e"/><path d="M0 820 Q500 780 1000 830 T1600 810 V900 H0 Z" fill="#c48a4a"/>` +
      `<path d="M140 760 q4 -140 -10 -220 M130 540 q-60 -10 -90 30 M130 540 q60 -20 90 20 M130 540 q-30 -40 -80 -40 M130 540 q40 -50 90 -40 M130 540 q0 -40 10 -70" stroke="#2a1a0c" stroke-width="12" fill="none" stroke-linecap="round"/>` +
      `<path d="M1440 770 q4 -110 -8 -170 M1432 600 q-50 -8 -70 24 M1432 600 q50 -16 70 16 M1432 600 q-24 -32 -64 -32 M1432 600 q32 -40 72 -32" stroke="#2a1a0c" stroke-width="10" fill="none" stroke-linecap="round"/></g>` }),
    station: (k) => ({ fokus: [50, 44], wetter: 'sterne', svg: `<rect width="1600" height="900" fill="#02030a"/>${sterne(160, 900)}` +
      `<defs><radialGradient id="erdeK" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#7fd0ff"/><stop offset="0.5" stop-color="#1f6fb8"/><stop offset="1" stop-color="#041026"/></radialGradient></defs>` +
      `<g class="e1"><circle cx="800" cy="1700" r="1000" fill="url(#erdeK)"/><circle cx="800" cy="1700" r="1012" fill="none" stroke="#9fdcff" stroke-width="10" opacity="0.35"/>` +
      `<path d="M300 760 q120 -40 260 -10 q120 30 240 -10 q120 -40 300 0" stroke="#4caf6e" stroke-width="40" fill="none" opacity="0.4" stroke-linecap="round"/><circle cx="1500" cy="120" r="40" fill="#fff6d6"/><circle cx="1500" cy="120" r="160" fill="#fff6d6" opacity="0.08"/></g>` +
      `<g class="e2 cl-a-schweben-langsam"><g class="cl-a-drehen-ring" style="transform-origin:800px 400px"><ellipse cx="800" cy="400" rx="360" ry="90" fill="none" stroke="#8a98a8" stroke-width="22"/><ellipse cx="800" cy="400" rx="360" ry="90" fill="none" stroke="#c9d3de" stroke-width="4"/>` +
      `${[0, 60, 120, 180, 240, 300].map((a) => `<line x1="800" y1="400" x2="${800 + Math.cos(a * Math.PI / 180) * 360}" y2="${400 + Math.sin(a * Math.PI / 180) * 90}" stroke="#6a7888" stroke-width="6"/>`).join('')}</g>` +
      `<rect x="740" y="300" width="120" height="200" rx="20" fill="#c9d3de"/><rect x="760" y="330" width="80" height="20" fill="#ff9f1c" class="cl-a-blinken"/>${[0, 1, 2].map((i) => `<circle cx="800" cy="${380 + i * 36}" r="10" fill="#5ad2ff" opacity="0.8"/>`).join('')}` +
      `<rect x="380" y="372" width="300" height="56" fill="#1f3a6a" stroke="#8a98a8" stroke-width="3"/>${Array.from({ length: 10 }, (_, i) => `<line x1="${380 + i * 30}" y1="372" x2="${380 + i * 30}" y2="428" stroke="#8a98a8" stroke-width="1.5"/>`).join('')}` +
      `<rect x="920" y="372" width="300" height="56" fill="#1f3a6a" stroke="#8a98a8" stroke-width="3"/>${Array.from({ length: 10 }, (_, i) => `<line x1="${920 + i * 30}" y1="372" x2="${920 + i * 30}" y2="428" stroke="#8a98a8" stroke-width="1.5"/>`).join('')}` +
      `<circle cx="800" cy="290" r="6" fill="#ff3d5a" class="cl-a-blinken"/></g>` }),
    spuk: (k) => ({ fokus: [50, 60], wetter: k ? 'sterne' : 'gewitter', svg: himmel(id('h'), k ? '#2a2a6a' : '#0a0912', k ? '#5a4a8a' : '#1e1a2a') + sterne(50, 400) + mond(1240, 170, 90, k ? '#fff6c8' : '#f0ead0') +
      `<g class="e1"><path d="M0 700 Q400 520 800 540 T1600 680 V900 H0 Z" fill="${k ? '#2a3a4a' : '#0c0b12'}"/></g>` +
      `<g class="e2"><rect x="520" y="330" width="560" height="320" fill="${k ? '#5a4a7a' : '#16141e'}"/><path d="M500 340 L800 170 L1100 340 Z" fill="${k ? '#4a3a6a' : '#0f0e16'}"/>` +
      `<rect x="560" y="200" width="70" height="200" fill="${k ? '#5a4a7a' : '#16141e'}"/><path d="M550 210 L595 120 L640 210 Z" fill="${k ? '#ff6b9a' : '#0f0e16'}"/><rect x="980" y="230" width="60" height="160" fill="${k ? '#5a4a7a' : '#16141e'}"/><path d="M970 240 L1010 160 L1050 240 Z" fill="${k ? '#6bc7ff' : '#0f0e16'}"/>` +
      `${[[590, 260], [1000, 290], [600, 400], [700, 400], [900, 400], [1000, 400], [600, 520], [1000, 520]].map(([x, y], i) => `<path d="M${x} ${y + 60} V${y + 14} Q${x + 20} ${y - 6} ${x + 40} ${y + 14} V${y + 60} Z" fill="${i === 3 ? '#ffb347' : k ? '#ffe08a' : '#0a0910'}" class="${i === 3 ? 'cl-a-flackern' : ''}"/>`).join('')}` +
      `<path d="M760 650 V560 Q800 520 840 560 V650 Z" fill="#0a0806"/>` +
      `${k ? '' : '<g class="cl-schemen-fenster"><path d="M712 470 q8 -16 16 0 v20 h-16 Z" fill="#000"/></g>'}</g>` +
      `<g class="e3"><path d="M0 900 V760 Q400 720 800 740 T1600 760 V900 Z" fill="${k ? '#1f3a2a' : '#050408'}"/>` +
      `<path d="M180 760 q-10 -160 20 -260 M200 520 q-60 -40 -110 -30 M190 600 q50 -30 100 -20 M205 470 q30 -60 80 -70" stroke="#050408" stroke-width="16" fill="none" stroke-linecap="round"/>` +
      `<path d="M1380 770 q10 -150 -16 -250 M1370 560 q60 -40 110 -24 M1376 620 q-50 -20 -96 -6" stroke="#050408" stroke-width="14" fill="none" stroke-linecap="round"/>` +
      `${Array.from({ length: 30 }, (_, i) => `<path d="M${i * 54} 900 V800 l8 -16 l8 16 V900" fill="#050408"/>`).join('')}</g>` }),
    bibliothek: (k) => ({ fokus: [50, 68], wetter: 'blaetter', svg: himmel(id('h'), '#141a33', '#3a2a3a') + sterne(40, 380) + mond(300, 160, 60) +
      `<g class="e2"><rect x="400" y="360" width="800" height="380" fill="#2a2024"/><path d="M380 370 L800 250 L1220 370 Z" fill="#20181c"/>` +
      `<rect x="730" y="80" width="140" height="300" fill="#2a2024"/><path d="M720 90 L800 0 L880 90 Z" fill="#20181c"/><circle cx="800" cy="170" r="44" fill="#efe6cf"/><circle cx="800" cy="170" r="44" fill="none" stroke="#8a6a3a" stroke-width="6"/><line x1="800" y1="170" x2="800" y2="138" stroke="#2a1a10" stroke-width="5"/><line x1="800" y1="170" x2="824" y2="182" stroke="#2a1a10" stroke-width="4"/>` +
      `${[460, 560, 660, 880, 980, 1080].map((x) => `<path d="M${x} 640 V470 Q${x + 30} 420 ${x + 60} 470 V640 Z" fill="#ffcf6a" opacity="${R(0.5, 0.95).toFixed(2)}" class="${Math.random() < 0.3 ? 'cl-a-flackern-sanft' : ''}"/><path d="M${x + 30} 440 V640 M${x} 540 H${x + 60}" stroke="#2a2024" stroke-width="5"/>`).join('')}` +
      `<path d="M740 740 V650 Q800 590 860 650 V740 Z" fill="#140c08"/><rect x="380" y="730" width="840" height="20" fill="#3a2e30"/></g>` +
      `<g class="e3"><rect x="0" y="750" width="1600" height="150" fill="#0f0c12"/>${[[200, 520], [1380, 540]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="120" fill="#0c0a10"/><circle cx="${x + 70}" cy="${y + 50}" r="90" fill="#0c0a10"/><rect x="${x - 10}" y="${y + 60}" width="24" height="200" fill="#0c0a10"/>`).join('')}` +
      `<path d="M700 900 L760 750 H840 L900 900 Z" fill="#1a1416"/></g>` }),
    pirat: (k) => ({ fokus: [58, 52], wetter: k ? 'sterne' : 'regen', svg: himmel(id('h'), '#0a1428', '#22385a') + sterne(60, 420) + mond(1300, 150, 64) +
      `<g class="e1"><path d="M0 600 H1600 V900 H0 Z" fill="#0c2238"/><rect x="1270" y="600" width="60" height="260" fill="#f6efd2" opacity="0.08"/></g>` +
      `<g class="e2"><path d="M560 700 Q600 520 820 500 L1180 470 Q1180 600 1100 680 Z" fill="#3a2414"/><path d="M560 700 Q600 520 820 500 L1180 470" stroke="#5a3a1c" stroke-width="10" fill="none"/>` +
      `${Array.from({ length: 6 }, (_, i) => `<line x1="${640 + i * 90}" y1="${560 - i * 6}" x2="${630 + i * 90}" y2="${660 - i * 4}" stroke="#2a180c" stroke-width="5"/>`).join('')}` +
      `<line x1="840" y1="500" x2="800" y2="160" stroke="#2a180c" stroke-width="14"/><path d="M800 200 Q880 260 860 360 L806 340 Z" fill="#c8b89a" opacity="0.7"/><path d="M790 160 h60 l-6 14 h-48 Z" fill="#111"/>` +
      `<line x1="1020" y1="480" x2="1080" y2="260" stroke="#2a180c" stroke-width="10"/><path d="M1078 270 l-40 4 l2 30 l40 -6 Z" fill="#111"/><circle cx="1058" cy="286" r="5" fill="#eee"/>` +
      `<rect x="920" y="520" width="26" height="36" rx="4" fill="#1a1a1a"/><rect x="924" y="524" width="18" height="26" fill="#ffcf6a" class="cl-a-flackern-sanft"/><circle cx="933" cy="537" r="60" fill="#ffcf6a" opacity="0.12"/></g>` +
      `<g class="e3"><g class="cl-a-welle-gross"><path d="M-200 740 q50 -24 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 V900 H-200 Z" fill="#0f2c48"/></g>` +
      `<path d="M0 900 L60 720 L180 760 L260 690 L380 900 Z" fill="#0a0c10"/><path d="M1280 900 L1360 740 L1440 780 L1520 700 L1600 760 V900 Z" fill="#0a0c10"/>` +
      `<g class="cl-a-welle-gross zwei"><path d="M-200 800 q50 -20 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 V900 H-200 Z" fill="#0a2035"/></g></g>` }),
    akademie: (k) => ({ fokus: [50, 64], wetter: 'sterne', svg: himmel(id('h'), '#0d1530', '#2a3352') + sterne(70, 420) + mond(1320, 140, 54) +
      `<g class="e2"><path d="M340 380 L800 220 L1260 380 Z" fill="#c9c4b8"/><path d="M380 372 L800 236 L1220 372 Z" fill="#b0ab9f"/><rect x="360" y="380" width="880" height="34" fill="#d6d1c4"/>` +
      `${Array.from({ length: 8 }, (_, i) => `<rect x="${400 + i * 110}" y="414" width="44" height="260" fill="#d6d1c4"/><rect x="${400 + i * 110}" y="414" width="12" height="260" fill="#e8e4d8"/>`).join('')}` +
      `<rect x="360" y="410" width="880" height="270" fill="#1a1e2a" opacity="0.7"/>${fensterReihe(456, 440, 7, 3, 40, 56, 110, 78, 0.1, '#ffd57a')}` +
      `<rect x="896" y="440" width="40" height="56" fill="#ffd57a" class="cl-a-flackern-sanft"/><path d="M748 680 V600 Q800 560 852 600 V680 Z" fill="#0c0e16"/>` +
      `${Array.from({ length: 5 }, (_, i) => `<rect x="${340 - i * 20}" y="${680 + i * 16}" width="${920 + i * 40}" height="16" fill="${i % 2 ? '#b0ab9f' : '#c9c4b8'}"/>`).join('')}` +
      `<text x="800" y="404" text-anchor="middle" font-family="Georgia,serif" font-size="22" letter-spacing="8" fill="#5a5448">${k ? 'SCHULE' : 'UNIVERSITAS'}</text></g>` +
      `<g class="e3"><rect x="0" y="760" width="1600" height="140" fill="#0c1410"/>${[[150, 620], [1450, 600], [300, 680]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="110" fill="#0a1a12"/><circle cx="${x + 60}" cy="${y + 40}" r="80" fill="#0a1a12"/><rect x="${x - 8}" y="${y + 60}" width="20" height="200" fill="#0a1a12"/>`).join('')}` +
      `<path d="M1100 900 L1100 640" stroke="#0a0c10" stroke-width="8"/><circle cx="1100" cy="634" r="12" fill="#ffe7a0"/><circle cx="1100" cy="634" r="70" fill="#ffe7a0" opacity="0.1"/></g>` }),
    zirkus: (k) => ({ fokus: [50, 70], wetter: 'konfetti', svg: himmel(id('h'), '#140c2e', '#3a1a4a') + sterne(70, 420) +
      `<g class="cl-a-suchlicht" style="transform-origin:420px 820px"><path d="M420 820 L260 0 L380 0 Z" fill="#fff6d6" opacity="0.1"/></g><g class="cl-a-suchlicht zwei" style="transform-origin:1180px 820px"><path d="M1180 820 L1220 0 L1340 0 Z" fill="#fff6d6" opacity="0.1"/></g>` +
      `<g class="e2"><path d="M360 760 L800 200 L1240 760 Z" fill="#d6455b"/>${Array.from({ length: 8 }, (_, i) => `<path d="M800 200 L${360 + i * 110} 760 L${415 + i * 110} 760 Z" fill="#f4efe6"/>`).join('')}` +
      `<path d="M360 760 Q800 700 1240 760" stroke="#ffd166" stroke-width="10" fill="none"/><line x1="800" y1="200" x2="800" y2="120" stroke="#3a2a1c" stroke-width="8"/><path class="cl-a-flagge" d="M800 120 l70 18 l-70 18 Z" fill="#ffd166"/>` +
      `<path d="M330 600 Q800 470 1270 600" stroke="#3a2a1c" stroke-width="2" fill="none"/>${Array.from({ length: 22 }, (_, i) => { const t = i / 21; const x = 330 + t * 940; const y = 600 - Math.sin(t * Math.PI) * 130 * 0.98; return `<circle cx="${x.toFixed(0)}" cy="${(y + 4).toFixed(0)}" r="8" fill="${['#ffd166', '#ff5d73', '#06d6a0', '#4cc9f0'][i % 4]}" class="cl-a-blinken" style="animation-delay:${(i % 4) * 0.25}s"/>`; }).join('')}` +
      `<path d="M730 760 Q800 600 870 760 Z" fill="#1a0a10"/><path d="M736 760 Q800 620 864 760 Z" fill="#ffcf6a" opacity="0.35" class="cl-a-flackern-sanft"/></g>` +
      `<g class="e3"><rect x="0" y="760" width="1600" height="140" fill="#1a0f22"/><rect x="80" y="660" width="220" height="110" rx="14" fill="#3a8fb7"/><rect x="100" y="680" width="50" height="40" fill="#ffd166"/><circle cx="130" cy="780" r="24" fill="#1a0a10"/><circle cx="260" cy="780" r="24" fill="#1a0a10"/>` +
      `<rect x="1300" y="670" width="220" height="100" rx="14" fill="#06a67a"/><rect x="1330" y="690" width="50" height="36" fill="#ffd166" opacity="0.7"/><circle cx="1340" cy="780" r="24" fill="#1a0a10"/><circle cx="1480" cy="780" r="24" fill="#1a0a10"/></g>` }),
    dschungel: (k) => ({ fokus: [50, 50], wetter: 'gluehwuermchen', svg: himmel(id('h'), '#0a1a1a', '#1a3a2a') + sterne(30, 300) + mond(1200, 140, 50, '#e8ffe0') +
      `<g class="e1">${Array.from({ length: 10 }, (_, i) => `<circle cx="${i * 180}" cy="${R(560, 640).toFixed(0)}" r="${R(140, 200).toFixed(0)}" fill="#0f2a1c"/>`).join('')}</g>` +
      `<g class="e2">${Array.from({ length: 6 }, (_, i) => `<rect x="${560 + i * 40}" y="${300 + i * 70}" width="${480 - i * 80}" height="72" fill="${i % 2 ? '#5a6a50' : '#6b7a5e'}" transform="translate(${-0} 0)"/>`).reverse().join('')}` +
      `<rect x="720" y="230" width="160" height="80" fill="#6b7a5e"/><path d="M760 310 V260 Q800 230 840 260 V310 Z" fill="#0a120c"/><path d="M766 310 V264 Q800 240 834 264 V310 Z" fill="#ffb347" opacity="0.35" class="cl-a-flackern-sanft"/>` +
      `<path d="M560 720 q20 -200 -30 -400 M1040 720 q-10 -180 40 -360" stroke="#2f5a2a" stroke-width="10" fill="none"/>${Array.from({ length: 16 }, () => `<path transform="translate(${R(540, 1080).toFixed(0)} ${R(300, 720).toFixed(0)}) rotate(${R(-50, 50).toFixed(0)})" d="M0 0 q20 -26 46 0 q-26 18 -46 0 Z" fill="#3f7a3a"/>`).join('')}</g>` +
      `<g class="e3">${Array.from({ length: 9 }, (_, i) => `<path transform="translate(${i < 4 ? R(-60, 360) : R(1240, 1660)} ${R(560, 900)}) rotate(${R(-80, 20).toFixed(0)})" d="M0 0 C60 -100 200 -100 260 0 C200 50 60 50 0 0 Z" fill="${['#123a22', '#1a4a2a', '#0e2e1a'][i % 3]}"/>`).join('')}</g>` }),
    unterwasser: (k) => ({ fokus: [50, 58], wetter: 'blasen', svg: himmel(id('h'), '#0d6a8a', '#021422', '#043a56') +
      `<g class="cl-a-strahlen" opacity="0.14">${[200, 600, 1000, 1400].map((x) => `<path d="M${x} 0 L${x + 120} 0 L${x + 340} 900 L${x + 120} 900 Z" fill="#bff3ff"/>`).join('')}</g>` +
      `<g class="e1"><path d="M0 720 Q400 660 800 700 T1600 690 V900 H0 Z" fill="#06283a"/></g>` +
      `<g class="e2"><path d="M460 720 A340 300 0 0 1 1140 720 Z" fill="#9fdcff" opacity="0.22"/><path d="M460 720 A340 300 0 0 1 1140 720" fill="none" stroke="#8a98a8" stroke-width="12"/>` +
      `${[-60, -30, 0, 30, 60].map((a) => `<line x1="800" y1="720" x2="${800 + Math.sin(a * Math.PI / 180) * 340}" y2="${720 - Math.cos(a * Math.PI / 180) * 300}" stroke="#8a98a8" stroke-width="5"/>`).join('')}` +
      `${[[620, 600], [800, 500], [980, 600], [700, 660], [900, 660]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="22" fill="#ffd57a" opacity="0.8" class="cl-a-flackern-sanft"/><circle cx="${x}" cy="${y}" r="26" fill="none" stroke="#5d6a7c" stroke-width="6"/>`).join('')}` +
      `<rect x="1140" y="660" width="200" height="60" rx="20" fill="#5d6a7c"/><rect x="280" y="670" width="180" height="50" rx="20" fill="#5d6a7c"/></g>` +
      `<g class="e3">${Array.from({ length: 6 }, (_, i) => `<g class="cl-a-fisch" style="animation-duration:${R(16, 30).toFixed(0)}s;animation-delay:-${R(0, 20).toFixed(0)}s"><path transform="translate(0 ${R(150, 560).toFixed(0)}) scale(${R(2, 5).toFixed(1)})" d="M0 0 q8 -6 16 0 q-8 6 -16 0 Z M16 0 l6 -4 v8 Z" fill="${i % 2 ? '#3fb7d0' : k ? '#ffb347' : '#0e7896'}"/></g>`).join('')}` +
      `${k ? '' : '<g class="cl-a-fisch" style="animation-duration:46s"><path transform="translate(0 240) scale(26)" d="M0 0 q8 -6 16 0 q-8 6 -16 0 Z M16 0 l6 -4 v8 Z" fill="#010a12" opacity="0.7"/></g>'}` +
      `<path class="cl-a-tang" d="M120 900 q-30 -140 10 -260 q40 -120 -10 -240" stroke="#1f6b4a" stroke-width="18" fill="none"/><path class="cl-a-tang" style="animation-delay:-2s" d="M1480 900 q30 -120 -10 -220 q-40 -100 10 -200" stroke="#2a7d55" stroke-width="16" fill="none"/>` +
      `<rect x="0" y="820" width="1600" height="80" fill="#041a28"/></g>` }),
    spielzeug: (k) => ({ fokus: [58, 68], wetter: 'schnee', svg: himmel(id('h'), '#1b2550', '#4a4f8a') + sterne(50, 300) +
      `<g class="e1">${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 210}" y="${R(220, 320).toFixed(0)}" width="200" height="600" fill="#262c5e"/>`).join('')}</g>` +
      `<g class="e2"><rect x="380" y="260" width="840" height="520" fill="#7a3a4a"/><path d="M360 270 L800 140 L1240 270 Z" fill="#5a2a38"/>` +
      `<rect x="420" y="300" width="760" height="70" fill="#3a1a24"/><text x="800" y="350" text-anchor="middle" font-family="Georgia,serif" font-size="46" font-weight="700" fill="#ffd166" class="cl-a-flackern-sanft">SPIELWAREN</text>` +
      `<path d="M400 400 H1200 L1180 450 H420 Z" fill="#d6455b"/>${Array.from({ length: 16 }, (_, i) => `<path d="M${400 + i * 50} 400 h25 l-4 50 h-21 Z" fill="#f4efe6"/>`).join('')}` +
      `<rect x="440" y="460" width="460" height="260" fill="#ffcf6a" opacity="0.9"/><rect x="440" y="460" width="460" height="260" fill="none" stroke="#5a2a38" stroke-width="10"/>` +
      `<circle cx="540" cy="640" r="44" fill="#a0673a"/><circle cx="508" cy="602" r="16" fill="#a0673a"/><circle cx="572" cy="602" r="16" fill="#a0673a"/><rect x="640" y="590" width="60" height="60" fill="#4cc9f0"/><text x="670" y="634" text-anchor="middle" font-size="40" font-weight="900" fill="#fff">A</text>` +
      `<rect x="740" y="560" width="70" height="90" fill="#9aa7b8"/><circle cx="760" cy="590" r="7" fill="#ff3d5a" class="cl-a-blinken"/><circle cx="790" cy="590" r="7" fill="#ff3d5a" class="cl-a-blinken"/>` +
      `<rect x="950" y="500" width="160" height="280" fill="#3a1a24"/><rect x="970" y="520" width="120" height="120" fill="#ffcf6a" opacity="0.6"/><circle cx="1080" cy="660" r="8" fill="#ffd166"/></g>` +
      `<g class="e3"><path d="M0 780 Q800 740 1600 790 V900 H0 Z" fill="#e8eeff"/><path d="M1340 900 V560" stroke="#14183a" stroke-width="12"/><circle cx="1340" cy="550" r="20" fill="#ffe7a0"/><circle cx="1340" cy="550" r="110" fill="#ffe7a0" opacity="0.12"/>` +
      `<path d="M200 790 q-6 -60 30 -80 q36 20 30 80 Z" fill="#f4f6ff"/><circle cx="230" cy="690" r="26" fill="#f4f6ff"/><path d="M230 696 l18 4 l-18 4 Z" fill="#ff9f1c"/></g>` }),
    western: (k) => ({ fokus: [47, 70], wetter: 'staub', svg: himmel(id('h'), '#3a1d4a', '#f6b25a', '#e0643a') + `<circle cx="1160" cy="560" r="120" fill="#ffd98a" opacity="0.95"/>` +
      `<g class="e1"><path d="M0 640 L120 640 L160 470 L380 470 L420 640 L900 640 L940 540 L1140 540 L1180 640 L1600 640 V900 H0 Z" fill="#7a3b2a"/></g>` +
      `${k ? '' : `<g class="cl-a-kreisen" style="transform-origin:400px 220px"><path d="M300 220 q20 -14 40 0 q20 -14 40 0" stroke="#1a0d12" stroke-width="4" fill="none"/></g>`}` +
      `<g class="e2"><rect x="460" y="380" width="560" height="380" fill="#6b4226"/><rect x="440" y="320" width="600" height="110" fill="#7a4b2a"/><text x="740" y="396" text-anchor="middle" font-family="Rockwell,Georgia,serif" font-size="68" font-weight="900" fill="#f4e4c1">SALOON</text>` +
      `${Array.from({ length: 14 }, (_, i) => `<line x1="460" y1="${440 + i * 24}" x2="1020" y2="${440 + i * 24}" stroke="#4a2c18" stroke-width="2"/>`).join('')}<rect x="440" y="560" width="600" height="14" fill="#4a2c18"/>` +
      `<rect x="500" y="460" width="120" height="80" fill="#ffcf6a" opacity="0.7"/><rect x="860" y="460" width="120" height="80" fill="#1a0f08"/><rect x="680" y="620" width="120" height="140" fill="#1a0f08"/><rect x="684" y="640" width="54" height="80" fill="#a0673a"/><rect x="742" y="640" width="54" height="80" fill="#a0673a"/>` +
      `<rect x="1180" y="280" width="200" height="140" rx="20" fill="#5a3a1c"/><path d="M1200 420 L1180 760 M1360 420 L1380 760 M1190 600 H1370" stroke="#4a2c18" stroke-width="10"/></g>` +
      `<g class="e3"><rect x="0" y="760" width="1600" height="140" fill="#c98a45"/><g class="cl-a-rollen"><circle cx="0" cy="790" r="34" fill="none" stroke="#6a4a2a" stroke-width="5" stroke-dasharray="10 6"/><circle cx="0" cy="790" r="20" fill="none" stroke="#6a4a2a" stroke-width="4" stroke-dasharray="8 6"/></g>` +
      `<path d="M260 790 v-110 m0 40 h-30 v-40 m30 20 h30 v-50" stroke="#2f4a2a" stroke-width="22" fill="none" stroke-linecap="round"/></g>` }),
    sanatorium: (k) => ({ fokus: [50, 66], wetter: 'nebel', svg: himmel(id('h'), '#0a0c10', '#1c2226') + mond(1280, 150, 60, '#dfe6e0') + `<g class="cl-a-wolke-gross"><ellipse cx="1240" cy="170" rx="200" ry="30" fill="#0c0f12" opacity="0.9"/></g>` +
      `<g class="e2"><rect x="260" y="300" width="1080" height="420" fill="#4a524c"/><path d="M240 310 L800 200 L1360 310 Z" fill="#2c322e"/>` +
      `${Array.from({ length: 3 }, (_, j) => Array.from({ length: 12 }, (_2, i) => { const x = 300 + i * 86; const y = 340 + j * 120; const an = (i === 8 && j === 1); return `<rect x="${x}" y="${y}" width="46" height="70" fill="${an ? '#d6ffe8' : '#11161a'}" class="${an ? 'cl-a-flackern' : ''}"/>${[0, 1, 2, 3].map((s) => `<line x1="${x + 6 + s * 12}" y1="${y}" x2="${x + 6 + s * 12}" y2="${y + 70}" stroke="#2a302c" stroke-width="3"/>`).join('')}`; }).join('')).join('')}` +
      `<path d="M740 720 V620 Q800 580 860 620 V720 Z" fill="#0a0c0c"/><rect x="760" y="560" width="80" height="20" fill="#2c322e"/><text x="800" y="290" text-anchor="middle" font-family="Georgia,serif" font-size="24" letter-spacing="10" fill="#1a1e1c">SANATORIUM</text></g>` +
      `<g class="e3"><rect x="0" y="720" width="1600" height="180" fill="#0a0c0c"/>${Array.from({ length: 40 }, (_, i) => `<rect x="${i * 40}" y="660" width="6" height="140" fill="#050606"/><path d="M${i * 40 - 4} 664 l7 -16 l7 16 Z" fill="#050606"/>`).join('')}<rect x="0" y="690" width="1600" height="6" fill="#050606"/>` +
      `<path d="M140 720 q-10 -170 20 -280 M156 520 q-60 -40 -110 -30 M150 600 q50 -30 100 -20" stroke="#050606" stroke-width="16" fill="none" stroke-linecap="round"/></g>` }),
  };

  /** Das Intro abspielen. Ergebnis: Zeitplan läuft über beiTakt (damit „Überspringen“ alles abbrechen kann). */
  function zeigen(flaeche, { raum, kinder, zeilen, titelBlock, beiTakt, ton, sprich = () => {} }) {
    const welt = raum.welt;
    const a = (AUSSEN[welt] || AUSSEN.akademie)(kinder);
    const huelle = el('div', { class: 'cl-film' + (kinder ? ' kinder' : '') });
    const bild = el('div', { class: 'cl-film-bild aussen', style: { transformOrigin: `${a.fokus[0]}% ${a.fokus[1]}%` } });
    bild.innerHTML = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" class="cl-aussen">${a.svg}</svg>`;
    const wetter = el('div', { class: 'cl-film-wetter w-' + (kinder && (a.wetter === 'gewitter' || a.wetter === 'nebel') ? 'sterne' : a.wetter) });
    const untertitel = el('div', { class: 'cl-film-zeile' });
    const balken = [el('div', { class: 'cl-film-balken oben' }), el('div', { class: 'cl-film-balken unten' })];
    huelle.append(bild, wetter, ...balken, untertitel);
    flaeche.replaceChildren(huelle);

    // Innen: der erste Raum, dunkel, eine Taschenlampe streift hindurch
    const innen = el('div', { class: 'cl-film-bild innen' });
    try {
      const sz = raum.szenen[0];
      const bau = Clavis.Kulisse.bauen({ welt, szene: 0, titel: sz.titel, art: sz.art, breite: 1.8, alter: raum.alter, blut: raum.blut, stimmung: raum.stimmung, belegt: [], lichter: sz.stationen.length, seed: [...String(raum.titel)].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7) });
      innen.append(el('div', { class: 'cl-film-raum' }, el('div', { class: 'cl-wand' }, bau.decke, bau.wand), bau.boden, bau.links, bau.rechts), el('div', { class: 'cl-film-lampe' }));
      innen.dataset.welt = welt;
    } catch (e) { console.error(e); }

    const zeile = (text, i) => {
      untertitel.replaceChildren(el('span', { class: 'cl-film-text', style: { '--i': i } }, [...text].map((c, j) => el('i', { style: { '--j': j } }, c === ' ' ? ' ' : c))));
    };
    let t = 200;
    const z = zeilen.slice();
    beiTakt(t, () => { ton(kinder ? 'plopp' : 'riser'); huelle.classList.add('an'); untertitel.replaceChildren(el('span', { class: 'cl-film-vorspann' }, kinder ? 'Clavis zeigt' : 'Clavis präsentiert')); });
    t += kinder ? 2200 : 2800;
    const aussenZeilen = z.splice(0, Math.max(1, Math.ceil(z.length / 2) - (z.length > 2 ? 0 : 0)));
    aussenZeilen.forEach((x, i) => { beiTakt(t, () => { ton(kinder ? (i % 2 ? 'plopp' : 'kichern') : i === 0 ? 'braam' : 'whoosh'); zeile(x, i); sprich(x); }); t += Math.min(4200, 2000 + x.length * 45); });
    // Die Kamera fährt auf die Tür zu – und hindurch
    beiTakt(t - 1200, () => { bild.classList.add('heran'); ton('whoosh'); });
    beiTakt(t, () => { huelle.append(innen); requestAnimationFrame(() => innen.classList.add('an')); ton(kinder ? 'plopp' : 'tueroeffnen'); untertitel.replaceChildren(); });
    t += 900;
    z.forEach((x, i) => { beiTakt(t, () => { ton(kinder ? 'kichern' : i % 2 ? 'whoosh' : 'braam'); zeile(x, i + aussenZeilen.length); sprich(x); }); t += Math.min(4200, 2000 + x.length * 45); });
    if (!z.length) t += 2200;
    beiTakt(t, () => {
      ton(kinder ? 'fanfare' : 'braam');
      innen.classList.add('weg');
      bild.classList.add('titel');
      untertitel.replaceChildren();
      huelle.append(el('div', { class: 'cl-film-titel' }, titelBlock));
      setTimeout(() => sprich(raum.titel), 900);
    });
    t += 3800;
    return t;
  }

  Clavis.Kino = { zeigen, AUSSEN };
})();
