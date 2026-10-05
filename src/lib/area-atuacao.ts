// Área de atuação — banco e base do IBGE. Regras puras: area-atuacao-regra.ts.
//
// Quem pergunta à área: o mapa do Dashboard e o de Visitas (enquadramento,
// contorno e coordenadas), as cidades sugeridas em Visitas, as cidades que a
// IA pode gravar (e se nascem "atendo" ou "fora da área"), a deduplicação de
// clientes, as licitações (PNCP por estado) e a agenda do Google. Quem
// atende/não atende é a marca foraDeArea, sincronizada ao salvar. Sem nada
// salvo, tudo continua como sempre (ES). Por enquanto, só o ES (UFS_LIBERADAS).

import { cache } from "react";
import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";
import { ESTADOS_BR, ufValida, municipiosDaUf, acharMunicipio, type MunicipioBR } from "@/lib/municipios-brasil";
import {
  CHAVE_AREA, AREA_PADRAO, lerAreaDoTexto, validarEntradaArea, planejarSincronia, criarValidadorMunicipio, enquadrar, nomeDaArea,
  semAcento,
  type AreaLida, type EntradaArea, type MapaDaArea,
} from "@/lib/area-atuacao-regra";

// React.cache só existe no servidor do Next; fora dele (testes que importam
// licitações, por exemplo) a leitura simplesmente não é memoizada.
const porRequisicao: typeof cache = typeof cache === "function" ? cache : (<T,>(f: T) => f) as typeof cache;

export const lerAreaAtuacao = porRequisicao(async (): Promise<AreaLida> => {
  const raw = await getConfig(CHAVE_AREA).catch(() => null);
  return lerAreaDoTexto(raw, ufValida);
});

export function nomeDoEstado(uf: string): string {
  return ESTADOS_BR.find((e) => e.uf === uf)?.nome ?? uf;
}

/** "Espírito Santo" / "Espírito Santo e Minas Gerais" — para títulos e textos da IA. */
export function nomeDaAreaLida(area: AreaLida): string {
  return nomeDaArea(area.ufs, nomeDoEstado);
}

/** Nome no CRM de cada município da área (o "Viana (MA)" quando há outro Viana). */
function nomesNoCrm(area: AreaLida): Map<string, string> {
  const m = new Map<string, string>();
  for (const x of area.municipios) m.set(`${x.uf}:${semAcento(x.nome)}`, x.crm ?? x.nome);
  return m;
}

/** Todos os municípios dos estados da área (base IBGE), com o nome que o CRM usa. */
export function municipiosDosEstados(area: AreaLida): (MunicipioBR & { crm: string })[] {
  const crm = nomesNoCrm(area);
  return area.ufs.flatMap((uf) => municipiosDaUf(uf).map((m) => ({ ...m, crm: crm.get(`${uf}:${semAcento(m.nome)}`) ?? m.nome })));
}

/** Os nomes dos municípios dos estados da área — para tirar a cidade do fim do nome de um contato. */
export async function nomesDosEstadosDaArea(): Promise<string[]> {
  return municipiosDosEstados(await lerAreaAtuacao()).map((m) => m.crm);
}

/**
 * Cidades para os campos de cidade (visita, agenda, cadastro sem sinal): as que
 * ele atende primeiro; depois o resto dos estados dele.
 */
export async function cidadesParaSugerir(): Promise<string[]> {
  const area = await lerAreaAtuacao();
  const todos = municipiosDosEstados(area).map((m) => m.crm);
  if (!area.configurada) return todos;
  const atende = area.municipios.map((m) => m.crm ?? m.nome);
  const set = new Set(atende);
  return [...atende, ...todos.filter((n) => !set.has(n))];
}

/** Valida o nome que veio da IA, de uma planilha ou do Google: só município dos estados da área. */
export async function validadorDaArea(): Promise<(nome: unknown) => string | null> {
  const area = await lerAreaAtuacao();
  const ordem = [...municipiosDosEstados(area)].sort((a, b) => Number(b.uf === area.ufs[0]) - Number(a.uf === area.ufs[0]));
  return criarValidadorMunicipio(ordem.map((m) => ({ nome: m.nome, crm: m.crm })), area.ufs.map((uf) => ({ uf, nome: nomeDoEstado(uf) })));
}

/** Coordenada da sede pela base do IBGE, nos estados da área (o principal primeiro). */
export function coordenadasNaArea(nome: string, area: AreaLida): { lat: number; lng: number } | null {
  const sufixo = nome.match(/^(.*)\s\(([A-Z]{2})\)$/);
  if (sufixo) {
    const m = acharMunicipio(sufixo[2], sufixo[1]);
    return m ? { lat: m.lat, lng: m.lng } : null;
  }
  for (const uf of area.ufs) {
    const m = acharMunicipio(uf, nome);
    if (m) return { lat: m.lat, lng: m.lng };
  }
  return null;
}

