// Akışı PNG'ye çevirmek için tek başına çizen sayfa. Ana süreç hazir işaretini bekleyip görüntü alır.
(async () => {
  const q = new URLSearchParams(location.search);
  const id = q.get('proje');
  const secim = JSON.parse(q.get('secim') || '{}');
  const v = await dt.projeOku(id);
  const akis = v.akislar.find(a => a.id === q.get('akis')) || v.akislar[0];
  document.querySelector('h1').textContent = `${v.proje.ad} · ${akis.ad}`;
  document.querySelector('p').textContent = (akis.veri && akis.veri.aciklama) || '';
  const sorgu = Object.entries(secim).map(([k, s]) => `d_${encodeURIComponent(k)}=${encodeURIComponent(s)}`).join('&');
  const cizim = AkisCizim.ciz(document.getElementById('kap'), akis.veri, {
    cihaz: v.cihaz,
    ekranlar: new Map(v.ekranlar.map(e => [e.id, e])),
    ekranUrl: e => `dt://${id}/${e.dosya.split('/').map(encodeURIComponent).join('/')}?${sorgu}`,
    duzenlenebilir: false,
  });
  // Bütün küçük resimler yüklensin ve yazı tiplerini bildirsin
  const iframeler = [...document.querySelectorAll('iframe')];
  let gelen = 0;
  const bekle = new Promise(coz => {
    if (!iframeler.length) return coz();
    addEventListener('message', e => { if (e.data && e.data.dtBoyut && ++gelen >= iframeler.length) coz(); });
    setTimeout(coz, 12000);
  });
  await bekle;
  await new Promise(r => setTimeout(r, 400));
  document.body.dataset.genislik = Math.max(cizim.genislik, document.documentElement.scrollWidth);
  document.body.dataset.yukseklik = document.documentElement.scrollHeight;
  document.body.dataset.hazir = '1';
})();
