"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Users, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { buscarClientesPorIds, mesclarClientes } from "@/lib/actions";

type ClienteInfo = { id: string; nome: string; telefone: string | null; municipio: string | null; criadoEm: string };

export function MesclarClientesModal({
  clienteIds,
  onClose,
  onMesclado,
}: {
  clienteIds: string[];
  onClose: () => void;
  onMesclado?: () => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [clientes, setClientes] = useState<ClienteInfo[]>([]);
  const [principalId, setPrincipalId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    buscarClientesPorIds(clienteIds)
      .then((r) => {
        setClientes(r);
        setPrincipalId(r[0]?.id ?? null);
      })
      .catch(() => setErro("Não foi possível carregar os clientes."))
      .finally(() => setCarregando(false));
  }, [clienteIds]);

  function confirmar() {
    if (!principalId) return;
    const duplicataIds = clientes.map((c) => c.id).filter((id) => id !== principalId);
    startTransition(async () => {
      const r = await mesclarClientes(principalId, duplicataIds);
      if (r.ok) {
        setSucesso(true);
        setTimeout(() => { onMesclado?.(); onClose(); }, 1200);
      } else {
        setErro(r.erro ?? "Falha ao mesclar.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-agro-400" />
            <h3 className="text-lg font-bold text-white">Mesclar clientes duplicados</h3>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {carregando ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : sucesso ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} /> Clientes mesclados com sucesso.
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Escolha qual cadastro é o <b>principal</b> — os outros terão negociações, visitas, conversas e
                histórico movidos para ele, e depois serão excluídos.
              </p>
              <div className="space-y-2">
                {clientes.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50"
                  >
                    <input
                      type="radio"
                      name="principal"
                      checked={principalId === c.id}
                      onChange={() => setPrincipalId(c.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{c.nome}</div>
                      <div className="text-xs text-slate-400">
                        {c.telefone ?? "sem telefone"} {c.municipio ? `· ${c.municipio}` : ""}
                      </div>
                      <div className="text-[11px] text-slate-400">Cadastrado em {new Date(c.criadoEm).toLocaleDateString("pt-BR")}</div>
                    </div>
                  </label>
                ))}
              </div>

              {erro && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle size={14} /> {erro}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button onClick={onClose} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={confirmar}
                  disabled={isPending || !principalId || clientes.length < 2}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-agro-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Mesclando..." : "Mesclar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
