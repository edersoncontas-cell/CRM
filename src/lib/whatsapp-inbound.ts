// Processamento COMUM de um evento de mensagem de WhatsApp — independente do
// provedor. Os webhooks (api/webhooks/zapi e api/webhooks/evolution) só
// validam e normalizam o payload do seu provedor e delegam para cá, para a
// lógica de eco, vínculo de cliente, pipeline do ZEUS e disparo do Orientador
// existir num lugar só.

import { waitUntil } from "@vercel/functions";
import { db } from "@/lib/db";
import { pausarCadenciasDoCliente } from "@/lib/cadencias";
import type { Conteudo } from "@/lib/whatsapp-routing";
import {
  acharOuCriarConversa, inserirMensagem, existeZapiId, acharEcoRecente, curarZapiId,
} from "@/lib/whatsapp-store";
import { registrarDiag } from "@/lib/zapi-diag";
import { motivoBloqueio } from "@/lib/utils";
import { telefoneBloqueado, bloquearContato, apagarContatoPorTelefone } from "@/lib/contatos-bloqueados";
import { processarMensagem } from "@/lib/zeus/pipeline";
import { zeusReport } from "@/lib/zeus/eventos";
import { transcreverBuffer, isEnabled as transcricaoHabilitada } from "@/lib/integrations/transcription";

export type EventoMensagem = {
  fromMe: boolean;
  phone: string;                 // telefone (dígitos) ou id do grupo
  lid: string | null;
  isGroup: boolean;
  nomeContato: string | null;    // nome do CONTATO (nunca do operador — só quando !fromMe)
  nomeGrupo: string | null;
  foto: string | null;
  conteudo: Conteudo;
  messageId: string | null;      // id da mensagem no provedor (anti-eco / status)
  audioBase64?: { data: string; mimeType: string } | null; // Evolution: áudio embutido no webhook
};

