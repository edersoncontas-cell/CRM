# Mapa por região (Dashboard e Visitas)

Pedido dele (23/10/2026), com a foto do **Mapa do Turismo Capixaba 2025**
(Secretaria de Turismo do ES, atualizado em 27/05/2025): os mapas do CRM mostram
as **divisas entre as cidades**; as que ele atende saem **coloridas** (a cor da
região, como na foto) e as que não atende saem **cinza**.

## Onde está

| Peça | Arquivo |
|---|---|
| Desenho das divisas dos 78 municípios | `src/lib/malha-es.json` (gerado por `scripts/gerar-malha-es.py`) |
| Regiões, cores e regra de cor (puro, sem banco) | `src/lib/mapa-regioes-es.ts` |
| Quem ele atende (vai no `MapaDaArea.atendidos`) | `mapaDaArea()` em `src/lib/area-atuacao.ts` |
| Camada no Leaflet | `src/components/CamadaMunicipiosES.tsx` |
| Legenda embaixo do mapa | `src/components/LegendaMapaRegioes.tsx` |
| Testes | `tests/mapa-regioes-es.test.ts` |

## Como decide a cor

- **Atende** = município marcado em Configurações → Área de atuação. Sem área
  salva, vale a marca `foraDeArea = false` do banco (a mesma que as listas
  "Cidades que atendo" já usam). O nome casa sem acento e sem diferença de caixa.
- Atende → cor da região (10 regiões da foto). Não atende → cinza `#9ca3af`.
- A foto tem também um cinza ("Município não integrante": 8 cidades que não
  fazem parte de nenhuma região turística). **Aqui cinza quer dizer "não atendo"**,
  então essas cidades, quando ele as atende, saem em **lilás** (`SEM_REGIAO`) e
  a legenda diz "Fora das regiões turísticas".
- Não deu para ler a lista (banco sem resposta): `atendidos = null`, o mapa fica só
  com as divisas, sem cinza (cinza diria "não atendo" sobre o que o CRM não sabe)
  e a legenda avisa.
- Nenhuma cidade marcada: tudo cinza e a legenda manda para Configurações.

## Se ele quiser outro agrupamento

Só uma tabela: `MUNICIPIOS_POR_REGIAO` + `REGIOES_TURISTICAS` em
`src/lib/mapa-regioes-es.ts`. O teste trava os 78 municípios, cada um em uma só
região. Alternativas já existentes no CRM: as 5 regiões de rota dele
(`REGIOES_MUNICIPIOS` em `src/lib/regioes.ts`: Caparaó, Litorânea, Granito,
Serrana, Das Santas) e as 10 regiões de planejamento (A Gazeta / Secretaria de
Economia e Planejamento).

## De onde veio

- **Cores e agrupamento**: lidos da foto. Cada município foi conferido pela **cor
  do pixel** no rótulo (a leitura a olho errou o Bom Jesus do Norte, que é cinza
  na foto). Contagem por região: 5 · 7 · 5 · 8 · 8 · 7 · 8 · 6 · 11 · 5 + 8 sem região = 78.
- **Divisas**: malha municipal do IBGE (qualidade mínima) em GeoJSON do
  repositório público `tbrugz/geodata-br`, coordenadas arredondadas a 4 casas
  (~11 m). Vai junto com o código: não depende de internet nem de serviço de
  terceiro (só os azulejos do OpenStreetMap por baixo precisam de sinal).
- Outro estado (quando for liberado em `UFS_LIBERADAS`): sem divisas no código,
  o mapa continua só com o contorno do estado vindo do IBGE (`UFS_COM_MALHA`).
