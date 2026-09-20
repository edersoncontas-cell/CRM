"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { EventoLinhaTempo, TipoEvento } from "@/lib/linha-tempo";
import { MessageCircle, MapPin, Handshake, HeartHandshake, Repeat, Bot, Cog, History, ChevronDown } from "lucide-react";

const FILTROS: { id: TipoEvento | "todos"; label: string }[] = [
  { id: "todos", label: "Tudo" },
  { id: "mensagem", label: "Mensagens" },
  { id: "visita", label: "Visitas" },
  { id: "negociacao", label: "Negociações" },
  { id: "posvenda", label: "Pós-venda" },
  { id: "ia", label: "IA e ZEUS" },
];

const ICONE: Record<TipoEvento, { Icone: typeof MessageCircle; cor: string }> = {
  mensagem: { Icone: MessageCircle, cor: "bg-emerald-100 text-emerald-700" },
  visita: { Icone: MapPin, cor: "bg-sky-100 text-sky-700" },
  negociacao: { Icone: Handshake, cor: "bg-violet-100 text-violet-700" },
  posvenda: { Icone: HeartHandshake, cor: "bg-rose-100 text-rose-700" },
  ia: { Icone: Bot, cor: "bg-fuchsia-100 text-fuchsia-700" },
  sistema: { Icone: Cog, cor: "bg-slate-100 text-slate-600" },
};

function quando(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoAno = d.getFullYear() === hoje.getFullYear();
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", ...(mesmoAno ? {} : { year: "numeric" }), hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function diaChave(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
}

export function LinhaTempoCliente({ eventos }: { eventos: EventoLinhaTempo[] }) {
  const [filtro, setFiltro] = useState<TipoEvento | "todos">("todos");
  const [limite, setLimite] = useState(25);

  const filtrados = useMemo(
    () => eventos.filter((e) => filtro === "todos" || e.tipo === filtro || (filtro === "ia" && e.tipo === "sistema")),
    [eventos, filtro]
  );
  const visiveis = filtrados.slice(0, limite);

  // Agrupa por dia para leitura rápida.
  const grupos: { dia: string; itens: EventoLinhaTempo[] }[] = [];
  for (const e of visiveis) {
    const dia = diaChave(e.quando);
    const g = grupos[grupos.length - 1];
    if (g && g.dia === dia) g.itens.push(e);
    else grupos.push({ dia, itens: [e] });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-slate-900 p-2 text-agro-400"><History size={18} /></div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Linha do tempo</h2>
            <p className="text-xs text-slate-500">{eventos.length} evento(s): mensagens, visitas, negociações, pós-venda e ações da IA.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setFiltro(f.id); setLimite(25); }}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${filtro === f.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nada registrado ainda nesta categoria.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {grupos.map((g) => (
            <div key={g.dia}>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{g.dia}</div>
              <ol className="relative ml-3 border-l border-slate-200 pl-5">
                {g.itens.map((e) => {
                  const { Icone, cor } = ICONE[e.tipo];
                  const ehMsg = e.tipo === "mensagem";
                  return (
                    <li key={e.id} className="relative mb-3 last:mb-0">
                      <span className={`absolute -left-[31px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full ${cor}`}>
                        <Icone size={13} />
                      </span>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold text-slate-800">{e.titulo}</span>
                        <span className="text-[11px] text-slate-400">{quando(e.quando)}</span>
                        {e.href && (
                          <Link href={e.href} className="text-[11px] font-medium text-brand-600 hover:underline">abrir</Link>
                        )}
                      </div>
                      {e.detalhe && (
                        <p className={`mt-0.5 text-sm ${ehMsg ? (e.direcao === "in" ? "rounded-xl rounded-tl-sm bg-slate-100 px-3 py-1.5 text-slate-700" : "rounded-xl rounded-tl-sm bg-emerald-50 px-3 py-1.5 text-emerald-900") : "text-slate-600"}`}>
                          {e.detalhe}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          {filtrados.length > visiveis.length && (
            <button type="button" onClick={() => setLimite((l) => l + 25)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <ChevronDown size={14} /> Mostrar mais ({filtrados.length - visiveis.length} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
