"use server";

// Server actions da tela de WhatsApp (Atendimento): contexto lateral da
// conversa (Orientador + cliente + negociação + agenda + cadência) e ações
// rápidas que antes ficavam espalhadas em rotas de API.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizarCoaching, type Coaching } from "@/lib/zeus/orientador-coaching";
import { rotuloPapel, papelDaColuna } from "@/lib/pipeline";
import { registrarAudit } from "@/lib/audit";

export type ContextoConversa = {
  cliente: {
    id: string;
    nome: string;
    municipio: string | null;
    telefone: string | null;
    jaComprou: boolean;
    aguardandoResposta: boolean;
    leadScore: number;
    resumoTexto: string | null;
    proximaVisita: string | null;
    proximaVisitaNota: string | null;
  } | null;
  orientador: {
    estagioVenda: string;
    perfilComprador: string | null;
    objecoes: string[];
    probabilidadeFechamento: number | null;
    probabilidadeExplicacao: string | null;
    temperatura: string;
    proximaAcao: string | null;
    melhorResposta: string | null;
    oportunidadesPerdidas: string[];
    resumoNegociacao: string | null;
    combinados: string[];
    pendencias: string[];
    coaching: Coaching | null;
    atualizadoEm: string;
  } | null;
  // Se já existe um guia de estilo de fala aprendido do vendedor — a "melhor
  // resposta" imita esse jeito real; sem ele, usa um tom padrão até aprender.
  estiloAprendido: boolean;
  negociacoes: { id: string; maquina: string | null; valor: number | null; condicaoPagamento: string | null; estagio: string; papel: string; termometro: number; proximaAcao: string | null; concorrente: string | null }[];
  visitas: { id: string; data: string; observacao: string | null }[];
  cadencia: { id: string; toqueAtual: number; proximoToqueEm: string } | null;
  alertas: { id: string; tipo: string; mensagem: string }[];
};

export async function contextoConversaAction(conversationId: string): Promise<ContextoConversa> {
  const conv = await db.whatsAppConversation.findUnique({ where: { id: conversationId }, select: { clienteId: true } });
  const vazio: ContextoConversa = { cliente: null, orientador: null, negociacoes: [], visitas: [], cadencia: null, alertas: [], estiloAprendido: false };
  if (!conv?.clienteId) return vazio;
  const clienteId = conv.clienteId;

  const [cliente, orientador, negociacoes, visitas, cadencia, alertas, colunas, estilo] = await Promise.all([
    db.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, nome: true, telefone: true, jaComprou: true, aguardandoResposta: true, leadScore: true, resumoTexto: true, proximaVisita: true, proximaVisitaNota: true, municipio: { select: { nome: true } } },
    }),
    db.orientadorAnalise.findUnique({ where: { clienteId } }),
    db.negociacao.findMany({ where: { clienteId, status: "aberta" }, orderBy: { atualizadoEm: "desc" }, take: 3, select: { id: true, maquinaModelo: true, valor: true, condicaoPagamento: true, estagio: true, termometro: true, proximaAcao: true, concorrenteMencionado: true } }),
    db.visita.findMany({ where: { clienteId, data: { gte: new Date(Date.now() - 24 * 3600 * 1000) } }, orderBy: { data: "asc" }, take: 3, select: { id: true, data: true, observacao: true } }),
    db.cadencia.findFirst({ where: { clienteId, ativa: true }, select: { id: true, toqueAtual: true, proximoToqueEm: true } }),
    db.alerta.findMany({ where: { clienteId, resolvido: false }, orderBy: { criadoEm: "desc" }, take: 4, select: { id: true, tipo: true, mensagem: true } }),
    db.colunaFunil.findMany({ select: { titulo: true, papel: true } }),
    db.estiloDeFala.findFirst({ select: { id: true } }),
  ]);
  if (!cliente) return vazio;
  const papelPorTitulo = new Map(colunas.map((c) => [c.titulo, rotuloPapel(papelDaColuna(c))]));

  return {
    cliente: {
      id: cliente.id, nome: cliente.nome, municipio: cliente.municipio?.nome ?? null, telefone: cliente.telefone,
      jaComprou: cliente.jaComprou, aguardandoResposta: cliente.aguardandoResposta, leadScore: cliente.leadScore,
      resumoTexto: cliente.resumoTexto, proximaVisita: cliente.proximaVisita?.toISOString() ?? null, proximaVisitaNota: cliente.proximaVisitaNota,
    },
    orientador: orientador
      ? {
          estagioVenda: orientador.estagioVenda, perfilComprador: orientador.perfilComprador, objecoes: orientador.objecoes,
          probabilidadeFechamento: orientador.probabilidadeFechamento, probabilidadeExplicacao: orientador.probabilidadeExplicacao,
          temperatura: orientador.temperatura, proximaAcao: orientador.proximaAcao, melhorResposta: orientador.melhorResposta,
          oportunidadesPerdidas: orientador.oportunidadesPerdidas, resumoNegociacao: orientador.resumoNegociacao,
          combinados: orientador.combinados ?? [], pendencias: orientador.pendencias ?? [],
          coaching: orientador.coaching ? normalizarCoaching(orientador.coaching) : null,
          atualizadoEm: orientador.atualizadoEm.toISOString(),
        }
      : null,
    negociacoes: negociacoes.map((n) => ({
      id: n.id, maquina: n.maquinaModelo, valor: n.valor, condicaoPagamento: n.condicaoPagamento, estagio: n.estagio, papel: papelPorTitulo.get(n.estagio) ?? "Em negociação",
      termometro: n.termometro, proximaAcao: n.proximaAcao, concorrente: n.concorrenteMencionado,
    })),
    visitas: visitas.map((v) => ({ id: v.id, data: v.data.toISOString(), observacao: v.observacao })),
    cadencia: cadencia ? { id: cadencia.id, toqueAtual: cadencia.toqueAtual, proximoToqueEm: cadencia.proximoToqueEm.toISOString() } : null,
    alertas,
    estiloAprendido: !!estilo,
  };
}

