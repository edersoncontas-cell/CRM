"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { buscarClientes, novoId, type ClienteVista, type NovoCliente } from "@/lib/sem-sinal-regra";
import { telefoneRecusado, motivoTelefoneRecusado, telefoneParaGravar } from "@/lib/telefone-valido";

export type ClienteEscolhido = {
  id: string;
  nome: string;
  telefone: string | null;
  municipio: string | null;
  /** Presente quando foi cadastrado agora, sem sinal. */
  novo?: NovoCliente;
};

export const campo = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200";
export const rotulo = "mb-1 block text-xs font-semibold text-slate-600";

export function SeletorClienteSemSinal({
  clientes, valor, onChange,
}: {
  clientes: ClienteVista[];
  valor: ClienteEscolhido | null;
  onChange: (c: ClienteEscolhido | null) => void;
}) {
  const [termo, setTermo] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const achados = useMemo(() => buscarClientes(clientes, termo, 8), [clientes, termo]);

  if (valor) {
    return (
      <div>
        <span className={rotulo}>Cliente</span>
        <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-slate-900">{valor.nome}</div>
            <div className="truncate text-xs text-slate-500">
              {valor.novo ? "cliente novo — entra no CRM junto" : [valor.municipio, valor.telefone].filter(Boolean).join(" · ") || "sem cidade e telefone"}
            </div>
          </div>
          <button type="button" onClick={() => onChange(null)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 underline">
            Trocar
          </button>
        </div>
      </div>
    );
  }

  if (cadastrando) {
    const confirmar = () => {
      const n = nome.trim();
      if (n.length < 2) { setErro("Escreva o nome do cliente."); return; }
      if (telefoneRecusado(telefone)) { setErro(motivoTelefoneRecusado(telefone)); return; }
      const tel = telefoneParaGravar(telefone);
      onChange({ id: novoId(), nome: n, telefone: tel, municipio: null, novo: { nome: n, telefone: tel } });
    };
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Cliente novo</span>
          <button type="button" onClick={() => { setCadastrando(false); setErro(null); }} className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Voltar para a busca">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2">
          <div>
            <label className={rotulo} htmlFor="ss-novo-nome">Nome</label>
            <input id="ss-novo-nome" className={campo} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label className={rotulo} htmlFor="ss-novo-tel">Telefone (opcional)</label>
            <input id="ss-novo-tel" className={campo} value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" placeholder="DDD + número" autoComplete="off" />
          </div>
          {erro && <p className="text-xs font-semibold text-red-600">{erro}</p>}
          <p className="text-[11px] leading-snug text-slate-500">
            Se o telefone já for de alguém no CRM, quando o sinal voltar vale o cadastro que já existe — não duplica.
          </p>
          <button type="button" onClick={confirmar} className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white">
            Usar este cliente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className={rotulo} htmlFor="ss-busca-cliente">Cliente</label>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id="ss-busca-cliente"
          className={`${campo} pl-9`}
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Nome, cidade ou telefone"
          autoComplete="off"
        />
      </div>
      {termo.trim() && (
        <div className="mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {achados.itens.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => onChange({ id: c.id, nome: c.nome, telefone: c.telefone, municipio: c.municipio })}
              className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
            >
              <div className="truncate text-sm font-semibold text-slate-900">{c.nome}</div>
              <div className="truncate text-xs text-slate-500">{[c.municipio, c.telefone].filter(Boolean).join(" · ") || "—"}</div>
            </button>
          ))}
          {achados.total > achados.itens.length && (
            <div className="px-3 py-2 text-xs text-slate-500">e mais {achados.total - achados.itens.length} — escreva mais para achar.</div>
          )}
          {achados.total === 0 && <div className="px-3 py-2 text-xs text-slate-500">Ninguém com esse nome no que está guardado.</div>}
          <button
            type="button"
            onClick={() => { setCadastrando(true); setNome(termo.replace(/\d/g, "").trim()); setTelefone(/\d{8,}/.test(termo.replace(/\D/g, "")) ? termo.replace(/\D/g, "") : ""); }}
            className="flex w-full items-center gap-2 bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-brand-700"
          >
            <UserPlus size={15} /> Cadastrar cliente novo
          </button>
        </div>
      )}
    </div>
  );
}
