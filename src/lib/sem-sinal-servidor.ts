import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { papelDaColuna } from "@/lib/pipeline";
import { criarVisitaNoBanco } from "@/lib/visita-criar";
import { criarNegociacaoCompleta, resolverColunaFunil } from "@/lib/actions";
import { registrarVisitaDoDiaAction } from "@/lib/visitas-dia-actions";
import { acharClientePorTelefone } from "@/lib/zeus/pipeline";
import { deveDescartarContato } from "@/lib/filtro-contatos";
import { registrarAudit } from "@/lib/audit";
import { limparErro } from "@/lib/erro-legivel";
import { STATUS_NAO_CLIENTE } from "@/lib/cliente-status";
import {
  VERSAO_PACOTE, DIAS_VISITAS_ATRAS, DIAS_VISITAS_FRENTE, TETO_CLIENTES_PACOTE, colunasParaNovaNegociacao, resumoDaRodada,
  type PacoteSemSinal, type OperacaoSemSinal, type ResultadoOperacao, type RespostaSincronia, type NovoCliente,
} from "@/lib/sem-sinal-regra";

// O LADO DO SERVIDOR DO MODO SEM SINAL. As regras estão em
// lib/sem-sinal-regra.ts (puras, testadas); aqui fica o que toca o banco.
//
// Nada aqui escreve de um jeito próprio: agendar usa a mesma criação da ficha
// do cliente (lib/visita-criar.ts), concluir usa o mesmo caminho do lembrete
// das visitas do dia (relato lido pela IA, coluna movida por ordem escrita) e
// a negociação nasce pelo mesmo criarNegociacaoCompleta do formulário. O modo
// sem sinal só guarda o pedido e entrega depois.

const DIA = 86_400_000;

/** O retrato que vai para o aparelho. Seis consultas, nenhuma escrita. */
export async function montarPacote(agora = new Date()): Promise<PacoteSemSinal> {
  // A hora do retrato é a de ANTES das consultas: o que subir enquanto elas
  // rodam fica com hora maior e continua aparecendo por cima no aparelho.
  // Com a hora de depois, uma visita gravada no meio sumiria da tela até o
  // próximo pacote (lib/sem-sinal-regra.ts, aplicarPendentes).
  const geradoEm = new Date().toISOString();
  const inicio = new Date(agora.getTime() - DIAS_VISITAS_ATRAS * DIA);
  const fim = new Date(agora.getTime() + DIAS_VISITAS_FRENTE * DIA);
  // Mesmo recorte da tela de Clientes: sem prospect sugerido pela IA (pode ser
  // nome inventado) e sem quem foi marcado como "não é cliente". Cada OR
  // dentro do AND — dois OR soltos no mesmo objeto se apagam.
  const filtroClientes: Prisma.ClienteWhereInput = {
    AND: [
      { OR: [{ origem: null }, { origem: { not: "prospect_ia" } }] },
      { status: { not: STATUS_NAO_CLIENTE } },
    ],
  };

  const [visitas, clientes, totalClientes, negociacoes, colunas, municipios, maquinas] = await Promise.all([
    db.visita.findMany({
      where: { data: { gte: inicio, lte: fim } },
      orderBy: { data: "asc" },
      take: 3000,
      select: {
        id: true, clienteId: true, data: true, status: true, cidade: true, observacao: true,
        cliente: { select: { nome: true, telefone: true } },
      },
    }),
    db.cliente.findMany({
      where: filtroClientes,
      orderBy: { nome: "asc" },
      take: TETO_CLIENTES_PACOTE,
      select: { id: true, nome: true, telefone: true, municipio: { select: { nome: true } } },
    }),
    db.cliente.count({ where: filtroClientes }),
    db.negociacao.findMany({
      where: { status: "aberta" },
      orderBy: { atualizadoEm: "desc" },
      take: 2000,
      select: {
        id: true, clienteId: true, marca: true, maquinaModelo: true, valor: true, estagio: true, proximaAcao: true, ultimoContato: true,
        cliente: { select: { nome: true } },
      },
    }),
    db.colunaFunil.findMany({ orderBy: { ordem: "asc" }, select: { titulo: true, papel: true, ordem: true } }),
    db.municipio.findMany({ orderBy: { nome: "asc" }, take: 3000, select: { nome: true } }),
    db.maquina.findMany({ where: { proprio: true }, orderBy: [{ marca: "asc" }, { modelo: "asc" }], take: 1000, select: { marca: true, modelo: true } }),
  ]);

  return {
    versao: VERSAO_PACOTE,
    geradoEm,
    visitas: visitas.map((v) => ({
      id: v.id, clienteId: v.clienteId, clienteNome: v.cliente.nome, telefone: v.cliente.telefone,
      data: v.data.toISOString(), status: v.status, cidade: v.cidade, observacao: v.observacao,
    })),
    clientes: clientes.map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone, municipio: c.municipio?.nome ?? null })),
    totalClientes,
    negociacoes: negociacoes.map((n) => ({
      id: n.id, clienteId: n.clienteId, clienteNome: n.cliente.nome, marca: n.marca, maquinaModelo: n.maquinaModelo,
      valor: n.valor, estagio: n.estagio, proximaAcao: n.proximaAcao, ultimoContato: n.ultimoContato?.toISOString() ?? null,
    })),
    colunas: colunas.map((c) => ({ titulo: c.titulo, papel: papelDaColuna(c), ordem: c.ordem })),
    municipios: [...new Set(municipios.map((m) => m.nome))],
    maquinas: maquinas.filter((m) => m.marca && m.modelo).map((m) => ({ marca: m.marca as string, modelo: m.modelo as string })),
  };
}

