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
