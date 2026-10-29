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
  semIlhotas, caixaVisivel, botaoEmPx, botoesDoContainer, alturaDaLinha, AREA_MINIMA_DO_CONTORNO, FAMILIA_ROTULO, FONTES_ROTULO, FOLGA_X, FOLGA_Y, type FeicaoMalha, type Poligono, type Caixa, type ObstaculoRotulo, type RotuloPosto,
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

  it("desconta a borda do contêiner e a escala (rect.width / offsetWidth), como o Leaflet faz com o mouse", () => {
    // Contêiner a 50,60 da tela, com borda de 1 px e 0,05% maior na tela do que o offsetWidth diz (719,33 contra 719).
    const escala = 719.328125 / 719;
    const r = { left: 50 + 100 * escala, top: 60 + 40, right: 50 + 140 * escala, bottom: 60 + 100 };
    const caixa = botaoEmPx(r, { left: 50, top: 60 }, { x: 0, y: 0 }, 0, { escala: { x: escala, y: 1 }, borda: { x: 1, y: 1 } });
    expect(caixa.x0).toBeCloseTo(99, 9); // 100 − 1 de borda
    expect(caixa.x1).toBeCloseTo(139, 9);
    expect(caixa.y0).toBeCloseTo(39, 9);
    expect(caixa.y1).toBeCloseTo(99, 9);
  });

  it("botoesDoContainer: a medida sai do próprio contêiner (borda = clientLeft/Top, escala = largura na tela / offsetWidth)", () => {
    const retangulo = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height, width, height });
    const container = { getBoundingClientRect: () => retangulo(297, 239.5, 719.328125, 418), offsetWidth: 719, offsetHeight: 418, clientLeft: 1, clientTop: 1 };
    const zoom = { getBoundingClientRect: () => retangulo(297 + 11 * (719.328125 / 719), 239.5 + 11, 34, 64) };
    const [c] = botoesDoContainer(container, [zoom], { x: 0, y: 0 }, 4);
    // 11 px dentro do mapa na tela = 11 px nas contas do Leaflet; menos 1 de borda; menos a folga de 4.
    expect(c.x0).toBeCloseTo(11 - 1 - 4, 9);
    expect(c.y0).toBeCloseTo(11 - 1 - 4, 9);
    expect(c.x1).toBeCloseTo(11 + 34 / (719.328125 / 719) - 1 + 4, 9);
    expect(c.y1).toBeCloseTo(11 + 64 - 1 + 4, 9);
    // A origem (canto da parte visível, em px da projeção) é somada por último.
    expect(botoesDoContainer(container, [zoom], { x: 1000, y: 2000 }, 4)[0].x0).toBeCloseTo(1000 + 6, 9);
    // Contêiner sem medida (offsetWidth 0): escala 1, nunca NaN/Infinity.
    const sem = { ...container, offsetWidth: 0, offsetHeight: 0 };
    const [d] = botoesDoContainer(sem, [zoom], { x: 0, y: 0 }, 0);
    expect(Number.isFinite(d.x0) && Number.isFinite(d.y1)).toBe(true);
  });

  it("o nome não é escrito embaixo do botão: com o botão em cima do ponto de partida o nome sai de lá", () => {
    const cidade: Poligono[] = [[[[0, 0], [400, 0], [400, 200], [0, 200], [0, 0]]]];
    const botao = botaoEmPx({ left: 150, top: 80, right: 250, bottom: 120 }, { left: 0, top: 0 }, { x: 0, y: 0 });
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: cidade, ancora: [200, 100], area: { x0: 0, y0: 0, x1: 400, y1: 200 }, obstaculos: [botao], medir: () => 40, fontes: [12] });
    expect(r).not.toBeNull();
    const c = caixaDoRotulo(r!);
    expect(c.x0 < botao.x1 && c.x1 > botao.x0 && c.y0 < botao.y1 && c.y1 > botao.y0).toBe(false);
  });

  it("o componente monta os botões com botoesDoContainer e entrega ao cálculo (sem isso o nome ia para baixo do +/−)", () => {
    const src = ler("src/components/RotulosMunicipiosES.tsx");
    expect(src).toMatch(/querySelectorAll\("\.leaflet-control"\)/);
    expect(src).toMatch(/botoesDoContainer\(container, container\.querySelectorAll\("\.leaflet-control"\), \{ x: x0, y: y0 \}, 3\)/);
    expect(src).toMatch(/calcularRotulos\(\{[^}]*obstaculosPx[^}]*\}\)/);
  });
});

