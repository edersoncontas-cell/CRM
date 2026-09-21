import { db } from "@/lib/db";
import { anosParaSeletor, anoPlausivel } from "@/lib/anos-seletor";
import { normalizarEstagio } from "@/lib/pipeline";
import { FunilNegociacoes } from "@/components/FunilNegociacoes";
import { PageHeader } from "@/components/ui";
import { SeletorPeriodo } from "@/components/SeletorPeriodo";
import { intervaloDoPeriodo, mesDaUrl, rotuloPeriodo, type Periodo } from "@/lib/periodo-funil";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";

export const dynamic = "force-dynamic";

export default async function NegociacoesPage({
  searchParams,
}: {
  searchParams: { ano?: string; mes?: string };
}) {
  await garantirManutencaoSeNecessario();

  const anoAtual = new Date().getFullYear();
  // Ano vindo da URL também passa pela peneira: um link antigo com ?ano=20
  // filtraria por um ano que não existe e a tela viria vazia sem explicação.
  const anoSelecionado: number | "todos" = searchParams.ano === "todos"
    ? "todos"
    : (() => { const a = Number(searchParams.ano); return anoPlausivel(a, anoAtual) ? a : anoAtual; })();

  // O PERÍODO (ano e mês) recorta o HISTÓRICO — o que já aconteceu —, sempre
  // pela data de faturamento, com atualizadoEm só para registro antigo sem
  // faturadoEm preenchido.
  //
  // As colunas abertas NÃO são recortadas, de propósito: uma negociação que
  // nasceu em julho e continua de pé é trabalho de hoje, e sumir com ela ao
  // escolher "setembro" faria o vendedor perder negócio de vista dentro do
  // próprio funil. Período serve para olhar o que fechou, não para esconder o
  // que está aberto. Quem quer o recorte de entrada tem o contador de
  // "entraram no período" no cabeçalho de cada coluna aberta.
  const periodo: Periodo = { ano: anoSelecionado, mes: mesDaUrl(searchParams.mes) };
  const intervalo = intervaloDoPeriodo(periodo);
  const filtroPeriodo = (campo: "faturadoEm" | "atualizadoEm") =>
    intervalo ? { [campo]: { gte: intervalo.gte, lt: intervalo.lt } } : {};

  const [negociacoes, anosComDados, clientes, colunasFunil, maquinasProprias] = await Promise.all([
    db.negociacao.findMany({
      where: {
        OR: [
          { status: "aberta" },
          { status: "ganha", faturadoEm: { not: null }, ...filtroPeriodo("faturadoEm") },
          { status: "ganha", faturadoEm: null, ...filtroPeriodo("atualizadoEm") },
          { status: "perdida", ...filtroPeriodo("atualizadoEm") },
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

  // Só anos possíveis. Um registro com data digitada errada ("20/09/20" vira
  // o ano 20) fazia o seletor oferecer "20" ao lado de 2026 e 2025.
  const anosDisponiveis = anosParaSeletor(anoAtual, anosComDados.map((n) => n.faturadoEm ?? n.atualizadoEm));

  const cards = negociacoes.map((n) => ({
    id: n.id,
    estagio: normalizarEstagio(n.estagio),
    status: n.status,
    // Para o cabeçalho da coluna dizer quantas ENTRARAM no período escolhido,
    // sem precisar esconder as que estão abertas de antes.
    criadoEm: n.criadoEm.toISOString(),
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
        acao={<SeletorPeriodo basePath="/negociacoes" periodo={periodo} anosDisponiveis={anosDisponiveis} />}
      />
      <p className="-mt-4 mb-4 text-xs text-slate-400">
        O FATURADO mostra {rotuloPeriodo(periodo)}. Oportunidade, Proposta e Negociação mostram sempre tudo que está de pé — o número entre parênteses no topo de cada uma é quanto entrou no período. As perdidas têm página própria.
      </p>
      <FunilNegociacoes cards={cards} clientes={clientes} colunas={colunas} maquinasProprias={maquinasProprias} periodo={{ de: intervalo?.gte.toISOString() ?? null, ate: intervalo?.lt.toISOString() ?? null, rotulo: rotuloPeriodo(periodo) }} />
    </div>
  );
}
