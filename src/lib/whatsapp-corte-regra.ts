// Regras puras de "o que é mensagem velha" no WhatsApp (sem banco, testável).
//
// Duas barreiras se somam:
//  - data de corte global: nada anterior a ela entra no CRM (webhook,
//    importação de histórico ou de arquivo);
//  - exclusão da conversa: depois que o vendedor apaga uma conversa, só
//    mensagem NOVA (posterior ao momento da exclusão) pode recriá-la —
//    o histórico antigo que o WhatsApp reenvia fica de fora.

export function limiteMensagens(dataCorte: Date | null, excluidaEm: Date | null): Date | null {
  if (dataCorte && excluidaEm) return dataCorte > excluidaEm ? dataCorte : excluidaEm;
  return dataCorte ?? excluidaEm ?? null;
}

// Registros de exclusão de uma conversa (por telefone/lid). Quem apagou:
//  - "manual": o vendedor, na tela — vale sempre;
//  - "corte":  a data de corte — só vale enquanto o vendedor não pede para
//              importar o histórico de ANTES do corte (aí ele quer isso de
//              volta, e o registro do corte não pode barrar).
export type ExclusaoRegistrada = { excluidaEm: Date; motivo: string };

export function ultimaExclusaoQueVale(registros: ExclusaoRegistrada[], importandoDeAntesDoCorte: boolean): Date | null {
  let ultima: Date | null = null;
  for (const r of registros) {
    if (importandoDeAntesDoCorte && r.motivo === "corte") continue;
    if (!ultima || r.excluidaEm > ultima) ultima = r.excluidaEm;
  }
  return ultima;
}

// Limite para a importação de histórico: se o vendedor escolheu "a partir de"
// uma data, é ela (mais a exclusão manual, se houver); senão vale a regra
// normal de corte + exclusão.
export function limiteImportacao(desde: Date | null, corte: Date | null, exclusao: Date | null): Date | null {
  return limiteMensagens(desde ?? corte, exclusao);
}

// "A partir de" que a tela manda para a importação do celular: um dia
// (AAAA-MM-DD) ou "tudo" — tudo o que o celular tem, desde o começo. Qualquer
// outra coisa é "sem escolha" (vale o corte normal).
export const DESDE_TUDO = "tudo";
const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function desdeDaImportacao(valor: unknown): Date | null {
  if (valor === DESDE_TUDO) return new Date(0);
  if (typeof valor === "string" && DIA_ISO.test(valor)) return inicioDoDiaBrasilia(valor);
  return null;
}

export function mensagemAntiga(sentAt: Date, limite: Date | null): boolean {
  return limite !== null && sentAt.getTime() < limite.getTime();
}

// Início do dia (00:00) em Brasília, para "a partir de hoje" valer o dia do
// vendedor e não o dia UTC do servidor.
export function inicioDoDiaBrasilia(dia: string): Date {
  const [a, m, d] = dia.split("-").map(Number);
  // Brasília é UTC-3 o ano todo (sem horário de verão desde 2019).
  return new Date(Date.UTC(a, m - 1, d, 3, 0, 0));
}

export function diaBrasiliaISO(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(data);
}
