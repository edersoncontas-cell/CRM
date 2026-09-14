import { db } from "@/lib/db";
import { papelDaColuna } from "@/lib/pipeline";
import { AtendimentoClient, type ConvLista } from "@/components/AtendimentoClient";
import * as zapi from "@/lib/zapi";

export const dynamic = "force-dynamic";

export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: { conversa?: string };
}) {
  const [conversas, maquinasProprias, colunasFunil, rascunhos, aguardando, status] = await Promise.all([
    db.whatsAppConversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      take: 400,
      include: { messages: { where: { isDraft: false }, orderBy: { sentAt: "desc" }, take: 1, select: { body: true, direction: true, sentAt: true, mediaType: true } } },
    }),
    db.maquina.findMany({ where: { proprio: true }, select: { marca: true, modelo: true }, orderBy: [{ marca: "asc" }, { modelo: "asc" }] }),
    db.colunaFunil.findMany({ orderBy: { ordem: "asc" }, select: { id: true, titulo: true, papel: true } }).then((cs) => cs.filter((c) => papelDaColuna(c) !== "perdida")),
    db.whatsAppMessage.findMany({ where: { isDraft: true, draftStatus: "PENDING" }, select: { conversationId: true }, distinct: ["conversationId"] }),
    db.cliente.findMany({ where: { aguardandoResposta: true }, select: { id: true } }),
    zapi.statusConexao().catch(() => null),
  ]);

  const comRascunho = new Set(rascunhos.map((r) => r.conversationId));
  const clientesAguardando = new Set(aguardando.map((c) => c.id));

  const lista: ConvLista[] = conversas.map((c) => {
    const ult = c.messages[0];
    return {
      id: c.id,
      externalPhone: c.externalPhone,
      contactName: c.contactName,
      isGroup: c.isGroup,
      groupName: c.groupName,
      ignored: c.ignored,
      aiActive: c.aiActive,
      category: c.category,
      contactPhotoUrl: c.contactPhotoUrl,
      clienteId: c.clienteId,
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
      maquinasProprias={maquinasProprias}
      colunasFunil={colunasFunil}
    />
  );
}
