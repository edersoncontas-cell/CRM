"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { MOTIVOS_PERDA } from "@/lib/pipeline";
import { formatCurrency, formatDate } from "@/lib/utils";
import { registrarMotivoPerdaAction } from "@/lib/vendas-perdidas-actions";

export type PerdaSemMotivo = {
  id: string;
  cliente: string;
  maquina: string | null;
  valor: number;
  quando: string; // ISO
};

// AS PERDAS SEM JUSTIFICATIVA.
//
// "se não tiver uma justificativa o sistema tem que acusar quais não tiveram
// justificativa"
//
// Acusar sem deixar corrigir seria só cobrança. Cada linha traz os motivos ali
// do lado: ele está olhando a lista, é nessa hora que lembra o que aconteceu —
// não abrindo negociação por negociação.
export function PerdasSemMotivo({ perdas }: { perdas: PerdaSemMotivo[] }) {
  const [abertas, setAbertas] = useState(perdas.length <= 3);
  const [resolvidas, setResolvidas] = useState<Set<string>>(new Set());

  const faltam = perdas.filter((p) => !resolvidas.has(p.id));
  if (!perdas.length) return null;

  if (!faltam.length) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
        <Check size={16} className="shrink-0" /> Todas as perdas deste período têm motivo registrado.
      </div>
    );
  }

  const valorSemMotivo = faltam.reduce((s, p) => s + p.valor, 0);

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <button
        type="button"
        onClick={() => setAbertas((v) => !v)}
        className="flex w-full items-start gap-2 text-left"
      >
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-amber-900">
            {faltam.length} {faltam.length === 1 ? "venda perdida sem justificativa" : "vendas perdidas sem justificativa"}
          </span>
          <span className="mt-0.5 block text-xs text-amber-800">
            {formatCurrency(valorSemMotivo)} que escapou sem ninguém saber por quê. Sem o motivo, essa perda não entra no
            ranking e não vira aprendizado — é só um número que caiu do funil.
          </span>
        </span>
        <ChevronDown size={16} className={`mt-0.5 shrink-0 text-amber-700 transition-transform ${abertas ? "rotate-180" : ""}`} />
      </button>

      {abertas && (
        <ul className="mt-3 space-y-2">
          {faltam.map((p) => (
            <LinhaSemMotivo key={p.id} perda={p} onPronto={() => setResolvidas((s) => new Set(s).add(p.id))} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LinhaSemMotivo({ perda, onPronto }: { perda: PerdaSemMotivo; onPronto: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  return (
    <li className="rounded-xl border border-amber-200 bg-white p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-bold text-slate-800">{perda.cliente}</span>
        <span className="text-sm font-bold tabular-nums text-slate-700">{formatCurrency(perda.valor)}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
        {perda.maquina && <span className="font-semibold text-slate-600">{perda.maquina}</span>}
        <span>{formatDate(new Date(perda.quando))}</span>
      </div>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <select
          value={motivo}
          onChange={(e) => { setMotivo(e.target.value); setErro(null); }}
          aria-label={`Motivo da perda de ${perda.cliente}`}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-700 outline-none focus:border-red-400"
        >
          <option value="">Por que perdemos?</option>
          {MOTIVOS_PERDA.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Detalhe (opcional)"
          aria-label={`Detalhe da perda de ${perda.cliente}`}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-red-400"
        />
        <button
          type="button"
          disabled={salvando}
          onClick={() => {
            if (!motivo) { setErro("Escolha o motivo."); return; }
            startTransition(async () => {
              const r = await registrarMotivoPerdaAction(perda.id, motivo, nota).catch(() => ({ ok: false, erro: "Falha ao salvar." }));
              if (!r.ok) { setErro(r.erro ?? "Não deu para salvar."); return; }
              onPronto();
            });
          }}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {erro && <p className="mt-1.5 text-xs font-semibold text-red-600">{erro}</p>}
    </li>
  );
}
