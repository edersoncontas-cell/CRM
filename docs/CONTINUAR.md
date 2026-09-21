# CRM do Edy — continuação

Este arquivo é o ponto de partida de uma sessão nova. Cole o conteúdo dele (ou
mande ler este caminho) e continue de onde parou.

Você está continuando o trabalho num CRM em Next.js (App Router) + Prisma +
Postgres, feito sob medida para **um** vendedor de máquinas pesadas New Holland
Construction / Dynapac no sul do Espírito Santo. Tudo em português do Brasil —
código, comentários, commits e conversa.

Repositório: `edersoncontas-cell/CRM`

## Onde parei

Último commit: **`6bc0a59`** — "Marketing só com mensagem para clientes, agora
com envio programado". **895 testes passando** (79 arquivos), lint e build
limpos. `CHAVE_MANUTENCAO = "manutencao.v40"`.

> Ao retomar, confira o estado real antes de confiar nestes números:
> `git log --oneline -5`, `npx vitest run`, `grep -n "CHAVE_MANUTENCAO = " src/lib/manutencao.ts`.

## Regras que não se negociam

1. **Empurre para as DUAS branches**, sempre:

   ```bash
   git push -u origin claude/projeto-zeus-merge-deploy-jc6p7x
   git push origin claude/projeto-zeus-merge-deploy-jc6p7x:claude/relaxed-cori-5c3g4l
   ```

   As duas remotas estão em `6bc0a59`. A branch **local** `relaxed-cori` está
   148 commits atrasada e é lixo — nunca faça checkout nela nem empurre a
   partir dela; use sempre o refspec acima.

2. **Verifique na tela antes de dizer que está pronto**, no PC (1440) e no
   celular (390). Playwright:
   `executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`.
   Cuidado: `getByRole("link", {name:/WhatsApp/})` pega o **menu lateral**, não
   o botão da página — já me enganou e quase virou caça a um bug inexistente.

3. **Toda migração nova exige subir `CHAVE_MANUTENCAO`** em
   `src/lib/manutencao.ts`. Sem isso a manutenção é pulada em bancos que já têm
   a chave antiga, a coluna nova nunca é criada e a tela que a lê quebra
   inteira. Já aconteceu.

4. **Chave de API é credencial:** nunca mostre por extenso (mascare
   `AIza••••••••WXYZ`), nunca registre em log, a auditoria grava o provedor e
   nunca o valor.

5. Ele paga **só o Gemini Plus**. Nunca recomende nada que gere fatura sem
   dizer o custo na cara e deixá-lo escolher. Já foi recusado (e se mantém):
   espalhar o CRM em várias contas grátis (viola os termos) e ter acesso
   permanente à conta Vercel dele.

6. Commits terminam com as linhas de atribuição da sessão. **Nunca** ponha
   identificador de modelo em nada que vá para o repositório.

7. Lista dentro de card é limitada, com rolagem interna de altura fixa. Ele usa
   o CRM no celular, na rua.

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

## Como ele trabalha

Manda pedidos curtos com print, muitas vezes no meio de outra tarefa. Corrige
com franqueza ("não gostei", "remove isso logo") e **quer opinião honesta, não
concordância** — pediu explicitamente avaliação "sem querer me agradar" e
aceitou encolher a tela do Orientador por causa dela. Quando um pedido dele tem
consequência que ele não viu (contraste, exclusão irreversível, escolha que se
desfaz sozinha), diga em uma ou duas frases e **faça assim mesmo** o que ele
pediu; não trave a entrega.
