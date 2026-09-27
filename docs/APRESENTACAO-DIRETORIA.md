# CRM de Vendas — proposta para a diretoria

**Custos, objetivos e ganhos da distribuição do CRM para o time de vendas**
New Holland (linha amarela e agrícola) · Dynapac — sul do Espírito Santo
Time de vendas: cerca de 26 vendedores, 6 da linha amarela e cerca de 20 da agrícola (número aproximado)
Levantamento feito em 24/09/2026 e atualizado em 27/09/2026 · câmbio usado: R$ 5,17 por dólar (fechamento de 23/09/2026)

> **ANTES DE APRESENTAR — apague este bloco depois de conferir.**
>
> 1. **Os valores da seção 7 são estimativa**, com o método escrito lá: horas a R$ 100,
>    preço de mercado e valor de uma máquina. Se a diretoria pedir desconto, o espaço está
>    na **licença**. A manutenção e a ferramenta são custo; abaixo disso, você paga para trabalhar.
> 2. **Tamanho do time agrícola.** O número é aproximado: cerca de 20. As contas usam 26 no
>    total (6 + 20). Se souber o número certo, troque: cada vendedor a mais ou a menos muda
>    cerca de R$ 380/mês (operação + licença), cerca de R$ 4,6 mil no primeiro ano.
> 3. **Decidi por você que o piloto não paga licença nem manutenção (seção 7).** É o que deixa
>    o risco da diretoria pequeno: até cerca de R$ 12,7 mil se o piloto não provar. Se preferir
>    cobrar, o piloto sobe para cerca de R$ 17,5 mil.
> 4. **Plano do Claude (seções 5.2 e 5.3).** A conta usa o Max 5x (US$ 100/mês). Se o seu
>    plano for outro, troque a linha "Ferramenta de manutenção".
> 5. **Preços marcados "sem 2ª checagem" no Apêndice A.** O WhatsApp oficial e os CRMs de
>    mercado têm duas fontes cada, mas não passaram pela segunda checagem. Abra os links na véspera.
> 6. **Perguntas prováveis (seção 11).** As respostas sobre "e se você sair?" e "por que
>    licença?" são suas. Revise com as suas palavras antes da reunião.
> 7. **Antes de ASSINAR qualquer acordo (não antes de apresentar): advogado.** A Lei do
>    Software (Lei 9.609/98, art. 4º) define quando um programa feito por empregado pertence
>    ao empregador. A licença **não exclusiva** da seção 7, que mantém o sistema com você,
>    depende disso.

---

## Resumo em uma página

**O que é.** Um CRM feito sob medida para venda de máquina pesada New Holland e
Dynapac no sul do ES, em uso real pelo vendedor que o construiu. Não é protótipo:
35 telas, 15 rotinas automáticas, 40 tabelas de dados e 1.094 testes automatizados.
Hoje ele conhece a **linha amarela**. Para os cerca de 20 vendedores da agrícola, entra o
catálogo agrícola depois do piloto (seção 8).

**O que ele faz que os CRMs de prateleira não fazem.** Lê a conversa do WhatsApp e
**abre ou atualiza a negociação no funil sozinho**. Conhece a linha amarela New Holland e
a Dynapac: fichas técnicas, comparativo com o concorrente, conta de economia de diesel
e custo por hora. Calcula a comissão, inclusive a regra do CRD PME. E **treina o
vendedor no ponto exato em que ele perde venda**.

**O que pedimos.** Três decisões, em ordem:

1. **Sair dos planos gratuitos já.** R$ 754/mês enquanto o CRM atende só o vendedor que
   o construiu, ainda no WhatsApp atual, já incluída a ferramenta com que o CRM é mantido.
   (A linha "1 vendedor" da tabela abaixo, R$ 896, já inclui o WhatsApp oficial.)
2. **Piloto de 60 dias** com 2 ou 3 vendedores da linha amarela, medindo os números da
   seção 4.4.
3. **Levar ao time**, se o piloto provar: primeiro a linha amarela inteira, depois a agrícola.

**Quanto custa operar** (tudo incluído: hospedagem, banco, IA, WhatsApp oficial e a
ferramenta de manutenção):

| Time | Custo operacional por mês | Por vendedor |
|---|---:|---:|
| 1 vendedor | R$ 896 | R$ 896 |
| 6 vendedores (linha amarela) | R$ 2.079 | R$ 347 |
| cerca de 26 vendedores (time todo) | R$ 6.896 | R$ 265 |

Com implantação, licença e manutenção (seção 7), o primeiro ano completo com os cerca
de 26 vendedores fica em **R$ 163.732**, com a IA no preço de 2026 (com o de 2027, seção 4.3).
**Se o piloto não provar, a empresa terá gastado até cerca de R$ 12,7 mil** (seção 10).

**Quanto precisa render para se pagar.** A margem da casa é de cerca de 10% por
máquina. Com ela, o primeiro ano completo se paga com **R$ 1,64 milhão em vendas a
mais**: cerca de **6 retroescavadeiras por ano, no time inteiro**. É menos de uma venda
a mais para cada quatro vendedores. **Duas retroescavadeiras a mais por ano já pagam a
licença do time todo** (seção 7).

