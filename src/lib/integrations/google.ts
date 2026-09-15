// Integração REAL com o Google (Agenda + Contatos) via OAuth 2.0.
//
// Fluxo: /api/google/auth manda o vendedor para a tela de consentimento do
// Google; /api/google/callback troca o código por tokens e guarda em
// Configuracao (chave google.oauth). O access token expira em 1h e é renovado
// sozinho com o refresh token. A partir daí:
//   - toda Visita criada no CRM vira um evento na agenda principal
//     (sincronizarVisitaComAgenda) e é apagada junto (removerEventoDaVisita);
//   - a lista de clientes é sincronizada com o Google Contatos
//     (lib/google-contatos.ts): todo contato com telefone vira/atualiza um
//     cliente, e os clientes novos do CRM podem ir para o Google.
// Configuração necessária: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e (opcional)
// GOOGLE_REDIRECT_URI — passo a passo em docs/GOOGLE.md.

import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";
import type { ContatoGoogle } from "@/lib/google-contatos-util";
export type { ContatoGoogle };

const CHAVE_TOKENS = "google.oauth";
// Endereços da API (sobrescrevíveis só para testes locais com um servidor falso).
const URL_TOKEN = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const URL_PEOPLE = (process.env.GOOGLE_PEOPLE_API_URL || "https://people.googleapis.com").replace(/\/+$/, "");
const ESCOPOS = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/contacts", // ler e gravar contatos
  "https://www.googleapis.com/auth/userinfo.email",
];

export function googleConfigurado(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function urlBaseApp(): string {
  const base = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return base.replace(/\/+$/, "");
}

export function redirectUriGoogle(): string {
  return process.env.GOOGLE_REDIRECT_URI || `${urlBaseApp()}/api/google/callback`;
}

export type TokensGoogle = {
  refreshToken: string;
  accessToken: string;
  expiraEm: number; // epoch ms
  email: string | null;
  conectadoEm: string;
};

export async function lerTokensGoogle(): Promise<TokensGoogle | null> {
  try {
    const raw = await getConfig(CHAVE_TOKENS);
    if (!raw) return null;
    const t = JSON.parse(raw) as Partial<TokensGoogle>;
    if (!t.refreshToken) return null;
    return {
      refreshToken: t.refreshToken,
      accessToken: t.accessToken ?? "",
      expiraEm: Number(t.expiraEm) || 0,
      email: t.email ?? null,
      conectadoEm: t.conectadoEm ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function statusGoogle() {
  const t = googleConfigurado() ? await lerTokensGoogle() : null;
  return {
    configurado: googleConfigurado(),
    conectado: !!t,
    email: t?.email ?? null,
    conectadoEm: t?.conectadoEm ?? null,
    redirectUri: redirectUriGoogle(),
  };
}

export function urlAutorizacaoGoogle(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUriGoogle(),
    response_type: "code",
    scope: ESCOPOS.join(" "),
    access_type: "offline",
    prompt: "consent", // garante o refresh_token mesmo em reconexões
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type RespostaToken = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };

async function postForm(url: string, params: Record<string, string>): Promise<RespostaToken> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  });
  return (await res.json().catch(() => ({}))) as RespostaToken;
}

// Troca o código do consentimento por tokens e guarda no banco.
export async function trocarCodigoGoogle(code: string): Promise<{ email: string | null }> {
  const r = await postForm(URL_TOKEN, {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: redirectUriGoogle(),
    grant_type: "authorization_code",
  });
  if (!r.access_token) throw new Error(r.error_description || r.error || "O Google não devolveu o token de acesso.");
  const anterior = await lerTokensGoogle();
  const refreshToken = r.refresh_token ?? anterior?.refreshToken;
  if (!refreshToken) {
    throw new Error("O Google não devolveu o refresh token. Remova o acesso do CRM em myaccount.google.com/permissions e conecte de novo.");
  }
  let email: string | null = null;
  try {
    const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${r.access_token}` }, cache: "no-store" });
    const j = (await info.json()) as { email?: string };
    email = j.email ?? null;
  } catch { /* e-mail é só informativo */ }
  const tokens: TokensGoogle = {
    refreshToken,
    accessToken: r.access_token,
    expiraEm: Date.now() + (r.expires_in ?? 3600) * 1000,
    email,
    conectadoEm: new Date().toISOString(),
  };
  await setConfig(CHAVE_TOKENS, JSON.stringify(tokens));
  return { email };
}

export async function desconectarGoogle(): Promise<void> {
  const t = await lerTokensGoogle();
  if (t) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refreshToken)}`, { method: "POST" }).catch(() => {});
  }
  await db.configuracao.deleteMany({ where: { chave: CHAVE_TOKENS } });
}

