import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const TAXA = 0.005;

export default async function FaturadasPage() {
  const negs = await db.negociacao.findMany({
    where: { status: "ganha" },
    include: { cliente: { include: { municipio: true } } },
    orderBy: { faturadoEm: "desc" },
  } as any);

  const total = negs.reduce((s: number, n: any) => s + (n.valor ?? 0), 0);
  const comissaoTotal = total * TAXA;

  return (
    <div>
      <div className="mb-4">
        <Link href="/financeiro" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Voltar ao Financeiro
        </Link>
      </div>
      <PageHeader titulo="Negociações Faturadas" subtitulo={`${negs.length} faturadas · Total: ${formatCurrency(total)} · Comissão: ${formatCurrency(comissaoTotal)}`} />
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(negs as any[]).map((n: any) => (
              <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/clientes/${n.clienteId}`} className="font-semibold text-slate-800 hover:text-brand-600">
                    {n.cliente.nome}
                  </Link>
                  {n.cliente.municipio && <div className="text-xs text-slate-400">{n.cliente.municipio.nome}</div>}
                </td>
                <td className="px-4 py-3 text-slate-700">{n.maquinaModelo ?? "—"}</td>
                <td className="px-4 py-3">
                  {n.tipoPagamento ? (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                      n.tipoPagamento === "crd_pme" ? "bg-amber-100 text-amber-700" :
                      n.tipoPagamento === "financiamento" ? "bg-blue-100 text-blue-700" :
                      n.tipoPagamento === "consorcio" ? "bg-violet-100 text-violet-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {n.tipoPagamento === "avista" ? "À Vista" :
                       n.tipoPagamento === "financiamento" ? "Financiamento" :
                       n.tipoPagamento === "consorcio" ? "Consórcio" :
                       n.tipoPagamento === "crd_pme" ? "CRD PME" : n.tipoPagamento}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(n.valor)}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-semibold">+{formatCurrency((n.valor ?? 0) * TAXA)}</td>
                <td className="px-4 py-3 text-slate-500">{n.faturadoEm ? formatDate(n.faturadoEm) : formatDate(n.atualizadoEm)}</td>
                <td className="px-4 py-3 text-slate-500">{n.mesAnoReferencia ?? "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-200">
            <tr>
              <td colSpan={3} className="px-4 py-3 font-bold text-slate-700">Total</td>
              <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(total)}</td>
              <td className="px-4 py-3 text-right font-bold text-emerald-600">+{formatCurrency(comissaoTotal)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
