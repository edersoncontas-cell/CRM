"use client";

import Link from "next/link";
import { useState, useTransition, useEffect, useRef } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  moverNegociacao,
  criarColunaFunil, excluirColunaFunil, renomearColunaFunil, definirPapelColunaFunil,
  definirFaturadoEm,
} from "@/lib/actions";
import {
  criarCategorizadorColunas, papelDaColuna, probabilidadeDaColuna, valorPonderado, corDaColuna, ehFunilAberto,
  PAPEIS_COLUNA, MOTIVOS_PERDA, rotuloMotivoPerda, rotuloPapel,
} from "@/lib/pipeline";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { FormNovaNegociacao } from "@/components/FormNovaNegociacao";
import { Celebracao } from "@/components/Celebracao";
import {
  Plus, X, Pencil, Trophy, Calendar, Trash2,
  DollarSign, Target, ChevronRight, Flame, Snowflake,
  CheckCircle2, Clock, BarChart3, MoreVertical, Check,
  FileText, Percent, Repeat, TrendingDown,
} from "lucide-react";

interface CardData {
  id: string;
  estagio: string;
  status: string;
  criadoEm: string;
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
  motivoPerda: string | null;
  usadaTroca: boolean;
  usadaMarca: string | null;
  usadaModelo: string | null;
  usadaAno: number | null;
  usadaHorimetro: number | null;
  usadaEstado: string | null;
  usadaValor: number | null;
  usadaObs: string | null;
}

type Cliente = { id: string; nome: string };
type ColunaFunil = { id: string; titulo: string; cor: string; ordem: number; fixa: boolean; papel: string | null; probabilidade: number };
type MaquinaPropria = { marca: string; modelo: string };

// Só marca os extremos: chama = negociação quente, floco = fria. O meio
// (a maioria dos cards) fica limpo, sem ícone.
function iconeCalor(t: number) {
  if (t >= 70) return <span title="Negociação quente"><Flame size={13} className="text-orange-400" /></span>;
  if (t < 40) return <span title="Negociação fria"><Snowflake size={13} className="text-sky-400" /></span>;
  return null;
}

