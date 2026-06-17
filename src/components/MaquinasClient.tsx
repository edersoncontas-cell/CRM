"use client";

import { useTransition } from "react";
import { toggleMaquinaComercializada } from "@/lib/actions";
import { Star } from "lucide-react";

type Maquina = {
  id: string;
  marca: string;
  modelo: string;
  categoria: string;
  maisComercializado: boolean;
  potencia: number | null;
  pesoOperacional: number | null;
};

const CAT_LABEL: Record<string, string> = {
  miniescavadeira: "Mini Escavadeira",
  escavadeira: "Escavadeira",
  retroescavadeira: "Retroescavadeira",
  pacarregadeira: "Pá Carregadeira",
  motoniveladora: "Motoniveladora",
  tratoresteira: "Trator de Esteira",
  minicarregadeira: "Minicarregadeira",
  rolo_solo: "Rolo de Solo",
  rolo_tandem: "Rolo Tandem",
  rolo_pneumatico: "Rolo Pneumático",
  paver: "Paver",
  leve: "Leve",
};

function MaquinaCard({ m }: { m: Maquina }) {
  const [pending, start] = useTransition();

  function toggle() {
    start(() => toggleMaquinaComercializada(m.id, !m.maisComercializado));
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={m.maisComercializado ? "Remover dos modelos em foco" : "Marcar como modelo em foco"}
      className={`relative text-left rounded-xl border p-4 transition-all duration-200 w-full ${
        m.maisComercializado
          ? "border-yellow-500/60 bg-yellow-500/10 shadow-sm shadow-yellow-500/20"
          : "border-zinc-700/60 bg-zinc-800/50 hover:border-zinc-600"
      } ${pending ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
    >
      {m.maisComercializado && (
        <Star
          size={14}
          className="absolute top-3 right-3 fill-yellow-400 text-yellow-400"
        />
      )}
      <div className="text-xs font-semibold mb-1" style={{ color: m.marca === "New Holland" ? "#BFDE4D" : "#60a5fa" }}>
        {m.marca}
      </div>
      <div className="text-base font-bold text-white leading-tight">{m.modelo}</div>
      <div className="text-xs text-zinc-400 mt-1">{CAT_LABEL[m.categoria] ?? m.categoria}</div>
      {(m.potencia || m.pesoOperacional) && (
        <div className="mt-2 flex gap-3 text-xs text-zinc-500">
          {m.potencia && <span>{m.potencia} cv</span>}
          {m.pesoOperacional && <span>{(m.pesoOperacional / 1000).toFixed(1)} t</span>}
        </div>
      )}
    </button>
  );
}

function Secao({ marca, maquinas }: { marca: string; maquinas: Maquina[] }) {
  const cor = marca === "New Holland" ? "#BFDE4D" : "#60a5fa";
  // Agrupa por categoria
  const grupos = maquinas.reduce<Record<string, Maquina[]>>((acc, m) => {
    const label = CAT_LABEL[m.categoria] ?? m.categoria;
    if (!acc[label]) acc[label] = [];
    acc[label].push(m);
    return acc;
  }, {});

  return (
    <div className="mb-10">
      <h2 className="text-lg font-bold mb-4" style={{ color: cor }}>
        {marca}
      </h2>
      {Object.entries(grupos).map(([cat, lista]) => (
        <div key={cat} className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">{cat}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {lista.map((m) => (
              <MaquinaCard key={m.id} m={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MaquinasClient({ maquinas }: { maquinas: Maquina[] }) {
  const nh = maquinas.filter((m) => m.marca === "New Holland");
  const dy = maquinas.filter((m) => m.marca === "Dynapac");
  const outros = maquinas.filter((m) => m.marca !== "New Holland" && m.marca !== "Dynapac");
  const emFoco = maquinas.filter((m) => m.maisComercializado);

  return (
    <div>
      {emFoco.length > 0 && (
        <div className="mb-8 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-300">
              {emFoco.length} modelo{emFoco.length > 1 ? "s" : ""} em foco — a IA prioriza estes nas análises
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {emFoco.map((m) => (
              <span key={m.id} className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-300">
                {m.marca} {m.modelo}
              </span>
            ))}
          </div>
        </div>
      )}

      {nh.length > 0 && <Secao marca="New Holland" maquinas={nh} />}
      {dy.length > 0 && <Secao marca="Dynapac" maquinas={dy} />}
      {outros.length > 0 && <Secao marca="Outros" maquinas={outros} />}
    </div>
  );
}
