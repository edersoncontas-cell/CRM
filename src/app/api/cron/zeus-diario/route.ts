import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { sendText, isEnabled as zapiHabilitado } from "@/lib/zapi";
import { registrarZeusEvent } from "@/lib/zeus/eventos";
import { tocarHeartbeat } from "@/lib/zeus/estado";
import { MODEL_CHAT } from "@/lib/ai/config";
import { agoraBrasiliaExtenso } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function pontuarNegociacao(neg: { termometro: number; valor: number | null; ultimoContato: Date | null }): number {
  const diasSemContato = neg.ultimoContato ? Math.floor((Date.now() - neg.ultimoContato.getTime()) / 86400000) : 0;
  const valorPts = Math.min((neg.valor ?? 0) / 10000, 50);
  const urgenciaPts = Math.min(diasSemContato, 15);
  return neg.termometro * 0.5 + valorPts * 0.3 + urgenciaPts * 0.2;
}

async function montarDados() {
  const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(inicioDia); fimDia.setDate(fimDia.getDate() + 1);

  const [visitasHoje, aguardando, negociacoesAbertas, alertasAbertos] = await Promise.all([
    db.visita.findMany({
      where: { data: { gte: inicioDia, lt: fimDia } },
      include: { cliente: { select: { nome: true, municipio: { select: { nome: true } } } } },
    }),
    db.cliente.findMany({ where: { aguardandoResposta: true }, select: { nome: true, ultimoContato: true }, take: 20 }),
    db.negociacao.findMany({
      where: { status: "aberta" },
      include: { cliente: { select: { nome: true } } },
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
      ? `Top ${dados.top3.length} negociações para atacar hoje: ${dados.top3.map((n) => `${n.cliente.nome} (${n.maquinaModelo ?? "?"}, R$ ${(n.valor ?? 0).toLocaleString("pt-BR")})`).join("; ")}.`
      : "Sem negociações abertas priorizadas.",
    dados.alertasAbertos.length ? `Alertas abertos: ${dados.alertasAbertos.length}.` : "Sem alertas abertos.",
  ];
  const bruto = linhas.join("\n");

  if (!process.env.ANTHROPIC_API_KEY) return bruto;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await anthropic.messages.create({
      model: MODEL_CHAT,
      max_tokens: 500,
      system: "Você é o ZEUS, assistente autônomo do CRM de um vendedor de máquinas pesadas. Reescreva o briefing abaixo em português, tom direto e profissional, formato de mensagem de WhatsApp (sem markdown, pode usar quebras de linha), sem emojis, mantendo TODOS os dados factuais exatamente como estão — não invente nada além do que foi passado.",
      messages: [{ role: "user", content: bruto }],
    });
    const texto = resp.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    return texto || bruto;
  } catch {
    return bruto;
  }
}

// Briefing matinal via WhatsApp para o próprio vendedor (ZEUS_WHATSAPP_DESTINO).
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await tocarHeartbeat("zeus-diario");

  const destino = process.env.ZEUS_WHATSAPP_DESTINO;
  if (!destino || !zapiHabilitado()) {
    await registrarZeusEvent({
      tipo: "health", severidade: "baixa",
      titulo: "Briefing diário não enviado — ZEUS_WHATSAPP_DESTINO ou Z-API não configurados",
    });
    return NextResponse.json({ ok: false, erro: "ZEUS_WHATSAPP_DESTINO ou Z-API não configurados." });
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