function ehDuplicado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

type Resolvido = { ok: true; id: string; aviso?: string } | { ok: false; erro: string };

/**
 * O cliente da operação. Cadastrado sem sinal → o banco pode já ter alguém com
 * aquele telefone (o WhatsApp dele criou, ou ele cadastrou em outro aparelho):
 * aí usa o que existe em vez de duplicar.
 */
async function resolverCliente(clienteId: string, novo: NovoCliente | undefined): Promise<Resolvido> {
  const existe = await db.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
  if (existe) return { ok: true, id: existe.id };
  if (!novo) {
    return { ok: false, erro: "Esse cliente não existe mais no CRM (foi apagado ou juntado com outro enquanto você estava sem sinal)." };
  }
  if (novo.telefone) {
    const achado = await acharClientePorTelefone(novo.telefone);
    if (achado) return { ok: true, id: achado.id, aviso: `O telefone já era de "${achado.nome}" no CRM — ficou com esse cadastro.` };
  }
  if (await deveDescartarContato(novo.nome)) {
    return { ok: false, erro: `O nome "${novo.nome}" está na lista de bloqueio de contatos (Configurações).` };
  }
  try {
    await db.cliente.create({ data: { id: clienteId, nome: novo.nome, telefone: novo.telefone, origem: "sem_sinal" } });
  } catch (e) {
    if (!ehDuplicado(e)) throw e;
  }
  return { ok: true, id: clienteId };
}

