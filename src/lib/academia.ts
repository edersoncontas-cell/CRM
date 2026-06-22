// Academia de Vendas — base de conhecimento de elite.
// Graduação → Pós → Mestrado → Doutorado → PHD em vendas.
// Adaptado integralmente à venda de máquinas pesadas New Holland e Dynapac no sul do ES.

// ─── INTERFACES ──────────────────────────────────────────────────────────────

export interface Metodologia {
  nome: string;
  origem: string;
  nivel: string;
  resumo: string;
  quandoUsar: string;
  passos: { titulo: string; desc: string }[];
  exemplo: string;
}

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
  palavrasChave: string[];
  abordagemWhatsApp: string;
}

export interface Objecao {
  objecao: string;
  tecnica: string;
  resposta: string;
  nivel?: string;
}

export interface Fechamento {
  nome: string;
  nivel: string;
  descricao: string;
  exemplo: string;
  quandoUsar?: string;
}

export interface PsicologiaTopico {
  nome: string;
  nivel: string;
  principio: string;
  comoAplicar: string[];
  exemplo: string;
  atencao?: string;
}

export interface NeurocienciaTopico {
  vies: string;
  nivel: string;
  comoFunciona: string;
  aplicacao: string[];
  exemplo: string;
}

export interface TecnicaNegociacao {
  nome: string;
  autor: string;
  nivel: string;
  principio: string;
  passos: string[];
  exemplo: string;
  frasePoder?: string;
}

// ─── METODOLOGIAS (Graduação + Pós-Graduação) ────────────────────────────────

