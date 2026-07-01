import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

const TAXA = 0.005;

function previsaoComissaoCrdPme(neg: {
  faturadoEm: Date | null;
  valor: number | null;
  entradaValor?: number | null;
  crdSaldoParcelasQtd?: number | null;
  crdParcelaValor?: number | null;
}): { data: Date | null; meses: number } {
  if (!neg.faturadoEm || !neg.valor) return { data: null, meses: 0 };
  const alvo75 = neg.valor * 0.75;
  const entrada = (neg as any).entradaValor ?? 0;
  const qtd = (neg as any).crdSaldoParcelasQtd ?? 0;
  const parcela = (neg as any).crdParcelaValor ?? 0;
  let pago = entrada;
  let meses = 0;
  while (pago < alvo75 && meses < qtd) {
    pago += parcela;
    meses++;
  }
  const dt = new Date(neg.faturadoEm);
  dt.setMonth(dt.getMonth() + meses);
  return { data: dt, meses };
}

export default async function ComissoesFuturasPage() {
  const negs = await db.negociacao.findMany({
    where: { status: "ganha", tipoPagamento: "crd_pme" } as any,
    include: { cliente: { include: { municipio: true } } },
    orderBy: { faturadoEm: "desc" },
  } as any);

  const dados = (negs as any[]).map((n: any) => {
    const { data, meses } = previsaoComissaoCrdPme(n);
    return {
      id: n.id,
      clienteId: n.clienteId,
      cliente: n.cliente.nome,
      municipio: n.cliente.municipio?.nome ?? null,
      maquina: n.maquinaModelo ?? "?",
      valor: n.valor ?? 0,
      comissao: (n.valor ?? 0) * TAXA,
      entrada: n.entradaValor ?? 0,
      parcelas: n.crdSaldoParcelasQtd ?? 0,
      valorParcela: n.crdParcelaValor ?? 0,
      faturadoEm: n.faturadoEm,
      previsaoData: data,
      mesesRestantes: meses,
    };
  });

  const totalComissao = dados.reduce((s, d) => s + d.comissao, 0);

  return (
    <div>
      <div className="mb-4">
        <Link href="/financeiro" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Voltar ao Financeiro
        </Link>
      </div>
      <PageHeader
        titulo="Comissões Futuras — CRD PME"
        subtitulo={`${dados.length} negociações · Total de comissões futuras: ${formatCurrency(totalComissao)}`}
      />
      <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        <strong>Regra CRD PME:</strong> A comissão é paga somente quando 75% do valor da máquina for pago (entrada + parcelas de boleto). O sistema estima automaticamente a data de pagamento com base nas parcelas de 30 em 30 dias.
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Cliente</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Máquina</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Valor Máquina</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Entrada</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Parcelas</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Faturado em</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                <Clock size={12} /> Previsão Comissão
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Comissão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dados.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/clientes/${d.clienteId}`} className="font-semibold text-slate-800 hover:text-brand-600">
                    {d.cliente}
                  </Link>
                  {d.municipio && <div className="text-xs text-slate-400">{d.municipio}</div>}
                </td>
                <td className="px-4 py-3 text-slate-700">{d.maquina}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(d.valor)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(d.entrada)}</td>
                <td className="px-4 py-3 text-center text-slate-600">{d.parcelas}x · {formatCurrency(d.valorParcela)}</td>
                <td className="px-4 py-3 text-slate-500">{d.faturadoEm ? formatDate(d.faturadoEm) : "—"}</td>
                <td className="px-4 py-3">
                  {d.previsaoData ? (
                    <div>
                      <span className="font-bold text-amber-700">{formatDate(d.previsaoData)}</span>
                      <div className="text-xs text-slate-400">{d.mesesRestantes} mês(es) após faturamento</div>
                    </div>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-bold text-amber-700">+{formatCurrency(d.comissao)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-200">
            <tr>
              <td colSpan={7} className="px-4 py-3 font-bold text-slate-700">Total de Comissões Futuras</td>
              <td className="px-4 py-3 text-right font-bold text-amber-700">+{formatCurrency(totalComissao)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
