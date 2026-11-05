# Desenho das melhorias de aderência (só desenho, nada implementado)

Origem: `prompt-crmaquinas.md` (suporte, uso, dashboard, metas, gamificação,
gestão de equipe, jornada do lead, objeções). Este documento diz **como cada
etapa seria feita**, o que ela toca no CRM que já existe e o que ela custa em
banco e em CPU da Vercel. **Nada aqui foi construído.** O CRM continua em
fase de teste, e toda etapa nasce desligada (seção 2).

Complementa, sem repetir: `docs/CRM-PRODUTO.md` (usuários, WhatsApp por
vendedor, preço) e `docs/crm-como-produto.md` (fases 0 a 3, riscos).

---

## 1. Onde o CRM está hoje (lido no código)

- Next.js 14 (App Router), Prisma, Postgres no Neon, Vercel com cron diário.
- **Uma senha para o CRM inteiro** (`APP_PASSWORD`, cookie assinado). Não há
  usuário, papel, vendedor nem gestor.
- **Nenhuma tabela tem dono ou empresa.** Todo dado é "do vendedor"
  implicitamente.
- Metas: só `metaAnualVendas`, `metaVisitasSemana` e `metaNegociosSemana` em
  Parâmetros, lidas por `lib/metas.ts`, dashboard, painel do Zeus e a tela de
  Parâmetros.
- Negociação guarda só o **estágio atual** (`estagio`, `status`, `faturadoEm`).
  Não guarda a data em que entrou em cada etapa.
- Cliente já tem `origem` (texto livre) e `indicadoPor` (quem indicou).
- Funil = tabela `ColunaFunil` (título, ordem, papel, probabilidade),
  editável pelo vendedor.
- Anexos de envio ficam em `MidiaEnvio` (base64 no banco).
- Registro de ações da IA/sistema: `AuditLog`. Não registra login nem uso.
- Alertas: tabela `Alerta` com `chave` de deduplicação e central de alertas.
- Notificação push: `lib/push.ts` e o worker em `lib/sw-codigo.ts`.

## 2. Regras que valem para TODAS as etapas

1. **Tudo nasce desligado.** Cada etapa tem uma chave em `Configuracao`
   (`recurso.suporte`, `recurso.metas`, ...). Só a palavra exata `"ligado"`
   liga; ausente, vazio, valor estranho ou banco fora do ar = desligado.
   Mesmo padrão da trava de envio. Em fase de teste isso garante que o uso
   atual não muda.
2. **Só tabela nova e coluna nullable.** Nenhuma coluna obrigatória, nenhum
   `DROP`, nenhuma troca de tipo. Tabela nova não derruba código novo com
   banco velho. Coluna nova derruba (regra 8 do `CLAUDE.md`), então cada
   coluna nova entra com: teste "código novo + banco velho", `CHAVE_MANUTENCAO`
   subida, DDL do banco do zero regerado e decisão em `trazer-provisorio`
   (tabela nova: entra em `ETAPAS` ou em `TABELAS_QUE_NAO_VEM`).
3. **Reversível.** Desligar a chave volta ao comportamento de hoje. As tabelas
   novas ficam paradas e não atrapalham.
4. **Orçamento de CPU.** Nenhum polling. Nenhuma métrica recalculada a cada
   abertura de tela. Contagem pesada = agregado por dia, gravado por cron ou
   por escrita incremental, e a tela lê o agregado. Cada etapa abaixo diz o
   que roda e quando.
5. **IA só gratuita por padrão.** Todo texto gerado por IA passa por
   `pagoLiberado()`. Sempre existe um texto de reserva sem IA. Nada gera
   fatura sem você escolher.
6. **Escrita revalida a tela** (`revalidatePath`), para a cópia do modo sem
   sinal não ficar velha. Telas novas ao vivo entram em `TELAS_SEM_COPIA`.
7. **Os quatro estados em toda tela nova:** carregando, vazio, erro, sucesso.
   Falhou, a tela diz que falhou.
8. **Arquivo "use client" não importa nada que abra o banco**; arquivo
   "use server" só exporta função async.

---

## 3. Etapa 0 — Base de identidade (pré-requisito das etapas 2, 4, 5 e 6)

