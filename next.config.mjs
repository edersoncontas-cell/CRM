import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    // Next 14 default é 1MB — bloqueava uploads de ficha técnica (PDF/imagem)
    // antes mesmo do código rodar. Vercel ainda limita ~4.5MB por request
    // (ver checagem no client em FichasTecnicasClient.tsx).
    serverActions: { bodySizeLimit: "10mb" },

    // A rota que cria arte com o Gemini lê as fotos das máquinas do disco
    // como referência — na Vercel, "public/" não vai junto da função sem
    // isto.
    outputFileTracingIncludes: {
      "/api/midia/gerar": ["./public/nh-escavadeiras.jpg", "./public/dynapac-rolos.jpg"],
    },

    // Cada rota vira uma função na Vercel e leva junto tudo o que o Next
    // "rastreia" como dependência — hoje são ~80 funções, e o que sobra em
    // disco é o que conta na cota de Armazenamento de Funções. Nada aqui é
    // usado em produção (CLI do Prisma, compiladores, tipos, testes, PDFs de
    // teste que o pdf-parse traz), mas sem a exclusão explícita o rastreador
    // empacota parte disso em TODA função.
    outputFileTracingExcludes: {
      "**/*": [
        "node_modules/@prisma/engines/**",
        "node_modules/prisma/**",
        "node_modules/.prisma/client/*.d.ts",
        "node_modules/typescript/**",
        "node_modules/@swc/**",
        "node_modules/esbuild/**",
        "node_modules/@esbuild/**",
        "node_modules/vitest/**",
        "node_modules/@vitest/**",
        "node_modules/eslint/**",
        "node_modules/eslint-config-next/**",
        "node_modules/@types/**",
        "node_modules/pdf-parse/test/**",
        "node_modules/canvas/**",
        // Só node_modules aqui. O Next casa estes padrões em QUALQUER trecho
        // do caminho ("contains"): "evolution/**" também bateria em
        // src/app/api/webhooks/evolution/ — pastas do repositório que nunca
        // são importadas (tests, docs, evolution, scripts) não precisam
        // constar, o rastreador já não as leva.
      ],
    },
  },
  // O QUE NÃO PODE IR PARA O CELULAR DELE.
  //
  // Dezenas de componentes de tela alcançam lib/db.ts sem querer: importam uma
  // constante de um arquivo que, lá no fundo da corrente, toca o banco. O
  // empacotador então tenta levar o banco (e o AsyncLocalStorage que o
  // isolamento usa) para dentro do JavaScript do navegador — e ali um para o
  // build inteiro e o outro derruba a tela em "Algo deu errado".
  //
  // As duas trocas abaixo valem SÓ para o pacote do navegador (!isServer).
  // Servidor e Edge continuam com o banco e o AsyncLocalStorage de verdade —
  // é lá que o isolamento por vendedor acontece.
  //
  // Troca pelo NOME DO PEDIDO, não por alias de resolução: pedido com esquema
  // ("node:...") nem passa pela resolução do webpack, então alias/fallback não
  // o alcançam — foi o que fez a primeira tentativa continuar quebrando igual.
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      config.plugins.push(
        // 1) O banco. Sem isto, lib/db.ts vai inteiro para o celular dele e a
        //    tela cai em "Algo deu errado" assim que o Prisma é criado lá —
        //    aconteceu com o funil. A versão de navegador é inerte ao ser
        //    importada e estoura com recado claro se alguém tentar consultar.
        new webpack.NormalModuleReplacementPlugin(
          /[\\/]src[\\/]lib[\\/]db\.ts$/,
          path.join(raiz, "src/lib/db-navegador.ts"),
        ),
        // 2) O contexto de quem está usando o CRM. Cinto e suspensório: hoje
        //    só lib/db.ts o alcança, mas basta um import novo para o build
        //    inteiro parar de novo com UnhandledSchemeError.
        new webpack.NormalModuleReplacementPlugin(
          /^node:async_hooks$/,
          path.join(raiz, "src/lib/async-hooks-navegador.ts"),
        ),
      );
    }
    return config;
  },

  // Cabeçalhos de segurança básicos. Sem CSP restritiva de propósito: o app
  // usa scripts inline do Next, tiles de mapa externos e áudio/imagem do
  // WhatsApp — uma CSP mal calibrada derrubaria essas telas em silêncio.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Microfone liberado para o ditado por voz; câmera e localização não são usados.
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
