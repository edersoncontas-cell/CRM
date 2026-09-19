// A REALIDADE DO NEGÓCIO: as regras do dia a dia deste vendedor que a IA não
// tem como adivinhar e que valem para tudo — Academia, Orientador do
// WhatsApp, Cérebro e Marketing.
//
// Exemplo real que motivou isto: a Academia ensinava a usar a máquina do
// cliente como entrada no negócio, e aqui NÃO se pega máquina como entrada.
// Sem um lugar para dizer isso, a IA repetia o erro para sempre.
//
// As regras ficam em Configuracao (chave "negocio.realidade"), editáveis em
// Configurações e na própria Academia. Toda regra entra nos prompts como
// instrução DURA: a IA nunca pode contrariar.

import { getConfig, setConfig } from "@/lib/config";

const CHAVE = "negocio.realidade";
const TTL_MS = 30_000;

export type RegraNegocio = {
  id: string;
  texto: string;
  // Onde ela vale. "tudo" entra em todos os prompts.
  area: "tudo" | "academia" | "orientador" | "marketing";
  criadoEm: string;
};

let cache: RegraNegocio[] | null = null;
let cacheEm = 0;

// Regras de fábrica: a primeira é justamente a que o vendedor apontou.
export const REGRAS_PADRAO: RegraNegocio[] = [
  {
    id: "sem-maquina-entrada",
    texto: "Não aceitamos máquina do cliente como entrada no negócio. A entrada é em dinheiro; a máquina usada dele pode no máximo ser avaliada para venda direta a terceiros, nunca abatida como entrada.",
    area: "tudo",
    criadoEm: "2026-09-19T00:00:00.000Z",
  },
];

export async function lerRegrasNegocio(): Promise<RegraNegocio[]> {
  if (cache && Date.now() - cacheEm < TTL_MS) return cache;
  try {
    const raw = await getConfig(CHAVE);
    const lista = raw ? (JSON.parse(raw) as RegraNegocio[]) : REGRAS_PADRAO;
    cache = Array.isArray(lista) ? lista.filter((r) => r && typeof r.texto === "string" && r.texto.trim()) : REGRAS_PADRAO;
  } catch {
    cache = REGRAS_PADRAO;
  }
  cacheEm = Date.now();
  return cache;
}

export async function salvarRegrasNegocio(regras: RegraNegocio[]): Promise<RegraNegocio[]> {
  const limpas = regras
    .filter((r) => r.texto.trim())
    .map((r) => ({ ...r, texto: r.texto.trim().slice(0, 600) }))
    .slice(0, 60);
  await setConfig(CHAVE, JSON.stringify(limpas));
  cache = limpas;
  cacheEm = Date.now();
  return limpas;
}

export async function adicionarRegraNegocio(texto: string, area: RegraNegocio["area"] = "tudo"): Promise<RegraNegocio[]> {
  const atuais = await lerRegrasNegocio();
  const nova: RegraNegocio = {
    id: `r${Date.now().toString(36)}`,
    texto,
    area,
    criadoEm: new Date().toISOString(),
  };
  return salvarRegrasNegocio([...atuais, nova]);
}

export async function removerRegraNegocio(id: string): Promise<RegraNegocio[]> {
  const atuais = await lerRegrasNegocio();
  return salvarRegrasNegocio(atuais.filter((r) => r.id !== id));
}

// Bloco pronto para colar no prompt. Vazio quando não há regra para a área.
export function blocoDeRegras(regras: RegraNegocio[], area: Exclude<RegraNegocio["area"], "tudo">): string {
  const valem = regras.filter((r) => r.area === "tudo" || r.area === area);
  if (!valem.length) return "";
  return [
    "## COMO AS COISAS FUNCIONAM AQUI (regras do vendedor — valem acima de qualquer teoria)",
    ...valem.map((r) => `- ${r.texto}`),
    "Se algum conteúdo, técnica ou sugestão contrariar uma destas regras, ADAPTE ao que vale aqui e diga isso em uma frase.",
  ].join("\n");
}

export async function regrasParaPrompt(area: Exclude<RegraNegocio["area"], "tudo">): Promise<string> {
  return blocoDeRegras(await lerRegrasNegocio(), area);
}
