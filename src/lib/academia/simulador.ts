// SIMULADOR DA VENDA: a Academia monta um cenário, você escolhe o que falar,
// ela mostra a consequência e monta o próximo cenário a partir da sua
// escolha — até o cliente fechar, sumir ou levar seu preço para o concorrente.
//
// Dois modos, ambos usando o mesmo formato:
//   1) Banco de cenários encadeados (aqui): funciona sem IA, de graça, e é o
//      que garante que o treino existe mesmo sem chave de API.
//   2) Continuação com IA (lib/ai/treino.ts): quando o banco acaba, a IA
//      segue a história com o mesmo formato e as regras do negócio.
//
// Módulo PURO (dados + regras) — testável e sem banco.

export type Qualidade = "boa" | "media" | "ruim";

export type Desfecho = { tipo: "ganhou" | "perdeu" | "travou"; texto: string };

export type OpcaoSimulador = {
  id: string;
  texto: string;          // o que você fala ou faz
  qualidade: Qualidade;
  feedback: string;       // por que funciona (ou por que custa caro)
  proximo?: string;       // cenário que essa escolha abre
  // Escolha que encerra a história ali mesmo (ganhou, perdeu ou travou).
  desfecho?: Desfecho;
};

export type CenarioSimulador = {
  id: string;
  etapa: string;          // id em academia/etapas.ts
  titulo: string;
  canal: "mensagem" | "telefone" | "presencial";
  contexto: string;       // a situação
  falaDoCliente?: string; // o que ele disse, nas palavras dele
  pergunta: string;       // o que se pede de você
  opcoes: OpcaoSimulador[];
  // Fim de linha quando o cenário inteiro encerra a história.
  desfecho?: Desfecho;
};

export const PONTOS: Record<Qualidade, number> = { boa: 10, media: 5, ruim: 0 };

