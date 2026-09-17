"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { lerEstadoLimpezaAction, executarLimpezaAction, desfazerLimpezaAction, type EstadoLimpeza } from "@/lib/clientes-lixo-actions";
import { DESCRICAO_MOTIVO, type MotivoLimpeza } from "@/lib/clientes-lixo-regra";
import { Eraser, Loader2, Undo2, ChevronDown, ChevronUp } from "lucide-react";

function fmtData(d: Date | string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Cadastros sem identidade: "?", id do WhatsApp no lugar do nome, número no
// lugar do nome, "Contato 5527…" sem conversa. Conserta o que dá e apaga o
// que não tem nada. Cada rodada pode ser desfeita.
export function ClientesLixoCard({ inicial }: { inicial: EstadoLimpeza }) {
  const [estado, setEstado] = useState<EstadoLimpeza>(inicial);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(false);
  const { previa, historico } = estado;
  const total = previa.apagar + previa.consertar;

  async function recarregar() { setEstado(await lerEstadoLimpezaAction()); }

  async function limpar() {
    if (ocupado || total === 0) return;
    if (!window.confirm(`Limpar ${total} cadastro(s)? ${previa.apagar} vão ser apagados (não têm nome, telefone, conversa nem dado nenhum) e ${previa.consertar} consertados (número vira telefone, nome vazio vira "Contato <tel>"). Dá para desfazer depois.`)) return;
    setOcupado("limpar"); setAviso(null);
    try {
      const r = await executarLimpezaAction();
      setAviso(`Pronto: ${r.apagados} apagado(s), ${r.consertados} consertado(s).`);
    } catch {
      setAviso("Não consegui limpar agora. Tente de novo.");
    } finally {
      setOcupado(null);
      await recarregar().catch(() => {});
    }
  }

  async function desfazer(id: string) {
    if (ocupado) return;
    if (!window.confirm("Desfazer esta limpeza? Os cadastros apagados voltam com o mesmo id e os consertados voltam como estavam.")) return;
    setOcupado(id); setAviso(null);
    try {
      const r = await desfazerLimpezaAction(id);
      setAviso(r.falhas.length ? `${r.restaurados} restaurado(s); ${r.falhas.length} não deu: ${r.falhas[0]}` : `Desfeito: ${r.restaurados} cadastro(s) como estavam.`);
    } catch {
      setAviso("Não consegui desfazer agora. Tente de novo.");
    } finally {
      setOcupado(null);
      await recarregar().catch(() => {});
    }
  }

  return (
    <Card className="mt-6">
      <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
        <Eraser size={18} className="text-brand-600" /> Cadastros sem identidade
      </div>
      <p className="text-sm text-slate-600">
        Sobras de importação e de conversas apagadas: nome &quot;?&quot;, id do WhatsApp no lugar do nome, número no lugar do nome, &quot;Contato 5527…&quot;
        sem conversa. O que dá para consertar é consertado (o número vira telefone; nome vazio vira &quot;Contato &lt;telefone&gt;&quot;); o que não tem nome,
        telefone, conversa nem dado nenhum é apagado. Nunca mexe em quem tem negociação, visita, frota ou conversa, nem em cadastro ligado ao Google.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={limpar} disabled={ocupado !== null || total === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
          {ocupado === "limpar" ? <Loader2 size={14} className="animate-spin" /> : <Eraser size={14} />}
          {total === 0 ? "Nada para limpar" : `Limpar ${total} cadastro(s)`}
        </button>
        <span className="text-xs text-slate-500">
          {total === 0 ? "Nenhum cadastro sem identidade." : `${previa.apagar} para apagar · ${previa.consertar} para consertar`}
        </span>
        {total > 0 && (
          <button type="button" onClick={() => setMostrar((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            {mostrar ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {mostrar ? "Esconder" : "Ver a lista"}
          </button>
        )}
      </div>

      {total > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
          {(Object.keys(previa.porMotivo) as MotivoLimpeza[]).map((m) => previa.porMotivo[m] ? <li key={m}><b>{previa.porMotivo[m]}</b> {DESCRICAO_MOTIVO[m]}</li> : null)}
        </ul>
      )}

      {mostrar && previa.exemplos.length > 0 && (
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-2 text-xs">
          {previa.exemplos.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-1.5 rounded-md bg-white px-2 py-1.5">
              <span className={e.acao === "apagar" ? "line-through decoration-slate-300 text-slate-500" : "font-semibold text-slate-800"}>{e.nome}</span>
              <span className="text-slate-400">{e.telefone ?? "sem telefone"}</span>
              <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${e.acao === "apagar" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                {e.acao === "apagar" ? "apagar" : e.acao === "renomear" ? `vira "${e.novo}"` : `telefone ${e.novo}`}
              </span>
            </li>
          ))}
          {total > previa.exemplos.length && <li className="px-2 text-slate-400">… e mais {total - previa.exemplos.length}.</li>}
        </ul>
      )}

      {aviso && <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{aviso}</div>}

      {historico.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-slate-600">Rodadas feitas</div>
          <ul className="mt-1 space-y-1 text-xs">
            {historico.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
                <span className="text-slate-400">{fmtData(h.criadoEm)}</span>
                <span className="min-w-0 flex-1 text-slate-600">{h.resumo}</span>
                {h.desfeitaEm
                  ? <span className="text-[10px] text-slate-400">desfeita em {fmtData(h.desfeitaEm)}</span>
                  : <button type="button" onClick={() => desfazer(h.id)} disabled={ocupado !== null}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50">
                      {ocupado === h.id ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Desfazer
                    </button>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
