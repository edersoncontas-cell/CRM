import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { formatDateTime, formatDate } from "@/lib/utils";
import * as googleCalendar from "@/lib/integrations/googleCalendar";
import { Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { AgendaAutoRefresh } from "@/components/AgendaAutoRefresh";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  // Visitas via negociação (campo dataVisita)
  const visitasNegs = await db.negociacao.findMany({
    where: { dataVisita: { not: null }, status: { not: "perdida" } },
    include: { cliente: { include: { municipio: true } } },
    orderBy: { dataVisita: "asc" },
  });

  // Visitas via resumo do cliente (campo proximaVisita)
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

  const agora = new Date();

  // Unifica e separa em futuras/passadas
  type VisitaUnif = {
    id: string;
    clienteId: string;
    clienteNome: string;
    municipio: string | null;
    maquina: string | null;
    data: Date;
    nota: string | null;
    origem: "negociacao" | "resumo";
  };

  const todas: VisitaUnif[] = [
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
  ].sort((a, b) => a.data.getTime() - b.data.getTime());

  // Remove duplicatas (mesmo cliente na mesma data aproximada)
  const visitas: VisitaUnif[] = [];
  const vistas = new Set<string>();
  for (const v of todas) {
    const chave = `${v.clienteId}-${v.data.toISOString().slice(0, 10)}`;
    if (!vistas.has(chave)) { vistas.add(chave); visitas.push(v); }
  }

  const futuras = visitas.filter((v) => v.data >= agora);
  const passadas = visitas.filter((v) => v.data < agora);

  return (
    <div>
      <AgendaAutoRefresh />
      <PageHeader
        titulo="Agenda de visitas"
        subtitulo="Visitas detectadas pela IA nas conversas"
        acao={
          <Badge tom={googleCalendar.isEnabled() ? "green" : "yellow"}>
            {googleCalendar.isEnabled() ? "Google Agenda conectada" : "Google Agenda não conectada"}
          </Badge>
        }
      />

      <h2 className="mb-3 font-semibold text-slate-700">Próximas visitas</h2>
      <div className="mb-6 space-y-3">
        {futuras.length === 0 && (
          <Card><p className="text-sm text-slate-400">Nenhuma visita agendada. Analise conversas para a IA detectar datas.</p></Card>
        )}
        {futuras.map((v) => (
          <VisitaCard key={v.id} v={v} futura />
        ))}
      </div>

      {passadas.length > 0 && (
        <>
          <h2 className="mb-3 font-semibold text-slate-700">Visitas anteriores</h2>
          <div className="space-y-3">
            {passadas.map((v) => (
              <VisitaCard key={v.id} v={v} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function VisitaCard({ v, futura }: { v: { id: string; clienteId: string; clienteNome: string; municipio: string | null; maquina: string | null; data: Date; nota: string | null }; futura?: boolean }) {
  return (
    <Card className={futura ? "border-brand-200" : "opacity-70"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-100 p-2 text-brand-600">
            <Calendar size={18} />
          </div>
          <div>
            <Link href={`/clientes/${v.clienteId}`} className="font-semibold text-slate-800 hover:text-brand-600">
              {v.clienteNome}
            </Link>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin size={12} /> {v.municipio ?? "—"} · {v.maquina ?? "máquina a definir"}
              {v.nota && <span>· {v.nota}</span>}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-slate-700">{formatDateTime(v.data)}</div>
        </div>
      </div>
    </Card>
  );
}
