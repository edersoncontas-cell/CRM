"use client";

import { useEffect } from "react";

const KEY = "crm_token";

// Reforço de "manter login" para o PWA do iPhone (que às vezes descarta o cookie
// ao fechar o app):
// - modo "guardar": dentro do app logado, busca o token e salva no armazenamento
//   interno (localStorage), que sobrevive melhor que o cookie no PWA.
// - modo "restaurar": na tela de login, se houver token salvo, re-autentica
//   sozinho e entra direto — sem digitar a senha.
export function AuthPersist({ modo }: { modo: "guardar" | "restaurar" }) {
  useEffect(() => {
    if (modo === "guardar") {
      fetch("/api/auth/token")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.token) {
            try { localStorage.setItem(KEY, d.token); } catch {}
          }
        })
        .catch(() => {});
      return;
    }

    // modo "restaurar"
    let t: string | null = null;
    try { t = localStorage.getItem(KEY); } catch {}
    if (!t) return;
    fetch("/api/auth/restaurar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t }),
    })
      .then((r) => {
        if (r.ok) window.location.replace("/dashboard");
        else { try { localStorage.removeItem(KEY); } catch {} }
      })
      .catch(() => {});
  }, [modo]);

  return null;
}