### 3.1 O que falta
Saber **quem** é cada pessoa e **de quem** é cada linha. Sem isso não existe
ranking, meta por vendedor, uso por usuário nem visão do gestor.

### 3.2 Tabelas novas
- `Usuario`: id, nome, login (e-mail), `senhaHash`, `papel`
  (`vendedor` | `gestor` | `dono`), `ativo`, `trocarSenha`, `criadoEm`,
  `ultimoAcessoEm`.
- Sessão: o cookie assinado passa a carregar o `usuarioId`.

### 3.3 Padrão seguro (não trancar o dono para fora)
- **Sem nenhum usuário cadastrado, o CRM se comporta exatamente como hoje:**
  a senha única entra como `dono`. Cadastrar usuários é opcional e gradual.
- `APP_PASSWORD` continua valendo como **chave mestra** do dono, mesmo depois
  de existirem usuários. Quem esquecer a senha não derruba o sistema.
- Senha com hash forte e salgado (nunca texto puro). Senha temporária no
  primeiro acesso, troca obrigatória. Limite de tentativas por IP/login.

### 3.4 Dono do dado
Coluna **`vendedorId` nullable** nas tabelas de carteira: Cliente, Negociação,
Visita, Proposta, Tarefa (demanda), Alerta. Linhas antigas ficam com
`vendedorId = null` e contam como "do primeiro vendedor" (o próprio dono) por
regra de leitura, sem reescrever linha nenhuma (reescrita em massa gasta cota
do Neon, como já aconteceu).

WhatsApp (conversa/mensagem) **fica fora desta etapa**: o isolamento por
número de cada vendedor é o assunto de `CRM-PRODUTO.md` seção 4 e é a parte
mais perigosa do produto (bloqueio do número). Não misturar.

### 3.5 Isolamento
- **Um único ponto** decide o filtro: `escopoDoUsuario(usuario)` devolve o
  `where` pronto (vendedor: só o seu; gestor: o time; dono: tudo).
- Toda consulta de carteira passa por ele. Filtro com `OR` entra como item do
  `AND` (armadilha de Prisma do `CLAUDE.md`).
- Teste automático obrigatório: o vendedor A não enxerga nada do B em cada
  tela e em cada ação de servidor (inclusive trocando o ID na URL).
- Rotas de API e ações "use server" checam o papel no servidor, nunca só
  escondem o botão.

### 3.6 Multi-concessionária (a pergunta do final do prompt)
**Hoje não separa nada por empresa.** Duas formas de resolver:

| | Uma instância por concessionária | `empresaId` em todas as tabelas |
|---|---|---|
| Vazamento entre empresas | Impossível (bancos separados) | Possível se uma consulta esquecer o filtro |
| Esforço de construção | Quase nenhum | O maior do projeto |
| Operar 18 clientes | 18 deploys e 18 bancos para acompanhar | Um só |
| Painel do dono | Precisa juntar resumos das instâncias | Direto no banco |

**Recomendação:** instância separada por concessionária (fase 2 já
documentada). Cada manutenção de banco roda sozinha na instância na primeira
requisição depois do deploy, então atualizar 18 delas é só publicar o mesmo
código. O dono enxerga todas por um **resumo diário que cada instância envia**
(variáveis `PAINEL_DONO_URL` e token; só números agregados, nunca nome,
telefone, valor nem conversa de cliente). Todas as tabelas novas deste
documento levam só `usuarioId`; se um dia virar multiempresa, `empresaId` entra
depois como coluna aditiva.

---

## 4. Etapa 1 — Suporte e sugestões (CONSTRUÍDA em 05/11, nasce desligada)

Liga em Configurações → Suporte e sugestões. Diferenças do desenho abaixo:
- Com o login único, quem responde pela tela `/suporte` aparece como
  "Suporte"; o vendedor continua a conversa abrindo outro pedido. Separa de
  verdade quando existirem usuários (Etapa 2).
- O prompt pronto sai do modelo fixo. A melhoria da redação pela IA gratuita
  **não foi feita**.
- Envio por rota (`/api/suporte`), não por ação "use server", porque os
  prints passam de 1 MB.

