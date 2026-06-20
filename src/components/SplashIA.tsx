"use client";

import { useEffect, useState } from "react";

const FASES = ["INICIALIZANDO", "ATIVANDO NÚCLEO", "SINCRONIZANDO", "CARREGANDO SISTEMAS", "PRONTO"];

// Splash com o robô 3D real (imagem), tratado de forma cinematográfica.
export function SplashIA({ saindo = false }: { saindo?: boolean }) {
  const [pct, setPct] = useState(0);
  const [fase, setFase] = useState(0);

  useEffect(() => {
    const ip = setInterval(() => setPct((p) => (p >= 100 ? 100 : Math.min(100, p + Math.max(1, Math.round((100 - p) / 18))))), 80);
    return () => clearInterval(ip);
  }, []);
  useEffect(() => { setFase(Math.min(FASES.length - 1, Math.floor((pct / 100) * (FASES.length - 1)))); }, [pct]);

  return (
    <div
      className="fixed inset-0 z-[120] overflow-hidden bg-[#04050a]"
      style={{ animation: saindo ? "spO .5s ease-in forwards" : "spI .55s ease-out both" }}
    >
      {/* Robô (imagem real) com zoom lento (ken burns) */}
      <div className="absolute inset-0" style={{ animation: "spZoom 7s ease-out both" }}>
        <div
          className="absolute inset-0"
          style={{ backgroundImage: "url(/robo-splash-run.jpg)", backgroundSize: "cover", backgroundPosition: "50% 16%" }}
        />
      </div>

      {/* Escurecimento / vinheta para integrar ao preto */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(125% 85% at 50% 28%, transparent 28%, rgba(4,5,10,0.5) 64%, rgba(4,5,10,0.96))" }} />
      <div className="absolute inset-x-0 top-0 h-40" style={{ background: "linear-gradient(to bottom, rgba(4,5,10,0.92), transparent)" }} />
      <div className="absolute inset-x-0 bottom-0 h-[46%]" style={{ background: "linear-gradient(to top, #04050a 8%, rgba(4,5,10,0.65) 45%, transparent)" }} />

      {/* Glow azul de palco */}
      <div className="absolute inset-0 opacity-50 mix-blend-screen" style={{ background: "radial-gradient(60% 38% at 50% 20%, rgba(56,189,248,0.28), transparent 60%)", animation: "spAmb 3.4s ease-in-out infinite" }} />

      {/* Linha de scan */}
      <div className="absolute inset-x-0 h-28 opacity-70" style={{ background: "linear-gradient(to bottom, transparent, rgba(56,189,248,0.12), transparent)", animation: "spScan 3.2s linear infinite" }} />

      {/* Grade tênue */}
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.8) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      {/* Marca + status + progresso */}
      <div className="absolute inset-x-0 bottom-[10%] flex flex-col items-center px-6">
        <div className="text-[16px] font-semibold tracking-[0.42em] text-white" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>CRM DO EDY</div>
        <div className="mt-1.5 text-[9px] font-medium tracking-[0.45em] text-cyan-200/70">INTELIGÊNCIA DE VENDAS</div>

        <div className="mt-5 flex items-center gap-3 font-mono text-[10px] tracking-[0.25em] text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" style={{ animation: "spBl 1.2s ease-in-out infinite", boxShadow: "0 0 6px rgba(56,189,248,0.9)" }} />
          <span className="min-w-[160px] text-left">{FASES[fase]}</span>
          <span className="tabular-nums text-cyan-300">{String(pct).padStart(3, "0")}%</span>
        </div>

        <div className="mt-3 h-1 w-60 max-w-[80vw] overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-agro-400 transition-all duration-200" style={{ width: `${pct}%`, boxShadow: "0 0 12px rgba(56,189,248,0.8)" }} />
        </div>
      </div>

      <style>{`
        @keyframes spI { from{opacity:0} to{opacity:1} }
        @keyframes spO { from{opacity:1} to{opacity:0} }
        @keyframes spZoom { from{ transform: scale(1.12) } to{ transform: scale(1) } }
        @keyframes spAmb { 0%,100%{ opacity:.4 } 50%{ opacity:.6 } }
        @keyframes spScan { 0%{ top:-12% } 100%{ top:112% } }
        @keyframes spBl { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
    </div>
  );
}