export const METODOLOGIAS: Metodologia[] = [
  {
    nome: "SPIN Selling",
    origem: "Neil Rackham — best-seller mundial de vendas complexas (B2B)",
    nivel: "Pós-Graduação",
    resumo:
      "Vender por meio de PERGUNTAS na ordem certa, fazendo o próprio cliente perceber o tamanho do problema e o valor da solução. Ideal para vendas de alto valor como máquinas.",
    quandoUsar: "Negociações de ticket alto em que o cliente precisa enxergar o retorno antes de decidir.",
    passos: [
      { titulo: "S — Situação", desc: "Entenda o cenário: tipo de obra, frota atual, volume de produção, prazos, financeiro." },
      { titulo: "P — Problema", desc: "Descubra as dores: máquina velha quebrando, consumo alto, parada de obra, aluguel caro, peças difíceis." },
      { titulo: "I — Implicação", desc: "Amplie a dor com números: 'Quanto custa um dia de obra parada? Quanto você perde com retrabalho por semana?'" },
      { titulo: "N — Necessidade", desc: "Faça o cliente verbalizar o ganho: 'Então uma máquina mais econômica e confiável resolveria tudo isso, certo?'" },
    ],
    exemplo:
      "Em vez de já falar da E215C, pergunte: 'Quantas horas/dia sua máquina atual roda? Quanto gastou de manutenção nos últimos 6 meses? Se ela parar no meio de uma obra grande, qual o prejuízo diário?' — aí a E215C deixa de ser custo e vira solução urgente.",
  },
  {
    nome: "Challenger Sale (O Vendedor Desafiador)",
    origem: "Dixon & Adamson — pesquisa com 6.000+ vendedores B2B",
    nivel: "Pós-Graduação",
    resumo:
      "O melhor vendedor não é o mais simpático: é o que ENSINA algo novo ao cliente, personaliza para a realidade dele e assume o controle da conversa — inclusive falando de dinheiro sem medo.",
    quandoUsar: "Cliente experiente que acha que já sabe tudo; mercado altamente competitivo; concorrente com preço mais baixo.",
    passos: [
      { titulo: "Ensine", desc: "Traga um insight que o cliente não tinha — ex: o verdadeiro custo por hora trabalhada x preço de compra, impacto de downtime, valor de revenda." },
      { titulo: "Personalize", desc: "Conecte o insight à realidade específica daquele cliente: sua obra, seu financeiro, sua região." },
      { titulo: "Assuma o controle", desc: "Conduza para o fechamento com firmeza. Fale de preço e prazo sem rodeios. Não peça permissão para vender." },
    ],
    exemplo:
      "Mostre que a máquina 'mais barata' do concorrente custa 23% mais em 5 anos por consumo e tempo de parada. Você ENSINA a conta do custo total de propriedade (TCO) — e vira a autoridade técnica da região.",
  },
  {
    nome: "Gap Selling",
    origem: "Keenan — venda centrada no abismo entre presente e futuro",
    nivel: "Mestrado",
    resumo:
      "Mapeie o ESTADO ATUAL do cliente, o ESTADO DESEJADO, e venda a ponte entre os dois. Quanto maior o gap percebido, maior a urgência de comprar. Sem gap = sem venda.",
    quandoUsar: "Quando o cliente está acomodado, não vê urgência ou diz 'por enquanto está bom'.",
    passos: [
      { titulo: "Estado atual", desc: "Produção atual, custos reais, frota existente, problemas medidos em números concretos." },
      { titulo: "Estado desejado", desc: "Onde ele quer chegar: mais obras, menos custo operacional, crescer a frota, ganhar contratos maiores." },
      { titulo: "O gap", desc: "Mostre o custo real de ficar parado. Quantifique a diferença. A solução é óbvia." },
      { titulo: "Pontes", desc: "Apresente a máquina como o caminho mais direto e comprovado entre os dois estados." },
    ],
    exemplo:
      "'Hoje você faz X m³/dia com aluguel de R$8k/mês. Com uma E215C própria, sua capacidade sobe 40% e o custo cai R$3k/mês. Em 18 meses você pagou a máquina só com o que deixou de pagar de aluguel.'",
  },
  {
    nome: "Venda Consultiva",
    origem: "Padrão moderno de vendas de alto relacionamento",
    nivel: "Graduação",
    resumo:
      "Você é um consultor, não um tirador de pedidos. Diagnostica, recomenda o equipamento certo para cada caso e constrói confiança de longo prazo. O cliente volta e indica.",
    quandoUsar: "Sempre — é a base de tudo. Essencial no pós-venda e na geração de indicações.",
    passos: [
      { titulo: "Diagnóstico honesto", desc: "Entenda a operação antes de oferecer qualquer coisa. Faça perguntas, não pitches." },
      { titulo: "Recomendação alinhada", desc: "Indique a máquina certa para a necessidade real, mesmo que não seja a mais cara." },
      { titulo: "Acompanhamento ativo", desc: "Pós-venda consistente gera recompra, upgrade e indicação espontânea." },
    ],
    exemplo:
      "Se o cliente só precisa de uma retro B95C para obra pequena, não empurre escavadeira grande. A confiança que você constrói vale 10 vendas futuras e uma rede de indicações.",
  },
  {
    nome: "Princípios de Persuasão (Cialdini)",
    origem: "Robert Cialdini — 'As Armas da Persuasão' + 'Pre-Suasion'",
    nivel: "Mestrado",
    resumo:
      "Sete gatilhos psicológicos comprovados por décadas de pesquisa que aumentam o 'sim'. Use com ética e veracidade — persuasão ética multiplica resultados.",
    quandoUsar: "Em qualquer etapa para reforçar a decisão e reduzir a resistência.",
    passos: [
      { titulo: "Reciprocidade", desc: "Dê valor genuíno antes (análise gratuita de custo, demostração, visita técnica) e o cliente se sente compelido a retribuir." },
      { titulo: "Prova social", desc: "'A construtora Silva aqui em Cachoeiro já roda 3 dessas na usina deles.' Ninguém quer ficar de fora." },
      { titulo: "Autoridade", desc: "Mostre domínio técnico: fichas, comparativos, dados reais. Você vira a referência da região." },
      { titulo: "Escassez", desc: "'Essa condição de Finame vence dia 30 e temos 1 unidade em estoque' — sempre verdade, nunca blefe." },
      { titulo: "Compromisso e consistência", desc: "Pequenos 'sins' (aceitar visita, teste, análise) criam inércia psicológica em direção ao grande sim." },
      { titulo: "Afinidade", desc: "Pessoas compram de quem gostam e confiam. Relacione-se genuinamente, lembre datas, pergunte sobre a família." },
      { titulo: "Unidade (Pre-Suasion)", desc: "Crie identidade compartilhada: 'Nós, da região sul do ES, sabemos que...' — o 'nós' elimina resistência." },
    ],
    exemplo:
      "Ofereça análise gratuita de custo/hora da frota (reciprocidade + autoridade). Cite clientes vizinhos (prova social). Mencione prazo real de Finame (escassez). Peça uma visita como próximo passo (compromisso).",
  },
  {
    nome: "MEDDIC / MEDDPICC",
    origem: "Jack Napoli & Dick Dunkel — framework enterprise adaptado para B2B complexo",
    nivel: "Doutorado",
    resumo:
      "Qualifique cada negociação com rigor antes de investir tempo. MEDDIC filtra oportunidades reais das fantasmas e mantém você focado em quem realmente vai fechar.",
    quandoUsar: "Negociações grandes, ciclo longo, múltiplos decisores — como construtoras, prefeituras e empresas com frota.",
    passos: [
      { titulo: "M — Metrics (Métricas)", desc: "Qual o impacto quantificável? Economia de R$X/mês, aumento de Y% na produção." },
      { titulo: "E — Economic Buyer", desc: "Quem assina o cheque? Não perca tempo com quem não decide." },
      { titulo: "D — Decision Criteria", desc: "Quais critérios o cliente usa para decidir? Preço, prazo, suporte, marca?" },
      { titulo: "D — Decision Process", desc: "Como a decisão é tomada? Quem aprova, qual o prazo, tem comitê?" },
      { titulo: "I — Identify Pain", desc: "Qual a dor específica e urgente? Sem dor real = sem urgência = sem compra." },
      { titulo: "C — Champion", desc: "Quem dentro da empresa defende você? Cultive seu aliado interno." },
      { titulo: "C — Competition", desc: "Quem mais está cotando? O que eles oferecem que você não tem (e vice-versa)?" },
    ],
    exemplo:
      "Antes de proposta em empresa com frota de 12 máquinas: mapeie quem assina (Economic Buyer), descubra o processo de compra (licitação? aprovação diretoria?), identifique seu aliado interno e quantifique a dor em R$/mês.",
  },
  {
    nome: "Sandler Selling System",
    origem: "David Sandler — sistema baseado em psicologia comportamental",
    nivel: "Doutorado",
    resumo:
      "Inverta o jogo: não corra atrás do cliente, faça-o perseguir você. Use o 'Pain Funnel' para fazer o cliente verbalizar e ampliar sua própria dor, chegando à solução por si mesmo.",
    quandoUsar: "Clientes resistentes, que testam limites ou que gostam de negociar pressão.",
    passos: [
      { titulo: "Rapport e igualdade", desc: "Não seja 'vendedor ansioso'. Posicione-se como igual, consultor, não fornecedor dependente." },
      { titulo: "Pain Funnel", desc: "Faça perguntas progressivas que vão afunilando a dor: 'O que acontece se não resolver?' → 'Quanto isso custa?' → 'Tentou resolver antes? Por quê não funcionou?'" },
      { titulo: "Budget e qualificação", desc: "Fale de dinheiro cedo: 'Quanto você tem disponível para resolver esse problema?' Qualifique antes de propor." },
      { titulo: "Decisão clara", desc: "Estabeleça o processo de decisão antes da proposta. 'Se a conta fechar, o que precisamos para avançar?'" },
      { titulo: "Post-sell", desc: "Confirme a compra. O remorso do comprador é real — reitere os ganhos imediatamente após o fechamento." },
    ],
    exemplo:
      "'O que acontece se sua escavadeira parar no meio de uma obra com prazo apertado?' → 'Quanto isso te custaria?' → 'Isso já aconteceu antes?' → 'Como você resolveu?' Agora ele QUER a solução.",
  },
];

// ─── PERFIS DISC (Pós-Graduação) ─────────────────────────────────────────────

