"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { registrarAudit } from "@/lib/audit";

export type NovoEvento = {
  titulo: string;
  inicioIso: string;
  fimIso: string;
  diaInteiro: boolean;
  horaInicio?: string;
  horaFim?: string;
  uf?: string;
  cidade?: string;
  observacao?: string;
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

export async function criarEventoAction(e: NovoEvento): Promise<{ ok: boolean; erro?: string }> {
  const titulo = e.titulo.trim();
  if (!titulo) return { ok: false, erro: "Dê um nome ao evento." };
  if (!DATA.test(e.inicioIso) || !DATA.test(e.fimIso)) return { ok: false, erro: "Datas inválidas." };
  if (e.fimIso < e.inicioIso) return { ok: false, erro: "O fim não pode ser antes do começo." };

  const hIni = e.diaInteiro ? "00:00" : (HORA.test(e.horaInicio ?? "") ? e.horaInicio! : "09:00");
  const hFim = e.diaInteiro ? "23:59" : (HORA.test(e.horaFim ?? "") ? e.horaFim! : "18:00");
  if (!e.diaInteiro && e.inicioIso === e.fimIso && hFim <= hIni) {
    return { ok: false, erro: "O horário de fim precisa ser depois do de início." };
  }

  await db.evento.create({
    data: {
      titulo,
      inicio: new Date(`${e.inicioIso}T${hIni}:00-03:00`),
      fim: new Date(`${e.fimIso}T${hFim}:00-03:00`),
      diaInteiro: e.diaInteiro,
      uf: e.uf?.trim() || null,
      cidade: e.cidade?.trim() || null,
      observacao: e.observacao?.trim() || null,
    },
  });

  await registrarAudit({
    acao: "tarefa_criada", origem: "usuario",
    descricao: `Evento na agenda: "${titulo}" de ${e.inicioIso} a ${e.fimIso}${e.cidade ? ` · ${e.cidade}${e.uf ? `/${e.uf}` : ""}` : ""}.`,
  }).catch(() => {});

  revalidatePath("/visitas"); revalidatePath("/dashboard");
  return { ok: true };
}

export async function removerEventoAction(id: string): Promise<{ ok: boolean }> {
  await db.evento.delete({ where: { id } }).catch(() => {});
  revalidatePath("/visitas"); revalidatePath("/dashboard");
  return { ok: true };
}
