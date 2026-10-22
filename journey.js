// Halka'nın Yolculuğu: senaryo, her dünyanın sahnesi, her kapının yapısı ve 400 durağın adı.
// Harita (adventure.js) bu dosyadan çizer. Kapının 5. ve 10. durağı şekil bölümüdür (kurtarılan dost):
// orada ad şeklin kendi adıdır, burada yalnız yolculuk biçimi yazılır.
// Durak: [ad, istasyon çizimi, yolculuk]. Yolculuk: o duraktan bir sonrakine Halka'yı ne taşır.
// Yolculuklar: fener, balon, roket, top, ziplama, kus, tekerlek, kayma, paten, kizak, kartopu, isinlanma,
//   tekne, vagon, teleferik, ucurtma, sarkac (son beşi yeni)
(function (root) {
  'use strict';

  const STORY = {
    title: 'Halka\'nın Yolculuğu',
    intro: 'Bir gece Büyük Makine tekledi ve dünyanın bütün halkaları birbirine dolandı. Hayvanlar, oyuncaklar, ' +
      'gemiler, yıldızlar düğümlerin içinde kaldı. Vadideki çimenlerin arasında tek bir halka kendi boşluğunu ' +
      'hizalayıp kurtuldu: Halka. Şimdi her dünyadaki düğümleri çözmek, dostlarını özgür bırakmak ve Büyük ' +
      'Makine\'yi yeniden çalıştırmak için yola çıkıyor.',
    acts: [
      { from: 1, to: 200, name: 'Birinci Perde: Büyük Makine', text: 'Vadiden Büyük Usta\'nın salonuna kadar sekiz dünya. ' +
        'Halka döndürmeyi, hizalamayı, kilitleri ve dişlileri öğrenir; sonunda Büyük Makine\'yi onarır.' },
      { from: 201, to: 300, name: 'İkinci Perde: Dağılan Kıvılcımlar', text: 'Makine çalışınca içinden dört kıvılcım fırlar ' +
        've uzak diyarlara düşer. Halka kıvılcımları lunaparkta, santralde, deniz fenerinde ve rasathanede bulur; ' +
        'yıldızların haritasını çıkarır.' },
      { from: 301, to: 400, name: 'Üçüncü Perde: Anka\'nın Ateşi', text: 'Yıldız haritası son bir düğümü gösterir: ' +
        'Büyü Kulesi\'nde uyuyan Anka Kuşu. Halka fişeklerle göğü aydınlatır, buzulu aşar, değirmenleri döndürür ' +
        've Anka\'yı özgür bırakır. Anka\'nın ateşi bütün dünyalara ışık taşır ve haritada o güne dek görünmeyen ' +
        'yeni yolları aydınlatır. Yolculuk sürüyor.' },
    ],
  };

  // Her dünyanın hikâyedeki yeri ve haritadaki sahnesi
  const WORLDS = {
    vadi: { story: 'Halka\'nın uyandığı yeşil vadi. Dere kenarında düğümlenmiş ilk dostlar onu bekliyor.',
      scene: 'Çayırlar, çiçek tarlaları, kıvrılan bir dere, taş köprüler, söğütler ve ateş böcekleri; yol toprak ve çakıl.' },
    atolye: { story: 'Vadinin sonunda eski bir marangoz atölyesi. Tezgâhtaki çarklar ters dönüp her şeyi kilitlemiş.',
      scene: 'Ahşap döşeme, talaş yığınları, mengeneler, alet panoları, tavandan sarkan lambalar; yol tahta kalaslardan.' },
    saat: { story: 'Atölyenin arkasındaki kule. Saatin her tıkı bir halkayı biraz daha sıkıştırıyor.',
      scene: 'Pirinç dişliler, sarkaçlar, kadranlar, dönen yelkovanlar, kulenin iç merdivenleri; yol pirinç levhalardan.' },
    zindan: { story: 'Kulenin altında karanlık bir zindan. Anahtarlar halkaların içine hapsedilmiş.',
      scene: 'Taş duvarlar, meşaleler, zincirler, demir parmaklıklar, örümcek ağları ve mantarlar; yol kaba taş.' },
    sehir: { story: 'Zindandan çıkan yol ışıklı bir şehre varır. Çerçeveler sokakları kapatmış, insanlar evlerinde kalmış.',
      scene: 'Kaldırımlar, sokak lambaları, vitrinler, çatı katları, meydan çeşmesi, tramvay rayları; yol parke taşı.' },
    fabrika: { story: 'Şehrin kenarındaki fabrika durmuş. Hızlı dişliler kendi kendini kilitlemiş.',
      scene: 'Bacalar, buhar, kayış taşıyıcılar, borular, manometreler, kıvılcım saçan kaynak masaları; yol çelik ızgara.' },
    uzay: { story: 'Fabrikanın roketiyle yörüngeye çıkış. Gezegenler düğümlenmiş, yıldızlar yerinden kaymış.',
      scene: 'Yıldız tozu, gezegen halkaları, uydular, göktaşları, uzay istasyonu modülleri; yol yüzen platformlar.' },
    usta: { story: 'Yolculuğun ilk sonu: Büyük Usta\'nın salonu ve kalbinde Büyük Makine.',
      scene: 'Mermer sütunlar, altın kakmalar, ustaların heykelleri, devasa çark duvarları; yol altın döşeme.' },
    lunapark: { story: 'İlk kıvılcım bir lunaparka düşmüş. Oyuncaklar ve yaylar çılgınca zıplıyor.',
      scene: 'Renkli çadırlar, atlıkarınca, hız treni rayları, pamuk şeker tezgâhları, ışık zincirleri; yol renkli karolar.' },
    santral: { story: 'İkinci kıvılcım santrali çarpmış. Şalterler karışmış, bir yan dururken öbürü dönüyor.',
      scene: 'Trafolar, yüksek gerilim direkleri, baraj gölü, türbinler, parlayan kablolar; yol beton ve sarı çizgi.' },
    fener: { story: 'Üçüncü kıvılcım deniz fenerinin camına sıkışmış. Işık yanıp söndükçe boşluklar açılıp kapanıyor.',
      scene: 'Kayalık sahil, dalgalar, iskeleler, balıkçı tekneleri, martılar, fener kulesi; yol tahta iskele.' },
    rasathane: { story: 'Dördüncü kıvılcım rasathanede. Döner tablalar gökyüzünü yanlış yöne çeviriyor.',
      scene: 'Gece göğü, teleskoplar, gök küreleri, kubbeler, takımyıldız çizgileri; yol ay taşı.' },
    fisek: { story: 'Yıldız haritası bir şenliği gösteriyor. Fişekler düğümlenmiş; göğü aydınlatmak için hepsi patlamalı.',
      scene: 'Taş döşeli festival meydanı, çizgili çadırlar, fenerler, tezgâhlar, balonlar ve meşaleli kale.' },
    buzul: { story: 'Şenliğin ışığı kuzeyi gösteriyor. Buzul\'da halkalar donmuş; komşuları kurtuldukça buz çatlıyor.',
      scene: 'Karlı tepeler, çam ağaçları, buz blokları, donmuş göller, kutup ışıkları.' },
    degirmen: { story: 'Buzun eridiği yerde dereler değirmenlere akar. Motorlu çarklar kendi kendine dönüp duruyor.',
      scene: 'Sulak çayırlar, su arkları, yel değirmenleri, ambarlar, buğday ve ayçiçeği tarlaları.' },
    buyu: { story: 'Son durak: Büyü Kulesi. Anka Kuşu ikiz portalların arasında uyuyor.',
      scene: 'Mor sis, yüzen kitaplar, aynalar, kristaller, rün taşları ve portallar.' },
  };

  // Kapının yapısı (haritada kapının kendisi) ve hikâyedeki anı
  const GATES = {
    1: { gate: 'Çiçekli kemer', story: 'Halka çimenlerin arasında uyanır ve ilk adımlarını atar.' },
    2: { gate: 'Dere üstünde taş köprü', story: 'Dere kıvrılır; Halka da kıvrılmayı öğrenir.' },
    3: { gate: 'Sarmaşıklı bahçe kapısı', story: 'Yollar kesişir, dostlar çoğalır.' },
    4: { gate: 'Kökleri düğümlü yaşlı ağaç', story: 'Ağacın kökleri bile düğümlenmiş; ilk zor çözüm.' },
    5: { gate: 'Zincirli bostan kapısı', story: 'Zincirleri tek hamlede açmanın tadı.' },
    6: { gate: 'Vadinin taş kemeri', story: 'Vadiden çıkış; Aslan, Halka\'nın cesaretine selam verir.' },
    7: { gate: 'Atölyenin çift kanatlı ahşap kapısı', story: 'Tezgâhtaki çarklar ters döner.' },
    8: { gate: 'Dev çark kapı', story: 'Çarkı çevirmeden kapı açılmaz.' },
    9: { gate: 'Sarkaçlı kule kapısı', story: 'Sarkaç gidip gelir, zamanı yakala.' },
    10: { gate: 'Zemberek kafesi', story: 'Kulenin kalbi: gerilmiş zemberek.' },
    11: { gate: 'Demir parmaklıklı hücre kapısı', story: 'Anahtar halkanın içinde.' },
    12: { gate: 'Mahzenin kemerli taş kapısı', story: 'Ejderhanın uyuduğu mahzenden çıkış.' },
    13: { gate: 'Sokak başındaki kemer', story: 'Şehir ışıkları yanar.' },
    14: { gate: 'Meydanın saat kulesi kapısı', story: 'Meydana çıkan herkes Halka\'yı alkışlar.' },
    15: { gate: 'Fabrika bariyeri', story: 'Montaj hattı yeniden çalışır.' },
    16: { gate: 'Buhar kazanı kapağı', story: 'Basınç düşer, kazan rahatlar.' },
    17: { gate: 'Roket rampası kulesi', story: 'Yörüngeye fırlatılış.' },
    18: { gate: 'Uzay istasyonu hava kilidi', story: 'Takımyıldızlar yerine oturur.' },
    19: { gate: 'Ustalar salonunun sütunlu kapısı', story: 'Ustalar Halka\'yı sınar.' },
    20: { gate: 'Büyük Makine\'nin çark kapısı', story: 'Büyük Makine yeniden döner; dört kıvılcım fırlar.' },
    21: { gate: 'Lunapark bilet gişesi', story: 'İlk kıvılcımın izi lunaparkta.' },
    22: { gate: 'Çarpışan arabalar pisti girişi', story: 'Yaylı halkalar birbirini iter.' },
    23: { gate: 'Hız treni tüneli', story: 'Kıvılcım hız treninin sonunda bulunur.' },
    24: { gate: 'Trafo istasyonu çiti', story: 'Şalterler kıvılcımla karışmış.' },
    25: { gate: 'Baraj kapağı', story: 'Su akar, türbin döner, ikinci kıvılcım bulunur.' },
    26: { gate: 'Liman feneri kapısı', story: 'Limanda ışık yanıp söner.' },
    27: { gate: 'Kayalıklarda deniz mağarası', story: 'Dalgaların arasından geçiş.' },
    28: { gate: 'Fener kulesinin demir kapısı', story: 'Üçüncü kıvılcım fenerin camında.' },
    29: { gate: 'Ay ışığında rasathane kubbesi', story: 'Teleskop yanlış yöne bakıyor.' },
    30: { gate: 'Gözlemevinin yıldız kapısı', story: 'Yıldız haritası tamamlanır, son düğümü gösterir.' },
    31: { gate: 'Barut deposunun kalesi', story: 'Şenlik hazırlığı: düğümlü fişekler.' },
    32: { gate: 'Fitil kalesi', story: 'Fitiller yanar, kale kapısı açılır.' },
    33: { gate: 'Şölen kalesi', story: 'Gökyüzü şöleni; ışık kuzeyi gösterir.' },
    34: { gate: 'Kar tepesinde buz kemeri', story: 'Donmuş halkalar, çatlayan buz.' },
    35: { gate: 'Buz mağarasının ağzı', story: 'Mağaranın dibinde Kızak bekliyor.' },
    36: { gate: 'Su arkının bent kapağı', story: 'Su arkları açılır, çarklar döner.' },
    37: { gate: 'Yel değirmeninin kapısı', story: 'Rüzgâr kendi kendine döner.' },
    38: { gate: 'Çark evinin ambar kapısı', story: 'Hasat zamanı; Ayçiçeği güneşe döner.' },
    39: { gate: 'Ayna salonunun kristal kapısı', story: 'İkiz portallar yan yana.' },
    40: { gate: 'Anka\'nın portalı', story: 'Son düğüm çözülür; Anka Kuşu kanatlanır.' },
  };

  // Durak: [ad, çizim, yolculuk]; 5. ve 10. durak şekil bölümü: [null, 'sekil', yolculuk]
  const S = (name, art, travel) => [name, art, travel];
  const F = travel => [null, 'sekil', travel]; // kurtarılan dost, Halka'yı bir sonrakine o taşır
  const STOPS = {
    // ---- Başlangıç Vadisi ----
    1: [S('Uyanış Çayırı', 'cimen', 'ziplama'), S('Çiy Çeşmesi', 'cesme', 'kayma'), S('Papatya Tarlası', 'papatya', 'ucurtma'),
      S('Kelebek Bahçesi', 'kelebek', 'kus'), S('Söğüt Gölgesi', 'sogut', 'sarkac'), S('Bal Kovanı', 'kovan', 'ziplama'),
      S('Kuş Yuvası', 'yuva', 'kus'), S('Dere Kıyısı', 'dere', 'tekne'), S('Taş Basamaklar', 'basamak', 'ziplama'), F('ziplama')],
    2: [S('Kıvrık Patika', 'patika', 'tekerlek'), S('Sazlık', 'saz', 'kayma'), S('Nilüfer Gölü', 'nilufer', 'tekne'),
      S('Kurbağa Taşı', 'tas', 'ziplama'), F('ziplama'), S('Çilek Bayırı', 'cilek', 'tekerlek'), S('Mantar Halkası', 'mantar', 'ziplama'),
      S('Rüzgârgülü', 'ruzgargulu', 'ucurtma'), S('Ahşap İskele', 'iskele', 'tekne'), F('ziplama')],
    3: [S('Dört Yol Ağzı', 'tabela', 'tekerlek'), S('Elma Bahçesi', 'elma', 'ziplama'), S('Kuyu Başı', 'kuyu', 'sarkac'),
      S('Çit Kapısı', 'cit', 'ziplama'), F('tekerlek'), S('Saman Balyası', 'saman', 'kayma'), S('Arı Çiçekliği', 'cicek', 'kus'),
      S('Kır Feneri', 'kirfeneri', 'fener'), S('Gece Ormanı', 'orman', 'kus'), F('kus')],
    4: [S('Yaşlı Meşe', 'mese', 'sarkac'), S('Bambu Korusu', 'bambu', 'ziplama'), S('Sincap Yuvası', 'sincap', 'ziplama'),
      S('Kök Mağarası', 'kokmagara', 'vagon'), F('ziplama'), S('Yosunlu Kaya', 'yosun', 'kayma'), S('Örümcek Ağı', 'ag', 'teleferik'),
      S('Yaprak Salıncağı', 'salincak', 'sarkac'), S('Tırtıl Yolu', 'yaprak', 'kayma'), F('kayma')],
    5: [S('Zincirli Bostan', 'bostan', 'tekerlek'), S('Kavak Sırası', 'kavak', 'ucurtma'), S('Göl Kenarı', 'gol', 'tekne'),
      S('Nilüfer Sahnesi', 'nilufer', 'ziplama'), F('ziplama'), S('Taş Değirmen', 'tasdegirmen', 'tekerlek'), S('Buz Gibi Pınar', 'pinar', 'kayma'),
      S('Kuzey Tepesi', 'tepe', 'kizak'), S('Karlı Yamaç', 'kar', 'kizak'), F('kayma')],
    6: [S('Kaplumbağa Kumsalı', 'kumsal', 'tekne'), S('Sallanan Köprü', 'kopru', 'teleferik'), S('Şelale', 'selale', 'kayma'),
      S('Kayalık Geçit', 'gecit', 'ziplama'), F('tekne'), S('Savana Kapısı', 'savana', 'ziplama'), S('Akasya Ağacı', 'akasya', 'kus'),
      S('Su Birikintisi', 'birikinti', 'ziplama'), S('Aslan Kayası', 'aslankayasi', 'ziplama'), F('ziplama')],
    // ---- Atölye ----
    7: [S('Tezgâh Başı', 'tezgah', 'tekerlek'), S('Mengene', 'mengene', 'ziplama'), S('Talaş Yığını', 'talas', 'kayma'),
      S('Alet Panosu', 'pano', 'teleferik'), F('tekerlek'), S('Rende Masası', 'rende', 'kayma'), S('Tutkal Kazanı', 'tutkal', 'ziplama'),
      S('Çivi Kutusu', 'civi', 'ziplama'), S('Bisiklet Askısı', 'aski', 'tekerlek'), F('tekerlek')],
    8: [S('Ters Dişli', 'disli', 'tekerlek'), S('Kayış Kasnağı', 'kasnak', 'teleferik'), S('Torna Tezgâhı', 'torna', 'tekerlek'),
      S('Kirpi Fırçası', 'firca', 'ziplama'), F('tekerlek'), S('Boya Kovaları', 'boya', 'kayma'), S('Testere Köşesi', 'testere', 'tekerlek'),
      S('Kamyon Rampası', 'rampa', 'vagon'), S('Yükleme Kapısı', 'yukleme', 'vagon'), F('vagon')],
    // ---- Saat Kulesi ----
    9: [S('Pirinç Merdiven', 'merdiven', 'ziplama'), S('Kum Saati', 'kumsaati', 'kayma'), S('Sarkaç Salonu', 'sarkac', 'sarkac'),
      S('Kadran Penceresi', 'kadran', 'sarkac'), F('ziplama'), S('Çan Odası', 'can', 'sarkac'), S('Guguk Yuvası', 'guguk', 'kus'),
      S('Yelkovan Köprüsü', 'yelkovan', 'teleferik'), S('Tik Tak Rafı', 'raf', 'ziplama'), F('kus')],
    10: [S('Zemberek', 'zemberek', 'ziplama'), S('Dişli Duvarı', 'disliduvar', 'tekerlek'), S('Mekanik Kuş', 'mekanikkus', 'kus'),
      S('Salyangoz Rayı', 'ray', 'kayma'), F('kayma'), S('Saat Çarkı', 'cark', 'tekerlek'), S('Kurma Anahtarı', 'kurma', 'sarkac'),
      S('Kule İstasyonu', 'istasyon', 'vagon'), S('Buharlı Peron', 'peron', 'vagon'), F('vagon')],
    // ---- Zindan ----
    11: [S('Hücre Kapısı', 'hucre', 'ziplama'), S('Meşale Duvarı', 'mesale', 'fener'), S('Zincir Asansörü', 'zincir', 'teleferik'),
      S('Yarasa Mağarası', 'magara', 'kus'), F('kus'), S('Mantar Mahzeni', 'mantar', 'ziplama'), S('Gizli Geçit', 'gizli', 'isinlanma'),
      S('Maden Rayı', 'madenrayi', 'vagon'), S('Ejderha Yuvası', 'ejderhayuvasi', 'fener'), F('kus')],
    12: [S('Mahzen Fıçıları', 'fici', 'tekerlek'), S('Anahtar Halkası', 'anahtar', 'ziplama'), S('Örümcek Köprüsü', 'ag', 'teleferik'),
      S('Kuyu Dibi', 'kuyu', 'sarkac'), F('teleferik'), S('Su Kanalı', 'dere', 'tekne'), S('Paslı Kafes', 'kafes', 'ziplama'),
      S('Hazine Odası', 'hazine', 'vagon'), S('Altın Kapı', 'altinkapi', 'fener'), F('ziplama')],
    // ---- Şehir ----
    13: [S('Fırın Köşesi', 'firin', 'tekerlek'), S('Çiçekçi', 'cicekci', 'ucurtma'), S('Tramvay Durağı', 'tramvay', 'vagon'),
      S('Kitapçı', 'kitapci', 'ziplama'), F('ziplama'), S('Park Bankı', 'bank', 'tekerlek'), S('Postane', 'postane', 'kus'),
      S('Çatı Katı', 'cati', 'ucurtma'), S('Bacalı Ev', 'baca', 'balon'), F('tekerlek')],
    14: [S('Meydan Çeşmesi', 'cesme', 'kayma'), S('Güvercin Kulesi', 'guvercin', 'kus'), S('Pazar Tezgâhları', 'pazar', 'tekerlek'),
      S('Vitrin Sokağı', 'vitrin', 'kayma'), F('kus'), S('Sinema', 'sinema', 'isinlanma'), S('Benzin İstasyonu', 'benzin', 'tekerlek'),
      S('Garaj', 'garaj', 'tekerlek'), S('Otoyol Köprüsü', 'otoyol', 'tekerlek'), F('tekerlek')],
    // ---- Fabrika ----
    15: [S('Kayışlı Taşıyıcı', 'tasiyici', 'vagon'), S('Kaynak Masası', 'kaynak', 'roket'), S('Vinç', 'vinc', 'teleferik'),
      S('Arı Kovanı Robotu', 'robotkovan', 'kus'), F('kus'), S('Pres Makinesi', 'pres', 'ziplama'), S('Cıvata Deposu', 'civata', 'tekerlek'),
      S('Kontrol Odası', 'kontrol', 'isinlanma'), S('Robot Kolu', 'robotkol', 'top'), F('roket')],
    16: [S('Buhar Kazanı', 'kazan', 'roket'), S('Manometre', 'manometre', 'ziplama'), S('Boru Labirenti', 'boru', 'kayma'),
      S('Su Deposu', 'depo', 'tekne'), F('tekne'), S('Baca', 'bacafabrika', 'balon'), S('Kömür Vagonu', 'komur', 'vagon'),
      S('Tersane', 'tersane', 'tekne'), S('Rıhtım', 'rihtim', 'tekne'), F('tekne')],
    // ---- Uzay ----
    17: [S('Fırlatma Kulesi', 'firlatma', 'roket'), S('Uydu', 'uydu', 'isinlanma'), S('Göktaşı', 'goktasi', 'ziplama'),
      S('Ay Üssü', 'ayussu', 'roket'), F('isinlanma'), S('Kuyruklu Yıldız', 'kuyruklu', 'kayma'), S('Uzay Bahçesi', 'uzaybahce', 'balon'),
      S('Yerçekimsiz Oda', 'yercekimsiz', 'balon'), S('Roket Hangarı', 'hangar', 'roket'), F('roket')],
    18: [S('Halkalı Gezegen', 'satürn', 'tekerlek'), S('Kara Delik Kenarı', 'karadelik', 'isinlanma'), S('Yıldız Tozu', 'toz', 'kayma'),
      S('Mürekkep Bulutu', 'bulutsu', 'tekne'), F('tekne'), S('Uzay İstasyonu', 'istasyonuzay', 'isinlanma'), S('Teleskop Uydusu', 'hubble', 'roket'),
      S('Kızıl Gezegen', 'mars', 'ziplama'), S('Mavi Gezegen', 'dunya', 'roket'), F('tekerlek')],
    // ---- Büyük Usta ----
    19: [S('Ustalar Kapısı', 'sutun', 'ziplama'), S('Heykeller Salonu', 'heykel', 'sarkac'), S('Kütüphane', 'kutuphane', 'isinlanma'),
      S('Ayna Koridoru', 'ayna', 'isinlanma'), F('ziplama'), S('Altın Çeşme', 'cesme', 'kayma'), S('Çark Galerisi', 'disliduvar', 'tekerlek'),
      S('Fil Merdiveni', 'merdiven', 'ziplama'), S('Usta Tahtı', 'taht', 'fener'), F('ziplama')],
    20: [S('Ana Dişli', 'cark', 'tekerlek'), S('Kayış Galerisi', 'kasnak', 'teleferik'), S('Kıvılcım Odası', 'kivilcim', 'roket'),
      S('Zürafa Asansörü', 'asansor', 'teleferik'), F('teleferik'), S('Basınç Odası', 'manometre', 'top'), S('Altın Sarkaç', 'sarkac', 'sarkac'),
      S('Kumanda Kolu', 'kol', 'ziplama'), S('Makinenin Kalbi', 'kalp', 'fener'), F('roket')],
    // ---- Lunapark ----
    21: [S('Bilet Gişesi', 'gise', 'ziplama'), S('Pamuk Şeker', 'pamuk', 'balon'), S('Balon Patlatma', 'balloonStand', 'top'),
      S('Ayna Labirenti', 'ayna', 'isinlanma'), F('tekerlek'), S('Muz Tezgâhı', 'muz', 'ziplama'), S('Trambolin', 'trambolin', 'ziplama'),
      S('Cambaz İpi', 'ip', 'teleferik'), S('Palyaço Arabası', 'palyaco', 'tekerlek'), F('ziplama')],
    22: [S('Çarpışan Arabalar', 'carpisan', 'tekerlek'), S('Halka Atma', 'halkaatma', 'top'), S('Su Kaydırağı', 'kaydirak', 'kayma'),
      S('Fok Gösterisi', 'seal', 'ziplama'), F('ziplama'), S('Sihirbaz Çadırı', 'sparkTent', 'isinlanma'), S('Dev Salıncak', 'carouselSt', 'sarkac'),
      S('Müzik Kutusu', 'muzikkutusu', 'tekerlek'), S('Fener Alayı', 'lanternStall', 'fener'), F('tekerlek')],
    23: [S('Hız Treni Rampası', 'hiztreni', 'vagon'), S('Korku Tüneli', 'korku', 'vagon'), S('Dönen Fincanlar', 'fincan', 'tekerlek'),
      S('Flamingo Gölü', 'gol', 'tekne'), F('kus'), S('Serbest Düşüş', 'serbest', 'roket'), S('Kanguru Zıplatma', 'trambolin', 'ziplama'),
      S('Havai Fişek Kulesi', 'firlatma', 'roket'), S('Lunapark Çıkışı', 'gise', 'balon'), F('ziplama')],
    // ---- Santral ----
    24: [S('Şalter Panosu', 'salter', 'isinlanma'), S('Trafo', 'trafo', 'isinlanma'), S('Kablo Makarası', 'makara', 'tekerlek'),
      S('Ateş Böceği Çayırı', 'cimen', 'fener'), F('fener'), S('Gerilim Direği', 'direk', 'teleferik'), S('Akü Deposu', 'aku', 'ziplama'),
      S('Kumanda Masası', 'kontrol', 'isinlanma'), S('Lamba Fabrikası', 'lamba', 'fener'), F('isinlanma')],
    25: [S('Baraj Gölü', 'gol', 'tekne'), S('Türbin', 'turbin', 'tekerlek'), S('Taşkın Kanalı', 'selale', 'kayma'),
      S('Su Altı Kablosu', 'sualti', 'tekne'), F('kayma'), S('Rüzgâr Türbini', 'ruzgarturbini', 'ucurtma'), S('Güneş Paneli', 'gunes', 'ucurtma'),
      S('Kunduz Seti', 'kunduzseti', 'tekne'), S('Bent Üstü', 'basamak', 'kayma'), F('tekne')],
    // ---- Deniz Feneri ----
    26: [S('Balıkçı İskelesi', 'iskele', 'tekne'), S('Ağ Tamircisi', 'agtamir', 'ziplama'), S('Martı Direği', 'marti', 'kus'),
      S('Kum Kalesi', 'kumkale', 'ziplama'), F('ziplama'), S('Deniz Kabukları', 'kumsal', 'kayma'), S('Kayıkhane', 'kayikhane', 'tekne'),
      S('Liman Vinci', 'vinc', 'teleferik'), S('Şamandıra', 'samandira', 'tekne'), F('fener')],
    27: [S('Dalgakıran', 'dalgakiran', 'kayma'), S('Deniz Mağarası', 'denizmagara', 'tekne'), S('Mercan Kayası', 'mercan', 'tekne'),
      S('Balina Koyu', 'balinakoyu', 'tekne'), F('tekne'), S('Batık Gemi', 'batik', 'tekne'), S('Yelkenli', 'yelkenli', 'tekne'),
      S('Rüzgârlı Burun', 'tepe', 'ucurtma'), S('Kıyı Kayalıkları', 'aslankayasi', 'kus'), F('kus')],
    28: [S('Fener Merdiveni', 'merdiven', 'ziplama'), S('Sis Düdüğü', 'duduk', 'top'), S('Denizatı Havuzu', 'birikinti', 'tekne'),
      S('Mercek Odası', 'mercek', 'fener'), F('tekne'), S('Bekçi Kulübesi', 'kulube', 'fener'), S('Gece Nöbeti', 'kirfeneri', 'fener'),
      S('Yunus Koyu', 'yunuskoyu', 'tekne'), S('Fenerin Tepesi', 'lighthouseSt', 'fener'), F('tekne')],
    // ---- Rasathane ----
    29: [S('Ay Işığı Patikası', 'patika', 'kayma'), S('Güneş Saati', 'gunessaati', 'sarkac'), S('Gök Küresi', 'gokkure', 'tekerlek'),
      S('Rakun Çatısı', 'cati', 'ziplama'), F('ziplama'), S('Döner Tabla', 'donertabla', 'tekerlek'), S('Pusula Masası', 'pusula', 'isinlanma'),
      S('Yıldız Kataloğu', 'kutuphane', 'isinlanma'), S('Kubbe Merdiveni', 'merdiven', 'ziplama'), F('roket')],
    30: [S('Kurt Tepesi', 'tepe', 'ziplama'), S('Ay Evreleri', 'evre', 'isinlanma'), S('Kayan Yıldız', 'kuyruklu', 'kayma'),
      S('Takımyıldız Bahçesi', 'takimyildiz', 'isinlanma'), F('ziplama'), S('Gökbilimci Masası', 'pusula', 'isinlanma'), S('Dev Teleskop', 'devteleskop', 'roket'),
      S('Yıldız Haritası', 'harita', 'isinlanma'), S('Gözlemevi Balkonu', 'gozlemevi', 'ucurtma'), F('roket')],
    // ---- Havai Fişek ----
    31: [S('Fener Tezgâhı', 'lanternStall', 'fener'), S('Roket Rampası', 'rocket', 'roket'), S('Konfeti Topu', 'cannon', 'top'),
      S('Balon Standı', 'balloonStand', 'balon'), F('kus'), S('Barut Fıçısı', 'barrel', 'top'), S('Fitil Ustası', 'fitil', 'roket'),
      S('Kibrit Kulesi', 'kibrit', 'fener'), S('Barut Deposu', 'fici', 'top'), F('ziplama')],
    32: [S('Maytap Çadırı', 'sparkTent', 'roket'), S('Dönme Dolap', 'wheel', 'tekerlek'), S('Kıvılcım Yağmuru', 'kivilcimyagmuru', 'roket'),
      S('Horoz Kulesi', 'horozkule', 'kus'), F('kus'), S('Fitil Köprüsü', 'kopru', 'teleferik'), S('Çan Kulesi', 'can', 'sarkac'),
      S('Davul Sahnesi', 'drumStage', 'ziplama'), S('Şenlik Kapısı', 'gise', 'balon'), F('sarkac')],
    33: [S('Papağan Sahnesi', 'parrot', 'kus'), S('Tavus Bahçesi', 'tavusbahce', 'kus'), S('Uçan Fener Tepesi', 'ucanfener', 'fener'),
      S('Ateş Cambazı', 'atescambazi', 'ziplama'), F('kus'), S('Gökyüzü Rampası', 'rocket', 'roket'), S('Büyük Fişek', 'firlatma', 'roket'),
      S('Dev Davul Arenası', 'arena', 'ziplama'), S('Şölen Meydanı', 'pazar', 'balon'), F('fener')],
    // ---- Buzul ----
    34: [S('İglo', 'igloo', 'kayma'), S('Kardan Adam Bahçesi', 'snowman', 'kartopu'), S('Penguen Yuvası', 'penguins', 'kayma'),
      S('Buz Pateni Gölü', 'rink', 'paten'), F('kizak'), S('Kutup Ayısı Mağarası', 'bearCave', 'kartopu'), S('Kar Tepesi', 'kar', 'kizak'),
      S('Buz Balıkçısı', 'buzbalikci', 'paten'), S('Çam Ormanı', 'cam', 'kizak'), F('kartopu')],
    35: [S('Kızak Rampası', 'sled', 'kizak'), S('Kristal Mağara', 'crystal', 'isinlanma'), S('Fok Kayası', 'seal', 'ziplama'),
      S('Buz Sarkıtları', 'sarkit', 'kayma'), F('kayma'), S('Kuzey Işığı Kulesi', 'tower', 'fener'), S('Donmuş Şelale', 'donmusselale', 'kayma'),
      S('Buz Sarayı', 'palace', 'paten'), S('Mağaranın Dibi', 'denizmagara', 'kizak'), F('kizak')],
    // ---- Değirmen ----
    36: [S('Su Arkı', 'dere', 'tekne'), S('Su Çarkı', 'sucarki', 'tekerlek'), S('Kümes', 'kumes', 'ziplama'),
      S('Yumurta Sepeti', 'sepet', 'tekerlek'), F('kus'), S('Bent Kapağı', 'bentkapak', 'kayma'), S('Ördek Göleti', 'gol', 'tekne'),
      S('Söğütlü Kanal', 'sogut', 'tekne'), S('Değirmen Taşı', 'tasdegirmen', 'tekerlek'), F('ucurtma')],
    37: [S('Yel Değirmeni', 'yeldegirmeni', 'ucurtma'), S('Ağıl', 'cit', 'ziplama'), S('Yün Eğirme', 'yun', 'tekerlek'),
      S('Rüzgâr Tepesi', 'ruzgargulu', 'ucurtma'), F('ziplama'), S('Samanlık', 'saman', 'kayma'), S('Elma Mahzeni', 'elma', 'tekerlek'),
      S('Tarla Yolu', 'patika', 'tekerlek'), S('Traktör Ambarı', 'ambar', 'tekerlek'), F('tekerlek')],
    38: [S('Çark Evi', 'sucarki', 'tekerlek'), S('Süt Kovası', 'sut', 'kayma'), S('Ahır', 'ambar', 'ziplama'),
      S('Peynir Odası', 'peynir', 'tekerlek'), F('ziplama'), S('Buğday Tarlası', 'bugday', 'ucurtma'), S('Arı Kovanları', 'kovan', 'kus'),
      S('Ayçiçeği Tarlası', 'aycicegi', 'ucurtma'), S('Hasat Şenliği', 'balloonStand', 'balon'), F('ucurtma')],
    // ---- Büyü Kulesi ----
    39: [S('Ayna Salonu', 'aynasalon', 'isinlanma'), S('Yüzen Kitaplar', 'kitaplar', 'ucurtma'), S('İksir Kazanı', 'iksir', 'ziplama'),
      S('Rün Taşları', 'run', 'isinlanma'), F('isinlanma'), S('Kristal Bahçe', 'kristalbahce', 'isinlanma'), S('Yıldız Merdiveni', 'yildizmerdiven', 'ziplama'),
      S('Büyücü Odası', 'buyucu', 'isinlanma'), S('Gökkuşağı Köprüsü', 'gokkusagi', 'kayma'), F('kus')],
    40: [S('İkiz Portal', 'portal', 'isinlanma'), S('Mor Sis', 'sis', 'balon'), S('Uçan Halı', 'hali', 'ucurtma'),
      S('Büyü Kitaplığı', 'kitaplik', 'isinlanma'), F('ucurtma'), S('Yıldız Çemberi', 'cember', 'isinlanma'), S('Kül Yuvası', 'kul', 'fener'),
      S('Ateş Kuyusu', 'ateskuyusu', 'roket'), S('Anka\'nın Tüneği', 'tunek', 'kus'), F('kus')],
  };

  const api = { STORY, WORLDS, GATES, STOPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RingJourney = api;
})(this);
