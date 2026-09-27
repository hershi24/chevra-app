self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "הודעה חדשה";
  const messageId = payload.messageId || "";
  const url = payload.url || "/chat";
  const options = {
    body: payload.body || "הודעה חדשה",
    icon: "/icon.png",
    badge: "/icon.png",
    lang: "he",
    tag: "chevra-chat",
    renotify: true,
    data: { url, messageId },
  };
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (open.some((client) => client.visibilityState === "visible")) return;
      try {
        await self.registration.showNotification(title, {
          ...options,
          dir: "rtl",
          actions: [{ action: "reply", title: "השב" }],
        });
      } catch {
        await self.registration.showNotification(title, options);
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  const path = data.url || "/chat";
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = all.find((client) => client.url.startsWith(self.location.origin));
      if (open) {
        await open.focus();
        open.postMessage({
          type: "open-chat",
          url: path,
          messageId: data.messageId || "",
        });
        return;
      }
      if (data.messageId) {
        const url = new URL(path, self.location.origin);
        url.searchParams.set("reply", data.messageId);
        await self.clients.openWindow(url.href);
        return;
      }
      await self.clients.openWindow(new URL(path, self.location.origin).href);
    })()
  );
});
