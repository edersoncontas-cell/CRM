"use client";

// Etapas da Venda: o manual de campo de cada etapa (o que fazer, o que
// identificar, o que perguntar, o que falar e o que responder) + o simulador,
// em que a Academia monta a cena e você escolhe o que falar — e a escolha
// muda a cena seguinte.

import { useMemo, useState } from "react";
import {
  Target, Eye, HelpCircle, MessageSquare, Shield, XCircle, CheckCircle2, BarChart3, ChevronDown,
  Play, RotateCcw, Sparkles, Loader2, Trophy, AlertTriangle, Settings2, Plus, Trash2, Wand2, MessagesSquare, Phone, MapPin, Inbox,
} from "lucide-react";
import { ETAPAS, ROTULO_CANAL, type EtapaVenda, type Canal } from "@/lib/academia/etapas";
import {
  CENARIOS_POR_ID, cenariosIniciais, cenariosDaEtapa, pontuacao, veredito,
  type CenarioSimulador, type OpcaoSimulador, type EscolhaFeita,
} from "@/lib/academia/simulador";
import { gerarCenarioSimuladorAction, adicionarRealidadeAction, removerRealidadeAction, escreverRegraComIAAction } from "@/lib/academia/acoes";
import type { RegraNegocio } from "@/lib/contexto-negocio";
import { cn } from "@/lib/utils";

const ICONE_CANAL: Record<Canal, typeof MessagesSquare> = {
  mensagem: MessagesSquare,
  telefone: Phone,
  presencial: MapPin,
  recebido: Inbox,
};

const COR_QUALIDADE = {
  boa: { fundo: "bg-emerald-50", borda: "border-emerald-300", texto: "text-emerald-800", rotulo: "Boa escolha" },
  media: { fundo: "bg-amber-50", borda: "border-amber-300", texto: "text-amber-800", rotulo: "Custa caro" },
  ruim: { fundo: "bg-red-50", borda: "border-red-300", texto: "text-red-800", rotulo: "Erro" },
} as const;

function Bloco({ icone, titulo, cor, children }: { icone: React.ReactNode; titulo: string; cor: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide", cor)}>
        {icone} {titulo}
      </div>
      {children}
    </div>
  );
}

