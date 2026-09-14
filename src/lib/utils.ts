import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value?: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function formatDate(date?: Date | string | null) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date?: Date | string | null) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function diasDesde(date?: Date | string | null): number {
  if (!date) return 0;
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

const FUSO_BR = "America/Sao_Paulo";

// Hora do dia (0-23) no horário de Brasília — o servidor roda em UTC, então
// nunca confie em getHours() direto para saudações/lógica de período do dia.
export function horaBrasilia(date: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: FUSO_BR,
      hour: "2-digit",
      hour12: false,
    }).format(date)
  ) % 24;
}

// Dia da semana (0=Dom ... 6=Sáb) no fuso de Brasília.
export function diaSemanaBrasilia(date: Date): number {
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: FUSO_BR, weekday: "short" }).format(date);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[nome] ?? date.getDay();
}

// Data (YYYY-MM-DD) de um instante no fuso de Brasília.
export function dataIsoBrasilia(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BR, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// Meia-noite (00:00) de Brasília do dia em que `date` cai, deslocada em
// `deslocamentoDias` dias. O servidor (Vercel) roda em UTC: `setHours(0,0,0,0)`
// devolve 00:00 UTC = 21:00 do dia ANTERIOR em Brasília, então "hoje",
// "amanhã" e "esta semana" ficavam errados entre 21h e meia-noite. O Brasil não
// tem horário de verão desde 2019, por isso o deslocamento -03:00 é fixo.
export function inicioDoDiaBrasilia(date: Date = new Date(), deslocamentoDias = 0): Date {
  const base = new Date(`${dataIsoBrasilia(date)}T00:00:00-03:00`);
  if (deslocamentoDias) base.setUTCDate(base.getUTCDate() + deslocamentoDias);
  return base;
}

// Mês/ano atual (YYYY-MM) no fuso de Brasília — usado para marcar comissões pagas.
export function mesAnoAtualBrasilia(date: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BR, year: "numeric", month: "2-digit" });
  const partes = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}`;
}

// Dia do mês (1-31) correspondente ao 5º dia útil (seg-sex, sem considerar feriados).
function diaDoQuintoDiaUtil(ano: number, mesIndex0: number): number {
  let dia = 1;
  let uteis = 0;
  while (uteis < 5) {
    const diaSemana = new Date(ano, mesIndex0, dia).getDay();
    if (diaSemana !== 0 && diaSemana !== 6) uteis++;
    if (uteis === 5) break;
    dia++;
  }
  return dia;
}

// True se, no horário de Brasília, hoje já é o 5º dia útil do mês corrente ou depois.
// Não considera feriados nacionais/locais — apenas fins de semana.
export function apos5DiaUtilBrasilia(date: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BR, year: "numeric", month: "2-digit", day: "2-digit" });
  const partes = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const ano = Number(partes.year);
  const mes = Number(partes.month) - 1;
  const dia = Number(partes.day);
  return dia >= diaDoQuintoDiaUtil(ano, mes);
}

// Saudação correta conforme o período do dia em Brasília.
export function saudacaoBrasilia(date: Date = new Date()): "Bom dia" | "Boa tarde" | "Boa noite" {
  const h = horaBrasilia(date);
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// Data/hora atual de Brasília por extenso, para dar contexto à IA
// (ex.: "terça-feira, 17 de junho de 2026, 13:43"). Serve de base/calendário.
export function agoraBrasiliaExtenso(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BR,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// Palavras que identificam contatos irrelevantes para a venda de máquinas pesadas.
// Contatos cujo nome contém qualquer um desses termos são silenciosamente descartados.
// O CRM é exclusivo para CLIENTES (compradores de máquinas).
const NOMES_DESCARTADOS = ["POUSADA", "HOTEL", "PME"];

export function deveDescartarContato(nome: string): boolean {
  const upper = nome.toUpperCase();
  return NOMES_DESCARTADOS.some((termo) => upper.includes(termo));
}

export function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Remove o código do país (+55/55) de um telefone brasileiro, deixando só
// DDD+número — mesma regra usada em atualizarCliente() ao salvar, aqui usada
// para EXIBIR o valor já correto antes de salvar (ex.: pré-preencher um campo).
export function semCodigoPais(telefone: string): string {
  return telefone.replace(/^(\+55|55)(?=\d{10,11}$)/, "");
}
