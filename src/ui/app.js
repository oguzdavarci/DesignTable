// DesignTable arayüzü: proje listesi, Ekranlar / Akışlar / Bileşenler sekmeleri, büyük görünüm, dışa aktarma.
const $ = (s, kok = document) => kok.querySelector(s);
const $$ = (s, kok = document) => [...kok.querySelectorAll(s)];
const kacis = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const q = new URLSearchParams(location.search);
const GORUNTU = q.get('goruntu') === '1';

const durum = {
  projeler: [],
  id: null,
  v: null,                 // açık proje: { id, yol, proje, cihaz, ekranlar, akislar }
  sekme: q.get('sekme') || 'ekranlar',
  akisId: null,
  secim: {},               // { tema: 'cuha', deste: 'klasik' }
  surum: 1,                // iframe'leri yenilemek için
  izgaraOlcek: +(localStorage.izgaraOlcek || 0.42),
  gorunumler: {},          // akış id -> { z, tx, ty }
  buyukId: null,
};

// ------------------------------------------------------------------ yardımcılar
function ekranUrl(dosya) {
  const yol = dosya.split('/').map(encodeURIComponent).join('/');
  const s = Object.entries(durum.secim).map(([k, v]) => `d_${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `dt://${durum.id}/${yol}?${s}&v=${durum.surum}`;
}

function bildir(metin, { hata = false, sure = 3200, eylem } = {}) {
  const b = document.createElement('div');
  b.className = 'bildirim' + (hata ? ' hata' : '');
  b.innerHTML = `<span>${kacis(metin)}</span>`;
  if (eylem) {
    const d = document.createElement('button');
    d.textContent = eylem.ad;
    d.onclick = () => { eylem.yap(); b.remove(); };
    b.appendChild(d);
  }
  $('#bildirimler').appendChild(b);
  if (sure) setTimeout(() => b.remove(), sure);
  return b;
}

async function islem(baslik, fn) {
  const b = bildir(baslik + '…', { sure: 0 });
  try {
    const sonuc = await fn();
    b.remove();
    if (sonuc) bildir('Kaydedildi: ' + sonuc.split('/').pop(), { sure: 6000, eylem: { ad: 'Göster', yap: () => dt.goster(null, null, sonuc) } });
  } catch (err) {
    b.remove();
    bildir('Olmadı: ' + err.message, { hata: true, sure: 7000 });
  }
}

function secimKaydet() {
  const t = JSON.parse(localStorage.secimler || '{}');
  t[durum.id] = durum.secim;
  localStorage.secimler = JSON.stringify(t);
}

// ------------------------------------------------------------------ kenar çubuğu
function kenarCiz() {
  const ul = $('#projeler');
  ul.innerHTML = '';
  const liste = [...durum.projeler];
  if (durum.v && !liste.some(p => p.id === durum.id)) liste.push({ id: durum.id, ad: durum.v.proje.ad, yol: durum.v.yol, var: true, gecici: true });
  for (const p of liste) {
    const li = document.createElement('li');
    li.className = (p.id === durum.id ? 'secili' : '') + (p.var ? '' : ' eksik');
    li.innerHTML = `<b>${kacis(p.ad)}</b><small title="${kacis(p.yol)}">${kacis(p.var ? p.yol.replace(/^\/Users\/[^/]+/, '~') : 'Klasör bulunamadı')}</small>` +
      (p.gecici ? '' : '<button class="menu-dugme" title="Seçenekler">⋯</button>');
    li.onclick = e => { if (!e.target.classList.contains('menu-dugme')) projeAc(p.id); };
    const m = $('.menu-dugme', li);
    if (m) m.onclick = e => { e.stopPropagation(); projeMenusu(p, m); };
    ul.appendChild(li);
  }
  if (!liste.length) ul.innerHTML = '<li style="color:var(--soluk)">Henüz proje yok</li>';
}

function projeMenusu(p, dugme) {
  menuKapat();
  const m = document.createElement('div');
  m.className = 'acilir';
  m.style.position = 'fixed';
  const r = dugme.getBoundingClientRect();
  m.style.left = r.left + 'px'; m.style.top = (r.bottom + 4) + 'px'; m.style.minWidth = '200px';
  m.innerHTML = '<button data-e="goster">Klasörü Finder\'da göster</button><button data-e="kaldir">Listeden kaldır<small>Dosyalar silinmez</small></button>';
  m.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    menuKapat();
    if (b.dataset.e === 'goster') dt.goster(null, null, p.yol + '/project.json');
    if (b.dataset.e === 'kaldir') {
      await dt.projeKaldir(p.id);
      durum.projeler = await dt.projeler();
      if (durum.id === p.id) { durum.id = null; durum.v = null; delete localStorage.sonProje; }
      kenarCiz();
      if (!durum.v) (durum.projeler[0] ? projeAc(durum.projeler[0].id) : bosCiz());
    }
  };
  document.body.appendChild(m);
  m.dataset.menu = '1';
}
function menuKapat() { $$('.acilir').forEach(m => m.remove()); }
document.addEventListener('pointerdown', e => { if (!e.target.closest('.acilir') && !e.target.closest('[data-acar]')) menuKapat(); });

