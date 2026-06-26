"use client";

import { useState, useTransition } from "react";
import { atualizarCliente, gerenciarFrotaCliente } from "@/lib/actions";
import { Pencil, X, Plus, Trash2 } from "lucide-react";

type Municipio = { id: string; nome: string; foraDeArea?: boolean };
type MaquinaOpt = { id: string; marca: string; modelo: string; categoria: string };
type FrotaItem = { id: string; marca: string; modelo: string };

const STATUS_OPTS = [
  { value: "cliente", label: "✓ Cliente", cor: "text-green-700 bg-green-50 border-green-200" },
  { value: "potencial", label: "Potencial cliente", cor: "text-amber-700 bg-amber-50 border-amber-200" },
  { value: "nao_cliente", label: "Não é cliente", cor: "text-red-700 bg-red-50 border-red-200" },
];

export function EditarClienteForm({
  cliente,
  municipios,
  maquinas = [],
  frotaAtual = [],
  open,
  onClose,
  hideTrigger = false,
}: {
  cliente: {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
    endereco?: string | null;
    municipioId: string | null;
    observacoes?: string | null;
    jaComprou?: boolean;
    visitado?: boolean;
    status?: string | null;
    interesseFuturo?: boolean;
    interesseFuturoData?: string | null;
    interesseFuturoNota?: string | null;
  };
  municipios: Municipio[];
  maquinas?: MaquinaOpt[];
  frotaAtual?: FrotaItem[];
  open?: boolean;
  onClose?: () => void;
  hideTrigger?: boolean;
}) {
  const [interno, setInterno] = useState(false);
  const aberto = open ?? interno;
  const fechar = () => { setInterno(false); onClose?.(); };

  const statusInicial = (cliente.status ?? (cliente.jaComprou ? "cliente" : "potencial")) as string;
  const [status, setStatus] = useState(statusInicial);
  const [frota, setFrota] = useState<FrotaItem[]>(frotaAtual);
  const [marcaSel, setMarcaSel] = useState("New Holland");
  const [modeloSel, setModeloSel] = useState("");
  const [, startFrota] = useTransition();

  const marcas = ["New Holland", "Dynapac"];
  const modelosPorMarca = maquinas
    .filter((m) => m.marca === marcaSel)
    .map((m) => m.modelo)
    .sort();

  function addFrota() {
    if (!modeloSel) return;
    const nova: FrotaItem = { id: `tmp-${Date.now()}`, marca: marcaSel, modelo: modeloSel };
    setFrota((prev) => [...prev, nova]);
    setModeloSel("");
  }

  function removeFrota(id: string) {
    setFrota((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={() => setInterno(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200"
        >
          <Pencil size={14} /> Editar dados
        </button>
      )}

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-4 px-4"
          onClick={fechar}
        >
          <form
            action={async (fd) => {
              fd.set("status", status);
              await atualizarCliente(cliente.id, fd);
              startFrota(async () => {
                await gerenciarFrotaCliente(cliente.id, frota.map((f) => ({ marca: f.marca, modelo: f.modelo })));
              });
              fechar();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl my-auto"
            style={{ isolation: "isolate" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Editar cliente</h2>
              <button type="button" onClick={fechar}><X className="text-slate-400" /></button>
            </div>

            <div className="space-y-3">
              <Campo label="Nome *">
                <input name="nome" required defaultValue={cliente.nome} className="campo" />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Telefone">
                  <input name="telefone" defaultValue={cliente.telefone ?? ""} placeholder="28 99999-9999" className="campo" />
                </Campo>
                <Campo label="E-mail">
                  <input name="email" type="email" defaultValue={cliente.email ?? ""} placeholder="cliente@email.com" className="campo" />
                </Campo>
              </div>
              <Campo label="Cidade / região">
                <select name="municipioId" defaultValue={cliente.municipioId ?? ""} className="campo">
                  <option value="">—</option>
                  <optgroup label="Cidades que atendo">
                    {municipios.filter((m) => !m.foraDeArea).map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Fora da minha área">
                    {municipios.filter((m) => m.foraDeArea).map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </optgroup>
                </select>
              </Campo>

              <Campo label="Status do cliente">
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${status === opt.value ? opt.cor + " ring-2 ring-offset-1 ring-current" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Campo>

              {status === "cliente" && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2" style={{ overflow: "hidden" }}>
                  <div className="text-sm font-semibold text-blue-800">🚜 Frota do cliente</div>
                  {frota.length > 0 && (
                    <ul className="space-y-1">
                      {frota.map((f) => (
                        <li key={f.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm border border-blue-100">
                          <span className="font-medium text-slate-700">{f.marca} — {f.modelo}</span>
                          <button type="button" onClick={() => removeFrota(f.id)} className="text-red-400 hover:text-red-600 ml-2">
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <select
                      value={marcaSel}
                      onChange={(e) => { setMarcaSel(e.target.value); setModeloSel(""); }}
                      className="campo flex-1"
                    >
                      {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {modelosPorMarca.length > 0 ? (
                      <select
                        value={modeloSel}
                        onChange={(e) => setModeloSel(e.target.value)}
                        className="campo flex-1"
                      >
                        <option value="">Modelo…</option>
                        {modelosPorMarca.map((m) => <option key={m} value={m}>{m}</option>)}
                        <option value="__outro__">Outro (digitar)</option>
                      </select>
                    ) : (
                      <input
                        value={modeloSel === "__outro__" ? "" : modeloSel}
                        onChange={(e) => setModeloSel(e.target.value)}
                        placeholder="Digite o modelo…"
                        className="campo flex-1"
                      />
                    )}
                    <button type="button" onClick={addFrota} disabled={!modeloSel || modeloSel === "__outro__"}
                      className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-white disabled:opacity-40 hover:bg-blue-700">
                      <Plus size={16} />
                    </button>
                  </div>
                  {modeloSel === "__outro__" && modelosPorMarca.length > 0 && (
                    <input
                      placeholder="Digite o modelo"
                      className="campo"
                      onChange={(e) => setModeloSel(e.target.value || "__outro__")}
                    />
                  )}
                </div>
              )}

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3" style={{ overflow: "hidden" }}>
                <label className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <input type="checkbox" name="interesseFuturo" defaultChecked={cliente.interesseFuturo} />
                  ⏳ Interesse futuro (aguardando o momento certo)
                </label>
                <div className="mt-2 space-y-2">
                  <Campo label="Lembrar em">
                    <input
                      type="date"
                      name="interesseFuturoData"
                      defaultValue={cliente.interesseFuturoData ?? ""}
                      className="campo"
                      style={{ width: "100%", boxSizing: "border-box", minHeight: "38px" }}
                    />
                  </Campo>
                  <Campo label="Aguardando o quê?">
                    <input
                      name="interesseFuturoNota"
                      defaultValue={cliente.interesseFuturoNota ?? ""}
                      placeholder="ex: Plano Safra 25/26"
                      className="campo"
                    />
                  </Campo>
                </div>
              </div>
            </div>

            <button className="mt-5 w-full rounded-lg bg-black py-2.5 font-bold text-agro-400 hover:bg-brand-800">
              Salvar alterações
            </button>
          </form>
        </div>
      )}
      <style>{`
        .campo {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: .5rem;
          padding: .5rem .75rem;
          font-size: .875rem;
          outline: none;
          box-sizing: border-box;
          max-width: 100%;
          -webkit-appearance: none;
          appearance: none;
        }
        .campo:focus {
          border-color: #ffb81c;
          box-shadow: 0 0 0 2px #ffe7a3;
        }
        input[type="date"].campo {
          display: block;
          width: 100%;
          box-sizing: border-box;
          -webkit-appearance: none;
          appearance: none;
        }
      `}</style>
    </>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
