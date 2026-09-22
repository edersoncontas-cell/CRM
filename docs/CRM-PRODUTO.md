# CRM do Edy — de ferramenta pessoal a produto da concessionária

Documento de trabalho para o teste de um mês e a apresentação à diretoria.
Escrito em 22/09/2026.

> **Sobre os preços deste documento:** o ambiente onde ele foi escrito não tem
> acesso à internet, então nenhum valor aqui foi consultado na fonte. Todos são
> **ordens de grandeza** para dimensionar a conversa, e estão marcados com `~`.
> **Confirme cada um no site do serviço antes de levar número à diretoria** —
> apresentar valor errado para diretor queima a proposta inteira.

---

## 1. O que o CRM é hoje

Não é protótipo. Os números, medidos no código em 22/09/2026:

| | |
|---|---|
| Telas | 31 |
| Rotas de API | 45 |
| Rotinas automáticas (robôs) | 14 |
| Tabelas no banco | 40 |
| Linhas de código | 67.002 |
| Testes automatizados | 942, em 81 arquivos |

O que ele já faz sozinho, sem ninguém apertar botão:

- Lê a conversa do WhatsApp com IA, identifica máquina, valor, condição de
  pagamento e cidade, e **abre ou atualiza a negociação no funil**.
- Não duplica: cliente que volta a falar atualiza o card que já existe.
- Marca visita na agenda quando a conversa combina uma, e sincroniza com a
  Google Agenda.
- Monta o funil, a previsão ponderada, o financeiro e a comissão.
- Manda mensagem em massa programada, em ondas.
- Analisa cada negociação e diz por quem começar o dia.

**Isso é o ativo.** A discussão com a diretoria não é "vamos construir um CRM",
é "temos um CRM rodando há meses, com resultado — vamos distribuir".

---

## 2. O problema que apareceu ontem, e que muda tudo

**A Meta restringiu o WhatsApp do vendedor por 24h** depois de um disparo para
1.298 contatos.

Isso não é detalhe operacional: **é o maior risco do projeto inteiro.** Com um
vendedor, é um dia parado. Com dez vendedores, é a concessionária inteira sem
WhatsApp no mesmo dia — e WhatsApp é o canal de venda.

Nenhum plano de distribuição pode ser apresentado à diretoria sem responder
isso primeiro. A resposta está na seção 4.

---

## 3. Fase A — cada vendedor com seu acesso

### 3.1 O que existe hoje

Uma senha única (`APP_PASSWORD`) para o sistema inteiro. Todo dado é "do
vendedor" implicitamente, porque só há um.

### 3.2 O que precisa ser feito

**Tabela de usuários e dono do dado.** Esta é a mudança mais profunda do
projeto, e não tem atalho: das 40 tabelas, as que guardam carteira precisam
saber **de quem** é cada linha.

| Passa a ter dono | Continua compartilhado |
|---|---|
| Cliente, Negociação, Visita, Proposta | Município, Região |
| Conversa e mensagem do WhatsApp | Máquina, Ficha Técnica, Concorrente |
| Orientador, Pós-venda, Demanda | Academia, Catálogo |
| Alerta, Auditoria, Envio programado | Parâmetros da empresa |

**Papéis.** Vendedor (vê só a própria carteira), Gerente (vê o time, sem dado
sensível), Diretoria (números agregados), Administrador (configura tudo).

**Configurações por vendedor.** Cada um define as cidades onde atua, o próprio
WhatsApp, as próprias metas, os próprios termos de filtro de contato.

**Primeiro acesso.** Administrador cadastra, sistema gera senha temporária,
troca obrigatória na primeira entrada.

**Isolamento de verdade.** Toda consulta ao banco passa a filtrar por usuário
no servidor — nunca na tela. Um vendedor não pode ver a carteira do outro nem
trocando o endereço no navegador.

### 3.3 Esforço honesto

É a maior mudança já feita neste CRM. Mexe em praticamente toda consulta ao
banco, e um esquecimento vaza carteira de um vendedor para outro — o tipo de
erro que mata a confiança no produto no primeiro dia.

