// UMA mensagem da Evolution → CRM. É o mesmo caminho para as duas portas de
// entrada:
//   · o webhook (a Evolution avisa na hora — /api/webhooks/evolution);
//   · o resgate (o CRM puxa da Evolution o que o webhook não trouxe —
//     lib/whatsapp-resgate.ts).
// Regra da casa: regra nova de recebimento entra AQUI (ou em
// processarEventoMensagem), nunca numa cópia — senão o que chega por uma
// porta escapa dela.

import { extrairConteudoEvolution, normalizarChaveEvolution } from "@/lib/evolution";
import { registrarDiag } from "@/lib/zapi-diag";
import { processarEventoMensagem } from "@/lib/whatsapp-inbound";
import { baixarMidiaEvolution } from "@/lib/zapi";

type Obj = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export type ResultadoEntrada = { ok: boolean; status: string; id: string | null };

export async function processarDadoEvolution(data: Obj, via: "webhook" | "resgate" = "webhook"): Promise<ResultadoEntrada> {
  const chaveMsg = normalizarChaveEvolution(data);
  if (!chaveMsg) {
    await registrarDiag({ dir: "-", phone: null, nome: null, texto: "", status: "sem-telefone", ...(via === "resgate" ? { via } : {}) });
    return { ok: true, status: "sem-telefone", id: null };
  }
  // Stories/status do WhatsApp não são conversa.
  if (chaveMsg.remoteJid === "status@broadcast" || chaveMsg.remoteJid.endsWith("@broadcast")) {
    return { ok: true, status: "status", id: chaveMsg.id };
  }

  const conteudo = extrairConteudoEvolution(data.message);
  const pushName = str(data.pushName);
  let audioBase64 = conteudo.mediaType === "audio" && conteudo.base64
    ? { data: conteudo.base64, mimeType: conteudo.mimeType ?? "audio/ogg" }
    : null;
  // O que a Evolution guarda não vem com o áudio embutido (o webhook vem, com
  // base64 ligado): no resgate, busca o áudio para ele ser transcrito igual.
  if (via === "resgate" && conteudo.mediaType === "audio" && !audioBase64 && chaveMsg.id) {
    const m = await baixarMidiaEvolution(chaveMsg.id).catch(() => null);
    if (m) audioBase64 = { data: m.base64, mimeType: m.mimeType || "audio/ogg" };
  }
  const tsRaw = Number(data.messageTimestamp ?? 0) || 0;
  const sentAt = tsRaw ? new Date(tsRaw < 1e12 ? tsRaw * 1000 : tsRaw) : null;

  console.log(`[${via} evolution]`, JSON.stringify({ fromMe: chaveMsg.fromMe, phone: chaveMsg.phone, isGroup: chaveMsg.isGroup, tipo: conteudo.mediaType ?? "texto" }));

  const r = await processarEventoMensagem({
    fromMe: chaveMsg.fromMe,
    phone: chaveMsg.phone,
    lid: chaveMsg.lid,
    isGroup: chaveMsg.isGroup,
    // pushName é o nome de quem ENVIOU: do contato quando é recebida, do
    // operador quando é fromMe (nunca usar como nome do contato nesse caso).
    nomeContato: !chaveMsg.fromMe ? pushName : null,
    nomeGrupo: null, // a Evolution não manda o nome do grupo no evento
    foto: null,
    conteudo: {
      text: conteudo.text,
      mediaType: conteudo.mediaType,
      // Foto/documento/vídeo: o CRM busca o conteúdo na Evolution sob demanda
      // (rota /api/whatsapp/midia) — sem hospedar nada.
      mediaUrl: chaveMsg.id && conteudo.mediaType && ["image", "document", "video"].includes(conteudo.mediaType)
        ? `/api/whatsapp/midia/${encodeURIComponent(chaveMsg.id)}`
        : null,
      mediaName: conteudo.mediaName,
      transcript: null,
    },
    messageId: chaveMsg.id,
    audioBase64,
    sentAt,
    via,
  });
  return { ok: r.ok, status: r.status, id: chaveMsg.id };
}
