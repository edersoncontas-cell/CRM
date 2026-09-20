// Conferência do resumo contra a conversa de verdade.
//
// "Esse resumo tá péssimo, o cliente não enviou os documentos."
//
// Pedir ao modelo que não invente ajuda, mas não garante: prompt é pedido, não
// trava. Aqui fica a trava. O CRM SABE o que foi anexado na conversa e de que
// lado veio (ver historico-linha.ts). Então uma frase do resumo que afirme
// "o cliente enviou os documentos" pode ser conferida contra o fato — e
// derrubada quando não se sustenta.
//
// Escopo, de propósito estreito: só afirmações sobre ANEXO (documento, foto,
// áudio, vídeo), que é a classe de invenção que apareceu na tela e a única que
// o CRM tem como provar sozinho, com certeza, sem interpretar linguagem. O
// resto continua por conta do prompt.
//
// O que se perde quando a trava corta demais é uma frase de resumo. O que se
// ganha é o painel nunca mais afirmar ao vendedor que recebeu um documento que
// não existe — e ele parar de procurar. A troca vale.
//
// Módulo puro, com teste.

import type { MidiaDaConversa, TipoMidia } from "@/lib/zeus/historico-linha";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** As palavras com que cada anexo aparece escrito num resumo. */
const PALAVRAS: Record<TipoMidia, RegExp> = {
  documento: /\b(documento|documentos|arquivo|arquivos|pdf|nota fiscal|contrato|cnh|comprovante|comprovantes|ficha tecnica|proposta em pdf)\b/,
  foto: /\b(foto|fotos|imagem|imagens|print|prints)\b/,
  audio: /\b(audio|audios|mensagem de voz)\b/,
  video: /\b(video|videos)\b/,
};

/** Verbos de envio: "enviou", "mandou", "encaminhou", "passou"… */
const ENVIO = /\b(enviou|enviaram|enviado|enviados|enviada|enviadas|mandou|mandaram|mandado|mandados|encaminhou|encaminhado|anexou|anexado|compartilhou|passou|repassou|subiu)\b/;

/** Quem a frase aponta como autor do envio. */
const SUJEITO_CLIENTE = /\b(cliente|ele|ela|comprador|contato)\b/;
const SUJEITO_VENDEDOR = /\b(voce|vendedor|eu|nos|a gente|revenda)\b/;

/** Quebra o resumo em frases, preservando o texto original de cada uma. */
export function emFrases(texto: string): string[] {
  // Quebra no fim de frase (. ! ? ;) E na quebra de linha — o resumo às vezes
  // vem em tópicos de uma linha cada, sem pontuação no fim. Sem o segundo
  // caso, um resumo inteiro viraria uma "frase" só e a conferência seria tudo
  // ou nada.
  return (texto ?? "")
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * A frase afirma que ALGUÉM enviou um anexo que a conversa não tem?
 *
 * Só responde `true` quando os três estão presentes: verbo de envio, palavra
 * de anexo, e nenhum anexo daquele tipo do lado apontado. Na dúvida sobre o
 * autor (frase sem sujeito claro), cobra dos DOIS lados: se nenhum dos dois
 * enviou nada daquele tipo, a frase não se sustenta de jeito nenhum.
 */
export function fraseSemApoio(frase: string, midia: MidiaDaConversa): boolean {
  const f = semAcento(frase);
  if (!ENVIO.test(f)) return false;

  const tipos = (Object.keys(PALAVRAS) as TipoMidia[]).filter((t) => PALAVRAS[t].test(f));
  if (!tipos.length) return false;

  const doCliente = SUJEITO_CLIENTE.test(f);
  const doVendedor = SUJEITO_VENDEDOR.test(f);

  return tipos.some((t) => {
    if (doCliente && !doVendedor) return !midia.cliente.has(t);
    if (doVendedor && !doCliente) return !midia.vendedor.has(t);
    // Sem sujeito claro (ou os dois citados): só cai se ninguém enviou.
    return !midia.cliente.has(t) && !midia.vendedor.has(t);
  });
}

/**
 * Devolve o resumo sem as frases que a conversa não sustenta.
 *
 * Se TUDO cair, devolve "" — melhor um card sem resumo do que um card com uma
 * história inventada. Quem lê o painel toma decisão em cima disso.
 */
export function resumoConferido(resumo: string | null | undefined, midia: MidiaDaConversa): string {
  const t = (resumo ?? "").trim();
  if (!t) return "";
  const ficam = emFrases(t).filter((f) => !fraseSemApoio(f, midia));
  return ficam.join(" ").replace(/\s+/g, " ").trim();
}

/** As frases derrubadas — para registrar no log e poder medir o problema. */
export function frasesDerrubadas(resumo: string | null | undefined, midia: MidiaDaConversa): string[] {
  return emFrases((resumo ?? "").trim()).filter((f) => fraseSemApoio(f, midia));
}
