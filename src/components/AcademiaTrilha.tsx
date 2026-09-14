"use client";

import { useState, useTransition } from "react";
import { TRILHA, TODAS_AULAS, proximaAula, progressoModulo, nivelDoVendedor, type Modulo, type Aula, type Bloco } from "@/lib/academia-trilha";
import { concluirAulaAcademia, reabrirAulaAcademia, gerarCenarioTreinoAction, avaliarTreinoAction, type ProgressoAcademia } from "@/lib/academia-actions";
import type { CenarioTreino, AvaliacaoTreino } from "@/lib/ai/treino";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Circle, ChevronLeft, Clock, Target, Lightbulb, MessageSquareQuote, Sparkles, Loader2, Trophy, Lock, ArrowRight, RotateCcw, Award,
} from "lucide-react";

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
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: `${cor}66`, background: `${cor}14` }}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: cor }}>
        <Lightbulb size={13} /> {b.titulo ?? "Destaque"}
      </div>
      <p className="text-sm font-medium leading-relaxed text-slate-800">{b.texto}</p>
    </div>
  );
}

function AulaView({ modulo, aula, concluida, nota, onConcluir, onReabrir, onVoltar, salvando }: {
  modulo: Modulo; aula: Aula; concluida: boolean; nota: number | undefined;
  onConcluir: (notaQuiz: number) => void; onReabrir: () => void; onVoltar: () => void; salvando: boolean;
}) {
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [conferido, setConferido] = useState(false);
  const acertos = aula.quiz.filter((q, i) => respostas[i] === q.correta).length;
  const todasRespondidas = aula.quiz.every((_, i) => respostas[i] != null);
  const notaQuiz = aula.quiz.length ? Math.round((acertos / aula.quiz.length) * 100) : 100;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <button onClick={onVoltar} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
        <ChevronLeft size={14} /> Módulo {modulo.nivel}: {modulo.titulo}
      </button>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-black text-slate-900">{aula.titulo}</h2>
        {concluida && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700"><CheckCircle2 size={12} /> concluída{nota != null ? ` · quiz ${nota}%` : ""}</span>}
      </div>
      <p className="mb-1 text-sm text-slate-500">{aula.resumo}</p>
      <p className="mb-5 flex items-center gap-1 text-xs text-slate-400"><Clock size={12} /> {aula.minutos} min de leitura</p>

      <div className="space-y-5">
        {aula.blocos.map((b, i) => <BlocoView key={i} b={b} cor={modulo.cor} />)}
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700"><Target size={13} /> Missão prática</div>
        <p className="text-sm text-amber-900">{aula.missao}</p>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">Quiz da aula</h3>
        <div className="space-y-4">
          {aula.quiz.map((q, qi) => (
            <div key={qi} className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-800">{qi + 1}. {q.pergunta}</p>
              <div className="space-y-1.5">
                {q.opcoes.map((op, oi) => {
                  const marcada = respostas[qi] === oi;
                  const certa = conferido && oi === q.correta;
                  const errada = conferido && marcada && oi !== q.correta;
                  return (
                    <button key={oi} disabled={conferido} onClick={() => setRespostas((r) => ({ ...r, [qi]: oi }))}
                      className={cn("flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                        certa ? "border-green-400 bg-green-50 text-green-800" : errada ? "border-red-300 bg-red-50 text-red-700" : marcada ? "border-brand-500 bg-brand-50 text-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50")}>
                      {marcada || certa ? <CheckCircle2 size={15} className="shrink-0" /> : <Circle size={15} className="shrink-0 text-slate-300" />}
                      {op}
                    </button>
                  );
                })}
              </div>
              {conferido && <p className="mt-2 text-xs text-slate-600"><b>Por quê:</b> {q.explicacao}</p>}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!conferido ? (
            <button onClick={() => setConferido(true)} disabled={!todasRespondidas}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
              Conferir respostas
            </button>
          ) : (
            <>
              <span className={cn("text-sm font-bold", notaQuiz >= 70 ? "text-green-700" : "text-amber-700")}>
                {acertos}/{aula.quiz.length} certas ({notaQuiz}%)
              </span>
              <button onClick={() => { setConferido(false); setRespostas({}); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <RotateCcw size={13} /> Refazer
              </button>
            </>
          )}
          {!concluida ? (
            <button onClick={() => onConcluir(conferido ? notaQuiz : 0)} disabled={salvando || !conferido}
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

function TreinoIA({ modulo }: { modulo: Modulo }) {
  const [cenario, setCenario] = useState<CenarioTreino | null>(null);
  const [resposta, setResposta] = useState("");
  const [avaliacao, setAvaliacao] = useState<AvaliacaoTreino | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, startGerar] = useTransition();
  const [avaliando, startAvaliar] = useTransition();

  function gerar() {
    setErro(null); setAvaliacao(null); setResposta("");
    startGerar(async () => {
      const r = await gerarCenarioTreinoAction(modulo.id);
      if (!r.ok || !r.cenario) { setErro(r.erro ?? "Falha ao gerar cenário."); return; }
      setCenario(r.cenario);
    });
  }

  function avaliar() {
    if (!cenario) return;
    setErro(null);
    startAvaliar(async () => {
      const r = await avaliarTreinoAction(modulo.id, cenario, resposta);
      if (!r.ok || !r.avaliacao) { setErro(r.erro ?? "Falha ao avaliar."); return; }
      setAvaliacao(r.avaliacao);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700"><Sparkles size={15} style={{ color: modulo.cor }} /> Treino com IA — {modulo.tema}</div>
      <p className="mb-3 text-xs text-slate-500">A IA cria um cliente do seu mercado com um desafio deste módulo. Você responde como responderia no WhatsApp ou na obra, e recebe nota, correções e a versão de um vendedor de elite.</p>
      <button onClick={gerar} disabled={gerando} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        {gerando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {cenario ? "Novo cenário" : "Gerar cenário"}
      </button>
      {erro && <p className="mt-2 text-sm font-semibold text-red-600">{erro}</p>}
      {cenario && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <p><b>Cliente:</b> {cenario.cliente}</p>
            <p className="mt-1"><b>Situação:</b> {cenario.situacao}</p>
            <p className="mt-2 rounded-lg bg-white px-3 py-2 italic shadow-sm">“{cenario.fala}”</p>
            <p className="mt-2 text-xs text-slate-500"><b>Seu objetivo:</b> {cenario.objetivo}</p>
          </div>
          <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={4} disabled={!!avaliacao}
            placeholder="Escreva exatamente o que você responderia ao cliente…"
            className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50" />
          {!avaliacao && (
            <button onClick={avaliar} disabled={avaliando || !resposta.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
              {avaliando ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />} Avaliar minha resposta
            </button>
          )}
          {avaliacao && (
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex items-center gap-3">
                <span className={cn("rounded-full px-3 py-1 text-lg font-black", avaliacao.nota >= 8 ? "bg-green-100 text-green-700" : avaliacao.nota >= 6 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>{avaliacao.nota}/10</span>
                <span className="text-sm text-slate-500">{avaliacao.nota >= 8 ? "Excelente — nível de elite." : avaliacao.nota >= 6 ? "Bom, mas dá pra fechar mais." : "Ainda deixa venda na mesa. Veja as correções."}</span>
              </div>
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
              <button onClick={gerar} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"><ArrowRight size={12} /> Treinar outro cenário</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const modulo = TRILHA.find((m) => m.id === moduloId) ?? null;
  const aula = modulo?.aulas.find((a) => a.id === aulaId) ?? null;

  function concluir(id: string, nota: number) {
    startSalvar(async () => { setProgresso(await concluirAulaAcademia(id, nota)); });
  }
  function reabrir(id: string) {
    startSalvar(async () => { setProgresso(await reabrirAulaAcademia(id)); });
  }

  // ── Aula aberta ──
  if (modulo && aula) {
    return (
      <div className="space-y-4">
        <AulaView modulo={modulo} aula={aula} concluida={concluidas.has(aula.id)} nota={progresso.notas[aula.id]}
          onConcluir={(n) => concluir(aula.id, n)} onReabrir={() => reabrir(aula.id)} onVoltar={() => setAulaId(null)} salvando={salvando} />
        {(() => {
          const idx = modulo.aulas.findIndex((a) => a.id === aula.id);
          const seguinte = modulo.aulas[idx + 1] ?? null;
          const proxModulo = !seguinte ? TRILHA.find((m) => m.nivel === modulo.nivel + 1) ?? null : null;
          return (
            <div className="flex flex-wrap justify-end gap-2">
              {seguinte && <button onClick={() => setAulaId(seguinte.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800">Próxima aula: {seguinte.titulo} <ArrowRight size={14} /></button>}
              {proxModulo && <button onClick={() => { setModuloId(proxModulo.id); setAulaId(null); }} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800">Ir para o módulo {proxModulo.nivel} <ArrowRight size={14} /></button>}
            </div>
          );
        })()}
      </div>
    );
  }

  // ── Módulo aberto ──
  if (modulo) {
    const pct = progressoModulo(modulo, concluidas);
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <button onClick={() => setModuloId(null)} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><ChevronLeft size={14} /> Todos os módulos</button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: modulo.cor }}>Nível {modulo.nivel} · {modulo.tema}</div>
              <h2 className="text-xl font-black text-slate-900">{modulo.titulo}</h2>
              <p className="mt-1 text-sm text-slate-500">{modulo.descricao}</p>
            </div>
            <div className="text-right"><div className="text-2xl font-black" style={{ color: modulo.cor }}>{pct}%</div><div className="text-xs text-slate-400">concluído</div></div>
          </div>
          <div className="mt-4 space-y-2">
            {modulo.aulas.map((a, i) => {
              const ok = concluidas.has(a.id);
              return (
                <button key={a.id} onClick={() => setAulaId(a.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand-300 hover:bg-slate-50">
                  {ok ? <CheckCircle2 size={20} className="shrink-0 text-green-600" /> : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-black" style={{ borderColor: modulo.cor, color: modulo.cor }}>{i + 1}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-800">{a.titulo}</span>
                    <span className="block truncate text-xs text-slate-500">{a.resumo}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400"><Clock size={11} className="mr-0.5 inline" />{a.minutos} min{progresso.notas[a.id] != null ? ` · quiz ${progresso.notas[a.id]}%` : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
        <TreinoIA modulo={modulo} />
      </div>
    );
  }

  // ── Mapa da trilha ──
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-900 p-5 text-white md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-agro-400">Seu nível</div>
              <div className="text-2xl font-black">{nivel.nivel}/10 · {nivel.titulo}</div>
              <div className="mt-1 text-sm text-slate-300">{feitas} de {total} aulas concluídas{progresso.treinos ? ` · ${progresso.treinos} treino(s) com IA · melhor nota ${progresso.melhorNota}/10` : ""}</div>
            </div>
            <Trophy size={40} className="text-agro-400" />
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-agro-400 to-emerald-400" style={{ width: `${Math.round((feitas / total) * 100)}%` }} /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{proxima ? "Continuar de onde parou" : "Trilha completa"}</div>
          {proxima ? (
            <>
              <div className="mt-1 text-xs text-slate-400">Nível {proxima.modulo.nivel} · {proxima.modulo.titulo}</div>
              <div className="font-bold text-slate-800">{proxima.aula.titulo}</div>
              <button onClick={() => { setModuloId(proxima.modulo.id); setAulaId(proxima.aula.id); }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800">Abrir aula <ArrowRight size={14} /></button>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Parabéns. Refaça as missões com clientes novos e use o treino com IA antes das visitas importantes.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {TRILHA.map((m, i) => {
          const pct = progressoModulo(m, concluidas);
          const anterior = TRILHA[i - 1];
          const recomendado = !anterior || progressoModulo(anterior, concluidas) === 100;
          return (
            <button key={m.id} onClick={() => setModuloId(m.id)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ background: `${m.cor}22`, color: m.cor }}>Nível {m.nivel} · {m.tema}</span>
                {pct === 100 ? <CheckCircle2 size={18} className="text-green-600" /> : !recomendado ? <span title="Recomendado após concluir o módulo anterior"><Lock size={15} className="text-slate-300" /></span> : null}
              </div>
              <div className="font-bold text-slate-800">{m.titulo}</div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{m.descricao}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.cor }} /></div>
                <span className="text-xs font-bold text-slate-500">{pct}%</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">{m.aulas.length} aulas · {m.aulas.reduce((s, a) => s + a.minutos, 0)} min · quiz + missão + treino com IA</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
