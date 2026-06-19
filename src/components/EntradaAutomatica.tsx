"use client";

import { useEffect, useMemo, useState } from "react";

const KEY = "crm_token";
const MENSAGENS = [
  "Carregando energia…",
  "Inicializando inteligência…",
  "Sincronizando WhatsApp…",
  "Reunindo os dados…",
  "Concentrando poder…",
  "Quase no máximo…",
];

const GLYPHS = "ACDEFHKMNPRTXZ0123456789#@$%&*<>{}[]/=+!?".split("");

// Robô-escavadeira (estilo mech) com os braços erguidos segurando a energia.
function RoboEscavadeira() {
  return (
    <svg width="200" height="220" viewBox="0 0 200 220" fill="none" style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.6))" }}>
      {/* Braços erguidos */}
      <g stroke="#0f1622" strokeWidth="2" strokeLinejoin="round">
        {/* braço esquerdo */}
        <path d="M70 120 L52 86 L60 50" fill="none" stroke="#9bbf2e" strokeWidth="13" strokeLinecap="round" />
        <path d="M70 120 L52 86 L60 50" fill="none" stroke="#BFDE4D" strokeWidth="8" strokeLinecap="round" />
        {/* braço direito */}
        <path d="M130 120 L148 86 L140 50" fill="none" stroke="#9bbf2e" strokeWidth="13" strokeLinecap="round" />
        <path d="M130 120 L148 86 L140 50" fill="none" stroke="#BFDE4D" strokeWidth="8" strokeLinecap="round" />
        {/* mãos/garras */}
        <circle cx="60" cy="48" r="8" fill="#1c2433" />
        <circle cx="140" cy="48" r="8" fill="#1c2433" />
      </g>

      {/* Pernas */}
      <g stroke="#0f1622" strokeWidth="2">
        <rect x="74" y="160" width="18" height="40" rx="5" fill="#BFDE4D" />
        <rect x="108" y="160" width="18" height="40" rx="5" fill="#BFDE4D" />
        {/* esteiras/pés */}
        <rect x="66" y="196" width="32" height="16" rx="7" fill="#1c2433" />
        <rect x="102" y="196" width="32" height="16" rx="7" fill="#1c2433" />
        <circle cx="74" cy="204" r="3" fill="#38bdf8" opacity="0.7" />
        <circle cx="126" cy="204" r="3" fill="#38bdf8" opacity="0.7" />
      </g>

      {/* Tronco */}
      <path d="M66 116 L134 116 L126 162 L74 162 Z" fill="#BFDE4D" stroke="#0f1622" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M66 116 L134 116 L130 130 L70 130 Z" fill="#9bbf2e" opacity="0.6" />
      {/* cabine / cockpit */}
      <rect x="86" y="128" width="28" height="20" rx="4" fill="#0f1622" stroke="#0f1622" />
      <rect x="89" y="131" width="22" height="14" rx="3" fill="#38bdf8" opacity="0.85">
        <animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.4s" repeatCount="indefinite" />
      </rect>
      {/* detalhe escavadeira no peito */}
      <path d="M100 150 l8 8 l-3 6" stroke="#0f1622" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Ombros */}
      <circle cx="70" cy="120" r="12" fill="#1c2433" stroke="#0f1622" strokeWidth="2" />
      <circle cx="130" cy="120" r="12" fill="#1c2433" stroke="#0f1622" strokeWidth="2" />

      {/* Cabeça */}
      <rect x="86" y="96" width="28" height="22" rx="6" fill="#1c2433" stroke="#0f1622" strokeWidth="2" />
      <rect x="90" y="103" width="20" height="7" rx="3" fill="#38bdf8">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="1.1s" repeatCount="indefinite" />
      </rect>
      {/* antena */}
      <line x1="100" y1="96" x2="100" y2="86" stroke="#9bbf2e" strokeWidth="3" />
      <circle cx="100" cy="84" r="3" fill="#BFDE4D">
        <animate attributeName="r" values="2.5;4;2.5" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export function EntradaAutomatica() {
  const [entrando, setEntrando] = useState(false);
  const [msg, setMsg] = useState(0);
  const [pct, setPct] = useState(0);

  // Glyphs que "sobem" carregando energia (gerados uma vez, no cliente).
  const cargas = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        id: i,
        ch: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        left: 8 + Math.random() * 84,
        delay: Math.random() * 3,
        dur: 2.2 + Math.random() * 2.6,
        size: 10 + Math.random() * 16,
        op: 0.06 + Math.random() * 0.22,
      })),
    []
  );

  useEffect(() => {
    let token: string | null = null;
    try { token = localStorage.getItem(KEY); } catch {}
    if (!token) return;
    setEntrando(true);
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.setValueAtTime(300, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 1.2);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4);
      o.start(); o.stop(ctx.currentTime + 1.45); o.onended = () => ctx.close();
    } catch {}
    fetch("/api/auth/restaurar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => {
        if (r.ok) setTimeout(() => window.location.replace("/dashboard"), 2400);
        else { try { localStorage.removeItem(KEY); } catch {} setEntrando(false); }
      })
      .catch(() => setEntrando(false));
  }, []);

  useEffect(() => {
    if (!entrando) return;
    const iv = setInterval(() => setMsg((m) => (m + 1) % MENSAGENS.length), 600);
    const ip = setInterval(() => setPct((p) => (p >= 100 ? 100 : p + Math.max(1, Math.ceil((100 - p) / 12)))), 90);
    return () => { clearInterval(iv); clearInterval(ip); };
  }, [entrando]);

  if (!entrando) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-black">
      {/* Fundo: brilho + grade */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 30%, rgba(26,99,245,0.22), transparent 60%)" }} />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "linear-gradient(rgba(191,222,77,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(191,222,77,0.7) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      {/* Glyphs subindo (carregando poder) */}
      {cargas.map((c) => (
        <span
          key={c.id}
          className="absolute bottom-0 font-mono font-bold text-agro-400"
          style={{
            left: `${c.left}%`,
            fontSize: c.size,
            animation: `crmSubir ${c.dur}s linear ${c.delay}s infinite`,
            ["--o" as string]: String(c.op),
          } as React.CSSProperties}
        >
          {c.ch}
        </span>
      ))}

      {/* Robô + bola de energia */}
      <div className="relative flex flex-col items-center" style={{ marginTop: "-4vh" }}>
        {/* Bola de energia (cresce e pulsa acima das mãos) */}
        <div className="relative mb-[-26px] h-40 w-40">
          <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.55), rgba(26,99,245,0.25) 45%, transparent 70%)", filter: "blur(6px)", animation: "crmBola 2.4s ease-in-out infinite" }} />
          <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle, #eaffff, #7dd3fc 40%, #1a63f5 75%)", boxShadow: "0 0 40px rgba(56,189,248,0.9)", animation: "crmBolaCore 2.4s ease-in-out infinite" }} />
          <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-agro-400/60" style={{ animation: "crmGirar 5s linear infinite" }} />
          {/* faíscas */}
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <span key={a} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-agro-300" style={{ transform: `rotate(${a}deg) translateY(-54px)`, transformOrigin: "center", animation: "crmFaisca 1.4s ease-in-out infinite", boxShadow: "0 0 8px #BFDE4D" }} />
          ))}
        </div>

        <RoboEscavadeira />
      </div>

      {/* Marca + status + % */}
      <div className="relative mt-6 text-center">
        <div className="text-xl font-black tracking-[0.35em] text-white">CRM DO EDY</div>
        <div className="mt-2 h-5 text-sm font-medium text-brand-300">
          {MENSAGENS[msg]}<span style={{ animation: "crmPiscar 1s steps(1) infinite" }}>▋</span>
        </div>
        <div className="mx-auto mt-4 w-56">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-agro-400 transition-all duration-200" style={{ width: `${pct}%`, boxShadow: "0 0 12px rgba(191,222,77,0.7)" }} />
          </div>
          <div className="mt-2 font-mono text-xs tracking-widest text-agro-300">PODER {pct}%</div>
        </div>
      </div>

      <style>{`
        @keyframes crmGirar { to { transform: rotate(360deg); } }
        @keyframes crmPiscar { 50%{ opacity: 0 } }
        @keyframes crmSubir {
          0%{ transform: translateY(0) scale(.7); opacity: 0 }
          15%{ opacity: var(--o, .2) }
          70%{ opacity: var(--o, .2) }
          100%{ transform: translateY(-70vh) scale(1.1); opacity: 0 }
        }
        @keyframes crmBola { 0%,100%{ transform: scale(.85); opacity:.8 } 50%{ transform: scale(1.15); opacity:1 } }
        @keyframes crmBolaCore { 0%,100%{ transform: translate(-50%,-50%) scale(.8) } 50%{ transform: translate(-50%,-50%) scale(1.08) } }
        @keyframes crmFaisca { 0%,100%{ opacity:.3; transform-origin:center } 50%{ opacity:1 } }
      `}</style>
    </div>
  );
}
