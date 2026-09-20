"use server";

// Server actions da tela de WhatsApp (Atendimento): contexto lateral da
// conversa (Orientador + cliente + negociação + agenda) e ações
// rápidas que antes ficavam espalhadas em rotas de API.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizarCoaching, type Coaching } from "@/lib/zeus/orientador-coaching";
import { rotuloPapel, papelDaColuna } from "@/lib/pipeline";
import { registrarAudit } from "@/lib/audit";
import { montarContextoAgenda } from "@/lib/zeus/agenda-contexto";
import { lerNotas, acrescentarNota, removerNota, LIMITE_ENTRADA, type NotaVendedor } from "@/lib/orientador-notas";

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
    // Tudo o que o vendedor já contou ao Orientador, em ordem — a caixa
    // limpa a cada salvamento e os contextos se somam.
    notasVendedor: NotaVendedor[];
    atualizadoEm: string;
  } | null;
  // Se já existe um guia de estilo de fala aprendido do vendedor — a "melhor
  // resposta" imita esse jeito real; sem ele, usa um tom padrão até aprender.
  estiloAprendido: boolean;
  // Dia em que o vendedor já estará mais perto da cidade deste cliente (pela
  // agenda de visitas marcadas) — ex.: "terça 22/09 — você já estará em Alegre (≈28 km)".
  sugestaoVisita: string | null;
  negociacoes: { id: string; marca: string | null; maquina: string | null; valor: number | null; tipoPagamento: string | null; condicaoPagamento: string | null; estagio: string; papel: string; termometro: number; proximaAcao: string | null; concorrente: string | null }[];
  visitas: { id: string; data: string; observacao: string | null }[];
  alertas: { id: string; tipo: string; mensagem: string }[];
};

export async function contextoConversaAction(conversationId: string): Promise<ContextoConversa> {
  const conv = await db.whatsAppConversation.findUnique({ where: { id: conversationId }, select: { clienteId: true } });
  const vazio: ContextoConversa = { cliente: null, orientador: null, negociacoes: [], visitas: [], alertas: [], estiloAprendido: false, sugestaoVisita: null };
  if (!conv?.clienteId) return vazio;
  const clienteId = conv.clienteId;

  const [cliente, orientador, negociacoes, visitas, alertas, colunas, estilo, agenda] = await Promise.all([
    db.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, nome: true, telefone: true, jaComprou: true, aguardandoResposta: true, leadScore: true, resumoTexto: true, proximaVisita: true, proximaVisitaNota: true, municipio: { select: { nome: true } } },
    }),
    db.orientadorAnalise.findUnique({ where: { clienteId } }),
    db.negociacao.findMany({ where: { clienteId, status: "aberta" }, orderBy: { atualizadoEm: "desc" }, take: 3, select: { id: true, marca: true, maquinaModelo: true, valor: true, tipoPagamento: true, condicaoPagamento: true, estagio: true, termometro: true, proximaAcao: true, concorrenteMencionado: true } }),
    db.visita.findMany({ where: { clienteId, data: { gte: new Date(Date.now() - 24 * 3600 * 1000) } }, orderBy: { data: "asc" }, take: 3, select: { id: true, data: true, observacao: true } }),
    db.alerta.findMany({ where: { clienteId, resolvido: false }, orderBy: { criadoEm: "desc" }, take: 4, select: { id: true, tipo: true, mensagem: true } }),
    db.colunaFunil.findMany({ select: { titulo: true, papel: true } }),
    db.estiloDeFala.findFirst({ select: { id: true } }),
    montarContextoAgenda(clienteId).catch(() => null),
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
          notasVendedor: lerNotas(orientador.notaVendedor),
          atualizadoEm: orientador.atualizadoEm.toISOString(),
        }
      : null,
    negociacoes: negociacoes.map((n) => ({
      id: n.id, marca: n.marca, maquina: n.maquinaModelo, valor: n.valor, tipoPagamento: n.tipoPagamento, condicaoPagamento: n.condicaoPagamento, estagio: n.estagio, papel: papelPorTitulo.get(n.estagio) ?? "Em negociação",
      termometro: n.termometro, proximaAcao: n.proximaAcao, concorrente: n.concorrenteMencionado,
    })),
    visitas: visitas.map((v) => ({ id: v.id, data: v.data.toISOString(), observacao: v.observacao })),
    alertas,
    estiloAprendido: !!estilo,
    sugestaoVisita: agenda?.sugestao?.texto ?? null,
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
/**
 * Guarda o que o vendedor sabe e o WhatsApp não mostra (conversa por telefone,
 * visita, o que o cliente falou por fora). Fica no cliente e entra em TODA
 * análise do Orientador daí em diante — a IA lê e nunca sobrescreve.
 */
