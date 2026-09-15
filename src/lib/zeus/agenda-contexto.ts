// Carrega a agenda de visitas dos próximos dias com a cidade de cada uma e
// calcula, para UM cliente, o melhor dia de visita por proximidade (ver
// agenda-proximidade.ts). Usado pelo prompt do Orientador/Cérebro e pelo
// painel da conversa no Atendimento.

import { db } from "@/lib/db";
import { semAcento } from "@/lib/utils";
import { sugerirDiaVisita, descreverSugestaoVisita, resumirAgenda, type Ponto, type VisitaAgendada } from "@/lib/zeus/agenda-proximidade";

export type ContextoAgenda = {
  // Linhas prontas para o prompt (vazio se não há visitas na janela).
  texto: string;
  // Sugestão para o painel: null quando não dá para calcular.
  sugestao: { dataISO: string; texto: string } | null;
};

const JANELA_DIAS = 14;

export async function montarContextoAgenda(clienteId: string, agora: Date = new Date()): Promise<ContextoAgenda> {
  const vazio: ContextoAgenda = { texto: "", sugestao: null };
  try {
    const limite = new Date(agora.getTime() + JANELA_DIAS * 86_400_000);
    const [cliente, visitas, municipios] = await Promise.all([
      db.cliente.findUnique({ where: { id: clienteId }, select: { municipio: { select: { nome: true, lat: true, lng: true } } } }),
      db.visita.findMany({
        where: { status: "agendada", data: { gte: agora, lte: limite }, clienteId: { not: clienteId } },
        select: { data: true, cidade: true, cliente: { select: { municipio: { select: { nome: true, lat: true, lng: true } } } } },
      }),
      db.municipio.findMany({ where: { lat: { not: null }, lng: { not: null } }, select: { nome: true, lat: true, lng: true } }),
    ]);
    if (!visitas.length) return vazio;

    // Visita pode ter cidade própria (obra em outra cidade) — casa pelo nome
    // no cadastro de municípios para achar a coordenada; senão usa a do cliente.
    const porNome = new Map(municipios.map((m) => [semAcento(m.nome), { lat: m.lat!, lng: m.lng! }]));
    const agenda: VisitaAgendada[] = visitas.map((v) => {
      const cidadeTexto = v.cidade?.trim() || v.cliente.municipio?.nome || "cidade não informada";
      const ponto: Ponto | null = v.cidade?.trim()
        ? porNome.get(semAcento(v.cidade)) ?? null
        : v.cliente.municipio?.lat != null && v.cliente.municipio.lng != null ? { lat: v.cliente.municipio.lat, lng: v.cliente.municipio.lng } : null;
      return { data: v.data, cidade: cidadeTexto, ponto };
    });

    const m = cliente?.municipio;
    const pontoCliente: Ponto | null = m?.lat != null && m?.lng != null ? { lat: m.lat, lng: m.lng } : null;
    const sugestao = sugerirDiaVisita(pontoCliente, agenda, agora, JANELA_DIAS);
    const sugestaoTexto = sugestao ? descreverSugestaoVisita(sugestao, m?.nome ?? null) : null;

    const linhas = [
      `--- Agenda de visitas já marcadas (próximos ${JANELA_DIAS} dias, por cidade) ---`,
      ...resumirAgenda(agenda, agora, JANELA_DIAS).map((l) => `• ${l}`),
      m?.nome ? `Cidade deste cliente: ${m.nome}.` : "Cidade deste cliente: não cadastrada.",
      sugestaoTexto
        ? `MELHOR DIA PARA VISITAR ESTE CLIENTE: ${sugestaoTexto}. Ao propor/marcar visita, sugira esse dia (dá para encaixar na mesma rota).`
        : "Sem como calcular o melhor dia (falta cidade georreferenciada do cliente ou das visitas).",
    ];
    return { texto: linhas.join("\n"), sugestao: sugestao && sugestaoTexto ? { dataISO: sugestao.data.toISOString(), texto: sugestaoTexto } : null };
  } catch (e) {
    console.error("[agenda-contexto] falha ao montar agenda:", e);
    return vazio;
  }
}
