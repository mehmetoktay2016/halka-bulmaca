// Ekranlar, çizim, dokunma, ses ve efektler. Kurallar logic.js'te, seviyeler levels.js'te.
(() => {
  'use strict';

  const { TAU, DEG, GAP_HALF, angDist, signedDelta, buildLevel,
          pointOpen, afterMove, rotate, pressureLeft, armorLeft, solveFast, norm, canRotate, spend, turnTable, iceLeft, hidden, isFree, slideRail } = window.RingLogic;
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
    for (const p of window.RingPieces.PIECES) { p.name = tr(p.name); p.text = tr(p.text); }
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
  // 2.5 gerilim ve ödül anları (Z8, Z18): bütün bölümlerde
  const HITSTOP_MS = 260;  // son halkadan önce sahne bir an donar
  const SLOW_K = 2.4;      // son halka ağır çekimde bu kat yavaş uçar
  const COMBO_FULL = 6;    // kombo metresinin dolması için gereken puan
  const COMBO_COINS = 3;   // metre dolunca gelen altın patlaması
  const RAIN_MS = 30000;   // Altın Yağmuru süresi (kapının 5. bölümünden sonra, isteğe bağlı, kapı başına bir kez)
  const RAIN_COINS = 3;    // Altın Yağmurunda tahta başına en çok altın
  const flyMs = f => (f.slow ? FLY_MS * SLOW_K : FLY_MS);
  const WAVE_MS = 170;
  const PEARL_MS = 450; // istiridye açılınca inci belirip büyür; sonraki dalga onu bekler
  const COIN_MS = 650;
  const KEY_MS = 560;   // anahtarın kilide uçuşu
  const KICK_WAIT = 140; // yaylı halka uçmaya başladıktan sonra tekmenin gelişi
  const KICK_MS = 420;   // tekmeyle dönen halkanın dönüşü (sonda hafif geri yaylanır)
  const BLAST_WAIT = 150; // bomba uçmaya başladıktan sonra patlaması
  const BLAST_HOLD = 140; // patlamayla vurulan halkalar beyaz parlar, sonra uçar
  const BEAM_MS = 240, BEAM_GAP = 40; // renk bombasının şeridi halkaya bu sürede varır; şeritler arka arkaya çıkar
  const FUSE_WAIT = 160;  // kazanın basıncı dolduktan sonra düdüğün ötmesi
  const FUSE_MS = 560;    // düdük öterken kazan akkor parlayıp sarsılır, sonra çıkıp patlar
  const BOSS_MS = 760;    // Dev Halkanın zırhı bitince ağırlaşma (yükselen ses, sarsıntı), sonra parçalanır
  const TOKEN_FLY_MS = 620; // jetonun taşıyan halkadan jetonlu halkaya uçuşu
  // Şalter renkleri (halka paletinden ayrı): 0 mavi, 1 turuncu. Şalterli halka kendi rengini değil bunu alır.
  const SIDE_COLORS = ['#3d9bff', '#ff8a1f'];
  const SWITCH_W = 84, SWITCH_H = 40, SWITCH_MS = 180;
  const PULSE_MS = 260; // nabız kapağının açılıp kapanması
  const TURN_MS = 620, HUB = 26, TABLE_COLOR = '#c3a6ff'; // döner tabla: dönüş süresi, göbek düğmesi
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
  const PCS = window.RingPieces;
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
  const moveCap = src => ({ 9: 12, 10: 14, 12: 17 })[window.RingLevels.maxParOf(src)] || 10;
  const moveLimit = (par, src) => Math.min(moveCap(src), par + Math.max(3, Math.ceil(par * 0.6)));

  // ---- Ses (WebAudio ile sentez; dosya gerekmez) ----
  const Sound = (() => {
    let ac = null;
    function audio() {
      // balanced: telefonda daha büyük ses tamponu; işlemci yoğunken (harita, müzik) ses cızırdamaz
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'balanced' }); } catch (e) { return null; } }
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
    // Sönen beyaz gürültü, alçak geçiren süzgeç fromHz'den toHz'e iner (patlama, gümbürtü)
    function noise(dur, vol, fromHz, toHz, delay = 0) {
      if (!progress.sound) return;
      const a = audio();
      if (!a) return;
      const t = a.currentTime + delay;
      const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
      const n = a.createBufferSource(); n.buffer = buf;
      const f = a.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(fromHz, t); f.frequency.exponentialRampToValueAtTime(toHz, t + dur);
      const g = a.createGain(); g.gain.value = vol;
      n.connect(f).connect(g).connect(a.destination);
      n.start(t);
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
      // Bütün patlamalar (bomba, kazan, son halka, Dev Halka, haritada top, fişek, kapı, kumbara) bu sesi çalar.
      // Bomba: tok gümleme (telefon hoparlöründe de duyulsun diye üstünde üçgen katman), şaklayan pop, hızla yükselen
      // parlak arpej, açılan akor ve dökülen parıltılar (konfeti patlaması gibi); zincirde (k. patlama) her biri
      // iki yarım ses daha tiz, üçüncüden sonra en tepeye bir parıltı daha eklenir. Gürültü kısa ve alçaktır (cızırtı yok)
      bang: (k = 0) => {
        const m = Math.pow(2, Math.min(k, 5) * 2 / 12);
        tone(180, 0.45, 'sine', 0.32, 45);
        tone(260, 0.25, 'triangle', 0.12, 90);
        tone(700 * m, 0.08, 'triangle', 0.14, 1400 * m);
        noise(0.22, 0.18, 1800, 220);
        [784, 988, 1175, 1568, 1976].forEach((f, j) => tone(f * m, 0.2, 'triangle', 0.08, null, 0.04 + j * 0.035));
        [1175, 1568, 1976].forEach(f => tone(f * m, 0.6, 'triangle', 0.04, null, 0.2));
        [3136, 2637, 2349, 2093, 1760].forEach((f, j) => tone(f * m * (0.98 + Math.random() * 0.04), 0.35, 'sine', 0.03, null, 0.28 + j * 0.05));
        if (k >= 2) tone(4186 * m, 0.5, 'sine', 0.025, null, 0.3);
      },
      // Renk bombası: bomba sesinin ardından şerit varan her halkada bir basamak yükselen pentatonik çınlama
      // (paint: renge göre başlangıç notası)
      candy: (hits, paint) => {
        const base = [523, 587, 659][paint], steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
        for (let j = 0; j < hits; j++) {
          const f = base * Math.pow(2, steps[Math.min(j, steps.length - 1)] / 12), at = (BEAM_MS + j * BEAM_GAP) / 1000;
          tone(f, 0.35, 'sine', 0.1, null, at); tone(f * 2, 0.2, 'sine', 0.03, null, at);
        }
      },
      // Motor: çark dönerken tahta tık + metal tak
      // İstiridye açılır: kabarcıklar, kabuk çıtı, yükselen sedef tınısı
      pearl: () => {
        for (let k = 0; k < 4; k++) tone(300 + Math.random() * 300, 0.08, 'sine', 0.04, 900 + Math.random() * 600, k * 0.05);
        tone(1200, 0.04, 'triangle', 0.04, null, 0.05);
        for (const [d, f] of [[0.18, 1046.5], [0.26, 1318.5], [0.34, 1568], [0.42, 2093]]) { tone(f, 1.2, 'sine', 0.045, null, d); tone(f * 2.01, 0.6, 'sine', 0.012, null, d); }
      },
      // Zincir gerilir: metal şıngırtı; ikizler birlikte uçar: uzun şıngırtı ve iki nota birden
      chain: () => { for (let k = 0; k < 3; k++) { const f = 2400 + Math.random() * 1600; tone(f, 0.09, 'square', 0.025, null, k * 0.045); tone(f * 1.5, 0.12, 'sine', 0.018, null, k * 0.045); } },
      twins: () => {
        for (let k = 0; k < 6; k++) { const f = 2400 + Math.random() * 1600; tone(f, 0.09, 'square', 0.025, null, k * 0.045); }
        for (const f of [659.25, 830.6]) { tone(f, 0.6, 'triangle', 0.07, null, 0.08); tone(f * 2, 0.3, 'sine', 0.02, null, 0.08); }
      },
      // Raylı halka kayar: yükselen yumuşak kayış, durağa tok oturma
      slide: () => { tone(330, 0.25, 'sine', 0.05, 520); tone(880, 0.06, 'triangle', 0.06, null, 0.24); tone(196, 0.12, 'sine', 0.08, null, 0.24); },
      gear: () => {
        noise(0.05, 0.35, 3000, 1500); tone(900, 0.08, 'triangle', 0.1, 540);
        noise(0.05, 0.45, 1800, 900, 0.11); tone(520, 0.1, 'triangle', 0.13, 310, 0.11);
      },
      // Kalp atışı: iki alçak, yumuşak vuruş (gerilim sahnesi)
      heart: () => { tone(62, 0.16, 'sine', 0.22, 42); tone(56, 0.14, 'sine', 0.16, 40, 0.24); },
      // Dev Halka ağırlaşırken (riser): yükselen hışırtı, tizleşen ses, hızlanan davul vuruşları
      riser: () => {
        const a = audio();
        if (!a || !progress.sound) return;
        const t = a.currentTime, len = 0.72;
        const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const n = a.createBufferSource(); n.buffer = buf;
        const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
        bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(4200, t + len);
        const ng = a.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.3, t + len);
        n.connect(bp).connect(ng).connect(a.destination); n.start(t);
        tone(98, len, 'sawtooth', 0.08, 392);
        [0, 0.26, 0.44, 0.56, 0.64, 0.69].forEach((at, k) => tone(110, 0.14, 'sine', 0.22 + k * 0.05, 45, at));
      },
      // Dev Halka yenildi: hızlı yükselen zafer çıngılı, tam akor ve dökülen parıltı notaları
      victory: () => {
        [523.3, 659.3, 784, 1046.5].forEach((f, k) => tone(f, 0.25, 'triangle', 0.11, null, 0.08 + k * 0.07));
        [523.3, 659.3, 784, 1046.5, 1318.5].forEach(f => tone(f, 0.9, 'triangle', 0.05, null, 0.4));
        tone(130.8, 0.9, 'sine', 0.12, null, 0.4);
        [2637, 2349, 2093, 1760, 1568, 1319].forEach((f, k) => tone(f, 0.4, 'sine', 0.03, null, 0.53 + k * 0.06));
      },
      // Zırh plakası kırıldı: metal tıngırtısı
      clank: () => {
        tone(420, 0.2, 'square', 0.05, 180);
        tone(1750, 0.5, 'sine', 0.04); tone(2630, 0.5, 'sine', 0.035);
      },
      // Kazan düdüğü: yükselen tiz ses, altında kaynama gurultusu
      whistle: () => {
        tone(700, 0.55, 'sine', 0.08, 2200);
        noise(0.5, 0.35, 300, 500);
      },
      // Portal: yükselen hışırtı ("fşşt") ve üstünde parıldayan üçlü
      swoosh: () => {
        noise(0.45, 0.4, 500, 5000);
        [1319, 1760, 2637].forEach((f, k) => tone(f, 0.4, 'sine', 0.06, null, 0.12 + k * 0.07));
      },
      // Buz: çatlayınca kısa cam çıtırtısı, eriyince (melt) dökülen cam parçaları
      crack: melt => {
        (melt ? [2637, 3520, 2093, 3136, 4186] : [3136, 2349]).forEach((f, k) =>
          tone(f * (0.97 + Math.random() * 0.06), 0.35, 'sine', 0.06, null, k * (melt ? 0.045 : 0.03)));
        noise(0.12, melt ? 0.3 : 0.2, 7000, 2500);
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
      // Tabla: ağır bir dönüş uğultusu ve yerine oturan iki tık
      turn: () => { tone(70, 0.6, 'sawtooth', 0.035, 95); tone(1500, 0.03, 'square', 0.04, null, 0.05); tone(1200, 0.04, 'square', 0.05, null, 0.6); },
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
      tone, noise,
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
  // Müzik (2.5, music.js): oyun ekranında, bölüm sürerken çalar; ayarlardan ayrıca kapatılır, sesi ayarlanır (varsayılan kısık)
  const music = window.RingMusic.Music(() => Sound.context());
  function syncMusic() {
    if (progress.music !== false && !document.hidden && !$('game').hidden && !S.won) { music.volume((progress.musicVol ?? 40) / 100); music.play(); }
    else music.stop();
  }
  document.addEventListener('visibilitychange', syncMusic);

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
  let flashT = 0;       // son halkadaki beyaz parlamanın başlangıcı
  // Kombo metresi: art arda zincir yapan hamleler doldurur, dolunca altın patlaması (oturum boyunca sürer)
  let comboPts = 0, comboStreak = 0;
  // Altın Yağmuru: { gate, end, total, boards, back } (oynanırken), yoksa null
  let rain = null;
  // Meydan okuma (2.5): { k } — 20k. bölümün kapısında, haritadan açılan isteğe bağlı çok zor bölüm
  let challenge = null;
  const BONUS = window.RingLevels.BONUS;
  const bonusCount = () => Math.floor(TOTAL / BONUS.every);
  const bonusSrc = k => BONUS.first + k - 1;
  const bonusReady = k => !!(window.RING_LEVEL_DATA && window.RING_LEVEL_DATA[bonusSrc(k)]);
  let floaters = [];   // yükselen yazılar, ör. "Harika!" { text, x, y, t0, big?, size?, sub?, colors?, life? } (uygulama koordinatı)
  let lightWaves = []; // 3 yıldız ışık dalgası { x, y, t0 } (uygulama koordinatı)

  // ---- Ekran geçişleri ----
  function showScreen(name) {
    for (const id of ['home', 'levels', 'game', 'trophies', 'shop']) $(id).hidden = id !== name;
    if (name !== 'game') challenge = null;
    if (name === 'shop') renderShop();
    if (name === 'home') { renderHome(); maybeStreak(); }
    if (name === 'trophies') renderTrophies();
    if (name === 'levels') renderMap();
    if (name === 'game') requestAnimationFrame(resize);
    syncMusic();
  }

  // ---- Dünya teması: zemin ve vurgu rengi dünyaya göre değişir, halka renkleri değişmez ----
  let themeWorld = null;
  function applyWorld(world) {
    if (themeWorld === world.id) return;
    themeWorld = world.id;
    music.world(world.id); // dünyanın müzik çeşitlemesi bir sonraki ölçüde girer
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
    for (let g = 1; g < fg - 1; g++) progress.rewards['jar:' + g] = progress.rewards['jar:' + g] || 'eski';
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
    } else if (mysteryAt(n)) {
      // Gizem halka (2.5): ödül halkası olmayan bölümlerin yaklaşık sekizde birinde, sabit yerde
      const spot = R.spotFor('bulb', spots(p));
      if (spot) { const [ring, x, y] = spot; loot = { type: 'mystery', name: tr('Gizem halka'), coins: 0, bulbs: 0, ring, x, y }; }
    }
    return (lootCache[n] = loot);
  }
  // Gizem halkanın bölümleri: her oyuncuda aynı (numaradan karışık bir sayı), kapı finalleri ve ilk bölümler hariç
  const mysteryAt = n => {
    if (n <= 3 || W.posInGate(n) === W.GATE_SIZE) return false;
    let x = Math.imul(n ^ 0x5bd1e995, 2654435761);
    x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12;
    return ((x >>> 0) % 8) === 5;
  };
  const LOOT_TIPS = {
    mystery: { flag: 'mysteryTip', text: tr('Gizem halkayı kurtar: içinden rastgele bir ödül çıkar') },
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
  const stat = (key, v = 1) => { if (v) progress.stats[key] = (progress.stats[key] || 0) + v; };
  let tries = 0, triesOf = 0; // aynı bölümün art arda kaçıncı denemesi ("Sabırlı" rozeti)
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
      st, // 2.5 rozetlerinin sayaçları (bombs, iceCracks, boilers, teleports, bosses, rains, mysteries, bestStreak, lastBreath, patient)
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
    `<span class="medal${done ? '' : ' locked'}" style="--tc:${B.TIERS[b.tier].color}"><svg viewBox="0 0 24 24" aria-hidden="true">${B.ICONS[b.secret && !done ? 'soru' : b.icon]}</svg></span>`;

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
    $('pieceCount').textContent = `${PCS.PIECES.filter(p => progress.seenPieces[p.id]).length}/${PCS.PIECES.length}`;
    $('tabPieces').setAttribute('aria-selected', String(trophyTab === 'pieces'));
    $('tabBadges').setAttribute('aria-selected', String(trophyTab === 'badges'));
    $('tabAlbum').setAttribute('aria-selected', String(trophyTab === 'album'));
    $('tabStickers').setAttribute('aria-selected', String(trophyTab === 'stickers'));
    $('trophyList').innerHTML = trophyTab === 'badges' ? badgesHtml(ctx, fresh) : trophyTab === 'album' ? albumHtml()
      : trophyTab === 'pieces' ? piecesHtml() : stickersHtml();
    if (trophyTab === 'pieces') bindPieceTiles();
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
      // Gizli rozet kazanılana kadar adı, koşulu ve ilerlemesi görünmez
      const hide = b.secret && !done;
      const meta = done
        ? `<span class="got">${tr('Kazanıldı · +{n} altın', { n: reward })}</span>`
        : hide ? `<span>+${reward}</span>`
        : `<span class="bar-track"><i style="width:${Math.round(100 * s.value / s.goal)}%"></i></span><span>${s.value} / ${s.goal}</span><span>+${reward}</span>`;
      html += `<div class="badge-row${fresh.has(b.id) ? ' new' : ''}" style="--tc:${B.TIERS[b.tier].color}">
        ${medalHtml(b, done)}
        <div><b>${hide ? '???' : b.name}</b><p>${hide ? tr('Gizli rozet: kazanınca görünür') : b.desc}</p><div class="meta">${meta}</div></div>
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
  $('tabPieces').onclick = () => { Sound.tap(); trophyTab = 'pieces'; renderTrophies(); };

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
  const MAP = { strip: 34 }; // sağdaki kapı şeridinin genişliği
  let mapGeo = null;      // son çizimin ölçüleri: kapıların konumları
  let lastWon = null;     // haritaya dönünce Halka'nın bu bölümden sonrakine yürüyeceği bölüm
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

  // Macera haritası (adventure.js çizer). Dokunma ve erişilebilirlik için duraklar DOM düğmesi olarak üstte kalır.
  // Şekil bölümlerinin istasyonunda şeklin küçük resmi durur (renkli: bitmiş, gri: henüz değil)
  const shapeImgs = {};
  let ADV = null;
  function adv() {
    if (ADV) return ADV;
    ADV = window.RingAdventure.create({
      canvas: $('mapFx'), scroller: $('map'), tr,
      reduced: () => !fxOn(),
      sound: Sound,
      data: {
        count: TOTAL, gateSize: W.GATE_SIZE,
        worldOfGate: g => W.worldOfGate(g),
        stars: starsOf, frontier,
        shape: n => { const def = getLevel(srcOf(n)); return def.name ? { name: def.name, final: W.posInGate(n) === W.GATE_SIZE } : null; },
        shapeImage: (n, colored) => {
          const key = n + (colored ? 'c' : 'g');
          if (!shapeImgs[key]) {
            const img = new Image();
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(shapeSvg(getLevel(srcOf(n)), colored).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
            shapeImgs[key] = img;
          }
          return shapeImgs[key];
        },
        reward: n => { const l = lootWaiting(n); if (l) return ['mystery', 'gold', 'bulb'].includes(l.type) ? l.type : 'chest'; return pieceWaiting(n) ? 'piece' : null; },
        gateOpen: g => isUnlocked(W.gateStart(g)) && (g === 1 || !!progress.rewards['gate:' + g]),
        jar: () => ({ stars: gateStars(W.gateOf(frontier())), max: W.GATE_SIZE * 3 }),
        bonusEvery: BONUS.every,
        bonus: k => (bonusReady(k) ? { open: !!starsOf(k * BONUS.every), stars: progress.bonus[k] || 0 } : null),
      },
    });
    return ADV;
  }

  function renderMap() {
    const wrap = $('map');
    const inner = $('mapInner');
    const width = wrap.clientWidth - MAP.strip;
    if (width <= 0) return;
    const A = adv(), m = A.measure(width);
    const front = frontier();
    applyWorld(W.worldOfGate(W.gateOf(front)));
    $('starTotal').textContent = `${totalStars()} / ${TOTAL * 3}`;
    inner.style.height = m.height + 'px';
    mapGeo = { arches: [] };
    for (let g = 1; g <= GATE_COUNT; g++) mapGeo.arches[g] = m.gate(g);

    // Duraklar: görünmez düğmeler (çizim canvas'ta); ekran okuyucu için bölümün durumu ve ödülü
    let html = '';
    for (let n = 1; n <= TOTAL; n++) {
      const def = getLevel(srcOf(n));
      const state = starsOf(n) ? 'done' : isUnlocked(n) ? 'open' : 'locked';
      const chest = lootWaiting(n), piece = pieceWaiting(n), at = m.node(n);
      const label = `${tr('Seviye {n}', { n })}${def.name ? ', ' + tr(def.name) : ''}, ${tierOf(n).name.toLowerCase()}, ` +
        (state === 'locked' ? tr('kilitli') : state === 'done' ? tr('{n} yıldız', { n: starsOf(n) }) : tr('oynanmadı'));
      html += `<button class="stop ${state}" data-n="${n}" style="left:${at.x}px;top:${at.y}px"
        aria-label="${label}${chest ? ', ' + tr('{name} var', { name: tr(chest.name).toLowerCase() }) : ''}${piece ? ', ' + tr('çıkartma parçası var') : ''}"${state === 'locked' ? ' disabled' : ''}></button>`;
    }
    // Meydan okuma sunakları (isteğe bağlı): 20k. bölüm bitince açılır
    for (let k = 1; k <= bonusCount(); k++) {
      if (!bonusReady(k)) continue;
      const at = m.bonus(k), open = !!starsOf(k * BONUS.every), got = progress.bonus[k] || 0;
      html += `<button class="stop" data-k="${k}" style="left:${at.x}px;top:${at.y}px"
        aria-label="${tr('Meydan Okuma {n}', { n: k })}, ${tr('çok zor, isteğe bağlı')}, ${open ? (got ? tr('{n} yıldız', { n: got }) : tr('oynanmadı')) : tr('kilitli')}"${open ? '' : ' disabled'}></button>`;
    }
    const pl = m.play(front);
    html += `<button class="stop-play" data-n="${front}" style="left:${pl.x}px;top:${pl.y}px;width:${pl.w}px;height:${pl.h}px">${tr('Oyna')}</button>`;
    inner.innerHTML = html;
    inner.querySelectorAll('button:not([disabled])').forEach(b => {
      b.onclick = () => {
        if (mapBusy || A.busy()) return;
        Sound.tap();
        if (b.dataset.k) startChallenge(Number(b.dataset.k));
        else loadLevel(Number(b.dataset.n));
        showScreen('game');
      };
    });
    renderGateStrip(mapGeo);

    // Az önce kazanılan bölümden sonrakine yolculuk: Halka önceki istasyonun nesnesiyle gider.
    // Kapı geçişinde önce tören (kapı açılır, sis kalkar), sonra büyük zıplayış.
    const seen = Math.min(progress.seenFrontier || front, front);
    const won = lastWon;
    lastWon = null;
    const walk = won != null && won === seen && front === seen + 1;
    progress.seenFrontier = front;
    saveProgress();
    const pending = pendingCelebration();
    A.place(walk ? seen : front);
    const focusY = pending && pending.gate ? m.gate(pending.gate).y : m.node(walk ? seen : front).y;
    wrap.scrollTop = focusY - wrap.clientHeight * 0.62;
    const go = () => {
      if (!walk) return;
      mapBusy = true;
      A.travel(seen, front, starsOf(seen), () => {
        mapBusy = false;
        // Kutlama seyrek kalsın ki değeri olsun: her 5. bölüme varınca ya da kusursuz seri her 3'te
        const streak = progress.streakPerfect || 0;
        if (front % 5 === 0 || (streak >= 3 && streak % 3 === 0)) setTimeout(() => A.celebrate(front), 380);
      });
    };
    if (pending) celebrate(pending, go);
    else go();
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
    // Kapılar yukarı doğru dizili: y'nin altında kalan en yüksek kapı
    let g = 1;
    for (let i = 1; i < mapGeo.arches.length; i++) if (mapGeo.arches[i].y >= y) g = i;
    return g;
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
    // Biten kapının kumbarası: kapıdaki yıldızlar kadar altın, kapı başına bir kez
    const done1 = p.gate ? p.gate - 1 : 0, jar = done1 && !progress.rewards['jar:' + done1] ? gateStars(done1) * ECO.jarCoinsPerStar : 0;
    if (done1) progress.rewards['jar:' + done1] = true;
    if (jar) adv().burstJar(gateStars(done1), W.GATE_SIZE * 3);
    let shown = false;
    const showCard = () => {
      if (shown) return;
      shown = true;
      const rewards = [];
      if (p.gate) {
        progress.rewards['gate:' + p.gate] = true;
        progress.hints += ECO.gateBulbs;
        rewards.push(`<span class="chip bulb">${tr('+{n} ampul', { n: ECO.gateBulbs })}</span>`);
        if (jar) {
          progress.coins += jar; stat('coinsTotal', jar);
          rewards.push(`<span class="chip loot-chip gold">${tr('Kumbara: +{n} altın', { n: jar })}</span>`);
        }
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
    if (REDUCED || !p.gate) { if (p.gate) adv().openGate(p.gate); Sound.gate(); showCard(); return; }
    setTimeout(() => { adv().openGate(p.gate); Sound.gate(); }, 450);
    setTimeout(showCard, 2100);
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
      if (pieceQueue.length) showPieceCard();
    };
  }

  // ---- Parça kartları (2.4): ilk görüşte kullanma kılavuzu, koleksiyonda tekrar açılır ----
  // Parçanın tanıtım bölümünü bitirmiş eski oyuncular o parçayı biliyor sayılır.
  if (!progress.seenPieces) progress.seenPieces = {};
  for (const p of PCS.PIECES) if (progress.stars[String(p.intro)]) progress.seenPieces[p.id] = true;
  let pieceQueue = [], pieceAnim = 0;
  function maybePieceCard(def) {
    // Dev Halka bir tanıtım bölümüyle değil, ilk kapı finalinde kartla tanıtılır
    const f = window.RingLevels.features(def).concat(def.rings.some(r => r.boss) ? ['boss'] : []);
    pieceQueue = PCS.PIECES.filter(p => f.includes(p.id) && !progress.seenPieces[p.id]);
    if (pieceQueue.length && $('worldCard').classList.contains('hidden')) showPieceCard();
  }
  function showPieceCard(replay) {
    const p = pieceQueue.shift();
    if (!p) return;
    $('pieceEyebrow').textContent = replay ? tr('Parçalar') : tr('Yeni parça');
    $('pieceTitle').textContent = p.name;
    $('pieceText').textContent = p.text;
    $('pieceCard').classList.remove('hidden');
    const cv = $('pieceDemo'), g = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = PCS.DEMO_W * dpr; cv.height = PCS.DEMO_H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t0 = performance.now();
    cancelAnimationFrame(pieceAnim);
    const loop = now => {
      if ($('pieceCard').classList.contains('hidden')) return;
      PCS.drawDemo(g, p.id, REDUCED ? 1800 : now - t0, tr);
      pieceAnim = requestAnimationFrame(loop);
    };
    pieceAnim = requestAnimationFrame(loop);
    $('pieceGo').onclick = () => {
      Sound.tap();
      progress.seenPieces[p.id] = true;
      saveProgress();
      $('pieceCard').classList.add('hidden');
      cancelAnimationFrame(pieceAnim);
      if (pieceQueue.length) setTimeout(() => showPieceCard(replay), 250);
      else if (trophyTab === 'pieces' && !$('trophies').hidden) renderTrophies();
    };
  }
  function piecesHtml() {
    const tiles = PCS.PIECES.map(p => {
      const seen = !!progress.seenPieces[p.id];
      return `<button type="button" class="piece-tile${seen ? '' : ' locked'}" data-piece="${p.id}" ${seen ? '' : 'disabled'}>
        <canvas width="${PCS.DEMO_W}" height="${PCS.DEMO_H}" aria-hidden="true"></canvas><b>${seen ? p.name : '???'}</b></button>`;
    });
    return `<div class="piece-grid">${tiles.join('')}</div>
      <p class="album-note">${tr('Oyunda karşılaştığın parçalar burada. Birine dokun, nasıl çalıştığını izle.')}</p>`;
  }
  // Sekmedeki her karede canlandırmanın durgun bir anı; dokununca kart açılıp oynar
  function bindPieceTiles() {
    for (const b of $('trophyList').querySelectorAll('.piece-tile')) {
      const p = PCS.PIECES.find(q => q.id === b.dataset.piece);
      PCS.drawDemo(b.querySelector('canvas').getContext('2d'), p.id, 1800, tr);
      if (!b.disabled) b.onclick = () => { Sound.tap(); pieceQueue = [p]; showPieceCard(true); };
    }
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
      keyFly: [], keyPulse: null, loot: null, lootInAir: 0, coinMult: 1, kicks: [], kickEnd: null, springSpot: {}, ratchetDeny: {}, pearlAt: {}, shellHalves: [], chainCut: {}, chainSide: {}, chainTold: false, slide: null, slid: false,
      flash: {}, bombs: 0, beams: [], vortex: [], boilFuse: {}, steam: [], bossFuse: {}, armorHold: {}, plateHit: {}, iceHold: {}, iceCrack: {}, tokenFly: [], swT0: 0, phT0: 0, turn: null,
      coinsTaken: 0, limit: tut == null ? moveLimit(def.par || 5, preview || (levelNo ? srcOf(levelNo) : 0)) : Infinity,
      auto: null, help: { lastAct: performance.now(), shown: false }, usedHint: false, extra: 0, preview,
    });
    $('nudge').classList.remove('pulse');
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
    $('rainBtn').hidden = true;
    $('game').classList.toggle('tutorial', tut != null);
    renderMeter(true);
    updateHud();
    music.mode(rain ? 'rain' : S.L.bosses.length ? 'boss' : null);
    syncMusic(); // yeni bölüm: müzik baştan, yalnız pad ve bas (Altın Yağmuru'nda kesintisiz sürer)
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
    tries = n === triesOf ? tries + 1 : 1; triesOf = n;
    startDef(def, n, null);
    maybeWorldCard(n);
    maybePieceCard(def);
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
    $('levelLabel').textContent = rain ? tr('Altın Yağmuru')
      : challenge ? tr('Meydan Okuma {n}', { n: challenge.k }) + ' · ' + tr('çok zor, isteğe bağlı')
      : S.tut != null ? tr('Nasıl oynanır')
      : S.preview ? tr('Önizleme') + ' · ' + tr(S.def.title || S.def.name)
      : tr('Seviye {n}', { n: S.levelNo }) + ' · ' + (S.def.name ? tr(S.def.name) : W.GATES[W.gateOf(S.levelNo) - 1].name);
    const left = S.limit - S.moves;
    $('movesNum').textContent = rain ? Math.max(0, Math.ceil((rain.end - performance.now()) / 1000)) : S.tut != null ? S.moves : left;
    $('movesLbl').textContent = rain ? tr('saniye') : S.tut != null ? tr('hamle') : tr('hamle kaldı');
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
    // Hamlenin kurtardıkları uçar, sonra motor halkalar birer adım döner (dönüşleri tekmeler arasında gelir)
    const { mask, waves, kicks, tokens, blasts, portals, fuses, angles, left } = afterMove(S.L, S.angles, S.mask, S.left, S.ph);
    const now = performance.now();
    const finale = mask === S.L.full && !S.won;
    // Dalgaların başlama anı: yaylı halka tekme attıysa sonraki dalga tekmenin dönüşünü,
    // bomba patladıysa patlamayı bekler
    const at = [];
    waves.reduce((t, _, w) => {
      at[w] = t;
      // renk bombasında vurulanlar şeritlerin hepsi varınca uçar
      const beams = Math.max(0, ...blasts[w].map(b => (b.paint == null ? 0 : BEAM_MS + BEAM_GAP * (b.hits.length - 1))));
      return t + Math.max(kicks[w].length ? KICK_WAIT + KICK_MS : WAVE_MS, blasts[w].length ? BLAST_WAIT + BLAST_HOLD + beams : 0) +
        (waves[w].some(isShell) ? PEARL_MS : 0) +
        (fuses[w].length ? FUSE_WAIT + (fuses[w].some(i => S.L.rings[i].boss) ? BOSS_MS : FUSE_MS) : 0);
    }, 0);
    // Son halka: sahne bir an donar (hit-stop), sonra parlama ve ağır çekimde uçuş
    if (finale && waves.length && !REDUCED && !rain) {
      at[waves.length - 1] += HITSTOP_MS;
      // donma anında kamera bir tık daha yaklaşır; son halka uçunca gerilim sıfırlanır ve kamera geri sıçrar
      setTimeout(() => { if (S.won) $('game').style.setProperty('--zoom', '1.06'); }, Math.max(0, at[waves.length - 1] - HITSTOP_MS));
    }
    // Bomba patlar: vurulan halkalar parlar ve sonraki dalgada bombadan uzağa dönerek uçar
    const blastFrom = {};
    // Kazan: basıncı dolunca düdük öter, kazan akkor parlar; sonraki dalgada çıkıp bomba gibi patlar
    let boiled = -1, boils = 0;
    fuses.forEach((fs, w) => {
      for (const i of fs) {
        const L0 = S.L;
        if (S.L.rings[i].boss) {
          // Dev Halka: zırhı bitti; ağırlaşır (yükselen ses, sarsıntı, can çubuğu yanıp söner), sonraki dalgada parçalanır
          setTimeout(() => { if (S.L === L0) { S.bossFuse[i] = performance.now(); Sound.riser(); } }, at[w] + FUSE_WAIT);
          continue;
        }
        boiled = i; boils++;
        setTimeout(() => { if (S.L === L0) { S.boilFuse[i] = performance.now(); Sound.whistle(); } }, at[w] + FUSE_WAIT);
      }
    });
    // Dev Halka: dalga dalga zırh plakası kırılır (çizimde kırılma anına dek eski plaka sayısı kalır)
    let bossDown = -1;
    if (S.L.bosses.length) {
      const L0 = S.L;
      let m = S.mask;
      waves.forEach((wave, w) => {
        const was = L0.bosses.map(i => armorLeft(L0, i, m));
        for (const i of wave) m |= 1 << i;
        L0.bosses.forEach((i, k) => {
          if (wave.includes(i)) { bossDown = i; setTimeout(() => { if (S.L === L0) bossBreak(i); }, at[w]); return; }
          if (m & (1 << i)) return;
          const left = armorLeft(L0, i, m);
          if (left === was[k]) return;
          (S.armorHold[i] = S.armorHold[i] || []).push({ left: was[k], until: now + at[w] });
          setTimeout(() => { if (S.L === L0) plateBreak(i); }, at[w]);
        });
      });
    }
    // Portal: kurtulan halkanın ikizi sonraki dalgada yerinde dönerek girdaba çekilir
    const teleOf = {};
    portals.forEach((ps, w) => {
      for (const p of ps) {
        teleOf[p.to] = p.from;
        setTimeout(() => portalOpen(p.to), at[w] + 60);
      }
    });
    let bangs = 0, popped = -1;
    blasts.forEach((bs, w) => {
      for (const b of bs) {
        for (const h of b.hits) blastFrom[h] = b.from;
        const k = bangs++;
        if (b.paint != null) popped = b.from;
        setTimeout(() => (b.paint == null ? bombBlast(b, k) : colorBlast(b, k)), at[w] + BLAST_WAIT);
      }
    });
    S.bombs = bangs;
    // Motor döndükten sonraki dalgalarda kurtulanlar "tam zamanında" kurtuldu
    const motorAt = kicks.findIndex(ks => ks.some(k => k.motor));
    const onTime = motorAt < 0 ? [] : waves.slice(motorAt + 1).flat();
    // Buz halkalar dalga dalga çatlar: çizimde eski kat sayısı çatlama anına dek kalır
    let melted = -1, cracks = 0;
    if (S.L.hasIce) {
      const L0 = S.L;
      let m = S.mask;
      waves.forEach((wave, w) => {
        const was = L0.rings.map((_, i) => iceLeft(L0, i, m));
        for (const i of wave) m |= 1 << i;
        L0.rings.forEach((r, i) => {
          if (!was[i] || (m & (1 << i))) return;
          const left = iceLeft(L0, i, m);
          if (left === was[i]) return;
          (S.iceHold[i] = S.iceHold[i] || []).push({ left: was[i], until: now + at[w] });
          if (!left) melted = i;
          cracks++;
          setTimeout(() => { if (S.L === L0) iceCrack(i, !left); }, at[w]);
        });
      });
    }
    let before = S.angles;
    kicks.forEach((ks, w) => {
      for (const k of ks) {
        S.kicks.push({ ring: k.target, delta: k.turn, t0: now + at[w] + KICK_WAIT, done: 0 });
        if (k.motor) setTimeout(() => Sound.gear(), at[w] + KICK_WAIT);
        else setTimeout(() => { Sound.boing(); kickSpark(k.from, k.target); }, at[w] + KICK_WAIT);
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
          if (blastFrom[i] != null) { const B = S.L.rings[blastFrom[i]]; dx = r.x - B.x; dy = r.y - B.y; }
          else if (wave.includes(S.L.chainMate[i])) { const M = S.L.rings[S.L.chainMate[i]]; dx = (r.x + M.x) / 2 - BOARD.w / 2; dy = (r.y + M.y) / 2 - BOARD.h / 2; }
          const len = Math.hypot(dx, dy);
          if (len < 1) { dx = 0; dy = -1; } else { dx /= len; dy /= len; }
        }
        S.fly[i] = { t0: now + at[w], dx, dy, spin: blastFrom[i] != null ? (Math.random() < 0.5 ? -2.5 : 2.5) : 0, tele: teleOf[i] != null, slow: last && !REDUCED && !rain };
        setTimeout(() => { Sound.pop(w); burst(i, last); }, at[w]);
      }
    });
    // İstiridye uçarken kapakları ayrılır, inci yerinde belirip büyür (çizim pearlAt anına dek saklı inciyi gösterir)
    let pearled = -1, caught = -1;
    waves.forEach((wave, w) => {
      for (const s of wave.filter(isShell)) {
        S.L.shellOf.forEach((k, p) => {
          if (k !== s) return;
          S.pearlAt[p] = now + at[w] + 80;
          pearled = p;
          if (waves.slice(w + 1).some(v => v.includes(p))) caught = p;
        });
        setTimeout(() => { S.shellHalves.push({ ring: s, t0: performance.now() }); Sound.pearl(); }, at[w] + 60);
      }
    });
    // Kayarak kurtulan raylı halka
    const railed = S.slid ? waves.flat().find(i => S.L.rings[i].rail) ?? -1 : -1;
    S.slid = false;
    // Zincirli ikizler birlikte uçar; biri zorla tek başına giderse zincir kopar
    let twinned = -1;
    waves.forEach((wave, w) => {
      for (const i of wave) {
        const m = S.L.chainMate[i];
        if (m < 0 || S.mask & (1 << m)) continue;
        if (wave.includes(m)) { if (i < m) { twinned = i; setTimeout(() => Sound.twins(), at[w]); } continue; }
        S.chainCut[Math.min(i, m)] = now + at[w];
      }
    });
    if (!waves.length && S.L.chainMate.some((m, i) => waiting(i))) {
      Sound.chain();
      if (!S.chainTold) { S.chainTold = true; showTip(tr('Zincirli halka eşini bekliyor: eşini de serbest bırak')); }
    }
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
    // müzik: kurtulanların notaları, boşalan tahtaya göre katmanlar, son halkada çözülüş
    music.free(freed.length);
    music.progress(S.L.rings.filter((_, i) => mask & (1 << i)).length / S.L.rings.length);
    if (finale && !rain) music.resolve(); // Altın Yağmuru tahtalar arasında durmaz, süre bitince çözülür
    if (!S.preview && S.tut == null) {
      setTimeout(() => addCombo(freed.length), at[Math.max(0, waves.length - 1)] + 200);
      stat('bombs', bangs); stat('iceCracks', cracks); stat('boilers', boils); stat('teleports', Object.keys(teleOf).length);
      if (bossDown >= 0) stat('bosses');
    }
    // Son hamlede bölüm sonu övgüsü varsa zincir yalnızca sayılır, iki övgü üst üste binmez
    const endWord = finale ? endPraise() : null;
    const teled = Object.keys(teleOf).map(Number);
    const word = bossDown >= 0 ? 'boss' : popped >= 0 ? 'paint' : twinned >= 0 ? 'twins' : railed >= 0 ? 'rail' : caught >= 0 ? 'catch' : pearled >= 0 ? 'pearl' : melted >= 0 ? 'ice' : boiled >= 0 ? 'boil' : teled.length ? 'tele' : onTime.length ? 'time' : null;
    if (freed.length >= 2) setTimeout(() => showChain(freed, !!endWord, bangs, word), at[waves.length - 1]);
    else if (word && !endWord) setTimeout(() => showWord(word === 'boss' ? bossDown : word === 'twins' ? twinned : word === 'rail' ? railed : word === 'catch' ? caught : word === 'pearl' ? pearled : word === 'ice' ? melted : word === 'boil' ? boiled : word === 'tele' ? teled[0] : onTime[0], word), at[waves.length - 1]);
    if (endWord) setTimeout(() => showEndPraise(endWord), at[waves.length - 1] + 260);
    S.mask = mask;
    for (const c of S.coins) {
      if (c.taken) continue;
      const k = c;
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
      else if (loot.type === 'mystery') openMystery(t0);
      else openBulbRing(t0);
    }
    if (waves.length && navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* yok say */ } }
    if (mask === S.L.full && !S.won) {
      S.won = true;
      // Ödül açılıyorsa bölüm sonu ekranı onun ardından gelir
      const lootEnd = loot && loot.t0 != null ? loot.t0 + (loot.type === 'chest' ? CHEST_SHAKE_MS + 750 : TOKEN_MS + 500) - now : 0;
      setTimeout(showWin, rain ? at[waves.length - 1] + WAVE_MS + FLY_MS : Math.max(at[waves.length - 1] + WAVE_MS + FLY_MS * SLOW_K + (fxOn() ? 350 : 0), lootEnd));
    }
    updateHud();
  }

  // ---- Altınlar ----
  // Rastgele birkaç kesişimin ortasına (iki halkanın ortak alanına) altın koyar.
  function placeCoins() {
    const L = S.L;
    const order = L.links.map((_, i) => i).sort(() => Math.random() - 0.5);
    const want = Math.min(L.links.length, rain ? RAIN_COINS : S.loot && S.loot.type === 'gold' ? R.LOOT.goldCoins
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
      // saklı incinin kesişimine altın konmaz (görünmeyen halkada asılı kalırdı)
      if (L.rings[k.a].kind !== 'ring' || L.rings[k.b].kind !== 'ring' || k.pts.length < 2 || L.shellOf[k.a] >= 0 || L.shellOf[k.b] >= 0 || L.rings[k.a].rail || L.rings[k.b].rail) continue;
      if (L.table && (L.table.carried.includes(k.a) || L.table.carried.includes(k.b))) continue;
      const x = (k.pts[0].x + k.pts[1].x) / 2;
      const y = (k.pts[0].y + k.pts[1].y) / 2;
      const clear = L.rings.every((r, i) => i === k.a || i === k.b ||
        (r.kind !== 'ring' ? pieceDist(x, y, r) > 18 : Math.abs(Math.hypot(x - r.x, y - r.y) - r.r) > 18));
      const offMark = marks.every(m => Math.hypot(m.x - x, m.y - y) > 30) &&
        (!S.loot || Math.hypot(S.loot.x - x, S.loot.y - y) > 46);
      if (clear && offMark && !out.some(c => Math.hypot(c.x - x, c.y - y) < 30)) {
        out.push({ a: k.a, b: k.b, x, y, taken: false, phase: Math.random() * TAU });
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

  // Gizem halka: kurtulunca rastgele ödül; çoğunlukla 5-10 altın, bazen ampul, nadiren 20 altın. Bölüm başına bir kez.
  function openMystery(t0) {
    const c = S.loot;
    c.t0 = t0;
    const roll = Math.random();
    if (roll < 0.25) c.bulbs = 1;
    else c.coins = roll < 0.9 ? 5 + Math.floor(Math.random() * 6) : 20;
    progress.loot[idOf(S.levelNo)] = 'mystery';
    stat('mysteries');
    progress.coins += c.coins;
    progress.hints += c.bulbs;
    stat('coinsTotal', c.coins);
    S.lootInAir = c.coins;
    bulbsInAir += c.bulbs;
    saveProgress();
    setTimeout(() => {
      if (S.loot !== c) return;
      Sound.chestOpen(c.coins >= 20 ? 'epic' : 'rare');
      lootBurst(c, '#c9a7ff', 46);
      const p = boardToApp(c.x, c.y), w = $('app').clientWidth;
      floaters.push({ text: tr('Gizem halka') + '!', sub: c.bulbs ? tr('+{n} ampul', { n: c.bulbs }) : tr('+{n} altın', { n: c.coins }),
        x: Math.max(110, Math.min(w - 110, p.x)), y: p.y, t0: performance.now(), size: 34, colors: ['#ffffff', '#c9a7ff'], life: 1500 });
      if (c.coins) lootCoins(c, p);
      if (c.bulbs) setTimeout(() => flyBulbs(c.bulbs, p.x, p.y, true), 300);
      awardBadges(false);
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
  // Gizem halka: mor küre, ortasında sallanan soru işareti
  function drawMysteryToken(x, y, s, now) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    const g = ctx.createRadialGradient(-4, -4, 1, 0, 0, 13);
    g.addColorStop(0, '#e9dcff'); g.addColorStop(1, '#7a52d6');
    ctx.fillStyle = g; ctx.strokeStyle = '#3d2580'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.rotate(REDUCED ? 0 : Math.sin(now / 300) * 0.15);
    ctx.fillStyle = '#fff'; ctx.font = '900 16px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 1);
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
    const color = c.type === 'gold' ? '#ffc94a' : c.type === 'mystery' ? '#c9a7ff' : '#fff3b0';
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
    if (c.type === 'gold') drawGoldToken(x, y, s, now);
    else if (c.type === 'mystery') drawMysteryToken(x, y, s, now);
    else drawBulbToken(x, y, s);
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

  // Son halka: büyük patlama sesi (zincirin 3. kademesi, tepe parıltılı), şok dalgası, beyaz parlama ve tahtada kısa bir sarsıntı
  function finaleBlast(wave) {
    Sound.bang(2);
    if (fxOn()) flashT = performance.now();
    if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) { /* yok say */ } }
    if (!fxOn()) return;
    const c = waveCenter(wave);
    shocks.push({ ...boardToApp(c.x, c.y), t0: performance.now() });
    const wrap = canvas.parentElement;
    wrap.classList.remove('quake'); void wrap.offsetWidth; wrap.classList.add('quake');
  }

  // Bomba patladı (k: bu hamlede kaçıncı patlama): ses, titreşim, şok dalgası, kor parçaları, sarsıntı;
  // vurulan halkalar bir an beyaz parlar
  function bombBlast(b, k) {
    const r = S.L.rings[b.from], t0 = performance.now();
    Sound.bang(k);
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* yok say */ } }
    for (const h of b.hits) S.flash[h] = t0;
    if (REDUCED) return;
    for (let q = 0; q < 34; q++) {
      const a = Math.random() * TAU, sp = 2 + Math.random() * 5;
      particles.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, size: 2 + Math.random() * 3.5,
        color: ['#ffd34a', '#ff7a45', '#ffffff', '#ff5a3d'][q % 4] });
    }
    if (!fxOn()) return;
    shocks.push({ ...boardToApp(r.x, r.y), t0 });
    const wrap = canvas.parentElement;
    wrap.classList.remove('quake'); void wrap.offsetWidth; wrap.classList.add('quake');
  }

  // Renk bombası patladı (k: bu hamlede kaçıncı patlama): şeker patlar, aynı renkteki her halkaya arka arkaya bir şerit
  // uzanır; şerit varınca halka parlar, çınlar ve serpinti saçar (vurulanlar şeritlerin hepsi varınca uçar)
  function colorBlast(b, k) {
    const r = S.L.rings[b.from], t0 = performance.now(), color = ringColor(b.from), L0 = S.L;
    Sound.bang(k); Sound.candy(b.hits.length, b.paint);
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* yok say */ } }
    b.hits.forEach((h, n) => {
      const at = BEAM_GAP * n + BEAM_MS;
      S.flash[h] = t0 + at;
      S.beams.push({ x: r.x, y: r.y, to: h, t0: t0 + BEAM_GAP * n, bend: (n % 2 ? -1 : 1) * 0.18, color });
      if (!REDUCED) setTimeout(() => { if (S.L === L0) sprinkle(L0.rings[h], color, 14); }, at);
    });
    if (REDUCED) return;
    sprinkle(r, color, 30);
    if (fxOn()) shocks.push({ ...boardToApp(r.x, r.y), t0 });
  }
  function sprinkle(r, color, n) {
    for (let q = 0; q < n; q++) {
      const a = Math.random() * TAU, sp = 1.5 + Math.random() * 4;
      particles.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 1, size: 3 + Math.random() * 2,
        color: q % 3 ? color : '#ffffff', shape: 'sprinkle', rot: Math.random() * TAU });
    }
  }

  // Buz çatladı (melt: tamamen eridi): cam sesi, saçılan buz kırıkları; kabuk ve rozet bir an kabarır
  function iceCrack(i, melt) {
    const r = S.L.rings[i];
    S.iceCrack[i] = performance.now();
    Sound.crack(melt);
    if (REDUCED) return;
    for (let k = 0; k < (melt ? 30 : 12); k++) {
      const a = Math.random() * TAU, sp = (melt ? 1.6 : 1) * (0.8 + Math.random() * 2);
      particles.push({ x: r.x + Math.cos(a) * r.r, y: r.y + Math.sin(a) * r.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
        life: 1, size: 2.5 + Math.random() * (melt ? 4 : 2.5), color: 'rgba(235,250,255,.95)', shape: 'shard', rot: Math.random() * TAU });
    }
  }
  // ---- Kombo metresi (2.5) ----
  // Zincir (2+ halka) yapan hamle metreyi (halka-1) × seri kadar doldurur; seri art arda zincirde 3'e kadar büyür,
  // zincirsiz hamlede sıfırlanır (metre boşalmaz). Metre dolunca altın patlaması: altınlar metreden kasaya uçar.
  function addCombo(n) {
    if (n >= 2) {
      comboStreak = Math.min(3, comboStreak + 1);
      comboPts += (n - 1) * comboStreak;
    } else comboStreak = 0;
    let bursts = 0;
    while (comboPts >= COMBO_FULL) { comboPts -= COMBO_FULL; bursts++; }
    renderCombo(n >= 2);
    if (n >= 3 || comboStreak >= 2) music.sparkle(n);
    if (bursts) comboBurst(bursts);
  }
  function renderCombo(bump) {
    const el = $('combo');
    el.querySelector('i').style.transform = `scaleX(${Math.round(comboPts / COMBO_FULL * 100) / 100})`;
    $('comboMul').textContent = comboStreak >= 2 ? '×' + comboStreak : '';
    if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }
  function comboBurst(times) {
    const el = $('combo'), r = el.getBoundingClientRect(), ar = $('app').getBoundingClientRect();
    const x = r.left - ar.left + r.width / 2, y = r.top - ar.top + r.height / 2, n = COMBO_COINS * times;
    el.classList.remove('full'); void el.offsetWidth; el.classList.add('full');
    for (let k = 0; k < n; k++) coinFly.push({ x: x + (k - n / 2) * 8, y, t0: performance.now() + k * 110 });
    for (let k = 0; k < 18; k++) {
      const a = Math.random() * TAU, sp = 2 + Math.random() * 4;
      confetti.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, w: 2.5, color: k % 2 ? '#ffd54a' : '#fff3b0', life: 1, fade: 0.03, g: 0.1, rot: 0, vr: 0 });
    }
    floaters.push({ text: tr('Altın patlaması!'), sub: tr('+{n} altın', { n }), x: $('app').clientWidth / 2, y: y + 70, t0: performance.now(),
      size: 34, colors: ['#fff3b0', '#ffc94a'], life: 1500 });
    Sound.praise(3);
    for (let k = 0; k < n; k++) setTimeout(() => Sound.coin(), COIN_MS + k * 110);
    setTimeout(() => {
      progress.coins += n;
      saveProgress();
      updateHud();
      const pill = $('coinPill');
      pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
    }, COIN_MS + n * 110);
  }

  // ---- Gerilim sahnesi (2.5, bütün bölümlerde) ----
  // Tahtada kalan parça azaldıkça kenarlar kararır, kamera hafifçe yaklaşır; son iki parçada kalanlar titrer ve
  // kalp atışı duyulur. Uçuşu başlamamış parçalar tahtada sayılır. Bölüm bitince kamera geri sıçrar.
  function tensionOf(now) {
    if (!S.L || S.failed || S.tut != null || rain) return 0;
    let total = 0, left = 0;
    for (let i = 0; i < S.L.rings.length; i++) {
      if (!(S.L.full & (1 << i))) continue;
      total++;
      if (present(i) || (S.fly[i] && now < S.fly[i].t0)) left++;
    }
    if (total < 3 || left === 0) return 0;
    const gone = 1 - left / total;
    return Math.min(1, Math.max(left <= 1 ? 1 : left === 2 ? 0.65 : 0, (gone - 0.4) / 0.6 * 0.55));
  }
  function stepTension(now) {
    const T = tensionOf(now);
    if (Math.abs(T - (S.tension || 0)) > 0.01) {
      S.tension = T;
      const g = $('game');
      g.style.setProperty('--tension', T.toFixed(3));
      g.style.setProperty('--zoom', REDUCED ? 1 : (1 + 0.035 * T).toFixed(4));
      if (T >= 0.65) S.heart = { next: now + 350, n: 0 }; else S.heart = null;
    }
    // Kalp atışı: son parçalarda, oyuncu beklerken en çok altı kez
    const h = S.heart;
    if (h && now >= h.next && h.n < 6 && !S.won && !S.kicks.length && !S.auto) { Sound.heart(); h.n++; h.next = now + 1050; }
  }

  // Parça övgüleri: buz eridi ("Buz kırıldı!"), motor döndükten sonra kurtuldu ("Tam zamanında!")
  const WORD = {
    ice: { text: 'Buz kırıldı!', colors: ['#ffffff', '#9be7ff'] },
    time: { text: 'Tam zamanında!', colors: ['#fff4e6', '#ffb35c'] },
    tele: { text: 'Işınlandı!', colors: ['#ffffff', '#c9a7ff'] },
    boil: { text: 'Kazan patladı!', colors: ['#fff3b0', '#ff5a28'] },
    boss: { text: 'Dev Halka yenildi!', colors: ['#ffffff', '#ff6b6b'] },
    paint: { text: 'Renk patlaması!', colors: ['#fff0f7', '#ff6fc0'] },
    pearl: { text: 'İnci belirdi!', colors: ['#ffffff', '#d8cfe6'] },
    catch: { text: 'İnci avcısı!', colors: ['#ffffff', '#ffcf7a'] },
    twins: { text: 'İkizler birlikte!', colors: ['#d9fff6', '#2dd4bf'] },
    rail: { text: 'Tam durağında!', colors: ['#ffffff', '#7fd0ff'] },
  };
  // Tek halkalık hamlede: halkanın üstünde parçanın övgüsü
  function showWord(i, word) {
    if (S.tut != null) return;
    const r = S.L.rings[i], p = boardToApp(r.x, r.y);
    const w = $('app').clientWidth;
    floaters.push({ text: tr(WORD[word].text), x: Math.max(110, Math.min(w - 110, p.x)), y: p.y, t0: performance.now(),
      size: PRAISE[1].size, colors: WORD[word].colors, life: 1300 });
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
  // bangs: hamlede patlayan bomba sayısı (iki ve üstü "Zincirleme!", tek bombayla 5+ halka "Büyük patlama!")
  // word: bu hamlenin parça övgüsü (WORD; bomba yoksa genel övgünün yerine geçer)
  function showChain(freed, quiet, bangs = 0, word = null) {
    if (S.tut != null) return;
    const n = freed.length;
    const c = waveCenter(freed);
    const p = boardToApp(c.x, c.y);
    const w = $('app').clientWidth;
    const x = Math.max(110, Math.min(w - 110, p.x));
    if (!quiet) {
      const tier = n >= 4 || bangs >= 2 ? 3 : n === 3 ? 2 : 1;
      const pr = PRAISE[tier];
      // tek renk bombası "Büyük patlama" yerine kendi övgüsünü alır
      const big = bangs >= 2 || (bangs && n >= 5 && word !== 'paint');
      const text = bangs >= 2 ? tr('Zincirleme!') : big ? tr('Büyük patlama!') : word ? tr(WORD[word].text) : praiseWord(pr.words);
      const sub = bangs >= 2 ? tr('{b} patlama · Zincir ×{n}', { b: bangs, n }) : tr('Zincir ×{n}', { n });
      floaters.push({ text, sub, x, y: p.y, t0: performance.now(),
        size: pr.size, colors: word && !big ? WORD[word].colors : bangs ? ['#fff3b0', '#ff7a45'] : pr.colors, life: 1500 });
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
    if (rain || S.tut != null || S.extra) return null;
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
    if (rain) { rainBoardDone(); return; }
    if (S.tut != null) { showTutorialWin(); return; }
    if (S.preview) { showPreviewWin(); return; }
    if (challenge) { showChallengeWin(); return; }
    const par = S.def.par ?? S.moves;
    const stars = S.extra ? 1 : starsFor(S.moves, par);
    const key = idOf(S.levelNo);
    const firstClear = !progress.stars[key];
    if (stars > (progress.stars[key] || 0)) lastWon = S.levelNo;
    progress.stars[key] = Math.max(progress.stars[key] || 0, stars);
    let earned = S.coins.filter(c => c.taken).length * S.coinMult;
    if (S.coinMult > 1) progress.loot[key] = 'gold';
    // Kusursuz seri (2.5): üst üste en iyi hamleyle ve ipucusuz biten bölümlerde altın 3. bölümden ×2, 6.dan ×3;
    // seri bozulunca yalnız sıfırlanır
    const flawless = !S.extra && !S.usedHint && S.moves <= par;
    progress.streakPerfect = flawless ? (progress.streakPerfect || 0) + 1 : 0;
    const streakMult = progress.streakPerfect >= 6 ? 3 : progress.streakPerfect >= 3 ? 2 : 1;
    progress.stats.bestStreak = Math.max(progress.stats.bestStreak || 0, progress.streakPerfect);
    if (progress.streakPerfect === 3 || progress.streakPerfect === 6) music.jingle(); // altın çarpanı arttı
    if (!S.extra && S.moves >= S.limit) stat('lastBreath');
    if (tries >= 5) stat('patient');
    const streakBonus = earned * (streakMult - 1);
    earned += streakBonus;
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
      (progress.streakPerfect >= 2 ? `<span class="chip streak-chip">${tr('Kusursuz seri {n}', { n: progress.streakPerfect })}${streakMult > 1 ? `: <b>${tr('altınlar ×{n}', { n: streakMult })}${streakBonus ? ' (+' + streakBonus + ')' : ''}</b>` : ''}</span>` : '') +
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
    // Kapının 5. bölümünden sonra, kapı başına bir kez: isteğe bağlı Altın Yağmuru
    $('rainBtn').hidden = !(W.posInGate(S.levelNo) === 5 && !progress.rewards['rain:' + g]);
    $('win').classList.remove('hidden');
    Sound.win();
    for (let k = 1; k <= stars; k++) setTimeout(() => Sound.star(k), 400 + k * 180);
    if (stars === 3) setTimeout(perfectWave, 400 + 3 * 180 + 120);
    launchConfetti(stars);
    updateHud();
    setTimeout(() => awardBadges(false), 1500);
  }

  // ---- Meydan okuma: 20k. bölümün kapısında açılır; tahtada altın ve sandık yok, hamle hakkı en iyi çözüm + 1 ----
  function startChallenge(k) {
    const def = getLevel(bonusSrc(k)), back = k * BONUS.every;
    challenge = { k };
    applyWorld(W.worldOfGate(W.gateOf(back)));
    startDef(def, back, null);
    Object.assign(S, { loot: null, coins: [], limit: def.par + BONUS.slack });
    hideTip();
    updateHud();
  }
  function showChallengeWin() {
    const stars = starsFor(S.moves, S.def.par), first = !progress.bonus[challenge.k];
    progress.bonus[challenge.k] = Math.max(progress.bonus[challenge.k] || 0, stars);
    const coins = first ? ECO.bonusCoins : 0;
    if (coins) { progress.coins += coins; stat('coinsTotal', coins); }
    saveProgress();
    $('winRewards').innerHTML = coins ? `<span class="chip loot-chip gold">${tr('Meydan Okuma ödülü')}: <b>${tr('+{n} altın', { n: coins })}</b></span>` : '';
    $('winCoins').textContent = '+' + coins;
    $('winScore').textContent = '+0';
    const card = $('win').querySelector('.card');
    card.classList.remove('tut');
    card.classList.toggle('perfect', stars === 3 && fxOn());
    $('winLevel').textContent = tr('Meydan Okuma {n} tamamlandı', { n: challenge.k });
    $('winTitle').textContent = stars === 3 ? tr('Mükemmel!') : stars === 2 ? tr('Harika!') : tr('Başardın!');
    $('stars').innerHTML = [1, 2, 3].map(i => `<span class="star-ico${i <= stars ? '' : ' off'}" style="animation-delay:${200 + i * 180}ms"></span>`).join('');
    $('winMoves').textContent = S.moves;
    $('winPar').textContent = S.def.par;
    $('continue').textContent = tr('Haritaya dön');
    $('rainBtn').hidden = true;
    $('win').classList.remove('hidden');
    Sound.win();
    for (let i = 1; i <= stars; i++) setTimeout(() => Sound.star(i), 400 + i * 180);
    launchConfetti(stars);
    updateHud();
  }

  // ---- Altın Yağmuru (2.5, bütün kapılarda) ----
  // 30 saniye boyunca art arda kolay, altınla dolu tahtalar gelir. Hamle sınırı ve kaybetmek yok; ipuçları ücretsiz.
  // Tahta bitince altınlar hemen kasaya geçer; süre dolunca özet çıkar ve kalınan yerden devam edilir.
  const RAIN_LAYOUTS = [
    [[-56, 0, 70], [56, 0, 70]],
    [[0, -58, 64], [-60, 44, 64], [60, 44, 64]],
    [[-90, 0, 58], [0, 0, 58], [90, 0, 58]],
    [[0, 0, 62], [0, -90, 50], [0, 90, 50], [-90, 0, 50], [90, 0, 50]],
  ];
  function makeRainBoard() {
    const Lg = window.RingLogic;
    for (let tries = 0; tries < 200; tries++) {
      const lay = RAIN_LAYOUTS[Math.floor(Math.random() * RAIN_LAYOUTS.length)];
      const def = { name: '', rings: lay.map(([x, y, r]) => ({ x: BOARD.w / 2 + x, y: BOARD.h / 2 + y, r, a: 15 * Math.floor(Math.random() * 24) })) };
      const L = buildLevel(def);
      if (Lg.cascade(L, L.startAngles, 0).mask) continue;
      const sol = solveFast(L, L.startAngles, 0, 4000);
      if (!sol || sol.moves > 2) continue;
      def.par = sol.moves;
      return def;
    }
    return null;
  }
  function startRain() {
    const g = W.gateOf(S.levelNo);
    progress.rewards['rain:' + g] = true;
    saveProgress();
    rain = { gate: g, end: performance.now() + RAIN_MS + 600, total: 0, boards: 0, back: S.levelNo, shown: -1 };
    $('win').classList.add('hidden');
    $('game').classList.add('rain');
    Sound.praise(3);
    nextRainBoard();
  }
  function nextRainBoard() {
    const def = makeRainBoard();
    if (!def) { endRain(); return; }
    startDef(def, 0, null);
    S.limit = Infinity;
    updateHud();
    // tahtanın üstünden dökülen altınlar
    if (!REDUCED) {
      const w = $('app').clientWidth;
      for (let k = 0; k < 10; k++) confetti.push({ kind: 'coin', x: Math.random() * w, y: -20 - Math.random() * 80, vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 2, size: 8 + Math.random() * 4, rot: Math.random() * TAU, vr: 0.15, life: 1, fade: 0.006, g: 0.12 });
    }
  }
  function rainBoardDone() {
    const earned = S.coins.filter(c => c.taken).length * S.coinMult;
    progress.coins += earned;
    stat('coinsTotal', earned);
    S.coins.forEach(c => { c.taken = false; });
    S.coinsTaken = 0;
    rain.total += earned; rain.boards++;
    saveProgress();
    if (performance.now() < rain.end) nextRainBoard(); else endRain();
  }
  // Süre dolunca: yarım kalan tahtanın toplanmış altınları da sayılır, özet çıkar
  function endRain() {
    if (!rain) return;
    stat('rains');
    if (S.coins) {
      const part = S.coins.filter(c => c.taken).length * S.coinMult;
      if (part) { progress.coins += part; stat('coinsTotal', part); rain.total += part; S.coins.forEach(c => { c.taken = false; }); S.coinsTaken = 0; saveProgress(); }
    }
    S.won = true;
    music.resolve(); music.jingle();
    $('rainTotal').textContent = '+' + rain.total;
    $('rainBoards').textContent = tr('{n} tahta temizlendi', { n: rain.boards });
    $('rainEnd').classList.remove('hidden');
    Sound.win();
    launchConfetti(3);
    updateHud();
  }
  function stepRain(now) {
    if (!rain || !$('rainEnd').classList.contains('hidden')) return;
    const left = Math.max(0, Math.ceil((rain.end - now) / 1000));
    if (left !== rain.shown) {
      rain.shown = left;
      $('movesNum').textContent = Math.min(left, RAIN_MS / 1000);
      $('movesNum').classList.toggle('warn', left <= 5);
      if (left <= 5 && left > 0) Sound.tick();
    }
    // Süre dolduğunda tahta oynanırken (uçuş yoksa) yağmur biter; bitmekte olan tahta önce sayılır
    if (left === 0 && !S.won && !Object.values(S.fly).some(f => now < f.t0 + flyMs(f)) && !S.kicks.length) endRain();
  }
  $('rainBtn').onclick = () => { Sound.tap(); startRain(); };
  $('rainGo').onclick = () => {
    Sound.tap();
    const back = rain.back;
    rain = null;
    $('rainEnd').classList.add('hidden');
    $('game').classList.remove('rain');
    if (W.posInGate(back) !== W.GATE_SIZE && back < TOTAL && isUnlocked(back + 1)) loadLevel(back + 1);
    else showScreen('levels');
  };

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
    maybePieceCard(def);
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
    const left = S.L.rings.filter((r, i) => present(i) && r.kind !== 'bar' && !r.fixed).length;
    const can = !challenge && progress.coins >= EXTRA_PRICE;
    $('extraMoves').hidden = !!challenge;
    $('failNote').textContent = left === 1 ? tr('Tek halka kaldı!') : tr('{n} halka kaldı.', { n: left });
    $('extraPrice').textContent = EXTRA_PRICE;
    $('extraMoves').disabled = !can;
    $('extraNote').hidden = can || !!challenge;
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
      if (!present(i) || veiled(i, performance.now())) return;
      const d = r.kind !== 'ring' ? pieceDist(p.x, p.y, r) + 4 : Math.abs(Math.hypot(p.x - r.x, p.y - r.y) - r.r);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  canvas.addEventListener('pointerdown', e => {
    if (S.won || S.failed || S.auto || S.kicks.length || S.turn || S.slide) return;
    S.help.lastAct = performance.now();
    const p = toBoard(e);
    if (S.L.table && Math.hypot(p.x - S.L.table.x, p.y - S.L.table.y) < HUB + 10) { spinTable(); return; }
    if (S.swPos && Math.abs(p.x - S.swPos.x) < SWITCH_W / 2 + 8 && Math.abs(p.y - S.swPos.y) < SWITCH_H / 2 + 8) { flipSwitch(); return; }
    const i = hitRing(p);
    if (i < 0) return;
    if (S.L.rings[i].rail) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sentetik olay */ }
      const r = S.L.rings[i];
      S.drag = { ring: i, rail: S.L.rails.findIndex(R => R.ring === i), grab: { x: p.x - r.x, y: p.y - r.y }, at: { x: r.x, y: r.y } };
      if (S.hint && S.hint.ring === i) S.hint = null;
      return;
    }
    if (!canRotate(S.L, i, S.mask, S.left, S.sw)) {
      for (const k of S.L.group[i]) S.shake[k] = performance.now();
      Sound.deny();
      if (isBar(i)) showTip(tr('Çubuk dönmez: halkaların boşluğunu çubuğa getir'));
      else if (isFrame(i)) showTip(tr('Çerçeve yerinden oynamaz: halkaları etrafından kurtar'));
      else if (S.L.rings[i].boss) showTip(tr('Dev Halka zırhlı: değdiği halkaları kurtar, zırhı kırılsın'));
      else if (S.L.rings[i].motor) showTip(tr('Motor halkayı sen çeviremezsin. Her hamlenden sonra kendisi bir adım döner'));
      else if (iceLeft(S.L, i, S.mask)) showTip(tr('Bu halka donmuş. Değdiği halkalardan birini kurtar, buzu çatlasın'));
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
    if (S.drag.rail != null) { S.drag.at = onRail(S.L.rails[S.drag.rail], { x: p.x - S.drag.grab.x, y: p.y - S.drag.grab.y }); return; }
    const r = S.L.rings[S.drag.ring];
    const ang = Math.atan2(p.y - r.y, p.x - r.x);
    const d = signedDelta(S.drag.lastAng, ang);
    S.drag.lastAng = ang;
    S.drag.total += d;
    if (r.ratchet && S.drag.total * r.ratchet < -12 * DEG) {
      // Cırcır ters yöne dönmez: mandal takılır (bir kez), uygulanan tık da geri alınır
      if (S.drag.applied) { S.angles = rotate(S.L, S.angles, S.drag.ring, -S.drag.applied); S.drag.applied = 0; }
      if (!S.drag.denied) {
        S.drag.denied = true;
        for (const k of S.L.group[S.drag.ring]) S.shake[k] = performance.now();
        S.ratchetDeny[S.drag.ring] = performance.now();
        Sound.deny();
        showTip(tr('Cırcır yalnız okun yönüne döner. Geri dönmek için turu tamamla'));
      }
      return;
    }
    if (r.step) {
      // Tıklı halka parmağı serbestçe izlemez: en yakın tık yerine atlar. Cırcır yalnız yönünde ve en çok bir tık
      const k = Math.round(S.drag.total / r.step);
      const want = (r.ratchet ? (k * r.ratchet > 0 ? r.ratchet : 0) : k) * r.step;
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
    if (drag.rail != null) { endRailDrag(drag); return; }
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
    if (S.mask !== before.mask) $('nudge').classList.remove('pulse');
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
  $('musicVol').oninput = e => { progress.musicVol = Number(e.target.value); music.volume(progress.musicVol / 100); };
  $('musicVol').onchange = saveProgress;
  function renderSettings() {
    $('musicVol').value = progress.musicVol ?? 40;
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
      if (key === 'music') syncMusic();
      Sound.tap();
    };
  }
  $('settingsBtn').onclick = $('homeSettings').onclick = () => {
    Sound.tap();
    renderSettings();
    $('settings').classList.remove('hidden');
  };
  $('settingsClose').onclick = () => { Sound.tap(); $('settings').classList.add('hidden'); };
  const restart = () => (S.tut != null ? loadTutorial(S.tut) : S.preview ? loadPreview(S.preview) : challenge ? startChallenge(challenge.k) : loadLevel(S.levelNo));
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
    if (challenge) { $('win').classList.add('hidden'); showScreen('levels'); return; }
    if (S.tut != null) {
      if (S.tut < TUTORIAL.length - 1) loadTutorial(S.tut + 1);
      else finishTutorial();
      return;
    }
    if (S.preview) { $('win').classList.add('hidden'); showScreen('home'); return; }
    // 200. bölüm ilk kez bitince Büyük Makine (yeni dünyalar açılır), son bölüm ilk kez bitince Yıldız Haritası finali
    if (S.levelNo === MACHINE_END && !progress.rewards.ending) { $('win').classList.add('hidden'); showEnding('machine'); return; }
    if (S.levelNo === TOTAL && TOTAL > MACHINE_END && !progress.rewards[FINALE_KEY]) { $('win').classList.add('hidden'); showEnding('finale'); return; }
    // Kapının finalinden sonra haritaya dönülür: orada yeni kapı açılır
    if (W.posInGate(S.levelNo) !== W.GATE_SIZE && S.levelNo < TOTAL && isUnlocked(S.levelNo + 1)) loadLevel(S.levelNo + 1);
    else { $('win').classList.add('hidden'); showScreen('levels'); }
  };
  // ---- Büyük Makine (200. bölüm) ve Yıldız Haritası (son bölüm): yolculuğun kapanışları ----
  // Büyük Makine: ilk 8 dünyanın halkası dört bir yandan uçup altın merkez halkanın çevresinde makineyi kurar,
  // makine dişliler gibi döner, kıvılcımlar saçılır. Ardından yeni dünyalar açılır.
  // Yıldız Haritası: 12 dünyanın halkası (dünyanın kendi renginde) yıldız çemberine oturur, aralarına takımyıldız
  // çizgileri çekilir, altın merkez halka hepsini döndürür. İkisinde de ardından yolculuğun özeti gelir.
  const MACHINE_END = 20 * W.GATE_SIZE;
  // Final, o anki son bölüme bağlı: oyuna bölüm eklenince yeni sonda yeniden oynar (eski kayıtların 'finale' alanı 300'ündü)
  const FINALE_KEY = 'finale:' + TOTAL;
  const END_RINGS = {
    machine: COLORS.slice(0, 8),
    finale: LIVE_WORLDS.map(w => w.theme.accent),
  };
  let endingRun = null;
  function showEnding(kind, replay) {
    if (!replay) {
      progress.rewards[kind === 'finale' ? FINALE_KEY : 'ending'] = today();
      saveProgress();
    }
    const el = $('ending');
    el.className = 'ending ' + kind;
    el.hidden = false;
    // Büyük Makine yalnız ilk 200 bölümü sayar
    const last = kind === 'finale' ? TOTAL : Math.min(TOTAL, MACHINE_END);
    const nums = ORDER.map((_, i) => i + 1).filter(n => n <= last);
    const shapes = shapeLevels().filter(n => n <= last);
    const earned = Object.keys(progress.badges).length;
    const perfect = nums.filter(n => starsOf(n) === 3).length;
    $('endingEyebrow').textContent = kind === 'finale' ? tr('Üçüncü perde tamam') : tr('İlk 8 dünya tamam');
    $('endingTitle').textContent = kind === 'finale' ? tr('Anka kanatlandı!') : tr('Büyük Makine çalıştı!');
    $('endingLead').textContent = kind === 'finale'
      ? tr('{n} bölümün hepsini bitirdin. Anka\'nın ateşi bütün dünyalara ışık taşıyor.', { n: TOTAL })
      : tr('200 bölümün hepsini bitirdin. Artık bir Halka Ustasısın.');
    $('endingStats').innerHTML = [
      [`${nums.reduce((s, n) => s + starsOf(n), 0)}`, tr('/ {n} yıldız', { n: last * 3 })],
      [`${earned}`, tr('/ {n} rozet', { n: B.BADGES.length })],
      [`${shapes.filter(n => starsOf(n)).length}`, tr('/ {n} şekil', { n: shapes.length })],
      [fmt(progress.stats.coinsTotal || 0), tr('altın')],
    ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
    const missing = last - perfect;
    $('endingMore').textContent = kind === 'machine' && TOTAL > MACHINE_END
      ? tr('Yeni dünyalar açıldı: {names}. Yolculuk sürüyor.', { names: LIVE_WORLDS.slice(8).map(w => tr(w.name)).join(', ') })
      : kind === 'finale' && missing > 0 ? tr('Yolculuk sürüyor: yeni bölümler yolda. {n} bölüm hâlâ 3 yıldızı bekliyor.', { n: missing })
      : missing > 0 ? tr('{n} bölüm hâlâ 3 yıldızı bekliyor. Altın kapılar seni bekliyor.', { n: missing }) : tr('Bütün bölümler 3 yıldız. Sen gerçek bir Halka Ustasısın.');
    $('endingGo').textContent = kind === 'machine' && TOTAL > MACHINE_END ? tr('Yeni dünyalara') : tr('Haritaya dön');
    const quick = REDUCED || !fxOn();
    const t0 = performance.now();
    endingRun = { t0, sparks: [], kind };
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
    const cx = w / 2, cy = h * (run.kind === 'finale' ? 0.3 : 0.34), R = Math.min(w * 0.33, 130), r = R * 0.36;
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
    // Dünya halkaları: dört bir yandan uçup yerine oturur, sonra dişli gibi zıt yönlerde döner.
    // Büyük Makine 8 halka; Yıldız Haritası 12 halka (daha küçük, daha geniş çember) ve aralarında takımyıldız çizgileri.
    const finale = run.kind === 'finale';
    const cols = END_RINGS[finale ? 'finale' : 'machine'], n = cols.length;
    const RR = R, rr = finale ? R * 0.19 : r;
    if (finale) {
      // Arkada göz kırpan yıldızlar (yerleri sabit tohumdan)
      const rnd = window.RingRewards.rng(300);
      for (let k = 0; k < 70; k++) {
        const sx = rnd() * w, sy = rnd() * h * 0.7, ph = rnd() * 6.28;
        g.globalAlpha = Math.min(1, t / 1.5) * (0.35 + 0.35 * Math.sin(t * 2 + ph));
        g.fillStyle = '#fff7d6';
        g.beginPath(); g.arc(sx, sy, rnd() < 0.15 ? 1.8 : 1, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
    const spots = cols.map((_, k) => {
      const a = -Math.PI / 2 + k * 2 * Math.PI / n;
      const p = ease((t - k * (finale ? 0.1 : 0.14)) / 0.9);
      const tx = cx + Math.cos(a) * RR, ty = cy + Math.sin(a) * RR;
      const fx = cx + Math.cos(a) * Math.max(w, h), fy = cy + Math.sin(a) * Math.max(w, h);
      return { a, p, x: fx + (tx - fx) * p, y: fy + (ty - fy) * p };
    });
    if (finale) {
      // Takımyıldız: komşu halkalar ve her üçüncü halka arası çizgiler sırayla çizilir
      const line = ease((t - 2.0) / 1.6);
      if (line > 0) {
        g.save(); g.strokeStyle = 'rgba(255, 247, 214, .45)'; g.lineWidth = 1.5; g.setLineDash([4, 5]);
        const pairs = cols.map((_, k) => [k, (k + 1) % n]).concat(cols.map((_, k) => [k, (k + 4) % n]).filter((_, k) => k % 2 === 0));
        pairs.forEach(([i, j], q) => {
          const f = Math.min(1, Math.max(0, line * pairs.length - q));
          if (f <= 0) return;
          const A = spots[i], Bp = spots[j];
          g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(A.x + (Bp.x - A.x) * f, A.y + (Bp.y - A.y) * f); g.stroke();
        });
        g.restore();
      }
    }
    spots.forEach((s, k) => {
      const spin = run2 * (t - 1.8) * (k % 2 ? -1.6 : 1.6);
      ring(s.x, s.y, rr, cols[k], s.a + spin, finale ? 7 : 9, Math.min(1, s.p * 1.5));
    });
    // Altın merkez halka: halkalar yerleşince belirir, sonra hepsini döndürür
    const core = ease((t - 1.4) / 0.6);
    if (core > 0) ring(cx, cy, R * 0.62 * (0.6 + 0.4 * core), '#ffd36b', -run2 * (t - 1.8) * 0.8, 13, core);
    const rise = finale ? ease((t - 2.2) / 1.4) : 0;
    // kuyruk başlığa binmesin (küçük ekranlarda): kuş halkanın biraz üstünde durur
    if (rise > 0) phoenix(g, cx, cy - R * 0.35 + R * 0.5 * (1 - rise) + Math.sin(t * 2) * 3, R * 0.008 * (0.4 + 0.6 * rise), quick ? 0.4 : Math.sin(t * 5), rise);
    // Kıvılcımlar (finalde Anka'nın kanat uçlarından alev)
    if (run2 > 0 && !quick && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2, wing = rise > 0.5 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      const x = wing ? cx + wing * R * 0.95 : cx + Math.cos(a) * R * 0.62, y = wing ? cy - R * 0.35 : cy + Math.sin(a) * R * 0.62;
      run.sparks.push({ x, y, vx: wing ? wing * Math.random() : Math.cos(a) * (1 + Math.random() * 2.5), vy: wing ? 0.5 + Math.random() : Math.sin(a) * (1 + Math.random() * 2.5), life: 1 });
    }
    run.sparks = run.sparks.filter(s => (s.life -= 0.02) > 0);
    for (const s of run.sparks) {
      s.x += s.vx; s.y += s.vy; s.vy += 0.03;
      g.globalAlpha = s.life; g.fillStyle = s.life > 0.5 ? '#fff3b0' : '#ffb347';
      g.beginPath(); g.arc(s.x, s.y, 2, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }

  // Anka Kuşu (400 finali): alev kanatlar (flap -1..1 çırpış), tepeli baş, üç kuyruk tüyü; s ölçek, 100 birim kanat yarısı
  function phoenix(g, x, y, s, flap, alpha) {
    g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = alpha;
    const flame = (r0, r1) => { const gr = g.createRadialGradient(0, -10, r0, 0, -10, r1); gr.addColorStop(0, '#fff6c2'); gr.addColorStop(0.35, '#ffc94a'); gr.addColorStop(0.7, '#ff7a2e'); gr.addColorStop(1, '#d9342b'); return gr; };
    g.shadowColor = 'rgba(255,150,60,.9)'; g.shadowBlur = 30;
    // kuyruk: üç uzun tüy, uçları kıvrık
    g.fillStyle = flame(5, 120);
    for (const k of [-1, 0, 1]) {
      g.beginPath(); g.moveTo(-6, 10); g.bezierCurveTo(k * 30 - 10, 50, k * 40, 80, k * 52 + 8 * k, 118);
      g.bezierCurveTo(k * 30 + 6, 92, k * 16 + 8, 50, 6, 10); g.closePath(); g.fill();
    }
    // kanatlar: gövdeden açılır, arka kenarı tüy tüy
    for (const side of [-1, 1]) {
      const lift = flap * 26;
      g.beginPath(); g.moveTo(0, -12);
      g.bezierCurveTo(side * 40, -60 - lift, side * 80, -70 - lift, side * 104, -48 - lift * 1.4);
      for (let i = 1; i <= 5; i++) {
        const u = i / 5, ex = side * (104 - u * 92), ey = -48 - lift * 1.4 * (1 - u) + u * 52;
        g.quadraticCurveTo(ex + side * 14, ey - 4, ex, ey + 4);
      }
      g.closePath(); g.fillStyle = flame(10, 110); g.fill();
      g.strokeStyle = 'rgba(255,240,190,.55)'; g.lineWidth = 1.5;
      for (let i = 1; i <= 4; i++) { const u = i / 5; g.beginPath(); g.moveTo(side * 8, -8); g.lineTo(side * (104 - u * 92), -44 - lift * 1.4 * (1 - u) + u * 52); g.stroke(); }
    }
    // gövde ve baş
    g.fillStyle = flame(2, 40);
    g.beginPath(); g.ellipse(0, 0, 12, 24, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(0, -30, 10, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    // tepe alevleri, gaga, göz
    g.fillStyle = '#ffb347';
    for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(k * 4 - 3, -37); g.quadraticCurveTo(k * 10, -52, k * 7 + k * 4, -58 + Math.abs(k) * 6); g.quadraticCurveTo(k * 3 + 2, -46, k * 4 + 3, -37); g.fill(); }
    g.fillStyle = '#ffd36b'; g.beginPath(); g.moveTo(-3, -27); g.lineTo(0, -18); g.lineTo(3, -27); g.closePath(); g.fill();
    g.fillStyle = '#5a1a10'; g.beginPath(); g.arc(-3.5, -32, 1.8, 0, Math.PI * 2); g.arc(3.5, -32, 1.8, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // ---- İpucu: ampul sayacı ve kademeli ipucu ----
  // Dürtme her zaman ücretsiz; İpucu ve Hamleyi yap birer ampul. 1. kapıda ve denemelerde hepsi ücretsiz.
  const hintsFree = () => !!rain || S.tut != null || S.preview != null || W.gateOf(S.levelNo) === 1;

  function renderHintCount() {
    const el = $('hintCount');
    const free = hintsFree();
    const shown = progress.hints - bulbsInAir;
    el.textContent = free ? '∞' : shown;
    el.classList.toggle('empty', !free && shown <= 0);
    $('hint').setAttribute('aria-label', free ? tr('İpucu (ücretsiz)') : tr('İpucu ({n} ampul)', { n: shown }));
    $('autoMove').classList.toggle('locked', !free && shown <= 0);
    $('buyBulb').hidden = free;
  }

  // İpucunun önerdiği hamle: en kısa yolu arayan yavaş arama, olmazsa hızlı arama.
  // Sonuç tahtanın durumuna göre saklanır; ipucu düğmesi nabız atınca arka planda hazırlanır.
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

  // ---- Ampul kazanma: altınla alma, günlük hediye, ödül uçuşu ----
  // Altın yetmiyorsa ne kadar eksik olduğunu söyler
  function buyBulb() {
    if (S.auto) return;
    if (progress.coins < BULB_PRICE) {
      Sound.deny();
      showTip(tr('{n} altın daha topla (sende {have})', { n: BULB_PRICE - progress.coins, have: progress.coins }));
      return;
    }
    progress.coins -= BULB_PRICE;
    progress.hints++;
    progress.bulbsBought = (progress.bulbsBought || 0) + 1;
    saveProgress();
    awardBadges(false);
    Sound.coin();
    const r = $('buyBulb').getBoundingClientRect(), ar = $('app').getBoundingClientRect();
    bulbsInAir++;
    flyBulbs(1, r.left - ar.left + r.width / 2, r.top - ar.top + 30);
    updateHud();
    const pill = $('coinPill');
    pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
  }
  $('buyBulb').onclick = buyBulb;
  $('bulbPrice').innerHTML = `<i class="coin-ico"></i>${BULB_PRICE}`;

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
  function useHint(tier) {
    if (S.won || S.failed || S.auto || S.kicks.length || S.turn || S.slide) return;
    const cost = tier === 'nudge' || hintsFree() ? 0 : 1;
    if (cost > progress.hints) { Sound.deny(); showTip(tr('Ampulün kalmadı. Ücretsiz dürtmeyi dene')); return; }
    const sol = bestMove();
    // Çözüm bulunamazsa ampul harcanmaz
    if (!sol || !sol.first) { showTip(tr('İpucu bulunamadı, yeniden başlatmayı dene')); return; }
    if (cost) {
      progress.hints -= cost;
      saveProgress();
      const el = $('hintCount');
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
    $('nudge').classList.remove('pulse');
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
    } else if (sol.first.rail != null) {
      if (tier === 'move') { S.hint = null; hideTip(); slideTo(sol.first.rail, sol.first.stop); }
      else { S.hint = { ...sol.first, t0: now, nudge: tier === 'nudge' }; showTip(tr('Mavi halkayı parlayan durağa kaydır')); }
    } else if (sol.first.table) {
      if (tier === 'move') { S.hint = null; hideTip(); spinTable(); } else { S.hint = { table: true, ring: -1, t0: now }; showTip(tr('Tablayı çevir')); }
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

  // Her kademe kendi düğmesinde; eğitimde üçü de rehberi gösterir
  for (const [id, tier] of [['nudge', 'nudge'], ['hint', 'hint'], ['autoMove', 'move']]) {
    $(id).onclick = () => {
      if (S.won || S.failed || S.auto || S.kicks.length || S.turn || S.slide) return;
      if (S.tut != null) { guide(); return; }
      useHint(tier);
    };
  }

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
  const springLive = i => present(i) && !S.fly[i] && !(S.turn && S.L.table.carried.includes(i));
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

  // ---- Döner tabla (2.4) ----
  // Tabla dönerken taşınan halkalar göbek etrafında döner, boşlukları da (adım adım) dönerek gelir.
  // Dönüş bitince mantık tablanın sonraki konumuna geçer ve hamle sayılır.
  function tableOffset(now) {
    if (!S.turn) return 0;
    const t = Math.min(1, (now - S.turn.t0) / TURN_MS);
    return (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) * S.L.table.step * DEG;
  }

  function spinTable() {
    if (!S.L.table || S.won || S.failed || S.auto || S.kicks.length || S.turn || S.slide) return;
    const before = snapshot();
    S.turn = { t0: performance.now(), base: S.angles.slice() };
    S.hint = null;
    Sound.turn();
    setTimeout(() => {
      const t = turnTable(S.L, S.turn.base);
      S.L = t.L; S.angles = t.angles; S.turn = null;
      S.springSpot = {}; // rozet ve fiş yerleri yeni konuma göre
      commitMove(before, -1);
    }, REDUCED ? 0 : TURN_MS);
  }

  // Dönüş sırasında taşınan halkaların boşlukları tablayla birlikte döner
  function stepTable(now) {
    if (!S.turn) return;
    const off = tableOffset(now);
    S.angles = S.turn.base.map((a, i) => (S.L.table.carried.includes(i) ? a + off : a));
  }

  // Tabla: koyu disk, kesik kenar, dört çentik; taşınan halkalar göbeğe bir kolla bağlı
  function drawTable(now) {
    const T = S.L.table;
    if (!T) return;
    const off = S.L.tableIdx * T.step * DEG + tableOffset(now);
    ctx.save();
    const g = ctx.createRadialGradient(T.x, T.y - 20, 10, T.x, T.y, T.r);
    g.addColorStop(0, 'rgba(120,96,220,.30)'); g.addColorStop(1, 'rgba(60,44,140,.22)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(T.x, T.y, T.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(195,166,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(T.x, T.y, T.r, off, off + TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(195,166,255,.8)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = off + k * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(T.x + Math.cos(a) * (T.r - 10), T.y + Math.sin(a) * (T.r - 10));
      ctx.lineTo(T.x + Math.cos(a) * (T.r + 4), T.y + Math.sin(a) * (T.r + 4));
      ctx.stroke();
    }
    for (const i of T.carried) {
      if (!present(i) || S.fly[i]) continue;
      const P = ringPose(i, now);
      ctx.strokeStyle = 'rgba(195,166,255,.55)'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(T.x, T.y); ctx.lineTo(P.cx, P.cy); ctx.stroke();
      ctx.fillStyle = TABLE_COLOR; ctx.beginPath(); ctx.arc(P.cx, P.cy, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(P.cx, P.cy, 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // Göbek düğmesi: beyaz disk, içinde saat yönünde iki ok (tabla dönerken oklar da döner)
  function drawHub(now) {
    const T = S.L.table;
    if (!T) return;
    ctx.save();
    ctx.fillStyle = 'rgba(4,3,12,.9)'; ctx.beginPath(); ctx.arc(T.x, T.y + 3, HUB + 2, 0, TAU); ctx.fill();
    ctx.fillStyle = TABLE_COLOR; ctx.beginPath(); ctx.arc(T.x, T.y, HUB, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(T.x, T.y, HUB - 4, 0, TAU); ctx.fill();
    const spin = tableOffset(now);
    ctx.strokeStyle = '#6a4fd0'; ctx.fillStyle = '#6a4fd0'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    for (const base of [0, Math.PI]) {
      const a0 = base + spin - 1.05, a1 = base + spin + 0.75, R = 12;
      ctx.beginPath(); ctx.arc(T.x, T.y, R, a0, a1); ctx.stroke();
      const hx = T.x + Math.cos(a1) * R, hy = T.y + Math.sin(a1) * R, tg = a1 + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(tg) * 6, hy + Math.sin(tg) * 6);
      ctx.lineTo(hx + Math.cos(tg + 2.3) * 5.5, hy + Math.sin(tg + 2.3) * 5.5);
      ctx.lineTo(hx + Math.cos(tg - 2.3) * 5.5, hy + Math.sin(tg - 2.3) * 5.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawHubPulse(now, t0) {
    const T = S.L.table;
    if (!T) return;
    const p = 0.5 + 0.5 * Math.sin((now - t0) / 200);
    ctx.save();
    ctx.strokeStyle = `rgba(255,201,74,${0.5 + 0.5 * p})`; ctx.lineWidth = 4;
    ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(T.x, T.y, HUB + 9 + 4 * p, 0, TAU); ctx.stroke();
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
      for (const r of S.L.table ? [...S.L.rings, S.L.table] : S.L.rings) {
        if (r.kind && r.kind !== 'ring') continue;
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
    if (S.won || S.failed || S.auto || S.kicks.length || S.turn || S.slide) return;
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
    const springAt = r.kick || r.bomb || r.cbomb || r.ice || r.motor || r.ratchet || r.boiler || r.portal >= 0 ? springBadgeAt(i) : null;
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

  // ---- Bomba halka çizimi (2.5) ----
  // Rozet: halkanın en boş yerinde fitili yanan bomba. Bombanın kesiştiği yerlerde dönen turuncu yıldızlar:
  // patlama oradaki halkaları da uçurur.
  function drawBombBadge(s, now) {
    const r = S.L.rings[s], th = springBadgeAt(s);
    const x = r.x + Math.cos(th) * r.r, y = r.y + Math.sin(th) * r.r;
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,20,.9)'; ctx.beginPath(); ctx.arc(x, y + 2, 16, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(x - 5, y - 5, 1, x, y, 14);
    g.addColorStop(0, '#6a6470'); g.addColorStop(1, '#1b1820');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = ringColor(s); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#3a3640'; ctx.fillRect(x + 4, y - 15, 7, 5);
    ctx.strokeStyle = '#d9b48a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + 8, y - 15); ctx.quadraticCurveTo(x + 12, y - 23, x + 17, y - 21); ctx.stroke();
    const fl = REDUCED ? 1 : 0.75 + 0.35 * Math.sin(now / 55) * Math.sin(now / 83);
    const sg = ctx.createRadialGradient(x + 17, y - 21, 0, x + 17, y - 21, 9 * fl);
    sg.addColorStop(0, '#fff'); sg.addColorStop(0.35, '#ffd34a'); sg.addColorStop(1, 'rgba(255,90,61,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x + 17, y - 21, 9 * fl, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // ---- Renk bombası çizimi (2.6) ----
  // Şeker rengi desenle de ayrılır (renk körleri için) ve halkayla döner: çilek noktalı, nane çizgili, limon yıldızlı.
  // Tahtada o rengin renk bombası varsa halka boyunca beyaz bir parıltı kayar: "bunlar onunla gidecek"
  // (açık kesişimin yuvarlak ışığına benzemesin diye ince şerit).
  function sparkle(x, y, s, rot) {
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const rr = k % 2 ? s * 0.32 : s, a = rot + k * Math.PI / 4;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  function drawCandy(i, ang, cx, cy, now) {
    const ring = S.L.rings[i], paint = ring.paint, step = 30 / ring.r, n = Math.floor(TAU / step);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const th = ang + (k + 0.5) * TAU / n;
      if (ring.gaps.some(g => angDist(ang + g, th) < GAP_HALF + 6 / ring.r)) continue;
      const px = cx + Math.cos(th) * ring.r, py = cy + Math.sin(th) * ring.r;
      if (paint === 0) { ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill(); }
      else if (paint === 1) {
        const d = 5 / ring.r;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(th - d) * (ring.r - 5), cy + Math.sin(th - d) * (ring.r - 5));
        ctx.lineTo(cx + Math.cos(th + d) * (ring.r + 5), cy + Math.sin(th + d) * (ring.r + 5));
        ctx.stroke();
      } else sparkle(px, py, 4.6, th);
    }
    const armed = S.L.painted[paint].some(j => S.L.rings[j].cbomb && springLive(j));
    if (armed && springLive(i)) {
      const th = REDUCED ? ang + Math.PI : now / 520 + i * 1.3, len = 0.55;
      if (!ring.gaps.some(g => angDist(ang + g, th) < GAP_HALF + len / 2)) {
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = STROKE - 2;
        ctx.beginPath(); ctx.arc(cx, cy, ring.r, th - len / 2, th + len / 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cx, cy, ring.r, th - len / 3, th + len / 3); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // Rozet: iki ucu bükülmüş sarılı şeker, ortasında rengin deseni; hafifçe nefes alır
  function drawCandyBadge(s, now) {
    const r = S.L.rings[s], th = springBadgeAt(s), color = ringColor(s), paint = r.paint;
    const x = r.x + Math.cos(th) * r.r, y = r.y + Math.sin(th) * r.r;
    const beat = REDUCED ? 1 : 1 + 0.07 * Math.sin(now / 260);
    ctx.save();
    ctx.translate(x, y); ctx.scale(beat, beat); ctx.rotate(-0.35);
    for (const d of [-1, 1]) {
      ctx.fillStyle = 'rgba(10,8,20,.9)';
      ctx.beginPath(); ctx.moveTo(d * 9, 0); ctx.lineTo(d * 25, -10); ctx.lineTo(d * 25, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(d * 10, 0); ctx.lineTo(d * 22, -7.5); ctx.quadraticCurveTo(d * 19, 0, d * 22, 7.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath(); ctx.moveTo(d * 10, 0); ctx.lineTo(d * 22, -7.5); ctx.lineTo(d * 19, -2); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(10,8,20,.9)'; ctx.beginPath(); ctx.arc(0, 1, 14.5, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(-4, -5, 1, 0, 0, 13);
    g.addColorStop(0, '#fff'); g.addColorStop(0.25, color); g.addColorStop(1, color);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 12.5, 0, TAU); ctx.fill();
    ctx.rotate(0.35);
    ctx.fillStyle = 'rgba(10,8,20,.78)'; ctx.strokeStyle = 'rgba(10,8,20,.78)'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    if (paint === 0) for (const [dx, dy] of [[-4, -3], [4, -3], [0, 4]]) { ctx.beginPath(); ctx.arc(dx, dy, 2.3, 0, TAU); ctx.fill(); }
    else if (paint === 1) for (const d of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(d - 3, 6); ctx.lineTo(d + 3, -6); ctx.stroke(); }
    else sparkle(0, 0, 8, 0);
    ctx.restore();
  }
  // Şerit: bombadan vurduğu halkaya eğri bir şeker şeridi uzanır, ucunda parıltı; sonra söner
  function drawBeams(now) {
    S.beams = S.beams.filter(b => now - b.t0 < 700);
    for (const b of S.beams) {
      if (now < b.t0) continue;
      const t = (now - b.t0) / 700, e = 1 - Math.pow(1 - Math.min(1, (now - b.t0) / BEAM_MS), 3), R = S.L.rings[b.to];
      const mx = (b.x + R.x) / 2 + b.bend * (R.y - b.y), my = (b.y + R.y) / 2 - b.bend * (R.x - b.x);
      const at = u => [(1 - u) * (1 - u) * b.x + 2 * u * (1 - u) * mx + u * u * R.x, (1 - u) * (1 - u) * b.y + 2 * u * (1 - u) * my + u * u * R.y];
      ctx.save();
      ctx.globalAlpha = Math.min(1, 2.2 * (1 - t));
      ctx.lineCap = 'round';
      for (const [w, c] of [[11, 'rgba(10,8,20,.55)'], [7, b.color], [2.5, '#fff']]) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(b.x, b.y);
        for (let k = 1; k <= 16; k++) ctx.lineTo(...at(e * k / 16));
        ctx.stroke();
      }
      if (e < 1) { ctx.fillStyle = '#fff'; sparkle(...at(e), 11, now / 90); }
      ctx.restore();
    }
  }

  function drawBombs(now) {
    S.L.rings.forEach((r, i) => { if (r.cbomb && springLive(i)) drawCandyBadge(i, now); });
    if (S.beams.length) drawBeams(now);
    if (!S.L.hasBomb) return;
    for (const link of S.L.links) {
      const a = S.L.rings[link.a], b = S.L.rings[link.b];
      if (!(a.bomb || b.bomb) || !springLive(link.a) || !springLive(link.b)) continue;
      for (const p of link.pts) {
        const pulse = REDUCED ? 1 : 0.8 + 0.25 * Math.sin(now / 160 + p.x);
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(REDUCED ? 0 : now / 900);
        ctx.fillStyle = '#ff7a45'; ctx.strokeStyle = 'rgba(10,8,20,.9)'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const rr = (k % 2 ? 3.2 : 8) * pulse, q = k * Math.PI / 5;
          ctx.lineTo(Math.cos(q) * rr, Math.sin(q) * rr);
        }
        ctx.closePath(); ctx.stroke(); ctx.fill();
        ctx.restore();
      }
    }
    S.L.rings.forEach((r, i) => { if (r.bomb && springLive(i)) drawBombBadge(i, now); });
  }

  // ---- Dev Halka (2.5, kapı finalleri) ----
  // Gösterilen plaka: kırılma anına dek eski sayı (mantıkta hemen düşer)
  function armorShown(i, now) {
    const h = (S.armorHold[i] || []).find(e => now < e.until);
    return h ? h.left : armorLeft(S.L, i, S.mask);
  }
  // Plaka kırıldı: tıngırtı, plaka beyaz parlar, çelik kıymıklar
  function plateBreak(i) {
    S.plateHit[i] = performance.now();
    Sound.clank();
    if (navigator.vibrate) { try { navigator.vibrate(20); } catch (e) { /* yok say */ } }
    if (REDUCED) return;
    const r = S.L.rings[i];
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * TAU, sp = 1 + Math.random() * 2.5;
      particles.push({ x: r.x + Math.cos(a) * r.r, y: r.y + Math.sin(a) * r.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
        life: 1, size: 2.5 + Math.random() * 3, color: '#c3cada', edge: '#4a5368', shape: 'shard', rot: Math.random() * TAU });
    }
  }
  // Dev Halka parçalandı: gümleme ve zafer çıngılı, kendi renginde büyük parça yağmuru, şok dalgası ve sarsıntı
  function bossBreak(i) {
    const r = S.L.rings[i];
    Sound.bang(2); Sound.victory(); music.hit();
    if (navigator.vibrate) { try { navigator.vibrate([30, 40, 60]); } catch (e) { /* yok say */ } }
    if (REDUCED) return;
    const color = ringColor(i);
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * TAU, sp = 2 + Math.random() * 5;
      particles.push({ x: r.x + Math.cos(a) * r.r * Math.random(), y: r.y + Math.sin(a) * r.r * Math.random(), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5,
        life: 1, size: 3 + Math.random() * 5, color: k % 3 ? color : '#ffffff', edge: 'rgba(255,255,255,.8)', shape: 'shard', rot: Math.random() * TAU });
    }
    if (!fxOn()) return;
    flashT = performance.now();
    shocks.push({ ...boardToApp(r.x, r.y), t0: performance.now() });
    const wrap = canvas.parentElement;
    wrap.classList.remove('quake'); void wrap.offsetWidth; wrap.classList.add('quake');
  }
  // Zırh: halkanın boşluğa uzak tarafında, kalan plaka sayısı kadar perçinli çelik plaka
  function drawBossArmor(i, ang, cx, cy, left, now) {
    const r = S.L.rings[i], n = r.boss, span = TAU * 0.78 / n;
    const hit = S.plateHit[i] && now - S.plateHit[i] < 250;
    for (let k = 0; k < Math.min(left, n); k++) {
      const c = ang + Math.PI + (k - (n - 1) / 2) * span, a0 = c - span * 0.42, a1 = c + span * 0.42;
      ctx.save();
      ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(10,8,20,.6)'; ctx.lineWidth = STROKE + 12;
      ctx.beginPath(); ctx.arc(cx + 1, cy + 2, r.r, a0, a1); ctx.stroke();
      ctx.strokeStyle = hit && k === left - 1 ? '#ffffff' : '#9aa6bd'; ctx.lineWidth = STROKE + 9;
      ctx.beginPath(); ctx.arc(cx, cy, r.r, a0, a1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r.r - (STROKE + 9) / 2 + 2, a0 + 0.02, a1 - 0.02); ctx.stroke();
      ctx.fillStyle = '#4a5368';
      for (const a of [a0 + 0.06, a1 - 0.06]) { ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r.r, cy + Math.sin(a) * r.r, 2.4, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  // Can çubuğu (üst bilgi alanında): plaka sayısı kadar dilim; yalnız değişince yeniden yazılır
  let bossBarKey = '';
  function renderBossBar(now) {
    const b = S.L && S.L.bosses.length ? S.L.bosses[0] : -1;
    const alive = b >= 0 && (present(b) || (S.fly[b] && now < S.fly[b].t0));
    const n = alive ? S.L.rings[b].boss : 0, left = alive ? armorShown(b, now) : 0, fuse = alive && !!S.bossFuse[b];
    const key = alive ? `${n}:${left}:${fuse}` : '';
    if (key === bossBarKey) return;
    bossBarKey = key;
    const el = $('bossBar');
    el.hidden = !alive;
    if (!alive) return;
    el.classList.toggle('fuse', fuse);
    el.querySelector('.segs').innerHTML = Array.from({ length: n }, (_, k) => `<i class="${k < left ? 'on' : ''}"></i>`).join('');
  }

  // ---- Basınç kazanı çizimi (2.5) ----
  // Isı: basıncın dolan payı (0-1), uçuşu henüz başlamamış komşular sayılmaz; düdük öttüyse 1
  function heatOf(i, now) {
    if (S.boilFuse[i]) return 1;
    let seen = 0;
    S.L.rings.forEach((_, k) => { if (!present(k) && !(S.fly[k] && now < S.fly[k].t0)) seen |= 1 << k; });
    return 1 - pressureLeft(S.L, i, seen) / S.L.rings[i].boiler;
  }
  // Halkanın rengi ısıyla kora döner
  function heatColor(base, h) {
    if (!/^#[0-9a-f]{6}$/i.test(base)) return h > 0.5 ? '#ff5a28' : base;
    const a = parseInt(base.slice(1), 16), b = [255, 90, 40];
    const c = [a >> 16, (a >> 8) & 255, a & 255].map((v, k) => Math.round(v + (b[k] - v) * Math.min(1, h * 0.85)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  // Rozet: basınç göstergesi (yeşilden kırmızıya kadran, ibre, ortada kalan sayı; dolunca "!"); ısındıkça buhar tüter
  function drawBoilers(now) {
    if (!S.L.boilers.length) return;
    for (const i of S.L.boilers) {
      // Uçuşu planlanmış ama başlamamış kazan (düdük öterken) rozetini korur
      const f = S.fly[i];
      if ((f ? now >= f.t0 : !present(i)) || (S.turn && S.L.table.carried.includes(i))) continue;
      const r = S.L.rings[i], h = heatOf(i, now), fuse = !!S.boilFuse[i];
      const th = springBadgeAt(i), x = r.x + Math.cos(th) * r.r, y = r.y + Math.sin(th) * r.r;
      const jit = REDUCED ? 0 : (fuse ? 2.2 : h * 0.9) * Math.sin(now / 23);
      if (!REDUCED && h > 0 && Math.random() < 0.04 + h * 0.25) S.steam.push({ x: x + (Math.random() - 0.5) * 8, y: y - 14, t0: now, dx: (Math.random() - 0.5) * 0.4, s: 3 + Math.random() * 3 });
      ctx.save();
      ctx.translate(x + jit, y);
      ctx.fillStyle = 'rgba(20,8,8,.92)'; ctx.beginPath(); ctx.arc(0, 2, 16, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f4ece6'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7a4a3a'; ctx.lineWidth = 2; ctx.stroke();
      const A0 = Math.PI * 0.75, SPAN = Math.PI * 1.5;
      [['#4caf6a', 0, 0.45], ['#ffc94a', 0.45, 0.75], ['#ff5a3d', 0.75, 1]].forEach(([c, a, b]) => {
        ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 10.5, A0 + SPAN * a, A0 + SPAN * b); ctx.stroke();
      });
      const na = A0 + SPAN * Math.min(1, h + (fuse && !REDUCED ? 0.04 * Math.sin(now / 40) : 0));
      ctx.strokeStyle = '#2a0e0a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(na) * 9, Math.sin(na) * 9); ctx.stroke();
      ctx.fillStyle = '#2a0e0a'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff1ec'; ctx.font = '800 9px "Nunito", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(fuse ? '!' : String(Math.round((1 - h) * r.boiler)), 0, 0.5);
      ctx.restore();
    }
    S.steam = S.steam.filter(p => now - p.t0 < 1100);
    for (const p of S.steam) {
      const t = (now - p.t0) / 1100;
      ctx.save();
      ctx.globalAlpha = 0.45 * (1 - t);
      ctx.fillStyle = '#fff1ec';
      ctx.beginPath(); ctx.arc(p.x + p.dx * t * 60 + Math.sin(t * 6) * 3, p.y - t * 46, p.s * (1 + t * 1.6), 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // ---- İkiz portal çizimi (2.5) ----
  // İkiz çiftlerinin renk ve işaretleri: 1 ay (mor), 2 yıldız (camgöbeği), sonrası sırayla
  const TWINS = [{ color: '#c9a7ff', mark: 'moon' }, { color: '#5fe3ff', mark: 'star' }];
  const twinOf = i => TWINS[(S.L.rings[i].portal + TWINS.length - 1) % TWINS.length];
  // İkizin portalı açılır: ses, ikizin üstünde girdap, ikiz beyaz parlar
  function portalOpen(i) {
    const r = S.L.rings[i];
    if (!r) return;
    Sound.swoosh();
    S.flash[i] = performance.now();
    if (!REDUCED) S.vortex.push({ x: r.x, y: r.y, r: r.r, color: twinOf(i).color, t0: performance.now() });
  }
  function markPath(mark, s) {
    ctx.beginPath();
    if (mark === 'moon') {
      ctx.arc(0, 0, s, 0.6, TAU - 0.6 + 0.0001); ctx.arc(s * 0.55, 0, s * 0.78, TAU - 1.05, 1.05, true);
    } else {
      for (let k = 0; k < 10; k++) { const rr = k % 2 ? s * 0.45 : s, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    }
    ctx.closePath();
  }
  // İkizleri bağlayan akan ışıltılı iz, girdap rozetleri ve açılan girdaplar
  function drawPortals(now) {
    const L = S.L;
    if (L.twin.some(o => o >= 0)) {
      const spot = i => { const r = L.rings[i], th = springBadgeAt(i); return { x: r.x + Math.cos(th) * r.r, y: r.y + Math.sin(th) * r.r }; };
      for (let i = 0; i < L.rings.length; i++) {
        const o = L.twin[i];
        if (o < i || !springLive(i) || !springLive(o)) continue;
        const a = spot(i), b = spot(o), tw = twinOf(i);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.max(40, Math.hypot(a.x - b.x, a.y - b.y) * 0.35);
        ctx.save();
        ctx.strokeStyle = tw.color; ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.setLineDash([2, 7]); ctx.lineDashOffset = REDUCED ? 0 : -now / 40;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
        ctx.restore();
      }
      for (let i = 0; i < L.rings.length; i++) {
        if (L.twin[i] < 0 || !springLive(i)) continue;
        const tw = twinOf(i), { x, y } = spot(i);
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = 'rgba(12,9,24,.92)'; ctx.beginPath(); ctx.arc(0, 2, 16, 0, TAU); ctx.fill();
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 14);
        g.addColorStop(0, '#2a1f4d'); g.addColorStop(1, '#120d24');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
        ctx.strokeStyle = tw.color; ctx.lineWidth = 2; ctx.stroke();
        ctx.save();
        ctx.rotate(REDUCED ? 0 : now / 700);
        ctx.strokeStyle = tw.color; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        for (let k = 0; k < 3; k++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.arc(4, 0, 7, Math.PI * 0.9, Math.PI * 1.6); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = tw.color; markPath(tw.mark, 6); ctx.fill();
        ctx.restore();
      }
    }
    S.vortex = S.vortex.filter(v => now - v.t0 < 700);
    for (const v of S.vortex) {
      const t = Math.max(0, (now - v.t0) / 700), e = Math.sin(Math.PI * t);
      ctx.save();
      ctx.translate(v.x, v.y); ctx.rotate(t * 6);
      ctx.strokeStyle = v.color; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = (1 - t) * (1 - k * 0.25);
        ctx.beginPath(); ctx.arc(0, 0, v.r * (0.3 + 0.25 * k) * e + 2, k, k + Math.PI * 1.3); ctx.stroke();
      }
      for (let k = 0; k < 10; k++) {
        const a = k * TAU / 10, d = v.r * 1.3 * (1 - t);
        ctx.globalAlpha = 1 - t; ctx.fillStyle = k % 2 ? '#ffffff' : v.color;
        ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 2.4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---- Motor halka çizimi (2.5) ----
  // Dişler: halkanın dışında, halkayla birlikte dönen pirinç dişler (halkanın altında kalır)
  function drawMotorTeeth(i, ang, cx, cy) {
    const r = S.L.rings[i], n = 30, rr = r.r + STROKE / 2;
    ctx.save();
    ctx.fillStyle = '#c98f45'; ctx.strokeStyle = 'rgba(18,12,7,.9)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < n; k++) {
      const a = ang + 0.12 + k * TAU / n;
      if (r.gaps.some(g => angDist(a, ang + g) < GAP_HALF + 0.08)) continue;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); ctx.rotate(a);
      ctx.beginPath(); ctx.rect(-1, -4.5, 7, 9); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  // Boşluğun bir sonraki yeri (koyu boşluk, iki yanında kesikli çizgi; yanıp söner) ve rozet: yön oklu çark
  function drawMotors(now) {
    if (!S.L.motors.length) return;
    const still = !S.kicks.length && !S.auto && !S.drag;
    for (const i of S.L.motors) {
      if (!springLive(i)) continue;
      const r = S.L.rings[i], ang = S.angles[i];
      if (still) {
        ctx.save();
        ctx.globalAlpha = REDUCED ? 0.85 : 0.6 + 0.3 * Math.sin(now / 260);
        for (const g of r.gaps) {
          const c = ang + g + r.motor, a0 = c - GAP_HALF * 0.8, a1 = c + GAP_HALF * 0.8;
          ctx.strokeStyle = 'rgba(18,12,7,.8)'; ctx.lineWidth = STROKE + 3; ctx.lineCap = 'butt';
          ctx.beginPath(); ctx.arc(r.x, r.y, r.r, a0, a1); ctx.stroke();
          ctx.strokeStyle = '#fff4e6'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
          for (const rr of [r.r - STROKE / 2 - 2, r.r + STROKE / 2 + 2]) { ctx.beginPath(); ctx.arc(r.x, r.y, rr, a0, a1); ctx.stroke(); }
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
      const th = springBadgeAt(i), x = r.x + Math.cos(th) * r.r, y = r.y + Math.sin(th) * r.r, dir = Math.sign(r.motor);
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(18,12,7,.9)'; ctx.beginPath(); ctx.arc(0, 2, 16, 0, TAU); ctx.fill();
      ctx.save();
      ctx.rotate(ang);
      ctx.fillStyle = '#e0a85c'; ctx.strokeStyle = '#5a3a14'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = k * Math.PI / 8, rr = k % 2 ? 10 : 13.5;
        ctx.lineTo(Math.cos(a - 0.12) * rr, Math.sin(a - 0.12) * rr); ctx.lineTo(Math.cos(a + 0.12) * rr, Math.sin(a + 0.12) * rr);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#2a1a0c'; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff4e6'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 3.6, dir > 0 ? -2.4 : -0.74, dir > 0 ? 0.74 : 2.4); ctx.stroke();
      const tip = dir > 0 ? 0.74 : 2.4, tx = Math.cos(tip) * 3.6, ty = Math.sin(tip) * 3.6;
      ctx.fillStyle = '#fff4e6'; ctx.beginPath();
      ctx.moveTo(tx + Math.cos(tip + dir * Math.PI / 2) * 2.6, ty + Math.sin(tip + dir * Math.PI / 2) * 2.6);
      ctx.lineTo(tx + Math.cos(tip) * 2.2, ty + Math.sin(tip) * 2.2); ctx.lineTo(tx - Math.cos(tip) * 2.2, ty - Math.sin(tip) * 2.2); ctx.fill();
      ctx.restore();
    }
  }

  // ---- Cırcır halka çizimi (2.6) ----
  // Testere dişleri halkanın dışında, halkayla döner: dik yüzü dönüş yönünün önünde (mandal oraya takılır)
  function drawRatchetTeeth(i, ang, cx, cy) {
    const r = S.L.rings[i], dir = r.ratchet, pitch = 15 / r.r, r0 = r.r + STROKE / 2 - 1, r1 = r0 + 6;
    ctx.save();
    ctx.fillStyle = W.PIECE_COLORS.ratchet; ctx.strokeStyle = 'rgba(18,12,7,.8)'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
    for (const [from, to] of gapList(r, ang).map((g, k, l) => [g + GAP_HALF, (k + 1 < l.length ? l[k + 1] : l[0] + TAU) - GAP_HALF])) {
      for (let th = from + pitch * 0.3; th + pitch <= to; th += pitch) {
        const lo = dir > 0 ? th : th + pitch, hi = dir > 0 ? th + pitch : th;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(lo) * r0, cy + Math.sin(lo) * r0);
        ctx.lineTo(cx + Math.cos(hi) * r1, cy + Math.sin(hi) * r1);
        ctx.lineTo(cx + Math.cos(hi) * r0, cy + Math.sin(hi) * r0);
        ctx.closePath(); ctx.stroke(); ctx.fill();
      }
    }
    ctx.restore();
  }
  // Rozet: pirinç disk üstünde dönüş yönünü gösteren yay ok (ters cırcırda aynalı); takılınca kızarır ve titrer
  function drawRatchets(now) {
    S.L.rings.forEach((r, i) => {
      if (!r.ratchet || !springLive(i)) return;
      const th = springBadgeAt(i), d = S.ratchetDeny[i] ? Math.max(0, 1 - (now - S.ratchetDeny[i]) / 520) : 0;
      const x = r.x + Math.cos(th) * r.r + (REDUCED ? 0 : d * 3 * Math.sin(now / 18)), y = r.y + Math.sin(th) * r.r;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(18,12,7,.9)'; ctx.beginPath(); ctx.arc(0, 2, 16, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(-5, -5, 1, 0, 0, 14);
      g.addColorStop(0, '#fff1c4'); g.addColorStop(0.35, W.PIECE_COLORS.ratchet); g.addColorStop(1, '#9a6a1c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 13.5, 0, TAU); ctx.fill();
      if (d > 0) { ctx.fillStyle = `rgba(230,60,40,${0.85 * Math.min(1, 1.6 * d)})`; ctx.beginPath(); ctx.arc(0, 0, 13.5, 0, TAU); ctx.fill(); }
      ctx.scale(r.ratchet, 1);
      ctx.strokeStyle = '#3a2500'; ctx.fillStyle = '#3a2500'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      const tip = 0.75, hx = Math.cos(tip) * 7, hy = Math.sin(tip) * 7, ta = tip + Math.PI / 2;
      ctx.beginPath(); ctx.arc(0, 0, 7, -2.4, tip); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(ta) * 4.5, hy + Math.sin(ta) * 4.5);
      ctx.lineTo(hx + Math.cos(ta + 2.4) * 4, hy + Math.sin(ta + 2.4) * 4);
      ctx.lineTo(hx + Math.cos(ta - 2.4) * 4, hy + Math.sin(ta - 2.4) * 4);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    });
  }

  // ---- İnci halka çizimi (2.6) ----
  const isShell = i => S.L.shellOf.includes(i);
  // İnci saklı mı: istiridyesi tahtada ya da istiridye uçuyor ama inci henüz belirmedi
  const veiled = (i, now) => S.L.shellOf[i] >= 0 && (hidden(S.L, i, S.mask) || now < (S.pearlAt[i] || 0));
  // Saklı inci: istiridyenin ortasında parlayan sedef top ve incinin belireceği yer (kesik çizgi); istiridyeyle uçar
  function drawHiddenPearl(i, now) {
    const r = S.L.rings[i], sh = S.L.rings[S.L.shellOf[i]];
    const P = ringPose(S.L.shellOf[i], now), ox = P.cx - sh.x, oy = P.cy - sh.y;
    ctx.save();
    ctx.globalAlpha = P.alpha;
    ctx.setLineDash([5, 7]); ctx.strokeStyle = 'rgba(244,239,230,.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(r.x + ox, r.y + oy, r.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    pearlBall(r.x + ox, r.y + oy, 11 + (REDUCED ? 0 : Math.sin(now / 400) * 1.2), now);
    ctx.restore();
  }
  function pearlBall(x, y, s, now) {
    const g = ctx.createRadialGradient(x - s * 0.35, y - s * 0.4, 1, x, y, s);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, W.PIECE_COLORS.pearl); g.addColorStop(0.8, '#d8cfe6'); g.addColorStop(1, '#b7a9cf');
    ctx.shadowColor = 'rgba(255,255,255,.7)'; ctx.shadowBlur = 14;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // sedef yanardönerliği: dönen ince renkli hilal
    ctx.strokeStyle = `hsla(${(now / 12) % 360},80%,80%,.55)`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, s * 0.7, now / 700, now / 700 + 1.6); ctx.stroke();
  }
  // Boşluklar dışındaki yaylar: each(baş, son)
  const eachArc = (ring, ang, each) => gapList(ring, ang).forEach((g, k, l) => each(g + GAP_HALF, (k + 1 < l.length ? l[k + 1] : l[0] + TAU) - GAP_HALF));
  // İstiridyenin dalgalı kabuk kenarı (halkanın altında, halkayla döner) ve üstündeki ışınsal oluklar
  function drawShellRim(i, ang, cx, cy) {
    const r = S.L.rings[i], step = 13 / r.r, r0 = r.r + STROKE / 2 - 1;
    ctx.save();
    ctx.fillStyle = W.PIECE_COLORS.shell; ctx.strokeStyle = 'rgba(4,15,22,.6)'; ctx.lineWidth = 1.4;
    eachArc(r, ang, (from, to) => {
      for (let th = from + step * 0.3; th + step <= to; th += step) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(th) * r0, cy + Math.sin(th) * r0);
        ctx.quadraticCurveTo(cx + Math.cos(th + step / 2) * (r0 + 9), cy + Math.sin(th + step / 2) * (r0 + 9), cx + Math.cos(th + step) * r0, cy + Math.sin(th + step) * r0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    });
    ctx.restore();
  }
  function drawShellGrooves(i, ang, cx, cy) {
    const r = S.L.rings[i];
    ctx.save();
    ctx.strokeStyle = 'rgba(70,55,100,.55)'; ctx.lineWidth = 1.6;
    eachArc(r, ang, (from, to) => {
      for (let th = from + 0.1; th < to; th += 9 / r.r) {
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(th) * (r.r - 5), cy + Math.sin(th) * (r.r - 5)); ctx.lineTo(cx + Math.cos(th) * (r.r + 5), cy + Math.sin(th) * (r.r + 5)); ctx.stroke();
      }
    });
    ctx.restore();
  }
  // İncinin sedef parıltısı: halka boyunca kayan yanardöner şerit; belirirken beyaz parlar
  function drawNacre(i, ang, cx, cy, now, born) {
    const r = S.L.rings[i], th = REDUCED ? ang + Math.PI : now / 650 + i;
    ctx.save();
    ctx.strokeStyle = `hsla(${(now / 10 + i * 60) % 360},85%,82%,.75)`; ctx.lineWidth = 4; ctx.lineCap = 'round';
    if (!r.gaps.some(g => angDist(ang + g, th) < GAP_HALF + 0.4)) { ctx.beginPath(); ctx.arc(cx, cy, r.r, th - 0.35, th + 0.35); ctx.stroke(); }
    if (born < 1) { ctx.globalAlpha *= 1 - born; strokeRing(r, ang, '#fff', STROKE + 8, cx, cy); }
    ctx.restore();
  }
  // Açılan istiridyenin iki kapağı ayrılıp düşer
  function drawShellHalves(now) {
    S.shellHalves = S.shellHalves.filter(h => now - h.t0 < 700);
    for (const h of S.shellHalves) {
      const t = (now - h.t0) / 700, r = S.L.rings[h.ring];
      ctx.save(); ctx.globalAlpha = 1 - t;
      for (const d of [-1, 1]) {
        ctx.save(); ctx.translate(r.x + d * 40 * t, r.y + 60 * t * t); ctx.rotate(d * 0.8 * t);
        ctx.fillStyle = W.PIECE_COLORS.shell; ctx.strokeStyle = 'rgba(4,15,22,.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, r.r * 0.55, r.r * 0.38, 0, d > 0 ? -Math.PI / 2 : Math.PI / 2, d > 0 ? Math.PI / 2 : Math.PI * 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // ---- Zincirli ikizler çizimi (2.6) ----
  // Serbest olup eşini bekleyen zincirli halka (zincir gerilip sarı yanar, halka eşine çekilir ve parlar)
  const waiting = i => {
    const m = S.L.chainMate[i];
    return m >= 0 && present(i) && present(m) && !S.fly[i] && !S.drag && !S.auto && isFree(S.L, i, S.angles, S.mask, S.ph);
  };
  // Zincirin yanı: iki halkanın yan tarafından (üst üste binen kısımdan uzakta) bağlanır, ortası öbür halkalardan uzak
  // düşen tarafa sarkar (bölüm başında bir kez seçilir)
  function chainSide(a, b) {
    if (S.chainSide[a]) return S.chainSide[a];
    const A = S.L.rings[a], B = S.L.rings[b], d = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    const nx = -(B.y - A.y) / d, ny = (B.x - A.x) / d, mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, off = (A.r + B.r) / 2 + 24;
    const room = s => Math.min(...S.L.rings.map((r, i) => (i === a || i === b || r.kind !== 'ring' ? Infinity : Math.abs(Math.hypot(mx + nx * s * off - r.x, my + ny * s * off - r.y) - r.r))));
    return (S.chainSide[a] = room(1) >= room(-1) ? 1 : -1);
  }
  // Zincir: pirinç baklalar halkalarla birlikte uçar; kopunca baklalar saçılır
  function drawChains(visible, now) {
    S.L.chainMate.forEach((b, a) => {
      if (b < a || !visible[a] || !visible[b]) return;
      const cut = S.chainCut[a];
      const A = ringPose(a, now), B = ringPose(b, now), Ra = S.L.rings[a], Rb = S.L.rings[b];
      const d = Math.hypot(B.cx - A.cx, B.cy - A.cy) || 1, ux = (B.cx - A.cx) / d, uy = (B.cy - A.cy) / d, s = chainSide(a, b);
      const nx = -uy * s, ny = ux * s, sn = 0.866;
      const x0 = A.cx + (ux * 0.5 + nx * sn) * Ra.r, y0 = A.cy + (uy * 0.5 + ny * sn) * Ra.r;
      const x1 = B.cx + (-ux * 0.5 + nx * sn) * Rb.r, y1 = B.cy + (-uy * 0.5 + ny * sn) * Rb.r;
      const span = Math.hypot(x1 - x0, y1 - y0), taut = waiting(a) || waiting(b);
      const sag = taut ? 6 : Math.min(36, 12 + span * 0.15), n = Math.max(3, Math.round(span / 13));
      const at = u => [(1 - u) * x0 + u * x1 + nx * 4 * sag * u * (1 - u), (1 - u) * y0 + u * y1 + ny * 4 * sag * u * (1 - u)];
      const glow = taut ? 0.6 + 0.4 * Math.sin(now / 140) : 0, color = taut ? `rgb(255,${210 + 30 * glow},${110 + 60 * glow})` : W.PIECE_COLORS.chain;
      ctx.save();
      if (cut != null && now >= cut) {
        // kopan zincir: baklalar yerçekimiyle saçılıp söner
        const t = (now - cut) / 800;
        if (t >= 1) { ctx.restore(); return; }
        ctx.globalAlpha = 1 - t;
      } else ctx.globalAlpha = Math.min(A.alpha, B.alpha);
      const t = cut != null && now >= cut ? (now - cut) / 800 : 0;
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n, [px, py] = at(u), [qx, qy] = at(Math.min(1, u + 0.5 / n));
        ctx.save();
        ctx.translate(px + (t ? Math.cos(k * 2.4) * 90 * t : 0), py + (t ? (Math.sin(k * 1.7) - 0.6) * 60 * t + 120 * t * t : 0));
        ctx.rotate(Math.atan2(qy - py, qx - px) + t * 6 * (k % 2 ? 1 : -1));
        const ry = k % 2 ? 2.2 : 3.6;
        ctx.strokeStyle = 'rgba(4,15,22,.75)'; ctx.lineWidth = 5.5;
        ctx.beginPath(); ctx.ellipse(0, 0, 6.5, ry, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = color; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.ellipse(0, 0, 6.5, ry, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      if (!t) for (const [x, y] of [[x0, y0], [x1, y1]]) {
        ctx.fillStyle = 'rgba(4,15,22,.8)'; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = taut ? '#ffe9a8' : W.PIECE_COLORS.chain; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    });
  }

  // ---- Raylı halka (2.6) ----
  const SLIDE_MS = 280;
  // Raylı halkanın görünen yeri: sürüklenirken parmağın raydaki izdüşümü, kayarken iki durak arası
  function railPos(i, now) {
    const r = S.L.rings[i];
    if (S.drag && S.drag.ring === i && S.drag.rail != null) return S.drag.at;
    if (S.slide && S.slide.ring === i) {
      const t = REDUCED ? 1 : Math.min(1, (now - S.slide.t0) / SLIDE_MS), e = 1 - Math.pow(1 - t, 3);
      return { x: S.slide.from.x + (r.x - S.slide.from.x) * e, y: S.slide.from.y + (r.y - S.slide.from.y) * e };
    }
    return r;
  }
  // Noktanın raydaki izdüşümü (duraklar arasındaki çizgilerde kalır)
  function onRail(R, p) {
    let best = R.stops[0], bd = Infinity;
    for (let s = 0; s + 1 < R.stops.length; s++) {
      const A = R.stops[s], B = R.stops[s + 1], vx = B.x - A.x, vy = B.y - A.y;
      const u = Math.max(0, Math.min(1, ((p.x - A.x) * vx + (p.y - A.y) * vy) / (vx * vx + vy * vy)));
      const q = { x: A.x + vx * u, y: A.y + vy * u }, d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  // k. raydaki halka s durağına kayar: düzen değişir, kayış biter bitmez hamle sayılır
  function slideTo(k, s, from) {
    const R = S.L.rails[k], before = snapshot();
    from = from || { x: S.L.rings[R.ring].x, y: S.L.rings[R.ring].y };
    S.L = slideRail(S.L, k, s);
    S.slide = { ring: R.ring, from, t0: performance.now() };
    S.hint = null; S.springSpot = {}; S.slid = true;
    Sound.slide();
    setTimeout(() => { S.slide = null; commitMove(before, R.ring); }, REDUCED ? 0 : SLIDE_MS);
  }
  // Bırakınca en yakın durağa oturur; durak aynıysa geri kayar, hamle sayılmaz
  function endRailDrag(drag) {
    const R = S.L.rails[drag.rail];
    let s = 0;
    R.stops.forEach((q, j) => { if (Math.hypot(q.x - drag.at.x, q.y - drag.at.y) < Math.hypot(R.stops[s].x - drag.at.x, R.stops[s].y - drag.at.y)) s = j; });
    if (s !== S.L.railAt[drag.rail]) { slideTo(drag.rail, s, drag.at); return; }
    S.slide = { ring: drag.ring, from: drag.at, t0: performance.now() };
    setTimeout(() => { S.slide = null; }, REDUCED ? 0 : SLIDE_MS);
  }
  // Ray: duraklar arasında iki bulut beyazı çizgi ve traversler; her durakta yuva, halkanın durduğu yuva altın parlar
  function drawRails(now) {
    for (const [k, R] of S.L.rails.entries()) {
      if (!present(R.ring) && !S.fly[R.ring]) continue;
      const st = R.stops, a = Math.atan2(st[st.length - 1].y - st[0].y, st[st.length - 1].x - st[0].x), nx = -Math.sin(a), ny = Math.cos(a);
      ctx.save();
      ctx.globalAlpha = present(R.ring) ? 1 : 0.35;
      ctx.lineCap = 'round';
      for (let s = 0; s + 1 < st.length; s++) {
        const len = Math.hypot(st[s + 1].x - st[s].x, st[s + 1].y - st[s].y);
        ctx.strokeStyle = 'rgba(232,241,255,.22)'; ctx.lineWidth = 3;
        for (let u = 6; u < len; u += 14) {
          const x = st[s].x + Math.cos(a) * u, y = st[s].y + Math.sin(a) * u;
          ctx.beginPath(); ctx.moveTo(x - nx * 9, y - ny * 9); ctx.lineTo(x + nx * 9, y + ny * 9); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(232,241,255,.55)'; ctx.lineWidth = 2.5;
        for (const d of [-6, 6]) { ctx.beginPath(); ctx.moveTo(st[s].x + nx * d, st[s].y + ny * d); ctx.lineTo(st[s + 1].x + nx * d, st[s + 1].y + ny * d); ctx.stroke(); }
      }
      st.forEach((p, s) => {
        const here = s === S.L.railAt[k] && !(S.drag && S.drag.rail === k);
        ctx.fillStyle = 'rgba(8,12,28,.85)'; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, TAU); ctx.fill();
        ctx.strokeStyle = here ? '#ffd36b' : '#e8f1ff'; ctx.lineWidth = here ? 3.5 : 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 8 + (here && !REDUCED ? Math.sin(now / 260) : 0), 0, TAU); ctx.stroke();
      });
      ctx.restore();
    }
  }
  // Makaralar: halkanın ray yönündeki iki ucunda, kayarken döner
  function drawRailWheels(i, cx, cy, now) {
    const st = S.L.rails.find(R => R.ring === i).stops, r = S.L.rings[i].r;
    const a = Math.atan2(st[st.length - 1].y - st[0].y, st[st.length - 1].x - st[0].x), spin = S.slide && S.slide.ring === i ? now / 40 : 0;
    for (const d of [-1, 1]) {
      const x = cx + Math.cos(a) * r * d, y = cy + Math.sin(a) * r * d;
      ctx.fillStyle = 'rgba(8,12,28,.9)'; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8f1ff'; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5a7bb0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(spin) * 5, y + Math.sin(spin) * 5); ctx.lineTo(x - Math.cos(spin) * 5, y - Math.sin(spin) * 5); ctx.stroke();
    }
  }
  // İpucu: kaydırılacak durakta atan altın halka
  function drawStopPulse(h, now) {
    const p = S.L.rails[h.rail].stops[h.stop], pulse = 0.5 + 0.5 * Math.sin((now - h.t0) / 200);
    ctx.save();
    ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = 16; ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 14 + 4 * pulse, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // ---- Buz halka çizimi (2.5) ----
  // Gösterilen kat: hamlede çatlama anı gelene dek eski kat (mantıkta hemen düşer)
  function iceShown(i, now) {
    const h = (S.iceHold[i] || []).find(e => now < e.until);
    return h ? h.left : iceLeft(S.L, i, S.mask);
  }
  // Kabuk: halkanın üstünde yarı saydam açık mavi kalın katman ve parıltı çentikleri. Çok katlı buz daha kalın
  // ve donuk, tek katta koyu çatlaklar görünür. Çatlayınca kabuk bir an kabarır.
  function drawIceShell(i, ang, cx, cy, left, now) {
    const r = S.L.rings[i];
    const ct = S.iceCrack[i] ? (now - S.iceCrack[i]) / 300 : 1;
    const pop = ct < 1 ? 1 + 0.08 * Math.sin(ct * Math.PI) : 1;
    const thick = left >= 2, w = thick ? 9 : 7;
    ctx.save();
    ctx.shadowColor = '#9be7ff'; ctx.shadowBlur = thick ? 14 : 8;
    strokeRing(r, ang, thick ? 'rgba(170,230,255,.78)' : 'rgba(170,230,255,.55)', (STROKE + (thick ? 12 : 8)) * pop, cx, cy);
    ctx.shadowBlur = 0;
    strokeRing(r, ang, 'rgba(255,255,255,.55)', 2.5, cx - 1.5, cy - 2);
    ctx.lineCap = 'round';
    for (let k = 0; k < 16; k++) {
      const p = ang + 0.2 + k * TAU / 16;
      if (r.gaps.some(g => angDist(p, ang + g) < GAP_HALF + 0.12)) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(p - 0.05) * (r.r - w), cy + Math.sin(p - 0.05) * (r.r - w));
      ctx.lineTo(cx + Math.cos(p + 0.05) * (r.r + w), cy + Math.sin(p + 0.05) * (r.r + w));
      ctx.stroke();
      if (left === 1 && k % 3 === 1) {
        ctx.strokeStyle = 'rgba(30,60,80,.75)'; ctx.lineWidth = 1.8;
        ctx.beginPath();
        let rr = r.r - 10, aa = p + 0.12;
        ctx.moveTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr);
        for (let q = 0; q < 4; q++) { rr += 5; aa += (q % 2 ? -1 : 1) * 0.06; ctx.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // Rozet: halkanın en boş yerinde kar tanesi, ortasında kalan kat sayısı
  function drawIceBadges(now) {
    if (!S.L.hasIce) return;
    S.L.rings.forEach((r, i) => {
      if (!r.ice || !springLive(i)) return;
      const left = iceShown(i, now);
      if (!left) return;
      const th = springBadgeAt(i), x = r.x + Math.cos(th) * r.r, y = r.y + Math.sin(th) * r.r;
      const ct = S.iceCrack[i] ? (now - S.iceCrack[i]) / 300 : 1;
      const sc = ct < 1 ? 1 + 0.35 * Math.sin(ct * Math.PI) : 1;
      ctx.save();
      ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(6,14,22,.9)'; ctx.beginPath(); ctx.arc(0, 2, 16, 0, TAU); ctx.fill();
      ctx.fillStyle = '#dff6ff'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#4cb8e6'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#3a9ccc'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.stroke();
      }
      ctx.fillStyle = '#dff6ff'; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0d3a52'; ctx.font = '800 13px "Nunito", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(left), 0, 1);
      ctx.restore();
    });
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
    if (S.tut != null || S.won || S.failed || S.auto || S.kicks.length || S.turn || S.hint || S.help.shown) return;
    if (!$('win').classList.contains('hidden') || !$('worldCard').classList.contains('hidden') || !$('pieceCard').classList.contains('hidden') || !$('settings').classList.contains('hidden')) {
      S.help.lastAct = now;
      return;
    }
    const stuck = S.moves > (S.def.par ?? 99) || now - S.help.lastAct > HELP_IDLE_MS;
    if (!stuck) return;
    S.help.shown = true;
    $('nudge').classList.add('pulse');
    setTimeout(() => { if (!S.won && !S.failed) bestMove(); }, 60);
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
    if (S.L.rings[i].paint >= 0) return W.PIECE_COLORS.paints[S.L.rings[i].paint];
    if (S.L.painted.some(p => p.length)) return W.PIECE_COLORS.plain[i % W.PIECE_COLORS.plain.length];
    if (S.L.rings[i].ratchet) return W.PIECE_COLORS.ratchet;
    if (S.L.rings[i].pearl >= 0) return W.PIECE_COLORS.pearl;
    if (S.L.chainMate[i] >= 0) return W.PIECE_COLORS.twin;
    if (S.L.rings[i].rail) return W.PIECE_COLORS.sky;
    // raylı bölümde renksizler gök mavisine karışmayan gün batımı pembesi, altın, lila
    if (S.L.rails) return S.def.rings[i].color || W.PIECE_COLORS.dusk[i % W.PIECE_COLORS.dusk.length];
    // zincirli bölümde renksizler ikizlerin deniz yeşiline karışmayan mercan, gece mavisi, lila
    if (S.L.chainMate.some(m => m >= 0)) return S.def.rings[i].color || W.PIECE_COLORS.reef[i % W.PIECE_COLORS.reef.length];
    if (isShell(i)) return W.PIECE_COLORS.shell;
    // cırcırlı bölümde renksizler pirinçle karışmayan turkuaz, kiremit, lacivert taşı
    if (S.L.rings.some(r => r.ratchet)) return S.def.rings[i].color || W.PIECE_COLORS.desert[i % W.PIECE_COLORS.desert.length];
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
    const ring = S.L.rings[i], at = ring.rail ? railPos(i, now) : ring;
    let cx = at.x, cy = at.y, alpha = 1, grow = 1, spin = 0;
    const off = tableOffset(now);
    if (off && S.L.table.carried.includes(i)) {
      const T = S.L.table, dx = cx - T.x, dy = cy - T.y, c = Math.cos(off), s = Math.sin(off);
      cx = T.x + dx * c - dy * s; cy = T.y + dx * s + dy * c;
    }
    const f = S.fly[i];
    if (f && f.tele) {
      // Işınlanan ikiz yerinde dönerek küçülür
      const t = Math.min(Math.max((now - f.t0) / flyMs(f), 0), 1), e = t * t;
      alpha = 1 - e;
      grow = Math.max(0.02, 1 - e);
      spin = 5 * e;
    } else if (f) {
      // Son halka ağır çekimde: daha yavaş, biraz daha büyüyerek ve dönerek gider
      const t = Math.min(Math.max((now - f.t0) / flyMs(f), 0), 1);
      const e = t * t;
      cx += f.dx * (f.spin ? 520 : 420) * e;
      cy += f.dy * (f.spin ? 520 : 420) * e;
      alpha = 1 - t;
      grow = 1 + 0.15 * t;
      spin = (f.spin || 0) * e;
    }
    // Zincirli halka serbestken eşini bekler: eşine doğru hafifçe çekilir
    if (!f && waiting(i)) {
      const M = S.L.rings[S.L.chainMate[i]], d = Math.hypot(M.x - cx, M.y - cy) || 1, pull = REDUCED ? 3 : 3 + 2 * Math.sin(now / 160);
      cx += (M.x - cx) / d * pull; cy += (M.y - cy) / d * pull;
    }
    // Gerilim: son parçalar hafifçe titrer
    if (!f && S.tension >= 0.65 && !REDUCED) { cx += Math.sin(now / 45 + i * 1.7) * 0.9 * S.tension; cy += Math.cos(now / 53 + i) * 0.6 * S.tension; }
    // Dev Halka: zırhı bitince parçalanmadan önce sarsılır
    if (ring.boss && S.bossFuse[i] && (!f || now < f.t0) && !REDUCED) { cx += Math.sin(now / 19) * 3; cy += Math.cos(now / 23) * 2; }
    // Kazan ısındıkça titrer, düdük öterken sarsılır
    if (ring.boiler && (!f || now < f.t0) && !REDUCED) {
      const h = heatOf(i, now);
      if (h) { const a = S.boilFuse[i] ? 3 : h * 1.6; cx += Math.sin(now / 21) * a; cy += Math.cos(now / 27) * a * 0.6; }
    }
    const sh = S.shake[i];
    if (sh != null) {
      const t = (now - sh) / 350;
      if (t < 1) cx += Math.sin(t * 30) * 5 * (1 - t);
    }
    return { cx, cy, alpha, grow, spin };
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
    if (veiled(i, now)) { drawHiddenPearl(i, now); return; }
    const pose = ringPose(i, now), { cx, cy, alpha, spin } = pose;
    // inci belirirken merkezinden büyür
    const born = S.pearlAt[i] ? Math.min(1, (now - S.pearlAt[i]) / 420) : 1;
    const grow = pose.grow * (born < 1 ? 0.25 + 0.75 * (1 - Math.pow(1 - born, 3)) : 1);
    const ang = S.angles[i] + spin;
    if (S.shake[i] != null && now - S.shake[i] >= 350) delete S.shake[i];
    ctx.save();
    ctx.globalAlpha = alpha * (ring.side >= 0 && ring.side !== S.sw ? 0.4 : 1);
    if (grow !== 1) { ctx.translate(cx, cy); ctx.scale(grow, grow); ctx.translate(-cx, -cy); }
    const heat = ring.boiler && (!S.fly[i] || now < S.fly[i].t0) ? heatOf(i, now) : 0;
    const color = heat ? heatColor(ringColor(i), heat) : ringColor(i);
    const mover = S.drag ? S.drag.ring : S.auto ? S.auto.ring : -1;
    const active = mover >= 0 && S.L.group[mover].includes(i);
    if (active || waiting(i)) {
      ctx.shadowColor = active ? color : '#ffe9a8';
      ctx.shadowBlur = 18;
    }
    if (ring.step) drawStepDots(i, cx, cy, now);
    if (ring.motor) drawMotorTeeth(i, ang, cx, cy);
    if (ring.ratchet) drawRatchetTeeth(i, ang, cx, cy);
    if (isShell(i)) drawShellRim(i, ang, cx, cy);
    strokeRing(ring, ang, 'rgba(0,0,0,.4)', STROKE + 6, cx + 2, cy + 4);
    ctx.shadowBlur = 0;
    // Kazan: ısındıkça kalınlaşır ve kor gibi parlar, düdükte akkor
    if (heat) {
      ctx.shadowColor = S.boilFuse[i] ? '#fff3b0' : '#ff5a28';
      ctx.shadowBlur = 8 + heat * 22 + (S.boilFuse[i] && !REDUCED ? 10 * Math.abs(Math.sin(now / 60)) : 0);
    }
    strokeRing(ring, ang, color, STROKE * (1 + 0.3 * heat), cx, cy);
    ctx.shadowBlur = 0;
    if (ring.boss && (!S.fly[i] || now < S.fly[i].t0)) drawBossArmor(i, ang, cx, cy, armorShown(i, now), now);
    strokeRing(ring, ang, 'rgba(255,255,255,.3)', 3, cx - 2, cy - 2);
    if (ring.paint >= 0) drawCandy(i, ang, cx, cy, now);
    if (isShell(i)) drawShellGrooves(i, ang, cx, cy);
    if (ring.pearl >= 0) drawNacre(i, ang, cx, cy, now, born);
    if (ring.rail && !S.fly[i]) drawRailWheels(i, cx, cy, now);
    const icy = ring.ice ? iceShown(i, now) : 0;
    if (icy) drawIceShell(i, ang, cx, cy, icy, now);
    const fl = S.flash[i] ? 1 - (now - S.flash[i]) / 260 : 0;
    if (fl > 0 && fl <= 1) { ctx.globalAlpha = alpha * fl; strokeRing(ring, ang, '#fff', STROKE + 4, cx, cy); ctx.globalAlpha = alpha; }
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
        // Cırcırın sonraki tıkı: dönüş yönünü gösteren, hafifçe nabız atan ok başı
        if (ring.ratchet && !S.drag && !S.auto && angDist(a, S.angles[i] + g + ring.ratchet * ring.step) < ring.step / 2) {
          const beat = REDUCED ? 1 : 1 + 0.15 * Math.sin(now / 220);
          ctx.save();
          ctx.translate(cx + Math.cos(a) * (rr + 6), cy + Math.sin(a) * (rr + 6)); ctx.rotate(a + ring.ratchet * Math.PI / 2); ctx.scale(beat, beat);
          ctx.fillStyle = '#ffe6a8'; ctx.strokeStyle = 'rgba(8, 10, 24, .75)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.stroke(); ctx.fill();
          ctx.restore();
          continue;
        }
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
      if (!present(k.a) || !present(k.b) || veiled(k.a, now) || veiled(k.b, now)) return;
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
    if (!h || !h.guide || h.toggle || h.table || !present(h.ring) || S.drag) return;
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
    if (h && h.table) { drawHubPulse(now, h.t0); return; }
    if (h && h.rail != null) { if (!h.nudge) drawStopPulse(h, now); }
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
    p.life -= p.shape === 'bubble' || p.shape === 'shard' ? 0.016 : 0.025;
    const a = Math.max(p.life, 0), s = p.size * (p.shape === 'dot' || !p.shape ? a : 0.6 + 0.6 * a);
    g.globalAlpha = p.shape === 'shard' ? Math.min(1, a * 1.6) : a;
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
    } else if (p.shape === 'shard') {
      // Buz kırığı: düşen, dönen açık mavi üçgen
      p.vy += 0.15; p.rot += 0.12;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.strokeStyle = p.edge || '#4cb8e6'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, -s * 1.4); g.lineTo(s * 1.1, s); g.lineTo(-s, s * 0.7); g.closePath(); g.fill(); g.stroke();
      g.restore();
    } else if (p.shape === 'sprinkle') {
      // Şeker serpintisi: düşen, dönen yuvarlak uçlu çubuk
      p.vy += 0.12; p.rot += 0.15;
      g.lineWidth = 3.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(p.x - Math.cos(p.rot) * s, p.y - Math.sin(p.rot) * s); g.lineTo(p.x + Math.cos(p.rot) * s, p.y + Math.sin(p.rot) * s); g.stroke();
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
  // Yazılar üst üste binmez: ekranda yeni bir yazı varken gelen yazı, öncekinin çıkışından FLOAT_GAP sonra sıraya girer
  const FLOAT_GAP = 650;
  function drawFloaters(now) {
    for (const f of floaters) {
      if (f.queued) continue;
      f.queued = true;
      const prev = floaters.filter(o => o !== f && o.queued && o.t0 + (o.life || 1300) > f.t0).reduce((m, o) => Math.max(m, o.t0), -Infinity);
      if (f.t0 < prev + FLOAT_GAP) f.t0 = prev + FLOAT_GAP;
    }
    floaters = floaters.filter(f => now < f.t0 + (f.life || 1300));
    for (const f of floaters) {
      if (now < f.t0) continue;
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
    // Son halkanın beyaz parlaması
    if (flashT && now - flashT < 320) {
      fctx.fillStyle = `rgba(255,252,235,${0.55 * (1 - (now - flashT) / 320)})`;
      fctx.fillRect(0, 0, fx.width, fx.height);
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
        stepTable(now);
        checkHelp(now);
        drawTable(now);
        drawCouples();
        stepTension(now);
        stepRain(now);
        renderBossBar(now);
        const visible = S.L.rings.map((_, i) => present(i) || (S.fly[i] && now < S.fly[i].t0 + flyMs(S.fly[i])));
        if (S.L.rails) drawRails(now);
        drawDeco(visible, now);
        visible.forEach((v, i) => v && drawRing(i, now));
        drawWeave();
        if (!S.turn && !S.slide && !(S.drag && S.drag.rail != null)) drawOpenPoints(now);
        drawSprings(now);
        drawBombs(now);
        drawIceBadges(now);
        drawMotors(now);
        drawRatchets(now);
        if (S.shellHalves.length) drawShellHalves(now);
        drawChains(visible, now);
        drawPortals(now);
        drawBoilers(now);
        drawTokens(now);
        drawSwitch(now);
        drawHub(now);
        if (S.swPulse && now - S.swPulse < 900) drawSwitchPulse(now, S.swPulse);
        drawCoins(now);
        drawLoot(now);
        drawKeys(now);
        drawHint(now);
        drawFinger(now);
        drawParticles();
      }
      backdrop.draw(now, fxOn() && $('levels').hidden);
      if (!$('levels').hidden && ADV) ADV.draw(now);
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
    // Geliştirme: ?ending (Büyük Makine) ya da ?ending=finale kapanış sahnesini kayda dokunmadan gösterir
    const kind = params.get('ending') === 'finale' ? 'finale' : 'machine';
    applyWorld(W.worldOfGate(kind === 'finale' ? GATE_COUNT : Math.min(GATE_COUNT, MACHINE_END / W.GATE_SIZE)));
    showScreen('home');
    showEnding(kind, true);
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
      if (!$('worldCard').classList.contains('hidden')) { $('worldGo').click(); return; }
      if (!$('pieceCard').classList.contains('hidden')) { $('pieceGo').click(); return; }
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

  // Geliştirme: ?gallery bütün şekilleri süsleriyle gösterir (bulmaca değil, yalnızca görünüş); ?gallery=20 yalnız son 20'yi
  function showGallery() {
    const last = Number(params.get('gallery')) || 0;
    const shapes = window.RingLevels.ANIMALS.slice(-last || 0);
    const host = document.createElement('div');
    host.className = 'gallery';
    host.innerHTML = `<h2>Şekil galerisi</h2><p>${shapes.length} şekil${last ? ' (en yeniler)' : ". İlk 10'u oyundaki, diğerleri yeni"}.</p><div class="g-grid"></div>`;
    document.body.appendChild(host);
    const grid = host.querySelector('.g-grid');
    const items = shapes.map((s, k) => {
      const fig = document.createElement('figure');
      fig.innerHTML = `<canvas width="420" height="420"></canvas><figcaption><b>${s.name}</b>${k >= 10 && !last ? '<span>yeni</span>' : ''}</figcaption>`;
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
    window.__halka = { S, scale: () => scale, progress, ORDER, renderMap, loadLevel, lootOf, ambience, settle, addCombo, badgeCtx, awardBadges, showScreen,
      fxCounts: () => ({ shocks: shocks.length, floaters: floaters.length, lightWaves: lightWaves.length }),
      // haritadaki yolculuğu sınamak için: bu bölüm az önce kazanılmış gibi
      wonLevel: n => { lastWon = n; } };
  }
  requestAnimationFrame(frame);
})();
