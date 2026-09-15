"use client";

import { useEffect, useState } from "react";
import { LogoEscavadeira } from "@/components/icons";

const FASES = ["Iniciando", "Carregando seus dados", "Preparando o painel", "Pronto"];
const DURACAO_BARRA_MS = 1900;

// Tela de abertura do CRM: emblema da marca (escavadeira em amarelo New
// Holland), nome do sistema e uma barra de progresso discreta. Sóbria e
// rápida — some sozinha (ver SplashBoot).
export function SplashIA({ saindo = false }: { saindo?: boolean }) {
  const [fase, setFase] = useState(0);

  useEffect(() => {
    const passo = DURACAO_BARRA_MS / (FASES.length - 1);
    const ids = FASES.slice(1).map((_, i) => setTimeout(() => setFase(i + 1), Math.round(passo * (i + 1))));
    return () => ids.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #161b23 0%, #0f1319 55%, #0a0d12 100%)",
        animation: saindo ? "splOut .4s ease-in forwards" : "splFade .35s ease-out both",
      }}
      aria-hidden="true"
    >
      {/* Brilho suave da marca atrás do emblema */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,184,28,0.10) 0%, rgba(255,184,28,0.03) 40%, transparent 70%)" }} />
      {/* Linhas finas de fundo (textura discreta) */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative flex flex-col items-center" style={{ animation: "splSubir .6s cubic-bezier(.2,.8,.2,1) both" }}>
        <div
          className="flex h-[124px] w-[124px] items-center justify-center overflow-hidden rounded-[30px] bg-white"
          style={{ boxShadow: "0 24px 60px rgba(255,184,28,0.28), 0 0 0 1px rgba(255,255,255,0.08)" }}
        >
          <LogoEscavadeira size={124} recorte={false} />
        </div>
        <div className="mt-7 text-center">
          <div className="text-[24px] font-black tracking-tight text-white">CRM DO EDY</div>
          <div className="mt-1.5 text-[10px] font-semibold tracking-[0.32em] text-agro-400">NEW HOLLAND CONSTRUCTION · DYNAPAC</div>
        </div>
      </div>

      <div className="relative mt-10 flex flex-col items-center" style={{ animation: "splSubir .6s .15s cubic-bezier(.2,.8,.2,1) both" }}>
        <div className="h-[3px] w-[220px] overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-agro-400" style={{ animation: `splBarra ${DURACAO_BARRA_MS}ms cubic-bezier(.3,.1,.2,1) forwards`, boxShadow: "0 0 10px rgba(255,203,45,0.6)" }} />
        </div>
        <div className="mt-3 h-4 text-[11px] font-medium tracking-wide text-slate-400">{FASES[fase]}…</div>
      </div>

      <div className="absolute bottom-7 text-[10px] font-medium tracking-[0.25em] text-slate-600">INTELIGÊNCIA DE VENDAS</div>

      <style>{`
        @keyframes splFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes splOut { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(1.02) } }
        @keyframes splSubir { from { opacity: 0; transform: translateY(14px) scale(.96) } to { opacity: 1; transform: none } }
        @keyframes splBarra { from { width: 0 } 70% { width: 82% } to { width: 100% } }
      `}</style>
    </div>
  );
}
