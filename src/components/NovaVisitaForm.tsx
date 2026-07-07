"use client";

import { useState, useTransition } from "react";
import { adicionarVisita } from "@/lib/actions";
import { Plus, X } from "lucide-react";

export function NovaVisitaForm({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [aberto, setAberto] = useState(false);
  const [salvando, startSalvar] = useTransition();
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        <Plus size={16} /> Nova visita
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-4">
          <form
            action={(fd) => {
              const clienteId = String(fd.get("clienteId") ?? "");
              if (!clienteId) return;
              startSalvar(async () => {
                await adicionarVisita(clienteId, fd);
                setAberto(false);
              });
            }}
            className="my-auto w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Nova visita</h2>
              <button type="button" onClick={() => setAberto(false)}>
                <X className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cliente *</label>
                <select name="clienteId" required className="campo">
                  <option value="">— Selecionar —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Data *</label>
                <input type="date" name="data" required defaultValue={hoje} className="campo" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Observação</label>
                <textarea name="observacao" rows={3} placeholder="O que foi tratado na visita..." className="campo" />
              </div>
            </div>
            <button disabled={salvando} className="mt-5 w-full rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
