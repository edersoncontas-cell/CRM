"use client";

import { useState } from "react";
import { atualizarCliente } from "@/lib/actions";
import { Pencil, X } from "lucide-react";

type Municipio = { id: string; nome: string; foraDeArea?: boolean };

export function EditarClienteForm({
  cliente,
  municipios,
  open,
  onClose,
  hideTrigger = false,
}: {
  cliente: {
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
  municipios: Municipio[];
  open?: boolean;          // modo controlado (opcional)
  onClose?: () => void;
  hideTrigger?: boolean;   // esconde o botão padrão "Editar dados"
}) {
  const [interno, setInterno] = useState(false);
  const aberto = open ?? interno;
  const fechar = () => { setInterno(false); onClose?.(); };

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={fechar}>
          <form
            action={async (fd) => {
              await atualizarCliente(cliente.id, fd);
              fechar();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Editar cliente</h2>
              <button type="button" onClick={fechar}>
                <X className="text-slate-400" />
              </button>
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
                  <optgroup label="Fora da minha área (não recebe campanhas)">
                    {municipios.filter((m) => m.foraDeArea).map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </optgroup>
                </select>
              </Campo>
              <Campo label="Endereço">
                <input name="endereco" defaultValue={cliente.endereco ?? ""} placeholder="Rua, nº, bairro" className="campo" />
              </Campo>
              <Campo label="Observações">
                <textarea name="observacoes" defaultValue={cliente.observacoes ?? ""} rows={2} className="campo" />
              </Campo>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="jaComprou" defaultChecked={cliente.jaComprou} /> Já comprou
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="visitado" defaultChecked={cliente.visitado} /> Visitado
                </label>
              </div>
            </div>
            <button className="mt-5 w-full rounded-lg bg-black py-2.5 font-bold text-agro-400 hover:bg-brand-800">
              Salvar alterações
            </button>
          </form>
        </div>
      )}
      <style>{`.campo{width:100%;border:1px solid #cbd5e1;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem;outline:none}.campo:focus{border-color:#ffb81c;box-shadow:0 0 0 2px #ffe7a3}`}</style>
    </>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
