"use client";

import { useEffect, useState } from "react";
import { ExcavatorIcon } from "@/components/icons";

const FASES = ["INICIALIZANDO", "CARREGANDO DADOS", "SINCRONIZANDO", "PREPARANDO PAINEL", "PRONTO"];
const R = 70;
const CIRC = 2 * Math.PI * R;

// Splash de inicialização: emblema da escavadeira dentro de um anel de progresso.
export function SplashIA({ saindo = false }: { saindo?: boolean }) {
  const [pct, setPct] = useState(0);
  const [fase, setFase] = useState(0);

  useEffect(() => {
    const ip = setInterval(() => {
      setPct((p) => (p >= 100 ? 100 : Math.min(100, p + Math.max(1, Math.round((100 - p) / 12)))));
    }, 70);
    return () => clearInterval(ip);
  }, []);

  useEffect(() => {
    setFase(Math.min(FASES.length - 1, Math.floor((pct / 100) * (FASES.length - 1))));
  }, [pct]);

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden bg-[#050506]"
      style={{ animation: saindo ? "splOut .45s ease-in forwards" : "splFade .5s ease-out both" }}
    >
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(26,99,245,0.10), transparent 55%)" }} />
      <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 240px 60px rgba(0,0,0,0.9)" }} />

      <div className="relative flex h-[200px] w-[200px] items-center justify-center">
        {/* Sheen cônico rotativo */}
        <div
          className="absolute h-[176px] w-[176px] rounded-full opacity-60"
          style={{
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(191,222,77,0.18) 40deg, transparent 120deg, transparent 360deg)",
            filter: "blur(10px)",
            animation: "splGirar 6s linear infinite",
          }}
        />

        {/* Anel de progresso */}
        <svg width="200" height="200" viewBox="0 0 160 160" className="absolute -rotate-90">
          <defs>
            <linearGradient id="splGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#BFDE4D" />
              <stop offset="1" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
          <circle
            cx="80" cy="80" r={R} fill="none" stroke="url(#splGrad)" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - pct / 100)}
            style={{ transition: "stroke-dashoffset .25s cubic-bezier(.4,0,.2,1)", filter: "drop-shadow(0 0 5px rgba(191,222,77,0.55))" }}
          />
        </svg>

        {/* Disco interno + emblema + shimmer */}
        <div className="relative flex h-[112px] w-[112px] items-center justify-center overflow-hidden rounded-full" style={{ background: "radial-gradient(circle at 50% 35%, #14161b, #08090b)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <ExcavatorIcon size={58} className="text-agro-400" />
          <div className="pointer-events-none absolute inset-0" style={{ filter: "drop-shadow(0 0 14px rgba(191,222,77,0.35))" }} />
          <div
            className="pointer-events-none absolute top-0 h-full w-1/2"
            style={{ background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.16), transparent)", animation: "splShimmer 2.8s ease-in-out infinite" }}
          />
        </div>
      </div>

      <div className="relative mt-9 text-center">
        <div className="text-[15px] font-semibold tracking-[0.42em] text-white">CRM DO EDY</div>
        <div className="mt-1.5 text-[9px] font-medium tracking-[0.45em] text-zinc-600">INTELIGÊNCIA DE VENDAS</div>
      </div>

      <div className="relative mt-7 flex items-center gap-3 font-mono text-[10px] tracking-[0.25em] text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-agro-400" style={{ animation: "splBlink 1.2s ease-in-out infinite", boxShadow: "0 0 6px rgba(191,222,77,0.8)" }} />
        <span className="min-w-[150px] text-left text-zinc-400">{FASES[fase]}</span>
        <span className="tabular-nums text-zinc-300">{String(pct).padStart(3, "0")}%</span>
      </div>

      <style>{`
        @keyframes splFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes splOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes splGirar { to { transform: rotate(360deg) } }
        @keyframes splShimmer { 0% { transform: translateX(-180%) } 60%,100% { transform: translateX(380%) } }
        @keyframes splBlink { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
      `}</style>
    </div>
  );
}
