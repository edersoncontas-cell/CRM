// PDF da proposta comercial de uma página (jsPDF, Helvetica/WinAnsi).
import { jsPDF } from "jspdf";
import { type DadosProposta, brl, calcular } from "@/lib/proposta";

export type ContextoProposta = {
  nomeEmpresa: string;
  nomeVendedor: string;
  telefoneVendedor: string | null;
  clienteNome: string;
  clienteMunicipio: string | null;
  clienteTelefone: string | null;
  maquina: string | null;
  numero: string; // identificador curto
};

// Remove caracteres fora do WinAnsi (emoji etc.) que a Helvetica padrão não desenha.
function limpar(t: string): string {
  return t.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").replace(/[→]/g, "->").replace(/[•]/g, "-").replace(/[–—]/g, "-");
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function gerarPdfProposta(d: DadosProposta, ctx: ContextoProposta): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margem = 16;
  const largura = 210 - margem * 2;
  let y = margem;

  const quebraSe = (h: number) => { if (y + h > 297 - 18) { doc.addPage(); y = margem; } };
  const texto = (t: string, tamanho = 10, estilo: "normal" | "bold" = "normal", cor: [number, number, number] = [40, 44, 52], entrelinha = 4.8) => {
    doc.setFont("helvetica", estilo); doc.setFontSize(tamanho); doc.setTextColor(...cor);
    const partes = doc.splitTextToSize(limpar(t), largura) as string[];
    for (const p of partes) { quebraSe(entrelinha); doc.text(p, margem, y); y += entrelinha; }
  };
  const secao = (n: number, titulo: string) => {
    y += 3; quebraSe(9);
    doc.setFillColor(245, 180, 0); doc.rect(margem, y - 4, 2.2, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 24, 30);
    doc.text(`${n}. ${titulo.toUpperCase()}`, margem + 5, y); y += 6;
  };

  // Cabeçalho
  doc.setFillColor(20, 24, 30); doc.rect(0, 0, 210, 26, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(255, 255, 255);
  doc.text(limpar(ctx.nomeEmpresa), margem, 11);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(245, 180, 0);
  doc.text("PROPOSTA COMERCIAL", margem, 17);
  doc.setTextColor(200, 205, 212);
  doc.text(`Nº ${ctx.numero}   ·   ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}   ·   válida até ${fmtData(d.validade)}`, 210 - margem, 17, { align: "right" });
  y = 34;

  // Cliente
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20, 24, 30);
  doc.text(limpar(d.titulo || `Proposta para ${ctx.clienteNome}`), margem, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90, 100, 112);
  doc.text(limpar([`Cliente: ${ctx.clienteNome}`, ctx.clienteMunicipio, ctx.clienteTelefone].filter(Boolean).join("   ·   ")), margem, y); y += 4.5;
  if (ctx.maquina) { doc.text(limpar(`Máquina: ${ctx.maquina}`), margem, y); y += 4.5; }

  secao(1, "Sua situação hoje");
  texto(d.situacaoAtual || "-");

  secao(2, "A solução");
  texto(d.solucao || "-");

  secao(3, "Retorno em reais");
  texto(d.retorno || "-");
  const r = calcular(d.calc);
  y += 1; quebraSe(16);
  doc.setFillColor(248, 249, 251); doc.rect(margem, y - 3, largura, 15, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(60, 66, 76);
  const colunas = [
    [`Custo/hora hoje`, brl(r.atual.custoHora)],
    [`Custo/hora com a nova`, brl(r.nova.custoHora)],
    [`Economia operacional/mês`, brl(Math.max(0, r.economiaOperacionalMes))],
    [`Vale ao fim de ${d.calc.horizonteAnos} anos`, brl(r.patrimonioAoFim)],
  ];
  colunas.forEach(([rot, val], i) => {
    const x = margem + 3 + i * (largura / 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(110, 118, 130); doc.text(limpar(rot), x, y + 1.5);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 24, 30); doc.text(val, x, y + 7.5);
  });
  y += 15;

  secao(4, "Condição");
  const c = d.condicao;
  const linhasCond = [
    `Valor: ${brl(c.valor)}${c.entradaValor > 0 ? `   ·   Entrada: ${brl(c.entradaValor)}${c.usadaDescricao ? ` (${c.usadaDescricao})` : ""}` : c.usadaDescricao ? `   ·   Usada na troca: ${c.usadaDescricao}` : ""}`,
    c.parcelas > 0 ? `Saldo em ${c.parcelas}x de ${brl(c.parcelaValor)}${c.instrumento ? ` (${c.instrumento})` : ""}${c.carenciaDias > 0 ? ` · carência de ${c.carenciaDias} dias` : ""}` : c.instrumento ? `Pagamento: ${c.instrumento}` : "",
    `Entrega em ${c.entregaDias} dias   ·   Garantia de ${c.garantiaMeses} meses${c.inclusos ? `   ·   Inclusos: ${c.inclusos}` : ""}`,
  ].filter(Boolean);
  for (const l of linhasCond) texto(l, 10);

  if (d.prova) { secao(5, "Quem já fez"); texto(d.prova); }

  secao(d.prova ? 6 : 5, "Validade e próximo passo");
  texto(`Esta condição vale até ${fmtData(d.validade)}. ${d.proximoPasso}`.trim());

  // Rodapé
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(220, 224, 230); doc.line(margem, 297 - 14, 210 - margem, 297 - 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 128, 140);
    doc.text(limpar(`${ctx.nomeVendedor}${ctx.telefoneVendedor ? ` · ${ctx.telefoneVendedor}` : ""} · ${ctx.nomeEmpresa}`), margem, 297 - 9);
    doc.text(`Página ${p} de ${paginas}`, 210 - margem, 297 - 9, { align: "right" });
  }
  return Buffer.from(doc.output("arraybuffer"));
}
