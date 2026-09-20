import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gerarImagem, geracaoDeImagemHabilitada, type Referencia } from "@/lib/ai/imagem";
import { guardarMidiaEnvio } from "@/lib/midia-envio";
import { lerParametros } from "@/lib/parametros";
import { registrarAudit } from "@/lib/audit";
import { BASES_ARTE, DATAS_COMEMORATIVAS, promptArte, type BaseArte, type TipoMensagem } from "@/lib/mensagem-clientes-regra";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Arte para a mensagem, criada pelo Gemini a partir do tipo, do pedido do
// vendedor e (opcional) de uma foto das máquinas como referência.
export async function POST(req: NextRequest) {
  if (!geracaoDeImagemHabilitada()) {
    return NextResponse.json({ ok: false, erro: "Criar arte com IA precisa de GEMINI_API_KEY (grátis) ou OPENAI_API_KEY nas variáveis da Vercel." });
  }
  const b = (await req.json().catch(() => ({}))) as { tipo?: TipoMensagem; instrucoes?: string; dataId?: string; promocao?: string; base?: BaseArte };
  const tipo: TipoMensagem = b.tipo ?? "promocao";
  const base: BaseArte = BASES_ARTE.some((x) => x.id === b.base) ? (b.base as BaseArte) : "escavadeira";
  const p = await lerParametros().catch(() => null);
  const prompt = promptArte({
    tipo, instrucoes: String(b.instrucoes ?? ""), promocao: b.promocao, base,
    data: DATAS_COMEMORATIVAS.find((d) => d.id === b.dataId), marcas: p?.marcas || undefined,
  });

  const referencias: Referencia[] = [];
  const arquivoBase = BASES_ARTE.find((x) => x.id === base)?.arquivo;
  if (arquivoBase) {
    try {
      const buf = await readFile(path.join(process.cwd(), "public", arquivoBase));
      referencias.push({ base64: buf.toString("base64"), mimeType: "image/jpeg" });
    } catch (e) {
      console.error("[midia/gerar] foto de base indisponível:", e instanceof Error ? e.message : e);
    }
  }

  try {
    const img = await gerarImagem(prompt, referencias);
    const ext = img.mimeType.includes("jpeg") ? "jpg" : "png";
    const nome = `arte-${tipo}.${ext}`;
    const { id } = await guardarMidiaEnvio({ base64: img.base64, mimeType: img.mimeType, nome, tipo: "image", origem: "gemini" });
    await registrarAudit({ acao: "post_gerado", origem: "ia", descricao: `Arte criada pelo Gemini (${img.modelo}) para mensagem de ${tipo}.` }).catch(() => {});
    return NextResponse.json({ ok: true, id, tipo: "image", nome, mimeType: img.mimeType, preview: `data:${img.mimeType};base64,${img.base64}`, modelo: img.modelo });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e instanceof Error ? e.message : String(e) });
  }
}
