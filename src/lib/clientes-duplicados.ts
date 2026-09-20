// Unificação de cadastros duplicados (servidor). Regras puras em
// clientes-duplicados-regra.ts.
//
// Cada rodada mescla até N grupos numa transação por grupo, guardando em
// UnificacaoClientes um "recibo" com tudo o que foi movido, apagado ou
// preenchido — o suficiente para desfazer e deixar exatamente como estava.

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { agruparDuplicados, mesclarCampos, telefoneDoNome, type ClienteParaDedup, type GrupoDuplicados } from "@/lib/clientes-duplicados-regra";
import { nomeGenerico } from "@/lib/google-contatos-util";

type Tx = Prisma.TransactionClient;
type ClienteRow = Prisma.ClienteGetPayload<Record<string, never>>;

const SELECAO_DEDUP = { id: true, nome: true, telefone: true, googleContatoId: true, googleSincronizadoEm: true, origem: true, criadoEm: true } as const;

// Tabelas com clienteId que migram para quem fica. `unico` = uma linha por
// cliente (OrientadorAnalise), tratada à parte.
const TABELAS_MOVIVEIS = ["negociacao", "visita", "clienteMaquina", "alerta", "tarefaKanban", "posVendaContato", "cadencia", "auditLog", "alertaOculto", "whatsAppConversation"] as const;
type TabelaMovivel = typeof TABELAS_MOVIVEIS[number];

type ReciboSome = {
  cliente: ClienteRow;
  movidos: Partial<Record<TabelaMovivel, string[]>>;
  indicadosMovidos: string[];
  alertasResolvidos: string[];
  orientador: { acao: "movido" | "movido_substituindo" | "apagado" | "nenhum"; linha?: unknown };
};
type ReciboGrupo = { ficaId: string; ficaNome: string; antesFica: ClienteRow; somem: ReciboSome[] };
export type ReciboUnificacao = { grupos: ReciboGrupo[] };

export type PreviaGrupo = { fica: { id: string; nome: string; telefone: string | null; google: boolean }; somem: { id: string; nome: string; telefone: string | null; google: boolean }[]; motivo: string };
export type PreviaDuplicados = { totalGrupos: number; totalSomem: number; grupos: PreviaGrupo[] };

async function carregarGrupos(): Promise<GrupoDuplicados<ClienteParaDedup>[]> {
  const clientes = await db.cliente.findMany({ select: SELECAO_DEDUP });
  return agruparDuplicados(clientes);
}

export async function previaDuplicados(limite = 40): Promise<PreviaDuplicados> {
  const grupos = await carregarGrupos();
  const r = (c: ClienteParaDedup) => ({ id: c.id, nome: c.nome, telefone: c.telefone, google: !!c.googleContatoId });
  return {
    totalGrupos: grupos.length,
    totalSomem: grupos.reduce((s, g) => s + g.somem.length, 0),
    grupos: grupos.slice(0, limite).map((g) => ({ fica: r(g.fica), somem: g.somem.map(r), motivo: g.motivo })),
  };
}

function tabela(tx: Tx, t: TabelaMovivel) {
  // Todos têm o mesmo shape de findMany/updateMany que usamos aqui.
  return tx[t] as unknown as {
    findMany(a: { where: { clienteId: string }; select: { id: true } }): Promise<{ id: string }[]>;
    updateMany(a: { where: { id: { in: string[] } }; data: { clienteId: string } }): Promise<unknown>;
  };
}

