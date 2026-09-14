# CRM 100% GRATUITO — passo a passo

Este guia troca **tudo que era pago** por alternativas gratuitas, sem perder as
funções principais do CRM. Siga na ordem — cada passo leva de 5 a 30 minutos.

| O que era pago | Custo/mês | Vira | Custo |
|---|---|---|---|
| Vercel Pro | US$ 20 | **Vercel Hobby** | R$ 0 |
| Neon (plano pago) | US$ 19 | **Neon Free** | R$ 0 |
| Z-API | ~R$ 100 | **Evolution API** (software aberto, você hospeda) | R$ 0 |
| Anthropic (Claude) | por uso | **Gemini + Groq** (planos grátis, com fallback automático) | R$ 0 |
| Crons da Vercel (só no Pro) | — | **cron-job.org** chamando `/api/cron/tudo` | R$ 0 |

O código já está preparado para tudo isso (commit "modo 100% gratuito"). O que
falta é a parte **operacional**, que só você pode fazer: criar contas, copiar
chaves e apontar configurações. Vamos lá.

---

## Passo 1 — IA grátis (5 min)

1. **Gemini**: entre em https://aistudio.google.com/apikey → *Create API key* → copie.
2. **Groq**: entre em https://console.groq.com/keys → *Create API Key* → copie.
   (a mesma chave também transcreve os áudios do WhatsApp, de graça)
3. Na Vercel: projeto → **Settings → Environment Variables**:
   - `GEMINI_API_KEY` = a chave do Gemini
   - `GROQ_API_KEY` = a chave do Groq
   - **Apague** `ANTHROPIC_API_KEY` (está sem crédito e só gera erro no ZEUS).
4. Salve. (O redeploy vem no Passo 5.)

> Como funciona: o CRM tenta o Gemini primeiro; se o limite diário grátis
> estourar, cai para o Groq sozinho. Você pode manter as duas ou só uma.

---

## Passo 2 — Vercel → plano Hobby (grátis)

1. Na Vercel, veja em qual **escopo** o projeto está (canto superior esquerdo).
   - Se estiver num **Team** (plano Pro): abra o projeto → **Settings → General →
     Transfer Project** → transfira para a sua conta pessoal (Hobby).
   - Se já estiver na conta pessoal, só cancele o Pro em **Settings → Billing**.
2. Em **Project Settings → Functions**, ligue **Fluid Compute** se aparecer
   (dá mais tempo de execução de graça).
3. Pronto. O `vercel.json` novo tem **um único cron diário** — é o máximo que o
   Hobby aceita (com os 6 antigos o deploy era recusado).

> O plano Hobby é para uso pessoal/não comercial. Para um CRM de uso próprio,
> de uma pessoa só, é o enquadramento normal.

---

## Passo 3 — Neon → plano Free (5 min)

1. https://console.neon.tech → seu projeto → **Billing** → **Downgrade to Free**.
2. Confira em **Usage** o tamanho do banco: o Free dá **0,5 GB**. Se estiver
   perto, apague conversas antigas/grupos no CRM.
3. Deixe o **autosuspend em 5 minutos** (padrão): o banco "dorme" quando ninguém
   usa — é isso que mantém o consumo dentro da cota grátis. O primeiro acesso
   depois de dormir demora ~1 segundo a mais. Normal.

> Plano B (só se um dia a Neon avisar que a cota de computação acabou):
> Supabase Free (500 MB, sem limite de horas). Basta trocar `DATABASE_URL` e
> `DATABASE_URL_UNPOOLED` na Vercel e clicar em "Rodar manutenção" em
> /configuracoes para criar as tabelas.

---

## Passo 4 — Agendador grátis (cron-job.org) (5 min)

Os fallbacks, o ZEUS, o retry de envio e o briefing diário rodam por um único
endpoint: `/api/cron/tudo`. Quem chama ele é o cron-job.org (grátis).

1. Na Vercel, confira se existe a variável `CRON_SECRET`. Se não existir, crie
   uma com um texto longo e aleatório (ex.: `openssl rand -hex 24`) e salve.
2. Crie conta em https://cron-job.org → **Create cronjob**:
   - **Title**: CRM tudo
   - **URL**: `https://SEU-APP.vercel.app/api/cron/tudo` (troque pelo seu domínio da Vercel)
   - **Schedule**: *Every 15 minutes*
   - Aba **Advanced → Headers** → *Add header*:
     - Key: `Authorization`  Value: `Bearer SEU_CRON_SECRET` (o mesmo valor da Vercel, com a palavra `Bearer` e um espaço antes)
   - Save.
3. Clique em **Test run**: a resposta deve ser um JSON começando com `{"ok":true`.

> Por que 15 min e não 1 min: chamadas de minuto em minuto manteriam o banco
> Neon acordado 24h e estourariam a cota grátis. O que é tempo real (mensagem
> chegando → resposta da IA) NÃO passa por aqui, continua instantâneo.

---

## Passo 5 — WhatsApp grátis com Evolution API (30–60 min, o passo mais longo)

