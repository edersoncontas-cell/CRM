// Leitura DIRETA da caixa de contexto, sem IA.
//
// O defeito que deu origem a este módulo: o vendedor escreveu "Entrada 10%" na
// caixa "O que o Orientador precisa saber", a nota foi guardada — apareceu
// certinha em "Já contei ao Orientador" — e o card Negociação continuou
// dizendo "entrada ainda não definida". Causa: quem transforma nota em ficha
// é a análise do Orientador, e naquele dia a cota diária de IA tinha acabado.
// O painel até avisava ("a cota de IA de hoje acabou"), mas do ponto de vista
// de quem usa isso é o sistema engolindo o que foi digitado.
//
// A correção é não depender da IA para o que não precisa dela. "Entrada 10%",
// "fechamos em 610 mil", "vai ser financiado", "New Holland B110" e "já
// visitei" são frases de estrutura fixa: dá para ler com regra, na hora, de
// graça e sem falhar por cota. A IA continua fazendo o que só ela faz —
// entender a conversa inteira, o tom, a objeção.
//
// REGRA DE OURO daqui: na dúvida, não lê. Um palpite errado escreve na ficha
// de uma negociação de verdade. Todo campo exige a palavra-chave dele por
// perto; número solto nunca vira dado. O que este módulo não pegar continua
// indo na nota para a IA ler depois — não se perde nada.

import {
  FATOS_VAZIOS, normalizarValor, normalizarPercentual, normalizarModelo,
  normalizarMarca, normalizarPagamento, type FatosNegociacao,
} from "@/lib/orientador-fatos";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Um número em dinheiro como o vendedor escreve: "610 mil", "R$ 610.000", "1,2 milhão". */
const DINHEIRO = String.raw`r?\$?\s*[\d][\d.,]*\s*(?:mil|k|milhao|milhoes|mi|kk)?`;

/**
 * Pega o trecho que vem logo depois de uma palavra-chave, dentro da mesma
 * frase. A janela é curta (60 caracteres) de propósito: "entrada de 30% e
 * fechamos em 610 mil" não pode fazer o 610 mil virar entrada.
 */
function depoisDe(texto: string, chave: RegExp, janela = 60): string[] {
  const achados: string[] = [];
  const re = new RegExp(chave.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    achados.push(texto.slice(m.index + m[0].length, m.index + m[0].length + janela));
  }
  return achados;
}

/** Percentual de entrada: "entrada 10%", "entrada de 30 %", "10% de entrada". */
export function entradaPercentualDaNota(texto: string): number | null {
  const t = semAcento(texto);
  for (const trecho of depoisDe(t, /entrada/, 40)) {
    const m = /(\d{1,3}(?:[.,]\d+)?)\s*%/.exec(trecho);
    if (m) return normalizarPercentual(m[1]);
  }
  // A ordem inversa também é comum na boca do vendedor.
  const inverso = /(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:de\s+)?(?:entrada|sinal)/.exec(t);
  return inverso ? normalizarPercentual(inverso[1]) : null;
}

/** Entrada em reais: "entrada de 180 mil", "entrada R$ 180.000". */
export function entradaValorDaNota(texto: string): number | null {
  const t = semAcento(texto);
  for (const trecho of depoisDe(t, /entrada|sinal de/, 40)) {
    // "entrada 10%" não é entrada em reais — o percentual tem dono próprio.
    if (/^\D{0,12}\d{1,3}(?:[.,]\d+)?\s*%/.test(trecho)) continue;
    const m = new RegExp(DINHEIRO).exec(trecho);
    const v = m ? normalizarValor(m[0].trim()) : null;
    if (v != null) return v;
  }
  return null;
}

/**
 * Valor da máquina: exige palavra de fechamento perto. "610 mil" solto não
 * entra, e o que estiver colado em "entrada" fica de fora.
 */
