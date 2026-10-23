"use client";

import { useEffect } from "react";
import { INTERVALO_BATIDA_AGENDADOR } from "@/lib/intervalos-atualizacao";

// O CRM aberto cobre o agendador externo parado: de tempos em tempos pergunta
// ao servidor se alguma rotina está atrasada (vigia do WhatsApp, lembretes…) e,
// se estiver, o servidor roda a passada. Não aparece nada na tela e uma falha
// aqui nunca atrapalha o resto — quem avisa que o agendador parou é a tela de
// Conexão. Só com a tela visível e com internet (aba escondida não gasta o banco).

const CHAVE = "crm.batida.agendador";

export function BatidaDoAgendador() {
  useEffect(() => {
    const bater = async () => {
      if (document.visibilityState !== "visible" || navigator.onLine === false) return;
      try {
        const antes = Number(window.localStorage.getItem(CHAVE) ?? 0);
        if (Date.now() - antes < INTERVALO_BATIDA_AGENDADOR) return;
        window.localStorage.setItem(CHAVE, String(Date.now()));
      } catch {
        // Sem armazenamento (janela privada): bate mesmo assim — o servidor decide se roda.
      }
      try {
        await fetch("/api/agendador/batida", { method: "POST", cache: "no-store" });
      } catch {
        // Sem rede ou servidor ocupado: tenta de novo na próxima volta.
      }
    };
    const primeira = setTimeout(bater, 5_000);
    const volta = setInterval(() => { if (document.visibilityState === "visible") void bater(); }, INTERVALO_BATIDA_AGENDADOR);
    const aoVoltar = () => { if (document.visibilityState === "visible") void bater(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearTimeout(primeira);
      clearInterval(volta);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);
  return null;
}
