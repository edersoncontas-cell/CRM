"use client";

import { useEffect, useState } from "react";
import { SplashIA } from "@/components/SplashIA";

// Mostra o splash de inicialização UMA vez por abertura do app (sessão).
// Ao navegar entre páginas não reaparece; ao fechar e abrir o app, mostra de novo.
export function SplashBoot() {
  const [estado, setEstado] = useState<"oculto" | "ativo" | "saindo">("oculto");

  useEffect(() => {
    try {
      if (sessionStorage.getItem("crm_booted")) return;
      sessionStorage.setItem("crm_booted", "1");
    } catch {}
    setEstado("ativo");
    const tSair = setTimeout(() => setEstado("saindo"), 1900);
    const tFim = setTimeout(() => setEstado("oculto"), 2350);
    return () => { clearTimeout(tSair); clearTimeout(tFim); };
  }, []);

  if (estado === "oculto") return null;
  return <SplashIA saindo={estado === "saindo"} />;
}
