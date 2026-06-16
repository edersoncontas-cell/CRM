// Adapter da Google Agenda (OAuth). Ativa com GOOGLE_CLIENT_ID/SECRET.
// Sem credenciais: a visita é registrada apenas localmente (model Negociacao.dataVisita).

export function isEnabled() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export interface EventoAgenda {
  titulo: string;
  inicio: Date;
  fimMinutos?: number;
  descricao?: string;
  local?: string;
}

export async function criarEvento(evento: EventoAgenda, accessToken?: string) {
  if (!isEnabled() || !accessToken) {
    return {
      ok: false,
      modo: "stub" as const,
      mensagem: "Google Agenda não conectado — visita registrada só no CRM.",
    };
  }
  const fim = new Date(evento.inicio.getTime() + (evento.fimMinutos ?? 60) * 60000);
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: evento.titulo,
        description: evento.descricao,
        location: evento.local,
        start: { dateTime: evento.inicio.toISOString(), timeZone: "America/Sao_Paulo" },
        end: { dateTime: fim.toISOString(), timeZone: "America/Sao_Paulo" },
      }),
    }
  );
  return { ok: res.ok, modo: "live" as const, status: res.status };
}

export function urlAutorizacao() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/contacts.readonly",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
