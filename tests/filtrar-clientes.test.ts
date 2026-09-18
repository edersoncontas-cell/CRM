import { describe, it, expect } from "vitest";
import { filtrarClientes, clienteComMesmoNome } from "../src/lib/filtrar-clientes";

const lista = [
  { id: "1", nome: "ATOM S.A" },
  { id: "2", nome: "Abel" },
  { id: "3", nome: "PIKENO" },
  { id: "4", nome: "Pedro Pikeno Terraplenagem" },
  { id: "5", nome: "(ITA) Adailton Christophori" },
  { id: "6", nome: "Antônio Piquenó" },
  { id: "7", nome: "AGRO terraplanagem" },
];

describe("filtrarClientes", () => {
  it("sem texto: ordem alfabética de gente, não a do banco (maiúsculas primeiro)", () => {
    expect(filtrarClientes(lista, "").map((c) => c.nome)).toEqual([
      "(ITA) Adailton Christophori", "Abel", "AGRO terraplanagem", "Antônio Piquenó", "ATOM S.A", "Pedro Pikeno Terraplenagem", "PIKENO",
    ]);
  });
  it("acha PIKENO digitando 'pik' em minúscula, com quem começa antes de quem só contém", () => {
    expect(filtrarClientes(lista, "pik").map((c) => c.nome)).toEqual(["PIKENO", "Pedro Pikeno Terraplenagem"]);
  });
  it("ignora acento: 'pique' acha 'Piquenó'", () => {
    expect(filtrarClientes(lista, "pique").map((c) => c.nome)).toEqual(["Antônio Piquenó"]);
  });
  it("trecho no meio de uma palavra ainda aparece, por último", () => {
    expect(filtrarClientes(lista, "keno").map((c) => c.nome)).toEqual(["Pedro Pikeno Terraplenagem", "PIKENO"]);
    expect(filtrarClientes(lista, "tom").map((c) => c.nome)).toEqual(["ATOM S.A"]);
  });
  it("respeita o limite", () => {
    expect(filtrarClientes(lista, "", 3)).toHaveLength(3);
  });
});

describe("clienteComMesmoNome", () => {
  it("encontra sem acento e sem maiúscula; não encontra nome diferente", () => {
    expect(clienteComMesmoNome(lista, "pikeno")?.id).toBe("3");
    expect(clienteComMesmoNome(lista, "antonio piqueno")?.id).toBe("6");
    expect(clienteComMesmoNome(lista, "Pikeno Junior")).toBeNull();
    expect(clienteComMesmoNome(lista, "  ")).toBeNull();
  });
});
