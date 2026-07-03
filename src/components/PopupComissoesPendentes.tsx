"use client";

import { useState, useTransition } from "react";
import { X, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { marcarComissoesPagas } from "@/lib/actions";

type Pendente = {
  id: string;
  clienteNome: string;
  maquina: string | null;
  valor: number | null;
  comissao: number;
};

export function PopupComissoesPendentes({
  pendentes,
  mostrar,
  mesReferencia,
}: {
  pendentes: Pendente[];
  mostrar: boolean;
  mesReferencia: string;
}) {
  const [aberto, setAberto] = useState(mostrar && pendentes.length > 0);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(pendentes.map((p) => p.id)));
  const [pending, startTransition] = useTransition();

  if (!aberto) return null;

  function toggle(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function confirmar() {
    const ids = [...selecionados];
    if (!ids.length) return;
    startTransition(async () => {
      await marcarComissoesPagas(ids, mesReferencia);
      setAberto(false);
    });
  }

  const totalSelecionado = pendentes.filter((p) => selecionados.has(p.id)).reduce((s, p) => s + p.comissao, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-400" /> Pagamento de comissões
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">5º dia útil do mês — confirme as comissões já pagas</p>
          </div>
          <button onClick={() => setAberto(false)} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-2 max-h-[50vh] overflow-y-auto">
          {pendentes.map((p) => (
            <label key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={selecionados.has(p.id)}
                onChange={() => toggle(p.id)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-800 truncate">{p.clienteNome}</div>
                <div className="text-xs text-slate-500 truncate">{p.maquina ?? "—"}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-slate-800">{formatCurrency(p.valor)}</div>
                <div className="text-xs text-emerald-600">+{formatCurrency(p.comissao)}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="p-5 pt-3 border-t border-slate-100 flex items-center gap-3">
          <div className="flex-1 text-sm">
            <span className="text-slate-500">Selecionado: </span>
            <span className="font-bold text-emerald-600">{formatCurrency(totalSelecionado)}</span>
          </div>
          <button onClick={() => setAberto(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50 transition-colors">
            Depois
          </button>
          <button
            onClick={confirmar}
            disabled={pending || selecionados.size === 0}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-agro-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {pending ? "Confirmando..." : `Confirmar pagamento (${selecionados.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