Ordem de grandeza: **2 a 3 semanas de trabalho concentrado**, com testes
automatizados de isolamento (um teste que prova que o vendedor A não enxerga
nada do vendedor B, em cada tela).

---

## 4. WhatsApp por vendedor — a parte crítica

Você pediu para eu ser específico aqui. Existem **dois caminhos, e eles são
muito diferentes.**

### 4.1 Caminho A — Evolution API (o que o CRM usa hoje)

Como funciona: um servidor roda o Evolution; cada número vira uma **instância**;
o vendedor lê um QR code no CRM e o número conecta, igual ao WhatsApp Web.

**O que precisa ser feito no código:**

1. `EVOLUTION_INSTANCE` hoje é uma variável de ambiente única. Precisa virar
   **campo na tabela de usuário** — cada vendedor com o nome da sua instância.
2. A tela **Conexão** já mostra QR code para um número. Precisa passar a criar
   a instância do usuário logado e mostrar o QR dele.
3. O **webhook** hoje recebe mensagem e assume que é do único dono. Precisa
   identificar de qual instância veio e gravar para o vendedor certo. **Este é
   o ponto onde um erro mistura a conversa de um vendedor com a de outro.**
4. Todo envio (massa, automático, manual) precisa sair **pela instância do
   dono da conversa**, nunca por uma instância global.
5. Reconexão: quando o celular do vendedor fica sem internet, a instância cai.
   Precisa de aviso na tela e religamento.

**O que precisa de infraestrutura:** Vercel é serverless e **não segura conexão
permanente** — o Evolution precisa de um servidor próprio (VPS) ligado 24h.
Cada instância consome memória o tempo todo.

**O risco, escrito com todas as letras:** é automação não-oficial, contra os
termos do WhatsApp. Foi o que restringiu o número ontem. Com dez vendedores
disparando, **bloqueio deixa de ser acidente e vira rotina.** Não existe
configuração que torne isso seguro; existe configuração que reduz a frequência.

### 4.2 Caminho B — API oficial do WhatsApp (Meta Cloud API)

Como funciona: os números são registrados na conta Meta Business da
concessionária. Mensagem fora da janela de 24h só sai por **modelo aprovado
previamente** pela Meta.

**A pegadinha que decide tudo:** um número registrado na API oficial **deixa de
funcionar no aplicativo normal do WhatsApp**. O vendedor não consegue mais usar
aquele número no celular dele como usa hoje.

Na prática isso significa **números novos, da empresa**, não os pessoais. O que
tem um lado bom que a diretoria vai gostar: **a carteira de clientes passa a ser
da empresa, não do celular do vendedor.** Vendedor que sai não leva o WhatsApp
com a carteira junto.

**O que precisa ser feito:** verificação da empresa na Meta, criação da conta
WhatsApp Business, registro de cada número, cadastro e aprovação dos modelos de
mensagem, e trocar a camada de envio do CRM (que hoje fala Evolution) para
falar Cloud API. O CRM já tem a camada de provedor isolada (`zapi.ts` atende
Evolution e Z-API), então **acrescentar um terceiro provedor é trabalho
conhecido**, não reescrita.

### 4.3 Recomendação

| | Mês de teste | Distribuição |
|---|---|---|
| Caminho | Evolution, com as travas da seção 5 | API oficial |
| Por quê | rápido, sem burocracia, com 2–3 vendedores | não dá para escalar em cima de algo que bloqueia |

Levar à diretoria uma proposta baseada em API não-oficial é levar um risco
escondido. **Melhor apresentar o custo da API oficial e a razão dele.**

---

## 5. Travas de envio — obrigatórias antes de qualquer vendedor novo

Vieram do bloqueio de ontem. Sem isso, distribuir é distribuir o problema.