export const PERFIS_DISC: PerfilCliente[] = [
  {
    letra: "D",
    nome: "Dominante",
    apelido: "O Decisor / Dono que quer resultado",
    cor: "red",
    comoReconhecer: [
      "Fala rápido, vai direto ao ponto, pouca paciência",
      "Quer saber preço, prazo e ROI — não enrola",
      "Decide sozinho e rápido, não pede opinião",
      "Interrompe, testa você com objeções duras",
    ],
    valoriza: ["Resultado", "Tempo", "Controle", "ROI / produtividade", "Status de ser o melhor"],
    comoVender: [
      "Seja direto e objetivo — resuma em 1-2 minutos, sem enrolação",
      "Foque em ROI, produtividade e ganho concreto de obra",
      "Dê 2-3 opções e deixe ELE decidir — nunca imponha",
      "Mostre que você resolve, não que você fala bonito",
      "Elogie a decisão dele, não a máquina",
    ],
    evitar: ["Conversa fiada longa", "Detalhes técnicos sem fim", "Indecisão da sua parte", "Pedir aprovação de terceiros na frente dele"],
    fechamento: "Fechamento assumido: 'Fecho a E215C pra entrega semana que vem, certo? De manhã ou tarde?'",
    palavrasChave: ["resultado", "produtividade", "ROI", "ganho", "rápido", "eficiência"],
    abordagemWhatsApp: "Mensagem curta e direta. Destaque o ganho concreto logo de cara. Ex: 'Eduardo, a E215C que falamos aumenta 40% a produção e paga em 18 meses. Quando posso passar?'",
  },
  {
    letra: "I",
    nome: "Influente",
    apelido: "O Relacional / Gosta de conversar e ser reconhecido",
    cor: "yellow",
    comoReconhecer: [
      "Comunicativo, animado, conta histórias e anedotas",
      "Gosta de marca, status e de ser reconhecido pela compra",
      "Decide pela emoção e pela relação com o vendedor",
      "Compra de quem ele gosta — relacionamento é tudo",
    ],
    valoriza: ["Relacionamento", "Reconhecimento", "Novidade e exclusividade", "Status da marca New Holland"],
    comoVender: [
      "Crie conexão genuína — puxe assunto pessoal, seja entusiasmado",
      "Use histórias e prova social: 'O Marcos daqui da região já tem 2 dessas'",
      "Destaque o status: 'New Holland é referência nacional, vai ser o mais equipado da região'",
      "Mantenha contato frequente e caloroso — WhatsApp, memes, check-ins",
    ],
    evitar: ["Ser frio e só técnico", "Planilhas intermináveis sem emoção", "Ignorar o lado pessoal", "Prometer e não ligar"],
    fechamento: "Fechamento por entusiasmo + prova social: 'Você vai ser referência na região com essa máquina! O Marcos quando comprou ficou muito satisfeito — e você merece o melhor!'",
    palavrasChave: ["referência", "exclusivo", "primeira", "reconhecido", "parceria", "relação"],
    abordagemWhatsApp: "Mensagem calorosa e pessoal. Começa com algo pessoal antes de vender. Ex: 'Ricardo! Como foi a obra de Cachoeiro? Lembrei de você quando vi a nova linha...'",
  },
  {
    letra: "S",
    nome: "Estável",
    apelido: "O Cauteloso / Preza segurança acima de tudo",
    cor: "green",
    comoReconhecer: [
      "Calmo, fala pouco, evita risco e mudança brusca",
      "Pergunta muito sobre garantia, assistência técnica e pós-venda",
      "Demora a decidir mas é extremamente leal quando confia",
      "Pede tempo para conversar com família ou sócio",
    ],
    valoriza: ["Segurança", "Confiança comprovada", "Garantia longa", "Suporte próximo e pós-venda forte"],
    comoVender: [
      "Transmita segurança e estabilidade — zero pressão, muita consistência",
      "Enfatize: 1 ano de garantia, rede de assistência regional, peças em estoque",
      "Dê passos pequenos e previsíveis — nunca salte etapas",
      "Esteja presente no pós-venda — ele indica muito quando confia de verdade",
    ],
    evitar: ["Pressão / urgência forçada", "Mudar o combinado depois", "Sumir após a venda", "Apressar a decisão"],
    fechamento: "Fechamento por segurança: 'Você tem 1 ano de garantia, assistência técnica aqui na região e peças disponíveis. É a decisão mais segura que você pode fazer.'",
    palavrasChave: ["garantia", "segurança", "assistência", "confiança", "tranquilidade", "suporte"],
    abordagemWhatsApp: "Tom paciente e acolhedor. Nunca pressione. Ex: 'Olá [nome], sem pressa! Quando você quiser, posso te explicar como funciona a garantia e o suporte regional.'",
  },
  {
    letra: "C",
    nome: "Cauteloso-Analítico",
    apelido: "O Técnico / Decide pelos dados e pela lógica",
    cor: "blue",
    comoReconhecer: [
      "Detalhista — pergunta especificações, consumo, fichas técnicas completas",
      "Compara modelos e concorrentes em planilha antes de qualquer reunião",
      "Decide pela lógica e pelos números, não pela emoção",
      "Pode parecer frio, mas está processando tudo com rigor",
    ],
    valoriza: ["Dados e precisão", "Comparativos técnicos completos", "Custo total (TCO)", "Processo lógico e documentado"],
    comoVender: [
      "Traga ficha técnica, consumo L/h, comparativos lado a lado com concorrentes",
      "Use a conta do custo por hora e o TCO em 5 anos — ele ama planilha",
      "Seja absolutamente preciso — nunca 'chute' um número ou spec",
      "Documente tudo: proposta detalhada, especificações, garantias por escrito",
    ],
    evitar: ["Pressão emocional", "Respostas vagas ou 'mais ou menos'", "Exagero ou promessa sem dado concreto", "Mudar specs depois"],
    fechamento: "Fechamento por lógica: 'Pelos números: consumo 11% menor, TCO 18% mais baixo em 5 anos, revenda 22% superior. A escolha técnica e financeira é objetivamente a E215C.'",
    palavrasChave: ["dados", "especificações", "TCO", "custo/hora", "comparativo", "eficiência técnica"],
    abordagemWhatsApp: "Objetivo e técnico. Inclua dados concretos. Ex: 'João, conforme analisamos: consumo médio da E215C é 14L/h vs 17L/h do concorrente. Em 2.000h/ano, são R$18k de economia só em diesel.'",
  },
];

// ─── OBJEÇÕES (Pós + Mestrado) ────────────────────────────────────────────────

