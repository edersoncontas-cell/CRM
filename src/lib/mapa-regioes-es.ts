// O MAPA POR REGIÃO — divisas entre as cidades, colorido onde ele atende e
// cinza onde não atende. Puro (sem banco): os mapas "use client" importam daqui.
//
// 23/10, pedido dele (com a foto do "Mapa do Turismo Capixaba 2025"): "o mapa
// com as divisões entre as cidades, as que eu atendo coloridas como no anexo, as
// que eu não atendo cinza". As cores e o agrupamento são os da foto (Secretaria
// de Turismo do ES, atualizado em 27/05/2025): 10 regiões turísticas. Cada
// município foi lido da foto e conferido pela COR do pixel — a leitura a olho
// errou o Bom Jesus do Norte (é cinza na foto), a amostragem pegou. O teste
// (tests/mapa-regioes-es.test.ts) trava a tabela: os 78 municípios, cada um em
// uma região só, as contagens da foto.
//
// Atenção ao nome: no CRM "cinza" quer dizer NÃO ATENDO. Na foto existe também
// um cinza ("Município não integrante" — cidade que não faz parte de nenhuma
// região turística). Essas cidades, QUANDO ELE AS ATENDE, ganham uma cor própria
// (SEM_REGIAO) para não se confundirem com as que ele não atende.
//
// O desenho das divisas está em malha-es.json (scripts/gerar-malha-es.py).

import { semAcento } from "@/lib/area-atuacao-regra";

export type RegiaoTuristica = { id: string; nome: string; cor: string };

/** Na ordem da legenda da foto. As cores são as da própria foto (amostradas da imagem). */
export const REGIOES_TURISTICAS: readonly RegiaoTuristica[] = [
  { id: "terra-morena", nome: "Doce Terra Morena", cor: "#c99e66" },
  { id: "verde-aguas", nome: "Do Verde e das Águas", cor: "#efcf36" },
  { id: "noroeste", nome: "Caminhos do Café, Pedras e Cachoeiras (Noroeste)", cor: "#a1cc7b" },
  { id: "pontoes", nome: "Doce Pontões Capixaba", cor: "#f39200" },
  { id: "imigrantes", nome: "Imigrantes", cor: "#ffdc0e" },
  { id: "metropolitana", nome: "Metropolitana", cor: "#f9ba74" },
  { id: "montanhas", nome: "Montanhas Capixabas", cor: "#f7c8df" },
  { id: "costa", nome: "Costa e Imigração", cor: "#8bd1f3" },
  { id: "caparao", nome: "Caparaó Capixaba", cor: "#77c6bc" },
  { id: "sul", nome: "Sul Capixaba dos Vales e Café", cor: "#d89479" },
];

/** Cidade que ele atende mas que a foto deixa fora de qualquer região (cinza na foto). */
export const SEM_REGIAO: RegiaoTuristica = { id: "sem-regiao", nome: "Fora das regiões turísticas", cor: "#a78bfa" };

/** Cidade que ele NÃO atende: cinza escuro (pedido dele, 23/10 — o claro de antes se perdia no fundo do mapa). */
export const COR_NAO_ATENDO = "#555c68";

/** A divisa entre as cidades: preta (pedido dele, 23/10). */
export const COR_DIVISA = "#000000";

