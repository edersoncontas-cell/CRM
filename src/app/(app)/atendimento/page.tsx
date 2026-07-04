import { db } from "@/lib/db";
import { AtendimentoClient, type ConvLista } from "@/components/AtendimentoClient";
import * as zapi from "@/lib/zapi";

export const dynamic = "force-dynamic";

export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: { conversa?: string };
}) {
  const [conversas, maquinasProprias] = await Promise.all([
    db.whatsAppConversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      take: 300,
      include: { messages: { orderBy: { sentAt: "desc" }, take: 1, select: { body: true, direction: true, sentAt: true, mediaType: true } } },
    }),
    db.maquina.findMany({ where: { proprio: true }, select: { marca: true, modelo: true }, orderBy: [{ marca: "asc" }, { modelo: "asc" }] }),
  ]);

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
      previa: ult ? `${ult.direction === "OUT" ? "Você: " : ""}${ult.body}` : "",
    };
  });

  return <AtendimentoClient conversas={lista} zapiAtiva={zapi.isEnabled()} convInicial={searchParams.conversa ?? null} maquinasProprias={maquinasProprias} />;
}
