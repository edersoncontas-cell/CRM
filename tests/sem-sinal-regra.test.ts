import { describe, it, expect } from "vitest";
import {
  validarOperacao, lerValorBR, dataDaVisita, diaBrasilia, horaBrasilia, rotuloDia, aplicarPendentes, agruparVisitas,
  buscarClientes, colunasParaNovaNegociacao, negociacoesPorColuna, aplicarResultados, proximoLote, registrosParaApagar,
  resumoDaRodada, pacoteVelho, novoRegistro, novoId, ID_VALIDO, TENTATIVAS_ANTES_DE_ERRO, contarFila,
  type PacoteSemSinal, type RegistroFila, type OpAgendarVisita, type OpConcluirVisita, type OpCriarNegociacao,
} from "@/lib/sem-sinal-regra";

const ID = (n: number) => `id-teste-${String(n).padStart(4, "0")}`;

function pacote(extra: Partial<PacoteSemSinal> = {}): PacoteSemSinal {
  return {
    versao: 1,
    geradoEm: "2026-09-27T12:00:00.000Z",
    visitas: [
      { id: ID(1), clienteId: ID(10), clienteNome: "João Terraplenagem", telefone: "28999990000", data: "2026-09-27T12:00:00.000Z", status: "agendada", cidade: "Cachoeiro", observacao: null },
    ],
    clientes: [
      { id: ID(10), nome: "João Terraplenagem", telefone: "28999990000", municipio: "Cachoeiro de Itapemirim" },
      { id: ID(11), nome: "Construtora Muniz", telefone: "27988887777", municipio: "Vitória" },
    ],
    totalClientes: 2,
    negociacoes: [],
    colunas: [
      { titulo: "Primeiro contato", papel: "em_negociacao", ordem: 0 },
      { titulo: "Proposta no BCNH", papel: "banco", ordem: 1 },
      { titulo: "Vendas Confirmadas", papel: "confirmada", ordem: 2 },
      { titulo: "FATURADO", papel: "faturado", ordem: 3 },
      { titulo: "Venda perdida", papel: "perdida", ordem: 4 },
    ],
    municipios: ["Cachoeiro de Itapemirim", "Vitória"],
    maquinas: [{ marca: "New Holland", modelo: "B95B" }],
    ...extra,
  };
}

function agendar(n: number, extra: Partial<OpAgendarVisita> = {}): OpAgendarVisita {
  return {
    tipo: "visita.agendar", id: ID(100 + n), criadaEm: `2026-09-27T13:0${n}:00.000Z`, clienteNome: "João Terraplenagem",
    visitaId: ID(200 + n), clienteId: ID(10), data: "2026-09-29", horario: "09:30", cidade: null, observacao: "levar catálogo", ...extra,
  };
}

