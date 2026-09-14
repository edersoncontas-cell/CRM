// Proteção contra força bruta no login. O app roda em funções serverless
// (memória não compartilhada), então o contador vive na tabela Configuracao:
// chave login.falhas.<hash do IP> → { n, primeiraEm, bloqueadoAte }.
// Regra: 5 senhas erradas em 15 minutos bloqueiam o IP por 15 minutos.

import { headers } from "next/headers";
import { db } from "@/lib/db";

const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000;
const BLOQUEIO_MS = 15 * 60 * 1000;

type Registro = { n: number; primeiraEm: number; bloqueadoAte: number | null };

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export function ipDaRequisicao(): string {
  const h = headers();
  const xff = h.get("x-forwarded-for");
  return (xff ? xff.split(",")[0] : h.get("x-real-ip") ?? "desconhecido").trim();
}

async function chaveDe(ip: string): Promise<string> {
  return `login.falhas.${await sha256(ip)}`;
}

async function ler(chave: string): Promise<Registro | null> {
  const c = await db.configuracao.findUnique({ where: { chave } }).catch(() => null);
  if (!c) return null;
  try { return JSON.parse(c.valor) as Registro; } catch { return null; }
}

// Minutos restantes de bloqueio para este IP (0 = liberado).
export async function minutosBloqueado(ip: string): Promise<number> {
  const r = await ler(await chaveDe(ip));
  if (!r?.bloqueadoAte) return 0;
  const resta = r.bloqueadoAte - Date.now();
  return resta > 0 ? Math.ceil(resta / 60000) : 0;
}

// Registra uma senha errada; devolve os minutos de bloqueio se estourou o limite.
export async function registrarFalhaLogin(ip: string): Promise<{ bloqueadoMin: number; restantes: number }> {
  const chave = await chaveDe(ip);
  const agora = Date.now();
  const atual = await ler(chave);
  const dentroDaJanela = atual && agora - atual.primeiraEm < JANELA_MS;
  const n = dentroDaJanela ? atual.n + 1 : 1;
  const primeiraEm = dentroDaJanela ? atual.primeiraEm : agora;
  const bloqueadoAte = n >= MAX_FALHAS ? agora + BLOQUEIO_MS : null;
  const valor = JSON.stringify({ n, primeiraEm, bloqueadoAte } satisfies Registro);
  await db.configuracao.upsert({ where: { chave }, update: { valor }, create: { chave, valor } }).catch(() => {});
  return { bloqueadoMin: bloqueadoAte ? Math.ceil(BLOQUEIO_MS / 60000) : 0, restantes: Math.max(0, MAX_FALHAS - n) };
}

export async function limparFalhasLogin(ip: string): Promise<void> {
  await db.configuracao.deleteMany({ where: { chave: await chaveDe(ip) } }).catch(() => {});
}
