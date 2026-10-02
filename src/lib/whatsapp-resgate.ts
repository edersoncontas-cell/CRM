// RESGATE: o CRM puxa da Evolution as mensagens que o webhook não trouxe.
//
// A Evolution guarda tudo o que recebe do WhatsApp ANTES de avisar o CRM
// (DATABASE_SAVE_DATA_NEW_MESSAGE). Quando o aviso não chega — webhook
// apagado num reinício da Evolution, endereço que o servidor dela não
// alcança, chave recusada —, a mensagem está lá, só não veio. O vigia e o
// "Testar recebimento" puxam e passam pelo MESMO caminho do webhook
// (lib/whatsapp-evolution-entrada.ts). Regras puras: whatsapp-resgate-regra.ts.

import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";
import { mensagensRecentesEvolution, provedorWhatsApp } from "@/lib/zapi";
import { processarDadoEvolution } from "@/lib/whatsapp-evolution-entrada";
import {
  escolherParaResgate, idDoRegistro, horaDoRegistro, ehConversa, ehDeOutraPessoa, remoteJidDoRegistro,
  lerMemoria, memoriaDepois, inicioDaJanela,
} from "@/lib/whatsapp-resgate-regra";

export const CHAVE_RESGATE = "whatsapp.resgate";

/** jaTratada: o CRM já passou por ela antes (e deixou de fora: grupo, bloqueado, antiga…). */
export type MensagemNaEvolution = { id: string; deOutraPessoa: boolean; numero: string; hora: string; noCrm: boolean; jaTratada: boolean };

export type ResultadoResgate = {
  consultou: boolean;
  erro?: string;
  /** Mensagens (conversa, de qualquer lado) que a Evolution tem na janela. */
  naEvolution: MensagemNaEvolution[];
  /** O que foi puxado agora e o que o CRM fez com cada uma. */
  puxadas: { id: string; status: string }[];
};

/**
 * `desde`: início da janela. Sem ele (o vigia), a janela vem da memória: desde
 * a última passada, no máximo 2 h para trás.
 */
export async function resgatarMensagensEvolution(o: { desde?: Date; ate?: Date; max?: number } = {}): Promise<ResultadoResgate> {
  if (provedorWhatsApp() !== "evolution") return { consultou: false, erro: "Evolution API não configurada.", naEvolution: [], puxadas: [] };
  const agora = Date.now();
  const memoria = lerMemoria(await getConfig(CHAVE_RESGATE).catch(() => null));
  const desde = o.desde ? o.desde.getTime() : inicioDaJanela(memoria, agora);

  const r = await mensagensRecentesEvolution(new Date(desde), 50);
  if (!r.ok) return { consultou: false, erro: r.erro, naEvolution: [], puxadas: [] };

  const naJanela = r.registros.filter((x) => ehConversa(x) && horaDoRegistro(x) >= desde);
  const ids = naJanela.map(idDoRegistro).filter((x): x is string => !!x);
  const noCrm = new Set(
    ids.length
      ? (await db.whatsAppMessage.findMany({ where: { zapiMessageId: { in: ids } }, select: { zapiMessageId: true } }))
          .map((m) => m.zapiMessageId)
          .filter((x): x is string => !!x)
      : [],
  );

  const vistosAntes = new Set(memoria.vistos);
  const escolhidas = escolherParaResgate(naJanela, { desde, ate: o.ate?.getTime(), noCrm, vistos: vistosAntes, max: o.max ?? 20 });
  const puxadas: { id: string; status: string }[] = [];
  for (const reg of escolhidas) {
    const id = idDoRegistro(reg)!;
    try {
      const p = await processarDadoEvolution(reg, "resgate");
      puxadas.push({ id, status: p.status });
      if (p.status === "recebida" || p.status === "enviada") noCrm.add(id);
    } catch (e) {
      puxadas.push({ id, status: `erro:${(e instanceof Error ? e.message : String(e)).slice(0, 60)}` });
    }
  }
  // Só grava quando mudou algo: o vigia passa a cada poucos minutos e o banco
  // gratuito conta cada escrita.
  if (puxadas.length || !o.desde) {
    // Só o vigia (sem `desde`) move a hora da última passada: o teste puxar
    // não pode fazer o vigia pular o que ficou para trás antes dele.
    await setConfig(CHAVE_RESGATE, JSON.stringify(memoriaDepois(memoria, puxadas.filter((p) => !p.status.startsWith("erro")).map((p) => p.id), o.desde ? null : agora))).catch(() => {});
  }

  return {
    consultou: true,
    naEvolution: naJanela.map((x) => ({
      id: idDoRegistro(x) ?? "",
      deOutraPessoa: ehDeOutraPessoa(x),
      numero: remoteJidDoRegistro(x).split("@")[0].replace(/\D/g, "").slice(-4),
      hora: new Date(horaDoRegistro(x)).toISOString(),
      noCrm: noCrm.has(idDoRegistro(x) ?? ""),
      jaTratada: vistosAntes.has(idDoRegistro(x) ?? ""),
    })),
    puxadas,
  };
}
