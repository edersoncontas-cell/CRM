"use client";

import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  moverNegociacao, marcarPerdida, marcarGanha,
  criarNegociacaoCard, editarNegociacao, excluirNegociacao,
} from "@/lib/actions";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { Termometro } from "@/components/ui";
import { ESTAGIOS, COL_PERDIDO } from "@/lib/pipeline";
import {
  Plus, X, Pencil, Trophy, Calendar, Trash2, TrendingUp,
  DollarSign, Users, Target, ChevronRight, Flame, Snowflake,
  AlertTriangle, CheckCircle2, Clock, BarChart3,
} from "lucide-react";

interface CardData {
  id: string;
  estagio: string;
  status: string;
  clienteId: string;
  cliente: string;
  municipio: string | null;
  maquina: string | null;
  valor: number | null;
  termometro: number;
  concorrente: string | null;
  condicaoPagamento: string | null;
  dataVisita: string | null;
  proximaAcao: string | null;
}

type Cliente = { id: string; nome: string };

const COLUNAS_NEG = [...ESTAGIOS, COL_PERDIDO];

function temaCalor(t: number): string {
  if (t >= 70) return "from-orange-500/25 to-rose-600/10 border-orange-400/40";
  if (t >= 40) return "from-amber-400/25 to-yellow-600/10 border-amber-400/40";
  return "from-sky-500/25 to-blue-600/10 border-sky-400/40";
}

function iconeCalor(t: number) {
  if (t >= 70) return <Flame size={13} className="text-orange-400" />;
  if (t >= 40) return <AlertTriangle size={13} className="text-amber-400" />;
  return <Snowflake size={13} className="text-sky-400" />;
}

