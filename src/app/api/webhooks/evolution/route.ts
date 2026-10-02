import { NextRequest, NextResponse } from "next/server";
import { evolutionConfig, tokenDaInstancia, nomeDaInstancia, CHAVE_TESTE_WEBHOOK } from "@/lib/zapi";
import { setConfig } from "@/lib/config";
import { STATUS_EVOLUTION } from "@/lib/evolution";
import { atualizarStatusEntrega } from "@/lib/whatsapp-store";
import { registrarDiag } from "@/lib/zapi-diag";
import { processarDadoEvolution } from "@/lib/whatsapp-evolution-entrada";

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
  return NextResponse.json({ status: "webhook ativo", provedor: "evolution", instancia: cfg ? await nomeDaInstancia() : "—" });
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

  // Autenticação. A chave pode vir: no cabeçalho (webhook.headers, que o CRM
  // configura), na URL (?apikey=, que o CRM também põe) ou no corpo — e no
  // corpo a Evolution 2.x manda o token PRÓPRIO da instância, que só é igual
  // à chave global quando a instância foi criada com ela. Antes o CRM só
  // aceitava a global: webhook feito à mão ou pelo instalador levava 401 e
  // as mensagens sumiam sem rastro (nem no diagnóstico apareciam).
  const candidatos = [str(body.apikey), req.headers.get("apikey"), req.headers.get("x-api-key"), req.nextUrl.searchParams.get("apikey")]
    .filter((c): c is string => !!c);
  let autorizado = candidatos.includes(cfg.apiKey);
  if (!autorizado && candidatos.length) {
    const token = await tokenDaInstancia();
    autorizado = !!token && candidatos.includes(token);
  }
  if (!autorizado) {
    await registrarDiag({ dir: "-", phone: null, nome: null, texto: candidatos.length ? "a chave enviada não é a do CRM nem a da instância" : "chamada sem chave nenhuma", status: "chave-recusada" });
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  // Isolamento de instância (uma Evolution pode hospedar vários números).
  // A do CRM pode ter mudado (crm → crm-2, quando a anterior travou) e mora no
  // banco: antes de recusar, relê sem o cache — a troca pode ter acabado de
  // acontecer em outra cópia do servidor.
  const instancia = str(body.instance);
  if (instancia && instancia !== (await nomeDaInstancia())) {
    const ativa = await nomeDaInstancia({ forcar: true });
    if (instancia !== ativa) {
      await registrarDiag({ dir: "-", phone: null, nome: instancia, texto: `esperava a instância "${ativa}"`, status: "outra-instancia" });
      return NextResponse.json({ ignorado: "outra instância" });
    }
  }

  const evento = String(body.event ?? "").toLowerCase().replace(/_/g, ".");
  const dados = (Array.isArray(body.data) ? body.data : [body.data]).filter(
    (d): d is Obj => !!d && typeof d === "object"
  );

  // Chamada de teste do diagnóstico (testarWebhookDeFora): grava a marca no
  // banco DESTA publicação — é como o diagnóstico sabe que a chamada chegou
  // aqui, e não a outro deploy do CRM gravando em outro banco.
  const marcaTeste = evento === "connection.update" ? str(dados[0]?.teste) : null;
  if (marcaTeste) {
    await setConfig(CHAVE_TESTE_WEBHOOK, marcaTeste.slice(0, 40)).catch(() => {});
    return NextResponse.json({ ok: true, teste: true });
  }

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

  // Cada mensagem passa pelo mesmo caminho do resgate (o CRM puxando da
  // Evolution o que o webhook não trouxe): lib/whatsapp-evolution-entrada.ts.
  let algumErro = false;
  for (const data of dados) {
    const r = await processarDadoEvolution(data, "webhook");
    if (!r.ok) algumErro = true;
  }

  return NextResponse.json({ ok: !algumErro }, { status: algumErro ? 500 : 200 });
}
