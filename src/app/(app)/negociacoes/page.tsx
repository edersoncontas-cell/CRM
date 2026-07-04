import { db } from "@/lib/db";
import { normalizarEstagio } from "@/lib/pipeline";
import { FunilNegociacoes } from "@/components/FunilNegociacoes";
import { PageHeader } from "@/components/ui";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";

export const dynamic = "force-dynamic";

export default async function NegociacoesPage() {
  await garantirManutencaoSeNecessario();

  const [negociacoes, clientes, colunasFunil, maquinasProprias] = await Promise.all([
    db.negociacao.findMany({
      where: { status: { in: ["aberta", "perdida", "ganha"] } },
      include: { cliente: { include: { municipio: true } } },
      orderBy: { atualizadoEm: "desc" },
    }),
    db.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.colunaFunil.findMany({ orderBy: { ordem: "asc" } }),
    db.maquina.findMany({ where: { proprio: true }, select: { marca: true, modelo: true }, orderBy: [{ marca: "asc" }, { modelo: "asc" }] }),
  ]);

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
  }));

  const colunas = colunasFunil.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    cor: c.cor,
    ordem: c.ordem,
    fixa: c.fixa,
  }));

  return (
    <div>
      <PageHeader
        titulo="Negociações"
        subtitulo="Funil de vendas — arraste os cards entre os estágios e gerencie suas oportunidades"
      />
      <FunilNegociacoes cards={cards} clientes={clientes} colunas={colunas} maquinasProprias={maquinasProprias} />
    </div>
  );
}
