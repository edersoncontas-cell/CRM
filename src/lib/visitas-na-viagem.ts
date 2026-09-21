// APROVEITE A VIAGEM: quem mais está naquela cidade.
//
// "Vamos alterar, para ficar só os clientes da cidade, e não o filtro de 60
//  dias, e retira essa informação de nunca visita desse card"
//
// A primeira versão filtrava por 60 dias sem visita e puxava cidade vizinha
// num raio de 40 km. Na base real isso não servia: como o histórico de visita
// quase não está preenchido, TODO cliente passava no corte e a lista inteira
// saía marcada "nunca visitado" — um rótulo igual em toda linha não informa
// nada. E cidade vizinha, na prática, é outra viagem.
//
// Agora a pergunta é direta: estou indo a esta cidade, quem eu tenho aqui?
//
// A cidade é comparada pelo NOME normalizado, não por distância. Distância
// zero seria um jeito indireto de dizer "mesma cidade" e falharia em dois
// municípios com coordenada parecida; o nome é exato e é o que ele leria.
//
// Módulo puro (sem banco), para a regra dar para provar.

const semAcento = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export type ClienteVisitavel = {
  id: string;
  nome: string;
  cidade: string | null;
};

export type VisitaMarcada = {
  clienteId: string;
  data: Date;
  cidade: string;
};

export type ClienteSugerido = {
  id: string;
  nome: string;
};

export type SugestaoViagem = {
  data: Date;
  cidade: string;
  clientes: ClienteSugerido[];
};

// Teto só para a lista não virar parede de nome numa cidade grande. O quadro
// já rola por dentro, então o teto é alto de propósito: cortar em 5 esconderia
// cliente de uma cidade onde ele tem 20, que é justamente onde a lista serve.
const POR_VIAGEM_PADRAO = 30;

/**
 * Para cada viagem já marcada, os clientes daquela cidade.
 *
 * Duas exclusões continuam valendo, e cada uma por um motivo:
 *
 *  - O cliente da própria visita sai da lista. Sugerir visitar quem você já
 *    vai visitar é a sugestão mais inútil possível.
 *  - Quem já tem outra visita marcada na janela também sai. Ele já está na
 *    agenda; repetir na sugestão faz o vendedor parar de ler o quadro.
 *
 * Cliente sem cidade cadastrada não entra em viagem nenhuma — não há como
 * saber se ele fica no caminho, e mandar o vendedor na estrada por um palpite
 * custa mais caro que uma sugestão a menos.
 */
export function sugerirVisitasNaViagem(
  visitas: VisitaMarcada[],
  candidatos: ClienteVisitavel[],
  opcoes: { porViagem?: number } = {}
): SugestaoViagem[] {
  const porViagem = opcoes.porViagem ?? POR_VIAGEM_PADRAO;
  const jaAgendados = new Set(visitas.map((v) => v.clienteId));

  const saida: SugestaoViagem[] = [];
  for (const v of visitas) {
    const alvo = semAcento(v.cidade);
    if (!alvo) continue;

    const daCidade = candidatos
      .filter((c) => !jaAgendados.has(c.id) && c.cidade && semAcento(c.cidade) === alvo)
      .map((c) => ({ id: c.id, nome: c.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    if (daCidade.length) {
      saida.push({ data: v.data, cidade: v.cidade, clientes: daCidade.slice(0, porViagem) });
    }
  }

  // Uma viagem por dia+cidade: duas visitas na mesma cidade no mesmo dia
  // sugeririam a mesma lista duas vezes.
  const vistas = new Set<string>();
  return saida
    .sort((a, b) => a.data.getTime() - b.data.getTime())
    .filter((s) => {
      const chave = `${s.data.toISOString().slice(0, 10)}|${semAcento(s.cidade)}`;
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    });
}