function adSor(baslik, varsayilan = '') {
  return new Promise(coz => {
    const p = $('#pencere');
    p.innerHTML = `<div class="pencere-kutu"><h3>${kacis(baslik)}</h3><input value="${kacis(varsayilan)}" placeholder="Proje adı"><div class="satir"><button class="dugme" data-e="vazgec">Vazgeç</button><button class="dugme birincil" data-e="tamam">Devam</button></div></div>`;
    p.hidden = false;
    const inp = $('input', p);
    inp.focus(); inp.select();
    const bitir = v => { p.hidden = true; p.innerHTML = ''; coz(v); };
    p.onclick = e => { const b = e.target.closest('button'); if (b) bitir(b.dataset.e === 'tamam' ? inp.value.trim() : null); };
    inp.onkeydown = e => { if (e.key === 'Enter') bitir(inp.value.trim()); if (e.key === 'Escape') bitir(null); };
  });
}

$('#proje-ekle').onclick = async () => {
  try {
    const id = await dt.projeEkle();
    if (!id) return;
    durum.projeler = await dt.projeler();
    projeAc(id);
  } catch (err) { bildir(err.message, { hata: true }); }
};
$('#yeni-proje').onclick = async () => {
  const ad = await adSor('Yeni projenin adı');
  if (!ad) return;
  try {
    const id = await dt.yeniProje(ad);
    if (!id) return;
    durum.projeler = await dt.projeler();
    projeAc(id);
    bildir('Proje oluşturuldu. Ekranları screens/ klasörüne HTML olarak ekle.', { sure: 6000 });
  } catch (err) { bildir(err.message, { hata: true }); }
};

// ------------------------------------------------------------------ proje
async function projeAc(id, secenek = {}) {
  if (durum.id !== id) { proto.simdiki = null; proto.gecmis = []; }
  durum.id = id;
  localStorage.sonProje = id;
  try {
    durum.v = await dt.projeOku(id);
  } catch (err) {
    durum.v = null;
    kenarCiz();
    $('#ust').innerHTML = '';
    $('#icerik').innerHTML = `<div class="bos"><h2>Proje açılamadı</h2>${kacis(err.message)}</div>`;
    return;
  }
  const kayitli = JSON.parse(localStorage.secimler || '{}')[id] || {};
  durum.secim = {};
  for (const g of durum.v.proje.degiskenler || []) {
    const ids = (g.secenekler || []).map(s => s.id);
    const istenen = q.get(g.id) || kayitli[g.id];
    durum.secim[g.id] = ids.includes(istenen) ? istenen : (g.varsayilan || ids[0]);
  }
  if (secenek.sekme) durum.sekme = secenek.sekme;
  const akisIds = durum.v.akislar.map(a => a.id);
  durum.akisId = akisIds.includes(secenek.akis) ? secenek.akis : (akisIds.includes(durum.akisId) ? durum.akisId : akisIds[0]);
  kenarCiz();
  ustCiz();
  icerikCiz();
  if (secenek.ekran) buyukAc(secenek.ekran);
}

function bosCiz() {
  $('#ust').innerHTML = '<div class="proje-bilgi"><h1>DesignTable</h1><p>Tasarım projelerin tek yerde</p></div>';
  $('#icerik').innerHTML = `<div class="bos"><h2>Henüz proje yok</h2>İçinde <code>project.json</code> olan bir klasörü ekle ya da yeni bir proje oluştur.
    <div><button class="dugme birincil" id="bos-ekle">Proje ekle</button></div></div>`;
  $('#bos-ekle').onclick = () => $('#proje-ekle').click();
}

// ------------------------------------------------------------------ üst çubuk
function ustCiz() {
  const v = durum.v;
  const p = v.proje;
  const sayi = { ekranlar: v.ekranlar.length, akislar: v.akislar.length };
  const sekmeler = [['ekranlar', 'Ekranlar'], ['akislar', 'Akışlar'], ['prototip', 'Prototip']];
  if (p.bilesenler) sekmeler.push(['bilesenler', 'Bileşenler']);
  if (!sekmeler.some(s => s[0] === durum.sekme)) durum.sekme = 'ekranlar';
  const gorunum = (p.degiskenler || []).length
    ? `<div class="gorunum"><button class="dugme gorunum-dugme" data-acar="gorunum" id="gorunum-dugme" title="Görünüm: tema ve diğer seçenekler (T: sıradaki tema)">${gorunumOzeti()}<span class="ok-asagi">▾</span></button></div>` : '';
  $('#ust').innerHTML = `
    <div class="proje-bilgi"><h1>${kacis(p.ad || 'Adsız proje')}</h1><p title="${kacis(p.aciklama || '')}">${kacis(p.aciklama || v.yol)}</p></div>
    <nav class="sekmeler">${sekmeler.map(([k, ad]) => `<button data-sekme="${k}" class="${durum.sekme === k ? 'secili' : ''}">${ad}${sayi[k] != null ? `<span>${sayi[k]}</span>` : ''}</button>`).join('')}</nav>
    ${gorunum}
    <div class="disa"><button class="dugme" data-acar="disa" id="disa-dugme" title="Dışa aktar"><span class="simge">⤓</span><span class="etiket">Dışa aktar</span></button></div>`;
  $$('.sekmeler button').forEach(b => b.onclick = () => { durum.sekme = b.dataset.sekme; ustCiz(); icerikCiz(); });
  if ($('#gorunum-dugme')) $('#gorunum-dugme').onclick = gorunumMenusu;
  $('#disa-dugme').onclick = disaMenusu;
  ustSikistir();
}

