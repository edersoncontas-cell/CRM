# e2e do mapa por região

Prova do mapa (Visitas e Dashboard) **na tela**, contra o build de produção, no PC (1440) e no celular (390), nos dois
temas. Os testes de unidade (`tests/mapa-regioes-es.test.ts`, `tests/mapa-rotulos-es.test.ts`) travam a conta e o código;
este roteiro prova o que só o navegador mostra (CSS que vence o do Leaflet, dica cortada na borda, toque no celular,
cor por baixo da cidade, pins e botões por cima dos nomes).

Não roda no `npm test` (precisa de navegador, banco e build). Rodar à mão antes de mexer no mapa e depois.

## Como rodar

1. Um Postgres de teste descartável (**nunca** o de produção). Num banco vazio o próprio CRM cria a estrutura
   (`lib/banco-do-zero.ts`) na primeira requisição que passa pelo layout do app (entrar + abrir uma tela); o roteiro
   faz isso sozinho antes de mexer no banco (entra e abre `/dashboard`), então basta o banco existir.
2. Build e servidor, com as variáveis que o CRM exige em produção (sem `APP_PASSWORD` o app bloqueia tudo e o login do
   roteiro falha; `DATABASE_URL_UNPOOLED` o `prisma generate` exige):
   ```bash
   export DATABASE_URL="postgresql://postgres@localhost:5433/crmtest" DATABASE_URL_UNPOOLED="$DATABASE_URL" \
          APP_PASSWORD=teste123 AUTH_SECRET=uma-coisa-longa-qualquer CRON_SECRET=outra-coisa
   npm run build && npx next start -p 3210
   ```
   Libere a porta com `fuser -k -n tcp 3210` — nunca `pkill -f`.
3. O Playwright **não** está no `package.json`: é preciso ter o pacote `playwright` instalável por `require` (neste
   ambiente de desenvolvimento ele já vem; em outro, `npm i --no-save playwright` ou `NODE_PATH=<onde ele está>`) e um
   Chromium (`CHROMIUM=<caminho do executável>`).
4. O azulejo falso (ruas, rios e nomes de cidade — para provar que a base não aparece por baixo da cor; não existe rede
   de saída no ambiente de desenvolvimento): `node scripts/e2e-mapa/gerar-tile.cjs` (com o mesmo `E2E_OUT` do passo 5,
   se não for o padrão; sem o azulejo o roteiro para com essa dica, saída 2).
5. Rodar (o `E2E_PSQL` tem de apontar para o MESMO banco de `E2E_BANCO`; o padrão aponta para o banco do autor,
   `crmgoogle`, e quem usar outro nome cai na trava, saída 2):
   ```bash
   E2E_SENHA=teste123 E2E_BANCO=crmtest E2E_OUT=/tmp/mapa-e2e \
   E2E_PSQL='psql "postgresql://postgres@localhost:5433/crmtest" -At -v ON_ERROR_STOP=1' \
   node scripts/e2e-mapa/mapa-e2e.cjs
   ```

Variáveis: `E2E_SENHA` e `E2E_BANCO` são obrigatórias. `E2E_BANCO` é uma trava: o roteiro grava e apaga dados e só
começa se `SELECT current_database()` devolver exatamente esse nome. Opcionais: `E2E_BASE` (padrão
`http://localhost:3210`), `E2E_OUT` (azulejo e fotos; padrão `/tmp/mapa-e2e`, com ou sem `/` no fim), `CHROMIUM`, `E2E_PSQL` (comando que lê
SQL no stdin e **precisa** de `-v ON_ERROR_STOP=1`; padrão
`su postgres -c "psql -p 5433 -d crmgoogle -At -v ON_ERROR_STOP=1"`), `SO=pc/escuro` (roda uma combinação só:
`pc|cel` / `escuro|claro`; o estado "nenhuma cidade atendida" não roda nesse modo).

O código de saída é 0 só quando TODAS as conferências passam (inclusive com `SO`); 1 se alguma falhou ou se o roteiro
quebrou no meio; 2 se faltou variável ou o banco não é o de teste.

## O que ele grava no banco de teste (e o que devolve)

- **Antes de tudo** guarda a lista de cidades atendidas (`Configuracao.area.atuacao`) e quais municípios estão "na
  área" — e grava essa cópia no próprio banco (`Configuracao` chave `e2e.mapa.original`). **No fim** (bloco `finally`,
  também quando o roteiro quebra, no Ctrl-C e no SIGTERM) devolve os dois e apaga a cópia. Se o roteiro morrer à
  força (`kill -9`), a próxima execução acha a cópia, devolve o estado verdadeiro e só então começa — não trata o
  estado sujo como se fosse o original.
