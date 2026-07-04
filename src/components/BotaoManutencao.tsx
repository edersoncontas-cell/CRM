"use client";

import { useState, useTransition } from "react";
import { Wrench, CheckCircle2, XCircle } from "lucide-react";

type Etapa = { etapa: string; ok: boolean; erro?: string };

// Roda TODAS as rotinas de manutenção (migrações de schema, regiões,
// colunas do funil/demandas, catálogo de máquinas, fichas verificadas) sob
// demanda, sem esperar o próximo cold start. Ver src/lib/manutencao.ts.
export function BotaoManutencao() {
  const [pending, startTransition] = useTransition();
  const [relatorio, setRelatorio] = useState<Etapa[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function rodar() {
    setErro(null);
    setRelatorio(null);
    startTransition(async () => {
      try {
        const r = await fetch("/api/admin/manutencao", { method: "POST" }).then((res) => res.json());
        setRelatorio(r.relatorio ?? []);
      } catch (e) {
        setErro("Falha ao rodar manutenção: " + String(e));
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={rodar}
        disabled={pending}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
      >
        <Wrench size={15} className={pending ? "animate-pulse" : ""} />
        {pending ? "Rodando manutenção..." : "Rodar manutenção"}
      </button>

      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}

      {relatorio && (
        <ul className="mt-3 space-y-1 text-sm">
          {relatorio.map((r) => (
            <li key={r.etapa} className="flex items-start gap-2">
              {r.ok ? (
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-green-600" />
              ) : (
                <XCircle size={15} className="mt-0.5 shrink-0 text-red-600" />
              )}
              <span className={r.ok ? "text-slate-700" : "text-red-700"}>
                {r.etapa}
                {r.erro ? ` — ${r.erro}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
