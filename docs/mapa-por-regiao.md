# Mapa por região (Dashboard e Visitas)

Pedido dele (23/10/2026), com a foto do **Mapa do Turismo Capixaba 2025**
(Secretaria de Turismo do ES, atualizado em 27/05/2025): os mapas do CRM mostram
as **divisas entre as cidades**; as que ele atende saem **coloridas** (a cor da
região, como na foto) e as que não atende saem **cinza escuro**. Na revisão do
mesmo dia (ele não gostou da textura): divisa **preta**, preenchimento **opaco** e
o **nome de cada cidade escrito dentro dela**.

## Onde está

| Peça | Arquivo |
|---|---|
| Desenho das divisas dos 78 municípios | `src/lib/malha-es.json` (gerado por `scripts/gerar-malha-es.py`) |
| Regiões, cores e regra de cor (puro, sem banco) | `src/lib/mapa-regioes-es.ts` |
| Quem ele atende (vai no `MapaDaArea.atendidos`) | `mapaDaArea()` em `src/lib/area-atuacao.ts` |
| Camada no Leaflet (cidades, contorno do estado, realce) | `src/components/CamadaMunicipiosES.tsx` |
| Nomes escritos dentro das cidades (regra, puro) | `src/lib/mapa-rotulos-es.ts` |
| Nomes no Leaflet (camada própria, não recebe toque) | `src/components/RotulosMunicipiosES.tsx` |
| Legenda embaixo do mapa | `src/components/LegendaMapaRegioes.tsx` |
| Testes (unidade) | `tests/mapa-regioes-es.test.ts` (malha, regiões, cor, camadas, dica) e `tests/mapa-rotulos-es.test.ts` (onde o nome cabe) |
| Prova na tela (PC 1440 e celular 390, claro e escuro) | `scripts/e2e-mapa/` — precisa de navegador, banco de teste e build; como rodar no README de lá |

## Como decide a cor

- **Atende** = município marcado em Configurações → Área de atuação. Sem área
  salva, vale a marca `foraDeArea = false` do banco (a mesma que as listas
  "Cidades que atendo" já usam). O nome casa sem acento e sem diferença de caixa.
- Atende → cor da região (10 regiões da foto). Não atende → cinza escuro `#555c68`
  (`COR_NAO_ATENDO`). Divisa preta `#000000` (`COR_DIVISA`), preenchimento **opaco**
  (`fillOpacity 1`): com 0,8/0,5 a base do OpenStreetMap — ruas, rios e os nomes do
  próprio mapa — aparecia por baixo da cor e "sujava" ("textura", 23/10).
- A foto tem também um cinza ("Município não integrante": 8 cidades que não
  fazem parte de nenhuma região turística). **Aqui cinza quer dizer "não atendo"**,
  então essas cidades, quando ele as atende, saem em **lilás** (`SEM_REGIAO`) e
  a legenda diz "Fora das regiões turísticas".
- Não deu para ler a lista (banco sem resposta): `atendidos = null`, o mapa fica só
  com as divisas, sem cinza (cinza diria "não atendo" sobre o que o CRM não sabe)
  e a legenda avisa.
- Nenhuma cidade marcada: tudo cinza e a legenda manda para Configurações.

## Os nomes das cidades

`lib/mapa-rotulos-es.ts` (puro) decide, para o zoom e a tela atuais, onde cada nome
cabe. O nome só é escrito se o retângulo dele ficar **inteiro** dentro da cidade
(nenhuma divisa passa por ele), **inteiro** dentro da parte visível do mapa e longe
de pin de visita, cifrão de venda, botões do mapa (+ / −, créditos) e do trajeto do
dia. Tenta 12 → 11 → 10 px (menos que 10 não se lê no celular), em uma linha e depois
em duas. Quem não cabe fica sem nome: continua na dica ao passar/tocar, e aproximar
com o (+) acrescenta nomes (zoom 9: ~46 de 78; zoom 10: ~70).

- **Na abertura quase não há nomes** (zoom ~8: PC ~5, celular ~2): a cidade tem ~50 px
  e "Cachoeiro de Itapemirim" tem ~110. É o limite físico — a legenda avisa. O mapa abre
  em passos de 1/4 de zoom (`zoomSnap`) para aproveitar a caixa.
- O ponto de partida de cada nome é o `c` da malha (ponto do maior pedaço mais longe de
  qualquer divisa, calculado em `scripts/gerar-malha-es.py`). A malha também é
  **normalizada** ali: Vitória, Vila Velha, Guarapari e Ibiraçu vêm da fonte com as ilhas
  como anéis soltos e o contorno principal por último; viram polígonos próprios.
- O texto vai com **a mesma letra que foi medida** (`FAMILIA_ROTULO`, sem aspas duplas:
  ela entra num `style="…"`; com aspas o atributo fechava no meio e o nome saía na cor
  da página).
- Sem a lista das cidades que ele atende (`atendidos = null`) não há nomes: não há cor
  de fundo para combinar com o texto. Se a conta falhar, o mapa segue só com cores e
  dica, e o contêiner marca `data-rotulos="erro"`.
- Camadas: azulejos (200) → contorno grosso do estado (340) → cidades (350) → nomes
  (380) → trajeto/pins/cifrões (400/600). As alturas são constantes (`Z_CONTORNO_ESTADO`,
  `Z_MUNICIPIOS`, `Z_NOMES` em `mapa-regioes-es.ts`) e o teste trava a ORDEM: fora dela o
  mapa quebra sem erro nenhum (cidade opaca por cima dos nomes, ou toda divisa interna
  virando traço de 4 px). O contorno grosso é o mesmo desenho em traço de 4 px por BAIXO das
  cidades opacas: só a metade de fora aparece (sem as ilhotas, que viravam bolhas pretas
  no mar). A camada do contorno fica sempre montada (só o desenho some sem a lista):
  montar/desmontar deixava um renderizador SVG órfão no mapa.
