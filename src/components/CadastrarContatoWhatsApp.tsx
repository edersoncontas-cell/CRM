"use client";

// Botão "Cadastrar" ao lado de uma conversa de WhatsApp sem cliente vinculado
// (dashboard e outras listas) — abre um popup no mesmo padrão do Novo Cliente,
// com o telefone já preenchido.

import { useState, useTransition } from "react";
import { criarCliente } from "@/lib/actions";
import { UserPlus, X } from "lucide-react";

export function CadastrarContatoWhatsApp({
  telefone, municipios,
}: {
  telefone: string;
  municipios: { id: string; nome: string; foraDeArea?: boolean }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [salvando, startSalvar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const cidades = municipios.filter((m) => !m.foraDeArea);

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto(true); }}
        title="Cadastrar cliente"
        className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
        style={{ background: "rgba(191,222,77,0.15)", color: "#BFDE4D" }}
      >
        <UserPlus size={12} /> Cadastrar
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-4"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <form
            action={(fd) => {
              setErro(null);
              fd.set("origem", "whatsapp");
              startSalvar(async () => {
                const r = await criarCliente(fd);
                if (r.ok) setAberto(false);
                else setErro(r.erro ?? "Erro ao salvar.");
              });
            }}
            className="my-auto w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Cadastrar cliente</h2>
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto(false); }}>
                <X className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <Campo label="Nome *">
                <input name="nome" required autoFocus className="campo" />
              </Campo>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo label="Telefone">
                  <input name="telefone" defaultValue={telefone} className="campo" />
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
            </div>
            {erro && <p className="mt-3 text-sm text-red-500">{erro}</p>}
            <button disabled={salvando} className="mt-5 w-full rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </form>
        </div>
      )}
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
