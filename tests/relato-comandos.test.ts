// "Através do campo de preenchimento da visita, o sistema pode gerar ou
//  atualizar alguma negociação em andamento (…) que seja para mudar uma
//  negociação de uma coluna para outra nas negociações, seja para remarcar
//  visitas, seja para agendar outra visita."
//
// Criar/atualizar negociação e agendar a próxima visita a leitura por IA já
// resolvia. Mover de COLUNA é a que não pode ser adivinhada: é ação com
// consequência visível no funil, e tem de acontecer quando ele MANDOU e não
// acontecer quando ele só narrou. Numa terça de sete visitas, uma IA
// entusiasmada embaralharia o funil sem ninguém saber por quê.

import { describe, it, expect } from "vitest";
import { colunaDestinoDoRelato, pareceOrdemDeMover } from "@/lib/relato-comandos";

// Os títulos reais do funil deste CRM (o vendedor pode renomear, por isso a
// lista vem do banco e nunca fica escrita no código).
const COLUNAS = [
  "Primeiro contato",
  "Visitas pendentes",
  "Visita realizada",
  "Proposta enviada",
  "Em banco",
  "Confirmada",
];

const destino = (relato: string) => colunaDestinoDoRelato(relato, COLUNAS);

describe("mover de coluna acontece quando ele MANDA", () => {
  it.each([
    ["passa pra proposta enviada", "Proposta enviada"],
    ["Passa o João para proposta enviada", "Proposta enviada"],
    ["mover para em banco", "Em banco"],
    ["joga pra visita realizada", "Visita realizada"],
    ["manda para confirmada", "Confirmada"],
    ["coloca pro primeiro contato", "Primeiro contato"],
    ["avança para proposta enviada", "Proposta enviada"],
  ])("%s → %s", (relato, esperado) => {
    expect(destino(relato)).toBe(esperado);
  });

  it("acento e caixa não atrapalham", () => {
    expect(destino("MOVER PARA VISITA REALIZADA")).toBe("Visita realizada");
    expect(destino("avanca para em banco")).toBe("Em banco");
  });

  it("no meio de um relato de verdade, continua achando", () => {
    expect(destino("visitei o João, gostou da E145, orcei 610 mil, passa pra proposta enviada"))
      .toBe("Proposta enviada");
  });
});

describe("e NÃO acontece quando ele só narra", () => {
  it.each([
    "fiz a visita realizada ontem, foi boa",
    "cliente pediu proposta enviada por email",
    "conversamos sobre o primeiro contato que tivemos",
    "visita realizada com sucesso",
    "ele está em banco aguardando aprovação",
  ])("%s não move nada", (relato) => {
    expect(destino(relato)).toBeNull();
  });

  it("verbo sem preposição não é ordem", () => {
    expect(destino("passei na obra e vi a máquina")).toBeNull();
  });

  it("preposição sem verbo também não", () => {
    expect(destino("proposta enviada para o cliente")).toBeNull();
  });

  it("relato curto demais não vira comando", () => {
    expect(destino("ok")).toBeNull();
    expect(destino("")).toBeNull();
  });
});

describe("entre duas colunas parecidas, vence a mais específica", () => {
  it("'visitas pendentes' não é atropelado por uma coluna de nome menor", () => {
    const colunas = ["Visita", "Visitas pendentes"];
    expect(colunaDestinoDoRelato("passa pra visitas pendentes", colunas)).toBe("Visitas pendentes");
  });
});

describe("mandou mover para uma coluna que não existe", () => {
  it("a tela precisa saber, para avisar em vez de fingir que moveu", () => {
    expect(destino("passa pra coluna do vovô")).toBeNull();
    expect(pareceOrdemDeMover("passa pra coluna do vovô")).toBe(true);
  });

  it("relato sem ordem nenhuma não dispara o aviso", () => {
    expect(pareceOrdemDeMover("visitei o cliente e ele gostou")).toBe(false);
  });
});
