import type { Metadata, Viewport } from "next";
import { boardEnabled } from "@/lib/community-board";
import { readState } from "@/lib/store";
import { Noto_Color_Emoji, Noto_Sans_Hebrew, Secular_One } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const secularOne = Secular_One({
  subsets: ["latin", "hebrew"],
  weight: "400",
  variable: "--font-secular",
});

const notoHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew", "latin"],
  weight: "400",
  variable: "--font-noto-hebrew",
});

const notoEmoji = Noto_Color_Emoji({
  subsets: ["emoji"],
  weight: "400",
  variable: "--font-emoji",
  adjustFontFallback: false,
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  let description = "חבורה של חברים — לימוד, חברות וצ׳אט";
  try {
    if (boardEnabled(await readState())) description = "חבורה של חברים — לימוד וחברות";
  } catch {
    // The regular description stays in place when the store is unavailable.
  }
  return {
    title: "מיין חברה",
    description,
    applicationName: "מיין חברה",
    appleWebApp: {
      capable: true,
      title: "מיין חברה",
      statusBarStyle: "default",
    },
    icons: {
      icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#f3f4f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${secularOne.variable} ${notoHebrew.variable} ${notoEmoji.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background font-sans font-normal text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <TooltipProvider>
            {children}
            <Toaster dir="rtl" position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
