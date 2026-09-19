"use server";

// Ações da parte nova da Academia: o simulador com IA e a realidade do
// negócio (as regras que a Academia tem de respeitar).

import { gerarCenarioComIA, type HistoricoSimulador } from "@/lib/academia/simulador-ia";
import type { CenarioSimulador } from "@/lib/academia/simulador";
import { lerRegrasNegocio, adicionarRegraNegocio, removerRegraNegocio, type RegraNegocio } from "@/lib/contexto-negocio";
import { llmTexto, iaHabilitada } from "@/lib/ai";
import { lerParametros } from "@/lib/parametros";
import { registrarAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function gerarCenarioSimuladorAction(args: {
  etapa: string;
  historico: HistoricoSimulador;
  indice: number;
  dificuldade?: 1 | 2 | 3;
}): Promise<{ ok: boolean; cenario?: CenarioSimulador; erro?: string }> {
  return gerarCenarioComIA(args);
}

export async function lerRealidadeAction(): Promise<RegraNegocio[]> {
  return lerRegrasNegocio();
}

export async function adicionarRealidadeAction(texto: string, area: RegraNegocio["area"] = "tudo"): Promise<{ ok: boolean; regras?: RegraNegocio[]; erro?: string }> {
  const t = texto.trim();
  if (t.length < 10) return { ok: false, erro: "Escreva a regra com um pouco mais de detalhe." };
  const regras = await adicionarRegraNegocio(t, area);
  await registrarAudit({ acao: "perfil_atualizado", origem: "usuario", descricao: `Realidade do negócio: ${t.slice(0, 120)}` }).catch(() => {});
  revalidatePath("/academia");
  return { ok: true, regras };
}

export async function removerRealidadeAction(id: string): Promise<RegraNegocio[]> {
  const r = await removerRegraNegocio(id);
  revalidatePath("/academia");
  return r;
}

// "Isso aqui não é assim na minha realidade": o vendedor descreve em português
// e a IA transforma em uma regra curta e clara para entrar nos prompts.
export async function escreverRegraComIAAction(descricao: string): Promise<{ ok: boolean; texto?: string; erro?: string }> {
  const d = descricao.trim();
  if (!d) return { ok: false, erro: "Escreva o que é diferente na sua realidade." };
  if (!iaHabilitada()) return { ok: true, texto: d };

  const p = await lerParametros();
  try {
    const texto = await llmTexto(
      `Você organiza as regras de operação de ${p.nomeVendedor}, vendedor de máquinas pesadas (${p.marcas}) no ${p.regiao}.
Transforme o que ele contou em UMA regra curta, afirmativa e sem ambiguidade, que outra IA vai seguir ao ensinar ou ao sugerir mensagens.
Máximo 2 frases. Não invente detalhe que ele não disse. Responda só a regra, sem aspas e sem comentário.`,
      d,
      { maxTokens: 160 },
    );
    return { ok: true, texto: texto.trim() || d };
  } catch {
    return { ok: true, texto: d };
  }
}
