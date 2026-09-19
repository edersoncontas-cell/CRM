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
        subtitulo="Seu gerente de vendas lendo cada conversa: quem atacar primeiro, o que perguntar agora, como falar com aquele cliente e o que falta para fechar. A negociação entra no funil sozinha quando a conversa levanta máquina + pagamento ou visita."
      />
      <OrientadorLista itens={itens} contagem={contagem} periodo={periodo} />
    </div>
  );
}
