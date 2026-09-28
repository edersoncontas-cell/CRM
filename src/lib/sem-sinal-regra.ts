// MODO SEM SINAL — as regras puras (sem banco, sem navegador).
//
// "faça a parte do crm rodar offline, para ter acesso a visitas, e poder
// agendar ou concluir uma visita, inserir uma nova negociação no funil, e os
// demais dados assim que a internet chegar tudo atualiza"
//
// Como funciona, em três peças:
//  1. PACOTE: com sinal, o CRM baixa um retrato do que o vendedor precisa na
//     rua (visitas, clientes, funil aberto) e guarda no aparelho (IndexedDB).
//  2. FILA: sem sinal, o que ele faz (agendar, concluir, negociação nova) vira
//     uma OPERAÇÃO guardada no aparelho, com id gerado ali mesmo.
//  3. SINCRONIA: quando o sinal volta, as operações sobem em ordem. Subir duas
//     vezes a mesma não duplica nada: visita e negociação nascem com o id do
//     aparelho (a segunda vez acha a primeira), e "concluir" confere se a
//     visita já está como ele deixou (lib/sem-sinal-servidor.ts).
//
// Enquanto não sobe, a tela mostra o pacote COM as operações por cima
// (aplicarPendentes) — senão ele agendaria a visita, ela não apareceria na
// lista, e ele agendaria de novo.

import { papelDaColuna, type PapelColuna } from "@/lib/pipeline";
import { telefoneRecusado, motivoTelefoneRecusado, telefoneParaGravar } from "@/lib/telefone-valido";

// ── O pacote baixado ─────────────────────────────────────────────────────────

export type VisitaPacote = {
  id: string;
  clienteId: string;
  clienteNome: string;
  telefone: string | null;
  /** ISO. */
  data: string;
  /** agendada | realizada | nao_realizada */
  status: string;
  cidade: string | null;
  observacao: string | null;
};

export type ClientePacote = { id: string; nome: string; telefone: string | null; municipio: string | null };

export type NegociacaoPacote = {
  id: string;
  clienteId: string;
  clienteNome: string;
  marca: string | null;
  maquinaModelo: string | null;
  valor: number | null;
  estagio: string;
  proximaAcao: string | null;
  /** ISO. */
  ultimoContato: string | null;
};

export type ColunaPacote = { titulo: string; papel: PapelColuna; ordem: number };
export type MaquinaPacote = { marca: string; modelo: string };

export const VERSAO_PACOTE = 1;

export type PacoteSemSinal = {
  versao: typeof VERSAO_PACOTE;
  /** Hora do SERVIDOR em que o retrato foi tirado (ISO). */
  geradoEm: string;
  visitas: VisitaPacote[];
  clientes: ClientePacote[];
  /** Quantos clientes havia de fato — maior que clientes.length quando o pacote cortou. */
  totalClientes: number;
  negociacoes: NegociacaoPacote[];
  colunas: ColunaPacote[];
  municipios: string[];
  maquinas: MaquinaPacote[];
};

/** Janela de visitas que vai para o aparelho. */
export const DIAS_VISITAS_ATRAS = 60;
export const DIAS_VISITAS_FRENTE = 180;
export const TETO_CLIENTES_PACOTE = 20_000;

/** O pacote é baixado de novo, no máximo, a cada 30 min com a tela aberta. */
export const INTERVALO_PACOTE_MS = 30 * 60 * 1000;

export function pacoteVelho(pacote: Pick<PacoteSemSinal, "geradoEm"> | null, agora: number): boolean {
  if (!pacote) return true;
  const t = Date.parse(pacote.geradoEm);
  return !Number.isFinite(t) || agora - t >= INTERVALO_PACOTE_MS;
}

// ── A fila de operações ──────────────────────────────────────────────────────

export type NovoCliente = { nome: string; telefone: string | null };

