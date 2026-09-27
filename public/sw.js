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
