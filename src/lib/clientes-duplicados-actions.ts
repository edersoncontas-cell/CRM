"use server";

import { revalidatePath } from "next/cache";
import { registrarAudit } from "@/lib/audit";
import {
  previaDuplicados, unificarLote, desfazerUnificacao, listarUnificacoes,
  type PreviaDuplicados, type ResultadoLote, type UnificacaoResumo,
} from "@/lib/clientes-duplicados";

const PAGINAS = ["/clientes", "/negociacoes", "/atendimento", "/orientador", "/central", "/visitas", "/dashboard", "/configuracoes"];

export type EstadoDuplicados = { previa: PreviaDuplicados; historico: UnificacaoResumo[] };

export async function lerEstadoDuplicadosAction(): Promise<EstadoDuplicados> {
  const [previa, historico] = await Promise.all([previaDuplicados(), listarUnificacoes()]);
  return { previa, historico };
}

// Um lote por chamada (a tela repete até restantes = 0) para caber no tempo
// de uma função serverless.
export async function unificarLoteAction(limite = 8): Promise<ResultadoLote> {
  const r = await unificarLote(Math.min(Math.max(1, limite), 20), "usuario");
  if (r.unificados > 0) {
    await registrarAudit({
      acao: "cliente_atualizado", origem: "usuario",
      descricao: `Cadastros duplicados unificados: ${r.unificados} grupo(s), ${r.cadastrosRemovidos} cadastro(s) removido(s) (dá para desfazer em Configurações).`,
    }).catch(() => {});
    for (const p of PAGINAS) revalidatePath(p);
  }
  return r;
}

export async function desfazerUnificacaoAction(id: string): Promise<{ restaurados: number; falhas: string[] }> {
  const r = await desfazerUnificacao(id);
  await registrarAudit({
    acao: "cliente_atualizado", origem: "usuario",
    descricao: `Unificação de cadastros desfeita: ${r.restaurados} cadastro(s) restaurado(s)${r.falhas.length ? `, ${r.falhas.length} falha(s)` : ""}.`,
  }).catch(() => {});
  for (const p of PAGINAS) revalidatePath(p);
  return r;
}
