import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Não precisamos mais do 'headers'
// import { headers } from "next/headers"; 

import Navbar from "@/components/Navbar"; // Mantemos o Navbar
// import NotificationManager from "@/components/NotificationManager"; // REMOVIDO
// import ErrorBoundary from "@/components/ErrorBoundary"; // REMOVIDO

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PvB Stock Tracker",
  description: "Monitoramento em tempo real do estoque do Plants vs Brainrots",
};

// Removemos 'async'
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode; 
}>) {
  
  // Removemos a detecção de user-agent
  // const userAgent = (await headers()).get("user-agent") || "";
  // const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {/* <ErrorBoundary> // REMOVIDO */}
          <Navbar />
          {/* <NotificationManager /> // REMOVIDO */}
          <main>{children}</main>
        {/* </ErrorBoundary> */}
      </body>
    </html>
  );
}