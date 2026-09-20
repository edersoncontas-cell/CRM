// O card "Negociação" do Orientador mostra três coisas e só três: qual
// máquina, quanto está negociado e como o cliente vai pagar. Cada uma que já
// foi identificada aparece com "Verificado" em verde; o que falta fica
// apagado, para o vendedor ver de relance o que ainda precisa arrancar.
//
// A leitura fica aqui, fora do componente, porque tem regra: o campo
// tipoPagamento da negociação guarda tanto condição de pagamento de verdade
// (avista, financiamento, consorcio, crd_pme) quanto nível de interesse
// (pesquisa_preco, interesse_real) — os dois saem do mesmo <select> do
// formulário. "Pesquisa de preço" NÃO é forma de pagamento e não pode
// aparecer como verificada.

import { normalizarPagamento } from "@/lib/orientador-fatos";
import { formatCurrency } from "@/lib/utils";

/**
 * Condições de pagamento de verdade, no vocabulário do vendedor.
 * CRD PME é o parcelamento em boleto da própria casa (ver Financeiro: a
 * comissão sai quando 75% do valor está pago) — daí o rótulo.
 */
const ROTULO_PAGAMENTO: Record<string, string> = {
  avista: "À vista",
  financiamento: "Financiado",
  consorcio: "Consórcio",
  crd_pme: "Parcelado pela casa",
};

/** "New Holland B110" a partir de marca + modelo; null quando não dá nome. */
export function maquinaDaNegociacao(marca: string | null, modelo: string | null): string | null {
  const m = (modelo ?? "").trim();
  const b = (marca ?? "").trim();
  if (!m) return null;
  // Modelo já escrito com a marca junto ("New Holland B110") não repete.
  if (b && !m.toLowerCase().includes(b.toLowerCase())) return `${b} ${m}`;
  return m;
}

/**
 * Como o cliente vai pagar. Prefere o campo estruturado; cai no texto livre
 * (condicaoPagamento, legado) quando o estruturado não é uma forma de
 * pagamento. null = ainda não definido, e o card mostra como pendente.
 */
export function pagamentoDaNegociacao(
  tipoPagamento: string | null,
  condicaoPagamento: string | null,
): string | null {
  // As duas pontas passam pelo mesmo normalizador. Antes o texto livre era
  // mostrado como veio, e a tela chegou a exibir "Pagamento: outro" com o
  // símbolo de confirmado — "outro" não é forma de pagamento nenhuma.
  const codigo = normalizarPagamento(tipoPagamento) ?? normalizarPagamento(condicaoPagamento);
  return codigo ? ROTULO_PAGAMENTO[codigo] : null;
}

/**
 * Assunto da última conversa: resumoTexto do cliente é um LOG de linhas no
 * formato "[dd/mm/aaaa] resumo", uma por mensagem analisada. O painel pegava
 * as duas últimas e colava com espaço — e como linhas seguidas costumam ser
 * quase iguais, o card saía com a mesma frase duas vezes. Agora é só a
 * última, sem a data na frente.
 */
export function assuntoDaUltimaConversa(resumoTexto: string | null): string | null {
  const linhas = (resumoTexto ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const ultima = linhas[linhas.length - 1];
  if (!ultima) return null;
  return ultima.replace(/^\[[^\]]*\]\s*/, "").trim() || null;
}

/**
 * A entrada, como o vendedor fala dela: em reais, em percentual, ou os dois
 * ("R$ 180.000 (30%)"). null quando nada foi definido — aí o card mostra como
 * pendente em vez de fingir que sabe.
 */
export function entradaDaNegociacao(valor: number | null, percentual: number | null): string | null {
  const emReais = valor != null && valor > 0 ? formatCurrency(valor) : null;
  const emPct = percentual != null && percentual > 0 ? `${Number(percentual.toFixed(1))}%` : null;
  if (emReais && emPct) return `${emReais} (${emPct})`;
  return emReais ?? emPct;
}
