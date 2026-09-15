// Escolha AUTOMÁTICA do modelo do Groq. O Groq desativa modelos com
// frequência (o "llama-3.3-70b-versatile" sumiu e o Cérebro parou com 404);
// em vez de um nome fixo, consultamos a lista de modelos da conta e pegamos o
// mais forte para uso com ferramentas, na ordem abaixo. GROQ_MODEL no
// ambiente continua valendo, se o modelo existir; se ele for desativado, a
// escolha cai para o próximo automaticamente. Um modelo que responder
// "does not exist" no meio do caminho é marcado como ruim e a chamada é
// refeita com o seguinte.

// Do mais capaz (raciocínio + tool use em português) para o mais simples.
export const CANDIDATOS_GROQ = [
  "openai/gpt-oss-120b",
  "moonshotai/kimi-k2-instruct-0905",
  "moonshotai/kimi-k2-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "llama-3.3-70b-versatile",
  "qwen/qwen3-32b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];

// Endereço da API (sobrescrevível só para testes locais com um servidor falso).
export const GROQ_BASE_URL = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");

const CACHE_MS = 60 * 60_000;
let cache: { em: number; modelos: Set<string> } | null = null;
const ruins = new Set<string>();

// Regra pura (testável): modelo do ambiente se existir, senão o primeiro
// candidato disponível, senão o do ambiente ou o primeiro da lista.
export function escolherModeloGroq(env: string | undefined, disponiveis: Set<string>, ruinsAgora: Set<string> = ruins): string {
  const ok = (m: string) => !ruinsAgora.has(m) && !modeloGroqEsgotado(m) && (disponiveis.size === 0 || disponiveis.has(m));
  if (env && ok(env)) return env;
  const candidato = CANDIDATOS_GROQ.find(ok);
  if (candidato) return candidato;
  return env || CANDIDATOS_GROQ[0];
}

export async function listarModelosGroq(): Promise<Set<string>> {
  if (cache && Date.now() - cache.em < CACHE_MS) return cache.modelos;
  try {
    const res = await fetch(`${GROQ_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { data?: { id?: string; active?: boolean }[] };
    const modelos = new Set((j.data ?? []).filter((m) => m.id && m.active !== false).map((m) => m.id as string));
    if (modelos.size) cache = { em: Date.now(), modelos };
    return modelos;
  } catch (e) {
    console.error("[groq] não deu para listar os modelos:", e instanceof Error ? e.message : e);
    return cache?.modelos ?? new Set();
  }
}

export async function modeloGroq(): Promise<string> {
  return escolherModeloGroq(process.env.GROQ_MODEL, await listarModelosGroq());
}

// O erro é "modelo não existe / desativado"? Aí vale trocar e tentar de novo.
export function erroDeModeloGroq(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /does not exist|model_not_found|decommissioned|has been deprecated|not supported/i.test(msg);
}

// Modelos com raciocínio (gpt-oss, qwen3, deepseek-r1): o "pensamento" gasta
// tokens do mesmo limite da resposta — com limite curto o JSON sai cortado e o
// Groq devolve "Failed to validate JSON". Para eles, limite maior e esforço
// baixo (rápido e barato). `semFormato` tira o JSON estrito (segunda tentativa).
export function modeloComRaciocinio(modelo: string): boolean {
  return /gpt-oss|qwen3|deepseek-r1|reasoning/i.test(modelo);
}

export function parametrosGroq(modelo: string, maxTokens: number, json: boolean, semFormato = false): Record<string, unknown> {
  const raciocinio = modeloComRaciocinio(modelo);
  return {
    model: modelo,
    max_tokens: raciocinio ? maxTokens + 4000 : maxTokens,
    ...(raciocinio && /gpt-oss/i.test(modelo) ? { reasoning_effort: "low" } : {}),
    ...(raciocinio && !/gpt-oss/i.test(modelo) ? { reasoning_format: "hidden" } : {}),
    ...(json && !semFormato ? { response_format: { type: "json_object" } } : {}),
  };
}

// O erro é "JSON inválido na geração"? Aí vale refazer sem o formato estrito.
export function erroDeJsonGroq(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /json_validate_failed|Failed to validate JSON/i.test(msg);
}

export function marcarModeloGroqRuim(modelo: string): void {
  ruins.add(modelo);
  cache = null;
}

// Cota (429): o limite do Groq é POR MODELO (tokens por dia/minuto). Quando um
// estoura, o próximo candidato da lista ainda tem cota própria — então o
// modelo fica "esgotado" por um tempo (não para sempre, como o 404) e a
// chamada é refeita com o seguinte. Só depois de todos esgotarem é que a
// cascata passa para o próximo provedor.
const ESGOTADO_MS = 60 * 60_000;
const esgotados = new Map<string, number>();

export function erroDeCotaGroq(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /\b429\b|rate.?limit|tokens per (day|minute)|\bTPD\b|\bTPM\b/i.test(msg);
}

export function marcarModeloGroqEsgotado(modelo: string, agora = Date.now()): void {
  esgotados.set(modelo, agora + ESGOTADO_MS);
}

export function modeloGroqEsgotado(modelo: string, agora = Date.now()): boolean {
  const ate = esgotados.get(modelo);
  if (ate == null) return false;
  if (ate <= agora) { esgotados.delete(modelo); return false; }
  return true;
}
