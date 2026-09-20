"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, EmptyState } from "@/components/ui";
import { zerarOrientadorAction, analisarLoteOrientadorAction, descartarCardOrientadorAction } from "@/lib/actions";
import { PERIODOS_ORIENTADOR, type PeriodoOrientador } from "@/lib/orientador-periodos";
import {
  ordenarPorPrioridade, aplicarFiltro, leituraDesatualizada, idadeDaLeitura,
  FILTROS, type FiltroOrientador,
} from "@/lib/orientador-prioridade";
import { cn } from "@/lib/utils";
import {
  Flame, ThermometerSun, Snowflake, X, Compass, Target, Loader2, MessageCircle,
  Sparkles, RefreshCw, Eraser, CalendarPlus, BookOpen, Trash2, ShieldAlert,
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
  ultimaFoiDoCliente?: boolean;
  alertaNivel?: "vermelho" | "amarelo" | "verde" | null;
  temContexto?: boolean;
};

type Coaching = {
  personalidade: { estilo: string | null; descricao: string; comoFalar: string[]; evitar: string[]; papel: string | null };
  alertaAgora: { nivel: "vermelho" | "amarelo" | "verde"; titulo: string; motivo: string } | null;
  conducao: { nota: number; acertos: string[]; correcoes: string[] };
  perguntasAgora: string[];
  informacoesFaltando: string[];
  roteiro: { etapa: string; status: "feito" | "agora" | "depois"; dica: string }[];
  sinaisCompra: string[];
  sinaisRisco: string[];
  tratamentoObjecoes: { objecao: string; comoTratar: string }[];
  tecnicaAcademia: { nome: string; porque: string } | null;
};

type NotaContexto = { id: string; texto: string; origem: string; criadoEm: string };


const TEMPERATURA_INFO: Record<string, { label: string; tom: "red" | "orange" | "yellow" | "blue"; icon: typeof Flame }> = {
  muito_quente: { label: "Muito quente", tom: "red", icon: Flame },
  quente: { label: "Quente", tom: "orange", icon: Flame },
  morna: { label: "Morna", tom: "yellow", icon: ThermometerSun },
  fria: { label: "Fria", tom: "blue", icon: Snowflake },
};

const COR_ALERTA: Record<string, { fundo: string; texto: string; borda: string }> = {
  vermelho: { fundo: "bg-red-50", texto: "text-red-700", borda: "border-red-200" },
  amarelo: { fundo: "bg-amber-50", texto: "text-amber-800", borda: "border-amber-200" },
  verde: { fundo: "bg-emerald-50", texto: "text-emerald-700", borda: "border-emerald-200" },
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

function Secao({ icone, titulo, children }: { icone: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icone} {titulo}
      </div>
      {children}
    </div>
  );
}

