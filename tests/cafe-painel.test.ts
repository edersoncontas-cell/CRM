import { describe, expect, it } from "vitest";
import { lerJsonPainelDoCafe, numJson } from "@/lib/cafe-parsers";

// Formato real da API do app (api.coffee-panel.mitrix.online/api/home/information),
// visto pela sonda em 14/09/2026.
const JSON_API = {
  messages: [{ id: 1, text: "Quem olha apenas o fechamento vê o placar." }],
  stocks: [
    { id: 3, name: "DÓLAR", symbol: "USD", change: 0.43, last_update: "2026-09-14 17:59:00", price: 5.15, movement: "up", type: "currency" },
    { id: 2, name: "LONDRES", symbol: "RC", change: 0.14, last_update: "2026-09-14 16:29:00", price: 3513, movement: "up", type: "coffee", market_strip: "Jan27" },
    { id: 1, name: "N.YORK", symbol: "KC", change: 1.24, last_update: "2026-09-14 17:29:00", price: 289.25, movement: "up", type: "coffee", market_strip: "Dec26" },
  ],
  values: [
    { name: "Conilon 7/8", value: 980.7777330460192 },
    { name: "Arábica RIO", value: 1211.5908675500002 },
  ],
};

describe("Painel do Café (API)", () => {
  it("lê conilon 7/8, arábica rio, dólar, Londres e NY", () => {
    const r = lerJsonPainelDoCafe(JSON_API)!;
    expect(r).not.toBeNull();
    expect(r.conilon).toBeCloseTo(980.78, 2);
    expect(r.arabica).toBeCloseTo(1211.59, 2);
    expect(r.dolar).toBe(5.15);
    expect(r.londres).toBe(3513);
    expect(r.novaYork).toBe(289.25);
    expect(r.dataReferencia).toBe("14/09/2026");
    expect(r.fonte).toBe("Painel do Café");
  });
  it("ignora JSON sem os indicadores", () => {
    expect(lerJsonPainelDoCafe({ messages: [] })).toBeNull();
    expect(lerJsonPainelDoCafe(null)).toBeNull();
  });
  it("numJson aceita formatos brasileiro e americano", () => {
    expect(numJson("980,78")).toBe(980.78);
    expect(numJson("1.211,59")).toBe(1211.59);
    expect(numJson("1211.59")).toBe(1211.59);
    expect(numJson(3513)).toBe(3513);
    expect(numJson("")).toBeNull();
  });
});
