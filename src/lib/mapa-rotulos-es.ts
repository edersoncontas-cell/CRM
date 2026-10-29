// OS NOMES DAS CIDADES, ESCRITOS DENTRO DE CADA CIDADE — puro (sem banco, sem
// Leaflet): o mapa "use client" importa daqui e o teste roda sem navegador.
//
// 23/10, ele olhou o mapa por região e disse: "sobrepondo o nome das cidades,
// não enquadrados e não aparecem direito, ficou muito esquisito". Eram os nomes
// do OpenStreetMap aparecendo por baixo da cor, cortados pela divisa. Agora o
// preenchimento é opaco (esconde a base) e o CRM escreve o nome de cada cidade
// DENTRO dela — como no Mapa do Turismo Capixaba —, só onde CABE:
//
//  · o retângulo do texto tem de ficar inteiro dentro da cidade (nenhuma divisa
//    passa por ele), inteiro dentro da parte visível do mapa (nome cortado na
//    borda é o "não enquadrado" de que ele reclamou) e longe dos pins/cifrões e
//    dos botões do mapa (+ / −, créditos);
//  · se não cabe numa linha, tenta em duas ("Cachoeiro de / Itapemirim") e depois
//    com a letra menor (12 → 11 → 10 px; menor que isso ninguém lê no celular);
//  · se não cabe de jeito nenhum neste zoom, a cidade fica sem texto — o nome
//    continua na dica ao passar/tocar, e ao aproximar com o + ele aparece.
//
// A conta é em pixels da projeção do Leaflet (Web Mercator, azulejo de 256 px) no
// zoom atual; o ponto de partida de cada nome é o `c` da malha (o ponto mais longe
// de qualquer divisa, calculado em scripts/gerar-malha-es.py).

export type Ponto = [number, number];
export type Anel = Ponto[];
/** Um polígono: o anel de fora e, se houver, os buracos. */
export type Poligono = Anel[];
export type Caixa = { x0: number; y0: number; x1: number; y1: number };

/** Coisa que fica por cima do mapa e que o nome não pode cobrir (pin de visita, cifrão de venda). Deslocamentos em px a partir do ponto. */
export type ObstaculoRotulo = { lng: number; lat: number; esq: number; cima: number; dir: number; baixo: number };

export type FeicaoMalha = {
  properties: { nome: string; c?: Ponto };
  geometry: { type: string; coordinates: unknown };
};

export type RotuloPosto = {
  nome: string;
  /** Centro do texto, em pixels da projeção no zoom pedido. */
  x: number;
  y: number;
  linhas: string[];
  fonte: number;
  largura: number;
  altura: number;
};

/**
 * A letra do rótulo: a mesma na medida e na tela (senão o texto não cabe no que foi medido).
 * SEM aspas duplas: ela vai dentro de style="..." — com aspas, o atributo fechava no meio, o
 * resto do estilo (cor, sombra) se perdia e o nome saía na cor da página (claro sobre pastel).
 */
export const FAMILIA_ROTULO = "'Helvetica Neue', Arial, Helvetica, sans-serif";
export const PESO_ROTULO = 700;
/** Do maior para o menor. Menos de 10 px não se lê no celular. */
export const FONTES_ROTULO: readonly number[] = [12, 11, 10];

/** Folga entre o texto e a divisa (px). */
export const FOLGA_X = 4;
export const FOLGA_Y = 2;
const ENTRELINHA = 1.15;
/**
 * Pontos (mais ou menos) da grade GROSSA da busca. Numa janela pequena (a cidade no zoom de abertura,
 * ~60×60 px) o custo fica nesta ordem; em tela de PC o passo é limitado pela metade do texto e a
 * contagem cresce com a área da janela (pior caso medido: ~3 mil perguntas por variante em 1440×460).
 * Medido no Chromium, zoom de abertura: com 500 pontos a conta custava ~2× o código antigo; com 100,
 * de 1,3× (mediana) a 1,75× (pior caso) — conforme a tela e a CPU. Dali em diante, igual ou menor.
 * `tests/mapa-rotulos-es.test.ts` guarda a contagem (não o relógio).
 */