**Riscos, ditos de frente.** O WhatsApp do vendedor já foi bloqueado duas vezes: a
conexão atual não é oficial, e um dos bloqueios veio de um disparo em massa. Em 23/09 o
CRM ficou fora do ar por dois motivos: uma mudança na estrutura do banco subiu de uma vez,
e o consumo alto das telas e da manutenção esgotou a cota do banco grátis, que foi
suspenso. Os defeitos já foram corrigidos (seções 9 e 10). O que sobra só se resolve
pagando, e é o motivo desta proposta: a API oficial do WhatsApp e planos pagos, com os
custos já somados acima.

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
| Linhas de código | 71.715 |
| Testes automatizados | 1.094 |

| Área | O que faz | Para o vendedor | Para a gestão |
|---|---|---|---|
| **Funil** | 4 fases (Oportunidade → Proposta → Negociação → Faturado). A negociação nasce sozinha da conversa do WhatsApp quando a IA identifica a máquina e um dado concreto. Venda perdida exige um de 8 motivos padronizados. Proposta comercial em PDF. | Não digita o que surgiu no WhatsApp | Funil com valor por fase, previsão ponderada e toda perda com motivo |
| **WhatsApp** | Conversas dentro do CRM. Áudio vira texto, a mensagem é ligada ao cliente, o vendedor recebe o alerta no celular. | Não perde mensagem | A conversa passa a ter registro e resumo, em vez de existir só no celular |
| **Orientador (IA)** | Lê cada conversa e devolve temperatura, probabilidade de fechar, objeções, próxima ação e uma resposta sugerida no estilo do vendedor. **Nunca envia nada sozinho.** Ordena "por quem começar hoje". | Sabe quem atacar primeiro e com que mensagem | Leitura padronizada de cada negociação sem pedir relatório |
| **Visitas** | Agenda e mapa. Visita combinada na conversa entra sozinha na agenda e na Google Agenda. Ao marcar numa cidade, lista os outros clientes dela. | Viagem rende mais de uma visita | Visitas realizadas contra a meta semanal |
| **Máquinas** | Fichas da linha amarela NH, Dynapac e concorrentes. Comparativo automático, economia de diesel, custo por hora, TCO e retorno da troca. | Argumento em reais em vez de desconto | Venda por valor, que protege margem |
| **Financeiro** | Faturamento por mês e ano, comissão a receber, paga e futura, com a regra do CRD PME (a comissão sai quando 75% da máquina está pago). | Sabe quanto e quando recebe | Faturamento e comissões conferíveis num lugar só |
| **Academia** | 7 etapas da venda, 20 cenários de treino, 10 módulos com 60 aulas, simulador de cliente com IA. "Como você vende" mostra em que passagem do funil o vendedor mais perde. | Treino no ponto fraco dele | Material pronto para formar vendedor novo |
| **Pós-venda** | Contatos de 30 dias, 60 dias, 6 meses e 1 ano depois da compra viram tarefa sozinhos, com o que perguntar. | Não esquece de voltar | Recompra e indicação com rastro |
| **Painel** | Vendas contra a meta, ritmo semanal para bater a meta, ticket médio, perdas por motivo, alertas de negociação esfriando e de cliente esperando resposta. | Sabe onde está e quanto falta | Indicadores sem planilha |
| **Prospecção** | Licitações de máquinas das prefeituras da região, lidas do portal oficial (PNCP). Carteira sem duplicados, sincronizada com o Google Contatos. | Edital sem precisar procurar | Carteira organizada e exportável |

O funil, as conversas, a agenda e o pós-venda servem a qualquer linha. A leitura
automática da conversa (a que abre a negociação sozinha), o Orientador, as fichas, o
comparativo e a Academia são da linha amarela: a IA hoje é instruída a considerar só essa
linha.

## 3. Objetivos

Cada objetivo tem um número que o CRM mede, e é esse número que o piloto vai mostrar.

| # | Objetivo | Como se mede |
|---|---|---|
| 1 | Nenhuma oportunidade se perde por esquecimento | Negociações "esfriando" (10+ dias sem contato) e clientes esperando resposta há mais de 4 horas, os dois caindo mês a mês |
| 2 | A carteira passa a ser da empresa | 100% das conversas e negociações do time no CRM, exportáveis a qualquer momento |
| 3 | O gerente enxerga o time sem pedir relatório | Painel do gerente com o funil de cada vendedor (fase 1 da implantação, seção 10) |
| 4 | Toda venda perdida ensina alguma coisa | 100% das perdas com motivo; o ranking de motivos orienta preço e crédito |
| 5 | Cada vendedor evolui onde precisa | Taxa de passagem entre as fases do funil, antes × depois |
| 6 | Um processo comercial só, para o time todo | As mesmas 4 fases, os mesmos motivos de perda e as mesmas métricas para as duas linhas |

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
**R$ 296 mil**, piso de mercado em 2025/2026, Apêndice A), a margem da casa (**cerca de
10%**) e o custo do primeiro ano inteiro com os cerca de 26 vendedores desde o primeiro
mês (**R$ 163.732**: operação + ferramenta + implantação + licença + manutenção).

| Margem por máquina | Ganho por retroescavadeira | Máquinas a mais por ano que pagam o 1º ano |
|---|---:|---:|
| **10% (margem da casa)** | **R$ 29.600** | **5,5** |
| 5% (se a margem apertar) | R$ 14.800 | 11,1 |
| 15% | R$ 44.400 | 3,7 |

