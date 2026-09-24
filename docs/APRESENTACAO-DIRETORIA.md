# CRM de Vendas — proposta para a diretoria

**Custos, objetivos e ganhos da distribuição do CRM para o time de vendas**
New Holland Construction · Dynapac — sul do Espírito Santo
Levantamento feito em 24/09/2026 · câmbio usado: R$ 5,17 por dólar (fechamento de 23/09/2026)

> **ANTES DE APRESENTAR — apague este bloco depois de conferir.**
>
> 1. **Preço da licença e da manutenção (seção 7).** São os valores sugeridos em
>    22/09. Confirme se é isso que você quer pedir. Com eles, o total fica no mesmo
>    patamar do pacote completo do RD Station (seção 6). A diretoria vai fazer essa conta.
> 2. **Margem da concessionária (seção 4.3).** A conta usa hipóteses de 5%, 10% e 15%.
>    Se souber a margem real de uma retroescavadeira, troque. É o número que mais convence.
> 3. **Tamanho do time.** As contas estão para 1, 5 e 10 vendedores. Ajuste ao time real.
> 4. **Preços marcados "fonte única" no Apêndice A.** O WhatsApp oficial e os CRMs de mercado
>    têm fonte, mas não passaram pela segunda checagem. Abra os links na véspera.

---

## Resumo em uma página

**O que é.** Um CRM feito sob medida para venda de máquina pesada New Holland e
Dynapac no sul do ES, em uso real pelo vendedor que o construiu. Não é protótipo:
35 telas, 15 rotinas automáticas, 40 tabelas de dados e 1.057 testes automatizados.

**O que ele faz que os CRMs de prateleira não fazem.** Lê a conversa do WhatsApp e
**abre ou atualiza a negociação no funil sozinho**. Conhece a linha New Holland e
Dynapac: fichas técnicas, comparativo com o concorrente, conta de economia de diesel
e custo por hora. Calcula a comissão, inclusive a regra do CRD PME. E **treina o
vendedor no ponto exato em que ele perde venda**.

**O que pedimos.** Três decisões, em ordem:

1. **Sair dos planos gratuitos já.** Cerca de R$ 220/mês para um vendedor.
2. **Piloto de 60 dias** com 2 ou 3 vendedores, medindo os números da seção 4.4.
3. **Distribuir para o time**, se o piloto provar.

**Quanto custa operar** (tudo incluído: hospedagem, banco, IA e WhatsApp oficial):

| Time | Custo operacional por mês | Por vendedor |
|---|---:|---:|
| 1 vendedor | R$ 361 | R$ 361 |
| 5 vendedores | R$ 1.325 | R$ 265 |
| 10 vendedores | R$ 2.574 | R$ 257 |

Com implantação, licença e manutenção (seção 7), o primeiro ano para 10 vendedores
fica em **R$ 70.790**.

**Quanto precisa render para se pagar.** **De 2 a 5 retroescavadeiras a mais por ano,
no time inteiro**, pagam o primeiro ano completo, conforme a margem da casa
(seção 4.3). São duas vendas a mais, divididas entre dez pessoas.

**Riscos, ditos de frente.** O WhatsApp do vendedor já foi bloqueado duas vezes,
porque a conexão atual não é oficial. Em 23/09 o banco de dados do plano grátis foi
suspenso e o CRM ficou fora do ar. **As duas coisas são o motivo desta proposta**:
a distribuição usa a API oficial do WhatsApp e planos pagos, com os custos já
somados acima.

---

## 1. O problema

- **A negociação nasce no WhatsApp e morre nele.** O cliente pergunta preço por
  mensagem, o vendedor responde do celular, e nada disso vira registro. Se o
  vendedor esquece de retomar, ninguém fica sabendo que a venda existiu.
- **A carteira é do celular, não da empresa.** Quando um vendedor sai, o
  relacionamento com o cliente sai junto.
- **A gestão pede relatório.** Para saber o funil do time, alguém precisa perguntar
  e alguém precisa montar uma planilha. O número chega atrasado e sem padrão.