// ------------------------------------------------------------------ görünüm (tema ve diğer değişken grupları)
// Seçeneğin rengi: "renk" (zemin) ve varsa "renk2" ya da --Accent (vurgu) ile iki tonlu küçük örnek.
const seciliSecenek = g => (g.secenekler || []).find(s => s.id === durum.secim[g.id]) || (g.secenekler || [])[0];
const ornekRenk = s => ({ a: s.renk, b: s.renk2 || (s.degerler && s.degerler['--Accent']) || s.renk });
function renkOrnegi(s, sinif = 'sw') {
  if (!s || !s.renk) return '';
  const { a, b } = ornekRenk(s);
  return `<i class="${sinif}" style="--a:${kacis(a)};--b:${kacis(b)}"></i>`;
}

function gorunumOzeti() {
  const gruplar = durum.v.proje.degiskenler || [];
  return gruplar.map(g => {
    const s = seciliSecenek(g);
    return s ? `<span class="gorunum-parca">${renkOrnegi(s)}<span class="etiket">${kacis(s.ad || s.id)}</span></span>` : '';
  }).join('<span class="ayrac etiket">·</span>');
}

function secimDegistir(grupId, secenekId) {
  durum.secim[grupId] = secenekId;
  secimKaydet();
  iframeleriYenile();
  const d = $('#gorunum-dugme');
  if (d) d.innerHTML = gorunumOzeti() + '<span class="ok-asagi">▾</span>';
  $$('.gorunum-menu [data-grup]').forEach(b => b.classList.toggle('secili', durum.secim[b.dataset.grup] === b.dataset.secenek));
}

function siradakiTema() {
  const g = (durum.v && durum.v.proje.degiskenler || [])[0];
  if (!g || !(g.secenekler || []).length) return false;
  const i = g.secenekler.findIndex(s => s.id === durum.secim[g.id]);
  const s = g.secenekler[(i + 1) % g.secenekler.length];
  secimDegistir(g.id, s.id);
  bildir(`${g.ad || g.id}: ${s.ad || s.id}`, { sure: 1200 });
  return true;
}

function gorunumMenusu() {
  if ($('.gorunum-menu')) return menuKapat();
  menuKapat();
  const gruplar = durum.v.proje.degiskenler || [];
  const m = document.createElement('div');
  m.className = 'acilir gorunum-menu';
  m.innerHTML = gruplar.map(g => {
    const renkli = (g.secenekler || []).some(s => s.renk);
    const secenekler = (g.secenekler || []).map(s => {
      const secili = durum.secim[g.id] === s.id ? ' secili' : '';
      return renkli
        ? `<button class="tema-satir${secili}" data-grup="${kacis(g.id)}" data-secenek="${kacis(s.id)}">${renkOrnegi(s, 'sw-kart')}<span>${kacis(s.ad || s.id)}</span><b class="tik">✓</b></button>`
        : `<button class="${secili.trim()}" data-grup="${kacis(g.id)}" data-secenek="${kacis(s.id)}">${kacis(s.ad || s.id)}</button>`;
    }).join('');
    return `<div class="grup-baslik">${kacis(g.ad || g.id)}</div>${renkli ? `<div class="tema-liste">${secenekler}</div>` : `<div class="bolumlu tam">${secenekler}</div>`}`;
  }).join('') + '<div class="menu-not"><kbd>T</kbd> sıradaki tema · Seçim bu proje için hatırlanır</div>';
  m.onclick = e => { const b = e.target.closest('[data-grup]'); if (b) secimDegistir(b.dataset.grup, b.dataset.secenek); };
  $('.gorunum').appendChild(m);
}

// Pencere daraldıkça üst çubuğu sıkıştır: önce yazılar kısalır, sonra sadece renk örnekleri ve simgeler kalır.
function ustSikistir() {
  const ust = $('#ust');
  if (!ust) return;
  const w = ust.clientWidth;
  ust.classList.toggle('dar', w < 960);
  ust.classList.toggle('cok-dar', w < 760);
}
new ResizeObserver(() => ustSikistir()).observe(document.getElementById('ust'));

function disaMenusu() {
  if ($('.acilir')) return menuKapat();
  const v = durum.v;
  const akis = v.akislar.find(a => a.id === durum.akisId);
  const m = document.createElement('div');
  m.className = 'acilir';
  m.innerHTML = `
    <button data-e="zip">Projeyi zip olarak indir<small>Bütün dosyalar, olduğu gibi</small></button>
    <button data-e="zip-png">Projeyi PNG'lerle birlikte zip olarak indir<small>Dosyalar + ekranlar 2x + akışlar, seçili temayla</small></button>
    <hr>
    <button data-e="ekranlar">Bütün ekranları PNG olarak indir<small>Tek zip, 2x, seçili temayla</small></button>
    ${akis && !akis.hata ? `<button data-e="akis">"${kacis(akis.ad)}" akışını PNG olarak indir<small>1,5x</small></button>` : ''}
    <hr>
    <button data-e="klasor">Proje klasörünü Finder'da göster</button>`;
  m.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    menuKapat();
    const s = { ...durum.secim };
    ({
      zip: () => islem('Proje paketleniyor', () => dt.projeZip(durum.id, false, s)),
      'zip-png': () => islem('Proje ve görüntüler paketleniyor', () => dt.projeZip(durum.id, true, s)),
      ekranlar: () => islem('Ekranlar PNG olarak hazırlanıyor', () => dt.ekranlarZip(durum.id, 2, s)),
      akis: () => islem('Akış PNG olarak hazırlanıyor', () => dt.akisPng(durum.id, durum.akisId, 1.5, s)),
      klasor: () => dt.goster(durum.id, 'project.json'),
    })[b.dataset.e]();
  };
  $('.disa').appendChild(m);
}

