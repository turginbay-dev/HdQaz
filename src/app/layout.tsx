import type { Metadata } from "next";
import { Suspense } from "react";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { SiteShell } from "@/components/layout/site-shell";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: "variable",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: true
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: "variable",
  display: "swap",
  fallback: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: true
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hdqaz.online"),
  title: {
    default: "HdQaz",
    template: "%s | HdQaz"
  },
  description: "Қазақша дыбыстама және жаңа релиздер қазақша субтитрмен.",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-48x48.png", type: "image/png", sizes: "48x48" }
    ],
    shortcut: [{ url: "/favicon-48x48.png", type: "image/png", sizes: "48x48" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="kk" className={`${manrope.variable} ${unbounded.variable}`}>
      <body>
        <Suspense fallback={<AppLoadingScreen />}>
          <SiteShell>{children}</SiteShell>
        </Suspense>
      </body>
    </html>
  );
}