export const OBJECOES: Objecao[] = [
  {
    objecao: "Está caro / o concorrente é mais barato",
    tecnica: "Reenquadrar para custo total (TCO), não preço de etiqueta",
    nivel: "Pós-Graduação",
    resposta:
      "'Entendo. Mas vamos olhar o custo por hora trabalhada em 5 anos: consumo, manutenção e parada. A máquina mais barata na compra costuma sair 20-30% mais cara no fim. Posso te mostrar essa conta agora?'",
  },
  {
    objecao: "Vou pensar / depois eu te falo",
    tecnica: "Isolar a objeção real com pergunta cirúrgica",
    nivel: "Pós-Graduação",
    resposta:
      "'Claro! Só pra te ajudar melhor: o que ainda te deixa em dúvida — é o valor da parcela, o prazo de entrega, a máquina em si ou alguma outra coisa?'",
  },
  {
    objecao: "Agora não é hora, o mercado está parado",
    tecnica: "Gap Selling + custo de não agir",
    nivel: "Mestrado",
    resposta:
      "'Justamente quando o mercado aperta é que produtividade e economia decidem o jogo. Quanto te custa continuar pagando aluguel ou rodando máquina velha por mais 6 meses? Esse valor às vezes paga a entrada.'",
  },
  {
    objecao: "Já tenho fornecedor / sou fiel a outra marca",
    tecnica: "Challenger — ensinar algo novo sem atacar a concorrência",
    nivel: "Mestrado",
    resposta:
      "'Respeito muito isso. Posso só te mostrar um dado que a maioria dos clientes não conhece sobre custo por hora e valor de revenda? Se não fizer sentido pra você, seguimos como amigos. Combina?'",
  },
  {
    objecao: "Preciso falar com meu sócio / esposa",
    tecnica: "Garantir o próximo passo concreto",
    nivel: "Pós-Graduação",
    resposta:
      "'Perfeito, decisão importante merece ser compartilhada. Que tal eu preparar um resumo claro com os números pra você apresentar? E já marcamos uma data pra conversarmos os três juntos?'",
  },
  {
    objecao: "Manutenção e peças são caras",
    tecnica: "Prova concreta + autoridade técnica",
    nivel: "Pós-Graduação",
    resposta:
      "'Boa preocupação. A rede New Holland aqui na região tem peças em estoque e técnicos certificados. Te mostro o plano de manutenção preventiva com os custos previstos — sem surpresa. É muito menor do que parece.'",
  },
  {
    objecao: "Prefiro alugar do que comprar",
    tecnica: "Gap Selling — custo real do aluguel vs propriedade",
    nivel: "Mestrado",
    resposta:
      "'Faz sentido em algumas situações. Mas me conta: quanto você paga de aluguel por mês? Porque em muitos casos, em 24-36 meses a parcela é menor que o aluguel e no final você tem o ativo. Posso te montar essa comparação?'",
  },
  {
    objecao: "Não tenho dinheiro agora / orçamento apertado",
    tecnica: "Reframe financeiro + Finame/consórcio",
    nivel: "Mestrado",
    resposta:
      "'Entendo. Por isso existe Finame — entrada menor, taxa subsidiada pelo governo, parcela que cabe no seu fluxo de obra. Deixa eu ver o que consigo montar pra você — às vezes a parcela fica menor do que o aluguel que você já paga.'",
  },
  {
    objecao: "Vou esperar a safra / próximo projeto",
    tecnica: "Custo de oportunidade + Challenger",
    nivel: "Doutorado",
    resposta:
      "'Faz sentido planejar. Só que a construtora X aqui ao lado acabou de comprar — e agora ela vai pegar os contratos que você quer. Quando chegar a safra, você precisa estar equipado, não ainda esperando entrega. Quanto tempo leva a entrega?'",
  },
  {
    objecao: "Já comprei de fulano, não quero mudar",
    tecnica: "Empatia tática (Chris Voss) + Prova social",
    nivel: "Doutorado",
    resposta:
      "'Lealdade é uma qualidade rara hoje. Fico feliz que você tenha isso. Só me permita uma pergunta: se você soubesse que tem uma opção que entrega [benefício específico] que o atual não entrega, você estaria disposto a pelo menos saber mais?' (Espere o 'sim')",
  },
];

// ─── FECHAMENTOS (Mestrado + Doutorado) ──────────────────────────────────────

export const FECHAMENTOS: Fechamento[] = [
  {
    nome: "Fechamento assumido",
    nivel: "Mestrado",
    descricao: "Aja como se a decisão já estivesse tomada, conduzindo direto para os detalhes operacionais.",
    exemplo: "'Então fecho a entrega da E215C pra quinta. Prefere de manhã ou à tarde?'",
    quandoUsar: "Cliente D (Dominante) ou quando sinais de compra são claros.",
  },
  {
    nome: "Fechamento alternativo",
    nivel: "Mestrado",
    descricao: "Ofereça duas opções — qualquer escolha que ele fizer é um 'sim' implícito.",
    exemplo: "'Você prefere Finame em 60x ou consórcio em 80x?'",
    quandoUsar: "Quando o cliente está decidido mas procrastinando o passo final.",
  },
  {
    nome: "Fechamento por escassez/urgência",
    nivel: "Mestrado",
    descricao: "Use um prazo ou condição real que vence. NUNCA minta — perde toda a credibilidade.",
    exemplo: "'Essa taxa especial do Finame vale até dia 30 e tenho apenas 1 unidade nessa cor disponível.'",
    quandoUsar: "Quando há realmente uma condição que expira — taxa, estoque, prazo.",
  },
  {
    nome: "Fechamento por resumo de valor",
    nivel: "Mestrado",
    descricao: "Recapitule todos os benefícios acordados e acordados antes de pedir o sim final.",
    exemplo: "'Então temos: economia de 11% em combustível, garantia de 1 ano, assistência aqui na região e a melhor parcela. O que falta pra fechar?'",
    quandoUsar: "Cliente S (Estável) ou C (Analítico) que precisa de reconfirmação lógica.",
  },
  {
    nome: "Fechamento Ben Franklin",
    nivel: "Doutorado",
    descricao: "Liste prós e contras junto com o cliente, em papel ou na tela. Os prós sempre ganham quando a venda é boa.",
    exemplo: "'Vamos colocar no papel: de um lado o investimento e a parcela, do outro a economia de aluguel, a produtividade e o ativo que você vai ter. O que pesa mais?'",
    quandoUsar: "Cliente C (Analítico) que precisa processar racionalmente a decisão.",
  },
  {
    nome: "Fechamento por silêncio",
    nivel: "Doutorado",
    descricao: "Faça a pergunta de fechamento e cale-se completamente. O primeiro que falar perde. Aguente a tensão.",
    exemplo: "'Então, fechamos?' ... [silêncio absoluto até ele responder]",
    quandoUsar: "Após ter apresentado todos os argumentos. O silêncio força a decisão.",
  },
  {
    nome: "Fechamento Cachorrinho (Puppy Dog)",
    nivel: "Doutorado",
    descricao: "Deixe o cliente 'experimentar' sem risco — uma demonstração, teste ou período de uso gera apego e torna difícil devolver.",
    exemplo: "'Que tal você usar a miniescavadeira uma semana na sua próxima obra? Sem compromisso. Se não gostar, devolvemos. Se gostar, a gente fala de números.'",
    quandoUsar: "Cliente que tem medo de tomar decisão errada ou tem perfil S muito intenso.",
  },
  {
    nome: "Fechamento Colombo ('mais uma coisa')",
    nivel: "PHD",
    descricao: "Quando o cliente acha que a conversa terminou e baixa a guarda, volte com uma última proposta irresistível.",
    exemplo: "[Após a reunião parecer encerrada] 'Ah, quase ia esquecendo: o gerente me liberou uma condição especial de entrada só para esse mês. Posso te falar rapidinho?'",
    quandoUsar: "Cliente que resistiu durante a reunião mas demonstrou interesse real.",
  },
  {
    nome: "Fechamento por perda (Loss Aversion)",
    nivel: "PHD",
    descricao: "Use a neurociência: perder dói 2x mais que ganhar. Enquadre a NÃO compra como uma perda concreta.",
    exemplo: "'Cada mês que você espera, são R$4.800 de aluguel que você joga fora. Em 12 meses, são R$57.600 que poderiam ter virado parcela de máquina própria. O que você prefere perder?'",
    quandoUsar: "Cliente que procrastina apesar de ver o valor da solução.",
  },
  {
    nome: "Fechamento por testemunho ao vivo",
    nivel: "PHD",
    descricao: "Coloque o cliente em contato direto com outro cliente satisfeito da mesma região ou segmento.",
    exemplo: "'Que tal falar 5 minutos com o João da Construtora Silva de Cachoeiro? Ele comprou a E215C há 8 meses. Te passo o número?'",
    quandoUsar: "Cliente S ou C que precisa de prova social concreta, não genérica.",
  },
];