// ------------------------------------------------------------------ içerik
function icerikCiz() {
  const k = $('#icerik');
  k.innerHTML = '';
  k.scrollTop = 0;
  if (durum.sekme === 'akislar') akislarCiz(k);
  else if (durum.sekme === 'prototip') prototipCiz(k);
  else if (durum.sekme === 'bilesenler') bilesenlerCiz(k);
  else ekranlarCiz(k);
}

function iframeOlustur(dosya, W, H, s) {
  const kucuk = document.createElement('div');
  kucuk.className = 'kucuk';
  kucuk.style.width = (W * s) + 'px';
  kucuk.style.height = (H * s) + 'px';
  const f = document.createElement('iframe');
  f.dataset.dosya = dosya;
  f.tabIndex = -1;
  f.setAttribute('scrolling', 'no');
  f.style.width = W + 'px'; f.style.height = H + 'px';
  f.style.transform = `scale(${s})`;
  f.addEventListener('load', () => { f.dataset.yuklendi = '1'; });
  f.src = ekranUrl(dosya);
  kucuk.appendChild(f);
  return kucuk;
}

function ekranlarCiz(k) {
  const v = durum.v;
  const W = v.cihaz.genislik, H = v.cihaz.yukseklik, s = durum.izgaraOlcek;
  const taslak = v.ekranlar.filter(e => e.durum === 'taslak').length;
  k.insertAdjacentHTML('beforeend', `<div class="arac-cubugu"><span>${v.ekranlar.length} ekran${taslak ? ` · ${taslak} taslak` : ''} · ${kacis(v.cihaz.ad)} ${W} × ${H}</span>
    <span class="bosluk"></span><span>Boyut</span><input type="range" min="0.25" max="0.8" step="0.01" value="${s}" id="olcek"></div>`);
  if (!v.ekranlar.length) {
    k.insertAdjacentHTML('beforeend', '<div class="bos"><h2>Ekran yok</h2>screens/ klasörüne HTML dosyası ekle; burada görünür.</div>');
    return;
  }
  const izgara = document.createElement('div');
  izgara.className = 'izgara';
  for (const e of v.ekranlar) {
    const kart = document.createElement('div');
    kart.className = 'ekran-kart';
    kart.style.width = (W * s) + 'px';
    let kucuk;
    if (e.var) kucuk = iframeOlustur(e.dosya, W, H, s);
    else {
      kucuk = document.createElement('div');
      kucuk.className = 'kucuk eksik';
      kucuk.style.width = (W * s) + 'px'; kucuk.style.height = (H * s) + 'px';
      kucuk.innerHTML = `<span>Dosya yok:<br>${kacis(e.dosya)}</span>`;
    }
    kucuk.onclick = () => buyukAc(e.id);
    kart.appendChild(kucuk);
    const rozet = e.durum === 'taslak' ? '<span class="rozet taslak">taslak</span>' : e.durum === 'listede-yok' ? '<span class="rozet listede-yok">project.json\'da yok</span>' : '';
    kart.insertAdjacentHTML('beforeend', `<div class="ekran-alt">${kacis(e.ad)} ${rozet}</div>${e.not ? `<div class="ekran-not" title="${kacis(e.not)}">${kacis(e.not)}</div>` : ''}`);
    if (e.var) {
      const ar = document.createElement('div');
      ar.className = 'kart-araclar';
      ar.innerHTML = '<button class="dugme" title="2x PNG indir">PNG</button>';
      ar.firstChild.onclick = ev => { ev.stopPropagation(); islem('PNG hazırlanıyor', () => dt.ekranPng(durum.id, e.id, 2, { ...durum.secim })); };
      kart.appendChild(ar);
    }
    izgara.appendChild(kart);
  }
  k.appendChild(izgara);
  $('#olcek').oninput = ev => {
    durum.izgaraOlcek = +ev.target.value;
    localStorage.izgaraOlcek = durum.izgaraOlcek;
    const s2 = durum.izgaraOlcek;
    $$('.ekran-kart').forEach(kart => {
      kart.style.width = (W * s2) + 'px';
      const c = $('.kucuk', kart); c.style.width = (W * s2) + 'px'; c.style.height = (H * s2) + 'px';
      const f = $('iframe', kart); if (f) f.style.transform = `scale(${s2})`;
    });
  };
}

