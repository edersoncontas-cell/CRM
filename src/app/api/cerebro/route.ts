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
export const maxDuration = 180;

// ── Busca dados completos do CRM para o contexto do Cérebro ──
async function buscarContextoCRM(mensagem: string) {
  // Detectar se a mensagem menciona busca por cliente específico
  const nomeBuscado = extrairNomeCliente(mensagem);

  const [
    totalClientes,
    totalNegs,
    negsGanhas,
    negsPerdidas,
    audits,
    ultimosClientes,
    negsAbertas,
  ] = await Promise.all([
    db.cliente.count(),
    db.negociacao.count({ where: { status: "aberta" } }),
    db.negociacao.count({ where: { status: "ganha" } }),
    db.negociacao.count({ where: { status: "perdida" } }),
    db.auditLog.findMany({
      orderBy: { criadoEm: "desc" },
      take: 20,
      select: { acao: true, descricao: true, criadoEm: true, origem: true },
    }),
    db.cliente.findMany({
      orderBy: { criadoEm: "desc" },
      take: 10,
      select: { id: true, nome: true, telefone: true, status: true, municipio: { select: { nome: true } } },
    }),
    db.negociacao.findMany({
      where: { status: "aberta" },
      orderBy: { ultimoContato: "desc" },
      take: 10,
      include: { cliente: { select: { nome: true } } },
      select: {
        id: true,
        maquinaModelo: true,
        valor: true,
        estagio: true,
        termometro: true,
        ultimoContato: true,
        cliente: { select: { nome: true } },
      } as any,
    }),
  ]);

  // Busca cliente específico se mencionado
  let clienteEspecifico: {
    id: string;
    nome: string;
    telefone: string | null;
    status: string | null;
    resumoTexto?: string | null;
    perfilIA?: string | null;
    municipio?: { nome: string } | null;
    negociacoes?: { maquinaModelo: string | null; valor: number | null; status: string; estagio: string }[];
    conversas?: { id: string; previa: string; lastMessageAt: Date; mensagens?: { direction: string; body: string; sentAt: Date }[] }[];
  } | null = null;

  if (nomeBuscado) {
    const c = await db.cliente.findFirst({
      where: { nome: { contains: nomeBuscado, mode: "insensitive" } },
      include: {
        municipio: { select: { nome: true } },
        negociacoes: {
          where: { status: "aberta" },
          select: { maquinaModelo: true, valor: true, status: true, estagio: true },
        },
        conversas: {
          take: 1,
          select: {
            id: true,
            previa: true,
            lastMessageAt: true,
          },
        } as any,
      } as any,
    }) as any;

    if (c) {
      clienteEspecifico = c;
      // Buscar mensagens da conversa WA
      if (c.conversas?.length > 0) {
        const convId = c.conversas[0].id;
        const msgs = await db.whatsAppMessage.findMany({
          where: { conversationId: convId },
          orderBy: { sentAt: "desc" },
          take: 50,
          select: { direction: true, body: true, sentAt: true },
        });
        if (clienteEspecifico && clienteEspecifico.conversas) {
          clienteEspecifico.conversas[0].mensagens = msgs.reverse() as any;
        }
      }
    }
  }

  return {
    totalClientes,
    totalNegs,
    negsGanhas,
    negsPerdidas,
    audits,
    ultimosClientes,
    negsAbertas: negsAbertas as any[],
    clienteEspecifico,
    nomeBuscado,
  };
}

