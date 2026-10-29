// Os nomes das cidades escritos DENTRO de cada cidade, no mapa por região (23/10).
//
// Ele reclamou: "sobrepondo o nome das cidades, não enquadrados e não aparecem
// direito". O que este teste trava, contra a malha REAL dos 78 municípios:
//  1. todo nome escrito cabe INTEIRO dentro da própria cidade (conferido por um
//     caminho independente: 21 x 7 pontos do retângulo do texto, um a um);
//  2. dois nomes nunca se encostam, e nenhum nome fica embaixo de um pin/cifrão;
//  3. aproximar o mapa só ACRESCENTA nomes (nunca some um que já cabia);
//  4. cidade pequena demais para o zoom fica SEM nome — não com nome cortado;
//  5. a conta não depende do navegador (é pura): dá para rodar aqui.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  projetar, desprojetar, pontoDentro, caixaDentro, segmentoToca, variantesDeLinhas, calcularRotulos, posicionarRotulo, poligonosDaFeicao,
  semIlhotas, caixaVisivel, botaoEmPx, alturaDaLinha, AREA_MINIMA_DO_CONTORNO, FAMILIA_ROTULO, FONTES_ROTULO, FOLGA_X, FOLGA_Y, type FeicaoMalha, type Poligono, type Caixa, type ObstaculoRotulo, type RotuloPosto,
} from "@/lib/mapa-rotulos-es";

const malha = JSON.parse(readFileSync("src/lib/malha-es.json", "utf8")) as { features: FeicaoMalha[] };
const ler = (arquivo: string) => readFileSync(arquivo, "utf8");
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
  it("cruzando CADA um dos quatro lados (com o centro dentro): a divisa de cima é a primeira do anel e também conta", () => {
    expect(caixaDentro({ x0: 40, y0: -2, x1: 60, y1: 30 }, quadrado), "lado de cima (1º segmento)").toBe(false);
    expect(caixaDentro({ x0: 70, y0: 40, x1: 102, y1: 60 }, quadrado), "lado direito").toBe(false);
    expect(caixaDentro({ x0: 40, y0: 70, x1: 60, y1: 102 }, quadrado), "lado de baixo").toBe(false);
    expect(caixaDentro({ x0: -2, y0: 40, x1: 30, y1: 60 }, quadrado), "lado esquerdo (último segmento)").toBe(false);
  });
  it("buraco: a caixa em cima do buraco não vale, ao lado dele vale", () => {
    expect(pontoDentro(50, 50, comBuraco)).toBe(false);
    expect(caixaDentro({ x0: 35, y0: 45, x1: 65, y1: 55 }, comBuraco)).toBe(false);
    expect(caixaDentro({ x0: 5, y0: 45, x1: 30, y1: 55 }, comBuraco)).toBe(true);
  });
});

