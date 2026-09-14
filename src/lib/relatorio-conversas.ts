// Relatório de conversas do WhatsApp (PDF): para cada conversa com atividade
// no período, nome do cliente, telefone (DDD) XXXXX-XXXX, resumo IA do que
// foi conversado e o tempo da conversa (início, fim, duração, mensagens).
//
// O resumo é gerado uma vez por conversa e guardado em
// WhatsAppConversation.resumoRelatorio — só é refeito quando chega mensagem
// nova (resumoRelatorioEm < lastMessageAt). Assim o relatório pode ser
// gerado quantas vezes quiser sem gastar IA de novo.

import { jsPDF } from "jspdf";
import { db } from "@/lib/db";
import { resumirConversaIA } from "@/lib/ai";

export type LinhaRelatorio = {
  conversaId: string;
  nome: string;
  telefone: string;
  resumo: string | null; // null = ainda não gerado
  mensagens: number;
  inicio: string; // ISO
  fim: string;    // ISO
  duracaoTexto: string;
};

export type FiltroRelatorio = { de: Date; ate: Date; conversaId?: string | null };

// (DDD) XXXXX-XXXX para celular, (DDD) XXXX-XXXX para fixo. Ids que não são
// telefone (@lid, grupo) voltam como estão.
export function formatarTelefoneBR(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (!d) return raw;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

export function duracaoTexto(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}h ${m}min` : `${h}h`;
  const d = Math.floor(h / 24);
  const hr = h % 24;
  return hr ? `${d}d ${hr}h` : `${d} dia${d > 1 ? "s" : ""}`;
}

const fmtDataHora = (d: Date | string) =>
  new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtData = (d: Date | string) =>
  new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

async function carregarConversas(f: FiltroRelatorio) {
  const periodo = { sentAt: { gte: f.de, lte: f.ate }, isDraft: false };
  const convs = await db.whatsAppConversation.findMany({
    where: {
      isGroup: false,
      ...(f.conversaId ? { id: f.conversaId } : { messages: { some: periodo } }),
    },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    select: {
      id: true, externalPhone: true, contactName: true, clienteId: true, lastMessageAt: true,
      resumoRelatorio: true, resumoRelatorioEm: true,
      messages: { where: periodo, orderBy: { sentAt: "asc" }, select: { sentAt: true } },
    },
  });

  const clienteIds = Array.from(new Set(convs.map((c) => c.clienteId).filter((id): id is string => !!id)));
  const clientes = clienteIds.length
    ? await db.cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nome: true } })
    : [];
  const nomePorId = new Map(clientes.map((c) => [c.id, c.nome]));

  return convs
    .filter((c) => c.messages.length > 0)
    .map((c) => ({ ...c, nomeCliente: c.clienteId ? nomePorId.get(c.clienteId) ?? null : null }));
}

type ConvCarregada = Awaited<ReturnType<typeof carregarConversas>>[number];

function cacheValido(c: ConvCarregada): boolean {
  return !!c.resumoRelatorio && !!c.resumoRelatorioEm && c.resumoRelatorioEm >= c.lastMessageAt;
}

function paraLinha(c: ConvCarregada): LinhaRelatorio {
  const inicio = c.messages[0].sentAt;
  const fim = c.messages[c.messages.length - 1].sentAt;
  return {
    conversaId: c.id,
    nome: c.nomeCliente ?? c.contactName ?? formatarTelefoneBR(c.externalPhone),
    telefone: formatarTelefoneBR(c.externalPhone),
    resumo: cacheValido(c) ? c.resumoRelatorio : null,
    mensagens: c.messages.length,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    duracaoTexto: duracaoTexto(fim.getTime() - inicio.getTime()),
  };
}

export async function listarRelatorio(f: FiltroRelatorio): Promise<LinhaRelatorio[]> {
  return (await carregarConversas(f)).map(paraLinha);
}

// Gera (e guarda) o resumo das conversas que ainda não têm, dentro de um
// orçamento de tempo — a tela chama repetidas vezes até `pendentes` zerar,
// para nunca estourar o limite da função na Vercel.
export async function prepararResumos(f: FiltroRelatorio, orcamentoMs = 40_000): Promise<{ total: number; pendentes: number }> {
  const convs = await carregarConversas(f);
  const semResumo = convs.filter((c) => !cacheValido(c));
  const t0 = Date.now();
  let feitos = 0;

  for (const c of semResumo) {
    if (Date.now() - t0 > orcamentoMs) break;
    const msgs = await db.whatsAppMessage.findMany({
      where: { conversationId: c.id, isDraft: false },
      orderBy: { sentAt: "desc" },
      take: 80,
      select: { direction: true, body: true, sentAt: true },
    });
    const thread = msgs
      .reverse()
      .map((m) => `[${fmtDataHora(m.sentAt)}] ${m.direction === "OUT" ? "Vendedor" : "Cliente"}: ${m.body}`)
      .join("\n");
    const resumo = await resumirConversaIA(thread);
    // Carimba com o lastMessageAt de ANTES de gerar: se chegou mensagem no
    // meio, o cache já nasce inválido e é refeito na próxima vez.
    await db.whatsAppConversation.update({
      where: { id: c.id },
      data: { resumoRelatorio: resumo, resumoRelatorioEm: c.lastMessageAt },
    });
    feitos++;
  }
  return { total: convs.length, pendentes: semResumo.length - feitos };
}

// As fontes padrão do PDF (Helvetica/WinAnsi) têm acentos do português mas
// não têm emoji — remove antes de escrever, senão vira lixo no PDF.
const limparParaPdf = (s: string) =>
  s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\*\*/g, "").replace(/\r/g, "");

export function gerarPdfRelatorio(linhas: LinhaRelatorio[], periodo: { de: Date; ate: Date }): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margem = 15;
  const largura = 210 - margem * 2;
  const limiteY = 297 - margem;
  let y = margem;

  const quebraSe = (altura: number) => {
    if (y + altura > limiteY) { doc.addPage(); y = margem; }
  };
  const escreverParagrafo = (texto: string, tamanho: number, cor: number, estilo: "normal" | "bold" = "normal", entrelinha = 4.5) => {
    doc.setFont("helvetica", estilo); doc.setFontSize(tamanho); doc.setTextColor(cor);
    const partes = doc.splitTextToSize(limparParaPdf(texto), largura) as string[];
    for (const p of partes) { quebraSe(entrelinha); doc.text(p, margem, y); y += entrelinha; }
  };

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(17, 27, 33);
  doc.text("Relatório de conversas do WhatsApp", margem, y); y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100);
  doc.text(`Período: ${fmtData(periodo.de)} a ${fmtData(periodo.ate)}   •   ${linhas.length} conversa(s)   •   gerado em ${fmtDataHora(new Date())}`, margem, y);
  y += 8;

  if (!linhas.length) {
    doc.setTextColor(120); doc.setFontSize(11);
    doc.text("Nenhuma conversa com mensagens no período selecionado.", margem, y);
  }

  linhas.forEach((l, i) => {
    quebraSe(30);
    doc.setDrawColor(220); doc.line(margem, y, margem + largura, y); y += 5;

    escreverParagrafo(`${i + 1}. ${l.nome}`, 12, 17, "bold", 5.5);
    escreverParagrafo(`Telefone: ${l.telefone}`, 10, 80);
    escreverParagrafo(
      `Tempo da conversa: ${fmtDataHora(l.inicio)} até ${fmtDataHora(l.fim)}  (${l.duracaoTexto}, ${l.mensagens} mensagem${l.mensagens === 1 ? "" : "s"})`,
      10, 80
    );
    y += 1.5;
    escreverParagrafo("Resumo:", 10, 17, "bold");
    escreverParagrafo(l.resumo ?? "Resumo ainda não gerado — gere o relatório de novo.", 10, 40);
    y += 4;
  });

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`CRM New Holland / Dynapac  •  Página ${p} de ${paginas}`, 210 - margem, 297 - 8, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
