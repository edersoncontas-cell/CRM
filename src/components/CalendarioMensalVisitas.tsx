"use client";

// Calendário mensal das visitas: tudo que está marcado (esta semana ou daqui
// a meses) aparece no dia. Clique no dia para ver a lista. A reunião PME de
// Vitória fica fixa em toda segunda.

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NovoCompromissoCalendario } from "@/components/NovoCompromissoCalendario";

export type ItemCalendario = { id: string; clienteId: string | null; nome: string; hora: string; cidade: string | null; status: string; fixo?: boolean; evento?: boolean; trecho?: string | null };
export type DiaCalendario = { iso: string; dia: number; itens: ItemCalendario[] };

export function CalendarioMensalVisitas({ titulo, primeiroDiaSemana, dias, hojeIso, hrefAnterior, hrefProximo, clientes = [], cidades = [] }: {
  titulo: string; primeiroDiaSemana: number; dias: DiaCalendario[]; hojeIso: string; hrefAnterior: string; hrefProximo: string;
  clientes?: { id: string; nome: string }[]; cidades?: string[];
}) {
  const [sel, setSel] = useState<string>(dias.find((d) => d.iso === hojeIso)?.iso ?? dias.find((d) => d.itens.length > 0)?.iso ?? dias[0]?.iso ?? "");
  const celulas: (DiaCalendario | null)[] = [...Array(primeiroDiaSemana).fill(null), ...dias];
  while (celulas.length % 7) celulas.push(null);
  const diaSel = dias.find((d) => d.iso === sel);
  // Contagem é de VISITA: reunião fixa e evento não entram no número do mês.
  const total = dias.reduce((s, d) => s + d.itens.filter((i) => !i.fixo && !i.evento).length, 0);

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <Link href={hrefAnterior} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Mês anterior"><ChevronLeft size={18} /></Link>
          <div className="text-sm font-black capitalize text-slate-800">{titulo} <span className="ml-1 text-xs font-semibold text-slate-400">{total} visita{total === 1 ? "" : "s"}</span></div>
          <Link href={hrefProximo} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Próximo mês"><ChevronRight size={18} /></Link>
        </div>
        {/* O card lateral do dia saiu ("não entendi esse card, pode remover").
            O que ele tinha de útil — marcar compromisso no dia aberto — ficou:
            virou este botão, que abre o mesmo pop-up. Tirar o card não podia
            levar junto a única forma de agendar pelo calendário. */}
        {diaSel && clientes.length > 0 && (
          <div className="mb-2">
            <NovoCompromissoCalendario dia={diaSel.iso} clientes={clientes} cidadesEs={cidades} />
          </div>
        )}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="py-1 font-bold text-slate-400">{d}</div>)}
          {celulas.map((d, i) => {
            if (!d) return <div key={`v${i}`} />;
            const visitas = d.itens.filter((it) => !it.fixo && !it.evento);
            const temFixo = d.itens.some((it) => it.fixo);
            const ehHoje = d.iso === hojeIso;
            const ehSel = d.iso === sel;
            const realizadas = visitas.filter((v) => v.status === "realizada").length;
            const naoRealizadas = visitas.filter((v) => v.status === "nao_realizada").length;
            // Dia de evento (feira, convenção, viagem) fica azul claro — assim a
            // faixa de dias do evento salta aos olhos no mês inteiro.
            const temEvento = d.itens.some((i) => i.evento);
            return (
              <button key={d.iso} onClick={() => setSel(d.iso)}
                title={temEvento ? d.itens.filter((i) => i.evento).map((i) => i.nome).join(" · ") : undefined}
                className={cn("flex min-h-[52px] flex-col items-center justify-start rounded-lg border p-1 transition",
                  ehSel && temEvento ? "border-sky-600 bg-sky-400 text-slate-900"
                    : ehSel ? "border-slate-900 bg-slate-900 text-agro-400"
                    : temEvento ? cn("bg-sky-100 text-sky-900 hover:bg-sky-200", ehHoje ? "border-brand-400" : "border-sky-300")
                    : ehHoje ? "border-brand-400 bg-brand-50 text-slate-800"
                    : "border-slate-100 bg-white text-slate-700 hover:bg-slate-50")}>
                <span className={cn("text-xs font-bold", ehSel && !temEvento && "text-agro-400")}>{d.dia}</span>
                {visitas.length > 0 && (
                  <span className={cn("mt-0.5 rounded-full px-1.5 text-[10px] font-black", ehSel && !temEvento ? "bg-agro-400 text-black" : "bg-slate-900 text-agro-400")}>{visitas.length}</span>
                )}
                <span className="mt-0.5 flex gap-0.5">
                  {temFixo && <span title="Reunião PME Vitória" className="h-1.5 w-1.5 rounded-full bg-agro-400 ring-1 ring-slate-400" />}
                  {realizadas > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  {naoRealizadas > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                  {temEvento && <span className={cn("h-1.5 w-1.5 rounded-full", ehSel ? "bg-slate-900" : "bg-sky-500")} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-agro-400 ring-1 ring-slate-400" /> reunião PME (segundas)</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> realizada</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> não realizada</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm border border-sky-300 bg-sky-100" /> dias de evento</span>
        </div>
      </div>
    </div>
  );
}

function rotuloDia(iso: string): string {
  return new Date(`${iso}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit",
  });
}