A Evolution API faz o mesmo que a Z-API (conecta por QR Code, o número fica no
seu celular), mas é software aberto: você roda num servidor seu. Precisa de um
lugar ligado 24h.

### Caminho rápido (um comando) — recomendado

1. **Tenha um servidor Ubuntu 22.04/24.04 com IP público.** O mais rápido é uma
   VPS pequena (1 vCPU / 2 GB já serve): Hostinger KVM 1, Contabo, DigitalOcean
   ou Vultr — de R$ 20 a R$ 30 por mês, contra ~R$ 100 da Z-API. A VM grátis da
   Oracle (Opção A abaixo) também serve, só demora mais para criar a conta.
2. **Conecte por SSH** (a VPS mostra usuário, IP e senha) e cole **um comando**,
   trocando `https://SEU-CRM.vercel.app` pela URL do seu CRM:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/edersoncontas-cell/CRM/claude/relaxed-cori-5c3g4l/evolution/instalar.sh | sudo bash -s -- https://SEU-CRM.vercel.app
   ```
   Ele instala o Docker, sobe a Evolution com Postgres e Redis, libera a porta
   8080, cria a instância `crm` já com o webhook apontando para o CRM e, no
   fim, imprime as três variáveis (também salvas em `/opt/evolution/CREDENCIAIS.txt`).
3. **Na Vercel → Settings → Environment Variables**, cole `EVOLUTION_API_URL`,
   `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE`, apague as `ZAPI_*` e faça
   **Deployments → ⋯ → Redeploy**.
4. **No CRM, abra /conexao** e escaneie o QR Code com o celular (*WhatsApp →
   Aparelhos conectados → Conectar um aparelho*). Se a instância não existir, a
   própria tela oferece o botão **"Criar instância e gerar QR"**; se o webhook
   estiver fora do lugar, ela corrige sozinha.
5. Peça uma mensagem de teste. Em **/conexao → Diagnóstico do recebimento**
   deve aparecer "recebida" e a conversa entra em **/atendimento**.

Pronto. O resto desta seção é o caminho manual, para quem preferir.

### Opção A — Oracle Cloud "Always Free" (grátis, cadastro mais chato)
Servidor grátis para sempre (precisa de cartão só para confirmar identidade —
não é cobrado; escolha sempre recursos marcados *Always Free*).

1. Crie conta em https://www.oracle.com/br/cloud/free/.
2. **Compute → Instances → Create instance**:
   - Image: **Ubuntu 22.04**
   - Shape: **VM.Standard.A1.Flex** (ARM, marque *Always Free*; 2 OCPU / 12 GB já sobra) — se der "out of capacity", tente **VM.Standard.E2.1.Micro**.
   - Baixe a chave SSH que ele gera.
3. Libere a porta 8080:
   - **Networking → Virtual Cloud Networks → sua VCN → Security Lists → Default → Add Ingress Rule**: Source `0.0.0.0/0`, protocol TCP, destination port `8080`.
4. Conecte por SSH (`ssh -i sua-chave.key ubuntu@IP-DA-VM`) e cole o
   comando único do "Caminho rápido" acima (ele libera o iptables da Oracle,
   instala o Docker, sobe tudo e cria a instância). Ao final, copie as três
   variáveis para a Vercel e faça o Redeploy.
5. Se quiser ver o painel da Evolution: `http://IP-DA-VM:8080/manager`, com a
   chave que o comando imprimiu.

