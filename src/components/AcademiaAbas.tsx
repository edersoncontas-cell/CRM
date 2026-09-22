"use client";

import { useState } from "react";
import { GraduationCap, Library, Footprints, Target } from "lucide-react";
import { cn } from "@/lib/utils";

// Abas da Academia. Recebe os painéis já renderizados pelo servidor.
//
// "Feito para você" abre primeiro, e é de propósito: a Academia tem 60 aulas e
// 7 etapas, e quem abre um catálogo desse tamanho sem saber por onde começar
// fecha e vai fazer outra coisa. A primeira aba responde "por onde eu começo"
// com os números dele — o resto continua lá, para quem quiser estudar na
// ordem do currículo.
export function AcademiaAbas({ plano, trilha, etapas, biblioteca }: { plano: React.ReactNode; trilha: React.ReactNode; etapas: React.ReactNode; biblioteca: React.ReactNode }) {
  const [aba, setAba] = useState<"plano" | "etapas" | "trilha" | "biblioteca">("plano");
  const abas = [
    { id: "plano" as const, label: "Feito para você", icon: Target },
    { id: "etapas" as const, label: "Etapas da Venda", icon: Footprints },
    { id: "trilha" as const, label: "Trilha de Formação", icon: GraduationCap },
    { id: "biblioteca" as const, label: "Biblioteca de referência", icon: Library },
  ];
  return (
    <div>
      {/* Quatro abas não cabem numa linha de celular: quebra em vez de estourar. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {abas.map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)}
            /* Compactas no celular: com quatro abas, o tamanho do PC empilhava uma
               por linha e comia meia tela antes de o conteúdo começar. */
            className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition sm:gap-2 sm:px-4 sm:text-sm", aba === a.id ? "bg-slate-900 text-agro-400" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
            <a.icon size={14} className="shrink-0 sm:h-4 sm:w-4" /> {a.label}
          </button>
        ))}
      </div>
      <div hidden={aba !== "plano"}>{plano}</div>
      <div hidden={aba !== "etapas"}>{etapas}</div>
      <div hidden={aba !== "trilha"}>{trilha}</div>
      <div hidden={aba !== "biblioteca"}>{biblioteca}</div>
    </div>
  );
}
