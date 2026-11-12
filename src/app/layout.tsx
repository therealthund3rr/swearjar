import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// One variable family for everything: condensed + black for display, normal width for text.
// next/font downloads it at build time and self-hosts it (no runtime CDN).
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: "Swear Jar",
  description: "A swear jar that listens. Pay only for what you said. Built on PayPal sandbox.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FFD21F" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
