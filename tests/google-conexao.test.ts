// Conexão com o Google (22/10, print dele): a faixa de Clientes mostrava só
// "Token has been expired or revoked." — o Google recusando renovar o acesso
// — sem dizer o que fazer, e o código antigo APAGAVA os tokens ao receber esse
// erro (a conexão sumia calada). Agora a queda vira um estado: o token fica
// gravado com o `problema` e toda tela mostra "reconecte" + o botão.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  diasEntre, ehErroDeReconexao, googleQueVemNaVolta, MENSAGEM_RECONECTAR, pareceModoTeste, PASSOS_PUBLICAR_APP, situacaoGoogle, textosReconectar,
  type ProblemaGoogle, type SituacaoGoogle,
} from "@/lib/google-conexao-regra";

// ── A régua (pura) ───────────────────────────────────────────────────────────

const CONECTOU = "2026-10-08T12:00:00.000Z";
const CAIU_EM_7_DIAS = "2026-10-15T12:30:00.000Z";
const resumo = (p: Partial<{ em: string; ok: boolean; erro: string }> = {}) => ({ em: "2026-10-20T10:00:00.000Z", ok: true, ...p });
const tokens = (p: Partial<{ conectadoEm: string; email: string | null; problema: ProblemaGoogle }> = {}) => ({ conectadoEm: CONECTOU, email: "edy@x.com", ...p });

describe("ehErroDeReconexao", () => {
  it("reconhece o que o Google devolve e a frase gravada no resumo", () => {
    expect(ehErroDeReconexao("invalid_grant")).toBe(true);
    expect(ehErroDeReconexao("Token has been expired or revoked.")).toBe(true);
    expect(ehErroDeReconexao(MENSAGEM_RECONECTAR)).toBe(true);
  });
  it("não confunde com falha de rede ou de permissão", () => {
    expect(ehErroDeReconexao("fetch failed")).toBe(false);
    expect(ehErroDeReconexao("Google Contatos respondeu 500: boom")).toBe(false);
    expect(ehErroDeReconexao("A conta Google conectada só tem permissão de LEITURA dos contatos.")).toBe(false);
    expect(ehErroDeReconexao("Conta Google não conectada.")).toBe(false);
    expect(ehErroDeReconexao(undefined)).toBe(false);
    expect(ehErroDeReconexao("")).toBe(false);
  });
});

describe("pareceModoTeste (o app em teste no Google Cloud vale 7 dias)", () => {
  it("caiu uns 7 dias depois de conectar → é o modo teste", () => {
    expect(pareceModoTeste(CONECTOU, CAIU_EM_7_DIAS)).toBe(true);
    expect(diasEntre(CONECTOU, CAIU_EM_7_DIAS)).toBeCloseTo(7.02, 1);
  });
  it("caiu no dia seguinte ou meses depois → não é", () => {
    expect(pareceModoTeste(CONECTOU, "2026-10-09T12:00:00.000Z")).toBe(false);
    expect(pareceModoTeste(CONECTOU, "2027-03-01T12:00:00.000Z")).toBe(false);
  });
  it("data inválida ou ausente nunca vira palpite", () => {
    expect(pareceModoTeste("lixo", CAIU_EM_7_DIAS)).toBe(false);
    expect(pareceModoTeste(CONECTOU, null)).toBe(false);
    expect(diasEntre(undefined, undefined)).toBeNull();
  });
});

