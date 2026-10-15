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

200 bölüm 20 kapıya, kapılar 8 dünyaya ayrılır (Başlangıç Vadisi, Atölye, Saat Kulesi, Zindan, Şehir,
Fabrika, Uzay, Büyük Usta). Her kapının 5. bölümü bir ara şekil, 10. bölümü bir şekil finalidir; her
dünya kendi mekaniğinin tanıtımıyla açılır. 200. bölüm bitince Büyük Makine kapanış sahnesi gelir.

Geliştirme adresleri: `?level=N` (N. bölüm), `?src=N` (kaynak numarasıyla önizleme, kayda yazmaz),
`?world=atolye`, `?gallery` (bütün şekiller), `?ending` (kapanış sahnesi), `?debug`.

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
| `levels.js` | El yapımı bölümler, mekanik tanıtımları (1001-1005), deneme bölümleri, 39 şekil ve şekil planı, bölüm üreticileri, kapı sırası |
| `levels_data.js` | Önceden üretilmiş bölümler (elle düzenlenmez) |
| `worlds.js` | Yolculuk: dünyalar, kapılar, unvanlar, dünya temaları |
| `save.js` | Oyuncu kaydı: yükleme, eski sürümden taşıma, kilit sınırı |
| `achievements.js` | 25 rozet: kurallar ve ödüller |
| `deco.js` | Şekil süsleri: hayvan yüzleri, ayarlanabilir yüz, eşyalar (tekerlek, saat, dişli...) |
| `scenery.js` | Dünyaların tahta dokuları ve arka plan parçacıkları |
| `ambience.js` | Dünyaların ortam sesleri (WebAudio ile üretilir) |
| `game.js` | Ekranlar, çizim, dokunma, ses, efektler, ipucu ve ampul, rozetler, kapanış sahnesi |
| `manifest.webmanifest`, `icon-*.png` | Telefonda uygulama gibi açılma |
| `tools/check_levels.js` | `npm run check` içinde: bütün bölümleri, kapıların zorluk sırasını ve tanıtımları doğrular |
| `tools/check_shapes.js` | `npm run check` içinde: şekillerin geometrisini ve süslerini doğrular |
| `tools/check_themes.js` | `npm run check` içinde: her dünyanın zemininde halkaların okunaklı olduğunu (kontrast) doğrular |
| `tools/test_save.js`, `test_badges.js`, `test_logic.js` | `npm test`: kayıt, rozet ve kural (dişli, tık, kilit, çerçeve) testleri |
| `tools/balance.js` | Denge testi: 200 bölümü yalnızca ipucuyla oynar, ipucu hızını ve ekonomiyi ölçer |
| `tools/build_levels.js` | `node tools/build_levels.js 90 195` → bölümleri yeniden üretir |
| `tools/build_range.js` | Zor tek bir bölümü aday aralığında üretir (paralel arama için) |
| `tools/store_shots.js` | Mağaza ekran görüntülerini ve öne çıkan görseli üretir |
| `tools/autoplay.js` | Tarayıcıda otomatik oynatma testi (`index.html?level=5&debug&autoplay`) |

Tasarım kararları ve rakip oyun analizi: `TASARIM.md`.
