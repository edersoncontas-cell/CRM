# e2e do mapa por região

Prova do mapa (Visitas e Dashboard) **na tela**, contra o build de produção, no PC (1440) e no celular (390), nos dois
temas. Os testes de unidade (`tests/mapa-regioes-es.test.ts`, `tests/mapa-rotulos-es.test.ts`) travam a conta e o código;
este roteiro prova o que só o navegador mostra (CSS que vence o do Leaflet, dica cortada na borda, toque no celular,
cor por baixo da cidade, pins e botões por cima dos nomes).

Não roda no `npm test` (precisa de navegador, banco e build). Rodar à mão antes de mexer no mapa e depois.

## Como rodar

1. Um Postgres de teste descartável (**nunca** o de produção), com o CRM criado nele (o próprio CRM cria a estrutura
   num banco vazio — `lib/banco-do-zero.ts` — na primeira requisição).
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
   de saída no ambiente de desenvolvimento): `node scripts/e2e-mapa/gerar-tile.cjs`.
5. `E2E_SENHA=<o APP_PASSWORD acima> E2E_BANCO=<nome do banco de teste, ex. crmtest> node scripts/e2e-mapa/mapa-e2e.cjs`

Variáveis: `E2E_SENHA` e `E2E_BANCO` são obrigatórias. `E2E_BANCO` é uma trava: o roteiro grava e apaga dados e só
começa se `SELECT current_database()` devolver exatamente esse nome. Opcionais: `E2E_BASE` (padrão
`http://localhost:3210`), `E2E_OUT` (azulejo e fotos; padrão `/tmp/mapa-e2e/`), `CHROMIUM`, `E2E_PSQL` (comando que lê
SQL no stdin e **precisa** de `-v ON_ERROR_STOP=1`; padrão
`su postgres -c "psql -p 5433 -d crmgoogle -At -v ON_ERROR_STOP=1"`), `SO=pc/escuro` (roda uma combinação só:
`pc|cel` / `escuro|claro`; o estado "nenhuma cidade atendida" não roda nesse modo).

O código de saída é 0 só quando TODAS as conferências passam (inclusive com `SO`); 1 se alguma falhou ou se o roteiro
quebrou no meio; 2 se faltou variável ou o banco não é o de teste.

## O que ele grava no banco de teste (e devolve)

- **Antes de tudo** guarda a lista de cidades atendidas (`Configuracao.area.atuacao`) e quais municípios estão "na
  área"; **no fim** (bloco `finally`, também quando o roteiro quebra, e no Ctrl-C) devolve os dois.
- Roda `mapa-seed.sql` **a cada execução** (as visitas são de HOJE, no fuso de Brasília — um seed de ontem deixa a tela
  sem pin e a conferência "nome fora de pin" passaria vazia): cria os próprios clientes (`tmapa-c1…`), seis visitas de
  hoje e nove vendas. Esses dados **ficam** no banco de teste (prefixo `tmapa`, podem ser apagados), e os municípios
  que já existiam ganham coordenada.
- Para o caso "nenhuma cidade atendida" apaga a lista e marca todos os municípios como fora da área — e devolve.

## O que confere

- 78 municípios; atendidas coloridas, as outras `#555c68`; preenchimento opaco; divisa preta; contorno grosso do estado;
  legenda.
- **Há pins** das visitas de hoje, **trajeto** tracejado, **cifrões** no Dashboard e botões do mapa na tela — senão as
  conferências "fora de pin/cifrão/botão" passariam vazias, e o roteiro reclama.
- Nomes: dentro da própria cidade (ponto a ponto), fora de pin/cifrão e **dos botões do mapa** (o retângulo do nome não
  cruza o de nenhum `.leaflet-control`), letra de 10 px ou mais, `display:flex`, caixa = a medida (a altura de linha é a
  que o CSS declara; a caixa é o texto + 2 × 2 px); aproximar **acrescenta** nomes (que nenhum some quem prova é o teste
  de unidade).
- Dica: diz região e "você atende"; cabe INTEIRA no mapa tocando/passando nas cinco bordas; no celular **fica aberta**
  até tocar em outra cidade (troca, nunca duas); afastar o mapa ou clicar no mapa vazio a fecha; o realce sobrevive à
  atualização do mapa.
- A base não aparece por baixo da cor (com um controle que prova que a medida enxerga a textura se ela voltar).
- Nenhuma cidade atendida: legenda avisa, tudo cinza escuro, nome branco.

Cada conferência roda nas **quatro** combinações (PC e celular × claro e escuro), inclusive "aproximar" (dica nas
bordas, nomes depois do zoom, toque).

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
