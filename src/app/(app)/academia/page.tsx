import { AcademiaClient } from "@/components/AcademiaClient";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { dicaDoDia } from "@/lib/academia";

export const dynamic = "force-dynamic";

export default async function AcademiaPage() {
  const estrategias = await db.estrategiaVenda.findMany({
    orderBy: [{ favorito: "desc" }, { criadoEm: "desc" }],
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Academia de Vendas"
        subtitulo="As melhores técnicas de vendas do mundo · adaptadas a máquinas pesadas"
      />
      <AcademiaClient
        estrategias={estrategias.map((e) => ({
          id: e.id,
          titulo: e.titulo,
          categoria: e.categoria,
          perfilAlvo: e.perfilAlvo,
          conteudo: e.conteudo,
          fonte: e.fonte,
          favorito: e.favorito,
          criadoEm: e.criadoEm.toISOString(),
        }))}
        dicaDoDia={dicaDoDia()}
      />
    </div>
  );
}
