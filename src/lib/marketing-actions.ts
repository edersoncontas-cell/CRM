"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { gerarPostMarketingIA, type TipoPost } from "@/lib/ai/index";
import { registrarAudit } from "@/lib/audit";

// Gera um novo post de marketing e salva como rascunho
export async function gerarPostAction(formData: FormData) {
  const tipo = (formData.get("tipo") as TipoPost) ?? "avulso";
  const marca = (formData.get("marca") as string) || null;
  const categoria = (formData.get("categoria") as string) || null;
  const canal = (formData.get("canal") as string) || "ambos";
  const modelo = (formData.get("modelo") as string) || null;
  const imagemBase64 = (formData.get("imagemBase64") as string) || null;
  const imagemMime = (formData.get("imagemMime") as string) || "image/jpeg";

  const where: { proprio: boolean; marca?: string; modelo?: string; categoria?: string } = { proprio: true };
  if (marca) where.marca = marca;
  if (categoria) where.categoria = categoria;
  if (modelo) where.modelo = modelo;

  const maquinas = await db.maquina.findMany({ where });
  const maquina = maquinas.length
    ? maquinas[Math.floor(Math.random() * maquinas.length)]
    : null;

  const imagem = imagemBase64
    ? { base64: imagemBase64, mediaType: imagemMime as "image/jpeg" | "image/png" | "image/webp" | "image/gif" }
    : undefined;

  const post = await gerarPostMarketingIA(maquina, tipo, undefined, undefined, imagem);

  const campanha = await db.campanhaMarketing.create({
    data: {
      tipo,
      titulo: post.titulo,
      conteudo: post.corpo,
      hashtags: post.hashtags,
      canalAlvo: canal,
      marca: maquina?.marca ?? marca ?? null,
      categoria: maquina?.categoria ?? categoria ?? null,
      status: "rascunho",
    },
  });
  await registrarAudit({
    acao: "post_gerado",
    origem: "ia",
    descricao: `Post de marketing gerado: "${post.titulo}"`,
    entidade: "CampanhaMarketing",
    entidadeId: campanha.id,
    extra: { tipo, canal, marca: campanha.marca, categoria: campanha.categoria, comImagem: !!imagemBase64 },
  });

  revalidatePath("/marketing");
}

// Aprova um rascunho
export async function aprovarCampanha(id: string) {
  await db.campanhaMarketing.update({
    where: { id },
    data: { status: "aprovado" },
  });
  revalidatePath("/marketing");
}

// Rejeita um rascunho
export async function rejeitarCampanha(id: string) {
  await db.campanhaMarketing.update({
    where: { id },
    data: { status: "rejeitado" },
  });
  revalidatePath("/marketing");
}

// Solicita alteração com feedback e regenera via IA
export async function pedirAlteracaoCampanha(id: string, feedback: string) {
  const campanha = await db.campanhaMarketing.findUnique({ where: { id } });
  if (!campanha) return;

  const where: { proprio: boolean; marca?: string; modelo?: string; categoria?: string } = { proprio: true };
  if (campanha.marca) where.marca = campanha.marca;
  if (campanha.categoria) where.categoria = campanha.categoria;

  const maquinas = await db.maquina.findMany({ where });
  const maquina = maquinas.length
    ? maquinas[Math.floor(Math.random() * maquinas.length)]
    : null;

  const novo = await gerarPostMarketingIA(
    maquina,
    campanha.tipo as TipoPost,
    feedback,
    campanha.conteudo
  );

  await db.campanhaMarketing.update({
    where: { id },
    data: {
      titulo: novo.titulo,
      conteudo: novo.corpo,
      hashtags: novo.hashtags,
      feedbackEderson: feedback,
      status: "rascunho",
    },
  });

  revalidatePath("/marketing");
}

// Marca como enviado (stub — envia de verdade quando WhatsApp estiver conectado)
export async function enviarCampanha(
  id: string,
  filtro: { marca?: string; categoria?: string; municipioFiltro?: string }
) {
  const where: {
    telefone: { not: null };
    municipioId?: string;
    negociacoes?: object;
    NOT?: object;
  } = {
    telefone: { not: null },
    NOT: { municipio: { foraDeArea: true } },
  };

  if (filtro.municipioFiltro) {
    const mun = await db.municipio.findFirst({
      where: { nome: { contains: filtro.municipioFiltro } },
    });
    if (mun) where.municipioId = mun.id;
  }

  if (filtro.marca) {
    where.negociacoes = {
      some: { status: "aberta" },
    };
  }

  const clientes = await db.cliente.findMany({
    where,
    select: { id: true, telefone: true },
  });

  await db.campanhaMarketing.update({
    where: { id },
    data: {
      status: "enviado",
      enviadoEm: new Date(),
      totalEnviado: clientes.length,
      municipioFiltro: filtro.municipioFiltro ?? null,
      marca: filtro.marca ?? undefined,
    },
  });
  await registrarAudit({
    acao: "campanha_enviada",
    origem: "sistema",
    descricao: `Campanha de marketing enviada para ${clientes.length} cliente(s)`,
    entidade: "CampanhaMarketing",
    entidadeId: id,
    extra: { totalEnviado: clientes.length, municipio: filtro.municipioFiltro, marca: filtro.marca },
  });

  revalidatePath("/marketing");
  return clientes.length;
}

// Exclui uma campanha rejeitada ou rascunho
export async function excluirCampanha(id: string) {
  await db.campanhaMarketing.delete({ where: { id } });
  revalidatePath("/marketing");
}
