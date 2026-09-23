import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { COOKIE_TEMA, modoValido, corDaBarra } from "@/lib/tema";
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

// A cor da barra tem que seguir o tema: no app instalado é ela que o iOS
// pinta em volta da tela. Fixa em preto, o tema claro ganharia uma tarja
// escura no topo que não combina com nada.
export function generateViewport(): Viewport {
  const modo = modoValido(cookies().get(COOKIE_TEMA)?.value);
  return {
    themeColor: corDaBarra(modo),
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O tema entra no HTML aqui, no servidor. Guardar a escolha no localStorage
  // e aplicar depois faria a página nascer escura e clarear no meio do
  // caminho — o branco que pisca na cara de quem abre o app.
  const modo = modoValido(cookies().get(COOKIE_TEMA)?.value);
  return (
    <html lang="pt-BR" data-theme={modo === "claro" ? "light" : "dark"} className={inter.variable}>
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
