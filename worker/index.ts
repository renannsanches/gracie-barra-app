/// <reference lib="webworker" />

export {};

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    sw.registration.showNotification(data.title ?? "Gracie Barra Famalicão", {
      body: data.body ?? "",
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      data: { url: data.url ?? "/" },
    })
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    sw.clients.openWindow(event.notification.data?.url ?? "/")
  );
});
