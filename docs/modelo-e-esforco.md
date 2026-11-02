# Modelo e esforço — por que a tabela do CLAUDE.md é assim

A regra (item 00 do `CLAUDE.md`) manda dizer, antes de toda tarefa, qual modelo
e qual esforço usar. Este arquivo explica o raciocínio e como gastar menos.

## O critério: o pior erro possível, não o tamanho da mudança

Duas linhas em `lib/whatsapp-pausa.ts` custam mais caro de errar do que uma tela
inteira nova. Os erros deste CRM que custaram de verdade:

| Falha que já aconteceu | Área | Por isso |
|---|---|---|
| Número do WhatsApp bloqueado por 24 h (cancelamento olhava só `pendente`) | envio | Opus · high |
| CRM um dia fora do ar (coluna nova no schema, banco velho) | schema/migração | Opus · high |
| Cota do Neon esgotada, CRM uma semana fora (manutenção em loop) | manutenção/db | Opus · high |
| Risco de fatura de IA paga sem ele saber | trava de gasto | Opus · high |
| Cópia offline velha / worker que impede gravar | sem sinal | Opus · high |

Tela, texto e CSS que não tocam nisso falham de forma visível e barata de
desfazer: Sonnet (ou Haiku para texto) basta, e a bateria + a conferência no
PC e no celular pegam o resto.

## Esforço

- `low`: ler, responder, listar. Sem escrita no repositório.
- `medium`: escrever código comum, com a bateria como rede.
- `high`: vários arquivos, ou área de risco da tabela.
- `xhigh`: só decisão arquitetural em área de risco.
- `max`: só se ele pedir. É o nível que mais consome e raramente muda o
  resultado em tarefa que já cabe em `xhigh`.

## Como gastar menos, sem perder segurança

1. **Um pedido, um assunto.** Pedido misto obriga a pagar o modelo caro para a
   parte barata.
2. **Pergunta antes de mexer não precisa de modelo caro.** Ler e diagnosticar em
   Sonnet · low; só a escrita em área de risco sobe de degrau.
3. **Sem `Workflow`/agentes em paralelo por conta própria.** Cada agente repete o
   contexto inteiro. Só quando ele pedir ("use a melhoria 10x", revisão
   independente).
4. **Sessão longa é mais cara por mensagem.** Terminada uma entrega, abrir
   sessão nova para o próximo assunto custa menos que continuar na mesma.
5. **Não reler o que já foi lido.** O resumo da sessão e `docs/CONTINUAR.md`
   existem para isso.

## O que isto NÃO é

Não há tabela de preços verificada neste repositório; as comparações são de
ordem (mais barato / mais caro), não de valor. Troca de modelo e de esforço é
feita por ele na sessão (`/model`, `/effort`): eu recomendo, não consigo trocar.