**Leitura:** com a margem da casa, **cerca de 6 retroescavadeiras a mais por ano, no time
de cerca de 26**, pagam tudo. Vale o mesmo em reais para a agrícola: R$ 1,64 milhão em
tratores, colheitadeiras e implementos a mais. Com escavadeira de 20 t (acima de R$ 675 mil),
bastam 2,4 máquinas.
**Com o preço da IA de 2027.** O time todo só entra depois do piloto, já em 2027, quando
o preço do Flash dobra (seção 5.2). Se toda a IA ficar no Flash com esse preço, o primeiro
ano completo vai a **R$ 187.936**: cerca de **6,3 retroescavadeiras**. Do segundo ano em
diante sai a implantação, e o ano fica em R$ 174.636 (cerca de 5,9). Como o CRM já usa
primeiro o modelo econômico (Flash-Lite), que custa um terço e não tem aumento anunciado,
a conta real tende a ficar abaixo disso.

### 4.4 O que o piloto vai medir

**O CRM já calcula** (basta ligar o piloto): taxa de conversão, ticket médio, ritmo de
meta, previsão ponderada, perdas por motivo, dias parados em proposta, negociações
esfriando, clientes 30+ dias sem contato e visitas realizadas por semana.

**Precisa ser construído** (entra na implantação):

- **Tempo até a primeira resposta** ao cliente. Hoje não é calculado.
- **Quantas negociações a IA abriu sozinha, e quanto isso soma em reais.** O dado já é
  gravado, mas nenhuma tela mostra.
- **Quantas conversas de venda viraram negociação.** Hoje não é calculado; é o critério 3
  do piloto (seção 10).

O slide que fecha a reunião depois do piloto: *"o CRM abriu N negociações sozinho, a
partir da conversa, somando R$ X no funil, ao custo de R$ Y por mês."*

**O que o piloto não prova.** O piloto não mede venda a mais. No ritmo do ponto de
equilíbrio (cerca de 6 retroescavadeiras por ano em cerca de 26 vendedores), 3 vendedores
em 60 dias precisariam vender cerca de 0,1 máquina a mais: pouco demais para aparecer em
dois meses. O piloto prova o que vem antes da venda: negociação registrada, cliente
retomado e perda com motivo. A conta das retroescavadeiras só se confere com o faturamento
do time ao longo do primeiro ano, e é esse número que volta a esta mesa.

## 5. Custos

### 5.1 Hoje: R$ 0 — e por que não pode continuar assim

O CRM roda em planos gratuitos. Para uma pessoa testando, serviu. Para uma empresa,
não serve, por três motivos com fonte:

1. **A hospedagem gratuita proíbe uso comercial.** A documentação oficial da Vercel diz
   que o plano Hobby é só para uso pessoal e não comercial.
2. **O banco gratuito desliga quando a cota acaba, e desligou.** O plano grátis do Neon dá
   100 horas de computação por mês. Esgotada a cota, o banco é **suspenso até o próximo
   ciclo**. Foi o que aconteceu em 23/09/2026. O consumo que causou isso já foi corrigido,
   mas o limite continua: um time usando o CRM o dia todo mantém o banco acordado a maior
   parte do dia, e isso sozinho já encosta nas 100 horas.
3. **A IA gratuita não aguenta um time e usa os dados dos clientes.** Mesmo no modelo mais
   econômico, a cota grátis é de cerca de **500 análises por dia para o CRM inteiro**
   (setembro de 2026). Cerca de 26 vendedores com cerca de 40 análises por dia cada
   (Apêndice B) fazem cerca de 1.040: o dobro da cota. E, no nível gratuito, **o Google usa as conversas para treinar os modelos**.
   Com dado de cliente, isso pesa contra (LGPD). No pago, não usa.

### 5.2 Custo operacional por tamanho de time

| Item | 1 vendedor | 6 vendedores (linha amarela) | cerca de 26 vendedores (time todo) |
|---|---:|---:|---:|
| Hospedagem (Vercel Pro) | R$ 103 | R$ 103 | R$ 103 |
| Banco de dados (Neon, por uso) | R$ 35 | R$ 121 | R$ 548 |
| Inteligência artificial do CRM (Gemini, por uso) | R$ 78 | R$ 465 | R$ 2.016 |
| WhatsApp oficial (Meta, por mensagem) | R$ 142 | R$ 852 | R$ 3.691 |
| Domínio próprio (.com.br) | R$ 3 | R$ 3 | R$ 3 |
| Ferramenta de manutenção (Claude Max) | R$ 535 | R$ 535 | R$ 535 |
| **Total por mês** | **R$ 896** | **R$ 2.079** | **R$ 6.896** |
| **Total por ano** | **R$ 10.752** | **R$ 24.948** | **R$ 82.752** |

A **ferramenta de manutenção** é a IA com que o CRM é corrigido, atualizado e testado.
Ela não roda dentro do CRM. É custo fixo: não muda com o tamanho do time.

A linha de IA do CRM usa o preço do Flash, por segurança. Na leitura das conversas, o CRM
já chama primeiro o modelo econômico (Flash-Lite), a um terço do preço.

**O que faz esse número subir ou descer:**