- **Venda perdida não ensina nada.** Sem o motivo registrado, não dá para saber se
  o problema é preço, crédito, prazo de entrega ou concorrente.

## 2. O que o CRM já faz hoje

Números medidos no próprio código, em 24/09/2026:

| | |
|---|---:|
| Telas | 35 |
| Rotinas automáticas | 15 |
| Tabelas de dados | 40 |
| Linhas de código | 71.293 |
| Testes automatizados | 1.057 |

| Área | O que faz | Para o vendedor | Para a gestão |
|---|---|---|---|
| **Funil** | 4 fases (Oportunidade → Proposta → Negociação → Faturado). A negociação nasce sozinha da conversa do WhatsApp quando a IA identifica a máquina e um dado concreto. Venda perdida exige um de 8 motivos padronizados. Proposta comercial em PDF. | Não digita o que surgiu no WhatsApp | Funil com valor por fase, previsão ponderada e toda perda com motivo |
| **WhatsApp** | Conversas dentro do CRM. Áudio vira texto, a mensagem é ligada ao cliente, o vendedor recebe o alerta no celular. | Não perde mensagem | A conversa passa a ter registro e resumo, em vez de existir só no celular |
| **Orientador (IA)** | Lê cada conversa e devolve temperatura, probabilidade de fechar, objeções, próxima ação e uma resposta sugerida no estilo do vendedor. **Nunca envia nada sozinho.** Ordena "por quem começar hoje". | Sabe quem atacar primeiro e com que mensagem | Leitura padronizada de cada negociação sem pedir relatório |
| **Visitas** | Agenda e mapa. Visita combinada na conversa entra sozinha na agenda e na Google Agenda. Ao marcar numa cidade, lista os outros clientes dela. | Viagem rende mais de uma visita | Visitas realizadas contra a meta semanal |
| **Máquinas** | Fichas NH, Dynapac e concorrentes. Comparativo automático, economia de diesel, custo por hora, TCO e retorno da troca. | Argumento em reais em vez de desconto | Venda por valor, que protege margem |
| **Financeiro** | Faturamento por mês e ano, comissão a receber, paga e futura, com a regra do CRD PME (a comissão sai quando 75% da máquina está pago). | Sabe quanto e quando recebe | Faturamento e comissões conferíveis num lugar só |
| **Academia** | 7 etapas da venda, 20 cenários de treino, 10 módulos com 60 aulas, simulador de cliente com IA. "Como você vende" mostra em que passagem do funil o vendedor mais perde. | Treino no ponto fraco dele | Material pronto para formar vendedor novo |
| **Pós-venda** | Contatos de 30 dias, 60 dias, 6 meses e 1 ano depois da compra viram tarefa sozinhos, com o que perguntar. | Não esquece de voltar | Recompra e indicação com rastro |
| **Painel** | Vendas contra a meta, ritmo semanal para bater a meta, ticket médio, perdas por motivo, alertas de negociação esfriando e de cliente esperando resposta. | Sabe onde está e quanto falta | Indicadores sem planilha |
| **Prospecção** | Licitações de máquinas das prefeituras da região, lidas do portal oficial (PNCP). Carteira sem duplicados, sincronizada com o Google Contatos. | Edital sem precisar procurar | Carteira organizada e exportável |

## 3. Objetivos

Cada objetivo tem um número que o CRM mede, e é esse número que o piloto vai mostrar.

| # | Objetivo | Como se mede |
|---|---|---|
| 1 | Nenhuma oportunidade se perde por esquecimento | Negociações "esfriando" (10+ dias sem contato) e clientes esperando resposta há mais de 24 h, os dois caindo mês a mês |
| 2 | A carteira passa a ser da empresa | 100% das conversas e negociações do time no CRM, exportáveis a qualquer momento |
| 3 | O gerente enxerga o time sem pedir relatório | Painel do gerente com o funil de cada vendedor (etapa 3 da implantação) |
| 4 | Toda venda perdida ensina alguma coisa | 100% das perdas com motivo; o ranking de motivos orienta preço e crédito |
| 5 | Cada vendedor evolui onde precisa | Taxa de passagem entre as fases do funil, antes × depois |
| 6 | Um processo comercial só, para o time todo | As mesmas 4 fases, os mesmos motivos de perda e as mesmas métricas para todos |

