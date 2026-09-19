// Relatório do fim do dia do vendedor: o que aconteceu hoje, com quem, e o
// que ficou em aberto. Só conversas em que houve NEGOCIAÇÃO de verdade
// entram na lista (a regra pura está em relatorio-regra.ts) — conversa
// informal fica de fora, e contato marcado com "*" na agenda nem chega aqui
// (foi bloqueado na sincronização do Google).
//
// Roda pelo cron do fim do dia e pelo botão "Gerar agora" da Central
// Inteligente. Guardado em RelatorioDiario (um por dia) e enviado ao WhatsApp
// do vendedor quando o número do briefing está configurado.

import { db } from "@/lib/db";
import { inicioDoDiaBrasilia } from "@/lib/utils";
import { llmTexto, iaHabilitada } from "@/lib/ai";
import { lerParametros } from "@/lib/parametros";
import { sendText, isEnabled as whatsappHabilitado } from "@/lib/zapi";
import { registrarZeusEvent } from "@/lib/zeus/eventos";
import { papelDaColuna } from "@/lib/pipeline";
import { resumirDia, textoRelatorio, type ConversaDoDia, type ResumoDia } from "@/lib/cerebro/relatorio-regra";

const MAX_CONVERSAS = 120;
const MAX_TEXTO_POR_CONVERSA = 4_000;

export type RelatorioGerado = {
  id: string;
  dia: string;          // ISO do início do dia
  resumo: string;       // texto pronto
  totalConversas: number;
  negociacoes: number;
  novos: number;
  carteira: number;
  enviadoEm: string | null;
  detalhes: DetalhesRelatorio;
};

export type DetalhesRelatorio = {
  negocio: { nome: string; municipio: string | null; novo: boolean; maquina: string | null; financiamento: boolean; mensagens: number; motivo: string; conversaId: string; clienteId: string | null }[];
  posvenda: { nome: string; motivo: string }[];
  informais: number;
  faturadas: { cliente: string; maquina: string | null; valor: number | null }[];
  novasNegociacoes: { cliente: string; maquina: string | null }[];
  visitasRealizadas: { cliente: string; municipio: string | null }[];
  visitasAmanha: { cliente: string; municipio: string | null; hora: string }[];
};

// ── Coleta do dia ───────────────────────────────────────────────────────────
async function conversasDoDia(inicio: Date, fim: Date): Promise<ConversaDoDia[]> {
  const convs = await db.whatsAppConversation.findMany({
    where: { isGroup: false, messages: { some: { sentAt: { gte: inicio, lt: fim }, isDraft: false } } },
    orderBy: { lastMessageAt: "desc" },
    take: MAX_CONVERSAS,
    select: {
      id: true, externalPhone: true, contactName: true, clienteId: true, createdAt: true,
      messages: {
        where: { sentAt: { gte: inicio, lt: fim }, isDraft: false },
        orderBy: { sentAt: "asc" },
        select: { direction: true, body: true, transcript: true },
      },
    },
  });

  const clienteIds = convs.map((c) => c.clienteId).filter((id): id is string => !!id);
  const clientes = clienteIds.length
    ? await db.cliente.findMany({
        where: { id: { in: clienteIds } },
        select: { id: true, nome: true, jaComprou: true, criadoEm: true, municipio: { select: { nome: true } } },
      })
    : [];
  const porId = new Map(clientes.map((c) => [c.id, c]));

  // "Contato novo" = a conversa começou hoje (não existia mensagem antes).
  const anteriores = await db.whatsAppMessage.groupBy({
    by: ["conversationId"],
    where: { conversationId: { in: convs.map((c) => c.id) }, sentAt: { lt: inicio }, isDraft: false },
    _count: { _all: true },
  }).catch(() => [] as { conversationId: string; _count: { _all: number } }[]);
  const temHistorico = new Set(anteriores.filter((a) => a._count._all > 0).map((a) => a.conversationId));

  return convs.map((c) => {
    const cli = c.clienteId ? porId.get(c.clienteId) : null;
    const texto = c.messages
      .map((m) => `${m.direction === "OUT" ? "Vendedor" : "Cliente"}: ${m.transcript || m.body}`)
      .join("\n")
      .slice(0, MAX_TEXTO_POR_CONVERSA);
    return {
      conversaId: c.id,
      clienteId: c.clienteId,
      nome: cli?.nome ?? c.contactName ?? c.externalPhone,
      telefone: c.externalPhone,
      municipio: cli?.municipio?.nome ?? null,
      texto,
      mensagens: c.messages.length,
      recebidas: c.messages.filter((m) => m.direction === "IN").length,
      enviadas: c.messages.filter((m) => m.direction === "OUT").length,
      primeiraVez: !temHistorico.has(c.id),
      jaComprou: cli?.jaComprou ?? false,
    };
  });
}

