import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import * as googleCalendar from "@/lib/integrations/googleCalendar";
import { Calendar, MapPin } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const visitas = await db.negociacao.findMany({
    where: { dataVisita: { not: null }, status: { not: "perdida" } },
    include: { cliente: { include: { municipio: true } } },
    orderBy: { dataVisita: "asc" },
  });

  const agora = new Date();
  const futuras = visitas.filter((v) => v.dataVisita! >= agora);
  const passadas = visitas.filter((v) => v.dataVisita! < agora);

  return (
    <div>
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

function VisitaCard({ v, futura }: { v: any; futura?: boolean }) {
  return (
    <Card className={futura ? "border-brand-200" : "opacity-70"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-100 p-2 text-brand-600">
            <Calendar size={18} />
          </div>
          <div>
            <Link href={`/clientes/${v.clienteId}`} className="font-semibold text-slate-800 hover:text-brand-600">
              {v.cliente.nome}
            </Link>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin size={12} /> {v.cliente.municipio?.nome ?? "—"} · {v.maquinaModelo ?? "máquina a definir"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-slate-700">{formatDateTime(v.dataVisita)}</div>
        </div>
      </div>
    </Card>
  );
}
