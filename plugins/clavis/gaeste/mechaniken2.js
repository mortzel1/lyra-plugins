'use strict';
/*
 * Clavis – Rätsel zum Anfassen (ohne Wissen): Zeichen im Raum suchen, Lichtstrahl lenken, im richtigen Moment drücken,
 * Veränderungen entdecken, Klopfzeichen nachklopfen, eine Waage ins Gleichgewicht bringen.
 * Dazu: jede Mechanik bekommt eine Art (wissen, entschluesseln, logik, geschick, beobachten, hoeren, erkunden, gedaechtnis),
 * damit ein Raum abwechslungsreich wird und nicht nur aus Wissensfragen besteht.
 */
(() => {
  const { el } = Clavis;
  const M = Clavis.MECHANIKEN;
  const S = (stufe) => ({ leicht: 0, mittel: 1, schwer: 2, experte: 3 }[stufe] ?? 1);
  const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // ---------------------------------------------------------------- Versteckte Zeichen (im Raum suchen)
  const ZEICHEN = ['☾', '✦', '▲', '◆', '✚', '●', '■', '♣', '♠', '♥', '☀', '✿'];
  M.raumcode = {
    name: 'Versteckte Zeichen', kurz: 'Ein Schloss mit Zeichen statt Zahlen. Die Ziffern zu den Zeichen sind überall im Raum versteckt – umsehen, suchen, finden.', stoff: false, felder: [], art: 'erkunden',
    bauen(inh, stufe, r) {
      const n = [3, 4, 4, 5][S(stufe)];
      const z = r.mischen(ZEICHEN).slice(0, n);
      const ziffern = z.map(() => r.zahl(0, 9));
      const spuren = r.mischen(z.map((x, i) => ({ z: x, d: ziffern[i] })));
      return { p: { zeichen: z, spuren }, loesung: ziffern.join(''), hilfen: ['Die Zeichen schimmern ganz schwach – an der Wand, am Boden, an den Rändern des Raums. Sieh dich gründlich um.', `Ein Zeichen verrate ich: ${z[0]} = ${ziffern[0]}.`, `Die ersten Ziffern: ${ziffern.slice(0, Math.ceil(n / 2)).join(' ')} …`] };
    },
    ansicht(p, api) {
      const funde = new Set(api.funde || []);
      const werte = p.zeichen.map(() => 0);
      const anzeigen = [];
      const drehen = (i, d) => { werte[i] = (werte[i] + d + 10) % 10; anzeigen[i].textContent = String(werte[i]); api.ton('rad'); };
      const bekannt = new Map(p.spuren.filter((_, i) => funde.has(i)).map((s) => [s.z, s.d]));
      return el('div', { class: 'cl-mech raumcode' },
        el('div', { class: 'cl-raumcode-funde' },
          el('b', {}, `Gefunden: ${bekannt.size} von ${p.zeichen.length}`),
          el('div', { class: 'cl-raumcode-liste' }, p.zeichen.map((z) => el('span', { class: 'cl-raumcode-fund' + (bekannt.has(z) ? ' ja' : '') }, el('i', {}, z), bekannt.has(z) ? ` = ${bekannt.get(z)}` : ' = ?'))),
          bekannt.size < p.zeichen.length ? el('div', { class: 'cl-leise klein' }, 'Tritt zurück und sieh dich um: Die Zeichen schimmern schwach an Wänden und Boden.') : null),
        el('div', { class: 'cl-rollen' }, p.zeichen.map((z, i) => {
          const a = el('div', { class: 'cl-rolle-wert' }, '0');
          anzeigen.push(a);
          const rolle = el('div', { class: 'cl-rolle' }, el('div', { class: 'cl-rolle-zeichen' }, z),
            el('button', { class: 'cl-rolle-knopf', type: 'button', onclick: () => drehen(i, 1) }, '▲'), el('div', { class: 'cl-rolle-fenster' }, a), el('button', { class: 'cl-rolle-knopf', type: 'button', onclick: () => drehen(i, -1) }, '▼'));
          rolle.addEventListener('wheel', (e) => { e.preventDefault(); drehen(i, e.deltaY > 0 ? -1 : 1); }, { passive: false });
          return rolle;
        })),
        el('button', { class: 'cl-knopf', type: 'button', onclick: () => api.loesen(werte.join('')) }, 'Öffnen'));
    },
    pruefen: (p, l, a) => String(a) === l,
  };

  // ---------------------------------------------------------------- Lichtstrahl (Spiegel drehen)
  const RICHTUNG = { o: [0, 1], w: [0, -1], n: [-1, 0], s: [1, 0] };
  const ABLENKEN = { '/': { o: 'n', n: 'o', s: 'w', w: 's' }, '\\': { o: 's', s: 'o', n: 'w', w: 'n' } };
  function strahl(n, quelle, spiegel) {
    const karte = new Map(spiegel.map((s) => [s.i, s.t]));
    let zeile = quelle; let spalte = 0; let dir = 'o';
    const weg = [[zeile, -0.5]];
    for (let schritt = 0; schritt < 200; schritt++) {
      if (zeile < 0 || zeile >= n || spalte < 0 || spalte >= n) break;
      weg.push([zeile, spalte]);
      const t = karte.get(zeile * n + spalte);
      if (t) dir = ABLENKEN[t][dir];
      zeile += RICHTUNG[dir][0];
      spalte += RICHTUNG[dir][1];
    }
    weg.push([zeile, spalte]);
    return { weg, raus: { zeile, spalte, dir } };
  }
  M.spiegel = {
    name: 'Lichtstrahl', kurz: 'Spiegel drehen, bis der Lichtstrahl den Kristall trifft.', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const n = [4, 5, 6, 6][s];
      for (let versuch = 0; versuch < 60; versuch++) {
        const paare = [1, 2, 2, 3][s];
        const spalten = r.mischen(Array.from({ length: n - 1 }, (_, i) => i)).slice(0, paare).sort((a, b) => a - b);
        let zeile = r.zahl(0, n - 1);
        const quelle = zeile;
        const spiegel = [];
        let ok = true;
        for (const c of spalten) {
          let neu = r.zahl(0, n - 1);
          let x = 0;
          while (neu === zeile && x++ < 10) neu = r.zahl(0, n - 1);
          if (neu === zeile) { ok = false; break; }
          const t = neu < zeile ? '/' : '\\';
          spiegel.push({ i: zeile * n + c, t }, { i: neu * n + c, t });
          zeile = neu;
        }
        if (!ok) continue;
        const ziel = zeile;
        const belegt = new Set(spiegel.map((x) => x.i));
        // Ablenker
        for (let d = 0; d < [1, 2, 3, 4][s]; d++) {
          const i = r.zahl(0, n * n - 1);
          if (!belegt.has(i)) { belegt.add(i); spiegel.push({ i, t: r() < 0.5 ? '/' : '\\' }); }
        }
        const loesung = spiegel.map((x) => x.t);
        const start = spiegel.map((x) => ({ i: x.i, t: r() < 0.5 ? '/' : '\\' }));
        const probe = strahl(n, quelle, spiegel);
        if (!(probe.raus.dir === 'o' && probe.raus.spalte === n && probe.raus.zeile === ziel)) continue;
        const schon = strahl(n, quelle, start);
        if (schon.raus.dir === 'o' && schon.raus.spalte === n && schon.raus.zeile === ziel) start[0].t = start[0].t === '/' ? '\\' : '/';
        return { p: { n, quelle, ziel, spiegel: start }, loesung, hilfen: ['Tippe einen Spiegel an, um ihn zu drehen. Folge dem Strahl Feld für Feld.', 'Nicht jeder Spiegel liegt auf dem Weg – manche lenken nur ab.', `Der Strahl knickt zum ersten Mal in Spalte ${(spiegel[0].i % n) + 1} ab.`] };
      }
      return null;
    },
    ansicht(p, api) {
      const n = p.n;
      const spiegel = p.spiegel.map((x) => ({ ...x }));
      const feld = el('div', { class: 'cl-spiegel-feld', style: { '--n': n } });
      const strahlSvg = el('svg', { viewBox: `-1 0 ${n + 2} ${n}`, class: 'cl-spiegel-strahl', preserveAspectRatio: 'none', style: { left: `${-100 / n}%`, width: `${((n + 2) / n) * 100}%` } });
      let fertig = false;
      const malen = () => {
        feld.querySelectorAll('.cl-spiegel-zelle').forEach((z, i) => {
          const s = spiegel.find((x) => x.i === i);
          z.dataset.t = s ? (s.t === '/' ? 'a' : 'b') : '';
        });
        const { weg, raus } = strahl(n, p.quelle, spiegel);
        const punkte = weg.map(([zeile, spalte]) => `${spalte + 0.5},${zeile + 0.5}`).join(' ');
        const treffer = raus.dir === 'o' && raus.spalte === n && raus.zeile === p.ziel;
        strahlSvg.innerHTML = `<polyline points="${punkte}" class="glut"/><polyline points="${punkte}" class="kern"/>`;
        feld.classList.toggle('treffer', treffer);
        if (treffer && !fertig) { fertig = true; api.ton('strahl'); setTimeout(async () => { const r = await api.loesen(spiegel.map((x) => x.t)); if (!r.richtig) fertig = false; }, 500); }
      };
      for (let i = 0; i < n * n; i++) {
        const z = el('button', { class: 'cl-spiegel-zelle', type: 'button', onclick: () => {
          const s = spiegel.find((x) => x.i === i);
          if (!s || fertig) return;
          s.t = s.t === '/' ? '\\' : '/';
          api.ton('einrasten');
          malen();
        } });
        feld.append(z);
      }
      const rahmen = el('div', { class: 'cl-spiegel-rahmen' },
        el('div', { class: 'cl-spiegel-quelle', style: { top: `${((p.quelle + 0.5) / n) * 100}%` } }),
        el('div', { class: 'cl-spiegel-ziel', style: { top: `${((p.ziel + 0.5) / n) * 100}%` } }),
        feld, strahlSvg);
      setTimeout(malen, 0);
      return el('div', { class: 'cl-mech spiegel' }, el('div', { class: 'cl-leise klein' }, 'Tippe die Spiegel an, um sie zu drehen. Der Strahl muss den Kristall rechts treffen.'), rahmen);
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length !== p.spiegel.length || a.some((t) => t !== '/' && t !== '\\')) return false;
      const { raus } = strahl(p.n, p.quelle, p.spiegel.map((x, i) => ({ i: x.i, t: a[i] })));
      return raus.dir === 'o' && raus.spalte === p.n && raus.zeile === p.ziel;
    },
  };

  // ---------------------------------------------------------------- Im richtigen Moment (Geschick)
  M.timing = {
    name: 'Im richtigen Moment', kurz: 'Ein Zeiger pendelt hin und her – im richtigen Moment drücken, mehrmals hintereinander (Dietrich, Sicherung, Kurbel …).', stoff: false, felder: [], art: 'geschick',
    bauen(inh, stufe) {
      const s = S(stufe);
      return { p: { treffer: [3, 3, 4, 5][s], breite: [0.24, 0.17, 0.13, 0.1][s], tempo: [0.9, 1.15, 1.4, 1.7][s] }, loesung: 'KLICK', hilfen: ['Drück nicht, wenn der Zeiger hineinläuft – sondern wenn er mitten drin ist.', 'Du kannst auch die Leertaste drücken.', 'Atme ruhig, schau nur auf das grüne Feld und zähle den Rhythmus mit.'] };
    },
    ansicht(p, api) {
      let pos = 0; let richtung = 1; let zone = 0.5; let geschafft = 0; let gesperrt = false; let fertig = false; let t0 = performance.now();
      const zeiger = el('div', { class: 'cl-timing-zeiger' });
      const feld = el('div', { class: 'cl-timing-zone' });
      const balken = el('div', { class: 'cl-timing-balken' }, feld, zeiger);
      const punkte = el('div', { class: 'cl-timing-punkte' });
      const malenPunkte = () => punkte.replaceChildren(...Array.from({ length: p.treffer }, (_, i) => el('span', { class: i < geschafft ? 'voll' : '' })));
      const neueZone = () => { zone = p.breite / 2 + Math.random() * (1 - p.breite); feld.style.left = `${(zone - p.breite / 2) * 100}%`; feld.style.width = `${p.breite * 100}%`; };
      const schleife = (t) => {
        if (!balken.isConnected) { document.removeEventListener('keydown', taste); return; }
        const dt = Math.min(0.05, (t - t0) / 1000); t0 = t;
        pos += richtung * dt * p.tempo * (1 + geschafft * 0.12);
        if (pos > 1) { pos = 1; richtung = -1; } if (pos < 0) { pos = 0; richtung = 1; }
        zeiger.style.left = `${pos * 100}%`;
        requestAnimationFrame(schleife);
      };
      const druecken = async () => {
        if (gesperrt || fertig) return;
        if (Math.abs(pos - zone) <= p.breite / 2) {
          geschafft++;
          api.ton('einrasten');
          balken.classList.remove('daneben'); balken.classList.add('getroffen'); setTimeout(() => balken.classList.remove('getroffen'), 300);
          malenPunkte();
          if (geschafft >= p.treffer) { fertig = true; const r = await api.loesen('KLICK'); if (!r.richtig) { fertig = false; geschafft = 0; malenPunkte(); } return; }
          neueZone();
        } else {
          api.ton('falsch');
          geschafft = Math.max(0, geschafft - 1);
          malenPunkte();
          balken.classList.add('daneben'); gesperrt = true;
          setTimeout(() => { gesperrt = false; balken.classList.remove('daneben'); }, 700);
        }
      };
      const taste = (e) => { if (e.code === 'Space' && balken.isConnected && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); druecken(); } };
      document.addEventListener('keydown', taste);
      neueZone(); malenPunkte(); requestAnimationFrame(schleife);
      return el('div', { class: 'cl-mech timing' }, el('div', { class: 'cl-leise klein' }, `Drück, wenn der Zeiger im hellen Feld ist – ${p.treffer}-mal. Daneben kostet einen Treffer.`), balken, punkte,
        el('button', { class: 'cl-knopf gross', type: 'button', onclick: druecken }, 'Jetzt!'));
    },
    pruefen: (p, l, a) => a === l,
  };

  // ---------------------------------------------------------------- Was hat sich verändert? (Beobachten)
  M.veraendert = {
    name: 'Was hat sich verändert?', kurz: 'Gegenstände kurz einprägen – dann ist etwas anders. Was?', stoff: false, felder: [], art: 'beobachten',
    bauen(inh, stufe, r, kontext) {
      const s = S(stufe);
      const n = [6, 8, 9, 12][s];
      const k = [1, 2, 2, 3][s];
      const welt = Clavis.WELTEN[(kontext && kontext.welt) || 'akademie'] || Clavis.WELTEN.akademie;
      const vorrat = r.mischen([...new Set(welt.objekte.concat(Object.keys(Clavis.ICONS)))].filter((x) => Clavis.ICONS[x] && x !== 'ausgang'));
      const vorher = vorrat.slice(0, n);
      const ersatz = vorrat.slice(n);
      const nachher = vorher.slice();
      const stellen = r.mischen(vorher.map((_, i) => i)).slice(0, k).sort((a, b) => a - b);
      stellen.forEach((i, j) => { nachher[i] = ersatz[j]; });
      return { p: { vorher, nachher, k, sekunden: [9, 8, 7, 6][s] }, loesung: stellen, hilfen: ['Präg dir die Gegenstände Reihe für Reihe ein – nicht alles auf einmal.', `${k > 1 ? 'Eine' : 'Die'} Veränderung ist in Reihe ${Math.floor(stellen[0] / (n > 8 ? 4 : 3)) + 1}.`, `Schau auf den Platz Nummer ${stellen[0] + 1}.`] };
    },
    ansicht(p, api) {
      const wahl = new Set();
      const spalten = p.vorher.length > 8 ? 4 : 3;
      const raster = el('div', { class: 'cl-veraendert-raster', style: { gridTemplateColumns: `repeat(${spalten}, 1fr)` } });
      const leiste = el('div', { class: 'cl-veraendert-zeit' }, el('i'));
      const text = el('div', { class: 'cl-leise klein' });
      const knoepfe = el('div', { class: 'cl-zeile' });
      let takt = null;
      const zeigen = (liste, waehlbar) => raster.replaceChildren(...liste.map((icon, i) => el('button', { class: 'cl-veraendert-fach' + (wahl.has(i) ? ' gewaehlt' : ''), type: 'button', disabled: !waehlbar, onclick: () => {
        if (wahl.has(i)) wahl.delete(i); else if (wahl.size < p.k) wahl.add(i);
        api.ton('klick');
        zeigen(liste, true);
        pruefKnopf.disabled = wahl.size !== p.k;
      } }, Clavis.icon(icon))));
      const pruefKnopf = el('button', { class: 'cl-knopf', type: 'button', disabled: true, onclick: async () => {
        const r = await api.loesen([...wahl].sort((a, b) => a - b));
        if (!r.richtig) { wahl.clear(); pruefKnopf.disabled = true; zeigen(p.nachher, true); }
      } }, p.k > 1 ? 'Das hat sich verändert' : 'Das ist anders');
      const nochmal = el('button', { class: 'cl-knopf zart', type: 'button', onclick: () => einpraegen(Math.max(3, p.sekunden - 3)) }, 'Nochmal ansehen');
      const umschalten = () => {
        clearInterval(takt);
        raster.classList.add('vorhang');
        api.ton('whoosh');
        setTimeout(() => {
          if (!raster.isConnected) return;
          raster.classList.remove('vorhang');
          zeigen(p.nachher, true);
          leiste.classList.add('weg');
          text.textContent = p.k > 1 ? `${p.k} Dinge sind anders. Tippe sie an.` : 'Eine Sache ist anders. Tippe sie an.';
          knoepfe.replaceChildren(pruefKnopf, nochmal);
        }, 900);
      };
      function einpraegen(sek) {
        wahl.clear(); pruefKnopf.disabled = true;
        zeigen(p.vorher, false);
        text.textContent = 'Präg dir alles gut ein …';
        leiste.classList.remove('weg');
        const ende = Date.now() + sek * 1000;
        const i = leiste.firstChild;
        clearInterval(takt);
        takt = setInterval(() => { if (!raster.isConnected) return clearInterval(takt); const rest = (ende - Date.now()) / (sek * 1000); i.style.width = `${Math.max(0, rest) * 100}%`; if (rest <= 0) umschalten(); }, 80);
        knoepfe.replaceChildren(el('button', { class: 'cl-knopf zart', type: 'button', onclick: umschalten }, 'Ich hab’s mir gemerkt'));
      }
      const start = el('button', { class: 'cl-knopf gross', type: 'button', onclick: () => einpraegen(p.sekunden) }, 'Hinsehen');
      raster.append(...p.vorher.map(() => el('div', { class: 'cl-veraendert-fach zu' })));
      text.textContent = `Gleich siehst du ${p.vorher.length} Dinge – für ${p.sekunden} Sekunden.`;
      knoepfe.append(start);
      return el('div', { class: 'cl-mech veraendert' }, text, leiste, raster, knoepfe);
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a)) return false;
      const n = a.filter((x) => l.includes(x)).length;
      return n === l.length && a.length === l.length ? true : { richtig: false, info: l.length > 1 ? `${n} von ${l.length} richtig.` : 'Das war es nicht.' };
    },
  };

  // ---------------------------------------------------------------- Klopfzeichen (Hören)
  M.klopfzeichen = {
    name: 'Klopfzeichen', kurz: 'Hinter der Wand klopft jemand – hör genau hin und klopf den Rhythmus zurück.', stoff: false, felder: [], art: 'hoeren',
    bauen(inh, stufe, r) {
      const n = [3, 4, 5, 6][S(stufe)];
      let muster = '';
      while (muster.length < n || !/k/.test(muster) || !/l/.test(muster)) { muster = Array.from({ length: n }, () => (r() < 0.5 ? 'k' : 'l')).join(''); }
      return { p: { laenge: n + 1, muster }, loesung: muster, hilfen: ['Achte auf die Pausen: kurz oder lang?', `Es sind ${n + 1} Klopfer.`, `Die Pausen: ${muster.split('').map((x) => (x === 'k' ? 'kurz' : 'lang')).slice(0, Math.ceil(n / 2) + 1).join(', ')} …`] };
    },
    ansicht(p, api) {
      const zeiten = [];
      let warte = null;
      const punkte = el('div', { class: 'cl-melodie-punkte' });
      const malenPunkte = () => punkte.replaceChildren(...Array.from({ length: p.laenge }, (_, i) => el('span', { class: 'cl-mp' + (i < zeiten.length ? ' voll' : '') })));
      const wand = el('button', { class: 'cl-klopf-wand', type: 'button' }, el('span', {}, 'Hier klopfen'));
      const welle = () => { const w = el('i', { class: 'cl-klopf-welle' }); wand.append(w); setTimeout(() => w.remove(), 700); };
      const auswerten = async () => {
        if (zeiten.length < 2) { zeiten.length = 0; malenPunkte(); return; }
        const luecken = zeiten.slice(1).map((t, i) => t - zeiten[i]);
        const min = Math.min(...luecken); const max = Math.max(...luecken);
        const grenze = max > min * 1.5 ? (min + max) / 2 : 520;
        const muster = luecken.map((x) => (x > grenze ? 'l' : 'k')).join('');
        zeiten.length = 0;
        const r = await api.loesen(muster);
        malenPunkte();
        if (!r.richtig) { wand.classList.add('falsch'); setTimeout(() => wand.classList.remove('falsch'), 500); }
      };
      wand.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (zeiten.length >= p.laenge) return;
        zeiten.push(performance.now());
        api.ton('klopf');
        welle();
        malenPunkte();
        clearTimeout(warte);
        if (zeiten.length >= p.laenge) warte = setTimeout(auswerten, 250);
        else warte = setTimeout(auswerten, 2200);
      });
      const anhoeren = el('button', { class: 'cl-knopf zart', type: 'button', onclick: () => {
        zeiten.length = 0; malenPunkte();
        let t = 300;
        const schlagen = () => { Clavis.klang.spielen('klopf'); wand.classList.add('von-innen'); welle(); setTimeout(() => wand.classList.remove('von-innen'), 160); };
        setTimeout(schlagen, t);
        for (const x of p.muster) { t += x === 'k' ? 320 : 780; setTimeout(schlagen, t); }
      } }, '👂 Anhören');
      malenPunkte();
      return el('div', { class: 'cl-mech klopfzeichen' }, el('div', { class: 'cl-leise klein' }, 'Hör dir die Klopfzeichen an – dann klopf sie genauso zurück (kurze und lange Pausen).'), anhoeren, wand, punkte);
    },
    pruefen: (p, l, a) => typeof a === 'string' && a === l,
  };

  // ---------------------------------------------------------------- Waage (Logik)
  M.waage = {
    name: 'Waage', kurz: 'Eine alte Waage: Gewichte auf die Schalen legen, bis sie genau im Gleichgewicht ist.', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      let gewichte; let rechts; let links; let last = 0;
      for (let v = 0; v < 30 && last <= 0; v++) {
        gewichte = r.mischen([1, 2, 3, 4, 5, 7, 8, 9, 11, 13]).slice(0, [4, 5, 6, 7][s]).sort((a, b) => a - b);
        rechts = r.mischen(gewichte).slice(0, [2, 2, 3, 3][s]);
        links = s >= 2 ? r.mischen(gewichte.filter((g) => !rechts.includes(g))).slice(0, 1) : [];
        last = rechts.reduce((a, b) => a + b, 0) - links.reduce((a, b) => a + b, 0);
      }
      if (last <= 0) return null;
      return { p: { last, gewichte }, loesung: null, hilfen: ['Ein Gewicht kannst du auch auf die linke Seite zur Last legen – dann zählt es dort mit.', `Rechts muss genau so viel liegen wie links (${last}${links.length ? ' plus, was du links dazulegst' : ''}).`, `Zum Beispiel rechts: ${rechts.join(' + ')}${links.length ? `, links dazu: ${links.join(' + ')}` : ''}.`] };
    },
    ansicht(p, api) {
      const lage = p.gewichte.map(() => 0); // 0 weg, 1 rechts, -1 links
      const balken = el('div', { class: 'cl-waage-balken' });
      const schaleL = el('div', { class: 'cl-waage-schale links' });
      const schaleR = el('div', { class: 'cl-waage-schale rechts' });
      const vorrat = el('div', { class: 'cl-waage-vorrat' });
      const stein = (g, i) => el('button', { class: 'cl-waage-gewicht', type: 'button', style: { '--g': Math.sqrt(g) }, onclick: () => { lage[i] = lage[i] === 0 ? 1 : lage[i] === 1 ? -1 : 0; api.ton('klick'); malen(); } }, String(g));
      let fertig = false;
      const malen = () => {
        const l = p.last + p.gewichte.reduce((a, g, i) => a + (lage[i] === -1 ? g : 0), 0);
        const rr = p.gewichte.reduce((a, g, i) => a + (lage[i] === 1 ? g : 0), 0);
        const neig = Math.max(-14, Math.min(14, (rr - l) * 2.2));
        balken.style.setProperty('--neig', `${neig}deg`);
        const hub = Math.sin((neig * Math.PI) / 180) * 150;
        schaleL.style.transform = `translateY(${(-hub).toFixed(1)}px)`;
        schaleR.style.transform = `translateY(${hub.toFixed(1)}px)`;
        schaleL.replaceChildren(el('div', { class: 'cl-waage-last' }, String(p.last)), ...p.gewichte.map((g, i) => (lage[i] === -1 ? stein(g, i) : null)).filter(Boolean));
        schaleR.replaceChildren(...p.gewichte.map((g, i) => (lage[i] === 1 ? stein(g, i) : null)).filter(Boolean));
        vorrat.replaceChildren(...p.gewichte.map((g, i) => (lage[i] === 0 ? stein(g, i) : null)).filter(Boolean));
        balken.classList.toggle('gleich', l === rr && rr > 0);
        if (l === rr && rr > 0 && !fertig) { fertig = true; setTimeout(async () => { const r = await api.loesen(lage.slice()); if (!r.richtig) fertig = false; }, 700); }
      };
      malen();
      return el('div', { class: 'cl-mech waage' }, el('div', { class: 'cl-leise klein' }, 'Tippe ein Gewicht: erst rechts auf die Schale, nochmal: links zur Last, nochmal: zurück.'),
        el('div', { class: 'cl-waage' }, el('div', { class: 'cl-waage-saeule' }), el('div', { class: 'cl-waage-arm', style: {} }, balken, schaleL, schaleR)), vorrat);
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length !== p.gewichte.length || a.some((x) => x !== 0 && x !== 1 && x !== -1)) return false;
      const links = p.last + p.gewichte.reduce((s, g, i) => s + (a[i] === -1 ? g : 0), 0);
      const rechts = p.gewichte.reduce((s, g, i) => s + (a[i] === 1 ? g : 0), 0);
      return links === rechts && rechts > 0;
    },
  };

  // ---------------------------------------------------------------- Fehlendes Teil (finden, mitnehmen, benutzen)
  const TEILE = {
    krimi: [['🗝', 'Kleiner Schlüssel'], ['🔍', 'Lupe']], labor: [['🔋', 'Energiezelle'], ['🧪', 'Reagenzglas']], grab: [['💎', 'Skarabäus-Stein'], ['🪔', 'Öllampe']],
    station: [['🔌', 'Sicherung'], ['💾', 'Datenchip']], spuk: [['🕯', 'Kerze'], ['🗝', 'Rostiger Schlüssel']], bibliothek: [['📕', 'Fehlender Band'], ['🔍', 'Lupe']],
    pirat: [['🧭', 'Kompassnadel'], ['🗝', 'Truhenschlüssel']], akademie: [['🔑', 'Generalschlüssel'], ['💾', 'USB-Stick']], zirkus: [['🪄', 'Zauberstab'], ['🎩', 'Zylinder']],
    dschungel: [['💎', 'Jadeauge'], ['🪨', 'Steinscheibe']], unterwasser: [['⚙️', 'Zahnrad'], ['🔋', 'Batterie']], spielzeug: [['🔑', 'Aufziehschlüssel'], ['🧸', 'Teddyknopf']],
    western: [['⭐', 'Sheriffstern'], ['🧲', 'Hufeisenmagnet']], sanatorium: [['🗝', 'Zellenschlüssel'], ['🔦', 'Taschenlampe']],
  };
  M.fehlteil = {
    name: 'Fehlendes Teil', kurz: 'Hier fehlt etwas (ein Schlüssel, eine Sicherung, ein Zahnrad …). Es ist im Raum versteckt – finden, mitnehmen, einsetzen.', stoff: false, felder: [], art: 'erkunden',
    bauen(inh, stufe, r, kontext) {
      const [zeichen, name] = r.wahl(TEILE[(kontext && kontext.welt)] || TEILE.akademie);
      return { p: { zeichen, name, teil: `${zeichen}${name}` }, loesung: 'TEIL', hilfen: [`Du suchst: ${zeichen} ${name}. Es ist in diesem Raum – vielleicht hinter oder unter etwas.`, 'Klick auch auf die Dinge, die kein Rätsel sind – manche verstecken etwas.', 'Schau an die Ränder des Raums – ganz links und ganz rechts.'] };
    },
    ansicht(p, api) {
      const hat = (api.inventar || []).includes(p.teil);
      return el('div', { class: 'cl-mech fehlteil' },
        el('div', { class: 'cl-fehlteil-loch' + (hat ? ' bereit' : '') }, el('span', {}, p.zeichen)),
        hat ? el('button', { class: 'cl-knopf gross', type: 'button', onclick: async (e) => { e.target.disabled = true; const loch = e.target.parentElement.querySelector('.cl-fehlteil-loch'); loch.classList.add('einsetzen'); api.ton('einrasten'); setTimeout(async () => { const r = await api.loesen('TEIL'); if (!r.richtig) e.target.disabled = false; }, 650); } }, `Einsetzen: ${p.zeichen} ${p.name}`)
          : el('div', { class: 'cl-fehlteil-text' }, el('b', {}, `Hier fehlt etwas: ${p.zeichen} ${p.name}`), el('span', { class: 'cl-leise' }, 'Irgendwo in diesem Raum ist es versteckt. Tritt zurück und durchsuch alles – auch hinter und unter den Dingen.')));
    },
    pruefen: (p, l, a) => a === l,
  };

  // ---------------------------------------------------------------- Arten: damit nicht alles Wissen ist
  const ARTEN = {
    wissen: ['wissen', 'luecke', 'verhoer', 'terminal', 'kabel', 'reihenfolge', 'zahlenschloss', 'wortschloss', 'tresor', 'uhr', 'binaer'],
    entschluesseln: ['caesar', 'morse', 'runen', 'taschenlampe', 'geheimtinte', 'anagramm'],
    logik: ['akte', 'farbcode', 'schalter', 'schiebepuzzle'],
    geschick: ['labyrinth', 'rohre'],
    beobachten: ['suchbild', 'karte'],
    hoeren: ['melodie'],
    gedaechtnis: ['memory'],
  };
  for (const [art, liste] of Object.entries(ARTEN)) for (const k of liste) if (M[k] && !M[k].art) M[k].art = art;
  Clavis.ARTEN = { wissen: 'Wissen', entschluesseln: 'Entschlüsseln', logik: 'Logik', geschick: 'Geschick', beobachten: 'Beobachten', hoeren: 'Hören', erkunden: 'Erkunden', gedaechtnis: 'Gedächtnis' };
  Clavis.OHNE_INHALT.push('raumcode', 'spiegel', 'timing', 'veraendert', 'klopfzeichen', 'waage', 'fehlteil');
  /** Ersatz für zu viele Wissensfragen: Rätsel zum Anfassen */
  Clavis.ZUM_ANFASSEN = ['raumcode', 'fehlteil', 'spiegel', 'timing', 'veraendert', 'klopfzeichen', 'waage', 'schalter', 'rohre', 'labyrinth', 'suchbild', 'melodie', 'farbcode', 'schiebepuzzle', 'karte', 'memory'];

  Object.assign(Clavis.ERFOLG || (Clavis.ERFOLG = {}), {
    raumcode: 'Die Zeichen rasten ein – Klack, Klack, Klack. Das Schloss springt auf.',
    spiegel: 'Der Strahl trifft den Kristall – er glüht auf, und irgendwo löst sich ein Riegel.',
    timing: 'Ein sattes Klicken. Genau im richtigen Moment!',
    veraendert: 'Scharfes Auge! Hinter dem, was sich verändert hat, liegt etwas.',
    klopfzeichen: 'Stille. Dann antwortet es von der anderen Seite – und ein Riegel wird zurückgeschoben.',
    waage: 'Die Waage pendelt aus – perfektes Gleichgewicht. Ein Fach öffnet sich im Sockel.',
    fehlteil: 'Passt! Mit einem satten Klicken sitzt das Teil an seinem Platz.',
  });

  void gleich;
})();