// Access token válido (renova com o refresh token quando faltar < 1 min).
async function accessTokenGoogle(): Promise<string | null> {
  const t = await lerTokensGoogle();
  if (!t) return null;
  if (t.accessToken && t.expiraEm - Date.now() > 60_000) return t.accessToken;
  const r = await postForm(URL_TOKEN, {
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refresh_token: t.refreshToken,
    grant_type: "refresh_token",
  });
  if (!r.access_token) {
    // Acesso revogado pelo usuário no Google: limpa para a tela mostrar "desconectado".
    if (r.error === "invalid_grant") await db.configuracao.deleteMany({ where: { chave: CHAVE_TOKENS } });
    throw new Error(r.error_description || r.error || "Não foi possível renovar o acesso ao Google.");
  }
  await setConfig(CHAVE_TOKENS, JSON.stringify({ ...t, accessToken: r.access_token, expiraEm: Date.now() + (r.expires_in ?? 3600) * 1000 } satisfies TokensGoogle));
  return r.access_token;
}

async function googleFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessTokenGoogle();
  if (!token) throw new Error("Google não conectado.");
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  return res;
}

// ── Agenda ──────────────────────────────────────────────────────────────────
export type EventoAgenda = { titulo: string; inicio: Date; minutos?: number; descricao?: string; local?: string };

export async function criarEventoAgenda(ev: EventoAgenda): Promise<string | null> {
  const fim = new Date(ev.inicio.getTime() + (ev.minutos ?? 60) * 60_000);
  const res = await googleFetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify({
      summary: ev.titulo,
      description: ev.descricao,
      location: ev.local,
      start: { dateTime: ev.inicio.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: fim.toISOString(), timeZone: "America/Sao_Paulo" },
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }, { method: "popup", minutes: 1440 }] },
    }),
  });
  if (!res.ok) throw new Error(`Google Agenda respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { id?: string };
  return j.id ?? null;
}

export async function excluirEventoAgenda(eventId: string): Promise<void> {
  const res = await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  // 404/410: já não existe na agenda — nada a fazer.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Agenda respondeu ${res.status} ao excluir.`);
  }
}

// ── Contatos ────────────────────────────────────────────────────────────────

type PessoaGoogle = {
  resourceName?: string;
  etag?: string;
  names?: { displayName?: string }[];
  phoneNumbers?: { value?: string; canonicalForm?: string }[];
  emailAddresses?: { value?: string }[];
  addresses?: { city?: string; formattedValue?: string }[];
  organizations?: { name?: string }[];
};

const CAMPOS_PESSOA = "names,phoneNumbers,emailAddresses,addresses,organizations";

function pessoaParaContato(p: PessoaGoogle): ContatoGoogle | null {
  const nome = p.names?.[0]?.displayName?.trim();
  if (!nome || !p.resourceName) return null;
  return {
    id: p.resourceName,
    nome,
    telefones: (p.phoneNumbers ?? []).map((t) => (t.canonicalForm ?? t.value ?? "").replace(/\D/g, "")).filter((t) => t.length >= 8),
    emails: (p.emailAddresses ?? []).map((e) => (e.value ?? "").trim()).filter(Boolean),
    enderecos: (p.addresses ?? []).map((a) => ({ cidade: a.city?.trim() || null, texto: a.formattedValue?.replace(/\s+/g, " ").trim() || null })),
    empresa: p.organizations?.[0]?.name?.trim() || null,
  };
}

