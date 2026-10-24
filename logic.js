// Oyun kuralları: halkalar, kesişimler, serbest kalma ve çözücü.
// Hem tarayıcıda (window.RingLogic) hem Node'da (require) çalışır.
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const GAP_HALF = 26 * DEG;   // boşluğun görünen yarı genişliği
  const COVER_HALF = 18 * DEG; // kesişim noktası boşluğun bu kadar içindeyse halka geçebilir

  const norm = a => ((a % TAU) + TAU) % TAU;
  const angDist = (a, b) => { const d = norm(a - b); return Math.min(d, TAU - d); };
  const signedDelta = (from, to) => { let d = norm(to - from); if (d > Math.PI) d -= TAU; return d; };

  function circleIntersections(A, B) {
    const dx = B.x - A.x, dy = B.y - A.y;
    const d = Math.hypot(dx, dy);
    if (d >= A.r + B.r || d <= Math.abs(A.r - B.r) || d === 0) return null;
    const a = (A.r * A.r - B.r * B.r + d * d) / (2 * d);
    const h = Math.sqrt(A.r * A.r - a * a);
    const mx = A.x + a * dx / d, my = A.y + a * dy / d;
    const ox = -dy * h / d, oy = dx * h / d;
    return [{ x: mx + ox, y: my + oy }, { x: mx - ox, y: my - oy }];
  }

  // Düz çubuk ile çemberin kesişimleri (yalnızca çubuğun üzerindeki noktalar)
  function segmentCircle(B, C) {
    const dx = B.x2 - B.x1, dy = B.y2 - B.y1;
    const fx = B.x1 - C.x, fy = B.y1 - C.y;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - C.r * C.r;
    const disc = b * b - 4 * a * c;
    if (disc <= 0) return null;
    const sq = Math.sqrt(disc);
    const pts = [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]
      .filter(t => t >= 0 && t <= 1)
      .map(t => ({ x: B.x1 + dx * t, y: B.y1 + dy * t }));
    return pts.length ? pts : null;
  }

  function crossings(A, B) {
    if (A.kind === 'bar' && B.kind === 'bar') return null;
    if (A.kind === 'bar') return segmentCircle(A, B);
    if (B.kind === 'bar') return segmentCircle(B, A);
    return circleIntersections(A, B);
  }

  // Seviye tanımı (derece cinsinden) -> hesaplamaya hazır yapı.
  // Parçalar halka ya da düz çubuktur ({ type: 'bar', x1, y1, x2, y2 }).
  // Çubuk dönmez ve boşluğu yoktur; içinden geçtiği halkalar ondan kurtulunca çıkar.
  // Çerçeve ({ type: 'frame', points: [[x, y], ...] }) kapalı bir çokgendir: hiç oynamaz ve tahtadan
  // hiç çıkmaz; her kenarı ayrı bir çubuk gibi davranır. Bölüm, halkalar çerçeveden kurtulunca biter.
  // Döner tabla (def.table: { x, y, r, step, carried }): tabla, üstündeki halkaları merkezinin etrafında
  // step derecelik adımlarla taşır; taşınan halkaların boşlukları da tablayla döner. Tablanın her konumu
  // ayrı bir düzendir (kesişimler yeniden hesaplanır, halka numaraları aynı). Dönen yapı tablanın 0. konumu;
  // her konumda table, tableIdx ve bütün konumların listesi (variants) bulunur. Tabla çevirmek bir hamledir.
  function buildLevel(def) {
    if (!def.table) return buildPlain(def);
    const T = def.table, k = Math.round(360 / T.step);
    if (!T.step || Math.abs(k * T.step - 360) > 1e-9) throw new Error('Tabla adımı 360 derecenin tam böleni olmalı');
    for (const i of T.carried) {
      const r = def.rings[i];
      if (!r || r.type) throw new Error(`Tabla: ${i} numaralı parça taşınamaz`);
    }
    const variants = [];
    for (let t = 0; t < k; t++) {
      const a = t * T.step * DEG, c = Math.cos(a), s = Math.sin(a);
      const rings = def.rings.map((r, i) => {
        if (!T.carried.includes(i)) return r;
        const dx = r.x - T.x, dy = r.y - T.y;
        return { ...r, x: T.x + dx * c - dy * s, y: T.y + dx * s + dy * c };
      });
      const v = buildPlain({ ...def, rings });
      Object.assign(v, { table: { ...T, k }, tableIdx: t, vIdx: t, variants });
      variants.push(v);
    }
    return variants[0];
  }

  // Tabla bir adım (saat yönünde) döner: sonraki konum ve taşınan halkaların yeni açıları
  function turnTable(L, angles) {
    const T = L.table, out = angles.slice();
    for (const i of T.carried) out[i] = norm(out[i] + T.step * DEG);
    return { L: L.variants[(L.tableIdx + 1) % T.k], angles: out };
  }

  function buildPlain(def) {
    const rings = def.rings.map((r, i) => (r.type === 'frame' ? {
      id: i, kind: 'frame',
      x: r.points.reduce((s, q) => s + q[0], 0) / r.points.length,
      y: r.points.reduce((s, q) => s + q[1], 0) / r.points.length, r: 0,
      points: r.points.map(q => ({ x: q[0], y: q[1] })),
      segs: r.points.map((q, k) => {
        const q2 = r.points[(k + 1) % r.points.length];
        return { x1: q[0], y1: q[1], x2: q2[0], y2: q2[1] };
      }),
      fixed: true, gaps: [], lockedBy: -1, step: 0,
    } : r.type === 'bar' ? {
      id: i, kind: 'bar',
      x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2, r: 0,
      x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2,
      fixed: true, gaps: [],
    } : {
      id: i, kind: 'ring', x: r.x, y: r.y, r: r.r,
      fixed: !!r.fixed,
      gaps: (r.gaps || [0]).map(g => g * DEG),
      // Tıklı halka: yalnızca başlangıç açısından step'in katları kadar döner (derece; 360'ı tam bölmeli)
      step: r.step ? r.step * DEG : 0,
      // Cırcır halka (ratchet: 1 saat yönü, -1 ters; tıklı halkada): yalnız o yöne ve her hamlede tek tık döner.
      // Geri gitmek turu tamamlamayı ister. Dönüşü hep oyuncudan gelir (yay hedefi ya da motor olamaz).
      ratchet: r.ratchet ? Math.sign(r.ratchet) : 0,
      // Anahtarlı kilit: lockedBy numaralı halka tahtadan çıkana kadar bu halka dönmez
      lockedBy: r.lockedBy == null ? -1 : r.lockedBy,
      // Yaylı halka (kick: [hedef, derece]): tahtadan çıkarken hedef halkayı o kadar döndürür
      // (artı saat yönü). Tekme hamle sayılmaz; hedefin eşleri de kendi oranlarıyla döner.
      kick: r.kick ? { target: r.kick[0], turn: r.kick[1] * DEG } : null,
      // Jetonlu halka (tokens: n, 0 olabilir): her döndürme bir jeton harcar, jetonu yoksa dönmez.
      // Jeton taşıyan halka (token: k) kurtulunca k numaralı jetonlu halkaya bir jeton verir.
      // Yay tekmesi jeton harcamaz.
      tokens: r.tokens == null ? null : r.tokens,
      token: r.token == null ? -1 : r.token,
      // Şalter rengi (side: 0 mavi, 1 turuncu): yalnızca şalter o rengi gösterirken döner. Bölümde
      // def.switch (başlangıç rengi) varsa tahtada bir şalter vardır; ona dokunmak bir hamledir.
      side: r.side == null ? -1 : r.side,
      // Nabız halka (pulse: 0 ya da 1): boşluğunda bir kapak var, her hamlede açılıp kapanır.
      // Hamle sayısının teki/çifti ph ile tutulur; kapak ph === pulse iken açıktır (başta ph = 0).
      pulse: r.pulse == null ? -1 : r.pulse,
      // Bomba halka (bomb: true): tahtadan çıkınca patlar, kesiştiği halkalar ve çubuklar öbür bağlarına
      // bakılmadan bir sonraki dalgada uçar. Patlamaya yakalanan bomba da patlar (zincir).
      bomb: !!r.bomb,
      // Buz halka (ice: n, 1 ya da 2): donmuştur, dönmez. Kesiştiği parçalardan her biri tahtadan çıktıkça
      // buzu bir kat çatlar; n parça çıkınca erir ve döner. Donmuşken de boşluğu denk gelirse kurtulabilir.
      ice: r.ice || 0,
      // Motor halka (motor: derece, artı saat yönü): oyuncu çeviremez; oyuncunun her hamlesinden sonra
      // (o hamlenin kurtardıkları uçtuktan sonra) kendiliğinden bu kadar döner. Dönüşü açının içinde kalır.
      motor: r.motor ? r.motor * DEG : 0,
      // İkiz portal (portal: n): aynı numarayı taşıyan iki halka ikizdir. Biri tahtadan çıkınca öbürü kendi
      // bağlarına bakılmadan bir sonraki dalgada ışınlanıp çıkar (portal: -1 portalsız).
      portal: r.portal == null ? -1 : r.portal,
      // Basınç kazanı (boiler: n, 1-3): kesiştiği parçalardan n tanesi tahtadan çıkınca basınç dolar, kazan
      // bir sonraki dalgada kendiliğinden çıkar. Nasıl çıkarsa çıksın bomba gibi patlar: hâlâ değdiği parçalar da uçar.
      boiler: r.boiler || 0,
      // Dev Halka (boss: n, 1-6): zırhlıdır, dönmez. Kesiştiği parçalardan her biri tahtadan çıktıkça zırhından
      // bir plaka kırılır; n plaka kırılınca bir sonraki dalgada parçalanıp kendiliğinden çıkar (patlamaz).
      boss: r.boss || 0,
      // Şeker rengi (paint: 0-2, yoksa -1): halkanın renk grubu. Renk bombası (cbomb: true, renkli halkada)
      // tahtadan çıkınca kendi rengindeki bütün halkalar bağlarına bakılmadan bir sonraki dalgada uçar.
      paint: r.paint == null ? -1 : r.paint,
      cbomb: !!r.cbomb,
      // İnci halka (pearl: k): k numaralı istiridye halkasının içinde saklıdır. İstiridye tahtadayken inci yok sayılır
      // (kesişmez, dönmez, kurtulmaz, patlamalar onu vurmaz); istiridye çıkınca belirir ve normal bir halka olur
      pearl: r.pearl == null ? -1 : r.pearl,
      // Zincirli ikiz (chain: n): aynı numarayı taşıyan iki halka zincirlidir; ancak ikisi aynı anda serbestken birlikte
      // uçarlar. Patlamanın zorla uçurduğu zincirliyi zincir tutmaz (zincir kopar, eşi tek başına kurtulabilir)
      chain: r.chain == null ? -1 : r.chain,
      // Rüzgâr halka (gust: derece, artı saat yönü): tahtadan çıkınca değdiği her halkayı bu kadar döndürür; oyuncunun
      // çeviremediği sabit (taş) halkaları da. Yaylı halkanın tekmesi gibi hamle sayılmaz. Tıklı komşu ancak dönüş tık
      // adımının katıysa döner
      gust: r.gust ? r.gust * DEG : 0,
      // Fitil halka (fuse: n, 1-4): değdiği halkalardan biri tahtadan çıkınca fitili tutuşur; sayaç oyuncunun her
      // hamlesinde bir azalır, sıfırda halka patlar ve o anda değdiği halkaları uçurur. Fitili yanmadan ya da yanarken
      // kendiliğinden kurtulursa patlamaz (patlama boşa gider). Sayaç jetonların dizisinde (left) tutulur
      fuse: r.fuse || 0,
    }));
    for (const [i, r] of def.rings.entries()) {
      if (r.lockedBy == null) continue;
      const k = def.rings[r.lockedBy];
      if (!k || r.lockedBy === i || k.type === 'bar' || k.type === 'frame') throw new Error(`Halka ${i}: anahtar halkası geçersiz`);
      if (r.fixed) throw new Error(`Halka ${i}: hem sabit hem anahtarlı olamaz`);
    }
    for (const [i, r] of def.rings.entries()) {
      if (r.bomb && r.type) throw new Error(`Parça ${i}: bomba yalnızca halka olabilir`);
      // Bomba ve yay rozeti aynı halkada yer kapışırdı
      if (r.bomb && r.kick) throw new Error(`Halka ${i}: bomba yaylı olamaz`);
      // Buz rozeti bomba ve yay rozetiyle aynı yere düşerdi
      if (r.ice && (r.bomb || r.kick)) throw new Error(`Halka ${i}: buz halka bomba ya da yaylı olamaz`);
      if (r.ice && (r.type || r.fixed || r.tokens != null || !(r.ice >= 1 && r.ice <= 3))) throw new Error(`Halka ${i}: buz 1-3 kat, sabit ya da jetonlu olmayan halkada olur`);
    }
    const portalRings = {};
    for (const [i, r] of def.rings.entries()) {
      if (!r.boss) continue;
      if (r.type || r.bomb || r.kick || r.ice || r.motor || r.boiler || r.portal != null || r.fixed || r.tokens != null || r.lockedBy != null || !(r.boss >= 1 && r.boss <= 6)) {
        throw new Error(`Halka ${i}: dev halka 1-6 zırhlı, başka parçayla birleşmeyen halkada olur`);
      }
    }
    for (const [i, r] of def.rings.entries()) {
      if (!r.boiler) continue;
      // Kazan rozeti öbür rozetlerle aynı yere düşerdi; bir halka hem kazan hem bomba olmaz (kazan zaten patlar)
      if (r.type || r.bomb || r.kick || r.ice || r.motor || r.portal != null || r.fixed || !(r.boiler >= 1 && r.boiler <= 3)) {
        throw new Error(`Halka ${i}: kazan 1-3 basınçlı, başka parçayla birleşmeyen halkada olur`);
      }
    }
    for (const [i, r] of def.rings.entries()) {
      if (r.portal == null) continue;
      // Portal rozeti bomba, yay, buz ve motor rozetiyle aynı yere düşerdi
      if (r.type || r.bomb || r.kick || r.ice || r.motor) throw new Error(`Halka ${i}: portal yalnızca bombasız, yaysız, buzsuz, motorsuz halkada olur`);
      (portalRings[r.portal] = portalRings[r.portal] || []).push(i);
    }
    for (const [n, list] of Object.entries(portalRings)) if (list.length !== 2) throw new Error(`Portal ${n}: tam iki halkada olmalı`);
    const painted = [[], [], []];
    for (const [i, r] of def.rings.entries()) {
      if (r.paint == null) {
        if (r.cbomb) throw new Error(`Halka ${i}: renk bombasının rengi yok`);
        continue;
      }
      // Sabit ve şalterli halkanın kendi rengi var; renk bombası rozeti öbür rozetlerle aynı yere düşerdi
      if (r.type || r.fixed || r.side != null || ![0, 1, 2].includes(r.paint)) throw new Error(`Halka ${i}: şeker rengi 0-2, sabit ya da şalterli olmayan halkada olur`);
      if (r.cbomb && (r.bomb || r.kick || r.ice || r.motor || r.boiler || r.boss || r.portal != null)) throw new Error(`Halka ${i}: renk bombası başka parçayla birleşemez`);
      painted[r.paint].push(i);
    }
    for (const [i, r] of def.rings.entries()) if (r.cbomb && painted[r.paint].length < 2) throw new Error(`Halka ${i}: renk bombasının renginde başka halka yok`);
    const chained = {};
    for (const [i, r] of def.rings.entries()) {
      if (r.chain == null) continue;
      // Portal ve inci de iki halkalık bağlar; birleşince hangisinin geçerli olduğu belirsiz kalırdı
      if (r.type || r.portal != null || r.pearl != null || def.rings.some(o => o.pearl === i)) throw new Error(`Halka ${i}: zincir portal, inci ya da istiridyeyle birleşemez`);
      (chained[r.chain] = chained[r.chain] || []).push(i);
    }
    for (const [n, list] of Object.entries(chained)) if (list.length !== 2) throw new Error(`Zincir ${n}: tam iki halkada olmalı`);
    for (const [i, r] of def.rings.entries()) {
      if (r.pearl == null) continue;
      const k = def.rings[r.pearl];
      // İstiridye düz bir halka, kendisi inci değil; inci komşu sayısına bağlı ya da başka halkayı taşıyan parça olamaz
      if (!k || r.pearl === i || k.type || k.pearl != null || k.fixed) throw new Error(`Halka ${i}: incinin istiridyesi geçersiz`);
      if (r.type || r.motor || r.portal != null || r.ice || r.boiler || r.boss || r.lockedBy != null || def.rings.some(o => o.kick && o.kick[0] === i)) {
        throw new Error(`Halka ${i}: inci başka parçayla birleşemez`);
      }
    }
    for (const [i, r] of def.rings.entries()) {
      if (!r.fuse) continue;
      if (!(r.fuse >= 1 && r.fuse <= 4)) throw new Error(`Halka ${i}: fitil 1-4 hamle olur`);
      // Sayaç jetonun yerini kullanır; öbür patlayan, kendiliğinden çıkan ya da saklanan parçalarla birleşmez
      if (r.type || r.tokens != null || r.bomb || r.boiler || r.cbomb || r.boss || r.pearl != null || def.rings.some(o => o.pearl === i)) {
        throw new Error(`Halka ${i}: fitil halka başka bir patlayan parçayla, jetonla ya da inciyle birleşemez`);
      }
    }
    for (const [i, r] of def.rings.entries()) {
      if (!r.motor) continue;
      if (r.type || 360 % Math.abs(r.motor)) throw new Error(`Halka ${i}: motor adımı 360'ı tam bölmeli`);
      // Motor yalnız düz halkada: başka bir kural onu durdurur ya da döndürürse adımı şaşardı
      if (r.fixed || r.step || r.lockedBy != null || r.kick || r.tokens != null || r.side != null || r.pulse != null || r.bomb || r.ice) {
        throw new Error(`Halka ${i}: motor halka başka bir parçayla birleşemez`);
      }
    }
    for (const [i, r] of def.rings.entries()) {
      if (r.step && (360 % r.step || r.step <= 0)) throw new Error(`Halka ${i}: tık adımı 360'ı tam bölmeli`);
      if (r.ratchet && (r.type || !r.step || r.fixed || r.motor)) throw new Error(`Halka ${i}: cırcır yalnızca tıklı, sabit ve motorlu olmayan halkada olur`);
    }
    const n = rings.length;
    const links = [];
    const ringLinks = rings.map(() => []);
    const angOn = (P, p) => (P.kind !== 'ring' ? 0 : norm(Math.atan2(p.y - P.y, p.x - P.x)));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const A = rings[i], B = rings[j];
        if (A.kind === 'frame' || B.kind === 'frame') {
          // Çerçeve ile halka: her kenar ayrı bir bağ (kenarın çizgisi `seg` çizim için saklanır)
          if (A.kind !== 'ring' && B.kind !== 'ring') continue;
          const [F, R] = A.kind === 'frame' ? [A, B] : [B, A];
          for (const seg of F.segs) {
            const pts = segmentCircle(seg, R);
            if (!pts) continue;
            if (pts.length !== 2) throw new Error(`Halka ${R.id}: çerçevenin köşesi halkanın içinde kalmamalı`);
            ringLinks[i].push(links.length);
            ringLinks[j].push(links.length);
            links.push({ a: i, b: j, seg, pts: pts.map(p => ({ x: p.x, y: p.y, angA: angOn(A, p), angB: angOn(B, p) })) });
          }
          continue;
        }
        const pts = crossings(rings[i], rings[j]);
        if (!pts) continue;
        const link = {
          a: i, b: j,
          pts: pts.map(p => ({ x: p.x, y: p.y, angA: angOn(A, p), angB: angOn(B, p) })),
        };
        ringLinks[i].push(links.length);
        ringLinks[j].push(links.length);
        links.push(link);
      }
    }
    // Birlikte dönen halka grupları. Eş tanımı [a, b] ya da [a, b, oran]:
    // a δ kadar dönünce b oran·δ kadar döner (1: aynı yöne, -1: ters dişli, 2: hızlı dişli).
    // factor[i]: halkanın grubundaki dönüş katsayısı; i döndürülünce k, δ·factor[k]/factor[i] döner.
    const couples = (def.couples || []).map(([a, b, ratio]) => ({ a, b, ratio: ratio == null ? 1 : ratio }));
    const adj = rings.map(() => []);
    for (const c of couples) {
      if (!c.ratio) throw new Error('Eş oranı sıfır olamaz');
      adj[c.a].push([c.b, c.ratio]);
      adj[c.b].push([c.a, 1 / c.ratio]);
    }
    const factor = rings.map(() => 0);
    const groupId = rings.map((_, i) => i);
    for (let i = 0; i < n; i++) {
      if (factor[i]) continue;
      factor[i] = 1;
      const stack = [i];
      while (stack.length) {
        const u = stack.pop();
        for (const [v, r] of adj[u]) {
          const f = factor[u] * r;
          if (!factor[v]) { factor[v] = f; groupId[v] = i; stack.push(v); }
          else if (Math.abs(factor[v] - f) > 1e-9) throw new Error(`Eş oranları çelişiyor (halka ${v})`);
        }
      }
    }
    const group = rings.map((_, i) => rings.filter((_, k) => groupId[k] === groupId[i]).map(r => r.id));
    // Tıklı halka eşli olamaz: eşi farklı oranla dönünce halka tık yerlerinin dışına düşerdi
    for (const r of rings) if (r.step && group[r.id].length > 1) throw new Error(`Halka ${r.id}: tıklı halka eşli olamaz`);
    // Jetonlu halka eşli olamaz: eşi döndürülünce jeton harcanıp harcanmadığı belirsiz kalırdı
    for (const r of rings) if (r.tokens != null && (group[r.id].length > 1 || r.fixed || r.lockedBy >= 0 || r.kick)) throw new Error(`Halka ${r.id}: jetonlu halka eşli, sabit, anahtarlı ya da yaylı olamaz`);
    for (const r of rings) {
      if (!(r.token >= 0)) continue; // çubuk ve çerçevede alan yok
      const t = rings[r.token];
      if (!t || t === r || t.tokens == null) throw new Error(`Halka ${r.id}: jetonun gideceği halka jetonlu değil`);
    }
    // Eşler aynı renkte olmalı: kapalı renkteki halka, eşi döndü diye dönmesin
    for (const r of rings) {
      if (r.side == null) continue;
      if (group[r.id].some(k => rings[k].side !== r.side)) throw new Error(`Halka ${r.id}: eşler aynı şalter renginde olmalı`);
      if (r.side >= 0 && def.switch == null) throw new Error(`Halka ${r.id}: şalter rengi var ama bölümde şalter yok`);
    }
    // Buz halka eşli olamaz: eşi döndürülünce donmuş halka da dönerdi
    for (const r of rings) if (r.ice && group[r.id].length > 1) throw new Error(`Halka ${r.id}: buz halka eşli olamaz`);
    for (const r of rings) if (r.motor && group[r.id].length > 1) throw new Error(`Halka ${r.id}: motor halka eşli olamaz`);
    // Anahtarlı halka da eşli olamaz (kilidi tek başına açılmalı, eşini kilitlememeli)
    for (const r of rings) if (r.lockedBy >= 0 && group[r.id].length > 1) throw new Error(`Halka ${r.id}: anahtarlı halka eşli olamaz`);
    const rotatable = rings.map((r, i) => group[i].every(k => !rings[k].fixed));
    // Yay hedefi dönebilen, kilitsiz bir halka olmalı; tıklıysa tekme tık adımının katı olmalı
    const kickedBy = rings.map(() => []);
    for (const r of rings) {
      if (!r.kick) continue;
      const t = rings[r.kick.target];
      if (!t || t === r || t.kind !== 'ring' || !rotatable[t.id] || t.lockedBy >= 0 || t.ice || t.motor || t.boss || t.ratchet) throw new Error(`Halka ${r.id}: yayın hedefi geçersiz`);
      if (!r.kick.turn) throw new Error(`Halka ${r.id}: yayın tekmesi sıfır olamaz`);
      for (const k of group[t.id]) {
        const st = rings[k].step;
        if (st && Math.abs(r.kick.turn * factor[k] / factor[t.id] / st % 1) > 1e-9) throw new Error(`Halka ${r.id}: tekme tık adımına uymuyor`);
      }
      kickedBy[t.id].push(r.id);
    }
    // Rüzgârın dönebilen komşuları (tekmesi gibi): tekme alabilecek halkalar
    const gustTargets = rings.map(r => (!r.gust ? [] : [...new Set(ringLinks[r.id].map(li => (links[li].a === r.id ? links[li].b : links[li].a)))]
      .filter(o => { const t = rings[o]; return t.kind === 'ring' && !(t.lockedBy >= 0) && !t.ice && !t.motor && !t.boss && group[o].length === 1 && (!t.step || Math.abs(r.gust / t.step % 1) < 1e-9); })));
    for (const r of rings) {
      if (!r.gust) continue;
      const d = def.rings[r.id];
      if (d.type || d.kick || d.bomb || d.cbomb || d.boiler || d.motor || d.portal != null || d.pearl != null || d.chain != null || d.ice || 360 % Math.abs(d.gust)) throw new Error(`Halka ${r.id}: rüzgâr halka başka parçayla birleşemez, adımı 360'ı bölmeli`);
      if (!gustTargets[r.id].length) throw new Error(`Halka ${r.id}: rüzgârın döndürebileceği komşu yok`);
      for (const o of gustTargets[r.id]) kickedBy[o].push(r.id);
    }

    // Buz halkanın ve kazanın komşuları (çerçeve hiç çıkmadığı için sayılmaz)
    const iceNbrs = rings.map((r, i) => (!r.ice && !r.boiler && !r.boss && !r.fuse ? [] : [...new Set(ringLinks[i].map(li => (links[li].a === i ? links[li].b : links[li].a)))]
      .filter(o => rings[o].kind !== 'frame')));
    for (const r of rings) if (r.ice && iceNbrs[r.id].length < r.ice) throw new Error(`Halka ${r.id}: buzu eritecek kadar komşusu yok`);
    for (const r of rings) if (r.boiler && iceNbrs[r.id].length < r.boiler) throw new Error(`Halka ${r.id}: kazanı dolduracak kadar komşusu yok`);
    for (const r of rings) if (r.fuse && !iceNbrs[r.id].length) throw new Error(`Halka ${r.id}: fitili tutuşturacak komşu yok`);
    for (const r of rings) if (r.boss && iceNbrs[r.id].length < r.boss) throw new Error(`Halka ${r.id}: dev halkanın zırhını kıracak kadar komşusu yok`);
    // Dev halka eşli olamaz: eşi dönünce zırhlı halka da dönerdi
    for (const r of rings) if (r.boss && group[r.id].length > 1) throw new Error(`Halka ${r.id}: dev halka eşli olamaz`);
    // İnci eşli olamaz: istiridye tahtadayken eşi dönünce görünmeyen inci de dönerdi
    for (const r of rings) if (r.pearl >= 0 && group[r.id].length > 1) throw new Error(`Halka ${r.id}: inci eşli olamaz`);

    return {
      rings, links, ringLinks, group, groupId, rotatable, factor, couples, kickedBy, gustTargets, iceNbrs,
      // Her şeker renginin halkaları
      painted,
      // Bölümün bitişi: çerçeveler dışında her parça tahtadan çıkmış olmalı
      full: rings.reduce((m, r, i) => (r.kind === 'frame' ? m : m | (1 << i)), 0),
      startAngles: def.rings.map(r => norm((r.a || 0) * DEG)),
      // Başlangıç jetonları (jetonsuz halkada null)
      tokens: rings.map(r => r.tokens),
      // Şalter: bölümde var mı, başta hangi renk açık
      hasSwitch: def.switch != null,
      startSw: def.switch || 0,
      hasPulse: rings.some(r => r.pulse >= 0),
      hasBomb: rings.some(r => r.bomb),
      hasIce: rings.some(r => r.ice),
      boilers: rings.filter(r => r.boiler).map(r => r.id),
      bosses: rings.filter(r => r.boss).map(r => r.id),
      motors: rings.filter(r => r.motor).map(r => r.id),
      fuses: rings.filter(r => r.fuse).map(r => r.id),
      // İncinin istiridyesi (inci olmayanda -1)
      shellOf: rings.map(r => (r.kind === 'ring' ? r.pearl : -1)),
      // Zincirli eşi (yoksa -1)
      chainMate: rings.map(r => (!(r.chain >= 0) ? -1 : rings.findIndex(o => o !== r && o.chain === r.chain))),
      // Portal ikizi (yoksa -1)
      twin: rings.map(r => (!(r.portal >= 0) ? -1 : rings.findIndex(o => o !== r && o.portal === r.portal))),
    };
  }

  // Halka i döndürüldü: jetonluysa bir jeton harcanır (yeni dizi döner)
  function spend(L, left, i) {
    if (left[i] == null || L.rings[i].fuse) return left;
    const out = left.slice();
    out[i]--;
    return out;
  }

  // Buz halkanın kalan katı: kat sayısından, tahtadan çıkmış komşular düşülür (buzsuz halkada 0)
  function iceLeft(L, i, mask) {
    const n = L.rings[i].ice;
    if (!n) return 0;
    let gone = 0;
    for (const o of L.iceNbrs[i]) if (mask & (1 << o)) gone++;
    return Math.max(0, n - gone);
  }

  // Kazanın dolmasına kalan: basınçtan tahtadan çıkmış komşular düşülür (kazansız halkada 0)
  function pressureLeft(L, i, mask) {
    const n = L.rings[i].boiler;
    if (!n) return 0;
    let gone = 0;
    for (const o of L.iceNbrs[i]) if (mask & (1 << o)) gone++;
    return Math.max(0, n - gone);
  }

  // Dev halkanın kalan zırh plakası: plaka sayısından tahtadan çıkmış komşular düşülür (dev olmayan halkada 0)
  function armorLeft(L, i, mask) {
    const n = L.rings[i].boss;
    if (!n) return 0;
    let gone = 0;
    for (const o of L.iceNbrs[i]) if (mask & (1 << o)) gone++;
    return Math.max(0, n - gone);
  }

  // İnci halka istiridyesi tahtadayken görünmez (yok sayılır)
  const hidden = (L, i, mask) => L.shellOf[i] >= 0 && !(mask & (1 << L.shellOf[i]));

  // Halka i şu an döndürülebilir mi? Sabit değil, buzu erimiş, (anahtarlıysa) anahtarı tahtadan çıkmış ve
  // (jetonluysa) jetonu kalmış olmalı. left: kalan jetonlar (verilmezse başlangıçtaki).
  // sw: şalterin gösterdiği renk (verilmezse başlangıçtaki); başka renkteki halka dönmez.
  function canRotate(L, i, mask, left, sw) {
    if (!L.rotatable[i] || hidden(L, i, mask)) return false;
    if (L.rings[i].motor) return false;
    if (iceLeft(L, i, mask) || armorLeft(L, i, mask)) return false;
    if ((left || L.tokens)[i] === 0) return false;
    const side = L.rings[i].side;
    if (side >= 0 && side !== (sw == null ? L.startSw : sw)) return false;
    const key = L.rings[i].lockedBy;
    return key < 0 || !!(mask & (1 << key));
  }

  // ph verilirse nabız halkanın kapağı kapalıyken boşluk sayılmaz; verilmezse yalnızca geometri
  function gapCovers(ring, angle, target, ph) {
    if (ph != null && ring.pulse >= 0 && ring.pulse !== ph) return false;
    for (const g of ring.gaps) if (angDist(angle + g, target) < COVER_HALF) return true;
    return false;
  }

  function pointOpen(L, link, p, angles, ph) {
    if (ph == null) ph = 0;
    return gapCovers(L.rings[link.a], angles[link.a], p.angA, ph) ||
           gapCovers(L.rings[link.b], angles[link.b], p.angB, ph);
  }

  function linkOpen(L, link, angles, ph) {
    return link.pts.some(p => pointOpen(L, link, p, angles, ph));
  }

  // mask: bit i = 1 ise halka i tahtadan çıkmış
  function isFree(L, i, angles, mask, ph) {
    for (const li of L.ringLinks[i]) {
      const k = L.links[li];
      const other = k.a === i ? k.b : k.a;
      if (mask & (1 << other) || hidden(L, other, mask)) continue;
      if (!linkOpen(L, k, angles, ph)) return false;
    }
    return true;
  }

  // Serbest halkaları dalga dalga çıkarır; her dalga ayrı animasyon için döner.
  // Dalgada çıkan yaylı halkalar hedeflerini döndürür (kicks[w]: w. dalganın tekmeleri);
  // tekmelerden sonraki açılar `angles` olarak döner. Jeton taşıyan halkalar çıkınca jetonları
  // hedeflerine geçer: `left` kalan jetonlar (verilmezse başlangıçtaki), `tokens[w]` w. dalganın jetonları.
  // ph: nabız kapaklarının o anki hali (hamle sayısının teki/çifti, verilmezse 0)
  // Dalgada çıkan bombalar patlar: blasts[w] = [{ from, hits }]; vurulanlar sonraki dalgada uçar.
  // Renk bombasının patlaması { from, hits, paint } (hits: o renkte tahtada kalanlar).
  // Dalgada çıkan portalın ikizi tahtadaysa ışınlanır: portals[w] = [{ from, to }]; ikiz sonraki dalgada uçar.
  // Dalgadan sonra basıncı dolan kazanlar ve zırhı biten dev halkalar: fuses[w] = [halka]; sonraki dalgada çıkarlar
  // (kazan patlar, dev halka yalnızca parçalanır).
  // boom: sayacı bu hamlede biten fitiller (ilk dalgada zorla çıkar ve patlar). lit[w] = [halka]: w. dalgada tutuşan fitiller
  function cascade(L, angles, mask, left, ph, boom = 0) {
    left = left || L.tokens;
    const waves = [], kicks = [], tokens = [], blasts = [], portals = [], fuses = [], lit = [];
    let hit = boom; // patlamanın vurduğu ya da portalla ışınlanan, sonraki dalgada zorla uçacak parçalar
    for (;;) {
      let free = 0;
      for (let i = 0; i < L.rings.length; i++) {
        if (mask & (1 << i) || L.rings[i].kind === 'frame' || hidden(L, i, mask)) continue;
        if ((hit & (1 << i)) || isFree(L, i, angles, mask, ph)) free |= 1 << i;
      }
      // Zincirli halka eşi de serbestken (ya da eşi gitmişken) uçar; patlamanın vurduğunu zincir tutmaz
      const wave = [];
      for (let i = 0; i < L.rings.length; i++) {
        if (!(free & (1 << i))) continue;
        const m = L.chainMate[i];
        if (m < 0 || hit & (1 << i) || mask & (1 << m) || free & (1 << m)) wave.push(i);
      }
      if (!wave.length) break;
      for (const i of wave) mask |= 1 << i;
      const ks = [];
      for (const i of wave) {
        const k = L.rings[i].kick;
        if (!k || (mask & (1 << k.target))) continue;
        angles = rotate(L, angles, k.target, k.turn);
        ks.push({ from: i, target: k.target, turn: k.turn });
      }
      // Rüzgâr: çıkan rüzgâr halkası tahtada kalan dönebilir komşularının hepsini döndürür
      for (const i of wave) {
        for (const o of L.gustTargets[i]) {
          if (mask & (1 << o) || hidden(L, o, mask)) continue;
          angles = rotate(L, angles, o, L.rings[i].gust);
          ks.push({ from: i, target: o, turn: L.rings[i].gust, gust: true });
        }
      }
      const ts = [];
      for (const i of wave) {
        const t = L.rings[i].token;
        if (!(t >= 0) || (mask & (1 << t))) continue;
        left = left.slice(); left[t]++;
        ts.push({ from: i, to: t });
      }
      const bs = [];
      hit = 0;
      for (const i of wave) {
        const r = L.rings[i];
        if (!r.bomb && !r.boiler && !r.cbomb && !(boom & (1 << i))) continue;
        // Bomba ve kazan kesiştiklerini, renk bombası kendi rengindekileri vurur
        const near = r.cbomb ? L.painted[r.paint] : L.ringLinks[i].map(li => (L.links[li].a === i ? L.links[li].b : L.links[li].a));
        const hits = [];
        for (const o of near) {
          if (mask & (1 << o) || hit & (1 << o) || L.rings[o].kind === 'frame' || hidden(L, o, mask)) continue;
          hit |= 1 << o;
          hits.push(o);
        }
        if (hits.length) bs.push(r.cbomb ? { from: i, hits, paint: r.paint } : { from: i, hits });
      }
      const ps = [];
      for (const i of wave) {
        const o = L.twin[i];
        if (o < 0 || mask & (1 << o) || hit & (1 << o)) continue;
        hit |= 1 << o;
        ps.push({ from: i, to: o });
      }
      const fs = [];
      for (const i of L.boilers.concat(L.bosses)) {
        if (mask & (1 << i) || hit & (1 << i) || pressureLeft(L, i, mask) || armorLeft(L, i, mask)) continue;
        hit |= 1 << i;
        fs.push(i);
      }
      const ls = [];
      for (const i of L.fuses) {
        if (mask & (1 << i) || hit & (1 << i) || left[i] != null || !L.iceNbrs[i].some(o => wave.includes(o))) continue;
        left = left.slice(); left[i] = L.rings[i].fuse;
        ls.push(i);
      }
      waves.push(wave);
      lit.push(ls);
      kicks.push(ks);
      tokens.push(ts);
      blasts.push(bs);
      portals.push(ps);
      fuses.push(fs);
    }
    return { mask, waves, kicks, tokens, blasts, portals, fuses, lit, angles, left };
  }

  // Oyuncunun hamlesinden sonraki her şey: önce serbest kalanlar uçar, sonra tahtada kalan motor halkalar
  // birer adım döner ve yeniden serbest kalanlar uçar. Motor dönüşleri son ilk-aşama dalgasının tekmeleri
  // arasında { from, target, turn, motor: true } olarak döner (o aşamada dalga yoksa boş bir dalga açılır).
  // Hamleden önce yanan fitiller bir kısalır; sayacı biten fitil bu hamlenin ilk dalgasında patlar
  function afterMove(L, angles, mask, left, ph) {
    left = left || L.tokens;
    let boom = 0;
    for (const i of L.fuses) {
      if (mask & (1 << i) || left[i] == null) continue;
      left = left.slice(); left[i]--;
      if (!left[i]) boom |= 1 << i;
    }
    const c = cascade(L, angles, mask, left, ph, boom);
    const turning = L.motors.filter(i => !(c.mask & (1 << i)));
    if (!turning.length) return c;
    let a = c.angles;
    const ms = turning.map(i => {
      a = rotate(L, a, i, L.rings[i].motor);
      return { from: i, target: i, turn: L.rings[i].motor, motor: true };
    });
    const d = cascade(L, a, c.mask, c.left, ph);
    const out = { mask: d.mask, angles: d.angles, left: d.left, waves: c.waves.slice(), kicks: c.kicks.slice(), tokens: c.tokens.slice(), blasts: c.blasts.slice(), portals: c.portals.slice(), fuses: c.fuses.slice(), lit: c.lit.slice() };
    if (!out.waves.length) { out.waves.push([]); out.kicks.push([]); out.tokens.push([]); out.blasts.push([]); out.portals.push([]); out.fuses.push([]); out.lit.push([]); }
    const w = out.kicks.length - 1;
    out.kicks[w] = [...out.kicks[w], ...ms];
    out.waves.push(...d.waves); out.kicks.push(...d.kicks); out.tokens.push(...d.tokens); out.blasts.push(...d.blasts); out.portals.push(...d.portals); out.fuses.push(...d.fuses); out.lit.push(...d.lit);
    return out;
  }

  // Halka i'yi delta kadar döndürür; eşleri kendi oranlarıyla döner
  function rotate(L, angles, i, delta) {
    const out = angles.slice();
    for (const k of L.group[i]) out[k] = norm(out[k] + delta * L.factor[k] / L.factor[i]);
    return out;
  }

  // Tıklı halkanın t açısına en yakın tık yeri (tık yerleri başlangıç açısından ölçülür)
  function snapStep(L, i, t) {
    const ring = L.rings[i];
    if (!ring.step) return t;
    const base = L.startAngles[i];
    return norm(base + Math.round(signedDelta(base, t) / ring.step) * ring.step);
  }

  // Halka i için anlamlı hedef açılar: boşluğu henüz açık olmayan bir kesişime getirmek.
  // Tıklı halkada hedef en yakın tık yerine çekilir; boşluk orada kesişimi açmıyorsa hedef sayılmaz.
  function candidates(L, angles, mask, i, ph) {
    const ring = L.rings[i];
    // Cırcırın tek hamlesi: yönünde bir tık
    if (ring.ratchet) return [norm(angles[i] + ring.ratchet * ring.step)];
    const out = [];
    const pendingKicks = L.kickedBy[i].filter(s => !(mask & (1 << s))).map(s => (L.rings[s].kick ? L.rings[s].kick.turn : L.rings[s].gust));
    for (const li of L.ringLinks[i]) {
      const k = L.links[li];
      const other = k.a === i ? k.b : k.a;
      if (mask & (1 << other) || hidden(L, other, mask)) continue;
      for (const p of k.pts) {
        if (pointOpen(L, k, p, angles, ph)) continue;
        const angI = k.a === i ? p.angA : p.angB;
        for (const g of ring.gaps) {
          // Bekleyen yay tekmesi varsa boşluğu tekmeden sonra kesişime düşecek yere de getirmek anlamlı
          for (const pre of [0, ...pendingKicks]) {
            const t = snapStep(L, i, norm(angI - g - pre));
            if (ring.step && !gapCovers(ring, norm(t + pre), angI)) continue;
            if (angDist(t, angles[i]) < DEG / 2) continue;
            if (!out.some(o => angDist(o, t) < DEG)) out.push(t);
          }
        }
      }
    }
    // Nabızlı ya da motorlu bölümde boşa hamle de anlamlı olabilir (kapağın açılmasını, motorun gelmesini
    // beklemek): küçük bir çevirme
    if (L.hasPulse || L.motors.length || L.fuses.length) {
      const t = snapStep(L, i, norm(angles[i] + (ring.step || 20 * DEG)));
      if (!out.some(o => angDist(o, t) < DEG)) out.push(t);
    }
    return out;
  }

  function stateKey(L, angles, mask, left, sw, ph) {
    let key = mask.toString(36) + (sw ? 's' : '') + (ph ? 'p' : '');
    for (let i = 0; i < L.rings.length; i++) {
      if (mask & (1 << i)) continue;
      key += ',' + (Math.round(angles[i] / DEG * 2) % 720);
      if (left[i] != null) key += 't' + left[i];
    }
    return key;
  }

  // Bir durumdan tek hamleyle varılan durumlar: şaltere dokunmak, tablayı çevirmek, bir halkayı çevirmek.
  // Durum: { L, angles, mask, left, sw, ph } (L tablalı bölümde tablanın o anki konumu). emit(durum, hamle)
  // true dönerse arama durur. Her hamle nabız kapaklarını çevirir ve serbest kalanlar hemen çıkar.
  function expand(node, emit) {
    const L = node.L, ph2 = node.ph ^ (L.hasPulse ? 1 : 0);
    if (L.hasSwitch) {
      const c = afterMove(L, node.angles, node.mask, node.left, ph2);
      if (emit({ L, angles: c.angles, mask: c.mask, left: c.left, sw: node.sw ^ 1, ph: ph2 }, { toggle: true, ring: -1 })) return true;
    }
    if (L.table) {
      const t = turnTable(L, node.angles);
      const c = afterMove(t.L, t.angles, node.mask, node.left, ph2);
      if (emit({ L: t.L, angles: c.angles, mask: c.mask, left: c.left, sw: node.sw, ph: ph2 }, { table: true, ring: -1 })) return true;
    }
    for (let i = 0; i < L.rings.length; i++) {
      if ((node.mask & (1 << i)) || !canRotate(L, i, node.mask, node.left, node.sw)) continue;
      const spent = spend(L, node.left, i);
      for (const target of candidates(L, node.angles, node.mask, i, ph2)) {
        const delta = L.rings[i].ratchet ? L.rings[i].ratchet * L.rings[i].step : signedDelta(node.angles[i], target);
        const c = afterMove(L, rotate(L, node.angles, i, delta), node.mask, spent, ph2);
        if (emit({ L, angles: c.angles, mask: c.mask, left: c.left, sw: node.sw, ph: ph2 }, { ring: i, target, delta })) return true;
      }
    }
    return false;
  }
  const keyOf = s => (s.L.variants ? s.L.vIdx + '@' : '') + stateKey(s.L, s.angles, s.mask, s.left, s.sw, s.ph);

  // Arama başlangıcı: verilmeyen jeton, şalter ve nabız başlangıçtaki haliyle; serbest olanlar çıkar
  function startState(L, angles, mask, left, sw, ph) {
    if (sw == null) sw = L.startSw;
    if (ph == null) ph = 0;
    const c = cascade(L, angles, mask, left, ph);
    return { L, angles: c.angles, mask: c.mask, left: c.left, sw, ph, first: null };
  }

  // En az hamleli çözüm (BFS). Bulamazsa ya da sınır aşılırsa null.
  // left: kalan jetonlar, sw: şalterin rengi, ph: nabız kapakları (verilmezse başlangıçtakiler).
  // İlk hamle şalterse first = { toggle: true, ring: -1 }, tablaysa { table: true, ring: -1 }.
  function solve(L, angles, mask, maxNodes, left, sw, ph) {
    maxNodes = maxNodes || 100000;
    const start = startState(L, angles, mask, left, sw, ph);
    if (start.mask === L.full) return { moves: 0, first: null };
    const seen = new Set([keyOf(start)]);
    let frontier = [start], expanded = 0;
    for (let depth = 1; frontier.length; depth++) {
      const next = [];
      let found = null;
      for (const node of frontier) {
        if (++expanded > maxNodes) return null;
        const stop = expand(node, (st, move) => {
          const first = node.first || move;
          if (st.mask === L.full) { found = { moves: depth, first }; return true; }
          const key = keyOf(st);
          if (seen.has(key)) return false;
          seen.add(key);
          next.push({ ...st, first });
          return false;
        });
        if (stop) return found;
      }
      frontier = next;
    }
    return null;
  }

  // Kapalı bağ sayısı: çözüme ne kadar uzak olduğumuzun kaba tahmini
  function closedLinks(L, angles, mask, ph) {
    let c = 0;
    for (const k of L.links) {
      if ((mask & (1 << k.a)) || (mask & (1 << k.b)) || hidden(L, k.a, mask) || hidden(L, k.b, mask)) continue;
      if (!linkOpen(L, k, angles, ph)) c++;
    }
    return c;
  }

  // Hızlı çözücü (ağırlıklı A*): her zaman en kısa yolu bulmaz ama milisaniyeler sürer.
  // Üretimde ön eleme ve denemelerin rehber eli için kullanılır.
  // weight: tahminin ağırlığı. 2 (varsayılan) en hızlısı; 0.8 neredeyse her zaman en kısa yolu bulur
  // ama daha çok düğüm açar (ipucu bunu kullanır: ilk 50 bölümde 49'u en kısa yol).
  function solveFast(L, angles, mask, maxNodes, weight, left, sw, ph) {
    maxNodes = maxNodes || 20000;
    const W = weight == null ? 2 : weight;
    const start = startState(L, angles, mask, left, sw, ph);
    if (start.mask === L.full) return { moves: 0, first: null };
    const heap = [];
    const push = node => {
      heap.push(node);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p].f <= heap[i].f) break;
        [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l].f < heap[m].f) m = l;
          if (r < heap.length && heap[r].f < heap[m].f) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top;
    };
    const seen = new Set([keyOf(start)]);
    push({ ...start, g: 0, f: 0 });
    let expanded = 0, found = null;
    while (heap.length) {
      const node = pop();
      if (++expanded > maxNodes) return null;
      const stop = expand(node, (st, move) => {
        const first = node.first || move;
        if (st.mask === L.full) { found = { moves: node.g + 1, first }; return true; }
        const key = keyOf(st);
        if (seen.has(key)) return false;
        seen.add(key);
        const g = node.g + 1;
        push({ ...st, g, f: g + W * closedLinks(st.L, st.angles, st.mask, st.ph), first });
        return false;
      });
      if (stop) return found;
    }
    return null;
  }

  const api = {
    TAU, DEG, GAP_HALF, COVER_HALF,
    norm, angDist, signedDelta,
    buildLevel, hidden, circleIntersections, gapCovers, pointOpen, linkOpen, isFree, cascade, afterMove, rotate, solve, solveFast, snapStep, canRotate, spend, candidates, stateKey, turnTable, expand, startState, iceLeft, pressureLeft, armorLeft,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingLogic = api;
})(this);
