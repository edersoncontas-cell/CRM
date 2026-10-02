// 02/10, print dele às 10:18: "http://147.15.65.44:8080 não respondeu em 10s",
// fora do ar há 2h, a tela pedindo QR. O diagnóstico agora diz QUAL causa é
// (Evolution parada / porta calada com a VPS ligada / VPS inteira fora) e o
// vigia para de mandar escanear QR, que não resolve.
import { describe, it, expect, afterAll } from "vitest";
import net from "node:net";
import http from "node:http";
import { readFileSync } from "node:fs";
import {
  classificarFalhaRede, concluirServidorFora, servidorEvolutionFora, causaDaFalha, PREFIXO_SERVIDOR_FORA, hostDaUrl,
} from "@/lib/evolution-servidor-regra";
import { sondarPorta } from "@/lib/sondar-porta";
import {
  memoriaAposLeitura, precisaAvisarServidorFora, descreverConexao, MEMORIA_VAZIA, type MemoriaVigia,
} from "@/lib/whatsapp-vigia-regra";

const fechar: Array<() => void> = [];
afterAll(() => fechar.forEach((f) => f()));

function portaLivre(): Promise<number> {
  return new Promise((ok) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => ok(p));
    });
  });
}

describe("como a porta da Evolution falhou", () => {
  it("tempo esgotado, recusada, endereço que não existe, inalcançável", () => {
    expect(classificarFalhaRede(new DOMException("x", "TimeoutError"))).toBe("tempo");
    expect(classificarFalhaRede(new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } }))).toBe("recusada");
    expect(classificarFalhaRede(new TypeError("fetch failed", { cause: { errors: [{ code: "ECONNREFUSED" }] } }))).toBe("recusada");
    expect(classificarFalhaRede(new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } }))).toBe("dns");
    expect(classificarFalhaRede(new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }))).toBe("tempo");
    expect(classificarFalhaRede(new TypeError("fetch failed", { cause: { code: "EHOSTUNREACH" } }))).toBe("inalcancavel");
    expect(classificarFalhaRede("???")).toBe("inalcancavel");
  });

  it("com o fetch de verdade: porta fechada é 'recusada', servidor calado é 'tempo'", async () => {
    const fechada = await portaLivre();
    const e1 = await fetch(`http://127.0.0.1:${fechada}/`, { signal: AbortSignal.timeout(2_000) }).catch((e) => e);
    expect(classificarFalhaRede(e1)).toBe("recusada");

    const calado = http.createServer(() => { /* nunca responde */ });
    await new Promise<void>((ok) => calado.listen(0, "127.0.0.1", ok));
    fechar.push(() => { calado.closeAllConnections(); calado.close(); });
    const porta = (calado.address() as net.AddressInfo).port;
    const e2 = await fetch(`http://127.0.0.1:${porta}/`, { signal: AbortSignal.timeout(300) }).catch((e) => e);
    expect(classificarFalhaRede(e2)).toBe("tempo");
  });

  it("a frase de erro de toda chamada diz 'recusou' quando a VPS está ligada", () => {
    expect(causaDaFalha("recusada", 10)).toMatch(/VPS está ligada, mas a Evolution está parada/);
    expect(causaDaFalha("tempo", 10)).toBe("não respondeu em 10s");
  });
});

describe("batida na porta do SSH", () => {
  it("porta aberta responde; porta fechada recusa (as duas provam a máquina ligada)", async () => {
    const s = net.createServer((c) => c.end()).listen(0, "127.0.0.1");
    await new Promise((ok) => s.once("listening", ok));
    fechar.push(() => s.close());
    expect(await sondarPorta("127.0.0.1", (s.address() as net.AddressInfo).port, 2_000)).toBe("responde");
    expect(await sondarPorta("127.0.0.1", await portaLivre(), 2_000)).toBe("recusa");
  });
});

describe("conclusão: qual das causas é, e o que tocar pelo celular", () => {
  const url = "http://147.15.65.44:8080";

  it("porta recusada: VPS ligada, Evolution parada → Reiniciar no painel", () => {
    const r = concluirServidorFora({ url, falha: "recusada", ssh: "nao-testada", segundos: 10 });
    expect(r.conclusao).toMatch(/VPS está ligada, mas a Evolution está parada/);
    expect(r.conclusao).toMatch(/Reiniciar/);
    expect(r.comando).toBe("cd /opt/evolution && docker compose up -d");
  });

  it("8080 calada e SSH responde: firewall ou Evolution travada", () => {
    for (const ssh of ["responde", "recusa"] as const) {
      const r = concluirServidorFora({ url, falha: "tempo", ssh, segundos: 10 });
      expect(r.etapas.find((e) => e.etapa === "VPS ligada")?.ok).toBe(true);
      expect(r.conclusao).toMatch(/Firewall/);
      expect(r.conclusao).toMatch(/TCP 8080/);
    }
  });

  it("8080 e SSH calados: a VPS inteira (parada, suspensa ou outro IP)", () => {
    const r = concluirServidorFora({ url, falha: "tempo", ssh: "silencio", segundos: 10 });
    expect(r.etapas.find((e) => e.etapa === "VPS ligada")?.ok).toBe(false);
    expect(r.conclusao).toMatch(/VPS inteira não responde/);
    expect(r.conclusao).toMatch(/Iniciar/);
    expect(r.conclusao).toMatch(/se não for 147\.15\.65\.44/);
  });

  it("endereço que não existe: é a variável na Vercel", () => {
    expect(concluirServidorFora({ url: "http://vps-errada.exemplo:8080", falha: "dns", ssh: "nao-testada", segundos: 10 }).conclusao).toMatch(/EVOLUTION_API_URL/);
  });

  it("nenhuma conclusão manda 'entrar por SSH' (ele está no celular, na rua)", () => {
    for (const falha of ["tempo", "recusada", "dns", "inalcancavel"] as const) {
      for (const ssh of ["responde", "recusa", "silencio", "nao-testada"] as const) {
        expect(concluirServidorFora({ url, falha, ssh, segundos: 10 }).conclusao).not.toMatch(/entre por SSH|ufw allow/);
      }
    }
  });

  it("IPv6 entre colchetes vira host sem colchetes", () => {
    expect(hostDaUrl("http://[2001:db8::1]:8080")).toBe("2001:db8::1");
    expect(hostDaUrl("lixo")).toBe("");
  });
});