// "Marcar como respondido": assunto concluído, sem pendência — o cliente
// deixa de contar como aguardando e a conversa some das listas/relatórios de
// pendência. Ao chegar mensagem nova (enviada ou recebida), volta sozinho
// (ver inserirMensagem em whatsapp-store.ts).
export async function marcarRespondidoAction(conversationId: string): Promise<{ ok: boolean }> {
  const conv = await db.whatsAppConversation.update({ where: { id: conversationId }, data: { encerrada: true }, select: { clienteId: true } }).catch(() => null);
  if (conv?.clienteId) {
    await db.cliente.update({ where: { id: conv.clienteId }, data: { aguardandoResposta: false } }).catch(() => {});
    await db.alerta.updateMany({ where: { clienteId: conv.clienteId, tipo: "aguardando_resposta", resolvido: false }, data: { resolvido: true } }).catch(() => {});
  }
  revalidatePath("/atendimento");
  revalidatePath("/alertas");
  return { ok: true };
}

// Resolver um alerta a partir do painel lateral.
export async function resolverAlertaConversaAction(alertaId: string): Promise<{ ok: boolean }> {
  await db.alerta.update({ where: { id: alertaId }, data: { resolvido: true } }).catch(() => {});
  revalidatePath("/alertas");
  return { ok: true };
}

// Registra na auditoria que a melhor resposta do Orientador foi usada (mede
// quanto a IA está ajudando de verdade).
export async function registrarUsoRespostaAction(conversationId: string): Promise<void> {
  const conv = await db.whatsAppConversation.findUnique({ where: { id: conversationId }, select: { clienteId: true, contactName: true } });
  await registrarAudit({
    acao: "mensagem_enviada", origem: "usuario",
    descricao: `Melhor resposta do Orientador usada na conversa com ${conv?.contactName ?? "cliente"}.`,
    entidade: "WhatsAppConversation", entidadeId: conversationId, clienteId: conv?.clienteId ?? undefined,
  }).catch(() => {});
}

// ── Respostas prontas ────────────────────────────────────────────────────────
export type RespostaPronta = { id: string; titulo: string; texto: string; ordem: number };

