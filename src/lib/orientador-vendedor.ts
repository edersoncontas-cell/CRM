// O ORIENTADOR DO VENDEDOR.
//
// O Orientador que já existia olha o CLIENTE: o que responder para aquele
// cara, qual a próxima ação, qual a temperatura. Este aqui olha para o OUTRO
// lado do balcão — o vendedor. Onde ELE trava, o que ELE repete, o que ELE
// precisa estudar.
//
// A diferença prática: conselho sobre cliente resolve uma venda; conselho
// sobre o vendedor resolve as próximas cem. Mas só vale se vier de número
// medido, não de achismo — por isso cada sinal daqui nasce de um fato do CRM e
// carrega o fato junto na tela. "Você perde por preço" ele discute; "das suas
// 10 perdas, 6 foram por preço" ele não tem como discutir.
//
// Módulo PURO: recebe os fatos já contados e devolve o diagnóstico. Não toca
// no banco (isso é o orientador-vendedor-dados.ts) justamente para a régua do
// diagnóstico dar para provar em teste, sem banco e sem IA.

import { MOTIVOS_PERDA } from "@/lib/pipeline";

/** Os números crus do vendedor no período, já contados. */
export type FatosVendedor = {
  /** Quantos meses a janela cobre — entra no texto, para o número ter escala. */
  meses: number;

  // ── Funil: quantas passaram por cada fase no período ──
  /** Negociações que ENTRARAM no funil no período. */
  criadas: number;
  /** Chegaram a virar proposta (ou passaram disso). */
  chegaramProposta: number;
  /** Chegaram a negociação com crédito aprovado (ou passaram disso). */
  chegaramNegociacao: number;
  /** Faturadas. */
  faturadas: number;

  // ── Perdas ──
  perdidas: number;
  /** Contagem por chave de motivo ("preco", "credito"…). */
  perdidasPorMotivo: Record<string, number>;
  perdidasSemMotivo: number;
  valorPerdido: number;

  // ── Ritmo ──
  /** Negociações abertas agora. */
  abertas: number;
  /** Dessas, quantas estão paradas há mais de DIAS_PARADA sem contato. */
  abertasParadas: number;

  // ── Conversa ──
  /** Mensagens que ELE mandou no período. */
  mensagensEnviadas: number;
  /** Dessas, quantas têm pergunta (terminam ou contêm "?"). */
  mensagensComPergunta: number;

  // ── Campo ──
  visitasRealizadas: number;
};

/** Uma negociação parada há mais que isto sem contato é follow-up perdido. */
export const DIAS_PARADA = 21;

/** Quantas negociações precisam existir para uma taxa significar alguma coisa. */
export const MINIMO_PARA_TAXA = 5;

export type Gravidade = "critico" | "atencao" | "bom";

export type SinalVendedor = {
  id: string;
  titulo: string;
  /** O fato, em número. É ele que sustenta a leitura. */
  fato: string;
  /** O que o número diz sobre o jeito dele de vender. */
  leitura: string;
  gravidade: Gravidade;
  /** Para onde mandar estudar. */
  modulos: string[];
  etapas: string[];
};

export type Perfil = { titulo: string; descricao: string };

export type DiagnosticoVendedor = {
  perfil: Perfil;
  /** A passagem de fase mais fraca — onde ele mais perde no funil. */
  gargalo: { de: string; para: string; taxa: number; explicacao: string } | null;
  /** Conversão da entrada ao faturamento. */
  taxaGeral: number | null;
  sinais: SinalVendedor[];
  /** Verdade quando não há negociação suficiente para diagnosticar nada. */
  poucosDados: boolean;
};

// ── As passagens de fase ────────────────────────────────────────────────────
//
// A conta é de FUNIL, não de estoque: "de 40 que entraram, 22 viraram
// proposta". Quem está em negociação já passou por proposta, então cada etapa
// conta quem chegou NELA OU PASSOU DELA — senão uma venda rápida, que pulou
// de oportunidade a faturado, apareceria como se tivesse furado o funil.
type Passagem = { de: string; para: string; taxa: number; base: number };

