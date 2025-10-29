import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import Navbar from "@/components/Navbar";
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
          <NotificationManager /> 
          <main>{children}</main>
      </body>
    </html>
  );
}