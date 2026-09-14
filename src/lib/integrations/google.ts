// Integração REAL com o Google (Agenda + Contatos) via OAuth 2.0.
//
// Fluxo: /api/google/auth manda o vendedor para a tela de consentimento do
// Google; /api/google/callback troca o código por tokens e guarda em
// Configuracao (chave google.oauth). O access token expira em 1h e é renovado
// sozinho com o refresh token. A partir daí:
//   - toda Visita criada no CRM vira um evento na agenda principal
//     (sincronizarVisitaComAgenda) e é apagada junto (removerEventoDaVisita);
//   - os nomes dos contatos do Google podem preencher clientes/conversas que
//     ficaram como "Contato 55289..." (listarContatosGoogle).
// Configuração necessária: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e (opcional)
// GOOGLE_REDIRECT_URI — passo a passo em docs/GOOGLE.md.

import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";

const CHAVE_TOKENS = "google.oauth";
const ESCOPOS = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/contacts.readonly",
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
  const r = await postForm("https://oauth2.googleapis.com/token", {
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
  const r = await postForm("https://oauth2.googleapis.com/token", {
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
export type ContatoGoogle = { nome: string; telefones: string[] };

export async function listarContatosGoogle(): Promise<ContatoGoogle[]> {
  const contatos: ContatoGoogle[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ personFields: "names,phoneNumbers", pageSize: "1000" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await googleFetch(`https://people.googleapis.com/v1/people/me/connections?${params.toString()}`);
    if (!res.ok) throw new Error(`Google Contatos respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as {
      connections?: { names?: { displayName?: string }[]; phoneNumbers?: { value?: string; canonicalForm?: string }[] }[];
      nextPageToken?: string;
    };
    for (const p of j.connections ?? []) {
      const nome = p.names?.[0]?.displayName?.trim();
      const telefones = (p.phoneNumbers ?? []).map((t) => (t.canonicalForm ?? t.value ?? "").replace(/\D/g, "")).filter((t) => t.length >= 8);
      if (nome && telefones.length) contatos.push({ nome, telefones });
    }
    pageToken = j.nextPageToken;
  } while (pageToken);
  return contatos;
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
