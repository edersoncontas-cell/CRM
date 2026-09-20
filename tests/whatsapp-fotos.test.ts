// "Consegue por a foto de perfil igual está no whatsapp? Se sim, atualize isso."
//
// A coluna, o avatar e a função que pergunta a foto ao provedor já existiam —
// faltava alguém chamar. A parte que erra em silêncio é o CASAMENTO do número:
// o provedor devolve "5528999798168" e o CRM guarda "28999798168" (ou o
// contrário), e uma comparação literal não acha nada. Daí o índice por
// variantes, que é o que estes testes prendem.

import { describe, it, expect } from "vitest";
import { mapaDeFotos, fotoDoTelefone } from "@/lib/whatsapp-fotos";

const FOTO = "https://pps.whatsapp.net/v/t61.24694-24/abc?ccb=11-4&oh=01&oe=68F0";

describe("achar a foto do contato na lista do provedor", () => {
  it("acha com o 55 na lista e sem o 55 no CRM", () => {
    const mapa = mapaDeFotos([{ phone: "5528999798168", isGroup: false, photo: FOTO }]);
    expect(fotoDoTelefone(mapa, "28999798168")).toBe(FOTO);
  });

  it("e sem o 55 na lista com o 55 no CRM", () => {
    const mapa = mapaDeFotos([{ phone: "28999798168", isGroup: false, photo: FOTO }]);
    expect(fotoDoTelefone(mapa, "5528999798168")).toBe(FOTO);
  });

  it("chat sem foto não entra no índice — não existe foto vazia", () => {
    const mapa = mapaDeFotos([
      { phone: "5528999798168", isGroup: false, photo: null },
      { phone: "5527988776655", isGroup: false, photo: undefined },
    ]);
    expect(mapa.size).toBe(0);
    expect(fotoDoTelefone(mapa, "28999798168")).toBeUndefined();
  });

  it("número que não está na lista devolve nada (e não a foto do vizinho)", () => {
    const mapa = mapaDeFotos([{ phone: "5528999798168", isGroup: false, photo: FOTO }]);
    expect(fotoDoTelefone(mapa, "5527988776655")).toBeUndefined();
  });

  it("grupo entra pelo id do grupo, que não é telefone", () => {
    const g = "120363041234567890@g.us";
    const mapa = mapaDeFotos([{ phone: g, isGroup: true, photo: FOTO }]);
    expect(fotoDoTelefone(mapa, g)).toBe(FOTO);
  });

  it("dois chats do mesmo contato: vale o primeiro (a lista vem do mais recente)", () => {
    const antiga = `${FOTO}-antiga`;
    const mapa = mapaDeFotos([
      { phone: "5528999798168", isGroup: false, photo: FOTO },
      { phone: "28999798168", isGroup: false, photo: antiga },
    ]);
    expect(fotoDoTelefone(mapa, "5528999798168")).toBe(FOTO);
  });
});
