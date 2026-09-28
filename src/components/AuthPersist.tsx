"use client";

import { useEffect } from "react";
import { guardarToken, restaurarSessao } from "@/lib/sessao-local";

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
        .then((d) => { if (d?.token) guardarToken(d.token); })
        .catch(() => {});
      return;
    }

    // modo "restaurar"
    restaurarSessao().then((r) => { if (r === "ok") window.location.replace("/dashboard"); });
  }, [modo]);

  return null;
}
