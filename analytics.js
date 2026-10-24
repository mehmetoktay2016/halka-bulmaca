// Ölçüm (2.7): bölüm başlangıcı, bitişi, kaybı ve harcamalar Firebase Analytics'e gider.
// Yalnızca Android uygulamasında çalışır (Capacitor eklentisi); tarayıcıda ve Expo'da hiçbir şey göndermez.
// ?debug adresinde olaylar konsola da yazılır. Kişisel veri gönderilmez: yalnızca oyun olayları ve sayılar.
(function (root) {
  'use strict';

  const plugin = root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins.FirebaseAnalytics;
  const debug = /[?&]debug\b/.test(root.location ? root.location.search : '');

  function send(name, params) {
    if (debug) console.log('[ölçüm]', name, params || {});
    if (!plugin) return;
    try {
      plugin.logEvent({ name, params: params || {} }).catch(() => { /* ölçüm oyunu bozmasın */ });
    } catch (e) { /* yok say */ }
  }

  root.RingAnalytics = {
    // level: oyuncunun gördüğü bölüm numarası; gate: kapı
    levelStart: (level, gate, tries) => send('level_start', { level, gate, tries }),
    levelComplete: (level, gate, p) => send('level_complete', { level, gate, ...p }),
    levelFail: (level, gate, left) => send('level_fail', { level, gate, rings_left: left }),
    extraMoves: (level, price) => send('extra_moves', { level, price }),
    hint: (level, tier) => send('hint_use', { level, tier }),
    tutorialDone: () => send('tutorial_complete'),
  };
})(typeof window !== 'undefined' ? window : globalThis);
