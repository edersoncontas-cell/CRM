// AS ETAPAS DA VENDA DE MÁQUINA PESADA, uma por uma, com profundidade de
// manual de campo: o que fazer, o que identificar, o que perguntar, o que
// falar (palavra por palavra, por canal) e o que responder.
//
// Escrito para a realidade do vendedor: New Holland Construction e Dynapac no
// sul do Espírito Santo, clientes que são construtora, empreiteiro, pedreira,
// cafeicultor, prefeitura, locadora e transportador.
//
// Módulo PURO (só dados) — a tela lê, a IA do simulador usa como base e as
// regras do negócio (lib/contexto-negocio.ts) sobrescrevem o que for preciso.

export type Canal = "mensagem" | "telefone" | "presencial" | "recebido";

export const ROTULO_CANAL: Record<Canal, string> = {
  mensagem: "Mensagem (WhatsApp)",
  telefone: "Telefone",
  presencial: "Cara a cara (obra, loja, feira)",
  recebido: "Ele que procurou você",
};

export type FalaExemplo = {
  canal: Canal;
  situacao: string;
  fala: string;
  porque: string;
};

export type SinalLeitura = { sinal: string; significa: string; acao: string };
export type PerguntaEtapa = { pergunta: string; porque: string };
export type RespostaEtapa = { situacao: string; resposta: string; armadilha: string };

export type EtapaVenda = {
  id: string;
  nome: string;
  objetivo: string;
  tempoTipico: string;
  resumo: string;
  oQueFazer: string[];
  oQueIdentificar: SinalLeitura[];
  perguntas: PerguntaEtapa[];
  falas: FalaExemplo[];
  respostas: RespostaEtapa[];
  erros: string[];
  criteriosDeAvanco: string[];
  indicadores: string[];
};

