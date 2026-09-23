// O ISOLAMENTO POR VENDEDOR.
//
// É o teste mais importante deste CRM. Se ele passar e o código estiver
// errado, um vendedor vê a carteira do outro — e ninguém descobre por erro
// nenhum, só pelo cliente errado aparecendo na tela.
//
// O que se prova aqui é o desenho: o filtro sai do CONTEXTO, não da consulta.
// Quem escrever uma consulta nova daqui a três meses, sem lembrar de nada
// disso, continua isolado.

import { describe, it, expect } from "vitest";
import { comUsuario, usuarioAtual, donoDoFiltro, semFiltro, type UsuarioAtual } from "@/lib/tenant";

const edy: UsuarioAtual = { id: "u-edy", nome: "Ederson", papel: "vendedor" };
const outro: UsuarioAtual = { id: "u-joao", nome: "João", papel: "vendedor" };
const chefe: UsuarioAtual = { id: "u-chefe", nome: "Gerente", papel: "gerente" };

describe("quem está usando agora", () => {
  it("fora de requisição não há ninguém — e o filtro não inventa dono", () => {
    expect(usuarioAtual()).toBeNull();
    expect(donoDoFiltro()).toBeNull();
  });

  it("vendedor logado filtra pelo id DELE", async () => {
    await comUsuario(edy, () => { expect(donoDoFiltro()).toBe("u-edy"); });
  });

  it("um vendedor nunca pega o id do outro", async () => {
    await comUsuario(edy, () => { expect(donoDoFiltro()).toBe("u-edy"); });
    await comUsuario(outro, () => { expect(donoDoFiltro()).toBe("u-joao"); });
  });

  it("gerente não filtra — vê tudo por decisão", async () => {
    await comUsuario(chefe, () => {
      expect(usuarioAtual()?.papel).toBe("gerente");
      expect(donoDoFiltro()).toBeNull();
    });
  });
});

describe("o contexto não vaza entre trabalhos", () => {
  it("sai do bloco e o usuário some", async () => {
    await comUsuario(edy, () => { expect(donoDoFiltro()).toBe("u-edy"); });
    expect(donoDoFiltro()).toBeNull();
  });

  it("aninhado, o de dentro manda e o de fora volta", async () => {
    await comUsuario(edy, async () => {
      expect(donoDoFiltro()).toBe("u-edy");
      await comUsuario(outro, () => { expect(donoDoFiltro()).toBe("u-joao"); });
      expect(donoDoFiltro()).toBe("u-edy");
    });
  });

  // O defeito que a prova contra o banco pegou, virado teste: a promessa do
  // Prisma é PREGUIÇOSA. Se comUsuario devolvesse a promessa em vez de dar
  // await nela aqui dentro, o await aconteceria fora do contexto e o filtro
  // sumiria — sem erro, só com a carteira do outro na tela.
  it("o await acontece DENTRO do contexto, mesmo com função preguiçosa", async () => {
    let dentro: string | null = "não rodou";
    // simula a promessa preguiçosa do Prisma: só lê o contexto quando alguém
    // dá await nela.
    const preguicosa = () => ({ then: (ok: (v: unknown) => void) => { dentro = donoDoFiltro(); ok(null); } });
    await comUsuario(edy, () => preguicosa() as unknown as Promise<unknown>);
    expect(dentro).toBe("u-edy");
  });

  it("dois trabalhos ao mesmo tempo não se misturam", async () => {
    // O caso que uma variável de módulo estragaria: dois vendedores online.
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const a = comUsuario(edy, async () => { await espera(20); return donoDoFiltro(); });
    const b = comUsuario(outro, async () => { await espera(5); return donoDoFiltro(); });
    expect(await Promise.all([a, b])).toEqual(["u-edy", "u-joao"]);
  });

  it("o contexto atravessa await", async () => {
    await comUsuario(edy, async () => {
      await new Promise((r) => setTimeout(r, 5));
      expect(donoDoFiltro()).toBe("u-edy");
    });
  });
});

describe("semFiltro", () => {
  it("libera a varredura mesmo com vendedor logado — para cron e manutenção", async () => {
    await comUsuario(edy, async () => {
      expect(donoDoFiltro()).toBe("u-edy");
      await semFiltro(() => { expect(donoDoFiltro()).toBeNull(); });
      // e devolve o recorte depois
      expect(donoDoFiltro()).toBe("u-edy");
    });
  });
});

// O substituto de node:async_hooks no pacote do navegador.
//
// Ele existe porque dezenas de componentes de tela alcançam lib/db.ts sem
// querer (importam uma constante de um arquivo que, lá no fundo, toca o
// banco) e o empacotador não sabe resolver "node:async_hooks" fora do Node —
// o build inteiro parava.
//
// O que se prova aqui é o comportamento dele: ele NÃO finge que existe
// contexto. Devolver "sem dono" caladinho seria devolver "sem filtro", que é
// justamente o padrão que machuca (regra 3). Carregar tem que ser inerte;
// usar tem que doer.
describe("substituto de async_hooks no navegador", () => {
  it("construir não quebra — ele é carregado em toda tela dessas", async () => {
    const { AsyncLocalStorage } = await import("@/lib/async-hooks-navegador");
    expect(() => new AsyncLocalStorage<string>()).not.toThrow();
  });

  it("usar no navegador dá erro claro, nunca 'sem filtro' em silêncio", async () => {
    const { AsyncLocalStorage } = await import("@/lib/async-hooks-navegador");
    const a = new AsyncLocalStorage<string>();
    expect(() => a.getStore()).toThrow(/navegador/i);
    expect(() => a.run("x", () => 1)).toThrow(/navegador/i);
  });
});