async function mesclarGrupo(tx: Tx, grupo: GrupoDuplicados<ClienteParaDedup>): Promise<ReciboGrupo | null> {
  const fica = await tx.cliente.findUnique({ where: { id: grupo.fica.id } });
  if (!fica) return null;
  const recibo: ReciboGrupo = { ficaId: fica.id, ficaNome: fica.nome, antesFica: fica, somem: [] };
  let estadoFica: ClienteRow = fica;

  for (const alvo of grupo.somem) {
    const some = await tx.cliente.findUnique({ where: { id: alvo.id } });
    if (!some) continue;
    const rs: ReciboSome = { cliente: some, movidos: {}, indicadosMovidos: [], alertasResolvidos: [], orientador: { acao: "nenhum" } };

    // Alertas abertos: índice único (clienteId, tipo) entre abertos — se quem
    // fica já tem um aberto do mesmo tipo, o do outro é resolvido antes de mover.
    const abertosFica = await tx.alerta.findMany({ where: { clienteId: fica.id, resolvido: false }, select: { tipo: true } });
    const tiposFica = new Set(abertosFica.map((a) => a.tipo));
    const abertosSome = await tx.alerta.findMany({ where: { clienteId: some.id, resolvido: false }, select: { id: true, tipo: true } });
    const colidem = abertosSome.filter((a) => tiposFica.has(a.tipo)).map((a) => a.id);
    if (colidem.length) {
      await tx.alerta.updateMany({ where: { id: { in: colidem } }, data: { resolvido: true } });
      rs.alertasResolvidos = colidem;
    }

    for (const t of TABELAS_MOVIVEIS) {
      const ids = (await tabela(tx, t).findMany({ where: { clienteId: some.id }, select: { id: true } })).map((x) => x.id);
      if (!ids.length) continue;
      await tabela(tx, t).updateMany({ where: { id: { in: ids } }, data: { clienteId: fica.id } });
      rs.movidos[t] = ids;
    }

    const indicados = await tx.cliente.findMany({ where: { indicadoPorId: some.id }, select: { id: true } });
    if (indicados.length) {
      const ids = indicados.map((i) => i.id);
      await tx.cliente.updateMany({ where: { id: { in: ids } }, data: { indicadoPorId: fica.id } });
      rs.indicadosMovidos = ids;
    }

    // Análise do Orientador: uma por cliente. Se os dois têm, fica a mais
    // recente; a outra vai no recibo para o desfazer recriá-la.
    const orientadorSome = await tx.orientadorAnalise.findUnique({ where: { clienteId: some.id } });
    if (orientadorSome) {
      const orientadorFica = await tx.orientadorAnalise.findUnique({ where: { clienteId: fica.id } });
      if (!orientadorFica) {
        await tx.orientadorAnalise.update({ where: { id: orientadorSome.id }, data: { clienteId: fica.id } });
        rs.orientador = { acao: "movido" };
      } else if (orientadorSome.atualizadoEm > orientadorFica.atualizadoEm) {
        await tx.orientadorAnalise.delete({ where: { id: orientadorFica.id } });
        await tx.orientadorAnalise.update({ where: { id: orientadorSome.id }, data: { clienteId: fica.id } });
        rs.orientador = { acao: "movido_substituindo", linha: orientadorFica };
      } else {
        await tx.orientadorAnalise.delete({ where: { id: orientadorSome.id } });
        rs.orientador = { acao: "apagado", linha: orientadorSome };
      }
    }

    // Número no lugar do nome ("27995219314") conta como telefone; e quem fica
    // com nome genérico herda o nome de verdade do outro.
    const patch: Partial<typeof some> = mesclarCampos(estadoFica, { ...some, telefone: some.telefone ?? telefoneDoNome(some.nome) });
    if (patch.indicadoPorId === some.id) delete patch.indicadoPorId;
    if ((nomeGenerico(estadoFica.nome) || telefoneDoNome(estadoFica.nome)) && !nomeGenerico(some.nome) && !telefoneDoNome(some.nome)) patch.nome = some.nome;
    if (Object.keys(patch).length) estadoFica = await tx.cliente.update({ where: { id: fica.id }, data: patch });

    await tx.cliente.delete({ where: { id: some.id } });
    recibo.somem.push(rs);
  }
  return recibo.somem.length ? recibo : null;
}

export type ResultadoLote = { unificados: number; cadastrosRemovidos: number; restantes: number; unificacaoId: string | null };

