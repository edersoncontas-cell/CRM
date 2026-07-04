# PROJETO ZEUS — FASE 2B: Performance, bugs de navegação, Financeiro, catálogo de máquinas, Comparativo 2.0 e exclusões

> **Este arquivo é o prompt completo para execução em uma sessão do Claude Code.** Todos os itens foram diagnosticados por auditoria de código na sessão de 2026-07-03 (com referências arquivo:linha conferidas contra o branch `claude/relaxed-cori-5c3g4l` pós-merge do PR #1). Executar TODOS os itens, na ordem, testando conforme a seção final de verificação.

## Estado de execução

- ✅ Fase 2B — concluída (todos os itens A–J + Passo 0, na ordem, com verificação local em Postgres de teste).

**Passo 0 (schema em produção):** implementado com a preferência indicada — `NotaMaquina`, `ZeusEvent`, `CerebroSession` e
`CerebroMessage` agora são criadas via `CREATE TABLE IF NOT EXISTS` em `aplicarMigracoes()` (`src/lib/migrations.ts`), disparada
automaticamente pela rota `POST /api/admin/manutencao` (`src/lib/manutencao.ts`) e/ou na primeira renderização de qualquer página
pesada (guard `manutencao.v1` em `Configuracao`, 1 SELECT memoizado por request via `React.cache`). **Não é preciso rodar
`prisma db push` manualmente em produção** — basta fazer o redeploy; a manutenção completa dispara sozinha no primeiro acesso, ou
pode ser disparada na hora pelo botão "Rodar manutenção" em Configurações. Testado localmente: dropei as 4 tabelas do Postgres de
teste, chamei a rota autenticada e confirmei via `psql` que as 4 voltaram a existir.

**A (performance):** rota `/api/admin/manutencao` + botão em Configurações; `garantir*` removidas de todas as páginas
(clientes, clientes/[id], negociações, pipeline, resumos, máquinas, cérebro) e substituídas por
`garantirManutencaoSeNecessario()`; `loading.tsx` genérico + específicos (dashboard, clientes, negociações, atendimento). O
dashboard já consolidava tudo em um único `Promise.all` (feito em fase anterior) — nada a mudar ali. Medição local (Postgres
de teste, dev server, 2ª chamada): com o guard já setado, `/clientes` ~0,06-0,08s. Simulando o "antes" (removendo a chave de
guarda para forçar a manutenção completa rodar de novo) o mesmo request subiu para ~0,17s nesta máquina local — a diferença
real em produção é maior porque cada uma das dezenas de queries do pipeline antigo tinha ida-e-volta de rede até o Neon (o
"~5s" relatado), que não existe rodando contra Postgres local.

**B/C (CSS/scroll):** removido `[class*="overflow-x"]` do scroll-snap (mantido só `.kanban-scroll`, agora `x proximity`),
removido `will-change` permanente do `aside` e `scroll-behavior: smooth` do `html`. Sidebar desktop ganhou
`md:h-screen md:max-h-screen md:overflow-hidden` para o `<nav>` interno rolar sozinho — testado com Playwright: rolar a página
não move a sidebar; rolar sobre a sidebar não move a página.

**D (error boundaries):** `global-error.tsx` já existia (Fase 4, reporta ao ZEUS); criado `src/app/(app)/error.tsx` no mesmo
padrão. Testado abrindo a ficha de todos os clientes do seed (incluindo sem município/telefone) — sem erros.

**E (Financeiro):** "FATURADO EM" editável (`<input type="date">` + `definirFaturadoEm`, já existia como action, só faltava a
UI) — testado end-to-end (edição refletida no Postgres). Coluna FATURADO do funil agora lista todo `status: "ganha"` (mesmo
padrão da coluna Perdidos); `marcarGanha` normaliza `estagio` para o título real da coluna FATURADO. Testado inserindo uma
negociação "ganha" com `estagio` legado (não batia com nenhuma coluna) — passou a aparecer no funil E no Financeiro.

**F (catálogo):** `MARCAS` hardcoded removida de `FunilNegociacoes`, `AtendimentoClient` e `ResumoClienteForm` — os 3 modais de
Nova Negociação agora recebem `maquinasProprias` do banco; dropdown Marca mostra só New Holland/Dynapac (+ "Outro" com campo
livre). `seed-core.ts` harmonizado com o portfólio oficial (renomeados os EVO/pontuados, removidos L325/W12D/D140B do próprio,
adicionados E385C/E405C/E485C/E505C sem inventar specs). `scripts/corrigir-catalogo.ts` criado e testado (dry-run limpo no
catálogo correto; testado também sujando o banco de propósito — EVO antigo, marca errada como próprio, modelo oficial faltando
— e confirmado que `--apply` corrige tudo e preserva vínculos como `NotaMaquina` no rename). Grep final por
`E115C|E135B|W80C|W130C|B115C|EVO` limpo em `src/`.

**G (fichas técnicas):** `bodySizeLimit: "10mb"` no `next.config.mjs`; validação client de tamanho (4MB arquivo/2MB texto,
mensagem clara) antes de enviar; textos da action alinhados ao novo limite. Durante o teste encontrei e corrigi um bug real:
upload de TXT sem nenhuma chave de IA configurada mostrava "Erro ao ler o arquivo" (mensagem errada) em vez de "IA não
habilitada" — `llmTexto` lança exceção quando não há provedor, e o caminho de texto de `extrairFichaDeArquivoIA` não checava
`iaHabilitada()` antes de chamá-la como os outros ~15 call sites do arquivo já fazem. Corrigido e testado (TXT pequeno, PDF
5MB acima do teto).

**H/I (exclusões):** Super Trunfo e Conversas + IA removidos (páginas, componentes, entradas de menu, actions/funções
exclusivas — `gerarAnaliseCategoriaIAAction`/`gerarAnaliseCategoriaIA`). `garantirFichasVerificadas` foi mantida (preenche
`especificacoes`, usada pelo Comparativo/Fichas Técnicas) e passou a rodar via rota de manutenção. Grep final por
`super-trunfo|SuperTrunfo|Trofeu|conversas|ConversaAnaliser` limpo.

**J (Comparativo 2.0):** modelo `NotaMaquina` + CRUD (criar/editar/excluir); seleção Marca→Modelo para minha máquina
(`MaquinaPicker` reescrito); seletor manual Marca→Modelo de QUALQUER concorrente com múltipla seleção simultânea (sugestão
automática por categoria/peso mantida como estado inicial); seção "Meu conhecimento" com notas por máquina/concorrente
opcional; resumo de diferenciais com benefício (IA, nunca inventa specs); "Gerar comparativo completo" multi-concorrente com
cabeçalho (imagem quando existir), tabela, pontos fortes com benefício, objeções e conclusão, com botão imprimir/PDF
(`window.print()` + classes `print:hidden`); battlecards e argumentos-template existentes mantidos. Notas alimentam também o
Cérebro: tool `buscar_maquina` devolve `notasVendedor`, e `montarContextoCliente` (despacho-rápido/agnes-dispatch) inclui
notas da(s) máquina(s) de interesse do cliente.

**Verificação:** `npx tsc --noEmit`, `npm run lint` e `npm run build` limpos. Testado localmente com Postgres de teste (seed
completo): naveguei por todas as páginas alteradas sem erros no console do servidor; Playwright em 1280×800 e 390×844
confirmou rolagem independente da sidebar, card faturado consistente no funil, modal Nova Negociação sem CASE, e o
Comparativo 2.0 completo (nota salva, erros de IA claros com `ANTHROPIC_API_KEY`/`GROQ_API_KEY` ausentes). Observação (não
corrigida, fora do escopo desta fase): o modal "Nova Negociação" do funil renderiza com `position: fixed` escopado à coluna
(não à viewport) porque a coluna tem `backdrop-blur-sm`, que cria containing block para elementos fixed — bug de CSS
pré-existente, anterior a esta sessão, sem relação com os itens pedidos aqui. Também aparece um warning de hydration do
`@dnd-kit/core` (`aria-describedby DndDescribedBy-N`) em `/negociacoes`, também pré-existente e não introduzido nesta fase.

## Passo 0 — Pré-requisitos operacionais (fazer PRIMEIRO)

1. **Base do branch**: crie/reinicie o branch de trabalho a partir do `claude/relaxed-cori-5c3g4l` mais recente (`git fetch origin claude/relaxed-cori-5c3g4l && git checkout -B <branch> origin/claude/relaxed-cori-5c3g4l`). Se a Fase 2 do PROJETO ZEUS já tiver sido mesclada, este doc assume prioridade em caso de conflito nos itens abaixo (são áreas distintas — conflitos são improváveis, exceto talvez em `menu.ts` e `actions.ts`).
2. **Banco de produção**: o build NÃO roda mais `prisma db push` (mudança da Fase 0). Como as Fases 2-4 mescladas criaram `ZeusEvent`/`CerebroSession`/`CerebroMessage` que ainda não existem em produção, e esta fase acrescenta `NotaMaquina` (item J), a solução adotada foi `CREATE TABLE IF NOT EXISTS` para as 4 tabelas em `aplicarMigracoes()` (`src/lib/migrations.ts`), disparado automaticamente por `POST /api/admin/manutencao` — que roda sozinho no primeiro acesso a qualquer página pesada após o deploy (guard `manutencao.v1`), ou pode ser disparado na hora pelo botão "Rodar manutenção" em Configurações. **Não é necessário rodar `prisma db push` manualmente** para este deploy.
3. Para testes locais: Postgres local + `.env` de teste (padrão usado nas fases anteriores; ver `docs/PROJETO-ZEUS.md`).

## A. Performance — páginas levando ~5s para abrir

**Causa raiz diagnosticada:** funções `garantir*` que rodam migrações e escritas em massa NO CAMINHO DE RENDERIZAÇÃO de páginas, a cada cold start de lambda (o flag de módulo `garantido`/`applied` reseta a cada instância serverless):

- `garantirRegioes()` (`src/lib/regioes.ts:43`) — chama `aplicarMigracoes()` (`src/lib/migrations.ts:7`, **ALTER TABLE + CREATE TABLE por request!**), renomeia municípios (2 SELECTs + updates por entrada), 3 upserts, deleteMany, UPDATE em massa de telefones, varredura completa de clientes sem município (`vincularMunicipiosPorNome`) e 11 updateMany (`classificarNaoClientes`). Chamada em: `clientes/page.tsx:25`, `clientes/[id]/page.tsx:16`, `cerebro/page.tsx:9`.
- `garantirColunasFunil()` (`src/lib/actions.ts:1812`) em `negociacoes/page.tsx:11`; `garantirColunasDemanda()` (`src/lib/demandas.ts:27`) em `pipeline/page.tsx:9` e `resumos/page.tsx:10`. Há ainda `garantirFichasVerificadas()` (`src/lib/fichas-verificadas.ts:647`) e `garantirMaquinasNovas()` (`src/lib/maquinas-garantidas.ts:48`) — verifique os call sites com grep.

**Correção:**
1. Criar rota `/api/admin/manutencao` (POST, protegida por login/cookie) que roda TODAS as funções `garantir*` + `aplicarMigracoes()` de uma vez, com relatório do que fez. Botão "Rodar manutenção" em `/configuracoes`.
2. Remover as chamadas `garantir*` de TODAS as páginas. Para segurança na primeira execução, usar um guard barato: chave `manutencao.v1` na tabela `Configuracao` — cada página pesada faz no máximo 1 SELECT (via `React.cache()` por request) e, se ausente, dispara a manutenção uma única vez (com lock: gravar a chave ANTES de rodar, para duas lambdas não rodarem juntas).
3. **`loading.tsx`**: não existe NENHUM no app (60 páginas `force-dynamic` = tela branca durante a espera). Criar `src/app/(app)/loading.tsx` com skeleton genérico (header + blocos pulsando, tema do app) e loading específico para `/dashboard`, `/clientes`, `/negociacoes`, `/atendimento`.
4. Dashboard (`src/app/(app)/dashboard/page.tsx`): revisar as queries — consolidar/paralelizar tudo em `Promise.all`, eliminar queries redundantes.
5. Medir antes/depois: `curl -w "%{time_total}"` nas rotas principais com dev server (2ª chamada, cache quente) e registrar no commit.

## B. Scroll travando (jank)

Em `src/app/globals.css`:
1. **`[class*="overflow-x"] { scroll-snap-type: x mandatory }`** (~linha 131-135) — aplica scroll-snap em TODO container com overflow-x (tabelas, funil, listas). É a principal causa do "travamento" na rolagem. **Remover o seletor `[class*="overflow-x"]`**, mantendo no máximo `.kanban-scroll` — e mesmo nesse, trocar para `x proximity`.
2. `aside { will-change: transform; backface-visibility: hidden }` (~linha 137-141) — remover `will-change` permanente (só custa memória/composite; a animação do menu mobile já usa transition).
3. `html { scroll-behavior: smooth }` — remover (torna todo scroll programático lento/borrachudo).
4. `@media (max-width: 640px) { table { display: block; overflow-x: auto } }` — trocar por wrapper com `overflow-x-auto` nas tabelas que precisam (ou manter, mas testar se não quebra layout das tabelas do financeiro).
5. Testar rolagem em `/clientes` (lista longa), `/negociacoes` (kanban horizontal) e `/financeiro/faturadas` (tabela) em viewport mobile 390×844 via Playwright.

## C. Menu lateral com rolagem independente (desktop)

`src/components/Sidebar.tsx:97` — o `<aside>` desktop é `md:sticky md:top-0 md:min-h-screen` SEM altura máxima nem overflow próprio, então o menu rola junto com a página.

**Correção:** no desktop, `md:h-screen md:max-h-screen md:overflow-hidden` no aside e `overflow-y-auto` no `<nav>` interno (a área de links), mantendo o logo fixo no topo. Conferir que o comportamento mobile (drawer com `touchAction: pan-y`) não muda. Testar: página longa (ex. /clientes) + menu com muitos itens → rolar a página não move o menu; rolar o mouse sobre o menu rola só o menu.

## D. Erro ao abrir a ficha do cliente (clicar no nome → tela de erro)

1. **Suspeito nº 1:** `garantirRegioes()` em `clientes/[id]/page.tsx:16` (item A) — roda DDL e escritas em massa por request; qualquer falha/timeout derruba a página. A correção do item A já remove isso do caminho.
2. **Não existe `error.tsx` nem `global-error.tsx` no app** — qualquer exceção vira a tela de erro crua do Next. Criar `src/app/(app)/error.tsx` (client component com mensagem amigável + botão "Tentar de novo" via `reset()`) e `src/app/global-error.tsx`. Logar o erro no console com contexto (isso alimentará o ZEUS na Fase 4).
3. Depois das correções, reproduzir: abrir fichas de vários clientes (inclusive criados via WhatsApp, sem município, com telefone estranho) e corrigir qualquer erro restante que aparecer.

## E. Financeiro / Negociações Faturadas

1. **"FATURADO EM" editável** — `src/components/FaturadasTable.tsx:98` hoje só exibe `formatDate(n.faturadoEm)`. Trocar por `<input type="date">` que salva via server action. **Reutilizar** a action existente que já grava `faturadoEm` (em `src/lib/actions.ts` ~linha 1991, usada pelo pop-up de data ao arrastar para FATURADO — exportá-la/adaptá-la para receber `(id, dataISO)`), com update otimista no estado local (padrão já usado em `togglePaga`/`mudarMes` no mesmo arquivo). O total/comissão da página deve refletir normalmente.
2. **Faturada sumindo da coluna FATURADO do funil** — `src/components/FunilNegociacoes.tsx:185` filtra a coluna ganha com `c.status === "ganha" && c.estagio === col.titulo`, mas a página Faturadas (`src/app/(app)/financeiro/faturadas/page.tsx:14`) lista TODAS as `status: "ganha"`. Negociações ganhas com `estagio` antigo (ex. criadas antes das colunas dinâmicas, ou via fluxos que não setam `estagio: "FATURADO"`) aparecem no Financeiro mas não no funil. **Correção:** na coluna cujo título contém "faturad", listar TODOS os cards `status === "ganha"` (mesmo padrão da coluna Perdidos, linha 182-183) — as duas telas ficam 100% consistentes. Conferir também `marcarGanha` e `criarNegociacaoCompleta` (actions) para que sempre normalizem `estagio` para o título da coluna FATURADO quando `status` vira "ganha".

## F. Catálogo de máquinas — marcas e modelos ERRADOS

**Portfólio oficial do vendedor (fonte da verdade, fornecida pelo usuário):**
- **New Holland:** B95C, B110C, E145C, E175C, E215C, E245C, E385C, E405C, E485C, E505C, W130B, W170B, W190B, RG140, RG170, RG200, L320, L330, E35D.
- **Dynapac:** manter os modelos já cadastrados no seed.
- CASE, CAT, Komatsu etc. são APENAS concorrentes — nunca aparecem como marca vendida.

**Correções:**
1. `src/components/FunilNegociacoes.tsx:697-701` — a constante `MARCAS` hardcoded contém CASE como marca vendável e modelos NH errados (E115C, E135B, W130C, W80C, RG140B). **Remover a lista hardcoded**; o modal "Nova Negociação" deve receber por props as máquinas próprias do banco (`db.maquina.findMany({ where: { proprio: true } })`, passado por `negociacoes/page.tsx`), agrupadas por marca → dropdown Marca mostra só New Holland e Dynapac; dropdown Máquina filtra pelos modelos da marca. Manter opção "Outro" com campo livre.
2. `src/lib/seed-core.ts` — harmonizar o catálogo próprio com o portfólio oficial: adicionar os modelos que faltam (E385C, E405C, E485C, E505C, W170B, W190B, RG170, RG200 — conferir um a um) como `proprio: true`, com categoria correta; padronizar nomenclatura (hoje há "E145C EVO", "E215C EVO" — usar o nome do portfólio "E145C" etc., mantendo "EVO" só se o usuário usar; preferir o nome curto). Remover do seed qualquer NH `proprio: true` fora da lista.
3. **Script one-shot** `scripts/corrigir-catalogo.ts` (padrão do `scripts/dedupe-whatsapp-conversations.ts`: dry-run + `--apply`): no banco, (a) renomear/mesclar os modelos próprios para a nomenclatura oficial; (b) marcar `proprio: false` (ou deletar, se sem vínculos) máquinas NH fora do portfólio; (c) garantir os modelos oficiais faltantes. NUNCA apagar concorrentes.
4. `src/app/api/cerebro/route.ts:314` — o system prompt do Cérebro lista um portfólio ERRADO ("E50, E60, E80, E115C… W80C, W130C… B115C"). Substituir pela lista oficial acima (idealmente gerada do banco: máquinas `proprio: true`, para nunca mais divergir).
5. Grep final por `E115C|E135B|W80C|W130C|B115C` em `src/` para eliminar qualquer outra ocorrência (exceto como modelo de CONCORRENTE, ex. na linha da CASE, que também deve sair da lista de marcas vendáveis).

## G. Fichas técnicas — arquivos PDF/imagem/texto que "às vezes não são lidos"

**Causa raiz diagnosticada:** `next.config.mjs` NÃO configura `serverActions.bodySizeLimit`, e o padrão do Next 14 é **1MB**. A action `extrairFichaDeArquivo` (`src/lib/actions.ts:641+`) promete "PDF até 32MB", mas qualquer upload acima de ~1MB é rejeitado pelo framework ANTES do código rodar → erro genérico. Arquivos pequenos funcionam, grandes não — exatamente o "às vezes" relatado.

**Correções:**
1. `next.config.mjs`: adicionar `experimental: { serverActions: { bodySizeLimit: "10mb" } }`.
2. Validação no CLIENT (`src/components/FichasTecnicasClient.tsx`): antes de enviar, checar tamanho e avisar com mensagem clara ("Arquivo de X MB — o limite é Y MB; comprima o PDF ou envie por partes"). Limite prático na Vercel: ~4.5MB por request — usar 4MB como teto de UI e ajustar os textos da action (que hoje falam 32MB).
3. PDF/imagem exigem `ANTHROPIC_API_KEY` (`src/lib/ai/index.ts:362` retorna erro claro) — garantir que essa mensagem chegue VISÍVEL na UI do FichasTecnicasClient (hoje conferir se o erro da action é exibido; se não, exibir em destaque).
4. Testar: enviar TXT pequeno, PDF < 1MB, PDF 3MB, imagem 2MB (com dev server local; sem chave Anthropic deve dar a mensagem clara de chave ausente para PDF/imagem, e sucesso heurístico/Groq para texto).

## H. Excluir "Super Trunfo"

Remover completamente:
- `src/app/(app)/super-trunfo/page.tsx` (e a pasta), `src/components/SuperTrunfoClient.tsx`.
- Entrada no menu: `src/lib/menu.ts` (item `{ href: "/super-trunfo", label: "Super Trunfo", icon: Trophy }`).
- Actions/funções usadas SÓ por ele: `gerarAnaliseCategoriaIAAction` (`src/lib/actions.ts:~690`) e `gerarAnaliseCategoriaIA` (`src/lib/ai/index.ts`) — confirmar com grep que nada mais usa antes de remover.
- Grep final por `super-trunfo|SuperTrunfo|Trofeu|Trophy` para links órfãos (o ícone Trophy pode ser usado em outro lugar — só remover o import se ficar sem uso).

## I. Excluir seção "Conversas + IA"

- Remover `src/app/(app)/conversas/` (page) e `src/components/ConversaAnaliser.tsx`; remover a entrada `{ href: "/conversas", label: "Conversas + IA" }` de `src/lib/menu.ts`.
- **Escopo: só a UI.** Os modelos `Conversa`/`AnaliseIA` e seus dados ficam no banco — a Fase 2 do PROJETO ZEUS trata da migração do legado. Se a Fase 2 já tiver removido/migrado, apenas confirmar que nenhum link aponta mais para `/conversas` (grep).

## J. Comparativo 2.0 — reformulação completa

Estado atual: `src/app/(app)/comparativo/page.tsx` seleciona máquina só por `searchParams.modelo/maquina`, concorrentes vêm automáticos por categoria/peso (`concorrentesSimilares` em `src/lib/comparativo.ts`), e `src/components/ComparativoIA.tsx` tem o botão "Gerar argumentos com IA" (battlecards). Existe também `ComparativoCombustivel.tsx` (manter — o usuário gosta).

**Requisitos do usuário:**
1. **Seleção Marca → Modelo (minha máquina):** primeiro dropdown com New Holland/Dynapac (só `proprio: true`), segundo dropdown filtrado pelos modelos da marca. Ao selecionar, carrega os dados da máquina (como hoje).
2. **Concorrente:** manter a sugestão automática por categoria/faixa de peso como estado inicial ("tá ótimo dessa forma"), MAS adicionar seletor manual Marca → Modelo com TODOS os concorrentes cadastrados, para comparar com qualquer um. Permitir **múltiplos concorrentes selecionados** ao mesmo tempo.
3. **Resumo de diferenciais COM benefício:** abaixo da tabela, um bloco gerado por IA (usar `MODEL_TAREFA` de `src/lib/ai/config.ts`) que para cada diferencial explique o BENEFÍCIO prático e a melhor aplicação — ex.: "tanque maior → mais horas de trabalho sem parada para reabastecer"; "E145C com opções de braço 2,5m e 3,0m → mais alcance e capacidade de escavação em X aplicações". Alimentar o prompt com `especificacoes/pontosFortes/diferenciais/argumentos` das máquinas + as Notas do item 4. Nunca inventar specs — só usar o que está no banco/notas.
4. **Notas de conhecimento do vendedor (`NotaMaquina`):** novo modelo Prisma:
   ```prisma
   model NotaMaquina {
     id            String   @id @default(cuid())
     maquina       Maquina  @relation(fields: [maquinaId], references: [id], onDelete: Cascade)
     maquinaId     String
     concorrenteId String?  // opcional: nota específica contra um concorrente
     texto         String
     criadoEm      DateTime @default(now())
     @@index([maquinaId])
   }
   ```
   Na tela do Comparativo: seção "Meu conhecimento" com seletor da minha máquina (marca→modelo) e, opcional, do concorrente (marca→modelo), + textarea para registrar observações (ex.: "CAT 316 consome 4L/h a mais que minha E145C e a manutenção é ~10% mais cara"). Listar/editar/excluir notas existentes. **Consumo das notas:** (a) no bloco de diferenciais do item 3; (b) no comparativo completo do item 5; (c) no contexto do Cérebro — incluir as notas da(s) máquina(s) de interesse do cliente no prompt de `src/app/api/cerebro/despacho-rapido/route.ts` e `agnes-dispatch`, e no system prompt do chat `/api/cerebro` (resumo das notas); deixar preparado para virar tool na Fase 3.
5. **"Gerar comparativo completo" (evolução do "Gerar argumentos com IA"):** novo botão que gera um comparativo profissional multi-concorrente: cabeçalho com a minha máquina (com `imagemUrl` do banco quando existir — `<img>`; não gerar imagem por IA), tabela de specs, pontos fortes COM benefício, respostas às objeções prováveis, e conclusão "por que New Holland/Dynapac é a melhor compra". Deve aceitar os múltiplos concorrentes selecionados. Botão de imprimir/PDF (usar `@media print` que já existe no globals.css). Manter o botão de battlecards existente como opção rápida.

## Verificação (obrigatória, no padrão da Fase 6)

1. `npx tsc --noEmit` + `npm run lint` + `npm run build` limpos.
2. Local com Postgres de teste: navegar por TODAS as páginas alteradas (dashboard, clientes, ficha do cliente, negociações, financeiro/faturadas, comparativo, fichas técnicas, configurações) — sem erros no console do server.
3. Playwright viewport 390×844 e desktop 1280×800: screenshots do menu com rolagem independente, do funil com card faturado visível, do comparativo novo (marca→modelo), do modal Nova Negociação (sem CASE, modelos oficiais).
4. Medir tempo de resposta (curl, 2ª chamada) de /clientes, /clientes/[id], /negociacoes ANTES e DEPOIS da correção A — registrar os números no commit/PR.
5. Editar "FATURADO EM" na tabela de faturadas e conferir que o funil e os totais refletem.
6. Testar upload de fichas: TXT pequeno, PDF >1MB (deve funcionar com o novo bodySizeLimit), arquivo acima do teto (mensagem clara).
7. Rodar `scripts/corrigir-catalogo.ts` em dry-run no banco local e conferir a saída antes do `--apply`.
8. Ao final: atualizar o "Estado de execução" deste arquivo, commit + push; lembrar o usuário do `prisma db push` de produção (Passo 0.2) e do redeploy.