- Roda `mapa-seed.sql` **a cada execução**: cria os próprios clientes (`tmapa-c1…`), seis visitas e nove vendas.
  **Isto NÃO é devolvido:** esses dados `tmapa*` ficam no banco de teste (podem ser apagados com
  `DELETE … WHERE id LIKE 'tmapa%'`, na ordem Negociacao, Visita, Cliente), e os municípios do seed que ainda
  não existiam ficam criados. Os municípios que já existiam mantêm a coordenada que tinham (só ganha uma se estava
  vazia) e a marca "na área" volta ao que era.
- As visitas ficam no dia que a tela de Visitas abre: **hoje** (Brasília) em dia útil; **sábado e domingo** a tela
  mostra a segunda-feira da semana, então elas vão nela. Ficam **realizadas** de propósito: visita agendada depois
  do horário abre o lembrete "Visita feita?" (z-index 150), que cobre o mapa inteiro em dia útil; o roteiro fecha o
  lembrete se ele aparecer e **para** se não fechar. Realizada ainda vira pin e trajeto.
- Para o caso "nenhuma cidade atendida" apaga a lista e marca todos os municípios como fora da área — e devolve.

## O que confere

- 78 municípios; atendidas coloridas, as outras `#555c68`; preenchimento opaco; divisa preta; contorno grosso do estado;
  legenda.
- **Há pins** das visitas de hoje, **trajeto** tracejado, **cifrões** no Dashboard e botões do mapa na tela — senão as
  conferências "fora de pin/cifrão/botão" passariam vazias, e o roteiro reclama.
- **O que a tela PINTA** (não só o DOM): ordem das camadas lida do navegador (estado < cidades < nomes), opacidade
  das camadas, o ESTILO CALCULADO da divisa (preto, opaco, visível — um CSS por cima do atributo SVG também conta) e,
  **nos pixels**, que todo nome à vista tem tinta (≥ 4% dos pixels da caixa diferem da cor da cidade; o que menos tem
  fica perto de 28%) — com um controle que põe os nomes por baixo das cidades e exige que a mesma medida os veja sumir.
- Nomes: dentro da própria cidade (ponto a ponto), fora de pin/cifrão e **dos botões do mapa** (o retângulo do nome não
  cruza o de nenhum `.leaflet-control`), letra de 10 px ou mais, `display:flex`, caixa = a medida (a altura de linha é a
  que o CSS declara; a caixa é o texto + 2 × 2 px); aproximar **acrescenta** nomes (que nenhum some quem prova é o teste
  de unidade).
- Dica: diz região e "você atende"; cabe INTEIRA no mapa tocando/passando no topo, nas laterais e nos dois cantos de
  cima; **não cai embaixo do +/− nem dos créditos**; a **seta aponta para o dedo** (até 3 px, ou presa na ponta da dica);
  no celular **fica aberta** até tocar em outra cidade (troca, nunca duas); afastar o mapa ou clicar no mapa vazio a
  fecha; o realce sobrevive à atualização do mapa. Num celular de **320 px** o Dashboard (mapa de ~254 px, sem nome
  nenhum escrito) roda só a parte da dica.
- A base não aparece por baixo da cor (com um controle que prova que a medida enxerga a textura se ela voltar).
- Nenhuma cidade atendida: legenda avisa, tudo cinza escuro, nome branco.

As conferências de visual rodam nas **quatro** combinações (PC e celular × claro e escuro), inclusive "aproximar" (dica
nas bordas, nomes depois do zoom); as de **toque/hover** só no celular (10 a mais: 74 contra 64 no PC por combinação);
o estado "nenhuma cidade atendida" só em PC/escuro (3) e o celular de 320 px só no escuro (a parte da dica). Total
atual: 414 conferências.

## Armadilha do próprio roteiro

O ponteiro do Playwright fica parado onde esteve. Se estiver sobre uma cidade quando a página abre, o realce
(`bringToFront`) reordena o DOM antes de o roteiro numerar os caminhos (`data-i`) e o índice aponta para a cidade errada
("Domingos Martins cai em Vitória"). O roteiro tira o ponteiro da tela antes de abrir cada mapa.

## O toque emulado não é o toque do aparelho

No Chromium em modo celular, `touchscreen.tap` no mapa vazio **aproxima 1 nível** (o Leaflet recebe o toque como
ponteiro + toque + mouse no mesmo instante) — igual no build anterior à correção da dica, ou seja, não vem do CRM. Com
o ponteiro parado, a cidade que cai embaixo dele abre a dica dela. Por isso "fechar a dica no vazio" é conferido com
**clique de mouse**, e o toque tem a própria conferência (tocar numa cidade, tocar em outra, afastar o mapa). Num
celular de verdade nada disso foi visto.