export function passagens(f: FatosVendedor): Passagem[] {
  const p: Passagem[] = [];
  if (f.criadas >= MINIMO_PARA_TAXA) {
    p.push({ de: "Oportunidade", para: "Proposta", taxa: f.chegaramProposta / f.criadas, base: f.criadas });
  }
  if (f.chegaramProposta >= MINIMO_PARA_TAXA) {
    p.push({ de: "Proposta", para: "Negociação", taxa: f.chegaramNegociacao / f.chegaramProposta, base: f.chegaramProposta });
  }
  if (f.chegaramNegociacao >= MINIMO_PARA_TAXA) {
    p.push({ de: "Negociação", para: "Faturado", taxa: f.faturadas / f.chegaramNegociacao, base: f.chegaramNegociacao });
  }
  return p;
}

// Onde estudar cada passagem fraca. Oportunidade→Proposta é diagnóstico (ele
// não descobre o suficiente para propor); Proposta→Negociação é valor e
// objeção; Negociação→Faturado é fechamento.
const ESTUDO_PASSAGEM: Record<string, { modulos: string[]; etapas: string[]; explicacao: string }> = {
  "Oportunidade→Proposta": {
    modulos: ["m4"], etapas: ["qualificacao"],
    explicacao: "Muita conversa que não vira proposta é sinal de diagnóstico raso: você sai da conversa sem saber a aplicação, a hora de máquina e quem decide, e aí não tem o que propor.",
  },
  "Proposta→Negociação": {
    modulos: ["m5", "m7"], etapas: ["proposta", "objecoes"],
    explicacao: "A proposta sai e morre. Ou o valor não ficou de pé na cabeça dele (virou comparação de preço), ou a objeção veio depois que você já tinha saído da mesa.",
  },
  "Negociação→Faturado": {
    modulos: ["m6", "m8"], etapas: ["fechamento"],
    explicacao: "Crédito aprovado e não fatura é o pior lugar para perder: o dinheiro estava na mesa. É fechamento — pedir a assinatura, marcar a data, não deixar esfriar.",
  },
};

// ── O que cada motivo de perda ensina ───────────────────────────────────────
const ESTUDO_MOTIVO: Record<string, { leitura: string; modulos: string[]; etapas: string[] }> = {
  preco: {
    leitura: "Perder por preço quase nunca é preço: é valor que não foi construído antes de o número aparecer. Quando o cliente só tem o preço para comparar, ele compara o preço.",
    modulos: ["m5", "m6"], etapas: ["proposta", "objecoes"],
  },
  concorrente: {
    leitura: "Ele comprou de outro. Isso normalmente se decide antes da proposta, na hora em que alguém entendeu melhor a operação dele do que você.",
    modulos: ["m4", "m5"], etapas: ["qualificacao", "objecoes"],
  },
  credito: {
    leitura: "Crédito que não sai depois da proposta é qualificação que não foi feita antes. Perguntar de faturamento, restrição e entrada no começo economiza semanas.",
    modulos: ["m4"], etapas: ["qualificacao"],
  },
  adiou: {
    leitura: "\"Vou deixar para depois\" quase sempre quer dizer que a urgência nunca ficou clara — quanto custa a ele continuar como está.",
    modulos: ["m8", "m7"], etapas: ["fechamento", "objecoes"],
  },
  usada: {
    leitura: "Perdeu para usada: a conta de custo por hora não foi feita na frente dele. Máquina nova ganha de usada na planilha, não no discurso.",
    modulos: ["m1", "m5"], etapas: ["proposta"],
  },
  sem_retorno: {
    leitura: "Sumiu. Isso é follow-up: sem próxima data marcada, a conversa morre sozinha e a culpa parece do cliente.",
    modulos: ["m8"], etapas: ["fechamento"],
  },
  prazo: {
    leitura: "Prazo de entrega derrubou a venda. É objeção que dá para antecipar — quem fala do prazo antes do cliente perguntar controla a conversa.",
    modulos: ["m7"], etapas: ["objecoes"],
  },
  outro: {
    leitura: "Motivos avulsos. Vale reler estas perdas uma a uma: quando \"outro\" é o campeão, é porque a régua de motivo não está dando conta do que acontece de verdade.",
    modulos: [], etapas: [],
  },
};

