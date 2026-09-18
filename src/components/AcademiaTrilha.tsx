"use client";

import { useMemo, useState, useTransition } from "react";
import {
  TRILHA, TODAS_AULAS, TOTAL_MINUTOS, NOTA_MINIMA_PROVA, NOTA_MINIMA_CERTIFICACAO, PERGUNTAS_CERTIFICACAO,
  proximaAula, progressoModulo, moduloCertificado, nivelDoVendedor, embaralharOpcoes, selecionarRevisao, resumoRevisao, perguntaPorId,
  certificacaoLiberada, montarCertificacao,
  type Modulo, type Aula, type Bloco, type Pergunta,
} from "@/lib/academia-trilha";
import {
  concluirAulaAcademia, reabrirAulaAcademia, registrarProvaAcademia, registrarRevisaoAcademia, registrarCertificacaoAcademia,
  gerarCenarioTreinoAction, avaliarTreinoAction, type ProgressoAcademia,
} from "@/lib/academia-actions";
import type { CenarioTreino, AvaliacaoTreino, RodadaTreino } from "@/lib/ai/treino";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Circle, ChevronLeft, Clock, Target, Lightbulb, MessageSquareQuote, Sparkles, Loader2, Trophy, Lock, ArrowRight, RotateCcw, Award,
  BookOpen, ClipboardList, AlertTriangle, PenLine, FileText, BadgeCheck, GraduationCap, ListChecks, Layers, Calculator, MessagesSquare, Brain, Medal,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// Blocos de conteúdo
