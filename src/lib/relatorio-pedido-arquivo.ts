// Relatório sob demanda — transforma um RelatorioPronto em PDF ou planilha.
// Sem banco aqui: recebe o relatório pronto, devolve bytes.

import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";
import { limparParaPdf } from "@/lib/pdf-texto";
import { LIMITES_RELATORIO, type RelatorioPronto } from "@/lib/relatorio-pedido-regra";

const fmtGeradoEm = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const AVISO_CORTE = `Mostrando as primeiras ${LIMITES_RELATORIO.linhasNoArquivo} linhas — havia mais. Restrinja o período para ver o resto.`;

export function gerarPdfPedido(r: RelatorioPronto, agora: Date = new Date()): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const margem = 12;
  const W = 297, H = 210;
  const largura = W - margem * 2;
  let y = margem;

  // Largura das colunas: reparte pelo tamanho do maior texto de cada coluna
  // (com piso e teto), depois ajusta para somar a largura útil.
  const pesos = r.colunas.map((c, i) => {
    const maior = Math.max(c.length, ...r.linhas.map((l) => (l[i] ?? "").length));
    return Math.min(Math.max(maior, 6), 40);
  });
  const soma = pesos.reduce((a, b) => a + b, 0);
  const larguras = pesos.map((p) => (p / soma) * largura);

  const cabecalhoTabela = () => {
    doc.setFillColor(238, 240, 243);
    doc.rect(margem, y - 4, largura, 6.5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(17, 27, 33);
    let x = margem + 1.5;
    r.colunas.forEach((c, i) => { doc.text(limparParaPdf(c), x, y); x += larguras[i]; });
    y += 5;
  };
  const quebra = (altura: number) => {
    if (y + altura > H - margem - 6) { doc.addPage(); y = margem; if (r.linhas.length) cabecalhoTabela(); }
  };

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(17, 27, 33);
  doc.text(limparParaPdf(r.titulo), margem, y); y += 6.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100);
  doc.text(limparParaPdf(`${r.subtitulo}   •   gerado em ${fmtGeradoEm(agora)}`), margem, y); y += 7;

  // Resumo em linha: "Vendas: 4   Valor total: R$ 1.200.000"
  if (r.resumo.length) {
    doc.setFontSize(10); doc.setTextColor(17, 27, 33);
    const linha = r.resumo.map((s) => `${s.rotulo}: ${s.valor}`).join("     ");
    for (const p of doc.splitTextToSize(limparParaPdf(linha), largura) as string[]) { doc.text(p, margem, y); y += 5; }
    y += 2;
  }
  if (r.aviso) {
    doc.setFontSize(9); doc.setTextColor(150, 90, 0);
    for (const p of doc.splitTextToSize(limparParaPdf(r.aviso), largura) as string[]) { doc.text(p, margem, y); y += 4.5; }
    y += 1;
  }

  if (!r.linhas.length) {
    doc.setFontSize(11); doc.setTextColor(120);
    doc.text("Nada encontrado para este pedido.", margem, y + 4);
  } else {
    cabecalhoTabela();
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
    for (const linha of r.linhas) {
      const celulas = linha.map((t, i) => doc.splitTextToSize(limparParaPdf(t ?? ""), larguras[i] - 3) as string[]);
      const altura = Math.max(...celulas.map((c) => c.length)) * 4.2 + 1.5;
      quebra(altura);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40);
      let x = margem + 1.5;
      celulas.forEach((c, i) => { doc.text(c, x, y); x += larguras[i]; });
      y += altura;
      doc.setDrawColor(230); doc.line(margem, y - 3, margem + largura, y - 3);
    }
    if (r.cortado) {
      quebra(8);
      y += 2; doc.setFontSize(9); doc.setTextColor(150, 90, 0);
      doc.text(AVISO_CORTE, margem, y);
    }
  }

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`CRMaquinas  •  Página ${p} de ${paginas}`, W - margem, H - 6, { align: "right" });
  }
  return Buffer.from(doc.output("arraybuffer"));
}

export async function gerarXlsxPedido(r: RelatorioPronto, agora: Date = new Date()): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CRMaquinas";
  wb.created = agora;
  const ws = wb.addWorksheet(r.titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));

  const largura = Math.max(r.colunas.length, 2);
  ws.addRow([r.titulo]).font = { bold: true, size: 14 };
  ws.addRow([`${r.subtitulo} — gerado em ${fmtGeradoEm(agora)}`]).font = { color: { argb: "FF666666" } };
  for (const s of r.resumo) ws.addRow([s.rotulo, s.valor]).getCell(1).font = { bold: true };
  if (r.aviso) ws.addRow([r.aviso]).font = { color: { argb: "FF966000" } };
  ws.addRow([]);

  const cab = ws.addRow(r.colunas);
  cab.font = { bold: true };
  cab.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF0F3" } }; });
  for (const l of r.linhas) ws.addRow(l);
  if (!r.linhas.length) ws.addRow(["Nada encontrado para este pedido."]);
  if (r.cortado) ws.addRow([AVISO_CORTE]).font = { color: { argb: "FF966000" } };

  // Largura por conteúdo (com teto) — só olha as linhas da tabela.
  for (let i = 0; i < largura; i++) {
    const maior = Math.max((r.colunas[i] ?? "").length, ...r.linhas.map((l) => (l[i] ?? "").length));
    ws.getColumn(i + 1).width = Math.min(Math.max(maior + 2, 12), 50);
  }
  ws.views = [{ state: "frozen", ySplit: cab.number }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
