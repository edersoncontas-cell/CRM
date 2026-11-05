"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, X, ImagePlus, Loader2, Send, CheckCircle2 } from "lucide-react";
import { DICA_CAMPO, LIMITES } from "@/lib/suporte-regra";
import { usePrints, enterEnvia, postarSuporte } from "./usePrints";
import { MiniaturasPrints } from "./MiniaturasPrints";

// Botão "Suporte / Sugerir melhoria", em todas as telas (só aparece com o
// recurso ligado — o layout decide). Abre uma gaveta (celular) ou janela (PC)
// para descrever o problema ou a melhoria e por que importa, com print colado.
export function BotaoSuporte({ novos }: { novos: number | null }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [porQue, setPorQue] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const { prints, avisoPrint, adicionar, aoColar, remover, limpar, paraEnvio } = usePrints();
  const arquivo = useRef<HTMLInputElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (aberto) campo.current?.focus(); }, [aberto]);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto]);

  async function enviar() {
    if (enviando) return;
    if (!descricao.trim()) { setErro("Escreva o que aconteceu ou o que você quer."); return; }
    setEnviando(true);
    setErro(null);
    const r = await postarSuporte({
      acao: "novo", descricao, porQue, tela: caminho,
      contexto: `${window.innerWidth}x${window.innerHeight} · ${navigator.userAgent.slice(0, 200)}`,
      anexos: paraEnvio(),
    });
    setEnviando(false);
    if (!r.ok) { setErro(r.erro ?? "Não foi enviado."); return; }
    setDescricao(""); setPorQue(""); limpar(); setEnviado(true);
  }

  // Na tela do WhatsApp a caixa de mensagem fica embaixo: o botão sobe para não cobri-la.
  const naConversa = caminho?.startsWith("/atendimento");

  return (
    <>
      <button
        type="button"
        onClick={() => { setAberto(true); setEnviado(false); setErro(null); }}
        className="fixed right-4 z-30 flex items-center gap-1.5 rounded-full bg-agro-400 px-3.5 py-2.5 text-sm font-semibold text-black shadow-lg ring-1 ring-black/10 transition hover:brightness-105 print:hidden"
        style={{ bottom: naConversa ? "calc(var(--rodape-mercado) + 6.5rem)" : "calc(var(--rodape-mercado) + 0.75rem)" }}
        aria-label="Suporte ou sugerir melhoria"
        data-testid="botao-suporte"
      >
        <LifeBuoy size={18} />
        <span className="hidden sm:inline">Suporte / Sugerir melhoria</span>
        {!!novos && novos > 0 && (
          <span className="ml-0.5 rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white" title={`${novos} pedido(s) novo(s)`}>
            {novos}
          </span>
        )}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setAberto(false)}>
          <div
            role="dialog"
            aria-label="Suporte e sugestões"
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 text-slate-800 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold"><LifeBuoy size={18} /> Suporte / Sugerir melhoria</h2>
              <button type="button" onClick={() => setAberto(false)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Fechar"><X size={18} /></button>
            </div>

            {enviado ? (
              <div className="space-y-3 py-4 text-center">
                <CheckCircle2 className="mx-auto text-emerald-600" size={36} />
                <p className="font-semibold">Pedido enviado.</p>
                <p className="text-sm text-slate-600">Ele fica guardado com a tela onde você estava e os prints.</p>
                <div className="flex justify-center gap-2">
                  <Link href="/suporte" onClick={() => setAberto(false)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold">Ver pedidos</Link>
                  <button type="button" onClick={() => setEnviado(false)} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Mandar outro</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium" htmlFor="suporte-descricao">O que aconteceu ou o que você quer?</label>
                <textarea
                  id="suporte-descricao"
                  ref={campo}
                  value={descricao}
                  onChange={(e) => { setDescricao(e.target.value); setErro(null); }}
                  onPaste={aoColar}
                  onKeyDown={(e) => enterEnvia(e, enviar)}
                  maxLength={LIMITES.descricao}
                  rows={4}
                  placeholder={DICA_CAMPO}
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                />
                <label className="block text-sm font-medium" htmlFor="suporte-porque">Por que isso é importante? <span className="font-normal text-slate-500">(opcional)</span></label>
                <textarea
                  id="suporte-porque"
                  value={porQue}
                  onChange={(e) => setPorQue(e.target.value)}
                  onPaste={aoColar}
                  onKeyDown={(e) => enterEnvia(e, enviar)}
                  maxLength={LIMITES.porQue}
                  rows={2}
                  placeholder="Ex.: perco tempo toda manhã com isso"
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                />
                <p className="text-xs text-slate-500">{DICA_CAMPO}. Shift+Enter quebra a linha.</p>
                <MiniaturasPrints prints={prints} remover={remover} />
                {avisoPrint && <p className="text-xs text-amber-700">{avisoPrint}</p>}
                {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => arquivo.current?.click()}
                    disabled={prints.length >= LIMITES.anexosPorMensagem}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <ImagePlus size={16} /> Anexar print
                  </button>
                  <input
                    ref={arquivo}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => { void adicionar(Array.from(e.target.files ?? [])); e.target.value = ""; }}
                  />
                  <button
                    type="button"
                    onClick={enviar}
                    disabled={enviando}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {enviando ? "Enviando…" : "Enviar"}
                  </button>
                </div>
                <Link href="/suporte" onClick={() => setAberto(false)} className="block text-center text-xs text-slate-500 underline">Ver pedidos enviados</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
