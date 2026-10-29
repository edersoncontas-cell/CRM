// O mapa por região (23/10): divisas PRETAS entre as cidades, colorido onde ele
// atende e cinza ESCURO onde não atende, preenchimento opaco (a base do mapa não
// aparece por baixo), no desenho e nas cores da foto do Mapa do Turismo
// Capixaba 2025. Os nomes escritos dentro das cidades: tests/mapa-rotulos-es.test.ts.
//
// O que estes testes travam:
//  1. O desenho: os 78 municípios do ES, anéis fechados, tudo dentro do estado
//     (um arquivo gerado errado vira mapa com buraco ou cidade no mar).
//  2. A tabela de regiões: cada município em UMA região, as contagens da foto,
//     e nenhum nome que não exista no ES (nome escrito errado = cidade cinza
//     para sempre, sem erro nenhum).
//  3. A regra de cor: atende = cor da região, não atende = cinza, lista
//     desconhecida = nada de cinza (cinza diria "não atendo" sobre o que o CRM
//     não sabe) e cidade atendida NUNCA parece cinza.
//  4. A lista de quem ele atende que a tela recebe (mapaDaArea): com a área
//     salva, sem ela (marca foraDeArea do banco), com nome sem acento e com o
//     banco fora do ar.
//  5. Os dois mapas usam a camada, e o ES não busca mais o contorno na internet.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, statSync } from "node:fs";
import {
  REGIOES_TURISTICAS, SEM_REGIAO, COR_NAO_ATENDO, COR_DIVISA, MUNICIPIOS_SEM_REGIAO, UFS_COM_MALHA,
  chaveMunicipio, regiaoDoMunicipio, municipiosDaRegiao, estiloDoMunicipio, estiloRealce, rotuloDoMunicipio, resumirMapa,
  clarear, contraste, luminancia, corDoTexto, TEXTO_ESCURO, TEXTO_CLARO,
  Z_CONTORNO_ESTADO, Z_MUNICIPIOS, Z_NOMES, LARGURA_MAXIMA_DICA, direcaoDaDica,
} from "@/lib/mapa-regioes-es";
import { pontoDentro, poligonosDaFeicao } from "@/lib/mapa-rotulos-es";
import { semAcento } from "@/lib/area-atuacao-regra";
import { NOMES_MUNICIPIOS_ES } from "@/lib/municipios-es";

const ler = (f: string) => readFileSync(f, "utf8");

const areaDoAnel = (a: [number, number][]) => {
  let soma = 0;
  for (let i = 0; i < a.length - 1; i++) soma += a[i][0] * a[i + 1][1] - a[i + 1][0] * a[i][1];
  return Math.abs(soma) / 2;
};
const distanciaAoSegmento = (px: number, py: number, a: [number, number], b: [number, number]) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
};

type Feicao = { properties: { id: string; nome: string; c?: [number, number] }; geometry: { type: string; coordinates: number[][][] | number[][][][] } };
const malha = JSON.parse(ler("src/lib/malha-es.json")) as { type: string; features: Feicao[] };
const nomesMalha = malha.features.map((f) => f.properties.nome);

