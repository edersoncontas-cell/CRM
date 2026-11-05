"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Download, Loader2, Send, ImagePlus, Inbox } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { STATUS_TICKET, ROTULO_STATUS, DICA_CAMPO, LIMITES, type StatusTicket } from "@/lib/suporte-regra";
import { mudarStatusTicketAction } from "@/lib/suporte-actions";
import { usePrints, enterEnvia, postarSuporte } from "./usePrints";
import { MiniaturasPrints } from "./MiniaturasPrints";

export type TicketTela = {
  id: string;
  assunto: string;
  tela: string | null;
  status: string;
  promptPronto: string | null;
  criadoEm: string;
  atualizadoEm: string;
  mensagens: { id: string; lado: string; texto: string; criadoEm: string; anexos: { id: string; nome: string; tamanho: number }[] }[];
};

const COR_STATUS: Record<StatusTicket, string> = {
  novo: "bg-red-100 text-red-700",
  em_analise: "bg-amber-100 text-amber-700",
  aprovado: "bg-blue-100 text-blue-700",
  implementado: "bg-emerald-100 text-emerald-700",
  descartado: "bg-slate-200 text-slate-600",
};

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

function corStatus(s: string) {
  return COR_STATUS[s as StatusTicket] ?? "bg-slate-200 text-slate-600";
}