// ── Componente principal ──────────────────────────────────────────────────
export function FunilNegociacoes({
  cards: cardsIniciais,
  clientes,
}: {
  cards: CardData[];
  clientes: Cliente[];
}) {
  const [cards, setCards] = useState(cardsIniciais);
  const [ativo, setAtivo] = useState<CardData | null>(null);
  const [editando, setEditando] = useState<CardData | null>(null);
  const [filtro, setFiltro] = useState("");
  const [abaFiltro, setAbaFiltro] = useState<"todos" | "abertos" | "ganhos" | "perdidos">("todos");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => setCards(cardsIniciais), [cardsIniciais]);

  // KPIs
  const abertos = cards.filter((c) => c.status === "aberta");
  const ganhos = cards.filter((c) => c.status === "ganha");
  const perdidos = cards.filter((c) => c.status === "perdida");
  const totalAberto = abertos.reduce((s, c) => s + (c.valor ?? 0), 0);
  const totalGanho = ganhos.reduce((s, c) => s + (c.valor ?? 0), 0);
  const taxaConversao = cards.length > 0
    ? Math.round((ganhos.length / cards.length) * 100)
    : 0;

  // Filtrar cards
  const cardsFiltrados = cards.filter((c) => {
    const matchFiltro = filtro === "" ||
      c.cliente.toLowerCase().includes(filtro.toLowerCase()) ||
      (c.maquina ?? "").toLowerCase().includes(filtro.toLowerCase()) ||
      (c.municipio ?? "").toLowerCase().includes(filtro.toLowerCase());
    const matchAba =
      abaFiltro === "todos" ||
      (abaFiltro === "abertos" && c.status === "aberta") ||
      (abaFiltro === "ganhos" && c.status === "ganha") ||
      (abaFiltro === "perdidos" && c.status === "perdida");
    return matchFiltro && matchAba;
  });

  function onDragStart(e: DragStartEvent) {
    setAtivo(cards.find((c) => c.id === String(e.active.id)) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setAtivo(null);
    const { active, over } = e;
    if (!over) return;
    const card = cards.find((c) => c.id === String(active.id));
    if (!card) return;
    const novoEstagio = String(over.id);
    const perdido = novoEstagio === COL_PERDIDO.id;
    if (card.estagio === novoEstagio && (perdido ? card.status === "perdida" : card.status === "aberta")) return;
    setCards((cs) =>
      cs.map((c) =>
        c.id === card.id ? { ...c, estagio: novoEstagio, status: perdido ? "perdida" : "aberta" } : c
      )
    );
    moverNegociacao(card.id, novoEstagio);
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icone={<Target size={20} />}
          rotulo="Em aberto"
          valor={abertos.length.toString()}
          sub={formatCurrency(totalAberto)}
          cor="azul"
        />
        <KpiCard
          icone={<DollarSign size={20} />}
          rotulo="Volume aberto"
          valor={formatCurrency(totalAberto)}
          sub={`${abertos.length} negoc.`}
          cor="verde"
        />
        <KpiCard
          icone={<Trophy size={20} />}
          rotulo="Vendas ganhas"
          valor={ganhos.length.toString()}
          sub={formatCurrency(totalGanho)}
          cor="amarelo"
        />
        <KpiCard
          icone={<BarChart3 size={20} />}
          rotulo="Taxa conversão"
          valor={`${taxaConversao}%`}
          sub={`${cards.length} total`}
          cor="roxo"
        />
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por cliente, máquina ou cidade..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 pl-4 text-sm shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          {filtro && (
            <button onClick={() => setFiltro("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={15} />
            </button>
          )}
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(["todos", "abertos", "ganhos", "perdidos"] as const).map((aba) => (
            <button
              key={aba}
              onClick={() => setAbaFiltro(aba)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all",
                abaFiltro === aba
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              {aba === "todos" ? "Todos" : aba === "abertos" ? "Em aberto" : aba === "ganhos" ? "Ganhos" : "Perdidos"}
            </button>
          ))}
        </div>
      </div>

      {/* Funil Kanban */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {COLUNAS_NEG.map((col) => {
              const lista = col.id === COL_PERDIDO.id
                ? cardsFiltrados.filter((c) => c.status === "perdida")
                : cardsFiltrados.filter((c) => c.status === "aberta" && c.estagio === col.id);
              const totalCol = lista.reduce((s, c) => s + (c.valor ?? 0), 0);
              return (
                <ColunaFunil
                  key={col.id}
                  id={col.id}
                  titulo={col.titulo}
                  cor={col.cor}
                  cards={lista}
                  total={totalCol}
                  clientes={clientes}
                  permiteAdicionar={col.id !== COL_PERDIDO.id}
                  isPerdido={col.id === COL_PERDIDO.id}
                  onEditar={setEditando}
                />
              );
            })}
          </div>
        </div>
        <DragOverlay>
          {ativo && <NegCardView card={ativo} arrastando />}
        </DragOverlay>
      </DndContext>

      {editando && (
        <ModalEditar card={editando} onClose={() => setEditando(null)} />
      )}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────
const COR_KPI: Record<string, string> = {
  azul: "bg-blue-50 border-blue-100",
  verde: "bg-emerald-50 border-emerald-100",
  amarelo: "bg-amber-50 border-amber-100",
  roxo: "bg-purple-50 border-purple-100",
};
const COR_KPI_ICON: Record<string, string> = {
  azul: "bg-blue-100 text-blue-600",
  verde: "bg-emerald-100 text-emerald-600",
  amarelo: "bg-amber-100 text-amber-600",
  roxo: "bg-purple-100 text-purple-600",
};

function KpiCard({
  icone, rotulo, valor, sub, cor,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  sub?: string;
  cor: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${COR_KPI[cor] ?? "bg-slate-50 border-slate-100"}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2 ${COR_KPI_ICON[cor] ?? "bg-slate-100 text-slate-600"}`}>
          {icone}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500 truncate">{rotulo}</div>
          <div className="text-xl font-bold text-slate-800 leading-tight">{valor}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Coluna do funil ──────────────────────────────────────────────────────
function ColunaFunil({
  id, titulo, cor, cards, total, clientes, permiteAdicionar, isPerdido, onEditar,
}: {
  id: string;
  titulo: string;
  cor: string;
  cards: CardData[];
  total: number;
  clientes: Cliente[];
  permiteAdicionar: boolean;
  isPerdido: boolean;
  onEditar: (c: CardData) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [adicionando, setAdicionando] = useState(false);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border-t-4 bg-slate-900/80 backdrop-blur-sm p-3 transition-all",
        cor,
        isOver && "ring-2 ring-agro-400 bg-slate-800/90 scale-[1.01]"
      )}
      style={{ minHeight: 200 }}
    >
      {/* Cabeçalho da coluna */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-slate-100">{titulo}</span>
          <span className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm",
            isPerdido ? "bg-red-500/20 text-red-300" : "bg-white/90 text-slate-700"
          )}>
            {cards.length}
          </span>
        </div>
        {total > 0 && (
          <div className={cn(
            "text-xs font-semibold",
            isPerdido ? "text-red-400/80" : "text-agro-300"
          )}>
            {formatCurrency(total)}
          </div>
        )}
        {/* Barra de progresso do valor */}
        {!isPerdido && total > 0 && (
          <div className="mt-2 h-1 w-full rounded-full bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-agro-400 to-emerald-500 transition-all duration-500"
              style={{ width: "100%" }}
            />
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 flex-1">
        {cards.map((c) => (
          <NegCardView key={c.id} card={c} onEditar={() => onEditar(c)} />
        ))}
        {cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-slate-600">
            <ChevronRight size={20} className="mb-1 opacity-30" />
            <span>Arraste um card aqui</span>
          </div>
        )}
      </div>

      {/* Adicionar card */}
      {permiteAdicionar && (
        <div className="mt-2">
          {adicionando ? (
            <FormAdicionar estagio={id} clientes={clientes} onFechar={() => setAdicionando(false)} />
          ) : (
            <button
              onClick={() => setAdicionando(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-600 py-2.5 text-xs font-semibold text-slate-400 transition hover:border-agro-400 hover:text-agro-400 hover:bg-agro-400/5"
            >
              <Plus size={14} /> Nova negociação
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Card de negociação ───────────────────────────────────────────────────
function NegCardView({
  card, arrastando, onEditar,
}: {
  card: CardData;
  arrastando?: boolean;
  onEditar?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  const tema = card.status === "perdida"
    ? "from-slate-700/50 to-slate-800 border-slate-600"
    : card.status === "ganha"
    ? "from-green-600/20 to-emerald-700/10 border-green-500/40"
    : temaCalor(card.termometro);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl border bg-gradient-to-br p-3 shadow-md transition-all",
        "hover:shadow-lg hover:brightness-110 cursor-grab active:cursor-grabbing",
        tema,
        (isDragging || arrastando) && "opacity-70 shadow-2xl ring-2 ring-agro-400 scale-105"
      )}
    >
      <div {...listeners} {...attributes}>
        {/* Header: cliente + máquina */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <Link
            href={`/clientes/${card.clienteId}`}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-sm font-bold leading-tight text-white hover:text-agro-400 hover:underline transition-colors"
            title="Ver cliente"
          >
            {card.cliente}
          </Link>
          {iconeCalor(card.termometro)}
        </div>

        {/* Município */}
        {card.municipio && (
          <div className="text-xs text-slate-400 mb-1.5">{card.municipio}</div>
        )}

        {/* Máquina */}
        {card.maquina && (
          <div className="inline-flex mb-2 items-center rounded-lg bg-agro-400/20 px-2 py-0.5 text-xs font-bold text-agro-300 border border-agro-400/20">
            {card.maquina}
          </div>
        )}

        {/* Valor */}
        <div className="text-base font-bold text-emerald-300 mb-2">
          {formatCurrency(card.valor)}
        </div>

        {/* Termômetro */}
        <Termometro valor={card.termometro} />

        {/* Data de visita */}
        {card.dataVisita && (
          <div className="mt-2 flex items-center gap-1 text-xs text-sky-300">
            <Calendar size={11} />
            {formatDateTime(card.dataVisita)}
          </div>
        )}

        {/* Concorrente */}
        {card.concorrente && (
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300 border border-red-500/20">
            ⚔ vs {card.concorrente}
          </div>
        )}

        {/* Próxima ação */}
        {card.proximaAcao && (
          <div className="mt-2 flex items-start gap-1 text-xs text-violet-300 bg-violet-500/10 rounded-lg p-1.5 border border-violet-500/20">
            <Clock size={11} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{card.proximaAcao}</span>
          </div>
        )}

        {/* Status badge */}
        {card.status === "ganha" && (
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-green-300">
            <CheckCircle2 size={12} /> VENDIDO
          </div>
        )}
      </div>

      {/* Botão editar */}
      {!arrastando && onEditar && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onEditar}
          className="mt-2.5 flex w-full items-center justify-center gap-1 border-t border-white/10 pt-2 text-xs font-medium text-slate-300 hover:text-agro-400 transition-colors"
        >
          <Pencil size={11} /> Editar
        </button>
      )}
    </div>
  );
}

// ── Formulário de nova negociação ────────────────────────────────────────
function FormAdicionar({
  estagio, clientes, onFechar,
}: {
  estagio: string;
  clientes: Cliente[];
  onFechar: () => void;
}) {
  return (
    <form
      action={async (fd) => {
        await criarNegociacaoCard(fd);
        onFechar();
      }}
      className="rounded-xl border border-slate-300 bg-white p-3 shadow-lg"
    >
      <input type="hidden" name="estagio" value={estagio} />
      <select
        name="clienteId"
        className="mb-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
      >
        <option value="">— Selecionar cliente —</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>
      <input
        name="nomeNovo"
        placeholder="ou novo cliente (nome)"
        className="mb-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
      />
      <input
        name="maquinaModelo"
        placeholder="Máquina (ex: E215C)"
        className="mb-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
      />
      <input
        name="valor"
        placeholder="Valor (R$)"
        inputMode="numeric"
        className="mb-3 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
      />
      <div className="flex items-center gap-2">
        <button className="flex-1 rounded-lg bg-slate-900 py-2 text-xs font-bold text-agro-400 hover:bg-slate-800 transition-colors">
          Criar negociação
        </button>
        <button type="button" onClick={onFechar} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors">
          <X size={14} />
        </button>
      </div>
    </form>
  );
}

// ── Modal de edição ──────────────────────────────────────────────────────
const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all";

function paraInputLocal(iso: string | null): string {
  if (!iso) return "";
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return fmt.format(new Date(iso)).replace(" ", "T");
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function ModalEditar({ card, onClose }: { card: CardData; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{card.cliente}</h3>
              {card.municipio && <p className="text-xs text-slate-400 mt-0.5">{card.municipio}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="text-2xl font-bold text-emerald-300">{formatCurrency(card.valor)}</div>
            <Termometro valor={card.termometro} />
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <form
            action={async (fd) => {
              await editarNegociacao(card.id, fd);
              onClose();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Máquina">
                <input name="maquinaModelo" defaultValue={card.maquina ?? ""} className={inputCls} />
              </Campo>
              <Campo label="Valor (R$)">
                <input name="valor" inputMode="numeric" defaultValue={card.valor ?? ""} className={inputCls} />
              </Campo>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Campo label="Estágio">
                <select name="estagio" defaultValue={card.estagio} className={inputCls}>
                  {ESTAGIOS.map((e) => (
                    <option key={e.id} value={e.id}>{e.titulo}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Pagamento">
                <select name="condicaoPagamento" defaultValue={card.condicaoPagamento ?? ""} className={inputCls}>
                  <option value="">—</option>
                  <option value="avista">À vista</option>
                  <option value="financiamento">Financiamento</option>
                  <option value="consorcio">Consórcio</option>
                  <option value="outro">Outro</option>
                </select>
              </Campo>
            </div>

            <Campo label="Data da visita">
              <input
                type="datetime-local"
                name="dataVisita"
                defaultValue={paraInputLocal(card.dataVisita)}
                className={inputCls}
              />
            </Campo>

            <Campo label="Concorrente mencionado">
              <input name="concorrenteMencionado" defaultValue={card.concorrente ?? ""} className={inputCls} placeholder="Ex: CAT, Komatsu..." />
            </Campo>

            <Campo label="Próxima ação">
              <input name="proximaAcao" defaultValue={card.proximaAcao ?? ""} className={inputCls} placeholder="Ex: Ligar terça para follow-up" />
            </Campo>

            <button
              disabled={isPending}
              className="w-full rounded-xl bg-slate-900 py-3 font-bold text-agro-400 hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg"
            >
              {isPending ? "Salvando..." : "Salvar alterações"}
            </button>
          </form>

          {/* Ações de fechamento */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Fechar negociação</p>
            <div className="flex items-center gap-2">
              <form action={marcarGanha.bind(null, card.id)} onSubmit={() => onClose()} className="flex-1">
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-50 py-2.5 text-sm font-bold text-green-700 hover:bg-green-100 transition-all border border-green-200">
                  <Trophy size={15} /> Venda Ganha!
                </button>
              </form>
              <form
                action={async (fd) => {
                  await marcarPerdida(card.id, String(fd.get("motivo") || "Não informado"));
                  onClose();
                }}
                className="flex flex-1 items-center gap-1"
              >
                <input
                  name="motivo"
                  placeholder="motivo da perda"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-2 py-2 text-xs outline-none focus:border-red-400"
                />
                <button className="shrink-0 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-100 transition-all border border-red-200">
                  Perdida
                </button>
              </form>
            </div>
          </div>

          {/* Excluir */}
          <div className="border-t border-slate-100 pt-3">
            <form
              action={async () => {
                await excluirNegociacao(card.id);
                onClose();
              }}
            >
              <button
                onClick={(e) => {
                  if (!confirm(`Excluir negociação de ${card.cliente}? Esta ação não pode ser desfeita.`)) {
                    e.preventDefault();
                  }
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
              >
                <Trash2 size={13} /> Excluir negociação
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
