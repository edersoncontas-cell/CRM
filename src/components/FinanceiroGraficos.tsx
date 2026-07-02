"use client";

import { useState } from "react";
import Link from "next/link";

type MesData = {
  key: string;   // "YYYY-MM"
  label: string; // "JAN. DE 26"
  valor: number;
  comissao: number;
  negs: any[];
};

const MESES_ABREV = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

function formatBRL(n: number) {
  if (n >= 1000000) return "R$ " + (n/1000000).toFixed(1) + "M";
  if (n >= 1000) return "R$ " + (n/1000).toFixed(0) + "k";
  return "R$ " + n.toFixed(0);
}

// ── Gráfico de barras simples ────────────────────────────────────────────────
function BarChart({ data, color = "#BFDE4D" }: { data: { label: string; value: number; key: string }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-32 w-full">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-gray-400 rotate-0">{formatBRL(d.value)}</span>
            <div className="w-full rounded-t" style={{ height: Math.max(pct * 1.2, 2) + "px", background: color, minHeight: "2px" }} />
            <span className="text-[9px] text-gray-500 mt-0.5">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function FinanceiroGraficos({ receitaMensal }: { receitaMensal: MesData[] }) {
  const anoAtual = new Date().getFullYear();
  const anos = [...new Set(receitaMensal.map((m) => m.key.slice(0, 4)))].sort();
  const [anoSel, setAnoSel] = useState(anos[anos.length - 1] ?? String(anoAtual));

  // Anos disponíveis (2025 onwards + auto-updates)
  const anosDisponiveis: string[] = [];
  for (let y = 2025; y <= anoAtual + 1; y++) anosDisponiveis.push(String(y));

  const dadosAno = receitaMensal.filter((m) => m.key.startsWith(anoSel));

  // ── Receita Mensal Chart Data ──────────────────────────────────────────────
  const chartData = dadosAno.map((m) => ({
    label: m.label.split(" ")[0], // "JAN"
    value: m.valor,
    key: m.key,
  }));

  // ── Comparativo State ──────────────────────────────────────────────────────
  const [cmpMes, setCmpMes] = useState(String(new Date().getMonth() + 1).padStart(2,"0"));
  const [cmpAnos, setCmpAnos] = useState<string[]>([String(anoAtual), String(anoAtual - 1)]);

  function toggleCmpAno(ano: string) {
    setCmpAnos(prev => prev.includes(ano) ? prev.filter(a => a !== ano) : [...prev, ano].sort());
  }

  const CORES_CMP = ["#BFDE4D","#60a5fa","#f87171","#a78bfa","#fb923c"];
  const cmpData = cmpAnos.map((ano, i) => {
    const key = ano + "-" + cmpMes;
    const entry = receitaMensal.find(m => m.key === key);
    return { ano, valor: entry?.valor ?? 0, comissao: entry?.comissao ?? 0, color: CORES_CMP[i % CORES_CMP.length] };
  });

  const maxCmp = Math.max(...cmpData.map(d => d.valor), 1);

  return (
    <div className="space-y-6">
      {/* ── Receita Mensal ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Receita Mensal</h3>
          <div className="flex gap-2">
            {anosDisponiveis.map((ano) => (
              <button
                key={ano}
                onClick={() => setAnoSel(ano)}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${anoSel === ano ? "bg-yellow-400 text-black" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {ano}
              </button>
            ))}
          </div>
        </div>
        {dadosAno.length > 0 ? (
          <BarChart data={chartData} color="#BFDE4D" />
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum dado para {anoSel}</p>
        )}
        {dadosAno.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {dadosAno.map((m) => (
              <Link key={m.key} href={"/financeiro/mes/" + m.key.split("-")[1].replace(/^0/,"") + "?ano=" + m.key.split("-")[0]}
                className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 hover:bg-yellow-50 transition-colors">
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="font-bold text-gray-900 text-sm">{formatBRL(m.valor)}</p>
                <p className="text-xs text-green-600">+{formatBRL(m.comissao)} comis.</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Comparativo de Meses ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-base font-bold text-gray-900 mb-1">Comparativo por Mês</h3>
        <p className="text-xs text-gray-500 mb-4">Compare o mesmo mês em anos diferentes</p>
        <div className="flex flex-wrap gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mês</label>
            <select
              value={cmpMes}
              onChange={(e) => setCmpMes(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
            >
              {MESES_ABREV.map((m, i) => (
                <option key={m} value={String(i+1).padStart(2,"0")}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Anos (multi)</label>
            <div className="flex flex-wrap gap-1">
              {anosDisponiveis.map((ano) => (
                <button
                  key={ano}
                  onClick={() => toggleCmpAno(ano)}
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${cmpAnos.includes(ano) ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {ano}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-end gap-4 h-40">
          {cmpData.map((d) => {
            const pct = (d.valor / maxCmp) * 100;
            return (
              <div key={d.ano} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-600 font-semibold">{formatBRL(d.valor)}</span>
                <div className="w-full rounded-t" style={{ height: Math.max(pct * 1.5, 4) + "px", background: d.color, minHeight: "4px" }} />
                <span className="text-xs font-bold text-gray-700">{d.ano}</span>
                <span className="text-[10px] text-green-600">{formatBRL(d.comissao)}</span>
              </div>
            );
          })}
          {cmpData.length === 0 && (
            <p className="text-sm text-gray-400 w-full text-center py-8">Selecione anos para comparar</p>
          )}
        </div>
        {cmpData.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {cmpData.map((d) => (
              <div key={d.ano} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                <span className="text-xs text-gray-600">{d.ano}: {formatBRL(d.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