// ── Card de leitura ─────────────────────────────────────────────────────────
function CardOrientador({ a, analisando, descartando, onAbrir, onAnalisar, onDescartar }: {
  a: Item; analisando: boolean; descartando: boolean;
  onAbrir: () => void; onAnalisar: () => void; onDescartar: () => void;
}) {
  const desatualizado = leituraDesatualizada(a);
  const alerta = a.alertaNivel ? COR_ALERTA[a.alertaNivel] : null;
  return (
    <div className="h-full">
      <Card className={cn("flex h-full flex-col transition hover:border-brand-300 hover:shadow-md", a.alertaNivel === "vermelho" && "border-red-200")}>
        <div className="mb-2 flex items-start gap-2">
          <button onClick={onAbrir} className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-slate-800">{a.clienteNome}</span>
              {a.temContexto && <BookOpen size={12} className="shrink-0 text-violet-500" aria-label="Tem contexto que você ensinou" />}
            </div>
            {a.municipio && <div className="text-xs text-slate-400">{a.municipio}</div>}
          </button>
          {a.temperatura ? <BadgeTemperatura temperatura={a.temperatura} /> : (
            <button onClick={(e) => { e.stopPropagation(); onAnalisar(); }} disabled={analisando} title="Pedir a leitura da IA agora" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-agro-400/20 px-2 py-0.5 text-[11px] font-bold text-agro-700 hover:bg-agro-400/40 disabled:opacity-60">
              {analisando ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} {analisando ? "analisando" : "analisar"}
            </button>
          )}
        </div>

        {/* O aviso do momento — o que a IA já calculava e ninguém via */}
        {alerta && a.alertaNivel && (
          <div className={cn("mb-2 flex items-start gap-1.5 rounded-lg border p-2 text-[11px] font-semibold", alerta.fundo, alerta.texto, alerta.borda)}>
            <ShieldAlert size={13} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">
              {a.alertaNivel === "vermelho" ? "Atenção agora" : a.alertaNivel === "amarelo" ? "Fique de olho" : "Momento de avançar"}
            </span>
          </div>
        )}

        <button onClick={onAbrir} className="flex-1 text-left">
          {a.ultimaMensagem && (
            <div className="mb-2 flex items-start gap-1.5 text-xs text-slate-500">
              <MessageCircle size={12} className={cn("mt-0.5 shrink-0", a.ultimaFoiDoCliente ? "text-emerald-500" : "text-slate-300")} />
              <span className="line-clamp-2">{a.ultimaMensagem}</span>
            </div>
          )}
          <div className="mb-2 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
            <span>{a.ultimaFoiDoCliente ? "Esperando você" : "Você respondeu"} · {tempoRelativo(a.ultimaMensagemEm)}</span>
            <span className={cn(desatualizado && "font-semibold text-amber-600")}>{idadeDaLeitura(a.atualizadoEm)}</span>
          </div>
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
          <Link
            href={`/atendimento?cliente=${a.clienteId}`}
            title="Abrir a conversa no WhatsApp"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-100 px-2 py-2 text-xs font-black uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-200"
          >
            <MessageCircle size={15} strokeWidth={2.5} /> Conversa
          </Link>
          <Link
            href={`/visitas?cliente=${a.clienteId}&novo=1`}
            title="Agendar visita para este cliente"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-100 px-2 py-2 text-xs font-black uppercase tracking-wide text-sky-800 ring-1 ring-sky-200 hover:bg-sky-200"
          >
            <CalendarPlus size={15} strokeWidth={2.5} /> Visita
          </Link>
          <button
            onClick={(e) => { e.stopPropagation(); onAnalisar(); }}
            disabled={analisando}
            title="Reler a conversa com a IA agora"
            className={cn("flex items-center justify-center rounded-lg px-2 py-2 ring-1 disabled:opacity-60",
              desatualizado ? "bg-amber-100 text-amber-800 ring-amber-200 hover:bg-amber-200" : "bg-slate-100 text-slate-600 ring-slate-200 hover:bg-slate-200")}
          >
            {analisando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} strokeWidth={2.5} />}
          </button>
          {/* Nem toda conversa é venda: recado, bom dia, assunto pessoal. Tira
              o card daqui. Se o cliente mandar mensagem nova depois, ele volta. */}
          <button
            onClick={(e) => { e.stopPropagation(); onDescartar(); }}
            disabled={descartando}
            title="Não é negociação — tirar este card"
            className="flex items-center justify-center rounded-lg bg-slate-100 px-2 py-2 text-slate-500 ring-1 ring-slate-200 hover:bg-red-100 hover:text-red-700 hover:ring-red-200 disabled:opacity-60"
          >
            {descartando ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} strokeWidth={2.5} />}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ── Lista ───────────────────────────────────────────────────────────────────