/** UF de um município do CRM (para "Castelo - ES" na agenda do Google). */
export function ufDoMunicipioNaArea(nome: string, area: AreaLida): string | null {
  const sufixo = nome.match(/\s\(([A-Z]{2})\)$/);
  if (sufixo) return sufixo[1];
  const escolhido = area.municipios.find((m) => semAcento(m.crm ?? m.nome) === semAcento(nome));
  if (escolhido) return escolhido.uf;
  for (const uf of area.ufs) if (acharMunicipio(uf, nome)) return uf;
  return null;
}

export type { MapaDaArea };

/** O mapa de sempre (o estado padrão inteiro) — quando nem a área nem o banco respondem. */
export function mapaPadrao(): MapaDaArea {
  const uf = AREA_PADRAO.ufs[0];
  return {
    ...enquadrar(municipiosDaUf(uf), []),
    estados: [{ uf, nome: nomeDoEstado(uf), codigo: ESTADOS_BR.find((e) => e.uf === uf)?.codigo ?? 0 }],
    titulo: nomeDoEstado(uf),
  };
}

/** Enquadramento e contorno dos mapas (Dashboard e Visitas). Nunca falha: cai no mapa de sempre. */
export async function mapaDaAreaOuPadrao(): Promise<MapaDaArea> {
  return mapaDaArea().catch(() => mapaPadrao());
}

/** Enquadramento e contorno dos mapas (Dashboard e Visitas). */
export async function mapaDaArea(): Promise<MapaDaArea> {
  const area = await lerAreaAtuacao();
  const doEstado = area.ufs.flatMap((uf) => municipiosDaUf(uf));
  let atendidas: { lat: number; lng: number }[] = [];
  if (area.configurada) {
    atendidas = area.municipios.map((m) => acharMunicipio(m.uf, m.nome)).filter((m): m is MunicipioBR => !!m);
  } else {
    // Sem área salva: as cidades que hoje estão como "atendo" no banco.
    const linhas = await db.municipio.findMany({ where: { foraDeArea: false }, select: { nome: true, lat: true, lng: true } }).catch(() => []);
    atendidas = linhas
      .map((l) => (l.lat != null && l.lng != null ? { lat: l.lat, lng: l.lng } : coordenadasNaArea(l.nome, area)))
      .filter((p): p is { lat: number; lng: number } => !!p);
  }
  return {
    ...enquadrar(doEstado, atendidas),
    estados: area.ufs.map((uf) => ({ uf, nome: nomeDoEstado(uf), codigo: ESTADOS_BR.find((e) => e.uf === uf)?.codigo ?? 0 })).filter((e) => e.codigo),
    titulo: nomeDaAreaLida(area),
  };
}

/**
 * Acha (ou cria, com coordenada) o município do CRM para um nome que veio de
 * fora — IA, conversa, planilha. Só aceita município dos estados da área.
 * Criado fora da lista que ele atende nasce "fora da área" (não entra no envio
 * para todos); sem área salva, nasce como sempre nasceu.
 */
export async function municipioDaArea(nomeBruto: unknown): Promise<{ id: string; nome: string } | null> {
  const validar = await validadorDaArea();
  const oficial = validar(nomeBruto);
  if (!oficial) return null;
  const area = await lerAreaAtuacao();
  const todos = await db.municipio.findMany({ select: { id: true, nome: true } });
  const achado = todos.find((m) => semAcento(m.nome) === semAcento(oficial));
  if (achado) return achado;
  const coord = coordenadasNaArea(oficial, area);
  const atende = !area.configurada || area.municipios.some((m) => semAcento(m.crm ?? m.nome) === semAcento(oficial));
  return db.municipio.create({
    // A região (Caparaó, Granito…) fica a de sempre: padrão do schema, e as
    // do ES são reagrupadas por lib/regioes.ts.
    data: { nome: oficial, lat: coord?.lat ?? null, lng: coord?.lng ?? null, foraDeArea: !atende },
    select: { id: true, nome: true },
  });
}

/** O nome é um município (base IBGE) destes estados? Aceita o "Viana (MA)". */
function ehMunicipioDosEstados(ufs: string[]): (nome: string) => boolean {
  const conhecidos = new Set<string>();
  for (const uf of ufs) for (const m of municipiosDaUf(uf)) {
    conhecidos.add(semAcento(m.nome));
    conhecidos.add(semAcento(`${m.nome} (${uf})`));
  }
  return (nome) => conhecidos.has(semAcento(nome));
}

