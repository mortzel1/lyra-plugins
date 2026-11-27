'use strict';
Clavis.ArizonaWelt = (() => {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    function bild(ort, opt = {}) {
        const key = opt.outro === 'morgen' ? 'morgen' : opt.outro === 'nacht' ? 'nacht' : opt.portrait ? 'nika' : ort === 'strasse' && opt.spannung > .65 ? 'nacht' : ort;
        const src = Clavis.ArizonaBilder?.[key] || Clavis.ArizonaBilder?.strasse || '';
        const desert = ['strasse', 'mast', 'morgen', 'nacht'].includes(key), core = key === 'kern', ni = key === 'quarantaene' && opt.nika === 'retten';
        return '<div class="az-world ' + (desert ? 'az-desert' : 'az-underground') + (core ? ' az-core' : '') + (opt.geloest?.strom ? ' az-powered' : '') + '" data-world="' + esc(key) + '"><img class="az-panorama" src="' + esc(src) + '" alt="" draggable="false"><div class="az-world-shade"></div><div class="az-atmosphere"></div><div class="az-dust"></div><div class="az-light-leak"></div>' +
            (desert ? '<div class="az-heat"></div><div class="az-beacon"></div>' : '<div class="az-scan"></div><div class="az-emergency"></div>') +
            (core ? '<svg class="az-anomaly" viewBox="0 0 1000 666" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="azVoid"><stop offset="0" stop-color="#02080b"/><stop offset=".72" stop-color="#02080b"/><stop offset="1" stop-color="#e7ad56" stop-opacity=".25"/></radialGradient></defs><g class="az-orbit"><ellipse cx="500" cy="300" rx="175" ry="54" fill="none" stroke="#eac080" stroke-width=".6" opacity=".35"/><ellipse cx="500" cy="300" rx="155" ry="83" fill="none" stroke="#8bd9d0" stroke-width=".7" opacity=".2"/></g><ellipse class="az-void" cx="500" cy="234" rx="29" ry="116" fill="url(#azVoid)" opacity=".44"/></svg>' : '') +
            (ni ? '<div class="az-companion"><span>◉</span> NIKA VOSS · BEI EUCH</div>' : '') + '<div class="az-vignette"></div></div>';
    }
    return { bild };
})();
