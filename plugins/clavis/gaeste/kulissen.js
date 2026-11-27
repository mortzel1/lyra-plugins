'use strict';
/*
 * Clavis – die Kulissen: Jede Welt ist ein gebauter Raum – Wand, Decke, Boden, Fenster mit Blick nach draußen, Regale,
 * Bilder, Maschinen. Und der Raum lebt:
 *   – jede Szene sieht anders aus (Keller, Halle, Gang, oben, Technik – aus dem Titel oder von der KI),
 *   – mit jedem gelösten Rätsel geht ein Licht an (Fackel, Kerze, Glühbirne, Scheinwerfer …),
 *   – läuft die Zeit ab, verfällt der Raum (Wasser steigt, Sand rieselt, Risse, Funken, Ranken – für Kinder harmlos),
 *   – Ereignisse hinterlassen Spuren (Risse nach dem Beben, Regen am Fenster, ein Brief auf dem Boden, ein schiefes Bild).
 * Alles SVG und CSS, ohne Bilder von außen.
 *
 *   const bau = Clavis.Kulisse.bauen({ welt, szene, titel, art, breite, alter, blut, stimmung, belegt: [{x, platz}], lichter });
 *   → { wand, decke, boden, lichter, verfall, links, rechts }   (Elemente)
 */
