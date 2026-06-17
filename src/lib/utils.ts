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
