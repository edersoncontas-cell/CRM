// Relatório sob demanda — monta os dados (SÓ LEITURA) a partir do banco.
// Cada tipo devolve a mesma forma (RelatorioPronto); o arquivo (PDF/planilha)
// é feito em relatorio-pedido-arquivo.ts. Regras puras: relatorio-pedido-regra.ts.

import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import {
  LIMITES_RELATORIO, ROTULO_TIPO, fmtDiaBR,
  type Pedido, type RelatorioPronto,
} from "@/lib/relatorio-pedido-regra";

const MAX = LIMITES_RELATORIO.linhasNoArquivo;

const dataBR = (d: Date | null | undefined) => (d ? fmtDiaBR(d) : "—");
const DIA = 24 * 60 * 60 * 1000;

function cortar<T>(itens: T[]): { itens: T[]; cortado: boolean } {
  return itens.length > MAX ? { itens: itens.slice(0, MAX), cortado: true } : { itens, cortado: false };
}

const ROTULO_PAGAMENTO: Record<string, string> = {
  avista: "À vista", financiamento: "Financiamento", consorcio: "Consórcio", crd_pme: "CRD PME", outro: "Outro",
};

async function vendas(p: Pedido): Promise<RelatorioPronto> {
  const per = p.periodo!;
  // Mesmo critério da meta de vendas (lib/metas.ts): ganha + data de faturamento no período.
  const rows = await db.negociacao.findMany({
    where: { status: "ganha", faturadoEm: { gte: per.de, lt: per.ate } },
    orderBy: { faturadoEm: "asc" },
    take: MAX + 1,
    select: {
      faturadoEm: true, marca: true, maquinaModelo: true, valor: true, tipoPagamento: true,
      cliente: { select: { nome: true, municipio: { select: { nome: true } } } },
    },
  });
  const { itens, cortado } = cortar(rows);
  const total = itens.reduce((s, r) => s + (r.valor ?? 0), 0);
  const semValor = itens.filter((r) => r.valor == null).length;
  return {
    tipo: "vendas",
    titulo: ROTULO_TIPO.vendas,
    subtitulo: per.rotulo,
    resumo: [
      { rotulo: "Vendas", valor: String(itens.length) },
      { rotulo: "Valor total", valor: formatCurrency(total) },
      ...(itens.length ? [{ rotulo: "Ticket médio", valor: formatCurrency(total / (itens.length - semValor || 1)) }] : []),
    ],
    colunas: ["Faturado em", "Cliente", "Cidade", "Máquina", "Pagamento", "Valor"],
    linhas: itens.map((r) => [
      dataBR(r.faturadoEm),
      r.cliente.nome,
      r.cliente.municipio?.nome ?? "—",
      [r.marca, r.maquinaModelo].filter(Boolean).join(" ") || "—",
      ROTULO_PAGAMENTO[r.tipoPagamento ?? ""] ?? "—",
      formatCurrency(r.valor),
    ]),
    cortado,
    aviso: semValor ? `${semValor} venda(s) sem valor preenchido não entram na soma.` : undefined,
  };
}

async function funil(): Promise<RelatorioPronto> {
  const [abertas, colunas] = await Promise.all([
    db.negociacao.findMany({
      where: { status: "aberta" },
      select: { estagio: true, valor: true },
      take: 5000,
    }),
    // Ordem das colunas vem do quadro; se a consulta falhar, cai na ordem de aparição.
    db.colunaFunil.findMany({ orderBy: { ordem: "asc" }, select: { titulo: true } }).catch(() => []),
  ]);
  const grupos = new Map<string, { qtd: number; valor: number }>();
  for (const n of abertas) {
    const g = grupos.get(n.estagio) ?? { qtd: 0, valor: 0 };
    g.qtd++; g.valor += n.valor ?? 0;
    grupos.set(n.estagio, g);
  }
  const ordem = colunas.map((c) => c.titulo);
  const nomes = Array.from(grupos.keys()).sort((a, b) => {
    const ia = ordem.indexOf(a), ib = ordem.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b, "pt-BR");
  });
  const total = abertas.reduce((s, n) => s + (n.valor ?? 0), 0);
  return {
    tipo: "funil",
    titulo: ROTULO_TIPO.funil,
    subtitulo: `Retrato de agora (${dataBR(new Date())})`,
    resumo: [
      { rotulo: "Negociações abertas", valor: String(abertas.length) },
      { rotulo: "Valor em aberto", valor: formatCurrency(total) },
    ],
    colunas: ["Etapa", "Negociações", "Valor"],
    linhas: nomes.map((n) => [n, String(grupos.get(n)!.qtd), formatCurrency(grupos.get(n)!.valor)]),
    cortado: false,
  };
}

