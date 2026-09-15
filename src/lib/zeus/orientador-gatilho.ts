// Quando vale a pena gastar IA reanalisando a conversa. Cada análise completa
// do Orientador custa ~10 mil tokens (histórico + JSON grande); com a cota
// diária grátis do Groq (200 mil por modelo), "Sim", "ok", figurinha e
// "kkkk" não podem disparar uma análise inteira. Módulo PURO, testável.

const SO_EMOJI_OU_PONTUACAO = /^[\s\p{Extended_Pictographic}\p{Emoji_Presentation}\p{P}\p{S}]*$/u;
const CURTAS_SEM_CONTEUDO = new Set([
  "sim", "nao", "não", "ok", "okay", "blz", "beleza", "ta", "tá", "tabom", "ta bom", "tá bom", "certo", "isso", "aham", "uhum",
  "bom dia", "boa tarde", "boa noite", "obrigado", "obrigada", "obg", "vlw", "valeu", "top", "show", "otimo", "ótimo",
  "combinado", "fechado", "perfeito", "kk", "kkk", "kkkk", "kkkkk", "rs", "rsrs", "haha", "hahaha", "oi", "ola", "olá",
  "opa", "eae", "e ai", "e aí", "bom", "boa", "tranquilo", "de boa", "ate", "até", "ate mais", "até mais", "tchau",
]);

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// Figurinha, áudio sem transcrição, só emoji, ou frase curta de cortesia.
export function mensagemTrivial(texto: string | null | undefined, mediaType?: string | null): boolean {
  const t = (texto ?? "").trim();
  if (mediaType && mediaType !== "audio" && !t) return true;      // figurinha/imagem sem legenda
  if (!t) return true;
  if (/^\[(sticker|figurinha|imagem|image|video|vídeo|documento|document)\]$/i.test(t)) return true;
  if (SO_EMOJI_OU_PONTUACAO.test(t)) return true;
  const n = normalizar(t);
  if (!n) return true;
  if (CURTAS_SEM_CONTEUDO.has(n)) return true;
  // Duas palavras ou menos e nenhum número/sinal de conteúdo (preço, modelo, dia).
  return n.split(" ").length <= 2 && !/\d/.test(n) && n.length < 12;
}

export type DecisaoReanalise = { reanalisar: boolean; motivo: "sem_analise" | "conteudo_novo" | "so_trivial" | "muito_recente" };

// Decide se dispara a análise completa do Orientador para as mensagens novas
// (do cliente) desde a última análise.
//   - nunca analisou → analisa;
//   - só chegou coisa trivial → não (a leitura anterior continua valendo);
//   - chegou conteúdo real → analisa, salvo se a última análise foi há menos
//     de `cooldownMin` E o conteúdo novo é curto (evita rajada de mensagens
//     de uma linha virar 5 análises em 2 minutos; o debounce de 1s do webhook
//     não segura isso).
export function deveReanalisar(args: {
  ultimaAnaliseEm: Date | null;
  novas: { texto: string | null; mediaType?: string | null }[];
  agora?: Date;
  cooldownMin?: number;
}): DecisaoReanalise {
  const agora = args.agora ?? new Date();
  const cooldownMin = args.cooldownMin ?? 3;
  if (!args.ultimaAnaliseEm) return { reanalisar: true, motivo: "sem_analise" };
  const comConteudo = args.novas.filter((m) => !mensagemTrivial(m.texto, m.mediaType));
  if (!comConteudo.length) return { reanalisar: false, motivo: "so_trivial" };
  const minutos = (agora.getTime() - args.ultimaAnaliseEm.getTime()) / 60_000;
  const totalChars = comConteudo.reduce((s, m) => s + (m.texto ?? "").length, 0);
  if (minutos < cooldownMin && totalChars < 80) return { reanalisar: false, motivo: "muito_recente" };
  return { reanalisar: true, motivo: "conteudo_novo" };
}
