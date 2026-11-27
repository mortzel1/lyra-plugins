'use strict';
/* Sitzungsgebundene Klangregie. Alle Quellen laufen durch denselben begrenzten Bus und werden entsorgt. */
Clavis.FrontierKlang = function () {
    const K = Clavis.klang;
    let ctx, bus, aktiv = false, gewollt = false, ort = 'bahnhof', musik = true, laut = .65, intervall = null, duck = false, spannung = 0;
    const nodes = new Set(), timers = new Set();
    const bereit = () => aktiv && K.an() && !document.hidden && K.bereit();
    function own(n) { nodes.add(n); return n; }
    function spaeter(ms, f) { const t = setTimeout(() => { timers.delete(t); if (bereit())
        f(); }, ms); timers.add(t); }
    function envelope(dauer, amp, pan = 0, delay = 0) { const g = own(ctx.createGain()), p = own(ctx.createStereoPanner()), t = ctx.currentTime + delay; p.pan.value = pan; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + .025); g.gain.exponentialRampToValueAtTime(.0001, t + dauer); g.connect(p).connect(bus); spaeter((dauer + delay + .3) * 1000, () => { g.disconnect(); p.disconnect(); nodes.delete(g); nodes.delete(p); }); return { g, t }; }
    function tone(f, d = .7, amp = .06, pan = 0, type = 'sine', to = null, delay = 0) { if (!bereit())
        return; const { g, t } = envelope(d, amp, pan, delay), o = own(ctx.createOscillator()); o.type = type; o.frequency.setValueAtTime(f, t); if (to)
        o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + d); o.connect(g); o.start(t); o.stop(t + d + .1); o.onended = () => { o.disconnect(); nodes.delete(o); }; }
    function noise(d = 1, amp = .07, f = 600, pan = 0, type = 'bandpass', delay = 0) { if (!bereit())
        return; const { g, t } = envelope(d, amp, pan, delay), src = own(K.intern.rauschQuelle()), filter = own(ctx.createBiquadFilter()); filter.type = type; filter.frequency.value = f; filter.Q.value = .7; src.connect(filter).connect(g); src.start(t); src.stop(t + d + .1); src.onended = () => { src.disconnect(); filter.disconnect(); nodes.delete(src); nodes.delete(filter); }; }
    function vowel(f, d, amp, pan, delay = 0) { if (!bereit())
        return; const { g, t } = envelope(d, amp, pan, delay), src = own(ctx.createOscillator()); src.type = 'sawtooth'; src.frequency.setValueAtTime(f, t); src.frequency.exponentialRampToValueAtTime(Math.max(50, f * .68), t + d); const filters = []; for (const freq of [560, 1120, 2400]) {
        const filter = own(ctx.createBiquadFilter());
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 5;
        src.connect(filter).connect(g);
        filters.push(filter);
    } src.start(t); src.stop(t + d + .1); src.onended = () => { src.disconnect(); nodes.delete(src); filters.forEach(n => { n.disconnect(); nodes.delete(n); }); }; }
    function effet(art) {
        if (!bereit())
            return;
        if (art === 'wind') {
            noise(5, .12, 340, -.5, 'lowpass');
            noise(4, .06, 1200, .6);
        }
        else if (art === 'regen') {
            noise(5, .13, 2400, 0, 'highpass');
            for (let i = 0; i < 8; i++)
                tone(1100 + Math.random() * 1200, .05, .008, Math.random() * 2 - 1, 'sine', 600, i * .3);
        }
        else if (art === 'donner' || art === 'blitz') {
            noise(3.7, .42, 180, -.5, 'lowpass');
            noise(.28, .2, 2600, .65);
            tone(37, 3, .16, 0, 'sine', 20);
        }
        else if (art === 'atmen') {
            noise(1.6, .1, 720, -.65);
            noise(1.9, .065, 490, .65, 'bandpass', 1.6);
        }
        else if (art === 'lachen') {
            for (let i = 0; i < 5; i++) {
                vowel(146 - i * 7, .27, .055, .6, i * .24);
                noise(.17, .025, 1100, .6, 'bandpass', i * .24);
            }
        }
        else if (art === 'schrei') {
            vowel(340, 1.3, .095, -.3);
            noise(1.4, .075, 1500, -.3);
        }
        else if (art === 'glocke') {
            for (const [f, l] of [[144, .18], [290, .07], [417, .045], [586, .025]])
                tone(f, 6, l, .2, 'sine', f * .99);
        }
        else if (art === 'pianola') {
            [220, 261.63, 293.66, 329.63, 261.63, 220].forEach((f, i) => { tone(f, 1.1, .055, -.3, 'triangle', null, i * .35); tone(f * 2, .7, .014, .3, 'sine', null, i * .35); });
        }
        else if (art === 'telegraf') {
            [0, .16, .32, .75, 1, 1.25].forEach(t => { tone(890, .065, .07, 0, 'sine', null, t); noise(.045, .06, 1700, 0, 'highpass', t); });
        }
        else if (art === 'zug') {
            noise(4, .2, 470, -.7, 'lowpass');
            tone(165, 2, .08, -.5, 'triangle', 210);
            tone(220, 2, .035, -.4);
        }
        else if (art === 'bremse') {
            noise(2, .17, 2200, .65, 'bandpass');
            tone(640, 1.4, .025, .6, 'sawtooth', 340);
        }
        else if (art === 'lawine' || art === 'bruch') {
            noise(4, .38, 210, 0, 'lowpass');
            for (let i = 0; i < 6; i++)
                noise(.3, .12, 600 + i * 200, Math.random() * 2 - 1, 'bandpass', i * .19);
            tone(31, 3, .12, 0, 'sine', 18);
        }
        else if (art === 'metall' || art === 'tresor') {
            [90, 240, 617, 949].forEach((f, i) => tone(f, i ? 1.4 : .4, i ? .025 : .13, .3, 'sine', f * .9, i * .06));
            noise(.3, .11, 730, .4);
        }
        else if (art === 'papier') {
            noise(.5, .07, 2400, 0, 'highpass');
        }
        else if (art === 'wasser') {
            noise(3, .18, 650, 0, 'lowpass');
            tone(210, .2, .03, .4, 'sine', 100, .6);
        }
        else if (art === 'aufzug') {
            noise(5, .18, 300, 0, 'lowpass');
            tone(74, 4, .06, -.3, 'triangle', 46);
            [.3, 1.3, 2.4].forEach(t => tone(510, .3, .018, .6, 'sine', 230, t));
        }
        else if (art === 'stiefel' || art === 'schritte') {
            for (let i = 0; i < 4; i++) {
                noise(.16, .095, 300, -.4 + i * .2, 'lowpass', i * .52);
                tone(83, .15, .06, -.4 + i * .2, 'sine', 42, i * .52);
            }
        }
        else if (art === 'steine') {
            for (let i = 0; i < 6; i++)
                noise(.3, .09, 600 + i * 190, -.7 + i * .25, 'bandpass', i * .17);
        }
        else if (art === 'klopfen') {
            [0, .22, .74].forEach(t => { tone(130, .11, .1, -.6, 'sine', 64, t); noise(.07, .07, 700, -.6, 'lowpass', t); });
        }
        else if (art === 'herz') {
            tone(53, .23, .14, 0, 'sine', 36);
            tone(48, .25, .1, 0, 'sine', 33, .32);
        }
        else if (art === 'fehler') {
            tone(90, .6, .055, 0, 'triangle', 57);
            noise(.15, .06, 900);
        }
        else if (art === 'klick') {
            tone(1400, .035, .025, 0, 'sine', 650);
            noise(.03, .025, 2200);
        }
        else if (art === 'siegel') {
            tone(340, .3, .07);
            tone(510, .4, .03, 0, 'sine', null, .08);
        }
    }
    function stop(merken = false) { if (!merken)
        gewollt = false; aktiv = false; clearInterval(intervall); timers.forEach(clearTimeout); timers.clear(); nodes.forEach(n => { try {
        n.stop?.();
        n.disconnect();
    }
    catch (_) { } }); nodes.clear(); if (bus) {
        try {
            bus.disconnect();
        }
        catch (_) { }
    } bus = null; }
    function start(o = ort) {
        stop();
        ort = o;
        gewollt = true;
        aktiv = true;
        if (!K.an() || document.hidden || !K.bereit())
            return;
        ctx = K.intern.ctx();
        bus = ctx.createGain();
        bus.gain.value = laut * (duck ? .35 : 1);
        const limit = own(ctx.createDynamicsCompressor());
        limit.threshold.value = -19;
        limit.knee.value = 18;
        limit.ratio.value = 5;
        limit.attack.value = .008;
        limit.release.value = .4;
        bus.connect(limit).connect(K.intern.haupt());
        const delay = own(ctx.createDelay(1)), feedback = own(ctx.createGain()), wet = own(ctx.createGain()), damp = own(ctx.createBiquadFilter());
        delay.delayTime.value = ['stollen', 'kammer', 'kapelle'].includes(o) ? .29 : .13;
        feedback.gain.value = .18;
        wet.gain.value = ['stollen', 'kammer', 'kapelle'].includes(o) ? .17 : .07;
        damp.type = 'lowpass';
        damp.frequency.value = 1600;
        bus.connect(delay);
        delay.connect(wet).connect(limit);
        delay.connect(damp).connect(feedback).connect(delay);
        const src = own(K.intern.rauschQuelle()), f = own(ctx.createBiquadFilter()), gain = own(ctx.createGain());
        f.type = 'lowpass';
        f.frequency.value = ['stollen', 'kammer'].includes(o) ? 200 : ['saloon', 'bank', 'sheriff'].includes(o) ? 420 : 850;
        gain.gain.value = ['stollen', 'kammer'].includes(o) ? .025 : .05;
        src.connect(f).connect(gain).connect(bus);
        src.start();
        if (musik) {
            for (const freq of [55, 82.41, 110.12]) {
                const os = own(ctx.createOscillator()), g = own(ctx.createGain());
                os.frequency.value = freq;
                os.type = 'sine';
                g.gain.value = .012;
                os.connect(g).connect(bus);
                os.start();
            }
        }
        let count = 0;
        intervall = setInterval(() => { if (!bereit())
            return; count++; if (musik && spannung > .5 && count % Math.max(2, Math.round(6 - spannung * 4)) === 0)
            effet('herz'); if (count % 11)
            return; const phase = count / 11; if (['bahnhof', 'strasse', 'foerderhaus', 'kapelle'].includes(ort)) {
            effet(phase % 5 === 0 ? 'donner' : 'wind');
            if (phase % 2 === 0)
                effet('regen');
        }
        else if (ort === 'stollen' || ort === 'kammer') {
            if (phase % 3 === 0)
                effet('atmen');
            else
                tone(800 + Math.random() * 900, .14, .012, Math.random() * 2 - 1, 'sine', 270);
        }
        else if (phase % 4 === 0)
            effet(ort === 'saloon' ? 'klopfen' : 'metall'); }, 1000);
    }
    const visible = () => { if (document.hidden)
        stop(true);
    else if (gewollt)
        start(ort); };
    document.addEventListener('visibilitychange', visible);
    return { start, stop, cue: effet, ort: o => { if (o !== ort || !bus)
            start(o); }, ducken: v => { duck = !!v; if (bus)
            bus.gain.setTargetAtTime(laut * (duck ? .35 : 1), ctx.currentTime, .2); }, laut: v => { laut = Math.max(.05, Math.min(1, Number(v) || .65)); if (bus)
            bus.gain.value = laut * (duck ? .35 : 1); }, musik: v => { musik = !!v; if (gewollt)
            start(ort); }, spannung: v => { spannung = Math.max(0, Math.min(1, v)); }, melodie: a => { a.forEach((n, i) => { tone([220, 261.63, 293.66, 329.63][n], 1.2, .065, -.2, 'triangle', null, i * .48); }); }, zeichen: i => { tone([144, 192, 216, 256][i], 3, .14, .1); tone([144, 192, 216, 256][i] * 2.03, 1.4, .035, -.3); }, dispose() { stop(); document.removeEventListener('visibilitychange', visible); } };
};
