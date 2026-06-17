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

const CORES = ["#b4b4ba", "#7dd3fc", "#ffcb2d", "#6ee7b7", "#c4b5fd", "#22c55e"];

export function PipelineChart({ data }: { data: { estagio: string; total: number }[] }) {
  const dados = data.map((d) => ({ nome: ROTULOS[d.estagio] ?? d.estagio, total: d.total }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="total" radius={[6, 6, 0, 0]}>
          {dados.map((_, i) => (
            <Cell key={i} fill={CORES[i % CORES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
