# CRM do Edy — continuação

Este arquivo é o ponto de partida de uma sessão nova. Cole o conteúdo dele (ou
mande ler este caminho) e continue de onde parou.

Você está continuando o trabalho num CRM em Next.js (App Router) + Prisma +
Postgres, feito sob medida para **um** vendedor de máquinas pesadas New Holland
Construction / Dynapac no sul do Espírito Santo. Tudo em português do Brasil —
código, comentários, commits e conversa.

Repositório: `edersoncontas-cell/CRM`

## Onde parei

Último commit com código: **"Volta para o Neon: a 1ª tela não cai se faltar
coluna lá"** (29/09). **1.278 testes passando** (108 arquivos), lint e build
limpos. `CHAVE_MANUTENCAO = "manutencao.v44"` (nada mudou no schema).

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
3. Depois: ele pode apagar `DATABASE_URL_PROVISORIO` quando o card disser
   "tudo trazido". Só DEPOIS disso retomar o multiusuário.

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
