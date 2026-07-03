# PROJETO ZEUS — Auditoria completa + Plano mestre de correção e evolução do CRM

> **Este arquivo é o "prompt" completo para execução.** Ele contém: (1) a avaliação crítica do estado atual, (2) todas as correções de bugs encontradas na auditoria, (3) a consolidação do WhatsApp, (4) o Cérebro agêntico com ferramentas reais, (5) o ZEUS — camada autônoma de governança 24/7, e (6) inovações acima da média do mercado. Executar em fases, na ordem.

> **Nota sobre branches (2026-07-03):** este documento foi originalmente commitado na branch `claude/inspiring-pascal-y6iark`, cujo histórico git está desconectado da branch de deploy real (`claude/relaxed-cori-5c3g4l`, default do repositório). Este arquivo passa a viver na branch de trabalho real de cada fase (esta: `claude/projeto-zeus-phase-0-1-lsfl6i`, criada a partir de `claude/relaxed-cori-5c3g4l`). Os itens abaixo foram conferidos contra o código real de `claude/relaxed-cori-5c3g4l`.

## Estado de execução

- ✅ **Fase 0** — concluída em `claude/projeto-zeus-phase-0-1-lsfl6i` (2026-07-03). Todos os 4 itens de código
  implementados e testados (build real em produção local, sem/com env vars). **Pendente do lado do usuário:**
  configurar `APP_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET`, `ZAPI_WEBHOOK_TOKEN`, `GROQ_API_KEY` na Vercel — ver
  tabela nova no README.md ("Segurança em produção"). Sem isso configurado, o próximo deploy bloqueia o CRM
  (tela `/config-necessaria`) e os crons/webhook retornam 401 — é o comportamento esperado (fail-closed).
- ✅ **Fase 1** — concluída em `claude/projeto-zeus-phase-0-1-lsfl6i` (2026-07-03). Quase todos os 36 itens
  corrigidos e verificados (tsc + lint + build + testes funcionais com Postgres local e Playwright mobile).
  Diferenças em relação ao plano original (a auditoria foi escrita contra `claude/inspiring-pascal-y6iark`,
  código diferente do real):
  - Item **1D.22** (componente `<Modal>` compartilhado) e **1D.23** (cores da IA no `tailwind.config.ts`):
    adiados — são refactors puros de consolidação (sem bug funcional), alto número de arquivos tocados,
    ficam para uma sessão de limpeza dedicada.
  - Item **1E.34** (`ResumosClient.tsx`): o ID passado já era o `clienteId` correto (não era o bug descrito).
    Achado real: a página `/resumos` inteira lê do relacionamento legado `Cliente.conversas` (`Conversa`/
    `AnaliseIA`), que ninguém mais popula — a página está sempre vazia em produção hoje. Corrigir é
    exatamente o escopo da Fase 2 (unificar para `WhatsAppConversation`).
  - **Bug adicional encontrado e corrigido** (não estava na auditoria original): `gerarResumoClienteIA`
    (`actions.ts`) selecionava um campo `mensagens` que não existe no schema (o campo real é `messages`) —
    o "Gerar resumo pelo Cérebro" quebrava com erro sempre que o cliente tinha conversas de WhatsApp
    vinculadas (o caso mais comum). Corrigido junto com a Fase 1E.
