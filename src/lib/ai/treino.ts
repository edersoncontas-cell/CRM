// Treino com IA da Academia de Vendas: simulador de cliente em DUAS rodadas.
// A IA cria um cliente do nicho (com perfil DISC e uma objeção/situação do
// módulo), o vendedor responde, o cliente REPLICA (como na vida real: a
// primeira resposta raramente resolve), o vendedor responde de novo e aí sai
// a nota — por rubrica de 5 critérios, com correções e a versão de elite.
// Roteado por llmTexto (Gemini/Groq grátis, com fallback).

import { llmTexto, iaHabilitada } from "./index";

const CONTEXTO = `Mercado: venda consultiva de máquinas pesadas New Holland Construction (retroescavadeiras B95C/B110B,
escavadeiras E145C/E175C/E215C/E245C, pás-carregadeiras W130B/W170B/W190B, motoniveladoras RG140B/RG170B) e
e a linha Dynapac de compactação e pavimentação (rolos de solo CA15 D a CA65 PD, tandem CC2200 VI/CC4200 VI,
pneumáticos CP2100/CP2700, vibroacabadoras SD2500CS) no sul do Espírito Santo. Clientes típicos:
construtoras e empreiteiras, prefeituras (licitação/pregão), pedreiras/mineração de granito, produtores e
cooperativas de café, locadoras de máquinas, pequenos terraplenadores. Concorrentes: Caterpillar, Komatsu, Volvo,
JCB, Case, XCMG, Sany, LiuGong. Financiamento: FINAME/BNDES, CDC de banco, consórcio, Banco CNH, usada na troca.`;

export type CenarioTreino = {
  cliente: string;
  perfil: string;      // DISC + traço (ex.: "D — direto, impaciente, decide sozinho")
  situacao: string;
  fala: string;
  objetivo: string;
  armadilha: string;   // o que costuma dar errado nesse cenário (o vendedor não vê antes de responder)
  dificuldade: 1 | 2 | 3;
};

export type RodadaTreino = { vendedor: string; cliente: string };

const DIFICULDADE = {
  1: "cliente aberto, objeção simples e explícita",
  2: "cliente ocupado e cético, objeção escondida atrás de outra (cortina de fumaça)",
  3: "cliente difícil: sócio contra, concorrente com proposta na mesa, prazo curto e pressão por desconto",
} as const;

export async function gerarCenarioTreinoIA(args: { tema: string; nivel: number; foco: string; objetivos: string[]; dificuldade: 1 | 2 | 3 }): Promise<CenarioTreino | null> {
  if (!iaHabilitada()) return null;
  try {
    const raw = await llmTexto(
      `Você é o treinador de vendas de um vendedor de máquinas pesadas. ${CONTEXTO}
Crie UM cenário de treino realista para o módulo "${args.tema}" (nível ${args.nivel} de 10).
O que o módulo ensina: ${args.objetivos.join(" | ")}
Dificuldade ${args.dificuldade}: ${DIFICULDADE[args.dificuldade]}.
Devolva SOMENTE JSON: { "cliente": string, "perfil": string, "situacao": string, "fala": string, "objetivo": string, "armadilha": string }
- "cliente": quem é (nome fictício, empresa/nicho, cidade do sul do ES) — 1 frase.
- "perfil": letra DISC e dois traços de comportamento (ex.: "C — analítico, desconfia de promessa sem número").
- "situacao": contexto (máquina de interesse, momento da negociação, o que já aconteceu, quem decide) — 2 a 3 frases.
- "fala": exatamente o que o cliente diz agora, em primeira pessoa, como numa mensagem de WhatsApp ou na obra — natural, com a objeção/desafio do módulo. Se a dificuldade for 2 ou 3, a fala esconde a objeção real atrás de outra.
- "objetivo": o que o vendedor precisa conseguir com a resposta — 1 frase.
- "armadilha": o erro mais comum de vendedor nesse cenário — 1 frase.
Varie nicho, máquina, perfil DISC e situação a cada cenário. Português do Brasil. Sem emojis.`,
      `Gere o cenário (semente: ${Date.now() % 10_000}).`,
      { maxTokens: 500, json: true }
    );
    const p = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    if (!p.cliente || !p.fala) return null;
    return {
      cliente: String(p.cliente), perfil: String(p.perfil ?? ""), situacao: String(p.situacao ?? ""), fala: String(p.fala),
      objetivo: String(p.objetivo ?? ""), armadilha: String(p.armadilha ?? ""), dificuldade: args.dificuldade,
    };
  } catch (e) {
    console.error("[treino] cenário:", e instanceof Error ? e.message : e);
    return null;
  }
}

export type CriterioTreino = { nome: string; nota: number; comentario: string }; // nota 0-2

export type AvaliacaoTreino = {
  final: boolean;              // false = a conversa continua (veio a réplica do cliente)
  replicaCliente: string;      // o que o cliente responde (só quando !final)
  nota: number;                // 0-10 (só quando final)
  criterios: CriterioTreino[]; // rubrica (só quando final)
  pontosFortes: string[];
  melhorias: string[];
  versaoMelhorada: string;
  proximoPasso: string;
};

