// O ENVIO AUTOMÁTICO — o único caminho por onde o CRM manda mensagem a cliente.
//
// "remova a questão de enviar mensagem pelo CRM, quero que o whatsapp apenas
//  espelhe o que está sendo enviado e recebido, mantendo [...] no marketing
//  quando enviar mensagens aos clientes, o sistema envia normalmente, e
//  também manter um padrão de envio, por exemplo enviar para 5 clientes a
//  cada hora."
//
// Conversa com cliente é pelo celular; o CRM só espelha. O que sobra de envio
// é automático: a campanha do Marketing (fila → despachante) e o parabéns de
// aniversário. Os dois passam por aqui.
//
// Este arquivo NÃO é "use server" de propósito. Antes, enviarResposta e
// enviarMensagemClientesAction eram server actions — qualquer página aberta
// no navegador podia chamá-las direto e mandar mensagem por fora da fila e do
// ritmo. Agora só o servidor (cron/despachante) chega aqui.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import * as zapi from "@/lib/zapi";
import { acharOuCriarConversa, inserirMensagem } from "@/lib/whatsapp-store";
import { registrarAudit } from "@/lib/audit";
import { lerMidiaEnvio, type MidiaGuardada } from "@/lib/midia-envio";
import { legendaDaMidia } from "@/lib/mensagem-clientes-regra";
import { porQueNaoEnviar, explicarBloqueio, pausaHumanaMs, proximaNoRitmo, explicarRitmo } from "@/lib/envio-limites";
import { textoParaCliente } from "@/lib/envio-variacoes";
import { ROTULO_ENVIO_MASSA, ROTULO_ANIVERSARIO } from "@/lib/piloto-regra";
import { lerLimitesEnvio, enviadasHoje, enviosDaUltimaHora, separarElegiveis } from "@/lib/envio-guarda";
import { envioPausado } from "@/lib/whatsapp-pausa";

export type TipoEnvioAutomatico = "massa" | "aniversario";

const PAUSADO = "Envio de WhatsApp está PAUSADO no CRM — nenhuma mensagem sai.";

/**
 * Manda UM texto para UM cliente e grava na conversa com o rótulo do envio
 * automático (nunca "Você": os Números do piloto contariam campanha como
 * resposta do vendedor).
 *
 * A trava geral mora AQUI, no ponto mais baixo: o parabéns automático não
 * olhava a pausa, e trava que só existe em um caminho não é trava.
 */
export async function enviarTextoAutomatico(
  clienteId: string,
  texto: string,
  tipo: TipoEnvioAutomatico,
): Promise<{ ok: boolean; erro?: string; pausado?: boolean }> {
  const conteudo = texto.trim();
  if (!conteudo) return { ok: false, erro: "Mensagem vazia." };
  if (await envioPausado()) return { ok: false, erro: PAUSADO, pausado: true };
  const rotulo = tipo === "massa" ? ROTULO_ENVIO_MASSA : ROTULO_ANIVERSARIO;

  const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente?.telefone) return { ok: false, erro: "Cliente sem telefone cadastrado." };
  if (!zapi.isEnabled()) return { ok: false, erro: "WhatsApp não está conectado. Configure em /conexao." };

  const { conv } = await acharOuCriarConversa({
    phone: cliente.telefone, lid: null, isGroup: false, contactName: cliente.nome,
  });

  try {
    const zapiMessageId = await zapi.sendText(conv.externalPhone, conteudo);
    await inserirMensagem(conv.id, {
      direction: "OUT", body: conteudo, origin: "CRM", operatorDisplayName: rotulo,
      zapiMessageId, sendStatus: "SENT",
    });
  } catch (e) {
    const unconfirmed = e instanceof zapi.EnvioNaoConfirmadoError;
    await inserirMensagem(conv.id, {
      direction: "OUT", body: conteudo, origin: "CRM", operatorDisplayName: rotulo,
      sendStatus: unconfirmed ? "UNCONFIRMED" : "FAILED",
    });
    if (!unconfirmed) {
      return { ok: false, erro: `O WhatsApp recusou o envio: ${String(e).slice(0, 200)} — verifique a conexão em /conexao.` };
    }
  }

  await db.cliente.update({
    where: { id: clienteId },
    data: { aguardandoResposta: false, ultimoContato: new Date() },
  });
  await registrarAudit({
    acao: "mensagem_enviada",
    origem: "sistema",
    descricao: `${tipo === "massa" ? "Campanha" : "Parabéns"} enviado via WhatsApp para ${cliente.nome}`,
    entidade: "Cliente",
    entidadeId: clienteId,
    clienteId,
    extra: { chars: conteudo.length },
  }).catch(() => {});

  revalidatePath("/atendimento");
  revalidatePath("/dashboard");
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}

