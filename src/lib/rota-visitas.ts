// MELHOR ROTA DO DIA (03/11).
//
//   "Com a sugestão da melhor rota, com a opção de colocar a cidade de origem."
//
// Regra pura (sem banco, sem rede): a tela de Visitas passa a cidade de onde
// ele sai e as visitas do dia com coordenada; isto devolve a ordem que anda
// menos e o link do Google Maps com essa ordem — o Maps calcula a estrada de
// verdade, de graça, no celular dele.
//
// A distância daqui é em LINHA RETA (não há serviço de rotas grátis à mão no
// servidor). Serve para COMPARAR ordens, não para prometer quilometragem: a
// tela diz "em linha reta".

export type Ponto = { lat: number; lng: number };

const RAIO_TERRA_KM = 6371;

/** Distância em linha reta (haversine), em km. */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Km de um trajeto: origem → pontos na ordem dada (→ origem, se voltar). */
export function kmDoTrajeto(origem: Ponto, pontos: Ponto[], ordem: number[], voltar: boolean): number {
  let km = 0;
  let atual = origem;
  for (const i of ordem) { km += distanciaKm(atual, pontos[i]); atual = pontos[i]; }
  if (voltar && ordem.length) km += distanciaKm(atual, origem);
  return km;
}

// Até 8 paradas dá para testar TODAS as ordens (8! = 40.320, instantâneo).
// Acima disso, vizinho mais próximo + 2-opt: não garante a melhor, mas chega
// perto — e ninguém faz 9 visitas num dia na rua.
const LIMITE_EXATO = 8;

function permutacoes(n: number, visitar: (p: number[]) => void): void {
  const p = Array.from({ length: n }, (_, i) => i);
  const c = new Array(n).fill(0);
  visitar(p.slice());
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      const j = i % 2 === 0 ? 0 : c[i];
      [p[j], p[i]] = [p[i], p[j]];
      visitar(p.slice());
      c[i]++; i = 0;
    } else { c[i] = 0; i++; }
  }
}

function vizinhoMaisProximo(origem: Ponto, pontos: Ponto[]): number[] {
  const resta = new Set(pontos.map((_, i) => i));
  const ordem: number[] = [];
  let atual = origem;
  while (resta.size) {
    let melhor = -1, dist = Infinity;
    for (const i of resta) { const d = distanciaKm(atual, pontos[i]); if (d < dist) { dist = d; melhor = i; } }
    ordem.push(melhor); resta.delete(melhor); atual = pontos[melhor];
  }
  return ordem;
}

function doisOpt(origem: Ponto, pontos: Ponto[], ordem: number[], voltar: boolean): number[] {
  let melhor = ordem.slice();
  let km = kmDoTrajeto(origem, pontos, melhor, voltar);
  let melhorou = true;
  while (melhorou) {
    melhorou = false;
    for (let i = 0; i < melhor.length - 1; i++) {
      for (let k = i + 1; k < melhor.length; k++) {
        const nova = [...melhor.slice(0, i), ...melhor.slice(i, k + 1).reverse(), ...melhor.slice(k + 1)];
        const kmNova = kmDoTrajeto(origem, pontos, nova, voltar);
        if (kmNova < km - 1e-9) { melhor = nova; km = kmNova; melhorou = true; }
      }
    }
  }
  return melhor;
}

export type RotaSugerida = {
  /** Índices dos pontos na ordem sugerida. */
  ordem: number[];
  km: number;
  /** true quando testou todas as ordens (até 8 paradas). */
  exata: boolean;
};

/** A ordem que anda menos, saindo da origem (e voltando, se `voltar`). */
export function melhorRota(origem: Ponto, pontos: Ponto[], voltar: boolean): RotaSugerida {
  if (!pontos.length) return { ordem: [], km: 0, exata: true };
  if (pontos.length <= LIMITE_EXATO) {
    let melhor: number[] = [], km = Infinity;
    permutacoes(pontos.length, (p) => {
      const d = kmDoTrajeto(origem, pontos, p, voltar);
      // Empate: fica a primeira achada — a ordem dos horários vem primeiro,
      // então empate não embaralha a agenda à toa.
      if (d < km - 1e-9) { km = d; melhor = p; }
    });
    return { ordem: melhor, km, exata: true };
  }
  const ordem = doisOpt(origem, pontos, vizinhoMaisProximo(origem, pontos), voltar);
  return { ordem, km: kmDoTrajeto(origem, pontos, ordem, voltar), exata: false };
}

// O Google Maps aceita até 9 paradas intermediárias no link (fora a origem e o
// destino). Lista maior sai cortada — a tela avisa.
export const MAX_PARADAS_LINK = 9;

const coord = (p: Ponto) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

/**
 * Link "Abrir no Google Maps" com o trajeto na ordem dada. No celular abre o
 * app do Maps já com a rota de carro. null quando não há parada.
 */
export function linkGoogleMaps(origem: Ponto, paradas: Ponto[], voltar: boolean): string | null {
  if (!paradas.length) return null;
  const destino = voltar ? origem : paradas[paradas.length - 1];
  const meio = (voltar ? paradas : paradas.slice(0, -1)).slice(0, MAX_PARADAS_LINK);
  const q = new URLSearchParams({ api: "1", origin: coord(origem), destination: coord(destino), travelmode: "driving" });
  if (meio.length) q.set("waypoints", meio.map(coord).join("|"));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

/** Quantas paradas ficam de fora do link (0 quando cabem todas). */
export function paradasForaDoLink(paradas: number, voltar: boolean): number {
  const noMeio = voltar ? paradas : Math.max(0, paradas - 1);
  return Math.max(0, noMeio - MAX_PARADAS_LINK);
}

/** "123 km" — arredondado; a conta é em linha reta, precisão de metro seria mentira. */
export function kmPorExtenso(km: number): string {
  return `${Math.round(km).toLocaleString("pt-BR")} km`;
}
