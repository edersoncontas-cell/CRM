"use server";

import { revalidatePath } from "next/cache";
import { registrarAudit } from "@/lib/audit";
import { previaLimpeza, executarLimpeza, desfazerLimpeza, listarLimpezas, type PreviaLimpeza, type ResultadoLimpezaClientes, type LimpezaResumo } from "@/lib/clientes-lixo";

const PAGINAS = ["/clientes", "/atendimento", "/central", "/dashboard", "/configuracoes", "/visitas"];

export type EstadoLimpeza = { previa: PreviaLimpeza; historico: LimpezaResumo[] };

export async function lerEstadoLimpezaAction(): Promise<EstadoLimpeza> {
  const [previa, historico] = await Promise.all([previaLimpeza(), listarLimpezas()]);
  return { previa, historico };
}

export async function executarLimpezaAction(): Promise<ResultadoLimpezaClientes> {
  const r = await executarLimpeza("usuario");
  if (r.apagados + r.consertados > 0) {
    await registrarAudit({
      acao: "cliente_atualizado", origem: "usuario",
      descricao: `Limpeza de cadastros sem identidade: ${r.apagados} apagado(s), ${r.consertados} consertado(s) (dá para desfazer em Configurações).`,
    }).catch(() => {});
    for (const p of PAGINAS) revalidatePath(p);
  }
  return r;
}

export async function desfazerLimpezaAction(id: string): Promise<{ restaurados: number; falhas: string[] }> {
  const r = await desfazerLimpeza(id);
  await registrarAudit({
    acao: "cliente_atualizado", origem: "usuario",
    descricao: `Limpeza de cadastros desfeita: ${r.restaurados} cadastro(s) restaurado(s)${r.falhas.length ? `, ${r.falhas.length} falha(s)` : ""}.`,
  }).catch(() => {});
  for (const p of PAGINAS) revalidatePath(p);
  return r;
}
