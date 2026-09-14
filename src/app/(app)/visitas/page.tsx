import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import { formatDate, diaSemanaBrasilia, inicioDoDiaBrasilia } from "@/lib/utils";
import { NovaVisitaForm } from "@/components/NovaVisitaForm";
import { BotaoRemoverVisita } from "@/components/BotaoRemoverVisita";
import { MapPin, Calendar, Clock } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

function horaLocal(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

export default async function VisitasPage() {
  const hoje = new Date();
  // Dia e semana calculados no fuso de Brasília — o servidor roda em UTC e,
  // sem isso, a partir das 21h a agenda pulava para o dia seguinte.
  const diaSemanaAtual = diaSemanaBrasilia(hoje);
  const deltaSegunda = diaSemanaAtual === 0 ? 6 : diaSemanaAtual - 1;
  const inicioSemana = inicioDoDiaBrasilia(hoje, -deltaSegunda);
  const hojeInicio = inicioDoDiaBrasilia(hoje);
  // Semana completa (segunda a domingo) — mesma janela usada no card "Visitas
  // Semanais" do Dashboard, pra "X/20 esta semana" bater nas duas telas.
  const fimSemanaCompleta = new Date(inicioSemana); fimSemanaCompleta.setDate(inicioSemana.getDate() + 7);
  // Sábado 00:00 — corte do quadro de dias úteis (seg-sex, só isso vira coluna)
  const fimDiasUteis = new Date(inicioSemana); fimDiasUteis.setDate(inicioSemana.getDate() + 5);

  const [visitas, clientes] = await Promise.all([
    db.visita.findMany({
      include: { cliente: { include: { municipio: true } } },
      orderBy: { data: "asc" },
      take: 300,
    }),
    db.cliente.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  const estaSemanaCompleta = visitas.filter((v) => v.data >= inicioSemana && v.data < fimSemanaCompleta);
  const estaSemanaUtil = estaSemanaCompleta.filter((v) => v.data < fimDiasUteis);
  const fimDeSemana = estaSemanaCompleta.filter((v) => v.data >= fimDiasUteis);
  const futuras = visitas.filter((v) => v.data >= fimSemanaCompleta);
  const anteriores = visitas.filter((v) => v.data < inicioSemana);

  const dias = Array.from({ length: 5 }, (_, i) => {
    const data = new Date(inicioSemana); data.setDate(inicioSemana.getDate() + i);
    const fimDia = new Date(data); fimDia.setDate(data.getDate() + 1);
    return {
      nome: DIAS_SEMANA[i],
      iso: data.toISOString().slice(0, 10),
      label: data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }),
      ehHoje: data.getTime() === hojeInicio.getTime(),
      visitas: estaSemanaUtil.filter((v) => v.data >= data && v.data < fimDia).sort((a, b) => a.data.getTime() - b.data.getTime()),
    };
  });

  return (
    <div>
      <PageHeader
        titulo="Visitas"
        subtitulo={`${estaSemanaCompleta.length}/20 agendadas esta semana · ${visitas.length} no total`}
        acao={<NovaVisitaForm clientes={clientes} />}
      />

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-500 uppercase tracking-wide">Agenda da semana</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {dias.map((dia) => (
            <div
              key={dia.iso}
              className={`flex flex-col rounded-2xl border p-3 ${dia.ehHoje ? "border-brand-300 bg-brand-50/50" : "border-slate-200 bg-white"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">{dia.nome}</div>
                  <div className="text-xs text-slate-400">{dia.label}{dia.ehHoje && " · hoje"}</div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{dia.visitas.length}</span>
              </div>
              <div className="flex-1 space-y-2">
                {dia.visitas.length === 0 ? (
                  <p className="py-3 text-center text-xs text-slate-400">Nada agendado</p>
                ) : (
                  dia.visitas.map((v) => (
                    <div key={v.id} className="group rounded-xl border border-slate-100 bg-slate-50 p-2">
                      <div className="flex items-start justify-between gap-1">
                        <Link href={`/clientes/${v.clienteId}`} className="min-w-0 text-xs font-semibold text-slate-800 hover:text-brand-600 truncate">
                          {v.cliente.nome}
                        </Link>
                        <BotaoRemoverVisita id={v.id} clienteId={v.clienteId} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock size={10} /> {horaLocal(v.data)}
                        {v.cliente.municipio && <> · <MapPin size={10} className="inline" /> {v.cliente.municipio.nome}</>}
                      </div>
                      {v.observacao && <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{v.observacao}</p>}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2">
                <NovaVisitaForm clientes={clientes} dataFixa={dia.iso} rotuloDataFixa={`${dia.nome}, ${dia.label}`} compacto />
              </div>
            </div>
          ))}
        </div>
      </section>

      {fimDeSemana.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Fim de semana</h2>
          {fimDeSemana.map((v) => <LinhaVisita key={v.id} visita={v} />)}
        </section>
      )}

      {futuras.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Próximas semanas</h2>
          {futuras.map((v) => <LinhaVisita key={v.id} visita={v} />)}
        </section>
      )}

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Anteriores</h2>
        {anteriores.length === 0 ? (
          <Card><p className="text-center text-sm text-slate-400">Nenhuma visita anterior.</p></Card>
        ) : anteriores.slice(-50).reverse().map((v) => <LinhaVisita key={v.id} visita={v} />)}
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
          {formatDate(v.data)} às {horaLocal(v.data)}
          {v.cliente.municipio && <> · <MapPin size={10} className="inline" /> {v.cliente.municipio.nome}</>}
          {v.observacao && ` · ${v.observacao}`}
        </p>
      </div>
      <BotaoRemoverVisita id={v.id} clienteId={v.clienteId} />
    </div>
  );
}
