"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { limparContatosAutomaticos } from "@/lib/actions";
import { Eraser, Loader2 } from "lucide-react";

// Botão para remover os contatos automáticos duplicados ("Contato …") sem negociação.
export function LimparDuplicados() {
  const [pend, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function limpar() {
    if (!confirm('Remover os contatos automáticos ("Contato …") que não têm negociação? As mensagens soltas deles serão apagadas.')) return;
    start(async () => {
      const r = await limparContatosAutomaticos();
      setMsg(`${r.removidos} removido(s)`);
      router.refresh();
      setTimeout(() => setMsg(null), 3000);
    });
  }

  return (
    <button
      onClick={limpar}
      disabled={pend}
      title="Limpar contatos automáticos duplicados"
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-60"
    >
      {pend ? <Loader2 size={15} className="animate-spin" /> : <Eraser size={15} />}
      {msg ?? "Limpar duplicados"}
    </button>
  );
}
