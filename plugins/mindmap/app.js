'use strict';
/*
 * Mindmap – die wichtigsten Begriffe deiner Unterlagen. Übersicht: Fächer links und rechts, in der Mitte die Brücken
 * (Begriffe, die in mehreren Fächern vorkommen). Je Fach eine eigene Ansicht. Ein Klick zeigt Fundstellen und verwandte
 * Begriffe; „Erklären lassen“ stellt Lyra die Frage im Chat. Lyra berechnet die Mindmap lokal (dauert beim ersten Mal).
 */
const { h } = lyra;

const FARBEN = ['#6157f0', '#0ea5e9', '#14b8a6', '#f59e0b', '#e5488a', '#22a06b', '#8b5cf6', '#ef6c3a', '#0891b2', '#a16207'];

const z = { daten: null, fehler: null, fokus: null, gewaehlt: null, alle: false, suche: '', treffer: [] };
const app = document.getElementById('app');

const farbe = (fach) => {
  const i = z.daten ? z.daten.faecher.slice().sort((a, b) => a.localeCompare(b, 'de')).indexOf(fach) : 0;
  return FARBEN[(i < 0 ? 0 : i) % FARBEN.length];
};

async function start() {
  lyra.bei('zurueck', () => {
    if (z.gewaehlt !== null) { z.gewaehlt = null; zeichnen(); }
    else if (z.fokus !== null) { z.fokus = null; z.alle = false; zeichnen(); }
    else lyra.zurueck();
  });
  lyra.bei('einstellungen', () => lyra.dialog('Mindmap', h('p', {}, 'Die Mindmap entsteht aus den Ordnern, die du in Lyras Einstellungen freigegeben hast. Neue Unterlagen kommen nach dem nächsten Einlesen dazu.')));
  window.addEventListener('resize', () => linien());
  zeichnen();
  try {
    z.daten = await lyra.mindmap();
  } catch (e) {
    z.fehler = String((e && e.message) || e);
  }
  const route = decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('fach/') && z.daten) z.fokus = route.slice(5);
  zeichnen();
}

const begriffe = () => (z.daten ? z.daten.begriffe : []);
const nachGewicht = (liste) => liste.slice().sort((a, b) => b.b.gewicht - a.b.gewicht);
const mitIndex = () => begriffe().map((b, i) => ({ b, i }));

function waehlen(i) {
  z.gewaehlt = i;
  z.suche = '';
  z.treffer = [];
  const b = begriffe()[i];
  // Ist der Begriff in der aktuellen Ansicht nicht zu sehen, zum passenden Fach wechseln
  if (z.fokus !== null && !b.faecher.includes(z.fokus)) z.fokus = b.faecher[0] || null;
  if (z.fokus === null && b.faecher.length < 2) z.fokus = b.faecher[0] || null;
  zeichnen();
}

function zeichnen() {
  const alt = document.querySelector('.flaeche-mm');
  const pos = alt ? alt.scrollTop : 0;
  app.replaceChildren(ansicht());
  const neu = document.querySelector('.flaeche-mm');
  if (neu) neu.scrollTop = pos;
  requestAnimationFrame(linien);
  lyra.titel(z.fokus || (z.daten ? `${z.daten.faecher.length} Fächer` : ''));
}

function ansicht() {
  if (z.fehler) return h('div', { class: 'seite' }, lyra.fehlerBox('Die Mindmap konnte nicht berechnet werden: ' + z.fehler));
  if (!z.daten) {
    return h('div', { class: 'mm', style: { alignItems: 'center', justifyContent: 'center' } },
      h('div', { class: 'lade' }), h('p', { class: 'leise', style: { marginTop: '14px' } }, 'Die Mindmap wird aus deinen Unterlagen berechnet …'),
      h('p', { class: 'leise klein' }, 'Beim ersten Mal dauert das einige Sekunden.'));
  }
  if (!z.daten.begriffe.length) return h('div', { class: 'seite' }, h('p', { class: 'leise' }, 'Noch keine Begriffe – lies zuerst deine Unterlagen ein.'));
  const reiter = h('div', { class: 'reiter' },
    h('button', { class: 'chip' + (z.fokus === null ? ' an' : ''), onclick: () => { z.fokus = null; z.alle = false; zeichnen(); } }, 'Übersicht'),
    z.daten.faecher.map((f) => h('button', { class: 'chip' + (z.fokus === f ? ' an' : ''), style: { '--f': farbe(f) }, onclick: () => { z.fokus = f; z.alle = false; z.gewaehlt = null; zeichnen(); } }, f)),
    h('input', {
      class: 'eingabe suche', placeholder: 'Begriff suchen …', value: z.suche,
      oninput: (e) => {
        z.suche = e.target.value;
        const s = z.suche.trim().toLowerCase();
        z.treffer = s ? mitIndex().filter((x) => x.b.name.toLowerCase().includes(s)).slice(0, 12) : [];
        trefferZeigen();
      },
      onkeydown: (e) => { if (e.key === 'Enter' && z.treffer[0]) waehlen(z.treffer[0].i); },
    }));
  const flaeche = h('div', { class: 'flaeche-mm' }, z.fokus === null ? uebersicht() : fachAnsicht(z.fokus), details());
  return h('div', { class: 'mm' }, reiter, flaeche);
}

