"use client";

import { useEffect } from "react";

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

export function RegistrarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Já existia um worker no comando antes de registrarmos? Se sim, quando
    // o controle trocar é porque saiu VERSÃO NOVA, e a aba precisa recarregar
    // para mostrar o CRM atualizado — sem isso o aparelho continuava exibindo
    // a versão antiga até o usuário fechar tudo na mão. Na primeira visita
    // (sem worker anterior) a troca é normal e não recarrega nada.
    const jaTinhaWorker = Boolean(navigator.serviceWorker.controller);
    let recarregando = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!jaTinhaWorker || recarregando) return;
      recarregando = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      // Força a checagem de versão nova a cada abertura do CRM.
      reg.update().catch(() => {});

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey || !("PushManager" in window)) return;

      // Ask notification permission on first visit
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission !== "granted") return;

      // Check if already subscribed
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Save subscription to server
      fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  return null;
}
