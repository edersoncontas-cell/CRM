"use client";

import { useRouter } from "next/navigation";
import { CATEGORIAS } from "@/lib/comparativo";

interface Opt { id: string; marca: string; modelo: string; categoria: string; }

export function MaquinaPicker({ minhas, selecionada }: { minhas: Opt[]; selecionada?: string }) {
  const router = useRouter();
  // agrupa por categoria
  const grupos = minhas.reduce<Record<string, Opt[]>>((acc, m) => {
    (acc[m.categoria] ??= []).push(m);
    return acc;
  }, {});

  return (
    <select
      value={selecionada}
      onChange={(e) => router.push(`/comparativo?maquina=${e.target.value}`)}
      className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
    >
      {Object.entries(grupos).map(([cat, ms]) => (
        <optgroup key={cat} label={CATEGORIAS[cat] ?? cat}>
          {ms.map((m) => (
            <option key={m.id} value={m.id}>
              {m.marca} {m.modelo}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
