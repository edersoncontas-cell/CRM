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
};

export default nextConfig;
