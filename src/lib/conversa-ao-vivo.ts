// MENSAGEM QUE CHEGA FORA DE ORDEM NA CONVERSA ABERTA.
//
// A conversa aberta no Atendimento recebe as mensagens novas pela rota
// /api/conversations/[id]/stream, que olha o banco a cada 3 s. Ela olhava só
// o que tinha horário DEPOIS da última mensagem entregue — e o horário de uma
// mensagem recebida é o do WhatsApp (em segundos), não o da chegada ao banco.
// Mensagem que entra no banco depois de uma mais nova ficava para trás para
// sempre, até ele trocar de conversa: o áudio que demora a ser transcrito, a
// foto do álbum que chega por último, o webhook que a Evolution repete, o
// rascunho do Orientador com o relógio do servidor na frente do WhatsApp.
//
// Agora a rota olha uma JANELA para trás e entrega o que ainda não entregou,
// pelo id. Quem já está na tela ao conectar não volta.

export const JANELA_ATRASO_MS = 15 * 60_000;

export type MarcaMensagem = { id: string; sentAt: Date };

export function inicioDaJanela(cursor: Date): Date {
  return new Date(cursor.getTime() - JANELA_ATRASO_MS);
}

/** O que a tela já tem ao conectar: tudo até o cursor (a última que ela mostra). */
export function jaNaTela(marcas: MarcaMensagem[], cursor: Date): Map<string, number> {
  const vistas = new Map<string, number>();
  for (const m of marcas) if (m.sentAt.getTime() <= cursor.getTime()) vistas.set(m.id, m.sentAt.getTime());
  return vistas;
}

/** Das mensagens da janela, as que ainda não foram entregues, em ordem de horário. */
export function aEntregar(marcas: MarcaMensagem[], vistas: Map<string, number>): MarcaMensagem[] {
  return marcas
    .filter((m) => !vistas.has(m.id))
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
}

/** Esquece o que saiu da janela — numa conexão longa a lista não cresce sem fim. */
export function esquecerForaDaJanela(vistas: Map<string, number>, cursor: Date): void {
  const limite = inicioDaJanela(cursor).getTime();
  for (const [id, t] of vistas) if (t <= limite) vistas.delete(id);
}
