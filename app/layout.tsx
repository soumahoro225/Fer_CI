import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./citizen.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
export const metadata: Metadata = { title: "FER SIG Entretien Routier", description: "Pilotage géographique et financier de l’entretien routier en Côte d’Ivoire.", other: { "codex-preview": "development" } };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="fr"><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html>; }
