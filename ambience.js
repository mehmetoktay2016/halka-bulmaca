// Ortam sesleri: her dünyanın arka planda çalan, WebAudio ile üretilen sesi (dosya gerekmez).
// Rüzgâr, kuş, ateş çıtırtısı, saat tıkırtısı, su damlası, makine uğultusu...
// Ses seviyesi bilerek düşük: oyunun kendi sesleri (tık, patlama) her zaman öne çıkar.
(function (root) {
  'use strict';

  const VOLUME = 0.55;  // bütün ortam seslerinin ana seviyesi
  const FADE = 1.6;     // dünyalar arası geçiş (saniye)
  const rand = Math.random;
  const pick = a => a[Math.floor(rand() * a.length)];

  function Ambience(getContext) {
    let ac = null, master = null, noise = null;
    let current = null;   // { id, out, timers, nodes }
    let wanted = null;    // çalması istenen dünya kimliği (null = sessiz)

    function setup() {
      ac = getContext();
      if (!ac) return false;
      if (!master) {
        master = ac.createGain();
        master.gain.value = VOLUME;
        master.connect(ac.destination);
        // 2 sn'lik beyaz gürültü: rüzgâr, buhar, çıtırtı bundan süzülür
        noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
      }
      return true;
    }

    // ---- Yapı taşları (hepsi bir "sahne"nin çıkışına bağlanır) ----
    function makeKit(out, nodes, timers) {
      const k = {
        noiseSrc() {
          const s = ac.createBufferSource();
          s.buffer = noise; s.loop = true;
          s.loopStart = rand(); s.loopEnd = s.loopStart + 1;
          nodes.push(s);
          return s;
        },
        filter(type, freq, q = 0.7) {
          const f = ac.createBiquadFilter();
          f.type = type; f.frequency.value = freq; f.Q.value = q;
          return f;
        },
        gain(v) { const g = ac.createGain(); g.gain.value = v; return g; },
        // Yavaş salınım: bir AudioParam'ı merkez ± derinlik arasında gezdirir
        lfo(param, rate, depth) {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.frequency.value = rate; g.gain.value = depth;
          o.connect(g).connect(param);
          o.start(); nodes.push(o);
        },
        // Sürekli tını (uğultu, pad)
        drone(type, freq, vol, lp = 0) {
          const o = ac.createOscillator();
          o.type = type; o.frequency.value = freq;
          const g = k.gain(vol);
          if (lp) o.connect(k.filter('lowpass', lp)).connect(g); else o.connect(g);
          g.connect(out);
          o.start(); nodes.push(o);
          return { osc: o, gain: g };
        },
        // Süzülmüş gürültü katmanı
        bed(type, freq, q, vol) {
          const f = k.filter(type, freq, q);
          const g = k.gain(vol);
          k.noiseSrc().connect(f).connect(g).connect(out);
          nodes[nodes.length - 1].start();
          return { filter: f, gain: g };
        },
        // Kısa bir ton: zarflı osilatör (kuş, damla, çan)
        blip(t, freq, dur, vol, type = 'sine', slideTo = 0, dest = out) {
          const o = ac.createOscillator();
          const g = ac.createGain();
          g.gain.value = 0;
          o.type = type;
          o.frequency.setValueAtTime(freq, t);
          if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 4));
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g).connect(dest);
          o.start(t); o.stop(t + dur + 0.05);
        },
        // Kısa gürültü patlaması (tık, çıtırtı, tıslama)
        puff(t, type, freq, q, dur, vol, attack = 0.002) {
          const s = ac.createBufferSource();
          s.buffer = noise;
          const f = k.filter(type, freq, q);
          const g = ac.createGain();
          g.gain.value = 0;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(vol, t + attack);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          s.connect(f).connect(g).connect(out);
          s.start(t, rand() * 1.5); s.stop(t + dur + 0.05);
        },
        // Yankı: damla ve çanlar için
        echo(time, feedback, tone = 2500) {
          const d = ac.createDelay(2);
          d.delayTime.value = time;
          const fb = k.gain(feedback);
          const lp = k.filter('lowpass', tone);
          d.connect(lp).connect(fb).connect(d);
          lp.connect(out);
          return d;
        },
        // Ara sıra olan şeyler: her seferinde min-max saniye sonra fn(t) çağrılır
        every(min, max, fn) {
          const go = () => {
            if (!ac) return;
            fn(ac.currentTime + 0.05);
            timers.push(setTimeout(go, (min + rand() * (max - min)) * 1000));
          };
          timers.push(setTimeout(go, (min * 0.3 + rand() * min) * 1000));
        },
        // Düzenli vuruş (saat, piston): her adımda fn(t, sıra)
        pulse(period, fn) {
          let next = ac.currentTime + 0.2, n = 0;
          const iv = setInterval(() => {
            while (next < ac.currentTime + 0.4) { fn(next, n++); next += period; }
          }, 150);
          timers.push({ iv });
        },
      };
      return k;
    }

    // ---- Dünyaların sesleri ----
    // Her sahne bir seviye çarpanı döndürür: dünyalar kulağa aynı yükseklikte gelsin
    // (kayıtla ölçüldü, ortalama yaklaşık -31 dB)
    const SCENES = {
      // Vadi: esinti ve uzaktan kuş cıvıltısı
      vadi(k) {
        const wind = k.bed('bandpass', 520, 0.6, 0.05);
        k.lfo(wind.filter.frequency, 0.07, 220);
        k.lfo(wind.gain.gain, 0.05, 0.025);
        k.every(3, 8, t => {
          const base = 2400 + rand() * 1400, n = 2 + Math.floor(rand() * 4);
          for (let i = 0; i < n; i++) k.blip(t + i * 0.13, base, 0.09, 0.025, 'sine', base * (1.25 + rand() * 0.3));
        });
        return 4.8;
      },
      // Atölye: ocak çıtırtısı, ılık uğultu, uzakta çekiç
      atolye(k) {
        k.bed('lowpass', 180, 0.7, 0.14);
        k.every(0.08, 0.5, t => k.puff(t, 'highpass', 1800 + rand() * 2500, 0.8, 0.02 + rand() * 0.03, 0.02 + rand() * 0.03));
        k.every(6, 12, t => {
          for (let i = 0; i < 2 + Math.floor(rand() * 2); i++) {
            k.blip(t + i * 0.32, 210, 0.18, 0.05, 'triangle', 170);
            k.puff(t + i * 0.32, 'bandpass', 2600, 2, 0.05, 0.05);
          }
        });
        return 4.8;
      },
      // Saat kulesi: tik-tak, derinde bir pad, arada bir çan
      saat(k) {
        k.drone('sine', 110, 0.02);
        k.drone('sine', 164.8, 0.012);
        k.pulse(1, (t, n) => k.puff(t, 'bandpass', n % 2 ? 2300 : 3200, 6, 0.035, 0.09, 0.001));
        const bell = k.echo(0.45, 0.35);
        k.every(18, 30, t => [523.3, 392, 329.6].forEach((f, i) => {
          k.blip(t + i * 0.9, f, 2.2, 0.035, 'sine', 0, bell);
          k.blip(t + i * 0.9, f * 2.76, 0.9, 0.01, 'sine', 0, bell);
        }));
        return 2.75;
      },
      // Zindan: ağır uğultu, koridorda rüzgâr, yankılı su damlaları
      zindan(k) {
        k.drone('sawtooth', 55, 0.03, 160);
        const howl = k.bed('bandpass', 300, 5, 0.04);
        k.lfo(howl.filter.frequency, 0.04, 120);
        const cave = k.echo(0.32, 0.45, 1800);
        k.every(2, 6, t => {
          const f = 900 + rand() * 900;
          k.blip(t, f, 0.12, 0.05, 'sine', f * 0.45, cave);
        });
        return 2.9;
      },
      // Şehir: uzak kent uğultusu ve geçen arabalar, ara sıra rüzgâr çanı
      sehir(k) {
        const hum = k.bed('lowpass', 380, 0.7, 0.07);
        k.lfo(hum.gain.gain, 0.03, 0.02);
        k.every(5, 11, t => {
          const s = ac.createBufferSource(); s.buffer = noise;
          const f = k.filter('bandpass', 300, 1.5);
          const g = ac.createGain();
          g.gain.value = 0;
          f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(700, t + 1.4);
          f.frequency.exponentialRampToValueAtTime(260, t + 3);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035, t + 1.4);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
          s.connect(f).connect(g).connect(k.out);
          s.start(t); s.stop(t + 3.1);
        });
        const chime = k.echo(0.25, 0.3);
        k.every(14, 26, t => {
          for (let i = 0; i < 3; i++) k.blip(t + i * 0.18 + rand() * 0.1, pick([1318, 1568, 1760, 2093]), 1.2, 0.012, 'sine', 0, chime);
        });
        return 5.6;
      },
      // Fabrika: makine uğultusu, piston vuruşu, buhar tıslaması
      fabrika(k) {
        k.drone('sawtooth', 60, 0.03, 260);
        k.drone('square', 120, 0.008, 400);
        k.pulse(1.2, (t, n) => {
          k.blip(t, 75, 0.25, 0.06, 'sine', 42);
          if (n % 2) k.puff(t + 0.6, 'bandpass', 1400, 3, 0.06, 0.03);
        });
        k.every(4, 9, t => k.puff(t, 'highpass', 3500, 0.7, 1.1, 0.035, 0.08));
        return 3.0;
      },
      // Uzay: derin, yavaş nefes alan pad ve uzak yankılı pingler
      uzay(k) {
        const pad = [110, 164.8, 246.9].map((f, i) => k.drone('sine', f * (1 + (i - 1) * 0.002), 0.025));
        pad.forEach((p, i) => k.lfo(p.gain.gain, 0.05 + i * 0.03, 0.015));
        const deep = k.echo(0.6, 0.55, 3000);
        k.every(4, 9, t => k.blip(t, pick([1760, 1975.5, 2349.3, 2637]), 1.8, 0.012, 'sine', 0, deep));
        return 1.2;
      },
      // Büyük Usta: sıcak bir akor ve ara sıra pentatonik çan arpeji
      usta(k) {
        const chord = [130.8, 196, 329.6].map(f => k.drone('triangle', f, 0.018, 900));
        chord.forEach((c, i) => k.lfo(c.gain.gain, 0.06 + i * 0.02, 0.01));
        const hall = k.echo(0.4, 0.4);
        k.every(9, 16, t => {
          const notes = [523.3, 587.3, 659.3, 784, 880, 1046.5];
          let i = Math.floor(rand() * 3);
          for (let s = 0; s < 4; s++, i += 1 + Math.floor(rand() * 2)) k.blip(t + s * 0.28, notes[i % notes.length], 1.4, 0.02, 'sine', 0, hall);
        });
        return 2.1;
      },
    };

    function stopScene(scene, fade) {
      if (!scene) return;
      const t = ac.currentTime;
      scene.out.gain.cancelScheduledValues(t);
      scene.out.gain.setValueAtTime(scene.out.gain.value, t);
      scene.out.gain.linearRampToValueAtTime(0, t + fade);
      for (const tm of scene.timers) { if (tm && tm.iv) clearInterval(tm.iv); else clearTimeout(tm); }
      setTimeout(() => {
        for (const n of scene.nodes) { try { n.stop(); } catch (e) { /* zaten durmuş */ } }
        scene.out.disconnect();
      }, fade * 1000 + 100);
    }

    function startScene(id) {
      const out = ac.createGain();
      out.gain.value = 0;
      out.connect(master);
      const scene = { id, out, timers: [], nodes: [] };
      const kit = makeKit(out, scene.nodes, scene.timers);
      kit.out = out;
      const level = (SCENES[id] || SCENES.vadi)(kit) || 1;
      out.gain.linearRampToValueAtTime(level, ac.currentTime + FADE);
      return scene;
    }

    function sync() {
      if (wanted && !setup()) return;
      if (!ac) return;
      if (current && current.id === wanted) return;
      stopScene(current, FADE);
      current = wanted ? startScene(wanted) : null;
    }

    return {
      // Çalınacak dünyayı ya da sessizliği (null) seçer; ses bağlamı açılmamışsa ilk dokunuşta başlar
      play(id) { wanted = id; sync(); },
      // Ses bağlamı kullanıcı dokunuşuyla açıldığında tekrar denemek için
      resume() { sync(); },
      get playing() { return current ? current.id : null; },
      SCENES,
    };
  }

  root.RingAmbience = { Ambience };
})(this);
