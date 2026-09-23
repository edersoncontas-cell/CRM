# As 3 perguntas — o padrão de toda alteração

Registro do padrão que o vendedor definiu depois de me ver dizer "é culpa
minha" várias vezes na mesma semana: **toda alteração no CRM passa por três
perguntas, e a resposta delas aparece na tela para ele conferir.**

A parte que faz isso funcionar é a segunda: **a resposta é VISÍVEL**. Regra que
só existe na minha cabeça não dá para cobrar — se ele não vê, nem ele nem eu
sabemos se foi feita. É o mesmo motivo pelo qual a regra de conferir no PC e no
celular funciona: ela produz print.

---

## Pergunta 1 — "O que mais depende disso?" (ANTES de mexer)

A que pega a falha que mais se repetiu aqui e que derrubou o WhatsApp dele.

**Como responder:** `grep` pelo nome do que vai mudar, pelos irmãos dele
(os outros valores do mesmo conjunto) e por quem lê aquele campo. Listar o que
achou. Se a lista tiver mais de um item, **consertar todos no mesmo commit** —
metade consertada é pior que nada, porque parece resolvido.

**Não vale responder "nada depende" sem ter procurado.** O `grep` é a prova.

Casos que existiriam se esta pergunta tivesse sido feita:
- criei o estado `"enviando"` e não procurei quem decidia por `"pendente"` —
  o cancelamento e a faxina de anexos ficaram para trás, e o número caiu;
- tirei a coluna VENDA PERDIDA do quadro sem procurar quem dependia dela —
  sumiu o único jeito de marcar uma venda como perdida.

## Pergunta 2 — "O que acontece quando dá errado?" (DEPOIS de construir)

Conferir que funciona é metade do trabalho.

**Como responder:** percorrer os quatro estados de toda tela nova —
**carregando, vazio, erro e sucesso** — e dizer o que ela faz em cada um.
Quando falhar, a tela precisa DIZER que falhou. Sumir em silêncio é o pior
desfecho possível: ele não vê botão, não vê erro, e conclui que o CRM não tem
aquilo — sem ter como nem reclamar do que não aparece.

Para trava e regra de segurança, some uma pergunta: **o que acontece quando
falta configuração ou o banco não responde?** A resposta certa é sempre a menos
danosa (pausado, não enviando), e ela precisa de teste.

## Pergunta 3 — "O que você não conseguiu conferir?" (NO FIM)

Não existe rede de saída neste ambiente: não dá para testar Google, PNCP,
Evolution, provedor de IA de verdade nem Safari (o celular dele é iPhone).

**Como responder:** separar, em uma linha, o que passou pela tela do que ficou
suposto. Quando a verificação de verdade não for possível, construir um
substituto — provedor falso local, dado simulado — e **dizer que foi
substituto**. Nunca apresentar como conferido o que não foi.

---

## As três TRAZEM A SOLUÇÃO

Regra que o vendedor acrescentou depois de ver a primeira entrega no padrão
novo: **identificar não basta — o que dá para resolver, resolve.**

- Pergunta 1 achou dependência quebrada → conserta no mesmo commit.
- Pergunta 2 achou caminho ruim que falha em silêncio → põe o aviso na tela.
- Pergunta 3 não conseguiu conferir → constrói o substituto (provedor falso
  local, dado simulado) ou deixa na TELA o número que responde a dúvida, em
  vez de devolver a pergunta para ele.

Vira pendência só o que depende de decisão dele ou de acesso que eu não tenho
(o banco de produção, o Safari do iPhone dele, a rede de saída). E, mesmo aí,
a entrega diz o que foi feito para cobrir — não só o que faltou.

**Exemplo do que NÃO fazer:** "não conferi o seu banco". **O que fazer:** "não
alcanço o seu banco daqui, então a tela mostra a contagem antes de você
clicar — é ela que diz a verdade sobre os seus dados".

---

## O bloco que fecha toda entrega

Vai no fim da resposta, curto, sempre nesta ordem. Ele lê no celular, na rua:

```
Conferência
· Depende disso: <o que o grep achou> — todos no mesmo commit
· Quando dá errado: <o que a tela faz>
· Não conferi: <o que ficou de fora> — e o que foi feito para cobrir
```

Quando a alteração for pequena demais para ter o que dizer, o bloco continua —
com "nada mais depende", "não tem tela" ou "nada ficou de fora". **O bloco
nunca some.** É a ausência dele que denuncia que o padrão não rodou.

## Quando NÃO se aplica

Pergunta, explicação, leitura de código, conversa. O padrão é para **alteração
que vai para o repositório**. Encher resposta de checklist onde não houve
mudança nenhuma só ensina os dois a ignorar o bloco.

## Como ele cobra

Se a resposta vier sem o bloco, é só dizer **"cadê as 3 perguntas?"**. E se o
bloco vier com "nada mais depende" numa mudança grande, vale desconfiar e pedir
o `grep`.
