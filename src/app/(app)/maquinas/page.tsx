import { db } from "@/lib/db";
import { MaquinasClient } from "@/components/MaquinasClient";
import { garantirMaquinasNovas } from "@/lib/maquinas-garantidas";
import { Star } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MaquinasPage() {
  await garantirMaquinasNovas();
  const maquinas = await db.maquina.findMany({
    where: { proprio: true },
    select: {
      id: true,
      marca: true,
      modelo: true,
      categoria: true,
      maisComercializado: true,
      volumeVendas: true,
      potencia: true,
      pesoOperacional: true,
    },
    orderBy: [{ marca: "asc" }, { categoria: "asc" }, { modelo: "asc" }],
  });

  return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-6 p-6 md:-m-8 md:p-8">
      <div className="mb-7">
        <div className="flex items-center gap-3 mb-1">
          <div className="rounded-xl p-2" style={{ background: "rgba(250,204,21,0.1)" }}>
            <Star size={22} className="fill-yellow-400 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Modelos em Foco</h1>
        </div>
        <p className="text-sm ml-1 mt-1" style={{ color: "#71717a" }}>
          Toque na <span style={{ color: "#facc15" }}>estrela</span> para marcar os modelos que você
          mais negocia (a IA prioriza esses nas análises). Informe as{" "}
          <span style={{ color: "#34d399" }}>unidades vendidas</span> de cada um para montar o
          ranking das mais vendidas na sua região.
        </p>
      </div>

      <MaquinasClient maquinas={maquinas} />
    </div>
  );
}