- ✅ **Fase 2** — concluída em `claude/projeto-zeus-fase-2-8vxxpr` (2026-07-03). Testada conforme a Fase 6
  (`tsc`/`lint`/`build`, Postgres local, simulação de webhook via `curl` e checagem de autorização dos crons).
  - **1. Pipeline automático** (`src/lib/zeus/pipeline.ts`, novo): chamado pelo webhook logo após salvar cada
    mensagem recebida (`IN`, não-grupo) e, como fallback, pelo novo cron `api/cron/zeus-pipeline` (a cada
    minuto, via campo novo `WhatsAppMessage.processedAt`). Faz tudo que o `inbox.ts` legado fazia — e que
    ninguém mais chamava — só que no sistema novo: vincula/cria `Cliente` por telefone, transcreve áudio
    pendente (fallback; o webhook já transcreve em tempo real), roda `analisarConversaIA`, alimenta
    `Negociacao` (com ajuste de `termometro` pelo sentimento a cada mensagem, não só na criação), registra
    `Visita` detectada, vincula `Municipio`, atualiza `resumoTexto` incrementalmente, classifica a conversa
    (`classificarConversaIA`, uma vez até o vendedor confirmar/mudar em `/atendimento`) e audita cada ação
    automática no `AuditLog` com `origem:"zeus"`.
  - **2. Push notification com deep-link**: o pipeline notifica o vendedor a cada mensagem 1:1 recebida com
    `url:"/atendimento?conversa=ID"`. Antes desta fase o webhook novo **não enviava push nenhum** (só o
    `inbox.ts` morto fazia isso) — bug real corrigido. O link `/atendimento?conversa=ID` já existia em
    `clientes/[id]` mas não tinha efeito nenhum (a tela nunca lia o parâmetro); agora `AtendimentoClient`
    recebe `convInicial` da página e abre a conversa certa direto.
  - **3. Auto-resposta com contexto único**: extraído `src/lib/zeus/cerebro-resposta.ts` com o contexto rico
    (cliente completo, negociações abertas, visitas, alertas, Academia de Vendas) que só o despacho rápido
    (debounce de 1s) tinha. O cron de fallback `agnes-dispatch` (debounce de 2min) usava um contexto mais
    pobre — agora os dois compartilham a mesma função, sem duplicação.
  - **4. Aposentadoria do legado (parcial e deliberada)**: página `/resumos` reescrita para ler
    `WhatsAppConversation`/`WhatsAppMessage` em vez do relacionamento morto `Cliente.conversas` (corrige o bug
    "página sempre vazia" documentado na Fase 1); `enviarResposta` (usada por "Agendar visita") passou a
    gravar na conversa real de `/atendimento` em vez de uma tabela que o cliente nunca vê nas respostas;
    `aprenderMeuEstilo` passou a aprender das mensagens `WhatsAppMessage` (`OUT`, excluindo as do próprio
    Cérebro) em vez de `Conversa`; `importarHistoricoZapi` (morta, sem nenhuma chamada — o import real de
    `/conexao` já usa `api/whatsapp/import-history`) foi removida; `api/zapi/qr` e `api/zapi/status` passaram
    a usar `lib/zapi.ts`; deletados `lib/integrations/inbox.ts`, `lib/integrations/zapi.ts` e
    `lib/integrations/whatsapp.ts` (Meta Cloud API — adaptador morto, nenhum webhook o consumia).
    **Decisão consciente de escopo**: `/conversas` (colar conversa + `analisarConversaAction`) continua
    gravando em `Conversa`/`AnaliseIA` — é uma ferramenta de análise ad hoc (texto colado, sem telefone
    obrigatório), semanticamente diferente de uma thread real de WhatsApp; forçá-la no formato
    `WhatsAppConversation` exigiria inventar conversas sintéticas e poluiria o inbox de `/atendimento`. Os
    modelos `Conversa`/`AnaliseIA` continuam no schema (a própria Fase 2 já previa isso: "numa migração
    posterior"), então nada quebra.
  - **Bug adicional encontrado e corrigido** (fora da auditoria original): o ramo "recebido" do webhook
    (`api/webhooks/zapi/route.ts`) não checava `existeZapiId` antes de inserir — só o ramo `fromMe` tinha essa
    proteção. Um reenvio de webhook da Z-API (comum quando a resposta demora) duplicava a mensagem recebida e,
    com o pipeline novo, reprocessava a mesma conversa duas vezes (negociação, push e auditoria em dobro).
    Corrigido com a mesma checagem usada no ramo `fromMe`.
  - **Adiado deliberadamente**: cache de prompt (Anthropic `cache_control`) nas extrações do pipeline — a
    função `llmTexto` em `lib/ai/index.ts` é compartilhada por dezenas de funcionalidades; mexer nela agora
    é uma otimização de custo/latência, não uma correção funcional, e fica para uma sessão dedicada de
    performance. Script one-shot de migração de dados úteis de `Conversa` → `WhatsAppMessage` também não foi
    escrito/rodado nesta sessão (nenhum acesso ao Postgres de produção a partir daqui) — ver nota acima sobre
    por que isso deixou de ser bloqueante.
- ⬜ Fase 3, 4, 5 — pendentes (uma por sessão, nesta ordem).

---

## Contexto

O CRM (Next.js 14 App Router + Prisma/Neon + Z-API + Anthropic) já tem uma base grande: 29 páginas, 45 componentes, 3 crons, PWA. A auditoria completa (3 varreduras: WhatsApp, IA/actions, UI/mobile) revelou o diagnóstico central:

**O CRM tem DOIS sistemas WhatsApp paralelos — e toda a inteligência automática ficou no sistema morto.**

- **Sistema legado** (`src/lib/integrations/inbox.ts`, tabela `Conversa`/`AnaliseIA`): tinha análise de IA em CADA mensagem recebida (extração de máquina/valor/concorrente/visita), alimentava negociações automaticamente, detectava visitas, criava clientes, mandava push. **Ninguém mais chama `registrarMensagemRecebida` — está 100% desconectado.**
- **Sistema novo** (`WhatsAppConversation`/`WhatsAppMessage`, webhook `api/webhooks/zapi`): só ARMAZENA mensagens. A única IA é o auto-responder (cron `agnes-dispatch`), desligado por padrão (`aiActive=false` por conversa).

Por isso o usuário sente que "o Cérebro não tem inteligência": o Cérebro do chat (`/cerebro`) **não tem tools** — o system prompt promete "acesso total, pode criar/editar/excluir" mas a rota não passa nenhuma tool ao modelo; é chat read-only sobre um snapshot de 5 números. E o pipeline automático de captação/atualização foi perdido na migração.

A visão do usuário — CRM governado por IA, autônomo na captação/identificação/atualização, com uma IA interna (ZEUS) mantendo tudo funcionando 24/7 — é implementável em grande parte com a infra que já existe (crons Vercel + Anthropic tool use + AuditLog). O plano abaixo entrega isso em 6 fases.

**Honestidade técnica sobre o ZEUS**: uma IA que reescreve o próprio código de produção sozinha (corrigir "uma letra fora de proporção" e fazer deploy) não é seguro nem viável num app Vercel serverless. O que É viável e entrega 95% do valor: ZEUS como agente autônomo com acesso total aos DADOS e às AÇÕES do CRM (via tools), rodando 24/7 por cron — vigiando saúde do sistema, corrigindo dados, disparando follow-ups, detectando anomalias, se auto-reparando (retries, filas), e reportando diariamente. Correção de CÓDIGO continua sendo feita por sessões do Claude Code (que o ZEUS pode solicitar num relatório "bugs detectados").

---

## FASE 0 — Segurança (fazer PRIMEIRO, é pré-requisito para apresentar a qualquer empresa)

1. **Auth fail-open** — `src/lib/auth.ts:19` + `src/middleware.ts:5`: sem `APP_PASSWORD` o CRM inteiro fica público. Mudar para fail-closed em produção: se `NODE_ENV==="production"` e `APP_PASSWORD` vazio, bloquear com página de aviso. Remover default `"dev-secret"` de `AUTH_SECRET` (`auth.ts:31`) em produção (lançar erro).
2. **Crons abertos** — `src/lib/whatsapp-settings.ts` (`cronAutorizado`): sem `CRON_SECRET` deve **negar** em produção (hoje o comportamento com secret ausente é inconsistente e perigoso). Documentar no README que a Vercel envia `Authorization: Bearer $CRON_SECRET` automaticamente quando a env existe.
3. **Webhook fail-open** — `src/lib/zapi.ts:111` (`validateWebhook`): sem `ZAPI_WEBHOOK_TOKEN` aceita qualquer POST. Em produção, exigir o token (ou no mínimo logar alerta ZEUS).
4. **`prisma db push` no build** — `package.json`: `"build": "prisma generate && prisma db push && next build"` altera o schema de produção em todo deploy sem migrations. Trocar por `prisma migrate deploy` (criar baseline de migrations) — ou, no mínimo, mover `db push` para script manual.
5. Verificar env vars na Vercel: `APP_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET`, `ZAPI_WEBHOOK_TOKEN`, `GROQ_API_KEY` (transcrição grátis). O token Vercel exposto anteriormente (`vcp_...`) deve ser revogado se ainda não foi.

## FASE 1 — Correções de bugs (tudo que a auditoria encontrou)

### 1A. Mobile — a causa do "trava/enquadra errado no telefone"

1. **WhatsApp fora da tela (CRÍTICO)** — `AtendimentoClient.tsx:327`: `h-[calc(100vh-1px)]` + topbar mobile do Sidebar (~56px) = altura maior que a viewport; a barra de digitação fica abaixo da dobra, e em iOS o `100vh` "pula" com a barra do Safari. Corrigir: `h-[100dvh]` com desconto da topbar em mobile (ex.: `h-[calc(100dvh-56px)] md:h-[calc(100dvh-1px)]`, medindo a topbar real) ou tela própria `fixed inset-0` abaixo da topbar. Testar em iPhone (Safari) e Android (Chrome).
2. **CerebroChat instável no iOS** — `CerebroChat.tsx:144`: `minHeight: 70vh` → usar `dvh`.
3. **Modal NovoClienteForm sem scroll** — `NovoClienteForm.tsx:32`: adicionar `max-h-[90vh] overflow-y-auto` (padrão que `EditarClienteForm.tsx:100` já usa) — hoje o botão Salvar fica inacessível em telas baixas.
4. **Zoom bloqueado (acessibilidade)** — `src/app/layout.tsx:24-31`: remover `userScalable:false`/`maximumScale:1`; garantir inputs com `text-base` (16px) para evitar auto-zoom do iOS.
5. **Grids fixos sem breakpoint** — trocar `grid-cols-2/3` por `grid-cols-1 sm:grid-cols-2` em: `ResumoClienteForm.tsx:141`, `EditarClienteForm.tsx:111`, `NovoClienteForm.tsx:44,95`, `MaquinasUsadasClient.tsx:310`, `KanbanBoard.tsx:780,794`, `auditoria/page.tsx:81`, `conexao/page.tsx:78`.
6. **Kanban: drag rouba o scroll no toque** — `KanbanBoard.tsx:101`: adicionar `TouchSensor` com `activationConstraint: { delay: 200, tolerance: 8 }` junto ao `PointerSensor` (segurar para arrastar; deslizar rola).

### 1B. Links quebrados e código morto

7. **Rota `/inbox` NÃO existe (CRÍTICO)** — corrigir para `/atendimento` em: `dashboard/page.tsx:352,365`, `ResumosClient.tsx:221`, `public/sw.js:34,52` (**push notification hoje abre 404**), `integrations/inbox.ts:230`, textos em `conexao/page.tsx:131` e `ConexaoWhatsApp.tsx:145`, e os `revalidatePath("/inbox")` em `actions.ts` (135,171,194,264,1619,1685 → `/atendimento`).
8. **Código morto a remover** (após Fase 2 absorver o que for útil): `gerarRespostaWhatsAppIA` e `classificarConversaIA` (mortas em `ai/index.ts` — a segunda será RELIGADA na Fase 2, não removida), `baixarAudio` duplicada, `BotaoImprimir.tsx`, `fimRef` em AtendimentoClient, ternário idêntico em `atendimento/page.tsx:29`, ícones `Smile`/`Paperclip` sem onClick (`AtendimentoClient.tsx:560` — remover ou implementar anexo real).

### 1C. WhatsApp — dados e confiabilidade

9. **Conversas duplicadas (race)** — adicionar `@@unique([externalPhone])` em `WhatsAppConversation` (com migração que deduplica registros existentes fundindo mensagens) e envolver `acharOuCriarConversa` em upsert/try-catch de unique violation.
10. **Renomear contato clobbera o nome do Cliente** — `api/conversations/[id]/route.ts:29`: o PATCH de `contactName` sobrescreve `Cliente.nome` sem confirmação. Só propagar ao Cliente se o front mandar flag explícita `syncCliente:true` (adicionar checkbox "Atualizar também o cadastro" no diálogo de renomear do AtendimentoClient).
11. **Envio duplicado ao cliente** — `messages/route.ts` + `whatsapp-retry`: quando `sendText` falha sem `messageId` mas a Z-API entregou, o retry reenvia. Marcar como `UNCONFIRMED` (não `FAILED`) quando o POST teve HTTP 200 sem id; retry só para `FAILED` real.
12. **Transcrição Whisper desconectada (ALTO)** — religar no webhook: quando `mediaType==="audio"` e sem `transcript` da Z-API, baixar o áudio (`baixarAudio` de `lib/zapi.ts`) e chamar `transcreverBuffer` (`integrations/transcription.ts`); salvar em `transcript` e usar como `body`. Fazer async pós-resposta do webhook (ou no cron ZEUS) para não estourar timeout.
13. **Respostas do Cérebro perdidas** — `agnes-dispatch:91`: `agnesScheduledAt` é zerado ANTES de gerar; se a IA falhar, nunca há retry. Zerar somente após sucesso (ou re-agendar no catch).
14. **Prefixo "*Cérebro:*" visível para o cliente** — `agnes-dispatch:136` chama `sendText(phone, reply, "Cérebro")` e `zapi.ts:86` prefixa `*Cérebro:*\n` na mensagem — o cliente vê que é IA (o usuário pediu explicitamente que não pareça IA). Enviar sem operatorName; manter o rótulo só no registro interno (`operatorDisplayName`).
15. **`registrarDiag` com lost-update** — `zapi-diag.ts`: read-modify-write concorrente numa linha `Configuracao` a cada webhook. Trocar por inserts em tabela própria (`ZeusEvent`, ver Fase 4) ou tolerar e simplificar.
16. **Dedup de import agressivo** — `whatsapp-store.ts:84`: chave `timestamp|60chars` pode descartar mensagens legítimas iguais no mesmo instante — aceitável, mas documentar; incluir `direction` na chave.
17. **Índices** — adicionar `@@index([sendStatus])` e `@@index([agnesScheduledAt])` em `WhatsAppMessage`/`WhatsAppConversation`.

### 1D. UI/UX e qualidade

18. **Scroll não desce ao trocar de conversa** — `AtendimentoClient.tsx:289`: efeito depende de `[mensagens.length]`; incluir o id da conversa selecionada na dependência e forçar scroll ao trocar.
19. **Nome renomeado não atualiza na tela** — `nomeConv()`/`curr()` ignoram o overlay `flags.contactName`; ler do overlay primeiro.
20. **Polling redundante** — `AtendimentoClient.tsx:252` (`router.refresh` 15s convivendo com SSE): subir para 30–60s (só para a LISTA de conversas) ou remover e atualizar a lista via SSE. `AgendaAutoRefresh` 15s → 60s.
21. **Botões sem estado de loading / duplo submit** — `NovoClienteForm.tsx:105`, `EditarClienteForm.tsx:225`: `disabled` + spinner durante o submit (padrão `useTransition` já usado em `ResumoClienteForm`).
22. **Componente `<Modal>` compartilhado** — extrair o padrão repetido em 8+ componentes (`fixed inset-0 z-50 ... max-h-[90vh] overflow-y-auto`) para `src/components/ui.tsx`; migrar `NovoClienteForm`, `EditarClienteForm`, `ClienteAcoes`, `KanbanBoard`, `AgendarVisitaDialog`, `FichasTecnicasClient`, `ImportarClientes`, `MaquinasUsadasClient`.
23. **Cores da IA no tema** — promover `#BFDE4D` (verde Cérebro) e `#1a63f5` para `tailwind.config.ts` (`cerebro.400`, `cerebro.blue`) e substituir os hex inline (12+ arquivos; `RoteiroClient.tsx` tem 40+).
24. **Estilo `.campo` triplicado** — consolidar em `globals.css`; remover os blocos `<style>` de `NovoClienteForm.tsx:116` e `EditarClienteForm.tsx:236`.
25. **Service worker cacheia API** — `public/sw.js:17`: não fazer `cache.put` para `/api/*`.
26. **Imagens de login ~2MB** — usar `next/image` (ou versões comprimidas) em `login/page.tsx:51`.
27. **`sugerirAbordagemIA` morta** — religar: botão "Sugerir abordagem (DISC)" na ficha do cliente, salvando em `abordagemIA`.

### 1E. IA/actions — robustez

28. **Centralizar modelo** — `cerebro/route.ts:137`, `agnes-dispatch:63`, `academia-atualizar` fixam `claude-sonnet-4-6` ignorando `ANTHROPIC_MODEL` (`ai/index.ts:5`, default `claude-opus-4-8`). Criar `MODEL_CHAT` e `MODEL_TAREFA` em `src/lib/ai/config.ts` lendo env com defaults sensatos (chat/agente: sonnet; extrações baratas: haiku se desejado) e usar em TODAS as chamadas.
29. **Erros do stream do Cérebro invisíveis** — `cerebro/route.ts:136`: mover a criação do stream para DENTRO do `ReadableStream` e emitir o erro como evento SSE (as mensagens amigáveis de "sem crédito/chave inválida" já existem no front e hoje nunca disparam). Checar `iaHabilitada()` antes e responder erro claro.
30. **`executarPlano` engole erros** — `actions.ts:1515`: acumular `{acao, erro}` e devolver ao AssistenteIA para exibir o que falhou.
31. **`agendar_visita` com data inválida vira "hoje"** — `actions.ts:1511`: se `parseDataBR` falhar, retornar erro na ação em vez de `?? new Date()`.
32. **Validação com zod** — usar o zod (já é dependência) nas actions de maior risco (criar/editar cliente, negociação, enviar mensagem).
33. **`buscarProspectosIA` inventa empresas** — `ai/index.ts:747` instrui a IA a criar nomes "plausíveis" que viram clientes reais no banco. Reescrever para retornar apenas PERFIS/segmentos sugeridos (sem gravar como Cliente) ou marcar claramente `status:"hipotese_ia"` fora da lista principal.
34. **`ResumosClient.tsx:68`** — verificar se passa `conversa.id` onde a função espera `clienteId`; corrigir a chamada.
35. **`gerenciarFrotaCliente` transacional** — `actions.ts:68`: envolver em `db.$transaction`.
36. **Limpar `"use server"` redundantes** dentro de funções (o arquivo já tem no topo).

## FASE 2 — WhatsApp unificado + pipeline de inteligência automática (a "captação, identificação e atualização" autônoma)

Objetivo: um único sistema (o novo), com TODA a inteligência do legado religada — automática, sem depender de botão.

1. **Pipeline por mensagem recebida** — novo módulo `src/lib/zeus/pipeline.ts`, chamado pelo webhook (pós-resposta) e/ou pelo cron ZEUS a cada minuto para mensagens não processadas (adicionar `WhatsAppMessage.processedAt DateTime?`):
   - **Vincular cliente**: se a conversa não tem `clienteId`, buscar por telefone (`phoneLookupVariants`); se não existir e a conversa não for grupo nem descartável (`deveDescartarContato`), criar Cliente com `origem:"whatsapp"`.
   - **Transcrever áudio** (item 1C.12).
   - **Analisar com IA** (reusar `analisarConversaIA`): extrair máquina, valor, condição, concorrente, data de visita, sentimento, município, perfil DISC.
   - **Alimentar o CRM automaticamente** (portar `alimentarNegociacao` + `registrarVisitaAgenda` + `vincularMunicipio` do inbox.ts legado para o sistema novo): atualizar/criar Negociacao, registrar Visita detectada, atualizar `Cliente.ultimoContato`, `aguardandoResposta`, `resumoTexto` incremental.
   - **Classificar conversa** (religar `classificarConversaIA`): `category` CLIENTE/LEAD/GRUPO/OUTRO automática quando `categoryConfirmed=false`.
   - **Termômetro por IA**: atualizar `Negociacao.termometro` conforme sentimento/urgência da conversa.
   - **Auditar**: registrar cada ação automática no `AuditLog` (origem `"zeus"`) — vira o feed do centro de comando.
   - Usar modelo barato/rápido nas extrações e cachear o system prompt.
2. **Aposentar o legado**: migrar dados úteis de `Conversa` → `WhatsAppMessage` (script one-shot), apontar `/conversas`, `analisarConversaAction`, `aprenderMeuEstilo`, `enviarResposta` e `clientes/[id]` para o sistema novo, deletar `integrations/inbox.ts`, `integrations/zapi.ts`, `integrations/whatsapp.ts` e (numa migração posterior) os modelos `Conversa`/`AnaliseIA`. As rotas `/api/zapi/qr|status` passam a usar `lib/zapi.ts`.
3. **Push notification** para `/atendimento?conv=ID` com deep-link na conversa.
4. **Auto-resposta (Agnes/Cérebro) melhorada**: manter debounce de 2min e auditMode, mas dar ao gerador o MESMO contexto do pipeline (resumo do cliente, negociação aberta, máquinas de interesse, estoque de usadas compatível) — hoje ele só vê histórico + resumoTexto. Sem prefixo `*Cérebro:*` (1C.14).

## FASE 3 — Cérebro agêntico (tool use de verdade)

Transformar `/api/cerebro` de chat read-only em **agente com ferramentas**, usando tool use da API Anthropic com loop de execução:

1. **Tools de leitura**: `buscar_cliente(nome|telefone)`, `detalhes_cliente(id)` (ficha completa + últimas mensagens + negociações + visitas), `listar_negociacoes(estagio?, status?)`, `agenda(periodo)`, `buscar_maquina(modelo)`, `estoque_usadas()`, `metricas_funil()`, `conversas_aguardando()`.
2. **Tools de escrita** (reusar as server actions existentes — `criarCliente`, `atualizarCliente`, `atualizarResumoCliente`, `criarNegociacao`, `moverNegociacao`, `marcarGanha/Perdida`, `criarTarefa`, `adicionarVisita`, `enviarResposta` via fila de rascunho): toda escrita registra no `AuditLog` com origem `"cerebro"`. Ações destrutivas (excluir) exigem confirmação no chat (a tool retorna `requires_confirmation` e o front mostra botão).
3. **Loop agêntico no SSE**: processar `tool_use` blocks, executar, devolver `tool_result`, continuar o stream; emitir eventos SSE `tool` para o front mostrar "🔧 Consultando cliente João…" em tempo real no `CerebroChat`.
4. **System prompt honesto e forte**: descrever exatamente as tools disponíveis (remover a promessa falsa atual), incluir data/hora de Brasília, estilo do vendedor (`EstiloDeFala`), resumo da Academia.
5. **Persistência do chat**: tabela `CerebroSession`/`CerebroMessage` (o histórico atual se perde no reload e é enviado pelo cliente sem validação); carregar última sessão ao abrir, botão "Nova conversa". Histórico multi-turn passa a vir do servidor (corrige também a captura frágil via `setMsgs` e a poluição com mensagens de erro).
6. **AssistenteIA absorvido**: `interpretarComando`/`executarPlano` continuam para comandos de voz rápidos, mas passam a compartilhar as mesmas tools (uma única definição de capacidades).

## FASE 4 — ZEUS: o centro de comando autônomo 24/7

Novo agente interno que governa o CRM. Implementação realista sobre a infra existente:

1. **Modelo de dados**: `ZeusEvent` (id, tipo `[health|fix|alerta|acao|erro]`, severidade, título, detalhe JSON, resolvido, criadoEm) — substitui também o `zapi-diag`. `Configuracao` guarda as chaves `zeus.*` (ligado/desligado, modo, orçamento diário de tokens).
2. **Cron `/api/cron/zeus-tick` (a cada 5 min)** — o coração. Sequência determinística + IA quando necessário:
   - **Health checks**: Z-API conectada? (`statusConexao`) — se caiu, registrar evento + push "WhatsApp desconectado, escaneie o QR". Webhook recebendo? (última msg IN vs. atividade esperada). Crons rodando? (heartbeat em `Configuracao`). `ANTHROPIC_API_KEY` válida? Banco respondendo?
   - **Fila de trabalho**: processar mensagens com `processedAt=null` (pipeline da Fase 2 como fallback do webhook), transcrever áudios pendentes, reprocessar falhas.
   - **Higiene de dados (auto-correção)**: clientes duplicados por telefone (fundir/sugerir fusão), conversas duplicadas, clientes sem município com cidade detectável nas conversas, telefones mal formatados (normalizar), negociações abertas sem `ultimoContato` há 30+ dias (sugerir arquivamento), `Cliente.aguardandoResposta` fantasma (já respondido).
   - **Alertas comerciais para a tabela `Alerta`** (hoje órfã): cliente esfriando (sem contato há X dias com negociação aberta), visita amanhã sem confirmação, concorrente citado em conversa recente, cliente aguardando resposta há mais de N horas.
3. **Cron `/api/cron/zeus-diario` (6h da manhã)** — **Briefing matinal via WhatsApp para o próprio vendedor** (enviar para o número do Ederson via Z-API): visitas do dia, quem está aguardando resposta, top 3 negociações para atacar hoje (score), alertas abertos, saúde do sistema. Gerado pelo modelo com as tools de leitura da Fase 3.
4. **Painel `/zeus`** (nova página, tema "centro de comando"): status ao vivo dos health checks, feed do `ZeusEvent` + `AuditLog`, contadores (mensagens processadas, ações automáticas, correções de dados), botões de controle (pausar auto-resposta, modo auditoria, forçar tick), e o **relatório de bugs de código** que o ZEUS detectar (erros repetidos em runtime) formatado para colar numa sessão do Claude Code.
5. **Captura de erros de runtime**: helper `zeusReport(err, contexto)` usado nos catch das rotas críticas + `global-error.tsx` no App Router → grava `ZeusEvent tipo:"erro"`; o tick agrupa erros repetidos e gera diagnóstico com IA (arquivo provável, causa provável). É assim que "o ZEUS encontra bugs" — a correção de código é sugerida, não auto-deployada.
6. **Auto-reparo dentro do possível**: retries com backoff (mensagens, transcrição, chamadas IA), re-agendamento de respostas perdidas, reconciliação de `sendStatus` UNCONFIRMED consultando a Z-API, limpeza de rascunhos órfãos.
7. **Orçamento e segurança**: limite diário de chamadas IA (contador em `Configuracao`), kill-switch global `zeus.ativo`, e TODAS as ações automáticas auditadas — apresentável para uma multinacional: autonomia com governança.

## FASE 5 — Inovações "acima da média" (benchmark: Salesforce Einstein, HubSpot Breeze, Pipedrive AI, Kommo)

Priorizadas pelo impacto para venda de máquinas pesadas no campo:

1. **Lead scoring por IA** (o que Einstein/Breeze cobram caro): score 0-100 por cliente recalculado pelo ZEUS (recência, sentimento, valor, estágio, sinais de compra na conversa) + widget "Top 5 para atacar hoje" no dashboard. Substitui o `termometro` fixo por regra.
2. **Next Best Action**: em cada ficha de cliente e no briefing, a IA sugere a próxima ação concreta ("ligar e oferecer test-drive da E215B; ele citou concorrente X e prazo de safra") com botão de executar (criar tarefa/agendar).
3. **Follow-up automático inteligente**: ZEUS detecta conversa parada com negociação quente e prepara (rascunho, auditMode) uma mensagem de retomada personalizada no estilo do vendedor — diferencial real vs. sequências fixas dos CRMs comuns.
4. **Radar de silêncio**: linha do tempo de "clientes que sumiram" ordenada por score — reativação de carteira.
5. **Modo campo (PWA)**: registro de visita por voz na ficha (já existe SpeechRecognition no AssistenteIA — reusar): "visitei o João, quer trocar a retro, orcei 480 mil" → IA atualiza resumo, negociação e agenda o follow-up.
6. **Detecção de sinais de compra em áudios**: com Whisper religado, TODO áudio vira texto analisável — os concorrentes não fazem isso no WhatsApp.
7. (Backlog pós-MVP: simulador de financiamento compartilhável, QR de indicação, integração Google Calendar já esboçada em `integrations/googleCalendar.ts`.)

## FASE 6 — Verificação e testes (fazer a cada fase)

1. `npx tsc --noEmit` + `npm run lint` + build local.
2. **Mobile**: testar `/atendimento`, `/cerebro`, modais de cliente e kanban em viewport 375×667 e 390×844 (Playwright disponível no ambiente; screenshots antes/depois).
3. **Webhook**: simular payloads Z-API (texto, áudio com/sem transcription, grupo, fromMe, status callback, duplicado) via `curl` contra dev server; verificar pipeline (cliente criado, negociação alimentada, evento ZEUS).
4. **Cérebro agêntico**: roteiro de perguntas ("qual o status do João?", "cria uma tarefa pra ligar amanhã", "marca visita sexta 14h") verificando tool calls e AuditLog.
5. **Crons**: chamar cada rota com `Authorization: Bearer $CRON_SECRET` e validar respostas/efeitos; sem o header deve dar 401.
6. Rodar a skill `/security-review` ao final da Fase 0 e da Fase 4.

## Ordem de execução e entrega

- Fases 0→1 (correções): 1 sessão. Fase 2: 1 sessão. Fase 3: 1 sessão. Fase 4: 1-2 sessões. Fase 5: incremental.
- Cada fase: commit + push em `claude/inspiring-pascal-y6iark`, depois cherry-pick/merge em `claude/relaxed-cori-5c3g4l` (deploy), teste na Vercel antes da próxima.
- Novas envs necessárias: `CRON_SECRET`, `ZAPI_WEBHOOK_TOKEN`, `GROQ_API_KEY`, `ZEUS_WHATSAPP_DESTINO` (número do vendedor para o briefing), manter `ANTHROPIC_API_KEY`.
- Modelos: `MODEL_CHAT=claude-sonnet-4-6` (Cérebro/ZEUS agêntico), `MODEL_TAREFA=claude-sonnet-4-6` (extrações; pode baixar para haiku se custo apertar) — centralizados em `src/lib/ai/config.ts`.
