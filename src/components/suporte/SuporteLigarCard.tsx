"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { LifeBuoy, Loader2 } from "lucide-react";
import { Card } from "@/components/ui";
import { ligarSuporteAction } from "@/lib/suporte-actions";

// Liga/desliga o botão "Suporte / Sugerir melhoria" em todas as telas.
// Nasce desligado; desligar não apaga nenhum pedido.
export function SuporteLigarCard({ ligado }: { ligado: boolean }) {
  const [estado, setEstado] = useState(ligado);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, start] = useTransition();

  function alternar() {
    const novo = !estado;
    setErro(null);
    start(async () => {
      const r = await ligarSuporteAction(novo);
      if (r.ok) setEstado(novo);
      else setErro(r.erro ?? "Não salvou.");
    });
  }

  return (
    <Card className="mb-6">
      <div id="suporte" className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <h2 className="flex items-center gap-2 font-bold"><LifeBuoy size={18} /> Suporte e sugestões</h2>
          <p className="mt-1 text-sm text-slate-600">
            Mostra o botão “Suporte / Sugerir melhoria” em todas as telas. Cada pedido guarda a tela, os prints e
            gera um prompt pronto para implementar. Desligar esconde o botão e não apaga nada.
          </p>
          {estado && <Link href="/suporte" className="mt-1 inline-block text-sm font-semibold underline">Ver pedidos</Link>}
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
