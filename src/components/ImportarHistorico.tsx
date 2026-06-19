"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importarHistoricoZapi } from "@/lib/actions";
import { DownloadCloud, Loader2 } from "lucide-react";

// Puxa as conversas recentes do número (Z-API) para dentro do CRM.
export function ImportarHistorico() {
  const [pend, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function importar() {
    if (!confirm("Importar as conversas recentes do seu WhatsApp para o CRM? Pode levar alguns segundos.")) return;
    setMsg(null);
    start(async () => {
      const r = await importarHistoricoZapi();
      if (!r.ok) { setMsg(r.erro ?? "Falha ao importar."); return; }
      setMsg(`${r.conversas} msg · ${r.clientes} contato(s)`);
      router.refresh();
      setTimeout(() => setMsg(null), 5000);
    });
  }

  return (
    <button
      onClick={importar}
      disabled={pend}
      title="Importar conversas recentes do WhatsApp"
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
    >
      {pend ? <Loader2 size={15} className="animate-spin" /> : <DownloadCloud size={15} />}
      {pend ? "Importando…" : msg ?? "Importar histórico"}
    </button>
  );
}
