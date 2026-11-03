"use client";

// A TRAVA GERAL DO ENVIO, na tela (03/11).
//
// De 01/10 a 03/11 ela não tinha tela: nascia pausada e nada no CRM conseguia
// liberar — nenhuma campanha saía, e a fila do Marketing esperava para sempre.
//
// Três botões, com pesos diferentes de propósito:
//   · PAUSAR — imediato, sem pergunta (na hora do aperto, um toque);
//   · LIBERAR — só depois de ver o que vai sair e digitar LIBERAR (o servidor
//     confere a palavra de novo: lib/whatsapp-pausa-actions.ts);
//   · CANCELAR A FILA — o botão de pânico: para tudo que está na fila.

import { useEffect, useState } from "react";
import { lerPausaAction, definirPausaAction, type EstadoPausa } from "@/lib/whatsapp-pausa-actions";
import { cancelarTodosEnviosAction } from "@/lib/envio-programado-actions";
import { PALAVRA_LIBERAR, confirmouLiberar } from "@/lib/whatsapp-pausa-regra";
import { Loader2, PauseCircle, PlayCircle, ShieldAlert, ShieldCheck, XOctagon, RefreshCw } from "lucide-react";

export function TravaEnvio() {
  const [estado, setEstado] = useState<EstadoPausa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [abrirLiberar, setAbrirLiberar] = useState(false);
  const [palavra, setPalavra] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  async function carregar() {
    setErro(null);
    try {
      setEstado(await lerPausaAction());
    } catch {
      setErro("Não consegui ler a trava agora (banco ou internet). Enquanto isso, vale o padrão: PAUSADO — nada sai.");
    }
  }

  useEffect(() => { carregar(); }, []);

  async function pausar() {
    setOcupado(true); setAviso(null);
    const r = await definirPausaAction(true).catch(() => ({ ok: false, pausado: true, erro: "Falha de internet ao pausar — tente de novo." }));
    setOcupado(false);
    if (!r.ok) { setAviso(r.erro ?? "Não deu para pausar."); return; }
    setAbrirLiberar(false); setPalavra("");
    setAviso("Pausado. Nenhuma mensagem sai do CRM até você liberar de novo.");
    await carregar();
  }

  async function liberar() {
    if (!confirmouLiberar(palavra)) return;
    setOcupado(true); setAviso(null);
    const r = await definirPausaAction(false, palavra).catch(() => ({ ok: false, pausado: true, erro: "Falha de internet ao liberar — nada mudou." }));
    setOcupado(false);
    if (!r.ok) { setAviso(r.erro ?? "Não deu para liberar."); return; }
    setAbrirLiberar(false); setPalavra("");
    setAviso("Liberado. A fila começa a sair no ritmo por hora, dentro da janela de horário.");
    await carregar();
  }

  async function cancelarFila() {
    if (!estado?.naFila) return;
    if (!confirm(`Cancelar TODOS os ${estado.naFila} envio(s) em massa que ainda não terminaram? O que já saiu não volta; o resto para de sair.`)) return;
    setOcupado(true); setAviso(null);
    const r = await cancelarTodosEnviosAction().catch(() => null);
    setOcupado(false);
    if (!r) { setAviso("Falha de internet ao cancelar — tente de novo. Se for urgente, aperte Pausar: ele para tudo na hora."); return; }
    setAviso(`${r.cancelados} envio(s) cancelado(s).`);
    // A lista "Envios programados" (MensagemClientes) está na mesma página:
    // sem este aviso ela continuaria mostrando "aguardando" até recarregar.
    window.dispatchEvent(new Event("crm:fila-envio-mudou"));
    await carregar();
  }

  if (erro) {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldAlert size={18} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <b>Trava de envio</b> — {erro}
          <button type="button" onClick={carregar} className="mt-2 flex items-center gap-1 text-xs font-bold underline"><RefreshCw size={12} /> Tentar de novo</button>
        </div>
      </div>
    );
  }

  if (!estado) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Lendo a trava de envio…
      </div>
    );
  }

  const pausado = estado.pausado;
  return (
    <div className={`mb-4 rounded-2xl border p-4 ${pausado ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`shrink-0 rounded-lg p-2 text-white ${pausado ? "bg-red-500" : "bg-green-600"}`}>
          {pausado ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`font-bold ${pausado ? "text-red-800" : "text-green-800"}`}>
            {pausado ? "Envio PAUSADO — nenhuma mensagem sai do CRM" : "Envio LIBERADO"}
          </div>
          <p className={`text-xs ${pausado ? "text-red-700" : "text-green-700"}`}>
            {pausado
              ? "Campanhas, parabéns automático e reenvio ficam parados. A fila espera e não perde nada."
              : estado.ritmo}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pausado ? (
            <button type="button" disabled={ocupado} onClick={() => { setAbrirLiberar((v) => !v); setAviso(null); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
              <PlayCircle size={15} /> Liberar envio
            </button>
          ) : (
            <button type="button" disabled={ocupado} onClick={pausar}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
              {ocupado ? <Loader2 size={15} className="animate-spin" /> : <PauseCircle size={15} />} Pausar agora
            </button>
          )}
          {estado.naFila > 0 && (
            <button type="button" disabled={ocupado} onClick={cancelarFila}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
              <XOctagon size={15} /> Cancelar a fila ({estado.naFila})
            </button>
          )}
        </div>
      </div>

      {pausado && abrirLiberar && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <div className="mb-1 font-semibold">O que volta a sair se você liberar:</div>
          {estado.fila.length ? (
            <ul className="mb-2 max-h-32 space-y-0.5 overflow-y-auto text-xs">
              {estado.fila.map((f, i) => <li key={i}>• {f.o_que}</li>)}
            </ul>
          ) : (
            <p className="mb-2 text-xs text-slate-500">Nada engatilhado agora — só o que você puser na fila depois.</p>
          )}
          <p className="mb-2 text-xs text-slate-500">{estado.ritmo}</p>
          <label htmlFor="palavra-liberar" className="mb-1 block text-xs font-semibold">
            Para liberar, digite <b>{PALAVRA_LIBERAR}</b>:
          </label>
          <div className="flex flex-wrap gap-2">
            <input id="palavra-liberar" value={palavra} onChange={(e) => setPalavra(e.target.value)} autoComplete="off" autoCapitalize="characters"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800" placeholder={PALAVRA_LIBERAR} />
            <button type="button" disabled={ocupado || !confirmouLiberar(palavra)} onClick={liberar}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40">
              {ocupado ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />} Confirmar
            </button>
          </div>
        </div>
      )}

      {aviso && <p className="mt-2 text-xs font-semibold text-slate-700">{aviso}</p>}
    </div>
  );
}
