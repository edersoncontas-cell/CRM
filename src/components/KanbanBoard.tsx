"use client";

import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { moverNegociacao, marcarPerdida, marcarGanha } from "@/lib/actions";
import { formatCurrency, cn } from "@/lib/utils";
import { Termometro } from "@/components/ui";

interface CardData {
  id: string;
  estagio: string;
  cliente: string;
  municipio: string | null;
  maquina: string | null;
  valor: number | null;
  termometro: number;
  concorrente: string | null;
}

const COLUNAS = [
  { id: "novo", titulo: "Novo lead", cor: "border-t-slate-400" },
  { id: "contato", titulo: "Em contato", cor: "border-t-blue-400" },
  { id: "proposta", titulo: "Proposta enviada", cor: "border-t-amber-400" },
  { id: "negociacao", titulo: "Negociação", cor: "border-t-orange-400" },
  { id: "fechamento", titulo: "Fechamento", cor: "border-t-green-400" },
];

export function KanbanBoard({ cards: cardsIniciais }: { cards: CardData[] }) {
  const [cards, setCards] = useState(cardsIniciais);
  const [ativo, setAtivo] = useState<CardData | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragStart(e: DragStartEvent) {
    setAtivo(cards.find((c) => c.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setAtivo(null);
    const { active, over } = e;
    if (!over) return;
    const novoEstagio = String(over.id);
    const card = cards.find((c) => c.id === active.id);
    if (!card || card.estagio === novoEstagio) return;
    // otimista
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, estagio: novoEstagio } : c)));
    moverNegociacao(card.id, novoEstagio);
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUNAS.map((col) => (
          <Coluna
            key={col.id}
            id={col.id}
            titulo={col.titulo}
            cor={col.cor}
            cards={cards.filter((c) => c.estagio === col.id)}
          />
        ))}
      </div>
      <DragOverlay>{ativo && <CardView card={ativo} arrastando />}</DragOverlay>
    </DndContext>
  );
}

function Coluna({ id, titulo, cor, cards }: { id: string; titulo: string; cor: string; cards: CardData[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const total = cards.reduce((s, c) => s + (c.valor ?? 0), 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border-t-4 bg-slate-50 p-3 transition-all",
        cor,
        isOver && "ring-2 ring-brand-400 bg-brand-50"
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
        {cards.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center">
            <p className="text-xs text-slate-400">Arraste um card aqui</p>
          </div>
        ) : (
          cards.map((c) => <CardView key={c.id} card={c} />)
        )}
      </div>
    </div>
  );
}

function CardView({ card, arrastando }: { card: CardData; arrastando?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md",
        (isDragging || arrastando) && "opacity-70 shadow-xl ring-2 ring-brand-300"
      )}
    >
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-bold leading-tight text-slate-800">{card.cliente}</span>
          {card.maquina && (
            <span className="shrink-0 rounded-lg bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              {card.maquina}
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-slate-400">{card.municipio ?? "Sem município"}</div>
        <div className="mt-1.5 text-base font-bold text-emerald-600">{formatCurrency(card.valor)}</div>
        {card.concorrente && (
          <div className="mt-1 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            ⚔ vs {card.concorrente}
          </div>
        )}
        <div className="mt-2"><Termometro valor={card.termometro} /></div>
      </div>
      {!arrastando && (
        <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2">
          <form action={marcarGanha.bind(null, card.id)}>
            <button className="rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100">
              ✓ Ganhou
            </button>
          </form>
          <PerderBtn id={card.id} />
        </div>
      )}
    </div>
  );
}

function PerderBtn({ id }: { id: string }) {
  return (
    <form
      action={async (fd) => {
        await marcarPerdida(id, String(fd.get("motivo") || "Não informado"));
      }}
      className="flex items-center gap-1"
    >
      <input
        name="motivo"
        placeholder="motivo da perda"
        className="w-28 rounded border border-slate-200 px-1 py-0.5 text-xs outline-none focus:border-red-400"
      />
      <button className="text-xs font-medium text-red-500 hover:underline">Perdeu</button>
    </form>
  );
}
