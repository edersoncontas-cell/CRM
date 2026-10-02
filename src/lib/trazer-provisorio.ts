// A VOLTA DO BANCO PROVISÓRIO PARA O PRINCIPAL.
//
// Lê o banco provisório (DATABASE_URL_PROVISORIO) e SOMA o que ele tem ao
// banco em uso (o principal). As regras de "é o mesmo registro?" e de "o que
// nunca pode vir" estão em lib/trazer-provisorio-regra.ts.
//
// Como funciona, tabela por tabela, pais antes dos filhos:
//   1. lê do provisório só as colunas que identificam cada linha;
//   2. o que já está no principal com o mesmo id foi trazido antes — pula;
//   3. o que casa com um registro do principal (mesmo cliente, mesma conversa,
//      mesma cidade…) não entra: o id do provisório passa a apontar para o do
//      principal, e os filhos (negociações, mensagens…) vão para ele;
//   4. o resto entra com o MESMO id. Por isso rodar de novo não duplica nada,
//      e uma rodada que parou no meio continua de onde parou.
//
// Três tabelas não vêm: são o histórico de operações feitas NO provisório
// (unificação de duplicados, limpeza e os redirecionamentos delas). Os ids
// guardados nelas são do provisório — um "desfazer" rodado no principal
// mexeria nos cadastros errados.

import { PrismaClient } from "@prisma/client";
import { ehFalhaDeConexao } from "@/lib/falha-conexao";
import { completarColunas } from "@/lib/coluna-que-falta";
import { CHAVE_INSTANCIA_ATIVA, instanciaQueVemNaVolta } from "@/lib/whatsapp-instancia-nome";
import {
  type Linha, chavesDoClienteNoProvisorio, indiceDeClientes, completarCliente,
  chavesDaConversa, completarConversa, tratarConversaNova, chaveDaMensagem, tratarMensagem,
  tratarEnvio, configPodeVir, juntarHistoricoFrase, CHAVE_HISTORICO_FRASE,
} from "@/lib/trazer-provisorio-regra";

export type Sql = Pick<PrismaClient, "$queryRawUnsafe" | "$executeRawUnsafe">;

type Pai = {
  tabela: string;
  // Há chave estrangeira de verdade no banco: o pai TEM de existir no
  // principal, senão o INSERT falha. Sem ela, só troca o id.
  fk?: boolean;
  // Pai que não existe: a coluna fica vazia em vez de a linha ficar de fora.
  anulavel?: boolean;
  // Aponta para a própria tabela (indicado por): entra vazia e é preenchida
  // depois que todas as linhas novas estão lá.
  depois?: boolean;
};

export type Etapa = {
  tabela: string;
  rotulo: string;
  pk?: string;
  pais?: Record<string, Pai>;
  // Colunas que a chave (ou o completar) precisa, além do pk e dos pais.
  campos?: string[];
  chaves?: (l: Linha) => string[];
  indice?: (principal: Linha[]) => Map<string, string>;
  // Duas linhas do PRÓPRIO provisório com a mesma chave viram uma só. Vale
  // para chave que é única de verdade (cidade, máquina, conversa); não vale
  // para cliente (nome igual com números diferentes são pessoas diferentes).
  dedupInterno?: boolean;
  completar?: (principal: Linha, provisorio: Linha) => Linha;
  tratar?: (l: Linha) => Linha;
  soSeVazio?: boolean;
  lote?: number;
};

export const TABELAS_QUE_NAO_VEM = ["UnificacaoClientes", "LimpezaClientes", "ClienteRedirecionamento"] as const;

const baixo = (v: unknown) => String(v ?? "").trim().toLowerCase();
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? ""));
const CLIENTE: Pai = { tabela: "Cliente", fk: true };

