"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw, Stethoscope, WifiOff } from "lucide-react";

// Erro de rede (sem internet, ou a tela é a cópia guardada e o botão tentou
// gravar): o texto do navegador muda de um para outro, por isso a lista.
const ERRO_DE_REDE = /failed to fetch|load failed|networkerror|network request failed|fetch failed|internet/i;

// Sem isso, qualquer exceção numa página do app virava a tela de erro crua
// do Next. Mesmo padrão do global-error.tsx: reporta ao ZEUS (via API, pois é
// client component e não pode chamar o Prisma direto) para diagnóstico.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Decide já na primeira pintura (sem piscar a tela vermelha antes). Esta
  // tela só nasce no navegador quando o erro é de rede — no servidor, com
  // navigator ausente, é sempre a de erro comum.
  const [semRede] = useState(
    () => typeof navigator !== "undefined" && (navigator.onLine === false || ERRO_DE_REDE.test(error.message ?? "")),
  );
  useEffect(() => {
    // Sem rede o relatório não chega ao ZEUS mesmo — e não é defeito do CRM.
    if (semRede) return;
    console.error("[app/error]", error.message, error.digest ? `(digest: ${error.digest})` : "", error.stack);
    fetch("/api/zeus/report-erro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: error.message, digest: error.digest, stack: error.stack }),
    }).catch(() => {});
  }, [error, semRede]);

  if (semRede) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-800">
        <WifiOff size={40} className="text-slate-500" />
        <div>
          <h1 className="text-lg font-bold text-slate-900">Sem internet para isto</h1>
          <p className="mt-1 max-w-md text-sm text-slate-600">
            Esta parte precisa de conexão. Sem sinal, dá para ler as telas guardadas e registrar visita e negociação pelo modo sem sinal — sobe tudo quando a internet voltar.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href="/sem-sinal" className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
            <WifiOff size={15} /> Abrir o modo sem sinal
          </a>
          <button onClick={reset} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">
            <RotateCcw size={15} /> Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
      <AlertTriangle size={40} className="text-red-500" />
      <div>
        <h1 className="text-lg font-bold text-red-800">Algo deu errado nesta página</h1>
        <p className="mt-1 max-w-md text-sm text-red-700">
          Não foi possível carregar esta tela agora. Você pode tentar de novo — se o problema continuar, avise o suporte.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={reset}
          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
        >
          <RotateCcw size={15} /> Tentar de novo
        </button>
        {/* O motivo real não chega aqui: o Next esconde a mensagem do servidor
            em produção. Este atalho leva ao diagnóstico, que mostra o que o
            banco e os serviços de fora responderam, por extenso. Sem ele, a
            tela de erro é um beco sem saída — e já custou um dia. */}
        <a
          href="/api/diag"
          className="flex items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
        >
          <Stethoscope size={15} /> Ver o que aconteceu
        </a>
      </div>
      <details className="w-full max-w-lg text-left">
        <summary className="cursor-pointer text-xs font-semibold text-red-700">Detalhes técnicos (para mandar ao suporte)</summary>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white/70 p-2 text-[11px] text-slate-700">
          {error.message || "(sem mensagem)"}{error.digest ? `\ndigest: ${error.digest}` : ""}{"\n"}{typeof window !== "undefined" ? window.location.pathname + window.location.search : ""}
        </pre>
        <p className="mt-1 text-[11px] text-red-600">O erro também foi registrado no ZEUS (menu Sistema → ZEUS).</p>
      </details>
    </div>
  );
}
