// Conversão texto ↔ número do CampoNumero (sem DOM, testável). Ver
// CampoNumero.tsx para o porquê: campo controlado direto pelo número
// reformatava a cada tecla e jogava o cursor pro início do campo.

// 0 vira campo vazio — é assim que "o que estava lá some" ao começar a
// digitar um valor novo, sem precisar selecionar o texto no foco (o que
// atrapalharia editar ou completar um número que já está la.
export function paraTexto(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "";
  return String(v).replace(".", ",");
}

export function paraNumero(texto: string): number {
  const limpo = texto.trim().replace(",", ".");
  if (!limpo) return 0;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

// Filtra o que a pessoa digitou: só dígitos (e, se não for inteiro, UM
// separador decimal — aceita ponto ou vírgula, a exibição sempre usa vírgula).
export function sanitizarDigitado(bruto: string, inteiro: boolean): string {
  if (inteiro) return bruto.replace(/\D/g, "");
  let t = bruto.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const primeira = t.indexOf(",");
  if (primeira !== -1) t = t.slice(0, primeira + 1) + t.slice(primeira + 1).replace(/,/g, "");
  return t;
}
