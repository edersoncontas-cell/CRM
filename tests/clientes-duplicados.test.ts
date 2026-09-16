import { describe, it, expect } from "vitest";
import { agruparDuplicados, chaveTelefone, chaveNome, escolherQuemFica, mesclarCampos, type ClienteParaDedup, type CamposMesclaveis } from "../src/lib/clientes-duplicados-regra";
import { planejarSincronizacao } from "../src/lib/google-contatos-util";

const d = (s: string) => new Date(s);
function cli(p: Partial<ClienteParaDedup> & { id: string; nome: string }): ClienteParaDedup {
  return { telefone: null, googleContatoId: null, googleSincronizadoEm: null, origem: null, criadoEm: d("2026-01-01"), ...p };
}

describe("chaves de duplicidade", () => {
  it("telefone: mesmo número em qualquer formato dá a mesma chave", () => {
    expect(chaveTelefone("+55 (28) 99975-7080")).toBe("2899757080");
    expect(chaveTelefone("28999757080")).toBe("2899757080");
    expect(chaveTelefone("5528999757080")).toBe("2899757080");
    expect(chaveTelefone("2899757080")).toBe("2899757080");
    expect(chaveTelefone(null)).toBeNull();
    expect(chaveTelefone("123")).toBeNull();
  });

  it("nome: ignora acento, caixa e pontuação; genérico e curto não valem", () => {
    expect(chaveNome("AGRO terraplanagem")).toBe("agro terraplanagem");
    expect(chaveNome("Agro-Terraplanagem ")).toBe("agro terraplanagem");
    expect(chaveNome("Contato 12")).toBeNull();
    expect(chaveNome("+55 28 99999-0000")).toBeNull();
    expect(chaveNome("Jo")).toBeNull();
  });
});