function trefferZeigen() {
  document.querySelectorAll('.treffer').forEach((e) => e.remove());
  if (!z.treffer.length) return;
  const box = h('div', { class: 'treffer' }, z.treffer.map(({ b, i }) =>
    h('button', { onclick: () => waehlen(i) }, b.name, h('span', { class: 'leise klein' }, '  ' + b.faecher.join(', ')))));
  document.querySelector('.flaeche-mm').appendChild(box);
}

function knoten(x, extra) {
  const { b, i } = x;
  const andere = b.faecher.filter((f) => f !== z.fokus);
  return h('button', {
    class: 'begriff' + (b.faecher.length > 1 ? ' bruecke' : '') + (z.gewaehlt === i ? ' gewaehlt' : ''),
    'data-i': i, title: b.faecher.join(' · '), onclick: () => waehlen(i), ...extra,
  }, (z.fokus === null ? b.faecher : andere).slice(0, 4).map((f) => h('span', { class: 'pkt', style: { '--f': farbe(f) } })), b.name);
}

function uebersicht() {
  const faecher = z.daten.faecher;
  const links = faecher.filter((_, i) => i % 2 === 0);
  const rechts = faecher.filter((_, i) => i % 2 === 1);
  const bruecken = nachGewicht(mitIndex().filter((x) => x.b.faecher.length > 1));
  // So viele, wie ins Fenster passen – der Rest mit „Alle zeigen“
  const passend = Math.max(8, Math.floor((window.innerHeight - 170) / 42));
  const zeigen = z.alle ? bruecken : bruecken.slice(0, passend);
  const fach = (f) => h('button', { class: 'fach', 'data-fach': f, style: { '--f': farbe(f) }, onclick: () => { z.fokus = f; zeichnen(); } }, f);
  return h('div', { class: 'karte-mm' },
    h('div', { class: 'spalte-mm links' }, links.map(fach)),
    h('div', { class: 'spalte-mm' },
      bruecken.length ? h('div', { class: 'leise klein fett', style: { marginBottom: '4px' } }, `${bruecken.length} Querbezüge zwischen den Fächern`) : h('p', { class: 'leise' }, 'Noch keine Begriffe, die in mehreren Fächern vorkommen.'),
      zeigen.map((x) => knoten(x)),
      bruecken.length > zeigen.length ? h('button', { class: 'knopf text klein mehr', onclick: () => { z.alle = true; zeichnen(); } }, `Alle ${bruecken.length} zeigen`) : null),
    h('div', { class: 'spalte-mm rechts' }, rechts.map(fach)));
}

function fachAnsicht(fach) {
  const liste = nachGewicht(mitIndex().filter((x) => x.b.faecher.includes(fach)));
  // Brücken zuerst, dann nach Gewicht
  liste.sort((a, b) => (b.b.faecher.length > 1) - (a.b.faecher.length > 1) || b.b.gewicht - a.b.gewicht);
  const zeigen = z.alle ? liste : liste.slice(0, 2 * Math.max(8, Math.floor((window.innerHeight - 140) / 42)));
  const links = zeigen.filter((_, i) => i % 2 === 0);
  const rechts = zeigen.filter((_, i) => i % 2 === 1);
  return h('div', { class: 'karte-mm' },
    h('div', { class: 'spalte-mm links' }, links.map((x) => knoten(x))),
    h('div', { class: 'spalte-mm' },
      h('button', { class: 'fach gross', 'data-fach': fach, style: { '--f': farbe(fach) } }, fach),
      h('div', { class: 'leise klein', style: { marginTop: '8px' } }, `${liste.length} Begriffe`),
      liste.length > zeigen.length ? h('button', { class: 'knopf text klein mehr', onclick: () => { z.alle = true; zeichnen(); } }, `Alle ${liste.length} zeigen`) : null),
    h('div', { class: 'spalte-mm rechts' }, rechts.map((x) => knoten(x))));
}

