'use strict';
/*
 * Online-Baustein – die Seite im Browser für alle ohne Lyra und ohne Konto. Die Seite kommt von der Lyra des Hosts (über
 * einen Tunnel) und spricht nur mit ihr (api/beitreten, api/warten, api/senden, api/gehen).
 * Ende-zu-Ende-verschlüsselt: Der Schlüssel steht im Link hinter „#k=“ – diesen Teil schickt der Browser nie an einen
 * Server. Alles, was hin- und hergeht, ist mit AES-256-GCM verschlüsselt.
 *
 *   LyraGast.starten({
 *     marke: 'Puls',            // oben links
 *     zeichen: 'P',             // im Kreis auf der Startseite
 *     ueberschrift, text,       // Startseite
 *     name: 'pflicht' | 'keiner', // keiner: gleich dabei (z. B. anonyme Umfragen)
 *     knopf: 'Mitmachen',
 *     erstellen: (wurzel, { senden, ich }) => ({ empfangen(daten) }),
 *   });
 * Quelle: werkzeuge/online-baustein (jedes Plugin hat eine Kopie).
 */
const LyraGast = (() => {
  function el(tag, attr, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kinder.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }

  function starten(o) {
    const wurzel = document.getElementById('seite') || document.body;
    const basis = location.pathname.endsWith('/') ? location.pathname : location.pathname.replace(/[^/]*$/, '');
    const api = (p) => basis + 'api/' + p;
    const merk = 'lg:' + basis;
    let sitzung = null; // {token, id, name, seit, titel}
    let ansicht = null;
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

    function rahmen(...inhalt) {
      return el('div', { class: 'lg-seite' }, el('div', { class: 'lg-kopf' }, el('span', { class: 'lg-marke' }, o.marke || '')), el('div', { class: 'lg-mitte' }, ...inhalt));
    }

    async function beitreten(name) {
      const r = await fetch(api('beitreten'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geheim: await verschluesseln({ name }) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.fehler || 'Beitreten ging nicht.');
      const g = await entschluesseln(j.geheim);
      sitzung = { token: j.token, id: j.id, name: g.name, seit: j.seit || 0, titel: g.titel || '' };
      try { sessionStorage.setItem(merk, JSON.stringify(sitzung)); } catch (_) {}
      verbinden();
    }

    const verbindungsText = (err) => (/fetch|network|load failed/i.test(err.message) ? 'Keine Verbindung – ist die Runde noch offen?' : err.message);

    function startseite(fehler = '') {
      const ohneName = o.name === 'keiner';
      const name = ohneName ? null : el('input', { class: 'lg-eingabe', maxlength: '24', placeholder: 'Dein Name', autocomplete: 'nickname', enterkeyhint: 'go' });
      const knopf = el('button', { class: 'lg-knopf', type: 'submit' }, o.knopf || 'Mitmachen');
      const hinweis = el('p', { class: 'lg-fehler' }, fehler);
      const formular = el('form', { class: 'lg-formular', onsubmit: async (e) => {
        e.preventDefault();
        const n = ohneName ? 'Gast' : name.value.trim();
        if (!n) { hinweis.textContent = 'Bitte gib einen Namen ein.'; return; }
        knopf.disabled = true;
        hinweis.textContent = '';
        try { await beitreten(n); } catch (err) { hinweis.textContent = verbindungsText(err); knopf.disabled = false; }
      } }, name, knopf, hinweis);
      wurzel.replaceChildren(rahmen(
        el('div', { class: 'lg-orb' }, el('span', {}, o.zeichen || '•')),
        el('h1', {}, o.ueberschrift || 'Mitmachen'),
        o.text ? el('p', { class: 'lg-leise' }, o.text) : null,
        formular,
        el('p', { class: 'lg-fuss' }, `Ende-zu-Ende-verschlüsselt mit dem Schlüssel aus deinem Link. Die Seite kommt von der Lyra des Hosts${ohneName ? '' : '; gespeichert wird nur dein Name für diese Runde'}.`)));
      if (name) setTimeout(() => name.focus(), 50);
    }

    async function senden(daten) {
      if (!sitzung || aus) return;
      const r = await fetch(api('senden?token=' + encodeURIComponent(sitzung.token)), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geheim: await verschluesseln({ daten }) }) });
      if (r.status === 403 || r.status === 410) ende(r.status);
    }

    function ende(status) {
      aus = true;
      try { sessionStorage.removeItem(merk); } catch (_) {}
      if (ansicht) ansicht.empfangen({ typ: status === 403 ? 'entfernt' : 'vorbei' });
    }

    async function verbinden() {
      ansicht = o.erstellen(wurzel, { senden, ich: { id: sitzung.id, name: sitzung.name }, titel: sitzung.titel });
      let fehlversuche = 0;
      let erster = true;
      while (!aus) {
        try {
          const r = await fetch(api(`warten?token=${encodeURIComponent(sitzung.token)}&seit=${sitzung.seit}`), { cache: 'no-store' });
          if (r.status === 403 || r.status === 410) {
            // Nach einem Neuladen mit abgelaufenem Zugang: neu beitreten
            if (r.status === 403 && erster) {
              sitzung = null;
              ansicht = null;
              try { sessionStorage.removeItem(merk); } catch (_) {}
              return startseite();
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
            try { ansicht.empfangen(daten); } catch (err) { console.error(err); }
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
        wurzel.replaceChildren(rahmen(el('div', { class: 'lg-orb aus' }, el('span', {}, '!')), el('h1', {}, 'Der Link ist unvollständig'),
          el('p', { class: 'lg-leise' }, 'Scanne den QR-Code noch einmal oder lass dir den ganzen Link schicken (mit dem Teil nach „#“).')));
        return;
      }
      if (sitzung && sitzung.token) verbinden();
      else if (o.name === 'keiner') {
        // Ohne Namen: gleich dabei
        wurzel.replaceChildren(rahmen(el('div', { class: 'lg-orb' }, el('span', {}, o.zeichen || '•')), el('p', { class: 'lg-leise' }, 'Verbinde …')));
        try { await beitreten('Gast'); } catch (err) { startseite(verbindungsText(err)); }
      } else startseite();
    })();
  }

  return { starten, el };
})();
