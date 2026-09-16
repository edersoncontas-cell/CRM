import { describe, it, expect } from "vitest";
import {
  decidirAcao, memoriaAposLeitura, memoriaAposTentativa, precisaMesmoDeQr, descreverConexao,
  MEMORIA_VAZIA, TENTATIVAS_ANTES_DO_QR, type MemoriaVigia,
} from "../src/lib/whatsapp-vigia-regra";

const agora = new Date("2026-09-16T12:00:00Z");
const antes = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();
function mem(p: Partial<MemoriaVigia> = {}): MemoriaVigia {
  return { ...MEMORIA_VAZIA, ...p };
}

describe("decidirAcao", () => {
  it("conexão de pé não mexe em nada", () => {
    expect(decidirAcao("aberta", mem({ ultimoEstado: "aberta" }), agora)).toBe("nada");
  });

  it("escalona: connect, connect, restart, restart e só então o QR", () => {
    const acoes = [0, 1, 2, 3, 4].map((t) => decidirAcao("fechada", mem({ tentativas: t, ultimaTentativaEm: antes(10) }), agora));
    expect(acoes).toEqual(["conectar", "conectar", "reiniciar", "reiniciar", "avisar_qr"]);
    expect(TENTATIVAS_ANTES_DO_QR).toBe(4);
  });

  it("espera entre tentativas em vez de martelar a Evolution", () => {
    expect(decidirAcao("fechada", mem({ tentativas: 1, ultimaTentativaEm: antes(0.2) }), agora)).toBe("esperar");
  });

  it("handshake em andamento logo após uma tentativa ganha um ciclo de folga", () => {
    expect(decidirAcao("conectando", mem({ tentativas: 1, ultimaTentativaEm: antes(0.1) }), agora)).toBe("esperar");
  });

  it("instância que não existe é criada", () => {
    expect(decidirAcao("sem_instancia", mem(), agora)).toBe("criar_instancia");
  });
});

describe("memória do vigia", () => {
  it("marca a queda quando estava conectado e caiu", () => {
    const r = memoriaAposLeitura(mem({ ultimoEstado: "aberta", conectadaDesde: antes(600) }), "fechada", agora);
    expect(r.caiu).toBe(true);
    expect(r.memoria.ultimaQueda).toBe(agora.toISOString());
    expect(r.memoria.conectadaDesde).toBeNull();
  });

  it("conta a reconexão automática e zera as tentativas ao voltar", () => {
    const caido = mem({ ultimoEstado: "fechada", ultimaQueda: antes(20), tentativas: 2, avisouQr: true });
    const r = memoriaAposLeitura(caido, "aberta", agora);
    expect(r.reconectou).toBe(true);
    expect(r.memoria.tentativas).toBe(0);
    expect(r.memoria.reconexoesAutomaticas).toBe(1);
    expect(r.memoria.avisouQr).toBe(false);
    expect(r.memoria.conectadaDesde).toBe(agora.toISOString());
  });

  it("conexão que segue de pé mantém o horário original", () => {
    const desde = antes(600);
    const r = memoriaAposLeitura(mem({ ultimoEstado: "aberta", conectadaDesde: desde }), "aberta", agora);
    expect(r.memoria.conectadaDesde).toBe(desde);
    expect(r.memoria.reconexoesAutomaticas).toBe(0);
  });

  it("cada tentativa incrementa o contador", () => {
    expect(memoriaAposTentativa(mem({ tentativas: 1 }), agora).tentativas).toBe(2);
  });
});

describe("quando incomodar o vendedor com o QR", () => {
  it("não pede QR durante o religamento automático", () => {
    expect(precisaMesmoDeQr(mem({ tentativas: 2, ultimaVerificacao: antes(2) }), agora)).toBe(false);
  });

  it("pede QR depois de esgotar as tentativas", () => {
    expect(precisaMesmoDeQr(mem({ tentativas: TENTATIVAS_ANTES_DO_QR, ultimaVerificacao: antes(2) }), agora)).toBe(true);
  });

  it("pede QR se o próprio vigia parou de rodar", () => {
    expect(precisaMesmoDeQr(mem({ tentativas: 1, ultimaVerificacao: antes(45) }), agora)).toBe(true);
    expect(precisaMesmoDeQr(mem(), agora)).toBe(true);
  });
});

describe("descreverConexao", () => {
  it("conta há quanto tempo está de pé e quantas vezes religou sozinho", () => {
    expect(descreverConexao(mem({ ultimoEstado: "aberta", conectadaDesde: antes(180), reconexoesAutomaticas: 2 }), agora))
      .toBe("Conectado há 3h · religado sozinho 2x desde que foi pareado");
  });

  it("mostra o tempo fora do ar e as tentativas", () => {
    expect(descreverConexao(mem({ ultimoEstado: "fechada", ultimaQueda: antes(120), tentativas: 3 }), agora))
      .toBe("Fora do ar há 2h · 3 tentativa(s) de religar");
  });
});