describe("a altura de cada linha do nome", () => {
  it("é a da letra x 1,15 arredondada (números literais: 12 → 14, 11 → 13, 10 → 12) — a mesma na medida e no CSS do nome", () => {
    expect(alturaDaLinha(12)).toBe(14);
    expect(alturaDaLinha(11)).toBe(13);
    expect(alturaDaLinha(10)).toBe(12);
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
          // A caixa tem de ser a do TEXTO de verdade: a largura medida da maior linha e a altura de cada
          // linha, mais a folga. Sem isto, uma caixa menor que o texto passava (o texto vazava da cidade).
          const maiorLinha = Math.max(...r.linhas.map((l) => medir(l, r.fonte)));
          expect(r.largura, `${r.nome}: largura`).toBeGreaterThanOrEqual(Math.ceil(maiorLinha) + 2 * FOLGA_X);
          expect(r.altura, `${r.nome}: altura`).toBeGreaterThanOrEqual(r.linhas.length * alturaDaLinha(r.fonte) + 2 * FOLGA_Y);
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

  it("obstáculo que se estende só para UM lado (esq/dir/cima/baixo diferentes): o nome sai da caixa certa, não do espelho dela", () => {
    // Com ±20 simétrico, trocar esq por dir (ou cima por baixo) passava despercebido. Aqui cada obstáculo é um bloco
    // grosso que avança 120 px para um lado e quase nada para o outro, a partir do ponto de partida — o espelho
    // dele cairia do lado oposto e o nome ficaria em cima do bloco de verdade.
    const [ox, oy] = projetar(lng, lat, zoom);
    const blocos: [string, Pick<ObstaculoRotulo, "esq" | "dir" | "cima" | "baixo">][] = [
      ["direita", { esq: -5, dir: 120, cima: -120, baixo: 120 }],
      ["esquerda", { esq: -120, dir: 5, cima: -120, baixo: 120 }],
      ["baixo", { esq: -120, dir: 120, cima: -5, baixo: 120 }],
      ["cima", { esq: -120, dir: 120, cima: -120, baixo: 5 }],
    ];
    for (const [lado, caixa] of blocos) {
      const ob: ObstaculoRotulo = { lng, lat, ...caixa };
      const r = rotulosEm(zoom, [ob]).find((x) => x.nome === "Cachoeiro de Itapemirim");
      expect(r, `${lado}: sobra lugar do outro lado`).toBeDefined();
      const c = caixaDoRotulo(r!);
      const o: Caixa = { x0: ox + ob.esq, y0: oy + ob.cima, x1: ox + ob.dir, y1: oy + ob.baixo };
      expect(c.x0 < o.x1 && c.x1 > o.x0 && c.y0 < o.y1 && c.y1 > o.y0, `${lado}: o nome cobre o obstáculo`).toBe(false);
    }
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
    // A altura de linha é a MESMA função que mediu a caixa (alturaDaLinha); um fator escrito à mão aqui desalinharia texto e caixa.
    expect(fonte).toMatch(/font:\$\{PESO_ROTULO\} \$\{r\.fonte\}px\/\$\{alturaDaLinha\(r\.fonte\)\}px \$\{FAMILIA_ROTULO\};color:\$\{cor\};text-shadow/);
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

describe("a parte da cidade que APARECE na tela (caixaVisivel)", () => {
  const quadrado = [[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]] as [number, number][];
  const area: Caixa = { x0: 0, y0: 0, x1: 1000, y1: 1000 };

  it("cidade inteira à vista: a própria caixa", () => {
    expect(caixaVisivel(quadrado, area)).toEqual({ x0: 100, y0: 100, x1: 300, y1: 300 });
  });
  it("cortada pela borda da tela: só o pedaço de dentro", () => {
    expect(caixaVisivel(quadrado, { x0: 250, y0: 0, x1: 1000, y1: 1000 })).toEqual({ x0: 250, y0: 100, x1: 300, y1: 300 });
    expect(caixaVisivel(quadrado, { x0: 0, y0: 0, x1: 180, y1: 150 })).toEqual({ x0: 100, y0: 100, x1: 180, y1: 150 });
  });
  it("a tela dentro da cidade (cidade enche a tela): a própria tela", () => {
    expect(caixaVisivel(quadrado, { x0: 150, y0: 150, x1: 200, y1: 220 })).toEqual({ x0: 150, y0: 150, x1: 200, y1: 220 });
  });
  it("cidade fora da tela: null", () => {
    expect(caixaVisivel(quadrado, { x0: 400, y0: 0, x1: 600, y1: 600 })).toBeNull();
    expect(caixaVisivel(quadrado, { x0: 0, y0: 400, x1: 600, y1: 600 })).toBeNull();
  });
  it("anel aberto (sem repetir o primeiro ponto) dá o mesmo que o fechado", () => {
    expect(caixaVisivel(quadrado.slice(0, -1), { x0: 250, y0: 0, x1: 1000, y1: 1000 })).toEqual(caixaVisivel(quadrado, { x0: 250, y0: 0, x1: 1000, y1: 1000 }));
  });
  it("divisa em DIAGONAL: o corte interpola pela reta (um triângulo cortado à direita fica com a altura da reta, não zero)", () => {
    const triangulo: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 0]];
    // 0 ≤ y ≤ x: até x = 60 a cidade chega a y = 60.
    expect(caixaVisivel(triangulo, { x0: 0, y0: 0, x1: 60, y1: 200 })).toEqual({ x0: 0, y0: 0, x1: 60, y1: 60 });
    // Cortado pelos QUATRO lados da tela ao mesmo tempo.
    expect(caixaVisivel(triangulo, { x0: 20, y0: 10, x1: 80, y1: 70 })).toEqual({ x0: 20, y0: 10, x1: 80, y1: 70 });
    // Só a ponta de baixo da reta aparece: a tela encosta na diagonal.
    expect(caixaVisivel(triangulo, { x0: 0, y0: 40, x1: 50, y1: 200 })).toEqual({ x0: 40, y0: 40, x1: 50, y1: 50 });
  });

  it("formato em L cortado: a caixa só do que sobra na tela", () => {
    const L = [[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100], [0, 0]] as [number, number][];
    expect(caixaVisivel(L, { x0: 0, y0: 60, x1: 200, y1: 200 })).toEqual({ x0: 0, y0: 60, x1: 40, y1: 100 });
  });
});

describe("cidade grande vista de perto: o nome fica no MEIO do que aparece, não colado na borda", () => {
  // Um município de 2000 x 2000 px; a tela mostra só um pedaço dele, e o ponto de partida (c) fica fora da tela.
  const grande: Poligono[] = [[[[0, 0], [2000, 0], [2000, 2000], [0, 2000], [0, 0]]]];
  const tela: Caixa = { x0: 800, y0: 300, x1: 1400, y1: 700 };
  const centro = { x: 1100, y: 500 };

  it("com o ponto de partida fora da tela, o nome vem para o centro da parte visível", () => {
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: grande, ancora: [100, 100], area: tela, obstaculos: [], medir });
    expect(r).not.toBeNull();
    // Antes ia para o canto da tela mais perto do ponto de partida (a ~270 px do centro).
    expect(Math.abs(r!.x - centro.x), "x").toBeLessThanOrEqual(12);
    expect(Math.abs(r!.y - centro.y), "y").toBeLessThanOrEqual(12);
  });

  it("com o ponto de partida DENTRO da tela e livre, o nome fica nele (nada muda)", () => {
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: grande, ancora: [900, 400], area: tela, obstaculos: [], medir });
    expect([r!.x, r!.y]).toEqual([900, 400]);
  });

  it("com o ponto de partida dentro da tela mas tampado, procura o lugar livre mais perto DELE", () => {
    const tampa: Caixa = { x0: 860, y0: 370, x1: 940, y1: 430 };
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: grande, ancora: [900, 400], area: tela, obstaculos: [tampa], medir });
    expect(r).not.toBeNull();
    const c = caixaDoRotulo(r!);
    expect(c.x0 < tampa.x1 && c.x1 > tampa.x0 && c.y0 < tampa.y1 && c.y1 > tampa.y0).toBe(false);
    expect(Math.hypot(r!.x - 900, r!.y - 400)).toBeLessThan(80);
  });

  it("no mapa real: Baixo Guandu enchendo a tela (zoom 13) não fica colada na borda", () => {
    const zoom = 13;
    const [cx, cy] = projetar(-40.9, -19.55, zoom);
    const visao: Caixa = { x0: cx - 550, y0: cy - 230, x1: cx + 550, y1: cy + 230 };
    const r = calcularRotulos({ feicoes: malha.features, zoom, visao, medir }).find((x) => x.nome === "Baixo Guandu");
    expect(r).toBeDefined();
    const c = caixaDoRotulo(r!);
    // 60 px de ar até a borda da tela: antes ficava a 4 px (no canto).
    expect(c.x0 - visao.x0).toBeGreaterThanOrEqual(60);
    expect(visao.x1 - c.x1).toBeGreaterThanOrEqual(60);
    expect(c.y0 - visao.y0).toBeGreaterThanOrEqual(60);
    expect(visao.y1 - c.y1).toBeGreaterThanOrEqual(60);
  });
});

