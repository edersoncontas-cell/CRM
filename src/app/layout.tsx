import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistrarSW } from "@/components/RegistrarSW";

export const metadata: Metadata = {
  title: "CRM New Holland — Vendas Inteligentes",
  description: "CRM pessoal com IA para vendas de máquinas pesadas no sul do ES.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "CRM Vendas", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#164de1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
