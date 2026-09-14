import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { DemandasLista } from "@/components/DemandasLista";
import { listarDemandas } from "@/lib/demandas";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";

export const dynamic = "force-dynamic";

export default async function DemandasPage() {
  await garantirManutencaoSeNecessario();
  const [clientes, { grupos, abertas, atrasadas, hoje }] = await Promise.all([
    db.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    listarDemandas(),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Demandas"
        subtitulo="Uma lista só, por prazo: o que você anota e o que o CRM cria sozinho (ligações e visitas da cadência, marcos de pós-venda, próximas ações do Orientador). Toque no círculo para concluir."
      />
      <DemandasLista grupos={grupos} clientes={clientes} abertas={abertas} atrasadas={atrasadas} hoje={hoje} />
    </div>
  );
}
