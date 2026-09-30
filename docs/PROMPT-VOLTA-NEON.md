# Prompt para a extensão do Chrome — volta do CRM para o Neon

**Quando usar:** no dia em que o Neon voltar (o painel do Neon diz a data; deve ser
por volta de 01/10). Antes disso, não adianta: o banco dele ainda estará suspenso.

**Depois que a extensão terminar:** abra o CRM → Configurações → "Trazer os dados do
banco provisório" → "Ver o que vai ser trazido" → confira → "Trazer". Faça no mesmo
dia: parado, o banco provisório (Supabase) pausa depois de uma semana.

Cole o texto abaixo da linha na extensão.

---

Preciso trocar o banco de dados do meu CRM na Vercel de volta para o Neon. Siga os
passos na ordem. Regras que valem o tempo todo:

- NUNCA escreva nesta conversa nenhum endereço de banco, senha ou valor de variável.
  Copie e cole entre as abas sem mostrar. Se precisar se referir a um, diga só o nome
  da variável.
- NÃO apague nenhuma variável, projeto, banco ou deploy. Só crie e edite o que está
  descrito abaixo.
- NÃO mude plano, não adicione cartão, não aceite cobrança, não clique em "Upgrade".
- Se alguma tela for diferente do que está descrito, pare e me diga o que está vendo.

**Passo 1 — O Neon voltou?**
Abra https://console.neon.tech, entre no projeto do CRM e veja se ele está ativo. Se
ainda aparecer suspenso, limite de uso ou data de liberação no futuro, PARE e me diga
a data que aparece. Não siga adiante.

**Passo 2 — Guardar os endereços do banco provisório.**
Na Vercel, abra o projeto do CRM → Settings → Environment Variables.
- Crie uma variável nova chamada `DATABASE_URL_PROVISORIO`, marcada para Production e
  Preview, com EXATAMENTE o mesmo valor que está hoje em `DATABASE_URL` (copie o valor
  atual de `DATABASE_URL` e cole na nova).
- Crie outra chamada `DATABASE_URL_UNPOOLED_PROVISORIO`, também Production e Preview,
  com EXATAMENTE o mesmo valor que está hoje em `DATABASE_URL_UNPOOLED`. Ela serve só
  para poder desfazer a troca (Passo 6).
Salve as duas.

**Passo 3 — Pôr o Neon de volta.**
No console do Neon, no projeto do CRM, abra "Connect" (ou "Connection details").
- Copie a string de conexão com pooling ligado ("Pooled connection") e cole como novo
  valor de `DATABASE_URL` na Vercel (editar, não apagar e criar de novo).
- Desligue o pooling, copie a string direta e cole como novo valor de
  `DATABASE_URL_UNPOOLED` na Vercel.
Salve as duas.

**Passo 4 — Publicar.**
Na Vercel, vá em Deployments e ache o deploy de PRODUÇÃO mais recente com status
"Ready". A mensagem do commit dele deve ser uma destas:
"Prompt da volta para o Neon: conferir a versão e poder desfazer" ou
"Volta para o Neon: a 1ª tela não cai se faltar coluna lá".
Se for outra, PARE e me diga qual é (a versão nova do CRM não está no ar).
Sendo uma delas, abra esse deploy, clique em "Redeploy" e espere ficar "Ready".

**Passo 5 — Conferir.**
Abra o CRM no endereço de sempre, faça login e depois abra `/api/diag` no mesmo
endereço. Me diga, copiando da tela:
- a linha que começa com "principal:" (deve dizer "principal: Neon · provisório: Supabase");
- a linha "conectar no provisório";
- a linha "LER: contar clientes";
- a linha "conectar e responder (SELECT 1)";
- a linha "estrutura: o que o código pede e o banco não tem".
Essas linhas não têm senha. Não clique em "Trazer" em Configurações — isso eu faço.

**Passo 6 — Só se deu errado: desfazer.**
Se no Passo 5 a linha "conectar e responder (SELECT 1)" disser FALHOU, ou se o CRM
abrir uma tela dizendo que o banco está fora do ar:
- na Vercel, ponha em `DATABASE_URL` o mesmo valor de `DATABASE_URL_PROVISORIO`, e em
  `DATABASE_URL_UNPOOLED` o mesmo valor de `DATABASE_URL_UNPOOLED_PROVISORIO`; salve;
- faça "Redeploy" do deploy de produção mais recente de novo e espere "Ready";
- abra `/api/diag` e me diga a linha "conectar e responder (SELECT 1)" (deve dizer
  [ok]) e, copiada da primeira tentativa, a mensagem de erro que apareceu.
Não apague nenhuma variável, nem as duas `_PROVISORIO`.
