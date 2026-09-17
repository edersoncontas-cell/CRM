import { describe, it, expect } from "vitest";
import { decidirLimpeza, ehIdWhatsApp, nomeVazio, type ClienteParaLimpeza } from "../src/lib/clientes-lixo-regra";

const c = (p: Partial<ClienteParaLimpeza> & { nome: string }): ClienteParaLimpeza =>
  ({ id: "x", telefone: null, googleContatoId: null, vinculos: 0, ...p });

describe("cadastros sem identidade", () => {
  it("reconhece id do WhatsApp e nome vazio, mas não nome curto de verdade", () => {
    expect(ehIdWhatsApp("84091265376284")).toBe(true);
    expect(ehIdWhatsApp("27995219314")).toBe(false);
    expect(nomeVazio("?")).toBe(true);
    expect(nomeVazio("@")).toBe(true);
    expect(nomeVazio("…")).toBe(true);
    expect(nomeVazio("Zé")).toBe(false);
    expect(nomeVazio("@Erdmann")).toBe(false);
  });

  it("número no lugar do nome sem telefone: vira telefone (sem 55)", () => {
    expect(decidirLimpeza(c({ nome: "27995219314" }))).toEqual({ acao: "telefone_do_nome", motivo: "numero_no_nome", novoTelefone: "27995219314" });
    expect(decidirLimpeza(c({ nome: "+55 27 99521-9314" }))).toEqual({ acao: "telefone_do_nome", motivo: "numero_no_nome", novoTelefone: "27995219314" });
    // Já tem telefone: nada a consertar aqui (é caso de nome genérico com dado, fica).
    expect(decidirLimpeza(c({ nome: "27995219314", telefone: "27995219314", vinculos: 2 }))).toBeNull();
  });

  it("id do WhatsApp ou nome vazio com telefone: vira \"Contato <tel>\"", () => {
    expect(decidirLimpeza(c({ nome: "84091265376284", telefone: "27997970160" }))).toEqual({ acao: "renomear", motivo: "id_whatsapp_no_nome", novoNome: "Contato 27997970160" });
    expect(decidirLimpeza(c({ nome: "?", telefone: "27996016190", vinculos: 5 }))).toEqual({ acao: "renomear", motivo: "nome_vazio_com_telefone", novoNome: "Contato 27996016190" });
  });

  it("sem nome, sem telefone e sem nada: apaga — mas não se tem vínculo ou veio do Google", () => {
    expect(decidirLimpeza(c({ nome: "?" }))).toEqual({ acao: "apagar", motivo: "sem_nome_sem_telefone" });
    expect(decidirLimpeza(c({ nome: "84091265376284" }))).toEqual({ acao: "apagar", motivo: "id_whatsapp_no_nome" });
    expect(decidirLimpeza(c({ nome: "?", vinculos: 1 }))).toBeNull();
    expect(decidirLimpeza(c({ nome: "?", googleContatoId: "people/1" }))).toBeNull();
  });

  it("\"Contato 5527…\" sem conversa nem dado é sobra: apaga; com conversa ou do Google, fica", () => {
    expect(decidirLimpeza(c({ nome: "Contato 5527999990001", telefone: "27999990001" }))).toEqual({ acao: "apagar", motivo: "contato_sem_conversa" });
    expect(decidirLimpeza(c({ nome: "Contato 5527999990001", telefone: "27999990001", vinculos: 1 }))).toBeNull();
    expect(decidirLimpeza(c({ nome: "Contato 5527999990001", telefone: "27999990001", googleContatoId: "people/2" }))).toBeNull();
  });

  it("cadastro normal, mesmo sem telefone e sem vínculo, não é tocado", () => {
    expect(decidirLimpeza(c({ nome: "Sem Telefone Construções" }))).toBeNull();
    expect(decidirLimpeza(c({ nome: "@Erdmann", telefone: "27996418656" }))).toBeNull();
    expect(decidirLimpeza(c({ nome: "AC MÁQUINAS NOVAS 🚜" }))).toBeNull();
  });
});
