// Coaching do Orientador de Vendas — a parte "gerente ao lado": personalidade
// do cliente e como falar com ele, avaliação da condução do vendedor, alerta
// do momento (ex.: "não passe o preço ainda"), perguntas que destravam a
// venda, roteiro até o fechamento, sinais e objeções com tratamento.
// Este arquivo é PURO (tipos, método e normalização do JSON da IA) para ser
// testável; quem chama a IA e grava é orientador.ts.

export type EstiloCliente = "Dominante" | "Influente" | "Estável" | "Analítico";
export type NivelAlerta = "vermelho" | "amarelo" | "verde";
export type StatusEtapa = "feito" | "agora" | "depois";

export type Coaching = {
  personalidade: {
    estilo: EstiloCliente | null;
    descricao: string;
    comoFalar: string[];
    evitar: string[];
    papel: "decisor" | "influenciador" | "pesquisador" | null;
  };
  alertaAgora: { nivel: NivelAlerta; titulo: string; motivo: string } | null;
  conducao: { nota: number; acertos: string[]; correcoes: string[] };
  perguntasAgora: string[];
  informacoesFaltando: string[];
  roteiro: { etapa: string; status: StatusEtapa; dica: string }[];
  sinaisCompra: string[];
  sinaisRisco: string[];
  tratamentoObjecoes: { objecao: string; comoTratar: string }[];
  // Liga o Orientador à Academia de Vendas: a técnica que se aplica NESTE
  // momento da conversa, com o motivo — o vendedor treina o que está usando.
  tecnicaAcademia: { nome: string; porque: string } | null;
};

export const ESTILOS_CLIENTE: EstiloCliente[] = ["Dominante", "Influente", "Estável", "Analítico"];
export const ETAPAS_ROTEIRO = ["Abertura e rapport", "Qualificação", "Visita", "Proposta", "Pagamento e financiamento", "Fechamento", "Pós-venda"];

// Método de venda de máquina pesada que o Orientador cobra do vendedor.
export const METODO_VENDA = `## Método de venda de máquina pesada (o que você cobra do vendedor)
QUALIFICAR ANTES DE PRECIFICAR. Preço só depois de saber: (1) aplicação/serviço e material, (2) prazo da
necessidade (obra começa quando?), (3) forma de pagamento (à vista, financiamento, consórcio, CRD/PME, banco) e
(4) quem decide (sócio, família, engenheiro). Se o cliente pede preço de cara, o vendedor NÃO passa: reconhece o
pedido, explica que a configuração certa (e o preço certo) depende de 2 ou 3 informações e pergunta. Preço solto
vira comparação de tabela com concorrente e mata a venda.
VISITA É O PIVÔ. O objetivo de toda conversa inicial é a visita (ver a obra/propriedade, o terreno) —
ali se vende valor: custo por hora, disponibilidade, assistência, revenda, consumo (calculadora de combustível).
PROPOSTA FORMAL COM FINANCIAMENTO PRONTO: depois da visita, proposta por escrito com condição de pagamento
desenhada (entrada, prazo, banco, CRD) — nunca "vou ver e te falo" sem data.
FECHAMENTO É PERGUNTA DIRETA: quando os sinais somam (prazo, dinheiro definido, decisor na mesa, objeções
tratadas), o vendedor pede o pedido: "fechamos para entrega em X?".
SEMPRE: responder o que foi perguntado, avançar UM passo por mensagem, terminar com UMA pergunta fechada, nunca
inventar preço/prazo/especificação, nunca depreciar concorrente, nunca textão.

## Personalidade do cliente (leia pelo jeito de escrever)
- Dominante: mensagens curtas, direto ao ponto, quer resultado e rapidez. Fale objetivo, dê opções e decisão.
- Influente: fala bastante, emoção, relacionamento, emojis. Converse, valorize a relação, leve para a visita.
- Estável: cauteloso, quer segurança, pergunta de garantia e assistência, demora. Dê passo a passo, referências.
- Analítico: pede ficha técnica, compara, quer números. Traga dados, custo por hora, comparativo; sem pressa.`;

const texto = (v: unknown, max = 400): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lista = (v: unknown, max = 6, tam = 240): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, tam)).slice(0, max) : [];

export function coachingVazio(): Coaching {
  return {
    personalidade: { estilo: null, descricao: "", comoFalar: [], evitar: [], papel: null },
    alertaAgora: null,
    conducao: { nota: 5, acertos: [], correcoes: [] },
    perguntasAgora: [],
    informacoesFaltando: [],
    roteiro: [],
    sinaisCompra: [],
    sinaisRisco: [],
    tratamentoObjecoes: [],
    tecnicaAcademia: null,
  };
}

