"use server";

// Ações da sessão de Marketing: gerar a legenda e a arte com o Gemini,
// guardar o post, marcar como publicado e mandar para a carteira de clientes
// (reaproveitando o envio em lote do WhatsApp).

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { llmTexto, iaHabilitada } from "@/lib/ai";
import { gerarImagemGemini, geracaoDeImagemHabilitada } from "@/lib/ai/imagem";
import { lerParametros } from "@/lib/parametros";
import { registrarAudit } from "@/lib/audit";
import { mensagemErroIA } from "@/lib/ai/erros";
import {
  promptLegenda, promptArtePost, normalizarLegenda, textoParaPublicar,
  type PedidoPost, type TipoPost, type CanalPost,
} from "@/lib/marketing-regra";

export type PostSalvo = {
  id: string;
  criadoEm: string;
  tipo: TipoPost;
  tema: string;
  legenda: string;
  hashtags: string;
  maquina: string | null;
  imagem: string | null; // data URL pronta para <img src>
  agendadoPara: string | null;
  status: "rascunho" | "pronto" | "publicado";
  publicadoEm: string | null;
  canal: CanalPost | null;
};

const paraDTO = (p: {
  id: string; criadoEm: Date; tipo: string; tema: string; legenda: string; hashtags: string;
  maquina: string | null; imagemBase64: string | null; imagemMime: string | null;
  agendadoPara: Date | null; status: string; publicadoEm: Date | null; canal: string | null;
}): PostSalvo => ({
  id: p.id,
  criadoEm: p.criadoEm.toISOString(),
  tipo: p.tipo as TipoPost,
  tema: p.tema,
  legenda: p.legenda,
  hashtags: p.hashtags,
  maquina: p.maquina,
  imagem: p.imagemBase64 ? `data:${p.imagemMime ?? "image/png"};base64,${p.imagemBase64}` : null,
  agendadoPara: p.agendadoPara?.toISOString() ?? null,
  status: (["rascunho", "pronto", "publicado"].includes(p.status) ? p.status : "rascunho") as PostSalvo["status"],
  publicadoEm: p.publicadoEm?.toISOString() ?? null,
  canal: (p.canal as CanalPost) ?? null,
});

async function montarPedido(base: { tipo: TipoPost; tema: string; canal: CanalPost; maquina?: string | null; instrucoes?: string | null }): Promise<PedidoPost> {
  const p = await lerParametros();
  return {
    ...base,
    vendedor: p.nomeVendedor,
    empresa: p.nomeEmpresa,
    marcas: p.marcas,
    regiao: p.regiao,
  };
}

// ── Legenda ─────────────────────────────────────────────────────────────────
export async function gerarLegendaAction(entrada: {
  tipo: TipoPost; tema: string; canal: CanalPost; maquina?: string | null; instrucoes?: string | null;
}): Promise<{ ok: boolean; legenda?: string; hashtags?: string; ideiaDeArte?: string; erro?: string }> {
  if (!iaHabilitada()) return { ok: false, erro: "Configure uma chave de IA (GEMINI_API_KEY) para o Cérebro escrever o post." };
  if (!entrada.tema.trim()) return { ok: false, erro: "Escolha ou escreva o tema do post." };

  const pedido = await montarPedido(entrada);
  const { system, user } = promptLegenda(pedido);
  try {
    const raw = await llmTexto(system, user, { maxTokens: 900, json: true });
    const r = normalizarLegenda(raw, entrada.canal);
    if (!r.legenda) return { ok: false, erro: "A IA respondeu vazio. Tente de novo ou mude o tema." };
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, erro: mensagemErroIA(e) };
  }
}