const RUBRICA = `Rubrica (0 a 2 pontos cada; nota = soma, máximo 10):
1. Acolhimento e diagnóstico: reconheceu o que o cliente disse, fez a pergunta certa, isolou a objeção real (não respondeu a desculpa).
2. Valor e prova: reenquadrou com fato, conta (custo/hora, TCO, revenda, custo da máquina parada) ou prova social — sem inventar número.
3. Condução: levou para um próximo passo concreto (visita, conta junto, proposta, data), sem pedir "me avisa".
4. Tom e adequação ao perfil: linguagem de WhatsApp/obra, curta, no ritmo do perfil DISC do cliente, sem depreciar concorrente, sem submissão nem arrogância.
5. Estratégia: não cedeu preço de graça, tratou o decisor/sócio/prazo, evitou a armadilha do cenário.`;

export async function avaliarRespostaTreinoIA(args: {
  tema: string; objetivos: string[]; cenario: CenarioTreino; rodadas: RodadaTreino[]; resposta: string;
}): Promise<AvaliacaoTreino | null> {
  if (!iaHabilitada()) return null;
  const primeiraRodada = args.rodadas.length === 0;
  const historico = [
    `Cliente disse: "${args.cenario.fala}"`,
    ...args.rodadas.flatMap((r) => [`Vendedor respondeu: "${r.vendedor}"`, `Cliente replicou: "${r.cliente}"`]),
    `Vendedor respondeu agora: "${args.resposta}"`,
  ].join("\n");
  try {
    const raw = await llmTexto(
      primeiraRodada
        ? `Você interpreta o CLIENTE do cenário de treino e, ao mesmo tempo, é o treinador. ${CONTEXTO}
Módulo: "${args.tema}". O que o módulo ensina: ${args.objetivos.join(" | ")}
Perfil do cliente: ${args.cenario.perfil}. Armadilha do cenário: ${args.cenario.armadilha}.
Leia a resposta do vendedor e faça duas coisas:
(a) Como o CLIENTE, replique de forma realista e coerente com o perfil: se a resposta foi boa, avance um passo mas traga uma segunda camada (prazo, sócio, condição, concorrente); se foi fraca, reaja como um cliente reagiria (frieza, insistência no preço, "vou pensar"). 1 a 3 frases, primeira pessoa, sem emojis.
(b) Como TREINADOR, aponte em 1 a 3 itens o que já dá para melhorar antes da segunda resposta (sem dar a resposta pronta).
Devolva SOMENTE JSON: { "replicaCliente": string, "dicas": string[] }`
        : `Você é um gerente comercial sênior e treinador exigente de vendas consultivas de máquinas pesadas. ${CONTEXTO}
Módulo: "${args.tema}". O que o módulo ensina: ${args.objetivos.join(" | ")}
Perfil do cliente: ${args.cenario.perfil}. Objetivo do vendedor: ${args.cenario.objetivo}. Armadilha do cenário: ${args.cenario.armadilha}.
Avalie a CONVERSA INTEIRA do vendedor (as duas respostas) pela rubrica abaixo.
${RUBRICA}
Devolva SOMENTE JSON: { "criterios": [{ "nome": string, "nota": number, "comentario": string }] (5 itens, na ordem da rubrica), "pontosFortes": string[], "melhorias": string[], "versaoMelhorada": string, "proximoPasso": string }
- "melhorias": 2 a 4 itens concretos e diretos, citando o que o vendedor escreveu.
- "versaoMelhorada": a ÚLTIMA resposta reescrita como um vendedor de elite mandaria (curta, natural, 2-5 frases, sem emojis).
- "proximoPasso": o que o vendedor deve fazer em seguida na negociação (1 frase).
Seja honesto: 2 pontos num critério só para execução realmente excelente. Português do Brasil.`,
      `CENÁRIO
Cliente: ${args.cenario.cliente}
Situação: ${args.cenario.situacao}

CONVERSA
${historico}`,
      { maxTokens: 900, json: true }
    );
    const p = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    if (primeiraRodada) {
      return {
        final: false, replicaCliente: String(p.replicaCliente ?? "").trim() || "Hmm. E o que mais?",
        nota: 0, criterios: [], pontosFortes: [], melhorias: lista(p.dicas), versaoMelhorada: "", proximoPasso: "",
      };
    }
    const criterios: CriterioTreino[] = (Array.isArray(p.criterios) ? p.criterios : []).slice(0, 5).map((c: Record<string, unknown>) => ({
      nome: String(c.nome ?? ""), nota: Math.max(0, Math.min(2, Math.round(Number(c.nota) || 0))), comentario: String(c.comentario ?? ""),
    }));
    const nota = criterios.length ? Math.min(10, criterios.reduce((s, c) => s + c.nota, 0)) : Math.max(0, Math.min(10, Math.round(Number(p.nota) || 0)));
    return {
      final: true, replicaCliente: "", nota, criterios,
      pontosFortes: lista(p.pontosFortes), melhorias: lista(p.melhorias),
      versaoMelhorada: String(p.versaoMelhorada ?? ""), proximoPasso: String(p.proximoPasso ?? ""),
    };
  } catch (e) {
    console.error("[treino] avaliação:", e instanceof Error ? e.message : e);
    return null;
  }
}