| Hoje | Passa a ser |
|---|---|
| 2.000 por envio | **80 por dia**, por vendedor, somando tudo |
| 5 mensagens a cada 0,7s | **1 a cada 40–90s**, com variação |
| Qualquer cliente | **só quem já mandou mensagem** nos últimos 12 meses |
| Qualquer horário | **08h–18h, dias úteis** |
| Texto único | **3 variações** girando |
| Sem saída | **"responda SAIR"**, honrado na hora |

Mais um painel de **saúde do número** por vendedor: quantas saíram hoje,
quantos bloquearam, taxa de resposta. Queda na taxa de resposta é o aviso que
vem antes do bloqueio.

---

## 6. Custos operacionais

O CRM hoje roda em camadas gratuitas. **Elas não servem para uso comercial** —
o plano gratuito da Vercel proíbe uso comercial, e as cotas de banco e de IA
são por conta, não por empresa.

### 6.1 O que passa a ser pago

| Item | Por que sai do grátis | Ordem de grandeza mensal |
|---|---|---|
| Hospedagem (Vercel Pro ou equivalente) | plano grátis é não-comercial | ~US$ 20/mês por assento |
| Banco de dados gerenciado | cota grátis não aguenta carteira de time | ~US$ 20–70/mês |
| Servidor do WhatsApp (VPS), só no caminho A | instâncias 24h | ~US$ 10–40/mês por faixa de vendedores |
| IA (Gemini/OpenAI pagos) | cota grátis é por chave e estoura com o time | **por uso** — ver abaixo |
| WhatsApp API oficial, no caminho B | por conversa iniciada pela empresa | **por conversa** — ver abaixo |
| Domínio | identidade própria | ~R$ 40–60/ano |
| Backup e monitoramento | dado de cliente não pode sumir | ~US$ 10–20/mês |

### 6.2 Os dois custos que crescem com o uso

**IA.** Cada conversa analisada consome tokens. O CRM já tem fila de
provedores e tenta o grátis primeiro, o que segura bastante. Com time, o
volume sobe.

**WhatsApp oficial.** Cobrado por conversa. Mensagem de **marketing** é a
categoria mais cara; resposta dentro da janela de 24h de atendimento é mais
barata ou gratuita. Em ordem de grandeza, mensagem de marketing no Brasil está
na casa de **centavos de dólar por conversa** — um disparo para 1.300 contatos
fica na ordem de **algumas centenas de reais**.

> Confirme os dois na fonte. São os únicos que podem surpreender na fatura, e
> são exatamente os que a diretoria vai perguntar.

### 6.3 Ordem de grandeza total

Para **5 a 10 vendedores**, somando hospedagem, banco, servidor, backup e uma
reserva de IA, o piso mensal fica na ordem de **R$ 700 a R$ 1.500/mês**, sem
contar as conversas do WhatsApp oficial, que dependem do volume de disparo.

**Isso é menos do que a comissão de meia máquina.** É o argumento que fecha a
conversa de custo.

---

## 7. Preço — quanto vale e quanto cobrar

### 7.1 O mercado

CRMs de mercado no Brasil (Agendor, Ploomes, RD Station, Moskit, Pipedrive)
trabalham, em ordem de grandeza, entre **R$ 50 e R$ 250 por usuário/mês**,
subindo com o nível do plano. CRMs verticais, feitos para um setor específico,
custam mais — e frequentemente cobram implantação à parte.

**Nenhum deles faz o que este faz**, porque nenhum é feito para concessionária
de máquina pesada: ler conversa de WhatsApp e abrir negociação sozinho, ficha
técnica das máquinas, comparativo com concorrente, comissão de 0,5%, cidades do
sul do Espírito Santo, Banco CNH.

### 7.2 Proposta de preço

| Item | Valor sugerido | Observação |
|---|---|---|
| Implantação (uma vez) | **R$ 6.000 – R$ 12.000** | multiusuário, migração, treinamento |
| Licença por vendedor | **R$ 180 – R$ 250/mês** | acima do CRM genérico, porque é vertical |
| Manutenção e evolução | **R$ 1.500 – R$ 2.500/mês** | correções, telas novas, suporte |

