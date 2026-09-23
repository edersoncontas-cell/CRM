"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2, Loader2, AlertTriangle, CheckCircle2, MessageSquareOff } from "lucide-react";
import { Card } from "@/components/ui";
import { lerFalhadasAction, apagarFalhadasDoDisparoAction, type EstadoFalhadas } from "@/lib/limpeza-falhadas-actions";

// As mensagens que falharam e ficaram esperando o WhatsApp voltar.
//
// Elas não são só sujeira na tela do Atendimento: o cron de reenvio manda de
// novo tudo que está em FAILED com menos de 3 tentativas. Enquanto existirem,
// voltam a sair sozinhas no instante em que o envio for liberado.
//
// Nada é apagado por adivinhação. Campanha e mensagem individual são gravadas
// iguais no banco, então a tela mostra os disparos com a contagem e ele
// escolhe qual apagar — uma de cada vez, com confirmação.
export function FalhadasCard() {
  const [e, setE] = useState<EstadoFalhadas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();

  function recarregar() {
    lerFalhadasAction()
      .then(setE)
      .catch(() => { setE({ disparos: [], outras: 0 }); setErro("Não deu para ler as mensagens com erro."); });
  }
  useEffect(recarregar, []);

  if (!e) {
    return (
      <Card className="mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Loader2 size={15} className="animate-spin" /> Procurando mensagens com erro…
        </div>
      </Card>
    );
  }

  const total = e.disparos.reduce((s, d) => s + d.falhadas, 0);

  if (!total && !e.outras) {
    return (
      <Card className="mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          Nenhuma mensagem com erro esperando envio.
        </div>
        {erro && <p className="mt-2 text-xs font-semibold text-red-700">{erro}</p>}
      </Card>
    );
  }

  function apagar(envioId: string, quantas: number) {
    if (!confirm(`Apagar ${quantas} mensagem(ns) com erro deste disparo?\n\nNão tem volta. O que JÁ FOI ENTREGUE ao cliente continua na conversa — só some o que falhou e está esperando para ser reenviado.`)) return;
    setErro(null); setFeito(null);
    startTransition(async () => {
      const r = await apagarFalhadasDoDisparoAction(envioId).catch(() => null);
      if (!r?.ok) { setErro(r?.erro ?? "Não deu para apagar agora."); return; }
      setFeito(`${r.apagadas} mensagem(ns) apagada(s).`);
      recarregar();
    });
  }

  return (
    <Card className="mb-6 border-amber-200 bg-amber-50">
      <div className="mb-1 flex items-center gap-2 font-semibold text-amber-900">
        <MessageSquareOff size={18} className="shrink-0 text-amber-600" /> Mensagens com erro esperando envio
      </div>
      <p className="mb-3 text-xs leading-relaxed text-amber-900">
        Estas falharam e estão na fila de reenvio. Não é só sujeira na tela do Atendimento: elas voltam a sair
        sozinhas assim que o envio for liberado. Apagar aqui desarma isso.
        <b> O que já foi entregue ao cliente não é tocado.</b>
      </p>

      {e.disparos.length === 0 ? (
        <p className="text-xs font-semibold text-amber-900">
          As {e.outras} mensagem(ns) com erro não batem com nenhum disparo em massa — são mensagens individuais.
          O CRM não apaga essas em lote: abra a conversa no Atendimento e apague uma a uma.
        </p>
      ) : (
        <ul className="space-y-2">
          {e.disparos.map((d) => (
            <li key={d.envioId} className="rounded-xl border border-amber-200 bg-white p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-bold text-slate-800">
                  Disparo de {new Date(d.quando).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </span>
                <span className="text-sm font-bold tabular-nums text-red-700">{d.falhadas} com erro</span>
              </div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-slate-600">{d.texto}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">{d.clientes} cliente(s) · envio {d.status}</span>
                <button
                  type="button" disabled={ocupado} onClick={() => apagar(d.envioId, d.falhadas)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Apagar estas
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {e.disparos.length > 0 && e.outras > 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-amber-900">
          <AlertTriangle size={12} className="mt-px shrink-0" />
          Outras {e.outras} mensagem(ns) com erro não batem com disparo nenhum — são as individuais que você escreveu.
          Essas ficam, para você não perder o que era conversa de verdade.
        </p>
      )}

      {feito && <p className="mt-2 text-xs font-semibold text-emerald-700">{feito}</p>}
      {erro && <p className="mt-2 text-xs font-semibold text-red-700">{erro}</p>}
    </Card>
  );
}