describe("o desenho das divisas (malha-es.json)", () => {
  it("tem os 78 municípios do ES, cada um uma vez, com os nomes do CRM", () => {
    expect(malha.type).toBe("FeatureCollection");
    expect(malha.features).toHaveLength(78);
    expect(new Set(malha.features.map((f) => f.properties.id)).size).toBe(78);
    expect(malha.features.every((f) => /^32\d{5}$/.test(f.properties.id))).toBe(true);
    // Nome IGUAL ao do CRM, com acento (é o que a dica ao tocar na cidade mostra).
    expect([...nomesMalha].sort()).toEqual([...NOMES_MUNICIPIOS_ES].sort());
  });

  it("todo anel está fechado, tem ponto de sobra e fica dentro do ES", () => {
    for (const f of malha.features) {
      const poligonos = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      for (const poligono of poligonos) {
        for (const anel of poligono) {
          expect(anel.length, f.properties.nome).toBeGreaterThanOrEqual(4);
          expect(anel[0], f.properties.nome).toEqual(anel[anel.length - 1]);
          for (const [lng, lat] of anel) {
            expect(lat).toBeGreaterThan(-21.4);
            expect(lat).toBeLessThan(-17.8);
            expect(lng).toBeGreaterThan(-41.95);
            expect(lng).toBeLessThan(-39.6);
          }
        }
      }
    }
  });

  it("a estrutura dos anéis está certa: o primeiro de cada polígono é o de FORA (o maior) e os buracos ficam dentro dele", () => {
    // A fonte do IBGE traz Vitória, Vila Velha, Guarapari e Ibiraçu com as ilhas como anéis soltos e o
    // contorno principal por último; scripts/gerar-malha-es.py arruma. Sem isso a caixa da cidade
    // (e o lugar do nome) saía da ilhota.
    for (const f of malha.features) {
      for (const p of poligonosDaFeicao(f.geometry) as unknown as [number, number][][][]) {
        const areas = p.map(areaDoAnel);
        expect(areas[0], `${f.properties.nome}: o anel de fora não é o maior`).toBe(Math.max(...areas));
        for (const buraco of p.slice(1)) expect(pontoDentro(buraco[0][0], buraco[0][1], [p[0]]), `${f.properties.nome}: buraco fora do contorno`).toBe(true);
      }
    }
    // E as ilhas viraram polígonos próprios, do maior para o menor.
    const vv = malha.features.find((f) => f.properties.nome === "Vila Velha")!;
    expect(vv.geometry.type).toBe("MultiPolygon");
    const areas = (vv.geometry.coordinates as number[][][][]).map((p) => areaDoAnel(p[0] as unknown as [number, number][]));
    expect([...areas].sort((a, b) => b - a)).toEqual(areas);
  });

  it("cada município traz o ponto do nome (`c`): dentro do maior pedaço dele e longe da divisa", () => {
    for (const f of malha.features) {
      const c = f.properties.c;
      expect(c, f.properties.nome).toBeDefined();
      const maior = (poligonosDaFeicao(f.geometry) as unknown as [number, number][][][])[0];
      expect(pontoDentro(c![0], c![1], maior), `${f.properties.nome}: c fora do município`).toBe(true);
      // Longe da divisa (mais de ~110 m): o ponto é o "mais afastado de qualquer divisa", não um canto.
      let menor = Infinity;
      for (const anel of maior) for (let i = 1; i < anel.length; i++) menor = Math.min(menor, distanciaAoSegmento(c![0], c![1], anel[i - 1], anel[i]));
      expect(menor, `${f.properties.nome}: c colado na divisa`).toBeGreaterThan(0.001);
    }
  });

  it("o arquivo é pequeno (vai no pacote do mapa, que ele abre no celular)", () => {
    expect(statSync("src/lib/malha-es.json").size).toBeLessThan(250 * 1024);
  });
});

describe("a tabela de regiões (a foto do Mapa do Turismo 2025)", () => {
  const todos = [...REGIOES_TURISTICAS.flatMap((r) => municipiosDaRegiao(r.id)), ...MUNICIPIOS_SEM_REGIAO];

  it("cada um dos 78 municípios está em exatamente uma região (ou na lista dos sem região)", () => {
    expect(todos).toHaveLength(78);
    expect(new Set(todos.map(semAcento)).size).toBe(78);
    expect(todos.map(semAcento).sort()).toEqual([...NOMES_MUNICIPIOS_ES].map(semAcento).sort());
  });

  it("as contagens batem com a foto", () => {
    const conta = Object.fromEntries(REGIOES_TURISTICAS.map((r) => [r.id, municipiosDaRegiao(r.id).length]));
    expect(conta).toEqual({
      "terra-morena": 5, "verde-aguas": 7, noroeste: 5, pontoes: 8, imigrantes: 8, metropolitana: 7, montanhas: 8, costa: 6, caparao: 11, sul: 5,
    });
    expect(MUNICIPIOS_SEM_REGIAO).toHaveLength(8);
  });

  it("as dez regiões têm cor própria e nenhuma é a do cinza nem a do 'sem região'", () => {
    const cores = REGIOES_TURISTICAS.map((r) => r.cor);
    expect(new Set(cores).size).toBe(10);
    expect(cores).not.toContain(COR_NAO_ATENDO);
    expect(cores).not.toContain(SEM_REGIAO.cor);
    expect(SEM_REGIAO.cor).not.toBe(COR_NAO_ATENDO);
  });

  it("nenhuma cor de cidade atendida se confunde com o cinza escuro de 'não atendo'", () => {
    // Luminâncias parecidas = o olho não separa. As coloridas são todas pastel: bem mais claras.
    for (const cor of [...REGIOES_TURISTICAS.map((r) => r.cor), SEM_REGIAO.cor]) {
      expect(luminancia(cor), cor).toBeGreaterThan(luminancia(COR_NAO_ATENDO) * 2);
    }
  });

  it("casos que a leitura a olho errou ou que confundem", () => {
    expect(regiaoDoMunicipio("Vitória").nome).toBe("Metropolitana");
    expect(regiaoDoMunicipio("Guarapari").nome).toBe("Metropolitana");
    expect(regiaoDoMunicipio("Jerônimo Monteiro").nome).toBe("Caparaó Capixaba");
    expect(regiaoDoMunicipio("Castelo").nome).toBe("Montanhas Capixabas");
    expect(regiaoDoMunicipio("Mantenópolis").nome).toBe("Doce Pontões Capixaba");
    expect(regiaoDoMunicipio("Bom Jesus do Norte")).toBe(SEM_REGIAO); // cinza na foto
    expect(regiaoDoMunicipio("Presidente Kennedy")).toBe(SEM_REGIAO);
    expect(regiaoDoMunicipio("Marechal Floriano")).toBe(SEM_REGIAO);
    // O CRM escreve sem acento, com caixa diferente, às vezes:
    expect(regiaoDoMunicipio("atilio vivacqua").nome).toBe("Sul Capixaba dos Vales e Café");
    expect(regiaoDoMunicipio("AFONSO CLAUDIO").nome).toBe("Montanhas Capixabas");
    // Nome que não existe: cai em "sem região", nunca estoura.
    expect(regiaoDoMunicipio("Lugar Nenhum")).toBe(SEM_REGIAO);
  });
});

