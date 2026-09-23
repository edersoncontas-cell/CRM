"use client";

import { useEffect, useState, useTransition } from "react";
import { OctagonX, Play, Loader2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui";
import { lerPausaAction, definirPausaAction, type EstadoPausa } from "@/lib/whatsapp-pausa-actions";
import { cancelarTodosEnviosAction } from "@/lib/envio-programado-actions";

// A TRAVA GERAL na tela.
//
// Vem depois do segundo bloqueio do número. O vendedor cancelou os envios e
// eles continuaram saindo o dia inteiro — então esta tela não depende de
// nenhuma regra de campanha: ou está liberado, ou não sai NADA, nem a resposta
// automática.
export function PausaEnvioCard() {
  const [e, setE] = useState<EstadoPausa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  useEffect(() => {
    lerPausaAction()
      .then(setE)
      .catch(() => { setE({ pausado: true, naFila: 0 }); setErro("Não deu para ler o estado. Na dúvida, o CRM considera PAUSADO."); });
  }, []);

  if (!e) return null;

  function mudar(pausar: boolean) {
    // Pausar é imediato. Liberar pergunta: é o clique que já custou o número
    // duas vezes, e ele merece um segundo de atenção.
    if (!pausar && !confirm("Liberar o envio de mensagens pelo WhatsApp?\n\nVolte a enviar só quando o número estiver fora de restrição. Comece devagar.")) return;
    setErro(null);
    startTransition(async () => {
      const r = await definirPausaAction(pausar).catch(() => null);
      if (!r) { setErro("Não deu para mudar agora. Tente de novo."); return; }
      setE((v) => (v ? { ...v, pausado: r.pausado } : v));
      setAviso(null);
    });
  }

  function cancelarTudo() {
    if (!confirm(`Cancelar ${e!.naFila} envio(s) em massa que ainda não terminaram?\n\nO que já foi entregue não volta. O resto da lista para de sair.`)) return;
    startTransition(async () => {
      const r = await cancelarTodosEnviosAction().catch(() => null);
      if (!r) { setErro("Não deu para cancelar agora."); return; }
      setAviso(`${r.cancelados} envio(s) cancelado(s).`);
      setE(await lerPausaAction().catch(() => e));
    });
  }

  return (
    <Card className={`mb-6 ${e.pausado ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex items-start gap-2.5">
        {e.pausado ? <OctagonX size={20} className="mt-0.5 shrink-0 text-red-600" /> : <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />}
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-bold ${e.pausado ? "text-red-800" : "text-amber-900"}`}>
            {e.pausado ? "Envio de mensagens PAUSADO" : "Envio de mensagens LIBERADO"}
          </div>
          <p className={`mt-1 text-xs leading-relaxed ${e.pausado ? "text-red-800" : "text-amber-900"}`}>
            {e.pausado
              ? "Nenhuma mensagem sai do CRM: nem campanha, nem resposta automática do ZEUS, nem parabéns de aniversário, nem o que você escrever na tela do WhatsApp. As conversas continuam CHEGANDO normalmente."
              : "O CRM pode enviar mensagens, dentro das travas de horário e teto diário abaixo."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {e.pausado ? (
              <button
                type="button" disabled={salvando} onClick={() => mudar(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {salvando ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Liberar o envio
              </button>
            ) : (
              <button
                type="button" disabled={salvando} onClick={() => mudar(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {salvando ? <Loader2 size={13} className="animate-spin" /> : <OctagonX size={13} />} Pausar tudo agora
              </button>
            )}

            {e.naFila > 0 && (
              <button
                type="button" disabled={salvando} onClick={cancelarTudo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Cancelar {e.naFila} envio(s) na fila
              </button>
            )}
          </div>

          {aviso && <p className="mt-2 text-xs font-semibold text-emerald-700">{aviso}</p>}
          {erro && <p className="mt-2 text-xs font-semibold text-red-700">{erro}</p>}
        </div>
      </div>
    </Card>
  );
}
