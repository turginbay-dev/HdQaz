import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";
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
  title: {
    default: "HdQaz",
    template: "%s | HdQaz"
  },
  description: "Қазақша дыбыстама және жаңа релиздер қазақша субтитрмен.",
  icons: {
    icon: [{ url: "/Logo.png", type: "image/png", sizes: "1024x1024" }],
    apple: [{ url: "/Logo.png", type: "image/png", sizes: "1024x1024" }]
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
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
