# CRM do Edy — continuação

Este arquivo é o ponto de partida de uma sessão nova. Cole o conteúdo dele (ou
mande ler este caminho) e continue de onde parou.

Você está continuando o trabalho num CRM em Next.js (App Router) + Prisma +
Postgres, feito sob medida para **um** vendedor de máquinas pesadas New Holland
Construction / Dynapac no sul do Espírito Santo. Tudo em português do Brasil —
código, comentários, commits e conversa.

Repositório: `edersoncontas-cell/CRM`

## Onde parei

Último commit com código: **Mapa por região — 3ª rodada de revisão independente (29/10)**;
antes dele, os de 24/10 (2ª rodada) e o das Comissões Futuras (06/10).
**1.695 testes passando** (126 arquivos), lint, tipos e build limpos; e2e do mapa 414/414.

**24–29/10 — Mapa: três revisões independentes e as correções.**
Três rodadas, cada uma com revisores por assunto (regras/dependências, geometria/desempenho,
ciclo Leaflet/React, visual/UX, testes) e 2 verificadores céticos por achado. A 1ª rodada achou 9
confirmados; a 2ª, sobre as correções da 1ª, achou 27 (16 confirmados, 4 prováveis, 7
refutados) — **entre eles um defeito que eu mesmo introduzi** (a busca do lugar do nome ficou
5 a 15× mais lenta na abertura) e que a 2ª rodada pegou; a 3ª, sobre as correções da 2ª,
achou 20 confirmados (todos de gravidade baixa), 8 prováveis e 6 refutados. Cada correção
abaixo foi posta à prova com uma versão QUEBRADA de propósito do código (mutação à mão): o teste
tem de falhar. Os que sobreviveram na 3ª rodada ganharam teste novo.
*3ª rodada (corrigido; medido na tela):*
- **Dica que saltava 160 a 424 px** junto do +/−: dedo com fração (o Leaflet divide pela escala
  do contêiner e o card do Dashboard no PC tem largura fracionária) e a comparação estrita
  `<` tratava "encostar" como "cobrir" por 1 ulp. Agora há tolerância de 0,01 px.
- **Seta da dica apontando para outra cidade** quando a dica é deslocada: `seta` vira `--seta`
  no elemento e o CSS (`.tip-municipio.leaflet-tooltip-*:before`) a traz de volta (presa a
  14 px das pontas). No e2e a seta aponta para o dedo até 3 px ou presa na ponta; num texto
  curto deslocado no canto ela chega a ficar ~60 px do dedo (limite conhecido).
- **Dica sob o +/− ou os créditos** quando nenhum lugar "cabia": agora ela também sobe ou desce
  até a borda do botão (nos 20 px do pé do mapa sobe acima dos créditos; no Dashboard de
  celular de 320 px desce abaixo do +/−), e se nada escapa fica a que MENOS cobre (antes: a
  primeira que cabia no mapa). Varredura de 254 a 1100 px com os dois controles reais: 0 casos.
- **Ponto do dedo 1 px fora do mapa** (borda fracionária) deixava a função sem lugar: o ponto é
  puxado para dentro. A conta dos botões (`botoesDoContainer`, na lib, testada) desconta a borda
  e a escala do contêiner como o Leaflet faz com o mouse; a dica e os nomes usam a MESMA.
- **Testes da busca do nome**: bolsão livre de EXATOS 1×1 px (2000 casos) e de 1,01 a 8 px
  (600), borda de baixo/cima/esquerda/direita, degraus da escada de letras (12 em 2 linhas,
  11, 10, sem nome), piso de nomes por zoom no mapa real, contagem de perguntas por tamanho de
  janela, ordem do lugar mais perto, guard de janelas vazias e corte diagonal pela esquerda.
  Os mutantes que a revisão achou vivos (encolher só metade, varrer só até sx/4, tirar a borda de
  baixo, tirar a letra 10, tirar o guard, PONTOS_GROSSOS 100→500…) agora morrem; a bateria que
  rodei à mão tem 34 mutantes (busca do nome, dica, conta dos botões) e nenhum sobrevive.
- **e2e**: os dados do seed ficaram REALIZADOS (visita agendada abre o "Visita feita?", que
  cobre o mapa em dia útil depois do horário; o comentário do seed trocava UTC por Brasília),
  e no fim de semana vão na segunda-feira que a tela mostra; entra e abre `/dashboard` antes de
  guardar o banco (banco recém-criado não tinha tabela); `E2E_OUT` com ou sem `/`; o estado
  original fica gravado no banco (um `kill -9` não faz a próxima execução tratar o sujo como
  original); SIGTERM; o seed não sobrescreve a coordenada de município que já existe. Confere
  agora o que a TELA pinta: z-index e opacidade lidos do navegador, estilo calculado da divisa
  e tinta nos pixels de cada nome (com controle: nomes por baixo das cidades). Provado com
  3 defeitos plantados no app (nomes em z-index 345, divisa magenta, nomes invisíveis): os 3 foram
  pegos; antes passavam 279/279.
*Registrado, sem mexer:* o quadrado de foco que fica na cidade clicada depois que a dica fecha
(foco de teclado do SVG do Leaflet, defeito antigo, é acessibilidade); a lista da legenda num
celular de 320 px rola e esconde a última região (altura fixa por regra da casa).
*1ª rodada (corrigido; medido na tela, antes e depois no build antigo):*
- **Nome de 2 linhas mais alto que o medido** — o `leaflet.css` (carrega depois) punha
  `display:block` e vencia o `.rotulo-municipio`; seletor com duas classes.
- **Dica cortada pela borda do mapa** (em todas as bordas, no PC também): a direção
  vem da posição do ponteiro.
- **Dica no celular abria e sumia** (o `mouseout` que o Chromium manda depois do toque;
  defeito ANTIGO, A/B contra e53eae5): em aparelho sem mouse ela fica até o próximo toque.
- **Nomes**: busca na parte VISÍVEL da cidade (antes na caixa inteira: com um polígono
  SINTÉTICO de 6000 vértices o código antigo gastava 1.401 ms por chamada — a malha real tem
  no máximo 263 vértices por anel, e o pior caso real medido no antigo foi ~100 ms no celular
  no zoom 13) e nome colado no canto.
- Realce do mouse perdido a cada atualização do mapa; renderizador SVG órfão; alturas das
  camadas viraram constantes com teste de ORDEM; altura de linha duplicada.
*2ª rodada (corrigido):*
- **Busca do lugar do nome, grosso para fino** (`acharLugar`): a varredura plana que eu tinha
  posto custava 5–15× o original no zoom de abertura. Agora uma grade grossa testada com o
  retângulo ENCOLHIDO (nenhum lugar escapa dela) e, em volta de cada ponto que passou, 1 px.
  Medido no Chromium: no zoom 8 (abertura) custa de ~1,3× (mediana) a ~2× o original conforme
  a tela e a CPU (22 ms contra 8 ms no PC; 108 ms contra 47 ms com a CPU estrangulada 4×; uma
  medida da 3ª rodada deu até 5,9× no pior caso estrangulado), do zoom 8,5 em diante é igual
  ou menor; acha todo lugar com folga de pelo menos 1 px (os ~0,5% mais apertados escapam; 0
  faltando em 2 sementes de teste, contra 81 e 87 faltando no original). O teste de custo conta
  as perguntas "cabe aqui?" (não o relógio).
- **Dica em mapa estreito** (Dashboard no celular de 390 tem 324 px; de lado a dica de 220 +
  seta não cabia): `direcaoDaDica` escolhe pelo que CABE (centrada → de lado → deslocada) e
  desvia dos botões +/− e créditos (ficam POR CIMA da dica). Varredura em mapas de 288 a 1440:
  nenhuma dica sai do mapa; com o botão +/− no lugar de verdade, nenhuma cai embaixo dele
  (antes, no Visitas do celular, 1 em cada ~12 toques caía embaixo do +/− e 1 em 6 contando os
  créditos — estes só foram tratados na 3ª rodada).
- **Girar o celular com a dica aberta** deixava a dica presa e cortada: `resize` fecha.
- **"Não atendo" na legenda** era o último item de uma lista que rola (altura fixa): com 9
  regiões ou mais ficava atrás da rolagem. Agora é o primeiro.