// ── Guia de uma etapa ───────────────────────────────────────────────────────
function GuiaEtapa({ e }: { e: EtapaVenda }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-lg font-black text-slate-800">{e.nome}</h3>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{e.tempoTipico}</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-brand-700">{e.objetivo}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{e.resumo}</p>
      </div>

      <Bloco icone={<Target size={13} />} titulo="O que fazer" cor="text-brand-700">
        <ul className="space-y-1 text-sm text-slate-700">
          {e.oQueFazer.map((x, i) => (
            <li key={i} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />{x}</li>
          ))}
        </ul>
      </Bloco>

      <Bloco icone={<Eye size={13} />} titulo="O que identificar" cor="text-sky-700">
        {/* No celular, cada sinal vira um cartão — tabela de 3 colunas não cabe. */}
        <ul className="space-y-2 sm:hidden">
          {e.oQueIdentificar.map((s, i) => (
            <li key={i} className="rounded-xl border border-sky-200 bg-sky-50/60 p-2.5">
              <div className="text-sm font-bold text-sky-900">{s.sinal}</div>
              <p className="mt-0.5 text-xs text-slate-600"><b className="text-slate-500">Significa:</b> {s.significa}</p>
              <p className="mt-0.5 text-xs text-slate-700"><b className="text-slate-500">Faça:</b> {s.acao}</p>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                <th className="pb-1 pr-3 font-black">Sinal</th>
                <th className="pb-1 pr-3 font-black">O que significa</th>
                <th className="pb-1 font-black">O que fazer</th>
              </tr>
            </thead>
            <tbody>
              {e.oQueIdentificar.map((s, i) => (
                <tr key={i} className="border-t border-slate-100 align-top">
                  <td className="py-1.5 pr-3 font-semibold text-slate-700">{s.sinal}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{s.significa}</td>
                  <td className="py-1.5 text-slate-600">{s.acao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>

      <Bloco icone={<HelpCircle size={13} />} titulo="O que perguntar" cor="text-violet-700">
        <ul className="space-y-1.5">
          {e.perguntas.map((p, i) => (
            <li key={i} className="rounded-lg bg-violet-50 p-2">
              <div className="text-sm font-semibold text-violet-900">“{p.pergunta}”</div>
              <div className="text-xs text-violet-700">{p.porque}</div>
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco icone={<MessageSquare size={13} />} titulo="O que falar — palavra por palavra" cor="text-emerald-700">
        <div className="space-y-2">
          {e.falas.map((f, i) => {
            const Icone = ICONE_CANAL[f.canal];
            return (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-agro-400">
                    <Icone size={11} /> {ROTULO_CANAL[f.canal]}
                  </span>
                  <span className="text-xs text-slate-500">{f.situacao}</span>
                </div>
                <p className="rounded-lg bg-emerald-50 p-2 text-sm italic leading-relaxed text-emerald-900">“{f.fala}”</p>
                <p className="mt-1 text-xs text-slate-500"><b>Por que funciona:</b> {f.porque}</p>
              </div>
            );
          })}
        </div>
      </Bloco>

      <Bloco icone={<Shield size={13} />} titulo="O que responder" cor="text-amber-700">
        <div className="space-y-2">
          {e.respostas.map((r, i) => (
            <div key={i} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="text-sm font-bold text-amber-900">{r.situacao}</div>
              <p className="mt-1 rounded-lg bg-white p-2 text-sm italic text-slate-700">“{r.resposta}”</p>
              <p className="mt-1 text-xs text-red-700"><b>Armadilha:</b> {r.armadilha}</p>
            </div>
          ))}
        </div>
      </Bloco>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Bloco icone={<XCircle size={13} />} titulo="Erros que matam a venda" cor="text-red-700">
          <ul className="space-y-1 text-sm text-slate-700">
            {e.erros.map((x, i) => <li key={i} className="flex gap-2"><span className="text-red-500">✗</span>{x}</li>)}
          </ul>
        </Bloco>
        <Bloco icone={<CheckCircle2 size={13} />} titulo="Pode avançar quando" cor="text-emerald-700">
          <ul className="space-y-1 text-sm text-slate-700">
            {e.criteriosDeAvanco.map((x, i) => <li key={i} className="flex gap-2"><span className="text-emerald-500">✓</span>{x}</li>)}
          </ul>
        </Bloco>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
        <BarChart3 size={12} className="text-slate-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">O que medir:</span>
        {e.indicadores.map((x) => (
          <span key={x} className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{x}</span>
        ))}
      </div>
    </div>
  );
}

// ── Simulador ───────────────────────────────────────────────────────────────
type Passo = { cenario: CenarioSimulador; escolhida: OpcaoSimulador | null };

function Simulador({ etapaSelecionada, temIA }: { etapaSelecionada: string; temIA: boolean }) {
  const [passos, setPassos] = useState<Passo[]>([]);
  const [fim, setFim] = useState<CenarioSimulador["desfecho"] | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dificuldade, setDificuldade] = useState<1 | 2 | 3>(2);

  const iniciais = useMemo(() => {
    const daEtapa = cenariosIniciais().filter((c) => c.etapa === etapaSelecionada);
    return daEtapa.length ? daEtapa : cenariosIniciais();
  }, [etapaSelecionada]);

  const escolhas: EscolhaFeita[] = passos
    .filter((p) => p.escolhida)
    .map((p) => ({ cenarioId: p.cenario.id, opcaoId: p.escolhida!.id }));
  const placar = pontuacao(escolhas);
  const atual = passos[passos.length - 1] ?? null;

  function comecar(c: CenarioSimulador) {
    setPassos([{ cenario: c, escolhida: null }]);
    setFim(null);
    setErro(null);
  }

  function reiniciar() {
    setPassos([]);
    setFim(null);
    setErro(null);
  }

  async function escolher(opcao: OpcaoSimulador) {
    if (!atual || atual.escolhida) return;
    setPassos((ps) => ps.map((p, i) => (i === ps.length - 1 ? { ...p, escolhida: opcao } : p)));

    // A opção pode encerrar a história, encadear para o banco, ou pedir IA.
    const desfechoDaOpcao = opcao.desfecho;
    if (desfechoDaOpcao) { setFim(desfechoDaOpcao); return; }
    if (opcao.proximo) {
      const proximo = CENARIOS_POR_ID.get(opcao.proximo);
      if (proximo) {
        setTimeout(() => setPassos((ps) => [...ps, { cenario: proximo, escolhida: null }]), 400);
        return;
      }
    }
    if (atual.cenario.desfecho) { setFim(atual.cenario.desfecho); return; }
    if (temIA) await continuarComIA();
  }

  async function continuarComIA() {
    setGerando(true);
    setErro(null);
    const historico = passos
      .filter((p) => p.escolhida)
      .map((p) => ({ situacao: p.cenario.contexto, escolha: p.escolhida!.texto, qualidade: p.escolhida!.qualidade }));
    const r = await gerarCenarioSimuladorAction({ etapa: etapaSelecionada, historico, indice: passos.length, dificuldade });
    setGerando(false);
    if (!r.ok || !r.cenario) { setErro(r.erro ?? "Não consegui continuar agora."); return; }
    setPassos((ps) => [...ps, { cenario: r.cenario!, escolhida: null }]);
    if (r.cenario.desfecho) setFim(r.cenario.desfecho);
  }

  if (passos.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <Play size={16} className="text-agro-600" />
          <h3 className="text-base font-black text-slate-800">Simulador: você decide o que falar</h3>
        </div>
        <p className="mb-3 text-sm text-slate-600">
          A Academia monta a cena, você escolhe a resposta e vê a consequência — e a sua escolha muda a cena seguinte,
          até o cliente fechar, sumir ou levar o seu preço para o concorrente.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Dificuldade</span>
          {([1, 2, 3] as const).map((d) => (
            <button key={d} onClick={() => setDificuldade(d)}
              className={cn("rounded-lg px-3 py-1 text-xs font-bold", dificuldade === d ? "bg-slate-900 text-agro-400" : "bg-slate-100 text-slate-600")}>
              {d === 1 ? "Tranquilo" : d === 2 ? "Real" : "Osso duro"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {iniciais.map((c) => (
            <button key={c.id} onClick={() => comecar(c)} className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-agro-400 hover:bg-agro-50">
              <div className="text-sm font-bold text-slate-800">{c.titulo}</div>
              <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{c.contexto}</div>
            </button>
          ))}
          {temIA && (
            <button onClick={() => continuarComIA()} disabled={gerando} className="rounded-xl border border-dashed border-violet-300 bg-violet-50 p-3 text-left transition hover:bg-violet-100 disabled:opacity-60">
              <div className="flex items-center gap-1.5 text-sm font-bold text-violet-800">
                {gerando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Cena inédita com a IA
              </div>
              <div className="mt-0.5 text-xs text-violet-700">O Cérebro inventa uma situação nova desta etapa, do zero.</div>
            </button>
          )}
        </div>
        {erro && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Play size={15} className="text-agro-600" />
          <span className="text-sm font-black text-slate-800">Simulação em andamento</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{placar.pontos}/{placar.maximo} pontos</span>
          <button onClick={reiniciar} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100">
            <RotateCcw size={12} /> Recomeçar
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {passos.map((p, i) => (
          <div key={`${p.cenario.id}-${i}`} className={cn("rounded-xl border p-3", i === passos.length - 1 ? "border-slate-300" : "border-slate-100 opacity-80")}>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-agro-400">Cena {i + 1}</span>
              <span className="text-xs font-bold text-slate-700">{p.cenario.titulo}</span>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{p.cenario.canal}</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{p.cenario.contexto}</p>
            {p.cenario.falaDoCliente && (
              <p className="mt-2 rounded-lg bg-slate-100 p-2 text-sm italic text-slate-800">Cliente: “{p.cenario.falaDoCliente}”</p>
            )}
            <p className="mt-2 text-sm font-bold text-slate-800">{p.cenario.pergunta}</p>

            <div className="mt-2 space-y-1.5">
              {p.cenario.opcoes.map((o) => {
                const escolhida = p.escolhida?.id === o.id;
                const revelado = !!p.escolhida;
                const cor = COR_QUALIDADE[o.qualidade];
                return (
                  <div key={o.id}>
                    <button
                      onClick={() => i === passos.length - 1 && escolher(o)}
                      disabled={revelado}
                      className={cn(
                        "w-full rounded-lg border p-2.5 text-left text-sm transition",
                        !revelado && "border-slate-200 hover:border-agro-400 hover:bg-agro-50",
                        revelado && escolhida && `${cor.borda} ${cor.fundo}`,
                        revelado && !escolhida && "border-slate-100 text-slate-400",
                      )}
                    >
                      {o.texto}
                    </button>
                    {revelado && escolhida && (
                      <div className={cn("mt-1 rounded-lg p-2 text-xs", cor.fundo, cor.texto)}>
                        <b>{cor.rotulo}.</b> {o.feedback}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {gerando && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-violet-50 p-3 text-sm text-violet-800">
          <Loader2 size={15} className="animate-spin" /> O Cérebro está montando a próxima cena…
        </div>
      )}
      {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}

      {fim && (
        <div className={cn("mt-4 rounded-xl border p-4",
          fim.tipo === "ganhou" ? "border-emerald-300 bg-emerald-50" : fim.tipo === "perdeu" ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50")}>
          <div className="flex items-center gap-2">
            {fim.tipo === "ganhou" ? <Trophy size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className={fim.tipo === "perdeu" ? "text-red-600" : "text-amber-600"} />}
            <span className="text-sm font-black text-slate-800">
              {fim.tipo === "ganhou" ? "Venda fechada" : fim.tipo === "perdeu" ? "Venda perdida" : "Venda travada"}
            </span>
            <span className="ml-auto text-xs font-bold text-slate-600">{placar.percentual}% de aproveitamento</span>
          </div>
          <p className="mt-1.5 text-sm text-slate-700">{fim.texto}</p>
          <p className="mt-1.5 text-sm font-semibold text-slate-800">{veredito(placar.percentual, fim)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={reiniciar} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-agro-400">
              <RotateCcw size={13} /> Treinar de novo
            </button>
            {temIA && (
              <button onClick={() => { setFim(null); continuarComIA(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-bold text-violet-700">
                <Sparkles size={13} /> Outra situação com a IA
              </button>
            )}
          </div>
        </div>
      )}

      {!fim && atual?.escolhida && !gerando && temIA && (
        <button onClick={continuarComIA} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white">
          <Sparkles size={13} /> Continuar a conversa
        </button>
      )}
    </div>
  );
}

// ── Realidade do negócio ────────────────────────────────────────────────────
function Realidade({ inicial, temIA }: { inicial: RegraNegocio[]; temIA: boolean }) {
  const [regras, setRegras] = useState(inicial);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  async function adicionar(comIA: boolean) {
    setOcupado(true); setErro(null);
    let final = texto;
    if (comIA) {
      const r = await escreverRegraComIAAction(texto);
      if (r.ok && r.texto) final = r.texto;
    }
    const r = await adicionarRealidadeAction(final);
    setOcupado(false);
    if (!r.ok || !r.regras) { setErro(r.erro ?? "Não consegui salvar."); return; }
    setRegras(r.regras);
    setTexto("");
  }

  async function remover(id: string) {
    setRegras(await removerRealidadeAction(id));
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
      <button onClick={() => setAberto((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <Settings2 size={16} className="shrink-0 text-violet-700" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-violet-900">A sua realidade manda mais que a teoria</div>
          <div className="text-xs text-violet-700">
            {regras.length} regra(s) ativa(s). A Academia, o Orientador e o Cérebro seguem tudo o que estiver aqui.
          </div>
        </div>
        <ChevronDown size={16} className={cn("shrink-0 text-violet-700 transition", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div className="mt-3">
          <p className="mb-2 text-xs leading-relaxed text-violet-800">
            Exemplo real: um conteúdo de vendas ensina a aceitar a máquina do cliente como entrada. Aqui não é assim —
            então essa regra fica cadastrada e a IA nunca mais sugere isso, em lugar nenhum do CRM.
          </p>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex.: não trabalhamos com máquina como entrada; a entrada é em dinheiro"
              className="flex-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400"
            />
            <div className="flex gap-2">
              <button onClick={() => adicionar(false)} disabled={ocupado || texto.trim().length < 10} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Guardar
              </button>
              {temIA && (
                <button onClick={() => adicionar(true)} disabled={ocupado || texto.trim().length < 10} title="A IA escreve a regra de forma clara antes de guardar" className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-700 disabled:opacity-50">
                  <Wand2 size={13} /> Escrever melhor
                </button>
              )}
            </div>
          </div>
          {erro && <p className="mb-2 text-xs text-red-600">{erro}</p>}
          <ul className="space-y-1.5">
            {regras.map((r) => (
              <li key={r.id} className="flex items-start gap-2 rounded-lg bg-white p-2.5 text-sm text-slate-700">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-violet-500" />
                <span className="flex-1">{r.texto}</span>
                <button onClick={() => remover(r.id)} className="shrink-0 text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
              </li>
            ))}
            {regras.length === 0 && <li className="text-xs text-violet-700">Nenhuma regra ainda.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Página da aba ───────────────────────────────────────────────────────────
export function AcademiaEtapas({ realidade, temIA }: { realidade: RegraNegocio[]; temIA: boolean }) {
  const [etapaId, setEtapaId] = useState(ETAPAS[0].id);
  const [modo, setModo] = useState<"guia" | "simulador">("guia");
  const etapa = ETAPAS.find((e) => e.id === etapaId) ?? ETAPAS[0];

  return (
    <div className="space-y-4">
      <Realidade inicial={realidade} temIA={temIA} />

      {/* Etapas */}
      <div className="flex flex-wrap gap-1.5">
        {ETAPAS.map((e, i) => (
          <button
            key={e.id}
            onClick={() => setEtapaId(e.id)}
            className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition",
              etapaId === e.id ? "bg-slate-900 text-agro-400" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}
          >
            <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black",
              etapaId === e.id ? "bg-agro-400 text-black" : "bg-slate-200 text-slate-600")}>{i + 1}</span>
            {e.nome}
          </button>
        ))}
      </div>

      {/* Guia x Simulador */}
      <div className="flex gap-2">
        {([["guia", "Como fazer"], ["simulador", "Treinar agora"]] as const).map(([id, rotulo]) => (
          <button key={id} onClick={() => setModo(id)}
            className={cn("rounded-xl px-4 py-2 text-sm font-bold transition",
              modo === id ? "bg-agro-400 text-black" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
            {rotulo}
          </button>
        ))}
      </div>

      {modo === "guia" ? <GuiaEtapa e={etapa} /> : <Simulador etapaSelecionada={etapaId} temIA={temIA} />}
    </div>
  );
}