Não depende da Etapa 0 (funciona com a senha única; `autor` fica em branco ou
"vendedor" até existirem usuários).

### 4.1 Tabelas novas
- `Ticket`: id, `autorId?`, `assunto`, `porQueImporta`, `tela` (caminho onde
  abriu), `status` (`novo` | `em_analise` | `aprovado` | `implementado` |
  `descartado`), `promptPronto?`, `criadoEm`, `atualizadoEm`.
- `TicketMensagem`: id, ticketId, `autorId?`, `lado` (`vendedor` | `admin`),
  `texto`, `criadoEm`.
- `TicketAnexo`: id, mensagemId, `mimeType`, `nome`, `tamanho`, `base64`.
  **Tabela separada**, para a lista de tickets nunca carregar imagem.
- Índices: `Ticket(status, atualizadoEm)`, `TicketMensagem(ticketId, criadoEm)`.

### 4.2 Telas e comportamento
- **Botão flutuante** "Suporte / Sugerir melhoria" no layout do app. No
  celular fica acima da barra inferior e nunca cobre botão de ação da tela.
  Abre um painel (gaveta no celular, janela no PC).
- Campo de texto com a dica fixa: *"Ctrl+V para colar prints, Enter para
  enviar"*. **Enter envia, Shift+Enter quebra linha.** Dois campos: "o que
  aconteceu ou o que você quer" e "por que isso é importante".
- **Ctrl+V de imagem:** o navegador entrega a imagem pela área de
  transferência; ela é reduzida no próprio navegador (lado maior ~1280 px,
  JPEG) antes de subir. Limite: 3 prints por mensagem, ~400 KB cada. Isso
  protege a cota de armazenamento do Neon (print cru passa de 1 MB). Sem
  Ctrl+V no celular: botão "anexar print" com a galeria.
- O ticket guarda sozinho: tela de origem, tamanho da janela e navegador.
- Tela **Meus pedidos**: conversa de cada ticket e resposta do admin.
- Tela **Admin → Suporte** (só `dono`): lista por status, filtro, conversa com
  imagens, botão responder, mudar status, copiar o prompt.
- **Notificação:** a tabela `Alerta` exige um cliente em cada linha, então
  não serve para pedido de suporte (corrigido ao construir). O aviso é o
  número de pedidos novos no próprio botão (uma contagem indexada, feita no
  layout só com o recurso ligado, sem polling) e uma notificação push.

### 4.3 O "prompt pronto"
Gerado **uma vez**, no momento em que o ticket é criado, em segundo plano
(`waitUntil`), para o envio não esperar.
- Modelo de texto fixo (funciona sem IA): título, o pedido do vendedor com as
  palavras dele, o motivo, **tela afetada e o arquivo da tela** (tabela
  caminho → arquivo mantida no código), lista dos prints ("Anexo 1, 2..."),
  e as regras do `CLAUDE.md` que se aplicam (as 3 perguntas, a bateria, a
  conferência no PC e no celular).
- Se houver IA gratuita disponível, ela só **melhora a redação** do modelo.
  Falhou ou desligada: fica o modelo fixo. O ticket nunca depende dela.
- Botão **Copiar prompt** e botão **Baixar prints** (o Claude Code não lê
  banco; o print é baixado e anexado por quem cola o prompt).
- Você aprova mudando o status para "aprovado" antes de copiar.

### 4.4 Quando dá errado
- Envio falhou: o texto digitado **não some** (fica no campo) e a tela diz
  "não enviou, tente de novo".
- Sem sinal: aviso claro "sem internet — o pedido não foi enviado". O worker
  do modo sem sinal **não** responde por pedido que grava.
- Print grande demais ou formato inválido: avisa qual e segue sem ele.
- Anti-abuso: limite de tickets por hora por usuário e tamanho máximo de
  texto.
- Prompt pronto não gerou: o ticket aparece com o modelo fixo e a marca
  "sem melhoria de IA".

### 4.5 Quem mais depende disso
Layout do app e menu (botão e contador), central de alertas (origem nova),
`push.ts`, `sw-codigo.ts` (clique na notificação abre o ticket),
`TELAS_SEM_COPIA` (tela de suporte é ao vivo), auditoria, `trazer-provisorio`
(tickets não vêm na volta do banco provisório: decisão a registrar).

