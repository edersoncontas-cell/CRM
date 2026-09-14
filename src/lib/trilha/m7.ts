import type { Modulo } from "./tipos";

export const M7: Modulo = {
  id: "m7", nivel: 7, titulo: "Contorno de objeções", tema: "Objeções", cor: "#ff5c7a",
  descricao: "Método para transformar cada objeção em avanço, banco completo de respostas para as objeções do seu mercado, prevenção, objeções em grupo e pelo WhatsApp.",
  objetivos: [
    "Aplicar o método acolher → isolar → reenquadrar → confirmar em qualquer objeção.",
    "Responder às 6 objeções mais duras do mercado de máquinas com scripts prontos.",
    "Dominar o segundo banco: “vou pensar”, “manda por WhatsApp”, “meu operador prefere X”, “ano eleitoral”, “taxa alta”, “vou comprar usada”.",
    "Prevenir objeções na apresentação com “vacinas”.",
    "Lidar com objeções em reunião com sócios e com o “advogado do diabo”.",
    "Responder objeções por texto sem parecer robô e reativar cliente que sumiu.",
  ],
  leituras: [
    "Jeb Blount — Objeções (Objections).",
    "Chris Voss — Negocie como se sua vida dependesse disso (rótulos e perguntas calibradas).",
    "Tom Hopkins — How to Master the Art of Selling (capítulos de objeções).",
  ],
  aulas: [
    {
      id: "m7a1", titulo: "O método: acolher, isolar, reenquadrar, confirmar", minutos: 10,
      resumo: "Objeção não é rejeição — é o cliente pedindo mais motivo para dizer sim. Um método de 4 passos para qualquer objeção.",
      blocos: [
        { tipo: "lista", titulo: "Os 4 passos", itens: [
          "Acolher: “Entendo, faz sentido pensar nisso.” — nunca rebata na hora; o cérebro do cliente precisa se sentir ouvido para ouvir você.",
          "Isolar: “Além do preço, tem mais alguma coisa que te impede de fechar?” — descobre se é a objeção real ou a desculpa.",
          "Reenquadrar: responda com fato, conta ou prova social, mudando o critério (preço → custo total; tempo → custo de esperar).",
          "Confirmar: “Isso resolve a sua dúvida? Então podemos seguir?” — feche o ciclo e avance para o fechamento.",
        ] },
        { tipo: "p", titulo: "Objeção real x cortina de fumaça", texto: "“Vou pensar” e “está caro” quase sempre escondem outra coisa: medo de errar, falta de crédito, sócio contra, preferência por outra marca. A pergunta de isolamento (“se o preço fosse igual ao do concorrente, fecharia hoje?”) revela a verdade. Só responda a objeção real." },
        { tipo: "tabela", titulo: "Tipos de objeção e o que fazer", colunas: ["Tipo", "Exemplo", "Tratamento"], linhas: [
          ["Condição real", "“O banco negou e não tenho entrada”", "Não é objeção, é condição. Resolva (consórcio, usada, outro banco) ou pause com data."],
          ["Objeção verdadeira", "“A parcela não cabe no meu caixa hoje”", "Reenquadre com a conta, prazo, carência, entrada da usada."],
          ["Cortina de fumaça", "“Vou pensar”, “manda por e-mail”", "Isole: “o que exatamente você precisa pensar?”. Ache a real."],
          ["Objeção de informação", "“A manutenção é cara”", "Fato + prova: plano de revisões, preço das peças de giro, cliente que mede."],
          ["Objeção de confiança", "“Vocês não atendem aqui”", "Prova local: mecânico na visita, prazo por escrito, telefone de cliente da cidade."],
        ] },
        { tipo: "script", titulo: "Exemplo completo — “está caro”", itens: [
          "Acolher: “Entendo. É um investimento alto mesmo, e você tem que ter certeza.”",
          "Isolar: “Se a gente resolver a questão do valor, tem mais alguma coisa que te segura? Ou é só isso?”",
          "Reenquadrar: “Então vamos olhar o custo por hora e não o preço: com o consumo e a disponibilidade dela, você paga a diferença em X meses. Aqui a conta com os seus números.”",
          "Confirmar: “Fazendo sentido essa conta, a gente fecha com a parcela que combinamos?”",
        ] },
        { tipo: "erros", titulo: "Erros no tratamento de objeções", itens: [
          "Rebater na hora (“mas a nossa é melhor!”). Ativa a defesa.",
          "Responder a primeira objeção sem isolar. Você resolve a desculpa e a real fica escondida.",
          "Dar desconto como resposta a “está caro”. Confirma que estava caro e ensina o cliente a repetir.",
          "Falar demais. Reenquadre em 3 frases e confirme.",
          "Levar para o pessoal. Objeção é sobre a decisão, não sobre você.",
        ] },
        { tipo: "exercicio", titulo: "Exercício", texto: "Pegue as 3 últimas objeções que você ouviu (o Orientador de Vendas registra nas negociações) e escreva os 4 passos para cada uma, com as suas palavras. Leia em voz alta até soar natural." },
      ],
      missao: "Nas próximas 5 objeções que ouvir, aplique conscientemente os 4 passos. Anote no CRM qual era a objeção real por trás da primeira.",
      quiz: [
        { pergunta: "O que faz o passo “isolar”?", opcoes: ["Rebate a objeção com argumento", "Descobre se é a objeção real ou se há outra por trás", "Muda de assunto"], correta: 1, explicacao: "Sem isolar, você responde a desculpa e a objeção real continua escondida." },
        { pergunta: "Por que acolher antes de responder?", opcoes: ["Para ganhar tempo", "Porque o cliente só ouve depois de se sentir ouvido", "Não precisa acolher"], correta: 1, explicacao: "Rebater na hora ativa defesa. Acolher abre o canal." },
        { pergunta: "“O banco negou e não tenho entrada” é:", opcoes: ["Cortina de fumaça", "Condição real — resolva ou pause com data", "Objeção de confiança"], correta: 1, explicacao: "Condição não se argumenta; se resolve." },
      ],
    },
    {
      id: "m7a2", titulo: "As objeções mais duras do seu mercado (banco 1)", minutos: 12,
      resumo: "Preço vs. chinesa, “vou alugar”, financiamento negado, “já tenho fornecedor”, “vou esperar a safra”, “manutenção cara”. Respostas prontas e adaptáveis.",
      blocos: [
        { tipo: "script", titulo: "“A chinesa é R$ 100 mil mais barata”", itens: [
          "“Entendo, e o preço de entrada é menor mesmo. Posso te mostrar a conta de 5 anos? Peça, assistência aqui na região, consumo e o quanto ela vale na revenda. Na maioria dos casos a diferença some no segundo ano — e você não fica na mão com máquina parada esperando peça de fora.”",
          "Isolamento: “Se o custo de 5 anos ficar a favor da New Holland, você fecha comigo?”",
        ] },
        { tipo: "script", titulo: "“Prefiro alugar”", itens: [
          "“Faz sentido pra serviço curto. Quantos meses por ano você aluga? [12] Então você paga uns R$ X por ano e no fim não tem nada. Com a parcela em Y, a máquina é sua, faz o mesmo serviço e ainda tem valor de revenda. Quer ver a comparação lado a lado?”",
          "Se for serviço realmente curto: “Então aluguel é o certo agora. Quando fechar a próxima obra de 6 meses ou mais, me chama que a conta vira.” (credibilidade para a próxima)",
        ] },
        { tipo: "script", titulo: "“O banco negou / meu limite não dá”", itens: [
          "“Vamos ver por outro caminho: consórcio com lance, CRD, entrada com a sua usada na troca, ou outro banco parceiro. Me passa o que o banco pediu que eu monto a proposta certa — resolver financiamento é parte do meu trabalho.”",
          "“Se for questão de limite, a gente pode olhar uma máquina de classe abaixo ou uma seminova certificada pra começar — e trocar quando o limite subir.”",
        ] },
        { tipo: "script", titulo: "“Já tenho fornecedor / sou fiel à marca X”", itens: [
          "“Respeito, e fidelidade é boa coisa. Não estou pedindo pra trocar tudo: só que na próxima máquina você compare de igual pra igual. Posso te mandar a proposta pra você ter como referência? Se o seu fornecedor fizer melhor, ótimo pra você.”",
          "“O que o seu fornecedor faz de melhor pra você? [ouça] Isso eu também faço. O que eu faço a mais é [assistência local / condição / você].”",
        ] },
        { tipo: "script", titulo: "“Vou esperar a safra / o próximo projeto”", itens: [
          "“Combinado. Só pra você ter na mão: a condição de hoje vale até dia X e a máquina do pátio pode sair. Se eu conseguir segurar a tabela e uma carência até a safra, faz sentido a gente assinar agora e você pagar quando o café entrar?”",
          "“Esperar tem custo: mais uma safra com a máquina antiga são mais R$ X de manutenção e o preparo atrasado. Vale a pena comparar esperar com fechar agora com carência?”",
        ] },
        { tipo: "script", titulo: "“Manutenção da New Holland é cara”", itens: [
          "“Comparado com o quê? Vamos olhar o plano de revisões e o preço das peças de maior giro. E o mais importante: quanto custa a máquina parada esperando peça — aqui você tem estoque e assistência em Cachoeiro.”",
          "“Posso te passar o telefone do Fulano, da pedreira de Vargem Alta? Ele mede o custo de manutenção da E215C há 2 anos e te fala o número real.”",
        ] },
        { tipo: "destaque", titulo: "Biblioteca", texto: "As objeções clássicas com resposta completa também estão na aba Biblioteca › Objeções. Decore as seis acima primeiro: são as que mais aparecem nas conversas do WhatsApp (o Orientador de Vendas do CRM marca qual apareceu em cada negociação)." },
      ],
      missao: "Grave um áudio seu respondendo cada uma das 6 objeções acima como se fosse para um cliente real. Ouça e ajuste até soar natural. Use o Treino com IA deste módulo para testar.",
      quiz: [
        { pergunta: "Cliente diz que prefere alugar 12 meses por ano. Melhor caminho:", opcoes: ["Dizer que alugar é jogar dinheiro fora", "Comparar o gasto anual de aluguel com a parcela e o patrimônio que fica", "Desistir"], correta: 1, explicacao: "A conta, feita com os números dele, mostra que ele já paga uma máquina sem ficar com ela." },
        { pergunta: "Financiamento negado. O que você faz?", opcoes: ["Encerra a negociação", "Abre caminhos alternativos: consórcio, CRD, usada na troca, outro banco", "Pede para ele resolver com o banco"], correta: 1, explicacao: "Resolver o financiamento é parte da venda de alto valor. Quem resolve, fecha." },
        { pergunta: "“Sou fiel à marca X.” Sua resposta:", opcoes: ["“A marca X é ruim”", "Respeita e pede só para comparar de igual para igual na próxima", "Desiste"], correta: 1, explicacao: "Não peça troca de marca; peça comparação. A porta abre." },
      ],
    },
    {
      id: "m7a3", titulo: "Banco 2: “vou pensar”, “manda por WhatsApp”, “meu operador prefere X” e outras", minutos: 12,
      resumo: "As objeções que parecem inofensivas e matam a venda em silêncio. Como isolar e responder cada uma.",
      blocos: [
        { tipo: "script", titulo: "“Vou pensar”", itens: [
          "Acolher + isolar: “Claro, é uma decisão grande. Me ajuda a não te atrapalhar: o que exatamente você precisa pensar — o valor, a parcela, o momento, ou conversar com alguém?”",
          "Depois da resposta: reenquadre a real. Se for “o momento”: “O que muda daqui a 30 dias que facilita? [nada] Então vamos decidir hoje o que dá e agendar o resto.”",
          "Fechamento: “Que tal assim: eu seguro a condição até sexta, você conversa com o Beltrano, e sexta às 10h a gente fecha ou encerra sem rodeio. Fechado?”",
        ] },
        { tipo: "script", titulo: "“Manda por WhatsApp / por e-mail que eu vejo”", itens: [
          "“Mando sim. Só que proposta lida sozinha sempre gera dúvida, e eu prefiro que você decida com a informação certa. Mando a de uma página agora e quinta às 9h eu passo 15 minutos aí pra revisar com você. Pode ser?”",
          "Se insistir: mande a versão de uma página, com pergunta fechada no fim e follow-up em 24 h.",
        ] },
        { tipo: "script", titulo: "“Meu operador prefere a marca X / não sabe mexer nessa”", itens: [
          "“Ótimo que ele tem opinião — operador bom é meio caminho. Posso trazer a máquina pra ele operar uma tarde? Se ele não gostar, eu paro por aqui. E treinamento vai incluso.”",
          "“O que ele gosta na marca X? [ouça] Isso a nossa tem também, e a cabine é mais confortável. Deixa ele julgar na cabine, não no papel.”",
        ] },
        { tipo: "script", titulo: "“Estou sem obra agora”", itens: [
          "“Entendo — sem obra, não faz sentido parcela. Me conta: tem alguma proposta ou licitação em andamento? [sim] Então vamos deixar a condição e o crédito pré-aprovados: quando a obra sair, a máquina chega em 15 dias e você não perde o prazo. Sem compromisso até lá.”",
        ] },
        { tipo: "script", titulo: "“É ano eleitoral / a prefeitura vai mudar”", itens: [
          "“Verdade, e por isso mesmo: o que está empenhado agora é entregue; depois da eleição o orçamento congela até o meio do ano que vem. Se a necessidade existe, o melhor momento é antes do prazo legal. Posso mostrar como outros municípios fizeram?”",
          "Para empreiteiro: “Obra pública pode atrasar, mas a estrada e o loteamento privado continuam. Vamos olhar a sua carteira sem a prefeitura?”",
        ] },
        { tipo: "script", titulo: "“A taxa de juros está alta”", itens: [
          "“Está. Duas coisas: primeiro, a máquina antiga também cobra juros — em manutenção e parada — e esses não param. Segundo, existem linhas com taxa reduzida (Finame, crédito rural, campanha do banco parceiro) e consórcio sem juros. Quer que eu compare as três com o seu número?”",
        ] },
        { tipo: "script", titulo: "“Vou comprar uma usada”", itens: [
          "“Pode ser um bom caminho. Vamos comparar: usada de R$ 180 mil com 8.000 h tem manutenção de R$ 30 mil/ano, sem garantia e sem financiamento longo. Nova com a sua atual na entrada fica em parcela de R$ X com garantia e revenda. Qual das duas custa menos por hora? Posso montar as duas — e se a usada for melhor pra você, eu te ajudo a achar uma boa no nosso estoque de usadas.”",
        ] },
        { tipo: "script", titulo: "“Preciso consultar meu sócio / minha esposa”", itens: [
          "“Perfeito — quem cuida do caixa precisa ver a conta. Posso apresentar pros dois juntos? Assim ninguém fica com dúvida e vocês decidem com a mesma informação. Quinta ou sexta?”",
        ] },
        { tipo: "tabela", titulo: "Resumo: a objeção real por trás", colunas: ["Objeção dita", "Real mais comum", "Pergunta de isolamento"], linhas: [
          ["Vou pensar", "Medo de errar / sócio / preço", "“O que exatamente precisa ficar claro?”"],
          ["Manda por WhatsApp", "Não é prioridade / quer comparar preço", "“O que vai pesar mais na sua análise?”"],
          ["Operador prefere X", "Medo de mudança / operador influente", "“Se ele aprovar na cabine, resolvido?”"],
          ["Sem obra agora", "Sem caixa / incerteza", "“Tem alguma obra em vista? Quando?”"],
          ["Taxa alta", "Parcela maior que o esperado", "“Se a parcela coubesse no que a máquina produz, fecharia?”"],
          ["Vou comprar usada", "Orçamento limitado", "“Se a nova ficar no mesmo custo por hora, prefere a nova?”"],
        ] },
      ],
      missao: "Escolha as 3 objeções deste banco que você mais ouve, escreva a sua versão dos scripts e teste cada uma no Treino com IA até tirar nota 8 ou mais.",
      quiz: [
        { pergunta: "Cliente diz “vou pensar”. Primeira coisa:", opcoes: ["Dar prazo de validade", "Isolar: perguntar o que exatamente precisa pensar", "Dizer “tá bom”"], correta: 1, explicacao: "Sem saber o que ele vai pensar, você não pode ajudar a decidir." },
        { pergunta: "“Meu operador prefere a marca X.” Melhor resposta:", opcoes: ["Ignorar o operador", "Colocar o operador na cabine em demonstração e incluir treinamento", "Trocar o operador"], correta: 1, explicacao: "Operador julga na cabine. Ganhe-o e ele vende para o dono." },
        { pergunta: "“A taxa está alta.” Reenquadre com:", opcoes: ["“Vai cair”", "O custo da máquina antiga (que também cobra juros) e as linhas com taxa reduzida/consórcio", "Desconto"], correta: 1, explicacao: "Manter a antiga não é grátis; e existem instrumentos alternativos." },
      ],
    },
    {
      id: "m7a4", titulo: "Prevenção: matando a objeção antes de ela nascer", minutos: 8,
      resumo: "As melhores objeções são as que nunca aparecem. Antecipe-as na apresentação.",
      blocos: [
        { tipo: "p", texto: "Se você sabe que “está caro” vai vir, apresente o custo total antes do preço. Se sabe que “vou pensar” vai vir, combine o processo de decisão no início (“vamos fazer assim: hoje eu mostro, quinta a gente revisa a proposta com seu sócio e sexta você decide — pode ser?”). Objeção prevista na apresentação vira ponto de concordância, não de resistência." },
        { tipo: "tabela", titulo: "Vacinas por objeção", colunas: ["Objeção provável", "Vacina (o que fazer antes)"], linhas: [
          ["Preço", "Ancore no valor produzido e no custo total antes de citar o número."],
          ["“Vou pensar”", "Acorde o cronograma de decisão na abertura."],
          ["Sócio / esposa", "Convide o comitê para a apresentação desde o começo."],
          ["Concorrente", "Leve o comparativo antes de ele pedir e reconheça o ponto forte do concorrente."],
          ["Financiamento", "Pergunte o caminho de pagamento na qualificação e faça a pré-análise antes da proposta."],
          ["Assistência", "Traga o mecânico na visita e o prazo de atendimento por escrito."],
          ["Operador", "Coloque-o na cabine antes de o dono decidir."],
          ["Momento (“agora não”)", "Mostre o custo de esperar (manutenção, safra, obra) na conta de retorno."],
        ] },
        { tipo: "script", titulo: "Acusação preventiva (Chris Voss)", itens: [
          "“Você deve estar pensando que todo vendedor diz que a máquina dele é a melhor e que a taxa é a mais baixa. Então eu não vou dizer isso: vou te mostrar a conta e você decide.”",
          "“Sei que a primeira reação vai ser ‘está caro’. É normal. Por isso quero começar pelo que ela produz, e não pelo que ela custa.”",
        ] },
        { tipo: "caso", titulo: "Caso: a reunião sem objeção", situacao: "Vendedor apresentou para construtora com sócio, esposa e engenheiro na sala, depois de pré-análise aprovada e demonstração com o operador.", acao: "Abriu combinando que ao fim da reunião decidiriam sim ou não. Apresentou a conta, o comparativo com o concorrente já reconhecido, a assistência por escrito e a condição.", resultado: "Nenhuma objeção. Pergunta de fechamento, silêncio, “vamos fechar”.", licao: "Quando tudo o que geraria objeção foi tratado antes, sobra só a decisão." },
      ],
      missao: "Escreva as 3 objeções que você mais ouve e, para cada uma, a “vacina” que você vai colocar no início da próxima apresentação. Aplique e registre no CRM se a objeção apareceu.",
      quiz: [
        { pergunta: "Como prevenir o “vou pensar”?", opcoes: ["Dar desconto", "Combinar o cronograma de decisão no início da conversa", "Não dar tempo ao cliente"], correta: 1, explicacao: "Processo combinado vira compromisso. O “vou pensar” perde espaço." },
        { pergunta: "O que é acusação preventiva?", opcoes: ["Acusar o concorrente", "Dizer antes o que o cliente está pensando de negativo, desarmando a defesa", "Culpar o cliente"], correta: 1, explicacao: "Nomear a desconfiança antes tira a força dela." },
      ],
    },
    {
      id: "m7a5", titulo: "Objeções em grupo: sócios, comitê e o advogado do diabo", minutos: 10,
      resumo: "Na reunião com 3 pessoas, a objeção vem de quem menos fala. Como conduzir o grupo, neutralizar o cético e usar o aliado.",
      blocos: [
        { tipo: "p", texto: "Em grupo, a dinâmica muda: as pessoas objetam para marcar posição, para proteger o outro ou para mostrar que estão atentas. O erro clássico é responder só ao dono e ignorar o sócio calado — que decide no corredor depois. Regra: cada objeção em grupo é respondida para o grupo, com validação de quem perguntou e checagem de todos." },
        { tipo: "lista", titulo: "Técnicas para reunião em grupo", itens: [
          "Mapeie antes: quem decide, quem influencia, quem paga, quem opera. Cumprimente todos pelo nome.",
          "Distribua o olhar: ao responder uma objeção, olhe para quem perguntou e termine olhando para o decisor.",
          "Feel–felt–found: “Entendo como você se sente; o Fulano da Construtora X sentiu o mesmo; o que ele descobriu foi…”. Valida, traz prova social, reenquadra.",
          "Use o aliado: “Zé, você operou ela ontem — como foi?” O operador responde a objeção do sócio melhor que você.",
          "Cético estruturado (o advogado do diabo): agradeça (“boa pergunta, é exatamente o que eu perguntaria”), responda com dado e devolva: “o que mais você quer checar?”. Ele quer ser levado a sério; leve.",
          "Não deixe uma objeção no ar: “resolvido esse ponto? Alguém mais tem dúvida sobre isso?” antes de seguir.",
          "Silêncio do decisor no fim: pergunte diretamente. “Beltrano, o que você achou?”",
        ] },
        { tipo: "script", titulo: "Situações típicas", itens: [
          "Sócio calado que balança a cabeça: “Beltrano, vi que você ficou pensativo na parcela. O que te preocupa? Quero resolver isso agora, não depois.”",
          "Esposa/financeiro: “Dona Maria, a senhora cuida do caixa — a pergunta certa é se a parcela cabe no que a máquina gera. Posso mostrar mês a mês?”",
          "Engenheiro cético: “Doutor, o senhor conhece a obra melhor que eu. Aqui estão os dados de ciclo e consumo medidos. Se quiser, testamos na sua obra com o seu laboratório.”",
          "Objeção cruzada (um contra, outro a favor): não tome partido. “Os dois pontos são válidos: o Fulano quer produção e o Beltrano quer segurança no caixa. A conta atende os dois: veja.”",
        ] },
        { tipo: "erros", titulo: "Erros em grupo", itens: [
          "Responder só ao dono. O sócio decide depois, sem você.",
          "Debater com o cético. Você ganha o debate e perde a venda.",
          "Deixar objeção “pra depois”. Depois não existe.",
          "Apresentar em pé enquanto todos sentam (ou vice-versa). Iguale a posição.",
          "Terminar sem perguntar a decisão para o grupo.",
        ] },
        { tipo: "caso", titulo: "Caso: o cunhado engenheiro", situacao: "Reunião com produtor de café, esposa e cunhado engenheiro, que criticava tudo.", acao: "O vendedor agradeceu cada pergunta do cunhado, respondeu com dados e pediu a opinião técnica dele sobre a aplicação. Transformou-o em consultor da família na sala.", resultado: "O cunhado terminou recomendando a compra. A esposa aprovou. Fechou na reunião.", licao: "O cético quer respeito e protagonismo. Dê os dois e ele vende por você." },
      ],
      missao: "Marque uma reunião com o comitê completo de uma negociação quente. Mapeie os papéis antes, aplique feel–felt–found e a checagem de todos, e registre no CRM quem objetou o quê.",
      quiz: [
        { pergunta: "O sócio calado balança a cabeça na parcela. Você:", opcoes: ["Segue a apresentação", "Pergunta diretamente o que o preocupa e resolve na hora", "Fala mais rápido"], correta: 1, explicacao: "Objeção não dita decide no corredor. Traga para a mesa." },
        { pergunta: "O engenheiro cético critica os dados. Você:", opcoes: ["Debate até vencer", "Agradece, responde com dado e devolve o protagonismo (“o que mais quer checar?”)", "Ignora"], correta: 1, explicacao: "Cético respeitado vira aliado." },
      ],
    },
    {
      id: "m7a6", titulo: "Objeções pelo WhatsApp e o cliente que sumiu", minutos: 10,
      resumo: "Por texto, tom e tamanho decidem. Como responder objeção escrita sem parecer robô, quando ligar, e como reativar quem parou de responder.",
      blocos: [
        { tipo: "lista", titulo: "Regras da objeção por texto", itens: [
          "Responda em até 15 minutos. Objeção sem resposta cresce.",
          "Acolha na primeira linha, isole com uma pergunta, e pare. Não despeje o reenquadramento inteiro por texto.",
          "Máximo 4 linhas. Um dado forte, uma pergunta.",
          "Áudio de 30 s para reenquadrar com emoção (conta, história). Texto para dado.",
          "Se a segunda mensagem não avançar: ligue. “Vi que ficou dúvida, prefiro resolver em 2 minutos por voz.”",
          "Nunca “kkk”, nunca emoji em objeção séria, nunca parágrafo gigante.",
          "Revise sugestões da IA do CRM antes de enviar: o Orientador ajuda, mas a voz é sua.",
        ] },
        { tipo: "script", titulo: "Objeções por texto — versões curtas", itens: [
          "Cliente: “Tá caro.” → “Entendo, é alto mesmo. Pergunta rápida: o que pesou mais — o valor total ou a parcela? Dependendo, tem caminho diferente.”",
          "Cliente: “A XCMG tá 100 mil mais barata.” → “Faz sentido olhar. Posso te mandar a conta de 5 anos com revenda, peça e consumo? Se a deles fechar melhor, eu te digo.”",
          "Cliente: “Vou deixar pra depois.” → “Tranquilo. Só pra eu me organizar: depois é quando — depois da safra, da obra, do banco? Assim eu te procuro na hora certa e não te atrapalho.”",
          "Cliente: “Meu sócio não quer.” → “Entendo. O que ele viu que não fechou pra ele? Se for a parcela, tenho uma opção com carência que talvez resolva. Posso mostrar pros dois?”",
        ] },
        { tipo: "p", titulo: "O cliente que sumiu", texto: "Sumiu depois da proposta = provavelmente comparou preço, teve medo ou o sócio travou. Não cobre (“viu a proposta?”). Traga valor novo e uma saída fácil. Três toques: um dado/foto (dia 2), uma ligação (dia 5), uma mensagem de encerramento educada (dia 12). O encerramento gera a maioria das respostas." },
        { tipo: "script", titulo: "Reativação", itens: [
          "Dia 2: “Fulano, a B95C da obra do Zé em Itapemirim ontem [vídeo]. Aplicação igual à sua. Ficou alguma dúvida na proposta que eu possa resolver?”",
          "Dia 5 (ligação; se não atender): “Te liguei pra tirar uma dúvida sua, não pra cobrar. Me diz por texto mesmo: o que travou?”",
          "Dia 12: “Fulano, imagino que a máquina não seja prioridade agora, e tudo bem. Vou encerrar por aqui pra não te incomodar. Se voltar a fazer sentido, me chama que eu resolvo rápido. Posso te mandar uma novidade a cada 2 meses?”",
          "Reaparecendo depois de meses: “Que bom te ver de novo. Mudou alguma coisa desde a última vez? Vamos partir de onde paramos?” (sem cobrar o sumiço)",
        ] },
        { tipo: "caso", titulo: "Caso: o “tá caro” por texto", situacao: "Empreiteiro respondeu “tá caro” à proposta, por WhatsApp, às 21h.", acao: "O vendedor respondeu em 5 minutos, com 3 linhas: acolheu, perguntou se era o total ou a parcela. Resposta: “a parcela”. Mandou um áudio de 30 s explicando carência e usada na entrada e propôs ligar às 8h.", resultado: "Às 8h, ligação de 6 minutos. Parcela ajustada com a usada. Fechou na semana.", licao: "Objeção por texto se isola por texto e se resolve por voz." },
      ],
      missao: "Revise no CRM os 5 clientes que sumiram após proposta nos últimos 60 dias. Aplique a sequência de reativação em cada um e registre as respostas.",
      quiz: [
        { pergunta: "Cliente manda “tá caro” por WhatsApp. Melhor resposta:", opcoes: ["Um parágrafo com todos os argumentos", "Acolher e isolar em 3 linhas: total ou parcela?", "Desconto"], correta: 1, explicacao: "Por texto, isole. O reenquadramento vai em áudio ou ligação." },
        { pergunta: "Cliente sumiu após a proposta. Você manda:", opcoes: ["“Viu a proposta?”", "Valor novo (vídeo, dado) com pergunta fácil, depois ligação, depois encerramento educado", "Nada"], correta: 1, explicacao: "Cobrança afasta; valor e saída fácil trazem de volta." },
      ],
    },
  ],
  prova: [
    { pergunta: "Ordem correta do método:", opcoes: ["Rebater → confirmar", "Acolher → isolar → reenquadrar → confirmar", "Isolar → desconto"], correta: 1, explicacao: "Os 4 passos." },
    { pergunta: "“Se o preço fosse igual ao do concorrente, fecharia hoje?” é:", opcoes: ["Reenquadrar", "Isolar", "Acolher"], correta: 1, explicacao: "Descobre se a objeção real é o preço." },
    { pergunta: "“Vou pensar.” O que perguntar?", opcoes: ["“Quando você me responde?”", "“O que exatamente precisa ficar claro?”", "“Quer desconto?”"], correta: 1, explicacao: "Isole a objeção real." },
    { pergunta: "Vacina contra “preciso falar com meu sócio”:", opcoes: ["Ligar para o sócio depois", "Convidar o comitê para a apresentação desde o começo", "Ignorar o sócio"], correta: 1, explicacao: "Prevenção: todos na sala." },
    { pergunta: "Em reunião com 3 pessoas, a objeção do sócio calado:", opcoes: ["Deve ser ignorada", "Deve ser trazida à mesa com pergunta direta", "Se resolve depois"], correta: 1, explicacao: "Objeção não dita decide no corredor." },
    { pergunta: "Objeção séria por WhatsApp se resolve:", opcoes: ["Com parágrafo longo", "Isolando por texto e reenquadrando por áudio/ligação", "Com emoji"], correta: 1, explicacao: "Texto isola; voz resolve." },
  ],
};
