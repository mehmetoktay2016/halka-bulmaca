# Halka Bulmaca

Birbirine geçmiş halkaları döndür, boşlukları kesişimlere getir, hepsini serbest bırak.
Tarayıcıda çalışır; telefonda uygulama gibi açılır. Kurulum gerekmez.

## Oynamak

`index.html` dosyasını tarayıcıda aç. İlk açılışta 4 rehberli deneme bölümü oyunu öğretir.

- Halkayı parmakla / fareyle sürükleyerek döndür.
- Parlayan beyaz nokta: o kesişim açık, halka oradan geçebilir.
- Bir halkanın bütün kesişimleri açılınca halka uçup gider; hepsi gidince bölüm biter.
- Gri halka kilitli, dönmez. Noktalı çizgiyle bağlı halkalar birlikte döner.
- Düz çubuklar dönmez; içinden geçtiği halkalar kurtulunca kayıp gider.
- Yeni dünyaların kuralları: ters ve hızlı dişli (eşi ters yöne ya da iki kat döner), tıklı halka
  (yalnızca belli açılarda durur), kilit ve anahtar (anahtarlı halka kurtulunca açılır), çerçeve (hiç oynamaz).
- Hamle hakkı en iyi çözüme göre verilir (17. kapıya kadar en çok 10, sonra 14). Biterse altınla
  3 hamle daha alınabilir ya da bölüm baştan başlar. Geri al yok (2.0'da kaldırıldı).
- İpucu: ücretsiz dürtme, 1 ampulle ipucu ya da hamleyi yaptırma. Ampul kapı açılışı, altın kapı,
  altınla alma (20 altın) ve günlük hediyeyle kazanılır. 1. kapıda ipuçları ücretsiz.
- Skor: yıldız başına 100, altın başına 25 (her bölümün en iyi sonucu sayılır). 25 rozet ve şekil albümü var.
- Bölüm altınları yalnızca ilk bitirişte verilir (2.1); tekrar oynayarak altın toplanmaz.
- Halka ödülleri (2.1): bazı halkaların içinde sandık (sıradan, nadir, efsane), altın halka (bölümün
  altınları ×2) ya da ampul halkası var; halka kurtulunca açılır, her bölümde bir kez. Haritada köşede görünür.
- Çıkartmalar: her dünyanın 5 parçalı çıkartması; parça, haritada yapboz işaretli bölüm bitince verilir.
- Günlük sandık: her gün ilk açılışta 7 günlük şerit, büyüyen ödül; gün kaçırılırsa seri o kadar geri gider.
- Mağaza: altınla kurtulma efekti, kurtulma sesi ve zafer kutlaması alınır (halka renkleri değişmez).
- Ödül miktarları ve fiyatlar tek yerde: `rewards.js`. Ekonomi ölçümü: `npm run economy`.
- Zorluk (2.2): bölümün zorluk puanı en az hamle ile halkaların birbirine yakınlığından gelir. Her kapının başı
  ferah, sonu sıkışık; her kapının zirvesi ve ortalaması bir öncekinden yüksek (kapı 11 bilinen istisna).
  Haritada her durağın üstünde Kolay / Orta / Zor noktası.
- Övgü (2.2): tek hamlede 2, 3 ya da 4+ halka kurtulunca kademeli söz ve müzik motifi; en az hamleyle
  bitirince "Kusursuz!" (ipucusuz) ya da "Mükemmel!".
- Dil (2.3): Türkçe ve İngilizce. Oyun telefonun diline göre açılır (Türkçe değilse İngilizce), ayarlardan
  değişir. Metnin Türkçesi anahtardır: `tr('Türkçe metin')`, sözlük `i18n_en.js`. Yeni metin eklerken iki dili birlikte yaz.
- Yeni dünyalar (2.4): 100 bölüm daha, 4 dünya ve 5 yeni parça. Yaylı halka kurtulunca değdiği halkayı çeyrek
  tur iter; jetonlu halka jetonsuz dönmez, jetonu başka halka taşır; şalter iki renkten yalnız birini döndürür;
  nabız halkanın boşluk kapağı her hamlede açılıp kapanır; döner tabla üstündeki iki halkanın yerini değiştirir.
  Her parça ilk görüldüğünde animasyonlu bir kartla anlatılır, koleksiyonda Parçalar sekmesinde durur.
  Kapı 21-30'un zorluğu artmaz, kapı 20 düzeyinde kalır (`PLATEAU`).

300 bölüm 30 kapıya, kapılar 12 dünyaya ayrılır (Başlangıç Vadisi, Atölye, Saat Kulesi, Zindan, Şehir,
Fabrika, Uzay, Büyük Usta, Lunapark, Santral, Deniz Feneri, Rasathane). Her kapının 5. bölümü bir ara şekil,
10. bölümü bir şekil finalidir; her dünya kendi mekaniğinin tanıtımıyla açılır. 200. bölüm bitince Büyük
Makine sahnesi gelir ve yeni dünyalar açılır; 300. bölüm bitince Yıldız Haritası finali gelir.

Geliştirme adresleri: `?level=N` (N. bölüm), `?src=N` (kaynak numarasıyla önizleme, kayda yazmaz),
`?world=atolye`, `?gallery` (bütün şekiller), `?ending` (Büyük Makine), `?ending=finale` (Yıldız Haritası), `?debug`.

## GitHub Pages ile yayınlama

1. Depoda **Settings → Pages** bölümüne gir.
2. **Source**: "Deploy from a branch", **Branch**: `main`, klasör: `/ (root)` seç, **Save**.
3. Birkaç dakika sonra oyun `https://<kullanıcı-adı>.github.io/halka-bulmaca/` adresinde yayında olur.

Telefonda bu adresi açıp "Ana ekrana ekle" dersen oyun kendi simgesiyle, tam ekran açılır.

## Android (Google Play) ve Expo

- **Android uygulaması:** Capacitor ile `android/` klasöründe. Oyun değişince `npm run android:sync`.
- **Expo Go ile test:** `cd expo_app && npx expo start`, QR kodu telefondaki Expo Go ile okut.
  Oyun değişince ana klasörde `node tools/build_single.js`.
- **Yayın adımları:** [PLAY_STORE.md](PLAY_STORE.md). Mağaza metinleri ve görselleri: `store/`.
- Gizlilik politikası: `privacy.html`.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html`, `style.css` | Sayfa ve tasarım |
| `logic.js` | Kurallar: kesişimler, serbest kalma, çözücüler |
| `levels.js` | El yapımı bölümler, mekanik tanıtımları (1001-1010), deneme bölümleri, 59 şekil ve şekil planı, bölüm üreticileri, kapı sırası |
| `levels_data.js` | Önceden üretilmiş bölümler (elle düzenlenmez) |
| `worlds.js` | Yolculuk: dünyalar, kapılar, unvanlar, dünya temaları |
| `save.js` | Oyuncu kaydı: yükleme, eski sürümden taşıma, kilit sınırı |
| `i18n.js`, `i18n_en.js` | Dil desteği: `tr()` çevirisi, dil seçimi; İngilizce sözlük (tekil/çoğul) |
| `achievements.js` | 28 rozet: kurallar ve ödüller |
| `rewards.js` | Ödül ekonomisi: fiyatlar, sandık/altın halka/ampul halkası yerleri ve içerikleri, çıkartma parçaları, günlük sandık, mağaza ürünleri |
| `loot_data.js` | Her bölümde ödül taşıyabilecek halkalar ve konumları (`tools/build_loot.js` üretir, elle düzenlenmez) |
| `stickers.js` | 12 dünyanın çıkartma çizimleri ve parça işareti |
| `pieces.js` | 10 parçanın kullanma kartları: adı, anlatımı ve animasyonlu çizimi |
| `deco.js` | Şekil süsleri: hayvan yüzleri, ayarlanabilir yüz, eşyalar (tekerlek, saat, dişli...) |
| `scenery.js` | Dünyaların tahta dokuları ve arka plan parçacıkları |
| `ambience.js` | Dünyaların ortam sesleri (WebAudio ile üretilir) |
| `game.js` | Ekranlar, çizim, dokunma, ses, efektler, ipucu ve ampul, rozetler, kapanış sahnesi |
| `manifest.webmanifest`, `icon-*.png` | Telefonda uygulama gibi açılma |
| `tools/check_levels.js` | `npm run check` içinde: bütün bölümleri, kapıların zorluk sırasını ve tanıtımları doğrular |
| `tools/check_shapes.js` | `npm run check` içinde: şekillerin geometrisini ve süslerini doğrular |
| `tools/check_themes.js` | `npm run check` içinde: her dünyanın zemininde halkaların okunaklı olduğunu (kontrast) doğrular |
| `tools/test_save.js`, `test_badges.js`, `test_logic.js`, `test_loot.js`, `test_i18n.js` | `npm test`: kayıt, rozet, kural (dişli, tık, kilit, çerçeve), ödül (yerler, sandık, çıkartma, seri, mağaza) ve dil (eksik çeviri, değişkenler, dil seçimi) testleri |
| `tools/build_loot.js` | Bölümler değişince ödül yerlerini yeniden hesaplar (`loot_data.js`) |
| `tools/browser_levels.js` | Bölümleri tarayıcıdakiyle aynı (ortalanmış) yükler; ekrandaki konuma bakan araçlar bunu kullanır |
| `tools/economy.js` | `npm run economy`: kapı kapı altın ve ampul kazancı, mağaza toplamı |
| `tools/balance.js` | Denge testi: 200 bölümü yalnızca ipucuyla oynar, ipucu hızını ve ekonomiyi ölçer |
| `tools/build_levels.js` | `node tools/build_levels.js 90 195` → bölümleri yeniden üretir |
| `tools/build_range.js` | Zor tek bir bölümü aday aralığında üretir (paralel arama için) |
| `tools/build_parallel.js` | `node tools/build_parallel.js 2 21 30` → kapıları birkaç süreçte üretir; her bölümü bitince `tools/out`'a yazar, durursa kaldığı yerden devam eder |
| `tools/store_shots.js` | Mağaza ekran görüntülerini ve öne çıkan görseli üretir |
| `tools/autoplay.js` | Tarayıcıda otomatik oynatma testi (`index.html?level=5&debug&autoplay`) |

Tasarım kararları ve rakip oyun analizi: `TASARIM.md`.
