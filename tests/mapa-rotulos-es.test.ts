// Os nomes das cidades escritos DENTRO de cada cidade, no mapa por região (23/10).
//
// Ele reclamou: "sobrepondo o nome das cidades, não enquadrados e não aparecem
// direito". O que este teste trava, contra a malha REAL dos 78 municípios:
//  1. todo nome escrito cabe INTEIRO dentro da própria cidade (conferido por um
//     caminho independente: milhares de pontos do retângulo do texto, um a um);
//  2. dois nomes nunca se encostam, e nenhum nome fica embaixo de um pin/cifrão;
//  3. aproximar o mapa só ACRESCENTA nomes (nunca some um que já cabia);
//  4. cidade pequena demais para o zoom fica SEM nome — não com nome cortado;
//  5. a conta não depende do navegador (é pura): dá para rodar aqui.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  projetar, desprojetar, pontoDentro, caixaDentro, segmentoToca, variantesDeLinhas, calcularRotulos, posicionarRotulo, poligonosDaFeicao,
  semIlhotas, AREA_MINIMA_DO_CONTORNO, FAMILIA_ROTULO, FONTES_ROTULO, type FeicaoMalha, type Poligono, type Caixa, type ObstaculoRotulo, type RotuloPosto,
} from "@/lib/mapa-rotulos-es";

const malha = JSON.parse(readFileSync("src/lib/malha-es.json", "utf8")) as { features: FeicaoMalha[] };
// Medida de teste: largura proporcional à letra (uma negrito de verdade mede ~0,6 do corpo).
const medir = (t: string, f: number) => t.length * f * 0.6;
const TELA_TODA: Caixa = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 };

const projetarPoligonos = (f: FeicaoMalha, z: number): Poligono[] => poligonosDaFeicao(f.geometry).map((p) => p.map((a) => a.map(([lng, lat]) => projetar(lng, lat, z))));
const feicao = (nome: string) => malha.features.find((f) => f.properties.nome === nome)!;
const rotulosEm = (zoom: number, obstaculos: ObstaculoRotulo[] = []) => calcularRotulos({ feicoes: malha.features, zoom, visao: TELA_TODA, obstaculos, medir });
const caixaDoRotulo = (r: RotuloPosto): Caixa => ({ x0: r.x - r.largura / 2, y0: r.y - r.altura / 2, x1: r.x + r.largura / 2, y1: r.y + r.altura / 2 });

describe("a projeção é a do Leaflet com o OpenStreetMap", () => {
  it("pontos conhecidos do azulejo de 256 px", () => {
    expect(projetar(-180, 0, 0)).toEqual([0, 128]);
    expect(projetar(0, 0, 0)[0]).toBeCloseTo(128, 6);
    expect(projetar(0, 0, 0)[1]).toBeCloseTo(128, 6);
    // Cada zoom dobra a escala.
    const [x1] = projetar(-40.3, -20.3, 8);
    const [x2] = projetar(-40.3, -20.3, 9);
    expect(x2).toBeCloseTo(x1 * 2, 6);
  });

  it("ida e volta devolve o mesmo ponto", () => {
    for (const [lng, lat] of [[-41.5, -20.7], [-40.3, -19.2], [-39.7, -18.0]] as const) {
      const [x, y] = projetar(lng, lat, 9);
      const [lng2, lat2] = desprojetar(x, y, 9);
      expect(lng2).toBeCloseTo(lng, 9);
      expect(lat2).toBeCloseTo(lat, 9);
    }
  });
});

describe("geometria: o retângulo do texto está inteiro dentro da cidade?", () => {
  const quadrado: Poligono = [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]];
  const comBuraco: Poligono = [...quadrado, [[40, 40], [60, 40], [60, 60], [40, 60], [40, 40]]];

  it("dentro", () => expect(caixaDentro({ x0: 10, y0: 10, x1: 30, y1: 30 }, quadrado)).toBe(true));
  it("atravessando a divisa", () => expect(caixaDentro({ x0: 90, y0: 40, x1: 110, y1: 60 }, quadrado)).toBe(false));
  it("fora", () => expect(caixaDentro({ x0: 200, y0: 200, x1: 220, y1: 210 }, quadrado)).toBe(false));
  it("com o centro dentro mas a divisa passando por uma ponta", () => {
    const L: Poligono = [[[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100], [0, 0]]];
    // Centro em (30,30) está dentro do "L", mas a caixa 10..60 x 10..60 invade o recorte.
    expect(caixaDentro({ x0: 10, y0: 10, x1: 50, y1: 50 }, L)).toBe(false);
    expect(caixaDentro({ x0: 5, y0: 5, x1: 35, y1: 35 }, L)).toBe(true);
  });
  it("buraco: a caixa em cima do buraco não vale, ao lado dele vale", () => {
    expect(pontoDentro(50, 50, comBuraco)).toBe(false);
    expect(caixaDentro({ x0: 35, y0: 45, x1: 65, y1: 55 }, comBuraco)).toBe(false);
    expect(caixaDentro({ x0: 5, y0: 45, x1: 30, y1: 55 }, comBuraco)).toBe(true);
  });
});

