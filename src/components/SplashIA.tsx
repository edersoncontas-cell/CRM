"use client";

import { useEffect, useMemo, useState } from "react";

const FASES = ["INICIALIZANDO", "ATIVANDO NÚCLEO", "SINCRONIZANDO", "CARREGANDO SISTEMAS", "PRONTO"];

// Robô estilo "Mythos" (corpo preto glossy, olhos azuis) com detalhes de
// escavadeira (pistões hidráulicos amarelos, esteiras, caçamba). Pose heroica.
function RoboMythos() {
  // Membros esquerdos (espelhados para o lado direito).
  const Braco = (
    <g stroke="#05070b" strokeWidth="1.4" strokeLinejoin="round">
      {/* pauldron / ombro */}
      <path d="M80 94 C58 90 42 100 42 122 C56 134 78 128 84 114 Z" fill="url(#hiMet)" />
      <path d="M80 100 C64 98 52 106 52 120 C64 126 78 122 82 112 Z" fill="url(#mdMet)" />
      {/* braço superior */}
      <path d="M56 120 L46 170 L66 174 L76 122 Z" fill="url(#dkMet)" />
      {/* cotovelo */}
      <circle cx="56" cy="172" r="8" fill="url(#mdMet)" />
      <circle cx="56" cy="172" r="3" fill="#38bdf8" opacity="0.8" />
      {/* antebraço */}
      <path d="M50 178 L45 224 L67 227 L70 180 Z" fill="url(#dkMet)" />
      {/* pistão hidráulico (escavadeira) */}
      <line x1="55" y1="184" x2="59" y2="220" stroke="#BFDE4D" strokeWidth="2.4" opacity="0.7" />
      {/* punho */}
      <path d="M44 224 L68 227 L65 248 L46 245 Z" fill="url(#mdMet)" />
      {/* rim light azul na borda externa */}
      <path d="M42 122 C56 134 78 128 84 114" fill="none" stroke="#38bdf8" strokeWidth="1.4" opacity="0.35" />
      <path d="M46 170 L45 224" fill="none" stroke="#7dd3fc" strokeWidth="1.2" opacity="0.3" />
    </g>
  );

  const Perna = (
    <g stroke="#05070b" strokeWidth="1.4" strokeLinejoin="round">
      {/* coxa */}
      <path d="M104 240 L96 312 L124 315 L130 244 Z" fill="url(#dkMet)" />
      <path d="M104 240 L130 244 L128 262 L102 260 Z" fill="url(#mdMet)" opacity="0.8" />
      {/* joelho */}
      <circle cx="110" cy="314" r="9" fill="url(#mdMet)" />
      <circle cx="110" cy="314" r="3.5" fill="#38bdf8" style={{ filter: "drop-shadow(0 0 5px #38bdf8)" }} />
      {/* canela */}
      <path d="M99 320 L95 388 L122 390 L124 322 Z" fill="url(#dkMet)" />
      {/* pistão hidráulico */}
      <line x1="106" y1="326" x2="110" y2="382" stroke="#BFDE4D" strokeWidth="2.4" opacity="0.7" />
      {/* pé — esteira de escavadeira */}
      <path d="M80 388 L124 390 L126 414 L76 414 Z" fill="url(#mdMet)" />
      <rect x="80" y="404" width="44" height="8" rx="3" fill="#0a0e15" />
      <line x1="86" y1="408" x2="120" y2="408" stroke="#38bdf8" strokeWidth="1.4" opacity="0.45" />
      <path d="M96 312 L95 388" fill="none" stroke="#7dd3fc" strokeWidth="1.2" opacity="0.28" />
    </g>
  );

  return (
    <svg width="252" height="430" viewBox="0 0 260 440" fill="none" style={{ filter: "drop-shadow(0 18px 40px rgba(0,0,0,0.7))" }}>
      <defs>
        <linearGradient id="dkMet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a212b" /><stop offset="0.55" stopColor="#0c1016" /><stop offset="1" stopColor="#05070b" />
        </linearGradient>
        <linearGradient id="mdMet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c3744" /><stop offset="1" stopColor="#0e131a" />
        </linearGradient>
        <linearGradient id="hiMet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#41525f" /><stop offset="1" stopColor="#11161d" />
        </linearGradient>
      </defs>

      {/* sombra no chão */}
      <ellipse cx="130" cy="424" rx="86" ry="12" fill="#000" opacity="0.55" />

      {/* Pernas (esquerda + espelhada) */}
      {Perna}
      <g transform="translate(260,0) scale(-1,1)">{Perna}</g>

      {/* Quadril */}
      <path d="M104 236 L156 236 L162 266 L98 266 Z" fill="url(#mdMet)" stroke="#05070b" strokeWidth="1.4" />
      <line x1="130" y1="240" x2="130" y2="262" stroke="#38bdf8" strokeWidth="1.6" opacity="0.5" />

      {/* Abdômen */}
      <path d="M108 196 L152 196 L156 236 L104 236 Z" fill="url(#dkMet)" stroke="#05070b" strokeWidth="1.4" />
      <line x1="112" y1="208" x2="148" y2="208" stroke="#1c2530" strokeWidth="3" />
      <line x1="112" y1="220" x2="148" y2="220" stroke="#1c2530" strokeWidth="3" />

      {/* Braços (atrás do tronco) */}
      {Braco}
      <g transform="translate(260,0) scale(-1,1)">{Braco}</g>

      {/* Tronco / peito */}
      <path d="M86 104 L174 104 L160 198 L100 198 Z" fill="url(#dkMet)" stroke="#05070b" strokeWidth="1.6" />
      <path d="M86 104 L174 104 L168 128 L92 128 Z" fill="url(#mdMet)" />
      {/* placas peitorais */}
      <path d="M100 132 L126 132 L122 168 L104 168 Z" fill="url(#mdMet)" opacity="0.6" stroke="#05070b" />
      <path d="M134 132 L160 132 L156 168 L138 168 Z" fill="url(#mdMet)" opacity="0.6" stroke="#05070b" />

      {/* Emblema no peito (estrela) + marca */}
      <g transform="translate(130 150)" stroke="#bfe6ff" strokeWidth="2.2" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 4px #38bdf8)" }}>
        <line x1="0" y1="-9" x2="0" y2="9" /><line x1="-9" y1="0" x2="9" y2="0" />
        <line x1="-6.4" y1="-6.4" x2="6.4" y2="6.4" /><line x1="-6.4" y1="6.4" x2="6.4" y2="-6.4" />
      </g>
      <text x="130" y="184" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="1.5" fill="#9fb3c4">CRM EDY</text>

      {/* Caçamba de escavadeira no ombro esquerdo */}
      <path d="M78 96 L96 96 L100 84 L74 84 Z" fill="#BFDE4D" opacity="0.85" stroke="#05070b" strokeWidth="1.2" />
      <path d="M74 84 L100 84 L98 92 L76 92 Z" fill="#9bbf2e" opacity="0.7" />

      {/* Ombros (cobertura sobre o tronco) */}
      <path d="M86 104 C70 100 62 110 64 122 L96 116 Z" fill="url(#hiMet)" stroke="#05070b" strokeWidth="1.4" />
      <path d="M174 104 C190 100 198 110 196 122 L164 116 Z" fill="url(#hiMet)" stroke="#05070b" strokeWidth="1.4" />

      {/* Pescoço */}
      <path d="M120 96 L140 96 L138 106 L122 106 Z" fill="url(#mdMet)" />

      {/* Cabeça / capacete */}
      <path d="M108 60 C108 38 152 38 152 60 L150 84 C148 94 112 94 110 84 Z" fill="url(#hiMet)" stroke="#05070b" strokeWidth="1.6" />
      <path d="M112 64 C112 48 148 48 148 64 L146 82 C144 90 116 90 114 82 Z" fill="#06090e" />
      {/* olhos azuis brilhantes */}
      <g fill="#7dd3fc" style={{ filter: "drop-shadow(0 0 6px #38bdf8)" }}>
        <path d="M118 66 L130 70 L130 76 L118 74 Z">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="1.3s" repeatCount="indefinite" />
        </path>
        <path d="M142 66 L130 70 L130 76 L142 74 Z">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="1.3s" repeatCount="indefinite" />
        </path>
      </g>
      {/* detalhe lateral do capacete */}
      <circle cx="110" cy="70" r="3" fill="#1c2530" />
      <circle cx="150" cy="70" r="3" fill="#1c2530" />
      {/* rim light na cabeça */}
      <path d="M108 60 C108 38 152 38 152 60" fill="none" stroke="#7dd3fc" strokeWidth="1.4" opacity="0.45" />
    </svg>
  );
}

