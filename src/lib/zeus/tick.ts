// Coração do ZEUS (Fase 4): sequência determinística de saúde, fila de
// trabalho, higiene de dados, alertas comerciais, auto-reparo e diagnóstico
// de erros repetidos. Chamado pelo cron `zeus-tick` (5 em 5 min) e pelo botão
// "Forçar tick" do painel /zeus — por isso vive numa função só, sem depender
// do contexto HTTP do cron.

import { db } from "@/lib/db";
import { statusConexao } from "@/lib/zapi";
import { lerDiag } from "@/lib/zapi-diag";
import { processarPendentes } from "@/lib/zeus/pipeline";
import { registrarZeusEvent, type TipoZeusEvent, type SeveridadeZeusEvent } from "@/lib/zeus/eventos";
import { zeusAtivo, tocarHeartbeat, ultimoHeartbeat, orcamentoIADisponivel, consumirOrcamentoIA } from "@/lib/zeus/estado";
import { registrarAudit } from "@/lib/audit";
import { enviarPushNotificacao } from "@/lib/push";
import { recalcularLeadScores } from "@/lib/zeus/leadscore";
import { montarContextoCliente, gerarMensagemFollowUp } from "@/lib/zeus/cerebro-resposta";
import { iaHabilitada, llmTexto } from "@/lib/ai";
import { acharOuCriarConversa, inserirMensagem } from "@/lib/whatsapp-store";
import { inicioDoDiaBrasilia } from "@/lib/utils";
import { processarCadenciasVencidas, type ResumoCadencias } from "@/lib/cadencias";
import { calcularRitmoMetas } from "@/lib/metas";
import { garantirDemandaAutomatica } from "@/lib/demandas";
import { listarClientesPosVenda } from "@/lib/actions";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

export type ResumoTick = {
  ok: boolean;
  pausado: boolean;
  health: { eventosNovos: number };
  fila: { processadas: number; erros: number };
  higiene: {
    telefonesNormalizados: number;
    municipiosVinculados: number;
    aguardandoRespostaCorrigido: number;
    duplicadosDetectados: number;
    negociacoesPropostasParaArquivar: number;
  };
  alertas: { criados: number };
  autoReparo: { unconfirmedReconciliados: number; rascunhosDescartados: number };
  diagnostico: { gerados: number };
  leadScore: { atualizados: number };
  followUp: { preparados: number };
  cadencias: ResumoCadencias;
};

// Evita repetir o mesmo evento a cada 5 minutos: só cria um novo se não houver
// um evento igual (mesmo tipo+título) nos últimos `janelaMin` minutos.
async function eventoSeNovo(tipo: TipoZeusEvent, titulo: string, janelaMin: number, severidade?: SeveridadeZeusEvent, detalhe?: Record<string, unknown>): Promise<boolean> {
  const desde = new Date(Date.now() - janelaMin * 60 * 1000);
  const existe = await db.zeusEvent.findFirst({ where: { tipo, titulo, criadoEm: { gte: desde } }, select: { id: true } });
  if (existe) return false;
  await registrarZeusEvent({ tipo, titulo, severidade, detalhe });
  return true;
}

