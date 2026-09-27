// Estado da volta do banco provisório — lido pela tela de Configurações (no
// servidor, ao abrir a página) e pela rota /api/admin/trazer-provisorio.
// Só env e uma chave de configuração: barato, não toca no provisório.

import { db } from "@/lib/db";
import { TOTAL_ETAPAS, TABELAS_QUE_NAO_VEM } from "@/lib/trazer-provisorio";
import { mesmoBanco, provedorDoEndereco } from "@/lib/trazer-provisorio-regra";

export const MARCA_VOLTA = "provisorio.volta";

export type EstadoProvisorio = {
  configurado: boolean;
  principal: string;
  provisorio: string;
  mesmoBanco: boolean;
  ultima: { quando: string; concluido: boolean; gravadas: number } | null;
  totalEtapas: number;
  naoVem: readonly string[];
};

export function limparErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  // Mensagem do Prisma pode trazer o endereço; senha nunca aparece na tela.
  return msg
    .replace(/postgres(ql)?:\/\/\S+/gi, "[endereço do banco]")
    .replace(/Invalid `[^`]+` invocation:?/gi, "")
    .replace(/Raw query failed\. Code: `?\w+`?\. Message: /gi, "")
    .replace(/\s+/g, " ").trim().slice(0, 300);
}

export async function lerEstadoProvisorio(): Promise<EstadoProvisorio> {
  const url = process.env.DATABASE_URL_PROVISORIO;
  let ultima: EstadoProvisorio["ultima"] = null;
  try {
    const c = await db.configuracao.findUnique({ where: { chave: MARCA_VOLTA } });
    if (c?.valor) ultima = JSON.parse(c.valor);
  } catch { ultima = null; }
  return {
    configurado: !!url,
    principal: provedorDoEndereco(process.env.DATABASE_URL),
    provisorio: provedorDoEndereco(url),
    mesmoBanco: !!url && (mesmoBanco(process.env.DATABASE_URL, url) || mesmoBanco(process.env.DATABASE_URL_UNPOOLED, url)),
    ultima,
    totalEtapas: TOTAL_ETAPAS,
    naoVem: TABELAS_QUE_NAO_VEM,
  };
}

