// Busca de cidade por texto digitado.
//
// O <datalist> do navegador parece uma solução pronta, mas cada navegador
// filtra do seu jeito (e o Chrome no celular quase não filtra), então quem
// digitava "S" continuava vendo "Águas da Prata" no topo da lista. Aqui a
// regra é nossa: sem acento, sem diferença de maiúscula, e quem COMEÇA com o
// que foi digitado vem antes de quem só contém no meio do nome.

export function chaveBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Casa no COMEÇO de qualquer palavra do nome, nunca no meio: digitar "s" traz
// "Salto" e "São Paulo", mas não "Águas da Prata" (que só tem o s preso dentro
// de "Águas"). Já digitar "barbara" continua achando "Santa Bárbara", que é o
// jeito que o vendedor procura quando lembra só do segundo nome da cidade.
function posicaoNoInicioDeUmaPalavra(chave: string, alvo: string): number {
  if (chave.startsWith(alvo)) return 0;
  for (let i = 1; i < chave.length; i++) {
    const anterior = chave[i - 1];
    if ((anterior === " " || anterior === "-" || anterior === "'") && chave.startsWith(alvo, i)) return i;
  }
  return -1;
}

export function filtrarCidades(lista: string[], texto: string, limite = 60): string[] {
  const alvo = chaveBusca(texto);
  if (!alvo) return lista.slice(0, limite);

  const comeca: string[] = [];
  const noMeio: string[] = [];
  for (const nome of lista) {
    const onde = posicaoNoInicioDeUmaPalavra(chaveBusca(nome), alvo);
    if (onde === 0) comeca.push(nome);
    else if (onde > 0) noMeio.push(nome);
    if (comeca.length >= limite) break;
  }
  return [...comeca, ...noMeio].slice(0, limite);
}
