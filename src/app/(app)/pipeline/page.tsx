import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { KanbanBoard } from "@/components/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const negociacoes = await db.negociacao.findMany({
    where: { status: "aberta" },
    include: { cliente: { include: { municipio: true } } },
    orderBy: { atualizadoEm: "desc" },
  });

  const cards = negociacoes.map((n) => ({
    id: n.id,
    estagio: n.estagio,
    cliente: n.cliente.nome,
    municipio: n.cliente.municipio?.nome ?? null,
    maquina: n.maquinaModelo,
    valor: n.valor,
    termometro: n.termometro,
    concorrente: n.concorrenteMencionado,
  }));

  return (
    <div>
      <PageHeader
        titulo="Pipeline"
        subtitulo="Arraste os cards entre as colunas para mover suas negociações"
      />
      <KanbanBoard cards={cards} />
    </div>
  );
}