### Opção B — seu próprio computador (se ele puder ficar ligado)
1. Instale o **Docker Desktop** (Windows/Mac) e o **Tailscale** (https://tailscale.com, grátis).
2. Baixe a pasta `evolution/` deste repositório, edite `docker-compose.yml`
   (chave e SERVER_URL) e rode `docker compose up -d` dentro dela.
3. Exponha para a internet com URL fixa e HTTPS grátis:
   `tailscale funnel 8080` → ele mostra uma URL tipo `https://seu-pc.tail1234.ts.net`.
   Use essa URL como `SERVER_URL` no compose (suba de novo) e como `EVOLUTION_API_URL` na Vercel.

### Criar a instância e o webhook (nas duas opções)
1. No **Manager** (`…:8080/manager`): **+ Instance** → Name: `crm` → Channel: **Baileys** → Save.
2. **Caminho fácil:** depois de colocar as variáveis na Vercel (item 3 abaixo) e
   fazer o redeploy, abra **/conexao** no CRM e clique em **“Configurar webhook
   agora”** — o CRM aponta a instância para ele mesmo, com os eventos certos e
   o Base64 ligado. Se preferir fazer à mão, siga o passo manual:
   Ainda na instância → aba **Webhook** (ou *Events → Webhook*):
   - Enabled: **ON**
   - URL: `https://SEU-APP.vercel.app/api/webhooks/evolution`
   - **Webhook Base64: ON** (é assim que os áudios chegam para transcrição)
   - Events: marque **MESSAGES_UPSERT** e **MESSAGES_UPDATE**
   - Save.

   Se preferir por comando (troque os valores em MAIÚSCULO):
   ```bash
   curl -X POST "http://IP-DA-VM:8080/webhook/set/crm" \
     -H "apikey: SUA_AUTHENTICATION_API_KEY" -H "Content-Type: application/json" \
     -d '{"webhook":{"enabled":true,"url":"https://SEU-APP.vercel.app/api/webhooks/evolution","byEvents":false,"base64":true,"events":["MESSAGES_UPSERT","MESSAGES_UPDATE"]}}'
   ```
3. Na Vercel → **Environment Variables**:
   - `EVOLUTION_API_URL` = `http://IP-DA-VM:8080` (ou a URL do Tailscale)
   - `EVOLUTION_API_KEY` = a sua `AUTHENTICATION_API_KEY`
   - `EVOLUTION_INSTANCE` = `crm`
   - **Apague** `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN`, `ZAPI_CLIENT_TOKEN` (e `ZAPI_WEBHOOK_TOKEN`, se existir).
4. **Deployments → ⋯ → Redeploy** (para as variáveis novas valerem).
5. No CRM, abra **/conexao** → aparece o QR Code → no celular: *WhatsApp →
   Aparelhos conectados → Conectar um aparelho* → escaneie.
6. Peça para alguém te mandar uma mensagem. Em **/conexao → Diagnóstico do
   recebimento** deve aparecer "recebida", e em **/atendimento** a conversa.
7. Só depois de tudo funcionando, **cancele a Z-API**.

---

## Passo 6 — Conferência final

- **/configuracoes**: os cards *Orientador de Vendas* (Google Gemini), *WhatsApp via Evolution API* e *Transcrição de áudio* verdes.
- **/conexao**: "WhatsApp conectado · Evolution API · grátis".
- Mande uma mensagem de teste de outro número → a IA responde (ou cria rascunho, conforme o modo).
- **/zeus**: sem erros novos. Os antigos ("credit balance too low") pode marcar como resolvidos.
- **cron-job.org → History**: execuções com status 200 a cada 15 min.
- **Modo fim de semana** em /atendimento: desligue e ligue de novo uma vez (re-treina o estilo da IA só com as SUAS mensagens).

---

## Variáveis de ambiente finais na Vercel (resumo)

| Variável | Valor |
|---|---|
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | as do Neon (não mudam) |
| `APP_PASSWORD`, `AUTH_SECRET` | como já estão |
| `CRON_SECRET` | texto longo aleatório (mesmo do cron-job.org) |
| `GEMINI_API_KEY` | chave do AI Studio |
| `GROQ_API_KEY` | chave do Groq |
| `EVOLUTION_API_URL` | `http://IP:8080` ou `https://…ts.net` |
| `EVOLUTION_API_KEY` | AUTHENTICATION_API_KEY do compose |
| `EVOLUTION_INSTANCE` | `crm` |
| `NEXTAUTH_URL` | `https://SEU-APP.vercel.app` (se ainda não tiver, crie — as rotas internas usam para se chamar) |
| ~~`ANTHROPIC_API_KEY`~~, ~~`ZAPI_*`~~ | apagar |

---

## O que muda / limitações do modo grátis (para você saber)

- **Fotos e documentos** recebidos no WhatsApp aparecem no CRM só como
  "📷 Imagem"/"📄 nome.pdf" com a legenda — não abrem no navegador (a
  Evolution não gera link público de mídia sem um serviço de armazenamento).
  **Áudios continuam sendo transcritos** normalmente.
- Conversas apagadas no celular não somem sozinhas do CRM: apague pelo menu da
  conversa (“Excluir conversa”) ou use “Ignorar conversa”.
- Os fallbacks (mensagem que a IA não conseguiu responder na hora, retry de
  envio) rodam a cada **15 min** em vez de 1 min. O caminho normal (mensagem →
  resposta) continua em tempo real.
- Depois de 5 min sem uso, a primeira tela demora ~1 s a mais (banco acordando).
- Se a Evolution cair (servidor reiniciou), o ZEUS avisa "WhatsApp
  desconectado" e você reconecta em /conexao. Na Oracle, `restart: always` no
  compose sobe tudo de novo sozinho após reboot.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| /conexao diz "Instância não existe" | nome diferente de `EVOLUTION_INSTANCE` | crie a instância com o nome exato ou ajuste a variável |
| QR não aparece | Evolution não alcançável pela Vercel | teste `http://IP:8080` no navegador; confira porta 8080 liberada nos dois firewalls (Oracle + iptables) |
| Mensagens não chegam no CRM | webhook não configurado | refaça "Criar a instância e o webhook"; confira em /conexao → Diagnóstico |
| Áudio chega como "🎵 Áudio" sem texto | Base64 desligado no webhook, ou sem `GROQ_API_KEY` | ligue *Webhook Base64* e confira a chave |
| ZEUS: "cron parece parado" | cron-job.org sem rodar | veja *History* no cron-job.org; confira o header Authorization |
| IA "limite excedido" no ZEUS | cota diária do Gemini | normal — o Groq assume sozinho; se os dois estourarem, espera até o dia seguinte |
