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
