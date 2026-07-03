import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type BlocoConteudo = { type?: string; text?: string };

// Extrai o texto exibível de um turno persistido. Turnos que são só
// tool_result (idas-e-voltas internas do agente) não viram bolha no chat.
function textoExibivel(contentJson: string): string | null {
  let blocos: unknown;
  try { blocos = JSON.parse(contentJson); } catch { return null; }
  if (typeof blocos === "string") return blocos.trim() || null;
  if (!Array.isArray(blocos)) return null;
  if ((blocos as BlocoConteudo[]).some((b) => b?.type === "tool_result")) return null;
  const texto = (blocos as BlocoConteudo[])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();
  return texto || null;
}

// Carrega a última sessão (criando uma se não existir nenhuma) com o
// histórico já filtrado para exibição no chat.
export async function GET() {
  let sessao = await db.cerebroSession.findFirst({ orderBy: { atualizadoEm: "desc" } });
  if (!sessao) sessao = await db.cerebroSession.create({ data: {} });

  const linhas = await db.cerebroMessage.findMany({
    where: { sessionId: sessao.id },
    orderBy: { criadoEm: "asc" },
  });

  const mensagens = linhas
    .map((l) => ({ role: l.role as "user" | "assistant", content: textoExibivel(l.content) }))
    .filter((m): m is { role: "user" | "assistant"; content: string } => m.content !== null);

  return NextResponse.json({ sessionId: sessao.id, mensagens });
}

// Cria uma nova sessão (botão "Nova conversa").
export async function POST(_req: NextRequest) {
  const sessao = await db.cerebroSession.create({ data: {} });
  return NextResponse.json({ sessionId: sessao.id, mensagens: [] });
}
