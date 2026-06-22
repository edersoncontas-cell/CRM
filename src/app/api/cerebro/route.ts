import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { registrarAudit } from "@/lib/audit";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof MEDIA_TYPES)[number];

function anthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") ?? "";
    let mensagem = "";
    const arquivos: { base64: string; mediaType: string; nome: string; texto?: string }[] = [];

    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      mensagem = String(fd.get("mensagem") ?? "").trim();
      const files = fd.getAll("arquivo") as File[];
      for (const f of files) {
        const buf = Buffer.from(await f.arrayBuffer());
        const isImage = (MEDIA_TYPES as readonly string[]).includes(f.type);
        const isText = f.type.startsWith("text/") || f.name.match(/\.(txt|md|csv|html|json|xml|js|ts|tsx|jsx|py|java|cs|php|rb|go|rs|swift|kt|dart)$/i);
        const isPdf = f.type === "application/pdf";
        const isDoc = f.name.match(/\.(doc|docx|xls|xlsx)$/i);

        if (isImage) {
          arquivos.push({ base64: buf.toString("base64"), mediaType: f.type as ImageMediaType, nome: f.name });
        } else if (isText) {
          // Textos: extrair conteúdo como texto
          const texto = buf.toString("utf-8").substring(0, 8000); // max 8k chars
          arquivos.push({ base64: "", mediaType: f.type, nome: f.name, texto });
        } else if (isPdf || isDoc) {
          // PDFs e Docs: informar nome e tamanho, a IA saberá que recebeu
          arquivos.push({ base64: "", mediaType: f.type, nome: f.name, texto: `[Arquivo ${f.name} — ${Math.round(buf.length/1024)}KB — conteúdo binário não extraído automaticamente]` });
        } else {
          arquivos.push({ base64: "", mediaType: f.type, nome: f.name });
        }
      }
    } else {
      const body = await req.json();
      mensagem = String(body.mensagem ?? "").trim();
    }

    if (!mensagem && arquivos.length === 0) {
      return Response.json({ ok: false, erro: "Mensagem vazia." }, { status: 400 });
    }

    // Contexto do CRM
    const [totalClientes, totalNegs, negsGanhas, negsPerdidas, audits] = await Promise.all([
      db.cliente.count(),
      db.negociacao.count({ where: { status: "aberta" } }),
      db.negociacao.count({ where: { status: "ganha" } }),
      db.negociacao.count({ where: { status: "perdida" } }),
      db.auditLog.findMany({ orderBy: { criadoEm: "desc" }, take: 20, select: { acao: true, descricao: true, criadoEm: true, origem: true } }),
    ]);

    const contexto = `Você é o **Cérebro** do CRM do Ederson — vendedor de máquinas pesadas New Holland e Dynapac no sul do Espírito Santo.
Você tem acesso total ao CRM e pode analisar, sugerir, criar, editar e excluir qualquer coisa.
Comporte-se como um sócio estratégico que quer vencer a todo custo e potencializar as vendas.
Quando receber arquivos de texto (TXT, CSV, MD etc.), leia e analise o conteúdo integralmente.
Quando receber imagens, descreva e analise o que vê.
## Estado atual do CRM (${new Date().toLocaleDateString("pt-BR")}):
- **Clientes:** ${totalClientes}
- **Negociações abertas:** ${totalNegs}
- **Vendas ganhas:** ${negsGanhas} | **Perdidas:** ${negsPerdidas}
## Últimas ações no CRM:
${audits.map((a) => `- [${a.origem}] ${a.descricao}`).join("\n")}
Responda sempre em português. Seja direto, prático e estratégico.`;

    // Monta o conteúdo da mensagem
    const content: Anthropic.MessageParam["content"] = [];

    // Imagens
    for (const arq of arquivos) {
      if ((MEDIA_TYPES as readonly string[]).includes(arq.mediaType) && arq.base64) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: arq.mediaType as ImageMediaType, data: arq.base64 },
        });
      }
    }

    // Textos de arquivos
    const textoArqs = arquivos
      .filter((a) => a.texto)
      .map((a) => `=== Arquivo: ${a.nome} ===\n${a.texto}`)
      .join("\n\n");

    const nomesNaoProcessados = arquivos
      .filter((a) => !(MEDIA_TYPES as readonly string[]).includes(a.mediaType) && !a.texto)
      .map((a) => a.nome);

    const textoFinal = [
      nomesNaoProcessados.length ? `[Arquivos recebidos mas não processados: ${nomesNaoProcessados.join(", ")}]\n` : "",
      textoArqs ? textoArqs + "\n\n" : "",
      mensagem,
    ].filter(Boolean).join("") || "(sem texto)";

    content.push({ type: "text", text: textoFinal });

    // Chama Claude via streaming
    const stream = await anthropicClient().messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: contexto,
      messages: [{ role: "user", content }],
    });

    // Registra auditoria
    registrarAudit({
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