| Cenário | 1 vendedor | 6 vendedores | cerca de 26 vendedores |
|---|---:|---:|---:|
| Sem campanha de marketing no WhatsApp | R$ 767 | R$ 1.307 | R$ 3.551 |
| IA toda no Flash com o preço de 2027 (o Google dobra em 01/01/2027) | R$ 973 | R$ 2.545 | R$ 8.913 |
| IA toda no modelo econômico (Flash-Lite) | R$ 846 | R$ 1.785 | R$ 5.619 |

A maior linha é a **campanha de marketing no WhatsApp**: R$ 0,32 por mensagem entregue.
Ela é **decisão da gestão**, mês a mês. As premissas de cada linha estão no Apêndice B.

### 5.3 De onde vem cada preço

| Item | Preço | Observação |
|---|---|---|
| Vercel Pro | US$ 20/mês | Um assento só: quem publica o sistema. Os vendedores usam o CRM e não contam como assento. Inclui US$ 20 de uso. |
| Neon Launch | US$ 0,106 por hora de computação + US$ 0,35 por GB/mês | **Sem mensalidade mínima** desde dez/2025. Restauração de até 7 dias disponível, cobrada à parte (US$ 0,20 por GB/mês, centavos no tamanho do CRM). Sem SLA (só no plano Scale). |
| Gemini 3.8 Flash (pago) | US$ 0,75 por 1 milhão de tokens de entrada e US$ 3,75 de saída | Preço de lançamento até 31/12/2026. **Dobra em 01/01/2027.** No pago, os dados não treinam o modelo. |
| WhatsApp oficial — marketing | R$ 0,3217 por mensagem entregue | Cobrança em reais desde 01/07/2026. Sem desconto por volume. |
| WhatsApp oficial — utilidade | R$ 0,035 por mensagem | Confirmação de visita, proposta enviada. |
| WhatsApp oficial — resposta ao cliente | Grátis até 1.000 por mês por número; depois R$ 0,035 | **Regra nova a partir de 01/10/2026.** A franquia é por número, então um número por vendedor multiplica a franquia. |
| Domínio .com.br | cerca de R$ 40/ano | A confirmar no Registro.br. |
| Claude Max (ferramenta de manutenção) | US$ 100/mês + IOF | Plano com 5 vezes o uso do Pro. O Pro custa US$ 20/mês, com um quinto do uso. Preço conferido na página oficial em 27/09/2026, sem impostos. |

### 5.4 WhatsApp: oficial ou não-oficial

| | Não-oficial (o que o CRM usa hoje) | Oficial (API da Meta) |
|---|---|---|
| Custo | Servidor próprio: cerca de R$ 55/mês para o time inteiro | Por mensagem (tabela acima): cerca de R$ 142/mês por vendedor |
| Bloqueio | **Já bloqueou duas vezes.** Com cerca de 26 vendedores, vira rotina. É contra os termos do WhatsApp. | Canal autorizado pela Meta. Não há risco de bloqueio por conexão não-oficial. |
| De quem é o número | Do celular do vendedor | **Da empresa.** Vendedor que sai não leva a carteira. |
| O que precisa | Nada (já funciona) | Verificação da concessionária na Meta, números da empresa e integração no CRM (seção 8) |

**Recomendação:** não-oficial só até o oficial entrar (fase 2 da seção 10), com as travas
que o CRM já tem (80 mensagens por dia, horário comercial, só para quem já conversou,
"responda SAIR"). O piloto e o time usam o **oficial**, que já está na implantação do
piloto (seção 7). Levar à diretoria uma proposta em cima de conexão não-oficial
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
- **Variação do câmbio.** Hospedagem, banco, IA e a ferramenta de manutenção são cobrados em
  dólar. A cada R$ 0,50 de alta do dólar, o total de cerca de 26 vendedores sobe cerca de
  R$ 310/mês.

## 6. Comparação com o mercado

Preço por mês para **26 usuários**, sem as tarifas de mensagem da Meta, que valem para
qualquer sistema que use o WhatsApp oficial:

| CRM | Por mês (26 usuários) | WhatsApp |
|---|---:|---|
| Moskit Professional | R$ 3.874 | Sincronização incluída |
| Agendor Performance + Agendor Chat | R$ 4.609 | Caixa de WhatsApp paga à parte |
| Pipedrive Growth | cerca de R$ 6.587 (US$ 49 por usuário) | Integração em beta |
| RD Station CRM Pro + RD Conversas Pro | R$ 6.105 (+ implantação opcional de R$ 5.798) | API oficial |
| HubSpot Sales Professional | cerca de R$ 13.442 (US$ 100) + onboarding de US$ 1.500 | Não verificado |
| Salesforce Pro Suite | cerca de R$ 13.442 (US$ 100, contrato anual) | Não verificado |
| **Este CRM: operação e ferramenta de manutenção** | **R$ 3.205** | API oficial |
| **Este CRM: tudo (operação, ferramenta, licença e manutenção)** | **R$ 8.845** | API oficial |

**A comparação justa.** Os CRMs de prateleira organizam o funil. Este CRM fica **acima do
pacote completo do RD Station** e **cerca de um terço abaixo de HubSpot e Salesforce**, e traz o
que é do nosso negócio:

- a leitura da conversa de WhatsApp que abre a negociação sozinha;
- fichas técnicas e comparativo da linha amarela New Holland e da Dynapac;
- conta de diesel, custo por hora e TCO na proposta;
- comissão com a regra do CRD PME;
- licitações das prefeituras da região;
- uma Academia com as etapas da venda de máquina pesada.

