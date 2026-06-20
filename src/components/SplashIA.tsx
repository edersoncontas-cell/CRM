"use client";

import { useEffect, useMemo, useState } from "react";

const FASES = ["INICIALIZANDO NÚCLEO", "CALIBRANDO SISTEMAS", "SINCRONIZANDO DADOS", "OTIMIZANDO IA", "ONLINE"];
const GLYPHS = "ACEFHKMNPRTXZ0123456789#@$%&*<>{}[]/=+".split("");

function colunaGlyphs(n: number) {
  return Array.from({ length: n }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join(" ");
}

const GRAIN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

// Splash de inicialização cinematográfico: robô 3D real + HUD sci-fi orquestrado.
export function SplashIA({ saindo = false }: { saindo?: boolean }) {
  const [pct, setPct] = useState(0);
  const [fase, setFase] = useState(0);
  const streams = useMemo(() => [colunaGlyphs(60), colunaGlyphs(60)], []);

  useEffect(() => {
    const ip = setInterval(() => setPct((p) => (p >= 100 ? 100 : Math.min(100, p + Math.max(1, Math.round((100 - p) / 20))))), 80);
    return () => clearInterval(ip);
  }, []);
  useEffect(() => { setFase(Math.min(FASES.length - 1, Math.floor((pct / 100) * (FASES.length - 1)))); }, [pct]);

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden bg-[#04050a]" style={{ animation: saindo ? "spO .55s ease-in forwards" : "spI .5s ease-out both" }}>
      {/* ── Robô 3D real (ken burns) ── */}
      <div className="absolute inset-0" style={{ animation: "spZoom 8s ease-out both" }}>
        <div className="absolute inset-0" style={{ backgroundImage: "url(/robo-splash-run.jpg)", backgroundSize: "cover", backgroundPosition: "50% 14%", animation: "spImg 1.4s ease-out both" }} />
      </div>

      {/* ── Color grade cinematográfico ── */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(125% 88% at 50% 26%, transparent 26%, rgba(4,5,10,0.5) 62%, rgba(4,5,10,0.97))" }} />
      <div className="absolute inset-x-0 top-0 h-44" style={{ background: "linear-gradient(to bottom, rgba(4,5,10,0.92), transparent)" }} />
      <div className="absolute inset-x-0 bottom-0 h-[48%]" style={{ background: "linear-gradient(to top, #04050a 6%, rgba(4,5,10,0.62) 46%, transparent)" }} />
      <div className="absolute inset-0 opacity-50 mix-blend-screen" style={{ background: "radial-gradient(58% 36% at 50% 19%, rgba(56,189,248,0.30), transparent 60%)", animation: "spAmb 3.4s ease-in-out infinite" }} />
      {/* grain de filme */}
      <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay" style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: "180px", animation: "spGrain .6s steps(3) infinite" }} />

      {/* ── Power-on: linha de luz inicial ── */}
      <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-cyan-300" style={{ boxShadow: "0 0 24px 4px rgba(56,189,248,0.9)", animation: "spPower 1.1s ease-out both" }} />

      {/* ── Fluxos de dados nas laterais ── */}
      {[6, 94].map((x, i) => (
        <div key={x} className="absolute top-0 h-full w-10 overflow-hidden opacity-30" style={{ left: `${x}%`, transform: "translateX(-50%)", maskImage: "linear-gradient(transparent, #000 20%, #000 80%, transparent)", WebkitMaskImage: "linear-gradient(transparent, #000 20%, #000 80%, transparent)" }}>
          <div className="whitespace-pre-wrap break-all text-center font-mono text-[10px] leading-5 tracking-widest text-cyan-300/80" style={{ animation: `spStream ${7 + i * 2}s linear infinite` }}>
            {streams[i]}{"\n"}{streams[i]}
          </div>
        </div>
      ))}

      {/* ── HUD: cantos ── */}
      <HudCantos />

      {/* ── Reticula sobre o núcleo do robô ── */}
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2 -translate-y-1/2" style={{ animation: "spRet 1s ease-out .6s both" }}>
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 rounded-full border border-cyan-300/40" style={{ animation: "spGir 7s linear infinite" }} />
          <div className="absolute inset-2 rounded-full border border-dashed border-cyan-300/30" style={{ animation: "spGir 5s linear infinite reverse" }} />
          <div className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-cyan-300/70" />
          <div className="absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 bg-cyan-300/70" />
          <div className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-cyan-300/70" />
          <div className="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 bg-cyan-300/70" />
        </div>
      </div>

      {/* ── Linha de scan ── */}
      <div className="absolute inset-x-0 h-32 opacity-60" style={{ background: "linear-gradient(to bottom, transparent, rgba(56,189,248,0.12), transparent)", animation: "spScan 3.4s linear infinite" }} />

      {/* ── Marca + status + progresso ── */}
      <div className="absolute inset-x-0 bottom-[9%] flex flex-col items-center px-6" style={{ animation: "spUI .8s ease-out .9s both" }}>
        <div className="text-[17px] font-semibold tracking-[0.44em] text-white" style={{ textShadow: "0 2px 16px rgba(0,0,0,0.85)" }}>CRM DO EDY</div>
        <div className="mt-1.5 text-[9px] font-medium tracking-[0.5em] text-cyan-200/70">INTELIGÊNCIA DE VENDAS</div>

        <div className="mt-5 flex items-center gap-3 font-mono text-[10px] tracking-[0.25em] text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" style={{ animation: "spBl 1.2s ease-in-out infinite", boxShadow: "0 0 7px rgba(56,189,248,0.95)" }} />
          <span className="min-w-[178px] text-left">{FASES[fase]}</span>
          <span className="tabular-nums text-cyan-300">{String(pct).padStart(3, "0")}%</span>
        </div>

        <div className="relative mt-3 h-[3px] w-64 max-w-[82vw] overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-agro-400 transition-all duration-200" style={{ width: `${pct}%`, boxShadow: "0 0 14px rgba(56,189,248,0.85)" }} />
        </div>
      </div>

      <style>{`
        @keyframes spI { from{opacity:0} to{opacity:1} }
        @keyframes spO { from{opacity:1} to{opacity:0} }
        @keyframes spImg { from{ opacity:0; filter: brightness(.2) contrast(1.4) } to{ opacity:1; filter:none } }
        @keyframes spZoom { from{ transform: scale(1.14) } to{ transform: scale(1) } }
        @keyframes spPower { 0%{ transform: scaleX(0); opacity:1 } 55%{ transform: scaleX(1); opacity:1 } 100%{ transform: scaleX(1); opacity:0 } }
        @keyframes spAmb { 0%,100%{ opacity:.4 } 50%{ opacity:.62 } }
        @keyframes spGrain { to { transform: translate(8px,-6px) } }
        @keyframes spStream { from{ transform: translateY(0) } to{ transform: translateY(-50%) } }
        @keyframes spGir { to { transform: rotate(360deg) } }
        @keyframes spRet { from{ opacity:0; transform: translate(-50%,-50%) scale(.6) } to{ opacity:1; transform: translate(-50%,-50%) scale(1) } }
        @keyframes spScan { 0%{ top:-14% } 100%{ top:114% } }
        @keyframes spUI { from{ opacity:0; transform: translateY(12px) } to{ opacity:1; transform:none } }
        @keyframes spBl { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
    </div>
  );
}

function HudCantos() {
  const base = "absolute h-9 w-9 border-cyan-300/50";
  return (
    <div className="pointer-events-none absolute inset-5 sm:inset-8" style={{ animation: "spUI .7s ease-out .5s both" }}>
      <div className={`${base} left-0 top-0 border-l-2 border-t-2`} />
      <div className={`${base} right-0 top-0 border-r-2 border-t-2`} />
      <div className={`${base} bottom-0 left-0 border-b-2 border-l-2`} />
      <div className={`${base} bottom-0 right-0 border-b-2 border-r-2`} />
      <div className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-cyan-300/40" />
      <div className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-cyan-300/40" />
    </div>
  );
}
