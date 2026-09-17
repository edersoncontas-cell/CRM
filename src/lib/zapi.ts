// Camada de WhatsApp — abstrai o PROVEDOR de envio/conexão:
//   • Evolution API (open source, GRÁTIS, self-hosted) — env EVOLUTION_API_URL,
//     EVOLUTION_API_KEY e EVOLUTION_INSTANCE. Tem prioridade quando configurada.
//   • Z-API (paga) — env ZAPI_INSTANCE_ID + ZAPI_TOKEN/ZAPI_INSTANCE_TOKEN
//     (+ ZAPI_CLIENT_TOKEN), ou WhatsAppSettings no banco.
// O nome do arquivo (zapi.ts) foi mantido de propósito: ~20 módulos importam
// daqui e a assinatura de todas as funções continua idêntica — só o transporte
// muda por baixo.

import { db } from "@/lib/db";
import { mensagemEvolutionParaZapi, extrairBase64Qr, estadoDaResposta } from "@/lib/evolution";
import { pausarVigia, podeForcarNovoQr, marcarForcaNovoQr } from "@/lib/whatsapp-vigia-pausa";

export type ZApiConfig = { instanceId: string; token: string; clientToken: string; apiUrl: string };
export type EvolutionConfig = { url: string; apiKey: string; instance: string };
export type ProvedorWhatsApp = "evolution" | "zapi";

// Aceita os nomes novos da spec E os antigos que já estão na Vercel.
function envConfig(): ZApiConfig | null {
  const instanceId = process.env.ZAPI_INSTANCE_ID || "";
  const token = process.env.ZAPI_TOKEN || process.env.ZAPI_INSTANCE_TOKEN || "";
  if (!instanceId || !token) return null;
  return {
    instanceId,
    token,
    clientToken: process.env.ZAPI_CLIENT_TOKEN || "",
    apiUrl: process.env.ZAPI_API_URL || "https://api.z-api.io",
  };
}

export function evolutionConfig(): EvolutionConfig | null {
  const url = (process.env.EVOLUTION_API_URL || "").trim().replace(/\/+$/, "");
  const apiKey = (process.env.EVOLUTION_API_KEY || "").trim();
  const instance = (process.env.EVOLUTION_INSTANCE || "").trim();
  if (!url || !apiKey || !instance) return null;
  return { url, apiKey, instance };
}

export function provedorWhatsApp(): ProvedorWhatsApp | null {
  if (evolutionConfig()) return "evolution";
  if (envConfig()) return "zapi";
  return null;
}

export function provedorWhatsAppNome(): string | null {
  const p = provedorWhatsApp();
  if (p === "evolution") return "Evolution API (grátis)";
  if (p === "zapi") return "Z-API";
  return null;
}

// Config da Z-API (env ou banco). Usada só pelas rotas que dependem de
// recursos exclusivos da Z-API (sincronizar chats apagados, diagnóstico).
export async function resolveZApiConfig(): Promise<ZApiConfig | null> {
  const env = envConfig();
  if (env) return env;
  try {
    const s = await db.whatsAppSettings.findFirst({ where: { isActive: true } });
    if (s?.instanceId && s.token) {
      return { instanceId: s.instanceId, token: s.token, clientToken: s.clientToken, apiUrl: s.apiUrl || "https://api.z-api.io" };
    }
  } catch {}
  return null;
}

export function isEnabled(): boolean {
  return provedorWhatsApp() !== null;
}

function headers(clientToken: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) h["Client-Token"] = clientToken;
  return h;
}

