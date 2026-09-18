import { db } from "@/lib/db";
import { iaHabilitada } from "@/lib/ai";
import { FichasTecnicasClient } from "@/components/FichasTecnicasClient";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FichasTecnicasPage() {
  const maquinas = await db.maquina.findMany({
    select: {
      id: true,
      marca: true,
      modelo: true,
      categoria: true,
      proprio: true,
      potencia: true,
      pesoOperacional: true,
      descricao: true,
      especificacoes: true,
      pontosFortes: true,
      diferenciais: true,
      valorInicial: true,
      consumoLitrosHora: true,
      argumentos: true,
    },
    orderBy: [{ proprio: "desc" }, { marca: "asc" }, { categoria: "asc" }, { modelo: "asc" }],
  });

  const temChaveIA = iaHabilitada();

  return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-4 p-4 sm:-m-6 sm:p-6 md:-m-8 md:p-8">
      <div className="mb-7">
        <div className="flex items-center gap-3 mb-1">
          <div className="rounded-xl p-2" style={{ background: "rgba(96,165,250,0.1)" }}>
            <FileText size={22} style={{ color: "#60a5fa" }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Fichas Técnicas</h1>
        </div>
        <p className="text-sm ml-1 mt-1" style={{ color: "#71717a" }}>
          Cadastre as <span style={{ color: "#60a5fa" }}>características técnicas</span> das suas máquinas e dos
          concorrentes. Quanto mais completo, mais <span style={{ color: "#BFDE4D" }}>preciso</span> fica o comparativo
          e os argumentos que a IA monta para você.
        </p>
      </div>

      <FichasTecnicasClient maquinas={maquinas} temChaveIA={temChaveIA} />
    </div>
  );
}
