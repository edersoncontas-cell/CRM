"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

type Estado = "loading" | "indisponivel" | "default" | "granted" | "denied" | "ativando";

// Liga as notificações push (no iPhone exige um toque do usuário — não dá pra
// pedir permissão automaticamente). Depois de ativar, toda mensagem nova do
// WhatsApp dispara uma notificação no celular.
export function BotaoNotificacoes() {
  const [estado, setEstado] = useState<Estado>("loading");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    ) {
      setEstado("indisponivel");
      return;
    }
    setEstado(Notification.permission as Estado);
  }, []);

  async function ativar() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setEstado(perm as Estado); return; }
      setEstado("ativando");
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setEstado("granted");
    } catch {
      setEstado("default");
    }
  }

  if (estado === "loading" || estado === "indisponivel") return null;

  if (estado === "granted") {
    return (
      <span className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
        <BellRing size={15} /> Notificações ativas
      </span>
    );
  }

  if (estado === "denied") {
    return (
      <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-400" title="Você bloqueou as notificações. Reative nas configurações do navegador/iOS.">
        <Bell size={15} /> Notificações bloqueadas
      </span>
    );
  }

  return (
    <button
      onClick={ativar}
      disabled={estado === "ativando"}
      className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
    >
      {estado === "ativando" ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
      Ativar notificações
    </button>
  );
}
