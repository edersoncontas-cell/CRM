import { PageHeader } from "@/components/ui";
import { listarCentralAlertas } from "@/lib/central-alertas";
import { CentralAlertasClient } from "@/components/CentralAlertasClient";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";

export const dynamic = "force-dynamic";

export default async function AlertasPage() {
  await garantirManutencaoSeNecessario();
  const { grupos, total, alta } = await listarCentralAlertas();

  return (
    <div>
      <PageHeader
        titulo="Central de alertas"
        subtitulo={total === 0
          ? "Nada pendente. Tudo o que pedir a sua ação aparece aqui."
          : `${total} item(ns) pedindo ação${alta ? ` · ${alta} urgente(s)` : ""}: rascunhos da IA, clientes aguardando resposta, alertas do ZEUS, pós-venda, visitas, demandas e sistema.`}
      />
      <CentralAlertasClient grupos={grupos} />
    </div>
  );
}