// ─── PSICOLOGIA DA PERSUASÃO (Mestrado + Doutorado) ─────────────────────────

export const PSICOLOGIA_PERSUASAO: PsicologiaTopico[] = [
  {
    nome: "Sistema 1 vs Sistema 2 (Kahneman)",
    nivel: "Mestrado",
    principio:
      "O cérebro tem dois modos: Sistema 1 (rápido, emocional, instintivo — responsável por 95% das decisões de compra) e Sistema 2 (lento, racional, analítico). A maioria das vendas é vencida ou perdida no Sistema 1.",
    comoAplicar: [
      "Crie conexão emocional primeiro — história, rapport, confiança — antes de trazer números",
      "Use imagens mentais: 'Imagina sua máquina chegando na segunda-feira e sua equipe...'",
      "Simplifique a decisão — opções demais ativam o Sistema 2 e paralisam",
      "Use o tom de voz certo: calmo e confiante ativa o Sistema 1 positivo",
    ],
    exemplo:
      "'Imagina você ligando essa máquina na segunda de manhã, sua equipe pronta, e você sabe que tem confiabilidade New Holland por trás.' — isso ativa o Sistema 1 (emoção) muito antes de qualquer planilha.",
    atencao: "Se o cliente está em modo Sistema 2 (analítico, comparando preços), responda com dados — não tente forçar emoção. Leia o momento.",
  },
  {
    nome: "Efeito de Ancoragem (Anchoring)",
    nivel: "Mestrado",
    principio:
      "O primeiro número apresentado na negociação se torna a âncora mental para todos os demais. Quem ancora primeiro tem enorme vantagem — tudo é avaliado em relação à âncora.",
    comoAplicar: [
      "Apresente primeiro o valor de referência alto (máquina mais completa) antes de mostrar a opção ideal",
      "Nunca deixe o cliente ancorar no preço do concorrente — ancore você antes",
      "Mostre o custo do problema ANTES do preço da solução: o problema R$200k/ano, solução R$480k",
      "Ao dar desconto, parta de um número alto para que o final pareça uma conquista",
    ],
    exemplo:
      "Antes de apresentar a E215C por R$480k, mostre: 'O custo de aluguel em 5 anos é R$576k. Hoje eu te mostro como ter a máquina própria por R$480k.' — a âncora está no aluguel mais caro.",
    atencao: "Âncoras falsas ou infladas destroem credibilidade. Use sempre números reais e comprováveis.",
  },
  {
    nome: "Aversão à Perda (Loss Aversion)",
    nivel: "Doutorado",
    principio:
      "Descoberta por Kahneman e Tversky: perder algo dói neurologicamente 2 vezes mais do que o prazer de ganhar a mesma coisa. Enquadrar a não-compra como uma perda é mais poderoso que destacar ganhos.",
    comoAplicar: [
      "Reframe: em vez de 'você vai ganhar R$4k/mês', diga 'você está perdendo R$4k/mês agora'",
      "Mostre o custo de inação: 'Cada mês que espera são R$X de aluguel que nunca voltam'",
      "Use palavras de perda: 'perder', 'jogar fora', 'deixar escapar', 'oportunidade que não volta'",
      "Combine com escassez real para maximizar o efeito",
    ],
    exemplo:
      "'Você está deixando R$57.600 na mesa por ano em aluguel que nunca volta. Esse valor, aplicado em parcela, já seria ativo seu.' — a perda concreta mobiliza mais que qualquer promessa de ganho.",
    atencao: "Não use para manipular — use quando a perda é real e verificável. Ética é inegociável.",
  },
  {
    nome: "Efeito de Posse (Endowment Effect)",
    nivel: "Doutorado",
    principio:
      "Pessoas valorizam muito mais o que já possuem ou já 'experimentaram'. Uma vez que o cliente se imagina usando o produto, o valor percebido aumenta drasticamente — e abrir mão vira perda.",
    comoAplicar: [
      "Use linguagem de posse antes do fechamento: 'Quando você tiver a máquina...', 'Na sua operação...'",
      "Ofereça demonstrações e visitas técnicas — o contato físico cria posse psicológica",
      "Mostre fotos e vídeos da máquina funcionando em obras similares à do cliente",
      "Personalize: 'Essa aqui seria a E215C perfeita pra sua operação em Cachoeiro'",
    ],
    exemplo:
      "Leve o cliente para uma demonstração real da máquina. Deixe-o operar. Peça que ele imagine ela na obra dele. Quando ele 'possui' a máquina na mente, não comprá-la já parece uma perda.",
  },
  {
    nome: "Viés de Comprometimento e Consistência",
    nivel: "Mestrado",
    principio:
      "Uma vez que uma pessoa faz uma declaração ou toma uma ação pequena, ela sente pressão psicológica interna para ser consistente com esse compromisso anterior. Pequenos 'sins' criam inércia em direção ao grande sim.",
    comoAplicar: [
      "Peça micro-compromissos ao longo da conversa: 'Concorda que produtividade é fundamental?' → 'Essa máquina resolve isso, certo?'",
      "Cada visita, cada análise aceita, cada 'sim' pequeno aumenta o compromisso",
      "Após qualquer acordo verbal, confirme por escrito (WhatsApp): 'Ótimo! Então ficou definido que...'",
      "Quando o cliente cancela, lembre dos compromissos anteriores: 'Mas você mesmo disse que a produtividade era prioridade...'",
    ],
    exemplo:
      "'Você concorda que a confiabilidade da máquina é mais importante que o preço inicial?' → sim. 'E que custo de parada de obra é o maior risco?' → sim. 'Então a New Holland, comprovadamente mais confiável, é a escolha lógica?' → difícil dizer não.",
  },
  {
    nome: "Prova Social Avançada",
    nivel: "Mestrado",
    principio:
      "Quando incertos, as pessoas seguem o comportamento dos semelhantes. Prova social é mais poderosa quando vem de alguém parecido com o comprador (mesma região, mesmo segmento, mesmo porte).",
    comoAplicar: [
      "Sempre mencione clientes específicos da mesma cidade ou região: 'A empresa do João em Cachoeiro comprou essa exata'",
      "Use números: 'São 47 máquinas vendidas aqui no sul do ES nos últimos 2 anos'",
      "Testemunhos em vídeo ou WhatsApp de clientes satisfeitos valem ouro",
      "Crie listas de referência por categoria: construtoras, terraplanagem, prefeituras",
    ],
    exemplo:
      "'Sabe a Construtora Bela Vista que você vê nos outdoors? Eles rodaram 3 E215C nas obras do Contorno de Cachoeiro. Posso te colocar em contato com o gestor de frota deles?'",
  },
  {
    nome: "Modelagem e Espelhamento (Mirroring Psicológico)",
    nivel: "Doutorado",
    principio:
      "Neurônios-espelho fazem o cérebro humano copiar inconscientemente o estado emocional, tom de voz e postura corporal de quem está na frente. Quem controla o estado emocional da conversa, controla a venda.",
    comoAplicar: [
      "Espelhe o ritmo de fala do cliente: rápido para D, lento para S",
      "Repita as últimas 2-3 palavras do que ele disse como pergunta (técnica de Mirroring de Chris Voss)",
      "Adote a postura corporal dele discretamente — cria inconscientemente sensação de identidade",
      "Controle seu próprio estado emocional: calma e confiança são contagiosas",
    ],
    exemplo:
      "Cliente: 'Tô vendo umas opções no mercado...' Você: 'Umas opções no mercado?' (pausa — ele vai explicar tudo). Isso é Mirroring puro. Mais eficaz que qualquer pergunta elaborada.",
  },
];

