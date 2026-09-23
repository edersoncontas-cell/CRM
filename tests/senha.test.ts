import { describe, it, expect } from "vitest";
import { hashSenha, conferirSenha } from "@/lib/senha";

describe("senha guardada", () => {
  it("confere a senha certa", async () => {
    const h = await hashSenha("minha-senha-boa");
    expect(await conferirSenha("minha-senha-boa", h)).toBe(true);
  });

  it("recusa a errada", async () => {
    const h = await hashSenha("minha-senha-boa");
    expect(await conferirSenha("minha-senha-ruim", h)).toBe(false);
    expect(await conferirSenha("", h)).toBe(false);
    expect(await conferirSenha("Minha-Senha-Boa", h)).toBe(false); // caixa importa
  });

  it("nunca guarda a senha em texto puro", async () => {
    const h = await hashSenha("retroescavadeira");
    expect(h).not.toContain("retroescavadeira");
    expect(h.startsWith("pbkdf2$")).toBe(true);
  });

  it("duas pessoas com a MESMA senha têm hash diferente (sal por senha)", async () => {
    expect(await hashSenha("igual")).not.toBe(await hashSenha("igual"));
  });

  it("hash estragado ou vazio recusa, sem levantar erro", async () => {
    for (const ruim of ["", "qualquer-coisa", "pbkdf2$", "pbkdf2$1$2", "md5$1$a$b", "sem-senha-definida"]) {
      expect(await conferirSenha("qualquer", ruim), `hash ${JSON.stringify(ruim)}`).toBe(false);
    }
  });
});
