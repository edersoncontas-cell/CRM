import { describe, it, expect } from "vitest";
import {
  pontuarPrioridade, ordenarPorPrioridade, aplicarFiltro, leituraDesatualizada, idadeDaLeitura,
  type ItemOrientador,
} from "@/lib/orientador-prioridade";

const AGORA = new Date("2026-09-19T12:00:00Z").getTime();
const horasAtras = (h: number) => new Date(AGORA - h * 3_600_000).toISOString();

const item = (p: Partial<ItemOrientador>): ItemOrientador => ({
  clienteId: "c1",
  temperatura: "morna",
  probabilidadeFechamento: 50,
  ultimaMensagemEm: horasAtras(2),
  ultimaFoiDoCliente: false,
  atualizadoEm: horasAtras(1),
  ...p,
});

describe("ordem de atacar", () => {
  it("cliente quente esperando resposta vem antes de conversa fria de hoje", () => {
    const quente = item({ clienteId: "quente", temperatura: "muito_quente", probabilidadeFechamento: 80, ultimaFoiDoCliente: true, ultimaMensagemEm: horasAtras(20) });
    const frio = item({ clienteId: "frio", temperatura: "fria", probabilidadeFechamento: 10, ultimaMensagemEm: horasAtras(1) });
    expect(pontuarPrioridade(quente, AGORA)).toBeGreaterThan(pontuarPrioridade(frio, AGORA));
    expect(ordenarPorPrioridade([frio, quente], AGORA)[0].clienteId).toBe("quente");
  });

  it("quem está esperando há mais tempo sobe", () => {
    const antigo = item({ clienteId: "antigo", ultimaFoiDoCliente: true, ultimaMensagemEm: horasAtras(24) });
    const recente = item({ clienteId: "recente", ultimaFoiDoCliente: true, ultimaMensagemEm: horasAtras(1) });
    expect(pontuarPrioridade(antigo, AGORA)).toBeGreaterThan(pontuarPrioridade(recente, AGORA));
  });

  it("alerta vermelho do coaching puxa o card para cima", () => {
    const comAlerta = item({ clienteId: "alerta", alertaNivel: "vermelho" });
    const sem = item({ clienteId: "sem" });
    expect(pontuarPrioridade(comAlerta, AGORA)).toBeGreaterThan(pontuarPrioridade(sem, AGORA));
  });

  it("a nota nunca passa de 100", () => {
    const tudo = item({ temperatura: "muito_quente", probabilidadeFechamento: 100, ultimaFoiDoCliente: true, ultimaMensagemEm: horasAtras(200), alertaNivel: "vermelho", atualizadoEm: null });
    expect(pontuarPrioridade(tudo, AGORA)).toBeLessThanOrEqual(100);
  });
});

describe("filtros", () => {
  const lista = [
    item({ clienteId: "a", temperatura: "quente" }),
    item({ clienteId: "b", temperatura: "fria", ultimaFoiDoCliente: true }),
    item({ clienteId: "c", atualizadoEm: null }),
  ];

  it("quentes", () => expect(aplicarFiltro(lista, "quentes").map((i) => i.clienteId)).toEqual(["a"]));
  it("esperando você", () => expect(aplicarFiltro(lista, "esperando").map((i) => i.clienteId)).toEqual(["b"]));
  it("sem leitura", () => expect(aplicarFiltro(lista, "sem_leitura").map((i) => i.clienteId)).toContain("c"));
  it("todos devolve tudo", () => expect(aplicarFiltro(lista, "todos")).toHaveLength(3));
});

describe("idade da leitura", () => {
  it("conversa que andou depois da leitura fica desatualizada", () => {
    expect(leituraDesatualizada(item({ atualizadoEm: horasAtras(5), ultimaMensagemEm: horasAtras(1) }))).toBe(true);
    expect(leituraDesatualizada(item({ atualizadoEm: horasAtras(1), ultimaMensagemEm: horasAtras(5) }))).toBe(false);
  });

  it("escreve o tempo em português de gente", () => {
    expect(idadeDaLeitura(null)).toBe("sem leitura da IA");
    expect(idadeDaLeitura(horasAtras(0.2), AGORA)).toBe("lido agora");
    expect(idadeDaLeitura(horasAtras(3), AGORA)).toBe("lido há 3h");
    expect(idadeDaLeitura(horasAtras(50), AGORA)).toBe("lido há 2 dias");
  });
});
