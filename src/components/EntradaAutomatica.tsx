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

  useEffect(() => {
    let token: string | null = null;
    try { token = localStorage.getItem(KEY); } catch {}
    if (!token) return;
    setEntrando(true);
    fetch("/api/auth/restaurar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => {
        if (r.ok) {
          // pequeno respiro para o splash aparecer suave antes de entrar
          setTimeout(() => window.location.replace("/dashboard"), 900);
        } else {
          try { localStorage.removeItem(KEY); } catch {}
          setEntrando(false);
        }
      })
      .catch(() => setEntrando(false));
  }, []);

  useEffect(() => {
    if (!entrando) return;
    const iv = setInterval(() => setMsg((m) => (m + 1) % MENSAGENS.length), 650);
    return () => clearInterval(iv);
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
        <div className="mt-3 h-5 text-sm font-medium text-brand-300">{MENSAGENS[msg]}</div>
      </div>

      {/* Barra de progresso */}
      <div className="relative mt-6 h-1 w-56 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-brand-400 to-agro-400" style={{ animation: "crmCarregar 1.5s ease-in-out infinite" }} />
      </div>

      <style>{`
        @keyframes crmGirar { to { transform: rotate(360deg); } }
        @keyframes crmFlutuar { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-8px) } }
        @keyframes crmPing { 0%{ transform: scale(1); opacity:.7 } 100%{ transform: scale(1.7); opacity:0 } }
        @keyframes crmCarregar { 0%{ transform: translateX(-120%) } 100%{ transform: translateX(360%) } }
      `}</style>
    </div>
  );
}
