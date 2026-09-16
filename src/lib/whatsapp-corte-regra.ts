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
