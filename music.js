// Müzik (2.5): hazır parça kayıttan çalınır (music/oyun.ogg, kaynak ve lisans music/KAYNAK.md).
// Telefonun medya oynatıcısıyla (<audio>) çalar: WebAudio'da üretilen müzik bazı telefonların hoparlöründe cızırdıyordu.
// Bütün oyunda tek parça (kullanıcı seçimi); bölüm sürerken çalar, son halkada kısılır (zafer sesleri öne çıksın),
// bölümden bölüme kaldığı yerden sürer.
(function (root) {
  'use strict';

  const VOLUME = 0.55; // oyuncunun ayarı %100'ken seviye (oyun sesleri öne çıksın)

  function Music() {
    let el = null, level = 0.4, want = false, fader = 0;
    // ses düzeyini ms içinde v'ye kaydırır (medya oynatıcısında otomasyon yok)
    function fadeTo(v, ms, done) {
      clearInterval(fader);
      const from = el.volume, t0 = Date.now();
      fader = setInterval(() => {
        const u = Math.min(1, (Date.now() - t0) / ms);
        el.volume = Math.max(0, Math.min(1, from + (v - from) * u));
        if (u === 1) { clearInterval(fader); if (done) done(); }
      }, 50);
    }
    function play() {
      want = true;
      if (!el) { el = new Audio('music/oyun.ogg'); el.loop = true; el.preload = 'auto'; el.volume = 0; }
      const p = el.play();
      if (p && p.catch) p.catch(() => { /* dokunuştan önce tarayıcı izin vermez; sonraki bölümde başlar */ });
      fadeTo(level * VOLUME, 700);
    }
    function stop() {
      want = false;
      if (el) fadeTo(0, 400, () => { if (!want) el.pause(); });
    }
    return {
      play, stop,
      resolve() { if (el && want) fadeTo(level * VOLUME * 0.35, 800); }, // son halka
      volume(v) { level = v; if (el && want) { clearInterval(fader); el.volume = Math.min(1, level * VOLUME); } },
    };
  }

  root.RingMusic = { Music };
})(this);
