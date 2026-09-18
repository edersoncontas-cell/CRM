"use server";

// Mensagem para clientes (tela de Visitas): lista o público (todos, uma
// cidade ou os aniversariantes), gera o texto por tipo e manda pelo WhatsApp
// — com ou sem anexo. O envio reaproveita a conversa do Atendimento: a
// resposta do cliente continua a thread.

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import * as zapi from "@/lib/zapi";
import { llmTexto, iaHabilitada } from "@/lib/ai";
import { enviarResposta } from "@/lib/actions";
import { acharOuCriarConversa, inserirMensagem } from "@/lib/whatsapp-store";
import { registrarAudit } from "@/lib/audit";
import { lerParametros } from "@/lib/parametros";
import { semCodigoPais, diasDesde } from "@/lib/utils";
import { personalizarTexto, periodoSemanaQueVem } from "@/lib/abordagem-cidade-regra";
import { diaMes, diasAteAniversario, aniversarioNaJanela } from "@/lib/aniversario-regra";
import { lerMidiaEnvio, type MidiaGuardada } from "@/lib/midia-envio";
import { lerConfigAniversario, definirConfigAniversario, textoPadraoAniversario, type ConfigAniversario } from "@/lib/aniversario-automatico";
import {
  DATAS_COMEMORATIVAS, modeloPadrao, legendaDaMidia, type Publico, type TipoMensagem,
} from "@/lib/mensagem-clientes-regra";

export type ClienteAlvo = {
  id: string;
  nome: string;
  telefone: string | null;
  cidade: string | null;
  visitado: boolean;
  diasSemContato: number | null;
  ultimaVisita: string | null; // dd/mm/aaaa
  aniversario: { diaMes: string; diasAte: number } | null;
};

const SELECAO = {
  id: true, nome: true, telefone: true, visitado: true, ultimoContato: true, dataNascimento: true,
  municipio: { select: { nome: true } },
  visitas: { where: { status: "realizada" }, orderBy: { data: "desc" as const }, take: 1, select: { data: true } },
};

type Linha = {
  id: string; nome: string; telefone: string | null; visitado: boolean; ultimoContato: Date | null; dataNascimento: Date | null;
  municipio: { nome: string } | null; visitas: { data: Date }[];
};

function paraAlvo(c: Linha, hoje: Date): ClienteAlvo {
  return {
    id: c.id,
    nome: c.nome,
    telefone: c.telefone ? semCodigoPais(c.telefone) : null,
    cidade: c.municipio?.nome ?? null,
    visitado: c.visitado,
    diasSemContato: c.ultimoContato ? diasDesde(c.ultimoContato) : null,
    ultimaVisita: c.visitas[0] ? c.visitas[0].data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null,
    aniversario: c.dataNascimento ? { diaMes: diaMes(c.dataNascimento), diasAte: diasAteAniversario(c.dataNascimento, hoje) } : null,
  };
}

// Quem pode receber campanha: cadastro de verdade (não prospect da IA — e
// `not` no Prisma excluiria os NULL) e que não é "não é cliente".
function ondeCampanha(extra: Prisma.ClienteWhereInput[] = []): Prisma.ClienteWhereInput {
  return { AND: [{ OR: [{ origem: null }, { origem: { not: "prospect_ia" } }] }, { status: { not: "nao_cliente" } }, ...extra] };
}

