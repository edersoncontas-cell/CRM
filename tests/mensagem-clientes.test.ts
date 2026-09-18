import { describe, it, expect } from "vitest";
import {
  DATAS_COMEMORATIVAS, proximaOcorrencia, rotuloDataComemorativa, datasPorProximidade, publicosDoTipo, publicoPadrao,
  modeloPadrao, tipoDaMidia, validarAnexo, LIMITE_ANEXO_BYTES, promptArte, legendaDaMidia,
} from "../src/lib/mensagem-clientes-regra";
import { personalizarTexto } from "../src/lib/abordagem-cidade-regra";

const hoje = new Date("2026-09-18T15:00:00Z"); // 18/09/2026 em Brasília
const data = (id: string) => DATAS_COMEMORATIVAS.find((d) => d.id === id)!;

describe("mensagem para clientes: datas comemorativas", () => {
  it("as datas oficiais: Operador 29/05, Cliente 15/09, Natal 25/12, Ano Novo 01/01", () => {
    expect([data("operador").dia, data("operador").mes]).toEqual([29, 5]);
    expect([data("cliente").dia, data("cliente").mes]).toEqual([15, 9]);
    expect([data("natal").dia, data("natal").mes]).toEqual([25, 12]);
    expect([data("ano-novo").dia, data("ano-novo").mes]).toEqual([1, 1]);
  });

  it("próxima ocorrência conta hoje como 0 e vira o ano quando já passou", () => {
    expect(proximaOcorrencia(data("natal"), hoje)).toEqual({ diasAte: 98, ano: 2026 });
    expect(proximaOcorrencia(data("cliente"), hoje).ano).toBe(2027);
    expect(proximaOcorrencia(data("cliente"), new Date("2026-09-15T15:00:00Z")).diasAte).toBe(0);
    expect(rotuloDataComemorativa(data("cliente"), new Date("2026-09-15T15:00:00Z"))).toBe("15/09 · hoje");
    expect(rotuloDataComemorativa(data("natal"), hoje)).toBe("25/12 · em 98 dias");
  });

  it("lista ordenada pela que está chegando", () => {
    expect(datasPorProximidade(hoje).map((d) => d.id)).toEqual(["natal", "ano-novo", "operador", "cliente"]);
  });
});

describe("mensagem para clientes: público por tipo", () => {
  it("visita é por cidade; promoção e comemorativa aceitam todos ou cidade; aniversário é aniversariantes", () => {
    expect(publicosDoTipo("visita")).toEqual(["cidade"]);
    expect(publicosDoTipo("promocao")).toEqual(["todos", "cidade"]);
    expect(publicosDoTipo("comemorativa")).toEqual(["todos", "cidade"]);
    expect(publicosDoTipo("aniversario")).toEqual(["aniversariantes"]);
    expect(publicoPadrao("aniversario")).toEqual({ modo: "aniversariantes", dias: 0 });
    expect(publicoPadrao("promocao")).toEqual({ modo: "todos" });
  });
});

describe("mensagem para clientes: modelo padrão sem IA", () => {
  it("todo tipo tem {nome} e personaliza", () => {
    for (const tipo of ["visita", "promocao", "comemorativa", "aniversario"] as const) {
      const t = modeloPadrao(tipo, { cidade: "Cachoeiro", periodo: "na semana que vem", data: data("natal"), promocao: "10% na E145C" });
      expect(t).toContain("{nome}");
      expect(personalizarTexto(t, "adailton christophori")).toContain("Adailton");
    }
  });

  it("promoção usa a oferta descrita e cada data tem o próprio texto", () => {
    expect(modeloPadrao("promocao", { promocao: "taxa zero na retro B95C" })).toContain("taxa zero na retro B95C");
    expect(modeloPadrao("comemorativa", { data: data("operador") })).toContain("Operador");
    expect(modeloPadrao("comemorativa", { data: data("ano-novo") })).toContain("Ano Novo");
    expect(modeloPadrao("aniversario", {})).toContain("aniversário");
  });
});

describe("mensagem para clientes: anexo", () => {
  it("aceita imagem, vídeo e PDF até o limite; recusa o resto", () => {
    expect(tipoDaMidia("image/jpeg")).toBe("image");
    expect(tipoDaMidia("video/mp4")).toBe("video");
    expect(tipoDaMidia("application/pdf")).toBe("document");
    expect(tipoDaMidia("application/zip")).toBeNull();
    expect(validarAnexo("image/png", 1000)).toBeNull();
    expect(validarAnexo("video/mp4", LIMITE_ANEXO_BYTES + 1)).toMatch(/limite/);
    expect(validarAnexo("application/zip", 10)).toMatch(/Só imagem/);
    expect(legendaDaMidia("video", "x.mp4")).toBe("🎬 Vídeo");
    expect(legendaDaMidia("document", "proposta.pdf")).toBe("proposta.pdf");
  });
});

describe("mensagem para clientes: pedido de arte ao Gemini", () => {
  it("leva tema, marca, pedido do vendedor e a regra da foto de base", () => {
    const p = promptArte({ tipo: "comemorativa", data: data("natal"), instrucoes: "fundo com neve", base: "escavadeira" });
    expect(p).toContain("Natal");
    expect(p).toContain("New Holland");
    expect(p).toContain("fundo com neve");
    expect(p).toContain("foto de referência");
    const semBase = promptArte({ tipo: "promocao", promocao: "10% na E145C", instrucoes: "", base: "nenhuma" });
    expect(semBase).toContain("10% na E145C");
    expect(semBase).not.toContain("foto de referência");
  });
});
