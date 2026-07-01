import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { KanbanBoard } from "@/components/KanbanBoard";
import { garantirColunasDemanda } from "@/lib/demandas";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  await garantirColunasDemanda();

  const [clientes, colunasDemanda, tarefas] = await Promise.all([
    db.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.colunaDemanda.findMany({ orderBy: { ordem: "asc" } }),
    db.tarefaKanban.findMany({ orderBy: { ordem: "asc" } }),
  ]);

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
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    cidade: t.cidade ?? null,
  }));

  return (
    <div>
      <PageHeader
        titulo="Demandas"
        subtitulo="Organize suas tarefas e demandas em colunas estilo Kanban"
      />
      <KanbanBoard
        cards={[]}
        clientes={clientes}
        colunasDemanda={colunas}
        demandas={demandas}
      />
    </div>
  );
}
