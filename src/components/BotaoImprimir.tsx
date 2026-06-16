"use client";

import { Printer } from "lucide-react";

export function BotaoImprimir() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700"
    >
      <Printer size={18} /> Imprimir / Salvar PDF
    </button>
  );
}