// ── Salvar ──────────────────────────────────────────────────────────────────

export type ResumoArea = {
  estados: string[];
  atende: number;
  novas: number;
  passaramParaFora: number;
  voltaramParaDentro: number;
  clientesForaAgora: number;
  ficaramComoEstavam: string[]; // "atendo" que não é município do IBGE — ninguém mexeu
};

export async function salvarAreaAtuacao(e: EntradaArea): Promise<{ ok: true; resumo: ResumoArea } | { ok: false; erro: string }> {
  const v = validarEntradaArea(e, (uf, nome) => acharMunicipio(uf, nome)?.nome ?? null, ufValida);
  if (!v.ok) return v;
  const escolhidos = v.municipios.map((m) => {
    const b = acharMunicipio(m.uf, m.nome)!;
    return { uf: m.uf, nome: b.nome, lat: b.lat, lng: b.lng };
  });

  const linhas = await db.municipio.findMany({ select: { id: true, nome: true, lat: true, lng: true, foraDeArea: true } });
  const plano = planejarSincronia(linhas, escolhidos, v.ufs[0], ehMunicipioDosEstados(v.ufs));

  await db.$transaction(async (tx) => {
    // Um estado inteiro pode ter 800+ cidades: uma só ida ao banco.
    if (plano.criar.length) {
      await tx.municipio.createMany({
        data: plano.criar.map((c) => ({ nome: c.nome, lat: c.lat, lng: c.lng, foraDeArea: false })),
        skipDuplicates: true,
      });
    }
    for (const c of plano.coordenadas) await tx.municipio.update({ where: { id: c.id }, data: { lat: c.lat, lng: c.lng } });
    if (plano.passamParaDentro.length) await tx.municipio.updateMany({ where: { id: { in: plano.passamParaDentro } }, data: { foraDeArea: false } });
    if (plano.passamParaFora.length) await tx.municipio.updateMany({ where: { id: { in: plano.passamParaFora } }, data: { foraDeArea: true } });
    await tx.configuracao.upsert({
      where: { chave: CHAVE_AREA },
      create: { chave: CHAVE_AREA, valor: JSON.stringify({ ufs: v.ufs, municipios: plano.nomesNoCrm, atualizadoEm: new Date().toISOString() }) },
      update: { valor: JSON.stringify({ ufs: v.ufs, municipios: plano.nomesNoCrm, atualizadoEm: new Date().toISOString() }) },
    });
  }, { timeout: 30_000 });

  const clientesForaAgora = plano.passamParaFora.length
    ? await db.cliente.count({ where: { municipioId: { in: plano.passamParaFora } } }).catch(() => 0)
    : 0;

  return {
    ok: true,
    resumo: {
      estados: v.ufs, atende: escolhidos.length, novas: plano.criar.length,
      passaramParaFora: plano.passamParaFora.length, voltaramParaDentro: plano.passamParaDentro.length,
      clientesForaAgora, ficaramComoEstavam: plano.ficamComoEstao,
    },
  };
}

/** O que a tela de Configurações precisa para abrir já com o que vale hoje. */
export async function estadoInicialDaArea(): Promise<{ configurada: boolean; ufs: string[]; marcados: { uf: string; nome: string }[]; listas: Record<string, string[]>; atualizadoEm: string | null; foraDaLista: string[] }> {
  const area = await lerAreaAtuacao();
  // "Atendo" no CRM que não é município do IBGE: salvar não mexe neles, e a
  // tela mostra quais são (senão ele não saberia por que não estão na lista).
  const ehDaLista = ehMunicipioDosEstados(area.ufs);
  const atendoHoje = await db.municipio.findMany({ where: { foraDeArea: false }, select: { nome: true } }).catch(() => []);
  const foraDaLista = atendoHoje.map((l) => l.nome).filter((n) => !ehDaLista(n)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  let marcados = area.municipios.map((m) => ({ uf: m.uf, nome: m.nome }));
  if (!area.configurada) {
    // Sem nada salvo: abre marcando o que hoje está como "atendo" no banco.
    marcados = atendoHoje
      .map((l) => acharMunicipio(area.ufs[0], l.nome))
      .filter((m): m is MunicipioBR => !!m)
      .map((m) => ({ uf: m.uf, nome: m.nome }));
  }
  const listas = Object.fromEntries(area.ufs.map((uf) => [uf, municipiosDaUf(uf).map((m) => m.nome)]));
  return { configurada: area.configurada, ufs: area.ufs, marcados, listas, atualizadoEm: area.atualizadoEm, foraDaLista };
}