describe("agruparDuplicados", () => {
  it("agrupa por telefone e por nome, fechando por transitividade; o do Google fica", () => {
    const grupos = agruparDuplicados([
      cli({ id: "a", nome: "Vanildo Gabriel", telefone: "28999990001", criadoEm: d("2025-01-01") }),
      cli({ id: "b", nome: "Vanildo Gabriel", telefone: "5528999990001", googleContatoId: "people/1", origem: "google", criadoEm: d("2026-09-15") }),
      cli({ id: "c", nome: "Vanildo G.", telefone: "2899990001", criadoEm: d("2025-06-01") }),
      cli({ id: "d", nome: "Outro Cliente", telefone: "28988880000" }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].fica.id).toBe("b");
    expect(grupos[0].somem.map((s) => s.id)).toEqual(["a", "c"]);
    expect(grupos[0].motivo).toBe("telefone");
  });

  it("sem Google no grupo fica o mais antigo; com dois do Google fica o sincronizado por último", () => {
    expect(escolherQuemFica([
      cli({ id: "novo", nome: "X", criadoEm: d("2026-02-01") }),
      cli({ id: "velho", nome: "X", criadoEm: d("2025-02-01") }),
    ]).id).toBe("velho");
    expect(escolherQuemFica([
      cli({ id: "g1", nome: "X", googleContatoId: "people/1", googleSincronizadoEm: d("2026-09-01"), criadoEm: d("2025-01-01") }),
      cli({ id: "g2", nome: "X", googleContatoId: "people/2", googleSincronizadoEm: d("2026-09-10"), criadoEm: d("2026-01-01") }),
    ]).id).toBe("g2");
  });

  it("mesmo nome com números diferentes são pessoas diferentes: ficam os dois", () => {
    const grupos = agruparDuplicados([
      cli({ id: "w1", nome: "Welinton", telefone: "28999596070", googleContatoId: "people/1" }),
      cli({ id: "w2", nome: "welinton", telefone: "27998356747", googleContatoId: "people/2" }),
    ]);
    expect(grupos).toHaveLength(0);
  });

  it("mesmo nome, um sem telefone: junta e fica o que tem número (mesmo que não seja do Google)", () => {
    const grupos = agruparDuplicados([
      cli({ id: "sem", nome: "AGRO terraplanagem", googleContatoId: "people/9", criadoEm: d("2025-01-01") }),
      cli({ id: "com", nome: "AGRO Terraplanagem", telefone: "28999757080", criadoEm: d("2026-01-01") }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].fica.id).toBe("com");
    expect(grupos[0].somem.map((s) => s.id)).toEqual(["sem"]);
    expect(grupos[0].motivo).toBe("nome");
  });

  it("sem telefone e dois xarás com números diferentes: só junta ao que tem o nome exatamente igual; na dúvida não mexe", () => {
    const grupos = agruparDuplicados([
      cli({ id: "g1", nome: "·.¸¸♫♪♪ Welinton ♫♪♪·. 🌻", telefone: "28999596070", googleContatoId: "people/1" }),
      cli({ id: "c1", nome: "·.¸¸♫♪♪ Welinton ♫♪♪·. 🌻" }),
      cli({ id: "c2", nome: "welinton" }),
      cli({ id: "g2", nome: "welinton", telefone: "27998356747", googleContatoId: "people/2" }),
      cli({ id: "c3", nome: "WELINTON" }),
    ]);
    expect(grupos).toHaveLength(2);
    const porFica = Object.fromEntries(grupos.map((g) => [g.fica.id, g.somem.map((s) => s.id)]));
    expect(porFica).toEqual({ g1: ["c1"], g2: ["c2", "c3"] });
  });

  it("nome genérico não agrupa; cadastro sem par fica em paz", () => {
    const grupos = agruparDuplicados([
      cli({ id: "a", nome: "Contato 1", telefone: "28999990001" }),
      cli({ id: "b", nome: "Contato 2", telefone: "28999990002" }),
      cli({ id: "c", nome: "Arthur Klein", telefone: "27992675516" }),
    ]);
    expect(grupos).toHaveLength(0);
  });
});

describe("mesclarCampos", () => {
  const base: CamposMesclaveis = {
    telefone: null, email: null, endereco: null, municipioId: null, perfilIA: null, origem: "google", jaComprou: false, visitado: false,
    fotoUrl: null, observacoes: null, ultimoContato: null, aguardandoResposta: false, perfilDISC: null, abordagemIA: null, dataCompra: null,
    maquinaComprada: null, interesseFuturo: false, interesseFuturoData: null, interesseFuturoNota: null, status: "potencial", proximaVisita: null,
    proximaVisitaNota: null, resumoMaquinas: null, resumoValor: null, resumoEntrada: null, resumoCondicao: null, resumoTexto: null, leadScore: 50,
    leadScoreAtualizadoEm: null, googleContatoId: "people/1", googleSincronizadoEm: null, indicadoPorId: null,
  };

  it("preenche só o que falta, junta observações e promove flags/status/score", () => {
    const patch = mesclarCampos(
      { ...base, telefone: "28999990001", observacoes: "Já visitei." },
      { ...base, telefone: "28988880000", email: "v@x.com", municipioId: "m1", jaComprou: true, status: "cliente", leadScore: 80,
        leadScoreAtualizadoEm: d("2026-09-01"), observacoes: "Tem retro velha.", ultimoContato: d("2026-09-10"), googleContatoId: null },
    );
    expect(patch.telefone).toBeUndefined();
    expect(patch.email).toBe("v@x.com");
    expect(patch.municipioId).toBe("m1");
    expect(patch.jaComprou).toBe(true);
    expect(patch.status).toBe("cliente");
    expect(patch.leadScore).toBe(80);
    expect(patch.observacoes).toBe("Já visitei.\n\nTem retro velha.");
    expect(patch.ultimoContato).toEqual(d("2026-09-10"));
    expect(patch.googleContatoId).toBeUndefined();
  });

  it("não rebaixa status nem duplica observação igual", () => {
    const patch = mesclarCampos({ ...base, status: "cliente", observacoes: "x" }, { ...base, status: "nao_cliente", observacoes: "x" });
    expect(patch).toEqual({});
  });
});

describe("sincronização do Google não duplica mais por nome", () => {
  it("contato do Google com o mesmo nome de um cadastro sem telefone liga a ele e completa o telefone", () => {
    const plano = planejarSincronizacao(
      [{ id: "people/9", nome: "AGRO Terraplanagem", telefones: ["5528999757080"], emails: [], enderecos: [], empresa: null }],
      [{ id: "c1", nome: "AGRO terraplanagem", telefone: null, email: null, endereco: null, municipioId: null, origem: null, googleContatoId: null }],
      [],
    );
    expect(plano.criar).toHaveLength(0);
    expect(plano.atualizar).toEqual([{ id: "c1", dados: { googleContatoId: "people/9", telefone: "28999757080" } }]);
  });

  it("mesmo nome com outro telefone no CRM é outra pessoa: cria o contato do Google separado", () => {
    const plano = planejarSincronizacao(
      [{ id: "people/2", nome: "Welinton", telefones: ["5527998356747"], emails: [], enderecos: [], empresa: null }],
      [{ id: "w1", nome: "Welinton", telefone: "28999596070", email: null, endereco: null, municipioId: null, origem: null, googleContatoId: "people/1" }],
      [],
    );
    expect(plano.atualizar).toHaveLength(0);
    expect(plano.criar).toHaveLength(1);
    expect(plano.criar[0].telefone).toBe("27998356747");
  });
});
