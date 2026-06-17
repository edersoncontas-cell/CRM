"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { excluirCliente } from "@/lib/actions";
import { EditarClienteForm } from "@/components/EditarClienteForm";

type Municipio = { id: string; nome: string; foraDeArea?: boolean };

type ClienteData = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  municipioId: string | null;
  observacoes: string | null;
  jaComprou: boolean;
  visitado: boolean;
};

export function ClienteAcoes({
  cliente,
  municipios,
}: {
  cliente: ClienteData;
  municipios: Municipio[];
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, startExcluir] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora.
  useEffect(() => {
    if (!menuAberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [menuAberto]);

  // Impede que o clique navegue para a ficha (o card é um Link).
  const parar = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div ref={ref} className="relative" onClick={parar}>
      <button
        onClick={(e) => { parar(e); setMenuAberto((v) => !v); }}
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        title="Opções"
        aria-label="Opções do cliente"
      >
        <MoreVertical size={18} />
      </button>

      {menuAberto && (
        <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button
            onClick={(e) => { parar(e); setMenuAberto(false); setEditando(true); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <Pencil size={14} className="text-slate-500" /> Editar
          </button>
          <button
            onClick={(e) => { parar(e); setMenuAberto(false); setConfirmando(true); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      )}

      {/* Modal de edição (controlado) */}
      <EditarClienteForm
        cliente={cliente}
        municipios={municipios}
        hideTrigger
        open={editando}
        onClose={() => setEditando(false)}
      />

      {/* Confirmação de exclusão */}
      {confirmando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { parar(e); setConfirmando(false); }}
        >
          <div onClick={parar} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">Excluir cliente</h2>
            <p className="mt-2 text-sm text-slate-600">
              Tem certeza que deseja excluir <b>{cliente.nome}</b>? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={(e) => { parar(e); setConfirmando(false); }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                disabled={excluindo}
                onClick={(e) => {
                  parar(e);
                  startExcluir(async () => {
                    await excluirCliente(cliente.id);
                    setConfirmando(false);
                  });
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {excluindo ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
