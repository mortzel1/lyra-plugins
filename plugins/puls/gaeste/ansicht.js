'use strict';
/*
 * Puls – Ansicht der Teilnehmenden (im Browser und in Lyra) und die Ergebnis-Grafiken (auch für die Leinwand des Hosts).
 * Ohne Abhängigkeiten; die Verbindung bringt der Aufrufer mit.
 *
 *   const a = PulsAnsicht.erstellen(wurzel, { senden, ich, inLyra });
 *   a.empfangen({ typ: 'zustand' | 'wand' | 'meins' | 'ende' | 'entfernt' | 'vorbei', … });
 *   PulsAnsicht.ergebnis(item, erg, { gross }) → Element
 *
 * Arten: umfrage (eine/mehrere Optionen), skala, wortwolke, freitext, schaetzen, rangfolge, ampel (Verständnis).
 */
const PulsAnsicht = (() => {
  const ARTEN = {
    umfrage: ['Umfrage', 'Eine oder mehrere Optionen wählen'],
    skala: ['Skala', 'Auf einer Skala bewerten, z. B. 1 bis 5'],
    wortwolke: ['Wortwolke', 'Bis zu drei Wörter – häufige werden groß'],
    freitext: ['Offene Frage', 'Freie Antworten, die KI fasst sie zu Themen zusammen'],
    schaetzen: ['Schätzfrage', 'Eine Zahl schätzen – mit Verteilung und Median'],
    rangfolge: ['Rangfolge', 'Optionen nach Wichtigkeit ordnen'],
    ampel: ['Verständnis-Ampel', 'Grün, gelb oder rot – wie gut ist es angekommen?'],
  };
  const AMPEL = [['gruen', 'Alles klar'], ['gelb', 'Geht so'], ['rot', 'Ich bin raus']];
  const ZEICHEN = 'ABCDEFGHIJ';
  const zahl = (n) => Math.round(n || 0).toLocaleString('de-DE');
  const fmt = (n) => (n == null || !isFinite(n) ? '–' : (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString('de-DE'));
  const prozent = (a, n) => (n ? Math.round((a / n) * 100) : 0);

  function el(tag, attr, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'style') { for (const [n, w] of Object.entries(v)) { if (n.startsWith('--')) e.style.setProperty(n, w); else e.style[n] = w; } }
      else if (k === 'value') e.value = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kinder.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }

  // ================================================================ Ergebnisse

  function leer(text = 'Noch keine Antworten') { return el('div', { class: 'pu-leer' }, text); }

  function umfrageErgebnis(item, e) {
    const max = Math.max(1, ...e.zaehler);
    return el('div', { class: 'pu-balken-liste' }, item.optionen.map((o, i) => {
      const richtig = e.richtig && e.richtig.includes(i);
      return el('div', { class: 'pu-zeile' + (richtig ? ' richtig' : '') + (e.richtig && !richtig ? ' blass' : '') },
        el('div', { class: 'pu-zeile-kopf' },
          el('span', { class: 'pu-marke' }, richtig ? '✓' : ZEICHEN[i]),
          el('span', { class: 'pu-zeile-text' }, o),
          el('span', { class: 'pu-zeile-wert' }, `${prozent(e.zaehler[i], e.n)} %`, el('small', {}, ` · ${zahl(e.zaehler[i])}`))),
        el('div', { class: 'pu-bahn' }, el('div', { class: 'pu-fuellung', style: { width: `${(e.zaehler[i] / max) * 100}%` } })));
    }));
  }

  function skalaErgebnis(item, e) {
    const werte = [];
    for (let v = item.min; v <= item.max; v++) werte.push(v);
    const max = Math.max(1, ...werte.map((v) => e.zaehler[v] || 0));
    return el('div', { class: 'pu-skala-erg' },
      el('div', { class: 'pu-kennzahl' }, el('b', {}, fmt(e.schnitt)), el('span', {}, `Durchschnitt · ${zahl(e.n)} Stimmen`)),
      el('div', { class: 'pu-saeulen' }, werte.map((v) => el('div', { class: 'pu-saeule' },
        el('div', { class: 'pu-saeule-zahl' }, zahl(e.zaehler[v] || 0)),
        el('div', { class: 'pu-saeule-bahn' }, el('div', { class: 'pu-saeule-fuellung', style: { height: `${((e.zaehler[v] || 0) / max) * 100}%` } })),
        el('div', { class: 'pu-saeule-wert' }, String(v))))),
      item.links || item.rechts ? el('div', { class: 'pu-skala-enden' }, el('span', {}, item.links || ''), el('span', {}, item.rechts || '')) : null);
  }

  function wolkeErgebnis(item, e) {
    const l = e.woerter || [];
    if (!l.length) return leer();
    const max = l[0][1];
    const min = l[l.length - 1][1];
    // Groß in der Mitte, kleiner nach außen: abwechselnd links und rechts anfügen
    const reihe = [];
    l.forEach((w, i) => (i % 2 ? reihe.push(w) : reihe.unshift(w)));
    return el('div', { class: 'pu-wolke' }, reihe.map(([wort, n], i) => {
      const a = max === min ? 1 : (n - min) / (max - min);
      return el('span', { class: 'pu-wort t' + (i % 5), style: { fontSize: `${(0.9 + a * 2.6).toFixed(2)}em`, opacity: (0.55 + a * 0.45).toFixed(2) }, title: `${n}×` }, wort);
    }));
  }

  function freitextErgebnis(item, e, gross) {
    const teile = [];
    if (e.themen && e.themen.length) {
      teile.push(el('div', { class: 'pu-themen' }, e.themen.map((t) => el('div', { class: 'pu-thema' },
        el('div', { class: 'pu-thema-kopf' }, el('b', {}, t.titel), el('span', { class: 'pu-thema-zahl' }, `${zahl(t.anzahl)}`)),
        t.beispiel ? el('div', { class: 'pu-thema-beispiel' }, `„${t.beispiel}“`) : null))));
    }
    teile.push(el('div', { class: 'pu-karten-wand' + (gross ? ' gross' : '') }, (e.texte || []).slice(0, gross ? 40 : 12).map((t) => el('div', { class: 'pu-zettel' }, t))));
    if (e.n > (e.texte || []).length) teile.push(el('div', { class: 'pu-leise-klein' }, `… und ${zahl(e.n - e.texte.length)} weitere`));
    return el('div', { class: 'pu-freitext' }, teile);
  }

  function schaetzErgebnis(item, e) {
    const max = Math.max(1, ...e.eimer);
    const breite = (e.bis - e.von) || 1;
    const pos = (v) => `${Math.max(0, Math.min(100, ((v - e.von) / breite) * 100))}%`;
    const einheit = item.einheit ? ' ' + item.einheit : '';
    return el('div', { class: 'pu-schaetz-erg' },
      el('div', { class: 'pu-kennzahlen' },
        el('div', { class: 'pu-kennzahl' }, el('b', {}, fmt(e.median) + einheit), el('span', {}, 'Median')),
        el('div', { class: 'pu-kennzahl' }, el('b', {}, fmt(e.schnitt) + einheit), el('span', {}, 'Durchschnitt')),
        e.wahr != null ? el('div', { class: 'pu-kennzahl wahr' }, el('b', {}, fmt(e.wahr) + einheit), el('span', {}, 'Richtig')) : null),
      el('div', { class: 'pu-histogramm' },
        e.eimer.map((n) => el('div', { class: 'pu-hist-saeule', style: { height: `${(n / max) * 100}%` }, title: `${n}` })),
        el('div', { class: 'pu-marker median', style: { left: pos(e.median) } }),
        e.wahr != null ? el('div', { class: 'pu-marker wahr', style: { left: pos(e.wahr) } }) : null),
      el('div', { class: 'pu-skala-enden' }, el('span', {}, fmt(e.von) + einheit), el('span', {}, `${zahl(e.n)} Schätzungen`), el('span', {}, fmt(e.bis) + einheit)));
  }

  function rangErgebnis(item, e) {
    const n = item.optionen.length;
    return el('ol', { class: 'pu-rang' }, e.reihenfolge.map((i, platz) => el('li', { class: 'pu-rang-zeile' },
      el('span', { class: 'pu-marke' }, String(platz + 1)),
      el('span', { class: 'pu-zeile-text' }, item.optionen[i]),
      el('div', { class: 'pu-bahn kurz' }, el('div', { class: 'pu-fuellung', style: { width: `${n > 1 ? ((n - e.platz[i]) / (n - 1)) * 100 : 100}%` } })),
      el('span', { class: 'pu-zeile-wert' }, `Ø ${fmt(e.platz[i])}`))));
  }

  function ampelErgebnis(item, e) {
    return el('div', { class: 'pu-ampel-erg' },
      el('div', { class: 'pu-ampel-lichter' }, AMPEL.map(([k, name]) => el('div', { class: 'pu-licht ' + k, style: { '--an': String(e.n ? 0.25 + 0.75 * (e[k] / e.n) : 0.25) } },
        el('div', { class: 'pu-licht-kreis' }, el('b', {}, `${prozent(e[k], e.n)} %`)),
        el('div', { class: 'pu-licht-name' }, name), el('div', { class: 'pu-leise-klein' }, `${zahl(e[k])}`)))),
      el('div', { class: 'pu-ampel-streifen' }, AMPEL.map(([k]) => el('div', { class: k, style: { flex: String(e[k] || 0) } }))));
  }

  function ergebnis(item, e, { gross = false } = {}) {
    if (!item) return leer('');
    if (!e || !e.n) return leer();
    const f = { umfrage: umfrageErgebnis, skala: skalaErgebnis, wortwolke: wolkeErgebnis, freitext: freitextErgebnis, schaetzen: schaetzErgebnis, rangfolge: rangErgebnis, ampel: ampelErgebnis }[item.art];
    return el('div', { class: 'pu-ergebnis' + (gross ? ' gross' : '') }, f ? f(item, e, gross) : leer());
  }

  // ================================================================ Ansicht der Teilnehmenden

  function erstellen(wurzel, { senden, ich, inLyra = false }) {
    const z = {
      titel: '', anonym: true, wandAn: false, item: null, offen: false, erg: null, nr: 0, von: 0,
      meins: {}, // item-id → Wert
      bearbeiten: false, // nach dem Abschicken noch einmal ändern
      entwurf: null, // Eingabe, die noch nicht abgeschickt ist
      wand: [], stimmen: new Set(), reiter: 'jetzt', vorbei: '', name: inLyra ? ich.name : '', nameGefragt: inLyra,
    };
    try { z.nameGefragt = z.nameGefragt || sessionStorage.getItem('puls:name') !== null; } catch (_) {}

    const schicken = (d) => Promise.resolve(senden(d)).catch(() => {});

    function antworten(wert) {
      const it = z.item;
      if (!it || !z.offen) return;
      if (it.art === 'freitext') {
        const l = (z.meins[it.id] || []).concat([wert]);
        z.meins[it.id] = l;
      } else z.meins[it.id] = wert;
      z.bearbeiten = false;
      z.entwurf = null;
      try { navigator.vibrate && navigator.vibrate(20); } catch (_) {}
      schicken({ typ: 'antwort', item: it.id, wert });
      malen();
    }

    // ---- Eingabe je Art
    function umfrageEingabe(it) {
      const mehr = !!it.mehrfach;
      const gewaehlt = new Set(z.entwurf || (Array.isArray(z.meins[it.id]) ? z.meins[it.id] : []));
      const karten = it.optionen.map((o, i) => el('button', {
        class: 'pu-karte' + (gewaehlt.has(i) ? ' an' : ''),
        onclick: () => {
          if (!mehr) return antworten([i]);
          if (gewaehlt.has(i)) gewaehlt.delete(i); else gewaehlt.add(i);
          z.entwurf = [...gewaehlt].sort((a, b) => a - b);
          malen();
        },
      }, el('span', { class: 'pu-marke' }, mehr ? (gewaehlt.has(i) ? '✓' : ZEICHEN[i]) : ZEICHEN[i]), el('span', { class: 'pu-karte-text' }, o)));
      return [mehr ? el('p', { class: 'pu-hinweis' }, 'Mehrere Antworten möglich') : null, el('div', { class: 'pu-karten' }, karten),
        mehr ? el('button', { class: 'pu-knopf', disabled: !gewaehlt.size, onclick: () => antworten([...gewaehlt].sort((a, b) => a - b)) }, 'Abschicken') : null];
    }

    function skalaEingabe(it) {
      const werte = [];
      for (let v = it.min; v <= it.max; v++) werte.push(v);
      return [el('div', { class: 'pu-skala' + (werte.length > 6 ? ' eng' : '') }, werte.map((v) => el('button', { class: 'pu-skala-knopf' + (z.meins[it.id] === v ? ' an' : ''), onclick: () => antworten(v) }, String(v)))),
        el('div', { class: 'pu-skala-enden' }, el('span', {}, it.links || ''), el('span', {}, it.rechts || ''))];
    }

    function wolkeEingabe(it) {
      const n = Math.max(1, Math.min(3, it.woerter || 3));
      const felder = [];
      for (let i = 0; i < n; i++) felder.push(el('input', { class: 'pu-eingabe', maxlength: '30', placeholder: n === 1 ? 'Ein Wort' : `Wort ${i + 1}${i ? ' (optional)' : ''}`, enterkeyhint: i === n - 1 ? 'send' : 'next' }));
      const los = () => {
        const w = felder.map((f) => f.value.trim()).filter(Boolean);
        if (w.length) antworten(w);
      };
      felder.forEach((f, i) => f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (i < n - 1) felder[i + 1].focus(); else los(); } }));
      setTimeout(() => felder[0] && felder[0].focus(), 60);
      return [el('div', { class: 'pu-spalte' }, felder), el('button', { class: 'pu-knopf', onclick: los }, 'Abschicken')];
    }

    function freitextEingabe(it) {
      const t = el('textarea', { class: 'pu-eingabe pu-text', maxlength: '280', rows: '3', placeholder: 'Deine Antwort …' });
      const los = () => { const v = t.value.trim(); if (v) antworten(v); };
      setTimeout(() => t.focus(), 60);
      return [t, el('button', { class: 'pu-knopf', onclick: los }, 'Abschicken')];
    }

    function schaetzEingabe(it) {
      const f = el('input', { class: 'pu-eingabe pu-zahl', inputmode: 'decimal', placeholder: 'Deine Schätzung', enterkeyhint: 'send' });
      const fehler = el('p', { class: 'pu-fehler' });
      const los = () => {
        const v = Number(String(f.value).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
        if (!f.value.trim() || !isFinite(v)) { fehler.textContent = 'Bitte eine Zahl eingeben.'; return; }
        antworten(v);
      };
      f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); los(); } });
      setTimeout(() => f.focus(), 60);
      return [el('div', { class: 'pu-zahl-zeile' }, f, it.einheit ? el('span', { class: 'pu-einheit' }, it.einheit) : null), fehler, el('button', { class: 'pu-knopf', onclick: los }, 'Abschicken')];
    }

    function rangEingabe(it) {
      if (!z.entwurf) z.entwurf = Array.isArray(z.meins[it.id]) ? z.meins[it.id].slice() : it.optionen.map((_, i) => i);
      const r = z.entwurf;
      const tauschen = (a, b) => { [r[a], r[b]] = [r[b], r[a]]; malen(); };
      return [el('p', { class: 'pu-hinweis' }, 'Das Wichtigste nach oben'),
        el('ol', { class: 'pu-ordnen' }, r.map((i, p) => el('li', { class: 'pu-ordnen-zeile' },
          el('span', { class: 'pu-marke' }, String(p + 1)), el('span', { class: 'pu-karte-text' }, it.optionen[i]),
          el('span', { class: 'pu-pfeile' },
            el('button', { disabled: p === 0, 'aria-label': 'Nach oben', onclick: () => tauschen(p, p - 1) }, '▲'),
            el('button', { disabled: p === r.length - 1, 'aria-label': 'Nach unten', onclick: () => tauschen(p, p + 1) }, '▼'))))),
        el('button', { class: 'pu-knopf', onclick: () => antworten(r.slice()) }, 'Abschicken')];
    }

    function ampelEingabe(it) {
      return el('div', { class: 'pu-ampel' }, AMPEL.map(([k, name]) => el('button', { class: 'pu-ampel-knopf ' + k + (z.meins[it.id] === k ? ' an' : ''), onclick: () => antworten(k) },
        el('span', { class: 'pu-ampel-punkt' }), name)));
    }

    function eingabe(it) {
      return ({ umfrage: umfrageEingabe, skala: skalaEingabe, wortwolke: wolkeEingabe, freitext: freitextEingabe, schaetzen: schaetzEingabe, rangfolge: rangEingabe, ampel: ampelEingabe }[it.art] || (() => null))(it);
    }

    function beantwortet(it) {
      const m = z.meins[it.id];
      return it.art === 'freitext' ? Array.isArray(m) && m.length > 0 : m !== undefined;
    }

    function meineAntwortText(it) {
      const m = z.meins[it.id];
      if (m === undefined) return '';
      if (it.art === 'umfrage') return m.map((i) => it.optionen[i]).join(', ');
      if (it.art === 'wortwolke') return m.join(' · ');
      if (it.art === 'freitext') return m.length === 1 ? `„${m[0]}“` : `${m.length} Antworten`;
      if (it.art === 'schaetzen') return fmt(m) + (it.einheit ? ' ' + it.einheit : '');
      if (it.art === 'rangfolge') return m.map((i) => it.optionen[i]).slice(0, 3).join(' › ') + (m.length > 3 ? ' …' : '');
      if (it.art === 'ampel') return (AMPEL.find((a) => a[0] === m) || ['', ''])[1];
      return String(m);
    }

    // ---- Seiten
    function jetztSeite() {
      const it = z.item;
      if (!it) {
        return el('div', { class: 'pu-mitte' },
          el('div', { class: 'pu-orb' }, el('span', { class: 'pu-puls' })),
          el('h1', {}, z.titel || 'Puls'),
          el('p', { class: 'pu-leise' }, 'Gleich geht’s los – die erste Frage erscheint hier von selbst.'),
          namensKarte());
      }
      const kopf = el('div', { class: 'pu-frage-kopf' },
        el('span', { class: 'pu-pill' }, ARTEN[it.art] ? ARTEN[it.art][0] : ''),
        z.von > 1 ? el('span', { class: 'pu-pill leise' }, `${z.nr} / ${z.von}`) : null);
      const frage = el('h2', { class: 'pu-frage' }, it.frage);
      if (!z.offen) {
        return el('div', { class: 'pu-frage-seite' }, kopf, frage,
          beantwortet(it) ? el('div', { class: 'pu-meins' }, el('span', {}, 'Deine Antwort: '), el('b', {}, meineAntwortText(it))) : null,
          z.erg ? el('div', { class: 'pu-karte-flach' }, ergebnis(it, z.erg)) : el('div', { class: 'pu-mitte klein' }, el('p', { class: 'pu-leise' }, 'Abstimmung geschlossen.')));
      }
      if (beantwortet(it) && !z.bearbeiten) {
        const nochmal = it.art === 'freitext' && (z.meins[it.id] || []).length < 5;
        return el('div', { class: 'pu-frage-seite' }, kopf, frage,
          el('div', { class: 'pu-danke' },
            el('div', { class: 'pu-haken' }, '✓'),
            el('b', {}, it.art === 'ampel' ? 'Danke – du kannst jederzeit wechseln' : 'Angekommen, danke!'),
            el('div', { class: 'pu-leise' }, meineAntwortText(it)),
            it.art === 'ampel' ? ampelEingabe(it)
              : el('button', { class: 'pu-knopf zart', onclick: () => { z.bearbeiten = true; z.entwurf = null; malen(); } }, nochmal ? 'Noch eine Antwort' : (it.art === 'wortwolke' ? 'Andere Wörter' : 'Ändern'))),
          z.erg ? el('div', { class: 'pu-karte-flach' }, ergebnis(it, z.erg)) : null);
      }
      return el('div', { class: 'pu-frage-seite' }, kopf, frage, eingabe(it));
    }

    function namensKarte() {
      if (z.anonym || z.nameGefragt) return null;
      const f = el('input', { class: 'pu-eingabe', maxlength: '24', placeholder: 'Dein Name (optional)', enterkeyhint: 'done' });
      const los = (n) => {
        z.nameGefragt = true;
        try { sessionStorage.setItem('puls:name', n); } catch (_) {}
        if (n) { z.name = n; schicken({ typ: 'name', name: n }); }
        malen();
      };
      f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); los(f.value.trim()); } });
      return el('div', { class: 'pu-name-karte' }, el('b', {}, 'Wie heißt du?'), el('div', { class: 'pu-leise-klein' }, 'Der Host sieht deinen Namen bei deinen Fragen an der Fragenwand.'),
        f, el('div', { class: 'pu-zeile-knoepfe' }, el('button', { class: 'pu-knopf zart', onclick: () => los('') }, 'Lieber nicht'), el('button', { class: 'pu-knopf', onclick: () => los(f.value.trim()) }, 'OK')));
    }

    function wandSeite() {
      const t = el('textarea', { class: 'pu-eingabe pu-text', maxlength: '240', rows: '2', placeholder: 'Deine Frage an den Host …' });
      const los = () => {
        const v = t.value.trim();
        if (!v) return;
        schicken({ typ: 'frage', text: v });
        t.value = '';
        z.eigeneGesendet = (z.eigeneGesendet || 0) + 1;
        malen();
      };
      const liste = z.wand.slice().sort((a, b) => (a.beantwortet - b.beantwortet) || (b.stimmen - a.stimmen) || (a.zeit - b.zeit));
      return el('div', { class: 'pu-frage-seite' },
        el('h2', { class: 'pu-frage klein' }, 'Fragenwand'),
        el('p', { class: 'pu-hinweis' }, z.anonym ? 'Anonym – stimme für Fragen, die dich auch interessieren.' : 'Stimme für Fragen, die dich auch interessieren.'),
        t, el('button', { class: 'pu-knopf', onclick: los }, 'Frage stellen'),
        z.eigeneGesendet ? el('p', { class: 'pu-leise-klein', style: { textAlign: 'center' } }, '✓ Gesendet – sie erscheint gleich unten') : null,
        el('div', { class: 'pu-wand' }, liste.length ? liste.map((f) => {
          const meine = z.stimmen.has(f.id);
          return el('div', { class: 'pu-wand-frage' + (f.beantwortet ? ' erledigt' : '') },
            el('button', { class: 'pu-stimme' + (meine ? ' an' : ''), disabled: f.beantwortet, 'aria-label': 'Abstimmen', onclick: () => {
              if (meine) z.stimmen.delete(f.id); else z.stimmen.add(f.id);
              f.stimmen += meine ? -1 : 1;
              schicken({ typ: 'stimme', frage: f.id, an: !meine });
              malen();
            } }, el('span', {}, '▲'), el('b', {}, String(f.stimmen))),
            el('div', { class: 'pu-wand-text' }, f.text, f.name ? el('div', { class: 'pu-leise-klein' }, f.name) : null, f.beantwortet ? el('div', { class: 'pu-leise-klein' }, '✓ beantwortet') : null));
        }) : el('p', { class: 'pu-leise', style: { textAlign: 'center' } }, 'Noch keine Fragen.')));
    }

    function malen() {
      if (z.vorbei) {
        wurzel.replaceChildren(el('div', { class: 'pu-seite' }, el('div', { class: 'pu-kopf' }, el('span', { class: 'pu-marke-puls' }, 'Puls')),
          el('div', { class: 'pu-mitte' }, el('div', { class: 'pu-orb ruhig' }, el('span', {}, z.vorbei === 'ende' ? '✓' : '·')),
            el('h1', {}, z.vorbei === 'ende' ? 'Danke fürs Mitmachen!' : z.vorbei === 'entfernt' ? 'Du wurdest abgemeldet' : 'Die Runde ist vorbei'),
            el('p', { class: 'pu-leise' }, z.vorbei === 'ende' ? 'Die Runde ist beendet. Du kannst die Seite schließen.' : 'Du kannst die Seite schließen.'))));
        return;
      }
      const offeneWand = z.wand.filter((f) => !f.beantwortet).length;
      wurzel.replaceChildren(el('div', { class: 'pu-seite' },
        el('div', { class: 'pu-kopf' }, el('span', { class: 'pu-marke-puls' }, 'Puls'), el('span', { class: 'pu-titel-klein' }, z.titel), z.name && !z.anonym ? el('span', { class: 'pu-name' }, z.name) : null),
        z.reiter === 'wand' && z.wandAn ? wandSeite() : jetztSeite(),
        z.wandAn ? el('div', { class: 'pu-reiter' },
          el('button', { class: z.reiter === 'jetzt' ? 'an' : '', onclick: () => { z.reiter = 'jetzt'; malen(); } }, 'Jetzt'),
          el('button', { class: z.reiter === 'wand' ? 'an' : '', onclick: () => { z.reiter = 'wand'; malen(); } }, 'Fragen', offeneWand ? el('span', { class: 'pu-zaehler' }, String(offeneWand)) : null)) : null));
    }

    function empfangen(d) {
      if (!d || typeof d !== 'object') return;
      if (d.typ === 'zustand') {
        const warOffen = z.offen;
        const neuesItem = !z.item || !d.item || z.item.id !== d.item.id;
        z.titel = d.titel || z.titel;
        z.anonym = d.anonym !== false;
        z.wandAn = !!d.wand;
        if (!z.wandAn) z.reiter = 'jetzt';
        z.item = d.item || null;
        z.offen = !!d.offen;
        z.erg = d.ergebnis || null;
        z.nr = d.nr || 0;
        z.von = d.von || 0;
        if (neuesItem) { z.bearbeiten = false; z.entwurf = null; if (z.item) z.reiter = 'jetzt'; }
        // Ergebnis-Aktualisierung: nicht stören, während jemand tippt
        const fokus = document.activeElement;
        if (!neuesItem && warOffen === z.offen && fokus && wurzel.contains(fokus) && /INPUT|TEXTAREA/.test(fokus.tagName)) {
          const alt = wurzel.querySelector('.pu-karte-flach');
          if (alt && z.erg && z.item) alt.replaceChildren(ergebnis(z.item, z.erg));
          return;
        }
      } else if (d.typ === 'wand') {
        z.wand = Array.isArray(d.fragen) ? d.fragen : [];
        if (z.reiter !== 'wand') {
          const k = wurzel.querySelector('.pu-reiter .pu-zaehler');
          const n = z.wand.filter((f) => !f.beantwortet).length;
          if (k) { k.textContent = String(n); return; }
          if (!n) return;
        } else {
          const fokus = document.activeElement;
          if (fokus && wurzel.contains(fokus) && fokus.tagName === 'TEXTAREA' && fokus.value) return;
        }
      } else if (d.typ === 'meins') {
        z.meins = d.antworten || {};
        z.stimmen = new Set(d.stimmen || []);
      } else if (d.typ === 'ende' || d.typ === 'vorbei' || d.typ === 'entfernt') {
        z.vorbei = d.typ;
      } else return;
      malen();
    }

    malen();
    return { empfangen };
  }

  return { erstellen, ergebnis, ARTEN, AMPEL, el, fmt, zahl };
})();
