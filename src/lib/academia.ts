// Academia de Vendas — base de conhecimento curada.
// As melhores metodologias de venda do mundo, perfis de personalidade (DISC),
// tratamento de objeções e técnicas de fechamento — tudo em português e
// adaptado à venda de máquinas pesadas (New Holland Construction e Dynapac).

export interface Metodologia {
  nome: string;
  origem: string;
  resumo: string;
  quandoUsar: string;
  passos: { titulo: string; desc: string }[];
  exemplo: string; // aplicado a máquinas pesadas
}

export const METODOLOGIAS: Metodologia[] = [
  {
    nome: "SPIN Selling",
    origem: "Neil Rackham — best-seller mundial de vendas complexas (B2B)",
    resumo:
      "Vender por meio de PERGUNTAS na ordem certa, fazendo o próprio cliente perceber o tamanho do problema e o valor da solução. Ideal para vendas de alto valor como máquinas.",
    quandoUsar:
      "Negociações de ticket alto, em que o cliente precisa enxergar o retorno antes de decidir.",
    passos: [
      { titulo: "S — Situação", desc: "Entenda o cenário: tipo de obra, frota atual, volume de produção, prazos." },
      { titulo: "P — Problema", desc: "Descubra as dores: máquina velha quebrando, consumo alto, parada de obra, aluguel caro." },
      { titulo: "I — Implicação", desc: "Amplie a dor: 'quanto custa um dia de obra parada?', 'quanto você perde com retrabalho?'" },
      { titulo: "N — Necessidade", desc: "Faça o cliente verbalizar o ganho: 'então uma máquina mais econômica resolveria isso, certo?'" },
    ],
    exemplo:
      "Em vez de já falar da escavadeira E215C, pergunte: 'Quantas horas/dia sua máquina atual roda? Quanto você gastou de manutenção nos últimos 6 meses? Se ela parar no meio de uma obra grande, qual o prejuízo?' — aí a E215C deixa de ser custo e vira solução.",
  },
  {
    nome: "Challenger Sale (O Vendedor Desafiador)",
    origem: "Dixon & Adamson — pesquisa com milhares de vendedores B2B",
    resumo:
      "O melhor vendedor não é o mais simpático: é o que ENSINA algo novo ao cliente, personaliza para a realidade dele e assume o controle da conversa (inclusive falando de dinheiro sem medo).",
    quandoUsar: "Cliente experiente que acha que já sabe tudo; mercado competitivo.",
    passos: [
      { titulo: "Ensine", desc: "Traga um insight que o cliente não tinha (ex: custo real por hora trabalhada x preço de compra)." },
      { titulo: "Personalize", desc: "Conecte o insight à obra e ao bolso específico daquele cliente." },
      { titulo: "Assuma o controle", desc: "Conduza para o fechamento com firmeza; fale de preço e prazo sem rodeios." },
    ],
    exemplo:
      "Mostre que a máquina 'mais barata' do concorrente custa mais caro em 5 anos por consumo e parada. Você ENSINA a conta do custo total de propriedade (TCO) — e vira autoridade.",
  },
  {
    nome: "Gap Selling",
    origem: "Keenan — venda centrada no 'abismo' entre o presente e o futuro",
    resumo:
      "Mapeie o ESTADO ATUAL do cliente, o ESTADO DESEJADO, e venda a ponte entre os dois. Quanto maior o gap percebido, maior a urgência de comprar.",
    quandoUsar: "Quando o cliente está acomodado ou não enxerga urgência.",
    passos: [
      { titulo: "Estado atual", desc: "Produção, custos, frota, problemas medidos em números." },
      { titulo: "Estado desejado", desc: "Onde ele quer chegar: mais obras, menos custo, crescer a frota." },
      { titulo: "O gap", desc: "Mostre o tamanho da distância e como a máquina certa fecha esse abismo." },
    ],
    exemplo:
      "'Hoje você faz X m³/dia com aluguel; com uma máquina própria você faria Y e ainda pararia de pagar aluguel. Essa diferença paga a parcela.'",
  },
  {
    nome: "Venda Consultiva",
    origem: "Padrão moderno de vendas de relacionamento",
    resumo:
      "Você é um consultor, não um tirador de pedidos. Diagnostica, recomenda o equipamento certo (mesmo que não seja o mais caro) e constrói confiança de longo prazo.",
    quandoUsar: "Sempre — é a base. Essencial no pós-venda e na indicação.",
    passos: [
      { titulo: "Diagnóstico", desc: "Entenda a operação antes de oferecer qualquer coisa." },
      { titulo: "Recomendação honesta", desc: "Indique a máquina certa para a necessidade real." },
      { titulo: "Acompanhamento", desc: "Pós-venda ativo gera recompra e indicação." },
    ],
    exemplo:
      "Se o cliente só precisa de uma retro B95C, não empurre uma escavadeira maior. A confiança vira a próxima venda e indicações.",
  },
  {
    nome: "Princípios de Persuasão (Cialdini)",
    origem: "Robert Cialdini — 'As Armas da Persuasão'",
    resumo:
      "Seis gatilhos comprovados que aumentam o 'sim'. Use com ética, sempre com verdade.",
    quandoUsar: "Em qualquer etapa, para reforçar a decisão.",
    passos: [
      { titulo: "Reciprocidade", desc: "Dê valor antes (demonstração, análise de custo grátis) e o cliente retribui." },
      { titulo: "Prova social", desc: "'A construtora X aqui da região já roda 3 dessas.'" },
      { titulo: "Autoridade", desc: "Mostre domínio técnico e dados — vira referência." },
      { titulo: "Escassez", desc: "'Essa condição de Finame vence dia 30' (quando for verdade)." },
      { titulo: "Compromisso", desc: "Pequenos 'sins' levam ao grande sim (aceitar a visita, o teste...)." },
      { titulo: "Afinidade", desc: "Pessoas compram de quem gostam e confiam — relacione-se de verdade." },
    ],
    exemplo:
      "Ofereça uma análise gratuita de custo/hora da frota do cliente (reciprocidade + autoridade). Cite quem já comprou na região (prova social).",
  },
];