async function movimentosDoDia(inicio: Date, fim: Date) {
  const amanha = new Date(fim.getTime());
  const depoisDeAmanha = new Date(fim.getTime() + 86_400_000);

  const [colunas, faturadas, novas, visitas, visitasAmanha] = await Promise.all([
    db.colunaFunil.findMany().catch(() => []),
    db.negociacao.findMany({
      where: { faturadoEm: { gte: inicio, lt: fim } },
      select: { maquinaModelo: true, valor: true, cliente: { select: { nome: true } } },
    }),
    db.negociacao.findMany({
      where: { criadoEm: { gte: inicio, lt: fim } },
      select: { maquinaModelo: true, cliente: { select: { nome: true } } },
    }),
    db.visita.findMany({
      where: { data: { gte: inicio, lt: fim } },
      select: { status: true, cliente: { select: { nome: true, municipio: { select: { nome: true } } } } },
    }),
    db.visita.findMany({
      where: { data: { gte: amanha, lt: depoisDeAmanha } },
      orderBy: { data: "asc" },
      select: { data: true, cliente: { select: { nome: true, municipio: { select: { nome: true } } } } },
    }),
  ]);
  // (colunas só é lido para manter o papel das colunas coerente quando
  // precisarmos filtrar o funil no futuro; hoje faturadoEm já resolve.)
  void colunas.map(papelDaColuna);

  return {
    faturadas: faturadas.map((f) => ({ cliente: f.cliente.nome, maquina: f.maquinaModelo, valor: f.valor })),
    novasNegociacoes: novas.map((n) => ({ cliente: n.cliente.nome, maquina: n.maquinaModelo })),
    visitasRealizadas: visitas
      .filter((v) => v.status === "realizada")
      .map((v) => ({ cliente: v.cliente.nome, municipio: v.cliente.municipio?.nome ?? null })),
    visitasAmanha: visitasAmanha.map((v) => ({
      cliente: v.cliente.nome,
      municipio: v.cliente.municipio?.nome ?? null,
      hora: v.data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
    })),
  };
}

// Reescrita opcional pela IA: mesmo conteúdo, com a leitura de um gerente.
// Sem chave de IA (ou se falhar), o texto determinístico já vai inteiro.
async function comentarioDoCerebro(texto: string, resumo: ResumoDia): Promise<string> {
  if (!iaHabilitada() || resumo.negocio.length === 0) return "";
  try {
    const p = await lerParametros();
    const comentario = await llmTexto(
      `Você é o Cérebro do CRM de ${p.nomeVendedor}, vendedor de máquinas pesadas (${p.marcas}) no ${p.regiao}.
Leia o relatório do dia e escreva NO MÁXIMO 3 linhas: o que foi mais importante hoje e qual é a prioridade de amanhã.
Use SOMENTE os dados do relatório, sem inventar nome, valor ou combinado. Sem emojis, sem saudação, direto ao ponto.`,
      texto,
      { maxTokens: 220 },
    );
    return comentario.trim();
  } catch {
    return "";
  }
}