describe("situacaoGoogle", () => {
  it("sem as chaves do Google no ambiente: não configurado", () => {
    expect(situacaoGoogle({ configurado: false, tokens: tokens(), resumo: null }).tipo).toBe("nao_configurado");
  });

  it("configurado, mas nunca conectou: desconectado", () => {
    expect(situacaoGoogle({ configurado: true, tokens: null, resumo: null }).tipo).toBe("desconectado");
  });

  it("conectado e a última rodada deu certo", () => {
    const s = situacaoGoogle({ configurado: true, tokens: tokens(), resumo: resumo() });
    expect(s).toMatchObject({ tipo: "conectado", aguardandoPrimeiraRodada: false });
    expect((s as Extract<SituacaoGoogle, { tipo: "conectado" }>).ultimo?.ok).toBe(true);
  });

  it("conectado e ainda sem rodada nenhuma", () => {
    expect(situacaoGoogle({ configurado: true, tokens: tokens(), resumo: null })).toMatchObject({ tipo: "conectado", ultimo: null, aguardandoPrimeiraRodada: true });
  });

  it("a rodada falhou por outro motivo: continua conectado e MOSTRA o erro", () => {
    const s = situacaoGoogle({ configurado: true, tokens: tokens(), resumo: resumo({ ok: false, erro: "Google Contatos respondeu 500: boom" }) });
    expect(s).toMatchObject({ tipo: "conectado" });
    expect((s as Extract<SituacaoGoogle, { tipo: "conectado" }>).ultimo?.erro).toContain("500");
  });

  it("token com a marca do problema: reconectar (com dias e modo teste)", () => {
    const problema = { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "Token has been expired or revoked." };
    const s = situacaoGoogle({ configurado: true, tokens: tokens({ problema }), resumo: null });
    expect(s).toMatchObject({ tipo: "reconectar", email: "edy@x.com", desde: CAIU_EM_7_DIAS, modoTeste: true });
  });

  it("A CONTA DO PRINT: token sem marca (versão antiga) + última rodada com o erro do Google → reconectar", () => {
    const s = situacaoGoogle({ configurado: true, tokens: tokens(), resumo: resumo({ em: CAIU_EM_7_DIAS, ok: false, erro: "Token has been expired or revoked." }) });
    expect(s).toMatchObject({ tipo: "reconectar", desde: CAIU_EM_7_DIAS, modoTeste: true });
  });

  it("erro de reconexão de ANTES da reconexão é de uma conexão que já morreu: não pinta a tela de vermelho", () => {
    const s = situacaoGoogle({
      configurado: true,
      tokens: tokens({ conectadoEm: "2026-10-21T09:00:00.000Z" }),
      resumo: resumo({ em: "2026-10-20T10:00:00.000Z", ok: false, erro: "Token has been expired or revoked." }),
    });
    expect(s).toMatchObject({ tipo: "conectado", ultimo: null, aguardandoPrimeiraRodada: true });
  });

  it("datas que não dá para comparar NÃO escondem o erro (padrão seguro)", () => {
    const s = situacaoGoogle({ configurado: true, tokens: tokens({ conectadoEm: "lixo" }), resumo: resumo({ ok: false, erro: "Token has been expired or revoked." }) });
    expect(s.tipo).toBe("reconectar");
  });

  it("derruba só quando o erro é de reconexão: 'Conta Google não conectada.' não vira reconectar", () => {
    const s = situacaoGoogle({ configurado: true, tokens: tokens(), resumo: resumo({ ok: false, erro: "Conta Google não conectada." }) });
    expect(s.tipo).toBe("conectado");
  });
});

describe("volta do banco provisório (googleQueVemNaVolta)", () => {
  const caido = JSON.stringify({ refreshToken: "rt-a", problema: { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "x" } });
  const bom = JSON.stringify({ refreshToken: "rt-b", accessToken: "", expiraEm: 0 });
  it("principal caído + provisório funcionando: o do provisório vale", () => {
    expect(googleQueVemNaVolta(caido, bom)).toBe(bom);
  });
  it("principal funcionando: o principal manda, como com toda configuração", () => {
    expect(googleQueVemNaVolta(bom, JSON.stringify({ refreshToken: "rt-c" }))).toBeNull();
  });
  it("provisório também caído, vazio ou sem token: não troca", () => {
    expect(googleQueVemNaVolta(caido, caido)).toBeNull();
    expect(googleQueVemNaVolta(caido, JSON.stringify({ refreshToken: "" }))).toBeNull();
    expect(googleQueVemNaVolta(caido, JSON.stringify({ email: "x" }))).toBeNull();
    expect(googleQueVemNaVolta(caido, null)).toBeNull();
  });
  it("lixo em qualquer lado nunca troca nem lança", () => {
    expect(googleQueVemNaVolta("{não é json", bom)).toBeNull();
    expect(googleQueVemNaVolta(caido, "{não é json")).toBeNull();
    expect(googleQueVemNaVolta(undefined, undefined)).toBeNull();
    expect(googleQueVemNaVolta(JSON.stringify({ problema: "lixo" }), bom)).toBeNull();
  });
});