// ─── NEUROCIÊNCIA APLICADA A VENDAS (Doutorado + PHD) ───────────────────────

export const NEUROCIENCIA_VENDAS: NeurocienciaTopico[] = [
  {
    vies: "Dopamina e a Antecipação do Prazer",
    nivel: "Doutorado",
    comoFunciona:
      "O cérebro libera dopamina não na obtenção do prazer, mas na ANTECIPAÇÃO. A imaginação da posse já ativa o sistema de recompensa. Por isso, fazer o cliente visualizar o futuro com a máquina é neurologicamente poderoso.",
    aplicacao: [
      "Use linguagem vívida do futuro: 'Imagina você na segunda-feira, sua equipe operando essa máquina...'",
      "Descreva a obra bem-sucedida com a máquina — o cérebro quase 'sente' a dopamina",
      "Fotos e vídeos da máquina em operação ativam o mesmo circuito",
      "Quanto mais específico o cenário futuro, mais forte o efeito dopaminérgico",
    ],
    exemplo:
      "'Você imagina chegar na obra no dia do prazo, máquina rodando sem problema, o cliente satisfeito e você assinando o contrato do próximo? É isso que a E215C entrega.' — o cérebro já está lá.",
  },
  {
    vies: "Processamento Dual e Sobrecarga Cognitiva",
    nivel: "Doutorado",
    comoFunciona:
      "Quando sobrecarregado com muitas opções ou informações, o cérebro entra em 'paralisia por análise' e tende a não decidir ou adiar. Menos opções e mensagem simples aceleram decisões.",
    aplicacao: [
      "Apresente no máximo 2-3 opções — nunca a linha toda",
      "Simplifique a proposta: uma página, números redondos, benefícios em 3 pontos",
      "Elimine distrações durante apresentações importantes",
      "Use a regra 'SIM-SIM-NÃO': faça perguntas que o cliente confirma, não que o confundem",
    ],
    exemplo:
      "Em vez de apresentar 8 modelos, apresente: 'Para sua operação, tenho 2 opções perfeitas: a E215C (produtividade máxima) ou a E145C (mais econômica para obras médias). Qual faz mais sentido?'",
  },
  {
    vies: "Efeito de Enquadramento (Framing)",
    nivel: "Doutorado",
    comoFunciona:
      "A mesma informação apresentada de forma diferente gera decisões completamente diferentes. '90% de uptime' e '10% de downtime' são idênticos matematicamente mas o primeiro vende e o segundo preocupa.",
    aplicacao: [
      "Sempre enquadre positivamente: '90% de eficiência' não '10% de falhas'",
      "Compare com o pior cenário (status quo) não com o ideal impossível",
      "Invista em ROI enquadrado como ganho: 'você ganha R$4k/mês' não 'você paga R$3k de parcela'",
      "Em concessões: 'Estou te dando R$8k de desconto' não 'O preço final é R$472k'",
    ],
    exemplo:
      "'A E215C consome 14L/h vs 17L/h da concorrente. Em 2.000h de operação por ano, você economiza 6.000 litros — R$38.400 só em diesel.' Enquadrado como ganho concreto, não como detalhe técnico.",
  },
  {
    vies: "Regra do Pico-Fim (Peak-End Rule)",
    nivel: "PHD",
    comoFunciona:
      "As pessoas não avaliam experiências pela média — avaliam pelo momento mais intenso (pico) e pelo como terminou (fim). Uma reunião boa mas com despedida apressada é lembrada como ruim. O fim define tudo.",
    aplicacao: [
      "Crie um momento memorável no meio da reunião (insight surpreendente, número impactante)",
      "Termine SEMPRE com energia positiva, próximo passo claro e agradecimento genuíno",
      "Se houve momento negativo, termine com algo muito positivo para recodificar a memória",
      "No pós-venda: o primeiro mês define como o cliente vai lembrar da compra para sempre",
    ],
    exemplo:
      "Ao final de toda reunião: 'Foi um prazer. Você me autorizou a preparar uma proposta personalizada? Mando até amanhã e a gente marca 20 minutos pra revisar juntos.' — fim positivo com compromisso claro.",
  },
  {
    vies: "Efeito IKEA (Esforço e Valor Percebido)",
    nivel: "Doutorado",
    comoFunciona:
      "Pessoas valorizam mais o que ajudaram a criar. Quando o cliente participa da construção da solução, ele se torna co-dono da ideia — e defender e comprar essa ideia vira uma questão de identidade.",
    aplicacao: [
      "Deixe o cliente participar da especificação: 'Qual equipamento opcional você acha que precisa?'",
      "Peça a opinião dele em cada etapa: 'O que você acha dessa configuração?'",
      "Construa a proposta junto com ele, na hora — não traga proposta pronta",
      "Nomeie a proposta com a referência dele: 'Proposta personalizada para Construtora Silva'",
    ],
    exemplo:
      "'Com base no que você me contou sobre suas obras, montei essa configuração. O que você modificaria?' — qualquer mudança que ele sugerir aumenta seu comprometimento com a compra.",
  },
  {
    vies: "Neurônios-Espelho e Empatia Neural",
    nivel: "PHD",
    comoFunciona:
      "O sistema de neurônios-espelho faz o cérebro 'simular' internamente as ações e emoções que observa. Um vendedor confiante, entusiasmado e genuíno ativa literalmente o mesmo estado no cliente.",
    aplicacao: [
      "Seu estado emocional interno é transmitido — chegue em toda reunião com estado de pico",
      "Entusiasmo genuíno com o produto é contagioso neurologicamente",
      "Sorria com os olhos (não só a boca) — o sistema mirror detecta autenticidade",
      "Quando o cliente está animado, espelhe esse estado — quando resistente, seja calmo e firme",
    ],
    exemplo:
      "'Essa máquina é impressionante — eu mesmo fui ver a E215C trabalhando em uma obra no ES e fica difícil não se emocionar com a eficiência.' Entusiasmo real transfere estado emocional neural.",
  },
];

