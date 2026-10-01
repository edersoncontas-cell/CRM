// "Estou tentando desconectar o WhatsApp para escanear o QR code novamente e
//  não está indo" (01/10). Uma Evolution de mentira com os jeitos que ela tem
// de não obedecer.
import { describe, it, expect } from "vitest";
import { desconectarEvolution, PRAZO_DESCONEXAO_MS, type EstadoInstancia } from "@/lib/whatsapp-desconectar";

function evolution(o: {
  estado?: EstadoInstancia | null;
  /** O logout derruba depois de N consultas (0 = na hora); Infinity = nunca. */
  logoutDerrubaApos?: number;
  logoutFalha?: string;
  /** Depois de reiniciar, a sessão volta a obedecer o logout. */
  reiniciarDestrava?: boolean;
  reiniciarFalha?: string;
}) {
  let t = 0;
  let estado: EstadoInstancia | null = o.estado === undefined ? "open" : o.estado;
  let derrubaEm: number | null = null;
  let destravada = false;
  const chamadas: string[] = [];
  return {
    chamadas,
    agora: () => t,
    esperar: async (ms: number) => { t += ms; },
    estado: async () => {
      t += 200;
      chamadas.push("estado");
      if (derrubaEm !== null && derrubaEm-- <= 0) { estado = "close"; derrubaEm = null; }
      return estado;
    },
    logout: async () => {
      t += 300;
      chamadas.push("logout");
      if (o.logoutFalha && !destravada) throw new Error(o.logoutFalha);
      const n = destravada ? 0 : (o.logoutDerrubaApos ?? 0);
      if (Number.isFinite(n)) derrubaEm = n;
    },
    reiniciar: async () => {
      t += 500;
      chamadas.push("reiniciar");
      if (o.reiniciarFalha) throw new Error(o.reiniciarFalha);
      if (o.reiniciarDestrava) destravada = true;
      estado = "open";
    },
  };
}

describe("desconectar o WhatsApp para ler o QR de novo", () => {
  it("o caso normal: pede, confere e sai", async () => {
    const ev = evolution({});
    const r = await desconectarEvolution(ev);
    expect(r).toMatchObject({ ok: true });
    expect(ev.chamadas).not.toContain("reiniciar");
  });

  it("a Evolution diz 'logged out' antes de sair de fato: espera conferindo", async () => {
    const ev = evolution({ logoutDerrubaApos: 3 });
    expect((await desconectarEvolution(ev)).ok).toBe(true);
    expect(ev.chamadas).not.toContain("reiniciar");
  });

  it("sessão presa: o logout não tem efeito, reinicia e pede de novo — o defeito de 01/10", async () => {
    const ev = evolution({ logoutDerrubaApos: Infinity, reiniciarDestrava: true });
    const r = await desconectarEvolution(ev);
    expect(r.ok).toBe(true);
    expect(r.passos).toEqual(["logout", "reiniciou", "logout de novo"]);
  });

  it("logout dando erro na sessão presa: reiniciar destrava", async () => {
    const ev = evolution({ logoutFalha: "Evolution API /instance/logout/crm falhou (500): Connection Closed", reiniciarDestrava: true });
    const r = await desconectarEvolution(ev);
    expect(r.ok).toBe(true);
  });

  it("nada destrava: a tela recebe 'presa' com o motivo — nunca um 'desconectado' de mentira", async () => {
    const ev = evolution({ logoutFalha: "Evolution API /instance/logout/crm falhou (500): Connection Closed" });
    const r = await desconectarEvolution(ev);
    expect(r.ok).toBe(false);
    expect(r.presa).toBe(true);
    expect(r.erro).toMatch(/continua dizendo que o número está conectado/);
    expect(r.erro).toMatch(/Connection Closed/);
  });

  it("quando nada destrava, os passos dizem o que a Evolution respondeu e o estado final", async () => {
    const ev = evolution({ logoutFalha: "Evolution API /instance/logout/crm falhou (500): Connection Closed", reiniciarFalha: "Evolution API /instance/restart/crm falhou (404): rota" });
    const r = await desconectarEvolution(ev);
    expect(r.passos.join(" | ")).toMatch(/logout falhou: .*Connection Closed/);
    expect(r.passos.join(" | ")).toMatch(/reiniciar falhou: .*rota/);
    expect(r.passos[r.passos.length - 1]).toBe("estado no fim: open");
  });

  it("já estava desconectado (ou a instância sumiu): é só ler o QR", async () => {
    for (const e of ["close", "connecting", "inexistente"] as const) {
      const ev = evolution({ estado: e });
      expect(await desconectarEvolution(ev)).toMatchObject({ ok: true, jaEstava: true });
      expect(ev.chamadas).not.toContain("logout");
    }
  });

  it("Evolution fora do ar: diz o erro, não diz que desconectou nem que está presa", async () => {
    const fora = "Não consegui falar com o servidor da Evolution API: http://vps:8080 está inalcançável";
    const ev = evolution({ estado: null, logoutFalha: fora, reiniciarFalha: fora });
    const r = await desconectarEvolution(ev);
    expect(r.ok).toBe(false);
    expect(r.presa).toBeFalsy();
    expect(r.erro).toMatch(/Evolution/);
  });

  it("nunca passa do prazo (a ação do servidor tem 60 s)", async () => {
    const ev = evolution({ logoutDerrubaApos: Infinity });
    await desconectarEvolution(ev);
    // Uma consulta a mais pode começar no limite; nunca uma rodada inteira.
    expect(ev.agora()).toBeLessThanOrEqual(PRAZO_DESCONEXAO_MS + 2_000);
  });
});
