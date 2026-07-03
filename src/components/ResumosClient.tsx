"use client";

import { useState, useTransition } from "react";
import { gerarResumoConversa, criarCardDeResumo, agendarDeResumo } from "@/lib/actions";
import { iniciais, diasDesde, cn } from "@/lib/utils";
import {
  Sparkles, Bot, Plus, CalendarPlus, Loader2, Check, ChevronDown, ChevronUp, MessageSquare,
} from "lucide-react";

export type ConversaResumo = {
  id: string;
  nome: string;
  municipio: string | null;
  aguardando: boolean;
  totalMensagens: number;
  previa: string;
  ultimoContato: string;
};

export type ColunaOpcao = {
  id: string;
  titulo: string;
  tipo: "demanda" | "negociacao";
};

export function ResumosClient({
  conversas, colunas,
}: {
  conversas: ConversaResumo[];
  colunas: ColunaOpcao[];
}) {
  const [aberto, setAberto] = useState<string | null>(conversas[0]?.id ?? null);

  return (
    <div className="space-y-3">
      {conversas.map((c) => (
        <ConversaItem
          key={c.id}
          conversa={c}
          colunas={colunas}
          aberto={aberto === c.id}
          onToggle={() => setAberto((a) => (a === c.id ? null : c.id))}
        />
      ))}
    </div>
  );
}

function ConversaItem({
  conversa, colunas, aberto, onToggle,
}: {
  conversa: ConversaResumo;
  colunas: ColunaOpcao[];
  aberto: boolean;
  onToggle: () => void;
}) {
  const [resumo, setResumo] = useState<string>("");
  const [extra, setExtra] = useState<string>("");
  const [gerando, startGerar] = useTransition();
  const [salvando, startSalvar] = useTransition();
  const [coluna, setColuna] = useState<string>(colunas[0]?.id ?? "");
  const [dataVisita, setDataVisita] = useState<string>("");
  const [feedback, setFeedback] = useState<string | null>(null);

  function gerar() {
    setFeedback(null);
    startGerar(async () => {
      const r = await gerarResumoConversa(conversa.id);
      if (r.ok && r.resumo) setResumo(r.resumo);
      else setFeedback(r.erro ?? "Não foi possível gerar o resumo.");
    });
  }

  // Texto final = resumo da IA + informações que o vendedor completou.
  function textoFinal() {
    return [resumo.trim(), extra.trim()].filter(Boolean).join("\n\n");
  }

  function criarCard() {
    if (!coluna) { setFeedback("Escolha uma coluna."); return; }
    setFeedback(null);
    startSalvar(async () => {
      const fd = new FormData();
      fd.set("clienteId", conversa.id);
      fd.set("coluna", coluna);
      fd.set("texto", textoFinal());
      const r = await criarCardDeResumo(fd);
      const col = colunas.find((c) => c.id === coluna);
      setFeedback(r.ok ? `✅ Card criado em "${col?.titulo}".` : "Erro ao criar card.");
    });
  }

  function agendar() {
    if (!dataVisita) { setFeedback("Escolha a data da visita."); return; }
    setFeedback(null);
    startSalvar(async () => {
      const r = await agendarDeResumo(conversa.id, dataVisita, textoFinal());
      setFeedback(r.ok ? "✅ Visita agendada e enviada para a agenda." : r.erro ?? "Erro ao agendar.");
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Cabeçalho clicável */}
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-bold text-brand-700">
          {iniciais(conversa.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold text-slate-900">{conversa.nome}</span>
            {conversa.aguardando && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">aguardando</span>
            )}
          </div>
          <p className="truncate text-xs text-slate-400">
            {conversa.municipio ?? "Sem município"} · {conversa.totalMensagens} msg · {conversa.previa || "—"}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-slate-400">
          {diasDesde(conversa.ultimoContato) === 0 ? "hoje" : `${diasDesde(conversa.ultimoContato)}d`}
        </span>
        {aberto ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {/* Corpo expandido */}
      {aberto && (
        <div className="border-t border-slate-100 px-4 py-4">
          {/* Resumo da IA */}
          {!resumo ? (
            <button
              onClick={gerar}
              disabled={gerando}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {gerando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {gerando ? "Resumindo…" : "Gerar resumo da IA"}
            </button>
          ) : (
            <div className="rounded-xl bg-brand-50 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                <Bot size={13} /> Resumo da IA
                <button onClick={gerar} disabled={gerando} className="ml-auto text-[11px] font-medium text-brand-500 hover:underline">
                  {gerando ? "…" : "regenerar"}
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{resumo}</p>
            </div>
          )}

          {/* Completar informações */}
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Complete com informações que faltaram (opcional)
            </label>
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={2}
              placeholder="Ex: cliente prefere financiamento Finame, tem entrada de 30%…"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>

          {/* Ações */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Criar card */}
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Plus size={15} className="text-agro-600" /> Criar card
              </div>
              <select
                value={coluna}
                onChange={(e) => setColuna(e.target.value)}
                className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-agro-500"
              >
                <optgroup label="Demandas (Trello)">
                  {colunas.filter((c) => c.tipo === "demanda").map((c) => (
                    <option key={c.id} value={c.id}>{c.titulo}</option>
                  ))}
                </optgroup>
                <optgroup label="Funil de negociação">
                  {colunas.filter((c) => c.tipo === "negociacao").map((c) => (
                    <option key={c.id} value={c.id}>{c.titulo}</option>
                  ))}
                </optgroup>
              </select>
              <button
                onClick={criarCard}
                disabled={salvando}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-black py-2 text-sm font-bold text-agro-400 hover:bg-brand-800 disabled:opacity-60"
              >
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Criar card
              </button>
            </div>

            {/* Agendar visita */}
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <CalendarPlus size={15} className="text-brand-600" /> Enviar para a agenda
              </div>
              <input
                type="date"
                value={dataVisita}
                onChange={(e) => setDataVisita(e.target.value)}
                className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
              />
              <button
                onClick={agendar}
                disabled={salvando}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />} Agendar
              </button>
            </div>
          </div>

          {/* Não fazer nada */}
          <div className="mt-3 flex items-center justify-between">
            <a
              href={`/atendimento`}
              className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-brand-600"
            >
              <MessageSquare size={12} /> Abrir conversa
            </a>
            <button
              onClick={onToggle}
              className="text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              Não fazer nada
            </button>
          </div>

          {feedback && (
            <div className={cn(
              "mt-3 rounded-lg px-3 py-2 text-sm",
              feedback.startsWith("✅") ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
            )}>
              {feedback}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
