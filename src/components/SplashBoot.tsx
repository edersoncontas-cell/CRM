"use client";

import { useEffect, useState } from "react";
import { SplashIA } from "@/components/SplashIA";

// Mostra o splash de inicialização UMA vez por abertura do app (sessão).
// Ao navegar entre páginas não reaparece; ao fechar e abrir o app, mostra de novo.
// A decisão fica em variável de módulo: assim o efeito pode rodar duas vezes
// (modo estrito do React em desenvolvimento) sem perder os temporizadores.
let mostrar: boolean | null = null;

export function SplashBoot() {
  const [estado, setEstado] = useState<"oculto" | "ativo" | "saindo">("oculto");

  useEffect(() => {
    if (mostrar === null) {
      try {
        mostrar = !sessionStorage.getItem("crm_booted");
        sessionStorage.setItem("crm_booted", "1");
      } catch {
        mostrar = true;
      }
    }
    if (!mostrar) return;
    setEstado("ativo");
    // Barra de 1,9 s + respiro, e 0,4 s de saída (ver SplashIA).
    const tSair = setTimeout(() => setEstado("saindo"), 2200);
    const tFim = setTimeout(() => { setEstado("oculto"); mostrar = false; }, 2600);
    return () => { clearTimeout(tSair); clearTimeout(tFim); };
  }, []);

  if (estado === "oculto") return null;
  return <SplashIA saindo={estado === "saindo"} />;
}
