import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  chavesDoClienteNoProvisorio, indiceDeClientes, completarCliente, chavesDaConversa, completarConversa,
  tratarConversaNova, chaveDaMensagem, tratarMensagem, tratarEnvio, configPodeVir, juntarHistoricoFrase,
  mesmoBanco, provedorDoEndereco, AVISO_ENVIO_CANCELADO,
} from "@/lib/trazer-provisorio-regra";
import { ETAPAS, TABELAS_QUE_NAO_VEM, rodarVolta, conferirConexoes, type Sql } from "@/lib/trazer-provisorio";

// A prova de ponta a ponta, com dois Postgres, está em
// scripts/provar-trazer-provisorio.ts. Aqui ficam as regras puras — e a
// garantia de que nenhuma tabela nova fica esquecida na volta.

describe("toda tabela do banco tem destino decidido na volta", () => {
  it("cada model do schema.prisma está nas etapas, é Configuracao, ou está na lista do que não vem", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
    const cobertas = new Set([...ETAPAS.map((e) => e.tabela), "Configuracao", ...TABELAS_QUE_NAO_VEM]);
    const esquecidas = models.filter((m) => !cobertas.has(m));
    // Tabela nova sem decisão = dados da semana que somem na volta.
    expect(esquecidas).toEqual([]);
  });

  it("pais vêm antes dos filhos", () => {
    const ordem = ETAPAS.map((e) => e.tabela);
    for (const e of ETAPAS) {
      for (const pai of Object.values(e.pais ?? {})) {
        if (pai.tabela === e.tabela) continue;
        expect(ordem.indexOf(pai.tabela), `${e.tabela} depende de ${pai.tabela}`).toBeLessThan(ordem.indexOf(e.tabela));
      }
    }
  });
});

describe("travas nunca vêm do provisório", () => {
  it("trava do WhatsApp, trava de IA paga e marcas de manutenção ficam de fora", () => {
    expect(configPodeVir("whatsapp.pausa.v1")).toBe(false);
    expect(configPodeVir("ia.somente_gratuitos")).toBe(false);
    expect(configPodeVir("manutencao.v44")).toBe(false);
    expect(configPodeVir("provisorio.volta")).toBe(false);
    expect(configPodeVir("zeus.ia_usada.2026-09-25")).toBe(false);
  });
  it("configuração comum vem (só se o principal não tiver — decidido no motor)", () => {
    expect(configPodeVir("filtro.contatos.termos")).toBe(true);
    expect(configPodeVir("menu_ordem_v1")).toBe(true);
  });
});

describe("nada do provisório sai pelo WhatsApp sozinho", () => {
  it("envio em massa pendente ou no meio chega cancelado", () => {
    expect(tratarEnvio({ status: "pendente" })).toMatchObject({ status: "cancelado", erro: AVISO_ENVIO_CANCELADO });
    expect(tratarEnvio({ status: "enviando" })).toMatchObject({ status: "cancelado" });
    expect(tratarEnvio({ status: "enviado" })).toEqual({ status: "enviado" });
  });
  it("mensagem que falhou chega sem tentativas sobrando; o resto não muda", () => {
    expect(tratarMensagem({ direction: "OUT", sendStatus: "FAILED", retryCount: 0 })).toMatchObject({ retryCount: 3 });
    expect(tratarMensagem({ direction: "OUT", sendStatus: "SENT", retryCount: 0 })).toMatchObject({ retryCount: 0 });
    expect(tratarMensagem({ direction: "IN", sendStatus: null })).toEqual({ direction: "IN", sendStatus: null });
  });
  it("conversa nova chega sem resposta automática agendada", () => {
    expect(tratarConversaNova({ id: "c", agnesScheduledAt: new Date() }).agnesScheduledAt).toBeNull();
  });
});

describe("mesmo cliente nos dois bancos", () => {
  const principal = [
    { id: "p1", nome: "Joao da Silva", telefone: "28999887766", googleContatoId: "people/c1" },
    { id: "p2", nome: "Maria Souza", telefone: null, googleContatoId: null },
    { id: "p3", nome: "Carlos Lima", telefone: "27988887777", googleContatoId: null },
    { id: "p4", nome: "Carlos Lima", telefone: "27911112222", googleContatoId: null },
  ];
  const idx = indiceDeClientes(principal);
  const casa = (c: Record<string, unknown>) => chavesDoClienteNoProvisorio(c).map((k) => idx.get(k)).find(Boolean);

  it("pelo contato do Google", () => expect(casa({ nome: "Outro nome", telefone: null, googleContatoId: "people/c1" })).toBe("p1"));
  it("pelo telefone, em qualquer formato (55 e 9º dígito)", () => {
    expect(casa({ nome: "J. Silva", telefone: "5528999887766" })).toBe("p1");
    expect(casa({ nome: "J. Silva", telefone: "2899887766" })).toBe("p1");
  });
  it("pelo nome quando um dos dois não tem telefone", () => {
    expect(casa({ nome: "Maria Souza", telefone: "28988776655" })).toBe("p2");
  });
  it("nome igual com números diferentes são pessoas diferentes; nome ambíguo não casa", () => {
    expect(casa({ nome: "Carlos Lima", telefone: "27933334444" })).toBeUndefined();
    expect(casa({ nome: "Carlos Lima", telefone: null })).toBeUndefined();
  });
});

