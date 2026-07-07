// Leitura de arquivos de contatos (CSV, Excel, PDF) para importação em
// Clientes — tolerante a formatos diferentes (Google Contacts em português
// ou inglês, Outlook, listas genéricas) via detecção de coluna por
// cabeçalho e, na falta dele, por conteúdo.

import ExcelJS from "exceljs";

export type ContatoParseado = { nome: string; telefone?: string };
export type ResultadoParse = { contatos: ContatoParseado[]; erro?: string };

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function pareceTelefone(v: string): boolean {
  const digitos = v.replace(/\D/g, "");
  return digitos.length >= 8 && digitos.length <= 14;
}

const REGEX_TELEFONE = /(\+?\d[\d\s().-]{7,}\d)/;

// Acha os índices prováveis de nome/telefone a partir do cabeçalho — tolera
// export em português ou inglês do Google Contacts, Outlook, ou CSV genérico.
function detectarColunas(headers: string[]): { nome: number | null; given: number | null; family: number | null; telefones: number[] } {
  const norm = headers.map(normalizar);

  const nomeIdx = norm.findIndex((h) => ["name", "nome", "nome completo", "full name", "contato", "cliente"].includes(h));
  const givenIdx = norm.findIndex((h) => h.includes("given name") || h.includes("first name") || h === "primeiro nome");
  const familyIdx = norm.findIndex((h) => h.includes("family name") || h.includes("last name") || h.includes("sobrenome"));
  const telefones = norm
    .map((h, i) => (/(phone|telefone|celular|mobile|whatsapp|fone)/.test(h) ? i : -1))
    .filter((i) => i >= 0);

  return {
    nome: nomeIdx >= 0 ? nomeIdx : null,
    given: givenIdx >= 0 ? givenIdx : null,
    family: familyIdx >= 0 ? familyIdx : null,
    telefones,
  };
}

function extrairDeLinhas(linhas: string[][]): ResultadoParse {
  const naoVazias = linhas.filter((l) => l.some((v) => v.trim()));
  if (!naoVazias.length) return { contatos: [], erro: "Arquivo vazio." };
  const [headerRow, ...dataRows] = naoVazias;
  const det = detectarColunas(headerRow);

  let colNome = det.nome;
  let colunasTelefone = det.telefones;

  // Fallback: sem coluna de nome identificada pelo cabeçalho e sem given/family
  // -> usa a primeira coluna (convenção mais comum em listas de contato).
  if (colNome === null && det.given === null) {
    colNome = 0;
  }
  // Fallback: sem coluna de telefone pelo cabeçalho -> procura por CONTEÚDO
  // que pareça telefone na primeira linha de dados.
  if (!colunasTelefone.length && dataRows.length) {
    const primeira = dataRows[0];
    colunasTelefone = primeira.map((v, i) => (pareceTelefone(v) ? i : -1)).filter((i) => i >= 0);
  }

  const contatos: ContatoParseado[] = [];
  for (const row of dataRows) {
    const pegar = (i: number | null) => (i != null ? (row[i] ?? "").trim() : "");
    const nome = colNome != null ? pegar(colNome) : [pegar(det.given), pegar(det.family)].filter(Boolean).join(" ").trim();
    if (!nome) continue;
    let telefone = "";
    for (const i of colunasTelefone) {
      const v = pegar(i);
      if (v) { telefone = v; break; }
    }
    contatos.push({ nome, telefone: telefone || undefined });
  }

  if (!contatos.length) return { contatos: [], erro: "Não encontrei nenhum contato com nome no arquivo." };
  return { contatos };
}

// Parser CSV mínimo compatível com RFC4180 (campos entre aspas podem conter
// vírgula/quebra de linha) — evita depender de stream pra ler um Buffer.
function parseCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let dentroAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else dentroAspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      dentroAspas = true;
    } else if (c === ",") {
      linha.push(campo); campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      linhas.push(linha);
      linha = [];
    } else {
      campo += c;
    }
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

export function parseArquivoCsv(buf: Buffer): ResultadoParse {
  let texto = buf.toString("utf-8");
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1); // remove BOM
  return extrairDeLinhas(parseCsv(texto));
}

export async function parseArquivoExcel(buf: Buffer): Promise<ResultadoParse> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    return { contatos: [], erro: "Não foi possível ler o arquivo Excel (.xlsx/.xls corrompido ou em formato não suportado)." };
  }
  const sheet = wb.worksheets[0];
  if (!sheet) return { contatos: [], erro: "A planilha está vazia." };

  const linhas: string[][] = [];
  sheet.eachRow((row) => {
    const valores: string[] = [];
    for (let i = 1; i <= row.cellCount; i++) {
      valores.push(String(row.getCell(i).value ?? "").trim());
    }
    linhas.push(valores);
  });
  return extrairDeLinhas(linhas);
}

export async function parseArquivoPdf(buf: Buffer): Promise<ResultadoParse> {
  let texto: string;
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buf });
    const resultado = await parser.getText();
    texto = resultado.text;
    await parser.destroy();
  } catch {
    return { contatos: [], erro: "Não foi possível ler o PDF (pode ser uma imagem escaneada, sem texto selecionável)." };
  }

  // PDF não tem estrutura de colunas — heurística: cada linha que contém um
  // número de telefone vira um contato, usando o resto da linha como nome.
  const contatos: ContatoParseado[] = [];
  for (const linhaBruta of texto.split("\n")) {
    const linha = linhaBruta.trim();
    if (!linha) continue;
    const m = linha.match(REGEX_TELEFONE);
    if (!m || m.index == null) continue;
    const telefone = m[1];
    const nome = (linha.slice(0, m.index) + " " + linha.slice(m.index + telefone.length))
      .replace(/[:\-–|()]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!nome) continue;
    contatos.push({ nome, telefone });
  }
  if (!contatos.length) {
    return { contatos: [], erro: "Não encontrei nenhum contato com nome + telefone no PDF. Funciona melhor com uma linha por contato (nome e telefone juntos)." };
  }
  return { contatos };
}
