// Achar as mensagens que falharam de um disparo.
//
// O risco é apagar o que não devia: a mensagem individual que ele escreveu
// para UM cliente não pode ser confundida com o disparo em massa. E um disparo
// não pode levar junto as mensagens de outro.

import { describe, it, expect } from "vitest";
import { trechoInvariante, ehDoDisparo, MINIMO_TRECHO } from "@/lib/limpeza-falhadas";

describe("trecho invariante do disparo", () => {
  it("pega o pedaço que não muda de cliente para cliente", () => {
    const t = trechoInvariante("Oi {nome}, chegou retroescavadeira nova na loja com taxa zero.");
    expect(t).toBe("chegou retroescavadeira nova na loja com taxa zero.");
    expect(t).not.toContain("{nome}");
  });

  it("escolhe o MAIOR pedaço fixo, não o primeiro", () => {
    expect(trechoInvariante("Bom dia {nome}, tenho uma condição especial de financiamento para a sua obra este mês."))
      .toBe("tenho uma condição especial de financiamento para a sua obra este mês.");
  });

  it("texto sem {nome} é inteiro invariante", () => {
    expect(trechoInvariante("Promoção de retroescavadeira até o fim do mês na loja."))
      .toBe("Promoção de retroescavadeira até o fim do mês na loja.");
  });

  it("recusa texto curto demais — pegaria disparo de outro junto", () => {
    expect(trechoInvariante("Oi {nome}, tudo bem?")).toBeNull();
    expect(trechoInvariante("{nome}")).toBeNull();
    expect(trechoInvariante("")).toBeNull();
    expect(trechoInvariante("   ")).toBeNull();
  });

  it("o limite é o MINIMO_TRECHO, e ele é respeitado nos dois sentidos", () => {
    expect(trechoInvariante("a".repeat(MINIMO_TRECHO))).toHaveLength(MINIMO_TRECHO);
    expect(trechoInvariante("a".repeat(MINIMO_TRECHO - 1))).toBeNull();
  });
});

describe("a mensagem saiu deste disparo?", () => {
  const texto = "Oi {nome}, chegou retroescavadeira nova na loja com taxa zero.";
  const trecho = trechoInvariante(texto)!;

  it("acha as personalizadas, com nomes diferentes", () => {
    expect(ehDoDisparo("Oi Edy, chegou retroescavadeira nova na loja com taxa zero.", trecho)).toBe(true);
    expect(ehDoDisparo("Oi João Carlos, chegou retroescavadeira nova na loja com taxa zero.", trecho)).toBe(true);
  });

  it("acha mesmo com o rodapé do SAIR colado depois", () => {
    expect(ehDoDisparo("Oi Edy, chegou retroescavadeira nova na loja com taxa zero.\n\nSe não quiser mais receber, responda SAIR.", trecho)).toBe(true);
  });

  it("NÃO pega a mensagem individual que ele digitou", () => {
    expect(ehDoDisparo("Bom dia Edy, consegue falar agora?", trecho)).toBe(false);
    expect(ehDoDisparo("Passo aí terça de manhã, pode ser?", trecho)).toBe(false);
  });

  it("NÃO pega o disparo de outra máquina", () => {
    expect(ehDoDisparo("Oi Edy, chegou escavadeira nova na loja com taxa zero.", trecho)).toBe(false);
  });

  it("não se confunde com espaço e quebra de linha a mais", () => {
    expect(ehDoDisparo("Oi   Edy,\n\nchegou retroescavadeira nova   na loja com taxa zero.", trecho)).toBe(true);
  });

  it("corpo vazio não quebra e não casa", () => {
    expect(ehDoDisparo("", trecho)).toBe(false);
  });
});
