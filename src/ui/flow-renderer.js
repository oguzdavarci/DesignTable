// Akış çizici: flows/*.json verisini ekran küçük resimleri, durum kutuları ve oklarla çizer.
// Hem uygulamadaki Akışlar sekmesi hem de PNG dışa aktarma sayfası bunu kullanır.
(function () {
  const ALT_ALAN = 60;  // ekran düğümünün altındaki ad/etiket alanı (oklar bu alanın altına bağlanır)
  const BOSLUK = 48;    // tuval kenar boşluğu

  const yeni = (etiket, sinif, html) => {
    const e = document.createElement(etiket);
    if (sinif) e.className = sinif;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const kacis = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const satirlar = s => kacis(s).replace(/\n/g, '<br>');

  function kutuHesapla(d, akis, cihaz) {
    if (d.ekran) {
      const s = d.olcek || akis.olcek || 0.4;
      const ic = cihaz.yukseklik * s;
      return { x: d.x, y: d.y, w: cihaz.genislik * s, h: ic + ALT_ALAN, ic, s };
    }
    const w = d.gen || 160, h = d.yuk || 60;
    return { x: d.x, y: d.y, w, h, ic: h };
  }

  function kenarNoktasi(b, kenar, kaydir) {
    switch (kenar) {
      case 'ust': return [b.x + b.w / 2 + kaydir, b.y];
      case 'alt': return [b.x + b.w / 2 + kaydir, b.y + b.h];
      case 'sol': return [b.x, b.y + b.ic / 2 + kaydir];
      default: return [b.x + b.w, b.y + b.ic / 2 + kaydir];
    }
  }

  function otomatikKenarlar(a, b) {
    const dx = (b.x + b.w / 2) - (a.x + a.w / 2), dy = (b.y + b.ic / 2) - (a.y + a.ic / 2);
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['sag', 'sol'] : ['sol', 'sag'];
    return dy >= 0 ? ['alt', 'ust'] : ['ust', 'alt'];
  }

  function sadelestir(n) {
    const t = [];
    for (const p of n) if (!t.length || Math.hypot(p[0] - t[t.length - 1][0], p[1] - t[t.length - 1][1]) > 0.5) t.push(p);
    const s = [t[0]];
    for (let i = 1; i < t.length - 1; i++) {
      const [a, b, c] = [s[s.length - 1], t[i], t[i + 1]];
      const ayniDogru = (Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5);
      if (!ayniDogru) s.push(b);
    }
    if (t.length > 1) s.push(t[t.length - 1]);
    return s;
  }

  // Ok yolu: dik açılı. cikis/giris kenarı (sol, sag, ust, alt), kaydırma ve kulvar (orta parçanın konumu) verilebilir.
  function okYolu(ok, kutular) {
    if (Array.isArray(ok.yol)) return ok.yol;
    const a = kutular[ok.kaynak], b = kutular[ok.hedef];
    if (!a || !b) return null;
    const [oc, og] = otomatikKenarlar(a, b);
    const c = ok.cikis || oc, g = ok.giris || og;
    const p0 = kenarNoktasi(a, c, ok.cikisKaydir || 0), p3 = kenarNoktasi(b, g, ok.girisKaydir || 0);
    const yc = c === 'sol' || c === 'sag', yg = g === 'sol' || g === 'sag';
    let n;
    if (yc && yg) { const mx = ok.kulvar ?? (p0[0] + p3[0]) / 2; n = [p0, [mx, p0[1]], [mx, p3[1]], p3]; }
    else if (!yc && !yg) { const my = ok.kulvar ?? (p0[1] + p3[1]) / 2; n = [p0, [p0[0], my], [p3[0], my], p3]; }
    else if (yc) n = [p0, [p3[0], p0[1]], p3];
    else n = [p0, [p0[0], p3[1]], p3];
    return sadelestir(n);
  }

  function etiketNoktasi(ok, yol) {
    if (Array.isArray(ok.etiketKonum)) return ok.etiketKonum;
    let i = 0;
    if (yol.length === 4) i = 1;
    else { let en = -1; for (let k = 0; k < yol.length - 1; k++) { const u = Math.hypot(yol[k + 1][0] - yol[k][0], yol[k + 1][1] - yol[k][1]); if (u > en) { en = u; i = k; } } }
    return [(yol[i][0] + yol[i + 1][0]) / 2, (yol[i][1] + yol[i + 1][1]) / 2];
  }

  let sayac = 0;

  // kap: çizimin konacağı eleman. ortam: { cihaz, ekranlar (Map), ekranUrl(ekran), duzenlenebilir, yakinlik(), degisti(), ekranAc(id) }
  function ciz(kap, akis, ortam) {
    kap.innerHTML = '';
    const cihaz = ortam.cihaz;
    const dugumler = akis.dugumler || (akis.dugumler = []);
    const oklar = akis.oklar || [];
    const notlar = akis.notlar || [];
    const ucId = 'ok-ucu-' + (++sayac);

    const tuval = yeni('div', 'akis-tuval');
    const grupKatmani = yeni('div', 'akis-katman');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('akis-oklar');
    const dugumKatmani = yeni('div', 'akis-katman');
    const etiketKatmani = yeni('div', 'akis-katman akis-etiketler');
    tuval.append(grupKatmani, svg, dugumKatmani, etiketKatmani);
    kap.appendChild(tuval);

    const kutular = {};
    const elemanlar = {};
    for (const d of dugumler) {
      const b = kutuHesapla(d, akis, cihaz);
      kutular[d.id] = b;
      let e;
      if (d.ekran) {
        const ekran = ortam.ekranlar.get(d.ekran);
        const taslak = ekran && ekran.durum === 'taslak';
        e = yeni('div', 'dugum ekran-dugum' + (taslak ? ' taslak' : ''));
        const kucuk = yeni('div', 'kucuk');
        kucuk.style.width = b.w + 'px'; kucuk.style.height = b.ic + 'px';
        if (ekran && ekran.var !== false) {
          const f = document.createElement('iframe');
          f.dataset.dosya = ekran.dosya;
          f.tabIndex = -1;
          f.setAttribute('scrolling', 'no');
          f.style.width = cihaz.genislik + 'px'; f.style.height = cihaz.yukseklik + 'px';
          f.style.transform = `scale(${b.s})`;
          f.addEventListener('load', () => { f.dataset.yuklendi = '1'; });
          f.src = ortam.ekranUrl(ekran);
          kucuk.appendChild(f);
        } else {
          kucuk.classList.add('eksik');
          kucuk.innerHTML = `<span>Ekran bulunamadı:<br>${kacis(d.ekran)}</span>`;
        }
        e.appendChild(kucuk);
        e.appendChild(yeni('div', 'dugum-ad', kacis(d.baslik || (ekran ? ekran.ad : d.ekran))));
        if (taslak) e.appendChild(yeni('span', 'rozet taslak', 'maketi yok · taslak'));
        if (d.alt) e.appendChild(yeni('div', 'dugum-alt', satirlar(d.alt)));
        e.title = ortam.duzenlenebilir ? 'Sürükle: taşı · Tıkla: büyük aç' : '';
      } else if (d.tur === 'grup') {
        e = yeni('div', 'dugum grup', `<b>${kacis(d.baslik)}</b>`);
        e.style.height = b.h + 'px';
      } else {
        e = yeni('div', 'dugum durum' + (d.vurgu ? ' vurgu' : ''), `<b>${kacis(d.baslik)}</b>${d.alt ? `<small>${satirlar(d.alt)}</small>` : ''}`);
        e.style.height = b.h + 'px';
      }
      e.style.left = b.x + 'px'; e.style.top = b.y + 'px'; e.style.width = b.w + 'px';
      e.dataset.id = d.id;
      (d.tur === 'grup' ? grupKatmani : dugumKatmani).appendChild(e);
      elemanlar[d.id] = e;
    }

    const notElemanlari = notlar.map(n => {
      const e = yeni('div', 'akis-not', satirlar(n.metin));
      e.style.left = n.x + 'px'; e.style.top = n.y + 'px'; e.style.width = (n.gen || 360) + 'px';
      etiketKatmani.appendChild(e);
      return e;
    });

    function boyutla() {
      let gen = 0, yuk = 0;
      for (const b of Object.values(kutular)) { gen = Math.max(gen, b.x + b.w); yuk = Math.max(yuk, b.y + b.h); }
      notlar.forEach((n, i) => { gen = Math.max(gen, n.x + (n.gen || 360)); yuk = Math.max(yuk, n.y + (notElemanlari[i].offsetHeight || 60)); });
      for (const ok of oklar) if (ok.kulvar != null) {
        const a = kutular[ok.kaynak];
        if (!a) continue;
        if ((ok.cikis === 'alt' || ok.cikis === 'ust')) yuk = Math.max(yuk, ok.kulvar + 20); else gen = Math.max(gen, ok.kulvar + 20);
      }
      gen = Math.ceil(gen + BOSLUK); yuk = Math.ceil(yuk + BOSLUK);
      tuval.style.width = gen + 'px'; tuval.style.height = yuk + 'px';
      svg.setAttribute('width', gen); svg.setAttribute('height', yuk);
      return { gen, yuk };
    }

    function oklariCiz() {
      let parcalar = `<defs><marker id="${ucId}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" class="ok-ucu"/></marker></defs>`;
      etiketKatmani.querySelectorAll('.akis-etiket').forEach(x => x.remove());
      for (const ok of oklar) {
        const yol = okYolu(ok, kutular);
        if (!yol || yol.length < 2) continue;
        const d = 'M' + yol.map(p => `${p[0]} ${p[1]}`).join(' L');
        parcalar += `<path d="${d}" class="ok${ok.kesik ? ' kesik' : ''}" marker-end="url(#${ucId})"${ok.cift ? ` marker-start="url(#${ucId})"` : ''}/>`;
        if (ok.etiket) {
          const [x, y] = etiketNoktasi(ok, yol);
          const e = yeni('div', 'akis-etiket', `<span>${kacis(ok.etiket)}</span>`);
          e.style.left = (x - 160) + 'px'; e.style.top = (y - 14) + 'px';
          etiketKatmani.appendChild(e);
        }
      }
      svg.innerHTML = parcalar;
      boyut = boyutla();
      return boyut;
    }
    let boyut = { gen: 0, yuk: 0 };

    if (ortam.duzenlenebilir) {
      const surukle = (e, oge, kutu, ekranId, grup) => {
        e.addEventListener('pointerdown', ev => {
          if (ev.button !== 0) return;
          ev.stopPropagation();
          const z = ortam.yakinlik ? ortam.yakinlik() : 1;
          const bas = [ev.clientX, ev.clientY];
          const ilk = [oge.x, oge.y];
          // Grup sürüklenirse içindeki düğümler de gelir
          const icindekiler = grup ? dugumler.filter(d => d !== oge && d.tur !== 'grup' && kutular[d.id] &&
            kutular[d.id].x >= oge.x && kutular[d.id].y >= oge.y &&
            kutular[d.id].x + kutular[d.id].w <= oge.x + (oge.gen || 160) && kutular[d.id].y + kutular[d.id].h <= oge.y + (oge.yuk || 60))
            .map(d => [d, d.x, d.y]) : [];
          let tasindi = false;
          const tasi = (d, x, y) => {
            d.x = x; d.y = y;
            if (kutular[d.id]) { kutular[d.id].x = x; kutular[d.id].y = y; }
            const el = d.id != null ? elemanlar[d.id] : null;
            if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
          };
          const hareket = m => {
            const dx = (m.clientX - bas[0]) / z, dy = (m.clientY - bas[1]) / z;
            if (!tasindi && Math.hypot(dx, dy) < 3) return;
            tasindi = true;
            e.classList.add('suruklenen');
            if (kutu) tasi(oge, Math.round(ilk[0] + dx), Math.round(ilk[1] + dy));
            else { oge.x = Math.round(ilk[0] + dx); oge.y = Math.round(ilk[1] + dy); e.style.left = oge.x + 'px'; e.style.top = oge.y + 'px'; }
            for (const [d, x0, y0] of icindekiler) tasi(d, Math.round(x0 + dx), Math.round(y0 + dy));
            oklariCiz();
          };
          const birak = () => {
            window.removeEventListener('pointermove', hareket);
            e.classList.remove('suruklenen');
            if (tasindi) ortam.degisti && ortam.degisti();
            else if (ekranId && ortam.ekranAc) ortam.ekranAc(ekranId);
          };
          window.addEventListener('pointermove', hareket);
          window.addEventListener('pointerup', birak, { once: true });
        });
      };
      for (const d of dugumler) surukle(elemanlar[d.id], d, true, d.ekran, d.tur === 'grup');
      notlar.forEach((n, i) => surukle(notElemanlari[i], n, false));
    }

    oklariCiz();
    return { tuval, get genislik() { return boyut.gen; }, get yukseklik() { return boyut.yuk; }, oklariCiz };
  }

  window.AkisCizim = { ciz, okYolu };
})();