describe("completar o cadastro do principal", () => {
  it("preenche o vazio e nunca troca o que já tinha", () => {
    const p = completarCliente({ email: null, endereco: "Rua A" }, { email: "x@y.com", endereco: "Rua B" });
    expect(p).toEqual({ email: "x@y.com" });
  });
  it("quem respondeu SAIR no provisório fica marcado", () => {
    const quando = new Date("2026-09-25T10:00:00Z");
    expect(completarCliente({ naoPerturbe: false }, { naoPerturbe: true, naoPerturbeEm: quando, naoPerturbeMotivo: "SAIR" }))
      .toMatchObject({ naoPerturbe: true, naoPerturbeEm: quando, naoPerturbeMotivo: "SAIR" });
    // e o contrário não desmarca
    expect(completarCliente({ naoPerturbe: true }, { naoPerturbe: false })).toEqual({});
  });
  it("o contato mais recente vence, com o 'esperando resposta' dele", () => {
    const velho = new Date("2026-09-10"), novo = new Date("2026-09-26");
    expect(completarCliente({ ultimoContato: velho, aguardandoResposta: false }, { ultimoContato: novo, aguardandoResposta: true }))
      .toEqual({ ultimoContato: novo, aguardandoResposta: true });
    expect(completarCliente({ ultimoContato: novo }, { ultimoContato: velho, aguardandoResposta: true })).toEqual({});
  });
});

describe("conversas e mensagens", () => {
  it("mesma conversa com e sem o 9º dígito", () => {
    const a = chavesDaConversa({ externalPhone: "5528999887766", isGroup: false });
    const b = chavesDaConversa({ externalPhone: "552899887766", isGroup: false });
    expect(a.find((k) => k.startsWith("c:"))).toBe(b.find((k) => k.startsWith("c:")));
  });
  it("conversa: a mais recente decide 'encerrada'; o vazio é completado", () => {
    const p = completarConversa(
      { lastMessageAt: new Date("2026-09-10"), encerrada: true, clienteId: null },
      { lastMessageAt: new Date("2026-09-26"), encerrada: false, clienteId: "c1" },
    );
    expect(p).toMatchObject({ encerrada: false, clienteId: "c1" });
  });
  it("mensagem: pelo id do WhatsApp; sem ele, pelo texto no mesmo instante", () => {
    expect(chaveDaMensagem({ zapiMessageId: "ABC" })).toBe("z:ABC");
    const t = new Date("2026-09-25T12:00:00Z");
    expect(chaveDaMensagem({ conversationId: "c", direction: "IN", sentAt: t, body: "oi" }))
      .toBe(chaveDaMensagem({ conversationId: "c", direction: "IN", sentAt: new Date(t), body: "oi" }));
  });
});

describe("histórico da motivação do dia", () => {
  it("junta os dois, sem repetir, em ordem de data", () => {
    const p = JSON.stringify([{ d: "2026-09-20", f: "A" }, { d: "2026-09-21", f: "B" }]);
    const v = JSON.stringify([{ d: "2026-09-21", f: "B" }, { d: "2026-09-25", f: "C" }]);
    expect(JSON.parse(juntarHistoricoFrase(p, v)).map((r: { f: string }) => r.f)).toEqual(["A", "B", "C"]);
  });
  it("lixo em um dos lados não derruba", () => {
    expect(JSON.parse(juntarHistoricoFrase("{quebrado", JSON.stringify([{ d: "2026-09-25", f: "C" }])))).toHaveLength(1);
  });
});

describe("os dois endereços", () => {
  const neonPooler = "postgresql://u:SENHA@ep-x-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require";
  const neonDireto = "postgresql://u:SENHA@ep-x.sa-east-1.aws.neon.tech/neondb?sslmode=require";
  const supa = "postgresql://postgres.abc:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";
  it("com e sem pooler é o mesmo banco; Neon e Supabase não", () => {
    expect(mesmoBanco(neonPooler, neonDireto)).toBe(true);
    expect(mesmoBanco(neonPooler, supa)).toBe(false);
    expect(mesmoBanco(undefined, supa)).toBe(false);
  });
  it("diz o provedor sem nunca devolver o endereço", () => {
    expect(provedorDoEndereco(neonPooler)).toBe("Neon");
    expect(provedorDoEndereco(supa)).toBe("Supabase");
    expect(provedorDoEndereco("isso não é url")).toBe("desconhecido");
    expect(provedorDoEndereco(neonPooler)).not.toContain("SENHA");
  });
});

describe("banco que não responde", () => {
  // Foi o defeito visto na tela: com o provisório fora do ar, cada tabela
  // virava um erro (37) e ainda aparecia "não há nada a trazer" em verde.
  const foraDoAr = (): Sql => {
    const falha = () => Promise.reject(Object.assign(new Error("Can't reach database server at `localhost:5499`"), { code: "P2010" }));
    return { $queryRawUnsafe: falha, $executeRawUnsafe: falha } as unknown as Sql;
  };
  const vivo = (): Sql => ({ $queryRawUnsafe: async () => [{ "?column?": 1 }], $executeRawUnsafe: async () => 0 }) as unknown as Sql;

  it("conferirConexoes diz QUAL banco não respondeu", async () => {
    await expect(conferirConexoes(foraDoAr(), vivo())).rejects.toThrow(/provisório não respondeu/);
    await expect(conferirConexoes(vivo(), foraDoAr())).rejects.toThrow(/principal não respondeu/);
  });
  it("a comparação para de uma vez, em vez de devolver um erro por tabela", async () => {
    await expect(rodarVolta({ origem: foraDoAr(), destino: vivo(), aplicar: false })).rejects.toThrow(/Can't reach/);
  });
});
