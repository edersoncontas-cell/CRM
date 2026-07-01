import { db } from "@/lib/db";
import { diasDesde, diaSemanaBrasilia } from "@/lib/utils";
import { RoteiroClient } from "@/components/RoteiroClient";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import {
  montarGruposSugeridos,
  googleMapsUrl,
  type VisitaAgendada,
  type DiaRota,
  type ClienteRota,
} from "@/lib/roteiro";
import { Route } from "lucide-react";

export const dynamic = "force-dynamic";

const DIAS_SEMANA_VALIDOS = [2, 3, 4, 5]; // Ter, Qua, Qui, Sex

export default async function RoteiroPage() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const em45dias = new Date(hoje);
  em45dias.setDate(em45dias.getDate() + 45);

  const [clientesRaw, visitasRaw, negsComVisita, demandasHojeRaw] = await Promise.all([
    db.cliente.findMany({
      where: {
        OR: [
          { visitado: false },
          { ultimoContato: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          { ultimoContato: null },
        ],
        municipioId: { not: null },
      },
      select: {
        id: true,
        nome: true,
        telefone: true,
        origem: true,
        visitado: true,
        jaComprou: true,
        ultimoContato: true,
        observacoes: true,
        municipioId: true,
        municipio: true,
        negociacoes: {
          where: { status: "aberta" },
          select: { status: true, maquinaModelo: true, ultimoContato: true },
        },
      },
    }),
    db.visita.findMany({
      where: { data: { gte: hoje, lte: em45dias } },
      include: { cliente: { include: { municipio: true } } },
      orderBy: { data: "asc" },
    }),
    db.negociacao.findMany({
      where: { dataVisita: { gte: hoje, lte: em45dias }, status: { not: "perdida" } },
      include: { cliente: { include: { municipio: true } } },
      orderBy: { dataVisita: "asc" },
    }),
    // Demandas de hoje com cidade definida
    db.tarefaKanban.findMany({
      where: {
        dueDate: { gte: hoje, lte: new Date(hoje.getTime() + 24 * 60 * 60 * 1000) },
        cidade: { not: null },
      },
      select: { id: true, titulo: true, descricao: true, dueDate: true, cidade: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  // ── Grupos sugeridos ──────────────────────────────────────────────────────
  const porMunicipio = new Map<string, {
    id: string; nome: string; lat: number | null; lng: number | null; clientes: ClienteRota[];
  }>();

  for (const c of clientesRaw) {
    if (!c.municipioId || !c.municipio) continue;
    const dias = diasDesde(c.ultimoContato);
    if (c.visitado && dias < 30) continue; // já visitado recentemente, pula

    if (!porMunicipio.has(c.municipioId)) {
      porMunicipio.set(c.municipioId, {
        id: c.municipioId,
        nome: c.municipio.nome,
        lat: c.municipio.lat ?? null,
        lng: c.municipio.lng ?? null,
        clientes: [],
      });
    }
    porMunicipio.get(c.municipioId)!.clientes.push({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      origem: c.origem,
      visitado: c.visitado,
      jaComprou: c.jaComprou,
      ultimoContato: c.ultimoContato,
      observacoes: c.observacoes,
      negociacoes: c.negociacoes,
    });
  }

  const gruposSugeridos = montarGruposSugeridos(porMunicipio);
  const totalClientes = gruposSugeridos.reduce((s, g) => s + g.clientes.length, 0);
  const totalProspectos = gruposSugeridos.reduce((s, g) => s + g.prospectos.length, 0);

  // ── Rota efetiva ──────────────────────────────────────────────────────────
  const NOME_DIA: Record<number, "terça" | "quarta" | "quinta" | "sexta"> = {
    2: "terça", 3: "quarta", 4: "quinta", 5: "sexta",
  };

  const visitasAgendadas: VisitaAgendada[] = [
    ...visitasRaw
      .filter((v) => DIAS_SEMANA_VALIDOS.includes(diaSemanaBrasilia(v.data)))
      .map((v): VisitaAgendada => ({
        id: v.id,
        clienteId: v.clienteId,
        clienteNome: v.cliente.nome,
        telefone: v.cliente.telefone,
        municipioNome: v.cliente.municipio?.nome ?? null,
        municipioId: v.cliente.municipioId,
        data: v.data,
        maquina: null,
        origem: "visita",
      })),
    ...negsComVisita
      .filter((n) => DIAS_SEMANA_VALIDOS.includes(diaSemanaBrasilia(n.dataVisita!)))
      .map((n): VisitaAgendada => ({
        id: n.id,
        clienteId: n.clienteId,
        clienteNome: n.cliente.nome,
        telefone: n.cliente.telefone,
        municipioNome: n.cliente.municipio?.nome ?? null,
        municipioId: n.cliente.municipioId,
        data: n.dataVisita!,
        maquina: n.maquinaModelo,
        origem: "negociacao",
      })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime());

  // Deduplica: se cliente tem visita e negociação na mesma data (±4h), mantém só a primeira.
  const vistasDedup: VisitaAgendada[] = [];
  const seen = new Set<string>();
  for (const v of visitasAgendadas) {
    const chave = `${v.clienteId}-${v.data.toISOString().slice(0, 13)}`;
    if (!seen.has(chave)) { seen.add(chave); vistasDedup.push(v); }
  }

  const porDia = new Map<string, VisitaAgendada[]>();
  for (const v of vistasDedup) {
    const key = v.data.toISOString().slice(0, 10);
    if (!porDia.has(key)) porDia.set(key, []);
    porDia.get(key)!.push(v);
  }

  const diasEfetivos: DiaRota[] = [...porDia.entries()].map(([, visitas]) => {
    const data = visitas[0].data;
    const municipiosUnicos = [...new Set(visitas.map((v) => v.municipioNome).filter(Boolean) as string[])];
    return {
      diaSemana: NOME_DIA[diaSemanaBrasilia(data)] ?? "terça",
      data,
      municipios: municipiosUnicos,
      visitas,
      mapsUrl: googleMapsUrl(municipiosUnicos),
    };
  });

  // ── Rota das Demandas de Hoje ────────────────────────────────────────────
const cidades = demandasHojeRaw
  .map((d) => d.cidade)
  .filter((c): c is string => !!c && c.trim().length > 0);

// Build a Google Maps route URL with waypoints (starting from Vila Velha, ES)
function buildMapaRotaUrl(origem: string, destinos: string[]): string {
  if (destinos.length === 0) return "";
  const base = "https://www.google.com/maps/dir/";
  const origemEnc = encodeURIComponent(origem + ", ES, Brasil");
  if (destinos.length === 1) {
    return base + origemEnc + "/" + encodeURIComponent(destinos[0] + ", ES, Brasil");
  }
  const waypoints = destinos.slice(0, -1).map((d) => encodeURIComponent(d + ", ES, Brasil")).join("/");
  const destino = encodeURIComponent(destinos[destinos.length - 1] + ", ES, Brasil");
  return base + origemEnc + "/" + waypoints + "/" + destino;
}

return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-6 p-6 md:-m-8 md:p-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="rounded-xl p-2" style={{ background: "rgba(191,222,77,0.1)" }}>
              <Route size={22} style={{ color: "#BFDE4D" }} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Roteiro de Visitas</h1>
          </div>
          <p className="text-sm ml-1" style={{ color: "#71717a" }}>
            Rota <span style={{ color: "#BFDE4D" }}>sugerida pela IA</span> para manter contato + prospectar novas empresas,
            e rota <span style={{ color: "#60a5fa" }}>efetiva</span> baseada na agenda real (Ter–Sex).
          </p>
        </div>
        <BotaoAtualizar />
      </div>

      {/* ── Rota das Demandas de Hoje ── */}
      {demandasHojeRaw.length > 0 && (
        <div className="mb-8 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg font-bold text-amber-300">📍 Rota das Demandas de Hoje</span>
            <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
              {demandasHojeRaw.length} demanda(s)
            </span>
          </div>
          <div className="mb-4 space-y-2">
            {demandasHojeRaw.map((d) => (
              <div key={d.id} className="flex items-start gap-2 text-sm text-amber-100">
                <span className="mt-0.5 text-amber-400">•</span>
                <span className="font-medium">{d.titulo}</span>
                {d.cidade && (
                  <span className="ml-auto shrink-0 rounded bg-amber-400/20 px-2 py-0.5 text-xs text-amber-300">
                    📍 {d.cidade}
                  </span>
                )}
                {d.dueDate && (
                  <span className="shrink-0 text-xs text-amber-400">
                    {new Date(d.dueDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            ))}
          </div>
          {cidades.length > 0 && (
            <div className="mt-4">
              <form
                action="/roteiro"
                className="flex flex-wrap items-center gap-2"
              >
                <label className="flex items-center gap-2 text-xs font-medium text-amber-200">
                  <span>🏠 Saindo de:</span>
                  <input
                    name="origem"
                    defaultValue="Vila Velha"
                    className="rounded-lg border border-amber-400/40 bg-black/30 px-3 py-1.5 text-sm text-white outline-none placeholder:text-amber-200/40 focus:border-amber-400"
                    placeholder="Cidade de origem"
                  />
                </label>
                <a
                  href={buildMapaRotaUrl("Vila Velha", cidades)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-black hover:bg-amber-300"
                >
                  🗺️ Abrir Rota no Google Maps
                </a>
              </form>
              <p className="mt-2 text-xs text-amber-400/70">
                Cidades: {cidades.join(" → ")}
              </p>
            </div>
          )}
        </div>
      )}

      <RoteiroClient
        gruposSugeridos={gruposSugeridos}
        diasEfetivos={diasEfetivos}
        totalClientes={totalClientes}
        totalProspectos={totalProspectos}
      />
    </div>
  );
}
