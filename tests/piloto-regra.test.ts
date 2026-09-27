import { describe, it, expect } from "vitest";
import {
  ehRespostaDoVendedor, ehSoCortesia, esperasDaConversa, noHorarioComercial, mediana, resumirRespostas, duracaoCurta,
  negociacaoValeNoPeriodo, estaEsfriando, lerHistoricoEsfriando, anotarDia, primeiraAnotacaoDesde,
  criterioMotivos, criterioEsfriando, criterioConversas, diasDoPiloto, ehConversaDeVenda, quandoSaiu,
  ROTULO_ENVIO_MASSA, ROTULO_ANIVERSARIO, type MensagemLite,
} from "@/lib/piloto-regra";
import { chaveMotivoPerda } from "@/lib/pipeline";

// Segunda-feira, 21/09/2026. 13:00Z = 10h de Brasília.
const seg = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 21, h + 3, m));
const IN = (d: Date, body = "Qual o valor da retro?"): MensagemLite => ({ direction: "IN", sentAt: d, operatorDisplayName: null, sendStatus: null, body });
const OUT = (d: Date, rotulo: string | null = "Você", status: string | null = "SENT"): MensagemLite => ({ direction: "OUT", sentAt: d, operatorDisplayName: rotulo, sendStatus: status, body: "resposta" });

describe("quem conta como resposta", () => {
  it("vendedor pelo CRM, pelo celular e rascunho aprovado contam", () => {
    expect(ehRespostaDoVendedor(OUT(seg(10)))).toBe(true);
    expect(ehRespostaDoVendedor(OUT(seg(10), "Enviada fora do CRM"))).toBe(true);
    expect(ehRespostaDoVendedor(OUT(seg(10), "Orientador de Vendas"))).toBe(true);
    expect(ehRespostaDoVendedor(OUT(seg(10), null))).toBe(true);
  });
  it("envio em massa, parabéns automático e mensagem que falhou não contam", () => {
    expect(ehRespostaDoVendedor(OUT(seg(10), ROTULO_ENVIO_MASSA))).toBe(false);
    expect(ehRespostaDoVendedor(OUT(seg(10), ROTULO_ANIVERSARIO))).toBe(false);
    expect(ehRespostaDoVendedor(OUT(seg(10), "Você", "FAILED"))).toBe(false);
    expect(ehRespostaDoVendedor(IN(seg(10)))).toBe(false);
  });
  it("mensagem reenviada pela nova tentativa vale da hora em que saiu de fato", () => {
    const m = { ...OUT(seg(10)), retryCount: 1, lastRetryAt: seg(11) };
    expect(quandoSaiu(m).getTime()).toBe(seg(11).getTime());
    expect(quandoSaiu(OUT(seg(10))).getTime()).toBe(seg(10).getTime());
  });
});

describe("recado que não pede resposta", () => {
  it("cortesia pura", () => {
    for (const t of ["ok", "Obrigado!", "👍", "ok obrigado pela atenção", "Valeu, tmj", "kkkk", "Beleza"]) expect(ehSoCortesia(t), t).toBe(true);
    expect(ehSoCortesia("", "sticker")).toBe(true);
  });
  it("saudação, pergunta, combinado e mídia esperam resposta", () => {
    for (const t of ["Bom dia", "Qual valor?", "ok, amanhã passo aí", "tudo bem?", "Oi", "Sim quero a proposta"]) expect(ehSoCortesia(t), t).toBe(false);
    expect(ehSoCortesia("", "image")).toBe(false);
    expect(ehSoCortesia("", "audio")).toBe(false);
  });
});

