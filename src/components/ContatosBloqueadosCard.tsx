"use client";

import { useState, useTransition } from "react";
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
  const [novo, setNovo] = useState<{ termo: string; palavra: string }>({ termo: "", palavra: "" });
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [comando, setComando] = useState("");
  const [pensando, setPensando] = useState(false);
  const [historico, setHistorico] = useState<{ pedido: string; r: RespostaAssistenteFiltro }[]>([]);

  function limpar() {
    start(async () => { setResultado(await limparContatosIndesejadosAction()); });
  }

  async function adicionar(tipo: TipoTermoBloqueio) {
    const valor = novo[tipo].trim();
    if (!valor) return;
    setOcupado(`add:${tipo}`);
    try { setListas(await adicionarTermoFiltroAction(tipo, valor)); setNovo((n) => ({ ...n, [tipo]: "" })); }
    finally { setOcupado(null); }
  }

  async function remover(tipo: TipoTermoBloqueio, valor: string) {
    setOcupado(`${tipo}:${valor}`);
    try { setListas(await removerTermoFiltroAction(tipo, valor)); }
    finally { setOcupado(null); }
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

  const Lista = ({ tipo, titulo, dica, itens }: { tipo: TipoTermoBloqueio; titulo: string; dica: string; itens: string[] }) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="text-sm font-semibold text-slate-700">{titulo}</div>
      <div className="mb-2 text-[11px] text-slate-500">{dica}</div>
      <div className="flex flex-wrap gap-1.5">
        {itens.length === 0 && <span className="text-xs text-slate-400">Nenhum.</span>}
        {itens.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-red-50 pl-2.5 pr-1 py-0.5 text-xs font-semibold text-red-700">
            {t}
            <button type="button" onClick={() => remover(tipo, t)} disabled={ocupado === `${tipo}:${t}`} title="Remover" className="rounded-full p-0.5 hover:bg-red-100 disabled:opacity-50">
              {ocupado === `${tipo}:${t}` ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); adicionar(tipo); }} className="mt-2 flex gap-1.5">
        <input value={novo[tipo]} onChange={(e) => setNovo((n) => ({ ...n, [tipo]: e.target.value }))} placeholder={tipo === "termo" ? "ex.: cartor" : "ex.: despachante"}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400" />
        <button type="submit" disabled={!novo[tipo].trim() || ocupado === `add:${tipo}`} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
          {ocupado === `add:${tipo}` ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Adicionar
        </button>
      </form>
    </div>
  );

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
        <Lista tipo="palavra" titulo="Palavras inteiras" dica='Bate só como palavra inteira: "banco" pega "Banco do Brasil", não pega "Bancorbrás".' itens={listas.palavras} />
        <Lista tipo="termo" titulo="Pedaços de palavra" dica='Bate dentro de qualquer palavra: "contab" pega contabilidade, contábil, contábeis.' itens={listas.termos} />
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