type Base = {
  /** Id da OPERAÇÃO — é por ele que o servidor responde. */
  id: string;
  /** Quando o vendedor fez (ISO, relógio do aparelho — só para mostrar). */
  criadaEm: string;
  /** Nome do cliente para a tela de pendentes; o servidor não confia nele. */
  clienteNome: string;
};

export type OpAgendarVisita = Base & {
  tipo: "visita.agendar";
  visitaId: string;
  clienteId: string;
  /** Presente quando o cliente foi cadastrado sem sinal. */
  novoCliente?: NovoCliente;
  /** YYYY-MM-DD (dia em Brasília). */
  data: string;
  /** HH:mm ou null (sem horário = meio-dia, como na ficha do cliente). */
  horario: string | null;
  cidade: string | null;
  observacao: string | null;
};

export type OpConcluirVisita = Base & {
  tipo: "visita.concluir";
  visitaId: string;
  feita: boolean;
  relato: string;
};

export type OpCriarNegociacao = Base & {
  tipo: "negociacao.criar";
  negociacaoId: string;
  clienteId: string;
  novoCliente?: NovoCliente;
  marca: string | null;
  maquinaModelo: string | null;
  valor: number | null;
  /** Título da coluna do funil. */
  estagio: string;
  proximaAcao: string | null;
};

export type OperacaoSemSinal = OpAgendarVisita | OpConcluirVisita | OpCriarNegociacao;
export type TipoOperacao = OperacaoSemSinal["tipo"];

/**
 * pendente → ainda não subiu (ou subiu e o servidor não respondeu).
 * erro     → o servidor recusou; fica até ele tentar de novo ou descartar.
 * enviado  → subiu. Continua na fila só até chegar um pacote mais novo que
 *            ele (senão sumiria da tela no intervalo entre subir e baixar).
 */
export type EstadoRegistro = "pendente" | "erro" | "enviado";

export type RegistroFila = {
  op: OperacaoSemSinal;
  estado: EstadoRegistro;
  erro: string | null;
  /** Hora do SERVIDOR em que foi aceito (ISO). */
  enviadoEm: string | null;
  tentativas: number;
  /** Recado do servidor que vale mostrar mesmo dando certo (ex.: coluna trocada). */
  aviso: string | null;
};

/** Depois de tantas falhas de rede/servidor seguidas, vira erro para ele ver. */
export const TENTATIVAS_ANTES_DE_ERRO = 5;
/** Quantas operações sobem por requisição (relato chama a IA: não cabe muitas). */
export const LOTE_SINCRONIA = 5;

export function novoRegistro(op: OperacaoSemSinal): RegistroFila {
  return { op, estado: "pendente", erro: null, enviadoEm: null, tentativas: 0, aviso: null };
}

/** Id gerado no aparelho — vira o id da visita/negociação/cliente no banco. */
export function novoId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Só letras, números, "-" e "_": cabe o cuid do banco (25), o id do aparelho
// (uuid, 36) e ids curtos de cadastro antigo/importação — o teste local achou
// visita "vt1" recusada com "sem identificação" quando o mínimo era 8.
export const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

// ── Datas (Brasília é UTC−3 o ano todo) ─────────────────────────────────────

const TRES_HORAS = 3 * 60 * 60 * 1000;

/** YYYY-MM-DD do instante, no relógio de Brasília. */
export function diaBrasilia(iso: string | number | Date): string {
  const t = typeof iso === "number" ? iso : new Date(iso).getTime();
  return new Date(t - TRES_HORAS).toISOString().slice(0, 10);
}

/** HH:mm do instante, no relógio de Brasília. */
export function horaBrasilia(iso: string | Date): string {
  return new Date(new Date(iso).getTime() - TRES_HORAS).toISOString().slice(11, 16);
}

