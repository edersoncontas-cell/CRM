"use client";

import { useEffect, useState } from "react";
import { SplashIA } from "@/components/SplashIA";

const KEY = "crm_token";

// Na tela de login: se há sessão salva, re-autentica em silêncio e entra direto,
// mostrando o splash de inicialização (sem o formulário de login aparecer).
export function EntradaAutomatica() {
  const [entrando, setEntrando] = useState(false);

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
          // marca que o splash já apareceu, para o dashboard não repetir
          try { sessionStorage.setItem("crm_booted", "1"); } catch {}
          setTimeout(() => window.location.replace("/dashboard"), 2900);
        } else {
          try { localStorage.removeItem(KEY); } catch {}
          setEntrando(false);
        }
      })
      .catch(() => setEntrando(false));
  }, []);

  if (!entrando) return null;
  return <SplashIA />;
}