export async function unificarLote(limite = 10, origem = "usuario"): Promise<ResultadoLote> {
  const grupos = await carregarGrupos();
  const lote = grupos.slice(0, limite);
  const recibo: ReciboUnificacao = { grupos: [] };
  for (const g of lote) {
    const r = await db.$transaction((tx) => mesclarGrupo(tx, g), { timeout: 20_000 });
    if (r) recibo.grupos.push(r);
  }
  if (!recibo.grupos.length) return { unificados: 0, cadastrosRemovidos: 0, restantes: Math.max(0, grupos.length - lote.length), unificacaoId: null };

  const removidos = recibo.grupos.reduce((s, g) => s + g.somem.length, 0);
  const nomes = recibo.grupos.slice(0, 6).map((g) => g.ficaNome).join(", ");
  const unificacao = await db.unificacaoClientes.create({
    data: {
      origem,
      resumo: `${recibo.grupos.length} cadastro(s) unificado(s), ${removidos} duplicado(s) removido(s): ${nomes}${recibo.grupos.length > 6 ? "…" : ""}`,
      dados: JSON.stringify(recibo),
    },
  });
  await db.clienteRedirecionamento.createMany({
    data: recibo.grupos.flatMap((g) => g.somem.map((s) => ({ deId: s.cliente.id, paraId: g.ficaId, unificacaoId: unificacao.id }))),
    skipDuplicates: true,
  });
  return { unificados: recibo.grupos.length, cadastrosRemovidos: removidos, restantes: Math.max(0, grupos.length - lote.length), unificacaoId: unificacao.id };
}

export type UnificacaoResumo = { id: string; criadoEm: Date; origem: string; resumo: string; desfeitaEm: Date | null; grupos: number; removidos: number };

export async function listarUnificacoes(limite = 20): Promise<UnificacaoResumo[]> {
  const rows = await db.unificacaoClientes.findMany({ orderBy: { criadoEm: "desc" }, take: limite });
  return rows.map((r) => {
    let grupos = 0, removidos = 0;
    try { const d = JSON.parse(r.dados) as ReciboUnificacao; grupos = d.grupos.length; removidos = d.grupos.reduce((s, g) => s + g.somem.length, 0); } catch {}
    return { id: r.id, criadoEm: r.criadoEm, origem: r.origem, resumo: r.resumo, desfeitaEm: r.desfeitaEm, grupos, removidos };
  });
}

