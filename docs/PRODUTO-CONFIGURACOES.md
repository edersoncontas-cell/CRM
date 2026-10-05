# CRM como produto — o que o vendedor pode e o que não pode mudar

Avaliação pedida em 05/10: *"se vamos vender o CRM como produto, preciso que
qualquer vendedor de qualquer estado do Brasil consiga fazer as suas próprias
configurações — deixando nas configurações tudo o que o vendedor pode ou não
modificar"*. No mesmo dia ele decidiu: **"pode ser então só ES"** — a área de
atuação saiu com o estado fixo no Espírito Santo. Este documento é o mapa para
abrir o resto quando ele quiser.

Regra para cada item: o que vira configuração precisa de um **padrão seguro**
(sem configurar, funciona como hoje) e de uma **tela que diga o que mudou**.
O que fica travado precisa aparecer em Configurações **com o motivo**, não
sumir — o vendedor tem que saber que existe e por que não mexe.

---

## 1. Já é configurável hoje

| O quê | Onde |
|---|---|
| Nome do CRM, nome do vendedor, empresa, marcas, região (texto para a IA), comissão, metas | Configurações → Parâmetros do negócio (`lib/parametros.ts`) |
| **Municípios que atende** (05/10) — mapa, cidades de Visitas, licitações, "para todos", cidades que a IA grava | Configurações → Área de atuação (`lib/area-atuacao*.ts`) — **estado fixo no ES** |
| Palavras que bloqueiam contato | Configurações → Contatos que não são clientes |
| Itens do menu (por aparelho) | Configurações → Visibilidade do menu |
| Tema claro/escuro | sol/lua no canto |
| Regras do negócio que a IA respeita | Central Inteligente → "A realidade do seu negócio" |
| Liberar IA paga (nasce travada) | `/zeus` |
| Google (agenda e contatos) | Configurações → Google |

## 2. Pode virar configuração (o vendedor muda)

Tamanho: **P** = um dia, **M** = alguns dias, **G** = uma semana ou mais.

### Território
- **Outros estados** — **M**. A base do IBGE do Brasil inteiro, o mapa, as
  licitações por estado, o nome repetido entre estados ("Viana (MA)") e a
  agenda do Google **já estão prontos**. Falta: trocar os textos da IA que
  dizem "a cidade é do ES; outra é erro de leitura" (`lib/ai/index.ts`
  `schemaInstrucao`, `lib/zeus/orientador-prompt.ts`,
  `lib/zeus/orientador-incremental.ts`) e os "sul do ES" soltos (Cérebro,
  prospecção, Academia, resposta rápida, resumo de contato). Depois disso, pôr
  a UF em `UFS_LIBERADAS` (`lib/area-atuacao-regra.ts`). **Sem trocar os
  textos, a IA jogaria fora toda cidade de outro estado** — por isso a trava.
- **Agrupamento de regiões** (Caparaó, Granito, Serrana…) — **M**. Hoje fixo em
  `lib/regioes.ts`; viraria "grupos de cidades" na Área de atuação.
- **Notícias e letreiro** — **P/M**. As buscas citam "Espírito Santo" e o café
  conilon do ES (`lib/noticias.ts`, `lib/cafe-es.ts`, `lib/ticker-fita.ts`).
  Configurável: estado das notícias e quais cotações aparecem (café, dólar,
  soja, boi…).

### Marcas e catálogo
- **Marcas que vende** — **G**. Hoje só New Holland e Dynapac são aceitas
  (`MARCAS_VALIDAS` em `lib/orientador-fatos.ts`) e os prompts falam delas por
  extenso. O campo "marcas" de Parâmetros já existe, mas só entra em parte dos
  textos.
- **Catálogo de máquinas** — **G**. Não há tela para criar/apagar máquina; o
  catálogo nasce das sementes NH/Dynapac (`seed-core`, `dynapac-catalogo`,
  `maquinas-garantidas`, `fichas-verificadas`).

### Processo de venda
- **Bancos e condições de financiamento** — **M**. Fixos em
  `FormNovaNegociacao` (BANCOS, CRD PME, consórcio New Holland).