// ---------- Perfis de personalidade (DISC) ----------

export interface PerfilCliente {
  letra: "D" | "I" | "S" | "C";
  nome: string;
  apelido: string;
  cor: "red" | "yellow" | "green" | "blue";
  comoReconhecer: string[];
  valoriza: string[];
  comoVender: string[];
  evitar: string[];
  fechamento: string;
}

export const PERFIS_DISC: PerfilCliente[] = [
  {
    letra: "D",
    nome: "Dominante",
    apelido: "O Decisor / Dono que quer resultado",
    cor: "red",
    comoReconhecer: [
      "Fala rápido, vai direto ao ponto, pouca paciência",
      "Quer saber preço, prazo e resultado — não enrola",
      "Decide sozinho e rápido",
    ],
    valoriza: ["Resultado", "Tempo", "Controle", "ROI / produtividade"],
    comoVender: [
      "Seja direto e objetivo — resuma em 1 minuto",
      "Foque em ROI, produtividade e ganho de obra",
      "Dê 2-3 opções e deixe ELE decidir",
      "Mostre que você resolve, não que você fala bonito",
    ],
    evitar: ["Conversa fiada longa", "Detalhes técnicos demais", "Indecisão da sua parte"],
    fechamento: "Fechamento assumido: 'Fecho a E215C pra entrega semana que vem, certo?'",
  },
  {
    letra: "I",
    nome: "Influente",
    apelido: "O Relacional / Gosta de conversar",
    cor: "yellow",
    comoReconhecer: [
      "Comunicativo, animado, conta histórias",
      "Gosta de marca, status e de ser reconhecido",
      "Decide pela emoção e pela relação",
    ],
    valoriza: ["Relacionamento", "Reconhecimento", "Novidade", "Status da marca"],
    comoVender: [
      "Crie conexão genuína — puxe assunto, seja entusiasmado",
      "Use histórias e prova social ('fulano daqui já tem')",
      "Destaque o status de ter uma New Holland / Dynapac",
      "Mantenha contato frequente e caloroso",
    ],
    evitar: ["Ser frio e só técnico", "Planilhas intermináveis", "Ignorar o lado pessoal"],
    fechamento: "Fechamento por entusiasmo + prova social: 'Você vai ser referência na região com essa máquina!'",
  },
  {
    letra: "S",
    nome: "Estável",
    apelido: "O Cauteloso / Preza segurança",
    cor: "green",
    comoReconhecer: [
      "Calmo, fala pouco, evita risco e mudança brusca",
      "Pergunta sobre garantia, assistência e pós-venda",
      "Demora a decidir, é leal quando confia",
    ],
    valoriza: ["Segurança", "Confiança", "Garantia", "Suporte e pós-venda"],
    comoVender: [
      "Transmita segurança e estabilidade — sem pressão",
      "Enfatize garantia, rede de assistência e peças",
      "Dê passos pequenos e previsíveis",
      "Esteja presente no pós-venda — ele indica muito",
    ],
    evitar: ["Pressão / urgência forçada", "Mudar o combinado", "Sumir depois da venda"],
    fechamento: "Fechamento por segurança: 'Você fica com 1 ano de garantia e assistência aqui na região — qualquer coisa, é só me chamar.'",
  },
  {
    letra: "C",
    nome: "Cauteloso-Analítico",
    apelido: "O Técnico / Quer dados e números",
    cor: "blue",
    comoReconhecer: [
      "Detalhista, pergunta especificações, consumo, fichas",
      "Compara modelos e concorrentes em planilha",
      "Decide pela lógica e pelos números",
    ],
    valoriza: ["Dados", "Precisão", "Comparativos técnicos", "Custo total (TCO)"],
    comoVender: [
      "Traga ficha técnica, consumo, comparativos lado a lado",
      "Use a conta do custo por hora e o TCO (custo total)",
      "Seja preciso — nunca 'chute' um número",
      "Documente tudo por escrito",
    ],
    evitar: ["Pressão emocional", "Respostas vagas", "Exagero / promessa sem dado"],
    fechamento: "Fechamento por lógica: 'Pelos números, em 4 anos a E215C custa 18% menos que a concorrente. A escolha técnica é clara.'",
  },
];

