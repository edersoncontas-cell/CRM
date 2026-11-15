// "Meu mês" no Dashboard (Etapa 4) — regras PURAS (sem banco). Recebe os dados
// que o Dashboard já carregou (vendas faturadas, negociações abertas) e devolve
// o que o bloco mostra. Nada aqui consulta o banco nem chama IA.

import { DIA_MS, diaBR, meiaNoiteBR, MESES_PT } from "@/lib/fuso-brasilia";
import { calcularProgresso, type ProgressoMeta } from "@/lib/metas-regra";

/** Negócio sem contato há este tanto de dias ou mais é "parado" (mesmo corte do relatório). */
export const DIAS_PARADO = 10;
export const ITENS_POR_LISTA = 5;

export type VendaEntrada = { id: string; clienteId: string; clienteNome: string; marca: string | null; modelo: string | null; valor: number; faturadoEm: Date };
export type NegociacaoEntrada = {
  id: string; clienteId: string; clienteNome: string; estagio: string; valor: number | null;
  marca: string | null; maquinaModelo: string | null; proximaAcao: string | null;
  ultimoContato: Date | null; criadoEm: Date;
};
export type MetaMensalEntrada = { inicio: Date; fim: Date; meta: number; supermeta: number | null; criadoEm: Date };

export type MetaDoMes = { meta: number; supermeta: number | null; origem: "metas" | "parametros" };

export type DadosMeuMes = {
  rotuloMes: string;
  meta: MetaDoMes;
  progresso: ProgressoMeta;
  faturadoNoMes: number;                 // soma dos valores das vendas do mês
  ultimasVendas: { id: string; clienteId: string; cliente: string; maquina: string; valor: number; quando: Date }[];
  ultimasProspeccoes: { id: string; clienteId: string; cliente: string; maquina: string; estagio: string; quando: Date }[];
  abertos: {
    id: string; clienteId: string; cliente: string; estagio: string; maquina: string; valor: number | null;
    diasSemContato: number; parado: boolean; proximoPasso: string | null;
  }[];
  totalParados: number;                  // todos os parados, mesmo os que não cabem na lista
  incentivo: string | null;              // só quando ainda não houve venda no mês
};

/** Calendário do mês de Brasília que contém `agora`. */
export function mesCorrente(agora: Date): { inicio: Date; fim: Date; rotulo: string } {
  const { a, m } = diaBR(agora);
  return { inicio: meiaNoiteBR(a, m, 1), fim: meiaNoiteBR(a, m + 1, 1), rotulo: `${MESES_PT[m]} de ${a}` };
}

/** A meta mensal de máquinas que cobre hoje (a criada por último vence); sem ela, a
 *  meta anual de Parâmetros dividida por 12, arredondada para cima (como lib/metas.ts). */
export function escolherMetaDoMes(metas: MetaMensalEntrada[], agora: Date, metaAnualParametros: number): MetaDoMes {
  const t = agora.getTime();
  const achadas = metas
    .filter((m) => m.inicio.getTime() <= t && t < m.fim.getTime() && m.meta > 0)
    .sort((x, y) => y.criadoEm.getTime() - x.criadoEm.getTime());
  if (achadas.length) return { meta: achadas[0].meta, supermeta: achadas[0].supermeta, origem: "metas" };
  const anual = Number.isFinite(metaAnualParametros) && metaAnualParametros > 0 ? metaAnualParametros : 1;
  return { meta: Math.max(1, Math.ceil(anual / 12)), supermeta: null, origem: "parametros" };
}

const maquinaDe = (marca: string | null, modelo: string | null) => [marca, modelo].filter(Boolean).join(" ") || "Máquina não informada";

function diasSem(n: NegociacaoEntrada, agora: Date): number {
  const ref = n.ultimoContato ?? n.criadoEm; // sem nenhum contato conta desde a criação
  return Math.max(0, Math.floor((agora.getTime() - ref.getTime()) / DIA_MS));
}

export function montarMeuMes(e: {
  agora: Date;
  vendas: VendaEntrada[];
  negociacoes: NegociacaoEntrada[];
  meta: MetaDoMes;
}): DadosMeuMes {
  const { agora, vendas, negociacoes, meta } = e;
  const mes = mesCorrente(agora);
  const doMes = vendas.filter((v) => v.faturadoEm >= mes.inicio && v.faturadoEm < mes.fim);

  const progresso = calcularProgresso({ inicio: mes.inicio, fim: mes.fim, meta: meta.meta, supermeta: meta.supermeta }, doMes.length, agora);

  const ultimasVendas = [...vendas]
    .sort((a, b) => b.faturadoEm.getTime() - a.faturadoEm.getTime())
    .slice(0, ITENS_POR_LISTA)
    .map((v) => ({ id: v.id, clienteId: v.clienteId, cliente: v.clienteNome, maquina: maquinaDe(v.marca, v.modelo), valor: v.valor, quando: v.faturadoEm }));

  // Prospecção = negociação nova. Cliente novo fica de fora: importar contatos em
  // lote encheria a lista de gente que ainda não é negócio.
  const ultimasProspeccoes = [...negociacoes]
    .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
    .slice(0, ITENS_POR_LISTA)
    .map((n) => ({ id: n.id, clienteId: n.clienteId, cliente: n.clienteNome, maquina: maquinaDe(n.marca, n.maquinaModelo), estagio: n.estagio, quando: n.criadoEm }));

  const comDias = negociacoes.map((n) => {
    const dias = diasSem(n, agora);
    return {
      id: n.id, clienteId: n.clienteId, cliente: n.clienteNome, estagio: n.estagio, maquina: maquinaDe(n.marca, n.maquinaModelo),
      valor: n.valor, diasSemContato: dias, parado: dias >= DIAS_PARADO, proximoPasso: n.proximaAcao?.trim() || null,
    };
  });
  const parados = comDias.filter((n) => n.parado).sort((a, b) => b.diasSemContato - a.diasSemContato);
  const emDia = comDias.filter((n) => !n.parado).sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));
  const abertos = [...parados, ...emDia].slice(0, ITENS_POR_LISTA);

  const incentivo = doMes.length > 0 ? null
    : parados.length > 0
      ? `Nenhuma venda faturada neste mês ainda. Comece pelos ${parados.length} negócio${parados.length === 1 ? "" : "s"} parado${parados.length === 1 ? "" : "s"} abaixo: um contato hoje já muda o jogo.`
      : "Nenhuma venda faturada neste mês ainda. O próximo passo é marcar visitas e abrir negociações novas.";

  return {
    rotuloMes: mes.rotulo, meta, progresso,
    faturadoNoMes: doMes.reduce((s, v) => s + (v.valor || 0), 0),
    ultimasVendas, ultimasProspeccoes, abertos, totalParados: parados.length, incentivo,
  };
}