describe("a busca acha o lugar que existe", () => {
  it("faixa estreita: um texto que só cabe numa janela de 2 px é achado (o passo fixo de 4 px saltava por cima dela)", () => {
    // Texto 48 x 18 (40 de largura + 2 x 4 de folga; 14 de linha + 2 x 2). A cidade tem 51 de largura:
    // o centro só vale entre 124 e 127 (sem encostar nas divisas em 100 e 151).
    const faixa: Poligono[] = [[[[100, 100], [151, 100], [151, 200], [100, 200], [100, 100]]]];
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: faixa, ancora: [500, 500], area: { x0: 0, y0: 0, x1: 1000, y1: 1000 }, obstaculos: [], medir: () => 40, fontes: [12] });
    expect(r).not.toBeNull();
    expect(r!.x).toBeGreaterThan(124);
    expect(r!.x).toBeLessThan(127);
    expect(caixaDentro(caixaDoRotulo(r!), faixa[0])).toBe(true);
  });

  it("o passo sai só da janela onde o centro PODE ficar (encolhida a meia caixa de texto), não da cidade inteira", () => {
    // Cidade de 49,5 x 200: o centro só vale entre 124 e 125,5 (um ponto inteiro: 125). Contando a caixa inteira
    // (10 mil pontos) o passo viraria 2 e saltaria por cima do 125 — sem nome, havendo lugar.
    const alta: Poligono[] = [[[[100, 100], [149.5, 100], [149.5, 300], [100, 300], [100, 100]]]];
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: alta, ancora: [500, 500], area: { x0: 0, y0: 0, x1: 1000, y1: 1000 }, obstaculos: [], medir: () => 40, fontes: [12] });
    expect(r).not.toBeNull();
    expect(r!.x).toBe(125);
    expect(caixaDentro(caixaDoRotulo(r!), alta[0])).toBe(true);
  });

  it("junto da borda da tela: o centro pode ir até a meia largura da borda (a conta antiga desperdiçava essa faixa)", () => {
    // A cidade ocupa a tela toda, o ponto de partida está tampado e só sobra a faixa colada à borda esquerda.
    const cidade: Poligono[] = [[[[0, 0], [400, 0], [400, 100], [0, 100], [0, 0]]]];
    const tela: Caixa = { x0: 10, y0: 10, x1: 400 - 1, y1: 90 };
    const tampa: Caixa = { x0: 10 + 60, y0: 0, x1: 400, y1: 100 }; // só os 60 px da esquerda ficam livres
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: cidade, ancora: [200, 50], area: tela, obstaculos: [tampa], medir: () => 40, fontes: [12] });
    expect(r).not.toBeNull();
    expect(caixaDoRotulo(r!).x0).toBeGreaterThanOrEqual(tela.x0);
    expect(caixaDoRotulo(r!).x1).toBeLessThanOrEqual(tampa.x0);
  });

  it("lugar colado na PONTA da janela: a grade grossa tem de cobrir também além da ponta (meio passo)", () => {
    // Cidade de 51,2 de largura (100 a 151,2) e texto 48 x 18: o centro vale em x 124–127,2. Um obstáculo à esquerda
    // deixa livre só x 126,1–127,2 — a última 1 px da janela. Uma grade grossa que parasse na ponta da janela
    // (124, 128 já fora) ficaria a mais de meio passo desse lugar e daria o nome como sem lugar.
    const faixa: Poligono[] = [[[[100, 100], [151.2, 100], [151.2, 300], [100, 300], [100, 100]]]];
    const tampa: Caixa = { x0: 90, y0: 90, x1: 102.1, y1: 310 };
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: faixa, ancora: [500, 500], area: { x0: 0, y0: 0, x1: 1000, y1: 1000 }, obstaculos: [tampa], medir: () => 40, fontes: [12] });
    expect(r).not.toBeNull();
    expect(r!.x).toBeGreaterThanOrEqual(126.1);
    expect(r!.x).toBeLessThan(127.2);
  });

  it("bolsão estreito num lugar GRANDE e longe do ponto de partida: achado (a varredura de passo fixo pulava por cima)", () => {
    // Cidade de 400 x 400 e texto 48 x 18. Quatro obstáculos deixam livre só um bolsão onde o CENTRO do texto
    // vale em x 200–202,5 e y 99–101,5 (2,5 px de folga). Uma varredura de passo 7 (o que a conta antiga fazia
    // nesta janela) cai em 199/206 e 93/100/107 e passa ao largo.
    const cidade: Poligono[] = [[[[0, 0], [400, 0], [400, 400], [0, 400], [0, 0]]]];
    const obstaculos: Caixa[] = [
      { x0: -10, y0: -10, x1: 410, y1: 90 }, // em cima
      { x0: -10, y0: 110.5, x1: 410, y1: 410 }, // embaixo
      { x0: -10, y0: 90, x1: 176, y1: 110.5 }, // à esquerda
      { x0: 226.5, y0: 90, x1: 410, y1: 110.5 }, // à direita
    ];
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: cidade, ancora: [30, 30], area: { x0: 0, y0: 0, x1: 400, y1: 400 }, obstaculos, medir: () => 40, fontes: [12] });
    expect(r).not.toBeNull();
    expect(r!.x).toBeGreaterThanOrEqual(200);
    expect(r!.x).toBeLessThanOrEqual(202.5);
    expect(r!.y).toBeGreaterThanOrEqual(99);
    expect(r!.y).toBeLessThanOrEqual(101.5);
  });
});

