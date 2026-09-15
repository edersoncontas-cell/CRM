import { PageHeader } from "@/components/ui";
import { listarOrientadorPorPeriodo, contarClientesConversados } from "@/lib/actions";
import { OrientadorLista } from "@/components/OrientadorLista";
import { periodoValido } from "@/lib/orientador-periodos";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";

export const dynamic = "force-dynamic";

export default async function OrientadorPage({ searchParams }: { searchParams: { periodo?: string } }) {
  await garantirManutencaoSeNecessario();
  const periodo = periodoValido(searchParams.periodo);
  const [itens, contagem] = await Promise.all([listarOrientadorPorPeriodo(periodo), contarClientesConversados()]);

  return (
    <div>
      <PageHeader
        titulo="Orientador de Vendas"
        subtitulo="A leitura da IA de cada cliente com quem você conversou no período. A negociação entra no funil sozinha quando a conversa levanta máquina + condição de pagamento ou visita — para tirar ou editar um card, use o próprio funil."
      />
      <OrientadorLista itens={itens} contagem={contagem} periodo={periodo} />
    </div>
  );
}
