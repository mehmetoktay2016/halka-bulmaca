# Google Play'de yayınlama rehberi

Hazır olanlar: Android projesi (`android/`), uygulama simgeleri, gizlilik politikası (`privacy.html`),
mağaza metinleri ve görselleri (`store/`), Expo test uygulaması (`expo_app/`).
Aşağıdakiler senin hesabınla ve senin elinle yapılması gereken adımlar.

- **Uygulama kimliği:** `com.mehmetoktay.halkabulmaca` (Play'e yüklendikten sonra değiştirilemez)
- **Sürüm:** `versionCode 8`, `versionName "2.5"` → `android/app/build.gradle` (her yüklemede versionCode 1 artmalı)
- **Hazır deneme paketi:** `dist/HalkaBulmaca-deneme-2.0.apk` (imzasız deneme; mağazaya imzalı .aab yüklenir, bkz. 3. adım)

---

## 0. Telefonda dene

### A) Expo Go ile (en hızlı)

1. Telefona Play Store'dan **Expo Go** uygulamasını kur.
2. Bilgisayar ve telefon **aynı Wi-Fi** ağında olsun.
3. Bilgisayarda:
   ```
   cd expo_app
   npx expo start
   ```
4. Ekrana çıkan QR kodu Expo Go ile okut. Oyun telefonda açılır.

Oyunda değişiklik yaptıktan sonra Expo sürümünü güncellemek için ana klasörde `node tools/build_single.js` çalıştır.

### B) Gerçek Android paketiyle (APK)

Deneme paketi: `android/app/build/outputs/apk/debug/app-debug.apk`.
Telefona kopyalayıp aç (bilinmeyen kaynaklara izin vermen istenir) ya da USB ile:
`adb install android/app/build/outputs/apk/debug/app-debug.apk`

---

## 1. ÖNEMLİ: Türkçe karakterli klasör yolu

Android derleme aracı (Gradle), proje yolunda Türkçe karakter olunca çalışmıyor
(`Masaüstü`, `Eğitimlerim`). İki çözüm:

- **Kalıcı çözüm (önerilen):** Projeyi Türkçe karakter olmayan bir yere taşı, ör. `C:\Projeler\halka-bulmaca`
  (GitHub'dan da indirebilirsin: `git clone https://github.com/mehmetoktay2016/halka-bulmaca`).
- **Geçici çözüm:** PowerShell'de klasöre sanal bir sürücü harfi ver ve Android Studio'da `H:\android` klasörünü aç:
  ```
  subst H: "C:\Users\MEHMET\OneDrive\Masaüstü\Eğitimlerim\Miuul Vibe Coding Kursu\1 hafta\trading_system\halka_oyun"
  ```
  (Bilgisayar yeniden başlayınca bu komutu tekrar çalıştırman gerekir.)

## 2. Oyun değişince Android projesini güncelle

```
npm run android:sync
```
Bu komut oyun dosyalarını `www/` klasörüne kopyalar ve Android projesine aktarır.

## 3. İmzalı paket (.aab) oluştur

1. Android Studio → **Open** → `android` klasörü (Türkçe karaktersiz yoldan).
2. **Build → Generate Signed App Bundle / APK…** → **Android App Bundle**.
3. **Create new…** ile bir *yükleme anahtarı (keystore)* oluştur:
   - Dosyayı proje klasörünün **dışına** kaydet (ör. `C:\Anahtarlar\halka-bulmaca.jks`).
   - Güçlü bir şifre seç.
   - ⚠️ **Bu dosyayı ve şifreyi mutlaka yedekle** (ör. şifre yöneticisi + harici disk).
     Kaybedersen uygulamayı güncellemek için Google'dan anahtar sıfırlama istemen gerekir.
   - Bu dosyayı asla GitHub'a yükleme.
4. **release** seç → **Create**. Çıktı: `android/app/release/app-release.aab`.

Her yeni sürümde `android/app/build.gradle` içindeki `versionCode`'u 1 artır (2, 3, …) ve `versionName`'i güncelle ("1.1" gibi).

## 4. Play Console hesabı

1. https://play.google.com/console → **Kişisel** hesap → 25 USD tek seferlik ücret.
2. Kimlik doğrulamasını tamamla (birkaç gün sürebilir).

## 5. Uygulamayı oluştur

**Uygulama oluştur** → Ad: `Halka Bulmaca` · Dil: Türkçe · Tür: **Oyun** · Ücretsiz.

## 6. "Uygulamanızı ayarlayın" formları

| Form | Cevap |
|---|---|
| Gizlilik politikası | `https://mehmetoktay2016.github.io/halka-bulmaca/privacy.html` (önce GitHub Pages'i aç) |
| Uygulama erişimi | Tüm işlevler kısıtlamasız kullanılabilir |
| Reklamlar | Hayır, reklam içermiyor |
| İçerik derecelendirmesi | Kategori: Oyun → şiddet, kumar, kullanıcı etkileşimi vb. hepsine **Hayır** |
| Hedef kitle | **13 yaş ve üzeri** (13 yaş altı seçilirse "Aileler" politikası ve ek inceleme devreye girer) |
| Haber uygulaması | Hayır |
| Veri güvenliği | **Veri toplanmıyor ve paylaşılmıyor** (ilerleme yalnızca cihazda) |
| Devlet uygulaması / finans / sağlık | Hayır |

## 7. Mağaza sayfası

Metinler ve görseller: `store/magaza-metinleri.md`.

## 8. Kapalı test (yeni kişisel hesaplarda zorunlu)

1. **Test → Kapalı test → Yeni kanal oluştur.**
2. `app-release.aab` dosyasını yükle, sürüm notu yaz ("İlk sürüm").
3. **Test kullanıcıları:** En az **12 kişinin** Gmail adresini ekle.
4. Paylaşılan katılım bağlantısını gönder; herkes kabul edip uygulamayı indirsin.
5. **12 kişi 14 gün boyunca** testte kalmalı (uygulamayı arada açmaları iyi olur).

## 9. Herkese açık yayın

14 gün dolunca Play Console'da **Üretime erişim başvurusu** düğmesi açılır. Kısa soruları cevapla
(test sırasında ne öğrendin, neyi düzelttin). Onay gelince **Üretim → Yeni sürüm** ile yayınla.
Google'ın incelemesi genellikle birkaç gün sürer.
