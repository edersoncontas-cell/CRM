# Auditoria contínua — "melhoria 10x"

Este é o registro do padrão que o vendedor definiu: **a cada pedido, analisar
o CRM inteiro, melhorar, analisar de novo e repetir — dez rodadas.** Cada
rodada é uma varredura com um objetivo diferente; o que é encontrado vira
correção no mesmo dia ou entra aqui como decisão consciente de não mexer.

Sempre que a instrução for **"use a melhoria 10x"**, é este roteiro que roda.

---

## Rodada 1 — Comandos duplicados ou fora de lugar

**Encontrado:** "Mensagem para clientes" (envio em massa: visita, promoção,
data comemorativa, aniversário) morava dentro de **Visitas**. Mandar promoção
para 200 clientes não é uma visita — e, com a sessão de Marketing criada, a
mesma tarefa passou a ter dois donos. Além disso, o atalho novo do Marketing
apontava para uma âncora (`#mensagem-clientes`) que não existia na página.

**Feito:** o envio em massa passou a ser a segunda aba de **Marketing**
(`/marketing?aba=mensagem`). Visitas ganhou um atalho de uma linha, em vez do
formulário inteiro. Um lugar, um caminho.

---

## Rodada 2 — Promessas de tela que o código não cumpria

**Encontrado:** a Central Inteligente diz, ao guardar uma memória, que "o
Cérebro passa a usar isso nas análises e no chat". O chat do Cérebro **não
lia** `MemoriaCerebro`, e também não recebia as regras da realidade do
negócio. Ou seja: o vendedor ensinava e nada mudava.

**Feito:** o prompt do chat passou a receber as 30 memórias mais recentes e o
bloco de regras do negócio. O que se ensina em um lugar vale em todos.

---

## Rodada 3 — Inteligência que não conversava entre si

**Encontrado:** o Orientador passou a citar "a técnica da Academia para
agora", mas o prompt dele não conhecia as **Etapas da Venda** (o material
mais concreto que a Academia tem).

**Feito:** `resumoDasEtapas()` entra no contexto do Orientador — objetivo de
cada etapa e critério de avanço. A leitura do cliente passou a ser feita
contra o mesmo método que o vendedor treina.

---

## Rodada 4 — Peso das páginas

**Verificado:** consultas por página (Dashboard 9, Clientes 10, Negociações 5,
Alertas 0 — a Central de alertas carrega por ação, não na renderização).
Nenhuma página faz consulta dentro de laço (N+1).

**Decisão:** sem mudança. Os números estão dentro do que o plano gratuito da
Neon aguenta; mexer agora seria otimizar no escuro.

---

## Rodada 5 — Consultas sem limite

**Verificado:** 32 `findMany` com `take`; 2 sem, e os dois são listas
pequenas e fechadas (municípios do ES e colunas do funil).

**Decisão:** sem mudança, com o registro de que qualquer consulta nova de
lista precisa nascer com `take`.

---

## Rodada 6 — Tamanho dos componentes de tela

**Verificado:** `AtendimentoClient` (1.264 linhas) é o maior componente do
CRM, seguido de `AcademiaClient` e `FunilNegociacoes`.

**Decisão:** não quebrar agora. São telas com muito estado compartilhado;
dividir por dividir aumentaria o risco sem ganho para o vendedor. Fica
anotado como próxima refatoração quando alguma delas voltar a mudar muito.

---

## Rodada 7 — Nomes antigos vazando para o vendedor

**Encontrado:** "Agnes" (nome antigo da IA) ainda era gravado como autor da
mensagem quando um rascunho era aprovado — e aparecia na conversa do
WhatsApp.

**Feito:** passou a gravar "Orientador de Vendas". A lista `OPERADORES_IA`
continua reconhecendo "Agnes" para que o aprendizado de estilo não confunda
as mensagens antigas já gravadas com as escritas pelo próprio vendedor.

---

## Rodada 8 — Dependências e código morto

**Verificado:** todas as dependências pesadas continuam em uso (exceljs,
fflate, web-push, recharts, leaflet). Nenhum `console.log` esquecido em
componente. Rotas `/maquinas` e `/pos-venda` existem só como redirecionamento
proposital.

**Decisão:** sem mudança.

---

## Rodada 9 — Celular, tela por tela

**Feito:** auditoria automática em 390 px nas 20 telas do CRM, procurando
rolagem lateral, texto que vaza da própria caixa e filho que passa da borda
do card. Resultado: todas passam. A única "sobra" é a rolagem lateral das
colunas do funil, que é de propósito.

Correções que saíram desta rodada nesta leva: tabela "O que identificar" da
Academia vira cartões no celular, e o grafo do Cérebro ganhou folga no
desenho para o nome das sessões das pontas caber inteiro.

---

## Rodada 10 — O que é novo precisa ser vigiado

**Encontrado:** os dois crons novos (relatório do fim do dia e radar de
inovação) não apareciam no painel de saúde do ZEUS — se parassem, ninguém
saberia.

**Feito:** entraram na lista monitorada. E a "realidade do negócio", que
nasceu dentro da Academia, ganhou também um card em Configurações: quem
descobre a regra treinando cadastra ali mesmo; quem procura configuração
acha onde espera.

---

## O que fica para a próxima rodada

- Quebrar `AtendimentoClient` quando ela voltar a mudar bastante.
- Medir o tempo real de abertura das telas em produção (hoje só temos o
  tempo local).
- Avaliar mover a Auditoria para dentro do ZEUS: os dois são registro de
  sistema e hoje moram em lugares diferentes do menu.
