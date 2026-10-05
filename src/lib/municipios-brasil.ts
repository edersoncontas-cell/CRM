// Os 5.570 municípios do Brasil, por UF, com a coordenada da sede e o código
// IBGE — base da área de atuação configurável (Configurações → Área de
// atuação). Gerado por scripts/gerar-municipios-brasil.py (fonte e licença lá).
//
// SÓ SERVIDOR: o JSON tem ~230 KB. A tela pede a lista de um estado por vez
// (listarMunicipiosDaUfAction), nunca importa este arquivo.

import dados from "@/lib/municipios-brasil.json";

export type MunicipioBR = { nome: string; lat: number; lng: number; ibge: number; uf: string };
export type EstadoBR = { uf: string; nome: string; lat: number; lng: number; codigo: number };

const BASE = dados as unknown as { estados: [string, string, number, number, number][]; municipios: Record<string, [string, number, number, number][]> };

export const ESTADOS_BR: EstadoBR[] = BASE.estados.map(([uf, nome, lat, lng, codigo]) => ({ uf, nome, lat, lng, codigo }));
const UFS = new Set(ESTADOS_BR.map((e) => e.uf));

export function ufValida(uf: string): boolean {
  return UFS.has(uf);
}

export function municipiosDaUf(uf: string): MunicipioBR[] {
  return (BASE.municipios[uf] ?? []).map(([nome, lat, lng, ibge]) => ({ nome, lat, lng, ibge, uf }));
}

export const normalizarNome = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").toLowerCase().trim();

const INDICE = new Map<string, MunicipioBR>();
for (const uf of Object.keys(BASE.municipios)) {
  for (const m of municipiosDaUf(uf)) INDICE.set(`${uf}:${normalizarNome(m.nome)}`, m);
}

/** O município pelo nome (sem ligar para acento/maiúscula) dentro de uma UF. */
export function acharMunicipio(uf: string, nome: string): MunicipioBR | null {
  return INDICE.get(`${uf}:${normalizarNome(nome)}`) ?? null;
}
