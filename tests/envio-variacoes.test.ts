import { describe, it, expect } from "vitest";
import {
  juntarVariacoes, textosDoEnvio, versaoDoCliente, textoParaCliente, resumoDoEnvio, MAX_VARIACOES, MARCA_VARIACAO,
} from "@/lib/envio-variacoes";
import { trechosDoDisparo, ehDeAlgumTrecho, trechoInvariante } from "@/lib/limpeza-falhadas";
import { comRodapeDeSaida } from "@/lib/envio-limites";
import { personalizarTexto } from "@/lib/abordagem-cidade-regra";

const V1 = "Oi {nome}, chegou retroescavadeira nova na loja com taxa zero.";
const V2 = "Bom dia {nome}! A B95C está com taxa zero até o fim do mês, quer ver?";
const V3 = "{nome}, condição especial: retro New Holland com taxa zero este mês.";

describe("texto de uma versão só continua exatamente como antes", () => {
  it("sem a marca, é uma versão só e o texto não muda", () => {
    expect(textosDoEnvio(V1)).toEqual([V1]);
    expect(juntarVariacoes([V1, "", ""])).toBe(V1);
    expect(versaoDoCliente(V1, "qualquer")).toEqual({ texto: V1, numero: 1, total: 1 });
  });
  it("o que o cliente recebe é o mesmo de antes das versões (rodapé + nome)", () => {
    const antes = personalizarTexto(comRodapeDeSaida(V1), "joão da silva");
    expect(textoParaCliente(V1, { id: "c1", nome: "joão da silva" })).toBe(antes);
  });
  it("envio só com anexo continua levando a saída (responda SAIR) na legenda", () => {
    expect(textoParaCliente("", { id: "c1", nome: "joão" })).toMatch(/responda SAIR/);
  });
});

describe("até 3 versões", () => {
  it("junta, tira vazias e repetidas (ignorando espaços e maiúsculas), limita a 3", () => {
    const t = juntarVariacoes([V1, " " + V1.toUpperCase() + " ", V2, "", V3, "uma quarta versão que não cabe"]);
    expect(textosDoEnvio(t)).toEqual([V1, V2, V3]);
    expect(textosDoEnvio(t)).toHaveLength(MAX_VARIACOES);
  });
  it("a marca digitada por engano dentro do texto não cria versão fantasma", () => {
    expect(textosDoEnvio(juntarVariacoes([`${V1} ${MARCA_VARIACAO} resto`]))).toHaveLength(1);
  });
  it("resumo para a tela: a primeira versão e quantas há — nunca a marca", () => {
    const r = resumoDoEnvio(juntarVariacoes([V1, V2]));
    expect(r).toEqual({ principal: V1, versoes: 2 });
    expect(r.principal).not.toContain(MARCA_VARIACAO);
  });
});

describe("cada cliente recebe sempre a mesma versão", () => {
  const t = juntarVariacoes([V1, V2, V3]);
  it("mesmo cliente, mesma versão — em qualquer onda", () => {
    const a = versaoDoCliente(t, "cliente-abc");
    for (let i = 0; i < 5; i++) expect(versaoDoCliente(t, "cliente-abc")).toEqual(a);
  });
  it("as 3 versões se distribuem pela lista (nenhuma fica com menos de 20%)", () => {
    const conta = [0, 0, 0];
    for (let i = 0; i < 900; i++) conta[versaoDoCliente(t, `c${i}x${i * 7}`).numero - 1]++;
    for (const n of conta) expect(n).toBeGreaterThan(180);
  });
  it("o rodapé de saída entra em cada versão, uma vez", () => {
    for (let i = 0; i < 30; i++) {
      const msg = textoParaCliente(t, { id: `c${i}`, nome: "maria souza" });
      expect(msg.match(/responda SAIR/g)).toHaveLength(1);
      expect(msg).not.toContain(MARCA_VARIACAO);
      expect(msg).toContain("Maria");
    }
  });
});

describe("limpeza das mensagens que falharam acha TODAS as versões", () => {
  const t = juntarVariacoes([V1, V2]);
  it("um trecho por versão", () => {
    expect(trechosDoDisparo(t)).toEqual([trechoInvariante(V1), trechoInvariante(V2)]);
  });
  it("mensagem da versão 2 é reconhecida como do disparo", () => {
    const msg2 = personalizarTexto(comRodapeDeSaida(V2), "Edy");
    expect(ehDeAlgumTrecho(msg2, trechosDoDisparo(t))).toBe(true);
    expect(ehDeAlgumTrecho("Passo aí terça de manhã, pode ser?", trechosDoDisparo(t))).toBe(false);
  });
  it("disparo de versão só continua funcionando como antes", () => {
    expect(trechosDoDisparo(V1)).toEqual([trechoInvariante(V1)]);
  });
});
