// Tradução dos erros dos provedores de IA para uma frase que o vendedor
// entende (em vez do JSON cru do Groq no painel). Módulo PURO, testável.

import { mensagemDeCota } from "@/lib/ai/cota";

export function erroDeCotaIA(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  // "Groq: nenhum modelo disponível" entra aqui: ele é o desfecho de todos os
  // modelos terem estourado a cota. Sem isso, o painel mostrava essa frase
  // técnica crua para o vendedor, que não diz nem o que houve nem o que fazer.
  return /\b429\b|rate.?limit|tokens per (day|minute)|\bTPD\b|\bTPM\b|quota|RESOURCE_EXHAUSTED|insufficient_quota|nenhum modelo dispon/i.test(msg);
}

export function mensagemErroIA(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Nenhum provedor de IA configurado|Nenhuma chave de IA/i.test(msg)) {
    return "Nenhuma chave de IA configurada. Defina GEMINI_API_KEY (grátis) ou GROQ_API_KEY na Vercel.";
  }
  if (erroDeCotaIA(msg)) {
    // NÃO mandar configurar chave aqui. A mensagem antiga dizia "configure
    // GEMINI_API_KEY (grátis) como reserva" para quem já tinha a chave
    // configurada — conselho inútil, e ainda aparecia numa tarja vermelha
    // sobre o painel do Orientador, dando a entender que a leitura estava
    // errada. Ela não estava: só não tinha acabado de ser atualizada.
    //
    // E, principalmente: dizer "acabou por hoje" num limite POR MINUTO é
    // falso e caro. A cota volta em segundos; o vendedor que lê "acabou hoje"
    // passa o dia sem o painel por causa de uma rajada de 9 segundos. Agora a
    // frase sai do que o provedor informou — ver lib/ai/cota.ts.
    return mensagemDeCota(msg);
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
