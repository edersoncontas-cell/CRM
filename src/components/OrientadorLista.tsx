"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, EmptyState } from "@/components/ui";
import {
  buscarOrientadorAnalise, zerarOrientadorAction, analisarLoteOrientadorAction, proximaAcaoViraDemandaAction,
  descartarCardOrientadorAction,
} from "@/lib/actions";
import { adicionarContextoClienteAction, removerContextoClienteAction } from "@/lib/contexto-cliente-actions";
import { PERIODOS_ORIENTADOR, type PeriodoOrientador } from "@/lib/orientador-periodos";
import {
  ordenarPorPrioridade, aplicarFiltro, leituraDesatualizada, idadeDaLeitura, pontuarPrioridade,
  FILTROS, type FiltroOrientador,
} from "@/lib/orientador-prioridade";
import { formatDateTime, cn } from "@/lib/utils";
import {
  Flame, ThermometerSun, Snowflake, X, Compass, Target, AlertTriangle, MessageSquareQuote, Loader2, MessageCircle,
  Sparkles, RefreshCw, Eraser, CalendarPlus, Handshake, GraduationCap, ListTodo, Check, BookOpen, Plus, Trash2,
  ShieldAlert, HelpCircle, TrendingUp, TrendingDown, Route, Copy,
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
  combinados: string[];
  pendencias: string[];
  coaching: Coaching;
  contexto: NotaContexto[];
};

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
export function OrientadorLista({ itens, contagem, periodo }: {
  itens: Item[]; contagem: Record<PeriodoOrientador, number>; periodo: PeriodoOrientador;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string; link?: string } | null>(null);
  const [analisando, setAnalisando] = useState<Set<string>>(new Set());
  const [lote, setLote] = useState<{ total: number; feitas: number } | null>(null);
  const [filtro, setFiltro] = useState<FiltroOrientador>("todos");
  const [novoContexto, setNovoContexto] = useState("");
  const [salvandoContexto, setSalvandoContexto] = useState(false);
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

  async function abrir(clienteId: string) {
    setAberto(clienteId);
    setCarregando(true);
    setNovoContexto("");
    const d = await buscarOrientadorAnalise(clienteId);
    setDetalhe(d as Detalhe | null);
    setCarregando(false);
  }

  async function salvarContexto() {
    if (!aberto || !novoContexto.trim()) return;
    setSalvandoContexto(true);
    const r = await adicionarContextoClienteAction(aberto, novoContexto);
    setSalvandoContexto(false);
    if (!r.ok || !r.nota) { setAviso({ tipo: "erro", texto: r.erro ?? "Não consegui guardar." }); return; }
    setDetalhe((d) => (d ? { ...d, contexto: [r.nota!, ...d.contexto] } : d));
    setNovoContexto("");
  }

  async function esquecerContexto(id: string) {
    setDetalhe((d) => (d ? { ...d, contexto: d.contexto.filter((c) => c.id !== id) } : d));
    await removerContextoClienteAction(id);
  }

  async function virarDemanda(quando: "hoje" | "amanha") {
    if (!aberto || !detalhe?.proximaAcao) return;
    const r = await proximaAcaoViraDemandaAction(aberto, detalhe.proximaAcao, quando);
    setAviso(r.ok
      ? { tipo: "ok", texto: `Virou demanda para ${quando === "hoje" ? "hoje" : "amanhã"}.`, link: "/pipeline" }
      : { tipo: "erro", texto: r.erro ?? "Não consegui criar a demanda." });
  }

  const visiveis = useMemo(() => {
    const semRemovidos = itens.filter((i) => !removidos.has(i.clienteId));
    return ordenarPorPrioridade(aplicarFiltro(semRemovidos, filtro));
  }, [itens, removidos, filtro]);

  const periodos = Object.entries(PERIODOS_ORIENTADOR) as [PeriodoOrientador, (typeof PERIODOS_ORIENTADOR)[PeriodoOrientador]][];
  const esperando = itens.filter((i) => i.ultimaFoiDoCliente).length;
  const c = detalhe?.coaching;

  return (
    <>
      {/* Contadores de clientes conversados por janela */}
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
                onAbrir={() => abrir(a.clienteId)}
                onDescartar={() => descartarUm(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Painel completo do cliente ── */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4" onClick={() => setAberto(null)}>
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            {carregando ? (
              <div className="py-10 text-center text-sm text-slate-400">Carregando…</div>
            ) : !detalhe ? (
              <div className="py-8 text-center text-sm text-slate-500">
                A IA ainda não leu esta conversa. Toque em “analisar” no card para ela ler agora.
                <div className="mt-3"><Link href={`/clientes/${aberto}`} className="text-xs font-semibold text-brand-600 hover:underline">ver cadastro</Link></div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-800">{detalhe.clienteNome}</h2>
                      <Link href={`/clientes/${aberto}`} className="text-xs font-semibold text-brand-600 hover:underline">ver cadastro</Link>
                      <Link href={`/atendimento?cliente=${aberto}`} className="text-xs font-semibold text-emerald-700 hover:underline">abrir conversa</Link>
                    </div>
                    {detalhe.municipio && <p className="text-xs text-slate-400">{detalhe.municipio}</p>}
                  </div>
                  <button onClick={() => setAberto(null)}><X size={18} className="text-slate-400" /></button>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <BadgeTemperatura temperatura={detalhe.temperatura} />
                  <Badge tom="slate">{detalhe.estagioVenda}</Badge>
                  {c?.personalidade.estilo && <Badge tom="purple">{c.personalidade.estilo}{c.personalidade.papel ? ` · ${c.personalidade.papel}` : ""}</Badge>}
                  {detalhe.perfilComprador && <Badge tom="blue">{detalhe.perfilComprador}</Badge>}
                </div>

                {/* Alerta do momento */}
                {c?.alertaAgora && (
                  <div className={cn("mb-3 rounded-xl border p-3", COR_ALERTA[c.alertaAgora.nivel].fundo, COR_ALERTA[c.alertaAgora.nivel].borda)}>
                    <div className={cn("flex items-start gap-2 text-sm font-bold", COR_ALERTA[c.alertaAgora.nivel].texto)}>
                      <ShieldAlert size={16} className="mt-0.5 shrink-0" /> {c.alertaAgora.titulo}
                    </div>
                    <p className={cn("mt-1 text-xs", COR_ALERTA[c.alertaAgora.nivel].texto)}>{c.alertaAgora.motivo}</p>
                  </div>
                )}

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

                {/* Próxima ação + virar demanda */}
                {detalhe.proximaAcao && (
                  <div className="mb-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
                    <div className="flex items-start gap-2">
                      <Target size={15} className="mt-0.5 shrink-0" />
                      <div><span className="font-semibold">Próxima ação: </span>{detalhe.proximaAcao}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button onClick={() => virarDemanda("hoje")} className="inline-flex items-center gap-1 rounded-lg bg-brand-900 px-2.5 py-1 text-[11px] font-bold text-agro-400">
                        <ListTodo size={12} /> Virar demanda de hoje
                      </button>
                      <button onClick={() => virarDemanda("amanha")} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700 ring-1 ring-brand-200">
                        <ListTodo size={12} /> Para amanhã
                      </button>
                    </div>
                  </div>
                )}

                {/* Técnica da Academia */}
                {c?.tecnicaAcademia && (
                  <Secao icone={<GraduationCap size={12} />} titulo="Técnica da Academia para agora">
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                      <div className="text-sm font-bold text-violet-900">{c.tecnicaAcademia.nome}</div>
                      <p className="mt-0.5 text-xs text-violet-800">{c.tecnicaAcademia.porque}</p>
                      <Link href="/academia" className="mt-1.5 inline-block text-[11px] font-semibold text-violet-700 underline">treinar isso na Academia</Link>
                    </div>
                  </Secao>
                )}

                {/* Perguntas que destravam */}
                {c && c.perguntasAgora.length > 0 && (
                  <Secao icone={<HelpCircle size={12} />} titulo="Pergunte agora, nesta ordem">
                    <ol className="space-y-1 text-sm text-slate-700">
                      {c.perguntasAgora.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-agro-400">{i + 1}</span>
                          <span className="flex-1">{p}</span>
                          <button onClick={() => navigator.clipboard.writeText(p).catch(() => null)} title="Copiar" className="shrink-0 text-slate-400 hover:text-slate-700"><Copy size={12} /></button>
                        </li>
                      ))}
                    </ol>
                  </Secao>
                )}

                {/* Combinados e pendências */}
                {(detalhe.combinados.length > 0 || detalhe.pendencias.length > 0) && (
                  <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {detalhe.combinados.length > 0 && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-700"><Check size={12} /> Já combinado</div>
                        <ul className="space-y-1 text-xs text-emerald-900">{detalhe.combinados.map((x, i) => <li key={i}>• {x}</li>)}</ul>
                      </div>
                    )}
                    {detalhe.pendencias.length > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-700"><AlertTriangle size={12} /> Falta</div>
                        <ul className="space-y-1 text-xs text-amber-900">{detalhe.pendencias.map((x, i) => <li key={i}>• {x}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Como falar com este cliente */}
                {c && (c.personalidade.descricao || c.personalidade.comoFalar.length > 0) && (
                  <Secao icone={<MessageSquareQuote size={12} />} titulo="Como falar com ele">
                    {c.personalidade.descricao && <p className="mb-1 text-sm text-slate-600">{c.personalidade.descricao}</p>}
                    {c.personalidade.comoFalar.length > 0 && (
                      <ul className="space-y-0.5 text-xs text-slate-600">{c.personalidade.comoFalar.map((x, i) => <li key={i}>✓ {x}</li>)}</ul>
                    )}
                    {c.personalidade.evitar.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-red-600">{c.personalidade.evitar.map((x, i) => <li key={i}>✗ {x}</li>)}</ul>
                    )}
                  </Secao>
                )}

                {/* Roteiro até o fechamento */}
                {c && c.roteiro.length > 0 && (
                  <Secao icone={<Route size={12} />} titulo="Caminho até fechar">
                    <ol className="space-y-1">
                      {c.roteiro.map((e, i) => (
                        <li key={i} className={cn("flex items-center gap-2 rounded-lg px-2 py-1 text-xs",
                          e.status === "feito" ? "text-slate-400" : e.status === "agora" ? "bg-agro-400/20 font-bold text-slate-800" : "text-slate-600")}>
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", e.status === "feito" ? "bg-emerald-400" : e.status === "agora" ? "bg-agro-500" : "bg-slate-300")} />
                          <span className="flex-1">{e.etapa}</span>
                          {e.dica && <span className="text-[11px] text-slate-500">{e.dica}</span>}
                        </li>
                      ))}
                    </ol>
                  </Secao>
                )}

                {/* Sinais */}
                {c && (c.sinaisCompra.length > 0 || c.sinaisRisco.length > 0) && (
                  <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {c.sinaisCompra.length > 0 && (
                      <div>
                        <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-600"><TrendingUp size={12} /> Sinais de compra</div>
                        <ul className="space-y-0.5 text-xs text-slate-600">{c.sinaisCompra.map((x, i) => <li key={i}>• {x}</li>)}</ul>
                      </div>
                    )}
                    {c.sinaisRisco.length > 0 && (
                      <div>
                        <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-red-600"><TrendingDown size={12} /> Sinais de risco</div>
                        <ul className="space-y-0.5 text-xs text-slate-600">{c.sinaisRisco.map((x, i) => <li key={i}>• {x}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Objeções com tratamento */}
                {c && c.tratamentoObjecoes.length > 0 && (
                  <Secao icone={<AlertTriangle size={12} />} titulo="Objeções e como responder">
                    <ul className="space-y-1.5">
                      {c.tratamentoObjecoes.map((o, i) => (
                        <li key={i} className="rounded-lg border border-slate-200 p-2">
                          <div className="text-xs font-bold text-slate-700">{o.objecao}</div>
                          <p className="text-xs text-slate-600">{o.comoTratar}</p>
                        </li>
                      ))}
                    </ul>
                  </Secao>
                )}

                {/* Como o vendedor conduziu */}
                {c && (c.conducao.acertos.length > 0 || c.conducao.correcoes.length > 0) && (
                  <Secao icone={<Compass size={12} />} titulo={`Sua condução — nota ${c.conducao.nota}/10`}>
                    {c.conducao.acertos.length > 0 && <ul className="space-y-0.5 text-xs text-emerald-700">{c.conducao.acertos.map((x, i) => <li key={i}>✓ {x}</li>)}</ul>}
                    {c.conducao.correcoes.length > 0 && <ul className="mt-1 space-y-0.5 text-xs text-amber-700">{c.conducao.correcoes.map((x, i) => <li key={i}>→ {x}</li>)}</ul>}
                  </Secao>
                )}

                {detalhe.oportunidadesPerdidas.length > 0 && (
                  <Secao icone={<AlertTriangle size={12} />} titulo="Oportunidades perdidas">
                    <ul className="space-y-1 text-sm text-slate-600">{detalhe.oportunidadesPerdidas.map((o, i) => <li key={i}>• {o}</li>)}</ul>
                  </Secao>
                )}

                {detalhe.melhorResposta && (
                  <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <MessageSquareQuote size={12} /> Melhor resposta sugerida
                      </div>
                      <button onClick={() => navigator.clipboard.writeText(detalhe.melhorResposta ?? "").catch(() => null)} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                        <Copy size={11} /> Copiar
                      </button>
                    </div>
                    <p className="text-sm text-slate-700">{detalhe.melhorResposta}</p>
                  </div>
                )}

                {/* ── O que só você sabe ── */}
                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                  <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
                    <BookOpen size={12} /> O que só você sabe deste cliente
                  </div>
                  <p className="mb-2 text-[11px] leading-snug text-violet-800">
                    O que não aparece no WhatsApp: quem decide junto, histórico de compra, o jeito dele, combinados por telefone.
                    Fica para sempre no histórico e a IA passa a considerar isso em toda leitura.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={novoContexto}
                      onChange={(e) => setNovoContexto(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") salvarContexto(); }}
                      placeholder="Ex.: quem decide é o filho, o Marcelo; ele já comprou duas conosco"
                      className="flex-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400"
                    />
                    <button onClick={salvarContexto} disabled={salvandoContexto || !novoContexto.trim()} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                      {salvandoContexto ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Guardar
                    </button>
                  </div>
                  {detalhe.contexto.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {detalhe.contexto.map((n) => (
                        <li key={n.id} className="flex items-start gap-2 rounded-lg bg-white p-2 text-xs text-slate-700">
                          <span className="flex-1">{n.texto}</span>
                          <span className="shrink-0 text-[10px] text-slate-400">{new Date(n.criadoEm).toLocaleDateString("pt-BR")}</span>
                          <button onClick={() => esquecerContexto(n.id)} title="Apagar" className="shrink-0 text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>Leitura da IA: {formatDateTime(detalhe.atualizadoEm)}</span>
                  <span>Prioridade {pontuarPrioridade({
                    clienteId: aberto,
                    temperatura: detalhe.temperatura,
                    probabilidadeFechamento: detalhe.probabilidadeFechamento,
                    ultimaMensagemEm: detalhe.atualizadoEm,
                    atualizadoEm: detalhe.atualizadoEm,
                    alertaNivel: c?.alertaAgora?.nivel ?? null,
                  })}/100</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