// ── Banco de cenários ───────────────────────────────────────────────────────
export const CENARIOS: CenarioSimulador[] = [
  // ══ TRILHA 1: o cliente que só quer preço ═════════════════════════════════
  {
    id: "preco-1",
    etapa: "qualificacao",
    titulo: "Ele só quer o preço",
    canal: "mensagem",
    contexto: "Número desconhecido chama no WhatsApp às 8h de uma terça. Não é cliente cadastrado.",
    falaDoCliente: "Bom dia. Quanto custa uma escavadeira de 20 toneladas?",
    pergunta: "O que você responde?",
    opcoes: [
      {
        id: "a",
        texto: "“Bom dia! A E215C fica em torno de R$ 1.850.000. Qualquer coisa estou à disposição.”",
        qualidade: "ruim",
        feedback: "Você entregou o número mais valioso que tinha para quem você não conhece. A partir daqui você virou tabela de preço: ele compara com dois concorrentes e você nunca mais é chamado.",
        proximo: "preco-2-ruim",
      },
      {
        id: "b",
        texto: "“Bom dia! Consigo te passar. Só para eu mandar o valor da máquina certa: o serviço é o quê e onde fica?”",
        qualidade: "boa",
        feedback: "Não negou o preço (o que irrita), explicou o porquê em uma linha e devolveu com duas perguntas objetivas. É assim que se ganha o direito de qualificar.",
        proximo: "preco-2-bom",
      },
      {
        id: "c",
        texto: "“Bom dia! Preço eu só passo depois de uma visita técnica.”",
        qualidade: "media",
        feedback: "A intenção está certa, mas soa como regra da loja. O cliente sente que precisa pagar um pedágio para ser atendido — muitos somem aqui.",
        proximo: "preco-2-bom",
      },
    ],
  },
  {
    id: "preco-2-bom",
    etapa: "qualificacao",
    titulo: "A resposta veio curta",
    canal: "mensagem",
    contexto: "Ele respondeu rápido, mas sem detalhe.",
    falaDoCliente: "É para terraplenagem mesmo. Aqui é em Cachoeiro.",
    pergunta: "Como você avança?",
    opcoes: [
      {
        id: "a",
        texto: "“Perfeito. Terraplenagem em que material — terra, brita ou rocha? E a obra começa quando?”",
        qualidade: "boa",
        feedback: "Duas perguntas que decidem a máquina (material) e a urgência (prazo). Continua uma por vez, sem interrogatório.",
        proximo: "preco-3",
      },
      {
        id: "b",
        texto: "“Ótimo! Então a E215C atende bem. Mando a ficha técnica e o preço?”",
        qualidade: "media",
        feedback: "Você dimensionou com meia informação. 'Terraplenagem' em rocha e em terra pedem máquinas diferentes — e você voltou para o preço cedo demais.",
        proximo: "preco-3",
      },
      {
        id: "c",
        texto: "“Show. Posso passar aí amanhã para ver a obra?”",
        qualidade: "media",
        feedback: "Pedir visita é sempre bom, mas cedo demais e sem motivo claro o cliente acha invasivo. Antes, dê um motivo: ver material e acesso para indicar a máquina certa.",
        proximo: "preco-3",
      },
    ],
  },
  {
    id: "preco-3",
    etapa: "qualificacao",
    titulo: "O sinal de alerta",
    canal: "mensagem",
    contexto: "Ele responde de novo, e agora aparece a pista de que talvez esteja só cotando.",
    falaDoCliente: "É terra mesmo. Olha, eu só preciso de um orçamento no papel para apresentar. Pode mandar por e-mail.",
    pergunta: "O que isso significa e o que você faz?",
    opcoes: [
      {
        id: "a",
        texto: "Mandar o orçamento formal por e-mail, como ele pediu.",
        qualidade: "ruim",
        feedback: "“Orçamento no papel para apresentar” quase sempre é cotação para compor preço de terceiro ou para pressionar outro fornecedor. Mandar sem entender é trabalhar de graça.",
        proximo: "preco-4-perdeu",
      },
      {
        id: "b",
        texto: "“Mando sim. Só para o orçamento sair do jeito certo: ele vai ser apresentado para quem? Licitação, banco ou sócio?”",
        qualidade: "boa",
        feedback: "Pergunta certeira e natural. A resposta te diz se é licitação (ótimo, tem verba e prazo), banco (financiamento em curso) ou comparação com concorrente.",
        proximo: "preco-4-bom",
      },
      {
        id: "c",
        texto: "“Sem problema. Antes disso, me deixa te mostrar uma conta de custo por hora? Leva 5 minutos no telefone.”",
        qualidade: "media",
        feedback: "Boa tentativa de agregar valor, mas você ignorou o pedido dele. Atenda o pedido E pergunte — as duas coisas.",
        proximo: "preco-4-bom",
      },
    ],
  },
  {
    id: "preco-4-bom",
    etapa: "objecoes",
    titulo: "A verdade aparece",
    canal: "mensagem",
    contexto: "Ele responde com honestidade — e agora você sabe onde está pisando.",
    falaDoCliente: "É para comparar com uma proposta que já tenho da concorrência. Eles fizeram R$ 1.760.000.",
    pergunta: "Como você conduz agora?",
    opcoes: [
      {
        id: "a",
        texto: "“Consigo chegar nesse valor. Fecha comigo?”",
        qualidade: "ruim",
        feedback: "Você entrou na guerra de preço sem saber se a configuração é igual. Provavelmente destruiu sua margem — e ele ainda vai levar seu número de volta ao concorrente.",
        proximo: "preco-5-perdeu",
      },
      {
        id: "b",
        texto: "“Obrigado pela franqueza. Me manda a proposta deles? Comparo item a item e te digo honestamente onde eles ganham e onde a gente ganha.”",
        qualidade: "boa",
        feedback: "Transparência gera transparência. Comparando configuração você descobre o que falta na outra proposta (garantia, implemento, prazo) e volta a vender valor.",
        proximo: "preco-5-bom",
      },
      {
        id: "c",
        texto: "“Cuidado com essa marca, a assistência deles é fraca na região.”",
        qualidade: "ruim",
        feedback: "Depreciar concorrente derruba sua credibilidade e ainda dá a ele um argumento para te descartar. Compare fatos, nunca ataque.",
        proximo: "preco-5-perdeu",
      },
    ],
  },
  {
    id: "preco-5-bom",
    etapa: "proposta",
    titulo: "Comparando de verdade",
    canal: "telefone",
    contexto: "Ele mandou a proposta do concorrente. A máquina deles vem sem o kit de proteção de mangueiras e com garantia de 12 meses; a sua tem 24 meses e o kit incluso.",
    pergunta: "Como você apresenta a comparação?",
    opcoes: [
      {
        id: "a",
        texto: "“A deles é mais barata porque vem pelada: sem kit de proteção e com metade da garantia.”",
        qualidade: "media",
        feedback: "O conteúdo está certo, o tom não. “Pelada” soa como ataque e coloca o cliente na defensiva por ter cotado com eles.",
        proximo: "preco-6",
      },
      {
        id: "b",
        texto: "“Comparei as duas. A diferença de R$ 90 mil se explica: garantia de 12 contra 24 meses e o kit de proteção, que sozinho é R$ 35 mil. Igualando os itens, a diferença real cai para uns R$ 25 mil — e aí entra disponibilidade e revenda.”",
        qualidade: "boa",
        feedback: "Número contra número, sem adjetivo. Você tirou a discussão do preço de capa e levou para a comparação real, onde você ganha.",
        proximo: "preco-6",
      },
      {
        id: "c",
        texto: "“São propostas muito parecidas, no fim é questão de confiança.”",
        qualidade: "ruim",
        feedback: "Você jogou fora sua vantagem. Se as propostas são iguais, o cliente escolhe a mais barata — e não é a sua.",
        proximo: "preco-6",
      },
    ],
  },
  {
    id: "preco-6",
    etapa: "fechamento",
    titulo: "A hora de pedir",
    canal: "telefone",
    contexto: "Ele ouviu a comparação, concordou com os números e falou que a obra começa dia 20.",
    falaDoCliente: "Faz sentido o que você falou. Realmente a garantia pesa.",
    pergunta: "Qual a sua próxima frase?",
    opcoes: [
      {
        id: "a",
        texto: "“Que bom que fez sentido! Qualquer dúvida me chama.”",
        qualidade: "ruim",
        feedback: "Você tinha todos os sinais na mesa e não pediu o pedido. É assim que a maioria das vendas de máquina é perdida — não para o concorrente, para o silêncio.",
        desfecho: { tipo: "travou", texto: "A negociação esfriou. Duas semanas depois ele comprou do concorrente, que ligou pedindo o pedido." },
      },
      {
        id: "b",
        texto: "“Então vamos fechar para a obra do dia 20? Se eu mandar a ficha do banco hoje, a máquina sai a tempo.”",
        qualidade: "boa",
        feedback: "Pedido feito com data, ancorado na urgência real dele. É a pergunta de fechamento certa no momento certo.",
        desfecho: { tipo: "ganhou", texto: "Ele respondeu “manda a ficha”. Máquina entregue dia 18, dois dias antes da obra começar." },
      },
      {
        id: "c",
        texto: "“Vou preparar uma proposta revisada e te mando amanhã.”",
        qualidade: "media",
        feedback: "Você adiou sem necessidade. O cliente estava pronto; mais um documento só dá tempo para o concorrente voltar.",
        desfecho: { tipo: "travou", texto: "A proposta foi, mas a decisão ficou para “semana que vem” — e escorregou por um mês." },
      },
    ],
  },
  {
    id: "preco-2-ruim",
    etapa: "objecoes",
    titulo: "O preço solto voltou",
    canal: "mensagem",
    contexto: "Três dias depois do preço enviado sem qualificação, ele volta.",
    falaDoCliente: "Consegui R$ 1.690.000 com outro fornecedor. Você cobre?",
    pergunta: "E agora?",
    opcoes: [
      {
        id: "a",
        texto: "“Cubro sim, fecha comigo.”",
        qualidade: "ruim",
        feedback: "Margem destruída e ainda por cima ele vai levar seu novo número de volta para o outro. Leilão só tem um vencedor, e não é você.",
        desfecho: { tipo: "perdeu", texto: "Ele levou seu valor ao concorrente, que cobriu de novo. Você perdeu a venda e a margem da próxima." },
      },
      {
        id: "b",
        texto: "“Antes de falar de valor, me deixa entender o serviço que ela vai fazer? Pode ser que a máquina dele nem seja a certa para o que você precisa.”",
        qualidade: "boa",
        feedback: "Tarde, mas ainda dá para recuperar: sair do leilão e voltar a qualificar é a única saída quando o preço vazou cedo.",
        proximo: "preco-3",
      },
      {
        id: "c",
        texto: "Não responder e esperar ele voltar.",
        qualidade: "ruim",
        feedback: "Silêncio nunca ganha negociação de máquina. Ele fecha com quem estiver conversando.",
        desfecho: { tipo: "perdeu", texto: "Ele comprou do outro em quatro dias." },
      },
    ],
  },
  {
    id: "preco-4-perdeu",
    etapa: "objecoes",
    titulo: "O orçamento virou papel de compor preço",
    canal: "mensagem",
    contexto: "Você mandou o orçamento formal por e-mail. Duas semanas de silêncio.",
    pergunta: "O que fazer agora?",
    opcoes: [
      {
        id: "a",
        texto: "Ligar: “[nome], tudo bem? Não quero te encher. Só me diz em uma palavra onde travou: valor, prazo ou decisão?”",
        qualidade: "boa",
        feedback: "Ligação com pergunta fácil de responder é o que mais destrava silêncio. Mensagem some, ligação obriga a uma resposta.",
        proximo: "preco-4-bom",
      },
      {
        id: "b",
        texto: "Mandar mensagem: “Oi, conseguiu analisar a proposta?”",
        qualidade: "media",
        feedback: "Pergunta fechada demais e sem valor novo — a resposta mais provável é “ainda não”, ou nenhuma.",
        desfecho: { tipo: "travou", texto: "Sem resposta. A negociação ficou pendurada no funil por mais um mês." },
      },
      {
        id: "c",
        texto: "Baixar o preço por conta própria e reenviar.",
        qualidade: "ruim",
        feedback: "Desconto sem pedido e sem contrapartida sinaliza que o primeiro preço era inflado. Você perde credibilidade e margem.",
        desfecho: { tipo: "perdeu", texto: "Ele guardou o novo número para negociar com o concorrente." },
      },
    ],
  },
  {
    id: "preco-5-perdeu",
    etapa: "objecoes",
    titulo: "A guerra de preço",
    canal: "telefone",
    contexto: "Você cobriu a proposta do concorrente. Ele voltou.",
    falaDoCliente: "Levei seu valor lá e eles baixaram mais R$ 20 mil. Consegue melhorar?",
    pergunta: "Como sair disso?",
    opcoes: [
      {
        id: "a",
        texto: "“Não consigo. Meu valor já está no limite e, sinceramente, se eu baixar de novo não consigo te entregar o serviço que prometi.”",
        qualidade: "boa",
        feedback: "Parar a espiral com honestidade é a única saída. Muitas vendas se ganham exatamente aqui: o cliente entende que você tem um piso e passa a confiar no seu número.",
        proximo: "preco-6",
      },
      {
        id: "b",
        texto: "“Consigo mais R$ 10 mil, mas é o último.”",
        qualidade: "ruim",
        feedback: "Já houve um “último” antes. Cada rodada ensina o cliente que sempre tem mais, e ele volta ao concorrente com seu novo número.",
        desfecho: { tipo: "perdeu", texto: "Mais uma rodada e ele fechou com o outro, R$ 5 mil abaixo do seu piso." },
      },
    ],
  },

  // ══ TRILHA 2: prospecção na obra ══════════════════════════════════════════
  {
    id: "obra-1",
    etapa: "prospeccao",
    titulo: "Você parou na obra",
    canal: "presencial",
    contexto: "Voltando de Alegre, você vê uma terraplenagem começando com uma retro velha de outra marca. Placa: Construtora Serra Azul.",
    pergunta: "Qual a sua primeira frase ao descer do carro?",
    opcoes: [
      {
        id: "a",
        texto: "“Bom dia! Sou o [vendedor], da [empresa]. Vocês não querem trocar essa retro não?”",
        qualidade: "ruim",
        feedback: "Começou vendendo e ainda criticou o equipamento deles. A defesa sobe na hora.",
        proximo: "obra-2-ruim",
      },
      {
        id: "b",
        texto: "“Bom dia! Sou o [vendedor], trabalho com máquina New Holland e Dynapac aqui na região. Passei e vi o serviço de vocês. Quem toca a parte de equipamento aqui?”",
        qualidade: "boa",
        feedback: "Se apresenta, dá contexto e pede a pessoa certa. Falar com quem não decide queima a visita e o seu tempo.",
        proximo: "obra-2-bom",
      },
      {
        id: "c",
        texto: "Tirar foto da placa e mandar mensagem depois, sem descer do carro.",
        qualidade: "media",
        feedback: "Melhor que não fazer nada, mas você perdeu a chance de ver o serviço e conhecer quem opera. Na obra você aprende em 10 minutos o que a mensagem não conta em duas semanas.",
        proximo: "obra-2-bom",
      },
    ],
  },
  {
    id: "obra-2-bom",
    etapa: "prospeccao",
    titulo: "Chegou o encarregado",
    canal: "presencial",
    contexto: "O encarregado vem, desconfiado, de bota e colete. A retro está parada com o motor ligado.",
    falaDoCliente: "Pois não. O dono não está, sou eu que toco aqui.",
    pergunta: "O que você fala?",
    opcoes: [
      {
        id: "a",
        texto: "“Então me deixa te mostrar nossa linha, temos condição especial este mês.”",
        qualidade: "ruim",
        feedback: "O encarregado não compra. Ele pode te abrir a porta do dono — ou fechar. Vender para ele é desperdiçar o contato.",
        proximo: "obra-3",
      },
      {
        id: "b",
        texto: "“Tranquilo. Aproveito que estou aqui: como essa retro tem se comportado no serviço? Vocês estão tendo parada com ela?”",
        qualidade: "boa",
        feedback: "Perguntou sobre a dor dele, não sobre a compra. Quem opera adora falar do que atrapalha — e isso é a sua informação de ouro.",
        proximo: "obra-3",
      },
      {
        id: "c",
        texto: "“Sem problema, passo outro dia quando o dono estiver.”",
        qualidade: "media",
        feedback: "Educado, mas você foi embora sem nada. Dois minutos de conversa com quem opera valem uma visita inteira.",
        proximo: "obra-3",
      },
    ],
  },
  {
    id: "obra-2-ruim",
    etapa: "prospeccao",
    titulo: "A porta fechou",
    canal: "presencial",
    contexto: "O encarregado responde seco, sem olhar para você.",
    falaDoCliente: "A máquina é boa, não estamos trocando nada. Estamos no meio do serviço aqui.",
    pergunta: "Como recuperar?",
    opcoes: [
      {
        id: "a",
        texto: "“Desculpa, me expressei mal. Na verdade eu só queria entender o serviço de vocês. É pavimentação de estrada rural?”",
        qualidade: "boa",
        feedback: "Reconhecer o erro e recomeçar pela operação é o jeito de reabrir a porta. Humildade funciona em obra.",
        proximo: "obra-3",
      },
      {
        id: "b",
        texto: "“Entendo, mas essa aí já deve estar com bastante hora, né?”",
        qualidade: "ruim",
        feedback: "Insistir na crítica confirma a impressão ruim. Ele vai te dispensar e contar para o dono.",
        desfecho: { tipo: "perdeu", texto: "Você foi dispensado em dois minutos. Quando o dono precisou de máquina, chamou o concorrente que visitou na semana seguinte." },
      },
    ],
  },
  {
    id: "obra-3",
    etapa: "prospeccao",
    titulo: "A informação apareceu",
    canal: "presencial",
    contexto: "O encarregado destrava e conta o problema real.",
    falaDoCliente: "Olha, ela para direto. Mês passado ficou 9 dias esperando peça. O dono está p… da vida.",
    pergunta: "O que você faz com essa informação?",
    opcoes: [
      {
        id: "a",
        texto: "“9 dias parados! Com a nossa você não passa por isso, temos peça em Cachoeiro.”",
        qualidade: "media",
        feedback: "A informação é boa e o argumento é verdadeiro, mas você usou com quem não decide e ainda soou como propaganda.",
        proximo: "obra-4",
      },
      {
        id: "b",
        texto: "“Nove dias parado numa obra com prazo é dinheiro demais. Como eu faço para falar com o dono? Queria levar a conta de quanto essa parada custou para ele.”",
        qualidade: "boa",
        feedback: "Validou a dor, transformou em dinheiro e pediu o caminho para o decisor com um motivo que interessa ao dono.",
        proximo: "obra-4",
      },
      {
        id: "c",
        texto: "“Que marca é? Essas aí dão problema mesmo.”",
        qualidade: "ruim",
        feedback: "Depreciar concorrente na obra sempre volta contra você — muitas vezes o dono escolheu aquela marca.",
        proximo: "obra-4",
      },
    ],
  },
  {
    id: "obra-4",
    etapa: "qualificacao",
    titulo: "O dono ligou",
    canal: "telefone",
    contexto: "No fim da tarde o dono te liga. Direto, sem rodeio.",
    falaDoCliente: "Me falaram que você passou lá. O que você tem de retroescavadeira e por quanto?",
    pergunta: "Como você responde a um cliente Dominante que já pergunta preço?",
    opcoes: [
      {
        id: "a",
        texto: "“Tenho a B95C e a B110C. Antes do valor, duas perguntas rápidas: o serviço é sempre esse tipo de terraplenagem? E você compra à vista ou financiado?”",
        qualidade: "boa",
        feedback: "Com Dominante: seja direto, mostre que tem as opções na ponta da língua e faça poucas perguntas, objetivas. Ele respeita quem não enrola.",
        proximo: "obra-5",
      },
      {
        id: "b",
        texto: "“Precisaria entender melhor a operação de vocês antes, seria possível agendar uma visita técnica?”",
        qualidade: "media",
        feedback: "Com perfil Dominante isso soa como enrolação. Ele quer objetividade — dê informação e faça as perguntas no mesmo fôlego.",
        proximo: "obra-5",
      },
      {
        id: "c",
        texto: "“A B110C fica em R$ 720 mil.”",
        qualidade: "ruim",
        feedback: "Preço sem qualificação, de novo. Com Dominante o risco é maior: ele decide rápido, e se decidir com base só em preço, decide contra você.",
        proximo: "obra-5",
      },
    ],
  },
  {
    id: "obra-5",
    etapa: "visita",
    titulo: "A visita marcada",
    canal: "telefone",
    contexto: "Ele topou receber você amanhã às 14h na obra.",
    pergunta: "O que você leva?",
    opcoes: [
      {
        id: "a",
        texto: "Catálogo, ficha técnica e tabela de preços.",
        qualidade: "media",
        feedback: "Material é bom, mas não é o que decide. Sem a conta do custo dele, você vira mais um folheto.",
        proximo: "obra-6",
      },
      {
        id: "b",
        texto: "A conta de custo por hora com os números dele (9 dias parados, diesel, manutenção da retro atual) e a simulação de financiamento em dois prazos.",
        qualidade: "boa",
        feedback: "Você vai levar o problema dele traduzido em dinheiro e a solução com o pagamento desenhado. É assim que se ganha de quem só leva catálogo.",
        proximo: "obra-6",
      },
      {
        id: "c",
        texto: "Uma máquina para demonstração.",
        qualidade: "media",
        feedback: "Demonstração é forte, mas cara e nem sempre possível no dia seguinte. Antes dela, a conta já convence a maioria.",
        proximo: "obra-6",
      },
    ],
  },
  {
    id: "obra-6",
    etapa: "fechamento",
    titulo: "Na obra, depois da conta",
    canal: "presencial",
    contexto: "Você mostrou que a parada de 9 dias custou cerca de R$ 54 mil em serviço não faturado, e que a parcela da nova fica em R$ 18 mil/mês.",
    falaDoCliente: "Essa conta é boa mesmo. Mas eu ia trocar só ano que vem.",
    pergunta: "Qual a sua resposta?",
    opcoes: [
      {
        id: "a",
        texto: "“Sem problema, te procuro no ano que vem então.”",
        qualidade: "ruim",
        feedback: "Você aceitou um adiamento sem testar. “Ano que vem” quase nunca é uma data — é uma forma educada de não decidir agora.",
        desfecho: { tipo: "travou", texto: "Passou o ano. Quando ele trocou, foi com o vendedor que apareceu no mês certo." },
      },
      {
        id: "b",
        texto: "“Entendo. Só que pela conta, cada mês esperando custa uns R$ 6 mil de parada. Em 12 meses é mais que a entrada. Se eu conseguir a entrega para março com a primeira parcela em maio, faz sentido antecipar?”",
        qualidade: "boa",
        feedback: "Transformou o adiamento em conta e ofereceu uma ponte concreta (entrega e carência) em vez de discutir. Fechamento por alternativa.",
        desfecho: { tipo: "ganhou", texto: "Ele pediu a simulação com carência e fechou em 11 dias. A retro velha foi vendida por ele mesmo, à parte." },
      },
      {
        id: "c",
        texto: "“Posso te dar 5% de desconto se fechar hoje.”",
        qualidade: "ruim",
        feedback: "Desconto não resolve objeção de calendário. Você entregou margem sem tratar o motivo real do adiamento.",
        desfecho: { tipo: "travou", texto: "Ele agradeceu o desconto e continuou adiando — agora esperando um desconto maior." },
      },
    ],
  },

  // ══ TRILHA 3: o cliente que chega pelo Marketing ══════════════════════════
  {
    id: "insta-1",
    etapa: "prospeccao",
    titulo: "Ele viu o seu post",
    canal: "mensagem",
    contexto: "Você publicou um post sobre custo por hora. Um produtor de café de Iúna chama no WhatsApp.",
    falaDoCliente: "Vi seu post sobre custo por hora. Tenho um trator velho e queria ver uma pá carregadeira para o terreiro. Só que não entendo nada de máquina.",
    pergunta: "Como você começa?",
    opcoes: [
      {
        id: "a",
        texto: "“Que bom que gostou! Para terreiro a W130B é ideal. Fica em R$ 890 mil.”",
        qualidade: "ruim",
        feedback: "Ele disse que não entende de máquina e você respondeu com sigla e preço. Você acabou de assustar um cliente que estava aberto.",
        proximo: "insta-2",
      },
      {
        id: "b",
        texto: "“Que bom que o post ajudou! Fica tranquilo que eu explico tudo em português. Me conta: quantas sacas você colhe e como faz o carregamento hoje?”",
        qualidade: "boa",
        feedback: "Acolheu a insegurança, prometeu linguagem simples e perguntou pela operação dele, não por máquina. Com perfil Estável, segurança vem antes de técnica.",
        proximo: "insta-2",
      },
      {
        id: "c",
        texto: "“Vamos marcar uma visita então?”",
        qualidade: "media",
        feedback: "Cedo. Ele ainda está testando se pode confiar em você. Converse um pouco antes de pedir a agenda dele.",
        proximo: "insta-2",
      },
    ],
  },
  {
    id: "insta-2",
    etapa: "qualificacao",
    titulo: "O medo real",
    canal: "mensagem",
    contexto: "Ele conta a operação e solta o que realmente o segura.",
    falaDoCliente: "São umas 3 mil sacas. Hoje faço na pá do trator mesmo. Mas olha, financiamento me dá medo, já vi vizinho se enrolar.",
    pergunta: "Como tratar esse medo?",
    opcoes: [
      {
        id: "a",
        texto: "“Financiamento hoje está muito seguro, a taxa está ótima, não precisa ter medo.”",
        qualidade: "ruim",
        feedback: "Você negou o sentimento dele. Com perfil Estável, isso aumenta a desconfiança em vez de diminuir.",
        proximo: "insta-3",
      },
      {
        id: "b",
        texto: "“Medo justo, já vi gente se enrolar também. Por isso eu faço a conta ao contrário: primeiro vemos quanto a máquina gera ou economiza por mês, e só entra financiamento se a parcela couber com folga nisso. Se não couber, eu te falo para não fazer.”",
        qualidade: "boa",
        feedback: "Validou o medo, mostrou método e — o mais forte — se dispôs a dizer não. Isso constrói confiança com perfil Estável.",
        proximo: "insta-3",
      },
      {
        id: "c",
        texto: "“Então vamos de à vista mesmo?”",
        qualidade: "media",
        feedback: "Pulou para a solução sem entender a capacidade dele. Pode estar jogando fora uma venda que só acontece financiada.",
        proximo: "insta-3",
      },
    ],
  },
  {
    id: "insta-3",
    etapa: "objecoes",
    titulo: "A pergunta que aparece em toda venda no agro",
    canal: "mensagem",
    contexto: "A conversa avançou bem. Ele pergunta pelo que ouviu de outros vendedores.",
    falaDoCliente: "E meu trator velho, vocês pegam como entrada?",
    pergunta: "O que você responde?",
    opcoes: [
      {
        id: "a",
        texto: "“Pegamos sim, faço uma avaliação e abato na entrada.”",
        qualidade: "ruim",
        feedback: "Cuidado: isso depende da regra da SUA operação. Prometer o que a empresa não faz destrói a confiança na hora de fechar. Confira a regra em Configurações › Realidade do negócio.",
        proximo: "insta-4",
      },
      {
        id: "b",
        texto: "“A gente não trabalha pegando máquina como entrada. O que eu faço é te ajudar a vender o trator direto para outro produtor — costuma render mais para você do que uma avaliação de troca — e a entrada entra em dinheiro.”",
        qualidade: "boa",
        feedback: "Disse a verdade da operação, sem constrangimento, e ofereceu uma saída melhor para o cliente. É exatamente a regra cadastrada na Realidade do negócio.",
        proximo: "insta-4",
      },
      {
        id: "c",
        texto: "“Vou verificar com a gerência e te falo.”",
        qualidade: "media",
        feedback: "Honesto, mas se a regra já é conhecida, dizer na hora vale mais: adia a conversa e deixa dúvida no ar.",
        proximo: "insta-4",
      },
    ],
  },
  {
    id: "insta-4",
    etapa: "fechamento",
    titulo: "Fechando com quem tem medo de errar",
    canal: "telefone",
    contexto: "A conta fechou: a carregadeira economiza 2 diaristas e acelera o terreiro. A parcela cabe na safra.",
    falaDoCliente: "Gostei. Vou conversar com minha esposa e te falo.",
    pergunta: "Qual o próximo passo?",
    opcoes: [
      {
        id: "a",
        texto: "“Claro, fico no aguardo.”",
        qualidade: "ruim",
        feedback: "Conversa de segunda mão perde os números. E sem data combinada, a decisão escorrega.",
        desfecho: { tipo: "travou", texto: "Duas semanas sem resposta. Quando você ligou, ele disse que “por enquanto não”." },
      },
      {
        id: "b",
        texto: "“Perfeito, essa decisão é dos dois mesmo. Posso participar dessa conversa? Em 20 minutos mostro a mesma conta para ela. Sexta à tarde serve para vocês?”",
        qualidade: "boa",
        feedback: "Respeitou a decisão conjunta, se ofereceu para levar a informação completa e marcou data. É o tratamento certo do decisor oculto.",
        desfecho: { tipo: "ganhou", texto: "A conversa a três aconteceu na sexta. A esposa fez as contas do terreiro e eles fecharam no sábado." },
      },
    ],
  },
];