describe("a folga entre o texto e a divisa (números literais, não as constantes do código)", () => {
  // Texto de 40 de largura e fonte 12: caixa de 48 x 18 (4 px de folga dos lados, 2 em cima e embaixo).
  const area: Caixa = { x0: -1000, y0: -1000, x1: 1000, y1: 1000 };
  const faixa = (l: number, a: number): Poligono[] => [[[[0, 0], [l, 0], [l, a], [0, a], [0, 0]]]];
  const poe = (l: number, a: number) => posicionarRotulo({ nome: "Ibatiba", poligonos: faixa(l, a), ancora: [l / 2, a / 2], area, obstaculos: [], medir: () => 40, fontes: [12] });

  it("na vertical: a cidade precisa de 14 + 2 x 2 = 18 px de altura (17,5 não basta, 18,5 basta)", () => {
    expect(poe(200, 17.5)).toBeNull();
    expect(poe(200, 18.5)).not.toBeNull();
  });

  it("na horizontal: a cidade precisa de 40 + 2 x 4 = 48 px de largura (47,5 não basta, 48,5 basta)", () => {
    expect(poe(47.5, 100)).toBeNull();
    expect(poe(48.5, 100)).not.toBeNull();
  });
});

describe("cidade em dois pedaços, ponto de partida fora da tela: o nome vai para o MAIOR pedaço visível", () => {
  it("não para o menor", () => {
    const pequeno: Poligono = [[[0, 100], [100, 100], [100, 130], [0, 130], [0, 100]]];
    const grande: Poligono = [[[200, 0], [800, 0], [800, 300], [200, 300], [200, 0]]];
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: [pequeno, grande], ancora: [5000, 5000], area: { x0: 0, y0: 0, x1: 1000, y1: 400 }, obstaculos: [], medir, fontes: [12] });
    expect(r).not.toBeNull();
    expect(r!.x).toBeGreaterThan(200);
    expect(Math.abs(r!.x - 500)).toBeLessThanOrEqual(12);
    expect(Math.abs(r!.y - 150)).toBeLessThanOrEqual(12);
  });
});

