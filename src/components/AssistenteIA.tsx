"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { interpretarComando, executarPlano } from "@/lib/actions";
import type { AcaoPlano } from "@/lib/assistente";
import { ExcavatorIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  X, Mic, MicOff, Send, Loader2, Check, AlertTriangle, Sparkles,
  UserPlus, Pencil, KanbanSquare, ListChecks, CalendarPlus,
} from "lucide-react";

const ICONE_ACAO: Record<string, React.ReactNode> = {
  criar_cliente: <UserPlus size={14} />,
  editar_cliente: <Pencil size={14} />,
  criar_card: <KanbanSquare size={14} />,
  criar_tarefa: <ListChecks size={14} />,
  agendar_visita: <CalendarPlus size={14} />,
};

type Fase = "idle" | "interpretando" | "confirmando" | "executando" | "feito";

// Tipos mínimos da Web Speech API (evita depender de libs de tipos do navegador).
type RecEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> };
type RecLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: RecEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

export function AssistenteIA() {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [fase, setFase] = useState<Fase>("idle");
  const [resposta, setResposta] = useState<string>("");
  const [plano, setPlano] = useState<AcaoPlano[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const [, startT] = useTransition();
  const recRef = useRef<unknown>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Posição do botão flutuante (arrastável). null = posição padrão (canto inf. direito).
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; offX: number; offY: number; moved: boolean } | null>(null);
  const BTN = 56;

  useEffect(() => {
    try {
      const s = localStorage.getItem("assistente_pos");
      if (s) { const p = JSON.parse(s); setPos(p); posRef.current = p; }
    } catch {}
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    btnRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, offX: e.clientX - rect.left, offY: e.clientY - rect.top, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.startX) > 6 || Math.abs(e.clientY - d.startY) > 6) d.moved = true;
    if (!d.moved) return;
    const x = Math.max(8, Math.min(window.innerWidth - BTN - 8, e.clientX - d.offX));
    const y = Math.max(8, Math.min(window.innerHeight - BTN - 8, e.clientY - d.offY));
    const np = { x, y };
    posRef.current = np;
    setPos(np);
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    btnRef.current?.releasePointerCapture(e.pointerId);
    if (d && !d.moved) {
      setAberto((v) => !v); // toque sem arrastar = abrir/fechar
    } else if (d && d.moved && posRef.current) {
      try { localStorage.setItem("assistente_pos", JSON.stringify(posRef.current)); } catch {}
    }
  }

  // Calcula onde o painel abre, próximo ao botão e dentro da tela.
  function painelStyle(): React.CSSProperties {
    if (!pos || typeof window === "undefined") {
      return { bottom: "calc(6rem + env(safe-area-inset-bottom))", right: "1.25rem" };
    }
    const w = Math.min(window.innerWidth * 0.92, 384);
    const h = Math.min(window.innerHeight * 0.7, 520);
    const gap = 12;
    let left = pos.x + BTN / 2 > window.innerWidth / 2 ? pos.x + BTN - w : pos.x;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = pos.y + BTN / 2 > window.innerHeight / 2 ? pos.y - h - gap : pos.y + BTN + gap;
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    return { left, top, width: w };
  }

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 50);
  }, [aberto]);

  function reset() {
    setTexto(""); setFase("idle"); setResposta(""); setPlano([]); setFeedback(null);
  }

  // Ditado por voz (Web Speech API — grátis, no navegador).
  function toggleVoz() {
    const SR =
      (typeof window !== "undefined" &&
        ((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)) || null;
    if (!SR) { alert("Seu navegador não suporta ditado por voz. Use o Chrome."); return; }
    if (ouvindo) { (recRef.current as RecLike | null)?.stop(); setOuvindo(false); return; }
    const rec = new (SR as { new (): RecLike })();
    rec.lang = "pt-BR"; rec.continuous = true; rec.interimResults = false;
    rec.onresult = (e: RecEvent) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      if (t) setTexto((prev) => (prev ? prev + " " : "") + t);
    };
    rec.onend = () => setOuvindo(false);
    rec.start();
    recRef.current = rec;
    setOuvindo(true);
  }

  function interpretar() {
    const t = texto.trim();
    if (!t) return;
    setFeedback(null);
    setFase("interpretando");
    setTexto("");
    startT(async () => {
      const r = await interpretarComando(t);
      setResposta(r.resposta ?? "");
      if (!r.ok) { setFeedback(r.erro ?? "Erro."); setFase("idle"); return; }
      setPlano(r.plano ?? []);
      setFase((r.plano ?? []).length > 0 ? "confirmando" : "idle");
    });
  }

  function confirmar() {
    const validas = plano.filter((a) => !a.erro);
    if (validas.length === 0) { reset(); return; }
    setFase("executando");
    startT(async () => {
      const r = await executarPlano(validas);
      setFeedback(r.mensagem);
      setFase("feito");
      setTimeout(() => { setFase("idle"); setPlano([]); setResposta(""); }, 4000);
    });
  }

  const temErro = plano.some((a) => a.erro);
  const validas = plano.filter((a) => !a.erro);

  return (
    <>
      {/* Botão flutuante (robozinho) — arrastável; toque abre/fecha */}
      <button
        ref={btnRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        aria-label="Assistente IA (arraste para mover)"
        title="Toque para abrir · arraste para mover"
        className="fixed z-40 flex h-14 w-14 touch-none select-none items-center justify-center rounded-full shadow-xl transition hover:scale-105"
        style={{
          ...(pos
            ? { left: pos.x, top: pos.y }
            : { right: "1.25rem", bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }),
          background: "linear-gradient(135deg,#1a63f5,#0b3aa0)",
          boxShadow: "0 0 0 4px rgba(191,222,77,0.15),0 8px 24px rgba(0,0,0,0.3)",
          cursor: "grab",
        }}
      >
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-agro-400 text-[9px] font-black text-black">IA</span>
        <ExcavatorIcon size={26} className="text-white" />
        {!aberto && !pos && <span className="absolute inset-0 animate-ping rounded-full" style={{ background: "rgba(26,99,245,0.25)" }} />}
      </button>

      {/* Painel */}
      {aberto && (
        <div className="fixed z-40 flex max-h-[70vh] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-700 shadow-2xl" style={{ background: "#18181b", ...painelStyle() }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#0b3aa0" }}>
            <ExcavatorIcon size={20} className="text-agro-400" />
            <div className="flex-1">
              <div className="text-sm font-bold text-white">Assistente IA 🚜</div>
              <div className="text-[10px] text-blue-200">Comande por voz ou texto</div>
            </div>
            <button onClick={() => { setAberto(false); }} className="rounded-lg p-1 text-blue-200 hover:bg-white/10 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {/* Corpo */}
          <div className="flex-1 overflow-y-auto p-4">
            {fase === "idle" && (
              <div className="space-y-2 text-xs text-slate-400">
                <p className="flex items-center gap-1.5 text-slate-300"><Sparkles size={13} className="text-agro-400" /> Exemplos de comando:</p>
                <ul className="space-y-1 pl-1">
                  <li>• &quot;Cadastra o João da Silva de Cachoeiro, telefone 28 99999-0000&quot;</li>
                  <li>• &quot;Agenda visita pro Renato sexta-feira&quot;</li>
                  <li>• &quot;Cria um card de negociação pro Alex, escavadeira E215&quot;</li>
                  <li>• &quot;Marca demanda: pegar peça de transferência pro Alexandre&quot;</li>
                  <li>• &quot;Marca o Edy como interesse futuro, aguardando o Plano Safra&quot;</li>
                </ul>
              </div>
            )}

            {fase === "interpretando" && (
              <div className="flex items-center gap-2 text-sm text-slate-300"><Loader2 size={16} className="animate-spin" /> Entendendo seu comando…</div>
            )}

            {(fase === "confirmando" || fase === "executando" || (fase === "idle" && resposta)) && (
              <div className="space-y-3">
                {resposta && <p className="text-sm text-slate-200">🤖 {resposta}</p>}
                {fase !== "idle" && plano.length === 0 ? (
                  <p className="text-sm text-amber-300">Não identifiquei nenhuma ação. Tente reformular.</p>
                ) : (
                  <ul className="space-y-2">
                    {plano.map((a, i) => (
                      <li
                        key={i}
                        className={cn(
                          "flex items-start gap-2 rounded-xl px-3 py-2 text-xs",
                          a.erro ? "bg-red-500/10 text-red-300" : "bg-slate-800 text-slate-200"
                        )}
                      >
                        <span className="mt-0.5 shrink-0 text-agro-400">
                          {a.erro ? <AlertTriangle size={14} className="text-red-400" /> : ICONE_ACAO[a.tipo]}
                        </span>
                        <span>{a.descricao}{a.erro ? ` — ${a.erro}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {temErro && validas.length > 0 && (
                  <p className="text-[11px] text-amber-300">As ações com ⚠️ serão ignoradas.</p>
                )}
              </div>
            )}

            {fase === "feito" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl bg-green-500/10 px-3 py-2.5 text-sm font-semibold text-green-300">
                  <Check size={16} /> {feedback}
                </div>
                <button onClick={reset} className="text-xs font-semibold text-blue-300 hover:underline">Novo comando</button>
              </div>
            )}
          </div>

          {/* Rodapé / ações */}
          {(fase === "confirmando") && plano.length > 0 && (
            <div className="flex gap-2 border-t border-slate-700 p-3">
              <button onClick={reset} className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={validas.length === 0}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
                style={{ background: "#BFDE4D" }}
              >
                <Check size={15} /> Confirmar
              </button>
            </div>
          )}

          {fase === "executando" && (
            <div className="flex items-center justify-center gap-2 border-t border-slate-700 p-3 text-sm text-slate-300">
              <Loader2 size={16} className="animate-spin" /> Executando…
            </div>
          )}

          {(fase === "idle" || fase === "interpretando") && (
            <div className="border-t border-slate-700 p-3">
              {feedback && fase === "idle" && <p className="mb-2 text-xs text-amber-300">{feedback}</p>}
              <div className="flex items-end gap-2 rounded-xl px-2 py-1.5" style={{ background: "#09090b" }}>
                <button
                  onClick={toggleVoz}
                  title="Ditar por voz"
                  className={cn("shrink-0 rounded-lg p-1.5", ouvindo ? "bg-red-500/20 text-red-400" : "text-slate-400 hover:text-white")}
                >
                  {ouvindo ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <textarea
                  ref={inputRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); interpretar(); } }}
                  rows={1}
                  placeholder={ouvindo ? "Ouvindo… pode falar" : "Digite ou fale um comando…"}
                  disabled={fase === "interpretando"}
                  className="max-h-24 flex-1 resize-none bg-transparent py-1 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <button
                  onClick={interpretar}
                  disabled={!texto.trim() || fase === "interpretando"}
                  className="shrink-0 rounded-lg p-1.5 text-agro-400 hover:bg-white/10 disabled:opacity-40"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
