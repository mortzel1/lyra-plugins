'use strict';
/*
 * Vertex – Zeichnen. Eine Szene (Raster, Achsen, Graphen, Flächen, Punkte, Markierungen) wird über einen „Stift“
 * gezeichnet – derselbe Code malt auf die Zeichenfläche (Canvas) und schreibt SVG für den Export.
 */
const Grafik = (() => {
  const SCHRIFT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
  const FARBEN = ['#2563EB', '#DC2626', '#16A34A', '#9333EA', '#EA580C', '#0891B2', '#DB2777', '#475569', '#CA8A04', '#0D9488'];

  // ================================================================ Farben

  function hexRgb(hex) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mischen(a, b, anteil) {
    const x = hexRgb(a), y = hexRgb(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * anteil).toString(16).padStart(2, '0')).join('');
  }
  function rgba(hex, alpha) {
    const [r, g, b] = hexRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  /** Farben der Fläche – aus Lyras CSS (hell/dunkel) oder fest hell (Export). */
  function thema(festHell = false) {
    const dunkel = !festHell && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
    if (!dunkel) {
      return { dunkel: false, grund: '#ffffff', text: '#1a1b25', leise: '#5f6475', rasterFein: '#eef0f4', raster: '#dde1e8', achse: '#3a3d4a', halo: '#ffffff' };
    }
    return { dunkel: true, grund: '#1d1f24', text: '#ececf1', leise: '#a2a7b8', rasterFein: '#25282f', raster: '#30343d', achse: '#c9ccd6', halo: '#1d1f24' };
  }
  const graphFarbe = (hex, th) => (th.dunkel ? mischen(hex, '#ffffff', 0.3) : hex);

  // ================================================================ Ansicht: Welt ↔ Bildschirm

  /** ansicht {cx, cy, sx, sy} (Mitte und Pixel je Einheit) → Umrechnungen für eine Fläche W × H */
  function abbildung(a, W, H) {
    const X = (x) => W / 2 + (x - a.cx) * a.sx;
    const Y = (y) => H / 2 - (y - a.cy) * a.sy;
    const x = (px) => a.cx + (px - W / 2) / a.sx;
    const y = (py) => a.cy - (py - H / 2) / a.sy;
    return { X, Y, x, y, W, H, sx: a.sx, sy: a.sy, xmin: x(0), xmax: x(W), ymin: y(H), ymax: y(0) };
  }

  /** Rasterschritt (1-2-5) für etwa `ziel` Pixel Abstand. */
  function schritt(pxProEinheit, ziel = 92) {
    const roh = ziel / pxProEinheit;
    const mag = Math.pow(10, Math.floor(Math.log10(roh)));
    for (const k of [1, 2, 5, 10]) {
      if (k * mag >= roh * 0.999) return { gross: k * mag, fein: k === 2 ? (k * mag) / 4 : (k * mag) / 5 };
    }
    return { gross: 10 * mag, fein: 2 * mag };
  }
  /** Rasterschritt als Vielfaches von π (für Winkelfunktionen). */
  function piSchritt(pxProEinheit, ziel = 92) {
    const roh = ziel / pxProEinheit;
    const teile = [[1, 12], [1, 6], [1, 4], [1, 2], [1, 1], [2, 1], [5, 1], [10, 1], [20, 1], [50, 1], [100, 1]];
    for (const [z, n] of teile) {
      const s = (Math.PI * z) / n;
      if (s >= roh * 0.999) return { gross: s, fein: s / (n >= 4 ? 3 : 2), pi: [z, n] };
    }
    return { gross: Math.PI * 100, fein: Math.PI * 50, pi: [100, 1] };
  }
  const ggt = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  function piText(k, [z, n]) {
    // k · z/n · π
    let zaehler = k * z, nenner = n;
    const g = ggt(zaehler, nenner) || 1;
    zaehler /= g; nenner /= g;
    if (zaehler === 0) return '0';
    const vz = zaehler < 0 ? '−' : '';
    const a = Math.abs(zaehler);
    const kopf = (a === 1 ? '' : a) + 'π';
    return vz + (nenner === 1 ? kopf : kopf + '/' + nenner);
  }
  function zahlText(v, gross) {
    const stellen = Math.max(0, Math.ceil(-Math.log10(gross) - 1e-9));
    if (Math.abs(v) < gross * 1e-6) return '0';
    if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4)) return Mathe.zahlKurz(v, 3);
    return v.toFixed(stellen).replace('-', '−').replace('.', ',');
  }

  // ================================================================ Stifte

  function canvasStift(ctx) {
    const strich = (st) => {
      ctx.strokeStyle = st.alpha !== undefined ? rgba(st.farbe, st.alpha) : st.farbe;
      ctx.lineWidth = st.breite || 1;
      ctx.setLineDash(st.strich === 'gestrichelt' ? [7, 5] : st.strich === 'gepunktet' ? [1.5, 4] : []);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };
    return {
      linien(pfade, st) {
        strich(st);
        ctx.beginPath();
        for (const p of pfade) {
          if (p.length < 2) continue;
          ctx.moveTo(p[0][0], p[0][1]);
          for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      },
      segmente(l, st) {
        strich(st);
        ctx.beginPath();
        for (let i = 0; i < l.length; i += 4) { ctx.moveTo(l[i], l[i + 1]); ctx.lineTo(l[i + 2], l[i + 3]); }
        ctx.stroke();
        ctx.setLineDash([]);
      },
      flaeche(punkte, st) {
        if (punkte.length < 3) return;
        ctx.fillStyle = rgba(st.farbe, st.alpha ?? 0.2);
        ctx.beginPath();
        ctx.moveTo(punkte[0][0], punkte[0][1]);
        for (let i = 1; i < punkte.length; i++) ctx.lineTo(punkte[i][0], punkte[i][1]);
        ctx.closePath();
        ctx.fill();
      },
      rechtecke(l, st) {
        ctx.fillStyle = rgba(st.farbe, st.alpha ?? 0.2);
        ctx.beginPath();
        for (let i = 0; i < l.length; i += 4) ctx.rect(l[i], l[i + 1], l[i + 2], l[i + 3]);
        ctx.fill();
      },
      kreis(x, y, r, st) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (st.fuell) { ctx.fillStyle = st.fuell; ctx.fill(); }
        if (st.rand) { ctx.setLineDash([]); ctx.strokeStyle = st.rand; ctx.lineWidth = st.breite || 1.5; ctx.stroke(); }
      },
      text(x, y, s, st) {
        ctx.font = `${st.gewicht || 500} ${st.groesse || 12}px ${SCHRIFT}`;
        ctx.textAlign = st.ausrichtung || 'left';
        ctx.textBaseline = st.grundlinie || 'alphabetic';
        if (st.halo) {
          ctx.lineWidth = 3.5;
          ctx.lineJoin = 'round';
          ctx.strokeStyle = st.halo;
          ctx.setLineDash([]);
          ctx.strokeText(s, x, y);
        }
        ctx.fillStyle = st.farbe;
        ctx.fillText(s, x, y);
      },
      breite(s, groesse = 12, gewicht = 500) {
        ctx.font = `${gewicht} ${groesse}px ${SCHRIFT}`;
        return ctx.measureText(s).width;
      },
      etikett(x, y, s, st) {
        const g = st.groesse || 12;
        const w = this.breite(s, g, 600) + 14, hh = g + 10;
        let lx = x + 10, ly = y - hh - 8;
        if (lx + w > st.W - 4) lx = x - w - 10;
        if (ly < 4) ly = y + 10;
        ctx.fillStyle = st.grund;
        ctx.strokeStyle = rgba(st.farbe, 0.45);
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(lx, ly, w, hh, 7); else ctx.rect(lx, ly, w, hh);
        ctx.fill();
        ctx.stroke();
        this.text(lx + 7, ly + hh / 2 + 0.5, s, { farbe: st.textFarbe || st.farbe, groesse: g, gewicht: 600, grundlinie: 'middle' });
      },
    };
  }

  function svgStift(W, H) {
    const teile = [];
    const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const f = (v) => (Math.round(v * 10) / 10).toString();
    const strich = (st) => `fill="none" stroke="${st.farbe}"${st.alpha !== undefined ? ` stroke-opacity="${st.alpha}"` : ''} stroke-width="${st.breite || 1}" stroke-linecap="round" stroke-linejoin="round"${st.strich === 'gestrichelt' ? ' stroke-dasharray="7 5"' : st.strich === 'gepunktet' ? ' stroke-dasharray="1.5 4"' : ''}`;
    const stift = {
      linien(pfade, st) {
        const d = pfade.filter((p) => p.length > 1).map((p) => 'M' + p.map((q) => f(q[0]) + ' ' + f(q[1])).join('L')).join('');
        if (d) teile.push(`<path d="${d}" ${strich(st)}/>`);
      },
      segmente(l, st) {
        let d = '';
        for (let i = 0; i < l.length; i += 4) d += `M${f(l[i])} ${f(l[i + 1])}L${f(l[i + 2])} ${f(l[i + 3])}`;
        if (d) teile.push(`<path d="${d}" ${strich(st)}/>`);
      },
      flaeche(punkte, st) {
        if (punkte.length < 3) return;
        teile.push(`<path d="M${punkte.map((q) => f(q[0]) + ' ' + f(q[1])).join('L')}Z" fill="${st.farbe}" fill-opacity="${st.alpha ?? 0.2}"/>`);
      },
      rechtecke(l, st) {
        let d = '';
        for (let i = 0; i < l.length; i += 4) d += `M${f(l[i])} ${f(l[i + 1])}h${f(l[i + 2])}v${f(l[i + 3])}h${f(-l[i + 2])}Z`;
        if (d) teile.push(`<path d="${d}" fill="${st.farbe}" fill-opacity="${st.alpha ?? 0.2}"/>`);
      },
      kreis(x, y, r, st) {
        teile.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${st.fuell || 'none'}"${st.rand ? ` stroke="${st.rand}" stroke-width="${st.breite || 1.5}"` : ''}/>`);
      },
      text(x, y, s, st) {
        const anker = { left: 'start', center: 'middle', right: 'end' }[st.ausrichtung || 'left'];
        const base = { top: 'hanging', middle: 'central', bottom: 'text-after-edge', alphabetic: 'auto' }[st.grundlinie || 'alphabetic'];
        const halo = st.halo ? ` stroke="${st.halo}" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke"` : '';
        teile.push(`<text x="${f(x)}" y="${f(y)}" font-family="Helvetica, Arial, sans-serif" font-size="${st.groesse || 12}" font-weight="${st.gewicht || 500}" text-anchor="${anker}" dominant-baseline="${base}" fill="${st.farbe}"${halo}>${e(s)}</text>`);
      },
      breite(s, groesse = 12) { return String(s).length * groesse * 0.56; },
      etikett(x, y, s, st) {
        const g = st.groesse || 12;
        const w = stift.breite(s, g) + 14, hh = g + 10;
        let lx = x + 10, ly = y - hh - 8;
        if (lx + w > W - 4) lx = x - w - 10;
        if (ly < 4) ly = y + 10;
        teile.push(`<rect x="${f(lx)}" y="${f(ly)}" width="${f(w)}" height="${hh}" rx="7" fill="${st.grund}" stroke="${st.farbe}" stroke-opacity=".45"/>`);
        stift.text(lx + 7, ly + hh / 2 + 0.5, s, { farbe: st.textFarbe || st.farbe, groesse: g, gewicht: 600, grundlinie: 'middle' });
      },
      ende(grund) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${grund}"/>${teile.join('')}</svg>`;
      },
    };
    return stift;
  }

  // ================================================================ Abtasten

  /** Graph einer Funktion y = f(x) als Polylinien (Bildschirmkoordinaten); unterbricht an Polen, Sprüngen und Lücken. */
  function funktionsPfade(f, A, bereich, fein = true) {
    const { W, H } = A;
    const lo = Math.max(A.xmin, bereich ? bereich.min : -Infinity), hi = Math.min(A.xmax, bereich ? bereich.max : Infinity);
    if (!(hi > lo)) return [];
    const pfade = [];
    let akt = [];
    const grenze = 6 * H;
    let budget = fein ? 160000 : 40000; // Auswertungen – auch wilde Funktionen (sin(100x)) bleiben flüssig
    const punkt = (px) => { budget--; const x = A.x(px); const y = f(x); return { px, py: Number.isFinite(y) ? A.Y(y) : NaN }; };
    const ab = () => { if (akt.length > 1) pfade.push(akt); else if (akt.length === 1) pfade.push([akt[0], [akt[0][0] + 0.01, akt[0][1]]]); akt = []; };
    const dazu = (p) => akt.push([p.px, Math.max(-grenze, Math.min(H + grenze, p.py))]);
    const tiefeMax = fein ? 8 : 5;
    function weiter(a, b, t) {
      const aOk = Number.isFinite(a.py), bOk = Number.isFinite(b.py);
      if (!aOk && !bOk) return;
      if (aOk !== bOk) {
        // Rand des Definitionsbereichs: fein annähern
        if (t < tiefeMax && budget > 0) {
          const m = punkt((a.px + b.px) / 2);
          weiter(a, m, t + 1);
          weiter(m, b, t + 1);
          return;
        }
        if (bOk) { ab(); dazu(b); } else ab();
        return;
      }
      const dy = Math.abs(b.py - a.py);
      const draussen = (a.py < -H && b.py < -H) || (a.py > 2 * H && b.py > 2 * H);
      if (dy > 1.5 && !draussen && t < tiefeMax && budget > 0) {
        const m = punkt((a.px + b.px) / 2);
        weiter(a, m, t + 1);
        weiter(m, b, t + 1);
        return;
      }
      if (dy > H && !draussen) { ab(); dazu(b); return; } // Sprung oder Pol
      dazu(b);
    }
    const p0 = Math.max(0, A.X(lo)), p1 = Math.min(W, A.X(hi));
    let vor = punkt(p0);
    if (Number.isFinite(vor.py)) dazu(vor);
    const schritt = fein ? 1 : 2;
    for (let px = p0 + schritt; ; px += schritt) {
      const q = punkt(Math.min(px, p1));
      weiter(vor, q, 0);
      vor = q;
      if (px >= p1) break;
    }
    ab();
    return pfade;
  }

  /** x = g(y) (z. B. senkrechte Geraden) */
  function senkrechtPfade(g, A, fein = true) {
    const pfade = [];
    let akt = [];
    const n = Math.ceil(A.H / (fein ? 1 : 2));
    for (let i = 0; i <= n; i++) {
      const py = (A.H * i) / n, x = g(A.y(py));
      if (!Number.isFinite(x)) { if (akt.length > 1) pfade.push(akt); akt = []; continue; }
      const px = A.X(x);
      if (akt.length && Math.abs(px - akt[akt.length - 1][0]) > A.W) { pfade.push(akt); akt = []; }
      akt.push([Math.max(-6 * A.W, Math.min(7 * A.W, px)), py]);
    }
    if (akt.length > 1) pfade.push(akt);
    return pfade;
  }

  /** Kurve (x(t), y(t)) für t von a bis b */
  function kurvenPfade(fx, fy, a, b, A, n = 1200) {
    const pfade = [];
    let akt = [];
    const g = 6 * Math.max(A.W, A.H);
    for (let i = 0; i <= n; i++) {
      const t = a + ((b - a) * i) / n;
      const x = fx(t), y = fy(t);
      if (!Number.isFinite(x) || !Number.isFinite(y)) { if (akt.length > 1) pfade.push(akt); akt = []; continue; }
      const p = [Math.max(-g, Math.min(g, A.X(x))), Math.max(-g, Math.min(g, A.Y(y)))];
      const l = akt[akt.length - 1];
      if (l && Math.hypot(p[0] - l[0], p[1] - l[1]) > Math.max(A.W, A.H)) { if (akt.length > 1) pfade.push(akt); akt = []; }
      akt.push(p);
    }
    if (akt.length > 1) pfade.push(akt);
    return pfade;
  }

  /** Höhenlinie F(x, y) = 0 per Marching Squares → Segmente [x1, y1, x2, y2, …] */
  function kontur(F, A, zelle) {
    const nx = Math.ceil(A.W / zelle), ny = Math.ceil(A.H / zelle);
    const w = new Float64Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++) {
      const y = A.y(j * zelle);
      for (let i = 0; i <= nx; i++) w[j * (nx + 1) + i] = F(A.x(i * zelle), y);
    }
    const seg = [];
    const kante = (x0, y0, f0, x1, y1, f1) => {
      if (!Number.isFinite(f0) || !Number.isFinite(f1) || f0 === f1 || (f0 < 0) === (f1 < 0)) return null;
      const t = f0 / (f0 - f1);
      const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
      // Vorzeichenwechsel durch einen Pol (z. B. 1/x): dort ist F nicht klein
      const fm = F(A.x(px), A.y(py));
      if (!Number.isFinite(fm) || Math.abs(fm) > 0.3 * (Math.abs(f0) + Math.abs(f1)) + 1e-12) return null;
      return [px, py];
    };
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = w[j * (nx + 1) + i], b = w[j * (nx + 1) + i + 1], c = w[(j + 1) * (nx + 1) + i + 1], d = w[(j + 1) * (nx + 1) + i];
        const x0 = i * zelle, y0 = j * zelle, x1 = x0 + zelle, y1 = y0 + zelle;
        const p = [kante(x0, y0, a, x1, y0, b), kante(x1, y0, b, x1, y1, c), kante(x1, y1, c, x0, y1, d), kante(x0, y1, d, x0, y0, a)].filter(Boolean);
        if (p.length === 2) seg.push(p[0][0], p[0][1], p[1][0], p[1][1]);
        else if (p.length === 4) {
          const m = F(A.x(x0 + zelle / 2), A.y(y0 + zelle / 2));
          if ((m < 0) === (a < 0)) { seg.push(p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]); }
          else { seg.push(p[0][0], p[0][1], p[3][0], p[3][1], p[1][0], p[1][1], p[2][0], p[2][1]); }
        }
      }
    }
    return seg;
  }

  /** Bereich, in dem eine Ungleichung gilt, als Rechtecke (zeilenweise zusammengefasst). */
  function ungleichungsFlaeche(F, op, A, zelle) {
    const gilt = (v) => (op === '<' ? v < 0 : op === '<=' ? v <= 0 : op === '>' ? v > 0 : v >= 0);
    const l = [];
    for (let py = 0; py < A.H; py += zelle) {
      const y = A.y(py + zelle / 2);
      let start = -1;
      for (let px = 0; px <= A.W; px += zelle) {
        const an = px < A.W && gilt(F(A.x(px + zelle / 2), y));
        if (an && start < 0) start = px;
        if (!an && start >= 0) { l.push(start, py, px - start, zelle); start = -1; }
      }
    }
    return l;
  }

  // ================================================================ Szene

  /**
   * szene: {W, H, ansicht, einst: {raster, achsen, pi}, th (thema), fein,
   *   graphen: [{art, d (Deutung), farbe, breite, strich, eintrag}], flaechen: [{f, g?, a, b, farbe}],
   *   ableitungen: [{f, farbe, strich}], geraden: [{m, b, farbe, strich}], marker: [{x, y, farbe, text, fest, leer}],
   *   punkteSammlungen: [{punkte: [[x,y]], farbe}], spur: {x, y, farbe, text}}
   */
  function zeichnen(stift, s) {
    const { W, H, th } = s;
    const A = abbildung(s.ansicht, W, H);
    const einst = s.einst || {};
    const zelle = s.fein ? 3 : 7;
    // Flächen von Ungleichungen zuerst (unter dem Raster sichtbar)
    for (const g of s.graphen) {
      if (g.d.art !== 'ungleichung') continue;
      const farbe = graphFarbe(g.farbe, th);
      if (g.d.richtung === 'y' || g.d.richtung === 'x') {
        const istY = g.d.richtung === 'y';
        const oben = g.d.op === '>' || g.d.op === '>=';
        const n = Math.ceil((istY ? W : H) / (s.fein ? 2 : 4));
        const l = [];
        for (let i = 0; i < n; i++) {
          const p = ((istY ? W : H) * i) / n, w = (istY ? W : H) / n + 0.6;
          const v = g.d.f(istY ? A.x(p + w / 2) : A.y(p + w / 2));
          if (g.d.bereich && istY) { const xx = A.x(p + w / 2); if (xx < g.d.bereich.min || xx > g.d.bereich.max) continue; }
          if (Number.isNaN(v)) continue;
          if (istY) {
            const py = Math.max(-1, Math.min(H + 1, A.Y(v)));
            if (oben) l.push(p, 0, w, py); else l.push(p, py, w, H - py);
          } else {
            const px = Math.max(-1, Math.min(W + 1, A.X(v)));
            if (oben) l.push(px, p, W - px, w); else l.push(0, p, px, w);
          }
        }
        stift.rechtecke(l, { farbe, alpha: th.dunkel ? 0.2 : 0.14 });
      } else {
        stift.rechtecke(ungleichungsFlaeche(g.d.f, g.d.op, A, zelle + 1), { farbe, alpha: th.dunkel ? 0.2 : 0.14 });
      }
    }
    // Integral- und Flächenstücke
    for (const fl of s.flaechen || []) {
      const farbe = graphFarbe(fl.farbe, th);
      const a = Math.max(Math.min(fl.a, fl.b), A.xmin - 1), b = Math.min(Math.max(fl.a, fl.b), A.xmax + 1);
      if (!(b > a)) continue;
      const n = Math.max(2, Math.ceil(((b - a) * A.sx) / 1.5));
      let oben = [], unten = [];
      const fertig = () => { if (oben.length > 1) stift.flaeche([...oben, ...unten.reverse()], { farbe, alpha: th.dunkel ? 0.3 : 0.22 }); oben = []; unten = []; };
      for (let i = 0; i <= n; i++) {
        const x = a + ((b - a) * i) / n;
        const y1 = fl.f(x), y2 = fl.g ? fl.g(x) : 0;
        if (!Number.isFinite(y1) || !Number.isFinite(y2)) { fertig(); continue; }
        const k = (v) => Math.max(-2 * H, Math.min(3 * H, A.Y(v)));
        oben.push([A.X(x), k(y1)]);
        unten.push([A.X(x), k(y2)]);
      }
      fertig();
    }
    raster(stift, A, einst, th);
    // Graphen
    for (const g of s.graphen) {
      const d = g.d;
      const farbe = graphFarbe(g.farbe, th);
      const st = { farbe, breite: g.breite || 2.4, strich: g.strich || 'voll' };
      if (d.art === 'funktion') stift.linien(funktionsPfade(d.f, A, d.bereich, s.fein), st);
      else if (d.art === 'senkrecht') stift.linien(senkrechtPfade(d.f, A, s.fein), st);
      else if (d.art === 'kurve') stift.linien(kurvenPfade(d.fx, d.fy, g.von, g.bis, A, s.fein ? 1600 : 500), st);
      else if (d.art === 'polar') stift.linien(kurvenPfade((t) => d.f(t) * Math.cos(t), (t) => d.f(t) * Math.sin(t), g.von, g.bis, A, s.fein ? 2000 : 600), st);
      else if (d.art === 'gleichung') stift.segmente(kontur(d.f, A, zelle), st);
      else if (d.art === 'ungleichung') {
        const rand = { ...st, breite: 1.8, strich: d.op === '<' || d.op === '>' ? 'gestrichelt' : 'voll' };
        if (d.richtung === 'y') stift.linien(funktionsPfade(d.f, A, d.bereich, s.fein), rand);
        else if (d.richtung === 'x') stift.linien(senkrechtPfade(d.f, A, s.fein), rand);
        else stift.segmente(kontur(d.f, A, zelle), rand);
      }
    }
    // Ableitungen (Überlagerung) und Geraden (Tangente, Normale)
    for (const o of s.ableitungen || []) stift.linien(funktionsPfade(o.f, A, null, s.fein), { farbe: graphFarbe(o.farbe, th), breite: 1.8, strich: o.strich || 'gestrichelt' });
    for (const o of s.geraden || []) {
      const f = (x) => o.m * x + o.b;
      stift.linien(funktionsPfade(f, A, null, false), { farbe: graphFarbe(o.farbe, th), breite: 1.7, strich: o.strich || 'voll' });
    }
    // Punktwolken (Messwerte)
    for (const p of s.punkteSammlungen || []) {
      const farbe = graphFarbe(p.farbe, th);
      for (const [x, y] of p.punkte) {
        const px = A.X(x), py = A.Y(y);
        if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
        stift.kreis(px, py, 3.8, { fuell: farbe, rand: th.grund, breite: 1.2 });
      }
    }
    // Punkte aus dem Blatt
    for (const g of s.graphen) {
      if (g.d.art !== 'punkt') continue;
      const px = A.X(g.d.x), py = A.Y(g.d.y);
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
      const farbe = graphFarbe(g.farbe, th);
      stift.kreis(px, py, g.gezogen ? 7 : 5, { fuell: farbe, rand: th.grund, breite: 2 });
      if (einst.beschriftung !== false) {
        const t = (g.d.name ? g.d.name : '') + `(${Mathe.zahlKurz(g.d.x, 3)} | ${Mathe.zahlKurz(g.d.y, 3)})`;
        stift.text(px + 9, py - 9, t, { farbe, groesse: 12.5, gewicht: 650, halo: th.grund });
      }
    }
    // Funktionsnamen an den Graphen
    if (einst.beschriftung !== false) {
      // Namen dorthin, wo der Graph gut sichtbar ist – nicht auf andere Namen oder Markierungen
      const belegt = (s.marker || []).map((m) => [A.X(m.x), A.Y(m.y)]);
      for (const g of s.graphen) if (g.d.art === 'punkt') belegt.push([A.X(g.d.x), A.Y(g.d.y)]);
      for (const g of s.graphen) {
        if (g.d.art !== 'funktion' || !g.d.name) continue;
        const name = g.d.name + '(x)';
        for (const anteil of [0.86, 0.72, 0.58, 0.44, 0.3, 0.16, 0.06]) {
          const px = A.W * anteil;
          const x = A.x(px), y = g.d.f(x);
          if (g.d.bereich && (x < g.d.bereich.min || x > g.d.bereich.max)) continue;
          const py = A.Y(y);
          if (!Number.isFinite(py) || py < 30 || py > H - 30) continue;
          if (belegt.some(([bx, by]) => Math.abs(bx - (px + 18)) < 44 && Math.abs(by - (py - 8)) < 22)) continue;
          stift.text(px + 6, py - 8, name, { farbe: graphFarbe(g.farbe, th), groesse: 13, gewicht: 700, halo: th.grund });
          belegt.push([px + 18, py - 8]);
          break;
        }
      }
    }
    // Markierungen (besondere Punkte)
    for (const m of s.marker || []) {
      const px = A.X(m.x), py = A.Y(m.y);
      if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
      const farbe = graphFarbe(m.farbe, th);
      stift.kreis(px, py, m.hervor ? 5.5 : 4.2, { fuell: m.leer ? th.grund : farbe, rand: m.leer ? farbe : th.grund, breite: m.leer ? 2 : 1.5 });
      if (m.fest || m.hervor) stift.etikett(px, py, m.text, { farbe, grund: th.grund, textFarbe: th.text, W });
    }
    // Spur unter dem Zeiger
    if (s.spur) {
      const px = A.X(s.spur.x), py = A.Y(s.spur.y);
      const farbe = graphFarbe(s.spur.farbe, th);
      stift.kreis(px, py, 5, { fuell: farbe, rand: th.grund, breite: 2 });
      stift.etikett(px, py, s.spur.text, { farbe, grund: th.grund, textFarbe: th.text, W });
    }
    return A;
  }

  function raster(stift, A, einst, th) {
    const { W, H } = A;
    const sx = einst.pi ? piSchritt(A.sx) : schritt(A.sx), sy = schritt(A.sy);
    const linienX = (st, ausser) => {
      const l = [];
      for (let k = Math.ceil(A.xmin / st); k <= Math.floor(A.xmax / st); k++) {
        if (ausser && Math.abs(((k * st) / ausser) - Math.round((k * st) / ausser)) < 1e-6) continue;
        const px = Math.round(A.X(k * st)) + 0.5;
        l.push(px, 0, px, H);
      }
      return l;
    };
    const linienY = (st, ausser) => {
      const l = [];
      for (let k = Math.ceil(A.ymin / st); k <= Math.floor(A.ymax / st); k++) {
        if (ausser && Math.abs(((k * st) / ausser) - Math.round((k * st) / ausser)) < 1e-6) continue;
        const py = Math.round(A.Y(k * st)) + 0.5;
        l.push(0, py, W, py);
      }
      return l;
    };
    if (einst.raster !== false) {
      stift.segmente([...linienX(sx.fein, sx.gross), ...linienY(sy.fein, sy.gross)], { farbe: th.rasterFein, breite: 1 });
      stift.segmente([...linienX(sx.gross), ...linienY(sy.gross)], { farbe: th.raster, breite: 1 });
    }
    if (einst.achsen === false) return;
    const ox = A.X(0), oy = A.Y(0);
    const achsePx = Math.round(Math.max(0, Math.min(W, ox))) + 0.5, achsePy = Math.round(Math.max(0, Math.min(H, oy))) + 0.5;
    const xSichtbar = oy >= 0 && oy <= H, ySichtbar = ox >= 0 && ox <= W;
    const achse = { farbe: th.achse, breite: 1.4 };
    const l = [];
    if (xSichtbar) l.push(0, achsePy, W, achsePy);
    if (ySichtbar) l.push(achsePx, 0, achsePx, H);
    stift.segmente(l, achse);
    // Pfeilspitzen
    if (xSichtbar) stift.linien([[[W - 9, achsePy - 4.5], [W - 2, achsePy], [W - 9, achsePy + 4.5]]], achse);
    if (ySichtbar) stift.linien([[[achsePx - 4.5, 9], [achsePx, 2], [achsePx + 4.5, 9]]], achse);
    const st = { farbe: th.leise, groesse: 11.5, gewicht: 500, halo: th.grund };
    // Beschriftung x (klebt am Rand, wenn die Achse außerhalb liegt)
    const yText = Math.max(4, Math.min(H - 16, achsePy + 5));
    for (let k = Math.ceil(A.xmin / sx.gross); k <= Math.floor(A.xmax / sx.gross); k++) {
      if (k === 0) continue;
      const px = A.X(k * sx.gross);
      if (px < 14 || px > W - 16) continue;
      const t = sx.pi ? piText(k, sx.pi) : zahlText(k * sx.gross, sx.gross);
      stift.text(px, yText, t, { ...st, ausrichtung: 'center', grundlinie: 'top' });
    }
    const xText = Math.max(6 + 0, Math.min(W - 6, achsePx - 6));
    const rechtsBuendig = achsePx - 6 > 30;
    for (let k = Math.ceil(A.ymin / sy.gross); k <= Math.floor(A.ymax / sy.gross); k++) {
      if (k === 0) continue;
      const py = A.Y(k * sy.gross);
      if (py < 12 || py > H - 12) continue;
      stift.text(rechtsBuendig ? xText : achsePx + 6, py, zahlText(k * sy.gross, sy.gross), { ...st, ausrichtung: rechtsBuendig ? 'right' : 'left', grundlinie: 'middle' });
    }
    if (xSichtbar && ySichtbar) stift.text(achsePx - 5, achsePy + 5, '0', { ...st, ausrichtung: 'right', grundlinie: 'top' });
    const name = { farbe: th.text, groesse: 13, gewicht: 650, halo: th.grund };
    if (xSichtbar) stift.text(W - 8, achsePy - 9, 'x', { ...name, ausrichtung: 'right' });
    if (ySichtbar) stift.text(achsePx + 9, 14, 'y', { ...name, ausrichtung: 'left' });
  }

  return { FARBEN, SCHRIFT, thema, graphFarbe, mischen, abbildung, schritt, canvasStift, svgStift, zeichnen, funktionsPfade };
})();
