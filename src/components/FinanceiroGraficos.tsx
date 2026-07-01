"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

type MesData = {
  key: string;    // "YYYY-MM"
  label: string;  // "JAN. DE 26"
  valor: number;
  comissao: number;
  negs: any[];
};

export function FinanceiroGraficos({ receitaMensal }: { receitaMensal: MesData[] }) {
  const anos = [...new Set(receitaMensal.map((m) => m.key.slice(0, 4)))].sort();
  const [anoSel, setAnoSel] = useState(anos[anos.length - 1] ?? String(new Date().getFullYear()));

  const mesesFiltrados = receitaMensal.filter((m) => m.key.startsWith(anoSel));
  const maxMes = Math.max(...mesesFiltrados.map((m) => m.valor), 1);

  return (
    <div>
      {/* Seletor de ano */}
      <div className="mb-4 flex items-center gap-2">
        {anos.map((ano) => (
          <button
            key={ano}
            onClick={() => setAnoSel(ano)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
              anoSel === ano
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {ano}
          </button>
        ))}
      </div>

      {/* Barras mensais */}
      <div className="space-y-2">
        {mesesFiltrados.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma venda registrada para {anoSel}.</p>
        ) : (
          mesesFiltrados.map((m) => {
            const pct = maxMes > 0 ? (m.valor / maxMes) * 100 : 0;
            return (
              <div key={m.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600 uppercase tracking-wide w-20">{m.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{formatCurrency(m.valor)}</span>
                    <span className="font-semibold text-emerald-600">
                      +{formatCurrency(m.comissao)} comis.
                    </span>
                    {m.negs.length > 0 && (
                      <Link
                        href={`/financeiro/mes/${m.key}`}
                        className="text-blue-500 hover:underline"
                      >
                        ver
                      </Link>
                    )}
                  </div>
                </div>
                <div className="h-5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Gráfico de projeção */}
      {mesesFiltrados.length > 0 && (
        <div className="mt-8 border-t border-slate-100 pt-6">
          <h3 className="font-semibold text-slate-700 mb-4 text-sm">
            Projeção {anoSel} — Acumulado
          </h3>
          <ProjecaoChart meses={mesesFiltrados} />
        </div>
      )}
    </div>
  );
}

function ProjecaoChart({ meses }: { meses: MesData[] }) {
  const acumulado: number[] = [];
  let soma = 0;
  for (const m of meses) {
    soma += m.valor;
    acumulado.push(soma);
  }
  const maxAcum = acumulado[acumulado.length - 1] || 1;
  const barH = 140;

  return (
    <div className="flex items-end gap-1 h-40 border-b border-l border-slate-200 pl-2 pb-2 relative">
      {meses.map((m, i) => {
        const h = (acumulado[i] / maxAcum) * barH;
        return (
          <div key={m.key} className="flex flex-col items-center flex-1 min-w-0 group">
            <div
              className="w-full rounded-t bg-gradient-to-t from-blue-500 to-blue-300 opacity-80 group-hover:opacity-100 transition-all relative"
              style={{ height: h }}
              title={`${m.label}: ${formatCurrency(acumulado[i])}`}
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-slate-800 text-white text-[10px] rounded px-1 py-0.5 whitespace-nowrap z-10">
                {formatCurrency(acumulado[i])}
              </div>
            </div>
            <div className="text-[9px] text-slate-500 mt-1 truncate w-full text-center">
              {m.label.slice(0, 3)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
