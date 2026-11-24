# DesignTable proje biçimi

Bir DesignTable projesi, içinde `project.json` olan sıradan bir klasördür. Ekranlar HTML, akışlar JSON,
renkler CSS değişkenidir. Hiçbir dosya DesignTable'a özel değildir: ekranlar tarayıcıda da açılır.
Proje klasörü işin ait olduğu repoda durur (ör. `my-app/design/`); DesignTable sadece klasörün yolunu hatırlar.
Eksiksiz bir örnek: [`examples/coffee-shop/`](../examples/coffee-shop).

```
project-folder/
  project.json        ad, cihaz, değişken grupları (temalar), ekran ve akış listesi
  shared/styles.css   bütün ekranların ortak stili; varsayılan değişken değerleri burada
  shared/*.js         (isteğe bağlı) ortak bileşenler, ör. <dt-kart> gibi özel etiketler
  screens/*.html      her ekran bir dosya
  flows/*.json        her akış bir dosya
  components.html     (isteğe bağlı) bileşenleri gösteren serbest boyutlu sayfa
  assets/             yazı tipi, görsel, SVG
```

**Adlandırma:** Klasör ve dosya adları İngilizce, küçük harf, kelimeler tireyle (`main-menu.html`,
`screen-flow.json`). Ekranın ve akışın `id`'si dosya adıyla aynıdır. İçerik (`ad`, `not`, ekrandaki yazılar) Türkçe olabilir.

## project.json

```json
{
  "ad": "King",
  "aciklama": "Tek satırlık açıklama",
  "cihaz": { "ad": "iPhone 15/16", "genislik": 390, "yukseklik": 844 },
  "degiskenler": [
    { "id": "tema", "ad": "Tema", "varsayilan": "bordo", "secenekler": [
      { "id": "bordo", "ad": "Bordo ve Altın", "renk": "#7A2335", "degerler": { "--Table": "#7A2335", "--Accent": "#E8C46A" } }
    ] }
  ],
  "ekranlar": [
    { "id": "main-menu", "ad": "Ana menü", "dosya": "screens/main-menu.html", "durum": "maket", "not": "Kısa açıklama" }
  ],
  "akislar": [ { "id": "screen-flow", "ad": "Ekran akışı", "dosya": "flows/screen-flow.json" } ],
  "bilesenler": "components.html"
}
```

- **degiskenler**: Figma'daki "mod"ların karşılığı. Her grup üst çubukta bir seçici olur (Tema, Deste…).
  Seçilen seçeneğin `degerler`i, ekran HTML'ine `:root{...}` olarak `styles.css`'ten sonra eklenir.
  Bu yüzden ekranlarda renk kodu yazılmaz, hep `var(--Rol)` kullanılır. `renk` sadece seçicideki noktadır.
- **ekranlar**: sıra ızgaradaki sıradır. `durum`: `maket` (onaylı tasarım) ya da `taslak` (sarı etiketle gösterilir).
  `screens/` klasöründe olup listede olmayan HTML dosyaları da "project.json'da yok" etiketiyle görünür.
- **akislar**: listede olmayan `flows/*.json` dosyaları da görünür.
- **prototip** (isteğe bağlı): `{ "baslangic": "main-menu" }`. Prototip sekmesinin açıldığı ekran; yazılmazsa listedeki ilk ekran.

## Ekran dosyası

```html
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>Ana menü</title>
<link rel="stylesheet" href="../shared/styles.css">
<script src="../shared/components.js"></script>
</head>
<body>
<div class="ekran">
  <div class="a ctr" style="left:143px;top:439px;width:104px;height:104px;border-radius:50%;background:var(--Accent)">Oyna</div>
</div>
</body>
</html>
```

- Kök eleman `.ekran`, cihaz ölçüsünde (ör. 390 × 844). Öğeler çoğunlukla mutlak konumlu (`.a` + `left/top/width/height`),
  ölçüler doğrudan tasarım dokümanındaki pt değerleri.
- Renkler sadece `var(--...)`. Temadan bağımsız sabitler de `styles.css`'te değişken olarak tanımlanır.
- Yazı tipi `styles.css`'te `@font-face` ile `assets/`dan yüklenir; ekran ve PNG gerçek yazı tipiyle çıkar.
- SVG içinde renk gerekiyorsa öznitelik değil stil kullan: `style="fill:var(--Accent)"` (öznitelikte `var()` çalışmaz).

## Akış dosyası

