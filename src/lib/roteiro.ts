// Lógica de cálculo de rotas de visitas.
// Duas rotas: Sugerida (baseada em clientes esquecidos + prospectos) e Efetiva (agenda real).

import { diasDesde } from "./utils";

export type ClienteRota = {
  id: string;
  nome: string;
  telefone: string | null;
  origem: string | null;
  visitado: boolean;
  jaComprou: boolean;
  ultimoContato: Date | null;
  observacoes?: string | null;
  negociacoes: { status: string; maquinaModelo: string | null; ultimoContato: Date | null }[];
};

export type GrupoMunicipio = {
  municipioId: string;
  municipioNome: string;
  clientes: ClienteRota[];
  prospectos: ClienteRota[];
  diaRecomendado: "terça" | "quarta" | "quinta" | "sexta";
  lat: number | null;
  lng: number | null;
  mapsUrl: string;
};

export type VisitaAgendada = {
  id: string;
  clienteId: string;
  clienteNome: string;
  telefone: string | null;
  municipioNome: string | null;
  municipioId: string | null;
  data: Date;
  maquina: string | null;
  origem: "visita" | "negociacao";
};

export type DiaRota = {
  diaSemana: "terça" | "quarta" | "quinta" | "sexta";
  data: Date;
  municipios: string[];
  visitas: VisitaAgendada[];
  mapsUrl: string;
};

// Ordem geográfica aproximada para Sul do ES (de E→W / N→S)
const ORDEM_GEO: Record<string, number> = {
  "Anchieta": 0,
  "Piúma": 1,
  "Iconha": 2,
  "Itapemirim": 3,
  "Marataízes": 4,
  "Presidente Kennedy": 5,
  "Rio Novo do Sul": 6,
  "Cachoeiro de Itapemirim": 7,
  "Atílio Vivácqua": 8,
  "Muqui": 9,
  "Vargem Alta": 10,
  "Alfredo Chaves": 11,
  "Castelo": 12,
  "Conceição do Castelo": 13,
  "Brejetuba": 14,
  "Alegre": 15,
  "Jerônimo Monteiro": 16,
  "Muniz Freire": 17,
  "Guaçuí": 18,
  "Ibitirama": 19,
  "Divino de São Lourenço": 20,
  "Dores do Rio Preto": 21,
  "Mimoso do Sul": 22,
  "Apiacá": 23,
  "Bom Jesus do Norte": 24,
  "São José do Calçado": 25,
};

// Grupos de municípios vizinhos (para montar dias de rota eficientes).
// Cada grupo = 1 dia de viagem.
const CLUSTERS: { dia: "terça" | "quarta" | "quinta" | "sexta"; munis: string[] }[] = [
  { dia: "terça",  munis: ["Anchieta", "Piúma", "Iconha", "Rio Novo do Sul", "Alfredo Chaves"] },
  { dia: "quarta", munis: ["Itapemirim", "Marataízes", "Presidente Kennedy", "Atílio Vivácqua", "Cachoeiro de Itapemirim"] },
  { dia: "quinta", munis: ["Muqui", "Mimoso do Sul", "Bom Jesus do Norte", "Apiacá", "São José do Calçado", "Jerônimo Monteiro"] },
  { dia: "sexta",  munis: ["Castelo", "Alegre", "Guaçuí", "Vargem Alta", "Brejetuba", "Conceição do Castelo", "Muniz Freire", "Ibitirama", "Divino de São Lourenço", "Dores do Rio Preto"] },
];

export function diaRecomendadoPara(municipioNome: string): "terça" | "quarta" | "quinta" | "sexta" {
  for (const c of CLUSTERS) {
    if (c.munis.some((m) => municipioNome.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(municipioNome.toLowerCase()))) {
      return c.dia;
    }
  }
  // Fallback: ordem geográfica
  const idx = ORDEM_GEO[municipioNome] ?? 99;
  if (idx < 5) return "terça";
  if (idx < 10) return "quarta";
  if (idx < 18) return "quinta";
  return "sexta";
}

export function googleMapsUrl(munis: string[]): string {
  if (munis.length === 0) return "https://maps.google.com";
  if (munis.length === 1) {
    return `https://www.google.com/maps/search/${encodeURIComponent(munis[0] + ", ES")}`;
  }
  const origem = "Cachoeiro+de+Itapemirim,+ES";
  const destinos = munis.map((m) => encodeURIComponent(m + ", ES")).join("|");
  return `https://www.google.com/maps/dir/${origem}/${destinos}`;
}

export function prioridadeCliente(c: ClienteRota): number {
  let score = 0;
  const diasSemContato = diasDesde(c.ultimoContato);

  // Nunca visitado = urgência alta
  if (!c.visitado) score += 40;
  // Tempo sem contato
  if (diasSemContato > 90) score += 30;
  else if (diasSemContato > 60) score += 20;
  else if (diasSemContato > 30) score += 10;
  // Tem negociação aberta
  const temNeg = c.negociacoes.some((n) => n.status === "aberta");
  if (temNeg) score += 25;
  // Já comprou = fidelização
  if (c.jaComprou) score += 10;
  // Prospecto (não é cliente ainda) = oportunidade
  if (c.origem === "prospect_ia") score += 15;

  return score;
}

export function montarGruposSugeridos(
  clientesPorMunicipio: Map<string, { id: string; nome: string; lat: number | null; lng: number | null; clientes: ClienteRota[] }>
): GrupoMunicipio[] {
  const grupos: GrupoMunicipio[] = [];

  for (const [municipioNome, info] of clientesPorMunicipio) {
    const todos = info.clientes.sort((a, b) => prioridadeCliente(b) - prioridadeCliente(a));
    const clientes = todos.filter((c) => c.origem !== "prospect_ia");
    const prospectos = todos.filter((c) => c.origem === "prospect_ia");

    if (todos.length === 0) continue;

    grupos.push({
      municipioId: info.id,
municipioNome: info.nome,
      clientes,
      prospectos,
      diaRecomendado: diaRecomendadoPara(info.nome),
      lat: info.lat,
      lng: info.lng,
      mapsUrl: googlemapsUrl([info.nome]),
    });
  }

  // Ordena por: dia recomendado → número de clientes (mais denso = mais eficiente)
  const DIA_ORD = { "terça": 0, "quarta": 1, "quinta": 2, "sexta": 3 };
  return grupos.sort((a, b) => {
    const dOrd = DIA_ORD[a.diaRecomendado] - DIA_ORD[b.diaRecomendado];
    if (dOrd !== 0) return dOrd;
    return (b.clientes.length + b.prospectos.length) - (a.clientes.length + a.prospectos.length);
  });
}

// Próximos dias Ter-Sex a partir de hoje (max 4 semanas).
export function proximosDiasTerSex(max = 20): Date[] {
  const DIAS_VALIDOS = [2, 3, 4, 5]; // Ter=2, Qua=3, Qui=4, Sex=5
  const result: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60 && result.length < max; i++) {
    if (DIAS_VALIDOS.includes(d.getDay())) result.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return result;
}

export function agendarDias(grupos: GrupoMunicipio[]): Map<"terça" | "quarta" | "quinta" | "sexta", GrupoMunicipio[]> {
  const mapa = new Map<"terça" | "quarta" | "quinta" | "sexta", GrupoMunicipio[]>([
    ["terça", []], ["quarta", []], ["quinta", []], ["sexta", []],
  ]);
  for (const g of grupos) {
    mapa.get(g.diaRecomendado)!.push(g);
  }
  return mapa;
}