// ------------------------------------------------------------------ büyük görünüm
function buyukAc(ekranId) {
  const v = durum.v;
  const liste = v.ekranlar.filter(e => e.var);
  const i = liste.findIndex(e => e.id === ekranId);
  if (i < 0) return;
  const e = liste[i];
  durum.buyukId = e.id;
  const W = v.cihaz.genislik, H = v.cihaz.yukseklik;
  const s = Math.min((window.innerHeight - 70) / H, (window.innerWidth - 300 - 160) / W, 1.25);
  const b = $('#buyuk');
  b.hidden = false;
  b.innerHTML = '';
  const sol = document.createElement('div');
  sol.className = 'buyuk-sol';
  sol.innerHTML = '<button class="yon" data-yon="-1" title="Önceki (←)">‹</button>';
  sol.appendChild(iframeOlustur(e.dosya, W, H, s));
  sol.insertAdjacentHTML('beforeend', '<button class="yon" data-yon="1" title="Sonraki (→)">›</button>');
  const sag = document.createElement('aside');
  sag.className = 'buyuk-sag';
  const rozet = e.durum === 'taslak' ? '<span class="rozet taslak">taslak: maketi yok</span>' : '';
  sag.innerHTML = `<button class="kapat-x" title="Kapat (Esc)">✕</button>
    <h2>${kacis(e.ad)}</h2><div class="satir">${rozet}<span style="color:var(--soluk)">${i + 1} / ${liste.length}</span></div>
    ${e.not ? `<p>${kacis(e.not)}</p>` : ''}
    <div class="baslik-kucuk">Dosya</div><div class="satir"><code>${kacis(e.dosya)}</code><button class="dugme ufak" data-e="goster">Göster</button></div>
    <div class="baslik-kucuk">PNG indir</div><div class="satir">${[1, 2, 3].map(o => `<button class="dugme ufak" data-png="${o}">${o}x</button>`).join('')}</div>
    <div class="baslik-kucuk">Prototip</div><div class="satir"><button class="dugme ufak" data-e="oynat">▶ Buradan oynat</button></div>
    <div class="baslik-kucuk">Görünüm</div><div class="satir" style="color:var(--soluk)">${Object.entries(durum.secim).map(([g, s2]) => {
      const gr = (v.proje.degiskenler || []).find(x => x.id === g); const se = gr && gr.secenekler.find(x => x.id === s2);
      return kacis((gr ? gr.ad : g) + ': ' + (se ? se.ad : s2));
    }).join(' · ')}</div>`;
  b.append(sol, sag);
  b.onclick = ev => {
    const t = ev.target;
    if (t === b || t.classList.contains('kapat-x') || t === sol) return buyukKapat();
    if (t.dataset.yon) return buyukAc(liste[(i + +t.dataset.yon + liste.length) % liste.length].id);
    if (t.dataset.png) return islem('PNG hazırlanıyor', () => dt.ekranPng(durum.id, e.id, +t.dataset.png, { ...durum.secim }));
    if (t.dataset.e === 'goster') dt.goster(durum.id, e.dosya);
    if (t.dataset.e === 'oynat') { buyukKapat(); prototipeGec(e.id); }
  };
}
function buyukKapat() { const b = $('#buyuk'); b.hidden = true; b.innerHTML = ''; durum.buyukId = null; }
document.addEventListener('keydown', e => {
  if ($('#buyuk').hidden) return;
  if (e.key === 'Escape') buyukKapat();
  if (e.key === 'ArrowRight') $('#buyuk [data-yon="1"]').click();
  if (e.key === 'ArrowLeft') $('#buyuk [data-yon="-1"]').click();
});

// ------------------------------------------------------------------ akışlar
let kaydetZamani = null;
function akislarCiz(k) {
  const v = durum.v;
  if (!v.akislar.length) {
    k.innerHTML = '<div class="bos"><h2>Akış yok</h2>flows/ klasörüne JSON dosyası ekle (biçim: DesignTable/docs/PROJECT-FORMAT.md).</div>';
    return;
  }
  const akis = v.akislar.find(a => a.id === durum.akisId) || v.akislar[0];
  durum.akisId = akis.id;
  k.innerHTML = `<div class="arac-cubugu">
      <div class="bolumlu" id="akis-sec">${v.akislar.map(a => `<button data-akis="${kacis(a.id)}" class="${a.id === akis.id ? 'secili' : ''}">${kacis(a.ad)}</button>`).join('')}</div>
      <span>${kacis((akis.veri && akis.veri.aciklama) || '')}</span><span class="bosluk"></span>
      <button class="dugme ufak" id="uzaklas" title="Uzaklaş">−</button><span class="yakinlik" id="yakinlik"></span><button class="dugme ufak" id="yakinlas" title="Yakınlaş">+</button>
      <button class="dugme ufak" id="sigdir">Sığdır</button><button class="dugme ufak" id="akis-png">PNG indir</button></div>
    <div class="akis-alan" id="akis-alan"><div class="akis-kaydir" id="akis-kaydir"></div>
    <div class="akis-ipucu">Sürükle: kutuyu taşı (dosyaya kaydedilir) · Boş alanı sürükle ya da kaydır: gezin · ⌘ + kaydır ya da iki parmak: yakınlaş · Ekrana tıkla: büyük aç</div></div>`;
  $$('#akis-sec button').forEach(b => b.onclick = () => { durum.akisId = b.dataset.akis; akislarCiz(k); });
  if (akis.hata) {
    $('#akis-kaydir').innerHTML = `<div class="bos" style="width:600px"><h2>Akış dosyası okunamadı</h2>${kacis(akis.dosya)}: ${kacis(akis.hata)}</div>`;
    return;
  }
  const alan = $('#akis-alan'), kaydir = $('#akis-kaydir');
  const gor = durum.gorunumler[akis.id] || (durum.gorunumler[akis.id] = { z: 0, tx: 30, ty: 20 });
  const uygula = () => {
    kaydir.style.transform = `translate(${gor.tx}px, ${gor.ty}px) scale(${gor.z})`;
    $('#yakinlik').textContent = Math.round(gor.z * 100) + '%';
  };
  const cizim = AkisCizim.ciz(kaydir, akis.veri, {
    cihaz: v.cihaz,
    ekranlar: new Map(v.ekranlar.map(e => [e.id, e])),
    ekranUrl: e => ekranUrl(e.dosya),
    duzenlenebilir: true,
    yakinlik: () => gor.z,
    ekranAc: id => buyukAc(id),
    degisti: () => {
      clearTimeout(kaydetZamani);
      kaydetZamani = setTimeout(async () => {
        try { await dt.akisKaydet(durum.id, akis.dosya, akis.veri); bildir('Akış kaydedildi', { sure: 1400 }); }
        catch (err) { bildir('Kaydedilemedi: ' + err.message, { hata: true }); }
      }, 350);
    },
  });
  const sigdir = () => {
    const r = alan.getBoundingClientRect();
    gor.z = Math.min((r.width - 40) / cizim.genislik, (r.height - 40) / cizim.yukseklik, 1);
    gor.tx = (r.width - cizim.genislik * gor.z) / 2;
    gor.ty = Math.max(10, (r.height - cizim.yukseklik * gor.z) / 2);
    uygula();
  };
  if (!gor.z) sigdir(); else uygula();
  const yakinlastir = (carpan, mx, my) => {
    const r = alan.getBoundingClientRect();
    const x = mx ?? r.width / 2, y = my ?? r.height / 2;
    const z2 = Math.max(0.15, Math.min(2.5, gor.z * carpan));
    gor.tx = x - (x - gor.tx) * (z2 / gor.z);
    gor.ty = y - (y - gor.ty) * (z2 / gor.z);
    gor.z = z2;
    uygula();
  };
  $('#yakinlas').onclick = () => yakinlastir(1.2);
  $('#uzaklas').onclick = () => yakinlastir(1 / 1.2);
  $('#sigdir').onclick = sigdir;
  $('#akis-png').onclick = () => islem('Akış PNG olarak hazırlanıyor', () => dt.akisPng(durum.id, akis.id, 1.5, { ...durum.secim }));
  alan.addEventListener('wheel', e => {
    e.preventDefault();
    const r = alan.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) yakinlastir(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    else { gor.tx -= e.deltaX; gor.ty -= e.deltaY; uygula(); }
  }, { passive: false });
  alan.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const bas = [e.clientX, e.clientY, gor.tx, gor.ty];
    alan.classList.add('kayiyor');
    const hareket = m => { gor.tx = bas[2] + m.clientX - bas[0]; gor.ty = bas[3] + m.clientY - bas[1]; uygula(); };
    window.addEventListener('pointermove', hareket);
    window.addEventListener('pointerup', () => { window.removeEventListener('pointermove', hareket); alan.classList.remove('kayiyor'); }, { once: true });
  });
}

