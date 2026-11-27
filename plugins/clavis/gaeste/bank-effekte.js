'use strict';
/* Sichtbares Feedback je Bedienung; reduzierte Bewegung behält ruhige Statussignale. */
Clavis.BankEffekte = (root, reduziert = () => false, schreck = () => true) => {
    const h = Clavis.el, schicht = h('div', { class: 'br-fx-layer', 'aria-hidden': 'true' }), timers = new Set();
    root.append(schicht);
    let aus = false, letzteSchrift = 0;
    const later = (ms, f) => {
        const id = setTimeout(() => {
            timers.delete(id);
            if (!aus)
                f();
        }, ms);
        timers.add(id);
    };
    function aktion(art = 'taste', event) {
        if (aus)
            return;
        if (art === 'schrift' && Date.now() - letzteSchrift < 45)
            return;
        if (art === 'schrift')
            letzteSchrift = Date.now();
        const rect = event?.currentTarget?.getBoundingClientRect?.() || root.getBoundingClientRect(), x = Number.isFinite(event?.clientX) && event.clientX ? event.clientX : rect.left + rect.width / 2, y = Number.isFinite(event?.clientY) && event.clientY ? event.clientY : rect.top + rect.height / 2;
        const node = h('i', { class: 'br-action-ring ' + art + (reduziert() ? ' still' : ''), style: { left: x + 'px', top: y + 'px' } });
        if (schicht.children.length > 18)
            schicht.children[0].remove();
        schicht.append(node);
        later(reduziert() ? 160 : 700, () => node.remove());
        const target = event?.currentTarget;
        if (target?.classList) {
            target.classList.remove('br-touch');
            void target.offsetWidth;
            target.classList.add('br-touch');
            later(450, () => target.classList.remove('br-touch'));
        }
    }
    function ereignis(art, data = {}) {
        if (aus)
            return;
        const classes = { freigabe: 'br-vault-release', alarm: 'br-alarm-hit', kontrolle: 'br-revision', festnahme: 'br-capture-hit', zugriff: 'br-capture-hit', riegel: 'br-bolt-pull', rohrpost: 'br-capsule-pass', impuls: 'br-pulse-hit', scharf: 'br-arm-hit', moment: 'br-watch-hit' };
        const c = classes[art];
        if (c && (schreck() || !['kontrolle', 'festnahme', 'zugriff', 'alarm', 'moment'].includes(art))) {
            root.classList.remove(c);
            void root.offsetWidth;
            root.classList.add(c);
            later(1800, () => root.classList.remove(c));
        }
        if (['festnahme', 'zugriff', 'kontrolle', 'freigabe'].includes(art)) {
            const text = art === 'festnahme' ? 'PERSONALÜBERNAHME' : art === 'zugriff' ? 'ZUGRIFF DER REVISION' : art === 'kontrolle' ? 'DIE BANK PRÜFT EUCH' : 'FREIGABE';
            const n = h('div', { class: 'br-event-stamp ' + art + (!schreck() ? ' still' : '') }, h('i', {}), h('span', {}, text));
            schicht.append(n);
            later(2300, () => n.remove());
        }
    }
    return { aktion, ereignis, dispose() {
            if (aus)
                return;
            aus = true;
            timers.forEach(clearTimeout);
            timers.clear();
            schicht.remove();
        } };
};