describe("os botões do mapa viram obstáculo em pixels da projeção (botaoEmPx)", () => {
  it("soma a origem da parte visível e tira a posição do mapa na tela (origem ≠ 0 e mapa ≠ canto da tela)", () => {
    // Mapa a 50,60 da tela; parte visível começa em 1000,2000 da projeção; botão a 60,70 → 10,10 dentro do mapa.
    expect(botaoEmPx({ left: 60, top: 70, right: 100, bottom: 140 }, { left: 50, top: 60 }, { x: 1000, y: 2000 })).toEqual({ x0: 1007, y0: 2007, x1: 1053, y1: 2083 });
    expect(botaoEmPx({ left: 60, top: 70, right: 100, bottom: 140 }, { left: 50, top: 60 }, { x: 1000, y: 2000 }, 0)).toEqual({ x0: 1010, y0: 2010, x1: 1050, y1: 2080 });
  });

  it("o nome não é escrito embaixo do botão: com o botão em cima do ponto de partida o nome sai de lá", () => {
    const cidade: Poligono[] = [[[[0, 0], [400, 0], [400, 200], [0, 200], [0, 0]]]];
    const botao = botaoEmPx({ left: 150, top: 80, right: 250, bottom: 120 }, { left: 0, top: 0 }, { x: 0, y: 0 });
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: cidade, ancora: [200, 100], area: { x0: 0, y0: 0, x1: 400, y1: 200 }, obstaculos: [botao], medir: () => 40, fontes: [12] });
    expect(r).not.toBeNull();
    const c = caixaDoRotulo(r!);
    expect(c.x0 < botao.x1 && c.x1 > botao.x0 && c.y0 < botao.y1 && c.y1 > botao.y0).toBe(false);
  });

  it("o componente monta os botões com botaoEmPx e entrega ao cálculo (sem isso o nome ia para baixo do +/−)", () => {
    const src = ler("src/components/RotulosMunicipiosES.tsx");
    expect(src).toMatch(/querySelectorAll\("\.leaflet-control"\)/);
    expect(src).toMatch(/botaoEmPx\([^)]*getBoundingClientRect\(\)[^)]*caixaMapa, \{ x: x0, y: y0 \}\)/);
    expect(src).toMatch(/calcularRotulos\(\{[^}]*obstaculosPx[^}]*\}\)/);
  });
});

