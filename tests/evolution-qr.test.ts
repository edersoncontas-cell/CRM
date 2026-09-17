import { describe, it, expect } from "vitest";
import { extrairBase64Qr, estadoDaResposta } from "../src/lib/evolution";

const png = "iVBORw0KGgo" + "A".repeat(200);

describe("extrairBase64Qr", () => {
  it("acha o QR na raiz da resposta", () => {
    expect(extrairBase64Qr({ base64: `data:image/png;base64,${png}` })).toBe(`data:image/png;base64,${png}`);
  });

  it("acha o QR dentro de qrcode (formato do /instance/create)", () => {
    expect(extrairBase64Qr({ qrcode: { base64: png } })).toBe(`data:image/png;base64,${png}`);
  });

  it("acha o QR dentro de instance.qrcode", () => {
    expect(extrairBase64Qr({ instance: { qrcode: { base64: png } } })).toBe(`data:image/png;base64,${png}`);
  });

  it("põe o prefixo data: quando vem string crua", () => {
    expect(extrairBase64Qr({ base64: png })).toBe(`data:image/png;base64,${png}`);
  });

  it("devolve null quando não há QR nenhum (só o estado)", () => {
    expect(extrairBase64Qr({ instance: { instanceName: "edy", state: "connecting" } })).toBeNull();
    expect(extrairBase64Qr({ base64: "curto" })).toBeNull();
    expect(extrairBase64Qr({})).toBeNull();
  });

  it("não quebra com campos nulos ou de tipo inesperado", () => {
    expect(extrairBase64Qr({ qrcode: null, instance: "x", base64: 42 })).toBeNull();
  });
});

describe("estadoDaResposta", () => {
  it("lê o estado aninhado e o da raiz", () => {
    expect(estadoDaResposta({ instance: { state: "open" } })).toBe("open");
    expect(estadoDaResposta({ state: "connecting" })).toBe("connecting");
    expect(estadoDaResposta({})).toBe("");
  });
});

import { origemPublicaDaRequisicao } from "../src/lib/zapi";

describe("endereço público a partir da requisição", () => {
  const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });
  it("usa x-forwarded-host/proto da Vercel", () => {
    expect(origemPublicaDaRequisicao(h({ "x-forwarded-host": "crm-lyart-ten.vercel.app", "x-forwarded-proto": "https" }))).toBe("https://crm-lyart-ten.vercel.app");
  });
  it("cai para host quando não há proxy, e assume https", () => {
    expect(origemPublicaDaRequisicao(h({ host: "crm.exemplo.com" }))).toBe("https://crm.exemplo.com");
  });
  it("ignora localhost e rede local", () => {
    expect(origemPublicaDaRequisicao(h({ host: "localhost:3000", "x-forwarded-proto": "http" }))).toBeNull();
    expect(origemPublicaDaRequisicao(h({ host: "127.0.0.1:3118" }))).toBeNull();
    expect(origemPublicaDaRequisicao(h({ host: "192.168.0.10" }))).toBeNull();
    expect(origemPublicaDaRequisicao(h({}))).toBeNull();
  });
});
