"use client";

import { useState, useTransition } from "react";
import { adicionarVisita, removerVisita } from "@/lib/actions";
import { formatDateTime } from "@/lib/utils";
import { CalendarPlus, MapPin, Trash2, X } from "lucide-react";

type Visita = { id: string; data: string; observacao: string | null };

export function VisitasCliente({
  clienteId,
  visitas,
}: {
  clienteId: string;
  visitas: Visita[];
}) {
  const [adicionando, setAdicionando] = useState(false);
  const [removendo, startRemover] = useTransition();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <MapPin size={17} className="text-agro-500" /> Visitas
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
            {visitas.length}
          </span>
        </div>
        {!adicionando && (
          <button
            onClick={() => setAdicionando(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-agro-100 px-2.5 py-1 text-xs font-semibold text-agro-700 hover:bg-agro-200"
          >
            <CalendarPlus size={13} /> Registrar visita
          </button>
        )}
      </div>

      {adicionando && (
        <form
          action={async (fd) => {
            await adicionarVisita(clienteId, fd);
            setAdicionando(false);
          }}
          className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Nova visita</span>
            <button type="button" onClick={() => setAdicionando(false)}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Data e hora</span>
            <input type="datetime-local" name="data" required className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-agro-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Observação (opcional)</span>
            <input name="observacao" placeholder="O que foi feito na visita" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-agro-500" />
          </label>
          <button className="w-full rounded-lg bg-black py-2 text-sm font-bold text-agro-400 hover:bg-brand-800">
            Salvar visita
          </button>
        </form>
      )}

      {visitas.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma visita registrada ainda.</p>
      ) : (
        <ul className="space-y-2">
          {visitas.map((v) => (
            <li key={v.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-700">{formatDateTime(v.data)}</div>
                {v.observacao && <p className="text-xs text-slate-500">{v.observacao}</p>}
              </div>
              <button
                onClick={() => startRemover(() => removerVisita(v.id, clienteId))}
                disabled={removendo}
                className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                title="Remover visita"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