describe("o custo da conta (a cada arrasto/zoom do mapa)", () => {
  // Um município SINTÉTICO com 6000 vértices (a malha real tem no máximo 263 por anel: é um teste de
  // estresse) e uma tela que só pega uma tira dele, mais estreita que o texto. Antes: milhares de candidatos x 6000 vértices x 6 tentativas
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

// ── 3ª revisão: o que as mutações mostraram que nenhum teste pegava ─────────

describe("a letra e a divisão em linhas que o nome ganha (cada degrau da escada)", () => {
  const GRANDE: Caixa = { x0: -1000, y0: -1000, x1: 1000, y1: 1000 };
  const ret = (w: number, h: number): Poligono[] => [[[[0, 0], [w, 0], [w, h], [0, h], [0, 0]]]];
  const nomeEm = (nome: string, w: number, h: number) => {
    const r = posicionarRotulo({ nome, poligonos: ret(w, h), ancora: [w / 2, h / 2], area: GRANDE, obstaculos: [], medir });
    return r && { fonte: r.fonte, linhas: r.linhas.length };
  };

  it("só a divisão em DUAS linhas cabe: a letra 12 em duas linhas (não a 11, nem sem nome)", () => {
    expect(nomeEm("Cachoeiro de Itapemirim", 100, 40)).toEqual({ fonte: 12, linhas: 2 });
  });
  it("cabe a 11 mas não a 12: sai com 11 (não pula para a 10)", () => {
    expect(nomeEm("Ibatiba", 57, 40)).toEqual({ fonte: 11, linhas: 1 });
  });
  it("só a letra 10 cabe: o nome sai com 10 px (sem a 10 na escada ele sumia)", () => {
    expect(nomeEm("Ibatiba", 52.5, 40)).toEqual({ fonte: 10, linhas: 1 });
  });
  it("nem a 10 cabe: sem nome", () => {
    expect(nomeEm("Ibatiba", 50, 40)).toBeNull();
  });

  it("no mapa real, a tela toda à vista: um piso de nomes por zoom (8 → 8, 9 → 51, 10 → 75, 11 → todos os 78) — tirar um degrau da escada perde nomes", () => {
    const n = (z: number) => rotulosEm(z).length;
    expect(n(8)).toBeGreaterThanOrEqual(8);
    expect(n(9)).toBeGreaterThanOrEqual(51);
    expect(n(10)).toBeGreaterThanOrEqual(75);
    expect(n(11)).toBe(78);
  });
});

describe("o nome nunca passa da borda da tela, nos QUATRO lados, a partir do ponto de partida", () => {
  // A cidade continua além da tela nos quatro lados: só a borda da TELA segura o nome. O atalho "o ponto de
  // partida está livre" devolve o próprio ponto, e é nele que a borda de baixo (e as outras) é a única proteção.
  const cidade: Poligono[] = [[[[-300, -300], [700, -300], [700, 300], [-300, 300], [-300, -300]]]];
  const area: Caixa = { x0: 0, y0: 0, x1: 400, y1: 100 };
  for (const [lado, ancora] of [["embaixo", [200, 98]], ["em cima", [200, 2]], ["à esquerda", [3, 50]], ["à direita", [397, 50]]] as const) {
    it(`ponto de partida colado ${lado}`, () => {
      const r = posicionarRotulo({ nome: "Ibatiba", poligonos: cidade, ancora: [...ancora], area, obstaculos: [], medir: () => 40, fontes: [12] });
      expect(r).not.toBeNull();
      const c = caixaDoRotulo(r!);
      expect(c.x0).toBeGreaterThanOrEqual(area.x0);
      expect(c.x1).toBeLessThanOrEqual(area.x1);
      expect(c.y0).toBeGreaterThanOrEqual(area.y0);
      expect(c.y1).toBeLessThanOrEqual(area.y1);
    });
  }
});

describe("ramos de proteção que só um caso especial exercita", () => {
  const ret = (w: number, h: number): Poligono[] => [[[[0, 0], [w, 0], [w, h], [0, h], [0, 0]]]];
  it("duas peças finas (300×15 e 15×300), texto maior que cada uma e ponto de partida fora da tela: null, sem exceção (uma exceção apagava TODOS os nomes do quadro)", () => {
    const A: Poligono = [[[0, 100], [300, 100], [300, 115], [0, 115], [0, 100]]];
    const B: Poligono = [[[500, 0], [515, 0], [515, 300], [500, 300], [500, 0]]];
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos: [A, B], ancora: [5000, 5000], area: { x0: 0, y0: 0, x1: 1000, y1: 400 }, obstaculos: [], medir: () => 92, fontes: [12] });
    expect(r).toBeNull();
  });

  it("caixaVisivel: divisa em diagonal cortada pela borda ESQUERDA da tela (o espelho do corte pela direita)", () => {
    const triangulo: [number, number][] = [[0, 0], [100, 0], [0, 100], [0, 0]]; // x + y ≤ 100
    expect(caixaVisivel(triangulo, { x0: 40, y0: 0, x1: 200, y1: 200 })).toEqual({ x0: 40, y0: 0, x1: 100, y1: 60 });
  });

  it("caixaDentro: uma caixa que cruza SÓ a divisa do buraco (com o centro fora dele) não vale", () => {
    const quadrado: Poligono = [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]], [[40, 40], [60, 40], [60, 60], [40, 60], [40, 40]]];
    // 30..50 × 45..55: o centro (40,50) está na borda do buraco; a caixa entra nele pela divisa esquerda (x=40).
    expect(caixaDentro({ x0: 20, y0: 45, x1: 45, y1: 55 }, quadrado)).toBe(false);
    expect(caixaDentro({ x0: 10, y0: 45, x1: 35, y1: 55 }, quadrado)).toBe(true);
  });

  it("buscas de tamanhos diferentes não se contaminam: a cidade fina de verdade não acha nome por causa de uma peça maior", () => {
    const fina: Poligono = [[[0, 0], [300, 0], [300, 10], [0, 10], [0, 0]]];
    expect(posicionarRotulo({ nome: "Ibatiba", poligonos: [fina], ancora: [150, 5], area: { x0: -10, y0: -10, x1: 400, y1: 400 }, obstaculos: [], medir: () => 40, fontes: [12] })).toBeNull();
    void ret;
  });
});

