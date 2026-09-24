# CRM do Edy — continuação

Este arquivo é o ponto de partida de uma sessão nova. Cole o conteúdo dele (ou
mande ler este caminho) e continue de onde parou.

Você está continuando o trabalho num CRM em Next.js (App Router) + Prisma +
Postgres, feito sob medida para **um** vendedor de máquinas pesadas New Holland
Construction / Dynapac no sul do Espírito Santo. Tudo em português do Brasil —
código, comentários, commits e conversa.

Repositório: `edersoncontas-cell/CRM`

## Onde parei

Último commit em produção: **`7a939c7`** — "Manutenção com espera entre falhas,
e o CRM nascendo num banco vazio". **1057 testes passando** (91 arquivos),
lint e build limpos. `CHAVE_MANUTENCAO = "manutencao.v44"`.

> ⚠ **O envio de WhatsApp está PAUSADO.** O número do vendedor foi bloqueado
> duas vezes. A trava geral (`lib/whatsapp-pausa.ts`) barra TODA saída —
> campanha, resposta automática, aniversário, mensagem da tela — e nasce
> pausada. Só ele libera, em Configurações. Não libere por conta própria e não
> escreva nada que contorne a trava.

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

**PENDENTE — no dia em que o Neon voltar:**
1. Trocar `DATABASE_URL`/`DATABASE_URL_UNPOOLED` de volta para o Neon na Vercel.
2. Trazer para o Neon o que ele registrou no Supabase durante a semana. O
   script **ainda não existe e é a PRÓXIMA demanda depois do documento da
   diretoria** — escreva e prove contra dois Postgres locais antes do dia 1º. Cuidado com ids repetidos (clientes que ele reimportou e que
   já existem no Neon) e com a ordem das chaves estrangeiras.
3. Só DEPOIS disso retomar o multiusuário.

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
