// O print dele (01/10): apagar 400 · logout 500 "Connection Closed" · reiniciou
// · apagar 400. Uma Evolution de mentira com a sessão MORTA ("open" por fora,
// socket fechado por dentro) e os jeitos que ela tem de reagir ao reiniciar.
import { describe, it, expect } from "vitest";
import { apagarEvolution, PRAZO_APAGAR_MS } from "@/lib/whatsapp-apagar-instancia";
import { textoDoErroEvolution } from "@/lib/evolution";
import type { EstadoInstancia } from "@/lib/whatsapp-desconectar";

type Reinicio = "cura" | "close" | "morta-de-novo" | "nunca-assenta";

function evolutionZumbi(o: { reinicio: Reinicio; apagarRecusaSempre?: boolean; apagarSemMotivo?: boolean }) {
  let t = 0;
  let estado: EstadoInstancia | null = "open";
  let vivo = false;
  let assentaEm: number | null = null;
  const chamadas: string[] = [];
  const aplicar = () => {
    if (assentaEm !== null && t >= assentaEm) {
      assentaEm = null;
      if (o.reinicio === "cura") { estado = "open"; vivo = true; }
      else if (o.reinicio === "close") { estado = "close"; vivo = false; }
      else if (o.reinicio === "morta-de-novo") { estado = "open"; vivo = false; }
    }
  };
  return {
    chamadas,
    agora: () => t,
    esperar: async (ms: number) => { t += ms; },
    estado: async () => { t += 200; aplicar(); chamadas.push(`estado:${estado}`); return estado; },
    apagar: async () => {
      t += 300; aplicar(); chamadas.push("apagar");
      if (o.apagarRecusaSempre) throw new Error(o.apagarSemMotivo ? "Evolution API /instance/delete/crm falhou (400): {}" : "Evolution API /instance/delete/crm falhou (400): Error: Connection Closed");
      if ((estado === "open" || estado === "connecting") && !vivo) throw new Error("Evolution API /instance/delete/crm falhou (400): Error: Connection Closed");
      estado = "inexistente";
    },
    logout: async () => {
      t += 300; aplicar(); chamadas.push("logout");
      if (estado === "connecting" || !vivo) throw new Error("Evolution API /instance/logout/crm falhou (500): Error: Connection Closed");
      estado = "close";
    },
    reiniciar: async () => {
      t += 500; chamadas.push("reiniciar");
      estado = "connecting"; vivo = false; assentaEm = t + 6_000;
    },
  };
}

describe("apagar a instância da Evolution com a sessão morta", () => {
  it("o caso do print: reinicia, ESPERA assentar, o logout funciona e o apagar passa", async () => {
    const ev = evolutionZumbi({ reinicio: "cura" });
    const r = await apagarEvolution(ev);
    expect(r.ok).toBe(true);
    expect(r.passos.join(" | ")).toMatch(/apagou a instância recusado/);
    expect(r.passos).toContain("reiniciou");
    expect(r.passos).toContain("depois de reiniciar: open");
    expect(r.passos).toContain("logout");
    expect(r.passos).toContain("apagou de novo");
  });

  it("nunca apaga enquanto ela ainda está 'connecting' (a pressa de 2 s é o que falhava)", async () => {
    const ev = evolutionZumbi({ reinicio: "cura" });
    await apagarEvolution(ev);
    const i = ev.chamadas.indexOf("reiniciar");
    const segundoApagar = ev.chamadas.indexOf("apagar", i);
    const estadoAntes = ev.chamadas.slice(i, segundoApagar).filter((c) => c.startsWith("estado:")).pop();
    expect(estadoAntes).not.toBe("estado:connecting");
  });

  it("reiniciar deixa em 'close' (precisa de QR): apaga direto, sem logout", async () => {
    const ev = evolutionZumbi({ reinicio: "close" });
    const r = await apagarEvolution(ev);
    expect(r.ok).toBe(true);
    expect(r.passos).toContain("depois de reiniciar: close");
    expect(ev.chamadas.filter((c) => c === "logout")).toHaveLength(0);
  });

  it("a Evolution aceita apagar de primeira (versões que não passam pelo logout): nem reinicia", async () => {
    const ev = evolutionZumbi({ reinicio: "cura" });
    // instância viva: apagar passa direto
    await ev.reiniciar();
    await ev.esperar(7_000);
    ev.chamadas.length = 0;
    const r = await apagarEvolution(ev);
    expect(r.ok).toBe(true);
    expect(ev.chamadas).not.toContain("reiniciar");
  });

  it("socket morto de novo depois de reiniciar: tenta duas rodadas e diz o motivo, sem prometer", async () => {
    const ev = evolutionZumbi({ reinicio: "morta-de-novo" });
    const r = await apagarEvolution(ev);
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/recusou apagar/);
    expect(r.erro).toMatch(/Connection Closed/);
    expect(ev.chamadas.filter((c) => c === "reiniciar")).toHaveLength(2);
    expect(r.passos.filter((p) => /recusado/.test(p)).length).toBeGreaterThanOrEqual(2);
  });

  it("nunca assenta ('connecting' para sempre): para no prazo, não fica num laço", async () => {
    const ev = evolutionZumbi({ reinicio: "nunca-assenta" });
    const r = await apagarEvolution(ev);
    expect(r.ok).toBe(false);
    expect(ev.agora()).toBeLessThanOrEqual(PRAZO_APAGAR_MS + 3_000);
  });

  it("depois de apagar, a instância continua 'open': NÃO diz que deu certo (criar devolveria a velha)", async () => {
    let t = 0;
    const r = await apagarEvolution({
      agora: () => t,
      esperar: async (ms) => { t += ms; },
      estado: async () => { t += 200; return "open"; },
      apagar: async () => { t += 300; },
      logout: async () => {},
      reiniciar: async () => {},
    });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/continua conectada/);
  });

  it("a instância já não existia: é só criar", async () => {
    let t = 0;
    const r = await apagarEvolution({
      agora: () => t,
      esperar: async (ms) => { t += ms; },
      estado: async () => "inexistente",
      apagar: async () => {},
      logout: async () => {},
      reiniciar: async () => {},
    });
    expect(r.ok).toBe(true);
  });
});

describe("texto do erro da Evolution (o '[object Object]' do print)", () => {
  it("lista de objetos, objeto, lista de textos e texto puro", () => {
    expect(textoDoErroEvolution([{ message: "Error: Connection Closed" }])).toBe("Error: Connection Closed");
    expect(textoDoErroEvolution({ message: "Error: Connection Closed" })).toBe("Error: Connection Closed");
    expect(textoDoErroEvolution(["a", "b"])).toBe("a; b");
    expect(textoDoErroEvolution("texto")).toBe("texto");
    expect(textoDoErroEvolution([{ code: 1, detalhe: "x" }])).toBe('{"code":1,"detalhe":"x"}');
  });

  it("nunca devolve '[object Object]'", () => {
    for (const v of [{}, [{}], { a: { b: 1 } }, [[{ x: 1 }]], null, undefined, 42]) {
      expect(textoDoErroEvolution(v)).not.toContain("[object Object]");
    }
  });
});
