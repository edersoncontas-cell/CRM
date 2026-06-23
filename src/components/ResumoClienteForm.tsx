"use client";

import { useState, useTransition } from "react";
import { atualizarResumoCliente, gerarResumoClienteIA } from "@/lib/actions";
import { Save, ChevronDown, ChevronUp, Pencil, Swords, Brain, Loader2 } from "lucide-react";
import Link from "next/link";

const CONDICAO_OPTS = [
  { value: "pesquisando",       label: "Só pesquisando preço" },
  { value: "interesse_futuro",  label: "Interesse futuro" },
  { value: "avista",            label: "À vista" },
  { value: "financiamento",     label: "Financiamento" },
  { value: "consorcio",         label: "Consórcio" },
];

const CONDICAO_LABEL: Record<string, string> = Object.fromEntries(CONDICAO_OPTS.map((o) => [o.value, o.label]));

type Negociacao = {
  id: string;
  maquinaModelo: string | null;
  valor: number | null;
  condicaoPagamento: string | null;
  concorrenteMencionado: string | null;
  estagio: string;
  status: string;
  termometro: number;
  ultimoContato: string | null;
  motivoPerda: string | null;
};

type Resumo = {
  maquinas: string | null;
  valor: number | null;
  entrada: number | null;
  condicao: string | null;
  texto: string | null;
  proximaVisita: Date | null;
  proximaVisitaNota: string | null;
};

function brl(v: number | null) {
  return v == null ? "" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}
