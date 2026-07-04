"use client";

// Popup de confirmação de contatos do WhatsApp que ainda não têm nome salvo
// (criados automaticamente pelo pipeline como "Contato <telefone>"). Abre um
// por vez, mesmo layout do formulário de Novo Cliente, com o telefone já
// preenchido (sem +55/55) — ao salvar, avança para o próximo da fila.

import { useState, useTransition } from "react";
import { atualizarCliente } from "@/lib/actions";
import { X } from "lucide-react";

type ContatoPendente = { id: string; telefone: string };
type Municipio = { id: string; nome: string; foraDeArea?: boolean };

export function PopupContatoSemNome({
  contatos, municipios,
}: {
  contatos: ContatoPendente[];
  municipios: Municipio[];
}) {
  const [fila, setFila] = useState(contatos);
  const [salvando, startSalvar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const cidades = municipios.filter((m) => !m.foraDeArea);

  if (fila.length === 0) return null;
  const atual = fila[0];

  function avancar() {
    setErro(null);
    setFila((f) => f.slice(1));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-4">
      <form
        action={(fd) => {
          setErro(null);
          startSalvar(async () => {
            const r = await atualizarCliente(atual.id, fd);
            if (r.ok) avancar();
            else setErro(r.erro ?? "Erro ao salvar.");
          });
        }}
        className="my-auto w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Quem é esse contato?</h2>
          <button type="button" onClick={avancar} title="Deixar para depois">
            <X className="text-slate-400" />
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Conversou pelo WhatsApp mas ainda não está no seu cadastro
          {fila.length > 1 ? ` · mais ${fila.length - 1} depois deste` : ""}.
        </p>
        <div className="space-y-3">
          <Campo label="Nome *">
            <input name="nome" required autoFocus className="campo" />
          </Campo>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Telefone">
              <input name="telefone" defaultValue={atual.telefone} className="campo" />
            </Campo>
            <Campo label="E-mail">
              <input name="email" type="email" placeholder="cliente@email.com" className="campo" />
            </Campo>
          </div>
          <Campo label="Cidade / região">
            <select name="municipioId" className="campo">
              <option value="">—</option>
              {cidades.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </Campo>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <input type="checkbox" name="interesseFuturo" />
              ⏳ Interesse futuro (aguardando o momento certo)
            </label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Campo label="Lembrar em">
                <input type="date" name="interesseFuturoData" className="campo" />
              </Campo>
              <Campo label="Aguardando o quê?">
                <input name="interesseFuturoNota" placeholder="ex: Plano Safra 25/26" className="campo" />
              </Campo>
            </div>
          </div>
        </div>
        {erro && <p className="mt-3 text-sm text-red-500">{erro}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={avancar} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Deixar para depois
          </button>
          <button disabled={salvando} className="flex-1 rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
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
