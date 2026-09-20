// Dados do painel "Visão geral de vendas" do Dashboard — tudo derivado das
// negociações GANHAS e FATURADAS (mesma fonte de verdade do Pós-venda), com
// o município vindo do cadastro do cliente. É lido a cada carregamento da
// página (force-dynamic) e pelo endpoint /api/dashboard/vendas-mapa, que o
// mapa consulta sozinho de tempos em tempos — por isso nada aqui é cacheado.

import { db } from "@/lib/db";
import { coordenadasMunicipioES } from "@/lib/municipios-es";
import { anosParaSeletor } from "@/lib/data-faturamento";

export const META_ANUAL_VENDAS = 40;

export type VendaDash = {
  id: string;
  valor: number;
  marca: string | null;
  modelo: string | null;
  faturadoEm: Date;
  clienteId: string;
  clienteNome: string;
  municipio: { id: string; nome: string; lat: number | null; lng: number | null } | null;
};

export type PontoVenda = {
  municipioId: string;
  nome: string;
  lat: number;
  lng: number;
  vendas: number;
  valor: number;
  ultimaVenda: string | null;
  // Quem comprou nessa cidade (para o balão do mapa listar os clientes).
  clientes: { id: string; nome: string; qtd: number; valor: number; modelos: string[] }[];
};

