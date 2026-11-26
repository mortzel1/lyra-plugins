'use strict';
// Puls im Browser: gleich dabei, ohne Namen (der Host kann um einen Namen bitten, wenn die Runde nicht anonym ist).
LyraGast.starten({
  marke: 'Puls',
  zeichen: 'P',
  ueberschrift: 'Mitmachen',
  name: 'keiner',
  erstellen: (wurzel, { senden, ich }) => PulsAnsicht.erstellen(wurzel, { senden, ich }),
});
