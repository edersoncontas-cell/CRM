"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, EmptyState } from "@/components/ui";
import { buscarOrientadorAnalise, criarNegociacaoDoOrientador, descartarCardOrientador } from "@/lib/actions";
import { PERIODOS_ORIENTADOR, type PeriodoOrientador } from "@/lib/orientador-periodos";
import { formatDateTime } from "@/lib/utils";
import {
  Flame, ThermometerSun, Snowflake, X, Compass, Target, AlertTriangle, MessageSquareQuote, Check, Loader2, MessageCircle, Sparkles,
} from "lucide-react";

type Item = {
  clienteId: string;
  conversaId: string;
  clienteNome: string;
  municipio: string | null;
  ultimaMensagem: string | null;
  ultimaMensagemEm: string;
  estagioVenda: string | null;
  perfilComprador: string | null;
  temperatura: string | null;
  probabilidadeFechamento: number | null;
  proximaAcao: string | null;
  atualizadoEm: string | null;
};

type Detalhe = {
  clienteNome: string;
  municipio: string | null;
  estagioVenda: string;
  perfilComprador: string | null;
  objecoes: string[];
  probabilidadeFechamento: number | null;
  probabilidadeExplicacao: string | null;
  temperatura: string;
  proximaAcao: string | null;
  melhorResposta: string | null;
  oportunidadesPerdidas: string[];
  resumoNegociacao: string | null;
  atualizadoEm: string;
};

const TEMPERATURA_INFO: Record<string, { label: string; tom: "red" | "orange" | "yellow" | "blue"; icon: typeof Flame }> = {
  muito_quente: { label: "Muito quente", tom: "red", icon: Flame },
  quente: { label: "Quente", tom: "orange", icon: Flame },
  morna: { label: "Morna", tom: "yellow", icon: ThermometerSun },
  fria: { label: "Fria", tom: "blue", icon: Snowflake },
};

function BadgeTemperatura({ temperatura }: { temperatura: string }) {
  const info = TEMPERATURA_INFO[temperatura] ?? TEMPERATURA_INFO.morna;
  const Icon = info.icon;
  return <Badge tom={info.tom}><Icon size={12} className="mr-1 inline" /> {info.label}</Badge>;
}

function tempoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `há ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

export function OrientadorLista({ itens, contagem, periodo }: {
  itens: Item[]; contagem: Record<PeriodoOrientador, number>; periodo: PeriodoOrientador;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string; link?: string } | null>(null);
  const [, startTransition] = useTransition();

  async function abrir(clienteId: string) {
    setAberto(clienteId);
    setCarregando(true);
    const d = await buscarOrientadorAnalise(clienteId);
    setDetalhe(d);
    setCarregando(false);
  }

  function esconder(clienteId: string) {
    setRemovidos((s) => new Set(s).add(clienteId));
  }

  async function confirmarNegociacao(item: Item) {
    setOcupado(item.clienteId);
    setAviso(null);
    const r = await criarNegociacaoDoOrientador(item.clienteId);
    setOcupado(null);
    if (!r.ok) { setAviso({ tipo: "erro", texto: r.erro ?? "Não foi possível registrar a negociação." }); return; }
    esconder(item.clienteId);
    setAviso({
      tipo: "ok",
      texto: `${r.criada ? "Negociação registrada" : "Negociação existente movida"} em "${r.coluna}" para ${item.clienteNome}${r.maquina ? ` · máquina identificada: ${r.maquina}` : " · máquina não identificada, complete no funil"}.`,
      link: "/negociacoes",
    });
    startTransition(() => router.refresh());
  }

  async function descartar(item: Item) {
    setOcupado(item.clienteId);
    await descartarCardOrientador(item.clienteId);
    setOcupado(null);
    esconder(item.clienteId);
    startTransition(() => router.refresh());
  }

  const visiveis = itens.filter((i) => !removidos.has(i.clienteId));
  const periodos = Object.entries(PERIODOS_ORIENTADOR) as [PeriodoOrientador, (typeof PERIODOS_ORIENTADOR)[PeriodoOrientador]][];

  return (
    <>
      {/* Contadores de clientes conversados por janela (também no Dashboard) */}
      <div className="mb-4 grid grid-cols-3 gap-2 md:grid-cols-6">
        {periodos.map(([k, p]) => (
          <Link
            key={k}
            href={`/orientador?periodo=${k}`}
            className={`rounded-xl border px-3 py-2 text-center transition ${periodo === k ? "border-brand-700 bg-brand-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"}`}
          >
            <div className={`text-xl font-black ${periodo === k ? "text-agro-400" : "text-slate-800"}`}>{contagem[k]}</div>
            <div className={`text-[11px] font-semibold ${periodo === k ? "text-slate-300" : "text-slate-500"}`}>{p.label}</div>
          </Link>
        ))}
      </div>

      {aviso && (
        <div className={`mb-4 flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${aviso.tipo === "ok" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          <span>{aviso.texto}{aviso.link && <> <Link href={aviso.link} className="font-semibold underline">Abrir funil</Link></>}</span>
          <button onClick={() => setAviso(null)} aria-label="Fechar"><X size={16} /></button>
        </div>
      )}

      {visiveis.length === 0 ? (
        <EmptyState
          icone={<Compass size={28} />}
          texto={`Nenhum cliente com conversa no período (${PERIODOS_ORIENTADOR[periodo].label.toLowerCase()})`}
          subtexto="Assim que um cliente cadastrado mandar mensagem no WhatsApp, o card dele aparece aqui automaticamente."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((a) => {
            const emAndamento = ocupado === a.clienteId;
            return (
              <Card key={a.clienteId} className="flex h-full flex-col transition hover:border-brand-300 hover:shadow-md">
                <button onClick={() => abrir(a.clienteId)} className="flex-1 text-left">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-800">{a.clienteNome}</div>
                      {a.municipio && <div className="text-xs text-slate-400">{a.municipio}</div>}
                    </div>
                    {a.temperatura ? <BadgeTemperatura temperatura={a.temperatura} /> : <Badge tom="slate"><Sparkles size={12} className="mr-1 inline" />analisando</Badge>}
                  </div>

                  {a.ultimaMensagem && (
                    <div className="mb-2 flex items-start gap-1.5 text-xs text-slate-500">
                      <MessageCircle size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                      <span className="line-clamp-2">{a.ultimaMensagem}</span>
                    </div>
                  )}
                  <div className="mb-2 text-[11px] text-slate-400">Última mensagem {tempoRelativo(a.ultimaMensagemEm)}</div>

                  {a.estagioVenda && <div className="mb-2 text-sm text-slate-600">{a.estagioVenda}</div>}
                  {a.probabilidadeFechamento != null && (
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-agro-400 to-emerald-500" style={{ width: `${a.probabilidadeFechamento}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{a.probabilidadeFechamento}%</span>
                    </div>
                  )}
                  {a.proximaAcao && (
                    <div className="mt-1 flex items-start gap-1.5 rounded-lg bg-brand-50 p-2 text-xs text-brand-700">
                      <Target size={13} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{a.proximaAcao}</span>
                    </div>
                  )}
                </button>

                <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => confirmarNegociacao(a)}
                    disabled={emAndamento}
                    title="Registrar negociação na coluna EM NEGOCIAÇÃO"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {emAndamento ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} strokeWidth={3} />} Negociação?
                  </button>
                  <button
                    onClick={() => descartar(a)}
                    disabled={emAndamento}
                    title="Remover este card (volta se chegar mensagem nova)"
                    className="flex h-9 w-11 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <X size={16} strokeWidth={3} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAberto(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {carregando ? (
              <div className="py-10 text-center text-sm text-slate-400">Carregando…</div>
            ) : !detalhe ? (
              <div className="py-8 text-center text-sm text-slate-500">
                A IA ainda não analisou esta conversa. Assim que a próxima mensagem chegar, a leitura completa aparece aqui.
                <div className="mt-3"><Link href={`/clientes/${aberto}`} className="text-xs font-semibold text-brand-600 hover:underline">ver cadastro</Link></div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-800">{detalhe.clienteNome}</h2>
                      <Link href={`/clientes/${aberto}`} className="text-xs font-semibold text-brand-600 hover:underline">ver cadastro</Link>
                    </div>
                    {detalhe.municipio && <p className="text-xs text-slate-400">{detalhe.municipio}</p>}
                  </div>
                  <button onClick={() => setAberto(null)}><X size={18} className="text-slate-400" /></button>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <BadgeTemperatura temperatura={detalhe.temperatura} />
                  <Badge tom="slate">{detalhe.estagioVenda}</Badge>
                  {detalhe.perfilComprador && <Badge tom="purple">{detalhe.perfilComprador}</Badge>}
                </div>

                {detalhe.resumoNegociacao && <p className="mb-3 text-sm text-slate-600">{detalhe.resumoNegociacao}</p>}

                {detalhe.probabilidadeFechamento != null && (
                  <div className="mb-4 rounded-xl border border-slate-100 p-3">
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>Probabilidade de fechamento</span><span>{detalhe.probabilidadeFechamento}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-agro-400 to-emerald-500" style={{ width: `${detalhe.probabilidadeFechamento}%` }} />
                    </div>
                    {detalhe.probabilidadeExplicacao && <p className="mt-1.5 text-xs text-slate-500">{detalhe.probabilidadeExplicacao}</p>}
                  </div>
                )}

                {detalhe.proximaAcao && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
                    <Target size={15} className="mt-0.5 shrink-0" />
                    <div><span className="font-semibold">Próxima ação: </span>{detalhe.proximaAcao}</div>
                  </div>
                )}

                {detalhe.objecoes.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Objeções identificadas</div>
                    <div className="flex flex-wrap gap-1.5">{detalhe.objecoes.map((o) => <Badge key={o} tom="orange">{o}</Badge>)}</div>
                  </div>
                )}

                {detalhe.oportunidadesPerdidas.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <AlertTriangle size={12} /> Oportunidades perdidas
                    </div>
                    <ul className="space-y-1 text-sm text-slate-600">{detalhe.oportunidadesPerdidas.map((o, i) => <li key={i}>• {o}</li>)}</ul>
                  </div>
                )}

                {detalhe.melhorResposta && (
                  <div className="mb-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <MessageSquareQuote size={12} /> Melhor resposta sugerida
                    </div>
                    <p className="text-sm text-slate-700">{detalhe.melhorResposta}</p>
                  </div>
                )}

                <div className="mt-3 text-xs text-slate-400">Atualizado {formatDateTime(detalhe.atualizadoEm)}</div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