function rotulo(motivoId: string): string {
  return MOTIVOS_PERDA.find((m) => m.id === motivoId)?.label ?? motivoId;
}

function pct(x: number): number {
  return Math.round(x * 100);
}

/** O diagnóstico. Só diz o que o número sustenta. */
export function analisarVendedor(f: FatosVendedor): DiagnosticoVendedor {
  const encerradas = f.faturadas + f.perdidas;
  const poucosDados = f.criadas < MINIMO_PARA_TAXA && encerradas < MINIMO_PARA_TAXA;

  const lista = passagens(f);
  const pior = lista.length ? lista.reduce((a, b) => (b.taxa < a.taxa ? b : a)) : null;
  const gargalo = pior
    ? {
        de: pior.de, para: pior.para, taxa: pior.taxa,
        explicacao: ESTUDO_PASSAGEM[`${pior.de}→${pior.para}`]?.explicacao ?? "",
      }
    : null;

  const taxaGeral = f.criadas >= MINIMO_PARA_TAXA ? f.faturadas / f.criadas : null;

  const sinais: SinalVendedor[] = [];

  // 1) O gargalo do funil.
  if (gargalo) {
    const e = ESTUDO_PASSAGEM[`${gargalo.de}→${gargalo.para}`];
    sinais.push({
      id: `gargalo:${gargalo.de}`,
      titulo: `Você trava em ${gargalo.de} → ${gargalo.para}`,
      fato: `${pct(gargalo.taxa)}% passam desta fase (${pior!.base} negociação(ões) na base)`,
      leitura: gargalo.explicacao,
      gravidade: gargalo.taxa < 0.3 ? "critico" : gargalo.taxa < 0.6 ? "atencao" : "bom",
      modulos: e?.modulos ?? [], etapas: e?.etapas ?? [],
    });
  }

  // 2) O motivo de perda que mais se repete.
  const motivos = Object.entries(f.perdidasPorMotivo)
    .filter(([id]) => id !== "nao_informado")
    .sort((a, b) => b[1] - a[1]);
  const [idTop, qtdTop] = motivos[0] ?? [null, 0];
  if (idTop && f.perdidas >= 3) {
    const e = ESTUDO_MOTIVO[idTop];
    const fatia = qtdTop / f.perdidas;
    sinais.push({
      id: `motivo:${idTop}`,
      titulo: `O que mais te derruba: ${rotulo(idTop)}`,
      fato: `${qtdTop} das suas ${f.perdidas} perdas (${pct(fatia)}%)`,
      leitura: e?.leitura ?? "Vale reler estas perdas para achar o padrão.",
      gravidade: fatia >= 0.4 ? "critico" : "atencao",
      modulos: e?.modulos ?? [], etapas: e?.etapas ?? [],
    });
  }

  // 3) Follow-up: negociação aberta e parada.
  if (f.abertas >= 3 && f.abertasParadas > 0) {
    const fatia = f.abertasParadas / f.abertas;
    sinais.push({
      id: "paradas",
      titulo: "Negociação aberta esfriando",
      fato: `${f.abertasParadas} de ${f.abertas} abertas sem contato há mais de ${DIAS_PARADA} dias`,
      leitura: "Negociação sem próxima data marcada morre sozinha. Quem não marca o próximo passo antes de encerrar a conversa entrega a venda ao tempo.",
      gravidade: fatia >= 0.4 ? "critico" : "atencao",
      modulos: ["m8"], etapas: ["fechamento"],
    });
  }

  // 4) Prospecção: entrou pouca gente no funil.
  if (f.meses > 0) {
    const porMes = f.criadas / f.meses;
    if (porMes < 4) {
      sinais.push({
        id: "entrada",
        titulo: "Entra pouca gente no funil",
        fato: `${f.criadas} negociação(ões) nova(s) em ${f.meses} mês(es) — ${porMes.toFixed(1)} por mês`,
        leitura: "Funil magro no topo é o problema que nenhuma técnica de fechamento resolve. Com pouca entrada, cada perda dói o dobro e a pressa aparece na mesa.",
        gravidade: porMes < 2 ? "critico" : "atencao",
        modulos: ["m3"], etapas: ["prospeccao"],
      });
    }
  }

  // 5) Diagnóstico na conversa: ele pergunta ou só informa?
  if (f.mensagensEnviadas >= 20) {
    const fatia = f.mensagensComPergunta / f.mensagensEnviadas;
    if (fatia < 0.2) {
      sinais.push({
        id: "perguntas",
        titulo: "Você fala mais do que pergunta",
        fato: `${pct(fatia)}% das suas mensagens têm pergunta (${f.mensagensComPergunta} de ${f.mensagensEnviadas})`,
        leitura: "Quem só informa apresenta produto; quem pergunta descobre a dor. A venda consultiva de máquina se ganha na pergunta que o concorrente não fez.",
        gravidade: fatia < 0.1 ? "critico" : "atencao",
        modulos: ["m4"], etapas: ["qualificacao"],
      });
    }
  }

  // 6) Perda sem motivo: não é aula, é disciplina.
  if (f.perdidasSemMotivo > 0) {
    sinais.push({
      id: "sem_motivo",
      titulo: "Perda sem justificativa",
      fato: `${f.perdidasSemMotivo} perda(s) sem motivo registrado`,
      leitura: "Perda sem motivo não vira aprendizado: é só um número que caiu do funil. Enquanto elas existirem, este diagnóstico está incompleto — o motivo delas pode mudar o que você mais precisa estudar.",
      gravidade: "atencao",
      modulos: [], etapas: [],
    });
  }

  // 7) O que está indo BEM. Uma tela só de defeito ele fecha e não abre mais.
  if (taxaGeral !== null && taxaGeral >= 0.25) {
    sinais.push({
      id: "conversao_boa",
      titulo: "Sua conversão está acima do normal",
      fato: `${pct(taxaGeral)}% do que entra no funil fatura (${f.faturadas} de ${f.criadas})`,
      leitura: "Em máquina pesada, fechar uma a cada quatro que entram é resultado bom. O caminho para crescer aqui é topo de funil, não técnica.",
      gravidade: "bom",
      modulos: ["m3"], etapas: ["prospeccao"],
    });
  }
  if (f.visitasRealizadas > 0 && f.faturadas > 0) {
    const porVenda = f.visitasRealizadas / f.faturadas;
    sinais.push({
      id: "visitas_por_venda",
      titulo: "Visitas por venda",
      fato: `${porVenda.toFixed(1)} visita(s) realizada(s) para cada máquina faturada`,
      leitura: porVenda > 12
        ? "São muitas visitas por venda. Ou a qualificação antes da viagem está frouxa, ou a visita está virando visita social."
        : "Número saudável: você não está gastando viagem à toa.",
      gravidade: porVenda > 12 ? "atencao" : "bom",
      modulos: porVenda > 12 ? ["m4"] : [], etapas: porVenda > 12 ? ["qualificacao", "visita"] : [],
    });
  }

  const ordem: Record<Gravidade, number> = { critico: 0, atencao: 1, bom: 2 };
  sinais.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);

  return { perfil: perfilDe(f, sinais, taxaGeral), gargalo, taxaGeral, sinais, poucosDados };
}

