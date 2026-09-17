"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MapPin, Sparkles, Send, X, Undo2, Loader2, CheckCircle2, AlertTriangle, Phone } from "lucide-react";
import {
  listarClientesDaCidadeAction, gerarTextoAbordagemAction, enviarAbordagemAction, type ClienteAbordagem,
} from "@/lib/abordagem-cidade-actions";
import { personalizarTexto, dividirEmLotes } from "@/lib/abordagem-cidade-regra";

// Abordagem por cidade: escolhe a cidade → aparecem os clientes de lá → o
// vendedor tira da relação quem não quer abordar (só some da lista desta
// vez; trocar de cidade e voltar traz todo mundo de novo) → digita ou gera o
// texto → manda para todos de uma vez.

const campo = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400";

export function AbordagemPorCidade({ cidades }: { cidades: { id: string; nome: string; total: number }[] }) {
  const [municipioId, setMunicipioId] = useState("");
  const [cidade, setCidade] = useState("");
  const [clientes, setClientes] = useState<ClienteAbordagem[]>([]);
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [carregando, iniciarCarga] = useTransition();
  const [texto, setTexto] = useState("");
  const [gerando, setGerando] = useState(false);
  const [origemTexto, setOrigemTexto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ enviados: number; falhas: { nome: string; erro: string }[] } | null>(null);

  function escolherCidade(id: string) {
    setMunicipioId(id);
    setRemovidos(new Set()); // trocar de cidade devolve quem tinha saído
    setResultado(null);
    setClientes([]);
    setCidade("");
    if (!id) return;
    iniciarCarga(async () => {
      const r = await listarClientesDaCidadeAction(id);
      setCidade(r.cidade);
      setClientes(r.clientes);
    });
  }

  function tirar(id: string) { setRemovidos((s) => new Set(s).add(id)); }
  function devolver(id: string) { setRemovidos((s) => { const n = new Set(s); n.delete(id); return n; }); }

  async function gerar() {
    if (!cidade) return;
    setGerando(true);
    const r = await gerarTextoAbordagemAction(cidade).catch(() => null);
    setGerando(false);
    if (!r) { setOrigemTexto("Não consegui gerar agora — escreva o texto."); return; }
    setTexto(r.texto);
    setOrigemTexto(r.geradoPorIA ? "Texto gerado pela IA — revise e ajuste como quiser." : "IA indisponível: usei o modelo padrão — ajuste como quiser.");
  }

  const naLista = clientes.filter((c) => !removidos.has(c.id));
  const foraDaLista = clientes.filter((c) => removidos.has(c.id));
  const comTelefone = naLista.filter((c) => c.telefone);
  const semTelefone = naLista.filter((c) => !c.telefone);
  const exemplo = comTelefone[0] ?? naLista[0];

  async function enviar() {
    if (!texto.trim() || comTelefone.length === 0) return;
    const ok = confirm(`Mandar esta mensagem pelo WhatsApp para ${comTelefone.length} cliente(s) de ${cidade}?\n\n${personalizarTexto(texto, exemplo?.nome ?? "")}`);
    if (!ok) return;
    setEnviando(true);
    setResultado(null);
    const total = { enviados: 0, falhas: [] as { nome: string; erro: string }[] };
    let feitos = 0;
    for (const lote of dividirEmLotes(comTelefone.map((c) => c.id), 3)) {
      setProgresso(`Enviando… ${feitos}/${comTelefone.length}`);
      const r = await enviarAbordagemAction(lote, texto).catch((e) => ({ enviados: [], falhas: lote.map((id) => ({ id, nome: comTelefone.find((c) => c.id === id)?.nome ?? id, erro: e instanceof Error ? e.message : "falha" })) }));
      total.enviados += r.enviados.length;
      total.falhas.push(...r.falhas.map((f) => ({ nome: f.nome, erro: f.erro })));
      feitos += lote.length;
    }
    setProgresso(null);
    setEnviando(false);
    setResultado(total);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* Coluna 1: cidade + relação */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Cidade</label>
          <select value={municipioId} onChange={(e) => escolherCidade(e.target.value)} className={campo}>
            <option value="">— Escolher a cidade —</option>
            {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.total}</option>)}
          </select>

          {carregando && <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Loader2 size={12} className="animate-spin" /> Buscando clientes…</p>}

          {!carregando && municipioId && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
                <span>Na relação · {naLista.length}</span>
                {semTelefone.length > 0 && <span className="normal-case font-semibold text-amber-600">{semTelefone.length} sem telefone</span>}
              </div>
              {naLista.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-400">{clientes.length === 0 ? "Nenhum cliente com esta cidade no cadastro." : "Você tirou todo mundo da relação."}</p>
              ) : (
                <ul className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
                  {naLista.map((c) => (
                    <li key={c.id} className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${c.telefone ? "border-slate-100 bg-white" : "border-amber-100 bg-amber-50/60"}`}>
                      <div className="min-w-0 flex-1">
                        <Link href={`/clientes/${c.id}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-600">{c.nome}</Link>
                        <p className="truncate text-[11px] text-slate-400">
                          {c.telefone ? <><Phone size={9} className="inline" /> {c.telefone}</> : "sem telefone"}
                          {c.ultimaVisita ? ` · visitado em ${c.ultimaVisita}` : c.visitado ? " · já visitado" : " · nunca visitado"}
                          {c.diasSemContato != null && ` · ${c.diasSemContato}d sem contato`}
                        </p>
                      </div>
                      <button type="button" onClick={() => tirar(c.id)} title="Tirar da relação (não apaga o cliente)" className="rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {foraDaLista.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Fora da relação desta vez · {foraDaLista.length}</div>
                  <ul className="space-y-1">
                    {foraDaLista.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-400">
                        <span className="min-w-0 flex-1 truncate line-through">{c.nome}</span>
                        <button type="button" onClick={() => devolver(c.id)} className="flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Undo2 size={11} /> voltar</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Coluna 2: texto + envio */}
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Mensagem para todos</label>
            <button type="button" onClick={gerar} disabled={!cidade || gerando || enviando} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {gerando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Gerar texto com IA
            </button>
          </div>
          <textarea
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setOrigemTexto(null); }}
            rows={6}
            disabled={enviando}
            placeholder={cidade ? `Escreva a mensagem (use {nome} onde entra o primeiro nome) ou clique em "Gerar texto com IA".` : "Escolha a cidade primeiro."}
            className={campo}
          />
          <p className="mt-1 text-[11px] text-slate-400">{origemTexto ?? "Dica: {nome} vira o primeiro nome de cada cliente."}</p>

          {exemplo && texto.trim() && (
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Como {exemplo.nome.split(" ")[0]} vai receber</div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{personalizarTexto(texto, exemplo.nome)}</p>
            </div>
          )}

          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !texto.trim() || comTelefone.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50"
          >
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {progresso ?? (comTelefone.length ? `Enviar para ${comTelefone.length} cliente(s) de ${cidade}` : "Enviar pelo WhatsApp")}
          </button>

          {resultado && (
            <div className={`mt-3 rounded-xl p-3 text-sm ${resultado.falhas.length === 0 ? "bg-green-50 text-green-800" : resultado.enviados === 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
              <div className="flex items-center gap-1.5 font-bold">
                {resultado.falhas.length === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                {resultado.enviados} enviada(s){resultado.falhas.length ? ` · ${resultado.falhas.length} falhou(aram)` : ""}
              </div>
              {resultado.falhas.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {resultado.falhas.map((f, i) => <li key={i}><b>{f.nome}</b>: {f.erro}</li>)}
                </ul>
              )}
              {resultado.enviados > 0 && <p className="mt-1 text-xs opacity-80">As respostas chegam no <Link href="/atendimento" className="underline">Atendimento</Link> — daí é só marcar as visitas.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
