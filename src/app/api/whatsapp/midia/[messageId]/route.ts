import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { baixarMidiaEvolution } from "@/lib/zapi";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Proxy de mídia recebida pela Evolution: o navegador pede
// /api/whatsapp/midia/<id da mensagem> e o CRM busca o conteúdo na Evolution
// na hora (nada fica hospedado no CRM). Exige login (middleware).
export async function GET(_req: NextRequest, { params }: { params: { messageId: string } }) {
  const id = decodeURIComponent(params.messageId);
  const msg = await db.whatsAppMessage.findFirst({ where: { zapiMessageId: id }, select: { mediaType: true, mediaName: true } });
  if (!msg) return NextResponse.json({ erro: "Mensagem não encontrada." }, { status: 404 });
  const midia = await baixarMidiaEvolution(id);
  if (!midia) return NextResponse.json({ erro: "Mídia indisponível na Evolution (mensagem antiga ou instância sem banco)." }, { status: 404 });
  const bytes = Buffer.from(midia.base64, "base64");
  const nome = midia.fileName ?? msg.mediaName ?? (msg.mediaType === "image" ? "foto.jpg" : "arquivo");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": midia.mimeType,
      "Content-Disposition": `${msg.mediaType === "document" ? "attachment" : "inline"}; filename="${nome.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
