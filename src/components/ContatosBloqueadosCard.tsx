"use client";

import { useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui";
import {
  limparContatosIndesejadosAction, adicionarPalavraFiltroAction, removerPalavraFiltroAction, assistenteFiltroAction,
  liberarLapideAction,
  type ListasFiltro, type RespostaAssistenteFiltro,
} from "@/lib/bloqueio-actions";
import type { ResultadoLimpeza } from "@/lib/contatos-bloqueados";
import { MOTIVO_EXCLUIDO_MANUAL, palavraCurtaDemais, semAcento } from "@/lib/utils";
import { Ban, Loader2, Plus, X, Sparkles, Send } from "lucide-react";

type Recente = { id: string; nome: string | null; telefone: string | null; motivo: string | null; criadoEm: string };

// Espaço de configuração de Clientes/WhatsApp: o filtro de contatos que não
// são clientes. Uma lista só, de palavras inteiras (01/10: a de "pedaços de
// palavra" saiu a pedido dele). Dá para editar na mão (o campo) ou pedir em
// português para o assistente ("bloqueia despachante", "libera hotel").
export function ContatosBloqueadosCard({ palavras, total, recentes }: { palavras: string[]; total: number; recentes: Recente[] }) {
  const [listas, setListas] = useState<ListasFiltro>({ palavras });
  const [resultado, setResultado] = useState<ResultadoLimpeza | null>(null);
  const [rodando, start] = useTransition();
  const [comando, setComando] = useState("");
  const [pensando, setPensando] = useState(false);
  const [historico, setHistorico] = useState<{ pedido: string; r: RespostaAssistenteFiltro }[]>([]);
  const [liberados, setLiberados] = useState<string[]>([]);
  const [liberando, setLiberando] = useState<string | null>(null);

  async function liberar(id: string) {
    setLiberando(id);
    try {
      const r = await liberarLapideAction(id);
      if (r.ok) setLiberados((v) => [...v, id]);
    } finally {
      setLiberando(null);
    }
  }

  function limpar() {
    start(async () => { setResultado(await limparContatosIndesejadosAction()); });
  }

  async function adicionar(valores: string[]) {
    let atual = listas;
    for (const v of valores) atual = await adicionarPalavraFiltroAction(v);
    setListas(atual);
  }

  async function remover(valor: string) {
    setListas(await removerPalavraFiltroAction(valor));
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
        Contatos que têm no nome uma destas palavras nunca entram no CRM (WhatsApp, importação ou Google Contatos) e, se já
        existirem, são apagados com todo o histórico: conversas, mensagens, negociações e visitas. Cada um fica barrado por
        telefone, nome e id no Google — então contato de empresa, que costuma vir sem número, também não volta. Nada deles
        conta nos relatórios, e a limpeza roda sozinha a cada hora.
      </p>

      <div className="mt-3">
        <ListaPalavras itens={listas.palavras} onAdicionar={adicionar} onRemover={remover} />
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
                      {r.adicionados.map((m) => <span key={`+${m.valor}`} className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">+ {m.valor}</span>)}
                      {r.removidos.map((m) => <span key={`-${m.valor}`} className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">− {m.valor}</span>)}
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
        <span className="text-xs text-slate-500">{total} contato(s) barrado(s)</span>
      </div>
      {resultado && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Apagados: {resultado.clientes} cliente(s), {resultado.conversas} conversa(s) e {resultado.mensagens} mensagem(ns) · {resultado.bloqueados} contato(s) barrado(s) agora.
          {resultado.clientes + resultado.conversas === 0 && " Nada a apagar: o CRM já estava limpo."}
          {resultado.clientes + resultado.conversas > 0 && " Dá para desfazer: o recibo fica no histórico do cartão \"Cadastros sem identidade\", aqui em Configurações."}
        </p>
      )}
      {/* Quem a lista pegou mas tem vida comercial: fica (lib/limpeza-protecao.ts). */}
      {resultado && resultado.totalPoupados > 0 && (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <b>{resultado.totalPoupados} contato(s) ficaram</b>: batem com a lista de bloqueio, mas têm negociação, visita, pós-venda
          ou compra. Se algum não é cliente, exclua à mão na lista de Clientes. Se a lista está pegando gente demais, tire a palavra larga.
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs">
            {resultado.poupados.map((p, i) => (
              <li key={i}><b>{p.nome}</b> <span className="text-amber-700/80">— {p.motivo}</span></li>
            ))}
            {resultado.totalPoupados > resultado.poupados.length && <li>… e mais {resultado.totalPoupados - resultado.poupados.length}.</li>}
          </ul>
        </div>
      )}
      {/* Os últimos contatos barrados — e a saída para o engano. Excluir um
          cadastro é um clique; sem um lugar onde desfazer, o contato errado
          ficaria barrado para sempre e o vendedor não teria como saber por
          que ele nunca mais apareceu. */}
      {recentes.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Últimos barrados</div>
          <ul className="max-h-48 space-y-1 overflow-y-auto pr-1 text-xs text-slate-500">
            {recentes.filter((r) => !liberados.includes(r.id)).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  <span className="font-semibold text-slate-700">{r.nome ?? "(sem nome)"}</span>
                  {r.telefone ? ` · ${r.telefone}` : " · sem telefone"}
                  {r.motivo ? ` · ${r.motivo === MOTIVO_EXCLUIDO_MANUAL ? "excluído por você" : `palavra "${r.motivo}"`}` : ""}
                  {` · ${new Date(r.criadoEm).toLocaleDateString("pt-BR")}`}
                </span>
                <button
                  type="button"
                  onClick={() => liberar(r.id)}
                  disabled={liberando === r.id}
                  title="Liberar: este contato volta a poder entrar no CRM"
                  className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                >
                  {liberando === r.id ? "…" : "Liberar"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// Fica fora do card de propósito: definido dentro do render, o React remontava
// o input a cada tecla e o campo perdia o foco depois de uma letra.
//
// Campo livre: escreve o que quiser, uma palavra ou várias separadas por
// vírgula, e Enter ou o botão adiciona. O botão nunca fica cinza parecendo
// travado (01/10, o print dele): o que não dá para adicionar ganha um aviso.
function ListaPalavras({ itens, onAdicionar, onRemover }: {
  itens: string[];
  onAdicionar: (valores: string[]) => Promise<void>;
  onRemover: (valor: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  async function adicionar() {
    if (ocupado) return;
    // "escritorio" e "escritório" são a mesma palavra para o filtro.
    const chave = (v: string) => semAcento(v).trim().replace(/\s+/g, " ");
    const existentes = new Set(itens.map(chave));
    const digitados = Array.from(new Set(texto.split(/[,;\n]+/).map((s) => s.trim().replace(/\s+/g, " ").toLowerCase()).filter(Boolean)));
    const curtas = digitados.filter(palavraCurtaDemais);
    const repetidas = digitados.filter((v) => existentes.has(chave(v)));
    const novas = digitados.filter((v) => !existentes.has(chave(v)) && !palavraCurtaDemais(v));
    const sobre = [
      curtas.length > 0 ? `${curtas.map((c) => `"${c}"`).join(", ")} ${curtas.length > 1 ? "são curtas" : "é curta"} demais: com menos de 3 letras o filtro pegaria nomes como "José da Silva" e apagaria cliente.` : "",
      repetidas.length > 0 ? `${repetidas.map((c) => `"${c}"`).join(", ")} já ${repetidas.length > 1 ? "estão" : "está"} na lista.` : "",
    ].filter(Boolean).join(" ");
    if (novas.length === 0) {
      setAviso(sobre || "Escreva a palavra que você quer barrar — ex.: despachante.");
      campo.current?.focus();
      return;
    }
    setOcupado("add");
    setAviso(null);
    try {
      await onAdicionar(novas);
      // O que não entrou continua no campo, para ele corrigir.
      setTexto(curtas.join(", "));
      setAviso(sobre ? `${novas.length > 1 ? `${novas.length} palavras adicionadas` : `"${novas[0]}" adicionada`}. ${sobre}` : null);
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
    try { await onRemover(valor); }
    catch { setAviso("Não consegui remover agora. Tente de novo."); }
    finally { setOcupado(null); }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="text-sm font-semibold text-slate-700">Palavras <span className="font-normal text-slate-400">({itens.length})</span></div>
      <div className="mb-2 text-[11px] text-slate-500">
        Vale a palavra inteira: &quot;banco&quot; pega &quot;Banco do Brasil&quot;, não pega &quot;Bancorbrás&quot;. Pode ter mais de uma palavra: &quot;new holland&quot; pega &quot;New Holland Vitória&quot;. Acento e maiúscula não importam.
      </div>
      <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {itens.length === 0 && <span className="text-xs text-slate-400">Nenhuma palavra: nenhum contato é barrado pelo nome.</span>}
        {itens.map((t) => (
          <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-red-50 py-0.5 pl-2.5 pr-0.5 text-xs font-semibold text-red-700 sm:gap-1 sm:pr-1">
            {t}
            {/* A regra global de 44 px para botão no celular deixava cada palavra
                do tamanho de um botão e a lista de 35 palavras não cabia na tela:
                28 px ainda dá para acertar com o dedo. */}
            <button type="button" onClick={() => remover(t)} disabled={ocupado !== null} title={`Tirar "${t}" do filtro`} aria-label={`Tirar "${t}" do filtro`} className="inline-flex min-h-[28px] min-w-[28px] items-center justify-center rounded-full p-0.5 hover:bg-red-100 disabled:opacity-50 sm:min-h-0 sm:min-w-0">
              {ocupado === t ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); adicionar(); }} className="mt-2 flex gap-1.5">
        <input ref={campo} value={texto} onChange={(e) => { setTexto(e.target.value); if (aviso) setAviso(null); }}
          placeholder="Escreva a palavra (ex.: despachante, cartório)" aria-label="Palavra para barrar"
          autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="done"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-400" />
        <button type="submit" disabled={ocupado === "add"} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-60">
          {ocupado === "add" ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Adicionar
        </button>
      </form>
      {aviso && <div role="status" className="mt-1 text-[11px] text-amber-700">{aviso}</div>}
    </div>
  );
}
