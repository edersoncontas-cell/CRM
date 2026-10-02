// 02/10: "desconectei, conectei, mandei mensagem de outro telefone e não
// chegou". O "Testar recebimento" diz onde a mensagem parou e o resgate puxa
// da Evolution o que o webhook não trouxe. Regras puras.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  horaDoRegistro, escolherParaResgate, lerMemoria, memoriaDepois, inicioDaJanela, concluirTeste,
  JANELA_MAX_MS, MEMORIA_VAZIA, type EntradaConclusao,
} from "@/lib/whatsapp-resgate-regra";
import { semChaveNaUrl } from "@/lib/evolution";

const reg = (id: string, segundos: number, o: { fromMe?: boolean; jid?: string } = {}) => ({
  key: { id, fromMe: o.fromMe ?? false, remoteJid: o.jid ?? "5527999990002@s.whatsapp.net" },
  message: { conversation: "oi" },
  messageTimestamp: segundos,
});
const T = 1_790_000_000; // segundos

describe("hora da mensagem guardada na Evolution", () => {
  it("segundos, milissegundos, texto e Long {low, high}", () => {
    expect(horaDoRegistro({ messageTimestamp: T })).toBe(T * 1000);
    expect(horaDoRegistro({ messageTimestamp: T * 1000 })).toBe(T * 1000);
    expect(horaDoRegistro({ messageTimestamp: String(T) })).toBe(T * 1000);
    expect(horaDoRegistro({ messageTimestamp: { low: T, high: 0 } })).toBe(T * 1000);
    expect(horaDoRegistro({})).toBe(0);
  });
});

describe("o que puxar da Evolution", () => {
  const base = { desde: (T - 600) * 1000, noCrm: new Set<string>(), vistos: new Set<string>(), max: 20 };

  it("só o que o CRM não tem, dentro da janela, do mais antigo para o mais novo", () => {
    const r = escolherParaResgate([reg("c", T), reg("b", T - 60), reg("velha", T - 3600), reg("tem", T - 30)], { ...base, noCrm: new Set(["tem"]) });
    expect(r.map((x) => (x.key as { id: string }).id)).toEqual(["b", "c"]);
  });

  it("story/status e lista de transmissão nunca entram", () => {
    const r = escolherParaResgate([reg("s", T, { jid: "status@broadcast" }), reg("l", T, { jid: "123@broadcast" })], base);
    expect(r).toHaveLength(0);
  });

  it("o que o CRM já tratou (e deixou de fora) não volta a cada passada", () => {
    expect(escolherParaResgate([reg("grupo-ja-visto", T)], { ...base, vistos: new Set(["grupo-ja-visto"]) })).toHaveLength(0);
  });

  it("'ate' deixa de fora a janela do teste (contada pelo próprio teste)", () => {
    const r = escolherParaResgate([reg("antes", T - 120), reg("no-teste", T)], { ...base, ate: (T - 60) * 1000 });
    expect(r.map((x) => (x.key as { id: string }).id)).toEqual(["antes"]);
  });

  it("no máximo `max` por vez, e a mesma mensagem repetida conta uma vez", () => {
    const muitas = Array.from({ length: 30 }, (_, i) => reg(`m${i}`, T - i));
    expect(escolherParaResgate([...muitas, reg("m0", T)], { ...base, max: 5 })).toHaveLength(5);
  });

  it("enviadas pelo celular também vêm (o webhook também as traria)", () => {
    expect(escolherParaResgate([reg("eu", T, { fromMe: true })], base)).toHaveLength(1);
  });
});

describe("memória do resgate", () => {
  it("valor estranho = memória vazia", () => {
    expect(lerMemoria("{")).toEqual(MEMORIA_VAZIA);
    expect(lerMemoria(JSON.stringify({ vistos: [1, "a"], ultimaVez: "x" }))).toEqual({ vistos: ["a"], ultimaVez: null });
  });

  it("janela do vigia: 30 min na primeira vez; depois desde a última passada (com folga); nunca mais de 2 h", () => {
    const agora = T * 1000;
    expect(inicioDaJanela(MEMORIA_VAZIA, agora)).toBe(agora - 30 * 60_000);
    expect(inicioDaJanela({ vistos: [], ultimaVez: agora - 5 * 60_000 }, agora)).toBe(agora - 15 * 60_000);
    expect(inicioDaJanela({ vistos: [], ultimaVez: agora - 24 * 3600_000 }, agora)).toBe(agora - JANELA_MAX_MS);
  });

  it("o teste puxar NÃO move a hora do vigia (senão ele pularia o que ficou para trás)", () => {
    const m = { vistos: ["a"], ultimaVez: 100 };
    expect(memoriaDepois(m, ["b"], null)).toEqual({ vistos: ["a", "b"], ultimaVez: 100 });
    expect(memoriaDepois(m, ["b"], 200).ultimaVez).toBe(200);
  });

  it("guarda no máximo 400 vistos", () => {
    const m = memoriaDepois(MEMORIA_VAZIA, Array.from({ length: 500 }, (_, i) => `x${i}`), 1);
    expect(m.vistos).toHaveLength(400);
    expect(m.vistos[399]).toBe("x499");
  });
});

