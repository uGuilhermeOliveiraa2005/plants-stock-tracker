import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import Navbar from "@/components/Navbar";
// 1. IMPORTAR O NOVO "CÉREBRO"
import NotificationManager from "@/components/NotificationManager";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PvB Stock Tracker",
  description: "Monitoramento em tempo real do estoque do Plants vs Brainrots",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Navbar />
        {/* 2. ADICIONAR O MANAGER (ele não renderiza nada) */}
        <NotificationManager />
        <main>{children}</main>
      </body>
    </html>
  );
}