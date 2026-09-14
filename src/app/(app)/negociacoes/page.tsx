import { db } from "@/lib/db";
import { normalizarEstagio } from "@/lib/pipeline";
import { FunilNegociacoes } from "@/components/FunilNegociacoes";
import { PageHeader } from "@/components/ui";
import { SeletorAno } from "@/components/SeletorAno";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";

export const dynamic = "force-dynamic";

export default async function NegociacoesPage({
  searchParams,
}: {
  searchParams: { ano?: string };
}) {
  await garantirManutencaoSeNecessario();

  const anoAtual = new Date().getFullYear();
  const anoSelecionado: number | "todos" = searchParams.ano === "todos" ? "todos" : Number(searchParams.ano) || anoAtual;

  // Ganhas/perdidas (histórico) respeitam o ano selecionado — sempre pela
  // data de faturamento (faturadoEm), com atualizadoEm como base só para
  // registros antigos sem faturadoEm preenchido. Em aberto nunca filtra por
  // ano: é o pipeline vivo, não histórico.
  const filtroAno = (campo: "faturadoEm" | "atualizadoEm") =>
    anoSelecionado === "todos"
      ? {}
      : { [campo]: { gte: new Date(anoSelecionado, 0, 1), lt: new Date(anoSelecionado + 1, 0, 1) } };

  const [negociacoes, anosComDados, clientes, colunasFunil, maquinasProprias] = await Promise.all([
    db.negociacao.findMany({
      where: {
        OR: [
          { status: "aberta" },
          { status: "ganha", faturadoEm: { not: null }, ...filtroAno("faturadoEm") },
          { status: "ganha", faturadoEm: null, ...filtroAno("atualizadoEm") },
          { status: "perdida", ...filtroAno("atualizadoEm") },
        ],
      },
      include: { cliente: { include: { municipio: true } } },
      orderBy: { atualizadoEm: "desc" },
    }),
    db.negociacao.findMany({
      where: { status: { in: ["ganha", "perdida"] } },
      select: { faturadoEm: true, atualizadoEm: true },
    }),
    db.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.colunaFunil.findMany({ orderBy: { ordem: "asc" } }),
    db.maquina.findMany({ where: { proprio: true }, select: { marca: true, modelo: true }, orderBy: [{ marca: "asc" }, { modelo: "asc" }] }),
  ]);

  const anosDisponiveis = Array.from(
    new Set([anoAtual, ...anosComDados.map((n) => (n.faturadoEm ?? n.atualizadoEm).getFullYear())])
  ).sort((a, b) => b - a);

  const cards = negociacoes.map((n) => ({
    id: n.id,
    estagio: normalizarEstagio(n.estagio),
    status: n.status,
    clienteId: n.clienteId,
    cliente: n.cliente.nome,
    municipio: n.cliente.municipio?.nome ?? null,
    maquina: n.maquinaModelo,
    valor: n.valor,
    termometro: n.termometro,
    concorrente: n.concorrenteMencionado,
    condicaoPagamento: n.condicaoPagamento,
    dataVisita: n.dataVisita ? n.dataVisita.toISOString() : null,
    proximaAcao: n.proximaAcao,
    marca: n.marca,
    bancoFinanciamento: n.bancoFinanciamento,
    entradaValor: n.entradaValor,
    entradaPercentual: n.entradaPercentual,
    dataPagamentoAvista: n.dataPagamentoAvista ? n.dataPagamentoAvista.toISOString() : null,
    pagamentoNaEntrega: n.pagamentoNaEntrega,
    consorcioTipo: n.consorcioTipo,
    consorcioCotas: n.consorcioCotas,
    consorcioCredito: n.consorcioCredito,
    crdSaldoParcelasQtd: n.crdSaldoParcelasQtd,
    faturadoEm: n.faturadoEm ? n.faturadoEm.toISOString() : null,
    motivoPerda: n.motivoPerda,
    usadaTroca: n.usadaTroca,
    usadaMarca: n.usadaMarca,
    usadaModelo: n.usadaModelo,
    usadaAno: n.usadaAno,
    usadaHorimetro: n.usadaHorimetro,
    usadaEstado: n.usadaEstado,
    usadaValor: n.usadaValor,
    usadaObs: n.usadaObs,
  }));

  const colunas = colunasFunil.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    cor: c.cor,
    ordem: c.ordem,
    fixa: c.fixa,
    papel: c.papel,
    probabilidade: c.probabilidade,
  }));

  return (
    <div>
      <PageHeader
        titulo="Negociações"
        subtitulo="Funil de vendas — arraste os cards entre os estágios e gerencie suas oportunidades"
        acao={<SeletorAno basePath="/negociacoes" anoSelecionado={anoSelecionado} anosDisponiveis={anosDisponiveis} />}
      />
      <p className="-mt-4 mb-4 text-xs text-slate-400">
        Faturados/Perdidos mostrando {anoSelecionado === "todos" ? "todos os anos" : anoSelecionado}. Em negociação/Em banco sempre mostram tudo em aberto, sem filtro de ano.
      </p>
      <FunilNegociacoes cards={cards} clientes={clientes} colunas={colunas} maquinasProprias={maquinasProprias} />
    </div>
  );
}
