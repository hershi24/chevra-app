const KEY = "chevra-notify";
const VAPID_KEY = "chevra-vapid";
const LIVE_KEY = "chevra-notify-live";

export function notificationsEnabled() {
  return localStorage.getItem(KEY) === "1";
}

export function setNotificationsEnabled(on: boolean) {
  localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new Event("chevra-notify"));
  if (!on) void disablePush();
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

async function workerRegistration() {
  if (!("serviceWorker" in navigator)) return undefined;
  const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) => {
      window.setTimeout(() => reject(new Error("service worker timeout")), 4000);
    }),
  ]);
  void registration.update().catch(() => undefined);
  return ready;
}

export async function ensurePushSubscription() {
  if (!notificationsEnabled() || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const registration = await workerRegistration();
    if (!registration) return;
    const res = await fetch("/api/push", { cache: "no-store" });
    if (!res.ok) return;
    const { publicKey } = (await res.json()) as { publicKey?: string };
    if (!publicKey) return;
    const previousKey = localStorage.getItem(VAPID_KEY);
    let subscription = await registration.pushManager.getSubscription();
    if (subscription && previousKey && previousKey !== publicKey) {
      await subscription.unsubscribe();
      subscription = null;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    localStorage.setItem(VAPID_KEY, publicKey);
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
  } catch (error) {
    console.error("push subscribe failed", error);
  }
}

async function disablePush() {
  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    const subscription = await registration?.pushManager.getSubscription();
    const endpoint = subscription?.endpoint;
    await subscription?.unsubscribe();
    if (endpoint) {
      await fetch("/api/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    }
  } catch {
    // The in-app switch is already off.
  }
}

export async function enableNotifications() {
  if (typeof Notification === "undefined") return false;
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return false;
  setNotificationsEnabled(true);
  localStorage.setItem(LIVE_KEY, "1");
  await ensurePushSubscription();
  await showChatNotification({
    title: "התראות דלוקות",
    body: "מעכשיו תופיע התראה כשיש הודעה חדשה",
    channelId: "",
    messageId: "chevra-notify-ready",
    openReply: false,
  });
  return true;
}

type WorkerOptions = {
  body: string;
  icon: string;
  badge: string;
  lang: string;
  tag: string;
  renotify: boolean;
  requireInteraction: boolean;
  data: { url: string; messageId: string };
  dir?: NotificationDirection;
  actions?: { action: string; title: string }[];
};

async function showViaWorker(title: string, options: WorkerOptions) {
  try {
    const registration = await workerRegistration();
    if (!registration) return false;
    try {
      await registration.showNotification(title, {
        ...options,
        dir: "rtl",
        actions: [{ action: "reply", title: "השב" }],
      } as NotificationOptions);
    } catch {
      await registration.showNotification(title, options as NotificationOptions);
    }
    return true;
  } catch {
    return false;
  }
}

function showViaPage(title: string, body: string, tag: string, onClick: () => void) {
  const open = (note: Notification) => {
    note.onclick = () => {
      note.close();
      onClick();
    };
  };
  try {
    open(new Notification(title, { body, icon: "/icon.png", lang: "he", tag }));
    return true;
  } catch {
    try {
      open(new Notification(title, { body, tag }));
      return true;
    } catch {
      return false;
    }
  }
}

export async function showChatNotification(options: {
  title: string;
  body: string;
  channelId: string;
  messageId: string;
  openReply?: boolean;
}) {
  if (!notificationsEnabled() || typeof Notification === "undefined" || Notification.permission !== "granted") {
    return false;
  }
  const reply = options.openReply !== false && options.channelId.length > 0;
  const url = reply ? `/chat/${options.channelId}` : "/chat";
  const data = { url, messageId: reply ? options.messageId : "" };
  const open = () => {
    window.focus();
    if (reply) {
      sessionStorage.setItem("chevra-reply", options.messageId);
      window.dispatchEvent(new CustomEvent("chevra-open-reply", { detail: options.messageId }));
    }
    window.location.assign(url);
  };
  const workerOptions: WorkerOptions = {
    body: options.body,
    icon: "/icon.png",
    badge: "/icon.png",
    lang: "he",
    tag: options.messageId,
    renotify: true,
    requireInteraction: true,
    data,
  };
  const hidden = document.visibilityState === "hidden";
  if (!hidden && showViaPage(options.title, options.body, options.messageId, open)) return true;
  const shown = await showViaWorker(options.title, workerOptions);
  if (shown) return true;
  return showViaPage(options.title, options.body, options.messageId, open);
}
