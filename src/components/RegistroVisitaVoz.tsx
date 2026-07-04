"use client";

import { useState, useTransition } from "react";
import { registrarVisitaPorVoz } from "@/lib/actions";
import { useDitadoVoz } from "@/lib/useDitadoVoz";
import { Mic, MicOff, Loader2, CheckCircle2, Sparkles } from "lucide-react";

// Modo Campo por voz (Fase 5, item 5): o vendedor relata em voz alta o que
// aconteceu numa visita ("visitei o João, quer trocar a retro, orcei 480
// mil") e a IA atualiza resumo, negociação e agenda o follow-up — sem
// formulário nenhum. Reusa o mesmo hook de ditado do Assistente IA.
export function RegistroVisitaVoz({ clienteId }: { clienteId: string }) {
  const [texto, setTexto] = useState("");
  const [processando, startProcessar] = useTransition();
  const [resultado, setResultado] = useState<{ resumo?: string; followUp?: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { ouvindo, alternar } = useDitadoVoz((t) => setTexto((prev) => (prev ? prev + " " : "") + t));

  function processar() {
    const t = texto.trim();
    if (!t) return;
    setErro(null);
    setResultado(null);
    startProcessar(async () => {
      try {
        const r = await registrarVisitaPorVoz(clienteId, t);
        if (r.ok) {
          setResultado({ resumo: r.resumo, followUp: r.followUp });
          setTexto("");
        } else {
          setErro(r.erro ?? "Erro ao processar o relato.");
        }
      } catch (e) {
        setErro("Erro inesperado ao processar o relato da visita.");
        console.error("[RegistroVisitaVoz] processar error:", e);
      }
    });
  }

  return (
    <div className="rounded-2xl shadow-sm p-5" style={{ background: "#18181b", border: "1px solid #27272a" }}>
      <div className="mb-2 flex items-center gap-2">
        <Mic size={16} style={{ color: "#BFDE4D" }} />
        <h2 className="font-semibold text-zinc-100">Modo Campo — Registrar visita por voz</h2>
      </div>
      <p className="mb-3 text-xs text-zinc-500">
        Fale o que aconteceu na visita (ex: &quot;visitei o João, quer trocar a retro, orcei 480 mil&quot;) — a IA
        atualiza o resumo, a negociação e agenda o follow-up.
      </p>

      <div className="flex items-start gap-2">
        <button
          onClick={alternar}
          title="Ditar por voz"
          className={`shrink-0 rounded-xl p-2.5 ${ouvindo ? "bg-red-500/20 text-red-400" : "bg-zinc-800 text-zinc-300 hover:text-white"}`}
        >
          {ouvindo ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder={ouvindo ? "Ouvindo… pode falar" : "Toque no microfone e fale, ou digite aqui"}
          className="flex-1 resize-none rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
          style={{ background: "#09090b", border: "1px solid #27272a" }}
        />
      </div>

      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}

      {resultado && (
        <div className="mt-3 rounded-xl px-3 py-2.5 text-xs" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <div className="flex items-center gap-1.5 font-semibold text-green-300">
            <CheckCircle2 size={13} /> Visita registrada
          </div>
          {resultado.resumo && <p className="mt-1 text-zinc-300">{resultado.resumo}</p>}
          {resultado.followUp && <p className="mt-1 text-zinc-400">Follow-up agendado: {resultado.followUp}</p>}
        </div>
      )}

      <button
        onClick={processar}
        disabled={!texto.trim() || processando}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        style={{ background: processando ? "#666" : "#BFDE4D", color: "#111" }}
      >
        {processando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {processando ? "Processando…" : "Processar com IA"}
      </button>
    </div>
  );
}