// Transcreve áudio (Groq Whisper grátis / OpenAI) a partir de URL pública
// (Z-API) ou de base64 (Evolution). Nunca lança — sem transcrição, a mensagem
// segue como "🎵 Áudio". Timeouts curtos: o provedor espera resposta rápida
// do webhook e reenvia o evento se demorar.
async function transcreverAudio(ev: EventoMensagem): Promise<string | null> {
  if (!transcricaoHabilitada()) return null;
  try {
    let buffer: ArrayBuffer;
    let mimeType = "audio/ogg";
    if (ev.audioBase64?.data) {
      const buf = Buffer.from(ev.audioBase64.data, "base64");
      buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      mimeType = ev.audioBase64.mimeType || mimeType;
    } else if (ev.conteudo.mediaUrl) {
      const res = await fetch(ev.conteudo.mediaUrl, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      buffer = await res.arrayBuffer();
      mimeType = res.headers.get("content-type") ?? mimeType;
    } else {
      return null;
    }
    const texto = await transcreverBuffer(buffer, mimeType);
    return texto.trim() || null;
  } catch (e) {
    console.error("[whatsapp-inbound] transcrição falhou:", e);
    return null;
  }
}

export async function processarEventoMensagem(ev: EventoMensagem): Promise<{ ok: boolean; status: string }> {
  const c = ev.conteudo;
  const diag = { dir: ev.fromMe ? "out" as const : "in" as const, phone: ev.phone, nome: ev.nomeContato, texto: "", status: "?" };

  // Mensagens de grupo não entram no CRM — só conversas 1:1 com cliente.
  if (ev.isGroup) {
    diag.status = "grupo";
    await registrarDiag(diag);
    return { ok: true, status: "grupo" };
  }
  
  if (c.mediaType === "audio" && !c.transcript && (c.mediaUrl || ev.audioBase64?.data)) {
    const texto = await transcreverAudio(ev);
    if (texto) {
      c.transcript = texto;
      c.text = `🎤 ${texto}`;
    }
  }

  diag.texto = c.text;
  if (!c.text) {
    diag.status = "sem-texto";
    await registrarDiag(diag);
    return { ok: true, status: diag.status };
  }

  // Contatos que não são clientes (contabilidade, banco, hotel…): nada deles
  // fica no CRM. Telefone já bloqueado → descarta na hora; nome que bate com
  // a regra → bloqueia o telefone e apaga o que já existia dele.
  if (!ev.isGroup) {
    if (await telefoneBloqueado(ev.phone)) { diag.status = "bloqueado"; await registrarDiag(diag); return { ok: true, status: "bloqueado" }; }
    const motivo = ev.nomeContato ? motivoBloqueio(ev.nomeContato) : null;
    if (motivo) {
      await bloquearContato(ev.phone, ev.nomeContato, motivo);
      await apagarContatoPorTelefone(ev.phone).catch((e) => console.error("[whatsapp-inbound] bloqueio:", e));
      diag.status = "bloqueado"; await registrarDiag(diag); return { ok: true, status: "bloqueado" };
    }
  }

  try {
    if (ev.fromMe) {
      // ── Ramo fromMe (anti-eco em 2 camadas) ──
      if (await existeZapiId(ev.messageId)) { diag.status = "eco"; await registrarDiag(diag); return { ok: true, status: "eco" }; }
      const { conv } = await acharOuCriarConversa({
        phone: ev.phone, lid: ev.lid, isGroup: ev.isGroup,
        // fromMe: nunca passar nome de contato (seria o nome do operador, não do cliente)
        contactName: null,
        groupName: ev.isGroup ? ev.nomeGrupo : null,
        photoUrl: ev.foto,
      });
      const eco = await acharEcoRecente(conv.id, c.text);
      if (eco) {
        if (ev.messageId && !eco.zapiMessageId) await curarZapiId(eco.id, ev.messageId);
        diag.status = "eco"; await registrarDiag(diag); return { ok: true, status: "eco" };
      }
      await inserirMensagem(conv.id, {
        direction: "OUT", body: c.text, origin: "EXTERNAL", operatorDisplayName: "Enviada fora do CRM",
        mediaUrl: c.mediaUrl, mediaType: c.mediaType, mediaName: c.mediaName, transcript: c.transcript,
        zapiMessageId: ev.messageId, sendStatus: "SENT",
      });
      diag.status = "enviada";
    } else {
      // ── Ramo recebido ──
      // O provedor pode reentregar o mesmo evento (retry de webhook lento) —
      // sem esta checagem, a mensagem duplicava e o pipeline do ZEUS
      // reprocessava a mesma conversa duas vezes.
      if (await existeZapiId(ev.messageId)) { diag.status = "duplicado"; await registrarDiag(diag); return { ok: true, status: "duplicado" }; }
      const { conv } = await acharOuCriarConversa({
        phone: ev.phone, lid: ev.lid, isGroup: ev.isGroup,
        contactName: ev.nomeContato,
        groupName: ev.isGroup ? (ev.nomeGrupo ?? null) : null,
        photoUrl: ev.foto,
      });
      const msgRecebida = await inserirMensagem(conv.id, {
        direction: "IN", body: c.text, senderName: ev.isGroup ? ev.nomeContato : null,
        mediaUrl: c.mediaUrl, mediaType: c.mediaType, mediaName: c.mediaName, transcript: c.transcript,
        zapiMessageId: ev.messageId,
      });

      // Pipeline autônomo do ZEUS (Fase 2): vincula/cria cliente, analisa com
      // IA, alimenta negociação/agenda/município, classifica e notifica.
      // Erros aqui nunca derrubam o webhook — a mensagem já está salva.
      try {
        await processarMensagem(msgRecebida.id);
      } catch (e) {
        console.error("[zeus-pipeline] erro no webhook:", e);
        await zeusReport(e, "processarMensagem (pipeline do webhook)");
      }

      // O pipeline pode ter acabado de VINCULAR/CRIAR o cliente desta conversa
      // (primeira mensagem de um contato novo) — reler o clienteId aqui, senão
      // a primeira mensagem de todo cliente novo nunca dispararia o Orientador.
      let clienteIdAtual = conv.clienteId;
      if (!clienteIdAtual) {
        const convAtual = await db.whatsAppConversation.findUnique({ where: { id: conv.id }, select: { clienteId: true } });
        clienteIdAtual = convAtual?.clienteId ?? null;
      }

      // Cliente respondeu: sai da cadência de 7 toques (se estiver numa).
      if (clienteIdAtual) {
        await pausarCadenciasDoCliente(clienteIdAtual).catch((e) => console.error("[cadencias] pausar:", e));
      }

      // Chama o Orientador de Vendas IMEDIATAMENTE para toda conversa com
      // cliente vinculado (não só com o Cérebro/auto-resposta ligado — o
      // painel de coaching deve existir mesmo quando o vendedor responde
      // manualmente). Debounce de 1s (agrega mensagens rápidas antes de analisar).
      if (clienteIdAtual) {
        const agendadoEm = new Date();
        await db.whatsAppConversation.update({ where: { id: conv.id }, data: { agnesScheduledAt: agendadoEm } });
        // Dispara de forma assíncrona — o webhook responde ao provedor
        // imediatamente, mas o fetch continua rodando via waitUntil() (sem
        // isso, a Vercel pode congelar a função assim que a resposta é
        // enviada, matando o fetch no meio e o cliente nunca recebe resposta
        // nem rascunho — silenciosamente).
        const baseUrl = process.env.NEXTAUTH_URL
          ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        const cronSecret = process.env.CRON_SECRET ?? "";
        waitUntil(
          fetch(`${baseUrl}/api/cerebro/despacho-rapido`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-cron-secret": cronSecret },
            body: JSON.stringify({ conversationId: conv.id, agendadoEm: agendadoEm.toISOString() }),
          }).catch((e) => {
            console.error("[orientador-dispatch] erro:", e);
            return zeusReport(e, "dispatch do Orientador (webhook → despacho-rapido)");
          })
        );
      }
      diag.status = "recebida";
    }
  } catch (e) {
    console.error("Erro [wa webhook]:", e);
    diag.status = "erro:" + String(e).slice(0, 50);
    await registrarDiag(diag);
    await zeusReport(e, "webhook de WhatsApp (lib/whatsapp-inbound.ts)");
    return { ok: false, status: diag.status };
  }

  await registrarDiag(diag);
  return { ok: true, status: diag.status };
}
