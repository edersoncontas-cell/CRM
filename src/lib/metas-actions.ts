"use server";

import { revalidatePath } from "next/cache";
import { setConfig } from "@/lib/config";
import { registrarAudit } from "@/lib/audit";
import { lerParametros } from "@/lib/parametros";
import { CHAVE_RECURSO_METAS, validarMeta } from "@/lib/metas-regra";
import { criarMeta, atualizarMeta, excluirMeta, criarMetasDeExemplo } from "@/lib/metas-cadastro";

type Resp = { ok: boolean; erro?: string };

// A meta anual alimenta o Dashboard, o Zeus e o agente: todos mudam junto.
function atualizarTelas() {
  revalidatePath("/metas");
  revalidatePath("/dashboard");
  revalidatePath("/zeus");
  revalidatePath("/configuracoes");
}

const auditar = (descricao: string) => registrarAudit({ acao: "perfil_atualizado", origem: "usuario", descricao }).catch(() => {});

export async function ligarMetasAction(ligar: boolean): Promise<Resp> {
  try {
    await setConfig(CHAVE_RECURSO_METAS, ligar ? "ligado" : "desligado");
    await auditar(ligar ? "Metas e supermetas ligado em Configurações." : "Metas e supermetas desligado em Configurações.");
    atualizarTelas();
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível salvar. O banco não respondeu." };
  }
}

export async function salvarMetaAction(entrada: Record<string, unknown>, id?: string): Promise<Resp> {
  const v = validarMeta(entrada);
  if (!v.ok) return { ok: false, erro: v.erro };
  try {
    if (id) {
      if (!(await atualizarMeta(id, v.valor))) return { ok: false, erro: "Essa meta não existe mais. Atualize a tela." };
    } else {
      await criarMeta(v.valor);
    }
    await auditar(`Meta ${id ? "alterada" : "criada"}: ${v.valor.indicador} ${v.valor.periodo} = ${v.valor.meta}.`);
    atualizarTelas();
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível salvar a meta. Tente de novo." };
  }
}

export async function excluirMetaAction(id: string): Promise<Resp> {
  try {
    if (!(await excluirMeta(id))) return { ok: false, erro: "Essa meta já tinha sido apagada." };
    await auditar("Meta apagada.");
    atualizarTelas();
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível apagar a meta. Tente de novo." };
  }
}

export async function usarMetasDeExemploAction(): Promise<Resp & { criadas?: number }> {
  try {
    const p = await lerParametros();
    const { criadas } = await criarMetasDeExemplo(new Date(), p.metaAnualVendas);
    if (!criadas) return { ok: false, erro: "Já existem metas cadastradas. Edite as que existem." };
    await auditar(`Metas de exemplo criadas (${criadas}).`);
    atualizarTelas();
    return { ok: true, criadas };
  } catch {
    return { ok: false, erro: "Não foi possível criar as metas de exemplo. Tente de novo." };
  }
}
