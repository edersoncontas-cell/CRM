"use client";

import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, LabelList,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { T, CORES_SERIE } from "@/lib/dash-tema";

const EIXO = { fill: T.texto2, fontSize: 11 };
const TOOLTIP_STYLE = { background: T.card2, border: `1px solid ${T.borda}`, borderRadius: 12, color: T.texto, fontSize: 12 };

const compacto = (v: number) =>
  v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(1).replace(".", ",")}M` : v >= 1000 ? `R$${Math.round(v / 1000)}k` : `R$${v}`;

// Evolução de vendas no ano: área com gradiente = faturamento por mês; linha
// neon = nº de vendas; tracejado = meta mensal (meta anual ÷ 12).
export function GraficoEvolucao({ dados, metaMensal }: { dados: { mes: string; vendas: number | null; valor: number | null }[]; metaMensal: number }) {
  const comMeta = dados.map((d) => ({ ...d, meta: Number(metaMensal.toFixed(1)) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={comMeta} margin={{ top: 10, right: 6, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.violeta} stopOpacity={0.75} />
            <stop offset="100%" stopColor={T.violeta} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={T.borda} vertical={false} />
        <XAxis dataKey="mes" tick={EIXO} axisLine={false} tickLine={false} />
        <YAxis yAxisId="valor" tick={EIXO} axisLine={false} tickLine={false} tickFormatter={compacto} width={60} />
        <YAxis yAxisId="qtd" orientation="right" tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: unknown, nome: string) =>
            typeof v !== "number" ? ["—", nome] : nome === "Faturamento" ? [formatCurrency(v), nome] : [v, nome]
          }
        />
        <Area yAxisId="valor" type="monotone" dataKey="valor" name="Faturamento" stroke={T.violeta} strokeWidth={2} fill="url(#gradFat)" connectNulls={false} />
        <Line yAxisId="qtd" type="monotone" dataKey="vendas" name="Vendas" stroke={T.rosa} strokeWidth={2.5} dot={{ r: 3.5, fill: T.rosa, stroke: T.card, strokeWidth: 2 }} connectNulls={false} />
        <Line yAxisId="qtd" type="monotone" dataKey="meta" name="Meta mensal" stroke={T.ciano} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function GraficoTicketPorAno({ dados }: { dados: { ano: string; ticket: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={dados} margin={{ top: 22, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={T.borda} vertical={false} />
        <XAxis dataKey="ano" tick={EIXO} axisLine={false} tickLine={false} />
        <YAxis tick={EIXO} axisLine={false} tickLine={false} tickFormatter={compacto} width={60} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), "Ticket médio"]} cursor={{ fill: T.sobre }} />
        <Bar dataKey="ticket" radius={[8, 8, 0, 0]}>
          {dados.map((_, i) => <Cell key={i} fill={[T.verde, T.ciano, T.violeta][i % 3]} />)}
          <LabelList dataKey="ticket" position="top" formatter={(v: number) => compacto(v)} style={{ fill: T.texto, fontSize: 11, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoDonut({ dados }: { dados: { nome: string; qtd: number }[] }) {
  const total = dados.reduce((s, d) => s + d.qtd, 0);
  if (!total) return <p className="text-xs" style={{ color: T.mudo }}>Sem vendas faturadas no período.</p>;
  return (
    <div className="flex items-center gap-3">
      <ResponsiveContainer width={130} height={130}>
        <PieChart>
          <Pie data={dados} dataKey="qtd" nameKey="nome" innerRadius={40} outerRadius={62} paddingAngle={3} stroke="none" cornerRadius={4}>
            {dados.map((_, i) => <Cell key={i} fill={CORES_SERIE[i % CORES_SERIE.length]} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} (${Math.round((v / total) * 100)}%)`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {dados.slice(0, 6).map((d, i) => (
          <li key={d.nome} className="flex items-center gap-2" style={{ color: T.texto2 }}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CORES_SERIE[i % CORES_SERIE.length], boxShadow: `0 0 8px ${CORES_SERIE[i % CORES_SERIE.length]}` }} />
            <span className="truncate">{d.nome}</span>
            <span className="ml-auto font-bold" style={{ color: T.texto }}>{d.qtd} <span style={{ color: T.mudo, fontWeight: 400 }}>({Math.round((d.qtd / total) * 100)}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Barras horizontais coloridas (uma cor neon por linha), no estilo da
// referência — usado para "vendas por modelo" e "vendas por cidade".
export function GraficoBarrasHorizontais({ dados, rotulo = "Vendas" }: { dados: { nome: string; qtd: number }[]; rotulo?: string }) {
  if (!dados.length) return <p className="text-xs" style={{ color: T.mudo }}>Sem vendas faturadas no período.</p>;
  const altura = Math.max(110, dados.length * 27);
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }} barCategoryGap={7}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="nome" width={112} tick={{ ...EIXO, fill: T.texto2 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, rotulo]} cursor={{ fill: T.sobre }} />
        <Bar dataKey="qtd" radius={[0, 8, 8, 0]}>
          {dados.map((_, i) => <Cell key={i} fill={CORES_SERIE[i % CORES_SERIE.length]} />)}
          <LabelList dataKey="qtd" position="right" style={{ fill: T.texto, fontSize: 11, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