Os mais baratos (Moskit e Agendor) custam menos e não trazem nada do que é específico de
máquina New Holland e Dynapac.

*Os preços desta seção não passaram pela segunda checagem (Apêndice A). Conferir nos links antes da reunião.*

## 7. Proposta

| Item | Preço de tabela | Para a casa (cliente fundador) |
|---|---:|---:|
| Implantação para o piloto: multiusuário e painel do gerente, WhatsApp oficial, proteções (teto de gasto de IA, backup, aviso de queda), números do piloto e treinamento (100 h) | R$ 10.000 | **R$ 7.000** |
| Implantação para o time: linha agrícola, modo sem sinal e treinamento da agrícola (90 h). **Só se o piloto aprovar.** | R$ 9.000 | **R$ 6.300** |
| Licença por vendedor | R$ 200/mês | **R$ 140/mês** |
| Manutenção: correções, suporte e ajustes pequenos (20 h por mês) | R$ 2.000/mês | **R$ 2.000/mês** |

O desconto de cliente fundador (30%) vale para a licença e a implantação. A manutenção
não tem desconto porque é hora trabalhada. **Licença e manutenção começam quando o time
entra (fase 4 da seção 10).** No piloto, a empresa paga só a operação e a implantação.

Para os **cerca de 26 vendedores**:

- Licença e manutenção: R$ 5.640/mês.
- Com a operação e a ferramenta de manutenção (seção 5.2): **R$ 12.536/mês**.
- Primeiro ano completo: **R$ 163.732**.

**Como os valores foram estimados:**

- **Implantação e manutenção, por hora**, a R$ 100. Horas previstas para o piloto:
  multiusuário e painel do gerente 30 h (a separação por vendedor já está construída e
  testada), WhatsApp oficial 40 h, proteções e números do piloto 20 h, treinamento 10 h.
  Para o time: linha agrícola 40 h, modo sem sinal 40 h e treinamento da agrícola 10 h.
  Manutenção: 20 h por mês para cerca de 26 usuários.
- **Licença, pelo mercado.** Um CRM de mercado para 26 usuários custa de R$ 149 a R$ 517
  por usuário por mês, já com hospedagem e suporte (seção 6). Na mesma base (sem as
  mensagens da Meta), este CRM sai por cerca de R$ 340 por usuário com o desconto de cliente
  fundador (R$ 8.845 ÷ 26) e cerca de R$ 400 a preço de tabela: dentro da faixa, acima de
  Moskit, Agendor, Pipedrive e RD Station, abaixo de HubSpot e Salesforce.
- **Licença, pelo valor.** A licença do time inteiro no ano (26 × R$ 140 × 12 = R$ 43.680)
  custa menos que a margem de **duas** retroescavadeiras (R$ 59.200).

**Como funcionaria a licença (proposta; o acordo final passa por advogado):**

- **O que propomos: o sistema fica com quem o construiu, e o dado é da empresa.** A
  concessionária usaria por licença. Nome, telefone, conversa e histórico dos clientes são dela, e ela sai com
  eles quando quiser. O CRM já exporta clientes, negociações, visitas, mensagens e
  pós-venda em planilha.
- **A licença não é exclusiva.** O sistema continua do autor, que pode licenciá-lo a
  outras empresas. Os dados de uma empresa nunca ficam visíveis para outra.
- **LGPD.** A empresa é a controladora dos dados dos clientes. Quem mantém o sistema é o
  operador. Isso vai escrito no acordo.
- **Em nome de quem ficam as contas.** A conta Meta e os números de WhatsApp ficam **no nome
  da concessionária**: a Meta exige a verificação da empresa, e é isso que faz o número ser da
  casa. Hospedagem, banco, IA e a ferramenta de manutenção ficam no nome de quem mantém o
  sistema, e a empresa paga o custo operacional por repasse. Essa divisão é a que torna a
  licença real.
- **O acordo diz:** quantos usuários a licença cobre, o prazo e o reajuste, o que a
  manutenção inclui (correção sim; tela nova grande é escopo à parte) e o que acontece
  ao encerrar. Quem redige é advogado.

## 8. O que ainda não existe — e entra na implantação

Para a diretoria saber exatamente o que está comprando:

| Falta | Por que importa | Estado |
|---|---|---|
| **Um acesso por vendedor** (cada um vê só a sua carteira) | Hoje o CRM é de uma pessoa, com uma senha só | Isolamento construído e testado; foi retirado em 23/09 e volta em duas etapas (seção 10) |
| **Visão do gerente** (funil do time, comparação entre vendedores) | Sem ela, o objetivo 3 não acontece | A fazer |
| **WhatsApp oficial, um número por vendedor** | Tira o risco de bloqueio e deixa o número com a empresa | A fazer |
| **Linha agrícola** (a IA reconhecer tratores, colheitadeiras e implementos na conversa e no Orientador; fichas e comparativo agrícolas; crédito rural; calendário de safra) | A maior parte do time (cerca de 20 vendedores) é da agrícola, e hoje a leitura da conversa, as fichas e o comparativo são só da linha amarela | A fazer, depois do piloto |
| **Modo sem sinal** (ver carteira, fichas e agenda; registrar visita e anotação sem internet; enviar quando o sinal volta) | Na fazenda e na obra o celular fica sem sinal | Hoje o CRM mostra, no máximo, a última versão das telas já abertas no aparelho, e não grava nada sem internet. A fazer |
| **Backup automático fora do banco** | Hoje só há a exportação manual; a restauração de 7 dias vem com o plano pago | A fazer, na implantação do piloto |
| **Aviso de queda fora do CRM** | Quando o banco caiu em 23/09, nada avisou de fora | A fazer, na implantação do piloto |
| **Teto de gasto de IA por vendedor** | A análise feita a cada mensagem não tem limite diário. Com IA paga, precisa ter antes de ligar. | A fazer, na implantação do piloto |
| **Os números do piloto** (tempo até a 1ª resposta, negociações abertas pela IA, conversas que viraram negociação) | São as provas do piloto (seção 4.4) | A fazer, na implantação do piloto |
| **Integração com o sistema da concessionária e com o Banco CNH** | Hoje o faturamento é marcado à mão no CRM | Fora do escopo desta proposta |