export function OrientadorLista({ itens, periodo }: {
  itens: Item[]; periodo: PeriodoOrientador;
}) {
  const router = useRouter();
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string; link?: string } | null>(null);
  const [analisando, setAnalisando] = useState<Set<string>>(new Set());
  const [lote, setLote] = useState<{ total: number; feitas: number } | null>(null);
  const [filtro, setFiltro] = useState<FiltroOrientador>("todos");
  const [, startTransition] = useTransition();

  const [descartando, setDescartando] = useState<Set<string>>(new Set());

  // "Não é negociação": some o card na hora (otimista) e grava. Se der erro,
  // o card volta — não pode sumir da tela sem ter sumido do banco.
  async function descartarUm(item: Item) {
    setDescartando((s) => new Set(s).add(item.clienteId));
    setRemovidos((s) => new Set(s).add(item.clienteId));
    const r = await descartarCardOrientadorAction(item.clienteId).catch(() => ({ ok: false, erro: "Falha ao descartar." }));
    setDescartando((s) => { const n = new Set(s); n.delete(item.clienteId); return n; });
    if (!r.ok) {
      setRemovidos((s) => { const n = new Set(s); n.delete(item.clienteId); return n; });
      setAviso({ tipo: "erro", texto: r.erro ?? "Falha ao descartar." });
      return;
    }
    setAviso({ tipo: "ok", texto: `${item.clienteNome} saiu do Orientador. Se ele mandar mensagem nova, volta.` });
    startTransition(() => router.refresh());
  }

  async function analisarUm(item: Item) {
    setAnalisando((s) => new Set(s).add(item.clienteId));
    const r = await analisarLoteOrientadorAction([item.conversaId]);
    setAnalisando((s) => { const n = new Set(s); n.delete(item.clienteId); return n; });
    if (r.erros.length) setAviso({ tipo: "erro", texto: r.erros[0] });
    startTransition(() => router.refresh());
  }

  // Analisa primeiro quem está no topo da ordem de atacar, em lotes de 3.
  async function analisarRecentes() {
    const alvo = visiveis.filter((i) => leituraDesatualizada(i)).slice(0, 15);
    if (!alvo.length) { setAviso({ tipo: "ok", texto: "Todas as leituras estão em dia." }); return; }
    setLote({ total: alvo.length, feitas: 0 });
    let feitas = 0;
    for (let i = 0; i < alvo.length; i += 3) {
      const grupo = alvo.slice(i, i + 3);
      setAnalisando((s) => { const n = new Set(s); grupo.forEach((g) => n.add(g.clienteId)); return n; });
      const r = await analisarLoteOrientadorAction(grupo.map((g) => g.conversaId));
      feitas += r.feitas;
      setLote({ total: alvo.length, feitas });
      setAnalisando((s) => { const n = new Set(s); grupo.forEach((g) => n.delete(g.clienteId)); return n; });
      if (r.erros.some((e) => e.includes("Orçamento") || e.includes("Nenhuma chave"))) { setAviso({ tipo: "erro", texto: r.erros[0] }); break; }
      startTransition(() => router.refresh());
    }
    setLote(null);
    startTransition(() => router.refresh());
  }

  async function zerar() {
    if (!window.confirm("Zerar o Orientador? Todas as leituras antigas da IA são apagadas e os cards escondidos voltam. O contexto que você ensinou sobre cada cliente NÃO é apagado.")) return;
    const r = await zerarOrientadorAction();
    setRemovidos(new Set());
    setAviso({ tipo: "ok", texto: `Orientador zerado: ${r.apagadas} leitura(s) antiga(s) apagada(s). Use “Analisar” para a IA reler.` });
    startTransition(() => router.refresh());
  }





  const visiveis = useMemo(() => {
    const semRemovidos = itens.filter((i) => !removidos.has(i.clienteId));
    return ordenarPorPrioridade(aplicarFiltro(semRemovidos, filtro));
  }, [itens, removidos, filtro]);

  const esperando = itens.filter((i) => i.ultimaFoiDoCliente).length;

  return (
    <>
      {/* Ordem de atacar + filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            title={f.ajuda}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-bold transition",
              filtro === f.id ? "bg-slate-900 text-agro-400" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
          >
            {f.nome}
            {f.id === "esperando" && esperando > 0 && <span className="ml-1 rounded-full bg-emerald-500 px-1.5 text-[10px] text-white">{esperando}</span>}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={analisarRecentes} disabled={!!lote} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-60">
          {lote ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {lote ? `Analisando ${lote.feitas}/${lote.total}…` : "Atualizar as leituras"}
        </button>
        <button onClick={zerar} disabled={!!lote} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60">
          <Eraser size={14} /> Zerar e recomeçar
        </button>
        <span className="text-xs text-slate-500">
          Os cards vêm na <b>ordem de atacar</b>: temperatura, chance de fechar, quem está esperando você e alerta do momento.
        </span>
      </div>

      {aviso && (
        <div className={`mb-4 flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${aviso.tipo === "ok" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          <span>{aviso.texto}{aviso.link && <> <Link href={aviso.link} className="font-semibold underline">abrir</Link></>}</span>
          <button onClick={() => setAviso(null)} aria-label="Fechar"><X size={16} /></button>
        </div>
      )}

      <div>
        {visiveis.length === 0 ? (
          <EmptyState
            icone={<Compass size={28} />}
            texto={filtro === "todos"
              ? `Nenhum cliente com conversa no período (${PERIODOS_ORIENTADOR[periodo].label.toLowerCase()})`
              : "Nenhum cliente neste filtro"}
            subtexto={filtro === "todos"
              ? "Assim que um cliente cadastrado mandar mensagem no WhatsApp, o card dele aparece aqui automaticamente."
              : "Troque o filtro acima para ver os demais."}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visiveis.map((a) => (
              <CardOrientador
                key={a.clienteId}
                a={a}
                analisando={analisando.has(a.clienteId)}
                descartando={descartando.has(a.clienteId)}
                onAnalisar={() => analisarUm(a)}
                onAbrir={() => router.push(`/atendimento?cliente=${a.clienteId}`)}
                onDescartar={() => descartarUm(a)}
              />
            ))}
          </div>
        )}
      </div>

    </>
  );
}