// ------------------------------------------------------------------ prototip
// Ekranlardaki data-hedef öğeleri tıklanabilir bağlantıdır. Ekranlar iki iframe ile yumuşak geçişle değişir.
const proto = { simdiki: null, gecmis: [], vurgu: q.get('vurgu') === '1', iframeler: [], aktif: 0, bekleyen: null, hedefler: [], sonra: null };

function prototipeGec(id) {
  durum.sekme = 'prototip';
  proto.simdiki = id;
  proto.gecmis = [];
  ustCiz();
  icerikCiz();
}

const ekranAdi = id => { const e = durum.v.ekranlar.find(x => x.id === id); return e ? e.ad : id; };

function prototipCiz(k) {
  const v = durum.v;
  const liste = v.ekranlar.filter(e => e.var);
  if (!liste.length) { k.innerHTML = '<div class="bos"><h2>Ekran yok</h2>screens/ klasörüne HTML dosyası ekle.</div>'; return; }
  const ids = liste.map(e => e.id);
  const baslangic = (v.proje.prototip && ids.includes(v.proje.prototip.baslangic)) ? v.proje.prototip.baslangic : ids[0];
  if (!ids.includes(proto.simdiki)) {
    proto.simdiki = ids.includes(q.get('pekran')) ? q.get('pekran') : baslangic;
    proto.gecmis = [];
  }
  k.innerHTML = `<div class="arac-cubugu">
      <button class="dugme ufak" id="p-geri" title="Önceki ekran (←)">← Geri</button>
      <button class="dugme ufak" id="p-bastan" title="Başlangıç ekranına dön (R)">↺ Baştan</button>
      <label class="onay"><input type="checkbox" id="p-vurgu" ${proto.vurgu ? 'checked' : ''}> Tıklanabilir yerleri göster <kbd>H</kbd></label>
      <span class="bosluk"></span><span>Başlangıç: <b>${kacis(ekranAdi(baslangic))}</b></span></div>
    <div class="proto">
      <aside class="proto-liste">${liste.map(e => `<button data-git="${kacis(e.id)}">${kacis(e.ad)}</button>`).join('')}</aside>
      <div class="proto-orta"><div class="proto-cihaz" id="p-cihaz"></div>
        <div class="proto-ipucu">Ekrana tıkla: bağlantılar çalışır · Boş yere tıkla: tıklanabilir yerler yanıp söner</div></div>
      <aside class="proto-bilgi" id="p-bilgi"></aside>
    </div>`;
  const W = v.cihaz.genislik, H = v.cihaz.yukseklik;
  const orta = $('.proto-orta', k);
  const cihaz = $('#p-cihaz', k);
  // Telefon, orta alana sığacak en büyük boyutta (en fazla 1x); pencere boyutu değişince yeniden ayarlanır
  const boyutla = () => {
    const r = orta.getBoundingClientRect();
    if (!r.height) return;
    const s = Math.max(0.3, Math.min((r.height - 70) / H, (r.width - 40) / W, 1));
    cihaz.style.width = (W * s) + 'px'; cihaz.style.height = (H * s) + 'px'; cihaz.style.borderRadius = (44 * s) + 'px';
    proto.iframeler.forEach(f => { f.style.transform = `scale(${s})`; });
  };
  if (proto.gozlemci) proto.gozlemci.disconnect();
  proto.gozlemci = new ResizeObserver(boyutla);
  proto.iframeler = [0, 1].map(() => {
    const f = document.createElement('iframe');
    f.setAttribute('scrolling', 'no');
    f.style.width = W + 'px'; f.style.height = H + 'px';
    f.src = 'about:blank';
    f.dataset.yuklendi = '1';
    f.addEventListener('load', () => {
      f.dataset.yuklendi = '1';
      // yazı tipi bildirimi gelmezse de geç
      if (proto.bekleyen && proto.bekleyen.iframe === f) setTimeout(() => protoGecisiBitir(f), 900);
    });
    cihaz.appendChild(f);
    return f;
  });
  boyutla();
  proto.gozlemci.observe(orta);
  proto.aktif = 0;
  $('#p-geri', k).onclick = () => protoGit('geri');
  $('#p-bastan', k).onclick = () => { proto.gecmis = []; protoGoster(baslangic); };
  $('#p-vurgu', k).onchange = ev => { proto.vurgu = ev.target.checked; protoGoster(proto.simdiki); };
  $('.proto-liste', k).onclick = ev => { const b = ev.target.closest('[data-git]'); if (b) protoGit(b.dataset.git); };
  $('#p-bilgi', k).onclick = ev => { const b = ev.target.closest('[data-git]'); if (b) protoGit(b.dataset.git); };
  protoGoster(proto.simdiki);
}