## 4. Ganhos

### 4.1 Para o vendedor

- **Menos digitação.** A negociação, a agenda e a cidade saem da conversa do WhatsApp.
- **Não perde o fio.** Alerta de negociação esfriando aos 10 dias, de cliente esperando
  resposta há mais de 4 horas e de pós-venda vencido.
- **Argumento pronto.** Ficha técnica, comparativo com o concorrente e conta de economia
  de diesel na hora, na obra.
- **Sabe quanto vai receber.** Comissão prevista, inclusive a do CRD PME.

### 4.2 Para a gestão

- **Previsão ponderada do funil.** O valor de cada negociação vezes a chance da fase em
  que ela está (20%, 50% ou 80%, ajustáveis).
- **Ritmo de meta.** Quantas vendas por semana faltam para fechar o ano, com o aviso de
  "adiantado" ou "atrasado".
- **Perdas por motivo, em reais.** Mostra onde a empresa perde mais: preço, crédito,
  concorrente ou prazo de entrega.
- **Carteira da empresa.** Com o WhatsApp oficial, o número é da concessionária. Vendedor
  que sai não leva a carteira.

### 4.3 Em dinheiro: o ponto de equilíbrio

Conta conservadora. Usa a máquina mais barata da faixa (retroescavadeira nova,
**R$ 296 mil**, piso de mercado em 2025/2026, Apêndice A) e o custo do primeiro ano
inteiro para 10 vendedores (**R$ 70.790**: operação + implantação + licença + manutenção).

| Margem da concessionária por máquina (hipótese) | Ganho por retroescavadeira | Máquinas a mais por ano que pagam o 1º ano |
|---|---:|---:|
| 5% | R$ 14.800 | 4,8 |
| 10% | R$ 29.600 | 2,4 |
| 15% | R$ 44.400 | 1,6 |

**Leitura:** com margem de 10%, **2 ou 3 retroescavadeiras a mais por ano, no time
inteiro**, pagam tudo. Com escavadeira de 20 t (acima de R$ 675 mil) a conta cai
para menos da metade. A partir do segundo ano sai a implantação, e o número cai mais.

> A margem real é da diretoria. Troque a coluna da esquerda pela margem da casa.

### 4.4 O que o piloto vai medir

**O CRM já calcula** (basta ligar o piloto): taxa de conversão, ticket médio, ritmo de
meta, previsão ponderada, perdas por motivo, dias parados em proposta, negociações
esfriando, clientes 30+ dias sem contato e visitas realizadas por semana.

**Precisa ser construído** (entra na implantação):

- **Tempo até a primeira resposta** ao cliente. Hoje não é calculado.
- **Quantas negociações a IA abriu sozinha, e quanto isso soma em reais.** O dado já é
  gravado, mas nenhuma tela mostra.

O slide que fecha a reunião depois do piloto: *"o CRM abriu N negociações que não
teriam sido registradas, somando R$ X no funil, ao custo de R$ Y por mês."*

## 5. Custos

### 5.1 Hoje: R$ 0 — e por que não pode continuar assim

O CRM roda em planos gratuitos. Para uma pessoa testando, serviu. Para uma empresa,
não serve, por três motivos com fonte:

1. **A hospedagem gratuita proíbe uso comercial.** A documentação oficial da Vercel diz
   que o plano Hobby é só para uso pessoal e não comercial.
2. **O banco gratuito desliga quando a cota acaba, e desligou.** O plano grátis do Neon dá
   100 horas de computação por mês. Esgotada a cota, o banco é **suspenso até o próximo
   ciclo**. Foi o que aconteceu em 23/09/2026.