export function valorDaNota(texto: string): number | null {
  const t = semAcento(texto);
  for (const trecho of depoisDe(t, /fechamos?|fechado|fechei|valor|preco|negociad[oa]|orcad[oa]|saiu por|ficou em/, 45)) {
    if (/^\s*(?:de\s+)?entrada/.test(trecho)) continue;
    const m = new RegExp(DINHEIRO).exec(trecho);
    const v = m ? normalizarValor(m[0].trim()) : null;
    if (v != null) return v;
  }
  return null;
}

/**
 * Modelo da máquina: só o formato de código de modelo ("B110", "E145C",
 * "CA25 D", "D150"). Quem decide se vale é normalizarModelo — aqui só se
 * junta o candidato.
 */
export function modeloDaNota(texto: string): string | null {
  const re = /\b([A-Za-z]{1,3}\d{2,4}\s?[A-Za-z]{0,3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const bruto = m[1].trim().toUpperCase();
    // "R$ 610.000" e "30%" não chegam aqui, mas "2024" ou "48X" chegariam.
    if (/^\d/.test(bruto)) continue;
    const ok = normalizarModelo(bruto);
    if (ok) return ok;
  }
  return null;
}

/** Marca citada na nota. Só as duas da casa passam (normalizarMarca decide). */
export function marcaDaNota(texto: string): string | null {
  const t = semAcento(texto);
  for (const cand of ["new holland", "newholland", "dynapac"]) {
    if (t.includes(cand)) return normalizarMarca(cand);
  }
  return null;
}

/** Forma de pagamento citada na nota. */
export function pagamentoDaNota(texto: string): string | null {
  const t = semAcento(texto);
  // Ordem importa: "parcelado pela casa" antes de "parcelado" genérico.
  const pistas = [
    "parcelado pela casa", "crd pme", "crd-pme", "a vista", "avista", "pix",
    "financiamento", "financiado", "financiar", "finame", "consorcio",
  ];
  for (const p of pistas) {
    if (t.includes(p)) {
      const code = normalizarPagamento(p);
      if (code) return code;
    }
  }
  return null;
}

/**
 * "Já visitei o cliente". Frases fechadas de propósito: "vou visitar" e
 * "marcar visita" NÃO podem marcar a etapa como feita.
 */
export function visitaRealizadaNaNota(texto: string): boolean | null {
  const t = semAcento(texto);
  if (/\bvou\s+(?:visitar|passar|la)\b|marcar\s+(?:a\s+)?visita|agendar\s+(?:a\s+)?visita|visita\s+marcada|visita\s+agendada/.test(t)) return null;
  if (/ja\s+(?:fui|estive|visitei|passei)|visita\s+(?:ja\s+)?(?:foi\s+)?realizada|fiz\s+a\s+visita|estive\s+(?:la|na\s+obra|com\s+o\s+cliente)|visitei\s+(?:o|a|ele|ela)\b/.test(t)) return true;
  return null;
}

/**
 * Lê da nota tudo o que dá para ler com segurança.
 *
 * O resultado entra exatamente pelo mesmo caminho dos fatos da IA
 * (mudancasDaNegociacao com temNota=true): o que o vendedor escreveu ganha do
 * que já estava, porque ele esteve lá. O que não for reconhecido volta null e
 * fica por conta da análise.
 */
export function lerFatosDaNota(texto: string): FatosNegociacao {
  const t = (texto ?? "").trim();
  if (!t) return { ...FATOS_VAZIOS };
  return {
    ...FATOS_VAZIOS,
    marca: marcaDaNota(t),
    maquinaModelo: modeloDaNota(t),
    valor: valorDaNota(t),
    condicaoPagamento: pagamentoDaNota(t) as FatosNegociacao["condicaoPagamento"],
    entradaValor: entradaValorDaNota(t),
    entradaPercentual: entradaPercentualDaNota(t),
    visitaRealizada: visitaRealizadaNaNota(t),
  };
}

/** Se a leitura direta achou alguma coisa — evita escrita à toa no banco. */
export function temAlgumFato(f: FatosNegociacao): boolean {
  return Object.values(f).some((v) => v !== null);
}
