// "Abrir no WhatsApp" — o lugar do antigo botão Enviar.
//
// O CRM não manda mais mensagem de conversa (02/11): o vendedor responde pelo
// celular e o CRM só espelha. Para não perder o que a tela já ajudava a
// escrever (sugestão do Orientador, resposta pronta, convite de visita,
// legenda da proposta), o botão abre o WhatsApp do aparelho na conversa do
// cliente com o texto já digitado. Quem aperta enviar é ele, no WhatsApp; a
// mensagem volta para o CRM pelo webhook como qualquer outra.
//
// Puro, sem banco: a tela importa (arquivo "use client" não pode importar
// módulo que abre o banco).

/**
 * O número no formato que o wa.me aceita (55 + DDD + número), ou null quando
 * não dá para montar um link confiável — grupo, LID (identificador interno do
 * WhatsApp, 15 dígitos, não é telefone) ou número curto demais. Link errado
 * abriria a conversa de OUTRA pessoa; melhor não ter botão.
 */
export function numeroParaWaMe(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  // Grupo (@g.us, ou o formato antigo "5528…-1612345678": número-timestamp)
  // e LID. Hífen comum de telefone ("99979-8168") passa.
  if (/@g\.us|@lid/i.test(telefone) || /^\d{10,}-\d{6,}$/.test(telefone.trim())) return null;
  const d = telefone.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

/** https://wa.me/55289…?text=… — ou null se o número não serve. */
export function linkWhatsApp(telefone: string | null | undefined, texto?: string | null): string | null {
  const n = numeroParaWaMe(telefone);
  if (!n) return null;
  const t = (texto ?? "").trim();
  return t ? `https://wa.me/${n}?text=${encodeURIComponent(t)}` : `https://wa.me/${n}`;
}
