"use client";

import Link from "next/link";
import { useState, useTransition, useEffect, useRef } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  moverNegociacao, marcarPerdida, marcarGanha,
  criarColunaFunil, excluirColunaFunil, renomearColunaFunil,
  definirFaturadoEm,
} from "@/lib/actions";
import { criarCategorizadorColunas } from "@/lib/pipeline";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { FormNovaNegociacao } from "@/components/FormNovaNegociacao";
import {
  Plus, X, Pencil, Trophy, Calendar, Trash2,
  DollarSign, Target, ChevronRight, Flame, Snowflake,
  AlertTriangle, CheckCircle2, Clock, BarChart3, MoreVertical, Check,
  FileText,
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
  marca: string | null;
  bancoFinanciamento: string | null;
  entradaValor: number | null;
  entradaPercentual: number | null;
  dataPagamentoAvista: string | null;
  pagamentoNaEntrega: boolean;
  consorcioTipo: string | null;
  consorcioCotas: number | null;
  consorcioCredito: number | null;
  crdSaldoParcelasQtd: number | null;
  faturadoEm: string | null;
}

type Cliente = { id: string; nome: string };
type ColunaFunil = { id: string; titulo: string; cor: string; ordem: number; fixa: boolean };
type MaquinaPropria = { marca: string; modelo: string };

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
  maquinasProprias,
}: {
  cards: CardData[];
  clientes: Cliente[];
  colunas: ColunaFunil[];
  maquinasProprias: MaquinaPropria[];
}) {
  const [cards, setCards] = useState(cardsIniciais);
  const [colunas, setColunas] = useState(colunasIniciais);
  const [ativo, setAtivo] = useState<CardData | null>(null);
  const [editando, setEditando] = useState<CardData | null>(null);
  const [filtro, setFiltro] = useState("");
  const [abaFiltro, setAbaFiltro] = useState<"todos" | "abertos" | "faturados" | "perdidos">("todos");
  const [confirmFaturamento, setConfirmFaturamento] = useState<{ cardId: string; cliente: string } | null>(null);
  const [novaNegociacaoAberta, setNovaNegociacaoAberta] = useState(false);
  const [estagioPreSelecionado, setEstagioPreSelecionado] = useState<string | null>(null);
  const colunasParaNova = colunas.filter((c) => !c.titulo.toLowerCase().includes("perdid"));

  // Sensors com movimento suave: delay de 200ms no mouse, 250ms no toque
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  useEffect(() => setCards(cardsIniciais), [cardsIniciais]);
  useEffect(() => setColunas(colunasIniciais), [colunasIniciais]);

  // KPIs
  // "Em aberto" só conta cards cujo estágio bate com uma coluna ABERTA atual
  // (EM NEGOCIAÇÃO/EM BANCO) — exclui negociações "órfãs" (estagio de coluna
  // renomeada/excluída no passado) que nunca aparecem no board mas antes
  // inflavam essa contagem.
  const categorizarColuna = criarCategorizadorColunas(colunas);
  const abertos = cards.filter((c) => {
    if (c.status !== "aberta") return false;
    const cat = categorizarColuna(c.estagio);
    return cat === "em_negociacao" || cat === "banco";
  });
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
      (abaFiltro === "abertos" && abertos.some((a) => a.id === c.id)) ||
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
    // Ao cair na coluna FATURADO, pergunta se o faturamento foi hoje (ou retroativo).
    if (tituloNovo.includes("faturad")) {
      setConfirmFaturamento({ cardId: card.id, cliente: card.cliente });
    }
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

      {/* Nova Negociação — botão único no topo, abre modal central */}
      <button
        onClick={() => { setEstagioPreSelecionado(null); setNovaNegociacaoAberta(true); }}
        className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-black shadow-sm transition hover:brightness-95"
        style={{ background: "#BFDE4D" }}
      >
        <Plus size={16} /> Nova Negociação
      </button>

      {/* Funil Kanban com DnD suave */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {colunas.map((col) => {
              const tituloCol = col.titulo.toLowerCase();
              const isFaturado = tituloCol.includes("faturad");
              const colunaGanha = isFaturado || tituloCol.includes("ganho") || tituloCol.includes("confirm") || tituloCol.includes("vendid");
              // FATURADO é a coluna "chão-de-fábrica" do dinheiro faturado: mostra
              // TODOS os cards ganha (mesmo padrão da coluna Perdidos), não só os
              // que têm estagio === "FATURADO" — senão negociações ganhas por um
              // caminho legado (ex.: marcar_ganha da IA) somem do funil mas
              // continuam aparecendo no Financeiro, ficando as duas telas inconsistentes.
              const lista = tituloCol.includes("perdid")
                ? cardsFiltrados.filter((c) => c.status === "perdida")
                : isFaturado
                ? cardsFiltrados.filter((c) => c.status === "ganha")
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
                  onEditar={setEditando}
                  onRenomear={async (novoTitulo) => {
                    setColunas((cs) => cs.map((c) => c.id === col.id ? { ...c, titulo: novoTitulo } : c));
                    await renomearColunaFunil(col.id, novoTitulo);
                  }}
                  onExcluir={async () => {
                    setColunas((cs) => cs.filter((c) => c.id !== col.id));
                    await excluirColunaFunil(col.id);
                  }}
                  onNovaAntiga={() => { setEstagioPreSelecionado(col.titulo); setNovaNegociacaoAberta(true); }}
                />
              );
            })}
          </div>
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {ativo && <NegCardView card={ativo} arrastando />}
        </DragOverlay>
      </DndContext>

      {editando && (
        <FormNovaNegociacao
          titulo="Editar Negociação"
          clienteIdFixo={editando.clienteId}
          clienteNomeFixo={editando.cliente}
          colunas={colunasParaNova}
          estagioInicial={editando.estagio}
          maquinasProprias={maquinasProprias}
          negociacaoId={editando.id}
          valoresIniciais={{
            marca: editando.marca,
            maquinaModelo: editando.maquina,
            valor: editando.valor,
            tipoPagamento: editando.condicaoPagamento,
            bancoFinanciamento: editando.bancoFinanciamento,
            entradaValor: editando.entradaValor,
            entradaPercentual: editando.entradaPercentual,
            dataPagamentoAvista: editando.dataPagamentoAvista,
            pagamentoNaEntrega: editando.pagamentoNaEntrega,
            consorcioTipo: editando.consorcioTipo,
            consorcioCotas: editando.consorcioCotas,
            consorcioCredito: editando.consorcioCredito,
            crdSaldoParcelasQtd: editando.crdSaldoParcelasQtd,
            dataVisita: editando.dataVisita,
            dataFaturamento: editando.faturadoEm,
            concorrenteMencionado: editando.concorrente,
            proximaAcao: editando.proximaAcao,
          }}
          onFechar={() => setEditando(null)}
        />
      )}

      {novaNegociacaoAberta && (
        <FormNovaNegociacao
          titulo={estagioPreSelecionado ? "Venda Antiga" : "Nova Negociação"}
          colunas={colunasParaNova}
          estagioInicial={estagioPreSelecionado ?? undefined}
          clientes={clientes}
          maquinasProprias={maquinasProprias}
          onFechar={() => { setNovaNegociacaoAberta(false); setEstagioPreSelecionado(null); }}
        />
      )}

      {confirmFaturamento && (
        <PopupConfirmarFaturamento
          cliente={confirmFaturamento.cliente}
          onFechar={() => setConfirmFaturamento(null)}
          onConfirmarData={async (data) => {
            await definirFaturadoEm(confirmFaturamento.cardId, data);
            setConfirmFaturamento(null);
          }}
        />
      )}
    </div>
  );
}