describe("validarOperacao — o servidor não confia no aparelho", () => {
  it("aceita um agendamento completo e limpa os textos", () => {
    const r = validarOperacao({ ...agendar(1), cidade: "  Alegre  ", observacao: "   " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.op.tipo).toBe("visita.agendar");
    if (r.op.tipo !== "visita.agendar") return;
    expect(r.op.cidade).toBe("Alegre");
    expect(r.op.observacao).toBeNull();
  });

  it("recusa id fora do formato, data inválida e tipo desconhecido", () => {
    expect(validarOperacao({ ...agendar(1), id: "" }).ok).toBe(false);
    expect(validarOperacao({ ...agendar(1), id: "a".repeat(65) }).ok).toBe(false);
    expect(validarOperacao({ ...agendar(1), visitaId: "../../etc" }).ok).toBe(false);
    expect(validarOperacao({ ...agendar(1), data: "29/09/2026" }).ok).toBe(false);
    expect(validarOperacao({ ...agendar(1), tipo: "cliente.apagar" }).ok).toBe(false);
    expect(validarOperacao(null).ok).toBe(false);
  });

  it("id curto de cadastro antigo vale (o banco não tem só cuid)", () => {
    expect(validarOperacao({ ...agendar(1), visitaId: "vt1", clienteId: "seed20" }).ok).toBe(true);
  });

  it("horário estranho vira sem horário (meio-dia), não erro", () => {
    const r = validarOperacao({ ...agendar(1), horario: "9h" });
    expect(r.ok && r.op.tipo === "visita.agendar" && r.op.horario).toBe(null);
  });

  it("cliente novo: telefone que não é telefone é recusado; vazio vale", () => {
    const ruim = validarOperacao({ ...agendar(1), novoCliente: { nome: "Pedro", telefone: "123" } });
    expect(ruim.ok).toBe(false);
    const semTel = validarOperacao({ ...agendar(1), novoCliente: { nome: "Pedro", telefone: "" } });
    expect(semTel.ok && semTel.op.tipo === "visita.agendar" && semTel.op.novoCliente).toEqual({ nome: "Pedro", telefone: null });
    const semNome = validarOperacao({ ...agendar(1), novoCliente: { nome: " ", telefone: "" } });
    expect(semNome.ok).toBe(false);
  });

  it("negociação: valor tem de ser número finito; coluna é obrigatória", () => {
    const base: OpCriarNegociacao = {
      tipo: "negociacao.criar", id: ID(1), criadaEm: "2026-09-27T13:00:00Z", clienteNome: "X", negociacaoId: ID(2), clienteId: ID(3),
      marca: "New Holland", maquinaModelo: "B95B", valor: 450000, estagio: "Primeiro contato", proximaAcao: null,
    };
    expect(validarOperacao(base).ok).toBe(true);
    expect(validarOperacao({ ...base, valor: Number.NaN }).ok).toBe(false);
    expect(validarOperacao({ ...base, valor: "450000" }).ok).toBe(false);
    expect(validarOperacao({ ...base, valor: null }).ok).toBe(true);
    expect(validarOperacao({ ...base, estagio: "" }).ok).toBe(false);
  });

  it("concluir exige dizer se aconteceu", () => {
    const base = { tipo: "visita.concluir", id: ID(1), criadaEm: "2026-09-27T13:00:00Z", clienteNome: "X", visitaId: ID(2), relato: "ok" };
    expect(validarOperacao({ ...base, feita: true }).ok).toBe(true);
    expect(validarOperacao({ ...base, feita: "sim" }).ok).toBe(false);
  });
});

describe("lerValorBR", () => {
  it("entende o jeito brasileiro de escrever dinheiro", () => {
    expect(lerValorBR("R$ 1.250.000,00")).toBe(1_250_000);
    expect(lerValorBR("450 mil")).toBe(450_000);
    expect(lerValorBR("1.250")).toBe(1250);
    expect(lerValorBR("1250.5")).toBe(1250.5);
    expect(lerValorBR("12,5")).toBe(12.5);
    expect(lerValorBR("")).toBeNull();
    expect(lerValorBR("abc")).toBe("invalido");
    expect(lerValorBR("R$")).toBe("invalido");
  });
});

describe("datas em Brasília", () => {
  it("visita sem horário cai ao meio-dia de Brasília; com horário, na hora certa", () => {
    expect(dataDaVisita("2026-10-01", null).toISOString()).toBe("2026-10-01T15:00:00.000Z");
    expect(dataDaVisita("2026-10-01", "09:00").toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });
  it("23h de Brasília ainda é o mesmo dia", () => {
    expect(diaBrasilia("2026-10-02T02:00:00Z")).toBe("2026-10-01");
    expect(horaBrasilia("2026-10-02T02:00:00Z")).toBe("23:00");
  });
  it("rótulos de dia", () => {
    expect(rotuloDia("2026-09-27", "2026-09-27")).toBe("Hoje");
    expect(rotuloDia("2026-09-28", "2026-09-27")).toBe("Amanhã");
    expect(rotuloDia("2026-09-26", "2026-09-27")).toBe("Ontem");
    expect(rotuloDia("2026-10-01", "2026-09-27")).toBe("qui 01/10");
  });
});

describe("aplicarPendentes — o que ele fez sem sinal aparece na hora", () => {
  it("visita agendada para cliente novo cria o cliente e a visita, marcados como pendentes", () => {
    const op = agendar(1, { clienteId: ID(50), clienteNome: "Pedro Areia", novoCliente: { nome: "Pedro Areia", telefone: "28999112233" } });
    const p = pacote();
    const v = aplicarPendentes(p, [novoRegistro(op)]);
    expect(v.clientes.find((c) => c.id === ID(50))).toMatchObject({ nome: "Pedro Areia", sync: "pendente" });
    expect(v.visitas.find((x) => x.id === ID(201))).toMatchObject({ clienteNome: "Pedro Areia", status: "agendada", sync: "pendente", data: "2026-09-29T12:30:00.000Z" });
    // não mexe no pacote guardado
    expect(p.visitas).toHaveLength(1);
    expect(p.clientes).toHaveLength(2);
  });

  it("concluir muda a visita que já estava no pacote", () => {
    const op: OpConcluirVisita = { tipo: "visita.concluir", id: ID(300), criadaEm: "2026-09-27T14:00:00Z", clienteNome: "João", visitaId: ID(1), feita: false, relato: "cliente viajou" };
    const v = aplicarPendentes(pacote(), [novoRegistro(op)]);
    expect(v.visitas[0]).toMatchObject({ status: "nao_realizada", relatoPendente: "cliente viajou", sync: "pendente" });
  });

  it("agendar e concluir a MESMA visita sem sinal: a ordem é respeitada", () => {
    const a = agendar(1);
    const c: OpConcluirVisita = { tipo: "visita.concluir", id: ID(301), criadaEm: "2026-09-27T15:00:00Z", clienteNome: "João", visitaId: a.visitaId, feita: true, relato: "" };
    // fila fora de ordem de propósito
    const v = aplicarPendentes(pacote(), [novoRegistro(c), novoRegistro(a)]);
    expect(v.visitas.find((x) => x.id === a.visitaId)?.status).toBe("realizada");
  });

  it("enviado que o pacote já contém não duplica; enviado mais novo que o pacote continua aparecendo", () => {
    const op = agendar(1);
    const antigo: RegistroFila = { ...novoRegistro(op), estado: "enviado", enviadoEm: "2026-09-27T11:00:00.000Z" };
    const naoDuplica = aplicarPendentes(pacote(), [antigo]);
    expect(naoDuplica.visitas.filter((x) => x.id === op.visitaId)).toHaveLength(0);

    const recente: RegistroFila = { ...novoRegistro(op), estado: "enviado", enviadoEm: "2026-09-27T12:30:00.000Z" };
    const aparece = aplicarPendentes(pacote(), [recente]);
    expect(aparece.visitas.find((x) => x.id === op.visitaId)).toMatchObject({ sync: null });
  });

  it("recusado pelo servidor aparece marcado como erro", () => {
    const op = agendar(1);
    const v = aplicarPendentes(pacote(), [{ ...novoRegistro(op), estado: "erro", erro: "x" }]);
    expect(v.visitas.find((x) => x.id === op.visitaId)?.sync).toBe("erro");
  });

  it("negociação nova entra no topo, com o nome do cliente do pacote", () => {
    const op: OpCriarNegociacao = {
      tipo: "negociacao.criar", id: ID(400), criadaEm: "2026-09-27T13:00:00Z", clienteNome: "?", negociacaoId: ID(401), clienteId: ID(11),
      marca: "Dynapac", maquinaModelo: "CA25", valor: 380000, estagio: "Primeiro contato", proximaAcao: "mandar proposta",
    };
    const v = aplicarPendentes(pacote(), [novoRegistro(op)]);
    expect(v.negociacoes[0]).toMatchObject({ id: ID(401), clienteNome: "Construtora Muniz", sync: "pendente" });
  });
});

describe("agruparVisitas", () => {
  it("separa sem resposta, hoje/próximas e anteriores", () => {
    const base = pacote().visitas[0];
    const vis = [
      { ...base, id: "a", data: "2026-09-25T12:00:00Z", status: "agendada" },
      { ...base, id: "b", data: "2026-09-24T12:00:00Z", status: "realizada" },
      { ...base, id: "c", data: "2026-09-27T12:00:00Z", status: "agendada" },
      { ...base, id: "d", data: "2026-09-28T02:30:00Z", status: "agendada" }, // 23:30 do dia 27 em Brasília
      { ...base, id: "e", data: "2026-10-01T12:00:00Z", status: "agendada" },
    ].map((v) => ({ ...v, sync: null, relatoPendente: null }));
    const g = agruparVisitas(vis, "2026-09-27");
    expect(g.semResposta.map((v) => v.id)).toEqual(["a"]);
    expect(g.anteriores.map((v) => v.id)).toEqual(["b"]);
    expect(g.proximas.map((x) => [x.rotulo, x.visitas.map((v) => v.id)])).toEqual([["Hoje", ["c", "d"]], ["qui 01/10", ["e"]]]);
  });
});

describe("buscarClientes", () => {
  const clientes = pacote().clientes;
  it("sem acento, por pedaço do nome, pela cidade e pelo telefone", () => {
    expect(buscarClientes(clientes, "joao").itens.map((c) => c.nome)).toEqual(["João Terraplenagem"]);
    expect(buscarClientes(clientes, "vitoria").itens.map((c) => c.nome)).toEqual(["Construtora Muniz"]);
    expect(buscarClientes(clientes, "8888-7777").itens.map((c) => c.nome)).toEqual(["Construtora Muniz"]);
    expect(buscarClientes(clientes, "").total).toBe(0);
  });
  it("respeita o limite e conta o total", () => {
    const muitos = Array.from({ length: 60 }, (_, i) => ({ nome: `Cliente ${i}`, telefone: null, municipio: null }));
    const r = buscarClientes(muitos, "cliente", 40);
    expect(r.itens).toHaveLength(40);
    expect(r.total).toBe(60);
  });
});

describe("funil", () => {
  it("negociação nova só nasce em coluna aberta (nem faturado, nem perdida)", () => {
    expect(colunasParaNovaNegociacao(pacote().colunas).map((c) => c.titulo)).toEqual(["Primeiro contato", "Proposta no BCNH", "Vendas Confirmadas"]);
  });
  it("negociação de coluna que sumiu vai para 'Outras colunas' em vez de sumir", () => {
    const n = { id: "n", clienteId: "c", clienteNome: "X", marca: null, maquinaModelo: null, valor: 10, estagio: "Coluna antiga", proximaAcao: null, ultimoContato: null, sync: null };
    const g = negociacoesPorColuna([n, { ...n, id: "m", estagio: "Primeiro contato", valor: 5 }], pacote().colunas);
    expect(g.map((x) => [x.titulo, x.negociacoes.length, x.total])).toEqual([
      ["Primeiro contato", 1, 5], ["Proposta no BCNH", 0, 0], ["Vendas Confirmadas", 0, 0], ["Outras colunas", 1, 10],
    ]);
  });
});

describe("sincronia", () => {
  it("lote: só pendentes, na ordem em que ele fez, até o máximo", () => {
    const fila = [agendar(3), agendar(1), agendar(2)].map(novoRegistro);
    fila[0] = { ...fila[0], estado: "erro" };
    expect(proximoLote(fila, 5).map((r) => r.op.id)).toEqual([ID(101), ID(102)]);
    expect(proximoLote(fila, 1).map((r) => r.op.id)).toEqual([ID(101)]);
  });

  it("resposta: ok vira enviado com a hora do servidor; recusa vira erro; falha de passagem só conta tentativa", () => {
    const fila = [agendar(1), agendar(2), agendar(3)].map(novoRegistro);
    const mud = aplicarResultados(fila, {
      agora: "2026-09-27T16:00:00.000Z",
      resultados: [
        { id: ID(101), ok: true, aviso: "entrou em outra coluna" },
        { id: ID(102), ok: false, erro: "Cliente apagado." },
        { id: ID(103), ok: false, transitorio: true, erro: "banco lento" },
      ],
    });
    expect(mud.map((r) => [r.op.id, r.estado, r.enviadoEm, r.erro, r.tentativas, r.aviso])).toEqual([
      [ID(101), "enviado", "2026-09-27T16:00:00.000Z", null, 0, "entrou em outra coluna"],
      [ID(102), "erro", null, "Cliente apagado.", 1, null],
      [ID(103), "pendente", null, "banco lento", 1, null],
    ]);
  });

  it("adiada (a rodada parou antes dela) não conta tentativa nem muda nada", () => {
    const fila = [novoRegistro(agendar(1))];
    expect(aplicarResultados(fila, { agora: "x", resultados: [{ id: ID(101), ok: false, transitorio: true, adiada: true, erro: "Esperando a anterior subir." }] })).toEqual([]);
  });

  it(`depois de ${TENTATIVAS_ANTES_DE_ERRO} falhas de passagem seguidas, vira erro para ele ver`, () => {
    const r: RegistroFila = { ...novoRegistro(agendar(1)), tentativas: TENTATIVAS_ANTES_DE_ERRO - 1 };
    const [m] = aplicarResultados([r], { agora: "2026-09-27T16:00:00Z", resultados: [{ id: ID(101), ok: false, transitorio: true }] });
    expect(m.estado).toBe("erro");
  });

  it("enviado sai da fila só quando o pacote já o contém e passou de 2 dias", () => {
    const r: RegistroFila = { ...novoRegistro(agendar(1)), estado: "enviado", enviadoEm: "2026-09-20T10:00:00Z" };
    const novo: RegistroFila = { ...novoRegistro(agendar(2)), estado: "enviado", enviadoEm: "2026-09-27T11:00:00Z" };
    const pend = novoRegistro(agendar(3));
    const agora = Date.parse("2026-09-27T12:00:00Z");
    expect(registrosParaApagar([r, novo, pend], { geradoEm: "2026-09-27T12:00:00Z" }, agora)).toEqual([ID(101)]);
    expect(registrosParaApagar([r], { geradoEm: "2026-09-19T12:00:00Z" }, agora)).toEqual([]);
    expect(contarFila([r, novo, pend])).toEqual({ pendentes: 1, erros: 0, enviados: 2 });
  });

  it("pacote velho: nunca baixado, data estranha ou mais de 30 min", () => {
    const agora = Date.parse("2026-09-27T12:40:00Z");
    expect(pacoteVelho(null, agora)).toBe(true);
    expect(pacoteVelho({ geradoEm: "lixo" }, agora)).toBe(true);
    expect(pacoteVelho({ geradoEm: "2026-09-27T12:00:00Z" }, agora)).toBe(true);
    expect(pacoteVelho({ geradoEm: "2026-09-27T12:20:00Z" }, agora)).toBe(false);
  });

  it("resumo da rodada para a auditoria", () => {
    const c: OpConcluirVisita = { tipo: "visita.concluir", id: ID(9), criadaEm: "x", clienteNome: "J", visitaId: ID(1), feita: true, relato: "" };
    expect(resumoDaRodada([agendar(1), agendar(2), c])).toBe("Subiu do modo sem sinal: 2 visitas agendadas, 1 visita feita.");
  });

  it("id gerado no aparelho passa na validação do servidor", () => {
    for (let i = 0; i < 20; i++) expect(ID_VALIDO.test(novoId())).toBe(true);
  });
});
