import { NextRequest, NextResponse } from "next/server";
import { evolutionConfig } from "@/lib/zapi";
import { extrairConteudoEvolution, normalizarChaveEvolution, STATUS_EVOLUTION } from "@/lib/evolution";
import { atualizarStatusEntrega } from "@/lib/whatsapp-store";
import { registrarDiag } from "@/lib/zapi-diag";
import { processarEventoMensagem } from "@/lib/whatsapp-inbound";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Webhook da Evolution API (WhatsApp open source, grátis). Configure na
// Evolution (Manager → instância → Webhook, ou POST /webhook/set/{instancia}):
//   URL:      https://SEU-APP.vercel.app/api/webhooks/evolution
//   Eventos:  MESSAGES_UPSERT e MESSAGES_UPDATE
//   Base64:   ligado (para os áudios chegarem embutidos e serem transcritos)
// Só valida/normaliza o payload — a lógica comum vive em lib/whatsapp-inbound.ts.

type Obj = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

// GET de teste no navegador.
export async function GET() {
  const cfg = evolutionConfig();
  return NextResponse.json({ status: "webhook ativo", provedor: "evolution", instancia: cfg ? cfg.instance : "—" });
}

export async function POST(req: NextRequest) {
  const cfg = evolutionConfig();
  if (!cfg) return NextResponse.json({ erro: "Evolution API não configurada (EVOLUTION_API_URL/KEY/INSTANCE)." }, { status: 503 });

  let body: Obj;
  try {
    body = (await req.json()) as Obj;
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Autenticação: a Evolution v2 inclui a própria apikey no corpo de todo
  // webhook; também aceita como header (webhook.headers na config da instância).
  const chave = str(body.apikey) ?? req.headers.get("apikey") ?? req.headers.get("x-api-key") ?? req.nextUrl.searchParams.get("apikey");
  if (chave !== cfg.apiKey) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  // Isolamento de instância (uma Evolution pode hospedar vários números).
  const instancia = str(body.instance);
  if (instancia && instancia !== cfg.instance) {
    return NextResponse.json({ ignorado: "outra instância" });
  }

  const evento = String(body.event ?? "").toLowerCase().replace(/_/g, ".");
  const dados = (Array.isArray(body.data) ? body.data : [body.data]).filter(
    (d): d is Obj => !!d && typeof d === "object"
  );

  // Status de entrega/leitura das mensagens que enviamos.
  if (evento === "messages.update") {
    for (const item of dados) {
      const key = item.key as Obj | undefined;
      const id = str(item.keyId) ?? str(item.messageId) ?? str(key?.id);
      const novo = STATUS_EVOLUTION[String(item.status ?? "").toUpperCase()];
      if (id && novo) {
        await atualizarStatusEntrega([id], novo).catch((e) => console.error("[evolution webhook] status:", e));
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (evento !== "messages.upsert") {
    return NextResponse.json({ ok: true, ignorado: evento || "sem evento" });
  }

  let algumErro = false;
  for (const data of dados) {
    const chaveMsg = normalizarChaveEvolution(data);
    if (!chaveMsg) {
      await registrarDiag({ dir: "-", phone: null, nome: null, texto: "", status: "sem-telefone" });
      continue;
    }
    // Stories/status do WhatsApp não são conversa.
    if (chaveMsg.remoteJid === "status@broadcast" || chaveMsg.remoteJid.endsWith("@broadcast")) continue;

    const conteudo = extrairConteudoEvolution(data.message);
    const pushName = str(data.pushName);
    const audioBase64 = conteudo.mediaType === "audio" && conteudo.base64
      ? { data: conteudo.base64, mimeType: conteudo.mimeType ?? "audio/ogg" }
      : null;

    console.log("[webhook evolution]", JSON.stringify({ fromMe: chaveMsg.fromMe, phone: chaveMsg.phone, isGroup: chaveMsg.isGroup, tipo: conteudo.mediaType ?? "texto" }));

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
    });
    if (!r.ok) algumErro = true;
  }

  return NextResponse.json({ ok: !algumErro }, { status: algumErro ? 500 : 200 });
}
