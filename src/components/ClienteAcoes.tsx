"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Calendar, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { excluirCliente, adicionarVisita } from "@/lib/actions";
import { EditarClienteForm } from "@/components/EditarClienteForm";

type Municipio = { id: string; nome: string; foraDeArea?: boolean };
type MaquinaOpt = { id: string; marca: string; modelo: string; categoria: string };

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
  interesseFuturo?: boolean;
  interesseFuturoData?: string | null;
  interesseFuturoNota?: string | null;
};

export function ClienteAcoes({
  cliente,
  municipios,
  maquinas = [],
}: {
  cliente: ClienteData;
  municipios: Municipio[];
  maquinas?: MaquinaOpt[];
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [agendandoVisita, setAgendandoVisita] = useState(false);
  const [dataVisita, setDataVisita] = useState("");
  const [horaVisita, setHoraVisita] = useState("");
  const [obsVisita, setObsVisita] = useState("");
  const [excluindo, startExcluir] = useTransition();
  const [salvando, startSalvar] = useTransition();
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

  function abrirVisita(e: React.MouseEvent) {
    parar(e);
    setMenuAberto(false);
    // Pré-preenche com a data de hoje no fuso de Brasília
    const hoje = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const [d, m, y] = hoje.split("/");
    setDataVisita(`${y}-${m}-${d}`);
    setHoraVisita("");
    setObsVisita("");
    setAgendandoVisita(true);
  }

  function salvarVisita(e: React.MouseEvent) {
    parar(e);
    if (!dataVisita) return;
    startSalvar(async () => {
      const fd = new FormData();
      fd.set("data", `${dataVisita}T${horaVisita || "08:00"}`);
      fd.set("observacao", obsVisita);
      await adicionarVisita(cliente.id, fd);
      setAgendandoVisita(false);
    });
  }

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
        <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button
            onClick={abrirVisita}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <Calendar size={14} className="text-slate-500" /> Agendar visita
          </button>
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
        maquinas={maquinas}
        hideTrigger
        open={editando}
        onClose={() => setEditando(false)}
      />

      {/* Modal: agendar visita */}
      {agendandoVisita && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { parar(e); setAgendandoVisita(false); }}
        >
          <div onClick={parar} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-green-600" />
              <h2 className="text-lg font-bold text-slate-800">Agendar visita</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">{cliente.nome}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Data <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dataVisita}
                  onChange={(e) => setDataVisita(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Horário <span className="text-slate-400">(opcional)</span>
                </label>
                <input
                  type="time"
                  value={horaVisita}
                  onChange={(e) => setHoraVisita(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Observação <span className="text-slate-400">(opcional)</span>
                </label>
                <textarea
                  value={obsVisita}
                  onChange={(e) => setObsVisita(e.target.value)}
                  rows={2}
                  placeholder="Ex: Levar proposta do T6"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={(e) => { parar(e); setAgendandoVisita(false); }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                disabled={!dataVisita || salvando}
                onClick={salvarVisita}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar visita"}
              </button>
            </div>
          </div>
        </div>
      )}

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
