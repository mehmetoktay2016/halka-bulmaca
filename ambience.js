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
      // Lunapark (2.4): uzaktan atlıkarınca orgu (üç zamanlı vals), kalabalık uğultusu, ara sıra zil
      lunapark(k) {
        const crowd = k.bed('bandpass', 700, 0.8, 0.03);
        k.lfo(crowd.gain.gain, 0.08, 0.012);
        const hall = k.echo(0.3, 0.3, 2200);
        const waltz = [[392, 523.3, 659.3], [440, 587.3, 698.5], [392, 493.9, 587.3], [349.2, 440, 523.3]];
        k.every(10, 16, t => {
          const bar = pick(waltz);
          for (let b = 0; b < 2; b++) {
            k.blip(t + b * 1.2, bar[0] / 2, 0.5, 0.03, 'triangle', 0, hall);
            k.blip(t + b * 1.2 + 0.4, bar[1], 0.3, 0.018, 'triangle', 0, hall);
            k.blip(t + b * 1.2 + 0.8, bar[2], 0.3, 0.018, 'triangle', 0, hall);
          }
        });
        k.every(15, 28, t => { for (let i = 0; i < 3; i++) k.blip(t + i * 0.12, 2093, 0.4, 0.015, 'sine', 0, hall); });
        return 3.4;
      },
      // Santral (2.4): trafo vızıltısı (50 Hz ve harmonikleri), ara sıra elektrik çatırtısı
      santral(k) {
        k.drone('sawtooth', 50, 0.02, 220);
        const buzz = k.drone('square', 100, 0.006, 600);
        k.lfo(buzz.gain.gain, 0.15, 0.004);
        k.every(3, 8, t => {
          const n = 3 + Math.floor(rand() * 6);
          for (let i = 0; i < n; i++) k.puff(t + i * (0.02 + rand() * 0.05), 'highpass', 4000, 0.7, 0.03, 0.03);
        });
        return 3.2;
      },
      // Deniz Feneri (2.4): kabarıp çekilen dalgalar, uzakta martı, arada bir sis düdüğü
      fener(k) {
        const sea = k.bed('lowpass', 600, 0.7, 0.07);
        k.lfo(sea.gain.gain, 0.11, 0.05);
        k.lfo(sea.filter.frequency, 0.11, 250);
        k.every(7, 15, t => {
          const n = 2 + Math.floor(rand() * 2);
          for (let i = 0; i < n; i++) k.blip(t + i * 0.32, 1700 + rand() * 300, 0.28, 0.012, 'sine', 1100);
        });
        k.every(25, 45, t => { k.blip(t, 92, 2.6, 0.04, 'sawtooth', 88); k.blip(t, 138, 2.6, 0.015, 'sawtooth', 132); });
        return 2.6;
      },
      // Rasathane (2.4): gece cırcır böcekleri, yumuşak pad, arada teleskop motoru
      rasathane(k) {
        const pad = [146.8, 220, 329.6].map(f => k.drone('sine', f, 0.016));
        pad.forEach((p, i) => k.lfo(p.gain.gain, 0.04 + i * 0.03, 0.01));
        k.pulse(0.9, (t, n) => { if (n % 4 !== 3) for (let i = 0; i < 3; i++) k.blip(t + i * 0.045, 4200, 0.03, 0.008, 'sine'); });
        k.every(18, 32, t => k.blip(t, 180, 1.4, 0.02, 'sawtooth', 260));
        return 2.4;
      },
      // Havai Fişek (2.5): uzaktan gelen fişek gümlemeleri ve ardından çıtırtı, alçak kalabalık uğultusu
      fisek(k) {
        const crowd = k.bed('bandpass', 500, 0.7, 0.02);
        k.lfo(crowd.gain.gain, 0.06, 0.01);
        k.every(4, 9, t => {
          k.blip(t, 70, 0.6, 0.05, 'sine', 40);
          k.puff(t, 'lowpass', 700, 0.7, 0.5, 0.05, 0.01);
          const n = 6 + Math.floor(rand() * 10);
          for (let i = 0; i < n; i++) k.puff(t + 0.35 + i * (0.03 + rand() * 0.08), 'highpass', 3500 + rand() * 2000, 0.8, 0.03, 0.025);
        });
        k.every(10, 20, t => k.blip(t, 900, 0.9, 0.01, 'sine', 2600));
        return 3.0;
      },
      // Buzul (2.5): uluyan rüzgâr, uzakta buz çatırtısı, arada cam gibi şıngırtı
      buzul(k) {
        const wind = k.bed('bandpass', 500, 2.5, 0.07);
        k.lfo(wind.filter.frequency, 0.07, 260);
        k.lfo(wind.gain.gain, 0.05, 0.035);
        const cave = k.echo(0.4, 0.35, 3000);
        k.every(9, 18, t => { k.blip(t, 60, 0.9, 0.04, 'sine', 45); k.puff(t, 'bandpass', 900, 3, 0.25, 0.03); });
        k.every(6, 12, t => { for (let i = 0; i < 3; i++) k.blip(t + i * 0.09, 2600 + rand() * 1600, 0.6, 0.008, 'sine', 0, cave); });
        return 2.8;
      },
      // Değirmen (2.5): akan dere, ağır dönen çarkın tahta gıcırtısı ve tok vuruşu, arada kuş
      degirmen(k) {
        const brook = k.bed('bandpass', 1800, 0.9, 0.03);
        k.lfo(brook.gain.gain, 0.3, 0.01);
        k.pulse(2.4, (t, n) => {
          k.puff(t, 'lowpass', 300, 0.8, 0.12, 0.05);
          if (n % 2 === 0) k.blip(t + 0.6, 220, 0.5, 0.008, 'sawtooth', 170);
        });
        k.every(8, 16, t => { const f = 2400 + rand() * 600; for (let i = 0; i < 2; i++) k.blip(t + i * 0.15, f, 0.12, 0.012, 'sine', f * 1.2); });
        return 3.0;
      },
      // Büyü Kulesi (2.5): yavaş salınan gizemli pad, yankılı parıltı arpejleri
      buyu(k) {
        const pad = [130.8, 196, 277.2].map(f => k.drone('sine', f, 0.014));
        pad.forEach((p, i) => { k.lfo(p.gain.gain, 0.05 + i * 0.02, 0.009); k.lfo(p.osc.frequency, 0.1 + i * 0.03, 1.5); });
        const hall = k.echo(0.45, 0.45, 3500);
        const scale = [523.3, 587.3, 659.3, 739.9, 830.6, 932.3];
        k.every(7, 14, t => { for (let i = 0; i < 4; i++) k.blip(t + i * 0.14, pick(scale) * (rand() < 0.3 ? 2 : 1), 0.7, 0.012, 'sine', 0, hall); });
        return 2.6;
      },
      // Şeker Diyarı (2.6): şekerci dükkânı; kazanda fokurdayan şurup, cam kavanoz tınlaması, kapı zili, ambalaj hışırtısı
      seker(k) {
        const room = k.bed('lowpass', 400, 0.7, 0.02);
        k.lfo(room.gain.gain, 0.08, 0.008);
        k.every(0.4, 1.4, t => k.blip(t, 160 + rand() * 120, 0.12, 0.018, 'sine', 320 + rand() * 200));
        const jar = k.echo(0.3, 0.3, 4000);
        k.every(6, 12, t => k.blip(t, pick([1568, 1760, 2093, 2349]), 0.9, 0.01, 'sine', 0, jar));
        k.every(18, 34, t => { for (let i = 0; i < 2; i++) k.blip(t + i * 0.16, i ? 1975 : 2637, 0.8, 0.014, 'triangle', 0, jar); });
        k.every(9, 17, t => { for (let i = 0; i < 4; i++) k.puff(t + i * (0.04 + rand() * 0.05), 'highpass', 4500, 0.8, 0.05, 0.015); });
        return 2.8;
      },
      // Piramit (2.6): çöl rüzgârı ve savrulan kum; taş koridorda derin yankı, arada uzaktan ney
      piramit(k) {
        const wind = k.bed('bandpass', 420, 0.5, 0.045);
        k.lfo(wind.filter.frequency, 0.05, 180);
        k.lfo(wind.gain.gain, 0.04, 0.02);
        k.every(2, 5, t => k.puff(t, 'highpass', 3800 + rand() * 1500, 0.6, 0.9 + rand() * 0.8, 0.02, 0.3));
        const tomb = k.echo(0.45, 0.45, 1200);
        k.every(12, 24, t => k.blip(t, pick([65.4, 73.4, 82.4]), 2.4, 0.05, 'sine', 0, tomb));
        // ney: Hicaz dizisinden (Re, Mi bemol, Fa diyez, Sol, La) yavaş kayan iki üç nota
        k.every(16, 30, t => {
          let at = t;
          for (let i = 0, n = 2 + Math.floor(rand() * 2); i < n; i++, at += 0.9) {
            const f = pick([587.3, 622.3, 740, 784, 880]);
            k.blip(at, f * 0.995, 1.1, 0.012, 'triangle', f, tomb);
          }
        });
        return 3.2;
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
