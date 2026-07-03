"use client";

import { useState, useTransition } from "react";
import { atualizarResumoCliente, criarNegociacaoCompleta, gerarResumoClienteIA } from "@/lib/actions";
import { Save, ChevronDown, ChevronUp, Pencil, Swords, Brain, Loader2, PlusCircle } from "lucide-react";
import Link from "next/link";

const CONDICAO_OPTS = [
  { value: "pesquisando", label: "Só pesquisando preço" },
  { value: "interesse_futuro", label: "Interesse futuro" },
  { value: "avista", label: "À vista" },
  { value: "financiamento", label: "Financiamento" },
  { value: "consorcio", label: "Consórcio" },
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
  temConversa = false,
}: {
  clienteId: string;
  resumo: Resumo;
  negociacoes: Negociacao[];
  temConversa?: boolean;
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
  const [novaNegoOpen, setNovaNegoOpen] = useState(false);

  // CORREÇÃO: NÃO auto-gera resumo ao montar — isso causava erro de página.
  // O botão "Gerar resumo pelo Cérebro" fica visível para o usuário acionar manualmente.

  function gerarIA() {
    setErroIA(null);
    if (!editando) setEditando(true);
    startGerar(async () => {
      try {
        const r = await gerarResumoClienteIA(clienteId);
        if (r.ok && r.resumo) {
          setTexto(r.resumo);
        } else {
          setErroIA(r.erro ?? "Erro ao gerar resumo.");
        }
      } catch (e) {
        setErroIA("Erro inesperado ao gerar resumo. Tente novamente.");
        console.error("[ResumoClienteForm] gerarIA error:", e);
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
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #27272a" }}>
        <h2 className="font-semibold text-zinc-100">Resumo do Cliente</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={gerarIA} disabled={gerando} title="O Cérebro lê toda a conversa e gera um resumo completo"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: gerando ? "#666" : "#BFDE4D", color: "#111" }}>
            {gerando ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
            {gerando ? "Gerando resumo…" : "Gerar resumo pelo Cérebro"}
          </button>
          <button onClick={() => setEditando((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">
            <Pencil size={13} /> {editando ? "Cancelar" : "Editar"}
          </button>
          <button onClick={() => setNovaNegoOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
            <PlusCircle size={13} /> Gerar Negociação
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {temConversa && !temResumo && (
          <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 flex items-center gap-2">
            <Brain size={16} className="text-brand-600 shrink-0" />
            <p className="text-xs text-brand-700">Este cliente tem conversa no WhatsApp. Clique em <b>Gerar resumo pelo Cérebro</b> para criar um resumo automático.</p>
          </div>
        )}

        {editando ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Máquinas de interesse</label>
              <input value={maquinas} onChange={(e) => setMaquinas(e.target.value)} placeholder="Ex: E215B; E145C EVO"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Valor (R$)</label>
                <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: 850000" inputMode="numeric"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Entrada (R$)</label>
                <input value={entrada} onChange={(e) => setEntrada(e.target.value)} placeholder="Ex: 200000" inputMode="numeric"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Condição / situação</label>
              <select value={condicao} onChange={(e) => setCondicao(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500">
                <option value="">—</option>
                {CONDICAO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Próxima visita</label>
              <input type="date" value={proximaVisita} onChange={(e) => setProximaVisita(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Horário / nota</label>
              <input value={proximaVisitaNota} onChange={(e) => setProximaVisitaNota(e.target.value)} placeholder="O dia todo / 14h"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Resumo geral (IA ou livre)</label>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4}
                placeholder="Resumo do que foi conversado, situação do cliente, intenção de compra…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 resize-none" />
            </div>
            {erroIA && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{erroIA}</p>
            )}
            <button onClick={salvar} disabled={salvando}
              className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-bold text-agro-400 hover:bg-brand-800 disabled:opacity-50">
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
            {texto && <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{texto}</p>}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nenhum resumo ainda. Clique em Editar para preencher ou use o botão do Cérebro para gerar automaticamente.</p>
        )}

        {negociacoes.length > 0 && (
          <div>
            <button onClick={() => setNegsExpand((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600">
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
                            className="flex items-center gap-1 text-red-600 hover:underline">
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
      {novaNegoOpen && (
        <NovaNegoModalInline clienteId={clienteId} onClose={() => setNovaNegoOpen(false)} />
      )}
    </div>
  );
}

// ─── Modal Gerar Negociação (no cadastro do cliente) ─────────────────────────
const BANCOS_OPCOES = ["Banco CNH","Sicoob","Sicredi","Bradesco","Banestes","Banco do Nordeste","Banco do Brasil","Banco Itaú","Outros Bancos"];
const NH_MODELS = ["E145C","E215C","E265C","E305C","E385C","W130C","W170C","B95C","B110C","B115C","RG140B","RG170B","D150B","D180B"];
const DY_MODELS = ["CC1200","CC1300","CC900","CP1200","CA1500","CA3500","CS1400","F141C","F181C"];

function fmtBRL(v: string): string {
  const n = v.replace(/\D/g, "");
  if (!n) return "";
  return parseInt(n, 10).toLocaleString("pt-BR");
}

function NovaNegoModalInline({ clienteId, onClose }: { clienteId: string; onClose: () => void }) {
  const [marca, setMarca] = useState("");
  const [maquina, setMaquina] = useState("");
  const [valor, setValor] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [banco, setBanco] = useState("");
  const [entradaValor, setEntradaValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const models = marca === "New Holland" ? NH_MODELS : marca === "Dynapac" ? DY_MODELS : [];
  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const valorNum = parseFloat(valor.replace(/\./g,"").replace(",",".")) || 0;
      const entradaNum = parseFloat(entradaValor.replace(/\./g,"").replace(",",".")) || 0;
      const fd = new FormData();
      fd.set("clienteId", clienteId);
      fd.set("marca", marca);
      fd.set("maquinaModelo", maquina);
      fd.set("valor", String(valorNum));
      fd.set("tipoPagamento", pagamento);
      if (banco) fd.set("bancoFinanciamento", banco);
      if (entradaNum) fd.set("entradaValor", String(entradaNum));
      await criarNegociacaoCompleta(fd);
      onClose();
      window.location.reload();
    } catch {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between sticky top-0">
          <h3 className="text-lg font-bold text-white">Gerar Negociação</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">MARCA</label>
              <select value={marca} onChange={(e) => { setMarca(e.target.value); setMaquina(""); }} className={inputCls} required>
                <option value="">Selecionar marca...</option>
                <option>New Holland</option>
                <option>Dynapac</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">MÁQUINA</label>
              <select value={maquina} onChange={(e) => setMaquina(e.target.value)} className={inputCls} required>
                <option value="">Selecionar...</option>
                {models.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">VALOR (R$)</label>
            <input value={valor} onChange={(e) => setValor(fmtBRL(e.target.value))} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">PAGAMENTO</label>
            <select value={pagamento} onChange={(e) => setPagamento(e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="avista">À vista</option>
              <option value="financiamento">Financiamento</option>
              <option value="consorcio">Consórcio</option>
              <option value="crd_pme">CRD PME</option>
            </select>
          </div>
          {pagamento === "financiamento" && (
            <div className="rounded-xl bg-violet-50 border border-violet-200 p-4 space-y-3">
              <p className="text-xs font-bold text-violet-700 uppercase">Financiamento</p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">BANCO</label>
                <select value={banco} onChange={(e) => setBanco(e.target.value)} className={inputCls}>
                  <option value="">— Selecionar —</option>
                  {BANCOS_OPCOES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ENTRADA (R$)</label>
                <input value={entradaValor} onChange={(e) => setEntradaValor(fmtBRL(e.target.value))} placeholder="0" className={inputCls} />
              </div>
            </div>
          )}
          {pagamento === "crd_pme" && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
              <p className="text-xs font-bold text-emerald-700 uppercase">CRD PME</p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ENTRADA (R$)</label>
                <input value={entradaValor} onChange={(e) => setEntradaValor(fmtBRL(e.target.value))} placeholder="0" className={inputCls} />
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {salvando ? "Criando..." : "Criar Negociação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
