'use strict';
/* Ein Einstieg für alle Räume; Bank und Nachtakte bleiben in derselben Installation. */
(() => {
    const bisher = Clavis.Spiel.erstellen;
    Clavis.Spiel.erstellen = (root, opt) => {
        let view = null, weg = false;
        const queue = [];
        return { empfangen(d) {
                if (weg)
                    return;
                if (!view && d?.typ === 'raum') {
                    const api = d.raum.premium === 'reserve' ? Clavis.BankSpiel : d.raum.premium === 'nachtakte' ? Clavis.AktenSpiel : null;
                    view = api ? api.erstellen(root, opt) : bisher(root, opt);
                    view.empfangen(d);
                    queue.splice(0).forEach(x => view.empfangen(x));
                }
                else if (view)
                    view.empfangen(d);
                else if (['vorbei', 'entfernt'].includes(d?.typ)) {
                    root.textContent = 'Die Runde ist geschlossen.';
                    queue.length = 0;
                }
                else if (queue.length < 100)
                    queue.push(d);
            }, destroy() { weg = true; queue.length = 0; view?.destroy?.(); }, get element() { return view?.element; } };
    };
})();