## 9. Riscos e como são tratados

| Risco | Já aconteceu? | Como fica tratado |
|---|---|---|
| **WhatsApp bloqueado** | Sim, duas vezes (conexão não-oficial e disparo em massa) | API oficial para o time. Travas de envio já no CRM: 80 por dia, horário comercial, só para quem já conversou, "SAIR". Trava geral que nasce pausada. |
| **CRM fora do ar por plano grátis** | Sim, em 23/09/2026 (banco suspenso por cota) | O consumo que esgotou a cota foi corrigido em 24/09: as telas não consultam mais o banco com a aba escondida, e a manutenção não se repete a cada tela. O CRM já diz na tela o motivo quando o banco cai, tenta um segundo endereço sozinho e se recompõe num banco novo (foi assim que voltou ao ar no mesmo dia, num banco temporário, mas sem o histórico: os dados ficaram guardados, intactos, no banco suspenso até o próximo ciclo). Com o plano pago, não há suspensão por cota: consumo fora do normal vira cobrança, acompanhada no painel do Neon desde o primeiro mês. |
| **O Google desligar o modelo de IA** | Anunciado para o modelo usado até 24/09 (desligamento em 16 a 20/10/2026) | **Já tratado em 24/09:** o CRM trocou de modelo e passou a usar uma lista. Se um modelo sai do ar, o próximo assume sozinho. |
| **Preço da IA dobra em 2027** | Anunciado para o Flash (01/01/2027) | Já calculado nas seções 4.3 e 5.2, que usam o preço do Flash por segurança. Na leitura das conversas, o CRM já chama primeiro o modelo econômico (Flash-Lite), a um terço do preço. |
| **Dependência de uma pessoa** | — | É real: uma pessoa mantém o sistema, e o sistema fica com ela (seção 7). O que reduz o risco: os dados saem em planilha a qualquer momento, os números de WhatsApp oficiais são da empresa, e o acordo define o prazo de correção e o que acontece se o autor não puder mais manter o sistema (a decidir com advogado). |
| **Dado de cliente (LGPD)** | — | IA paga (não usa os dados para treino), acordo com os papéis de controlador e operador, exportação completa a qualquer momento. |
| **Câmbio** | — | Quase metade do custo operacional é em dólar. Sensibilidade na seção 5.5. |

## 10. Plano de implantação

| Fase | O que acontece | Prazo | Custo mensal a partir daí |
|---|---|---|---|
| **0. Sair do grátis** | Vercel Pro, Neon pago, Gemini pago, ferramenta de manutenção | 1 semana | R$ 754 (1 vendedor, ainda no WhatsApp atual) |
| **1. Um acesso por vendedor** | Login por pessoa, cada um vê só a sua carteira, painel do gerente. Entra em **duas etapas**: primeiro a estrutura no banco, depois o código. | 2 a 3 semanas | igual |
| **2. WhatsApp oficial** | Verificação da concessionária na Meta, números da empresa, modelos de mensagem aprovados, integração no CRM | 3 a 4 semanas (depende da Meta) | + R$ 142 por vendedor |
| **3. Piloto** | 2 ou 3 vendedores **da linha amarela** por 60 dias, medindo a seção 4.4. A linha amarela vai primeiro porque o CRM já conhece essa linha. | 60 dias | até R$ 2.079 (a coluna de 6 vendedores da seção 5.2 é o teto para 2 ou 3) |
| **4. Linha amarela inteira** | Treinamento e entrada dos 6 vendedores | conforme o piloto | seção 5.2, coluna de 6 |
| **5. Linha agrícola** | A IA reconhecer as máquinas agrícolas na conversa e no Orientador, fichas e comparativo agrícolas, crédito rural, calendário de safra, modo sem sinal, treinamento e entrada dos cerca de 20 vendedores | 4 a 6 semanas | seção 5.2, coluna do time todo |

**Lição que já está no processo:** mudança na estrutura do banco sobe em duas etapas e é
testada contra o banco antigo antes de publicar. Em 23/09 uma mudança dessas subiu de uma
vez e derrubou o CRM.

### Critério para seguir, definido ANTES do piloto

Proposta, para a diretoria ajustar e aprovar junto com o piloto. O piloto segue para o
time se, ao fim dos 60 dias, **os vendedores do piloto** tiverem:

1. **100% das vendas perdidas com motivo** registrado;
2. **negociações esfriando** (10+ dias sem contato) **caindo pela metade** em relação ao
   primeiro mês;
