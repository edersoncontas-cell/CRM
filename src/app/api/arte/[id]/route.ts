import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { CATEGORIAS } from "@/lib/comparativo";

// Gera uma arte promocional (SVG) da máquina — pronta para compartilhar.
// Não depende de serviço externo de imagem.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const m = await db.maquina.findUnique({ where: { id: params.id } });
  if (!m) return new Response("não encontrado", { status: 404 });

  const corA = m.marca === "Dynapac" ? "#b91c1c" : "#164de1";
  const corB = m.marca === "Dynapac" ? "#450a0a" : "#152357";
  const categoria = CATEGORIAS[m.categoria] ?? m.categoria;
  const tagline = (m.pontosFortes ?? m.descricao ?? "Performance e economia para a sua obra.")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").slice(0, 110);
  const specs: string[] = [];
  if (m.pesoOperacional) specs.push(`${(m.pesoOperacional / 1000).toLocaleString("pt-BR")} t`);
  if (m.potencia) specs.push(`${m.potencia} cv`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${corA}"/>
      <stop offset="1" stop-color="${corB}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <circle cx="900" cy="180" r="320" fill="#ffffff" opacity="0.06"/>
  <circle cx="160" cy="950" r="260" fill="#ffffff" opacity="0.06"/>
  <text x="80" y="150" fill="#f5b417" font-family="Arial, sans-serif" font-size="40" font-weight="bold">${m.marca.toUpperCase()}</text>
  <text x="80" y="210" fill="#ffffff" font-family="Arial, sans-serif" font-size="30" opacity="0.85">${categoria}</text>
  <text x="80" y="430" fill="#ffffff" font-family="Arial, sans-serif" font-size="180" font-weight="bold">${m.modelo}</text>
  ${specs.length ? `<text x="80" y="520" fill="#f5b417" font-family="Arial, sans-serif" font-size="56" font-weight="bold">${specs.join("  ·  ")}</text>` : ""}
  <foreignObject x="80" y="600" width="920" height="260">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font-family:Arial,sans-serif;font-size:44px;line-height:1.3;opacity:.95">${tagline}</div>
  </foreignObject>
  <rect x="80" y="930" width="920" height="2" fill="#ffffff" opacity="0.3"/>
  <text x="80" y="1000" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="bold">📲 Fale comigo e peça seu comparativo!</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