---

## 5. Etapa 2 — Identidade implementada (a Etapa 0 virando código)
Ver seção 3. Entregas: tela de usuários (criar, desativar, trocar papel,
senha temporária), login por pessoa, `escopoDoUsuario`, teste de isolamento,
menu por papel. Registro de auditoria passa a gravar `usuarioId`.

---

## 6. Etapa 3 — Metas e supermetas

### 6.1 Tabelas novas
- `Meta`: id, `escopo` (`vendedor` | `equipe`), `usuarioId?`, `periodo`
  (`mensal` | `bimestral` | `trimestral` | `semestral` | `anual`), `inicio`,
  `fim`, `indicador` (`maquinas_faturadas` | `faturamento` | `visitas` |
  `negociacoes_novas`), `meta`, `supermeta`, `recompensaId?`, `exemplo`
  (boolean), `criadoPorId?`.
- `Recompensa`: id, descricao, `valorReais?`, `ativa`.

### 6.2 Progresso
- Calculado sobre `Negociacao` (`faturadoEm`) e `Visita`, uma contagem por
  meta, com índice em `faturadoEm`. **Cache por 5 minutos** e invalidado
  quando uma negociação é movida (a ação já revalida a tela).
- Mostra: percentual, quanto falta, dias restantes, ritmo necessário, e o
  mesmo para a supermeta.

### 6.3 Metas de exemplo
Criadas **na primeira vez que o gestor abre a tela de metas** (não no deploy),
marcadas `exemplo = true` e com aviso "ajuste os números": mensal,
trimestral, semestral e anual com meta e supermeta. A meta anual de exemplo
parte do `metaAnualVendas` que já existe em Parâmetros, para não perder o
número que ele já usa.

### 6.4 Quem lê as metas hoje (atualizar no mesmo commit)
`lib/metas.ts`, `app/(app)/dashboard/page.tsx`, `ZeusPainel`, `app/(app)/zeus`,
`ParametrosNegocioForm`, `lib/parametros-actions.ts`. Enquanto não existir
`Meta`, tudo continua lendo Parâmetros. A leitura nova cai em Parâmetros se a
tabela estiver vazia ou o recurso desligado.

### 6.5 Quando dá errado
Sem meta cadastrada, a tela diz "defina sua primeira meta" com o botão, não
mostra 0%. Meta com fim antes do início, indicador desconhecido ou valor
negativo é recusada com a razão.

---

## 7. Etapa 4 — Dashboard do vendedor

Sem tabela nova. Um bloco **"Meu mês"** no topo do dashboard que já existe
(619 linhas, cheio de painéis), pensado primeiro para 390 px:
1. Anel da meta: "você está em X%", **falta N** (máquinas ou R$), supermeta
   ao lado.
2. Últimas 5 vendas e últimas 5 prospecções (negociação ou cliente novo).
3. Negócios em aberto com o **próximo passo** (`proximaAcao` e o
   `NextBestAction` que já existem), os parados primeiro.
4. Alertas que já existem, sem duplicar a central.

Dados: as consultas que o dashboard já faz mais as metas da Etapa 3, em uma
leitura memoizada por requisição. Sem consulta nova pesada. Abaixo da dobra os
painéis atuais ficam como estão. Estados: sem meta (convite para criar), sem
venda (frase de incentivo com o próximo passo), erro (mensagem, não sumiço).

---

## 8. Etapa 5 — Jornada do lead (fluxo visual)

### 8.1 Origem do lead
`Cliente.origem` já existe como texto livre. Padronizar em lista (`telefone`,
`indicacao`, `visita`, `whatsapp`, `site`, `evento`, `outro`) **sem apagar o
que já está gravado**: valor antigo continua aparecendo e é tratado como
"outro" nos relatórios. `indicadoPorId` já guarda quem indicou; passa a ser
obrigatório na tela só quando a origem é `indicacao`. Quem lê `origem` hoje
(formulário do cliente, lista, importação, modo sem sinal) é revisado no mesmo
commit.

