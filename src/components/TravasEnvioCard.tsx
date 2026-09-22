"use client";

import { useEffect, useState, useTransition } from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui";
import { lerPainelEnvioAction, salvarLimitesEnvioAction, type PainelEnvio } from "@/lib/envio-limites-actions";

// A SAÚDE DO NÚMERO, na tela.
//
// Depois da restrição de 24h, o que faltava não era só a trava: era ENXERGAR
// a trava. Sem esta tela, um envio que não sai é um mistério ("programei e não
// foi"), e a única reação possível é tentar de novo — que é exatamente o que
// derruba o número de vez.
export function TravasEnvioCard() {
  const [p, setP] = useState<PainelEnvio | null>(null);
  const [salvando, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  useEffect(() => { lerPainelEnvioAction().then(setP).catch(() => {}); }, []);

  if (!p) {
    return (
      <Card className="mb-6">
        <div className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
          <ShieldCheck size={18} className="text-brand-600" /> Travas de envio do WhatsApp
        </div>
        <p className="text-sm text-slate-400">Carregando…</p>
      </Card>
    );
  }

  const l = p.limites;
  const usado = l.tetoDiario > 0 ? Math.min(100, Math.round((p.enviadasHoje / l.tetoDiario) * 100)) : 0;
  const apertado = usado >= 80;

  return (
    <Card className="mb-6">
      <div className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
        <ShieldCheck size={18} className="text-brand-600" /> Travas de envio do WhatsApp
      </div>
      <p className="mb-3 text-sm text-slate-500">
        O que segura o número para ele não ser restrito de novo. O CRM só manda campanha para quem
        já conversou com você, dentro do horário, com pausa de gente entre uma mensagem e outra.
      </p>

      {/* Quanto já saiu hoje — o número que ele precisa ver antes de disparar */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saíram hoje</span>
          <span className={`text-sm font-bold ${apertado ? "text-amber-700" : "text-slate-700"}`}>
            {p.enviadasHoje} de {l.tetoDiario}
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${apertado ? "bg-amber-500" : "bg-brand-500"}`} style={{ width: `${usado}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Conta tudo que sai pelo CRM: campanha, resposta automática e mensagem que você escreve na tela —
          o WhatsApp conta o número, não o motivo.
          {p.foraDaLista > 0 && (
            <> {p.foraDaLista} {p.foraDaLista === 1 ? "cliente pediu" : "clientes pediram"} para sair da lista e não recebe{p.foraDaLista === 1 ? "" : "m"} campanha.</>
          )}
        </p>
      </div>

      <form
        action={(fd) => {
          setSalvo(false);
          startTransition(async () => {
            await salvarLimitesEnvioAction(fd);
            setP(await lerPainelEnvioAction().catch(() => p));
            setSalvo(true);
            setTimeout(() => setSalvo(false), 3000);
          });
        }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end"
      >
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Máximo por dia</label>
          <input name="tetoDiario" type="number" min={0} max={1000} defaultValue={l.tetoDiario} inputMode="numeric" className="campo" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Começa às</label>
          <input name="horaInicio" type="number" min={0} max={23} defaultValue={l.horaInicio} inputMode="numeric" className="campo" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Para às</label>
          <input name="horaFim" type="number" min={1} max={24} defaultValue={l.horaFim} inputMode="numeric" className="campo" />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-600">
          <input name="somenteDiasUteis" type="checkbox" defaultChecked={l.somenteDiasUteis} className="h-4 w-4 rounded border-slate-300" />
          Só dia útil
        </label>
        <button
          disabled={salvando}
          className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 sm:col-span-4"
        >
          {salvo ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
          {salvando ? "Salvando…" : salvo ? "Salvo!" : "Salvar as travas"}
        </button>
      </form>

      <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
        <AlertTriangle size={13} className="mt-px shrink-0 text-amber-500" />
        Horário de Brasília. Subir o teto de uma vez é o caminho mais curto para o número ser restrito
        de novo — se precisar de mais, suba aos poucos ao longo de algumas semanas.
      </p>
    </Card>
  );
}
