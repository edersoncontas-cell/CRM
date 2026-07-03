import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

const TAXA = 0.005;

export default async function ComissoesPage() {
  const negocios = await db.negociacao.findMany({
    where: { status: "ganha", comissaoPaga: false },
    include: { cliente: { select: { nome: true } } },
    orderBy: { faturadoEm: "desc" },
  });

  const totalComissoes = negocios.reduce((sum, n) => {
    const valor = (n as any).valor ?? 0;
    return sum + valor * TAXA;
  }, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href="/financeiro"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Financeiro
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comissões a Receber</h1>
          <p className="text-sm text-gray-500">Comissões sobre negociações faturadas ainda não marcadas como pagas</p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3">
        <DollarSign className="w-5 h-5 text-green-600" />
        <div>
          <p className="text-sm text-green-700">Total de comissões a receber</p>
          <p className="text-2xl font-bold text-green-800">
            {formatCurrency(totalComissoes)}
          </p>
          <p className="text-xs text-green-600">
            Taxa de 0,5% sobre o valor de cada negociação faturada
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Máquina</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Pagamento</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Valor Máquina</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Comissão (0,5%)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Faturado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {negocios.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Nenhuma negociação faturada encontrada.
                </td>
              </tr>
            )}
            {negocios.map((neg) => {
              const valor = (neg as any).valor ?? 0;
              const comissao = valor * TAXA;
              return (
                <tr key={neg.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {neg.cliente?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(neg as any).maquina ?? (neg as any).marca ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(neg as any).tipoPagamento ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(valor)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">
                    {formatCurrency(comissao)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {(neg as any).faturadoEm
                      ? formatDate(new Date((neg as any).faturadoEm))
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {negocios.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td colSpan={4} className="px-4 py-3 font-semibold text-gray-700">
                  Total ({negocios.length} negociações)
                </td>
                <td className="px-4 py-3 text-right font-bold text-green-700 text-base">
                  {formatCurrency(totalComissoes)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