export async function salvarNotaOrientadorAction(
  conversationId: string,
  nota: string,
): Promise<{ ok: boolean; erro?: string }> {
  const conv = await db.whatsAppConversation.findUnique({ where: { id: conversationId }, select: { clienteId: true } });
  if (!conv?.clienteId) return { ok: false, erro: "Vincule a conversa a um cliente primeiro." };
  const texto = nota.trim().slice(0, LIMITE_ENTRADA);
  if (!texto) return { ok: false, erro: "Escreva alguma coisa antes de salvar." };
  try {
    // ACRESCENTA, não troca. A caixa limpa depois de salvar, então trocar
    // faria o contexto novo apagar o anterior — escrever a máquina hoje e a
    // forma de pagamento amanhã perderia a máquina.
    const atual = await db.orientadorAnalise.findUnique({ where: { clienteId: conv.clienteId }, select: { notaVendedor: true } });
    const notas = acrescentarNota(atual?.notaVendedor, texto);
    await db.orientadorAnalise.upsert({
      where: { clienteId: conv.clienteId },
      // Se ainda não existe análise, cria o mínimo para guardar a nota — a
      // próxima passada do Orientador preenche o resto.
      create: { clienteId: conv.clienteId, estagioVenda: "prospeccao", temperatura: "fria", objecoes: [], oportunidadesPerdidas: [], notaVendedor: notas },
      update: { notaVendedor: notas },
    });
  } catch (e) {
    console.error("[salvarNotaOrientador]", e);
    return { ok: false, erro: "Não deu para salvar a informação." };
  }
  // Fora do try de propósito: a nota JÁ está gravada aqui. Se o revalidate
  // falhasse dentro do try, a tela diria "não deu para salvar" e pularia a
  // reanálise por causa de um cache que não atualizou — perdendo justamente o
  // que o vendedor acabou de escrever.
  try { revalidatePath("/orientador"); } catch (e) { console.error("[salvarNotaOrientador] revalidate:", e); }
  return { ok: true };
}

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

/**
 * Apaga UM dos contextos guardados.
 *
 * Existe porque um fato errado entra na análise como FATO e envenena tudo daí
 * em diante: se o vendedor escreve "fechamos em 610 mil" e depois o negócio
 * muda, sem poder apagar ele ficaria brigando com a própria nota para sempre.
 */
export async function removerNotaOrientadorAction(
  conversationId: string,
  indice: number,
): Promise<{ ok: boolean; erro?: string }> {
  const conv = await db.whatsAppConversation.findUnique({ where: { id: conversationId }, select: { clienteId: true } });
  if (!conv?.clienteId) return { ok: false, erro: "Vincule a conversa a um cliente primeiro." };
  try {
    const atual = await db.orientadorAnalise.findUnique({ where: { clienteId: conv.clienteId }, select: { notaVendedor: true } });
    await db.orientadorAnalise.update({
      where: { clienteId: conv.clienteId },
      data: { notaVendedor: removerNota(atual?.notaVendedor, indice) },
    });
  } catch (e) {
    console.error("[removerNotaOrientador]", e);
    return { ok: false, erro: "Não deu para apagar." };
  }
  try { revalidatePath("/orientador"); } catch { /* cache não é motivo para falhar */ }
  return { ok: true };
}
