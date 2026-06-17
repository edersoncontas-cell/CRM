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

  const [clientesRaw, visitasRaw, negsComVisita] = await Promise.all([
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

      <RoteiroClient
        gruposSugeridos={gruposSugeridos}
        diasEfetivos={diasEfetivos}
        totalClientes={totalClientes}
        totalProspectos={totalProspectos}
      />
    </div>
  );
}
