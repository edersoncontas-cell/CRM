// Estado da volta do banco provisório — lido pela tela de Configurações (no
// servidor, ao abrir a página) e pela rota /api/admin/trazer-provisorio.
// Só env e uma chave de configuração: barato, não toca no provisório.

import { db } from "@/lib/db";
import { TOTAL_ETAPAS, TABELAS_QUE_NAO_VEM } from "@/lib/trazer-provisorio";
import { mesmoBanco, provedorDoEndereco } from "@/lib/trazer-provisorio-regra";
import { limparErro } from "@/lib/erro-legivel";

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

// Mora em lib/erro-legivel.ts (a tela dos Números do piloto usa também).
export { limparErro };

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

