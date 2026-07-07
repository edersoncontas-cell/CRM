// Modelos da Anthropic centralizados — nenhuma chamada deve hardcodear um
// nome de modelo fora daqui, senão MODEL_CHAT/MODEL_TAREFA na Vercel não tem
// efeito em metade das rotas (era o que acontecia antes desta centralização).
//
// MODEL_CHAT: conversas interativas (Cérebro no chat, auto-resposta do
// WhatsApp, briefings). MODEL_TAREFA: extrações/geração em lote (fichas
// técnicas, battlecards, prospecção, resumo de cliente) — pode usar um
// modelo mais barato se o custo apertar.
export const MODEL_CHAT = process.env.MODEL_CHAT || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
export const MODEL_TAREFA = process.env.MODEL_TAREFA || process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

// Modelo da OpenAI usado pelo Orientador de Vendas (e por qualquer chamada de
// texto quando OPENAI_API_KEY é o provedor ativo — ver provedorIA() em index.ts).
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
