"use client";

import Link from "next/link";
import { useState, useTransition, useEffect, useRef } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  moverNegociacao, marcarPerdida, marcarGanha,
  criarNegociacaoCard, editarNegociacao, excluirNegociacao,
  criarColunaFunil, excluirColunaFunil, renomearColunaFunil,
  criarNegociacaoCompleta,
} from "@/lib/actions";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { Termometro } from "@/components/ui";
import {
  Plus, X, Pencil, Trophy, Calendar, Trash2,
  DollarSign, Target, ChevronRight, Flame, Snowflake,
  AlertTriangle, CheckCircle2, Clock, BarChart3, MoreVertical, Check,
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
type ColunaFunil = { id: string; titulo: string; cor: string; ordem: number; fixa: boolean };

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
  colunas: colunasIniciais,
}: {
  cards: CardData[];
  clientes: Cliente[];
  colunas: ColunaFunil[];
}) {
  const [cards, setCards] = useState(cardsIniciais);
  const [colunas, setColunas] = useState(colunasIniciais);
  const [ativo, setAtivo] = useState<CardData | null>(null);
  const [editando, setEditando] = useState<CardData | null>(null);
  const [filtro, setFiltro] = useState("");
  const [abaFiltro, setAbaFiltro] = useState<"todos" | "abertos" | "faturados" | "perdidos">("todos");

  // Sensors com movimento suave: delay de 200ms no mouse, 250ms no toque
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  useEffect(() => setCards(cardsIniciais), [cardsIniciais]);
  useEffect(() => setColunas(colunasIniciais), [colunasIniciais]);

  // KPIs
  const abertos = cards.filter((c) => c.status === "aberta");
  const faturados = cards.filter((c) => c.status === "ganha");
  const totalAberto = abertos.reduce((s, c) => s + (c.valor ?? 0), 0);
  const totalFaturado = faturados.reduce((s, c) => s + (c.valor ?? 0), 0);
  const taxaConversao = cards.length > 0 ? Math.round((faturados.length / cards.length) * 100) : 0;

  // Filtrar cards
  const cardsFiltrados = cards.filter((c) => {
    const matchFiltro = filtro === "" ||
      c.cliente.toLowerCase().includes(filtro.toLowerCase()) ||
      (c.maquina ?? "").toLowerCase().includes(filtro.toLowerCase()) ||
      (c.municipio ?? "").toLowerCase().includes(filtro.toLowerCase());
    const matchAba =
      abaFiltro === "todos" ||
      (abaFiltro === "abertos" && c.status === "aberta") ||
      (abaFiltro === "faturados" && c.status === "ganha") ||
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
    const novaColuna = colunas.find((col) => col.id === String(over.id));
    if (!novaColuna) return;
    // Usa o titulo da coluna como estagio (chave dinamica)
    const novoEstagio = novaColuna.titulo;
    const tituloNovo = novaColuna.titulo.toLowerCase();
    const isPerdido = tituloNovo.includes("perdid");
    // FATURADO e colunas de venda ganha viram status "ganha" (mesma regra do servidor)
    const isGanha = tituloNovo.includes("faturad") || tituloNovo.includes("ganho") || tituloNovo.includes("confirm") || tituloNovo.includes("vendid");
    if (card.estagio === novoEstagio) return;
    setCards((cs) =>
      cs.map((c) =>
        c.id === card.id ? { ...c, estagio: novoEstagio, status: isPerdido ? "perdida" : isGanha ? "ganha" : "aberta" } : c
      )
    );
    moverNegociacao(card.id, novoEstagio);
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icone={<Target size={20} />} rotulo="Em aberto" valor={abertos.length.toString()} sub={formatCurrency(totalAberto)} cor="azul" />
        <KpiCard icone={<DollarSign size={20} />} rotulo="Volume aberto" valor={formatCurrency(totalAberto)} sub={`${abertos.length} negoc.`} cor="verde" />
        <KpiCard icone={<Trophy size={20} />} rotulo="Vendas faturadas" valor={faturados.length.toString()} sub={formatCurrency(totalFaturado)} cor="amarelo" />
        <KpiCard icone={<BarChart3 size={20} />} rotulo="Taxa conversão" valor={`${taxaConversao}%`} sub={`${cards.length} total`} cor="roxo" />
      </div>

      {/* Barra de filtros + botão nova coluna */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por cliente, máquina ou cidade..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          {filtro && (
            <button onClick={() => setFiltro("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={15} />
            </button>
          )}
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(["todos", "abertos", "faturados", "perdidos"] as const).map((aba) => (
            <button
              key={aba}
              onClick={() => setAbaFiltro(aba)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all",
                abaFiltro === aba ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              {aba === "todos" ? "Todos" : aba === "abertos" ? "Em aberto" : aba === "faturados" ? "Faturados" : "Perdidos"}
            </button>
          ))}
        </div>
        <BotaoNovaColuna />
      </div>

      {/* Funil Kanban com DnD suave */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {colunas.map((col) => {
              const tituloCol = col.titulo.toLowerCase();
              const colunaGanha = tituloCol.includes("faturad") || tituloCol.includes("ganho") || tituloCol.includes("confirm") || tituloCol.includes("vendid");
              const lista = tituloCol.includes("perdid")
                ? cardsFiltrados.filter((c) => c.status === "perdida")
                : colunaGanha
                ? cardsFiltrados.filter((c) => c.status === "ganha" && c.estagio === col.titulo)
                : cardsFiltrados.filter((c) => c.status === "aberta" && c.estagio === col.titulo);
              const totalCol = lista.reduce((s, c) => s + (c.valor ?? 0), 0);
              return (
                <ColunaFunilView
                  key={col.id}
                  coluna={col}
                  cards={lista}
                  total={totalCol}
                  clientes={clientes}
                  onEditar={setEditando}
                  onRenomear={async (novoTitulo) => {
                    setColunas((cs) => cs.map((c) => c.id === col.id ? { ...c, titulo: novoTitulo } : c));
                    await renomearColunaFunil(col.id, novoTitulo);
                  }}
                  onExcluir={async () => {
                    setColunas((cs) => cs.filter((c) => c.id !== col.id));
                    await excluirColunaFunil(col.id);
                  }}
                />
              );
            })}
          </div>
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {ativo && <NegCardView card={ativo} arrastando />}
        </DragOverlay>
      </DndContext>

      {editando && <ModalEditar card={editando} onClose={() => setEditando(null)} colunas={colunas} />}
    </div>
  );
}

// ── Botão nova coluna ─────────────────────────────────────────────────────
function BotaoNovaColuna() {
  const [aberto, setAberto] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  return aberto ? (
    <form
      action={async (fd) => {
        const titulo = String(fd.get("titulo") ?? "").trim();
        if (!titulo) { setAberto(false); return; }
        startTransition(() => criarColunaFunil(titulo).then(() => setAberto(false)));
      }}
      className="flex items-center gap-2"
    >
      <input
        ref={inputRef}
        name="titulo"
        required
        autoFocus
        placeholder="Nome da nova coluna"
        className="w-48 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
      <button className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-agro-400 hover:bg-slate-800 transition-colors">
        Criar
      </button>
      <button type="button" onClick={() => setAberto(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
        <X size={15} />
      </button>
    </form>
  ) : (
    <button
      onClick={() => setAberto(true)}
      className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-500 shadow-sm transition hover:border-blue-400 hover:text-blue-600"
    >
      <Plus size={14} /> Nova coluna
    </button>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────
const COR_KPI: Record<string, string> = {
  azul: "bg-blue-50 border-blue-100", verde: "bg-emerald-50 border-emerald-100",
  amarelo: "bg-amber-50 border-amber-100", roxo: "bg-purple-50 border-purple-100",
};
const COR_KPI_ICON: Record<string, string> = {
  azul: "bg-blue-100 text-blue-600", verde: "bg-emerald-100 text-emerald-600",
  amarelo: "bg-amber-100 text-amber-600", roxo: "bg-purple-100 text-purple-600",
};
function KpiCard({ icone, rotulo, valor, sub, cor }: { icone: React.ReactNode; rotulo: string; valor: string; sub?: string; cor: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${COR_KPI[cor] ?? "bg-slate-50 border-slate-100"}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2 ${COR_KPI_ICON[cor] ?? "bg-slate-100 text-slate-600"}`}>{icone}</div>
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
function ColunaFunilView({
  coluna, cards, total, clientes, onEditar, onRenomear, onExcluir,
}: {
  coluna: ColunaFunil;
  cards: CardData[];
  total: number;
  clientes: Cliente[];
  onEditar: (c: CardData) => void;
  onRenomear: (titulo: string) => Promise<void>;
  onExcluir: () => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const [adicionando, setAdicionando] = useState(false);
  const [adicionandoAntiga, setAdicionandoAntiga] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const [menu, setMenu] = useState(false);
  const [, startTransition] = useTransition();

  const isPerdido = coluna.titulo.toLowerCase().includes("perdid");

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border-t-4 bg-slate-900/80 backdrop-blur-sm p-3 transition-all duration-200",
        coluna.cor,
        isOver && "ring-2 ring-agro-400 bg-slate-800/90 scale-[1.01] shadow-xl"
      )}
      style={{ minHeight: 200 }}
    >
      {/* Cabeçalho */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          {renomeando ? (
            <form
              action={async (fd) => {
                const t = String(fd.get("titulo") ?? "").trim();
                if (t) await onRenomear(t);
                setRenomeando(false);
              }}
              className="flex flex-1 items-center gap-1 mr-1"
            >
              <input
                name="titulo"
                defaultValue={coluna.titulo}
                autoFocus
                className="flex-1 min-w-0 rounded-lg bg-slate-800 px-2 py-1 text-sm text-white outline-none ring-1 ring-slate-600 focus:ring-agro-400"
              />
              <button className="text-green-400 hover:text-green-300"><Check size={14} /></button>
              <button type="button" onClick={() => setRenomeando(false)} className="text-slate-400 hover:text-slate-200"><X size={14} /></button>
            </form>
          ) : (
            <span className="truncate text-sm font-bold text-slate-100 flex-1">{coluna.titulo}</span>
          )}

          <div className="flex items-center gap-1 shrink-0">
            <span className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm",
              isPerdido ? "bg-red-500/20 text-red-300" : "bg-white/90 text-slate-700"
            )}>
              {cards.length}
            </span>

            {/* Menu da coluna */}
            <div className="relative">
              <button
                onClick={() => setMenu((v) => !v)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <MoreVertical size={14} />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-slate-700 bg-slate-800 py-1 shadow-2xl">
                    <button
                      onClick={() => { setRenomeando(true); setMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      <Pencil size={12} /> Renomear
                    </button>
                    {coluna.titulo.toLowerCase().includes("faturad") && (
                <button
                  onClick={() => {
                    setMenu(false);
                    setAdicionandoAntiga(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-amber-300 hover:bg-slate-700 transition-colors"
                >
                  <Calendar size={12} /> Negociação Antiga
                </button>
              )}
              {!coluna.fixa && (
                      <button
                        onClick={() => {
                          setMenu(false);
                          if (confirm(`Excluir a coluna "${coluna.titulo}"? Os cards voltam para a primeira coluna.`)) {
                            startTransition(() => onExcluir());
                          }
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-slate-700 transition-colors"
                      >
                        <Trash2 size={12} /> Excluir coluna
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {total > 0 && (
          <div className={cn("text-xs font-semibold", isPerdido ? "text-red-400/80" : "text-agro-300")}>
            {formatCurrency(total)}
          </div>
        )}
        {!isPerdido && total > 0 && (
          <div className="mt-2 h-1 w-full rounded-full bg-slate-700">
            <div className="h-full rounded-full bg-gradient-to-r from-agro-400 to-emerald-500 transition-all duration-500" style={{ width: "100%" }} />
          </div>
        )}
      </div>

      {/* Cards com animação de entrada */}
      <div className="flex flex-col gap-2 flex-1">
        {cards.map((c) => (
          <NegCardView key={c.id} card={c} onEditar={() => onEditar(c)} />
        ))}
        {cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-slate-600">
            <ChevronRight size={20} className="mb-1 opacity-30" />
            <span>Arraste um card aqui</span>
          </div>
        )}
      </div>

      {/* Adicionar card */}
      {!isPerdido && (
        <div className="mt-2">
          {adicionandoAntiga && (
            <FormAntigaNegociacao
              estagio={coluna.titulo}
              clientes={clientes}
              onFechar={() => setAdicionandoAntiga(false)}
            />
          )}
          {adicionando ? (
            <FormAdicionar estagio={coluna.titulo} clientes={clientes} onFechar={() => setAdicionando(false)} />
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
function NegCardView({ card, arrastando, onEditar }: { card: CardData; arrastando?: boolean; onEditar?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });

  // Movimento suave: transição CSS apenas quando não está arrastando
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, transition: "none" }
    : { transition: "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)" };

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
        "group relative rounded-xl border bg-gradient-to-br p-3 shadow-md",
        "hover:shadow-lg hover:brightness-110 cursor-grab active:cursor-grabbing",
        "transition-shadow transition-[filter]",
        tema,
        (isDragging || arrastando) && "opacity-60 shadow-2xl ring-2 ring-agro-400 scale-105 z-50"
      )}
    >
      <div {...listeners} {...attributes}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <Link
            href={`/clientes/${card.clienteId}`}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-sm font-bold leading-tight text-white hover:text-agro-400 hover:underline transition-colors"
          >
            {card.cliente}
          </Link>
          {iconeCalor(card.termometro)}
        </div>
        {card.municipio && <div className="text-xs text-slate-400 mb-1.5">{card.municipio}</div>}
        {card.maquina && (
          <div className="inline-flex mb-2 items-center rounded-lg bg-agro-400/20 px-2 py-0.5 text-xs font-bold text-agro-300 border border-agro-400/20">
            {card.maquina}
          </div>
        )}
        <div className="text-base font-bold text-emerald-300 mb-2">{formatCurrency(card.valor)}</div>
        <Termometro valor={card.termometro} />
        {card.dataVisita && (
          <div className="mt-2 flex items-center gap-1 text-xs text-sky-300">
            <Calendar size={11} />{formatDateTime(card.dataVisita)}
          </div>
        )}
        {card.concorrente && (
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300 border border-red-500/20">
            ⚔ vs {card.concorrente}
          </div>
        )}
        {card.proximaAcao && (
          <div className="mt-2 flex items-start gap-1 text-xs text-violet-300 bg-violet-500/10 rounded-lg p-1.5 border border-violet-500/20">
            <Clock size={11} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{card.proximaAcao}</span>
          </div>
        )}
        {card.status === "ganha" && (
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-green-300">
            <CheckCircle2 size={12} /> VENDIDO
          </div>
        )}
      </div>
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
  estagio,
  clientes,
  onFechar,
}: {
  estagio: string;
  clientes: Cliente[];
  onFechar: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [pagamento, setPagamento] = useState("");
  const [entradaValor, setEntradaValor] = useState("");

  const CONDICAO_OPTS = [
    { value: "pesquisa_preco", label: "Pesquisa de Preço" },
    { value: "interesse_real", label: "Interesse Real" },
    { value: "avista", label: "À Vista" },
    { value: "financiamento", label: "Financiamento Banco" },
    { value: "crd_pme", label: "CRD PME" },
    { value: "consorcio", label: "Consórcio" },
    { value: "outro", label: "Outro" },
  ];

  const BANCOS = [
    "Banco do Brasil", "CNH Industrial Capital", "Bradesco", "Sicoob",
    "Sicredi", "Itaú", "Safra", "BV Financeira", "Outro",
  ];

  const MARCAS: Record<string, string[]> = {
    "CASE": ["CX130D","CX145C","CX145D","CX160D","CX210D","CX220D","CX240D","E145C","E215C","821G","851L","621G","RG140B","B110B","SV280"],
    "New Holland": ["E115C","E135B","E145C","E215C","W130C","W80C","RG140B"],
    "Outro": [],
  };

  const [marca, setMarca] = useState("");
  const maquinasDisp = MARCAS[marca] ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Nova Negociação</h3>
            <p className="text-xs text-slate-400 mt-0.5">Coluna: {estagio}</p>
          </div>
          <button onClick={onFechar} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>
        <form
          action={async (fd) => {
            fd.set("estagio", estagio);
            if (entradaValor) fd.set("entradaValor", entradaValor);
            startTransition(async () => {
              await criarNegociacaoCompleta(fd);
              onFechar();
            });
          }}
          className="p-5 space-y-4 max-h-[70vh] overflow-y-auto"
        >
          <input type="hidden" name="estagio" value={estagio} />
          {/* Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Cliente</label>
              <select name="clienteId" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-400">
                <option value="">— Selecionar —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Novo cliente</label>
              <input name="nomeNovo" placeholder="ou digitar nome" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          {/* Marca + Máquina */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Marca</label>
              <select value={marca} onChange={(e) => setMarca(e.target.value)} name="marca" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-400">
                <option value="">— Selecionar —</option>
                {Object.keys(MARCAS).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Máquina</label>
              {maquinasDisp.length > 0 ? (
                <select name="maquinaModelo" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-400">
                  <option value="">Selecione</option>
                  {maquinasDisp.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input name="maquinaModelo" placeholder="Ex: E215C" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-400" />
              )}
            </div>
          </div>
          {/* Valor */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Valor (R$)</label>
            <input name="valor" placeholder="0" inputMode="numeric" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          {/* Pagamento */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Condição de Pagamento</label>
            <select value={pagamento} onChange={(e) => setPagamento(e.target.value)} name="tipoPagamento" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-400">
              <option value="">—</option>
              {CONDICAO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* Banco (shown when financiamento or crd_pme) */}
          {(pagamento === "financiamento" || pagamento === "crd_pme") && (
            <div className={`rounded-xl p-3 space-y-3 ${pagamento === "crd_pme" ? "bg-emerald-50 border border-emerald-200" : "bg-blue-50 border border-blue-200"}`}>
              <p className={`text-xs font-bold uppercase ${pagamento === "crd_pme" ? "text-emerald-700" : "text-blue-700"}`}>
                {pagamento === "crd_pme" ? "CRD PME" : "Financiamento"}
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Banco</label>
                <select name="banco" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400">
                  <option value="">— Selecionar banco —</option>
                  {BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Entrada (R$)</label>
                <input
                  value={entradaValor}
                  onChange={(e) => setEntradaValor(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                />
              </div>
            </div>
          )}
          {/* Data da visita + Concorrente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Data da Visita</label>
              <input type="datetime-local" name="dataVisita" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Concorrente</label>
              <input name="concorrenteMencionado" placeholder="Ex: CAT, Komatsu..." className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          {/* Próxima ação */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Próxima Ação</label>
            <input name="proximaAcao" placeholder="Ex: Ligar terça para follow-up" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          {/* Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button type="button" onClick={onFechar} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button disabled={isPending} className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-agro-400 hover:bg-slate-800 transition-colors disabled:opacity-50">
              {isPending ? "Criando..." : "Criar Negociação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de edição ──────────────────────────────────────────────────────
const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all";
function paraInputLocal(iso: string | null): string {
  if (!iso) return "";
  const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  return fmt.format(new Date(iso)).replace(" ", "T");
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>{children}</label>;
}

function ModalEditar({ card, onClose, colunas }: { card: CardData; onClose: () => void; colunas: ColunaFunil[] }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{card.cliente}</h3>
              {card.municipio && <p className="text-xs text-slate-400 mt-0.5">{card.municipio}</p>}
            </div>
            <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all"><X size={18} /></button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="text-2xl font-bold text-emerald-300">{formatCurrency(card.valor)}</div>
            <Termometro valor={card.termometro} />
          </div>
        </div>
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <form action={async (fd) => { await editarNegociacao(card.id, fd); onClose(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Máquina"><input name="maquinaModelo" defaultValue={card.maquina ?? ""} className={inputCls} /></Campo>
              <Campo label="Valor (R$)"><input name="valor" inputMode="numeric" defaultValue={card.valor ?? ""} className={inputCls} /></Campo>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Coluna (estágio)">
                <select name="estagio" defaultValue={card.estagio} className={inputCls}>
                  {colunas.filter((c) => !c.titulo.toLowerCase().includes("perdid")).map((c) => (
                    <option key={c.id} value={c.titulo}>{c.titulo}</option>
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
            <Campo label="Data da visita"><input type="datetime-local" name="dataVisita" defaultValue={paraInputLocal(card.dataVisita)} className={inputCls} /></Campo>
            <Campo label="Concorrente"><input name="concorrenteMencionado" defaultValue={card.concorrente ?? ""} className={inputCls} placeholder="Ex: CAT, Komatsu..." /></Campo>
            <Campo label="Próxima ação"><input name="proximaAcao" defaultValue={card.proximaAcao ?? ""} className={inputCls} placeholder="Ex: Ligar terça para follow-up" /></Campo>
            <button disabled={isPending} className="w-full rounded-xl bg-slate-900 py-3 font-bold text-agro-400 hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg">
              {isPending ? "Salvando..." : "Salvar alterações"}
            </button>
          </form>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <form action={async () => { await excluirNegociacao(card.id); onClose(); }}>
              <button
                onClick={(e) => { if (!confirm(`Excluir negociação de ${card.cliente}?`)) e.preventDefault(); }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
              >
                <Trash2 size={13} /> Excluir negociação
              </button>
            </form>
          </div>
        </div>
      </div>
  );
}


// ── Formulário de negociação antiga (modal — mesmo padrão de "Nova Negociação") ──
function FormAntigaNegociacao({ estagio, clientes, onFechar }: { estagio: string; clientes: { id: string; nome: string }[]; onFechar: () => void }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Venda Antiga</h3>
            <p className="text-xs text-slate-400 mt-0.5">Coluna: {estagio}</p>
          </div>
          <button onClick={onFechar} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>
        <form
          action={(fd) => {
            fd.set("negociacaoAntiga", "true");
            fd.set("estagio", estagio);
            startTransition(async () => {
              await criarNegociacaoCompleta(fd);
              onFechar();
            });
          }}
          className="p-5 space-y-4 max-h-[70vh] overflow-y-auto"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Cliente</label>
            <select name="clienteId" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-400">
              <option value="">— Selecionar cliente —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Máquina</label>
            <input name="maquinaModelo" placeholder="Ex: E215C" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Valor (R$)</label>
            <input name="valor" placeholder="0" inputMode="numeric" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Mês/Ano da venda</label>
            <input type="month" name="mesAnoReferencia" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button type="button" onClick={onFechar} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button disabled={isPending} className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-agro-400 hover:bg-slate-800 transition-colors disabled:opacity-50">
              {isPending ? "Registrando..." : "Registrar Venda Antiga"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
