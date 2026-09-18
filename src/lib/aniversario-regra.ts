// Aniversário do cliente — regras puras (sem banco, sem IA), testáveis.
//
// A data de nascimento é guardada como meio-dia de Brasília (mesma convenção
// do parseDataBR dos formulários), então dia/mês saem certos em qualquer
// fuso do servidor.

import { semAcento } from "@/lib/utils";

const FUSO = "America/Sao_Paulo";

function partesBrasilia(d: Date): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d).split("-").map(Number);
  return { ano, mes, dia };
}

// "1985-03-12", "12/03/1985", "12-03-1985" → Date (meio-dia de Brasília).
// Qualquer outra coisa, ou dia/mês impossíveis, → null.
export function interpretarDataNascimento(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const t = valor.trim();
  let ano: number, mes: number, dia: number;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/))) [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(`${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}T12:00:00-03:00`);
  if (isNaN(d.getTime())) return null;
  const p = partesBrasilia(d);
  if (p.dia !== dia || p.mes !== mes) return null; // 31/02 etc.
  return d;
}

export function idadeEm(nascimento: Date, hoje: Date): number {
  const n = partesBrasilia(nascimento);
  const h = partesBrasilia(hoje);
  let idade = h.ano - n.ano;
  if (h.mes < n.mes || (h.mes === n.mes && h.dia < n.dia)) idade--;
  return idade;
}

// Documento de cliente de máquina pesada: entre 16 e 100 anos. Fora disso é
// leitura errada (data de emissão, validade, número de registro…).
export function idadePlausivel(nascimento: Date, hoje: Date): boolean {
  const i = idadeEm(nascimento, hoje);
  return i >= 16 && i <= 100;
}

const tokens = (s: string) => semAcento(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length >= 3);

// O nome no documento é da mesma pessoa do cadastro? Vale o primeiro nome
// igual, ou dois nomes em comum (cadastro "Zé da Terraplanagem" x documento
// "José Carlos da Silva" não passa). Cadastro só com número nunca combina —
// não dá para saber de quem é o documento.
export function nomeCombina(nomeCliente: string, nomeDocumento: string): boolean {
  const c = tokens(nomeCliente);
  const d = new Set(tokens(nomeDocumento));
  if (!c.length || !d.size) return false;
  if (/^\d/.test(nomeCliente.trim())) return false;
  if (d.has(c[0])) return true;
  return c.filter((t) => d.has(t)).length >= 2;
}

// Quantos dias faltam para o próximo aniversário (0 = hoje), no calendário
// de Brasília. 29/02 em ano sem bissexto conta como 28/02.
export function diasAteAniversario(nascimento: Date, hoje: Date): number {
  const n = partesBrasilia(nascimento);
  const h = partesBrasilia(hoje);
  const hojeUtc = Date.UTC(h.ano, h.mes - 1, h.dia);
  for (const ano of [h.ano, h.ano + 1]) {
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
    const dia = n.mes === 2 && n.dia === 29 && !bissexto ? 28 : n.dia;
    const alvo = Date.UTC(ano, n.mes - 1, dia);
    if (alvo >= hojeUtc) return Math.round((alvo - hojeUtc) / 86_400_000);
  }
  return 365;
}

export function aniversarioNaJanela(nascimento: Date, hoje: Date, dias: number): boolean {
  return diasAteAniversario(nascimento, hoje) <= dias;
}

export function diaMes(nascimento: Date): string {
  const p = partesBrasilia(nascimento);
  return `${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}`;
}

export function dataCompleta(nascimento: Date): string {
  const p = partesBrasilia(nascimento);
  return `${diaMes(nascimento)}/${p.ano}`;
}

export function dataISO(nascimento: Date): string {
  const p = partesBrasilia(nascimento);
  return `${p.ano}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}

export function anoBrasilia(d: Date): number {
  return partesBrasilia(d).ano;
}

// Envio automático de parabéns: manda hoje se é o dia, tem telefone e ainda
// não foi mandado neste ano (o cron pode rodar mais de uma vez no dia).
export function deveMandarParabens(
  c: { dataNascimento: Date | null; telefone: string | null; status?: string | null },
  hoje: Date,
  enviadoNoAno: number | null,
): boolean {
  if (!c.dataNascimento || !c.telefone || (c.telefone.replace(/\D/g, "").length < 10)) return false;
  if (c.status === "nao_cliente") return false;
  if (diasAteAniversario(c.dataNascimento, hoje) !== 0) return false;
  return enviadoNoAno !== anoBrasilia(hoje);
}

// "documento:CNH" → "lido de uma CNH pela IA"; "manual" → "informado no cadastro".
export function descreverOrigem(origem: string | null): string | null {
  if (!origem) return null;
  if (origem === "manual") return "informado no cadastro";
  if (origem.startsWith("documento:")) return `lido pela IA de ${origem.slice("documento:".length)} recebido no WhatsApp`;
  return origem;
}