function diasDesde(d: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export function ResumoClienteForm({
  clienteId,
  resumo,
  negociacoes,
}: {
  clienteId: string;
  resumo: Resumo;
  negociacoes: Negociacao[];
}) {
  const [editando, setEditando] = useState(false);
  const [maquinas, setMaquinas] = useState(resumo.maquinas ?? "");
  const [valor, setValor] = useState(resumo.valor != null ? String(resumo.valor) : "");
  const [entrada, setEntrada] = useState(resumo.entrada != null ? String(resumo.entrada) : "");
  const [condicao, setCondicao] = useState(resumo.condicao ?? "");
  const [texto, setTexto] = useState(resumo.texto ?? "");
  const [proximaVisita, setProximaVisita] = useState(
    resumo.proximaVisita ? new Date(resumo.proximaVisita).toISOString().slice(0, 10) : ""
  );
  const [proximaVisitaNota, setProximaVisitaNota] = useState(resumo.proximaVisitaNota ?? "");
  const [salvando, startSalvar] = useTransition();
  const [gerando, startGerar] = useTransition();
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [negsExpand, setNegsExpand] = useState(false);

  function gerarIA() {
    setErroIA(null);
    if (!editando) setEditando(true);
    startGerar(async () => {
      const r = await gerarResumoClienteIA(clienteId);
      if (r.ok && r.resumo) {
        setTexto(r.resumo);
      } else {
        setErroIA(r.erro ?? "Erro ao gerar resumo.");
      }
    });
  }

  function salvar() {
    startSalvar(async () => {
      await atualizarResumoCliente(clienteId, {
        resumoMaquinas: maquinas || undefined,
        resumoValor: valor ? Number(valor.replace(/[^\d,.]/g, "").replace(",", ".")) : null,
        resumoEntrada: entrada ? Number(entrada.replace(/[^\d,.]/g, "").replace(",", ".")) : null,
        resumoCondicao: condicao || undefined,
        resumoTexto: texto || undefined,
        proximaVisita: proximaVisita || null,
        proximaVisitaNota: proximaVisitaNota || undefined,
      });
      setEditando(false);
    });
  }

  const temResumo = maquinas || valor || condicao || texto;

  return (
    <div className="rounded-2xl shadow-sm" style={{ background: "#18181b", border: "1px solid #27272a" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #27272a" }}>
        <h2 className="font-semibold text-zinc-100">Resumo do Cliente</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={gerarIA}
            disabled={gerando}
            title="O Cérebro lê toda a conversa, audios transcritos e atualizações do cliente, gerando um resumo completo"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: gerando ? "#666" : "#BFDE4D", color: "#111" }}
          >
            {gerando ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
            {gerando ? "Gerando resumo…" : "Gerar resumo pelo Cérebro"}
          </button>
          <button
            onClick={() => setEditando((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            <Pencil size={13} /> {editando ? "Cancelar" : "Editar"}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Formulário de edição */}
        {editando ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Máquinas de interesse</label>
              <input
                value={maquinas}
                onChange={(e) => setMaquinas(e.target.value)}
                placeholder="Ex: E215B; E145C EVO"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Valor (R$)</label>
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="Ex: 850000"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Entrada (R$)</label>
                <input
                  value={entrada}
                  onChange={(e) => setEntrada(e.target.value)}
                  placeholder="Ex: 200000"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Condição / situação</label>
              <select
                value={condicao}
                onChange={(e) => setCondicao(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                <option value="">—</option>
                {CONDICAO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Próxima visita</label>
              <input
                type="date"
                value={proximaVisita}
                onChange={(e) => setProximaVisita(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Horário / nota</label>
              <input
                value={proximaVisitaNota}
                onChange={(e) => setProximaVisitaNota(e.target.value)}
                placeholder="O dia todo / 14h"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Resumo geral (IA ou livre)</label>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={4}
                placeholder="Resumo do que foi conversado, situação do cliente, intenção de compra…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 resize-none"
              />
            </div>
            {erroIA && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{erroIA}</p>
            )}
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-bold text-agro-400 hover:bg-brand-800 disabled:opacity-50"
            >
              <Save size={14} /> {salvando ? "Salvando…" : "Salvar resumo"}
            </button>
          </div>
        ) : temResumo ? (
          <div className="space-y-3">
            {maquinas && (
              <div className="flex gap-2 text-sm">
                <span className="font-semibold text-slate-600 shrink-0">Máquinas:</span>
                <span className="text-slate-700">{maquinas}</span>
              </div>
            )}
            {(valor || entrada || condicao) && (
              <div className="flex flex-wrap gap-4 text-sm">
                {valor && <div><span className="font-semibold text-slate-600">Valor: </span><span className="text-slate-700">{brl(Number(valor))}</span></div>}
                {entrada && <div><span className="font-semibold text-slate-600">Entrada: </span><span className="text-slate-700">{brl(Number(entrada))}</span></div>}
                {condicao && <div><span className="font-semibold text-slate-600">Condição: </span><span className="text-slate-700">{CONDICAO_LABEL[condicao] ?? condicao}</span></div>}
              </div>
            )}
            {texto && (
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{texto}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nenhum resumo ainda. Clique em Editar para preencher ou aguarde a IA analisar as conversas do WhatsApp.</p>
        )}

        {/* Negociações legadas (colapsável) */}
        {negociacoes.length > 0 && (
          <div>
            <button
              onClick={() => setNegsExpand((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              {negsExpand ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {negociacoes.length} negociação(ões) no pipeline
            </button>
            {negsExpand && (
              <div className="mt-3 space-y-2">
                {negociacoes.map((n) => {
                  const dias = diasDesde(n.ultimoContato);
                  return (
                    <div key={n.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-700">{n.maquinaModelo ?? "Máquina a definir"}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${n.status === "ganha" ? "bg-green-100 text-green-700" : n.status === "perdida" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                          {n.status === "ganha" ? "ganha" : n.status === "perdida" ? "perdida" : n.estagio}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-slate-500 text-xs">
                        {n.valor && <span>Valor: <b>{brl(n.valor)}</b></span>}
                        {n.condicaoPagamento && <span>{CONDICAO_LABEL[n.condicaoPagamento] ?? n.condicaoPagamento}</span>}
                        {dias != null && <span>{dias}d sem contato</span>}
                        {n.concorrenteMencionado && (
                          <Link href={`/comparativo?modelo=${encodeURIComponent(n.maquinaModelo ?? "")}&vs=${encodeURIComponent(n.concorrenteMencionado)}`}
                            className="flex items-center gap-1 text-red-600 hover:underline"
                          >
                            <Swords size={11} /> vs {n.concorrenteMencionado}
                          </Link>
                        )}
                      </div>
                      {n.motivoPerda && <p className="mt-1 text-xs text-red-600">Motivo da perda: {n.motivoPerda}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
