// "estou clicando em resolvido no pós venda e o card some e depois volta
//  sozinho (…) corrija isso e qualquer outro campo que eu clique em resolvido,
//  não quero que nada volte."
//
// O "Resolvido" guardava a chave do item, e duas chaves carregavam DENTRO
// delas a situação do cliente. Bastava um pedaço mudar para a chave nova não
// bater com a guardada, e o card voltava sem ninguém ter desfeito nada.
//
// O caso mais perverso era o pós-venda com marco pendente: o próprio
// "Resolvido" registra o marco como cumprido, o que muda a situação, o que
// muda a chave. O clique se desfazia sozinho, por construção.

import { describe, it, expect } from "vitest";
import { chaveEstavel, estaResolvido } from "@/lib/alerta-chave";

const CLIENTE = "cmu9x63c9000787wy";

describe("a chave guardada não carrega a situação do cliente", () => {
  it("pós-venda: sobra o assunto e o cliente", () => {
    expect(chaveEstavel(`posvenda:${CLIENTE}:marco_180d:et:frio`)).toBe(`posvenda:${CLIENTE}`);
    expect(chaveEstavel(`posvenda:${CLIENTE}:-:-:-`)).toBe(`posvenda:${CLIENTE}`);
  });

  it("e todas as situações do MESMO cliente dão a mesma chave", () => {
    const situacoes = [
      `posvenda:${CLIENTE}:marco_30d:-:-`,
      `posvenda:${CLIENTE}:marco_60d:et:-`,
      `posvenda:${CLIENTE}:-:et:frio`,
      `posvenda:${CLIENTE}:-:-:-`,
    ];
    expect(new Set(situacoes.map(chaveEstavel)).size).toBe(1);
  });

  it("sem contato: cai fora o carimbo do último contato", () => {
    expect(chaveEstavel(`semcontato:${CLIENTE}:1758326400000`)).toBe(`semcontato:${CLIENTE}`);
    expect(chaveEstavel(`semcontato:${CLIENTE}:0`)).toBe(`semcontato:${CLIENTE}`);
  });

  it("clientes diferentes continuam sendo itens diferentes", () => {
    expect(chaveEstavel(`posvenda:cliente-a:-:-:-`)).not.toBe(chaveEstavel(`posvenda:cliente-b:-:-:-`));
  });
});

describe("as chaves que já eram estáveis não mudam", () => {
  // Estas apontam para o id de um REGISTRO (visita, demanda, alerta,
  // licitação, negociação) — não muda porque o cliente mudou de estado.
  it.each([
    "visita:cmuabc123",
    "demanda:cmuabc123",
    "alerta:cmuabc123",
    "licitacao:cmuabc123",
    "visitar:cmuabc123",
    "aguardando:cmuabc123",
    "zeus:cmuabc123",
  ])("%s fica como está", (id) => {
    expect(chaveEstavel(id)).toBe(id);
  });

  it("chave sem dois-pontos não quebra", () => {
    expect(chaveEstavel("qualquercoisa")).toBe("qualquercoisa");
  });

  it("pós-venda sem cliente na chave fica como está, em vez de virar lixo", () => {
    expect(chaveEstavel("posvenda:")).toBe("posvenda:");
  });
});

describe("o card resolvido não volta", () => {
  it("resolvido com uma situação, some também depois da situação mudar", () => {
    // Foi isto que aconteceu com o Gabriel: resolveu num estado, o estado
    // mudou (inclusive por causa do próprio clique) e o card reapareceu.
    const guardadas = new Set([chaveEstavel(`posvenda:${CLIENTE}:marco_180d:-:-`)]);
    expect(estaResolvido(`posvenda:${CLIENTE}:marco_180d:-:-`, guardadas)).toBe(true);
    expect(estaResolvido(`posvenda:${CLIENTE}:marco_365d:et:frio`, guardadas)).toBe(true);
    expect(estaResolvido(`posvenda:${CLIENTE}:-:-:-`, guardadas)).toBe(true);
  });

  it("o que o vendedor JÁ tinha resolvido antes desta correção continua resolvido", () => {
    // As linhas antigas estão gravadas no formato longo. Ele não vai clicar
    // tudo de novo só porque a regra mudou.
    const antigas = new Set([`posvenda:${CLIENTE}:marco_180d:-:-`]);
    expect(estaResolvido(`posvenda:${CLIENTE}:marco_180d:-:-`, antigas)).toBe(true);
  });

  it("outro cliente não é escondido de carona", () => {
    const guardadas = new Set([chaveEstavel(`posvenda:${CLIENTE}:-:-:-`)]);
    expect(estaResolvido("posvenda:outro-cliente:-:-:-", guardadas)).toBe(false);
  });

  it("nada guardado, nada escondido", () => {
    expect(estaResolvido(`posvenda:${CLIENTE}:-:-:-`, new Set())).toBe(false);
  });
});
