import { PageHeader } from "@/components/ui";
import { listarCentralAlertas } from "@/lib/central-alertas";
import { CentralAlertasClient } from "@/components/CentralAlertasClient";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";

export const dynamic = "force-dynamic";

export default async function AlertasPage({ searchParams }: { searchParams: { grupo?: string } }) {
  await garantirManutencaoSeNecessario();
  const { grupos, total, alta, graficos } = await listarCentralAlertas();

  return (
    <div>
      <PageHeader
        titulo="Central de alertas"
        subtitulo={total === 0
          ? "Nada pendente. Tudo o que pedir a sua ação aparece aqui."
          : `${total} item(ns) pedindo ação${alta ? ` · ${alta} urgente(s)` : ""}: clientes aguardando resposta, 30+ dias sem contato, negócios sem visita, alertas do ZEUS, pós-venda, visitas, demandas e meta. "Resolvido" tira o item da lista de vez — ele só volta se a situação mudar (marco novo, outro período sem contato).`}
      />
      <CentralAlertasClient grupos={grupos} graficos={graficos} grupoInicial={searchParams.grupo ?? null} />
    </div>
  );
}
