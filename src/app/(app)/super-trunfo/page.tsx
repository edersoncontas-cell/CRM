import { db } from "@/lib/db";
import { SuperTrunfoClient } from "@/components/SuperTrunfoClient";
import { montarDeck, type MaqTrunfo } from "@/lib/super-trunfo";
import { garantirFichasVerificadas } from "@/lib/fichas-verificadas";
import { Swords } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuperTrunfoPage() {
  await garantirFichasVerificadas();

  const maquinas = (await db.maquina.findMany({
    select: {
      id: true,
      marca: true,
      modelo: true,
      categoria: true,
      proprio: true,
      pesoOperacional: true,
      potencia: true,
      especificacoes: true,
      pontosFortes: true,
    },
  })) as MaqTrunfo[];

  const decks = montarDeck(maquinas);

  return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-6 p-6 md:-m-8 md:p-8">
      <div className="mb-7">
        <div className="flex items-center gap-3 mb-1">
          <div className="rounded-xl p-2" style={{ background: "rgba(191,222,77,0.1)" }}>
            <Swords size={22} style={{ color: "#BFDE4D" }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Super Trunfo — Comparativo Pro</h1>
        </div>
        <p className="text-sm ml-1 mt-1" style={{ color: "#71717a" }}>
          Suas máquinas <span style={{ color: "#BFDE4D" }}>New Holland</span> e{" "}
          <span style={{ color: "#60a5fa" }}>Dynapac</span> lado a lado com os concorrentes, por categoria —
          fichas técnicas + análise e argumentos de venda gerados pela IA.
        </p>
      </div>

      {decks.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma máquina cadastrada ainda.</p>
      ) : (
        <SuperTrunfoClient decks={decks} />
      )}
    </div>
  );
}
