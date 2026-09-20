// O QUE É, DE FATO, UM TELEFONE — regra pura, sem banco.
//
//   "Quero que todos os contatos que tem esse padrão de numeros no lugar do
//    numero de telefone sejam excluídos definitivamente do CRM e não será
//    mais permitido o sistema salvar contatos com esse padrão numérico, ou é
//    o contato verdadeiro do cliente ou não fica cadastrado."
//
// O padrão da tela — 100175850774738, quinze dígitos — é um LID do WhatsApp:
// o identificador interno que o aplicativo usa quando não entrega o número
// real do contato. Ele não disca, não recebe mensagem fora do WhatsApp e não
// serve para nada no CRM; só ocupa o lugar do telefone de verdade e faz o
// cadastro parecer completo quando não está.
//
// A régua é o telefone BRASILEIRO, que é o universo deste CRM (Espírito
// Santo): DDD de 2 dígitos + 8 (fixo) ou 9 (celular) dígitos, com ou sem o
// 55 na frente. Qualquer coisa fora disso não é telefone.

/** Só os dígitos, sem zeros à esquerda. */
export function digitosDoTelefone(bruto: string | null | undefined): string {
  return (bruto ?? "").replace(/\D/g, "").replace(/^0+/, "");
}

/** O número em formato nacional (sem o 55), ou "" quando não dá para ler. */
export function nacionalDoTelefone(bruto: string | null | undefined): string {
  const d = digitosDoTelefone(bruto);
  if (!d) return "";
  // O 55 só é código do país quando o que sobra ainda tem tamanho de telefone.
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d.slice(2);
  return d;
}

/**
 * É um telefone brasileiro de verdade?
 *
 * 10 dígitos = DDD + fixo de 8. 11 dígitos = DDD + celular de 9, e o celular
 * brasileiro começa obrigatoriamente com 9. DDD válido vai de 11 a 99.
 *
 * Vazio devolve false, mas ATENÇÃO a quem chama: cadastro sem telefone é
 * legítimo no CRM (muita empresa entra só com o nome). Quem valida formulário
 * deve tratar "vazio" e "inválido" como coisas diferentes — ver
 * telefoneRecusado().
 */
export function ehTelefoneReal(bruto: string | null | undefined): boolean {
  const n = nacionalDoTelefone(bruto);
  if (n.length !== 10 && n.length !== 11) return false;
  const ddd = Number(n.slice(0, 2));
  if (!(ddd >= 11 && ddd <= 99)) return false;
  if (n.length === 11 && n[2] !== "9") return false;
  return true;
}

/**
 * É o padrão que o vendedor mandou apagar: identificador interno do WhatsApp
 * no lugar do telefone. Quatorze dígitos ou mais — nenhum telefone brasileiro
 * chega perto disso, nem com o código do país.
 */
export function ehLidWhatsApp(bruto: string | null | undefined): boolean {
  return digitosDoTelefone(bruto).length >= 14;
}

/**
 * O telefone deve ser RECUSADO na gravação?
 *
 * Vazio NÃO é recusado — cadastro sem telefone continua valendo. Recusado é
 * o que foi preenchido e não é telefone: "ou é o contato verdadeiro do
 * cliente ou não fica cadastrado".
 */
export function telefoneRecusado(bruto: string | null | undefined): boolean {
  const d = digitosDoTelefone(bruto);
  if (!d) return false;
  return !ehTelefoneReal(d);
}

/** O telefone para gravar: o número limpo, ou null quando não presta. */
export function telefoneParaGravar(bruto: string | null | undefined): string | null {
  const d = digitosDoTelefone(bruto);
  if (!d || !ehTelefoneReal(d)) return null;
  return nacionalDoTelefone(d);
}

/** Frase para a tela quando o número é recusado. */
export function motivoTelefoneRecusado(bruto: string | null | undefined): string {
  if (ehLidWhatsApp(bruto)) {
    return "Esse número é um identificador interno do WhatsApp, não um telefone. Informe o número real do cliente (DDD + número) ou deixe em branco.";
  }
  return "Telefone inválido. Use DDD + número (ex.: 28999798168) ou deixe em branco.";
}