```json
{
  "ad": "Ekran akışı",
  "aciklama": "Tek satır",
  "olcek": 0.42,
  "dugumler": [
    { "id": "menu", "ekran": "main-menu", "x": 330, "y": 320 },
    { "id": "basla", "tur": "durum", "baslik": "Parti başladı", "alt": "4 oyuncu", "vurgu": true, "x": 40, "y": 70, "gen": 150, "yuk": 64 },
    { "id": "tur", "tur": "grup", "baslik": "Tur oynanıyor", "x": 980, "y": 30, "gen": 600, "yuk": 150 }
  ],
  "oklar": [
    { "kaynak": "menu", "hedef": "table", "etiket": "Devam", "cikis": "sag", "giris": "sol", "cikisKaydir": 40, "kulvar": 262, "cift": false }
  ],
  "notlar": [ { "metin": "Açıklama notu", "x": 640, "y": 1086, "gen": 520 } ]
}
```

- **Düğüm türleri**: `ekran` (küçük resim, `olcek` ile boyut; `baslik` ve `alt` isteğe bağlı), `durum` (kutu), `grup` (kesik çerçeve; içindeki düğümlerle birlikte sürüklenir).
  Ekran düğümünün altında 60 birimlik ad alanı vardır; `alt` kenara bağlanan oklar bu alanın altına bağlanır.
- **Oklar** dik açılıdır ve kendiliğinden çizilir. İnce ayar:
  - `cikis` / `giris`: `sol`, `sag`, `ust`, `alt` (yazılmazsa konuma göre seçilir)
  - `cikisKaydir` / `girisKaydir`: kenarın ortasından kaydırma (birim). Paralel okları ayırmak için.
  - `kulvar`: orta parçanın konumu (yatay-yatay oklarda x, dikey-dikey oklarda y). Okları kutuların dışından dolaştırmak için.
  - `cift: true` iki yönlü ok, `kesik: true` kesik çizgi, `etiketKonum: [x, y]` etiketi elle yerleştirme, `yol: [[x,y],…]` tamamen elle çizme.
- Kutular uygulamada sürüklenebilir; yeni `x`, `y` dosyaya yazılır. Elle verilen `etiketKonum` ve `yol` sürüklemeyle değişmez.

## Prototip (tıklanabilir akış)

Prototip sekmesi ekranları gerçek boyutta oynatır. Bağlantılar ekran HTML'inin içindedir:

```html
<div class="a ctr" data-hedef="settings" style="...">…</div>    <!-- tıklayınca settings ekranına gider -->
<div style="flex:1;…" data-hedef="geri">Vazgeç</div>               <!-- bir önceki ekrana döner -->
<div class="ekran" data-sonra="trump-round" data-sure="1500">       <!-- 1,5 sn sonra kendiliğinden geçer -->
```

- `data-hedef`: gidilecek ekranın `id`'si ya da `geri`. Herhangi bir öğeye (buton, kart, satır) konabilir;
  iç içe öğelerde tıklanan yere en yakın olan geçerlidir. Kökteki `.ekran`'a konursa ekranın her yeri tıklanabilir olur.
- `data-sonra` + `data-sure` (ms): ekran kökünde, kendiliğinden geçiş (ör. tur sonu özeti, bot seçiyor).
- Olmayan bir ekrana giden bağlantı oynatıcıda "kırık bağlantı" olarak işaretlenir.
- Bu öznitelikler ekranın görünüşünü değiştirmez; ekranlar normal tarayıcıda da aynı görünür.

## Yapay zeka için çalışma notu

1. Ekranı değiştirmek: ilgili `screens/*.html` dosyasını düzenle. DesignTable açıksa ekran anında yenilenir.
2. Yeni ekran: `screens/<id>.html` oluştur ve `project.json` `ekranlar` listesine ekle (`durum`, `not` ile).
   Prototipte nereden açılıyorsa o öğeye `data-hedef="<id>"`, kapatma/vazgeç öğesine `data-hedef="geri"` ekle.
3. Yeni akış: `flows/<id>.json` oluştur ve `project.json` `akislar` listesine ekle.
4. Renk ve yazı: rol değişkenlerini kullan, renk kodu yazma. Yeni rol gerekiyorsa her temanın `degerler`ine ve `styles.css`'e ekle.
5. Kontrol: işini görüntü alarak doğrula (DesignTable klasöründe):

```bash
npx electron . --png <proje klasörü> <ekran id | hepsi> <çıktı.png | klasör> [--olcek=2] [--tema=<seçenek>]
npx electron . --akis-png <proje klasörü> <akış id> <çıktı.png> [--olcek=1.5]
npx electron . --zip <proje klasörü> <çıktı.zip> [--png-dahil]
npx electron . --arayuz-goruntusu <çıktı.png> --proje=<proje klasörü> [--sekme=ekranlar|akislar|prototip|bilesenler] [--akis=<id>] [--ekran=<id>]
npx electron . --arayuz-goruntusu <çıktı.png> --proje=<proje klasörü> --sekme=prototip [--pekran=<id>] [--vurgu=1] [--tikla='[data-hedef="x"]|[data-hedef="y"]'] [--bekle=ms]
```

Değişken grubu seçimi aynı biçimde verilir: `--<grup id>=<seçenek id>` (ör. `--tema=gece --deste=dort-renk`).
