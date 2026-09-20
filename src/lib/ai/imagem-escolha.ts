// Qual provedor tenta a arte, e quando vale a pena tentar o seguinte.
//
// Módulo puro de propósito: a regra de "vale a pena pagar pelo próximo?" é
// a que mexe no bolso do dono do CRM, então ela tem teste.

export type ProvedorImagem = "gemini" | "openai";

const ORDEM_PADRAO: ProvedorImagem[] = ["gemini", "openai"];

/**
 * A ordem em que os provedores são tentados.
 *
 * O Gemini vem primeiro SEMPRE que estiver configurado, e o motivo é dinheiro:
 * ele tem camada gratuita, a OpenAI não. A OpenAI é a reserva de quando a
 * cota grátis do dia acaba — assim, no uso normal, a conta fica em zero.
 * Dá para inverter em IMAGEM_PROVEDORES, mas saiba que inverter significa
 * pagar por toda arte.
 */
export function ordemDosProvedores(
  configurado: string | undefined,
  disponiveis: { gemini: boolean; openai: boolean },
): ProvedorImagem[] {
  const pedidos = (configurado ?? "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is ProvedorImagem => p === "gemini" || p === "openai");
  const ordem = pedidos.length ? pedidos : ORDEM_PADRAO;
  return [...new Set(ordem)].filter((p) => disponiveis[p]);
}

/**
 * Depois de um provedor falhar, vale a pena gastar uma chamada no próximo?
 *
 * Sim quando o problema é do PROVEDOR: cota estourada, fora do ar, modelo que
 * sumiu. O outro pode estar bem.
 *
 * Não quando o problema é do PEDIDO: recusa por conteúdo, prompt inválido.
 * O segundo provedor vai recusar igual, e no caso da OpenAI essa tentativa
 * inútil seria cobrada. Este é o ponto do módulo — evitar pagar por uma
 * recusa que já era certa.
 */
export function vaiTentarOProximo(status: number | undefined, detalhe = ""): boolean {
  if (status == null) return true; // erro de rede/timeout: o outro pode responder
  if (status === 429) return true; // sem cota aqui
  if (status >= 500) return true; // instabilidade do provedor
  if (status === 404) return true; // modelo renomeado/desativado
  if (status === 401 || status === 403) return true; // chave deste provedor ruim
  if (status === 400) {
    // 400 por conteúdo é o pedido, não o provedor: parar aqui.
    const d = detalhe.toLowerCase();
    const ehConteudo = /safety|blocked|moderation|content[_ ]policy|prohibited/.test(d);
    return !ehConteudo;
  }
  return false;
}
