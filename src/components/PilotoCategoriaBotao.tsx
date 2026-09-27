"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Corrige o palpite da IA sobre a conversa ("é venda" / "não é venda") direto
// dos Números do piloto. Usa a mesma rota do Atendimento, que grava a escolha
// como confirmada: a IA nunca mais troca por cima.
export function PilotoCategoriaBotao({ conversaId, paraVenda }: { conversaId: string; paraVenda: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function marcar() {
    setOcupado(true); setErro(null);
    try {
      const r = await fetch(`/api/conversations/${conversaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: paraVenda ? "LEAD" : "OUTRO" }),
      });
      if (!r.ok) throw new Error(`resposta ${r.status}`);
      router.refresh();
    } catch (e) {
      setErro(`Não salvou (${e instanceof Error ? e.message : "sem conexão"}). Tente de novo.`);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" onClick={marcar} disabled={ocupado}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">
        {ocupado && <Loader2 size={11} className="animate-spin" />}
        {paraVenda ? "É venda" : "Não é venda"}
      </button>
      {erro && <span className="mt-0.5 max-w-[12rem] text-right text-[10px] leading-tight text-red-600">{erro}</span>}
    </span>
  );
}