// ─────────────────────────────────────────────────────────────────────────
function BlocoView({ b, cor }: { b: Bloco; cor: string }) {
  if (b.tipo === "p") {
    return (
      <div>
        {b.titulo && <h4 className="mb-1 text-sm font-bold text-slate-800">{b.titulo}</h4>}
        <p className="text-sm leading-relaxed text-slate-700">{b.texto}</p>
      </div>
    );
  }
  if (b.tipo === "lista") {
    return (
      <div>
        {b.titulo && <h4 className="mb-1.5 text-sm font-bold text-slate-800">{b.titulo}</h4>}
        <ul className="space-y-1.5">
          {b.itens.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cor }} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (b.tipo === "script") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <MessageSquareQuote size={13} /> {b.titulo ?? "Script pronto"}
        </div>
        <ul className="space-y-2">
          {b.itens.map((it, i) => <li key={i} className="rounded-lg bg-white px-3 py-2 text-sm italic text-slate-700 shadow-sm">{it}</li>)}
        </ul>
      </div>
    );
  }
  if (b.tipo === "caso") {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-sky-700">
          <FileText size={13} /> {b.titulo ?? "Caso real"}
        </div>
        <dl className="space-y-1.5 text-sm text-slate-700">
          <div><dt className="inline font-bold text-slate-800">Situação: </dt><dd className="inline">{b.situacao}</dd></div>
          <div><dt className="inline font-bold text-slate-800">O que foi feito: </dt><dd className="inline">{b.acao}</dd></div>
          <div><dt className="inline font-bold text-slate-800">Resultado: </dt><dd className="inline">{b.resultado}</dd></div>
          <div className="rounded-lg bg-white px-3 py-2 shadow-sm"><dt className="inline font-bold text-sky-800">Lição: </dt><dd className="inline font-medium text-slate-800">{b.licao}</dd></div>
        </dl>
      </div>
    );
  }
  if (b.tipo === "checklist") {
    return (
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <ClipboardList size={13} /> {b.titulo ?? "Checklist"}
        </div>
        <ul className="space-y-1.5">
          {b.itens.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2" style={{ borderColor: cor }} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (b.tipo === "tabela") {
    return (
      <div>
        {b.titulo && <h4 className="mb-1.5 text-sm font-bold text-slate-800">{b.titulo}</h4>}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr style={{ background: `${cor}1f` }}>
                {b.colunas.map((c, i) => <th key={i} className="px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {b.linhas.map((l, i) => (
                <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                  {l.map((c, j) => <td key={j} className={cn("px-3 py-2 align-top text-slate-700", j === 0 && "font-semibold text-slate-800")}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (b.tipo === "erros") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-700">
          <AlertTriangle size={13} /> {b.titulo ?? "Erros comuns"}
        </div>
        <ul className="space-y-1.5">
          {b.itens.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-red-900">
              <span className="mt-0.5 shrink-0 font-black text-red-500">✕</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (b.tipo === "exercicio") {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-700">
          <PenLine size={13} /> {b.titulo ?? "Exercício"}
        </div>
        <p className="text-sm leading-relaxed text-violet-950">{b.texto}</p>
      </div>
    );
  }
  if (b.tipo === "framework") {
    return (
      <div className="rounded-xl border p-3" style={{ borderColor: `${cor}66` }}>
        <div className="mb-0.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: cor }}>
          <Layers size={13} /> Framework · {b.nome}
        </div>
        <p className="mb-2 text-[11px] text-slate-500">{b.origem}</p>
        <ol className="space-y-1.5">
          {b.passos.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white" style={{ background: cor }}>{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (b.tipo === "dialogo") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <MessagesSquare size={13} /> {b.titulo ?? "Diálogo comentado"}
        </div>
        <div className="space-y-1.5">
          {b.falas.map((f, i) =>
            f.quem === "nota" ? (
              <p key={i} className="rounded-lg border-l-2 border-amber-400 bg-amber-50 px-3 py-1.5 text-xs text-amber-900"><b>Professor:</b> {f.texto}</p>
            ) : (
              <div key={i} className={cn("flex", f.quem === "vendedor" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[88%] rounded-2xl px-3 py-2 text-sm shadow-sm", f.quem === "vendedor" ? "rounded-br-sm bg-emerald-100 text-emerald-950" : "rounded-bl-sm bg-white text-slate-800")}>
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide opacity-60">{f.quem}</span>
                  {f.texto}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    );
  }
  if (b.tipo === "conta") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
          <Calculator size={13} /> {b.titulo ?? "Conta feita"}
        </div>
        <table className="w-full text-sm">
          <tbody>
            {b.linhas.map(([k, v], i) => (
              <tr key={i} className="border-t border-emerald-100 first:border-0">
                <td className="py-1 pr-2 text-slate-700">{k}</td>
                <td className="py-1 text-right font-bold tabular-nums text-emerald-900">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-900 shadow-sm">{b.conclusao}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: `${cor}66`, background: `${cor}14` }}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: cor }}>
        <Lightbulb size={13} /> {b.titulo ?? "Destaque"}
      </div>
      <p className="text-sm font-medium leading-relaxed text-slate-800">{b.texto}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Quiz genérico (aula, prova final, revisão, certificação). As opções são
// embaralhadas por semente — a ordem muda a cada abertura.
// ─────────────────────────────────────────────────────────────────────────
type QuizItem = { pergunta: Pergunta; rotulo?: string };

function Quiz({ itens, semente, conferido, respostas, onResponder }: {
  itens: QuizItem[]; semente: number; conferido: boolean; respostas: Record<number, number>; onResponder: (qi: number, opcaoOriginal: number) => void;
}) {
  const embaralhadas = useMemo(() => itens.map((it, i) => embaralharOpcoes(it.pergunta, semente + i * 7919)), [itens, semente]);
  return (
    <div className="space-y-4">
      {itens.map((it, qi) => {
        const e = embaralhadas[qi];
        return (
          <div key={qi} className="rounded-xl border border-slate-200 p-3">
            {it.rotulo && <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{it.rotulo}</div>}
            <p className="mb-2 text-sm font-semibold text-slate-800">{qi + 1}. {it.pergunta.pergunta}</p>
            <div className="space-y-1.5">
              {e.opcoes.map((op, oi) => {
                const original = e.ordem[oi];
                const marcada = respostas[qi] === original;
                const certa = conferido && original === it.pergunta.correta;
                const errada = conferido && marcada && original !== it.pergunta.correta;
                return (
                  <button key={oi} disabled={conferido} onClick={() => onResponder(qi, original)}
                    className={cn("flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                      certa ? "border-green-400 bg-green-50 text-green-800" : errada ? "border-red-300 bg-red-50 text-red-700" : marcada ? "border-brand-500 bg-brand-50 text-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50")}>
                    {marcada || certa ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <Circle size={15} className="mt-0.5 shrink-0 text-slate-300" />}
                    <span>{op}</span>
                  </button>
                );
              })}
            </div>
            {conferido && <p className="mt-2 text-xs leading-relaxed text-slate-600"><b>Por quê:</b> {it.pergunta.explicacao}</p>}
          </div>
        );
      })}
    </div>
  );
}

function notaDe(itens: QuizItem[], respostas: Record<number, number>): { acertos: number; nota: number; todas: boolean } {
  const acertos = itens.filter((it, i) => respostas[i] === it.pergunta.correta).length;
  const todas = itens.every((_, i) => respostas[i] != null);
  return { acertos, nota: itens.length ? Math.round((acertos / itens.length) * 100) : 100, todas };
}

// ─────────────────────────────────────────────────────────────────────────
// Aula
// ─────────────────────────────────────────────────────────────────────────
function AulaView({ modulo, aula, concluida, nota, onConcluir, onReabrir, onVoltar, salvando }: {
  modulo: Modulo; aula: Aula; concluida: boolean; nota: number | undefined;
  onConcluir: (notaQuiz: number) => void; onReabrir: () => void; onVoltar: () => void; salvando: boolean;
}) {
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [conferido, setConferido] = useState(false);
  const [semente, setSemente] = useState(() => Math.floor(Math.random() * 1e9));
  const itens = useMemo(() => aula.quiz.map((pergunta) => ({ pergunta })), [aula]);
  const r = notaDe(itens, respostas);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <button onClick={onVoltar} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
        <ChevronLeft size={14} /> Módulo {modulo.nivel}: {modulo.titulo}
      </button>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-black text-slate-900">{aula.titulo}</h2>
        {concluida && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700"><CheckCircle2 size={12} /> concluída{nota != null ? ` · quiz ${nota}%` : ""}</span>}
      </div>
      <p className="mb-1 text-sm text-slate-500">{aula.resumo}</p>
      <p className="mb-5 flex items-center gap-1 text-xs text-slate-400"><Clock size={12} /> {aula.minutos} min · {aula.blocos.length} blocos · quiz com {aula.quiz.length} perguntas</p>

      <div className="space-y-5">
        {aula.blocos.map((b, i) => <BlocoView key={i} b={b} cor={modulo.cor} />)}
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700"><Target size={13} /> Missão prática no CRM</div>
        <p className="text-sm text-amber-900">{aula.missao}</p>
      </div>

      <div className="mt-6">
        <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-slate-700">Quiz da aula</h3>
        <p className="mb-3 text-xs text-slate-500">Perguntas de cenário: só uma opção está certa, e as erradas são erros que vendedores cometem de verdade. Leia a explicação de cada uma depois de conferir.</p>
        <Quiz itens={itens} semente={semente} conferido={conferido} respostas={respostas} onResponder={(qi, oi) => setRespostas((x) => ({ ...x, [qi]: oi }))} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!conferido ? (
            <button onClick={() => setConferido(true)} disabled={!r.todas}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
              Conferir respostas
            </button>
          ) : (
            <>
              <span className={cn("text-sm font-bold", r.nota >= 80 ? "text-green-700" : "text-amber-700")}>
                {r.acertos}/{itens.length} certas ({r.nota}%)
              </span>
              <button onClick={() => { setConferido(false); setRespostas({}); setSemente(Math.floor(Math.random() * 1e9)); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <RotateCcw size={13} /> Refazer (ordem nova)
              </button>
            </>
          )}
          {!concluida ? (
            <button onClick={() => onConcluir(conferido ? r.nota : 0)} disabled={salvando || !conferido}
              title={!conferido ? "Confira o quiz antes de concluir" : undefined}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Concluir aula
            </button>
          ) : (
            <button onClick={onReabrir} disabled={salvando} className="ml-auto text-xs font-semibold text-slate-500 hover:underline">Marcar como não concluída</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Prova final do módulo
// ─────────────────────────────────────────────────────────────────────────
function ProvaFinal({ modulo, liberada, melhorNota, onRegistrar, salvando }: {
  modulo: Modulo; liberada: boolean; melhorNota: number | undefined; onRegistrar: (nota: number) => void; salvando: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [conferido, setConferido] = useState(false);
  const [semente, setSemente] = useState(() => Math.floor(Math.random() * 1e9));
  const itens = useMemo(() => modulo.prova.map((pergunta) => ({ pergunta })), [modulo]);
  const r = notaDe(itens, respostas);
  const aprovado = melhorNota != null && melhorNota >= NOTA_MINIMA_PROVA;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700">
          <GraduationCap size={16} style={{ color: modulo.cor }} /> Prova final do módulo {modulo.nivel}
        </div>
        {aprovado ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700"><BadgeCheck size={13} /> Certificado · {melhorNota}%</span>
        ) : melhorNota != null ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Melhor nota: {melhorNota}% (mínimo {NOTA_MINIMA_PROVA}%)</span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">{modulo.prova.length} perguntas de cenário sobre todo o módulo. Aprovação com {NOTA_MINIMA_PROVA}% ou mais gera o certificado do nível. Pode refazer — vale a melhor nota, e a ordem das opções muda a cada vez.</p>
      {!liberada ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500"><Lock size={13} /> Conclua as {modulo.aulas.length} aulas do módulo para liberar a prova.</p>
      ) : !aberta ? (
        <button onClick={() => { setAberta(true); setRespostas({}); setConferido(false); setSemente(Math.floor(Math.random() * 1e9)); }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800">
          <ListChecks size={14} /> {melhorNota != null ? "Refazer a prova" : "Fazer a prova"}
        </button>
      ) : (
        <div className="mt-4">
          <Quiz itens={itens} semente={semente} conferido={conferido} respostas={respostas} onResponder={(qi, oi) => setRespostas((x) => ({ ...x, [qi]: oi }))} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!conferido ? (
              <button onClick={() => setConferido(true)} disabled={!r.todas} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">Conferir prova</button>
            ) : (
              <>
                <span className={cn("text-sm font-bold", r.nota >= NOTA_MINIMA_PROVA ? "text-green-700" : "text-red-700")}>
                  {r.acertos}/{itens.length} certas ({r.nota}%) — {r.nota >= NOTA_MINIMA_PROVA ? "aprovado" : "abaixo do mínimo"}
                </span>
                <button onClick={() => { setRespostas({}); setConferido(false); setSemente(Math.floor(Math.random() * 1e9)); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><RotateCcw size={13} /> Refazer</button>
                <button onClick={() => { onRegistrar(r.nota); setAberta(false); }} disabled={salvando} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />} Registrar resultado
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Treino com IA — simulador em duas rodadas com rubrica
// ─────────────────────────────────────────────────────────────────────────
function TreinoIA({ modulo }: { modulo: Modulo }) {
  const [dificuldade, setDificuldade] = useState<1 | 2 | 3>(2);
  const [cenario, setCenario] = useState<CenarioTreino | null>(null);
  const [rodadas, setRodadas] = useState<RodadaTreino[]>([]);
  const [dicas, setDicas] = useState<string[]>([]);
  const [resposta, setResposta] = useState("");
  const [avaliacao, setAvaliacao] = useState<AvaliacaoTreino | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, startGerar] = useTransition();
  const [avaliando, startAvaliar] = useTransition();

  function gerar() {
    setErro(null); setAvaliacao(null); setResposta(""); setRodadas([]); setDicas([]);
    startGerar(async () => {
      const r = await gerarCenarioTreinoAction(modulo.id, dificuldade);
      if (!r.ok || !r.cenario) { setErro(r.erro ?? "Falha ao gerar cenário."); return; }
      setCenario(r.cenario);
    });
  }

  function enviar() {
    if (!cenario) return;
    setErro(null);
    const minha = resposta.trim();
    startAvaliar(async () => {
      const r = await avaliarTreinoAction(modulo.id, cenario, rodadas, minha);
      if (!r.ok || !r.avaliacao) { setErro(r.erro ?? "Falha ao avaliar."); return; }
      if (!r.avaliacao.final) {
        setRodadas((x) => [...x, { vendedor: minha, cliente: r.avaliacao!.replicaCliente }]);
        setDicas(r.avaliacao.melhorias);
        setResposta("");
      } else {
        setRodadas((x) => [...x, { vendedor: minha, cliente: "" }]);
        setAvaliacao(r.avaliacao);
      }
    });
  }

  const rodadaAtual = rodadas.length + 1;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700"><Sparkles size={15} style={{ color: modulo.cor }} /> Simulador de cliente — {modulo.tema}</div>
      <p className="mb-3 text-xs text-slate-500">A IA interpreta um cliente do seu mercado com perfil DISC e um desafio deste módulo. São <b>duas rodadas</b>: você responde, o cliente replica (como na vida real), você responde de novo — e aí sai a nota por rubrica de 5 critérios, com correções e a versão de elite.</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Dificuldade</span>
        {([1, 2, 3] as const).map((d) => (
          <button key={d} onClick={() => setDificuldade(d)} disabled={gerando} className={cn("rounded-lg px-2.5 py-1 text-xs font-bold", dificuldade === d ? "bg-slate-900 text-agro-400" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
            {d === 1 ? "1 · aberto" : d === 2 ? "2 · cético" : "3 · difícil"}
          </button>
        ))}
        <button onClick={gerar} disabled={gerando} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {gerando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {cenario ? "Novo cenário" : "Gerar cenário"}
        </button>
      </div>
      {erro && <p className="mt-2 text-sm font-semibold text-red-600">{erro}</p>}
      {cenario && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <p><b>Cliente:</b> {cenario.cliente}</p>
            <p><b>Perfil:</b> {cenario.perfil}</p>
            <p className="mt-1"><b>Situação:</b> {cenario.situacao}</p>
            <p className="mt-2 text-xs text-slate-500"><b>Seu objetivo:</b> {cenario.objetivo}</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-start"><div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-slate-800 shadow-sm ring-1 ring-slate-200">{cenario.fala}</div></div>
            {rodadas.map((r, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-end"><div className="max-w-[88%] rounded-2xl rounded-br-sm bg-emerald-100 px-3 py-2 text-sm text-emerald-950 shadow-sm">{r.vendedor}</div></div>
                {r.cliente && <div className="flex justify-start"><div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-slate-800 shadow-sm ring-1 ring-slate-200">{r.cliente}</div></div>}
              </div>
            ))}
          </div>
          {!avaliacao && dicas.length > 0 && (
            <div className="rounded-lg border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <b>Treinador, antes da 2ª resposta:</b>
              <ul className="mt-1 list-disc pl-4">{dicas.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </div>
          )}
          {!avaliacao && (
            <>
              <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={4} disabled={avaliando}
                placeholder={rodadaAtual === 1 ? "Rodada 1 — escreva exatamente o que você responderia ao cliente…" : "Rodada 2 — o cliente replicou. Responda de novo, agora fechando o passo…"}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50" />
              <button onClick={enviar} disabled={avaliando || !resposta.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
                {avaliando ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />} {rodadaAtual === 1 ? "Enviar (rodada 1 de 2)" : "Enviar e receber a nota"}
              </button>
            </>
          )}
          {avaliacao && (
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex items-center gap-3">
                <span className={cn("rounded-full px-3 py-1 text-lg font-black", avaliacao.nota >= 8 ? "bg-green-100 text-green-700" : avaliacao.nota >= 6 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>{avaliacao.nota}/10</span>
                <span className="text-sm text-slate-500">{avaliacao.nota >= 8 ? "Excelente — nível de elite." : avaliacao.nota >= 6 ? "Bom, mas dá pra fechar mais." : "Ainda deixa venda na mesa. Veja a rubrica."}</span>
              </div>
              {avaliacao.criterios.length > 0 && (
                <div className="mb-3 overflow-hidden rounded-lg border border-slate-200">
                  {avaliacao.criterios.map((c, i) => (
                    <div key={i} className={cn("flex items-start gap-2 px-3 py-2 text-xs", i % 2 ? "bg-slate-50" : "bg-white")}>
                      <span className={cn("mt-0.5 w-8 shrink-0 rounded px-1.5 py-0.5 text-center font-black", c.nota === 2 ? "bg-green-100 text-green-700" : c.nota === 1 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>{c.nota}/2</span>
                      <span><b className="text-slate-800">{c.nome}.</b> <span className="text-slate-600">{c.comentario}</span></span>
                    </div>
                  ))}
                </div>
              )}
              {avaliacao.pontosFortes.length > 0 && (
                <div className="mb-2"><div className="text-xs font-bold uppercase tracking-wide text-green-700">O que funcionou</div><ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{avaliacao.pontosFortes.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
              )}
              {avaliacao.melhorias.length > 0 && (
                <div className="mb-2"><div className="text-xs font-bold uppercase tracking-wide text-amber-700">O que melhorar</div><ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{avaliacao.melhorias.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
              )}
              {avaliacao.versaoMelhorada && (
                <div className="mb-2 rounded-lg bg-slate-50 p-3"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Como um vendedor de elite responderia</div><p className="mt-1 text-sm italic text-slate-800">{avaliacao.versaoMelhorada}</p></div>
              )}
              {avaliacao.proximoPasso && <p className="text-xs text-slate-600"><b>Próximo passo:</b> {avaliacao.proximoPasso}</p>}
              {cenario.armadilha && <p className="mt-1 text-xs text-slate-500"><b>A armadilha deste cenário era:</b> {cenario.armadilha}</p>}
              <button onClick={gerar} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"><ArrowRight size={12} /> Treinar outro cenário</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Revisão espaçada
// ─────────────────────────────────────────────────────────────────────────
function Revisao({ progresso, onRegistrar, salvando }: { progresso: ProgressoAcademia; onRegistrar: (r: { id: string; acertou: boolean }[]) => void; salvando: boolean }) {
  const [sessao, setSessao] = useState<string[] | null>(null);
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [conferido, setConferido] = useState(false);
  const [semente] = useState(() => Math.floor(Math.random() * 1e9));
  const concluidas = useMemo(() => new Set(progresso.concluidas), [progresso.concluidas]);
  const resumo = resumoRevisao(concluidas, progresso.revisao, new Date());
  const itens: (QuizItem & { id: string })[] = useMemo(() => (sessao ?? []).map((id) => {
    const p = perguntaPorId(id)!;
    return { id, pergunta: p.pergunta, rotulo: `Nível ${p.modulo.nivel} · ${p.aula.titulo}` };
  }).filter((x) => x.pergunta), [sessao]);
  const r = notaDe(itens, respostas);
  const nada = concluidas.size === 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700"><Brain size={16} className="text-violet-600" /> Revisão espaçada</div>
        {!nada && <span className="text-xs text-slate-500">{resumo.vencidas} para hoje · {resumo.novas} nunca revisadas · {resumo.dominadas} dominadas{progresso.revisoesFeitas ? ` · ${progresso.revisoesFeitas} sessão(ões)` : ""}</span>}
      </div>
      <p className="mt-1 text-xs text-slate-500">O que você leu ontem some em uma semana se não for cobrado. Aqui as perguntas das aulas concluídas voltam em intervalos crescentes (1, 3, 7, 14, 30 dias) enquanto você acerta — errou, volta amanhã. Dez minutos por dia mantêm tudo na cabeça.</p>
      {nada ? (
        <p className="mt-3 text-xs text-slate-400">Conclua a primeira aula para a revisão começar.</p>
      ) : !sessao ? (
        <button onClick={() => { setSessao(selecionarRevisao(concluidas, progresso.revisao, new Date(), 10)); setRespostas({}); setConferido(false); }}
          disabled={resumo.vencidas + resumo.novas === 0}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
          <Brain size={14} /> {resumo.vencidas + resumo.novas === 0 ? "Nada para revisar hoje — volte amanhã" : `Revisar agora (${Math.min(10, resumo.vencidas + resumo.novas)} perguntas)`}
        </button>
      ) : (
        <div className="mt-4">
          <Quiz itens={itens} semente={semente} conferido={conferido} respostas={respostas} onResponder={(qi, oi) => setRespostas((x) => ({ ...x, [qi]: oi }))} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!conferido ? (
              <button onClick={() => setConferido(true)} disabled={!r.todas} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">Conferir</button>
            ) : (
              <>
                <span className={cn("text-sm font-bold", r.nota >= 80 ? "text-green-700" : "text-amber-700")}>{r.acertos}/{itens.length} certas ({r.nota}%)</span>
                <button onClick={() => { onRegistrar(itens.map((it, i) => ({ id: it.id, acertou: respostas[i] === it.pergunta.correta }))); setSessao(null); }} disabled={salvando}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Registrar sessão
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Certificação final
// ─────────────────────────────────────────────────────────────────────────
function Certificacao({ progresso, onRegistrar, salvando }: { progresso: ProgressoAcademia; onRegistrar: (nota: number) => void; salvando: boolean }) {
  const concluidas = useMemo(() => new Set(progresso.concluidas), [progresso.concluidas]);
  const liberada = certificacaoLiberada(concluidas, progresso.provas);
  const [semente, setSemente] = useState(() => Math.floor(Math.random() * 1e9));
  const [aberta, setAberta] = useState(false);
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [conferido, setConferido] = useState(false);
  const itens: QuizItem[] = useMemo(() => montarCertificacao(semente).map((x) => ({ pergunta: x.pergunta, rotulo: `Nível ${x.modulo.nivel} · ${x.modulo.titulo}` })), [semente]);
  const r = notaDe(itens, respostas);
  const aprovado = (progresso.certificacao ?? 0) >= NOTA_MINIMA_CERTIFICACAO;
  const faltam = TRILHA.filter((m) => !moduloCertificado(m, concluidas, progresso.provas)).length;

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm sm:p-5", aprovado ? "border-agro-400 bg-gradient-to-br from-amber-50 to-white" : "border-slate-200 bg-white")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700"><Medal size={16} className="text-agro-500" /> Certificação Mestre em Vendas</div>
        {aprovado ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-agro-400 px-2.5 py-1 text-xs font-black text-black"><Trophy size={13} /> Certificado · {progresso.certificacao}%</span>
        ) : progresso.certificacao != null ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Melhor nota: {progresso.certificacao}% (mínimo {NOTA_MINIMA_CERTIFICACAO}%)</span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">{PERGUNTAS_CERTIFICACAO} perguntas sorteadas das provas dos 10 módulos — cada tentativa é uma prova diferente. Aprovação com {NOTA_MINIMA_CERTIFICACAO}%. É o diploma da trilha: só abre com os 10 módulos certificados.</p>
      {!liberada ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500"><Lock size={13} /> Faltam {faltam} módulo(s) certificado(s).</p>
      ) : !aberta ? (
        <button onClick={() => { setAberta(true); setRespostas({}); setConferido(false); setSemente(Math.floor(Math.random() * 1e9)); }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800">
          <Medal size={14} /> {progresso.certificacao != null ? "Fazer de novo" : "Fazer a certificação"}
        </button>
      ) : (
        <div className="mt-4">
          <Quiz itens={itens} semente={semente} conferido={conferido} respostas={respostas} onResponder={(qi, oi) => setRespostas((x) => ({ ...x, [qi]: oi }))} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!conferido ? (
              <button onClick={() => setConferido(true)} disabled={!r.todas} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">Conferir certificação</button>
            ) : (
              <>
                <span className={cn("text-sm font-bold", r.nota >= NOTA_MINIMA_CERTIFICACAO ? "text-green-700" : "text-red-700")}>{r.acertos}/{itens.length} certas ({r.nota}%) — {r.nota >= NOTA_MINIMA_CERTIFICACAO ? "aprovado" : "abaixo do mínimo"}</span>
                <button onClick={() => { onRegistrar(r.nota); setAberta(false); }} disabled={salvando} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />} Registrar resultado
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Trilha
// ─────────────────────────────────────────────────────────────────────────
export function AcademiaTrilha({ progressoInicial }: { progressoInicial: ProgressoAcademia }) {
  const [progresso, setProgresso] = useState(progressoInicial);
  const [moduloId, setModuloId] = useState<string | null>(null);
  const [aulaId, setAulaId] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  const concluidas = new Set(progresso.concluidas);
  const total = TODAS_AULAS.length;
  const feitas = progresso.concluidas.filter((id) => TODAS_AULAS.some((t) => t.aula.id === id)).length;
  const nivel = nivelDoVendedor(concluidas);
  const proxima = proximaAula(concluidas);
  const certificados = TRILHA.filter((m) => moduloCertificado(m, concluidas, progresso.provas)).length;
  const modulo = TRILHA.find((m) => m.id === moduloId) ?? null;
  const aula = modulo?.aulas.find((a) => a.id === aulaId) ?? null;
  const totalPerguntas = TODAS_AULAS.reduce((s, { aula }) => s + aula.quiz.length, 0) + TRILHA.reduce((s, m) => s + m.prova.length, 0);

  function concluir(id: string, nota: number) { startSalvar(async () => { setProgresso(await concluirAulaAcademia(id, nota)); }); }
  function reabrir(id: string) { startSalvar(async () => { setProgresso(await reabrirAulaAcademia(id)); }); }
  function registrarProva(mid: string, nota: number) { startSalvar(async () => { setProgresso(await registrarProvaAcademia(mid, nota)); }); }
  function registrarRevisao(r: { id: string; acertou: boolean }[]) { startSalvar(async () => { setProgresso(await registrarRevisaoAcademia(r)); }); }
  function registrarCertificacao(nota: number) { startSalvar(async () => { setProgresso(await registrarCertificacaoAcademia(nota)); }); }

  // ── Aula aberta ──
  if (modulo && aula) {
    const idx = modulo.aulas.findIndex((a) => a.id === aula.id);
    const seguinte = modulo.aulas[idx + 1] ?? null;
    const ultimaDoModulo = !seguinte;
    return (
      <div className="space-y-4">
        <AulaView key={aula.id} modulo={modulo} aula={aula} concluida={concluidas.has(aula.id)} nota={progresso.notas[aula.id]}
          onConcluir={(n) => concluir(aula.id, n)} onReabrir={() => reabrir(aula.id)} onVoltar={() => setAulaId(null)} salvando={salvando} />
        <div className="flex flex-wrap justify-end gap-2">
          {seguinte && <button onClick={() => { setAulaId(seguinte.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800">Próxima aula: {seguinte.titulo} <ArrowRight size={14} /></button>}
          {ultimaDoModulo && <button onClick={() => { setAulaId(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800"><GraduationCap size={14} /> Ir para a prova final do módulo {modulo.nivel}</button>}
        </div>
      </div>
    );
  }

  // ── Módulo aberto ──
  if (modulo) {
    const pct = progressoModulo(modulo, concluidas);
    const certificado = moduloCertificado(modulo, concluidas, progresso.provas);
    const proxModulo = TRILHA.find((m) => m.nivel === modulo.nivel + 1) ?? null;
    const minutos = modulo.aulas.reduce((s, a) => s + a.minutos, 0);
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <button onClick={() => setModuloId(null)} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><ChevronLeft size={14} /> Todos os módulos</button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: modulo.cor }}>Nível {modulo.nivel} · {modulo.tema}</div>
              <h2 className="text-xl font-black text-slate-900">{modulo.titulo}</h2>
              <p className="mt-1 text-sm text-slate-500">{modulo.descricao}</p>
              <p className="mt-1 text-xs text-slate-400">{modulo.aulas.length} aulas · {minutos} min · prova final com {modulo.prova.length} perguntas · simulador com IA</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black" style={{ color: modulo.cor }}>{pct}%</div>
              <div className="text-xs text-slate-400">concluído</div>
              {certificado && <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700"><BadgeCheck size={12} /> certificado</div>}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Target size={13} /> Ao terminar este módulo você vai saber</div>
            <ul className="space-y-1">
              {modulo.objetivos.map((o, i) => <li key={i} className="flex gap-2 text-sm text-slate-700"><CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: modulo.cor }} /><span>{o}</span></li>)}
            </ul>
          </div>

          <div className="mt-4 space-y-2">
            {modulo.aulas.map((a, i) => {
              const ok = concluidas.has(a.id);
              return (
                <button key={a.id} onClick={() => setAulaId(a.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left transition hover:border-brand-300 hover:bg-slate-50 sm:px-4">
                  {ok ? <CheckCircle2 size={20} className="shrink-0 text-green-600" /> : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-black" style={{ borderColor: modulo.cor, color: modulo.cor }}>{i + 1}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-800">{a.titulo}</span>
                    <span className="block truncate text-xs text-slate-500">{a.resumo}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400"><Clock size={11} className="mr-0.5 inline" />{a.minutos} min{progresso.notas[a.id] != null ? ` · ${progresso.notas[a.id]}%` : ""}</span>
                </button>
              );
            })}
          </div>

          {modulo.leituras.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><BookOpen size={13} /> Para ir mais fundo</div>
              <ul className="space-y-0.5 text-sm text-slate-600">
                {modulo.leituras.map((l, i) => <li key={i}>• {l}</li>)}
              </ul>
            </div>
          )}
        </div>

        <ProvaFinal key={modulo.id} modulo={modulo} liberada={pct === 100} melhorNota={progresso.provas[modulo.id]} onRegistrar={(n) => registrarProva(modulo.id, n)} salvando={salvando} />
        <TreinoIA modulo={modulo} />

        {certificado && proxModulo && (
          <div className="flex justify-end">
            <button onClick={() => { setModuloId(proxModulo.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800">Ir para o módulo {proxModulo.nivel}: {proxModulo.titulo} <ArrowRight size={14} /></button>
          </div>
        )}
      </div>
    );
  }

  // ── Mapa da trilha ──
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-900 p-4 text-white sm:p-5 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-agro-400">Seu nível</div>
              <div className="text-2xl font-black">{nivel.nivel}/10 · {nivel.titulo}</div>
              <div className="mt-1 text-sm text-slate-300">
                {feitas} de {total} aulas · {certificados} de {TRILHA.length} módulos certificados
                {progresso.treinos ? ` · ${progresso.treinos} simulação(ões) · melhor ${progresso.melhorNota}/10` : ""}
                {(progresso.certificacao ?? 0) >= NOTA_MINIMA_CERTIFICACAO ? " · Mestre em Vendas certificado" : ""}
              </div>
            </div>
            <Trophy size={40} className="text-agro-400" />
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-agro-400 to-emerald-400" style={{ width: `${Math.round((feitas / total) * 100)}%` }} /></div>
          <div className="mt-2 text-[11px] text-slate-400">{TRILHA.length} módulos · {total} aulas · ~{Math.round(TOTAL_MINUTOS / 60)} h de conteúdo · {totalPerguntas} perguntas de cenário · revisão espaçada · simulador com IA · certificação final</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{proxima ? "Continuar de onde parou" : "Trilha completa"}</div>
          {proxima ? (
            <>
              <div className="mt-1 text-xs text-slate-400">Nível {proxima.modulo.nivel} · {proxima.modulo.titulo}</div>
              <div className="font-bold text-slate-800">{proxima.aula.titulo}</div>
              <button onClick={() => { setModuloId(proxima.modulo.id); setAulaId(proxima.aula.id); }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800">Abrir aula <ArrowRight size={14} /></button>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Parabéns. Faça a certificação final, mantenha a revisão espaçada em dia e use o simulador antes das visitas importantes.</p>
          )}
        </div>
      </div>

      <Revisao progresso={progresso} onRegistrar={registrarRevisao} salvando={salvando} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {TRILHA.map((m, i) => {
          const pct = progressoModulo(m, concluidas);
          const anterior = TRILHA[i - 1];
          const recomendado = !anterior || progressoModulo(anterior, concluidas) === 100;
          const cert = moduloCertificado(m, concluidas, progresso.provas);
          return (
            <button key={m.id} onClick={() => setModuloId(m.id)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ background: `${m.cor}22`, color: m.cor }}>Nível {m.nivel} · {m.tema}</span>
                {cert ? <span title="Módulo certificado"><BadgeCheck size={18} className="text-green-600" /></span> : pct === 100 ? <span title="Aulas concluídas — falta a prova final"><CheckCircle2 size={18} className="text-amber-500" /></span> : !recomendado ? <span title="Recomendado após concluir o módulo anterior"><Lock size={15} className="text-slate-300" /></span> : null}
              </div>
              <div className="font-bold text-slate-800">{m.titulo}</div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{m.descricao}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.cor }} /></div>
                <span className="text-xs font-bold text-slate-500">{pct}%</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">{m.aulas.length} aulas · {m.aulas.reduce((s, a) => s + a.minutos, 0)} min · prova com {m.prova.length} perguntas · simulador</div>
            </button>
          );
        })}
      </div>

      <Certificacao progresso={progresso} onRegistrar={registrarCertificacao} salvando={salvando} />
    </div>
  );
}
