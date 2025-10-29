import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { headers } from "next/headers"; // Importação (correta)

import Navbar from "@/components/Navbar";
import NotificationManager from "@/components/NotificationManager";
// Vamos remover o ErrorBoundary, não precisamos mais dele
// import ErrorBoundary from "@/components/ErrorBoundary"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PvB Stock Tracker",
  description: "Monitoramento em tempo real do estoque do Plants vs Brainrots",
};

// --- CORREÇÃO 1: Adicionado 'async' ---
export default async function RootLayout({
  children,
}: Readonly<{
  // --- CORREÇÃO 2: 'Node' -> 'ReactNode' ---
  children: React.ReactNode; 
}>) {
  
  // DETECÇÃO NO LADO DO SERVIDOR
  // --- CORREÇÃO 3: Adicionado 'await' ---
  const userAgent = (await headers()).get("user-agent") || "";
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {/* <ErrorBoundary> // Removido */}
          <Navbar />
          <NotificationManager isIOS={isIOS} />
          <main>{children}</main>
        {/* </ErrorBoundary> */}
      </body>
    </html>
  );
}