// "Esse resumo tá péssimo, o cliente não enviou os documentos."
//
// A IA não estava burra: estava lendo um texto ambíguo. O histórico era
// montado com `${nomeDoVendedor}: ${body}`, e o body de uma mídia é o nome do
// arquivo ou um rótulo com emoji. Uma linha como
//
//     [15/09 10:22] Ederson: Ficha_tecnica_E145C.pdf
//
// não diz que aquilo é anexo, nem de que lado veio — e "Ederson" é só um nome
// próprio qualquer para o modelo. Daí sai "o cliente enviou documentos".
//
// Estes testes prendem o formato novo, que é a base de toda a correção.

import { describe, it, expect } from "vitest";
import {
  linhaDoHistorico, montarHistorico, montarUltimas, quemFalou, tipoDaMidia,
  legendaDaMidia, midiaDaConversa,
} from "@/lib/zeus/historico-linha";

const em = (d: string) => new Date(`2026-09-15T${d}:00-03:00`);
const texto = (direction: string, body: string, hora = "10:00") => ({ direction, body, sentAt: em(hora) });
const anexo = (direction: string, mediaType: string, extra: Record<string, unknown> = {}) =>
  ({ direction, body: "", mediaType, sentAt: em("10:00"), ...extra });

describe("quem falou", () => {
  it("o vendedor é 'VOCÊ', nunca o primeiro nome dele", () => {
    expect(quemFalou("OUT")).toBe("VOCÊ (vendedor)");
    expect(quemFalou("IN")).toBe("CLIENTE");
  });
});

describe("a linha de uma mensagem de texto", () => {
  it("traz data, hora, autor e o texto", () => {
    const l = linhaDoHistorico(texto("IN", "bom dia, quanto fica a E145C?", "09:30"));
    expect(l).toContain("15/09/2026");
    expect(l).toContain("09:30");
    expect(l).toContain("CLIENTE:");
    expect(l).toContain("quanto fica a E145C?");
  });

  it("mensagem vazia vira '[mensagem sem texto]', não linha em branco", () => {
    // Linha em branco é convite para o modelo preencher o buraco com invenção.
    expect(linhaDoHistorico(texto("IN", ""))).toContain("[mensagem sem texto]");
    expect(linhaDoHistorico({ direction: "IN", body: null, sentAt: em("10:00") })).toContain("[mensagem sem texto]");
  });
});

describe("a linha de um anexo — o caso do defeito", () => {
  it("documento do VENDEDOR sai marcado como do vendedor, com o nome do arquivo", () => {
    const l = linhaDoHistorico(anexo("OUT", "document", { mediaName: "Ficha_tecnica_E145C.pdf", body: "Ficha_tecnica_E145C.pdf" }));
    expect(l).toContain("VOCÊ (vendedor)");
    expect(l).toContain("[enviou um documento: Ficha_tecnica_E145C.pdf]");
    // e o nome do arquivo NÃO aparece duas vezes, como se fosse fala
    expect(l.match(/Ficha_tecnica_E145C\.pdf/g)).toHaveLength(1);
  });

  it("documento do CLIENTE sai marcado como do cliente", () => {
    const l = linhaDoHistorico(anexo("IN", "document", { mediaName: "cnh.pdf" }));
    expect(l).toContain("CLIENTE:");
    expect(l).toContain("[enviou um documento: cnh.pdf]");
  });

  it("o rótulo que o próprio CRM põe na mídia não vira fala", () => {
    // extrairConteudoEvolution grava "📷 Imagem" / "📄 Documento" no body.
    expect(legendaDaMidia({ body: "📷 Imagem", mediaName: null })).toBe(null);
    expect(legendaDaMidia({ body: "📄 Documento", mediaName: null })).toBe(null);
    expect(legendaDaMidia({ body: "🎵 Áudio", mediaName: null })).toBe(null);
    const l = linhaDoHistorico(anexo("IN", "image", { body: "📷 Imagem" }));
    expect(l).toContain("[enviou uma foto]");
    expect(l).not.toContain("📷");
  });

  it("legenda de verdade escrita junto com a foto é preservada", () => {
    expect(legendaDaMidia({ body: "olha o estado da esteira", mediaName: null })).toBe("olha o estado da esteira");
    const l = linhaDoHistorico(anexo("IN", "image", { body: "olha o estado da esteira" }));
    expect(l).toContain("[enviou uma foto] olha o estado da esteira");
  });

  it("áudio entra com a transcrição, quando existe", () => {
    const l = linhaDoHistorico(anexo("IN", "audio", { transcript: "fechado, pode mandar a proposta" }));
    expect(l).toContain("[enviou um áudio] fechado, pode mandar a proposta");
  });

  it("os tipos de mídia são reconhecidos", () => {
    expect(tipoDaMidia({ mediaType: "document" })).toBe("documento");
    expect(tipoDaMidia({ mediaType: "image" })).toBe("foto");
    expect(tipoDaMidia({ mediaType: "audio" })).toBe("audio");
    expect(tipoDaMidia({ mediaType: "video" })).toBe("video");
    expect(tipoDaMidia({ mediaType: null })).toBe(null);
    expect(tipoDaMidia({ mediaType: "" })).toBe(null);
  });
});

describe("o histórico inteiro", () => {
  const msgs = [
    texto("IN", "bom dia", "09:00"),
    anexo("OUT", "document", { mediaName: "proposta.pdf" }),
    texto("IN", "vou ver com meu sócio", "11:00"),
  ];

  it("sai na ordem, uma linha por mensagem", () => {
    const h = montarHistorico(msgs);
    expect(h.split("\n")).toHaveLength(3);
    expect(h.indexOf("bom dia")).toBeLessThan(h.indexOf("proposta.pdf"));
  });

  it("as últimas vêm sem a data, para o foco imediato", () => {
    const u = montarUltimas(msgs, 2);
    expect(u).not.toContain("15/09/2026");
    expect(u).toContain("CLIENTE: vou ver com meu sócio");
  });
});

describe("o índice do que foi anexado — a prova contra a invenção", () => {
  it("separa o que cada lado mandou", () => {
    const m = midiaDaConversa([
      anexo("OUT", "document", { mediaName: "proposta.pdf" }),
      anexo("IN", "image"),
      texto("IN", "olha aí"),
    ]);
    expect(m.vendedor.has("documento")).toBe(true);
    expect(m.cliente.has("documento")).toBe(false); // <- o caso do print
    expect(m.cliente.has("foto")).toBe(true);
  });

  it("conversa só de texto não tem anexo nenhum", () => {
    const m = midiaDaConversa([texto("IN", "oi"), texto("OUT", "bom dia")]);
    expect(m.cliente.size).toBe(0);
    expect(m.vendedor.size).toBe(0);
  });
});
