// Müzik (2.5, Z15-Z16): oyunun içinde WebAudio ile üretilen etkileşimli müzik (dosya yok, telif yok).
// Majör pentatonik: arpej, ezgi ("halka motifi": notalar çember gibi yükselip başa döner), yumuşak pad ve bas.
// Her dünyanın kendi çeşitlemesi (STYLES): ton, tempo ve üç çalgı (ezgi, arpej, kurtuluş notası); ezgi aynı kalır.
// Oyuna bağlı (dopamin katmanı):
// - kurtulan halkanın notası bir sonraki 8'liğe ve o anki akora oturur; birkaç halka birden kurtulursa yükselerek dağılır
// - tahta boşaldıkça katman girer: pad + bas, arpej, tıkırtı, ezgi
// - zincir ve kombo parıltı çalar; kusursuz seri zafer cıngılı
// - son halkada ritim durur, V akorundan I'e çözülür. Hamle sınırında gerilim yok.
// Özel anlar (Z17): Dev Halka bölümü ağır davul ve pompalayan basla (yenilince gümbürtü + parıltı),
// Altın Yağmuru 130 BPM, bütün katmanlar açık, 16'lık arpej ve tıkırtı.
// Prototip: prototip/muzik.html (A · Bahçe seçildi); dünyaları dinlemek için prototip/dunya_muzik.html.
(function (root) {
  'use strict';

  const VOLUME = 0.4; // oyuncunun ayarı %100'ken ana seviye (oyun sesleri öne çıksın)
  // 4 ölçülük akor döngüsü (I, vi, IV, V; kökten yarım ses) ve bas kökleri
  const CHORDS = [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], BASS = [0, -3, 5, 7];
  // 8 ölçülük ezgi: [adım (16'lık), nota, uzunluk]
  const MELODY = [
    [[0, 16, 4], [4, 19, 4], [8, 21, 4], [12, 19, 4]], [[0, 16, 6], [6, 12, 2], [8, 14, 8]],
    [[0, 21, 4], [4, 24, 4], [8, 21, 4], [12, 19, 4]], [[0, 19, 8], [8, 14, 4], [12, 16, 4]],
    [[0, 16, 4], [4, 19, 4], [8, 21, 4], [12, 24, 4]], [[0, 26, 4], [4, 24, 4], [8, 21, 8]],
    [[0, 21, 4], [4, 19, 4], [8, 16, 4], [12, 14, 4]], [[0, 12, 12]],
  ];
  // arpej: 8'lik, akor notası sırası (-1 sus), vurgulu adımlar
  const ARP = [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 1, -1], ACCENT = [0, 8];
  // Dünyaların çeşitlemesi: [kök (MIDI), BPM, ezgi, arpej, kurtuluş notası]
  const STYLES = {
    vadi: [60, 96, 'celesta', 'marimba', 'celesta'],
    atolye: [62, 98, 'kalimba', 'pluck', 'kalimba'],
    saat: [60, 92, 'musicBox', 'pluck', 'musicBox'],
    zindan: [57, 88, 'flute', 'pluck', 'kalimba'],
    sehir: [65, 100, 'organ', 'marimba', 'glock'],
    fabrika: [64, 102, 'steel', 'kalimba', 'steel'],
    uzay: [62, 90, 'glock', 'celesta', 'glock'],
    usta: [59, 96, 'organ', 'glock', 'celesta'],
    lunapark: [58, 104, 'organ', 'marimba', 'glock'],
    santral: [62, 100, 'steel', 'pluck', 'steel'],
    fener: [65, 94, 'flute', 'kalimba', 'celesta'],
    rasathane: [56, 90, 'glock', 'musicBox', 'glock'],
    fisek: [57, 104, 'steel', 'glock', 'glock'],
    buzul: [64, 92, 'musicBox', 'celesta', 'musicBox'],
    degirmen: [55, 100, 'organ', 'pluck', 'marimba'],
    buyu: [61, 94, 'celesta', 'glock', 'musicBox'],
  };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  // Kayıtların örnekleme hızı: telefonda bellek ve işlem az, tiz çalgılar için yeterli
  const SR = 24000;

  function Music(getContext) {
    let live = null;                                // canlı çıkış: { ac, bus, verb }
    let ac = null, bus = null, verb = null;         // çalgıların o an yazdığı yer (canlı çıkış ya da kayıt)
    let level = 0.4, done = 0, freedN = 0, cadEnd = 0, playing = false, want = false;
    let wid = 'vadi', style = STYLES.vadi, mode = null;    // mode: null, 'boss' (Dev Halka), 'rain' (Altın Yağmuru)
    let cur = null, src = null, gains = [], t0 = 0;        // çalan kayıt, kaynağı, katman sesleri, başlangıcı
    const cache = new Map();                               // dünya:kip -> kayıt sözü; bellekte en çok iki
    const sp = () => 60 / (mode === 'rain' ? 130 : style[1]) / 4; // 16'lık süresi (sn)
    const use = o => { ({ ac, bus, verb } = o); };

    // yankı: iki geri beslemeli gecikme (evrişimli yankı telefonda ağır)
    function makeVerb(cx, dest) {
      const v = cx.createGain(), wet = cx.createGain(); wet.gain.value = 0.22; wet.connect(dest);
      for (const [dt, fb] of [[0.137, 0.35], [0.211, 0.3]]) {
        const dl = cx.createDelay(1), lp = cx.createBiquadFilter(), back = cx.createGain();
        dl.delayTime.value = dt; lp.type = 'lowpass'; lp.frequency.value = 2500; back.gain.value = fb;
        v.connect(dl); dl.connect(lp); lp.connect(back); back.connect(dl); lp.connect(wet);
      }
      return v;
    }
    function setup() {
      const cx = getContext();
      if (!cx) return false;
      if (!live) {
        // sınırlayıcı (taşma olmasın); 150 Hz altı ve 5 kHz üstü kesilir: telefon hoparlörü bu aralıklarda zorlanıp cızırdar
        const lim = cx.createDynamicsCompressor();
        lim.threshold.value = -12; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
        const hp = cx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 150; hp.Q.value = 0.7;
        const lp = cx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000; lp.Q.value = 0.7;
        const master = cx.createGain(); master.gain.value = 0; master.connect(hp); hp.connect(lp); lp.connect(lim); lim.connect(cx.destination);
        live = { ac: cx, bus: master, verb: makeVerb(cx, master) };
      }
      use(live);
      return true;
    }
    function out(node, dry, wet) {
      const d = ac.createGain(); d.gain.value = dry; node.connect(d); d.connect(bus);
      if (wet) { const w = ac.createGain(); w.gain.value = wet; node.connect(w); w.connect(verb); }
    }
    // zarf: a sürede peak'e çıkar; hold verilirse o ana dek kalır, rel sürede söner
    function env(t, a, peak, hold, rel) {
      const g = ac.createGain(), top = Math.max(a, hold || 0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      if (hold) g.gain.setValueAtTime(peak, t + top);
      g.gain.exponentialRampToValueAtTime(0.0001, t + top + rel);
      return g;
    }
    function osc(type, f, t, end, dest, detune = 0) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
      o.connect(dest); o.start(t); o.stop(end); return o;
    }
    // kısmi tonlar: [[frekans çarpanı, güç]...] aynı zarfta (çan, kutu, kalimba)
    function partials(t, m, list, g, end) {
      for (const [k, a] of list) { const q = ac.createGain(); q.gain.value = a; q.connect(g); osc('sine', hz(m) * k, t, end, q); }
    }
    function lowpass(hzv, q = 1) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = hzv; f.Q.value = q; return f; }

    // ---- çalgılar (t: başlangıç, m: MIDI, v: güç, d: süre sn; vurmalılar d'yi kullanmaz) ----
    const INST = {
      marimba(t, m, v) {
        const g = env(t, 0.004, 0.32 * v, 0, 0.55); osc('sine', hz(m), t, t + 0.7, g);
        const h = env(t, 0.002, 0.08 * v, 0, 0.07); osc('sine', hz(m) * 4, t, t + 0.12, h);
        out(g, 1, 0.3); out(h, 1, 0);
      },
      celesta(t, m, v) { const g = env(t, 0.004, 0.22 * v, 0, 1.3); partials(t, m, [[1, 1], [2, 0.3]], g, t + 1.5); out(g, 0.8, 0.9); },
      // müzik kutusu: bir oktav yukarıda, tiz uyumsuz kısmi tonla tınlayan dil
      musicBox(t, m, v) { const g = env(t, 0.002, 0.2 * v, 0, 1.6); partials(t, m + 12, [[1, 1], [4.2, 0.12]], g, t + 1.8); out(g, 0.8, 0.8); },
      // zil (glockenspiel): uyumsuz kısmi tonlar, parlak
      glock(t, m, v) { const g = env(t, 0.002, 0.16 * v, 0, 1.1); partials(t, m + 12, [[1, 1], [2.76, 0.3]], g, t + 1.3); out(g, 0.8, 0.8); },
      kalimba(t, m, v) {
        const g = env(t, 0.003, 0.3 * v, 0, 0.6); partials(t, m, [[1, 1], [3, 0.08]], g, t + 0.8);
        out(g, 1, 0.5);
      },
      // steel pan: hafif yukarıdan oturan ton, 2. ve 3. kısmi
      steel(t, m, v) {
        const g = env(t, 0.004, 0.22 * v, 0, 0.8);
        for (const [k, a] of [[1, 1], [2, 0.4], [3.01, 0.15]]) { const q = ac.createGain(); q.gain.value = a; q.connect(g); const o = osc('sine', hz(m) * k * 1.012, t, t + 1, q); o.frequency.setValueAtTime(hz(m) * k * 1.012, t); o.frequency.exponentialRampToValueAtTime(hz(m) * k, t + 0.06); }
        out(g, 0.9, 0.6);
      },
      // telli (arp/gitar): parlak başlayıp kararan süzgeç
      pluck(t, m, v) {
        const f = lowpass(3000); f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.4);
        const g = env(t, 0.003, 0.22 * v, 0, 0.5); f.connect(g);
        osc('triangle', hz(m), t, t + 0.6, f); osc('triangle', hz(m), t, t + 0.6, f, 5); out(g, 1, 0.4);
      },
      // flüt: yavaş giriş, gecikmeli titreşim, nefes gürültüsü
      flute(t, m, v, d = 0.4) {
        const g = env(t, 0.07, 0.12 * v, d, 0.2);
        const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(10, t + 0.3);
        lfo.connect(lg); lfo.start(t); lfo.stop(t + d + 0.3); lg.connect(osc('sine', hz(m), t, t + d + 0.3, g).detune);
        out(g, 0.9, 0.7);
      },
      // org / akordeon / laterna: kare dalgalar, hafif aralı akort
      organ(t, m, v, d = 0.4) {
        const f = lowpass(1800), g = env(t, 0.03, 0.06 * v, d, 0.12); f.connect(g);
        for (const dt of [-7, 7]) osc('triangle', hz(m), t, t + d + 0.2, f, dt);
        osc('sine', hz(m) * 2, t, t + d + 0.2, f);
        out(g, 0.9, 0.5);
      },
    };
    function pad(t, ms, v, d) {
      const f = lowpass(900), g = env(t, 0.6, 0.08 * v, d - 0.2, 0.8); f.connect(g);
      for (const m of ms) for (const dt of [-7, 7]) osc('triangle', hz(m), t, t + d + 1, f, dt);
      out(g, 1, 0.6);
    }
    // davul: perdesi düşen derin vuruş
    function drum(t, v) { const g = env(t, 0.003, 0.4 * v, 0, 0.32); const o = osc('sine', 125, t, t + 0.4, g); o.frequency.setValueAtTime(125, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.3); out(g, 1, 0.15); }
    // tahta vuruşu: kısa, tonlu tık (beyaz gürültülü tıkırtı telefonda cızırtı gibi duyuluyordu)
    function tick(t, v) { const g = env(t, 0.002, 0.06 * v, 0, 0.045); osc('sine', 1100, t, t + 0.07, g); out(g, 1, 0.15); }
    function bass(t, m, v, d) {
      const g = env(t, 0.01, 0.28 * v, d * 0.8, 0.15);
      osc('triangle', hz(m), t, t + d + 0.3, g); osc('sine', hz(m), t, t + d + 0.3, g); out(g, 1, 0);
    }
    // kombo parıltısı: akorun notalarında hızla yükselen kurtuluş çalgısı ve yükselen zil süpürmesi
    function sparkle(t, ch, n) {
      for (let i = 0; i < n + 2; i++) INST[style[4]](t + i * 0.045, style[0] + 24 + ch[i % 3] + 12 * Math.floor(i / 3), 0.5 + 0.08 * i);
    }

    // ---- kayıt: dünyanın 8 ölçüsü önceden sese dönüştürülür ----
    // Anlık sentezde her nota yeni ses kaynakları açıyordu; zayıf telefonda ses işlemcisi yetişemeyip cızırdıyordu.
    // Artık her dünya (ve özel kip) bir kez, katmanları ayrı kanallarda kaydedilir; çalarken yalnız kayıt döner.
    // Canlı kalanlar yalnız kurtuluş notaları, parıltı ve Dev Halka vuruşu (birkaç nota).
    function layers() { return mode === 'rain' ? [true, true, true, true] : [true, mode === 'boss' || done >= 0.2, done >= 0.45, done >= 0.65]; }
    // L. katmanın (0 pad + bas, 1 arpej, 2 ritim, 3 ezgi) s. adımı, t anında
    function note(L, s, t) {
      const [R, , lead, pulse] = style, bar = Math.floor(s / 16), st = s % 16, ch = CHORDS[bar % 4], q = sp();
      if (L === 0) {
        if (st === 0) { pad(t, ch.map(n => R + n), 1, q * 16); bass(t, R - 12 + BASS[bar % 4], 1, q * 7); }
        if (st === 8) bass(t, R - 12 + BASS[bar % 4], 0.8, q * 6);
        if (mode === 'boss' && st % 4 === 2) bass(t, R - 24 + BASS[bar % 4], 0.6, q); // Dev Halka: pompalayan bas
      } else if (L === 1) {
        const a = ARP[st] >= 0 ? ARP[st] : mode === 'rain' ? ARP[st - 1] : -1; // Altın Yağmuru'nda 16'lık arpej
        if (a >= 0) INST[pulse](t, R + 12 + ch[a], ACCENT.includes(st) ? 1 : 0.55);
      } else if (L === 2) {
        if (st % 2 === 1 || mode === 'rain') tick(t, st % 4 === 3 ? 1 : 0.65);
        if (mode === 'boss' && st % 4 === 0) drum(t, st % 8 ? 0.6 : 1);
        if (mode === 'rain' && st % 8 === 0) drum(t, 0.7);
      } else for (const [at, n, len] of MELODY[bar % 8]) if (at === st) INST[lead](t, R + n, 1, len * q);
    }
    // Son halka: V akoru, yarım ölçü sonra I'e çözülür, kurtuluş çalgısı yükselir
    function cadence(t) {
      const R = style[0], ring = INST[style[4]], V = CHORDS[3], t2 = t + sp() * 8;
      pad(t, V.map(n => R + n), 1.2, sp() * 8); bass(t, R - 12 + V[0], 1, sp() * 7);
      pad(t2, [0, 4, 7].map(n => R + n), 1.4, 4); bass(t2, R - 12, 1, 3);
      [0, 4, 7, 12, 16].forEach((n, i) => ring(t2 + i * 0.11, R + 12 + n, 0.9));
      ring(t2 + 0.6, R + 28, 1);
    }
    // Kusursuz seri cıngılı: I akorunda kısa zafer ezgisi
    function fanfare(t) {
      const R = style[0], q = sp();
      [0, 4, 7, 4, 7, 12].forEach((n, i) => INST[style[3]](t + i * q * 1.5, R + 12 + n, 1));
      INST[style[4]](t + q * 9, R + 28, 1); INST[style[4]](t + q * 9, R + 31, 0.8);
      sparkle(t + q * 9, [0, 4, 7], 4); bass(t + q * 9, R - 12, 1, 1.2);
    }
    // ch kanallı çevrimdışı kayıt. steps: [[an, çiz(çıkışlar)]...]: ilki hemen, diğerleri kayıt o ana gelince kurulur
    // (suspend). Binlerce ses düğümü tek seferde kurulunca telefonda oyun bir an donuyordu.
    // Kurulum kaydın dünyası ve kipiyle yapılır (bu arada oyuncu başka dünyaya geçmiş olabilir)
    function offline(chs, secs, steps) {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const cx = new OAC(chs, Math.ceil(secs * SR), SR), m = cx.createChannelMerger(chs), st = style, md = mode;
      m.connect(cx.destination);
      const outs = Array.from({ length: chs }, (_, i) => { const g = cx.createGain(); g.connect(m, 0, i); return { ac: cx, bus: g, verb: makeVerb(cx, g) }; });
      const run = fn => { const ks = style, km = mode; style = st; mode = md; fn(outs); style = ks; mode = km; use(live); };
      run(steps[0][1]);
      for (const [at, fn] of steps.slice(1)) cx.suspend(Math.floor(at * SR / 128) * 128 / SR).then(() => { run(fn); cx.resume(); });
      return cx.startRendering();
    }
    // Döngünün dikişsiz olması için döngü sonundan taşan yankı ve sönümler başa eklenir
    function fold(b, n) {
      const o = live.ac.createBuffer(b.numberOfChannels, n, SR);
      for (let k = 0; k < b.numberOfChannels; k++) { const x = b.getChannelData(k), d = o.getChannelData(k); d.set(x.subarray(0, n)); for (let i = n; i < x.length; i++) d[i - n] += x[i]; }
      return o;
    }
    function render() {
      const key = wid + ':' + mode;
      if (cache.has(key)) return cache.get(key);
      const q = sp(), len = 128 * q;
      const parts = [
        // her ölçü, kayıt bir önceki ölçünün sonuna gelince kurulur
        offline(4, len + 2.5, Array.from({ length: 8 }, (_, bar) => [bar * 16 * q - 0.05, outs => outs.forEach((o, L) => { use(o); for (let s = bar * 16; s < bar * 16 + 16; s++) note(L, s, s * q + 0.01); })])),
        offline(1, q * 8 + 4.5, [[0, ([o]) => { use(o); cadence(0.01); }]]),
        offline(1, q * 9 + 2.5, [[0, ([o]) => { use(o); fanfare(0.01); }]]),
      ];
      const r = Promise.all(parts).then(([b, cad, jin]) => ({ key, q, loop: fold(b, Math.round(len * SR)), cad, jin }));
      cache.set(key, r);
      while (cache.size > 2) cache.delete(cache.keys().next().value);
      return r;
    }

    // ---- çalma ----
    function stopSrc(t) { if (src) { try { src.stop(t); } catch (e) { /* zaten durdu */ } src = null; } }
    function start(r) {
      use(live); stopSrc(ac.currentTime + 0.05);
      const split = ac.createChannelSplitter(4), on = layers();
      cur = r; src = ac.createBufferSource(); src.buffer = r.loop; src.loop = true; src.connect(split);
      gains = on.map((o, i) => { const g = ac.createGain(); g.gain.value = o ? 1 : 0; split.connect(g, i); g.connect(bus); return g; });
      t0 = ac.currentTime + 0.05; src.start(t0); playing = true;
    }
    function fade() { const on = layers(); gains.forEach((g, i) => g.gain.setTargetAtTime(on[i] ? 1 : 0, ac.currentTime, 0.4)); }
    // döngü ızgarasında `after` anından sonraki 8'lik ve o anki akor
    function grid(after) {
      let k = Math.ceil((after - t0) / cur.q); if (k % 2) k++;
      return { t: t0 + k * cur.q, ch: CHORDS[Math.floor((k % 128) / 16) % 4] };
    }
    function once(buf, t) { const b = ac.createBufferSource(); b.buffer = buf; b.connect(bus); b.start(t); }

    // Bölüm başında: aynı dünyada döngü sürer, katmanlar başa döner; yeni dünyada kayıt hazır olunca başlar
    function play() {
      if (!setup()) return;
      want = true; done = 0; freedN = 0;
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setTargetAtTime(level * VOLUME, ac.currentTime, 0.3);
      const key = wid + ':' + mode;
      if (playing && cur && cur.key === key) { fade(); return; }
      render().then(r => { if (want && r.key === wid + ':' + mode && !(playing && cur === r)) start(r); });
    }
    function stop() {
      want = false;
      if (!live) return;
      use(live);
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setTargetAtTime(0, ac.currentTime, 0.25);
      playing = false; stopSrc(ac.currentTime + 1.2);
    }
    // Son halka: döngü bir sonraki 8'likte susar, çözülüş kaydı çalar
    function resolve() {
      if (!playing || !cur) return;
      use(live); playing = false;
      const { t } = grid(ac.currentTime + 0.03);
      gains.forEach(g => g.gain.setTargetAtTime(0, t, 0.03)); stopSrc(t + 0.3);
      once(cur.cad, t);
      cadEnd = t + cur.q * 8 + 1.4;
    }
    function jingle() {
      if (!cur || !want) return;
      use(live); once(cur.jin, Math.max(ac.currentTime + 0.05, cadEnd));
    }

    return {
      play, stop, resolve, jingle,
      world(id) { wid = STYLES[id] ? id : 'vadi'; style = STYLES[wid]; }, // kayıt bölüm başlarken (play) hazırlanır, haritada değil
      mode(m) { mode = m; },
      progress(f) { done = f; if (playing) fade(); },   // tahtanın boşalan oranı (0..1): katmanlar
      // kurtulan halkalar: notaları döngünün bir sonraki 8'liğine ve akoruna oturur, yükselerek dağılır
      free(n) {
        if (!playing) return;
        use(live); const { t, ch } = grid(ac.currentTime + 0.03);
        for (let i = 0; i < n; i++) { const k = freedN + i; INST[style[4]](t + i * cur.q * 0.5, style[0] + 12 + ch[k % 3] + 12 * (Math.floor(k / 3) % 2), 0.9); }
        freedN += n;
      },
      sparkle(n) { if (!playing) return; use(live); const { t, ch } = grid(ac.currentTime + 0.03); sparkle(t + cur.q, ch, Math.min(n, 6)); },
      // Dev Halka yenildi: gümbürtü, I akoru ve parıltı
      hit() {
        if (!playing) return;
        use(live); const { t, ch } = grid(ac.currentTime + 0.03);
        drum(t, 1.5); bass(t, style[0] - 24, 1.2, cur.q * 6); pad(t, ch.map(n => style[0] + 12 + n), 1.6, cur.q * 6); sparkle(t + cur.q, ch, 6);
      },
      volume(v) { level = v; if (live && want) live.bus.gain.setTargetAtTime(level * VOLUME, live.ac.currentTime, 0.1); },
    };
  }

  root.RingMusic = { Music, STYLES };
})(this);
