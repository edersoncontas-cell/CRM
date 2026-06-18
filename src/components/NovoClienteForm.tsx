"use client";

import { useState } from "react";
import { criarCliente } from "@/lib/actions";
import { Plus, X } from "lucide-react";

export function NovoClienteForm({
  municipios,
}: {
  municipios: { id: string; nome: string; foraDeArea?: boolean }[];
}) {
  const [aberto, setAberto] = useState(false);
  const cidades = municipios.filter((m) => !m.foraDeArea);
  const regioes = municipios.filter((m) => m.foraDeArea);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        <Plus size={16} /> Novo cliente
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            action={async (fd) => {
              await criarCliente(fd);
              setAberto(false);
            }}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Novo cliente</h2>
              <button type="button" onClick={() => setAberto(false)}>
                <X className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <Campo label="Nome *">
                <input name="nome" required className="campo" />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Telefone">
                  <input name="telefone" placeholder="28 99999-9999" className="campo" />
                </Campo>
                <Campo label="E-mail">
                  <input name="email" type="email" placeholder="cliente@email.com" className="campo" />
                </Campo>
              </div>
              <Campo label="Cidade / região">
                <select name="municipioId" className="campo">
                  <option value="">—</option>
                  <optgroup label="Cidades que atendo">
                    {cidades.map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </optgroup>
                  {regioes.length > 0 && (
                    <optgroup label="Fora da minha área (não recebe campanhas)">
                      {regioes.map((m) => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </Campo>
              <Campo label="Endereço">
                <input name="endereco" placeholder="Rua, nº, bairro" className="campo" />
              </Campo>
              <Campo label="Origem">
                <select name="origem" className="campo">
                  <option value="manual">Manual</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="indicacao">Indicação</option>
                  <option value="feira">Feira/Evento</option>
                </select>
              </Campo>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="jaComprou" /> Já comprou
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="visitado" /> Já recebeu visita
                </label>
              </div>
            </div>
            <button className="mt-5 w-full rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700">
              Salvar
            </button>
          </form>
        </div>
      )}
      <style>{`.campo{width:100%;border:1px solid #cbd5e1;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem;outline:none}.campo:focus{border-color:#2f82ff;box-shadow:0 0 0 2px #bcdcff}`}</style>
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
