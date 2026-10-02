"use server";

// "Testar recebimento" (tela de Conexão): o vendedor manda uma mensagem de
// outro celular e o CRM descobre onde ela parou — na Evolution, no aviso
// (webhook) ou no próprio CRM — e conserta o que dá para consertar daqui:
// puxa da Evolution o que o aviso não trouxe e reaponta o webhook.
// Regras e textos: lib/whatsapp-resgate-regra.ts.

import { revalidatePath } from "next/cache";
import * as zapi from "@/lib/zapi";
import { lerDiag } from "@/lib/zapi-diag";
import { resgatarMensagensEvolution } from "@/lib/whatsapp-resgate";
import { registrarAudit } from "@/lib/audit";
import { concluirTeste, ESPERA_TESTE_MS, type ResultadoTeste } from "@/lib/whatsapp-resgate-regra";

const ultimos4 = (phone: string | null) => (phone ?? "").replace(/\D/g, "").slice(-4);

export async function testarRecebimentoAction(
  inicioIso: string,
  conexaoJaSondada?: { estado: "viva" | "morta" | "desconhecida"; detalhe: string } | null,
): Promise<ResultadoTeste> {
  const agora = Date.now();
  // O início vem da tela: nunca no futuro, nunca mais de 15 min para trás.
  let inicio = Date.parse(inicioIso);
  if (!Number.isFinite(inicio) || inicio > agora) inicio = agora;
  inicio = Math.max(inicio, agora - 15 * 60_000);
  // Folga de 1 min: o relógio do celular que mandou pode estar atrasado.
  const desde = new Date(inicio - 60_000);

  // A conexão está viva por dentro? Uma consulta só, na primeira passada.
  const primeira = !conexaoJaSondada;
  const sonda = conexaoJaSondada ?? await zapi.sondarConexaoEvolution();

  // Na primeira passada, aproveita: o que a Evolution recebeu nas últimas
  // 24 h e não chegou ao CRM (a mensagem de teste de antes, inclusive) vem agora.
  let atrasadasPuxadas = 0;
  if (primeira) {
    // Só ANTES da janela do teste: a mensagem do teste é contada pelo teste.
    const atrasadas = await resgatarMensagensEvolution({ desde: new Date(agora - 24 * 60 * 60_000), ate: desde, max: 20 }).catch(() => null);
    atrasadasPuxadas = (atrasadas?.puxadas ?? []).filter((p) => p.status === "recebida" || p.status === "enviada").length;
  }

  const resgate = await resgatarMensagensEvolution({ desde, max: 10 });
  const diag = await lerDiag().catch(() => null);
  // Eventos do CRM têm a hora do PRÓPRIO servidor: sem folga, senão o teste
  // anterior (segundos antes) contaria como este.
  const eventos = (diag?.ultimos ?? [])
    .filter((e) => Date.parse(e.em) >= inicio)
    .map((e) => ({ em: e.em, status: e.status, via: e.via, dir: e.dir, numero: ultimos4(e.phone) }));

  const recebidasNaEvolution = resgate.naEvolution.filter((m) => m.deOutraPessoa).length;
  const faltandoNoCrm = resgate.naEvolution.filter((m) => m.deOutraPessoa && !m.noCrm && !m.jaTratada).length;
  const erroAoPuxar = resgate.puxadas.find((p) => p.status.startsWith("erro"))?.status.slice(5) ?? null;
  const esgotou = agora - inicio >= ESPERA_TESTE_MS;
  const evolutionGuarda = esgotou && resgate.consultou && recebidasNaEvolution === 0
    ? await zapi.totalGuardadoEvolution()
    : null;

  const conclusao = concluirTeste({
    evolutionRespondeu: resgate.consultou,
    erroEvolution: resgate.erro ?? null,
    evolutionGuarda,
    recebidasNaEvolution,
    faltandoNoCrm,
    erroAoPuxar,
    eventosWebhook: eventos.filter((e) => e.via !== "resgate"),
    puxadasNaJanela: resgate.puxadas.map((p) => p.status),
    conexao: sonda.estado,
    esgotou,
  });

  // O aviso não chegou (ou chegou recusado): reaponta o webhook da instância
  // que vale, com a chave na URL — o mesmo que "Configurar webhook agora".
  let webhookReapontado = false;
  if (conclusao.situacao === "puxada" || conclusao.situacao === "recusada-no-webhook") {
    const url = await zapi.urlWebhookCrm();
    if (url) webhookReapontado = (await zapi.configurarWebhookEvolution(url).catch(() => ({ ok: false }))).ok === true;
  }

  if (resgate.puxadas.length || atrasadasPuxadas || conclusao.final) {
    await registrarAudit({
      acao: "perfil_atualizado", origem: "usuario",
      descricao: `Teste de recebimento do WhatsApp: ${conclusao.situacao}`
        + (resgate.puxadas.length ? ` · ${resgate.puxadas.length} mensagem(ns) puxada(s) da Evolution` : "")
        + (atrasadasPuxadas ? ` · ${atrasadasPuxadas} que tinham ficado para trás (24 h)` : "")
        + ` · conexão ${sonda.estado}${webhookReapontado ? " · webhook reapontado" : ""}.`,
    }).catch(() => {});
  }
  // Gravou mensagem: as telas (e as cópias do modo sem sinal) se renovam.
  if (atrasadasPuxadas || resgate.puxadas.some((p) => p.status === "recebida" || p.status === "enviada")) {
    revalidatePath("/atendimento");
    revalidatePath("/conexao");
  }

  return {
    conclusao,
    conexao: sonda.estado,
    detalheConexao: sonda.detalhe,
    naEvolution: resgate.naEvolution.map(({ deOutraPessoa, numero, hora, noCrm }) => ({ deOutraPessoa, numero, hora, noCrm })),
    eventos,
    puxadas: resgate.puxadas.length,
    atrasadasPuxadas,
    webhookReapontado,
  };
}
