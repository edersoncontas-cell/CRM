import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { registrarAudit } from "@/lib/audit";
import { resumoAcademia } from "@/lib/academia";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof MEDIA_TYPES)[number];

function anthropicClient() {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
    try {
          const ct = req.headers.get("content-type") ?? "";
          let mensagem = "";
          const arquivos: { base64: string; mediaType: string; nome: string; texto?: string }[] = [];

      let historico: { role: "user" | "assistant"; content: string }[] = [];

      if (ct.includes("multipart/form-data")) {
              const fd = await req.formData();
              mensagem = String(fd.get("mensagem") ?? "").trim();
              try {
                        const h = String(fd.get("historico") ?? "[]");
                        historico = JSON.parse(h);
                        if (!Array.isArray(historico)) historico = [];
              } catch { historico = []; }
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
                            const texto = buf.toString("utf-8").substring(0, 8000);
                            arquivos.push({ base64: "", mediaType: f.type, nome: f.name, texto });
                } else if (isPdf || isDoc) {
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

      const academiaSummary = resumoAcademia();

      // Extrai a última pergunta que o Cérebro fez (para entender respostas curtas)
      const ultimaMensagemAssistente = historico.length > 0
            ? historico.filter(h => h.role === "assistant").slice(-1)[0]?.content ?? ""
              : "";

      const contexto = `Você é o **Cérebro** — assistente de IA do CRM do Ederson, vendedor de máquinas pesadas New Holland e Dynapac no sul do Espírito Santo.

      Você é extremamente inteligente e tem plena consciência da conversa atual. Você SEMPRE entende o contexto completo do diálogo — incluindo o que você mesmo perguntou anteriormente — e responde de forma coerente e contínua.

      ## REGRAS CRÍTICAS DE CONTEXTO E CONTINUIDADE:
      1. **Você tem memória perfeita desta conversa.** Nunca peça para o usuário repetir o que já foi dito.
      2. **Respostas curtas têm contexto.** Se o usuário responder "sim", "não", "ok", "quero", "pode ser" ou similar, você DEVE inferir o que ele está respondendo com base na sua última mensagem/pergunta. NUNCA pergunte "Pode ser mais específico?" para respostas claramente afirmativas ou negativas a uma pergunta sua.
      3. **Você perguntou? Então você sabe a resposta.** Se você fez uma pergunta ao usuário e ele respondeu, você usa essa resposta e age imediatamente.
      4. **Seja um sócio estratégico inteligente.** Antecipe necessidades, conecte informações da conversa, dê respostas completas e acionáveis.
      5. **Evite pedir contexto desnecessário.** Se a resposta do usuário é um "sim" a uma opção que você ofereceu, execute essa opção sem pedir mais esclarecimentos.

      ${ultimaMensagemAssistente ? `## SUA ÚLTIMA MENSAGEM PARA O USUÁRIO FOI:
      "${ultimaMensagemAssistente.slice(0, 500)}${ultimaMensagemAssistente.length > 500 ? '...' : ''}"
      Use isso para interpretar corretamente a resposta do usuário.` : ""}

      ## Estado atual do CRM (${new Date().toLocaleDateString("pt-BR")}):
      - **Clientes:** ${totalClientes}
      - **Negociações abertas:** ${totalNegs}
      - **Vendas ganhas:** ${negsGanhas} | **Perdidas:** ${negsPerdidas}

      ## Últimas ações no CRM:
      ${audits.map((a) => `- [${a.origem}] ${a.descricao}`).join("\n")}

      ## Academia de Vendas — conhecimento disponível:
      ${academiaSummary}

      ## CAPACIDADES:
      - Analisar dados do CRM, clientes, negociações e histórico
      - Sugerir estratégias de vendas personalizadas
      - Criar e editar clientes e negociações via instruções
      - Analisar arquivos de texto, imagens e documentos enviados
      - Dar sugestões estratégicas baseadas na Academia de Vendas

      Responda sempre em português brasileiro. Seja direto, prático e estratégico. Quando o usuário confirmar algo que você propôs, execute imediatamente sem pedir mais contexto.`;

      // Monta o conteúdo da mensagem atual
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

      // Monta as mensagens com histórico para contexto multi-turn
      // Mantém até 120 mensagens de histórico (60 turnos)
      const historicoFiltrado = historico
            .filter((h) => h.content?.trim())
            .slice(-120);

      // Garante alternância correta user/assistant (evita erros da API)
      const mensagensHistorico: Anthropic.MessageParam[] = [];
          for (let i = 0; i < historicoFiltrado.length; i++) {
                  const h = historicoFiltrado[i];
                  const ultimo = mensagensHistorico[mensagensHistorico.length - 1];
                  if (ultimo && ultimo.role === h.role) {
                            // Mesmo papel consecutivo: mescla conteúdo
                    if (typeof ultimo.content === "string") {
                                mensagensHistorico[mensagensHistorico.length - 1] = {
                                              ...ultimo,
                                              content: ultimo.content + "\n" + h.content,
                                };
                    }
                  } else {
                            mensagensHistorico.push({ role: h.role, content: h.content });
                  }
          }

      const mensagensCompletas: Anthropic.MessageParam[] = [
              ...mensagensHistorico,
        { role: "user", content },
            ];

      // Chama Claude via streaming
      const stream = await anthropicClient().messages.stream({
              model: "claude-sonnet-4-5",
              max_tokens: 8096,
              system: contexto,
              messages: mensagensCompletas,
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