export function SplashIA({ saindo = false }: { saindo?: boolean }) {
  const [pct, setPct] = useState(0);
  const [fase, setFase] = useState(0);

  useEffect(() => {
    const ip = setInterval(() => setPct((p) => (p >= 100 ? 100 : Math.min(100, p + Math.max(1, Math.round((100 - p) / 16))))), 80);
    return () => clearInterval(ip);
  }, []);
  useEffect(() => { setFase(Math.min(FASES.length - 1, Math.floor((pct / 100) * (FASES.length - 1)))); }, [pct]);

  const fagulhas = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({ id: i, left: 8 + Math.random() * 84, delay: Math.random() * 3, dur: 3 + Math.random() * 3, size: 1.5 + Math.random() * 2.5 })),
    []
  );

  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden bg-[#04050a]" style={{ animation: saindo ? "spO .5s ease-in forwards" : "spI .5s ease-out both" }}>
      {/* Holofotes de palco */}
      <div className="absolute left-1/2 top-0 h-[70%] w-[420px] -translate-x-1/2" style={{ background: "linear-gradient(to bottom, rgba(56,189,248,0.16), transparent 70%)", clipPath: "polygon(38% 0,62% 0,100% 100%,0 100%)" }} />
      <div className="absolute left-1/2 top-[42%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle, rgba(26,99,245,0.16), transparent 65%)", animation: "spAmb 3.4s ease-in-out infinite" }} />

      {/* fagulhas subindo */}
      {fagulhas.map((f) => (
        <span key={f.id} className="absolute bottom-0 rounded-full bg-cyan-200/70" style={{ left: `${f.left}%`, width: f.size, height: f.size, boxShadow: "0 0 6px rgba(125,211,252,0.8)", animation: `spUp ${f.dur}s linear ${f.delay}s infinite` }} />
      ))}

      {/* Robô (entra com leve revelação) */}
      <div className="relative" style={{ marginTop: "-3vh", animation: "spReveal .9s cubic-bezier(.2,.7,.2,1) both" }}>
        <RoboMythos />
      </div>

      {/* Marca + status */}
      <div className="relative mt-3 flex flex-col items-center">
        <div className="text-[15px] font-semibold tracking-[0.42em] text-white">CRM DO EDY</div>
        <div className="mt-1.5 text-[9px] font-medium tracking-[0.45em] text-zinc-600">INTELIGÊNCIA DE VENDAS</div>
        <div className="mt-5 flex items-center gap-3 font-mono text-[10px] tracking-[0.25em] text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" style={{ animation: "spBl 1.2s ease-in-out infinite", boxShadow: "0 0 6px rgba(56,189,248,0.9)" }} />
          <span className="min-w-[160px] text-left text-zinc-400">{FASES[fase]}</span>
          <span className="tabular-nums text-cyan-300">{String(pct).padStart(3, "0")}%</span>
        </div>
        <div className="mt-3 h-1 w-56 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-agro-400 transition-all duration-200" style={{ width: `${pct}%`, boxShadow: "0 0 10px rgba(56,189,248,0.7)" }} />
        </div>
      </div>

      <style>{`
        @keyframes spI { from{opacity:0} to{opacity:1} }
        @keyframes spO { from{opacity:1} to{opacity:0} }
        @keyframes spReveal { from{ opacity:0; transform: translateY(14px) scale(.97) } to{ opacity:1; transform: none } }
        @keyframes spAmb { 0%,100%{ transform:translate(-50%,-50%) scale(.92); opacity:.85 } 50%{ transform:translate(-50%,-50%) scale(1.08); opacity:1 } }
        @keyframes spUp { 0%{ transform: translateY(0) scale(.7); opacity:0 } 20%{opacity:.8} 100%{ transform: translateY(-80vh) scale(1); opacity:0 } }
        @keyframes spBl { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
    </div>
  );
}