3. **a maioria das conversas de venda do WhatsApp registrada como negociação**, medida pelo
   painel da seção 4.4;
4. **os próprios vendedores querendo continuar**. Sem adesão de quem usa, nenhum número
   se sustenta.

### Se o piloto não provar

O CRM para no piloto. O que a empresa terá gastado até essa decisão: R$ 7.000 da
implantação do piloto; cerca de R$ 1.500 da fase 0 até o piloto começar (cerca de dois meses
a R$ 754); e, nos 60 dias de piloto, no máximo R$ 2.079 por mês de operação. **No total,
até cerca de R$ 12,7 mil.** Licença e manutenção não são cobradas no piloto. A implantação
para o time (linha agrícola e modo sem sinal) não é feita nem cobrada.
A empresa sai **com todos os dados em planilha**: clientes, negociações, visitas, mensagens
e pós-venda. Não há multa nem período mínimo.

## 11. Perguntas que a diretoria vai fazer

**"E se você sair da empresa?"**
Os dados são da concessionária e saem com ela a qualquer momento, em planilha. Os números
de WhatsApp são da empresa. O que fica com o autor é o código. O acordo precisa dizer o
que acontece com a licença nesse caso. *(Resposta sua: continuar mantendo de fora, ou
outra. Cuidado com "entregar o código": isso encerra a licença não exclusiva da seção 7.)*

**"Por que pagar licença a um funcionário?"**
Porque o sistema foi construído fora do escopo do cargo, com tempo e custo próprios, e
continua precisando de manutenção. Há CRM de mercado mais barato: o RD Station completo
sai por R$ 6.105/mês para 26 usuários, contra R$ 8.845 deste (seção 6). A diferença paga o
que nenhum deles traz: fichas e comparativo New Holland e Dynapac, conta de diesel e custo
total de propriedade (TCO), comissão com a regra do CRD PME e licitações das prefeituras da
região. *(Revise com as suas palavras.)*

**"Quem dá suporte quando você está na rua?"**
Correção de erro entra na manutenção (20 h por mês), com prazo combinado no acordo. O CRM
já avisa na tela quando algo cai, e diz o motivo. Na queda de 23/09, o CRM voltou a
funcionar no mesmo dia num banco temporário; o histórico ficou guardado, intacto, até o
banco suspenso ser liberado.

**"Os dados dos clientes estão seguros?"**
Acesso por senha, com bloqueio depois de 5 tentativas erradas. IA paga, que não usa as
conversas para treinar modelos. Exportação completa a qualquer momento. E, com o
multiusuário, cada vendedor vê só a própria carteira.

**"Por que não um CRM de mercado?"**
Seção 6: por menos que HubSpot e Salesforce, ele faz o que os de prateleira não fazem: lê
a conversa e abre a negociação, conhece a linha amarela New Holland e a Dynapac, e calcula diesel,
TCO e a comissão do CRD PME.

**"E a linha agrícola?"**
O funil, as conversas, a agenda e o pós-venda já servem à agrícola. Falta a IA reconhecer
as máquinas agrícolas na conversa e no Orientador, as fichas e o comparativo agrícolas, o
crédito rural, o calendário de safra e o modo sem sinal para a fazenda. Entram depois do
piloto, só se ele aprovar (seção 10, fase 5).

**"Por que a empresa paga a ferramenta de manutenção, se ela fica no seu nome?"**
Porque sem ela não há manutenção: é com ela que o CRM é corrigido, atualizado e testado.
São R$ 535/mês fixos, que não crescem com o time. *(Resposta sua. Decida antes o que
acontece com esse custo se o CRM for licenciado a outra empresa, já que a licença é não
exclusiva: é a pergunta seguinte.)*

## 12. O pedido

1. **Aprovar a fase 0 agora**: R$ 754/mês, para o CRM sair do plano gratuito e parar de
   depender da sorte. São R$ 219 de hospedagem, banco, IA e domínio (R$ 103 + R$ 35 + R$ 78
   + R$ 3) e R$ 535 da ferramenta de manutenção.
2. **Aprovar o piloto** de 60 dias com 2 ou 3 vendedores da linha amarela, com a
   implantação para o piloto (R$ 7.000). Se o piloto não provar, o gasto total para em
   cerca de R$ 12,7 mil.
3. **Voltar a esta mesa** com os números do piloto e decidir a entrada da linha amarela
   inteira e, depois, da agrícola.

---

## Apêndice A — Fontes dos preços

Levantamento de 24/09/2026. O acesso direto aos sites dos fornecedores estava bloqueado
no ambiente de pesquisa, então cada preço foi buscado em pelo menos duas fontes. Nos
grupos marcados "conferido", um segundo pesquisador refez a busca de forma independente
para tentar desmentir o valor. Nos marcados "sem 2ª checagem", a cota de buscas acabou
antes dela: os valores têm as fontes listadas, mas ninguém tentou desmenti-los.

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
| Gemini grátis: cerca de 500 requisições/dia no Flash-Lite e cerca de 20 no Flash; dados usados para treino | — | discuss.ai.google.dev (set/2026) · dev.to (medição de set/2026) |
| Gemini 2.5 Flash (modelo usado até 24/09): desligamento em 16 a 20/10/2026 | — | página de descontinuação do Gemini API e do Google Cloud (via agregadores de 2026) |
| Google AI Plus (assinatura de uso pessoal) | R$ 24,99/mês — **não dá cota de API** | blog.google/intl/pt-br · tecnoblog.net |

