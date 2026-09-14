import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import { formatDate, diaSemanaBrasilia, inicioDoDiaBrasilia, dataIsoBrasilia } from "@/lib/utils";
import { NovaVisitaForm } from "@/components/NovaVisitaForm";
import { BotaoRemoverVisita } from "@/components/BotaoRemoverVisita";
import { ConfirmacaoVisita } from "@/components/ConfirmacaoVisita";
import { CalendarioMensalVisitas, type DiaCalendario, type ItemCalendario } from "@/components/CalendarioMensalVisitas";
import { MapPin, Calendar, Clock, CheckCircle2, XCircle, CalendarClock, Users } from "lucide-react";
import { MapaVisitasWrapper } from "@/components/MapaVisitasWrapper";
import type { VisitaMapa } from "@/components/MapaVisitasES";
import { coordenadasMunicipioES, NOMES_MUNICIPIOS_ES } from "@/lib/municipios-es";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

// Compromisso fixo de toda segunda-feira: fica sempre antes das visitas do dia.
const REUNIAO_SEGUNDA = { nome: "REUNIÃO PME VITÓRIA", hora: "08:00", cidade: "Vitória", observacao: "Reunião semanal da PME (toda segunda)" };

function horaLocal(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

// Dia da semana (0=dom) de uma data ISO AAAA-MM-DD no fuso de Brasília.
const diaSemanaIso = (iso: string) => new Date(`${iso}T12:00:00-03:00`).getUTCDay();

export default async function VisitasPage({ searchParams }: { searchParams: { cliente?: string; novo?: string; mes?: string } }) {
  const hoje = new Date();
  // Dia e semana calculados no fuso de Brasília — o servidor roda em UTC e,
  // sem isso, a partir das 21h a agenda pulava para o dia seguinte.
  const diaSemanaAtual = diaSemanaBrasilia(hoje);
  const deltaSegunda = diaSemanaAtual === 0 ? 6 : diaSemanaAtual - 1;
  const inicioSemana = inicioDoDiaBrasilia(hoje, -deltaSegunda);
  const hojeInicio = inicioDoDiaBrasilia(hoje);
  const hojeIso = dataIsoBrasilia(hoje);
  const fimSemanaCompleta = new Date(inicioSemana); fimSemanaCompleta.setDate(inicioSemana.getDate() + 7);
  const fimDiasUteis = new Date(inicioSemana); fimDiasUteis.setDate(inicioSemana.getDate() + 5);

  // Mês do calendário (?mes=AAAA-MM), padrão: mês atual em Brasília.
  const mesParam = /^\d{4}-\d{2}$/.test(searchParams.mes ?? "") ? searchParams.mes! : hojeIso.slice(0, 7);
  const [anoCal, mesCal] = mesParam.split("-").map(Number);
  const inicioMes = new Date(`${mesParam}-01T00:00:00-03:00`);
  const fimMes = new Date(`${mesCal === 12 ? anoCal + 1 : anoCal}-${String(mesCal === 12 ? 1 : mesCal + 1).padStart(2, "0")}-01T00:00:00-03:00`);
  const mesAnterior = mesCal === 1 ? `${anoCal - 1}-12` : `${anoCal}-${String(mesCal - 1).padStart(2, "0")}`;
  const mesProximo = mesCal === 12 ? `${anoCal + 1}-01` : `${anoCal}-${String(mesCal + 1).padStart(2, "0")}`;

  const [visitas, clientesRaw] = await Promise.all([
    db.visita.findMany({
      include: { cliente: { include: { municipio: true } } },
      orderBy: { data: "asc" },
      take: 600,
    }),
    db.cliente.findMany({ select: { id: true, nome: true, municipio: { select: { nome: true } } }, orderBy: { nome: "asc" } }),
  ]);
  const clientes = clientesRaw.map((c) => ({ id: c.id, nome: c.nome, cidade: c.municipio?.nome ?? null }));
  const cidades = NOMES_MUNICIPIOS_ES;

  const estaSemanaCompleta = visitas.filter((v) => v.data >= inicioSemana && v.data < fimSemanaCompleta);
  const estaSemanaUtil = estaSemanaCompleta.filter((v) => v.data < fimDiasUteis);
  const fimDeSemana = estaSemanaCompleta.filter((v) => v.data >= fimDiasUteis);
  const futuras = visitas.filter((v) => v.data >= fimSemanaCompleta && v.status !== "nao_realizada");
  const realizadas = visitas.filter((v) => v.status === "realizada").slice(-80).reverse();
  const naoRealizadas = visitas.filter((v) => v.status === "nao_realizada").slice(-80).reverse();
  const reagendadas = visitas.filter((v) => v.reagendadaDeId && v.status !== "nao_realizada");
  const reagendadaPara = new Map<string, Date>();
  for (const v of visitas) if (v.reagendadaDeId) reagendadaPara.set(v.reagendadaDeId, v.data);
  const realizadasSemana = estaSemanaCompleta.filter((v) => v.status === "realizada").length;
  const pendentesPassadas = visitas.filter((v) => v.status === "agendada" && v.data < hojeInicio).length;

  const dias = Array.from({ length: 5 }, (_, i) => {
    const data = new Date(inicioSemana); data.setDate(inicioSemana.getDate() + i);
    const fimDia = new Date(data); fimDia.setDate(data.getDate() + 1);
    return {
      nome: DIAS_SEMANA[i],
      iso: dataIsoBrasilia(data),
      label: data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }),
      ehHoje: data.getTime() === hojeInicio.getTime(),
      visitas: estaSemanaUtil.filter((v) => v.data >= data && v.data < fimDia).sort((a, b) => a.data.getTime() - b.data.getTime()),
    };
  });

  // Pontos do mapa: cidade da visita (ou município do cadastro) → coordenada.
  const coordVitoria = coordenadasMunicipioES("Vitória");
  const visitasMapa: VisitaMapa[] = estaSemanaCompleta.map((v) => {
    const cidade = v.cidade ?? v.cliente.municipio?.nome ?? null;
    const coord = cidade ? coordenadasMunicipioES(cidade) ?? (v.cliente.municipio?.lat != null && v.cliente.municipio.lng != null ? { lat: v.cliente.municipio.lat, lng: v.cliente.municipio.lng } : null) : null;
    return {
      id: v.id, clienteId: v.clienteId, clienteNome: v.cliente.nome, cidade, observacao: v.observacao,
      hora: horaLocal(v.data), dataIso: dataIsoBrasilia(v.data), lat: coord?.lat ?? null, lng: coord?.lng ?? null, status: v.status,
    };
  });
  // Reunião fixa de segunda entra no mapa como primeiro ponto do dia.
  visitasMapa.push({
    id: `reuniao:${dias[0].iso}`, clienteId: "", clienteNome: REUNIAO_SEGUNDA.nome, cidade: REUNIAO_SEGUNDA.cidade, observacao: REUNIAO_SEGUNDA.observacao,
    hora: REUNIAO_SEGUNDA.hora, dataIso: dias[0].iso, lat: coordVitoria?.lat ?? null, lng: coordVitoria?.lng ?? null, fixo: true,
  });
  const diasMapa = dias.map((d) => ({ iso: d.iso, nome: d.nome, label: d.label, ehHoje: d.ehHoje }));
  const diaInicial = dias.find((d) => d.ehHoje)?.iso ?? dias[0].iso;

  // Calendário mensal: todas as visitas do mês + reunião em toda segunda.
  const doMes = visitas.filter((v) => v.data >= inicioMes && v.data < fimMes);
  const diasNoMes = new Date(Date.UTC(anoCal, mesCal, 0)).getUTCDate();
  const diasCalendario: DiaCalendario[] = Array.from({ length: diasNoMes }, (_, i) => {
    const iso = `${mesParam}-${String(i + 1).padStart(2, "0")}`;
    const itens: ItemCalendario[] = doMes.filter((v) => dataIsoBrasilia(v.data) === iso).map((v) => ({
      id: v.id, clienteId: v.clienteId, nome: v.cliente.nome, hora: horaLocal(v.data), cidade: v.cidade ?? v.cliente.municipio?.nome ?? null, status: v.status,
    })).sort((a, b) => a.hora.localeCompare(b.hora));
    if (diaSemanaIso(iso) === 1) itens.unshift({ id: `reuniao:${iso}`, clienteId: null, nome: REUNIAO_SEGUNDA.nome, hora: REUNIAO_SEGUNDA.hora, cidade: REUNIAO_SEGUNDA.cidade, status: "agendada", fixo: true });
    return { iso, dia: i + 1, itens };
  });
  const tituloMes = new Date(`${mesParam}-01T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader
        titulo="Visitas"
        subtitulo={`${realizadasSemana}/20 realizadas esta semana · ${estaSemanaCompleta.length} agendada(s) na semana${pendentesPassadas ? ` · ${pendentesPassadas} passada(s) sem confirmar (✓ ou ✗)` : ""}`}
        acao={<NovaVisitaForm clientes={clientes} cidades={cidades} clienteInicial={searchParams.cliente} abrirInicial={searchParams.novo === "1"} />}
      />

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-slate-500 uppercase tracking-wide">Mapa da semana · clique no dia</h2>
        <MapaVisitasWrapper visitas={visitasMapa} dias={diasMapa} diaInicial={diaInicial} />
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-slate-500 uppercase tracking-wide">Agenda da semana · ✓ realizada · ✗ não realizada</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {dias.map((dia, i) => (
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
                {i === 0 && (
                  <div className="rounded-xl bg-agro-400/20 p-2 ring-1 ring-agro-400/60">
                    <div className="flex items-center gap-1 text-xs font-black uppercase tracking-wide text-slate-900"><Users size={12} /> {REUNIAO_SEGUNDA.nome}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-600"><Clock size={10} /> {REUNIAO_SEGUNDA.hora} · <MapPin size={10} className="inline" /> {REUNIAO_SEGUNDA.cidade}</div>
                  </div>
                )}
                {dia.visitas.length === 0 && i !== 0 ? (
                  <p className="py-3 text-center text-xs text-slate-400">Nada agendado</p>
                ) : (
                  dia.visitas.map((v) => (
                    <div key={v.id} className={`group rounded-xl border p-2 ${v.status === "realizada" ? "border-emerald-100 bg-emerald-50" : v.status === "nao_realizada" ? "border-red-100 bg-red-50" : "border-slate-100 bg-slate-50"}`}>
                      <div className="flex items-start justify-between gap-1">
                        <Link href={`/clientes/${v.clienteId}`} className="min-w-0 text-xs font-semibold text-slate-800 hover:text-brand-600 truncate">
                          {v.cliente.nome}
                        </Link>
                        <BotaoRemoverVisita id={v.id} clienteId={v.clienteId} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock size={10} /> {horaLocal(v.data)}
                        {(v.cidade ?? v.cliente.municipio?.nome) && <> · <MapPin size={10} className="inline" /> {v.cidade ?? v.cliente.municipio?.nome}</>}
                      </div>
                      {v.observacao && <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{v.observacao}</p>}
                      <div className="mt-1.5">
                        <ConfirmacaoVisita id={v.id} status={v.status} dataIso={dataIsoBrasilia(v.data)} hora={horaLocal(v.data)} clienteNome={v.cliente.nome} tamanho="compacto" />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2">
                <NovaVisitaForm clientes={clientes} cidades={cidades} dataFixa={dia.iso} rotuloDataFixa={`${dia.nome}, ${dia.label}`} compacto />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-slate-500 uppercase tracking-wide">Calendário do mês</h2>
        <CalendarioMensalVisitas titulo={tituloMes} primeiroDiaSemana={diaSemanaIso(`${mesParam}-01`)} dias={diasCalendario} hojeIso={hojeIso} hrefAnterior={`/visitas?mes=${mesAnterior}`} hrefProximo={`/visitas?mes=${mesProximo}`} />
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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-emerald-700"><CheckCircle2 size={15} /> Realizadas <span className="rounded-full bg-emerald-100 px-2 text-xs">{realizadas.length}</span></h2>
          {realizadas.length === 0
            ? <Card><p className="text-center text-sm text-slate-400">Nenhuma visita confirmada ainda. Toque no ✓ quando a visita acontecer.</p></Card>
            : realizadas.map((v) => <LinhaVisita key={v.id} visita={v} />)}
        </section>
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-red-700"><XCircle size={15} /> Não realizadas <span className="rounded-full bg-red-100 px-2 text-xs">{naoRealizadas.length}</span></h2>
          {naoRealizadas.length === 0
            ? <Card><p className="text-center text-sm text-slate-400">Nenhuma.</p></Card>
            : naoRealizadas.map((v) => <LinhaVisita key={v.id} visita={v} reagendadaPara={reagendadaPara.get(v.id) ?? null} />)}
        </section>
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-sky-700"><CalendarClock size={15} /> Reagendadas <span className="rounded-full bg-sky-100 px-2 text-xs">{reagendadas.length}</span></h2>
          {reagendadas.length === 0
            ? <Card><p className="text-center text-sm text-slate-400">Nenhuma.</p></Card>
            : reagendadas.map((v) => <LinhaVisita key={v.id} visita={v} />)}
        </section>
      </div>
    </div>
  );
}

type VisitaComCliente = {
  id: string;
  data: Date;
  observacao: string | null;
  cidade: string | null;
  clienteId: string;
  status: string;
  cliente: { nome: string; municipio: { nome: string } | null };
};

function LinhaVisita({ visita: v, reagendadaPara }: { visita: VisitaComCliente; reagendadaPara?: Date | null }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${v.status === "realizada" ? "border-emerald-100 bg-emerald-50/40" : v.status === "nao_realizada" ? "border-red-100 bg-red-50/40" : "border-slate-200 bg-white"}`}>
      <Calendar size={16} className="shrink-0 text-brand-600" />
      <div className="min-w-0 flex-1">
        <Link href={`/clientes/${v.clienteId}`} className="text-sm font-semibold text-slate-800 hover:text-brand-600">
          {v.cliente.nome}
        </Link>
        <p className="text-xs text-slate-400">
          {formatDate(v.data)} às {horaLocal(v.data)}
          {(v.cidade ?? v.cliente.municipio?.nome) && <> · <MapPin size={10} className="inline" /> {v.cidade ?? v.cliente.municipio?.nome}</>}
          {v.observacao && ` · ${v.observacao}`}
          {reagendadaPara && <span className="font-semibold text-sky-700"> · reagendada para {formatDate(reagendadaPara)}</span>}
        </p>
      </div>
      <ConfirmacaoVisita id={v.id} status={v.status} dataIso={dataIsoBrasilia(v.data)} hora={horaLocal(v.data)} clienteNome={v.cliente.nome} tamanho="compacto" />
      <BotaoRemoverVisita id={v.id} clienteId={v.clienteId} />
    </div>
  );
}
