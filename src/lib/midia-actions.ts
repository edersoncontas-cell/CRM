"use server";

import { revalidatePath } from "next/cache";
import { db } from "./db";
import { gerarMidiaIA } from "./ai";

export async function gerarMidiaAction(formData: FormData) {
  const maquinaId = String(formData.get("maquinaId") ?? "");
  const maquina = await db.maquina.findUnique({ where: { id: maquinaId } });
  if (!maquina) return;

  const { titulo, conteudo } = await gerarMidiaIA(maquina);
  const agendadoPara = new Date();
  agendadoPara.setDate(agendadoPara.getDate() + 15); // próxima quinzena

  await db.midiaPost.create({
    data: { maquinaId, titulo, conteudo, status: "agendado", agendadoPara },
  });
  revalidatePath("/midia");
}
