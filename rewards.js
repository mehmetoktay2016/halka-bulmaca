// Ödül ekonomisi: fiyatlar ve ödül miktarları tek yerde.
// Dengeyi değiştirmek için yalnızca bu dosya düzenlenir; tools/economy.js aynı değerlerle hesap yapar.
// Hem tarayıcıda (window.RingRewards) hem Node'da (require) çalışır.
(function (root) {
  'use strict';

  const ECONOMY = {
    // Bölümdeki altınlar (halka kesişimlerinde): bölüm başına en az / en çok
    levelCoins: [1, 3],
    // Harcama
    bulbPrice: 20,      // 1 ampul kaç altın
    extraPrice: 20,     // "+3 hamle" kaç altın
    extraMoves: 3,      // ek hamleyle bitirilen bölüm en fazla 1 yıldız alır
    // Ampul ödülleri
    gateBulbs: 1,       // her yeni kapı açılınca (2. kapıdan başlayarak)
    goldGateBulbs: 3,   // bir kapının 10 bölümü de 3 yıldız olunca
    dailyBulbs: 1,      // ampulü hiç kalmayan oyuncuya günde bir kez
  };

  const api = { ECONOMY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingRewards = api;
})(this);
