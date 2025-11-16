self.addEventListener('install', e => {
  console.log('Service Worker Installed');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('Service Worker Activated');
});

self.addEventListener('fetch', e => {
  // Biar sederhana: tidak caching otomatis.
  // Kamu bisa menambahkan logic caching di sini jika mau.
});