describe("a regra de cor", () => {
  const atendo = new Set([chaveMunicipio("ES", "Cachoeiro de Itapemirim"), chaveMunicipio("ES", "Presidente Kennedy"), chaveMunicipio("ES", "Atílio Vivácqua")]);

  it("atende: a cor da região (com a mesma regra de nome sem acento)", () => {
    const sul = REGIOES_TURISTICAS.find((r) => r.id === "sul")!;
    expect(estiloDoMunicipio("Cachoeiro de Itapemirim", atendo).fillColor).toBe(sul.cor);
    expect(estiloDoMunicipio("Atilio Vivacqua", atendo).fillColor).toBe(sul.cor);
  });

  it("não atende: cinza ESCURO (pedido dele, 23/10), não o cinza claro de antes", () => {
    const e = estiloDoMunicipio("Vitória", atendo);
    expect(e.fillColor).toBe(COR_NAO_ATENDO);
    // Escuro de verdade: luminância baixa, bem abaixo do #9ca3af (≈0.36) que ele achou fraco.
    expect(luminancia(COR_NAO_ATENDO)).toBeLessThan(0.16);
    expect(luminancia(COR_NAO_ATENDO)).toBeGreaterThan(0.05); // mas não preto: a divisa preta precisa aparecer em cima dele
  });

  it("a divisa é PRETA em todo caso (atende, não atende e lista desconhecida), com traço que se vê", () => {
    for (const lista of [atendo, new Set<string>(), null]) {
      for (const nome of ["Cachoeiro de Itapemirim", "Vitória", "Presidente Kennedy"]) {
        const e = estiloDoMunicipio(nome, lista);
        expect(e.color, `${nome} ${lista ? "" : "(sem lista)"}`).toBe("#000000");
        expect(e.weight).toBeGreaterThanOrEqual(1);
        expect(e.opacity).toBeGreaterThanOrEqual(0.8);
      }
    }
    expect(COR_DIVISA).toBe("#000000");
    // A divisa preta tem de aparecer sobre o cinza escuro (contraste mínimo de elemento gráfico: 3:1).
    expect(contraste(COR_DIVISA, COR_NAO_ATENDO)).toBeGreaterThanOrEqual(3);
  });

  it("o preenchimento é OPACO: a base do OpenStreetMap (ruas, rios, nomes) não aparece por baixo da cor", () => {
    for (const nome of ["Cachoeiro de Itapemirim", "Vitória", "Presidente Kennedy"]) {
      expect(estiloDoMunicipio(nome, atendo).fillOpacity, nome).toBe(1);
    }
    expect(estiloDoMunicipio("Vitória", new Set()).fillOpacity).toBe(1);
  });

  it("cidade que ele atende e que a foto deixa fora de qualquer região NÃO fica cinza", () => {
    const e = estiloDoMunicipio("Presidente Kennedy", atendo);
    expect(e.fillColor).toBe(SEM_REGIAO.cor);
    expect(e.fillColor).not.toBe(COR_NAO_ATENDO);
    expect(e.fillOpacity).toBe(1);
  });

  it("ao passar/tocar: divisa mais grossa e cor um pouco mais clara, sem mudar de 'família'", () => {
    for (const nome of ["Cachoeiro de Itapemirim", "Vitória"]) {
      const base = estiloDoMunicipio(nome, atendo);
      const r = estiloRealce(base);
      expect(r.weight).toBeGreaterThan(base.weight);
      expect(r.color).toBe(COR_DIVISA);
      expect(luminancia(r.fillColor)).toBeGreaterThan(luminancia(base.fillColor));
      expect(r.fillOpacity).toBe(1);
    }
    expect(clarear("#000000", 0)).toBe("#000000");
    expect(clarear("#000000", 1)).toBe("#ffffff");
    expect(clarear("#555c68", 0.5)).toBe("#aaaeb4");
  });

  it("a cor do texto escrito dentro da cidade tem contraste de leitura (4,5:1) sobre TODO preenchimento possível", () => {
    for (const fundo of [...REGIOES_TURISTICAS.map((r) => r.cor), SEM_REGIAO.cor, COR_NAO_ATENDO]) {
      const texto = corDoTexto(fundo);
      expect([TEXTO_ESCURO, TEXTO_CLARO]).toContain(texto);
      expect(contraste(fundo, texto), `${fundo} com ${texto}`).toBeGreaterThanOrEqual(4.5);
    }
    // Pastel leva texto escuro; o cinza escuro leva texto branco.
    expect(corDoTexto("#f7c8df")).toBe(TEXTO_ESCURO);
    expect(corDoTexto(COR_NAO_ATENDO)).toBe(TEXTO_CLARO);
  });

  it("lista desconhecida (banco fora do ar): ninguém vira cinza 'não atendo' — quase transparente, só as divisas", () => {
    for (const nome of ["Vitória", "Cachoeiro de Itapemirim", "Presidente Kennedy"]) {
      const e = estiloDoMunicipio(nome, null);
      expect(e.fillColor).not.toBe(COR_NAO_ATENDO);
      expect(e.fillOpacity).toBeLessThan(0.2);
    }
  });

  it("nenhum município atendido (conjunto vazio): tudo cinza — diferente de 'não sei'", () => {
    expect(estiloDoMunicipio("Vitória", new Set()).fillColor).toBe(COR_NAO_ATENDO);
  });

  it("o texto ao tocar na cidade diz região e se atende", () => {
    expect(rotuloDoMunicipio("Cachoeiro de Itapemirim", atendo)).toBe("Cachoeiro de Itapemirim · Sul Capixaba dos Vales e Café · você atende");
    expect(rotuloDoMunicipio("Vitória", atendo)).toBe("Vitória · Metropolitana · você não atende");
    expect(rotuloDoMunicipio("Vitória", null)).toBe("Vitória · Metropolitana");
  });

  it("a legenda conta só o que está no desenho e na ordem da foto", () => {
    const r = resumirMapa(nomesMalha, new Set([...atendo, chaveMunicipio("ES", "Cidade de Goiás")]));
    expect(r.total).toBe(78);
    expect(r.atendidas).toBe(3); // a cidade de fora do ES não conta
    expect(r.naoAtendidas).toBe(75);
    expect(r.regioes.map((x) => [x.regiao.id, x.qtd])).toEqual([["sul", 2], ["sem-regiao", 1]]);
    expect(resumirMapa(nomesMalha, null)).toMatchObject({ atendidas: 0, naoAtendidas: 0, regioes: [] });
    expect(resumirMapa(nomesMalha, new Set())).toMatchObject({ atendidas: 0, naoAtendidas: 78 });
  });
});