// Normaliza o JSON da IA para a estrutura acima (tolerante a campos faltando).
export function normalizarCoaching(raw: unknown): Coaching {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pers = (p.personalidade && typeof p.personalidade === "object" ? p.personalidade : {}) as Record<string, unknown>;
  const cond = (p.conducao && typeof p.conducao === "object" ? p.conducao : {}) as Record<string, unknown>;
  const al = (p.alertaAgora && typeof p.alertaAgora === "object" ? p.alertaAgora : null) as Record<string, unknown> | null;
  const nivel = al && ["vermelho", "amarelo", "verde"].includes(String(al.nivel)) ? (al.nivel as NivelAlerta) : null;
  const notaRaw = Number(cond.nota);
  const nota = Number.isFinite(notaRaw) ? Math.max(0, Math.min(10, Math.round(notaRaw))) : 5;
  const estilo = ESTILOS_CLIENTE.includes(pers.estilo as EstiloCliente) ? (pers.estilo as EstiloCliente) : null;
  const papel = ["decisor", "influenciador", "pesquisador"].includes(String(pers.papel)) ? (pers.papel as Coaching["personalidade"]["papel"]) : null;

  const roteiro = Array.isArray(p.roteiro)
    ? p.roteiro
        .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
        .map((e) => ({ etapa: texto(e.etapa, 60), status: (["feito", "agora", "depois"].includes(String(e.status)) ? e.status : "depois") as StatusEtapa, dica: texto(e.dica, 200) }))
        .filter((e) => e.etapa)
        .slice(0, 8)
    : [];
  const tratamento = Array.isArray(p.tratamentoObjecoes)
    ? p.tratamentoObjecoes
        .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
        .map((e) => ({ objecao: texto(e.objecao, 60), comoTratar: texto(e.comoTratar, 300) }))
        .filter((e) => e.objecao && e.comoTratar)
        .slice(0, 6)
    : [];

  return {
    personalidade: { estilo, descricao: texto(pers.descricao, 300), comoFalar: lista(pers.comoFalar, 4), evitar: lista(pers.evitar, 4), papel },
    alertaAgora: nivel && texto(al!.titulo) ? { nivel, titulo: texto(al!.titulo, 120), motivo: texto(al!.motivo, 300) } : null,
    conducao: { nota, acertos: lista(cond.acertos, 4), correcoes: lista(cond.correcoes, 4) },
    perguntasAgora: lista(p.perguntasAgora, 4),
    informacoesFaltando: lista(p.informacoesFaltando, 6, 120),
    roteiro,
    sinaisCompra: lista(p.sinaisCompra, 5),
    sinaisRisco: lista(p.sinaisRisco, 5),
    tratamentoObjecoes: tratamento,
    tecnicaAcademia: (() => {
      const t = (p.tecnicaAcademia && typeof p.tecnicaAcademia === "object" ? p.tecnicaAcademia : null) as Record<string, unknown> | null;
      const nome = texto(t?.nome, 80);
      return nome ? { nome, porque: texto(t?.porque, 240) } : null;
    })(),
  };
}

// Dicas condensadas do coaching para a geração da resposta ao cliente.
export function dicasParaResposta(c: Coaching, proximaAcao: string): string {
  const linhas: string[] = [];
  if (c.alertaAgora) linhas.push(`ALERTA (${c.alertaAgora.nivel}): ${c.alertaAgora.titulo}. ${c.alertaAgora.motivo}`);
  if (c.personalidade.estilo) linhas.push(`Cliente ${c.personalidade.estilo}${c.personalidade.papel ? ` (${c.personalidade.papel})` : ""}: ${c.personalidade.comoFalar.join("; ")}${c.personalidade.evitar.length ? `. Evite: ${c.personalidade.evitar.join("; ")}` : ""}`);
  if (c.informacoesFaltando.length) linhas.push(`Ainda falta saber: ${c.informacoesFaltando.join("; ")}`);
  if (c.perguntasAgora.length) linhas.push(`Perguntas que destravam agora: ${c.perguntasAgora.join(" | ")}`);
  if (c.tecnicaAcademia) linhas.push(`Técnica da Academia para agora: ${c.tecnicaAcademia.nome} — ${c.tecnicaAcademia.porque}`);
  if (proximaAcao) linhas.push(`Próxima ação definida: ${proximaAcao}`);
  return linhas.join("\n");
}
