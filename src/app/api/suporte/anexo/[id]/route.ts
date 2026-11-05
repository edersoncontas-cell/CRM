import { NextResponse } from "next/server";
import { lerAnexo } from "@/lib/suporte";

export const dynamic = "force-dynamic";

// Imagem de um pedido de suporte. Protegida pelo login (middleware).
// ?baixar=1 devolve como arquivo para salvar.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const a = await lerAnexo(params.id);
    if (!a) return NextResponse.json({ erro: "Print não encontrado." }, { status: 404 });
    const baixar = new URL(req.url).searchParams.get("baixar") === "1";
    return new NextResponse(Buffer.from(a.base64, "base64"), {
      headers: {
        "Content-Type": a.mimeType,
        "Cache-Control": "private, max-age=86400",
        ...(baixar ? { "Content-Disposition": `attachment; filename="${a.nome.replace(/"/g, "")}"` } : {}),
      },
    });
  } catch (e) {
    console.error("[suporte/anexo]", e);
    return NextResponse.json({ erro: "Não foi possível abrir o print agora." }, { status: 500 });
  }
}