describe("a busca não perde nenhum bolsão livre (propriedade, semente fixa)", () => {
  // Constrói um bolsão LIVRE de a×b px de centros possíveis, cercado por quatro obstáculos que só encostam no
  // retângulo do texto, numa cidade grande e com o ponto de partida longe. Exige que o nome seja achado DENTRO do
  // bolsão. É o que trava o argumento da busca grossa→fina (o retângulo encolhido até sx×sy, a varredura fina
  // de −sx/2 a +sx/2, a janela de centros): encolher só metade, varrer só até sx/4, pular a ordenação ou usar W no
  // lugar de H em qualquer um deles faz alguns bolsões escaparem — nenhum dos casos escritos à mão pegava.
  const ret = (w: number, h: number): Poligono[] => [[[[0, 0], [w, 0], [w, h], [0, h], [0, 0]]]];
  const sorteio = (semente: number) => {
    let s = semente;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  };

  const tentar = (rnd: () => number, larguras: number[], lados: number[], n: number): string[] => {
    const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
    const falhas: string[] = [];
    for (let i = 0; i < n; i++) {
      const w0 = pick(larguras);
      const W = Math.ceil(w0) + 8; // largura do retângulo do texto (o nome mede w0 + 2 × FOLGA_X)
      const H = 18; // 14 de linha + 2 × FOLGA_Y
      const Cw = pick([300, 700, 1100]);
      const Ch = pick([120, 300, 600]);
      const a = pick(lados);
      const b = pick(lados);
      const px = W / 2 + 3 + rnd() * (Cw - W - a - 6);
      const py = H / 2 + 3 + rnd() * (Ch - H - b - 6);
      const T = py - H / 2, B = py + b + H / 2, Lx = px - W / 2, Rx = px + a + W / 2;
      const obstaculos: Caixa[] = [
        { x0: -10, y0: -10, x1: Cw + 10, y1: T }, { x0: -10, y0: B, x1: Cw + 10, y1: Ch + 10 },
        { x0: -10, y0: T, x1: Lx, y1: B }, { x0: Rx, y0: T, x1: Cw + 10, y1: B },
      ];
      // A tela começa em −10…0 (nunca depois da cidade: o bolsão tem de estar à vista) e tem origem em quartos de pixel,
      // para a grade grossa cair em alinhamentos diferentes a cada caso.
      const ox = Math.round(rnd() * 40) / 4 - 10;
      const oy = Math.round(rnd() * 40) / 4 - 10;
      const area: Caixa = { x0: ox, y0: oy, x1: Cw + 20 + ox, y1: Ch + 20 + oy };
      const r = posicionarRotulo({ nome: "Ibatiba", poligonos: ret(Cw, Ch), ancora: [rnd() < 0.5 ? 2 : Cw - 2, rnd() < 0.5 ? 2 : Ch - 2], area, obstaculos, medir: () => w0, fontes: [12] });
      const quando = `W=${W} cidade ${Cw}x${Ch} bolsão ${a}x${b} em (${px.toFixed(2)},${py.toFixed(2)})`;
      if (!r) falhas.push(`não achou: ${quando}`);
      else if (r.x < px - 1e-6 || r.x > px + a + 1e-6 || r.y < py - 1e-6 || r.y > py + b + 1e-6) falhas.push(`achou fora do bolsão (${r.x},${r.y}): ${quando}`);
    }
    return falhas;
  };

  it("600 bolsões de 1,01 a 8 px, em lugares sorteados: todos achados, e dentro do bolsão", () => {
    expect(tentar(sorteio(7), [20, 40, 60, 90, 130], [1.01, 1.3, 2, 3.7, 8], 600)).toEqual([]);
  });

  it("2000 bolsões de EXATOS 1×1 px (a resolução da busca): todos achados", () => {
    expect(tentar(sorteio(11), [20, 33, 40, 57, 90, 130], [1], 2000)).toEqual([]);
  });
});

