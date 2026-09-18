// Busca de cliente por nome digitado (campo "Cliente" da visita, do
// compromisso do calendário e da negociação nova).
//
// O <select> nativo com centenas de nomes não tem busca, e a ordem do banco
// põe os nomes em MAIÚSCULA antes dos outros ("ATOM S.A" vem antes de "Abel"),
// então o vendedor não acha quem procura. Aqui a regra é nossa: sem acento,
// sem diferença de maiúscula, quem COMEÇA com o que foi digitado vem primeiro,
// depois quem tem a palavra no começo de qualquer nome e, por fim, quem só
// contém o trecho no meio. A lista sem busca vem em ordem alfabética de gente.

import { chaveBusca } from "./filtrar-cidades";

export type ClienteOpcao = { id: string; nome: string; cidade?: string | null };

function comparar(a: ClienteOpcao, b: ClienteOpcao): number {
  return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
}

export function filtrarClientes(lista: ClienteOpcao[], texto: string, limite = 80): ClienteOpcao[] {
  const alvo = chaveBusca(texto);
  const ordenada = [...lista].sort(comparar);
  if (!alvo) return ordenada.slice(0, limite);

  const comeca: ClienteOpcao[] = [];
  const palavra: ClienteOpcao[] = [];
  const noMeio: ClienteOpcao[] = [];
  for (const c of ordenada) {
    const chave = chaveBusca(c.nome);
    if (chave.startsWith(alvo)) comeca.push(c);
    else if (chave.includes(` ${alvo}`) || chave.includes(`-${alvo}`) || chave.includes(`(${alvo}`)) palavra.push(c);
    else if (chave.includes(alvo)) noMeio.push(c);
  }
  return [...comeca, ...palavra, ...noMeio].slice(0, limite);
}

// Já existe alguém com esse nome (ignorando acento e maiúscula)?
export function clienteComMesmoNome(lista: ClienteOpcao[], nome: string): ClienteOpcao | null {
  const alvo = chaveBusca(nome);
  if (!alvo) return null;
  return lista.find((c) => chaveBusca(c.nome) === alvo) ?? null;
}