- Testes que faltavam: obstáculo com esq/dir/cima/baixo diferentes (o sinal errado passava),
  as quatro divisas, o corte diagonal, a folga em números literais, cidade em dois pedaços,
  `botaoEmPx` (a conta dos botões saiu do componente para a lib), a altura de linha. Cada
  um foi posto à prova com mutações feitas à mão (grade sem encolher, sem a ponta, sem o fino,
  sinais do obstáculo, lado da dica, divisa pulada…): todas morreram, mas três só depois de eu
  reforçar o teste (a 1ª versão deixava passar a grade sem a meia caixa da ponta, o espelho
  esq/dir do obstáculo e a ordem dos lados da dica). Os testes de componente por texto do fonte
  seguem sendo fracos (ver T3 abaixo).
- **e2e** (`scripts/e2e-mapa/`, README completo): hoje 414 conferências (as de visual nas
  quatro combinações PC/celular × claro/escuro, inclusive "aproximar"; as de toque só no celular).
  AFIRMA que há pins, trajeto, cifrões e botões na tela (antes passou 243/243 com ZERO pins: o
  seed era de ontem), roda o seed a cada vez (dia de hoje, fuso de Brasília; cria os próprios
  clientes), tem trava `E2E_BANCO`, devolve a lista de cidades atendidas e a marca "fora da área"
  no `finally` (os dados `tmapa*` do seed FICAM no banco de teste) e sai com código ≠ 0 se algo
  falhar (inclusive com `SO`).
*Decidido NÃO mexer (registrado):*
- **G3** — o nome de cidade muito grande "pula" quando o ponto de partida cruza a borda da tela
  (fora → meio da parte visível; dentro mas perto da borda → colado). Só aparece ao arrastar em
  passos pequenos com uma cidade maior que a tela; a correção sugerida (alvo contínuo) não foi
  testada e pode piorar o caso comum.
- **L4** — em aparelho que diz `(hover: none)` mas tem mouse, a dica não fecha ao sair da
  cidade (só no próximo clique/toque). A decisão por `matchMedia` é tomada ao criar a camada;
  o inverso (decidir por evento) reabre o defeito do toque. O celular dele não tem mouse.
- **T3** — o comportamento dos componentes (`CamadaMunicipiosES`, `RotulosMunicipiosES`) só é
  travado por teste de texto do fonte + pelo e2e (que não roda no `npm test`): refatoração
  inofensiva pode quebrar o teste de texto, e um defeito real de comportamento só aparece no e2e.
**Não conferido:** OpenStreetMap real, iPhone/Safari e Android de verdade (o toque foi medido
no Chromium em modo celular); o toque emulado aproxima 1 nível no mapa vazio (igual no build
antigo). **WhatsApp:** continua a Evolution parada na VPS dele (`docs/PROMPT-RELIGAR-VPS.md`);
o código não liga a VPS e o envio segue PAUSADO.

**23/10 (2) — Mapa refeito: sem textura, divisa preta, cinza escuro, nomes DENTRO
das cidades.** Print dele: "não gostei da textura, sobrepondo o nome das cidades,
não enquadrados… contorno do limite entre os municípios de preto e as que não
atendo, cinza escuro". Causa: o preenchimento era 0,8/0,5 transparente, então a
base do OpenStreetMap (ruas, rios e os NOMES do próprio mapa) aparecia por baixo
da cor. Agora: preenchimento **opaco**, divisa **preta**, "não atendo" em cinza
escuro `#555c68`, contorno grosso preto do estado (traço de 4 px por baixo das
cidades), realce ao tocar (divisa mais grossa + cor mais clara) e o **nome de cada
cidade escrito dentro dela**, só onde cabe (`lib/mapa-rotulos-es.ts`, puro:
retângulo do texto inteiro dentro da cidade, dentro da tela, longe de pin, cifrão,
botões do mapa e do trajeto do dia; 12 → 11 → 10 px, uma ou duas linhas). Cidade
sem espaço fica sem nome — o nome continua na dica ao tocar, e aproximar com o (+)
acrescenta nomes. **Limite físico:** na abertura (zoom ~8) só as cidades grandes
têm nome (PC: 4–8; celular: ~2); com 2 níveis a mais, 15–17 no PC e 8–9 no celular (medido
em 29/10; o "16-26" da época era de uma janela maior). O mapa agora abre em
passos de 1/4 de zoom (`zoomSnap`) para aproveitar a caixa. A malha ganhou o ponto
do nome (`c`) e os anéis foram arrumados (Vitória, Vila Velha, Guarapari e Ibiraçu
vinham com as ilhas como anéis soltos e o contorno principal por último;
`scripts/gerar-malha-es.py` normaliza). Bug que o teste de tela pegou: a família
da letra tinha aspas duplas dentro do `style="…"` e o atributo fechava no meio
(texto saía na cor da página). Prova: `tests/mapa-rotulos-es.test.ts` (41) +
`tests/mapa-regioes-es.test.ts` (33) + e2e 171/171 (PC 1440 e celular 390, tema
claro e escuro, azulejo falso COM ruas, rios e nomes para provar que a base não
aparece por baixo). OpenStreetMap real e Safari não foram vistos (sem rede aqui).
**WhatsApp (mesma data):** o print dele mostrou "Evolution parada dentro da VPS
ligada"; não dá para o código religar. `docs/PROMPT-RELIGAR-VPS.md` ganhou o passo
de leitura (disco/memória/contêineres) e o Passo 7 (`systemctl enable docker` +
`docker update --restart=always …`) para a Evolution subir sozinha depois.

