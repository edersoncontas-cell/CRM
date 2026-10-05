// Área de atuação (05/10): os municípios que ele atende, escolhidos em
// Configurações, valendo no CRM inteiro. Por enquanto só o ES ("pode ser
// então só ES").
//
// O que estes testes travam:
//  1. O padrão não machuca: sem nada salvo, com lixo gravado ou com um estado
//     que não foi liberado, a área é a de sempre (ES) e nada muda.
//  2. Salvar só tira de "atendo" o que ele viu desmarcado na tela — distrito,
//     nome escrito diferente ou "Cliente Cristiano" ficam como estão.
//  3. A IA só grava município do ES, com o nome escrito como o CRM escreve —
//     o caso do cliente de Guaçuí que virou de Recife.
//  4. Quem mostrava ES fixo (mapas, cidades de Visitas, licitações, agenda do
//     Google) agora pergunta à área.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  AREA_PADRAO, UFS_LIBERADAS, lerAreaDoTexto, validarEntradaArea, planejarSincronia, criarValidadorMunicipio,
  enquadrar, distanciaKm, type LinhaMunicipio,
} from "@/lib/area-atuacao-regra";
import { ESTADOS_BR, ufValida, municipiosDaUf, acharMunicipio } from "@/lib/municipios-brasil";
import { NOMES_MUNICIPIOS_ES } from "@/lib/municipios-es";
import { girarEstados } from "@/lib/licitacoes";
import { configPodeVir } from "@/lib/trazer-provisorio-regra";

const ler = (f: string) => readFileSync(f, "utf8");
const existe = (uf: string, nome: string) => acharMunicipio(uf, nome)?.nome ?? null;

describe("base do IBGE", () => {
  it("tem os 27 estados e os 78 municípios do ES com os mesmos nomes de sempre", () => {
    expect(ESTADOS_BR).toHaveLength(27);
    const es = municipiosDaUf("ES").map((m) => m.nome).sort();
    expect(es).toHaveLength(78);
    // A validação da IA trocou a lista antiga (municipios-es.ts) por esta base:
    // se um nome mudasse de grafia, cidade que já está no CRM deixaria de casar.
    expect(es).toEqual([...NOMES_MUNICIPIOS_ES].sort());
  });
  it("todo município do ES tem coordenada dentro do estado (vira ponto no mapa)", () => {
    for (const m of municipiosDaUf("ES")) {
      expect(m.lat).toBeGreaterThan(-21.4);
      expect(m.lat).toBeLessThan(-17.8);
      expect(m.lng).toBeGreaterThan(-42);
      expect(m.lng).toBeLessThan(-39.6);
    }
  });
});

describe("o padrão é a área de sempre", () => {
  it("sem nada salvo, com lixo ou com lista vazia: ES, não configurada", () => {
    for (const raw of [null, undefined, "", "lixo", "{}", '{"ufs":[]}', '{"ufs":["ES"],"municipios":[]}', "[1,2]"]) {
      expect(lerAreaDoTexto(raw, ufValida)).toEqual(AREA_PADRAO);
    }
    expect(AREA_PADRAO).toMatchObject({ ufs: ["ES"], configurada: false });
  });
  it("estado que não foi liberado não vale, nem gravado à mão no banco", () => {
    const raw = JSON.stringify({ ufs: ["MG"], municipios: [{ uf: "MG", nome: "Uberaba" }] });
    expect(lerAreaDoTexto(raw, ufValida)).toEqual(AREA_PADRAO);
  });
  it("área salva do ES vale", () => {
    const raw = JSON.stringify({ ufs: ["ES"], municipios: [{ uf: "ES", nome: "Guaçuí" }, { uf: "ES", nome: "Alegre" }], atualizadoEm: "2026-10-05T12:00:00Z" });
    expect(lerAreaDoTexto(raw, ufValida)).toMatchObject({ configurada: true, ufs: ["ES"], municipios: [{ uf: "ES", nome: "Guaçuí" }, { uf: "ES", nome: "Alegre" }] });
  });
  it("por enquanto só o ES está liberado", () => {
    expect(UFS_LIBERADAS).toEqual(["ES"]);
  });
});

