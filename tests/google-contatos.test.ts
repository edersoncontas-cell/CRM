import { describe, expect, it } from "vitest";
import { acharMunicipio, clientesParaEnviar, planejarSincronizacao, telefoneNacional, type ClienteResumo, type ContatoGoogle } from "../src/lib/google-contatos-util";

const municipios = [{ id: "m1", nome: "Cachoeiro de Itapemirim" }, { id: "m2", nome: "Itapemirim" }, { id: "m3", nome: "Alegre" }];
const g = (p: Partial<ContatoGoogle> & { id: string; nome: string }): ContatoGoogle => ({ telefones: [], emails: [], enderecos: [], empresa: null, ...p });
const c = (p: Partial<ClienteResumo> & { id: string; nome: string }): ClienteResumo => ({ telefone: null, email: null, endereco: null, municipioId: null, origem: "manual", googleContatoId: null, ...p });

describe("telefoneNacional", () => {
  it("tira o 55 e zeros à esquerda", () => {
    expect(telefoneNacional("+55 (28) 99979-8168")).toBe("28999798168");
    expect(telefoneNacional("028999798168")).toBe("28999798168");
    expect(telefoneNacional("5528999798168")).toBe("28999798168");
    expect(telefoneNacional("123")).toBeNull();
  });
});

describe("acharMunicipio", () => {
  it("acha pela cidade do endereço, ignorando acento e caixa", () => {
    expect(acharMunicipio(municipios, [{ cidade: "CACHOEIRO DE ITAPEMIRIM", texto: null }])).toBe("m1");
  });
  it("acha pelo texto do endereço, preferindo o nome mais longo", () => {
    expect(acharMunicipio(municipios, [{ cidade: null, texto: "Rua X, 10 - Cachoeiro de Itapemirim - ES" }])).toBe("m1");
    expect(acharMunicipio(municipios, [{ cidade: null, texto: "Centro, Itapemirim" }])).toBe("m2");
    expect(acharMunicipio(municipios, [{ cidade: null, texto: "Vitória" }])).toBeNull();
  });
});

describe("planejarSincronizacao", () => {
  it("cria cliente novo para contato com telefone e liga ao município", () => {
    const plano = planejarSincronizacao([g({ id: "people/1", nome: "Lucas Serafim", telefones: ["5528999798168"], emails: ["l@x.com"], enderecos: [{ cidade: "Alegre", texto: "Rua A, Alegre" }] })], [], municipios);
    expect(plano.criar).toEqual([{ nome: "Lucas Serafim", telefone: "28999798168", email: "l@x.com", endereco: "Rua A, Alegre", municipioId: "m3", googleContatoId: "people/1" }]);
    expect(plano.atualizar).toEqual([]);
  });

  it("liga ao cliente que já tem o número (mesmo sem o 9º dígito) e troca o nome genérico", () => {
    const clientes = [c({ id: "c1", nome: "Contato 552899798168", telefone: "2899798168" })];
    const plano = planejarSincronizacao([g({ id: "people/1", nome: "Maria Souza", telefones: ["5528999798168"] })], clientes, municipios);
    expect(plano.criar).toEqual([]);
    expect(plano.atualizar).toEqual([{ id: "c1", dados: { googleContatoId: "people/1", nome: "Maria Souza" } }]);
  });

  it("não mexe no nome que o vendedor já deu; só completa o que falta", () => {
    const clientes = [c({ id: "c1", nome: "Zé da Retro", telefone: "28999798168", googleContatoId: "people/1" })];
    const plano = planejarSincronizacao([g({ id: "people/1", nome: "José Carlos", telefones: ["5528999798168"], emails: ["ze@x.com"] })], clientes, municipios);
    expect(plano.atualizar).toEqual([{ id: "c1", dados: { email: "ze@x.com" } }]);
  });

  it("cliente nascido do Google segue o nome do Google", () => {
    const clientes = [c({ id: "c1", nome: "Joao", telefone: "28999798168", origem: "google", googleContatoId: "people/1" })];
    const plano = planejarSincronizacao([g({ id: "people/1", nome: "João Pedro", telefones: ["5528999798168"] })], clientes, municipios);
    expect(plano.atualizar).toEqual([{ id: "c1", dados: { nome: "João Pedro" } }]);
  });

  it("ignora contato sem telefone, nomes descartados e duplicados do mesmo número", () => {
    const plano = planejarSincronizacao([
      g({ id: "people/1", nome: "Sem Fone" }),
      g({ id: "people/2", nome: "Pousada Bela Vista", telefones: ["5528999990000"] }),
      g({ id: "people/3", nome: "Ana", telefones: ["5528999990001"] }),
      g({ id: "people/4", nome: "Ana (trabalho)", telefones: ["5528999990001"] }),
    ], [], municipios);
    expect(plano.semTelefone).toBe(1);
    expect(plano.ignorados).toBe(2);
    expect(plano.criar.map((x) => x.nome)).toEqual(["Ana"]);
  });

  it("não traz de volta telefone bloqueado", () => {
    const bloqueados = new Set(["28999990009", "5528999990009"]);
    const plano = planejarSincronizacao([g({ id: "people/9", nome: "Fulano", telefones: ["5528999990009"] })], [], municipios, bloqueados);
    expect(plano.criar).toEqual([]);
    expect(plano.ignorados).toBe(1);
  });

  it("nada a fazer quando já está tudo igual", () => {
    const clientes = [c({ id: "c1", nome: "Ana", telefone: "28999990001", googleContatoId: "people/3", email: "a@x.com" })];
    const plano = planejarSincronizacao([g({ id: "people/3", nome: "Ana", telefones: ["5528999990001"], emails: ["a@x.com"] })], clientes, municipios);
    expect(plano).toEqual({ criar: [], atualizar: [], ignorados: 0, semTelefone: 0 });
  });
});

describe("clientesParaEnviar", () => {
  it("só clientes reais do CRM, com telefone, ainda sem contato no Google", () => {
    const lista = [
      c({ id: "a", nome: "Contato 5528999", telefone: "28999" }),
      c({ id: "b", nome: "Cliente Bom", telefone: "28999798168" }),
      c({ id: "c", nome: "Já no Google", telefone: "28999798169", googleContatoId: "people/9" }),
      c({ id: "d", nome: "Prospect", telefone: "28999798170", origem: "prospect_ia" }),
      c({ id: "e", nome: "Sem fone" }),
    ];
    expect(clientesParaEnviar(lista, 10).map((x) => x.id)).toEqual(["b"]);
    expect(clientesParaEnviar(lista, 0)).toEqual([]);
  });
});
