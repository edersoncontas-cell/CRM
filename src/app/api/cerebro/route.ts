import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

import { resumoAcademia } from "@/lib/academia";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof MEDIA_TYPES)[number];

function anthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export const runtime = "nodejs";
export const maxDuration = 180;

// ── Busca dados COMPLETOS do CRM para o contexto do Cérebro ──────────────────
async function buscarContextoCRM(mensagem: string) {
  const nomeBuscado = extrairNomeCliente(mensagem);

  const agora = new Date();
  const inicioDia = new Date(agora); inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(agora); fimDia.setHours(23, 59, 59, 999);
  const inicioSemana = new Date(agora); inicioSemana.setDate(agora.getDate() - agora.getDay());
  inicioSemana.setHours(0, 0, 0, 0);
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioAno = new Date(agora.getFullYear(), 0, 1);

  const [
    totalClientes,
    totalNegs,
    negsGanhas,
    negsPerdidas,
    // Visitas por período
    visitasHoje,
    visitasSemana,
    visitasMes,
    visitasAno,
    // Mensagens WhatsApp recebidas por período (direction "IN" = incoming)
    mensagensHoje,
    mensagensSemana,
    mensagensMes,
    mensagensAno,
    // Vendas ganhas por período
    vendasHoje,
    vendasSemana,
    vendasMes,
    // Negociações abertas completas
    negsAbertas,
    // Últimos clientes cadastrados
    ultimosClientes,
    // Auditoria IA
    auditorias,
    // Agenda próximas visitas
    proximasVisitas,
    // Clientes aguardando resposta
    totalAguardandoResposta,
    // Clientes esquecidos (sem contato 15+ dias)
    clientesEsquecidos,
    // Interesse futuro
    interesseFuturo,
    // Campanhas de marketing por status
    campanhasMarketing,
    // Resumo financeiro anual
    vendasGanhasAno,
  ] = await Promise.all([
    db.cliente.count(),
    db.negociacao.count({ where: { status: "aberta" } }),
    db.negociacao.count({ where: { status: "ganha" } }),
    db.negociacao.count({ where: { status: "perdida" } }),
    // Visitas
    db.visita.count({ where: { data: { gte: inicioDia, lte: fimDia } } }),
    db.visita.count({ where: { data: { gte: inicioSemana } } }),
    db.visita.count({ where: { data: { gte: inicioMes } } }),
    db.visita.count({ where: { data: { gte: inicioAno } } }),
    // WhatsApp messages received (IN = incoming from client)
    db.whatsAppMessage.count({ where: { direction: "IN", sentAt: { gte: inicioDia } } }).catch(() => 0),
    db.whatsAppMessage.count({ where: { direction: "IN", sentAt: { gte: inicioSemana } } }).catch(() => 0),
    db.whatsAppMessage.count({ where: { direction: "IN", sentAt: { gte: inicioMes } } }).catch(() => 0),
    db.whatsAppMessage.count({ where: { direction: "IN", sentAt: { gte: inicioAno } } }).catch(() => 0),
    // Vendas fechadas por período
    db.negociacao.count({ where: { status: "ganha", atualizadoEm: { gte: inicioDia } } }),
    db.negociacao.count({ where: { status: "ganha", atualizadoEm: { gte: inicioSemana } } }),
    db.negociacao.count({ where: { status: "ganha", atualizadoEm: { gte: inicioMes } } }),
    // Negociações abertas com detalhes
    db.negociacao.findMany({
      where: { status: "aberta" },
      include: { cliente: { select: { nome: true, municipio: { select: { nome: true } } } } },
      orderBy: { ultimoContato: "asc" },
      take: 30,
    }),
    // Últimos 15 clientes
    db.cliente.findMany({
      orderBy: { criadoEm: "desc" },
      take: 15,
      select: { id: true, nome: true, telefone: true, status: true, municipio: { select: { nome: true } }, criadoEm: true },
    }),
    // Auditoria
    db.auditLog.findMany({
      orderBy: { criadoEm: "desc" },
      take: 20,
      select: { acao: true, descricao: true, criadoEm: true, origem: true },
    }),
    // Próximas visitas agendadas (30 dias)
    db.cliente.findMany({
      where: {
        proximaVisita: { gte: agora, lte: new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000) },
      },
      select: { nome: true, proximaVisita: true, proximaVisitaNota: true, municipio: { select: { nome: true } } },
      orderBy: { proximaVisita: "asc" },
      take: 20,
    }),
    // Clientes aguardando resposta no WhatsApp
    db.cliente.count({ where: { aguardandoResposta: true } }),
    // Clientes sem contato há 15+ dias com negociação aberta
    db.negociacao.count({
      where: {
        status: "aberta",
        ultimoContato: { lt: new Date(agora.getTime() - 15 * 24 * 60 * 60 * 1000) },
      },
    }),
    // Clientes com interesse futuro
    db.cliente.count({ where: { interesseFuturo: true } }),
    // Campanhas de marketing por status
    db.campanhaMarketing.groupBy({
      by: ["status"],
      _count: true,
    }).catch(() => []),
    // Total de vendas no ano com valor
    db.negociacao.aggregate({
      where: { status: "ganha", atualizadoEm: { gte: inicioAno } },
      _sum: { valor: true },
      _count: true,
    }),
  ]);

  // Busca cliente específico se mencionado
  let clienteEspecifico: {
    id: string;
    nome: string;
    telefone: string | null;
    status: string;
    resumoTexto?: string | null;
    perfilIA?: string | null;
    municipio?: { nome: string } | null;
    negociacoes?: { maquinaModelo: string | null; valor: number | null; status: string; estagio: string }[];
    conversas?: { id: string; conteudo: string; remetente: string; criadoEm: Date }[];
    visitas?: { data: Date; observacao: string | null }[];
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
          orderBy: { criadoEm: "desc" },
          take: 40,
          select: { id: true, conteudo: true, remetente: true, criadoEm: true },
        },
        visitas: {
          orderBy: { data: "desc" },
          take: 10,
          select: { data: true, observacao: true },
        },
      },
    });

    if (c) {
      clienteEspecifico = c as any;
    }
  }

  return {
    totalClientes,
    totalNegs,
    negsGanhas,
    negsPerdidas,
    visitas: { hoje: visitasHoje, semana: visitasSemana, mes: visitasMes, ano: visitasAno },
    mensagens: { hoje: mensagensHoje, semana: mensagensSemana, mes: mensagensMes, ano: mensagensAno },
    vendas: { hoje: vendasHoje, semana: vendasSemana, mes: vendasMes, valorAno: vendasGanhasAno._sum.valor ?? 0, totalAno: vendasGanhasAno._count },
    negsAbertas: negsAbertas as any[],
    ultimosClientes,
    auditorias,
    proximasVisitas,
    totalAguardandoResposta,
    clientesEsquecidos,
    interesseFuturo,
    campanhasMarketing,
    clienteEspecifico,
    nomeBuscado,
  };
}

