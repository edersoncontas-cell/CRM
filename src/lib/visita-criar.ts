import { db } from "@/lib/db";
import { sincronizarVisitaComAgenda } from "@/lib/integrations/google";
import { dataDaVisita } from "@/lib/sem-sinal-regra";

// A criação de visita num lugar só. Dois caminhos usam: a ficha do cliente
// (adicionarVisita, em lib/actions.ts) e a volta do modo sem sinal
// (lib/sem-sinal-servidor.ts). Se cada um tivesse a sua cópia, a primeira
// regra nova (cidade, agenda do Google, "visitado") entraria só em um deles.
//
// `id` vem preenchido só pelo modo sem sinal: a visita nasce com o id gerado
// no aparelho, e é isso que impede a mesma visita de entrar duas vezes quando
// a resposta do servidor se perde no caminho.
export async function criarVisitaNoBanco(d: {
  id?: string;
  clienteId: string;
  /** YYYY-MM-DD (dia em Brasília). */
  dia: string;
  /** HH:mm; sem horário vale meio-dia em Brasília. */
  horario: string | null;
  cidade: string | null;
  observacao: string | null;
}) {
  // Cidade da visita: a informada; senão, o município do cadastro.
  let cidade = d.cidade?.trim() || null;
  if (!cidade) {
    const cli = await db.cliente.findUnique({ where: { id: d.clienteId }, select: { municipio: { select: { nome: true } } } });
    cidade = cli?.municipio?.nome ?? null;
  }
  const visita = await db.visita.create({
    data: {
      ...(d.id ? { id: d.id } : {}),
      clienteId: d.clienteId,
      data: dataDaVisita(d.dia, d.horario),
      cidade,
      observacao: d.observacao?.trim() || null,
    },
  });
  await sincronizarVisitaComAgenda(visita.id).catch((e) => console.error("[google] visita:", e));
  await db.cliente.update({ where: { id: d.clienteId }, data: { visitado: true } });
  return visita;
}
