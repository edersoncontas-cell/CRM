import { describe, it, expect } from "vitest";
import {
  TIPOS_POST, TEMAS_SUGERIDOS, limiteDoCanal, promptLegenda, promptArtePost,
  normalizarLegenda, textoParaPublicar, type PedidoPost,
} from "@/lib/marketing-regra";

const pedido: PedidoPost = {
  tipo: "semanal",
  tema: "Custo por hora: o número que decide a compra",
  canal: "instagram",
  maquina: "CA25 D",
  instrucoes: null,
  vendedor: "Ederson",
  empresa: "New Holland Construction · Dynapac",
  marcas: "New Holland Construction e Dynapac",
  regiao: "sul do Espírito Santo",
};

describe("tipos e temas de post", () => {
  it("tem um tema sugerido para cada tipo", () => {
    for (const t of TIPOS_POST) {
      expect(TEMAS_SUGERIDOS[t.id].length).toBeGreaterThan(0);
    }
  });

  it("cada canal tem o seu limite de caracteres", () => {
    expect(limiteDoCanal("whatsapp")).toBeLessThan(limiteDoCanal("instagram"));
  });
});

describe("prompt da legenda", () => {
  it("proíbe inventar preço e especificação", () => {
    const { system } = promptLegenda(pedido);
    expect(system).toMatch(/Inventar preço/);
    expect(system).toMatch(/Inventar especificação/);
  });

  it("leva tema, máquina e canal para a IA", () => {
    const { user } = promptLegenda(pedido);
    expect(user).toContain("Custo por hora");
    expect(user).toContain("CA25 D");
    expect(user).toContain("Instagram");
  });

  it("repassa o pedido do vendedor quando existe", () => {
    const { user } = promptLegenda({ ...pedido, instrucoes: "falar da entrega em 30 dias já acertada" });
    expect(user).toContain("entrega em 30 dias");
  });
});

describe("prompt da arte", () => {
  it("proíbe texto escrito na imagem", () => {
    const p = promptArtePost(pedido, "rolo compactando base de estrada rural");
    expect(p).toMatch(/NÃO escreva nenhum texto/);
    expect(p).toContain("rolo compactando base");
  });
});

describe("resposta da IA", () => {
  it("lê o JSON e limpa as hashtags", () => {
    const r = normalizarLegenda('{"legenda":"Texto do post","hashtags":"#obra #maquinas lixo #asfalto","ideiaDeArte":"rolo na estrada"}', "instagram");
    expect(r.legenda).toBe("Texto do post");
    expect(r.hashtags).toBe("#obra #maquinas #asfalto");
    expect(r.ideiaDeArte).toBe("rolo na estrada");
  });

  it("aproveita resposta em texto puro como legenda", () => {
    const r = normalizarLegenda("Compactar direito é o que segura a obra.", "whatsapp");
    expect(r.legenda).toContain("Compactar direito");
  });

  it("corta no limite do canal", () => {
    const longo = "a".repeat(5000);
    expect(normalizarLegenda(JSON.stringify({ legenda: longo }), "whatsapp").legenda.length).toBe(limiteDoCanal("whatsapp"));
  });

  it("junta legenda e hashtags para publicar", () => {
    expect(textoParaPublicar("Post", "#obra")).toBe("Post\n\n#obra");
    expect(textoParaPublicar("Post", "")).toBe("Post");
  });
});
