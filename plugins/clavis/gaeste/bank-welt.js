'use strict';
Clavis.BankWelt = (() => {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    let serial = 0;
    function bild(ort, opt = {}) {
        const src = Clavis.BankBilder?.[ort] || Clavis.BankBilder?.aussen || '', regen = ['aussen', 'dach', 'ufer'].includes(ort), ruhig = ort === 'salon', id = 'br' + ++serial;
        let props = '';
        if (ort === 'kamera')
            props = '<g class="br-lens"><circle cx="700" cy="290" r="40" fill="#08100e" opacity=".3"/><circle cx="700" cy="290" r="26" fill="none" stroke="#bda66c" stroke-width="1" opacity=".5"/><path d="M700 290L980 140L980 520Z" fill="url(#' + id + 'beam)" opacity=".15"/></g>';
        if (ort === 'uhrwerk')
            props = '<g class="br-clock-hands"><path d="M500 274L504 222M500 274L546 298" stroke="#d8c08b" stroke-width="2" opacity=".4"/></g>';
        if (ort === 'rohrpost')
            props = '<g class="br-capsule"><rect x="200" y="264" width="86" height="24" rx="12" fill="#c2a76c" opacity=".7"/><path d="M215 266V286M270 266V286" stroke="#1b211b" opacity=".8"/></g>';
        if (ort === 'praegung')
            props = Array.from({ length: 6 }, (_, i) => '<rect class="br-banknote n' + i + '" x="' + (210 + i * 6) + '" y="' + (445 + i * 4) + '" width="47" height="21" fill="#cec5ab" opacity=".35"/>').join('');
        if (ort === 'salon')
            props = '<g class="br-steam"><path d="M535 419Q522 395 537 372T534 330M552 417Q565 395 550 376T553 345" fill="none" stroke="#f0e1b1" stroke-width="2" opacity=".2"/></g>';
        if (ort === 'waage')
            props = '<g class="br-load-chain"><path d="M335 40V590M665 40V590" stroke="#b9a771" stroke-width="2" stroke-dasharray="5 5" opacity=".25"/></g>';
        if (['steg', 'messboden'].includes(ort))
            props = '<g class="br-sensor-sweep"><path d="M80 470L925 355M130 530L950 430M200 600L970 510" stroke="#e9bd83" stroke-width="1" opacity=".3"/><path d="M80 470L925 355L950 430L130 530Z" fill="#a5b18a" opacity=".035"/></g>';
        if (ort === 'tresor')
            props = '<g class="br-vault-light"><ellipse cx="545" cy="415" rx="210" ry="55" fill="none" stroke="#d7b66f" stroke-width="1" opacity=".2"/></g>';
        if (ort === 'flucht')
            props = '<g class="br-release-bolts">' + [0, 1, 2, 3, 4, 5].map(i => '<rect x="' + (90 + i * 81) + '" y="' + (345 - i * 14) + '" width="45" height="12" rx="4" fill="#baa16d" opacity=".24"/>').join('') + '</g>';
        if (ort === 'zelle')
            props = '<g class="br-cell-shadow"><path d="M105 265Q128 232 150 267L152 352L178 434L106 434L100 349Z" fill="#020806" opacity=".27"/></g>';
        const svg = '<svg class="br-props" viewBox="0 0 1000 666" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="' + id + 'beam"><stop stop-color="#c8cf9c" stop-opacity=".7"/><stop offset="1" stop-color="#b2b98b" stop-opacity="0"/></linearGradient></defs>' + props + '</svg>';
        return '<div class="br-world ' + (ruhig ? 'br-safe' : regen ? 'br-exterior' : 'br-interior') + '" data-world="' + esc(ort) + '" style="--bank-alarm:' + (Math.max(0, Math.min(100, opt.alarm || 0)) / 100) + '"><img class="br-panorama" src="' + esc(src) + '" alt="" draggable="false"><div class="br-world-shade"></div>' + svg + (regen ? '<div class="br-rain"></div>' : '') + (ruhig ? '' : '<div class="br-dust"></div><div class="br-security-scan"></div><div class="br-alarm-glow"></div>') + '<div class="br-lamp-light"></div><div class="br-vignette"></div></div>';
    }
    function drehen(mask, n) {
        for (let t = 0; t < n; t++) {
            let v = 0;
            for (let i = 0; i < 9; i++)
                if (mask & (1 << i))
                    v |= 1 << ((i % 3) * 3 + 2 - Math.floor(i / 3));
            mask = v;
        }
        return mask;
    }
    return { bild, drehen };
})();
