"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Badge, EmptyState } from "@/components/ui";
import { buscarOrientadorAnalise } from "@/lib/actions";
import { formatDateTime } from "@/lib/utils";
import { Flame, ThermometerSun, Snowflake, X, Compass, Target, AlertTriangle, MessageSquareQuote } from "lucide-react";

type ItemLista = {
  clienteId: string;
  clienteNome: string;
  municipio: string | null;
  estagioVenda: string;
  perfilComprador: string | null;
  temperatura: string;
  probabilidadeFechamento: number | null;
  proximaAcao: string | null;
  atualizadoEm: string;
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

export function OrientadorLista({ analises }: { analises: ItemLista[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function abrir(clienteId: string) {
    setAberto(clienteId);
    setCarregando(true);
    const d = await buscarOrientadorAnalise(clienteId);
    setDetalhe(d);
    setCarregando(false);
  }

  if (!analises.length) {
    return (
      <EmptyState
        icone={<Compass size={28} />}
        texto="Nenhuma análise ainda"
        subtexto="Assim que uma conversa de WhatsApp vinculada a um cliente receber uma mensagem, o Orientador de Vendas monta o painel aqui automaticamente."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {analises.map((a) => (
          <button key={a.clienteId} onClick={() => abrir(a.clienteId)} className="text-left">
            <Card className="h-full transition hover:border-brand-300 hover:shadow-md">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-800">{a.clienteNome}</div>
                  {a.municipio && <div className="text-xs text-slate-400">{a.municipio}</div>}
                </div>
                <BadgeTemperatura temperatura={a.temperatura} />
              </div>
              <div className="mb-2 text-sm text-slate-600">{a.estagioVenda}</div>
              {a.probabilidadeFechamento != null && (
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-agro-400 to-emerald-500" style={{ width: `${a.probabilidadeFechamento}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{a.probabilidadeFechamento}%</span>
                </div>
              )}
              {a.proximaAcao && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-brand-50 p-2 text-xs text-brand-700">
                  <Target size={13} className="mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{a.proximaAcao}</span>
                </div>
              )}
              <div className="mt-2 text-xs text-slate-400">Atualizado {formatDateTime(a.atualizadoEm)}</div>
            </Card>
          </button>
        ))}
      </div>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAberto(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {carregando || !detalhe ? (
              <div className="py-10 text-center text-sm text-slate-400">Carregando…</div>
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

                {detalhe.resumoNegociacao && (
                  <p className="mb-3 text-sm text-slate-600">{detalhe.resumoNegociacao}</p>
                )}

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
                    <div className="flex flex-wrap gap-1.5">
                      {detalhe.objecoes.map((o) => <Badge key={o} tom="orange">{o}</Badge>)}
                    </div>
                  </div>
                )}

                {detalhe.oportunidadesPerdidas.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <AlertTriangle size={12} /> Oportunidades perdidas
                    </div>
                    <ul className="space-y-1 text-sm text-slate-600">
                      {detalhe.oportunidadesPerdidas.map((o, i) => <li key={i}>• {o}</li>)}
                    </ul>
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
