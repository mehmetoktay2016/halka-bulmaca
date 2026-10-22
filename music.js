// Müzik (2.5, Z15): oyunun içinde WebAudio ile üretilen etkileşimli müzik (dosya yok, telif yok).
// Do majör pentatonik, 96 BPM: marimba arpeji, celesta ezgisi ("halka motifi": notalar çember gibi yükselip başa döner),
// yumuşak pad ve bas. Oyuna bağlı (dopamin katmanı):
// - kurtulan halkanın notası bir sonraki 8'liğe ve o anki akora oturur; birkaç halka birden kurtulursa yükselerek dağılır
// - tahta boşaldıkça katman girer: pad + bas, marimba, tıkırtı, ezgi
// - zincir ve kombo celesta parıltısı çalar; kusursuz seri zafer cıngılı
// - son halkada ritim durur, Sol'den Do'ya çözülür. Hamle sınırında gerilim yok.
// Prototip: prototip/muzik.html (A · Bahçe).
(function (root) {
  'use strict';

  const BPM = 96, ROOT = 60, VOLUME = 0.5; // VOLUME: oyuncunun ayarı %100'ken ana seviye (oyun sesleri öne çıksın)
  // 4 ölçülük akor döngüsü (Do, La minör, Fa, Sol; kökten yarım ses) ve bas kökleri
  const CHORDS = [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], BASS = [0, -3, 5, 7];
  // 8 ölçülük ezgi: [adım (16'lık), nota, uzunluk]
  const MELODY = [
    [[0, 16, 4], [4, 19, 4], [8, 21, 4], [12, 19, 4]], [[0, 16, 6], [6, 12, 2], [8, 14, 8]],
    [[0, 21, 4], [4, 24, 4], [8, 21, 4], [12, 19, 4]], [[0, 19, 8], [8, 14, 4], [12, 16, 4]],
    [[0, 16, 4], [4, 19, 4], [8, 21, 4], [12, 24, 4]], [[0, 26, 4], [4, 24, 4], [8, 21, 8]],
    [[0, 21, 4], [4, 19, 4], [8, 16, 4], [12, 14, 4]], [[0, 12, 12]],
  ];
  // marimba: 8'lik arpej (akor notası sırası, -1 sus), vurgulu adımlar
  const ARP = [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 1, -1], ACCENT = [0, 8];
  const SP = 60 / BPM / 4; // 16'lık süresi (sn)
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function Music(getContext) {
    let ac = null, bus = null, verb = null, noise = null;
    let timer = 0, step = 0, nextT = 0, playing = false, level = 0.4;
    let done = 0, pending = 0, freedN = 0, glitter = 0, cadenceEnd = 0;

    function setup() {
      ac = getContext();
      if (!ac) return false;
      if (bus) return true;
      bus = ac.createGain(); bus.gain.value = 0; bus.connect(ac.destination);
      // yankı: üstel sönen gürültüden darbe yanıtı
      verb = ac.createConvolver();
      const len = ac.sampleRate * 2, ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      verb.buffer = ir;
      const wet = ac.createGain(); wet.gain.value = 0.28; verb.connect(wet); wet.connect(bus);
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
    function noiseHit(t, type, hzFrom, hzTo, a, peak, rel, wet) {
      const s = ac.createBufferSource(); s.buffer = noise;
      const f = ac.createBiquadFilter(); f.type = type; f.Q.value = 2;
      f.frequency.setValueAtTime(hzFrom, t); if (hzTo) f.frequency.exponentialRampToValueAtTime(hzTo, t + a + rel);
      const g = env(t, a, peak, 0, rel); s.connect(f); f.connect(g); s.start(t); s.stop(t + a + rel + 0.05); out(g, 1, wet);
    }

    // ---- çalgılar (t: başlangıç, m: MIDI, v: güç, d: süre sn) ----
    function marimba(t, m, v) {
      const g = env(t, 0.004, 0.32 * v, 0, 0.55); osc('sine', hz(m), t, t + 0.7, g);
      const h = env(t, 0.002, 0.08 * v, 0, 0.07); osc('sine', hz(m) * 4, t, t + 0.12, h);
      out(g, 1, 0.3); out(h, 1, 0);
    }
    function celesta(t, m, v) {
      const g = env(t, 0.004, 0.22 * v, 0, 1.3);
      for (const [k, a] of [[1, 1], [2, 0.3], [3, 0.12]]) { const q = ac.createGain(); q.gain.value = a; q.connect(g); osc('sine', hz(m) * k, t, t + 1.5, q); }
      out(g, 0.8, 0.9);
    }
    function pad(t, ms, v, d) {
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = env(t, 0.6, 0.05 * v, d - 0.2, 0.8); f.connect(g);
      for (const m of ms) for (const dt of [-9, 0, 9]) osc('sawtooth', hz(m), t, t + d + 1, f, dt);
      out(g, 1, 0.6);
    }
    function bass(t, m, v, d) {
      const g = env(t, 0.01, 0.28 * v, d * 0.8, 0.15);
      osc('triangle', hz(m), t, t + d + 0.3, g); osc('sine', hz(m), t, t + d + 0.3, g); out(g, 1, 0);
    }
    // kombo parıltısı: akorun notalarında hızla yükselen celesta ve yükselen zil süpürmesi
    function sparkle(t, ch, n) {
      for (let i = 0; i < n + 2; i++) celesta(t + i * 0.045, ROOT + 24 + ch[i % 3] + 12 * Math.floor(i / 3), 0.5 + 0.08 * i);
      noiseHit(t, 'bandpass', 2000, 9000, 0.35, 0.05, 0.2, 0.5);
    }

    // ---- akış: 16'lık adımlar önceden zamanlanır ----
    function layers() { return [true, done >= 0.2, done >= 0.45, done >= 0.65]; }
    function schedule(s, t) {
      const bar = Math.floor(s / 16), st = s % 16, ch = CHORDS[bar % 4], on = layers();
      if (st === 0) { pad(t, ch.map(n => ROOT + n), 1, SP * 16); bass(t, ROOT - 12 + BASS[bar % 4], 1, SP * 7); }
      if (st === 8) bass(t, ROOT - 12 + BASS[bar % 4], 0.8, SP * 6);
      if (on[1] && ARP[st] >= 0) marimba(t, ROOT + 12 + ch[ARP[st]], ACCENT.includes(st) ? 1 : 0.55);
      if (on[2] && st % 2 === 1) noiseHit(t, 'highpass', 6500, 0, 0.002, st % 4 === 3 ? 0.07 : 0.045, 0.05, 0.2);
      if (on[3]) for (const [at, n, len] of MELODY[bar % 8]) if (at === st) celesta(t, ROOT + n, 1, len * SP);
      if (st % 2 === 0) release(t, ch);
    }
    // bekleyen kurtuluş notaları ve parıltı bir sonraki 8'liğe oturur
    function release(t, ch) {
      for (let i = 0; i < pending; i++) { const k = freedN + i; celesta(t + i * SP * 0.5, ROOT + 12 + ch[k % 3] + 12 * (Math.floor(k / 3) % 2), 0.9); }
      freedN += pending; pending = 0;
      if (glitter) { sparkle(t + SP, ch, glitter); glitter = 0; }
    }
    function tick() {
      while (nextT < ac.currentTime + 0.12) { schedule(step, nextT); nextT += SP; step++; }
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
    // Son halka: ritim durur; bir sonraki 8'likte Sol akoru, yarım ölçü sonra Do'ya çözülür, celesta yükselir
    function resolve() {
      if (!playing) return;
      playing = false; clearInterval(timer);
      const t = Math.max(ac.currentTime + 0.05, nextT - (step % 2 ? SP : 0)), V = CHORDS[3], t2 = t + SP * 8;
      release(t, V);
      pad(t, V.map(n => ROOT + n), 1.2, SP * 8); bass(t, ROOT - 12 + V[0], 1, SP * 7);
      pad(t2, [0, 4, 7].map(n => ROOT + n), 1.4, 4); bass(t2, ROOT - 12, 1, 3);
      [0, 4, 7, 12, 16].forEach((n, i) => celesta(t2 + i * 0.11, ROOT + 12 + n, 0.9));
      celesta(t2 + 0.6, ROOT + 28, 1);
      cadenceEnd = t2 + 1.4;
    }
    // Kusursuz seri cıngılı: çözülüşten sonra ev akorunda kısa zafer ezgisi
    function jingle() {
      if (!setup() || bus.gain.value < 0.001) return;
      const t = Math.max(ac.currentTime + 0.05, cadenceEnd);
      [0, 4, 7, 4, 7, 12].forEach((n, i) => marimba(t + i * SP * 1.5, ROOT + 12 + n, 1));
      celesta(t + SP * 9, ROOT + 28, 1); celesta(t + SP * 9, ROOT + 31, 0.8);
      sparkle(t + SP * 9, [0, 4, 7], 4); bass(t + SP * 9, ROOT - 12, 1, 1.2);
    }

    return {
      play, stop, resolve, jingle,
      progress(f) { done = f; },                       // tahtanın boşalan oranı (0..1): katmanlar
      free(n) { if (playing) pending += n; },          // kurtulan halka sayısı
      sparkle(n) { if (playing) glitter = Math.max(glitter, Math.min(n, 6)); },
      volume(v) { level = v; if (bus && playing) bus.gain.setTargetAtTime(level * VOLUME, ac.currentTime, 0.1); },
    };
  }

  root.RingMusic = { Music };
})(this);