describe("o custo da conta (a cada arrasto/zoom do mapa)", () => {
  // Um município com 6000 vértices (a malha real tem até alguns milhares) e uma tela que só pega uma
  // tira dele, mais estreita que o texto. Antes: milhares de candidatos x 6000 vértices x 6 tentativas
  // (> 100 ms por movimento, no celular bem mais). Agora: a parte visível é recortada e a cidade sai na hora.
  const N = 6000;
  const R = 5000;
  const anel = Array.from({ length: N + 1 }, (_, i) => [R * Math.cos((2 * Math.PI * (i % N)) / N), R * Math.sin((2 * Math.PI * (i % N)) / N)] as [number, number]);
  const circulo: Poligono[] = [[anel]];

  it("cidade vista só como uma pontinha no canto da tela (menor que o texto): sem nome, e rápido", () => {
    // O canto (3530, 3530) da tela fica a 4992 do centro do círculo (raio 5000): só uma ponta de ~11 px
    // da cidade aparece, mas a caixa inteira dela (10000 x 10000) cobre a tela toda.
    const tela: Caixa = { x0: 3530, y0: 3530, x1: 3930, y1: 3930 };
    const t0 = performance.now();
    let r: RotuloPosto | null = null;
    for (let i = 0; i < 20; i++) r = posicionarRotulo({ nome: "Cachoeiro de Itapemirim", poligonos: circulo, ancora: [0, 0], area: tela, obstaculos: [], medir });
    const ms = (performance.now() - t0) / 20;
    expect(r).toBeNull();
    expect(ms, `${ms.toFixed(2)} ms por chamada`).toBeLessThan(25);
  });

  it("cidade grande que enche a tela: acha o nome no meio, rápido", () => {
    const tela: Caixa = { x0: -300, y0: -200, x1: 300, y1: 200 };
    const t0 = performance.now();
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: circulo, ancora: [4000, 4000], area: tela, obstaculos: [], medir });
    const ms = performance.now() - t0;
    expect(r).not.toBeNull();
    expect(Math.hypot(r!.x, r!.y)).toBeLessThan(20);
    expect(ms, `${ms.toFixed(2)} ms`).toBeLessThan(100);
  });

  // O custo se mede em quantas vezes a conta perguntou "o texto cabe aqui?" — tempo de relógio varia com a
  // máquina, a contagem não. A tela é a de um PC (1100 x 600); a cidade é maior que ela.
  describe("quantas vezes a conta pergunta \"cabe aqui?\" (tela de PC, 1100 x 600)", () => {
    const tela: Caixa = { x0: 0, y0: 0, x1: 1100, y1: 600 };
    const cidade: Poligono[] = [[[[-500, -500], [1600, -500], [1600, 1100], [-500, 1100], [-500, -500]]]];
    const contar = (obstaculos: Caixa[]) => {
      const contagem = { testes: 0 };
      const r = posicionarRotulo({ nome: "Ibatiba", poligonos: cidade, ancora: [30, 30], area: tela, obstaculos, medir: () => 40, fontes: [12], contagem });
      return { r, testes: contagem.testes };
    };

    it("o ponto de partida livre: uma pergunta só", () => {
      const { r, testes } = contar([]);
      expect(r).not.toBeNull();
      expect(testes).toBe(1);
    });

    it("nada cabe (a tela toda coberta): desiste depois de poucos milhares de perguntas, não de centenas de milhares", () => {
      const { r, testes } = contar([{ x0: -10, y0: -10, x1: 1110, y1: 610 }]);
      expect(r).toBeNull();
      expect(testes, `${testes} perguntas`).toBeLessThan(8000);
    });

    it("só cabe num bolsão longe do ponto de partida: acha, e sem varrer a tela inteira", () => {
      const { r, testes } = contar([
        { x0: -10, y0: -10, x1: 1110, y1: 290 },
        { x0: -10, y0: 310.5, x1: 1110, y1: 610 },
        { x0: -10, y0: 290, x1: 776, y1: 310.5 },
        { x0: 826.5, y0: 290, x1: 1110, y1: 310.5 },
      ]);
      expect(r).not.toBeNull();
      expect(r!.x).toBeGreaterThanOrEqual(800);
      expect(r!.x).toBeLessThanOrEqual(802.5);
      expect(testes, `${testes} perguntas`).toBeLessThan(5000);
    });

    it("janela pequena (cidade apertada): o custo é de dezenas de perguntas", () => {
      const faixa: Poligono[] = [[[[100, 100], [151, 100], [151, 200], [100, 200], [100, 100]]]];
      const contagem = { testes: 0 };
      const r = posicionarRotulo({ nome: "Ibatiba", poligonos: faixa, ancora: [500, 500], area: { x0: 0, y0: 0, x1: 1000, y1: 1000 }, obstaculos: [], medir: () => 40, fontes: [12], contagem });
      expect(r).not.toBeNull();
      expect(contagem.testes).toBeLessThan(400);
    });
  });
});