// Extrai nome de cliente mencionado na mensagem
function extrairNomeCliente(mensagem: string): string | null {
  const lower = mensagem.toLowerCase();
  // Padrões comuns: "conversa do X", "dados do X", "cliente X", "sobre o X", "ver o X"
  const padroes = [
    /(?:conversa|mensagens?|whatsapp|chat|histórico|dados|resumo|cadastro|cliente)s+(?:d[aoe]s?s+)?([A-ZÀ-Ú][a-zà-ú]+(?:s+[A-ZÀ-Ú]?[a-zà-ú]+){0,3})/,
    /(?:sobre|do|da|de|para|pro|pra)s+(?:clientes+)?([A-ZÀ-Ú][a-zà-ú]+(?:s+[A-ZÀ-Ú]?[a-zà-ú]+){0,3})/,
    /^([A-ZÀ-Ú][a-zà-ú]+(?:s+[A-ZÀ-Ú]?[a-zà-ú]+){1,3})$/,
  ];
  for (const p of padroes) {
    const m = mensagem.match(p);
    if (m?.[1] && m[1].length > 2) return m[1].trim();
  }
  return null;
}

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
          arquivos.push({ base64: "", mediaType: f.type, nome: f.name, texto: `[Arquivo ${f.name} — ${Math.round(buf.length/1024)}KB]` });
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

    // ── Busca contexto completo do CRM (inclui WhatsApp se mencionado) ──
    const ctx = await buscarContextoCRM(mensagem);
    const academiaSummary = resumoAcademia();

    // Extrai a última pergunta do Cérebro para interpretar respostas curtas
    const ultimaMsgAssistente = historico.filter(h => h.role === "assistant").slice(-1)[0]?.content ?? "";

    // ── Monta seção de cliente específico com histórico WA ──
    let secaoClienteEspecifico = "";
    if (ctx.clienteEspecifico) {
      const c = ctx.clienteEspecifico;
      secaoClienteEspecifico = `
## CLIENTE ENCONTRADO: ${c.nome}
- **Telefone:** ${c.telefone ?? "não cadastrado"}
- **Status:** ${c.status ?? "potencial"}
- **Município:** ${c.municipio?.nome ?? "não cadastrado"}
- **Resumo IA:** ${(c as any).resumoTexto ?? (c as any).perfilIA ?? "sem resumo ainda"}
${c.negociacoes?.length ? `- **Negociações abertas:** ${c.negociacoes.map((n: any) => `${n.maquinaModelo ?? "?"} (${n.estagio})`).join(", ")}` : "- Sem negociações abertas"}
${c.conversas?.length ? `
### Conversa no WhatsApp (últimas ${c.conversas[0].mensagens?.length ?? 0} mensagens):
${c.conversas[0].mensagens?.map((m: any) => {
  const hora = new Date(m.sentAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `[${hora}] ${m.direction === "OUT" ? "Ederson" : c.nome}: ${m.body}`;
}).join("\n") ?? "Sem mensagens"}
` : "- Sem conversa no WhatsApp cadastrada"}
`;
    }

    // ── Formata negociações abertas ──
    const negsStr = ctx.negsAbertas.length > 0
      ? ctx.negsAbertas.map((n: any) =>
          `- ${n.cliente?.nome ?? "?"}: ${n.maquinaModelo ?? "?"} | R$ ${n.valor?.toLocaleString("pt-BR") ?? "?"} | ${n.estagio}`
        ).join("\n")
      : "Nenhuma negociação aberta";

    const systemPrompt = `Você é o **Cérebro** — assistente de IA do CRM do Ederson, vendedor de máquinas pesadas New Holland e Dynapac no sul do Espírito Santo, Brasil.

Você tem o MESMO nível de inteligência, capacidade de raciocínio e qualidade de resposta que o Claude (Anthropic). Você é o melhor assistente possível para Ederson.

## ══ REGRAS ABSOLUTAS DE CONTEXTO ══

1. **MEMÓRIA PERFEITA:** Você lembra de TUDO que foi dito nesta conversa. Nunca peça para repetir.
2. **RESPOSTAS CURTAS TÊM CONTEXTO:** "sim", "não", "ok", "quero", "pode", "claro" → você SABE o que significa baseado na sua última mensagem. EXECUTE imediatamente. NUNCA pergunte "pode ser mais específico?".
3. **VOCÊ PERGUNTOU, ELE RESPONDEU:** Se você propôs algo e o usuário confirmou → aja. Sem perguntas extras.
4. **ANTECIPE:** Conecte informações, ofereça insights que o usuário não pediu mas precisa.
5. **ACESSO TOTAL AO CRM:** Você VÊ os dados dos clientes, negociações, histórico de WhatsApp e auditorias abaixo.

${ultimaMsgAssistente ? `## ► SUA ÚLTIMA MENSAGEM FOI:
"${ultimaMsgAssistente.slice(0, 600)}${ultimaMsgAssistente.length > 600 ? "…" : ""}"
(Use isso para interpretar a resposta do usuário corretamente.)
` : ""}

## ══ DADOS DO CRM — ${new Date().toLocaleDateString("pt-BR")} ══

**Visão geral:**
- Clientes cadastrados: ${ctx.totalClientes}
- Negociações abertas: ${ctx.totalNegs} | Ganhas: ${ctx.negsGanhas} | Perdidas: ${ctx.negsPerdidas}

**Negociações abertas (top 10):**
${negsStr}

**Últimas ações no sistema:**
${ctx.audits.map((a) => `- [${a.origem}] ${a.descricao}`).join("\n")}

${secaoClienteEspecifico}

## ══ CAPACIDADES QUE VOCÊ TEM ══
- **Ler conversas de WhatsApp** de qualquer cliente cadastrado (mencione o nome e eu busco automaticamente)
- **Analisar dados** de clientes, negociações, histórico completo
- **Criar e editar** clientes, negociações via orientação passo a passo
- **Estratégia de vendas** personalizada com base nos dados reais
- **Academia de Vendas:** ${academiaSummary}

## ══ FORMATO DE RESPOSTA ══
- Use português brasileiro, linguagem direta e estratégica
- Use markdown: **negrito**, listas, títulos quando útil
- Seja conciso mas completo. Máximo 600 palavras salvo pedido explícito.
- Ao mostrar conversas do WhatsApp: apresente de forma cronológica e limpa
- Quando o usuário pedir para "ler conversa", "ver mensagens", "histórico" de alguém → você JÁ TEM os dados acima, apresente diretamente`;

    // ── Monta conteúdo da mensagem atual ──
    const content: Anthropic.MessageParam["content"] = [];

    for (const arq of arquivos) {
      if ((MEDIA_TYPES as readonly string[]).includes(arq.mediaType) && arq.base64) {
        content.push({ type: "image", source: { type: "base64", media_type: arq.mediaType as ImageMediaType, data: arq.base64 } });
      }
    }

    const textoArqs = arquivos.filter((a) => a.texto).map((a) => `=== Arquivo: ${a.nome} ===\n${a.texto}`).join("\n\n");
    const nomesNaoProcessados = arquivos.filter((a) => !(MEDIA_TYPES as readonly string[]).includes(a.mediaType) && !a.texto).map((a) => a.nome);
    const textoFinal = [
      nomesNaoProcessados.length ? `[Arquivos recebidos mas não processados: ${nomesNaoProcessados.join(", ")}]\n` : "",
      textoArqs ? textoArqs + "\n\n" : "",
      mensagem,
    ].filter(Boolean).join("") || "(sem texto)";

    content.push({ type: "text", text: textoFinal });

    // ── Histórico com deduplicação e limite ──
    const historicoFiltrado = historico.filter((h) => h.content?.trim()).slice(-120);
    const mensagensHistorico: Anthropic.MessageParam[] = [];
    for (const h of historicoFiltrado) {
      const ultimo = mensagensHistorico[mensagensHistorico.length - 1];
      if (ultimo && ultimo.role === h.role) {
        if (typeof ultimo.content === "string") {
          mensagensHistorico[mensagensHistorico.length - 1] = { ...ultimo, content: ultimo.content + "\n" + h.content };
        }
      } else {
        mensagensHistorico.push({ role: h.role, content: h.content });
      }
    }

    const mensagensCompletas: Anthropic.MessageParam[] = [
      ...mensagensHistorico,
      { role: "user", content },
    ];

    // ── Chama Claude via streaming ──
    const stream = await anthropicClient().messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 8096,
      system: systemPrompt,
      messages: mensagensCompletas,
    });

    registrarAudit({
      acao: "perfil_atualizado",
      origem: "usuario",
      descricao: `Cérebro: "${mensagem.slice(0, 80)}${mensagem.length > 80 ? "…" : ""}"`,
    }).catch(() => {});

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
