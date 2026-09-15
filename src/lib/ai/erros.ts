// Tradução dos erros dos provedores de IA para uma frase que o vendedor
// entende (em vez do JSON cru do Groq no painel). Módulo PURO, testável.

export function erroDeCotaIA(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /\b429\b|rate.?limit|tokens per (day|minute)|\bTPD\b|\bTPM\b|quota|RESOURCE_EXHAUSTED|insufficient_quota/i.test(msg);
}

export function mensagemErroIA(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Nenhum provedor de IA configurado|Nenhuma chave de IA/i.test(msg)) {
    return "Nenhuma chave de IA configurada. Defina GEMINI_API_KEY (grátis) ou GROQ_API_KEY na Vercel.";
  }
  if (erroDeCotaIA(msg)) {
    return "A cota diária grátis de IA acabou em todos os provedores configurados. Ela volta sozinha à meia-noite (UTC). Para não parar: configure GEMINI_API_KEY (grátis) como reserva na Vercel.";
  }
  if (/does not exist|model_not_found|decommissioned|deprecated/i.test(msg)) {
    return "O modelo de IA configurado foi desativado pelo provedor. O CRM já troca sozinho para o próximo — tente de novo em instantes.";
  }
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|fetch failed|network/i.test(msg)) {
    return "O provedor de IA demorou demais para responder. Tente de novo em instantes.";
  }
  if (/Failed to validate JSON|json_validate_failed|Unexpected token|JSON/i.test(msg)) {
    return "A IA devolveu uma resposta em formato inesperado. Tente de novo — em geral funciona na segunda vez.";
  }
  // Fallback: a mensagem original, curta e sem o JSON do provedor.
  const limpa = msg.replace(/\{.*\}/s, "").replace(/\s+/g, " ").trim();
  return limpa ? limpa.slice(0, 160) : "Falha na IA. Tente de novo em instantes.";
}
