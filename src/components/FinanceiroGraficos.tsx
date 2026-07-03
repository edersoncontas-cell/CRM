"use client";

import { useState } from "react";
import Link from "next/link";

type MesData = {
  key: string;
  label: string;
  valor: number;
  comissao: number;
  negs: any[];
};

const MESES_ABREV = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

function formatBRL(n: number) {
  if (n >= 1_000_000) return "R$ " + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "R$ " + Math.round(n / 1_000) + "k";
  return "R$ " + Math.round(n).toString();
}

// ── Gráfico de barras mensais ─────────────────────────────────────────────────
function BarChart({
  data,
  color = "#BFDE4D",
}: {
  data: { label: string; value: number; key: string }[];
  color?: string;
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  // SVG dimensions
  const W = 500;
  const H = 200;
  const padL = 54; // left for y-axis labels
  const padR = 12;
  const padTop = 30; // top padding so value labels don't clip
  const padBot = 42; // bottom for x labels
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBot;
  const baseY = padTop + plotH;
  const n = data.length || 1;
  const barW = Math.min(32, (plotW / n) * 0.55);
  const step = plotW / n;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="grad-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = baseY - frac * plotH;
        return (
          <g key={frac}>
            <line
              x1={padL}
              y1={y}
              x2={W - padR}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="0.8"
              strokeDasharray="4,3"
            />
            <text
              x={padL - 4}
              y={y + 4}
              textAnchor="end"
              fontSize="10"
              fill="#9ca3af"
              fontFamily="system-ui,sans-serif"
            >
              {frac === 0 ? "R$ 0" : formatBRL(maxVal * frac)}
            </text>
          </g>
        );
      })}
      {/* axes */}
      <line x1={padL} y1={padTop} x2={padL} y2={baseY} stroke="#d1d5db" strokeWidth="1" />
      <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#d1d5db" strokeWidth="1" />
      {/* bars */}
      {data.map((d, i) => {
        const cx = padL + step * i + step / 2;
        const pct = d.value / maxVal;
        const bH = Math.max(pct * plotH, d.value > 0 ? 4 : 2);
        const x = cx - barW / 2;
        const y = baseY - bH;
        // value label: above bar, clamped so it stays inside SVG top area
        const lblY = Math.max(padTop - 2, y - 5);
        return (
          <g key={d.key}>
            <rect x={x} y={y} width={barW} height={bH} fill="url(#grad-bar)" rx="3" ry="3" />
            {d.value > 0 && (
              <text
                x={cx}
                y={lblY}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill="#374151"
                fontFamily="system-ui,sans-serif"
              >
                {formatBRL(d.value)}
              </text>
            )}
            <text
              x={cx}
              y={baseY + 13}
              textAnchor="middle"
              fontSize="10"
              fill="#6b7280"
              fontFamily="system-ui,sans-serif"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function FinanceiroGraficos({ receitaMensal }: { receitaMensal: MesData[] }) {
  const anoAtual = new Date().getFullYear();
  const anos = [...new Set(receitaMensal.map((m) => m.key.slice(0, 4)))].sort();
  const [anoSel, setAnoSel] = useState(anos[anos.length - 1] ?? String(anoAtual));

  const anosDisponiveis: string[] = [];
  for (let y = 2025; y <= anoAtual + 1; y++) anosDisponiveis.push(String(y));

  const dadosAno = receitaMensal.filter((m) => m.key.startsWith(anoSel));

  const chartData = dadosAno.map((m) => ({
    label: m.label.split(" ")[0],
    value: m.valor,
    key: m.key,
  }));

  // ── Comparativo por Mês ────────────────────────────────────────────────────
  const [cmpMes, setCmpMes] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [cmpAnos, setCmpAnos] = useState<string[]>([
    String(anoAtual),
    String(anoAtual - 1),
  ]);

  function toggleCmpAno(ano: string) {
    setCmpAnos((prev) =>
      prev.includes(ano) ? prev.filter((a) => a !== ano) : [...prev, ano].sort()
    );
  }

  const CORES_CMP = ["#BFDE4D", "#60a5fa", "#f87171", "#a78bfa", "#fb923c"];

  const cmpData = cmpAnos.map((ano, i) => {
    const key = ano + "-" + cmpMes;
    const entry = receitaMensal.find((m) => m.key === key);
    return {
      ano,
      valor: entry?.valor ?? 0,
      comissao: entry?.comissao ?? 0,
      color: CORES_CMP[i % CORES_CMP.length],
    };
  });

  const maxCmp = Math.max(...cmpData.map((d) => d.valor), 1);

  // SVG dimensions for comparativo
  const CW = 500;
  const CH = 280;
  const cPadL = 60;
  const cPadR = 20;
  const cPadTop = 50; // plenty of room for badge above tallest bar
  const cPadBot = 52; // room for year label + comissão label
  const cPlotW = CW - cPadL - cPadR;
  const cPlotH = CH - cPadTop - cPadBot;
  const cBaseY = cPadTop + cPlotH;
  const nCmp = cmpData.length || 1;
  const cStep = cPlotW / nCmp;
  const cBarW = Math.min(80, cStep * 0.5);

  return (
    <div className="space-y-6">
      {/* ── Receita Mensal ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Receita Mensal</h3>
          <div className="flex flex-wrap gap-2">
            {anosDisponiveis.map((ano) => (
              <button
                key={ano}
                onClick={() => setAnoSel(ano)}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${
                  anoSel === ano
                    ? "bg-yellow-400 text-black"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {ano}
              </button>
            ))}
          </div>
        </div>
        {dadosAno.length > 0 ? (
          <BarChart data={chartData} color="#BFDE4D" />
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">
            Nenhum dado para {anoSel}
          </p>
        )}
        {dadosAno.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {dadosAno.map((m) => (
              <Link
                key={m.key}
                href={
                  "/financeiro/mes/" +
                  m.key.split("-")[1].replace(/^0/, "") +
                  "?ano=" +
                  m.key.split("-")[0]
                }
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 transition-colors hover:bg-yellow-50"
              >
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="text-sm font-bold text-gray-900">{formatBRL(m.valor)}</p>
                <p className="text-xs text-green-600">+{formatBRL(m.comissao)} comis.</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Comparativo por Mês ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-base font-bold text-gray-900 mb-1">Comparativo por Mês</h3>
        <p className="text-xs text-gray-500 mb-4">
          Compare o mesmo mês em anos diferentes
        </p>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Mês</label>
            <select
              value={cmpMes}
              onChange={(e) => setCmpMes(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none"
            >
              {MESES_ABREV.map((m, i) => (
                <option key={m} value={String(i + 1).padStart(2, "0")}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Anos (multi)
            </label>
            <div className="flex flex-wrap gap-1">
              {anosDisponiveis.map((ano) => (
                <button
                  key={ano}
                  onClick={() => toggleCmpAno(ano)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    cmpAnos.includes(ano)
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {ano}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SVG Chart */}
        {cmpData.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Selecione anos para comparar
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${CW} ${CH}`}
            width="100%"
            style={{ display: "block" }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {cmpData.map((d) => (
                <linearGradient
                  key={`grad-${d.ano}`}
                  id={`grad-${d.ano}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={d.color} stopOpacity="1" />
                  <stop offset="100%" stopColor={d.color} stopOpacity="0.55" />
                </linearGradient>
              ))}
            </defs>

            {/* Grid lines at 0%, 25%, 50%, 75%, 100% */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const gy = cBaseY - frac * cPlotH;
              return (
                <g key={frac}>
                  <line
                    x1={cPadL}
                    y1={gy}
                    x2={CW - cPadR}
                    y2={gy}
                    stroke={frac === 0 ? "#d1d5db" : "#e5e7eb"}
                    strokeWidth={frac === 0 ? "1" : "0.8"}
                    strokeDasharray={frac === 0 ? "" : "4,3"}
                  />
                  <text
                    x={cPadL - 5}
                    y={gy + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="#9ca3af"
                    fontFamily="system-ui,sans-serif"
                  >
                    {frac === 0 ? "R$ 0" : formatBRL(maxCmp * frac)}
                  </text>
                </g>
              );
            })}

            {/* Y axis */}
            <line
              x1={cPadL}
              y1={cPadTop}
              x2={cPadL}
              y2={cBaseY}
              stroke="#d1d5db"
              strokeWidth="1"
            />

            {/* Bars */}
            {cmpData.map((d, i) => {
              const cx = cPadL + cStep * i + cStep / 2;
              const x = cx - cBarW / 2;
              const pct = maxCmp > 0 ? d.valor / maxCmp : 0;
              const bH = Math.max(pct * cPlotH, d.valor > 0 ? 6 : 2);
              const barTopY = cBaseY - bH;

              // Badge is always INSIDE the SVG, min y = cPadTop + 2
              const badgeH = 22;
              const badgeW = 70;
              const badgeCY = Math.max(cPadTop + badgeH / 2 + 2, barTopY - badgeH / 2 - 6);
              const badgeX = cx - badgeW / 2;
              const badgeY = badgeCY - badgeH / 2;

              return (
                <g key={d.ano}>
                  {/* Bar */}
                  <rect
                    x={x}
                    y={barTopY}
                    width={cBarW}
                    height={bH}
                    fill={`url(#grad-${d.ano})`}
                    rx="5"
                    ry="5"
                  />
                  {/* Shine strip at bottom of bar */}
                  <rect
                    x={x}
                    y={cBaseY - Math.min(bH, 8)}
                    width={cBarW}
                    height={Math.min(bH, 8)}
                    fill={d.color}
                    opacity="0.5"
                    rx="3"
                    ry="3"
                  />
                  {/* Value badge */}
                  <rect
                    x={badgeX}
                    y={badgeY}
                    width={badgeW}
                    height={badgeH}
                    rx="11"
                    ry="11"
                    fill="white"
                    stroke={d.color}
                    strokeWidth="1.5"
                    filter="url(#shadow)"
                  />
                  <text
                    x={cx}
                    y={badgeCY + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#1f2937"
                    fontFamily="system-ui,sans-serif"
                  >
                    {formatBRL(d.valor)}
                  </text>
                  {/* Dashed connector from badge to bar top */}
                  {badgeCY + badgeH / 2 < barTopY && (
                    <line
                      x1={cx}
                      y1={badgeCY + badgeH / 2}
                      x2={cx}
                      y2={barTopY}
                      stroke={d.color}
                      strokeWidth="1"
                      strokeDasharray="3,2"
                    />
                  )}
                  {/* Year label */}
                  <text
                    x={cx}
                    y={cBaseY + 18}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill="#374151"
                    fontFamily="system-ui,sans-serif"
                  >
                    {d.ano}
                  </text>
                  {/* Commission label */}
                  <text
                    x={cx}
                    y={cBaseY + 35}
                    textAnchor="middle"
                    fontSize="10"
                    fill={d.comissao > 0 ? "#16a34a" : "#9ca3af"}
                    fontFamily="system-ui,sans-serif"
                  >
                    +{formatBRL(d.comissao)} comis.
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Legend */}
        {cmpData.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-4">
            {cmpData.map((d) => (
              <div key={d.ano} className="flex items-center gap-1.5">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ background: d.color }}
                />
                <span className="text-xs text-gray-600">
                  {d.ano}: {formatBRL(d.valor)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