const ROTULO_VISITA: Record<string, string> = { agendada: "Agendada", realizada: "Realizada", nao_realizada: "Não realizada" };

async function visitas(p: Pedido): Promise<RelatorioPronto> {
  const per = p.periodo!;
  const rows = await db.visita.findMany({
    where: { data: { gte: per.de, lt: per.ate } },
    orderBy: { data: "asc" },
    take: MAX + 1,
    select: { data: true, status: true, cidade: true, observacao: true, cliente: { select: { nome: true } } },
  });
  const { itens, cortado } = cortar(rows);
  const cont = (s: string) => itens.filter((v) => v.status === s).length;
  return {
    tipo: "visitas",
    titulo: ROTULO_TIPO.visitas,
    subtitulo: per.rotulo,
    resumo: [
      { rotulo: "Visitas", valor: String(itens.length) },
      { rotulo: "Realizadas", valor: String(cont("realizada")) },
      { rotulo: "Agendadas", valor: String(cont("agendada")) },
      { rotulo: "Não realizadas", valor: String(cont("nao_realizada")) },
    ],
    colunas: ["Data", "Cliente", "Cidade", "Situação", "Observação"],
    linhas: itens.map((v) => [dataBR(v.data), v.cliente.nome, v.cidade ?? "—", ROTULO_VISITA[v.status] ?? v.status, (v.observacao ?? "").slice(0, 200) || "—"]),
    cortado,
  };
}

async function parados(p: Pedido, agora: Date): Promise<RelatorioPronto> {
  const corte = new Date(agora.getTime() - p.diasParado * DIA);
  // Parada = aberta e sem contato há N dias. Sem nenhum contato gravado conta
  // pela data de criação (senão negociação esquecida desde o início sumiria).
  const rows = await db.negociacao.findMany({
    where: {
      status: "aberta",
      AND: [{ OR: [{ ultimoContato: { lt: corte } }, { AND: [{ ultimoContato: null }, { criadoEm: { lt: corte } }] }] }],
    },
    take: MAX + 1,
    select: {
      estagio: true, valor: true, ultimoContato: true, criadoEm: true, marca: true, maquinaModelo: true,
      cliente: { select: { nome: true } },
    },
  });
  const comDias = rows.map((r) => {
    const ref = r.ultimoContato ?? r.criadoEm;
    return { r, dias: Math.floor((agora.getTime() - ref.getTime()) / DIA) };
  }).sort((a, b) => b.dias - a.dias);
  const { itens, cortado } = cortar(comDias);
  return {
    tipo: "parados",
    titulo: ROTULO_TIPO.parados,
    subtitulo: `Sem contato há ${p.diasParado} dia(s) ou mais — retrato de agora (${dataBR(agora)})`,
    resumo: [
      { rotulo: "Paradas", valor: String(itens.length) },
      { rotulo: "Valor parado", valor: formatCurrency(itens.reduce((s, x) => s + (x.r.valor ?? 0), 0)) },
    ],
    colunas: ["Cliente", "Etapa", "Máquina", "Valor", "Dias sem contato"],
    linhas: itens.map(({ r, dias }) => [
      r.cliente.nome, r.estagio, [r.marca, r.maquinaModelo].filter(Boolean).join(" ") || "—", formatCurrency(r.valor), String(dias),
    ]),
    cortado,
  };
}

async function semResposta(agora: Date): Promise<RelatorioPronto> {
  // Mesma marca que a tela do Atendimento usa: Cliente.aguardandoResposta.
  const rows = await db.cliente.findMany({
    where: { aguardandoResposta: true },
    orderBy: { ultimoContato: "asc" },
    take: MAX + 1,
    select: { nome: true, telefone: true, ultimoContato: true },
  });
  const { itens, cortado } = cortar(rows);
  return {
    tipo: "sem_resposta",
    titulo: ROTULO_TIPO.sem_resposta,
    subtitulo: `Retrato de agora (${dataBR(agora)})`,
    resumo: [{ rotulo: "Aguardando resposta", valor: String(itens.length) }],
    colunas: ["Cliente", "Telefone", "Último contato"],
    linhas: itens.map((c) => [c.nome, c.telefone ?? "—", dataBR(c.ultimoContato)]),
    cortado,
  };
}

/** Monta o relatório pedido. Só leitura — não grava, não envia, não gasta IA. */
export async function montarRelatorio(p: Pedido, agora: Date = new Date()): Promise<RelatorioPronto> {
  switch (p.tipo) {
    case "vendas": return vendas(p);
    case "funil": return funil();
    case "visitas": return visitas(p);
    case "parados": return parados(p, agora);
    case "sem_resposta": return semResposta(agora);
  }
}
