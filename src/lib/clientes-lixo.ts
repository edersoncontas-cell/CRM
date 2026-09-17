// Limpeza de cadastros sem identidade (servidor). A regra é pura e vive em
// clientes-lixo-regra.ts; aqui é o banco: contar vínculos, aplicar, guardar o
// recibo e desfazer.

import { db } from "@/lib/db";
import type { Prisma, Cliente } from "@prisma/client";
import { decidirLimpeza, DESCRICAO_MOTIVO, type DecisaoLimpeza, type MotivoLimpeza, type ClienteParaLimpeza } from "@/lib/clientes-lixo-regra";

type Candidato = { cliente: Cliente; decisao: DecisaoLimpeza };

async function carregarCandidatos(): Promise<Candidato[]> {
  const [clientes, conversas] = await Promise.all([
    db.cliente.findMany({
      // `not` no Prisma exclui os NULL junto — cadastro sem origem também entra.
      where: { OR: [{ origem: null }, { origem: { not: "prospect_ia" } }] },
      include: { _count: { select: { negociacoes: true, visitas: true, frota: true, alertas: true, tarefas: true, posVendaContatos: true, cadencias: true, indicados: true } } },
    }),
    db.whatsAppConversation.groupBy({ by: ["clienteId"], where: { clienteId: { not: null } }, _count: { _all: true } }),
  ]);
  const conversasPorCliente = new Map<string, number>();
  for (const c of conversas) if (c.clienteId) conversasPorCliente.set(c.clienteId, c._count._all);

  const saida: Candidato[] = [];
  for (const c of clientes) {
    const { _count, ...cliente } = c;
    const vinculos = Object.values(_count).reduce((s, n) => s + n, 0) + (conversasPorCliente.get(c.id) ?? 0);
    const alvo: ClienteParaLimpeza = { id: c.id, nome: c.nome, telefone: c.telefone, googleContatoId: c.googleContatoId, vinculos };
    const decisao = decidirLimpeza(alvo);
    if (decisao) saida.push({ cliente: cliente as Cliente, decisao });
  }
  return saida.sort((a, b) => a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR"));
}

export type PreviaLimpeza = {
  apagar: number;
  consertar: number;
  porMotivo: Partial<Record<MotivoLimpeza, number>>;
  exemplos: { id: string; nome: string; telefone: string | null; acao: DecisaoLimpeza["acao"]; novo: string | null }[];
};

export async function previaLimpeza(limite = 60): Promise<PreviaLimpeza> {
  const cands = await carregarCandidatos();
  const porMotivo: Partial<Record<MotivoLimpeza, number>> = {};
  for (const c of cands) porMotivo[c.decisao.motivo] = (porMotivo[c.decisao.motivo] ?? 0) + 1;
  return {
    apagar: cands.filter((c) => c.decisao.acao === "apagar").length,
    consertar: cands.filter((c) => c.decisao.acao !== "apagar").length,
    porMotivo,
    exemplos: cands.slice(0, limite).map((c) => ({
      id: c.cliente.id, nome: c.cliente.nome, telefone: c.cliente.telefone, acao: c.decisao.acao,
      novo: c.decisao.acao === "renomear" ? c.decisao.novoNome : c.decisao.acao === "telefone_do_nome" ? c.decisao.novoTelefone : null,
    })),
  };
}

type Recibo = {
  apagados: Cliente[];
  alterados: { id: string; antes: { nome: string; telefone: string | null } }[];
};

export type ResultadoLimpezaClientes = { apagados: number; consertados: number; limpezaId: string | null };

export async function executarLimpeza(origem = "usuario"): Promise<ResultadoLimpezaClientes> {
  const cands = await carregarCandidatos();
  if (!cands.length) return { apagados: 0, consertados: 0, limpezaId: null };
  const recibo: Recibo = { apagados: [], alterados: [] };
  const motivos = new Map<MotivoLimpeza, number>();

  for (const { cliente, decisao } of cands) {
    try {
      if (decisao.acao === "apagar") {
        await db.cliente.delete({ where: { id: cliente.id } });
        recibo.apagados.push(cliente);
      } else {
        const data = decisao.acao === "renomear" ? { nome: decisao.novoNome } : { telefone: decisao.novoTelefone };
        await db.cliente.update({ where: { id: cliente.id }, data });
        recibo.alterados.push({ id: cliente.id, antes: { nome: cliente.nome, telefone: cliente.telefone } });
      }
      motivos.set(decisao.motivo, (motivos.get(decisao.motivo) ?? 0) + 1);
    } catch (e) {
      console.error("[limpeza-clientes]", cliente.id, e instanceof Error ? e.message : e);
    }
  }
  if (!recibo.apagados.length && !recibo.alterados.length) return { apagados: 0, consertados: 0, limpezaId: null };

  const partes = [...motivos.entries()].map(([m, n]) => `${n} ${DESCRICAO_MOTIVO[m]}`).join(", ");
  const limpeza = await db.limpezaClientes.create({
    data: { origem, resumo: `${recibo.apagados.length} apagado(s), ${recibo.alterados.length} consertado(s): ${partes}`, dados: JSON.stringify(recibo) },
  });
  return { apagados: recibo.apagados.length, consertados: recibo.alterados.length, limpezaId: limpeza.id };
}

export type LimpezaResumo = { id: string; criadoEm: Date; resumo: string; desfeitaEm: Date | null };

export async function listarLimpezas(limite = 10): Promise<LimpezaResumo[]> {
  const rows = await db.limpezaClientes.findMany({ orderBy: { criadoEm: "desc" }, take: limite });
  return rows.map((r) => ({ id: r.id, criadoEm: r.criadoEm, resumo: r.resumo, desfeitaEm: r.desfeitaEm }));
}

// Recria os apagados com o mesmo id (as datas voltam como estavam) e devolve
// nome/telefone dos consertados.
export async function desfazerLimpeza(id: string): Promise<{ restaurados: number; falhas: string[] }> {
  const l = await db.limpezaClientes.findUnique({ where: { id } });
  if (!l) throw new Error("Limpeza não encontrada.");
  if (l.desfeitaEm) return { restaurados: 0, falhas: [] };
  const recibo = JSON.parse(l.dados) as Recibo;
  let restaurados = 0;
  const falhas: string[] = [];

  for (const c of recibo.apagados) {
    try {
      const { indicadoPorId, ...resto } = c;
      await db.cliente.create({ data: { ...(resto as unknown as Prisma.ClienteUncheckedCreateInput), indicadoPorId: null } });
      if (indicadoPorId) await db.cliente.update({ where: { id: c.id }, data: { indicadoPorId } }).catch(() => {});
      restaurados++;
    } catch (e) {
      falhas.push(`${c.nome}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  for (const a of recibo.alterados) {
    try {
      await db.cliente.update({ where: { id: a.id }, data: a.antes });
      restaurados++;
    } catch (e) {
      falhas.push(`${a.antes.nome}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await db.limpezaClientes.update({ where: { id }, data: { desfeitaEm: new Date() } });
  return { restaurados, falhas };
}
