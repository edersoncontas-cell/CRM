import { describe, it, expect } from "vitest";
import { dataIsoBrasilia, inicioDoDiaBrasilia, diaSemanaBrasilia, horaBrasilia, deveDescartarContato, semCodigoPais, iniciais } from "@/lib/utils";
import { calcularFinanciamento, calcularConsorcio, anualParaMensal } from "@/lib/finance";
import { phoneLookupVariants, isGroupChatId, buildConvMatch, isAllowedInstance } from "@/lib/whatsapp-routing";

describe("fuso de Brasília (servidor em UTC)", () => {
  it("23h em Brasília ainda é o mesmo dia, mesmo sendo 02h UTC do dia seguinte", () => {
    const d = new Date("2026-09-15T02:30:00Z"); // 14/09 23:30 em Brasília
    expect(dataIsoBrasilia(d)).toBe("2026-09-14");
    expect(horaBrasilia(d)).toBe(23);
    expect(diaSemanaBrasilia(d)).toBe(1); // segunda
  });
  it("início do dia e deslocamento", () => {
    const d = new Date("2026-09-15T02:30:00Z");
    expect(inicioDoDiaBrasilia(d).toISOString()).toBe("2026-09-14T03:00:00.000Z");
    expect(inicioDoDiaBrasilia(d, 1).toISOString()).toBe("2026-09-15T03:00:00.000Z");
    expect(inicioDoDiaBrasilia(d, -7).toISOString()).toBe("2026-09-07T03:00:00.000Z");
  });
});

describe("helpers de contato", () => {
  it("descarta nomes de fachada", () => {
    expect(deveDescartarContato("Pousada do Sol")).toBe(true);
    expect(deveDescartarContato("Construtora Litoral")).toBe(false);
  });
  it("remove DDI e monta iniciais", () => {
    expect(semCodigoPais("5528999991234")).toBe("28999991234");
    expect(semCodigoPais("28999991234")).toBe("28999991234");
    expect(iniciais("Carlos Alberto Souza")).toBe("CA");
  });
});

describe("financeiro", () => {
  it("Price: parcela e juros", () => {
    const r = calcularFinanciamento(500_000, 100_000, 1, 48);
    expect(r.valorFinanciado).toBe(400_000);
    expect(r.parcela).toBeCloseTo(10_534.0, 0);
    expect(r.totalJuros).toBeGreaterThan(0);
    expect(calcularFinanciamento(120_000, 0, 0, 12).parcela).toBe(10_000);
  });
  it("consórcio e conversão de taxa", () => {
    const c = calcularConsorcio(300_000, 60, 15, 2);
    expect(c.taxaTotal).toBeCloseTo(51_000, 5);
    expect(c.parcela).toBeCloseTo(5_850, 5);
    expect(anualParaMensal(12.68)).toBeCloseTo(1, 1);
  });
});

describe("roteamento de WhatsApp", () => {
  it("variantes com/sem 9 e com/sem DDI", () => {
    const v = phoneLookupVariants("5528999991234");
    expect(v).toEqual(expect.arrayContaining(["28999991234", "5528999991234", "2899991234", "552899991234"]));
    expect(phoneLookupVariants("2899991234")).toEqual(expect.arrayContaining(["28999991234"]));
    expect(phoneLookupVariants("")).toEqual([]);
  });
  it("grupos casam só pelo id", () => {
    expect(isGroupChatId("120363000000000000@g.us")).toBe(true);
    expect(buildConvMatch({ phone: "120363000000000000@g.us", isGroup: true })).toEqual({ externalPhone: "120363000000000000@g.us" });
    const m = buildConvMatch({ phone: "28999991234", lid: "abc@lid", isGroup: false }) as { OR: unknown[] };
    expect(m.OR).toHaveLength(2);
  });
  it("instância", () => {
    expect(isAllowedInstance("a", null)).toBe(true);
    expect(isAllowedInstance("a", "a")).toBe(true);
    expect(isAllowedInstance("b", "a")).toBe(false);
  });
});