describe("conclusão do Testar recebimento", () => {
  const e = (o: Partial<EntradaConclusao>): EntradaConclusao => ({
    evolutionRespondeu: true, evolutionGuarda: null, recebidasNaEvolution: 0, faltandoNoCrm: 0,
    eventosWebhook: [], puxadasNaJanela: [], conexao: "viva", esgotou: false, ...o,
  });

  it("chegou pelo webhook", () => {
    expect(concluirTeste(e({ eventosWebhook: [{ dir: "in", status: "recebida" }] })).situacao).toBe("chegou");
  });

  it("a Evolution recebeu, o aviso não veio, o CRM puxou", () => {
    const c = concluirTeste(e({ recebidasNaEvolution: 1, puxadasNaJanela: ["recebida"] }));
    expect(c.situacao).toBe("puxada");
    expect(c.final).toBe(true);
  });

  it("aviso recusado (chave ou instância antiga)", () => {
    expect(concluirTeste(e({ eventosWebhook: [{ dir: "-", status: "outra-instancia" }] })).situacao).toBe("recusada-no-webhook");
    expect(concluirTeste(e({ eventosWebhook: [{ dir: "-", status: "chave-recusada" }] })).texto).toMatch(/chave/);
  });

  it("chegou e foi descartada (grupo, bloqueado…), pelo aviso ou puxada", () => {
    expect(concluirTeste(e({ eventosWebhook: [{ dir: "in", status: "grupo" }] })).texto).toMatch(/"grupo"/);
    expect(concluirTeste(e({ puxadasNaJanela: ["bloqueado"] })).situacao).toBe("descartada");
  });

  it("conexão morta por dentro: conclui na hora e oferece Refazer do zero", () => {
    const c = concluirTeste(e({ conexao: "morta" }));
    expect(c.situacao).toBe("conexao-morta");
    expect(c.final && c.refazer).toBe(true);
  });

  it("a Evolution tem e o CRM ainda não: espera a próxima consulta puxar; no fim do tempo, diz que não conseguiu", () => {
    expect(concluirTeste(e({ recebidasNaEvolution: 1, faltandoNoCrm: 1 })).final).toBe(false);
    expect(concluirTeste(e({ recebidasNaEvolution: 1, faltandoNoCrm: 1, esgotou: true, erroAoPuxar: "timeout" })).texto).toMatch(/timeout/);
  });

  it("a Evolution tem e o CRM também (chegou um instante antes): chegou", () => {
    expect(concluirTeste(e({ recebidasNaEvolution: 1, faltandoNoCrm: 0 })).situacao).toBe("chegou");
  });

  it("nada chegou nem na Evolution — só conclui quando o tempo acaba", () => {
    expect(concluirTeste(e({})).final).toBe(false);
    const c = concluirTeste(e({ esgotou: true, evolutionGuarda: 120 }));
    expect(c.situacao).toBe("nao-chegou-na-evolution");
    expect(c.refazer).toBe(true);
  });

  it("Evolution que não guarda mensagens ou fora do ar: diz que não dá para conferir por ela", () => {
    expect(concluirTeste(e({ esgotou: true, evolutionGuarda: 0 })).texto).toMatch(/DATABASE_SAVE_DATA_NEW_MESSAGE/);
    expect(concluirTeste(e({ esgotou: true, evolutionRespondeu: false, erroEvolution: "HTTP 500" })).texto).toMatch(/HTTP 500/);
  });

  it("toda situação termina quando o tempo acaba (a tela nunca fica girando)", () => {
    const casos: Partial<EntradaConclusao>[] = [{}, { recebidasNaEvolution: 2, faltandoNoCrm: 2 }, { conexao: "desconhecida" }, { evolutionRespondeu: false }, { evolutionGuarda: 0 }];
    for (const c of casos) expect(concluirTeste(e({ ...c, esgotou: true })).final).toBe(true);
  });
});

describe("a chave da Evolution nunca aparece na tela", () => {
  it("mascara ?apikey= na URL do webhook", () => {
    const t = semChaveNaUrl("certo (https://crm.vercel.app/api/webhooks/evolution?apikey=SEGREDO-123456)");
    expect(t).not.toMatch(/SEGREDO/);
    expect(t).toMatch(/apikey=••••56/);
  });

  it("o diagnóstico e o 'Configurar webhook' passam pela máscara", () => {
    expect(readFileSync("src/lib/zapi.ts", "utf8")).toMatch(/etapas\.map\(\(e\) => \(\{ \.\.\.e, detalhe: semChaveNaUrl/);
    expect(readFileSync("src/lib/actions.ts", "utf8")).toMatch(/url: semChaveNaUrl\(url\)/);
  });
});

describe("as duas portas de entrada usam o mesmo caminho", () => {
  it("webhook e resgate passam por processarDadoEvolution", () => {
    expect(readFileSync("src/app/api/webhooks/evolution/route.ts", "utf8")).toMatch(/processarDadoEvolution\(data, "webhook"\)/);
    expect(readFileSync("src/lib/whatsapp-resgate.ts", "utf8")).toMatch(/processarDadoEvolution\(reg, "resgate"\)/);
  });

  it("o vigia puxa o que o webhook perdeu", () => {
    expect(readFileSync("src/app/api/cron/whatsapp-vigia/route.ts", "utf8")).toMatch(/resgatarMensagensEvolution\(\)/);
  });
});

describe("volta do banco provisório", () => {
  it("a memória do resgate é de cada banco (como a do vigia): não vem", async () => {
    const { configPodeVir } = await import("@/lib/trazer-provisorio-regra");
    expect(configPodeVir("whatsapp.resgate")).toBe(false);
    expect(configPodeVir("whatsapp.instancia.ativa")).toBe(true);
  });
});
