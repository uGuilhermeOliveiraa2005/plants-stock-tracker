import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// import { headers } from "next/headers"; // <<<--- REMOVER ESTA LINHA

import Navbar from "@/components/Navbar";
import NotificationManager from "@/components/NotificationManager";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PvB Stock Tracker",
  description: "Monitoramento em tempo real do estoque do Plants vs Brainrots",
};

// --- REMOVEMOS 'async' ---
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode; 
}>) {
  
  // --- REMOVEMOS A DETECÇÃO DE USER-AGENT ---
  // const userAgent = (await headers()).get("user-agent") || "";
  // const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  return (
    <html lang="pt-BR">
      <body className={inter.className}>
          <Navbar />
          {/* --- REMOVEMOS A PROP isIOS --- */}
          <NotificationManager /> 
          <main>{children}</main>
      </body>
    </html>
  );
}