// ─── NEGOCIAÇÃO AVANÇADA (PHD) ────────────────────────────────────────────────

export const NEGOCIACAO_AVANCADA: TecnicaNegociacao[] = [
  {
    nome: "Empatia Tática (Tactical Empathy)",
    autor: "Chris Voss — Never Split the Difference",
    nivel: "PHD",
    principio:
      "Empatia não é concordar — é fazer o outro se sentir profundamente compreendido. Quando o cliente sente que você entende sua perspectiva, as defesas caem e a negociação flui. Voss usava isso no FBI com terroristas.",
    passos: [
      "Identifique e nomeie a emoção do cliente: 'Parece que você está preocupado com o risco de fazer esse investimento agora'",
      "Pause após nomear — deixe a emoção ser processada (silêncio estratégico)",
      "Valide sem concordar: 'Entendo completamente por que você vê assim'",
      "Reformule: 'Quer dizer que se eu puder te mostrar que o risco é menor do que parece, faz sentido conversarmos?'",
      "Nunca diga 'você está errado' — redirecione com curiosidade genuína",
    ],
    exemplo:
      "'Parece que você já foi prejudicado antes com promessa que não foi cumprida.' [pausa] 'Entendo por que você estaria cauteloso. O que posso fazer para mostrar que aqui é diferente?'",
    frasePoder: "'Parece que [emoção].' — sempre com 'parece', nunca como afirmação absoluta.",
  },
  {
    nome: "Técnica do Espelhamento (Mirroring)",
    autor: "Chris Voss — Never Split the Difference",
    nivel: "PHD",
    principio:
      "Repita as últimas 2-3 palavras do que o cliente disse como pergunta. O cérebro interpreta isso como interesse genuíno e elabora — revelando informação crucial sem que você precise fazer perguntas diretas.",
    passos: [
      "Ouça com atenção a última frase do cliente",
      "Repita as 2-3 últimas palavras com entonação de pergunta suave",
      "Cale-se completamente e espere",
      "O cliente vai elaborar — muitas vezes revelando a objeção real",
      "Repita o processo até chegar na raiz do problema",
    ],
    exemplo:
      "Cliente: 'Tô com dúvida porque já tive problema com entrega.' Você: 'Problema com entrega?' [silêncio] Cliente: 'É, comprei uma máquina uma vez e atrasou 3 meses, minha obra parou...' — agora você sabe exatamente o que precisa resolver.",
    frasePoder: "[Repetir as últimas palavras] + silêncio completo",
  },
  {
    nome: "Rotulagem de Emoções (Labeling)",
    autor: "Chris Voss — Never Split the Difference",
    nivel: "PHD",
    principio:
      "Dar nome às emoções do interlocutor diminui a intensidade delas (princípio neurológico comprovado) e cria conexão profunda. Usado pelo FBI para desescalar sequestros — funciona igualmente em vendas.",
    passos: [
      "Identifique o estado emocional implícito do cliente",
      "Rotule com 'Parece que...', 'Sinto que...', 'Dá impressão que...'",
      "Nunca use 'Eu entendo o que você está sentindo' — soa falso",
      "Se errar o label, o cliente corrigirá — isso também revela informação valiosa",
      "Para emoções positivas, amplifique com labeling: 'Parece que você está animado com o potencial disso'",
    ],
    exemplo:
      "Quando cliente está calado e resistente: 'Parece que tem algo te preocupando que você ainda não falou.' [pausa] — ele vai revelar a objeção real que estava segurando.",
    frasePoder: "'Parece que...' / 'Sinto que...' / 'Dá a impressão que...'",
  },
  {
    nome: "O Poder do 'Não' (Getting to No First)",
    autor: "Chris Voss — Never Split the Difference",
    nivel: "PHD",
    principio:
      "Contra-intuitivo: um 'não' inicial dá ao cliente sensação de controle e segurança, fazendo-o relaxar. Perguntas que ele pode responder 'não' criam abertura para 'sins' subsequentes mais fáceis.",
    passos: [
      "Faça perguntas que o cliente pode dizer 'não': 'Você desistiu de conseguir uma máquina com melhor custo-benefício?'",
      "O 'não' a essa pergunta significa 'sim' ao que você quer",
      "Em negociação de preço: 'Você está me dizendo que o único fator é preço?' → 'Não' abre a conversa de valor",
      "Quando preso: 'Você desistiu dessa negociação?' — reseta a conversa",
    ],
    exemplo:
      "Quando cliente está travado: 'Você desistiu de encontrar a solução que resolve o problema de produtividade da sua obra?' — o 'não' imediato reabre a conversa.",
    frasePoder: "'Você desistiu de...?' / 'Isso significa que você abre mão de...?'",
  },
  {
    nome: "BATNA e Zona de Possível Acordo (ZOPA)",
    autor: "Fisher & Ury — Harvard Negotiation Project",
    nivel: "PHD",
    principio:
      "BATNA = Best Alternative To a Negotiated Agreement. Quem tem a melhor alternativa tem o maior poder. Conhecer seu BATNA e o do cliente define quanto você pode ceder e onde a negociação pode chegar.",
    passos: [
      "Defina seu BATNA antes de qualquer negociação importante: qual a próxima melhor opção se essa não fechar?",
      "Descubra o BATNA do cliente: 'Que outras opções você está avaliando?'",
      "Quanto melhor seu BATNA, menos você precisa ceder — e mais confiante você negocia",
      "Se o cliente tem BATNA fraco (poucas alternativas, urgência), você tem vantagem",
      "ZOPA = sobreposição entre o mínimo que você aceita e o máximo que ele paga",
    ],
    exemplo:
      "Se o cliente só tem fornecedor alternativo sem assistência local e seu BATNA é a próxima obra da região, você negociou da posição mais forte — pode manter o preço com mais confiança.",
    frasePoder: "'Que outras opções você está avaliando?' — descobre o BATNA dele.",
  },
];

