// A instância "crm" travou de um jeito que a Evolution não deixa nem sair nem
// apagar (prints de 01 e 02/10). O CRM cria "crm-2" e guarda no banco qual
// vale. Estas são as regras de qual nome vale — o padrão tem que ser sempre a
// variável da Vercel quando o que está guardado é estranho.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  lerInstanciaGuardada, instanciaQueVale, proximoNomeInstancia, nomeInstanciaValido, instanciaQueVemNaVolta,
} from "@/lib/whatsapp-instancia-nome";

describe("qual instância da Evolution vale", () => {
  it("nada guardado: vale a variável", () => {
    expect(instanciaQueVale("crm", lerInstanciaGuardada(null))).toBe("crm");
    expect(instanciaQueVale("crm", lerInstanciaGuardada(""))).toBe("crm");
  });

  it("guardado a partir da mesma variável: vale a guardada", () => {
    const g = lerInstanciaGuardada(JSON.stringify({ base: "crm", nome: "crm-2", anterior: "crm", desde: "2026-10-02T12:00:00Z" }));
    expect(g).toEqual({ base: "crm", nome: "crm-2", anterior: "crm", desde: "2026-10-02T12:00:00Z" });
    expect(instanciaQueVale("crm", g)).toBe("crm-2");
  });

  it("ele trocou EVOLUTION_INSTANCE na Vercel depois: vale a variável nova, não a troca antiga", () => {
    const g = lerInstanciaGuardada(JSON.stringify({ base: "crm", nome: "crm-2" }));
    expect(instanciaQueVale("vendas", g)).toBe("vendas");
  });

  it("valor estranho no banco: ignora e vale a variável (nunca um caminho quebrado)", () => {
    for (const v of ["{", "null", "[]", "42", JSON.stringify({ base: "crm" }), JSON.stringify({ base: "crm", nome: "../../x" }), JSON.stringify({ base: "crm", nome: "a b" }), JSON.stringify({ base: "crm", nome: "" })]) {
      expect(instanciaQueVale("crm", lerInstanciaGuardada(v))).toBe("crm");
    }
  });

  it("'anterior' estranho não derruba o resto", () => {
    const g = lerInstanciaGuardada(JSON.stringify({ base: "crm", nome: "crm-3", anterior: "x/y" }));
    expect(g?.nome).toBe("crm-3");
    expect(g?.anterior).toBeUndefined();
  });
});

describe("volta do banco provisório", () => {
  const g = (nome: string, desde?: string) => JSON.stringify({ base: "crm", nome, anterior: "crm", desde });
  it("só o provisório trocou: vem", () => {
    expect(instanciaQueVemNaVolta(null, g("crm-2", "2026-10-02T10:00:00Z"))).toBe(g("crm-2", "2026-10-02T10:00:00Z"));
  });
  it("os dois trocaram: vale a troca mais nova", () => {
    expect(instanciaQueVemNaVolta(g("crm-2", "2026-10-01T10:00:00Z"), g("crm-3", "2026-10-02T10:00:00Z"))).toBe(g("crm-3", "2026-10-02T10:00:00Z"));
    expect(instanciaQueVemNaVolta(g("crm-3", "2026-10-02T10:00:00Z"), g("crm-2", "2026-10-01T10:00:00Z"))).toBeNull();
  });
  it("provisório sem troca ou com valor estranho: o principal continua", () => {
    expect(instanciaQueVemNaVolta(g("crm-2", "2026-10-01T10:00:00Z"), null)).toBeNull();
    expect(instanciaQueVemNaVolta(g("crm-2", "2026-10-01T10:00:00Z"), "{")).toBeNull();
  });
  it("a etapa de configurações usa a regra (não só 'o principal não tem')", () => {
    expect(readFileSync("src/lib/trazer-provisorio.ts", "utf8")).toMatch(/instanciaQueVemNaVolta\(/);
  });
});

describe("próximo nome", () => {
  it("crm → crm-2 → crm-3 …", () => {
    expect(proximoNomeInstancia("crm", "crm")).toBe("crm-2");
    expect(proximoNomeInstancia("crm", "crm-2")).toBe("crm-3");
    expect(proximoNomeInstancia("crm", "crm-9")).toBe("crm-10");
  });

  it("variável que já termina em número não vira contador", () => {
    expect(proximoNomeInstancia("crm-1", "crm-1")).toBe("crm-1-2");
    expect(proximoNomeInstancia("crm-1", "crm-1-2")).toBe("crm-1-3");
  });

  it("nome que não veio desta variável: recomeça em base-2", () => {
    expect(proximoNomeInstancia("crm", "outra-5")).toBe("crm-2");
  });

  it("o nome novo sempre é aceito pela Evolution e cabe na URL", () => {
    let n = "crm";
    for (let i = 0; i < 30; i++) { n = proximoNomeInstancia("crm", n); expect(nomeInstanciaValido(n)).toBe(true); }
    expect(n).toBe("crm-31");
  });
});

describe("todo caminho que fala com a Evolution usa a instância que vale", () => {
  const zapi = readFileSync("src/lib/zapi.ts", "utf8");
  const webhook = readFileSync("src/app/api/webhooks/evolution/route.ts", "utf8");

  it("nenhum caminho monta a URL com o nome da variável direto", () => {
    // evoInstancia() devolve a marca que evoFetch troca pela instância ativa.
    expect(zapi).not.toMatch(/encodeURIComponent\(evolutionConfig\(\)\?\.instance/);
    expect(zapi).not.toMatch(/`\/[a-zA-Z]+\/[a-zA-Z]+\/\$\{cfg\.instance\}/);
  });

  it("o webhook confere a instância pela que vale (e relê o banco antes de recusar)", () => {
    expect(webhook).not.toMatch(/instancia !== cfg\.instance/);
    expect(webhook).toMatch(/nomeDaInstancia\(\{ forcar: true \}\)/);
  });

  it("status, QR e diagnóstico releem o banco (outra cópia do servidor pode ter trocado)", () => {
    const forcados = zapi.match(/nomeDaInstancia\(\{ forcar: true \}\)/g) ?? [];
    expect(forcados.length).toBeGreaterThanOrEqual(5);
  });
});
