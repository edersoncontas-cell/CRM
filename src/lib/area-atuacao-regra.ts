// ÁREA DE ATUAÇÃO — o(s) estado(s) e os municípios que o vendedor atende,
// escolhidos em Configurações (05/10, pedido dele: "não somente o mapa, mas
// todo o sistema"; e o CRM vai ser vendido a vendedores de qualquer estado).
//
// Antes o CRM era inteiro do Espírito Santo, fixo no código (municipios-es.ts,
// prompts, PNCP com uf=ES, mapa enquadrado no ES). Agora tudo pergunta à área.
//
// O PADRÃO NÃO MEXE EM NADA: sem configuração gravada (ou com valor estranho),
// a área é a de sempre — ES, e quem atende/não atende continua sendo a marca
// foraDeArea de cada município no banco. Só depois que ele salva a área é que
// a lista dele passa a mandar (e a marca é sincronizada a partir dela).
//
// Regras puras (o cliente também usa); banco e base IBGE: lib/area-atuacao.ts.

export const CHAVE_AREA = "area.atuacao";
export const UF_PADRAO = "ES";
export const MAX_UFS = 6;

/**
 * POR ENQUANTO, SÓ O ESPÍRITO SANTO (05/10, decisão dele: "pode ser então só
 * ES"). O resto do CRM já sabe lidar com mais de um estado (base IBGE do
 * Brasil, mapa, licitações por UF, nome repetido entre estados), mas os textos
 * da IA ainda dizem "a cidade é do ES; outra é erro de leitura" — liberar outro
 * estado sem mexer neles faria a IA jogar fora toda cidade dele. Abrir outro
 * estado = pôr a UF aqui E trocar esses textos (docs/PRODUTO-CONFIGURACOES.md).
 */
export const UFS_LIBERADAS: readonly string[] = ["ES"];
export const MAX_MUNICIPIOS = 1500;

/** `crm`: nome com que o município está no CRM, quando difere do oficial
 *  (dois estados com cidade de mesmo nome: "Viana (MA)"). */
export type MunicipioEscolhido = { uf: string; nome: string; crm?: string };

export type AreaAtuacao = { ufs: string[]; municipios: MunicipioEscolhido[]; atualizadoEm: string | null };
/** configurada=false: nada foi salvo ainda — o CRM segue como sempre foi. */
export type AreaLida = AreaAtuacao & { configurada: boolean };

export const AREA_PADRAO: AreaLida = { ufs: [UF_PADRAO], municipios: [], atualizadoEm: null, configurada: false };

export const semAcento = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9() ]/g, " ").replace(/\s+/g, " ").toLowerCase().trim();

const ufOk = (v: unknown): v is string => typeof v === "string" && /^[A-Z]{2}$/.test(v);

/** Lê o que está gravado. Qualquer coisa estranha = área de sempre (nunca uma área vazia). */
export function lerAreaDoTexto(raw: string | null | undefined, ufValida: (uf: string) => boolean): AreaLida {
  if (!raw) return AREA_PADRAO;
  try {
    const p = JSON.parse(raw) as Partial<AreaAtuacao>;
    const ufs = Array.from(new Set((Array.isArray(p.ufs) ? p.ufs : []).filter((u): u is string => ufOk(u) && ufValida(u) && UFS_LIBERADAS.includes(u)))).slice(0, MAX_UFS);
    if (!ufs.length) return AREA_PADRAO;
    const municipios = (Array.isArray(p.municipios) ? p.municipios : [])
      .filter((m): m is MunicipioEscolhido => !!m && typeof m === "object" && ufOk((m as MunicipioEscolhido).uf) && ufs.includes((m as MunicipioEscolhido).uf) && typeof (m as MunicipioEscolhido).nome === "string" && !!(m as MunicipioEscolhido).nome.trim())
      .map((m) => ({ uf: m.uf, nome: m.nome.trim(), ...(typeof m.crm === "string" && m.crm.trim() && m.crm.trim() !== m.nome.trim() ? { crm: m.crm.trim() } : {}) }));
    if (!municipios.length) return AREA_PADRAO;
    return { ufs, municipios, atualizadoEm: typeof p.atualizadoEm === "string" ? p.atualizadoEm : null, configurada: true };
  } catch {
    return AREA_PADRAO;
  }
}

export type EntradaArea = { ufs: unknown; municipios: unknown };