export const CENARIOS_POR_ID = new Map(CENARIOS.map((c) => [c.id, c]));

// Cenários que começam uma trilha (não são destino de nenhuma escolha).
export function cenariosIniciais(): CenarioSimulador[] {
  const destinos = new Set(CENARIOS.flatMap((c) => c.opcoes.map((o) => o.proximo).filter(Boolean) as string[]));
  return CENARIOS.filter((c) => !destinos.has(c.id));
}

export function cenariosDaEtapa(etapaId: string): CenarioSimulador[] {
  return CENARIOS.filter((c) => c.etapa === etapaId);
}

export type EscolhaFeita = { cenarioId: string; opcaoId: string };

export function pontuacao(escolhas: EscolhaFeita[]): { pontos: number; maximo: number; percentual: number } {
  let pontos = 0;
  let maximo = 0;
  for (const e of escolhas) {
    const cenario = CENARIOS_POR_ID.get(e.cenarioId);
    if (!cenario) continue;
    const opcao = cenario.opcoes.find((o) => o.id === e.opcaoId);
    if (!opcao) continue;
    pontos += PONTOS[opcao.qualidade];
    maximo += PONTOS.boa;
  }
  return { pontos, maximo, percentual: maximo ? Math.round((pontos / maximo) * 100) : 0 };
}

// Avaliação final da rodada, no tom de gerente.
export function veredito(percentual: number, desfecho?: CenarioSimulador["desfecho"]): string {
  if (desfecho?.tipo === "ganhou" && percentual >= 80) return "Venda fechada e condução de gente que sabe o que faz. É esse o padrão.";
  if (desfecho?.tipo === "ganhou") return "Fechou, mas passou perto de escorregar em alguma escolha. Releia os comentários vermelhos.";
  if (desfecho?.tipo === "perdeu") return "Perdeu a venda. Volte às escolhas marcadas em vermelho: em todas havia uma saída.";
  if (desfecho?.tipo === "travou") return "A venda não morreu, mas travou — e negociação travada é venda perdida devagar.";
  if (percentual >= 80) return "Condução firme. Siga assim.";
  if (percentual >= 50) return "Está no caminho, mas ainda deu preço ou avançou sem qualificar em algum momento.";
  return "Recomece pela etapa de Qualificação: a maior parte dos erros veio de falar antes de perguntar.";
}
