// Ekranlar, çizim, dokunma, ses ve efektler. Kurallar logic.js'te, seviyeler levels.js'te.
(() => {
  'use strict';

  const { TAU, DEG, GAP_HALF, angDist, signedDelta, buildLevel,
          pointOpen, cascade, rotate, solveFast, norm, canRotate, spend } = window.RingLogic;
  const { BOARD, getLevel, getTutorial, TUTORIAL } = window.RingLevels;
  // Dil: tr('Türkçe metin', { değişken }) seçili dilde döner (i18n.js); sayfadaki sabit metinler data-t ile
  const I18N = window.RingI18n, tr = I18N.t;
  I18N.applyDom();
  // Verideki metinlerden kayda yazılmayanlar (dünya, kapı, rozet, mağaza, çıkartma, öğretici, tanıtım) açılışta
  // seçili dile çevrilir. Unvanlar ve şekil adları kayıtta/anahtar olarak Türkçe kalır, ekrana yazılırken çevrilir.
  if (I18N.lang !== 'tr') {
    for (const w of window.RingWorlds.WORLDS) { w.name = tr(w.name); w.intro = tr(w.intro); }
    for (const g of window.RingWorlds.GATES) g.name = tr(g.name);
    for (const b of window.RingBadges.BADGES) { b.name = tr(b.name); b.desc = tr(b.desc); b.group = tr(b.group); }
    for (const c of Object.values(window.RingRewards.SHOP)) {
      c.title = tr(c.title); c.tab = tr(c.tab);
      for (const it of c.items) { it.name = tr(it.name); it.desc = tr(it.desc); }
    }
    for (const st of Object.values(window.RingStickers.SETS)) st.name = tr(st.name);
    for (const d of window.RingLevels.TUTORIAL) { d.title = tr(d.title); d.text = tr(d.text); }
    for (const d of Object.values(window.RingLevels.MECH_LEVELS)) { d.title = tr(d.title); if (d.tip) d.tip = tr(d.tip); }
  }

  // Oyuncunun gördüğü sıra: 10'ar bölümlük kapılar (levels.js gateOrder).
  // ORDER[n-1] = levels.js'teki kaynak seviye (1-50 normal, 51-60 şekiller).
  const W = window.RingWorlds;
  const ORDER = window.RingLevels.gateOrder(getLevel);
  const TOTAL = ORDER.length;
  const GATE_COUNT = TOTAL / W.GATE_SIZE; // bölümleri hazır olan kapı sayısı
  // Bölümleri hazır olan dünyalar: yolculuğa yeni eklenen ama henüz bölümü olmayan dünyalar
  // haritada yalnızca kapalı kemer olarak görünür; çıkartma, sayaç ve kapanışa girmez
  const LIVE_WORLDS = W.WORLDS.filter(w => W.GATES.slice(0, GATE_COUNT).some(g => g.world === w.id));
  const srcOf = n => ORDER[n - 1];
  const BAR_COLOR = W.PIECE_COLORS.bar;
  const COLORS = W.PIECE_COLORS.rings;
  const FIXED_COLOR = W.PIECE_COLORS.fixed;
  const STROKE = 13;
  const FLY_MS = 520;
  const WAVE_MS = 170;
  const COIN_MS = 650;
  const KEY_MS = 560;   // anahtarın kilide uçuşu
  const KICK_WAIT = 140; // yaylı halka uçmaya başladıktan sonra tekmenin gelişi
  const KICK_MS = 420;   // tekmeyle dönen halkanın dönüşü (sonda hafif geri yaylanır)
  const TOKEN_FLY_MS = 620; // jetonun taşıyan halkadan jetonlu halkaya uçuşu
  // Şalter renkleri (halka paletinden ayrı): 0 mavi, 1 turuncu. Şalterli halka kendi rengini değil bunu alır.
  const SIDE_COLORS = ['#3d9bff', '#ff8a1f'];
  const SWITCH_W = 84, SWITCH_H = 40, SWITCH_MS = 180;
  const PULSE_MS = 260; // nabız kapağının açılıp kapanması
  const LAMP = '#ffd27a';
  const OPEN_MS = 420;  // kilidin açılışı
  const KEY_ICON = 1.3; // kilit ve anahtar simgesinin büyüklüğü
  const HELP_IDLE_MS = 30000; // bu kadar süre hamle yapılmazsa ipucu düğmesi nabız atar
  // Fiyatlar ve ödül miktarları rewards.js'te
  const ECO = window.RingRewards.ECONOMY;
  const BULB_PRICE = ECO.bulbPrice;
  const EXTRA_PRICE = ECO.extraPrice;
  const EXTRA_MOVES = ECO.extraMoves;
  const GOLD_GATE_BULBS = ECO.goldGateBulbs;
  const R = window.RingRewards;
  const STK = window.RingStickers;
  const LOOT_DATA = window.RING_LOOT_DATA || {}; // bölüm kimliği -> ödül taşıyabilecek [halka, x, y]
  const CHEST_SHAKE_MS = 520; // halka kurtulunca sandık titrer...
  const CHEST_OPEN_MS = 900;  // ...sonra kapağı açılır, ışık saçar ve söner
  const RARITY_COLOR = { common: '#e9edf7', rare: '#b48cff', epic: '#ffc94a' };
  const CHEST_SIZE = 1.35;
  const TOKEN_MS = 450;       // altın halka ve ampul halkası simgesinin açılışı
  const BULB_MS = 750;        // ampulün ipucu düğmesine uçuşu
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Süs efektleri (arka plan parçacıkları, büyük patlama, ışık dalgası): ayarlardan kapanabilir
  const fxOn = () => progress.effects !== false && !REDUCED;

  const $ = id => document.getElementById(id);
  const canvas = $('board');
  const ctx = canvas.getContext('2d');
  const fx = $('fx');
  const fctx = fx.getContext('2d');

  // ---- Kayıt (tarayıcıda yerel; ayrıntılar save.js'te) ----
  // Yıldız ve skor bölümün kalıcı kimliğiyle (kaynak numarası) tutulur, sıra numarasıyla değil.
  const store = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const memStore = { getItem: () => null, setItem: () => {} };
  const progress = window.RingSave.load(store || memStore);
  function saveProgress() { window.RingSave.save(store || memStore, progress); }
  if (window.RingSave.relayout(progress, window.RingLevels.LAYOUT, ORDER)) saveProgress();
  const idOf = n => String(srcOf(n));
  const starsOf = n => progress.stars[idOf(n)] || 0;
  const frontier = () => window.RingSave.frontier(progress, ORDER);
  const isUnlocked = n => n <= frontier();
  const totalStars = () => Object.values(progress.stars).reduce((a, b) => a + b, 0);
  // Zorluk etiketi (haritada durağın üstünde renkli nokta): bölüm, kapısındaki 10 bölüm arasında zorluk
  // puanına göre sıralanır; en kolay 3'ü Kolay, en zor 3'ü Zor, kalanlar Orta (puan: hamle + halkaların yakınlığı).
  const TIERS = [{ id: 'easy', name: tr('Kolay') }, { id: 'mid', name: tr('Orta') }, { id: 'hard', name: tr('Zor') }];
  const tierRank = {};
  function tierOf(n) {
    const g = W.gateOf(n);
    if (!tierRank[g]) {
      const score = k => window.RingLevels.difficultyScore(getLevel(srcOf(k)));
      const ns = Array.from({ length: W.GATE_SIZE }, (_, i) => W.gateStart(g) + i).filter(k => k <= TOTAL);
      tierRank[g] = {};
      ns.sort((a, b) => score(a) - score(b) || a - b)
        .forEach((k, i) => { tierRank[g][k] = i < 3 ? 0 : i < ns.length - 3 ? 1 : 2; });
    }
    return TIERS[tierRank[g][n]];
  }
  const starsFor = (moves, par) => (moves <= par ? 3 : moves <= par + 2 ? 2 : 1);
  // Skor: her seviyenin en iyi sonucu sayılır (yıldız başına 100, altın başına 25)
  const levelScore = (stars, coins) => stars * 100 + coins * 25;
  const totalScore = () => Object.values(progress.best || {}).reduce((a, b) => a + b, 0);
  const LOCALE = I18N.lang === 'en' ? 'en-US' : 'tr-TR';
  const fmt = n => n.toLocaleString(LOCALE);
  // Hamle hakkı: en iyi çözüm + pay, ama en fazla 10. En iyi çözüm sınırı 9 olan kapılarda (12-16) 12,
  // 10 olanlarda (17-20) 14. Aşılırsa "Hamlen bitti" penceresi açılır.
  const moveCap = src => ({ 9: 12, 10: 14 })[window.RingLevels.maxParOf(src)] || 10;
  const moveLimit = (par, src) => Math.min(moveCap(src), par + Math.max(3, Math.ceil(par * 0.6)));

  // ---- Ses (WebAudio ile sentez; dosya gerekmez) ----
  const Sound = (() => {
    let ac = null;
    function audio() {
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function tone(freq, dur, type, vol, slideTo, delay = 0) {
      if (!progress.sound) return;
      const a = audio();
      if (!a) return;
      const t = a.currentTime + delay;
      const o = a.createOscillator();
      const g = a.createGain();
      g.gain.value = 0; // otomasyon başlamadan önce tam seste bir örnek çıkmasın (çıt sesi)
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + dur + 0.03);
    }
    return {
      tick: () => tone(1400, 0.03, 'triangle', 0.035),
      // Halka kurtulma sesi: mağazadan seçilen pakete göre (k: zincirde kaçıncı dalga)
      pop: (k, id = equipped('pop')) => {
        const m = 1 + k * 0.12;
        if (id === 'pop-glass') { tone(1046 * m, 0.5, 'sine', 0.12); tone(2093 * m, 0.4, 'sine', 0.05, null, 0.01); tone(3136 * m, 0.25, 'sine', 0.02, null, 0.02); }
        else if (id === 'pop-wood') { tone(523 * m, 0.14, 'triangle', 0.24, 470 * m); tone(1569 * m, 0.05, 'sine', 0.05); }
        else if (id === 'pop-chip') { tone(440 * m, 0.1, 'square', 0.06, 880 * m); tone(880 * m, 0.08, 'square', 0.04, 1320 * m, 0.08); }
        else tone(380 + k * 70, 0.25, 'sine', 0.2, 880 + k * 90);
      },
      deny: () => tone(150, 0.12, 'square', 0.04),
      tap: () => tone(660, 0.06, 'triangle', 0.06),
      win: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.32, 'triangle', 0.13, null, k * 0.11)),
      fail: () => [392, 330, 262].forEach((f, k) => tone(f, 0.28, 'triangle', 0.12, null, k * 0.16)),
      star: k => tone(880 + k * 220, 0.18, 'sine', 0.12),
      // k: art arda toplanan altınlarda her biri iki yarım ses daha tiz
      coin: (k = 0) => {
        const m = Math.pow(2, Math.min(k, 8) * 2 / 12);
        tone(1318 * m, 0.08, 'triangle', 0.09); tone(1976 * m, 0.22, 'triangle', 0.09, null, 0.07);
      },
      // Sandık titrerken: hızlanan, yükselen tıkırtı (açılış öncesi bekleyiş)
      chestShake: () => [0, 1, 2, 3, 4].forEach(k => tone(520 * Math.pow(2, k * 2 / 12), 0.06, 'triangle', 0.05 + k * 0.012, null, k * 0.1 - k * k * 0.006)),
      // Sandık açıldı: tahta tok sesi ve nadirliğe göre büyüyen akor; nadirde parıltı, efsanede derin gümleme
      chestOpen: r => {
        tone(220, 0.22, 'triangle', 0.12, 110);
        const notes = r === 'epic' ? [784, 988, 1175, 1568, 1976, 2349] : r === 'rare' ? [659, 831, 988, 1319] : [880, 1319];
        notes.forEach((f, k) => tone(f, 0.4, 'triangle', 0.08, null, 0.05 + k * 0.07));
        if (r !== 'common') [2637, 3136, 3520].forEach((f, k) => tone(f, 0.5, 'sine', 0.035, null, 0.3 + k * 0.08));
        if (r === 'epic') { tone(130, 0.9, 'sine', 0.22, 48); tone(65, 0.7, 'triangle', 0.1, 40, 0.02); }
      },
      // Kapı açılışı: kilit halkaları dağılırken yükselen akor, ardından parıltı
      gate: () => {
        [392, 494, 587, 784, 988, 1175].forEach((f, k) => tone(f, 0.5, 'triangle', 0.1, null, k * 0.09));
        [2349, 2637, 3136].forEach((f, k) => tone(f, 0.3, 'sine', 0.04, null, 0.6 + k * 0.07));
      },
      unlock: k => tone(740 + k * 60, 0.12, 'sine', 0.08, 1100 + k * 60),
      // Son halka: derin bir gümleme ve üstünde parıltı
      boom: () => {
        tone(150, 0.7, 'sine', 0.28, 36);
        tone(75, 0.5, 'triangle', 0.12, 30, 0.02);
        [1568, 2093, 2637].forEach((f, k) => tone(f, 0.45, 'sine', 0.05, null, 0.08 + k * 0.06));
      },
      // Zincir: halka sayısı arttıkça yükselen üçlü
      chain: n => [0, 4, 7].forEach((s, k) => tone(659 * Math.pow(2, (s + (n - 2) * 2) / 12), 0.22, 'triangle', 0.08, null, k * 0.06)),
      // Övgü: kademe yükseldikçe uzayan ve parlayan arpej (1: Güzel, 2: Harika, 3: Muhteşem, 4: bölüm sonu)
      praise: tier => {
        const notes = [[784, 988, 1175], [784, 988, 1175, 1568], [659, 784, 988, 1319, 1568, 1976], [1047, 1319, 1568, 2093]][tier - 1];
        const gap = tier === 3 ? 0.05 : 0.07;
        notes.forEach((f, k) => tone(f, 0.26, 'triangle', 0.09, null, k * gap));
        if (tier >= 2) [2349, 3136].forEach((f, k) => tone(f, 0.4, 'sine', 0.035, null, notes.length * gap + k * 0.07));
        if (tier === 3) tone(196, 0.6, 'sine', 0.12, 147);
        if (tier === 4) [2637, 3136, 3520].forEach((f, k) => tone(f, 0.6, 'sine', 0.04, null, 0.3 + k * 0.08));
      },
      // 3 yıldız ışık dalgası
      shine: () => [1568, 1976, 2349, 2637, 3136].forEach((f, k) => tone(f, 0.55, 'sine', 0.04, null, k * 0.07)),
      // Ampul kazanınca: kısa bir ışıltı; düğmeye konunca: yumuşak bir tın
      gift: () => [784, 988, 1175, 1568].forEach((f, k) => tone(f, 0.3, 'sine', 0.08, null, k * 0.07)),
      bulb: () => { tone(1046, 0.18, 'sine', 0.1, 1568); tone(2093, 0.25, 'sine', 0.04, null, 0.05); },
      // Nabız: kapak açılınca yükselen, kapanınca alçalan yumuşak bir çan
      lamp: open => tone(open ? 880 : 587, 0.22, 'sine', 0.05, open ? 1175 : 440),
      // Şalter: kısa mekanik şak ve elektrik vızıltısı
      flip: () => { tone(1400, 0.03, 'square', 0.06); tone(95, 0.16, 'sawtooth', 0.05, 110, 0.02); tone(3200, 0.05, 'square', 0.02, 2400, 0.04); },
      // Jeton jetonlu halkaya girdi: oyun makinesine atılan jeton gibi çınlama
      token: () => { tone(2637, 0.06, 'square', 0.03); tone(1319, 0.18, 'triangle', 0.07, null, 0.04); tone(1760, 0.3, 'sine', 0.05, null, 0.1); },
      // Yay tekmesi: yukarı kayan "boing" ve titreşen kısa bir kuyruk
      boing: () => { tone(170, 0.22, 'sine', 0.13, 430); tone(430, 0.24, 'triangle', 0.06, 260, 0.09); tone(1300, 0.05, 'square', 0.025); },
      // Tıklı halka her adımda: saat tıkırtısı
      clack: () => { tone(2200, 0.025, 'square', 0.035); tone(900, 0.05, 'triangle', 0.05, 600); },
      // Anahtar kilide girdi: metalik çıt ve küçük bir çan
      keyOpen: () => { tone(1800, 0.04, 'square', 0.05); tone(620, 0.08, 'triangle', 0.08, 420, 0.03); [1319, 1760].forEach((f, k) => tone(f, 0.3, 'sine', 0.06, null, 0.1 + k * 0.08)); },
      // Altın halka: yükselen altın şıngırtısı ve parıltı
      goldRing: () => {
        [1047, 1319, 1568, 2093].forEach((f, k) => { tone(f, 0.12, 'triangle', 0.08, null, k * 0.06); tone(f * 1.5, 0.25, 'triangle', 0.05, null, k * 0.06 + 0.04); });
        [2637, 3136].forEach((f, k) => tone(f, 0.45, 'sine', 0.04, null, 0.3 + k * 0.08));
      },
      // Ampul halkası: cam çan sesi
      bulbRing: () => { tone(1568, 0.5, 'sine', 0.09); tone(2349, 0.6, 'sine', 0.05, null, 0.08); tone(3136, 0.5, 'sine', 0.03, null, 0.16); },
      // Çıkartma parçası yerine oturdu: yumuşak çıt ve parıltı; set tamamlanınca yükselen akor
      piece: done => {
        tone(660, 0.08, 'triangle', 0.08, 990);
        [1319, 1760].forEach((f, k) => tone(f, 0.3, 'sine', 0.05, null, 0.08 + k * 0.07));
        if (done) [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 0.45, 'triangle', 0.09, null, 0.3 + k * 0.1));
      },
      context: audio,
    };
  })();

  // ---- Ortam sesi ve arka plan parçacıkları (dünyaya göre) ----
  const ambience = window.RingAmbience.Ambience(() => Sound.context());
  const backdrop = window.RingScenery.Backdrop($('bgFx'));
  function syncAmbience() {
    ambience.play(progress.ambient !== false && !document.hidden && themeWorld ? themeWorld : null);
  }
  // Tarayıcı sesi ancak bir dokunuştan sonra açar: ilk dokunuşta ortam sesi başlar
  document.addEventListener('pointerdown', () => { if (progress.ambient !== false) { Sound.context(); ambience.resume(); } }, true);
  document.addEventListener('visibilitychange', syncAmbience);

  // ---- Oyun durumu ----
  const S = {
    levelNo: 1, def: null, L: null,
    angles: [], mask: 0, moves: 0,
    fly: {}, shake: {}, drag: null, hint: null, won: false,
    shownStars: 3,
    auto: null,     // "Hamleyi yap": halka kendiliğinden dönerken { ring, delta, done, t0, before }
    help: null,     // akıllı yardım: { lastAct, shown } (oyuncu takıldı mı?)
    coins: [],      // { link, x, y, taken, phase }
    coinsTaken: 0,  // bu bölümde toplanan; bölüm bitince kasaya eklenir
  };
  let coinFly = []; // { x, y (uygulama koordinatı), t0 }
  let bulbFly = []; // ipucu düğmesine uçan ampuller { x, y, t0, landed }
  let bulbsInAir = 0; // yoldaki ampuller: rozet onlar konunca artar
  let particles = [];
  let confetti = [];
  let shocks = [];     // son halkanın şok dalgası { x, y, t0 } (uygulama koordinatı)
  let floaters = [];   // yükselen yazılar, ör. "Harika!" { text, x, y, t0, big?, size?, sub?, colors?, life? } (uygulama koordinatı)
  let lightWaves = []; // 3 yıldız ışık dalgası { x, y, t0 } (uygulama koordinatı)

  // ---- Ekran geçişleri ----
  function showScreen(name) {
    for (const id of ['home', 'levels', 'game', 'trophies', 'shop']) $(id).hidden = id !== name;
    if (name === 'shop') renderShop();
    if (name === 'home') { renderHome(); maybeStreak(); }
    if (name === 'trophies') renderTrophies();
    if (name === 'levels') renderMap();
    if (name === 'game') requestAnimationFrame(resize);
  }

  // ---- Dünya teması: zemin ve vurgu rengi dünyaya göre değişir, halka renkleri değişmez ----
  let themeWorld = null;
  function applyWorld(world) {
    if (themeWorld === world.id) return;
    themeWorld = world.id;
    const root = document.documentElement;
    root.style.setProperty('--scene', W.sceneCss(world.theme));
    root.style.setProperty('--accent', world.theme.accent);
    root.dataset.world = world.id;
    backdrop.setWorld(world);
    drawBoardBg();
    syncAmbience();
  }

  // Tahtanın altındaki doku (ahşap, taş, metal...): dünya ya da boyut değişince yeniden çizilir
  function drawBoardBg() {
    const bg = $('boardBg');
    if (!bg.width || !themeWorld) return;
    const w = BOARD.w * scale, h = BOARD.h * scale;
    const g = bg.getContext('2d');
    g.setTransform(bg.width / w, 0, 0, bg.height / h, 0, 0);
    window.RingScenery.drawBoard(g, w, h, W.worldById(themeWorld).theme, themeWorld);
  }

  // ---- Yolculuk: kapılar, unvan ----
  const gateEnd = g => W.gateStart(g) + W.GATE_SIZE - 1;
  const gateDone = g => !!starsOf(gateEnd(g));
  const gatesDone = () => { let c = 0; for (let g = 1; g <= GATE_COUNT; g++) if (gateDone(g)) c++; return c; };
  const gateStars = g => { let s = 0; for (let n = W.gateStart(g); n <= gateEnd(g); n++) s += starsOf(n); return s; };
  const gateGold = g => gateStars(g) === W.GATE_SIZE * 3;
  const currentTitle = () => W.titleFor(gatesDone());

  // Eski kayıtla gelen ya da önceden geçilmiş kapıların ödülü sessizce verilir; tören yalnızca
  // oyuncunun şu an içinde bulunduğu kapı için (henüz kutlanmadıysa) yapılır.
  function settleRewards() {
    const fg = W.gateOf(frontier());
    for (let g = 2; g < fg; g++) {
      if (progress.rewards['gate:' + g]) continue;
      progress.rewards['gate:' + g] = true;
      progress.hints += ECO.gateBulbs;
    }
    for (let g = 1; g <= GATE_COUNT; g++) {
      if (gateGold(g) && !progress.rewards['gold:' + g]) {
        progress.rewards['gold:' + g] = true;
        progress.hints += GOLD_GATE_BULBS;
      }
    }
    if (progress.title == null) progress.title = currentTitle();
    if (progress.seenFrontier == null) progress.seenFrontier = frontier();
    // Toplam altın sayacı yeni: eski kayıtta en az kasadaki kadar toplanmıştır
    progress.stats.coinsTotal = Math.max(progress.stats.coinsTotal || 0, progress.coins);
    saveProgress();
    awardBadges(true);
  }

  // ---- Halka ödülleri (sandık, altın halka, ampul halkası): yeri ve içeriği rewards.js'te, bölüm başına bir kez ----
  const lootCache = {};
  function lootOf(n) {
    if (n in lootCache) return lootCache[n];
    const g = W.gateOf(n), start = W.gateStart(g);
    const spots = p => (start + p - 1 <= TOTAL ? LOOT_DATA[srcOf(start + p - 1)] : null);
    const p = W.posInGate(n);
    const type = R.gatePlan(g, spots, W.GATE_SIZE).get(p);
    let loot = null;
    if (type) {
      const [ring, x, y] = R.spotFor(type, spots(p));
      const what = type === 'chest' ? R.chestFor(srcOf(n), g)
        : type === 'gold' ? { name: tr('Altın halka'), coins: 0, bulbs: 0 }
        : { name: tr('Ampul halkası'), coins: 0, bulbs: 1 };
      loot = { type, ...what, ring, x, y };
    }
    return (lootCache[n] = loot);
  }
  const LOOT_TIPS = {
    chest: { flag: 'lootTip', text: tr('Sandık, içinde durduğu halka kurtulunca açılır') },
    gold: { flag: 'goldTip', text: tr('Altın halkayı kurtar: bu bölümün altınları 2 kat sayılır') },
    bulb: { flag: 'bulbTip', text: tr('Ampul halkasını kurtar: +1 ampul') },
  };
  // ---- Çıkartma parçaları: dünyanın bölümlerine yayılır, bölüm bitince verilir (rewards.js STICKERS) ----
  let pieceMap = null;
  function pieceAt(n) {
    if (!pieceMap) {
      pieceMap = {};
      for (const w of LIVE_WORLDS) {
        const levels = [];
        for (let m = 1; m <= TOTAL; m++) if (W.worldOfGate(W.gateOf(m)).id === w.id) levels.push(m);
        if (levels.length) R.stickerLevels(levels, W.GATE_SIZE).forEach((m, k) => { pieceMap[m] = { world: w.id, k, id: w.id + ':' + k }; });
      }
    }
    return pieceMap[n] || null;
  }
  const pieceWaiting = n => { const p = pieceAt(n); return p && !progress.stickers[p.id] ? p : null; };
  const piecesOf = world => Array.from({ length: STK.PIECES }, (_, k) => !!progress.stickers[world + ':' + k]);
  const stickerSvg = (world, fresh = -1) => STK.svg(world, piecesOf(world), W.worldById(world).theme.accent, fresh);

  // ---- Süsler (mağaza): seçili ürün, yoksa bölümün bedava ilki ----
  const equipped = cat => progress.equip[cat] || R.SHOP[cat].items[0].id;
  const owns = id => !R.shopItem(id).price || !!progress.owned[id];
  const BURST_SHAPE = { 'burst-classic': 'dot', 'burst-stars': 'star', 'burst-bubbles': 'bubble', 'burst-hearts': 'heart', 'burst-bolts': 'bolt' };

  const lootWaiting = n => (progress.loot[idOf(n)] ? null : lootOf(n));

  // ---- Başarımlar (rozetler) ve şekil albümü ----
  const B = window.RingBadges;
  let failedLevel = null; // hamlesi biten bölüm: hemen ardından kazanılırsa "Pes Etmeyen"
  const stat = (key, v = 1) => { progress.stats[key] = (progress.stats[key] || 0) + v; };
  let shapeList = null;
  const shapeLevels = () => shapeList || (shapeList = ORDER.map((_, i) => i + 1).filter(n => getLevel(srcOf(n)).name));

  function badgeCtx() {
    const st = progress.stats;
    let goldGates = 0;
    for (let g = 1; g <= GATE_COUNT; g++) if (gateGold(g)) goldGates++;
    const worlds = new Set();
    for (let g = 1; g <= W.gateOf(frontier()); g++) worlds.add(W.worldOfGate(g).id);
    const shapes = shapeLevels();
    return {
      wins: Object.keys(progress.stars).length,
      gatesDone: gatesDone(),
      worldsSeen: worlds.size,
      stars: totalStars(),
      perfect: Object.values(progress.stars).filter(v => v === 3).length,
      goldGates,
      hintless: Object.keys(progress.clean).length,
      bestChain: st.bestChain || 0,
      chains: st.chains || 0,
      comebacks: st.comebacks || 0,
      shapes: shapes.filter(n => starsOf(n)).length,
      shapesTotal: shapes.length,
      coinsTotal: st.coinsTotal || 0,
      bulbsBought: progress.bulbsBought || 0,
      hintsUsed: st.hintsUsed || 0,
    };
  }

  const unseenBadges = () => Object.keys(progress.badges).filter(id => !progress.seenBadges[id]);

  // Koşulu sağlanan rozetleri verir; her rozet kademesine göre altın kazandırır.
  // silent: oyun açılırken (eski kayıt) bildirim gösterilmez, yalnızca kırmızı nokta yanar.
  const toastQ = [];
  let toastBusy = false;
  function awardBadges(silent) {
    const got = B.newlyEarned(progress.badges, badgeCtx());
    if (!got.length) return;
    for (const b of got) {
      progress.badges[b.id] = today();
      progress.coins += B.TIERS[b.tier].coins;
    }
    saveProgress();
    if (!$('game').hidden) updateHud();
    if (silent) return;
    toastQ.push(...got);
    nextToast();
  }

  const medalHtml = (b, done) =>
    `<span class="medal${done ? '' : ' locked'}" style="--tc:${B.TIERS[b.tier].color}"><svg viewBox="0 0 24 24" aria-hidden="true">${B.ICONS[b.icon]}</svg></span>`;

  function nextToast() {
    if (toastBusy || !toastQ.length) return;
    toastBusy = true;
    const b = toastQ.shift();
    const el = $('toast');
    el.innerHTML = `${medalHtml(b, true)}<span><small>${tr('Yeni rozet')}</small><b>${b.name}</b><em>${tr('+{n} altın', { n: B.TIERS[b.tier].coins })}</em></span>`;
    el.classList.remove('out');
    el.hidden = false;
    Sound.gift();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => { el.hidden = true; toastBusy = false; nextToast(); }, 350);
    }, 2600);
  }

  let trophyTab = 'badges';
  function renderTrophies() {
    const ctx = badgeCtx();
    const fresh = new Set(unseenBadges());
    const earned = B.BADGES.filter(b => progress.badges[b.id]).length;
    $('badgeCount').textContent = `${earned}/${B.BADGES.length}`;
    $('albumCount').textContent = `${ctx.shapes}/${ctx.shapesTotal}`;
    $('stickerCount').textContent = `${LIVE_WORLDS.filter(w => piecesOf(w.id).every(Boolean)).length}/${LIVE_WORLDS.length}`;
    $('tabBadges').setAttribute('aria-selected', String(trophyTab === 'badges'));
    $('tabAlbum').setAttribute('aria-selected', String(trophyTab === 'album'));
    $('tabStickers').setAttribute('aria-selected', String(trophyTab === 'stickers'));
    $('trophyList').innerHTML = trophyTab === 'badges' ? badgesHtml(ctx, fresh) : trophyTab === 'album' ? albumHtml() : stickersHtml();
    // Görülen rozetlerin kırmızı noktası söner
    for (const id of fresh) progress.seenBadges[id] = true;
    if (fresh.size) saveProgress();
  }

  function badgesHtml(ctx, fresh) {
    let html = '', group = '';
    for (const b of B.BADGES) {
      if (b.group !== group) { group = b.group; html += `<div class="eyebrow badge-group">${group}</div>`; }
      const s = B.status(b, ctx);
      const done = !!progress.badges[b.id];
      const reward = B.TIERS[b.tier].coins;
      const meta = done
        ? `<span class="got">${tr('Kazanıldı · +{n} altın', { n: reward })}</span>`
        : `<span class="bar-track"><i style="width:${Math.round(100 * s.value / s.goal)}%"></i></span><span>${s.value} / ${s.goal}</span><span>+${reward}</span>`;
      html += `<div class="badge-row${fresh.has(b.id) ? ' new' : ''}" style="--tc:${B.TIERS[b.tier].color}">
        ${medalHtml(b, done)}
        <div><b>${b.name}</b><p>${b.desc}</p><div class="meta">${meta}</div></div>
      </div>`;
    }
    return html;
  }

  function albumHtml() {
    const cards = shapeLevels().map(n => {
      const def = getLevel(srcOf(n));
      const got = starsOf(n);
      const stars = got ? `<span class="mini">${[1, 2, 3].map(k => `<span class="star-ico${k <= got ? ' on' : ''}"></span>`).join('')}</span>` : '';
      return `<div class="album-card${got ? '' : ' missing'}">${shapeSvg(def, !!got)}
        <b>${got ? tr(def.name) : '???'}</b><small>${tr('Kapı {n}', { n: W.gateOf(n) })}</small>${stars}</div>`;
    });
    return `<div class="album-grid">${cards.join('')}</div>
      <p class="album-note">${tr('Bazı bölümlerde halkalara takılmış bir hayvan ya da eşya seni bekliyor. Kurtardıkların bu albümde toplanır.')}</p>`;
  }

  function stickersHtml() {
    const cards = LIVE_WORLDS.map(w => {
      const have = piecesOf(w.id).filter(Boolean).length;
      const done = have === STK.PIECES;
      return `<div class="sticker-card${done ? ' done' : ''}">${stickerSvg(w.id)}
        <b>${have ? STK.SETS[w.id].name : '???'}</b><small>${w.name}</small>
        <span class="${done ? 'got' : ''}">${done ? tr('Tamam · +{n} altın', { n: R.STICKERS.setCoins }) : tr('{have} / {all} parça', { have, all: STK.PIECES })}</span></div>`;
    });
    return `<div class="sticker-grid">${cards.join('')}</div>
      <p class="album-note">${tr('Her dünyanın 5 parçalı bir çıkartması var. Haritada yapboz işareti olan bölümleri bitirince parça kazanırsın. Çıkartmayı tamamlayınca {n} altın.', { n: R.STICKERS.setCoins })}</p>`;
  }

  // ---- Mağaza ----
  // Kutlama önizlemelerinin küçük resmi (dokununca ekranda oynar)
  const WIN_ICONS = {
    'win-confetti': '<svg viewBox="0 0 120 75" aria-hidden="true">' + [[22, 20, 20, '#ff6b6b'], [44, 44, -30, '#ffc94a'], [64, 16, 40, '#2dd4bf'], [86, 40, -15, '#4cc9f0'], [100, 18, 60, '#b388ff'], [34, 56, 70, '#ff8fab'], [76, 60, 10, '#ffc94a']]
      .map(([x, y, r, c]) => `<rect x="${x}" y="${y}" width="10" height="5" rx="1" fill="${c}" transform="rotate(${r} ${x + 5} ${y + 2.5})"/>`).join('') + '</svg>',
    'win-fireworks': '<svg viewBox="0 0 120 75" aria-hidden="true">' + [[42, 32, '#ff6b6b'], [82, 42, '#4cc9f0']].map(([cx, cy, c]) =>
      Array.from({ length: 12 }, (_, k) => { const a = k * Math.PI / 6; return `<circle cx="${(cx + Math.cos(a) * 17).toFixed(1)}" cy="${(cy + Math.sin(a) * 17).toFixed(1)}" r="2.6" fill="${k % 3 ? c : '#fff6c4'}"/>`; }).join('')).join('') + '</svg>',
    'win-goldrain': '<svg viewBox="0 0 120 75" aria-hidden="true">' + [[34, 20], [62, 40], [88, 18], [48, 58], [80, 60]].map(([x, y]) =>
      `<circle cx="${x}" cy="${y}" r="9" fill="#d98f12"/><circle cx="${x}" cy="${y}" r="7" fill="#ffd54a"/><circle cx="${x}" cy="${y}" r="4" fill="none" stroke="#d98f12" stroke-width="1.3"/>`).join('') + '</svg>',
  };
  let shopTab = 'burst';
  let shopConfirm = null; // ilk dokunuşta "Onayla" sorulan ürün
  function renderShop() {
    $('shopCoins').textContent = progress.coins;
    for (const cat of Object.keys(R.SHOP)) $('shopTab-' + cat).setAttribute('aria-selected', String(shopTab === cat));
    const items = R.SHOP[shopTab].items.map(it => {
      const on = equipped(shopTab) === it.id, own = owns(it.id);
      const btn = on ? `<button class="shop-btn on" disabled>${tr('Kullanılıyor')}</button>`
        : own ? `<button class="shop-btn" data-act="use" data-id="${it.id}">${tr('Kullan')}</button>`
        : shopConfirm === it.id ? `<button class="shop-btn buy confirm" data-act="buy" data-id="${it.id}">${tr('Onayla')} · <i class="coin-ico"></i>${it.price}</button>`
        : progress.coins >= it.price ? `<button class="shop-btn buy" data-act="ask" data-id="${it.id}"><i class="coin-ico"></i>${it.price}</button>`
        : `<button class="shop-btn buy" disabled><i class="coin-ico"></i>${it.price}</button><small class="need">${tr('{n} altın daha', { n: it.price - progress.coins })}</small>`;
      const preview = shopTab === 'win'
        ? `<button class="shop-try" data-try="${it.id}" aria-label="${tr('{name} önizle', { name: it.name })}">${WIN_ICONS[it.id]}<span class="try">${tr('Dene')}</span></button>`
        : shopTab === 'pop'
        ? `<button class="shop-try sound" data-try="${it.id}" aria-label="${tr('{name} sesini dinle', { name: it.name })}"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg></button>`
        : `<button class="shop-try" data-try="${it.id}" aria-label="${tr('{name} önizle', { name: it.name })}"><canvas width="240" height="150" data-prev="${it.id}"></canvas></button>`;
      return `<div class="shop-card${on ? ' on' : ''}">${preview}<b>${it.name}</b><small>${it.desc}</small>${btn}</div>`;
    });
    $('shopList').innerHTML = `<div class="shop-grid">${items.join('')}</div>
      <p class="album-note">${tr('Önizlemeye dokunup dene. Süsler yalnızca görünüş ve ses içindir; bulmacayı kolaylaştırmaz.')}</p>`;
    $('shopList').querySelectorAll('[data-act]').forEach(b => { b.onclick = () => shopAct(b.dataset.act, b.dataset.id); });
    $('shopList').querySelectorAll('[data-try]').forEach(b => { b.onclick = () => shopTry(b.dataset.try); });
    previews = [...$('shopList').querySelectorAll('canvas[data-prev]')].map(c => ({ c, id: c.dataset.prev, parts: [], t0: performance.now() - 900 }));
  }

  function shopAct(act, id) {
    const it = R.shopItem(id);
    const cat = Object.keys(R.SHOP).find(c => R.SHOP[c].items.includes(it));
    if (act === 'ask') { Sound.tap(); shopConfirm = id; renderShop(); return; }
    if (act === 'buy') {
      if (progress.coins < it.price) { Sound.deny(); return; }
      progress.coins -= it.price;
      progress.owned[id] = true;
      Sound.coin(); setTimeout(() => Sound.gift(), 120);
    } else Sound.tap();
    progress.equip[cat] = id;
    shopConfirm = null;
    saveProgress();
    renderShop();
    shopTry(id);
  }

  // Önizleme: ses çalar, kutlamayı ekranda oynatır, efekti kendi kutusunda patlatır
  function shopTry(id) {
    if (id.startsWith('pop-')) { [0, 1, 2].forEach(k => setTimeout(() => Sound.pop(k, id), k * 230)); return; }
    if (id.startsWith('win-')) { confetti = []; launchConfetti(3, id); return; }
    const p = previews.find(v => v.id === id);
    if (p) p.t0 = performance.now() - 900;
  }

  // Efekt önizlemeleri: her 1,8 saniyede bir halka belirir ve seçilen şekille patlar
  let previews = [];
  function drawPreviews(now) {
    if ($('shop').hidden || !previews.length) return;
    for (const v of previews) {
      const g = v.c.getContext('2d');
      const t = (now - v.t0) % 1800;
      g.clearRect(0, 0, v.c.width, v.c.height);
      g.save();
      g.scale(2, 2);
      if (t < 900) {
        g.globalAlpha = Math.min(1, t / 300);
        g.strokeStyle = COLORS[0];
        g.lineWidth = 7;
        g.lineCap = 'round';
        g.beginPath(); g.arc(60, 38, 22, 0.5, TAU - 0.2); g.stroke();
        g.globalAlpha = 1;
      } else if (!v.burst) {
        v.burst = true;
        const shape = BURST_SHAPE[v.id];
        for (let k = 0; k < 22; k++) {
          const a = Math.random() * TAU, sp = 0.8 + Math.random() * 1.8;
          v.parts.push({ x: 60 + Math.cos(a) * 22, y: 38 + Math.sin(a) * 22, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 1, size: 1.4 + Math.random() * 1.8, color: COLORS[k % 3 ? 0 : 1], shape });
        }
      }
      if (t < 900) v.burst = false;
      v.parts = v.parts.filter(p => p.life > 0);
      for (const p of v.parts) stepParticle(g, p);
      g.restore();
    }
  }

  $('shopBtn').onclick = () => { Sound.tap(); shopConfirm = null; showScreen('shop'); };
  $('shopBack').onclick = () => { Sound.tap(); shopConfirm = null; showScreen('home'); };
  for (const cat of Object.keys(R.SHOP)) {
    $('shopTab-' + cat).onclick = () => { Sound.tap(); shopTab = cat; shopConfirm = null; renderShop(); };
  }

  $('homeTrophies').onclick = () => { Sound.tap(); trophyTab = 'badges'; showScreen('trophies'); };
  $('trophiesBack').onclick = () => { Sound.tap(); showScreen('home'); };
  $('tabBadges').onclick = () => { Sound.tap(); trophyTab = 'badges'; renderTrophies(); };
  $('tabAlbum').onclick = () => { Sound.tap(); trophyTab = 'album'; renderTrophies(); };
  $('tabStickers').onclick = () => { Sound.tap(); trophyTab = 'stickers'; renderTrophies(); };

  function renderHome() {
    const next = frontier();
    applyWorld(W.worldOfGate(W.gateOf(next)));
    $('playLevel').textContent = tr('Seviye {n}', { n: next });
    $('homeStars').textContent = totalStars();
    $('homeCoins').textContent = progress.coins;
    $('homeBulbs').textContent = progress.hints;
    $('trophyDot').hidden = !unseenBadges().length;
    $('homeScore').textContent = fmt(totalScore());
    $('homeTitle').textContent = tr(progress.title || currentTitle());
    $('promiseLevels').textContent = TOTAL;
    $('promiseWorlds').textContent = LIVE_WORLDS.length;
    $('promiseBadges').textContent = B.BADGES.length;
  }

  // ---- Harita ----
  const LOCK_SVG = '<svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/></svg>';
  const MAP = { gap: 84, arch: 160, bottom: 56, teaser: 260, strip: 34 };
  MAP.block = MAP.arch + W.GATE_SIZE * MAP.gap;
  let mapGeo = null;      // son çizimin ölçüleri: düğüm ve kemer konumları
  let lastWon = null;     // haritaya dönünce yıldızları parlayacak bölüm
  let mapBusy = false;    // tören sürerken harita dokunmaya kapalı

  // Şekil bölümünün küçük resmi: halkalar ve çubuklar, renkli ya da gri siluet
  function shapeSvg(def, colored) {
    const ext = def.rings.map(r => (r.type === 'frame'
      ? [Math.min(...r.points.map(q => q[0])), Math.min(...r.points.map(q => q[1])), Math.max(...r.points.map(q => q[0])), Math.max(...r.points.map(q => q[1]))]
      : r.type === 'bar'
      ? [Math.min(r.x1, r.x2), Math.min(r.y1, r.y2), Math.max(r.x1, r.x2), Math.max(r.y1, r.y2)]
      : [r.x - r.r, r.y - r.r, r.x + r.r, r.y + r.r]));
    const x0 = Math.min(...ext.map(e => e[0])), y0 = Math.min(...ext.map(e => e[1]));
    const x1 = Math.max(...ext.map(e => e[2])), y1 = Math.max(...ext.map(e => e[3]));
    const k = 44 / Math.max(x1 - x0, y1 - y0);
    const ox = (48 - (x1 - x0) * k) / 2 - x0 * k, oy = (48 - (y1 - y0) * k) / 2 - y0 * k;
    const sw = Math.max(1.6, 13 * k);
    const parts = def.rings.map((r, i) => {
      const c = colored ? (r.type === 'bar' || r.type === 'frame' ? BAR_COLOR : r.fixed ? FIXED_COLOR : r.color || COLORS[i % COLORS.length]) : 'rgba(255,255,255,.26)';
      if (r.type === 'frame') {
        return `<polygon points="${r.points.map(q => `${q[0] * k + ox},${q[1] * k + oy}`).join(' ')}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linejoin="round"/>`;
      }
      return r.type === 'bar'
        ? `<line x1="${r.x1 * k + ox}" y1="${r.y1 * k + oy}" x2="${r.x2 * k + ox}" y2="${r.y2 * k + oy}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>`
        : `<circle cx="${r.x * k + ox}" cy="${r.y * k + oy}" r="${r.r * k}" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
    });
    return `<svg viewBox="0 0 48 48" aria-hidden="true">${parts.join('')}</svg>`;
  }

  // Noktalardan geçen yumuşak eğri (Catmull-Rom → Bezier)
  function smoothPath(pts) {
    if (!pts.length) return '';
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  // Harita ölçüleri: aşağıdan yukarı; her kapı bir kemer + 10 durak
  function mapLayout(width) {
    const teaser = GATE_COUNT < W.GATES.length;
    const height = MAP.bottom + GATE_COUNT * MAP.block + (teaser ? MAP.teaser : 40);
    const cx = width / 2;
    const amp = Math.min(width * 0.27, 108);
    const top = yb => height - yb;
    const arches = [], nodes = [];
    for (let g = 1; g <= GATE_COUNT + (teaser ? 1 : 0); g++) {
      const base = MAP.bottom + (g - 1) * MAP.block;
      arches[g] = { x: cx, y: top(base + MAP.arch * 0.42) };
      if (g > GATE_COUNT) break;
      for (let k = 1; k <= W.GATE_SIZE; k++) {
        const n = W.gateStart(g) + k - 1;
        const x = k === W.GATE_SIZE ? cx : cx + amp * Math.sin(n * 0.95 + 0.6);
        nodes[n] = { x, y: top(base + MAP.arch + (k - 1) * MAP.gap + 20) };
      }
    }
    // Yolun geçtiği noktalar: kemer, kapının durakları, sonraki kemer...
    const pts = [], index = [];
    for (let g = 1; g < arches.length; g++) {
      pts.push(arches[g]);
      if (g > GATE_COUNT) break;
      for (let n = W.gateStart(g); n <= gateEnd(g); n++) { index[n] = pts.length; pts.push(nodes[n]); }
    }
    if (teaser) pts.push({ x: cx, y: 30 });
    return { width, height, cx, arches, nodes, pts, index, teaser };
  }

  const lootSvg = l => (l.type === 'gold'
    ? `<svg class="loot-ico token gold" viewBox="0 0 20 20" aria-hidden="true"><circle class="coin" cx="10" cy="10" r="8.5"/><text x="10" y="13.6">×2</text></svg>`
    : l.type === 'bulb'
      ? `<svg class="loot-ico token bulb" viewBox="0 0 20 20" aria-hidden="true"><circle class="glass" cx="10" cy="8" r="6.5"/><rect class="base" x="7" y="13.5" width="6" height="5" rx="1.2"/></svg>`
      : `<svg class="loot-ico ${l.rarity}" viewBox="0 0 24 20" aria-hidden="true">
    <path class="lid" d="M2 9V7.5C2 3 22 3 22 7.5V9z"/><rect class="box" x="2" y="9" width="20" height="9" rx="2"/>
    <rect class="band" x="5" y="4" width="3" height="14"/><rect class="band" x="16" y="4" width="3" height="14"/></svg>`);

  function nodeHtml(n, state, def) {
    const got = starsOf(n);
    const stars = `<span class="mini">${[1, 2, 3].map(k => `<span class="star-ico${k <= got ? ' on' : ''}"></span>`).join('')}</span>`;
    if (def.name) return shapeSvg(def, state === 'done') + (state === 'done' ? stars : '');
    if (state === 'locked') return LOCK_SVG;
    return `<span class="num">${n}</span><span class="tier-dot ${tierOf(n).id}"></span>` + (state === 'done' ? stars : '');
  }

  // Dünya adı kemerin üstünde, kapının ilk durağının hemen altında durur: durağın ters yanına kayar
  function worldNameShift(g, geo) {
    const first = geo.nodes[W.gateStart(g)];
    if (!first) return 0;
    const dx = first.x - geo.arches[g].x;
    return -(Math.sign(dx) || 1) * Math.max(15, 95 - Math.abs(dx));
  }

  function archHtml(g, geo) {
    const gate = W.GATES[g - 1];
    const world = W.worldById(gate.world);
    const teaser = g > GATE_COUNT;
    const open = !teaser && isUnlocked(W.gateStart(g)) && (g === 1 || progress.rewards['gate:' + g]);
    const cls = ['arch', open ? 'open' : 'locked', !teaser && gateGold(g) ? 'gold' : '', teaser ? 'teaser' : ''].join(' ');
    const label = teaser
      ? `<span class="arch-sub">${tr('Yakında')}</span>`
      : `<span class="arch-stars"><span class="star-ico"></span>${gateStars(g)} / ${W.GATE_SIZE * 3}</span>`;
    return `<div class="${cls}" data-gate="${g}" style="left:${geo.arches[g].x}px;top:${geo.arches[g].y}px;--wa:${world.theme.accent}">
      ${W.isWorldStart(g) ? `<span class="arch-world" style="transform:translateX(${worldNameShift(g, geo)}px)">${world.name}</span>` : ''}
      <svg viewBox="0 0 230 100" aria-hidden="true">
        <path class="arch-shadow" d="M22 100 V56 A93 48 0 0 1 208 56 V100"/>
        <path class="arch-line" d="M22 100 V56 A93 48 0 0 1 208 56 V100"/>
        <path class="arch-shine" d="M22 100 V56 A93 48 0 0 1 208 56 V100"/>
        <g class="arch-lock" transform="translate(115 30)">
          <circle class="l1" cx="-9" cy="-3" r="10"/><circle class="l2" cx="9" cy="-3" r="10"/><circle class="l3" cx="0" cy="9" r="10"/>
        </g>
      </svg>
      <span class="arch-name">${tr('Kapı {n}', { n: g })} · ${gate.name}</span>
      ${label}
    </div>`;
  }

  function renderMap() {
    const wrap = $('map');
    const inner = $('mapInner');
    const width = wrap.clientWidth - MAP.strip;
    if (width <= 0) return;
    const geo = mapGeo = mapLayout(width);
    const front = frontier();
    applyWorld(W.worldOfGate(W.gateOf(front)));
    $('starTotal').textContent = `${totalStars()} / ${TOTAL * 3}`;
    inner.style.height = geo.height + 'px';

    // Yol: bütünü soluk; geçilen kısmı altın noktalı; yeni açılan parça ayrıca çizilip canlandırılır
    const seen = Math.min(progress.seenFrontier || front, front);
    const upTo = n => geo.pts.slice(0, geo.index[n] + 1);
    let html = `<svg class="map-path" width="${width}" height="${geo.height}" aria-hidden="true">
      <path class="road" d="${smoothPath(geo.pts)}"/>
      <path class="road-done" d="${smoothPath(upTo(seen))}"/>
      ${seen < front ? `<path class="road-new" d="${smoothPath(geo.pts.slice(geo.index[seen], geo.index[front] + 1))}"/>` : ''}
    </svg>`;

    // Kapı bantları (dünyanın rengiyle hafif ışık) ve kemerler
    for (let g = 1; g < geo.arches.length; g++) {
      const world = W.worldOfGate(g);
      const yTop = geo.height - (MAP.bottom + g * MAP.block);
      html += `<div class="gate-band" style="top:${Math.max(0, yTop)}px;height:${MAP.block}px;--wa:${world.theme.accent}"></div>`;
    }
    for (let g = 1; g < geo.arches.length; g++) html += archHtml(g, geo);

    for (let n = 1; n <= TOTAL; n++) {
      const def = getLevel(srcOf(n));
      const state = starsOf(n) ? 'done' : isUnlocked(n) ? 'open' : 'locked';
      const fresh = n > seen && n <= front;
      const chest = lootWaiting(n); // alınmamış ödül: düğmenin köşesinde (sandık nadirlik renginde)
      const piece = pieceWaiting(n); // alınmamış çıkartma parçası: sol köşede, dünyanın renginde
      const cls = ['node', state, def.name ? (W.posInGate(n) === W.GATE_SIZE ? 'final' : 'shape') : '',
        n === front ? 'current' : '', fresh ? 'fresh' : '', n === lastWon ? 'won' : '',
        state !== 'locked' && def.name ? 'colored' : ''].join(' ');
      const label = `${tr('Seviye {n}', { n })}${def.name ? ', ' + tr(def.name) : ''}, ${tierOf(n).name.toLowerCase()}, ` +
        (state === 'locked' ? tr('kilitli') : state === 'done' ? tr('{n} yıldız', { n: starsOf(n) }) : tr('oynanmadı'));
      html += `<button class="${cls}" data-n="${n}" style="left:${geo.nodes[n].x}px;top:${geo.nodes[n].y}px"
        aria-label="${label}${chest ? ', ' + tr('{name} var', { name: tr(chest.name).toLowerCase() }) : ''}${piece ? ', ' + tr('çıkartma parçası var') : ''}"${state === 'locked' ? ' disabled' : ''}>${nodeHtml(n, state, def)}${chest ? lootSvg(chest) : ''}${piece ? STK.pieceIcon(W.worldById(piece.world).theme.accent) : ''}</button>`;
    }
    const cur = geo.nodes[front];
    html += `<div class="marker${front > seen ? ' fresh' : ''}" style="left:${cur.x}px;top:${cur.y - 50}px" aria-hidden="true">
      <svg viewBox="0 0 40 30"><circle cx="14" cy="15" r="9"/><circle cx="26" cy="15" r="9"/></svg></div>`;
    if (geo.teaser) html += `<div class="map-fog" aria-hidden="true"></div>`;
    inner.innerHTML = html;
    inner.querySelectorAll('.node:not([disabled])').forEach(b => {
      b.onclick = () => {
        if (mapBusy) return;
        Sound.tap();
        loadLevel(Number(b.dataset.n));
        showScreen('game');
      };
    });
    renderGateStrip(geo);

    // Açılışta şimdiki durağa kay; sonra (varsa) tören ve yolda ilerleme
    const pending = pendingCelebration();
    const focusY = pending && pending.gate ? geo.arches[pending.gate].y : cur.y;
    wrap.scrollTop = focusY - wrap.clientHeight * 0.55;
    lastWon = null;
    if (pending) celebrate(pending, () => advancePath(seen, front));
    else advancePath(seen, front);
  }

  // Yeni açılan yol parçası çizilir, yeni duraklar sırayla belirir
  function advancePath(seen, front) {
    const inner = $('mapInner');
    const path = inner.querySelector('.road-new');
    const fresh = [...inner.querySelectorAll('.node.fresh')];
    progress.seenFrontier = front;
    saveProgress();
    if (!path) return;
    // Yeni parça uçtan uca çizilir; bitince yolun geri kalanı gibi noktalı olur
    const settle = () => path.classList.replace('road-new', 'road-done');
    if (REDUCED || !path.animate) settle();
    else {
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len} ${len}`;
      const anim = path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration: 1100, easing: 'ease-in-out', fill: 'forwards' });
      anim.onfinish = () => { anim.cancel(); path.style.strokeDasharray = ''; settle(); };
    }
    const marker = inner.querySelector('.marker');
    fresh.forEach((el, k) => setTimeout(() => {
      el.classList.add('pop');
      Sound.unlock(k);
      if (el.classList.contains('current') && marker) marker.classList.add('pop');
    }, REDUCED ? 0 : 700 + k * 140));
  }

  function renderGateStrip(geo) {
    const strip = $('gateStrip');
    let html = '';
    for (let g = 1; g < geo.arches.length; g++) {
      const teaser = g > GATE_COUNT;
      const locked = teaser || !isUnlocked(W.gateStart(g));
      html += `<button data-g="${g}" class="${locked ? 'locked' : ''}${!teaser && gateGold(g) ? ' gold' : ''}"
        aria-label="${tr('Kapı {n}', { n: g })}${teaser ? ', ' + tr('yakında') : locked ? ', ' + tr('kilitli') : ''}" style="--wa:${W.worldOfGate(g).theme.accent}">${g}</button>`;
    }
    strip.innerHTML = html;
    strip.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        Sound.tap();
        const g = Number(b.dataset.g);
        const wrap = $('map');
        wrap.scrollTo({ top: geo.arches[g].y - wrap.clientHeight * 0.75, behavior: REDUCED ? 'auto' : 'smooth' });
      };
    });
    updateGateStrip();
  }

  // Ekranın ortasındaki kapıyı şeritte işaretler
  function mapGateAt(y) {
    if (!mapGeo) return 1;
    const yb = mapGeo.height - y;
    return Math.max(1, Math.min(mapGeo.arches.length - 1, Math.floor((yb - MAP.bottom) / MAP.block) + 1));
  }
  function updateGateStrip() {
    const wrap = $('map');
    const g = mapGateAt(wrap.scrollTop + wrap.clientHeight / 2);
    $('gateStrip').querySelectorAll('button').forEach(b => b.classList.toggle('here', Number(b.dataset.g) === g));
  }
  $('map').addEventListener('scroll', updateGateStrip, { passive: true });

  // ---- Kutlamalar: kapı açılışı ve yeni unvan ----
  function pendingCelebration() {
    const g = W.gateOf(frontier());
    const gate = g > 1 && !progress.rewards['gate:' + g] && isUnlocked(W.gateStart(g)) ? g : null;
    const title = currentTitle();
    const newTitle = title !== progress.title ? title : null;
    // Son kapı da bittiyse açılacak kapı yok ama unvan değişmiş olabilir (örneğin dünya bitti)
    if (!gate && !newTitle) return null;
    return { gate, newTitle };
  }

  function celebrate(p, done) {
    mapBusy = true;
    const veil = $('ceremony');
    veil.hidden = false;
    const arch = p.gate ? $('mapInner').querySelector(`.arch[data-gate="${p.gate}"]`) : null;
    let shown = false;
    const showCard = () => {
      if (shown) return;
      shown = true;
      if (arch) { arch.classList.add('opening', 'open'); arch.classList.remove('locked'); }
      const rewards = [];
      if (p.gate) {
        progress.rewards['gate:' + p.gate] = true;
        progress.hints += ECO.gateBulbs;
        rewards.push(`<span class="chip bulb">${tr('+{n} ampul', { n: ECO.gateBulbs })}</span>`);
      }
      if (p.newTitle) {
        progress.title = p.newTitle;
        rewards.push(`<span class="chip rank-chip">${tr('Yeni unvan')}: <b>${tr(p.newTitle)}</b></span>`);
      }
      saveProgress();
      const gate = p.gate ? W.GATES[p.gate - 1] : null;
      const world = p.gate ? W.worldOfGate(p.gate) : null;
      $('gateEyebrow').textContent = p.gate ? tr('Kapı {n} açıldı', { n: p.gate }) : tr('Yolculuk');
      $('gateTitle').textContent = gate ? gate.name : tr('Tebrikler!');
      $('gateWorld').textContent = p.gate
        ? (W.isWorldStart(p.gate) ? tr('Yeni dünya: {name}', { name: world.name }) : world.name)
        : (GATE_COUNT < W.GATES.length ? tr('Bu dünyayı bitirdin. Yeni kapılar yakında açılacak.') : tr('Bütün kapıları açtın.'));
      $('gateRewards').innerHTML = rewards.join('');
      $('gateCard').classList.remove('hidden');
      launchConfetti(2);
    };
    $('gateGo').onclick = () => {
      Sound.tap();
      $('gateCard').classList.add('hidden');
      veil.hidden = true;
      mapBusy = false;
      done();
    };
    veil.onclick = showCard; // dokununca tören atlanır
    if (REDUCED || !arch) { Sound.gate(); showCard(); return; }
    setTimeout(() => { arch.classList.add('opening'); Sound.gate(); }, 450);
    setTimeout(showCard, 2100);
  }

  // ---- Harita zemini: dünyanın renginde yavaşça yükselen ışık parçacıkları ----
  const mapCanvas = $('mapFx');
  const mctx = mapCanvas.getContext('2d');
  let motes = [];
  function drawMapFx(now) {
    const wrap = mapCanvas.parentElement;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (mapCanvas.width !== Math.round(w * dpr) || mapCanvas.height !== Math.round(h * dpr)) {
      mapCanvas.width = Math.round(w * dpr);
      mapCanvas.height = Math.round(h * dpr);
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    mctx.clearRect(0, 0, w, h);
    if (REDUCED || !w) return;
    const map = $('map');
    const accent = W.worldOfGate(mapGateAt(map.scrollTop + map.clientHeight / 2)).theme.accent;
    while (motes.length < 22) {
      motes.push({ x: Math.random() * w, y: h + Math.random() * h, r: 1 + Math.random() * 2.4,
                   v: 0.15 + Math.random() * 0.35, ph: Math.random() * TAU });
    }
    mctx.fillStyle = accent;
    for (const m of motes) {
      m.y -= m.v;
      if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
      mctx.globalAlpha = 0.25 + 0.25 * Math.sin(now / 900 + m.ph);
      mctx.beginPath(); mctx.arc(m.x + Math.sin(now / 1600 + m.ph) * 8, m.y, m.r, 0, TAU); mctx.fill();
    }
    mctx.globalAlpha = 1;
  }

  // ---- Yeni dünyaya ilk giriş kartı ----
  function maybeWorldCard(n) {
    const g = W.gateOf(n);
    const world = W.worldOfGate(g);
    if (W.posInGate(n) !== 1 || !W.isWorldStart(g) || g === 1) return;
    if (progress.rewards['world:' + world.id]) return;
    showWorldCard(world);
  }
  // ---- Günlük seri sandığı: her gün ilk açılışta, ana ekranda (rewards.js STREAK) ----
  const bigChestSvg = rarity => `<svg class="big-chest ${rarity}" viewBox="0 0 120 100" aria-hidden="true">
    <ellipse class="shade" cx="60" cy="92" rx="44" ry="6"/>
    <rect class="box" x="16" y="46" width="88" height="42" rx="6"/>
    <path class="plank" d="M18 67h84"/>
    <rect class="band" x="28" y="46" width="10" height="42"/><rect class="band" x="82" y="46" width="10" height="42"/>
    <g class="lid"><path class="lidp" d="M16 48V38C16 12 104 12 104 38V48Z"/>
      <rect class="band" x="28" y="20" width="10" height="28"/><rect class="band" x="82" y="20" width="10" height="28"/></g>
    <g class="lock"><rect class="band" x="52" y="38" width="16" height="18" rx="3"/><circle cx="60" cy="45" r="2.6"/><rect x="58.8" y="45" width="2.4" height="6"/></g>
  </svg>`;

  function maybeStreak() {
    if (!progress.tutorialDone || !$('streakCard').classList.contains('hidden')) return;
    const step = R.streakStep(progress.streak, today());
    if (step) showStreakCard(step);
  }

  function streakDaysHtml(slot, opened) {
    const days = R.STREAK.days;
    return days.map((d, k) => {
      const state = k < slot || (k === slot && opened) ? 'done' : k === slot ? 'today' : '';
      return `<li class="${state}${k === days.length - 1 ? ' last' : ''}"><small>${tr('{n}. gün', { n: k + 1 })}</small>
        <b><i class="coin-ico"></i>${d.coins}</b>${d.bulbs ? '<em>+1 <i class="bulb-ico"></i></em>' : ''}</li>`;
    }).join('');
  }

  function showStreakCard(step) {
    const days = R.STREAK.days, r = step.reward;
    const next = days[(step.slot + 1) % days.length];
    $('streakTitle').textContent = tr('{n}. gün', { n: step.slot + 1 });
    $('streakDays').innerHTML = streakDaysHtml(step.slot, false);
    $('streakChest').innerHTML = bigChestSvg(r.rarity);
    $('streakNote').textContent = step.missed
      ? tr('{n} gün ara verdin, seri {n} gün geri gitti. Sıfırlanmadı!', { n: step.missed })
      : step.slot === days.length - 1 ? tr('Serinin son günü: efsane sandık!') : tr('Her gün gel, sandık her gün büyüsün.');
    const btn = $('streakGo');
    btn.textContent = tr('Sandığı aç');
    btn.disabled = false;
    $('streakCard').classList.remove('hidden');
    let opened = false;
    btn.onclick = () => {
      if (opened) { Sound.tap(); $('streakCard').classList.add('hidden'); renderHome(); return; }
      opened = true;
      btn.disabled = true;
      // Ödül hemen kayda yazılır; kart kapanmadan uygulama kapansa da kaybolmaz
      progress.streak = { day: today(), count: step.count };
      progress.coins += r.coins;
      progress.hints += r.bulbs;
      stat('coinsTotal', r.coins);
      saveProgress();
      const chest = $('streakChest').firstElementChild;
      chest.classList.add('shake');
      Sound.chestShake();
      setTimeout(() => {
        chest.classList.remove('shake');
        chest.classList.add('open');
        Sound.chestOpen(r.rarity);
        if (navigator.vibrate && r.rarity === 'epic') { try { navigator.vibrate([20, 40, 30]); } catch (e) { /* yok say */ } }
        $('streakDays').innerHTML = streakDaysHtml(step.slot, true);
        $('streakNote').innerHTML = `<span class="streak-got"><b>${tr('+{n} altın', { n: r.coins })}</b>${r.bulbs ? ` · <b>${tr('+{n} ampul', { n: r.bulbs })}</b>` : ''}</span>
          ${tr('Yarın gel')}: <b>${tr('{n} altın', { n: next.coins })}${next.bulbs ? ' ' + tr('ve ampul') : ''}</b>`;
        btn.textContent = 'Devam';
        btn.disabled = false;
        renderHome();
        awardBadges(false);
      }, CHEST_SHAKE_MS);
    };
  }

  function showWorldCard(world) {
    $('worldTitle').textContent = world.name;
    $('worldIntro').textContent = world.intro;
    $('worldCard').style.setProperty('--wa', world.theme.accent);
    $('worldCard').classList.remove('hidden');
    $('worldGo').onclick = () => {
      Sound.tap();
      progress.rewards['world:' + world.id] = true;
      saveProgress();
      $('worldCard').classList.add('hidden');
    };
  }

  // ---- Boyutlandırma ----
  let scale = 1;
  function resize() {
    const stage = $('stage');
    const w = stage.clientWidth, h = stage.clientHeight;
    if (w && h) {
      scale = Math.min(w / BOARD.w, h / BOARD.h);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = BOARD.w * scale + 'px';
      canvas.style.height = BOARD.h * scale + 'px';
      canvas.width = Math.round(BOARD.w * scale * dpr);
      canvas.height = Math.round(BOARD.h * scale * dpr);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      const bg = $('boardBg');
      bg.width = canvas.width;
      bg.height = canvas.height;
      drawBoardBg();
    }
    const app = $('app');
    const dpr = window.devicePixelRatio || 1;
    fx.width = app.clientWidth * dpr;
    fx.height = app.clientHeight * dpr;
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  function present(i) { return !(S.mask & (1 << i)); }
  const isBar = i => S.L.rings[i].kind === 'bar';
  const isFrame = i => S.L.rings[i].kind === 'frame';
  // Bir noktanın çubuğa ya da çerçevenin en yakın kenarına uzaklığı
  const pieceDist = (px, py, r) => (r.kind === 'frame' ? Math.min(...r.segs.map(s => segDist(px, py, s))) : segDist(px, py, r));

  function segDist(px, py, b) {
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
    const t = Math.max(0, Math.min(1, ((px - b.x1) * dx + (py - b.y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (b.x1 + dx * t), py - (b.y1 + dy * t));
  }
  function barAxis(b) {
    const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
    return { ux: (b.x2 - b.x1) / len, uy: (b.y2 - b.y1) / len, len };
  }

  function startDef(def, levelNo, tut, preview = null) {
    Object.assign(S, {
      levelNo, tut, def, L: buildLevel(def), mask: 0, moves: 0,
      fly: {}, shake: {}, drag: null, hint: null, won: false, failed: false, shownStars: 3,
      keyFly: [], keyPulse: null, loot: null, lootInAir: 0, coinMult: 1, kicks: [], kickEnd: null, springSpot: {},
      tokenFly: [], swT0: 0, phT0: 0,
      coinsTaken: 0, limit: tut == null ? moveLimit(def.par || 5, preview || (levelNo ? srcOf(levelNo) : 0)) : Infinity,
      auto: null, help: { lastAct: performance.now(), shown: false }, usedHint: false, extra: 0, preview,
    });
    closeHintMenu();
    $('hint').classList.remove('pulse');
    S.angles = S.L.startAngles.slice();
    S.left = S.L.tokens.slice(); // jetonlu halkaların kalan jetonları
    S.sw = S.L.startSw;           // şalterin gösterdiği renk
    S.ph = 0;                     // nabız kapakları: hamle sayısının teki/çifti
    S.swPos = S.L.hasSwitch ? switchSpot() : null;
    const loot = tut == null && !preview && levelNo ? lootWaiting(levelNo) : null;
    if (loot) S.loot = { ...loot, t0: null, done: false, phase: Math.random() * TAU };
    // Bölüm altınları yalnız ilk bitirişte: tekrar oynayarak altın toplanmasın (alınmamış altın halka hariç)
    const replay = levelNo && !preview && !!progress.stars[idOf(levelNo)];
    S.coins = tut == null && (!replay || (S.loot && S.loot.type === 'gold')) ? placeCoins() : [];
    coinFly = [];
    landBulbs();
    particles = [];
    confetti = [];
    shocks = [];
    floaters = [];
    lightWaves = [];
    $('win').classList.add('hidden');
    $('fail').classList.add('hidden');
    $('game').classList.toggle('tutorial', tut != null);
    renderMeter(true);
    updateHud();
  }

  // Deneme bölümü: el işareti ve açıklama kartıyla rehberli
  function loadTutorial(i) {
    const def = getTutorial(i);
    startDef(def, 0, i);
    $('coachStep').textContent = tr('Deneme {n} / {all}', { n: i + 1, all: TUTORIAL.length });
    $('coachTitle').textContent = def.title;
    $('coachText').textContent = def.text;
    hideTip();
    guide();
  }

  // Denemede sıradaki hamleyi her zaman göster
  function guide() {
    if (S.tut == null || S.won) return;
    const sol = solveFast(S.L, S.angles, S.mask, 20000, undefined, S.left, S.sw, S.ph);
    S.hint = sol && sol.first ? { ...sol.first, t0: performance.now(), guide: true } : null;
  }

  function loadLevel(n) {
    const src = srcOf(n);
    const def = getLevel(src);
    if (!def) { showTip(tr('Bu seviye yüklenemedi')); return; }
    applyWorld(W.worldOfGate(W.gateOf(n)));
    if (n !== failedLevel) failedLevel = null;
    startDef(def, n, null);
    maybeWorldCard(n);
    if (dailyGift()) return;
    if (src === 1) showTip(tr('Halkayı sürükleyerek döndür'), 4000);
    else if (src === 2) showTip(tr('Parlayan nokta: halka oradan geçebilir'), 4000);
    else if (src === 5) showTip(tr('Gri halkalar kilitli, dönmez'), 3500);
    else if (src === 7) showTip(tr('Noktalı çizgiyle bağlı halkalar birlikte döner'), 4000);
    else if (src === 8) showTip(tr('Bu halkanın iki boşluğu var'), 3500);
    else if (src === 9) showTip(tr('Çubuk dönmez: halkaların boşluğunu çubuğa getir'), 4500);
    else if (def.name && !progress.shapeTip) {
      showTip(tr('{name} halkalara takılmış! Onu kurtar', { name: tr(def.name) }), 3500);
      progress.shapeTip = true;
      saveProgress();
    }
    else if (S.loot && !progress[LOOT_TIPS[S.loot.type].flag]) {
      showTip(LOOT_TIPS[S.loot.type].text, 4500);
      progress[LOOT_TIPS[S.loot.type].flag] = true;
      saveProgress();
    }
    else if (pieceWaiting(n) && !progress.pieceTip) {
      showTip(tr('Bu bölümü bitir, çıkartma parçası kazan'), 4000);
      progress.pieceTip = true;
      saveProgress();
    }
    else if (!progress.coinTip && S.coins.length) {
      showTip(tr('Altını almak için yanındaki halkayı serbest bırak'), 4000);
      progress.coinTip = true;
      saveProgress();
    } else hideTip();
  }

  function renderMeter(reset) {
    const par = S.def.par ?? 99;
    const stars = S.extra ? 1 : starsFor(S.moves, par);
    const meter = $('starMeter');
    if (reset || meter.children.length !== 3) {
      meter.innerHTML = '<span class="star-ico"></span><span class="star-ico"></span><span class="star-ico"></span>';
    }
    [...meter.children].forEach((el, k) => {
      const on = k < stars;
      if (!on && !el.classList.contains('off') && !reset) {
        el.classList.add('drop');
        setTimeout(() => el.classList.remove('drop'), 500);
      }
      el.classList.toggle('off', !on);
    });
    S.shownStars = stars;
  }

  function updateHud() {
    $('levelLabel').textContent = S.tut != null ? tr('Nasıl oynanır')
      : S.preview ? tr('Önizleme') + ' · ' + tr(S.def.title || S.def.name)
      : tr('Seviye {n}', { n: S.levelNo }) + ' · ' + (S.def.name ? tr(S.def.name) : W.GATES[W.gateOf(S.levelNo) - 1].name);
    const left = S.limit - S.moves;
    $('movesNum').textContent = S.tut != null ? S.moves : left;
    $('movesLbl').textContent = S.tut != null ? tr('hamle') : tr('hamle kaldı');
    $('movesNum').classList.toggle('warn', S.tut == null && left <= 2 && !S.won);
    $('scoreNum').textContent = fmt(shownScore);
    $('coinNum').textContent = progress.coins - S.lootInAir + S.coinsTaken * S.coinMult;
    renderHintCount();
  }

  let tipTimer = 0;
  function showTip(text, ms = 2500) {
    const el = $('tip');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, ms);
  }
  function hideTip() { $('tip').classList.remove('show'); }

  // ---- Hamle sonrası: serbest kalan halkaları uçur ----
  function settle() {
    const { mask, waves, kicks, tokens, angles, left } = cascade(S.L, S.angles, S.mask, S.left, S.ph);
    const now = performance.now();
    const finale = mask === S.L.full && !S.won;
    // Dalgaların başlama anı: yaylı halka tekme attıysa sonraki dalga tekmenin dönüşünü bekler
    const at = [];
    waves.reduce((t, _, w) => { at[w] = t; return t + (kicks[w].length ? KICK_WAIT + KICK_MS : WAVE_MS); }, 0);
    let before = S.angles;
    kicks.forEach((ks, w) => {
      for (const k of ks) {
        S.kicks.push({ ring: k.target, delta: k.turn, t0: now + at[w] + KICK_WAIT, done: 0 });
        setTimeout(() => { Sound.boing(); kickSpark(k.from, k.target); }, at[w] + KICK_WAIT);
        before = rotate(S.L, before, k.target, k.turn);
      }
    });
    if (S.kicks.length) S.kickEnd = angles;
    // Kurtulan halkanın jetonu jetonlu halkaya uçar; sayı jeton varınca artar (mantıkta hemen geçerli)
    tokens.forEach((ts, w) => {
      for (const t of ts) {
        S.tokenFly.push({ ...t, t0: now + at[w] + 80, from: tokenPos(t.from, 'carry') });
        setTimeout(() => Sound.token(), at[w] + 80 + TOKEN_FLY_MS);
      }
    });
    S.left = left;
    waves.forEach((wave, w) => {
      const last = finale && w === waves.length - 1;
      if (last) setTimeout(() => finaleBlast(wave), at[w]);
      for (const i of wave) {
        const r = S.L.rings[i];
        let dx = r.x - BOARD.w / 2, dy = r.y - BOARD.h / 2;
        if (r.kind === 'bar') {
          const { ux, uy } = barAxis(r);
          const s = ux * dx + uy * dy >= 0 ? 1 : -1;
          dx = ux * s; dy = uy * s;
        } else {
          const len = Math.hypot(dx, dy);
          if (len < 1) { dx = 0; dy = -1; } else { dx /= len; dy /= len; }
        }
        S.fly[i] = { t0: now + at[w], dx, dy };
        setTimeout(() => { Sound.pop(w); burst(i, last); }, at[w]);
      }
    });
    // Kurtulan anahtar halkadan kilitli halkaya anahtar uçar
    waves.forEach((wave, w) => {
      for (const k of wave) {
        S.L.rings.forEach((r, l) => {
          if (r.lockedBy !== k || (mask & (1 << l))) return;
          S.keyFly.push({ key: k, lock: l, t0: now + at[w] });
          setTimeout(() => Sound.keyOpen(), at[w] + KEY_MS);
        });
      }
    });
    const freed = waves.flat();
    // Son hamlede bölüm sonu övgüsü varsa zincir yalnızca sayılır, iki övgü üst üste binmez
    const endWord = finale ? endPraise() : null;
    if (freed.length >= 2) setTimeout(() => showChain(freed, !!endWord), at[waves.length - 1]);
    if (endWord) setTimeout(() => showEndPraise(endWord), at[waves.length - 1] + 260);
    S.mask = mask;
    for (const c of S.coins) {
      if (c.taken) continue;
      const k = S.L.links[c.link];
      if (!(mask & (1 << k.a)) && !(mask & (1 << k.b))) continue;
      c.taken = true;
      const w = waves.findIndex(wv => wv.includes(k.a) || wv.includes(k.b));
      collectCoin(c, at[Math.max(w, 0)]);
    }
    const loot = S.loot;
    if (loot && loot.t0 == null && (mask & (1 << loot.ring))) {
      const w = waves.findIndex(wv => wv.includes(loot.ring));
      const t0 = now + at[Math.max(w, 0)];
      if (loot.type === 'chest') openChest(t0);
      else if (loot.type === 'gold') openGold(t0);
      else openBulbRing(t0);
    }
    if (waves.length && navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* yok say */ } }
    if (mask === S.L.full && !S.won) {
      S.won = true;
      // Ödül açılıyorsa bölüm sonu ekranı onun ardından gelir
      const lootEnd = loot && loot.t0 != null ? loot.t0 + (loot.type === 'chest' ? CHEST_SHAKE_MS + 750 : TOKEN_MS + 500) - now : 0;
      setTimeout(showWin, Math.max(at[waves.length - 1] + WAVE_MS + FLY_MS + (fxOn() ? 350 : 0), lootEnd));
    }
    updateHud();
  }

  // ---- Altınlar ----
  // Rastgele birkaç kesişimin ortasına (iki halkanın ortak alanına) altın koyar.
  function placeCoins() {
    const L = S.L;
    const order = L.links.map((_, i) => i).sort(() => Math.random() - 0.5);
    const want = Math.min(L.links.length, S.loot && S.loot.type === 'gold' ? R.LOOT.goldCoins
      : ECO.levelCoins[0] + Math.floor(Math.random() * (ECO.levelCoins[1] - ECO.levelCoins[0] + 1)));
    const out = [];
    // Dişli işaretlerinin (ters dişli oku, "×2" etiketi) üstüne altın konmaz
    const marks = L.couples.filter(c => c.ratio !== 1).map(c => {
      const a = L.rings[c.a], b = L.rings[c.b];
      if (c.ratio === -1) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const f = Math.abs(c.ratio) > 1 ? b : a;
      return { x: f.x, y: f.y - 22 };
    });
    for (const li of order) {
      if (out.length >= want) break;
      const k = L.links[li];
      if (L.rings[k.a].kind !== 'ring' || L.rings[k.b].kind !== 'ring' || k.pts.length < 2) continue;
      const x = (k.pts[0].x + k.pts[1].x) / 2;
      const y = (k.pts[0].y + k.pts[1].y) / 2;
      const clear = L.rings.every((r, i) => i === k.a || i === k.b ||
        (r.kind !== 'ring' ? pieceDist(x, y, r) > 18 : Math.abs(Math.hypot(x - r.x, y - r.y) - r.r) > 18));
      const offMark = marks.every(m => Math.hypot(m.x - x, m.y - y) > 30) &&
        (!S.loot || Math.hypot(S.loot.x - x, S.loot.y - y) > 46);
      if (clear && offMark && !out.some(c => Math.hypot(c.x - x, c.y - y) < 30)) {
        out.push({ link: li, x, y, taken: false, phase: Math.random() * TAU });
      }
    }
    return out;
  }

  // tahta koordinatı -> #app koordinatı (efekt katmanı için)
  function boardToApp(x, y) {
    const cr = canvas.getBoundingClientRect();
    const ar = $('app').getBoundingClientRect();
    return { x: cr.left - ar.left + x * scale, y: cr.top - ar.top + y * scale };
  }

  function coinTarget() {
    const pr = $('coinPill').getBoundingClientRect();
    const ar = $('app').getBoundingClientRect();
    return { x: pr.left - ar.left + 17, y: pr.top - ar.top + pr.height / 2 };
  }

  function collectCoin(c, delay) {
    const start = boardToApp(c.x, c.y);
    // Altın halka açıldıysa her altın 2 tane uçar
    for (let m = 0; m < S.coinMult; m++) coinFly.push({ x: start.x, y: start.y, t0: performance.now() + delay + m * 90 });
    setTimeout(() => Sound.coin(), delay);
    if (S.coinMult > 1) setTimeout(() => Sound.coin(2), delay + 90);
    setTimeout(() => {
      if (!c.taken || S.won) return; // bölüm bittiyse kasaya showWin ekler
      S.coinsTaken = S.coins.filter(k => k.taken).length;
      updateHud();
      const pill = $('coinPill');
      pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
    }, delay + COIN_MS);
  }

  function drawCoin(g, x, y, r, spin) {
    const sx = 0.3 + 0.7 * Math.abs(Math.cos(spin));
    g.save();
    g.translate(x, y);
    g.scale(sx, 1);
    g.shadowColor = 'rgba(0,0,0,.45)';
    g.shadowBlur = 5;
    g.shadowOffsetY = 2;
    g.fillStyle = '#d98f12';
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = '#ffd54a';
    g.beginPath(); g.arc(0, 0, r * 0.8, 0, TAU); g.fill();
    g.strokeStyle = '#d98f12';
    g.lineWidth = r * 0.14;
    g.beginPath(); g.arc(0, 0, r * 0.52, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.beginPath(); g.ellipse(-r * 0.32, -r * 0.36, r * 0.22, r * 0.11, -0.6, 0, TAU); g.fill();
    g.restore();
  }

  function drawCoins(now) {
    for (const c of S.coins) {
      if (c.taken) continue;
      const bob = REDUCED ? 0 : Math.sin(now / 400 + c.phase) * 2;
      const spin = REDUCED ? 0 : now / 700 + c.phase;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffd54a';
      ctx.beginPath(); ctx.arc(c.x, c.y + bob, 15, 0, TAU); ctx.fill();
      ctx.restore();
      drawCoin(ctx, c.x, c.y + bob, 11, spin);
      if (S.coinMult > 1) drawMultTag(c.x + 13, c.y + bob - 12);
    }
  }

  // ---- Sandık ----
  // Halka kurtulunca: ödül hemen kayda yazılır (bölümden çıkılsa da kaybolmaz), sandık titrer,
  // açılır, altınlar sayaca, ampul ipucu düğmesine uçar. Sayaçlar uçuşlar konunca artar.
  function openChest(t0) {
    const c = S.loot;
    c.t0 = t0;
    progress.loot[idOf(S.levelNo)] = c.rarity;
    progress.coins += c.coins;
    progress.hints += c.bulbs;
    stat('coinsTotal', c.coins);
    S.lootInAir = c.coins;
    bulbsInAir += c.bulbs;
    saveProgress();
    const wait = Math.max(0, t0 - performance.now());
    setTimeout(() => S.loot === c && Sound.chestShake(), wait);
    setTimeout(() => {
      if (S.loot !== c) return;
      Sound.chestOpen(c.rarity);
      chestBurst(c);
      const p = boardToApp(c.x, c.y);
      if (c.rarity !== 'common') {
        const w = $('app').clientWidth;
        floaters.push({ text: tr(c.name) + '!', x: Math.max(110, Math.min(w - 110, p.x)), y: p.y, t0: performance.now(), big: c.rarity === 'epic' });
      }
      if (c.rarity === 'epic' && navigator.vibrate) { try { navigator.vibrate([20, 40, 30]); } catch (e) { /* yok say */ } }
      lootCoins(c, p);
      if (c.bulbs) setTimeout(() => flyBulbs(c.bulbs, p.x, p.y, true), 650);
      awardBadges(false);
    }, wait + CHEST_SHAKE_MS);
  }

  // Altın halka: kurtulunca bölümün altınları 2 kat sayılır (ödül bölüm bitince, altınlarla birlikte verilir)
  function openGold(t0) {
    const c = S.loot;
    c.t0 = t0;
    setTimeout(() => {
      if (S.loot !== c) return;
      S.coinMult = R.LOOT.goldMult;
      Sound.goldRing();
      lootBurst(c, '#ffc94a', 40);
      const p = boardToApp(c.x, c.y), w = $('app').clientWidth;
      floaters.push({ text: tr('Altın ×{n}!', { n: R.LOOT.goldMult }), x: Math.max(110, Math.min(w - 110, p.x)), y: p.y, t0: performance.now(), big: true });
      updateHud();
      const pill = $('coinPill');
      pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
    }, Math.max(0, t0 - performance.now()));
  }

  // Ampul halkası: +1 ampul hemen kayda yazılır, ampul ipucu düğmesine uçar
  function openBulbRing(t0) {
    const c = S.loot;
    c.t0 = t0;
    progress.loot[idOf(S.levelNo)] = 'bulb';
    progress.hints += c.bulbs;
    bulbsInAir += c.bulbs;
    saveProgress();
    setTimeout(() => {
      if (S.loot !== c) return;
      Sound.bulbRing();
      lootBurst(c, '#fff3b0', 30);
    }, Math.max(0, t0 - performance.now()));
    setTimeout(() => {
      if (S.loot !== c) return;
      const p = boardToApp(c.x, c.y);
      flyBulbs(c.bulbs, p.x, p.y, true);
    }, Math.max(0, t0 - performance.now()) + TOKEN_MS);
  }

  // Sandığın altınları birkaç parça halinde sayaca uçar; her konan altın sesi biraz daha tiz
  function lootCoins(c, p) {
    const k = Math.min(c.coins, 6);
    for (let j = 0; j < k; j++) {
      const share = Math.floor(c.coins * (j + 1) / k) - Math.floor(c.coins * j / k);
      const delay = 120 + j * 90;
      coinFly.push({ x: p.x + (j - (k - 1) / 2) * 9, y: p.y - 8, t0: performance.now() + delay });
      setTimeout(() => {
        if (S.loot !== c) return;
        S.lootInAir = Math.max(0, S.lootInAir - share);
        Sound.coin(j);
        updateHud();
        const pill = $('coinPill');
        pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
      }, delay + COIN_MS);
    }
  }

  const chestBurst = c => lootBurst(c, RARITY_COLOR[c.rarity], c.rarity === 'epic' ? 60 : c.rarity === 'rare' ? 38 : 22);
  function lootBurst(c, color, n) {
    if (REDUCED) return;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = 1.5 + Math.random() * (c.rarity === 'epic' ? 5 : 3.5);
      particles.push({ x: c.x, y: c.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, size: 1.5 + Math.random() * 3, color: k % 3 ? color : '#fff6c4' });
    }
  }

  // Sandık simgesi: tahta gövde, nadirlik renginde kuşaklar ve kilit; open (0-1) kapağı kaldırır
  function drawChestIcon(g, x, y, s, open, rarity) {
    const band = RARITY_COLOR[rarity];
    const rr = (x0, y0, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x0, y0, w, h, r); else g.rect(x0, y0, w, h); };
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(0, 13, 15, 3.5, 0, 0, TAU); g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = '#3d2210';
    rr(-15, -3, 30, 15, 3);
    g.fillStyle = '#8a5527'; g.fill(); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.moveTo(-14, 4.5); g.lineTo(14, 4.5); g.stroke();
    g.fillStyle = band;
    g.fillRect(-11, -3, 4, 15); g.fillRect(7, -3, 4, 15);
    if (open > 0) {
      g.fillStyle = `rgba(255, 240, 180, ${Math.min(1, open * 1.5)})`;
      g.fillRect(-13, -5, 26, 3);
    }
    // Kapak arka menteşeden döner
    g.save();
    g.translate(-15, -3); g.rotate(-1.15 * open); g.translate(15, 3);
    g.beginPath(); g.moveTo(-15, -3); g.lineTo(-15, -8); g.bezierCurveTo(-15, -15, 15, -15, 15, -8); g.lineTo(15, -3); g.closePath();
    g.fillStyle = '#9c6230'; g.fill();
    g.strokeStyle = '#3d2210'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = band;
    g.fillRect(-11, -12.4, 4, 9.4); g.fillRect(7, -12.4, 4, 9.4);
    g.fillStyle = 'rgba(255,255,255,.22)';
    g.beginPath(); g.ellipse(-4, -10, 7, 1.6, 0, 0, TAU); g.fill();
    g.restore();
    if (open < 0.3) {
      g.fillStyle = band;
      rr(-3.5, -6, 7, 8, 1.5); g.fill();
      g.fillStyle = '#3d2210';
      g.beginPath(); g.arc(0, -3, 1.4, 0, TAU); g.fill();
      g.fillRect(-0.6, -3, 1.2, 3);
    }
    g.restore();
  }

  // Altın halka simgesi: "×2" yazılı büyük altın; ampul halkası simgesi: cam ampul ve duy
  function drawMultTag(x, y) {
    ctx.save();
    ctx.font = `800 12px ${FLOAT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(40, 24, 0, .85)';
    ctx.strokeText('×' + S.coinMult, x, y);
    ctx.fillStyle = '#ffe48a';
    ctx.fillText('×' + S.coinMult, x, y);
    ctx.restore();
  }
  function drawGoldToken(x, y, s, now) {
    drawCoin(ctx, x, y, 15 * s, REDUCED ? 0 : Math.sin(now / 900) * 0.5);
    ctx.save();
    ctx.font = `900 ${13 * s}px ${FLOAT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#7a4a00';
    ctx.fillText('×' + R.LOOT.goldMult, x, y + 1);
    ctx.restore();
  }
  function drawBulbToken(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#9aa3bd';
    ctx.strokeStyle = '#4b5270';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-5, 6, 10, 8, 2); else ctx.rect(-5, 6, 10, 8); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(75, 82, 112, .8)';
    ctx.beginPath(); ctx.moveTo(-5, 9); ctx.lineTo(5, 9); ctx.moveTo(-5, 11.5); ctx.lineTo(5, 11.5); ctx.stroke();
    ctx.restore();
    drawBulb(ctx, x, y - 3 * s, 10 * s, 0.9);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath(); ctx.ellipse(x - 3.5 * s, y - 7 * s, 2.6 * s, 1.4 * s, -0.6, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // Halkanın renginde taban: ödülün hangi halkaya ait olduğunu gösterir; halka kurtulunca söner
  function drawLootBase(c, now) {
    const base = c.t0 == null ? 1 : Math.max(0, 1 - (now - c.t0) / 300);
    if (base <= 0) return;
    const rc = ringColor(c.ring);
    ctx.save();
    ctx.globalAlpha = base;
    ctx.fillStyle = rc + '30';
    ctx.strokeStyle = rc;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(c.x, c.y + 2, 25, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // Altın halka ve ampul halkası: bekler, kurtulunca büyüyüp ışık saçarak söner
  function drawToken(c, now) {
    let k = 0;
    if (c.t0 != null && now >= c.t0) {
      k = (now - c.t0) / TOKEN_MS;
      if (k >= 1) { c.done = true; return; }
    }
    drawLootBase(c, now);
    const color = c.type === 'gold' ? '#ffc94a' : '#fff3b0';
    const pulse = 0.5 + 0.5 * Math.sin(now / 380 + c.phase);
    const bob = REDUCED || c.t0 != null ? 0 : Math.sin(now / 500 + c.phase) * 1.5;
    const x = c.x, y = c.y + bob - 10 * k;
    ctx.save();
    ctx.globalAlpha = 1 - k * k;
    const glow = 27 + pulse * 3 + k * 36;
    const grd = ctx.createRadialGradient(x, y, 2, x, y, glow);
    grd.addColorStop(0, color + '88');
    grd.addColorStop(1, color + '00');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(x, y, glow, 0, TAU); ctx.fill();
    const s = 1 + 0.45 * Math.sin(Math.min(k, 0.5) * Math.PI);
    if (c.type === 'gold') drawGoldToken(x, y, s, now); else drawBulbToken(x, y, s);
    ctx.restore();
  }

  function drawLoot(now) {
    const c = S.loot;
    if (!c || c.done) return;
    if (c.type !== 'chest') { drawToken(c, now); return; }
    drawChest(c, now);
  }

  function drawChest(c, now) {
    let shakeX = 0, lift = 0, open = 0, alpha = 1, k = 0;
    if (c.t0 != null && now >= c.t0) {
      const t = now - c.t0;
      if (t < CHEST_SHAKE_MS) {
        const q = t / CHEST_SHAKE_MS;
        shakeX = REDUCED ? 0 : Math.sin(t / 16) * (1 + 3.5 * q);
        lift = -4 * q;
      } else {
        k = (t - CHEST_SHAKE_MS) / CHEST_OPEN_MS;
        if (k >= 1) { c.done = true; return; }
        open = Math.min(1, k * 3);
        alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        lift = -4 - 8 * k;
      }
    }
    const bob = REDUCED || c.t0 != null ? 0 : Math.sin(now / 500 + c.phase) * 1.5;
    const x = c.x + shakeX, y = c.y + bob + lift;
    const color = RARITY_COLOR[c.rarity];
    const pulse = 0.5 + 0.5 * Math.sin(now / 380 + c.phase);
    drawLootBase(c, now);
    ctx.save();
    ctx.globalAlpha = alpha;
    // Nadirlik ışığı: açılırken büyür
    const glow = (c.rarity === 'epic' ? 34 : c.rarity === 'rare' ? 31 : 27) + pulse * 3 + open * 40;
    const grd = ctx.createRadialGradient(x, y, 2, x, y, glow);
    grd.addColorStop(0, color + (c.rarity === 'common' ? '55' : '88'));
    grd.addColorStop(1, color + '00');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(x, y, glow, 0, TAU); ctx.fill();
    // Açılınca içinden ışık huzmeleri
    if (open > 0 && fxOn()) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(x, y - 6);
      ctx.rotate(now / 900);
      const len = 30 + 40 * k;
      for (let j = 0; j < 8; j++) {
        ctx.rotate(TAU / 8);
        ctx.fillStyle = `rgba(255, 236, 170, ${0.35 * (1 - k)})`;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-4, -len); ctx.lineTo(4, -len); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    drawChestIcon(ctx, x, y, CHEST_SIZE, open, c.rarity);
    // Efsane sandığın çevresinde parıltılar
    if (c.rarity === 'epic' && !open && !REDUCED) {
      for (let j = 0; j < 3; j++) {
        const a = now / 700 + j * TAU / 3 + c.phase;
        const tw = Math.max(0, Math.sin(now / 260 + j * 2));
        const sx = x + Math.cos(a) * 30, sy = y - 2 + Math.sin(a) * 20;
        ctx.fillStyle = `rgba(255, 246, 196, ${tw})`;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 4 * tw); ctx.lineTo(sx + 1.2, sy); ctx.lineTo(sx, sy + 4 * tw); ctx.lineTo(sx - 1.2, sy); ctx.closePath();
        ctx.moveTo(sx - 4 * tw, sy); ctx.lineTo(sx, sy + 1.2); ctx.lineTo(sx + 4 * tw, sy); ctx.lineTo(sx, sy - 1.2); ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // big: bölümün son halkası, daha çok ve daha hızlı parça saçar
  function burst(i, big) {
    if (REDUCED) return;
    const r = S.L.rings[i];
    const color = ringColor(i);
    const many = big && fxOn();
    for (let k = 0; k < (many ? 70 : 26); k++) {
      const a = Math.random() * TAU;
      const sp = (1.5 + Math.random() * 3.5) * (many ? 1.7 : 1);
      const t = Math.random();
      particles.push({
        x: r.kind === 'bar' ? r.x1 + (r.x2 - r.x1) * t : r.x + Math.cos(a) * r.r,
        y: r.kind === 'bar' ? r.y1 + (r.y2 - r.y1) * t : r.y + Math.sin(a) * r.r,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, size: 2 + Math.random() * 3, color, shape: BURST_SHAPE[equipped('burst')],
      });
    }
  }

  // Halkaların (ya da çubukların) orta noktası
  function waveCenter(wave) {
    let x = 0, y = 0;
    for (const i of wave) {
      const r = S.L.rings[i];
      x += r.kind === 'bar' ? (r.x1 + r.x2) / 2 : r.x;
      y += r.kind === 'bar' ? (r.y1 + r.y2) / 2 : r.y;
    }
    return { x: x / wave.length, y: y / wave.length };
  }

  // Son halka: gümleme, şok dalgası, beyaz parlama ve tahtada kısa bir sarsıntı
  function finaleBlast(wave) {
    Sound.boom();
    if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) { /* yok say */ } }
    if (!fxOn()) return;
    const c = waveCenter(wave);
    shocks.push({ ...boardToApp(c.x, c.y), t0: performance.now() });
    const wrap = canvas.parentElement;
    wrap.classList.remove('quake'); void wrap.offsetWidth; wrap.classList.add('quake');
  }

  // Övgü sözleri: tek hamlede kurtulan halka sayısına göre kademeli (art arda aynı söz gelmez).
  // Tek halkada övgü yok; seyrek kaldıkça değerli hisseder.
  const PRAISE = {
    1: { words: [tr('Güzel!'), tr('Süper!')], size: 36, colors: ['#fff3b0', '#ffb52e'] },
    2: { words: [tr('Harika!'), tr('Şahane!')], size: 42, colors: ['#d9fff6', '#2dd4bf'] },
    3: { words: [tr('Muhteşem!'), tr('İnanılmaz!')], size: 48, colors: ['#ffe0f4', '#f72585'] },
  };
  let lastPraise = '';
  function praiseWord(words) {
    const pool = words.filter(x => x !== lastPraise);
    lastPraise = pool[Math.floor(Math.random() * pool.length)];
    return lastPraise;
  }

  // Bir hamlede birden çok halka açılırsa: övgü ve altında "Zincir ×N" (N = açılan halka sayısı).
  // quiet: son hamlede bölüm sonu övgüsü gelecekse zincir yalnızca sayılır (yazı ve ses ona kalır).
  function showChain(freed, quiet) {
    if (S.tut != null) return;
    const n = freed.length;
    const c = waveCenter(freed);
    const p = boardToApp(c.x, c.y);
    const w = $('app').clientWidth;
    const x = Math.max(110, Math.min(w - 110, p.x));
    if (!quiet) {
      const tier = n >= 4 ? 3 : n === 3 ? 2 : 1;
      const pr = PRAISE[tier];
      floaters.push({ text: praiseWord(pr.words), sub: tr('Zincir ×{n}', { n }), x, y: p.y, t0: performance.now(),
        size: pr.size, colors: pr.colors, life: 1500 });
      Sound.praise(tier);
    }
    if (S.preview) return;
    stat('chains');
    progress.stats.bestChain = Math.max(progress.stats.bestChain || 0, n);
    saveProgress();
    awardBadges(false);
  }

  // Bölüm sonu övgüsü (son halkada, tahtanın ortasında): en az hamleyle bittiyse.
  // İpucusuz "Kusursuz!", ipucuyla "Mükemmel!"; ek hamleyle bitende ya da daha uzun çözümde yok.
  function endPraise() {
    if (S.tut != null || S.extra) return null;
    if (S.moves > (S.def.par ?? S.moves)) return null;
    return S.usedHint ? tr('Mükemmel!') : tr('Kusursuz!');
  }
  function showEndPraise(word) {
    const p = boardToApp(BOARD.w / 2, BOARD.h / 2);
    floaters.push({ text: word, x: p.x, y: p.y + 40, t0: performance.now(), size: 54,
      colors: ['#ffffff', '#ffc94a'], life: 1700 });
    Sound.praise(4);
  }

  // Bölüm sonunda kazanılan çıkartma parçası: yeni dilim yerine oturur
  function stickerWinHtml(piece, setDone) {
    const have = piecesOf(piece.world).filter(Boolean).length;
    return `<div class="sticker-win${setDone ? ' complete' : ''}" style="--wa:${W.worldById(piece.world).theme.accent}">
      ${stickerSvg(piece.world, piece.k)}
      <span><small>${setDone ? tr('Çıkartma tamamlandı!') : tr('Çıkartma parçası')}</small><b>${STK.SETS[piece.world].name}</b>
      <em>${setDone ? tr('+{n} altın', { n: R.STICKERS.setCoins }) : `${have} / ${STK.PIECES}`}</em></span></div>`;
  }

  function showWin() {
    if (S.tut != null) { showTutorialWin(); return; }
    if (S.preview) { showPreviewWin(); return; }
    const par = S.def.par ?? S.moves;
    const stars = S.extra ? 1 : starsFor(S.moves, par);
    const key = idOf(S.levelNo);
    const firstClear = !progress.stars[key];
    if (stars > (progress.stars[key] || 0)) lastWon = S.levelNo;
    progress.stars[key] = Math.max(progress.stars[key] || 0, stars);
    const earned = S.coins.filter(c => c.taken).length * S.coinMult;
    if (S.coinMult > 1) progress.loot[key] = 'gold';
    progress.coins += earned;
    stat('coinsTotal', earned);
    if (!S.usedHint) progress.clean[key] = true;
    if (failedLevel === S.levelNo) { stat('comebacks'); failedLevel = null; }
    S.coinsTaken = 0;
    progress.best = progress.best || {};
    const before = totalScore();
    progress.best[key] = Math.max(progress.best[key] || 0, levelScore(stars, earned));
    const after = totalScore();
    // Altın kapı: kapının 10 bölümü de 3 yıldız olunca bir kez ampul ödülü
    const g = W.gateOf(S.levelNo);
    const goldGate = gateGold(g) && !progress.rewards['gold:' + g];
    if (goldGate) {
      progress.rewards['gold:' + g] = true;
      progress.hints += GOLD_GATE_BULBS;
    }
    // Çıkartma parçası; set tamamlandıysa bir kez altın
    const piece = pieceWaiting(S.levelNo);
    let setDone = false;
    if (piece) {
      progress.stickers[piece.id] = today();
      if (piecesOf(piece.world).every(Boolean) && !progress.rewards['sticker:' + piece.world]) {
        progress.rewards['sticker:' + piece.world] = true;
        progress.coins += R.STICKERS.setCoins;
        stat('coinsTotal', R.STICKERS.setCoins);
        setDone = true;
      }
    }
    saveProgress();
    $('winNote').textContent = S.extra ? tr('Ek hamleyle bitti: bu bölüm en fazla 1 yıldız verir.') : '';
    const opened = S.loot && S.loot.t0 != null ? S.loot : null;
    const ch = opened && opened.type === 'chest' ? opened : null;
    $('winRewards').innerHTML = (firstClear && S.def.name ? `<span class="chip album-chip">${tr('Albüme eklendi')}: <b>${tr(S.def.name)}</b></span>` : '') +
      (ch ? `<span class="chip loot-chip ${ch.rarity}">${tr(ch.name)}: <b>${tr('+{n} altın', { n: ch.coins })}</b></span>` : '') +
      (ch && ch.bulbs ? `<span class="chip bulb"><b>${tr('+{n} ampul', { n: ch.bulbs })}</b></span>` : '') +
      (S.coinMult > 1 ? `<span class="chip loot-chip gold">${tr('Altın halka')}: <b>${tr('altınlar ×{n}', { n: S.coinMult })}</b></span>` : '') +
      (opened && opened.type === 'bulb' ? `<span class="chip bulb">${tr('Ampul halkası')}: <b>${tr('+{n} ampul', { n: opened.bulbs })}</b></span>` : '') +
      (goldGate ? `<span class="chip bulb">${tr('Altın kapı')}: <b>${tr('+{n} ampul', { n: GOLD_GATE_BULBS })}</b></span>` : '') +
      (piece ? stickerWinHtml(piece, setDone) : '');
    if (piece) setTimeout(() => Sound.piece(setDone), 900);
    if (goldGate) {
      bulbsInAir += GOLD_GATE_BULBS;
      setTimeout(() => {
        const r = $('winRewards').getBoundingClientRect(), ar = $('app').getBoundingClientRect();
        flyBulbs(GOLD_GATE_BULBS, r.left - ar.left + r.width / 2, r.top - ar.top + r.height / 2, true);
      }, 1300);
    }
    $('winCoins').textContent = '+' + earned;
    $('winScore').textContent = '+' + fmt(after - before);
    countScore(before, after);
    const card = $('win').querySelector('.card');
    card.classList.remove('tut');
    card.classList.toggle('perfect', stars === 3 && fxOn());
    $('winLevel').textContent = S.def.name ? tr('{name} kurtarıldı', { name: tr(S.def.name) }) : tr('Seviye {n} tamamlandı', { n: S.levelNo });
    $('winTitle').textContent = stars === 3 ? tr('Mükemmel!') : stars === 2 ? tr('Harika!') : tr('Başardın!');
    $('stars').innerHTML = [1, 2, 3].map(k =>
      `<span class="star-ico${k <= stars ? '' : ' off'}" style="animation-delay:${200 + k * 180}ms"></span>`).join('');
    $('winMoves').textContent = S.moves;
    $('winPar').textContent = par;
    $('continue').textContent = W.posInGate(S.levelNo) === W.GATE_SIZE || S.levelNo >= TOTAL ? tr('Haritaya dön') : tr('Sonraki seviye');
    $('win').classList.remove('hidden');
    Sound.win();
    for (let k = 1; k <= stars; k++) setTimeout(() => Sound.star(k), 400 + k * 180);
    if (stars === 3) setTimeout(perfectWave, 400 + 3 * 180 + 120);
    launchConfetti(stars);
    updateHud();
    setTimeout(() => awardBadges(false), 1500);
  }

  // 3 yıldız: ortadaki yıldızdan bütün ekrana yayılan altın ışık halkası
  function perfectWave() {
    if ($('win').classList.contains('hidden')) return;
    Sound.shine();
    if (!fxOn()) return;
    const st = $('stars').getBoundingClientRect();
    const ar = $('app').getBoundingClientRect();
    lightWaves.push({ x: st.left - ar.left + st.width / 2, y: st.top - ar.top + st.height / 2, t0: performance.now() });
  }

  // Kapıya yerleşmemiş bir tanıtım bölümü (?src=): sonuç kaydedilmez
  function showPreviewWin() {
    const stars = S.extra ? 1 : starsFor(S.moves, S.def.par ?? S.moves);
    const card = $('win').querySelector('.card');
    card.classList.remove('tut', 'perfect');
    $('winLevel').textContent = tr('Önizleme') + ' · ' + tr(S.def.title || S.def.name);
    $('winTitle').textContent = stars === 3 ? tr('Mükemmel!') : stars === 2 ? tr('Harika!') : tr('Başardın!');
    $('stars').innerHTML = [1, 2, 3].map(k =>
      `<span class="star-ico${k <= stars ? '' : ' off'}" style="animation-delay:${200 + k * 180}ms"></span>`).join('');
    $('winMoves').textContent = S.moves;
    $('winPar').textContent = S.def.par;
    $('winCoins').textContent = '+0';
    $('winScore').textContent = '+0';
    $('winNote').textContent = tr('Önizleme: sonuç kaydedilmedi.');
    $('winRewards').innerHTML = '';
    $('continue').textContent = tr('Ana menü');
    $('win').classList.remove('hidden');
    Sound.win();
    launchConfetti(stars);
    updateHud();
  }

  function loadPreview(src) {
    const def = getLevel(src);
    if (!def) { showTip(tr('Bu bölüm yüklenemedi')); return; }
    // Şekiller gireceği kapının dünyasında, tanıtımlar kendi dünyasında görünür
    const plan = window.RingLevels.SHAPE_PLAN[src];
    applyWorld(W.worldById(def.world) || (plan ? W.worldOfGate(plan.gate) : W.WORLDS[0]));
    startDef(def, 0, null, src);
    if (def.tip) showTip(def.tip, 5000);
  }

  const TUT_PRAISE = [tr('Harika!'), tr('Süper!'), tr('Çok iyi!'), tr('Hazırsın!')];
  function showTutorialWin() {
    const last = S.tut === TUTORIAL.length - 1;
    $('win').querySelector('.card').classList.add('tut');
    $('win').querySelector('.card').classList.remove('perfect');
    $('winLevel').textContent = tr('Deneme {n} / {all}', { n: S.tut + 1, all: TUTORIAL.length });
    $('winTitle').textContent = TUT_PRAISE[S.tut] || tr('Harika!');
    $('winNote').textContent = last ? tr('Artık gerçek seviyelere hazırsın.') : tr('Bir sonraki denemeye geç.');
    $('winRewards').innerHTML = '';
    $('continue').textContent = last ? tr('Oyuna başla') : tr('Devam');
    $('win').classList.remove('hidden');
    Sound.win();
    launchConfetti(last ? 3 : 1);
    updateHud();
  }

  // Hamle bitti: oyuncu ya altınla 3 hamle daha alır ya da baştan başlar
  function showFail() {
    S.failed = true;
    failedLevel = S.levelNo;
    S.hint = null;
    closeHintMenu();
    const left = S.L.rings.filter((r, i) => present(i) && r.kind !== 'bar' && !r.fixed).length;
    const can = progress.coins >= EXTRA_PRICE;
    $('failNote').textContent = left === 1 ? tr('Tek halka kaldı!') : tr('{n} halka kaldı.', { n: left });
    $('extraPrice').textContent = EXTRA_PRICE;
    $('extraMoves').disabled = !can;
    $('extraNote').hidden = can;
    $('extraNote').textContent = tr('{n} altın daha gerekir (sende {have}).', { n: EXTRA_PRICE - progress.coins, have: progress.coins });
    // Ek hamle alınamıyorsa öne çıkan düğme "Baştan başla" olur
    $('failRetry').className = can ? 'btn-ghost' : 'btn-primary';
    $('fail').classList.remove('hidden');
    Sound.fail();
    if (navigator.vibrate) { try { navigator.vibrate([30, 60, 30]); } catch (e) { /* yok say */ } }
    updateHud();
  }

  function buyExtraMoves() {
    if (!S.failed || progress.coins < EXTRA_PRICE) { Sound.deny(); return; }
    progress.coins -= EXTRA_PRICE;
    stat('extraMoves');
    saveProgress();
    S.limit += EXTRA_MOVES;
    S.extra++;
    S.failed = false;
    S.help.lastAct = performance.now();
    $('fail').classList.add('hidden');
    Sound.coin();
    renderMeter(false);
    updateHud();
    const el = $('movesNum');
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    const pill = $('coinPill');
    pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
    showTip(tr('+{n} hamle. Bu bölüm en fazla 1 yıldız verir', { n: EXTRA_MOVES }), 3000);
  }

  // Skor sayacı yukarı doğru sayar
  let shownScore = 0;
  function countScore(from, to) {
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / 900);
      shownScore = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      $('scoreNum').textContent = fmt(shownScore);
      if (t < 1) requestAnimationFrame(step);
      else { const el = $('scorePill'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    };
    requestAnimationFrame(step);
  }

  // Zafer kutlaması: mağazadan seçilen gösteri (konfeti, havai fişek, altın yağmuru)
  function launchConfetti(stars, id = equipped('win')) {
    if (REDUCED) return;
    const w = $('app').clientWidth;
    if (id === 'win-fireworks') {
      const shells = 2 + stars;
      for (let s = 0; s < shells; s++) {
        setTimeout(() => {
          const x = w * (0.2 + Math.random() * 0.6), y = 110 + Math.random() * 160;
          const color = COLORS[(s * 3) % COLORS.length];
          Sound.tick();
          for (let k = 0; k < 46; k++) {
            const a = (k / 46) * TAU, sp = 2.2 + Math.random() * 2.2;
            confetti.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.05, drag: 0.97,
              rot: 0, vr: 0, w: 2.6, h: 2.6, color: k % 4 ? color : '#fff6c4', life: 1, fade: 0.012 });
          }
        }, s * 320);
      }
      return;
    }
    if (id === 'win-goldrain') {
      const count = 14 + stars * 8;
      for (let k = 0; k < count; k++) {
        confetti.push({ kind: 'coin', x: Math.random() * w, y: -20 - Math.random() * 380, vx: (Math.random() - 0.5) * 1.2, vy: 2 + Math.random() * 2.5,
          g: 0.12, drag: 0.995, rot: Math.random() * TAU, vr: 0.08 + Math.random() * 0.1, w: 0, h: 0, color: '', life: 1, size: 6 + Math.random() * 3.5 });
      }
      return;
    }
    const count = 40 + stars * 30;
    for (let k = 0; k < count; k++) {
      confetti.push({
        x: w / 2 + (Math.random() - 0.5) * 60, y: 160,
        vx: (Math.random() - 0.5) * 12, vy: -6 - Math.random() * 9,
        rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.4,
        w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
        color: COLORS[k % COLORS.length], life: 1,
      });
    }
  }

  // ---- Dokunma ----
  function toBoard(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  }

  function hitRing(p) {
    let best = -1, bestD = 26;
    S.L.rings.forEach((r, i) => {
      if (!present(i)) return;
      const d = r.kind !== 'ring' ? pieceDist(p.x, p.y, r) + 4 : Math.abs(Math.hypot(p.x - r.x, p.y - r.y) - r.r);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  canvas.addEventListener('pointerdown', e => {
    if (S.won || S.failed || S.auto || S.kicks.length) return;
    closeHintMenu();
    S.help.lastAct = performance.now();
    const p = toBoard(e);
    if (S.swPos && Math.abs(p.x - S.swPos.x) < SWITCH_W / 2 + 8 && Math.abs(p.y - S.swPos.y) < SWITCH_H / 2 + 8) { flipSwitch(); return; }
    const i = hitRing(p);
    if (i < 0) return;
    if (!canRotate(S.L, i, S.mask, S.left, S.sw)) {
      for (const k of S.L.group[i]) S.shake[k] = performance.now();
      Sound.deny();
      if (isBar(i)) showTip(tr('Çubuk dönmez: halkaların boşluğunu çubuğa getir'));
      else if (isFrame(i)) showTip(tr('Çerçeve yerinden oynamaz: halkaları etrafından kurtar'));
      else if (S.L.rings[i].lockedBy >= 0) {
        // Anahtarlı halka: anahtarın durduğu halka kısa bir süre parlar
        S.keyPulse = { ring: S.L.rings[i].lockedBy, t0: performance.now() };
        showTip(tr('Kilitli: önce anahtarlı halkayı kurtar'));
      } else if (S.L.rings[i].side >= 0 && S.L.rings[i].side !== S.sw) {
        S.swPulse = performance.now();
        showTip(tr('Bu renk kapalı: şalteri çevir'));
      } else if (S.left[i] === 0) {
        // Jetonsuz halka: ona jeton taşıyan ilk halka kısa bir süre parlar
        const carrier = S.L.rings.findIndex((r, k) => r.token === i && present(k));
        if (carrier >= 0) S.keyPulse = { ring: carrier, t0: performance.now() };
        showTip(tr('Jeton yok: önce jeton taşıyan halkayı kurtar'));
      }
      return;
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sentetik olay */ }
    const r = S.L.rings[i];
    S.drag = {
      ring: i,
      lastAng: Math.atan2(p.y - r.y, p.x - r.x),
      total: 0,
      notch: 0,
      applied: 0, // tıklı halkada uygulanan dönüş (adımın katı)
      before: snapshot(),
    };
    if (S.hint && S.L.group[i].includes(S.hint.ring)) S.hint = null;
  });

  canvas.addEventListener('pointermove', e => {
    if (!S.drag) return;
    const p = toBoard(e);
    const r = S.L.rings[S.drag.ring];
    const ang = Math.atan2(p.y - r.y, p.x - r.x);
    const d = signedDelta(S.drag.lastAng, ang);
    S.drag.lastAng = ang;
    S.drag.total += d;
    if (r.step) {
      // Tıklı halka parmağı serbestçe izlemez: en yakın tık yerine atlar
      const want = Math.round(S.drag.total / r.step) * r.step;
      if (want !== S.drag.applied) {
        S.angles = rotate(S.L, S.angles, S.drag.ring, want - S.drag.applied);
        S.drag.applied = want;
        S.tickPop = { ring: S.drag.ring, t0: performance.now() };
        Sound.clack();
      }
      return;
    }
    S.angles = rotate(S.L, S.angles, S.drag.ring, d);
    // her 15 derecede bir hafif "tık" sesi
    const notch = Math.round(S.drag.total / (15 * DEG));
    if (notch !== S.drag.notch) { S.drag.notch = notch; Sound.tick(); }
  });

  function endDrag() {
    if (!S.drag) return;
    const drag = S.drag;
    S.drag = null;
    const stepped = S.L.rings[drag.ring].step;
    if (stepped ? !drag.applied : Math.abs(drag.total) < 3 * DEG) { S.angles = drag.before.angles; return; }
    commitMove(drag.before, drag.ring);
  }

  const snapshot = () => ({ angles: S.angles.slice(), mask: S.mask, moves: S.moves, taken: S.coins.map(c => c.taken) });

  // Bir hamle tamamlandı (elle ya da "Hamleyi yap" ile)
  function commitMove(before, ring) {
    S.moves++;
    S.left = spend(S.L, S.left, ring);
    // Her hamle nabız kapaklarını çevirir (serbest kalma kapakların yeni haline göre)
    if (S.L.hasPulse) { S.ph ^= 1; S.phT0 = performance.now(); Sound.lamp(S.ph); }
    S.help.lastAct = performance.now();
    const el = $('movesNum');
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    renderMeter(false);
    settle();
    if (S.mask !== before.mask) $('hint').classList.remove('pulse');
    if (S.tut != null) guide();
    else if (!S.won && S.moves >= S.limit) showFail();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ---- Düğmeler ----
  $('playBtn').onclick = () => { Sound.tap(); loadLevel(frontier()); showScreen('game'); };
  $('levelsBtn').onclick = () => { Sound.tap(); showScreen('levels'); };
  $('levelsBack').onclick = () => { Sound.tap(); showScreen('home'); };
  $('menuBtn').onclick = () => { Sound.tap(); showScreen('levels'); };

  // ---- Ayarlar ----
  const toggles = [...document.querySelectorAll('#settings .toggle')];
  const langBtns = [...document.querySelectorAll('#settings [data-lang]')];
  function renderSettings() {
    for (const b of toggles) b.setAttribute('aria-checked', String(progress[b.dataset.key] !== false));
    for (const b of langBtns) b.setAttribute('aria-checked', String(b.dataset.lang === I18N.lang));
  }
  if (REDUCED) toggles.find(b => b.dataset.key === 'effects').querySelector('small').textContent = tr('Cihazda hareketi azaltma açık, efektler kapalı');
  // Dil seçilince kaydedilir ve oyun yeni dille baştan açılır (bütün ekranlar o dilde kurulur)
  for (const b of langBtns) {
    b.onclick = () => {
      if (b.dataset.lang === I18N.lang) return;
      Sound.tap();
      progress.lang = b.dataset.lang;
      saveProgress();
      location.reload();
    };
  }
  for (const b of toggles) {
    b.onclick = () => {
      const key = b.dataset.key;
      progress[key] = progress[key] === false;
      saveProgress();
      renderSettings();
      if (key === 'ambient') syncAmbience();
      Sound.tap();
    };
  }
  $('settingsBtn').onclick = $('homeSettings').onclick = () => {
    Sound.tap();
    renderSettings();
    $('settings').classList.remove('hidden');
  };
  $('settingsClose').onclick = () => { Sound.tap(); $('settings').classList.add('hidden'); };
  const restart = () => (S.tut != null ? loadTutorial(S.tut) : S.preview ? loadPreview(S.preview) : loadLevel(S.levelNo));
  $('reset').onclick = () => { Sound.tap(); restart(); };
  $('again').onclick = () => { Sound.tap(); restart(); };
  $('failRetry').onclick = () => { Sound.tap(); restart(); };
  $('extraMoves').onclick = buyExtraMoves;
  $('howBtn').onclick = () => { Sound.tap(); loadTutorial(0); showScreen('game'); };
  $('coachSkip').onclick = () => { Sound.tap(); finishTutorial(); };
  function finishTutorial() {
    const firstTime = !progress.tutorialDone;
    progress.tutorialDone = true;
    saveProgress();
    if (firstTime) { loadLevel(frontier()); showScreen('game'); }
    else { $('win').classList.add('hidden'); showScreen('home'); }
  }

  $('continue').onclick = () => {
    Sound.tap();
    if (S.tut != null) {
      if (S.tut < TUTORIAL.length - 1) loadTutorial(S.tut + 1);
      else finishTutorial();
      return;
    }
    if (S.preview) { $('win').classList.add('hidden'); showScreen('home'); return; }
    // Son bölüm ilk kez bitince: Büyük Makine kapanışı, sonra harita
    if (S.levelNo === TOTAL && !progress.rewards.ending) { $('win').classList.add('hidden'); showEnding(); return; }
    // Kapının finalinden sonra haritaya dönülür: orada yeni kapı açılır
    if (W.posInGate(S.levelNo) !== W.GATE_SIZE && S.levelNo < TOTAL && isUnlocked(S.levelNo + 1)) loadLevel(S.levelNo + 1);
    else { $('win').classList.add('hidden'); showScreen('levels'); }
  };
  // ---- Büyük Makine: yolculuğun kapanışı ----
  // Oyunun halka renklerindeki 8 halka (bir dünyaya bir halka) dört bir yandan uçup altın merkez halkanın
  // çevresinde makineyi kurar, makine dişliler gibi döner, kıvılcımlar saçılır; ardından yolculuğun özeti gelir.
  const END_RINGS = COLORS.slice(0, LIVE_WORLDS.length);
  let endingRun = null;
  function showEnding(replay) {
    if (!replay) {
      progress.rewards.ending = today();
      saveProgress();
    }
    const el = $('ending');
    el.className = 'ending';
    el.hidden = false;
    const shapes = shapeLevels();
    const earned = Object.keys(progress.badges).length;
    const perfect = Object.values(progress.stars).filter(v => v === 3).length;
    $('endingStats').innerHTML = [
      [`${totalStars()}`, tr('/ {n} yıldız', { n: TOTAL * 3 })],
      [`${earned}`, tr('/ {n} rozet', { n: B.BADGES.length })],
      [`${shapes.filter(n => starsOf(n)).length}`, tr('/ {n} şekil', { n: shapes.length })],
      [fmt(progress.stats.coinsTotal || 0), tr('altın')],
    ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
    const missing = TOTAL - perfect;
    $('endingMore').textContent = missing > 0 ? tr('{n} bölüm hâlâ 3 yıldızı bekliyor. Altın kapılar seni bekliyor.', { n: missing }) : tr('Bütün bölümler 3 yıldız. Sen gerçek bir Halka Ustasısın.');
    const quick = REDUCED || !fxOn();
    const t0 = performance.now();
    endingRun = { t0, sparks: [] };
    setTimeout(() => el.classList.add('show-title'), quick ? 0 : 2500);
    setTimeout(() => el.classList.add('show-stats'), quick ? 0 : 3300);
    setTimeout(() => el.classList.add('show-go'), quick ? 0 : 3900);
    Sound.gate();
    setTimeout(() => { Sound.win(); launchConfetti(3); }, quick ? 0 : 2400);
    requestAnimationFrame(drawEnding);
    $('endingGo').onclick = () => {
      Sound.tap();
      el.hidden = true;
      endingRun = null;
      showScreen('levels');
    };
  }

  function drawEnding(now) {
    const run = endingRun;
    if (!run) return;
    requestAnimationFrame(drawEnding);
    const c = $('endingFx'), g = c.getContext('2d');
    const w = c.clientWidth, h = c.clientHeight, dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const quick = REDUCED || !fxOn();
    const t = quick ? 99 : (now - run.t0) / 1000;
    const cx = w / 2, cy = h * 0.34, R = Math.min(w * 0.33, 130), r = R * 0.36;
    const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    // Arkada dönen ışık hüzmeleri (makine çalışınca)
    const run2 = ease((t - 1.8) / 0.8);
    if (run2 > 0) {
      g.save(); g.translate(cx, cy); g.rotate(t * 0.15);
      for (let k = 0; k < 12; k++) {
        g.rotate(Math.PI / 6);
        const grd = g.createLinearGradient(0, 0, R * 2.4, 0);
        grd.addColorStop(0, `rgba(255, 211, 107, ${0.16 * run2})`); grd.addColorStop(1, 'rgba(255, 211, 107, 0)');
        g.fillStyle = grd;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(R * 2.4, -R * 0.18); g.lineTo(R * 2.4, R * 0.18); g.closePath(); g.fill();
      }
      g.restore();
    }
    const ring = (x, y, rad, color, angle, width, alpha) => {
      g.save(); g.globalAlpha = alpha; g.lineCap = 'round';
      for (const [col, lw, dx, dy] of [['rgba(0,0,0,.4)', width + 6, 2, 4], [color, width, 0, 0], ['rgba(255,255,255,.3)', 3, -2, -2]]) {
        g.strokeStyle = col; g.lineWidth = lw;
        g.beginPath(); g.arc(x + dx, y + dy, rad, angle + 0.45, angle + Math.PI * 2 - 0.45); g.stroke();
      }
      // dişli tıkları
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (let k = 0; k < 8; k++) {
        const a = angle + k * Math.PI / 4 + Math.PI / 8;
        g.beginPath(); g.arc(x + Math.cos(a) * (rad + width), y + Math.sin(a) * (rad + width), 2.2, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    };
    // 8 dünya halkası: dört bir yandan uçup yerine oturur, sonra dişli gibi zıt yönlerde döner
    END_RINGS.forEach((col, k) => {
      const a = -Math.PI / 2 + k * Math.PI / 4;
      const tx = cx + Math.cos(a) * R, ty = cy + Math.sin(a) * R;
      const fx = cx + Math.cos(a) * Math.max(w, h), fy = cy + Math.sin(a) * Math.max(w, h);
      const p = ease((t - k * 0.14) / 0.9);
      const x = fx + (tx - fx) * p, y = fy + (ty - fy) * p;
      const spin = run2 * (t - 1.8) * (k % 2 ? -1.6 : 1.6);
      ring(x, y, r, col, a + spin, 9, Math.min(1, p * 1.5));
    });
    // Altın merkez halka: halkalar yerleşince belirir, sonra hepsini döndürür
    const core = ease((t - 1.4) / 0.6);
    if (core > 0) ring(cx, cy, R * 0.62 * (0.6 + 0.4 * core), '#ffd36b', -run2 * (t - 1.8) * 0.8, 13, core);
    // Kıvılcımlar
    if (run2 > 0 && !quick && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2;
      run.sparks.push({ x: cx + Math.cos(a) * R * 0.62, y: cy + Math.sin(a) * R * 0.62, vx: Math.cos(a) * (1 + Math.random() * 2.5), vy: Math.sin(a) * (1 + Math.random() * 2.5), life: 1 });
    }
    run.sparks = run.sparks.filter(s => (s.life -= 0.02) > 0);
    for (const s of run.sparks) {
      s.x += s.vx; s.y += s.vy; s.vy += 0.03;
      g.globalAlpha = s.life; g.fillStyle = s.life > 0.5 ? '#fff3b0' : '#ffb347';
      g.beginPath(); g.arc(s.x, s.y, 2, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }

  // ---- İpucu: ampul sayacı ve kademeli ipucu ----
  // Dürtme her zaman ücretsiz; İpucu ve Hamleyi yap birer ampul. 1. kapıda ve denemelerde hepsi ücretsiz.
  const hintsFree = () => S.tut != null || S.preview != null || W.gateOf(S.levelNo) === 1;

  function renderHintCount() {
    const el = $('hintCount');
    const free = hintsFree();
    const shown = progress.hints - bulbsInAir;
    el.textContent = free ? '∞' : shown;
    el.classList.toggle('empty', !free && shown <= 0);
    $('hint').setAttribute('aria-label', free ? tr('İpucu (ücretsiz)') : tr('İpucu ({n} ampul)', { n: shown }));
  }

  // İpucunun önerdiği hamle: en kısa yolu arayan yavaş arama, olmazsa hızlı arama.
  // Sonuç tahtanın durumuna göre saklanır; menü açılınca arka planda hazırlanır.
  let hintCache = null; // { key, sol }
  const boardKey = () => S.mask + ':' + S.angles.map(a => a.toFixed(4)).join(',') + ':' + S.left.join(',') + ':' + S.sw + S.ph;
  function bestMove() {
    const key = boardKey();
    if (hintCache && hintCache.key === key) return hintCache.sol;
    // 2000 düğüm: denge testinde (tools/balance.js) 40000 ile aynı sonuç, en yavaş adım ~0,2 sn
    const sol = solveFast(S.L, S.angles, S.mask, 2000, 0.8, S.left, S.sw, S.ph) || solveFast(S.L, S.angles, S.mask, 30000, undefined, S.left, S.sw, S.ph);
    hintCache = { key, sol };
    return sol;
  }

  function openHintMenu() {
    setTimeout(() => { if (!$('hintMenu').hidden && !S.won && !S.failed) bestMove(); }, 60);
    const free = hintsFree();
    for (const b of $('hintMenu').querySelectorAll('.hint-opt')) {
      if (b.dataset.tier === 'nudge') continue;
      const cost = b.querySelector('.cost');
      cost.innerHTML = free ? tr('Ücretsiz') : '<i class="bulb-ico"></i>1';
      cost.classList.toggle('free', free);
      b.classList.toggle('locked', !free && progress.hints <= 0);
    }
    $('hintBank').innerHTML = free ? tr('Bu kapıda bütün ipuçları ücretsiz.')
      : progress.hints > 0 ? `${tr('Ampulün')}: <b>${progress.hints}</b>` : tr('Ampulün kalmadı. Dürtme her zaman ücretsiz.');
    renderBuy();
    $('hintMenu').hidden = false;
  }

  // ---- Ampul kazanma: altınla alma, günlük hediye, ödül uçuşu ----
  function renderBuy() {
    const free = hintsFree();
    const btn = $('buyBulb');
    btn.hidden = free;
    const have = progress.coins;
    btn.disabled = have < BULB_PRICE;
    btn.querySelector('.cost').innerHTML = `<i class="coin-ico"></i>${BULB_PRICE}`;
    $('buyNote').textContent = have >= BULB_PRICE ? tr('Altının: {n}', { n: have }) : tr('{n} altın daha topla (sende {have})', { n: BULB_PRICE - have, have });
  }

  function buyBulb() {
    if (progress.coins < BULB_PRICE) { Sound.deny(); return; }
    progress.coins -= BULB_PRICE;
    progress.hints++;
    progress.bulbsBought = (progress.bulbsBought || 0) + 1;
    saveProgress();
    awardBadges(false);
    Sound.coin();
    const r = $('buyBulb').getBoundingClientRect(), ar = $('app').getBoundingClientRect();
    bulbsInAir++;
    flyBulbs(1, r.left - ar.left + r.width - 40, r.top - ar.top + r.height / 2);
    openHintMenu();
    updateHud();
    const pill = $('coinPill');
    pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
  }
  $('buyBulb').onclick = buyBulb;

  // Günlük hediye: ampulü hiç kalmayan oyuncuya günde bir ampul. Verildiyse true.
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function dailyGift() {
    if (hintsFree() || progress.hints > 0 || progress.hintGiftDay === today()) return false;
    progress.hintGiftDay = today();
    progress.hints += ECO.dailyBulbs;
    saveProgress();
    bulbsInAir += ECO.dailyBulbs;
    showTip(tr('Günün hediyesi: {n} ampul', { n: ECO.dailyBulbs }), 3500);
    setTimeout(() => {
      const ar = $('app').getBoundingClientRect(), sr = $('stage').getBoundingClientRect();
      flyBulbs(ECO.dailyBulbs, sr.left - ar.left + sr.width / 2, sr.top - ar.top + sr.height / 2, true);
    }, 500);
    return true;
  }

  // n ampul (x, y)'den ipucu düğmesine uçar; konan her ampul rozeti bir artırır
  function flyBulbs(n, x, y, big) {
    const now = performance.now();
    for (let k = 0; k < n; k++) {
      bulbFly.push({ x: x + (k - (n - 1) / 2) * 26, y, t0: now + k * 180, big: !!big, landed: false });
    }
    if (big) Sound.gift();
  }
  // Uçuş yarıda kalırsa (bölüm değişti) ampuller hemen sayılır
  function landBulbs() {
    bulbFly = [];
    bulbsInAir = 0;
  }

  function hintTarget() {
    const r = $('hintCount').getBoundingClientRect(), ar = $('app').getBoundingClientRect();
    return { x: r.left - ar.left + r.width / 2, y: r.top - ar.top + r.height / 2 };
  }

  function drawBulb(g, x, y, r, glow) {
    g.save();
    const grd = g.createRadialGradient(x, y, 0, x, y, r * 2.6);
    grd.addColorStop(0, `rgba(255, 220, 120, ${0.55 * glow})`);
    grd.addColorStop(1, 'rgba(255, 220, 120, 0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r * 2.6, 0, TAU); g.fill();
    const body = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    body.addColorStop(0, '#fff6c4');
    body.addColorStop(0.6, '#ffc94a');
    body.addColorStop(1, '#c9851a');
    g.fillStyle = body;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.restore();
  }

  function drawBulbFly(now) {
    if (!bulbFly.length) return;
    const tgt = hintTarget();
    for (const f of bulbFly) {
      const t = (now - f.t0) / BULB_MS;
      if (t < 0) { drawBulb(fctx, f.x, f.y, f.big ? 13 : 10, 1); continue; }
      if (t >= 1) {
        if (!f.landed) {
          f.landed = true;
          bulbsInAir = Math.max(0, bulbsInAir - 1);
          renderHintCount();
          $('homeBulbs').textContent = progress.hints - bulbsInAir;
          const el = $('hintCount');
          el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
          Sound.bulb();
        }
        continue;
      }
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = f.x + (tgt.x - f.x) * e;
      const y = f.y + (tgt.y - f.y) * e - Math.sin(Math.PI * e) * 90;
      drawBulb(fctx, x, y, (f.big ? 13 : 10) * (1 - 0.35 * e), 1 - 0.4 * e);
    }
    bulbFly = bulbFly.filter(f => !f.landed);
  }
  function closeHintMenu() { $('hintMenu').hidden = true; }

  function useHint(tier) {
    if (S.won || S.failed || S.auto || S.kicks.length) return;
    const cost = tier === 'nudge' || hintsFree() ? 0 : 1;
    if (cost > progress.hints) { Sound.deny(); showTip(tr('Ampulün kalmadı. Ücretsiz dürtmeyi dene')); return; }
    closeHintMenu();
    const sol = bestMove();
    // Çözüm bulunamazsa ampul harcanmaz
    if (!sol || !sol.first) { showTip(tr('İpucu bulunamadı, yeniden başlatmayı dene')); return; }
    if (cost) {
      progress.hints -= cost;
      saveProgress();
      const el = $('hintCount');
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
    $('hint').classList.remove('pulse');
    S.help.lastAct = performance.now();
    S.usedHint = true;
    // Önizleme (kapıya yerleşmemiş tanıtım) sayaçlara ve rozetlere dokunmaz
    if (!S.preview) {
      stat('hintsUsed');
      saveProgress();
      awardBadges(false);
    }
    Sound.tap();
    const now = performance.now();
    if (sol.first.toggle) {
      // Sıradaki hamle şalter: dürtme ve ipucu şalteri gösterir, "Hamleyi yap" çevirir
      if (tier === 'move') { S.hint = null; hideTip(); flipSwitch(); } else { S.hint = { toggle: true, ring: -1, t0: now }; showTip(tr('Şalteri çevir')); }
    } else if (tier === 'nudge') {
      S.hint = { ...sol.first, t0: now, nudge: true };
      showTip(tr('Parlayan halkayı çevir'));
    } else if (tier === 'hint') {
      S.hint = { ...sol.first, t0: now };
      showTip(tr('Parlayan halkanın boşluğunu sarı halkaya getir'));
    } else {
      S.hint = null;
      hideTip();
      S.auto = { ...sol.first, done: 0, notch: 0, t0: now, before: snapshot(),
                 ms: 300 + Math.abs(sol.first.delta) / DEG * 2.5 };
    }
    updateHud();
  }

  $('hint').onclick = () => {
    if (S.won || S.failed || S.auto || S.kicks.length) return;
    if (S.tut != null) { guide(); return; }
    Sound.tap();
    if ($('hintMenu').hidden) openHintMenu(); else closeHintMenu();
  };
  for (const b of $('hintMenu').querySelectorAll('.hint-opt')) b.onclick = () => useHint(b.dataset.tier);
  // Menünün dışına dokununca kapanır
  document.addEventListener('pointerdown', e => {
    if (!$('hintMenu').hidden && !e.target.closest('#hintMenu, #hint')) closeHintMenu();
  }, true);

  // "Hamleyi yap": halka doğru açıya kendiliğinden döner, sonra normal bir hamle gibi sayılır
  function stepAuto(now) {
    const a = S.auto;
    if (!a) return;
    const t = Math.min(1, (now - a.t0) / a.ms);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const d = a.delta * e - a.done;
    S.angles = rotate(S.L, S.angles, a.ring, d);
    a.done += d;
    const unit = S.L.rings[a.ring].step || 15 * DEG;
    const notch = Math.round(a.done / unit);
    if (notch !== a.notch) { a.notch = notch; S.L.rings[a.ring].step ? Sound.clack() : Sound.tick(); }
    if (t >= 1) { S.auto = null; commitMove(a.before, a.ring); }
  }

  // Yay tekmesi: hedef halka (ve eşleri) çeyrek tur döner, sonunda hafif geri yaylanır.
  // Dönüş adım adım uygulanır; hepsi bitince açılar mantıktaki son hale eşitlenir.
  const easeBack = t => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
  function stepKicks(now) {
    if (!S.kicks.length) return;
    for (const k of S.kicks) {
      const t = Math.min(1, (now - k.t0) / KICK_MS);
      if (t < 0) continue;
      const d = k.delta * (t >= 1 ? 1 : easeBack(t)) - k.done;
      S.angles = rotate(S.L, S.angles, k.ring, d);
      k.done += d;
      k.over = t >= 1;
    }
    S.kicks = S.kicks.filter(k => !k.over);
    if (!S.kicks.length && S.kickEnd) { S.angles = S.kickEnd; S.kickEnd = null; }
  }

  // Tekmenin değdiği yerde yayın renginde küçük kıvılcımlar
  function kickSpark(from, target) {
    if (REDUCED) return;
    const s = S.L.rings[from], t = S.L.rings[target];
    const th = Math.atan2(s.y - t.y, s.x - t.x);
    const x = t.x + Math.cos(th) * t.r, y = t.y + Math.sin(th) * t.r;
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * TAU, sp = 1.5 + Math.random() * 2.5;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, size: 2 + Math.random() * 2, color: ringColor(from) });
    }
  }

  // ---- Yaylı halka çizimi (2.4) ----
  // Rozet: yaylı halkanın en boş yerinde, içinde dik bir yay olan madalyon (yaylı olduğunu söyler).
  // Sarmal yay: yayın hedefe değdiği kesişimden başlar, hedefin kenarı boyunca tekme yönüne uzanır, ucu ok.
  // Boş daire: tekmeden sonra hedefin boşluğunun geleceği yer.
  const springLive = i => present(i) && !S.fly[i];
  function springBadgeAt(s) {
    const r = S.L.rings[s];
    const key = s + ':' + S.mask + ':' + Math.round(S.angles[s] / (10 * DEG));
    if (S.springSpot[key] != null) return S.springSpot[key];
    let best = 0, bestD = -1;
    for (let k = 0; k < 36; k++) {
      const th = k * 10 * DEG, x = r.x + Math.cos(th) * r.r, y = r.y + Math.sin(th) * r.r;
      let d = Infinity;
      S.L.rings.forEach((o, i) => {
        if (i === s || !present(i) || o.kind !== 'ring') return;
        d = Math.min(d, Math.abs(Math.hypot(x - o.x, y - o.y) - o.r));
      });
      for (const g of r.gaps) d = Math.min(d, angDist(S.angles[s] + g, th) * r.r);
      if (y < 18 || y > BOARD.h - 18 || x < 18 || x > BOARD.w - 18) d = -1;
      if (d > bestD) { bestD = d; best = th; }
    }
    return (S.springSpot[key] = best);
  }

  function drawSpringBadge(s, now) {
    const r = S.L.rings[s], th = springBadgeAt(s);
    const x = r.x + Math.cos(th) * r.r, y = r.y + Math.sin(th) * r.r, color = ringColor(s);
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,20,.9)'; ctx.beginPath(); ctx.arc(x, y + 2, 17, 0, TAU); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 11.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const sq = REDUCED ? 1 : 1 + 0.08 * Math.sin(now / 200);
    ctx.beginPath();
    for (let k = 0; k <= 5; k++) {
      const yy = y + (-7 + k * 2.8) * sq, xx = x + (k % 2 ? 5 : -5);
      if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSpringCoil(s, now) {
    const sp = S.L.rings[s], t = S.L.rings[sp.kick.target], dir = Math.sign(sp.kick.turn), color = ringColor(s);
    const link = S.L.links.find(l => (l.a === s && l.b === t.id) || (l.b === s && l.a === t.id));
    let phi0 = 0;
    if (link) {
      // iki kesişimden, yayın dışına doğru uzananı seç
      for (const p of link.pts) {
        phi0 = link.a === t.id ? p.angA : p.angB;
        const probe = phi0 + dir * 25 * DEG;
        if (Math.hypot(t.x + Math.cos(probe) * t.r - sp.x, t.y + Math.sin(probe) * t.r - sp.y) > sp.r) break;
      }
    } else phi0 = Math.atan2(sp.y - t.y, sp.x - t.x);
    const span = (52 + (REDUCED ? 0 : 4 * Math.sin(now / 200))) * DEG;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, c] of [[7, 'rgba(10,8,20,.85)'], [3.5, color]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath();
      for (let k = 0; k <= 72; k++) {
        const u = k / 72, ph = phi0 + dir * (8 * DEG + u * span);
        const R = t.r + (u < 0.9 ? Math.sin(u / 0.9 * 6 * TAU) * 8 : 0);
        const x = t.x + Math.cos(ph) * R, y = t.y + Math.sin(ph) * R;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    const end = phi0 + dir * (8 * DEG + span), hx = t.x + Math.cos(end) * t.r, hy = t.y + Math.sin(end) * t.r;
    const tang = end + dir * Math.PI / 2;
    for (const [grow, c] of [[3, 'rgba(10,8,20,.85)'], [0, color]]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(tang) * (13 + grow), hy + Math.sin(tang) * (13 + grow));
      ctx.lineTo(hx + Math.cos(tang + 2.3) * (11 + grow), hy + Math.sin(tang + 2.3) * (11 + grow));
      ctx.lineTo(hx + Math.cos(tang - 2.3) * (11 + grow), hy + Math.sin(tang - 2.3) * (11 + grow));
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.9;
    for (const g of t.gaps) {
      const ga = S.angles[t.id] + g + sp.kick.turn;
      ctx.beginPath(); ctx.arc(t.x + Math.cos(ga) * t.r, t.y + Math.sin(ga) * t.r, 9, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Nabız halka (2.4) ----
  // Kapak kapalıyken boşluğu koyu gri bir kepenk doldurur (amber çizgili; halka renkleriyle karışmaz);
  // açıkken boşluğun iki ucunda lamba ışığı yanar. Her hamlede kapak ortadan açılır ya da kapanır.
  function drawPulseCover(i, cx, cy, now) {
    const ring = S.L.rings[i], open = ring.pulse === S.ph;
    const t = Math.min(1, (now - S.phT0) / PULSE_MS), e = 1 - Math.pow(1 - t, 3);
    const shut = open ? 1 - e : e; // 1 = kapak tam kapalı
    for (const g of ring.gaps) {
      const mid = S.angles[i] + g, half = (GAP_HALF - 2 * DEG) * shut;
      if (half > 0.01) {
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#141826'; ctx.lineWidth = STROKE + 3;
        ctx.beginPath(); ctx.arc(cx, cy, ring.r, mid - half, mid + half); ctx.stroke();
        ctx.strokeStyle = '#4a516e'; ctx.lineWidth = STROKE - 3;
        ctx.beginPath(); ctx.arc(cx, cy, ring.r, mid - half, mid + half); ctx.stroke();
        ctx.strokeStyle = LAMP; ctx.lineWidth = 2.2;
        for (let k = -2; k <= 2; k++) {
          const a = mid + k * half / 2.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * (ring.r - 4), cy + Math.sin(a) * (ring.r - 4));
          ctx.lineTo(cx + Math.cos(a) * (ring.r + 4), cy + Math.sin(a) * (ring.r + 4));
          ctx.stroke();
        }
        ctx.lineCap = 'round';
      }
      if (shut < 1) {
        // açık: boşluğun iki ucunda yanan lambalar
        const glow = (1 - shut) * (0.75 + 0.25 * Math.sin(now / 160));
        for (const s of [-1, 1]) {
          const a = mid + s * GAP_HALF, x = cx + Math.cos(a) * ring.r, y = cy + Math.sin(a) * ring.r;
          const gr = ctx.createRadialGradient(x, y, 0, x, y, 16);
          gr.addColorStop(0, `rgba(255,236,170,${0.95 * glow})`); gr.addColorStop(1, 'rgba(255,210,122,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill();
        }
      }
    }
    drawLampBadge(i, open, now);
  }

  // Fener rozeti: nabız halkanın en boş yerinde küçük bir lamba; açıkken ışınları yanar
  function drawLampBadge(i, open, now) {
    const p = tokenPos(i, 'lamp');
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,20,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y + 2, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = open ? LAMP : '#5d6488'; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, TAU); ctx.fill();
    ctx.fillStyle = open ? '#fff7dc' : '#2a2f48'; ctx.beginPath(); ctx.arc(p.x, p.y - 1, 5.5, 0, TAU); ctx.fill();
    ctx.fillStyle = open ? '#b0701a' : '#1a1e30'; ctx.fillRect(p.x - 4, p.y + 5, 8, 3.5);
    if (open) {
      ctx.strokeStyle = 'rgba(255,240,190,.9)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      const spin = REDUCED ? 0 : now / 900;
      for (let k = 0; k < 6; k++) {
        const a = spin + k * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16); ctx.lineTo(p.x + Math.cos(a) * 21, p.y + Math.sin(a) * 21);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- Şalter (2.4) ----
  // Şalter halkalardan uzak bir yere konur: önce tahtanın üst ortası (alttaki uyarı balonu örtmesin),
  // sonra alt ortası, sonra köşeler; yer yetecek kadar boşsa sıradaki aday denenmez.
  function switchSpot() {
    const spots = [[BOARD.w / 2, 30], [BOARD.w / 2, BOARD.h - 34], [70, 30], [BOARD.w - 70, 30], [70, BOARD.h - 34], [BOARD.w - 70, BOARD.h - 34]];
    let best = spots[0], bestD = -1;
    for (const [x, y] of spots) {
      let d = Infinity;
      for (const r of S.L.rings) {
        if (r.kind !== 'ring') continue;
        // kutunun halkaya en yakın noktası
        const qx = Math.max(x - SWITCH_W / 2, Math.min(r.x, x + SWITCH_W / 2)), qy = Math.max(y - SWITCH_H / 2, Math.min(r.y, y + SWITCH_H / 2));
        d = Math.min(d, Math.hypot(qx - r.x, qy - r.y) - r.r - STROKE);
      }
      if (d >= 24) return { x, y };
      if (d > bestD) { bestD = d; best = [x, y]; }
    }
    return { x: best[0], y: best[1] };
  }

  function flipSwitch() {
    if (S.won || S.failed || S.auto || S.kicks.length) return;
    const before = snapshot();
    S.sw ^= 1;
    S.swT0 = performance.now();
    S.hint = null;
    Sound.flip();
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* yok say */ } }
    commitMove(before, -1);
  }

  // Şalter: iki renkli kızak, beyaz topuz açık rengin üstünde, topuzda şimşek
  function drawSwitch(now) {
    if (!S.swPos) return;
    const { x, y } = S.swPos, w = SWITCH_W, h = SWITCH_H, r = h / 2;
    const t = Math.min(1, (now - S.swT0) / SWITCH_MS), e = 1 - Math.pow(1 - t, 3);
    const from = S.sw ? 0 : 1, pos = from + (S.sw - from) * e; // 0 sol (mavi), 1 sağ (turuncu)
    const pill = (ox, oy, ww, hh, rr) => {
      ctx.beginPath();
      ctx.moveTo(ox + rr, oy); ctx.lineTo(ox + ww - rr, oy); ctx.arc(ox + ww - rr, oy + rr, rr, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(ox + rr, oy + hh); ctx.arc(ox + rr, oy + rr, rr, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
    };
    ctx.save();
    pill(x - w / 2, y - h / 2 + 3, w, h, r); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
    pill(x - w / 2, y - h / 2, w, h, r);
    ctx.save(); ctx.clip();
    ctx.fillStyle = SIDE_COLORS[0]; ctx.globalAlpha = S.sw === 0 ? 1 : 0.35; ctx.fillRect(x - w / 2, y - h / 2, w / 2, h);
    ctx.fillStyle = SIDE_COLORS[1]; ctx.globalAlpha = S.sw === 1 ? 1 : 0.35; ctx.fillRect(x, y - h / 2, w / 2, h);
    ctx.restore();
    pill(x - w / 2, y - h / 2, w, h, r); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.5; ctx.stroke();
    const kx = x - w / 2 + r + pos * (w - h);
    ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(kx, y, r - 4, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    drawBolt(kx, y, 9, SIDE_COLORS[S.sw]);
    ctx.restore();
  }

  function drawBolt(x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 0.15 * s, y - s); ctx.lineTo(x - 0.55 * s, y + 0.15 * s); ctx.lineTo(x - 0.05 * s, y + 0.15 * s);
    ctx.lineTo(x - 0.2 * s, y + s); ctx.lineTo(x + 0.55 * s, y - 0.2 * s); ctx.lineTo(x + 0.05 * s, y - 0.2 * s);
    ctx.closePath(); ctx.fill();
  }

  function drawSwitchPulse(now, t0) {
    if (!S.swPos) return;
    const p = 0.5 + 0.5 * Math.sin((now - t0) / 200);
    ctx.save();
    ctx.strokeStyle = `rgba(255,201,74,${0.5 + 0.5 * p})`; ctx.lineWidth = 3;
    ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(S.swPos.x, S.swPos.y, SWITCH_W / 2 + 8 + 4 * p, SWITCH_H / 2 + 8 + 4 * p, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // ---- Jetonlu halka çizimi (2.4) ----
  // Jetonlu halkanın rozeti: pirinç oyun jetonu, içinde kalan jeton sayısı; jetonu yoksa sönük.
  // Jeton taşıyan halkada küçük bir jeton durur, kenarı gideceği halkanın renginde.
  function tokenSpot(i, kind) {
    const r = S.L.rings[i];
    const springAt = r.kick ? springBadgeAt(i) : null;
    const key = 't' + kind + i + ':' + S.mask + ':' + Math.round(S.angles[i] / (10 * DEG));
    if (S.springSpot[key] != null) return S.springSpot[key];
    let best = 0, bestD = -1;
    for (let k = 0; k < 36; k++) {
      const th = k * 10 * DEG, x = r.x + Math.cos(th) * r.r, y = r.y + Math.sin(th) * r.r;
      let d = Infinity;
      S.L.rings.forEach((o, j) => {
        if (j === i || !present(j) || o.kind !== 'ring') return;
        d = Math.min(d, Math.abs(Math.hypot(x - o.x, y - o.y) - o.r));
      });
      for (const g of r.gaps) d = Math.min(d, angDist(S.angles[i] + g, th) * r.r);
      if (springAt != null) d = Math.min(d, angDist(springAt, th) * r.r * 0.6);
      if (y < 18 || y > BOARD.h - 18 || x < 18 || x > BOARD.w - 18) d = -1;
      if (d > bestD) { bestD = d; best = th; }
    }
    return (S.springSpot[key] = best);
  }
  function tokenPos(i, kind) {
    const r = S.L.rings[i], th = tokenSpot(i, kind);
    return { x: r.x + Math.cos(th) * r.r, y: r.y + Math.sin(th) * r.r };
  }

  // Jeton: altıgen fiş (altın paralarla karışmasın diye yuvarlak değil), rengi gideceği halkanın rengi.
  // Jetonlu halkanın rozetinde kalan sayı yazar; taşınan jetonda küçük bir yıldız.
  function drawTokenCoin(x, y, R, color, label, dim) {
    const hex = rr => {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + k * Math.PI / 3;
        if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
    };
    ctx.save();
    ctx.globalAlpha *= dim ? 0.6 : 1;
    ctx.translate(0, 2); hex(R + 2); ctx.fillStyle = 'rgba(10,8,20,.9)'; ctx.fill(); ctx.translate(0, -2);
    hex(R); ctx.fillStyle = '#fff'; ctx.fill();
    hex(R - 2.6); ctx.fillStyle = dim ? '#5d6488' : color; ctx.fill();
    hex(R * 0.62); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = '#fff';
    if (label != null) {
      ctx.font = `900 ${Math.round(R * 1.05)}px Nunito, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,8,20,.55)';
      ctx.strokeText(String(label), x, y + 1); ctx.fillText(String(label), x, y + 1);
    } else {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R * 0.2 : R * 0.48;
        if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawTokens(now) {
    const arriving = {};
    S.tokenFly = S.tokenFly.filter(f => now < f.t0 + TOKEN_FLY_MS);
    for (const f of S.tokenFly) arriving[f.to] = (arriving[f.to] || 0) + 1;
    S.L.rings.forEach((r, i) => {
      if (r.kind !== 'ring' || !springLive(i)) return;
      if (r.tokens != null) {
        const p = tokenPos(i, 'bank'), shown = S.left[i] - (arriving[i] || 0);
        drawTokenCoin(p.x, p.y, 17, ringColor(i), shown, shown <= 0);
      }
      if (r.token >= 0 && present(r.token)) {
        const p = tokenPos(i, 'carry');
        drawTokenCoin(p.x, p.y, 12.5, ringColor(r.token), null, false);
      }
    });
    // Uçan jetonlar: taşıyan halkadan hedefin rozetine yay çizerek gider, dönerek küçülür
    for (const f of S.tokenFly) {
      const t = (now - f.t0) / TOKEN_FLY_MS;
      if (t < 0) { drawTokenCoin(f.from.x, f.from.y, 12.5, ringColor(f.to), null, false); continue; }
      const to = tokenPos(f.to, 'bank'), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = f.from.x + (to.x - f.from.x) * e, y = f.from.y + (to.y - f.from.y) * e - Math.sin(Math.PI * e) * 60;
      ctx.save();
      ctx.translate(x, y); ctx.scale(Math.abs(Math.cos(t * Math.PI * 3)) * 0.7 + 0.3, 1); ctx.translate(-x, -y);
      drawTokenCoin(x, y, 13 + 4 * Math.sin(Math.PI * t), ringColor(f.to), null, false);
      ctx.restore();
    }
  }

  function drawSprings(now) {
    S.L.rings.forEach((r, i) => {
      if (!r.kick || !springLive(i)) return;
      if (springLive(r.kick.target) && !S.kicks.length) drawSpringCoil(i, now);
      drawSpringBadge(i, now);
    });
  }

  // Akıllı yardım: en iyi hamle sayısı aşıldıysa ya da uzun süre hamle yoksa ipucu düğmesi nabız atar
  function checkHelp(now) {
    if (S.tut != null || S.won || S.failed || S.auto || S.kicks.length || S.hint || S.help.shown) return;
    if (!$('win').classList.contains('hidden') || !$('worldCard').classList.contains('hidden') || !$('settings').classList.contains('hidden')) {
      S.help.lastAct = now;
      return;
    }
    const stuck = S.moves > (S.def.par ?? 99) || now - S.help.lastAct > HELP_IDLE_MS;
    if (!stuck) return;
    S.help.shown = true;
    $('hint').classList.add('pulse');
    if (!progress.helpTip) {
      showTip(tr('Takıldıysan ipucuna dokun: dürtme ücretsiz'), 4000);
      progress.helpTip = true;
      saveProgress();
    }
  }

  // ---- Çizim ----
  function ringColor(i) {
    if (S.L.rings[i].kind !== 'ring') return BAR_COLOR;
    if (S.L.rings[i].fixed) return FIXED_COLOR;
    if (S.L.rings[i].side >= 0) return SIDE_COLORS[S.L.rings[i].side];
    return S.def.rings[i].color || COLORS[i % COLORS.length];
  }

  function gapList(ring, angle) {
    return ring.gaps.map(g => norm(angle + g)).sort((a, b) => a - b);
  }

  // Halkayı boşlukları hariç çizer
  function strokeRing(ring, angle, color, width, cx, cy) {
    const gaps = gapList(ring, angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    for (let k = 0; k < gaps.length; k++) {
      const from = gaps[k] + GAP_HALF;
      const to = (k + 1 < gaps.length ? gaps[k + 1] : gaps[0] + TAU) - GAP_HALF;
      if (to <= from) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, from, to);
      ctx.stroke();
    }
  }

  // Halkanın o anki konumu: uçuş, sallanma ve büyüme dahil
  function ringPose(i, now) {
    const ring = S.L.rings[i];
    let cx = ring.x, cy = ring.y, alpha = 1, grow = 1;
    const f = S.fly[i];
    if (f) {
      const t = Math.min(Math.max((now - f.t0) / FLY_MS, 0), 1);
      const e = t * t;
      cx += f.dx * 420 * e;
      cy += f.dy * 420 * e;
      alpha = 1 - t;
      grow = 1 + 0.15 * t;
    }
    const sh = S.shake[i];
    if (sh != null) {
      const t = (now - sh) / 350;
      if (t < 1) cx += Math.sin(t * 30) * 5 * (1 - t);
    }
    return { cx, cy, alpha, grow };
  }

  // Süs katmanı (yüzler vb.) halkalardan önce çizilir; halka uçarken onunla gider.
  // z değeri küçük olan önce çizilir (ör. gövde dolgusu en altta, gaga en üstte).
  function drawDeco(visible, now) {
    if (!S.def.deco) return;
    const items = S.def.deco.filter(d => visible[d.ring]).sort((a, b) => (a.z || 0) - (b.z || 0));
    for (const d of items) {
      const { cx, cy, alpha, grow } = ringPose(d.ring, now);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.scale(grow, grow);
      Deco.draw(ctx, d, S.L.rings[d.ring].r, now, ringColor(d.ring));
      ctx.restore();
    }
  }

  function strokeBar(b, ox, oy, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x1 + ox, b.y1 + oy); ctx.lineTo(b.x2 + ox, b.y2 + oy); ctx.stroke();
  }

  function drawBar(i, now) {
    const b = S.L.rings[i];
    const { cx, cy, alpha } = ringPose(i, now);
    const ox = cx - b.x, oy = cy - b.y;
    ctx.save();
    ctx.globalAlpha = alpha;
    strokeBar(b, ox + 2, oy + 4, 'rgba(0,0,0,.4)', STROKE + 6);
    strokeBar(b, ox, oy, BAR_COLOR, STROKE);
    strokeBar(b, ox - 1.5, oy - 1.5, 'rgba(255,255,255,.55)', 3);
    // uçlarda cıvata başlıkları
    for (const [x, y] of [[b.x1, b.y1], [b.x2, b.y2]]) {
      ctx.fillStyle = '#8d95ad';
      ctx.beginPath(); ctx.arc(x + ox, y + oy, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e3e7f1';
      ctx.beginPath(); ctx.arc(x + ox - 1, y + oy - 1, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawRing(i, now) {
    if (isBar(i)) { drawBar(i, now); return; }
    if (isFrame(i)) { drawFrame(i, now); return; }
    const ring = S.L.rings[i];
    const { cx, cy, alpha, grow } = ringPose(i, now);
    if (S.shake[i] != null && now - S.shake[i] >= 350) delete S.shake[i];
    ctx.save();
    ctx.globalAlpha = alpha * (ring.side >= 0 && ring.side !== S.sw ? 0.4 : 1);
    if (grow !== 1) { ctx.translate(cx, cy); ctx.scale(grow, grow); ctx.translate(-cx, -cy); }
    const color = ringColor(i);
    const mover = S.drag ? S.drag.ring : S.auto ? S.auto.ring : -1;
    const active = mover >= 0 && S.L.group[mover].includes(i);
    if (active) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
    }
    if (ring.step) drawStepDots(i, cx, cy, now);
    strokeRing(ring, S.angles[i], 'rgba(0,0,0,.4)', STROKE + 6, cx + 2, cy + 4);
    ctx.shadowBlur = 0;
    strokeRing(ring, S.angles[i], color, STROKE, cx, cy);
    strokeRing(ring, S.angles[i], 'rgba(255,255,255,.3)', 3, cx - 2, cy - 2);
    if (ring.pulse >= 0) drawPulseCover(i, cx, cy, now);
    if (ring.fixed) drawLock(cx, cy);
    if (ring.lockedBy >= 0) {
      const open = lockOpening(i, now);
      if (open < 1) drawPadlock(cx, cy, open);
    }
    if (present(i) && S.L.rings.some(r => r.lockedBy === i)) drawKeyIcon(cx, cy, 0, KEY_ICON);
    ctx.restore();
  }

  // Tıklı halka: boşluğun durabileceği yerler halkanın dışında küçük noktalar.
  // Boşluğun şu an durduğu nokta parlak; her tıkta kısa bir parıltı.
  function drawStepDots(i, cx, cy, now) {
    const ring = S.L.rings[i];
    const n = Math.round(TAU / ring.step);
    const base = S.L.startAngles[i];
    const rr = ring.r + STROKE / 2 + 8;
    const pop = S.tickPop && S.tickPop.ring === i ? Math.max(0, 1 - (now - S.tickPop.t0) / 220) : 0;
    ctx.save();
    for (const g of ring.gaps) {
      for (let k = 0; k < n; k++) {
        const a = base + g + k * ring.step;
        const here = angDist(a, S.angles[i] + g) < ring.step / 2;
        // Koyu kenar: nokta, zemindeki kadran dokusunda kaybolmasın
        ctx.fillStyle = here ? '#ffd36b' : 'rgba(255,255,255,.72)';
        ctx.strokeStyle = 'rgba(8, 10, 24, .7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, here ? 5.5 + 3 * pop : 3.8, 0, TAU);
        ctx.stroke();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Kilit durumu: 0 kapalı, 0-1 açılıyor, 1 açık (anahtar gelip kilit açıldı)
  function lockOpening(l, now) {
    const key = S.L.rings[l].lockedBy;
    if (!(S.mask & (1 << key))) return 0;
    const f = S.keyFly.find(k => k.lock === l);
    if (!f) return 1;
    const t = (now - f.t0 - KEY_MS) / OPEN_MS;
    return Math.max(0, Math.min(1, t));
  }

  // Asma kilit: altın gövde, anahtar deliği; açılırken halkası kalkar ve kilit söner
  function drawPadlock(x, y, open) {
    ctx.save();
    ctx.globalAlpha *= 1 - open;
    ctx.translate(x, y); ctx.scale(KEY_ICON, KEY_ICON); ctx.translate(-x, -y);
    const lift = 7 * open;
    ctx.strokeStyle = '#e8b13a';
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.arc(x, y - 6 - lift, 6.5, Math.PI, 0); ctx.lineTo(x + 6.5, y - 2 - lift); ctx.moveTo(x - 6.5, y - 6 - lift); ctx.lineTo(x - 6.5, y - 2); ctx.stroke();
    ctx.fillStyle = '#ffc94a';
    ctx.strokeStyle = 'rgba(40, 24, 0, .55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - 10, y - 4, 20, 15, 4); else ctx.rect(x - 10, y - 4, 20, 15);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a3a06';
    ctx.beginPath(); ctx.arc(x, y + 2, 2.4, 0, TAU); ctx.fill();
    ctx.fillRect(x - 1.1, y + 2, 2.2, 5);
    ctx.restore();
  }

  // Anahtar: altın baş (delikli halka) ve dişli sap
  function drawKeyIcon(x, y, rot, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(255, 201, 74, .7)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffc94a';
    ctx.beginPath(); ctx.arc(-7, 0, 7, 0, TAU); ctx.fill();
    ctx.fillRect(-1, -2.2, 15, 4.4);
    ctx.fillRect(9, 2, 2.6, 4.5);
    ctx.fillRect(13, 2, 2.6, 3.2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(40, 24, 0, .75)';
    ctx.beginPath(); ctx.arc(-7, 0, 2.6, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // Uçan anahtarlar (kurtulan halkadan kilide) ve kilidi gösterilen anahtar halkanın parıltısı
  function drawKeys(now) {
    S.keyFly = S.keyFly.filter(f => now < f.t0 + KEY_MS + OPEN_MS + 50);
    for (const f of S.keyFly) {
      const t = (now - f.t0) / KEY_MS;
      if (t < 0 || t > 1) continue;
      const a = S.L.rings[f.key], b = S.L.rings[f.lock];
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e - Math.sin(Math.PI * e) * 50;
      drawKeyIcon(x, y, e * TAU, KEY_ICON * (1 + 0.3 * Math.sin(Math.PI * e)));
    }
    const kp = S.keyPulse;
    if (kp && present(kp.ring)) {
      const t = (now - kp.t0) / 1200;
      if (t >= 1) S.keyPulse = null;
      else {
        const r = S.L.rings[kp.ring];
        ctx.save();
        ctx.strokeStyle = `rgba(255, 201, 74, ${0.6 * Math.sin(Math.PI * t)})`;
        ctx.lineWidth = STROKE + 10;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Çerçeve: çubukla aynı metal; köşelerde cıvata. Hiç oynamaz, dokununca yalnızca sallanır.
  function drawFrame(i, now) {
    const f = S.L.rings[i];
    const { cx } = ringPose(i, now);
    const ox = cx - f.x;
    const path = (dx, dy) => {
      ctx.beginPath();
      f.points.forEach((q, k) => (k ? ctx.lineTo(q.x + ox + dx, q.y + dy) : ctx.moveTo(q.x + ox + dx, q.y + dy)));
      ctx.closePath();
    };
    ctx.save();
    ctx.lineJoin = 'round';
    path(2, 4); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = STROKE + 6; ctx.stroke();
    path(0, 0); ctx.strokeStyle = BAR_COLOR; ctx.lineWidth = STROKE; ctx.stroke();
    path(-1.5, -1.5); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.stroke();
    for (const q of f.points) {
      ctx.fillStyle = '#8d95ad';
      ctx.beginPath(); ctx.arc(q.x + ox, q.y, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e3e7f1';
      ctx.beginPath(); ctx.arc(q.x + ox - 1, q.y - 1, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawLock(x, y) {
    ctx.fillStyle = FIXED_COLOR;
    ctx.strokeStyle = FIXED_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - 5, 6, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - 9, y - 5, 18, 14, 3); else ctx.rect(x - 9, y - 5, 18, 14);
    ctx.fill();
  }

  // Örgü görünümü: her kesişimde bir halka diğerinin üstünden geçer.
  // Alttaki halka o noktada silinir (şeffaf zemin), sonra üstteki parça çizilir.
  function drawWeave() {
    const seg = 13 * DEG;
    S.L.links.forEach(k => {
      if (!present(k.a) || !present(k.b)) return;
      k.pts.forEach((p, idx) => {
        const top = idx === 0 ? k.a : k.b;
        const ring = S.L.rings[top];
        const angP = idx === 0 ? p.angA : p.angB;
        const angle = S.angles[top];
        const straight = ring.kind !== 'ring'; // çubuk ya da çerçeve kenarı
        if (!straight && ring.gaps.some(g => angDist(angle + g, angP) < GAP_HALF + seg)) return;
        // üstteki parçanın kesişim çevresindeki küçük bölümü
        const piece = (s, ox = 0, oy = 0) => {
          ctx.beginPath();
          if (straight) {
            const { ux, uy } = barAxis(ring.kind === 'frame' ? k.seg : ring);
            const L = 17 * s;
            ctx.moveTo(p.x - ux * L + ox, p.y - uy * L + oy);
            ctx.lineTo(p.x + ux * L + ox, p.y + uy * L + oy);
          } else {
            ctx.arc(ring.x + ox, ring.y + oy, ring.r, angP - seg * s, angP + seg * s);
          }
          ctx.stroke();
        };
        ctx.save();
        ctx.lineCap = 'butt';
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = STROKE + 7;
        piece(0.75);
        ctx.restore();
        ctx.save();
        ctx.lineCap = 'butt';
        ctx.strokeStyle = ringColor(top);
        ctx.lineWidth = STROKE;
        piece(1);
        ctx.strokeStyle = straight ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.3)';
        ctx.lineWidth = 3;
        piece(1, straight ? -1.5 : -2, straight ? -1.5 : -2);
        ctx.restore();
      });
    });
  }

  // Açık bağlar: halkanın geçebileceği kesişimde parlayan nokta
  function drawOpenPoints(now) {
    const pulse = 0.6 + 0.4 * Math.sin(now / 180);
    S.L.links.forEach(k => {
      if (!present(k.a) || !present(k.b)) return;
      for (const p of k.pts) {
        if (!pointOpen(S.L, k, p, S.angles, S.ph)) continue;
        ctx.save();
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 14;
        ctx.fillStyle = `rgba(255,255,255,${0.9 * pulse})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, TAU); ctx.fill();
        ctx.restore();
      }
    });
  }

  // Eşli halkalar: merkezleri kesikli çizgiyle bağlı, merkezlerinde renkli nokta.
  // Ters dişlide çizginin ortasında zıt yönlü iki ok, hızlı dişlide hızlı halkanın üstünde "×2".
  function drawCouples() {
    const couples = S.L.couples.filter(c => present(c.a) && present(c.b));
    if (!couples.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = S.def.deco ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.35)';
    ctx.lineWidth = 3;
    for (const c of couples) {
      const a = S.L.rings[c.a], b = S.L.rings[c.b];
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const i of new Set(couples.flatMap(c => [c.a, c.b]))) {
      const r = S.L.rings[i];
      ctx.fillStyle = ringColor(i);
      ctx.beginPath(); ctx.arc(r.x, r.y, 7, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const c of couples) {
      if (c.ratio === 1) continue;
      const a = S.L.rings[c.a], b = S.L.rings[c.b];
      if (c.ratio === -1) drawReverseMark((a.x + b.x) / 2, (a.y + b.y) / 2);
      else {
        const fast = Math.abs(c.ratio) > 1 ? b : a;
        drawFastMark(fast.x, fast.y, Math.max(Math.abs(c.ratio), 1 / Math.abs(c.ratio)));
      }
    }
    ctx.restore();
  }

  // Ters dişli işareti: koyu yuvarlak üstünde zıt yönlü iki ok
  function drawReverseMark(x, y) {
    ctx.fillStyle = 'rgba(16, 20, 42, .92)';
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.2;
    const arrow = (x0, x1, yy) => {
      const d = Math.sign(x1 - x0);
      ctx.beginPath();
      ctx.moveTo(x0, yy); ctx.lineTo(x1, yy);
      ctx.moveTo(x1 - d * 3.5, yy - 3.5); ctx.lineTo(x1, yy); ctx.lineTo(x1 - d * 3.5, yy + 3.5);
      ctx.stroke();
    };
    arrow(x - 7, x + 7, y - 4);
    arrow(x + 7, x - 7, y + 4);
  }

  // Hızlı dişli işareti: halkanın merkezinin üstünde altın rengi "×2" etiketi
  function drawFastMark(x, y, k) {
    const w = 30, h = 19, top = y - 13 - h;
    ctx.fillStyle = '#ffc94a';
    ctx.strokeStyle = 'rgba(16, 20, 42, .9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, top, w, h, 9.5); else ctx.rect(x - w / 2, top, w, h);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b2600';
    ctx.font = '800 13px Nunito, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×' + k, x, top + h / 2 + 1);
  }


  // Denemede: parmak, halkayı tutup gösterilen yöne sürükler (döngü halinde)
  function drawFinger(now) {
    const h = S.hint;
    if (!h || !h.guide || h.toggle || !present(h.ring) || S.drag) return;
    const ring = S.L.rings[h.ring];
    const t = ((now - h.t0) % 1900) / 1900;
    const move = Math.min(1, Math.max(0, (t - 0.18) / 0.55));
    const e = move < 0.5 ? 2 * move * move : 1 - Math.pow(-2 * move + 2, 2) / 2;
    const a = S.angles[h.ring] + Math.PI + h.delta * e;
    const x = ring.x + Math.cos(a) * ring.r, y = ring.y + Math.sin(a) * ring.r;
    const alpha = t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1;
    const press = t > 0.12 && t < 0.78;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (press) {
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 22 + 6 * Math.sin(now / 120), 0, TAU); ctx.stroke();
    }
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y + (press ? 0 : -6), press ? 13 : 15, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffc94a';
    ctx.beginPath(); ctx.arc(x, y + (press ? 0 : -6), 5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawHint(now) {
    const h = S.hint;
    if (h && h.toggle) { drawSwitchPulse(now, h.t0); return; }
    if (!h || !present(h.ring)) return;
    const ring = S.L.rings[h.ring];
    const pulse = 0.5 + 0.5 * Math.sin((now - h.t0) / 200);
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.2 + 0.3 * pulse})`;
    ctx.lineWidth = STROKE + 10;
    ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, TAU); ctx.stroke();
    // Dürtme yalnızca halkayı gösterir; yön ve hedef ipucunda
    if (h.nudge) { ctx.restore(); return; }
    const tx = ring.x + Math.cos(h.target) * ring.r;
    const ty = ring.y + Math.sin(h.target) * ring.r;
    ctx.shadowColor = '#ffc94a';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#ffc94a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(tx, ty, 11 + 3 * pulse, 0, TAU); ctx.stroke();
    const dir = Math.sign(h.delta) || 1;
    const a0 = S.angles[h.ring];
    const a1 = a0 + dir * Math.min(Math.abs(h.delta), 50 * DEG);
    const rr = ring.r + 24;
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(ring.x, ring.y, rr, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
    const ax = ring.x + Math.cos(a1) * rr, ay = ring.y + Math.sin(a1) * rr;
    const tang = a1 + dir * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(tang) * 8, ay + Math.sin(tang) * 8);
    ctx.lineTo(ax + Math.cos(tang + 2.5) * 8, ay + Math.sin(tang + 2.5) * 8);
    ctx.moveTo(ax + Math.cos(tang) * 8, ay + Math.sin(tang) * 8);
    ctx.lineTo(ax + Math.cos(tang - 2.5) * 8, ay + Math.sin(tang - 2.5) * 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) stepParticle(ctx, p);
    ctx.globalAlpha = 1;
  }

  // Bir parçacığı ilerletip çizer; şekli mağazadaki kurtulma efektine göre
  function stepParticle(g, p) {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.96; p.vy *= 0.96;
    if (p.shape === 'bubble') p.vy -= 0.06;
    p.life -= p.shape === 'bubble' ? 0.018 : 0.025;
    const a = Math.max(p.life, 0), s = p.size * (p.shape === 'dot' || !p.shape ? a : 0.6 + 0.6 * a);
    g.globalAlpha = a;
    g.fillStyle = p.color;
    g.strokeStyle = p.color;
    if (p.shape === 'star') {
      const r = s * 2;
      g.beginPath();
      g.moveTo(p.x, p.y - r); g.lineTo(p.x + r * 0.28, p.y - r * 0.28); g.lineTo(p.x + r, p.y); g.lineTo(p.x + r * 0.28, p.y + r * 0.28);
      g.lineTo(p.x, p.y + r); g.lineTo(p.x - r * 0.28, p.y + r * 0.28); g.lineTo(p.x - r, p.y); g.lineTo(p.x - r * 0.28, p.y - r * 0.28);
      g.closePath(); g.fill();
    } else if (p.shape === 'bubble') {
      g.lineWidth = 1.4;
      g.beginPath(); g.arc(p.x, p.y, s * 1.6, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.7)';
      g.beginPath(); g.arc(p.x - s * 0.5, p.y - s * 0.5, s * 0.4, 0, TAU); g.fill();
    } else if (p.shape === 'heart') {
      const r = s * 1.1;
      g.beginPath();
      g.moveTo(p.x, p.y + r * 1.2);
      g.bezierCurveTo(p.x - r * 2, p.y - r * 0.2, p.x - r * 0.9, p.y - r * 1.6, p.x, p.y - r * 0.5);
      g.bezierCurveTo(p.x + r * 0.9, p.y - r * 1.6, p.x + r * 2, p.y - r * 0.2, p.x, p.y + r * 1.2);
      g.fill();
    } else if (p.shape === 'bolt') {
      const ang = Math.atan2(p.vy, p.vx), r = s * 2.2;
      g.save(); g.translate(p.x, p.y); g.rotate(ang);
      g.lineWidth = 1.8; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-r, 0); g.lineTo(-r * 0.2, -r * 0.45); g.lineTo(r * 0.2, r * 0.45); g.lineTo(r, 0); g.stroke();
      g.restore();
    } else {
      g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.fill();
    }
  }

  // Şok dalgası: iki genişleyen halka (beyaz, sonra dünyanın rengi) ve kısa bir parlama.
  // Tahtanın dışına taşabilsin diye üst efekt katmanına çizilir.
  function drawShocks(now) {
    if (!shocks.length) return;
    const accent = themeWorld ? W.worldById(themeWorld).theme.accent : '#fff';
    const reach = 300 * scale;
    shocks = shocks.filter(s => now < s.t0 + 900);
    for (const s of shocks) {
      const flash = Math.max(0, 1 - (now - s.t0) / 260);
      if (flash > 0) {
        const grd = fctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, reach);
        grd.addColorStop(0, `rgba(255,255,255,${0.45 * flash})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        fctx.fillStyle = grd;
        fctx.beginPath(); fctx.arc(s.x, s.y, reach, 0, TAU); fctx.fill();
      }
      [[0, '#ffffff', 14], [130, accent, 9]].forEach(([delay, color, width]) => {
        const t = (now - s.t0 - delay) / 650;
        if (t < 0 || t > 1) return;
        const e = 1 - Math.pow(1 - t, 3);
        fctx.save();
        fctx.globalAlpha = 1 - t;
        fctx.strokeStyle = color;
        fctx.lineWidth = (width * (1 - t) + 1) * scale;
        fctx.shadowColor = color;
        fctx.shadowBlur = 20;
        fctx.beginPath(); fctx.arc(s.x, s.y, (20 + 300 * e) * scale, 0, TAU); fctx.stroke();
        fctx.restore();
      });
    }
  }

  // Övgü ve "Zincir ×N" yazıları: büyüyerek belirir, yükselir ve söner (efektler kapalıysa büyümeden)
  const FLOAT_FONT = '"Baloo F", "Baloo 2", "Trebuchet MS", sans-serif';
  function drawFloaters(now) {
    floaters = floaters.filter(f => now < f.t0 + (f.life || 1300));
    for (const f of floaters) {
      const t = (now - f.t0) / (f.life || 1300);
      const pop = !fxOn() ? 1 : t < 0.12 ? 0.5 + (t / 0.12) * 0.7 : t < 0.25 ? 1.2 - ((t - 0.12) / 0.13) * 0.2 : 1;
      const size = f.size || (f.big ? 38 : 32);
      fctx.save();
      fctx.globalAlpha = t > 0.65 ? (1 - t) / 0.35 : 1;
      fctx.translate(f.x, f.y - 46 - 50 * t);
      fctx.scale(pop, pop);
      fctx.font = `800 ${size}px ${FLOAT_FONT}`;
      fctx.textAlign = 'center';
      fctx.textBaseline = 'middle';
      fctx.lineJoin = 'round';
      fctx.lineWidth = 7;
      fctx.strokeStyle = 'rgba(20, 12, 0, .75)';
      fctx.strokeText(f.text, 0, 0);
      const [c0, c1] = f.colors || ['#fff3b0', '#ffb52e'];
      const grd = fctx.createLinearGradient(0, -size / 2, 0, size / 2);
      grd.addColorStop(0, c0);
      grd.addColorStop(1, c1);
      fctx.fillStyle = grd;
      fctx.fillText(f.text, 0, 0);
      if (f.sub) {
        fctx.font = `800 17px ${FLOAT_FONT}`;
        fctx.lineWidth = 5;
        fctx.strokeText(f.sub, 0, size * 0.72);
        fctx.fillStyle = '#ffffff';
        fctx.fillText(f.sub, 0, size * 0.72);
      }
      fctx.restore();
    }
  }

  // 3 yıldız: altın ışık halkası ekranın kenarlarına kadar yayılır
  function drawLightWaves(now) {
    if (!lightWaves.length) return;
    const app = $('app');
    const reach = Math.hypot(app.clientWidth, app.clientHeight);
    lightWaves = lightWaves.filter(l => now < l.t0 + 1100);
    for (const l of lightWaves) {
      const t = (now - l.t0) / 1100;
      const r = 30 + reach * (1 - Math.pow(1 - t, 2));
      const band = 50 + 40 * t;
      const grd = fctx.createRadialGradient(l.x, l.y, Math.max(0, r - band), l.x, l.y, r);
      grd.addColorStop(0, 'rgba(255, 214, 102, 0)');
      grd.addColorStop(0.7, `rgba(255, 230, 150, ${0.5 * (1 - t)})`);
      grd.addColorStop(1, 'rgba(255, 214, 102, 0)');
      fctx.save();
      fctx.globalCompositeOperation = 'lighter';
      fctx.fillStyle = grd;
      fctx.beginPath(); fctx.arc(l.x, l.y, r, 0, TAU); fctx.fill();
      fctx.restore();
    }
  }

  function drawFx(now) {
    fctx.clearRect(0, 0, fx.width, fx.height);
    if (coinFly.length) {
      const target = coinTarget();
      coinFly = coinFly.filter(f => now < f.t0 + COIN_MS);
      for (const f of coinFly) {
        const t = Math.max(0, (now - f.t0) / COIN_MS);
        const e = 1 - Math.pow(1 - t, 3);
        const x = f.x + (target.x - f.x) * e;
        const y = f.y + (target.y - f.y) * e - Math.sin(Math.PI * e) * 70;
        const r = 11 * scale * (1 - 0.35 * e);
        drawCoin(fctx, x, y, r, now / 120);
      }
    }
    drawShocks(now);
    drawLightWaves(now);
    drawConfetti();
    drawBulbFly(now);
    drawFloaters(now);
  }

  function drawConfetti() {
    if (!confetti.length) return;
    const h = $('app').clientHeight;
    confetti = confetti.filter(c => c.y < h + 20 && c.life > 0);
    for (const c of confetti) {
      c.x += c.vx; c.y += c.vy;
      c.vx *= c.drag || 0.985; c.vy += c.g == null ? 0.28 : c.g;
      if (c.drag) c.vy *= c.drag;
      c.rot += c.vr;
      c.life -= c.fade || 0.004;
      if (c.kind === 'coin') { drawCoin(fctx, c.x, c.y, c.size, c.rot); continue; }
      if (c.kind === 'spark') {
        fctx.globalAlpha = Math.max(0, c.life);
        fctx.fillStyle = c.color;
        fctx.beginPath(); fctx.arc(c.x, c.y, c.w * (0.5 + c.life), 0, TAU); fctx.fill();
        fctx.globalAlpha = 1;
        continue;
      }
      fctx.save();
      fctx.translate(c.x, c.y);
      fctx.rotate(c.rot);
      fctx.globalAlpha = Math.min(1, c.life * 2);
      fctx.fillStyle = c.color;
      fctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * Math.abs(Math.cos(c.rot * 2)) + 1);
      fctx.restore();
    }
  }

  function frame() {
    // Bir çizim hatası döngüyü asla durdurmasın (yoksa ekran son karede donar)
    requestAnimationFrame(frame);
    const now = performance.now(); // uçuş başlangıçlarıyla aynı saat
    try {
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, BOARD.w, BOARD.h);
      if (S.L && !$('game').hidden) {
        stepAuto(now);
        stepKicks(now);
        checkHelp(now);
        drawCouples();
        const visible = S.L.rings.map((_, i) => present(i) || (S.fly[i] && now < S.fly[i].t0 + FLY_MS));
        drawDeco(visible, now);
        visible.forEach((v, i) => v && drawRing(i, now));
        drawWeave();
        drawOpenPoints(now);
        drawSprings(now);
        drawTokens(now);
        drawSwitch(now);
        if (S.swPulse && now - S.swPulse < 900) drawSwitchPulse(now, S.swPulse);
        drawCoins(now);
        drawLoot(now);
        drawKeys(now);
        drawHint(now);
        drawFinger(now);
        drawParticles();
      }
      backdrop.draw(now, fxOn() && $('levels').hidden);
      if (!$('levels').hidden) drawMapFx(now);
      drawPreviews(now);
      drawFx(now);
    } catch (err) {
      console.error(err);
    }
  }

  // Uygulama açılış ekranı: simge büyüyerek gelir, sonra ana menü açılır
  function runSplash() {
    const sp = $('splash');
    if (!sp) return;
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      sp.classList.add('out');
      setTimeout(() => { sp.hidden = true; }, 450);
    };
    sp.hidden = false;
    sp.addEventListener('pointerdown', close);
    setTimeout(close, REDUCED ? 600 : 1700);
  }

  // Telefon çerçevesindeki saat
  function tickClock() {
    const el = $('clock');
    if (el) el.textContent = new Date().toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  }
  tickClock();
  setInterval(tickClock, 15000);

  // Geliştirme kısayolu: index.html?level=12 doğrudan o seviyeyi açar, ?screen=levels haritayı
  const params = new URLSearchParams(location.search);
  shownScore = totalScore();
  settleRewards();
  const qLevel = parseInt(params.get('level'), 10);
  resize();
  if (qLevel > 0) {
    loadLevel(qLevel);
    showScreen('game');
    if (params.has('hint')) $('hint').click();
    if (params.has('win')) { S.moves = S.def.par || 0; showWin(); }
  } else if (params.has('ending')) {
    // Geliştirme: ?ending kapanış sahnesini kayda dokunmadan gösterir
    applyWorld(W.worldOfGate(GATE_COUNT));
    showScreen('home');
    showEnding(true);
  } else if (params.has('src')) {
    // Geliştirme: ?src=1001 bir bölümü kaynak numarasıyla açar (kapıya yerleşmemiş tanıtımlar için)
    loadPreview(parseInt(params.get('src'), 10));
    showScreen('game');
  } else if (params.has('world')) {
    // Geliştirme: ?world=atolye o dünyanın temasını ve giriş kartını gösterir
    const world = W.worldById(params.get('world')) || W.WORLDS[1];
    const g = W.GATES.findIndex(x => x.world === world.id) + 1;
    loadLevel(Math.min(TOTAL, W.gateStart(Math.min(g, GATE_COUNT))));
    themeWorld = null;
    applyWorld(world);
    showScreen('game');
    showWorldCard(world);
  } else {
    const firstTime = !progress.tutorialDone && frontier() === 1 && !totalScore();
    if (firstTime || params.has('tutorial')) {
      loadTutorial(0);
      showScreen('game');
    } else {
      loadLevel(frontier());
      showScreen(params.get('screen') === 'levels' ? 'levels' : 'home');
    }
    runSplash();
  }
  // Android geri tuşu (Capacitor uygulaması): önce açık kartı kapatır, sonra bir önceki
  // ekrana döner; ana menüdeyken uygulamadan çıkar.
  const AppPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (AppPlugin) {
    AppPlugin.addListener('backButton', () => {
      if (!$('splash').hidden) return;
      if (!$('ending').hidden) { $('endingGo').click(); return; }
      if (!$('settings').classList.contains('hidden')) { $('settingsClose').click(); return; }
      if (!$('hintMenu').hidden) { closeHintMenu(); return; }
      if (!$('worldCard').classList.contains('hidden')) { $('worldGo').click(); return; }
      if (!$('gateCard').classList.contains('hidden')) { $('gateGo').click(); return; }
      if (!$('ceremony').hidden) { $('ceremony').click(); return; }
      if (!$('fail').classList.contains('hidden')) { $('failRetry').click(); return; }
      if (!$('win').classList.contains('hidden')) { $('win').classList.add('hidden'); showScreen('levels'); return; }
      if (!$('game').hidden) { showScreen(S.tut != null ? 'home' : 'levels'); return; }
      if (!$('levels').hidden) { showScreen('home'); return; }
      if (!$('trophies').hidden) { showScreen('home'); return; }
      AppPlugin.exitApp();
    });
  }

  // Geliştirme: ?gallery bütün şekilleri süsleriyle gösterir (bulmaca değil, yalnızca görünüş)
  function showGallery() {
    const shapes = window.RingLevels.ANIMALS;
    const host = document.createElement('div');
    host.className = 'gallery';
    host.innerHTML = `<h2>Şekil galerisi</h2><p>${shapes.length} şekil. İlk 10'u oyundaki, diğerleri yeni.</p><div class="g-grid"></div>`;
    document.body.appendChild(host);
    const grid = host.querySelector('.g-grid');
    const items = shapes.map((s, k) => {
      const fig = document.createElement('figure');
      fig.innerHTML = `<canvas width="420" height="420"></canvas><figcaption><b>${s.name}</b>${k >= 10 ? '<span>yeni</span>' : ''}</figcaption>`;
      grid.appendChild(fig);
      const c = fig.querySelector('canvas');
      return { s, c, g: c.getContext('2d') };
    });
    const loop = now => { for (const it of items) drawGalleryShape(it, now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  function drawGalleryShape({ s, c, g }, now) {
    const R = s.rings.filter(r => r.type !== 'bar');
    const x0 = Math.min(...R.map(r => r.x - r.r)), x1 = Math.max(...R.map(r => r.x + r.r));
    const y0 = Math.min(...R.map(r => r.y - r.r)), y1 = Math.max(...R.map(r => r.y + r.r));
    const k = 360 / Math.max(x1 - x0, y1 - y0, 240);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.setTransform(k, 0, 0, k, c.width / 2 - (x0 + x1) / 2 * k, c.height / 2 - (y0 + y1) / 2 * k);
    // Eşler: kesikli çizgi
    g.setLineDash([6, 8]); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 3;
    for (const [a, b] of s.couples || []) {
      g.beginPath(); g.moveTo(s.rings[a].x, s.rings[a].y); g.lineTo(s.rings[b].x, s.rings[b].y); g.stroke();
    }
    g.setLineDash([]);
    // Süsler halkaların altında (oyundaki gibi), z küçük olan önce
    for (const d of (s.deco || []).slice().sort((a, b) => (a.z || 0) - (b.z || 0))) {
      const r = s.rings[d.ring];
      g.save(); g.translate(r.x, r.y);
      Deco.draw(g, d, r.r, now, r.color);
      g.restore();
    }
    // Halkalar: oyundaki gibi gölge, renk ve parlama; her birinde bir boşluk
    s.rings.forEach((r, i) => {
      if (r.type === 'bar') return;
      const gap = (i * 67 + 300) * DEG;
      for (const [col, w, dx, dy] of [['rgba(0,0,0,.4)', STROKE + 6, 2, 4], [r.color, STROKE, 0, 0], ['rgba(255,255,255,.3)', 3, -2, -2]]) {
        g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
        g.beginPath(); g.arc(r.x + dx, r.y + dy, r.r, gap + GAP_HALF, gap + TAU - GAP_HALF); g.stroke();
      }
    });
  }
  if (params.has('gallery')) showGallery();

  if (params.has('debug')) {
    window.__halka = { S, scale: () => scale, progress, ORDER, renderMap, loadLevel, lootOf, ambience, settle, badgeCtx, awardBadges, showScreen,
      fxCounts: () => ({ shocks: shocks.length, floaters: floaters.length, lightWaves: lightWaves.length }) };
  }
  requestAnimationFrame(frame);
})();