### 8.2 Data de cada etapa — o ponto mais delicado
- Tabela nova `NegociacaoEtapa`: id, negociacaoId, `etapa` (título da coluna),
  `papel`, `entrouEm`, `saiuEm?`, `usuarioId?`. Índice
  `(negociacaoId, entrouEm)`.
- **Toda mudança de estágio** grava uma linha e fecha a anterior, por um
  único ponto central. Hoje o estágio muda em vários lugares de
  `lib/actions.ts` (criar, editar, mover, perder, faturar, reabrir, renomear
  coluna) e provavelmente no modo sem sinal e na IA. Este é exatamente o caso
  "estado novo, caminhos antigos" do `CLAUDE.md`: no momento de construir, um
  `grep` por `estagio:` lista todos e **todos** passam pelo ponto central no
  mesmo commit, com teste que quebra se um novo caminho gravar `estagio` sem
  passar por ele.
- **Negócios que já existem não têm histórico.** A jornada deles começa no
  dia em que o recurso for ligado (marcado "histórico a partir de DD/MM"),
  com a etapa atual datada pela melhor informação disponível (`criadoEm`,
  `faturadoEm`). Não inventamos datas.
- Reabrir uma venda faturada cria nova passagem (não apaga a anterior).

### 8.3 O fluxo visual
- Caixas conectadas, uma por coluna do funil, **montadas a partir de
  `ColunaFunil`** (que o vendedor já edita), mostrando em cada caixa: data em
  que entrou, **dias nesta etapa**, e o **próximo passo sugerido** da etapa.
  Para chegar nos passos do seu prompt (contato, proposta, documentos,
  financiamento, contrato, entrega), o gestor cria essas colunas no funil.
  Isso é decisão sua (seção 16).
- No celular o fluxo vira **vertical**; no PC, horizontal. Desenho com
  HTML e SVG simples, sem biblioteca de grafos (peso no celular). Animação
  leve só por CSS e desligada quando o aparelho pede menos movimento.
- **Gargalo:** média de dias por etapa, calculada sobre `NegociacaoEtapa`
  por consulta agregada, **guardada por dia** e lida pela tela. A etapa mais
  lenta ganha destaque para o gestor.
- Próximo passo por etapa: texto padrão por `papel` da coluna (funciona sem
  IA); o Orientador já existente pode refinar quando estiver ligado.

---

## 9. Etapa 6 — Controle de uso (visão do dono)

### 9.1 Registro leve
- Tabela `UsoDia`: `usuarioId`, `dia`, `aberturas`, `minutosAtivos`,
  `telas` (JSON: tela → vezes), `acoes` (JSON: ação → vezes), `primeiraEm`,
  `ultimaEm`. **Uma linha por usuário por dia.**
- Captura no navegador: um sinal curto (`sendBeacon`) **no máximo uma vez a
  cada 60 segundos de uso ativo e ao fechar a aba**, com as telas visitadas
  desde o último sinal. O servidor faz **um upsert**. Sem polling, sem
  gravação por clique. Nada de conteúdo de cliente, só nome da tela e da
  ação.
- Ações contadas pelo ponto que já registra o que aconteceu (criar cliente,
  mover negociação, enviar WhatsApp, registrar visita), via uma função única
  `registrarUso(acao)` que soma na linha do dia.
- Retenção: linhas com mais de 400 dias saem na manutenção (barato).

### 9.2 Painel do dono
Lê só `UsoDia` e `Usuario`: quem usa, dias por semana, última atividade,
**"sumindo"** (usava e parou há N dias, N configurável), telas que ninguém
abre. Por concessionária: resumo diário que a instância envia (seção 3.6).
Sem tela de uso para o vendedor ver o dos outros.

### 9.3 Quando dá errado
Se o sinal falhar, o uso daquele trecho simplesmente não conta; a tela do
vendedor nunca quebra nem espera por isso. O painel mostra "sem dados" e não
zero enganoso quando o recurso estava desligado.
**LGPD:** uso é dado pessoal do vendedor. Precisa estar no aviso de uso e no
contrato (ver riscos em `crm-como-produto.md`).

---