**23/10 — WhatsApp parado + foto das Máquinas Usadas.**
- **Máquinas Usadas:** o campo de foto tinha `capture="environment"`, que faz o
  celular abrir DIRETO a câmera e some com a galeria ("a única opção é tirar
  foto"). Tirei o `capture`; o botão agora é "Anexar foto". Continua **uma foto
  por máquina** (coluna `fotoUrl`); várias fotos pedem coluna nova — decisão dele.
  O menu que o celular abre (Câmera / Galeria / Arquivos) é do aparelho; o site não
  controla se ele lista "Tirar foto" junto (iPhone costuma listar).
- **WhatsApp:** SEM print da tela não sei qual das causas é. O que o código
  cobre e o que ficou de fora (Evolution FALSA local, `fake-evolution.mjs` fora do
  repo): conectado, desconectado (QR aparece), instância inexistente (cria sozinho),
  presa, chave recusada, servidor sem resposta e desligado — tudo diz a causa. O
  que faltava: se o **agendador externo (cron-job.org) para**, nada vigia o
  WhatsApp (o vigia só roda pelo `/api/cron/tudo`) e a tela não avisava. Agora:
  aviso na Conexão ("o agendador parou há X"), rede de segurança (o CRM aberto roda
  a passada se nada rodou há 20 min — `lib/agendador.ts`, `/api/agendador/batida`,
  `BatidaDoAgendador` no layout) e a frase "Conectado há…" não fica mais debaixo de
  um QR com informação velha (`descreverConexao` diz de quando é). **Não dá para o
  código:** ligar a VPS (é dele; `docs/PROMPT-RELIGAR-VPS.md`), nem ler o QR com o
  celular. WhatsApp continua PAUSADO para envio (nada disso mexe na trava).

**23/10 — Mapa por região** (Dashboard "Vendas por cidade" e Visitas "Mapa da
semana"). Pedido dele, com a foto do Mapa do Turismo Capixaba 2025: divisas entre
as cidades, **coloridas** onde ele atende (cor da região, 10 regiões da foto) e
**cinza** onde não atende. Cidade que ele atende e que a foto deixa fora de
qualquer região (8, ex.: Marechal Floriano, Presidente Kennedy) sai em **lilás**,
não cinza. Legenda embaixo: "Você atende N de 78 cidades" + as regiões + "Não
atendo". Divisas vão junto com o código (`src/lib/malha-es.json`, nada de
internet para o desenho); o ES deixou de buscar o contorno no IBGE. Quem ele
atende vem de `mapaDaArea().atendidos` (área salva ou `foraDeArea`); banco sem
resposta = `null` = mapa sem cores + aviso na legenda. Tudo em
`docs/mapa-por-regiao.md`. **Decisão dele:** usei as regiões da foto do Turismo;
trocar por as 5 regiões de rota dele (Caparaó, Litorânea, Granito, Serrana, Das
Santas) é só mexer numa tabela. Prova: `tests/mapa-regioes-es.test.ts` (23) +
e2e (62 conferências, PC 1440 e celular 390, tema claro e escuro) com os azulejos
do OpenStreetMap trocados por um liso (sem rede aqui).

**22/10 — Google caiu ("Token has been expired or revoked.")**. Print dele: a faixa
de Clientes só repetia o erro cru, sem botão. Era o Google recusando renovar o
acesso (`invalid_grant`) — causa mais provável: app do Google Cloud em modo de
TESTE (acesso vale 7 dias; o `docs/GOOGLE.md` antigo mandava deixar em teste).
O código antigo ainda APAGAVA os tokens ao receber esse erro. Agora a queda é um
estado com nome (`lib/google-conexao-regra.ts`, puro): o token fica gravado com
`problema`, e Clientes (faixa), Configurações (card + 3 passos para publicar o
app) e Visitas (aviso: a visita nova não entra na Agenda) mostram "reconecte" +
botão `/api/google/auth`. O cron devolve 200 "pulado" (não 500), a sincronização
não bate no Google com a conexão caída, e a volta do banco provisório não deixa
o token caído bloquear o que funciona. **Falta ele:** clicar em Reconectar uma
vez e publicar o app no Google Cloud (Público-alvo → Publicar app) — código não
faz isso. Não feito: reenviar para a Agenda as visitas marcadas durante a queda.
Prova: `tests/google-conexao.test.ts` (51) + e2e com Google falso local (48/48,
PC e celular, dois temas). O Google de verdade não foi testado (sem rede aqui).

**06/10 — Comissões Futuras** (print dele: 0 negociações / R$ 0 com faturadas
pendentes). A tela `/financeiro/comissoes-futuras` e o card/painel do Financeiro
filtravam só `tipoPagamento: "crd_pme"`. Agora é **toda venda ganha com
`comissaoPaga = false`**, de qualquer forma de pagamento, a mais antiga
primeiro (`lib/comissoes-futuras.ts`, puro, testado). CRD PME mantém a
previsão dos 75% na linha; as outras dizem há quantos dias estão pendentes
(sem inventar data). **Saiu o card "Regra CRD PME"** a pedido dele. Sai da
lista quando ele marca "Paga / Mês pago" em Negociações Faturadas (as duas
ações revalidam a tela). "Comissões a Receber" e o aviso do 5º dia útil não
mudaram.

**05/10 — Área de atuação** (Configurações, card logo abaixo de Parâmetros). Ele
pediu estado + municípios "valendo no sistema inteiro"; no meio do trabalho
decidiu **"pode ser então só ES"** — o estado está fixo (`UFS_LIBERADAS = ["ES"]`
em `lib/area-atuacao-regra.ts`) e ele marca os municípios.
- Gravado em `Configuracao` `area.atuacao` (`{ufs, municipios, atualizadoEm}`),
  **sem coluna nova**. Sem nada salvo (ou lixo), é a área de sempre e quem
  atende continua sendo a marca `foraDeArea` do banco. Salvar sincroniza essa
  marca (que o "para todos", as listas "Cidades que atendo / Fora da minha
  área", o vínculo automático e as licitações já liam), cria o município que
  falta **com coordenada** e preenche a que faltava. Só passa para "fora" o
  município do IBGE que ele viu desmarcado: distrito / nome escrito diferente
  fica como está e a tela lista (`ficamComoEstao`).
- Base do IBGE do Brasil inteiro em `lib/municipios-brasil.json` (servidor só;
  a tela pede por UF). Os 78 do ES batem com `municipios-es.ts` (teste).
- Quem lê a área: mapas do Dashboard e de Visitas (abrem nas cidades atendidas,
  `mapaDaAreaOuPadrao`), cidades sugeridas em Visitas (as dele primeiro),
  coordenada das vendas, cidade que a IA grava (`validadorDaArea` /
  `municipioDaArea` no pipeline, Orientador e Cérebro — nasce "fora" se não
  está na lista dele), deduplicação de clientes, licitações (PNCP por UF da
  área), local do evento no Google, `/api/municipios/[uf]` (base local, sem IBGE).
- **Não vem na volta do provisório** (`CONFIG_NUNCA`): a chave sem a marca das
  cidades diria uma lista e as cidades outra. Depois da volta, salvar de novo.
- **Textos da IA continuam dizendo ES** (ele recusou a troca no meio). Para
  abrir outro estado: `docs/PRODUTO-CONFIGURACOES.md` §2.
- Avaliação "o que pode / não pode mudar" para vender o CRM:
  `docs/PRODUTO-CONFIGURACOES.md`.

**02/10 — 7ª vez: print às 10:18, a VPS dele (`147.15.65.44:8080`) "não respondeu
em 10s", fora do ar havia ~2h** (desde ANTES do deploy do Testar recebimento).
Nada no CRM religa a VPS; o que mudou é a tela dizer qual causa é e o que tocar
pelo celular (antes: três causas e "entre por SSH"):
- `lib/evolution-servidor-regra.ts` (puro): a porta da Evolution RECUSOU (VPS
  ligada, Evolution parada → Reiniciar no painel; comando à parte) ou ficou
  CALADA; calada → `lib/sondar-porta.ts` bate UMA vez na porta 22 da mesma
  máquina (só no diagnóstico): responde/recusa = VPS ligada (firewall ou
  Evolution travada); calada = VPS inteira fora (parada, suspensa, outro IP).
  O começo da frase de erro do `evoFetch` é fixo (`PREFIXO_SERVIDOR_FORA`):
  `servidorEvolutionFora()` reconhece.
- Vigia: servidor fora NÃO tenta connect/restart e NÃO pede QR (nem o tick do
  Zeus); memória ganhou `servidorForaDesde`/`avisouServidorFora`; um aviso + push
  depois de 10 min, resolvido sozinho quando volta. Linha da tela: "Servidor da
  Evolution (sua VPS) sem responder desde HH:MM".
- Tela do QR: aviso vermelho no topo, QR some ("Sem o servidor…"), passos do QR
  escondidos. e2e: `servidor-fora-e2e.mjs` (porta fechada / `calado.mjs` /
  `EVO_URL=http://10.255.255.1:8080` no `subir.sh`).

**02/10 — 6ª vez: "desconectei, conectei, mandei mensagem de outro telefone e não
chegou".** Sem print do que a tela mostrou, então não se sabe onde parou. A
mensagem pode parar em 3 lugares, e agora o CRM descobre sozinho, na Vercel (que
alcança a Evolution dele):
- **"Testar recebimento"** (painel conectado da Conexão, `TesteRecebimento.tsx`
  → `testarRecebimentoAction` em `lib/whatsapp-recebimento-actions.ts`): ele manda
  uma mensagem de outro celular; a tela mostra 3 passos — conexão viva por dentro
  (UMA consulta `whatsappNumbers` com número aleatório; morta = "Connection
  Closed") → a Evolution recebeu (`findMessages`, que na 2.x ordena por hora desc
  e filtra a janela com gte+lte) → o CRM recebeu (pelo aviso, puxada ou
  descartada). Conclusões puras em `concluirTeste` (`lib/whatsapp-resgate-regra.ts`);
  toda situação fecha quando os 150 s acabam. Na 1ª consulta ainda puxa o que
  ficou para trás nas últimas 24 h (só ANTES da janela do teste).
- **Resgate** (`lib/whatsapp-resgate.ts`): o que a Evolution guardou e o CRM não
  tem passa pelo MESMO caminho do webhook (`processarDadoEvolution` em
  `lib/whatsapp-evolution-entrada.ts`, agora usado pelo webhook também). O vigia
  (cron) puxa a cada passada, com a conexão de pé: janela desde a última passada
  (folga de 10 min), no máximo 2 h, até 20 por vez; memória em
  `whatsapp.resgate` (ids vistos + hora do vigia; o teste não move a hora).
  Não vem na volta do provisório. Diag marca `via: "resgate"` → selo "puxada".
- **A chave da Evolution aparecia na tela** (`?apikey=` na URL do webhook, no
  diagnóstico e no "Webhook apontado para…"): agora `semChaveNaUrl`.
- Evolution falsa: `WEBHOOK=mudo` (guarda e não avisa), `GUARDA=0` (não guarda),
  `/__receber/<inst>` simula mensagem; e2e `recebimento-e2e.mjs` com
  `CENARIO=chegou|puxada|morta|grupo|nada`.

**02/10 — 5ª vez: "não vai, resolva me entregue funcionando".** O print novo mostrou
que reiniciar NÃO cura o zumbi dele: "depois de reiniciar: open → logout falhou:
Connection Closed → apagou de novo recusado: [object Object]", e a 2ª rodada
idêntica. O `[object Object]` vem da própria Evolution (texto literal). Não há
saída pela API para aquela instância. O que mudou:
- **Instância nova com outro nome, sozinha.** Quando apagar é recusado,
  `trocarInstanciaWhatsAppAction` → `criarInstanciaNovaEvolution` cria
  `crm-2` (depois `crm-3`…) já com webhook, e grava no banco
  (`whatsapp.instancia.ativa` = `{base, nome, anterior, desde}`) — sem mexer na
  Vercel. Vale só enquanto `base` = `EVOLUTION_INSTANCE` (se ele trocar a
  variável, a variável manda). Regras puras: `lib/whatsapp-instancia-nome.ts`.
- **Todo caminho usa a que vale**: `evoInstancia()` devolve a marca
  `__INSTANCIA_DO_CRM__` e `evoFetch` troca pelo nome do banco (cache de 20 s;
  status, QR, diagnóstico, desconectar e apagar releem com `forcar`). O webhook
  aceita a instância ativa (relê o banco antes de recusar); a velha, se acordar,
  cai como "outra-instancia". Mídia de mensagem antiga tenta a instância
  `anterior` quando a ativa não tem.
- **Zumbi confirmado para na 1ª rodada** (`zumbi: true` em `apagarEvolution`):
  a 2ª rodada era idêntica e só gastava 20 s.
- **Volta do provisório**: a troca mais nova vence (`instanciaQueVemNaVolta`),
  provado em `scripts/provar-trazer-provisorio.ts`.
- Evolution falsa com várias instâncias (`/tmp/claude-0/shots/evolution-presa.mjs`,
  modos `zumbi-eterno` e `zumbi-sem-criar`): Refazer do zero → QR da `crm-2` em
  12 s; Desconectar → 37 s; mensagem pela `crm-2` grava, pela `crm` é ignorada.
- **Fica na Evolution dele**: a instância `crm` zumbi (não dá para apagar pela
  API). Reiniciar o serviço da Evolution no servidor dela limpa; e no celular
  pode sobrar um aparelho antigo em Aparelhos conectados.

**01/10 — 3ª e 4ª vez: "continua não permitindo desconectar, me entregue com QR novo".**
Daqui NÃO se alcança a Evolution dele (sem URL, sem chave, sem rede). O PRINT dele
(o primeiro dado real) mostrou a causa: o **zumbi da Evolution 2.x** — diz "open"
mas o socket de dentro está fechado. `logout` → 500 "Error: Connection Closed";
`delete` → 400 (apagar passa por um logout); `restart` aceita. É também por que
"não chega mensagem" com tudo verde (e o vigia só vê "open"). O `[object Object]`
no print era `String(objeto)` da mensagem de erro (`textoDoErroEvolution`).
O que mudou:
- **Esperar assentar depois de reiniciar.** Reiniciar deixa "connecting" por
  alguns segundos (refazendo o socket); o CRM tentava apagar 2 s depois e a
  recusa se repetia, e `connecting` era tratado como "desconectado" (falso
  sucesso). Agora espera "open" (socket novo: logout e apagar funcionam) ou
  "close" (precisa de QR). `lib/whatsapp-desconectar.ts` (40 s) e
  `lib/whatsapp-apagar-instancia.ts` (45 s, 2 rodadas), ambos puros e testados.
- **A tela conduz os passos**, cada um uma ação do servidor com os próprios 60 s:
  `desconectarZapi` → (se "presa") `apagarConexaoWhatsAppAction` →
  `criarInstanciaEvolutionAction`. O estado mora no hook `useSaidaWhatsApp` no
  componente PAI: o painel "conectado" desmonta quando a Evolution vira
  "connecting" e levava o resultado junto, e a tela mostrava o QR da conexão
  que ia ser apagada. Agora um painel "Trabalhando…" segura tudo e o polling
  não consulta enquanto isso.
- Se nada funcionar, a caixa lista o que a Evolution respondeu em cada passo e
  3 saídas: celular (só adianta se a Evolution ainda ouve o WhatsApp), refazer, e
  **trocar `EVOLUTION_INSTANCE` na Vercel por outro nome + redeploy** (o CRM
  cria a instância nova e mostra o QR; a zumbi fica esquecida). Sem código novo.
Prova com a Evolution falsa `/tmp/claude-0/shots/evolution-presa.mjs`: modos
presa, recusa, assincrono, impossivel, normal, zumbi-cura (reiniciar cura),
zumbi-close (reiniciar leva a "close"), zumbi-eterno (nada cura → mostra os
passos); scripts `desconectar-e2e.mjs` e `refazer-direto.mjs`.
**Não confirmado: Evolution de verdade** (nem a versão dela).

**01/10 — Configurações enxuta (pedido dele, card por card).** SAÍRAM: "Envio de
mensagens PAUSADO", "Mensagens com erro esperando envio", "Tema do CRM", "Travas
de envio do WhatsApp", "Exportar dados". FORAM PARA A CENTRAL INTELIGENTE
(`/cerebro`, entre os 3 painéis e "O que o Cérebro fez"): "A realidade do seu
negócio" e "O que o Orientador aprendeu com você" (`revalidatePath("/cerebro")`
nas ações dos dois). O tema virou o **sol/lua fixo** no canto de todas as telas
do `(app)` (`components/AlternarTema.tsx`, montado no layout; 26 px no PC para
caber na margem de cima, 36 px no celular, ao lado do hambúrguer). `/sem-sinal`
fica sem ele (está fora do layout, funciona offline).
- ⚠ **A trava de envio CONTINUA ligada e agora NÃO há botão para liberar.**
  `lib/whatsapp-pausa.ts` nasce pausada; `lib/whatsapp-pausa-actions.ts`
  (`lerPausaAction`/`definirPausaAction`) ficou pronta, sem tela, para a futura
  tela de envio por cidade. Nada sai — nem resposta digitada no Atendimento.
  Ele NÃO pediu para liberar; não libere.
- Teto (80/dia), janela (8h–18h, dias úteis) e ritmo (`lib/envio-limites.ts`,
  lido por `envio-guarda.ts`) seguem valendo sem tela. Ele disse "vai ficar
  limitado ao número de clientes de cada cidade": isso NÃO foi implementado —
  perguntar se uma cidade com mais de 80 clientes deve sair em ondas.
- `/api/exportar/*` continua; só o botão saiu.
- Apagados: `PausaEnvioCard`, `FalhadasCard`, `SeletorTema`, `TravasEnvioCard`,
  `ExportarDadosCard`, `limpeza-falhadas-actions.ts`, `envio-limites-actions.ts`.
  `limpeza-falhadas.ts` (puro) fica — os testes usam.
- `tests/tela-removida-sem-referencia.test.ts` pega texto que mande ele para uma
  tela que não existe mais.
- Defeito achado no caminho: no tema claro o título de Clientes sumia (página
  com fundo preto próprio + variável de tema) → classe `.pagina-escura`.

**01/10 — "continua não recebendo, resolva ou desconecte".** Em /conexao, com o
número "conectado", o painel agora tem ao lado de Desconectar o botão **"Não
chega mensagem? Refazer do zero"** (confirmação na tela): apaga a instância na
Evolution e cria de novo, já com o webhook no endereço de onde ele está
abrindo o CRM (`criarInstanciaEvolutionAction` confirma a origem) e mostra o QR.
Antes só aparecia depois de "Desconectar" falhar. Provado só contra a Evolution
FALSA (`/tmp/claude-0/shots/refazer-direto.mjs`). **Não confirmado em produção.**

**01/10 — "desconectar não está indo".** O botão mandava UM logout e
acreditava nele; com a sessão presa a Evolution diz "logged out" e continua
"open". Agora `lib/whatsapp-desconectar.ts` confere o estado, reinicia e pede
de novo; se nem assim, a tela mostra "presa" com duas saídas (Aparelhos
conectados no celular, ou "Refazer do zero" = apaga e recria a instância).
Sem `window.prompt` (confirmação na tela). `/conexao` com `maxDuration = 60`.
Prova com a Evolution falsa: `/tmp/claude-0/shots/evolution-presa.mjs`
(MODO=normal para a que obedece) — não é a Evolution de verdade.
`CHAVE_MANUTENCAO = "manutencao.v44"` (nada mudou no schema).

**01/10 — arábica 0,00% e Configurações.** O arábica do ES que a fonte da vez
não traz era repetido para sempre (o 1.155,00 de 23/09 comparado com ele
mesmo); agora vale 6 h depois de lido de verdade (`arabicaDaLeitura`,
`arabicaLidaEm`) e, sem ele, o letreiro mostra o Arábica NY. O filtro de
contatos virou UMA lista de palavras inteiras: `filtro.contatos.termos` (os
"pedaços") é somado às palavras na leitura e esvaziado na primeira edição.
Saíram os cards "Conversas importadas sem contato" e "Conversas do WhatsApp:
a partir de quando" — a data de corte (16/09) CONTINUA valendo, invisível, e
muda pela importação do histórico em Conexão.

**01/10, depois do letreiro — "O atendimento não está atualizando".** Não deu
para ver produção daqui. O caminho inteiro (webhook → banco → lista → conversa
aberta) foi provado num banco igual ao do Neon e funciona. O que foi feito:
- a conversa aberta não perde mais o que entra no banco fora de ordem
  (áudio transcrito, foto de álbum, webhook repetido) — `lib/conversa-ao-vivo.ts`;
- o topo do Atendimento diz quando foi a última mensagem que chegou A ESTE
  banco e avisa quando para (3 h de expediente, chave recusada, erro ao
  gravar) — `lib/recebimento-regra.ts`; o aviso leva a /conexao?diagnosticar=1;
- aviso no Atendimento enquanto a volta do provisório não terminou;
- o teste do webhook agora prova que a chamada chegou a ESTE banco (marca
  `diag.webhook_teste`) — antes, um deploy antigo da Vercel gravando no
  provisório respondia 200 e o diagnóstico dizia "tudo certo";
- o vigia não troca mais um webhook que entrega aqui pelo endereço guardado no
  banco (`crm.urlPublica` do Neon é de 23/09);
- /api/diag: "Recebimento do WhatsApp" e "última mensagem recebida — lá × aqui".
**Não confirmado:** qual era a causa em produção. Perguntar o que o topo do
Atendimento mostra e as linhas de recebimento do /api/diag.

**01/10 — o CRM VOLTOU para o Neon** (ele rodou o prompt da extensão). Logo depois:
"no letreiro está repetindo o valor do café conilon, antes era o dolar" e
"agora tá o arabica, é pra ficar arabica, conilon e dolar". Causa: o dólar não
veio de fonte nenhuma em produção (o Painel do Café não trouxe, a AwesomeAPI não
respondeu e o dólar não era guardado à parte); com 2 ativos, o rodízio de 3
repetia o café. Conserto: reserva no Yahoo (BRL=X — provado de verdade aqui: a
AwesomeAPI está bloqueada neste ambiente e o CRM trouxe R$ 5,16 pelo Yahoo),
último dólar bom guardado (`cotacao_dolar_ultimo`), os três lugares sempre no
letreiro e no cartão ("indisponível"/"—" quando nenhuma fonte responde), e o
grupo do rodízio nunca repete ativo. `/api/diag` testa AwesomeAPI, Yahoo e
Painel do Café ao vivo. **Não confirmado:** se ele já clicou em "Trazer os dados
do banco provisório" — perguntar.

> ⚠ **O envio de WhatsApp está PAUSADO.** O número do vendedor foi bloqueado
> duas vezes. A trava geral (`lib/whatsapp-pausa.ts`) barra TODA saída —
> campanha, resposta automática, aniversário, mensagem da tela — e nasce
> pausada. Desde 01/10 NÃO existe tela para liberar (o card saiu de
> Configurações a pedido dele). Não libere por conta própria e não escreva nada
> que contorne a trava.

> Ao retomar, confira o estado real antes de confiar nestes números:
> `git log --oneline -5`, `npx vitest run`, `grep -n "CHAVE_MANUTENCAO = " src/lib/manutencao.ts`.

A manutenção **roda sozinha** no layout, ao abrir qualquer tela — ele NÃO
precisa apertar botão nenhum. Já afirmei o contrário três vezes; não repita.
O card em Configurações mostra se está em dia ou se falhou (e por quê).

### ⚠ O banco de produção (Neon) está SUSPENSO — 23/09

O que aconteceu, em ordem, e o que é culpa minha:

1. Subi o multiusuário etapa 1 (`5abe681`). O schema ganhou `vendedorId` em 8
   modelos, mas o banco só ganharia a coluna quando a manutenção rodasse — e
   ela roda em paralelo com as consultas da página. Toda tela caiu. **Meu.**
2. Reverti (`a56891b`), consertei com a coluna criada antes da 1ª consulta
   (`934b3ed`) e reverti de novo (`0403848`) porque o CRM seguia fora.
3. A causa que sobrou: a manutenção falhava numa etapa, apagava a marca e
   **rodava inteira de novo a cada tela**, por horas — oito tabelas reescritas
   por clique. Esgotou a cota grátis do Neon. **Meu também.**
4. O diagnóstico (`/api/diag`) confirmou: os DOIS endereços do projeto
   (`ep-gentle-truth-acybwmdr`, sa-east-1, com e sem pooler) não conectam. Não
   é código. Os dados estão intactos lá; é acesso bloqueado até o ciclo virar
   (provavelmente dia 1º — o painel do Neon diz a data).

O que ficou no banco do Neon por causa da migração revertida — inofensivo para
o código atual, mas saiba que existe: tabela `Usuario` (1 linha, login `admin`,
papel `gerente`), coluna `vendedorId` + índice nas 8 tabelas (carimbada), e as
chaves `manutencao.v45`/`v46` na Configuracao.

**EM USO DESDE 24/09: banco temporário no Supabase** (plano grátis, conta dele —
ele confirmou). O CRM subiu VAZIO de histórico e criou as 40 tabelas sozinho
(`lib/banco-do-zero.ts`). O que ele registrar lá desde então SÓ EXISTE lá: o
plano grátis do Supabase não tem backup e pausa o projeto depois de 1 semana sem
uso.

**A VOLTA PARA O NEON ESTÁ PRONTA (27/09) — falta só o Neon voltar:**
1. Na Vercel (prompt da extensão em `docs/PROMPT-VOLTA-NEON.md`): criar
   `DATABASE_URL_PROVISORIO` com o valor ATUAL de `DATABASE_URL` (o Supabase),
   pôr os endereços do Neon em `DATABASE_URL`/`DATABASE_URL_UNPOOLED` e
   republicar. `/api/diag` confirma: "principal: Neon · provisório: Supabase".
2. Ele abre Configurações → "Trazer os dados do banco provisório" → "Ver o que
   vai ser trazido" → "Trazer". Faz no MESMO dia da troca: parado, o Supabase
   grátis pausa depois de 1 semana.
   Como funciona: `lib/trazer-provisorio.ts` (motor) e `-regra.ts` (regras
   puras). Cliente casa por Google/telefone/nome-sem-telefone; conversa pelo
   número; mensagem pelo id do WhatsApp; o que é novo entra com o mesmo id
   (rodar de novo não duplica). Envio pendente chega CANCELADO, mensagem que
   falhou chega sem tentativas, trava do WhatsApp e de IA paga nunca vêm.
   Unificações/limpezas feitas no Supabase não vêm (ids de lá).
   Provado com dois Postgres (`scripts/provar-trazer-provisorio.ts`: 28
   conferências + mutação) e na tela, PC e celular.
3. Depois: ele pode apagar `DATABASE_URL_PROVISORIO` (e a cópia
   `DATABASE_URL_UNPOOLED_PROVISORIO`, que só serve para desfazer a troca)
   quando o card disser "tudo trazido". Só DEPOIS disso retomar o multiusuário.
   O prompt (30/09) confere que o deploy de produção é a versão nova antes do
   Redeploy e tem o Passo 6 — desfazer, se o Neon não conectar.

**29/09 — "Quero que volte logo para o Neon": o código de hoje no banco de
23/09.** Não dá para saber daqui em que pé o Neon ficou. Simulei os três
estados possíveis (cópia do banco de teste com as sobras do multiusuário e a
marca v45/v46) e rodei o build de produção, processo frio, 10 telas de uma vez
na 1ª requisição:
- A — colunas de 22/09 lá, marca v44 ausente (o mais provável): 10/10 — já
  passava; a manutenção roda uma vez.
- B — sem as colunas do "não perturbe" (v43): **quebrava 3 de 10** (Dashboard,
  Visitas, ficha) na 1ª rajada. Agora 10/10.
- C — sem as colunas E marca v44 "ok" (manutenção não roda): antes **nunca
  sarava**. Agora 10/10.
O conserto (`lib/coluna-que-falta.ts` + `lib/db.ts`): consulta que cai com
"a coluna não existe" cria as colunas que faltam (definição do DDL gerado do
schema, `ALTER … ADD COLUMN IF NOT EXISTS`, 4 s de espera pela trava) e repete
UMA vez; um conserto por vez, no máximo 1/min. Em transação não repete (o
conserto roda e a próxima tela acha a coluna). Tabela, obrigatória sem padrão,
índice e `NASCE_PELA_MIGRACAO` (Visita.status) ficam para a migração.
`/api/diag` ganhou a linha "estrutura: o que o código pede e o banco não tem"
(o prompt da extensão pede essa linha no Passo 5). E a volta
(`rodarVolta`) completa as colunas do principal ANTES de comparar os bancos —
sem isso, quem respondeu SAIR no Supabase voltaria sem a marca (provado:
`SEM_COLUNAS_DE_2209=1` no `provar-trazer-provisorio.ts`; sem o conserto, falha).
Provado contra Postgres de verdade: rajada, consulta crua, transação em lote
e interativa, coluna sem como criar, tabela travada (desiste em 4 s).

### O que entrou para isso não se repetir (23–24/09)

- `lib/saude-banco.ts` + `components/BancoForaDoAr.tsx` — o layout sonda o banco
  antes das telas; banco fora vira uma tela com o MOTIVO por extenso, não
  "Algo deu errado".
- `/api/diag` — testa peça por peça (variáveis, conectar, ler, ESCREVER,
  tamanho, endereço direto, serviços de fora). A tela de erro genérica tem o
  botão "Ver o que aconteceu" que leva a ele.
- `lib/db.ts` — endereço de reserva: falha de CONEXÃO no pooler prova o direto
  (`DATABASE_URL_UNPOOLED`) e segue por ele; tenta voltar ao principal 1×/min.
  Erro de consulta sobe igual.
- `lib/manutencao-retentativa.ts` — falhou, a marca guarda `falhou:<vezes>:<quando>:<erro>`
  e a próxima tentativa espera 5 min → 30 min → 2 h → 1×/dia.
- `lib/banco-do-zero.ts` + `lib/banco-do-zero-ddl.ts` (gerado) — o CRM nasce num
  banco vazio. **Mudou o schema → regere o DDL** (`scripts/gerar-banco-do-zero.py`).

### As travas de envio (o assunto da vez)

A Meta restringiu o WhatsApp dele por 24h depois de um disparo para 1.298
contatos. O que fecha isso agora:

- `lib/envio-limites.ts` — módulo **puro e testado**: janela (8h–18h de
  Brasília), teto do dia (80, somando TUDO que sai), pausa de 12–25s, rodapé
  com a saída da lista e o detector de "SAIR" em duas camadas.
- `lib/envio-guarda.ts` — o lado do banco: quanto já saiu hoje, quem pediu para
  sair, **quem nunca falou com a gente**. A peneira de contato frio é a trava
  que mais importa: denúncia derruba número muito mais rápido que volume.
- `lib/mensagem-clientes-actions.ts` — **o funil único**. Os dois caminhos de
  envio em massa (o "enviar agora" da tela e o despachante do programado)
  passam por `enviarMensagemClientesAction`, e é por isso que as travas moram
  lá dentro. Trava que só existe em um dos caminhos não é trava — o botão da
  tela não tinha nenhuma, e era ele o caminho que derrubou o número.
- `lib/aniversario-automatico.ts` — o parabéns respeita `naoPerturbe`, janela e
  teto. Não aplica a peneira de contato frio, **de propósito**: são 3 ou 4 por
  dia, com o nome da pessoa, e cortar custaria relacionamento sem proteger o
  número.
- O card **"Travas de envio do WhatsApp"** (que mostrava quanto já saiu contra o
  teto e deixava mudar teto e horário) SAIU de Configurações em 01/10, a pedido
  dele; os limites padrão continuam valendo, sem tela.

Se for mexer nisso: a tela **não pode prometer número que não vai cumprir**.
`checarEnvioAgoraAction` confere a relação no servidor e devolve os ids, para o
botão dizer quantos realmente recebem e o laço percorrer só esses.

## Regras que não se negociam

**Elas moram no `CLAUDE.md`, na raiz do repositório, que é lido sozinho no
começo de toda sessão. Leia de lá — aqui só ficava uma segunda cópia, e duas
cópias da mesma regra divergem.**

O que é bom saber antes de abrir:

- **As 3 perguntas** (item 0 do CLAUDE.md) valem para toda alteração, e a
  resposta delas vai VISÍVEL no fim de cada entrega. Se faltar o bloco de
  Conferência, o padrão não rodou.
- **Empurre para as DUAS branches**, sempre. A branch **local** `relaxed-cori`
  está 148 commits atrasada e é lixo — nunca faça checkout nela nem empurre a
  partir dela; use o refspec que está no CLAUDE.md.
- Armadilha de teste que já me enganou: `getByRole("link", {name:/WhatsApp/})`
  pega o **menu lateral**, não o botão da página — quase virou caça a um bug
  inexistente.

## Armadilhas deste código (aprendidas no couro)

- **Prisma: dois `OR` no mesmo objeto se apagam** — o último vence e o filtro
  perdido some sem erro nenhum na tela. `SEM_PROSPECT_IA` já é um `OR`. Todo
  filtro novo que precise de `OR` entra como item do `AND`.
- `origem <> 'prospect_ia'` é **NULL** (falso) quando origem é nula. Idioma da
  casa: `{ OR: [{ origem: null }, { origem: { not: "prospect_ia" } }] }`.
- Arquivo `"use server"` **só exporta função async** — constantes e tipos vão
  para um módulo puro ao lado.
- Schema do Prisma **não aceita `/** */`** em campo, só `//`.
- `Cliente` **não tem** relação `conversas` (WhatsAppConversation guarda
  `clienteId` sem volta). `Cliente.status` é NOT NULL.
- Camadas: rodapé `z-40`, modais `z-50`/`z-[100]`, lembrete de visitas
  `z-[150]`, seletores de data/hora `z-[300]`. Há um teste que trava isso
  (`tests/seletor-data-na-frente.test.ts`).
- Fuso: servidor em UTC, vendedor em Brasília (UTC-3 o ano todo). Toda hora que
  ele digita é a hora **dele**.
- `npx prisma generate` exige `DATABASE_URL_UNPOOLED` no ambiente.
- **Playwright não corta a rede do service worker** com `context.setOffline`:
  a página fica "sem internet", mas o worker continua buscando no servidor e
  tudo parece funcionar. Para testar sem sinal de verdade, derrube o servidor
  (pelo PID) E ligue o setOffline. E espere `navigator.serviceWorker.controller`
  antes de cortar: a tela entra no cache já na instalação, mas o worker só
  assume a página no activate.
- Camada do aviso do modo sem sinal: `z-[90]` (abaixo das janelas). No
  Atendimento só aparece o aviso de sem internet — o rodapé ali é a caixa de
  mensagem.

## Sandbox

- Postgres: `/var/lib/postgresql/crmtest-pg`, porta 5433. **Ele cai sozinho** —
  religue com (se reclamar de "another postmaster", apague o
  `postmaster.pid` antes):

  ```bash
  su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/crmtest-pg -o '-p 5433' -l /tmp/pg.log start"
  ```

  Bancos: `crmtest` (1.298 clientes de amostra) e `crmvazio*` (vazios, para
  provar o banco-do-zero). Para provar o "código novo, banco velho", derrube a
  coluna no `crmtest` antes de buildar.

  Erro de Prisma "Can't reach database server" quase sempre é isso, não o
  código.

- Servidor local:

  ```bash
  DATABASE_URL="postgresql://postgres@localhost:5433/crmtest" \
  DATABASE_URL_UNPOOLED="postgresql://postgres@localhost:5433/crmtest" \
  APP_PASSWORD=teste123 AUTH_SECRET=<qualquer coisa longa> \
  npx next start -p 3118
  ```

  (`CRON_SECRET=...` também, se for testar cron.) Libere a porta com
  `fuser -k -n tcp 3118` — **nunca** `pkill -f "next start"`, mata o shell.

- **Sem rede de saída.** Não dá para verificar Google, PNCP, Evolution nem IA
  daqui. Quando algo depender disso, diga que não verificou, em vez de supor.
  Já houve erro assim: afirmei que o PNCP devolvia 400 e a foto dele provou 429.

## Feito em 27/09 (além da volta para o Neon e das versões do texto)

- **Trava de IA paga sem brecha.** Antes só valia para o texto; imagem/PDF,
  agente do chat, Cérebro (Anthropic direto), arte da OpenAI e transcrição
  pela OpenAI passavam por fora. Agora todos perguntam `pagoLiberado()`
  (`lib/ai/trava-gasto.ts`); a tela diz que é a trava quando recusa.
- **Teto diário da análise a cada mensagem** (`lib/zeus/teto-orientador.ts`):
  250 por dia (`ORIENTADOR_TETO_DIARIO`), reserva atômica no banco; acabou, a
  conversa fica agendada para o dia seguinte e o ZEUS avisa. "Reanalisar" não
  conta.

- **Números do piloto** (tela `/piloto`, menu Análise): os três números que a
  proposta prometia construir (tempo até a 1ª resposta, negociações abertas
  pela IA, conversas de venda que viraram negociação) e os critérios 1–3 da
  seção 10. Régua em `lib/piloto-regra.ts` (testada), conta em `lib/piloto.ts`,
  prova com Postgres em `scripts/provar-numeros-piloto.ts` (25 conferências).
  - Envio em massa e parabéns automático agora gravam rótulo próprio
    (`Envio em massa` / `Aniversário automático`) no lugar de "Você" — senão a
    campanha contava como resposta. O rótulo aparece em cima da mensagem no
    Atendimento. **Caminho novo de envio automático tem de gravar rótulo**.
  - Mensagens de massa ANTIGAS continuam como "Você" (não dá para separar):
    no histórico de antes de 27/09 elas ainda podem fechar uma espera.
  - O critério 2 precisa do número de antes: o ZEUS anota as negociações
    esfriando uma vez por dia desde 27/09 (`piloto.esfriando`).
  - A "conversa de venda" é o palpite da IA (CLIENTE/LEAD). A tela deixa
    corrigir ("É venda"/"Não é venda") e mostra quantas ele tirou à mão.
  - **Decisão dele:** o documento da diretoria ainda diz "precisa ser
    construído" (4.4) e cobra "proteções e números do piloto 20 h" na
    implantação. Teto de IA e números do piloto estão prontos. Não mexi no
    documento: atualizar o texto e manter ou baixar as horas é escolha dele.

## Feito em 28/09 — modo sem sinal

Pedido: "faça a parte do crm rodar offline, para ter acesso a visitas, e poder
agendar ou concluir uma visita, inserir uma nova negociação no funil, e os
demais dados assim que a internet chegar tudo atualiza".

- **Tela `/sem-sinal`** (menu Principal → "Modo sem sinal"; fora do grupo
  `(app)` porque aquele layout consulta o banco antes de tudo). Abas Visitas,
  Clientes, Funil e Pendentes; botões Agendar visita e Nova negociação. Lê só o
  que está no aparelho (IndexedDB, `lib/sem-sinal-local.ts`).
- **Service worker** (`src/app/sw.js/route.ts`): sem rede, QUALQUER tela do CRM
  vai para `/sem-sinal?de=<tela>`. Telas normais deixaram de sair do cache
  (mostravam número velho com botão que não fazia nada). A tela do modo sem
  sinal e todos os arquivos dela ficam guardados na instalação do worker e a
  cada 10 min; `/_next/static` sai do cache (nome com versão). Aparelho que
  nunca guardou vê uma página explicando, não o erro do navegador.
- **Pacote** (`GET /api/sem-sinal/pacote`, `lib/sem-sinal-servidor.ts`):
  visitas de 60 dias atrás a 180 à frente, clientes (mesmo recorte da tela de
  Clientes, teto 20 mil), negociações abertas, colunas, municípios, catálogo.
  Baixado pelo `SincronizadorOffline` (layout do app) no máximo a cada 30 min
  com a tela aberta, e sempre que a internet volta.
- **Fila** (`POST /api/sem-sinal/sincronizar`): agendar, concluir (com relato)
  e negociação nova sobem em ordem pelo MESMO caminho da tela com internet —
  `criarVisitaNoBanco` (novo, `lib/visita-criar.ts`, usado também por
  `adicionarVisita`), `registrarVisitaDoDiaAction` (relato lido pela IA) e
  `criarNegociacaoCompleta` (aceita `id`). Visita e negociação nascem com o id
  do aparelho: subir duas vezes acha a primeira. Concluir confere se a visita
  já está como ele deixou. Cliente novo com telefone que já existe → usa o
  cadastro existente e avisa. Coluna renomeada no meio → primeira coluna de
  negociação e avisa. Cliente/visita apagados no meio → recusa com motivo, e a
  aba Pendentes oferece Tentar de novo / Descartar.
- Sessão caída ao voltar a internet: repõe pelo token guardado
  (`lib/sessao-local.ts`, agora usado também por AuthPersist e
  EntradaAutomatica) e continua.
- **`/sw.js` e `/manifest.json` saíram de trás do login** (middleware). O
  worker desviado para /login não instala ("script behind a redirect"): depois
  de entrar pela senha ele ficava sem instalar até a próxima recarga — sem
  worker não havia modo sem sinal nem notificação.
- Auditoria: ação nova `offline_sincronizado` ("Subiu do modo sem sinal: …").
- Prova: `tests/sem-sinal-regra.test.ts` (30) + roteiro Playwright com servidor
  derrubado (ver Armadilhas) em 390/1440 e nos dois temas.
- **Não conferido:** Safari/iPhone de verdade (não há Safari aqui). O que o
  iPhone precisa (Cache, IndexedDB, BroadcastChannel, `navigator.locks`,
  `crypto.randomUUID`) existe do iOS 15.4 em diante; `randomUUID` e a trava
  têm alternativa para aparelho mais velho.

### Mesmo dia, depois do teste dele: "funcionou somente a parte das visitas"

Sem rede, TODA tela ia para o modo sem sinal — ele via as visitas e mais nada
do CRM. Agora:

- **As outras telas abrem como cópia para ler** (`lib/sem-sinal-telas.ts`;
  o worker saiu da rota para `lib/sw-codigo.ts`). Tela aberta com internet
  vira cópia de graça (o servidor já montou); as 6 principais (Dashboard,
  Negociações, Visitas, Clientes, Alertas, Demandas) são guardadas por trás,
  no máximo 1×/hora cada (peso no banco grátis); a tela aberta por dentro do
  app (a ficha do cliente) é pedida de novo ao servidor, também 1×/hora.
  Teto de 40 cópias. Endereço com filtro (`?…`) não vira cópia. WhatsApp,
  Conexão, Configurações, Central, ZEUS e Auditoria nunca viram cópia.
- **A tela diz que é cópia e de quando** ("Sem internet · esta tela é a cópia
  guardada hoje às 11:02, só para ler") — o layout manda a hora em que montou
  a tela, e o `SincronizadorOffline` compara com a hora em que o aparelho a
  abriu (`ehCopia`, folga de 3 min para relógio adiantado).
- **Tela com erro não vira cópia** (a marca `data-crm-tela="ok"` só sai com o
  banco de pé; `$RX` ou `<template data-dgst>` que não seja o do mapa = pedaço
  que caiu). Sem isso, um "banco fora do ar" apagaria a cópia boa.
- O modo sem sinal ganhou a faixa **"Telas guardadas, para ler"** (atalho para
  cada cópia, com a hora), o **motivo** quando uma tela veio parar ali ("ainda
  não tem cópia" / "só funciona com internet"), o motivo quando o preparo
  falha (antes: "guardando agora" para sempre) e a aba **Clientes mostra a
  lista sem precisar buscar** (60 primeiros em ordem alfabética).
- A tela de erro do app, sem internet, diz "Sem internet para isto" e leva ao
  modo sem sinal, em vez de "Algo deu errado".
- **Defeito achado no caminho, sem relação com o offline:** a tela
  **Demandas caía inteira** COM internet ("Algo deu errado nesta página") desde
  15/09 (`075c231`): `DemandasLista` importava `ROTULO_ORIGEM` de
  `lib/demandas.ts`, que abre o banco — o Prisma ia para o navegador. O rótulo
  mudou para `lib/demandas-rotulos.ts`; `tests/cliente-sem-banco.test.ts`
  varre todo "use client" atrás do mesmo erro (só havia este).
- **Defeito do próprio modo sem sinal, pego no teste:** a lista de arquivos da
  tela cortava o nome no parêntese (`app/(app)/…`), e a cópia ficava sem o
  script dela. `tests/sw-worker.test.ts` roda o worker gerado num navegador
  de mentira (cache, rede e eventos falsos) — 14 casos, incluindo este.

### Mesmo dia, em seguida: "precisa manter as negociações mostrando"

As negociações JÁ apareciam sem internet (a cópia de Negociações tem o funil
inteiro — conferido). O que fazia uma negociação sumir:

- **A aberta no modo sem sinal não aparecia em Negociações nem na ficha**
  até subir e a cópia ser refeita (a cópia é um retrato de antes). Agora as
  duas telas mostram à parte "Feitas sem sinal neste aparelho", com o estado
  (esperando sinal / não subiu + motivo / já subiu, mas a tela é de antes) —
  com e sem internet (`NegociacoesFeitasSemSinal`, regra
  `negociacoesForaDaTela`: pendente, recusada, ou enviada depois de a tela ser
  montada — hora do servidor dos dois lados).
- **Com a internet de volta, a tela aberta não mostrava a que acabou de
  subir** até recarregar. O `SincronizadorOffline` remonta a tela
  (`router.refresh`) quando a subida manda alguma coisa — menos na cópia, onde
  a faixa oferece "Atualizar".
- **A cópia ficava até 1 hora sem a mudança** (card arrastado, negociação
  nova): se ele saísse do sinal nesse meio, a cópia não tinha. O worker agora
  vê o que grava e renova as principais + a tela onde mudou, 15 s depois da
  rajada, no máximo a cada 3 min; a subida do modo sem sinal não espera o
  intervalo e ainda avisa as fichas dos clientes que subiram
  (`fichasDoQueSubiu`, mensagem `telas-mudaram`).
  **Cuidado que o teste pegou:** o app pede as visitas do dia por uma ação ao
  abrir QUALQUER tela; contar todo POST faria cada abertura remontar as seis
  telas no banco. Ação só conta com `x-action-revalidated` = `[[],1,…]`, e
  quem lê é a TELA (`vigiarAcoesQueGravam`, que só observa o fetch) e avisa o
  worker (`telas-mudaram`). Primeiro fiz o worker ler a resposta, passando a
  ação por dentro dele: funcionava no Chromium, mas punha todo o gravar do
  CRM nas mãos do worker, e no iPhone não dá para provar — desfiz. Rota /api
  conta pelo caminho (`mudaAsCopias`: nem WhatsApp, nem relatório de erro,
  nem push).
- Aba "Funil" do modo sem sinal virou **"Negociações"** (a palavra do menu);
  coluna mais larga para não cortar no celular.

## Em aberto (ofereci, ele não respondeu)

- ~~**Pós-venda:** "Resolvido" definitivo~~ — **FEITO (27/09):** volta quando
  vence um marco DEPOIS do clique (`posVendaVoltou`, `lib/pos-venda-marcos.ts`).
- ~~**Lista de bloqueio** apagando cliente de verdade~~ — **FEITO (27/09):** a
  limpeza por termo nunca apaga quem tem negociação, visita, pós-venda ou
  compra (`lib/limpeza-protecao.ts`); só sai assim por decisão dele (asterisco
  ou excluir à mão). O cartão lista quem ficou. E a limpeza por termo agora
  guarda recibo (cadastros, conversas, mensagens, lápides) e tem "Desfazer" no
  histórico de "Cadastros sem identidade"; quem volta pelo desfazer fica em
  `limpeza.bloqueio.excecoes` e não é apagado de novo na rodada seguinte.
  Os termos largos (`central`, `brasil`, `dynapac`, `crm`) CONTINUAM na lista
  dele — não mexi na lista sem ele pedir; o cartão sugere tirar.
- ~~Lead score com nomes antigos das fases~~ — **FEITO (27/09):** lê a
  probabilidade da coluna do funil (`criarProbabilidadePorEstagio`).
- ~~Auditoria sem ZEUS/Cérebro~~ — **FEITO (27/09):** `lib/auditoria-regra.ts`.
- **IA:** a espera curta do Groq (~8s) e acrescentar Cerebras/Mistral/OpenRouter
  como provedores grátis extras.
- **Nunca foi respondida** a pergunta dele sobre "memória": memória de conversa
  por cliente × o CRM aprender o jeito dele de vender. Se ele retomar, vale
  abrir.

## Documento da diretoria — atualizado em 27/09

`docs/APRESENTACAO-DIRETORIA.md`. O que ele informou e o que decidi por ele:

- **Time: cerca de 26 vendedores**, 6 da linha amarela e **cerca de 20** da agrícola
  (ele não tem o número exato da agrícola; o documento diz "cerca de" e as contas
  usam 26). **Margem da casa: cerca de 10%** por máquina.
- **Ele não sabe o valor da licença e pediu que eu estimasse.** Ficou: licença
  R$ 200 de tabela / R$ 140 de cliente fundador; implantação por hora (R$ 100/h,
  100 h para o piloto + 90 h para o time, só se o piloto aprovar; licença e
  manutenção só começam quando o time entra — decisão minha, avisada no documento); manutenção
  20 h/mês = R$ 2.000, sem desconto; o plano do Claude (Max 5x, US$ 100 + IOF =
  R$ 535) virou linha própria, "ferramenta de manutenção". Método na seção 7.
  Preço do Claude conferido em claude.com/pricing em 27/09 (a página abre daqui).
- **O CRM hoje é só da linha amarela:** o `schemaInstrucao` em
  `src/lib/ai/index.ts` diz à IA que não existe agrícola. A agrícola é a fase 5,
  depois do piloto.
- **A fábrica (CNH: New Holland e Case) quer comprar o produto** — mais de 500
  vendedores, além de outras empresas. Ele disse: "por hora é somente para a
  diretoria". Não ponha a fábrica no documento da diretoria. O documento diz
  **licença não exclusiva** e manda ver advogado antes de assinar (Lei
  9.609/98, art. 4º): é isso que mantém a porta da fábrica aberta. Para vender
  à fábrica, o CRM precisa virar produto: multiempresa (não só multiusuário),
  marcas e linhas configuráveis (54 arquivos citam "New Holland" e 33
  "Dynapac"), linha agrícola e Case, WhatsApp oficial e suporte que não dependa
  de uma pessoa só.
- **Ele pediu o CRM funcionando offline** ("preciso que o claude funcione off
  line"; às vezes ele chama o CRM de "claude"). Hoje o `sw.js` só devolve do
  cache a última versão das telas já abertas e não grava nada sem rede. Entrou
  no documento como "modo sem sinal" (fase 5), mas para ele pode vir antes,
  como demanda própria.
- `docs/PROMPT-APRESENTACAO.md` usa os mesmos números. `docs/CRM-PRODUTO.md`
  (22/09) tem as faixas antigas e aponta para o documento novo.

## O pacote de produto (pedido dele, ainda aberto)

Ele pediu um pacote para levar à diretoria. O Orientador do vendedor saiu; o
resto continua aberto:

- **Multiusuário** — decisões DELE já tomadas: cada vendedor vê **só os
  dele**; **gerente vê tudo** (mas não edita carteira alheia nem envia pelo
  número de ninguém); **WhatsApp por vendedor fica para depois** do isolamento.
  Etapas: 1/3 isolamento automático no banco · 2/3 login por pessoa e cadastro
  · 3/3 visão do gerente.
  A etapa 1 foi construída e provada (nenhum vazamento em findMany, count,
  updateMany, findUnique, deleteMany), subiu, **derrubou o CRM** e foi
  revertida — o código está em `934b3ed`, com `lib/tenant.ts` (AsyncLocalStorage),
  a extensão do Prisma em `lib/db.ts`, `lib/senha.ts` (PBKDF2) e os stubs de
  navegador no `next.config.mjs`. Para reentrar, **em DOIS deploys**:
  (1) só SQL — tabela `Usuario`, coluna `vendedorId` + índice, carimbo — SEM
  mexer no schema.prisma; ele abre o CRM e confirma em Configurações;
  (2) aí o schema, o tenant e o filtro. Antes de empurrar o (2): rodar com
  código novo e banco velho (regra do CLAUDE.md). Atenção: o `lib/db.ts` de hoje
  tem o endereço de reserva — o filtro por vendedor precisa valer nos dois
  caminhos, não só no principal. E regere o DDL do banco-do-zero.
- ~~**Orientador novo**, que analisa o VENDEDOR~~ — **FEITO.** É a seção "Como
  você vende" (`/como-voce-vende`), com a leitura opcional por IA e a aba
  "Feito para você" na Academia. O Orientador do Atendimento continua como
  estava.
- **Auditoria seção por seção** (objetivo, integrações, ganhos, o que remover).
- ~~**3 textos que se revezam** no envio em massa~~ — **FEITO (27/09).** Marketing →
  "+ Revezar com outras versões do texto". As versões moram no mesmo campo
  `EnvioProgramado.texto`, separadas pela marca ⟪variação⟫ (sem coluna nova);
  cada cliente recebe sempre a mesma (sorteio pelo id). A limpeza de falhas
  procura pelas 3 versões. Regras em `lib/envio-variacoes.ts`.

Já escritos: `docs/CRM-PRODUTO.md` e `docs/PROMPT-APRESENTACAO.md`.

## Como ele trabalha

Manda pedidos curtos com print, muitas vezes no meio de outra tarefa. Corrige
com franqueza ("não gostei", "remove isso logo") e **quer opinião honesta, não
concordância** — pediu explicitamente avaliação "sem querer me agradar" e
aceitou encolher a tela do Orientador por causa dela. Quando um pedido dele tem
consequência que ele não viu (contraste, exclusão irreversível, escolha que se
desfaz sozinha), diga em uma ou duas frases e **faça assim mesmo** o que ele
pediu; não trave a entrega.