const PONTOS_GROSSOS = 100;
const PASSO_GROSSO_MINIMO = 4;
const TAMANHO_AZULEJO = 256;

// ───────── projeção (a mesma do Leaflet com o OpenStreetMap) ─────────

export function projetar(lng: number, lat: number, zoom: number): Ponto {
  const escala = TAMANHO_AZULEJO * 2 ** zoom;
  const seno = Math.sin((lat * Math.PI) / 180);
  return [((lng + 180) / 360) * escala, (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * escala];
}

export function desprojetar(x: number, y: number, zoom: number): Ponto {
  const escala = TAMANHO_AZULEJO * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / escala;
  return [(x / escala) * 360 - 180, (180 / Math.PI) * Math.atan(Math.sinh(n))];
}

// ───────── geometria ─────────

/** Os polígonos de uma feição da malha (Polygon ou MultiPolygon), em lng/lat. O primeiro anel de cada um é o de fora (scripts/gerar-malha-es.py normaliza). */
export function poligonosDaFeicao(g: FeicaoMalha["geometry"]): Poligono[] {
  return (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Poligono[];
}

const projetarPoligono = (p: Poligono, zoom: number): Poligono => p.map((a) => a.map(([lng, lat]) => projetar(lng, lat, zoom)));

function caixaDo(p: Poligono): Caixa {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of p[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

const caixasSeCruzam = (a: Caixa, b: Caixa): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Regra par-ímpar: serve para polígono com buraco. */
export function pontoDentro(x: number, y: number, p: Poligono): boolean {
  let dentro = false;
  for (const a of p) {
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const [ax, ay] = a[i];
      const [bx, by] = a[j];
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) dentro = !dentro;
    }
  }
  return dentro;
}

/** O segmento encosta na caixa? (Liang–Barsky) */
export function segmentoToca(ax: number, ay: number, bx: number, by: number, c: Caixa): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - c.x0, c.x1 - ax, ay - c.y0, c.y1 - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}

/**
 * A caixa inteira está dentro do polígono? Centro dentro E nenhuma divisa encosta
 * nela: se a divisa não passa pela caixa, a caixa não pode estar metade dentro,
 * metade fora.
 */
export function caixaDentro(c: Caixa, p: Poligono): boolean {
  if (!pontoDentro((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, p)) return false;
  for (const a of p) {
    for (let i = 1; i < a.length; i++) if (segmentoToca(a[i - 1][0], a[i - 1][1], a[i][0], a[i][1], c)) return false;
  }
  return true;
}

// ───────── texto ─────────

export type Medidor = (texto: string, fonte: number) => number;

/** Do nome inteiro numa linha até a divisão em duas linhas que deixa a maior mais curta. */
export function variantesDeLinhas(nome: string, fonte: number, medir: Medidor): string[][] {
  const palavras = nome.split(" ");
  const variantes: string[][] = [[nome]];
  if (palavras.length < 2) return variantes;
  let melhor: string[] | null = null;
  let melhorLargura = Infinity;
  for (let i = 1; i < palavras.length; i++) {
    const par = [palavras.slice(0, i).join(" "), palavras.slice(i).join(" ")];
    const largura = Math.max(medir(par[0], fonte), medir(par[1], fonte));
    if (largura < melhorLargura) { melhorLargura = largura; melhor = par; }
  }
  if (melhor) variantes.push(melhor);
  return variantes;
}

// ───────── onde cabe ─────────

/** O traço (o trajeto do dia) é fino e tracejado; 3 px de cada lado cobrem a espessura e a folga. */
const FOLGA_LINHA = 3;

/**
 * A caixa da parte do anel que APARECE dentro de `area` (recorte de Sutherland–Hodgman), ou
 * null se nada dele aparece. Cidade grande vista só como uma pontinha num canto da tela tem a
 * caixa inteira enorme, mas a parte visível pequena — e é nela que o nome precisa caber.
 */
export function caixaVisivel(anel: Anel, area: Caixa): Caixa | null {
  let pts: Ponto[] = anel.length > 1 && anel[0][0] === anel[anel.length - 1][0] && anel[0][1] === anel[anel.length - 1][1] ? anel.slice(0, -1) : anel.slice();
  const cortes: [(p: Ponto) => boolean, (a: Ponto, b: Ponto) => Ponto][] = [
    [(p) => p[0] >= area.x0, (a, b) => [area.x0, a[1] + ((b[1] - a[1]) * (area.x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= area.x1, (a, b) => [area.x1, a[1] + ((b[1] - a[1]) * (area.x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= area.y0, (a, b) => [a[0] + ((b[0] - a[0]) * (area.y0 - a[1])) / (b[1] - a[1]), area.y0]],
    [(p) => p[1] <= area.y1, (a, b) => [a[0] + ((b[0] - a[0]) * (area.y1 - a[1])) / (b[1] - a[1]), area.y1]],
  ];
  for (const [dentro, cruza] of cortes) {
    const saida: Ponto[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (dentro(a)) {
        saida.push(a);
        if (!dentro(b)) saida.push(cruza(a, b));
      } else if (dentro(b)) saida.push(cruza(a, b));
    }
    pts = saida;
    if (pts.length === 0) return null;
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

/**
 * Onde o centro do texto (W×H) pode ficar: dentro da parte visível de cada pedaço da cidade, a
 * meia caixa de texto da borda. Quase sempre vazio em zoom longe para cidade pequena.
 */
function janelasDoCentro(W: number, H: number, visiveis: readonly (Caixa | null)[]): Caixa[] {
  const saida: Caixa[] = [];
  for (const v of visiveis) {
    if (!v) continue;
    const j = { x0: v.x0 + W / 2, y0: v.y0 + H / 2, x1: v.x1 - W / 2, y1: v.y1 - H / 2 };
    if (j.x1 >= j.x0 && j.y1 >= j.y0) saida.push(j);
  }
  return saida;
}

const dentroDe = (p: Ponto, c: Caixa): boolean => p[0] >= c.x0 && p[0] <= c.x1 && p[1] >= c.y0 && p[1] <= c.y1;

/** Só para o teste de custo: quantas vezes a pergunta "o texto cabe aqui?" foi feita. */
export type ContagemDeTestes = { testes: number };

function acharLugar(W: number, H: number, poligonos: Poligono[], caixas: Caixa[], ancora: Ponto, area: Caixa, obstaculos: Caixa[], linhas: Ponto[][], visiveis: readonly (Caixa | null)[], contagem?: ContagemDeTestes): Ponto | null {
  // "O retângulo w×h, com o centro em (cx, cy), cabe?" — com w×h = o texto, ou o texto ENCOLHIDO (busca grossa).
  const livreCom = (w: number, h: number) => (cx: number, cy: number): boolean => {
    if (contagem) contagem.testes++;
    const c: Caixa = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
    if (c.x0 < area.x0 || c.y0 < area.y0 || c.x1 > area.x1 || c.y1 > area.y1) return false; // cortado pela borda do mapa
    for (const o of obstaculos) if (caixasSeCruzam(c, o)) return false;
    const larga: Caixa = { x0: c.x0 - FOLGA_LINHA, y0: c.y0 - FOLGA_LINHA, x1: c.x1 + FOLGA_LINHA, y1: c.y1 + FOLGA_LINHA };
    for (const l of linhas) for (let i = 1; i < l.length; i++) if (segmentoToca(l[i - 1][0], l[i - 1][1], l[i][0], l[i][1], larga)) return false; // o trajeto não corta o nome
    for (let i = 0; i < poligonos.length; i++) if (caixasSeCruzam(c, caixas[i]) && caixaDentro(c, poligonos[i])) return true;
    return false;
  };
  const livre = livreCom(W, H);
  if (livre(ancora[0], ancora[1])) return ancora;

  // Não coube no ponto de partida: procura na parte VISÍVEL da cidade, do lugar mais perto do ponto
  // de partida para o mais longe. Se o ponto de partida está fora da tela (cidade grande, vista
  // de perto), o nome vem para o MEIO do que aparece — e não para o canto mais perto do ponto.
  const janelas = janelasDoCentro(W, H, visiveis);
  if (janelas.length === 0) return null; // o que aparece da cidade é menor que o texto
  let alvo = ancora;
  if (!dentroDe(ancora, area)) {
    const maior = janelas.reduce((m, j) => ((j.x1 - j.x0) * (j.y1 - j.y0) >= (m.x1 - m.x0) * (m.y1 - m.y0) ? j : m));
    alvo = [(maior.x0 + maior.x1) / 2, (maior.y0 + maior.y1) / 2];
  }
  const maisPerto = (a: Ponto, b: Ponto) => (a[0] - alvo[0]) ** 2 + (a[1] - alvo[1]) ** 2 - ((b[0] - alvo[0]) ** 2 + (b[1] - alvo[1]) ** 2);

  // Duas passadas, do grosso para o fino — para o custo crescer devagar com o tamanho da janela:
  //  1. uma grade GROSSA (passo sx × sy) testada com o retângulo ENCOLHIDO em sx × sy. Se o texto
  //     cabe num ponto p, o retângulo (W−sx)×(H−sy) cabe em todo ponto a até sx/2 × sy/2 de p:
  //     então nenhum lugar escapa da grade grossa (o que ela descarta, não tinha lugar por perto);
  //  2. em volta de cada ponto grosso que passou, varre de 1 em 1 px com o retângulo inteiro.
  // Resolução: ~1 px. Acha todo lugar com folga de pelo menos 1 px; um lugar mais apertado que isso (caixa livre
  // menor que ~1 px) pode escapar — na comparação com uma varredura exaustiva de 1 px, cerca de 0,5% das telas.
  let total = 0;
  for (const j of janelas) total += (Math.floor(j.x1 - j.x0) + 1) * (Math.floor(j.y1 - j.y0) + 1);
  const passo = Math.max(PASSO_GROSSO_MINIMO, Math.ceil(Math.sqrt(total / PONTOS_GROSSOS)));
  // O encolhimento nunca passa de metade do lado (senão o retângulo some): janela enorme com texto
  // pequeno ganha mais pontos grossos (a janela é a tela, então tem teto).
  const sx = Math.max(1, Math.min(passo, Math.floor(W / 2)));
  const sy = Math.max(1, Math.min(passo, Math.floor(H / 2)));
  const cabeEncolhido = livreCom(W - sx, H - sy);
  const grossos: Ponto[] = [];
  for (const j of janelasDoCentro(W - sx, H - sy, visiveis)) for (let x = j.x0; x <= j.x1; x += sx) for (let y = j.y0; y <= j.y1; y += sy) grossos.push([x, y]);
  grossos.sort(maisPerto);
  for (const [qx, qy] of grossos) {
    if (!cabeEncolhido(qx, qy)) continue;
    const finos: Ponto[] = [];
    for (let dx = -sx / 2; dx <= sx / 2; dx++) for (let dy = -sy / 2; dy <= sy / 2; dy++) finos.push([qx + dx, qy + dy]);
    finos.sort(maisPerto);
    for (const [x, y] of finos) if (livre(x, y)) return [x, y];
  }
  return null;
}

export const alturaDaLinha = (fonte: number) => Math.round(fonte * ENTRELINHA);

/** Tenta cada letra (do maior) e cada divisão em linhas até achar um lugar. null = não cabe neste zoom. */
export function posicionarRotulo(o: {
  nome: string;
  poligonos: Poligono[]; // em px
  ancora: Ponto; // em px
  area: Caixa; // onde o TEXTO INTEIRO precisa ficar (a parte visível do mapa)
  obstaculos: Caixa[];
  linhas?: Ponto[][]; // traços por cima do mapa (o trajeto do dia), em px
  medir: Medidor;
  fontes?: readonly number[];
  contagem?: ContagemDeTestes;
}): RotuloPosto | null {
  const caixas = o.poligonos.map(caixaDo);
  // O que aparece de cada pedaço da cidade dentro da área: calculado uma vez, serve a todas as letras.
  const visiveis = o.poligonos.map((p) => caixaVisivel(p[0], o.area));
  const maior = visiveis.reduce((m, c) => (c ? { w: Math.max(m.w, c.x1 - c.x0), h: Math.max(m.h, c.y1 - c.y0) } : m), { w: 0, h: 0 });
  for (const fonte of o.fontes ?? FONTES_ROTULO) {
    for (const linhas of variantesDeLinhas(o.nome, fonte, o.medir)) {
      const largura = Math.ceil(Math.max(...linhas.map((l) => o.medir(l, fonte)))) + 2 * FOLGA_X;
      const altura = linhas.length * alturaDaLinha(fonte) + 2 * FOLGA_Y;
      if (largura > maior.w || altura > maior.h) continue; // nem a parte visível da cidade comporta
      const lugar = acharLugar(largura, altura, o.poligonos, caixas, o.ancora, o.area, o.obstaculos, o.linhas ?? [], visiveis, o.contagem);
      if (lugar) return { nome: o.nome, x: lugar[0], y: lugar[1], linhas, fonte, largura, altura };
    }
  }
  return null;
}

/**
 * O retângulo de um botão do mapa (+ / −, créditos) em px da projeção: `r` e `mapa` em px da tela
 * (getBoundingClientRect), `origem` = o canto de cima à esquerda da parte visível em px da projeção
 * (getPixelBounds().min). `folga` px de cada lado. `medida` desconta a escala e a borda do contêiner,
 * como o Leaflet faz com o mouse (L.DomEvent.getMousePosition).
 */
export function botaoEmPx(
  r: { left: number; top: number; right: number; bottom: number },
  mapa: { left: number; top: number },
  origem: { x: number; y: number },
  folga = 3,
  medida: { escala?: { x: number; y: number }; borda?: { x: number; y: number } } = {},
): Caixa {
  const ex = medida.escala?.x || 1;
  const ey = medida.escala?.y || 1;
  const bx = medida.borda?.x ?? 0;
  const by = medida.borda?.y ?? 0;
  return {
    x0: origem.x + (r.left - mapa.left) / ex - bx - folga,
    y0: origem.y + (r.top - mapa.top) / ey - by - folga,
    x1: origem.x + (r.right - mapa.left) / ex - bx + folga,
    y1: origem.y + (r.bottom - mapa.top) / ey - by + folga,
  };
}

type Retangulo = { left: number; top: number; right: number; bottom: number; width: number; height: number };

/**
 * Os botões do mapa (os `.leaflet-control`) como retângulos no sistema de coordenadas do próprio
 * Leaflet. O contêiner do mapa pode ter borda (1 px) e largura fracionária — `getBoundingClientRect`
 * devolve 719,33 enquanto `offsetWidth` devolve 719 —, e o Leaflet descontou as duas coisas ao medir
 * o mouse; medir os botões sem descontar deixa os dois sistemas deslocados um do outro.
 */
export function botoesDoContainer(
  container: { getBoundingClientRect(): Retangulo; offsetWidth: number; offsetHeight: number; clientLeft: number; clientTop: number },
  botoes: Iterable<{ getBoundingClientRect(): Retangulo }>,
  origem: { x: number; y: number },
  folga: number,
): Caixa[] {
  const base = container.getBoundingClientRect();
  const medida = {
    escala: { x: container.offsetWidth ? base.width / container.offsetWidth : 1, y: container.offsetHeight ? base.height / container.offsetHeight : 1 },
    borda: { x: container.clientLeft, y: container.clientTop },
  };
  return [...botoes].map((el) => botaoEmPx(el.getBoundingClientRect(), base, origem, folga, medida));
}

const caixaDoObstaculo = (o: ObstaculoRotulo, zoom: number): Caixa => {
  const [x, y] = projetar(o.lng, o.lat, zoom);
  return { x0: x + o.esq, y0: y + o.cima, x1: x + o.dir, y1: y + o.baixo };
};

/**
 * Os nomes que cabem no zoom dado, só das cidades que aparecem em `visao` (px da
 * projeção: a parte visível do mapa). Cada nome fica inteiro dentro de `visao`.
 * `obstaculos` = pins/cifrões (lng/lat + tamanho); `obstaculosPx` = coisas já em
 * pixels da projeção (os botões do mapa); `rota` = o trajeto do dia (linha).
 */
export function calcularRotulos(o: {
  feicoes: readonly FeicaoMalha[];
  zoom: number;
  visao: Caixa;
  obstaculos?: readonly ObstaculoRotulo[];
  obstaculosPx?: readonly Caixa[];
  /** O trajeto do dia: pontos [lat, lng], como o Leaflet. O traço passa por cima do mapa e não pode cortar um nome. */
  rota?: readonly (readonly [number, number])[];
  medir: Medidor;
  fontes?: readonly number[];
}): RotuloPosto[] {
  const obstaculos = [...(o.obstaculos ?? []).map((ob) => caixaDoObstaculo(ob, o.zoom)), ...(o.obstaculosPx ?? [])];
  const linhas: Ponto[][] = o.rota && o.rota.length > 1 ? [o.rota.map(([lat, lng]) => projetar(lng, lat, o.zoom))] : [];
  const saida: RotuloPosto[] = [];
  for (const f of o.feicoes) {
    const poligonos = poligonosDaFeicao(f.geometry).map((p) => projetarPoligono(p, o.zoom));
    if (!poligonos.some((p) => caixasSeCruzam(caixaDo(p), o.visao))) continue;
    const c = f.properties.c;
    const caixas = poligonos.map(caixaDo);
    const ancora: Ponto = c ? projetar(c[0], c[1], o.zoom) : [(caixas[0].x0 + caixas[0].x1) / 2, (caixas[0].y0 + caixas[0].y1) / 2];
    const r = posicionarRotulo({ nome: f.properties.nome, poligonos, ancora, area: o.visao, obstaculos, linhas, medir: o.medir, fontes: o.fontes });
    if (r) saida.push(r);
  }
  return saida;
}

/** Pedaço de cidade menor que isso (em graus², ~10 km²) é ilhota: não entra no contorno grosso do estado. */
export const AREA_MINIMA_DO_CONTORNO = 1e-3;

const areaDoAnel = (a: Anel): number => {
  let soma = 0;
  for (let i = 0; i < a.length - 1; i++) soma += a[i][0] * a[i + 1][1] - a[i + 1][0] * a[i][1];
  return Math.abs(soma) / 2;
};

/**
 * A malha sem as ilhotas (os pedaços minúsculos de Vitória, Vila Velha, Guarapari…). O traço
 * grosso do contorno do estado, desenhado em cima delas, virava "bolha" preta no mar.
 */
export function semIlhotas(feicoes: readonly FeicaoMalha[]): FeicaoMalha[] {
  const saida: FeicaoMalha[] = [];
  for (const f of feicoes) {
    const grandes = poligonosDaFeicao(f.geometry).filter((p) => areaDoAnel(p[0]) >= AREA_MINIMA_DO_CONTORNO);
    if (grandes.length === 0) continue;
    saida.push({ ...f, geometry: grandes.length === 1 ? { type: "Polygon", coordinates: grandes[0] } : { type: "MultiPolygon", coordinates: grandes } });
  }
  return saida;
}