## 10. Etapa 7 — Gamificação e ranking

### 10.1 Tabelas novas
- `RegraPonto`: `acao`, `pontos`, `ativa`, `limiteDiario?`.
- `FocoPeriodo`: `acao`, `multiplicador`, `inicio`, `fim` (o foco da
  semana/mês definido pelo gestor).
- `PontoLancamento`: `usuarioId`, `acao`, `pontos`, `refTipo`, `refId`,
  `criadoEm`, **único em (usuarioId, acao, refId)** para nunca contar duas
  vezes a mesma coisa.
- `Conquista`: `usuarioId`, `codigo`, `emEm`.

### 10.2 Regras de segurança do jogo
- **Pontos de venda só quando faturada.** Se a venda for reaberta ou
  desfeita, os pontos dela são **estornados** (o mesmo caminho velho que a
  seção 8.2 cuida: o estado "reabrir" precisa ser tratado, senão o ranking
  premia venda que não existe).
- **Teto diário por ação** configurável, para ninguém ganhar clicando.
- Pontuação **dentro do mesmo ponto central** que já registra a ação, para
  não ter dois lugares que decidem.
- Ranking = soma de `PontoLancamento` no período, com índice; guardado por
  semana e lido pela tela. "Você está a X pontos do líder" sai desse número.
- **Ranking só aparece com 2 ou mais vendedores ativos.** Com um só, é
  ruído e desmotiva.
- **Bonificação:** a tela mostra a recompensa e o quanto falta, e quando bate
  a meta ou a supermeta marca "conquistada". **Quem paga é o gestor**; o CRM
  não movimenta dinheiro nem se confunde com a comissão de 0,5% que já existe.
- Badges simples e fixos no começo (primeira venda, 5 visitas na semana, 7
  dias seguidos de uso).

---

## 11. Etapa 8 — Gestão de equipe e sugestões de IA

Depende das etapas de identidade, metas, uso e jornada.

- Tela do gestor: um cartão por vendedor com **% da meta contra % do tempo
  decorrido**, funil por etapa, negócios parados, dias de uso na semana.
  Tudo de agregados que já existem (nada novo calculado ao abrir).
- **Sugestões por vendedor em duas camadas:**
  1. **Regras fixas, grátis e previsíveis**, rodadas **uma vez por dia** pelo
     cron: "5 negócios parados há 10+ dias", "20% abaixo do ritmo da meta",
     "3 dias sem acessar". `Alerta` exige cliente em cada linha, então estas
     sugestões vão para uma tabela própria, com chave de deduplicação.
  2. **IA opcional, sob botão**, que reescreve a recomendação em linguagem
     natural, com teto diário e `pagoLiberado()`. Nunca gera sozinha a cada
     abertura da tela.
- **O que o gestor enxerga** é uma matriz configurável pelo dono (decisão da
  seção 16). O padrão seguro é o de `crm-como-produto.md`: sem nome e
  telefone de cliente, sem valor por negociação, sem comissão, sem conversa
  de WhatsApp.

---

## 12. Etapa 9 — IA de objeções (só arquitetura e custo; nada a construir agora)

- Tabelas futuras: `Objecao` (texto, categoria) e `RespostaObjecao`
  (objeção, texto, `autorId`, `funcionou`, `negociacaoId?`, `aprovadaGestor`).
- Fluxo: no negócio aberto o vendedor descreve a objeção; a IA recebe a
  objeção **e um resumo curto do negócio**, mais as 3 respostas aprovadas mais
  parecidas da base, e sugere como responder. O vendedor marca "funcionou /
  não funcionou". Respostas que funcionam várias vezes sobem para a base.
- **Qualidade da base:** só entra na base compartilhada o que o gestor
  aprova, para um erro de um vendedor não virar conselho para todos.
- Busca simples no começo (palavras e similaridade de texto do Postgres), sem
  banco vetorial. Só se justifica um recurso mais pesado se a base crescer.
- **Custo:** cada pedido leva cerca de 1 a 2 mil palavras de entrada e uma
  resposta curta. Com IA gratuita o custo é zero, mas vale o limite por
  minuto de cada chave. Com IA paga o custo depende da tabela do provedor,
  que **não verifiquei aqui**; antes de ligar, conferir o preço atual e
  deixar o teto diário.

