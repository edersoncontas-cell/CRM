import { describe, it, expect } from "vitest";
import {
  nomeMarcadoComAsterisco, motivoBloqueioComListas, MOTIVO_ASTERISCO,
  TERMOS_BLOQUEIO_PADRAO, PALAVRAS_BLOQUEIO_PADRAO,
} from "@/lib/utils";
import { planejarSincronizacao, type ContatoGoogle } from "@/lib/google-contatos-util";

const motivo = (nome: string) => motivoBloqueioComListas(nome, TERMOS_BLOQUEIO_PADRAO, PALAVRAS_BLOQUEIO_PADRAO);

describe("marca de asterisco na agenda do celular", () => {
  it("reconhece o asterisco no fim do nome", () => {
    expect(nomeMarcadoComAsterisco("Compadre Zé *")).toBe(true);
    expect(nomeMarcadoComAsterisco("Padaria do Bairro*")).toBe(true);
    expect(nomeMarcadoComAsterisco("Vizinho **")).toBe(true);
  });

  it("não confunde com nome normal nem com asterisco no meio", () => {
    expect(nomeMarcadoComAsterisco("João Construtora")).toBe(false);
    expect(nomeMarcadoComAsterisco("Obras * Asfalto ES")).toBe(false);
    expect(nomeMarcadoComAsterisco("")).toBe(false);
    expect(nomeMarcadoComAsterisco(null)).toBe(false);
  });

  it("bloqueia o contato pelo asterisco, com motivo próprio", () => {
    expect(motivo("Compadre Zé *")).toBe(MOTIVO_ASTERISCO);
    expect(motivo("Construtora Vale Verde")).toBeNull();
  });

  it("a sincronização do Google não cria cliente para quem tem asterisco", () => {
    const contatos: ContatoGoogle[] = [
      { id: "people/1", nome: "Compadre Zé *", telefones: ["5528999990001"], emails: [], enderecos: [], empresa: null },
      { id: "people/2", nome: "Construtora Vale Verde", telefones: ["5528999990002"], emails: [], enderecos: [], empresa: null },
    ];
    const plano = planejarSincronizacao(contatos, [], []);
    expect(plano.criar.map((c) => c.nome)).toEqual(["Construtora Vale Verde"]);
    expect(plano.ignorados).toBe(1);
  });
});
