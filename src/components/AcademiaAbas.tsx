"use client";

import { useState } from "react";
import { GraduationCap, Library, Footprints } from "lucide-react";
import { cn } from "@/lib/utils";

// Abas da Academia: Trilha de Formação (currículo por níveis) e Biblioteca
// (material de referência + gerador de estratégias). Recebe os dois painéis
// já renderizados pelo servidor.
export function AcademiaAbas({ trilha, etapas, biblioteca }: { trilha: React.ReactNode; etapas: React.ReactNode; biblioteca: React.ReactNode }) {
  const [aba, setAba] = useState<"etapas" | "trilha" | "biblioteca">("etapas");
  const abas = [
    { id: "etapas" as const, label: "Etapas da Venda", icon: Footprints },
    { id: "trilha" as const, label: "Trilha de Formação", icon: GraduationCap },
    { id: "biblioteca" as const, label: "Biblioteca de referência", icon: Library },
  ];
  return (
    <div>
      <div className="mb-4 flex gap-2">
        {abas.map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition", aba === a.id ? "bg-slate-900 text-agro-400" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
            <a.icon size={16} /> {a.label}
          </button>
        ))}
      </div>
      <div hidden={aba !== "etapas"}>{etapas}</div>
      <div hidden={aba !== "trilha"}>{trilha}</div>
      <div hidden={aba !== "biblioteca"}>{biblioteca}</div>
    </div>
  );
}
