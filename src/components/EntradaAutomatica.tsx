"use client";

import { useEffect, useState } from "react";
import { ExcavatorIcon } from "@/components/icons";

const KEY = "crm_token";
const MENSAGENS = [
  "Inicializando inteligência…",
  "Carregando seus clientes…",
  "Sincronizando WhatsApp…",
  "Analisando negociações…",
  "Preparando o painel…",
  "Quase lá…",
];

// Quando há um token salvo, re-autentica em silêncio e mostra um splash
// futurista de "IA carregando" cobrindo a tela de login — em vez do formulário.
export function EntradaAutomatica() {
  const [entrando, setEntrando] = useState(false);
  const [msg, setMsg] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let token: string | null = null;
    try { token = localStorage.getItem(KEY); } catch {}
    if (!token) return;
    setEntrando(true);
    // Boot sound (best-effort — iOS pode bloquear sem gesto, e tudo bem).
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.setValueAtTime(420, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      o.start(); o.stop(ctx.currentTime + 0.52); o.onended = () => ctx.close();
    } catch {}
    fetch("/api/auth/restaurar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => {
        if (r.ok) {
          setTimeout(() => window.location.replace("/dashboard"), 1500);
        } else {
          try { localStorage.removeItem(KEY); } catch {}
          setEntrando(false);
        }
      })
      .catch(() => setEntrando(false));
  }, []);

  useEffect(() => {
    if (!entrando) return;
    const iv = setInterval(() => setMsg((m) => (m + 1) % MENSAGENS.length), 600);
    const ip = setInterval(() => setPct((p) => (p >= 100 ? 100 : p + Math.ceil((100 - p) / 8))), 90);
    return () => { clearInterval(iv); clearInterval(ip); };
  }, [entrando]);

  if (!entrando) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-black">
      {/* Brilho central + grade futurista */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 38%, rgba(26,99,245,0.28), transparent 62%)" }} />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(191,222,77,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(191,222,77,0.7) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />

      {/* Linha de escaneamento */}
      <div
        className="absolute inset-x-0 h-24"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(26,99,245,0.18), transparent)",
          animation: "crmScan 2.6s linear infinite",
        }}
      />

      {/* Partículas flutuantes */}
      {[...Array(8)].map((_, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-agro-400/70"
          style={{
            left: `${[12, 28, 44, 60, 76, 88, 20, 68][i]}%`,
            top: `${[20, 70, 35, 80, 25, 60, 50, 15][i]}%`,
            animation: `crmFlutuar ${2 + (i % 4) * 0.6}s ease-in-out ${i * 0.3}s infinite`,
            boxShadow: "0 0 8px rgba(191,222,77,0.8)",
          }}
        />
      ))}

      {/* Núcleo da IA */}
      <div className="relative flex h-36 w-36 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-brand-500/40" style={{ animation: "crmPing 1.8s ease-out infinite" }} />
        <span className="absolute -inset-2 rounded-full border border-brand-500/20" style={{ animation: "crmPing 1.8s ease-out .6s infinite" }} />
        <span className="absolute inset-0 rounded-full border-2 border-dashed border-agro-400/40" style={{ animation: "crmGirar 6s linear infinite" }} />
        <span className="absolute inset-4 rounded-full border border-brand-400/40" style={{ animation: "crmGirar 4s linear infinite reverse" }} />
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-900"
          style={{ boxShadow: "0 0 55px rgba(26,99,245,0.75)", animation: "crmFlutuar 2.4s ease-in-out infinite" }}
        >
          <ExcavatorIcon size={38} className="text-agro-400" />
        </div>
      </div>

      {/* Marca + status */}
      <div className="relative mt-10 text-center">
        <div className="text-xl font-black tracking-[0.35em] text-white">CRM DO EDY</div>
        <div className="mt-3 h-5 text-sm font-medium text-brand-300">
          {MENSAGENS[msg]}<span style={{ animation: "crmPiscar 1s steps(1) infinite" }}>▋</span>
        </div>
      </div>

      {/* Barra de progresso + porcentagem */}
      <div className="relative mt-6 w-56">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-agro-400 transition-all duration-200"
            style={{ width: `${pct}%`, boxShadow: "0 0 12px rgba(191,222,77,0.7)" }}
          />
        </div>
        <div className="mt-2 text-center font-mono text-xs tracking-widest text-brand-300">{pct}%</div>
      </div>

      <style>{`
        @keyframes crmGirar { to { transform: rotate(360deg); } }
        @keyframes crmFlutuar { 0%,100%{ transform: translateY(0); opacity:.6 } 50%{ transform: translateY(-10px); opacity:1 } }
        @keyframes crmPing { 0%{ transform: scale(1); opacity:.7 } 100%{ transform: scale(1.7); opacity:0 } }
        @keyframes crmScan { 0%{ top: -10% } 100%{ top: 110% } }
        @keyframes crmPiscar { 50%{ opacity: 0 } }
      `}</style>
    </div>
  );
}