// ── Pop-up de confirmação da data de faturamento (ao arrastar para FATURADO) ──
function PopupConfirmarFaturamento({
  cliente,
  onFechar,
  onConfirmarData,
}: {
  cliente: string;
  onFechar: () => void;
  onConfirmarData: (data: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [retroativo, setRetroativo] = useState(false);
  const [data, setData] = useState("");
  const hojeStr = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Faturamento</h3>
            <p className="text-xs text-slate-400 mt-0.5">{cliente}</p>
          </div>
          <button onClick={onFechar} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!retroativo ? (
            <>
              <p className="text-sm text-slate-600">O faturamento foi hoje, <b>{hojeStr}</b>?</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={onFechar}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-agro-400 hover:bg-slate-800 transition-colors"
                >
                  Sim, foi hoje
                </button>
                <button
                  onClick={() => setRetroativo(true)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50 transition-colors"
                >
                  Informar data
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Data do faturamento</label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRetroativo(false)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50 transition-colors"
                >
                  Voltar
                </button>
                <button
                  disabled={!data || isPending}
                  onClick={() => startTransition(() => onConfirmarData(data))}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-agro-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : "Confirmar data"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
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
  coluna, cards, total, onEditar, onRenomear, onExcluir, onNovaAntiga,
}: {
  coluna: ColunaFunil;
  cards: CardData[];
  total: number;
  onEditar: (c: CardData) => void;
  onRenomear: (titulo: string) => Promise<void>;
  onExcluir: () => Promise<void>;
  onNovaAntiga: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const [renomeando, setRenomeando] = useState(false);
  const [menu, setMenu] = useState(false);
  const [, startTransition] = useTransition();

  const isPerdido = coluna.titulo.toLowerCase().includes("perdid");

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border-t-4 bg-slate-900/80 backdrop-blur-sm p-3 transition-all duration-200 max-h-[75vh]",
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
                    onNovaAntiga();
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

      {/* Cards com animação de entrada — rolagem própria da coluna, não da página */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
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
        <div className="mt-2.5 flex items-center border-t border-white/10 pt-2">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onEditar}
            className="flex flex-1 items-center justify-center gap-1 text-xs font-medium text-slate-300 hover:text-agro-400 transition-colors"
          >
            <Pencil size={11} /> Editar
          </button>
          <Link
            href={`/negociacoes/${card.id}/proposta`}
            onPointerDown={(e) => e.stopPropagation()}
            title="Proposta de uma página + calculadora de custo por hora"
            className="flex flex-1 items-center justify-center gap-1 border-l border-white/10 text-xs font-medium text-slate-300 hover:text-agro-400 transition-colors"
          >
            <FileText size={11} /> Proposta
          </Link>
        </div>
      )}
    </div>
  );
}

