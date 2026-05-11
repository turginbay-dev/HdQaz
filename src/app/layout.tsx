import type { Metadata } from "next";
import "./globals.css";
import { SiteShell } from "@/components/layout/site-shell";

export const metadata: Metadata = {
  title: {
    default: "HdQaz",
    template: "%s | HdQaz"
  },
  description: "Қазақша дыбыстама және жаңа релиздер қазақша субтитрмен."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="kk">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