3. **A IA gratuita não aguenta um time e usa os dados dos clientes.** O nível grátis do
   Gemini dá cerca de **20 análises por dia** (medido em setembro de 2026). E, no nível
   gratuito, **o Google usa as conversas para treinar os modelos**. Com dado de cliente,
   isso pesa contra (LGPD). No pago, não usa.

### 5.2 Custo operacional por tamanho de time

| Item | 1 vendedor | 5 vendedores | 10 vendedores |
|---|---:|---:|---:|
| Hospedagem (Vercel Pro) | R$ 103 | R$ 103 | R$ 103 |
| Banco de dados (Neon, por uso) | R$ 35 | R$ 121 | R$ 272 |
| Inteligência artificial (Gemini, por uso) | R$ 78 | R$ 388 | R$ 776 |
| WhatsApp oficial (Meta, por mensagem) | R$ 142 | R$ 710 | R$ 1.420 |
| Domínio próprio (.com.br) | R$ 3 | R$ 3 | R$ 3 |
| **Total por mês** | **R$ 361** | **R$ 1.325** | **R$ 2.574** |
| **Total por ano** | **R$ 4.331** | **R$ 15.899** | **R$ 30.890** |

**O que faz esse número subir ou descer:**

| Cenário | 1 vendedor | 5 vendedores | 10 vendedores |
|---|---:|---:|---:|
| Sem campanha de marketing no WhatsApp | R$ 232 | R$ 682 | R$ 1.287 |
| IA com o preço de 2027 (o Google dobra em 01/01/2027) | R$ 439 | R$ 1.713 | R$ 3.350 |
| IA no modelo mais econômico (Flash-Lite) | R$ 312 | R$ 1.079 | R$ 2.083 |

A maior linha é a **campanha de marketing no WhatsApp**: R$ 0,32 por mensagem entregue.
Ela é **decisão da gestão**, mês a mês. As premissas de cada linha estão no Apêndice B.

### 5.3 De onde vem cada preço

| Item | Preço | Observação |
|---|---|---|
| Vercel Pro | US$ 20/mês | Um assento só: quem publica o sistema. Os vendedores usam o CRM e não contam como assento. Inclui US$ 20 de uso. |
| Neon Launch | US$ 0,106 por hora de computação + US$ 0,35 por GB/mês | **Sem mensalidade mínima** desde dez/2025. Restauração de até 7 dias incluída. Sem SLA (só no plano Scale). |
| Gemini 3.8 Flash (pago) | US$ 0,75 por 1 milhão de tokens de entrada e US$ 3,75 de saída | Preço de lançamento até 31/12/2026. **Dobra em 01/01/2027.** No pago, os dados não treinam o modelo. |
| WhatsApp oficial — marketing | R$ 0,3217 por mensagem entregue | Cobrança em reais desde 01/07/2026. Sem desconto por volume. |
| WhatsApp oficial — utilidade | R$ 0,035 por mensagem | Confirmação de visita, proposta enviada. |
| WhatsApp oficial — resposta ao cliente | Grátis até 1.000 por mês por número; depois R$ 0,035 | **Regra nova a partir de 01/10/2026.** A franquia é por número, então um número por vendedor multiplica a franquia. |
| Domínio .com.br | cerca de R$ 40/ano | A confirmar no Registro.br. |

### 5.4 WhatsApp: oficial ou não-oficial

| | Não-oficial (o que o CRM usa hoje) | Oficial (API da Meta) |
|---|---|---|
| Custo | Servidor próprio: cerca de R$ 55/mês para o time inteiro | Por mensagem (tabela acima): cerca de R$ 142/mês por vendedor |
| Bloqueio | **Já bloqueou duas vezes.** Com 10 vendedores, vira rotina. É contra os termos do WhatsApp. | Canal autorizado pela Meta. Não há risco de bloqueio por conexão não-oficial. |
| De quem é o número | Do celular do vendedor | **Da empresa.** Vendedor que sai não leva a carteira. |
| O que precisa | Nada (já funciona) | Verificação da concessionária na Meta, números da empresa e integração no CRM (seção 8) |