/** O que a tela manda para salvar: confere contra a base do IBGE antes de qualquer gravação. */
export function validarEntradaArea(
  e: EntradaArea,
  existe: (uf: string, nome: string) => string | null,
  ufValida: (uf: string) => boolean,
): { ok: true; ufs: string[]; municipios: { uf: string; nome: string }[] } | { ok: false; erro: string } {
  const ufs = Array.from(new Set((Array.isArray(e.ufs) ? e.ufs : []).filter((u): u is string => ufOk(u) && ufValida(u))));
  if (!ufs.length) return { ok: false, erro: "Escolha pelo menos um estado." };
  const travados = ufs.filter((u) => !UFS_LIBERADAS.includes(u));
  if (travados.length) return { ok: false, erro: `Por enquanto a área de atuação é só do Espírito Santo (${travados.join(", ")} ainda não).` };
  if (ufs.length > MAX_UFS) return { ok: false, erro: `No máximo ${MAX_UFS} estados.` };
  const vistos = new Set<string>();
  const municipios: { uf: string; nome: string }[] = [];
  const naoAchados: string[] = [];
  for (const m of Array.isArray(e.municipios) ? e.municipios : []) {
    const uf = (m as { uf?: unknown })?.uf, nome = (m as { nome?: unknown })?.nome;
    if (!ufOk(uf) || typeof nome !== "string") continue;
    if (!ufs.includes(uf)) continue; // estado tirado da lista leva os municípios junto
    const oficial = existe(uf, nome);
    if (!oficial) { naoAchados.push(`${nome}/${uf}`); continue; }
    const k = `${uf}:${semAcento(oficial)}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    municipios.push({ uf, nome: oficial });
  }
  if (naoAchados.length) return { ok: false, erro: `Município não encontrado na lista do IBGE: ${naoAchados.slice(0, 3).join(", ")}.` };
  const semNenhum = ufs.filter((uf) => !municipios.some((m) => m.uf === uf));
  if (semNenhum.length) return { ok: false, erro: `Marque pelo menos um município de ${semNenhum.join(", ")} (ou tire o estado da lista).` };
  if (municipios.length > MAX_MUNICIPIOS) return { ok: false, erro: `No máximo ${MAX_MUNICIPIOS} municípios.` };
  return { ok: true, ufs, municipios };
}

// ── Sincronia com a tabela Municipio ────────────────────────────────────────
//
// Quem atende ou não continua sendo a marca foraDeArea do município — é ela que
// o envio "para todos", as licitações, o vínculo automático e a lista "Cidades
// que atendo / Fora da minha área" já leem. Salvar a área acerta essa marca.

export type LinhaMunicipio = { id: string; nome: string; lat: number | null; lng: number | null; foraDeArea: boolean };
export type Escolhido = { uf: string; nome: string; lat: number; lng: number };

export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Cidade com o mesmo nome a mais de 40 km é OUTRA cidade (Viana/ES × Viana/MA). */
const MESMA_CIDADE_KM = 40;

export type PlanoSincronia = {
  criar: { nome: string; lat: number; lng: number; uf: string }[];
  coordenadas: { id: string; lat: number; lng: number }[];
  passamParaDentro: string[]; // ids
  passamParaFora: string[];   // ids
  /** "Atendo" no CRM mas não é município da lista do IBGE (distrito, nome
   *  escrito diferente, "Cliente Cristiano"): ele não viu na lista, então
   *  ninguém mexe — fica como está e a tela diz quais são. */
  ficamComoEstao: string[];   // nomes
  nomesNoCrm: MunicipioEscolhido[];
};

/**
 * `ehMunicipioDaLista`: o nome é um município dos estados da área (base IBGE)?
 * Só esses podem passar para "fora" — é o que ele viu desmarcado na tela.
 */
export function planejarSincronia(
  linhas: LinhaMunicipio[], escolhidos: Escolhido[], ufPrincipal: string,
  ehMunicipioDaLista: (nome: string) => boolean = () => true,
): PlanoSincronia {
  const porNome = new Map<string, LinhaMunicipio>();
  for (const l of linhas) if (!porNome.has(semAcento(l.nome))) porNome.set(semAcento(l.nome), l);
  // Mesmo nome escolhido em dois estados: o do estado principal fica com o nome puro.
  const ordenados = [...escolhidos].sort((a, b) => Number(b.uf === ufPrincipal) - Number(a.uf === ufPrincipal));
  const nomesUsados = new Set<string>();
  const dentro = new Set<string>();
  const plano: PlanoSincronia = { criar: [], coordenadas: [], passamParaDentro: [], passamParaFora: [], ficamComoEstao: [], nomesNoCrm: [] };

  for (const m of ordenados) {
    let nomeCrm = m.nome;
    let linha = porNome.get(semAcento(m.nome)) ?? null;
    const outraCidade = linha && linha.lat != null && linha.lng != null && distanciaKm({ lat: linha.lat, lng: linha.lng }, m) > MESMA_CIDADE_KM;
    if (nomesUsados.has(semAcento(m.nome)) || outraCidade) {
      nomeCrm = `${m.nome} (${m.uf})`;
      linha = porNome.get(semAcento(nomeCrm)) ?? null;
    }
    nomesUsados.add(semAcento(nomeCrm));
    plano.nomesNoCrm.push({ uf: m.uf, nome: m.nome, ...(nomeCrm !== m.nome ? { crm: nomeCrm } : {}) });
    if (!linha) {
      plano.criar.push({ nome: nomeCrm, lat: m.lat, lng: m.lng, uf: m.uf });
      continue;
    }
    dentro.add(linha.id);
    if (linha.lat == null || linha.lng == null) plano.coordenadas.push({ id: linha.id, lat: m.lat, lng: m.lng });
    if (linha.foraDeArea) plano.passamParaDentro.push(linha.id);
  }
  for (const l of linhas) {
    if (dentro.has(l.id) || l.foraDeArea) continue;
    if (ehMunicipioDaLista(l.nome)) plano.passamParaFora.push(l.id);
    else plano.ficamComoEstao.push(l.nome);
  }
  return plano;
}

// ── Nome que o CRM aceita como município ────────────────────────────────────

export type EntradaValidador = { nome: string; crm: string };

/**
 * Devolve uma função que aceita só município da área (com o nome escrito como
 * o CRM escreve) e devolve null para o resto — inclusive "Recife" para um
 * vendedor do ES: foi assim que um cliente de Guaçuí apareceu como de Recife.
 * Aceita sufixo de estado ("Guaçuí - ES", "Viana/MA", "Castelo, Espírito Santo").
 */
export function criarValidadorMunicipio(entradas: EntradaValidador[], estados: { uf: string; nome: string }[]): (nome: unknown) => string | null {
  const indice = new Map<string, string>();
  for (const e of entradas) {
    if (!indice.has(semAcento(e.nome))) indice.set(semAcento(e.nome), e.crm);
    if (!indice.has(semAcento(e.crm))) indice.set(semAcento(e.crm), e.crm);
  }
  // Sufixo de estado no fim: "es", "(es)", "espirito santo". O nome mais longo primeiro.
  const sufixos = estados
    .flatMap((e) => [{ texto: semAcento(e.nome), uf: e.uf }, { texto: semAcento(e.uf), uf: e.uf }])
    .sort((a, b) => b.texto.length - a.texto.length)
    .map((x) => ({ ...x, re: new RegExp(`\\s\\(?${x.texto}\\)?$`) }));
  return (nome: unknown) => {
    if (typeof nome !== "string") return null;
    const chave = semAcento(nome); // "-", "," e "/" viram espaço
    if (!chave) return null;
    const direto = indice.get(chave);
    if (direto) return direto;
    for (const s of sufixos) {
      if (!s.re.test(chave)) continue;
      const base = chave.replace(s.re, "").trim();
      // "Viana - MA" com Viana do ES e do MA na área: o do MA está como "Viana (MA)".
      const achado = indice.get(`${base} (${s.uf.toLowerCase()})`) ?? indice.get(base);
      if (achado) return achado;
    }
    return null;
  };
}

// ── Enquadramento do mapa ───────────────────────────────────────────────────

export type Limites = [[number, number], [number, number]];
export type Enquadramento = { inicial: Limites; limites: Limites; centro: [number, number] };

/** O que os mapas (Dashboard e Visitas) recebem: enquadramento + estados para o contorno. */
export type MapaDaArea = Enquadramento & { estados: { uf: string; nome: string; codigo: number }[]; titulo: string };

/** Contorno de um estado (IBGE, gratuito, sem chave). */
export const urlContornoEstado = (codigo: number): string =>
  `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${codigo}?formato=application/vnd.geo+json&qualidade=minima`;

function caixa(pontos: { lat: number; lng: number }[]): Limites | null {
  if (!pontos.length) return null;
  let s = 90, n = -90, w = 180, e = -180;
  for (const p of pontos) { s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lng); e = Math.max(e, p.lng); }
  return [[s, w], [n, e]];
}
const folga = ([[s, w], [n, e]]: Limites, graus: number): Limites => [[s - graus, w - graus], [n + graus, e + graus]];

/**
 * `inicial`: o que a tela mostra ao abrir (as cidades que ele atende, com
 * folga). `limites`: até onde dá para arrastar (os estados inteiros, com folga).
 */
export function enquadrar(cidadesDoEstado: { lat: number; lng: number }[], atendidas: { lat: number; lng: number }[]): Enquadramento {
  const estado = caixa(cidadesDoEstado) ?? caixa(atendidas) ?? [[-21.3, -41.9], [-18.1, -39.7]];
  const area = caixa(atendidas) ?? estado;
  const inicial = folga(area, 0.25);
  const limites = folga(estado, 1.2);
  const centro: [number, number] = [(inicial[0][0] + inicial[1][0]) / 2, (inicial[0][1] + inicial[1][1]) / 2];
  return { inicial, limites, centro };
}

/** "Espírito Santo", "Espírito Santo e Minas Gerais", "ES, MG e RJ". */
export function nomeDaArea(ufs: string[], nomeDoEstado: (uf: string) => string): string {
  const nomes = ufs.map((u) => nomeDoEstado(u) || u);
  if (nomes.length <= 2) return nomes.join(" e ");
  return `${ufs.slice(0, -1).join(", ")} e ${ufs[ufs.length - 1]}`;
}

