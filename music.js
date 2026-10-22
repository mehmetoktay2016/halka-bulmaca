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

  function Music(getContext) {
    let ac = null, bus = null, verb = null, noise = null;
    let timer = 0, step = 0, nextT = 0, playing = false, level = 0.4;
    let done = 0, pending = 0, freedN = 0, glitter = 0, cadenceEnd = 0;
    let style = STYLES.vadi, wanted = style; // dünya değişince yeni çeşitleme bir sonraki ölçüde başlar
    let mode = null, boom = false;           // özel an: null, 'boss' (Dev Halka), 'rain' (Altın Yağmuru)
    const sp = () => 60 / (mode === 'rain' ? 130 : style[1]) / 4; // 16'lık süresi (sn)

    function setup() {
      ac = getContext();
      if (!ac) return false;
      if (bus) return true;
      // sınırlayıcı: üst üste binen notalar ve oyun sesleriyle taşıp cızırdamasın
      const lim = ac.createDynamicsCompressor();
      lim.threshold.value = -12; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
      // alçak frekans süzgeci: telefon hoparlörü 150 Hz altını çalamaz, zorlanınca cızırdar
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 150; hp.Q.value = 0.7;
      bus = ac.createGain(); bus.gain.value = 0; bus.connect(hp); hp.connect(lim); lim.connect(ac.destination);
      // yankı: iki geri beslemeli gecikme (evrişimli yankı telefonda ses iş parçacığını yorup cızırtı yapıyordu)
      verb = ac.createGain();
      const wet = ac.createGain(); wet.gain.value = 0.22; wet.connect(bus);
      for (const [dt, fb] of [[0.137, 0.35], [0.211, 0.3]]) {
        const dl = ac.createDelay(1), lp = ac.createBiquadFilter(), back = ac.createGain();
        dl.delayTime.value = dt; lp.type = 'lowpass'; lp.frequency.value = 2500; back.gain.value = fb;
        verb.connect(dl); dl.connect(lp); lp.connect(back); back.connect(dl); lp.connect(wet);
      }
      noise = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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
    function noiseHit(t, type, hzFrom, hzTo, a, peak, rel, wet) {
      const s = ac.createBufferSource(); s.buffer = noise;
      const f = ac.createBiquadFilter(); f.type = type; f.Q.value = 2;
      f.frequency.setValueAtTime(hzFrom, t); if (hzTo) f.frequency.exponentialRampToValueAtTime(hzTo, t + a + rel);
      const g = env(t, a, peak, 0, rel); s.connect(f); f.connect(g); s.start(t); s.stop(t + a + rel + 0.05); out(g, 1, wet);
    }
    function lowpass(hzv, q = 1) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = hzv; f.Q.value = q; return f; }

    // ---- çalgılar (t: başlangıç, m: MIDI, v: güç, d: süre sn; vurmalılar d'yi kullanmaz) ----
    const INST = {
      marimba(t, m, v) {
        const g = env(t, 0.004, 0.32 * v, 0, 0.55); osc('sine', hz(m), t, t + 0.7, g);
        const h = env(t, 0.002, 0.08 * v, 0, 0.07); osc('sine', hz(m) * 4, t, t + 0.12, h);
        out(g, 1, 0.3); out(h, 1, 0);
      },
      celesta(t, m, v) { const g = env(t, 0.004, 0.22 * v, 0, 1.3); partials(t, m, [[1, 1], [2, 0.3], [3, 0.12]], g, t + 1.5); out(g, 0.8, 0.9); },
      // müzik kutusu: bir oktav yukarıda, tiz uyumsuz kısmi tonla tınlayan dil
      musicBox(t, m, v) { const g = env(t, 0.002, 0.2 * v, 0, 1.6); partials(t, m + 12, [[1, 1], [4.2, 0.25], [8.4, 0.06]], g, t + 1.8); out(g, 0.8, 0.8); },
      // zil (glockenspiel): uyumsuz kısmi tonlar, parlak
      glock(t, m, v) { const g = env(t, 0.002, 0.16 * v, 0, 1.1); partials(t, m + 12, [[1, 1], [2.76, 0.35], [5.4, 0.12]], g, t + 1.3); out(g, 0.8, 0.8); },
      kalimba(t, m, v) {
        const g = env(t, 0.003, 0.3 * v, 0, 0.6); partials(t, m, [[1, 1], [3, 0.08]], g, t + 0.8);
        const c = env(t, 0.001, 0.1 * v, 0, 0.03); osc('sine', hz(m) * 6.1, t, t + 0.06, c);
        out(g, 1, 0.5); out(c, 1, 0);
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
        osc('triangle', hz(m), t, t + 0.6, f); osc('sawtooth', hz(m), t, t + 0.6, f, 4); out(g, 1, 0.4);
      },
      // flüt: yavaş giriş, gecikmeli titreşim, nefes gürültüsü
      flute(t, m, v, d = 0.4) {
        const g = env(t, 0.07, 0.12 * v, d, 0.2);
        const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(10, t + 0.3);
        lfo.connect(lg); lfo.start(t); lfo.stop(t + d + 0.3); lg.connect(osc('sine', hz(m), t, t + d + 0.3, g).detune);
        out(g, 0.9, 0.7); noiseHit(t, 'bandpass', hz(m) * 2, 0, 0.05, 0.015 * v, d * 0.5, 0.3);
      },
      // org / akordeon / laterna: kare dalgalar, hafif aralı akort
      organ(t, m, v, d = 0.4) {
        const f = lowpass(1800), g = env(t, 0.03, 0.06 * v, d, 0.12); f.connect(g);
        for (const dt of [-7, 7]) osc('square', hz(m), t, t + d + 0.2, f, dt);
        osc('sine', hz(m) * 2, t, t + d + 0.2, f);
        out(g, 0.9, 0.5);
      },
    };
    function pad(t, ms, v, d) {
      const f = lowpass(900), g = env(t, 0.6, 0.05 * v, d - 0.2, 0.8); f.connect(g);
      for (const m of ms) for (const dt of [-7, 7]) osc('sawtooth', hz(m), t, t + d + 1, f, dt);
      out(g, 1, 0.6);
    }
    // davul: perdesi düşen derin vuruş
    function drum(t, v) { const g = env(t, 0.003, 0.4 * v, 0, 0.32); const o = osc('sine', 125, t, t + 0.4, g); o.frequency.setValueAtTime(125, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.3); out(g, 1, 0.15); }
    function bass(t, m, v, d) {
      const g = env(t, 0.01, 0.28 * v, d * 0.8, 0.15);
      osc('triangle', hz(m), t, t + d + 0.3, g); osc('sine', hz(m), t, t + d + 0.3, g); out(g, 1, 0);
    }
    // kombo parıltısı: akorun notalarında hızla yükselen kurtuluş çalgısı ve yükselen zil süpürmesi
    function sparkle(t, ch, n) {
      for (let i = 0; i < n + 2; i++) INST[style[4]](t + i * 0.045, style[0] + 24 + ch[i % 3] + 12 * Math.floor(i / 3), 0.5 + 0.08 * i);
      noiseHit(t, 'bandpass', 2000, 9000, 0.35, 0.05, 0.2, 0.5);
    }

    // ---- akış: 16'lık adımlar önceden zamanlanır ----
    function layers() { return mode === 'rain' ? [true, true, true, true] : [true, mode === 'boss' || done >= 0.2, done >= 0.45, done >= 0.65]; }
    function schedule(s, t) {
      if (s % 16 === 0) style = wanted;
      const [R, , lead, pulse] = style, bar = Math.floor(s / 16), st = s % 16, ch = CHORDS[bar % 4], on = layers(), q = sp();
      if (st === 0) { pad(t, ch.map(n => R + n), 1, q * 16); bass(t, R - 12 + BASS[bar % 4], 1, q * 7); }
      if (st === 8) bass(t, R - 12 + BASS[bar % 4], 0.8, q * 6);
      // Altın Yağmuru'nda arpej 16'lık (susulan adımda bir önceki nota)
      const a = ARP[st] >= 0 ? ARP[st] : mode === 'rain' ? ARP[st - 1] : -1;
      if (on[1] && a >= 0) INST[pulse](t, R + 12 + ch[a], ACCENT.includes(st) ? 1 : 0.55);
      if (on[2] && (st % 2 === 1 || mode === 'rain')) noiseHit(t, 'highpass', 6500, 0, 0.002, st % 4 === 3 ? 0.07 : 0.045, 0.05, 0.2);
      // Dev Halka: her vuruşta davul, aradaki 8'liklerde kısa pompalayan bas; Yağmur: ölçü başında ve ortasında davul
      if (mode === 'boss' && st % 4 === 0) drum(t, st % 8 ? 0.6 : 1);
      if (mode === 'boss' && st % 4 === 2) bass(t, R - 24 + BASS[bar % 4], 0.6, q);
      if (mode === 'rain' && st % 8 === 0) drum(t, 0.7);
      if (on[3]) for (const [at, n, len] of MELODY[bar % 8]) if (at === st) INST[lead](t, R + n, 1, len * q);
      if (st % 2 === 0) release(t, ch);
    }
    // bekleyen kurtuluş notaları ve parıltı bir sonraki 8'liğe oturur
    function release(t, ch) {
      for (let i = 0; i < pending; i++) { const k = freedN + i; INST[style[4]](t + i * sp() * 0.5, style[0] + 12 + ch[k % 3] + 12 * (Math.floor(k / 3) % 2), 0.9); }
      freedN += pending; pending = 0;
      if (glitter) { sparkle(t + sp(), ch, glitter); glitter = 0; }
      if (boom) { drum(t, 1.5); bass(t, style[0] - 24, 1.2, sp() * 6); pad(t, ch.map(n => style[0] + 12 + n), 1.6, sp() * 6); boom = false; }
    }
    function tick() {
      while (nextT < ac.currentTime + 0.12) { schedule(step, nextT); nextT += sp(); step++; }
    }

    // Bölüm başında: döngü baştan, yalnız pad ve bas
    function play() {
      if (!setup()) return;
      done = 0; pending = 0; freedN = 0; glitter = 0;
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setTargetAtTime(level * VOLUME, ac.currentTime, 0.3);
      if (playing) return;
      playing = true; step = 0; nextT = ac.currentTime + 0.08;
      clearInterval(timer); timer = setInterval(tick, 25);
    }
    function stop() {
      if (!bus) return;
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setTargetAtTime(0, ac.currentTime, 0.25);
      playing = false; clearInterval(timer);
    }
    // Son halka: ritim durur; bir sonraki 8'likte V akoru, yarım ölçü sonra I'e çözülür, kurtuluş çalgısı yükselir
    function resolve() {
      if (!playing) return;
      playing = false; clearInterval(timer);
      const R = style[0], ring = INST[style[4]], V = CHORDS[3];
      const t = Math.max(ac.currentTime + 0.05, nextT - (step % 2 ? sp() : 0)), t2 = t + sp() * 8;
      release(t, V);
      pad(t, V.map(n => R + n), 1.2, sp() * 8); bass(t, R - 12 + V[0], 1, sp() * 7);
      pad(t2, [0, 4, 7].map(n => R + n), 1.4, 4); bass(t2, R - 12, 1, 3);
      [0, 4, 7, 12, 16].forEach((n, i) => ring(t2 + i * 0.11, R + 12 + n, 0.9));
      ring(t2 + 0.6, R + 28, 1);
      cadenceEnd = t2 + 1.4;
    }
    // Kusursuz seri cıngılı: çözülüşten sonra I akorunda kısa zafer ezgisi
    function jingle() {
      if (!setup() || bus.gain.value < 0.001) return;
      const R = style[0], t = Math.max(ac.currentTime + 0.05, cadenceEnd), q = sp();
      [0, 4, 7, 4, 7, 12].forEach((n, i) => INST[style[3]](t + i * q * 1.5, R + 12 + n, 1));
      INST[style[4]](t + q * 9, R + 28, 1); INST[style[4]](t + q * 9, R + 31, 0.8);
      sparkle(t + q * 9, [0, 4, 7], 4); bass(t + q * 9, R - 12, 1, 1.2);
    }

    return {
      play, stop, resolve, jingle,
      world(id) { wanted = STYLES[id] || STYLES.vadi; if (!playing) style = wanted; },
      mode(m) { mode = m; },
      hit() { if (playing) { boom = true; glitter = 6; } }, // Dev Halka yenildi
      progress(f) { done = f; },                       // tahtanın boşalan oranı (0..1): katmanlar
      free(n) { if (playing) pending += n; },          // kurtulan halka sayısı
      sparkle(n) { if (playing) glitter = Math.max(glitter, Math.min(n, 6)); },
      volume(v) { level = v; if (bus && playing) bus.gain.setTargetAtTime(level * VOLUME, ac.currentTime, 0.1); },
    };
  }

  root.RingMusic = { Music, STYLES };
})(this);