- **Onde o nome é procurado** (revisão independente, 24/10): na parte da cidade que
  APARECE na tela (`caixaVisivel`, recorte do anel pela tela), não na caixa da cidade
  inteira. Cidade grande vista de perto, com o ponto `c` fora da tela, ganha o nome no MEIO
  do que aparece (antes ia para o canto mais perto do ponto). A busca é do grosso para o
  fino (`acharLugar`): uma grade grossa, testada com o retângulo do texto ENCOLHIDO (se o texto
  cabe num ponto, o encolhido cabe em tudo que está a até meio passo dele — nenhum lugar
  escapa), e, em volta de cada ponto que passou, 1 px com o retângulo inteiro. O custo não
  cresce com o tamanho da janela (teto: a tela), e a resolução é ~1 px — uma folga mais estreita
  que isso pode escapar. O passo fixo de 4 px do começo saltava por cima de faixas estreitas, e
  a busca na caixa INTEIRA da cidade custava > 1 s por arrasto num polígono sintético de 6000
  vértices (a malha real tem no máximo 263 por anel; no real o antigo gastava ~100 ms no
  celular, zoom 13).
- **CSS do nome**: `.leaflet-marker-icon.rotulo-municipio` (DUAS classes) em `globals.css`.
  O `leaflet.css` carrega depois, junto do mapa, e com uma classe só o `display:block` dele
  vencia o `flex`: cada linha ocupava 18 px em vez de 14 e o nome de duas linhas saía mais alto
  que a caixa medida, encostando na divisa. O teste lê o seletor; o e2e confere `display:flex`
  e que o texto está inteiro e centrado dentro da caixa.

## A dica da cidade (passar o mouse / tocar)

"Cachoeiro de Itapemirim · Sul Capixaba dos Vales e Café · você atende". É por ela que ele
lê o nome das cidades onde o texto não cabe (na abertura são poucas).

- **Direção pelo que CABE** (`direcaoDaDica`), nesta ordem: centrada em cima (embaixo se ele
  está colado no topo) → de lado, para o lado com mais espaço (nos cantos é empurrada para dentro,
  porque aberta de lado ela fica centrada na vertical) → em cima/embaixo mas DESLOCADA para o lado
  até caber (o único jeito em mapa estreito: o Dashboard no celular tem 324 px e a dica, 220 mais a
  seta). Os botões +/− e os créditos ficam POR CIMA da dica (z-index maior), então ela desvia do
  retângulo deles. Antes era fixa em cima e saía do mapa em todas as bordas (medido, inclusive
  no PC) — e as cidades do norte, justo as cinzas, ficam coladas no topo e na direita.
- **Celular (sem mouse, `(hover: none)`)**: abre ao tocar e FICA aberta até ele tocar em outra
  cidade (troca, nunca duas), tocar no mapa vazio, mover/aproximar o mapa ou girar o aparelho. O
  Leaflet fecha a dica no `mouseout`, e o Chromium em modo celular manda um logo depois do
  toque: antes desta mudança a dica abria e sumia na hora (A/B contra o build anterior).
  **Num celular de verdade (iPhone/Android) isto não foi visto.** No PC só a direção da dica
  mudou; abrir ao passar e fechar ao sair é igual. Em aparelho com `(hover: none)` e mouse a
  dica só fecha no próximo clique (decisão registrada em `CONTINUAR.md`).
- O realce da cidade sob o mouse (divisa 3) não se perde quando o mapa atualiza: as funções de
  estilo são estáveis (antes o `setStyle` reaplicava o estilo nas 78 cidades a cada render).
- Não conferido: o toque emulado do Chromium aproxima 1 nível ao tocar no mapa vazio (igual no
  build anterior; vem do Leaflet com o toque emulado). Se acontecer num celular de verdade, é
  um defeito antigo, não desta mudança.

## Se ele quiser outro agrupamento

Só uma tabela: `MUNICIPIOS_POR_REGIAO` + `REGIOES_TURISTICAS` em
`src/lib/mapa-regioes-es.ts`. O teste trava os 78 municípios, cada um em uma só
região. Alternativas já existentes no CRM: as 5 regiões de rota dele
(`REGIOES_MUNICIPIOS` em `src/lib/regioes.ts`: Caparaó, Litorânea, Granito,
Serrana, Das Santas) e as 10 regiões de planejamento (A Gazeta / Secretaria de
Economia e Planejamento).

## De onde veio

- **Cores e agrupamento**: lidos da foto. Cada município foi conferido pela **cor
  do pixel** no rótulo (a leitura a olho errou o Bom Jesus do Norte, que é cinza
  na foto). Contagem por região: 5 · 7 · 5 · 8 · 8 · 7 · 8 · 6 · 11 · 5 + 8 sem região = 78.
- **Divisas**: malha municipal do IBGE (qualidade mínima) em GeoJSON do
  repositório público `tbrugz/geodata-br`, coordenadas arredondadas a 4 casas
  (~11 m). Vai junto com o código: não depende de internet nem de serviço de
  terceiro (só os azulejos do OpenStreetMap por baixo precisam de sinal).
- Outro estado (quando for liberado em `UFS_LIBERADAS`): sem divisas no código,
  o mapa continua só com o contorno do estado vindo do IBGE (`UFS_COM_MALHA`).