function protoGoster(id) {
  const e = durum.v.ekranlar.find(x => x.id === id && x.var);
  if (!e || !proto.iframeler.length) return false;
  const yeni = proto.iframeler[1 - proto.aktif];
  yeni.dataset.dosya = e.dosya;
  yeni.dataset.ek = 'prototip=1' + (proto.vurgu ? '&vurgu=1' : '');
  yeni.dataset.yuklendi = '';
  proto.bekleyen = { iframe: yeni, id };
  proto.hedefler = []; proto.sonra = null;
  yeni.src = ekranUrl(e.dosya) + '&' + yeni.dataset.ek;
  proto.simdiki = id;
  protoBilgiCiz();
  return true;
}

function protoGecisiBitir(f) {
  if (!proto.bekleyen || proto.bekleyen.iframe !== f) return;
  const eski = proto.iframeler[proto.aktif];
  f.classList.add('gorunur');
  if (eski !== f) {
    eski.classList.remove('gorunur');
    delete eski.dataset.dosya;
    setTimeout(() => { if (!eski.classList.contains('gorunur')) { eski.src = 'about:blank'; } }, 220);
  }
  proto.aktif = proto.iframeler.indexOf(f);
  proto.bekleyen = null;
}

function protoGit(hedef) {
  if (hedef === 'geri') {
    if (!proto.gecmis.length) return bildir('Geri gidilecek ekran yok', { sure: 1500 });
    protoGoster(proto.gecmis.pop());
    return;
  }
  if (!durum.v.ekranlar.some(e => e.id === hedef && e.var)) return bildir(`Kırık bağlantı: "${hedef}" adında ekran yok`, { hata: true, sure: 4000 });
  if (hedef !== proto.simdiki) proto.gecmis.push(proto.simdiki);
  protoGoster(hedef);
}

function protoBilgiCiz() {
  const kutu = $('#p-bilgi');
  if (!kutu) return;
  const e = durum.v.ekranlar.find(x => x.id === proto.simdiki);
  $$('.proto-liste [data-git]').forEach(b => {
    b.classList.toggle('secili', b.dataset.git === proto.simdiki);
    b.classList.toggle('baglanti', proto.hedefler.includes(b.dataset.git));
  });
  const varMi = id => id === 'geri' || durum.v.ekranlar.some(x => x.id === id && x.var);
  const hedefler = proto.hedefler.map(h => `<li><button data-git="${kacis(h)}" class="${varMi(h) ? '' : 'kirik'}">${h === 'geri' ? '← Önceki ekran' : '→ ' + kacis(ekranAdi(h))}${varMi(h) ? '' : ' (ekran yok)'}</button></li>`).join('');
  const yol = [...proto.gecmis, proto.simdiki].slice(-6).map(ekranAdi).map(kacis);
  kutu.innerHTML = `<h3>${kacis(e ? e.ad : proto.simdiki)}</h3>${e && e.not ? `<p>${kacis(e.not)}</p>` : ''}
    <div class="baslik-kucuk">Bu ekrandan gidilenler</div>
    ${hedefler ? `<ul class="proto-hedefler">${hedefler}</ul>` : '<p class="soluk">Bu ekranda bağlantı yok.</p>'}
    ${proto.sonra ? `<p class="soluk">⏱ ${(proto.sonra.sure / 1000).toLocaleString('tr-TR')} sn sonra kendiliğinden: <b>${kacis(ekranAdi(proto.sonra.hedef))}</b></p>` : ''}
    <div class="baslik-kucuk">Geçmiş</div><p class="soluk">${yol.join(' → ')}</p>
    <div class="baslik-kucuk">Kısayollar</div><p class="soluk"><kbd>←</kbd> geri · <kbd>R</kbd> baştan · <kbd>H</kbd> tıklanabilir yerler</p>`;
}