export async function listarPublicoAction(publico: Publico): Promise<{ titulo: string; clientes: ClienteAlvo[] }> {
  const hoje = new Date();
  if (publico.modo === "cidade") {
    if (!publico.municipioId) return { titulo: "", clientes: [] };
    const municipio = await db.municipio.findUnique({ where: { id: publico.municipioId }, select: { nome: true } });
    if (!municipio) return { titulo: "", clientes: [] };
    const rows = await db.cliente.findMany({ where: ondeCampanha([{ municipioId: publico.municipioId }]), select: SELECAO, orderBy: { nome: "asc" } });
    return { titulo: municipio.nome, clientes: rows.map((c) => paraAlvo(c, hoje)) };
  }
  if (publico.modo === "aniversariantes") {
    const rows = await db.cliente.findMany({ where: ondeCampanha([{ dataNascimento: { not: null } }]), select: SELECAO, orderBy: { nome: "asc" } });
    const dentro = rows.filter((c) => c.dataNascimento && aniversarioNaJanela(c.dataNascimento, hoje, publico.dias));
    const alvos = dentro.map((c) => paraAlvo(c, hoje)).sort((a, b) => (a.aniversario?.diasAte ?? 0) - (b.aniversario?.diasAte ?? 0));
    const titulo = publico.dias === 0 ? "aniversariantes de hoje" : `aniversariantes dos próximos ${publico.dias} dias`;
    return { titulo, clientes: alvos };
  }
  // Todos: quem está fora da área de atuação não recebe campanha.
  const rows = await db.cliente.findMany({
    where: ondeCampanha([{ OR: [{ municipioId: null }, { municipio: { foraDeArea: false } }] }]),
    select: SELECAO, orderBy: { nome: "asc" },
  });
  return { titulo: "todos os clientes", clientes: rows.map((c) => paraAlvo(c, hoje)) };
}

export async function lerAutomaticoAniversarioAction(): Promise<ConfigAniversario> {
  return lerConfigAniversario();
}

export async function definirAutomaticoAniversarioAction(c: ConfigAniversario): Promise<{ ok: boolean; erro?: string; config?: ConfigAniversario }> {
  const texto = c.texto.trim();
  if (c.ativo && !texto) return { ok: false, erro: "Escreva o texto do parabéns antes de ligar o automático." };
  if (c.ativo && !/\{nome\}/i.test(texto)) return { ok: false, erro: "O texto precisa ter {nome} — é onde entra o primeiro nome do cliente." };
  return { ok: true, config: await definirConfigAniversario({ ativo: c.ativo, texto: texto || (await textoPadraoAniversario()) }) };
}

export type PedidoTexto = { tipo: TipoMensagem; cidade?: string; dataId?: string; promocao?: string };

export async function gerarTextoMensagemAction(pedido: PedidoTexto): Promise<{ texto: string; geradoPorIA: boolean }> {
  const p = await lerParametros().catch(() => null);
  const vendedor = p?.nomeVendedor || "Edy";
  const marcas = p?.marcas || "New Holland Construction e Dynapac";
  const data = pedido.tipo === "comemorativa" ? DATAS_COMEMORATIVAS.find((d) => d.id === pedido.dataId) : undefined;
  const periodo = periodoSemanaQueVem();
  const padrao = modeloPadrao(pedido.tipo, { cidade: pedido.cidade, periodo, data, promocao: pedido.promocao, vendedor, marcas });
  if (!iaHabilitada()) return { texto: padrao, geradoPorIA: false };

  const objetivo =
    pedido.tipo === "visita" ? `Ele vai estar em ${pedido.cidade || "na cidade do cliente"} ${periodo} e quer marcar visitas. Diga isso, ofereça passar lá para conversar sobre máquinas/operação e termine perguntando qual dia fica melhor.` :
    pedido.tipo === "promocao" ? `É uma divulgação: ${pedido.promocao?.trim() || "condição especial nas máquinas"}. Conte a novidade de forma direta, sem parecer propaganda de loja, e convide a chamar para saber mais.` :
    pedido.tipo === "aniversario" ? "É parabéns de aniversário. Curto, caloroso, sem vender nada. Pode ter um emoji de bolo." :
    `É ${data?.nome ?? "uma data comemorativa"} (${data?.tema ?? ""}). Mensagem de carinho e reconhecimento, sem vender nada.`;

  try {
    const texto = await llmTexto(
      `Você escreve mensagens de WhatsApp para o ${vendedor}, vendedor de máquinas pesadas (${marcas}) no sul do Espírito Santo.
Escreva UMA mensagem curta (2 a 5 frases), tom simples e próximo, como quem já conhece o cliente.
Use exatamente "{nome}" onde entra o primeiro nome do cliente (uma vez, na saudação).
${objetivo}
No máximo um emoji, sem título, sem aspas, sem assinatura além do nome ${vendedor}. Devolva só a mensagem.`,
      [
        `Tipo: ${pedido.tipo}.`,
        pedido.tipo === "visita" && pedido.cidade ? `Cidade: ${pedido.cidade}.` : "",
        data ? `Data: ${data.nome}.` : "",
        pedido.tipo === "promocao" && pedido.promocao ? `Promoção: ${pedido.promocao}.` : "",
      ].filter(Boolean).join(" "),
      { maxTokens: 300 },
    );
    const limpo = texto.trim().replace(/^["“]|["”]$/g, "");
    if (!limpo || !/\{nome\}/i.test(limpo)) return { texto: padrao, geradoPorIA: false };
    return { texto: limpo, geradoPorIA: true };
  } catch (e) {
    console.error("[mensagem-clientes] IA falhou, usando modelo padrão:", e instanceof Error ? e.message : e);
    return { texto: padrao, geradoPorIA: false };
  }
}

