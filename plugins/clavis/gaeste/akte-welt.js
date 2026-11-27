'use strict';
Clavis.AktenWelt = (() => {
    let nr = 0;
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    function bild(ort, opt = {}) {
        const id = 'na-' + ++nr, forest = ['park', 'trail', 'ranger', 'klippe', 'tunnel'].includes(ort), outdoor = forest || ['hafen', 'motel', 'tankstelle'].includes(ort), src = Clavis.AktenBilder?.[ort] || Clavis.AktenBilder?.park || '';
        const beam = '<path class="na-search-beam" d="M800 30L270 650L940 650Z" fill="url(#' + id + ')"/>';
        const silhouette = '<g class="na-distant-figure"><ellipse cx="654" cy="366" rx="8" ry="11"/><path d="M645 376Q654 371 663 377L672 423L657 423L649 410L642 424L632 422Z"/></g>';
        let props = forest ? '<g class="na-branches" fill="none" stroke="#070f12" opacity=".16"><path d="M20 60Q270 150 380 30M120 80L280 10M60 65L130 175M1000 20Q800 200 930 320M950 120L840 160" stroke-width="9"/></g>' + (!opt.enttarnt ? silhouette : '<path class="na-projection-known" d="M620 560L670 240L790 530Z" fill="#e9cfa0" opacity=".065"/>') : '';
        if (ort === 'klippe' || ort === 'park')
            props += beam;
        if (['einsatz', 'ranger', 'buero'].includes(ort))
            props += '<g class="na-monitor"><rect x="690" y="250" width="100" height="70" fill="#57b8b8" opacity=".06"/><path d="M691 267H789M691 290H789M691 311H789" stroke="#b5dfcf" opacity=".16"/></g>';
        if (ort === 'hafen')
            props += '<g class="na-crane-light"><circle cx="825" cy="200" r="3" fill="#ddc38b"/><path d="M825 200L990 620L670 620Z" fill="#e3c087" opacity=".025"/></g>';
        if (ort === 'motel')
            props += '<rect class="na-curtain" x="628" y="210" width="83" height="210" fill="#a98047" opacity=".08"/>';
        if (ort === 'tunnel')
            props += '<g class="na-projector"><circle cx="272" cy="340" r="29" fill="none" stroke="#d8ba89" stroke-width="3" opacity=".17"/><path d="M270 339L900 150L930 580Z" fill="#d9d9b0" opacity=".035"/></g>';
        const svg = '<svg class="na-world-props" viewBox="0 0 1000 666" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="#d7e7df" stop-opacity="0"/><stop offset="1" stop-color="#c3dfd8" stop-opacity=".12"/></linearGradient></defs>' + props + '</svg>';
        return '<div class="na-world ' + (forest ? 'forest ' : '') + (opt.minute >= 75 ? 'wet ' : '') + (opt.minute >= 30 ? 'night ' : '') + '" data-world="' + esc(ort) + '"><img class="na-panorama" src="' + esc(src) + '" alt="" draggable="false"><div class="na-world-grade"></div>' + svg + (outdoor ? '<div class="na-fog"></div>' : '<div class="na-room-glow"></div>') + (opt.minute >= 75 && outdoor ? '<div class="na-rain"></div>' : '') + '<div class="na-world-vignette"></div></div>';
    }
    return { bild };
})();