**Ferramenta de manutenção — conferido direto na página oficial (27/09/2026)**

| Item | Valor | Fontes |
|---|---|---|
| Claude Pro | US$ 20/mês (US$ 17/mês no plano anual) | claude.com/pricing |
| Claude Max | a partir de US$ 100/mês, com 5 ou 20 vezes o uso do Pro; preços sem impostos | claude.com/pricing |

**WhatsApp oficial — sem 2ª checagem**

| Item | Valor | Fontes |
|---|---|---|
| Marketing | US$ 0,0625 (R$ 0,3217 em contas em reais, desde 01/07/2026) | messagecentral.com · wiichat.com.br · mobiletime.com.br (01/07/2026) |
| Utilidade | US$ 0,0068 (R$ 0,035) | mobiletime.com.br · clickmassa.com.br |
| Serviço a partir de 01/10/2026 | 1.000 grátis por número por mês; depois US$ 0,0068 (R$ 0,035) | developers.facebook.com (non-template messages) · sendpulse.com/br · courier.com |
| Servidor para a conexão não-oficial (Hostinger KVM 2) | R$ 38,99 a R$ 42,99/mês promocional; média de R$ 54,66 em 3 anos | kildaryoliver.com.br · horadecodar.com.br · hostinger.com |

**CRMs de mercado — sem 2ª checagem**

| Item | Valor | Fontes |
|---|---|---|
| Moskit Professional | R$ 149/usuário (mensal) | moskitcrm.com (blog e planos) |
| Agendor Performance / Agendor Chat | R$ 83/usuário · Chat R$ 312 (3 usuários) + R$ 93 por usuário extra | agendor.com.br/planos-precos |
| RD Station CRM Pro / Conversas Pro | R$ 131/usuário (mínimo 4) · Conversas R$ 2.699/mês | rdstation.com/planos/crm · rdstation.com/planos/conversas |
| Pipedrive Growth | US$ 49/usuário (mensal) | pipedrive.com/en/pricing |
| HubSpot Sales Professional | US$ 100/licença + onboarding de US$ 1.500 (confiança baixa) | docket.io · marketbetter.ai |
| Salesforce Pro Suite | US$ 100/usuário (anual) | salesforce.com/br/small-business/pro-suite |

**Referências de ganho — sem 2ª checagem**

| Item | Valor | Fontes |
|---|---|---|
| Dólar comercial, 23/09/2026 | R$ 5,1689 | infomoney.com.br · otempo.com.br |
| Retroescavadeira nova (várias marcas; NH B95C 2025 perto de R$ 410–415 mil) | R$ 296 mil a R$ 415 mil | maquinalista.com (índice) · contrato público de Capão Bonito/SP (2025) |
| Escavadeira NH E215C: seminova 2024 (piso para a nova) | R$ 675 mil | mercadolivre.com.br · maquinalista.com |

## Apêndice B — Premissas das contas

| Linha | Premissa |
|---|---|
| Câmbio | R$ 5,17 (fechamento de 23/09/2026) |
| Time | Cerca de 26 vendedores: 6 da linha amarela e cerca de 20 da agrícola. O número da agrícola é aproximado; as contas usam 26. |
| Margem | Cerca de 10% por máquina, a margem de referência da casa |
| Banco (Neon) | 1 vendedor: 8 h/dia acordado a 0,25 CU e 1 GB. 6 vendedores: 14 h/dia a 0,5 CU e 3 GB. 26 vendedores: 16 h/dia a 2 CU e 12 GB. Estimativa; o consumo real aparece no painel do Neon no primeiro mês. |
| IA do CRM | Cerca de 1.000 análises por vendedor por mês (40 por dia útil × 22 dias = 880, mais 15% de outras chamadas ≈ 1.000). A conta usa o preço do Flash, por segurança. Cada análise: cerca de 10 mil tokens de entrada e 2 mil de saída, o tamanho da análise do Orientador. Resultado: US$ 0,015 por análise em 2026. |
| WhatsApp oficial | Por vendedor por mês: 1.300 respostas a clientes (300 acima da franquia grátis), 80 mensagens de utilidade e 400 de marketing. |
| Hospedagem | 1 assento Vercel (quem publica). O uso de cerca de 26 vendedores deve caber nos US$ 20 incluídos; se passar, o excedente é cobrado com alerta de gasto. |
| Ferramenta de manutenção | Claude Max 5x: US$ 100 × R$ 5,17, mais IOF de 3,5% do cartão internacional = R$ 535/mês. Custo fixo, não muda com o tamanho do time. |
| Proposta | Implantação e manutenção a R$ 100 por hora (100 h para o piloto, 90 h para o time, 20 h por mês de manutenção). Licença e manutenção começam na fase 4. Licença de R$ 200 de tabela. Desconto de cliente fundador de 30% na licença e na implantação. |
| Ponto de equilíbrio | Retroescavadeira nova a R$ 296 mil (piso da faixa) e margem de 10%. Custo do 1º ano para 26 vendedores = 12 × R$ 12.536 + R$ 13.300 = R$ 163.732. Com a IA toda no Flash no preço de 2027: 12 × R$ 14.553 + R$ 13.300 = R$ 187.936. |
