"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  moverNegociacao, marcarPerdida, marcarGanha,
  criarNegociacaoCard, editarNegociacao, excluirNegociacao,
  criarTarefa, editarTarefa, moverTarefa, excluirTarefa,
  criarColunaDemanda, excluirColunaDemanda,
} from "@/lib/actions";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { Termometro } from "@/components/ui";
import { ESTAGIOS, COL_PERDIDO } from "@/lib/pipeline";
import { Plus, X, Pencil, Trophy, Calendar, Trash2, CheckSquare, Square, ListChecks } from "lucide-react";

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
type ColunaDemanda = { id: string; titulo: string; cor: string; fixa: boolean };
type DemandaCard = {
  id: string;
  titulo: string;
  descricao: string | null;
  coluna: string;
  checklist: string | null;
  clienteId: string | null;
};
type ItemChecklist = { t: string; d: boolean };

const COLUNAS_NEG = [...ESTAGIOS, COL_PERDIDO];

// Parse seguro do checklist (JSON) — local para não importar código de servidor.
function lerChecklist(raw: string | null | undefined): ItemChecklist[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((i) => i && typeof i.t === "string").map((i) => ({ t: String(i.t), d: !!i.d }));
  } catch {
    return [];
  }
}

// Converte uma data ISO para o formato do input datetime-local em horário de Brasília.
function paraInputLocal(iso: string | null): string {
  if (!iso) return "";
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return fmt.format(new Date(iso)).replace(" ", "T");
}