describe("todo mundo reconhece 'servidor fora' pela mesma frase", () => {
  it("evoFetch monta a frase com o prefixo, e o diagnóstico usa as regras", () => {
    const zapi = readFileSync("src/lib/zapi.ts", "utf8");
    expect(zapi).toMatch(/`\$\{PREFIXO_SERVIDOR_FORA\}: \$\{cfg\.url\} \$\{causa\}/);
    expect(zapi).toMatch(/concluirServidorFora\(/);
    expect(servidorEvolutionFora(`${PREFIXO_SERVIDOR_FORA}: http://x:8080 não respondeu em 10s.`)).toBe(true);
    expect(servidorEvolutionFora("Evolution API /instance/connect falhou (500): Connection Closed")).toBe(false);
    expect(servidorEvolutionFora(null)).toBe(false);
  });

  it("o vigia não martela nem pede QR com o servidor fora; o Zeus também não", () => {
    const vigia = readFileSync("src/lib/whatsapp-vigia.ts", "utf8");
    expect(vigia).toMatch(/pausado \|\| servidorFora \? "esperar"/);
    expect(vigia).toMatch(/!servidorFora && precisaMesmoDeQr/);
    expect(readFileSync("src/lib/zeus/tick.ts", "utf8")).toMatch(/!servidorEvolutionFora\(status\.erro\) && precisaMesmoDeQr/);
  });

  it("a tela troca 'escaneie o QR' pelo aviso do servidor", () => {
    expect(readFileSync("src/components/ConexaoWhatsApp.tsx", "utf8")).toMatch(/servidorEvolutionFora\(qrErro \?\? status\.erro\)/);
  });
});

describe("memória do vigia com o servidor fora", () => {
  const agora = new Date("2026-10-02T13:18:00Z"); // 10:18 em Brasília
  const antes = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();
  const mem = (p: Partial<MemoriaVigia> = {}): MemoriaVigia => ({ ...MEMORIA_VAZIA, ...p });

  it("marca desde quando, mantém a hora nas passadas seguintes e limpa quando ele volta", () => {
    const a = memoriaAposLeitura(mem({ ultimoEstado: "aberta" }), "fechada", new Date(antes(130)), true).memoria;
    expect(a.servidorForaDesde).toBe(antes(130));
    const b = memoriaAposLeitura(a, "fechada", agora, true).memoria;
    expect(b.servidorForaDesde).toBe(antes(130));
    expect(memoriaAposLeitura({ ...b, avisouServidorFora: true }, "fechada", agora, false).memoria).toMatchObject({ servidorForaDesde: null, avisouServidorFora: false });
    expect(memoriaAposLeitura(b, "aberta", agora, false).memoria.servidorForaDesde).toBeNull();
  });

  it("avisa uma vez, e só depois de 10 min (soluço não vira alarme)", () => {
    expect(precisaAvisarServidorFora(mem({ servidorForaDesde: antes(3) }), agora)).toBe(false);
    expect(precisaAvisarServidorFora(mem({ servidorForaDesde: antes(12) }), agora)).toBe(true);
    expect(precisaAvisarServidorFora(mem({ servidorForaDesde: antes(12), avisouServidorFora: true }), agora)).toBe(false);
  });

  it("a linha da tela diz que é o servidor, desde que horas (Brasília), não 'tentativas de religar'", () => {
    const t = descreverConexao(mem({ ultimoEstado: "fechada", ultimaQueda: antes(130), tentativas: 2, servidorForaDesde: antes(130) }), agora);
    expect(t).toMatch(/Servidor da Evolution \(sua VPS\) sem responder desde 08:08 \(há 2h\)/);
    expect(t).not.toMatch(/tentativa/);
    expect(descreverConexao(mem({ ultimoEstado: "fechada", ultimaQueda: antes(130), tentativas: 2 }), agora)).toMatch(/tentativa/);
  });

  it("memória gravada antes desta versão (sem os campos novos) continua valendo", () => {
    const velha = JSON.parse(JSON.stringify({ ...MEMORIA_VAZIA, servidorForaDesde: undefined, avisouServidorFora: undefined }));
    const m = { ...MEMORIA_VAZIA, ...velha } as MemoriaVigia;
    expect(precisaAvisarServidorFora(m, agora)).toBe(false);
    expect(descreverConexao(m, agora)).toBe("Ainda não verificado.");
  });
});
