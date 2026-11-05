// Suporte e sugestões — regras PURAS (sem banco), usadas pela tela, pela rota
// e pelos testes. Pode ser importado por componente "use client".
//
// O recurso nasce DESLIGADO: só a palavra exata "ligado" em
// Configuracao["recurso.suporte"] liga. Ausente, vazio, outro valor ou banco
// fora do ar = desligado (CLAUDE.md §3: o padrão nunca pode ser o que muda o
// CRM em uso).

export const CHAVE_RECURSO_SUPORTE = "recurso.suporte";

export function recursoLigado(valor: unknown): boolean {
  return valor === "ligado";
}

export const STATUS_TICKET = ["novo", "em_analise", "aprovado", "implementado", "descartado"] as const;
export type StatusTicket = (typeof STATUS_TICKET)[number];

export const ROTULO_STATUS: Record<StatusTicket, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  implementado: "Implementado",
  descartado: "Descartado",
};

export function statusValido(s: unknown): s is StatusTicket {
  return typeof s === "string" && (STATUS_TICKET as readonly string[]).includes(s);
}

export const LADOS = ["vendedor", "admin"] as const;
export type LadoMensagem = (typeof LADOS)[number];
export function ladoValido(s: unknown): s is LadoMensagem {
  return typeof s === "string" && (LADOS as readonly string[]).includes(s);
}

export const LIMITES = {
  descricao: 4000,
  porQue: 2000,
  resposta: 4000,
  anexosPorMensagem: 3,
  // Depois de reduzida no navegador (lado maior 1280 px, JPEG), um print fica
  // entre 80 e 300 KB. O teto protege a cota de armazenamento do banco grátis
  // e mantém o pedido abaixo do limite de ~4,5 MB por requisição da Vercel.
  bytesPorAnexo: 400_000,
  ladoMaiorPx: 1280,
  ticketsPorHora: 10,
} as const;

export const MIMES_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;

export const DICA_CAMPO = "Ctrl+V para colar prints, Enter para enviar";

export type AnexoEntrada = { mimeType: string; nome: string; base64: string };

/** Tamanho real (em bytes) do conteúdo de um base64 sem o prefixo data:. */
export function bytesDoBase64(b64: string): number {
  const limpo = b64.replace(/\s/g, "");
  const pad = limpo.endsWith("==") ? 2 : limpo.endsWith("=") ? 1 : 0;
  return Math.floor((limpo.length * 3) / 4) - pad;
}

const RE_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export type Validado<T> = { ok: true; valor: T } | { ok: false; erro: string };

export function validarAnexos(anexos: unknown): Validado<(AnexoEntrada & { tamanho: number })[]> {
  if (anexos == null) return { ok: true, valor: [] };
  if (!Array.isArray(anexos)) return { ok: false, erro: "Anexos em formato inválido." };
  if (anexos.length > LIMITES.anexosPorMensagem) {
    return { ok: false, erro: `No máximo ${LIMITES.anexosPorMensagem} prints por mensagem.` };
  }
  const saida: (AnexoEntrada & { tamanho: number })[] = [];
  for (const [i, a] of anexos.entries()) {
    const n = i + 1;
    if (!a || typeof a !== "object") return { ok: false, erro: `Print ${n} inválido.` };
    const { mimeType, nome, base64 } = a as Record<string, unknown>;
    if (typeof mimeType !== "string" || !(MIMES_ACEITOS as readonly string[]).includes(mimeType)) {
      return { ok: false, erro: `Print ${n}: só imagem JPEG, PNG ou WebP.` };
    }
    if (typeof base64 !== "string" || !base64 || !RE_BASE64.test(base64.replace(/\s/g, ""))) {
      return { ok: false, erro: `Print ${n}: arquivo corrompido.` };
    }
    const tamanho = bytesDoBase64(base64);
    if (tamanho > LIMITES.bytesPorAnexo) {
      return { ok: false, erro: `Print ${n} grande demais (${Math.round(tamanho / 1024)} KB; máximo ${Math.round(LIMITES.bytesPorAnexo / 1024)} KB).` };
    }
    const nomeLimpo = (typeof nome === "string" ? nome : "").replace(/[^\w.\- ]/g, "").trim().slice(0, 80) || `print-${n}.jpg`;
    saida.push({ mimeType, nome: nomeLimpo, base64: base64.replace(/\s/g, ""), tamanho });
  }
  return { ok: true, valor: saida };
}

