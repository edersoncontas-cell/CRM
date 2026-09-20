"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, Merge, AlertTriangle } from "lucide-react";
import { contatosParaUnir, previaDaUniao, unirContatos, type ContatoUnivel } from "@/lib/unir-contatos-actions";

// "se eu clicar nos 3 pontinhos e depois em unir contato, todos os outros
//  contatos irão abrir uma caixinha de seleção, ao selecionar um ou mais, e
//  depois clicar em confirmar, os contatos selecionados serão 1 só"
//
// Duas coisas que a tela faz questão de dizer ANTES do clique final, porque
// unir não tem botão de desfazer nesta tela:
//   • QUEM FICA, e por quê (é sempre o do Google — ver unir-contatos-regra);
//   • QUANTO cada cadastro carrega (negociações, visitas, conversas), para o
//     vendedor perceber se está prestes a unir algo grande por engano.

export function UnirContatosModal({ clienteId, clienteNome, onClose }: { clienteId: string; clienteNome: string; onClose: () => void }) {
  const [carregando, setCarregando] = useState(true);
  const [base, setBase] = useState<ContatoUnivel | null>(null);
  const [opcoes, setOpcoes] = useState<ContatoUnivel[]>([]);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [previa, setPrevia] = useState<{ ficaNome: string; motivo: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [unindo, start] = useTransition();

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    contatosParaUnir(clienteId, busca)
      .then((r) => { if (ativo) { setBase(r.base); setOpcoes(r.opcoes); } })
      .catch(() => { if (ativo) setErro("Não deu para carregar os contatos."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [clienteId, busca]);

  // Quem fica é recalculado a cada marcação: o vendedor vê a consequência
  // antes de confirmar, não depois.
  useEffect(() => {
    if (!marcados.length) { setPrevia(null); return; }
    let ativo = true;
    previaDaUniao([clienteId, ...marcados])
      .then((r) => { if (ativo && r.ficaId) setPrevia({ ficaNome: r.ficaNome, motivo: r.motivo }); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [clienteId, marcados]);

  function alternar(id: string) {
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  function confirmar() {
    setErro(null);
    start(async () => {
      const r = await unirContatos([clienteId, ...marcados]);
      if (!r.ok) { setErro(r.erro ?? "Não deu para unir agora."); return; }
      setFeito(`${r.unidos} cadastro(s) viraram um só: ${r.ficaNome}.`);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Merge size={18} className="text-brand-600" />
            <h2 className="text-lg font-bold text-slate-800">Unir contato</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Marque os cadastros que são <b>a mesma pessoa</b> que <b>{clienteNome}</b>. Tudo o que está neles — negociações,
            visitas, conversas, frota e histórico — passa para um cadastro só.
          </p>
        </div>

        {feito ? (
          <div className="px-5 py-6">
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{feito}</p>
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Fechar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
                <Search size={14} className="shrink-0 text-slate-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar outro contato por nome ou telefone…"
                  className="min-w-0 flex-1 text-sm outline-none"
                />
              </div>
            </div>

            <div className="max-h-[46vh] overflow-y-auto px-5 py-3">
              {carregando ? (
                <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Carregando…</div>
              ) : opcoes.length === 0 ? (
                <p className="py-6 text-sm text-slate-400">
                  {busca.trim() ? "Nenhum contato encontrado com esse nome ou telefone." : "O CRM não achou nenhum parecido. Use a busca acima para escolher na mão."}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {opcoes.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50">
                        <input type="checkbox" checked={marcados.includes(c.id)} onChange={() => alternar(c.id)} className="mt-1 h-4 w-4 shrink-0 accent-brand-600" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <b className="text-sm text-slate-800">{c.nome}</b>
                            {c.doGoogle && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">Google</span>}
                            {c.sugerido && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">parece o mesmo</span>}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {c.municipio ?? "Sem município"} · {c.telefone ?? "sem telefone"}
                            {c.vinculos > 0 && ` · ${c.vinculos} registro(s) ligados`}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-slate-100 px-5 py-3">
              {previa && (
                <p className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Vai ficar: <b className="text-slate-800">{previa.ficaNome}</b> — {previa.motivo}.
                </p>
              )}
              {erro && (
                <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
                <button
                  onClick={confirmar}
                  disabled={!marcados.length || unindo}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {unindo ? <Loader2 size={14} className="animate-spin" /> : <Merge size={14} />}
                  {unindo ? "Unindo…" : `Confirmar${marcados.length ? ` (${marcados.length + 1})` : ""}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
