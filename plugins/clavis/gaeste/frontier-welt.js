'use strict';
/* Eigenständige, geschichtete Bühnenbilder. Alle Details bleiben offline im Plugin. */
Clavis.FrontierWelt = (() => {
    let nr = 0;
    const rect = (x, y, w, h, c, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${extra}/>`;
    const line = (d, c = '#70563f', w = 2, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" ${extra}/>`;
    const text = (x, y, t, size = 18, color = '#d8b47c', extra = '') => `<text x="${x}" y="${y}" fill="${color}" font-family="Georgia,serif" font-size="${size}" text-anchor="middle" ${extra}>${t}</text>`;
    const person = (x, y, s = 1, cls = '') => `<g class="${cls}" transform="translate(${x} ${y}) scale(${s})"><ellipse cy="-82" rx="12" ry="16" fill="#0e1419"/><path d="M-29 -92 Q0 -108 29 -92 L24 -88 H-24Z M-12 -94 L-9 -111 H11 L15 -93Z" fill="#12171a"/><path d="M-14 -64 L-27 10 H26 L15 -64Z" fill="#141a1a"/><path d="M-12 10 L-14 45 M12 10 L13 45" stroke="#11181b" stroke-width="10"/></g>`;
    const lantern = (x, y, lit = true, s = 1) => `<g class="mc-art-lantern" transform="translate(${x} ${y}) scale(${s})">${lit ? `<circle r="70" fill="url(#GLOW)"/>` : ''}<path d="M-7 -17 Q-7 -32 0 -32 Q7 -32 7 -17" fill="none" stroke="#5e4e38" stroke-width="3"/><path d="M-14 -14 H14 L10 24 H-10Z" fill="${lit ? '#f9ca75' : '#293334'}" stroke="#674f35" stroke-width="4"/><path d="M-15 -14 H15 M-12 24 H12 M0 -12 V22" stroke="#493b2d" stroke-width="3"/>${lit ? '<ellipse cy="8" rx="4" ry="12" fill="#fff2b3"/>' : ''}</g>`;
    function rockies() { return `<path d="M0 340 L75 197 L119 236 L205 62 L287 187 L329 157 L440 295 L532 115 L594 179 L682 35 L756 139 L800 100 L890 257 L973 100 L1042 182 L1112 54 L1220 222 L1280 170 V540 H0Z" fill="#263b4c"/><path d="M119 236 L205 62 L287 187 L237 155 L224 180 L201 115 L175 174 L157 169Z M594 179 L682 35 L756 139 L713 113 L702 137 L680 79 L655 145 L633 139Z M1042 182 L1112 54 L1220 222 L1157 170 L1130 177 L1111 102 L1080 161Z" fill="#9aafb3" opacity=".65"/><path d="M0 461 L139 308 L239 359 L383 215 L551 411 L642 253 L801 398 L965 287 L1120 379 L1280 255 V560 H0Z" fill="#1b303b"/><path d="M0 471 Q150 418 260 465 Q420 418 525 471 Q700 427 890 466 Q1080 422 1280 471 V800 H0Z" fill="#1a292c"/>`; }
    function house(x, y, w, h, label, lit = false, cls = '') {
        let s = `<g class="${cls}" transform="translate(${x} ${y})"><path d="M0 0 H${w} V${h} H0Z" fill="#463b30" stroke="#172126" stroke-width="5"/>`;
        for (let yy = 0; yy < h; yy += 17)
            s += line(`M0 ${yy} H${w}`, '#211f1d', 2);
        s += rect(-12, -36, w + 24, 50, '#5d4b37') + rect(-4, -30, w + 8, 36, '#2c2b28') + text(w / 2, -7, label, Math.max(12, w / 12), '#c0a278', 'letter-spacing="2"');
        const door = w / 2 - 24;
        s += rect(door, h - 118, 48, 118, '#0b1820') + rect(door + 6, h - 112, 36, 105, '#3d382d') + rect(door + 13, h - 100, 22, 42, '#14252b');
        for (const xx of [18, w - 65]) {
            s += rect(xx, h - 126, 46, 65, '#101d22', 'stroke="#77634b" stroke-width="5"') + (lit ? rect(xx + 4, h - 122, 38, 57, '#bc8745', 'opacity=".65"') : '') + line(`M${xx + 23} ${h - 126} V${h - 61} M${xx} ${h - 94} H${xx + 46}`, '#463d2f', 4);
        }
        s += rect(-17, h - 30, w + 34, 13, '#70543c') + line(`M-10 ${h - 30} V${h + 60} M${w + 10} ${h - 30} V${h + 60}`, '#493e2d', 8) + rect(-24, h + 51, w + 48, 17, '#332d27') + '</g>';
        return s;
    }
    function indoors(id) { let s = rect(0, 0, 1440, 900, '#111a1e') + `<path d="M0 0 H1440 L1250 100 H190Z" fill="#191f21"/><path d="M0 0 L190 100 V580 L0 900Z" fill="#172126"/><path d="M1440 0 L1250 100 V580 L1440 900Z" fill="#121c20"/>` + rect(190, 100, 1060, 480, '#3a342b'); for (let x = 190; x < 1250; x += 35)
        s += line(`M${x} 100 V580`, '#1e2424', 3); s += `<path d="M190 580 H1250 L1440 900 H0Z" fill="#382e27"/>`; for (let x = -180; x < 1630; x += 140)
        s += line(`M${720 + (x - 720) * .74} 580 L${x} 900`, '#191f20', 3); for (let y = 610; y < 900; y += 42)
        s += line(`M0 ${y} H1440`, '#1c2423', 2); s += line('M110 0 V715 M1310 0 V715 M110 70 H1310', '#211f1a', 28) + rect(925, 155, 215, 230, '#0c2029', 'stroke="#70614b" stroke-width="14"') + line('M1033 155 V385 M925 270 H1140', '#443b2e', 10); s += lantern(725, 210, true, 1.1); return s; }
    function bild(ort, state = {}) {
        const id = 'mc' + (++nr), s = state.geloest || {}, w = state.wahl || {}, night = state.morgen ? 1 : 0;
        let a = `<defs><linearGradient id="${id}sky" x2="0" y2="1"><stop stop-color="#101f31"/><stop offset=".65" stop-color="#4f5b63"/><stop offset="1" stop-color="#a68d68"/></linearGradient><radialGradient id="${id}glow"><stop stop-color="#ffcd78" stop-opacity=".45"/><stop offset="1" stop-color="#ffb957" stop-opacity="0"/></radialGradient><radialGradient id="${id}edge"><stop offset=".2" stop-color="#040b10" stop-opacity="0"/><stop offset="1" stop-color="#04090d" stop-opacity=".74"/></radialGradient><linearGradient id="${id}gold" x2="1" y2="1"><stop stop-color="#dfb568"/><stop offset=".4" stop-color="#75603c"/><stop offset=".7" stop-color="#c89d4c"/><stop offset="1" stop-color="#50422d"/></linearGradient></defs>`;
        if (['bahnhof', 'strasse', 'foerderhaus', 'kapelle'].includes(ort)) {
            a += rect(0, 0, 1440, 900, `url(#${id}sky)`) + `<circle cx="1120" cy="155" r="41" fill="#d0d6cf" opacity=".4"/><path d="M200 160 Q700 80 1400 190 V270 Q800 150 200 220Z" fill="#172b3a" opacity=".7"/>` + rockies();
        }
        else if (['saloon', 'sheriff', 'bank'].includes(ort))
            a += indoors(id);
        else {
            a += rect(0, 0, 1440, 900, '#101a1d') + `<path d="M0 0 L210 80 L340 5 L510 75 L685 2 L790 70 L1020 0 L1130 95 L1440 10 V900 H0Z" fill="#253231"/><path d="M0 900 L230 610 L1210 610 L1440 900Z" fill="#34332c"/>`;
            for (let layer = 4; layer >= 0; layer--) {
                const k = 1 - layer * .15, x = 720 - 500 * k, y = 380 - 300 * k;
                a += `<g opacity="${.25 + k * .5}"><path d="M${x} 880 V${y + 30} L${x + 80} ${y} H${1440 - x - 80} L${1440 - x} ${y + 30} V880" fill="#0c191d" stroke="#514c3a" stroke-width="${28 * k}"/><path d="M${x} ${y + 45} L${x + 90} ${y + 160} M${1440 - x} ${y + 45} L${1440 - x - 90} ${y + 160}" stroke="#514731" stroke-width="${18 * k}"/></g>`;
            }
        }
        if (ort === 'bahnhof') {
            a += `<path d="M0 720 L1440 600 V900 H0Z" fill="#3d3830"/><path d="M0 835 L1440 650 M0 877 L1440 677" stroke="#758081" stroke-width="7"/>`;
            for (let x = 0; x < 1440; x += 65)
                a += line(`M${x} ${820 - x * .12} l8 60`, '#201f1d', 15);
            a += house(780, 300, 380, 310, 'MERCY CREEK', true) + line('M1150 330 V120 M1110 150 H1190 M1120 180 H1180', '#252b2b', 9);
            a += `<g class="mc-art-train"><path d="M-100 510 H520 V735 H-100Z" fill="#233237" stroke="#0f1b22" stroke-width="8"/><path d="M-100 500 H537 V529 H-100Z" fill="#111e25"/>` + Array.from({ length: 5 }, (_, i) => rect(i * 105 + 5, 555, 68, 94, '#b29157', 'stroke="#0d1b22" stroke-width="8"')).join('') + `<path d="M0 690 H510" stroke="#806443" stroke-width="4"/>` + [40, 170, 350, 470].map(x => `<circle cx="${x}" cy="737" r="34" fill="#111b20" stroke="#465152" stroke-width="7"/>`).join('') + `</g>`;
            a += `<g transform="translate(610 520)"><rect width="175" height="142" fill="#283c3a" stroke="#7b7050" stroke-width="5"/>` + [0, 1, 2, 3].map(i => `<path d="M${28 + i * 39} 40 V90" stroke="#101d23" stroke-width="6"/><path class="mc-art-lever" d="M${28 + i * 39} 62 l${i % 2 ? 13 : -13} -27" stroke="#b09961" stroke-width="8"/>`).join('') + `<text x="88" y="125" text-anchor="middle" font-size="12" fill="#c3b07d">STELLWERK · 04:13</text></g>`;
            a += `<g transform="translate(240 680) rotate(-9)"><rect width="145" height="95" rx="8" fill="#68472f" stroke="#281e1b" stroke-width="7"/><path d="M43 0 V95 M105 0 V95 M50 -3 Q70 -24 92 -3" fill="none" stroke="#251f1c" stroke-width="9"/></g>` + lantern(1180, 450, true, .8);
        }
        else if (ort === 'strasse') {
            a += `<path d="M570 470 L870 470 L1330 900 H50Z" fill="#4b483b"/><path d="M620 490 L230 900 M820 490 L1210 900" fill="none" stroke="#a2a592" stroke-width="7" opacity=".2"/>`;
            a += house(-35, 300, 350, 330, 'SHERIFF', false) + house(319, 350, 227, 215, 'BANK', s.tresor) + house(945, 265, 420, 365, 'THE LAST DOLLAR', true) + house(770, 385, 170, 180, 'ASSAY OFFICE', false);
            a += `<g transform="translate(695 658)"><ellipse rx="105" ry="32" fill="#172a2e" stroke="#777460" stroke-width="13"/><path d="M-105 0 V80 Q0 125 105 80 V0" fill="#46504a"/><path d="M-100 29 Q0 70 100 29 M-95 61 Q0 100 95 61" fill="none" stroke="#1f3130" stroke-width="5"/><path d="M-95 -16 V-190 L0 -237 L95 -190 V-16" fill="none" stroke="#4a3d2d" stroke-width="14"/><path d="M-120 -183 L0 -250 L120 -183Z" fill="#2c2b25"/><path d="M0 -200 V-30" stroke="#948b65" stroke-width="3"/></g>`;
            a += person(1012, 520, 1.2, 'mc-art-vane') + line('M1260 600 V835 M1200 638 H1355', '#554a35', 9) + text(1270, 631, 'PASSSTRASSE', 15, '#c1ae7b');
            if (s.schichten)
                a += Array.from({ length: 13 }, (_, i) => person(400 + i * 48, 560, .47) + lantern(411 + i * 48, 540, true, .27)).join('');
        }
        else if (ort === 'saloon') {
            a += `<path d="M230 487 H1220 L1350 660 H100Z" fill="#65503c"/><path d="M100 660 H1350 V735 H100Z" fill="#382e27"/>` + line('M190 735 V900 M1260 735 V900', '#1c2322', 24);
            a += `<g transform="translate(360 390)"><rect width="280" height="240" rx="8" fill="#3e2d24" stroke="#171e20" stroke-width="8"/><rect x="17" y="28" width="246" height="112" fill="#181f21"/>` + line('M30 55 H250 M30 83 H250 M30 111 H250', '#5c4935', 3) + `<g class="mc-art-roll"><circle cx="50" cy="84" r="24" fill="#a78c59"/><circle cx="230" cy="84" r="24" fill="#a78c59"/><path d="M50 65 H230 V104 H50Z" fill="#b5a174"/><path d="M75 72 V84 M98 84 V97 M124 70 V81 M151 78 V90 M183 85 V98 M209 69 V82" stroke="#4e4532" stroke-width="4"/></g>` + Array.from({ length: 15 }, (_, i) => rect(17 + i * 16.5, 161, 16, 52, '#c9c4a4', 'class="mc-art-key" stroke="#463a2c" stroke-width="1" style="animation-delay:' + i * .13 + 's"')).join('') + `</g>`;
            a += rect(930, 144, 220, 235, '#666f66', 'stroke="#8b714c" stroke-width="15"') + `<path class="mc-art-reflection" d="M1000 347 V270 Q1032 235 1062 270 V347Z" fill="#18262b" opacity=".7"/>`;
            for (const x of [760, 1050])
                a += `<ellipse cx="${x}" cy="620" rx="88" ry="28" fill="#7b5b3c"/><path d="M${x} 643 V860" stroke="#2a2924" stroke-width="23"/><path d="M${x - 66} 658 V786 M${x + 67} 658 V786 M${x - 66} 786 H${x + 67}" stroke="#483b2d" stroke-width="11"/>`;
            a += `<g class="mc-art-chair" transform="translate(1020 650)"><path d="M-50 0 H50 V120 H-50Z" fill="none" stroke="#5b4b32" stroke-width="11"/><path d="M-50 56 H50 M-50 120 L-65 180 M50 120 L65 180" stroke="#5b4b32" stroke-width="12"/></g>` + rect(870, 570, 25, 45, '#c3aa6c', 'opacity=".45"');
        }
        else if (ort === 'sheriff') {
            a += rect(208, 149, 310, 420, '#0c1a20', 'stroke="#6d6852" stroke-width="13"');
            for (let x = 230; x < 510; x += 31)
                a += line(`M${x} 149 V569`, '#778077', 7);
            a += line('M212 270 H514 M212 460 H514', '#616d67', 6) + rect(270, 478, 190, 22, '#554c37');
            a += `<path d="M558 530 H1120 L1280 738 H480Z" fill="#69533a"/><path d="M480 738 H1280 V767 H480Z" fill="#302c25"/>`;
            a += `<g transform="translate(650 535)"><rect width="210" height="130" fill="#243d3c" stroke="#0b1c23" stroke-width="6"/><circle cx="65" cy="64" r="43" fill="#967b45"/><path class="mc-art-telegraph" d="M104 55 L177 28" stroke="#bba36a" stroke-width="10"/><circle cx="177" cy="28" r="12" fill="#141f24"/></g>` + rect(930, 544, 120, 80, '#b2a077', 'transform="rotate(8 930 544)"') + text(1050, 294, '14 NOV 1891', 17, '#b9b49b');
        }
        else if (ort === 'bank') {
            a += `<g transform="translate(630 320)"><rect x="-190" y="-125" width="395" height="360" rx="20" fill="#364646" stroke="#15252b" stroke-width="18"/><rect class="mc-art-vault" x="-175" y="-110" width="365" height="330" rx="12" fill="#4f5e56" stroke="#b09b65" stroke-width="7"/><circle cx="8" cy="26" r="82" fill="#243b3f" stroke="#a69465" stroke-width="10"/><path d="M8 -49 V101 M-67 26 H83 M-45 -27 L61 79 M-45 79 L61 -27" stroke="#9f8e60" stroke-width="11"/><circle cx="8" cy="26" r="19" fill="#c1ab72"/></g>`;
            a += `<path d="M200 610 H1150 L1380 825 H90Z" fill="#5e4935"/>` + rect(270, 565, 220, 130, '#b9aa83', 'transform="rotate(-5 270 565)"') + text(370, 604, 'BLACKWATER', 16, '#4a4537');
            if (w.gold !== 'nehmen')
                a += `<g class="mc-art-gold"><path d="M720 570 H862 L886 630 H697Z" fill="url(#${id}gold)" stroke="#78613b" stroke-width="4"/><path d="M698 630 V660 H886 V630" fill="#97763a"/>${text(791, 616, '18 KG', 17, '#473d27')}</g>`;
            a += rect(1030, 310, 150, 140, '#b7a379', 'transform="rotate(3 1030 310)"') + text(1105, 355, 'TESTAMENT', 17, '#493e2a');
        }
        else if (ort === 'foerderhaus') {
            a += `<path d="M410 900 L450 356 H990 L1030 900Z" fill="#111e23"/><path d="M440 900 L520 55 H920 L1000 900 M520 55 L995 890 M920 55 L444 890 M505 190 H940 M488 400 H962" fill="none" stroke="#504837" stroke-width="24"/><circle cx="720" cy="150" r="96" fill="#223337" stroke="#8b8060" stroke-width="13"/><path class="mc-art-wheel" d="M720 54 V246 M624 150 H816 M650 80 L790 220 M650 220 L790 80" stroke="#786e4f" stroke-width="10"/>`;
            a += `<path d="M687 150 V730 M753 150 V730" stroke="#9a9477" stroke-width="4"/><g class="mc-art-cage"><path d="M610 515 H830 V780 H610Z" fill="#162b30" stroke="#807454" stroke-width="10"/>` + Array.from({ length: 7 }, (_, i) => line(`M${625 + i * 31} 527 V768`, '#526965', 5)).join('') + `<path d="M610 650 H830" stroke="#897957" stroke-width="7"/></g>`;
            a += `<g transform="translate(170 430)"><rect width="200" height="235" fill="#34483f" stroke="#172a2d" stroke-width="7"/>` + [0, 1, 2].map(i => `<circle cx="${43 + i * 57}" cy="77" r="24" fill="none" stroke="#a77c49" stroke-width="7"/><path d="M${43 + i * 57} 50 V104 M${19 + i * 57} 77 H${67 + i * 57}" stroke="#8c6e44" stroke-width="4"/>`).join('') + text(100, 175, 'DRAINAGE', 16, '#c2b281') + '</g>';
            if (w.mara !== 'retten')
                a += person(1088, 720, .85, 'mc-art-mara') + line('M980 710 L1170 747', '#5d513a', 32);
            a += lantern(1115, 630, true, .65) + rect(1090, 250, 160, 130, '#9d9e7c');
        }
        else if (ort === 'stollen') {
            a += line('M420 900 L650 610 M1040 900 L790 610', '#7d7c68', 7);
            for (let y = 640; y < 900; y += 40)
                a += line(`M${620 - (y - 610) * .7} ${y} H${820 + (y - 610) * .7}`, '#443b29', 15);
            a += `<path d="M75 150 L130 197 L95 270 L160 342 M1270 10 L1210 90 L1300 187 L1230 260" stroke="#8c7344" opacity=".4" fill="none" stroke-width="5"/>` + lantern(410, 330, true, .9) + lantern(965, 485, true, .5);
            a += `<path d="M1000 700 Q1035 620 1080 700 L1090 720 H985Z" fill="#827a54" stroke="#292f2b" stroke-width="7"/>` + rect(257, 320, 140, 105, '#9f9876', 'transform="rotate(-6 257 320)"');
            if (w.mara === 'retten')
                a += person(1080, 720, 1.1, 'mc-art-mara');
            a += `<g class="mc-art-drops">` + Array.from({ length: 11 }, (_, i) => `<path d="M${230 + i * 83} ${130 + i % 3 * 60} v11" stroke="#91b1ae" opacity=".3" stroke-width="2" style="animation-delay:-${i * .31}s"/>`).join('') + '</g>';
        }
        else if (ort === 'kammer') {
            a += `<path d="M90 70 L380 120 L450 60 L530 189 L670 128 L780 230 L1000 170 L1220 270 L1390 120" fill="none" stroke="#b49348" stroke-width="12" opacity=".6"/><path d="M140 150 L330 200 L500 160 L710 310 L1030 260 L1370 390" fill="none" stroke="#75633d" stroke-width="5"/>`;
            a += `<path d="M270 445 H940 L1150 675 H190Z" fill="#5b4a35"/><path d="M190 675 H1150 V710 H190Z" fill="#302f26"/><path d="M280 710 V875 M1010 710 V875" stroke="#252a24" stroke-width="30"/>`;
            a += rect(350, 385, 260, 190, '#ad9c72', 'transform="rotate(-5 350 385)"') + text(470, 431, 'LETZTE SCHICHT', 17, '#443d2b') + Array.from({ length: 5 }, (_, i) => line(`M370 ${455 + i * 19} H580`, '#5c583e', 2)).join('');
            a += `<g transform="translate(860 430)"><rect width="210" height="180" fill="#263d39" stroke="#816d43" stroke-width="6"/>` + [0, 1, 2, 3].map(i => line(`M15 ${25 + i * 42} H195`, ['#a99468', '#586d60', '#ae7c51', '#8ca090'][i], 5)).join('') + text(105, 157, 'ZÜNDLEITUNG', 15, '#d1b87b') + '</g>';
            a += `<path d="M725 500 Q650 590 705 780 L805 780 Q865 590 795 500Z" fill="#1e2625"/><path d="M713 510 L688 655 M793 510 L826 655" stroke="#141d1f" stroke-width="20"/>` + lantern(1160, 480, true, .9);
        }
        else if (ort === 'kapelle') {
            a += `<path d="M110 900 L260 290 L720 110 L1180 290 L1330 900Z" fill="#2d3631"/><path d="M230 900 V260 L720 38 L1210 260 V900" fill="#242d2c" stroke="#4a4b3b" stroke-width="20"/><path d="M340 900 V310 L720 146 L1100 310 V900Z" fill="#18262b"/>`;
            a += `<path d="M340 350 H1100 L1000 900 H440Z" fill="#494235"/><path d="M180 880 H1260 L1160 760 H280Z" fill="#5a4c39"/><path d="M320 330 H1120 M380 330 V495 M1060 330 V495" stroke="#5d563d" stroke-width="12"/>`;
            a += `<g class="mc-art-bell" transform="translate(720 312)"><path d="M-88 60 Q-65 30 -58 -60 Q0 -119 58 -60 Q65 30 88 60Z" fill="url(#${id}gold)" stroke="#998452" stroke-width="7"/><ellipse cy="62" rx="90" ry="22" fill="#252f2b" stroke="#a18b55" stroke-width="7"/><path d="M0 10 V82" stroke="#b4a575" stroke-width="8"/><circle cy="78" r="13" fill="#a79b6b"/></g>`;
            a += line('M720 390 V640', '#9e8b5f', 4) + `<path d="M560 635 H880 L945 720 H495Z" fill="#71654a"/><path d="M495 720 H945 V765 H495Z" fill="#454331"/>` + rect(630, 623, 165, 80, '#b6aa7b', 'transform="rotate(-4 630 623)"') + text(718, 663, 'DAS ERBE', 16, '#443d2c');
            a += rect(320, 280, 140, 225, '#43606a', 'stroke="#8c7955" stroke-width="8"') + line('M390 280 V505 M320 384 H460', '#756543', 6);
            if (w.mara === 'retten')
                a += person(1040, 680, 1.05, 'mc-art-mara');
            if (!s.glocke)
                a += person(310, 680, 1.2, 'mc-art-vane');
            a += lantern(480, 615, true, .7) + lantern(980, 615, true, .7);
        }
        const bildKey = ort === 'bank' && s.tresor ? (w.gold === 'nehmen' ? 'bank_leer' : 'bank_offen') : ort;
        if (Clavis.FrontierBilder?.[bildKey]) {
            a = `<defs><radialGradient id="${id}glow"><stop stop-color="#ffcf7d" stop-opacity=".35"/><stop offset="1" stop-color="#ffcf7d" stop-opacity="0"/></radialGradient></defs><image href="${Clavis.FrontierBilder[bildKey]}" width="1440" height="900" preserveAspectRatio="none"/>`;
            const halo = (x, y, r) => `<ellipse class="mc-art-lampglow" cx="${x}" cy="${y}" rx="${r}" ry="${r * .85}" fill="url(#${id}glow)"/>`;
            if (ort === 'bahnhof')
                a += halo(1260, 325, 170) + halo(930, 620, 90);
            if (ort === 'strasse') {
                a += halo(1260, 475, 120);
                if (!s.glocke)
                    a += person(1210, 580, .9, 'mc-art-vane');
                if (s.schichten)
                    a += Array.from({ length: 13 }, (_, i) => person(485 + i * 29, 535, .35) + lantern(491 + i * 29, 527, true, .2)).join('');
            }
            if (ort === 'saloon')
                a += halo(810, 190, 220) + `<g class="mc-art-reflection">${person(1115, 330, .7) + person(1185, 327, .65) + person(1050, 330, .6)}</g>`;
            if (ort === 'sheriff')
                a += halo(975, 650, 190) + halo(900, 130, 130);
            if (ort === 'bank')
                a += halo(685, 170, 250);
            if (ort === 'foerderhaus') {
                a += halo(760, 595, 150) + halo(1265, 290, 150);
                if (w.mara !== 'retten')
                    a += person(1220, 745, 1.05, 'mc-art-mara') + line('M1120 753 L1350 800', '#594b34', 26);
            }
            if (ort === 'stollen') {
                a += halo(455, 280, 150) + halo(1120, 405, 110);
                a += '<g class="mc-art-drops">' + Array.from({ length: 8 }, (_, i) => `<path d="M${310 + i * 110} ${90 + i % 3 * 60} v13" stroke="#adc8bb" opacity=".4" stroke-width="2" style="animation-delay:-${i * .3}s"/>`).join('') + '</g>';
                if (w.mara === 'retten')
                    a += person(1105, 785, 1.1, 'mc-art-mara');
            }
            if (ort === 'kammer')
                a += halo(1310, 430, 180);
            if (ort === 'kapelle') {
                a += halo(1130, 470, 110) + halo(565, 490, 110);
                if (!s.glocke)
                    a += person(255, 730, 1.1, 'mc-art-vane');
                if (w.mara === 'retten')
                    a += person(1155, 740, 1, 'mc-art-mara');
            }
        }
        else
            a += rect(0, 0, 1440, 900, `url(#${id}edge)`);
        const names = { bahnhof: 'Verschneiter Bahnhof unter den Rocky Mountains', strasse: 'Verlassene Westernstadt zwischen Berggipfeln', saloon: 'Saloon mit mechanischem Klavier und blindem Spiegel', sheriff: 'Sheriffbüro mit Telegraf und Gefängniszelle', bank: 'Banktresor und ein einzelner Goldbarren', foerderhaus: 'Förderturm, Pumpen und Drahtkorb', stollen: 'Tiefer Holzstollen unter den Rocky Mountains', kammer: 'Goldader und die verschollenen Schichtbücher', kapelle: 'Glockenwerk in einer Bergkapelle' };
        return `<svg viewBox="0 0 1440 900" preserveAspectRatio="none" role="img" aria-label="${names[ort] || 'Mercy Creek'}" xmlns="http://www.w3.org/2000/svg">${a.replace(/url\(#GLOW\)/g, `url(#${id}glow)`)}</svg>`;
    }
    return { bild };
})();
