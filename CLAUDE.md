# Regras deste repositório

Este arquivo é lido automaticamente no começo de toda sessão. Ele não é um
manual de boas práticas: é a lista das falhas que **já aconteceram neste CRM**
e do que fazer para não repetir. Cada regra existe porque custou alguma coisa.

---

## 0. AS 3 PERGUNTAS — obrigatórias em toda alteração

Padrão definido pelo vendedor. Vale para **toda alteração que vai para o
repositório** (não para pergunta, explicação ou leitura de código).

1. **"O que mais depende disso?"** — ANTES de mexer. `grep` pelo que vai mudar,
   pelos irmãos dele e por quem lê o campo. Achou mais de um lugar? Todos são
   consertados **no mesmo commit**. Não vale dizer "nada depende" sem procurar.
2. **"O que acontece quando dá errado?"** — DEPOIS de construir. Os quatro
   estados de toda tela nova: carregando, vazio, erro e sucesso. Falhou, a tela
   DIZ que falhou.
3. **"O que você não conseguiu conferir?"** — NO FIM. Separar o que passou pela
   tela do que ficou suposto.

**As três TRAZEM A SOLUÇÃO, não só o diagnóstico.** Achou dependência quebrada,
conserta no mesmo commit. Achou caminho ruim sem aviso, põe o aviso. Não
conseguiu conferir, constrói o substituto (provedor falso, dado simulado) ou
deixa na tela o número que responde a dúvida — em vez de empurrar a pergunta
para ele. Só vira pendência o que dependa de decisão dele ou de acesso que eu
não tenho.

**A resposta das três é VISÍVEL, no fim de toda entrega:**

```
Conferência
· Depende disso: <o que o grep achou> — todos no mesmo commit
· Quando dá errado: <o que a tela faz>
· Não conferi: <o que ficou de fora> — e o que foi feito para cobrir
```

O bloco nunca some — nem em mudança pequena, onde ele vira "nada mais depende /
não tem tela / nada ficou de fora". **É a ausência dele que denuncia que o
padrão não rodou.** Regra que só existe na minha cabeça não dá para cobrar;
esta produz prova, como a de conferir no PC e no celular produz print.

Roteiro completo: `docs/tres-perguntas.md`.

Os itens 1 a 6 abaixo são os casos que deram origem a cada pergunta.

---

## 1. Estado novo, caminhos antigos

**A falha que mais se repetiu aqui, e a que custou o número do vendedor.**

Ao criar um estado, status, coluna ou campo novo, o código antigo continua
achando que o mundo velho é o mundo inteiro.

Aconteceu três vezes:

- Criei o envio em ondas, que deixa o envio em `"enviando"` entre uma rodada e
  outra. O **cancelamento** continuou olhando só para `"pendente"` — o vendedor
  clicava em cancelar, a tela dizia "já saiu", e a lista continuava saindo o dia
  inteiro. O WhatsApp dele foi bloqueado por 24h.
- O mesmo `"enviando"` fez a **faxina de anexos** apagar a imagem no meio do
  envio: ela poupava só `"pendente"`. O resto da lista saiu sem a imagem.
- Tirei a coluna VENDA PERDIDA do quadro para virar seção própria e, com ela,
  foi embora o **único jeito de marcar uma venda como perdida** — arrastar o
  card para aquela coluna.

**Regra:** ao introduzir ou remover um estado/valor/coluna, procure TODO lugar
que decide alguma coisa com base naquele conjunto — `grep` pelo nome do estado,
pelos irmãos dele e por quem lê o campo — e liste o que encontrou antes de
mexer. Se a lista tiver mais de um item, conserte todos no mesmo commit.

## 2. Verificar o caminho RUIM, não só o que dá certo

Conferir que funciona é metade. A outra metade é o que acontece quando falha,
quando está vazio, quando o usuário cancela, quando a resposta não vem.

- O card da leitura com IA **sumia inteiro** quando a busca falhava: sem botão,
  sem erro. O vendedor concluiria que o CRM não tem aquilo — sem ter como nem
  reclamar do que não aparece.
- O cancelamento devolvia "este envio já saiu" quando na verdade não tinha
  cancelado nada.

**Regra:** para cada tela nova, conferir os quatro estados — carregando, vazio,
erro e sucesso. Quando falhar, a tela precisa **dizer** que falhou; sumir em
silêncio é o pior desfecho possível.

## 3. O padrão nunca pode ser o que machuca

Quando falta configuração, quando o banco não responde, quando o valor gravado
é estranho: o sistema tem que fazer a coisa MENOS danosa.

A trava geral de envio (`lib/whatsapp-pausa.ts`) nasce pausada e só a palavra
exata `"liberado"` libera. Foi a ausência de resposta virar "pode mandar" que
derrubou o número duas vezes.

**Regra:** em qualquer trava, escreva o teste que prova o padrão seguro —
sem configuração, com o banco fora do ar e com valor inválido.

## 4. Antes de criar, procurar se já existe

Escrevi um card de "Exportar os dados" em Configurações que já existia
(`ExportarDadosCard`). Ia para produção duplicado.

