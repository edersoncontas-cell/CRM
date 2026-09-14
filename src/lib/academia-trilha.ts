// Trilha de Formação da Academia de Vendas — currículo por níveis escrito
// para o nicho: venda consultiva de máquinas pesadas New Holland Construction
// (retroescavadeiras, escavadeiras, pás-carregadeiras, motoniveladoras) e
// rolos Dynapac, no sul do Espírito Santo (construtoras, empreiteiras,
// prefeituras, pedreiras/mineração, produtores de café, locadoras).
// Cada aula: conteúdo em blocos, um script pronto, uma missão prática no
// campo e um quiz. O progresso fica em Configuracao (academia-actions.ts).

export type Bloco =
  | { tipo: "p"; texto: string; titulo?: string }
  | { tipo: "lista"; titulo?: string; itens: string[] }
  | { tipo: "script"; titulo?: string; itens: string[] }
  | { tipo: "destaque"; titulo?: string; texto: string };

export type Pergunta = { pergunta: string; opcoes: string[]; correta: number; explicacao: string };

export type Aula = {
  id: string;
  titulo: string;
  minutos: number;
  resumo: string;
  blocos: Bloco[];
  missao: string;
  quiz: Pergunta[];
};

export type Modulo = {
  id: string;
  nivel: number;
  titulo: string;
  tema: string;
  descricao: string;
  cor: string; // cor de destaque (hex)
  aulas: Aula[];
};

