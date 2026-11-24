# Kahve Durağı (örnek proje)

DesignTable'ın örnek projesi: küçük bir kahve sipariş uygulamasının 4 ekranı, iki değişken grubu
(Tema: Krem / Gece, Vurgu: Karamel / Nane / Böğürtlen), bir akış ve tıklanabilir prototip.
Biçim: [`docs/PROJECT-FORMAT.md`](../../docs/PROJECT-FORMAT.md).

- `project.json`: ad, cihaz ölçüsü, değişken grupları, ekran ve akış listesi
- `shared/styles.css`: ortak stil ve rol değişkenleri
- `shared/components.js`: tekrar eden parçalar (`<kd-durum>`, `<kd-fincan>`, `<kd-ikon>`)
- `screens/`: her ekran bir HTML dosyası
- `flows/`: her akış bir JSON dosyası