describe("quebra do nome em linhas", () => {
  it("nome de uma palavra: só uma linha", () => {
    expect(variantesDeLinhas("Ibatiba", 11, medir)).toEqual([["Ibatiba"]]);
  });
  it("nome composto: uma linha e a divisão que deixa a linha mais longa a mais curta possível", () => {
    expect(variantesDeLinhas("Cachoeiro de Itapemirim", 11, medir)).toEqual([["Cachoeiro de Itapemirim"], ["Cachoeiro de", "Itapemirim"]]);
    expect(variantesDeLinhas("Barra de São Francisco", 11, medir)[1]).toEqual(["Barra de São", "Francisco"]);
    expect(variantesDeLinhas("Divino de São Lourenço", 11, medir)[1]).toEqual(["Divino de", "São Lourenço"]); // 12 letras na maior, e não 13
  });
  it("a letra pesa na escolha da divisão (palavra larga fica sozinha)", () => {
    const larga = (t: string) => (t === "Extraordinariamente" ? 500 : t.length * 6);
    expect(variantesDeLinhas("Extraordinariamente Curto", 11, (t) => larga(t))[1]).toEqual(["Extraordinariamente", "Curto"]);
  });
});

describe("os nomes no mapa real (78 municípios)", () => {
  for (const zoom of [8, 9, 10, 11]) {
    describe(`zoom ${zoom}`, () => {
      const rotulos = rotulosEm(zoom);

      it("todo nome cabe INTEIRO dentro da própria cidade (conferido ponto a ponto)", () => {
        expect(rotulos.length).toBeGreaterThan(0);
        for (const r of rotulos) {
          const poligonos = projetarPoligonos(feicao(r.nome), zoom);
          const c = caixaDoRotulo(r);
          // Caminho independente do `caixaDentro`: 21 x 7 pontos do retângulo, todos têm de cair na cidade.
          for (let i = 0; i <= 20; i++) {
            for (let j = 0; j <= 6; j++) {
              const x = c.x0 + ((c.x1 - c.x0) * i) / 20;
              const y = c.y0 + ((c.y1 - c.y0) * j) / 6;
              expect(poligonos.some((p) => pontoDentro(x, y, p)), `${r.nome}: ponto ${x.toFixed(1)},${y.toFixed(1)} fora da cidade`).toBe(true);
            }
          }
        }
      });

      it("a letra é uma da lista (nunca menor que 10 px) e o texto tem 1 ou 2 linhas do próprio nome", () => {
        for (const r of rotulos) {
          expect(FONTES_ROTULO).toContain(r.fonte);
          expect(r.fonte).toBeGreaterThanOrEqual(10);
          expect([1, 2]).toContain(r.linhas.length);
          expect(r.linhas.join(" ")).toBe(r.nome);
        }
      });

      it("nenhum nome encosta em outro", () => {
        const caixas = rotulos.map(caixaDoRotulo);
        for (let i = 0; i < caixas.length; i++) {
          for (let j = i + 1; j < caixas.length; j++) {
            const a = caixas[i];
            const b = caixas[j];
            const cruza = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
            expect(cruza, `${rotulos[i].nome} × ${rotulos[j].nome}`).toBe(false);
          }
        }
      });
    });
  }

  it("quanto mais perto, mais nomes: aproximar só acrescenta (nunca some um que já cabia)", () => {
    const por = [7, 8, 9, 10, 11].map((z) => new Set(rotulosEm(z).map((r) => r.nome)));
    for (let i = 1; i < por.length; i++) {
      expect(por[i].size).toBeGreaterThanOrEqual(por[i - 1].size);
      for (const n of por[i - 1]) expect(por[i].has(n), `${n} sumiu ao aproximar`).toBe(true);
    }
    expect(por[0].size).toBeLessThan(por[4].size);
    // Bem perto, quase todas as cidades têm nome.
    expect(por[4].size).toBeGreaterThanOrEqual(70);
  });

  it("de longe, cidade pequena fica SEM nome (e não com o nome cortado)", () => {
    const longe = new Set(rotulosEm(7).map((r) => r.nome));
    for (const pequena of ["Vitória", "Fundão", "Viana", "Marataízes", "Apiacá"]) expect(longe.has(pequena), pequena).toBe(false);
    // E nenhuma cidade ganha nome maior que ela: cada nome mede menos que a caixa da cidade.
    for (const r of rotulosEm(7)) {
      const caixas = projetarPoligonos(feicao(r.nome), 7).map((p) => ({ w: Math.max(...p[0].map((q) => q[0])) - Math.min(...p[0].map((q) => q[0])), h: Math.max(...p[0].map((q) => q[1])) - Math.min(...p[0].map((q) => q[1])) }));
      expect(caixas.some((c) => c.w >= r.largura && c.h >= r.altura), r.nome).toBe(true);
    }
  });

  it("cidade grande ganha a letra maior; a apertada, o nome em duas linhas ou a letra menor", () => {
    const z = 9;
    const por = new Map(rotulosEm(z).map((r) => [r.nome, r]));
    // Cidade de área grande no ES: letra 12 e uma linha.
    const folgada = [...por.values()].filter((r) => r.fonte === 12 && r.linhas.length === 1);
    expect(folgada.length).toBeGreaterThan(5);
    const apertada = [...por.values()].filter((r) => r.fonte < 12 || r.linhas.length === 2);
    expect(apertada.length).toBeGreaterThan(0);
    expect(apertada.some((r) => r.linhas.length === 2)).toBe(true); // "Cachoeiro de / Itapemirim"
    expect(apertada.some((r) => r.fonte < 12)).toBe(true); // 11 e 10 px quando o 12 não cabe nem em duas linhas
  });
});