---

## 13. Ordem recomendada e dependências

| # | Etapa | Depende de | Peso no banco | Modelo/esforço (regra 00) |
|---|---|---|---|---|
| 1 | Suporte e sugestões | nada | 3 tabelas novas | Sonnet 5.5 · high |
| 2 | Identidade e usuários | nada (mas é pré-requisito) | 1 tabela + coluna `vendedorId` nullable | **Opus 5.5 · high** (esquema e isolamento) |
| 3 | Metas e supermetas | 2 | 2 tabelas | Sonnet 5.5 · high |
| 4 | Dashboard do vendedor | 3 | nenhuma | Sonnet 5.5 · medium |
| 5 | Jornada do lead | nada (melhor com 2) | 1 tabela, passa por todos os caminhos de estágio | **Opus 5.5 · high** |
| 6 | Controle de uso | 2 | 1 tabela | Sonnet 5.5 · high |
| 7 | Gamificação | 2, 3, 5 | 4 tabelas | Sonnet 5.5 · high |
| 8 | Gestão de equipe | 2, 3, 5, 6 | usa `Alerta` | Sonnet 5.5 · high |
| 9 | Objeções | só planejar | — | — |

Por que a ordem mudou em relação ao prompt: a Etapa 2 do prompt (controle de
uso) e as metas por vendedor só fazem sentido depois de existir "vendedor".
O suporte (1) é o único que entrega valor já com uma pessoa só.

## 14. Orçamento de CPU, em uma tabela

| Etapa | O que roda | Quando |
|---|---|---|
| Suporte | 1 contagem indexada junto dos alertas; geração do prompt 1 vez por ticket | ao abrir tela / ao criar ticket |
| Uso | 1 upsert por usuário | no máximo 1 por minuto ativo |
| Metas | 1 contagem por meta, em cache de 5 min | ao abrir o dashboard |
| Jornada | 1 insert por mudança de etapa; gargalo agregado por dia | na mudança / cron diário |
| Gamificação | 1 insert idempotente por ação; ranking agregado por semana | na ação / cron |
| Gestão | regras fixas 1 vez por dia | cron diário |

Tudo cabe nos 2 crons diários que já existem (`vercel.json`): os passos novos
entram no `cron/tudo`, não em novos agendamentos.

## 15. Teste e implantação (quando for a hora)

Para cada etapa, antes de pedir sua aprovação:
1. Bateria do `CLAUDE.md` (tipos, lint, testes, build).
2. Teste "código novo + banco velho" quando houver coluna nova.
3. Teste do padrão seguro: recurso desligado, banco fora do ar, valor
   inválido na chave.
4. Teste de isolamento entre vendedores (etapas 2 em diante).
5. Tela conferida a 1440 e a 390, nos dois temas, com os quatro estados.
6. **Banco de produção só com seu aviso e sua autorização**, em ambiente de
   teste/preview primeiro. Nada é ligado em produção por conta própria.

## 16. Decisões que são suas

1. **Modelo de empresas:** instância por concessionária (recomendado) ou
   `empresaId` único.
2. **Gestor:** o que ele enxerga de cada vendedor (nome de cliente, valor,
   conversa).
3. **Jornada:** quais colunas do funil representam documentos, financiamento,
   contrato e entrega.
4. **Uso:** o vendedor deve saber que o uso é medido (recomendado, por LGPD e
   para evitar atrito).
5. **Bonificação:** só exibir a recompensa ou também registrar o pagamento.
6. **Suporte:** quem é o "admin" que responde e recebe o aviso (você, ou
   também outra pessoa).

## 17. O que este desenho não confirma

- Não rodei nada. Os pontos "provavelmente" (onde mais o estágio muda, quem
  lê `origem`) saem de uma busca rápida e são refeitos por `grep` completo no
  dia de construir.
- Custo real de IA paga, limites atuais do Neon e da Vercel e o tamanho real
  do ganho de aderência não foram verificados aqui.
- O comportamento no iPhone (colar print, worker) não dá para testar neste
  ambiente.