/** Quem está em cada região. A que não aparece aqui é SEM_REGIAO. */
const MUNICIPIOS_POR_REGIAO: Record<string, string[]> = {
  "terra-morena": ["Mucurici", "Montanha", "Ponto Belo", "Pedro Canário", "Pinheiros"],
  "verde-aguas": ["Conceição da Barra", "São Mateus", "Jaguaré", "Sooretama", "Rio Bananal", "Linhares", "Aracruz"],
  noroeste: ["Ecoporanga", "Barra de São Francisco", "Nova Venécia", "Boa Esperança", "São Gabriel da Palha"],
  pontoes: ["Mantenópolis", "Águia Branca", "Pancas", "São Domingos do Norte", "Governador Lindenberg", "Marilândia", "Colatina", "Baixo Guandu"],
  imigrantes: ["Itaguaçu", "São Roque do Canaã", "João Neiva", "Ibiraçu", "Santa Teresa", "Itarana", "Santa Maria de Jetibá", "Santa Leopoldina"],
  metropolitana: ["Fundão", "Serra", "Vitória", "Cariacica", "Viana", "Vila Velha", "Guarapari"],
  montanhas: ["Laranja da Terra", "Afonso Cláudio", "Brejetuba", "Venda Nova do Imigrante", "Domingos Martins", "Castelo", "Alfredo Chaves", "Vargem Alta"],
  costa: ["Anchieta", "Iconha", "Rio Novo do Sul", "Piúma", "Itapemirim", "Marataízes"],
  caparao: [
    "Ibatiba", "Irupi", "Iúna", "Muniz Freire", "Ibitirama", "Divino de São Lourenço", "Dores do Rio Preto", "Alegre", "Guaçuí",
    "São José do Calçado", "Jerônimo Monteiro",
  ],
  sul: ["Cachoeiro de Itapemirim", "Muqui", "Atílio Vivácqua", "Mimoso do Sul", "Apiacá"],
};

/** Os que a foto deixa em cinza ("Município não integrante"). */
export const MUNICIPIOS_SEM_REGIAO: readonly string[] = [
  "Água Doce do Norte", "Vila Pavão", "Vila Valério", "Alto Rio Novo", "Conceição do Castelo", "Marechal Floriano", "Bom Jesus do Norte", "Presidente Kennedy",
];

/** A mesma regra de nome em todo lugar: sem acento, minúsculo, "UF:nome". */
export const chaveMunicipio = (uf: string, nome: string): string => `${uf}:${semAcento(nome)}`;

/** Estados cujas divisas vão junto com o código (os outros seguem só com o contorno do estado). */
export const UFS_COM_MALHA: readonly string[] = ["ES"];

const REGIAO_POR_NOME = new Map<string, RegiaoTuristica>();
for (const r of REGIOES_TURISTICAS) for (const n of MUNICIPIOS_POR_REGIAO[r.id] ?? []) REGIAO_POR_NOME.set(semAcento(n), r);

export const regiaoDoMunicipio = (nome: string): RegiaoTuristica => REGIAO_POR_NOME.get(semAcento(nome)) ?? SEM_REGIAO;

/** Município por região, para o teste conferir contra a foto. */
export const municipiosDaRegiao = (id: string): string[] => MUNICIPIOS_POR_REGIAO[id] ?? [];

export type EstiloMunicipio = { fillColor: string; fillOpacity: number; color: string; weight: number; opacity: number };

/** Espessura da divisa preta entre as cidades. */
export const ESPESSURA_DIVISA = 1.2;

/**
 * `atendidos` = chaves (chaveMunicipio) das cidades que ele atende.
 *
 * O preenchimento é OPACO (fillOpacity 1) nas cidades pintadas. Com 0.8/0.5 de antes
 * o desenho do OpenStreetMap (ruas, rios e os nomes das cidades do próprio mapa)
 * aparecia por baixo da cor, e os nomes da base se misturavam com a cor — ele
 * reclamou do "esquisito" (23/10). Opaco, o que se lê dentro da cidade é só o nome
 * que o CRM escreve (RotulosMunicipiosES).
 *
 * null = não deu para ler a lista (banco fora do ar): o mapa NÃO pinta ninguém de
 * cinza — cinza diria "não atendo" sobre uma coisa que o CRM não sabe. Fica só o
 * desenho das divisas (preto) sobre o mapa, quase sem cor.
 */
export function estiloDoMunicipio(nome: string, atendidos: ReadonlySet<string> | null, uf = "ES"): EstiloMunicipio {
  if (!atendidos) return { fillColor: "#94a3b8", fillOpacity: 0.08, color: COR_DIVISA, weight: ESPESSURA_DIVISA, opacity: 0.8 };
  const cor = atendidos.has(chaveMunicipio(uf, nome)) ? regiaoDoMunicipio(nome).cor : COR_NAO_ATENDO;
  return { fillColor: cor, fillOpacity: 1, color: COR_DIVISA, weight: ESPESSURA_DIVISA, opacity: 1 };
}

