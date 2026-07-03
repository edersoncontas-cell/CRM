"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, mesAnoAtualBrasilia } from "@/lib/utils";
import { definirComissaoPaga } from "@/lib/actions";
import { CheckCircle2, Circle } from "lucide-react";

type Linha = {
  id: string;
  clienteId: string;
  clienteNome: string;
  municipio: string | null;
  maquina: string | null;
  tipoPagamento: string | null;
  valor: number | null;
  faturadoEm: string;
  mesAnoReferencia: string | null;
  comissaoPaga: boolean;
  comissaoPagaMes: string | null;
};

const TIPO_PGT_LABEL: Record<string, string> = {
  avista: "À Vista",
  financiamento: "Financiamento",
  consorcio: "Consórcio",
  crd_pme: "CRD PME",
};
const TIPO_PGT_CLASS: Record<string, string> = {
  crd_pme: "bg-amber-100 text-amber-700",
  financiamento: "bg-blue-100 text-blue-700",
  consorcio: "bg-violet-100 text-violet-700",
};

export function FaturadasTable({ linhas, taxa }: { linhas: Linha[]; taxa: number }) {
  const [rows, setRows] = useState(linhas);
  const [pending, startTransition] = useTransition();

  function togglePaga(id: string, paga: boolean) {
    const mes = paga ? (rows.find((r) => r.id === id)?.comissaoPagaMes || mesAnoAtualBrasilia()) : null;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, comissaoPaga: paga, comissaoPagaMes: mes } : r)));
    startTransition(async () => {
      await definirComissaoPaga(id, paga, mes);
    });
  }

  function mudarMes(id: string, mes: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, comissaoPagaMes: mes } : r)));
    startTransition(async () => {
      await definirComissaoPaga(id, true, mes);
    });
  }

  const total = rows.reduce((s, n) => s + (n.valor ?? 0), 0);
  const comissaoTotal = total * taxa;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Cliente</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Máquina</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Tipo Pgt.</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Valor</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Comissão</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Faturado em</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Referência</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Comissão paga</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Mês pago</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Nenhuma negociação faturada encontrada.</td>
              </tr>
            )}
            {rows.map((n) => (
              <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/clientes/${n.clienteId}`} className="font-semibold text-slate-800 hover:text-brand-600">
                    {n.clienteNome}
                  </Link>
                  {n.municipio && <div className="text-xs text-slate-400">{n.municipio}</div>}
                </td>
                <td className="px-4 py-3 text-slate-700">{n.maquina ?? "—"}</td>
                <td className="px-4 py-3">
                  {n.tipoPagamento ? (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${TIPO_PGT_CLASS[n.tipoPagamento] ?? "bg-green-100 text-green-700"}`}>
                      {TIPO_PGT_LABEL[n.tipoPagamento] ?? n.tipoPagamento}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(n.valor)}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-semibold">+{formatCurrency((n.valor ?? 0) * taxa)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(n.faturadoEm)}</td>
                <td className="px-4 py-3 text-slate-500">{n.mesAnoReferencia ?? "—"}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => togglePaga(n.id, !n.comissaoPaga)}
                    disabled={pending}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-colors disabled:opacity-60 ${
                      n.comissaoPaga ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {n.comissaoPaga ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    {n.comissaoPaga ? "Paga" : "Pendente"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {n.comissaoPaga ? (
                    <input
                      type="month"
                      value={n.comissaoPagaMes ?? mesAnoAtualBrasilia()}
                      onChange={(e) => mudarMes(n.id, e.target.value)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-emerald-400"
                    />
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={3} className="px-4 py-3 font-bold text-slate-700">Total</td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(total)}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">+{formatCurrency(comissaoTotal)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
