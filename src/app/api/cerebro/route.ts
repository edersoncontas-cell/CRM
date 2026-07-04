import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { resumoAcademia } from "@/lib/academia";
import { MODEL_CHAT } from "@/lib/ai/config";
import { agoraBrasiliaExtenso } from "@/lib/utils";
import { TOOL_DEFS, executarFerramenta, rotuloFerramenta } from "@/lib/zeus/cerebro-tools";
import { zeusReport } from "@/lib/zeus/eventos";

export const runtime = "nodejs";
export const maxDuration = 180;

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof MEDIA_TYPES)[number];

const MAX_RODADAS_AGENTE = 8; // limite de idas-e-voltas de tool use por pergunta (evita loop infinito)

function anthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ── System prompt honesto: descreve exatamente as tools disponíveis ─────────
async function montarSystemPrompt(): Promise<string> {
  const estilo = await db.estiloDeFala.findFirst().catch(() => null);
  const academiaTxt = resumoAcademia();

  return `Você é o CÉREBRO — agente do CRM de Ederson, vendedor de máquinas pesadas da linha amarela/construção
(New Holland Construction: escavadeiras, retroescavadeiras, pás-carregadeiras, motoniveladoras; Dynapac: rolos
compactadores) no sul do Espírito Santo.

Data/hora atual (Brasília): ${agoraBrasiliaExtenso()}.

## Suas ferramentas (use-as para responder com dados REAIS do CRM — nunca chute ou invente)
Leitura: buscar_cliente, detalhes_cliente, listar_negociacoes, agenda, buscar_maquina, estoque_usadas, metricas_funil, conversas_aguardando.
Escrita: criar_cliente, atualizar_cliente, atualizar_resumo_cliente, criar_negociacao, mover_negociacao, marcar_ganha, marcar_perdida, criar_tarefa, adicionar_visita.
enviar_resposta NÃO manda a mensagem — cria um RASCUNHO em /atendimento para o vendedor revisar e enviar.
excluir_cliente e excluir_negociacao são IRREVERSÍVEIS: se a ferramenta responder requires_confirmation, PARE e pergunte
explicitamente ao vendedor se confirma — só chame de novo com confirmar:true depois que ele disser sim claramente.

## Regras
- Qualquer pergunta sobre dados do CRM (cliente, negociação, agenda, estoque, métricas) deve ser respondida DEPOIS
  de consultar a ferramenta certa — se a tool não achar nada, diga isso, não invente.
- Toda ação de escrita fica registrada na Auditoria do CRM (origem "cerebro") — o vendedor pode conferir depois.
- NUNCA use emojis. Linguagem profissional, direta, sem exclamações excessivas.
- Valores sempre em R$ formatados (pontos e vírgulas).
- Se não souber algo mesmo depois de consultar as ferramentas, diga claramente e sugira como verificar.
- Pode analisar documentos/imagens enviados (PDF, foto, contrato) quando anexados.
${estilo?.guia ? `\n## Estilo de comunicação do Ederson (para textos sugeridos ao cliente)\n${estilo.guia}\n` : ""}
${academiaTxt ? `\n## Academia de vendas (resumo, use quando fizer sentido estratégico)\n${academiaTxt}\n` : ""}`;
}

// ── Persistência do histórico (Fase 3) ───────────────────────────────────────
async function carregarMensagens(sessionId: string): Promise<Anthropic.MessageParam[]> {
  const linhas = await db.cerebroMessage.findMany({ where: { sessionId }, orderBy: { criadoEm: "asc" } });
  return linhas.map((l) => ({ role: l.role === "assistant" ? "assistant" : "user", content: JSON.parse(l.content) }));
}

async function salvarMensagem(sessionId: string, role: "user" | "assistant", content: unknown) {
  await db.cerebroMessage.create({ data: { sessionId, role, content: JSON.stringify(content) } });
  await db.cerebroSession.update({ where: { id: sessionId }, data: { atualizadoEm: new Date() } }).catch(() => {});
}

function ehErroDeTool(result: unknown): boolean {
  return typeof result === "object" && result !== null && "erro" in (result as Record<string, unknown>);
}

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const sessionId = (fd.get("sessionId") as string) ?? "";
    const mensagem = (fd.get("mensagem") as string) ?? "";
    const arquivos: File[] = fd.getAll("arquivo") as File[];
    if (!sessionId) {
      return new Response(JSON.stringify({ erro: "sessionId obrigatório." }), { status: 400 });
    }

    // Monta os content blocks do turno do usuário — dois formatos: um para
    // enviar à Anthropic AGORA (com a imagem real) e outro para persistir no
    // banco (troca a imagem por um texto-placeholder, para não guardar
    // base64 de anexos para sempre no Postgres).
    const contentParaApi: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = [];
    const contentParaSalvar: Anthropic.TextBlockParam[] = [];

    for (const arquivo of arquivos) {
      const buf = Buffer.from(await arquivo.arrayBuffer());
      const mt = arquivo.type as ImageMediaType;
      if ((MEDIA_TYPES as readonly string[]).includes(mt)) {
        contentParaApi.push({ type: "image", source: { type: "base64", media_type: mt, data: buf.toString("base64") } });
        contentParaSalvar.push({ type: "text", text: `[Anexo enviado: ${arquivo.name}]` });
      } else {
        const nota = `[Arquivo recebido: ${arquivo.name} (${arquivo.type}, ${(arquivo.size / 1024).toFixed(1)} KB). Analise com base no conteúdo se possível.]`;
        contentParaApi.push({ type: "text", text: nota });
        contentParaSalvar.push({ type: "text", text: `[Anexo enviado: ${arquivo.name}]` });
      }
    }
    if (mensagem.trim()) {
      contentParaApi.push({ type: "text", text: mensagem });
      contentParaSalvar.push({ type: "text", text: mensagem });
    }
    if (contentParaApi.length === 0) {
      contentParaApi.push({ type: "text", text: "(mensagem vazia)" });
      contentParaSalvar.push({ type: "text", text: "(mensagem vazia)" });
    }

    // Persiste o turno do usuário ANTES de chamar a IA — histórico durável
    // mesmo se o stream falhar no meio.
    await salvarMensagem(sessionId, "user", contentParaSalvar);

    const historico = await carregarMensagens(sessionId);
    // A última linha carregada É o turno que acabamos de salvar (com o
    // placeholder do anexo) — substitui pela versão com a imagem real.
    const messages: Anthropic.MessageParam[] = [...historico.slice(0, -1), { role: "user", content: contentParaApi }];

    const system = await montarSystemPrompt();

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const emit = (payload: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

        try {
          for (let rodada = 0; rodada < MAX_RODADAS_AGENTE; rodada++) {
            const stream = anthropicClient().messages.stream({
              model: MODEL_CHAT,
              max_tokens: 2048,
              system,
              tools: TOOL_DEFS,
              messages,
            });

            for await (const evento of stream) {
              if (evento.type === "content_block_delta" && evento.delta.type === "text_delta") {
                emit({ text: evento.delta.text });
              }
            }

            const finalMessage = await stream.finalMessage();
            messages.push({ role: "assistant", content: finalMessage.content });
            await salvarMensagem(sessionId, "assistant", finalMessage.content);

            if (finalMessage.stop_reason !== "tool_use") break;

            const toolUseBlocks = finalMessage.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
            );
            if (!toolUseBlocks.length) break;

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const bloco of toolUseBlocks) {
              const input = (bloco.input ?? {}) as Record<string, unknown>;
              const label = rotuloFerramenta(bloco.name, input);
              emit({ tool: { name: bloco.name, status: "start", label } });
              const resultado = await executarFerramenta(bloco.name, input);
              emit({ tool: { name: bloco.name, status: "done", label } });
              if (resultado && typeof resultado === "object" && (resultado as Record<string, unknown>).requires_confirmation) {
                emit({ confirm: { mensagem: (resultado as Record<string, unknown>).mensagem ?? "Confirma esta ação?" } });
              }
              toolResults.push({
                type: "tool_result",
                tool_use_id: bloco.id,
                content: JSON.stringify(resultado),
                is_error: ehErroDeTool(resultado),
              });
            }

            messages.push({ role: "user", content: toolResults });
            await salvarMensagem(sessionId, "user", toolResults);
          }

          emit({ done: true });
        } catch (e) {
          emit({ erro: String(e) });
          await zeusReport(e, "loop agêntico do Cérebro (api/cerebro/route.ts)");
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (e) {
    await zeusReport(e, "api/cerebro/route.ts (requisição)");
    return new Response(JSON.stringify({ erro: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
