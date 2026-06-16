# 🚜 CRM New Holland — Vendas Inteligentes com IA

CRM pessoal para vendedor de máquinas pesadas New Holland no **sul do Espírito
Santo**. Tem um **cérebro de IA** que lê conversas, identifica o perfil do
cliente, extrai o que foi negociado (máquina, valor, forma de pagamento,
concorrente, data de visita), organiza o funil em **Kanban**, mostra **metas**
no dashboard, avisa quando um cliente fica **sem resposta** e registra **vendas
perdidas**.

> Esta é a **fundação** do projeto. Funciona 100% em modo manual/exemplo e tem
> as integrações (WhatsApp, Google Agenda, transcrição) já "plugáveis" — basta
> adicionar as credenciais para ativá-las.

## ✨ O que já está pronto

- **Dashboard** com metas (diária/semanal/mensal/prospecção/negócios em banco),
  funil por estágio, alertas de clientes parados e fila "aguardando resposta".
- **Clientes**: cadastro completo (telefone, município, já comprou, visitado),
  filtro por município e **mapa de calor** dos municípios do sul do ES.
- **Pipeline (Kanban)** estilo Trello — arraste os cards entre as colunas.
- **Conversas + IA**: cole texto/transcrição e a IA extrai máquina, valor,
  pagamento, concorrente, **data de visita** e escreve um **rascunho no seu tom**.
- **Agenda** de visitas detectadas pela IA.
- **Vendas perdidas** com motivos e relatório.
- **Sugestões** estilo Google Fotos (vincular contato desconhecido com 1 clique).
- **Mídia**: gera posts chamativos das máquinas a cada 15 dias.
- **Configurações**: status de cada integração e como ativá-las.

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
| WhatsApp Business  | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` |
| Google Agenda      | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| Login pessoal      | `APP_PASSWORD`, `AUTH_SECRET` (se vazio, sem senha)   |

Webhook do WhatsApp: `POST /api/whatsapp/webhook` (verificação por `GET`).

## 🏗️ Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma (SQLite no dev,
Postgres em produção) · Anthropic SDK · dnd-kit · Recharts.

## ☁️ Produção (Vercel + Postgres)

1. Troque o `provider` do `prisma/schema.prisma` para `postgresql`.
2. Configure `DATABASE_URL` para o Postgres gerenciado.
3. `npx prisma migrate deploy` e defina as variáveis de ambiente na Vercel.

## 🗺️ Próximas fases

WhatsApp em tempo real (envio + atendimento de fim de semana), OAuth Google,
transcrição de áudio, reconhecimento de rostos em fotos, simulador de
financiamento/consórcio, proposta em PDF, radar de sazonalidade/safra e jobs
agendados (mídia quinzenal e varredura de inatividade).