async function aplicarUma(op: OperacaoSemSinal): Promise<Omit<ResultadoOperacao, "id">> {
  if (op.tipo === "visita.agendar") {
    if (await db.visita.findUnique({ where: { id: op.visitaId }, select: { id: true } })) return { ok: true, jaAplicada: true };
    const cli = await resolverCliente(op.clienteId, op.novoCliente);
    if (!cli.ok) return { ok: false, erro: cli.erro };
    try {
      await criarVisitaNoBanco({ id: op.visitaId, clienteId: cli.id, dia: op.data, horario: op.horario, cidade: op.cidade, observacao: op.observacao });
    } catch (e) {
      if (ehDuplicado(e)) return { ok: true, jaAplicada: true };
      throw e;
    }
    return { ok: true, ...(cli.aviso ? { aviso: cli.aviso } : {}) };
  }

  if (op.tipo === "visita.concluir") {
    const v = await db.visita.findUnique({ where: { id: op.visitaId }, select: { status: true, observacao: true } });
    if (!v) return { ok: false, erro: "Essa visita não existe mais no CRM (foi apagada enquanto você estava sem sinal)." };
    // Já está como ele deixou? Então a primeira subida chegou e só a resposta
    // se perdeu. Rodar de novo colaria o relato duas vezes e gastaria IA.
    const alvo = op.feita ? "realizada" : "nao_realizada";
    const relato = op.relato.trim();
    if (v.status === alvo && (!relato || (v.observacao ?? "").includes(relato))) return { ok: true, jaAplicada: true };
    const r = await registrarVisitaDoDiaAction(op.visitaId, op.feita, relato, "pelo modo sem sinal");
    if (!r.ok) return { ok: false, erro: r.erro ?? "O CRM não aceitou." };
    const partes = [
      r.negociacao ? `negociação ${r.negociacao}` : null,
      r.colunaMovida && !r.colunaMovida.startsWith("__nao_achei__") ? `movida para ${r.colunaMovida}` : null,
      r.proximaVisita ? `próxima visita em ${r.proximaVisita}` : null,
    ].filter(Boolean);
    return { ok: true, ...(partes.length ? { aviso: `A IA leu o relato: ${partes.join(", ")}.` } : {}) };
  }

  // negociacao.criar
  if (await db.negociacao.findUnique({ where: { id: op.negociacaoId }, select: { id: true } })) return { ok: true, jaAplicada: true };
  const cli = await resolverCliente(op.clienteId, op.novoCliente);
  if (!cli.ok) return { ok: false, erro: cli.erro };

  // A coluna pode ter sido renomeada ou apagada enquanto ele estava sem sinal.
  // Negociação com estágio que não existe fica invisível no quadro — então vai
  // para a primeira coluna de negociação e ele fica sabendo.
  let estagio = op.estagio;
  let avisoColuna: string | null = null;
  const col = await resolverColunaFunil(op.estagio);
  const colunas = await db.colunaFunil.findMany({ orderBy: { ordem: "asc" }, select: { titulo: true, papel: true, ordem: true } });
  const abertas = colunasParaNovaNegociacao(colunas.map((c) => ({ titulo: c.titulo, papel: papelDaColuna(c), ordem: c.ordem })));
  if (col && abertas.some((c) => c.titulo === col.titulo)) {
    estagio = col.titulo;
  } else {
    const primeira = abertas.find((c) => c.papel === "em_negociacao") ?? abertas[0];
    if (!primeira) return { ok: false, erro: "O funil não tem nenhuma coluna aberta para receber a negociação." };
    estagio = primeira.titulo;
    avisoColuna = `A coluna "${op.estagio}" não existe mais — entrou em "${primeira.titulo}".`;
  }

  const fd = new FormData();
  fd.set("id", op.negociacaoId);
  fd.set("clienteId", cli.id);
  fd.set("estagio", estagio);
  if (op.marca) fd.set("marca", op.marca);
  if (op.maquinaModelo) fd.set("maquinaModelo", op.maquinaModelo);
  if (op.valor != null) fd.set("valor", String(op.valor));
  if (op.proximaAcao) fd.set("proximaAcao", op.proximaAcao);
  try {
    const r = await criarNegociacaoCompleta(fd);
    if (!r.ok) return { ok: false, erro: r.erro ?? "O CRM não aceitou a negociação." };
  } catch (e) {
    if (ehDuplicado(e)) return { ok: true, jaAplicada: true };
    throw e;
  }
  const aviso = [cli.aviso, avisoColuna].filter(Boolean).join(" ");
  return { ok: true, ...(aviso ? { aviso } : {}) };
}

/** Prazo de uma rodada: o relato chama a IA, e a função do servidor tem limite. */
export const PRAZO_RODADA_MS = 40_000;

/**
 * Aplica as operações EM ORDEM. Falha inesperada (banco, IA travada) para a
 * rodada: a próxima operação pode depender desta (concluir uma visita que
 * ainda não foi criada). Recusa com motivo (cliente apagado) não para: as
 * outras não têm culpa.
 */
export async function aplicarOperacoes(ops: OperacaoSemSinal[]): Promise<RespostaSincronia> {
  const inicio = Date.now();
  const resultados: ResultadoOperacao[] = [];
  const feitas: OperacaoSemSinal[] = [];
  let parou: string | null = null;

  for (const op of ops) {
    if (parou) { resultados.push({ id: op.id, ok: false, transitorio: true, adiada: true, erro: parou }); continue; }
    if (Date.now() - inicio > PRAZO_RODADA_MS) {
      parou = "Ficou para a próxima rodada (esta já demorou demais).";
      resultados.push({ id: op.id, ok: false, transitorio: true, adiada: true, erro: parou });
      continue;
    }
    try {
      const r = await aplicarUma(op);
      resultados.push({ id: op.id, ...r });
      if (r.ok && !r.jaAplicada) feitas.push(op);
    } catch (e) {
      console.error("[sem sinal] operação falhou:", op.tipo, e);
      resultados.push({ id: op.id, ok: false, transitorio: true, erro: limparErro(e) });
      parou = "Esperando a anterior subir.";
    }
  }

  if (feitas.length) {
    await registrarAudit({
      acao: "offline_sincronizado", origem: "usuario",
      descricao: resumoDaRodada(feitas),
      extra: { operacoes: feitas.map((o) => ({ tipo: o.tipo, id: o.id, feitaNoAparelhoEm: o.criadaEm })) },
    }).catch(() => {});
  }

  return { agora: new Date().toISOString(), resultados };
}
