'use strict';
/* Eigene, räumliche Noir-Klangregie. Alle Quellen und Timer gehören dieser Sitzung. */
Clavis.BankKlang = function () {
    const K = Clavis.klang;
    let ctx, bus, ort = 'aussen', an = false, gewollt = false, musik = true, laut = .6, duck = false, spannung = 0, takt = null, schritt = 0;
    const nodes = new Set(), timers = new Set(), own = n => (nodes.add(n), n);
    const ok = () => an && K.an() && !document.hidden && ctx && bus;
    const later = (ms, f) => {
        const t = setTimeout(() => {
            timers.delete(t);
            if (ok())
                f();
        }, ms);
        timers.add(t);
        return t;
    };
    function env(d, amp, pan = 0, delay = 0) { const g = own(ctx.createGain()), p = own(ctx.createStereoPanner()), t = ctx.currentTime + delay; p.pan.value = pan; g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(amp, t + .025); g.gain.exponentialRampToValueAtTime(.0001, t + d); g.connect(p).connect(bus); later((d + delay + .3) * 1000, () => { g.disconnect(); p.disconnect(); nodes.delete(g); nodes.delete(p); }); return { g, t }; }
    function tone(f, d = .5, a = .04, pan = 0, to = null, delay = 0, type = 'sine') {
        if (!ok())
            return;
        const { g, t } = env(d, a, pan, delay), o = own(ctx.createOscillator());
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (to)
            o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + d);
        o.connect(g);
        o.start(t);
        o.stop(t + d + .1);
        o.onended = () => { o.disconnect(); nodes.delete(o); };
    }
    function noise(d = 1, a = .05, f = 600, pan = 0, type = 'bandpass', delay = 0) {
        if (!ok())
            return;
        const { g, t } = env(d, a, pan, delay), s = own(K.intern.rauschQuelle()), filter = own(ctx.createBiquadFilter());
        filter.type = type;
        filter.frequency.value = f;
        filter.Q.value = .8;
        s.connect(filter).connect(g);
        s.start(t);
        s.stop(t + d + .1);
        s.onended = () => { s.disconnect(); filter.disconnect(); nodes.delete(s); nodes.delete(filter); };
    }
    function cue(art) {
        if (!ok())
            return;
        if (art === 'regen') {
            noise(6, .1, 2200, 0, 'highpass');
            noise(5, .035, 600, -.4);
        }
        else if (art === 'donner') {
            noise(4, .095, 120, -.3, 'lowpass');
            tone(32, 3, .075, 0, 18);
            noise(1.5, .035, 360, .6, 'lowpass', .5);
        }
        else if (art === 'lachen') {
            [0, .19, .41].forEach((d, i) => { tone(150 - i * 12, .14, .025, -.7, 100, d); noise(.13, .018, 680, -.7, 'bandpass', d); });
        }
        else if (art === 'karte' || art === 'papier' || art === 'stoff') {
            noise(.5, .055, 2000, -.3, 'highpass');
        }
        else if (art === 'kasse') {
            [0, .09, .18, .31].forEach((t, i) => { tone(640 + i * 95, .07, .035, .2, null, t); noise(.06, .04, 1500, .2, 'bandpass', t); });
            tone(108, .5, .065, 0, 60, .25);
        }
        else if (art === 'kamera') {
            tone(180, 1.1, .025, .6, 300);
            noise(.4, .025, 1200, .6);
        }
        else if (art === 'uhr') {
            [0, .54, 1.08, 1.62].forEach((t, i) => { tone(i % 2 ? 470 : 350, .045, .035, -.6, null, t); noise(.025, .03, 1400, -.6, 'highpass', t); });
        }
        else if (art === 'rohrpost') {
            noise(2, .1, 650, -.7);
            tone(150, 1.8, .04, -.5, 320);
            noise(.2, .1, 330, .6, 'lowpass', 1.7);
        }
        else if (art === 'presse') {
            noise(.5, .13, 260, 0, 'lowpass');
            tone(58, 2, .09, -.3, 38);
            noise(.28, .055, 1400, .5, 'bandpass', .55);
        }
        else if (art === 'ruhe') {
            [130.81, 164.81, 196].forEach((f, i) => tone(f, 6, .022, i % 2 ? .35 : -.35, null, i * .15));
        }
        else if (art === 'winde') {
            noise(5, .075, 240, -.3, 'lowpass');
            tone(72, 4, .05, .2, 45);
            [.2, 1.7, 3].forEach(t => tone(460, .25, .02, .6, 260, t));
        }
        else if (art === 'kontakt' || art === 'impuls') {
            tone(261.63, .6, .045, 0);
            tone(391.99, 1, .025, .4, null, .08);
        }
        else if (art === 'laser') {
            [0, .3, .6].forEach(t => tone(680, .12, .025, .55, 820, t));
            noise(1, .025, 1700, -.3);
        }
        else if (art === 'tresor' || art === 'reserve') {
            [43.65, 87.3, 131, 174.6].forEach((f, i) => tone(f, 5, .085 / (i + 1), i % 2 ? .4 : -.4, f * .98));
            noise(4, .07, 250, 0, 'lowpass');
        }
        else if (art === 'riegel' || art === 'gitter') {
            [0, .16, .35].forEach((t, i) => { tone(85 + i * 47, .5, .07, i % 2 ? .5 : -.5, 40, t); noise(.18, .09, 450 + i * 250, .3, 'bandpass', t); });
        }
        else if (art === 'intercom') {
            noise(.9, .05, 1200, -.65);
            [440, 330].forEach((f, i) => tone(f, .13, .035, -.6, null, i * .23));
        }
        else if (art === 'alarm' || art === 'fehler') {
            tone(146.83, 1.1, .075, 0, 110);
            tone(155.56, 1.1, .045, .25, 116);
            noise(.2, .04, 1100, .6);
        }
        else if (art === 'festnahme' || art === 'zugriff') {
            noise(1.4, .17, 230, 0, 'lowpass');
            tone(34, 3, .105, -.2, 20);
            tone(92, 1.4, .055, .5, 48, .3);
            noise(.18, .09, 1500, -.6, 'bandpass', .6);
        }
        else if (art === 'schritte') {
            for (let i = 0; i < 5; i++) {
                noise(.12, .075, 300, i % 2 ? .5 : -.5, 'lowpass', i * .53);
                tone(78, .14, .04, 0, 36, i * .53);
            }
        }
        else if (art === 'herz') {
            tone(49, .2, .09, 0, 31);
            tone(44, .25, .065, 0, 28, .31);
        }
        else if (art === 'atmen') {
            noise(1.7, .06, 570, -.6);
            noise(1.8, .035, 400, .6, 'bandpass', 1.8);
        }
        else if (art === 'scharf') {
            [196, 246.94].forEach((f, i) => tone(f, .5, .025, .2, null, i * .1));
        }
        else if (art === 'freigabe' || art === 'gut') {
            [174.61, 220, 261.63].forEach((f, i) => tone(f, 1.5, .035, 0, null, i * .14, 'triangle'));
        }
        else if (art === 'beleg') {
            tone(520, .09, .025, 0, 370);
            noise(.05, .02, 1800, .2);
        }
        else if (art === 'klick' || art === 'crew') {
            tone(740, .04, .018, 0, 380);
        }
    }
    function stop(merken = false) {
        if (!merken)
            gewollt = false;
        an = false;
        clearInterval(takt);
        takt = null;
        timers.forEach(clearTimeout);
        timers.clear();
        for (const n of nodes) {
            try {
                n.stop?.();
                n.disconnect();
            }
            catch (_) { }
        }
        nodes.clear();
        bus = null;
    }
    function start(o = ort) {
        stop();
        ort = o;
        gewollt = true;
        if (!K.an() || document.hidden || !K.bereit() || !K.intern)
            return;
        ctx = K.intern.ctx();
        an = true;
        bus = own(ctx.createGain());
        bus.gain.value = laut * (duck ? .3 : 1);
        const comp = own(ctx.createDynamicsCompressor());
        comp.threshold.value = -21;
        comp.knee.value = 20;
        comp.ratio.value = 6;
        comp.attack.value = .008;
        comp.release.value = .5;
        bus.connect(comp).connect(K.intern.haupt());
        const delay = own(ctx.createDelay(1)), feed = own(ctx.createGain()), wet = own(ctx.createGain()), filter = own(ctx.createBiquadFilter());
        delay.delayTime.value = ['aussen', 'dach', 'ufer'].includes(ort) ? .12 : .31;
        feed.gain.value = .14;
        wet.gain.value = .1;
        filter.type = 'lowpass';
        filter.frequency.value = 1450;
        bus.connect(delay);
        delay.connect(wet).connect(comp);
        delay.connect(filter).connect(feed).connect(delay);
        const src = own(K.intern.rauschQuelle()), f = own(ctx.createBiquadFilter()), g = own(ctx.createGain());
        f.type = 'lowpass';
        f.frequency.value = ['aussen', 'dach', 'ufer'].includes(ort) ? 750 : 210;
        g.gain.value = ort === 'salon' ? .006 : .027;
        src.connect(f).connect(g).connect(bus);
        src.start();
        if (musik)
            for (const freq of (ort === 'salon' ? [130.81, 164.81, 196] : [43.65, 65.42, 87.4])) {
                const o = own(ctx.createOscillator()), a = own(ctx.createGain());
                o.frequency.value = freq;
                a.gain.value = .009;
                o.connect(a).connect(bus);
                o.start();
            }
        schritt = 0;
        takt = setInterval(() => {
            if (!ok())
                return;
            schritt++;
            if (schritt % 12 === 0)
                cue(['aussen', 'dach', 'ufer'].includes(ort) ? 'regen' : ort === 'salon' ? 'ruhe' : 'uhr');
            if (schritt % 37 === 0 && ['aussen', 'dach', 'ufer'].includes(ort))
                cue('donner');
            if (schritt % 29 === 0 && ort !== 'salon' && !['aussen', 'dach', 'ufer'].includes(ort))
                cue('schritte');
            if (spannung > .5 && ort !== 'salon' && schritt % 5 === 0)
                cue('herz');
        }, 1000);
    }
    const visibility = () => {
        if (document.hidden)
            stop(true);
        else if (gewollt)
            start(ort);
    };
    document.addEventListener('visibilitychange', visibility);
    const mute = () => {
        if (!K.an())
            stop(true);
        else if (gewollt)
            start(ort);
    };
    document.addEventListener('clavis-klang', mute);
    return { start, stop, cue, ort(o) {
            if (o !== ort && gewollt)
                start(o);
            else
                ort = o;
        }, laut(v) {
            laut = Math.max(0, Math.min(1, Number(v) || 0));
            if (bus)
                bus.gain.value = laut * (duck ? .3 : 1);
        }, musik(v) {
            musik = !!v;
            if (gewollt)
                start(ort);
        }, ducken(v) {
            duck = !!v;
            if (bus)
                bus.gain.value = laut * (duck ? .3 : 1);
        }, spannung(v) { spannung = Math.max(0, Math.min(1, v)); }, dispose() { stop(); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('clavis-klang', mute); } };
};
