"use client";

import { X } from "lucide-react";
import type { PrintLocal } from "./usePrints";

export function MiniaturasPrints({ prints, remover }: { prints: PrintLocal[]; remover: (id: string) => void }) {
  if (!prints.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {prints.map((p) => (
        <div key={p.id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.previa} alt={p.nome} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => remover(p.id)}
            className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white"
            aria-label={`Tirar ${p.nome}`}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
