// DesignTable ana süreci: pencere, proje kaydı, dt:// protokolü, dosya izleme, PNG ve zip dışa aktarma, komut satırı.
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const JSZip = require('jszip');

const ARAYUZ = path.join(__dirname, 'ui');
const PRELOAD = path.join(__dirname, 'preload.js');
const SABLON = path.join(__dirname, '..', 'template');
const ATLA = /(^|[\\/])(\.DS_Store|\.git|node_modules|_export)([\\/]|$)/;

protocol.registerSchemesAsPrivileged([
  { scheme: 'dt', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// ---------------------------------------------------------------- proje kaydı
let kayit = [];                 // [{ yol }]
const gecici = new Map();       // komut satırından açılan, kayda girmeyen projeler: id -> yol
const kayitDosyasi = () => path.join(app.getPath('userData'), 'projects.json');
const projeId = yol => 'p' + crypto.createHash('sha1').update(path.resolve(yol)).digest('hex').slice(0, 10);

function kayitOku() {
  // Eski sürümün kayıt dosyası (projeler.json) varsa bir kez taşı
  const eski = path.join(app.getPath('userData'), 'projeler.json');
  if (!fs.existsSync(kayitDosyasi()) && fs.existsSync(eski)) fs.renameSync(eski, kayitDosyasi());
  try { kayit = JSON.parse(fs.readFileSync(kayitDosyasi(), 'utf8')); } catch { kayit = []; }
}
function kayitYaz() {
  fs.mkdirSync(path.dirname(kayitDosyasi()), { recursive: true });
  fs.writeFileSync(kayitDosyasi(), JSON.stringify(kayit, null, 2));
}
function projeYolu(id) {
  const k = kayit.find(p => projeId(p.yol) === id);
  return k ? k.yol : gecici.get(id);
}
function projeyiKaydet(yol) {
  yol = path.resolve(yol);
  if (!kayit.some(p => path.resolve(p.yol) === yol)) { kayit.push({ yol }); kayitYaz(); }
  return projeId(yol);
}

async function jsonOku(dosya) { return JSON.parse(await fsp.readFile(dosya, 'utf8')); }

async function projeOku(id) {
  const yol = projeYolu(id);
  if (!yol) throw new Error('Proje bulunamadı');
  const proje = await jsonOku(path.join(yol, 'project.json'));
  const cihaz = Object.assign({ ad: 'Telefon', genislik: 390, yukseklik: 844 }, proje.cihaz || {});

  // Ekranlar: project.json sırası, sonra klasörde olup listede olmayanlar
  const ekranlar = (proje.ekranlar || []).map(e => ({ ...e, dosya: e.dosya || `screens/${e.id}.html` }));
  const bilinen = new Set(ekranlar.map(e => path.normalize(e.dosya)));
  try {
    for (const f of (await fsp.readdir(path.join(yol, 'screens'))).sort()) {
      const d = 'screens/' + f;
      if (f.endsWith('.html') && !bilinen.has(path.normalize(d))) {
        ekranlar.push({ id: f.replace(/\.html$/, ''), ad: f.replace(/\.html$/, ''), dosya: d, durum: 'listede-yok' });
      }
    }
  } catch { /* screens klasörü yok */ }
  for (const e of ekranlar) e.var = fs.existsSync(path.join(yol, e.dosya));

  // Akışlar: project.json sırası, sonra flows/ klasöründe listede olmayanlar
  const akisListesi = (proje.akislar || []).map(a => ({ ...a, dosya: a.dosya || `flows/${a.id}.json` }));
  const bilinenA = new Set(akisListesi.map(a => path.normalize(a.dosya)));
  try {
    for (const f of (await fsp.readdir(path.join(yol, 'flows'))).sort()) {
      const d = 'flows/' + f;
      if (f.endsWith('.json') && !bilinenA.has(path.normalize(d))) akisListesi.push({ id: f.replace(/\.json$/, ''), dosya: d });
    }
  } catch { /* flows klasörü yok */ }
  const akislar = [];
  for (const a of akisListesi) {
    try {
      const veri = await jsonOku(path.join(yol, a.dosya));
      akislar.push({ ...a, ad: a.ad || veri.ad || a.id, veri });
    } catch (err) { akislar.push({ ...a, ad: a.ad || a.id, hata: err.message }); }
  }
  return { id, yol, proje, cihaz, ekranlar, akislar };
}

// ---------------------------------------------------------------- dt:// protokolü
// dt://<projeId>/<dosya>?d_tema=cuha&d_deste=klasik  -> proje klasöründeki dosya.
// HTML dosyalarına seçili değişken değerleri (:root) ve boyut bildirimi eklenir.
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

function degiskenCss(proje, secim) {
  const degerler = {};
  for (const g of proje.degiskenler || []) {
    const sec = g.secenekler || [];
    const istenen = secim[g.id] || g.varsayilan;
    const s = sec.find(x => x.id === istenen) || sec[0];
    if (s) Object.assign(degerler, s.degerler || {});
  }
  return ':root{' + Object.entries(degerler).map(([k, v]) => `${k}:${v}`).join(';') + '}';
}

const BOYUT_BETIGI = `<script>addEventListener('load',()=>document.fonts.ready.then(()=>{if(parent!==window){const d=document.documentElement;parent.postMessage({dtBoyut:{w:Math.ceil(d.scrollWidth),h:Math.ceil(d.scrollHeight)},adres:location.href},'*')}}))</script>`;

// Prototip modu (?prototip=1): data-hedef olan öğeye tıklanınca üst pencereye haber verir,
// boş yere tıklanınca tıklanabilir yerleri kısa süre parlatır, data-sonra varsa süre dolunca kendiliğinden geçer.
// ?vurgu=1 tıklanabilir yerleri sürekli gösterir.
const PROTOTIP_BETIGI = `<script>(()=>{const q=new URLSearchParams(location.search);if(q.get('prototip')!=='1'||parent===window)return;
const st=document.createElement('style');st.textContent='[data-hedef]{cursor:pointer}html.dt-vurgu [data-hedef],html.dt-parla [data-hedef]{outline:2px solid rgba(47,111,235,.95)!important;outline-offset:1px;box-shadow:0 0 0 5px rgba(47,111,235,.28)!important}html.dt-parla [data-hedef]{transition:box-shadow .2s}';
document.head.appendChild(st);if(q.get('vurgu')==='1')document.documentElement.classList.add('dt-vurgu');
const yolla=v=>parent.postMessage(Object.assign({adres:location.href},v),'*');
document.addEventListener('click',e=>{const h=e.target.closest('[data-hedef]');if(h){e.preventDefault();e.stopPropagation();yolla({dtGit:h.dataset.hedef});return}
const d=document.documentElement;d.classList.add('dt-parla');setTimeout(()=>d.classList.remove('dt-parla'),500)},true);
addEventListener('load',()=>{yolla({dtHedefler:[...new Set([...document.querySelectorAll('[data-hedef]')].map(x=>x.dataset.hedef))]});
const s=document.querySelector('[data-sonra]');if(s){yolla({dtSonra:s.dataset.sonra,sure:+s.dataset.sure||1500});setTimeout(()=>yolla({dtGit:s.dataset.sonra,otomatik:true}),+s.dataset.sure||1500)}});
addEventListener('keydown',e=>yolla({dtTus:e.key}))})()</script>`;

async function protokol(istek) {
  const u = new URL(istek.url);
  const kok = projeYolu(u.hostname);
  if (!kok) return new Response('Proje yok', { status: 404 });
  const dosya = path.join(kok, decodeURIComponent(u.pathname));
  if (!dosya.startsWith(path.resolve(kok) + path.sep)) return new Response('Yasak', { status: 403 });
  let veri;
  try { veri = await fsp.readFile(dosya); } catch { return new Response('Dosya yok: ' + u.pathname, { status: 404 }); }
  const uzanti = path.extname(dosya).toLowerCase();
  const basliklar = { 'content-type': MIME[uzanti] || 'application/octet-stream', 'cache-control': 'no-store' };
  if (uzanti === '.html') {
    const secim = {};
    for (const [k, v] of u.searchParams) if (k.startsWith('d_')) secim[k.slice(2)] = v;
    let proje = {};
    try { proje = await jsonOku(path.join(kok, 'project.json')); } catch { /* project.json okunamadı */ }
    const ek = `<style id="dt-degiskenler">${degiskenCss(proje, secim)}</style>${BOYUT_BETIGI}${PROTOTIP_BETIGI}`;
    let html = veri.toString('utf8');
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, ek + '</head>') : ek + html;
    return new Response(html, { headers: basliklar });
  }
  return new Response(veri, { headers: basliklar });
}

const secimSorgusu = secim => Object.entries(secim || {}).map(([k, v]) => `d_${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
const dosyaUrl = (id, dosya, secim) => `dt://${id}/${dosya.split('/').map(encodeURIComponent).join('/')}?${secimSorgusu(secim)}`;

// ---------------------------------------------------------------- dosya izleme
let izleyici = null;
let bekleyen = new Set();
let zamanlayici = null;
const kendiYazdiklarim = new Map();  // mutlak yol -> zaman (kendi yazdığımız değişikliği yok say)
let anaPencere = null;

function izle(id) {
  if (izleyici) { izleyici.close(); izleyici = null; }
  const kok = projeYolu(id);
  if (!kok) return;
  try {
    izleyici = fs.watch(kok, { recursive: true }, (_tur, dosya) => {
      if (!dosya || ATLA.test(dosya) || dosya.endsWith('~')) return;
      const t = kendiYazdiklarim.get(path.join(kok, dosya));
      if (t && Date.now() - t < 1500) return;
      bekleyen.add(dosya.split(path.sep).join('/'));
      clearTimeout(zamanlayici);
      zamanlayici = setTimeout(() => {
        const dosyalar = [...bekleyen]; bekleyen = new Set();
        for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('degisti', { id, dosyalar });
      }, 180);
    });
  } catch (err) { console.error('İzleme başlamadı:', err.message); }
}

// ---------------------------------------------------------------- görüntü alma
const bekle = ms => new Promise(r => setTimeout(r, ms));

// Görünmeyen bir pencerede sayfayı açar, yazı tipleri ve iframe'ler hazır olunca PNG alır.
// olcek: 1 = 1x, 2 = 2x. Sayfa CSS piksel ölçüsünde çizilir, yakınlaştırma ile keskin büyütülür.
async function goruntuAl({ url, dosya, sorgu, genislik, yukseklik, olcek = 2, hazirIsareti = false, once = null }) {
  // Görünmez pencere ekranın piksel yoğunluğuyla (Retina'da 2) çizer; yakınlaştırmayı buna göre ayarla.
  const dsf = (screen.getPrimaryDisplay() || {}).scaleFactor || 1;
  const z = olcek / dsf;
  const win = new BrowserWindow({
    show: false, width: Math.round(genislik * z), height: Math.round(yukseklik * z), useContentSize: true,
    enableLargerThanScreen: true, paintWhenInitiallyHidden: true,
    webPreferences: { offscreen: true, preload: PRELOAD, backgroundThrottling: false, contextIsolation: true },
  });
  try {
    win.webContents.setFrameRate(30);
    if (url) await win.loadURL(url); else await win.loadFile(dosya, { query: sorgu || {} });
    win.webContents.setZoomFactor(z);
    if (hazirIsareti) {
      const bas = Date.now();
      while (Date.now() - bas < 20000) {
        const h = await win.webContents.executeJavaScript('document.body && document.body.dataset.hazir');
        if (h === '1') break;
        await bekle(100);
      }
      const boyut = await win.webContents.executeJavaScript('({w: +document.body.dataset.genislik || 0, h: +document.body.dataset.yukseklik || 0})');
      if (boyut.w && boyut.h) {
        genislik = boyut.w; yukseklik = boyut.h;
        win.setContentSize(Math.round(genislik * z), Math.round(yukseklik * z));
        win.webContents.setZoomFactor(z);
      }
    } else {
      await win.webContents.executeJavaScript(
        "new Promise(r=>{const f=()=>document.fonts.ready.then(()=>setTimeout(r,120));document.readyState==='complete'?f():addEventListener('load',f)})");
    }
    if (once) await once(win);
    await bekle(450);
    win.webContents.invalidate();
    await bekle(120);
    let img = await win.webContents.capturePage();
    const hedefG = Math.round(genislik * olcek), hedefY = Math.round(yukseklik * olcek);
    const { width, height } = img.getSize();
    if (Math.abs(width - hedefG) > 1 || Math.abs(height - hedefY) > 1) img = img.resize({ width: hedefG, height: hedefY, quality: 'best' });
    return img.toPNG();
  } finally {
    win.destroy();
  }
}

async function ekranPng(id, ekran, cihaz, olcek, secim) {
  return goruntuAl({ url: dosyaUrl(id, ekran.dosya, secim), genislik: cihaz.genislik, yukseklik: cihaz.yukseklik, olcek });
}

async function akisPng(id, akisId, olcek, secim) {
  return goruntuAl({
    dosya: path.join(ARAYUZ, 'flow-export.html'), sorgu: { proje: id, akis: akisId, secim: JSON.stringify(secim || {}) },
    genislik: 1600, yukseklik: 1000, olcek, hazirIsareti: true,
  });
}

// tikla: "seçici1|seçici2": görüntüden önce prototipteki ekranda sırayla bu öğelere tıklar (deneme için)
async function arayuzGoruntusu(sorgu, genislik, yukseklik) {
  const tiklamalar = sorgu.tikla ? String(sorgu.tikla).split('|').filter(Boolean) : [];
  const once = tiklamalar.length ? async win => {
    for (const secici of tiklamalar) {
      let oldu = false;
      for (const f of win.webContents.mainFrame.framesInSubtree) {
        if (!f.url.includes('prototip=1')) continue;
        try {
          oldu = await f.executeJavaScript(`(()=>{const e=document.querySelector(${JSON.stringify(secici)});if(!e)return false;e.click();return true})()`) || oldu;
        } catch { /* çerçeve kapandı */ }
      }
      console.log(oldu ? 'tıklandı:' : 'BULUNAMADI:', secici);
      await bekle(1600);
    }
  } : null;
  return goruntuAl({ dosya: path.join(ARAYUZ, 'index.html'), sorgu: { ...sorgu, goruntu: '1' }, genislik, yukseklik, olcek: 1, hazirIsareti: true, once });
}

// ---------------------------------------------------------------- zip
async function klasoruZiple(zip, kok, onek) {
  const gez = async (klasor) => {
    for (const ad of await fsp.readdir(klasor)) {
      const tam = path.join(klasor, ad);
      const goreli = path.relative(kok, tam);
      if (ATLA.test(goreli)) continue;
      const st = await fsp.stat(tam);
      if (st.isDirectory()) await gez(tam);
      else zip.file(path.posix.join(onek, goreli.split(path.sep).join('/')), await fsp.readFile(tam));
    }
  };
  await gez(kok);
}

const dosyaAdi = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/İ/g, 'I')
  .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'proje';

async function kaydetSor(varsayilan, filtre) {
  const r = await dialog.showSaveDialog(anaPencere, {
    defaultPath: path.join(app.getPath('downloads'), varsayilan), filters: filtre ? [filtre] : undefined,
  });
  return r.canceled ? null : r.filePath;
}

async function kendimYaz(dosya, veri) {
  kendiYazdiklarim.set(path.resolve(dosya), Date.now());
  await fsp.writeFile(dosya, veri);
}

async function ekranlarZipUret(id, olcek, secim) {
  const v = await projeOku(id);
  const zip = new JSZip();
  let i = 0;
  for (const e of v.ekranlar.filter(x => x.var)) {
    i++;
    zip.file(`${String(i).padStart(2, '0')}-${dosyaAdi(e.id)}@${olcek}x.png`, await ekranPng(id, e, v.cihaz, olcek, secim));
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function projeZipUret(id, pngDahil, secim) {
  const v = await projeOku(id);
  const ad = dosyaAdi(v.proje.ad || path.basename(v.yol));
  const zip = new JSZip();
  await klasoruZiple(zip, v.yol, ad);
  if (pngDahil) {
    for (const e of v.ekranlar.filter(x => x.var)) {
      zip.file(`${ad}/_export/screens/${dosyaAdi(e.id)}@2x.png`, await ekranPng(id, e, v.cihaz, 2, secim));
    }
    for (const a of v.akislar.filter(x => !x.hata)) {
      zip.file(`${ad}/_export/flows/${dosyaAdi(a.id)}.png`, await akisPng(id, a.id, 1.5, secim));
    }
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ---------------------------------------------------------------- yeni proje
async function sablondanOlustur(hedef, ad) {
  if (fs.existsSync(hedef) && (await fsp.readdir(hedef)).length) throw new Error('Klasör boş değil: ' + hedef);
  await fsp.cp(SABLON, hedef, { recursive: true });
  const pj = path.join(hedef, 'project.json');
  const veri = await jsonOku(pj);
  veri.ad = ad;
  await fsp.writeFile(pj, JSON.stringify(veri, null, 2) + '\n');
}

// ---------------------------------------------------------------- IPC
function ipcKur() {
  ipcMain.handle('projeler', async () => Promise.all(kayit.map(async p => {
    const id = projeId(p.yol);
    let ad = path.basename(p.yol), aciklama = '';
    const varMi = fs.existsSync(path.join(p.yol, 'project.json'));
    if (varMi) { try { const j = await jsonOku(path.join(p.yol, 'project.json')); ad = j.ad || ad; aciklama = j.aciklama || ''; } catch { /* bozuk */ } }
    return { id, yol: p.yol, ad, aciklama, var: varMi };
  })));

  ipcMain.handle('proje-oku', async (_e, id) => { const v = await projeOku(id); izle(id); return v; });

  ipcMain.handle('proje-ekle', async () => {
    const r = await dialog.showOpenDialog(anaPencere, { title: 'Proje klasörünü seç', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const yol = r.filePaths[0];
    if (!fs.existsSync(path.join(yol, 'project.json'))) {
      const c = await dialog.showMessageBox(anaPencere, {
        type: 'question', buttons: ['Yeni proje oluştur', 'Vazgeç'], defaultId: 0, cancelId: 1,
        message: 'Bu klasörde project.json yok.', detail: 'Klasöre boş bir DesignTable projesi oluşturulsun mu?',
      });
      if (c.response !== 0) return null;
      await sablondanOlustur(yol, path.basename(yol));
    }
    return projeyiKaydet(yol);
  });

  ipcMain.handle('yeni-proje', async (_e, ad) => {
    const r = await dialog.showOpenDialog(anaPencere, { title: `"${ad}" projesi hangi klasörün içine kurulsun?`, properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const hedef = path.join(r.filePaths[0], dosyaAdi(ad));
    await sablondanOlustur(hedef, ad);
    return projeyiKaydet(hedef);
  });

  ipcMain.handle('proje-kaldir', async (_e, id) => {
    kayit = kayit.filter(p => projeId(p.yol) !== id); kayitYaz(); return true;
  });

  ipcMain.handle('akis-kaydet', async (_e, { id, dosya, veri }) => {
    const kok = projeYolu(id);
    const tam = path.join(kok, dosya);
    if (!tam.startsWith(path.resolve(kok) + path.sep)) throw new Error('Geçersiz yol');
    await kendimYaz(tam, JSON.stringify(veri, null, 2) + '\n');
    return true;
  });

  ipcMain.handle('ekran-png', async (_e, { id, ekranId, olcek, secim }) => {
    const v = await projeOku(id);
    const ekran = v.ekranlar.find(e => e.id === ekranId);
    const hedef = await kaydetSor(`${dosyaAdi(ekran.id)}@${olcek}x.png`, { name: 'PNG', extensions: ['png'] });
    if (!hedef) return null;
    await fsp.writeFile(hedef, await ekranPng(id, ekran, v.cihaz, olcek, secim));
    return hedef;
  });

  ipcMain.handle('ekranlar-zip', async (_e, { id, olcek, secim }) => {
    const v = await projeOku(id);
    const hedef = await kaydetSor(`${dosyaAdi(v.proje.ad)}-screens@${olcek}x.zip`, { name: 'Zip', extensions: ['zip'] });
    if (!hedef) return null;
    await fsp.writeFile(hedef, await ekranlarZipUret(id, olcek, secim));
    return hedef;
  });

  ipcMain.handle('akis-png', async (_e, { id, akisId, olcek, secim }) => {
    const hedef = await kaydetSor(`${dosyaAdi(akisId)}@${olcek}x.png`, { name: 'PNG', extensions: ['png'] });
    if (!hedef) return null;
    await fsp.writeFile(hedef, await akisPng(id, akisId, olcek, secim));
    return hedef;
  });

  ipcMain.handle('proje-zip', async (_e, { id, pngDahil, secim }) => {
    const v = await projeOku(id);
    const hedef = await kaydetSor(`${dosyaAdi(v.proje.ad || path.basename(v.yol))}.zip`, { name: 'Zip', extensions: ['zip'] });
    if (!hedef) return null;
    await fsp.writeFile(hedef, await projeZipUret(id, pngDahil, secim));
    return hedef;
  });

  ipcMain.handle('goster', async (_e, { id, dosya, tam }) => {
    const yol = tam || path.join(projeYolu(id), dosya || '');
    shell.showItemInFolder(yol);
    return true;
  });
}

// ---------------------------------------------------------------- pencere
function pencereAc(sorgu = {}) {
  anaPencere = new BrowserWindow({
    width: 1440, height: 920, minWidth: 980, minHeight: 640, title: 'DesignTable',
    titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 18 }, backgroundColor: '#F4F2EE',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  anaPencere.loadFile(path.join(ARAYUZ, 'index.html'), { query: sorgu });
  anaPencere.on('closed', () => { anaPencere = null; });
}

// ---------------------------------------------------------------- komut satırı (yapay zeka ve betikler için)
//   --png <proje klasörü> <ekran id | hepsi> <çıktı dosyası | klasör> [--tema=cuha] [--deste=..] [--olcek=2]
//   --akis-png <proje klasörü> <akış id> <çıktı.png> [--olcek=1.5] [--tema=..]
//   --zip <proje klasörü> <çıktı.zip> [--png-dahil] [--tema=..]
//   --arayuz-goruntusu <çıktı.png> [--proje=<klasör>] [--sekme=ekranlar|akislar|prototip|bilesenler] [--akis=id] [--ekran=id] [--genislik=1440] [--yukseklik=920]
//        prototip için: [--pekran=<ekran id>] [--vurgu=1] [--tikla=<seçici>|<seçici>] [--bekle=ms]
async function komutSatiri(argv) {
  const sec = ad => { const i = argv.indexOf('--' + ad); return i < 0 ? null : argv.slice(i + 1).filter(x => !x.startsWith('--')); };
  const bayraklar = {};
  for (const a of argv) { const m = /^--([^=]+)=(.*)$/.exec(a); if (m) bayraklar[m[1]] = m[2]; }
  const olcek = +bayraklar.olcek || 0;
  const geciciProje = yol => { const id = projeId(yol); if (!projeYolu(id)) gecici.set(id, path.resolve(yol)); return id; };
  const secimAl = async v => {
    const s = {};
    for (const g of v.proje.degiskenler || []) if (bayraklar[g.id]) s[g.id] = bayraklar[g.id];
    return s;
  };

  let p;
  if ((p = sec('png'))) {
    const [yol, ekranId, cikis] = p;
    const id = geciciProje(yol);
    const v = await projeOku(id);
    const secim = await secimAl(v);
    const liste = ekranId === 'hepsi' ? v.ekranlar.filter(e => e.var) : v.ekranlar.filter(e => e.id === ekranId);
    if (!liste.length) throw new Error('Ekran bulunamadı: ' + ekranId);
    for (const e of liste) {
      const hedef = liste.length > 1 || (fs.existsSync(cikis) && fs.statSync(cikis).isDirectory())
        ? path.join(cikis, `${e.id}.png`) : cikis;
      await fsp.mkdir(path.dirname(path.resolve(hedef)), { recursive: true });
      await fsp.writeFile(hedef, await ekranPng(id, e, v.cihaz, olcek || 2, secim));
      console.log('kaydedildi:', path.resolve(hedef));
    }
    return true;
  }
  if ((p = sec('akis-png'))) {
    const [yol, akisId, cikis] = p;
    const id = geciciProje(yol);
    const v = await projeOku(id);
    await fsp.writeFile(cikis, await akisPng(id, akisId, olcek || 1.5, await secimAl(v)));
    console.log('kaydedildi:', path.resolve(cikis));
    return true;
  }
  if ((p = sec('zip'))) {
    const [yol, cikis] = p;
    const id = geciciProje(yol);
    const v = await projeOku(id);
    await fsp.writeFile(cikis, await projeZipUret(id, argv.includes('--png-dahil'), await secimAl(v)));
    console.log('kaydedildi:', path.resolve(cikis));
    return true;
  }
  if ((p = sec('arayuz-goruntusu'))) {
    const [cikis] = p;
    const sorgu = {};
    if (bayraklar.proje) sorgu.proje = geciciProje(bayraklar.proje);
    // sekme, akis, ekran, bekle ve değişken grubu seçimleri (--tema=gece gibi) arayüze aynen geçer
    for (const [k, d] of Object.entries(bayraklar)) if (!['proje', 'genislik', 'yukseklik', 'olcek'].includes(k)) sorgu[k] = d;
    await fsp.writeFile(cikis, await arayuzGoruntusu(sorgu, +bayraklar.genislik || 1440, +bayraklar.yukseklik || 920));
    console.log('kaydedildi:', path.resolve(cikis));
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- başlangıç
app.setName('DesignTable');
app.whenReady().then(async () => {
  kayitOku();
  protocol.handle('dt', protokol);
  ipcKur();
  const argv = process.argv.slice(app.isPackaged ? 1 : 2);
  if (argv.some(a => ['--png', '--akis-png', '--zip', '--arayuz-goruntusu'].includes(a))) {
    try { await komutSatiri(argv); app.exit(0); } catch (err) { console.error('HATA:', err.message); app.exit(1); }
    return;
  }
  pencereAc();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) pencereAc(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