// ── A lista que a tela recebe ───────────────────────────────────────────────

const config = vi.hoisted(() => ({ area: null as string | null, linhas: [] as { nome: string; lat: number | null; lng: number | null }[] | "erro" }));
vi.mock("@/lib/config", () => ({ getConfig: vi.fn(async () => config.area), setConfig: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    municipio: {
      findMany: vi.fn(async () => {
        if (config.linhas === "erro") throw new Error("banco fora do ar");
        return config.linhas;
      }),
    },
  },
}));

describe("mapaDaArea entrega quem ele atende", () => {
  beforeEach(() => { config.area = null; config.linhas = []; });

  it("com a área salva: os municípios dela", async () => {
    const { mapaDaArea } = await import("@/lib/area-atuacao");
    config.area = JSON.stringify({ ufs: ["ES"], municipios: [{ uf: "ES", nome: "Cachoeiro de Itapemirim" }, { uf: "ES", nome: "Castelo" }], atualizadoEm: null });
    const m = await mapaDaArea();
    expect([...(m.atendidos ?? [])].sort()).toEqual(["ES:cachoeiro de itapemirim", "ES:castelo"]);
  });

  it("sem área salva: as que estão como 'atendo' no banco, mesmo escritas sem acento", async () => {
    const { mapaDaArea } = await import("@/lib/area-atuacao");
    config.linhas = [{ nome: "Atilio Vivacqua", lat: null, lng: null }, { nome: "Castelo", lat: -20.6, lng: -41.18 }];
    const m = await mapaDaArea();
    expect([...(m.atendidos ?? [])].sort()).toEqual(["ES:atilio vivacqua", "ES:castelo"]);
    // E o desenho pinta a cidade mesmo com o nome do banco sem acento.
    const set = new Set(m.atendidos);
    expect(estiloDoMunicipio("Atílio Vivácqua", set).fillColor).not.toBe(COR_NAO_ATENDO);
  });

  it("sem área salva e nenhuma cidade 'atendo': lista VAZIA (o mapa avisa), não 'desconhecida'", async () => {
    const { mapaDaArea } = await import("@/lib/area-atuacao");
    config.linhas = [];
    expect((await mapaDaArea()).atendidos).toEqual([]);
  });

  it("banco fora do ar: lista desconhecida (null) — o mapa não pinta ninguém de cinza", async () => {
    const { mapaDaArea, mapaDaAreaOuPadrao, mapaPadrao } = await import("@/lib/area-atuacao");
    config.linhas = "erro";
    expect((await mapaDaArea()).atendidos).toBeNull();
    expect((await mapaDaAreaOuPadrao()).atendidos).toBeNull();
    expect(mapaPadrao().atendidos).toBeNull();
  });
});