**Recomendação:** não-oficial só no piloto, com as travas que o CRM já tem (80
mensagens por dia, horário comercial, só para quem já conversou, "responda SAIR").
Para o time, **oficial**. Levar à diretoria uma proposta em cima de conexão não-oficial
seria esconder um risco que já aconteceu duas vezes.

### 5.5 O que não entrou na conta

Dito aqui para não aparecer depois como surpresa:

- **Transcrição de áudio paga.** Hoje ela usa o nível gratuito do Groq. Com o time, pode
  precisar de plano pago. O custo não foi levantado; o piloto mede o volume.
- **Garantia contratual de disponibilidade (SLA) do banco.** Só existe no plano Scale do
  Neon (US$ 0,222 por hora, cerca do dobro do Launch). Se a diretoria exigir, a linha do
  banco dobra.
- **Serviço de e-mail** para recuperar senha e convidar usuário. Provavelmente grátis no
  volume de um time; não foi levantado.
- **Variação do câmbio.** Hospedagem, banco e IA são cobrados em dólar. A cada R$ 0,50 de
  alta do dólar, o total de 10 vendedores sobe cerca de R$ 110/mês.

## 6. Comparação com o mercado

Preço por mês para **10 usuários**, sem as tarifas de mensagem da Meta, que valem para
qualquer sistema que use o WhatsApp oficial:

| CRM | Por mês (10 usuários) | WhatsApp |
|---|---:|---|
| Moskit Professional | R$ 1.490 | Sincronização incluída |
| Agendor Performance + Agendor Chat | R$ 1.793 | Caixa de WhatsApp paga à parte |
| Pipedrive Growth | cerca de R$ 2.533 (US$ 49 por usuário) | Integração em beta |
| RD Station CRM Pro + RD Conversas Pro | R$ 4.009 (+ implantação opcional de R$ 5.798) | API oficial |
| HubSpot Sales Professional | cerca de R$ 5.170 (US$ 100) + onboarding de US$ 1.500 | Não verificado |
| Salesforce Pro Suite | cerca de R$ 5.170 (US$ 100, contrato anual) | Não verificado |
| **Este CRM: só operação** | **R$ 1.154** | API oficial |
| **Este CRM: operação + licença + manutenção** | **R$ 3.954** | API oficial |

**A comparação justa.** Os CRMs de prateleira organizam o funil. Este CRM fica **no mesmo
patamar do pacote completo do RD Station** e **abaixo de HubSpot e Salesforce**, e traz o
que é do nosso negócio:

- a leitura da conversa de WhatsApp que abre a negociação sozinha;
- fichas técnicas e comparativo New Holland e Dynapac;
- conta de diesel, custo por hora e TCO na proposta;
- comissão com a regra do CRD PME;
- licitações das prefeituras da região;
- uma Academia com as etapas da venda de máquina pesada.

Os mais baratos (Moskit e Agendor) custam menos porque não fazem nada disso.

*Os preços desta seção são de fonte única (Apêndice A). Conferir nos links antes da reunião.*

## 7. Proposta

| Item | Valor | Com 30% de desconto (da casa) |
|---|---:|---:|
| Implantação (uma vez): multiusuário, WhatsApp oficial, treinamento | R$ 9.000 | **R$ 6.300** |
| Licença por vendedor | R$ 200/mês | **R$ 140/mês** |
| Manutenção e evolução (correções, suporte, telas novas pequenas) | R$ 2.000/mês | **R$ 1.400/mês** |

Para **10 vendedores**:

- Licença e manutenção: R$ 2.800/mês.
- Com a operação (seção 5.2): **R$ 5.374/mês**.
- Primeiro ano completo: **R$ 70.790**.

**Como funciona a licença:**

