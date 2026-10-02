import { exigirEnvioLiberado } from "@/lib/whatsapp-pausa";
// Camada de WhatsApp — abstrai o PROVEDOR de envio/conexão:
//   • Evolution API (open source, GRÁTIS, self-hosted) — env EVOLUTION_API_URL,
//     EVOLUTION_API_KEY e EVOLUTION_INSTANCE. Tem prioridade quando configurada.
//   • Z-API (paga) — env ZAPI_INSTANCE_ID + ZAPI_TOKEN/ZAPI_INSTANCE_TOKEN
//     (+ ZAPI_CLIENT_TOKEN), ou WhatsAppSettings no banco.
// O nome do arquivo (zapi.ts) foi mantido de propósito: ~20 módulos importam
// daqui e a assinatura de todas as funções continua idêntica — só o transporte
// muda por baixo.

import { db } from "@/lib/db";
import { apagarEvolution } from "@/lib/whatsapp-apagar-instancia";
import { CHAVE_INSTANCIA_ATIVA, lerInstanciaGuardada, instanciaQueVale, proximoNomeInstancia } from "@/lib/whatsapp-instancia-nome";
import { mensagemEvolutionParaZapi, extrairBase64Qr, estadoDaResposta, textoDoErroEvolution } from "@/lib/evolution";
import { pausarVigia, podeForcarNovoQr, marcarForcaNovoQr } from "@/lib/whatsapp-vigia-pausa";
import { desconectarEvolution, type ResultadoDesconexao } from "@/lib/whatsapp-desconectar";
import { getConfig, setConfig } from "@/lib/config";

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
  // O nome da instância entra aqui, e não em quem monta o caminho: ele pode
  // ter mudado (crm → crm-2) e mora no banco — ver nomeDaInstancia.
  const caminho = path.includes(MARCA_INSTANCIA)
    ? path.split(MARCA_INSTANCIA).join(encodeURIComponent(await nomeDaInstancia()))
    : path;
  let res: Response;
  try {
    res = await fetch(`${cfg.url}${caminho}`, {
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
    const detalhe = textoDoErroEvolution((data?.response as Record<string, unknown> | undefined)?.message ?? data?.message ?? data?.error) || JSON.stringify(data);
    throw new Error(`Evolution API ${caminho} falhou (${res.status}): ${detalhe.slice(0, 200)}`);
  }
  return data;
}

// ---------- Qual instância é a do CRM ----------
//
// Normalmente a da variável EVOLUTION_INSTANCE. Quando ela trava de um jeito
// que a Evolution não deixa nem sair nem apagar, o CRM cria outra (crm-2…) e
// guarda no banco qual vale (lib/whatsapp-instancia-nome.ts). Os caminhos
// levam uma MARCA no lugar do nome, e evoFetch troca pela instância que vale
// na hora — assim nenhum dos ~30 lugares que falam com a Evolution precisa
// saber disso.
const MARCA_INSTANCIA = "__INSTANCIA_DO_CRM__";
const VALIDADE_NOME_MS = 20_000;
let cacheInstancia: { nome: string; em: number } | null = null;

export async function nomeDaInstancia(opts?: { forcar?: boolean }): Promise<string> {
  const base = evolutionConfig()?.instance ?? "";
  if (!opts?.forcar && cacheInstancia && Date.now() - cacheInstancia.em < VALIDADE_NOME_MS) return cacheInstancia.nome;
  try {
    const nome = instanciaQueVale(base, lerInstanciaGuardada(await getConfig(CHAVE_INSTANCIA_ATIVA)));
    cacheInstancia = { nome, em: Date.now() };
    return nome;
  } catch {
    // Banco fora do ar: o último nome lido (mesmo velho) ou a variável.
    return cacheInstancia?.nome ?? base;
  }
}

/** A instância de antes da última troca (guarda a mídia das mensagens antigas). */
async function instanciaAnterior(): Promise<string | null> {
  const base = evolutionConfig()?.instance ?? "";
  try {
    const g = lerInstanciaGuardada(await getConfig(CHAVE_INSTANCIA_ATIVA));
    return g && g.base === base && g.anterior && g.anterior !== g.nome ? g.anterior : null;
  } catch {
    return null;
  }
}

async function ativarInstancia(nome: string, anterior: string): Promise<void> {
  const base = evolutionConfig()?.instance ?? "";
  await setConfig(CHAVE_INSTANCIA_ATIVA, JSON.stringify({ base, nome, anterior, desde: new Date().toISOString() }));
  cacheInstancia = { nome, em: Date.now() };
  cacheToken = null;
}

function evoInstancia(): string {
  return MARCA_INSTANCIA;
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
//
// TODA função daqui para baixo começa por exigirEnvioLiberado(): é a trava
// geral, e ela fica aqui embaixo de propósito. Trava em regra de negócio já
// falhou duas vezes; nesta porta não tem desvio.

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
  await exigirEnvioLiberado();
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
  await exigirEnvioLiberado();
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
  await exigirEnvioLiberado();
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
  await exigirEnvioLiberado();
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
  await exigirEnvioLiberado();
  if (provedorWhatsApp() === "evolution") {
    const data = await evoFetch("POST", `/message/sendMedia/${evoInstancia()}`, {
      number: evoDestino(phone), mediatype: "image", mimetype: mimeType, media: base64, caption: caption ?? "", fileName: "foto.jpg",
    });
    return extractMessageId(data) ?? "";
  }
  const data = await zapiPost("send-image", { phone: normalizePhone(phone), image: `data:${mimeType};base64,${base64}`, caption: caption ?? "" });
  return extractMessageId(data) ?? "";
}

// Vídeo enviado a partir do CRM (base64) — promoção/divulgação em massa.
export async function sendVideoBase64(phone: string, base64: string, mimeType: string, caption?: string, fileName = "video.mp4"): Promise<string> {
  await exigirEnvioLiberado();
  if (provedorWhatsApp() === "evolution") {
    const data = await evoFetch("POST", `/message/sendMedia/${evoInstancia()}`, {
      number: evoDestino(phone), mediatype: "video", mimetype: mimeType, media: base64, caption: caption ?? "", fileName,
    });
    return extractMessageId(data) ?? "";
  }
  const data = await zapiPost("send-video", { phone: normalizePhone(phone), video: `data:${mimeType};base64,${base64}`, caption: caption ?? "" });
  return extractMessageId(data) ?? "";
}

// Áudio gravado no CRM (base64). A Evolution converte para o formato de
// mensagem de voz do WhatsApp; a Z-API aceita data URL.
export async function sendAudioBase64(phone: string, base64: string, mimeType: string): Promise<string> {
  await exigirEnvioLiberado();
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
  const deUma = async (inst: string) => {
    const data = await evoFetch("POST", `/chat/getBase64FromMediaMessage/${inst}`, {
      message: { key: { id: messageId } }, convertToMp4: false,
    });
    const base64 = typeof data.base64 === "string" ? data.base64 : null;
    if (!base64) return null;
    return {
      base64,
      mimeType: (typeof data.mimetype === "string" && data.mimetype) || "application/octet-stream",
      fileName: typeof data.fileName === "string" ? data.fileName : null,
    };
  };
  try {
    const r = await deUma(evoInstancia());
    if (r) return r;
  } catch (e) {
    console.error("[evolution] mídia:", e);
  }
  // A mensagem pode ter chegado pela instância de antes da troca (crm → crm-2):
  // é ela que guarda a mídia.
  const anterior = await instanciaAnterior();
  if (!anterior) return null;
  try {
    return await deUma(encodeURIComponent(anterior));
  } catch (e) {
    console.error("[evolution] mídia (instância anterior):", e);
    return null;
  }
}

export async function sendDocument(phone: string, docUrl: string, fileName: string): Promise<string> {
  await exigirEnvioLiberado();
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

// nomeAgenda x nomePerfil: são coisas DIFERENTES e a diferença importa.
//   nomeAgenda  = como o contato está salvo na agenda do SEU celular. É o que
//                 muda quando você renomeia o contato no telefone.
//   nomePerfil  = o nome que o PRÓPRIO contato escolheu no WhatsApp dele
//                 (o "pushName" que vem junto de cada mensagem).
// O CRM só conhecia o nomePerfil, por isso renomear no celular não aparecia
// aqui: o pushName não muda quando você mexe na sua agenda.
type ChatResumo = {
  phone: string; name?: string; nomeAgenda?: string; nomePerfil?: string;
  isGroup?: boolean; photo?: string | null;
};

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
      nomeAgenda: (c.name as string) ?? undefined,
      nomePerfil: (c.pushName as string) ?? undefined,
      isGroup,
      photo: (c.profilePicUrl as string) ?? null,
      ts: Number.isFinite(ts) ? ts : 0,
    });
  }
  chats.sort((a, b) => b.ts - a.ts);
  return chats
    .slice((page - 1) * pageSize, page * pageSize)
    .map(({ phone, name, nomeAgenda, nomePerfil, isGroup, photo }) => ({ phone, name, nomeAgenda, nomePerfil, isGroup, photo }));
}

