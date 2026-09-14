# CRM do Edy — vendas de máquinas pesadas com IA

CRM pessoal de um vendedor de **New Holland Construction** (retroescavadeiras,
escavadeiras, pás-carregadeiras, motoniveladoras) e **Dynapac** (rolos) no sul
do Espírito Santo. O WhatsApp é a porta de entrada: a mensagem chega, vira
cliente e negociação, a IA analisa a conversa e orienta a próxima ação, e um
centro de comando (ZEUS) cuida da saúde do sistema e da higiene dos dados.

> 💸 **Rodando de graça?** [`docs/GRATUITO.md`](docs/GRATUITO.md): Vercel Hobby +
> Neon Free + Evolution API + Gemini/Groq + cron-job.org — custo mensal R$ 0.
>
> 📅 **Google Agenda e Contatos**: [`docs/GOOGLE.md`](docs/GOOGLE.md) — visitas
> na sua agenda e nomes dos contatos preenchendo clientes, via OAuth.

## O que o sistema faz

**Principal**
- **Dashboard** — vendas do ano, faturamento, mapa do ES com cifrão por cidade,
  ticker de café/dólar, notícias do setor, calendário, painéis operacionais.
- **Alertas** — central única: rascunhos da IA, clientes aguardando resposta,
  alertas comerciais, pós-venda vencido, visitas, demandas, sistema.
- **Orientador de Vendas** — para cada conversa: estágio, objeções, temperatura,
  probabilidade, próxima ação e melhor resposta. Arraste o card para o funil.
- **Negociações** — funil Kanban; mover para *Faturado* registra a venda, a
  comissão e inicia o pós-venda.
- **Demandas** — quadro de tarefas com checklist, cidade e prazo.
- **WhatsApp** — caixa de entrada em tempo real (Z-API ou Evolution API),
  vínculo com cliente, rascunho ou resposta automática da IA, relatório em PDF.
- **Visitas** — agenda semanal, registro por voz, sincronização com a Google Agenda.
- **Clientes** — cadastro, região, mapeamento por município, importação, frota.
- **Pós-venda** — marcos de 30/60/180/365 dias após o faturamento.

**Vendas** — Fichas Técnicas (IA lê PDF/imagem), Comparativo com concorrentes,
Máquinas Usadas.

**Treinamento** — Academia de Vendas: trilha de 10 níveis e 60 aulas escritas
para o nicho, com casos, scripts, quiz, prova final e treino com IA.

**Análise** — Financeiro: comissões, CRD PME, faturadas por ano/mês.

**Sistema** — Cérebro IA (chat que opera o CRM com ferramentas e auditoria),
ZEUS (saúde, higiene, alertas, follow-up automático, diagnóstico), Conexão
WhatsApp, Auditoria, Configurações (parâmetros do negócio, integrações).

## Tecnologia

- Next.js 14 (App Router) + TypeScript + Tailwind, Prisma 5 + PostgreSQL (Neon).
- IA multiprovedor com fallback real: Gemini → Groq → DeepSeek → OpenAI →
  Anthropic (`src/lib/ai`). Sem chave, tudo continua funcionando com heurísticas.
- WhatsApp: Z-API (pago) ou Evolution API (grátis, self-hosted) —
  `src/lib/zapi.ts` abstrai os dois; webhooks em `src/app/api/webhooks/*`.
- Rotinas: um cron da Vercel (`/api/cron/tudo`, diário) e um agendador externo
  a cada 15 min disparam pipeline, orientador, retry, ZEUS tick, briefing e
  Academia.
- Migrações de schema em tempo de execução (`src/lib/migrations.ts`), aplicadas
  automaticamente na primeira página aberta após um deploy.

## Rodar local

```bash
npm install
cp .env.example .env         # DATABASE_URL (Postgres), APP_PASSWORD, AUTH_SECRET, chaves de IA
npx prisma db push
npm run seed                 # municípios, catálogo de máquinas e clientes de exemplo
npm run dev
```

Verificações antes de subir: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Variáveis de ambiente

Veja `.env.example`. As essenciais: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
`APP_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET`, uma chave de IA
(`GEMINI_API_KEY` ou `GROQ_API_KEY`) e as do provedor de WhatsApp. Opcionais:
Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`) e
push (`VAPID_*`). Comissão, meta, nomes, marcas e região são editados na tela
de Configurações, não em variáveis.

## Documentação

- `docs/GRATUITO.md` — operação com custo zero.
- `docs/GOOGLE.md` — Google Agenda e Contatos.
- `docs/PROJETO-ZEUS.md`, `docs/PROJETO-ZEUS-FASE-2B.md`, `docs/ROADMAP-CRM-EDY.md`
  — histórico de construção e roadmap.