- **O sistema é do vendedor que o construiu. O dado é da empresa.** A concessionária usa
  por licença. Nome, telefone, conversa e histórico dos clientes são dela, e ela sai com
  eles quando quiser. O CRM já exporta clientes, negociações, visitas, mensagens e
  pós-venda em planilha.
- **LGPD.** A empresa é a controladora dos dados dos clientes. Quem mantém o sistema é o
  operador. Isso vai escrito no acordo.
- **O acordo diz:** quantos usuários a licença cobre, o prazo e o reajuste, o que a
  manutenção inclui (correção sim; tela nova grande é escopo à parte) e o que acontece
  ao encerrar. Quem redige é advogado.

## 8. O que ainda não existe — e entra na implantação

Para a diretoria saber exatamente o que está comprando:

| Falta | Por que importa | Estado |
|---|---|---|
| **Um acesso por vendedor** (cada um vê só a sua carteira) | Hoje o CRM é de uma pessoa, com uma senha só | Isolamento construído e testado; sai do ar até a reentrada segura (seção 10) |
| **Visão do gerente** (funil do time, comparação entre vendedores) | Sem ela, o objetivo 3 não acontece | A fazer |
| **WhatsApp oficial, um número por vendedor** | Tira o risco de bloqueio e deixa o número com a empresa | A fazer |
| **Backup automático fora do banco** | Hoje há exportação manual e a restauração de 7 dias do plano pago | A fazer |
| **Aviso de queda fora do CRM** | Quando o banco caiu em 23/09, nada avisou de fora | A fazer |
| **Teto de gasto de IA por vendedor** | A análise feita a cada mensagem não tem limite diário. Com IA paga, precisa ter antes de ligar. | A fazer |
| **Tempo até a 1ª resposta e negociações abertas pela IA** | São as provas do piloto (seção 4.4) | A fazer |
| **Integração com o sistema da concessionária e com o Banco CNH** | Hoje o faturamento é marcado à mão no CRM | Fora do escopo desta proposta |

## 9. Riscos e como são tratados

| Risco | Já aconteceu? | Como fica tratado |
|---|---|---|
| **WhatsApp bloqueado** | Sim, duas vezes (conexão não-oficial e disparo em massa) | API oficial para o time. Travas de envio já no CRM: 80 por dia, horário comercial, só para quem já conversou, "SAIR". Trava geral que nasce pausada. |
| **CRM fora do ar por plano grátis** | Sim, em 23/09/2026 (banco suspenso por cota) | Plano pago, sem suspensão por cota. Hoje o CRM já diz na tela o motivo quando o banco cai, tenta um segundo endereço sozinho e sabe se recompor num banco novo. |
| **O modelo de IA usado hoje vai ser desligado** | Anunciado pelo Google para 16 a 20/10/2026 | Troca para o modelo atual antes da data. Faz parte da saída do plano grátis (fase 0). |
| **Preço da IA dobra em 2027** | Anunciado (01/01/2027) | Já calculado na seção 5.2. Alternativa: o modelo econômico (Flash-Lite), a um terço do preço. |
| **Dependência de uma pessoa** | — | 1.057 testes automatizados, documentação das regras e do histórico de falhas no próprio repositório, e contrato de manutenção. |
| **Dado de cliente (LGPD)** | — | IA paga (não usa os dados para treino), acordo com os papéis de controlador e operador, exportação completa a qualquer momento. |
| **Câmbio** | — | Cerca de 45% do custo operacional é em dólar. Sensibilidade na seção 5.5. |

## 10. Plano de implantação

| Fase | O que acontece | Prazo | Custo mensal a partir daí |
|---|---|---|---|
| **0. Sair do grátis** | Vercel Pro, Neon pago, Gemini pago com teto de gasto, troca do modelo de IA que será desligado | 1 semana | cerca de R$ 220 (1 vendedor, ainda no WhatsApp atual) |
| **1. Um acesso por vendedor** | Login por pessoa, cada um vê só a sua carteira, painel do gerente. Entra em **duas etapas**: primeiro a estrutura no banco, depois o código. | 2 a 3 semanas | igual |
| **2. WhatsApp oficial** | Verificação da concessionária na Meta, números da empresa, modelos de mensagem aprovados, integração no CRM | 3 a 4 semanas (depende da Meta) | + R$ 142 por vendedor |
| **3. Piloto** | 2 ou 3 vendedores por 60 dias, medindo a seção 4.4 | 60 dias | seção 5.2, coluna de 5 |
| **4. Distribuição** | Treinamento e entrada do time | conforme o piloto | seção 5.2 |

