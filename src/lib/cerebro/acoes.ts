"use server";

// Ações da Central Inteligente (o Cérebro): relatório do dia, radar de
// inovação e as memórias ensinadas pelo vendedor.

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { gerarRelatorioDiario, enviarRelatorioDiario, lerRelatorios, type RelatorioGerado } from "@/lib/cerebro/relatorio-diario";
import { rodarRadarInovacao, listarIdeias, definirStatusIdeia, type IdeiaRadar } from "@/lib/cerebro/radar";
import { registrarAudit } from "@/lib/audit";

export async function gerarRelatorioHojeAction(): Promise<{ ok: boolean; relatorio?: RelatorioGerado; erro?: string }> {
  try {
    const relatorio = await gerarRelatorioDiario();
    revalidatePath("/cerebro");
    return { ok: true, relatorio };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function enviarRelatorioHojeAction(): Promise<{ ok: boolean; erro?: string }> {
  try {
    const relatorio = await gerarRelatorioDiario();
    const r = await enviarRelatorioDiario(relatorio);
    revalidatePath("/cerebro");
    return r.enviado ? { ok: true } : { ok: false, erro: r.motivo };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function listarRelatoriosAction(limite = 14): Promise<RelatorioGerado[]> {
  return lerRelatorios(limite);
}

export async function rodarRadarAction(): Promise<{ ok: boolean; novas: number; erro?: string }> {
  const r = await rodarRadarInovacao();
  revalidatePath("/cerebro");
  return r;
}

export async function listarIdeiasAction(status?: IdeiaRadar["status"]): Promise<IdeiaRadar[]> {
  return listarIdeias(status);
}

export async function definirStatusIdeiaAction(id: string, status: IdeiaRadar["status"]): Promise<{ ok: boolean }> {
  await definirStatusIdeia(id, status);
  revalidatePath("/cerebro");
  return { ok: true };
}

// ── Memórias ensinadas ao Cérebro ──────────────────────────────────────────
export type Memoria = { id: string; criadoEm: string; titulo: string; conteudo: string; origem: string; sessao: string | null };

export async function ensinarCerebroAction(entrada: { titulo: string; conteudo: string; sessao?: string | null }): Promise<{ ok: boolean; memoria?: Memoria; erro?: string }> {
  const titulo = entrada.titulo.trim();
  const conteudo = entrada.conteudo.trim();
  if (!conteudo) return { ok: false, erro: "Escreva (ou cole) o que você quer ensinar." };
  const m = await db.memoriaCerebro.create({
    data: {
      titulo: titulo || conteudo.slice(0, 60),
      conteudo: conteudo.slice(0, 20_000),
      origem: "texto",
      sessao: entrada.sessao?.trim() || null,
    },
  });
  await registrarAudit({ acao: "perfil_atualizado", origem: "usuario", descricao: `Memória ensinada ao Cérebro: ${m.titulo}` }).catch(() => {});
  revalidatePath("/cerebro");
  return {
    ok: true,
    memoria: { id: m.id, criadoEm: m.criadoEm.toISOString(), titulo: m.titulo, conteudo: m.conteudo, origem: m.origem, sessao: m.sessao },
  };
}

// Busca simples (sem acento, sem caixa) no título e no conteúdo.
export async function buscarMemoriasAction(termo: string, limite = 30): Promise<Memoria[]> {
  const t = termo.trim();
  const linhas = await db.memoriaCerebro.findMany({
    where: t
      ? { OR: [{ titulo: { contains: t, mode: "insensitive" } }, { conteudo: { contains: t, mode: "insensitive" } }] }
      : {},
    orderBy: { criadoEm: "desc" },
    take: limite,
  });
  return linhas.map((m) => ({
    id: m.id, criadoEm: m.criadoEm.toISOString(), titulo: m.titulo,
    conteudo: m.conteudo, origem: m.origem, sessao: m.sessao,
  }));
}

export async function esquecerMemoriaAction(id: string): Promise<{ ok: boolean }> {
  await db.memoriaCerebro.delete({ where: { id } }).catch(() => null);
  revalidatePath("/cerebro");
  return { ok: true };
}
