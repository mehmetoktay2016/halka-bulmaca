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
    goldPerGate: 1,      // altın halka: o bölümün altınları 2 kat sayılır (bölüm bitince)
    goldCoins: 3,        // altın halkalı bölümde tahtaya konan altın (yer varsa)
    goldMult: 2,
    // Ampul halkası (+1 ampul): zor kapılarda ve arada birkaç kapıda, kapı başına bir
    bulbGates: [4, 6, 9, 10, 11, 12, 15, 18],
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
  // Çıkartma parçaları: her dünyanın 5 parçası, dünyanın bölümlerine yayılır; son parça dünyanın son bölümünde.
  // Parça, bölüm bitince verilir (her parça bir kez). Set tamamlanınca setCoins altın.
  const STICKERS = {
    at: [0.1, 0.3, 0.55, 0.8, 1], // dünyanın bölümlerinde parçaların yeri (oran)
    setCoins: 25,
  };
  // Dünyanın bölüm numaraları (sırayla) -> k. parçanın bölümü. Kapının ilk bölümü (yeni mekaniğin tanıtımı) atlanır.
  function stickerLevels(levels, gateSize = 10) {
    return STICKERS.at.map(f => {
      let i = Math.max(0, Math.ceil(f * levels.length) - 1);
      if ((levels[i] - 1) % gateSize === 0 && i + 1 < levels.length) i++;
      return levels[i];
    });
  }

  // Günlük seri sandığı: oyunu her gün açana büyüyen ödül; 7. gün efsane sandık, sonra şerit baştan.
  // Gün kaçırılırsa seri sıfırlanmaz, kaçırılan gün kadar geri düşer.
  const STREAK = {
    days: [
      { coins: 5 }, { coins: 8 }, { coins: 10 }, { coins: 12, rarity: 'rare' },
      { coins: 15, rarity: 'rare' }, { coins: 20, rarity: 'rare' }, { coins: 30, bulbs: 1, rarity: 'epic' },
    ],
  };
  const dayNo = d => { const [y, m, g] = d.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, g) / 86400000); };
  // Bugünün seri adımı: { count, slot (0-6), missed, reward } ya da bugün alındıysa null.
  // streak: kayıttaki { day, count } ya da null; day: 'YYYY-AA-GG'
  function streakStep(streak, day) {
    if (streak && streak.day === day) return null;
    const missed = streak ? Math.max(0, dayNo(day) - dayNo(streak.day) - 1) : 0;
    const count = (streak ? Math.max(0, streak.count - missed) : 0) + 1;
    const slot = (count - 1) % STREAK.days.length;
    return { count, slot, missed, reward: { coins: 0, bulbs: 0, rarity: 'common', ...STREAK.days[slot] } };
  }

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

  // Kapının ödül planı: bölüm sırası (1-10) -> 'chest' | 'gold' | 'bulb'. Bir bölümde en çok bir halka ödülü.
  // spots(pos): o bölümde ödül taşıyabilecek [halka, x, y, sığan altın] adayları (loot_data.js) ya da boş.
  // Karışık sıradan önce sandıklar, sonra altın halka, sonra ampul halkası alınır.
  // Altın halka yalnız en az goldCoins altın sığan bölüme konur (yoksa 2 kat anlamsız kalır).
  function gatePlan(gate, spots, gateSize = 10) {
    const plan = new Map();
    const has = p => (spots(p) || []).length > 0;
    if (gate === 1) { if (has(LOOT.introPos)) plan.set(LOOT.introPos, 'chest'); return plan; }
    const r = rng(7919 * gate);
    const pool = [];
    for (let p = 2; p <= gateSize; p++) if (has(p)) pool.push(p);
    for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
    const take = (type, ok = () => true) => {
      const k = pool.findIndex(ok);
      if (k >= 0) plan.set(pool.splice(k, 1)[0], type);
    };
    for (let k = 0; k < LOOT.chestsPerGate; k++) take('chest');
    for (let k = 0; k < LOOT.goldPerGate; k++) take('gold', p => !!goldSpot(spots(p)));
    if (LOOT.bulbGates.includes(gate)) take('bulb');
    return plan;
  }
  // Bir bölümde ödülün duracağı aday: altın halka için yeterince altın sığan ilk aday, diğerleri için ilk aday
  const goldSpot = cands => (cands || []).find(c => c[3] >= LOOT.goldCoins) || null;
  const spotFor = (type, cands) => (type === 'gold' ? goldSpot(cands) : (cands || [])[0] || null);

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

  const api = { ECONOMY, LOOT, STICKERS, STREAK, streakStep, rng, gatePlan, spotFor, chestFor, stickerLevels };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingRewards = api;
})(this);
