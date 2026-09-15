"use client";

import { useState, useTransition } from "react";
import { Bot, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui";
import { atualizarAprendizadoOrientadorAction } from "@/lib/orientador-actions";
import type { AprendizadoOrientador } from "@/lib/zeus/orientador-aprendizado";

// "O robô do Orientador": mostra, sem caixa-preta, o que foi aprendido dos
// casos reais (lições do histórico de negociações fechadas) e do jeito de
// falar do vendedor — e deixa atualizar os dois na hora, sem esperar o cron
// semanal (src/app/api/cron/orientador-aprender).
export function AprendizadoOrientadorCard({ inicial }: { inicial: AprendizadoOrientador }) {
  const [dados, setDados] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function atualizar() {
    setErro(null);
    startTransition(async () => {
      try {
        setDados(await atualizarAprendizadoOrientadorAction());
      } catch (e) {
        setErro("Falha ao atualizar: " + (e instanceof Error ? e.message : String(e)));
      }
    });
  }

  return (
    <Card className="mt-6">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <Bot size={18} className="text-brand-600" /> O que o Orientador aprendeu com você
        </div>
        <button
          type="button"
          onClick={atualizar}
          disabled={pending}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
        >
          <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
          {pending ? "Atualizando..." : "Atualizar agora"}
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Aprende sozinho toda semana: o jeito real de você falar (para a &quot;melhor resposta&quot; soar como você, não
        genérica) e o que os casos fechados mostram (taxa de fechamento, motivo de perda mais comum, tempo até
        fechar) — só como referência leve para calibrar o tom, nunca uma regra fixa nem algo dito ao cliente.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-sm font-semibold text-slate-700">Jeito de falar</div>
          <p className="text-sm text-slate-600">
            {dados.estiloGuia ?? "Ainda não aprendido. Quando você conversar mais pelo WhatsApp, a IA aprende o seu jeito de falar."}
          </p>
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold text-slate-700">Lições do histórico</div>
          {dados.licoes.length === 0 ? (
            <p className="text-sm text-slate-600">Ainda sem negociações fechadas suficientes para tirar lições.</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-600">
              {dados.licoes.map((l) => (
                <li key={l} className="flex gap-1.5"><span className="text-brand-400">•</span><span>{l}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {dados.atualizadoEm && (
        <p className="mt-3 text-xs text-slate-400">
          Última atualização: {new Date(dados.atualizadoEm).toLocaleString("pt-BR")} · {dados.amostra} negociação(ões) fechada(s) analisada(s).
        </p>
      )}
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </Card>
  );
}
