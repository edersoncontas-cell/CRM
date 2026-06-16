import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM New Holland — Vendas Inteligentes",
  description: "CRM pessoal com IA para vendas de máquinas pesadas no sul do ES.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