/** Soma dias a um YYYY-MM-DD. */
export function somarDias(dia: string, n: number): string {
  const t = Date.parse(`${dia}T12:00:00Z`);
  return new Date(t + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * O instante da visita. Mesma conta da ficha do cliente (adicionarVisita):
 * sem horário vale meio-dia em Brasília, que não vira o dia anterior por
 * causa do fuso.
 */
export function dataDaVisita(dia: string, horario: string | null): Date {
  const h = horario && /^\d{2}:\d{2}$/.test(horario) ? horario : "12:00";
  return new Date(`${dia}T${h}:00-03:00`);
}

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "Hoje", "Amanhã", "Ontem" ou "qua 01/10". */
export function rotuloDia(dia: string, hoje: string): string {
  if (dia === hoje) return "Hoje";
  if (dia === somarDias(hoje, 1)) return "Amanhã";
  if (dia === somarDias(hoje, -1)) return "Ontem";
  const d = new Date(`${dia}T12:00:00Z`);
  return `${DIAS_SEMANA[d.getUTCDay()]} ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

// ── Validação (o servidor não confia no que o aparelho manda) ────────────────

type Validado = { ok: true; op: OperacaoSemSinal } | { ok: false; erro: string };

function texto(v: unknown, max: number): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function validarNovoCliente(v: unknown): { ok: true; novo?: NovoCliente } | { ok: false; erro: string } {
  if (v == null) return { ok: true };
  if (typeof v !== "object") return { ok: false, erro: "Cliente novo em formato estranho." };
  const o = v as Record<string, unknown>;
  const nome = texto(o.nome, 120);
  if (!nome || nome.length < 2) return { ok: false, erro: "Cliente novo sem nome." };
  const telBruto = typeof o.telefone === "string" ? o.telefone : "";
  if (telefoneRecusado(telBruto)) return { ok: false, erro: motivoTelefoneRecusado(telBruto) };
  return { ok: true, novo: { nome, telefone: telefoneParaGravar(telBruto) } };
}

export function validarOperacao(x: unknown): Validado {
  if (!x || typeof x !== "object") return { ok: false, erro: "Operação vazia." };
  const o = x as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!ID_VALIDO.test(id)) return { ok: false, erro: "Operação sem identificação." };
  const criadaEm = typeof o.criadaEm === "string" && Number.isFinite(Date.parse(o.criadaEm)) ? o.criadaEm : new Date(0).toISOString();
  const clienteNome = texto(o.clienteNome, 120) ?? "";

  if (o.tipo === "visita.agendar") {
    const visitaId = typeof o.visitaId === "string" ? o.visitaId : "";
    const clienteId = typeof o.clienteId === "string" ? o.clienteId : "";
    if (!ID_VALIDO.test(visitaId) || !ID_VALIDO.test(clienteId)) return { ok: false, erro: "Visita sem identificação." };
    const data = typeof o.data === "string" ? o.data : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(dataDaVisita(data, null).getTime())) return { ok: false, erro: "Data da visita inválida." };
    const horario = typeof o.horario === "string" && /^\d{2}:\d{2}$/.test(o.horario) ? o.horario : null;
    const nc = validarNovoCliente(o.novoCliente);
    if (!nc.ok) return nc;
    return {
      ok: true,
      op: {
        tipo: "visita.agendar", id, criadaEm, clienteNome, visitaId, clienteId,
        ...(nc.novo ? { novoCliente: nc.novo } : {}),
        data, horario, cidade: texto(o.cidade, 120), observacao: texto(o.observacao, 2000),
      },
    };
  }

  if (o.tipo === "visita.concluir") {
    const visitaId = typeof o.visitaId === "string" ? o.visitaId : "";
    if (!ID_VALIDO.test(visitaId)) return { ok: false, erro: "Visita sem identificação." };
    if (typeof o.feita !== "boolean") return { ok: false, erro: "Faltou dizer se a visita aconteceu." };
    return { ok: true, op: { tipo: "visita.concluir", id, criadaEm, clienteNome, visitaId, feita: o.feita, relato: texto(o.relato, 4000) ?? "" } };
  }

  if (o.tipo === "negociacao.criar") {
    const negociacaoId = typeof o.negociacaoId === "string" ? o.negociacaoId : "";
    const clienteId = typeof o.clienteId === "string" ? o.clienteId : "";
    if (!ID_VALIDO.test(negociacaoId) || !ID_VALIDO.test(clienteId)) return { ok: false, erro: "Negociação sem identificação." };
    const estagio = texto(o.estagio, 80);
    if (!estagio) return { ok: false, erro: "Faltou a coluna do funil." };
    let valor: number | null = null;
    if (o.valor != null) {
      if (typeof o.valor !== "number" || !Number.isFinite(o.valor) || o.valor < 0 || o.valor > 1e10) return { ok: false, erro: "Valor inválido." };
      valor = o.valor;
    }
    const nc = validarNovoCliente(o.novoCliente);
    if (!nc.ok) return nc;
    return {
      ok: true,
      op: {
        tipo: "negociacao.criar", id, criadaEm, clienteNome, negociacaoId, clienteId,
        ...(nc.novo ? { novoCliente: nc.novo } : {}),
        marca: texto(o.marca, 60), maquinaModelo: texto(o.maquinaModelo, 120), valor, estagio,
        proximaAcao: texto(o.proximaAcao, 500),
      },
    };
  }

  return { ok: false, erro: "Tipo de operação desconhecido." };
}

// ── Valor em reais ───────────────────────────────────────────────────────────

/**
 * "R$ 1.250.000,00" → 1250000. "450 mil" → 450000. Vazio → null.
 * NaN nunca sai daqui: o que não é número vira null e a tela avisa.
 */
export function lerValorBR(bruto: string): number | null | "invalido" {
  const t = bruto.trim().toLowerCase();
  if (!t) return null;
  const mil = /\bmil\b/.test(t);
  let s = t.replace(/r\$|\s|mil/g, "");
  if (!s) return "invalido";
  if (!/^[\d.,]+$/.test(s)) return "invalido";
  // Vírgula é o decimal brasileiro; pontos são milhar.
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  // Só pontos: "1.250.000" é milhar; "1250.5" (um ponto, até 2 casas) é decimal.
  else if ((s.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return "invalido";
  return mil ? n * 1000 : n;
}

export function formatarReais(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ── O que a tela mostra: pacote + fila ──────────────────────────────────────

export type Sincronia = "pendente" | "erro" | null;

export type VisitaVista = VisitaPacote & { sync: Sincronia; relatoPendente: string | null };
export type NegociacaoVista = NegociacaoPacote & { sync: Sincronia };
export type ClienteVista = ClientePacote & { sync: Sincronia };

export type VisaoSemSinal = {
  visitas: VisitaVista[];
  negociacoes: NegociacaoVista[];
  clientes: ClienteVista[];
};

/** Registro já contido no pacote? (subiu antes de o retrato ser tirado) */
function jaNoPacote(r: RegistroFila, pacote: PacoteSemSinal): boolean {
  if (r.estado !== "enviado" || !r.enviadoEm) return false;
  return Date.parse(pacote.geradoEm) >= Date.parse(r.enviadoEm);
}

function syncDe(r: RegistroFila): Sincronia {
  if (r.estado === "erro") return "erro";
  // Subiu, mas o pacote ainda é de antes: para ele, está feito.
  if (r.estado === "enviado") return null;
  return "pendente";
}

/**
 * O pacote com as operações da fila aplicadas por cima, na ordem em que ele
 * fez. Puro: não mexe no pacote nem na fila.
 */
export function aplicarPendentes(pacote: PacoteSemSinal, fila: RegistroFila[]): VisaoSemSinal {
  const visitas: VisitaVista[] = pacote.visitas.map((v) => ({ ...v, sync: null, relatoPendente: null }));
  const negociacoes: NegociacaoVista[] = pacote.negociacoes.map((n) => ({ ...n, sync: null }));
  const clientes: ClienteVista[] = pacote.clientes.map((c) => ({ ...c, sync: null }));
  const clientePorId = new Map(clientes.map((c) => [c.id, c]));

  const ordenada = [...fila].sort((a, b) => a.op.criadaEm.localeCompare(b.op.criadaEm));
  for (const r of ordenada) {
    if (jaNoPacote(r, pacote)) continue;
    const op = r.op;
    const sync = syncDe(r);

    if ((op.tipo === "visita.agendar" || op.tipo === "negociacao.criar") && op.novoCliente && !clientePorId.has(op.clienteId)) {
      const c: ClienteVista = { id: op.clienteId, nome: op.novoCliente.nome, telefone: op.novoCliente.telefone, municipio: null, sync };
      clientes.push(c);
      clientePorId.set(c.id, c);
    }

    if (op.tipo === "visita.agendar") {
      if (visitas.some((v) => v.id === op.visitaId)) continue;
      const cli = clientePorId.get(op.clienteId);
      visitas.push({
        id: op.visitaId,
        clienteId: op.clienteId,
        clienteNome: cli?.nome ?? op.clienteNome,
        telefone: cli?.telefone ?? op.novoCliente?.telefone ?? null,
        data: dataDaVisita(op.data, op.horario).toISOString(),
        status: "agendada",
        cidade: op.cidade ?? cli?.municipio ?? null,
        observacao: op.observacao,
        sync,
        relatoPendente: null,
      });
    } else if (op.tipo === "visita.concluir") {
      const v = visitas.find((x) => x.id === op.visitaId);
      if (!v) continue;
      v.status = op.feita ? "realizada" : "nao_realizada";
      v.relatoPendente = op.relato || null;
      if (sync) v.sync = sync;
    } else if (op.tipo === "negociacao.criar") {
      if (negociacoes.some((n) => n.id === op.negociacaoId)) continue;
      negociacoes.unshift({
        id: op.negociacaoId,
        clienteId: op.clienteId,
        clienteNome: clientePorId.get(op.clienteId)?.nome ?? op.clienteNome,
        marca: op.marca,
        maquinaModelo: op.maquinaModelo,
        valor: op.valor,
        estagio: op.estagio,
        proximaAcao: op.proximaAcao,
        ultimoContato: op.criadaEm,
        sync,
      });
    }
  }

  visitas.sort((a, b) => a.data.localeCompare(b.data));
  return { visitas, negociacoes, clientes };
}

// ── Visitas agrupadas por dia ────────────────────────────────────────────────

export type GrupoVisitas = { dia: string; rotulo: string; visitas: VisitaVista[] };

export type VisitasAgrupadas = {
  /** Dias passados que ficaram "agendada": ninguém disse se aconteceu. */
  semResposta: VisitaVista[];
  /** Hoje e os próximos dias, um grupo por dia. */
  proximas: GrupoVisitas[];
  /** Dias passados já respondidos, do mais recente para trás. */
  anteriores: VisitaVista[];
};

export function agruparVisitas(visitas: VisitaVista[], hoje: string): VisitasAgrupadas {
  const semResposta: VisitaVista[] = [];
  const anteriores: VisitaVista[] = [];
  const porDia = new Map<string, VisitaVista[]>();
  for (const v of visitas) {
    const dia = diaBrasilia(v.data);
    if (dia < hoje) {
      if (v.status === "agendada") semResposta.push(v);
      else anteriores.push(v);
      continue;
    }
    const lista = porDia.get(dia) ?? [];
    lista.push(v);
    porDia.set(dia, lista);
  }
  const proximas = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, lista]) => ({ dia, rotulo: rotuloDia(dia, hoje), visitas: lista }));
  anteriores.sort((a, b) => b.data.localeCompare(a.data));
  return { semResposta, proximas, anteriores };
}

// ── Busca de cliente ─────────────────────────────────────────────────────────

export function normalizarBusca(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function buscarClientes<T extends { nome: string; telefone: string | null; municipio?: string | null }>(
  clientes: T[], termo: string, limite = 40,
): { itens: T[]; total: number } {
  const t = normalizarBusca(termo);
  if (!t) return { itens: [], total: 0 };
  const digitos = termo.replace(/\D/g, "");
  const partes = t.split(/\s+/).filter(Boolean);
  const achados = clientes.filter((c) => {
    const nome = normalizarBusca(c.nome);
    const cidade = normalizarBusca(c.municipio ?? "");
    if (partes.every((p) => nome.includes(p) || cidade.includes(p))) return true;
    return digitos.length >= 4 && (c.telefone ?? "").replace(/\D/g, "").includes(digitos);
  });
  // Quem começa com o termo vem antes.
  achados.sort((a, b) => {
    const pa = normalizarBusca(a.nome).startsWith(t) ? 0 : 1;
    const pb = normalizarBusca(b.nome).startsWith(t) ? 0 : 1;
    return pa - pb || a.nome.localeCompare(b.nome, "pt-BR");
  });
  return { itens: achados.slice(0, limite), total: achados.length };
}

// ── Funil ───────────────────────────────────────────────────────────────────

const PAPEIS_ABERTOS: PapelColuna[] = ["em_negociacao", "banco", "confirmada"];

/**
 * Colunas onde uma negociação NOVA pode nascer sem sinal. Faturado e perdida
 * ficam de fora: faturar mexe em estoque e no "já comprou" do cliente, e
 * perder pede motivo — não são coisas para fazer às cegas.
 */
export function colunasParaNovaNegociacao(colunas: ColunaPacote[]): ColunaPacote[] {
  return [...colunas]
    .filter((c) => PAPEIS_ABERTOS.includes(papelDaColuna(c)))
    .sort((a, b) => a.ordem - b.ordem);
}

export type GrupoFunil = { titulo: string; negociacoes: NegociacaoVista[]; total: number };

/** Negociações abertas por coluna, na ordem do funil. As de coluna que sumiu vão para "Outras". */
export function negociacoesPorColuna(negociacoes: NegociacaoVista[], colunas: ColunaPacote[]): GrupoFunil[] {
  const abertas = colunasParaNovaNegociacao(colunas);
  const titulos = new Set(abertas.map((c) => c.titulo));
  const grupos: GrupoFunil[] = abertas.map((c) => ({ titulo: c.titulo, negociacoes: [], total: 0 }));
  const outras: GrupoFunil = { titulo: "Outras colunas", negociacoes: [], total: 0 };
  for (const n of negociacoes) {
    const g = titulos.has(n.estagio) ? grupos.find((x) => x.titulo === n.estagio)! : outras;
    g.negociacoes.push(n);
    g.total += n.valor ?? 0;
  }
  if (outras.negociacoes.length) grupos.push(outras);
  return grupos;
}

// ── Sincronia: o que sobe e o que fazer com a resposta ──────────────────────

export type ResultadoOperacao = {
  id: string;
  ok: boolean;
  /** Já estava no banco (subiu antes e a resposta se perdeu). */
  jaAplicada?: boolean;
  /** Falha de passagem (banco, prazo): tenta sozinho de novo. */
  transitorio?: boolean;
  /** Nem chegou a ser tentada (a rodada parou antes): não conta tentativa. */
  adiada?: boolean;
  erro?: string;
  aviso?: string;
};

export type RespostaSincronia = { agora: string; resultados: ResultadoOperacao[] };

/** O próximo lote a subir: só pendentes, na ordem em que ele fez. */
export function proximoLote(fila: RegistroFila[], max = LOTE_SINCRONIA): RegistroFila[] {
  return fila
    .filter((r) => r.estado === "pendente")
    .sort((a, b) => a.op.criadaEm.localeCompare(b.op.criadaEm))
    .slice(0, max);
}

/** Aplica a resposta do servidor na fila. Devolve só os registros que mudaram. */
export function aplicarResultados(fila: RegistroFila[], resposta: RespostaSincronia): RegistroFila[] {
  const mudados: RegistroFila[] = [];
  for (const res of resposta.resultados) {
    const r = fila.find((x) => x.op.id === res.id);
    if (!r || res.adiada) continue;
    if (res.ok) {
      mudados.push({ ...r, estado: "enviado", erro: null, enviadoEm: resposta.agora, aviso: res.aviso ?? null });
    } else if (res.transitorio) {
      const tentativas = r.tentativas + 1;
      mudados.push(
        tentativas >= TENTATIVAS_ANTES_DE_ERRO
          ? { ...r, tentativas, estado: "erro", erro: res.erro ?? "O servidor não aceitou depois de várias tentativas." }
          : { ...r, tentativas, erro: res.erro ?? null },
      );
    } else {
      mudados.push({ ...r, tentativas: r.tentativas + 1, estado: "erro", erro: res.erro ?? "O servidor recusou." });
    }
  }
  return mudados;
}

/**
 * Registros "enviado" que o pacote novo já contém podem sair da fila.
 * Ficam por 2 dias depois disso, para a aba Pendentes mostrar "subiu".
 */
export function registrosParaApagar(fila: RegistroFila[], pacote: Pick<PacoteSemSinal, "geradoEm">, agora: number): string[] {
  const gerado = Date.parse(pacote.geradoEm);
  return fila
    .filter((r) => r.estado === "enviado" && r.enviadoEm && Date.parse(r.enviadoEm) <= gerado && agora - Date.parse(r.enviadoEm) > 2 * 86_400_000)
    .map((r) => r.op.id);
}

export function contarFila(fila: RegistroFila[]): { pendentes: number; erros: number; enviados: number } {
  let pendentes = 0, erros = 0, enviados = 0;
  for (const r of fila) {
    if (r.estado === "pendente") pendentes++;
    else if (r.estado === "erro") erros++;
    else enviados++;
  }
  return { pendentes, erros, enviados };
}

/** Uma linha para a aba Pendentes. */
export function descreverOperacao(op: OperacaoSemSinal): string {
  if (op.tipo === "visita.agendar") {
    const dia = `${op.data.slice(8, 10)}/${op.data.slice(5, 7)}`;
    return `Visita agendada · ${op.clienteNome} · ${dia}${op.horario ? ` às ${op.horario}` : ""}`;
  }
  if (op.tipo === "visita.concluir") {
    return `Visita ${op.feita ? "feita" : "que não aconteceu"} · ${op.clienteNome}${op.relato ? " · com relato" : ""}`;
  }
  const maquina = [op.marca, op.maquinaModelo].filter(Boolean).join(" ");
  return `Negociação nova · ${op.clienteNome}${maquina ? ` · ${maquina}` : ""}${op.valor != null ? ` · ${formatarReais(op.valor)}` : ""}`;
}

/** Frase para o registro de auditoria de uma rodada de sincronia. */
export function resumoDaRodada(ops: OperacaoSemSinal[]): string {
  const n = { agendar: 0, feita: 0, naoFeita: 0, negociacao: 0 };
  for (const op of ops) {
    if (op.tipo === "visita.agendar") n.agendar++;
    else if (op.tipo === "visita.concluir") op.feita ? n.feita++ : n.naoFeita++;
    else n.negociacao++;
  }
  const partes: string[] = [];
  const plural = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`;
  if (n.agendar) partes.push(plural(n.agendar, "visita agendada", "visitas agendadas"));
  if (n.feita) partes.push(plural(n.feita, "visita feita", "visitas feitas"));
  if (n.naoFeita) partes.push(plural(n.naoFeita, "visita que não aconteceu", "visitas que não aconteceram"));
  if (n.negociacao) partes.push(plural(n.negociacao, "negociação nova", "negociações novas"));
  return `Subiu do modo sem sinal: ${partes.join(", ") || "nada"}.`;
}
