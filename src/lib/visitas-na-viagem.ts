// APROVEITE A VIAGEM: quem mais visitar enquanto está naquela cidade.
//
// "Quando tiver alguma visita de algum cliente já cadastrado com a cidade, que
//  o sistema possa puxar clientes que já faz um tempo que não é visitado, por
//  exemplo clientes com mais de 60 dias sem visita, o sistema fará uma sugestão
//  de visita de clientes desta cidade ou próximas."
//
// É o caminho inverso do zeus/agenda-proximidade, que parte do CLIENTE e acha
// o melhor dia. Aqui parte da VIAGEM já marcada e acha quem está no caminho —
// a conta que o vendedor faz de cabeça quando já está com o carro na estrada,
// e que o CRM pode fazer por ele antes de sair.
//
// Módulo puro (sem banco), para a regra dar para provar.

import { distanciaKm, type Ponto } from "@/lib/zeus/agenda-proximidade";

export type ClienteVisitavel = {
  id: string;
  nome: string;
  cidade: string | null;
  ponto: Ponto | null;
  /** Última visita REALIZADA. null = nunca visitado. */
  ultimaVisita: Date | null;
};

export type VisitaMarcada = {
  clienteId: string;
  data: Date;
  cidade: string;
  ponto: Ponto | null;
};

export type ClienteSugerido = {
  id: string;
  nome: string;
  cidade: string | null;
  km: number;
  /** null = nunca visitado, que é mais urgente que qualquer número de dias. */
  diasSemVisita: number | null;
};

export type SugestaoViagem = {
  data: Date;
  cidade: string;
  clientes: ClienteSugerido[];
};

export const DIAS_SEM_VISITA_PADRAO = 60;
export const RAIO_KM_PADRAO = 40;
const POR_VIAGEM_PADRAO = 5;

/**
 * Quem sugerir para cada viagem já marcada.
 *
 * Decisões que valem o comentário:
 *
 *  - Cliente SEM visita nenhuma entra na frente de todo mundo com a mesma
 *    distância. É o esquecido de verdade; contar "0 dias sem visita" para ele
 *    o jogaria para o fim da lista, que é o contrário do que se quer.
 *  - Quem já tem visita marcada na janela é excluído. Sugerir visita para
 *    quem você já vai ver amanhã é ruído, e ruído faz o vendedor parar de ler
 *    o quadro inteiro.
 *  - Mesma cidade vem antes de cidade perto, sempre — 12 km de estrada de
 *    terra custam mais que 12 km de asfalto, e o CRM não sabe a diferença.
 *  - Cliente sem cidade georreferenciada fica de fora em vez de entrar com
 *    distância chutada: sugestão errada gasta a viagem do vendedor, e uma
 *    sugestão a menos custa bem menos que uma sugestão errada.
 */
export function sugerirVisitasNaViagem(
  visitas: VisitaMarcada[],
  candidatos: ClienteVisitavel[],
  agora: Date = new Date(),
  opcoes: { diasMinimos?: number; raioKm?: number; porViagem?: number } = {}
): SugestaoViagem[] {
  const diasMinimos = opcoes.diasMinimos ?? DIAS_SEM_VISITA_PADRAO;
  const raioKm = opcoes.raioKm ?? RAIO_KM_PADRAO;
  const porViagem = opcoes.porViagem ?? POR_VIAGEM_PADRAO;

  const jaAgendados = new Set(visitas.map((v) => v.clienteId));
  const dias = (d: Date) => Math.floor((agora.getTime() - d.getTime()) / 86_400_000);

  // Quem está devendo visita: nunca visitado, ou visitado há tempo demais.
  const devendo = candidatos.filter((c) => {
    if (jaAgendados.has(c.id)) return false;
    if (!c.ultimaVisita) return true;
    return dias(c.ultimaVisita) >= diasMinimos;
  });

  const saida: SugestaoViagem[] = [];
  for (const v of visitas) {
    if (!v.ponto) continue; // viagem sem cidade no mapa não tem de onde medir

    const perto: ClienteSugerido[] = [];
    for (const c of devendo) {
      if (!c.ponto) continue;
      const km = Math.round(distanciaKm(v.ponto, c.ponto));
      if (km > raioKm) continue;
      perto.push({
        id: c.id,
        nome: c.nome,
        cidade: c.cidade,
        km,
        diasSemVisita: c.ultimaVisita ? dias(c.ultimaVisita) : null,
      });
    }

    perto.sort((a, b) => {
      if (a.km !== b.km) return a.km - b.km;                       // mais perto primeiro
      if ((a.diasSemVisita === null) !== (b.diasSemVisita === null)) {
        return a.diasSemVisita === null ? -1 : 1;                  // nunca visitado na frente
      }
      return (b.diasSemVisita ?? 0) - (a.diasSemVisita ?? 0);       // depois, o mais esquecido
    });

    if (perto.length) {
      saida.push({ data: v.data, cidade: v.cidade, clientes: perto.slice(0, porViagem) });
    }
  }

  // Uma viagem por dia+cidade: duas visitas na mesma cidade no mesmo dia
  // sugeririam a mesma lista duas vezes.
  const vistas = new Set<string>();
  return saida
    .sort((a, b) => a.data.getTime() - b.data.getTime())
    .filter((s) => {
      const chave = `${s.data.toISOString().slice(0, 10)}|${s.cidade.toLowerCase()}`;
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    });
}

/** "há 74 dias" / "nunca visitado" — como o vendedor lê. */
export function rotuloSemVisita(dias: number | null): string {
  return dias === null ? "nunca visitado" : `há ${dias} dias`;
}

/** "na cidade" / "a 12 km" — distância como ele pensa. */
export function rotuloDistancia(km: number): string {
  return km === 0 ? "na cidade" : `a ${km} km`;
}
