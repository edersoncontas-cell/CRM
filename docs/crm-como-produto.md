# Transformar o CRM em produto — o que muda, o que custa e o que arrisca

Relatório pedido pelo vendedor: vender o CRM na internet como ferramenta
potencializadora de vendas, com login para vendedor, gerente e diretoria,
várias empresas, domínio personalizado e um painel de gestão central.

A pergunta que manda em tudo: **isso cabe no CRM 100% gratuito?**

---

## Resposta curta

**Para você sozinho, sim. Para vender como produto, não.**

Não é limitação de código — é regra de uso dos serviços gratuitos que
sustentam o CRM hoje. Três deles proíbem ou inviabilizam uso comercial nessa
escala:

| Serviço | Papel hoje | O que trava na venda |
|---|---|---|
| Vercel Hobby | hospeda o CRM | O plano gratuito é para uso **não comercial**. Vender acesso é uso comercial: precisa do plano pago. |
| Neon Free | banco de dados | Um projeto, com horas de computação e armazenamento limitados. Dez empresas ativas já apertam; cem, não cabe. |
| Evolution API | WhatsApp | **Cada vendedor precisa de uma instância** ligada ao celular dele. Uma instância consome memória do servidor o tempo todo. Um servidor grátis aguenta poucas. |
| Gemini / Groq (camada grátis) | IA | Os limites são por chave e por minuto. Com muitas empresas, a chave estoura e todo mundo para junto. |

Ou seja: a arquitetura aguenta; a conta gratuita não.

---

## O que dá para fazer AGORA, de graça, sem quebrar nada

Estas partes não adicionam custo de infraestrutura, porque continuam rodando
na sua instância, para a sua empresa:

1. **Usuários de verdade dentro do seu CRM** (hoje é uma senha única).
   Tabela de usuários, login por pessoa, senha temporária na primeira entrada
   com troca obrigatória.
2. **Papéis: vendedor, gestor e dono do sistema.** O gestor entra e só lê.
3. **Visão do gestor** com o que você listou e sem o que é sensível:
   - Dashboard, calendário e mapa de visitas
   - Leads novos por semana, negociações por etapa
   - Cidades que mais procuram, cidades que mais compram, modelos mais
     vendidos, como o mercado está reagindo
   - **Não aparece**: nome e telefone de cliente, valor por negociação,
     comissão, conversa de WhatsApp, proposta.
4. **Você escolhe o que cada um vê.** Financeiro oculto para o gestor,
   WhatsApp oculto para a diretoria, e assim por diante — a mesma mecânica de
   visibilidade de menu que já existe, agora por usuário e no servidor.
5. **Registro de quem fez o quê** (a Auditoria já existe; passa a gravar o
   usuário).

Custo disso: zero. Risco: baixo. É a fase que eu implemento assim que você
mandar.

---

## O que só faz sentido com receita

| Recurso pedido | Por que custa | Ordem de grandeza |
|---|---|---|
| Várias empresas no mesmo CRM | Isolamento de dados por empresa, banco maior, backup | Banco gerenciado pago |
| Domínio personalizado por empresa | Domínio + certificado + roteamento | Plano pago de hospedagem |
| WhatsApp próprio de cada vendedor | Uma instância Evolution por número, rodando 24h | Servidor por faixa de usuários |
| IA para todos | Chave paga ou cota por empresa | Por uso |
| Suporte e disponibilidade | Alguém responde quando cai | Seu tempo ou de outra pessoa |

Números exatos mudam com frequência; antes de decidir, confira no site de
cada serviço. O que não muda é a ordem: **hospedagem + banco + servidor de
WhatsApp são o piso do custo mensal, e crescem com o número de vendedores
conectados, não com o número de empresas.**

---

## O caminho que eu recomendo

**Fase 0 — hoje.** Você usa sozinho, de graça. O CRM continua como está.

**Fase 1 — grátis, quando você mandar.** Usuários, papéis e visão do gestor
dentro da sua instância. Serve para a sua concessionária e já é a prova viva
de que funciona com mais de uma pessoa.

**Fase 2 — primeiro cliente pagante.** Uma instância separada para ele, com
o banco dele. É o modelo mais simples e mais seguro: dado de um nunca
encosta no do outro. Dá trabalho manual para criar cada uma, mas com poucos
clientes isso é vantagem, não problema — e você já cobra antes de gastar.

**Fase 3 — multiempresa de verdade.** Só quando a receita pagar a conta. Aí
sim: `empresaId` em todas as tabelas, painel de gestão central, criação de
usuário pela tela, domínio por empresa.

Pular direto para a fase 3 é o erro clássico: paga-se infraestrutura de
cem clientes antes de ter o primeiro.

---

## Riscos, na ordem em que doem

1. **Vazar dado entre empresas.** É o risco que mata o produto. Na fase 2
   não existe (bancos separados); na fase 3 exige que toda consulta filtre
   por empresa, sem exceção — uma consulta esquecida expõe a carteira de um
   cliente para outro.
2. **Regra do WhatsApp.** Automação em excesso derruba número. Hoje o CRM já
   tem janela de horário, limite diário e rascunho em vez de envio
   automático — isso precisa continuar valendo para todo mundo, inclusive
   para quem comprar o produto e quiser "disparar em massa".
3. **LGPD.** Vendendo para terceiros, você passa a tratar dados de clientes
   de outras empresas. Precisa de contrato, política de privacidade, um jeito
   de apagar dados a pedido e um responsável nomeado.
4. **Custo que cresce antes da receita.** Cada vendedor conectado ao WhatsApp
   consome servidor 24h, mesmo sem usar. Cobrança por usuário ativo é o que
   protege a margem.
5. **Suporte.** Um CRM que recebe mensagem de cliente não pode ficar fora do
   ar em silêncio. O ZEUS já vigia e religa a conexão sozinho; falta um canal
   para o cliente avisar quando algo quebra.
6. **Dependência de uma pessoa.** Hoje o conhecimento do sistema está em você
   e no código. Antes de vender, a documentação precisa permitir que outra
   pessoa opere.

---

## Chance de dar certo

O produto tem um diferencial que CRM genérico não tem: **ele é de vendedor de
máquina pesada.** Fala de custo por hora, de financiamento CNH, de rolo liso
e pé-de-carneiro, de safra de café e de licitação de prefeitura. Um vendedor
da concorrência entende o valor em cinco minutos de demonstração.

Onde costuma travar:

- Concessionária que já tem CRM corporativo obrigatório. O caminho aqui é
  vender para o **vendedor**, não para a empresa: ele paga do próprio bolso
  se ganhar tempo e comissão.
- Vendedor que não usa CRM nenhum. É o público certo, mas exige que o
  produto funcione sozinho no primeiro dia — o que o Cérebro e o Orientador
  já fazem.

**Primeiro teste que vale a pena:** ofereça a um colega de outra praça, de
graça, por dois meses, em uma instância separada. Se ele usar sozinho na
terceira semana, existe produto. Se precisar ser lembrado, o problema não é
preço.

---

## O que NÃO foi implementado e por quê

Nada da parte de multiempresa e de criação de usuários pela tela foi feito
nesta leva, exatamente como você pediu: **só fazer se não quebrar o CRM
gratuito.** Quebra. A fase 1 (usuários e papéis na sua própria instância)
não quebra e está pronta para começar quando você disser.