// ---------- Objeções comuns na venda de máquinas ----------

export interface Objecao {
  objecao: string;
  tecnica: string;
  resposta: string;
}

export const OBJECOES: Objecao[] = [
  {
    objecao: "Está caro / o concorrente é mais barato",
    tecnica: "Reenquadrar para custo total (TCO), não preço",
    resposta:
      "'Entendo. Mas vamos olhar o custo por hora trabalhada em 5 anos: consumo, manutenção e parada. A máquina mais barata na compra costuma sair mais cara no fim. Posso te mostrar essa conta?'",
  },
  {
    objecao: "Vou pensar / depois eu te falo",
    tecnica: "Isolar a objeção real",
    resposta:
      "'Claro! Só pra eu te ajudar melhor: o que ainda te deixa em dúvida — é o valor da parcela, o prazo de entrega ou a máquina em si?'",
  },
  {
    objecao: "Agora não é hora, o mercado está parado",
    tecnica: "Gap Selling + custo de não agir",
    resposta:
      "'Justamente quando o mercado aperta é que produtividade e economia decidem o jogo. Quanto te custa continuar pagando aluguel/máquina velha por mais 6 meses?'",
  },
  {
    objecao: "Já tenho fornecedor / sou fiel a outra marca",
    tecnica: "Challenger — ensinar algo novo",
    resposta:
      "'Respeito sua relação com eles. Posso só te mostrar um dado que muitos clientes não conhecem sobre consumo e valor de revenda? Se não fizer sentido, seguimos como amigos.'",
  },
  {
    objecao: "Preciso falar com meu sócio / esposa",
    tecnica: "Garantir o próximo passo",
    resposta:
      "'Perfeito, decisão de máquina é importante mesmo. Que tal eu preparar um resumo com os números pra você apresentar? E já deixamos uma data pra conversarmos os três?'",
  },
  {
    objecao: "Manutenção e peças são caras",
    tecnica: "Prova + autoridade",
    resposta:
      "'Boa preocupação. A rede de assistência aqui da região é forte e tem peças em estoque. Te mostro o plano de manutenção e o custo previsto — sem surpresa.'",
  },
];

// ---------- Técnicas de fechamento ----------

export interface Fechamento {
  nome: string;
  descricao: string;
  exemplo: string;
}

export const FECHAMENTOS: Fechamento[] = [
  {
    nome: "Fechamento assumido",
    descricao: "Aja como se a decisão já estivesse tomada, conduzindo para os detalhes finais.",
    exemplo: "'Então fecho a entrega da E215C pra quinta. Prefere de manhã ou à tarde?'",
  },
  {
    nome: "Fechamento alternativo",
    descricao: "Ofereça duas opções — qualquer escolha é um 'sim'.",
    exemplo: "'Você prefere Finame em 60x ou consórcio em 80x?'",
  },
  {
    nome: "Fechamento por escassez/urgência",
    descricao: "Use um prazo ou condição real que vence (nunca minta).",
    exemplo: "'Essa taxa especial do Finame vale até o fim do mês — dá pra garantir agora.'",
  },
  {
    nome: "Fechamento por resumo de valor",
    descricao: "Recapitule todos os benefícios acordados antes de pedir o sim.",
    exemplo: "'Então temos: economia de combustível, garantia de 1 ano, assistência na região e a melhor parcela. Bora fechar?'",
  },
  {
    nome: "Fechamento Ben Franklin",
    descricao: "Liste prós e contras junto com o cliente — os prós ganham.",
    exemplo: "'Vamos colocar no papel: de um lado o investimento, do outro a economia e a produtividade. O que pesa mais?'",
  },
];

// Dicas rápidas que giram (uma por dia).
export const DICAS_RAPIDAS: string[] = [
  "Quem pergunta, conduz. Fale 30%, escute 70%.",
  "Nunca dê o preço sem antes construir o valor.",
  "Objeção não é 'não' — é pedido de mais informação.",
  "O follow-up vence o talento: 80% das vendas precisam de 5+ contatos.",
  "Venda o custo por hora trabalhada, não o preço de etiqueta.",
  "Anote o nome de quem decide e fale com quem decide.",
  "Cada cliente tem um perfil (DISC). Adapte sua abordagem a ele, não o contrário.",
  "Pós-venda forte = recompra + indicação. A próxima venda começa na entrega.",
  "Prova social fecha negócio: mostre quem já comprou na região.",
  "Marque sempre o próximo passo antes de encerrar a conversa.",
];

export function dicaDoDia(): string {
  const dia = Math.floor(Date.now() / 86400000);
  return DICAS_RAPIDAS[dia % DICAS_RAPIDAS.length];
}