export function KanbanBoard({
  cards: cardsIniciais,
  clientes,
  colunasDemanda,
  demandas: demandasIniciais,
}: {
  cards: CardData[];
  clientes: Cliente[];
  colunasDemanda: ColunaDemanda[];
  demandas: DemandaCard[];
}) {
  const [cards, setCards] = useState(cardsIniciais);
  const [demandas, setDemandas] = useState(demandasIniciais);
  const [ativoNeg, setAtivoNeg] = useState<CardData | null>(null);
  const [ativoTar, setAtivoTar] = useState<DemandaCard | null>(null);
  const [editando, setEditando] = useState<CardData | null>(null);
  const [editandoTarefa, setEditandoTarefa] = useState<DemandaCard | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Re-sincroniza com o servidor após cada ação (as actions revalidam a rota).
  useEffect(() => setCards(cardsIniciais), [cardsIniciais]);
  useEffect(() => setDemandas(demandasIniciais), [demandasIniciais]);

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (id.startsWith("tar:")) {
      setAtivoTar(demandas.find((d) => `tar:${d.id}` === id) ?? null);
    } else {
      setAtivoNeg(cards.find((c) => c.id === id) ?? null);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const ativoTarefa = ativoTar;
    setAtivoNeg(null);
    setAtivoTar(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Tarefa (card Trello) → só pode cair em coluna de demanda.
    if (activeId.startsWith("tar:")) {
      if (!overId.startsWith("dem:")) return;
      const tarId = activeId.slice(4);
      const novaColuna = overId.slice(4);
      const tar = ativoTarefa ?? demandas.find((d) => d.id === tarId);
      if (!tar || tar.coluna === novaColuna) return;
      setDemandas((ds) => ds.map((d) => (d.id === tarId ? { ...d, coluna: novaColuna } : d)));
      moverTarefa(tarId, novaColuna);
      return;
    }

    // Negociação → só pode cair em coluna do funil.
    if (overId.startsWith("dem:")) return;
    const card = cards.find((c) => c.id === activeId);
    if (!card) return;
    const perdido = overId === COL_PERDIDO.id;
    if (card.estagio === overId && (perdido ? card.status === "perdida" : card.status === "aberta")) return;
    setCards((cs) =>
      cs.map((c) =>
        c.id === card.id ? { ...c, estagio: overId, status: perdido ? "perdida" : "aberta" } : c
      )
    );
    moverNegociacao(card.id, overId);
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {/* Colunas de DEMANDAS (estilo Trello) */}
          {colunasDemanda.map((col) => (
            <ColunaDemandaView
              key={col.id}
              coluna={col}
              cards={demandas.filter((d) => d.coluna === col.id)}
              onEditar={setEditandoTarefa}
            />
          ))}

          {/* Botão de nova coluna de demanda */}
          <NovaColuna />

          {/* Separador visual entre demandas e funil */}
          <div className="mx-1 w-px shrink-0 self-stretch bg-slate-200" />

          {/* Colunas do FUNIL de negociação */}
          {COLUNAS_NEG.map((col) => {
            const lista =
              col.id === COL_PERDIDO.id
                ? cards.filter((c) => c.status === "perdida")
                : cards.filter((c) => c.status === "aberta" && c.estagio === col.id);
            return (
              <Coluna
                key={col.id}
                id={col.id}
                titulo={col.titulo}
                cor={col.cor}
                cards={lista}
                clientes={clientes}
                permiteAdicionar={col.id !== COL_PERDIDO.id}
                onEditar={setEditando}
              />
            );
          })}
        </div>
        <DragOverlay>
          {ativoNeg && <CardView card={ativoNeg} arrastando />}
          {ativoTar && <DemandaCardView card={ativoTar} arrastando />}
        </DragOverlay>
      </DndContext>

      {editando && <ModalEditar card={editando} onClose={() => setEditando(null)} />}
      {editandoTarefa && (
        <ModalEditarTarefa tarefa={editandoTarefa} onClose={() => setEditandoTarefa(null)} />
      )}
    </>
  );
}

// ── Coluna de demanda (Trello) ──────────────────────────────────────────────
function ColunaDemandaView({
  coluna, cards, onEditar,
}: {
  coluna: ColunaDemanda;
  cards: DemandaCard[];
  onEditar: (t: DemandaCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `dem:${coluna.id}` });
  const [adicionando, setAdicionando] = useState(false);
  const [excluindo, startExcluir] = useTransition();

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border-t-4 bg-slate-50 p-3 transition-all",
        coluna.cor,
        isOver && "bg-agro-50 ring-2 ring-agro-400"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ListChecks size={15} className="text-slate-400" />
          <span className="text-sm font-bold text-slate-700">{coluna.titulo}</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 shadow-sm">
            {cards.length}
          </span>
        </div>
        {!coluna.fixa && (
          <button
            onClick={() => {
              if (confirm(`Excluir a coluna "${coluna.titulo}"? Os cards voltam para Demandas.`)) {
                startExcluir(() => excluirColunaDemanda(coluna.id).then(() => {}));
              }
            }}
            disabled={excluindo}
            title="Excluir coluna"
            className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {cards.map((c) => (
          <DemandaCardView key={c.id} card={c} onEditar={() => onEditar(c)} />
        ))}
      </div>

      <div className="mt-2">
        {adicionando ? (
          <FormAdicionarTarefa coluna={coluna.id} onFechar={() => setAdicionando(false)} />
        ) : (
          <button
            onClick={() => setAdicionando(true)}
            className="flex w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 py-2 text-xs font-medium text-slate-400 hover:border-agro-400 hover:text-agro-700"
          >
            <Plus size={14} /> Adicionar card
          </button>
        )}
      </div>
    </div>
  );
}

function DemandaCardView({
  card, arrastando, onEditar,
}: {
  card: DemandaCard;
  arrastando?: boolean;
  onEditar?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `tar:${card.id}` });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const itens = lerChecklist(card.checklist);
  const feitos = itens.filter((i) => i.d).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md",
        (isDragging || arrastando) && "opacity-70 shadow-xl ring-2 ring-agro-400"
      )}
    >
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <span className="text-sm font-semibold leading-tight text-slate-800">{card.titulo}</span>
        {card.descricao && (
          <p className="mt-1 line-clamp-3 text-xs text-slate-500">{card.descricao}</p>
        )}
        {itens.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400">
            <CheckSquare size={12} className={feitos === itens.length ? "text-green-500" : ""} />
            {feitos}/{itens.length}
          </div>
        )}
      </div>
      {!arrastando && onEditar && (
        <button
          onClick={onEditar}
          className="mt-2.5 flex w-full items-center justify-center gap-1 border-t border-slate-100 pt-2 text-xs font-medium text-slate-500 hover:text-agro-700"
        >
          <Pencil size={12} /> Abrir
        </button>
      )}
    </div>
  );
}

