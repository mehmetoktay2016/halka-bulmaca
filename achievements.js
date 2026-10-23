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
    // 2.4: kapı 21-30
    { id: 'fener-yolu', group: 'Yolculuk', name: 'Fener Yolu', desc: '25 kapıyı bitir', tier: 'gumus', icon: 'kapi', goal: 25, value: c => c.gatesDone },
    { id: 'yildiz-haritasi', group: 'Yolculuk', name: 'Yıldız Haritası', desc: '30 kapının hepsini bitir', tier: 'altin', icon: 'teleskop', goal: 30, value: c => c.gatesDone },
    // 2.5: kapı 31-40
    { id: 'buyu-esigi', group: 'Yolculuk', name: 'Büyünün Eşiği', desc: '35 kapıyı bitir', tier: 'gumus', icon: 'kapi', goal: 35, value: c => c.gatesDone },
    { id: 'anka-yuvasi', group: 'Yolculuk', name: "Anka'nın Yuvası", desc: '40 kapının hepsini bitir', tier: 'altin', icon: 'anka', goal: 40, value: c => c.gatesDone },
    // 2.6: kapı 41-50
    { id: 'kum-yolu', group: 'Yolculuk', name: 'Kum Yolu', desc: '45 kapıyı bitir', tier: 'gumus', icon: 'kapi', goal: 45, value: c => c.gatesDone },
    { id: 'gokyuzu-sarayi', group: 'Yolculuk', name: 'Gökyüzü Sarayı', desc: '50 kapının hepsini bitir', tier: 'altin', icon: 'bulut', goal: 50, value: c => c.gatesDone },
    // Yıldız
    { id: 'yildiz-50', group: 'Yıldız', name: 'Yıldız Toplayıcı', desc: '50 yıldız topla', tier: 'bronz', icon: 'yildiz', goal: 50, value: c => c.stars },
    { id: 'yildiz-150', group: 'Yıldız', name: 'Yıldız Avcısı', desc: '150 yıldız topla', tier: 'gumus', icon: 'yildiz', goal: 150, value: c => c.stars },
    { id: 'yildiz-300', group: 'Yıldız', name: 'Gökyüzü', desc: '300 yıldız topla', tier: 'altin', icon: 'yildiz', goal: 300, value: c => c.stars },
    { id: 'yildiz-600', group: 'Yıldız', name: 'Samanyolu', desc: '600 yıldız topla', tier: 'altin', icon: 'yildiz', goal: 600, value: c => c.stars },
    { id: 'yildiz-900', group: 'Yıldız', name: 'Takımyıldız', desc: '900 yıldız topla', tier: 'altin', icon: 'yildiz', goal: 900, value: c => c.stars },
    { id: 'yildiz-1200', group: 'Yıldız', name: 'Galaksi', desc: '1200 yıldız topla', tier: 'altin', icon: 'yildiz', goal: 1200, value: c => c.stars },
    { id: 'yildiz-1500', group: 'Yıldız', name: 'Evren', desc: '1500 yıldız topla', tier: 'altin', icon: 'yildiz', goal: 1500, value: c => c.stars },
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
    // Parçalar ve anlar (2.5): sayaçlar oyuncu kaydının stats alanında (game.js stat)
    { id: 'bombaci', group: 'Parçalar', name: 'Bombacı', desc: '10 bomba patlat', tier: 'bronz', icon: 'bomba', goal: 10, value: c => c.st.bombs },
    { id: 'buz-kiran', group: 'Parçalar', name: 'Buz Kıran', desc: '20 buz kabuğu kır', tier: 'bronz', icon: 'buz', goal: 20, value: c => c.st.iceCracks },
    { id: 'kazan-ustasi', group: 'Parçalar', name: 'Kazan Ustası', desc: '10 kazan patlat', tier: 'gumus', icon: 'kazan', goal: 10, value: c => c.st.boilers },
    { id: 'isinlanan', group: 'Parçalar', name: 'Işınlanan', desc: '10 kez portaldan geç', tier: 'gumus', icon: 'portal', goal: 10, value: c => c.st.teleports },
    // 2.6 parçaları
    { id: 'renk-ustasi', group: 'Parçalar', name: 'Renk Ustası', desc: '10 renk patlaması yap', tier: 'bronz', icon: 'seker', goal: 10, value: c => c.st.paints },
    { id: 'circirci', group: 'Parçalar', name: 'Cırcırcı', desc: '50 kez cırcır çevir', tier: 'bronz', icon: 'disli', goal: 50, value: c => c.st.ratchets },
    { id: 'inci-avcisi', group: 'Parçalar', name: 'İnci Avcısı', desc: '10 inci çıkar', tier: 'gumus', icon: 'inci', goal: 10, value: c => c.st.pearls },
    { id: 'ikizler', group: 'Parçalar', name: 'İkizler', desc: 'Zincirli ikizleri 10 kez birlikte uçur', tier: 'gumus', icon: 'zincir', goal: 10, value: c => c.st.twins },
    { id: 'ruzgargulu', group: 'Parçalar', name: 'Rüzgârgülü', desc: '10 kez rüzgâr estir', tier: 'bronz', icon: 'ruzgar', goal: 10, value: c => c.st.gusts },
    { id: 'dev-avcisi', group: 'Anlar', name: 'Dev Avcısı', desc: 'İlk Dev Halkayı yen', tier: 'bronz', icon: 'dev', goal: 1, value: c => c.st.bosses },
    { id: 'devlerin-korkusu', group: 'Anlar', name: 'Devlerin Korkusu', desc: '10 Dev Halka yen', tier: 'altin', icon: 'dev', goal: 10, value: c => c.st.bosses },
    { id: 'yagmur-cocugu', group: 'Anlar', name: 'Yağmur Çocuğu', desc: 'İlk Altın Yağmurunu bitir', tier: 'bronz', icon: 'yagmur', goal: 1, value: c => c.st.rains },
    { id: 'saganak', group: 'Anlar', name: 'Sağanak', desc: '10 Altın Yağmuru bitir', tier: 'gumus', icon: 'yagmur', goal: 10, value: c => c.st.rains },
    { id: 'merakli', group: 'Anlar', name: 'Meraklı', desc: '10 gizem halka aç', tier: 'gumus', icon: 'soru', goal: 10, value: c => c.st.mysteries },
    { id: 'seri-usta', group: 'Anlar', name: 'Seri Usta', desc: '5 bölümü üst üste kusursuz bitir', tier: 'gumus', icon: 'alev', goal: 5, value: c => c.st.bestStreak },
    // Gizli: kazanılana kadar adı ve koşulu görünmez (game.js badgesHtml)
    { id: 'son-nefes', group: 'Gizli', secret: true, name: 'Son Nefes', desc: 'Son hamlende kazan', tier: 'gumus', icon: 'kalp', goal: 1, value: c => c.st.lastBreath },
    { id: 'cig', group: 'Gizli', secret: true, name: 'Çığ', desc: 'Bir hamlede 5 halka aç', tier: 'altin', icon: 'zincir', goal: 5, value: c => c.bestChain },
    { id: 'sabirli', group: 'Gizli', secret: true, name: 'Sabırlı', desc: 'Bir bölümü 5. denemende bitir', tier: 'bronz', icon: 'kum-saati', goal: 1, value: c => c.st.patient },
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
    teleskop: '<path d="M4 12.5l12-5 1.8 4.2-12 5zM15 8.2l3.5-1.5 1.8 4.2-3.5 1.5M10 15l-3 6M11 15l3 6"/><circle cx="10.5" cy="14.4" r="1"/>',
    disli: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    yildiz: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    'uc-yildiz': '<path d="M6 13l1 2 2.2.3-1.6 1.5.4 2.2L6 18l-2 1 .4-2.2-1.6-1.5L5 15zM18 13l1 2 2.2.3-1.6 1.5.4 2.2L18 18l-2 1 .4-2.2-1.6-1.5L17 15zM12 4l1.3 2.6 2.9.4-2.1 2 .5 2.9L12 10.5l-2.6 1.4.5-2.9-2.1-2 2.9-.4z"/>',
    beyin: '<circle cx="12" cy="12" r="8"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    zincir: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
    kalp: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    pati: '<circle cx="7" cy="10" r="1.8"/><circle cx="10.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M12 11c3 0 5.5 4 5.5 6a2.5 2.5 0 0 1-3 2.3c-1-.2-1.6-.6-2.5-.6s-1.5.4-2.5.6a2.5 2.5 0 0 1-3-2.3c0-2 2.5-6 5.5-6z"/>',
    album: '<path d="M4 5.5A2 2 0 0 1 6 4h13v14H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 2h13v-4"/><circle cx="12" cy="10" r="2.5"/>',
    altin: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/>',
    anka: '<path d="M12 21v-6M12 15c-1.5-2-5-2.5-8-6 3 .5 5 0 6-1.5M12 15c1.5-2 5-2.5 8-6-3 .5-5 0-6-1.5M10 7.5a2 2 0 1 1 4 0c0 1.5-1 2.5-2 3.5-1-1-2-2-2-3.5zM9.5 21h5"/>',
    bomba: '<circle cx="10.5" cy="14" r="6"/><path d="M14.5 9.5l2-2M16.5 7.5c.5-1.5 2-2.5 3.5-2M18.5 3v1.5M21 5.5h-1.5"/>',
    buz: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
    kazan: '<path d="M5 10h14v5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5zM3.5 10h17M9 7c0-1.2 1-1.5 1-2.8M14 7c0-1.2 1-1.5 1-2.8M8 20.5l-1 1.5M16 20.5l1 1.5"/>',
    portal: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5a4.5 4.5 0 1 1-4.5 4.5c0-1.6 1.2-2.8 2.8-2.8a2 2 0 0 1 0 4"/>',
    dev: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><path d="M12 3.5v3.5M20.5 12H17M12 20.5V17M3.5 12H7"/>',
    yagmur: '<circle cx="7" cy="7" r="2.5"/><circle cx="16" cy="5.5" r="2.5"/><circle cx="12" cy="13" r="2.5"/><circle cx="6" cy="18.5" r="2.5"/><circle cx="17.5" cy="17" r="2.5"/>',
    soru: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.5"/>',
    alev: '<path d="M12 21c-3.5 0-6-2.5-6-5.8 0-3.7 3.5-5.2 4-9.2 2.5 1.5 3 3.5 2.8 5.2 1-.5 1.7-1.5 2-2.7 1.8 1.6 3.2 3.9 3.2 6.7 0 3.3-2.5 5.8-6 5.8z"/>',
    'kum-saati': '<path d="M6.5 3h11M6.5 21h11M7.5 3c0 5 4.5 6 4.5 9s-4.5 4-4.5 9M16.5 3c0 5-4.5 6-4.5 9s4.5 4 4.5 9M10 18.5h4"/>',
    ampul: '<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    // 2.6: sarılı şeker, istiridyede inci, rüzgâr çizgileri, bulut
    seker: '<circle cx="12" cy="12" r="4.5"/><path d="M7.5 12L3 8.5v7zM16.5 12L21 8.5v7z"/>',
    inci: '<path d="M3.5 13.5c2-5 15-5 17 0-2 4-15 4-17 0z"/><circle cx="12" cy="10.5" r="2.5"/>',
    ruzgar: '<path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7"/>',
    bulut: '<path d="M7 18.5a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9.2a4.5 4.5 0 0 1 .5 9.3z"/>',
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