export const ETAPAS: Etapa[] = [
  { tabela: "Municipio", rotulo: "Cidades", campos: ["nome"], chaves: (l) => [`n:${baixo(l.nome)}`] },
  { tabela: "Maquina", rotulo: "Máquinas (fichas)", campos: ["marca", "modelo"], chaves: (l) => [`${baixo(l.marca)}|${baixo(l.modelo)}`] },
  {
    tabela: "NotaMaquina", rotulo: "Notas das máquinas",
    pais: { maquinaId: { tabela: "Maquina", fk: true }, concorrenteId: { tabela: "Maquina" } },
    campos: ["texto"], chaves: (l) => [`${l.maquinaId}|${l.concorrenteId ?? ""}|${l.texto}`],
  },
  { tabela: "ColunaFunil", rotulo: "Colunas do funil", campos: ["titulo"], chaves: (l) => [`t:${baixo(l.titulo)}`] },
  { tabela: "RespostaPronta", rotulo: "Respostas prontas", campos: ["titulo", "texto"], chaves: (l) => [`${l.titulo}|${l.texto}`] },
  { tabela: "EstiloDeFala", rotulo: "Estilo de fala", soSeVazio: true },
  { tabela: "EstrategiaVenda", rotulo: "Estratégias de venda", campos: ["titulo"], chaves: (l) => [`t:${baixo(l.titulo)}`] },
  {
    tabela: "MaquinaUsada", rotulo: "Máquinas usadas (estoque)", campos: ["marca", "modelo", "ano", "horimetro", "preco"],
    chaves: (l) => [`${baixo(l.marca)}|${baixo(l.modelo)}|${l.ano ?? ""}|${l.horimetro ?? ""}|${l.preco ?? ""}`],
  },
  { tabela: "WhatsAppSettings", rotulo: "Ajustes do WhatsApp", soSeVazio: true },
  {
    tabela: "ContatoBloqueado", rotulo: "Contatos bloqueados", campos: ["telefone", "chaveNome", "googleContatoId"],
    chaves: (l) => [l.telefone && `t:${l.telefone}`, l.chaveNome && `k:${l.chaveNome}`, l.googleContatoId && `g:${l.googleContatoId}`].filter(Boolean) as string[],
  },
  { tabela: "ConversaExcluida", rotulo: "Conversas excluídas", pk: "telefone" },
  {
    tabela: "Cliente", rotulo: "Clientes",
    pais: { municipioId: { tabela: "Municipio", fk: true, anulavel: true }, indicadoPorId: { tabela: "Cliente", fk: true, anulavel: true, depois: true } },
    campos: ["nome", "telefone", "googleContatoId"],
    chaves: chavesDoClienteNoProvisorio, indice: indiceDeClientes, dedupInterno: false,
    completar: completarCliente,
  },
  { tabela: "ClienteMaquina", rotulo: "Frota dos clientes", pais: { clienteId: CLIENTE }, campos: ["marca", "modelo"], chaves: (l) => [`${l.clienteId}|${baixo(l.marca)}|${baixo(l.modelo)}`] },
  { tabela: "Cadencia", rotulo: "Cadências", pais: { clienteId: CLIENTE }, campos: ["tipo", "iniciadaEm"], chaves: (l) => [`${l.clienteId}|${l.tipo}|${iso(l.iniciadaEm)}`] },
  { tabela: "PosVendaContato", rotulo: "Pós-venda", pais: { clienteId: CLIENTE }, campos: ["tipo", "data", "nota"], chaves: (l) => [`${l.clienteId}|${l.tipo}|${iso(l.data)}|${l.nota ?? ""}`] },
  { tabela: "NotaContextoCliente", rotulo: "Notas dos clientes", pais: { clienteId: CLIENTE }, campos: ["texto"], chaves: (l) => [`${l.clienteId}|${l.texto}`] },
  { tabela: "Alerta", rotulo: "Alertas", pais: { clienteId: CLIENTE }, campos: ["tipo", "mensagem"], chaves: (l) => [`${l.clienteId}|${l.tipo}|${l.mensagem}`] },
  { tabela: "AlertaOculto", rotulo: "Alertas ocultos", pais: { clienteId: { tabela: "Cliente" } }, campos: ["chave"], chaves: (l) => [`k:${l.chave}`] },
  {
    tabela: "OrientadorAnalise", rotulo: "Leituras do Orientador", pais: { clienteId: CLIENTE },
    chaves: (l) => [`c:${l.clienteId}`],
    // Uma leitura por cliente: fica a mais recente.
    completar: (p, v) => {
      const tp = p.atualizadoEm instanceof Date ? p.atualizadoEm.getTime() : 0;
      const tv = v.atualizadoEm instanceof Date ? v.atualizadoEm.getTime() : 0;
      if (tv <= tp) return {};
      const { id: _id, clienteId: _c, ...resto } = v;
      return resto;
    },
  },
  {
    tabela: "Visita", rotulo: "Visitas", pais: { clienteId: CLIENTE }, campos: ["data", "googleEventId"],
    chaves: (l) => [`${l.clienteId}|${iso(l.data)}`, ...(l.googleEventId ? [`g:${l.googleEventId}`] : [])],
  },
  { tabela: "Negociacao", rotulo: "Negociações", pais: { clienteId: CLIENTE, usadaEstoqueId: { tabela: "MaquinaUsada" } } },
  { tabela: "Proposta", rotulo: "Propostas", pais: { negociacaoId: { tabela: "Negociacao", fk: true } }, chaves: (l) => [`n:${l.negociacaoId}`] },
  {
    tabela: "TarefaKanban", rotulo: "Tarefas", pais: { clienteId: { tabela: "Cliente", fk: true, anulavel: true } },
    campos: ["chave"], chaves: (l) => (l.chave ? [`k:${l.chave}`] : []),
  },
  {
    tabela: "WhatsAppConversation", rotulo: "Conversas do WhatsApp", pais: { clienteId: { tabela: "Cliente" } },
    campos: ["externalPhone", "isGroup"], chaves: chavesDaConversa,
    completar: completarConversa, tratar: tratarConversaNova,
  },
  // As mensagens têm caminho próprio (ver etapaMensagens): o principal pode
  // ter dezenas de milhares, e só as das conversas envolvidas interessam.
  { tabela: "WhatsAppMessage", rotulo: "Mensagens do WhatsApp", pais: { conversationId: { tabela: "WhatsAppConversation", fk: true } }, tratar: tratarMensagem, lote: 300 },
  { tabela: "MidiaEnvio", rotulo: "Imagens dos envios", lote: 5 },
  { tabela: "EnvioProgramado", rotulo: "Envios em massa", pais: { clienteIds: { tabela: "Cliente" } }, tratar: tratarEnvio },
  { tabela: "Evento", rotulo: "Eventos da agenda", campos: ["titulo", "inicio"], chaves: (l) => [`${l.titulo}|${iso(l.inicio)}`] },
  { tabela: "AuditLog", rotulo: "Auditoria", pais: { clienteId: { tabela: "Cliente" } } },
  { tabela: "ZeusEvent", rotulo: "Eventos do ZEUS" },
  { tabela: "CerebroSession", rotulo: "Conversas com o Cérebro" },
  { tabela: "CerebroMessage", rotulo: "Mensagens do Cérebro", pais: { sessionId: { tabela: "CerebroSession", fk: true } } },
  { tabela: "RelatorioDiario", rotulo: "Relatórios diários", campos: ["dia"], chaves: (l) => [`d:${iso(l.dia)}`] },
  { tabela: "IdeiaInovacao", rotulo: "Ideias" },
  { tabela: "PostMarketing", rotulo: "Posts de marketing", lote: 10 },
  { tabela: "MemoriaCerebro", rotulo: "Memória do Cérebro" },
];

