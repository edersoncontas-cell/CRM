import { describe, expect, it } from "vitest";
import { distanciaKm, sugerirDiaVisita, descreverSugestaoVisita, resumirAgenda } from "../src/lib/zeus/agenda-proximidade";

// Sul do ES (aproximado)
const guacui = { lat: -20.7756, lng: -41.6789 };
const alegre = { lat: -20.7636, lng: -41.5325 };
const cachoeiro = { lat: -20.8489, lng: -41.1128 };
const vitoria = { lat: -20.3155, lng: -40.3128 };

const agora = new Date("2026-09-20T12:00:00Z"); // domingo 20/09 09:00 em Brasília
const em = (dia: number, hora = 13) => new Date(Date.UTC(2026, 8, dia, hora, 0, 0)); // 10h em Brasília

describe("distanciaKm", () => {
  it("haversine razoável para o sul do ES", () => {
    expect(distanciaKm(guacui, alegre)).toBeGreaterThan(10);
    expect(distanciaKm(guacui, alegre)).toBeLessThan(25);
    expect(distanciaKm(guacui, vitoria)).toBeGreaterThan(130);
    expect(distanciaKm(guacui, guacui)).toBe(0);
  });
});

describe("sugerirDiaVisita", () => {
  const visitas = [
    { data: em(21), cidade: "Vitória", ponto: vitoria },
    { data: em(22), cidade: "Alegre", ponto: alegre },
    { data: em(22, 16), cidade: "Cachoeiro de Itapemirim", ponto: cachoeiro },
    { data: em(24), cidade: "Cachoeiro de Itapemirim", ponto: cachoeiro },
  ];

  it("escolhe o dia em que alguma visita marcada fica mais perto do cliente", () => {
    const s = sugerirDiaVisita(guacui, visitas, agora)!;
    expect(s.cidade).toBe("Alegre");
    expect(s.visitasNoDia).toBe(2);
    expect(s.data.toISOString()).toBe(em(22).toISOString());
  });

  it("ignora visitas fora da janela (passado ou além de 14 dias)", () => {
    const s = sugerirDiaVisita(guacui, [
      { data: em(10), cidade: "Alegre", ponto: alegre },      // passado
      { data: em(30, 13), cidade: "Alegre", ponto: alegre },  // 10 dias: dentro
      { data: new Date("2026-10-20T13:00:00Z"), cidade: "Alegre", ponto: alegre }, // 30 dias: fora
    ], agora)!;
    expect(s.data.toISOString()).toBe(em(30, 13).toISOString());
  });

  it("empate de distância → dia mais cedo; sem cidade do cliente ou sem visita georreferenciada → null", () => {
    const s = sugerirDiaVisita(guacui, [{ data: em(25), cidade: "Alegre", ponto: alegre }, { data: em(23), cidade: "Alegre", ponto: alegre }], agora)!;
    expect(s.data.toISOString()).toBe(em(23).toISOString());
    expect(sugerirDiaVisita(null, visitas, agora)).toBeNull();
    expect(sugerirDiaVisita(guacui, [{ data: em(22), cidade: "Sem coordenada", ponto: null }], agora)).toBeNull();
  });
});

describe("textos", () => {
  it("descreve o dia com cidade e distância, e reconhece mesma cidade", () => {
    const s = sugerirDiaVisita(guacui, [{ data: em(22), cidade: "Alegre", ponto: alegre }], agora)!;
    expect(descreverSugestaoVisita(s, "Guaçuí")).toMatch(/^terça 22\/09 — você já estará em Alegre \(≈\d+ km de Guaçuí\)$/);
    const mesma = sugerirDiaVisita(guacui, [{ data: em(22), cidade: "Guaçuí", ponto: guacui }], agora)!;
    expect(descreverSugestaoVisita(mesma, "Guaçuí")).toBe("terça 22/09 — você já estará na mesma cidade (Guaçuí)");
  });

  it("resume a agenda por dia agrupando cidades", () => {
    const linhas = resumirAgenda([
      { data: em(22), cidade: "Alegre", ponto: alegre },
      { data: em(22, 16), cidade: "Alegre", ponto: alegre },
      { data: em(22, 18), cidade: "Cachoeiro de Itapemirim", ponto: cachoeiro },
      { data: em(24), cidade: "Vitória", ponto: vitoria },
    ], agora);
    expect(linhas).toEqual(["terça 22/09: Alegre (2), Cachoeiro de Itapemirim", "quinta 24/09: Vitória"]);
  });
});
