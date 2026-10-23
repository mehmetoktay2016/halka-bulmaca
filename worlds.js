// Yolculuk: dünyalar, kapılar, unvanlar ve her dünyanın görünümü (tema).
// Hem tarayıcıda (window.RingWorlds) hem Node'da (require) çalışır.
// Kural: tema yalnızca atmosferi değiştirir (zemin, ışık, vurgu rengi);
// halka renkleri, kilitli halka ve çubuk her dünyada aynıdır (PIECE_COLORS).
(function (root) {
  'use strict';

  const GATE_SIZE = 10;

  // Oynanış dilinin renkleri: her dünyada aynı kalır
  const PIECE_COLORS = {
    rings: ['#ff6b6b', '#ffc94a', '#2dd4bf', '#4cc9f0', '#b388ff',
            '#ff9f1c', '#f72585', '#90be6d', '#4895ef', '#f4a261'],
    fixed: '#5d6488',
    bar: '#c3cada',
    // 2.6 şeker renkleri (çilek, nane, limon) ve renkli halkalı bölümde renksiz halkalar: onlara karışmayan
    // lavanta, karamel, gök mavisi
    paints: ['#ff6fc0', '#4fdcb0', '#ffd34a'],
    plain: ['#a48be0', '#d39a62', '#7fa8e8'],
    // 2.6 cırcır pirinç; cırcırlı bölümde renksizler sarısız: turkuaz, kiremit, lacivert taşı
    ratchet: '#f0b44a',
    desert: ['#3fc8c0', '#e07a52', '#6f8cf0'],
    // 2.6 istiridye lila-gri, inci sedef
    shell: '#a99bc4',
    pearl: '#f4efe6',
  };

  // top/bottom: zeminin dikey geçişi; glows: köşelerden vuran renkli ışıklar (renk, opaklık)
  // board: oyun tahtasının dokusu (scenery.js çizer); tint en fazla alpha opaklıkla zemine biner
  // air: arka planda süzülen parçacıklar; ortam sesi dünyanın kimliğiyle seçilir (ambience.js)
  const WORLDS = [
    { id: 'vadi', name: 'Başlangıç Vadisi', title: 'Gezgin',
      intro: 'Halkaları döndür, boşlukları kesişimlere getir.',
      theme: { top: '#181d3a', bottom: '#0b0e1c', accent: '#2dd4bf',
               glows: [['#625cff', 0.28], ['#2dd4bf', 0.14], ['#ff6b6b', 0.12]],
               board: { kind: 'cayir', tint: '#7fd1b0', alpha: 0.07 }, air: 'polen' } },
    { id: 'atolye', name: 'Atölye', title: 'Tamirci',
      intro: 'Tezgâhtaki çarklar birbirine bağlı. Biri sağa dönerse eşi sola döner.',
      theme: { top: '#241912', bottom: '#100a07', accent: '#ffb347',
               glows: [['#ff9f43', 0.13], ['#c9852a', 0.10], ['#ff6b3d', 0.08]],
               board: { kind: 'ahsap', tint: '#c08a55', alpha: 0.12 }, air: 'kivilcim' } },
    { id: 'saat', name: 'Saat Kulesi', title: 'Saatçi',
      intro: 'Buradaki halkalar tık tık döner. Doğru adımı bul.',
      theme: { top: '#121b33', bottom: '#080d1a', accent: '#d9b45a',
               glows: [['#d9b45a', 0.12], ['#4c7cf0', 0.14], ['#8a6cff', 0.08]],
               board: { kind: 'kadran', tint: '#d9b45a', alpha: 0.10 }, air: 'disli' } },
    { id: 'zindan', name: 'Zindan', title: 'Kilit Ustası',
      intro: 'Kilitli halkaların anahtarı başka bir halkada. Önce anahtarı kurtar.',
      theme: { top: '#1f1c22', bottom: '#0b0a0d', accent: '#ff9b45',
               glows: [['#ff8a3d', 0.20], ['#7a5cff', 0.08], ['#ff5a3d', 0.08]],
               board: { kind: 'tas', tint: '#9a8f86', alpha: 0.11 }, air: 'kor' } },
    { id: 'sehir', name: 'Şehir', title: 'Mimar',
      intro: 'Çerçeveler yerinden oynamaz. Halkaları onların etrafından kurtar.',
      theme: { top: '#231a37', bottom: '#0e0a18', accent: '#ff8fab',
               glows: [['#ff7aa2', 0.13], ['#ffb347', 0.08], ['#625cff', 0.14]],
               board: { kind: 'kaldirim', tint: '#c9a0c8', alpha: 0.10 }, air: 'isik' } },
    { id: 'fabrika', name: 'Fabrika', title: 'Mühendis',
      intro: 'Hızlı dişliler eşlerini iki kat çevirir. Hesabını iyi yap.',
      theme: { top: '#222830', bottom: '#0c0f13', accent: '#e0703a',
               glows: [['#c0582b', 0.18], ['#4cc9f0', 0.10], ['#90a4b8', 0.10]],
               board: { kind: 'metal', tint: '#9fb0c2', alpha: 0.09 }, air: 'buhar' } },
    { id: 'uzay', name: 'Uzay', title: 'Astronot',
      intro: 'Bütün parçalar bir arada. Yerçekimi yok, sabır var.',
      theme: { top: '#0c0f22', bottom: '#020309', accent: '#7cc4ff',
               glows: [['#4c6cff', 0.20], ['#b388ff', 0.14], ['#2dd4bf', 0.08]],
               board: { kind: 'yildiz', tint: '#9cc8ff', alpha: 0.12 }, air: 'yildiz' } },
    { id: 'usta', name: 'Büyük Usta', title: 'Halka Ustası',
      intro: 'Yolculuğun son durağı. Öğrendiğin her şey burada lazım.',
      theme: { top: '#181934', bottom: '#0a0b1a', accent: '#ffd36b',
               glows: [['#ffc94a', 0.12], ['#625cff', 0.18], ['#ff6b6b', 0.08]],
               board: { kind: 'mermer', tint: '#e6d3a3', alpha: 0.10 }, air: 'altin' } },
    // 2.4: yeni dünyalar (kapı 21-30): kendi tahta dokuları, parçacıkları ve ortam sesleri (Y7)
    { id: 'lunapark', name: 'Lunapark', title: 'Cambaz',
      intro: 'Yaylı halkalar kurtulunca komşusunu iter. Zinciri sen kur.',
      theme: { top: '#2a1533', bottom: '#110818', accent: '#ff6fb5',
               glows: [['#ff4fa3', 0.16], ['#ffd34a', 0.10], ['#4cc9f0', 0.10]],
               board: { kind: 'cadir', tint: '#e0a0d0', alpha: 0.10 }, air: 'konfeti' } },
    { id: 'santral', name: 'Santral', title: 'Elektrikçi',
      intro: 'Şalteri çevir: bir renk durur, öbürü döner.',
      theme: { top: '#0f1d24', bottom: '#060c10', accent: '#7cf0ff',
               glows: [['#38e0ff', 0.15], ['#ffe14a', 0.08], ['#4c6cff', 0.10]],
               board: { kind: 'devre', tint: '#7fc4d4', alpha: 0.08 }, air: 'elektrik' } },
    { id: 'fener', name: 'Deniz Feneri', title: 'Fener Bekçisi',
      intro: 'Fenerin ışığı gibi bazı boşluklar her hamlede açılıp kapanır.',
      theme: { top: '#0a1826', bottom: '#050c14', accent: '#ffd27a',
               glows: [['#ffd27a', 0.10], ['#2a9df4', 0.12], ['#2dd4bf', 0.08]],
               board: { kind: 'dalga', tint: '#9cc8e8', alpha: 0.11 }, air: 'fener' } },
    { id: 'rasathane', name: 'Rasathane', title: 'Gökbilimci',
      intro: 'Döner tablalar halkaları gezegenler gibi taşır.',
      theme: { top: '#100c26', bottom: '#04030c', accent: '#c3a6ff',
               glows: [['#8a6cff', 0.20], ['#4cc9f0', 0.10], ['#ffd36b', 0.08]],
               board: { kind: 'gokkure', tint: '#b9a8ff', alpha: 0.11 }, air: 'gezegen' } },
    // 2.5: yeni dünyalar (kapı 31-40): kendi tahta dokuları, parçacıkları ve ortam sesleri (Z6)
    { id: 'fisek', name: 'Havai Fişek', title: 'Fişekçi',
      intro: 'Bomba halka kurtulunca patlar, dokunduğu halkaları da uçurur.',
      theme: { top: '#26121a', bottom: '#10070b', accent: '#ff7a45',
               glows: [['#ff5a3d', 0.18], ['#ffd34a', 0.10], ['#b388ff', 0.10]],
               board: { kind: 'barut', tint: '#e8a090', alpha: 0.10 }, air: 'fisek' } },
    { id: 'buzul', name: 'Buzul', title: 'Kutup Kâşifi',
      intro: 'Donmuş halkalar dönmez. Komşuları kurtuldukça buzları çatlar.',
      theme: { top: '#0f2130', bottom: '#060e16', accent: '#9be7ff',
               glows: [['#7fd8ff', 0.12], ['#ffffff', 0.03], ['#8a6cff', 0.08]],
               board: { kind: 'buz', tint: '#8fc8e6', alpha: 0.08 }, air: 'kar' } },
    { id: 'degirmen', name: 'Değirmen', title: 'Değirmenci',
      intro: 'Motorlu halkalar her hamlenden sonra kendiliğinden bir adım döner.',
      theme: { top: '#16210f', bottom: '#080d06', accent: '#b5e06a',
               glows: [['#90be6d', 0.12], ['#ffd36b', 0.10], ['#4cc9f0', 0.08]],
               board: { kind: 'tas_degirmen', tint: '#a8b880', alpha: 0.09 }, air: 'yel' } },
    { id: 'buyu', name: 'Büyü Kulesi', title: 'Büyücü',
      intro: 'İkiz portallardan biri kurtulunca eşi de ışınlanıp kurtulur.',
      theme: { top: '#1a0d2a', bottom: '#09040f', accent: '#e07cff',
               glows: [['#c45cff', 0.20], ['#4cc9f0', 0.10], ['#ff6fb5', 0.08]],
               board: { kind: 'tilsim', tint: '#d0a8ff', alpha: 0.11 }, air: 'buyu' } },
    // 2.6: yeni dünyalar (kapı 41-50). Tahta dokusu, parçacık ve ortam sesi dünya görünümü görevine kadar eski dünyalardan ödünç
    { id: 'seker', name: 'Şeker Diyarı', title: 'Şekerci',
      intro: 'Renk Bombası kurtulunca kendi rengindeki bütün halkalar da uçar.',
      theme: { top: '#2a1228', bottom: '#12070f', accent: '#ff7ac8',
               glows: [['#ff6fc0', 0.16], ['#7cf0d0', 0.08], ['#ffd34a', 0.08]],
               board: { kind: 'seker', tint: '#f0a8d8', alpha: 0.10 }, air: 'seker' } },
    { id: 'piramit', name: 'Piramit', title: 'Arkeolog',
      intro: 'Cırcırlı halkalar yalnız tek yöne döner. Fazla çevirirsen geri dönemezsin.',
      theme: { top: '#21180c', bottom: '#0e0a04', accent: '#f0b44a',
               glows: [['#f0b44a', 0.11], ['#ff7a45', 0.07], ['#4cc9f0', 0.05]],
               board: { kind: 'piramit', tint: '#c8a870', alpha: 0.08 }, air: 'piramit' } },
    { id: 'mercan', name: 'Mercan Resifi', title: 'Dalgıç',
      intro: 'İstiridye açılınca içinden inci halka çıkar. Zincirli ikizler ancak birlikte kurtulur.',
      theme: { top: '#0b2230', bottom: '#040f16', accent: '#ff8a7a',
               glows: [['#ff8a7a', 0.12], ['#2dd4bf', 0.12], ['#4c7cf0', 0.08]],
               board: { kind: 'dalga', tint: '#8fd0d8', alpha: 0.10 }, air: 'buhar' } },
    { id: 'bulut', name: 'Bulut Krallığı', title: 'Bulut Bekçisi',
      intro: 'Raylı halkalar dönmez, rayda kayar. Kaydıkça kesişimleri değişir.',
      theme: { top: '#121a35', bottom: '#080c1c', accent: '#9fd8ff',
               glows: [['#9fd8ff', 0.10], ['#ffc0e0', 0.07], ['#ffd36b', 0.06]],
               board: { kind: 'mermer', tint: '#b8cce4', alpha: 0.07 }, air: 'isik' } },
  ];

  // Kapı n (1'den başlar): adı ve dünyası
  const GATES = [
    { name: 'İlk Adımlar', world: 'vadi' },
    { name: 'Kıvrımlar', world: 'vadi' },
    { name: 'Kesişimler', world: 'vadi' },
    { name: 'Düğümler', world: 'vadi' },
    { name: 'Zincirler', world: 'vadi' },
    { name: 'Vadi Kapısı', world: 'vadi' },
    { name: 'Tezgâh', world: 'atolye' },
    { name: 'Çark', world: 'atolye' },
    { name: 'Sarkaç', world: 'saat' },
    { name: 'Zemberek', world: 'saat' },
    { name: 'Hücreler', world: 'zindan' },
    { name: 'Mahzen', world: 'zindan' },
    { name: 'Sokaklar', world: 'sehir' },
    { name: 'Meydan', world: 'sehir' },
    { name: 'Montaj Hattı', world: 'fabrika' },
    { name: 'Buhar Kazanı', world: 'fabrika' },
    { name: 'Yörünge', world: 'uzay' },
    { name: 'Takımyıldız', world: 'uzay' },
    { name: 'Ustalar Salonu', world: 'usta' },
    { name: 'Büyük Makine', world: 'usta' },
    { name: 'Bilet Gişesi', world: 'lunapark' },
    { name: 'Çarpışan Arabalar', world: 'lunapark' },
    { name: 'Hız Treni', world: 'lunapark' },
    { name: 'Trafo', world: 'santral' },
    { name: 'Baraj', world: 'santral' },
    { name: 'Liman', world: 'fener' },
    { name: 'Kayalıklar', world: 'fener' },
    { name: 'Fener Kulesi', world: 'fener' },
    { name: 'Ay Işığı', world: 'rasathane' },
    { name: 'Yıldız Haritası', world: 'rasathane' },
    { name: 'Barut Deposu', world: 'fisek' },
    { name: 'Fitil', world: 'fisek' },
    { name: 'Gökyüzü Şöleni', world: 'fisek' },
    { name: 'Kar Tepesi', world: 'buzul' },
    { name: 'Buz Mağarası', world: 'buzul' },
    { name: 'Su Arkı', world: 'degirmen' },
    { name: 'Yel Değirmeni', world: 'degirmen' },
    { name: 'Çark Evi', world: 'degirmen' },
    { name: 'Ayna Salonu', world: 'buyu' },
    { name: 'Portal', world: 'buyu' },
    { name: 'Şekerleme Dükkânı', world: 'seker' },
    { name: 'Lolipop Bahçesi', world: 'seker' },
    { name: 'Çikolata Nehri', world: 'seker' },
    { name: 'Kum Tepeleri', world: 'piramit' },
    { name: 'Firavun Odası', world: 'piramit' },
    { name: 'Sığ Sular', world: 'mercan' },
    { name: 'İstiridye Yatağı', world: 'mercan' },
    { name: 'Batık Gemi', world: 'mercan' },
    { name: 'Gökkuşağı Köprüsü', world: 'bulut' },
    { name: 'Bulut Sarayı', world: 'bulut' },
  ];

  // Unvanlar: bitirilen kapı sayısına göre. Dünya bitince o dünyanın unvanı gelir;
  // ilk dünya uzun olduğu için ortasında bir ara unvan var.
  const FIRST_TITLE = 'Çırak';
  const TITLES = [{ after: 3, title: 'Kalfa' }];
  GATES.forEach((g, i) => {
    const next = GATES[i + 1];
    if (!next || next.world !== g.world) TITLES.push({ after: i + 1, title: worldById(g.world).title });
  });
  TITLES.sort((a, b) => a.after - b.after);

  function worldById(id) { return WORLDS.find(w => w.id === id); }
  const gateOf = n => Math.ceil(n / GATE_SIZE);               // n. bölüm hangi kapıda
  const posInGate = n => ((n - 1) % GATE_SIZE) + 1;            // kapının içinde kaçıncı (1-10)
  const gateStart = g => (g - 1) * GATE_SIZE + 1;
  const worldOfGate = g => worldById((GATES[g - 1] || GATES[GATES.length - 1]).world);
  const isWorldStart = g => g === 1 || (GATES[g - 1] && GATES[g - 2] && GATES[g - 1].world !== GATES[g - 2].world);

  function titleFor(gatesDone) {
    let t = FIRST_TITLE;
    for (const x of TITLES) if (gatesDone >= x.after) t = x.title;
    return t;
  }

  // Zemin: oyunun --scene değişkeniyle aynı yapı (ışıklar + dikey geçiş)
  function sceneCss(theme) {
    const [a, b, c] = theme.glows;
    const rgba = (hex, al) => {
      const v = parseInt(hex.slice(1), 16);
      return `rgba(${v >> 16 & 255}, ${v >> 8 & 255}, ${v & 255}, ${al})`;
    };
    return [
      `radial-gradient(70% 45% at 15% 0%, ${rgba(a[0], a[1])}, transparent 70%)`,
      `radial-gradient(60% 40% at 100% 85%, ${rgba(b[0], b[1])}, transparent 70%)`,
      `radial-gradient(50% 35% at 0% 100%, ${rgba(c[0], c[1])}, transparent 70%)`,
      `linear-gradient(180deg, ${theme.top} 0%, ${theme.bottom} 100%)`,
    ].join(', ');
  }

  const api = {
    GATE_SIZE, PIECE_COLORS, WORLDS, GATES, FIRST_TITLE, TITLES,
    worldById, gateOf, posInGate, gateStart, worldOfGate, isWorldStart, titleFor, sceneCss,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingWorlds = api;
})(this);