describe("pins e cifrões por cima do mapa: o nome não é escrito embaixo deles", () => {
  const zoom = 10;
  const [lng, lat] = feicao("Cachoeiro de Itapemirim").properties.c!;
  const sem = rotulosEm(zoom).find((r) => r.nome === "Cachoeiro de Itapemirim")!;

  it("sem obstáculo, Cachoeiro tem nome no ponto de partida", () => {
    expect(sem).toBeDefined();
    const [ax, ay] = projetar(lng, lat, zoom);
    expect(Math.hypot(sem.x - ax, sem.y - ay)).toBeLessThan(1);
  });

  it("com um cifrão em cima do ponto de partida, o nome se desloca para um lugar livre da mesma cidade (ou some) — nunca embaixo do cifrão", () => {
    const cifrao: ObstaculoRotulo = { lng, lat, esq: -20, dir: 20, cima: -20, baixo: 20 };
    const com = rotulosEm(zoom, [cifrao]).find((r) => r.nome === "Cachoeiro de Itapemirim");
    expect(com).toBeDefined(); // a cidade é grande: sobra lugar
    const [ox, oy] = projetar(lng, lat, zoom);
    const o: Caixa = { x0: ox - 20, y0: oy - 20, x1: ox + 20, y1: oy + 20 };
    const c = caixaDoRotulo(com!);
    expect(c.x0 < o.x1 && c.x1 > o.x0 && c.y0 < o.y1 && c.y1 > o.y0).toBe(false);
    // Continua dentro da cidade.
    const poligonos = projetarPoligonos(feicao("Cachoeiro de Itapemirim"), zoom);
    expect(poligonos.some((p) => caixaDentro(c, p))).toBe(true);
  });

  it("obstáculo que cobre a cidade inteira: sem nome (o toque/dica continua dizendo qual é)", () => {
    const tudo: ObstaculoRotulo = { lng, lat, esq: -5000, dir: 5000, cima: -5000, baixo: 5000 };
    expect(rotulosEm(zoom, [tudo]).find((r) => r.nome === "Cachoeiro de Itapemirim")).toBeUndefined();
  });

  it("obstáculo em OUTRA cidade não mexe no nome desta", () => {
    const [vl, vt] = feicao("Vitória").properties.c!;
    const outra = rotulosEm(zoom, [{ lng: vl, lat: vt, esq: -30, dir: 30, cima: -30, baixo: 30 }]).find((r) => r.nome === "Cachoeiro de Itapemirim")!;
    expect(outra.x).toBe(sem.x);
    expect(outra.y).toBe(sem.y);
  });
});

