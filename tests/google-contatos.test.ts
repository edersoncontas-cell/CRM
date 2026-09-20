import { describe, expect, it } from "vitest";
import { acharMunicipio, clientesParaEnviar, planejarSincronizacao, telefoneNacional, temLapide, lapidesVazias, chaveNome, type ClienteResumo, type ContatoGoogle } from "../src/lib/google-contatos-util";

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
    const l = { ...lapidesVazias(), telefones: new Set(["28999990009", "5528999990009"]) };
    const plano = planejarSincronizacao([g({ id: "people/9", nome: "Fulano", telefones: ["5528999990009"] })], [], municipios, l);
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

// ── A LÁPIDE: O CONTATO EXCLUÍDO NÃO VOLTA ──────────────────────────────────
//
// "eu vou excluir do crm o contato ac maquinas novas pme, nesse novo filtro,
//  ao google contatos realizar novamente a sincronização, ele não pode voltar"
//
// A lista de bloqueio só sabia guardar TELEFONE. E "AC MÁQUINAS NOVAS PME" é
// um contato de empresa SEM NÚMERO: não tinha como entrar nela. O vendedor
// excluía, a rodada seguinte do Google reencontrava o contato na agenda do
// celular e o recriava — excluir virava tarefa recorrente, sem nada no CRM
// capaz de impedir.
//
// Agora são três chaves, e basta uma bater. Cada teste abaixo fecha um
// caminho de volta.
describe("a lápide do contato excluído", () => {
  it("pelo id do Google: o mesmo contato não volta, nem sem telefone", () => {
    const l = { ...lapidesVazias(), googleIds: new Set(["people/77"]) };
    const plano = planejarSincronizacao([g({ id: "people/77", nome: "AC MÁQUINAS NOVAS PME" })], [], municipios, l);
    expect(plano.criar).toEqual([]);
    expect(plano.ignorados).toBe(1);
    // E conta como BARRADO, não como "sem telefone": o resumo da rodada tem
    // de dizer a verdade sobre por que ele não entrou.
    expect(plano.semTelefone).toBe(0);
  });

  it("pelo nome: recriado no celular do zero (id novo) continua barrado", () => {
    // O caso que o bloqueio por id sozinho não pega — apagar e cadastrar de
    // novo na agenda gera outro resourceName.
    const l = { ...lapidesVazias(), nomes: new Set([chaveNome("AC MÁQUINAS NOVAS PME")!]) };
    const plano = planejarSincronizacao([g({ id: "people/OUTRO", nome: "ac máquinas novas pme" })], [], municipios, l);
    expect(plano.criar).toEqual([]);
    expect(plano.ignorados).toBe(1);
  });

  it("pelo nome, mesmo que agora tenha ganhado um telefone", () => {
    const l = { ...lapidesVazias(), nomes: new Set([chaveNome("AC Máquinas Novas PME")!]) };
    const plano = planejarSincronizacao([g({ id: "people/78", nome: "AC MÁQUINAS NOVAS PME", telefones: ["5528999990088"] })], [], municipios, l);
    expect(plano.criar).toEqual([]);
  });

  it("pelo telefone: mesmo número, ainda que o nome tenha mudado", () => {
    const l = { ...lapidesVazias(), telefones: new Set(["28999990009", "5528999990009"]) };
    const plano = planejarSincronizacao([g({ id: "people/novo", nome: "Outro Nome", telefones: ["5528999990009"] })], [], municipios, l);
    expect(plano.criar).toEqual([]);
  });

  it("sem lápide, o contato entra normalmente — a trava não pega geral", () => {
    const l = { ...lapidesVazias(), nomes: new Set(["ac maquinas novas pme"]) };
    const plano = planejarSincronizacao([g({ id: "people/5", nome: "Wadson Pires Ratinho", telefones: ["5528999990005"] })], [], municipios, l);
    expect(plano.criar.map((x) => x.nome)).toEqual(["Wadson Pires Ratinho"]);
  });
});

describe("temLapide", () => {
  it("acha por qualquer uma das três chaves", () => {
    const l = { telefones: new Set(["28999990009"]), nomes: new Set(["ac maquinas novas pme"]), googleIds: new Set(["people/77"]) };
    expect(temLapide({ googleContatoId: "people/77" }, l)).toBe(true);
    expect(temLapide({ telefones: ["28999990009"] }, l)).toBe(true);
    expect(temLapide({ nome: "AC Máquinas Novas PME" }, l)).toBe(true);
  });

  it("o telefone casa em qualquer variante (com ou sem o 55)", () => {
    const l = { ...lapidesVazias(), telefones: new Set(["5528999990009"]) };
    expect(temLapide({ telefones: ["28999990009"] }, l)).toBe(true);
  });

  it("nome genérico NUNCA vira chave — derrubaria contato inocente", () => {
    // chaveNome() devolve null para "Contato 5528…" e para nome curto demais.
    // Sem esta regra, uma lápide de nome genérico barraria todo contato que o
    // WhatsApp ainda não nomeou.
    expect(chaveNome("Contato 5528999990009")).toBe(null);
    const l = { ...lapidesVazias(), nomes: new Set(["contato 5528999990009"]) };
    expect(temLapide({ nome: "Contato 5528999990009" }, l)).toBe(false);
  });

  it("alvo sem nenhuma chave não tem lápide", () => {
    const l = { telefones: new Set(["28999990009"]), nomes: new Set(["ana maria"]), googleIds: new Set(["people/1"]) };
    expect(temLapide({}, l)).toBe(false);
    expect(temLapide({ telefones: [null], nome: null, googleContatoId: null }, l)).toBe(false);
  });

  it("lista vazia de lápides nunca barra ninguém", () => {
    expect(temLapide({ googleContatoId: "people/1", telefones: ["28999990009"], nome: "Ana Maria" }, lapidesVazias())).toBe(false);
  });
});
