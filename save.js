// Oyuncu kaydı: yükleme, eski sürümlerden taşıma ve kilit sınırı.
// Hem tarayıcıda (window.RingSave) hem Node'da (require) çalışır.
// v3: yıldız ve skor, ekrandaki sıra numarasıyla değil bölümün kalıcı kimliğiyle
// (levels.js'teki kaynak numarası) tutulur; böylece bölüm sırası değişse de kayıt bozulmaz.
(function (root) {
  'use strict';

  const KEY = 'halka.progress.v3';
  const V2_KEY = 'halka.progress.v2';
  const V1_KEY = 'halka.progress.v1';
  const START_HINTS = 3;

  // v2'de oyuncunun gördüğü sıra (ORDER[n-1] = kaynak bölüm). v2 kayıtları bu sırayla tutuluyordu;
  // sıra artık değişeceği için taşıma için burada sabitlendi. Değiştirmeyin.
  const V2_ORDER = [1, 2, 4, 5, 9, 7, 8, 3, 11, 52, 10, 13, 51, 12, 14, 58, 6, 15, 17, 21,
    16, 19, 53, 18, 20, 54, 23, 24, 22, 55, 27, 29, 56, 26, 33, 31, 25, 32, 28, 57,
    35, 39, 59, 41, 45, 47, 38, 42, 48, 50, 34, 37, 49, 60, 43, 30, 36, 44, 46, 40];

  function fresh() {
    return {
      version: 3,
      layout: 4,          // bölüm düzeni: 4 = kapı içi zorluk yakınlığa göre (2.2); eskiler relayout ile taşınır
      stars: {},          // bölüm kimliği -> en iyi yıldız (kayıt varsa bölüm bitirilmiştir)
      best: {},           // bölüm kimliği -> en iyi skor
      sound: true,        // oyun sesleri
      ambient: true,      // dünyanın ortam sesi
      effects: true,      // arka plan parçacıkları ve büyük patlamalar
      coins: 0,
      hints: START_HINTS, // ampul (ipucu hakkı)
      hintGiftDay: null,  // son ücretsiz günlük ampulün verildiği gün (YYYY-AA-GG)
      bulbsBought: 0,     // altınla alınan ampul sayısı (başarımlar için)
      badges: {},         // rozet kimliği -> kazanıldığı gün
      clean: {},          // ipucusuz bitirilen bölümler (bölüm kimliği -> true)
      seenBadges: {},     // koleksiyon ekranında görülmüş rozetler (kırmızı nokta için)
      stats: {},          // başarım sayaçları: chains, bestChain, comebacks, hintsUsed, coinsTotal
      rewards: {},        // verilmiş tek seferlik ödüller (kapı, final, altın kapı)
      loot: {},           // halka ödülü alınmış bölümler (bölüm kimliği -> ödül türü); her bölümde bir kez
      stickers: {},       // toplanan çıkartma parçaları (parça kimliği -> kazanıldığı gün)
      streak: null,       // günlük seri: { day: 'YYYY-AA-GG', count }
      owned: {},          // mağazadan alınan süsler (ürün kimliği -> true)
      equip: {},          // kullanılan süs: { burst, pop, win } (yoksa her bölümün bedava ilki)
      seenPieces: {},     // kartı görülmüş parçalar (pieces.js kimliği -> true)
      bonus: {},          // meydan okumalar (2.5): sıra numarası -> en iyi yıldız; ilerlemeyi ve yıldız toplamını etkilemez
    };
  }

  // Ekran sırasına göre tutulan v2 kaydını bölüm kimliğine çevirir
  function fromV2(p) {
    const out = { ...fresh(), sound: p.sound !== false, coins: p.coins || 0 };
    for (const flag of ['coinTip', 'tutorialDone']) if (p[flag]) out[flag] = p[flag];
    for (const field of ['stars', 'best']) {
      for (const [n, v] of Object.entries(p[field] || {})) {
        const src = V2_ORDER[Number(n) - 1];
        if (src != null && v) out[field][String(src)] = v;
      }
    }
    return out;
  }

  // v1'in sırası bambaşkaydı; ondan yalnızca altın ve ayarlar taşınır
  function fromV1(p) {
    return { ...fresh(), coins: p.coins || 0, sound: p.sound !== false, coinTip: p.coinTip };
  }

  function readJSON(storage, key) {
    try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; }
  }

  // Kaydı okur; eski bir sürüm bulursa çevirip v3 olarak yazar (eski kayıt silinmez).
  function load(storage) {
    try {
      const p3 = readJSON(storage, KEY);
      // layout alanı olmayan kayıt 2.2'den önceki düzendedir (relayout taşır)
      if (p3 && p3.version === 3) return { ...fresh(), layout: 3, ...p3 };
      const p2 = readJSON(storage, V2_KEY);
      const p1 = p2 ? null : readJSON(storage, V1_KEY);
      const p = p2 && p2.unlocked ? { ...fromV2(p2), layout: 3 } : p1 ? fromV1(p1) : fresh();
      if (p2 || p1) save(storage, p);
      return p;
    } catch (e) {
      return fresh(); // gizli sekme vb.
    }
  }

  function save(storage, progress) {
    try { storage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* yok say */ }
  }

  // 2.2'de bölümler yeniden üretildi ve kapı içi sırası değişti. Oyuncu ekrandaki yerini korusun diye
  // bölüm kimliğine bağlı kayıtlar sıra numarası üzerinden taşınır: eski düzende n. sıradaki bölümün
  // kaydı yeni düzende n. sıradaki bölüme geçer. Taşıma yapıldıysa true döner (bir kez çalışır).
  function relayout(progress, oldOrder, newOrder) {
    if (progress.layout === 4) return false;
    const pos = new Map(oldOrder.map((src, i) => [String(src), i]));
    for (const field of ['stars', 'best', 'clean', 'loot']) {
      const out = {};
      for (const [id, v] of Object.entries(progress[field] || {})) {
        const i = pos.get(id);
        out[i == null || newOrder[i] == null ? id : String(newOrder[i])] = v;
      }
      progress[field] = out;
    }
    progress.layout = 4;
    return true;
  }

  // Açık olan son sıra numarası: bitirilmiş en ileri bölümün bir sonrası.
  // order[n-1] = n. sıradaki bölümün kimliği.
  function frontier(progress, order) {
    let f = 1;
    for (let n = 1; n <= order.length; n++) if (progress.stars[String(order[n - 1])]) f = n + 1;
    return Math.min(f, order.length);
  }

  const api = { KEY, V2_KEY, V1_KEY, V2_ORDER, START_HINTS, fresh, fromV2, fromV1, load, save, relayout, frontier };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingSave = api;
})(this);
