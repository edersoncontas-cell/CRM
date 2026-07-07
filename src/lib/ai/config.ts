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