export type ResultadoEtapa = {
  tabela: string;
  rotulo: string;
  noProvisorio: number;
  jaTrazidas: number;      // mesmo id já está no principal (rodada anterior)
  jaExistiam: number;      // casaram com um registro do principal
  novas: number;           // entram (ou entraram) no principal
  gravadas: number;        // de fato inseridas nesta rodada
  atualizadas: number;     // registros do principal completados
  deixadasDeFora: number;  // filho sem o pai no principal
  observacao?: string;
  erro?: string;
};

export type ResultadoVolta = { concluido: boolean; proxima: number; etapas: ResultadoEtapa[] };

type Ctx = { origem: Sql; destino: Sql; mapas: Map<string, Map<string, string>>; colunas: Map<string, string[]> };

const q = (nome: string) => `"${nome.replace(/"/g, '""')}"`;

async function existeTabela(sql: Sql, tabela: string): Promise<boolean> {
  const r = await sql.$queryRawUnsafe<{ t: string | null }[]>(`SELECT to_regclass($1)::text AS t`, `public.${q(tabela)}`);
  return !!r[0]?.t;
}

async function colunasDe(ctx: Ctx, lado: "o" | "d", tabela: string): Promise<string[]> {
  const k = `${lado}:${tabela}`;
  const guardado = ctx.colunas.get(k);
  if (guardado) return guardado;
  const sql = lado === "o" ? ctx.origem : ctx.destino;
  const r = await sql.$queryRawUnsafe<{ c: string }[]>(
    `SELECT column_name AS c FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    tabela,
  );
  const cols = r.map((x) => x.c);
  ctx.colunas.set(k, cols);
  return cols;
}

async function lerColunas(sql: Sql, tabela: string, cols: string[]): Promise<Linha[]> {
  return sql.$queryRawUnsafe<Linha[]>(`SELECT ${cols.map(q).join(", ")} FROM ${q(tabela)}`);
}

async function lerPorIds(sql: Sql, tabela: string, pk: string, ids: string[]): Promise<Linha[]> {
  if (!ids.length) return [];
  return sql.$queryRawUnsafe<Linha[]>(`SELECT * FROM ${q(tabela)} WHERE ${q(pk)} = ANY($1::text[])`, ids);
}

async function idsQueExistem(sql: Sql, tabela: string, pk: string, ids: string[]): Promise<Set<string>> {
  const achados = new Set<string>();
  for (let i = 0; i < ids.length; i += 5000) {
    const parte = ids.slice(i, i + 5000);
    const r = await sql.$queryRawUnsafe<{ k: string }[]>(`SELECT ${q(pk)}::text AS k FROM ${q(tabela)} WHERE ${q(pk)} = ANY($1::text[])`, parte);
    for (const x of r) achados.add(x.k);
  }
  return achados;
}

async function inserir(sql: Sql, tabela: string, linhas: Linha[], cols: string[]): Promise<number> {
  if (!linhas.length) return 0;
  const lista = cols.map(q).join(", ");
  return sql.$executeRawUnsafe(
    `INSERT INTO ${q(tabela)} (${lista}) SELECT ${lista} FROM json_populate_recordset(NULL::${q(tabela)}, $1::json) ON CONFLICT DO NOTHING`,
    JSON.stringify(linhas),
  );
}

async function atualizar(sql: Sql, tabela: string, pk: string, id: string, patch: Linha, cols: string[]): Promise<number> {
  const campos = Object.keys(patch).filter((c) => c !== pk && cols.includes(c));
  if (!campos.length) return 0;
  const sets = campos.map((c) => `${q(c)} = j.${q(c)}`).join(", ");
  return sql.$executeRawUnsafe(
    `UPDATE ${q(tabela)} AS t SET ${sets} FROM json_populate_record(NULL::${q(tabela)}, $1::json) AS j WHERE t.${q(pk)} = $2`,
    JSON.stringify(patch), id,
  );
}

function mapear(ctx: Ctx, tabela: string, valor: unknown): unknown {
  const mapa = ctx.mapas.get(tabela);
  if (Array.isArray(valor)) return valor.map((v) => (typeof v === "string" ? mapa?.get(v) ?? v : v));
  if (typeof valor !== "string") return valor;
  return mapa?.get(valor) ?? valor;
}

function remapear(ctx: Ctx, etapa: Etapa, l: Linha): Linha {
  if (!etapa.pais) return l;
  const out = { ...l };
  for (const [col, pai] of Object.entries(etapa.pais)) if (col in out) out[col] = mapear(ctx, pai.tabela, out[col]);
  return out;
}

// Índice chave → id no principal. Chave repetida no principal é ambígua e
// não serve para casar.
function indiceGenerico(linhas: Linha[], chaves: (l: Linha) => string[], pk: string): Map<string, string> {
  const vistos = new Map<string, string | null>();
  for (const l of linhas) {
    const id = String(l[pk]);
    for (const k of chaves(l)) {
      const atual = vistos.get(k);
      if (atual === undefined) vistos.set(k, id);
      else if (atual !== id) vistos.set(k, null);
    }
  }
  const indice = new Map<string, string>();
  for (const [k, id] of vistos) if (id) indice.set(k, id);
  return indice;
}

// Filhos cujo pai (com chave estrangeira) não está no principal: a coluna fica
// vazia (quando pode) ou a linha fica de fora. Sem isso, um único filho órfão
// derrubaria o lote inteiro.
async function cuidarDosOrfaos(ctx: Ctx, etapa: Etapa, linhas: Linha[]): Promise<{ linhas: Linha[]; foraDeFora: number }> {
  let fora = 0;
  let atuais = linhas;
  for (const [col, pai] of Object.entries(etapa.pais ?? {})) {
    if (!pai.fk || pai.depois) continue;
    const ids = [...new Set(atuais.map((l) => l[col]).filter((v): v is string => typeof v === "string"))];
    const existem = await idsQueExistem(ctx.destino, pai.tabela, "id", ids);
    atuais = atuais.flatMap((l) => {
      const v = l[col];
      if (typeof v !== "string" || existem.has(v)) return [l];
      if (pai.anulavel) return [{ ...l, [col]: null }];
      fora++;
      return [];
    });
  }
  return { linhas: atuais, foraDeFora: fora };
}

async function etapaGenerica(ctx: Ctx, etapa: Etapa, aplicar: boolean): Promise<ResultadoEtapa> {
  const pk = etapa.pk ?? "id";
  const r: ResultadoEtapa = { tabela: etapa.tabela, rotulo: etapa.rotulo, noProvisorio: 0, jaTrazidas: 0, jaExistiam: 0, novas: 0, gravadas: 0, atualizadas: 0, deixadasDeFora: 0 };
  if (!(await existeTabela(ctx.origem, etapa.tabela))) return { ...r, observacao: "não existe no provisório" };
  if (!(await existeTabela(ctx.destino, etapa.tabela))) return { ...r, erro: "a tabela não existe no principal" };

  const colsO = await colunasDe(ctx, "o", etapa.tabela);
  const colsD = await colunasDe(ctx, "d", etapa.tabela);
  const comuns = colsO.filter((c) => colsD.includes(c));
  const paiCols = Object.keys(etapa.pais ?? {});
  const camposO = [...new Set([pk, ...paiCols, ...(etapa.campos ?? [])])].filter((c) => colsO.includes(c));

  const linhasO = (await lerColunas(ctx.origem, etapa.tabela, camposO)).map((l) => remapear(ctx, etapa, l));
  r.noProvisorio = linhasO.length;
  const jaNoPrincipal = await idsQueExistem(ctx.destino, etapa.tabela, pk, linhasO.map((l) => String(l[pk])));
  const pendentes = linhasO.filter((l) => !jaNoPrincipal.has(String(l[pk])));
  r.jaTrazidas = linhasO.length - pendentes.length;

  const mapa = new Map<string, string>();
  const casados: { de: string; para: string }[] = [];
  let novas: Linha[] = [];

  if (etapa.soSeVazio) {
    const temAlgo = await ctx.destino.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM ${q(etapa.tabela)}`);
    if ((temAlgo[0]?.n ?? 0) > 0) {
      r.jaExistiam = pendentes.length;
      r.observacao = "o principal já tem o dele — fica o do principal";
    } else novas = pendentes;
  } else if (etapa.chaves) {
    const camposD = [...new Set([pk, ...paiCols, ...(etapa.campos ?? [])])].filter((c) => colsD.includes(c));
    const linhasD = await lerColunas(ctx.destino, etapa.tabela, camposD);
    const indice = etapa.indice ? etapa.indice(linhasD) : indiceGenerico(linhasD, etapa.chaves, pk);
    const internos = new Map<string, string>();
    for (const l of pendentes) {
      const id = String(l[pk]);
      const ks = etapa.chaves(l);
      const noPrincipal = ks.map((k) => indice.get(k)).find(Boolean);
      if (noPrincipal) {
        mapa.set(id, noPrincipal);
        casados.push({ de: id, para: noPrincipal });
        continue;
      }
      const repetido = etapa.dedupInterno === false ? undefined : ks.map((k) => internos.get(k)).find(Boolean);
      if (repetido) {
        mapa.set(id, repetido);
        r.jaExistiam++;
        continue;
      }
      novas.push(l);
      for (const k of ks) if (!internos.has(k)) internos.set(k, id);
    }
  } else novas = pendentes;

  ctx.mapas.set(etapa.tabela, mapa);
  r.jaExistiam += casados.length;
  r.novas = novas.length;
  if (!aplicar) return r;

  // Linhas novas: com o mesmo id, pais já trocados, e tratadas.
  const lote = etapa.lote ?? 200;
  const depois: { id: string; col: string; valor: string }[] = [];
  for (let i = 0; i < novas.length; i += lote) {
    const ids = novas.slice(i, i + lote).map((l) => String(l[pk]));
    let cheias = (await lerPorIds(ctx.origem, etapa.tabela, pk, ids)).map((l) => remapear(ctx, etapa, l));
    for (const [col, pai] of Object.entries(etapa.pais ?? {})) {
      if (!pai.depois) continue;
      cheias = cheias.map((l) => {
        if (typeof l[col] === "string") depois.push({ id: String(l[pk]), col, valor: l[col] as string });
        return { ...l, [col]: null };
      });
    }
    const { linhas, foraDeFora } = await cuidarDosOrfaos(ctx, etapa, cheias);
    r.deixadasDeFora += foraDeFora;
    const tratadas = etapa.tratar ? linhas.map(etapa.tratar) : linhas;
    r.gravadas += await inserir(ctx.destino, etapa.tabela, tratadas, comuns);
  }
  // Auto-referência (quem indicou quem): agora que todos estão lá.
  if (depois.length) {
    const alvos = await idsQueExistem(ctx.destino, etapa.tabela, pk, depois.map((d) => d.valor));
    for (const d of depois) if (alvos.has(d.valor)) await atualizar(ctx.destino, etapa.tabela, pk, d.id, { [d.col]: d.valor }, colsD);
  }

  // Registros do principal que casaram: completa o que faltava.
  if (etapa.completar && casados.length) {
    for (let i = 0; i < casados.length; i += 200) {
      const parte = casados.slice(i, i + 200);
      const [doProvisorio, doPrincipal] = await Promise.all([
        lerPorIds(ctx.origem, etapa.tabela, pk, parte.map((c) => c.de)),
        lerPorIds(ctx.destino, etapa.tabela, pk, parte.map((c) => c.para)),
      ]);
      const porIdO = new Map(doProvisorio.map((l) => [String(l[pk]), remapear(ctx, etapa, l)]));
      const porIdD = new Map(doPrincipal.map((l) => [String(l[pk]), l]));
      for (const c of parte) {
        const o = porIdO.get(c.de), d = porIdD.get(c.para);
        if (!o || !d) continue;
        let patch = etapa.completar(d, o);
        // Pai do patch que não existe no principal não entra.
        for (const [col, pai] of Object.entries(etapa.pais ?? {})) {
          if (pai.fk && typeof patch[col] === "string") {
            const existe = await idsQueExistem(ctx.destino, pai.tabela, "id", [patch[col] as string]);
            if (!existe.size) {
              const { [col]: _fora, ...resto } = patch;
              patch = resto;
            }
          }
        }
        if (Object.keys(patch).length && (await atualizar(ctx.destino, etapa.tabela, pk, c.para, patch, colsD)) > 0) r.atualizadas++;
      }
    }
  }
  return r;
}