export type ResultadoEnvio = { enviados: string[]; falhas: { id: string; nome: string; erro: string }[] };

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
      direction: "OUT", body: corpo, origin: "CRM", operatorDisplayName: "Você",
      mediaType: midia.tipo, mediaName: midia.nome, zapiMessageId, sendStatus: "SENT",
    });
  } catch (e) {
    const naoConfirmado = e instanceof zapi.EnvioNaoConfirmadoError;
    await inserirMensagem(conv.id, {
      direction: "OUT", body: corpo, origin: "CRM", operatorDisplayName: "Você",
      mediaType: midia.tipo, mediaName: midia.nome, sendStatus: naoConfirmado ? "UNCONFIRMED" : "FAILED",
    });
    if (!naoConfirmado) return { ok: false, erro: `O WhatsApp recusou o envio: ${String(e).slice(0, 160)}` };
  }
  await db.cliente.update({ where: { id: cliente.id }, data: { aguardandoResposta: false, ultimoContato: new Date() } });
  await registrarAudit({
    acao: "mensagem_enviada", origem: "usuario", entidade: "Cliente", entidadeId: cliente.id,
    descricao: `${midia.tipo === "image" ? "Imagem" : midia.tipo === "video" ? "Vídeo" : "Documento"} enviado via WhatsApp para ${cliente.nome}`,
  }).catch(() => {});
  return { ok: true };
}

// Manda para um LOTE de clientes (a tela chama em lotes pequenos). Cada um
// recebe o texto com o próprio nome; com anexo, o texto vai de legenda. Uma
// pausa curta entre envios, para não parecer disparo automático.
export async function enviarMensagemClientesAction(clienteIds: string[], texto: string, midiaId: string | null): Promise<ResultadoEnvio> {
  const base = texto.trim();
  const r: ResultadoEnvio = { enviados: [], falhas: [] };
  const midia = midiaId ? await lerMidiaEnvio(midiaId) : null;
  if (midiaId && !midia) {
    return { enviados: [], falhas: clienteIds.map((id) => ({ id, nome: id, erro: "O anexo expirou — escolha o arquivo de novo." })) };
  }
  if (!base && !midia) return r;
  const ids = Array.from(new Set(clienteIds)).slice(0, 5);
  const clientes = await db.cliente.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true, telefone: true } });
  const porId = new Map(clientes.map((c) => [c.id, c]));
  for (let i = 0; i < ids.length; i++) {
    const c = porId.get(ids[i]);
    if (!c) { r.falhas.push({ id: ids[i], nome: ids[i], erro: "Cliente não encontrado." }); continue; }
    try {
      const pessoal = personalizarTexto(base, c.nome);
      const res = midia ? await enviarComMidia(c, midia, pessoal) : await enviarResposta(c.id, pessoal);
      if (res.ok) r.enviados.push(c.id);
      else r.falhas.push({ id: c.id, nome: c.nome, erro: res.erro ?? "Falha ao enviar." });
    } catch (e) {
      r.falhas.push({ id: c.id, nome: c.nome, erro: e instanceof Error ? e.message : String(e) });
    }
    if (i < ids.length - 1) await new Promise((ok) => setTimeout(ok, 700));
  }
  return r;
}
