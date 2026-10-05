import type { MetadataRoute } from "next";
import { boardEnabled } from "@/lib/community-board";
import { readState } from "@/lib/store";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let description = "חבורה של חברים — לימוד, חברות וצ׳אט";
  try {
    if (boardEnabled(await readState())) description = "חבורה של חברים — לימוד וחברות";
  } catch {
    // Keep the regular description when the store is unavailable.
  }
  return {
    name: "מיין חברה",
    short_name: "מיין חברה",
    description,
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#f3f4f6",
    lang: "he",
    dir: "rtl",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
