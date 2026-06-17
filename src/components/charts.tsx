"use client";

import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
} from "recharts";

const ROTULOS: Record<string, string> = {
  demandas: "Demandas",
  primeiro_contato: "1º contato",
  visita_pendente: "Visita pend.",
  visita_realizada: "Visita feita",
  proposta_bcnh: "Prop. BCNH",
  proposta_aprovada: "Prop. aprov.",
};

// Paleta neon para dark mode
const CORES_DARK = ["#BFDE4D", "#60a5fa", "#a78bfa", "#4ade80", "#f59e0b", "#f87171"];
// Paleta suave para light mode
const CORES_LIGHT = ["#b4b4ba", "#7dd3fc", "#ffcb2d", "#6ee7b7", "#c4b5fd", "#22c55e"];

function CustomTooltip({ active, payload, label, dark }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-sm shadow-xl"
      style={dark
        ? { background: "#27272a", border: "1px solid #3f3f46", color: "#fafafa" }
        : { background: "#fff", border: "1px solid #e2e8f0", color: "#1e293b" }
      }
    >
      <div className="font-medium">{label}</div>
      <div style={{ color: dark ? "#BFDE4D" : "#0ea5e9" }}>{payload[0].value} card{payload[0].value !== 1 ? "s" : ""}</div>
    </div>
  );
}

export function PipelineChart({
  data,
  dark = false,
}: {
  data: { estagio: string; total: number }[];
  dark?: boolean;
}) {
  const cores = dark ? CORES_DARK : CORES_LIGHT;
  const dados = data.map((d) => ({ nome: ROTULOS[d.estagio] ?? d.estagio, total: d.total }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="nome"
          tick={{ fontSize: 10, fill: dark ? "#71717a" : "#64748b" }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: dark ? "#71717a" : "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<CustomTooltip dark={dark} />}
          cursor={{ fill: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)" }}
        />
        <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {dados.map((_, i) => (
            <Cell key={i} fill={cores[i % cores.length]} fillOpacity={dark ? 0.85 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
