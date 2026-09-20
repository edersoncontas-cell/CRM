"use server";

// Salvar e apagar chave de IA pela tela do CRM.
//
// Existe para o vendedor poder ligar um provedor novo do celular, em trinta
// segundos, sem abrir painel de hospedagem nem esperar deploy. Ver
// lib/ai/chaves.ts para o porquê e para a regra de precedência.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { registrarAudit } from "@/lib/audit";
import { ORDEM_PROVEDORES, NOME_PROVEDOR, type ProvedorId } from "@/lib/ai/provedores-status";
import { chaveConfig, chaveParece, limparChave, esquecerCacheDeChaves,
         CHAVE_SOMENTE_GRATUITOS, VAR_SOMENTE_GRATUITOS } from "@/lib/ai/chaves";

function provedorValido(p: string): p is ProvedorId {
  return (ORDEM_PROVEDORES as string[]).includes(p);
}

export async function salvarChaveIAAction(
  provedor: string,
  valor: string,
): Promise<{ ok: boolean; erro?: string }> {
  if (!provedorValido(provedor)) return { ok: false, erro: "Provedor desconhecido." };
  const chave = limparChave(valor);
  if (!chaveParece(chave)) {
    return { ok: false, erro: "Isso não parece uma chave. Cole a chave inteira, sem espaços." };
  }

  try {
    await db.configuracao.upsert({
      where: { chave: chaveConfig(provedor) },
      update: { valor: chave },
      create: { chave: chaveConfig(provedor), valor: chave },
    });
    esquecerCacheDeChaves();
  } catch (e) {
    console.error("[salvarChaveIA] falhou"); // sem o erro: ele pode carregar a chave
    void e;
    return { ok: false, erro: "Não deu para salvar a chave." };
  }

  // A auditoria registra o FATO, nunca o valor.
  await registrarAudit({
    acao: "chave_ia_alterada", origem: "usuario",
    descricao: `Chave de IA do ${NOME_PROVEDOR[provedor]} salva pela tela do CRM.`,
    entidade: "Configuracao", entidadeId: chaveConfig(provedor),
  }).catch(() => {});

  // Fora do try de propósito: a chave JÁ está salva. Um revalidate que falha
  // não pode fazer a tela dizer que não salvou.
  try { revalidatePath("/zeus"); revalidatePath("/configuracoes"); } catch { /* fora do request */ }
  return { ok: true };
}

export async function apagarChaveIAAction(provedor: string): Promise<{ ok: boolean; erro?: string }> {
  if (!provedorValido(provedor)) return { ok: false, erro: "Provedor desconhecido." };
  try {
    await db.configuracao.deleteMany({ where: { chave: chaveConfig(provedor) } });
    esquecerCacheDeChaves();
    // O processo pode estar quente com a chave já no ambiente: tira de lá
    // também, senão ela continuaria valendo até o próximo start.
    const { CHAVE_PROVEDOR } = await import("@/lib/ai/provedores-status");
    delete process.env[CHAVE_PROVEDOR[provedor]];
  } catch {
    return { ok: false, erro: "Não deu para apagar a chave." };
  }
  await registrarAudit({
    acao: "chave_ia_alterada", origem: "usuario",
    descricao: `Chave de IA do ${NOME_PROVEDOR[provedor]} apagada pela tela do CRM.`,
    entidade: "Configuracao", entidadeId: chaveConfig(provedor),
  }).catch(() => {});
  try { revalidatePath("/zeus"); revalidatePath("/configuracoes"); } catch { /* fora do request */ }
  return { ok: true };
}

/**
 * Liga/desliga a trava de gasto. Ver lib/ai/chaves.ts.
 *
 * Desligar significa autorizar o CRM a usar provedor PAGO quando os gratuitos
 * recusarem. É uma decisão de dinheiro, então é explícita, tem registro na
 * auditoria e nunca acontece por omissão.
 */
export async function definirSomenteGratuitosAction(somenteGratuitos: boolean): Promise<{ ok: boolean }> {
  const valor = somenteGratuitos ? "on" : "off";
  try {
    await db.configuracao.upsert({
      where: { chave: CHAVE_SOMENTE_GRATUITOS },
      update: { valor },
      create: { chave: CHAVE_SOMENTE_GRATUITOS, valor },
    });
    process.env[VAR_SOMENTE_GRATUITOS] = valor;
  } catch {
    return { ok: false };
  }
  await registrarAudit({
    acao: "chave_ia_alterada", origem: "usuario",
    descricao: somenteGratuitos
      ? "Trava de gasto LIGADA: o CRM só usa provedores de IA gratuitos."
      : "Trava de gasto DESLIGADA: o CRM passa a usar provedor pago quando os gratuitos recusarem.",
    entidade: "Configuracao", entidadeId: CHAVE_SOMENTE_GRATUITOS,
  }).catch(() => {});
  try { revalidatePath("/zeus"); } catch { /* fora do request */ }
  return { ok: true };
}
