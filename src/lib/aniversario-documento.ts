// Aniversário lido de um documento que o cliente mandou no WhatsApp (CNH,
// RG, contrato…). Roda depois que a mensagem já está salva, fora do caminho
// do webhook; nunca lança. Regras puras em aniversario-regra.ts.

import { db } from "@/lib/db";
import { baixarMidiaEvolution } from "@/lib/zapi";
import { extrairDadosDocumentoIA, visaoHabilitada } from "@/lib/ai";
import { registrarAudit } from "@/lib/audit";
import { interpretarDataNascimento, idadePlausivel, nomeCombina, dataCompleta } from "@/lib/aniversario-regra";

// ~8 MB de base64: acima disso é vídeo/foto enorme, não documento.
const MAX_BASE64 = 8 * 1024 * 1024;

export type ResultadoAniversarioDocumento =
  | { status: "ignorado"; motivo: string }
  | { status: "outra_pessoa"; nome: string }
  | { status: "registrado"; clienteId: string; data: string; tipo: string };

export async function registrarAniversarioDeMidia(args: {
  conversationId: string;
  messageId: string | null;
  mediaType: string | null;
  midia?: { base64: string; mimeType: string } | null; // já baixada (teste/importação)
}): Promise<ResultadoAniversarioDocumento> {
  if (args.mediaType !== "image" && args.mediaType !== "document") return { status: "ignorado", motivo: "não é imagem nem documento" };
  if (!visaoHabilitada()) return { status: "ignorado", motivo: "sem provedor de IA com visão" };

  const conv = await db.whatsAppConversation.findUnique({ where: { id: args.conversationId }, select: { clienteId: true } });
  if (!conv?.clienteId) return { status: "ignorado", motivo: "conversa sem cliente" };
  const cliente = await db.cliente.findUnique({ where: { id: conv.clienteId }, select: { id: true, nome: true, dataNascimento: true } });
  if (!cliente) return { status: "ignorado", motivo: "cliente não existe" };
  if (cliente.dataNascimento) return { status: "ignorado", motivo: "já tem aniversário" };

  const midia = args.midia ?? (args.messageId ? await baixarMidiaEvolution(args.messageId) : null);
  if (!midia) return { status: "ignorado", motivo: "mídia indisponível" };
  const mime = midia.mimeType.toLowerCase();
  if (!mime.startsWith("image/") && mime !== "application/pdf") return { status: "ignorado", motivo: `tipo ${mime}` };
  if (midia.base64.length > MAX_BASE64) return { status: "ignorado", motivo: "arquivo grande demais" };

  const dados = await extrairDadosDocumentoIA({ base64: midia.base64, mediaType: mime });
  if (!dados.ehDocumento) return { status: "ignorado", motivo: "não é documento" };
  const data = interpretarDataNascimento(dados.dataNascimento);
  if (!data) return { status: "ignorado", motivo: "sem data de nascimento legível" };
  if (!idadePlausivel(data, new Date())) return { status: "ignorado", motivo: "idade fora do plausível" };
  const tipo = dados.tipoDocumento ?? "documento";

  if (dados.nome && !nomeCombina(cliente.nome, dados.nome)) {
    await registrarAudit({
      acao: "conversa_analisada", origem: "ia", entidade: "Cliente", entidadeId: cliente.id,
      descricao: `${tipo} recebido de ${cliente.nome} está em nome de ${dados.nome} — aniversário não registrado (documento de outra pessoa).`,
    }).catch(() => {});
    return { status: "outra_pessoa", nome: dados.nome };
  }
  if (!dados.nome) return { status: "ignorado", motivo: "documento sem nome legível" };

  await db.cliente.update({ where: { id: cliente.id }, data: { dataNascimento: data, dataNascimentoOrigem: `documento:${tipo}` } });
  await registrarAudit({
    acao: "cliente_atualizado", origem: "ia", entidade: "Cliente", entidadeId: cliente.id,
    descricao: `Aniversário de ${cliente.nome} registrado pela IA: ${dataCompleta(data)} (lido de ${tipo} recebido no WhatsApp).`,
  }).catch(() => {});
  return { status: "registrado", clienteId: cliente.id, data: dataCompleta(data), tipo };
}
