// Continuação do simulador com IA: quando o banco de cenários acaba (ou o
// vendedor pede "mais um"), a IA escreve o PRÓXIMO cenário no mesmo formato,
// levando em conta tudo o que já foi escolhido e as regras do negócio.
//
// Sem chave de IA nada quebra: a tela só oferece o banco de cenários.

import { llmTexto, iaHabilitada } from "@/lib/ai";
import { lerParametros } from "@/lib/parametros";
import { regrasParaPrompt } from "@/lib/contexto-negocio";
import { ETAPAS_POR_ID } from "@/lib/academia/etapas";
import type { CenarioSimulador, Qualidade } from "@/lib/academia/simulador";

export type HistoricoSimulador = { situacao: string; escolha: string; qualidade: Qualidade }[];

const QUALIDADES: Qualidade[] = ["boa", "media", "ruim"];

function limpar(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// Valida e normaliza o JSON da IA para o formato do simulador.
export function normalizarCenarioIA(raw: string, etapa: string, indice: number): CenarioSimulador | null {
  const ini = raw.indexOf("{");
  const fim = raw.lastIndexOf("}");
  if (ini === -1 || fim === -1) return null;
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(raw.slice(ini, fim + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const opcoesRaw = Array.isArray(p.opcoes) ? p.opcoes : [];
  const opcoes = opcoesRaw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .map((o, i) => ({
      id: String.fromCharCode(97 + i),
      texto: limpar(o.texto, 400),
      qualidade: (QUALIDADES.includes(limpar(o.qualidade, 10) as Qualidade) ? limpar(o.qualidade, 10) : "media") as Qualidade,
      feedback: limpar(o.feedback, 600),
    }))
    .filter((o) => o.texto && o.feedback)
    .slice(0, 4);

  const contexto = limpar(p.contexto, 800);
  const pergunta = limpar(p.pergunta, 200);
  if (!contexto || opcoes.length < 2 || !opcoes.some((o) => o.qualidade === "boa")) return null;

  const canal = ["mensagem", "telefone", "presencial"].includes(limpar(p.canal, 20)) ? (limpar(p.canal, 20) as CenarioSimulador["canal"]) : "mensagem";
  const desfechoRaw = (p.desfecho && typeof p.desfecho === "object" ? p.desfecho : null) as Record<string, unknown> | null;
  const tipo = limpar(desfechoRaw?.tipo, 10);

  return {
    id: `ia-${etapa}-${indice}`,
    etapa,
    titulo: limpar(p.titulo, 80) || "Continuando a conversa",
    canal,
    contexto,
    falaDoCliente: limpar(p.falaDoCliente, 400) || undefined,
    pergunta: pergunta || "O que você faz?",
    opcoes,
    desfecho: ["ganhou", "perdeu", "travou"].includes(tipo)
      ? { tipo: tipo as "ganhou" | "perdeu" | "travou", texto: limpar(desfechoRaw?.texto, 400) }
      : undefined,
  };
}

export async function gerarCenarioComIA(args: {
  etapa: string;
  historico: HistoricoSimulador;
  indice: number;
  dificuldade?: 1 | 2 | 3;
}): Promise<{ ok: boolean; cenario?: CenarioSimulador; erro?: string }> {
  if (!iaHabilitada()) return { ok: false, erro: "Configure uma chave de IA para a Academia continuar a simulação." };

  const etapa = ETAPAS_POR_ID.get(args.etapa);
  const [p, regras] = await Promise.all([lerParametros(), regrasParaPrompt("academia").catch(() => "")]);
  const dif = args.dificuldade ?? 2;

  const system = `Você é o professor da Academia de Vendas de ${p.nomeVendedor}, vendedor de máquinas pesadas (${p.marcas}) no ${p.regiao}.
Você conduz uma SIMULAÇÃO de venda: escreve a próxima cena e três opções de resposta, e o aluno escolhe uma.
${regras ? `\n${regras}\n` : ""}
${etapa ? `Etapa em treino: ${etapa.nome} — ${etapa.objetivo}
O que se cobra nesta etapa: ${etapa.criteriosDeAvanco.join("; ")}.
Erros clássicos: ${etapa.erros.join("; ")}.` : ""}

Dificuldade ${dif} de 3 (1 = cliente colaborativo, 3 = cliente arisco, com concorrente na mesa e pressa).

Regras da cena:
- A cena CONTINUA a história a partir das escolhas anteriores. Cite o que o aluno escolheu antes.
- Cliente do sul do ES: construtora, empreiteiro, pedreira, cafeicultor, prefeitura, locadora. Fale como eles falam.
- Três opções: uma claramente boa, uma medíocre (parece certa e custa caro) e uma ruim. Nunca deixe óbvio pela ordem.
- O feedback de cada opção explica a CONSEQUÊNCIA comercial, não a teoria.
- Nunca invente preço, taxa, prazo de entrega ou especificação de máquina. Se precisar de número, use os que o aluno já citou.
- Se a história chegou ao fim (fechou, perdeu ou travou), preencha "desfecho".
- Português do Brasil, sem emojis.

Responda SOMENTE um JSON:
{"titulo":"<curto>","canal":"mensagem|telefone|presencial","contexto":"<a cena, 2-4 frases>","falaDoCliente":"<o que ele disse, nas palavras dele>","pergunta":"<o que se pede do aluno>","opcoes":[{"texto":"<o que o vendedor fala/faz>","qualidade":"boa|media|ruim","feedback":"<consequência comercial>"}],"desfecho":{"tipo":"ganhou|perdeu|travou","texto":"<o que aconteceu>"}|null}`;

  const user = args.historico.length
    ? `História até aqui:\n${args.historico.map((h, i) => `${i + 1}. Cena: ${h.situacao}\n   O aluno escolheu (${h.qualidade}): ${h.escolha}`).join("\n")}\n\nEscreva a próxima cena.`
    : "Comece a simulação com a primeira cena desta etapa.";

  try {
    const raw = await llmTexto(system, user, { maxTokens: 1200, json: true });
    const cenario = normalizarCenarioIA(raw, args.etapa, args.indice);
    if (!cenario) return { ok: false, erro: "A IA respondeu fora do formato. Tente de novo." };
    return { ok: true, cenario };
  } catch (e) {
    const { mensagemErroIA } = await import("@/lib/ai/erros");
    return { ok: false, erro: mensagemErroIA(e) };
  }
}