window.addEventListener('message', e => {
  const d = e.data || {};
  if (!proto.iframeler.length || durum.sekme !== 'prototip') return;
  const aktif = proto.iframeler[proto.aktif];
  const bekleyen = proto.bekleyen && proto.bekleyen.iframe;
  const kaynak = proto.iframeler.find(f => f.contentWindow === e.source);
  if (!kaynak) return;
  if (d.dtBoyut && kaynak === bekleyen) protoGecisiBitir(kaynak);
  if (d.dtHedefler && (kaynak === bekleyen || kaynak === aktif)) { proto.hedefler = d.dtHedefler; protoBilgiCiz(); }
  if (d.dtSonra && (kaynak === bekleyen || kaynak === aktif)) { proto.sonra = { hedef: d.dtSonra, sure: d.sure }; protoBilgiCiz(); }
  if (d.dtGit && kaynak === aktif && !bekleyen) protoGit(d.dtGit);
  if (d.dtTus) protoTus(d.dtTus);
});

function protoTus(tus) {
  if (durum.sekme !== 'prototip' || !$('#buyuk').hidden) return false;
  if (tus === 'ArrowLeft' || tus === 'Backspace') { protoGit('geri'); return true; }
  if (tus === 'r' || tus === 'R') { $('#p-bastan') && $('#p-bastan').click(); return true; }
  if (tus === 'h' || tus === 'H') { const c = $('#p-vurgu'); if (c) { c.checked = !c.checked; c.onchange({ target: c }); } return true; }
  if (tus === 't' || tus === 'T') return siradakiTema();
  return false;
}
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA/.test(document.activeElement.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (protoTus(e.key)) e.preventDefault();
  else if ((e.key === 't' || e.key === 'T') && siradakiTema()) e.preventDefault();
});

// ------------------------------------------------------------------ bileşenler
function bilesenlerCiz(k) {
  const v = durum.v;
  k.innerHTML = `<div class="arac-cubugu"><span>${kacis(v.proje.bilesenler)}: projedeki ortak parçalar</span><span class="bosluk"></span>
    <button class="dugme ufak" id="bilesen-goster">Dosyayı göster</button></div><div class="bilesen-kap"><div class="kucuk"></div></div>`;
  const f = document.createElement('iframe');
  f.dataset.dosya = v.proje.bilesenler;
  f.dataset.otoBoyut = '1';
  f.style.width = '1200px'; f.style.height = '900px'; f.style.border = '0';
  f.addEventListener('load', () => { f.dataset.yuklendi = '1'; });
  f.src = ekranUrl(v.proje.bilesenler);
  $('.bilesen-kap .kucuk', k).appendChild(f);
  $('#bilesen-goster').onclick = () => dt.goster(durum.id, v.proje.bilesenler);
}
window.addEventListener('message', e => {
  if (!e.data || !e.data.dtBoyut) return;
  const f = $$('iframe').find(x => x.contentWindow === e.source);
  if (f && f.dataset.otoBoyut) { f.style.width = e.data.dtBoyut.w + 'px'; f.style.height = e.data.dtBoyut.h + 'px'; }
});

// ------------------------------------------------------------------ canlı yenileme
function iframeleriYenile(dosyalar) {
  durum.surum++;
  const hepsi = !dosyalar || dosyalar.some(d => !/\.html$/.test(d));
  for (const f of $$('iframe')) {
    if (!f.dataset.dosya) continue;
    if (hepsi || dosyalar.includes(f.dataset.dosya)) { f.dataset.yuklendi = ''; f.src = ekranUrl(f.dataset.dosya) + (f.dataset.ek ? '&' + f.dataset.ek : ''); }
  }
}

dt.degisince(async ({ id, dosyalar }) => {
  if (id !== durum.id || !durum.v) return;
  const bilinenEkranlar = new Set(durum.v.ekranlar.map(e => e.dosya));
  const yapisal = dosyalar.some(d => d === 'project.json' || d.startsWith('flows/') || (d.startsWith('screens/') && d.endsWith('.html') && !bilinenEkranlar.has(d)));
  if (yapisal) {
    try {
      durum.v = await dt.projeOku(id);
      durum.surum++;
      ustCiz();
      icerikCiz();
      if (durum.buyukId) buyukAc(durum.buyukId);
    } catch (err) { bildir('Proje okunamadı: ' + err.message, { hata: true, sure: 6000 }); }
  } else {
    iframeleriYenile(dosyalar);
  }
});

// ------------------------------------------------------------------ başlangıç
async function hazirIsaretle() {
  const yuklensin = async () => {
    const bas = Date.now();
    while (Date.now() - bas < 15000) {
      if ($$('iframe').every(x => x.dataset.yuklendi === '1')) break;
      await new Promise(r => setTimeout(r, 100));
    }
  };
  await yuklensin();
  // --bekle=ms: görüntüden önce bekle (canlı yenilemeyi denemek için)
  if (+q.get('bekle')) { await new Promise(r => setTimeout(r, +q.get('bekle'))); await yuklensin(); }
  await new Promise(r => setTimeout(r, 700));
  document.body.dataset.genislik = window.innerWidth;
  document.body.dataset.yukseklik = window.innerHeight;
  document.body.dataset.hazir = '1';
}

(async function basla() {
  durum.projeler = await dt.projeler();
  let id = q.get('proje') || localStorage.sonProje;
  if (id && !q.get('proje') && !durum.projeler.some(p => p.id === id)) id = null;
  if (!id && durum.projeler.length) id = durum.projeler[0].id;
  kenarCiz();
  if (id) await projeAc(id, { sekme: q.get('sekme'), akis: q.get('akis'), ekran: q.get('ekran') });
  else bosCiz();
  if (q.get('acik') === 'gorunum' && $('#gorunum-dugme')) gorunumMenusu();
  if (GORUNTU) hazirIsaretle();
})();