**Lição que já está no processo:** mudança na estrutura do banco sobe em duas etapas e é
testada contra o banco antigo antes de publicar. Em 23/09 uma mudança dessas subiu de uma
vez e derrubou o CRM.

## 11. O pedido

1. **Aprovar a fase 0 agora**: cerca de R$ 220/mês, para o CRM sair do plano gratuito e
   parar de depender da sorte.
2. **Aprovar o piloto** de 60 dias com 2 ou 3 vendedores, com a implantação das fases 1 e 2.
3. **Voltar a esta mesa** com os números do piloto e decidir a distribuição.

---

## Apêndice A — Fontes dos preços

Levantamento de 24/09/2026. O acesso direto aos sites dos fornecedores estava bloqueado
no ambiente de pesquisa, então cada preço foi buscado em pelo menos duas fontes. Nos
grupos marcados "conferido", um segundo pesquisador refez a busca de forma independente
para tentar desmentir o valor. Nos marcados "fonte única", a cota de buscas acabou antes
da segunda checagem.

**Hospedagem e banco — conferido**

| Item | Valor | Fontes |
|---|---|---|
| Vercel Hobby: só uso pessoal, não comercial | — | vercel.com/docs/plans/hobby · vercel.com/docs/limits/fair-use-guidelines |
| Vercel Pro | US$ 20/mês por assento, com US$ 20 de uso incluído. Alguns agregadores citam US$ 24 no pagamento mensal; a documentação oficial mostra US$ 20. | vercel.com/docs/plans/pro-plan · vercel.com/changelog/included-pro-usage-is-now-credit-based |
| Neon Free: 100 CU-hora e 0,5 GB; esgotou, suspende até o próximo ciclo | — | github.com/neondatabase/website (docs/introduction/plans.md, atualizado em 23/09/2026) · neon.com/faqs/free-plan-limits-and-quotas |
| Neon Launch | US$ 0,106/CU-hora + US$ 0,35/GB-mês, sem mínimo | mesmo arquivo oficial · neon.com/blog/new-usage-based-pricing |
| Neon Scale (com SLA) | US$ 0,222/CU-hora + US$ 0,35/GB-mês | mesmo arquivo oficial |
| Supabase Pro (alternativa de preço fixo) | US$ 25/mês, 8 GB, backup diário | github.com/supabase/supabase (packages/shared-data/plans.ts) · supabase.com/pricing |

**Inteligência artificial — conferido**

| Item | Valor | Fontes |
|---|---|---|
| Gemini 3.8 Flash pago | US$ 0,75 / US$ 3,75 por 1M tokens até 31/12/2026; US$ 1,50 / US$ 7,50 a partir de 01/01/2027 | ai.google.dev/gemini-api/docs/pricing · blog.google (lançamento do 3.8 Flash) |
| Gemini 3.1 Flash-Lite | US$ 0,25 / US$ 1,50 por 1M tokens | blog.google (Gemini 3.1 Flash-Lite) · openrouter.ai |
| Gemini grátis: cerca de 20 requisições/dia; dados usados para treino | — | discuss.ai.google.dev (set/2026) · dev.to (medição de set/2026) |
| Gemini 2.5 Flash (modelo usado hoje): desligamento em 16 a 20/10/2026 | — | página de descontinuação do Gemini API e do Google Cloud (via agregadores de 2026) |
| Google AI Plus (assinatura de uso pessoal) | R$ 24,99/mês — **não dá cota de API** | blog.google/intl/pt-br · tecnoblog.net |

