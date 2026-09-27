import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "מיין חברה",
    short_name: "מיין חברה",
    description: "חבורה של חברים — לימוד, חברות וצ׳אט",
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