function FormAdicionarTarefa({ coluna, onFechar }: { coluna: string; onFechar: () => void }) {
  const [checklist, setChecklist] = useState<ItemChecklist[]>([]);
  return (
    <form
      action={async (fd) => {
        await criarTarefa(fd);
        onFechar();
      }}
      className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
    >
      <input type="hidden" name="coluna" value={coluna} />
      <input type="hidden" name="checklist" value={JSON.stringify(checklist.filter((i) => i.t.trim()))} />
      <input
        name="titulo"
        required
        autoFocus
        placeholder="Título do card"
        className="mb-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-agro-500"
      />
      <textarea
        name="descricao"
        rows={2}
        placeholder="Descrição (opcional)"
        className="mb-1.5 w-full resize-none rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-agro-500"
      />
      <ChecklistEditor itens={checklist} onChange={setChecklist} />
      <div className="mt-1.5 flex items-center gap-2">
        <button className="flex-1 rounded-lg bg-black py-1.5 text-xs font-bold text-agro-400 hover:bg-brand-800">
          Criar card
        </button>
        <button type="button" onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
          <X size={14} />
        </button>
      </div>
    </form>
  );
}

// Editor de checklist reutilizável (mantém estado e serializa via hidden input no form pai).
function ChecklistEditor({
  itens, onChange,
}: {
  itens: ItemChecklist[];
  onChange: (itens: ItemChecklist[]) => void;
}) {
  const [novo, setNovo] = useState("");
  function adicionar() {
    const t = novo.trim();
    if (!t) return;
    onChange([...itens, { t, d: false }]);
    setNovo("");
  }
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
        <ListChecks size={12} /> Checklist
      </div>
      {itens.map((it, i) => (
        <div key={i} className="mb-1 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(itens.map((x, j) => (j === i ? { ...x, d: !x.d } : x)))}
            className="shrink-0 text-slate-400 hover:text-agro-600"
          >
            {it.d ? <CheckSquare size={14} className="text-green-500" /> : <Square size={14} />}
          </button>
          <span className={cn("flex-1 text-xs", it.d && "text-slate-400 line-through")}>{it.t}</span>
          <button
            type="button"
            onClick={() => onChange(itens.filter((_, j) => j !== i))}
            className="shrink-0 text-slate-300 hover:text-red-500"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <div className="mt-1 flex gap-1">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); adicionar(); }
          }}
          placeholder="+ item"
          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-agro-500"
        />
        <button type="button" onClick={adicionar} className="rounded bg-slate-200 px-2 text-xs font-bold text-slate-600 hover:bg-slate-300">
          +
        </button>
      </div>
    </div>
  );
}

// Botão/forma para criar uma nova coluna de demanda.
function NovaColuna() {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="w-60 shrink-0">
      {aberto ? (
        <form
          action={async (fd) => {
            await criarColunaDemanda(String(fd.get("titulo") ?? ""));
            setAberto(false);
          }}
          className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3"
        >
          <input
            name="titulo"
            required
            autoFocus
            placeholder="Nome da coluna"
            className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-agro-500"
          />
          <div className="flex gap-2">
            <button className="flex-1 rounded-lg bg-black py-1.5 text-xs font-bold text-agro-400 hover:bg-brand-800">
              Criar coluna
            </button>
            <button type="button" onClick={() => setAberto(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200">
              <X size={14} />
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAberto(true)}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 text-xs font-semibold text-slate-400 hover:border-agro-400 hover:text-agro-700"
        >
          <Plus size={15} /> Nova coluna
        </button>
      )}
    </div>
  );
}