**Exemplo com 8 vendedores, preço cheio:**
implantação R$ 9.000 + (8 × R$ 200) = R$ 1.600/mês + manutenção R$ 2.000/mês
→ **R$ 3.600/mês**, menos ~R$ 1.200 de custo operacional.

**Com o desconto de 30% por ser da casa:**
implantação **R$ 6.300** e mensalidade **R$ 2.520/mês**.

### 7.3 O CRM é do vendedor — o que isso muda na proposta

O CRM foi construído por ele, e é dele. Isso define a **forma** do negócio:
não é entrega de um sistema à empresa, é **licença de uso**. A diferença é
prática e precisa estar escrita no acordo.

**O que a licença estabelece:**

| Ponto | Por que importa |
|---|---|
| É licença, não venda | a empresa passa a usar; o código continua dele |
| Quantos usuários cobre | o preço é por vendedor, e o acordo diz quantos |
| Prazo e reajuste | evita renegociar do zero todo ano |
| Manutenção: o que inclui | correção de erro sim; tela nova é escopo à parte |
| O que acontece ao encerrar | a empresa sai com o dado dela; o código fica com ele |

**A infraestrutura fica na conta dele.** Hospedagem, banco e domínio no nome
do vendedor é o que torna a licença real na prática — se tudo estiver na conta
da empresa, "licença" vira só uma palavra no papel.

### 7.4 O dado do cliente NÃO é do vendedor

Esta é a contrapartida, e ela é tão firme quanto a anterior: **o código é dele,
mas a carteira de clientes da concessionária é da concessionária.** Nome,
telefone, conversa de WhatsApp e histórico de negociação são dados da empresa
(e dos clientes dela), não do sistema que os guarda.

Três consequências práticas:

1. **LGPD.** Com vários vendedores usando, ele passa a tratar dado pessoal de
   terceiros em nome da empresa. O acordo precisa dizer que a empresa é a
   controladora do dado e ele o operador.
2. **Saída sem refém.** Se a relação terminar, a empresa leva o dado dela. Isso
   não é concessão: é o que faz a diretoria assinar sem medo. O CRM **já tem
   exportação** (`/api/exportar/…` cobre clientes, negociações, visitas,
   mensagens e pós-venda) — vale transformar isso em botão na tela e citar na
   apresentação.
3. **Argumento a favor.** "O sistema é meu, o dado é de vocês, e vocês saem com
   ele quando quiserem" é uma frase que derruba a principal objeção de comprar
   de um funcionário.

> Este documento descreve a forma comercial, não substitui contrato. Quem
> redige o acordo é advogado.

---

## 8. Auditoria seção por seção

Você pediu para destrinchar cada seção: objetivo, integrações, ganho, e o que
deve sair. O método para as 31 telas:

Para cada uma, responder:
1. **Objetivo** — que pergunta ela responde, em uma frase.
2. **Quem usa** — vendedor, gerente ou diretoria.
3. **Integrações** — WhatsApp, IA, Google, banco.
4. **Ganho** — o que muda no resultado por ela existir.
5. **Veredito** — mantém, funde com outra, ou sai.

**Candidatas a revisão que já dá para apontar:**

- `/pipeline` chama-se "Demandas" no menu e "pipeline" na URL — confunde com o
  funil de Negociações.
- `/maquinas` e `/maquinas/fichas` são duas telas para o mesmo assunto.
- `/financeiro` tem cinco sub-telas; provavelmente cabem em três.
- `/pos-venda` e `/academia` precisam de prova de uso — se ninguém abre, sai.
- `/zeus` e `/cerebro` são telas de sistema; na versão comercial não deveriam
  aparecer para vendedor.

**Teste de todos os caminhos:** cada tela aberta no PC e no celular, cada botão
acionado, cada rotina automática disparada à mão, cada resultado conferido no
banco. É trabalho de dias, não de horas — e é o que separa "amador" de
"profissional".

---

## 9. O novo Orientador de Vendas

### 9.1 O que muda