export async function carregarVendasFaturadas(): Promise<VendaDash[]> {
  const rows = await db.negociacao.findMany({
    where: { status: "ganha", faturadoEm: { not: null } },
    orderBy: { faturadoEm: "desc" },
    select: {
      id: true, valor: true, marca: true, maquinaModelo: true, faturadoEm: true,
      cliente: { select: { id: true, nome: true, municipio: { select: { id: true, nome: true, lat: true, lng: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    valor: r.valor ?? 0,
    marca: r.marca,
    modelo: r.maquinaModelo,
    faturadoEm: r.faturadoEm!,
    clienteId: r.cliente.id,
    clienteNome: r.cliente.nome,
    municipio: r.cliente.municipio,
  }));
}

const doAno = (vendas: VendaDash[], ano: number | null) =>
  ano == null ? vendas : vendas.filter((v) => v.faturadoEm.getFullYear() === ano);

// Cidades com venda -> ponto no mapa (coordenada do banco ou da tabela do ES).
export function pontosVendas(vendas: VendaDash[], ano: number | null): PontoVenda[] {
  const porMunicipio = new Map<string, PontoVenda>();
  for (const v of doAno(vendas, ano)) {
    if (!v.municipio) continue;
    const coords = v.municipio.lat != null && v.municipio.lng != null
      ? { lat: v.municipio.lat, lng: v.municipio.lng }
      : coordenadasMunicipioES(v.municipio.nome);
    if (!coords) continue;
    const atual: PontoVenda = porMunicipio.get(v.municipio.id) ?? {
      municipioId: v.municipio.id, nome: v.municipio.nome, lat: coords.lat, lng: coords.lng,
      vendas: 0, valor: 0, ultimaVenda: null, clientes: [],
    };
    atual.vendas += 1;
    atual.valor += v.valor;
    if (!atual.ultimaVenda || v.faturadoEm.toISOString() > atual.ultimaVenda) atual.ultimaVenda = v.faturadoEm.toISOString();
    const cli = atual.clientes.find((c) => c.id === v.clienteId);
    if (cli) {
      cli.qtd += 1; cli.valor += v.valor;
      if (v.modelo && !cli.modelos.includes(v.modelo)) cli.modelos.push(v.modelo);
    } else {
      atual.clientes.push({ id: v.clienteId, nome: v.clienteNome, qtd: 1, valor: v.valor, modelos: v.modelo ? [v.modelo] : [] });
    }
    porMunicipio.set(v.municipio.id, atual);
  }
  for (const p of porMunicipio.values()) p.clientes.sort((a, b) => b.valor - a.valor);
  return Array.from(porMunicipio.values()).sort((a, b) => b.vendas - a.vendas);
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function variacaoPct(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

export function resumoVendas(vendas: VendaDash[], ano: number, metaAnual: number = META_ANUAL_VENDAS) {
  const atual = doAno(vendas, ano);
  const anterior = doAno(vendas, ano - 1);

  const fat = atual.reduce((s, v) => s + v.valor, 0);
  const fatAnt = anterior.reduce((s, v) => s + v.valor, 0);
  const comValor = atual.filter((v) => v.valor > 0);
  const comValorAnt = anterior.filter((v) => v.valor > 0);
  const ticket = comValor.length ? fat / comValor.length : 0;
  const ticketAnt = comValorAnt.length ? fatAnt / comValorAnt.length : 0;
  const atingimento = Math.round((atual.length / metaAnual) * 100);
  const atingimentoAnt = Math.round((anterior.length / metaAnual) * 100);

  // Meses futuros do ano corrente ficam null (a linha do gráfico para no mês
  // atual em vez de "despencar" para zero até dezembro).
  const agora = new Date();
  const porMes = MESES.map((mes, i) => {
    const futuro = ano === agora.getFullYear() && i > agora.getMonth();
    const doMes = atual.filter((v) => v.faturadoEm.getMonth() === i);
    return {
      mes,
      vendas: futuro ? null : doMes.length,
      valor: futuro ? null : doMes.reduce((s, v) => s + v.valor, 0),
    };
  });

  // Ano impossível não vira chip. Era daqui que saía o "20" ao lado de 2026 e
  // 2025: uma venda com a data gravada errada virava "ano" no seletor.
  const anosDisponiveis = anosParaSeletor([new Date().getFullYear(), ...vendas.map((v) => v.faturadoEm.getFullYear())]);

  const ticketPorAno = anosDisponiveis
    .filter((a) => a <= ano)
    .slice(0, 3)
    .reverse()
    .map((a) => {
      const vs = doAno(vendas, a).filter((v) => v.valor > 0);
      return { ano: String(a), ticket: vs.length ? Math.round(vs.reduce((s, v) => s + v.valor, 0) / vs.length) : 0 };
    });

  const contar = (chave: (v: VendaDash) => string) => {
    const m = new Map<string, number>();
    for (const v of atual) m.set(chave(v), (m.get(chave(v)) ?? 0) + 1);
    return Array.from(m.entries()).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);
  };
  const porMarca = contar((v) => v.marca || "Sem marca");
  const porModelo = contar((v) => v.modelo || "Sem modelo").slice(0, 10);

  const porCliente = new Map<string, { nome: string; cidade: string | null; faturamento: number; qtd: number }>();
  for (const v of atual) {
    const c = porCliente.get(v.clienteId) ?? { nome: v.clienteNome, cidade: v.municipio?.nome ?? null, faturamento: 0, qtd: 0 };
    c.faturamento += v.valor; c.qtd += 1;
    porCliente.set(v.clienteId, c);
  }
  const topClientes = Array.from(porCliente.entries())
    .map(([id, c]) => ({ id, ...c, ticket: c.qtd ? c.faturamento / c.qtd : 0 }))
    .sort((a, b) => b.faturamento - a.faturamento || b.qtd - a.qtd);

  return {
    ano,
    anosDisponiveis,
    kpis: {
      faturamento: fat, faturamentoDelta: variacaoPct(fat, fatAnt),
      vendas: atual.length, vendasAnoAnterior: anterior.length,
      atingimento, atingimentoDelta: atingimentoAnt || atual.length ? atingimento - atingimentoAnt : null,
      ticket, ticketDelta: variacaoPct(ticket, ticketAnt),
    },
    porMes,
    metaMensal: metaAnual / 12,
    ticketPorAno,
    porMarca,
    porModelo,
    topClientes,
    pontosMapa: pontosVendas(vendas, ano),
    pontosMapaTudo: pontosVendas(vendas, null),
  };
}

export type ResumoVendas = ReturnType<typeof resumoVendas>;