async function enviarComMidia(cliente: { id: string; nome: string; telefone: string | null }, midia: MidiaGuardada, legenda: string): Promise<{ ok: boolean; erro?: string }> {
  if (!cliente.telefone) return { ok: false, erro: "Cliente sem telefone cadastrado." };
  if (!zapi.isEnabled()) return { ok: false, erro: "WhatsApp não está conectado. Configure em /conexao." };
  const { conv } = await acharOuCriarConversa({ phone: cliente.telefone, lid: null, isGroup: false, contactName: cliente.nome });
  const corpo = legenda.trim() || legendaDaMidia(midia.tipo, midia.nome);
  try {
    const zapiMessageId =
      midia.tipo === "image" ? await zapi.sendImageBase64(conv.externalPhone, midia.base64, midia.mimeType, legenda) :
      midia.tipo === "video" ? await zapi.sendVideoBase64(conv.externalPhone, midia.base64, midia.mimeType, legenda, midia.nome) :
      await zapi.sendDocumentBase64(conv.externalPhone, midia.base64, midia.nome, midia.mimeType, legenda);
    await inserirMensagem(conv.id, {
      direction: "OUT", body: corpo, origin: "CRM", operatorDisplayName: ROTULO_ENVIO_MASSA,
      mediaType: midia.tipo, mediaName: midia.nome, zapiMessageId, sendStatus: "SENT",
    });
  } catch (e) {
    const naoConfirmado = e instanceof zapi.EnvioNaoConfirmadoError;
    await inserirMensagem(conv.id, {
      direction: "OUT", body: corpo, origin: "CRM", operatorDisplayName: ROTULO_ENVIO_MASSA,
      mediaType: midia.tipo, mediaName: midia.nome, sendStatus: naoConfirmado ? "UNCONFIRMED" : "FAILED",
    });
    if (!naoConfirmado) return { ok: false, erro: `O WhatsApp recusou o envio: ${String(e).slice(0, 160)}` };
  }
  await db.cliente.update({ where: { id: cliente.id }, data: { aguardandoResposta: false, ultimoContato: new Date() } });
  await registrarAudit({
    acao: "mensagem_enviada", origem: "sistema", entidade: "Cliente", entidadeId: cliente.id,
    descricao: `${midia.tipo === "image" ? "Imagem" : midia.tipo === "video" ? "Vídeo" : "Documento"} de campanha enviado via WhatsApp para ${cliente.nome}`,
  }).catch(() => {});
  return { ok: true };
}

export type ResultadoEnvio = {
  enviados: string[];
  falhas: { id: string; nome: string; erro: string }[];
  /** Quem a guarda tirou do caminho: saiu da lista, contato frio, sem telefone. */
  pulados?: { frios: number; pediramSaida: number; semTelefone: number };
  /** Por que nada (mais) saiu: pausa, fora da janela, teto do dia, ritmo por hora. */
  bloqueio?: string;
};

