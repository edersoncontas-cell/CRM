// Camada Z-API (spec seção 4). Reescrita para o novo sistema de atendimento.
// Resolve config das env vars (aceita as que o usuário JÁ tem) ou de WhatsAppSettings.

import { db } from "@/lib/db";

export type ZApiConfig = { instanceId: string; token: string; clientToken: string; apiUrl: string };

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
  return envConfig() !== null;
}

function headers(clientToken: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) h["Client-Token"] = clientToken;
  return h;
}

// POST genérico. Trata HTTP 200 com `error` no corpo (instância desconectada).
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
  return (data.messageId as string) || (data.zaapId as string) || (data.id as string) || null;
}

// A Z-API respondeu HTTP 200 sem `error`, mas sem messageId reconhecível — a
// mensagem provavelmente FOI entregue (não houve erro de rede/API), só não dá
// para confirmar o ID. Distinto de uma falha real (rede/HTTP/erro da Z-API),
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
  const data = await zapiPost("send-text", { phone: normalizePhone(phone), message, delayMessage: 2 });
  const id = extractMessageId(data);
  if (!id) throw new EnvioNaoConfirmadoError();
  return id;
}

export async function sendImage(phone: string, imageUrl: string, caption?: string): Promise<string> {
  const data = await zapiPost("send-image", { phone: normalizePhone(phone), image: imageUrl, caption: caption ?? "" });
  return extractMessageId(data) ?? "";
}

export async function sendAudio(phone: string, audioUrl: string): Promise<string> {
  const data = await zapiPost("send-audio", { phone: normalizePhone(phone), audio: audioUrl });
  return extractMessageId(data) ?? "";
}

export async function sendDocument(phone: string, docUrl: string, fileName: string): Promise<string> {
  const ext = (fileName.split(".").pop() || "pdf").toLowerCase();
  const data = await zapiPost(`send-document/${ext}`, { phone: normalizePhone(phone), document: docUrl, fileName });
  return extractMessageId(data) ?? "";
}

// ---------- Webhook ----------

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

export async function listarChats(page = 1, pageSize = 5): Promise<Array<{ phone: string; name?: string; isGroup?: boolean; photo?: string | null }>> {
  const data = await zapiGet(`chats?page=${page}&pageSize=${pageSize}`).catch(() => []);
  if (!Array.isArray(data)) return [];
  return data.map((c: Record<string, unknown>) => ({
    phone: String(c.phone ?? c.id ?? ""),
    name: (c.name as string) ?? (c.chatName as string) ?? undefined,
    isGroup: c.isGroup === true || String(c.phone ?? "").includes("@g.us"),
    photo: (c.imagePreview as string) ?? (c.profileThumbnail as string) ?? (c.image as string) ?? null,
  })).filter((c) => c.phone);
}

export async function mensagensDoChat(phone: string, amount = 200): Promise<Record<string, unknown>[]> {
  const data = await zapiGet(`chat-messages/${phone}?amount=${amount}`).catch(() => []);
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export async function fotoPerfil(phone: string): Promise<string | null> {
  try {
    const data = (await zapiGet(`profile-picture?phone=${normalizePhone(phone)}`)) as Record<string, unknown>;
    return (data?.link as string) ?? (data?.url as string) ?? null;
  } catch {
    return null;
  }
}

// ---------- Conexão (QR / status) ----------

export async function statusConexao(): Promise<{ configurado: boolean; conectado: boolean; precisaQrCode: boolean; clientTokenConfigurado: boolean; erro?: string | null }> {
  const clientTokenConfigurado = !!process.env.ZAPI_CLIENT_TOKEN;
  if (!isEnabled()) return { configurado: false, conectado: false, precisaQrCode: false, clientTokenConfigurado };
  try {
    const data = (await zapiGet("status")) as { connected?: boolean; smartphoneConnected?: boolean; error?: string | null };
    const conectado = !!(data?.connected && data?.smartphoneConnected !== false);
    return { configurado: true, conectado, precisaQrCode: !conectado, clientTokenConfigurado, erro: data?.error ?? null };
  } catch (e) {
    return { configurado: true, conectado: false, precisaQrCode: true, clientTokenConfigurado, erro: String(e) };
  }
}

export async function obterQrCode(): Promise<{ imagem: string | null; erro?: string }> {
  if (!isEnabled()) return { imagem: null, erro: "Z-API não configurada." };
  try {
    const data = (await zapiGet("qr-code/image")) as { value?: string };
    if (!data?.value) return { imagem: null, erro: "QR indisponível (talvez já conectado)." };
    const imagem = data.value.startsWith("data:") ? data.value : `data:image/png;base64,${data.value}`;
    return { imagem };
  } catch (e) {
    return { imagem: null, erro: String(e) };
  }
}

export async function reiniciar(): Promise<boolean> {
  try { await zapiGet("restart"); return true; } catch { return false; }
}

export async function desconectar(): Promise<boolean> {
  try { await zapiGet("disconnect"); return true; } catch { return false; }
}

export async function baixarAudio(url: string): Promise<{ buffer: ArrayBuffer; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return { buffer: await res.arrayBuffer(), mimeType: res.headers.get("content-type") ?? "audio/ogg" };
  } catch {
    return null;
  }
}
