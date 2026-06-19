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

type Estado = "loading" | "default" | "granted" | "denied" | "ativando" | "instalar" | "navegador" | "config";

// Liga as notificações push (no iPhone exige um toque do usuário — não dá pra
// pedir permissão automaticamente). Depois de ativar, toda mensagem nova do
// WhatsApp dispara uma notificação no celular.
export function BotaoNotificacoes() {
  const [estado, setEstado] = useState<Estado>("loading");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const temVapid = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const ehIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints: number }).maxTouchPoints > 1);
    const standalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    const suporta = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

    if (ehIOS && !standalone) { setEstado("instalar"); return; } // iOS só permite push no app instalado
    if (!suporta) { setEstado("navegador"); return; }
    if (!temVapid) { setEstado("config"); return; }
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

  const chip = "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold";

  if (estado === "loading") return null;

  if (estado === "granted") {
    return <span className={`${chip} border-green-200 bg-green-50 text-green-700`}><BellRing size={15} /> Notificações ativas</span>;
  }
  if (estado === "instalar") {
    return <span className={`${chip} border-amber-200 bg-amber-50 text-amber-700`} title="No iPhone, abra o app pelo ícone na tela de início para poder ativar as notificações."><Bell size={15} /> Abra pelo ícone do app p/ ativar avisos</span>;
  }
  if (estado === "navegador") {
    return <span className={`${chip} border-slate-200 bg-white text-slate-400`} title="Este navegador não suporta notificações push."><Bell size={15} /> Avisos não suportados aqui</span>;
  }
  if (estado === "config") {
    return <span className={`${chip} border-slate-200 bg-white text-slate-400`} title="Falta configurar as chaves VAPID no servidor (e fazer redeploy)."><Bell size={15} /> Avisos não configurados</span>;
  }
  if (estado === "denied") {
    return <span className={`${chip} border-slate-200 bg-white text-slate-400`} title="Você bloqueou as notificações. Reative nas configurações do iOS/navegador."><Bell size={15} /> Avisos bloqueados</span>;
  }

  return (
    <button
      onClick={ativar}
      disabled={estado === "ativando"}
      className={`${chip} border-brand-200 bg-brand-50 text-brand-700 transition hover:bg-brand-100 disabled:opacity-60`}
    >
      {estado === "ativando" ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
      Ativar notificações
    </button>
  );
}