describe("o nome fica inteiro dentro da parte visível do mapa e longe dos botões", () => {
  const zoom = 10;
  const [lng, lat] = feicao("Cachoeiro de Itapemirim").properties.c!;
  const [ax, ay] = projetar(lng, lat, zoom);

  it("com a tela cortando a cidade, o nome sai inteiro dentro da tela (ou não sai) — nunca cortado na borda", () => {
    // Uma tela que passa no meio de Cachoeiro: a borda direita corta a cidade.
    for (const corte of [30, 60, 90, 140]) {
      const visao: Caixa = { x0: ax - 400, y0: ay - 300, x1: ax + corte, y1: ay + 300 };
      for (const r of calcularRotulos({ feicoes: malha.features, zoom, visao, medir })) {
        const c = caixaDoRotulo(r);
        expect(c.x0, r.nome).toBeGreaterThanOrEqual(visao.x0);
        expect(c.x1, r.nome).toBeLessThanOrEqual(visao.x1);
        expect(c.y0, r.nome).toBeGreaterThanOrEqual(visao.y0);
        expect(c.y1, r.nome).toBeLessThanOrEqual(visao.y1);
      }
    }
  });

  it("o nome de uma cidade que só aparece em parte desloca para a parte visível quando cabe", () => {
    // A tela termina 20 px depois do ponto de partida: o nome (≥ 60 px de largura) não cabe na ponta, mas cabe à esquerda.
    const visao: Caixa = { x0: ax - 400, y0: ay - 300, x1: ax + 20, y1: ay + 300 };
    const r = calcularRotulos({ feicoes: malha.features, zoom, visao, medir }).find((x) => x.nome === "Cachoeiro de Itapemirim");
    expect(r).toBeDefined();
    expect(caixaDoRotulo(r!).x1).toBeLessThanOrEqual(visao.x1);
  });

  it("botões do mapa (+ / −, créditos) entram como obstáculo em pixels", () => {
    const botoes: Caixa[] = [{ x0: ax - 500, y0: ay - 500, x1: ax + 500, y1: ay + 500 }];
    const r = calcularRotulos({ feicoes: malha.features, zoom, visao: TELA_TODA, obstaculosPx: botoes, medir });
    expect(r.find((x) => x.nome === "Cachoeiro de Itapemirim")).toBeUndefined();
    // Os de fora da caixa seguem normais.
    expect(r.length).toBeGreaterThan(20);
  });
});

describe("o trajeto do dia (linha tracejada) não corta nenhum nome", () => {
  const zoom = 10;
  const [lng, lat] = feicao("Cachoeiro de Itapemirim").properties.c!;
  const sem = rotulosEm(zoom).find((r) => r.nome === "Cachoeiro de Itapemirim")!;
  // Um trajeto que atravessa o ponto de partida de Cachoeiro de ponta a ponta, na horizontal.
  const rota: [number, number][] = [[lat, lng - 0.2], [lat, lng + 0.2]];

  it("o nome se desloca para um lugar que o traço não toca", () => {
    const com = calcularRotulos({ feicoes: malha.features, zoom, visao: TELA_TODA, rota, medir }).find((r) => r.nome === "Cachoeiro de Itapemirim");
    expect(com).toBeDefined();
    expect(com!.y).not.toBe(sem.y);
    const [ax, ay] = projetar(lng - 0.2, lat, zoom);
    const [bx, by] = projetar(lng + 0.2, lat, zoom);
    const c = caixaDoRotulo(com!);
    expect(segmentoToca(ax, ay, bx, by, { x0: c.x0 - 3, y0: c.y0 - 3, x1: c.x1 + 3, y1: c.y1 + 3 })).toBe(false);
  });

  it("nenhum nome de nenhuma cidade fica cortado pelo trajeto (todas as cidades, com folga de 3 px)", () => {
    const longa: [number, number][] = [[-21.1, -41.6], [-20.2, -40.9], [-19.4, -40.3], [-20.5, -40.4], [-19.0, -41.0]];
    const pts = longa.map(([la, ln]) => projetar(ln, la, zoom));
    for (const r of calcularRotulos({ feicoes: malha.features, zoom, visao: TELA_TODA, rota: longa, medir })) {
      const c = caixaDoRotulo(r);
      const larga = { x0: c.x0 - 3, y0: c.y0 - 3, x1: c.x1 + 3, y1: c.y1 + 3 };
      for (let i = 1; i < pts.length; i++) expect(segmentoToca(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], larga), `${r.nome} × trecho ${i}`).toBe(false);
    }
  });

  it("sem trajeto (ou com um ponto só) nada muda", () => {
    expect(calcularRotulos({ feicoes: malha.features, zoom, visao: TELA_TODA, rota: [[lat, lng]], medir })).toEqual(rotulosEm(zoom));
    expect(calcularRotulos({ feicoes: malha.features, zoom, visao: TELA_TODA, rota: [], medir })).toEqual(rotulosEm(zoom));
  });
});

