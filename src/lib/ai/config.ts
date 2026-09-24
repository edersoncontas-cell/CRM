// Modelos da Anthropic centralizados — nenhuma chamada deve hardcodear um
// nome de modelo fora daqui, senão MODEL_CHAT/MODEL_TAREFA na Vercel não tem
// efeito em metade das rotas (era o que acontecia antes desta centralização).
//
// MODEL_CHAT: conversas interativas (Cérebro no chat) — volume baixo (só
// quando o vendedor abre o chat), vale manter um modelo mais robusto.
// MODEL_TAREFA: roda em TODA mensagem de WhatsApp (Orientador de Vendas,
// fichas técnicas, battlecards, prospecção) — é o que mais pesa no custo.
// Opus 4.8 ($5/$25 por milhão de tokens) é o modelo mais caro que existe;
// como essa chamada dispara a cada mensagem recebida, era o principal
// responsável pelo consumo rápido de crédito. Haiku 4.5 ($1/$5) entrega
// qualidade muito próxima para extração/coaching estruturado por uma fração
// do preço — e hoje só entra em ação se a OpenAI não estiver configurada
// (ver provedorIA() em index.ts: OpenAI > Anthropic > Groq).
export const MODEL_CHAT = process.env.MODEL_CHAT || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
export const MODEL_TAREFA = process.env.MODEL_TAREFA || process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

// Modelo da OpenAI usado pelo Orientador de Vendas (e por qualquer chamada de
// texto quando OPENAI_API_KEY é o provedor ativo — ver provedorIA() em
// index.ts). gpt-4o-mini ($0.15/$0.60 por milhão) custa ~15x menos que o
// gpt-4o completo ($2.50/$10) e é mais do que suficiente para extração
// estruturada e geração de resposta em português — troque via env
// OPENAI_MODEL="gpt-4o" se algum dia sentir falta de qualidade.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Gemini (Google) — a opção com camada gratuita e leitura nativa de PDF/imagem.
//
// LISTAS, não um nome só: o "gemini-2.5-flash", usado até 24/09/2026, tem
// desligamento anunciado para outubro de 2026. Com a lista, modelo que some
// (404) ou esgota a cota grátis do dia (429) passa a vez ao próximo — ver
// lib/ai/gemini-modelos.ts. A env, quando existe, vem sempre primeiro.
//
// TEXTO (Orientador a cada mensagem, resumos, leitura de PDF, frase do dia):
// Flash-Lite primeiro. No plano GRATUITO, que é o que o vendedor usa, ele dá
// ~500 chamadas/dia contra ~20 do Flash (set/2026) — e o Orientador roda a
// cada mensagem. No pago, custa um terço do Flash.
// CHAT e RADAR (26 ferramentas, busca do Google, volume baixo): Flash
// primeiro — ali a qualidade pesa mais que a cota.
// Os "-latest" são apelidos que o Google aponta sempre para o modelo atual:
// última rede, caso os nomes acima mudem antes de o código mudar.
const unicos = (xs: (string | undefined)[]) =>
  Array.from(new Set(xs.filter((m): m is string => !!m && m.trim() !== "").map((m) => m.trim())));

export const GEMINI_MODELOS_TEXTO = unicos([
  process.env.GEMINI_MODEL, "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-flash-latest",
]);
export const GEMINI_MODELOS_CHAT = unicos([
  process.env.GEMINI_MODEL_CHAT, process.env.GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest",
]);
/** O primeiro da lista de texto — para exibir e para quem precisa de um nome só. */
export const GEMINI_MODEL = GEMINI_MODELOS_TEXTO[0];

// Endereço da API do Gemini — só muda em teste (servidor falso local).
export const GEMINI_API_BASE = (process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");

// Geração de IMAGEM no Gemini (arte para a mensagem de promoção/data
// comemorativa). Tenta os modelos nesta ordem: o da env, depois os nomes
// atuais do Google — quando um sai do ar/é renomeado, o próximo assume.
// O "gemini-2.5-flash-image" fica por último: o levantamento de 24/09/2026 não
// achou data de desligamento para ele (só para o 2.5 Flash e o 2.5 Flash-Lite
// de texto). Se sair, a lista simplesmente pula.
export const GEMINI_IMAGE_MODELS = Array.from(new Set(
  [process.env.GEMINI_IMAGE_MODEL, "gemini-3.1-flash-image", "gemini-2.5-flash-image"].filter((m): m is string => !!m && m.trim() !== ""),
));

// DeepSeek — o mais barato entre os provedores de texto pagos, API compatível
// com o formato da OpenAI. "deepseek-chat"/"deepseek-reasoner" foram
// descontinuados em favor de deepseek-v4-flash/deepseek-v4-pro.
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
