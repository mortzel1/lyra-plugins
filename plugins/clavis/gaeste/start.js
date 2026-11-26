'use strict';
// Clavis im Browser: Namen eingeben, dem Team beitreten – der Raum kommt von der Lyra des Hosts.
LyraGast.starten({
  marke: 'Clavis',
  zeichen: '⚿',
  ueberschrift: 'Dem Team beitreten',
  text: 'Gib einen Namen ein – dein Team sieht ihn. Kein Konto, keine App nötig.',
  name: 'pflicht',
  knopf: 'Eintreten',
  erstellen: (wurzel, { senden, ich }) => Clavis.Spiel.erstellen(wurzel, { senden, ich }),
});
