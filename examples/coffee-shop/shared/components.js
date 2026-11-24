// Kahve Durağı: ekranlarda tekrar eden parçalar, özel etiket olarak.
//   <kd-durum></kd-durum>                         saat, sinyal, pil (ekranın en üstü)
//   <kd-fincan icecek="latte" boyut="64">         üstten görünüş fincan; icecek: latte | matcha | mocha | espresso
//   <kd-ikon ad="arama"></kd-ikon>                çizgi ikon; boyut ve renk dış öğeden gelir
// Renkler sadece var(--...) ile verilir, tema değişince parçalar da değişir.

const IKONLAR = {
  arama: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
  canta: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  geri: '<path d="M15 5l-7 7 7 7"/>',
  kalp: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
  arti: '<path d="M12 5v14M5 12h14"/>',
  eksi: '<path d="M5 12h14"/>',
  ev: '<path d="M4 10.5l8-6.5 8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  fincan: '<path d="M5 9h11v4.5a5.5 5.5 0 0 1-5.5 5.5A5.5 5.5 0 0 1 5 13.5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M9 3.5v2.5M12 3.5v2.5"/>',
  fis: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  kisi: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  yildiz: '<path d="M12 3l2.8 5.8 6.2.8-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.8z"/>',
  etiket: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8a1.4 1.4 0 0 1 0 2l-7 7a1.4 1.4 0 0 1-2 0z"/><circle cx="8" cy="8" r="1.3"/>',
  tik: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  saat: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  konum: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
};

customElements.define('kd-ikon', class extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<svg viewBox="0 0 24 24">${IKONLAR[this.getAttribute('ad')] || ''}</svg>`;
  }
});

customElements.define('kd-durum', class extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="a row" style="left:0;top:0;width:390px;height:47px;padding:0 30px 0 38px;justify-content:space-between;font-size:16px;font-weight:600">
        <span>9:41</span>
        <svg width="72" height="13" viewBox="0 0 72 13" style="overflow:visible">
          <g style="fill:var(--Yazi)">
            <rect x="0" y="8" width="3.4" height="4" rx="1"/><rect x="5" y="6" width="3.4" height="6" rx="1"/>
            <rect x="10" y="3.5" width="3.4" height="8.5" rx="1"/><rect x="15" y="1" width="3.4" height="11" rx="1"/>
          </g>
          <path d="M26.5 4.2a9 9 0 0 1 12.4 0M29 6.9a5.4 5.4 0 0 1 7.4 0" style="fill:none;stroke:var(--Yazi);stroke-width:1.8;stroke-linecap:round"/>
          <circle cx="32.7" cy="10.2" r="1.6" style="fill:var(--Yazi)"/>
          <rect x="45" y=".5" width="24" height="12" rx="3.6" style="fill:none;stroke:var(--Yazi);stroke-width:1;opacity:.45"/>
          <rect x="47" y="2.5" width="18" height="8" rx="2" style="fill:var(--Yazi)"/>
          <path d="M70.6 4.6v3.8" style="stroke:var(--Yazi);stroke-width:1.6;stroke-linecap:round;opacity:.45"/>
        </svg>
      </div>`;
  }
});

customElements.define('kd-fincan', class extends HTMLElement {
  connectedCallback() {
    const icecek = this.getAttribute('icecek') || 'latte';
    const boyut = +this.getAttribute('boyut') || 64;
    const renk = { latte: '--Latte', matcha: '--Matcha', mocha: '--Mocha', espresso: '--Espresso' }[icecek] || '--Latte';
    const ust = icecek === 'espresso'
      ? '<circle cx="47" cy="50" r="19" style="fill:var(--Crema);opacity:.55"/><circle cx="43" cy="45" r="6" style="fill:var(--Kopuk);opacity:.25"/>'
      : '<path d="M47 63C35 54.5 32.5 45.5 39 41.2c4-2.6 7.2-.4 8 2.6.8-3 4-5.2 8-2.6 6.5 4.3 4 13.3-8 21.8z" style="fill:var(--Kopuk)"/>'
        + '<path d="M47 44v15" style="stroke:var(--Kopuk);stroke-width:1.6;opacity:.7"/>';
    this.style.display = 'block';
    this.innerHTML = `
      <svg width="${boyut}" height="${boyut}" viewBox="0 0 100 100" style="display:block">
        <circle cx="50" cy="52" r="47" style="fill:var(--Tabak)"/>
        <rect x="76" y="44" width="21" height="13" rx="6.5" style="fill:var(--FincanKenar)"/>
        <circle cx="47" cy="50" r="34" style="fill:var(--FincanKenar)"/>
        <circle cx="47" cy="50" r="28" style="fill:var(${renk})"/>
        ${ust}
      </svg>`;
  }
});
