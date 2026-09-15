// Assistente de configuração do filtro de contatos: transforma um pedido em
// português ("bloqueia quem tem 'despachante' no nome", "libera hotel") num
// plano de mudança nas listas. Só a chamada à IA mora aqui; a normalização do
// JSON (pura, testada) está em filtro-contatos-plano.ts.

import { llmTexto, iaHabilitada } from "@/lib/ai";
import { normalizarPlanoFiltro, type PlanoFiltro } from "@/lib/filtro-contatos-plano";

export type { MudancaFiltro, PlanoFiltro } from "@/lib/filtro-contatos-plano";

export async function interpretarComandoFiltro(comando: string, atual: { termos: string[]; palavras: string[] }): Promise<PlanoFiltro> {
  if (!iaHabilitada()) {
    return { resposta: "A IA não está configurada — adicione ou remova os termos manualmente pelas caixinhas acima.", adicionar: [], remover: [] };
  }
  const system = `Você é o assistente de configuração do filtro de contatos de um CRM de vendedor de máquinas pesadas.
O filtro barra contatos que NÃO são clientes (contabilidade, banco, financeira, hotel, restaurante…): pelo nome do
contato, eles nunca entram no CRM e, se já existem, são apagados com todo o histórico.

Há dois tipos de regra:
- "palavra": bate só como palavra inteira do nome ("banco" pega "Banco do Brasil", não pega "Bancorbrás").
- "termo": bate como pedaço de qualquer palavra ("contab" pega contabilidade, contábil, contábeis).
Use "palavra" por padrão. Use "termo" só quando o vendedor pedir um pedaço/prefixo ou disser "qualquer coisa que
contenha/comece com", ou quando a palavra tiver muitas variações óbvias (contab, financeir).

Listas atuais:
- termos: ${JSON.stringify(atual.termos)}
- palavras: ${JSON.stringify(atual.palavras)}

Devolva SOMENTE um JSON válido:
{
  "resposta": string,                 // 1-2 frases, direto, confirmando o que vai mudar (ou explicando, se for só pergunta)
  "adicionar": [ { "tipo": "termo"|"palavra", "valor": string } ],
  "remover":   [ { "tipo": "termo"|"palavra", "valor": string } ]
}
Regras:
- "valor" sempre minúsculo e sem acento. Um pedido pode gerar várias entradas ("bloqueia despachante e cartório").
- "liberar", "desbloquear", "tirar", "parar de bloquear" = remover. "bloquear", "barrar", "não deixar entrar" = adicionar.
- Para remover, use exatamente o valor que está na lista atual (e o tipo em que ele está).
- Se for só uma pergunta ("o que está bloqueado?"), responda em "resposta" e deixe as listas vazias.
- Não invente regras que o vendedor não pediu. Nunca adicione nomes de pessoas.`;
  try {
    const raw = await llmTexto(system, `Pedido do vendedor: ${comando}`, { maxTokens: 600, json: true });
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return normalizarPlanoFiltro(parsed, atual);
  } catch (e) {
    console.error("[filtro-contatos-ia] falha ao interpretar:", e);
    return { resposta: "Não consegui entender o pedido. Tente algo como: \"bloqueia quem tem despachante no nome\" ou \"libera hotel\".", adicionar: [], remover: [] };
  }
}
