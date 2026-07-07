import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { NovaVisitaForm } from "@/components/NovaVisitaForm";
import { BotaoRemoverVisita } from "@/components/BotaoRemoverVisita";
import { MapPin, Calendar } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VisitasPage() {
  const hoje = new Date();
  const diaSemanaAtual = hoje.getDay();
  const deltaSegunda = diaSemanaAtual === 0 ? 6 : diaSemanaAtual - 1;
  const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - deltaSegunda); inicioSemana.setHours(0, 0, 0, 0);
  const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 7);

  const [visitas, clientes] = await Promise.all([
    db.visita.findMany({
      include: { cliente: { include: { municipio: true } } },
      orderBy: { data: "desc" },
      take: 200,
    }),
    db.cliente.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  const estaSemana = visitas.filter((v) => v.data >= inicioSemana && v.data < fimSemana);
  const anteriores = visitas.filter((v) => !(v.data >= inicioSemana && v.data < fimSemana));

  return (
    <div>
      <PageHeader
        titulo="Visitas"
        subtitulo={`${estaSemana.length}/20 esta semana (zera toda segunda) · ${visitas.length} no total`}
        acao={<NovaVisitaForm clientes={clientes} />}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Esta semana</h2>
        {estaSemana.length === 0 ? (
          <Card><p className="text-center text-sm text-slate-400">Nenhuma visita registrada esta semana ainda.</p></Card>
        ) : estaSemana.map((v) => <LinhaVisita key={v.id} visita={v} />)}
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Anteriores</h2>
        {anteriores.length === 0 ? (
          <Card><p className="text-center text-sm text-slate-400">Nenhuma visita anterior.</p></Card>
        ) : anteriores.slice(0, 50).map((v) => <LinhaVisita key={v.id} visita={v} />)}
      </section>
    </div>
  );
}

type VisitaComCliente = {
  id: string;
  data: Date;
  observacao: string | null;
  clienteId: string;
  cliente: { nome: string; municipio: { nome: string } | null };
};

function LinhaVisita({ visita: v }: { visita: VisitaComCliente }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <Calendar size={16} className="shrink-0 text-brand-600" />
      <div className="min-w-0 flex-1">
        <Link href={`/clientes/${v.clienteId}`} className="text-sm font-semibold text-slate-800 hover:text-brand-600">
          {v.cliente.nome}
        </Link>
        <p className="text-xs text-slate-400">
          {formatDate(v.data)}
          {v.cliente.municipio && <> · <MapPin size={10} className="inline" /> {v.cliente.municipio.nome}</>}
          {v.observacao && ` · ${v.observacao}`}
        </p>
      </div>
      <BotaoRemoverVisita id={v.id} clienteId={v.clienteId} />
    </div>
  );
}
