# 🚜 CRM New Holland Construction + Dynapac — Vendas Inteligentes com IA


CRM pessoal para vendedor da linha **New Holland Construction** (mini
escavadeira E35D até motoniveladoras) e **Dynapac** (rolos de solo e asfalto) no
**sul do Espírito Santo**. Tem um **cérebro de IA** que lê conversas, identifica
o perfil do cliente, extrai o que foi negociado (máquina, valor, forma de
pagamento, concorrente, data de visita), organiza o funil em **Kanban**, mostra
**metas/forecast** no dashboard, gera **comparativos com a concorrência**, avisa
quando um cliente fica **sem resposta** e registra **vendas perdidas**.

> Esta é a **fundação** do projeto. Funciona 100% em modo manual/exemplo e tem
> as integrações (WhatsApp, Google Agenda, transcrição) já "plugáveis" — basta
> adicionar as credenciais para ativá-las.

## ✨ O que já está pronto

- **Dashboard** com metas, **forecast ponderado**, **comissão estimada**,
  funil por estágio, **leads esfriando**, alertas de clientes parados, fila
  "aguardando resposta" e resumo "Bom dia".
- **Comparativo de máquinas**: sua máquina New Holland/Dynapac vs concorrentes
  da **mesma categoria e faixa de peso**, com **argumentos prontos (battlecards)**
  e os diferenciais que o mercado mais elogia.
- **Clientes**: cadastro completo, **Lead Score A/B/C**, pós-venda e indicações,
  filtro e **mapa de calor** por município do sul do ES.
- **Pipeline (Kanban)** estilo Trello — arraste os cards entre as colunas.
- **Conversas + IA**: cole texto/transcrição **ou dite por voz**; a IA extrai
  máquina, valor, pagamento, concorrente, **data de visita** e escreve um
  **rascunho no seu tom**.
- **Roteiro de visitas** agrupado por município (menos estrada).
- **Campanhas segmentadas** por município ou máquina de interesse.
- **Simulador** de financiamento (Moderfrota/Finame/Pronaf/CDC) e consórcio.
- **Proposta comercial em PDF** por negociação.
- **Agenda** de visitas, **Vendas perdidas**, **Sugestões** (estilo Google
  Fotos), **Mídia**, importação de clientes (CSV) e **PWA** instalável.
- **Configurações**: status de cada integração e como ativá-las.

### Catálogo de máquinas (banco)
New Holland Construction (E35D · E175C/E215C/E245C · B95C/B110C · W12D/W130B/
W170B/W190B · RG140/170/200.B · D140B) + Dynapac (solo CA · tandem CC ·
pneumático CP) e os principais **concorrentes** do ramo no Brasil (Caterpillar,
Komatsu, Volvo, JCB, Case, XCMG, Sany, SDLG, Hyundai, John Deere, Bomag, Hamm,
Ammann, Müller etc.).

## 🧠 O cérebro de IA

Usa a **API da Anthropic** (modelo `claude-opus-4-8` por padrão). **Sem a chave**
`ANTHROPIC_API_KEY`, tudo continua funcionando com um **fallback heurístico**
(regex em PT-BR para datas, valores, modelos New Holland, concorrentes etc.).

## 🚀 Como rodar (local)

```bash
npm install
cp .env.example .env        # ajuste se quiser (SQLite já vem configurado)
npx prisma db push          # cria o banco SQLite
npm run seed                # popula municípios, máquinas e dados de exemplo
npm run dev                 # http://localhost:3000
```

## 🔌 Como ativar as integrações

Edite o `.env` (veja `.env.example`):

| Integração         | Variáveis                                             |
| ------------------ | ----------------------------------------------------- |
| IA Anthropic       | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`                |
| WhatsApp (Z-API)   | `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN`/`ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`, `ZAPI_WEBHOOK_TOKEN` |
| Google Agenda      | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| Login pessoal      | `APP_PASSWORD`, `AUTH_SECRET` (se vazio, sem senha)   |

Webhook do WhatsApp (Z-API): `POST /api/webhooks/zapi` — configure em `/conexao`.

## 🏗️ Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma (SQLite no dev,
Postgres em produção) · Anthropic SDK · dnd-kit · Recharts.

## ☁️ Produção (Vercel + Postgres/Neon)

1. Configure `DATABASE_URL` e `DATABASE_URL_UNPOOLED` (Neon: pooled + direct).
2. O build (`npm run build`) só roda `prisma generate && next build` — ele **não**
   altera o schema do banco automaticamente. Depois de mudar `prisma/schema.prisma`,
   rode `npm run db:push` manualmente (ou configure migrations com `prisma migrate`).
3. Defina as variáveis de ambiente abaixo na Vercel **antes** do primeiro deploy em
   produção — sem elas, o CRM roda com proteções desligadas (fail-open) ou fica
   bloqueado com uma tela de aviso:

| Variável             | Efeito se ausente em produção                                      |
| -------------------- | ------------------------------------------------------------------- |
| `APP_PASSWORD`        | CRM inteiro bloqueado (tela `/config-necessaria`) até ser definida. |
| `AUTH_SECRET`         | Se `APP_PASSWORD` estiver definida mas esta não, o login quebra (erro proposital, não abre com segredo previsível). |
| `CRON_SECRET`         | Rotas `/api/cron/*` retornam 401. A Vercel envia automaticamente `Authorization: Bearer $CRON_SECRET` nas chamadas agendadas quando esta env existe — não precisa configurar nada além da variável. |
| `ZAPI_WEBHOOK_TOKEN`  | **Opcional.** Só configure se sua conta Z-API tiver um "Token de segurança da conta" (nem todo plano tem — nesse caso, use o mesmo valor de `ZAPI_CLIENT_TOKEN`). Sem essa env, o webhook aceita o POST normalmente (a URL não é pública e o `instanceId` do payload é conferido). Se configurar com um valor que a Z-API não carimba nas chamadas, o webhook passa a rejeitar TODAS as mensagens — não invente um valor por conta própria. |
| `GROQ_API_KEY`        | Sem ela, sem transcrição de áudio do WhatsApp e sem IA de texto gratuita (fallback heurístico continua funcionando). Grátis em console.groq.com. |
| `ZEUS_WHATSAPP_DESTINO` | **Opcional (Fase 4).** Sem ela, o briefing matinal (`/api/cron/zeus-diario`) não é enviado — fica só registrado como evento no painel `/zeus`. Defina com o número do próprio vendedor (formato `55DDDNÚMERO`) para receber o briefing por WhatsApp às 6h (Brasília). |
| `ZEUS_ORCAMENTO_IA_DIARIO` | **Opcional.** Limite de chamadas de IA "extras" do ZEUS por dia (diagnóstico de bugs repetidos, etc. — não conta o pipeline/Cérebro). Padrão: 50. |

4. Se qualquer token de acesso à Vercel/GitHub tiver sido exposto (ex.: em logs,
   chat, commit), revogue-o e gere um novo antes de seguir.

## 🗺️ Próximas fases

WhatsApp em tempo real (envio + atendimento de fim de semana), OAuth Google,
transcrição de áudio, reconhecimento de rostos em fotos, simulador de
financiamento/consórcio, proposta em PDF, radar de sazonalidade/safra e jobs
agendados (mídia quinzenal e varredura de inatividade).