/** Mistura a cor com branco (0 = igual, 1 = branco). Usada no realce ao passar/tocar numa cidade. */
export function clarear(hex: string, quanto: number): string {
  const [r, g, b] = rgbDe(hex).map((c) => Math.round(c + (255 - c) * quanto));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** O que muda quando o dedo / o mouse está sobre a cidade: divisa mais grossa e cor um pouco mais clara. */
export function estiloRealce(base: EstiloMunicipio): EstiloMunicipio {
  return { ...base, weight: 3, fillColor: clarear(base.fillColor, 0.22) };
}

function rgbDe(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Luminância relativa (WCAG) de uma cor "#rrggbb". */
export function luminancia(hex: string): number {
  const [r, g, b] = rgbDe(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste (1 a 21) entre duas cores "#rrggbb". */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export const TEXTO_ESCURO = "#111827";
export const TEXTO_CLARO = "#ffffff";

/** Cor do nome escrito DENTRO da cidade: a que tem mais contraste com o preenchimento (escuro sobre pastel, branco sobre o cinza escuro). */
export const corDoTexto = (preenchimento: string): string =>
  contraste(preenchimento, TEXTO_ESCURO) >= contraste(preenchimento, TEXTO_CLARO) ? TEXTO_ESCURO : TEXTO_CLARO;

/**
 * A ordem das camadas do mapa por região (z-index), de baixo para cima: azulejos (200, do
 * Leaflet) → contorno grosso do estado → cidades → nomes → rotas (400) → pins/cifrões (600).
 * As cidades ficam abaixo das rotas e dos pins; os nomes, acima das cidades. Número fora dessa
 * ordem esconde os nomes (cidade opaca por cima) ou faz toda divisa virar traço grosso.
 */
export const Z_CONTORNO_ESTADO = 340;
export const Z_MUNICIPIOS = 350;
export const Z_NOMES = 380;

/** A dica da cidade tem no máximo isto de largura (espelha `.leaflet-tooltip.tip-municipio` no globals.css). */
export const LARGURA_MAXIMA_DICA = 220;
/** Altura de uma dica de 3 linhas + seta: acima disso, ela sobe e cabe; abaixo, vai para baixo do dedo. */
const ALTURA_DICA = 90;
/** Metade da altura máxima da dica: aberta de lado, ela fica centrada na vertical no dedo e precisa desta folga em cima e embaixo. */
const MEIA_ALTURA_DICA = 36;

export type DirecaoDica = "top" | "bottom" | "left" | "right";
export type DicaPosicionada = {
  direcao: DirecaoDica;
  /** Deslocamento [x, y] em px, na opção `offset` do tooltip do Leaflet. */
  deslocamento: [number, number];
  /**
   * Quanto empurrar a SETA da dica (px, ao longo da borda dela) para ela continuar apontando para o dedo:
   * o Leaflet fixa a seta no meio da dica, e uma dica deslocada apontava para outra cidade. Vai para
   * `--seta` no CSS (`.tip-municipio`).
   */
  seta: number;
};
/** Um retângulo em px do contêiner do mapa. */
export type CaixaDoMapa = { x0: number; y0: number; x1: number; y1: number };

/** Sem o -0 (que o `toEqual` do vitest distingue de 0). */
const oposto = (v: number): number => (v === 0 ? 0 : -v);

/** Seta + recuo entre o dedo e a dica quando ela abre de lado. */
const FOLGA_SETA = 6;
/**
 * Encostar não é cobrir. Os deslocamentos que colam a dica na lateral de um botão acumulam erro de
 * ponto flutuante (49 vira 48,99999999999999) quando o dedo tem fração — e o Leaflet entrega fração
 * sempre que o mapa tem largura fracionária —, e a comparação estrita jogava a dica a 400 px dali.
 */
const TOLERANCIA_PX = 0.01;

/**
 * Para onde abrir a dica da cidade, dado onde está o dedo/mouse no mapa (px do contêiner). Fixa
 * em cima, ela saía cortada pela borda do mapa — e as cidades do norte, justo as cinzas, ficam
 * coladas no topo e na direita. Escolhe pelo que CABE (a dica inteira dentro do mapa e sem cair
 * debaixo de `evitar`, os botões + / − e os créditos, que ficam por cima dela), na ordem:
 *  1. centrada em cima do dedo (ou embaixo, se ele está colado no topo);
 *  2. de lado, para o lado que tem mais espaço (colada no topo ou no pé, é empurrada para dentro,
 *     porque de lado ela fica centrada na vertical);
 *  3. em cima/embaixo mas DESLOCADA para o lado até caber (e, se há botões no caminho, até passar
 *     da lateral deles) — o único jeito em mapa estreito (o Dashboard no celular tem 324 px; a
 *     dica, 220 mais a seta, não cabe de lado em quase nenhum ponto);
 *  4. em cima/embaixo deslocada também PARA CIMA ou PARA BAIXO, até passar do botão (nos 20 px do
 *     pé do mapa a dica sobe acima dos créditos; no topo de um mapa estreito desce abaixo do +/−).
 *     A seta já não aponta para o dedo, e o `seta` devolvido a traz de volta quando dá;
 *  5. nenhuma escapa: a que menos cobre, em área. Se nem assim cabe (mapa mais estreito que a
 *     dica), alinha pela esquerda: o que corta é o fim do texto, não o nome da cidade.
 * O ponto é puxado para dentro do mapa antes de tudo: com a borda fracionária do contêiner o
 * Leaflet entrega -0,75 na primeira linha de pixels, e sem isso nenhuma colocação "cabia".
 */
export function direcaoDaDica(xBruto: number, yBruto: number, larguraDoMapa: number, alturaDoMapa: number, evitar: readonly CaixaDoMapa[] = []): DicaPosicionada {
  const x = Math.min(Math.max(xBruto, 0), larguraDoMapa);
  const y = Math.min(Math.max(yBruto, 0), alturaDoMapa);
  const meia = LARGURA_MAXIMA_DICA / 2;
  type Candidata = DicaPosicionada & { caixa: CaixaDoMapa };
  const vertical = (direcao: "top" | "bottom", dx: number, dy = 0): Candidata => {
    const y0 = (direcao === "top" ? y - ALTURA_DICA : y) + dy;
    return { direcao, deslocamento: [dx, dy], seta: oposto(dx), caixa: { x0: x - meia + dx, x1: x + meia + dx, y0, y1: y0 + ALTURA_DICA } };
  };
  const lado = (direcao: "left" | "right"): Candidata => {
    let dy = 0;
    if (y < MEIA_ALTURA_DICA) dy = MEIA_ALTURA_DICA - y;
    else if (y > alturaDoMapa - MEIA_ALTURA_DICA) dy = alturaDoMapa - MEIA_ALTURA_DICA - y;
    const x0 = direcao === "right" ? x + FOLGA_SETA : x - FOLGA_SETA - LARGURA_MAXIMA_DICA;
    return { direcao, deslocamento: [0, dy], seta: oposto(dy), caixa: { x0, x1: x0 + LARGURA_MAXIMA_DICA, y0: y + dy - MEIA_ALTURA_DICA, y1: y + dy + MEIA_ALTURA_DICA } };
  };
  // O quanto empurrar a dica centrada para ela caber na largura (nunca além do ponto em que a borda esquerda sai do mapa).
  const esq = x - meia;
  const dir = x + meia;
  const dx = esq < 0 ? -esq : dir > larguraDoMapa ? Math.max(larguraDoMapa - dir, -esq) : 0;
  const primeira = y < ALTURA_DICA ? "bottom" : "top";
  const segunda = primeira === "top" ? "bottom" : "top";
  const lados: ["left" | "right", "left" | "right"] = x < larguraDoMapa - x ? ["right", "left"] : ["left", "right"];
  // Deslocamentos que encostam a dica na lateral de cada botão (o menor primeiro): tirar a dica de cima dele sem sair do mapa.
  const desvios = evitar.flatMap((o) => [o.x1 - esq, o.x0 - dir]).filter((v) => v !== 0).sort((a, b) => Math.abs(a) - Math.abs(b));
  const candidatas = [vertical(primeira, 0), vertical(segunda, 0), lado(lados[0]), lado(lados[1]), vertical(primeira, dx), vertical(segunda, dx)];
  // Só se nenhuma das de cima servir: deslocar para o lado até a lateral de um botão, ou subir/descer até a borda
  // dele (com o deslocamento lateral que já tinha). A que fica mais PERTO do dedo vem primeiro.
  const distanciaAoDedo = (c: CaixaDoMapa) => Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.y0 - y, 0, y - c.y1));
  const laterais = [...desvios, 0, dx];
  const deslocadas = [
    ...desvios.flatMap((v) => [vertical(primeira, v), vertical(segunda, v)]),
    ...laterais.flatMap((lateral) => evitar.flatMap((o) => [vertical("top", lateral, o.y0 - y), vertical("bottom", lateral, o.y1 - y)])),
  ]
    .filter((c) => (c.direcao === "top" ? c.deslocamento[1] <= 0 : c.deslocamento[1] >= 0))
    .sort((p, q) => distanciaAoDedo(p.caixa) - distanciaAoDedo(q.caixa));
  const dentro = (c: CaixaDoMapa) => c.x0 >= -TOLERANCIA_PX && c.y0 >= -TOLERANCIA_PX && c.x1 <= larguraDoMapa + TOLERANCIA_PX && c.y1 <= alturaDoMapa + TOLERANCIA_PX;
  // A área da dica que cairia debaixo de algum botão (0 = livre); encostar não conta.
  const coberta = (c: CaixaDoMapa) => evitar.reduce((soma, o) => {
    const l = Math.min(c.x1, o.x1) - Math.max(c.x0, o.x0);
    const a = Math.min(c.y1, o.y1) - Math.max(c.y0, o.y0);
    return l > TOLERANCIA_PX && a > TOLERANCIA_PX ? soma + l * a : soma;
  }, 0);
  const cabem = [...candidatas, ...deslocadas].filter((c) => dentro(c.caixa));
  const escolhida = cabem.find((c) => coberta(c.caixa) === 0)
    ?? cabem.reduce<Candidata | undefined>((melhor, c) => (!melhor || coberta(c.caixa) < coberta(melhor.caixa) ? c : melhor), undefined)
    ?? candidatas[4];
  return { direcao: escolhida.direcao, deslocamento: escolhida.deslocamento, seta: escolhida.seta };
}

/** O texto que aparece ao passar o dedo / o mouse sobre a cidade. */
export function rotuloDoMunicipio(nome: string, atendidos: ReadonlySet<string> | null, uf = "ES"): string {
  const regiao = regiaoDoMunicipio(nome).nome;
  if (!atendidos) return `${nome} · ${regiao}`;
  return atendidos.has(chaveMunicipio(uf, nome)) ? `${nome} · ${regiao} · você atende` : `${nome} · ${regiao} · você não atende`;
}

export type ResumoMapa = {
  total: number;
  atendidas: number;
  naoAtendidas: number;
  /** Regiões em que ele atende alguma cidade (as que têm cor no mapa), na ordem da legenda. */
  regioes: { regiao: RegiaoTuristica; qtd: number }[];
};

/** Números da legenda. `nomes` = os municípios do desenho; `atendidos` null = lista desconhecida. */
export function resumirMapa(nomes: readonly string[], atendidos: ReadonlySet<string> | null, uf = "ES"): ResumoMapa {
  const por = new Map<string, number>();
  let atendidas = 0;
  if (atendidos) {
    for (const n of nomes) {
      if (!atendidos.has(chaveMunicipio(uf, n))) continue;
      atendidas++;
      const id = regiaoDoMunicipio(n).id;
      por.set(id, (por.get(id) ?? 0) + 1);
    }
  }
  const ordem = [...REGIOES_TURISTICAS, SEM_REGIAO];
  return {
    total: nomes.length,
    atendidas,
    naoAtendidas: atendidos ? nomes.length - atendidas : 0,
    regioes: ordem.filter((r) => por.has(r.id)).map((r) => ({ regiao: r, qtd: por.get(r.id) ?? 0 })),
  };
}