// Todos os contatos da conta (com ou sem telefone; quem decide o que fazer é a sincronização).
export async function listarContatosGoogle(): Promise<ContatoGoogle[]> {
  const contatos: ContatoGoogle[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ personFields: CAMPOS_PESSOA, pageSize: "1000" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await googleFetch(`${URL_PEOPLE}/v1/people/me/connections?${params.toString()}`);
    if (!res.ok) throw new Error(`Google Contatos respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { connections?: PessoaGoogle[]; nextPageToken?: string };
    for (const p of j.connections ?? []) { const c = pessoaParaContato(p); if (c) contatos.push(c); }
    pageToken = j.nextPageToken;
  } while (pageToken);
  return contatos;
}

export type DadosContato = { nome: string; telefone: string | null; email: string | null };

function corpoContato(d: DadosContato) {
  return {
    names: [{ givenName: d.nome }],
    phoneNumbers: d.telefone ? [{ value: d.telefone.length >= 10 && d.telefone.length <= 11 ? `+55${d.telefone}` : d.telefone, type: "mobile" }] : [],
    emailAddresses: d.email ? [{ value: d.email }] : [],
  };
}

// Cria o contato no Google e devolve o resourceName ("people/c…").
export async function criarContatoGoogle(d: DadosContato): Promise<string> {
  const res = await googleFetch(`${URL_PEOPLE}/v1/people:createContact?personFields=names`, { method: "POST", body: JSON.stringify(corpoContato(d)) });
  if (res.status === 403) throw new Error("A conta Google conectada só tem permissão de LEITURA dos contatos. Desconecte e conecte de novo para liberar a gravação.");
  if (!res.ok) throw new Error(`Google Contatos respondeu ${res.status} ao criar: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { resourceName?: string };
  if (!j.resourceName) throw new Error("O Google não devolveu o id do contato criado.");
  return j.resourceName;
}

// Atualiza nome/telefone/e-mail de um contato existente (precisa do etag atual).
export async function atualizarContatoGoogle(resourceName: string, d: DadosContato): Promise<boolean> {
  const atual = await googleFetch(`${URL_PEOPLE}/v1/${resourceName}?personFields=${CAMPOS_PESSOA}`);
  if (atual.status === 404) return false; // apagado no Google
  if (!atual.ok) throw new Error(`Google Contatos respondeu ${atual.status} ao ler o contato.`);
  const p = (await atual.json()) as PessoaGoogle;
  const res = await googleFetch(`${URL_PEOPLE}/v1/${resourceName}:updateContact?updatePersonFields=names,phoneNumbers,emailAddresses`, {
    method: "PATCH", body: JSON.stringify({ etag: p.etag, ...corpoContato(d) }),
  });
  if (res.status === 403) throw new Error("A conta Google conectada só tem permissão de LEITURA dos contatos. Desconecte e conecte de novo para liberar a gravação.");
  if (!res.ok) throw new Error(`Google Contatos respondeu ${res.status} ao atualizar: ${(await res.text()).slice(0, 200)}`);
  return true;
}

// ── Sincronização das visitas do CRM ────────────────────────────────────────
// Chamado logo depois de criar uma Visita (qualquer origem: formulário, voz,
// IA, WhatsApp). Silencioso quando o Google não está conectado.
export async function sincronizarVisitaComAgenda(visitaId: string): Promise<void> {
  if (!googleConfigurado()) return;
  if (!(await lerTokensGoogle())) return;
  const v = await db.visita.findUnique({
    where: { id: visitaId },
    include: { cliente: { include: { municipio: true } } },
  });
  if (!v || v.googleEventId) return;
  const descricao = [
    v.observacao,
    v.cliente.telefone ? `Telefone: ${v.cliente.telefone}` : null,
    `Cliente no CRM: ${urlBaseApp()}/clientes/${v.clienteId}`,
  ].filter(Boolean).join("\n");
  const id = await criarEventoAgenda({
    titulo: `Visita: ${v.cliente.nome}`,
    inicio: v.data,
    minutos: 60,
    descricao,
    local: v.cliente.municipio ? `${v.cliente.municipio.nome} - ES` : undefined,
  });
  if (id) await db.visita.update({ where: { id: visitaId }, data: { googleEventId: id } });
}

export async function removerEventoDaVisita(visitaId: string): Promise<void> {
  const v = await db.visita.findUnique({ where: { id: visitaId }, select: { googleEventId: true } });
  if (v?.googleEventId) await excluirEventoAgenda(v.googleEventId).catch((e) => console.error("[google] excluir evento:", e));
}