// ── Modal de edição de tarefa (card Trello) ─────────────────────────────────
function ModalEditarTarefa({ tarefa, onClose }: { tarefa: DemandaCard; onClose: () => void }) {
  const [checklist, setChecklist] = useState<ItemChecklist[]>(lerChecklist(tarefa.checklist));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Editar card</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form
          action={async (fd) => {
            await editarTarefa(tarefa.id, fd);
            onClose();
          }}
          className="space-y-3"
        >
          <input type="hidden" name="checklist" value={JSON.stringify(checklist.filter((i) => i.t.trim()))} />
          <Campo label="Título">
            <input name="titulo" required defaultValue={tarefa.titulo} className={inputCls} />
          </Campo>
          <Campo label="Descrição">
            <textarea name="descricao" rows={3} defaultValue={tarefa.descricao ?? ""} className={cn(inputCls, "resize-none")} />
          </Campo>
          <ChecklistEditor itens={checklist} onChange={setChecklist} />
          <button className="w-full rounded-lg bg-black py-2.5 font-bold text-agro-400 hover:bg-brand-800">
            Salvar alterações
          </button>
        </form>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <form
            action={async () => {
              await excluirTarefa(tarefa.id);
              onClose();
            }}
          >
            <button
              onClick={(e) => {
                if (!confirm("Excluir este card?")) e.preventDefault();
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={13} /> Excluir card
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Coluna do funil de negociação (inalterada) ──────────────────────────────
function Coluna({
  id, titulo, cor, cards, clientes, permiteAdicionar, onEditar,
}: {
  id: string;
  titulo: string;
  cor: string;
  cards: CardData[];
  clientes: Cliente[];
  permiteAdicionar: boolean;
  onEditar: (c: CardData) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [adicionando, setAdicionando] = useState(false);
  const total = cards.reduce((s, c) => s + (c.valor ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border-t-4 bg-slate-50 p-3 transition-all",
        cor,
        isOver && "bg-agro-50 ring-2 ring-agro-400"
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">{titulo}</span>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-500 shadow-sm">
          {cards.length}
        </span>
      </div>
      <div className="mb-3 text-xs font-medium text-slate-400">{formatCurrency(total)}</div>

      <div className="flex flex-col gap-2">
        {cards.map((c) => (
          <CardView key={c.id} card={c} onEditar={() => onEditar(c)} />
        ))}
      </div>

      {permiteAdicionar && (
        <div className="mt-2">
          {adicionando ? (
            <FormAdicionar estagio={id} clientes={clientes} onFechar={() => setAdicionando(false)} />
          ) : (
            <button
              onClick={() => setAdicionando(true)}
              className="flex w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 py-2 text-xs font-medium text-slate-400 hover:border-agro-400 hover:text-agro-700"
            >
              <Plus size={14} /> Adicionar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

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
      className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
    >
      <input type="hidden" name="estagio" value={estagio} />
      <select
        name="clienteId"
        className="mb-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-agro-500"
      >
        <option value="">— Cliente existente —</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>
      <input
        name="nomeNovo"
        placeholder="ou novo cliente (nome)"
        className="mb-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-agro-500"
      />
      <input
        name="maquinaModelo"
        placeholder="Máquina (ex: E215C)"
        className="mb-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-agro-500"
      />
      <input
        name="valor"
        placeholder="Valor (R$)"
        inputMode="numeric"
        className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-agro-500"
      />
      <div className="flex items-center gap-2">
        <button className="flex-1 rounded-lg bg-black py-1.5 text-xs font-bold text-agro-400 hover:bg-brand-800">
          Criar card
        </button>
        <button type="button" onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
          <X size={14} />
        </button>
      </div>
    </form>
  );
}

function CardView({
  card, arrastando, onEditar,
}: {
  card: CardData;
  arrastando?: boolean;
  onEditar?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md",
        (isDragging || arrastando) && "opacity-70 shadow-xl ring-2 ring-agro-400"
      )}
    >
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-bold leading-tight text-slate-800">{card.cliente}</span>
          {card.maquina && (
            <span className="shrink-0 rounded-lg bg-agro-100 px-2 py-0.5 text-xs font-semibold text-agro-700">
              {card.maquina}
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-slate-400">{card.municipio ?? "Sem município"}</div>
        <div className="mt-1.5 text-base font-bold text-emerald-600">{formatCurrency(card.valor)}</div>
        {card.dataVisita && (
          <div className="mt-1 flex items-center gap-1 text-xs text-brand-600">
            <Calendar size={12} /> {formatDateTime(card.dataVisita)}
          </div>
        )}
        {card.concorrente && (
          <div className="mt-1 rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
            ⚔ vs {card.concorrente}
          </div>
        )}
        <div className="mt-2"><Termometro valor={card.termometro} /></div>
      </div>
      {!arrastando && onEditar && (
        <button
          onClick={onEditar}
          className="mt-2.5 flex w-full items-center justify-center gap-1 border-t border-slate-100 pt-2 text-xs font-medium text-slate-500 hover:text-agro-700"
        >
          <Pencil size={12} /> Editar
        </button>
      )}
    </div>
  );
}

function ModalEditar({ card, onClose }: { card: CardData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">{card.cliente}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form
          action={async (fd) => {
            await editarNegociacao(card.id, fd);
            onClose();
          }}
          className="space-y-3"
        >
          <Campo label="Máquina">
            <input name="maquinaModelo" defaultValue={card.maquina ?? ""} className={inputCls} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor (R$)">
              <input name="valor" inputMode="numeric" defaultValue={card.valor ?? ""} className={inputCls} />
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
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Coluna">
              <select name="estagio" defaultValue={card.estagio} className={inputCls}>
                {ESTAGIOS.map((e) => (
                  <option key={e.id} value={e.id}>{e.titulo}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Data da visita">
              <input
                type="datetime-local"
                name="dataVisita"
                defaultValue={paraInputLocal(card.dataVisita)}
                className={inputCls}
              />
            </Campo>
          </div>
          <Campo label="Próxima ação">
            <input name="proximaAcao" defaultValue={card.proximaAcao ?? ""} className={inputCls} />
          </Campo>

          <button className="w-full rounded-lg bg-black py-2.5 font-bold text-agro-400 hover:bg-brand-800">
            Salvar alterações
          </button>
        </form>

        {/* Ações de fechamento */}
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <form action={marcarGanha.bind(null, card.id)} onSubmit={() => onClose()} className="flex-1">
            <button className="flex w-full items-center justify-center gap-1 rounded-lg bg-green-50 py-2 text-sm font-semibold text-green-700 hover:bg-green-100">
              <Trophy size={14} /> Marcar vendido
            </button>
          </form>
          <form
            action={async (fd) => {
              await marcarPerdida(card.id, String(fd.get("motivo") || "Não informado"));
              onClose();
            }}
            className="flex flex-1 items-center gap-1"
          >
            <input name="motivo" placeholder="motivo" className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-red-400" />
            <button className="shrink-0 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100">
              Perdida
            </button>
          </form>
        </div>

        {/* Excluir definitivamente */}
        <div className="mt-3 border-t border-slate-100 pt-3">
          <form
            action={async () => {
              await excluirNegociacao(card.id);
              onClose();
            }}
          >
            <button
              onClick={(e) => {
                if (!confirm(`Excluir o card de ${card.cliente}? Esta ação não pode ser desfeita.`)) {
                  e.preventDefault();
                }
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={13} /> Excluir card
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-200";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
