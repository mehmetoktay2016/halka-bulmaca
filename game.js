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
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    };
  })();

  // ---- Oyun durumu ----
  const S = {
    levelNo: 1, def: null, L: null,
    angles: [], mask: 0, moves: 0, history: [],
    fly: {}, shake: {}, drag: null, hint: null, won: false,
    shownStars: 3,
    coins: [],      // { link, x, y, taken, phase }
    coinsTaken: 0,  // bu bölümde toplanan; bölüm bitince kasaya eklenir
  };
  let coinFly = []; // { x, y (uygulama koordinatı), t0 }
  let particles = [];
  let confetti = [];

  // ---- Ekran geçişleri ----
  function showScreen(name) {
    for (const id of ['home', 'levels', 'game']) $(id).hidden = id !== name;
    if (name === 'home') renderHome();
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
    if (progress.title == null) progress.title = currentTitle();
    if (progress.seenFrontier == null) progress.seenFrontier = frontier();
    saveProgress();
  }

  function renderHome() {
    const next = frontier();
    applyWorld(W.worldOfGate(W.gateOf(next)));
    $('playLevel').textContent = 'Seviye ' + next;
    $('homeStars').textContent = totalStars();
    $('homeCoins').textContent = progress.coins;
    $('homeScore').textContent = fmt(totalScore());
    $('homeTitle').textContent = progress.title || currentTitle();
    $('promiseLevels').textContent = TOTAL;
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
    });
    S.angles = S.L.startAngles.slice();
    S.coins = tut == null ? placeCoins() : [];
    coinFly = [];
    particles = [];
    confetti = [];
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
    startDef(def, n, null);
    maybeWorldCard(n);
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
    $('soundBtn').setAttribute('aria-pressed', String(progress.sound));
    $('soundBtn').setAttribute('aria-label', progress.sound ? 'Sesi kapat' : 'Sesi aç');
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
    waves.forEach((wave, w) => {
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
        setTimeout(() => { Sound.pop(w); burst(i); }, w * WAVE_MS);
      }
    });
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
      setTimeout(showWin, waves.length * WAVE_MS + FLY_MS);
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

  function burst(i) {
    if (REDUCED) return;
    const r = S.L.rings[i];
    const color = ringColor(i);
    for (let k = 0; k < 26; k++) {
      const a = Math.random() * TAU;
      const sp = 1.5 + Math.random() * 3.5;
      const t = Math.random();
      particles.push({
        x: r.kind === 'bar' ? r.x1 + (r.x2 - r.x1) * t : r.x + Math.cos(a) * r.r,
        y: r.kind === 'bar' ? r.y1 + (r.y2 - r.y1) * t : r.y + Math.sin(a) * r.r,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, size: 2 + Math.random() * 3, color,
      });
    }
  }

  function showWin() {
    if (S.tut != null) { showTutorialWin(); return; }
    const par = S.def.par ?? S.moves;
    const stars = starsFor(S.moves, par);
    const key = idOf(S.levelNo);
    if (stars > (progress.stars[key] || 0)) lastWon = S.levelNo;
    progress.stars[key] = Math.max(progress.stars[key] || 0, stars);
    const earned = S.coins.filter(c => c.taken).length;
    progress.coins += earned;
    S.coinsTaken = 0;
    progress.best = progress.best || {};
    const before = totalScore();
    progress.best[key] = Math.max(progress.best[key] || 0, levelScore(stars, earned));
    const after = totalScore();
    saveProgress();
    $('winCoins').textContent = '+' + earned;
    $('winScore').textContent = '+' + fmt(after - before);
    countScore(before, after);
    $('win').querySelector('.card').classList.remove('tut');
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
    launchConfetti(stars);
    updateHud();
  }

  const TUT_PRAISE = ['Harika!', 'Süper!', 'Çok iyi!', 'Hazırsın!'];
  function showTutorialWin() {
    const last = S.tut === TUTORIAL.length - 1;
    $('win').querySelector('.card').classList.add('tut');
    $('winLevel').textContent = `Deneme ${S.tut + 1} / ${TUTORIAL.length}`;
    $('winTitle').textContent = TUT_PRAISE[S.tut] || 'Harika!';
    $('winNote').textContent = last ? 'Artık gerçek seviyelere hazırsın.' : 'Bir sonraki denemeye geç.';
    $('continue').textContent = last ? 'Oyuna başla' : 'Devam';
    $('win').classList.remove('hidden');
    Sound.win();
    launchConfetti(last ? 3 : 1);
    updateHud();
  }

  let failTimer = 0;
  function showFail() {
    S.failed = true;
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
    if (S.won || S.failed) return;
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
      before: { angles: S.angles.slice(), mask: S.mask, moves: S.moves, taken: S.coins.map(c => c.taken) },
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
    S.history.push(drag.before);
    S.moves++;
    const el = $('movesNum');
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    renderMeter(false);
    settle();
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
  $('soundBtn').onclick = () => {
    progress.sound = !progress.sound;
    saveProgress();
    updateHud();
    Sound.tap();
  };
  $('undo').onclick = () => {
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
  $('hint').onclick = () => {
    if (S.won || S.failed) return;
    if (S.tut != null) { guide(); return; }
    Sound.tap();
    const sol = solveFast(S.L, S.angles, S.mask, 30000);
    if (!sol || !sol.first) { showTip('İpucu bulunamadı, yeniden başlatmayı dene'); return; }
    S.hint = { ...sol.first, t0: performance.now() };
    showTip('Parlayan halkanın boşluğunu sarı halkaya getir');
  };

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
    const active = S.drag && S.L.group[S.drag.ring].includes(i);
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
    drawConfetti();
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
      if (!$('worldCard').classList.contains('hidden')) { $('worldGo').click(); return; }
      if (!$('gateCard').classList.contains('hidden')) { $('gateGo').click(); return; }
      if (!$('ceremony').hidden) { $('ceremony').click(); return; }
      if (!$('fail').classList.contains('hidden')) { $('failRetry').click(); return; }
      if (!$('win').classList.contains('hidden')) { $('win').classList.add('hidden'); showScreen('levels'); return; }
      if (!$('game').hidden) { showScreen(S.tut != null ? 'home' : 'levels'); return; }
      if (!$('levels').hidden) { showScreen('home'); return; }
      AppPlugin.exitApp();
    });
  }

  if (params.has('debug')) window.__halka = { S, scale: () => scale, progress, ORDER, renderMap };
  requestAnimationFrame(frame);
})();
