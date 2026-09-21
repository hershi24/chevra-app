import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "מיין חברה",
    short_name: "מיין חברה",
    description: "חבורה של חברים — לימוד, מפגשים וצ׳אט",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f1e8",
    theme_color: "#0f5f59",
    lang: "he",
    dir: "rtl",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
