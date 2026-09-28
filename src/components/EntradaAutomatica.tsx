"use client";

import { useEffect, useState } from "react";
import { SplashIA } from "@/components/SplashIA";
import { lerToken, restaurarSessao } from "@/lib/sessao-local";

// Na tela de login: se há sessão salva, re-autentica em silêncio e entra direto,
// mostrando o splash de inicialização (sem o formulário de login aparecer).
export function EntradaAutomatica() {
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    if (!lerToken()) return;
    setEntrando(true);
    restaurarSessao().then((r) => {
      if (r === "ok") {
        // marca que o splash já apareceu, para o dashboard não repetir
        try { sessionStorage.setItem("crm_booted", "1"); } catch {}
        setTimeout(() => window.location.replace("/dashboard"), 2900);
      } else {
        setEntrando(false);
      }
    });
  }, []);

  if (!entrando) return null;
  return <SplashIA />;
}