// Mensagens: casa pelo id do WhatsApp; sem ele, pelo texto no mesmo instante
// da mesma conversa. Só olha no principal as conversas e o período que
// interessam.
async function etapaMensagens(ctx: Ctx, etapa: Etapa, aplicar: boolean): Promise<ResultadoEtapa> {
  const r: ResultadoEtapa = { tabela: etapa.tabela, rotulo: etapa.rotulo, noProvisorio: 0, jaTrazidas: 0, jaExistiam: 0, novas: 0, gravadas: 0, atualizadas: 0, deixadasDeFora: 0 };
  if (!(await existeTabela(ctx.origem, etapa.tabela))) return { ...r, observacao: "não existe no provisório" };
  const colsO = await colunasDe(ctx, "o", etapa.tabela);
  const colsD = await colunasDe(ctx, "d", etapa.tabela);
  const comuns = colsO.filter((c) => colsD.includes(c));

  const linhasO = (await lerColunas(ctx.origem, etapa.tabela, ["id", "conversationId", "direction", "sentAt", "zapiMessageId", "body"]))
    .map((l) => remapear(ctx, etapa, l));
  r.noProvisorio = linhasO.length;
  const jaNoPrincipal = await idsQueExistem(ctx.destino, etapa.tabela, "id", linhasO.map((l) => String(l.id)));
  const pendentes = linhasO.filter((l) => !jaNoPrincipal.has(String(l.id)));
  r.jaTrazidas = linhasO.length - pendentes.length;

  const noPrincipal = new Set<string>();
  const zids = pendentes.map((l) => l.zapiMessageId).filter((v): v is string => typeof v === "string" && !!v);
  for (let i = 0; i < zids.length; i += 5000) {
    const rr = await ctx.destino.$queryRawUnsafe<{ z: string }[]>(
      `SELECT "zapiMessageId" AS z FROM "WhatsAppMessage" WHERE "zapiMessageId" = ANY($1::text[])`, zids.slice(i, i + 5000),
    );
    for (const x of rr) noPrincipal.add(`z:${x.z}`);
  }
  const semZid = pendentes.filter((l) => !l.zapiMessageId);
  if (semZid.length) {
    const convs = [...new Set(semZid.map((l) => String(l.conversationId)))];
    const desde = new Date(Math.min(...semZid.map((l) => (l.sentAt instanceof Date ? l.sentAt.getTime() : Date.now()))));
    const rr = await ctx.destino.$queryRawUnsafe<Linha[]>(
      `SELECT "conversationId", direction, "sentAt", "zapiMessageId", left(body, 200) AS body FROM "WhatsAppMessage"
        WHERE "conversationId" = ANY($1::text[]) AND "sentAt" >= $2::timestamp AND "zapiMessageId" IS NULL`,
      convs, desde.toISOString(),
    );
    for (const x of rr) noPrincipal.add(chaveDaMensagem(x));
  }

  const vistas = new Set<string>();
  const novas: Linha[] = [];
  for (const l of pendentes) {
    const k = chaveDaMensagem({ ...l, body: String(l.body ?? "").slice(0, 200) });
    if (noPrincipal.has(k)) { r.jaExistiam++; continue; }
    if (vistas.has(k)) continue;
    vistas.add(k);
    novas.push(l);
  }
  r.novas = novas.length;
  if (!aplicar) return r;

  const lote = etapa.lote ?? 300;
  for (let i = 0; i < novas.length; i += lote) {
    const ids = novas.slice(i, i + lote).map((l) => String(l.id));
    const cheias = (await lerPorIds(ctx.origem, etapa.tabela, "id", ids)).map((l) => remapear(ctx, etapa, l));
    const { linhas, foraDeFora } = await cuidarDosOrfaos(ctx, etapa, cheias);
    r.deixadasDeFora += foraDeFora;
    r.gravadas += await inserir(ctx.destino, etapa.tabela, linhas.map(tratarMensagem), comuns);
  }
  return r;
}

