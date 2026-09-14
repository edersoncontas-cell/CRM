// Linha do tempo do cliente: uma sequência única com tudo o que aconteceu —
// mensagens de WhatsApp, visitas, negociações (criação, faturamento, perda),
// pós-venda, cadência de follow-up e ações da IA/ZEUS/usuário na auditoria.
// Antes de ligar, o vendedor sabe tudo em 10 segundos.

import { db } from "@/lib/db";
import { rotuloMotivoPerda } from "@/lib/pipeline";
import { rotuloTipo as rotuloTipoCadencia } from "@/lib/cadencias";

export type TipoEvento = "mensagem" | "visita" | "negociacao" | "posvenda" | "cadencia" | "ia" | "sistema";

export type EventoLinhaTempo = {
  id: string;
  tipo: TipoEvento;
  quando: string; // ISO
  titulo: string;
  detalhe: string | null;
  // Para mensagens: quem falou.
  direcao?: "in" | "out";
  href?: string;
};

const ROTULO_POSVENDA: Record<string, string> = {
  ligacao: "Ligação de pós-venda",
  visita: "Visita de pós-venda",
  whatsapp: "WhatsApp de pós-venda",
  manutencao: "Manutenção",
  peca_vendida: "Peça vendida",
  indicacao_pedida: "Indicação pedida",
  ideia_ia: "Ideia da IA",
  outro: "Contato de pós-venda",
};

function corta(t: string, n = 160): string {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export async function linhaDoTempoCliente(clienteId: string, opts?: { mensagens?: number; auditoria?: number }): Promise<EventoLinhaTempo[]> {
  const maxMsgs = opts?.mensagens ?? 40;
  const maxAudit = opts?.auditoria ?? 40;

  const [convs, visitas, negociacoes, posVenda, cadencias, audit] = await Promise.all([
    db.whatsAppConversation.findMany({
      where: { clienteId },
      select: { id: true, messages: { where: { isDraft: false }, orderBy: { sentAt: "desc" }, take: maxMsgs, select: { id: true, direction: true, body: true, sentAt: true, mediaType: true, transcript: true } } },
    }),
    db.visita.findMany({ where: { clienteId }, orderBy: { data: "desc" }, take: 50, select: { id: true, data: true, observacao: true } }),
    db.negociacao.findMany({
      where: { clienteId },
      orderBy: { criadoEm: "desc" },
      take: 30,
      select: { id: true, maquinaModelo: true, valor: true, estagio: true, status: true, criadoEm: true, faturadoEm: true, atualizadoEm: true, motivoPerda: true, usadaTroca: true, usadaModelo: true },
    }),
    db.posVendaContato.findMany({ where: { clienteId }, orderBy: { data: "desc" }, take: 30, select: { id: true, tipo: true, nota: true, data: true } }),
    db.cadencia.findMany({ where: { clienteId }, orderBy: { iniciadaEm: "desc" }, take: 10, select: { id: true, tipo: true, toqueAtual: true, iniciadaEm: true, encerradaEm: true, motivoEncerramento: true, ativa: true } }),
    db.auditLog.findMany({
      where: { clienteId, NOT: { acao: { in: ["conversa_analisada", "conversa_classificada"] } } },
      orderBy: { criadoEm: "desc" },
      take: maxAudit,
      select: { id: true, acao: true, origem: true, descricao: true, criadoEm: true, entidade: true },
    }),
  ]);

  const eventos: EventoLinhaTempo[] = [];
  const brl = (v: number | null) => (v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : null);

  for (const conv of convs) {
    for (const m of conv.messages) {
      const texto = m.body?.trim() || (m.transcript ? `[áudio] ${m.transcript}` : m.mediaType ? `[${m.mediaType}]` : "");
      eventos.push({
        id: `msg:${m.id}`,
        tipo: "mensagem",
        quando: m.sentAt.toISOString(),
        titulo: m.direction === "IN" ? "Cliente escreveu" : "Você respondeu",
        detalhe: corta(texto) || null,
        direcao: m.direction === "IN" ? "in" : "out",
        href: `/atendimento?conversa=${conv.id}`,
      });
    }
  }

  for (const v of visitas) {
    const futura = v.data.getTime() > Date.now();
    eventos.push({ id: `vis:${v.id}`, tipo: "visita", quando: v.data.toISOString(), titulo: futura ? "Visita agendada" : "Visita realizada", detalhe: v.observacao ? corta(v.observacao) : null, href: "/visitas" });
  }

  for (const n of negociacoes) {
    const maq = n.maquinaModelo ?? "máquina a definir";
    const val = brl(n.valor);
    eventos.push({
      id: `neg:${n.id}`,
      tipo: "negociacao",
      quando: n.criadoEm.toISOString(),
      titulo: `Negociação aberta: ${maq}`,
      detalhe: [val, n.usadaTroca && n.usadaModelo ? `usada na troca: ${n.usadaModelo}` : null].filter(Boolean).join(" · ") || null,
      href: "/negociacoes",
    });
    if (n.status === "ganha") {
      eventos.push({ id: `neg-ganha:${n.id}`, tipo: "negociacao", quando: (n.faturadoEm ?? n.atualizadoEm).toISOString(), titulo: n.faturadoEm ? `Faturado: ${maq}` : `Venda confirmada: ${maq}`, detalhe: val, href: `/negociacoes/${n.id}/proposta` });
    } else if (n.status === "perdida") {
      eventos.push({ id: `neg-perdida:${n.id}`, tipo: "negociacao", quando: n.atualizadoEm.toISOString(), titulo: `Perdida: ${maq}`, detalhe: `Motivo: ${rotuloMotivoPerda(n.motivoPerda)}`, href: "/negociacoes" });
    }
  }

  for (const p of posVenda) {
    eventos.push({ id: `pv:${p.id}`, tipo: "posvenda", quando: p.data.toISOString(), titulo: ROTULO_POSVENDA[p.tipo] ?? "Pós-venda", detalhe: corta(p.nota), href: "/pos-venda" });
  }

  for (const c of cadencias) {
    eventos.push({ id: `cad:${c.id}`, tipo: "cadencia", quando: c.iniciadaEm.toISOString(), titulo: `Cadência de 7 toques iniciada (${rotuloTipoCadencia(c.tipo)})`, detalhe: null });
    if (c.encerradaEm) {
      const motivo = c.motivoEncerramento === "respondeu" ? "o cliente respondeu" : c.motivoEncerramento === "concluida" ? "7 toques concluídos" : c.motivoEncerramento === "manual" ? "encerrada por você" : "sem telefone";
      eventos.push({ id: `cad-fim:${c.id}`, tipo: "cadencia", quando: c.encerradaEm.toISOString(), titulo: `Cadência encerrada no toque ${c.toqueAtual}/7`, detalhe: motivo });
    }
  }

  for (const a of audit) {
    const ia = a.origem === "ia" || a.origem === "zeus" || a.origem === "cerebro";
    eventos.push({
      id: `aud:${a.id}`,
      tipo: ia ? "ia" : "sistema",
      quando: a.criadoEm.toISOString(),
      titulo: ia ? (a.origem === "zeus" ? "ZEUS" : a.origem === "cerebro" ? "Cérebro" : "IA") : a.origem === "usuario" ? "Você" : "Sistema",
      detalhe: corta(a.descricao, 200),
      href: "/auditoria",
    });
  }

  eventos.sort((a, b) => (a.quando < b.quando ? 1 : a.quando > b.quando ? -1 : 0));
  return eventos;
}
