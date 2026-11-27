'use strict';
/* Räumlicher Nachtwald. Alle Knoten gehören dieser Sitzung und werden beim Verlassen entsorgt. */
Clavis.PremiumKlang = function () {
  const k = Clavis.klang;
  let welt = 'hof', aktiv = false, gewollt = false, bus = null, knoten = [], takt = null, last = 0;
  const timers = new Set(), panner = new Set();
  function nach(ms, f) { const t = setTimeout(() => { timers.delete(t); if (aktiv && !document.hidden && k.an()) f(); }, ms); timers.add(t); }
  function ton(f, dauer, laut = .03, pan = 0, gleit = null) {
    if (!aktiv || !k.an() || !k.bereit() || document.hidden) return;
    const a = k.intern, ctx = a.ctx(), p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(bus || a.haupt());
    a.ton(f, dauer, { laut, gleit, ziel: p, angriff: .04 });
    panner.add(p); const t = setTimeout(() => { timers.delete(t); p.disconnect(); panner.delete(p); }, (dauer + 1) * 1000); timers.add(t);
  }
  function cue(art) {
    if (!aktiv || !k.an() || document.hidden) return;
    if (art === 'ast') { k.spielen('knarren'); nach(280, () => k.spielen('klopf')); }
    else if (art === 'klopf') [0, 280, 900].forEach(ms => nach(ms, () => k.spielen('klopf')));
    else if (art === 'schritte') [0, 700, 1450].forEach((ms, i) => nach(ms, () => { ton(80 + i * 7, .18, .12, -.8 + i * .6, 45); }));
    else if (art === 'ruf') { ton(145, 2.8, .025, -.7, 110); ton(147, 3, .025, .7, 108); nach(1200, () => k.spielen('funk')); }
    else k.spielen(art);
  }
  function stop(merken = false) {
    if (!merken) gewollt = false;
    aktiv = false; clearInterval(takt); timers.forEach(clearTimeout); timers.clear();
    panner.forEach(p => p.disconnect()); panner.clear();
    knoten.forEach(n => { try { if (n.stop) n.stop(); n.disconnect(); } catch (_) {} }); knoten = [];
    if (bus) try { bus.disconnect(); } catch (_) {} bus = null;
  }
  function start(ort = welt) {
    stop(); welt = ort; aktiv = true; gewollt = true;
    if (!k.an() || document.hidden || !k.bereit() || !k.intern) return;
    const a = k.intern, ctx = a.ctx();
    bus = ctx.createGain(); bus.gain.value = .32; bus.connect(a.haupt());
    const r = a.rauschQuelle(), lp = ctx.createBiquadFilter(), gain = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = ['hof', 'pfad', 'wehr', 'turm'].includes(ort) ? 1050 : 350;
    gain.gain.value = ort === 'wehr' ? .23 : .08; lfo.frequency.value = .08; lg.gain.value = .035;
    r.connect(lp).connect(gain).connect(bus); lfo.connect(lg).connect(gain.gain); r.start(); lfo.start(); knoten.push(r, lp, gain, lfo, lg);
    last = Date.now();
    takt = setInterval(() => {
      if (!aktiv || !k.an() || document.hidden) return;
      if (Date.now() - last > 13000 + Math.random() * 18000) {
        last = Date.now();
        if (welt === 'pfad' || welt === 'hof') { ton(410, 1.1, .025, -.65, 330); nach(1400, () => ton(370, 1.5, .018, .6, 280)); }
        else if (welt === 'keller') { ton(53, 1.6, .06, .5, 47); }
        else if (welt === 'turm') k.spielen('knarren');
        else if (welt === 'funk') k.spielen('funk');
      }
    }, 4000);
  }
  const visible = () => { if (document.hidden) stop(true); else if (gewollt && document.querySelector('.px-spiel')) start(welt); };
  document.addEventListener('visibilitychange', visible);
  return { start, stop, cue, ort: o => { if (o !== welt || !bus) start(o); }, dispose() { stop(); document.removeEventListener('visibilitychange', visible); } };
};
