'use strict';
/*
 * Quizzard Online im Browser – für alle ohne Lyra und ohne Konto. Name eingeben, mitspielen. Die Seite kommt von der Lyra
 * des Hosts (über einen Tunnel) und spricht nur mit ihr (api/beitreten, api/warten, api/senden).
 * Ende-zu-Ende-verschlüsselt: Der Schlüssel steht im Link hinter „#k=“ – diesen Teil schickt der Browser nie an einen
 * Server. Alles, was hin- und hergeht (Name, Fragen, Antworten), ist mit AES-256-GCM verschlüsselt.
 */
(() => {
  const wurzel = document.getElementById('spiel');
  const basis = location.pathname.endsWith('/') ? location.pathname : location.pathname.replace(/[^/]*$/, '');
  const api = (p) => basis + 'api/' + p;
  const merk = 'qo:' + basis;
  let sitzung = null; // {token, id, name, seit}
  let spieler = null;
  let aus = false;
  let schluessel = null;

  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64lesen = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

  async function schluesselLaden() {
    const m = location.hash.match(/k=([A-Za-z0-9_-]+)/);
    if (!m || !(window.crypto && crypto.subtle)) return null;
    try { return await crypto.subtle.importKey('raw', b64lesen(m[1]), 'AES-GCM', false, ['encrypt', 'decrypt']); } catch (_) { return null; }
  }

  async function verschluesseln(v) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const d = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, schluessel, new TextEncoder().encode(JSON.stringify(v)));
    return { iv: b64(iv), d: b64(d) };
  }

  async function entschluesseln(g) {
    const klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64lesen(g.iv) }, schluessel, b64lesen(g.d));
    return JSON.parse(new TextDecoder().decode(klar));
  }

  try { sitzung = JSON.parse(sessionStorage.getItem(merk) || 'null'); } catch (_) {}

  function el(tag, attr, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kinder.flat()) if (k != null) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }

  function beitretenZeigen(fehler = '') {
    const name = el('input', { class: 'qo-eingabe', maxlength: '24', placeholder: 'Dein Name', autocomplete: 'nickname', enterkeyhint: 'go' });
    const knopf = el('button', { class: 'qo-knopf', type: 'submit' }, 'Mitspielen');
    const meldung = el('p', { class: 'qo-fehler' }, fehler);
    const formular = el('form', { class: 'qo-beitreten', onsubmit: async (e) => {
      e.preventDefault();
      const n = name.value.trim();
      if (!n) { meldung.textContent = 'Bitte gib einen Namen ein.'; return; }
      knopf.disabled = true;
      meldung.textContent = '';
      try {
        const r = await fetch(api('beitreten'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geheim: await verschluesseln({ name: n }) }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.fehler || 'Beitreten ging nicht.');
        const g = await entschluesseln(j.geheim);
        sitzung = { token: j.token, id: j.id, name: g.name, seit: j.seit || 0, titel: g.titel || '' };
        try { sessionStorage.setItem(merk, JSON.stringify(sitzung)); } catch (_) {}
        spielen();
      } catch (err) {
        meldung.textContent = /fetch|network|load failed/i.test(err.message) ? 'Keine Verbindung zum Spiel – ist es noch offen?' : err.message;
        knopf.disabled = false;
      }
    } }, name, knopf, meldung);
    wurzel.replaceChildren(el('div', { class: 'qo-spieler' },
      el('div', { class: 'qo-kopf' }, el('span', { class: 'qo-marke' }, 'Quizzard Online')),
      el('div', { class: 'qo-mitte' },
        el('div', { class: 'qo-gross-symbol qo-schweben' }, '🧙'),
        el('h1', {}, 'Mitspielen'),
        el('p', { class: 'qo-leise' }, 'Gib einen Namen ein – er erscheint in der Rangliste. Kein Konto, keine App nötig.'),
        formular,
        el('p', { class: 'qo-fuss' }, '🔒 Ende-zu-Ende-verschlüsselt mit dem Schlüssel aus deinem Link. Die Seite kommt von der Lyra des Hosts; gespeichert wird nur dein Name für dieses Spiel.'))));
    setTimeout(() => name.focus(), 50);
  }

  async function senden(daten) {
    const r = await fetch(api('senden?token=' + encodeURIComponent(sitzung.token)), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geheim: await verschluesseln({ daten }) }) });
    if (r.status === 403 || r.status === 410) ende(r.status);
  }

  function ende(status) {
    aus = true;
    try { sessionStorage.removeItem(merk); } catch (_) {}
    if (spieler) spieler.empfangen({ typ: status === 403 ? 'entfernt' : 'vorbei' });
  }

  async function spielen() {
    spieler = QOSpieler.erstellen(wurzel, { senden, ich: { id: sitzung.id, name: sitzung.name } });
    if (sitzung.titel) spieler.empfangen({ typ: 'lobby', titel: sitzung.titel });
    let fehlversuche = 0;
    let erster = true;
    while (!aus) {
      try {
        const r = await fetch(api(`warten?token=${encodeURIComponent(sitzung.token)}&seit=${sitzung.seit}`), { cache: 'no-store' });
        if (r.status === 403 || r.status === 410) {
          // Nach einem Neuladen mit abgelaufenem Zugang (z. B. neues Spiel): neu beitreten
          if (r.status === 403 && erster) {
            sitzung = null;
            spieler = null;
            try { sessionStorage.removeItem(merk); } catch (_) {}
            return beitretenZeigen();
          }
          return ende(r.status);
        }
        erster = false;
        const j = await r.json();
        fehlversuche = 0;
        sitzung.seit = j.seit;
        try { sessionStorage.setItem(merk, JSON.stringify(sitzung)); } catch (_) {}
        for (const e of j.ereignisse || []) {
          let daten = null;
          try { daten = await entschluesseln(e.geheim); } catch (_) { continue; }
          spieler.empfangen(daten);
        }
      } catch (_) {
        fehlversuche++;
        await new Promise((ok) => setTimeout(ok, Math.min(5000, 800 * fehlversuche)));
      }
    }
  }

  // Seite zu: dem Host Bescheid geben (sonst merkt er es nach 45 s)
  addEventListener('pagehide', () => {
    if (sitzung && !aus && navigator.sendBeacon) {
      try { navigator.sendBeacon(api('gehen?token=' + encodeURIComponent(sitzung.token))); } catch (_) {}
    }
  });

  (async () => {
    schluessel = await schluesselLaden();
    if (!schluessel) {
      wurzel.replaceChildren(el('div', { class: 'qo-spieler' },
        el('div', { class: 'qo-kopf' }, el('span', { class: 'qo-marke' }, 'Quizzard Online')),
        el('div', { class: 'qo-mitte' }, el('div', { class: 'qo-gross-symbol' }, '🔗'), el('h1', {}, 'Der Link ist unvollständig'),
          el('p', { class: 'qo-leise' }, 'Scanne den QR-Code noch einmal oder lass dir den ganzen Link schicken (mit dem Teil nach „#“).'))));
      return;
    }
    if (sitzung && sitzung.token) spielen();
    else beitretenZeigen();
  })();
})();
