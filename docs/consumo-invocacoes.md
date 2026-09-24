# Consumo de invocações — por que o banco não dormia

Registro da correção de 24/09/2026. Serve para quem mexer em qualquer tela que
se atualiza sozinha.

## O que acontecia

Quatro componentes tinham um `setInterval` de **60 segundos** que continuava
rodando com a aba em segundo plano: PC com o CRM aberto a noite toda, celular
bloqueado, app minimizado. Cada volta chamava uma rota que **consulta o banco**:

| Componente | Rota | Onde aparece |
|---|---|---|
| `Sidebar.tsx` | `/api/alertas/contagem` | todas as telas (contador de alertas no menu) |
| `RodapeMercado.tsx` | `/api/mercado/ticker` | todas as telas (letreiro do rodapé) |
| `TickerMercado.tsx` | `/api/mercado/ticker` | Dashboard |
| `MapaVendasES.tsx` | `/api/dashboard/vendas-mapa` (2 chamadas por volta) | Dashboard |

Na varredura apareceu um quinto, com o mesmo defeito e mais rápido:

| `ConexaoWhatsApp.tsx` | `/api/zapi/status` (lê o banco) | tela de Conexão, **a cada 5 s** |

**Por que isso derrubou o CRM.** O Neon suspende o banco depois de 5 minutos sem
consulta, e é isso que faz o plano grátis caber na cota (100 horas de computação
por mês). Com uma consulta por minuto, o banco **nunca** suspendia. Ligado o mês
inteiro na menor computação (0,25 CU), são cerca de **180 horas contra 100 de
cota**. Somado ao loop da manutenção de 23/09 (ver `CLAUDE.md`, item 8), a cota
acabou e o Neon suspendeu o projeto.

Com só o Dashboard aberto em segundo plano, eram cerca de **300 chamadas por
hora**, 7.200 por dia, cada uma acordando o banco.

## O que mudou

1. **`src/lib/intervalos-atualizacao.ts`**, um lugar só para os intervalos:
   - `INTERVALO_MERCADO = 15 * 60_000` — letreiro (rodapé e Dashboard)
   - `INTERVALO_ALERTAS = 10 * 60_000` — contador do menu
   - `INTERVALO_MAPA_VENDAS = 10 * 60_000` — mapa de vendas
2. **Todo `setInterval` que chama o servidor confere a visibilidade dentro da
   própria volta:**
   ```ts
   setInterval(() => { if (document.visibilityState === "visible") buscar(); }, INTERVALO_X)
   ```
   Aba escondida não gera chamada nenhuma.
3. **A Conexão do WhatsApp** ganhou só a checagem de visibilidade. Os 5 s
   continuam, porque são eles que atualizam o QR Code enquanto você conecta.
4. **O texto em Configurações** dizia "atualizados a cada minuto no letreiro".
   Agora ele lê a constante, e não diverge mais do código.

**O que NÃO mudou, de propósito:**
- os listeners de `focus` e `visibilitychange`: voltar para a tela busca na hora,
  então o dado não fica velho quando você olha;
- o botão **Atualizar** do Dashboard, que continua buscando tudo na hora;
- a lista de conversas do Atendimento, que já checava a visibilidade.

## Antes × depois (chamadas por hora)

| | Antes, aba visível | Antes, aba escondida | Depois, aba visível | Depois, aba escondida |
|---|---:|---:|---:|---:|
| Contador de alertas | 60 | 60 | 6 | **0** |
| Letreiro do rodapé | 60 | 60 | 4 | **0** |
| Letreiro do Dashboard | 60 | 60 | 4 | **0** |
| Mapa de vendas (2 por volta) | 120 | 120 | 12 | **0** |
| Conexão do WhatsApp | 720 | 720 | 720 | **0** |

## O que ainda acorda o banco (e está certo que acorde)

- **O agendador externo** (cron-job.org) chama `/api/cron/tudo` a cada 15 minutos,
  96 vezes por dia. Cada vez o banco fica acordado pelo menos 5 minutos: cerca de
  8 horas por dia, ou ~60 horas de computação por mês na menor computação.
  Cabe nos 100 da cota grátis, mas é mais da metade dela. **É a próxima
  alavanca**, se a cota voltar a apertar: espaçar as rotinas que não precisam de
  15 minutos.
- **Mensagem de WhatsApp que chega**: cada uma aciona o webhook e grava no banco.
  É o CRM trabalhando.
- **Você usando o CRM**: cada tela aberta consulta o banco.

## A regra para daqui em diante

Todo `setInterval` novo em tela que chame o servidor (`fetch`, `router.refresh`
ou ação de servidor) confere `document.visibilityState` dentro da volta, e usa um
intervalo de `lib/intervalos-atualizacao.ts`. O teste
`tests/consumo-invocacoes.test.ts` varre `src/components` e **falha** se aparecer
um sem a checagem. Foi conferido que ele pega o defeito: com a checagem removida
da Conexão do WhatsApp, dois testes quebram.
