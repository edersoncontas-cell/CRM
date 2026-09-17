"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { MapPin, Clock, Users, GripVertical } from "lucide-react";
import { NovaVisitaForm } from "@/components/NovaVisitaForm";
import { BotaoRemoverVisita } from "@/components/BotaoRemoverVisita";
import { ConfirmacaoVisita } from "@/components/ConfirmacaoVisita";
import { moverVisitaParaDiaAction } from "@/lib/actions";

export type VisitaAgenda = {
  id: string;
  clienteId: string;
  clienteNome: string;
  hora: string;
  dataIso: string;
  cidade: string | null;
  observacao: string | null;
  status: string;
};
export type DiaAgenda = { iso: string; nome: string; label: string; ehHoje: boolean; visitas: VisitaAgenda[] };

const REUNIAO_SEGUNDA = { nome: "REUNIÃO PME VITÓRIA", hora: "08:00", cidade: "Vitória" };

// Agenda da semana com arrastar entre os dias: pegar o card e soltar em outra
// coluna muda a data da visita, mantendo o horário. Só visita ainda agendada
// se move — realizada e não realizada são histórico.
export function AgendaSemanaVisitas({
  dias, clientes, cidades,
}: {
  dias: DiaAgenda[];
  clientes: { id: string; nome: string }[];
  cidades: string[];
}) {
  const router = useRouter();
  const [local, setLocal] = useState<DiaAgenda[]>(dias);
  const [arrastando, setArrastando] = useState<VisitaAgenda | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // A lista do servidor manda quando muda (revalidate); enquanto isso o
  // estado local segura o card no dia novo, sem piscar.
  const [ultimoServidor, setUltimoServidor] = useState(dias);
  if (dias !== ultimoServidor) {
    setUltimoServidor(dias);
    setLocal(dias);
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } })
  );

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    for (const d of local) {
      const v = d.visitas.find((x) => x.id === id);
      if (v) { setArrastando(v); return; }
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    const visita = arrastando;
    setArrastando(null);
    const destino = e.over ? String(e.over.id) : null;
    if (!visita || !destino || destino === visita.dataIso) return;

    setErro(null);
    const antes = local;
    setLocal((atual) => atual.map((d) => {
      if (d.iso === visita.dataIso) return { ...d, visitas: d.visitas.filter((v) => v.id !== visita.id) };
      if (d.iso === destino) return { ...d, visitas: [...d.visitas, { ...visita, dataIso: destino }].sort((a, b) => a.hora.localeCompare(b.hora)) };
      return d;
    }));

    const r = await moverVisitaParaDiaAction(visita.id, destino).catch(() => ({ ok: false, erro: "Falha de conexão." }));
    if (!r.ok) {
      setLocal(antes);
      setErro(r.erro ?? "Não consegui mover a visita.");
      return;
    }
    router.refresh();
  }

  return (
    <DndContext id="dnd-agenda-visitas" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {erro && <p className="mb-2 text-xs font-semibold text-red-600">{erro}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {local.map((dia, i) => (
          <ColunaDia key={dia.iso} dia={dia} primeiro={i === 0} clientes={clientes} cidades={cidades} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.4, 1)" }}>
        {arrastando && (
          <div className="w-56 rotate-2 rounded-xl border border-brand-300 bg-white p-2 shadow-xl">
            <div className="truncate text-xs font-semibold text-slate-800">{arrastando.clienteNome}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400"><Clock size={10} /> {arrastando.hora}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function ColunaDia({ dia, primeiro, clientes, cidades }: { dia: DiaAgenda; primeiro: boolean; clientes: { id: string; nome: string }[]; cidades: string[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: dia.iso });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border p-3 transition ${
        isOver ? "border-brand-400 bg-brand-50 ring-2 ring-brand-300"
        : dia.ehHoje ? "border-brand-300 bg-brand-50/50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-slate-800">{dia.nome}</div>
          <div className="text-xs text-slate-400">{dia.label}{dia.ehHoje && " · hoje"}</div>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{dia.visitas.length}</span>
      </div>
      <div className="flex-1 space-y-2">
        {primeiro && (
          <div className="rounded-xl bg-agro-400/20 p-2 ring-1 ring-agro-400/60">
            <div className="flex items-center gap-1 text-xs font-black uppercase tracking-wide text-slate-900"><Users size={12} /> {REUNIAO_SEGUNDA.nome}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-600"><Clock size={10} /> {REUNIAO_SEGUNDA.hora} · <MapPin size={10} className="inline" /> {REUNIAO_SEGUNDA.cidade}</div>
          </div>
        )}
        {dia.visitas.length === 0 && !primeiro
          ? <p className="py-3 text-center text-xs text-slate-400">{isOver ? "Solte aqui" : "Nada agendado"}</p>
          : dia.visitas.map((v) => <CardVisita key={v.id} v={v} />)}
      </div>
      <div className="mt-2">
        <NovaVisitaForm clientes={clientes} cidades={cidades} dataFixa={dia.iso} rotuloDataFixa={`${dia.nome}, ${dia.label}`} compacto />
      </div>
    </div>
  );
}

function CardVisita({ v }: { v: VisitaAgenda }) {
  const podeMover = v.status === "agendada";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: v.id, disabled: !podeMover });
  return (
    // O card INTEIRO arrasta (a alcinha sozinha era pequena demais para
    // acertar). Os cliques continuam passando: o dnd-kit só assume quando o
    // ponteiro anda 8px, então tocar no nome, no ✓/✗ ou na lixeira funciona
    // como antes.
    <div
      ref={podeMover ? setNodeRef : undefined}
      {...(podeMover ? attributes : {})}
      {...(podeMover ? listeners : {})}
      title={podeMover ? "Arraste para outro dia" : undefined}
      className={`group rounded-xl border p-2 ${podeMover ? "cursor-grab touch-none active:cursor-grabbing" : ""} ${isDragging ? "opacity-30" : ""} ${
        v.status === "realizada" ? "border-emerald-100 bg-emerald-50"
        : v.status === "nao_realizada" ? "border-red-100 bg-red-50"
        : "border-slate-100 bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 items-start gap-1">
          {podeMover && <GripVertical size={13} className="mt-0.5 shrink-0 text-slate-400" />}
          <SemArrastar className="min-w-0">
            <Link href={`/clientes/${v.clienteId}`} className="block min-w-0 truncate text-xs font-semibold text-slate-800 hover:text-brand-600">
              {v.clienteNome}
            </Link>
          </SemArrastar>
        </div>
        <SemArrastar>
          <BotaoRemoverVisita id={v.id} clienteId={v.clienteId} />
        </SemArrastar>
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
        <Clock size={10} /> {v.hora}
        {v.cidade && <> · <MapPin size={10} className="inline" /> {v.cidade}</>}
      </div>
      {v.observacao && <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{v.observacao}</p>}
      <SemArrastar className="mt-1.5 block">
        <ConfirmacaoVisita id={v.id} status={v.status} dataIso={v.dataIso} hora={v.hora} clienteNome={v.clienteNome} tamanho="compacto" />
      </SemArrastar>
    </div>
  );
}

// O card inteiro é a área de arrasto, então o sensor do dnd-kit precisa ficar
// cego para o que é clicável dentro dele: sem isto, o arrasto engolia o
// clique e o nome do cliente parava de abrir o cadastro.
function SemArrastar({ children, className }: { children: React.ReactNode; className?: string }) {
  const parar = (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation();
  return (
    <span className={className} onMouseDown={parar} onTouchStart={parar}>
      {children}
    </span>
  );
}