**WhatsApp oficial — fonte única**

| Item | Valor | Fontes |
|---|---|---|
| Marketing | US$ 0,0625 (R$ 0,3217 em contas em reais, desde 01/07/2026) | messagecentral.com · wiichat.com.br · mobiletime.com.br (01/07/2026) |
| Utilidade | US$ 0,0068 (R$ 0,035) | mobiletime.com.br · clickmassa.com.br |
| Serviço a partir de 01/10/2026 | 1.000 grátis por número por mês; depois US$ 0,0068 (R$ 0,035) | developers.facebook.com (non-template messages) · sendpulse.com/br · courier.com |
| Servidor para a conexão não-oficial (Hostinger KVM 2) | R$ 38,99 a R$ 42,99/mês promocional; média de R$ 54,66 em 3 anos | kildaryoliver.com.br · horadecodar.com.br · hostinger.com |

**CRMs de mercado — fonte única**

| Item | Valor | Fontes |
|---|---|---|
| Moskit Professional | R$ 149/usuário (mensal) | moskitcrm.com (blog e planos) |
| Agendor Performance / Agendor Chat | R$ 83/usuário · Chat R$ 312 (3 usuários) + R$ 93 por usuário extra | agendor.com.br/planos-precos |
| RD Station CRM Pro / Conversas Pro | R$ 131/usuário (mínimo 4) · Conversas R$ 2.699/mês | rdstation.com/planos/crm · rdstation.com/planos/conversas |
| Pipedrive Growth | US$ 49/usuário (mensal) | pipedrive.com/en/pricing |
| HubSpot Sales Professional | US$ 100/licença + onboarding de US$ 1.500 (confiança baixa) | docket.io · marketbetter.ai |
| Salesforce Pro Suite | US$ 100/usuário (anual) | salesforce.com/br/small-business/pro-suite |

**Referências de ganho — fonte única**

| Item | Valor | Fontes |
|---|---|---|
| Dólar comercial, 23/09/2026 | R$ 5,1689 | infomoney.com.br · otempo.com.br |
| Retroescavadeira nova (várias marcas; NH B95C 2025 perto de R$ 410–415 mil) | R$ 296 mil a R$ 415 mil | maquinalista.com (índice) · contrato público de Capão Bonito/SP (2025) |
| Escavadeira NH E215C: seminova 2024 (piso para a nova) | R$ 675 mil | mercadolivre.com.br · maquinalista.com |

## Apêndice B — Premissas das contas

| Linha | Premissa |
|---|---|
| Câmbio | R$ 5,17 (fechamento de 23/09/2026) |
| Banco (Neon) | 1 vendedor: 8 h/dia acordado a 0,25 CU e 1 GB. 5 vendedores: 14 h/dia a 0,5 CU e 3 GB. 10 vendedores: 16 h/dia a 1 CU e 5 GB. Estimativa; o consumo real aparece no painel do Neon no primeiro mês. |
| IA | 1.000 análises por vendedor por mês (40 por dia útil × 22 dias, mais 15% de outras chamadas). Cada análise: cerca de 10 mil tokens de entrada e 2 mil de saída, o tamanho da análise do Orientador. Resultado: US$ 0,015 por análise em 2026. |
| WhatsApp oficial | Por vendedor por mês: 1.300 respostas a clientes (300 acima da franquia grátis), 80 mensagens de utilidade e 400 de marketing. |
| Hospedagem | 1 assento Vercel (quem publica). O uso de 10 vendedores cabe nos US$ 20 incluídos; se passar, o excedente é cobrado com alerta de gasto. |
| Proposta | Valores sugeridos em 22/09: implantação R$ 9.000, licença R$ 200 por vendedor, manutenção R$ 2.000, com 30% de desconto. |
| Ponto de equilíbrio | Retroescavadeira nova a R$ 296 mil (piso da faixa); margem de 5%, 10% ou 15% como hipótese; custo do 1º ano para 10 vendedores = 12 × R$ 5.374 + R$ 6.300. |