describe("o custo da conta, em perguntas \"cabe aqui?\" (a contagem não depende da máquina; o relógio sim)", () => {
  const ret = (x: number, y: number, w: number, h: number): Poligono[] => [[[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]]];
  const cidade: Poligono[] = [[[[-500, -500], [1700, -500], [1700, 1100], [-500, 1100], [-500, -500]]]];
  const contar = (poligonos: Poligono[], area: Caixa, obstaculos: Caixa[], ancora: [number, number]) => {
    const contagem = { testes: 0 };
    const r = posicionarRotulo({ nome: "Ibatiba", poligonos, ancora, area, obstaculos, medir: () => 40, fontes: [12], contagem });
    return { r, testes: contagem.testes };
  };
  const tampar = (l: number, a: number): Caixa[] => [{ x0: -10, y0: -10, x1: l + 10, y1: a + 10 }];

  it("nada cabe numa tela de celular pequena (200 × 150): centenas de perguntas — e a grade grossa entra na conta (193 medidas)", () => {
    const { r, testes } = contar(cidade, { x0: 0, y0: 0, x1: 200, y1: 150 }, tampar(200, 150), [30, 30]);
    expect(r).toBeNull();
    expect(testes).toBeGreaterThan(100); // um contador que só conta o retângulo de tamanho cheio daria 1
    expect(testes).toBeLessThan(260); // 500 pontos grossos custam 461 aqui, o dobro do que se mediu para 100
  });

  it("cidade do tamanho de uma cidade pequena no zoom de abertura (60 × 60), tampada: dezenas de perguntas (61 medidas)", () => {
    const { r, testes } = contar(ret(100, 100, 60, 60), { x0: 0, y0: 0, x1: 400, y1: 300 }, [{ x0: 90, y0: 90, x1: 170, y1: 170 }], [130, 130]);
    expect(r).toBeNull();
    expect(testes).toBeGreaterThan(30);
    expect(testes).toBeLessThan(80); // passo mínimo de 1 px custaria ~100 aqui
  });

  it("janela estreita que cabe (51 × 100): dezenas de perguntas (19 medidas), não centenas", () => {
    const { r, testes } = contar(ret(100, 100, 51, 100), { x0: 0, y0: 0, x1: 1000, y1: 1000 }, [], [500, 500]);
    expect(r).not.toBeNull();
    expect(testes).toBeLessThan(60);
  });

  it("o custo CRESCE com a tela (é a área da janela que manda): 1440 × 460 pergunta bem mais que 300 × 200 — e mesmo assim fica em poucos milhares", () => {
    const pequena = contar(cidade, { x0: 0, y0: 0, x1: 300, y1: 200 }, tampar(300, 200), [30, 30]).testes;
    const grande = contar(cidade, { x0: 0, y0: 0, x1: 1440, y1: 460 }, tampar(1440, 460), [30, 30]).testes;
    expect(grande).toBeGreaterThan(pequena * 5);
    expect(grande).toBeLessThan(4000);
  });

  it("o lugar livre mais perto do ponto de partida: a MEDIANA do excesso sobre o ótimo é de até 1 px (sem ordenar o fino ia a 7 px), e nunca além de uma célula da grade grossa", () => {
    const pin: Caixa = { x0: 100, y0: 40, x1: 160, y1: 60 };
    const excessos: number[] = [];
    for (let ax = 96; ax <= 164; ax += 2) {
      for (let ay = 36; ay <= 64; ay += 2) {
        if (!(ax - 24 < pin.x1 && ax + 24 > pin.x0 && ay - 9 < pin.y1 && ay + 9 > pin.y0)) continue; // só com o ponto de partida tampado
        const r = posicionarRotulo({ nome: "Ibatiba", poligonos: [[[[0, 0], [400, 0], [400, 300], [0, 300], [0, 0]]]], ancora: [ax, ay], area: { x0: 0, y0: 0, x1: 400, y1: 300 }, obstaculos: [pin], medir: () => 40, fontes: [12] });
        expect(r).not.toBeNull();
        const otimo = Math.min(Math.abs(pin.x0 - 24 - ax), Math.abs(pin.x1 + 24 - ax), Math.abs(pin.y0 - 9 - ay), Math.abs(pin.y1 + 9 - ay));
        excessos.push(Math.hypot(r!.x - ax, r!.y - ay) - otimo);
      }
    }
    excessos.sort((p, q) => p - q);
    expect(excessos.length).toBeGreaterThan(300);
    expect(excessos[Math.floor(excessos.length / 2)]).toBeLessThanOrEqual(1);
    expect(excessos[excessos.length - 1]).toBeLessThanOrEqual(16);
  });
});