// ── 1. Health checks ────────────────────────────────────────────────────────
async function healthChecks(): Promise<number> {
  let novos = 0;

  const status = await statusConexao().catch(() => null);
  if (status?.configurado && !status.conectado) {
    const criado = await eventoSeNovo("health", "WhatsApp desconectado — escaneie o QR em /conexao", 60, "alta", { erro: status.erro ?? null });
    if (criado) {
      novos++;
      await enviarPushNotificacao({ title: "⚠️ ZEUS", body: "WhatsApp desconectado. Escaneie o QR em /conexao.", url: "/conexao", tag: "zeus-wa-desconectado" }).catch(() => {});
    }
  }

  if (status?.conectado) {
    const diag = await lerDiag().catch(() => null);
    if (diag && diag.totalChamadas > 0 && diag.ultimaChamada) {
      const horasParado = (Date.now() - new Date(diag.ultimaChamada).getTime()) / HORA;
      if (horasParado > 3) {
        if (await eventoSeNovo("health", `Sem mensagens recebidas há ${Math.floor(horasParado)}h`, 180, "baixa")) novos++;
      }
    }
  }

  // Heartbeats dos crons que deveriam rodar com frequência. No modo gratuito
  // todos são disparados pelo agendador externo via /api/cron/tudo a cada
  // ~15 min (ver comentário lá) — a tolerância aqui precisa acompanhar isso,
  // senão o ZEUS alarma "cron parado" o dia inteiro sem motivo.
  const cronsEsperados: { nome: string; minutosEsperados: number }[] = [
    { nome: "zeus-pipeline", minutosEsperados: 15 },
    { nome: "agnes-dispatch", minutosEsperados: 15 },
    { nome: "whatsapp-retry", minutosEsperados: 15 },
  ];
  for (const c of cronsEsperados) {
    const ultimo = await ultimoHeartbeat(c.nome);
    const minutosParado = ultimo ? (Date.now() - ultimo.getTime()) / 60000 : Infinity;
    if (minutosParado > c.minutosEsperados * 4) {
      if (await eventoSeNovo("health", `Cron "${c.nome}" parece parado (sem heartbeat há ${Math.floor(minutosParado)} min)`, 60, "media")) novos++;
    }
  }

  if (!iaHabilitada()) {
    if (await eventoSeNovo("health", "Nenhuma chave de IA configurada — CRM operando em modo heurístico", 1440, "baixa")) novos++;
  }

  return novos;
}

// ── 2. Fila de trabalho (fallback do webhook) ───────────────────────────────
async function filaDeTrabalho(): Promise<{ processadas: number; erros: number }> {
  return processarPendentes(40);
}