(() => {
  const { el } = Clavis;
  let nr = 0;
  const uid = (p) => `${p}${++nr}`;
  const svg = (vb, inner, klasse = '') => `<svg viewBox="0 0 ${vb[0]} ${vb[1]}" preserveAspectRatio="xMidYMax meet" class="cl-modul-svg ${klasse}" aria-hidden="true">${inner}</svg>`;
  const zahl = (r, a, b) => a + r() * (b - a);

  // ---------------------------------------------------------------- Draußen (hinter Fenstern) – 100×100, wird beschnitten
  function draussen(art, r, k) {
    const g = uid('g');
    const sterne = (n, h = 70) => Array.from({ length: n }, () => `<circle cx="${zahl(r, 2, 98).toFixed(1)}" cy="${zahl(r, 2, h).toFixed(1)}" r="${zahl(r, 0.3, 0.9).toFixed(2)}" fill="#fff" class="cl-a-funkeln" style="animation-delay:${zahl(r, 0, 4).toFixed(1)}s"/>`).join('');
    const regen = (dicht = 14) => `<g class="cl-a-regen">${Array.from({ length: dicht }, () => { const x = zahl(r, -10, 110); const y = zahl(r, -100, 100); return `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - 4).toFixed(1)}" y2="${(y + 14).toFixed(1)}" stroke="#9fb4d8" stroke-width="0.6" opacity="0.55"/>`; }).join('')}</g>`;
    switch (art) {
      case 'stadt': {
        let haeuser = '';
        let x = -4;
        while (x < 104) {
          const b = zahl(r, 10, 22); const h = zahl(r, 30, 70);
          haeuser += `<rect x="${x.toFixed(1)}" y="${(100 - h).toFixed(1)}" width="${b.toFixed(1)}" height="${h.toFixed(1)}" fill="#0a0d16"/>`;
          for (let fy = 100 - h + 4; fy < 96; fy += 7) for (let fx = x + 2; fx < x + b - 3; fx += 5) if (r() < 0.28) haeuser += `<rect x="${fx.toFixed(1)}" y="${fy.toFixed(1)}" width="2.4" height="3" fill="${r() < 0.8 ? '#f3c46b' : '#9ad1ff'}" opacity="${zahl(r, 0.4, 0.9).toFixed(2)}"/>`;
          x += b + zahl(r, 0, 3);
        }
        return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121a2e"/><stop offset="1" stop-color="#2a2238"/></linearGradient></defs><rect width="100" height="100" fill="url(#${g})"/>` +
          `<circle cx="78" cy="62" r="26" fill="#ff3d5a" opacity="0.13" class="cl-a-neon"/>${haeuser}${regen(18)}`;
      }
      case 'mond':
        return `<defs><radialGradient id="${g}" cx="0.7" cy="0.25" r="0.9"><stop offset="0" stop-color="#3a3f66"/><stop offset="1" stop-color="#0b0b18"/></radialGradient></defs><rect width="100" height="100" fill="url(#${g})"/>${sterne(16)}` +
          `<circle cx="68" cy="28" r="13" fill="#f6f0d4" class="cl-mond"/><circle cx="64" cy="25" r="2.4" fill="#ddd3ae"/><circle cx="72" cy="33" r="1.8" fill="#ddd3ae"/>` +
          `<g class="cl-a-wolke"><ellipse cx="30" cy="34" rx="22" ry="4" fill="#1d1f38" opacity="0.8"/></g>` +
          `<path d="M-2 100 L-2 70 Q8 62 14 64 Q12 50 22 46 M14 64 Q22 60 30 66 M22 46 Q26 40 34 41 M22 46 Q18 38 22 30" stroke="#05050a" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
          `<path d="M0 100 Q30 86 60 92 T100 88 L100 100 Z" fill="#05050a"/>`;
      case 'erde':
        return `<rect width="100" height="100" fill="#02030a"/>${sterne(26, 100)}<defs><radialGradient id="${g}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#6fc3ff"/><stop offset="0.45" stop-color="#1f6fb8"/><stop offset="1" stop-color="#06162e"/></radialGradient></defs>` +
          `<g class="cl-a-drehen-langsam"><circle cx="60" cy="118" r="62" fill="url(#${g})"/><path d="M20 80 q10 -8 22 -2 q8 6 18 0 q6 -4 14 2" stroke="#4caf6e" stroke-width="5" fill="none" opacity="0.55" stroke-linecap="round"/><path d="M40 96 q12 -6 26 0" stroke="#4caf6e" stroke-width="6" fill="none" opacity="0.5" stroke-linecap="round"/></g>` +
          `<circle cx="60" cy="118" r="63.5" fill="none" stroke="#9fdcff" stroke-width="1.2" opacity="0.5"/>`;
      case 'meer':
        return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1a33"/><stop offset="0.55" stop-color="#1d3354"/><stop offset="0.56" stop-color="#0c2238"/><stop offset="1" stop-color="#06121f"/></linearGradient></defs><rect width="100" height="100" fill="url(#${g})"/>${sterne(10, 45)}` +
          `<circle cx="30" cy="24" r="8" fill="#f6efd2"/><rect x="26" y="56" width="8" height="40" fill="#f6efd2" opacity="0.12"/>` +
          `<g class="cl-a-welle"><path d="M-40 62 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 L140 100 L-40 100 Z" fill="#0f2c48" opacity="0.9"/><path d="M-40 72 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 L140 100 L-40 100 Z" fill="#0a2035"/></g>`;
      case 'wueste':
        return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1d4a"/><stop offset="0.45" stop-color="#e0643a"/><stop offset="0.75" stop-color="#f6b25a"/><stop offset="1" stop-color="#c98a45"/></linearGradient></defs><rect width="100" height="100" fill="url(#${g})"/>` +
          `<circle cx="62" cy="64" r="14" fill="#ffd98a" opacity="0.95"/><path d="M0 74 L10 74 L13 60 L30 60 L33 74 L60 74 L64 66 L80 66 L84 74 L100 74 L100 100 L0 100 Z" fill="#7a3b2a"/>` +
          `<path d="M0 86 Q40 78 100 88 L100 100 L0 100 Z" fill="#a8613a"/><path d="M20 90 v-14 m0 6 h-4 v-5 m4 3 h4 v-6" stroke="#2f4a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
          `<g class="cl-a-wolke"><path d="M20 20 q6 -2 10 0" stroke="#1a0d12" stroke-width="0.8" fill="none"/><path d="M28 16 q5 -2 8 0" stroke="#1a0d12" stroke-width="0.8" fill="none"/></g>`;
      case 'dschungel':
        return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c3a2a"/><stop offset="1" stop-color="#08160f"/></linearGradient></defs><rect width="100" height="100" fill="url(#${g})"/>` +
          Array.from({ length: 9 }, (_, i) => { const x = zahl(r, -10, 100); const y = zahl(r, 20, 90); const s = zahl(r, 0.6, 1.3); return `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)}) rotate(${zahl(r, -40, 40).toFixed(0)})" d="M0 0 C10 -16 30 -16 40 0 C30 8 10 8 0 0 Z" fill="${['#1f5c34', '#2a7040', '#174a2a'][i % 3]}"/>`; }).join('') +
          `<rect width="100" height="100" fill="#b5ffd0" opacity="0.06" class="cl-a-nebel"/>${Array.from({ length: 6 }, () => `<circle cx="${zahl(r, 5, 95).toFixed(0)}" cy="${zahl(r, 10, 90).toFixed(0)}" r="0.9" fill="#e9ff8a" class="cl-a-funkeln" style="animation-delay:${zahl(r, 0, 3).toFixed(1)}s"/>`).join('')}`;
      case 'tiefsee': {
        const fisch = (y, s, d, f) => `<g class="cl-a-fisch" style="animation-duration:${d}s;animation-delay:-${zahl(r, 0, d).toFixed(1)}s"><path transform="translate(0 ${y}) scale(${s})" d="M0 0 q8 -6 16 0 q-8 6 -16 0 Z M16 0 l6 -4 v8 Z" fill="${f}"/></g>`;
        return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d5a7a"/><stop offset="1" stop-color="#021422"/></linearGradient></defs><rect width="100" height="100" fill="url(#${g})"/>` +
          `<g class="cl-a-strahlen" opacity="0.18"><path d="M20 0 L30 0 L50 100 L28 100 Z" fill="#bff3ff"/><path d="M55 0 L62 0 L80 100 L64 100 Z" fill="#bff3ff"/></g>` +
          fisch(30, 0.6, 18, '#3fb7d0') + fisch(55, 0.9, 24, '#0e7896') + fisch(44, 0.4, 14, '#7fe0ef') + (k ? fisch(70, 0.7, 20, '#ffb347') : fisch(76, 2.2, 40, '#031019')) +
          `<path class="cl-a-tang" d="M12 100 q-4 -14 2 -26 q6 -12 -2 -24" stroke="#1f6b4a" stroke-width="3" fill="none"/><path class="cl-a-tang" style="animation-delay:-1.5s" d="M86 100 q4 -12 -2 -22 q-5 -10 2 -20" stroke="#2a7d55" stroke-width="3" fill="none"/>` +
          `<g class="cl-a-blasen">${Array.from({ length: 6 }, () => `<circle cx="${zahl(r, 10, 90).toFixed(0)}" cy="${zahl(r, 40, 100).toFixed(0)}" r="${zahl(r, 0.8, 1.8).toFixed(1)}" fill="none" stroke="#bff3ff" stroke-width="0.4"/>`).join('')}</g>`;
      }
      case 'campus':
        return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101a30"/><stop offset="1" stop-color="#253049"/></linearGradient></defs><rect width="100" height="100" fill="url(#${g})"/>${sterne(14, 40)}` +
          `<circle cx="80" cy="18" r="6" fill="#f6f0d4"/><path d="M5 100 V58 L30 46 L55 58 V100 Z" fill="#0b1120"/>${[60, 70, 80].map((y) => [12, 22, 32, 42].map((x) => (r() < 0.4 ? `<rect x="${x}" y="${y}" width="5" height="6" fill="#ffd57a" opacity="0.8"/>` : '')).join('')).join('')}` +
          `<circle cx="72" cy="78" r="12" fill="#0a1a14"/><circle cx="88" cy="82" r="9" fill="#0a1a14"/><rect x="70" y="80" width="3" height="20" fill="#0a1a14"/>`;
      case 'schnee':
        return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2550"/><stop offset="1" stop-color="#3b3f7a"/></linearGradient></defs><rect width="100" height="100" fill="url(#${g})"/>` +
          `<path d="M0 82 Q50 74 100 84 L100 100 L0 100 Z" fill="#e8eeff"/><rect x="70" y="40" width="2.5" height="44" fill="#14183a"/><circle cx="71" cy="40" r="4" fill="#ffe7a0"/><circle cx="71" cy="40" r="16" fill="#ffe7a0" opacity="0.15"/>` +
          `<path d="M10 82 V64 L22 54 L34 64 V82 Z" fill="#202657"/><rect x="18" y="68" width="7" height="7" fill="#ffd57a"/>` +
          `<g class="cl-a-schnee">${Array.from({ length: 22 }, () => `<circle cx="${zahl(r, 0, 100).toFixed(0)}" cy="${zahl(r, -100, 100).toFixed(0)}" r="${zahl(r, 0.5, 1.3).toFixed(1)}" fill="#fff" opacity="0.85"/>`).join('')}</g>`;
      default:
        return `<rect width="100" height="100" fill="#0b0d18"/>${sterne(12)}`;
    }
  }

  // ---------------------------------------------------------------- Bausteine
  function fenster(form, aussen, r, k, rahmen = '#3a2a1c') {
    const id = uid('f');
    const blick = (x, y, w, h) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" class="cl-blick">${draussen(aussen, r, k)}</svg>`;
    const glanz = (x, y, w, h) => `<path d="M${x + w * 0.1} ${y + h * 0.9} L${x + w * 0.45} ${y + h * 0.1} L${x + w * 0.6} ${y + h * 0.1} L${x + w * 0.25} ${y + h * 0.9} Z" fill="#fff" opacity="0.05"/>`;
    const riss = (x, y, w, h) => `<path class="cl-glasriss" d="M${x + w * 0.55} ${y + h * 0.4} l-8 -10 m8 10 l10 -6 m-10 6 l-4 14 m4 -14 l12 10 m-12 -10 l-14 2" stroke="#e9f3ff" stroke-width="0.8" fill="none"/>`;
    switch (form) {
      case 'bogen': return { vb: [80, 140], h: 40, ab: 13, inner:
        `<clipPath id="${id}"><path d="M10 136 V50 Q10 10 40 6 Q70 10 70 50 V136 Z"/></clipPath><g clip-path="url(#${id})">${blick(10, 6, 60, 130)}<rect class="cl-fenster-blitz" x="0" y="0" width="80" height="140" fill="#fff" opacity="0"/>${riss(10, 6, 60, 130)}</g>` +
        `<path d="M10 136 V50 Q10 10 40 6 Q70 10 70 50 V136 Z" fill="none" stroke="${rahmen}" stroke-width="7"/><path d="M40 8 V136 M10 72 H70 M12 40 H68" stroke="${rahmen}" stroke-width="3"/>${glanz(10, 6, 60, 130)}<rect x="2" y="134" width="76" height="6" rx="2" fill="${rahmen}"/>` };
      case 'rund': return { vb: [100, 100], h: 30, ab: 15, inner:
        `<clipPath id="${id}"><circle cx="50" cy="50" r="38"/></clipPath><g clip-path="url(#${id})">${blick(12, 12, 76, 76)}<rect class="cl-fenster-blitz" width="100" height="100" fill="#fff" opacity="0"/>${riss(12, 12, 76, 76)}</g>` +
        `<circle cx="50" cy="50" r="42" fill="none" stroke="#5d6a7c" stroke-width="9"/><circle cx="50" cy="50" r="46" fill="none" stroke="#2c3440" stroke-width="2"/>` +
        Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<circle cx="${(50 + Math.cos(a) * 42).toFixed(1)}" cy="${(50 + Math.sin(a) * 42).toFixed(1)}" r="2.2" fill="#aab6c6"/>`; }).join('') +
        `<path d="M26 30 Q40 18 58 16" stroke="#fff" stroke-width="2" opacity="0.18" fill="none" stroke-linecap="round"/>` };
      case 'gitter': return { vb: [90, 110], h: 30, ab: 17, inner:
        `${blick(8, 8, 74, 94)}<rect class="cl-fenster-blitz" x="8" y="8" width="74" height="94" fill="#fff" opacity="0"/>${riss(8, 8, 74, 94)}<rect x="4" y="4" width="82" height="102" fill="none" stroke="#3b3d3a" stroke-width="7"/>` +
        [22, 36, 50, 64, 78].map((x) => `<rect x="${x - 1.6}" y="6" width="3.2" height="98" fill="#2a2c2b"/><rect x="${x - 1.6}" y="6" width="1" height="98" fill="#6a6d68"/>`).join('') + `<rect x="6" y="52" width="78" height="3" fill="#2a2c2b"/>` };
      case 'jalousie': return { vb: [100, 120], h: 38, ab: 12, inner:
        `${blick(8, 6, 84, 104)}<rect class="cl-fenster-blitz" x="8" y="6" width="84" height="104" fill="#fff" opacity="0"/>${riss(8, 6, 84, 104)}` +
        Array.from({ length: 14 }, (_, i) => `<rect x="8" y="${8 + i * 7.4}" width="84" height="${i < 9 ? 3.6 : 5.6}" fill="#1b1712" opacity="0.92"/>`).join('') +
        `<rect x="4" y="2" width="92" height="112" fill="none" stroke="${rahmen}" stroke-width="6"/><line x1="86" y1="6" x2="86" y2="94" stroke="#8a7a5a" stroke-width="0.8"/><rect x="0" y="112" width="100" height="8" rx="2" fill="${rahmen}"/>` };
      case 'panorama': return { vb: [220, 110], h: 34, ab: 13, inner:
        `<clipPath id="${id}"><rect x="12" y="12" width="196" height="86" rx="30"/></clipPath><g clip-path="url(#${id})">${blick(12, 12, 196, 86)}<rect class="cl-fenster-blitz" width="220" height="110" fill="#fff" opacity="0"/>${riss(60, 12, 100, 86)}</g>` +
        `<rect x="8" y="8" width="204" height="94" rx="34" fill="none" stroke="#4c5a6c" stroke-width="9"/><path d="M110 10 V100" stroke="#4c5a6c" stroke-width="5"/>` +
        Array.from({ length: 10 }, (_, i) => `<circle cx="${22 + i * 19.5}" cy="8" r="2" fill="#a8b6c8"/><circle cx="${22 + i * 19.5}" cy="102" r="2" fill="#a8b6c8"/>`).join('') };
      case 'schau': return { vb: [180, 120], h: 36, ab: 6, inner:
        `${blick(8, 22, 164, 92)}<rect class="cl-fenster-blitz" x="8" y="22" width="164" height="92" fill="#fff" opacity="0"/>` +
        `<rect x="4" y="18" width="172" height="100" fill="none" stroke="#7a4b2a" stroke-width="6"/><path d="M90 20 V116" stroke="#7a4b2a" stroke-width="4"/>` +
        `<path d="M0 2 H180 L172 20 H8 Z" fill="#d6455b"/>${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 20} 2 h10 l-2 18 h-8 Z" fill="#f4efe6"/>`).join('')}` +
        `<text x="90" y="64" text-anchor="middle" font-size="12" font-family="Georgia,serif" fill="#ffd166" opacity="0.5" transform="scale(-1 1) translate(-180 0)">SPIELWAREN</text>` };
      default: return { vb: [90, 120], h: 34, ab: 14, inner:
        `${blick(8, 8, 74, 104)}<rect class="cl-fenster-blitz" x="8" y="8" width="74" height="104" fill="#fff" opacity="0"/>${riss(8, 8, 74, 104)}` +
        `<rect x="4" y="4" width="82" height="112" fill="none" stroke="${rahmen}" stroke-width="7"/><path d="M45 6 V114 M6 52 H84" stroke="${rahmen}" stroke-width="4"/>${glanz(8, 8, 74, 104)}<rect x="0" y="112" width="90" height="8" rx="2" fill="${rahmen}"/>` };
    }
  }

  function regal(inhalt, r, k, holz = '#4a2f1c', holz2 = '#2e1c10') {
    const B = 120; const H = 170; const boeden = [30, 70, 110, 150];
    let s = `<rect x="4" y="2" width="${B - 8}" height="${H - 4}" fill="${holz2}"/><rect x="0" y="0" width="6" height="${H}" fill="${holz}"/><rect x="${B - 6}" y="0" width="6" height="${H}" fill="${holz}"/><rect x="0" y="0" width="${B}" height="6" fill="${holz}"/>`;
    boeden.forEach((y) => { s += `<rect x="0" y="${y}" width="${B}" height="5" fill="${holz}"/><rect x="0" y="${y + 5}" width="${B}" height="2" fill="#000" opacity="0.35"/>`; });
    const farben = { buecher: ['#7a2e2e', '#2e4a7a', '#2e6a4a', '#8a6a2a', '#5a2e6a', '#a0522d', '#3d3d3d', '#6b4a2a'], spielzeug: ['#ff5d73', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c'] };
    boeden.forEach((y, bi) => {
      let x = 8;
      const oben = bi === 0 ? 8 : boeden[bi - 1] + 7;
      const platz = y - oben;
      while (x < B - 14) {
        if (inhalt === 'buecher') {
          const w = zahl(r, 5, 10); const h = zahl(r, platz * 0.6, platz * 0.95); const f = r.wahl(farben.buecher);
          if (r() < 0.08 && x < B - 30) { s += `<rect x="${x}" y="${y - h * 0.7}" width="${w}" height="${h * 0.75}" fill="${f}" transform="rotate(-14 ${x} ${y})"/>`; x += w + 6; continue; }
          s += `<rect x="${x.toFixed(1)}" y="${(y - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${f}"/><rect x="${x.toFixed(1)}" y="${(y - h * 0.8).toFixed(1)}" width="${w.toFixed(1)}" height="1.6" fill="#e0b25c" opacity="0.6"/>`;
          x += w + zahl(r, 0, 1.2);
          if (r() < 0.06) x += 10;
        } else if (inhalt === 'kolben') {
          const f = r.wahl(['#39f5c6', '#ff3d8b', '#9ad1ff', '#d6ff5a', '#b388ff']);
          const art = r.zahl(0, 2);
          if (art === 0) s += `<path d="M${x + 4} ${y - 26} v8 l-6 14 q-1 4 4 4 h12 q5 0 4 -4 l-6 -14 v-8 Z" fill="#cfe" opacity="0.25" stroke="#cfe" stroke-width="0.8"/><path d="M${x - 1} ${y - 6} l3 -7 h10 l3 7 q0 4 -4 4 h-8 q-4 0 -4 -4 Z" fill="${f}" class="cl-a-gluehen"/>`;
          else if (art === 1) s += `<circle cx="${x + 8}" cy="${y - 9}" r="8" fill="#cfe" opacity="0.2" stroke="#cfe" stroke-width="0.8"/><rect x="${x + 6}" y="${y - 26}" width="4" height="10" fill="#cfe" opacity="0.3"/><path d="M${x + 1} ${y - 8} a7 7 0 0 0 14 0 Z" fill="${f}" class="cl-a-gluehen"/>`;
          else s += `<rect x="${x + 2}" y="${y - 28}" width="6" height="28" rx="3" fill="#cfe" opacity="0.2" stroke="#cfe" stroke-width="0.8"/><rect x="${x + 2}" y="${y - 14}" width="6" height="14" rx="3" fill="${f}" class="cl-a-gluehen"/>`;
          x += 22;
        } else if (inhalt === 'flaschen') {
          const f = r.wahl(['#5a3a1a', '#2f5a2a', '#7a2a2a', '#c9a24a', '#2a3a5a']);
          const h = zahl(r, 22, 32);
          s += `<path d="M${x + 3} ${y} v${-h * 0.6} q0 -5 3 -7 v${-h * 0.3} h3 v${h * 0.3} q3 2 3 7 v${h * 0.6} Z" fill="${f}" opacity="0.9"/><rect x="${x + 5}" y="${y - h * 0.45}" width="5" height="6" fill="#efe6cf" opacity="0.7"/>`;
          x += 14;
        } else if (inhalt === 'ordner') {
          const f = r.wahl(['#2e4a7a', '#7a2e2e', '#3d3d3d', '#6b6b6b', '#2e6a4a']);
          s += `<rect x="${x}" y="${y - 30}" width="9" height="30" fill="${f}"/><circle cx="${x + 4.5}" cy="${y - 7}" r="2" fill="#ddd" opacity="0.7"/><rect x="${x + 2}" y="${y - 25}" width="5" height="8" fill="#eee" opacity="0.7"/>`;
          x += 10;
        } else if (inhalt === 'spielzeug') {
          const t = r.zahl(0, 4); const f = r.wahl(farben.spielzeug);
          if (t === 0) s += `<rect x="${x}" y="${y - 14}" width="14" height="14" rx="2" fill="${f}"/><text x="${x + 7}" y="${y - 3}" font-size="10" text-anchor="middle" fill="#fff" font-family="Arial Black,Arial" font-weight="900">${r.wahl(['A', 'B', 'C', '1', '★'])}</text>`;
          else if (t === 1) s += `<circle cx="${x + 9}" cy="${y - 9}" r="9" fill="${f}"/><path d="M${x} ${y - 9} h18" stroke="#fff" stroke-width="2"/>`;
          else if (t === 2) s += `<circle cx="${x + 9}" cy="${y - 10}" r="9" fill="#a0673a"/><circle cx="${x + 2}" cy="${y - 18}" r="3.5" fill="#a0673a"/><circle cx="${x + 16}" cy="${y - 18}" r="3.5" fill="#a0673a"/><circle cx="${x + 6}" cy="${y - 11}" r="1.2" fill="#111"/><circle cx="${x + 12}" cy="${y - 11}" r="1.2" fill="#111"/><ellipse cx="${x + 9}" cy="${y - 6}" rx="3" ry="2" fill="#e8c9a0"/>`;
          else if (t === 3) s += `<rect x="${x + 2}" y="${y - 22}" width="14" height="14" rx="2" fill="#9aa7b8"/><rect x="${x}" y="${y - 8}" width="18" height="8" fill="#7a8798"/><circle cx="${x + 6}" cy="${y - 16}" r="1.6" fill="#ff3d5a" class="cl-a-blinken"/><circle cx="${x + 12}" cy="${y - 16}" r="1.6" fill="#ff3d5a" class="cl-a-blinken"/><line x1="${x + 9}" y1="${y - 22}" x2="${x + 9}" y2="${y - 27}" stroke="#9aa7b8"/>`;
          else s += `<path d="M${x} ${y} q2 -10 10 -10 q4 -8 10 -2 l-4 2 q2 10 -6 10 Z" fill="#ffd166"/><circle cx="${x + 16}" cy="${y - 15}" r="1" fill="#111"/>`;
          x += 24;
        } else if (inhalt === 'urnen') {
          s += `<path d="M${x + 2} ${y} q-3 -14 2 -20 h12 q5 6 2 20 Z" fill="#c9a26a"/><circle cx="${x + 10}" cy="${y - 24}" r="5.5" fill="${r.wahl(['#3fb7b0', '#c9a26a', '#2a2a2a'])}"/><rect x="${x + 4}" y="${y - 12}" width="12" height="1.4" fill="#5a3a1a"/>`;
          x += 26;
        } else break;
      }
    });
    if (!k && inhalt === 'buecher' && r() < 0.5) s += `<path d="M${B - 30} 34 q8 6 16 0 M${B - 26} 36 l-3 8 M${B - 18} 36 l3 7" stroke="#ccc" stroke-width="0.4" opacity="0.4" fill="none"/>`;
    return { vb: [B, H], h: 44, ab: 0, inner: s };
  }

  function bild(inhalt, r, k, st, rahmen = '#b8893a') {
    const W = 80; const H = 100;
    let innen = '';
    const g = uid('b');
    switch (inhalt) {
      case 'portraet': {
        const augen = !k && (st.spuk >= 5 || st.grusel >= 5);
        innen = `<defs><radialGradient id="${g}" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="#4a3a2a"/><stop offset="1" stop-color="#140e08"/></radialGradient></defs><rect x="10" y="10" width="60" height="80" fill="url(#${g})"/>` +
          `<path d="M18 90 Q20 64 40 60 Q60 64 62 90 Z" fill="#1a1410"/><ellipse cx="40" cy="44" rx="13" ry="16" fill="#c9a888"/><path d="M27 40 Q28 24 40 24 Q52 24 53 40 Q50 30 40 30 Q30 30 27 40 Z" fill="#2a1a10"/>` +
          `<g class="cl-portraet-augen${augen ? ' folgen' : ''}"><circle cx="35" cy="44" r="1.8" fill="${augen ? '#ff3a2a' : '#1a1010'}"/><circle cx="45" cy="44" r="1.8" fill="${augen ? '#ff3a2a' : '#1a1010'}"/></g>` +
          `<path d="M36 53 q4 2 8 0" stroke="#6a3a2a" stroke-width="1" fill="none"/>`;
        break;
      }
      case 'plakat':
        innen = `<rect x="10" y="10" width="60" height="80" fill="#f4e4c1"/><circle cx="40" cy="42" r="20" fill="#d6455b"/><path d="M40 26 l4.5 9.5 10.5 1.5 -7.6 7.4 1.8 10.4 -9.2 -4.9 -9.2 4.9 1.8 -10.4 -7.6 -7.4 10.5 -1.5 Z" fill="#ffd166"/>` +
          `<text x="40" y="76" text-anchor="middle" font-size="8.5" font-family="Georgia,serif" font-weight="700" fill="#2b1a40">${k ? 'ZAUBERSHOW' : 'MAGNIFICO'}</text><text x="40" y="85" text-anchor="middle" font-size="4.5" fill="#2b1a40" font-family="Georgia,serif">HEUTE ABEND</text>`;
        break;
      case 'steckbrief':
        innen = `<rect x="12" y="10" width="56" height="80" fill="#e8d3a3"/><text x="40" y="24" text-anchor="middle" font-size="10" font-family="Georgia,serif" font-weight="900" fill="#3a2414">GESUCHT</text>` +
          `<rect x="22" y="30" width="36" height="34" fill="#c9b080"/><circle cx="40" cy="44" r="9" fill="#3a2414"/><path d="M26 64 q14 -14 28 0 Z" fill="#3a2414"/><path d="M28 36 h24 l-3 -5 h-18 Z" fill="#3a2414"/>` +
          `<text x="40" y="78" text-anchor="middle" font-size="9" font-family="Georgia,serif" font-weight="700" fill="#7a2a1a">$ 500</text><circle cx="40" cy="12" r="1.6" fill="#555"/>`;
        return { vb: [W, H], h: 17, ab: 22, inner: innen, roh: true };
      case 'karte':
        innen = `<rect x="10" y="10" width="60" height="80" fill="#e8d3a3"/><path d="M18 30 q10 -8 18 0 t18 4 q6 10 -2 18 t-14 14 q-10 4 -16 -6 t-4 -30 Z" fill="#c8b07a" stroke="#7a5a2a" stroke-width="0.8"/>` +
          `<path d="M22 70 q12 -10 18 -20 t16 -14" stroke="#9c3b2e" stroke-width="1.2" stroke-dasharray="2 2" fill="none"/><path d="M53 33 l4 4 m0 -4 l-4 4" stroke="#9c3b2e" stroke-width="1.6"/><circle cx="62" cy="76" r="5" fill="none" stroke="#7a5a2a" stroke-width="0.7"/><path d="M62 70 v12 M56 76 h12" stroke="#7a5a2a" stroke-width="0.6"/>`;
        break;
      case 'pinnwand': {
        const pins = Array.from({ length: 6 }, (_, i) => [16 + (i % 3) * 20 + zahl(r, -3, 3), 22 + Math.floor(i / 3) * 34 + zahl(r, -3, 3)]);
        innen = `<rect x="6" y="6" width="${W + 40 - 12}" height="${H - 12}" fill="#a87a4a"/>` +
          pins.map(([x, y], i) => `<rect x="${x * 1.5 - 8}" y="${y}" width="${i % 2 ? 18 : 16}" height="${i % 2 ? 14 : 20}" fill="${i % 2 ? '#efe6cf' : '#ddd'}" transform="rotate(${zahl(r, -8, 8).toFixed(0)} ${x * 1.5} ${y})"/>${i % 2 ? '' : `<circle cx="${x * 1.5}" cy="${y + 8}" r="3.5" fill="#555"/>`}`).join('') +
          `<path d="M${pins[0][0] * 1.5} ${pins[0][1]} L${pins[4][0] * 1.5} ${pins[4][1]} L${pins[2][0] * 1.5} ${pins[2][1]} M${pins[1][0] * 1.5} ${pins[1][1]} L${pins[5][0] * 1.5} ${pins[5][1]}" stroke="#d22" stroke-width="0.9" fill="none"/>` +
          pins.map(([x, y]) => `<circle cx="${x * 1.5}" cy="${y}" r="1.6" fill="#e33"/>`).join('');
        return { vb: [W + 40, H], h: 24, ab: 14, inner: `<rect x="0" y="0" width="${W + 40}" height="${H}" fill="#5a3a1c"/>${innen}` };
      }
      case 'tafel': {
        const kritzel = Array.from({ length: 5 }, (_, i) => `<path d="M${14 + zahl(r, 0, 20)} ${22 + i * 13} ${Array.from({ length: 8 }, () => `q${zahl(r, 3, 6).toFixed(0)} ${zahl(r, -5, 5).toFixed(0)} ${zahl(r, 6, 11).toFixed(0)} 0`).join(' ')}" stroke="#e8f0e8" stroke-width="1.1" opacity="0.6" fill="none"/>`).join('');
        return { vb: [200, 100], h: 26, ab: 14, inner: `<rect x="0" y="0" width="200" height="100" rx="3" fill="#5a3d22"/><rect x="6" y="6" width="188" height="84" fill="#1e3a2e"/>${kritzel}` +
          `<text x="140" y="40" font-size="13" fill="#e8f0e8" opacity="0.7" font-family="Chalkboard SE,Comic Sans MS,cursive">${r.wahl(['E = mc²', 'a² + b² = c²', '∫ f(x) dx', 'Δx · Δp ≥ ħ/2', 'π ≈ 3,14'])}</text>` +
          `<circle cx="160" cy="68" r="12" fill="none" stroke="#e8f0e8" stroke-width="1" opacity="0.5"/><path d="M148 68 h24 M160 56 v24" stroke="#e8f0e8" stroke-width="0.6" opacity="0.4"/><rect x="20" y="90" width="160" height="6" fill="#4a3220"/><rect x="40" y="88" width="12" height="3" fill="#fff" opacity="0.8"/>` };
      }
      case 'zeichnung':
        innen = `<rect x="10" y="10" width="60" height="80" fill="#fff"/><circle cx="58" cy="24" r="7" fill="#ffd166"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="58" y1="24" x2="${58 + Math.cos(a * Math.PI / 180) * 11}" y2="${24 + Math.sin(a * Math.PI / 180) * 11}" stroke="#ffd166" stroke-width="1.2"/>`).join('')}` +
          `<path d="M20 78 V56 L34 44 L48 56 V78 Z" fill="none" stroke="#e04" stroke-width="1.6"/><rect x="30" y="64" width="8" height="14" fill="none" stroke="#06d" stroke-width="1.4"/><path d="M12 80 q20 -4 56 0" stroke="#2a2" stroke-width="2" fill="none"/>`;
        rahmen = '#ffb347';
        break;
      case 'periodensystem':
        return { vb: [140, 90], h: 20, ab: 22, inner: `<rect width="140" height="90" fill="#eef3f6"/>` + Array.from({ length: 7 }, (_, y) => Array.from({ length: 18 }, (_2, x) => ((y === 0 && x > 0 && x < 17) || (y < 3 && x > 1 && x < 12) ? '' : `<rect x="${4 + x * 7.3}" y="${8 + y * 10.5}" width="6.4" height="9.4" fill="${['#ffb4a8', '#ffe08a', '#b8e6c1', '#a8d4ff', '#d8c4ff'][(x + y) % 5]}"/>`)).join('')).join('') };
      default:
        innen = `<rect x="10" y="10" width="60" height="80" fill="#2a3a4a"/>`;
    }
    return { vb: [W, H], h: 24, ab: 16, inner: `<rect x="0" y="0" width="${W}" height="${H}" rx="2" fill="${rahmen}"/><rect x="4" y="4" width="${W - 8}" height="${H - 8}" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="2"/>${innen}` };
  }

  // ---------------------------------------------------------------- Einzelstücke
  const EINZEL = {
    kamin: (r, k) => ({ vb: [160, 130], h: 32, ab: 0, inner:
      `<rect x="0" y="0" width="160" height="16" rx="2" fill="#3b2a24"/><rect x="8" y="16" width="144" height="114" fill="#4b3a33"/><rect x="34" y="40" width="92" height="90" fill="#0c0806"/>` +
      Array.from({ length: 7 }, (_, i) => `<rect x="${8 + (i % 2) * 6}" y="${18 + i * 16}" width="22" height="14" fill="#5a463e" stroke="#2a1d18" stroke-width="1"/><rect x="${130 - (i % 2) * 6}" y="${18 + i * 16}" width="22" height="14" fill="#5a463e" stroke="#2a1d18" stroke-width="1"/>`).join('') +
      `<g class="cl-a-feuer"><path d="M50 128 Q46 100 62 86 Q60 104 72 98 Q70 76 84 66 Q86 92 96 90 Q104 82 102 70 Q118 96 110 128 Z" fill="${k ? '#ffb347' : '#ff7a1a'}"/><path d="M62 128 Q60 108 72 102 Q74 114 82 110 Q84 96 92 92 Q100 110 96 128 Z" fill="#ffd166"/></g>` +
      `<rect x="44" y="122" width="72" height="6" rx="3" fill="#3a2418"/><circle cx="80" cy="112" r="60" fill="#ff8a2a" opacity="0.08" class="cl-a-gluehen"/>` }),
    standuhr: () => ({ vb: [60, 190], h: 46, ab: 0, inner:
      `<path d="M8 40 Q8 4 30 2 Q52 4 52 40 Z" fill="#3a2414"/><rect x="6" y="38" width="48" height="150" fill="#4a2f1c"/><circle cx="30" cy="34" r="16" fill="#efe6cf" stroke="#b8893a" stroke-width="2"/>` +
      Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${(30 + Math.sin(a) * 13).toFixed(1)}" cy="${(34 - Math.cos(a) * 13).toFixed(1)}" r="0.9" fill="#2a1a10"/>`; }).join('') +
      `<path d="M30 34 L30 24 M30 34 L37 37" stroke="#2a1a10" stroke-width="1.4" stroke-linecap="round"/><rect x="16" y="62" width="28" height="100" fill="#1a0f08" stroke="#b8893a" stroke-width="1.5"/>` +
      `<g class="cl-a-pendel" style="transform-origin:30px 64px"><line x1="30" y1="64" x2="30" y2="140" stroke="#b8893a" stroke-width="1.4"/><circle cx="30" cy="144" r="7" fill="#d9a84a"/></g><rect x="2" y="184" width="56" height="6" fill="#2e1c10"/>` }),
    tank: (r, k, st) => ({ vb: [70, 180], h: 46, ab: 0, inner:
      `<rect x="6" y="0" width="58" height="18" rx="3" fill="#3a4a50"/><rect x="6" y="162" width="58" height="18" rx="3" fill="#3a4a50"/><rect x="10" y="18" width="50" height="144" fill="#39f5c6" opacity="0.18" class="cl-a-gluehen"/>` +
      `<rect x="10" y="40" width="50" height="122" fill="#1ee8b0" opacity="0.22"/>${!k && st.grusel >= 5 ? '<path d="M35 70 q-10 4 -10 20 q0 14 6 24 l-4 22 h16 l-4 -22 q6 -10 6 -24 q0 -16 -10 -20 Z" fill="#06231c" opacity="0.75" class="cl-a-schweben"/>' : '<circle cx="35" cy="110" r="10" fill="#39f5c6" opacity="0.3" class="cl-a-schweben"/>'}` +
      `<g class="cl-a-blasen-auf">${Array.from({ length: 7 }, () => `<circle cx="${zahl(r, 16, 54).toFixed(0)}" cy="${zahl(r, 60, 160).toFixed(0)}" r="${zahl(r, 1, 2.6).toFixed(1)}" fill="none" stroke="#d9fff6" stroke-width="0.7"/>`).join('')}</g>` +
      `<rect x="10" y="18" width="5" height="144" fill="#fff" opacity="0.12"/><path d="M60 30 h8 v60" stroke="#5d6a70" stroke-width="3" fill="none"/>` }),
    rohre: (r) => ({ vb: [150, 130], h: 30, ab: 10, inner:
      `<path d="M0 20 H150 M0 44 H60 Q72 44 72 56 V130 M150 70 H110 Q98 70 98 82 V130" stroke="#5d6a70" stroke-width="10" fill="none"/><path d="M0 20 H150 M0 44 H60 Q72 44 72 56 V130 M150 70 H110 Q98 70 98 82 V130" stroke="#8a98a0" stroke-width="2" fill="none" transform="translate(0 -3)"/>` +
      [24, 120].map((x) => `<rect x="${x - 4}" y="12" width="8" height="16" fill="#3a4448"/>`).join('') +
      `<circle cx="38" cy="44" r="9" fill="#c94c4c" stroke="#3a1a1a" stroke-width="2"/><path d="M32 44 h12 M38 38 v12" stroke="#3a1a1a" stroke-width="2"/>` +
      `<circle cx="128" cy="44" r="14" fill="#efe6cf" stroke="#5d6a70" stroke-width="3"/><path d="M118 48 a11 11 0 0 1 20 0" stroke="#d22" stroke-width="1.4" fill="none" opacity="0.6"/><line x1="128" y1="44" x2="137" y2="38" stroke="#222" stroke-width="1.6" class="cl-a-zeiger" style="transform-origin:128px 44px"/>` +
      `<path class="cl-a-dampf" d="M96 18 q-4 -8 2 -14 q6 -6 0 -12" stroke="#cfd8dc" stroke-width="3" fill="none" opacity="0.35" stroke-linecap="round"/>` }),
    paneel: (r) => ({ vb: [140, 110], h: 28, ab: 12, inner:
      `<rect width="140" height="110" rx="6" fill="#1c2238"/><rect x="4" y="4" width="132" height="102" rx="4" fill="none" stroke="#3a4468" stroke-width="2"/><rect x="12" y="12" width="70" height="44" rx="3" fill="#061018"/>` +
      `<path class="cl-a-welle-bild" d="M14 34 q6 -14 12 0 t12 0 t12 0 t12 0 t12 0" stroke="#5ad2ff" stroke-width="1.4" fill="none"/>` +
      Array.from({ length: 12 }, (_, i) => `<circle cx="${96 + (i % 3) * 13}" cy="${18 + Math.floor(i / 3) * 11}" r="3" fill="${r.wahl(['#ff9f1c', '#5ad2ff', '#ff3d5a', '#5fd39a'])}" class="cl-a-blinken" style="animation-delay:${zahl(r, 0, 2).toFixed(1)}s"/>`).join('') +
      Array.from({ length: 6 }, (_, i) => `<rect x="${14 + i * 12}" y="68" width="8" height="${zahl(r, 10, 30).toFixed(0)}" rx="2" fill="#3a4468"/><rect x="${14 + i * 12}" y="${70 + zahl(r, 0, 14).toFixed(0) * 1}" width="8" height="4" fill="#ff9f1c"/>`).join('') }),
    spind: (r) => ({ vb: [110, 170], h: 42, ab: 0, inner:
      [0, 1, 2].map((i) => `<rect x="${i * 36 + 2}" y="2" width="34" height="166" fill="#4c5a6c" stroke="#2c3440" stroke-width="2"/>${[14, 20, 26].map((y) => `<rect x="${i * 36 + 9}" y="${y}" width="20" height="2" fill="#2c3440"/>`).join('')}<rect x="${i * 36 + 28}" y="84" width="3" height="14" fill="#aab6c6"/>`).join('') +
      `<text x="20" y="150" font-size="9" fill="#ff9f1c" font-family="Menlo,monospace" opacity="0.8">0${r.zahl(1, 9)}</text>` }),
    hieroglyphen: (r) => {
      const zeichen = ['M0 6 q6 -8 12 0 q-6 8 -12 0 Z M6 6 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0', 'M2 12 V4 q4 -4 8 0 V12 M0 12 h12', 'M6 0 a3 3 0 1 1 0.1 0 M6 6 V14 M2 8 h8', 'M0 4 q3 -3 6 0 t6 0 M0 9 q3 -3 6 0 t6 0', 'M2 12 L6 2 L10 12 Z', 'M1 10 q2 -9 9 -8 q-3 3 -1 6 q-4 0 -8 2 Z'];
      let s = '<rect width="100" height="160" fill="#8a6a3a"/>';
      for (let y = 0; y < 160; y += 20) for (let x = (y / 20) % 2 ? -15 : 0; x < 100; x += 30) s += `<rect x="${x}" y="${y}" width="30" height="20" fill="none" stroke="#5a4020" stroke-width="1"/>`;
      s += '<rect x="10" y="14" width="80" height="132" fill="#9a7a44" opacity="0.6"/>';
      for (let y = 22; y < 140; y += 20) for (let x = 18; x < 84; x += 18) s += `<path transform="translate(${x} ${y})" d="${r.wahl(zeichen)}" stroke="#2c1a0b" stroke-width="1.5" fill="none" class="cl-glyphe"/>`;
      return { vb: [100, 160], h: 40, ab: 0, inner: s };
    },
    waechter: (r, k, st) => ({ vb: [80, 180], h: 46, ab: 0, inner:
      `<path d="M4 180 V30 Q4 4 40 4 Q76 4 76 30 V180 Z" fill="#2a1a0b"/><path d="M40 20 l-6 14 l2 -2 h8 l2 2 Z M33 14 l3 12 M47 14 l-3 12" fill="#6a5030" stroke="#6a5030" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M30 40 h20 l4 30 h-28 Z M26 70 h28 l4 70 h-36 Z M30 140 h8 v36 h-8 Z M42 140 h8 v36 h-8 Z" fill="#6a5030"/><rect x="56" y="34" width="3" height="140" fill="#b8893a"/><circle cx="57.5" cy="32" r="5" fill="#3fb7b0"/>` +
      `<circle cx="37" cy="30" r="1.4" fill="${!k && st.spuk >= 5 ? '#ff4a2a' : '#1a0f05'}" class="${!k && st.spuk >= 5 ? 'cl-a-gluehen' : ''}"/>` }),
    saeule: () => ({ vb: [50, 190], h: 50, ab: 0, inner:
      `<rect x="10" y="20" width="30" height="160" fill="#a88a58"/><rect x="10" y="20" width="6" height="160" fill="#c4a670"/><rect x="34" y="20" width="6" height="160" fill="#7a6038"/>` +
      `<path d="M2 20 Q8 0 25 4 Q42 0 48 20 Z" fill="#b8985e"/><path d="M10 20 Q16 8 25 10 Q34 8 40 20" stroke="#3fb7b0" stroke-width="2" fill="none"/><rect x="4" y="176" width="42" height="14" fill="#8a6a3a"/>` +
      `<rect x="10" y="60" width="30" height="10" fill="#3fb7b0" opacity="0.5"/><rect x="10" y="74" width="30" height="3" fill="#c9a24a"/>` }),
    steinkopf: (r) => ({ vb: [120, 120], h: 30, ab: 0, inner:
      `<path d="M10 120 V50 Q10 6 60 6 Q110 6 110 50 V120 Z" fill="#6b6a55"/><path d="M10 50 Q10 6 60 6 Q110 6 110 50 Q90 30 60 30 Q30 30 10 50 Z" fill="#5a594a"/>` +
      `<path d="M28 58 q10 -8 22 0 M70 58 q10 -8 22 0" stroke="#3a3a2e" stroke-width="5" fill="none"/><ellipse cx="39" cy="66" rx="7" ry="4" fill="#2a2a20"/><ellipse cx="81" cy="66" rx="7" ry="4" fill="#2a2a20"/>` +
      `<path d="M52 66 Q60 90 50 94 H70 Q60 90 68 66" fill="#55544a"/><path d="M38 104 Q60 96 82 104 Q60 114 38 104 Z" fill="#3a3a2e"/>` +
      `<path d="M10 40 q10 -6 20 4 q-12 8 -20 -4 Z M90 20 q10 -4 18 8 q-12 4 -18 -8 Z M14 90 q8 -4 12 6" fill="#3f7a3a"/><path d="M100 30 q4 30 -2 60 q-2 10 2 20" stroke="#2f6a2f" stroke-width="2" fill="none"/>` }),
    wasserfall: () => ({ vb: [120, 160], h: 42, ab: 0, inner:
      `<path d="M0 160 V30 Q0 0 30 2 H90 Q120 0 120 30 V160 Z" fill="#2a3326"/><rect x="34" y="10" width="52" height="150" fill="#16302a"/>` +
      `<g class="cl-a-fallen">${Array.from({ length: 8 }, (_, i) => `<rect x="${36 + i * 6}" y="-160" width="3" height="320" fill="#bfe8ff" opacity="${0.25 + (i % 3) * 0.12}"/>`).join('')}</g>` +
      `<ellipse cx="60" cy="156" rx="40" ry="8" fill="#e8f8ff" opacity="0.35" class="cl-a-gluehen"/><path d="M0 60 q14 4 20 20 q-16 4 -20 -20 Z M120 80 q-14 0 -20 16 q14 4 20 -16 Z" fill="#2f6a2f"/>` }),
    ranken: (r) => ({ vb: [120, 160], h: 42, ab: 18, inner:
      Array.from({ length: 4 }, (_, i) => { const x = 14 + i * 30; return `<path class="cl-a-schwingen" style="animation-delay:-${i * 0.7}s;transform-origin:${x}px 0" d="M${x} 0 q${zahl(r, -10, 10).toFixed(0)} 40 ${zahl(r, -6, 6).toFixed(0)} 80 q${zahl(r, -10, 10).toFixed(0)} 30 ${zahl(r, -4, 4).toFixed(0)} ${zahl(r, 40, 76).toFixed(0)}" stroke="#2f5a2a" stroke-width="3" fill="none"/>` +
        Array.from({ length: 5 }, (_2, j) => `<path transform="translate(${x + zahl(r, -8, 8)} ${16 + j * 26}) rotate(${zahl(r, -60, 60).toFixed(0)})" d="M0 0 q6 -8 14 0 q-8 6 -14 0 Z" fill="${r.wahl(['#3f7a3a', '#2f6a2f', '#4f8a3a'])}"/>`).join(''); }).join('') }),
    spanten: (r) => ({ vb: [160, 200], h: 62, ab: 0, inner:
      `<path d="M10 200 Q0 100 30 0 H46 Q20 100 28 200 Z M150 200 Q160 100 130 0 H114 Q140 100 132 200 Z" fill="#3a2414"/><path d="M14 200 Q6 100 34 0" stroke="#5a3a1c" stroke-width="3" fill="none"/>` +
      `<rect x="0" y="20" width="160" height="10" fill="#2e1c0f"/><g class="cl-a-schwingen-langsam" style="transform-origin:80px 30px"><path d="M80 30 v24" stroke="#222" stroke-width="1.2"/><rect x="72" y="54" width="16" height="22" rx="3" fill="#2a2a2a"/><rect x="74" y="58" width="12" height="14" fill="#ffcf6a" class="cl-a-gluehen"/><circle cx="80" cy="66" r="24" fill="#ffcf6a" opacity="0.1"/></g>` }),
    netz: (r) => ({ vb: [140, 120], h: 30, ab: 10, inner:
      `<path d="M0 6 Q70 40 140 6" stroke="#8a7a5a" stroke-width="2" fill="none"/>` + Array.from({ length: 9 }, (_, i) => `<path d="M${i * 17} ${6 + Math.sin((i / 8) * Math.PI) * 18} Q${i * 17 + 4} 70 ${i * 17 - 6} 118" stroke="#8a7a5a" stroke-width="0.9" fill="none" opacity="0.8"/>`).join('') +
      Array.from({ length: 6 }, (_, j) => `<path d="M0 ${30 + j * 16} Q70 ${50 + j * 16} 140 ${30 + j * 16}" stroke="#8a7a5a" stroke-width="0.9" fill="none" opacity="0.8"/>`).join('') +
      `<circle cx="40" cy="50" r="6" fill="#e2553f"/><circle cx="96" cy="60" r="6" fill="#f0c75e"/><path d="M70 92 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 Z" fill="#ff8a5a"/>` }),
    kanone: () => ({ vb: [130, 90], h: 22, ab: 0, inner:
      `<rect x="10" y="0" width="110" height="64" fill="#1a1008"/><rect x="16" y="6" width="98" height="52" fill="#0b1a26"/><rect x="16" y="6" width="98" height="52" fill="#2a5a7a" opacity="0.25" class="cl-a-gluehen"/>` +
      `<path d="M20 52 L100 40 Q112 40 112 48 Q112 56 100 56 L20 64 Z" fill="#2a2a2a"/><rect x="18" y="60" width="60" height="16" rx="2" fill="#4a2f1c"/><circle cx="30" cy="80" r="9" fill="#3a2414"/><circle cx="66" cy="80" r="9" fill="#3a2414"/>` }),
    vorhang: () => ({ vb: [120, 200], h: 62, ab: 0, inner:
      `<rect x="0" y="0" width="120" height="16" fill="#b8893a"/>` + Array.from({ length: 6 }, (_, i) => `<path d="M${i * 20} 16 Q${i * 20 + 10} 110 ${i * 20 + 4} 200 H${i * 20 + 22} Q${i * 20 + 16} 110 ${i * 20 + 20} 16 Z" fill="${i % 2 ? '#8a1a2a' : '#a8243a'}"/>`).join('') +
      `<path d="M0 16 Q60 60 120 16 V28 Q60 74 0 28 Z" fill="#7a1424"/><path d="M0 28 Q60 74 120 28" stroke="#e0b25c" stroke-width="3" fill="none"/><circle cx="20" cy="110" r="5" fill="#e0b25c"/><path d="M20 115 v14" stroke="#e0b25c" stroke-width="3"/>` }),
    kaefig: (r, k) => ({ vb: [90, 130], h: 32, ab: 0, inner:
      `<path d="M8 30 Q45 -4 82 30" stroke="#b8893a" stroke-width="4" fill="none"/>` + Array.from({ length: 9 }, (_, i) => `<path d="M${10 + i * 8.7} ${30 - Math.sin((i / 8) * Math.PI) * 14} V120" stroke="#b8893a" stroke-width="2"/>`).join('') +
      `<rect x="2" y="118" width="86" height="12" rx="2" fill="#7a1424"/><rect x="2" y="28" width="86" height="5" fill="#b8893a"/>` +
      (k ? '<path d="M40 84 q8 -12 16 0 q-2 10 -8 10 q-6 0 -8 -10 Z" fill="#ffd166"/><circle cx="51" cy="82" r="1.3" fill="#111"/><path d="M56 84 l5 1 -5 2 Z" fill="#ff9f1c"/>' : '<path d="M30 118 l8 -6 m10 8 l6 -10" stroke="#5a3a1c" stroke-width="2"/>') }),
    podest: () => ({ vb: [90, 70], h: 16, ab: 0, inner:
      `<ellipse cx="45" cy="14" rx="42" ry="12" fill="#ffd166"/><rect x="3" y="14" width="84" height="44" fill="#d6455b"/><ellipse cx="45" cy="58" rx="42" ry="12" fill="#a8243a"/>` +
      `<path d="M45 22 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1 Z" fill="#ffd166"/><path d="M3 20 Q45 36 87 20" stroke="#4cc9f0" stroke-width="3" fill="none"/>` }),
    bar: (r) => ({ vb: [200, 170], h: 42, ab: 0, inner:
      regal('flaschen', r, false, '#5a3a1c', '#2e1c10').inner.replace(/<rect x="0" y="110"[^>]*\/><rect x="0" y="115"[^>]*\/>/, '').replace(/<rect x="0" y="150"[^>]*\/><rect x="0" y="155"[^>]*\/>/, '') +
      `<rect x="0" y="104" width="200" height="66" fill="#5a3a1c"/><rect x="0" y="98" width="200" height="10" fill="#7a4b2a"/>` + Array.from({ length: 5 }, (_, i) => `<rect x="${10 + i * 38}" y="114" width="30" height="48" fill="none" stroke="#3a2414" stroke-width="2"/>`).join('') +
      `<rect x="150" y="82" width="10" height="16" fill="#c9a24a" opacity="0.6"/><rect x="164" y="86" width="9" height="12" fill="#efe6cf" opacity="0.4"/>` }),
    geweih: (r, k) => ({ vb: [120, 60], h: 13, ab: 30, inner: k ?
      '<path d="M40 50 a20 20 0 1 1 40 0 h-8 a12 12 0 1 0 -24 0 Z" fill="#9aa7b8"/><circle cx="44" cy="46" r="2" fill="#555"/><circle cx="76" cy="46" r="2" fill="#555"/>' :
      '<path d="M50 30 q10 -6 20 0 q2 14 -4 22 h-12 q-6 -8 -4 -22 Z" fill="#e8dcc0"/><circle cx="55" cy="36" r="3" fill="#2a1a10"/><circle cx="65" cy="36" r="3" fill="#2a1a10"/><path d="M50 30 Q24 30 4 10 Q30 22 50 26 M70 30 Q96 30 116 10 Q90 22 70 26" stroke="#e8dcc0" stroke-width="6" fill="none" stroke-linecap="round"/>' }),
    pendeltuer: () => ({ vb: [110, 160], h: 40, ab: 0, inner:
      `<rect x="0" y="0" width="110" height="160" fill="#140c06"/><rect x="0" y="0" width="110" height="160" fill="#f6b25a" opacity="0.15"/><rect x="4" y="0" width="8" height="160" fill="#3a2414"/><rect x="98" y="0" width="8" height="160" fill="#3a2414"/>` +
      `<g class="cl-a-pendeln" style="transform-origin:12px 80px"><path d="M12 40 H54 V120 H12 Z" fill="#7a4b2a"/>${[52, 66, 80, 94, 108].map((y) => `<rect x="16" y="${y}" width="34" height="4" fill="#5a3a1c"/>`).join('')}</g>` +
      `<g class="cl-a-pendeln" style="transform-origin:98px 80px;animation-delay:-0.4s"><path d="M56 40 H98 V120 H56 Z" fill="#7a4b2a"/>${[52, 66, 80, 94, 108].map((y) => `<rect x="60" y="${y}" width="34" height="4" fill="#5a3a1c"/>`).join('')}</g>` }),
    aktenschrank: (r) => ({ vb: [70, 120], h: 28, ab: 0, inner:
      `<rect x="2" y="2" width="66" height="116" rx="2" fill="#5d6a5a"/>` + [0, 1, 2, 3].map((i) => `<rect x="7" y="${7 + i * 28}" width="56" height="24" rx="1" fill="#6d7a6a" stroke="#3a4438" stroke-width="1.4"/><rect x="28" y="${15 + i * 28}" width="14" height="4" rx="2" fill="#c9c9b0"/><rect x="30" y="${21 + i * 28}" width="10" height="5" fill="#efe6cf"/>`).join('') +
      (r() < 0.5 ? '<path d="M7 35 h56 v8 h-56 Z" fill="#efe6cf" opacity="0.9" transform="translate(4 -2)"/>' : '') }),
    garderobe: () => ({ vb: [60, 180], h: 44, ab: 0, inner:
      `<rect x="28" y="10" width="4" height="164" fill="#3a2414"/><path d="M14 178 L30 166 L46 178" stroke="#3a2414" stroke-width="4" fill="none"/><path d="M30 16 l-12 6 M30 16 l12 6" stroke="#3a2414" stroke-width="3"/>` +
      `<path d="M18 20 Q10 24 8 60 L6 120 Q18 126 28 122 L30 24 Z" fill="#6b5a44"/><path d="M42 20 Q50 24 52 60 L54 120 Q42 126 32 122 L30 24 Z" fill="#5f4f3a"/>` +
      `<ellipse cx="30" cy="10" rx="18" ry="4" fill="#2a2420"/><path d="M20 10 Q20 -2 30 -2 Q40 -2 40 10 Z" fill="#2a2420"/><rect x="20" y="6" width="20" height="3" fill="#6a2a2a"/>` }),
    buste: () => ({ vb: [60, 130], h: 32, ab: 0, inner:
      `<rect x="14" y="70" width="32" height="56" fill="#cfc6b4"/><rect x="10" y="64" width="40" height="8" fill="#e0d8c6"/><rect x="10" y="124" width="40" height="6" fill="#b0a894"/>` +
      `<path d="M14 64 Q12 44 30 40 Q48 44 46 64 Z" fill="#e8e0ce"/><ellipse cx="30" cy="26" rx="11" ry="14" fill="#e8e0ce"/><path d="M19 22 Q22 10 30 10 Q40 10 41 22 Q36 16 30 16 Q24 16 19 22 Z" fill="#d6ccb6"/><path d="M26 26 h1 M33 26 h1" stroke="#9a907c" stroke-width="1.4"/>` }),
    monitorwand: (r) => ({ vb: [180, 110], h: 26, ab: 12, inner:
      Array.from({ length: 6 }, (_, i) => { const x = (i % 3) * 60; const y = Math.floor(i / 3) * 54; return `<rect x="${x + 2}" y="${y + 2}" width="56" height="50" rx="3" fill="#0d1517" stroke="#2a3a3e" stroke-width="2"/>` +
        (i % 3 === 0 ? `<path class="cl-a-welle-bild" d="M${x + 6} ${y + 30} q5 -12 10 0 t10 0 t10 0 t10 0 t10 0" stroke="#39f5c6" stroke-width="1.2" fill="none"/>` :
          i % 3 === 1 ? Array.from({ length: 6 }, (_2, j) => `<rect x="${x + 8 + j * 8}" y="${y + 44 - zahl(r, 6, 30)}" width="5" height="${zahl(r, 6, 30).toFixed(0)}" fill="#ff3d8b" opacity="0.7"/>`).join('') :
            `<text x="${x + 8}" y="${y + 18}" font-size="6" fill="#39f5c6" font-family="Menlo,monospace" class="cl-a-tippen">&gt; ${r.wahl(['PROBE 7: AKTIV', 'DRUCK: 3,2 BAR', 'ZUGANG? ____', 'FEHLER 0x3F'])}</text><text x="${x + 8}" y="${y + 30}" font-size="6" fill="#39f5c6" opacity="0.6" font-family="Menlo,monospace">&gt; …</text>`); }).join('') }),
    druckanzeigen: (r) => ({ vb: [120, 90], h: 22, ab: 18, inner:
      `<rect width="120" height="90" rx="6" fill="#2c3440"/>` + [[30, 30], [90, 30], [60, 64]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="20" fill="#efe6cf" stroke="#8a98a8" stroke-width="3"/><path d="M${x - 15} ${y + 6} a16 16 0 0 1 30 0" stroke="#d22" stroke-width="2" fill="none" opacity="0.5"/>` +
        `<line x1="${x}" y1="${y}" x2="${x + 12}" y2="${y - 8}" stroke="#222" stroke-width="2" class="cl-a-zeiger" style="transform-origin:${x}px ${y}px;animation-delay:-${i}s"/><circle cx="${x}" cy="${y}" r="2.5" fill="#222"/>`).join('') }),
    kuckucksuhr: () => ({ vb: [70, 110], h: 22, ab: 22, inner:
      `<path d="M2 30 L35 2 L68 30 Z" fill="#7a4b2a"/><rect x="8" y="28" width="54" height="50" fill="#a0673a"/><circle cx="35" cy="50" r="15" fill="#fff8e6" stroke="#5a3a1c" stroke-width="2"/>` +
      `<path d="M35 50 V40 M35 50 l7 3" stroke="#3a2414" stroke-width="1.8" stroke-linecap="round"/><rect x="28" y="10" width="14" height="14" fill="#3a2414"/><path d="M30 18 q5 -6 10 0 l-2 3 h-6 Z" fill="#ffd166" class="cl-a-kuckuck"/>` +
      `<g class="cl-a-pendel" style="transform-origin:35px 78px"><line x1="35" y1="78" x2="35" y2="100" stroke="#b8893a" stroke-width="1.4"/><path d="M30 100 l5 -8 l5 8 l-5 8 Z" fill="#b8893a"/></g>` }),
    schaukelpferd: () => ({ vb: [110, 90], h: 20, ab: 0, inner:
      `<g class="cl-a-schaukeln" style="transform-origin:55px 84px"><path d="M4 76 Q55 98 106 76" stroke="#d6455b" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M26 80 L34 50 M84 80 L76 50" stroke="#a0673a" stroke-width="5"/>` +
      `<path d="M28 50 Q55 36 82 50 L84 42 Q92 20 82 10 L76 14 Q80 26 72 36 Q55 30 30 40 Z" fill="#f4efe6" stroke="#a0673a" stroke-width="2"/><circle cx="80" cy="20" r="1.8" fill="#111"/><path d="M72 12 q-8 6 -6 20" stroke="#ff9f1c" stroke-width="4" fill="none"/><path d="M30 44 q-8 4 -12 14" stroke="#ff9f1c" stroke-width="4" fill="none"/></g>` }),
    kacheln: (r, k, st, blut) => ({ vb: [130, 150], h: 38, ab: 0, inner:
      Array.from({ length: 6 }, (_, y) => Array.from({ length: 5 }, (_2, x) => `<rect x="${x * 26}" y="${y * 25}" width="25" height="24" fill="${r() < 0.12 ? '#a8b0a6' : '#c9d2c8'}" stroke="#8a948a" stroke-width="0.8"/>`).join('')).join('') +
      `<rect x="40" y="10" width="50" height="40" fill="#9fb0b8" stroke="#6a7a80" stroke-width="2"/><path d="M50 14 l14 16 l-6 4 l14 12" stroke="#2a3438" stroke-width="0.8" fill="none"/>` +
      `<path d="M34 92 h62 l-6 18 h-50 Z" fill="#e8ecea" stroke="#8a948a" stroke-width="1.4"/><rect x="62" y="80" width="6" height="12" fill="#9aa7b8"/>` +
      (blut ? '<path class="cl-blutspur-wand" d="M70 110 q-2 14 1 30 m-8 -26 q-1 10 1 18" stroke="#7a0000" stroke-width="2.4" fill="none" stroke-linecap="round"/>' : '<path d="M70 110 q-1 14 1 30" stroke="#6a6a40" stroke-width="1.6" fill="none" opacity="0.5"/>') }),
    tuerfenster: () => ({ vb: [80, 170], h: 42, ab: 0, inner:
      `<rect x="0" y="0" width="80" height="170" fill="#4a524c"/><rect x="6" y="6" width="68" height="164" fill="#6d766f"/><rect x="24" y="24" width="32" height="40" fill="#0c1210"/>` +
      `<g class="cl-schemen"><ellipse cx="40" cy="44" rx="9" ry="11" fill="#000"/><rect x="30" y="52" width="20" height="14" fill="#000"/></g><rect x="24" y="24" width="32" height="40" fill="#9fdcc8" opacity="0.06"/>` +
      `<path d="M24 24 l32 40 M56 24 l-32 40" stroke="#3a423c" stroke-width="0.6"/><rect x="58" y="86" width="12" height="4" rx="2" fill="#aab4ac"/><rect x="0" y="166" width="80" height="4" fill="#ffe7a0" opacity="0.2" class="cl-tuerspalt"/>` }),
    bett: (r, k, st, blut) => ({ vb: [180, 80], h: 18, ab: 0, inner:
      `<path d="M8 10 V78 M172 30 V78" stroke="#8a948a" stroke-width="5"/><rect x="8" y="36" width="164" height="18" fill="#c9cfc6"/><rect x="12" y="28" width="40" height="12" rx="5" fill="#e8ecea"/>` +
      `<path d="M50 36 Q90 26 168 34 V54 H50 Z" fill="#a8b0a6"/>${blut ? '<ellipse cx="110" cy="40" rx="12" ry="4" fill="#6a0000" opacity="0.8"/>' : ''}<path d="M8 10 h20 M18 10 v26" stroke="#8a948a" stroke-width="3"/><circle cx="18" cy="76" r="4" fill="#3a3a3a"/><circle cx="166" cy="76" r="4" fill="#3a3a3a"/>` }),
    kronleuchter: null,
  };

  // ---------------------------------------------------------------- Welten: was an die Wand kommt, Licht, Boden, Decke, Verfall
  const BAU = {
    krimi: { module: [['fenster', 'jalousie', 'stadt'], ['pinnwand'], ['aktenschrank'], ['garderobe'], ['regal', 'ordner'], ['bild', 'karte']], licht: 'birne', decke: 'ventilator', boden: 'dielen', verfall: 'risse', wand: 'tapete-streifen' },
    labor: { module: [['regal', 'kolben'], ['tank'], ['monitorwand'], ['rohre'], ['tank'], ['fenster', 'gitter', 'mond']], licht: 'neon', decke: 'roehren', boden: 'fliesen', verfall: 'funken', wand: 'kacheln-gruen' },
    grab: { module: [['hieroglyphen'], ['waechter'], ['saeule'], ['regal', 'urnen'], ['saeule'], ['hieroglyphen']], licht: 'fackel', decke: 'stein', boden: 'sandstein', verfall: 'sand', wand: 'quader' },
    station: { module: [['fenster', 'rund', 'erde'], ['paneel'], ['spind'], ['rohre'], ['fenster', 'rund', 'erde'], ['monitorwand']], licht: 'status', decke: 'leitungen', boden: 'gitter', verfall: 'funken', wand: 'paneele' },
    spuk: { module: [['fenster', 'bogen', 'mond'], ['bild', 'portraet'], ['kamin'], ['standuhr'], ['bild', 'portraet'], ['regal', 'buecher']], licht: 'kerze', decke: 'gewoelbe', boden: 'dielen-alt', verfall: 'risse', wand: 'tapete-damast' },
    bibliothek: { module: [['regal', 'buecher'], ['regal', 'buecher'], ['fenster', 'bogen', 'mond'], ['buste'], ['standuhr'], ['bild', 'karte']], licht: 'kerze', decke: 'gewoelbe', boden: 'parkett', verfall: 'risse', wand: 'holztaefel' },
    pirat: { module: [['spanten'], ['fenster', 'rund', 'meer'], ['netz'], ['kanone'], ['bild', 'karte'], ['spanten']], licht: 'laterne', decke: 'balken', boden: 'planken', verfall: 'wasser', wand: 'schiffsplanken' },
    akademie: { module: [['bild', 'tafel'], ['fenster', 'eckig', 'campus'], ['regal', 'ordner'], ['bild', 'periodensystem'], ['aktenschrank'], ['fenster', 'eckig', 'campus']], licht: 'roehre', decke: 'roehren', boden: 'linoleum', verfall: 'flackern', wand: 'putz' },
    zirkus: { module: [['vorhang'], ['bild', 'plakat'], ['kaefig'], ['podest'], ['bild', 'plakat'], ['vorhang']], licht: 'scheinwerfer', decke: 'zelt', boden: 'manege', verfall: 'flackern', wand: 'zeltbahnen' },
    dschungel: { module: [['steinkopf'], ['ranken'], ['wasserfall'], ['saeule'], ['ranken'], ['fenster', 'bogen', 'dschungel']], licht: 'fackel', decke: 'lianen', boden: 'moos', verfall: 'ranken', wand: 'tempelstein' },
    unterwasser: { module: [['fenster', 'panorama', 'tiefsee'], ['druckanzeigen'], ['rohre'], ['fenster', 'rund', 'tiefsee'], ['spind'], ['paneel']], licht: 'status', decke: 'leitungen', boden: 'gitter', verfall: 'wasser', wand: 'stahl' },
    spielzeug: { module: [['regal', 'spielzeug'], ['fenster', 'schau', 'schnee'], ['kuckucksuhr'], ['schaukelpferd'], ['regal', 'spielzeug'], ['bild', 'zeichnung']], licht: 'lampion', decke: 'girlande', boden: 'karo', verfall: 'spielzeug', wand: 'tapete-sterne' },
    western: { module: [['bar'], ['fenster', 'eckig', 'wueste'], ['bild', 'steckbrief'], ['pendeltuer'], ['geweih'], ['bild', 'steckbrief']], licht: 'laterne', decke: 'balken', boden: 'dielen-hell', verfall: 'sand', wand: 'bretter' },
    sanatorium: { module: [['fenster', 'gitter', 'mond'], ['kacheln'], ['tuerfenster'], ['bett'], ['aktenschrank'], ['fenster', 'gitter', 'mond']], licht: 'roehre', decke: 'roehren', boden: 'fliesen-alt', verfall: 'risse', wand: 'kacheln-alt' },
  };

  /** Was für ein Ort ist die Szene? Aus der KI („art“) oder aus dem Titel */
  const ORTE = {
    keller: /keller|gruft|krypta|kerker|verlies|tunnel|mine|stollen|höhle|hoehle|gewölbe|katakomb|unterdeck|laderaum|bunker|kanal|schacht|grab/i,
    oben: /dach|turm|deck|brücke|bruecke|kuppel|aussicht|sternwarte|krähennest|kraehennest|balkon|terrasse|garten|hof/i,
    gang: /gang|flur|korridor|treppe|schleuse|durchgang|passage|tür|tuer|eingang|foyer/i,
    halle: /halle|saal|manege|arena|lesesaal|hörsaal|hoersaal|kirche|kapelle|ballsaal|tempel|thron/i,
    technik: /labor|werkstatt|maschine|reaktor|antrieb|technik|kontroll|server|zentrale|generator|kessel|lager/i,
  };
  const ortArt = (titel, art) => (ORTE[art] ? art : Object.keys(ORTE).find((k) => ORTE[k].test(String(titel || ''))) || null);

  /** Verfall, wenn die Zeit knapp wird – für Kinder nur harmlos */
  const VERFALL = {
    wasser: { kinder: true, texte: ['Wasser sickert über den Boden.', 'Das Wasser steht dir schon bis über die Knöchel!', 'Das Wasser steigt und steigt – beeil dich!'], kinderTexte: ['Plitsch! Eine Pfütze am Boden.', 'Das Wasser plätschert um deine Füße!', 'Jetzt wird’s nass – schnell!'] },
    sand: { kinder: true, texte: ['Feiner Sand rieselt aus den Fugen.', 'Der Sand türmt sich in den Ecken.', 'Sand strömt herein – die Kammer füllt sich!'], kinderTexte: ['Rieselriesel – da kommt Sand!', 'Der Sandhaufen wird größer!', 'Gleich bist du im Sandkasten – schnell!'] },
    risse: { kinder: false, texte: ['Ein feiner Riss zieht sich durch die Wand.', 'Putz bröckelt. Die Risse werden breiter.', 'Die Wände ächzen – lange hält das nicht mehr!'] },
    funken: { kinder: true, texte: ['Irgendwo zischt ein Kabel.', 'Funken sprühen aus den Leitungen. Rotes Licht.', 'Überlastung! Alles sprüht Funken!'], kinderTexte: ['Bzzzt! Ein Kabel funkelt.', 'Es blinkt und funkt überall!', 'Alle Lampen blinken – schnell!'] },
    ranken: { kinder: true, texte: ['Ranken kriechen die Wände hinauf.', 'Die Ranken wachsen schneller, als du schauen kannst.', 'Der Dschungel holt sich den Raum zurück!'], kinderTexte: ['Huch, die Pflanzen wachsen!', 'Die Blätter werden immer mehr!', 'Gleich ist alles grün – schnell!'] },
    flackern: { kinder: true, texte: ['Das Licht flackert.', 'Das Licht flackert immer öfter.', 'Gleich gehen die Lichter aus!'], kinderTexte: ['Die Lampen blinzeln!', 'Die Lampen blinzeln immer schneller!', 'Gleich ist die Show vorbei – schnell!'] },
    spielzeug: { kinder: true, texte: ['Ein Spielzeug wackelt.', 'Die Spielzeuge drehen die Köpfe nach dir.', 'Alle Spielzeuge bewegen sich!'], kinderTexte: ['Hihi, ein Teddy wackelt!', 'Die Spielsachen tanzen!', 'Alle Spielsachen hüpfen – schnell!'] },
  };

  /** Ereignisse hinterlassen Spuren im Raum (bleiben in der Szene) */
  const SPUR = { beben: 'risse', explosion: 'risse', glas: 'glas', regen: 'regen', gewitter: 'regen', geheimtuer: 'geheimtuer', tuerknall: 'schief', brief: 'brief', kraehen: 'federn', stromausfall: 'notlicht' };
  const REAKTION_MS = { alarm: 18000, gewitter: 3000, stromausfall: 25000, glitch: 3000, trommeln: 6000, uhrschlag: 5000, fackel: 8000, heulen: 8000, schritte: 7000, fluestern: 6000, anruf: 6000, funkspruch: 6000, kraehen: 5000, regen: 9000 };

  function modulBauen(eintrag, r, ctx) {
    const [art, a, b] = eintrag;
    const k = ctx.alter === 'kinder';
    if (art === 'fenster') return fenster(a, b, r, k, ctx.welt === 'sanatorium' ? '#3b3d3a' : ctx.welt === 'akademie' ? '#c9c4b8' : ctx.welt === 'labor' ? '#3a4448' : '#3a2a1c');
    if (art === 'regal') return regal(a, r, k, ctx.welt === 'spielzeug' ? '#c98a4a' : ctx.welt === 'labor' ? '#5d6a70' : ctx.welt === 'akademie' ? '#8a7a5a' : '#4a2f1c', ctx.welt === 'labor' ? '#1a2426' : ctx.welt === 'spielzeug' ? '#7a4b2a' : '#2e1c10');
    if (art === 'bild') return bild(a, r, k, ctx.stimmung || {});
    const f = EINZEL[art];
    return f ? f(r, k, ctx.stimmung || {}, ctx.blut) : null;
  }

  // Lichter (eins je Rätsel der Szene) – gehen beim Lösen an
  function lichtElement(typ, i) {
    const formen = {
      fackel: '<svg viewBox="0 0 30 60"><path d="M11 60 L9 26 H21 L19 60 Z" fill="#4a2f1c"/><path d="M7 22 h16 l-2 6 h-12 Z" fill="#6a5030"/><g class="cl-flamme"><path d="M15 2 Q24 12 21 20 Q18 26 15 24 Q12 26 9 20 Q6 12 15 2 Z" fill="#ff8a1a"/><path d="M15 9 Q20 15 18 20 Q15 23 12 20 Q11 15 15 9 Z" fill="#ffd166"/></g></svg>',
      kerze: '<svg viewBox="0 0 40 50"><path d="M4 48 H36 M20 48 V38 M8 38 H32" stroke="#b8893a" stroke-width="3" fill="none"/><rect x="15" y="18" width="10" height="20" fill="#efe6cf"/><g class="cl-flamme"><path d="M20 2 Q26 10 24 14 Q22 18 20 17 Q18 18 16 14 Q14 10 20 2 Z" fill="#ffb347"/><path d="M20 8 Q22 12 21 14 Q20 15 19 14 Q18 12 20 8 Z" fill="#fff3c4"/></g></svg>',
      birne: '<svg viewBox="0 0 30 60"><line x1="15" y1="0" x2="15" y2="26" stroke="#222" stroke-width="1.4"/><rect x="10" y="24" width="10" height="8" fill="#555"/><g class="cl-flamme"><circle cx="15" cy="40" r="9" fill="#ffe7a0"/></g><circle cx="15" cy="40" r="9" fill="none" stroke="#888" stroke-width="0.8"/></svg>',
      neon: '<svg viewBox="0 0 60 20"><rect x="2" y="4" width="56" height="4" fill="#3a4448"/><g class="cl-flamme"><rect x="4" y="9" width="52" height="5" rx="2.5" fill="#bfffee"/></g></svg>',
      roehre: '<svg viewBox="0 0 60 20"><rect x="2" y="2" width="56" height="5" fill="#8a8a80"/><g class="cl-flamme"><rect x="4" y="8" width="52" height="6" rx="3" fill="#f2f6ff"/></g></svg>',
      status: '<svg viewBox="0 0 30 30"><rect x="3" y="3" width="24" height="24" rx="5" fill="#1c2238" stroke="#3a4468" stroke-width="2"/><circle class="cl-led" cx="15" cy="15" r="7"/></svg>',
      laterne: '<svg viewBox="0 0 30 60"><line x1="15" y1="0" x2="15" y2="14" stroke="#222" stroke-width="1.4"/><path d="M8 14 h14 l-2 6 h-10 Z" fill="#2a2a2a"/><rect x="8" y="20" width="14" height="24" fill="#2a2a2a"/><g class="cl-flamme"><rect x="10" y="22" width="10" height="20" fill="#ffcf6a"/></g><path d="M8 44 h14 l-3 5 h-8 Z" fill="#2a2a2a"/></svg>',
      scheinwerfer: '<svg viewBox="0 0 40 40"><line x1="20" y1="0" x2="20" y2="10" stroke="#222" stroke-width="2"/><path d="M8 12 h24 l-4 18 h-16 Z" fill="#2a2a34"/><g class="cl-flamme"><ellipse cx="20" cy="30" rx="8" ry="3" fill="#fff6d6"/></g></svg>',
      lampion: '<svg viewBox="0 0 34 50"><line x1="17" y1="0" x2="17" y2="10" stroke="#555" stroke-width="1"/><rect x="12" y="9" width="10" height="4" fill="#7a4b2a"/><g class="cl-flamme"><ellipse cx="17" cy="28" rx="13" ry="15" fill="#ffb347"/></g><path d="M5 28 h24 M7 20 h20 M7 36 h20" stroke="#d6455b" stroke-width="1" opacity="0.6"/><rect x="12" y="42" width="10" height="4" fill="#7a4b2a"/></svg>',
    };
    const d = el('div', { class: `cl-licht-punkt ${typ}`, 'data-i': i });
    d.innerHTML = (formen[typ] || formen.birne) + '<i class="cl-licht-schein"></i>' + (typ === 'scheinwerfer' ? '<i class="cl-licht-kegel"></i>' : '');
    return d;
  }

  /** Den Raum bauen */
  function bauen({ welt, szene = 0, titel = '', art = null, breite = 1.6, alter = 'ab14', blut = false, stimmung = {}, belegt = [], lichter = 4, seed = 1 }) {
    const B = BAU[welt] || BAU.akademie;
    const r = Clavis.zufall(seed * 7919 + szene * 104729 + 13);
    const ort = ortArt(titel, art);
    const ctx = { welt, alter, blut, stimmung };
    const kinder = alter === 'kinder';

    // Module verteilen: Plätze über die ganze Breite; Wand-Requisiten freilassen
    const n = Math.max(4, Math.round(breite * 3.1));
    const liste = r.mischen(B.module);
    let vorrat = [];
    const wandX = belegt.filter((b) => b.platz === 'wand').map((b) => b.x);
    const module = el('div', { class: 'cl-module' });
    for (let i = 0; i < n; i++) {
      if (!vorrat.length) vorrat = liste.slice();
      let eintrag = vorrat.shift();
      // Szenen-Art formt den Raum: Keller ohne Fenster, Technik mit Rohren, oben mit mehr Fenstern
      if (ort === 'keller' && eintrag[0] === 'fenster') eintrag = B.module.find((m) => m[0] !== 'fenster' && m[0] !== 'bild') || eintrag;
      if (ort === 'technik' && i % 3 === 1) eintrag = ['rohre'];
      if (ort === 'oben' && i % 3 === 0) eintrag = B.module.find((m) => m[0] === 'fenster') || eintrag;
      const x = ((i + 0.5) / n) * 100 + zahl(r, -2.5, 2.5);
      const m = modulBauen(eintrag, r, ctx);
      if (!m) continue;
      const haengt = m.ab > 6;
      if (haengt && wandX.some((w) => Math.abs(w - x) < 9)) continue;
      const hoehe = m.h * (ort === 'halle' ? 1.12 : ort === 'gang' ? 0.92 : 1);
      const d = el('div', { class: `cl-modul m-${eintrag[0]}${eintrag[1] ? ' m-' + eintrag[1] : ''}${haengt ? ' haengt' : ''}`, style: { left: `${x.toFixed(2)}%`, height: `${hoehe.toFixed(1)}%`, bottom: `calc(var(--horizont-unten) + ${m.ab.toFixed(1)}%)`, aspectRatio: `${m.vb[0]} / ${m.vb[1]}`, '--neig': `${zahl(r, -1.2, 1.2).toFixed(2)}deg` } });
      d.innerHTML = svg(m.vb, m.inner);
      module.append(d);
    }
    // Gang: Türen in Reihe, Keller: Gewölbebögen, Halle: Säulen – als zusätzliche Schicht
    const extra = el('div', { class: 'cl-ort-schicht ' + (ort || 'zimmer') });

    // Lichter
    const lichtLage = el('div', { class: 'cl-lichter ' + B.licht });
    const nL = Math.max(1, Math.min(8, lichter));
    for (let i = 0; i < nL; i++) {
      const l = lichtElement(B.licht, i);
      l.style.left = `${(((i + 0.5) / nL) * 88 + 6).toFixed(1)}%`;
      lichtLage.append(l);
    }

    const wand = el('div', { class: `cl-wand-bau w-${B.wand}`, 'data-ort': ort || 'zimmer' }, el('div', { class: 'cl-wand-muster' }), extra, module, el('div', { class: 'cl-risse' }), el('div', { class: 'cl-ranken-wachsen' }));
    const decke = el('div', { class: `cl-decke d-${B.decke}` });
    if (B.decke === 'zelt' || B.decke === 'girlande') {
      const g = el('div', { class: 'cl-girlande' });
      g.innerHTML = `<svg viewBox="0 0 400 40" preserveAspectRatio="none"><path d="M0 4 Q100 40 200 6 Q300 40 400 4" stroke="#3a2a1c" stroke-width="1.2" fill="none"/>${Array.from({ length: 20 }, (_, i) => { const x = i * 20 + 10; const y = 4 + Math.abs(Math.sin(((x % 200) / 200) * Math.PI)) * 26; return B.decke === 'zelt' ? `<circle cx="${x}" cy="${y + 3}" r="3" class="cl-birnchen" style="animation-delay:${(i % 5) * 0.3}s"/>` : `<path d="M${x - 6} ${y} h12 l-6 12 Z" fill="${['#ff5d73', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'][i % 5]}"/>`; }).join('')}</svg>`;
      decke.append(g);
    }
    if (B.decke === 'gewoelbe') {
      const k = el('div', { class: 'cl-kronleuchter' });
      k.innerHTML = '<svg viewBox="0 0 120 90"><line x1="60" y1="0" x2="60" y2="34" stroke="#2a2a2a" stroke-width="1.5"/><path d="M14 50 Q60 74 106 50" stroke="#b8893a" stroke-width="3" fill="none"/><path d="M34 44 Q60 60 86 44" stroke="#b8893a" stroke-width="2.4" fill="none"/>' +
        [14, 34, 60, 86, 106].map((x, i) => `<rect x="${x - 2.5}" y="${i === 2 ? 52 : i % 2 ? 36 : 40}" width="5" height="10" fill="#efe6cf"/><path class="cl-flamme" d="M${x} ${i === 2 ? 44 : i % 2 ? 28 : 32} q4 5 0 8 q-4 -3 0 -8 Z" fill="#ffb347"/>`).join('') + '<circle cx="60" cy="60" r="6" fill="#b8893a"/></svg>';
      decke.append(k);
    }
    if (B.decke === 'ventilator') {
      const v = el('div', { class: 'cl-ventilator' });
      v.innerHTML = '<svg viewBox="0 0 120 40"><line x1="60" y1="0" x2="60" y2="16" stroke="#222" stroke-width="2"/><g class="cl-a-drehen" style="transform-origin:60px 20px"><ellipse cx="34" cy="20" rx="26" ry="4" fill="#3a2414"/><ellipse cx="86" cy="20" rx="26" ry="4" fill="#3a2414"/></g><circle cx="60" cy="20" r="6" fill="#2a2a2a"/></svg>';
      decke.append(v);
    }
    if (B.decke === 'lianen') {
      const l = el('div', { class: 'cl-lianen' });
      l.innerHTML = `<svg viewBox="0 0 400 80" preserveAspectRatio="none">${Array.from({ length: 14 }, (_, i) => `<path class="cl-a-schwingen" style="animation-delay:-${i * 0.4}s;transform-origin:${i * 30}px 0" d="M${i * 30 + 6} 0 q${(i % 2 ? 8 : -8)} ${20 + (i % 3) * 10} 0 ${40 + (i % 4) * 10}" stroke="#2f5a2a" stroke-width="2.4" fill="none"/>`).join('')}</svg>`;
      decke.append(l);
    }

    const boden = el('div', { class: `cl-boden-bau b-${B.boden}` }, el('div', { class: 'cl-boden-flaeche' }), el('div', { class: 'cl-boden-glanz' }));
    const verfallArt = kinder && !(VERFALL[B.verfall] || {}).kinder ? 'flackern' : B.verfall;
    const verfall = el('div', { class: 'cl-verfall v-' + verfallArt }, el('i', { class: 'v1' }), el('i', { class: 'v2' }), el('i', { class: 'v3' }));
    const seitenwand = (seite) => el('div', { class: `cl-seitenwand ${seite} w-${B.wand}` }, el('div', { class: 'cl-wand-muster' }));
    return { wand, decke, boden, lichter: lichtLage, verfall, links: seitenwand('links'), rechts: seitenwand('rechts'), ort: ort || 'zimmer', verfallArt, licht: B.licht };
  }

  /** Text, wenn der Verfall eine Stufe weiter ist (1–3) */
  const verfallText = (art, stufe, kinder) => { const v = VERFALL[art]; if (!v || stufe < 1) return ''; return ((kinder && v.kinderTexte) || v.texte)[Math.min(3, stufe) - 1]; };

  Clavis.Kulisse = { bauen, ortArt, verfallText, SPUR, REAKTION_MS, BAU };
})();
