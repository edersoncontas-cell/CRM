import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { RegistrarSW } from "@/components/RegistrarSW";
import { lerParametros } from "@/lib/parametros";
import { startupImagesIOS } from "@/lib/ios-startup";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const p = await lerParametros().catch(() => null);
  const nome = p?.nomeCrm ?? "CRM DO EDY";
  return {
  title: `${nome} — Vendas Inteligentes`,
  description: `CRM com IA para vendas de máquinas pesadas (${p?.marcas ?? "New Holland · Dynapac"}).`,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: nome,
    statusBarStyle: "black-translucent",
    // Sem isto o iOS abre o app com o ícone grande na tela até carregar.
    startupImage: startupImagesIOS(),
  },
  formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
