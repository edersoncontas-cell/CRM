// Sugestão de dia de visita por proximidade: olha a agenda dos próximos dias
// (visitas já marcadas, com a cidade de cada uma) e descobre em que dia o
// vendedor vai estar mais perto da cidade do cliente — para o Orientador
// propor esse dia em vez de um dia qualquer. Módulo PURO (sem banco) para
// ser testável; quem carrega a agenda é agenda-contexto.ts.

export type Ponto = { lat: number; lng: number };
export type VisitaAgendada = { data: Date; cidade: string; ponto: Ponto | null };
export type SugestaoVisita = {
  data: Date;          // início do dia sugerido (fuso de Brasília)
  cidade: string;      // cidade da visita já marcada mais perto do cliente
  distanciaKm: number; // do cliente até essa cidade (0 = mesma cidade)
  visitasNoDia: number;
};

const FUSO = "America/Sao_Paulo";
const R_TERRA_KM = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

export function distanciaKm(a: Ponto, b: Ponto): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TERRA_KM * Math.asin(Math.sqrt(h));
}

// "2026-09-22" no fuso de Brasília — a chave do dia.
export const diaBrasilia = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// Escolhe o dia, dentro da janela, em que alguma visita marcada fica mais perto
// do cliente. Empate na distância → o dia mais cedo. null quando não dá para
// saber (cliente sem cidade georreferenciada, ou nenhuma visita com cidade).
export function sugerirDiaVisita(
  cliente: Ponto | null,
  visitas: VisitaAgendada[],
  agora: Date = new Date(),
  janelaDias = 14
): SugestaoVisita | null {
  if (!cliente) return null;
  const limite = new Date(agora.getTime() + janelaDias * 86_400_000);
  const porDia = new Map<string, { melhor: { cidade: string; km: number } | null; total: number; data: Date }>();

  for (const v of visitas) {
    if (v.data < agora || v.data > limite) continue;
    const chave = diaBrasilia(v.data);
    const dia = porDia.get(chave) ?? { melhor: null, total: 0, data: v.data };
    dia.total++;
    if (v.data < dia.data) dia.data = v.data;
    if (v.ponto) {
      const km = distanciaKm(cliente, v.ponto);
      if (!dia.melhor || km < dia.melhor.km) dia.melhor = { cidade: v.cidade, km };
    }
    porDia.set(chave, dia);
  }

  let escolhido: SugestaoVisita | null = null;
  for (const chave of [...porDia.keys()].sort()) {
    const dia = porDia.get(chave)!;
    if (!dia.melhor) continue;
    if (!escolhido || dia.melhor.km < escolhido.distanciaKm) {
      escolhido = { data: dia.data, cidade: dia.melhor.cidade, distanciaKm: dia.melhor.km, visitasNoDia: dia.total };
    }
  }
  return escolhido;
}

const fmtDia = (d: Date): string => {
  const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: FUSO });
  // "terça-feira, 22/09" → "terça 22/09"
  return s.replace(/-feira/, "").replace(",", "");
};

// Texto curto para o painel e para o prompt: "terça 22/09 — você já estará
// em Alegre (≈28 km)" / "… na mesma cidade (Guaçuí)".
export function descreverSugestaoVisita(s: SugestaoVisita, cidadeCliente: string | null): string {
  const km = Math.round(s.distanciaKm);
  const onde = km <= 2
    ? `você já estará na mesma cidade (${s.cidade})`
    : `você já estará em ${s.cidade} (≈${km} km${cidadeCliente ? ` de ${cidadeCliente}` : ""})`;
  return `${fmtDia(s.data)} — ${onde}`;
}

// Resumo da agenda por dia, para a IA enxergar a semana: "seg 21/09: Cachoeiro (2), Alegre (1)".
export function resumirAgenda(visitas: VisitaAgendada[], agora: Date = new Date(), janelaDias = 14): string[] {
  const limite = new Date(agora.getTime() + janelaDias * 86_400_000);
  const porDia = new Map<string, { data: Date; cidades: Map<string, number> }>();
  for (const v of visitas) {
    if (v.data < agora || v.data > limite) continue;
    const chave = diaBrasilia(v.data);
    const dia = porDia.get(chave) ?? { data: v.data, cidades: new Map() };
    dia.cidades.set(v.cidade, (dia.cidades.get(v.cidade) ?? 0) + 1);
    porDia.set(chave, dia);
  }
  return [...porDia.keys()].sort().map((k) => {
    const dia = porDia.get(k)!;
    const cidades = [...dia.cidades.entries()].map(([c, n]) => (n > 1 ? `${c} (${n})` : c)).join(", ");
    return `${fmtDia(dia.data)}: ${cidades}`;
  });
}
