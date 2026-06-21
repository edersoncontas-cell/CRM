import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { registrarAudit } from "@/lib/audit";

function anthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") ?? "";
    let mensagem = "";
    let arquivos: { base64: string; mediaType: string; nome: string }[] = [];

    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      mensagem = String(fd.get("mensagem") ?? "").trim();
      const files = fd.getAll("arquivo") as File[];
      for (const f of files) {
        const buf = Buffer.from(await f.arrayBuffer());
        arquivos.push({ base64: buf.toString("base64"), mediaType: f.type || "application/octet-stream", nome: f.name });
      }
    } else {
      const body = await req.json();
      mensagem = String(body.mensagem ?? "").trim();
    }

    if (!mensagem && arquivos.length === 0) {
      return Response.json({ ok: false, erro: "Mensagem vazia." }, { status: 400 });
    }

    // Contexto do CRM: métricas e dados recentes
    const [totalClientes, totalNegs, negsGanhas, negsPerdidas, proximasVisitas, audits] = await Promise.all([
      db.cliente.count(),
      db.negociacao.count({ where: { status: "aberta" } }),
      db.negociacao.count({ where: { status: "ganha" } }),
      db.negociacao.count({ where: { status: "perdida" } }),
      db.cliente.findMany({
        where: { proximaVisita: { gte: new Date() } } as object,
        select: { nome: true, proximaVisita: true, proximaVisitaNota: true } as object,
        take: 5,
        orderBy: { proximaVisita: "asc" } as object,
      }).catch(() => []),
      db.auditLog.findMany({ orderBy: { criadoEm: "desc" }, take: 20, select: { acao: true, descricao: true, criadoEm: true, origem: true } }),
    ]);

    const contexto = `Você é o **Cérebro** do CRM do Ederson — vendedor de máquinas pesadas New Holland e Dynapac no sul do Espírito Santo.
Você tem acesso total ao CRM e pode analisar, sugerir, criar, editar e excluir qualquer coisa.
Comporte-se como um sócio estratégico que quer vencer a todo custo e potencializar as vendas.

## Estado atual do CRM (${new Date().toLocaleDateString("pt-BR")}):
- **Clientes:** ${totalClientes}
- **Negociações abertas:** ${totalNegs}
- **Vendas ganhas:** ${negsGanhas} | **Perdidas:** ${negsPerdidas}
${proximasVisitas.length > 0 ? `- **Próximas visitas:** ${(proximasVisitas as { nome: string; proximaVisita?: Date | null }[]).map((v) => `${v.nome} (${v.proximaVisita ? new Date(v.proximaVisita).toLocaleDateString("pt-BR") : "sem data"})`).join(", ")}` : ""}

## Últimas ações no CRM:
${audits.map((a) => `- [${a.origem}] ${a.descricao}`).join("\n")}

Responda sempre em português. Seja direto, prático e estratégico. Se precisar executar uma ação real no CRM (criar/editar/excluir), descreva exatamente o que faria e peça confirmação se for destrutivo.`;

    // Monta o conteúdo da mensagem (texto + arquivos)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];
    for (const arq of arquivos) {
      if (arq.mediaType.startsWith("image/")) {
        content.push({ type: "image", source: { type: "base64", media_type: arq.mediaType, data: arq.base64 } });
      } else if (arq.mediaType === "application/pdf") {
        content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: arq.base64 } });
      }
    }
    if (mensagem) content.push({ type: "text", text: mensagem });
    if (content.length === 0) content.push({ type: "text", text: "(sem texto)" });

    // Chama Claude via streaming
    const stream = await anthropicClient().messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: contexto,
      messages: [{ role: "user", content }],
    });

    // Registra auditoria
    await registrarAudit({
      acao: "perfil_atualizado",
      origem: "usuario",
      descricao: `Cérebro: "${mensagem.slice(0, 80)}${mensagem.length > 80 ? "…" : ""}"`,
    }).catch(() => {});

    // Stream SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ erro: String(e) })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}
