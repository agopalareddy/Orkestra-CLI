// Orkestra bildirim Service Worker'ı.
// Tek görevi: OS bildirimine (ve aksiyon butonlarına) tıklanınca uygulamayı öne alıp
// hangi aksiyonun seçildiğini uygulamaya postMessage ile iletmek.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  // event.action: aksiyon butonunun id'si; boşsa bildirim gövdesine tıklanmıştır.
  const action = event.action || "open";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      let client = all.find((c) => "focus" in c);
      if (client) {
        await client.focus();
      } else {
        client = await self.clients.openWindow("/");
        // Yeni pencere yüklenirken mesajı alabilmesi için kısa bekleme.
        await new Promise((r) => setTimeout(r, 600));
      }
      if (client) {
        client.postMessage({ type: "orkestra-notification", action, data });
      }
    })()
  );
});
