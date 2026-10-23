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