describe("esperas de uma conversa", () => {
  it("recados seguidos são uma espera só, contada do primeiro", () => {
    const e = esperasDaConversa([IN(seg(10)), IN(seg(10, 5)), OUT(seg(10, 30))]);
    expect(e).toHaveLength(1);
    expect(e[0].chegou.getTime()).toBe(seg(10).getTime());
    expect(e[0].respondida!.getTime()).toBe(seg(10, 30).getTime());
  });
  it("envio em massa no meio não fecha a espera", () => {
    const e = esperasDaConversa([IN(seg(10)), OUT(seg(11), ROTULO_ENVIO_MASSA), OUT(seg(15))]);
    expect(e[0].respondida!.getTime()).toBe(seg(15).getTime());
  });
  it("só cortesia não abre espera; cortesia seguida de pergunta abre, contada da cortesia", () => {
    expect(esperasDaConversa([OUT(seg(9)), IN(seg(10), "obrigado")])).toHaveLength(0);
    const e = esperasDaConversa([IN(seg(10), "obrigado"), IN(seg(10, 20), "e a entrada, quanto fica?"), OUT(seg(11))]);
    expect(e).toHaveLength(1);
    expect(e[0].chegou.getTime()).toBe(seg(10).getTime());
  });
  it("a marca de respondida dispensa só a última espera", () => {
    const e = esperasDaConversa([IN(seg(9)), IN(seg(12))], { encerrada: true });
    expect(e).toHaveLength(1);
    expect(e[0].dispensada).toBe(true);
    const f = esperasDaConversa([IN(seg(9)), OUT(seg(10)), IN(seg(12))], { encerrada: true });
    expect(f.map((x) => x.dispensada)).toEqual([false, true]);
    expect(esperasDaConversa([IN(seg(9))])[0].dispensada).toBe(false);
  });
  it("primeiro contato é a espera que começa na primeira mensagem da conversa", () => {
    const e = esperasDaConversa([IN(seg(9)), OUT(seg(10)), IN(seg(12)), OUT(seg(13))], { inicioDaConversa: seg(9) });
    expect(e.map((x) => x.primeiroContato)).toEqual([true, false]);
    const g = esperasDaConversa([OUT(seg(8)), IN(seg(9)), OUT(seg(10))], { inicioDaConversa: seg(8) });
    expect(g[0].primeiroContato).toBe(false);
  });
  it("aceita mensagens fora de ordem", () => {
    const e = esperasDaConversa([OUT(seg(11)), IN(seg(10))]);
    expect(e[0].respondida!.getTime()).toBe(seg(11).getTime());
  });
  it("resposta que falhou não fecha a espera", () => {
    const e = esperasDaConversa([IN(seg(10)), OUT(seg(10, 5), "Você", "FAILED")]);
    expect(e[0].respondida).toBeNull();
  });
});

describe("horário comercial e mediana", () => {
  it("segunda a sexta, 8h às 18h de Brasília", () => {
    expect(noHorarioComercial(seg(8))).toBe(true);
    expect(noHorarioComercial(seg(17, 59))).toBe(true);
    expect(noHorarioComercial(seg(18))).toBe(false);
    expect(noHorarioComercial(seg(7, 59))).toBe(false);
    const sabado = new Date(Date.UTC(2026, 8, 26, 13));
    expect(noHorarioComercial(sabado)).toBe(false);
  });
  it("mediana", () => {
    expect(mediana([])).toBeNull();
    expect(mediana([5, 1, 3])).toBe(3);
    expect(mediana([1, 2, 3, 10])).toBe(2.5);
  });
});

describe("resumo das respostas", () => {
  it("separa horário, conta 1ª resposta, sem resposta e dispensadas; só o período", () => {
    const esperas = [
      { chegou: seg(10), respondida: seg(10, 20), primeiroContato: true, dispensada: false },
      { chegou: seg(11), respondida: seg(13), primeiroContato: false, dispensada: false },
      { chegou: seg(20), respondida: new Date(seg(20).getTime() + 12 * 3600_000), primeiroContato: false, dispensada: false },
      { chegou: seg(14), respondida: null, primeiroContato: false, dispensada: false },
      { chegou: seg(15), respondida: null, primeiroContato: false, dispensada: true },
      // fora do período
      { chegou: new Date(Date.UTC(2026, 7, 1, 13)), respondida: null, primeiroContato: false, dispensada: false },
      // chegou há 10 minutos: não é atraso ainda
      { chegou: seg(16, 50), respondida: null, primeiroContato: false, dispensada: false },
    ];
    const r = resumirRespostas(esperas, new Date(Date.UTC(2026, 8, 20)), seg(23), seg(17));
    expect(r.noHorario.total).toBe(4);
    expect(r.noHorario.respondidas).toBe(2);
    expect(r.noHorario.medianaMin).toBe(70);
    expect(r.noHorario.ateUmaHora).toBe(1);
    expect(r.noHorario.baseUmaHora).toBe(3);
    expect(r.foraDoHorario.total).toBe(1);
    expect(r.foraDoHorario.medianaMin).toBe(720);
    expect(r.primeiroContato.respondidas).toBe(1);
    expect(r.semResposta).toBe(2);
    expect(r.dispensadas).toBe(1);
  });
  it("duração curta", () => {
    expect(duracaoCurta(null)).toBe("—");
    expect(duracaoCurta(0.4)).toBe("menos de 1 min");
    expect(duracaoCurta(8)).toBe("8 min");
    expect(duracaoCurta(130)).toBe("2h 10min");
    expect(duracaoCurta(60 * 27)).toBe("1 dia 3h");
    expect(duracaoCurta(60 * 48)).toBe("2 dias");
  });
});

