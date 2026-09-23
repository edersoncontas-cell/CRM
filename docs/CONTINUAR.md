# CRM do Edy — continuação

Este arquivo é o ponto de partida de uma sessão nova. Cole o conteúdo dele (ou
mande ler este caminho) e continue de onde parou.

Você está continuando o trabalho num CRM em Next.js (App Router) + Prisma +
Postgres, feito sob medida para **um** vendedor de máquinas pesadas New Holland
Construction / Dynapac no sul do Espírito Santo. Tudo em português do Brasil —
código, comentários, commits e conversa.

Repositório: `edersoncontas-cell/CRM`

## Onde parei

Último commit: **`58fa4c6`** — "CLAUDE.md: as regras que saem das falhas".
**1023 testes passando** (86 arquivos), lint e build limpos.
`CHAVE_MANUTENCAO = "manutencao.v44"`.

> ⚠ **O envio de WhatsApp está PAUSADO.** O número do vendedor foi bloqueado
> duas vezes. A trava geral (`lib/whatsapp-pausa.ts`) barra TODA saída —
> campanha, resposta automática, aniversário, mensagem da tela — e nasce
> pausada. Só ele libera, em Configurações. Não libere por conta própria e não
> escreva nada que contorne a trava.

> Ao retomar, confira o estado real antes de confiar nestes números:
> `git log --oneline -5`, `npx vitest run`, `grep -n "CHAVE_MANUTENCAO = " src/lib/manutencao.ts`.

### ⚠ Falta ele rodar a manutenção

Depois do deploy: **Configurações → Manutenção do sistema**. As migrações v42
(funil novo) e v43 (`Cliente.naoPerturbe`) só entram quando essa rotina roda.
Sem ela, a tela que lê a coluna nova quebra inteira.

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
- Em Configurações, o card **"Travas de envio do WhatsApp"** mostra quanto já
  saiu hoje contra o teto e deixa mudar teto e horário.

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

## Sandbox

- Postgres: `/var/lib/postgresql/crmtest-pg`, porta 5433. **Ele cai sozinho** —
  religue com:

  ```bash
  su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/crmtest-pg -o '-p 5433 -k /tmp' -l /tmp/pg5433.log start"
  ```

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

## Em aberto (ofereci, ele não respondeu)

- **Pós-venda:** hoje "Resolvido" é definitivo. Ofereci fazer voltar quando
  vencer o próximo marco, por data comparada ao `ocultoEm` — e não por chave
  que se desmancha, que era o bug antigo.
- **Lista de bloqueio:** os termos `central`, `brasil`, `pme`, `dynapac` e `crm`
  são largos. "Terraplenagem Central" ou "Construtora Brasil" são apagados com
  negociação e visita junto. Ofereci tirar esses termos ou fazer uma prévia
  antes de apagar.
- **IA:** a espera curta do Groq (~8s) e acrescentar Cerebras/Mistral/OpenRouter
  como provedores grátis extras.
- **Nunca foi respondida** a pergunta dele sobre "memória": memória de conversa
  por cliente × o CRM aprender o jeito dele de vender. Se ele retomar, vale
  abrir.

## O pacote de produto (pedido dele, ainda aberto)

Ele pediu um pacote para levar à diretoria. O Orientador do vendedor saiu; o
resto continua aberto:

- **Multiusuário**: login próprio, WhatsApp próprio e cidades próprias por
  vendedor. **Não comecei de propósito**: é onde um erro vaza a carteira de um
  vendedor para outro. Precisa de decisão dele sobre o que é compartilhado
  (catálogo, fichas) e o que é isolado (clientes, negociações, conversas).
- ~~**Orientador novo**, que analisa o VENDEDOR~~ — **FEITO.** É a seção "Como
  você vende" (`/como-voce-vende`), com a leitura opcional por IA e a aba
  "Feito para você" na Academia. O Orientador do Atendimento continua como
  estava.
- **Auditoria seção por seção** (objetivo, integrações, ganhos, o que remover).
- **3 textos que se revezam** no envio em massa — mensagem idêntica para muita
  gente é assinatura de disparo. Ganhou urgência: é a última peça que falta da
  proteção do número, e vale ANTES de ele liberar o envio de novo.

Já escritos: `docs/CRM-PRODUTO.md` e `docs/PROMPT-APRESENTACAO.md`.

## Como ele trabalha

Manda pedidos curtos com print, muitas vezes no meio de outra tarefa. Corrige
com franqueza ("não gostei", "remove isso logo") e **quer opinião honesta, não
concordância** — pediu explicitamente avaliação "sem querer me agradar" e
aceitou encolher a tela do Orientador por causa dela. Quando um pedido dele tem
consequência que ele não viu (contraste, exclusão irreversível, escolha que se
desfaz sozinha), diga em uma ou duas frases e **faça assim mesmo** o que ele
pediu; não trave a entrega.