// ── O perfil ────────────────────────────────────────────────────────────────
//
// Um rótulo só, tirado do sinal MAIS GRAVE que ele tem. A ordem importa e já
// me traiu uma vez: com uma lista de checagens fixa, um sinal leve ("entra
// pouca gente") ganhava de três críticos e a tela dizia "bom de fechar" para
// quem estava perdendo 42% por preço e com metade da carteira esfriando. O
// perfil tem que sair do que dói mais, não do que eu escrevi primeiro.
//
// Rótulo é para ele se reconhecer na hora ("é isso mesmo que eu faço"), não
// para classificar ninguém — por isso nenhum deles diz que o vendedor é ruim:
// todos dizem o que ele faz bem E onde isso o trai.
const PERFIL_DO_SINAL: { quando: (id: string) => boolean; perfil: Perfil }[] = [
  {
    quando: (id) => id === "motivo:preco" || id === "motivo:usada" || id === "gargalo:Proposta",
    perfil: {
      titulo: "Vende máquina, ainda não vende conta",
      descricao: "Você constrói relação e chega à proposta, mas a decisão acaba caindo no número. Falta pôr a conta da operação na frente dele — custo por hora, disponibilidade, o que a parada custa — antes de o preço aparecer.",
    },
  },
  {
    quando: (id) => id === "paradas" || id === "motivo:sem_retorno" || id === "motivo:adiou" || id === "gargalo:Negociação",
    perfil: {
      titulo: "Abre bem, fecha devagar",
      descricao: "Você faz o cliente gostar de você e a conversa anda — até parar. O que te custa venda não é o \"não\": é o silêncio, a negociação que fica sem próxima data e esfria.",
    },
  },
  {
    quando: (id) => id === "motivo:credito",
    perfil: {
      titulo: "Qualifica tarde",
      descricao: "Suas vendas morrem no banco, e isso quase sempre se decide lá atrás: faturamento, restrição e entrada perguntados no começo evitam semanas de proposta que nunca teve chance.",
    },
  },
  {
    quando: (id) => id === "perguntas" || id === "gargalo:Oportunidade" || id === "motivo:concorrente",
    perfil: {
      titulo: "Apresentador de máquina",
      descricao: "Você conhece o produto e explica bem — e é justamente por isso que fala mais do que pergunta. Em máquina pesada quem descobre a operação primeiro escreve a proposta certa; quem só apresenta entrega comparação de preço ao concorrente.",
    },
  },
  {
    quando: (id) => id === "entrada",
    perfil: {
      titulo: "Bom de fechar, curto de topo",
      descricao: "Quem chega até você costuma andar, mas chega pouca gente. Seu limite hoje não é técnica de venda: é quantidade de conversa nova entrando.",
    },
  },
];

