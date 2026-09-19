import { describe, it, expect } from "vitest";
import {
  LIGACOES, SESSOES, SESSOES_POR_ID, ligacoesDaSessao, ordenarPorGrupo, posicoesDoGrafo,
} from "../src/lib/cerebro/sessoes";

// O grafo da Central Inteligente monta as sinapses entre sessões a partir de
// LIGACOES e DESCARTA em silêncio qualquer ponta que não exista. Sem estes
// testes, um id trocado sumiria da tela sem erro nenhum.
describe("ligações entre sessões do Cérebro", () => {
  it("toda ponta aponta para uma sessão que existe", () => {
    for (const l of LIGACOES) {
      expect(SESSOES_POR_ID.has(l.de), `"${l.de}" não é uma sessão`).toBe(true);
      expect(SESSOES_POR_ID.has(l.para), `"${l.para}" não é uma sessão`).toBe(true);
    }
  });

  it("nenhuma ligação repetida e nenhuma sessão ligada a si mesma", () => {
    const vistas = new Set<string>();
    for (const l of LIGACOES) {
      expect(l.de).not.toBe(l.para);
      // Ida e volta são a mesma sinapse: a chave ignora o sentido.
      const chave = [l.de, l.para].sort().join("↔");
      expect(vistas.has(chave), `ligação repetida: ${chave}`).toBe(false);
      vistas.add(chave);
    }
  });

  it("toda ligação explica o fluxo, para a ficha da sessão não ficar muda", () => {
    for (const l of LIGACOES) expect(l.fluxo.trim().length).toBeGreaterThan(8);
  });

  it("ligacoesDaSessao acha nos dois sentidos", () => {
    // clientes → whatsapp está cadastrado nesse sentido; as duas pontas
    // precisam enxergar a ligação.
    expect(ligacoesDaSessao("clientes").map((l) => l.outro)).toContain("whatsapp");
    expect(ligacoesDaSessao("whatsapp").map((l) => l.outro)).toContain("clientes");
    expect(ligacoesDaSessao("nao-existe")).toEqual([]);
  });

  it("nenhuma sessão fica solta no grafo", () => {
    for (const s of SESSOES) {
      expect(ligacoesDaSessao(s.id).length, `${s.nome} sem nenhuma ligação`).toBeGreaterThan(0);
    }
  });
});

describe("posições do grafo", () => {
  it("a ordem do anel é a mesma que posiciona os nós", () => {
    // O componente usa ordenarPorGrupo para saber quem é vizinho de quem; se
    // essa ordem deixasse de bater com a de posicoesDoGrafo, as ligações
    // seriam desenhadas nos lugares errados.
    const ordenadas = ordenarPorGrupo(SESSOES);
    const posicoes = posicoesDoGrafo(SESSOES);
    const angulos = ordenadas.map((s) => posicoes.get(s.id)!.angulo);
    for (let i = 1; i < angulos.length; i++) expect(angulos[i]).toBeGreaterThan(angulos[i - 1]);
  });

  it("toda sessão ganha uma posição", () => {
    const posicoes = posicoesDoGrafo(SESSOES);
    for (const s of SESSOES) expect(posicoes.has(s.id)).toBe(true);
  });
});