// ── 3. Higiene de dados ──────────────────────────────────────────────────────
async function higieneDados() {
  let telefonesNormalizados = 0;
  let municipiosVinculados = 0;
  let aguardandoRespostaCorrigido = 0;
  let duplicadosDetectados = 0;
  let negociacoesPropostasParaArquivar = 0;

  // Telefones mal formatados (normaliza para só dígitos).
  const clientesComTelefone = await db.cliente.findMany({ where: { telefone: { not: null } }, select: { id: true, telefone: true } });
  for (const c of clientesComTelefone) {
    const limpo = (c.telefone ?? "").replace(/\D/g, "");
    if (limpo && limpo !== c.telefone) {
      await db.cliente.update({ where: { id: c.id }, data: { telefone: limpo } });
      telefonesNormalizados++;
    }
  }
  if (telefonesNormalizados > 0) {
    await registrarZeusEvent({ tipo: "fix", titulo: `${telefonesNormalizados} telefone(s) de cliente normalizado(s)`, severidade: "baixa" });
  }

  // Clientes duplicados por telefone (só detecta e alerta — fusão é manual).
  const porTelefone = new Map<string, { id: string; nome: string }[]>();
  for (const c of clientesComTelefone) {
    const chave = (c.telefone ?? "").replace(/\D/g, "").slice(-8);
    if (chave.length < 8) continue;
    const nome = (await db.cliente.findUnique({ where: { id: c.id }, select: { nome: true } }))?.nome ?? "?";
    porTelefone.set(chave, [...(porTelefone.get(chave) ?? []), { id: c.id, nome }]);
  }
  for (const [chave, grupo] of porTelefone) {
    if (grupo.length < 2) continue;
    duplicadosDetectados++;
    await eventoSeNovo(
      "alerta",
      `Possíveis clientes duplicados (telefone terminado em ${chave})`,
      1440,
      "media",
      { clientes: grupo }
    );
  }

  // Conversas duplicadas (defensivo — @@unique(externalPhone) já previne
  // duplicatas novas desde a Fase 1; aqui só pega sobras de dados antigos).
  const gruposConv = await db.whatsAppConversation.groupBy({
    by: ["externalPhone"],
    where: { isGroup: false },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  if (gruposConv.length > 0) {
    await eventoSeNovo(
      "alerta",
      `${gruposConv.length} telefone(s) com conversas de WhatsApp duplicadas`,
      1440,
      "media",
      { detalhe: "Rode scripts/dedupe-whatsapp-conversations.ts --apply para corrigir." }
    );
  }

  // Município detectável nas conversas (heurística por substring — a IA já faz
  // isso via analisarConversaIA no pipeline; aqui é só uma rede de segurança
  // para clientes cujas conversas nunca passaram pela análise de IA).
  const semMunicipio = await db.cliente.findMany({ where: { municipioId: null }, select: { id: true }, take: 30 });
  if (semMunicipio.length > 0) {
    const municipios = await db.municipio.findMany({ select: { id: true, nome: true } });
    for (const c of semMunicipio) {
      const conv = await db.whatsAppConversation.findFirst({
        where: { clienteId: c.id },
        select: { messages: { orderBy: { sentAt: "desc" }, take: 30, select: { body: true } } },
      });
      if (!conv) continue;
      const texto = conv.messages.map((m) => m.body).join(" \n ").toLowerCase();
      const achados = municipios.filter((m) => m.nome.length >= 4 && new RegExp(`\\b${m.nome.toLowerCase()}\\b`).test(texto));
      if (achados.length === 1) {
        await db.cliente.update({ where: { id: c.id }, data: { municipioId: achados[0].id } });
        municipiosVinculados++;
      }
    }
    if (municipiosVinculados > 0) {
      await registrarZeusEvent({ tipo: "fix", titulo: `${municipiosVinculados} cliente(s) com município detectado automaticamente`, severidade: "baixa" });
    }
  }

  // Negociações abertas sem contato há 30+ dias — sugere arquivar (não move sozinho).
  const paradas = await db.negociacao.findMany({
    where: { status: "aberta", OR: [{ ultimoContato: null }, { ultimoContato: { lt: new Date(Date.now() - 30 * DIA) } }] },
    include: { cliente: { select: { nome: true } } },
    take: 50,
  });
  for (const neg of paradas) {
    const criado = await eventoSeNovo(
      "alerta",
      `Negociação de ${neg.cliente.nome} sem contato há 30+ dias — considere arquivar`,
      7 * 24 * 60,
      "baixa",
      { negociacaoId: neg.id, clienteId: neg.clienteId }
    );
    if (criado) negociacoesPropostasParaArquivar++;
  }

  // Cliente.aguardandoResposta "fantasma" — última mensagem já é minha (OUT).
  const aguardando = await db.cliente.findMany({ where: { aguardandoResposta: true }, select: { id: true }, take: 100 });
  for (const c of aguardando) {
    const conv = await db.whatsAppConversation.findFirst({
      where: { clienteId: c.id },
      select: { messages: { orderBy: { sentAt: "desc" }, take: 1, select: { direction: true } } },
      orderBy: { lastMessageAt: "desc" },
    });
    const ultima = conv?.messages[0];
    if (ultima?.direction === "OUT") {
      await db.cliente.update({ where: { id: c.id }, data: { aguardandoResposta: false } });
      aguardandoRespostaCorrigido++;
    }
  }
  if (aguardandoRespostaCorrigido > 0) {
    await registrarZeusEvent({ tipo: "fix", titulo: `${aguardandoRespostaCorrigido} cliente(s) com "aguardando resposta" fantasma corrigido`, severidade: "baixa" });
  }

  return { telefonesNormalizados, municipiosVinculados, aguardandoRespostaCorrigido, duplicadosDetectados, negociacoesPropostasParaArquivar };
}

// ── 4. Alertas comerciais (tabela Alerta) ───────────────────────────────────
async function criarAlertaSeNovo(clienteId: string, tipo: string, mensagem: string, diasDesde: number, severidade: string) {
  const existente = await db.alerta.findFirst({ where: { clienteId, tipo, resolvido: false } });
  if (existente) {
    await db.alerta.update({ where: { id: existente.id }, data: { mensagem, diasDesde, severidade } });
    return false;
  }
  await db.alerta.create({ data: { clienteId, tipo, mensagem, diasDesde, severidade } });
  return true;
}

async function alertasComerciais(): Promise<number> {
  let criados = 0;

  // Cliente esfriando: negociação aberta sem contato há 10+ dias.
  const esfriando = await db.negociacao.findMany({
    where: { status: "aberta", ultimoContato: { lt: new Date(Date.now() - 10 * DIA) } },
    include: { cliente: { select: { nome: true } } },
    take: 50,
  });
  for (const neg of esfriando) {
    const dias = neg.ultimoContato ? Math.floor((Date.now() - neg.ultimoContato.getTime()) / DIA) : 999;
    const severidade = dias >= 30 ? "alta" : dias >= 20 ? "media" : "baixa";
    if (await criarAlertaSeNovo(neg.clienteId, "esfriando", `${neg.cliente.nome} sem contato há ${dias} dias (negociação aberta).`, dias, severidade)) criados++;
  }

  // Visita amanhã.
  const amanha = inicioDoDiaBrasilia(new Date(), 1);
  const depoisDeAmanha = inicioDoDiaBrasilia(new Date(), 2);
  const visitasAmanha = await db.visita.findMany({
    where: { data: { gte: amanha, lt: depoisDeAmanha } },
    include: { cliente: { select: { nome: true } } },
    take: 50,
  });
  for (const v of visitasAmanha) {
    if (await criarAlertaSeNovo(v.clienteId, "visita_amanha", `Visita amanhã com ${v.cliente.nome}${v.observacao ? " — " + v.observacao : ""}.`, 0, "media")) criados++;
  }

  // Concorrente citado recentemente.
  const comConcorrente = await db.negociacao.findMany({
    where: { status: "aberta", concorrenteMencionado: { not: null }, ultimoContato: { gte: new Date(Date.now() - 3 * DIA) } },
    include: { cliente: { select: { nome: true } } },
    take: 50,
  });
  for (const neg of comConcorrente) {
    if (await criarAlertaSeNovo(neg.clienteId, "concorrente", `${neg.cliente.nome} mencionou o concorrente ${neg.concorrenteMencionado}.`, 0, "media")) criados++;
  }

  // Desvio de meta (segunda-feira): atrasado 15%+ em relação ao esperado no
  // ano vira um evento semanal com o ritmo necessário para recuperar.
  try {
    const ritmo = await calcularRitmoMetas();
    if (ritmo.situacao === "atrasado" && ritmo.faltamAno > 0) {
      const criado = await eventoSeNovo(
        "alerta",
        `Meta do ano atrasada: ${ritmo.vendasAno} vendida(s), esperado ${ritmo.esperadoAteHoje.toFixed(1)} até hoje`,
        7 * 24 * 60,
        "media",
        { resumo: ritmo.resumo, faltamAno: ritmo.faltamAno, visitasPorSemana: Math.ceil(ritmo.visitasPorSemanaNecessarias), negociacoesPorSemana: Math.ceil(ritmo.negociacoesPorSemanaNecessarias) }
      );
      if (criado) {
        criados++;
        await enviarPushNotificacao({ title: "🎯 Meta do ano", body: ritmo.resumo, url: "/dashboard", tag: "zeus-meta" }).catch(() => {});
      }
    }
  } catch (e) {
    console.error("[zeus-tick] metas:", e);
  }

  // Pós-venda: marco vencido vira demanda (uma por cliente e marco).
  try {
    const posVenda = await listarClientesPosVenda();
    for (const p of posVenda.filter((x) => x.marcoPendente).slice(0, 40)) {
      const r = await garantirDemandaAutomatica({
        chave: `posvenda:${p.clienteId}:${p.marcoPendente!.tipo}`,
        titulo: `Pós-venda ${p.marcoPendente!.label}: ligar para ${p.nome}${p.maquina ? ` (${p.maquina})` : ""}`,
        descricao: "Perguntar da máquina, horímetro, revisão e se tem alguém para indicar. Registrar o contato na Central de alertas.",
        clienteId: p.clienteId, cidade: p.municipio ?? null, dueDate: new Date(), prioridade: "normal", origem: "posvenda",
      });
      if (r.criada) criados++;
    }
  } catch (e) {
    console.error("[zeus-tick] pós-venda → demandas:", e);
  }

  // Aguardando resposta há mais de 4h.
  const aguardandoHaTempo = await db.cliente.findMany({
    where: { aguardandoResposta: true, ultimoContato: { lt: new Date(Date.now() - 4 * HORA) } },
    select: { id: true, nome: true, ultimoContato: true },
    take: 50,
  });
  for (const c of aguardandoHaTempo) {
    const horas = c.ultimoContato ? Math.floor((Date.now() - c.ultimoContato.getTime()) / HORA) : 999;
    if (await criarAlertaSeNovo(c.id, "aguardando_resposta", `${c.nome} aguarda retorno há ${horas}h no WhatsApp.`, Math.floor(horas / 24), horas >= 24 ? "alta" : "media")) criados++;
  }

  return criados;
}

// ── 5. Auto-reparo ──────────────────────────────────────────────────────────
async function autoReparo() {
  const unconfirmed = await db.whatsAppMessage.updateMany({
    where: { sendStatus: "UNCONFIRMED", sentAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
    data: { sendStatus: "SENT" },
  });
  if (unconfirmed.count > 0) {
    await registrarZeusEvent({ tipo: "fix", titulo: `${unconfirmed.count} mensagem(ns) UNCONFIRMED reconciliada(s) como enviada(s)`, severidade: "baixa" });
  }

  // Rascunhos pendentes há 48h+ sem ação do vendedor — provavelmente perderam
  // o timing; descarta (mesmo efeito do botão "Descartar" em /atendimento).
  const rascunhos = await db.whatsAppMessage.deleteMany({
    where: { isDraft: true, draftStatus: "PENDING", sentAt: { lt: new Date(Date.now() - 48 * HORA) } },
  });
  if (rascunhos.count > 0) {
    await registrarZeusEvent({ tipo: "fix", titulo: `${rascunhos.count} rascunho(s) órfão(s) descartado(s) (48h+ sem revisão)`, severidade: "baixa" });
  }

  return { unconfirmedReconciliados: unconfirmed.count, rascunhosDescartados: rascunhos.count };
}

// ── 6. Lead scoring (Fase 5.1) ──────────────────────────────────────────────
async function leadScoring(): Promise<number> {
  const { atualizados } = await recalcularLeadScores();
  return atualizados;
}

// ── 7. Follow-up automático inteligente (Fase 5.3) ─────────────────────────
// Detecta negociação ABERTA e QUENTE cujo contato esfriou (5-15 dias sem
// contato — antes do alerta "esfriando" de 10+ dias virar cobrança) e prepara
// um RASCUNHO de mensagem de retomada no estilo do vendedor, na fila de
// /atendimento (nunca envia direto — mesmo padrão de segurança do
// enviar_resposta do Cérebro). Cada negociação só gera um rascunho por
// semana (dedup via ZeusEvent) e respeita o orçamento diário de IA.
async function followUpInteligente(): Promise<number> {
  if (!iaHabilitada()) return 0;
  let preparados = 0;

  const candidatas = await db.negociacao.findMany({
    where: {
      status: "aberta",
      termometro: { gte: 55 },
      ultimoContato: { lt: new Date(Date.now() - 5 * DIA), gte: new Date(Date.now() - 15 * DIA) },
    },
    include: { cliente: { select: { id: true, nome: true, telefone: true } } },
    orderBy: { termometro: "desc" },
    take: 20,
  });

  for (const neg of candidatas) {
    if (!neg.cliente.telefone) continue;
    if (!(await orcamentoIADisponivel())) break;

    const conv = await db.whatsAppConversation.findFirst({
      where: { clienteId: neg.cliente.id },
      select: { id: true, contactName: true, externalPhone: true },
    });
    if (!conv) continue; // só faz follow-up de quem já tem conversa de WhatsApp

    const rascunhoExistente = await db.whatsAppMessage.findFirst({
      where: { conversationId: conv.id, isDraft: true, draftStatus: "PENDING" },
      select: { id: true },
    });
    if (rascunhoExistente) continue;

    // Dedup por negociação, sem efeito colateral — só registra o ZeusEvent
    // depois que o rascunho é criado de verdade (uma falha transitória de IA
    // não pode "queimar" a janela de uma semana sem gerar nada).
    const jaPreparado = await db.zeusEvent.findFirst({
      where: {
        tipo: "acao",
        titulo: `Follow-up preparado para ${neg.cliente.nome}`,
        criadoEm: { gte: new Date(Date.now() - 7 * DIA) },
      },
      select: { id: true },
    });
    if (jaPreparado) continue;

    try {
      const [estilo, contextoCliente] = await Promise.all([
        db.estiloDeFala.findFirst(),
        montarContextoCliente({ id: conv.id, contactName: conv.contactName, clienteId: neg.cliente.id, externalPhone: conv.externalPhone }),
      ]);
      const texto = await gerarMensagemFollowUp({ contextoCliente, estilo: estilo?.guia ?? null });
      await consumirOrcamentoIA();
      if (!texto) continue;

      const { conv: convAtual } = await acharOuCriarConversa({ phone: neg.cliente.telefone, lid: null, isGroup: false, contactName: neg.cliente.nome });
      await inserirMensagem(convAtual.id, {
        direction: "OUT", body: texto, origin: "CRM", operatorDisplayName: "Cérebro (rascunho)",
        isDraft: true, draftStatus: "PENDING",
      });
      await registrarZeusEvent({
        tipo: "acao", severidade: "baixa",
        titulo: `Follow-up preparado para ${neg.cliente.nome}`,
        detalhe: { negociacaoId: neg.id, clienteId: neg.cliente.id },
      });
      await registrarAudit({
        acao: "mensagem_enviada", origem: "zeus",
        descricao: `ZEUS preparou um rascunho de follow-up para ${neg.cliente.nome} (negociação esfriando) — aguardando revisão em /atendimento.`,
        entidade: "Negociacao", entidadeId: neg.id, clienteId: neg.cliente.id,
      });
      preparados++;
    } catch (e) {
      console.error("[zeus-tick] follow-up:", e);
    }
  }

  return preparados;
}

// ── 8. Cadências de 7 toques ────────────────────────────────────────────────
// Toques vencidos viram rascunho (WhatsApp) ou alerta (ligação/visita). Ver
// lib/cadencias.ts.
async function cadencias(): Promise<ResumoCadencias> {
  return processarCadenciasVencidas(20);
}

// ── 9. Diagnóstico de erros repetidos ───────────────────────────────────────
function assinaturaErro(titulo: string): string {
  return titulo.replace(/[0-9a-f]{20,}/gi, "<id>").replace(/\d+/g, "<n>").slice(0, 120);
}

async function diagnosticarErros(): Promise<number> {
  if (!iaHabilitada()) return 0;
  if (!(await orcamentoIADisponivel())) return 0;

  const erros = await db.zeusEvent.findMany({
    where: { tipo: "erro", resolvido: false, criadoEm: { gte: new Date(Date.now() - 3 * DIA) } },
    orderBy: { criadoEm: "desc" },
    take: 200,
  });
  if (!erros.length) return 0;

  const grupos = new Map<string, typeof erros>();
  for (const e of erros) {
    const chave = assinaturaErro(e.titulo);
    grupos.set(chave, [...(grupos.get(chave) ?? []), e]);
  }

  let gerados = 0;
  for (const [assinatura, linhas] of grupos) {
    // Desde que registrarZeusEvent passou a unificar erro repetido numa só
    // linha (ocorrencias++), "quantas vezes aconteceu" é a SOMA do contador
    // de cada linha do grupo, não mais a quantidade de linhas.
    const totalOcorrencias = linhas.reduce((s, e) => s + e.ocorrencias, 0);
    if (totalOcorrencias < 3) continue;
    const jaExiste = await db.zeusEvent.findFirst({
      where: { tipo: "fix", titulo: { contains: assinatura.slice(0, 40) }, criadoEm: { gte: new Date(Date.now() - DIA) } },
    });
    if (jaExiste) continue;
    if (!(await orcamentoIADisponivel())) break;

    try {
      const exemplos = linhas.slice(0, 3).map((e) => e.detalhe ?? e.titulo).join("\n---\n");
      const texto = await llmTexto(
        "Você analisa erros de runtime de um CRM Next.js 14 (App Router) + Prisma + Postgres. Aponte, de forma BEM curta (3-5 linhas), o arquivo/módulo provável e a causa provável, para o desenvolvedor colar numa sessão do Claude Code e investigar. Não invente arquivos que não aparecem no contexto.",
        `Erro ocorreu ${totalOcorrencias}x nas últimas 72h:\n${exemplos}`,
        { maxTokens: 400 }
      );
      await consumirOrcamentoIA();
      await registrarZeusEvent({
        tipo: "fix",
        severidade: "media",
        titulo: `Diagnóstico: ${assinatura}`,
        detalhe: { ocorrencias: totalOcorrencias, diagnostico: texto },
      });
      gerados++;
    } catch (e) {
      console.error("[zeus-tick] falha ao diagnosticar erro:", e);
    }
  }
  return gerados;
}

// ── Orquestração ─────────────────────────────────────────────────────────────
export async function executarZeusTick(): Promise<ResumoTick> {
  const ativo = await zeusAtivo();
  if (!ativo) {
    await tocarHeartbeat("zeus-tick");
    return {
      ok: true, pausado: true,
      health: { eventosNovos: 0 }, fila: { processadas: 0, erros: 0 },
      higiene: { telefonesNormalizados: 0, municipiosVinculados: 0, aguardandoRespostaCorrigido: 0, duplicadosDetectados: 0, negociacoesPropostasParaArquivar: 0 },
      alertas: { criados: 0 }, autoReparo: { unconfirmedReconciliados: 0, rascunhosDescartados: 0 }, diagnostico: { gerados: 0 },
      leadScore: { atualizados: 0 }, followUp: { preparados: 0 },
      cadencias: { rascunhos: 0, alertas: 0, encerradas: 0 },
    };
  }

  const eventosNovos = await healthChecks().catch((e) => { console.error("[zeus-tick] health:", e); return 0; });
  const fila = await filaDeTrabalho().catch((e) => { console.error("[zeus-tick] fila:", e); return { processadas: 0, erros: 0 }; });
  const higiene = await higieneDados().catch((e) => {
    console.error("[zeus-tick] higiene:", e);
    return { telefonesNormalizados: 0, municipiosVinculados: 0, aguardandoRespostaCorrigido: 0, duplicadosDetectados: 0, negociacoesPropostasParaArquivar: 0 };
  });
  const alertasCriados = await alertasComerciais().catch((e) => { console.error("[zeus-tick] alertas:", e); return 0; });
  const reparo = await autoReparo().catch((e) => { console.error("[zeus-tick] auto-reparo:", e); return { unconfirmedReconciliados: 0, rascunhosDescartados: 0 }; });
  const leadScoreAtualizados = await leadScoring().catch((e) => { console.error("[zeus-tick] lead scoring:", e); return 0; });
  const followUpPreparados = await followUpInteligente().catch((e) => { console.error("[zeus-tick] follow-up:", e); return 0; });
  const resumoCadencias = await cadencias().catch((e) => { console.error("[zeus-tick] cadências:", e); return { rascunhos: 0, alertas: 0, encerradas: 0 }; });
  const diagnosticados = await diagnosticarErros().catch((e) => { console.error("[zeus-tick] diagnóstico:", e); return 0; });

  await tocarHeartbeat("zeus-tick");

  if (higiene.telefonesNormalizados + higiene.municipiosVinculados + higiene.aguardandoRespostaCorrigido > 0) {
    await registrarAudit({
      acao: "cliente_atualizado", origem: "zeus",
      descricao: `ZEUS corrigiu dados automaticamente: ${higiene.telefonesNormalizados} telefone(s), ${higiene.municipiosVinculados} município(s), ${higiene.aguardandoRespostaCorrigido} status de resposta.`,
    });
  }

  return {
    ok: true, pausado: false,
    health: { eventosNovos },
    fila,
    higiene,
    alertas: { criados: alertasCriados },
    autoReparo: reparo,
    diagnostico: { gerados: diagnosticados },
    leadScore: { atualizados: leadScoreAtualizados },
    followUp: { preparados: followUpPreparados },
    cadencias: resumoCadencias,
  };
}
