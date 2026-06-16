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
