"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

// Sem isso, qualquer exceção numa página do app virava a tela de erro crua
// do Next. Mesmo padrão do global-error.tsx: reporta ao ZEUS (via API, pois é
// client component e não pode chamar o Prisma direto) para diagnóstico.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app/error]", error.message, error.digest ? `(digest: ${error.digest})` : "", error.stack);
    fetch("/api/zeus/report-erro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: error.message, digest: error.digest, stack: error.stack }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
      <AlertTriangle size={40} className="text-red-500" />
      <div>
        <h1 className="text-lg font-bold text-red-800">Algo deu errado nesta página</h1>
        <p className="mt-1 max-w-md text-sm text-red-700">
          Não foi possível carregar esta tela agora. Você pode tentar de novo — se o problema continuar, avise o suporte.
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
      >
        <RotateCcw size={15} /> Tentar de novo
      </button>
    </div>
  );
}
