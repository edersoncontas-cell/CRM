// QUEM FICA QUANDO DOIS CADASTROS VIRAM UM — regra pura, sem banco.
//
//   "tem 3 leonardos zambom são o mesmo contato (…) os contatos selecionados
//    serão 1 só ficando todas as informações dos 3 em um só, e o que vai
//    ficar é sempre o contato do google, e todo o sistema será atualizado
//    para que neste único contato unificado seja a base das informações."
//
// A ordem importa e é a do vendedor: o cadastro do GOOGLE ganha sempre. É a
// agenda do celular dele — o nome certo, o número que ele disca de verdade —
// e é ela que manda o contato de volta na próxima sincronização. Escolher
// outro cadastro como vencedor faria o do Google renascer na hora seguinte, e
// a união teria sido em vão.

export type ContatoParaUnir = {
  id: string;
  nome: string;
  telefone: string | null;
  googleContatoId: string | null;
  googleSincronizadoEm: Date | null;
  criadoEm: Date;
};

/**
 * O cadastro que sobrevive à união.
 *
 * 1. Do Google (o mais recentemente sincronizado, quando há mais de um).
 * 2. Sem nenhum do Google: o que tem telefone.
 * 3. Empatou: o mais antigo — é o que tem mais história ligada a ele.
 */
export function escolherQueFica<T extends ContatoParaUnir>(contatos: T[]): T | null {
  if (!contatos.length) return null;

  const doGoogle = contatos.filter((c) => !!c.googleContatoId);
  if (doGoogle.length) {
    return [...doGoogle].sort((a, b) => {
      const sa = a.googleSincronizadoEm?.getTime() ?? 0;
      const sb = b.googleSincronizadoEm?.getTime() ?? 0;
      if (sa !== sb) return sb - sa;
      return a.criadoEm.getTime() - b.criadoEm.getTime();
    })[0];
  }

  const comTelefone = contatos.filter((c) => !!c.telefone?.trim());
  const base = comTelefone.length ? comTelefone : contatos;
  return [...base].sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())[0];
}

/** Por que aquele cadastro ficou — a frase que a tela mostra. */
export function motivoDeQuemFica(escolhido: ContatoParaUnir, todos: ContatoParaUnir[]): string {
  if (escolhido.googleContatoId) return "é o contato do Google — é ele que a agenda do celular manda de volta";
  if (todos.some((c) => c.googleContatoId)) return "é o mais recente do Google";
  if (escolhido.telefone?.trim()) return "é o único com telefone";
  return "é o cadastro mais antigo";
}

/**
 * Parecença entre dois nomes, para sugerir quem unir.
 *
 * Não tenta ser esperta: compara as palavras do nome, sem acento e sem
 * caixa. "Leonardo Zambon", "leonardo vargas zambon" e "Leonardo Zambom"
 * têm duas palavras em comum — o bastante para SUGERIR. Quem decide é o
 * vendedor, marcando a caixinha; o CRM nunca une sozinho.
 */
const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");

export function palavrasDoNome(nome: string): string[] {
  return semAcento(nome).split(/\s+/).filter((p) => p.length >= 3);
}

export function pareceMesmaPessoa(a: string, b: string): boolean {
  const pa = new Set(palavrasDoNome(a));
  const pb = palavrasDoNome(b);
  if (!pa.size || !pb.length) return false;
  const comuns = pb.filter((p) => pa.has(p)).length;
  // Duas palavras iguais (nome + sobrenome) já é sugestão. Uma só bastaria
  // para "Leonardo" casar com todo Leonardo do CRM — sugestão demais é o
  // mesmo que sugestão nenhuma.
  if (comuns >= 2) return true;
  // Nome de uma palavra só dos dois lados: aí a palavra única serve.
  return comuns === 1 && pa.size === 1 && pb.length === 1;
}
