import { describe, it, expect } from "vitest";
import {
  telaGuardavel, telaSaudavel, ehCopia, nomeDaTela, ordenarTelas, horaCurta, quandoFoi, avisoDoDesvio, mudaAsCopias, acaoMudouDado, fichasDoQueSubiu,
  TELAS_PRINCIPAIS, COPIA_DEPOIS_DE_MS, MARCA_TELA_OK, SUBIDA_SEM_SINAL,
} from "@/lib/sem-sinal-telas";
import { novoRegistro, type RegistroFila } from "@/lib/sem-sinal-regra";

const H = 3_600_000;
// 28/09/2026 15:00 em Brasília (18:00 UTC).
const AGORA = Date.parse("2026-09-28T18:00:00Z");

describe("telas guardadas para ler sem sinal", () => {
  it("guarda as telas do CRM e a ficha do cliente", () => {
    for (const t of TELAS_PRINCIPAIS) expect(telaGuardavel(t)).toBe(true);
    expect(telaGuardavel("/clientes/cl_123")).toBe(true);
    expect(telaGuardavel("/negociacoes/abc/proposta")).toBe(true);
    expect(telaGuardavel("/maquinas/fichas")).toBe(true);
  });

  it("não guarda o que é ao vivo, de sistema ou não é tela", () => {
    for (const t of ["/atendimento", "/atendimento/relatorio", "/conexao", "/configuracoes", "/cerebro", "/zeus", "/auditoria",
      "/login", "/sem-sinal", "/api/sem-sinal/pacote", "/_next/static/x.js", "/config-necessaria", "/", ""]) {
      expect(telaGuardavel(t), t).toBe(false);
    }
  });

  it("não confunde prefixo com tela: /zeuss não é /zeus", () => {
    expect(telaGuardavel("/zeuss")).toBe(true);
    expect(telaGuardavel("/apis")).toBe(true);
  });

  it("só a tela que veio inteira vira cópia", () => {
    const boa = `<html><body><h1>Clientes</h1><span hidden="" ${MARCA_TELA_OK}></span></body></html>`;
    expect(telaSaudavel(boa)).toBe(true);
    // Banco fora do ar: o layout não põe a marca.
    expect(telaSaudavel("<html><body><h1>O banco não respondeu</h1></body></html>")).toBe(false);
    // Um pedaço da tela caiu no servidor.
    expect(telaSaudavel(boa.replace("</body>", '<script>$RX=function(b,c){}</script></body>'))).toBe(false);
    expect(telaSaudavel(boa.replace("</body>", '<template data-dgst="123"></template></body>'))).toBe(false);
  });

  it("o mapa que só desenha no navegador e o script do React não são erro", () => {
    const boa = `<html><body><h1>Dashboard</h1><span hidden="" ${MARCA_TELA_OK}></span></body></html>`;
    // Visto no Dashboard de verdade: o mapa usa a marca de "deixado para o navegador".
    expect(telaSaudavel(boa.replace("</h1>", '</h1><!--$!--><template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"></template>'))).toBe(true);
    // Visto nos Alertas: o script que troca os pedaços cita data-dgst.
    expect(telaSaudavel(boa.replace("</body>", '<script>$RC=function(b,c,e){if(e)b.data="$!",a.setAttribute("data-dgst",e)}</script></body>'))).toBe(true);
  });

  it("reconhece a cópia pela hora em que foi montada", () => {
    expect(ehCopia(AGORA - 2 * H, AGORA)).toBe(true);
    expect(ehCopia(AGORA - COPIA_DEPOIS_DE_MS - 1, AGORA)).toBe(true);
    // Recém-montada (ou relógio do celular um pouco adiantado): não é cópia.
    expect(ehCopia(AGORA - 60_000, AGORA)).toBe(false);
    // Montada DEPOIS de o aparelho pedir (o normal): não é cópia.
    expect(ehCopia(AGORA + 3_000, AGORA)).toBe(false);
    expect(ehCopia(undefined, AGORA)).toBe(false);
    expect(ehCopia(Number.NaN, AGORA)).toBe(false);
  });

  it("dá nome de gente para a tela", () => {
    expect(nomeDaTela("/dashboard")).toBe("Dashboard");
    expect(nomeDaTela("/pipeline")).toBe("Demandas");
    expect(nomeDaTela("/clientes/abc", "João da Pedreira")).toBe("João da Pedreira");
    expect(nomeDaTela("/clientes/abc", "  ")).toBe("/clientes/abc");
  });

  it("põe as principais primeiro, na ordem do menu, e as avulsas da mais nova", () => {
    const t = (caminho: string, guardadaEm: number) => ({ caminho, nome: caminho, guardadaEm, principal: TELAS_PRINCIPAIS.includes(caminho) });
    const ordem = ordenarTelas([t("/clientes/a", 1), t("/clientes", 5), t("/clientes/b", 9), t("/dashboard", 2)]).map((x) => x.caminho);
    expect(ordem).toEqual(["/dashboard", "/clientes", "/clientes/b", "/clientes/a"]);
  });

  it("escreve a hora da cópia no fuso dele", () => {
    expect(horaCurta(AGORA - 2 * H, AGORA)).toBe("13:00");
    expect(horaCurta(AGORA - 24 * H, AGORA)).toBe("ontem");
    expect(horaCurta(AGORA - 72 * H, AGORA)).toBe("25/09");
    expect(horaCurta(0, AGORA)).toBe("?");
    expect(quandoFoi(AGORA - 2 * H, AGORA)).toBe("hoje às 13:00");
    expect(quandoFoi(new Date(AGORA - 24 * H).toISOString(), AGORA)).toBe("ontem às 15:00");
  });

  it("diz por que a tela veio parar no modo sem sinal", () => {
    expect(avisoDoDesvio("sem-copia", "/clientes")).toBe("“Clientes” ainda não tem cópia neste aparelho. Ela fica guardada quando você a abre com internet.");
    expect(avisoDoDesvio("nao-guarda", "/atendimento")).toBe("“WhatsApp” só funciona com internet — ela não fica guardada no aparelho.");
    expect(avisoDoDesvio("sem-copia", "/clientes/abc?x=1")).toMatch(/^Essa tela ainda não tem cópia/);
    // Veio pelo botão "abrir modo sem sinal": nada a explicar.
    expect(avisoDoDesvio(null, "/clientes")).toBeNull();
    expect(avisoDoDesvio("sem-copia", null)).toBeNull();
    expect(avisoDoDesvio("qualquer", "/clientes")).toBeNull();
  });
  it("o que grava numa tela do CRM deixa as cópias velhas; o que grava ao vivo ou só relata, não", () => {
    // Ação da tela de Negociações (arrastar card) e rota chamada da ficha.
    expect(mudaAsCopias("/negociacoes", "/negociacoes")).toBe(true);
    expect(mudaAsCopias("/api/demandas/audio", "/pipeline")).toBe(true);
    expect(mudaAsCopias("/visitas", null)).toBe(true);
    // A subida do modo sem sinal sai de /sem-sinal, que não é cópia — e conta.
    expect(mudaAsCopias(SUBIDA_SEM_SINAL, "/sem-sinal")).toBe(true);
    expect(mudaAsCopias(SUBIDA_SEM_SINAL, null)).toBe(true);
    // WhatsApp, Configurações e login: ao vivo, não mexem nas telas guardadas.
    expect(mudaAsCopias("/api/conversations/1/messages", "/atendimento")).toBe(false);
    expect(mudaAsCopias("/configuracoes", "/configuracoes")).toBe(false);
    expect(mudaAsCopias("/login", "/login")).toBe(false);
    // Relatório de erro, aviso no celular e sessão: gravam, mas não mudam tela.
    expect(mudaAsCopias("/api/zeus/report-erro", "/dashboard")).toBe(false);
    expect(mudaAsCopias("/api/push/subscribe", "/dashboard")).toBe(false);
    expect(mudaAsCopias("/api/auth/restaurar", "/negociacoes")).toBe(false);
  });
  it("ação da tela só conta quando o Next diz que ela mandou refazer telas", () => {
    expect(acaoMudouDado("[[],1,0]")).toBe(true);
    expect(acaoMudouDado("[[],1,1]")).toBe(true);
    // Só leu (visitas do dia ao abrir o app) ou só trocou cookie (tema): não.
    expect(acaoMudouDado("[[],0,0]")).toBe(false);
    expect(acaoMudouDado("[[],0,1]")).toBe(false);
    // Sem cabeçalho ou formato desconhecido: fica a renovação de hora em hora.
    expect(acaoMudouDado(null)).toBe(false);
    expect(acaoMudouDado("")).toBe(false);
    expect(acaoMudouDado("lixo")).toBe(false);
    expect(acaoMudouDado("{\"revalidou\":1}")).toBe(false);
  });
  it("depois de subir, as fichas dos clientes do que subiu são renovadas (uma vez cada)", () => {
    const base = { criadaEm: "2026-09-28T10:00:00Z", clienteNome: "X" };
    const sub = (r: RegistroFila, estado: RegistroFila["estado"]) => ({ ...r, estado });
    const fila = [
      sub(novoRegistro({ ...base, tipo: "negociacao.criar", id: "o1", negociacaoId: "n1", clienteId: "c1", marca: null, maquinaModelo: null, valor: null, estagio: "A", proximaAcao: null }), "enviado"),
      sub(novoRegistro({ ...base, tipo: "visita.agendar", id: "o2", visitaId: "v1", clienteId: "c1", data: "2026-09-29", horario: null, cidade: null, observacao: null }), "enviado"),
      sub(novoRegistro({ ...base, tipo: "visita.agendar", id: "o3", visitaId: "v2", clienteId: "c2", data: "2026-09-29", horario: null, cidade: null, observacao: null }), "enviado"),
      // Recusada não mudou nada no CRM; concluir visita não diz o cliente (Visitas é principal).
      sub(novoRegistro({ ...base, tipo: "negociacao.criar", id: "o4", negociacaoId: "n2", clienteId: "c3", marca: null, maquinaModelo: null, valor: null, estagio: "A", proximaAcao: null }), "erro"),
      sub(novoRegistro({ ...base, tipo: "visita.concluir", id: "o5", visitaId: "v1", feita: true, relato: "" }), "enviado"),
    ];
    expect(fichasDoQueSubiu(fila)).toEqual(["/clientes/c1", "/clientes/c2"]);
    expect(fichasDoQueSubiu([])).toEqual([]);
  });
});
