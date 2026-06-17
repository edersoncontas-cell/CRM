import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { KanbanBoard } from "@/components/KanbanBoard";
import { normalizarEstagio } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [negociacoes, clientes] = await Promise.all([
    db.negociacao.findMany({
      where: { status: { in: ["aberta", "perdida"] } },
      include: { cliente: { include: { municipio: true } } },
      orderBy: { atualizadoEm: "desc" },
    }),
    db.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
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

  return (
    <div>
      <PageHeader
        titulo="Pipeline"
        subtitulo="Arraste, clique para editar e use “+ Adicionar” para criar cards — estilo Trello"
      />
      <KanbanBoard cards={cards} clientes={clientes} />
    </div>
  );
}
