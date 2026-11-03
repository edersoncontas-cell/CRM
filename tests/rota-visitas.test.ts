// MELHOR ROTA DO DIA (03/11). A conta é em linha reta — o que se prova aqui é
// que a ordem sugerida é a que anda menos, e que o link do Maps leva a ordem.

import { describe, expect, it } from "vitest";
import { distanciaKm, kmDoTrajeto, melhorRota, linkGoogleMaps, paradasForaDoLink, MAX_PARADAS_LINK, kmPorExtenso } from "@/lib/rota-visitas";
import { coordenadasMunicipioES } from "@/lib/municipios-es";

const c = (nome: string) => { const p = coordenadasMunicipioES(nome); if (!p) throw new Error(nome); return p; };

describe("distância em linha reta", () => {
  it("zero no mesmo ponto, simétrica", () => {
    const a = c("Vitória"), b = c("Cachoeiro de Itapemirim");
    expect(distanciaKm(a, a)).toBe(0);
    expect(distanciaKm(a, b)).toBeCloseTo(distanciaKm(b, a), 9);
  });

  it("Vitória → Cachoeiro dá entre 80 e 120 km em linha reta", () => {
    const d = distanciaKm(c("Vitória"), c("Cachoeiro de Itapemirim"));
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(120);
  });
});

describe("melhor rota", () => {
  it("sem visita: nada", () => {
    expect(melhorRota(c("Vitória"), [], false)).toEqual({ ordem: [], km: 0, exata: true });
  });

  it("saindo de Cachoeiro, passa por Castelo antes de Venda Nova (em vez do vai-e-volta)", () => {
    const pontos = [c("Venda Nova do Imigrante"), c("Castelo")];
    const r = melhorRota(c("Cachoeiro de Itapemirim"), pontos, false);
    expect(r.ordem).toEqual([1, 0]);
  });

  it("a ordem sugerida nunca anda mais que a ordem dos horários (força bruta confere)", () => {
    const nomes = ["Alegre", "Guaçuí", "Iúna", "Muniz Freire", "Castelo", "Vargem Alta", "Marataízes"];
    const pontos = nomes.map(c);
    for (const voltar of [false, true]) {
      const r = melhorRota(c("Cachoeiro de Itapemirim"), pontos, voltar);
      expect(r.exata).toBe(true);
      expect(new Set(r.ordem).size).toBe(pontos.length);
      expect(r.km).toBeLessThanOrEqual(kmDoTrajeto(c("Cachoeiro de Itapemirim"), pontos, pontos.map((_, i) => i), voltar) + 1e-9);
    }
  });

  it("acima de 8 paradas usa a aproximação, visita todas e não piora a ordem dos horários", () => {
    const nomes = ["Alegre", "Guaçuí", "Iúna", "Muniz Freire", "Castelo", "Vargem Alta", "Marataízes", "Piúma", "Anchieta", "Iconha"];
    const pontos = nomes.map(c);
    const o = c("Cachoeiro de Itapemirim");
    const r = melhorRota(o, pontos, true);
    expect(r.exata).toBe(false);
    expect([...r.ordem].sort((a, b) => a - b)).toEqual(pontos.map((_, i) => i));
    expect(r.km).toBeLessThanOrEqual(kmDoTrajeto(o, pontos, pontos.map((_, i) => i), true) + 1e-9);
  });

  it("duas visitas na mesma cidade ficam juntas", () => {
    const pontos = [c("Alegre"), c("Vitória"), c("Alegre")];
    const r = melhorRota(c("Cachoeiro de Itapemirim"), pontos, false);
    const posAlegre = r.ordem.map((i, pos) => (i !== 1 ? pos : -1)).filter((x) => x >= 0);
    expect(Math.abs(posAlegre[0] - posAlegre[1])).toBe(1);
  });

  it("ida e volta soma a volta para a origem", () => {
    const o = c("Cachoeiro de Itapemirim"), pontos = [c("Vitória")];
    expect(melhorRota(o, pontos, true).km).toBeCloseTo(2 * distanciaKm(o, pontos[0]), 6);
  });
});

describe("link do Google Maps", () => {
  const o = { lat: -20.85, lng: -41.11 };
  const p = [{ lat: -20.76, lng: -41.53 }, { lat: -20.6, lng: -41.2 }];

  it("só ida: destino é a última parada, a primeira vai no meio", () => {
    const u = new URL(linkGoogleMaps(o, p, false)!);
    expect(u.origin + u.pathname).toBe("https://www.google.com/maps/dir/");
    expect(u.searchParams.get("origin")).toBe("-20.85000,-41.11000");
    expect(u.searchParams.get("destination")).toBe("-20.60000,-41.20000");
    expect(u.searchParams.get("waypoints")).toBe("-20.76000,-41.53000");
    expect(u.searchParams.get("travelmode")).toBe("driving");
  });

  it("ida e volta: destino é a origem e as paradas todas vão no meio, na ordem", () => {
    const u = new URL(linkGoogleMaps(o, p, true)!);
    expect(u.searchParams.get("destination")).toBe("-20.85000,-41.11000");
    expect(u.searchParams.get("waypoints")).toBe("-20.76000,-41.53000|-20.60000,-41.20000");
  });

  it("sem parada: sem link", () => {
    expect(linkGoogleMaps(o, [], false)).toBeNull();
  });

  it("mais de 9 paradas no meio: o link corta e a tela é avisada de quantas ficaram de fora", () => {
    const muitas = Array.from({ length: 12 }, (_, i) => ({ lat: -20 - i / 10, lng: -41 }));
    const u = new URL(linkGoogleMaps(o, muitas, true)!);
    expect(u.searchParams.get("waypoints")!.split("|")).toHaveLength(MAX_PARADAS_LINK);
    expect(paradasForaDoLink(12, true)).toBe(3);
    expect(paradasForaDoLink(10, false)).toBe(0);
    expect(paradasForaDoLink(3, false)).toBe(0);
  });

  it("km por extenso", () => {
    expect(kmPorExtenso(1234.6)).toBe("1.235 km");
  });
});
