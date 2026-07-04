"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Opt { id: string; marca: string; modelo: string; categoria: string; }

// Seleção Marca → Modelo (Comparativo 2.0, item J.1): primeiro dropdown só
// com as marcas próprias (New Holland/Dynapac), segundo filtrado pelos
// modelos da marca escolhida.
export function MaquinaPicker({ minhas, selecionada }: { minhas: Opt[]; selecionada?: string }) {
  const router = useRouter();
  const atual = minhas.find((m) => m.id === selecionada);
  const [marca, setMarca] = useState(atual?.marca ?? minhas[0]?.marca ?? "");

  const marcas = Array.from(new Set(minhas.map((m) => m.marca)));
  const modelos = minhas.filter((m) => m.marca === marca);

  function irPara(id: string) {
    if (id) router.push(`/comparativo?maquina=${id}`);
  }

  function mudarMarca(novaMarca: string) {
    setMarca(novaMarca);
    const primeiro = minhas.find((m) => m.marca === novaMarca);
    if (primeiro) irPara(primeiro.id);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={marca}
        onChange={(e) => mudarMarca(e.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      >
        {marcas.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        value={selecionada}
        onChange={(e) => irPara(e.target.value)}
        className="min-w-40 flex-1 max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      >
        {modelos.map((m) => (
          <option key={m.id} value={m.id}>{m.modelo}</option>
        ))}
      </select>
    </div>
  );
}