export const TRILHA: Modulo[] = [
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "m1", nivel: 1, titulo: "Fundamentos do vendedor de máquinas pesadas", tema: "Base", cor: "#60a5fa",
    descricao: "Mentalidade, rotina e domínio do produto e do território. Sem isso, técnica nenhuma segura.",
    aulas: [
      {
        id: "m1a1", titulo: "A mentalidade de quem vende máquina de R$ 500 mil", minutos: 8,
        resumo: "Venda consultiva de alto valor é decisão de investimento, não compra por impulso. Quem entende isso vende com calma e autoridade.",
        blocos: [
          { tipo: "p", texto: "Uma retroescavadeira B95C ou uma escavadeira E215C não é comprada como se compra um celular. É uma decisão que envolve fluxo de caixa, financiamento, obra no prazo e, muitas vezes, o patrimônio da família do dono. O seu papel não é “empurrar” — é ser o profissional que ajuda o cliente a tomar uma decisão de investimento com segurança. Quem age assim é procurado; quem age como tirador de pedido é evitado." },
          { tipo: "lista", titulo: "As 5 crenças do vendedor de alta performance", itens: [
            "Eu resolvo problema de produção, não vendo ferro. O cliente quer a obra andando, a pedreira produzindo, o cafezal preparado.",
            "Preço é a última conversa, nunca a primeira. Quem começa por preço vira commodity e perde para o mais barato.",
            "Cada “não” é informação. Anoto o motivo, marco retorno e sigo — a maioria das vendas acontece depois do 4º contato.",
            "Meu diferencial sou eu: presença na obra, resposta rápida, palavra cumprida. Isso o concorrente não copia com desconto.",
            "Eu controlo atividades (visitas, propostas, contatos); o resultado é consequência da rotina, não da sorte.",
          ] },
          { tipo: "destaque", titulo: "Regra de ouro", texto: "Na venda de alto valor, confiança vale mais que argumento. Cumpra o combinado (hora, retorno, informação) e você já está na frente de 80% dos vendedores." },
          { tipo: "p", titulo: "O ciclo real da venda no seu mercado", texto: "Do primeiro contato ao faturamento passam, em média, várias semanas: contato → visita à obra → proposta → análise de crédito/financiamento → negociação → fechamento → faturamento → entrega técnica. Cada etapa tem um objetivo claro e você deve saber em qual etapa cada cliente está (é para isso que existe o funil de Negociações do CRM). Vendedor sem funil vende no escuro." },
        ],
        missao: "Abra o funil de Negociações e, para cada negociação em aberto, escreva em uma frase qual é o PRÓXIMO PASSO concreto (não “acompanhar”: “ligar quinta para confirmar visita”, “enviar proposta da B95C até sexta”). Salve no campo de próxima ação.",
        quiz: [
          { pergunta: "Qual é a primeira coisa a fazer quando um cliente novo pergunta “quanto custa a retro?”", opcoes: ["Passar o preço na hora, para não perder o cliente", "Entender a obra/aplicação antes de falar de preço", "Dizer que o preço depende e encerrar"], correta: 1, explicacao: "Preço sem contexto vira commodity. Primeiro descubra o que ele vai fazer com a máquina; o preço entra depois, ancorado no valor." },
          { pergunta: "O que o vendedor controla de verdade?", opcoes: ["O resultado do mês", "As atividades: visitas, propostas, contatos", "O humor do cliente"], correta: 1, explicacao: "Resultado é consequência de atividade consistente. Foque no que está na sua mão." },
        ],
      },
      {
        id: "m1a2", titulo: "Domínio de produto: fale de resultado, não de ficha técnica", minutos: 10,
        resumo: "Cliente não compra 97 cv, compra “cava a fundação em metade do tempo”. Aprenda a traduzir cada especificação em dinheiro e produtividade.",
        blocos: [
          { tipo: "p", texto: "Você precisa saber a ficha técnica de cor — mas o cliente precisa ouvir o que ela significa na obra dele. A regra é: característica → benefício → valor em reais ou tempo. Exemplo: “motor de 97 cv com torque alto em baixa rotação” → “sobe rampa carregada sem afogar” → “menos tempo de ciclo e menos diesel por caçamba: uns R$ 2 mil a menos por mês em combustível”." },
          { tipo: "lista", titulo: "Traduções prontas (use e adapte)", itens: [
            "Retroescavadeira B95C — 4x4 e cabine com visibilidade: “trabalha em terreno de café e obra urbana com o mesmo conforto; operador rende mais o dia inteiro”.",
            "Escavadeira E215C — sistema hidráulico com modos de trabalho: “no modo econômico você faz a mesma produção gastando menos diesel; no modo potência, encara rocha alterada na pedreira”.",
            "Pá-carregadeira W130B — caçamba e força de desagregação: “carrega caminhão com menos passadas; cada passada a menos é diesel e tempo economizados”.",
            "Motoniveladora RG140B/RG170B — cabine no chassi traseiro: “o operador enxerga a lâmina e o acabamento; menos retrabalho na estrada, menos horas para fechar o trecho” (diferencial frente aos concorrentes com cabine no chassi dianteiro).",
            "Rolo Dynapac CA2500 — amplitude e frequência ajustáveis: “atinge a compactação exigida no laudo com menos passadas; libera a frente de serviço mais rápido”.",
            "Rede de concessionária e peças: “máquina parada custa a diária do operador, o aluguel de outra máquina e a multa de prazo — a nossa rede reduz esse risco”.",
          ] },
          { tipo: "destaque", titulo: "Ferramenta do CRM", texto: "As Fichas Técnicas e o Comparativo têm os dados verificados de cada modelo. Antes de uma visita, releia a ficha do modelo que vai apresentar e escolha 3 traduções para aquele cliente." },
          { tipo: "p", titulo: "Custo da máquina parada", texto: "Aprenda a fazer esta conta com o cliente: operador (diária) + máquina alugada para cobrir (diária) + atraso no prazo (multa ou perda de medição) = custo por dia parado. Em obra pública ou pedreira, um dia parado passa fácil de R$ 3 mil. Isso muda a conversa sobre “a marca X é mais barata”." },
        ],
        missao: "Escolha os 3 modelos que você mais vende. Para cada um, escreva 3 frases no formato característica → benefício → valor em R$ ou tempo. Guarde no seu bloco de notas e use na próxima visita.",
        quiz: [
          { pergunta: "Qual é a ordem certa para apresentar uma característica técnica?", opcoes: ["Valor → característica → benefício", "Característica → benefício → valor", "Benefício → preço → característica"], correta: 1, explicacao: "Característica → benefício → valor em reais/tempo. É a tradução que o cliente entende e lembra." },
          { pergunta: "O que entra na conta do “custo da máquina parada”?", opcoes: ["Só o conserto", "Operador parado, máquina de cobertura e atraso de prazo", "Nada, é risco do cliente"], correta: 1, explicacao: "Esse cálculo é o que justifica marca, rede e disponibilidade — e desarma o argumento de “mais barato”." },
        ],
      },
      {
        id: "m1a3", titulo: "O seu território: quem compra máquina no sul do ES", minutos: 9,
        resumo: "Cada nicho tem um gatilho de compra diferente. Conheça os principais perfis da sua região e o momento certo de cada um.",
        blocos: [
          { tipo: "lista", titulo: "Perfis e o que move cada um", itens: [
            "Construtoras e empreiteiras (Cachoeiro, Guarapari, Vitória): compram por contrato ganho. Gatilho: licitação vencida ou obra privada fechada. Pergunte “qual obra está começando?”.",
            "Prefeituras e consórcios: compram por emenda/convênio/licitação. Ciclo longo, decisão política. Gatilho: recurso liberado. Mantenha relacionamento com o secretário de obras e conheça o calendário.",
            "Pedreiras, britagem e mineração (região de granito): compram por produção/hora e disponibilidade. Gatilho: máquina antiga parando demais. Fale de custo por tonelada.",
            "Produtores e cooperativas de café (Caparaó, serrana): compram por safra e preço do café. Gatilho: safra boa + crédito rural. Fale de preparo de terreno, estrada de fazenda, terraço.",
            "Locadoras: compram por demanda de aluguel e valor de revenda. Gatilho: contrato de locação novo. Fale de disponibilidade, garantia e valor residual.",
            "Terraplenagem e pequenos empreiteiros: compram para substituir a máquina cansada. Gatilho: manutenção cara. Fale de financiamento e troca com usada.",
          ] },
          { tipo: "p", titulo: "Calendário do território", texto: "Café: crédito rural e decisão de compra concentram entre a colheita e o plantio (segundo semestre). Prefeituras: início e fim de mandato mexem com compras; evite contar com fechamento em período eleitoral. Construção: começo de ano é planejamento; obras arrancam de março em diante. Use o letreiro e as notícias do Dashboard para pegar o sinal (preço do café, crédito, obras anunciadas)." },
          { tipo: "destaque", titulo: "Mapa de oportunidades", texto: "No Dashboard, o mapa do ES mostra onde você já vendeu. As cidades sem cifrão perto das que têm são o seu próximo alvo: mesmo perfil de cliente, sem concorrência de referência." },
        ],
        missao: "Liste 5 clientes potenciais em cidades onde você ainda não vendeu (use o mapa). Para cada um, anote o nicho e o gatilho de compra provável. Agende o primeiro contato desta semana.",
        quiz: [
          { pergunta: "Qual é o gatilho de compra mais comum de uma construtora?", opcoes: ["Promoção da concessionária", "Obra/contrato novo fechado", "Fim de ano"], correta: 1, explicacao: "Construtora compra quando ganha obra. Pergunte sempre pelo que está começando." },
          { pergunta: "Com produtor de café, quando concentrar o esforço de venda?", opcoes: ["Em qualquer mês, tanto faz", "Entre a colheita e o plantio, quando há crédito e caixa", "Só em ano eleitoral"], correta: 1, explicacao: "Safra boa + crédito rural liberado é o momento. Prepare o terreno (relacionamento) antes." },
        ],
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "m2", nivel: 2, titulo: "Psicologia do comprador de máquinas", tema: "Psicologia", cor: "#a78bfa",
    descricao: "Como o dono de obra, o produtor e o gestor público decidem de verdade — e como se comunicar com cada perfil.",
    aulas: [
      {
        id: "m2a1", titulo: "DISC na prática: leia o cliente em 2 minutos", minutos: 10,
        resumo: "Quatro perfis, quatro formas de comprar. Errar o tom com um perfil D ou S custa a venda mesmo com o melhor preço.",
        blocos: [
          { tipo: "lista", titulo: "Como identificar e como falar", itens: [
            "D — Dominante (dono de empreiteira apressado): fala curto, quer resultado e decisão. Vá direto: “essa máquina entrega X por dia, financia em Y, entrego em Z. Fecha?”. Nunca enrole.",
            "I — Influente (comunicativo, gosta de gente): decide pela relação e pela imagem. Conte casos de clientes conhecidos dele, mostre a máquina na obra de alguém, valorize o status de ter New Holland nova.",
            "S — Estável (produtor de café tradicional, cauteloso): teme errar e mudar. Dê segurança: garantia, rede de peças, referência de vizinho, zero pressão. Vá em duas ou três visitas.",
            "C — Conforme (engenheiro, comprador técnico de prefeitura): decide por dados. Leve ficha técnica, comparativo, consumo em números, planilha de custo por hora. Não use adjetivo, use tabela.",
          ] },
          { tipo: "p", titulo: "Sinais rápidos", texto: "Responde mensagem com uma palavra e pergunta preço logo = D. Manda áudio longo e pergunta como você está = I. Demora a responder, pede para “pensar” e cita o cunhado que entende = S. Pede PDF, pergunta de garantia e consumo com casas decimais = C. O CRM registra o perfil DISC no cadastro do cliente — preencha depois de cada conversa." },
          { tipo: "script", titulo: "Mesma máquina, quatro aberturas", itens: [
            "D: “Tenho uma B95C pronta pra entrega e uma condição que fecha esta semana. Posso te mostrar em 10 minutos na obra?”",
            "I: “O Roberto da construtora do lado tá com a B95C há 6 meses e me disse que foi a melhor compra do ano. Vamos lá ver ela trabalhando?”",
            "S: “Sem compromisso: queria só te mostrar como funciona a garantia e a assistência aqui na região, pra você decidir com calma.”",
            "C: “Preparei um comparativo de consumo e custo por hora entre a B95C e o modelo que você usa hoje. Posso te enviar e a gente revisa juntos?”",
          ] },
        ],
        missao: "Classifique os 10 clientes mais quentes do seu funil em D, I, S ou C e registre no cadastro. Reescreva a próxima mensagem para 3 deles no tom do perfil.",
        quiz: [
          { pergunta: "Um cliente pede planilha de consumo e garantia detalhada. Qual perfil e qual abordagem?", opcoes: ["I — conte histórias", "C — leve dados e comparativo", "D — feche na hora"], correta: 1, explicacao: "Perfil Conforme decide por dados. Adjetivo não funciona; tabela funciona." },
          { pergunta: "Com um perfil S, o que mais atrapalha a venda?", opcoes: ["Dar garantia demais", "Pressão e prazo curto", "Levar referência de vizinho"], correta: 1, explicacao: "O Estável teme errar; pressão dispara o medo. Segurança e tempo vendem." },
        ],
      },
      {
        id: "m2a2", titulo: "Vieses que decidem a compra: ancoragem, prova social e aversão à perda", minutos: 9,
        resumo: "Três atalhos mentais que operam em toda negociação de máquina — use com ética e eles trabalham para você.",
        blocos: [
          { tipo: "p", titulo: "Ancoragem", texto: "O primeiro número mencionado vira referência. Se o cliente ancora em “a chinesa custa 300”, tudo fica caro. Ancore você primeiro no valor total de propriedade: “uma máquina dessas produz cerca de R$ 40 mil por mês; a diferença de preço entre as marcas se paga em poucos meses de disponibilidade”. Depois apresente o preço." },
          { tipo: "p", titulo: "Prova social", texto: "Ninguém quer ser o primeiro a errar. Cite clientes da mesma cidade e do mesmo nicho (com permissão): “a pedreira de Cachoeiro trocou por E215C e reduziu o consumo”. Fotos e vídeos de máquina trabalhando na região valem mais que catálogo. Peça depoimento no pós-venda e guarde no celular." },
          { tipo: "p", titulo: "Aversão à perda", texto: "Perder dói mais que ganhar. Em vez de “você vai ganhar produtividade”, diga “você está perdendo R$ 3 mil por dia cada vez que a máquina antiga para”. Em fechamento: “a tabela sobe dia 1º; depois disso esse valor não existe mais” (só se for verdade)." },
          { tipo: "destaque", titulo: "Ética", texto: "Esses gatilhos funcionam porque são verdade. Inventar escassez ou depoimento destrói a confiança que é o seu maior ativo. Use fatos reais, sempre." },
        ],
        missao: "Monte uma pasta no celular com 5 provas sociais reais (fotos/vídeos/prints de clientes satisfeitos da região). Use uma delas na próxima proposta.",
        quiz: [
          { pergunta: "Como ancorar antes do preço?", opcoes: ["Falar o preço do concorrente", "Falar do valor que a máquina produz por mês", "Não falar em número nenhum"], correta: 1, explicacao: "Ancorando no que ela produz, o preço passa a ser comparado com o retorno, não com a máquina mais barata." },
          { pergunta: "Qual frase usa aversão à perda?", opcoes: ["“Você vai ganhar tempo.”", "“Você está perdendo R$ 3 mil por dia com a máquina parada.”", "“A máquina é boa.”"], correta: 1, explicacao: "Perda concreta em reais move mais que ganho abstrato." },
        ],
      },
      {
        id: "m2a3", titulo: "O comitê invisível: sócio, esposa, contador e operador", minutos: 8,
        resumo: "Poucas vendas de máquina são decididas por uma pessoa só. Mapeie quem influencia e venda para todos.",
        blocos: [
          { tipo: "p", texto: "“Preciso falar com meu sócio” raramente é desculpa: é a realidade da decisão. Em empresa familiar, a esposa cuida do financeiro; o contador opina sobre financiamento; o operador influencia no modelo (ele quem vai passar 10 horas na cabine); na prefeitura, o secretário quer, mas o setor de compras decide. Descubra cedo: “além de você, quem mais participa dessa decisão?”." },
          { tipo: "lista", titulo: "Como vender para cada um", itens: [
            "Sócio/esposa (financeiro): leve a proposta com parcela, prazo e o retorno em reais. Ofereça-se para apresentar pessoalmente.",
            "Contador: fale de Finame/BNDES, depreciação, consórcio. Envie a simulação que ele consegue analisar.",
            "Operador: convide para a demonstração. Operador que gosta da cabine vira seu vendedor dentro da empresa.",
            "Comprador/licitação: antecipe-se — ajude na especificação técnica antes do edital sair (é legítimo e comum).",
          ] },
          { tipo: "script", titulo: "Mapeando o decisor", itens: [
            "“Pra eu montar a proposta certa: quem mais vai olhar esse investimento com você? Financeiro, sócio, contador?”",
            "“Posso passar na empresa e apresentar pra vocês juntos? Assim ninguém fica com dúvida e a decisão sai mais rápido.”",
          ] },
        ],
        missao: "Nas 5 negociações mais avançadas, anote quem são os outros decisores e influenciadores. Onde não souber, faça a pergunta do script nesta semana.",
        quiz: [
          { pergunta: "O que fazer quando o cliente diz “preciso falar com meu sócio”?", opcoes: ["Pressionar para decidir sozinho", "Oferecer-se para apresentar aos dois juntos", "Esperar ele voltar"], correta: 1, explicacao: "Venda para o comitê inteiro. Apresentação conjunta elimina o telefone-sem-fio e acelera." },
        ],
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "m3", nivel: 3, titulo: "Neurociência aplicada às vendas", tema: "Neurociência", cor: "#2ee6ff",
    descricao: "O cérebro decide antes de a razão justificar. Aprenda a falar com o cérebro que compra.",
    aulas: [
      {
        id: "m3a1", titulo: "Decisão emocional, justificativa racional", minutos: 9,
        resumo: "O sistema límbico decide em segundos; o córtex monta a explicação depois. Sua apresentação precisa servir aos dois.",
        blocos: [
          { tipo: "p", texto: "Pesquisas em neurociência da decisão mostram que a escolha nasce de circuitos emocionais e depois é racionalizada. Na prática: o dono da obra “sente” que a máquina certa é a sua (segurança, orgulho, alívio) e depois usa a ficha técnica para justificar para o sócio. Se você só entrega ficha técnica, alimenta a justificativa sem provocar a decisão." },
          { tipo: "lista", titulo: "Emoções que compram máquina", itens: [
            "Alívio: “nunca mais ficar na mão com máquina velha”. Mostre o pós-venda e a rede.",
            "Orgulho/status: máquina nova na frente da obra, foto com a equipe. Valorize a conquista.",
            "Segurança: garantia, marca, referência de conhecidos. Reduza o medo de errar.",
            "Ganância saudável: mais produção, mais contrato, mais margem. Traga números.",
            "Medo de perder: a obra atrasar, o concorrente ganhar a licitação com melhor equipamento.",
          ] },
          { tipo: "p", titulo: "Como estruturar a fala", texto: "Abra com a dor emocional (o que a máquina antiga custa em dor de cabeça), mostre a solução com imagem concreta (a máquina trabalhando na obra dele), e só então entregue os dados que justificam. Emoção → imagem → razão. Inverter a ordem deixa a decisão fria." },
          { tipo: "destaque", titulo: "Imagem mental", texto: "“Imagina segunda-feira: a E215C chegando na sua obra, o operador subindo na cabine com ar-condicionado, e você fechando a fundação até quinta em vez de na outra semana.” Frases assim ativam áreas visuais e motoras do cérebro — o cliente “vive” a compra antes de assinar." },
        ],
        missao: "Reescreva a apresentação da sua máquina mais vendida na ordem emoção → imagem → razão. Teste em voz alta e use na próxima visita.",
        quiz: [
          { pergunta: "Qual ordem de apresentação conversa com o cérebro que decide?", opcoes: ["Razão → emoção → imagem", "Emoção → imagem → razão", "Preço → ficha → garantia"], correta: 1, explicacao: "A decisão nasce emocional; a razão justifica. Dados entram por último, para sustentar a escolha." },
        ],
      },
      {
        id: "m3a2", titulo: "Rapport, espelhamento e neurônios-espelho", minutos: 8,
        resumo: "Sintonia gera confiança sem esforço consciente. Técnicas simples para o cliente sentir que “você é dos nossos”.",
        blocos: [
          { tipo: "p", texto: "Neurônios-espelho fazem o cérebro reproduzir internamente gestos, ritmo e tom de quem está na frente. Quando você espelha (com naturalidade) o ritmo de fala, a postura e o vocabulário do cliente, ele sente familiaridade e confiança. Isso é biologia, não truque — e no interior, onde relação é tudo, decide venda." },
          { tipo: "lista", titulo: "Espelhamento prático", itens: [
            "Ritmo: cliente fala devagar, você desacelera. Cliente é rápido, seja objetivo.",
            "Vocabulário: se ele fala “retro”, “pá”, “patrol”, use as palavras dele — não corrija.",
            "Postura na obra: pé no barro, capacete, olhar a máquina antiga com interesse real.",
            "Ambiente: aceite o café, pergunte da família, lembre do nome do operador. Registre no CRM para lembrar na próxima.",
            "No WhatsApp: responda no formato dele (áudio para quem manda áudio, texto curto para quem manda texto curto).",
          ] },
          { tipo: "script", titulo: "Abertura de rapport na visita", itens: [
            "“Antes de falar de máquina: como tá a obra? O que mais tá dando trabalho hoje?” (e escute 3 minutos sem interromper)",
            "“Essa retro aí tem quantas horas? Já deu bastante serviço, hein.” (elogie a história do cliente, não critique a máquina dele)",
          ] },
        ],
        missao: "Na próxima visita, passe os primeiros 5 minutos só ouvindo e espelhando (ritmo e vocabulário). Depois anote no CRM 3 informações pessoais/da obra que o cliente contou.",
        quiz: [
          { pergunta: "O cliente chama a motoniveladora de “patrol”. O que você faz?", opcoes: ["Corrige para “motoniveladora”", "Usa “patrol” também", "Ignora"], correta: 1, explicacao: "Vocabulário espelhado gera pertencimento. Corrigir o cliente cria distância." },
        ],
      },
      {
        id: "m3a3", titulo: "Dopamina, antecipação e o momento certo de fechar", minutos: 8,
        resumo: "O pico de desejo acontece na antecipação, não na posse. Saiba construir e reconhecer esse pico.",
        blocos: [
          { tipo: "p", texto: "O circuito de recompensa libera dopamina principalmente na expectativa de ganhar algo. Na venda, o pico de desejo do cliente acontece quando ele imagina a máquina trabalhando e o problema resolvido — geralmente na demonstração ou logo depois de uma boa visita. Se você espera “esfriar” para mandar proposta dias depois, perde o pico." },
          { tipo: "lista", titulo: "Como construir a antecipação", itens: [
            "Demonstração na obra do cliente, com o operador dele na cabine.",
            "Vídeo curto da máquina fazendo exatamente o serviço dele (fundação, carregamento, acabamento de estrada).",
            "Data concreta: “se fechar essa semana, ela chega na sua obra dia 25”.",
            "Visualização guiada: “imagina a equipe vendo ela descer do caminhão”.",
          ] },
          { tipo: "lista", titulo: "Sinais de que o pico chegou (hora de fechar)", itens: [
            "Cliente pergunta prazo de entrega, cor, opcionais, “vem com que implemento?”.",
            "Chama o operador ou o sócio para ver junto.",
            "Começa a falar da máquina como se fosse dele: “eu vou colocar ela na obra do bairro”.",
            "Pergunta detalhes de financiamento (parcela, entrada) sem ser provocado.",
          ] },
          { tipo: "destaque", titulo: "Regra", texto: "Sinal de compra recebido = pergunta de fechamento na hora. Não “deixe o cliente pensar”; ajude-o a decidir enquanto o desejo está no pico." },
        ],
        missao: "Nas próximas 3 conversas, anote o momento exato em que apareceu um sinal de compra e o que você fez em seguida. Se não fechou na hora, escreva o que deveria ter perguntado.",
        quiz: [
          { pergunta: "O cliente pergunta “ela chega em quanto tempo?”. Isso é:", opcoes: ["Curiosidade sem importância", "Sinal de compra — hora de fechar", "Objeção"], correta: 1, explicacao: "Perguntas de logística/posse são sinais clássicos de compra. Responda e emende a pergunta de fechamento." },
        ],
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "m4", nivel: 4, titulo: "Prospecção e abertura de portas", tema: "Prospecção", cor: "#3dffa0",
    descricao: "Como encher o funil com os clientes certos, pelo WhatsApp e no campo, sem parecer vendedor de porta em porta.",
    aulas: [
      {
        id: "m4a1", titulo: "Mapeamento de nichos e rota inteligente", minutos: 9,
        resumo: "Prospectar é escolher onde gastar o dia. Mapeie por nicho e por cidade e transforme estrada em vendas.",
        blocos: [
          { tipo: "lista", titulo: "Onde estão os compradores que você não visita", itens: [
            "Obras públicas: portais de licitação e o Diário Oficial dos municípios da sua região mostram pavimentação, drenagem e estradas vicinais licitadas — a empreiteira vencedora vai precisar de máquina em semanas.",
            "Pedreiras e britagem: cadastro de mineração (ANM) da região lista quem opera. Visite com foco em custo por tonelada.",
            "Café: cooperativas, sindicatos rurais e lojas agropecuárias são pontos de encontro; feiras e dias de campo também.",
            "Locadoras: procure anúncios de aluguel de máquinas na região — quem aluga muito precisa renovar frota.",
            "Terraplenagem: placas em obras e caminhões basculantes na estrada mostram quem está ativo. Pare, converse, deixe cartão.",
          ] },
          { tipo: "p", titulo: "Rota", texto: "Agrupe visitas por região (Granito, Caparaó, Litorânea, Serrana, Das Santas — como no CRM) e dedique um dia por semana a cada uma. Em cada rota, inclua 2 clientes ativos, 2 prospectos novos e 1 pós-venda. Prospectar sozinho cansa; misturar com atendimento mantém o dia produtivo." },
          { tipo: "destaque", titulo: "Meta de prospecção", texto: "5 novos contatos qualificados por semana enchem o funil o ano inteiro. Registre todos no CRM, mesmo os que disserem “agora não” — o Radar de reengajamento vai lembrar você." },
        ],
        missao: "Monte a rota da próxima semana com 5 prospectos novos (nome, cidade, nicho, gatilho provável). Cadastre-os no CRM antes de sair.",
        quiz: [
          { pergunta: "Qual é a fonte mais direta para prever compra de empreiteira?", opcoes: ["Redes sociais da empresa", "Licitações e Diário Oficial (obra ganha)", "Feira agropecuária"], correta: 1, explicacao: "Obra licitada e vencida = necessidade de máquina em semanas. É prospecção com data marcada." },
        ],
      },
      {
        id: "m4a2", titulo: "Primeiro contato pelo WhatsApp que gera resposta", minutos: 8,
        resumo: "A primeira mensagem define se você é “mais um vendedor” ou alguém que vale a pena responder.",
        blocos: [
          { tipo: "p", texto: "Mensagem fria genérica (“Olá, sou da New Holland, temos máquinas com condições especiais”) é ignorada. Mensagem que mostra que você conhece a realidade dele é respondida. Estrutura: quem indicou/contexto real → uma observação específica sobre a obra ou negócio dele → uma pergunta fácil de responder. Sem preço, sem catálogo, sem “segue em anexo”." },
          { tipo: "script", titulo: "Modelos por nicho", itens: [
            "Empreiteira: “Fala, João. Aqui é o Ederson, da New Holland em Cachoeiro. Vi que vocês pegaram a pavimentação do bairro X. Vão precisar de rolo ou motoniveladora pra esse trecho? Posso te ajudar com uma condição de locação-compra.”",
            "Produtor de café: “Bom dia, seu Antônio. O Carlos da cooperativa me passou seu contato. Estou atendendo produtores na região com a B95C pra estrada e terraço. Posso passar aí na fazenda semana que vem, sem compromisso?”",
            "Pedreira: “Boa tarde. Sou o Ederson, New Holland. Vi que a produção de vocês cresceu e queria entender como está a disponibilidade da escavadeira de frente de lavra. Vale 15 minutos na pedreira?”",
            "Reativação: “Fala, Marcos. Lembrei de você porque chegou a E215C nova no pátio. Como está aquela obra do condomínio? Ainda faz sentido a gente conversar?”",
          ] },
          { tipo: "lista", titulo: "Regras do primeiro contato", itens: [
            "Uma mensagem, curta, com pergunta no final. Sem PDF, sem preço.",
            "Horário: entre 7h e 9h ou 17h e 19h (antes/depois da correria da obra).",
            "Sem resposta em 2 dias: uma segunda mensagem com valor (foto de máquina trabalhando, notícia da obra). Sem resposta em mais 3 dias: ligue.",
            "Registre cada contato no CRM — a IA do Orientador acompanha a conversa dali em diante.",
          ] },
        ],
        missao: "Envie 5 primeiras mensagens nesta semana usando os modelos (adaptados com nome, obra e indicação reais). Registre no CRM quantas responderam.",
        quiz: [
          { pergunta: "O que NÃO deve ir na primeira mensagem?", opcoes: ["Uma pergunta sobre a obra", "Preço e catálogo em PDF", "O nome de quem indicou"], correta: 1, explicacao: "Preço e catálogo cedo transformam você em commodity e matam a conversa. Primeiro relação e contexto." },
        ],
      },
      {
        id: "m4a3", titulo: "Visita fria e abertura no campo", minutos: 8,
        resumo: "Chegar na obra ou na fazenda sem convite e sair com uma conversa marcada — sem incomodar.",
        blocos: [
          { tipo: "p", texto: "Visita fria funciona quando você chega como profissional que conhece o trabalho, não como panfleteiro. Estacione longe da frente de serviço, use EPI, cumprimente o encarregado antes do dono, pergunte se é um bom momento. O objetivo da visita fria NÃO é vender: é conseguir o nome do decisor, o WhatsApp e um motivo para voltar." },
          { tipo: "script", titulo: "Na obra", itens: [
            "“Bom dia, sou o Ederson, da New Holland. Passei aqui perto, vi a obra e quis conhecer. Quem cuida das máquinas por aqui?”",
            "“Essa retro tá com quantas horas? Vocês estão satisfeitos com a assistência?” (descobre dor sem ofender)",
            "“Não vim vender nada hoje. Se fizer sentido, posso mandar um vídeo da B95C fazendo esse mesmo serviço. Qual seu WhatsApp?”",
          ] },
          { tipo: "lista", titulo: "Saindo com resultado", itens: [
            "Nome e WhatsApp do decisor registrados no CRM ainda no carro.",
            "Uma dor anotada (máquina velha, assistência ruim, obra nova chegando).",
            "Um motivo de retorno combinado (mandar vídeo, voltar quando o dono estiver, trazer proposta de locação-compra).",
            "Foto da obra/máquina para lembrar o contexto na próxima conversa.",
          ] },
        ],
        missao: "Faça 3 visitas frias nesta semana em obras que você vê na estrada. Saia de cada uma com nome, WhatsApp e uma dor registrada no CRM.",
        quiz: [
          { pergunta: "Qual é o objetivo de uma visita fria?", opcoes: ["Fechar a venda na hora", "Conseguir decisor, contato e um motivo para voltar", "Entregar catálogo"], correta: 1, explicacao: "Visita fria abre a porta. A venda acontece nas visitas seguintes, com contexto." },
        ],
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "m5", nivel: 5, titulo: "Diagnóstico: SPIN e a dor em reais", tema: "Diagnóstico", cor: "#ffd23f",
    descricao: "Perguntas certas fazem o cliente vender para si mesmo. Aprenda a quantificar a dor antes de apresentar a máquina.",
    aulas: [
      {
        id: "m5a1", titulo: "SPIN Selling aplicado a máquinas pesadas", minutos: 11,
        resumo: "Situação, Problema, Implicação e Necessidade de solução — a sequência de perguntas que transforma curiosidade em urgência.",
        blocos: [
          { tipo: "lista", titulo: "As quatro famílias de perguntas (com exemplos do seu mercado)", itens: [
            "Situação: “Quantas máquinas você tem hoje? Quantas horas por mês trabalham? Qual a idade da frota?” (poucas perguntas — o cliente cansa).",
            "Problema: “Com que frequência a retro para por manutenção? Quanto tempo leva pra chegar peça? O operador reclama de quê?”.",
            "Implicação: “Quando ela para, o que acontece com a obra? Vocês alugam outra? Atrasa medição? Já perdeu contrato por causa disso?” — aqui a dor vira dinheiro.",
            "Necessidade de solução: “Se você tivesse uma máquina com assistência em 24h e consumo menor, o que mudaria no seu mês?” — o cliente descreve o benefício com as palavras dele.",
          ] },
          { tipo: "p", titulo: "Por que funciona", texto: "Perguntas de implicação fazem o cliente sentir o custo do problema; perguntas de necessidade fazem ele verbalizar a solução. Quando você apresenta a máquina depois disso, está apenas confirmando o que ele mesmo disse. A resistência cai porque a ideia é dele." },
          { tipo: "script", titulo: "Sequência completa (retroescavadeira)", itens: [
            "S: “Hoje você faz a fundação com a retro antiga e aluga quando aperta?”",
            "P: “Quantas vezes por mês ela para? E o aluguel, quanto sai por dia?”",
            "I: “Então, em um mês ruim, entre aluguel e dia parado, dá quanto? Uns R$ 8 mil? E o cliente da obra, cobra atraso?”",
            "N: “Se você tivesse uma máquina nova, com garantia e peça em 24h, quanto disso você economizaria? E o que faria com a obra andando no ritmo certo?”",
          ] },
        ],
        missao: "Escolha um cliente com máquina antiga e conduza a sequência SPIN completa na próxima conversa. Anote a resposta da pergunta de Implicação (o valor em R$) no cadastro do cliente.",
        quiz: [
          { pergunta: "Qual tipo de pergunta transforma o problema em urgência?", opcoes: ["Situação", "Implicação", "Necessidade"], correta: 1, explicacao: "Implicação mostra as consequências (dinheiro, prazo, contrato). É onde nasce a urgência." },
          { pergunta: "Por que fazer poucas perguntas de Situação?", opcoes: ["Porque cansam o cliente e não geram valor", "Porque são proibidas", "Porque o cliente não sabe responder"], correta: 0, explicacao: "Situação é levantamento; faça o mínimo e vá para Problema e Implicação, onde a venda acontece." },
        ],
      },
      {
        id: "m5a2", titulo: "A conta que vende: custo por hora e retorno do investimento", minutos: 10,
        resumo: "Quem faz a conta com o cliente não briga por preço. Aprenda a montar o custo/hora e o payback em 5 minutos.",
        blocos: [
          { tipo: "p", titulo: "Custo por hora de uma máquina", texto: "Parcela ou depreciação + combustível + manutenção + operador, dividido pelas horas trabalhadas no mês. Exemplo simplificado de uma retro: parcela R$ 9.000 + diesel R$ 4.500 (150 h × 5 L × R$ 6) + manutenção R$ 800 + operador R$ 4.000 = R$ 18.300 / 150 h ≈ R$ 122/hora. Uma máquina antiga com consumo maior e 30 h/mês paradas pode custar mais por hora produzida mesmo “sem parcela”." },
          { tipo: "p", titulo: "Retorno", texto: "Se a máquina nova fatura R$ 250/hora em serviço (ou economiza aluguel de R$ 1.200/dia), o cliente vê em quantos meses o investimento se paga. Mostre a conta em uma folha, com os números DELE — não com os seus. O Simulador do CRM ajuda; mas a conta de padaria, feita na frente do cliente, convence mais." },
          { tipo: "lista", titulo: "Números que você deve ter na ponta da língua", itens: [
            "Consumo médio por hora de cada modelo próprio (ficha técnica verificada).",
            "Diária de aluguel de retro, escavadeira e rolo na região.",
            "Valor médio de hora de serviço que empreiteiras cobram na região.",
            "Parcela aproximada por faixa de valor (Finame, consórcio, CRD).",
          ] },
          { tipo: "destaque", titulo: "Frase-chave", texto: "“Não estou te pedindo pra gastar R$ 480 mil. Estou te mostrando como ganhar R$ 30 mil por mês a mais com a mesma equipe.”" },
        ],
        missao: "Monte a conta de custo/hora e payback para um cliente real do funil, com os números dele. Apresente na próxima visita e registre a reação no CRM.",
        quiz: [
          { pergunta: "O que compõe o custo por hora de uma máquina?", opcoes: ["Só o diesel", "Parcela/depreciação + combustível + manutenção + operador", "Só a parcela"], correta: 1, explicacao: "Sem operador e manutenção a conta mente — e a máquina velha parece mais barata do que é." },
        ],
      },
      {
        id: "m5a3", titulo: "Qualificação: quem vale seu tempo (BANT do interior)", minutos: 7,
        resumo: "Nem todo interessado é cliente. Qualifique cedo para investir onde há orçamento, decisão e prazo.",
        blocos: [
          { tipo: "lista", titulo: "As quatro perguntas de qualificação", itens: [
            "Budget (orçamento): “Você pensa em financiar, consórcio ou recurso próprio? Já conversou com o banco?” — sem caminho de pagamento não há venda.",
            "Authority (decisão): “Quem bate o martelo?” — mapeado no módulo de psicologia.",
            "Need (necessidade): “Máquina nova ou substituição? Qual serviço específico?” — necessidade real e não “estou olhando”.",
            "Timing (prazo): “Pra quando você precisa da máquina trabalhando?” — obra com data é prioridade.",
          ] },
          { tipo: "p", titulo: "Classificando", texto: "Quente: orçamento definido + decisor identificado + necessidade clara + prazo em até 60 dias. Morno: falta um dos quatro. Frio: falta dois ou mais — mantenha relacionamento leve e reengaje quando mudar. Registre a temperatura na negociação do CRM; o Orientador de Vendas também estima por IA." },
          { tipo: "destaque", titulo: "Cuidado", texto: "O “interessado eterno” consome visitas e proposta e nunca fecha. Se depois de duas conversas ele não tem orçamento nem prazo, mude a frequência para contato mensal e invista em quem tem." },
        ],
        missao: "Reclassifique todo o funil (quente/morno/frio) pelas quatro perguntas. Mova para contato mensal quem não tem orçamento nem prazo.",
        quiz: [
          { pergunta: "Um cliente adora a máquina, mas não tem banco, sócio contra e obra só ano que vem. Ele é:", opcoes: ["Quente", "Morno", "Frio — relacionamento leve e reengajar depois"], correta: 2, explicacao: "Sem orçamento, decisão e prazo, o esforço agora não converte. Cuide da relação e volte no momento certo." },
        ],
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "m6", nivel: 6, titulo: "Apresentação de valor e demonstração", tema: "Valor", cor: "#ff9f43",
    descricao: "Como apresentar a máquina certa, comparar com a concorrência com ética e usar a demonstração como fechamento.",
    aulas: [
      {
        id: "m6a1", titulo: "A proposta que vende sozinha", minutos: 9,
        resumo: "Proposta boa é a que o sócio lê sem você do lado e entende por que vale a pena. Estrutura, ordem e o que nunca pode faltar.",
        blocos: [
          { tipo: "lista", titulo: "Estrutura da proposta (nesta ordem)", itens: [
            "1. Resumo do que o cliente disse: obra/serviço, problema atual e o que ele quer resolver (com as palavras dele — mostra que você ouviu).",
            "2. A solução: modelo, configuração, por que esse e não outro para a aplicação dele.",
            "3. O retorno: custo/hora, economia de aluguel/diesel, produtividade — a conta feita com os números dele.",
            "4. Segurança: garantia, rede de peças/assistência na região, treinamento de operador, entrega técnica.",
            "5. Condição: valor, formas (Finame, consórcio, CRD, entrada + saldo), prazo de entrega, validade da proposta.",
            "6. Próximo passo: “para reservar a máquina do pátio, assinamos até dia X”.",
          ] },
          { tipo: "p", titulo: "Erros que matam proposta", texto: "Começar pelo preço; enviar só a ficha técnica; mandar PDF genérico da fábrica; sem validade (o cliente deixa para depois); sem o retorno em reais (vira comparação de preço). Envie sempre com uma mensagem pessoal e marque a hora de revisar juntos — proposta enviada sem conversa marcada tem metade da chance." },
          { tipo: "destaque", titulo: "Validade real", texto: "Toda proposta com validade curta e verdadeira (tabela, estoque, condição do banco). Sem validade não há urgência; com validade falsa não há confiança." },
        ],
        missao: "Reescreva a última proposta que você enviou na estrutura de 6 blocos. Compare com a original e anote o que faltava.",
        quiz: [
          { pergunta: "Como começa uma proposta forte?", opcoes: ["Pelo preço e desconto", "Pelo resumo do problema e objetivo do cliente", "Pela ficha técnica completa"], correta: 1, explicacao: "Quem começa mostrando que entendeu o cliente já está vendendo. Preço vem depois do valor." },
        ],
      },
      {
        id: "m6a2", titulo: "Comparando com a concorrência sem depreciar", minutos: 9,
        resumo: "Caterpillar, JCB, Case, Komatsu, XCMG, Sany: cada uma tem um argumento. Vença por fatos e por adequação, nunca por desdém.",
        blocos: [
          { tipo: "p", texto: "Falar mal do concorrente faz o cliente defender a outra marca — e faz você parecer inseguro. Compare por critério: aplicação, consumo, disponibilidade de peças na região, valor de revenda, condição de financiamento, rede. Use o Comparativo do CRM (fichas verificadas) e traga o cliente para a conclusão." },
          { tipo: "lista", titulo: "Argumentos por concorrente (com ética)", itens: [
            "Marcas chinesas (XCMG, Sany, LiuGong): preço de entrada menor. Responda com custo total de propriedade: peças, revenda, assistência local, consumo. “Máquina é o que ela custa em 5 anos, não no dia da compra.”",
            "Caterpillar/Komatsu: marca forte, preço alto. Responda com condição, entrega, proximidade da concessionária e relação direta com você.",
            "JCB/Case: produto próximo. Responda com o diferencial específico do modelo (ex.: cabine da motoniveladora no chassi traseiro, hidráulica da série C) e com o atendimento pós-venda na região.",
            "Usada/importada: risco de horímetro, garantia zero, financiamento difícil. Ofereça a nova com Finame e a avaliação da usada dele na troca.",
          ] },
          { tipo: "script", titulo: "Quando o cliente diz “a marca X é melhor”", itens: [
            "“É uma boa máquina, respeito. O que você mais gosta nela?” (descobre o critério real)",
            "“Nesse ponto a nossa entrega Y; e além disso você tem Z aqui em Cachoeiro. Pode ver nesse comparativo — o que pesa mais pra sua obra?”",
          ] },
        ],
        missao: "Escolha o concorrente que mais aparece nas suas negociações e monte, com o Comparativo do CRM, três argumentos factuais por critério (custo total, rede, aplicação). Decore.",
        quiz: [
          { pergunta: "O cliente diz que a marca chinesa é R$ 100 mil mais barata. Melhor resposta:", opcoes: ["“Máquina chinesa é ruim.”", "Comparar custo total em 5 anos: peças, revenda, assistência, consumo", "Dar R$ 100 mil de desconto"], correta: 1, explicacao: "Depreciar perde; desconto destrói margem. Custo total de propriedade ganha com fatos." },
        ],
      },
      {
        id: "m6a3", titulo: "Demonstração e entrega técnica como ferramenta de venda", minutos: 8,
        resumo: "A máquina trabalhando na obra do cliente vende mais que qualquer argumento. Planeje a demonstração para terminar em fechamento.",
        blocos: [
          { tipo: "lista", titulo: "Roteiro da demonstração", itens: [
            "Combine o serviço real que ele faz (não uma “voltinha”): carregar caminhão, abrir vala, acabar um trecho de estrada.",
            "Operador dele na cabine, com você orientando. Ele precisa sentir a máquina.",
            "Meça algo: caçambas por hora, tempo de ciclo, consumo em 1 hora. Anote na frente do cliente.",
            "Compare com a máquina atual dele (que está ali do lado).",
            "Encerre com pergunta de fechamento: “Você viu o que ela faz. O que falta pra ela ficar aqui?”.",
          ] },
          { tipo: "p", titulo: "Entrega técnica", texto: "Depois da venda, a entrega técnica (treinamento do operador, revisão dos itens de manutenção, contato de assistência) é o primeiro passo do pós-venda e a maior fonte de indicação. Registre no Pós-venda do CRM que foi feita; cliente bem entregue indica vizinho." },
        ],
        missao: "Agende uma demonstração real na obra de um cliente morno. Meça produtividade na frente dele e termine com a pergunta de fechamento.",
        quiz: [
          { pergunta: "Como terminar uma demonstração?", opcoes: ["Agradecendo e indo embora", "Com uma pergunta de fechamento", "Entregando o catálogo"], correta: 1, explicacao: "O pico de desejo é ali. Pergunte o que falta para a máquina ficar." },
        ],
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "m7", nivel: 7, titulo: "Contorno de objeções", tema: "Objeções", cor: "#ff5c7a",
    descricao: "Método para transformar cada objeção em avanço, e as respostas para as objeções mais duras do seu mercado.",
    aulas: [
      {
        id: "m7a1", titulo: "O método: acolher, isolar, reenquadrar, confirmar", minutos: 9,
        resumo: "Objeção não é rejeição — é o cliente pedindo mais motivo para dizer sim. Um método de 4 passos para qualquer objeção.",
        blocos: [
          { tipo: "lista", titulo: "Os 4 passos", itens: [
            "Acolher: “Entendo, faz sentido pensar nisso.” — nunca rebata na hora; o cérebro do cliente precisa se sentir ouvido para ouvir você.",
            "Isolar: “Além do preço, tem mais alguma coisa que te impede de fechar?” — descobre se é a objeção real ou a desculpa.",
            "Reenquadrar: responda com fato, conta ou prova social, mudando o critério (preço → custo total; tempo → custo de esperar).",
            "Confirmar: “Isso resolve a sua dúvida? Então podemos seguir?” — feche o ciclo e avance para o fechamento.",
          ] },
          { tipo: "p", titulo: "Objeção real x cortina de fumaça", texto: "“Vou pensar” e “está caro” quase sempre escondem outra coisa: medo de errar, falta de crédito, sócio contra, preferência por outra marca. A pergunta de isolamento (“se o preço fosse igual ao do concorrente, fecharia hoje?”) revela a verdade. Só responda a objeção real." },
          { tipo: "script", titulo: "Exemplo completo — “está caro”", itens: [
            "Acolher: “Entendo. É um investimento alto mesmo, e você tem que ter certeza.”",
            "Isolar: “Se a gente resolver a questão do valor, tem mais alguma coisa que te segura? Ou é só isso?”",
            "Reenquadrar: “Então vamos olhar o custo por hora e não o preço: com o consumo e a disponibilidade dela, você paga a diferença em X meses. Aqui a conta com os seus números.”",
            "Confirmar: “Fazendo sentido essa conta, a gente fecha com a parcela que combinamos?”",
          ] },
        ],
        missao: "Nas próximas 5 objeções que ouvir, aplique conscientemente os 4 passos. Anote no CRM qual era a objeção real por trás da primeira.",
        quiz: [
          { pergunta: "O que faz o passo “isolar”?", opcoes: ["Rebate a objeção com argumento", "Descobre se é a objeção real ou se há outra por trás", "Muda de assunto"], correta: 1, explicacao: "Sem isolar, você responde a desculpa e a objeção real continua escondida." },
          { pergunta: "Por que acolher antes de responder?", opcoes: ["Para ganhar tempo", "Porque o cliente só ouve depois de se sentir ouvido", "Não precisa acolher"], correta: 1, explicacao: "Rebater na hora ativa defesa. Acolher abre o canal." },
        ],
      },
      {
        id: "m7a2", titulo: "As objeções mais duras do seu mercado (e as respostas)", minutos: 12,
        resumo: "Preço vs. chinesa, “vou alugar”, financiamento negado, “já tenho fornecedor”, “vou esperar a safra”. Respostas prontas e adaptáveis.",
        blocos: [
          { tipo: "script", titulo: "“A chinesa é R$ 100 mil mais barata”", itens: [
            "“Entendo, e o preço de entrada é menor mesmo. Posso te mostrar a conta de 5 anos? Peça, assistência aqui na região, consumo e o quanto ela vale na revenda. Na maioria dos casos a diferença some no segundo ano — e você não fica na mão com máquina parada esperando peça de fora.”",
          ] },
          { tipo: "script", titulo: "“Prefiro alugar”", itens: [
            "“Faz sentido pra serviço curto. Quantos meses por ano você aluga? [12] Então você paga uns R$ X por ano e no fim não tem nada. Com a parcela em Y, a máquina é sua, faz o mesmo serviço e ainda tem valor de revenda. Quer ver a comparação lado a lado?”",
          ] },
          { tipo: "script", titulo: "“O banco negou / meu limite não dá”", itens: [
            "“Vamos ver por outro caminho: consórcio com lance, CRD, entrada com a sua usada na troca, ou outro banco parceiro. Me passa o que o banco pediu que eu monto a proposta certa — resolver financiamento é parte do meu trabalho.”",
          ] },
          { tipo: "script", titulo: "“Já tenho fornecedor / sou fiel à marca X”", itens: [
            "“Respeito, e fidelidade é boa coisa. Não estou pedindo pra trocar tudo: só que na próxima máquina você compare de igual pra igual. Posso te mandar a proposta pra você ter como referência? Se o seu fornecedor fizer melhor, ótimo pra você.”",
          ] },
          { tipo: "script", titulo: "“Vou esperar a safra / o próximo projeto”", itens: [
            "“Combinado. Só pra você ter na mão: a condição de hoje vale até dia X e a máquina do pátro pode sair. Se eu conseguir segurar a tabela e uma carência até a safra, faz sentido a gente assinar agora e você pagar quando o café entrar?”",
          ] },
          { tipo: "script", titulo: "“Manutenção da New Holland é cara”", itens: [
            "“Comparado com o quê? Vamos olhar o plano de revisões e o preço das peças de maior giro. E o mais importante: quanto custa a máquina parada esperando peça — aqui você tem estoque e assistência em Cachoeiro.”",
          ] },
          { tipo: "destaque", titulo: "Biblioteca", texto: "As 10 objeções clássicas com resposta completa estão na aba Biblioteca › Objeções. Decore as cinco acima primeiro: são as que mais aparecem nas conversas do WhatsApp (o Orientador de Vendas do CRM marca qual apareceu em cada negociação)." },
        ],
        missao: "Grave um áudio seu respondendo cada uma das 6 objeções acima como se fosse para um cliente real. Ouça e ajuste até soar natural.",
        quiz: [
          { pergunta: "Cliente diz que prefere alugar 12 meses por ano. Melhor caminho:", opcoes: ["Dizer que alugar é jogar dinheiro fora", "Comparar o gasto anual de aluguel com a parcela e o patrimônio que fica", "Desistir"], correta: 1, explicacao: "A conta, feita com os números dele, mostra que ele já paga uma máquina sem ficar com ela." },
          { pergunta: "Financiamento negado. O que você faz?", opcoes: ["Encerra a negociação", "Abre caminhos alternativos: consórcio, CRD, usada na troca, outro banco", "Pede para ele resolver com o banco"], correta: 1, explicacao: "Resolver o financiamento é parte da venda de alto valor. Quem resolve, fecha." },
        ],
      },
      {
        id: "m7a3", titulo: "Prevenção: matando a objeção antes de ela nascer", minutos: 7,
        resumo: "As melhores objeções são as que nunca aparecem. Antecipe-as na apresentação.",
        blocos: [
          { tipo: "p", texto: "Se você sabe que “está caro” vai vir, apresente o custo total antes do preço. Se sabe que “vou pensar” vai vir, combine o processo de decisão no início (“vamos fazer assim: hoje eu mostro, quinta a gente revisa a proposta com seu sócio e sexta você decide — pode ser?”). Objeção prevista na apresentação vira ponto de concordância, não de resistência." },
          { tipo: "lista", titulo: "Vacinas por objeção", itens: [
            "Preço: ancore no valor produzido e no custo total antes de citar o número.",
            "“Vou pensar”: acorde o cronograma de decisão na abertura.",
            "Sócio: convide o sócio para a apresentação desde o começo.",
            "Concorrente: leve o comparativo antes de ele pedir.",
            "Financiamento: pergunte o caminho de pagamento na qualificação, não no fechamento.",
          ] },
        ],
        missao: "Escreva as 3 objeções que você mais ouve e, para cada uma, a “vacina” que você vai colocar no início da próxima apresentação.",
        quiz: [
          { pergunta: "Como prevenir o “vou pensar”?", opcoes: ["Dar desconto", "Combinar o cronograma de decisão no início da conversa", "Não dar tempo ao cliente"], correta: 1, explicacao: "Processo combinado vira compromisso. O “vou pensar” perde espaço." },
        ],
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "m8", nivel: 8, titulo: "Fechamentos agressivos (com ética)", tema: "Fechamento", cor: "#ff3ea5",
    descricao: "Postura, sequência e as técnicas de fechamento de alta pressão que funcionam em máquinas pesadas — sem queimar a relação.",
    aulas: [
      {
        id: "m8a1", titulo: "Postura de fechador: pedir a venda sem medo", minutos: 8,
        resumo: "A maioria das vendas se perde porque o vendedor não pede. Aprenda a pedir de forma direta, calma e repetida.",
        blocos: [
          { tipo: "p", texto: "Fechar agressivamente não é gritar nem enganar — é ter a coragem de pedir a decisão, sustentar o silêncio e pedir de novo quando a resposta é “deixa eu ver”. O cliente de máquina pesada respeita quem conduz. Pedir a venda três vezes na mesma conversa, de formas diferentes, é normal e esperado neste mercado." },
          { tipo: "lista", titulo: "Princípios", itens: [
            "Assuma que vai fechar: fale de entrega, cor e treinamento como se já estivesse decidido.",
            "Pergunte e cale a boca: depois da pergunta de fechamento, quem fala primeiro perde. Sustente o silêncio.",
            "Tenha sempre um “sim pequeno” disponível: reservar a máquina, assinar a proposta, mandar os documentos pro banco.",
            "Cada “não” recebe uma pergunta: “o que precisa acontecer pra virar sim?”.",
            "Registre o compromisso: data, valor, próximo passo — no CRM e na frente do cliente.",
          ] },
          { tipo: "script", titulo: "Sequência de 3 pedidos na mesma conversa", itens: [
            "1º (assumido): “Então, pra entregar dia 25, eu preciso dos documentos até quinta. Manda hoje pra eu adiantar?”",
            "2º (alternativo, após hesitação): “Prefere a parcela em 60 com entrada da usada ou em 48 sem entrada? Qualquer uma eu fecho hoje.”",
            "3º (condicional): “Se eu segurar a tabela de hoje e conseguir a carência de 90 dias, você assina agora?”",
          ] },
        ],
        missao: "Na próxima negociação quente, peça a venda 3 vezes na mesma conversa, com técnicas diferentes. Registre no CRM qual pedido destravou.",
        quiz: [
          { pergunta: "Depois de fazer a pergunta de fechamento, o que fazer?", opcoes: ["Explicar mais benefícios", "Ficar em silêncio e esperar a resposta", "Oferecer desconto"], correta: 1, explicacao: "O silêncio pressiona sem agredir. Quem fala primeiro entrega a decisão ao outro." },
        ],
      },
      {
        id: "m8a2", titulo: "As 8 técnicas de fechamento de alta pressão", minutos: 12,
        resumo: "Assumido, alternativo, condicional, urgência real, resumo de valor, takeaway, Colombo e balanço. Quando usar cada uma.",
        blocos: [
          { tipo: "lista", titulo: "Técnicas e frases", itens: [
            "Assumido — “Vou reservar a azul do pátio no seu nome e agendar a entrega técnica pra segunda. Certo?” Use quando os sinais de compra estão claros.",
            "Alternativo — “Finame em 60 ou consórcio com lance? Qual fica melhor no seu caixa?” Use com perfil D e quando falta só decidir a forma.",
            "Condicional (“se… então”) — “Se eu conseguir incluir o rompedor, fecha hoje?” Só ofereça o que você consegue; e cobre o “sim” antes de conceder.",
            "Urgência real — “Essa condição do banco vale até dia 30 e tenho uma unidade no pátio; depois disso é 45 dias de fábrica.” Só com fatos verdadeiros.",
            "Resumo de valor — “Recapitulando: menos R$ 4 mil de diesel, assistência em 24h, garantia, parcela dentro do que você produz. Sobrou algum motivo pra não fechar?”",
            "Takeaway (retirada) — “Se não é o momento, sem problema — eu tenho outro cliente interessado nessa unidade. Prefere que eu libere pra ele?” Use quando o cliente enrola; a perda desperta decisão.",
            "Colombo (“só mais uma coisa”) — na saída, quando ele relaxou: “Ah, só mais uma coisa: se eu conseguir entregar antes do começo da obra, resolve?” Reabre o fechamento sem pressão.",
            "Balanço (Ben Franklin) — para perfil C: liste prós e contras no papel, com ele, e deixe os prós falarem.",
          ] },
          { tipo: "destaque", titulo: "Agressivo ≠ desonesto", texto: "Pressão é sobre ritmo e clareza, nunca sobre mentira. Urgência inventada e concessão fingida quebram a confiança — e no interior a notícia corre. Seja duro no processo e correto nos fatos." },
          { tipo: "p", titulo: "Combinando técnicas", texto: "A sequência clássica em máquina pesada: resumo de valor → assumido → (hesitação) alternativo → (hesitação) condicional → (enrolação) takeaway. Cada passo eleva a pressão um degrau. Pare quando o cliente der um “sim pequeno” e execute-o imediatamente (documentos, assinatura, reserva)." },
        ],
        missao: "Escolha 3 técnicas que você nunca usou e aplique cada uma em uma negociação diferente esta semana. Anote no CRM o resultado de cada tentativa.",
        quiz: [
          { pergunta: "O cliente enrola há semanas e você tem outro interessado na unidade. Técnica indicada:", opcoes: ["Resumo de valor", "Takeaway (retirada)", "Balanço"], correta: 1, explicacao: "A possibilidade real de perder a máquina desperta a decisão em quem enrola." },
          { pergunta: "O que torna o fechamento por urgência ético?", opcoes: ["Ser dito com firmeza", "A urgência ser verdadeira (estoque, tabela, banco)", "Repetir três vezes"], correta: 1, explicacao: "Urgência falsa destrói a confiança. Verdadeira é ferramenta legítima." },
        ],
      },
      {
        id: "m8a3", titulo: "Concessões e o fechamento do valor", minutos: 8,
        resumo: "Desconto sem contrapartida ensina o cliente a pedir mais. Como negociar mantendo margem e fechando mais rápido.",
        blocos: [
          { tipo: "lista", titulo: "Regras de concessão", itens: [
            "Nunca dê desconto sem pedir algo em troca: fechar hoje, entrada maior, indicação, a usada na troca, pagamento à vista.",
            "Conceda em coisas que custam pouco e valem muito: entrega técnica reforçada, treinamento extra, prazo de entrega, primeira revisão.",
            "Diminua as concessões: a primeira maior, as seguintes menores — o cliente sente que chegou no limite.",
            "Tenha o “não” pronto: “Esse já é o melhor que consigo; o que posso fazer é X”.",
          ] },
          { tipo: "script", titulo: "Trocando concessão por fechamento", itens: [
            "“Consigo melhorar em R$ 8 mil se fecharmos hoje e a usada entrar na troca. Fechado?”",
            "“Desconto não tenho, mas coloco a primeira revisão e o treinamento do operador. Isso resolve?”",
          ] },
          { tipo: "destaque", titulo: "Margem é seu salário", texto: "Cada R$ 10 mil de desconto desnecessário é comissão sua indo embora e cliente aprendendo que basta insistir. Negocie valor, não preço." },
        ],
        missao: "Na próxima negociação de valor, faça uma concessão apenas com contrapartida explícita e registre no CRM o que você recebeu em troca.",
        quiz: [
          { pergunta: "O cliente pede desconto. Melhor resposta:", opcoes: ["“Posso dar 5%.”", "“Consigo melhorar se fecharmos hoje com a usada na troca.”", "“Não dou desconto.”"], correta: 1, explicacao: "Concessão sempre com contrapartida. Assim o desconto vira ferramenta de fechamento, não de erosão." },
        ],
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "m9", nivel: 9, titulo: "Negociação, financiamento e velocidade", tema: "Negociação", cor: "#9d6bff",
    descricao: "O financiamento é onde a maioria das vendas de máquina morre ou nasce. Domine as ferramentas e acelere o fechamento.",
    aulas: [
      {
        id: "m9a1", titulo: "Financiamento como ferramenta de fechamento", minutos: 10,
        resumo: "Finame/BNDES, bancos parceiros, consórcio, CRD, crédito rural: cada instrumento fecha um tipo de cliente.",
        blocos: [
          { tipo: "lista", titulo: "Instrumentos e quando usar", itens: [
            "Finame/BNDES via banco: prazo longo e juros competitivos para empresa com CNPJ ativo e faturamento; exige documentação em dia. Ideal para construtoras e empreiteiras.",
            "Banco parceiro da marca (CNH Capital / bancos comerciais): aprovação mais rápida, campanhas com taxa reduzida. Use as campanhas como urgência real.",
            "Consórcio (New Holland e outros): sem juros, com lance; bom para quem planeja e para produtor de café com safra futura. Fecha o cliente que “não tem pressa” e mantém ele no seu funil.",
            "CRD PME e linhas regionais: para pequeno empreiteiro sem histórico bancário longo. Registre as parcelas no CRM (a comissão depende disso).",
            "Crédito rural (Pronaf/Pronamp/Moderfrota): produtor de café — taxas subsidiadas, calendário de safra. Trabalhe com o agrônomo/cooperativa na documentação.",
            "Usada na troca: reduz a entrada e resolve o “o que faço com a antiga”. Avalie rápido e com critério (o Máquinas Usadas do CRM registra).",
          ] },
          { tipo: "p", titulo: "Documentação = velocidade", texto: "Peça a documentação no dia do “sim”, não depois. Tenha a lista pronta (contrato social, faturamento, IR, certidões, comprovantes) e ajude o cliente a reunir. Cada dia de atraso na análise esfria o desejo e abre espaço para o concorrente. Meta: proposta aprovada em até 7 dias." },
          { tipo: "destaque", titulo: "Frase", texto: "“Não vendo máquina, vendo parcela que cabe no que a máquina produz.” Quando a parcela é menor que o ganho mensal, a decisão vira óbvia." },
        ],
        missao: "Monte uma tabela com os 4 instrumentos que você mais usa: taxa aproximada, prazo, documentos e perfil ideal. Cole no seu celular.",
        quiz: [
          { pergunta: "Cliente produtor de café, safra em 4 meses, sem pressa. Instrumento mais indicado:", opcoes: ["Consórcio com lance / crédito rural", "À vista", "Nenhum, esperar"], correta: 0, explicacao: "Consórcio e crédito rural respeitam o calendário da safra e mantêm o cliente fechado com você." },
        ],
      },
      {
        id: "m9a2", titulo: "Negociação de valor: ganhar sem ceder", minutos: 9,
        resumo: "Princípios de negociação de elite aplicados à mesa do cliente: BATNA, ancoragem, pacote e o poder do “não”.",
        blocos: [
          { tipo: "lista", titulo: "Antes de sentar", itens: [
            "Sua BATNA (melhor alternativa): outro cliente para a unidade, campanha que termina. Quem tem alternativa negocia calmo.",
            "A BATNA dele: alugar, comprar usada, esperar. Descubra e mostre o custo de cada alternativa.",
            "Seu limite real e o que você pode conceder (do módulo anterior).",
            "Pacote: negocie tudo junto (valor, entrada, prazo, entrega, implementos), nunca item por item.",
          ] },
          { tipo: "p", titulo: "Na mesa", texto: "Ancore primeiro com a proposta cheia. Ouça o pedido e pergunte “o que precisa acontecer pra gente fechar hoje?” — faça o cliente dizer o preço dele. Responda com pacote, não com desconto seco. Use o silêncio. Quando chegar no limite, diga “não” com calma e ofereça o caminho alternativo. Cliente respeita quem sabe dizer não." },
          { tipo: "script", titulo: "Frases de mesa", itens: [
            "“Entendo o pedido. Se eu fizer isso, o que você faz por mim? Fecha hoje? Traz a usada?”",
            "“Esse valor não consigo. O que consigo é: entrega em 10 dias e primeira revisão inclusa. Fechamos assim?”",
            "“Vamos olhar o pacote inteiro em vez de cada item — assim eu consigo te ajudar de verdade.”",
          ] },
        ],
        missao: "Antes da próxima negociação de valor, escreva sua BATNA, a do cliente e o pacote completo que você vai propor. Leve no bolso.",
        quiz: [
          { pergunta: "O que é negociar em pacote?", opcoes: ["Dar vários descontos", "Negociar valor, prazo, entrega e implementos juntos, com trocas", "Vender dois equipamentos"], correta: 1, explicacao: "Item a item o cliente ganha em cada um. Em pacote você troca o que custa pouco pelo que vale muito." },
        ],
      },
      {
        id: "m9a3", titulo: "Do “sim” ao faturamento: velocidade e follow-up", minutos: 7,
        resumo: "A venda só existe quando fatura. Processo, prazos e o acompanhamento que evita o arrependimento do comprador.",
        blocos: [
          { tipo: "lista", titulo: "Checklist pós-“sim”", itens: [
            "Mesmo dia: proposta assinada + lista de documentos enviada + negociação movida para a coluna correta no CRM.",
            "48 h: documentos no banco; cliente informado do prazo de análise.",
            "A cada 2 dias: um contato curto com novidade (“banco pediu X”, “aprovado, agora é a nota”). Silêncio gera arrependimento.",
            "Aprovação: agende a entrega técnica na hora e confirme com o operador.",
            "Faturamento: registre a data no CRM — é o que alimenta o Pós-venda e os marcos de 30/60/180/365 dias.",
          ] },
          { tipo: "p", titulo: "Arrependimento do comprador", texto: "Entre o “sim” e a entrega, o cliente ouve o cunhado, o concorrente liga, o banco demora. Sua presença constante nesse período — com informação e segurança — é o que garante que o “sim” vire faturamento. Um cliente bem acompanhado aqui vira indicação depois." },
        ],
        missao: "Para cada negociação em análise de crédito, defina hoje a data do próximo contato (máximo 2 dias) e registre no CRM.",
        quiz: [
          { pergunta: "Quanto tempo no máximo entre contatos durante a análise de crédito?", opcoes: ["Uma semana", "Dois dias", "Só quando o banco responder"], correta: 1, explicacao: "Silêncio abre espaço para arrependimento e concorrente. Contato curto e frequente segura a venda." },
        ],
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "m10", nivel: 10, titulo: "Mestre: pós-venda, indicação e escala", tema: "Mestre", cor: "#ffd23f",
    descricao: "Como transformar clientes em vendedores, montar a rotina de alta performance e crescer a carteira todo ano.",
    aulas: [
      {
        id: "m10a1", titulo: "Pós-venda como máquina de vendas", minutos: 8,
        resumo: "O cliente que comprou é o seu melhor prospecto: compra de novo, compra peça e indica. Sistematize.",
        blocos: [
          { tipo: "lista", titulo: "Marcos (o CRM avisa cada um)", itens: [
            "Entrega técnica: registre e tire foto com a equipe do cliente (prova social futura).",
            "30 dias: ligação — adaptação, horas, dúvidas, primeira manutenção.",
            "60 dias: satisfação e oferta de peças de desgaste/consumíveis.",
            "6 meses: revisão preventiva agendada.",
            "1 ano: aniversário da compra, sondar segunda máquina/implemento, pedir indicação.",
          ] },
          { tipo: "p", titulo: "Cliente que indica", texto: "Peça indicação no momento de satisfação (entrega bem feita, problema resolvido rápido). Seja específico: “você conhece alguém em Alegre que esteja com máquina cansada?”. Registre a indicação no CRM (campo “indicado por”) e agradeça com algo real (visita, brinde, prioridade na assistência)." },
        ],
        missao: "Abra o Pós-venda do CRM, resolva todos os marcos pendentes esta semana e peça uma indicação para cada cliente satisfeito que contatar.",
        quiz: [
          { pergunta: "Quando pedir indicação?", opcoes: ["No dia da venda", "Num momento de satisfação comprovada (entrega, problema resolvido)", "Nunca, incomoda"], correta: 1, explicacao: "Indicação nasce da satisfação. Peça específico, na hora certa, e registre." },
        ],
      },
      {
        id: "m10a2", titulo: "Rotina de alta performance e métricas", minutos: 8,
        resumo: "O vendedor mestre não depende de motivação: depende de rotina, números e revisão semanal.",
        blocos: [
          { tipo: "lista", titulo: "Semana modelo", itens: [
            "Segunda: planejamento — funil, próximas ações, rota da semana, 5 prospectos novos cadastrados.",
            "Terça a quinta: campo — 4 a 5 visitas/dia por região, WhatsApp respondido nos intervalos (a IA do CRM adianta).",
            "Sexta: propostas e financiamento — enviar, revisar com clientes, cobrar bancos; fechar o que está maduro.",
            "Sábado de manhã: pós-venda e indicações — ligações curtas, marcos do CRM.",
            "Diário: 20 minutos de estudo (uma aula desta trilha ou a biblioteca).",
          ] },
          { tipo: "p", titulo: "Métricas que importam", texto: "Contatos novos/semana, visitas/semana, propostas/semana, taxa de conversão por etapa, ticket médio, ciclo médio (dias do contato ao faturamento). O Dashboard mostra vendas, visitas e novos negócios; compare toda segunda com a semana anterior. Se a conversão de proposta para fechamento cai, o problema está nos módulos 7–9; se faltam propostas, está nos módulos 4–6." },
          { tipo: "destaque", titulo: "Meta anual", texto: "40 máquinas no ano = 3,3 por mês = 1 por semana em média. Uma venda por semana precisa de ~5 propostas ativas e ~15 visitas semanais. Trabalhe a atividade; o número vem." },
        ],
        missao: "Monte sua semana modelo na agenda do celular com blocos fixos. Na próxima segunda, compare as métricas do Dashboard com a semana anterior e escreva uma ação de correção.",
        quiz: [
          { pergunta: "Conversão de proposta para fechamento caiu. Onde revisar?", opcoes: ["Prospecção (módulo 4)", "Objeções, fechamento e financiamento (módulos 7–9)", "Ficha técnica"], correta: 1, explicacao: "Propostas existem, fechamento não vem: o gargalo está na fase final do funil." },
        ],
      },
      {
        id: "m10a3", titulo: "Escala: território, parcerias e marca pessoal", minutos: 8,
        resumo: "Como crescer a carteira todo ano sem trabalhar o dobro: parcerias locais, presença digital e método replicável.",
        blocos: [
          { tipo: "lista", titulo: "Alavancas de escala", itens: [
            "Parcerias: contadores, agrônomos, engenheiros, lojas de peças, cooperativas — quem atende seu cliente antes de você. Combine indicação mútua.",
            "Presença digital local: fotos de entregas e máquinas trabalhando na região (com permissão), nos grupos e redes onde o seu cliente está. Prova social contínua.",
            "Clientes-âncora por cidade: um cliente satisfeito e visível em cada município (o mapa do Dashboard mostra onde falta).",
            "Método replicável: tudo registrado no CRM — se você adoecer uma semana, a IA e os registros seguram o funil.",
            "Estudo contínuo: refazer esta trilha uma vez por ano; as objeções e os concorrentes mudam.",
          ] },
          { tipo: "destaque", titulo: "Você chegou ao fim da trilha", texto: "Volte aos módulos onde o quiz foi mais difícil e refaça as missões com clientes novos. O treino com IA (cenários) está disponível em todos os módulos — use antes das visitas importantes." },
        ],
        missao: "Feche 3 parcerias de indicação mútua nos próximos 30 dias (contador, agrônomo, loja de peças). Registre os parceiros como contatos no CRM.",
        quiz: [
          { pergunta: "Qual parceria gera indicação de compra de máquina com mais frequência?", opcoes: ["Posto de gasolina", "Contador/agrônomo/engenheiro que atende o cliente antes de você", "Concorrente"], correta: 1, explicacao: "Quem já é consultor de confiança do cliente abre porta que anúncio nenhum abre." },
        ],
      },
    ],
  },
];

export const TODAS_AULAS: { modulo: Modulo; aula: Aula }[] = TRILHA.flatMap((m) => m.aulas.map((a) => ({ modulo: m, aula: a })));

export function proximaAula(concluidas: Set<string>): { modulo: Modulo; aula: Aula } | null {
  return TODAS_AULAS.find(({ aula }) => !concluidas.has(aula.id)) ?? null;
}

export function progressoModulo(m: Modulo, concluidas: Set<string>): number {
  if (!m.aulas.length) return 0;
  return Math.round((m.aulas.filter((a) => concluidas.has(a.id)).length / m.aulas.length) * 100);
}

// Nível do vendedor = maior nível com todas as aulas concluídas (+ 1 se estiver
// avançando). Vai de 1 a 10.
export function nivelDoVendedor(concluidas: Set<string>): { nivel: number; titulo: string } {
  let nivel = 0;
  for (const m of TRILHA) {
    if (m.aulas.every((a) => concluidas.has(a.id))) nivel = m.nivel;
    else break;
  }
  const TITULOS = ["Iniciante", "Aprendiz", "Vendedor", "Consultor", "Consultor Sênior", "Negociador", "Especialista", "Fechador", "Estrategista", "Mestre em Vendas", "Mestre em Vendas"];
  return { nivel: Math.min(10, nivel + 1), titulo: TITULOS[Math.min(10, nivel)] };
}
