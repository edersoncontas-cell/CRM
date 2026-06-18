"use client";

import { useState, useTransition } from "react";
import { toggleMaquinaComercializada, setVolumeVendas } from "@/lib/actions";
import { Star, TrendingUp } from "lucide-react";

type Maquina = {
  id: string;
  marca: string;
  modelo: string;
  categoria: string;
  maisComercializado: boolean;
  volumeVendas: number;
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

const MEDALHA = ["🥇", "🥈", "🥉"];

function MaquinaCard({ m, rank }: { m: Maquina; rank: number | null }) {
  const [pending, start] = useTransition();
  const [vendas, setVendas] = useState(String(m.volumeVendas || ""));

  function toggleFoco() {
    start(() => toggleMaquinaComercializada(m.id, !m.maisComercializado));
  }

  function salvarVendas() {
    const valor = parseInt(vendas, 10) || 0;
    if (valor === m.volumeVendas) return;
    start(() => setVolumeVendas(m.id, valor));
  }

  return (
    <div
      className={`relative rounded-xl border p-4 transition-all duration-200 ${
        m.maisComercializado
          ? "border-yellow-500/60 bg-yellow-500/10 shadow-sm shadow-yellow-500/20"
          : "border-zinc-700/60 bg-zinc-800/50"
      } ${pending ? "opacity-60" : ""}`}
    >
      {/* Selo de ranking de vendas */}
      {rank !== null && (
        <span
          title={`#${rank + 1} mais vendida`}
          className="absolute top-2 left-2 inline-flex items-center gap-0.5 rounded-full bg-zinc-900/80 px-1.5 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/30"
        >
          {rank < 3 ? MEDALHA[rank] : <span className="text-zinc-400">#{rank + 1}</span>}
        </span>
      )}

      {/* Botão de foco (estrela) */}
      <button
        onClick={toggleFoco}
        disabled={pending}
        title={m.maisComercializado ? "Remover dos modelos em foco" : "Marcar como modelo em foco"}
        className="absolute top-2 right-2 p-1 rounded-md hover:bg-zinc-700/50 transition-colors"
      >
        <Star
          size={15}
          className={m.maisComercializado ? "fill-yellow-400 text-yellow-400" : "text-zinc-500"}
        />
      </button>

      <div className="text-xs font-semibold mb-1 mt-3" style={{ color: m.marca === "New Holland" ? "#BFDE4D" : "#60a5fa" }}>
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

      {/* Editor de volume de vendas */}
      <div className="mt-3 pt-3 border-t border-zinc-700/40 flex items-center gap-2">
        <TrendingUp size={13} className="text-emerald-400 shrink-0" />
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={vendas}
          onChange={(e) => setVendas(e.target.value)}
          onBlur={salvarVendas}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="0"
          disabled={pending}
          className="w-14 bg-zinc-900/60 border border-zinc-700 rounded px-2 py-1 text-xs text-white text-right focus:border-emerald-500/60 focus:outline-none"
        />
        <span className="text-[11px] text-zinc-500">un. vendidas</span>
      </div>
    </div>
  );
}

function Secao({ marca, maquinas, rankMap }: { marca: string; maquinas: Maquina[]; rankMap: Map<string, number> }) {
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
      {Object.entries(grupos).map(([cat, lista]) => {
        // Dentro da categoria, mais vendidas primeiro
        const ordenada = [...lista].sort(
          (a, b) => b.volumeVendas - a.volumeVendas || a.modelo.localeCompare(b.modelo),
        );
        return (
          <div key={cat} className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">{cat}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {ordenada.map((m) => (
                <MaquinaCard key={m.id} m={m} rank={rankMap.get(m.id) ?? null} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MaquinasClient({ maquinas }: { maquinas: Maquina[] }) {
  const nh = maquinas.filter((m) => m.marca === "New Holland");
  const dy = maquinas.filter((m) => m.marca === "Dynapac");
  const outros = maquinas.filter((m) => m.marca !== "New Holland" && m.marca !== "Dynapac");
  const emFoco = maquinas.filter((m) => m.maisComercializado);

  // Ranking global de vendas (só máquinas com vendas > 0)
  const vendidas = maquinas.filter((m) => m.volumeVendas > 0).sort((a, b) => b.volumeVendas - a.volumeVendas);
  const rankMap = new Map<string, number>();
  vendidas.forEach((m, i) => rankMap.set(m.id, i));
  const topVendas = vendidas.slice(0, 5);

  return (
    <div>
      {topVendas.length > 0 && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-300">
              Mais vendidas na sua região
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {topVendas.map((m, i) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200"
              >
                <span>{i < 3 ? MEDALHA[i] : `#${i + 1}`}</span>
                {m.marca} {m.modelo}
                <span className="text-emerald-400/70">· {m.volumeVendas} un.</span>
              </span>
            ))}
          </div>
        </div>
      )}

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

      {nh.length > 0 && <Secao marca="New Holland" maquinas={nh} rankMap={rankMap} />}
      {dy.length > 0 && <Secao marca="Dynapac" maquinas={dy} rankMap={rankMap} />}
      {outros.length > 0 && <Secao marca="Outros" maquinas={outros} rankMap={rankMap} />}
    </div>
  );
}
