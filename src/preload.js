// Arayüzün ana süreçle konuştuğu tek kapı. Arayüz Node'a doğrudan erişmez.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dt', {
  projeler: () => ipcRenderer.invoke('projeler'),
  projeOku: id => ipcRenderer.invoke('proje-oku', id),
  projeEkle: () => ipcRenderer.invoke('proje-ekle'),
  yeniProje: ad => ipcRenderer.invoke('yeni-proje', ad),
  projeKaldir: id => ipcRenderer.invoke('proje-kaldir', id),
  akisKaydet: (id, dosya, veri) => ipcRenderer.invoke('akis-kaydet', { id, dosya, veri }),
  ekranPng: (id, ekranId, olcek, secim) => ipcRenderer.invoke('ekran-png', { id, ekranId, olcek, secim }),
  ekranlarZip: (id, olcek, secim) => ipcRenderer.invoke('ekranlar-zip', { id, olcek, secim }),
  akisPng: (id, akisId, olcek, secim) => ipcRenderer.invoke('akis-png', { id, akisId, olcek, secim }),
  projeZip: (id, pngDahil, secim) => ipcRenderer.invoke('proje-zip', { id, pngDahil, secim }),
  goster: (id, dosya, tam) => ipcRenderer.invoke('goster', { id, dosya, tam }),
  degisince: cb => ipcRenderer.on('degisti', (_e, v) => cb(v)),
});