function perfilDe(f: FatosVendedor, sinais: SinalVendedor[], taxaGeral: number | null): Perfil {
  const encerradas = f.faturadas + f.perdidas;
  if (f.criadas < MINIMO_PARA_TAXA && encerradas < MINIMO_PARA_TAXA) {
    return {
      titulo: "Ainda sem retrato",
      descricao: "Tem pouca negociação fechada ou perdida no período para o CRM dizer alguma coisa séria sobre o seu jeito de vender. Continue registrando: com umas dez encerradas, este diagnóstico começa a valer.",
    };
  }

  // sinais já vem ordenado por gravidade — o primeiro que casa é o que dói mais.
  for (const s of sinais) {
    if (s.gravidade === "bom") break;
    const achado = PERFIL_DO_SINAL.find((p) => p.quando(s.id));
    if (achado) return achado.perfil;
  }

  if (taxaGeral !== null && taxaGeral >= 0.25) {
    return {
      titulo: "Consistente",
      descricao: "Os números não apontam um vazamento claro no seu funil. Neste ponto o que faz diferença é volume e margem, não correção de erro.",
    };
  }
  return {
    titulo: "Equilibrado, sem vazamento claro",
    descricao: "Nenhum sinal se destaca dos outros. Vale olhar os itens abaixo em ordem e escolher um para trabalhar nas próximas semanas — um de cada vez.",
  };
}

/** Os módulos e etapas recomendados, sem repetição, na ordem da gravidade. */
export function planoDeEstudo(d: DiagnosticoVendedor): { modulos: string[]; etapas: string[] } {
  const modulos: string[] = [];
  const etapas: string[] = [];
  for (const s of d.sinais) {
    if (s.gravidade === "bom") continue;
    for (const m of s.modulos) if (!modulos.includes(m)) modulos.push(m);
    for (const e of s.etapas) if (!etapas.includes(e)) etapas.push(e);
  }
  return { modulos, etapas };
}
