"use client";

import { useState, useTransition } from "react";
import { gerarBattlecardsComparativoIA } from "@/lib/actions";
import { Sparkles, Trophy } from "lucide-react";

type Conc = { id: string; marca: string; modelo: string };

export function ComparativoIA({
  minhaId,
  minhaModelo,
  concorrentes,
}: {
  minhaId: string;
  minhaModelo: string;
  concorrentes: Conc[];
}) {
  const [cards, setCards] = useState<{ id: string; texto: string }[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function gerar() {
    setErro(null);
    start(async () => {
      const r = await gerarBattlecardsComparativoIA(
        minhaId,
        concorrentes.map((c) => c.id)
      );
      if (!r.ok) {
        setErro(r.erro ?? "Erro ao gerar.");
        return;
      }
      setCards(r.cards ?? []);
    });
  }

  if (concorrentes.length === 0) return null;

  const nome = (id: string) => {
    const c = concorrentes.find((x) => x.id === id);
    return c ? `${c.marca} ${c.modelo}` : "";
  };

  return (
    <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-blue-500" />
          <div>
            <div className="font-semibold text-slate-700">Análise da IA com fichas técnicas</div>
            <div className="text-xs text-slate-500">
              Argumentos precisos da {minhaModelo} comparando números reais das fichas técnicas.
            </div>
          </div>
        </div>
        <button
          onClick={gerar}
          disabled={pending}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Sparkles size={14} />
          {pending ? "Analisando..." : cards ? "Gerar de novo" : "Gerar argumentos com IA"}
        </button>
      </div>

      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

      {cards && cards.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {cards.map((c) => (
            <div key={c.id} className="rounded-xl border border-blue-200 bg-white p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-blue-700">
                <Trophy size={13} className="text-agro-600" /> vs {nome(c.id)}
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{c.texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
