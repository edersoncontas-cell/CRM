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
        subtitulo="Cada cliente com quem você conversou no período vira um card com a leitura da IA. ✓ registra a negociação no funil; ✗ tira o card (ele volta se chegar mensagem nova)."
      />
      <OrientadorLista itens={itens} contagem={contagem} periodo={periodo} />
    </div>
  );
}