// ── Os mapas usam a camada ──────────────────────────────────────────────────

describe("os dois mapas", () => {
  for (const arq of ["src/components/MapaVisitasES.tsx", "src/components/MapaVendasES.tsx"]) {
    it(`${arq.split("/").pop()}: desenha as divisas e a legenda, e o ES não busca contorno na internet`, () => {
      const s = ler(arq);
      expect(s).toMatch(/<CamadaMunicipiosES atendidos=\{mapa\.atendidos\}/);
      expect(s).toMatch(/<LegendaMapaRegioes atendidos=\{mapa\.atendidos\}/);
      // Só o estado SEM divisas no código pede o contorno do IBGE.
      expect(s).toMatch(/filter\(\(e\) => !UFS_COM_MALHA\.includes\(e\.uf\)\)/);
    });
  }

  it("a ORDEM das camadas: azulejos (200) < contorno do estado < cidades < nomes < rotas (400) < pins (600)", () => {
    // Fora dessa ordem o mapa quebra sem erro nenhum: cidade opaca por cima dos nomes (K02),
    // contorno grosso por cima das cidades (toda divisa interna viraria traço de 4 px, K03),
    // ou cidades por cima do trajeto e dos pins (não recebem o clique).
    expect(Z_CONTORNO_ESTADO).toBeGreaterThan(200);
    expect(Z_CONTORNO_ESTADO).toBeLessThan(Z_MUNICIPIOS);
    expect(Z_MUNICIPIOS).toBeLessThan(Z_NOMES);
    expect(Z_NOMES).toBeLessThan(400);
  });

  it("os componentes usam essas alturas (e não números soltos)", () => {
    const c = ler("src/components/CamadaMunicipiosES.tsx");
    expect(c).toMatch(/<Pane name="estado-base" style=\{\{ zIndex: Z_CONTORNO_ESTADO \}\}>/);
    expect(c).toMatch(/<Pane name="municipios" style=\{\{ zIndex: Z_MUNICIPIOS \}\}>/); // cidades em camada própria: na das rotas (400) nasceriam POR CIMA do trajeto do dia
    expect(c).not.toMatch(/zIndex: \d/);
    expect(ler("src/components/RotulosMunicipiosES.tsx")).toMatch(/zIndex = String\(Z_NOMES\)/);
  });

  it("a camada do contorno fica SEMPRE montada: só o desenho some quando a lista falta (montar e desmontar deixava um renderizador SVG órfão)", () => {
    const c = ler("src/components/CamadaMunicipiosES.tsx");
    expect(c).toMatch(/<Pane name="estado-base"[^>]*>\s*\{conjunto && <GeoJSON/);
    expect(c).not.toMatch(/\{conjunto && \(\s*<Pane/);
  });

  it("os estilos são estáveis: função nova a cada render faz o react-leaflet reaplicar o estilo nas 78 cidades e perder o realce do mouse", () => {
    const c = ler("src/components/CamadaMunicipiosES.tsx");
    expect(c).toMatch(/const estiloBase = useCallback\(/);
    expect(c).toMatch(/style=\{estiloBase\}/);
    expect(c).toMatch(/style=\{ESTILO_CONTORNO\}/);
    expect(c).not.toMatch(/style=\{\(/); // nenhuma arrow inline em style
  });

  it("os nomes das cidades ficam entre as cidades e os pins, sem receber toque", () => {
    const s = ler("src/components/RotulosMunicipiosES.tsx");
    expect(s).toMatch(/pointerEvents = "none"/);
    // Depois de aproximar/arrastar os nomes são refeitos; sem estes ouvintes eles sumiam no primeiro zoom.
    expect(s).toMatch(/mapa\.on\("zoomend moveend", agendar\)/);
    expect(s).toMatch(/mapa\.off\("zoomend moveend", agendar\)/);
    expect(s).toMatch(/grupo\.clearLayers\(\)/); // sem limpar antes, os nomes empilhavam a cada movimento
    expect(s).toMatch(/interactive: false/);
    // Se a conta falhar o mapa NÃO cai: avisa pelo atributo e segue com cores e dica.
    expect(s).toMatch(/catch \{[\s\S]*dataset\.rotulos = "erro"/);
    // Sem a lista não há cor de fundo para combinar com o texto.
    expect(s).toMatch(/if \(!atendidos\)/);
  });

  it("os pins das visitas e os cifrões das vendas entram como obstáculo: o nome não é escrito embaixo deles", () => {
    expect(ler("src/components/MapaVisitasES.tsx")).toMatch(/<CamadaMunicipiosES atendidos=\{mapa\.atendidos\} obstaculos=\{obstaculos\}/);
    expect(ler("src/components/MapaVendasES.tsx")).toMatch(/<CamadaMunicipiosES atendidos=\{mapa\.atendidos\} obstaculos=\{obstaculos\}/);
    // E o trajeto do dia (a linha tracejada entre as visitas) também não corta nome.
    expect(ler("src/components/MapaVisitasES.tsx")).toMatch(/obstaculos=\{obstaculos\} rota=\{rota\}/);
  });

  it("o mapa abre enquadrado em passos de 1/4 de zoom (o nome só aparece onde cabe: meio nível a mais já mostra muito mais cidades)", () => {
    for (const arq of ["src/components/MapaVisitasES.tsx", "src/components/MapaVendasES.tsx"]) expect(ler(arq), arq).toMatch(/zoomSnap=\{0\.25\}/);
  });

  it("a legenda cobre os estados: lida, vazia e desconhecida", () => {
    const s = ler("src/components/LegendaMapaRegioes.tsx");
    for (const estado of ["desconhecida", "vazia", "ok"]) expect(s).toContain(`data-mapa-legenda="${estado}"`);
  });

  it("'Não atendo' é o PRIMEIRO item da legenda: a lista rola em altura fixa e, no fim dela, o cinza escuro ficava atrás da rolagem com 9 regiões ou mais", () => {
    const s = ler("src/components/LegendaMapaRegioes.tsx");
    const naoAtendo = s.indexOf("Não atendo <b>");
    const regioes = s.indexOf("resumo.regioes.map(");
    expect(naoAtendo).toBeGreaterThan(0);
    expect(regioes).toBeGreaterThan(0);
    expect(naoAtendo).toBeLessThan(regioes);
  });

  it("o ES tem divisas no código", () => {
    expect(UFS_COM_MALHA).toContain("ES");
  });
});

// ── A dica da cidade e o CSS do nome ────────────────────────────────────────

describe("a dica da cidade abre para onde cabe", () => {
  const LARGURA_CELULAR = 358; // o mapa das Visitas no celular de 390
  const ALTURA_CELULAR = 440;
  const LARGURA_DASHBOARD = 323;
  const onde = (x: number, y: number, l = LARGURA_CELULAR, a = ALTURA_CELULAR) => direcaoDaDica(x, y, l, a);

  it("no meio do mapa e longe do topo: abre em cima, sem deslocar", () => {
    expect(onde(LARGURA_CELULAR / 2, 250)).toEqual({ direcao: "top", deslocamento: [0, 0] });
    expect(onde(700, 300, 1400, 460).direcao).toBe("top");
  });

  it("colado no topo: abre embaixo (em cima o nome sumia para fora do mapa)", () => {
    expect(onde(LARGURA_CELULAR / 2, 25).direcao).toBe("bottom");
    expect(onde(700, 89, 1400, 460).direcao).toBe("bottom");
    expect(onde(700, 90, 1400, 460).direcao).toBe("top");
  });

  it("colado na esquerda: abre para a direita; colado na direita: abre para a esquerda", () => {
    expect(onde(40, 230).direcao).toBe("right");
    expect(onde(330, 230).direcao).toBe("left");
    expect(onde(40, 230).deslocamento).toEqual([0, 0]); // no meio da altura não precisa empurrar
  });

  it("no canto: abre de lado E é empurrada para dentro (de lado ela fica centrada na vertical no dedo e subia para fora do mapa)", () => {
    const sup = onde(1390, 4, 1400, 460);
    expect(sup.direcao).toBe("left");
    expect(sup.deslocamento[1]).toBeGreaterThanOrEqual(32); // 36 - 4
    const esq = onde(10, 16, 1400, 460);
    expect(esq.direcao).toBe("right");
    expect(esq.deslocamento[1]).toBeGreaterThanOrEqual(20);
    const pe = onde(10, 455, 1400, 460);
    expect(pe.deslocamento[1]).toBeLessThan(0); // colado no pé: empurra para cima
  });

  it("de lado, a dica (centrada no dedo + o deslocamento) cabe na altura do mapa em TODO ponto", () => {
    const metade = 36; // altura máxima da dica / 2
    for (let y = 0; y <= ALTURA_CELULAR; y += 2) {
      const d = onde(5, y);
      expect(d.direcao).toBe("right");
      expect(y + d.deslocamento[1] - metade, `y=${y}`).toBeGreaterThanOrEqual(0);
      expect(y + d.deslocamento[1] + metade, `y=${y}`).toBeLessThanOrEqual(ALTURA_CELULAR);
    }
  });

  // A caixa que a dica ocupa, pela geometria do Leaflet (escrita aqui de novo, não importada da conta):
  // 220 de largura e até 90 de altura; em cima/embaixo ela fica centrada no dedo (+ o deslocamento); de lado,
  // a seta e o recuo somam 6 px e ela fica centrada na vertical (72 de altura útil, + o deslocamento).
  const caixaDaDica = (d: ReturnType<typeof direcaoDaDica>, x: number, y: number) => {
    const [dx, dy] = d.deslocamento;
    const L = LARGURA_MAXIMA_DICA;
    if (d.direcao === "top") return { x0: x - L / 2 + dx, x1: x + L / 2 + dx, y0: y - 90, y1: y };
    if (d.direcao === "bottom") return { x0: x - L / 2 + dx, x1: x + L / 2 + dx, y0: y, y1: y + 90 };
    if (d.direcao === "right") return { x0: x + 6, x1: x + 6 + L, y0: y + dy - 36, y1: y + dy + 36 };
    return { x0: x - 6 - L, x1: x - 6, y0: y + dy - 36, y1: y + dy + 36 };
  };

  it("em TODO ponto, em mapas de 288 a 1440 px de largura, a dica INTEIRA cabe no mapa (o Dashboard no celular tem 324: de lado ela não cabia em quase nenhum ponto)", () => {
    for (const [l, a] of [[288, 420], [309, 420], [LARGURA_DASHBOARD + 1, 420], [327, 420], [LARGURA_CELULAR, ALTURA_CELULAR], [523, 400], [1440, 460]]) {
      for (let x = 0; x <= l; x++) {
        for (const y of [0, 5, 35, 36, 89, 90, 200, a - 37, a - 36, a - 5, a]) {
          const d = onde(x, y, l, a);
          const c = caixaDaDica(d, x, y);
          const rotulo = `mapa ${l}x${a}, dedo em ${x},${y} (${d.direcao} ${d.deslocamento})`;
          expect(c.x0, rotulo).toBeGreaterThanOrEqual(-1e-9);
          expect(c.x1, rotulo).toBeLessThanOrEqual(l + 1e-9);
          expect(c.y0, rotulo).toBeGreaterThanOrEqual(-1e-9);
          expect(c.y1, rotulo).toBeLessThanOrEqual(a + 1e-9);
        }
      }
    }
  });

  it("mapa estreito: as duas faixas em que nem a dica centrada nem a de lado cabiam (x≈99–109 e 215–225 num mapa de 324) abrem em cima/embaixo, deslocadas para dentro", () => {
    for (const x of [99, 104, 109, 215, 220, 225]) {
      const d = onde(x, 250, 324, 420);
      expect(["top", "bottom"], `x=${x}`).toContain(d.direcao);
      expect(d.deslocamento[1]).toBe(0);
      expect(d.deslocamento[0], `x=${x}`).not.toBe(0);
    }
    // Colatina tocada em x=216 (o caso medido: a dica abria à esquerda, em -10..210, e perdia o começo do nome).
    expect(onde(216, 250, 324, 420)).toEqual({ direcao: "top", deslocamento: [-2, 0] });
  });

  it("quando nem em cima nem embaixo cabe (mapa baixo) e os DOIS lados cabem, abre para o lado com mais espaço", () => {
    expect(direcaoDaDica(300, 50, 1400, 120).direcao).toBe("right");
    expect(direcaoDaDica(1100, 50, 1400, 120).direcao).toBe("left");
  });

  it("mapa mais estreito que a dica: alinha pela esquerda (o que corta é o fim do texto, não o nome da cidade)", () => {
    const d = onde(100, 250, 200, 420);
    expect(caixaDaDica(d, 100, 250).x0).toBe(0);
  });

  it("os botões do mapa (+ / − e os créditos) ficam POR CIMA da dica: ela escolhe outro lugar quando cairia embaixo deles", () => {
    const botoes = [{ x0: 6, y0: 6, x1: 48, y1: 88 }];
    // Em cima do dedo (150,100) a dica ocuparia 40–260 × 10–100: debaixo do botão "+". Sem os botões, abre em cima.
    expect(onde(150, 100).direcao).toBe("top");
    const com = direcaoDaDica(150, 100, LARGURA_CELULAR, ALTURA_CELULAR, botoes);
    expect(com.direcao).toBe("bottom");
    const c = caixaDaDica(com, 150, 100);
    expect(c.x0 < 48 && c.x1 > 6 && c.y0 < 88 && c.y1 > 6, "a dica cobre o botão").toBe(false);
    // Longe dos botões nada muda.
    expect(direcaoDaDica(250, 300, LARGURA_CELULAR, ALTURA_CELULAR, botoes)).toEqual(onde(250, 300));
  });

  it("se NENHUM lugar escapa dos botões, ela ainda abre (dentro do mapa) em vez de sumir", () => {
    const tudo = [{ x0: -10, y0: -10, x1: 400, y1: 460 }];
    const d = direcaoDaDica(150, 200, LARGURA_CELULAR, ALTURA_CELULAR, tudo);
    expect(d).toEqual(onde(150, 200));
  });

  it("varrendo o mapa do celular com o botão +/− no lugar de verdade: em nenhum toque a dica cai embaixo dele (sem a regra, um em cada ~10 cai)", () => {
    const botoes = [{ x0: 6, y0: 6, x1: 48, y1: 88 }];
    const cobre = (d: ReturnType<typeof direcaoDaDica>, x: number, y: number) => {
      const c = caixaDaDica(d, x, y);
      return c.x0 < 48 && c.x1 > 6 && c.y0 < 88 && c.y1 > 6;
    };
    let com = 0;
    let sem = 0;
    for (let x = 0; x <= LARGURA_CELULAR; x += 2) {
      for (let y = 0; y <= ALTURA_CELULAR; y += 6) {
        if (x >= 6 && x <= 48 && y >= 6 && y <= 88) continue; // o dedo não toca no mapa por baixo do botão
        if (cobre(direcaoDaDica(x, y, LARGURA_CELULAR, ALTURA_CELULAR, botoes), x, y)) com++;
        if (cobre(onde(x, y), x, y)) sem++;
      }
    }
    expect(sem).toBeGreaterThan(500);
    expect(com).toBe(0);
  });

  it("o componente escolhe a direção ANTES de ligar a dica (o Leaflet dispara na ordem em que os ouvintes foram ligados) e aplica também o deslocamento", () => {
    const s = ler("src/components/CamadaMunicipiosES.tsx");
    const escolhe = s.indexOf("c.on({ mouseover: abrirOndeCabe");
    const liga = s.indexOf("c.bindTooltip(");
    expect(escolhe).toBeGreaterThan(0);
    expect(liga).toBeGreaterThan(escolhe);
    for (const ev of ["mouseover", "mousemove", "click"]) expect(s).toMatch(new RegExp(`${ev}: abrirOndeCabe`));
    expect(s).toMatch(/dica\.options\.direction = onde\.direcao/);
    expect(s).toMatch(/dica\.options\.offset = onde\.deslocamento/);
    // E passa os botões do mapa (+ / −, créditos), que ficam por cima da dica.
    expect(s).toMatch(/direcaoDaDica\([^)]*botoesDoMapa\(\)\)/);
    expect(s).toMatch(/querySelectorAll\("\.leaflet-control"\)/);
  });

  it("no celular (sem mouse) a dica fica aberta até o próximo toque: o 'mouseout' que o Chromium manda logo depois do toque não a fecha", () => {
    const s = ler("src/components/CamadaMunicipiosES.tsx");
    expect(s).toMatch(/matchMedia\("\(hover: none\)"\)/);
    expect(s).toMatch(/c\.off\("mouseout", c\.closeTooltip\)/);
    // Quem fecha: o toque em outra cidade, o toque no mapa vazio e mover/aproximar o mapa.
    expect(s).toMatch(/mapa\.on\("click movestart zoomstart resize", fechar\)/);
    expect(s).toMatch(/mapa\.off\("click movestart zoomstart resize", fechar\)/);
    expect(s).toMatch(/clique === atual\.clique/); // o clique que ABRIU não pode fechar a própria dica
    // A dica aberta só pelo "mouseover" (tablet com mouse) também é registrada: senão aproximar o mapa não a fecharia.
    expect(s).toMatch(/c\.on\(\{ mouseover: marcar, click: marcar \}\)/);
  });

  it("a largura que a conta supõe é a do CSS", () => {
    expect(ler("src/app/globals.css")).toMatch(new RegExp(`\\.leaflet-tooltip\\.tip-municipio \\{[^}]*max-width: ${LARGURA_MAXIMA_DICA}px`));
  });
});

describe("o CSS do nome da cidade vence o do Leaflet", () => {
  const css = ler("src/app/globals.css");

  it("o seletor tem DUAS classes: o leaflet.css (carrega depois, junto do mapa) põe display:block no .leaflet-marker-icon e com uma classe só ele vencia", () => {
    // Com display:block, cada linha do nome ocupava 18 px em vez de 14 e o nome de duas linhas
    // saía mais alto que a caixa medida — encostando na divisa.
    expect(css).toMatch(/\.leaflet-marker-icon\.rotulo-municipio \{[^}]*display: flex/);
    expect(css).not.toMatch(/(^|\n)\.rotulo-municipio \{/);
  });

  it("o mapa importa o leaflet.css (e é por isso que a ordem de CSS importa)", () => {
    expect(ler("src/components/MapaVisitasES.tsx")).toMatch(/leaflet\/dist\/leaflet\.css/);
  });
});
