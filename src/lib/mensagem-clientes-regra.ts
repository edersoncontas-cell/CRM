// Mensagem para clientes (tela de Visitas): visita, promoção, data
// comemorativa ou aniversário, para todos os clientes, os de uma cidade ou
// os aniversariantes. Regras puras (sem banco, sem IA) — testáveis. O envio e
// a personalização do {nome} vêm de abordagem-cidade-regra.ts.

import { modeloAbordagemPadrao } from "@/lib/abordagem-cidade-regra";

export type TipoMensagem = "visita" | "promocao" | "comemorativa" | "aniversario";

export const TIPOS_MENSAGEM: { id: TipoMensagem; nome: string; descricao: string }[] = [
  { id: "visita", nome: "Agendar visita", descricao: "Você vai estar na cidade e quer marcar visitas." },
  { id: "promocao", nome: "Promoção / divulgação", descricao: "Oferta, condição especial ou lançamento — com imagem ou vídeo." },
  { id: "comemorativa", nome: "Data comemorativa", descricao: "Dia do Operador, Dia do Cliente, Natal, Ano Novo…" },
  { id: "aniversario", nome: "Aniversário", descricao: "Parabéns para quem faz aniversário hoje ou nos próximos 30 dias — ou automático, todo dia às 8h." },
];

export type DataComemorativa = { id: string; nome: string; dia: number; mes: number; tema: string };

export const DATAS_COMEMORATIVAS: DataComemorativa[] = [
  { id: "operador", nome: "Dia do Operador de Máquinas Pesadas", dia: 29, mes: 5, tema: "homenagem a quem opera máquina pesada todo dia, com respeito ao ofício" },
  { id: "cliente", nome: "Dia do Cliente", dia: 15, mes: 9, tema: "agradecimento pela confiança e pela parceria" },
  { id: "natal", nome: "Natal", dia: 25, mes: 12, tema: "boas festas, família, descanso e gratidão pelo ano" },
  { id: "ano-novo", nome: "Ano Novo", dia: 1, mes: 1, tema: "votos de um ano novo com muita obra, saúde e prosperidade" },
];

const FUSO = "America/Sao_Paulo";
function hojeBrasilia(hoje: Date): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(hoje).split("-").map(Number);
  return { ano, mes, dia };
}

// Próxima vez que a data cai (hoje conta como 0 dias).
export function proximaOcorrencia(d: DataComemorativa, hoje = new Date()): { diasAte: number; ano: number } {
  const h = hojeBrasilia(hoje);
  const hojeUtc = Date.UTC(h.ano, h.mes - 1, h.dia);
  for (const ano of [h.ano, h.ano + 1]) {
    const alvo = Date.UTC(ano, d.mes - 1, d.dia);
    if (alvo >= hojeUtc) return { diasAte: Math.round((alvo - hojeUtc) / 86_400_000), ano };
  }
  return { diasAte: 365, ano: h.ano + 1 };
}

export function rotuloDataComemorativa(d: DataComemorativa, hoje = new Date()): string {
  const { diasAte } = proximaOcorrencia(d, hoje);
  const ddmm = `${String(d.dia).padStart(2, "0")}/${String(d.mes).padStart(2, "0")}`;
  if (diasAte === 0) return `${ddmm} · hoje`;
  if (diasAte === 1) return `${ddmm} · amanhã`;
  return `${ddmm} · em ${diasAte} dias`;
}

// Datas mais próximas primeiro — a que está chegando é a que interessa.
export function datasPorProximidade(hoje = new Date()): DataComemorativa[] {
  return [...DATAS_COMEMORATIVAS].sort((a, b) => proximaOcorrencia(a, hoje).diasAte - proximaOcorrencia(b, hoje).diasAte);
}

export type JanelaAniversario = 0 | 30;
export const JANELAS_ANIVERSARIO: JanelaAniversario[] = [0, 30];
export type Publico =
  | { modo: "todos" }
  | { modo: "cidade"; municipioId: string }
  | { modo: "aniversariantes"; dias: JanelaAniversario };

export function publicosDoTipo(tipo: TipoMensagem): Publico["modo"][] {
  if (tipo === "visita") return ["cidade"];
  if (tipo === "aniversario") return ["aniversariantes"];
  return ["todos", "cidade"];
}

export function publicoPadrao(tipo: TipoMensagem): Publico {
  if (tipo === "visita") return { modo: "cidade", municipioId: "" };
  if (tipo === "aniversario") return { modo: "aniversariantes", dias: 0 };
  return { modo: "todos" };
}

export type ContextoTexto = { cidade?: string; periodo?: string; data?: DataComemorativa; promocao?: string; vendedor?: string; marcas?: string };

