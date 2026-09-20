"use client";

// A tela onde o vendedor liga um provedor de IA novo — do celular, em trinta
// segundos, sem abrir a Vercel e sem esperar deploy.
//
// É a resposta a "o que você consegue fazer para otimizar para eu usar
// despreocupado": com mais de um provedor configurado, quando um bate no
// limite o CRM cai no próximo sozinho e o Orientador não para.

import { useState, useTransition } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { salvarChaveIAAction, apagarChaveIAAction } from "@/lib/ai/chaves-actions";

export type LinhaChave = {
  id: string;
  nome: string;
  chave: string;
  configurado: boolean;
  gratuito: boolean;
  posicao: number | null;
  /** "hospedagem" quando veio da Vercel — aí a tela não deixa apagar. */
  origem: "hospedagem" | "crm" | null;
  /** A chave mascarada, quando veio do CRM. */
  mascarada: string | null;
  /** Onde pegar a chave, para quem ainda não tem. */
  onde: string | null;
};

export function ChavesIACard({ linhas, resumo, risco, solucao }: {
  linhas: LinhaChave[];
  resumo: string;
  risco: string | null;
  solucao: string | null;
}) {
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function salvar(provedor: string) {
    setAviso(null);
    startTransition(async () => {
      const r = await salvarChaveIAAction(provedor, valor).catch(() => ({ ok: false, erro: "Falha ao salvar." }));
      if (!r.ok) { setAviso(r.erro ?? "Não deu para salvar."); return; }
      setAbrindo(null); setValor("");
      setAviso("Chave salva. O CRM já vai usar este provedor na próxima análise.");
    });
  }

  function apagar(provedor: string, nome: string) {
    if (!window.confirm(`Apagar a chave do ${nome}? O CRM deixa de usar este provedor.`)) return;
    setAviso(null);
    startTransition(async () => {
      const r = await apagarChaveIAAction(provedor).catch(() => ({ ok: false, erro: "Falha ao apagar." }));
      setAviso(r.ok ? "Chave apagada." : (r.erro ?? "Não deu para apagar."));
    });
  }

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: risco ? "rgba(248,113,113,0.35)" : "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-white">Provedores de IA</h2>
        <span className="text-xs" style={{ color: risco ? "#f87171" : "#a1a1aa" }}>{resumo}</span>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        O CRM tenta nesta ordem. Quando um recusa (limite, instabilidade), o próximo assume sozinho — por isso ter mais de um é o que faz o Orientador nunca parar.
      </p>

      <ul className="mt-3 space-y-2">
        {linhas.map((l) => (
          <li key={l.id} className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-4 shrink-0 text-center font-bold" style={{ color: l.configurado ? "#4ade80" : "#52525b" }}>
                {l.configurado ? "✓" : "○"}
              </span>
              <span className="font-semibold" style={{ color: l.configurado ? "#e4e4e7" : "#a1a1aa" }}>
                {l.posicao ? `${l.posicao}º · ` : ""}{l.nome}
              </span>
              {l.gratuito && (
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>
                  tem camada grátis
                </span>
              )}
              {l.origem === "hospedagem" && <span className="text-[10px] text-zinc-500">definida na hospedagem</span>}
              {l.mascarada && <code className="text-[10px] text-zinc-500">{l.mascarada}</code>}

              <span className="ml-auto flex items-center gap-1">
                {!l.configurado && (
                  <button onClick={() => { setAbrindo(abrindo === l.id ? null : l.id); setValor(""); setAviso(null); }}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold"
                    style={{ background: "rgba(191,222,77,0.15)", color: "#BFDE4D" }}>
                    <Plus size={12} /> Ligar
                  </button>
                )}
                {l.origem === "crm" && (
                  <>
                    <button onClick={() => { setAbrindo(abrindo === l.id ? null : l.id); setValor(""); setAviso(null); }}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:text-white">
                      Trocar
                    </button>
                    <button onClick={() => apagar(l.id, l.nome)} aria-label={`Apagar chave do ${l.nome}`}
                      className="rounded-lg p-1 text-zinc-500 hover:text-red-400">
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </span>
            </div>

            {abrindo === l.id && (
              <div className="mt-2 border-t pt-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {l.onde && <p className="mb-1.5 text-[11px] text-zinc-400">Pegue a chave em <span className="text-zinc-200">{l.onde}</span> e cole abaixo.</p>}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="password" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus
                    placeholder={`Cole aqui a chave do ${l.nome}`}
                    className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                    style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <button onClick={() => salvar(l.id)} disabled={salvando || !valor.trim()}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-bold disabled:opacity-50"
                    style={{ background: "#BFDE4D", color: "#09090b" }}>
                    {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar
                  </button>
                  <button onClick={() => { setAbrindo(null); setValor(""); }} aria-label="Cancelar"
                    className="rounded-lg p-2 text-zinc-500 hover:text-white"><X size={14} /></button>
                </div>
                <p className="mt-1.5 text-[10px] text-zinc-600">
                  A chave fica guardada no banco do próprio CRM e nunca aparece inteira nesta tela.
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {aviso && <p className="mt-2 text-[11px]" style={{ color: "#BFDE4D" }}>{aviso}</p>}

      {risco && (
        <div className="mt-3 rounded-xl p-3 text-xs" style={{ background: "rgba(248,113,113,0.08)" }}>
          <p style={{ color: "#fca5a5" }}>{risco}</p>
          {solucao && <p className="mt-1" style={{ color: "#e4e4e7" }}>{solucao}</p>}
        </div>
      )}
    </div>
  );
}
