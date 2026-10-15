// Ekranlar, çizim, dokunma, ses ve efektler. Kurallar logic.js'te, seviyeler levels.js'te.
(() => {
  'use strict';

  const { TAU, DEG, GAP_HALF, angDist, signedDelta, buildLevel,
          pointOpen, cascade, rotate, solveFast, norm } = window.RingLogic;
  const { BOARD, getLevel, getTutorial, TUTORIAL } = window.RingLevels;

  // Oyuncunun gördüğü sıra: 10'ar bölümlük kapılar (levels.js gateOrder).
  // ORDER[n-1] = levels.js'teki kaynak seviye (1-50 normal, 51-60 şekiller).
  const W = window.RingWorlds;
  const ORDER = window.RingLevels.gateOrder(getLevel);
  const TOTAL = ORDER.length;
  const GATE_COUNT = TOTAL / W.GATE_SIZE; // bölümleri hazır olan kapı sayısı
  const srcOf = n => ORDER[n - 1];
  const BAR_COLOR = W.PIECE_COLORS.bar;
  const COLORS = W.PIECE_COLORS.rings;
  const FIXED_COLOR = W.PIECE_COLORS.fixed;
  const STROKE = 13;
  const FLY_MS = 520;
  const WAVE_MS = 170;
  const COIN_MS = 650;
  const HELP_IDLE_MS = 30000; // bu kadar süre hamle yapılmazsa ipucu düğmesi nabız atar
  const BULB_PRICE = 20;      // altın
  const GOLD_GATE_BULBS = 3;  // bir kapının 10 bölümü de 3 yıldız olunca
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
  const idOf = n => String(srcOf(n));
  const starsOf = n => progress.stars[idOf(n)] || 0;
  const frontier = () => window.RingSave.frontier(progress, ORDER);
  const isUnlocked = n => n <= frontier();
  const totalStars = () => Object.values(progress.stars).reduce((a, b) => a + b, 0);
  const starsFor = (moves, par) => (moves <= par ? 3 : moves <= par + 2 ? 2 : 1);
  // Skor: her seviyenin en iyi sonucu sayılır (yıldız başına 100, altın başına 25)
  const levelScore = (stars, coins) => stars * 100 + coins * 25;
  const totalScore = () => Object.values(progress.best || {}).reduce((a, b) => a + b, 0);
  const fmt = n => n.toLocaleString('tr-TR');
  // Hamle hakkı: en iyi çözüm + pay, ama en fazla 10. Aşılırsa seviye başa döner.
  const MAX_MOVES = 10;
  const moveLimit = par => Math.min(MAX_MOVES, par + Math.max(3, Math.ceil(par * 0.6)));

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
      pop: k => tone(380 + k * 70, 0.25, 'sine', 0.2, 880 + k * 90),
      deny: () => tone(150, 0.12, 'square', 0.04),
      tap: () => tone(660, 0.06, 'triangle', 0.06),
      win: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.32, 'triangle', 0.13, null, k * 0.11)),
      fail: () => [392, 330, 262].forEach((f, k) => tone(f, 0.28, 'triangle', 0.12, null, k * 0.16)),
      star: k => tone(880 + k * 220, 0.18, 'sine', 0.12),
      coin: () => { tone(1318, 0.08, 'triangle', 0.09); tone(1976, 0.22, 'triangle', 0.09, null, 0.07); },
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
      // 3 yıldız ışık dalgası
      shine: () => [1568, 1976, 2349, 2637, 3136].forEach((f, k) => tone(f, 0.55, 'sine', 0.04, null, k * 0.07)),
      // Ampul kazanınca: kısa bir ışıltı; düğmeye konunca: yumuşak bir tın
      gift: () => [784, 988, 1175, 1568].forEach((f, k) => tone(f, 0.3, 'sine', 0.08, null, k * 0.07)),
      bulb: () => { tone(1046, 0.18, 'sine', 0.1, 1568); tone(2093, 0.25, 'sine', 0.04, null, 0.05); },
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
    angles: [], mask: 0, moves: 0, history: [],
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
  let floaters = [];   // yükselen yazılar, ör. "Zincir ×3" { text, x, y, t0 } (uygulama koordinatı)
  let lightWaves = []; // 3 yıldız ışık dalgası { x, y, t0 } (uygulama koordinatı)

  // ---- Ekran geçişleri ----
  function showScreen(name) {
    for (const id of ['home', 'levels', 'game', 'trophies']) $(id).hidden = id !== name;
    if (name === 'home') renderHome();
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
      progress.hints++;
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
    el.innerHTML = `${medalHtml(b, true)}<span><small>Yeni rozet</small><b>${b.name}</b><em>+${B.TIERS[b.tier].coins} altın</em></span>`;
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
    $('tabBadges').setAttribute('aria-selected', String(trophyTab === 'badges'));
    $('tabAlbum').setAttribute('aria-selected', String(trophyTab === 'album'));
    $('trophyList').innerHTML = trophyTab === 'badges' ? badgesHtml(ctx, fresh) : albumHtml();
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
        ? `<span class="got">Kazanıldı · +${reward} altın</span>`
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
        <b>${got ? def.name : '???'}</b><small>Kapı ${W.gateOf(n)}</small>${stars}</div>`;
    });
    return `<div class="album-grid">${cards.join('')}</div>
      <p class="album-note">Bazı bölümlerde halkalara takılmış bir hayvan ya da eşya seni bekliyor. Kurtardıkların bu albümde toplanır.</p>`;
  }

  $('homeTrophies').onclick = () => { Sound.tap(); trophyTab = 'badges'; showScreen('trophies'); };
  $('trophiesBack').onclick = () => { Sound.tap(); showScreen('home'); };
  $('tabBadges').onclick = () => { Sound.tap(); trophyTab = 'badges'; renderTrophies(); };
  $('tabAlbum').onclick = () => { Sound.tap(); trophyTab = 'album'; renderTrophies(); };

  function renderHome() {
    const next = frontier();
    applyWorld(W.worldOfGate(W.gateOf(next)));
    $('playLevel').textContent = 'Seviye ' + next;
    $('homeStars').textContent = totalStars();
    $('homeCoins').textContent = progress.coins;
    $('homeBulbs').textContent = progress.hints;
    $('trophyDot').hidden = !unseenBadges().length;
    $('homeScore').textContent = fmt(totalScore());
    $('homeTitle').textContent = progress.title || currentTitle();
    $('promiseLevels').textContent = TOTAL;
    $('promiseWorlds').textContent = W.WORLDS.length;
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
    const ext = def.rings.map(r => (r.type === 'bar'
      ? [Math.min(r.x1, r.x2), Math.min(r.y1, r.y2), Math.max(r.x1, r.x2), Math.max(r.y1, r.y2)]
      : [r.x - r.r, r.y - r.r, r.x + r.r, r.y + r.r]));
    const x0 = Math.min(...ext.map(e => e[0])), y0 = Math.min(...ext.map(e => e[1]));
    const x1 = Math.max(...ext.map(e => e[2])), y1 = Math.max(...ext.map(e => e[3]));
    const k = 44 / Math.max(x1 - x0, y1 - y0);
    const ox = (48 - (x1 - x0) * k) / 2 - x0 * k, oy = (48 - (y1 - y0) * k) / 2 - y0 * k;
    const sw = Math.max(1.6, 13 * k);
    const parts = def.rings.map((r, i) => {
      const c = colored ? (r.type === 'bar' ? BAR_COLOR : r.fixed ? FIXED_COLOR : r.color || COLORS[i % COLORS.length]) : 'rgba(255,255,255,.26)';
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

  function nodeHtml(n, state, def) {
    const got = starsOf(n);
    const stars = `<span class="mini">${[1, 2, 3].map(k => `<span class="star-ico${k <= got ? ' on' : ''}"></span>`).join('')}</span>`;
    if (def.name) return shapeSvg(def, state === 'done') + (state === 'done' ? stars : '');
    if (state === 'locked') return LOCK_SVG;
    return `<span class="num">${n}</span>` + (state === 'done' ? stars : '');
  }

  function archHtml(g, geo) {
    const gate = W.GATES[g - 1];
    const world = W.worldById(gate.world);
    const teaser = g > GATE_COUNT;
    const open = !teaser && isUnlocked(W.gateStart(g)) && (g === 1 || progress.rewards['gate:' + g]);
    const cls = ['arch', open ? 'open' : 'locked', !teaser && gateGold(g) ? 'gold' : '', teaser ? 'teaser' : ''].join(' ');
    const label = teaser
      ? `<span class="arch-sub">Yakında</span>`
      : `<span class="arch-stars"><span class="star-ico"></span>${gateStars(g)} / ${W.GATE_SIZE * 3}</span>`;
    return `<div class="${cls}" data-gate="${g}" style="left:${geo.arches[g].x}px;top:${geo.arches[g].y}px;--wa:${world.theme.accent}">
      ${W.isWorldStart(g) ? `<span class="arch-world">${world.name}</span>` : ''}
      <svg viewBox="0 0 230 100" aria-hidden="true">
        <path class="arch-shadow" d="M22 100 V56 A93 48 0 0 1 208 56 V100"/>
        <path class="arch-line" d="M22 100 V56 A93 48 0 0 1 208 56 V100"/>
        <path class="arch-shine" d="M22 100 V56 A93 48 0 0 1 208 56 V100"/>
        <g class="arch-lock" transform="translate(115 30)">
          <circle class="l1" cx="-9" cy="-3" r="10"/><circle class="l2" cx="9" cy="-3" r="10"/><circle class="l3" cx="0" cy="9" r="10"/>
        </g>
      </svg>
      <span class="arch-name">Kapı ${g} · ${gate.name}</span>
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
      const cls = ['node', state, def.name ? (W.posInGate(n) === W.GATE_SIZE ? 'final' : 'shape') : '',
        n === front ? 'current' : '', fresh ? 'fresh' : '', n === lastWon ? 'won' : '',
        state !== 'locked' && def.name ? 'colored' : ''].join(' ');
      const label = `Seviye ${n}${def.name ? ', ' + def.name : ''}, ` +
        (state === 'locked' ? 'kilitli' : state === 'done' ? `${starsOf(n)} yıldız` : 'oynanmadı');
      html += `<button class="${cls}" data-n="${n}" style="left:${geo.nodes[n].x}px;top:${geo.nodes[n].y}px"
        aria-label="${label}"${state === 'locked' ? ' disabled' : ''}>${nodeHtml(n, state, def)}</button>`;
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
        aria-label="Kapı ${g}${teaser ? ', yakında' : locked ? ', kilitli' : ''}" style="--wa:${W.worldOfGate(g).theme.accent}">${g}</button>`;
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
        progress.hints++;
        rewards.push('<span class="chip bulb">+1 ampul</span>');
      }
      if (p.newTitle) {
        progress.title = p.newTitle;
        rewards.push(`<span class="chip rank-chip">Yeni unvan: <b>${p.newTitle}</b></span>`);
      }
      saveProgress();
      const gate = p.gate ? W.GATES[p.gate - 1] : null;
      const world = p.gate ? W.worldOfGate(p.gate) : null;
      $('gateEyebrow').textContent = p.gate ? `Kapı ${p.gate} açıldı` : 'Yolculuk';
      $('gateTitle').textContent = gate ? gate.name : 'Tebrikler!';
      $('gateWorld').textContent = p.gate
        ? (W.isWorldStart(p.gate) ? `Yeni dünya: ${world.name}` : world.name)
        : (GATE_COUNT < W.GATES.length ? 'Bu dünyayı bitirdin. Yeni kapılar yakında açılacak.' : 'Bütün kapıları açtın.');
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

  function segDist(px, py, b) {
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
    const t = Math.max(0, Math.min(1, ((px - b.x1) * dx + (py - b.y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (b.x1 + dx * t), py - (b.y1 + dy * t));
  }
  function barAxis(b) {
    const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
    return { ux: (b.x2 - b.x1) / len, uy: (b.y2 - b.y1) / len, len };
  }

  function startDef(def, levelNo, tut) {
    Object.assign(S, {
      levelNo, tut, def, L: buildLevel(def), mask: 0, moves: 0, history: [],
      fly: {}, shake: {}, drag: null, hint: null, won: false, failed: false, shownStars: 3,
      coinsTaken: 0, limit: tut == null ? moveLimit(def.par || 5) : Infinity,
      auto: null, help: { lastAct: performance.now(), shown: false }, usedHint: false,
    });
    closeHintMenu();
    $('hint').classList.remove('pulse');
    S.angles = S.L.startAngles.slice();
    S.coins = tut == null ? placeCoins() : [];
    coinFly = [];
    landBulbs();
    particles = [];
    confetti = [];
    shocks = [];
    floaters = [];
    lightWaves = [];
    clearTimeout(failTimer);
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
    $('coachStep').textContent = `Deneme ${i + 1} / ${TUTORIAL.length}`;
    $('coachTitle').textContent = def.title;
    $('coachText').textContent = def.text;
    hideTip();
    guide();
  }

  // Denemede sıradaki hamleyi her zaman göster
  function guide() {
    if (S.tut == null || S.won) return;
    const sol = solveFast(S.L, S.angles, S.mask, 20000);
    S.hint = sol && sol.first ? { ...sol.first, t0: performance.now(), guide: true } : null;
  }

  function loadLevel(n) {
    const src = srcOf(n);
    const def = getLevel(src);
    if (!def) { showTip('Bu seviye yüklenemedi'); return; }
    applyWorld(W.worldOfGate(W.gateOf(n)));
    if (n !== failedLevel) failedLevel = null;
    startDef(def, n, null);
    maybeWorldCard(n);
    if (dailyGift()) return;
    if (src === 1) showTip('Halkayı sürükleyerek döndür', 4000);
    else if (src === 2) showTip('Parlayan nokta: halka oradan geçebilir', 4000);
    else if (src === 5) showTip('Gri halkalar kilitli, dönmez', 3500);
    else if (src === 7) showTip('Noktalı çizgiyle bağlı halkalar birlikte döner', 4000);
    else if (src === 8) showTip('Bu halkanın iki boşluğu var', 3500);
    else if (src === 9) showTip('Çubuk dönmez: halkaların boşluğunu çubuğa getir', 4500);
    else if (def.name && !progress.shapeTip) {
      showTip(`${def.name} halkalara takılmış! Onu kurtar`, 3500);
      progress.shapeTip = true;
      saveProgress();
    }
    else if (!progress.coinTip && S.coins.length) {
      showTip('Altını almak için yanındaki halkayı serbest bırak', 4000);
      progress.coinTip = true;
      saveProgress();
    } else hideTip();
  }

  function renderMeter(reset) {
    const par = S.def.par ?? 99;
    const stars = starsFor(S.moves, par);
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
    $('levelLabel').textContent = S.tut != null ? 'Nasıl oynanır'
      : 'Seviye ' + S.levelNo + ' · ' + (S.def.name || W.GATES[W.gateOf(S.levelNo) - 1].name);
    const left = S.limit - S.moves;
    $('movesNum').textContent = S.tut != null ? S.moves : left;
    $('movesLbl').textContent = S.tut != null ? 'hamle' : 'hamle kaldı';
    $('movesNum').classList.toggle('warn', S.tut == null && left <= 2 && !S.won);
    $('scoreNum').textContent = fmt(shownScore);
    $('coinNum').textContent = progress.coins + S.coinsTaken;
    $('undo').disabled = !S.history.length || S.won || S.failed;
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
    const { mask, waves } = cascade(S.L, S.angles, S.mask);
    const now = performance.now();
    const finale = mask === S.L.full && !S.won;
    waves.forEach((wave, w) => {
      const last = finale && w === waves.length - 1;
      if (last) setTimeout(() => finaleBlast(wave), w * WAVE_MS);
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
        S.fly[i] = { t0: now + w * WAVE_MS, dx, dy };
        setTimeout(() => { Sound.pop(w); burst(i, last); }, w * WAVE_MS);
      }
    });
    const freed = waves.flat();
    if (freed.length >= 2) setTimeout(() => showChain(freed), (waves.length - 1) * WAVE_MS);
    S.mask = mask;
    for (const c of S.coins) {
      if (c.taken) continue;
      const k = S.L.links[c.link];
      if (!(mask & (1 << k.a)) && !(mask & (1 << k.b))) continue;
      c.taken = true;
      const w = waves.findIndex(wv => wv.includes(k.a) || wv.includes(k.b));
      collectCoin(c, Math.max(w, 0) * WAVE_MS);
    }
    if (waves.length && navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* yok say */ } }
    if (mask === S.L.full && !S.won) {
      S.won = true;
      setTimeout(showWin, waves.length * WAVE_MS + FLY_MS + (fxOn() ? 350 : 0));
    }
    updateHud();
  }

  // ---- Altınlar ----
  // Rastgele birkaç kesişimin ortasına (iki halkanın ortak alanına) altın koyar.
  function placeCoins() {
    const L = S.L;
    const order = L.links.map((_, i) => i).sort(() => Math.random() - 0.5);
    const want = Math.min(L.links.length, 1 + Math.floor(Math.random() * 3));
    const out = [];
    for (const li of order) {
      if (out.length >= want) break;
      const k = L.links[li];
      if (L.rings[k.a].kind === 'bar' || L.rings[k.b].kind === 'bar' || k.pts.length < 2) continue;
      const x = (k.pts[0].x + k.pts[1].x) / 2;
      const y = (k.pts[0].y + k.pts[1].y) / 2;
      const clear = L.rings.every((r, i) => i === k.a || i === k.b ||
        (r.kind === 'bar' ? segDist(x, y, r) > 18 : Math.abs(Math.hypot(x - r.x, y - r.y) - r.r) > 18));
      if (clear && !out.some(c => Math.hypot(c.x - x, c.y - y) < 30)) {
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
    coinFly.push({ x: start.x, y: start.y, t0: performance.now() + delay });
    setTimeout(() => Sound.coin(), delay);
    setTimeout(() => {
      if (!c.taken || S.won) return; // geri alındıysa ya da bölüm bittiyse sayma
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
    }
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
        life: 1, size: 2 + Math.random() * 3, color,
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

  // Bir hamlede birden çok halka açılırsa: "Zincir ×N" (N = açılan halka sayısı)
  function showChain(freed) {
    if (S.tut != null) return;
    const n = freed.length;
    const c = waveCenter(freed);
    const p = boardToApp(c.x, c.y);
    const w = $('app').clientWidth;
    floaters.push({ text: `Zincir ×${n}`, x: Math.max(80, Math.min(w - 80, p.x)), y: p.y, t0: performance.now(), big: n >= 3 });
    Sound.chain(n);
    stat('chains');
    progress.stats.bestChain = Math.max(progress.stats.bestChain || 0, n);
    saveProgress();
    awardBadges(false);
  }

  function showWin() {
    if (S.tut != null) { showTutorialWin(); return; }
    const par = S.def.par ?? S.moves;
    const stars = starsFor(S.moves, par);
    const key = idOf(S.levelNo);
    const firstClear = !progress.stars[key];
    if (stars > (progress.stars[key] || 0)) lastWon = S.levelNo;
    progress.stars[key] = Math.max(progress.stars[key] || 0, stars);
    const earned = S.coins.filter(c => c.taken).length;
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
    saveProgress();
    $('winNote').textContent = '';
    $('winRewards').innerHTML = (firstClear && S.def.name ? `<span class="chip album-chip">Albüme eklendi: <b>${S.def.name}</b></span>` : '') +
      (goldGate ? `<span class="chip bulb">Altın kapı: <b>+${GOLD_GATE_BULBS} ampul</b></span>` : '');
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
    $('winLevel').textContent = S.def.name ? `${S.def.name} kurtarıldı` : `Seviye ${S.levelNo} tamamlandı`;
    $('winTitle').textContent = stars === 3 ? 'Mükemmel!' : stars === 2 ? 'Harika!' : 'Başardın!';
    $('stars').innerHTML = [1, 2, 3].map(k =>
      `<span class="star-ico${k <= stars ? '' : ' off'}" style="animation-delay:${200 + k * 180}ms"></span>`).join('');
    $('winMoves').textContent = S.moves;
    $('winPar').textContent = par;
    $('continue').textContent = W.posInGate(S.levelNo) === W.GATE_SIZE || S.levelNo >= TOTAL ? 'Haritaya dön' : 'Sonraki seviye';
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

  const TUT_PRAISE = ['Harika!', 'Süper!', 'Çok iyi!', 'Hazırsın!'];
  function showTutorialWin() {
    const last = S.tut === TUTORIAL.length - 1;
    $('win').querySelector('.card').classList.add('tut');
    $('win').querySelector('.card').classList.remove('perfect');
    $('winLevel').textContent = `Deneme ${S.tut + 1} / ${TUTORIAL.length}`;
    $('winTitle').textContent = TUT_PRAISE[S.tut] || 'Harika!';
    $('winNote').textContent = last ? 'Artık gerçek seviyelere hazırsın.' : 'Bir sonraki denemeye geç.';
    $('winRewards').innerHTML = '';
    $('continue').textContent = last ? 'Oyuna başla' : 'Devam';
    $('win').classList.remove('hidden');
    Sound.win();
    launchConfetti(last ? 3 : 1);
    updateHud();
  }

  let failTimer = 0;
  function showFail() {
    S.failed = true;
    failedLevel = S.levelNo;
    S.hint = null;
    $('fail').classList.remove('hidden');
    Sound.fail();
    if (navigator.vibrate) { try { navigator.vibrate([30, 60, 30]); } catch (e) { /* yok say */ } }
    failTimer = setTimeout(() => loadLevel(S.levelNo), 2200);
    updateHud();
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

  function launchConfetti(stars) {
    if (REDUCED) return;
    const w = $('app').clientWidth;
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
      const d = r.kind === 'bar' ? segDist(p.x, p.y, r) + 4 : Math.abs(Math.hypot(p.x - r.x, p.y - r.y) - r.r);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  canvas.addEventListener('pointerdown', e => {
    if (S.won || S.failed || S.auto) return;
    closeHintMenu();
    S.help.lastAct = performance.now();
    const p = toBoard(e);
    const i = hitRing(p);
    if (i < 0) return;
    if (!S.L.rotatable[i]) {
      for (const k of S.L.group[i]) S.shake[k] = performance.now();
      Sound.deny();
      if (isBar(i)) showTip('Çubuk dönmez: halkaların boşluğunu çubuğa getir');
      return;
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sentetik olay */ }
    const r = S.L.rings[i];
    S.drag = {
      ring: i,
      lastAng: Math.atan2(p.y - r.y, p.x - r.x),
      total: 0,
      notch: 0,
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
    S.angles = rotate(S.L, S.angles, S.drag.ring, d);
    // her 15 derecede bir hafif "tık" sesi
    const notch = Math.round(S.drag.total / (15 * DEG));
    if (notch !== S.drag.notch) { S.drag.notch = notch; Sound.tick(); }
  });

  function endDrag() {
    if (!S.drag) return;
    const drag = S.drag;
    S.drag = null;
    if (Math.abs(drag.total) < 3 * DEG) { S.angles = drag.before.angles; return; }
    commitMove(drag.before);
  }

  const snapshot = () => ({ angles: S.angles.slice(), mask: S.mask, moves: S.moves, taken: S.coins.map(c => c.taken) });

  // Bir hamle tamamlandı (elle ya da "Hamleyi yap" ile)
  function commitMove(before) {
    S.history.push(before);
    S.moves++;
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
  function renderSettings() {
    for (const b of toggles) b.setAttribute('aria-checked', String(progress[b.dataset.key] !== false));
  }
  if (REDUCED) toggles.find(b => b.dataset.key === 'effects').querySelector('small').textContent = 'Cihazda hareketi azaltma açık, efektler kapalı';
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
  $('undo').onclick = () => {
    if (S.auto) return;
    const prev = S.history.pop();
    if (!prev || S.won || S.failed) return;
    Sound.tap();
    S.angles = prev.angles;
    S.mask = prev.mask;
    S.moves = prev.moves;
    S.coins.forEach((c, k) => { c.taken = prev.taken[k]; });
    S.coinsTaken = S.coins.filter(c => c.taken).length;
    coinFly = [];
    S.fly = {};
    S.hint = null;
    renderMeter(false);
    updateHud();
    guide();
  };
  const restart = () => (S.tut != null ? loadTutorial(S.tut) : loadLevel(S.levelNo));
  $('reset').onclick = () => { Sound.tap(); restart(); };
  $('again').onclick = () => { Sound.tap(); restart(); };
  $('failRetry').onclick = () => { Sound.tap(); clearTimeout(failTimer); loadLevel(S.levelNo); };
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
    // Kapının finalinden sonra haritaya dönülür: orada yeni kapı açılır
    if (W.posInGate(S.levelNo) !== W.GATE_SIZE && S.levelNo < TOTAL && isUnlocked(S.levelNo + 1)) loadLevel(S.levelNo + 1);
    else { $('win').classList.add('hidden'); showScreen('levels'); }
  };
  // ---- İpucu: ampul sayacı ve kademeli ipucu ----
  // Dürtme her zaman ücretsiz; İpucu ve Hamleyi yap birer ampul. 1. kapıda ve denemelerde hepsi ücretsiz.
  const hintsFree = () => S.tut != null || W.gateOf(S.levelNo) === 1;

  function renderHintCount() {
    const el = $('hintCount');
    const free = hintsFree();
    const shown = progress.hints - bulbsInAir;
    el.textContent = free ? '∞' : shown;
    el.classList.toggle('empty', !free && shown <= 0);
    $('hint').setAttribute('aria-label', free ? 'İpucu (ücretsiz)' : `İpucu (${shown} ampul)`);
  }

  function openHintMenu() {
    const free = hintsFree();
    for (const b of $('hintMenu').querySelectorAll('.hint-opt')) {
      if (b.dataset.tier === 'nudge') continue;
      const cost = b.querySelector('.cost');
      cost.innerHTML = free ? 'Ücretsiz' : '<i class="bulb-ico"></i>1';
      cost.classList.toggle('free', free);
      b.classList.toggle('locked', !free && progress.hints <= 0);
    }
    $('hintBank').innerHTML = free ? 'Bu kapıda bütün ipuçları ücretsiz.'
      : progress.hints > 0 ? `Ampulün: <b>${progress.hints}</b>` : 'Ampulün kalmadı. Dürtme her zaman ücretsiz.';
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
    $('buyNote').textContent = have >= BULB_PRICE ? `Altının: ${have}` : `${BULB_PRICE - have} altın daha topla (sende ${have})`;
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
    progress.hints++;
    saveProgress();
    bulbsInAir++;
    showTip('Günün hediyesi: 1 ampul', 3500);
    setTimeout(() => {
      const ar = $('app').getBoundingClientRect(), sr = $('stage').getBoundingClientRect();
      flyBulbs(1, sr.left - ar.left + sr.width / 2, sr.top - ar.top + sr.height / 2, true);
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
    if (S.won || S.failed || S.auto) return;
    const cost = tier === 'nudge' || hintsFree() ? 0 : 1;
    if (cost > progress.hints) { Sound.deny(); showTip('Ampulün kalmadı. Ücretsiz dürtmeyi dene'); return; }
    closeHintMenu();
    const sol = solveFast(S.L, S.angles, S.mask, 30000);
    // Çözüm bulunamazsa ampul harcanmaz
    if (!sol || !sol.first) { showTip('İpucu bulunamadı, yeniden başlatmayı dene'); return; }
    if (cost) {
      progress.hints -= cost;
      saveProgress();
      const el = $('hintCount');
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
    $('hint').classList.remove('pulse');
    S.help.lastAct = performance.now();
    S.usedHint = true;
    stat('hintsUsed');
    saveProgress();
    awardBadges(false);
    Sound.tap();
    const now = performance.now();
    if (tier === 'nudge') {
      S.hint = { ...sol.first, t0: now, nudge: true };
      showTip('Parlayan halkayı çevir');
    } else if (tier === 'hint') {
      S.hint = { ...sol.first, t0: now };
      showTip('Parlayan halkanın boşluğunu sarı halkaya getir');
    } else {
      S.hint = null;
      hideTip();
      S.auto = { ...sol.first, done: 0, notch: 0, t0: now, before: snapshot(),
                 ms: 300 + Math.abs(sol.first.delta) / DEG * 2.5 };
    }
    updateHud();
  }

  $('hint').onclick = () => {
    if (S.won || S.failed || S.auto) return;
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
    const notch = Math.round(a.done / (15 * DEG));
    if (notch !== a.notch) { a.notch = notch; Sound.tick(); }
    if (t >= 1) { S.auto = null; commitMove(a.before); }
  }

  // Akıllı yardım: en iyi hamle sayısı aşıldıysa ya da uzun süre hamle yoksa ipucu düğmesi nabız atar
  function checkHelp(now) {
    if (S.tut != null || S.won || S.failed || S.auto || S.hint || S.help.shown) return;
    if (!$('win').classList.contains('hidden') || !$('worldCard').classList.contains('hidden') || !$('settings').classList.contains('hidden')) {
      S.help.lastAct = now;
      return;
    }
    const stuck = S.moves > (S.def.par ?? 99) || now - S.help.lastAct > HELP_IDLE_MS;
    if (!stuck) return;
    S.help.shown = true;
    $('hint').classList.add('pulse');
    if (!progress.helpTip) {
      showTip('Takıldıysan ipucuna dokun: dürtme ücretsiz', 4000);
      progress.helpTip = true;
      saveProgress();
    }
  }

  // ---- Çizim ----
  function ringColor(i) {
    if (S.L.rings[i].kind === 'bar') return BAR_COLOR;
    if (S.L.rings[i].fixed) return FIXED_COLOR;
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
    const ring = S.L.rings[i];
    const { cx, cy, alpha, grow } = ringPose(i, now);
    if (S.shake[i] != null && now - S.shake[i] >= 350) delete S.shake[i];
    ctx.save();
    ctx.globalAlpha = alpha;
    if (grow !== 1) { ctx.translate(cx, cy); ctx.scale(grow, grow); ctx.translate(-cx, -cy); }
    const color = ringColor(i);
    const mover = S.drag ? S.drag.ring : S.auto ? S.auto.ring : -1;
    const active = mover >= 0 && S.L.group[mover].includes(i);
    if (active) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
    }
    strokeRing(ring, S.angles[i], 'rgba(0,0,0,.4)', STROKE + 6, cx + 2, cy + 4);
    ctx.shadowBlur = 0;
    strokeRing(ring, S.angles[i], color, STROKE, cx, cy);
    strokeRing(ring, S.angles[i], 'rgba(255,255,255,.3)', 3, cx - 2, cy - 2);
    if (ring.fixed) drawLock(cx, cy);
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
        if (ring.kind !== 'bar' && ring.gaps.some(g => angDist(angle + g, angP) < GAP_HALF + seg)) return;
        // üstteki parçanın kesişim çevresindeki küçük bölümü
        const piece = (s, ox = 0, oy = 0) => {
          ctx.beginPath();
          if (ring.kind === 'bar') {
            const { ux, uy } = barAxis(ring);
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
        ctx.strokeStyle = ring.kind === 'bar' ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.3)';
        ctx.lineWidth = 3;
        piece(1, ring.kind === 'bar' ? -1.5 : -2, ring.kind === 'bar' ? -1.5 : -2);
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
        if (!pointOpen(S.L, k, p, S.angles)) continue;
        ctx.save();
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 14;
        ctx.fillStyle = `rgba(255,255,255,${0.9 * pulse})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, TAU); ctx.fill();
        ctx.restore();
      }
    });
  }

  function drawCouples() {
    const groups = new Map();
    S.L.rings.forEach((_, i) => {
      if (S.L.group[i].length < 2 || !present(i)) return;
      const g = S.L.groupId[i];
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(i);
    });
    ctx.save();
    for (const members of groups.values()) {
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = S.def.deco ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.35)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let m = 1; m < members.length; m++) {
        const a = S.L.rings[members[m - 1]], b = S.L.rings[members[m]];
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const i of members) {
        const r = S.L.rings[i];
        ctx.fillStyle = ringColor(i);
        ctx.beginPath(); ctx.arc(r.x, r.y, 7, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Denemede: parmak, halkayı tutup gösterilen yöne sürükler (döngü halinde)
  function drawFinger(now) {
    const h = S.hint;
    if (!h || !h.guide || !present(h.ring) || S.drag) return;
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
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= 0.025;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * Math.max(p.life, 0), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
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

  // "Zincir ×N": büyüyerek belirir, yükselir ve söner
  const FLOAT_FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  function drawFloaters(now) {
    floaters = floaters.filter(f => now < f.t0 + 1300);
    for (const f of floaters) {
      const t = (now - f.t0) / 1300;
      const pop = !fxOn() ? 1 : t < 0.12 ? 0.5 + (t / 0.12) * 0.7 : t < 0.25 ? 1.2 - ((t - 0.12) / 0.13) * 0.2 : 1;
      const size = f.big ? 38 : 32;
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
      const grd = fctx.createLinearGradient(0, -size / 2, 0, size / 2);
      grd.addColorStop(0, '#fff3b0');
      grd.addColorStop(1, '#ffb52e');
      fctx.fillStyle = grd;
      fctx.fillText(f.text, 0, 0);
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
      c.vx *= 0.985; c.vy += 0.28;
      c.rot += c.vr;
      c.life -= 0.004;
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
        checkHelp(now);
        drawCouples();
        const visible = S.L.rings.map((_, i) => present(i) || (S.fly[i] && now < S.fly[i].t0 + FLY_MS));
        drawDeco(visible, now);
        visible.forEach((v, i) => v && drawRing(i, now));
        drawWeave();
        drawOpenPoints(now);
        drawCoins(now);
        drawHint(now);
        drawFinger(now);
        drawParticles();
      }
      backdrop.draw(now, fxOn() && $('levels').hidden);
      if (!$('levels').hidden) drawMapFx(now);
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
    if (el) el.textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
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

  if (params.has('debug')) {
    window.__halka = { S, scale: () => scale, progress, ORDER, renderMap, ambience, settle, badgeCtx, awardBadges, showScreen,
      fxCounts: () => ({ shocks: shocks.length, floaters: floaters.length, lightWaves: lightWaves.length }) };
  }
  requestAnimationFrame(frame);
})();