export function SuporteClient({ tickets }: { tickets: TicketTela[] }) {
  const [filtro, setFiltro] = useState<"todos" | StatusTicket>("todos");
  const [selId, setSelId] = useState<string | null>(tickets[0]?.id ?? null);
  const lista = useMemo(() => (filtro === "todos" ? tickets : tickets.filter((t) => t.status === filtro)), [tickets, filtro]);
  const sel = tickets.find((t) => t.id === selId) ?? null;

  if (!tickets.length) {
    return (
      <Card>
        <EmptyState
          icone={<Inbox size={28} />}
          texto="Nenhum pedido ainda"
          subtexto="Use o botão “Suporte / Sugerir melhoria”, no canto de qualquer tela, para mandar o primeiro."
        />
      </Card>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
      <Card className="p-3">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["todos", ...STATUS_TICKET] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFiltro(s)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${filtro === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {s === "todos" ? `Todos (${tickets.length})` : `${ROTULO_STATUS[s]} (${tickets.filter((t) => t.status === s).length})`}
            </button>
          ))}
        </div>
        {/* Lista com altura fixa e rolagem própria (uso no celular, na rua). */}
        <ul className="max-h-[320px] space-y-1.5 overflow-y-auto lg:max-h-[560px]">
          {lista.length === 0 && <li className="px-2 py-6 text-center text-sm text-slate-500">Nenhum pedido com esse status.</li>}
          {lista.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelId(t.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${t.id === selId ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 font-medium">{t.assunto}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${corStatus(t.status)}`}>
                    {ROTULO_STATUS[t.status as StatusTicket] ?? t.status}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{quando(t.atualizadoEm)}{t.tela ? ` · ${t.tela}` : ""}</div>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {sel ? <DetalheTicket key={sel.id} t={sel} /> : <Card><p className="text-sm text-slate-500">Escolha um pedido na lista.</p></Card>}
    </div>
  );
}

function DetalheTicket({ t }: { t: TicketTela }) {
  const router = useRouter();
  const [salvando, start] = useTransition();
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { prints, avisoPrint, adicionar, aoColar, remover, limpar, paraEnvio } = usePrints();
  const arquivo = useRef<HTMLInputElement>(null);

  function mudar(status: string) {
    setErroStatus(null);
    start(async () => {
      const r = await mudarStatusTicketAction(t.id, status);
      if (!r.ok) setErroStatus(r.erro ?? "Não salvou.");
      else router.refresh();
    });
  }

  async function copiar() {
    if (!t.promptPronto) return;
    try {
      await navigator.clipboard.writeText(t.promptPronto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErroStatus("O navegador não deixou copiar. Selecione o texto e copie à mão.");
    }
  }

  async function responder() {
    if (enviando) return;
    if (!resposta.trim() && !prints.length) { setErro("Escreva a resposta ou cole um print."); return; }
    setEnviando(true); setErro(null);
    const r = await postarSuporte({ acao: "responder", ticketId: t.id, lado: "admin", texto: resposta, anexos: paraEnvio() });
    setEnviando(false);
    if (!r.ok) { setErro(r.erro ?? "Não foi enviada."); return; }
    setResposta(""); limpar(); router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{t.assunto}</h2>
            <p className="text-xs text-slate-500">Aberto em {quando(t.criadoEm)}{t.tela ? ` · tela ${t.tela}` : ""}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Status</span>
            <select
              value={t.status}
              onChange={(e) => mudar(e.target.value)}
              disabled={salvando}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
            >
              {STATUS_TICKET.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
            </select>
            {salvando && <Loader2 size={14} className="animate-spin" />}
          </label>
        </div>
        {erroStatus && <p role="alert" className="mt-2 text-sm text-red-700">{erroStatus}</p>}

        <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {t.mensagens.map((m) => (
            <div key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.lado === "admin" ? "ml-6 bg-slate-900 text-white" : "mr-6 bg-slate-100"}`}>
              <div className={`mb-1 text-[11px] ${m.lado === "admin" ? "text-slate-300" : "text-slate-500"}`}>
                {m.lado === "admin" ? "Suporte" : "Vendedor"} · {quando(m.criadoEm)}
              </div>
              <p className="whitespace-pre-wrap break-words">{m.texto}</p>
              {m.anexos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.anexos.map((a) => (
                    <div key={a.id} className="flex flex-col items-center gap-1">
                      <a href={`/api/suporte/anexo/${a.id}`} target="_blank" rel="noreferrer" className="block h-20 w-20 overflow-hidden rounded-lg border border-slate-300 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/suporte/anexo/${a.id}`} alt={a.nome} loading="lazy" className="h-full w-full object-cover" />
                      </a>
                      <a href={`/api/suporte/anexo/${a.id}?baixar=1`} className="flex items-center gap-0.5 text-[11px] underline">
                        <Download size={11} /> baixar
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
          <label htmlFor={`resp-${t.id}`} className="block text-sm font-medium">Responder como suporte</label>
          <textarea
            id={`resp-${t.id}`}
            value={resposta}
            onChange={(e) => { setResposta(e.target.value); setErro(null); }}
            onPaste={aoColar}
            onKeyDown={(e) => enterEnvia(e, responder)}
            maxLength={LIMITES.resposta}
            rows={2}
            placeholder={DICA_CAMPO}
            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          />
          <MiniaturasPrints prints={prints} remover={remover} />
          {avisoPrint && <p className="text-xs text-amber-700">{avisoPrint}</p>}
          {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => arquivo.current?.click()} className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <ImagePlus size={16} /> Anexar print
            </button>
            <input ref={arquivo} type="file" accept="image/*" multiple hidden onChange={(e) => { void adicionar(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            <button type="button" onClick={responder} disabled={enviando} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {enviando ? "Enviando…" : "Responder"}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-bold">Prompt pronto para o Claude Code</h3>
          <button type="button" onClick={copiar} disabled={!t.promptPronto} className="flex items-center gap-1.5 rounded-xl bg-agro-400 px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50">
            {copiado ? <Check size={15} /> : <Copy size={15} />} {copiado ? "Copiado" : "Copiar prompt"}
          </button>
        </div>
        <p className="mb-2 text-xs text-slate-500">Mude o status para “Aprovado” quando decidir fazer. Baixe os prints acima e anexe junto com o prompt.</p>
        {t.promptPronto ? (
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-100 p-3 text-xs text-slate-800">{t.promptPronto}</pre>
        ) : (
          <p className="text-sm text-amber-700">Este pedido ficou sem prompt pronto. Use a conversa acima como base.</p>
        )}
      </Card>
    </div>
  );
}
