import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { KanbanBoard } from "@/components/KanbanBoard";
import { normalizarEstagio } from "@/lib/pipeline";
import { garantirColunasDemanda } from "@/lib/demandas";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  await garantirColunasDemanda();

  const [negociacoes, clientes, colunasDemanda, tarefas] = await Promise.all([
    db.negociacao.findMany({
      where: { status: { in: ["aberta", "perdida"] } },
      include: { cliente: { include: { municipio: true } } },
      orderBy: { atualizadoEm: "desc" },
    }),
    db.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.colunaDemanda.findMany({ orderBy: { ordem: "asc" } }),
    db.tarefaKanban.findMany({ orderBy: { ordem: "asc" } }),
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

  const colunas = colunasDemanda.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    cor: c.cor,
    fixa: c.fixa,
  }));

  const demandas = tarefas.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    descricao: t.descricao,
    coluna: t.coluna,
    checklist: t.checklist,
    clienteId: t.clienteId,
  }));

  return (
    <div>
      <PageHeader
        titulo="Pipeline"
        subtitulo="Demandas (estilo Trello) + funil de negociação — arraste, edite e gerencie colunas"
      />
      <KanbanBoard
        cards={cards}
        clientes={clientes}
        colunasDemanda={colunas}
        demandas={demandas}
      />
    </div>
  );
}