describe("textos da reconexão", () => {
  it("modo teste: diz o prazo e manda publicar o app", () => {
    const s = situacaoGoogle({ configurado: true, tokens: tokens({ problema: { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "" } }), resumo: null });
    if (s.tipo !== "reconectar") throw new Error("esperava reconectar");
    const t = textosReconectar(s);
    expect(t.titulo).toBe("A conexão com o Google expirou em 15/10");
    expect(t.causa).toMatch(/7 dias depois de conectar/);
    expect(t.causa).toMatch(/publique o app/i);
    expect(t.efeito).toMatch(/Google Agenda/);
  });
  it("sem o padrão dos 7 dias: lista as causas possíveis, sem afirmar uma", () => {
    const s = situacaoGoogle({ configurado: true, tokens: tokens({ problema: { em: "2027-02-01T12:00:00.000Z", codigo: "invalid_grant", descricao: "" } }), resumo: null });
    if (s.tipo !== "reconectar") throw new Error("esperava reconectar");
    const t = textosReconectar(s);
    expect(t.causa).toMatch(/myaccount\.google\.com\/permissions/);
    expect(t.causa).not.toMatch(/depois de conectar/);
  });
  it("não afirma causa que o Google não confirma (senha da conta só derruba token com Gmail, que o CRM não usa)", () => {
    const s = situacaoGoogle({ configurado: true, tokens: tokens({ problema: { em: "2027-02-01T12:00:00.000Z", codigo: "invalid_grant", descricao: "" } }), resumo: null });
    if (s.tipo !== "reconectar") throw new Error("esperava reconectar");
    expect(textosReconectar(s).causa).not.toMatch(/senha/i);
    expect(readFileSync("docs/GOOGLE.md", "utf8")).not.toMatch(/senha da conta mudou/i);
  });
  it("a hipótese do modo de teste é dita como hipótese e deixa uma saída para quem já publicou", () => {
    const s = situacaoGoogle({ configurado: true, tokens: tokens({ problema: { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "" } }), resumo: null });
    if (s.tipo !== "reconectar") throw new Error("esperava reconectar");
    expect(textosReconectar(s).causa).toMatch(/típico de app em modo de teste/);
    expect(textosReconectar(s).causa).toMatch(/Se o app já está publicado/);
  });
  it("os passos para acabar com a queda semanal estão na tela (não só no manual)", () => {
    expect(PASSOS_PUBLICAR_APP).toHaveLength(3);
    expect(PASSOS_PUBLICAR_APP.join(" ")).toMatch(/Publicar app/);
  });
});

// ── O servidor: o token CAÍDO fica guardado, e nada se perde em silêncio ─────

const memoria = new Map<string, string>();
const apagados: string[] = [];
const chamadasVisita = vi.fn();

