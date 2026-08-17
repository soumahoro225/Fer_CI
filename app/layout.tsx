import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./citizen.css";
import "./signalements.css";
import "./brand.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
export const metadata: Metadata = {
  title: "Signale CI",
  description: "Plateforme citoyenne de signalement géolocalisé en Côte d’Ivoire.",
  applicationName: "Signale CI",
  icons: { icon: "/logo-signale-ci.svg", apple: "/logo-signale-ci.svg" },
  other: { "codex-preview": "development" },
};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="fr"><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html>; }