// ── Geração ─────────────────────────────────────────────────────────────────
export async function gerarRelatorioDiario(dia?: Date): Promise<RelatorioGerado> {
  const inicio = inicioDoDiaBrasilia(dia ?? new Date());
  const fim = inicioDoDiaBrasilia(dia ?? new Date(), 1);

  const [conversas, movimentos] = await Promise.all([conversasDoDia(inicio, fim), movimentosDoDia(inicio, fim)]);
  const resumo = resumirDia(conversas);

  const dataBr = inicio.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
  let texto = textoRelatorio({ dia: dataBr, resumo, ...movimentos });
  const comentario = await comentarioDoCerebro(texto, resumo);
  if (comentario) texto = `${texto}\n\nLeitura do Cérebro:\n${comentario}`;

  const detalhes: DetalhesRelatorio = {
    negocio: resumo.negocio.map((c) => ({
      nome: c.nome, municipio: c.municipio, novo: c.primeiraVez, maquina: c.maquina ?? c.categoria,
      financiamento: c.temFinanciamento, mensagens: c.mensagens, motivo: c.motivo,
      conversaId: c.conversaId, clienteId: c.clienteId,
    })),
    posvenda: resumo.posvenda.map((c) => ({ nome: c.nome, motivo: c.motivo })),
    informais: resumo.informais,
    ...movimentos,
  };

  const salvo = await db.relatorioDiario.upsert({
    where: { dia: inicio },
    create: {
      dia: inicio, resumo: texto, dados: JSON.stringify(detalhes),
      totalConversas: resumo.total, negociacoes: resumo.negocio.length, novos: resumo.novos, carteira: resumo.carteira,
    },
    update: {
      resumo: texto, dados: JSON.stringify(detalhes),
      totalConversas: resumo.total, negociacoes: resumo.negocio.length, novos: resumo.novos, carteira: resumo.carteira,
    },
  });

  return {
    id: salvo.id,
    dia: inicio.toISOString(),
    resumo: texto,
    totalConversas: resumo.total,
    negociacoes: resumo.negocio.length,
    novos: resumo.novos,
    carteira: resumo.carteira,
    enviadoEm: salvo.enviadoEm?.toISOString() ?? null,
    detalhes,
  };
}

// Manda o relatório para o WhatsApp do vendedor (número do briefing em
// Configurações › Parâmetros). Não repete o envio do mesmo dia.
export async function enviarRelatorioDiario(relatorio: RelatorioGerado): Promise<{ enviado: boolean; motivo?: string }> {
  const destino = (await lerParametros()).whatsappBriefing;
  if (!destino) return { enviado: false, motivo: "Número do briefing não configurado (Configurações › Parâmetros)." };
  if (!whatsappHabilitado()) return { enviado: false, motivo: "WhatsApp não conectado." };
  if (relatorio.enviadoEm) return { enviado: false, motivo: "Relatório de hoje já foi enviado." };

  try {
    await sendText(destino, relatorio.resumo);
    await db.relatorioDiario.update({ where: { id: relatorio.id }, data: { enviadoEm: new Date() } });
    await registrarZeusEvent({ tipo: "acao", severidade: "baixa", titulo: "Relatório do dia enviado ao vendedor" });
    return { enviado: true };
  } catch (e) {
    await registrarZeusEvent({ tipo: "erro", severidade: "media", titulo: `Falha ao enviar o relatório do dia: ${String(e).slice(0, 150)}` });
    return { enviado: false, motivo: String(e).slice(0, 200) };
  }
}

export async function lerRelatorios(limite = 14): Promise<RelatorioGerado[]> {
  const linhas = await db.relatorioDiario.findMany({ orderBy: { dia: "desc" }, take: limite });
  return linhas.map((l) => ({
    id: l.id,
    dia: l.dia.toISOString(),
    resumo: l.resumo,
    totalConversas: l.totalConversas,
    negociacoes: l.negociacoes,
    novos: l.novos,
    carteira: l.carteira,
    enviadoEm: l.enviadoEm?.toISOString() ?? null,
    detalhes: seguro(l.dados),
  }));
}

function seguro(json: string): DetalhesRelatorio {
  try {
    return JSON.parse(json) as DetalhesRelatorio;
  } catch {
    return { negocio: [], posvenda: [], informais: 0, faturadas: [], novasNegociacoes: [], visitasRealizadas: [], visitasAmanha: [] };
  }
}
