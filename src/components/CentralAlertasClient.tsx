"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, EmptyState } from "@/components/ui";
import { resolverAlerta } from "@/lib/actions";
import type { GrupoCentral, ItemCentral, SeveridadeAlerta } from "@/lib/central-alertas";
import { cn } from "@/lib/utils";
import { Bell, CheckCircle2, ArrowRight, Loader2, MessageSquareQuote, Clock, Compass, HeartHandshake, MapPin, ListTodo, ShieldCheck } from "lucide-react";

const ICONE_GRUPO: Record<string, typeof Bell> = {
  rascunhos: MessageSquareQuote,
  aguardando: Clock,
  comerciais: Compass,
  posvenda: HeartHandshake,
  visitas: MapPin,
  demandas: ListTodo,
  sistema: ShieldCheck,
};

const COR_SEV: Record<SeveridadeAlerta, string> = {
  alta: "border-l-red-500",
  media: "border-l-amber-400",
  baixa: "border-l-slate-300",
};

const ROTULO_SEV: Record<SeveridadeAlerta, { texto: string; classe: string }> = {
  alta: { texto: "urgente", classe: "bg-red-100 text-red-700" },
  media: { texto: "hoje", classe: "bg-amber-100 text-amber-700" },
  baixa: { texto: "quando puder", classe: "bg-slate-100 text-slate-500" },
};

export function CentralAlertasClient({ grupos }: { grupos: GrupoCentral[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<string | "todos">("todos");
  const [resolvidos, setResolvidos] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visiveis = grupos
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !resolvidos.has(i.id)) }))
    .filter((g) => g.itens.length > 0 && (filtro === "todos" || g.id === filtro));
  const totalVisivel = grupos.reduce((s, g) => s + g.itens.filter((i) => !resolvidos.has(i.id)).length, 0);

  async function resolver(item: ItemCentral) {
    if (!item.alertaId) return;
    setOcupado(item.id);
    await resolverAlerta(item.alertaId);
    setOcupado(null);
    setResolvidos((s) => new Set(s).add(item.id));
    startTransition(() => router.refresh());
  }

  if (totalVisivel === 0) {
    return <EmptyState icone={<Bell size={28} />} texto="Nenhum alerta pendente" subtexto="Rascunhos da IA, clientes aguardando resposta, alertas do ZEUS, pós-venda, visitas e demandas aparecem aqui assim que precisarem de você." />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setFiltro("todos")} className={cn("rounded-full px-3 py-1.5 text-xs font-bold", filtro === "todos" ? "bg-slate-900 text-agro-400" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
          Todos · {totalVisivel}
        </button>
        {grupos.map((g) => {
          const n = g.itens.filter((i) => !resolvidos.has(i.id)).length;
          if (!n) return null;
          const Icon = ICONE_GRUPO[g.id] ?? Bell;
          return (
            <button key={g.id} onClick={() => setFiltro(g.id)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", filtro === g.id ? "bg-slate-900 text-agro-400" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
              <Icon size={13} /> {g.titulo} · {n}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {visiveis.map((g) => {
          const Icon = ICONE_GRUPO[g.id] ?? Bell;
          return (
            <section key={g.id}>
              <div className="mb-2 flex items-center gap-2">
                <Icon size={16} className="text-brand-600" />
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">{g.titulo}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{g.itens.length}</span>
              </div>
              <p className="mb-2 text-xs text-slate-500">{g.descricao}</p>
              <Card className="divide-y divide-slate-100 p-0">
                {g.itens.map((item) => (
                  <div key={item.id} className={cn("flex flex-wrap items-start gap-3 border-l-4 px-4 py-3", COR_SEV[item.severidade])}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800">{item.titulo}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", ROTULO_SEV[item.severidade].classe)}>{ROTULO_SEV[item.severidade].texto}</span>
                      </div>
                      {item.detalhe && <p className="mt-0.5 text-sm text-slate-600">{item.detalhe}</p>}
                      {item.quando && <p className="mt-0.5 text-[11px] text-slate-400">{item.quando}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link href={item.href} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-agro-400 hover:bg-slate-800">
                        {item.hrefLabel} <ArrowRight size={13} />
                      </Link>
                      {item.alertaId && (
                        <button onClick={() => resolver(item)} disabled={ocupado === item.id} title="Marcar como resolvido" className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100 disabled:opacity-60">
                          {ocupado === item.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Resolvido
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          );
        })}
      </div>
    </div>
  );
}