export type NovoTicketEntrada = { descricao: string; porQue: string | null; tela: string | null; contexto: string | null };

export function validarNovoTicket(e: Record<string, unknown>): Validado<NovoTicketEntrada> {
  const descricao = typeof e.descricao === "string" ? e.descricao.trim() : "";
  const porQue = typeof e.porQue === "string" ? e.porQue.trim() : "";
  if (!descricao) return { ok: false, erro: "Escreva o que aconteceu ou o que você quer." };
  if (descricao.length > LIMITES.descricao) return { ok: false, erro: `Texto longo demais (máximo ${LIMITES.descricao} caracteres).` };
  if (porQue.length > LIMITES.porQue) return { ok: false, erro: `O "por que importa" passou de ${LIMITES.porQue} caracteres.` };
  return {
    ok: true,
    valor: {
      descricao,
      porQue: porQue || null,
      tela: normalizarTela(e.tela),
      contexto: typeof e.contexto === "string" ? e.contexto.slice(0, 300) : null,
    },
  };
}

/** Só o caminho da tela (sem domínio, sem ?query nem #), para nunca guardar dado de cliente da URL. */
export function normalizarTela(t: unknown): string | null {
  if (typeof t !== "string" || !t.startsWith("/")) return null;
  const caminho = t.split(/[?#]/)[0].slice(0, 200);
  return caminho || null;
}

/** Primeira linha do pedido, curta, para a lista. */
export function assuntoDe(descricao: string): string {
  const linha = descricao.trim().split("\n")[0].trim();
  return linha.length > 80 ? `${linha.slice(0, 77).trimEnd()}…` : linha || "Pedido sem título";
}

/**
 * Pasta do código da tela, a partir do caminho. Identificadores no caminho
 * (/clientes/ckx123) viram o segmento dinâmico do Next ([id]).
 */
export function pastaDaTela(tela: string | null): string | null {
  if (!tela) return null;
  const partes = tela.split("/").filter(Boolean);
  if (!partes.length) return null;
  const segs = partes.map((p, i) => (i > 0 && /^(c[a-z0-9]{20,}|[0-9a-f-]{20,}|\d+)$/i.test(p) ? "[id]" : p));
  return `src/app/(app)/${segs.join("/")}`;
}

/**
 * O "prompt pronto": texto para colar no Claude Code e implementar o pedido.
 * Funciona sem IA. Leva as palavras do vendedor sem reescrever (a IA pode
 * melhorar a redação depois, mas o pedido nunca depende dela).
 */
export function gerarPromptPronto(t: {
  id: string;
  descricao: string;
  porQue: string | null;
  tela: string | null;
  anexos: number;
  criadoEm: Date;
}): string {
  const pasta = pastaDaTela(t.tela);
  const data = t.criadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const linhas = [
    `# Pedido de melhoria vindo do CRM (ticket ${t.id}, ${data})`,
    "",
    "## O que o vendedor pediu (palavras dele)",
    citar(t.descricao),
    "",
    "## Por que é importante",
    t.porQue ? citar(t.porQue) : "> (não informado)",
    "",
    "## Onde",
    t.tela ? `- Tela: \`${t.tela}\`` : "- Tela: não informada",
    pasta ? `- Código provável: \`${pasta}/\` (confirme com grep antes de mexer)` : "- Código: localizar pela tela descrita",
    t.anexos > 0
      ? `- ${t.anexos} print(s) anexado(s): baixe em /suporte (ticket ${t.id}) e anexe aqui.`
      : "- Sem print anexado.",
    "",
    "## Como fazer",
    "1. Leia o CLAUDE.md e diga modelo e esforço recomendados antes de começar.",
    "2. Responda as 3 perguntas: o que mais depende disso (grep), o que acontece quando dá errado, o que não deu para conferir.",
    "3. Rode a bateria (tsc, eslint, vitest, build) e confira a tela a 1440 e a 390, nos dois temas se mexer em cor.",
    "4. Se o pedido estiver ambíguo, proponha a interpretação antes de implementar.",
    "5. Termine com o bloco de Conferência.",
  ];
  return linhas.join("\n");
}

function citar(texto: string): string {
  return texto.split("\n").map((l) => `> ${l}`).join("\n");
}
