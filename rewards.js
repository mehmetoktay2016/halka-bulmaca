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

  // Halka ödülleri: halka kurtulunca içindeki ödül açılır. Her bölümün ödülü bir kez alınır (kayıt: loot).
  // Yerleri ve içerikleri bölüm kimliğinden tohumlanır: aynı bölümde her zaman aynı ödül, tekrar denemekle değişmez.
  // Ödülü taşıyabilecek halkalar loot_data.js'te (tools/build_loot.js).
  const LOOT = {
    chestsPerGate: 3,    // 2. kapıdan itibaren her kapıda kaç sandık (kapının 1. bölümünde olmaz)
    introPos: 3,         // 1. kapıda tek tanıtım sandığı: kapının kaçıncı bölümünde
    introCoins: 5,
    // Zor kapılarda (hata payı en düşük olanlar, tools/economy.js) nadir sandık daha sık
    hardGates: [6, 9, 10, 11, 12],
    rarity: {
      normal: { common: 65, rare: 28, epic: 7 },
      hard: { common: 45, rare: 40, epic: 15 },
    },
    chest: {
      common: { coins: [3, 5] },
      rare: { coins: [7, 11], bulbChance: 0.3 },
      epic: { coins: [14, 22], bulbs: 1 },
    },
  };
  const RARITY_NAMES = { common: 'Sandık', rare: 'Nadir sandık', epic: 'Efsane sandık' };

  // Tohumlu rastgele sayı (mulberry32): aynı tohum, aynı dizi
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const between = (r, [lo, hi]) => lo + Math.floor(r() * (hi - lo + 1));

  // Kapının hangi bölümlerinde sandık var: bölüm sırası (1-10) kümesi.
  // hasSpot(pos): o bölümde ödül taşıyabilecek halka var mı
  function chestPositions(gate, hasSpot, gateSize = 10) {
    if (gate === 1) return new Set(hasSpot(LOOT.introPos) ? [LOOT.introPos] : []);
    const r = rng(7919 * gate);
    const pool = [];
    for (let p = 2; p <= gateSize; p++) if (hasSpot(p)) pool.push(p);
    for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
    return new Set(pool.slice(0, LOOT.chestsPerGate));
  }

  // Bölümün sandığı: { rarity, name, coins, bulbs }
  function chestFor(src, gate) {
    if (gate === 1) return { rarity: 'common', name: RARITY_NAMES.common, coins: LOOT.introCoins, bulbs: 0 };
    const r = rng(104729 * src + 17);
    const w = LOOT.rarity[LOOT.hardGates.includes(gate) ? 'hard' : 'normal'];
    let roll = r() * (w.common + w.rare + w.epic);
    const rarity = (roll -= w.common) < 0 ? 'common' : (roll -= w.rare) < 0 ? 'rare' : 'epic';
    const c = LOOT.chest[rarity];
    const coins = between(r, c.coins);
    const bulbs = c.bulbs || (c.bulbChance && r() < c.bulbChance ? 1 : 0);
    return { rarity, name: RARITY_NAMES[rarity], coins, bulbs };
  }

  const api = { ECONOMY, LOOT, rng, chestPositions, chestFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingRewards = api;
})(this);
