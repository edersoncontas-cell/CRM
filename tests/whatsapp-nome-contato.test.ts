// Renomear o contato na agenda do celular não aparecia no CRM.
//
// Causa: a única fonte de nome era o "pushName", que vem junto de cada
// mensagem — e o pushName é o nome que o PRÓPRIO contato escolheu no WhatsApp
// dele. Mexer na sua agenda não muda o pushName de ninguém, então a alteração
// nunca tinha como chegar. Além disso, a regra antiga nunca trocava um nome
// que já estivesse preenchido.
//
// A regra nova: o nome da AGENDA manda; o nome de perfil só preenche vazio.

import { describe, it, expect } from "vitest";
import { nomeQueDeveValer, pareceNome } from "@/lib/whatsapp-routing";

describe("qual nome deve valer para a conversa", () => {
  it("renomeou na agenda do celular → o CRM passa a mostrar o nome novo", () => {
    // É o caso que estava quebrado.
    expect(nomeQueDeveValer("Elton Cp", "Elton Compactação", "Elton")).toBe("Elton Compactação");
  });

  it("nome da agenda igual ao que já está → não mexe", () => {
    expect(nomeQueDeveValer("Elton Cp", "Elton Cp", "Elton")).toBeNull();
  });

  it("o nome de perfil NÃO derruba o nome da agenda", () => {
    // Sem isto, toda mensagem recebida trocaria o nome que você escreveu pelo
    // apelido que o contato pôs no WhatsApp dele.
    expect(nomeQueDeveValer("Elton Compactação", null, "🔥 Elton 🔥")).toBeNull();
  });

  it("conversa sem nome nenhum → o nome de perfil serve", () => {
    expect(nomeQueDeveValer(null, null, "Elton")).toBe("Elton");
    expect(nomeQueDeveValer("", null, "Elton")).toBe("Elton");
  });

  it("conversa mostrando o número → qualquer nome de verdade melhora", () => {
    expect(nomeQueDeveValer("5527999183562", null, "Elton")).toBe("Elton");
    expect(nomeQueDeveValer("+55 (27) 99918-3562", "Elton Compactação", null)).toBe("Elton Compactação");
  });

  it("número nunca vira nome", () => {
    expect(nomeQueDeveValer("Elton Compactação", "5527999183562", null)).toBeNull();
    expect(nomeQueDeveValer(null, "5527999183562", "+55 27 99918-3562")).toBeNull();
  });

  it("provedor sem nome nenhum → não mexe", () => {
    expect(nomeQueDeveValer("Elton Compactação", null, null)).toBeNull();
    expect(nomeQueDeveValer("Elton Compactação", "", "  ")).toBeNull();
  });

  it("espaço em volta não conta como mudança", () => {
    expect(nomeQueDeveValer("Elton Cp", "  Elton Cp  ", null)).toBeNull();
  });

  it("pareceNome separa nome de número", () => {
    expect(pareceNome("Elton Compactação")).toBe(true);
    expect(pareceNome("Elton 27")).toBe(true);
    expect(pareceNome("5527999183562")).toBe(false);
    expect(pareceNome("+55 (27) 99918-3562")).toBe(false);
    expect(pareceNome("")).toBe(false);
    expect(pareceNome(null)).toBe(false);
  });
});
