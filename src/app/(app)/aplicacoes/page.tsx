import { PageHeader } from "@/components/ui";
import { listarAplicacoesMaquinas } from "@/lib/actions";
import { AplicacoesClient } from "@/components/AplicacoesClient";

export const dynamic = "force-dynamic";

export default async function AplicacoesPage() {
  const maquinas = await listarAplicacoesMaquinas();

  return (
    <div>
      <PageHeader
        titulo="Aplicações & Nichos"
        subtitulo="Para cada máquina própria, todos os segmentos de mercado e operações onde ela se aplica — use para descobrir nichos de cliente que você ainda não está prospectando."
      />
      <AplicacoesClient maquinas={maquinas} />
    </div>
  );
}
