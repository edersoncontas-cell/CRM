import { NextRequest, NextResponse } from "next/server";
import { guardarMidiaEnvio } from "@/lib/midia-envio";
import { tipoDaMidia, validarAnexo } from "@/lib/mensagem-clientes-regra";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Anexo da mensagem em massa (imagem já comprimida no navegador, vídeo
// curto ou PDF). Rota, e não server action, por causa do tamanho do corpo.
export async function POST(req: NextRequest) {
  const fd = await req.formData().catch(() => null);
  const arquivo = fd?.get("arquivo");
  if (!(arquivo instanceof File)) return NextResponse.json({ ok: false, erro: "Nenhum arquivo enviado." });
  const mime = arquivo.type || "application/octet-stream";
  const problema = validarAnexo(mime, arquivo.size);
  if (problema) return NextResponse.json({ ok: false, erro: problema });
  const tipo = tipoDaMidia(mime)!;
  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
  const nome = arquivo.name || (tipo === "image" ? "imagem.jpg" : tipo === "video" ? "video.mp4" : "documento.pdf");
  const { id } = await guardarMidiaEnvio({ base64, mimeType: mime, nome, tipo, origem: "upload" });
  return NextResponse.json({
    ok: true, id, tipo, nome, mimeType: mime, bytes: arquivo.size,
    preview: tipo === "image" ? `data:${mime};base64,${base64}` : null,
  });
}
