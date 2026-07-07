"use client";

import { useState, useTransition } from "react";
import { atualizarCotacaoCafeAction } from "@/lib/actions";
import { Coffee, CheckCircle2 } from "lucide-react";

export function AtualizarCotacaoCafeForm({
  arabica,
  conilon,
}: {
  arabica: number | null;
  conilon: number | null;
}) {
  const [salvando, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  return (
    <form
      action={(fd) => {
        setSalvo(false);
        startTransition(async () => {
          await atualizarCotacaoCafeAction(fd);
          setSalvo(true);
          setTimeout(() => setSalvo(false), 3000);
        });
      }}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end"
    >
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Arábica (R$/sc 60kg)</label>
        <input name="arabica" defaultValue={arabica ?? ""} inputMode="decimal" placeholder="Ex: 1636,25" className="campo" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Conilon (R$/sc 60kg)</label>
        <input name="conilon" defaultValue={conilon ?? ""} inputMode="decimal" placeholder="Ex: 1070,57" className="campo" />
      </div>
      <button disabled={salvando} className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        {salvo ? <CheckCircle2 size={16} /> : <Coffee size={16} />} {salvando ? "Salvando…" : salvo ? "Salvo!" : "Atualizar"}
      </button>
    </form>
  );
}
