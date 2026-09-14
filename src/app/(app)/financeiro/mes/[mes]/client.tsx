"use client";

import { useState } from "react";
import { CheckCircle, Edit3 } from "lucide-react";

interface NegRow {
  id: string;
  clienteNome: string;
  maquina?: string;
  marca?: string;
  valor?: number;
  tipoPagamento?: string;
  faturadoEm?: string;
  mesAnoReferencia?: string;
}

const MESES = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function fmt(v?: number) {
  if (!v) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function MesDetailClient({ negs, mes, mesLabel, taxa }: { negs: NegRow[]; mes: string; mesLabel: string; taxa: number }) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novoMes, setNovoMes] = useState(mes);
  const [novoAno, setNovoAno] = useState("2026");
  const [saved, setSaved] = useState<Record<string, string>>({});

  const totalValor = negs.reduce((s, n) => s + (n.valor ?? 0), 0);
  const comissao = totalValor * taxa;

  async function salvar(id: string) {
    const ref = novoMes + "/" + novoAno;
    setSaved((p) => ({ ...p, [id]: ref }));
    setEditandoId(null);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <p className="text-xs font-medium text-emerald-600 mb-1">Total faturado</p>
          <p className="text-2xl font-bold text-emerald-700">{fmt(totalValor)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs font-medium text-blue-600 mb-1">Negociações</p>
          <p className="text-2xl font-bold text-blue-700">{negs.length}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-xs font-medium text-amber-600 mb-1">Comissão estimada (0.5%)</p>
          <p className="text-2xl font-bold text-amber-700">{fmt(comissao)}</p>
        </div>
      </div>

      {negs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Nenhuma negociação faturada em {mesLabel}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Máquina</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Pagamento</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Valor</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Mês/Ref.</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {negs.map((n) => (
                <tr key={n.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{n.clienteNome}</td>
                  <td className="px-4 py-3 text-gray-600">{n.marca ? n.marca + " " + (n.maquina ?? "") : (n.maquina ?? "—")}</td>
                  <td className="px-4 py-3 text-gray-600">{n.tipoPagamento ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(n.valor)}</td>
                  <td className="px-4 py-3 text-center">
                    {saved[n.id] ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <CheckCircle size={12} /> {saved[n.id]}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">{n.mesAnoReferencia ?? mesLabel}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editandoId === n.id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <select value={novoMes} onChange={(e) => setNovoMes(e.target.value)} className="text-xs border rounded px-1 py-0.5">
                          {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input type="number" value={novoAno} onChange={(e) => setNovoAno(e.target.value)} className="text-xs border rounded px-1 py-0.5 w-16" min={2020} max={2030} />
                        <button onClick={() => salvar(n.id)} className="text-xs bg-green-600 text-white rounded px-2 py-0.5 hover:bg-green-700">OK</button>
                        <button onClick={() => setEditandoId(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditandoId(n.id); setNovoMes(mes); }}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <Edit3 size={12} /> Designar mês
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