describe("a letra do nome cabe dentro de style=\"...\"", () => {
  it("a família não tem aspas duplas (o atributo fechava no meio e a cor se perdia)", () => {
    expect(FAMILIA_ROTULO).not.toContain('"');
    const html = `<span style="font:700 12px/14px ${FAMILIA_ROTULO};color:#111827;text-shadow:0 0 3px rgba(255,255,255,0.55)">x</span>`;
    // Um style="..." fechado só no fim: depois do primeiro fecha-aspas não sobra nada de estilo.
    const estilo = html.match(/style="([^"]*)"/)![1];
    expect(estilo).toContain("color:#111827");
    expect(estilo).toContain("text-shadow");
  });

  it("o componente monta o atributo com essa família e nenhuma aspa dupla solta", () => {
    const fonte = readFileSync("src/components/RotulosMunicipiosES.tsx", "utf8");
    expect(fonte).toMatch(/font:\$\{PESO_ROTULO\} \$\{r\.fonte\}px\/[^;]*\$\{FAMILIA_ROTULO\};color:\$\{cor\};text-shadow/);
  });
});

describe("contorno do estado sem as ilhotas", () => {
  it("tira os pedaços minúsculos (ilhas de Vitória, Vila Velha, Guarapari…) e mantém as 78 cidades", () => {
    const limpa = semIlhotas(malha.features);
    expect(limpa).toHaveLength(78);
    const contar = (fs: readonly FeicaoMalha[]) => fs.reduce((n, f) => n + poligonosDaFeicao(f.geometry).length, 0);
    expect(contar(limpa)).toBeLessThan(contar(malha.features));
    for (const f of limpa) {
      for (const p of poligonosDaFeicao(f.geometry)) {
        let soma = 0;
        for (let i = 0; i < p[0].length - 1; i++) soma += p[0][i][0] * p[0][i + 1][1] - p[0][i + 1][0] * p[0][i][1];
        expect(Math.abs(soma) / 2, f.properties.nome).toBeGreaterThanOrEqual(AREA_MINIMA_DO_CONTORNO);
      }
    }
    // A ilha principal de Vitória (a cidade) continua: só ilhotas saem.
    expect(poligonosDaFeicao(limpa.find((f) => f.properties.nome === "Vitória")!.geometry).length).toBeGreaterThanOrEqual(1);
  });
});

describe("só calcula o que aparece na tela", () => {
  it("cidade fora da área visível não entra (e a área inteira entra)", () => {
    const [ax, ay] = projetar(...(feicao("Cachoeiro de Itapemirim").properties.c as [number, number]), 10);
    const visao: Caixa = { x0: ax - 200, y0: ay - 200, x1: ax + 200, y1: ay + 200 };
    const so = calcularRotulos({ feicoes: malha.features, zoom: 10, visao, medir }).map((r) => r.nome);
    expect(so).toContain("Cachoeiro de Itapemirim");
    expect(so).not.toContain("Conceição da Barra"); // extremo norte do ES
    expect(so.length).toBeLessThan(rotulosEm(10).length);
  });
});

describe("sem o ponto de partida (`c`) a conta ainda funciona", () => {
  it("usa o centro da caixa da cidade", () => {
    const sem = { ...feicao("Cachoeiro de Itapemirim"), properties: { nome: "Cachoeiro de Itapemirim" } };
    const r = calcularRotulos({ feicoes: [sem], zoom: 10, visao: TELA_TODA, medir });
    expect(r).toHaveLength(1);
  });

  it("posicionarRotulo devolve null quando nem a caixa da cidade comporta o texto", () => {
    const pequeno: Poligono[] = [[[[0, 0], [20, 0], [20, 10], [0, 10], [0, 0]]]];
    const r = posicionarRotulo({ nome: "Cachoeiro de Itapemirim", poligonos: pequeno, ancora: [10, 5], area: TELA_TODA, obstaculos: [], medir });
    expect(r).toBeNull();
  });
});