export const ETAPAS: EtapaVenda[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "prospeccao",
    nome: "Prospecção",
    objetivo: "Encher a agenda de conversas com quem tem obra, serviço ou dinheiro para máquina — e não com quem só tem curiosidade.",
    tempoTipico: "Todo dia, 1 hora fixa no começo da manhã",
    resumo:
      "Prospecção não é mandar mensagem para todo mundo: é escolher quem vale a pena e chegar com um motivo que interessa àquela pessoa. No sul do ES, obra pública, café, pedreira e loteamento têm calendários diferentes — quem prospecta lendo o calendário do cliente entra na hora certa.",
    oQueFazer: [
      "Separe uma hora fixa por dia só para prospectar. Fora dessa hora, o dia engole.",
      "Monte a lista de onde vem obra: Diário Oficial dos municípios (licitação de pavimentação, drenagem, estrada rural), placas de obra que você vê na estrada, loteamento novo, pedreira em expansão, cooperativa de café, transportadora que está pegando frete de terra.",
      "Para cada nome, descubra UMA informação concreta antes de falar: a obra que ele ganhou, a máquina velha que ele tem, o serviço que ele está tocando.",
      "Chegue pelo motivo dele, não pelo seu: não é 'temos máquina em promoção', é 'vi que vocês ganharam a pavimentação de X'.",
      "Registre tudo no CRM na hora. Prospecção que não vira cadastro morre no bolso.",
      "Volte a quem já comprou: cliente com máquina de 5 anos ou mais é a prospecção mais barata que existe.",
    ],
    oQueIdentificar: [
      { sinal: "Placa de obra nova ou terraplenagem começando na estrada", significa: "Alguém contratou serviço e precisa de máquina agora", acao: "Pare, anote o nome da empresa na placa e procure o responsável no mesmo dia" },
      { sinal: "Licitação de pavimentação/drenagem publicada no município", significa: "A empreiteira vencedora vai precisar de rolo, escavadeira ou retro em semanas", acao: "Descubra quem venceu e chegue antes do concorrente" },
      { sinal: "Cliente antigo com máquina passando de 8.000 horas", significa: "Manutenção começa a comer o lucro dele — janela de troca", acao: "Leve a conta de custo por hora da máquina velha × nova" },
      { sinal: "Locadora com frota alugada 100% do tempo", significa: "Ela está perdendo contrato por falta de máquina", acao: "Ofereça disponibilidade e prazo de entrega, que é o que ela compra" },
      { sinal: "Produtor de café em ano de safra boa", significa: "Dinheiro no caixa entre junho e setembro", acao: "Fale de terreiro, estrada interna e carregamento, não de 'máquina'" },
    ],
    perguntas: [
      { pergunta: "Vocês estão tocando qual serviço agora?", porque: "Abre a conversa pelo que ele faz, não pelo que você vende" },
      { pergunta: "Hoje vocês fazem isso com máquina própria ou alugada?", porque: "Separa quem compra de quem aluga — e revela o custo que ele já paga" },
      { pergunta: "Qual máquina vocês têm hoje e com quantas horas?", porque: "Diz a idade da frota, que é o gatilho de troca" },
      { pergunta: "Tem alguma obra fechada para começar nos próximos meses?", porque: "Prazo é o que transforma interesse em compra" },
    ],
    falas: [
      {
        canal: "mensagem",
        situacao: "Primeiro contato com empreiteiro que ganhou licitação",
        fala: "Bom dia, [nome]. Aqui é o [vendedor], da [empresa], trabalho com New Holland e Dynapac aqui no sul do ES. Vi que vocês pegaram a pavimentação em [cidade]. Já está definido o equipamento de compactação para esse serviço?",
        porque: "Curto, diz quem é, mostra que fez a lição de casa e termina com uma pergunta fechada que ele responde em 5 segundos.",
      },
      {
        canal: "presencial",
        situacao: "Você passou na frente de uma obra e parou",
        fala: "Bom dia! Sou o [vendedor], trabalho com máquina New Holland e Dynapac aqui na região. Passei e vi o serviço de vocês. Quem toca a parte de equipamento aqui?",
        porque: "Não vende nada na primeira frase: pede a pessoa certa. Falar com quem não decide queima a visita.",
      },
      {
        canal: "telefone",
        situacao: "Cliente antigo, para reativar",
        fala: "[nome], tudo bom? É o [vendedor]. Estou passando pela região essa semana e lembrei da sua [máquina]. Ela já deve estar com bastante hora, né? Queria te mostrar uma conta rápida de quanto ela está custando por hora hoje comparada com uma nova.",
        porque: "Motivo concreto (a máquina dele), oferta de valor (a conta) e gancho de visita.",
      },
      {
        canal: "recebido",
        situacao: "Ele chamou no WhatsApp perguntando sobre máquina",
        fala: "Bom dia, [nome]! Obrigado por chamar. Para eu te passar a máquina certa e o valor certo: o serviço é o quê, e onde fica?",
        porque: "Agradece, não despeja preço e já começa a qualificar na primeira resposta.",
      },
    ],
    respostas: [
      {
        situacao: "“Não preciso de máquina agora.”",
        resposta: "Tranquilo, [nome]. Só me diz uma coisa: quando precisar, é para comprar ou vocês costumam alugar? Pergunto para eu te avisar na hora certa e não te encher fora de hora.",
        armadilha: "Aceitar o não e sumir. A resposta certa transforma o não em data.",
      },
      {
        situacao: "“Já tenho fornecedor.”",
        resposta: "Isso é bom, sinal de que te atendem bem. Não quero tomar o lugar de ninguém hoje — quero ser a sua segunda opção. Se um dia faltar máquina ou o prazo apertar, você me chama e eu resolvo. Posso te mandar meu contato?",
        armadilha: "Falar mal do concorrente. Você perde a conversa na hora.",
      },
      {
        situacao: "“Manda o catálogo por WhatsApp.”",
        resposta: "Mando sim. Só para eu mandar a parte que interessa e não um monte de PDF: é para terraplenagem, estrada ou pavimentação?",
        armadilha: "Mandar o catálogo inteiro. Vira arquivo não lido e a conversa morre.",
      },
    ],
    erros: [
      "Mandar a mesma mensagem para 50 pessoas: quem recebe percebe e não responde.",
      "Começar por preço ou promoção antes de saber o serviço.",
      "Prospectar só quando o funil está vazio — aí já é tarde, a venda leva semanas.",
      "Não registrar o contato no CRM: em duas semanas você não lembra com quem falou.",
    ],
    criteriosDeAvanco: [
      "Você sabe o serviço que ele faz e onde fica.",
      "Você sabe se hoje ele usa máquina própria ou alugada.",
      "Ele respondeu alguma coisa (mesmo que 'agora não') — existe conversa.",
    ],
    indicadores: ["Contatos novos por semana", "Taxa de resposta", "Conversas que viraram visita"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "qualificacao",
    nome: "Qualificação",
    objetivo: "Saber, antes de falar preço, o que ele precisa, quando precisa, com que dinheiro e quem decide.",
    tempoTipico: "Uma conversa de 10 a 15 minutos, ou 4 a 6 mensagens",
    resumo:
      "Qualificar é a etapa que separa vendedor de tirador de pedido. Sem as quatro respostas (aplicação, prazo, dinheiro, decisor), qualquer preço que você passar vira tabela na mão do concorrente. Quem qualifica direito fecha mais rápido e com menos desconto.",
    oQueFazer: [
      "Faça UMA pergunta por vez. Interrogatório em bloco mata a conversa no WhatsApp.",
      "Pergunte o serviço e o material: terra, brita, rocha, asfalto, café, areia. Material muda a máquina.",
      "Pergunte o prazo real: 'a obra começa quando?'. Prazo é o que faz o cliente decidir.",
      "Pergunte a forma de pagamento sem rodeio, como parte natural do atendimento.",
      "Descubra quem decide junto: sócio, esposa, filho, engenheiro, contador.",
      "Anote tudo no cadastro do cliente. O que você descobriu no telefone precisa estar no CRM (use 'o que só você sabe' no Orientador).",
    ],
    oQueIdentificar: [
      { sinal: "Ele responde com detalhe técnico do serviço", significa: "Sabe o que quer, provavelmente já pesquisou", acao: "Suba o nível da conversa: produtividade, consumo, custo por hora" },
      { sinal: "Só fala em preço e não responde sobre a aplicação", significa: "Risco alto de estar cotando para comparar com outro", acao: "Não passe preço ainda; ofereça visita ou conta comparativa" },
      { sinal: "Cita prazo de obra com data", significa: "Necessidade real, urgência verdadeira", acao: "Prioridade máxima: puxe a visita para esta semana" },
      { sinal: "Diz 'vou ver com meu sócio/pai/engenheiro'", significa: "Você não está falando com o decisor", acao: "Peça para incluir a pessoa na próxima conversa — sem isso a venda trava" },
      { sinal: "Pergunta de financiamento antes de máquina", significa: "Dinheiro é a trava dele, não o equipamento", acao: "Leve o financiamento para o centro da conversa e traga simulação" },
    ],
    perguntas: [
      { pergunta: "Qual serviço a máquina vai fazer e em que material?", porque: "Define modelo, peso e implemento. Sem isso qualquer preço é chute" },
      { pergunta: "A obra/serviço começa quando?", porque: "Separa 'quero' de 'preciso' e define a urgência" },
      { pergunta: "Vocês trabalham quantas horas por dia com ela?", porque: "Define porte da máquina e argumento de custo por hora" },
      { pergunta: "Está pensando à vista, financiamento ou consórcio?", porque: "Muda a conversa inteira e o que você prepara" },
      { pergunta: "Além de você, mais alguém participa da decisão?", porque: "Evita descobrir o decisor escondido só no fim" },
      { pergunta: "Tem máquina hoje? Qual e com quantas horas?", porque: "Abre troca, comparação e argumento de manutenção" },
    ],
    falas: [
      {
        canal: "mensagem",
        situacao: "Ele pediu preço logo de cara",
        fala: "Consigo te passar sim. Só que o valor muda bastante conforme a configuração, e eu não quero te passar um número que não é o da sua máquina. Me diz duas coisas: o serviço é o quê, e para começar quando?",
        porque: "Não nega o preço, explica o porquê e devolve com duas perguntas objetivas.",
      },
      {
        canal: "telefone",
        situacao: "Descobrindo o decisor sem ofender",
        fala: "[nome], quando a gente chegar na parte de fechar, quem mais senta na mesa com você? Pergunto para já levar a informação do jeito que essa pessoa gosta de ver.",
        porque: "Trata o decisor como algo natural do processo, sem sugerir que ele não manda.",
      },
      {
        canal: "presencial",
        situacao: "Na obra, qualificando pela operação",
        fala: "Me mostra onde ela vai trabalhar? Queria ver o material e o acesso — é isso que define se a máquina certa é a [modelo A] ou a [modelo B].",
        porque: "Transforma a visita em diagnóstico técnico e você passa a ser consultor, não vendedor.",
      },
    ],
    respostas: [
      {
        situacao: "“Por que você quer saber tudo isso? Só me passa o preço.”",
        resposta: "Porque tem três configurações dessa máquina e a diferença entre elas dá uma boa diferença de valor. Se eu te passar o preço errado, ou você paga por algo que não precisa, ou compra o que não aguenta o serviço. Dois minutos de conversa e eu te mando o valor certo.",
        armadilha: "Ceder e mandar preço para não parecer chato. Depois disso você perde o controle da venda.",
      },
      {
        situacao: "“É para uso geral mesmo.”",
        resposta: "Entendi. Me dá um exemplo do serviço mais pesado que ela vai fazer no mês? É por esse que a gente dimensiona — se ela aguenta o pior dia, aguenta o resto.",
        armadilha: "Aceitar 'uso geral' e dimensionar errado. Máquina pequena demais vira reclamação e cliente perdido.",
      },
    ],
    erros: [
      "Passar preço antes das quatro respostas.",
      "Perguntar tudo de uma vez, em bloco, no WhatsApp.",
      "Não anotar o que descobriu — e perguntar de novo na semana seguinte.",
      "Deixar 'quem decide' para o fim e descobrir o sócio na hora da assinatura.",
    ],
    criteriosDeAvanco: [
      "Você sabe a aplicação e o material.",
      "Você sabe o prazo.",
      "Você sabe a forma de pagamento pretendida.",
      "Você sabe quem decide.",
    ],
    indicadores: ["% de conversas qualificadas antes do preço", "Tempo até a visita"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "visita",
    nome: "Visita e demonstração",
    objetivo: "Sair da tela e ir ao terreno: ver a operação, provar valor com números e sair com o próximo passo marcado.",
    tempoTipico: "1 a 2 horas na obra ou propriedade",
    resumo:
      "A visita é o pivô da venda de máquina. É lá que você vê o material, mede o acesso, conhece quem opera e transforma preço em custo por hora. Venda de máquina pesada que nunca sai do WhatsApp quase sempre vira comparação de tabela.",
    oQueFazer: [
      "Confirme a visita na véspera, por mensagem, com dia e hora.",
      "Chegue com a conta pronta: consumo, custo por hora, disponibilidade, valor de revenda.",
      "Peça para ver o serviço acontecendo. Olhe o material, o acesso, a rampa, a distância de transporte.",
      "Converse com quem opera. O operador derruba ou sustenta a venda depois.",
      "Fotografe (com autorização) e registre a visita no CRM no mesmo dia.",
      "Nunca saia sem o próximo passo marcado com data: proposta, simulação, nova visita com o sócio.",
    ],
    oQueIdentificar: [
      { sinal: "Ele chama o operador para participar", significa: "Está levando a sério e quer validação técnica", acao: "Dê atenção ao operador: pergunte o que incomoda na máquina atual" },
      { sinal: "Pergunta de assistência e peça", significa: "Já se queimou com marca sem suporte", acao: "Mostre a rede, o prazo de atendimento e onde fica a peça" },
      { sinal: "Fala da máquina atual com raiva", significa: "Dor real e urgência", acao: "Deixe ele falar. A dor dele é o seu argumento" },
      { sinal: "Evita mostrar a obra", significa: "Pode não ter obra, ou ser só cotação", acao: "Requalifique com cuidado antes de gastar proposta" },
    ],
    perguntas: [
      { pergunta: "O que mais te atrapalha na máquina que vocês usam hoje?", porque: "Abre a dor concreta que a sua máquina resolve" },
      { pergunta: "Quantas horas por dia ela roda e quanto de diesel faz?", porque: "Base da conta de custo por hora, que é onde você ganha" },
      { pergunta: "Quando ela para, quanto tempo demora para voltar?", porque: "Disponibilidade e assistência valem mais que desconto" },
      { pergunta: "Se a gente resolver isso, tem mais alguma coisa que te impede de decidir?", porque: "Descobre a objeção escondida ainda na visita" },
    ],
    falas: [
      {
        canal: "presencial",
        situacao: "Abrindo a visita",
        fala: "[nome], obrigado pelo tempo. Vim ver o serviço de vocês para eu te indicar a máquina certa — se por acaso a melhor resposta for você continuar com a que tem, eu te falo isso também.",
        porque: "Baixa a guarda: você não veio empurrar máquina, veio diagnosticar. Ganha confiança imediata.",
      },
      {
        canal: "presencial",
        situacao: "Passando de preço para custo por hora",
        fala: "Deixa eu te mostrar uma conta rápida: com [X] litros por hora e [Y] horas por mês, a máquina de hoje te custa [valor] por hora só de combustível e manutenção. A nova faz [Z] litros e fica em [valor]. Na sua produção, a diferença paga a parcela.",
        porque: "Troca a discussão de preço por uma conta que ele confere. É o argumento mais forte na linha amarela.",
      },
      {
        canal: "mensagem",
        situacao: "Confirmando na véspera",
        fala: "[nome], confirmando a nossa visita amanhã às [hora] na obra de [local]. Vou levar a conta de custo por hora e a ficha da [modelo]. Precisa que eu leve mais alguma coisa?",
        porque: "Confirma, mostra preparo e ainda abre espaço para ele pedir algo (mais informação sobre a venda).",
      },
    ],
    respostas: [
      {
        situacao: "“Deixa eu ver com meu sócio e te falo.”",
        resposta: "Perfeito. Você prefere que eu fale com ele junto com você? Em 20 minutos eu mostro a mesma conta que te mostrei — assim ele decide com a informação completa e não por resumo.",
        armadilha: "Aceitar e esperar. A conversa de segunda mão sempre perde detalhe e a venda esfria.",
      },
      {
        situacao: "“Me manda a proposta que eu analiso.”",
        resposta: "Mando hoje ainda. Só para a proposta sair do jeito certo: prefere ver a condição à vista, financiada em quantos anos, ou as duas para comparar?",
        armadilha: "Mandar proposta genérica. Proposta sem condição definida é comparada só pelo número de baixo.",
      },
    ],
    erros: [
      "Ir à visita sem os números na mão.",
      "Falar mais do que ouvir nos primeiros 15 minutos.",
      "Ignorar o operador.",
      "Sair sem data marcada para o próximo passo.",
    ],
    criteriosDeAvanco: [
      "Você viu a operação e sabe o material e o acesso.",
      "Você mostrou a conta de custo por hora com números dele.",
      "Existe uma data combinada para a proposta ou para a próxima conversa.",
    ],
    indicadores: ["Visitas por semana", "Visitas que viraram proposta", "Tempo entre visita e proposta"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "proposta",
    nome: "Proposta e financiamento",
    objetivo: "Entregar uma proposta que o cliente entende, com a condição de pagamento desenhada e uma data para decidir.",
    tempoTipico: "24 a 48 horas depois da visita",
    resumo:
      "Proposta não é tabela de preço: é a solução inteira escrita — máquina configurada, condição de pagamento, prazo de entrega, garantia, assistência. Proposta boa antecipa a pergunta do cliente e a objeção do concorrente.",
    oQueFazer: [
      "Mande em até 48 horas depois da visita. Depois disso a emoção da visita já passou.",
      "Escreva a configuração exata com o motivo de cada item ('esteira larga por causa do terreno mole').",
      "Traga a condição de pagamento pronta: entrada, prazo, banco, parcela estimada.",
      "Coloque a entrega com data, não com 'a combinar'.",
      "Explique pessoalmente (telefone ou visita) antes de mandar o PDF, ou junto. Proposta que chega sozinha é lida só pelo valor final.",
      "Combine a data do retorno na hora de entregar: 'te ligo quinta de manhã, pode ser?'.",
    ],
    oQueIdentificar: [
      { sinal: "Pergunta detalhe da parcela e do prazo", significa: "Está projetando o pagamento na operação dele: sinal forte", acao: "Traga simulações em dois prazos e mostre o efeito no caixa" },
      { sinal: "Some depois de receber a proposta", significa: "Ou está comparando, ou travou em algo que não disse", acao: "Ligue (não mande mensagem) e pergunte o que ficou faltando" },
      { sinal: "Pede desconto antes de discutir condição", significa: "Está tratando como commodity", acao: "Volte ao valor: custo por hora, disponibilidade, revenda, assistência" },
      { sinal: "Encaminha a proposta para o contador", significa: "Vai analisar tributação e caixa — bom sinal de seriedade", acao: "Ofereça falar direto com o contador e leve os dados que ele precisa" },
    ],
    perguntas: [
      { pergunta: "Prefere ver em 48 ou 60 meses?", porque: "Pergunta fechada que avança e revela o apetite de parcela" },
      { pergunta: "A entrada sai do caixa ou de uma venda que você vai fazer?", porque: "Antecipa o problema real de fluxo e o prazo de fechamento" },
      { pergunta: "Você prefere que eu explique a proposta com você ou já mando e converso depois?", porque: "Educadamente garante a explicação em vez do PDF solto" },
    ],
    falas: [
      {
        canal: "telefone",
        situacao: "Entregando a proposta",
        fala: "[nome], preparei a proposta com a configuração que a gente viu na obra. São três pontos: a máquina com [item chave], a condição em [prazo] com entrada de [valor], e a entrega para [data]. Te mando agora e te ligo quinta de manhã para a gente definir. Pode ser?",
        porque: "Resume em três pontos, marca a data do retorno e termina com pergunta fechada.",
      },
      {
        canal: "mensagem",
        situacao: "Enviando o PDF depois de explicar",
        fala: "Segue a proposta conforme conversamos, [nome]. Qualquer dúvida na parcela ou na entrega me chama que eu resolvo na hora. Ficou combinado nosso retorno na quinta, às 9h.",
        porque: "Reforça o combinado por escrito, o que segura o compromisso.",
      },
    ],
    respostas: [
      {
        situacao: "“Está caro.”",
        resposta: "Caro comparado com o quê, [nome]? Se for com outra marca, me diz qual configuração eles passaram que eu comparo item a item. Se for com o que cabe no seu mês, a gente mexe no prazo e na entrada, não na máquina.",
        armadilha: "Dar desconto na hora. Desconto sem contrapartida ensina o cliente a pedir mais.",
      },
      {
        situacao: "“O concorrente está R$ 30 mil mais barato.”",
        resposta: "Pode estar mesmo. Só que a conta que interessa é a do fim do ano: se a máquina dele parar três dias a mais que a nossa, você já perdeu esses R$ 30 mil em serviço parado. Me deixa te mostrar disponibilidade, prazo de peça e o que a máquina vale na revenda daqui a 4 anos.",
        armadilha: "Atacar o concorrente. Compare fatos e devolva para a conta do cliente.",
      },
      {
        situacao: "“Vou pensar.”",
        resposta: "Claro. Só para eu te ajudar a pensar no ponto certo: o que está pesando mais — o valor da parcela, o prazo de entrega ou a decisão do sócio?",
        armadilha: "Aceitar o 'vou pensar' sem descobrir o que trava. É o buraco onde as vendas somem.",
      },
    ],
    erros: [
      "Mandar proposta sem data de retorno combinada.",
      "Mandar o PDF sem explicar.",
      "Deixar 'entrega a combinar'.",
      "Baixar preço antes de entender a objeção real.",
    ],
    criteriosDeAvanco: [
      "A proposta foi explicada, não só enviada.",
      "Existe data marcada para o retorno.",
      "A condição de pagamento está desenhada, não genérica.",
    ],
    indicadores: ["Propostas por semana", "% de propostas explicadas ao vivo", "Taxa de conversão proposta → venda"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "objecoes",
    nome: "Objeções",
    objetivo: "Tratar o que trava a decisão sem brigar, sem inventar e sem dar desconto automático.",
    tempoTipico: "Aparecem em qualquer etapa — a maioria depois da proposta",
    resumo:
      "Objeção é sinal de interesse: quem não quer, não objeta, apenas some. O método é sempre o mesmo: ouvir inteiro, confirmar que entendeu, isolar (é só isso?), responder com fato e devolver com pergunta.",
    oQueFazer: [
      "Deixe o cliente terminar. Não interrompa nem comece com 'mas'.",
      "Repita a objeção com as palavras dele para confirmar que entendeu.",
      "Isole: 'fora isso, tem mais alguma coisa que te impede de decidir?'.",
      "Responda com fato verificável: conta, prazo, garantia, referência de outro cliente da região.",
      "Devolva com pergunta fechada que avança.",
      "Se o motivo for real e você não tem solução, diga a verdade. Cliente perdoa 'não temos', não perdoa mentira.",
    ],
    oQueIdentificar: [
      { sinal: "Objeção genérica ('está caro', 'vou pensar')", significa: "Quase sempre esconde a objeção verdadeira", acao: "Pergunte o que está pesando mais; ofereça três opções para ele escolher" },
      { sinal: "Objeção técnica específica", significa: "Ele estudou e está comparando de verdade", acao: "Responda com ficha técnica e, se não souber, diga que confirma e dê prazo" },
      { sinal: "Objeção que muda toda hora", significa: "O problema é outro: dinheiro, confiança ou decisor", acao: "Pergunte direto: 'o que precisaria acontecer para você fechar?'" },
      { sinal: "Silêncio depois da proposta", significa: "Objeção não dita", acao: "Ligue. Mensagem não resolve silêncio" },
    ],
    perguntas: [
      { pergunta: "Fora isso, tem mais alguma coisa que te impede de decidir hoje?", porque: "Isola a objeção e evita a fila infinita de desculpas" },
      { pergunta: "O que precisaria acontecer para você fechar essa semana?", porque: "Faz o cliente dizer o caminho do próprio sim" },
      { pergunta: "Se eu resolver isso, a gente fecha?", porque: "Testa se a objeção é real ou cortina" },
    ],
    falas: [
      {
        canal: "telefone",
        situacao: "Cliente diz que vai comparar com outra marca",
        fala: "Faz sentido comparar. Só te peço uma coisa: compare com a configuração igual e olhe três números além do preço — consumo por hora, tempo de parada quando quebra, e quanto vale na revenda em 4 anos. Se depois disso a outra ganhar, eu sou o primeiro a te falar.",
        porque: "Aceita a comparação, define os critérios (que favorecem você) e transmite segurança.",
      },
      {
        canal: "mensagem",
        situacao: "Cliente sumiu depois da proposta",
        fala: "[nome], tudo certo? Não quero te encher. Só me diz em uma palavra onde travou: valor, prazo ou decisão? Assim eu te ajudo no ponto certo ou te deixo em paz até a hora certa.",
        porque: "Respeitoso, fácil de responder e dá saída honrosa — costuma destravar o silêncio.",
      },
    ],
    respostas: [
      {
        situacao: "“Não tenho dinheiro para a entrada agora.”",
        resposta: "Entendi. Tem duas saídas: prazo maior com entrada menor, ou a gente puxa a entrega para depois da sua entrada entrar. Qual das duas encaixa melhor no seu caixa?",
        armadilha: "Assumir que é desinteresse. Falta de entrada é problema de calendário, não de vontade.",
      },
      {
        situacao: "“Meu contador falou para esperar o ano que vem.”",
        resposta: "Vamos falar com ele juntos? Levo os números de depreciação e de financiamento. Se o ano que vem for melhor de verdade, a gente programa; mas o preço de máquina raramente cai, e o serviço que você perde este ano não volta.",
        armadilha: "Discutir com o contador pelas costas. Chame para a mesma mesa.",
      },
      {
        situacao: "“Prefiro alugar.”",
        resposta: "Aluguel resolve pico, faz sentido. Me deixa fazer uma conta com você: quantos meses por ano você aluga? Com [X] meses, a parcela da própria fica abaixo do aluguel e no fim você tem a máquina no pátio. Quer ver essa conta com seus números?",
        armadilha: "Dizer que alugar é errado. Mostre a conta, o cliente decide.",
      },
    ],
    erros: [
      "Rebater na hora, antes de o cliente terminar.",
      "Inventar número para ganhar a discussão.",
      "Dar desconto como primeira resposta.",
      "Deixar objeção sem isolamento: uma cai, aparece outra.",
    ],
    criteriosDeAvanco: [
      "A objeção verdadeira está na mesa.",
      "Você respondeu com fato, não com opinião.",
      "O cliente disse o que precisa acontecer para fechar.",
    ],
    indicadores: ["Objeções por negociação", "% de objeções tratadas com fato", "Negociações que voltam do silêncio"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "fechamento",
    nome: "Fechamento",
    objetivo: "Pedir o pedido na hora certa, com pergunta direta, e sair com data de entrega.",
    tempoTipico: "Quando os sinais somam — não antes, não depois",
    resumo:
      "Fechar é pedir. A maior parte das vendas perdidas de máquina não é perdida para o concorrente: é perdida por ninguém ter pedido o pedido. Quando prazo, dinheiro e decisor estão resolvidos e as objeções foram tratadas, a próxima frase é uma pergunta de fechamento.",
    oQueFazer: [
      "Some os sinais antes: prazo definido, forma de pagamento aprovada, decisor presente, objeções tratadas.",
      "Faça a pergunta direta, curta, e cale a boca. Quem fala primeiro depois da pergunta de fechamento perde.",
      "Ofereça duas alternativas de avanço em vez de sim/não ('entrega dia 10 ou dia 20?').",
      "Deixe o próximo passo prático pronto: documentos, ficha do banco, dados para a nota.",
      "Se o sim vier, confirme por escrito no mesmo dia.",
      "Se vier não, pergunte o motivo e registre no CRM — é o que te ensina para a próxima.",
    ],
    oQueIdentificar: [
      { sinal: "Pergunta sobre entrega, cor, treinamento do operador", significa: "Já se vê com a máquina: sinal clássico de compra", acao: "Feche agora, com pergunta de data" },
      { sinal: "Chama outra pessoa para a conversa", significa: "Está validando a decisão", acao: "Repita os pontos principais para o recém-chegado e feche" },
      { sinal: "Pede condição especial 'se for hoje'", significa: "Está pronto e testando o limite", acao: "Troque desconto por contrapartida: prazo de entrega, entrada maior, assinatura hoje" },
      { sinal: "Volta a perguntar coisa já respondida", significa: "Insegurança, não desinteresse", acao: "Reforce garantia, assistência e referência de cliente da região" },
    ],
    perguntas: [
      { pergunta: "Fechamos para entrega em [data]?", porque: "Pergunta direta com data: a mais eficiente na linha amarela" },
      { pergunta: "Prefere a entrega dia 10 ou dia 20?", porque: "Alternativa dupla: qualquer resposta é um sim" },
      { pergunta: "Posso mandar a ficha do banco para você já adiantar?", porque: "Fechamento por próximo passo, sem pressão frontal" },
    ],
    falas: [
      {
        canal: "presencial",
        situacao: "Fechamento direto depois de tratar as objeções",
        fala: "[nome], então a máquina é essa, a condição é essa e a entrega fica para [data]. Fechamos?",
        porque: "Recapitula os três pontos e pede. Frase curta, sem enfeite.",
      },
      {
        canal: "telefone",
        situacao: "Fechamento por próximo passo",
        fala: "Para eu segurar a máquina no [prazo], preciso mandar a ficha para o banco hoje. Te mando agora por WhatsApp e você me devolve até amanhã?",
        porque: "Cria urgência verdadeira (disponibilidade) e pede uma ação pequena, fácil de aceitar.",
      },
    ],
    respostas: [
      {
        situacao: "“Me dá um desconto e eu fecho agora.”",
        resposta: "Consigo melhorar, mas não de graça: se a gente antecipar a entrada para esta semana (ou fechar a entrega para [data]), eu levo o pedido com essa condição. Fecha assim?",
        armadilha: "Dar o desconto sem contrapartida. O cliente aprende a pedir de novo na próxima.",
      },
      {
        situacao: "“Só falta o banco aprovar.”",
        resposta: "Então vamos deixar tudo pronto: eu mando a lista de documentos hoje, você me manda até amanhã e eu acompanho a análise. Assim que sair, a máquina já sai de lá programada. Combinado?",
        armadilha: "Esperar o banco parado. Enquanto o processo não anda, o concorrente conversa com ele.",
      },
    ],
    erros: [
      "Não pedir o pedido.",
      "Pedir cedo demais, antes de tratar a objeção.",
      "Falar depois da pergunta de fechamento.",
      "Fechar sem confirmar por escrito.",
    ],
    criteriosDeAvanco: [
      "Tem pedido assinado ou data firme de assinatura.",
      "Documentação e financiamento encaminhados.",
      "Data de entrega combinada.",
    ],
    indicadores: ["Taxa de fechamento", "Ciclo médio da venda", "Desconto médio concedido"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "posvenda",
    nome: "Pós-venda e indicação",
    objetivo: "Garantir que a máquina produza, transformar o cliente em referência e abrir a próxima venda.",
    tempoTipico: "Entrega, 30 dias, 6 meses, 1 ano — para sempre",
    resumo:
      "Na venda de máquina, o pós-venda é a próxima venda. Cliente bem acompanhado compra de novo, indica e defende você quando o concorrente chega. Cliente abandonado depois da nota fiscal vira reclamação e história ruim na região.",
    oQueFazer: [
      "Esteja na entrega. É o momento de maior emoção da compra.",
      "Ligue em 7 dias: 'está produzindo como a gente combinou?'.",
      "Volte aos 30 dias com a primeira revisão e confira as horas.",
      "Aos 6 meses, leve a conta real de custo por hora e compare com a promessa da venda.",
      "Peça indicação quando o cliente estiver satisfeito, não em qualquer momento.",
      "Registre tudo no CRM: a data da compra é o começo do relógio da próxima.",
    ],
    oQueIdentificar: [
      { sinal: "Operador elogia a máquina", significa: "A venda está consolidada", acao: "Peça indicação e autorização para usar como referência" },
      { sinal: "Cliente reclama de detalhe pequeno", significa: "Janela para provar assistência", acao: "Resolva rápido e avise que resolveu — vira fidelidade" },
      { sinal: "Máquina passando das horas de revisão", significa: "Risco de quebra e de insatisfação", acao: "Avise antes que estrague" },
      { sinal: "Ele começa a pegar serviço maior", significa: "Vai precisar de mais uma máquina", acao: "Entre cedo na segunda compra" },
    ],
    perguntas: [
      { pergunta: "A máquina está entregando o que a gente combinou?", porque: "Abre espaço para resolver antes de virar reclamação" },
      { pergunta: "O operador se adaptou bem? Precisa de treinamento?", porque: "Operador mal treinado culpa a máquina" },
      { pergunta: "Conhece alguém que está passando pelo que você passava antes da máquina?", porque: "Pedido de indicação natural, ancorado na dor que você resolveu" },
    ],
    falas: [
      {
        canal: "telefone",
        situacao: "Ligação dos 7 dias",
        fala: "[nome], como está a [máquina] na obra? Rodou direitinho essa semana? Qualquer coisa que apareça, me chama primeiro que eu resolvo.",
        porque: "Mostra que a relação não acabou na nota fiscal e se antecipa ao problema.",
      },
      {
        canal: "mensagem",
        situacao: "Pedido de indicação",
        fala: "[nome], que bom que ela está produzindo. Posso te pedir uma ajuda? Se você conhece alguém tocando serviço parecido, me apresenta? Prometo tratar a pessoa do mesmo jeito que te tratei.",
        porque: "Pedido direto, com compromisso de cuidado — o que tira o receio de indicar.",
      },
    ],
    respostas: [
      {
        situacao: "“Deu um problema na máquina.”",
        resposta: "Me conta o que aconteceu que eu já aciono a assistência agora. Vou acompanhar e te dou retorno hoje mesmo, mesmo que seja para dizer que ainda estou resolvendo.",
        armadilha: "Sumir ou empurrar só para a assistência. É aí que se perde o cliente para sempre.",
      },
    ],
    erros: [
      "Desaparecer depois da entrega.",
      "Só aparecer quando quer vender de novo.",
      "Não registrar a data da compra e perder a janela de troca.",
      "Pedir indicação antes de o cliente estar satisfeito.",
    ],
    criteriosDeAvanco: [
      "Cliente confirma que a máquina está produzindo.",
      "Revisões em dia e registradas.",
      "Pelo menos uma indicação pedida.",
    ],
    indicadores: ["% de clientes contatados em 7/30 dias", "Indicações por cliente", "Recompra em 4 anos"],
  },
];

export const ETAPAS_POR_ID = new Map(ETAPAS.map((e) => [e.id, e]));

// Total de itens de conteúdo — usado para mostrar o tamanho do guia.
export function tamanhoDoGuia(): { etapas: number; itens: number; falas: number; perguntas: number } {
  let itens = 0, falas = 0, perguntas = 0;
  for (const e of ETAPAS) {
    itens += e.oQueFazer.length + e.oQueIdentificar.length + e.respostas.length + e.erros.length + e.criteriosDeAvanco.length;
    falas += e.falas.length;
    perguntas += e.perguntas.length;
  }
  return { etapas: ETAPAS.length, itens, falas, perguntas };
}