// ── Arte ────────────────────────────────────────────────────────────────────
export async function gerarArtePostAction(entrada: {
  tipo: TipoPost; tema: string; canal: CanalPost; maquina?: string | null; instrucoes?: string | null; ideiaDeArte?: string | null;
  // Imagens que o vendedor anexou: foto da máquina, arte antiga que ele quer
  // no mesmo estilo, logo. O Gemini usa como BASE — é o que faz a arte sair
  // com a máquina dele e não com uma máquina genérica inventada.
  referencias?: { base64: string; mime: string }[] | null;
}): Promise<{ ok: boolean; imagem?: string; base64?: string; mime?: string; erro?: string }> {
  if (!geracaoDeImagemHabilitada()) return { ok: false, erro: "Criar arte precisa da GEMINI_API_KEY nas variáveis da Vercel." };
  const pedido = await montarPedido(entrada);
  const refs = (entrada.referencias ?? [])
    .filter((r) => r.base64)
    .slice(0, 4) // mais que isso o pedido fica pesado e o Gemini recusa por tamanho
    .map((r) => ({ base64: r.base64, mimeType: r.mime || "image/png" }));
  try {
    const img = await gerarImagemGemini(promptArtePost(pedido, entrada.ideiaDeArte ?? null, refs.length), refs);
    await registrarAudit({ acao: "post_gerado", origem: "ia", descricao: `Arte de post criada pelo Gemini (${img.modelo}) — ${entrada.tema}.` }).catch(() => {});
    return { ok: true, imagem: `data:${img.mimeType};base64,${img.base64}`, base64: img.base64, mime: img.mimeType };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// ── Guardar / listar / publicar ─────────────────────────────────────────────
export async function salvarPostAction(entrada: {
  id?: string | null;
  tipo: TipoPost; tema: string; canal: CanalPost; legenda: string; hashtags: string;
  maquina?: string | null; base64?: string | null; mime?: string | null; agendadoPara?: string | null;
  status?: PostSalvo["status"];
}): Promise<{ ok: boolean; post?: PostSalvo; erro?: string }> {
  if (!entrada.legenda.trim()) return { ok: false, erro: "O post precisa de uma legenda." };
  const dados = {
    tipo: entrada.tipo,
    tema: entrada.tema.trim() || "Sem tema",
    canal: entrada.canal,
    legenda: entrada.legenda.trim(),
    hashtags: entrada.hashtags.trim(),
    maquina: entrada.maquina?.trim() || null,
    agendadoPara: entrada.agendadoPara ? new Date(entrada.agendadoPara) : null,
    status: entrada.status ?? "rascunho",
    ...(entrada.base64 ? { imagemBase64: entrada.base64, imagemMime: entrada.mime ?? "image/png" } : {}),
  };
  const post = entrada.id
    ? await db.postMarketing.update({ where: { id: entrada.id }, data: dados })
    : await db.postMarketing.create({ data: dados });
  revalidatePath("/marketing");
  return { ok: true, post: paraDTO(post) };
}

export async function listarPostsAction(limite = 40): Promise<PostSalvo[]> {
  const linhas = await db.postMarketing.findMany({ orderBy: { criadoEm: "desc" }, take: limite });
  return linhas.map(paraDTO);
}

export async function marcarPostPublicadoAction(id: string, publicado: boolean): Promise<{ ok: boolean }> {
  await db.postMarketing.update({
    where: { id },
    data: publicado ? { status: "publicado", publicadoEm: new Date() } : { status: "pronto", publicadoEm: null },
  });
  revalidatePath("/marketing");
  return { ok: true };
}

export async function excluirPostAction(id: string): Promise<{ ok: boolean }> {
  await db.postMarketing.delete({ where: { id } }).catch(() => null);
  revalidatePath("/marketing");
  return { ok: true };
}

// Texto pronto para copiar (legenda + hashtags).
export async function textoDoPostAction(id: string): Promise<string> {
  const p = await db.postMarketing.findUnique({ where: { id }, select: { legenda: true, hashtags: true } });
  return p ? textoParaPublicar(p.legenda, p.hashtags) : "";
}

// Manda o post para a mesma máquina de envio em lote das mensagens (o anexo
// vira uma mídia guardada, reaproveitada em cada lote).
export async function prepararEnvioDoPostAction(id: string): Promise<{ ok: boolean; texto?: string; midiaId?: string | null; erro?: string }> {
  const p = await db.postMarketing.findUnique({ where: { id } });
  if (!p) return { ok: false, erro: "Post não encontrado." };
  let midiaId: string | null = null;
  if (p.imagemBase64) {
    const { guardarMidiaEnvio } = await import("@/lib/midia-envio");
    const r = await guardarMidiaEnvio({
      base64: p.imagemBase64,
      mimeType: p.imagemMime ?? "image/png",
      nome: `post-${p.tipo}.${(p.imagemMime ?? "image/png").includes("jpeg") ? "jpg" : "png"}`,
      tipo: "image",
      origem: "gemini",
    });
    midiaId = r.id;
  }
  return { ok: true, texto: textoParaPublicar(p.legenda, p.hashtags), midiaId };
}
