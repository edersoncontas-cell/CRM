"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { definirDataCorteAction, apagarConversasAnterioresAction, contarConversasAnterioresAction, type EstadoCorte } from "@/lib/whatsapp-corte-actions";
import { MessageCircle, Loader2, Trash2, Save } from "lucide-react";

function formatarDia(dia: string): string {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

// Espaço de configuração do WhatsApp/Atendimento: a partir de que dia as
// conversas valem. O que é anterior não entra (webhook, importação de
// histórico ou de arquivo) e pode ser apagado daqui.
export function ConversasAntigasCard({ inicial }: { inicial: EstadoCorte }) {
  const [estado, setEstado] = useState<EstadoCorte>(inicial);
  const [dia, setDia] = useState<string>(inicial.dia ?? "");
  const [previa, setPrevia] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState<"salvar" | "apagar" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!dia || dia === estado.dia) { setPrevia(null); return; }
    let vivo = true;
    const t = setTimeout(() => {
      contarConversasAnterioresAction(dia).then((n) => { if (vivo) setPrevia(n); }).catch(() => {});
    }, 400);
    return () => { vivo = false; clearTimeout(t); };
  }, [dia, estado.dia]);

  async function salvar() {
    if (!dia || ocupado) return;
    setOcupado("salvar"); setAviso(null);
    try {
      setEstado(await definirDataCorteAction(dia));
      setAviso(`Pronto: mensagens anteriores a ${formatarDia(dia)} não entram mais no CRM.`);
    } catch { setAviso("Não consegui salvar agora. Tente de novo."); }
    finally { setOcupado(null); }
  }

  async function apagar() {
    if (!dia || ocupado) return;
    const n = dia === estado.dia ? estado.conversasAnteriores : (previa ?? 0);
    if (!window.confirm(`Apagar ${n} conversa(s) anteriores a ${formatarDia(dia)}? As mensagens saem do CRM e os alertas desses clientes são resolvidos. Elas não voltam nem pela importação.`)) return;
    setOcupado("apagar"); setAviso(null);
    try {
      const r = await apagarConversasAnterioresAction(dia);
      const novo = await definirDataCorteAction(dia);
      setEstado(novo);
      setAviso(`${r.conversas} conversa(s) apagadas · ${r.clientesAfetados} cliente(s) ficaram sem conversa (alertas resolvidos).`);
    } catch { setAviso("Não consegui apagar agora. Tente de novo."); }
    finally { setOcupado(null); }
  }

  const contagem = dia === estado.dia ? estado.conversasAnteriores : previa;

  return (
    <Card className="mt-6">
      <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
        <MessageCircle size={18} className="text-emerald-600" /> Conversas do WhatsApp: a partir de quando
      </div>
      <p className="text-sm text-slate-600">
        Só conversas a partir desta data ficam no CRM. O que é mais antigo não entra nem pelo WhatsApp, nem pela importação de
        histórico, nem por arquivo. Conversa que você exclui na tela de Atendimento também não volta: só uma mensagem nova
        (depois da exclusão) recria a conversa.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-slate-600">
          Ignorar mensagens anteriores a
          <input type="date" value={dia} onChange={(e) => { setDia(e.target.value); setAviso(null); }}
            className="mt-1 block rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-normal outline-none focus:border-brand-400" />
        </label>
        <button type="button" onClick={salvar} disabled={!dia || dia === estado.dia || ocupado !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
          {ocupado === "salvar" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar data
        </button>
        <button type="button" onClick={apagar} disabled={!dia || ocupado !== null || contagem === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
          {ocupado === "apagar" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Apagar conversas anteriores{contagem !== null && contagem !== undefined ? ` (${contagem})` : ""}
        </button>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {estado.dia
          ? <>Hoje vale: a partir de <b>{formatarDia(estado.dia)}</b>{estado.conversasAnteriores > 0 ? ` · ${estado.conversasAnteriores} conversa(s) anteriores ainda no CRM` : " · nada anterior sobrou"}.</>
          : "Nenhuma data de corte definida: tudo entra."}
      </div>
      {aviso && <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{aviso}</div>}
    </Card>
  );
}