describe("conversa de venda × negociação", () => {
  const inicio = new Date(Date.UTC(2026, 7, 1));
  const fim = new Date(Date.UTC(2026, 8, 30));
  const neg = (o: Partial<{ criadoEm: Date; atualizadoEm: Date; status: string; negociacaoAntiga: boolean }>) => ({
    criadoEm: new Date(Date.UTC(2026, 5, 1)), atualizadoEm: new Date(Date.UTC(2026, 5, 1)), status: "aberta", negociacaoAntiga: false, ...o,
  });
  it("conversa de venda é CLIENTE ou LEAD", () => {
    expect(ehConversaDeVenda("CLIENTE")).toBe(true);
    expect(ehConversaDeVenda("LEAD")).toBe(true);
    expect(ehConversaDeVenda("OUTRO")).toBe(false);
    expect(ehConversaDeVenda("GRUPO")).toBe(false);
    expect(ehConversaDeVenda(null)).toBe(false);
  });
  it("vale a aberta, e a encerrada mexida no período; não vale a antiga nem a criada depois", () => {
    expect(negociacaoValeNoPeriodo(neg({}), inicio, fim)).toBe(true);
    expect(negociacaoValeNoPeriodo(neg({ status: "ganha" }), inicio, fim)).toBe(false);
    expect(negociacaoValeNoPeriodo(neg({ status: "perdida", atualizadoEm: new Date(Date.UTC(2026, 8, 1)) }), inicio, fim)).toBe(true);
    expect(negociacaoValeNoPeriodo(neg({ negociacaoAntiga: true }), inicio, fim)).toBe(false);
    expect(negociacaoValeNoPeriodo(neg({ criadoEm: new Date(Date.UTC(2026, 9, 5)) }), inicio, fim)).toBe(false);
  });
});

describe("critérios para seguir", () => {
  const agora = new Date(Date.UTC(2026, 8, 27, 15));
  const dias = (n: number) => new Date(agora.getTime() - n * 86_400_000);
  it("esfriando: aberta, 10+ dias sem contato; sem contato registrado usa a última mexida", () => {
    expect(estaEsfriando({ status: "aberta", ultimoContato: dias(10), atualizadoEm: dias(1) }, agora)).toBe(true);
    expect(estaEsfriando({ status: "aberta", ultimoContato: dias(9), atualizadoEm: dias(30) }, agora)).toBe(false);
    expect(estaEsfriando({ status: "aberta", ultimoContato: null, atualizadoEm: dias(12) }, agora)).toBe(true);
    expect(estaEsfriando({ status: "ganha", ultimoContato: dias(40), atualizadoEm: dias(40) }, agora)).toBe(false);
  });
  it("histórico anotado: lixo vira vazio, guarda no máximo 400 dias", () => {
    expect(lerHistoricoEsfriando(null)).toEqual({});
    expect(lerHistoricoEsfriando("não é json")).toEqual({});
    expect(lerHistoricoEsfriando("[1,2]")).toEqual({});
    expect(lerHistoricoEsfriando('{"2026-09-01":4,"ontem":3,"2026-09-02":-1,"2026-09-03":"5"}')).toEqual({ "2026-09-01": 4 });
    let h: Record<string, number> = {};
    for (let i = 0; i < 410; i++) h = anotarDia(h, new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString().slice(0, 10), i);
    expect(Object.keys(h)).toHaveLength(400);
    expect(h["2025-01-01"]).toBeUndefined();
    expect(primeiraAnotacaoDesde({ "2026-09-01": 8, "2026-09-10": 5 }, "2026-09-05")).toEqual({ dia: "2026-09-10", n: 5 });
    expect(primeiraAnotacaoDesde({ "2026-09-01": 8 }, "2026-09-05")).toBeNull();
  });
  it("critério 1: todas com motivo; sem perdida não há medida", () => {
    expect(criterioMotivos(0, 0)).toBe("sem_dado");
    expect(criterioMotivos(5, 0)).toBe("ok");
    expect(criterioMotivos(5, 1)).toBe("falta");
  });
  it("critério 2: caiu pelo menos pela metade", () => {
    expect(criterioEsfriando(null, 3)).toBe("sem_dado");
    expect(criterioEsfriando(10, 5)).toBe("ok");
    expect(criterioEsfriando(10, 6)).toBe("falta");
    expect(criterioEsfriando(0, 0)).toBe("ok");
    expect(criterioEsfriando(0, 1)).toBe("falta");
  });
  it("critério 3: a maioria é mais da metade", () => {
    expect(criterioConversas(0, 0)).toBe("sem_dado");
    expect(criterioConversas(10, 5)).toBe("falta");
    expect(criterioConversas(10, 6)).toBe("ok");
  });
  it("motivo da perda: vazio ou só a nota é não informado", () => {
    expect(chaveMotivoPerda(null)).toBe("nao_informado");
    expect(chaveMotivoPerda("")).toBe("nao_informado");
    expect(chaveMotivoPerda(": cliente sumiu")).toBe("nao_informado");
    expect(chaveMotivoPerda("preco: achou caro")).toBe("preco");
  });
  it("período: 30, 60 ou 90; qualquer outro vira 60", () => {
    expect(diasDoPiloto("30")).toBe(30);
    expect(diasDoPiloto("90")).toBe(90);
    expect(diasDoPiloto("45")).toBe(60);
    expect(diasDoPiloto(undefined)).toBe(60);
  });
});