// Recria os cadastros removidos com o mesmo id, devolve cada linha movida,
// restaura os campos de quem ficou e apaga os redirecionamentos.
export async function desfazerUnificacao(id: string): Promise<{ restaurados: number; falhas: string[] }> {
  const u = await db.unificacaoClientes.findUnique({ where: { id } });
  if (!u) throw new Error("Unificação não encontrada.");
  if (u.desfeitaEm) return { restaurados: 0, falhas: [] };
  const recibo = JSON.parse(u.dados) as ReciboUnificacao;
  let restaurados = 0;
  const falhas: string[] = [];

  for (const g of [...recibo.grupos].reverse()) {
    try {
      await db.$transaction(async (tx) => {
        for (const rs of [...g.somem].reverse()) {
          const c = rs.cliente;
          await tx.cliente.create({ data: { ...c, indicadoPorId: null } });
          for (const t of TABELAS_MOVIVEIS) {
            const ids = rs.movidos[t];
            if (ids?.length) await tabela(tx, t).updateMany({ where: { id: { in: ids } }, data: { clienteId: c.id } });
          }
          if (rs.indicadosMovidos.length) await tx.cliente.updateMany({ where: { id: { in: rs.indicadosMovidos } }, data: { indicadoPorId: c.id } });
          if (rs.orientador.acao === "movido" || rs.orientador.acao === "movido_substituindo") {
            await tx.orientadorAnalise.updateMany({ where: { clienteId: g.ficaId }, data: { clienteId: c.id } });
          }
          if ((rs.orientador.acao === "apagado" || rs.orientador.acao === "movido_substituindo") && rs.orientador.linha) {
            await tx.orientadorAnalise.create({ data: rs.orientador.linha as Prisma.OrientadorAnaliseUncheckedCreateInput });
          }
          if (rs.alertasResolvidos.length) await tx.alerta.updateMany({ where: { id: { in: rs.alertasResolvidos } }, data: { resolvido: false } });
          restaurados++;
        }
        // indicadoPorId dos recriados só depois que todos existem de novo.
        for (const rs of g.somem) {
          if (rs.cliente.indicadoPorId) await tx.cliente.update({ where: { id: rs.cliente.id }, data: { indicadoPorId: rs.cliente.indicadoPorId } }).catch(() => {});
        }
        const { id: ficaId, criadoEm: _c, atualizadoEm: _a, ...campos } = g.antesFica;
        void _c; void _a;
        await tx.cliente.update({ where: { id: ficaId }, data: campos });
        await tx.clienteRedirecionamento.deleteMany({ where: { deId: { in: g.somem.map((s) => s.cliente.id) } } });
      }, { timeout: 20_000 });
    } catch (e) {
      falhas.push(`${g.ficaNome}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await db.unificacaoClientes.update({ where: { id }, data: { desfeitaEm: new Date() } });
  return { restaurados, falhas };
}

export async function clienteRedirecionado(deId: string): Promise<string | null> {
  const r = await db.clienteRedirecionamento.findUnique({ where: { deId } }).catch(() => null);
  if (!r) return null;
  // Segue a corrente se quem ficou também foi unificado depois.
  const seguinte = await db.clienteRedirecionamento.findUnique({ where: { deId: r.paraId } }).catch(() => null);
  return seguinte?.paraId ?? r.paraId;
}

/**
 * Une DOIS cadastros escolhidos a dedo, em vez dos duplicados que a regra
 * detecta sozinha.
 *
 * Existe para o pedido que o vendedor escreve no Orientador: "Wadson não é
 * construtora, ele é o proprietário da BWB, que já está no nosso funil". A
 * regra automática não pega isso — os nomes não se parecem e os telefones são
 * diferentes; só quem conhece o cliente sabe que são a mesma coisa.
 *
 * Reusa a MESMA mesclagem dos duplicados automáticos, de propósito: assim as
 * negociações, visitas, conversas, alertas e o histórico migram pelo caminho
 * já testado, e a operação entra no mesmo registro de desfazer — nada aqui é
 * um atalho paralelo que ninguém consegue reverter.
 */
export async function unificarEscolhidos(
  ficaId: string,
  someId: string,
  origem = "orientador",
): Promise<{ ok: boolean; erro?: string; unificacaoId?: string; movidos?: number }> {
  if (ficaId === someId) return { ok: false, erro: "São o mesmo cadastro." };
  const [fica, some] = await Promise.all([
    db.cliente.findUnique({ where: { id: ficaId }, select: SELECAO_DEDUP }),
    db.cliente.findUnique({ where: { id: someId }, select: SELECAO_DEDUP }),
  ]);
  if (!fica) return { ok: false, erro: "O cliente que deve ficar não foi encontrado." };
  if (!some) return { ok: false, erro: "O cadastro a unir não foi encontrado." };

  const grupo: GrupoDuplicados<ClienteParaDedup> = { fica, somem: [some], motivo: "nome" };
  const r = await db.$transaction((tx) => mesclarGrupo(tx, grupo), { timeout: 20_000 });
  if (!r) return { ok: false, erro: "Não deu para unir os cadastros." };

  const recibo: ReciboUnificacao = { grupos: [r] };
  const unificacao = await db.unificacaoClientes.create({
    data: {
      origem,
      resumo: `"${some.nome}" passou a fazer parte de "${fica.nome}" (pedido no Orientador).`,
      dados: JSON.stringify(recibo),
    },
  });
  await db.clienteRedirecionamento.createMany({
    data: [{ deId: some.id, paraId: fica.id, unificacaoId: unificacao.id }],
    skipDuplicates: true,
  });
  const movidos = Object.values(r.somem[0]?.movidos ?? {}).reduce((s, ids) => s + (ids?.length ?? 0), 0);
  return { ok: true, unificacaoId: unificacao.id, movidos };
}
