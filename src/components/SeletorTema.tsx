"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, Loader2, Check } from "lucide-react";
import { Card } from "@/components/ui";
import { definirTemaAction } from "@/lib/tema-actions";
import type { ModoTema } from "@/lib/tema";

// O seletor de tema. Duas opções, nada de "automático pelo sistema": ele usa
// o CRM na cabine e no escritório, e quer mandar na escolha — tema que muda
// sozinho ao entardecer vira susto no meio de uma negociação.
export function SeletorTema({ atual }: { atual: ModoTema }) {
  const [modo, setModo] = useState<ModoTema>(atual);
  const [salvando, startTransition] = useTransition();
  const router = useRouter();

  function escolher(novo: ModoTema) {
    if (novo === modo || salvando) return;
    setModo(novo);
    startTransition(async () => {
      await definirTemaAction(novo).catch(() => setModo(atual));
      // Sem o refresh a casca só trocaria de cor na próxima navegação — ele
      // clicaria, nada mudaria, e clicaria de novo.
      router.refresh();
    });
  }

  const opcoes: { id: ModoTema; nome: string; desc: string; icone: React.ReactNode }[] = [
    { id: "escuro", nome: "Escuro", desc: "O de sempre. Cansa menos de noite e na cabine.", icone: <Moon size={18} /> },
    { id: "claro", nome: "Claro", desc: "Fundo claro. Enxerga melhor no sol, na obra.", icone: <Sun size={18} /> },
  ];

  return (
    <Card className="mb-6">
      <div className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
        {modo === "claro" ? <Sun size={18} className="text-brand-600" /> : <Moon size={18} className="text-brand-600" />}
        Tema do CRM
        {salvando && <Loader2 size={14} className="animate-spin text-slate-400" />}
      </div>
      <p className="mb-3 text-sm text-slate-500">
        Vale em todas as telas e fica guardado neste aparelho. Dá para ter um no celular e outro no computador.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => escolher(o.id)}
            aria-pressed={modo === o.id}
            className={`rounded-xl border p-3 text-left transition ${
              modo === o.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {/* O "em uso" fica no fim da linha e não pode quebrar: no celular
                ele virava duas linhas e espremia o nome do tema ao lado. */}
            <span className="flex items-center gap-2 font-bold">
              {o.icone} {o.nome}
              {modo === o.id && <Check size={15} className="ml-auto shrink-0" aria-label="em uso" />}
            </span>
            <span className={`mt-1 block text-[11px] leading-snug ${modo === o.id ? "opacity-75" : "text-slate-500"}`}>
              {o.desc}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
