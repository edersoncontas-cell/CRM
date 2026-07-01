import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import * as googleCalendar from "@/lib/integrations/googleCalendar";
import { Calendar, MapPin, CheckSquare, ClipboardList } from "lucide-react";
import Link from "next/link";
import { AgendaAutoRefresh } from "@/components/AgendaAutoRefresh";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  // 1. Visitas via negociação (campo dataVisita)
  const visitasNegs = await db.negociacao.findMany({
    where: { dataVisita: { not: null }, status: { not: "perdida" } },
    include: { cliente: { include: { municipio: true } } },
    orderBy: { dataVisita: "asc" },
  });

  // 2. Visitas via resumo do cliente (campo proximaVisita)
  type ClienteVisita = {
    id: string;
    nome: string;
    proximaVisita: Date;
    proximaVisitaNota: string | null;
    municipio: { nome: string } | null;
  };
  const clientesComVisita = await db.$queryRawUnsafe<ClienteVisita[]>(`
    SELECT c.id, c.nome, c."proximaVisita", c."proximaVisitaNota", m.nome as municipio_nome
    FROM "Cliente" c
    LEFT JOIN "Municipio" m ON m.id = c."municipioId"
    WHERE c."proximaVisita" IS NOT NULL
    ORDER BY c."proximaVisita" ASC
  `).catch(() => [] as ClienteVisita[]);

  // 3. Demandas com dueDate agendada (TarefaKanban)
  const demandasAgendadas = await db.tarefaKanban.findMany({
    where: { dueDate: { not: null } },
    orderBy: { dueDate: "asc" },
  }).catch(() => []);

  const agora = new Date();

  // Tipo unificado de evento
  type EventoAgenda = {
    id: string;
    clienteId: string | null;
    clienteNome: string;
    municipio: string | null;
    maquina: string | null;
    data: Date;
    nota: string | null;
    origem: "negociacao" | "resumo" | "demanda";
    demandaTitulo?: string;
    demandaDescricao?: string | null;
  };

  const todos: EventoAgenda[] = [
    // Visitas de negociação
    ...visitasNegs.map((v) => ({
      id: v.id,
      clienteId: v.clienteId,
      clienteNome: v.cliente.nome,
      municipio: v.cliente.municipio?.nome ?? null,
      maquina: v.maquinaModelo ?? null,
      data: v.dataVisita!,
      nota: null,
      origem: "negociacao" as const,
    })),
    // Visitas de resumo do cliente
    ...clientesComVisita.map((c) => ({
      id: `cv-${c.id}`,
      clienteId: c.id,
      clienteNome: c.nome,
      municipio: (c as unknown as { municipio_nome?: string }).municipio_nome ?? null,
      maquina: null,
      data: new Date(c.proximaVisita),
      nota: c.proximaVisitaNota,
      origem: "resumo" as const,
    })),
    // Demandas agendadas
    ...demandasAgendadas.map((d) => ({
      id: `dem-${d.id}`,
      clienteId: null,
      clienteNome: d.titulo,
      municipio: d.cidade ?? null,
      maquina: null,
      data: d.dueDate!,
      nota: d.descricao ?? null,
      origem: "demanda" as const,
      demandaTitulo: d.titulo,
      demandaDescricao: d.descricao,
    })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime());

  // Remove duplicatas (mesmo cliente na mesma data)
  const eventos: EventoAgenda[] = [];
  const vistos = new Set<string>();
  for (const v of todos) {
    const chave = v.origem === "demanda"
      ? v.id  // demandas nunca são duplicadas
      : `${v.clienteId}-${v.data.toISOString().slice(0, 10)}`;
    if (!vistos.has(chave)) { vistos.add(chave); eventos.push(v); }
  }

  const futuros = eventos.filter((v) => v.data >= agora);
  const passados = eventos.filter((v) => v.data < agora);

  // Agrupa futuros por data (dd/mm/aaaa)
  const porDia = futuros.reduce<Record<string, EventoAgenda[]>>((acc, ev) => {
    const dia = ev.data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
    acc[dia] = acc[dia] ?? [];
    acc[dia].push(ev);
    return acc;
  }, {});

  return (
    <div>
      <AgendaAutoRefresh />
      <PageHeader
        titulo="Agenda de visitas"
        subtitulo="Visitas detectadas pela IA + demandas agendadas"
        acao={
          <Badge tom={googleCalendar.isEnabled() ? "green" : "yellow"}>
            {googleCalendar.isEnabled() ? "Google Agenda conectada" : "Google Agenda não conectada"}
          </Badge>
        }
      />

      {/* Próximas visitas / demandas — agrupadas por dia */}
      <h2 className="mb-3 font-semibold text-slate-700">Próximos eventos</h2>
      <div className="mb-8 space-y-6">
        {futuros.length === 0 && (
          <Card>
            <p className="text-sm text-slate-400">Nenhum evento agendado. Analise conversas para a IA detectar datas ou adicione demandas com data.</p>
          </Card>
        )}
        {Object.entries(porDia).map(([dia, evs]) => (
          <div key={dia}>
            {/* Cabeçalho do dia */}
            <div className="mb-2 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="rounded-full border border-slate-200 bg-white px-3 py-0.5 text-xs font-bold text-slate-600 shadow-sm">
                {dia}
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="space-y-2">
              {evs.map((ev) => (
                <EventoCard key={ev.id} ev={ev} futura />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Eventos passados */}
      {passados.length > 0 && (
        <>
          <h2 className="mb-3 font-semibold text-slate-700">Eventos anteriores</h2>
          <div className="space-y-2">
            {passados.map((ev) => (
              <EventoCard key={ev.id} ev={ev} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Card unificado de evento ────────────────────────────────────────────────
type EventoCardProps = {
  ev: {
    id: string;
    clienteId: string | null;
    clienteNome: string;
    municipio: string | null;
    maquina: string | null;
    data: Date;
    nota: string | null;
    origem: "negociacao" | "resumo" | "demanda";
    demandaTitulo?: string;
    demandaDescricao?: string | null;
  };
  futura?: boolean;
};

function EventoCard({ ev, futura }: EventoCardProps) {
  const isDemanda = ev.origem === "demanda";

  return (
    <Card className={cn(
      "transition-all",
      futura && !isDemanda && "border-brand-200",
      futura && isDemanda && "border-violet-300 bg-violet-50/40",
      !futura && "opacity-70"
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Ícone por tipo */}
          <div className={cn(
            "shrink-0 rounded-lg p-2",
            isDemanda ? "bg-violet-100 text-violet-600" : "bg-brand-100 text-brand-600"
          )}>
            {isDemanda ? <ClipboardList size={18} /> : <Calendar size={18} />}
          </div>

          <div className="min-w-0">
            {/* Nome / título */}
            {ev.clienteId ? (
              <Link
                href={`/clientes/${ev.clienteId}`}
                className="block truncate font-semibold text-slate-800 hover:text-brand-600"
              >
                {ev.clienteNome}
              </Link>
            ) : (
              <span className="block truncate font-semibold text-slate-800">
                {ev.clienteNome}
              </span>
            )}

            {/* Sub-info */}
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <MapPin size={11} className="shrink-0" />
              <span>{ev.municipio ?? "—"}</span>
              {ev.maquina && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="rounded-md bg-agro-100 px-1.5 py-0.5 text-[10px] font-bold text-agro-700">{ev.maquina}</span>
                </>
              )}
              {ev.nota && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="italic truncate max-w-[240px]">{ev.nota}</span>
                </>
              )}
              {isDemanda && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                  Demanda
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Hora */}
        <div className="shrink-0 text-right">
          <div className={cn(
            "text-sm font-bold",
            isDemanda ? "text-violet-700" : "text-slate-700"
          )}>
            {ev.data.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="text-[10px] text-slate-400">
            {ev.origem === "negociacao" ? "Visita" : ev.origem === "resumo" ? "Resumo IA" : "Demanda"}
          </div>
        </div>
      </div>
    </Card>
  );
}