describe("o que a tela manda para salvar", () => {
  it("aceita municípios do ES e devolve o nome oficial, sem repetir", () => {
    const r = validarEntradaArea({ ufs: ["ES"], municipios: [{ uf: "ES", nome: "guacui" }, { uf: "ES", nome: "Guaçuí" }, { uf: "ES", nome: "Alegre" }] }, existe, ufValida);
    expect(r).toEqual({ ok: true, ufs: ["ES"], municipios: [{ uf: "ES", nome: "Guaçuí" }, { uf: "ES", nome: "Alegre" }] });
  });
  it("recusa outro estado com o motivo por extenso", () => {
    const r = validarEntradaArea({ ufs: ["ES", "MG"], municipios: [{ uf: "ES", nome: "Alegre" }, { uf: "MG", nome: "Uberaba" }] }, existe, ufValida);
    expect(r).toEqual({ ok: false, erro: expect.stringContaining("só do Espírito Santo") });
  });
  it("recusa lista vazia, estado nenhum e município que não existe", () => {
    expect(validarEntradaArea({ ufs: ["ES"], municipios: [] }, existe, ufValida)).toMatchObject({ ok: false });
    expect(validarEntradaArea({ ufs: [], municipios: [] }, existe, ufValida)).toMatchObject({ ok: false, erro: "Escolha pelo menos um estado." });
    expect(validarEntradaArea({ ufs: ["ES"], municipios: [{ uf: "ES", nome: "Recife" }] }, existe, ufValida))
      .toMatchObject({ ok: false, erro: expect.stringContaining("Recife/ES") });
    expect(validarEntradaArea({ ufs: "ES", municipios: "x" }, existe, ufValida)).toMatchObject({ ok: false });
  });
});

describe("salvar acerta a marca 'atendo / fora da minha área'", () => {
  const guacui = acharMunicipio("ES", "Guaçuí")!;
  const alegre = acharMunicipio("ES", "Alegre")!;
  const linhas: LinhaMunicipio[] = [
    { id: "a", nome: "Alegre", lat: null, lng: null, foraDeArea: true },        // volta para dentro, ganha coordenada
    { id: "c", nome: "Cachoeiro de Itapemirim", lat: -20.8, lng: -41.1, foraDeArea: false }, // desmarcado → fora
    { id: "b", nome: "Burarama", lat: null, lng: null, foraDeArea: false },     // distrito: não é município do IBGE
    { id: "x", nome: "Cliente Cristiano", lat: null, lng: null, foraDeArea: true }, // pseudo-região: já fora
  ];
  const ehDaLista = (n: string) => !!acharMunicipio("ES", n);
  const plano = planejarSincronia(linhas, [
    { uf: "ES", nome: "Guaçuí", lat: guacui.lat, lng: guacui.lng },
    { uf: "ES", nome: "Alegre", lat: alegre.lat, lng: alegre.lng },
  ], "ES", ehDaLista);

  it("cria o que falta, com coordenada", () => {
    expect(plano.criar).toEqual([{ nome: "Guaçuí", lat: guacui.lat, lng: guacui.lng, uf: "ES" }]);
  });
  it("marca de volta e preenche a coordenada que faltava", () => {
    expect(plano.passamParaDentro).toEqual(["a"]);
    expect(plano.coordenadas).toEqual([{ id: "a", lat: alegre.lat, lng: alegre.lng }]);
  });
  it("só passa para fora o município que ele viu desmarcado", () => {
    expect(plano.passamParaFora).toEqual(["c"]);
  });
  it("distrito ou nome fora da lista do IBGE fica como está — e é dito", () => {
    expect(plano.passamParaFora).not.toContain("b");
    expect(plano.ficamComoEstao).toEqual(["Burarama"]);
  });
  it("nada vira 'atendo' sem ele marcar", () => {
    expect(plano.passamParaDentro).not.toContain("x");
  });
  it("cidade de mesmo nome a mais de 40 km é outra cidade (não reaproveita a linha)", () => {
    const viana = acharMunicipio("ES", "Viana")!;
    const p = planejarSincronia([{ id: "v", nome: "Viana", lat: -3.22, lng: -44.99, foraDeArea: false }], [{ uf: "ES", nome: "Viana", lat: viana.lat, lng: viana.lng }], "ES");
    expect(distanciaKm({ lat: -3.22, lng: -44.99 }, viana)).toBeGreaterThan(40);
    expect(p.criar).toEqual([{ nome: "Viana (ES)", lat: viana.lat, lng: viana.lng, uf: "ES" }]);
  });
});

describe("cidade que a IA pode gravar", () => {
  const validar = criarValidadorMunicipio(
    municipiosDaUf("ES").map((m) => ({ nome: m.nome, crm: m.nome })),
    [{ uf: "ES", nome: "Espírito Santo" }],
  );
  it("aceita do jeito que se escreve e devolve como o CRM escreve", () => {
    expect(validar("guacui")).toBe("Guaçuí");
    expect(validar("GUAÇUÍ")).toBe("Guaçuí");
    expect(validar("Guaçuí - ES")).toBe("Guaçuí");
    expect(validar("Guaçuí/ES")).toBe("Guaçuí");
    expect(validar("Cachoeiro de Itapemirim, Espírito Santo")).toBe("Cachoeiro de Itapemirim");
    expect(validar("Atilio Vivacqua")).toBe("Atílio Vivácqua");
  });
  it("cidade de fora do ES, nome inventado e o que não é texto: null", () => {
    expect(validar("Recife")).toBeNull();
    expect(validar("Belo Horizonte")).toBeNull();
    expect(validar("")).toBeNull();
    expect(validar(null)).toBeNull();
    expect(validar(42)).toBeNull();
  });
});

