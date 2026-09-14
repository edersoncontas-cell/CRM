// Treino com IA da Academia de Vendas: gera um cenário realista (cliente do
// nicho com uma objeção/situação) e avalia a resposta do vendedor com nota e
// versão melhorada. Roteado por llmTexto (Gemini/Groq grátis, com fallback).

import { llmTexto, iaHabilitada } from "./index";

const CONTEXTO = `Mercado: venda consultiva de máquinas pesadas New Holland Construction (retroescavadeiras B95C/B110B,
escavadeiras E145C/E175C/E215C/E245C, pás-carregadeiras W130B/W170B/W190B, motoniveladoras RG140B/RG170B) e
rolos compactadores Dynapac (CA1500/CA2500/CA3500, CC1200/CC2200) no sul do Espírito Santo. Clientes típicos:
construtoras e empreiteiras, prefeituras, pedreiras/mineração de granito, produtores e cooperativas de café,
locadoras de máquinas, pequenos terraplenadores. Concorrentes: Caterpillar, Komatsu, Volvo, JCB, Case, XCMG, Sany.`;

export type CenarioTreino = { cliente: string; situacao: string; fala: string; objetivo: string };

export async function gerarCenarioTreinoIA(tema: string, nivel: number, foco: string): Promise<CenarioTreino | null> {
  if (!iaHabilitada()) return null;
  try {
    const raw = await llmTexto(
      `Você é o treinador de vendas de um vendedor de máquinas pesadas. ${CONTEXTO}
Crie UM cenário de treino realista para o módulo "${tema}" (nível ${nivel} de 10, foco: ${foco}).
Devolva SOMENTE JSON: { "cliente": string, "situacao": string, "fala": string, "objetivo": string }
- "cliente": quem é (nome fictício, nicho, cidade do sul do ES, perfil DISC implícito) — 1 frase.
- "situacao": contexto da negociação (máquina de interesse, momento, o que já aconteceu) — 2 frases.
- "fala": exatamente o que o cliente diz agora, em primeira pessoa, como numa mensagem de WhatsApp ou na obra — natural, com a objeção/desafio do módulo.
- "objetivo": o que o vendedor precisa conseguir com a resposta — 1 frase.
Varie nicho, máquina e situação a cada cenário. Português do Brasil. Sem emojis.`,
      `Gere o cenário (semente: ${Date.now() % 1000}).`,
      { maxTokens: 400, json: true }
    );
    const p = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    if (!p.cliente || !p.fala) return null;
    return { cliente: String(p.cliente), situacao: String(p.situacao ?? ""), fala: String(p.fala), objetivo: String(p.objetivo ?? "") };
  } catch (e) {
    console.error("[treino] cenário:", e instanceof Error ? e.message : e);
    return null;
  }
}

export type AvaliacaoTreino = { nota: number; pontosFortes: string[]; melhorias: string[]; versaoMelhorada: string; proximoPasso: string };

export async function avaliarRespostaTreinoIA(args: { tema: string; cenario: CenarioTreino; resposta: string }): Promise<AvaliacaoTreino | null> {
  if (!iaHabilitada()) return null;
  try {
    const raw = await llmTexto(
      `Você é um gerente comercial sênior e treinador exigente de vendas consultivas de máquinas pesadas. ${CONTEXTO}
Avalie a resposta do vendedor ao cliente no cenário de treino do módulo "${args.tema}". Critérios: acolheu e isolou a
objeção, fez pergunta certa, reenquadrou com valor/fatos (custo total, produtividade, rede), conduziu para um próximo
passo/fechamento, tom natural de WhatsApp/obra, sem inventar dados, sem depreciar concorrente.
Devolva SOMENTE JSON: { "nota": number (0-10), "pontosFortes": string[], "melhorias": string[], "versaoMelhorada": string, "proximoPasso": string }
- "melhorias": 2 a 4 itens concretos e diretos.
- "versaoMelhorada": a resposta reescrita como um vendedor de elite mandaria (curta, natural, 2-5 frases, sem emojis).
- "proximoPasso": o que o vendedor deve fazer em seguida na negociação (1 frase).
Seja honesto na nota: 9-10 só para resposta realmente excelente. Português do Brasil.`,
      `CENÁRIO
Cliente: ${args.cenario.cliente}
Situação: ${args.cenario.situacao}
Cliente disse: "${args.cenario.fala}"
Objetivo do vendedor: ${args.cenario.objetivo}

RESPOSTA DO VENDEDOR
${args.resposta}`,
      { maxTokens: 700, json: true }
    );
    const p = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
    return {
      nota: Math.max(0, Math.min(10, Math.round(Number(p.nota) || 0))),
      pontosFortes: lista(p.pontosFortes),
      melhorias: lista(p.melhorias),
      versaoMelhorada: String(p.versaoMelhorada ?? ""),
      proximoPasso: String(p.proximoPasso ?? ""),
    };
  } catch (e) {
    console.error("[treino] avaliação:", e instanceof Error ? e.message : e);
    return null;
  }
}
