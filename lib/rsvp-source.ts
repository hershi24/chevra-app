/** Where this browser is running. The installed app opens the site in standalone mode. */
export function rsvpSourceHere(): "app" | "site" {
  if (typeof window === "undefined") return "site";
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const fromApp = document.referrer.startsWith("android-app://");
  return standalone || fromApp ? "app" : "site";
}