// Configurações: só entra o que o principal não tem, nunca as travas; o
// histórico da motivação do dia junta os dois.
async function etapaConfiguracoes(ctx: Ctx, aplicar: boolean): Promise<ResultadoEtapa> {
  const r: ResultadoEtapa = { tabela: "Configuracao", rotulo: "Configurações", noProvisorio: 0, jaTrazidas: 0, jaExistiam: 0, novas: 0, gravadas: 0, atualizadas: 0, deixadasDeFora: 0 };
  if (!(await existeTabela(ctx.origem, "Configuracao"))) return { ...r, observacao: "não existe no provisório" };
  const doProvisorio = await ctx.origem.$queryRawUnsafe<{ chave: string; valor: string }[]>(`SELECT chave, valor FROM "Configuracao"`);
  r.noProvisorio = doProvisorio.length;
  const doPrincipal = new Map(
    (await ctx.destino.$queryRawUnsafe<{ chave: string; valor: string }[]>(
      `SELECT chave, valor FROM "Configuracao" WHERE chave = ANY($1::text[])`, doProvisorio.map((c) => c.chave),
    )).map((c) => [c.chave, c.valor]),
  );
  let travas = 0;
  const novas: { chave: string; valor: string }[] = [];
  // Chaves em que o principal já tem valor, mas o do provisório tem de valer.
  const sobrepor: { chave: string; valor: string }[] = [];
  let historico = false;
  for (const c of doProvisorio) {
    if (!configPodeVir(c.chave)) { travas++; continue; }
    if (c.chave === CHAVE_HISTORICO_FRASE) {
      const junto = juntarHistoricoFrase(doPrincipal.get(c.chave) ?? null, c.valor);
      if (junto !== doPrincipal.get(c.chave)) { sobrepor.push({ chave: c.chave, valor: junto }); historico = true; }
      else r.jaExistiam++;
      continue;
    }
    // Instância do WhatsApp: se o provisório trocou depois (crm-2 → crm-3),
    // a do principal já travou — voltar para ela seria voltar para o zumbi.
    if (c.chave === CHAVE_INSTANCIA_ATIVA && doPrincipal.has(c.chave)) {
      const vem = instanciaQueVemNaVolta(doPrincipal.get(c.chave), c.valor);
      if (vem) sobrepor.push({ chave: c.chave, valor: vem });
      else r.jaExistiam++;
      continue;
    }
    if (doPrincipal.has(c.chave)) { r.jaExistiam++; continue; }
    novas.push(c);
  }
  r.novas = novas.length;
  r.observacao = `${travas} ficaram de fora de propósito (travas de envio e de IA paga, marcas de manutenção e contadores do dia)${historico ? "; o histórico da motivação do dia junta os dois" : ""}`;
  if (!aplicar) return r;
  r.gravadas = await inserir(ctx.destino, "Configuracao", novas, ["chave", "valor"]);
  for (const s of sobrepor) {
    await ctx.destino.$executeRawUnsafe(
      `INSERT INTO "Configuracao" (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
      s.chave, s.valor,
    );
    r.atualizadas++;
  }
  return r;
}

// Negociação nova de cliente que já tinha negociação aberta no principal pode
// ser a mesma venda aberta duas vezes (lá ela não existia, e o CRM abriu de
// novo pela conversa). Não junta sozinho — avisa, para ele conferir no funil.
async function avisoNegociacoes(ctx: Ctx, r: ResultadoEtapa): Promise<ResultadoEtapa> {
  if (!r.novas) return r;
  const todas = await ctx.origem.$queryRawUnsafe<{ id: string; clienteId: string }[]>(`SELECT id, "clienteId" FROM "Negociacao"`);
  const trazidas = await idsQueExistem(ctx.destino, "Negociacao", "id", todas.map((n) => n.id));
  const novas = todas.filter((n) => !trazidas.has(n.id));
  const clientes = [...new Set(novas.map((n) => String(mapear(ctx, "Cliente", n.clienteId))))];
  const comAberta = await ctx.destino.$queryRawUnsafe<{ c: string }[]>(
    `SELECT DISTINCT "clienteId" AS c FROM "Negociacao" WHERE status = 'aberta' AND "clienteId" = ANY($1::text[])`, clientes,
  );
  const ids = new Set(comAberta.map((x) => x.c));
  const suspeitas = novas.filter((n) => ids.has(String(mapear(ctx, "Cliente", n.clienteId)))).length;
  return suspeitas ? { ...r, observacao: `${suspeitas} são de clientes que já tinham negociação aberta no principal — confira no funil se não é a mesma venda duas vezes` } : r;
}

async function processar(ctx: Ctx, etapa: Etapa | "config", aplicar: boolean): Promise<ResultadoEtapa> {
  if (etapa === "config") return etapaConfiguracoes(ctx, aplicar);
  if (etapa.tabela === "WhatsAppMessage") return etapaMensagens(ctx, etapa, aplicar);
  const r = await etapaGenerica(ctx, etapa, aplicar);
  return etapa.tabela === "Negociacao" && !aplicar ? avisoNegociacoes(ctx, r) : r;
}

// A ordem completa: configurações logo depois dos catálogos.
const ORDEM: (Etapa | "config")[] = [...ETAPAS.slice(0, 9), "config", ...ETAPAS.slice(9)];
export const TOTAL_ETAPAS = ORDEM.length;
const nomeDa = (e: Etapa | "config") => (e === "config" ? "Configuracao" : e.tabela);
// Tabelas cujo "de-para" os filhos precisam, mesmo numa rodada que começa depois delas.
const PAIS_COM_CHAVE = new Set(
  ETAPAS.flatMap((e) => Object.values(e.pais ?? {}).map((p) => p.tabela)).filter((t) => ETAPAS.find((e) => e.tabela === t)?.chaves),
);

export async function rodarVolta(args: {
  origem: Sql; destino: Sql; aplicar: boolean; inicio?: number; prazoMs?: number; agora?: () => number;
}): Promise<ResultadoVolta> {
  const agora = args.agora ?? Date.now;
  const inicio = Math.max(0, args.inicio ?? 0);
  // O principal que volta de dias parado pode estar sem coluna de uma migração
  // que não chegou a rodar lá (a do "não perturbe", de 22/09, no Neon). A
  // volta copia só as colunas que os DOIS bancos têm: sem esta linha, quem
  // respondeu SAIR no provisório voltaria sem a marca, em silêncio. É
  // estrutura, nunca dado — o mesmo que o CRM faz na 1ª consulta que pede a
  // coluna (lib/coluna-que-falta.ts). Não conseguiu, para e diz.
  await completarColunas(args.destino);
  const ctx: Ctx = { origem: args.origem, destino: args.destino, mapas: new Map(), colunas: new Map() };
  const etapas: ResultadoEtapa[] = [];
  const t0 = agora();
  for (let i = 0; i < ORDEM.length; i++) {
    const etapa = ORDEM[i];
    if (i < inicio) {
      if (etapa !== "config" && PAIS_COM_CHAVE.has(etapa.tabela)) await processar(ctx, etapa, false);
      continue;
    }
    if (args.aplicar && args.prazoMs && i > inicio && agora() - t0 > args.prazoMs) return { concluido: false, proxima: i, etapas };
    try {
      etapas.push(await processar(ctx, etapa, args.aplicar));
    } catch (e) {
      // Banco que não conecta não é problema "desta tabela": para tudo e diz
      // uma vez só — senão a tela lista o mesmo erro 37 vezes (e ainda dizia
      // que não havia nada a trazer).
      if (ehFalhaDeConexao(e)) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      etapas.push({
        tabela: nomeDa(etapa), rotulo: etapa === "config" ? "Configurações" : etapa.rotulo, noProvisorio: 0, jaTrazidas: 0, jaExistiam: 0,
        novas: 0, gravadas: 0, atualizadas: 0, deixadasDeFora: 0, erro: msg.slice(0, 300),
      });
      // Sem o de-para de um pai, os filhos iriam para o lugar errado: para aqui.
      if (args.aplicar) return { concluido: false, proxima: i, etapas };
    }
  }
  return { concluido: true, proxima: ORDEM.length, etapas };
}

// Antes de comparar ou trazer: os dois bancos respondem? Diz qual não respondeu.
export async function conferirConexoes(origem: Sql, destino: Sql): Promise<void> {
  try { await origem.$queryRawUnsafe("SELECT 1"); } catch (e) {
    throw Object.assign(new Error(`o banco provisório não respondeu — ${e instanceof Error ? e.message : String(e)}`), { lado: "provisorio" });
  }
  try { await destino.$queryRawUnsafe("SELECT 1"); } catch (e) {
    throw Object.assign(new Error(`o banco principal não respondeu — ${e instanceof Error ? e.message : String(e)}`), { lado: "principal" });
  }
}

// ── Conexão com o provisório ────────────────────────────────────────────────
const globalProvisorio = globalThis as unknown as { crmProvisorio?: PrismaClient };
export function clienteDoProvisorio(): PrismaClient | null {
  const url = process.env.DATABASE_URL_PROVISORIO;
  if (!url) return null;
  if (!globalProvisorio.crmProvisorio) globalProvisorio.crmProvisorio = new PrismaClient({ datasources: { db: { url } }, log: ["error"] });
  return globalProvisorio.crmProvisorio;
}
