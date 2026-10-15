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