// ── Componente principal ──────────────────────────────────────────────────
export function FunilNegociacoes({
  cards: cardsIniciais,
  clientes,
  colunas: colunasIniciais,
  maquinasProprias,
  periodoRotulo,
}: {
  cards: CardData[];
  clientes: Cliente[];
  colunas: ColunaFunil[];
  maquinasProprias: MaquinaPropria[];
  /** Só para a coluna vazia dizer de QUE período ela está vazia. */
  periodoRotulo: string;
}) {
  const [cards, setCards] = useState(cardsIniciais);
  const [colunas, setColunas] = useState(colunasIniciais);
  const [ativo, setAtivo] = useState<CardData | null>(null);
  const [editando, setEditando] = useState<CardData | null>(null);
  const [filtro, setFiltro] = useState("");
  const [abaFiltro, setAbaFiltro] = useState<"todos" | "abertos" | "faturados">("todos");
  const [confirmFaturamento, setConfirmFaturamento] = useState<{ cardId: string; cliente: string } | null>(null);
  const [celebrando, setCelebrando] = useState(false);
  const [confirmPerda, setConfirmPerda] = useState<{ cardId: string; cliente: string; estagio: string } | null>(null);
  const [novaNegociacaoAberta, setNovaNegociacaoAberta] = useState(false);
  const [estagioPreSelecionado, setEstagioPreSelecionado] = useState<string | null>(null);
  const colunasParaNova = colunas.filter((c) => papelDaColuna(c) !== "perdida");
  // A venda perdida saiu do quadro: tem página própria (/vendas-perdidas). A
  // coluna continua existindo no banco, porque é para onde a negociação vai
  // quando é marcada como perdida — ela só não é desenhada aqui.
  const colunasNoQuadro = colunas.filter((c) => papelDaColuna(c) !== "perdida");
  // Para onde a negociação vai ao ser marcada como perdida. É o TÍTULO da
  // coluna de papel "perdida", porque Negociacao.estagio guarda o título e não
  // o id. A reserva existe para o banco que ainda não rodou a manutenção: o
  // servidor resolve a coluna pelo papel de qualquer jeito, e sem ela o menu
  // ficaria morto justamente onde a migração não passou.
  const estagioPerdida = colunas.find((c) => papelDaColuna(c) === "perdida")?.titulo ?? "VENDA PERDIDA";

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
    return ehFunilAberto(categorizarColuna(c.estagio));
  });
  const faturados = cards.filter((c) => c.status === "ganha");
  const perdidos = cards.filter((c) => c.status === "perdida");
  const totalAberto = abertos.reduce((s, c) => s + (c.valor ?? 0), 0);
  const totalFaturado = faturados.reduce((s, c) => s + (c.valor ?? 0), 0);
  // Previsão ponderada: valor × probabilidade da coluna (só abertas).
  const previsaoPonderada = valorPonderado(abertos, colunas);
  const encerrados = faturados.length + perdidos.length;
  const taxaConversao = encerrados > 0 ? Math.round((faturados.length / encerrados) * 100) : 0;

  // Filtrar cards
  const cardsFiltrados = cards.filter((c) => {
    const matchFiltro = filtro === "" ||
      c.cliente.toLowerCase().includes(filtro.toLowerCase()) ||
      (c.maquina ?? "").toLowerCase().includes(filtro.toLowerCase()) ||
      (c.municipio ?? "").toLowerCase().includes(filtro.toLowerCase());
    const matchAba =
      abaFiltro === "todos" ||
      (abaFiltro === "abertos" && abertos.some((a) => a.id === c.id)) ||
      (abaFiltro === "faturados" && c.status === "ganha");
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
    // Usa o titulo da coluna como estagio (chave dinamica); o que acontece
    // com o card depende do PAPEL da coluna (mesma regra do servidor).
    const novoEstagio = novaColuna.titulo;
    const papel = papelDaColuna(novaColuna);
    if (card.estagio === novoEstagio) return;
    if (papel === "perdida") {
      // Só marca como perdida depois de escolher o motivo (pop-up).
      setConfirmPerda({ cardId: card.id, cliente: card.cliente, estagio: novoEstagio });
      return;
    }
    // Só FATURADO marca venda: NEGOCIAÇÃO é fase aberta (ver actions.ts).
    const isGanha = papel === "faturado";
    setCards((cs) =>
      cs.map((c) =>
        c.id === card.id ? { ...c, estagio: novoEstagio, status: isGanha ? "ganha" : "aberta", faturadoEm: papel === "faturado" ? new Date().toISOString() : c.faturadoEm } : c
      )
    );
    moverNegociacao(card.id, novoEstagio);
    // Ao cair na coluna FATURADO: fogos + pergunta se o faturamento foi hoje (ou retroativo).
    if (papel === "faturado") {
      comemorar();
      setConfirmFaturamento({ cardId: card.id, cliente: card.cliente });
    }
  }

  // Comemoração de venda faturada (fogos com cifrões, confete e BORA PRA CIMA).
  function comemorar() {
    setCelebrando(false);
    // Reinicia a animação mesmo se outra estiver rodando.
    requestAnimationFrame(() => setCelebrando(true));
  }
  function colunaEhFaturado(estagio: string): boolean {
    const col = colunas.find((c) => c.titulo === estagio);
    return col ? papelDaColuna(col) === "faturado" : estagio.toLowerCase().includes("faturad");
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icone={<Target size={20} />} rotulo="Em aberto" valor={abertos.length.toString()} sub={formatCurrency(totalAberto)} cor="azul" />
        <KpiCard icone={<DollarSign size={20} />} rotulo="Previsão ponderada" valor={formatCurrency(previsaoPonderada)} sub="valor × probabilidade da coluna" cor="verde" />
        <KpiCard icone={<Trophy size={20} />} rotulo="Vendas faturadas" valor={faturados.length.toString()} sub={formatCurrency(totalFaturado)} cor="amarelo" />
        <KpiCard icone={<BarChart3 size={20} />} rotulo="Taxa conversão" valor={`${taxaConversao}%`} sub={`${faturados.length} ganhas · ${perdidos.length} perdidas`} cor="roxo" />
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
          {(["todos", "abertos", "faturados"] as const).map((aba) => (
            <button
              key={aba}
              onClick={() => setAbaFiltro(aba)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all",
                abaFiltro === aba ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              {aba === "todos" ? "Todos" : aba === "abertos" ? "Em aberto" : "Faturados"}
            </button>
          ))}
        </div>
        {/* A venda perdida saiu do quadro; o caminho para ela fica aqui, ao
            lado dos filtros, para não virar tela escondida no menu. */}
        <Link
          href="/vendas-perdidas"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm transition-colors hover:border-red-200 hover:text-red-600"
        >
          Vendas perdidas <ChevronRight size={13} />
        </Link>
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
      <DndContext id="dnd-funil" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {colunasNoQuadro.map((col) => {
              const papel = papelDaColuna(col);
              // FATURADO é a coluna "chão-de-fábrica" do dinheiro faturado: mostra
              // TODOS os cards ganha com data de faturamento (mesmo padrão da
              // coluna Perdidos) — senão negociações ganhas por um caminho
              // legado (ex.: marcar_ganha da IA) somem do funil mas continuam
              // no Financeiro, ficando as duas telas inconsistentes.
              const lista = papel === "perdida"
                ? cardsFiltrados.filter((c) => c.status === "perdida")
                : papel === "faturado"
                ? cardsFiltrados.filter((c) => c.status === "ganha" && (c.faturadoEm || c.estagio === col.titulo))
                : papel === "confirmada"
                ? cardsFiltrados.filter((c) => c.status === "aberta" && c.estagio === col.titulo)
                : cardsFiltrados.filter((c) => c.status === "aberta" && c.estagio === col.titulo);
              const totalCol = lista.reduce((s, c) => s + (c.valor ?? 0), 0);
              return (
                <ColunaFunilView
                  key={col.id}
                  coluna={col}
                  cards={lista}
                  total={totalCol}
                  periodoRotulo={periodoRotulo}
                  onEditar={setEditando}
                  onPapel={async (novoPapel, prob) => {
                    const r = await definirPapelColunaFunil(col.id, novoPapel, prob);
                    if (!r.ok) { alert(r.erro ?? "Não foi possível alterar."); return; }
                    setColunas((cs) => cs.map((c) => c.id === col.id ? { ...c, papel: novoPapel, probabilidade: prob } : c));
                  }}
                  onRenomear={async (novoTitulo) => {
                    setColunas((cs) => cs.map((c) => c.id === col.id ? { ...c, titulo: novoTitulo } : c));
                    await renomearColunaFunil(col.id, novoTitulo);
                  }}
                  onExcluir={async () => {
                    setColunas((cs) => cs.filter((c) => c.id !== col.id));
                    await excluirColunaFunil(col.id);
                  }}
                  onNovaAntiga={() => { setEstagioPreSelecionado(col.titulo); setNovaNegociacaoAberta(true); }}
                  onPerder={(card) => setConfirmPerda({ cardId: card.id, cliente: card.cliente, estagio: estagioPerdida })}
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
            usadaTroca: editando.usadaTroca,
            usadaMarca: editando.usadaMarca,
            usadaModelo: editando.usadaModelo,
            usadaAno: editando.usadaAno,
            usadaHorimetro: editando.usadaHorimetro,
            usadaEstado: editando.usadaEstado,
            usadaValor: editando.usadaValor,
            usadaObs: editando.usadaObs,
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
          onSucesso={(info) => { if (info && !info.excluida && colunaEhFaturado(info.estagio)) comemorar(); }}
        />
      )}

      <Celebracao ativa={celebrando} onFim={() => setCelebrando(false)} />

      {confirmPerda && (
        <PopupMotivoPerda
          cliente={confirmPerda.cliente}
          onFechar={() => setConfirmPerda(null)}
          onConfirmar={async (motivo) => {
            const { cardId, estagio } = confirmPerda;
            setCards((cs) => cs.map((c) => c.id === cardId ? { ...c, estagio, status: "perdida", motivoPerda: motivo } : c));
            setConfirmPerda(null);
            await moverNegociacao(cardId, estagio, motivo);
          }}
        />
      )}

      {/* A pergunta da data só aparece depois da comemoração, para não ficar por baixo dos fogos. */}
      {confirmFaturamento && !celebrando && (
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

// ── Pop-up do motivo da perda ───────────────────────────────────────────────
//
// Abre por dois caminhos: pelos 3 pontinhos do card e (para quem ainda enxerga
// a coluna) ao arrastar para a coluna de papel "perdida".
//
// O motivo é OBRIGATÓRIO aqui de propósito — já vem um selecionado e não dá
// para confirmar sem escolher. Perda sem motivo não vira aprendizado nenhum:
// é só um número que caiu do funil.
function PopupMotivoPerda({ cliente, onFechar, onConfirmar }: {
  cliente: string;
  onFechar: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState(MOTIVOS_PERDA[0].id);
  const [nota, setNota] = useState("");
  const [isPending, startTransition] = useTransition();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onFechar}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-900">Por que perdemos {cliente}?</h3>
        <p className="mt-1 text-xs text-slate-500">Ao confirmar, a negociação sai do funil e vai para <b>Vendas Perdidas</b>, com o motivo no ranking. Escolha o principal.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {MOTIVOS_PERDA.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMotivo(m.id)}
              className={cn(
                "rounded-xl border px-3 py-2 text-left text-xs font-semibold transition",
                motivo === m.id ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <input
          id="perda-nota"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Detalhe (opcional): qual concorrente, valor, o que o cliente disse"
          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400"
        />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onFechar} className="flex-1 rounded-xl border border-slate-300 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => onConfirmar(nota.trim() ? `${motivo}: ${nota.trim()}` : motivo))}
            className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Salvando…" : "Marcar como perdida"}
          </button>
        </div>
      </div>
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
    // No celular o card tem ~170 px: ícone em cima e número embaixo, com
    // tamanho que encolhe quando o valor é comprido (R$ 2.149.000), para nunca
    // vazar do card. No desktop volta a ficar ícone ao lado.
    <div className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${COR_KPI[cor] ?? "bg-slate-50 border-slate-100"}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className={`w-fit rounded-xl p-2 ${COR_KPI_ICON[cor] ?? "bg-slate-100 text-slate-600"}`}>{icone}</div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium leading-tight text-slate-500">{rotulo}</div>
          <div className={`break-words font-bold leading-tight tabular-nums text-slate-800 ${valor.length > 10 ? "text-base sm:text-xl" : "text-xl"}`}>{valor}</div>
          {sub && <div className="mt-0.5 break-words text-xs leading-snug text-slate-400">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Coluna do funil ──────────────────────────────────────────────────────
function ColunaFunilView({
  coluna, cards, total, periodoRotulo, onEditar, onPerder, onRenomear, onExcluir, onNovaAntiga, onPapel,
}: {
  coluna: ColunaFunil;
  cards: CardData[];
  total: number;
  periodoRotulo: string;
  onEditar: (c: CardData) => void;
  onPerder: (c: CardData) => void;
  onRenomear: (titulo: string) => Promise<void>;
  onExcluir: () => Promise<void>;
  onNovaAntiga: () => void;
  onPapel: (papel: string, probabilidade: number) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const [renomeando, setRenomeando] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editandoPapel, setEditandoPapel] = useState(false);
  const [papelSel, setPapelSel] = useState(papelDaColuna(coluna));
  const [probSel, setProbSel] = useState(String(probabilidadeDaColuna(coluna)));
  const [, startTransition] = useTransition();

  const papel = papelDaColuna(coluna);
  const isPerdido = papel === "perdida";
  const probabilidade = probabilidadeDaColuna(coluna);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border-t-4 bg-[var(--funil-coluna)]/85 backdrop-blur-sm p-3 transition-all duration-200 max-h-[75vh]",
        isOver && "ring-2 ring-agro-400 bg-[var(--funil-coluna2)]/95 scale-[1.01] shadow-xl"
      )}
      // A cor vem do PAPEL, em variável CSS — não da classe gravada em
      // coluna.cor. Assim renomear a coluna não muda a cor de lugar, e a
      // paleta vale nos dois temas sem tocar no banco.
      style={{ minHeight: 200, borderTopColor: corDaColuna(coluna) }}
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
                className="flex-1 min-w-0 rounded-lg bg-[var(--funil-coluna2)] px-2 py-1 text-sm text-[var(--funil-card-texto)] outline-none ring-1 ring-[var(--funil-coluna-borda)] focus:ring-agro-400"
              />
              <button className="text-green-400 hover:text-green-300"><Check size={14} /></button>
              <button type="button" onClick={() => setRenomeando(false)} className="text-[var(--funil-card-texto2)] hover:text-[var(--funil-card-texto)]"><X size={14} /></button>
            </form>
          ) : (
            <span className="truncate text-sm font-bold text-[var(--funil-card-texto)] flex-1">{coluna.titulo}</span>
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
                className="rounded-lg p-1 text-[var(--funil-card-texto2)] hover:bg-[var(--menu-hover)] hover:text-[var(--funil-card-texto)] transition-colors"
              >
                <MoreVertical size={14} />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-[var(--funil-coluna-borda)] bg-[var(--funil-coluna2)] py-1 shadow-2xl">
                    <button
                      onClick={() => { setRenomeando(true); setMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--funil-card-texto)] hover:bg-[var(--menu-hover)] transition-colors"
                    >
                      <Pencil size={12} /> Renomear
                    </button>
                    <button
                      onClick={() => { setEditandoPapel(true); setMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--funil-card-texto)] hover:bg-[var(--menu-hover)] transition-colors"
                    >
                      <Percent size={12} /> Papel e chance
                    </button>
                    {papel === "faturado" && (
                <button
                  onClick={() => {
                    setMenu(false);
                    onNovaAntiga();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-amber-600 hover:bg-[var(--menu-hover)] transition-colors dark:text-amber-300"
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
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-[var(--menu-hover)] transition-colors"
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

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--funil-card-texto2)]" title="Papel da coluna">
            {rotuloPapel(papel)}{papel !== "perdida" && papel !== "faturado" ? ` · ${probabilidade}%` : ""}
          </span>
          {total > 0 && (
            <span className={cn("text-xs font-semibold", isPerdido ? "text-red-400/80" : "text-agro-300")}>
              {formatCurrency(total)}
            </span>
          )}
        </div>
        {editandoPapel && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const prob = Math.max(0, Math.min(100, parseInt(probSel, 10) || 0));
              startTransition(async () => { await onPapel(papelSel, prob); setEditandoPapel(false); });
            }}
            className="mt-2 space-y-1.5 rounded-xl bg-[var(--funil-coluna2)] p-2 ring-1 ring-[var(--funil-coluna-borda)]"
          >
            <select value={papelSel} onChange={(e) => setPapelSel(e.target.value as typeof papelSel)} className="w-full rounded-lg bg-[var(--funil-card)] px-2 py-1 text-xs text-[var(--funil-card-texto)]" aria-label="Papel da coluna">
              {PAPEIS_COLUNA.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <p className="text-[10px] text-[var(--funil-card-texto2)]">{PAPEIS_COLUNA.find((p) => p.id === papelSel)?.descricao}</p>
            <label className="flex items-center gap-2 text-[11px] text-[var(--funil-card-texto)]">
              Chance de fechar
              <input type="number" min={0} max={100} value={probSel} onChange={(e) => setProbSel(e.target.value)} className="w-16 rounded-lg bg-[var(--funil-card)] px-2 py-1 text-xs text-[var(--funil-card-texto)]" aria-label="Probabilidade" />%
            </label>
            <div className="flex gap-1">
              <button className="flex-1 rounded-lg bg-agro-400 px-2 py-1 text-xs font-bold text-slate-900">Salvar</button>
              <button type="button" onClick={() => setEditandoPapel(false)} className="rounded-lg px-2 py-1 text-xs text-[var(--funil-card-texto2)]">Cancelar</button>
            </div>
          </form>
        )}
        {!isPerdido && total > 0 && (
          <div className="mt-2 h-1 w-full rounded-full bg-[var(--funil-coluna-borda)]">
            <div className="h-full rounded-full bg-gradient-to-r from-agro-400 to-emerald-500 transition-all duration-500" style={{ width: "100%" }} />
          </div>
        )}
      </div>

      {/* Cards com animação de entrada — rolagem própria da coluna, não da página */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {cards.map((c) => (
          <NegCardView
            key={c.id}
            card={c}
            cor={corDaColuna(coluna)}
            onEditar={() => onEditar(c)}
            /* Só negociação ABERTA pode virar perdida. Máquina já faturada não
               se "perde" — desfazer faturamento é outra conversa, e oferecer
               aqui só daria chance de zerar uma venda real por engano. */
            onPerder={c.status === "aberta" ? () => onPerder(c) : undefined}
          />
        ))}
        {cards.length === 0 && (
          // Vazia por falta de movimento no período é diferente de vazia por
          // não ter nada: sem dizer qual das duas, ele acha que sumiu card.
          <div className="flex flex-col items-center justify-center gap-0.5 py-8 text-center text-xs text-[var(--funil-card-texto2)] opacity-70">
            <ChevronRight size={20} className="mb-1 opacity-30" />
            <span>Nada em {periodoRotulo}</span>
            <span className="text-[10px] opacity-70">arraste um card aqui</span>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Card de negociação ───────────────────────────────────────────────────
function NegCardView({ card, cor, arrastando, onEditar, onPerder }: { card: CardData; cor?: string; arrastando?: boolean; onEditar?: () => void; onPerder?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const [menu, setMenu] = useState(false);

  // Movimento suave: transição CSS apenas quando não está arrastando
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, transition: "none" }
    : { transition: "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)" };

  // Paleta "Sóbrio": o card é NEUTRO e a cor aparece só no trilho da esquerda,
  // que é a cor da coluna. Antes o card era pintado pelo TERMÔMETRO — e era
  // por isso que OPORTUNIDADE e PROPOSTA ficavam as duas laranja e vermelho, e
  // não dava para distinguir a fase de relance. O termômetro continua visível,
  // na chaminha ao lado do nome.

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: "var(--funil-card)",
        borderColor: "var(--funil-card-borda)",
        borderLeft: `3px solid ${cor ?? "var(--funil-card-borda)"}`,
      }}
      className={cn(
        "group relative rounded-xl border p-3 shadow-md",
        "hover:shadow-lg hover:brightness-110 cursor-grab active:cursor-grabbing",
        "transition-shadow transition-[filter]",
        (isDragging || arrastando) && "opacity-60 shadow-2xl ring-2 ring-agro-400 scale-105 z-50"
      )}
    >
      {/* 3 pontinhos do CARD. Fora da área de arrasto, por cima dela.
          Sem eles não existe mais NENHUM jeito de marcar perda: o único
          caminho era arrastar para a coluna Perdidas, e ela saiu do quadro
          quando virou seção própria. */}
      {!arrastando && onPerder && (
        <div className="absolute right-1.5 top-1.5 z-20">
          <button
            type="button"
            aria-label="Opções da negociação"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={() => setMenu((v) => !v)}
            className="rounded-lg p-1.5 text-[var(--funil-card-texto2)] transition-colors hover:bg-[var(--menu-hover)] hover:text-[var(--funil-card-texto)]"
          >
            <MoreVertical size={14} />
          </button>
          {menu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onPointerDown={(e) => { e.stopPropagation(); setMenu(false); }}
              />
              <div className="absolute right-0 z-50 mt-1 w-44 rounded-xl border border-[var(--funil-coluna-borda)] bg-[var(--funil-coluna2)] py-1 shadow-2xl">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => { setMenu(false); onPerder(); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-red-500 transition-colors hover:bg-[var(--menu-hover)]"
                >
                  <TrendingDown size={13} /> Venda perdida
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div {...listeners} {...attributes}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <Link
            href={`/clientes/${card.clienteId}`}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-sm font-bold leading-tight text-[var(--funil-card-texto)] hover:text-agro-500 hover:underline transition-colors"
          >
            {card.cliente}
          </Link>
          {/* Espaço reservado para os 3 pontinhos, que flutuam por cima: o
              botão não pode morar aqui dentro porque este bloco é a área de
              arrasto e o dnd-kit a marca como role="button" — botão dentro de
              botão come o clique e confunde leitor de tela. */}
          <span className={cn("shrink-0", onPerder && !arrastando && "mr-7")}>{iconeCalor(card.termometro)}</span>
        </div>
        {card.municipio && <div className="text-xs text-[var(--funil-card-texto2)] mb-1.5">{card.municipio}</div>}
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
        {card.usadaTroca && card.usadaModelo && (
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-200 border border-amber-500/20" title="Usada na troca">
            <Repeat size={10} /> troca: {card.usadaModelo}{card.usadaValor ? ` · ${formatCurrency(card.usadaValor)}` : ""}
          </div>
        )}
        {card.status === "ganha" && (
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-green-300">
            <CheckCircle2 size={12} /> VENDIDO
          </div>
        )}
        {card.status === "perdida" && (
          <div className="mt-2 text-[11px] text-red-300/90">Motivo: {rotuloMotivoPerda(card.motivoPerda)}</div>
        )}
      </div>
      {!arrastando && onEditar && (
        <div className="mt-2.5 flex items-center border-t border-[var(--funil-card-borda)] pt-2">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onEditar}
            className="flex flex-1 items-center justify-center gap-1 text-xs font-medium text-[var(--funil-card-texto2)] hover:text-agro-500 transition-colors"
          >
            <Pencil size={11} /> Editar
          </button>
          <Link
            href={`/negociacoes/${card.id}/proposta`}
            onPointerDown={(e) => e.stopPropagation()}
            title="Proposta de uma página + calculadora de custo por hora"
            className="flex flex-1 items-center justify-center gap-1 border-l border-[var(--funil-card-borda)] text-xs font-medium text-[var(--funil-card-texto2)] hover:text-agro-500 transition-colors"
          >
            <FileText size={11} /> Proposta
          </Link>
        </div>
      )}
    </div>
  );
}

