import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { contarPorGrupo, filtroDeOrigem, rotuloOrigem, rotuloAcao, ROTULO_ACAO } from "@/lib/auditoria-regra";

// O defeito: cinco origens no registro, três na tela. O que o ZEUS e o
// Cérebro fizeram sozinhos não entrava em "Ações da IA".

describe("auditoria: as cinco origens", () => {
  it("ZEUS e Cérebro contam como ações da IA; origem desconhecida conta como sistema", () => {
    expect(contarPorGrupo([
      { origem: "ia", total: 3 }, { origem: "zeus", total: 10 }, { origem: "cerebro", total: 2 },
      { origem: "usuario", total: 5 }, { origem: "sistema", total: 1 }, { origem: "algo_novo", total: 4 },
    ])).toEqual({ ia: 15, usuario: 5, sistema: 5 });
  });
  it("o filtro 'IA' pega as três origens da IA; os outros filtram direto", () => {
    expect(filtroDeOrigem("ia")).toEqual({ in: ["ia", "zeus", "cerebro"] });
    expect(filtroDeOrigem("usuario")).toBe("usuario");
    expect(filtroDeOrigem(undefined)).toBeUndefined();
  });
  it("o selo diz de onde veio, e ZEUS/Cérebro não aparecem mais como 'sistema'", () => {
    expect(rotuloOrigem("zeus")).toBe("IA · ZEUS");
    expect(rotuloOrigem("cerebro")).toBe("IA · Cérebro");
    expect(rotuloOrigem("usuario")).toBe("usuário");
    expect(rotuloOrigem("sistema")).toBe("sistema");
  });
  it("toda ação tem rótulo em português (a tela nunca mostra o código cru)", () => {
    for (const [acao, rotulo] of Object.entries(ROTULO_ACAO)) {
      expect(rotulo, acao).not.toMatch(/_/);
    }
    expect(rotuloAcao("dados_provisorio_trazidos")).toBe("Dados do banco provisório trazidos");
  });
});