**Regra:** antes de criar tela, componente ou função, `grep` pelo nome e pela
função. Reaproveitar é melhor que duplicar, e duplicar é pior que não fazer.

## 5. Dizer o que ficou pela metade

Escrevi as cores do tema claro do funil, deixei um comentário no código dizendo
"nada aciona isso ainda" — e não avisei. Semanas depois ele foi procurar a
opção de tema e não achou.

**Regra:** o que ficou por fazer vai na RESPOSTA ao vendedor, não só num
comentário no código. Comentário no código ele não lê.

## 6. Separar o que foi conferido do que foi suposto

Não existe rede de saída neste ambiente: não dá para testar Google, PNCP,
Evolution, provedor de IA nem Safari.

**Regra:** dizer explicitamente o que foi verificado e o que não foi. Nunca
apresentar como conferido o que não passou pela tela. Quando a verificação de
verdade não for possível, construir um substituto (provedor falso local, dado
simulado) — e dizer que foi um substituto.

## 7. Conferir enquadrado no PC e no celular

Regra do dono do CRM: **toda criação ou alteração tem que ser conferida
enquadrada no PC (1440) e no celular (390) antes de ser dada por pronta.**
Playwright, `executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`.

Conferir também nos DOIS temas quando a mudança tiver cor.

## 8. O que nunca muda

- **Empurrar para as DUAS branches**, sempre:
  ```
  git push -u origin claude/projeto-zeus-merge-deploy-jc6p7x
  git push origin claude/projeto-zeus-merge-deploy-jc6p7x:claude/relaxed-cori-5c3g4l
  ```
- **Toda migração nova exige subir `CHAVE_MANUTENCAO`** em `lib/manutencao.ts`.
- **Campo novo no `schema.prisma` derruba o CRM se o banco ainda não tiver a
  coluna.** A partir do deploy, TODA consulta àquele modelo pede a coluna nova
  — e a manutenção roda dentro de uma requisição, em paralelo com as consultas
  da página: ela perde a corrida. Já aconteceu, e o vendedor ficou um dia fora
  do ar. Antes de empurrar, **rodar com CÓDIGO NOVO e BANCO VELHO**: derruba a
  coluna no banco de teste, builda, e a PRIMEIRA requisição tem que passar.
- **Tela caída tem que DIZER o motivo.** Em produção o Next esconde a mensagem
  do servidor, e "Algo deu errado nesta página" não diz nada a ninguém — foi
  esse silêncio que transformou um defeito de minutos num dia parado. O layout
  sonda o banco antes das telas (`lib/saude-banco.ts`) e mostra o motivo por
  extenso; `/api/diag` testa peça por peça. Ao mexer em erro de tela, essas
  duas saídas continuam existindo.
- **Chave de API é credencial:** nunca mostrar por extenso, nunca em log; a
  auditoria grava o provedor, nunca o valor.
- **Nada que gere fatura sem dizer o custo na cara e deixar ele escolher.** Ele
  paga só o Gemini Plus. A trava de provedor pago (`IA_SOMENTE_GRATUITOS`) está
  ligada por padrão e não se desliga sozinha.
- Commits terminam com as linhas de atribuição da sessão. **Nunca** pôr
  identificador de modelo em nada que vá para o repositório.
- Lista dentro de card é limitada, com rolagem interna de altura fixa. Ele usa
  o CRM no celular, na rua.

## 9. Comandos que ele usa pelo nome

- **"use a melhoria 10x"** — varredura do CRM inteiro em dez rodadas, cada uma
  com um objetivo diferente; o que aparece vira correção no mesmo dia ou
  decisão consciente de não mexer, registrada. Roteiro e histórico em
  `docs/auditoria-continua.md`.
- **"cadê as 3 perguntas?"** — cobrança do bloco de Conferência (item 0) quando
  ele não veio.

## 10. Bateria antes de dar por pronto

```
npx tsc --noEmit && npx eslint src tests --ext .ts,.tsx && npx vitest run && npm run build
```

Lint e tipos passando não provam nada sobre comportamento — os três defeitos do
bloqueio do WhatsApp passaram nos quatro. O que prova é a regra 1, a 2 e a 7.

## 11. Armadilhas deste código

- **Prisma: dois `OR` no mesmo objeto se apagam** — o último vence e o filtro
  perdido some sem erro nenhum. Todo filtro novo com `OR` entra como item do
  `AND`.
- `origem <> 'prospect_ia'` é NULL (falso) quando origem é nula. Idioma da casa:
  `{ OR: [{ origem: null }, { origem: { not: "prospect_ia" } }] }`.
- Arquivo `"use server"` **só exporta função async** — constantes e tipos vão
  para um módulo puro ao lado.
- Botão dentro de área de arrasto do dnd-kit não recebe clique: o dnd-kit marca
  o bloco como `role="button"`, e botão dentro de botão come o evento.
- `:where()` zera especificidade — é a correção para regra global de CSS vencer
  classe de componente sem querer (já custou o arrastar do menu no celular).
- Fuso: servidor em UTC, vendedor em Brasília (UTC−3 o ano todo).
- `npx prisma generate` exige `DATABASE_URL_UNPOOLED` no ambiente.
