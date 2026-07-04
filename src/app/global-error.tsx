"use client";

import { useEffect } from "react";

// Boundary de erro do App Router (nível raiz) — pega erros de renderização que
// escapam de qualquer error.tsx local. Reporta ao ZEUS (via API, pois é um
// client component e não pode chamar o Prisma direto) e mostra uma tela de
// recuperação simples. Precisa ter <html>/<body> próprios: substitui o layout
// raiz inteiro quando ativado.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/zeus/report-erro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: error.message, digest: error.digest, stack: error.stack }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ background: "#09090b", color: "#e4e4e7", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ fontSize: 13, color: "#a1a1aa", maxWidth: 360, marginBottom: 20 }}>
            O erro já foi registrado no ZEUS (veja em /zeus) para diagnóstico. Tente novamente.
          </p>
          <button
            onClick={reset}
            style={{ background: "rgba(191,222,77,0.15)", color: "#BFDE4D", border: "1px solid rgba(191,222,77,0.3)", borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