describe("mapa enquadrado na área", () => {
  const es = municipiosDaUf("ES");
  it("abre nas cidades que ele atende e deixa arrastar até o estado inteiro", () => {
    const sul = ["Guaçuí", "Alegre", "Cachoeiro de Itapemirim"].map((n) => acharMunicipio("ES", n)!);
    const e = enquadrar(es, sul);
    const [[s, w], [n, l]] = e.inicial;
    const [[S, W], [N, L]] = e.limites;
    expect(s).toBeGreaterThan(S); expect(w).toBeGreaterThan(W); expect(n).toBeLessThan(N); expect(l).toBeLessThan(L);
    // O sul do ES: a abertura não chega no norte do estado.
    expect(n).toBeLessThan(-20);
  });
  it("sem cidade atendida, abre no estado inteiro", () => {
    const e = enquadrar(es, []);
    expect(e.inicial[0][0]).toBeLessThan(-21);
    expect(e.inicial[1][0]).toBeGreaterThan(-18.2);
  });
});

describe("volta do banco provisório", () => {
  it("a área não vem sozinha: ela só vale junto com a marca de cada cidade, que salvar acerta no mesmo banco", () => {
    expect(configPodeVir("area.atuacao")).toBe(false);
  });
});

describe("licitações com mais de um estado", () => {
  it("a ordem gira a cada hora, para nenhum estado ficar sempre para trás", () => {
    const h = 3_600_000;
    expect(girarEstados(["ES"], 5 * h)).toEqual(["ES"]);
    expect(girarEstados(["ES", "MG", "RJ"], 0)).toEqual(["ES", "MG", "RJ"]);
    expect(girarEstados(["ES", "MG", "RJ"], 1 * h)).toEqual(["MG", "RJ", "ES"]);
    expect(girarEstados(["ES", "MG", "RJ"], 2 * h)).toEqual(["RJ", "ES", "MG"]);
  });
});

describe("quem mostrava ES fixo agora pergunta à área", () => {
  it("os dois mapas recebem o enquadramento e o contorno da área", () => {
    for (const f of ["src/components/MapaVendasES.tsx", "src/components/MapaVisitasES.tsx"]) {
      const s = ler(f);
      expect(s).not.toMatch(/LIMITES_ES|CENTRO_ES|malhas\/estados\/32/);
      expect(s).toMatch(/bounds=\{mapa\.inicial\}/);
      expect(s).toMatch(/maxBounds=\{mapa\.limites\}/);
    }
    expect(ler("src/app/(app)/dashboard/page.tsx")).toMatch(/mapa=\{mapa\}/);
    expect(ler("src/app/(app)/visitas/page.tsx")).toMatch(/mapa=\{mapa\}/);
  });
  it("Visitas sugere as cidades da área e acha a coordenada nela", () => {
    const s = ler("src/app/(app)/visitas/page.tsx");
    expect(s).toMatch(/cidadesParaSugerir\(\)/);
    expect(s).not.toMatch(/NOMES_MUNICIPIOS_ES/);
    expect(s).toMatch(/coordenadasNaArea\(cidade, area\)/);
  });
  it("licitações pedem ao PNCP por estado da área, não uf=ES fixo", () => {
    const s = ler("src/lib/licitacoes.ts");
    expect(s).not.toMatch(/uf=ES/);
    expect(s).toMatch(/uf=\$\{uf\}/);
  });
  it("a IA grava cidade pelo validador da área (pipeline, Orientador e Cérebro)", () => {
    expect(ler("src/lib/zeus/pipeline.ts")).toMatch(/municipioDaArea\(/);
    expect(ler("src/lib/zeus/orientador.ts")).toMatch(/validadorDaArea\(/);
    expect(ler("src/lib/zeus/orientador.ts")).toMatch(/municipioDaArea\(/);
    expect(ler("src/lib/zeus/cerebro-tools.ts")).toMatch(/municipioDaArea\(/);
  });
  it("agenda do Google tira a UF da área, não '- ES' fixo", () => {
    expect(ler("src/lib/integrations/google.ts")).not.toMatch(/nome\} - ES`/);
  });
});
