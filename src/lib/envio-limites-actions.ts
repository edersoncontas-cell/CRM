"use server";

import { revalidatePath } from "next/cache";
import { LIMITES_PADRAO, type LimitesEnvio } from "@/lib/envio-limites";
import { lerLimitesEnvio, gravarLimitesEnvio, enviadasHoje } from "@/lib/envio-guarda";
import { db } from "@/lib/db";
import { registrarAudit } from "@/lib/audit";

// As travas de envio na tela de Configurações. Existir na tela é metade do
// valor: quando a Meta apertar de novo, ele abaixa o teto na hora, sem
// esperar deploy nem me chamar. E quando um envio não sair, a tela diz por
// quê em vez de ficar mudo.

export type PainelEnvio = {
  limites: LimitesEnvio;
  enviadasHoje: number;
  foraDaLista: number;
};

export async function lerPainelEnvioAction(): Promise<PainelEnvio> {
  const [limites, hoje, fora] = await Promise.all([
    lerLimitesEnvio(),
    enviadasHoje(),
    db.cliente.count({ where: { naoPerturbe: true } }).catch(() => 0),
  ]);
  return { limites, enviadasHoje: hoje, foraDaLista: fora };
}

function inteiro(v: FormDataEntryValue | null, padrao: number, min: number, max: number): number {
  const n = Math.round(Number(String(v ?? "").replace(",", ".")));
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

export async function salvarLimitesEnvioAction(fd: FormData): Promise<void> {
  const atual = await lerLimitesEnvio();
  // A pausa entre mensagens NÃO vai para a tela: é a trava que mais parece
  // inútil ("está devagar, deixa mais rápido") e a que mais segura o número.
  const novo: LimitesEnvio = {
    tetoDiario: inteiro(fd.get("tetoDiario"), atual.tetoDiario, 0, 1000),
    horaInicio: inteiro(fd.get("horaInicio"), atual.horaInicio, 0, 23),
    horaFim: inteiro(fd.get("horaFim"), atual.horaFim, 1, 24),
    somenteDiasUteis: fd.get("somenteDiasUteis") === "on",
    pausaMinMs: LIMITES_PADRAO.pausaMinMs,
    pausaMaxMs: LIMITES_PADRAO.pausaMaxMs,
  };
  // Janela invertida (começa às 18 e termina às 8) travaria o envio o dia
  // inteiro sem dizer por quê. Melhor consertar em silêncio que bloquear.
  if (novo.horaFim <= novo.horaInicio) novo.horaFim = Math.min(24, novo.horaInicio + 1);

  await gravarLimitesEnvio(novo);
  await registrarAudit({
    acao: "perfil_atualizado", origem: "usuario",
    descricao: `Travas de envio: até ${novo.tetoDiario}/dia, das ${novo.horaInicio}h às ${novo.horaFim}h${novo.somenteDiasUteis ? ", só em dia útil" : ", todos os dias"}.`,
  }).catch(() => {});
  revalidatePath("/configuracoes");
}