// POST genérico da Z-API. Trata HTTP 200 com `error` no corpo (instância desconectada).
export async function zapiPost(endpoint: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const cfg = await resolveZApiConfig();
  if (!cfg) throw new Error("Z-API não configurada.");
  const url = `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.token}/${endpoint}`;
  const res = await fetch(url, { method: "POST", headers: headers(cfg.clientToken), body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data?.error) {
    throw new Error(`Z-API ${endpoint} falhou (${res.status}): ${data?.error ?? data?.message ?? "erro"}`);
  }
  return data;
}

async function zapiGet(endpoint: string): Promise<unknown> {
  const cfg = await resolveZApiConfig();
  if (!cfg) throw new Error("Z-API não configurada.");
  const url = `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.token}/${endpoint}`;
  const res = await fetch(url, { headers: headers(cfg.clientToken), cache: "no-store" });
  if (!res.ok) throw new Error(`Z-API GET ${endpoint} falhou (${res.status})`);
  return res.json().catch(() => null);
}

// ---------- Evolution API (transporte) ----------

// Consultas de tela (status, QR) usam tempo curto: se o servidor da Evolution
// está fora do ar, é melhor dizer isso em segundos do que deixar a tela
// pendurada 30s e a função da Vercel morrer no limite. Envio de mensagem
// continua com folga.
const TEMPO_TELA_MS = 10_000;
const TEMPO_PADRAO_MS = 30_000;

async function evoFetch(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
  timeoutMs = TEMPO_PADRAO_MS
): Promise<Record<string, unknown>> {
  const cfg = evolutionConfig();
  if (!cfg) throw new Error("Evolution API não configurada.");
  let res: Response;
  try {
    res = await fetch(`${cfg.url}${path}`, {
      method,
      headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    // Erro de rede/tempo esgotado: sem isto a tela mostrava o texto cru
    // "The operation was aborted due to timeout", que não diz o que fazer.
    const causa = e instanceof Error && e.name === "TimeoutError"
      ? `não respondeu em ${Math.round(timeoutMs / 1000)}s`
      : "está inalcançável (servidor desligado, porta fechada ou endereço errado)";
    throw new Error(`Não consegui falar com o servidor da Evolution API: ${cfg.url} ${causa}. Confira se ele está ligado e acessível pela internet.`);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detalhe = (data?.response as Record<string, unknown> | undefined)?.message ?? data?.message ?? data?.error ?? JSON.stringify(data);
    throw new Error(`Evolution API ${path} falhou (${res.status}): ${String(detalhe).slice(0, 200)}`);
  }
  return data;
}

function evoInstancia(): string {
  return encodeURIComponent(evolutionConfig()?.instance ?? "");
}

// Converte o "phone" do CRM (dígitos, id de grupo da Z-API ou JID) no
// destinatário que a Evolution espera.
function evoDestino(phone: string): string {
  if (phone.includes("@")) return phone; // já é um JID (grupo, lid)
  if (/-group$/i.test(phone)) return `${phone.replace(/-group$/i, "")}@g.us`;
  if (/^\d{8,}-\d{9,}$/.test(phone)) return `${phone}@g.us`;
  return normalizePhone(phone);
}

function evoJidChat(phone: string): string {
  const d = evoDestino(phone);
  return d.includes("@") ? d : `${d}@s.whatsapp.net`;
}

// ---------- Telefone / grupos ----------

export function isGroupChatId(phone: string): boolean {
  return /@g\.us$/i.test(phone) || /^\d{8,}-(group|\d{9,})$/i.test(phone);
}

export function normalizePhone(phone: string): string {
  if (!phone) return phone;
  if (isGroupChatId(phone)) return phone; // preserva ID de grupo
  let d = phone.replace(/\D/g, "");
  if ((d.length === 10 || d.length === 11) && !d.startsWith("55")) d = "55" + d;
  return d;
}

// ---------- Envio ----------

function extractMessageId(data: Record<string, unknown>): string | null {
  const key = data.key as Record<string, unknown> | undefined;
  return (key?.id as string) || (data.messageId as string) || (data.zaapId as string) || (data.id as string) || null;
}

// O provedor respondeu HTTP 200 sem `error`, mas sem messageId reconhecível — a
// mensagem provavelmente FOI entregue (não houve erro de rede/API), só não dá
// para confirmar o ID. Distinto de uma falha real (rede/HTTP/erro do provedor),
// para não reenviar (duplicar) uma mensagem que talvez já tenha chegado.
export class EnvioNaoConfirmadoError extends Error {
  constructor() {
    super("Envio não confirmado (sem messageId).");
    this.name = "EnvioNaoConfirmadoError";
  }
}

// Nunca prefixa a mensagem com o nome do operador/IA — o cliente não deve ver
// rótulos internos (ex.: "*Cérebro:*"). Esses rótulos ficam só em
// WhatsAppMessage.operatorDisplayName, visível apenas dentro do CRM.
export async function sendText(phone: string, message: string): Promise<string> {
  if (provedorWhatsApp() === "evolution") {
    const data = await evoFetch("POST", `/message/sendText/${evoInstancia()}`, {
      number: evoDestino(phone), text: message, delay: 1200,
    });
    const id = extractMessageId(data);
    if (!id) throw new EnvioNaoConfirmadoError();
    return id;
  }
  const data = await zapiPost("send-text", { phone: normalizePhone(phone), message, delayMessage: 2 });
  const id = extractMessageId(data);
  if (!id) throw new EnvioNaoConfirmadoError();
  return id;
}

export async function sendImage(phone: string, imageUrl: string, caption?: string): Promise<string> {
  if (provedorWhatsApp() === "evolution") {
    const data = await evoFetch("POST", `/message/sendMedia/${evoInstancia()}`, {
      number: evoDestino(phone), mediatype: "image", media: imageUrl, caption: caption ?? "",
    });
    return extractMessageId(data) ?? "";
  }
  const data = await zapiPost("send-image", { phone: normalizePhone(phone), image: imageUrl, caption: caption ?? "" });
  return extractMessageId(data) ?? "";
}

export async function sendAudio(phone: string, audioUrl: string): Promise<string> {
  if (provedorWhatsApp() === "evolution") {
    const data = await evoFetch("POST", `/message/sendWhatsAppAudio/${evoInstancia()}`, {
      number: evoDestino(phone), audio: audioUrl,
    });
    return extractMessageId(data) ?? "";
  }
  const data = await zapiPost("send-audio", { phone: normalizePhone(phone), audio: audioUrl });
  return extractMessageId(data) ?? "";
}

// Envia um documento gerado no servidor (PDF) sem precisar hospedar o arquivo:
// Z-API aceita data URL base64 no campo `document`; Evolution aceita base64 puro em `media`.
export async function sendDocumentBase64(phone: string, base64: string, fileName: string, mimeType = "application/pdf", caption?: string): Promise<string> {
  if (provedorWhatsApp() === "evolution") {
    const data = await evoFetch("POST", `/message/sendMedia/${evoInstancia()}`, {
      number: evoDestino(phone), mediatype: "document", mimetype: mimeType, media: base64, fileName, caption: caption ?? "",
    });
    return extractMessageId(data) ?? "";
  }
  const ext = (fileName.split(".").pop() || "pdf").toLowerCase();
  const data = await zapiPost(`send-document/${ext}`, {
    phone: normalizePhone(phone), document: `data:${mimeType};base64,${base64}`, fileName, caption: caption ?? "",
  });
  return extractMessageId(data) ?? "";
}

// Foto enviada a partir do CRM (base64 puro, sem hospedar).
export async function sendImageBase64(phone: string, base64: string, mimeType: string, caption?: string): Promise<string> {
  if (provedorWhatsApp() === "evolution") {
    const data = await evoFetch("POST", `/message/sendMedia/${evoInstancia()}`, {
      number: evoDestino(phone), mediatype: "image", mimetype: mimeType, media: base64, caption: caption ?? "", fileName: "foto.jpg",
    });
    return extractMessageId(data) ?? "";
  }
  const data = await zapiPost("send-image", { phone: normalizePhone(phone), image: `data:${mimeType};base64,${base64}`, caption: caption ?? "" });
  return extractMessageId(data) ?? "";
}

// Áudio gravado no CRM (base64). A Evolution converte para o formato de
// mensagem de voz do WhatsApp; a Z-API aceita data URL.
export async function sendAudioBase64(phone: string, base64: string, mimeType: string): Promise<string> {
  if (provedorWhatsApp() === "evolution") {
    const data = await evoFetch("POST", `/message/sendWhatsAppAudio/${evoInstancia()}`, {
      number: evoDestino(phone), audio: base64, encoding: true,
    });
    return extractMessageId(data) ?? "";
  }
  const data = await zapiPost("send-audio", { phone: normalizePhone(phone), audio: `data:${mimeType};base64,${base64}`, waveform: true });
  return extractMessageId(data) ?? "";
}

// Baixa a mídia de uma mensagem recebida pela Evolution (foto, documento,
// vídeo) a partir do id da mensagem — a Evolution guarda a mensagem no banco
// dela (DATABASE_SAVE_DATA_NEW_MESSAGE) e devolve o conteúdo em base64.
export async function baixarMidiaEvolution(messageId: string): Promise<{ base64: string; mimeType: string; fileName: string | null } | null> {
  if (provedorWhatsApp() !== "evolution") return null;
  try {
    const data = await evoFetch("POST", `/chat/getBase64FromMediaMessage/${evoInstancia()}`, {
      message: { key: { id: messageId } }, convertToMp4: false,
    });
    const base64 = typeof data.base64 === "string" ? data.base64 : null;
    if (!base64) return null;
    return {
      base64,
      mimeType: (typeof data.mimetype === "string" && data.mimetype) || "application/octet-stream",
      fileName: typeof data.fileName === "string" ? data.fileName : null,
    };
  } catch (e) {
    console.error("[evolution] mídia:", e);
    return null;
  }
}

export async function sendDocument(phone: string, docUrl: string, fileName: string): Promise<string> {
  if (provedorWhatsApp() === "evolution") {
    const data = await evoFetch("POST", `/message/sendMedia/${evoInstancia()}`, {
      number: evoDestino(phone), mediatype: "document", media: docUrl, fileName,
    });
    return extractMessageId(data) ?? "";
  }
  const ext = (fileName.split(".").pop() || "pdf").toLowerCase();
  const data = await zapiPost(`send-document/${ext}`, { phone: normalizePhone(phone), document: docUrl, fileName });
  return extractMessageId(data) ?? "";
}

// ---------- Webhook (Z-API) ----------

// Nem todo plano/conta da Z-API oferece um "Client-Token" de segurança para
// carimbar nos webhooks — quando não está disponível, não dá para exigir essa
// validação sem quebrar o recebimento de mensagens de verdade. Por isso: se
// ZAPI_WEBHOOK_TOKEN estiver configurado, valida estritamente (fail-closed);
// se não estiver, aceita o POST (a URL do webhook não é pública/óbvia, e
// isAllowedInstance() no route.ts confere o instanceId como camada extra).
export function validateWebhook(clientTokenHeader: string | null): boolean {
  const expected = process.env.ZAPI_WEBHOOK_TOKEN;
  if (expected) return clientTokenHeader === expected;
  return true;
}

export function expectedZApiInstanceId(): string | null {
  return process.env.ZAPI_INSTANCE_ID || null;
}

// ---------- Histórico / contato ----------

type ChatResumo = { phone: string; name?: string; isGroup?: boolean; photo?: string | null };

async function listarChatsEvolution(page: number, pageSize: number): Promise<ChatResumo[]> {
  const data = await evoFetch("POST", `/chat/findChats/${evoInstancia()}`, {}).catch(() => null);
  const lista: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown> | null)?.chats)
    ? ((data as Record<string, unknown>).chats as unknown[])
    : [];
  const chats: (ChatResumo & { ts: number })[] = [];
  for (const item of lista) {
    const c = item as Record<string, unknown>;
    const jid = String(c.remoteJid ?? c.id ?? "");
    if (!jid || jid.endsWith("@broadcast")) continue;
    const isGroup = jid.endsWith("@g.us");
    const ts = c.updatedAt
      ? new Date(String(c.updatedAt)).getTime()
      : Number(c.lastMessageTimestamp ?? c.messageTimestamp ?? 0) || 0;
    chats.push({
      phone: isGroup ? jid : jid.split("@")[0],
      name: (c.name as string) ?? (c.pushName as string) ?? undefined,
      isGroup,
      photo: (c.profilePicUrl as string) ?? null,
      ts: Number.isFinite(ts) ? ts : 0,
    });
  }
  chats.sort((a, b) => b.ts - a.ts);
  return chats.slice((page - 1) * pageSize, page * pageSize).map(({ phone, name, isGroup, photo }) => ({ phone, name, isGroup, photo }));
}

export async function listarChats(page = 1, pageSize = 5): Promise<ChatResumo[]> {
  if (provedorWhatsApp() === "evolution") return listarChatsEvolution(page, pageSize);
  const data = await zapiGet(`chats?page=${page}&pageSize=${pageSize}`).catch(() => []);
  if (!Array.isArray(data)) return [];
  return data.map((c: Record<string, unknown>) => ({
    phone: String(c.phone ?? c.id ?? ""),
    name: (c.name as string) ?? (c.chatName as string) ?? undefined,
    isGroup: c.isGroup === true || String(c.phone ?? "").includes("@g.us"),
    photo: (c.imagePreview as string) ?? (c.profileThumbnail as string) ?? (c.image as string) ?? null,
  })).filter((c) => c.phone);
}

// Devolve mensagens no formato "estilo Z-API" (messageId/fromMe/momment/text…)
// — a importação de histórico (api/whatsapp/import-history) só conhece esse
// formato, então a Evolution é convertida antes de devolver.
export async function mensagensDoChat(phone: string, amount = 200): Promise<Record<string, unknown>[]> {
  if (provedorWhatsApp() === "evolution") {
    // "limit" é das versões antigas; nas 2.x quem manda é "offset" (tamanho
    // da página, 50 por padrão) — sem ele a importação parava nas 50 últimas.
    const data = await evoFetch("POST", `/chat/findMessages/${evoInstancia()}`, {
      where: { key: { remoteJid: evoJidChat(phone) } },
      limit: amount,
      page: 1,
      offset: amount,
    }).catch(() => null);
    const mensagens = data?.messages as Record<string, unknown> | unknown[] | undefined;
    const registros: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray(mensagens)
      ? mensagens
      : Array.isArray((mensagens as Record<string, unknown> | undefined)?.records)
      ? ((mensagens as Record<string, unknown>).records as unknown[])
      : [];
    return registros.map((r) => mensagemEvolutionParaZapi(r as Record<string, unknown>));
  }
  const data = await zapiGet(`chat-messages/${phone}?amount=${amount}`).catch(() => []);
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export async function fotoPerfil(phone: string): Promise<string | null> {
  try {
    if (provedorWhatsApp() === "evolution") {
      const data = await evoFetch("POST", `/chat/fetchProfilePictureUrl/${evoInstancia()}`, { number: evoDestino(phone) });
      return (data?.profilePictureUrl as string) ?? null;
    }
    const data = (await zapiGet(`profile-picture?phone=${normalizePhone(phone)}`)) as Record<string, unknown>;
    return (data?.link as string) ?? (data?.url as string) ?? null;
  } catch {
    return null;
  }
}

// Configura o webhook da instância na Evolution a partir do CRM (sem curl):
// eventos de mensagem + status, base64 ligado para os áudios.
export async function configurarWebhookEvolution(urlWebhook: string): Promise<{ ok: boolean; erro?: string }> {
  if (provedorWhatsApp() !== "evolution") return { ok: false, erro: "Evolution API não configurada." };
  try {
    await evoFetch("POST", `/webhook/set/${evoInstancia()}`, {
              webhook: { enabled: true, url: urlWebhook, headers: evolutionConfig()?.apiKey ? { apikey: evolutionConfig()!.apiKey } : undefined, byEvents: false, base64: true, events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE"] },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// URL pública deste CRM. Ordem: NEXTAUTH_URL (o que o vendedor definiu) →
// VERCEL_PROJECT_PRODUCTION_URL (domínio de produção do projeto, ex.:
// crm-xxx.vercel.app) → VERCEL_URL. Esta última é a URL ÚNICA do deploy
// (crm-abc123-usuario.vercel.app), que a Vercel protege com login por padrão:
// a Evolution chamava, levava uma tela de autenticação da Vercel e a mensagem
// morria ali, sem o CRM nem ficar sabendo. Por isso ela é a última opção.
export function urlPublicaCrm(): string | null {
  const candidatos = [
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "",
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ];
  for (const c of candidatos) {
    const base = (c ?? "").trim().replace(/\/+$/, "");
    if (base) return base;
  }
  return null;
}

// URL que a Evolution deve chamar. null quando não dá para descobrir.
export function urlWebhookCrm(): string | null {
  const base = urlPublicaCrm();
  return base ? `${base}/api/webhooks/evolution?apikey=${encodeURIComponent(evolutionConfig()?.apiKey ?? "")}` : null;
}

// Token PRÓPRIO da instância na Evolution. É ele (e não a chave global) que a
// Evolution 2.x carimba no campo "apikey" de cada webhook — quando a instância
// foi criada sem token, ela gera um aleatório, e o webhook do CRM recusava a
// chamada com 401 achando que era um intruso. Cache de 10 min.
let cacheToken: { valor: string | null; em: number } | null = null;
export async function tokenDaInstancia(): Promise<string | null> {
  const cfg = evolutionConfig();
  if (!cfg) return null;
  if (cacheToken && Date.now() - cacheToken.em < 10 * 60_000) return cacheToken.valor;
  let valor: string | null = null;
  try {
    const data = await evoFetch("GET", `/instance/fetchInstances?instanceName=${evoInstancia()}`, undefined, TEMPO_TELA_MS);
    const lista: unknown[] = Array.isArray(data) ? data : [data];
    for (const item of lista) {
      const o = item as Record<string, unknown>;
      const inst = (o.instance as Record<string, unknown> | undefined) ?? o;
      const nome = String(inst.instanceName ?? inst.name ?? o.name ?? "");
      if (nome && nome !== cfg.instance) continue;
      const t = [o.token, o.hash, inst.token, inst.apikey, (o.hash as Record<string, unknown> | undefined)?.apikey]
        .find((v) => typeof v === "string" && v);
      if (typeof t === "string") { valor = t; break; }
    }
  } catch (e) {
    console.error("[evolution] token da instância:", e instanceof Error ? e.message : e);
  }
  cacheToken = { valor, em: Date.now() };
  return valor;
}

// Simula a Evolution chamando o webhook: faz um POST de fora (pela URL que
// está configurada na instância) com um evento inofensivo e vê o que volta.
// É o único jeito de descobrir, sem log da Vercel, se a chamada morre no
// caminho (tela de login da Vercel, URL errada, chave recusada).
export type TesteWebhook = { ok: boolean; url: string | null; detalhe: string };
export async function testarWebhookDeFora(urlConfigurada: string | null): Promise<TesteWebhook> {
  const cfg = evolutionConfig();
  if (!cfg) return { ok: false, url: null, detalhe: "Evolution não configurada." };
  const url = (urlConfigurada ?? "").trim();
  if (!url) return { ok: false, url: null, detalhe: "a instância não tem webhook configurado" };
  // O que a Evolution 2.x manda de verdade: a chave no corpo é o token da
  // instância (ou a global, quando a instância foi criada com ela).
  const apikeyNoCorpo = (await tokenDaInstancia()) ?? cfg.apiKey;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "crm-teste-webhook" },
      body: JSON.stringify({ event: "connection.update", instance: cfg.instance, data: { state: "open", teste: true }, apikey: apikeyNoCorpo }),
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_TELA_MS),
    });
    const tipo = res.headers.get("content-type") ?? "";
    const texto = await res.text().catch(() => "");
    if (res.ok && /json/.test(tipo)) return { ok: true, url, detalhe: `respondeu HTTP ${res.status} — a chamada chega e a chave é aceita` };
    if (/html/.test(tipo) || /vercel/i.test(texto) && (res.status === 401 || res.status === 403)) {
      return { ok: false, url, detalhe: `HTTP ${res.status} com uma página HTML — a Vercel está barrando com tela de login antes de chegar no CRM (URL de deploy protegida, ou domínio errado)` };
    }
    if (res.status === 401) return { ok: false, url, detalhe: "HTTP 401 — o CRM recusou a chave que a Evolution manda" };
    if (res.status === 404) return { ok: false, url, detalhe: "HTTP 404 — essa URL não é o webhook do CRM (caminho ou domínio errado)" };
    return { ok: false, url, detalhe: `HTTP ${res.status} ${texto.slice(0, 120)}` };
  } catch (e) {
    const tempo = e instanceof Error && e.name === "TimeoutError";
    return { ok: false, url, detalhe: tempo ? "não respondeu em 10s" : "endereço inalcançável (domínio errado ou fora do ar)" };
  }
}

// Cria a instância com o nome de EVOLUTION_INSTANCE (canal Baileys, QR Code)
// já apontando o webhook para o CRM. Tenta o formato das versões 2.x e, se a
// Evolution recusar, o formato "plano" das 1.x. Devolve o QR quando ele já vem
// na resposta.
export async function criarInstanciaEvolution(urlWebhook: string | null): Promise<{ ok: boolean; erro?: string; qr?: string | null }> {
  if (provedorWhatsApp() !== "evolution") return { ok: false, erro: "Evolution API não configurada." };
  const nome = evolutionConfig()?.instance ?? "";
  const eventos = ["MESSAGES_UPSERT", "MESSAGES_UPDATE"];
  // syncFullHistory: ao parear, o celular manda o histórico inteiro das
  // conversas para a Evolution — é isso que "Importar conversas" puxa.
  // token = chave global: o "apikey" que a Evolution carimba em cada webhook
  // passa a ser a chave que o CRM já conhece (sem token ela gera um aleatório).
  const token = evolutionConfig()?.apiKey ?? "";
  const corpoV2: Record<string, unknown> = { instanceName: nome, token, integration: "WHATSAPP-BAILEYS", qrcode: true, syncFullHistory: true };
  const corpoV1: Record<string, unknown> = { instanceName: nome, token, integration: "WHATSAPP-BAILEYS", qrcode: true, sync_full_history: true };
  if (urlWebhook) {
    corpoV2.webhook = { enabled: true, url: urlWebhook, byEvents: false, base64: true, events: eventos };
    Object.assign(corpoV1, { webhook: urlWebhook, webhook_by_events: false, webhook_base64: true, events: eventos });
  }
  const extrairQr = (data: Record<string, unknown>): string | null => {
    const q = data.qrcode as Record<string, unknown> | undefined;
    const b64 = typeof q?.base64 === "string" ? q.base64 : null;
    return b64 ? (b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`) : null;
  };
  try {
    const data = await evoFetch("POST", "/instance/create", corpoV2);
    return { ok: true, qr: extrairQr(data) };
  } catch (e1) {
    const msg1 = e1 instanceof Error ? e1.message : String(e1);
    // Já existe: não é erro para quem só quer conectar.
    if (/already|já existe|in use|em uso/i.test(msg1)) return { ok: true, qr: null };
    try {
      const data = await evoFetch("POST", "/instance/create", corpoV1);
      return { ok: true, qr: extrairQr(data) };
    } catch (e2) {
      return { ok: false, erro: e2 instanceof Error ? e2.message : msg1 };
    }
  }
}

// Lê o webhook atual da instância (para o painel de conexão conferir).
export async function lerWebhookEvolution(): Promise<{ url: string | null; enabled: boolean } | null> {
  if (provedorWhatsApp() !== "evolution") return null;
  try {
    const data = await evoFetch("GET", `/webhook/find/${evoInstancia()}`);
    const w = (data.webhook as Record<string, unknown> | undefined) ?? data;
    return { url: typeof w.url === "string" ? w.url : null, enabled: w.enabled === true };
  } catch {
    return null;
  }
}

// Garante que a instância pede o histórico completo ao celular. Sem isso a
// Evolution só guarda o que chega DEPOIS de conectar, e "Importar conversas"
// não tem de onde puxar. A troca só vale no próximo pareamento (QR).
export async function ligarHistoricoCompleto(): Promise<{ ok: boolean; jaEstava: boolean; erro?: string }> {
  if (provedorWhatsApp() !== "evolution") return { ok: false, jaEstava: false, erro: "Evolution API não configurada." };
  try {
    const lido = await evoFetch("GET", `/settings/find/${evoInstancia()}`, undefined, TEMPO_TELA_MS).catch(() => ({} as Record<string, unknown>));
    const atual = ((lido.settings as Record<string, unknown> | undefined) ?? lido) as Record<string, unknown>;
    if (atual.syncFullHistory === true || atual.sync_full_history === true) return { ok: true, jaEstava: true };
    // O /settings/set substitui TODAS as opções: mando as atuais de volta e só
    // troco a do histórico. Padrões da Evolution quando ela não devolveu nada.
    const corpo: Record<string, unknown> = {
      rejectCall: atual.rejectCall === true,
      msgCall: typeof atual.msgCall === "string" ? atual.msgCall : "",
      groupsIgnore: atual.groupsIgnore === true,
      alwaysOnline: atual.alwaysOnline === true,
      readMessages: atual.readMessages === true,
      readStatus: atual.readStatus === true,
      syncFullHistory: true,
    };
    await evoFetch("POST", `/settings/set/${evoInstancia()}`, corpo, TEMPO_TELA_MS);
    return { ok: true, jaEstava: false };
  } catch (e) {
    return { ok: false, jaEstava: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// Quantas conversas (sem grupo) a Evolution tem guardadas — zero significa
// que o histórico do celular ainda não chegou nela.
export async function contarConversasGuardadas(): Promise<number> {
  const todas = await listarChats(1, 100_000).catch(() => []);
  return todas.filter((c) => !c.isGroup).length;
}

// ---------- Diagnóstico da conexão ----------

// Testa a corrente inteira, um elo por vez, para a tela dizer exatamente ONDE
// quebrou: variáveis na Vercel → servidor no ar → chave aceita → instância
// existe → pareada → webhook apontado. Sem isto, qualquer falha virava um
// "timeout" genérico que não indica o que consertar.
export type EtapaDiagnostico = { etapa: string; ok: boolean; detalhe: string };
export type Diagnostico = { provedor: ProvedorWhatsApp | null; url: string | null; instancia: string | null; etapas: EtapaDiagnostico[]; conclusao: string };

export async function diagnosticarConexao(): Promise<Diagnostico> {
  const cfg = evolutionConfig();
  const etapas: EtapaDiagnostico[] = [];
  const fim = (conclusao: string): Diagnostico => ({
    provedor: provedorWhatsApp(), url: cfg?.url ?? null, instancia: cfg?.instance ?? null, etapas, conclusao,
  });

  if (!cfg) {
    const faltando = ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE"].filter((v) => !(process.env[v] ?? "").trim());
    etapas.push({ etapa: "Variáveis na Vercel", ok: false, detalhe: `Faltando: ${faltando.join(", ")}` });
    return fim("O CRM não sabe onde fica sua Evolution API. Preencha as variáveis na Vercel (Settings → Environment Variables) e faça Redeploy.");
  }
  etapas.push({ etapa: "Variáveis na Vercel", ok: true, detalhe: `${cfg.url} · instância "${cfg.instance}"` });

  // 1. O servidor responde?
  const inicio = Date.now();
  try {
    const res = await fetch(`${cfg.url}/`, { cache: "no-store", signal: AbortSignal.timeout(TEMPO_TELA_MS) });
    etapas.push({ etapa: "Servidor no ar", ok: true, detalhe: `respondeu HTTP ${res.status} em ${Date.now() - inicio}ms` });
  } catch (e) {
    const tempo = e instanceof Error && e.name === "TimeoutError";
    etapas.push({
      etapa: "Servidor no ar", ok: false,
      detalhe: tempo ? `não respondeu em ${TEMPO_TELA_MS / 1000}s` : "endereço inalcançável (DNS, porta fechada ou servidor desligado)",
    });
    return fim(
      `Nada responde em ${cfg.url}, então nenhum QR pode ser gerado — o código quem cria é esse servidor. ` +
      "São três causas possíveis, nesta ordem: (1) a VPS está desligada ou o container caiu — entre por SSH e rode \"docker compose up -d\"; " +
      "(2) a porta está fechada no firewall — libere com \"ufw allow 8080\" e confira também o firewall do painel da hospedagem; " +
      "(3) o IP da VPS mudou — pegue o endereço atual e atualize EVOLUTION_API_URL na Vercel, com Redeploy depois."
    );
  }

  // 2. A chave é aceita e a instância existe?
  try {
    const data = await evoFetch("GET", `/instance/connectionState/${evoInstancia()}`, undefined, TEMPO_TELA_MS);
    etapas.push({ etapa: "Chave (apikey) aceita", ok: true, detalhe: "a Evolution respondeu à consulta autenticada" });
    const state = estadoDaResposta(data) || "desconhecido";
    etapas.push({ etapa: `Instância "${cfg.instance}"`, ok: true, detalhe: `existe · estado "${state}"` });
    if (state === "open") {
      const w = await lerWebhookEvolution();
      const esperado = urlWebhookCrm();
      const ok = !!(w && w.enabled && esperado && (w.url ?? "").replace(/\/+$/, "") === esperado.replace(/\/+$/, ""));
      etapas.push({ etapa: "Webhook apontado para o CRM", ok, detalhe: ok ? "certo" : `está em "${w?.url ?? "vazio"}" — deveria ser "${esperado ?? "(defina NEXTAUTH_URL)"}"` });

      // 3. A chamada chega de verdade? (o passo que faltava: webhook "certo"
      // na Evolution mas morrendo numa tela de login da Vercel parecia tudo ok)
      const teste = await testarWebhookDeFora(w?.enabled ? w.url : null);
      etapas.push({ etapa: "Chamada de teste no webhook", ok: teste.ok, detalhe: teste.detalhe });
      if (teste.ok && ok) return fim("Tudo certo: número pareado, webhook no lugar e a chamada de teste chegou no CRM. Se ainda assim nada aparece, mande uma mensagem de teste e veja \"Últimos eventos\" abaixo.");
      if (teste.ok) return fim("As chamadas estão chegando, mas o webhook está numa URL diferente da esperada — o CRM corrige sozinho na próxima verificação (ou clique em \"Configurar webhook agora\").");
      if (/HTML|login da Vercel/.test(teste.detalhe)) {
        return fim(
          "Achei o problema: a Evolution chama o CRM, mas a Vercel devolve uma tela de login antes de a mensagem chegar. " +
          `Na Vercel, em Settings → Environment Variables, defina NEXTAUTH_URL com o endereço que você usa no navegador (ex.: ${urlPublicaCrm() ?? "https://SEU-CRM.vercel.app"}), faça Redeploy e clique em "Configurar webhook agora".`
        );
      }
      if (/401/.test(teste.detalhe)) return fim("A chamada chega, mas o CRM recusa a chave. Clique em \"Configurar webhook agora\" — o CRM reconfigura o webhook mandando a chave certa no cabeçalho.");
      return fim(`A Evolution não consegue entregar no CRM: ${teste.detalhe}. Clique em "Configurar webhook agora" para reapontar; se continuar, confira NEXTAUTH_URL na Vercel.`);
    }
    return fim(`A instância existe e está "${state}" (não pareada). Clique em "Gerar novo QR" e escaneie com o celular.`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/\(401\)|\(403\)|unauthorized/i.test(msg)) {
      etapas.push({ etapa: "Chave (apikey) aceita", ok: false, detalhe: "a Evolution recusou a chave" });
      return fim("O servidor respondeu, mas recusou a chave: EVOLUTION_API_KEY na Vercel está diferente da AUTHENTICATION_API_KEY do servidor. Acerte as duas e faça Redeploy.");
    }
    if (/\(404\)/.test(msg) || /does not exist|não existe/i.test(msg)) {
      etapas.push({ etapa: "Chave (apikey) aceita", ok: true, detalhe: "a Evolution respondeu à consulta autenticada" });
      etapas.push({ etapa: `Instância "${cfg.instance}"`, ok: false, detalhe: "não existe neste servidor" });
      return fim(`O servidor está no ar, mas não tem nenhuma instância chamada "${cfg.instance}". Clique em "Gerar novo QR" — o CRM cria a instância e já mostra o código.`);
    }
    etapas.push({ etapa: "Consulta à instância", ok: false, detalhe: msg.slice(0, 200) });
    return fim("O servidor respondeu, mas a consulta falhou. O detalhe acima vem da própria Evolution.");
  }
}

// ---------- Conexão (QR / status) ----------

export type StatusConexao = {
  configurado: boolean;
  conectado: boolean;
  precisaQrCode: boolean;
  clientTokenConfigurado: boolean;
  provedor?: ProvedorWhatsApp | null;
  erro?: string | null;
  // Evolution: a instância com o nome de EVOLUTION_INSTANCE ainda não foi criada
  // (a tela /conexao oferece o botão "Criar instância").
  instanciaNaoExiste?: boolean;
  // Evolution: o webhook da instância aponta para urlWebhookEsperada? null = não
  // conferido (a Evolution não respondeu ou não está conectada).
  webhookOk?: boolean | null;
  instancia?: string | null;
};

export async function statusConexao(urlWebhookEsperada?: string | null): Promise<StatusConexao> {
  const provedor = provedorWhatsApp();
  if (!provedor) {
    return { configurado: false, conectado: false, precisaQrCode: false, clientTokenConfigurado: !!process.env.ZAPI_CLIENT_TOKEN, provedor: null };
  }

  if (provedor === "evolution") {
    const instancia = evolutionConfig()?.instance ?? null;
    try {
      const data = await evoFetch("GET", `/instance/connectionState/${evoInstancia()}`, undefined, TEMPO_TELA_MS);
      const state = String((data?.instance as Record<string, unknown> | undefined)?.state ?? data?.state ?? "");
      const conectado = state === "open";
      let webhookOk: boolean | null = null;
      if (urlWebhookEsperada) {
        const w = await lerWebhookEvolution();
        webhookOk = w ? w.enabled && (w.url ?? "").replace(/\/+$/, "") === urlWebhookEsperada.replace(/\/+$/, "") : null;
      }
      return { configurado: true, conectado, precisaQrCode: !conectado, clientTokenConfigurado: true, provedor, erro: null, webhookOk, instancia };
    } catch (e) {
      // `String(e)` deixava o texto "Error: ..." aparecer cru na tela.
      const msg = e instanceof Error ? e.message : String(e);
      const naoExiste = /\(404\)/.test(msg) || /does not exist|não existe/i.test(msg);
      const erro = naoExiste
        ? `A instância "${instancia}" ainda não existe na Evolution API. Clique em "Criar instância" abaixo.`
        : msg;
      return { configurado: true, conectado: false, precisaQrCode: true, clientTokenConfigurado: true, provedor, erro, instanciaNaoExiste: naoExiste, instancia };
    }
  }

  const clientTokenConfigurado = !!process.env.ZAPI_CLIENT_TOKEN;
  try {
    const data = (await zapiGet("status")) as { connected?: boolean; smartphoneConnected?: boolean; error?: string | null };
    const conectado = !!(data?.connected && data?.smartphoneConnected !== false);
    return { configurado: true, conectado, precisaQrCode: !conectado, clientTokenConfigurado, provedor, erro: data?.error ?? null };
  } catch (e) {
    return { configurado: true, conectado: false, precisaQrCode: true, clientTokenConfigurado, provedor, erro: String(e) };
  }
}

export async function obterQrCode(): Promise<{ imagem: string | null; erro?: string }> {
  const provedor = provedorWhatsApp();
  if (!provedor) return { imagem: null, erro: "WhatsApp não configurado (Evolution API ou Z-API)." };

  if (provedor === "evolution") {
    // Enquanto o vendedor está na tela do QR, o vigia não pode reiniciar a
    // instância — cada restart invalida o código que ele está escaneando.
    await pausarVigia(3).catch(() => {});
    try {
      const data = await evoFetch("GET", `/instance/connect/${evoInstancia()}`, undefined, TEMPO_TELA_MS);
      const imagem = extrairBase64Qr(data);
      if (imagem) return { imagem };
      if (estadoDaResposta(data) === "open") return { imagem: null, erro: "Já conectado." };

      // Sem imagem e fora do ar: a instância ficou presa em "connecting" com um
      // QR velho que a Evolution não devolve mais. Reinicia para forçar um
      // pareamento novo — é isso que faz o QR voltar a aparecer.
      if (!(await podeForcarNovoQr())) {
        return { imagem: null, erro: "Gerando um QR novo — aguarde alguns segundos e clique em \"Gerar novo QR\"." };
      }
      await marcarForcaNovoQr();
      await reiniciar().catch(() => false);
      await new Promise((r) => setTimeout(r, 2500));
      const data2 = await evoFetch("GET", `/instance/connect/${evoInstancia()}`, undefined, TEMPO_TELA_MS);
      const imagem2 = extrairBase64Qr(data2);
      if (imagem2) return { imagem: imagem2 };
      if (estadoDaResposta(data2) === "open") return { imagem: null, erro: "Já conectado." };
      return { imagem: null, erro: "A Evolution respondeu sem o QR. Clique em \"Gerar novo QR\" mais uma vez — se insistir, reinicie a instância." };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Instância inexistente: cria agora (o create já devolve o QR).
      if (/\(404\)/.test(msg) || /does not exist|não existe/i.test(msg)) {
        const r = await criarInstanciaEvolution(urlWebhookCrm()).catch(() => ({ ok: false, qr: null as string | null }));
        if (r.ok && r.qr) return { imagem: r.qr };
        if (r.ok) {
          await new Promise((res) => setTimeout(res, 2000));
          const data3 = await evoFetch("GET", `/instance/connect/${evoInstancia()}`, undefined, TEMPO_TELA_MS).catch(() => ({}) as Record<string, unknown>);
          const imagem3 = extrairBase64Qr(data3);
          if (imagem3) return { imagem: imagem3 };
        }
        return { imagem: null, erro: `A instância "${evolutionConfig()?.instance}" não existe na Evolution. Criei agora — clique em "Gerar novo QR".` };
      }
      return { imagem: null, erro: msg };
    }
  }

  try {
    const data = (await zapiGet("qr-code/image")) as { value?: string };
    if (!data?.value) return { imagem: null, erro: "QR indisponível (talvez já conectado)." };
    const imagem = data.value.startsWith("data:") ? data.value : `data:image/png;base64,${data.value}`;
    return { imagem };
  } catch (e) {
    return { imagem: null, erro: String(e) };
  }
}

// Reabre o socket sem pedir QR: quando a instância ainda tem a credencial do
// pareamento, /instance/connect só reconecta (o QR só volta se o pareamento
// caiu de verdade). É o primeiro remédio do vigia da conexão.
export async function reconectar(): Promise<{ ok: boolean; conectado: boolean; erro?: string }> {
  if (provedorWhatsApp() !== "evolution") {
    const ok = await reiniciar();
    return { ok, conectado: false };
  }
  try {
    const data = await evoFetch("GET", `/instance/connect/${evoInstancia()}`, undefined, TEMPO_TELA_MS);
    const state = String((data?.instance as Record<string, unknown> | undefined)?.state ?? data?.state ?? "");
    return { ok: true, conectado: state === "open" };
  } catch (e) {
    return { ok: false, conectado: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function reiniciar(): Promise<boolean> {
  if (provedorWhatsApp() === "evolution") {
    // Versões da Evolution divergem no verbo (PUT nas 2.x, POST em outras).
    try { await evoFetch("PUT", `/instance/restart/${evoInstancia()}`); return true; } catch {}
    try { await evoFetch("POST", `/instance/restart/${evoInstancia()}`); return true; } catch { return false; }
  }
  try { await zapiGet("restart"); return true; } catch { return false; }
}

export async function desconectar(): Promise<boolean> {
  if (provedorWhatsApp() === "evolution") {
    try { await evoFetch("DELETE", `/instance/logout/${evoInstancia()}`); return true; } catch { return false; }
  }
  try { await zapiGet("disconnect"); return true; } catch { return false; }
}

export async function baixarAudio(url: string): Promise<{ buffer: ArrayBuffer; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return { buffer: await res.arrayBuffer(), mimeType: res.headers.get("content-type") ?? "audio/ogg" };
  } catch {
    return null;
  }
}
