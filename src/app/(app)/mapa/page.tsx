import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { MapaWrapper } from "@/components/MapaWrapper";
import type { PontoMapa } from "@/components/MapaClientes";

export const dynamic = "force-dynamic";

export default async function MapaPage() {
  const municipios = await db.municipio.findMany({
    include: {
      clientes: {
        include: { negociacoes: { where: { status: "aberta" } } },
      },
    },
  });

  const pontos: PontoMapa[] = municipios
    .filter((m) => m.lat != null && m.lng != null)
    .map((m) => ({
      id: m.id,
      nome: m.nome,
      lat: m.lat!,
      lng: m.lng!,
      clientes: m.clientes.length,
      pipeline: m.clientes.reduce(
        (s, c) => s + c.negociacoes.reduce((ss, n) => ss + (n.valor ?? 0), 0),
        0
      ),
    }));

  return (
    <div>
      <PageHeader
        titulo="Mapa de clientes"
        subtitulo="Onde estão seus clientes no sul do ES — o tamanho do círculo mostra a concentração"
      />
      <MapaWrapper pontos={pontos} />
    </div>
  );
}