export async function listarChats(page = 1, pageSize = 5): Promise<ChatResumo[]> {
  if (provedorWhatsApp() === "evolution") return listarChatsEvolution(page, pageSize);
  const data = await zapiGet(`chats?page=${page}&pageSize=${pageSize}`).catch(() => []);
  if (!Array.isArray(data)) return [];
  return data.map((c: Record<string, unknown>) => ({
    phone: String(c.phone ?? c.id ?? ""),
    name: (c.name as string) ?? (c.chatName as string) ?? undefined,
    nomeAgenda: (c.name as string) ?? (c.chatName as string) ?? undefined,
    nomePerfil: undefined,
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
    // da página, 50 por padrão) e "page". Uma conversa longa não cabe numa
    // página só, então vai página por página até juntar `amount` ou acabar.
    // Versão antiga ignora "page" e devolve sempre as mesmas: a chave de cada
    // mensagem detecta a repetição e para.
    const porPagina = Math.min(amount, 500);
    const vistas = new Set<string>();
    const saida: Record<string, unknown>[] = [];
    for (let page = 1; saida.length < amount && page <= 40; page++) {
      const data = await evoFetch("POST", `/chat/findMessages/${evoInstancia()}`, {
        where: { key: { remoteJid: evoJidChat(phone) } },
        limit: porPagina,
        page,
        offset: porPagina,
      }).catch(() => null);
      const mensagens = data?.messages as Record<string, unknown> | unknown[] | undefined;
      const registros: unknown[] = Array.isArray(data)
        ? data
        : Array.isArray(mensagens)
        ? mensagens
        : Array.isArray((mensagens as Record<string, unknown> | undefined)?.records)
        ? ((mensagens as Record<string, unknown>).records as unknown[])
        : [];
      let novas = 0;
      for (const r of registros) {
        const m = mensagemEvolutionParaZapi(r as Record<string, unknown>);
        const chave = String(m.messageId ?? "") || `${m.momment}|${JSON.stringify(m.text ?? "")}`;
        if (vistas.has(chave)) continue;
        vistas.add(chave);
        saida.push(m);
        novas++;
      }
      if (novas === 0 || registros.length < porPagina) break;
    }
    return saida;
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

// Endereço pelo qual o vendedor de fato abre o CRM, confirmado por uma
// chamada de teste que chegou. Vale mais do que qualquer variável: NEXTAUTH_URL
// errada (domínio antigo, caminho a mais) apontava o webhook para um 404 e o
// vigia "corrigia" de volta para o endereço errado a cada 5 minutos.
export const CHAVE_URL_PUBLICA = "crm.urlPublica";
export async function urlPublicaConfirmada(): Promise<string | null> {
  const v = await getConfig(CHAVE_URL_PUBLICA).catch(() => null);
  return v ? v.trim().replace(/\/+$/, "") : null;
}
export async function confirmarUrlPublica(url: string): Promise<void> {
  await setConfig(CHAVE_URL_PUBLICA, url.trim().replace(/\/+$/, ""));
}

// Origem do navegador (host + protocolo) de uma requisição — é o endereço
// real do CRM. Ignora localhost/IP local, que não serve para a Evolution.
export function origemPublicaDaRequisicao(h: { get(nome: string): string | null }): string | null {
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (!host || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(host)) return null;
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

function montarUrlWebhook(base: string): string {
  return `${base}/api/webhooks/evolution?apikey=${encodeURIComponent(evolutionConfig()?.apiKey ?? "")}`;
}

// URL que a Evolution deve chamar: o endereço confirmado, senão o das
// variáveis. null quando não dá para descobrir.
export async function urlWebhookCrm(): Promise<string | null> {
  const base = (await urlPublicaConfirmada()) ?? urlPublicaCrm();
  return base ? montarUrlWebhook(base) : null;
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
  const ativa = await nomeDaInstancia();
  try {
    const data = await evoFetch("GET", `/instance/fetchInstances?instanceName=${evoInstancia()}`, undefined, TEMPO_TELA_MS);
    const lista: unknown[] = Array.isArray(data) ? data : [data];
    for (const item of lista) {
      const o = item as Record<string, unknown>;
      const inst = (o.instance as Record<string, unknown> | undefined) ?? o;
      const nome = String(inst.instanceName ?? inst.name ?? o.name ?? "");
      if (nome && nome !== ativa) continue;
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
//
// E se ela chega a ESTE banco. Responder 200 não bastava: outra publicação
// do CRM na Vercel (endereço de um deploy antigo, gravando no banco de antes
// — o provisório, depois da volta para o Neon) também responde 200, e o
// diagnóstico dizia "tudo certo" com as mensagens caindo em outro lugar. O
// teste leva uma marca única; o webhook a grava no banco dele
// (CHAVE_TESTE_WEBHOOK); aqui se confere se ela apareceu no nosso.
export const CHAVE_TESTE_WEBHOOK = "diag.webhook_teste";
export type TesteWebhook = { ok: boolean; url: string | null; detalhe: string };
export async function testarWebhookDeFora(urlConfigurada: string | null): Promise<TesteWebhook> {
  const cfg = evolutionConfig();
  if (!cfg) return { ok: false, url: null, detalhe: "Evolution não configurada." };
  const url = (urlConfigurada ?? "").trim();
  if (!url) return { ok: false, url: null, detalhe: "a instância não tem webhook configurado" };
  // O que a Evolution 2.x manda de verdade: a chave no corpo é o token da
  // instância (ou a global, quando a instância foi criada com ela).
  const apikeyNoCorpo = (await tokenDaInstancia()) ?? cfg.apiKey;
  const marca = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "crm-teste-webhook" },
      body: JSON.stringify({ event: "connection.update", instance: await nomeDaInstancia(), data: { state: "open", teste: marca }, apikey: apikeyNoCorpo }),
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_TELA_MS),
    });
    const tipo = res.headers.get("content-type") ?? "";
    const texto = await res.text().catch(() => "");
    if (res.ok && /json/.test(tipo)) {
      const chegou = (await getConfig(CHAVE_TESTE_WEBHOOK).catch(() => null)) === marca;
      if (chegou) return { ok: true, url, detalhe: `respondeu HTTP ${res.status} — a chamada chega a este CRM, neste banco, e a chave é aceita` };
      return {
        ok: false, url,
        detalhe: `respondeu HTTP ${res.status}, mas a chamada NÃO chegou a este banco — esse endereço é outra publicação do CRM (um deploy antigo da Vercel, gravando em outro banco). As mensagens estão caindo lá, não aqui`,
      };
    }
    const html = /html/.test(tipo);
    // Quem respondeu? A Vercel carimba o motivo em x-vercel-error
    // (NOT_FOUND, DEPLOYMENT_NOT_FOUND, DEPLOYMENT_PAUSED…) — é isso que
    // separa "o CRM não tem essa rota" de "esse domínio não é este deploy".
    const quem = [
      res.headers.get("x-vercel-error") && `x-vercel-error=${res.headers.get("x-vercel-error")}`,
      res.headers.get("x-vercel-id") && "via Vercel",
      res.headers.get("server") && `server=${res.headers.get("server")}`,
      res.headers.get("x-matched-path") && `rota=${res.headers.get("x-matched-path")}`,
    ].filter(Boolean).join(" · ");
    const trecho = texto.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
    if (res.status === 404) {
      // GET na mesma URL: a rota do webhook responde JSON no GET. Se o GET
      // funciona e só o POST dá 404, alguma coisa na frente barra o POST.
      let get = "";
      try {
        const r2 = await fetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(TEMPO_TELA_MS) });
        const t2 = r2.headers.get("content-type") ?? "";
        get = ` · GET na mesma URL: HTTP ${r2.status}${/json/.test(t2) ? " (JSON — a rota existe, só o POST está sendo barrado)" : ""}`;
      } catch { get = " · GET na mesma URL: falhou"; }
      return { ok: false, url, detalhe: `HTTP 404${html ? " (página de erro)" : ""} — nesse endereço não existe o webhook do CRM: o domínio ou o caminho está errado [${quem || "sem identificação"}]${get} · resposta: "${trecho}"` };
    }
    if (html && (res.status === 401 || res.status === 403)) {
      return { ok: false, url, detalhe: `HTTP ${res.status} com uma página HTML — a Vercel está barrando com tela de login antes de chegar no CRM (URL de deploy protegida)` };
    }
    if (res.status === 401) return { ok: false, url, detalhe: "HTTP 401 — o CRM recusou a chave que a Evolution manda" };
    return { ok: false, url, detalhe: `HTTP ${res.status} [${quem || "sem identificação"}] · resposta: "${trecho}"` };
  } catch (e) {
    const tempo = e instanceof Error && e.name === "TimeoutError";
    return { ok: false, url, detalhe: tempo ? "não respondeu em 10s" : "endereço inalcançável (domínio errado ou fora do ar)" };
  }
}

// Cria a instância com o nome da instância que vale (EVOLUTION_INSTANCE, ou crm-2… depois de uma troca) (canal Baileys, QR Code)
// já apontando o webhook para o CRM. Tenta o formato das versões 2.x e, se a
// Evolution recusar, o formato "plano" das 1.x. Devolve o QR quando ele já vem
// na resposta.
export async function criarInstanciaEvolution(urlWebhook: string | null, nomeExplicito?: string): Promise<{ ok: boolean; erro?: string; qr?: string | null; jaExistia?: boolean }> {
  if (provedorWhatsApp() !== "evolution") return { ok: false, erro: "Evolution API não configurada." };
  const nome = nomeExplicito ?? (await nomeDaInstancia());
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
    if (/already|já existe|in use|em uso/i.test(msg1)) return { ok: true, qr: null, jaExistia: true };
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

export async function diagnosticarConexao(origemNavegador: string | null = null): Promise<Diagnostico> {
  const cfg = evolutionConfig();
  const ativa = cfg ? await nomeDaInstancia({ forcar: true }) : null;
  const etapas: EtapaDiagnostico[] = [];
  const fim = (conclusao: string): Diagnostico => ({
    provedor: provedorWhatsApp(), url: cfg?.url ?? null, instancia: ativa, etapas, conclusao,
  });

  if (!cfg) {
    const faltando = ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE"].filter((v) => !(process.env[v] ?? "").trim());
    etapas.push({ etapa: "Variáveis na Vercel", ok: false, detalhe: `Faltando: ${faltando.join(", ")}` });
    return fim("O CRM não sabe onde fica sua Evolution API. Preencha as variáveis na Vercel (Settings → Environment Variables) e faça Redeploy.");
  }
  etapas.push({ etapa: "Variáveis na Vercel", ok: true, detalhe: `${cfg.url} · instância "${ativa}"${ativa !== cfg.instance ? ` (o CRM trocou de "${cfg.instance}" para esta, que a anterior travou)` : ""}` });

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
    etapas.push({ etapa: `Instância "${ativa}"`, ok: true, detalhe: `existe · estado "${state}"` });
    if (state === "open") {
      const w = await lerWebhookEvolution();
      const esperado = await urlWebhookCrm();
      const ok = !!(w && w.enabled && esperado && (w.url ?? "").replace(/\/+$/, "") === esperado.replace(/\/+$/, ""));
      etapas.push({ etapa: "Webhook apontado para o CRM", ok, detalhe: ok ? `certo (${w?.url})` : `está em "${w?.url ?? "vazio"}" — deveria ser "${esperado ?? "(defina NEXTAUTH_URL)"}"` });

      // 3. A chamada chega de verdade? (o passo que faltava: webhook "certo"
      // na Evolution mas morrendo num 404 ou numa tela de login parecia tudo ok)
      const teste = await testarWebhookDeFora(w?.enabled ? w.url : null);
      etapas.push({ etapa: "Chamada de teste no webhook", ok: teste.ok, detalhe: teste.detalhe });
      if (teste.ok && ok) return fim("Tudo certo: número pareado, webhook no lugar e a chamada de teste chegou no CRM. Se ainda assim nada aparece, mande uma mensagem de teste e veja \"Últimos eventos\" abaixo.");
      if (teste.ok) {
        // O endereço da instância ENTREGA neste banco (o teste provou): é ele
        // que fica. Antes o vigia "corrigia" para o endereço guardado — que,
        // depois de uma troca de banco, pode ser o de outra época e não
        // funcionar mais.
        const base = (w?.url ?? "").replace(/\/api\/webhooks\/evolution.*$/, "");
        if (base) await confirmarUrlPublica(base).catch(() => {});
        return fim(`As chamadas estão chegando neste banco pelo endereço ${base || "configurado na instância"} — o CRM passou a usar esse endereço como o certo.`);
      }

      // 4. Não chegou. O endereço pelo qual o vendedor está abrindo o CRM
      // AGORA é, por definição, um endereço público que funciona: testa ele
      // e, se passar, conserta sozinho (guarda como confirmado e reaponta).
      const baseAtual = (w?.url ?? "").replace(/\/api\/webhooks\/evolution.*$/, "");
      etapas.push({
        etapa: "Endereço do seu navegador", ok: !!origemNavegador,
        detalhe: origemNavegador
          ? `${origemNavegador}${origemNavegador === baseAtual ? " — o mesmo do webhook" : " — diferente do webhook"}`
          : "não identificado (sem cabeçalho de host)",
      });
      if (origemNavegador && origemNavegador !== baseAtual) {
        const candidata = montarUrlWebhook(origemNavegador);
        const teste2 = await testarWebhookDeFora(candidata);
        etapas.push({ etapa: `Teste pelo endereço do navegador (${origemNavegador})`, ok: teste2.ok, detalhe: teste2.detalhe });
        if (teste2.ok) {
          await confirmarUrlPublica(origemNavegador).catch(() => {});
          const r = await configurarWebhookEvolution(candidata).catch(() => ({ ok: false, erro: "falhou" }));
          etapas.push({ etapa: "Webhook reapontado", ok: r.ok, detalhe: r.ok ? `agora em ${candidata.replace(/apikey=.*$/, "apikey=…")}` : `não consegui: ${"erro" in r ? r.erro : ""}` });
          return fim(r.ok
            ? `Corrigido: o webhook apontava para ${baseAtual || "um endereço errado"}, que não é o CRM (por isso nada chegava). Reapontei para ${origemNavegador}, que é o endereço que você usa — mande uma mensagem de teste e veja "Últimos eventos" abaixo. Se quiser deixar a variável certa também: NEXTAUTH_URL = ${origemNavegador} na Vercel.`
            : `O endereço certo é ${origemNavegador} (a chamada de teste chegou por ele), mas não consegui reapontar o webhook na Evolution. Clique em "Configurar webhook agora".`);
        }
      }
      if (/login da Vercel/.test(teste.detalhe)) {
        return fim(
          "Achei o problema: a Evolution chama o CRM, mas a Vercel devolve uma tela de login antes de a mensagem chegar. " +
          `Na Vercel, em Settings → Environment Variables, defina NEXTAUTH_URL com o endereço que você usa no navegador (ex.: ${origemNavegador ?? urlPublicaCrm() ?? "https://SEU-CRM.vercel.app"}), faça Redeploy e clique em "Configurar webhook agora".`
        );
      }
      if (/404/.test(teste.detalhe)) {
        return fim(`Achei o problema: o webhook aponta para ${baseAtual || "um endereço"} onde não existe o CRM (404). Abra esta tela pelo endereço certo do CRM e clique em "Configurar webhook agora" — ele passa a usar o endereço que está no seu navegador. Confira também NEXTAUTH_URL na Vercel (deve ser só o domínio, sem caminho no fim).`);
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
      etapas.push({ etapa: `Instância "${ativa}"`, ok: false, detalhe: "não existe neste servidor" });
      return fim(`O servidor está no ar, mas não tem nenhuma instância chamada "${ativa}". Clique em "Gerar novo QR" — o CRM cria a instância e já mostra o código.`);
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
  // Evolution: a instância que vale (EVOLUTION_INSTANCE ou a que o CRM criou no lugar) ainda não foi criada
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
    // Relida no banco a cada consulta (e o cache das chamadas seguintes junto):
    // depois da troca crm → crm-2, outra cópia do servidor mostraria a velha,
    // "open" e morta, como conectada.
    const instancia = await nomeDaInstancia({ forcar: true });
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
    // Relê no banco qual instância vale (o QR tem que ser o da nova, mesmo que
    // a troca tenha sido feita por outra cópia do servidor segundos antes).
    await nomeDaInstancia({ forcar: true });
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
        const r = await criarInstanciaEvolution(await urlWebhookCrm()).catch(() => ({ ok: false, qr: null as string | null }));
        if (r.ok && r.qr) return { imagem: r.qr };
        if (r.ok) {
          await new Promise((res) => setTimeout(res, 2000));
          const data3 = await evoFetch("GET", `/instance/connect/${evoInstancia()}`, undefined, TEMPO_TELA_MS).catch(() => ({}) as Record<string, unknown>);
          const imagem3 = extrairBase64Qr(data3);
          if (imagem3) return { imagem: imagem3 };
        }
        return { imagem: null, erro: `A instância "${await nomeDaInstancia()}" não existe na Evolution. Criei agora — clique em "Gerar novo QR".` };
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

// Desconectar: na Evolution, pede o logout e CONFERE até sair de "open"
// (reiniciando a instância presa) — ver lib/whatsapp-desconectar.ts.
export async function desconectar(): Promise<ResultadoDesconexao> {
  if (provedorWhatsApp() === "evolution") {
    // O vigia não pode religar a instância no meio da desconexão.
    await pausarVigia(5).catch(() => {});
    // Nome fixo do começo ao fim: a mesma instância é consultada, desligada e reiniciada.
    const inst = encodeURIComponent(await nomeDaInstancia({ forcar: true }));
    return desconectarEvolution({
      estado: async () => {
        try {
          return estadoDaResposta(await evoFetch("GET", `/instance/connectionState/${inst}`, undefined, 8_000)) || null;
        } catch (e) {
          // Algumas versões apagam a instância no logout: sumiu = desconectado.
          const m = e instanceof Error ? e.message : String(e);
          return /\(404\)/.test(m) || /does not exist|não existe/i.test(m) ? "inexistente" : null;
        }
      },
      logout: async () => { await evoFetch("DELETE", `/instance/logout/${inst}`, undefined, 10_000); },
      reiniciar: async () => {
        // Versões da Evolution divergem no verbo (PUT nas 2.x, POST em outras).
        try { await evoFetch("PUT", `/instance/restart/${inst}`, undefined, 8_000); } catch { await evoFetch("POST", `/instance/restart/${inst}`, undefined, 8_000); }
      },
      esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
      agora: () => Date.now(),
    });
  }
  try { await zapiGet("disconnect"); return { ok: true, passos: ["disconnect"] }; } catch (e) { return { ok: false, erro: e instanceof Error ? e.message : String(e), passos: [] }; }
}

// Último recurso quando a sessão fica presa: apaga a instância na Evolution
// (quem chama recria em seguida, já com o webhook, e mostra o QR). As
// conversas do CRM ficam; some só a cópia que a Evolution guarda — o celular
// manda o histórico de novo ao ler o QR.
//
// A Evolution recusa apagar quando a sessão está morta ("Connection Closed"):
// a lógica de reiniciar, esperar assentar e tentar de novo mora em
// lib/whatsapp-apagar-instancia.ts (pura, testada com uma Evolution falsa).
export async function apagarInstanciaEvolution(): Promise<{ ok: boolean; erro?: string; passos: string[]; zumbi?: boolean }> {
  if (provedorWhatsApp() !== "evolution") return { ok: false, erro: "Evolution API não configurada.", passos: [] };
  await pausarVigia(5).catch(() => {});
  const inst = encodeURIComponent(await nomeDaInstancia({ forcar: true }));
  const texto = (e: unknown) => (e instanceof Error ? e.message : String(e));
  const sumiu = (m: string) => /\(404\)/.test(m) || /does not exist|não existe/i.test(m);
  return apagarEvolution({
    estado: async () => {
      try { return estadoDaResposta(await evoFetch("GET", `/instance/connectionState/${inst}`, undefined, 6_000)) || null; }
      catch (e) { return sumiu(texto(e)) ? "inexistente" : null; }
    },
    apagar: async () => {
      try { await evoFetch("DELETE", `/instance/delete/${inst}`, undefined, 15_000); }
      catch (e) { if (!sumiu(texto(e))) throw e; }
    },
    logout: async () => { await evoFetch("DELETE", `/instance/logout/${inst}`, undefined, 8_000); },
    reiniciar: async () => {
      // Versões da Evolution divergem no verbo (PUT nas 2.x, POST em outras).
      try { await evoFetch("PUT", `/instance/restart/${inst}`, undefined, 8_000); } catch { await evoFetch("POST", `/instance/restart/${inst}`, undefined, 8_000); }
    },
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
    agora: () => Date.now(),
  });
}

// O ÚLTIMO recurso, quando a instância travou de um jeito que a Evolution não
// deixa nem sair nem apagar (o zumbi do print de 01/10): cria OUTRA, com o
// próximo nome (crm-2, crm-3…), já com o webhook, e o CRM passa a usá-la. A
// velha fica esquecida na Evolution (não dá para apagá-la por aqui) — se um
// dia ela acordar, o webhook a recusa como "outra instância".
export async function criarInstanciaNovaEvolution(urlWebhook: string | null): Promise<{ ok: boolean; erro?: string; qr?: string | null; nome?: string; anterior?: string; passos: string[] }> {
  const passos: string[] = [];
  const cfg = evolutionConfig();
  if (!cfg) return { ok: false, erro: "Evolution API não configurada.", passos };
  await pausarVigia(5).catch(() => {});
  const anterior = await nomeDaInstancia({ forcar: true });
  let nome = proximoNomeInstancia(cfg.instance, anterior);
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const r = await criarInstanciaEvolution(urlWebhook, nome);
    if (!r.ok) { passos.push(`criar "${nome}" falhou: ${(r.erro ?? "sem motivo").slice(0, 160)}`); return { ok: false, erro: r.erro, passos }; }
    if (r.jaExistia) {
      // Sobra de uma tentativa anterior: serve se ainda não está "open" (pode
      // ser outro zumbi); senão, o próximo nome.
      let estado = "";
      try { estado = estadoDaResposta(await evoFetch("GET", `/instance/connectionState/${encodeURIComponent(nome)}`, undefined, 6_000)); } catch { estado = ""; }
      if (estado === "open") { passos.push(`"${nome}" já existe e está open — pulei`); nome = proximoNomeInstancia(cfg.instance, nome); continue; }
      passos.push(`"${nome}" já existia (${estado || "sem estado"}) — reaproveitada`);
    } else {
      passos.push(`criou a instância "${nome}"`);
    }
    await ativarInstancia(nome, anterior);
    passos.push(`o CRM passou a usar "${nome}" (antes: "${anterior}")`);
    if (urlWebhook) {
      const w = await configurarWebhookEvolution(urlWebhook).catch((e) => ({ ok: false, erro: e instanceof Error ? e.message : String(e) }));
      passos.push(w.ok ? "webhook apontado" : `webhook: ${("erro" in w && w.erro) || "falhou"}`);
    }
    return { ok: true, qr: r.qr ?? null, nome, anterior, passos };
  }
  return { ok: false, erro: "Todos os nomes tentados já existem e estão conectados.", passos };
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
