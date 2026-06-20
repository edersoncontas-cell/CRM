"use client";

import { useEffect, useMemo, useState } from "react";

const FASES = ["INICIALIZANDO", "REUNINDO ENERGIA", "SINCRONIZANDO", "CARREGANDO PODER", "PRONTO"];
const GLYPHS = "ACEFHKMNPRTXZ0123456789#@$%&*<>{}[]/=+".split("");

// Splash cinematográfico: mech-escavadeira erguendo uma esfera de energia (Genki
// Dama) que cresce, com partículas e caracteres sendo absorvidos como "poder".
export function SplashIA({ saindo = false }: { saindo?: boolean }) {
  const [pct, setPct] = useState(0);
  const [fase, setFase] = useState(0);

  useEffect(() => {
    const ip = setInterval(() => {
      setPct((p) => (p >= 100 ? 100 : Math.min(100, p + Math.max(1, Math.round((100 - p) / 16)))));
    }, 80);
    return () => clearInterval(ip);
  }, []);
  useEffect(() => { setFase(Math.min(FASES.length - 1, Math.floor((pct / 100) * (FASES.length - 1)))); }, [pct]);

  // Partículas e glyphs que convergem para a esfera (de fora para o centro).
  const particulas = useMemo(
    () => Array.from({ length: 30 }, (_, i) => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 160;
      return {
        id: i,
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist,
        delay: Math.random() * 2.6,
        dur: 1.6 + Math.random() * 1.6,
        size: 2 + Math.random() * 3,
      };
    }),
    []
  );
  const glifos = useMemo(
    () => Array.from({ length: 22 }, (_, i) => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 130 + Math.random() * 180;
      return {
        id: i,
        ch: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist,
        delay: Math.random() * 3,
        dur: 2 + Math.random() * 1.8,
        size: 11 + Math.random() * 12,
      };
    }),
    []
  );

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-[#04050a]"
      style={{ animation: saindo ? "spO .5s ease-in forwards" : "spI .5s ease-out both" }}
    >
      {/* Brilho ambiente atrás da esfera */}
      <div className="absolute left-1/2 top-[34%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(56,189,248,0.16), rgba(26,99,245,0.07) 40%, transparent 70%)", animation: "spAmb 3s ease-in-out infinite" }} />
      {/* Raios de energia */}
      <div className="absolute left-1/2 top-[34%] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 opacity-40"
        style={{ background: "conic-gradient(from 0deg, transparent, rgba(191,222,77,0.10), transparent 30%, transparent 50%, rgba(56,189,248,0.10), transparent 80%)", animation: "spGir 10s linear infinite", maskImage: "radial-gradient(circle, transparent 26%, #000 30%, transparent 70%)", WebkitMaskImage: "radial-gradient(circle, transparent 26%, #000 30%, transparent 70%)" }} />

      {/* Palco: mech + esfera, alinhados ao centro da tela */}
      <div className="relative" style={{ width: 320, height: 460, marginTop: "-2vh" }}>

        {/* Convergência: partículas */}
        <div className="absolute" style={{ left: 160, top: 104 }}>
          {particulas.map((p) => (
            <span key={p.id} className="absolute rounded-full bg-cyan-200"
              style={{ width: p.size, height: p.size, boxShadow: "0 0 6px rgba(125,211,252,0.9)",
                ["--x" as string]: `${p.x}px`, ["--y" as string]: `${p.y}px`,
                animation: `spConv ${p.dur}s ease-in ${p.delay}s infinite` } as React.CSSProperties} />
          ))}
          {glifos.map((g) => (
            <span key={`g${g.id}`} className="absolute font-mono font-bold text-agro-300"
              style={{ fontSize: g.size,
                ["--x" as string]: `${g.x}px`, ["--y" as string]: `${g.y}px`,
                animation: `spConvG ${g.dur}s ease-in ${g.delay}s infinite` } as React.CSSProperties}>{g.ch}</span>
          ))}
        </div>

        {/* Esfera de energia (cresce) */}
        <div className="absolute" style={{ left: 160, top: 104, transform: "translate(-50%,-50%)" }}>
          <div className="relative" style={{ animation: "spCresce 2.6s cubic-bezier(.2,.7,.2,1) both" }}>
            <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(125,211,252,0.5), rgba(26,99,245,0.2) 45%, transparent 70%)", filter: "blur(8px)", animation: "spPulse 1.8s ease-in-out infinite" }} />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: "radial-gradient(circle at 42% 38%, #ffffff, #bae6fd 30%, #38bdf8 55%, #1a63f5 80%)", boxShadow: "0 0 50px rgba(56,189,248,0.9), inset 0 0 24px rgba(255,255,255,0.6)", animation: "spPulse 1.8s ease-in-out infinite" }} />
            <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/40"
              style={{ animation: "spGir 4s linear infinite" }} />
            {/* faíscas orbitando */}
            {[0, 72, 144, 216, 288].map((a) => (
              <span key={a} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-white"
                style={{ transform: `rotate(${a}deg) translateX(58px)`, boxShadow: "0 0 8px #fff", animation: "spFa 1.6s ease-in-out infinite" }} />
            ))}
          </div>
        </div>

        {/* Mech-escavadeira em silhueta (braços erguidos) */}
        <svg width="320" height="460" viewBox="0 0 320 460" className="absolute inset-0" fill="none">
          <defs>
            <linearGradient id="mtl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2b3a4d" />
              <stop offset="0.5" stopColor="#141b26" />
              <stop offset="1" stopColor="#090d14" />
            </linearGradient>
            <linearGradient id="mtl2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a4d63" />
              <stop offset="1" stopColor="#10161f" />
            </linearGradient>
          </defs>
          <g stroke="#0a0e15" strokeWidth="1.5">
            <ellipse cx="160" cy="430" rx="78" ry="12" fill="#000" opacity="0.5" stroke="none" />
          </g>
          {/* base (sombra) */}

          {/* Pernas */}
          <g stroke="#0a0e15" strokeWidth="1.5">
            <path d="M138 300 l-8 60 -4 40 26 0 4 -44 0 -56 z" fill="url(#mtl)" />
            <path d="M182 300 l8 60 4 40 -26 0 -4 -44 0 -56 z" fill="url(#mtl)" />
            {/* esteiras (pés) */}
            <rect x="112" y="398" width="46" height="24" rx="9" fill="url(#mtl2)" />
            <rect x="162" y="398" width="46" height="24" rx="9" fill="url(#mtl2)" />
            <line x1="118" y1="410" x2="152" y2="410" stroke="#38bdf8" strokeWidth="1.5" opacity="0.5" />
            <line x1="168" y1="410" x2="202" y2="410" stroke="#38bdf8" strokeWidth="1.5" opacity="0.5" />
          </g>

          {/* Quadril */}
          <path d="M134 286 l52 0 6 22 -64 0 z" fill="url(#mtl2)" stroke="#0a0e15" strokeWidth="1.5" />

          {/* Tronco */}
          <path d="M120 214 l80 0 -6 76 -68 0 z" fill="url(#mtl)" stroke="#0a0e15" strokeWidth="1.5" />
          <path d="M120 214 l80 0 -3 22 -74 0 z" fill="url(#mtl2)" opacity="0.7" />
          {/* núcleo do peito */}
          <circle cx="160" cy="250" r="13" fill="#06121c" stroke="#0a0e15" strokeWidth="2" />
          <circle cx="160" cy="250" r="8" fill="#38bdf8" style={{ filter: "drop-shadow(0 0 8px #38bdf8)" }}>
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1.6s" repeatCount="indefinite" />
          </circle>
          {/* detalhe escavadeira (cilindros hidráulicos) */}
          <line x1="138" y1="268" x2="146" y2="284" stroke="#BFDE4D" strokeWidth="2" opacity="0.55" />
          <line x1="182" y1="268" x2="174" y2="284" stroke="#BFDE4D" strokeWidth="2" opacity="0.55" />

          {/* Ombros (pauldrons) */}
          <path d="M104 210 q-22 4 -22 26 q22 8 38 -2 z" fill="url(#mtl2)" stroke="#0a0e15" strokeWidth="1.5" />
          <path d="M216 210 q22 4 22 26 q-22 8 -38 -2 z" fill="url(#mtl2)" stroke="#0a0e15" strokeWidth="1.5" />

          {/* Braços erguidos (segmentados) até as mãos perto da esfera */}
          <g fill="url(#mtl)" stroke="#0a0e15" strokeWidth="1.5">
            {/* esquerdo */}
            <path d="M92 216 l-18 -40 14 -8 22 36 z" />
            <path d="M88 168 l-12 -52 16 -4 16 50 z" />
            {/* direito */}
            <path d="M228 216 l18 -40 -14 -8 -22 36 z" />
            <path d="M232 168 l12 -52 -16 -4 -16 50 z" />
          </g>
          {/* highlight nos braços (luz da esfera) */}
          <path d="M88 168 l-12 -52" stroke="#7dd3fc" strokeWidth="2" opacity="0.5" />
          <path d="M232 168 l12 -52" stroke="#7dd3fc" strokeWidth="2" opacity="0.5" />
          {/* mãos/garras */}
          <circle cx="138" cy="116" r="9" fill="url(#mtl2)" stroke="#0a0e15" strokeWidth="1.5" />
          <circle cx="182" cy="116" r="9" fill="url(#mtl2)" stroke="#0a0e15" strokeWidth="1.5" />

          {/* Pescoço + Cabeça */}
          <rect x="150" y="196" width="20" height="14" fill="url(#mtl2)" />
          <path d="M142 196 l36 0 4 -22 -8 -16 -28 0 -8 16 z" fill="url(#mtl)" stroke="#0a0e15" strokeWidth="1.5" />
          {/* visor */}
          <rect x="148" y="168" width="24" height="7" rx="2" fill="#BFDE4D" style={{ filter: "drop-shadow(0 0 6px #BFDE4D)" }}>
            <animate attributeName="opacity" values="0.7;1;0.7" dur="1.1s" repeatCount="indefinite" />
          </rect>
          {/* rim light no topo da cabeça/ombros (luz da esfera) */}
          <path d="M142 174 l8 -16 28 0 8 16" stroke="#bae6fd" strokeWidth="1.5" opacity="0.5" fill="none" />
          <path d="M104 210 q-22 4 -22 26" stroke="#7dd3fc" strokeWidth="1.5" opacity="0.35" fill="none" />
          <path d="M216 210 q22 4 22 26" stroke="#7dd3fc" strokeWidth="1.5" opacity="0.35" fill="none" />
        </svg>
      </div>

      {/* Marca + status */}
      <div className="absolute bottom-[12%] flex flex-col items-center">
        <div className="text-[15px] font-semibold tracking-[0.42em] text-white">CRM DO EDY</div>
        <div className="mt-1.5 text-[9px] font-medium tracking-[0.45em] text-zinc-600">INTELIGÊNCIA DE VENDAS</div>
        <div className="mt-5 flex items-center gap-3 font-mono text-[10px] tracking-[0.25em] text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full bg-agro-400" style={{ animation: "spBl 1.2s ease-in-out infinite", boxShadow: "0 0 6px rgba(191,222,77,0.8)" }} />
          <span className="min-w-[150px] text-left text-zinc-400">{FASES[fase]}</span>
          <span className="tabular-nums text-cyan-300">{String(pct).padStart(3, "0")}%</span>
        </div>
      </div>

      <style>{`
        @keyframes spI { from{opacity:0} to{opacity:1} }
        @keyframes spO { from{opacity:1} to{opacity:0; transform:scale(1.04)} }
        @keyframes spGir { to { transform: rotate(360deg) } }
        @keyframes spAmb { 0%,100%{ transform:translate(-50%,-50%) scale(.9); opacity:.8 } 50%{ transform:translate(-50%,-50%) scale(1.1); opacity:1 } }
        @keyframes spPulse { 0%,100%{ transform:translate(-50%,-50%) scale(.92) } 50%{ transform:translate(-50%,-50%) scale(1.08) } }
        @keyframes spCresce { 0%{ transform:scale(.2); opacity:0 } 35%{ opacity:1 } 100%{ transform:scale(1) } }
        @keyframes spFa { 0%,100%{ opacity:.4 } 50%{ opacity:1 } }
        @keyframes spBl { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes spConv {
          0%{ transform: translate(var(--x), var(--y)) scale(1); opacity:0 }
          20%{ opacity:.9 }
          100%{ transform: translate(0,0) scale(.3); opacity:0 }
        }
        @keyframes spConvG {
          0%{ transform: translate(var(--x), var(--y)) scale(1); opacity:0 }
          25%{ opacity:.35 }
          100%{ transform: translate(0,0) scale(.4); opacity:0 }
        }
      `}</style>
    </div>
  );
}
