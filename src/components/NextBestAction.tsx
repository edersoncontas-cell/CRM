"use client";

import { useState, useTransition } from "react";
import { sugerirProximaAcaoCliente, criarTarefaDeAcao } from "@/lib/actions";
import { Target, Loader2, ListPlus, CheckCircle2 } from "lucide-react";

export function NextBestAction({
  clienteId,
  sugestaoInicial = null,
}: {
  clienteId: string;
  sugestaoInicial?: string | null;
}) {
  const [sugestao, setSugestao] = useState<{ acao: string; motivo: string } | null>(
    sugestaoInicial ? { acao: sugestaoInicial, motivo: "" } : null
  );
  const [gerando, startGerar] = useTransition();
  const [criando, startCriar] = useTransition();
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function gerar() {
    setErro(null);
    setFeito(false);
    startGerar(async () => {
      try {
        const r = await sugerirProximaAcaoCliente(clienteId);
        if (r.ok) setSugestao({ acao: r.acao!, motivo: r.motivo ?? "" });
        else setErro(r.erro ?? "Não foi possível sugerir agora.");
      } catch (e) {
        setErro("Erro inesperado ao sugerir a próxima ação.");
        console.error("[NextBestAction] gerar error:", e);
      }
    });
  }

  function criarTarefa() {
    if (!sugestao) return;
    startCriar(async () => {
      await criarTarefaDeAcao(clienteId, sugestao.acao);
      setFeito(true);
    });
  }

  return (
    <div className="rounded-2xl shadow-sm p-5" style={{ background: "#18181b", border: "1px solid #27272a" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target size={16} style={{ color: "#60a5fa" }} />
          <h2 className="font-semibold text-zinc-100">Next Best Action</h2>
        </div>
        <button
          onClick={gerar}
          disabled={gerando}
          title="A IA lê todo o contexto do cliente e sugere a próxima ação concreta"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {gerando ? <Loader2 size={13} className="animate-spin" /> : null}
          {gerando ? "Pensando…" : sugestao ? "Gerar de novo" : "Sugerir próxima ação"}
        </button>
      </div>

      {erro && <p className="text-xs text-red-400">{erro}</p>}

      {sugestao ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-zinc-100">{sugestao.acao}</p>
          {sugestao.motivo && <p className="text-xs text-zinc-500">{sugestao.motivo}</p>}
          {feito ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
              <CheckCircle2 size={13} /> Tarefa criada em Demandas
            </p>
          ) : (
            <button
              onClick={criarTarefa}
              disabled={criando}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              style={{ background: criando ? "#666" : "#BFDE4D", color: "#111" }}
            >
              {criando ? <Loader2 size={13} className="animate-spin" /> : <ListPlus size={13} />}
              {criando ? "Criando…" : "Criar tarefa"}
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Peça à IA para sugerir a próxima ação concreta com este cliente.</p>
      )}
    </div>
  );
}
