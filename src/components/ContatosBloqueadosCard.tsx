"use client";

import { useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui";
import {
  limparContatosIndesejadosAction, adicionarTermoFiltroAction, removerTermoFiltroAction, assistenteFiltroAction,
  type ListasFiltro, type RespostaAssistenteFiltro,
} from "@/lib/bloqueio-actions";
import type { ResultadoLimpeza } from "@/lib/contatos-bloqueados";
import type { TipoTermoBloqueio } from "@/lib/filtro-contatos";
import { Ban, Loader2, Plus, X, Sparkles, Send } from "lucide-react";

type Recente = { nome: string | null; telefone: string; motivo: string | null; criadoEm: string };

// Espaço de configuração de Clientes/WhatsApp: o filtro de contatos que não
// são clientes. Dá para editar na mão (caixinhas) ou pedir em português para
// o assistente ("bloqueia despachante", "libera hotel"), que aplica na hora.
export function ContatosBloqueadosCard({ termos, palavras, total, recentes }: { termos: string[]; palavras: string[]; total: number; recentes: Recente[] }) {
  const [listas, setListas] = useState<ListasFiltro>({ termos, palavras });
  const [resultado, setResultado] = useState<ResultadoLimpeza | null>(null);
  const [rodando, start] = useTransition();
  const [comando, setComando] = useState("");
  const [pensando, setPensando] = useState(false);
  const [historico, setHistorico] = useState<{ pedido: string; r: RespostaAssistenteFiltro }[]>([]);

  function limpar() {
    start(async () => { setResultado(await limparContatosIndesejadosAction()); });
  }

  async function adicionar(tipo: TipoTermoBloqueio, valores: string[]) {
    let atual = listas;
    for (const v of valores) atual = await adicionarTermoFiltroAction(tipo, v);
    setListas(atual);
  }

  async function remover(tipo: TipoTermoBloqueio, valor: string) {
    setListas(await removerTermoFiltroAction(tipo, valor));
  }

  async function pedir() {
    const texto = comando.trim();
    if (!texto || pensando) return;
    setPensando(true);
    try {
      const r = await assistenteFiltroAction(texto);
      setListas(r.listas);
      setHistorico((h) => [{ pedido: texto, r }, ...h].slice(0, 5));
      setComando("");
    } finally {
      setPensando(false);
    }
  }

  return (
    <Card className="mt-6">
      <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
        <Ban size={18} className="text-red-500" /> Contatos que não são clientes
      </div>
      <p className="text-sm text-slate-600">
        Contatos cujo nome bate com uma destas regras nunca entram no CRM (WhatsApp, importação ou Google Contatos) e, se já
        existirem, são apagados com todo o histórico: conversas, mensagens, negociações e visitas. O telefone fica bloqueado
        para não voltar, e nada deles conta nos relatórios. A limpeza roda sozinha a cada hora.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ListaTermos tipo="palavra" titulo="Palavras inteiras" dica='Bate só como palavra inteira: "banco" pega "Banco do Brasil", não pega "Bancorbrás".' exemplo="ex.: despachante" itens={listas.palavras} onAdicionar={adicionar} onRemover={remover} />
        <ListaTermos tipo="termo" titulo="Pedaços de palavra" dica='Bate dentro de qualquer palavra: "contab" pega contabilidade, contábil, contábeis.' exemplo="ex.: cartor" itens={listas.termos} onAdicionar={adicionar} onRemover={remover} />
      </div>

      {/* Assistente de configuração */}
      <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Sparkles size={15} className="text-brand-600" /> Assistente de configuração</div>
        <p className="mb-2 text-[11px] text-slate-500">
          Peça em português e ele muda as regras na hora — ex.: &quot;bloqueia quem tem despachante ou cartório no nome&quot;, &quot;libera hotel&quot;,
          &quot;o que está bloqueado hoje?&quot;. Ele avisa quantos cadastros já existentes vão cair na próxima limpeza, mas não apaga nada sozinho.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); pedir(); }} className="flex gap-1.5">
          <input value={comando} onChange={(e) => setComando(e.target.value)} placeholder="O que você quer mudar no filtro?" disabled={pensando}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 disabled:opacity-60" />
          <button type="submit" disabled={!comando.trim() || pensando} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {pensando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {pensando ? "Entendendo…" : "Pedir"}
          </button>
        </form>
        {historico.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {historico.map(({ pedido, r }, i) => {
              const mudou = r.adicionados.length + r.removidos.length > 0;
              return (
                <li key={`${i}-${pedido}`} className="rounded-lg bg-white px-3 py-2 text-sm">
                  <div className="text-[11px] text-slate-400">Você: {pedido}</div>
                  <div className="text-slate-700">{r.resposta || (mudou ? "Feito." : "Nada a mudar.")}</div>
                  {mudou && (
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      {r.adicionados.map((m) => <span key={`+${m.tipo}:${m.valor}`} className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">+ {m.valor} <span className="font-normal text-red-400">({m.tipo})</span></span>)}
                      {r.removidos.map((m) => <span key={`-${m.tipo}:${m.valor}`} className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">− {m.valor} <span className="font-normal text-emerald-500">({m.tipo})</span></span>)}
                    </div>
                  )}
                  {r.adicionados.length > 0 && (r.impacto.clientes + r.impacto.conversas > 0) && (
                    <div className="mt-1 text-[11px] text-amber-700">
                      Com isso, {r.impacto.clientes} cliente(s) e {r.impacto.conversas} conversa(s) que já estão no CRM vão ser apagados na próxima limpeza (ou clique em &quot;Limpar agora&quot;).
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={limpar} disabled={rodando} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
          {rodando ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Limpar agora
        </button>
        <span className="text-xs text-slate-500">{total} telefone(s) bloqueado(s)</span>
      </div>
      {resultado && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Apagados: {resultado.clientes} cliente(s), {resultado.conversas} conversa(s) e {resultado.mensagens} mensagem(ns) · {resultado.bloqueados} telefone(s) bloqueado(s) agora.
          {resultado.clientes + resultado.conversas === 0 && " Nada a apagar: o CRM já estava limpo."}
        </p>
      )}
      {recentes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {recentes.map((r) => (
            <li key={r.telefone}>
              <span className="font-semibold text-slate-700">{r.nome ?? "(sem nome)"}</span> · {r.telefone}{r.motivo ? ` · termo "${r.motivo}"` : ""} · {new Date(r.criadoEm).toLocaleDateString("pt-BR")}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Fica fora do card de propósito: definido dentro do render, o React remontava
// o input a cada tecla e o campo perdia o foco depois de uma letra.
function ListaTermos({ tipo, titulo, dica, exemplo, itens, onAdicionar, onRemover }: {
  tipo: TipoTermoBloqueio; titulo: string; dica: string; exemplo: string; itens: string[];
  onAdicionar: (tipo: TipoTermoBloqueio, valores: string[]) => Promise<void>;
  onRemover: (tipo: TipoTermoBloqueio, valor: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const existentes = new Set(itens.map((t) => t.trim().toLowerCase()));
  const digitados = texto.split(/[,;\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const novos = Array.from(new Set(digitados)).filter((v) => !existentes.has(v));
  const repetidos = digitados.filter((v) => existentes.has(v));

  async function adicionar() {
    if (ocupado || novos.length === 0) {
      if (repetidos.length > 0) setAviso(`"${repetidos[0]}" já está na lista.`);
      return;
    }
    setOcupado("add");
    setAviso(null);
    try {
      await onAdicionar(tipo, novos);
      setTexto("");
      if (repetidos.length > 0) setAviso(`Adicionado. "${repetidos[0]}" já estava na lista.`);
    } catch {
      setAviso("Não consegui salvar agora. Tente de novo.");
    } finally {
      setOcupado(null);
      campo.current?.focus();
    }
  }

  async function remover(valor: string) {
    setOcupado(valor);
    setAviso(null);
    try { await onRemover(tipo, valor); }
    catch { setAviso("Não consegui remover agora. Tente de novo."); }
    finally { setOcupado(null); }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="text-sm font-semibold text-slate-700">{titulo}</div>
      <div className="mb-2 text-[11px] text-slate-500">{dica}</div>
      <div className="flex flex-wrap gap-1.5">
        {itens.length === 0 && <span className="text-xs text-slate-400">Nenhum.</span>}
        {itens.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-red-50 pl-2.5 pr-1 py-0.5 text-xs font-semibold text-red-700">
            {t}
            <button type="button" onClick={() => remover(t)} disabled={ocupado !== null} title="Remover" className="rounded-full p-0.5 hover:bg-red-100 disabled:opacity-50">
              {ocupado === t ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); adicionar(); }} className="mt-2 flex gap-1.5">
        <input ref={campo} value={texto} onChange={(e) => { setTexto(e.target.value); if (aviso) setAviso(null); }} placeholder={`${exemplo} (vários: separe por vírgula)`}
          autoComplete="off" autoCapitalize="none" spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-400" />
        <button type="submit" disabled={novos.length === 0 || ocupado === "add"} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
          {ocupado === "add" ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} {novos.length > 1 ? `Adicionar ${novos.length}` : "Adicionar"}
        </button>
      </form>
      {aviso && <div className="mt-1 text-[11px] text-amber-700">{aviso}</div>}
    </div>
  );
}