// ─── DICAS RÁPIDAS (rotação diária) ──────────────────────────────────────────

export const DICAS_RAPIDAS: string[] = [
  "Quem pergunta, conduz. Fale 30%, escute 70%.",
  "Nunca dê o preço sem antes construir o valor.",
  "Objeção não é 'não' — é pedido de mais informação.",
  "O follow-up vence o talento: 80% das vendas precisam de 5+ contatos.",
  "Venda o custo por hora trabalhada, não o preço de etiqueta.",
  "Anote o nome de quem decide e fale com quem decide.",
  "Cada cliente tem um perfil DISC. Adapte sua abordagem a ele.",
  "Pós-venda forte = recompra + indicação. A próxima venda começa na entrega.",
  "Prova social fecha negócio: mostre quem já comprou na região.",
  "Marque sempre o próximo passo antes de encerrar a conversa.",
  "Perder dói 2x mais que ganhar. Mostre o custo de não comprar.",
  "O primeiro número dito na negociação vira âncora. Ancore você primeiro.",
  "Silêncio após a pergunta de fechamento é sua arma mais poderosa.",
  "Clientes compram de quem confiam. Confiança > argumentos.",
  "A demonstração cria posse psicológica. Deixe o cliente operar a máquina.",
  "Nomeie a emoção do cliente: 'Parece que você está preocupado com...' — isso conecta.",
  "Cada pequeno 'sim' cria inércia em direção ao grande sim.",
  "Repita as últimas palavras do cliente como pergunta — ele vai revelar tudo.",
  "Simplifique: 2-3 opções máximo. Muitas opções paralisam a decisão.",
  "Termine toda reunião com energia positiva e próximo passo combinado.",
  "Seu entusiasmo é contagioso neurologicamente. Estado de pico antes de toda reunião.",
  "A âncora não é o preço — é o custo do problema sem solução.",
  "Clientes compram resultados, não máquinas. Venda o resultado.",
  "Use 'quando você tiver a máquina' — linguagem de posse antes do fechamento.",
  "Challenger: ensine algo que o cliente não sabe. Quem educa, vende.",
  "MEDDIC: qualifique antes de propor. Tempo gasto com não-decisor é tempo perdido.",
  "A reunião ruim que termina bem é lembrada como boa. Sempre termine forte.",
  "Faça a pergunta de fechamento UMA vez. Repeti-la soa desesperado.",
  "Urgência sem verdade destrói credibilidade. Use só quando real.",
  "Indicação é 5x mais fácil de fechar que prospect frio. Peça referência sempre.",
];

// ─── TEMAS PARA GERAÇÃO SEMANAL AUTOMÁTICA ───────────────────────────────────

export const TEMAS_SEMANAIS: string[] = [
  "como aplicar empatia tática de Chris Voss para superar objeção de preço em escavadeiras",
  "neurociência do fechamento: como usar ancoragem de preço na venda de máquinas pesadas",
  "técnica de mirroring no WhatsApp: como fazer o cliente revelar suas objeções reais",
  "como vender para perfil DISC D que decide rápido e quer só ROI",
  "aversão à perda: como mostrar o custo real de não comprar uma escavadeira",
  "SPIN Selling na prática: 10 perguntas de implicação para terraplenagem",
  "como usar prova social regional para fechar com clientes indecisos no sul do ES",
  "o efeito de posse na demonstração: por que deixar o cliente operar é sua melhor arma",
  "Challenger Sale para vencer concorrente mais barato: ensinando TCO ao cliente",
  "como qualificar leads com MEDDIC antes de gastar tempo com proposta",
  "psicologia do compromisso: como pequenos sins levam ao fechamento de máquinas pesadas",
  "como usar Gap Selling com clientes que ainda alugam máquinas",
  "fechamento por silêncio: a técnica mais poderosa e menos usada em vendas de alto valor",
  "neurônios-espelho em vendas: como seu estado emocional impacta o cliente",
  "como adaptar a abordagem de vendas para cada perfil DISC em máquinas Dynapac",
  "técnicas de negociação Harvard (BATNA) para defender seu preço sem ceder",
  "como usar storytelling para tornar o TCO emocional e não apenas racional",
  "o poder do 'não' em negociações: por que perguntas que o cliente nega funcionam melhor",
  "como criar urgência ética e real sem mentir para o cliente",
  "roteiro de WhatsApp completo para reativar cliente que sumiu após proposta",
  "como usar o efeito IKEA: construindo a proposta junto com o cliente",
  "pico-fim em vendas: como garantir que o cliente lembre bem da reunião",
  "objeção 'preciso falar com meu sócio': como transformar em próxima reunião com os dois",
  "como vender Finame e consórcio como investimento, não como dívida",
];

export function dicaDoDia(): string {
  const dia = Math.floor(Date.now() / 86400000);
  return DICAS_RAPIDAS[dia % DICAS_RAPIDAS.length];
}

// Retorna um tema semanal para geração automática de conteúdo
export function temaDestaSeamana(): string {
  const semana = Math.floor(Date.now() / (86400000 * 7));
  return TEMAS_SEMANAIS[semana % TEMAS_SEMANAIS.length];
}

// Resumo compacto para injetar no contexto do Cérebro
export function resumoAcademia(): string {
  const metodologias = METODOLOGIAS.map((m) => m.nome).join(", ");
  const psicologia = PSICOLOGIA_PERSUASAO.map((p) => p.nome).join(", ");
  const neuro = NEUROCIENCIA_VENDAS.map((n) => n.vies).join(", ");
  const negociacao = NEGOCIACAO_AVANCADA.map((n) => n.nome).join(", ");
  return `Metodologias: ${metodologias}. Psicologia: ${psicologia}. Neurociência: ${neuro}. Negociação: ${negociacao}.`;
}
