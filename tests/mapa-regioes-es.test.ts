// O mapa por região (23/10): divisas entre as cidades, colorido onde ele atende
// e cinza onde não atende, no desenho e nas cores da foto do Mapa do Turismo
// Capixaba 2025.
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
  REGIOES_TURISTICAS, SEM_REGIAO, COR_NAO_ATENDO, MUNICIPIOS_SEM_REGIAO, UFS_COM_MALHA,
  chaveMunicipio, regiaoDoMunicipio, municipiosDaRegiao, estiloDoMunicipio, rotuloDoMunicipio, resumirMapa,
} from "@/lib/mapa-regioes-es";
import { semAcento } from "@/lib/area-atuacao-regra";
import { NOMES_MUNICIPIOS_ES } from "@/lib/municipios-es";

const ler = (f: string) => readFileSync(f, "utf8");

type Feicao = { properties: { id: string; nome: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } };
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
    expect(estiloDoMunicipio("Cachoeiro de Itapemirim", atendo).fillOpacity).toBeGreaterThanOrEqual(0.6);
  });

  it("não atende: cinza, mais apagado que as coloridas", () => {
    const e = estiloDoMunicipio("Vitória", atendo);
    expect(e.fillColor).toBe(COR_NAO_ATENDO);
    expect(e.fillOpacity).toBeLessThan(estiloDoMunicipio("Cachoeiro de Itapemirim", atendo).fillOpacity);
  });

  it("cidade que ele atende e que a foto deixa fora de qualquer região NÃO fica cinza", () => {
    const e = estiloDoMunicipio("Presidente Kennedy", atendo);
    expect(e.fillColor).toBe(SEM_REGIAO.cor);
    expect(e.fillColor).not.toBe(COR_NAO_ATENDO);
    expect(e.fillOpacity).toBeGreaterThanOrEqual(0.6);
  });

  it("lista desconhecida (banco fora do ar): ninguém vira cinza 'não atendo'", () => {
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

  it("a camada fica sob os pins: não captura o clique do marcador (pane padrão, sem z-index próprio)", () => {
    const s = ler("src/components/CamadaMunicipiosES.tsx");
    expect(s).not.toMatch(/pane=/);
    expect(s).not.toMatch(/zIndex/);
  });

  it("a legenda cobre os estados: lida, vazia e desconhecida", () => {
    const s = ler("src/components/LegendaMapaRegioes.tsx");
    for (const estado of ["desconhecida", "vazia", "ok"]) expect(s).toContain(`data-mapa-legenda="${estado}"`);
  });

  it("o ES tem divisas no código", () => {
    expect(UFS_COM_MALHA).toContain("ES");
  });
});
