"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Target, Loader2 } from "lucide-react";
import { Card } from "@/components/ui";
import { ligarMetasAction } from "@/lib/metas-actions";

// Liga/desliga a tela de Metas e supermetas. Nasce desligado; desligar não
// apaga nenhuma meta e o Dashboard volta a usar a meta anual de Parâmetros.
export function MetasLigarCard({ ligado }: { ligado: boolean }) {
  const [estado, setEstado] = useState(ligado);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, start] = useTransition();

  function alternar() {
    const novo = !estado;
    setErro(null);
    start(async () => {
      const r = await ligarMetasAction(novo);
      if (r.ok) setEstado(novo);
      else setErro(r.erro ?? "Não salvou.");
    });
  }

  return (
    <Card className="mb-6">
      <div id="metas" className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <h2 className="flex items-center gap-2 font-bold"><Target size={18} /> Metas e supermetas</h2>
          <p className="mt-1 text-sm text-slate-600">
            Metas por período (mensal a anual) de máquinas, faturamento, visitas ou negociações, com supermeta e
            recompensa. Ligado, a meta anual cadastrada lá passa a valer no Dashboard e no Zeus, e o Dashboard ganha
            o bloco “Meu mês” no topo. Desligar volta ao número de Parâmetros, tira o bloco e não apaga nada.
          </p>
          {estado && <Link href="/metas" className="mt-1 inline-block text-sm font-semibold underline">Ver metas</Link>}
          {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
        </div>
        <button
          type="button"
          onClick={alternar}
          disabled={salvando}
          aria-pressed={estado}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${estado ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-700"}`}
        >
          {salvando && <Loader2 size={15} className="animate-spin" />}
          {estado ? "Ligado — desligar" : "Desligado — ligar"}
        </button>
      </div>
    </Card>
  );
}