// Texto que vale mesmo sem IA configurada — sempre com {nome}.
export function modeloPadrao(tipo: TipoMensagem, ctx: ContextoTexto): string {
  const vendedor = ctx.vendedor || "Edy";
  const marcas = ctx.marcas || "New Holland Construction e Dynapac";
  if (tipo === "visita") return modeloAbordagemPadrao(ctx.cidade || "sua cidade", ctx.periodo || "na semana que vem");
  if (tipo === "promocao") {
    const oferta = ctx.promocao?.trim() ? ctx.promocao.trim() : "uma condição especial nas máquinas";
    return `Olá {nome}, tudo bem? Aqui é o ${vendedor}, da ${marcas}. Estou passando para te contar: ${oferta}. Se fizer sentido para a sua operação, me chama que eu te passo os detalhes.`;
  }
  if (tipo === "aniversario") {
    return `Feliz aniversário, {nome}! 🎂 Aqui é o ${vendedor}, da ${marcas}. Desejo um ano novo de vida com muita saúde, boas obras e a máquina sempre rodando. Um abraço!`;
  }
  const d = ctx.data ?? DATAS_COMEMORATIVAS[1];
  if (d.id === "operador") return `Olá {nome}! Hoje é o Dia do Operador de Máquinas Pesadas. Parabéns a você e a toda a sua equipe que faz a obra acontecer todos os dias. Um abraço do ${vendedor}, da ${marcas}.`;
  if (d.id === "cliente") return `Olá {nome}! Hoje é o Dia do Cliente e eu não podia deixar passar: obrigado pela confiança e pela parceria. Conte comigo sempre. Um abraço do ${vendedor}, da ${marcas}.`;
  if (d.id === "natal") return `Olá {nome}! Que o Natal traga paz, descanso e um bom tempo com a família. Obrigado por este ano de parceria. Feliz Natal! Um abraço do ${vendedor}, da ${marcas}.`;
  return `Olá {nome}! Que o ano novo venha com muita saúde, muita obra e prosperidade para você e a sua equipe. Feliz Ano Novo! Um abraço do ${vendedor}, da ${marcas}.`;
}

// Vercel aceita ~4,5 MB por requisição; abaixo disso a foto (já comprimida
// no navegador) e um vídeo curto passam.
export const LIMITE_ANEXO_BYTES = 4 * 1024 * 1024;

export type TipoMidia = "image" | "video" | "document";

export function tipoDaMidia(mime: string): TipoMidia | null {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m === "application/pdf") return "document";
  return null;
}

export function validarAnexo(mime: string, bytes: number): string | null {
  if (!tipoDaMidia(mime)) return "Só imagem (JPG/PNG), vídeo (MP4) ou PDF.";
  if (bytes > LIMITE_ANEXO_BYTES) return `Arquivo com ${(bytes / 1024 / 1024).toFixed(1)} MB — o limite é ${LIMITE_ANEXO_BYTES / 1024 / 1024} MB. Vídeo maior que isso: reduza a qualidade no celular antes.`;
  return null;
}

export function legendaDaMidia(tipo: TipoMidia, nome: string): string {
  if (tipo === "image") return "📷 Imagem";
  if (tipo === "video") return "🎬 Vídeo";
  return nome || "📄 Documento";
}

export type BaseArte = "escavadeira" | "rolo" | "nenhuma";

export const BASES_ARTE: { id: BaseArte; nome: string; arquivo: string | null }[] = [
  { id: "escavadeira", nome: "Escavadeira New Holland", arquivo: "nh-escavadeiras.jpg" },
  { id: "rolo", nome: "Rolo Dynapac", arquivo: "dynapac-rolos.jpg" },
  { id: "nenhuma", nome: "Sem foto de base", arquivo: null },
];

// Pedido para o Gemini criar a arte. Texto na imagem só o que o vendedor
// pediu (a IA erra português quando inventa frase).
export function promptArte(args: { tipo: TipoMensagem; instrucoes: string; data?: DataComemorativa; promocao?: string; base: BaseArte; marcas?: string }): string {
  const marcas = args.marcas || "New Holland Construction e Dynapac";
  const tema =
    args.tipo === "comemorativa" ? `${args.data?.nome ?? "data comemorativa"}: ${args.data?.tema ?? ""}` :
    args.tipo === "aniversario" ? "parabéns de aniversário para um cliente" :
    args.tipo === "promocao" ? `promoção/divulgação: ${args.promocao?.trim() || "condição especial nas máquinas"}` :
    "convite para uma visita do vendedor";
  const baseTxt = args.base === "nenhuma"
    ? "Componha a cena com máquinas pesadas de construção (escavadeira, retroescavadeira, pá-carregadeira ou rolo compactador) amarelas, em obra ou pátio."
    : "Use a máquina da foto de referência como elemento principal, sem mudar o modelo nem as cores dela; pode trocar o fundo e a iluminação.";
  const instrucoes = args.instrucoes.trim() ? `Pedido do vendedor: ${args.instrucoes.trim()}.` : "";
  return [
    `Crie UMA arte quadrada (1:1) para enviar por WhatsApp, de uma concessionária de máquinas pesadas ${marcas}, identidade visual amarelo e preto, acabamento profissional e realista.`,
    `Tema: ${tema}.`,
    baseTxt,
    instrucoes,
    "Se colocar texto na imagem, só uma frase curta em português do Brasil, sem erro de ortografia, bem legível. Sem marca d'água, sem logotipo de outras marcas, sem pessoas reais identificáveis.",
  ].filter(Boolean).join(" ");
}