vi.mock("@/lib/config", () => ({
  getConfig: vi.fn(async (c: string) => memoria.get(c) ?? null),
  setConfig: vi.fn(async (c: string, v: string) => { memoria.set(c, v); }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    configuracao: { deleteMany: vi.fn(async ({ where }: { where: { chave: string } }) => { apagados.push(where.chave); memoria.delete(where.chave); return { count: 1 }; }) },
    visita: { findUnique: chamadasVisita },
    cliente: { findMany: vi.fn(async () => []) },
    municipio: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/area-atuacao", () => ({ lerAreaAtuacao: vi.fn(async () => null), ufDoMunicipioNaArea: vi.fn(() => null) }));
vi.mock("@/lib/area-atuacao-regra", () => ({ AREA_PADRAO: {} }));
vi.mock("@/lib/filtro-contatos", () => ({ deveDescartarContato: vi.fn(async () => false), listarFiltroContatos: vi.fn(async () => []) }));
vi.mock("@/lib/contatos-bloqueados", () => ({
  listarLapides: vi.fn(async () => []), limparContatosIndesejados: vi.fn(async () => ({ apagados: 0 })),
  bloquearContato: vi.fn(), apagarContatoPorTelefone: vi.fn(), desbloquearContato: vi.fn(),
}));

const CHAVE = "google.oauth";
const gravarTokens = (p: Record<string, unknown> = {}) => memoria.set(CHAVE, JSON.stringify({
  refreshToken: "rt-velho", accessToken: "", expiraEm: 0, email: "edy@x.com", conectadoEm: CONECTOU, ...p,
}));
const lerGravado = () => JSON.parse(memoria.get(CHAVE) ?? "null");

const fetchFalso = vi.fn();

beforeEach(() => {
  memoria.clear();
  apagados.length = 0;
  chamadasVisita.mockReset();
  fetchFalso.mockReset();
  vi.stubGlobal("fetch", fetchFalso);
  process.env.GOOGLE_CLIENT_ID = "id-de-teste";
  process.env.GOOGLE_CLIENT_SECRET = "segredo-de-teste";
});

const googleRecusa = () => fetchFalso.mockResolvedValue({ json: async () => ({ error: "invalid_grant", error_description: "Token has been expired or revoked." }) });

describe("o Google recusa renovar (invalid_grant)", () => {
  it("o token FICA gravado, com a marca do problema — antes era apagado e a conexão sumia calada", async () => {
    const g = await import("@/lib/integrations/google");
    gravarTokens();
    googleRecusa();
    await expect(g.excluirEventoAgenda("evt")).rejects.toBeInstanceOf(g.ErroReconectarGoogle);
    expect(apagados).toEqual([]);
    const t = lerGravado();
    expect(t.refreshToken).toBe("rt-velho");
    expect(t.problema).toMatchObject({ codigo: "invalid_grant", descricao: "Token has been expired or revoked." });
    expect(typeof t.problema.em).toBe("string");
  });

  it("a mensagem que vai para a tela é a de reconectar, não o texto cru do Google", async () => {
    const g = await import("@/lib/integrations/google");
    gravarTokens();
    googleRecusa();
    await expect(g.excluirEventoAgenda("evt")).rejects.toThrow(MENSAGEM_RECONECTAR);
  });

  it("depois de marcado, não bate no Google de novo a cada tentativa", async () => {
    const g = await import("@/lib/integrations/google");
    gravarTokens({ problema: { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "x" } });
    await expect(g.excluirEventoAgenda("evt")).rejects.toBeInstanceOf(g.ErroReconectarGoogle);
    await expect(g.excluirEventoAgenda("evt")).rejects.toBeInstanceOf(g.ErroReconectarGoogle);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("a hora da primeira queda não é sobrescrita pelas seguintes (os dias até cair continuam certos)", async () => {
    const g = await import("@/lib/integrations/google");
    gravarTokens({ problema: { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "x" } });
    await g.marcarProblemaGoogle("rt-velho", "invalid_grant", "outra vez");
    expect(lerGravado().problema.em).toBe(CAIU_EM_7_DIAS);
  });

  it("quem usava o token VELHO não marca como caída uma conexão que acabou de ser refeita", async () => {
    const g = await import("@/lib/integrations/google");
    gravarTokens({ refreshToken: "rt-novo" });
    await g.marcarProblemaGoogle("rt-velho", "invalid_grant", "Token has been expired or revoked.");
    expect(lerGravado().problema).toBeUndefined();
  });

  it("falha de rede ou resposta que não é JSON NÃO derruba a conexão (só invalid_grant derruba)", async () => {
    const g = await import("@/lib/integrations/google");
    gravarTokens();
    fetchFalso.mockResolvedValue({ json: async () => { throw new Error("html"); } });
    await expect(g.excluirEventoAgenda("evt")).rejects.toThrow(/renovar o acesso/);
    expect(lerGravado().problema).toBeUndefined();
    fetchFalso.mockRejectedValue(new Error("fetch failed"));
    await expect(g.excluirEventoAgenda("evt")).rejects.toThrow(/fetch failed/);
    expect(lerGravado().problema).toBeUndefined();
  });

  it("outro erro do Google (ex.: invalid_client) não vira 'reconecte': reconectar não resolveria", async () => {
    const g = await import("@/lib/integrations/google");
    gravarTokens();
    fetchFalso.mockResolvedValue({ json: async () => ({ error: "invalid_client", error_description: "The OAuth client was not found." }) });
    await expect(g.excluirEventoAgenda("evt")).rejects.toThrow(/OAuth client/);
    expect(lerGravado().problema).toBeUndefined();
  });
});

describe("reconectar", () => {
  it("o token novo entra SEM a marca do problema", async () => {
    const g = await import("@/lib/integrations/google");
    gravarTokens({ problema: { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "x" } });
    fetchFalso.mockImplementation(async (url: string) => ({
      json: async () => (String(url).includes("userinfo") ? { email: "edy@x.com" } : { access_token: "at-novo", refresh_token: "rt-novo", expires_in: 3600 }),
    }));
    await g.trocarCodigoGoogle("codigo");
    const t = lerGravado();
    expect(t.refreshToken).toBe("rt-novo");
    expect(t.problema).toBeUndefined();
  });

  it("se o Google não devolver refresh token novo, NÃO reaproveita o morto (diria 'conectado' e cairia de novo)", async () => {
    const g = await import("@/lib/integrations/google");
    gravarTokens({ problema: { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "x" } });
    fetchFalso.mockImplementation(async (url: string) => ({
      json: async () => (String(url).includes("userinfo") ? {} : { access_token: "at-novo", expires_in: 3600 }),
    }));
    await expect(g.trocarCodigoGoogle("codigo")).rejects.toThrow(/refresh token/);
    expect(lerGravado().refreshToken).toBe("rt-velho");
    expect(lerGravado().problema).toBeDefined();
  });
});

describe("quem depende do token", () => {
  it("lerTokensGoogle: JSON quebrado ou marca em formato estranho nunca derruba a leitura", async () => {
    const g = await import("@/lib/integrations/google");
    memoria.set(CHAVE, "{não é json");
    expect(await g.lerTokensGoogle()).toBeNull();
    gravarTokens({ problema: "lixo" });
    expect((await g.lerTokensGoogle())?.problema).toBeUndefined();
    gravarTokens({ problema: { em: CAIU_EM_7_DIAS } });
    expect((await g.lerTokensGoogle())?.problema).toMatchObject({ em: CAIU_EM_7_DIAS, codigo: "", descricao: "" });
  });

  it("visita nova com o Google caído: não tenta enviar e não faz barulho (o aviso já está na tela)", async () => {
    const g = await import("@/lib/integrations/google");
    gravarTokens({ problema: { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "x" } });
    await g.sincronizarVisitaComAgenda("v1");
    expect(chamadasVisita).not.toHaveBeenCalled();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("a sincronização de contatos com o Google caído responde 'reconecte' e grava no resumo — não 'Conta não conectada'", async () => {
    const c = await import("@/lib/google-contatos");
    gravarTokens({ problema: { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "x" } });
    expect(await c.googleContatosDisponivel()).toBe(false);
    expect(await c.googlePrecisaReconectar()).toBe(true);
    const r = await c.sincronizarContatosGoogle();
    expect(r).toMatchObject({ ok: false, erro: MENSAGEM_RECONECTAR });
    expect(JSON.parse(memoria.get("google.contatos.ultima")!).erro).toBe(MENSAGEM_RECONECTAR);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("visita removida com o Google caído: não tenta falar com o Google nem faz barulho no log", async () => {
    const g = await import("@/lib/integrations/google");
    gravarTokens({ problema: { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "x" } });
    await g.removerEventoDaVisita("v1");
    expect(chamadasVisita).not.toHaveBeenCalled();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("sem nenhuma conexão: continua dizendo 'Conta Google não conectada.' (não confunde com queda)", async () => {
    const c = await import("@/lib/google-contatos");
    expect(await c.googlePrecisaReconectar()).toBe(false);
    expect((await c.sincronizarContatosGoogle()).erro).toBe("Conta Google não conectada.");
  });

  it("sem GOOGLE_CLIENT_ID/SECRET no ambiente: nada disponível, nada a reconectar", async () => {
    const c = await import("@/lib/google-contatos");
    gravarTokens({ problema: { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "x" } });
    delete process.env.GOOGLE_CLIENT_ID;
    expect(await c.googleContatosDisponivel()).toBe(false);
    expect(await c.googlePrecisaReconectar()).toBe(false);
  });

  it("lerSituacaoGoogle junta token e resumo: a conta do print vira 'reconectar'", async () => {
    const c = await import("@/lib/google-contatos");
    gravarTokens();
    memoria.set("google.contatos.ultima", JSON.stringify({ em: CAIU_EM_7_DIAS, ok: false, erro: "Token has been expired or revoked.", lidos: 0 }));
    expect((await c.lerSituacaoGoogle()).tipo).toBe("reconectar");
  });
});

describe("o cron de hora em hora", () => {
  it("com a conexão caída responde 200 'precisa reconectar' — não é defeito do servidor", async () => {
    vi.doMock("@/lib/whatsapp-settings", () => ({ cronAutorizado: () => true }));
    const { GET } = await import("@/app/api/cron/google-contatos/route");
    gravarTokens({ problema: { em: CAIU_EM_7_DIAS, codigo: "invalid_grant", descricao: "x" } });
    const res = await GET({} as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, pulado: "google precisa ser reconectado" });
  });

  it("a rodada que DESCOBRE a queda (token ainda sem marca) também responde 200", async () => {
    vi.doMock("@/lib/whatsapp-settings", () => ({ cronAutorizado: () => true }));
    const { GET } = await import("@/app/api/cron/google-contatos/route");
    gravarTokens();
    googleRecusa();
    const res = await GET({} as never);
    expect(res.status).toBe(200);
    expect(lerGravado().problema).toBeDefined();
  });
});

// ── Quem lê o estado novo (regra 1: estado novo, caminhos antigos) ───────────

describe("as telas que dependem do estado", () => {
  const ler = (p: string) => readFileSync(p, "utf8");
  it("faixa de Clientes, card de Configurações e aviso de Visitas leem a MESMA situação", () => {
    expect(ler("src/app/(app)/clientes/page.tsx")).toMatch(/lerSituacaoGoogle\(/);
    expect(ler("src/app/(app)/configuracoes/page.tsx")).toMatch(/lerSituacaoGoogle\(/);
    expect(ler("src/app/(app)/visitas/page.tsx")).toMatch(/lerSituacaoGoogle\(/);
    expect(ler("src/app/(app)/visitas/page.tsx")).toMatch(/<AvisoGoogleReconectar/);
  });
  it("o botão 'Reconectar' leva ao OAuth, não a uma tela que só explica", () => {
    for (const f of ["src/components/GoogleContatosSync.tsx", "src/components/GoogleIntegracaoCard.tsx", "src/components/AvisoGoogleReconectar.tsx"]) {
      expect(ler(f)).toMatch(/href="\/api\/google\/auth"/);
    }
  });
  it("as ações que mudam o estado atualizam Clientes e Visitas", () => {
    const a = ler("src/lib/google-actions.ts");
    expect(a).toMatch(/"\/visitas"/);
    expect(a.match(/"\/clientes"/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("a volta do Google (callback) e o botão sem chaves levam para o card (#google), não para o topo de Configurações", () => {
    expect(ler("src/app/api/google/callback/route.ts")).toMatch(/\/configuracoes#google/);
    expect(ler("src/app/api/google/auth/route.ts")).toMatch(/\/configuracoes#google/);
    expect(ler("src/components/GoogleIntegracaoCard.tsx")).toMatch(/id="google" className="scroll-mt-24"/);
  });
  it("a rodada mais nova vence: o resultado do clique não esconde uma falha que o cron gravou depois", () => {
    expect(ler("src/components/GoogleContatosSync.tsx")).toMatch(/resultado\.em >= situacao\.ultimo\.em/);
    expect(ler("src/components/GoogleIntegracaoCard.tsx")).toMatch(/resultado\.em >= daPagina\.em/);
  });
  it("a volta do banco provisório usa a regra do token caído", () => {
    expect(ler("src/lib/trazer-provisorio.ts")).toMatch(/googleQueVemNaVolta\(/);
  });
  it("o aviso de Visitas diz o que NÃO volta sozinho depois de reconectar", () => {
    expect(ler("src/components/AvisoGoogleReconectar.tsx")).toMatch(/não entram sozinhas na Agenda depois de reconectar/);
  });
  it("o código não volta a apagar o token por invalid_grant", () => {
    expect(ler("src/lib/integrations/google.ts")).not.toMatch(/invalid_grant"\)\s*await db\.configuracao\.deleteMany/);
  });
  it("a faixa e o card avisam quando a ação falha (não ficam mudos)", () => {
    expect(ler("src/components/GoogleContatosSync.tsx")).toMatch(/Não consegui falar com o servidor/);
    expect(ler("src/components/GoogleIntegracaoCard.tsx")).toMatch(/Não consegui falar com o servidor/);
  });
});
