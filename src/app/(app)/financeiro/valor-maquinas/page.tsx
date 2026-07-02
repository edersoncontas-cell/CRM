import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ValorMaquinasPage() {
  const negocios = await db.negociacao.findMany({
    where: { status: "ganha" },
    include: { cliente: { select: { nome: true } } },
    orderBy: { faturadoEm: "desc" },
  });

  const totalValor = negocios.reduce((sum, n) => sum + ((n as any).valor ?? 0), 0);

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
          <h1 className="text-2xl font-bold text-gray-900">Valor das Máquinas Vendidas</h1>
          <p className="text-sm text-gray-500">Somatório de todas as máquinas faturadas</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3">
        <Truck className="w-5 h-5 text-blue-600" />
        <div>
          <p className="text-sm text-blue-700">Total valor das máquinas vendidas</p>
          <p className="text-2xl font-bold text-blue-800">{formatCurrency(totalValor)}</p>
          <p className="text-xs text-blue-600">{negocios.length} máquinas faturadas</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Marca</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Máquina</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Pagamento</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
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
              return (
                <tr key={neg.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {neg.cliente?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(neg as any).marca ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(neg as any).maquina ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(neg as any).tipoPagamento ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">
                    {formatCurrency(valor)}
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
                  Total ({negocios.length} máquinas)
                </td>
                <td className="px-4 py-3 text-right font-bold text-blue-700 text-base">
                  {formatCurrency(totalValor)}
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