const RESPOSTAS_PADRAO: { titulo: string; texto: string }[] = [
  { titulo: "Pedido de preço", texto: "{nome}, pra te passar o valor certo preciso de 2 coisas: qual a aplicação (obra, lavoura, pedreira) e qual o prazo pra começar a usar. Com isso te mando a condição hoje ainda. Pode me dizer?" },
  { titulo: "Marcar visita", texto: "{nome}, posso passar aí pra ver a aplicação e te levar a proposta pronta. Quinta de manhã ou sexta à tarde, qual fica melhor?" },
  { titulo: "Financiamento", texto: "{nome}, dá pra fazer pelo Finame ou pelo banco da fábrica, com carência e parcela que cabe no que a máquina produz. Se me passar a sua usada e o valor de entrada, simulo agora." },
  { titulo: "Concorrente mais barato", texto: "{nome}, entendo. Preço de nota é uma parte da conta; a outra é custo por hora, revenda e assistência. Me deixa montar a comparação com os seus números e você decide com tudo na mesa. Posso te mandar hoje?" },
  { titulo: "Retomada de contato", texto: "{nome}, aqui é {vendedor}. Passando pra saber se a máquina ainda está no radar pra este ano. Se mudou alguma coisa na obra, me conta que eu ajusto a proposta." },
  { titulo: "Encerramento educado", texto: "{nome}, não quero ser inconveniente. Vou parar por aqui; se em algum momento a máquina virar prioridade, me chama que eu resolvo rápido. Posso te mandar uma novidade a cada 2 meses?" },
];

export async function listarRespostasProntasAction(): Promise<RespostaPronta[]> {
  const total = await db.respostaPronta.count().catch(() => -1);
  if (total === 0) {
    await db.respostaPronta.createMany({ data: RESPOSTAS_PADRAO.map((r, i) => ({ ...r, ordem: i })) }).catch(() => {});
  }
  const lista = await db.respostaPronta.findMany({ orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }] }).catch(() => []);
  return lista.map((r) => ({ id: r.id, titulo: r.titulo, texto: r.texto, ordem: r.ordem }));
}

export async function salvarRespostaProntaAction(dados: { id?: string; titulo: string; texto: string }): Promise<{ ok: boolean; erro?: string }> {
  const titulo = dados.titulo.trim();
  const texto = dados.texto.trim();
  if (!titulo || !texto) return { ok: false, erro: "Título e texto são obrigatórios." };
  if (dados.id) {
    await db.respostaPronta.update({ where: { id: dados.id }, data: { titulo, texto } });
  } else {
    const max = await db.respostaPronta.aggregate({ _max: { ordem: true } });
    await db.respostaPronta.create({ data: { titulo, texto, ordem: (max._max.ordem ?? 0) + 1 } });
  }
  return { ok: true };
}

export async function excluirRespostaProntaAction(id: string): Promise<{ ok: boolean }> {
  await db.respostaPronta.delete({ where: { id } }).catch(() => {});
  return { ok: true };
}

// ── Reanalisar agora ─────────────────────────────────────────────────────────
// Roda o Orientador de Vendas sob demanda para a conversa (painel + melhor
// resposta), sem criar rascunho nem enviar nada. Respeita o orçamento de IA.
export async function reanalisarConversaAction(conversationId: string): Promise<{ ok: boolean; erro?: string }> {
  const { analisarConversaSemResposta } = await import("@/lib/zeus/orientador");
  const r = await analisarConversaSemResposta(conversationId);
  if (r.ok) {
    const conv = await db.whatsAppConversation.findUnique({ where: { id: conversationId }, select: { clienteId: true, contactName: true, externalPhone: true } });
    await registrarAudit({ acao: "conversa_analisada", origem: "usuario", descricao: `Orientador reanalisado a pedido na conversa com ${conv?.contactName ?? conv?.externalPhone ?? "cliente"}.`, entidade: "WhatsAppConversation", entidadeId: conversationId, clienteId: conv?.clienteId ?? undefined }).catch(() => {});
    revalidatePath("/orientador");
  }
  return r;
}