/** Verbindungslinien als weiche Kurven – nach dem Aufbau aus den echten Positionen berechnet. */
function linien() {
  const karte = document.querySelector('.karte-mm');
  if (!karte) return;
  karte.querySelectorAll('svg.linien').forEach((e) => e.remove());
  const r0 = karte.getBoundingClientRect();
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'linien');
  svg.setAttribute('width', karte.scrollWidth);
  svg.setAttribute('height', karte.scrollHeight);
  const pfad = (a, b, f, staerke) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const linksVon = ra.left + ra.width / 2 < rb.left + rb.width / 2;
    const x1 = (linksVon ? ra.right : ra.left) - r0.left;
    const y1 = ra.top + ra.height / 2 - r0.top;
    const x2 = (linksVon ? rb.left : rb.right) - r0.left;
    const y2 = rb.top + rb.height / 2 - r0.top;
    const dx = (x2 - x1) * 0.5;
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', f);
    p.setAttribute('stroke-opacity', '0.45');
    p.setAttribute('stroke-width', staerke);
    svg.appendChild(p);
  };
  const begriffKnoten = [...karte.querySelectorAll('.begriff[data-i]')];
  if (z.fokus === null) {
    const faecher = Object.fromEntries([...karte.querySelectorAll('.fach[data-fach]')].map((e) => [e.dataset.fach, e]));
    for (const e of begriffKnoten) {
      const b = begriffe()[+e.dataset.i];
      for (const f of b.faecher) if (faecher[f]) pfad(faecher[f], e, farbe(f), z.gewaehlt === +e.dataset.i ? 2.5 : 1.3);
    }
  } else {
    const mitte = karte.querySelector('.fach[data-fach]');
    for (const e of begriffKnoten) pfad(mitte, e, farbe(z.fokus), z.gewaehlt === +e.dataset.i ? 2.5 : 1.3);
  }
  karte.prepend(svg);
}

function details() {
  if (z.gewaehlt === null) return null;
  const b = begriffe()[z.gewaehlt];
  if (!b) return null;
  const verwandt = (b.verwandt || []).map((i) => ({ b: begriffe()[i], i })).filter((x) => x.b).slice(0, 10);
  return h('div', { class: 'details' },
    h('div', { class: 'zeile' }, h('h3', { class: 'wachsen' }, b.name),
      h('button', { class: 'knopf symbol', title: 'Schließen', onclick: () => { z.gewaehlt = null; zeichnen(); } }, '✕')),
    h('div', { class: 'zeile umbruch', style: { gap: '6px', margin: '8px 0 12px' } },
      b.faecher.map((f) => h('span', { class: 'etikett', style: { '--farbe': farbe(f) } }, f))),
    h('button', { class: 'knopf', style: { width: '100%', marginBottom: '14px' },
      onclick: () => lyra.fragen(`Was ist „${b.name}“? Erkläre es mir – und wie es in meinen Fächern vorkommt.`) }, 'Erklären lassen'),
    (b.stellen || []).length ? h('div', {}, h('div', { class: 'ueberschrift-klein', style: { marginBottom: '6px' } }, 'Fundstellen'),
      b.stellen.slice(0, 6).map((q) => h('button', { class: 'stelle', onclick: () => lyra.oeffnen(q) },
        h('div', { class: 'fett' }, q.seite ? `${q.titel} · S. ${q.seite}` : q.titel),
        q.auszug ? h('div', { class: 'leise', style: { marginTop: '2px' } }, q.auszug.slice(0, 140) + (q.auszug.length > 140 ? ' …' : '')) : null))) : null,
    verwandt.length ? h('div', { style: { marginTop: '12px' } }, h('div', { class: 'ueberschrift-klein', style: { marginBottom: '6px' } }, 'Verwandte Begriffe'),
      h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, verwandt.map((x) => h('button', { class: 'chip', onclick: () => waehlen(x.i) }, x.b.name)))) : null);
}

start();