function extrairNomeCliente(mensagem: string): string | null {
  const padroes = [
    /(?:conversa|dados|cliente|sobre|ver|mostre?|histórico|visitas? d[eo]?|negociação d[eo]?|perfil d[eo]?)\s+(?:do?|da|de)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i,
    /(?:o|a)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s+(?:está|tem|quer|precisa|ligou|mandou)/i,
  ];
  for (const p of padroes) {
    const m = mensagem.match(p);
    if (m?.[1] && m[1].length > 2) return m[1];
  }
  return null;
}

function montarContextoTexto(ctx: Awaited<ReturnType<typeof buscarContextoCRM>>): string {
  const dataHoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  let txt = `=== DADOS DO CRM — ${dataHoje} ===

📊 RESUMO GERAL:
- Total de clientes cadastrados: ${ctx.totalClientes}
- Negociações em andamento: ${ctx.totalNegs}
- Vendas ganhas (histórico total): ${ctx.negsGanhas}
- Negociações perdidas (histórico total): ${ctx.negsPerdidas}

🚗 VISITAS REALIZADAS:
- Hoje: ${ctx.visitas.hoje}
- Esta semana: ${ctx.visitas.semana}
- Este mês: ${ctx.visitas.mes}
- Este ano: ${ctx.visitas.ano}

💬 MENSAGENS RECEBIDAS DE CLIENTES (WhatsApp):
- Hoje: ${ctx.mensagens.hoje}
- Esta semana: ${ctx.mensagens.semana}
- Este mês: ${ctx.mensagens.mes}
- Este ano: ${ctx.mensagens.ano}
- Clientes aguardando resposta agora: ${ctx.totalAguardandoResposta}

🏆 VENDAS FECHADAS:
- Hoje: ${ctx.vendas.hoje} venda(s)
- Esta semana: ${ctx.vendas.semana} venda(s)
- Este mês: ${ctx.vendas.mes} venda(s)
- Este ano: ${ctx.vendas.totalAno} venda(s) | Valor total: R$ ${ctx.vendas.valorAno.toLocaleString("pt-BR")}

⚠️ ALERTAS:
- Leads sem contato há 15+ dias: ${ctx.clientesEsquecidos}
- Clientes com interesse futuro: ${ctx.interesseFuturo}

`;

  if (ctx.proximasVisitas.length > 0) {
    txt += `📅 PRÓXIMAS VISITAS AGENDADAS (30 dias):\n`;
    for (const v of ctx.proximasVisitas) {
      const dataVisita = new Date(v.proximaVisita!).toLocaleDateString("pt-BR");
      txt += ` - ${(v as any).nome} (${(v as any).municipio?.nome ?? "?"}) — ${dataVisita}${v.proximaVisitaNota ? " — " + v.proximaVisitaNota : ""}\n`;
    }
    txt += "\n";
  }

  if (ctx.negsAbertas.length > 0) {
    txt += `🔥 NEGOCIAÇÕES EM ABERTO (top 30):\n`;
    for (const n of ctx.negsAbertas) {
      const cliente = (n as any).cliente?.nome ?? "?";
      const cidade = (n as any).cliente?.municipio?.nome ?? "?";
      const dias = n.ultimoContato ? Math.floor((Date.now() - new Date(n.ultimoContato).getTime()) / 86400000) : "?";
      txt += ` - ${cliente} (${cidade}) | Máquina: ${n.maquinaModelo ?? "?"} | Valor: R$ ${(n.valor ?? 0).toLocaleString("pt-BR")} | Estágio: ${n.estagio} | Termômetro: ${n.termometro}% | Último contato: há ${dias} dias\n`;
    }
    txt += "\n";
  }

  if (ctx.ultimosClientes.length > 0) {
    txt += `👥 ÚLTIMOS CLIENTES CADASTRADOS:\n`;
    for (const c of ctx.ultimosClientes) {
      txt += ` - ${c.nome} | ${(c as any).municipio?.nome ?? "?"} | Status: ${c.status}\n`;
    }
    txt += "\n";
  }

  if (ctx.clienteEspecifico) {
    const ce = ctx.clienteEspecifico;
    txt += `\n🔍 CLIENTE ESPECÍFICO: ${ce.nome}\n`;
    txt += ` Telefone: ${ce.telefone ?? "?"} | Cidade: ${(ce as any).municipio?.nome ?? "?"} | Status: ${ce.status}\n`;
    if (ce.resumoTexto) txt += ` Resumo: ${ce.resumoTexto}\n`;
    if (ce.perfilIA) txt += ` Perfil IA: ${ce.perfilIA}\n`;
    if (ce.negociacoes?.length) {
      txt += ` Negociações abertas: ${ce.negociacoes.map(n => `${n.maquinaModelo ?? "?"} R$${n.valor?.toLocaleString("pt-BR") ?? "?"} (${n.estagio})`).join(", ")}\n`;
    }
    if ((ce as any).visitas?.length) {
      txt += ` Visitas recentes: ${(ce as any).visitas.slice(0,5).map((v: any) => new Date(v.data).toLocaleDateString("pt-BR") + (v.observacao ? ": " + v.observacao : "")).join(" | ")}\n`;
    }
    if (ce.conversas?.length) {
      txt += `\n Conversas recentes (últimas ${Math.min(ce.conversas.length, 30)}):\n`;
      for (const msg of ce.conversas.slice(0, 30)) {
        const hora = new Date(msg.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        const quem = msg.remetente === "vendedor" ? "Você" : "Cliente";
        txt += ` [${hora}] ${quem}: ${msg.conteudo.substring(0, 200)}\n`;
      }
    }
    txt += "\n";
  }

  if (ctx.auditorias.length > 0) {
    txt += `📋 ÚLTIMAS AÇÕES NO CRM:\n`;
    for (const a of ctx.auditorias.slice(0, 10)) {
      const data = new Date(a.criadoEm).toLocaleDateString("pt-BR");
      txt += ` [${data}] ${a.descricao}\n`;
    }
    txt += "\n";
  }

  return txt;
}

// ── System prompt do Cérebro ─────────────────────────────────────────────────
function montarSystemPrompt(ctx: Awaited<ReturnType<typeof buscarContextoCRM>>, academiaTxt: string): string {
  return `Você é o CÉREBRO do CRM de Ederson, vendedor especializado em máquinas pesadas da linha amarela/construção:
- New Holland Construction: escavadeiras (E50, E60, E80, E115C, E145C, E175C, E215C, E265C), retroescavadeiras (B95C, B115C), pás-carregadeiras (W80C, W130C, W170C, W190C), motoniveladoras (RG140.B, RG170.B, RG200.B)
- Dynapac: rolos compactadores (CA2500, CA3500, CA4000, CC2200, CC2800, CC4200), pavimentadoras

Você tem ACESSO TOTAL a todos os dados do CRM. Pode responder qualquer pergunta sobre clientes, negociações, visitas, conversas, vendas, metas, marketing, financeiro, agenda e mais.

CAPACIDADES:
✅ Responder sobre qualquer cliente pelo nome
✅ Mostrar estatísticas de visitas (hoje/semana/mês/ano)
✅ Mostrar contagem de mensagens recebidas de clientes
✅ Analisar pipeline de vendas e oportunidades
✅ Identificar leads esquecidos e urgências
✅ Dar sugestões estratégicas baseadas nos dados reais
✅ Resumir negociações, histórico e próximas ações
✅ Ajudar a escrever mensagens, propostas, roteiros de visita
✅ Analisar documentos/imagens enviados (PDF, foto, contrato)

REGRAS:
- Sempre use os dados reais do CRM que estão no contexto abaixo
- Seja direto e prático — o vendedor está no campo
- Use linguagem informal e motivadora
- Quando mencionar valores, sempre formate em R$ com pontos e vírgulas
- Se não souber algo, diga claramente e sugira como o vendedor pode verificar

${academiaTxt ? "\n📚 ACADEMIA DE VENDAS (resumo):\n" + academiaTxt + "\n" : ""}

--- DADOS ATUAIS DO CRM ---
${montarContextoTexto(ctx)}
--- FIM DOS DADOS ---`;
}

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const mensagem = (fd.get("mensagem") as string) ?? "";
    const historicoRaw = (fd.get("historico") as string) ?? "[]";
    const arquivos: File[] = fd.getAll("arquivo") as File[];

    let historico: { role: "user" | "assistant"; content: string }[] = [];
    try { historico = JSON.parse(historicoRaw); } catch { /* ok */ }
    historico = historico.filter((m) => m.content?.trim()).slice(-120);

    const [ctx, academiaTxt] = await Promise.all([
      buscarContextoCRM(mensagem),
      Promise.resolve(resumoAcademia()).catch(() => ""),
    ]);

    const systemPrompt = montarSystemPrompt(ctx, academiaTxt);

    // Monta mensagens para a API
    const msgs: Anthropic.MessageParam[] = [
      ...historico.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Última mensagem do usuário (pode ter arquivos)
    const contentParts: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = [];

    for (const arquivo of arquivos) {
      const buf = Buffer.from(await arquivo.arrayBuffer());
      const mt = arquivo.type as ImageMediaType;
      if (MEDIA_TYPES.includes(mt as any)) {
        contentParts.push({
          type: "image",
          source: { type: "base64", media_type: mt, data: buf.toString("base64") },
        });
      } else {
        contentParts.push({
          type: "text",
          text: `[Arquivo recebido: ${arquivo.name} (${arquivo.type}, ${(arquivo.size / 1024).toFixed(1)} KB). Analise com base no conteúdo se possível.]`,
        });
      }
    }

    if (mensagem.trim()) {
      contentParts.push({ type: "text", text: mensagem });
    }

    if (contentParts.length === 0) {
      contentParts.push({ type: "text", text: "(mensagem vazia)" });
    }

    msgs.push({ role: "user", content: contentParts });

    // Stream SSE
    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const stream = await anthropicClient().messages.stream({
            model: process.env.ANTHROPIC_MODEL || "claude-opus-4-5",
            max_tokens: 2048,
            system: systemPrompt,
            messages: msgs,
          });

          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
              );
            }
          }


          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ erro: String(e) })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
    return new Response(
      JSON.stringify({ erro: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