Hoje o Orientador analisa **o cliente**: temperatura, objeções, probabilidade.
A tela é uma lista de cards por cliente.

A ideia nova: o Orientador passa a analisar **o vendedor**.

- Que perfil de abordagem ele tem (direto, consultivo, técnico, relacional).
- Como ele conduz: pergunta ou empurra? escuta? cria urgência?
- **Em que etapa do funil ele mais perde**, comparando as conversas com o
  destino das negociações.
- O que fazer para melhorar, em linguagem de vendedor.

### 9.2 A ligação com a Academia

O ponto mais forte da ideia: a Academia deixa de ser conteúdo genérico e passa
a ser **treino sob medida**. O Orientador identifica a limitação; a Academia
gera exercício, roteiro e simulação para aquela limitação específica.

Exemplo: "você perde 60% na etapa de PROPOSTA, e nas conversas você manda preço
antes de entender a aplicação" → a Academia monta um treino de levantamento de
necessidade, com simulação de cliente que pede preço logo de cara.

### 9.3 O que permanece

**A análise no Atendimento continua igual.** Ao lado da conversa, o Orientador
segue levantando máquina, valor, condição, etapa da venda e próxima ação. Esse
é o motor que alimenta o funil — não se mexe nele.

O que sai é **a tela de cards do Orientador**, que vira o painel de desempenho
do vendedor.

### 9.4 Por que isso vende para a diretoria

Um CRM que organiza é comum. Um CRM que **treina o time e mostra ao gerente
onde cada vendedor precisa evoluir** é outra categoria. Este é o argumento mais
forte da apresentação inteira.

---

## 10. O mês de teste

### 10.1 Passos

| Semana | O que fazer |
|---|---|
| 0 | Travas de envio (seção 5). Sem isso, não começa. |
| 1 | Usuários, papéis e isolamento. 2 vendedores além de você. |
| 2 | WhatsApp por vendedor (Evolution), cidades por vendedor. |
| 3 | Novo Orientador + Academia sob medida. Auditoria das telas. |
| 4 | Medir, arrumar o que aparecer, montar a apresentação. |

### 10.2 Métricas — o que provar em 30 dias

Sem número, a diretoria ouve opinião. Com número, ouve proposta.

**Compare o mês com o CRM contra o mês anterior sem ele:**

| Métrica | Como medir | Por que importa |
|---|---|---|
| Negociações abertas | funil | o CRM capta o que se perdia |
| Tempo até a primeira resposta | WhatsApp | quem responde antes, vende |
| Visitas realizadas | agenda | mais porta batida |
| Negociação parada | dias na etapa | o que ia morrer esquecido |
| Taxa de conversão | faturado ÷ encerrado | o número que o diretor olha |
| Ticket médio | financeiro | vender melhor, não só mais |
| Horas de trabalho poupadas | estimativa do vendedor | custo evitado |

**A métrica que fecha a venda:** *"o CRM abriu N negociações que não teriam sido
abertas, somando R$ X em funil, ao custo de R$ Y por mês."*

### 10.3 Registre o antes

Anote hoje, antes do teste, os números do mês passado. **Sem a foto do antes,
não existe comparação — e sem comparação, não existe prova.**

---

## 11. Por que a empresa precisa deste CRM

Resumo para a apresentação:

1. **Nada se perde.** Conversa de WhatsApp vira negociação sozinha.
2. **A carteira é da empresa.** Hoje ela mora no celular do vendedor. Vendedor
   que sai, leva.
3. **O gerente enxerga o time** sem pedir relatório a ninguém.
4. **Treina o time**, apontando onde cada um precisa evoluir.
5. **Feito para máquina pesada** — nenhum CRM de prateleira conhece Banco CNH,
   comissão de 0,5% ou as cidades do sul do ES.
6. **Já funciona.** Não é promessa: é um sistema com 942 testes, rodando há
   meses, com resultado para mostrar.
7. **Custa menos que meia comissão** por mês.

---

## 12. Prompt para gerar a apresentação

Ver `docs/PROMPT-APRESENTACAO.md`.
