"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, CheckCircle } from "lucide-react";
import Link from "next/link";

const MESES = [
  "janeiro","fevereiro","marco","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro"
];

const MESES_LABEL: Record<string, string> = {
  janeiro:"Janeiro",fevereiro:"Fevereiro",marco:"Marco",abril:"Abril",maio:"Maio",junho:"Junho",
  julho:"Julho",agosto:"Agosto",setembro:"Setembro",outubro:"Outubro",novembro:"Novembro",dezembro:"Dezembro"
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

interface Negociacao {
  id: string;
  cliente?: { nome: string };
  maquina?: string;
  marca?: string;
  valor?: number;
  tipoPagamento?: string;
  faturadoEm?: string;
  mesAnoReferencia?: string;
}

export default function MesDetailPage({ negs }: { negs?: Negociacao[] }) {
  const params = useParams();
  const mes = params?.mes as string ?? "";
  const mesLabel = MESES_LABEL[mes] ?? mes;

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novoMes, setNovoMes] = useState("");
  const [novoAno, setNovoAno] = useState("2026");
  const [saved, setSaved] = useState<Record<string, string>>({});

  const negociacoes: Negociacao[] = negs ?? [];

  async function salvarDesignacao(id: string) {
    const ref = novoMes + "/" + novoAno;
    setSaved((p) => ({ ...p, [id]: ref }));
    setEditandoId(null);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href="/financeiro" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Financeiro
        </Link>
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Receita de {mesLabel}</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Negociacoes faturadas neste mes. Voce pode designar vendas para outro mes.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Maquina</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Pagamento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Mes referencia</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Acao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {negociacoes.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhuma negociacao neste mes.</td></tr>
            )}
            {negociacoes.map((neg) => (
              <tr key={neg.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{neg.cliente?.nome ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{neg.maquina ?? neg.marca ?? "—"}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-700">{formatCurrency(neg.valor ?? 0)}</td>
                <td className="px-4 py-3 text-gray-600">{neg.tipoPagamento ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{saved[neg.id] ?? neg.mesAnoReferencia ?? "—"}</td>
                <td className="px-4 py-3">
                  {editandoId === neg.id ? (
                    <div className="flex gap-2 items-center flex-wrap">
                      <select value={novoMes} onChange={(e) => setNovoMes(e.target.value)} className="text-xs border rounded px-2 py-1">
                        <option value="">Mes</option>
                        {MESES.map((m) => (<option key={m} value={m}>{MESES_LABEL[m]}</option>))}
                      </select>
                      <input type="number" value={novoAno} onChange={(e) => setNovoAno(e.target.value)} className="text-xs border rounded px-2 py-1 w-20" placeholder="Ano" />
                      <button onClick={() => salvarDesignacao(neg.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Salvar</button>
                      <button onClick={() => setEditandoId(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditandoId(neg.id); setNovoMes(""); setNovoAno("2026"); }} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Designar mes
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
