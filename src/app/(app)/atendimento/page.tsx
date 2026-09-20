import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AtendimentoClient, type ConvLista } from "@/components/AtendimentoClient";
import * as zapi from "@/lib/zapi";
import { lerParametros } from "@/lib/parametros";
import { acharOuCriarConversa } from "@/lib/whatsapp-store";
import { cadastroPodeDarONome, cadastroAoLado } from "@/lib/conversa-identidade";

export const dynamic = "force-dynamic";

// ?cliente=<id> (botão WhatsApp da Central, ficha do cliente…): abre a
// conversa desse cliente — e cria uma vazia se ele ainda não tem, para dar
// para escrever daqui mesmo.
async function conversaDoCliente(clienteId: string): Promise<string | null> {
  const existente = await db.whatsAppConversation.findFirst({ where: { clienteId, isGroup: false }, orderBy: { lastMessageAt: "desc" }, select: { id: true } });
  if (existente) return existente.id;
  const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true, telefone: true } });
  if (!cliente?.telefone || cliente.telefone.replace(/\D/g, "").length < 10) return null;
  const { conv } = await acharOuCriarConversa({ phone: cliente.telefone, lid: null, isGroup: false, contactName: cliente.nome });
  if (!conv.clienteId) await db.whatsAppConversation.update({ where: { id: conv.id }, data: { clienteId } }).catch(() => {});
  return conv.id;
}

export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: { conversa?: string; cliente?: string };
}) {
  if (!searchParams.conversa && searchParams.cliente) {
    // O erro NÃO pode ser engolido: quando a criação da conversa falha, o
    // vendedor cai na lista inteira sem entender por quê, e não fica rastro
    // nenhum para descobrir depois. Cair na lista continua sendo o plano B —
    // mas agora o motivo vai para o log.
    const id = await conversaDoCliente(searchParams.cliente).catch((e) => {
      console.error("[atendimento] não deu para abrir/criar a conversa do cliente:", searchParams.cliente, e);
      return null;
    });
    redirect(id ? `/atendimento?conversa=${id}` : "/atendimento");
  }

  const [conversas, rascunhos, aguardando, status, parametros] = await Promise.all([
    db.whatsAppConversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      take: 400,
      include: { messages: { where: { isDraft: false }, orderBy: { sentAt: "desc" }, take: 1, select: { body: true, direction: true, sentAt: true, mediaType: true } } },
    }),
    db.whatsAppMessage.findMany({ where: { isDraft: true, draftStatus: "PENDING" }, select: { conversationId: true }, distinct: ["conversationId"] }),
    db.cliente.findMany({ where: { aguardandoResposta: true }, select: { id: true } }),
    zapi.statusConexao().catch(() => null),
    lerParametros(),
  ]);

  const comRascunho = new Set(rascunhos.map((r) => r.conversationId));
  const clientesAguardando = new Set(aguardando.map((c) => c.id));

  // Nome do cadastro ligado a cada conversa. A conversa guarda só o id (não há
  // relação no schema), então é uma busca à parte — uma só, com todos os ids de
  // uma vez. Serve para mostrar o cadastro AO LADO do nome do contato; quem
  // manda no nome é o contato (ver lib/conversa-identidade.ts).
  const idsClientes = [...new Set(conversas.map((c) => c.clienteId).filter((id): id is string => !!id))];
  const cadastroPorId = new Map<string, { nome: string }>();
  if (idsClientes.length) {
    const cs = await db.cliente.findMany({ where: { id: { in: idsClientes } }, select: { id: true, nome: true } });
    for (const c of cs) cadastroPorId.set(c.id, { nome: c.nome });
  }

  const lista: ConvLista[] = conversas.map((c) => {
    const ult = c.messages[0];
    const cadastro = c.clienteId ? cadastroPorId.get(c.clienteId) ?? null : null;
    const vinculo = {
      isGroup: c.isGroup,
      groupName: c.groupName,
      contactName: c.contactName,
      externalPhone: c.externalPhone,
      clienteNome: cadastro?.nome ?? null,
    };
    return {
      id: c.id,
      externalPhone: c.externalPhone,
      contactName: c.contactName,
      isGroup: c.isGroup,
      groupName: c.groupName,
      encerrada: c.encerrada,
      aiActive: c.aiActive,
      category: c.category,
      contactPhotoUrl: c.contactPhotoUrl,
      clienteId: c.clienteId,
      // nomeCliente: o nome do cadastro SÓ quando a conversa não tem nome
      // próprio — aí ele preenche um vazio, em vez de mostrar um número cru.
      // Tendo nome, quem manda é o contato: o nome da sua agenda já chega no
      // contactName pela sincronização (lib/whatsapp-nomes.ts).
      //
      // cadastroLigado: o cadastro quando ele NÃO é o nome exibido (a
      // negociação no nome da empresa). Aparece ao lado, nunca no lugar.
      nomeCliente: cadastroPodeDarONome(vinculo) ? vinculo.clienteNome : null,
      cadastroLigado: cadastroAoLado(vinculo),
      lastMessageAt: c.lastMessageAt.toISOString(),
      naoLida: !!(c.lastAccessedAt ? c.lastMessageAt > c.lastAccessedAt : true),
      previa: ult ? `${ult.direction === "OUT" ? "Você: " : ""}${ult.mediaType && !ult.body ? `[${ult.mediaType}]` : ult.body}` : "",
      temRascunho: comRascunho.has(c.id),
      aguardando: !!c.clienteId && clientesAguardando.has(c.clienteId),
    };
  });

  return (
    <AtendimentoClient
      conversas={lista}
      conexao={{ configurado: !!status?.configurado, conectado: !!status?.conectado, provedor: status?.provedor ?? null }}
      convInicial={searchParams.conversa ?? null}
      vendedorNome={parametros.nomeVendedor}
    />
  );
}
