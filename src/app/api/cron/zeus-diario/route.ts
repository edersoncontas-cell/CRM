import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { sendText, isEnabled as whatsappHabilitado } from "@/lib/zapi";
import { registrarZeusEvent } from "@/lib/zeus/eventos";
import { tocarHeartbeat } from "@/lib/zeus/estado";
import { llmTexto, iaHabilitada } from "@/lib/ai";
import { agoraBrasiliaExtenso, inicioDoDiaBrasilia } from "@/lib/utils";
import { sugerirProximaAcaoHeuristica } from "@/lib/zeus/nextbestaction";
import { lerParametros } from "@/lib/parametros";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function pontuarNegociacao(neg: { termometro: number; valor: number | null; ultimoContato: Date | null }): number {
  const diasSemContato = neg.ultimoContato ? Math.floor((Date.now() - neg.ultimoContato.getTime()) / 86400000) : 0;
  const valorPts = Math.min((neg.valor ?? 0) / 10000, 50);
  const urgenciaPts = Math.min(diasSemContato, 15);
  return neg.termometro * 0.5 + valorPts * 0.3 + urgenciaPts * 0.2;
}

async function montarDados() {
  const inicioDia = inicioDoDiaBrasilia();
  const fimDia = inicioDoDiaBrasilia(new Date(), 1);

  const [visitasHoje, aguardando, negociacoesAbertas, alertasAbertos] = await Promise.all([
    db.visita.findMany({
      where: { data: { gte: inicioDia, lt: fimDia } },
      include: { cliente: { select: { nome: true, municipio: { select: { nome: true } } } } },
    }),
    db.cliente.findMany({ where: { aguardandoResposta: true }, select: { nome: true, ultimoContato: true }, take: 20 }),
    db.negociacao.findMany({
      where: { status: "aberta" },
      include: { cliente: { select: { nome: true, aguardandoResposta: true, proximaVisita: true, ultimoContato: true } } },
      take: 100,
    }),
    db.alerta.findMany({ where: { resolvido: false }, orderBy: { diasDesde: "desc" }, take: 10 }),
  ]);

  const top3 = [...negociacoesAbertas]
    .sort((a, b) => pontuarNegociacao(b) - pontuarNegociacao(a))
    .slice(0, 3);

  return { visitasHoje, aguardando, top3, alertasAbertos };
}

async function gerarTexto(dados: Awaited<ReturnType<typeof montarDados>>): Promise<string> {
  const linhas: string[] = [
    `Bom dia! Briefing do ZEUS — ${agoraBrasiliaExtenso()}.`,
    "",
    dados.visitasHoje.length
      ? `Visitas hoje (${dados.visitasHoje.length}): ${dados.visitasHoje.map((v) => `${v.cliente.nome}${v.cliente.municipio ? " (" + v.cliente.municipio.nome + ")" : ""}`).join(", ")}.`
      : "Nenhuma visita agendada para hoje.",
    dados.aguardando.length
      ? `Aguardando seu retorno no WhatsApp (${dados.aguardando.length}): ${dados.aguardando.slice(0, 8).map((c) => c.nome).join(", ")}.`
      : "Ninguém aguardando retorno no WhatsApp.",
    dados.top3.length
      ? `Top ${dados.top3.length} negociações para atacar hoje:\n${dados.top3.map((n) => {
          const diasSemContato = n.cliente.ultimoContato ? Math.floor((Date.now() - n.cliente.ultimoContato.getTime()) / 86400000) : null;
          const proximaAcao = n.proximaAcao || sugerirProximaAcaoHeuristica({
            nome: n.cliente.nome,
            aguardandoResposta: n.cliente.aguardandoResposta,
            diasSemContato,
            concorrenteMencionado: n.concorrenteMencionado,
            temVisitaAgendada: !!(n.dataVisita || n.cliente.proximaVisita),
            estagio: n.estagio,
          }).acao;
          return `• ${n.cliente.nome} (${n.maquinaModelo ?? "?"}, R$ ${(n.valor ?? 0).toLocaleString("pt-BR")}) — próxima ação: ${proximaAcao}`;
        }).join("\n")}`
      : "Sem negociações abertas priorizadas.",
    dados.alertasAbertos.length ? `Alertas abertos: ${dados.alertasAbertos.length}.` : "Sem alertas abertos.",
  ];
  const bruto = linhas.join("\n");

  // Reescrita opcional pela IA (qualquer provedor via llmTexto, com fallback).
  // Sem IA ou com falha, o briefing bruto já é útil por si só.
  if (!iaHabilitada()) return bruto;
  try {
    const texto = (await llmTexto(
      "Você é o ZEUS, assistente autônomo do CRM de um vendedor de máquinas pesadas. Reescreva o briefing abaixo em português, tom direto e profissional, formato de mensagem de WhatsApp (sem markdown, pode usar quebras de linha), sem emojis, mantendo TODOS os dados factuais exatamente como estão — não invente nada além do que foi passado.",
      bruto,
      { maxTokens: 500 }
    )).trim();
    return texto || bruto;
  } catch {
    return bruto;
  }
}

// Briefing matinal via WhatsApp para o próprio vendedor (ZEUS_WHATSAPP_DESTINO).
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await tocarHeartbeat("zeus-diario");

  const destino = (await lerParametros()).whatsappBriefing;
  if (!destino || !whatsappHabilitado()) {
    await registrarZeusEvent({
      tipo: "health", severidade: "baixa",
      titulo: "Briefing diário não enviado — número do briefing (Configurações › Parâmetros) ou WhatsApp não configurados",
    });
    return NextResponse.json({ ok: false, erro: "Número do briefing (Configurações › Parâmetros) ou WhatsApp não configurados." });
  }

  try {
    const dados = await montarDados();
    const texto = await gerarTexto(dados);
    await sendText(destino, texto);
    await registrarZeusEvent({ tipo: "acao", severidade: "baixa", titulo: "Briefing diário enviado ao vendedor" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await registrarZeusEvent({ tipo: "erro", severidade: "media", titulo: `Falha ao enviar briefing diário: ${String(e).slice(0, 150)}` });
    return NextResponse.json({ ok: false, erro: String(e).slice(0, 200) }, { status: 500 });
  }
}
