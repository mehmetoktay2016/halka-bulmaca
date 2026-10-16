// Başarımlar (rozetler): liste, ilerleme ve ödül.
// Hem tarayıcıda (window.RingBadges) hem Node'da (require) çalışır.
// Her rozet bir sayıya bakar: value(ctx) >= goal olunca kazanılır. ctx'i oyun hazırlar (game.js badgeCtx).
// Kural: rozet kimlikleri oyuncu kaydında tutulur; bir kez yayınlandıktan sonra değiştirilmez.
(function (root) {
  'use strict';

  // Kademe: ödül altını ve madalyanın rengi
  const TIERS = {
    bronz: { coins: 10, color: '#d08a4e' },
    gumus: { coins: 25, color: '#c3cbe0' },
    altin: { coins: 50, color: '#ffc94a' },
  };

  // icon: madalyanın ortasındaki çizim (game.js BADGE_ICONS)
  const BADGES = [
    // Yolculuk
    { id: 'ilk-adim', group: 'Yolculuk', name: 'İlk Adım', desc: 'İlk bölümü bitir', tier: 'bronz', icon: 'yol', goal: 1, value: c => c.wins },
    { id: 'ilk-kapi', group: 'Yolculuk', name: 'Kapıdan Geçen', desc: 'İlk kapıyı aç', tier: 'bronz', icon: 'kapi', goal: 1, value: c => c.gatesDone },
    { id: 'vadi', group: 'Yolculuk', name: 'Vadinin Gezgini', desc: "Başlangıç Vadisi'ni bitir", tier: 'gumus', icon: 'kapi', goal: 6, value: c => c.gatesDone },
    { id: 'kasif', group: 'Yolculuk', name: 'Kâşif', desc: '3 dünyaya ayak bas', tier: 'gumus', icon: 'dunya', goal: 3, value: c => c.worldsSeen },
    { id: 'yolun-yarisi', group: 'Yolculuk', name: 'Yolun Yarısı', desc: '10 kapıyı bitir', tier: 'gumus', icon: 'kapi', goal: 10, value: c => c.gatesDone },
    { id: 'buyuk-makine', group: 'Yolculuk', name: 'Büyük Makine', desc: '20 kapının hepsini bitir', tier: 'altin', icon: 'disli', goal: 20, value: c => c.gatesDone },
    // Yıldız
    { id: 'yildiz-50', group: 'Yıldız', name: 'Yıldız Toplayıcı', desc: '50 yıldız topla', tier: 'bronz', icon: 'yildiz', goal: 50, value: c => c.stars },
    { id: 'yildiz-150', group: 'Yıldız', name: 'Yıldız Avcısı', desc: '150 yıldız topla', tier: 'gumus', icon: 'yildiz', goal: 150, value: c => c.stars },
    { id: 'yildiz-300', group: 'Yıldız', name: 'Gökyüzü', desc: '300 yıldız topla', tier: 'altin', icon: 'yildiz', goal: 300, value: c => c.stars },
    { id: 'kusursuz', group: 'Yıldız', name: 'Kusursuz', desc: '10 bölümü 3 yıldızla bitir', tier: 'bronz', icon: 'uc-yildiz', goal: 10, value: c => c.perfect },
    { id: 'altin-kapi', group: 'Yıldız', name: 'Altın Kapı', desc: 'Bir kapının bütün bölümlerini 3 yıldızla bitir', tier: 'gumus', icon: 'kapi-altin', goal: 1, value: c => c.goldGates },
    { id: 'altin-yol', group: 'Yıldız', name: 'Altın Yol', desc: '5 altın kapı', tier: 'altin', icon: 'kapi-altin', goal: 5, value: c => c.goldGates },
    // Ustalık
    { id: 'kendi-basina', group: 'Ustalık', name: 'Kendi Başına', desc: '10 bölümü ipucusuz bitir', tier: 'bronz', icon: 'beyin', goal: 10, value: c => c.hintless },
    { id: 'bagimsiz', group: 'Ustalık', name: 'Bağımsız', desc: '50 bölümü ipucusuz bitir', tier: 'altin', icon: 'beyin', goal: 50, value: c => c.hintless },
    { id: 'zincirleme', group: 'Ustalık', name: 'Zincirleme', desc: 'Bir hamlede 2 halka aç', tier: 'bronz', icon: 'zincir', goal: 2, value: c => c.bestChain },
    { id: 'domino', group: 'Ustalık', name: 'Domino', desc: 'Bir hamlede 3 halka aç', tier: 'gumus', icon: 'zincir', goal: 3, value: c => c.bestChain },
    { id: 'zincir-ustasi', group: 'Ustalık', name: 'Zincir Ustası', desc: '25 zincir yap', tier: 'gumus', icon: 'zincir', goal: 25, value: c => c.chains },
    { id: 'pes-etmeyen', group: 'Ustalık', name: 'Pes Etmeyen', desc: 'Hamlesi bittiği bölümü ardından kazan', tier: 'bronz', icon: 'kalp', goal: 1, value: c => c.comebacks },
    // Koleksiyon
    { id: 'ilk-kurtaris', group: 'Koleksiyon', name: 'İlk Kurtarış', desc: 'İlk şekli kurtar', tier: 'bronz', icon: 'pati', goal: 1, value: c => c.shapes },
    { id: 'hayvan-dostu', group: 'Koleksiyon', name: 'Hayvan Dostu', desc: '10 şekli kurtar', tier: 'gumus', icon: 'pati', goal: 10, value: c => c.shapes },
    { id: 'album-tamam', group: 'Koleksiyon', name: 'Albüm Tamam', desc: 'Bütün şekilleri kurtar', tier: 'altin', icon: 'album', goal: c => c.shapesTotal, value: c => c.shapes },
    // Hazine
    { id: 'kumbara', group: 'Hazine', name: 'Kumbara', desc: 'Toplam 100 altın topla', tier: 'bronz', icon: 'altin', goal: 100, value: c => c.coinsTotal },
    { id: 'hazine', group: 'Hazine', name: 'Hazine', desc: 'Toplam 500 altın topla', tier: 'altin', icon: 'altin', goal: 500, value: c => c.coinsTotal },
    { id: 'alisveris', group: 'Hazine', name: 'Alışveriş', desc: 'Altınla ampul al', tier: 'bronz', icon: 'ampul', goal: 1, value: c => c.bulbsBought },
    { id: 'yardim', group: 'Hazine', name: 'Yardım İstemek Ayıp Değil', desc: 'İlk ipucunu kullan', tier: 'bronz', icon: 'ampul', goal: 1, value: c => c.hintsUsed },
  ];

  // Madalyanın ortasındaki çizimler (24×24, çizgi)
  const ICONS = {
    yol: '<path d="M8 4.5c1.4 0 2 1.6 2 3.4S9.3 11 8 11 6 9.7 6 7.9 6.6 4.5 8 4.5zM16 9c1.4 0 2 1.6 2 3.4s-.7 3.1-2 3.1-2-1.3-2-3.1S14.6 9 16 9zM7 13.5h2.5M15 18h2.5"/>',
    kapi: '<path d="M5 20V11a7 7 0 0 1 14 0v9M9 20v-7a3 3 0 0 1 6 0v7M3 20h18"/>',
    'kapi-altin': '<path d="M5 20V11a7 7 0 0 1 14 0v9M3 20h18"/><path d="M12 9.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/>',
    dunya: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16"/>',
    disli: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    yildiz: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    'uc-yildiz': '<path d="M6 13l1 2 2.2.3-1.6 1.5.4 2.2L6 18l-2 1 .4-2.2-1.6-1.5L5 15zM18 13l1 2 2.2.3-1.6 1.5.4 2.2L18 18l-2 1 .4-2.2-1.6-1.5L17 15zM12 4l1.3 2.6 2.9.4-2.1 2 .5 2.9L12 10.5l-2.6 1.4.5-2.9-2.1-2 2.9-.4z"/>',
    beyin: '<circle cx="12" cy="12" r="8"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    zincir: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
    kalp: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    pati: '<circle cx="7" cy="10" r="1.8"/><circle cx="10.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M12 11c3 0 5.5 4 5.5 6a2.5 2.5 0 0 1-3 2.3c-1-.2-1.6-.6-2.5-.6s-1.5.4-2.5.6a2.5 2.5 0 0 1-3-2.3c0-2 2.5-6 5.5-6z"/>',
    album: '<path d="M4 5.5A2 2 0 0 1 6 4h13v14H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 2h13v-4"/><circle cx="12" cy="10" r="2.5"/>',
    altin: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/>',
    ampul: '<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  };

  const goalOf = (b, ctx) => (typeof b.goal === 'function' ? b.goal(ctx) : b.goal);

  // Rozetin durumu: { value, goal, done } (value hedefte kesilir)
  function status(b, ctx) {
    const goal = goalOf(b, ctx);
    const value = Math.min(goal, b.value(ctx) || 0);
    return { value, goal, done: goal > 0 && value >= goal };
  }

  // Henüz kazanılmamış ama koşulu sağlanmış rozetler
  function newlyEarned(earned, ctx) {
    return BADGES.filter(b => !earned[b.id] && status(b, ctx).done);
  }

  const api = { TIERS, BADGES, ICONS, status, newlyEarned };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingBadges = api;
})(this);
