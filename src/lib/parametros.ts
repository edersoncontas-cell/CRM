// Parâmetros do negócio — editáveis em Configurações, guardados na tabela
// Configuracao (chave parametros.negocio). Antes ficavam espalhados no código
// (taxa de comissão, meta anual, nome do vendedor nos prompts, número do
// briefing, região). Os valores padrão reproduzem o que estava fixo.

import { cache } from "react";
import { getConfig, setConfig } from "@/lib/config";

export type Parametros = {
  nomeCrm: string;          // nome que aparece no menu e no título
  nomeVendedor: string;     // como a IA se refere a você nos prompts/resumos
  nomeEmpresa: string;      // concessionária / empresa
  marcas: string;           // marcas vendidas (texto livre para os prompts)
  regiao: string;           // território (texto livre para os prompts)
  taxaComissao: number;     // fração: 0.005 = 0,5%
  metaAnualVendas: number;  // máquinas por ano
  whatsappBriefing: string | null; // número (só dígitos, com DDI) que recebe o briefing diário do ZEUS
};

const CHAVE = "parametros.negocio";

export const PARAMETROS_PADRAO: Parametros = {
  nomeCrm: "CRM DO EDY",
  nomeVendedor: "Ederson",
  nomeEmpresa: "New Holland Construction · Dynapac",
  marcas: "New Holland Construction e Dynapac",
  regiao: "sul do Espírito Santo",
  taxaComissao: 0.005,
  metaAnualVendas: 40,
  whatsappBriefing: process.env.ZEUS_WHATSAPP_DESTINO?.replace(/\D/g, "") || null,
};

function limparNumero(v: unknown, padrao: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) return padrao;
  return n;
}

function texto(v: unknown, padrao: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : padrao;
}

// Memoizado por requisição (React.cache): várias páginas/prompts leem sem
// repetir o SELECT.
export const lerParametros = cache(async (): Promise<Parametros> => {
  try {
    const raw = await getConfig(CHAVE);
    if (!raw) return PARAMETROS_PADRAO;
    const p = JSON.parse(raw) as Partial<Parametros>;
    return {
      nomeCrm: texto(p.nomeCrm, PARAMETROS_PADRAO.nomeCrm),
      nomeVendedor: texto(p.nomeVendedor, PARAMETROS_PADRAO.nomeVendedor),
      nomeEmpresa: texto(p.nomeEmpresa, PARAMETROS_PADRAO.nomeEmpresa),
      marcas: texto(p.marcas, PARAMETROS_PADRAO.marcas),
      regiao: texto(p.regiao, PARAMETROS_PADRAO.regiao),
      taxaComissao: limparNumero(p.taxaComissao, PARAMETROS_PADRAO.taxaComissao, 0, 1),
      metaAnualVendas: Math.round(limparNumero(p.metaAnualVendas, PARAMETROS_PADRAO.metaAnualVendas, 1, 100000)),
      whatsappBriefing: typeof p.whatsappBriefing === "string" && p.whatsappBriefing.replace(/\D/g, "") ? p.whatsappBriefing.replace(/\D/g, "") : PARAMETROS_PADRAO.whatsappBriefing,
    };
  } catch {
    return PARAMETROS_PADRAO;
  }
});

export async function gravarParametros(p: Parametros): Promise<void> {
  await setConfig(CHAVE, JSON.stringify(p));
}

// Frase pronta para os prompts: "Ederson, vendedor de máquinas pesadas New
// Holland Construction e Dynapac no sul do Espírito Santo".
export function descricaoVendedor(p: Parametros): string {
  return `${p.nomeVendedor}, vendedor de máquinas pesadas ${p.marcas} no ${p.regiao}`;
}
