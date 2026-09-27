const KEY = "chevra-notify";

export function notificationsEnabled() {
  return localStorage.getItem(KEY) === "1";
}

export function setNotificationsEnabled(on: boolean) {
  localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new Event("chevra-notify"));
}

export async function enableNotifications() {
  if (typeof Notification === "undefined") return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/sw.js");
  }
  setNotificationsEnabled(true);
  return true;
}

export async function showChatNotification(options: {
  title: string;
  body: string;
  channelId: string;
  messageId: string;
}) {
  if (!notificationsEnabled() || typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  const data = {
    url: `/chat/${options.channelId}`,
    messageId: options.messageId,
    channelId: options.channelId,
  };
  const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration) {
    try {
      await registration.showNotification(options.title, {
        body: options.body,
        icon: "/icon.png",
        lang: "he",
        dir: "rtl",
        tag: options.messageId,
        data,
        actions: [{ action: "reply", title: "השב" }],
      } as NotificationOptions);
      return;
    } catch {
      /* fall through to a plain notification */
    }
  }
  const note = new Notification(options.title, {
    body: options.body,
    icon: "/icon.png",
    lang: "he",
    dir: "rtl",
    tag: options.messageId,
  });
  note.onclick = () => {
    window.focus();
    sessionStorage.setItem("chevra-reply", options.messageId);
    window.location.assign(data.url);
  };
}
