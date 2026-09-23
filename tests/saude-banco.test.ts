// A sonda que diz se o banco está de pé — e por que não está.
//
// Ela existe porque "Algo deu errado nesta página" custou um dia inteiro de
// vendedor parado: o Next esconde a mensagem do servidor em produção, e sem
// a mensagem sobra adivinhar. O que se prova aqui é que a sonda NUNCA estoura
// (se ela mesma quebrasse, voltaríamos ao silêncio) e que ela separa os dois
// casos que exigem ações diferentes: banco fora × banco só-leitura.

import { describe, it, expect, vi } from "vitest";

// Um objeto simples no lugar de vi.fn(): o espião guarda a promessa rejeitada
// que ele mesmo devolveu e o vitest a acusa como rejeição sem dono, mesmo com
// a sonda tratando o erro direitinho. Aqui o que interessa é o comportamento
// da sonda, não quem chamou quem.
const banco = vi.hoisted(() => ({ responder: async (): Promise<unknown> => [] }));
vi.mock("@/lib/db", () => ({ db: { $queryRawUnsafe: () => banco.responder() } }));

const { conferirBanco } = await import("@/lib/saude-banco");

describe("sonda do banco", () => {
  it("banco normal: passa direto e o CRM abre", async () => {
    banco.responder = async () => [{ ro: "off", tamanho: "42 MB" }];
    expect(await conferirBanco()).toEqual({ ok: true });
  });

  // O caso que eu não conseguia confirmar sem sonda: o Neon põe o banco em só
  // leitura quando a cota estoura. Ele RESPONDE — então um "SELECT 1" passa —
  // e mesmo assim o CRM inteiro cai, com qualquer versão do código.
  it("só leitura: acusa, e não deixa passar como se estivesse bom", async () => {
    banco.responder = async () => [{ ro: "on", tamanho: "512 MB" }];
    const r = await conferirBanco();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.somenteLeitura).toBe(true);
    expect(r.titulo).toMatch(/SÓ LEITURA/i);
    expect(r.motivo).toContain("512 MB");
  });

  it("banco fora: devolve o motivo por extenso, que é o que faltava na tela", async () => {
    banco.responder = async () => { throw new Error("Can't reach database server at `ep-xyz.neon.tech`"); };
    const r = await conferirBanco();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.somenteLeitura).toBe(false);
    expect(r.motivo).toContain("Can't reach database server");
  });

  it("a sonda nunca estoura — nem com resposta estranha", async () => {
    banco.responder = async () => [];
    await expect(conferirBanco()).resolves.toBeDefined();
    banco.responder = async () => null;
    await expect(conferirBanco()).resolves.toBeDefined();
    banco.responder = async () => { throw "erro que nem é Error"; };
    await expect(conferirBanco()).resolves.toBeDefined();
  });

  it("a mensagem sai numa linha só e cortada — ela é lida no celular", async () => {
    banco.responder = async () => { throw new Error("linha um\n\n   linha dois\t" + "x".repeat(900)); };
    const r = await conferirBanco();
    if (r.ok) throw new Error("devia ter falhado");
    expect(r.motivo).not.toContain("\n");
    expect(r.motivo.length).toBeLessThanOrEqual(400);
  });
});