/**
 * O FUNIL de toda campanha: quem chama é o despachante da fila
 * (lib/envio-programado-despacho.ts). As travas moram aqui dentro, nesta ordem:
 *
 *   1. pausa geral;
 *   2. janela de horário, dia útil e teto do dia;
 *   3. ritmo por hora (5/h = uma a cada 12 min), conferido a CADA mensagem;
 *   4. peneira — quem pediu para sair e quem NUNCA falou com a gente ficam
 *      de fora (contato frio é o que vira denúncia);
 *   5. pausa de gente entre uma mensagem e outra.
 *
 * Trava batida devolve `bloqueio`, NUNCA `falhas`: o despachante não anda o
 * cursor com bloqueio, e quem "falhou" nunca mais receberia.
 */
export async function enviarMensagemClientes(clienteIds: string[], texto: string, midiaId: string | null): Promise<ResultadoEnvio> {
  const base = texto.trim();
  const r: ResultadoEnvio = { enviados: [], falhas: [] };
  const midia = midiaId ? await lerMidiaEnvio(midiaId) : null;
  if (midiaId && !midia) {
    return { enviados: [], falhas: clienteIds.map((id) => ({ id, nome: id, erro: "O anexo expirou — escolha o arquivo de novo." })) };
  }
  if (!base && !midia) return r;

  if (await envioPausado()) return { ...r, bloqueio: PAUSADO };

  const lim = await lerLimitesEnvio();
  let jaHoje = await enviadasHoje();
  const trava = porQueNaoEnviar(new Date(), jaHoje, lim);
  if (trava) return { ...r, bloqueio: explicarBloqueio(trava, lim) };

  const recentes = await enviosDaUltimaHora();
  if (!recentes) return { ...r, bloqueio: "Não deu para conferir o ritmo de envio (banco sem resposta) — tento de novo na próxima rodada." };
  const proxima = proximaNoRitmo(recentes, new Date(), lim);
  if (proxima) return { ...r, bloqueio: explicarRitmo(proxima, lim) };

  const pedidos = Array.from(new Set(clienteIds)).slice(0, 5);
  const elegiveis = await separarElegiveis(pedidos);
  r.pulados = {
    frios: elegiveis.frios.length,
    pediramSaida: elegiveis.pediramSaida.length,
    semTelefone: elegiveis.semTelefone.length,
  };
  const ids = elegiveis.liberados;
  if (!ids.length) return r;

  const clientes = await db.cliente.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true, telefone: true } });
  const porId = new Map(clientes.map((c) => [c.id, c]));
  for (let i = 0; i < ids.length; i++) {
    const agora = new Date();
    if (porQueNaoEnviar(agora, jaHoje, lim)) break;
    // O ritmo a cada mensagem: a segunda do lote espera a vez dela.
    const vez = proximaNoRitmo(recentes, agora, lim);
    if (vez) { r.bloqueio = explicarRitmo(vez, lim); break; }
    const c = porId.get(ids[i]);
    if (!c) { r.falhas.push({ id: ids[i], nome: ids[i], erro: "Cliente não encontrado." }); continue; }
    try {
      const pessoal = textoParaCliente(base, c);
      const res = midia ? await enviarComMidia(c, midia, pessoal) : await enviarTextoAutomatico(c.id, pessoal, "massa");
      if ("pausado" in res && res.pausado) { r.bloqueio = PAUSADO; break; }
      // Conta no ritmo mesmo quando falha: a tentativa bateu no WhatsApp.
      recentes.push(new Date());
      if (res.ok) { r.enviados.push(c.id); jaHoje += 1; }
      else r.falhas.push({ id: c.id, nome: c.nome, erro: res.erro ?? "Falha ao enviar." });
    } catch (e) {
      recentes.push(new Date());
      r.falhas.push({ id: c.id, nome: c.nome, erro: e instanceof Error ? e.message : String(e) });
    }
    if (i < ids.length - 1) await new Promise((ok) => setTimeout(ok, pausaHumanaMs(lim)));
  }
  return r;
}