- **Motivos de perda, segmentos de cliente, faixas do lead score, marcos do
  pós-venda** — **M** cada.
- **Compromisso fixo da semana** ("REUNIÃO PME VITÓRIA" toda segunda) — **P**.
  Fixo em Visitas e no calendário.
- **Academia** (trilha m1–m10 cita "Edy", NH e ES) — **G**: precisa de
  conteúdo novo, não só de troca de nome.

### Identidade
- **Logo, ícone e cores** — **M**. "CRM DO EDY" no `manifest.json`, abertura,
  login, rodapé do menu ("Vendas com IA · Sul do ES"), título do push
  ("CRM Edy"), ícone de escavadeira e o amarelo NH.
- **Telefone dele no código** (`28999798168` em `telefone-valido`,
  `google-contatos-util`, `actions.ts`, `ImportarClientes`) — **P**: vira o
  telefone do vendedor em Parâmetros.

### Fuso
- **Fuso horário** — **G**. "America/Sao_Paulo" e "-03:00" aparecem em ~130
  lugares. Só importa para quem estiver no Acre, Amazonas, Mato Grosso etc.

## 3. Fica travado (o vendedor não muda) — e por quê

| Trava | Por que não |
|---|---|
| **Pausa geral do WhatsApp** (`lib/whatsapp-pausa.ts`) | Nasce pausada e só libera com a palavra exata. Foi a falta dela que bloqueou o número duas vezes. |
| **Rodapé "responda SAIR" e o descadastro** | Proteção do número e exigência de opt-out. |
| **Teto diário, janela e ritmo do envio** (`lib/envio-limites.ts`) | Se um dia virar tela, só **dentro de limites** (mínimo e máximo travados no código). |
| **IA paga** (`IA_SOMENTE_GRATUITOS`) | Nasce travada; liberar é decisão consciente, com o custo na cara. |
| **Teto diário da análise** (`ORIENTADOR_TETO_DIARIO`) | Evita fatura e cota estourada. |
| **Chaves de API, banco, Evolution, Google** | Credencial: nunca aparece por extenso nem em log. Fica no ambiente, não na tela. |
| **Senha de manutenção e do conserto automático** (`CHAVE_MANUTENCAO`, `ZEUS_AUTOFIX_TOKEN`) | Controle de quem mantém o CRM, não do vendedor. |
| **Data de corte das conversas antigas** (`whatsapp-corte.ts`) | Apaga conversa. Numa instalação nova, a data padrão precisa ser a do dia da instalação — conserto a fazer antes de vender. |
| **Apagar contato por palavra bloqueada** | As palavras ele escolhe; a regra de nunca apagar quem tem negociação/visita/compra não. |

## 4. Antes de vender: armadilhas de instalação nova

Coisas que hoje são do Edy e **machucariam** outro vendedor se ficassem como
estão:

1. `DATA_CORTE_INICIAL` (16/09/2026) apagaria as conversas anteriores de quem
   instalar depois.
2. Palavras de bloqueio padrão incluem `cnh`, `bcnh` e `banestes`.
3. A regra de negócio padrão (`contexto-negocio.ts`) é a dele.
4. A manutenção `reestruturarFunilOportunidade` refaz as colunas do funil dele
   e desfaria um funil renomeado.
5. "Cliente Cristiano / Cliente Welligton" e Alfredo Chaves nascem em todo
   banco (`lib/regioes.ts`).

## 5. Ordem sugerida

1. **Instalação limpa** (item 4) — sem isso, nada do resto adianta.
2. **Identidade + telefone** (logo, nome, cores) — o que o comprador vê primeiro.
3. **Outros estados** — trocar os textos da IA e abrir `UFS_LIBERADAS`.
4. **Processo de venda** — bancos, motivos de perda, compromisso fixo.
5. **Marcas e catálogo** — o maior; é o que abre a porta da fábrica (CNH).
6. **Multiusuário** (já planejado em `docs/CONTINUAR.md`) — vem antes de
   vender para equipe; para vendedor sozinho, não.

Nada disso gera custo novo: é trabalho de código, não serviço pago.
