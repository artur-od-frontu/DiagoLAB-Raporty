import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetBrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "DiagoLAB Raporty+ — Inteligentne raporty pomiarów elektrycznych",
    template: "%s | DiagoLAB Raporty+",
  },
  description:
    "Prześlij wyniki pomiarów instalacji elektrycznej. DiagoLAB Raporty+ przygotuje interaktywne wykresy, analizę wyników, propozycje zaleceń oraz profesjonalny raport PDF.",
  keywords: [
    "pomiary elektryczne",
    "protokół pomiarowy",
    "raport pomiarów",
    "impedancja pętli zwarcia",
    "rezystancja izolacji",
    "DiagoLAB",
  ],
  openGraph: {
    title: "DiagoLAB Raporty+",
    description: "Twoje pomiary. Nasza technologia. Profesjonalny raport.",
    type: "website",
    locale: "pl_PL",
  },
};

export const viewport: Viewport = {
  themeColor: "#04070d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={`${inter.variable} ${spaceGrotesk.variable} ${jetBrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
