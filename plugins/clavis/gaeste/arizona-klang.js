'use strict';
/* Eigene, räumliche JANUS-Klangregie. Alle Quellen und Timer gehören dieser Sitzung. */
Clavis.ArizonaKlang = function () {
    const K = Clavis.klang;
    let ctx, bus, ort = 'strasse', an = false, gewollt = false, musik = true, laut = .6, duck = false, spannung = 0, takt = null, schritt = 0;
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
        if (art === 'wind' || art === 'sand') {
            noise(6, .1, 470, -.5, 'lowpass');
            noise(5, .035, 1600, .6);
        }
        else if (art === 'radio') {
            noise(5, .025, 1400, -.4);
            noise(4.5, .045, 190, 0, 'lowpass');
            for (let repeat=0; repeat<2; repeat++) [164.81,196,220,174.61].forEach((f,i)=>tone(f,.85,.035,-.35,f*.994,repeat*2.2+i*.42,'triangle'));
        }
        else if (art === 'motor') {
            [43, 86, 129].forEach((f, i) => tone(f, 5, .07 / (i + 1), -.5, f * .85));
            noise(4, .04, 180, -.4, 'lowpass');
        }
        else if (art === 'reifen') {
            noise(.18, .2, 1800, .6, 'highpass');
            noise(1.8, .15, 440, .6, 'lowpass');
            tone(57, 1, .08, .2, 24);
        }
        else if (art === 'funk' || art === 'intercom') {
            noise(.9, .065, 1100, -.55);
            [0, .2, .58].forEach((x, i) => tone([660, 550, 440][i], .12, .035, -.5, null, x));
        }
        else if (art === 'druck') {
            noise(3, .12, 1900, .6);
            tone(110, 2, .055, -.5, 72);
        }
        else if (art === 'aufzug') {
            noise(5, .09, 260, 0, 'lowpass');
            tone(68, 4, .07, 0, 38);
            [.4, 1.8, 3].forEach(t => tone(350, .3, .02, .6, 220, t));
        }
        else if (art === 'riss') {
            noise(3, .16, 430, 0, 'lowpass');
            [37, 74, 111.5].forEach((f, i) => tone(f, 4, .07 / (i + 1), i % 2 ? .5 : -.5, f * 1.37));
            noise(.22, .09, 1800, .6, 'highpass', 1.3);
        }
        else if (art === 'band') {
            noise(3, .035, 1400, 0);
            [196, 195, 194.2].forEach((f, i) => tone(f, 2.5, .018, i % 2 ? .5 : -.5, f * .8, i * .25));
        }
        else if (art === 'strom') {
            noise(3, .09, 180, 0, 'lowpass');
            [50, 100, 150].forEach((f, i) => tone(f, 3, .05 / (i + 1), -.3, f * 1.1));
        }
        else if (art === 'anker' || art === 'gut') {
            [174.61, 261.63, 349.23].forEach((f, i) => tone(f, 1.4, .045, 0, null, i * .13, 'triangle'));
        }
        else if (art === 'nullpunkt') {
            [31, 62.2, 93.1, 125.4].forEach((f, i) => tone(f, 6, .07 / (i + 1), i % 2 ? .6 : -.6, f * 1.04));
            noise(5, .065, 480, 0, 'lowpass');
        }
        else if (art === 'herz') {
            tone(49, .2, .11, 0, 33);
            tone(44, .25, .08, 0, 30, .3);
        }
        else if (art === 'atmen') {
            noise(1.5, .07, 670, -.65);
            noise(1.6, .04, 430, .65, 'bandpass', 1.7);
        }
        else if (art === 'lachen') {
            for (let i = 0; i < 4; i++) {
                tone(158 - i * 8, .26, .03, .65, 96, i * .27, 'triangle');
                noise(.2, .025, 900, .65, 'bandpass', i * .27);
            }
        }
        else if (art === 'schritte') {
            for (let i = 0; i < 4; i++) {
                noise(.13, .075, 350, i % 2 ? .5 : -.5, 'lowpass', i * .5);
                tone(80, .12, .04, 0, 36, i * .5);
            }
        }
        else if (art === 'klopfen') {
            [0, .29, .9].forEach(t => { tone(125, .13, .07, .5, 57, t); noise(.06, .04, 600, .5, 'lowpass', t); });
        }
        else if (art === 'tuer') {
            noise(.3, .13, 350, 0, 'lowpass');
            tone(90, 1.6, .065, .2, 40);
        }
        else if (art === 'donner') {
            noise(4, .16, 160, -.6, 'lowpass');
            noise(.35, .08, 2100, .6);
            tone(34, 3, .08, 0, 20);
        }
        else if (art === 'papier') {
            noise(.45, .045, 2200, 0, 'highpass');
        }
        else if (art === 'fehler') {
            tone(130, .55, .04, 0, 75, 0, 'triangle');
            noise(.1, .035, 700);
        }
        else if (art === 'impuls') {
            tone(329.63, .4, .045, 0);
            tone(164.81, .6, .02, .4);
        }
        else if (art === 'klick') {
            tone(740, .045, .025, 0, 330);
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
        delay.delayTime.value = ['strasse', 'mast'].includes(ort) ? .12 : .31;
        feed.gain.value = .14;
        wet.gain.value = .1;
        filter.type = 'lowpass';
        filter.frequency.value = 1450;
        bus.connect(delay);
        delay.connect(wet).connect(comp);
        delay.connect(filter).connect(feed).connect(delay);
        const src = own(K.intern.rauschQuelle()), f = own(ctx.createBiquadFilter()), g = own(ctx.createGain());
        f.type = 'lowpass';
        f.frequency.value = ['strasse', 'mast'].includes(ort) ? 750 : 210;
        g.gain.value = .027;
        src.connect(f).connect(g).connect(bus);
        src.start();
        if (musik)
            for (const freq of [43.65, 65.42, 87.4]) {
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
                cue(['strasse', 'mast'].includes(ort) ? 'wind' : 'strom');
            if (schritt % 29 === 0 && ['gang', 'archiv', 'beobachtung'].includes(ort))
                cue('klopfen');
            if (spannung > .5 && schritt % 5 === 0)
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
