// Vigia da conexão do WhatsApp (servidor). Regras puras em
// whatsapp-vigia-regra.ts.
//
// Roda de 5 em 5 minutos pelo cron mestre. Se a conexão caiu, religa sozinho
// (connect → restart) e só pede o QR Code depois de esgotar as tentativas.
// Também reaponta o webhook quando ele sai do lugar: instância "conectada"
// com webhook errado é o mesmo que estar fora do ar — as mensagens não chegam.

import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";
import * as zapi from "@/lib/zapi";
import { registrarZeusEvent } from "@/lib/zeus/eventos";
import { enviarPushNotificacao } from "@/lib/push";
import {
  decidirAcao, memoriaAposLeitura, memoriaAposTentativa, precisaMesmoDeQr, descreverConexao,
  MEMORIA_VAZIA, type MemoriaVigia, type EstadoConexao, type AcaoVigia,
} from "@/lib/whatsapp-vigia-regra";
import { vigiaPausado } from "@/lib/whatsapp-vigia-pausa";

export const CHAVE_VIGIA = "whatsapp.vigia";
const TITULO_ALERTA_QR = "WhatsApp desconectado — escaneie o QR em /conexao";

export async function lerMemoriaVigia(): Promise<MemoriaVigia> {
  const raw = await getConfig(CHAVE_VIGIA).catch(() => null);
  if (!raw) return MEMORIA_VAZIA;
  try { return { ...MEMORIA_VAZIA, ...(JSON.parse(raw) as Partial<MemoriaVigia>) }; }
  catch { return MEMORIA_VAZIA; }
}

async function gravarMemoria(m: MemoriaVigia): Promise<void> {
  await setConfig(CHAVE_VIGIA, JSON.stringify(m)).catch(() => {});
}

export type ResultadoVigia = {
  estado: EstadoConexao | "nao_configurado";
  acao: AcaoVigia | "nenhuma";
  conectado: boolean;
  religou: boolean;
  webhookCorrigido: boolean;
  precisaQr: boolean;
  descricao: string;
  erro?: string | null;
};

// `forcar` = pedido manual do vendedor ("Verificar e religar agora"): ignora a
// pausa da tela do QR, porque aí é ele mesmo mandando mexer na instância.
export async function vigiarConexao({ agora = new Date(), forcar = false }: { agora?: Date; forcar?: boolean } = {}): Promise<ResultadoVigia> {
  const urlWebhook = zapi.urlWebhookCrm();
  const status = await zapi.statusConexao(urlWebhook).catch(() => null);

  if (!status?.configurado) {
    return { estado: "nao_configurado", acao: "nenhuma", conectado: false, religou: false, webhookCorrigido: false, precisaQr: false, descricao: "WhatsApp não configurado." };
  }

  const estado: EstadoConexao = status.conectado ? "aberta" : status.instanciaNaoExiste ? "sem_instancia" : "fechada";
  const leitura = memoriaAposLeitura(await lerMemoriaVigia(), estado, agora);
  let memoria = leitura.memoria;

  // Webhook fora do lugar: reaponta na hora, mesmo com a conexão de pé.
  let webhookCorrigido = false;
  if (status.conectado && status.webhookOk === false && urlWebhook) {
    const r = await zapi.configurarWebhookEvolution(urlWebhook).catch(() => ({ ok: false }));
    webhookCorrigido = r.ok === true;
    if (webhookCorrigido) {
      await registrarZeusEvent({ tipo: "health", titulo: "Webhook do WhatsApp reapontado para o CRM", severidade: "baixa" }).catch(() => {});
    }
  }

  // Tela do QR aberta: não mexe na instância (cada restart invalida o código
  // que o vendedor está escaneando naquele instante).
  const pausado = !forcar && (await vigiaPausado(agora).catch(() => false));
  const acao = pausado ? "esperar" : decidirAcao(estado, memoria, agora);
  let religou = false;
  let erro: string | null = null;

  if (acao === "conectar" || acao === "reiniciar" || acao === "criar_instancia") {
    memoria = memoriaAposTentativa(memoria, agora);
    if (acao === "criar_instancia") {
      const r = await zapi.criarInstanciaEvolution(urlWebhook).catch(() => ({ ok: false, erro: "falhou" }));
      if (!r.ok) erro = r.erro ?? null;
    } else if (acao === "conectar") {
      const r = await zapi.reconectar();
      religou = r.conectado;
      if (!r.ok) erro = r.erro ?? null;
    } else {
      await zapi.reiniciar().catch(() => false);
      // Depois do restart o socket sobe sozinho; um connect logo em seguida
      // encurta a volta quando a credencial ainda está lá.
      const r = await zapi.reconectar().catch(() => ({ ok: false, conectado: false }));
      religou = r.conectado;
    }

    if (religou) {
      const pos = memoriaAposLeitura({ ...memoria, ultimoEstado: estado }, "aberta", agora);
      memoria = { ...pos.memoria, reconexoesAutomaticas: memoria.reconexoesAutomaticas + 1 };
      await registrarZeusEvent({ tipo: "health", titulo: "WhatsApp religado automaticamente", severidade: "baixa", detalhe: { acao } }).catch(() => {});
      await db.zeusEvent.updateMany({ where: { titulo: TITULO_ALERTA_QR, resolvido: false }, data: { resolvido: true } }).catch(() => {});
    }
  }

  // Só avisa o vendedor quando o religamento automático se esgotou.
  const precisaQr = !religou && estado !== "aberta" && precisaMesmoDeQr(memoria, agora);
  if (precisaQr && !memoria.avisouQr) {
    memoria = { ...memoria, avisouQr: true };
    await registrarZeusEvent({ tipo: "health", titulo: TITULO_ALERTA_QR, severidade: "alta", detalhe: { tentativas: memoria.tentativas, erro: status.erro ?? erro ?? null } }).catch(() => {});
    await enviarPushNotificacao({
      title: "⚠️ WhatsApp fora do ar",
      body: "Tentei religar sozinho e não deu. Escaneie o QR em /conexao.",
      url: "/conexao", tag: "zeus-wa-desconectado",
    }).catch(() => {});
  }

  if (estado === "aberta" || religou) {
    await db.zeusEvent.updateMany({ where: { titulo: TITULO_ALERTA_QR, resolvido: false }, data: { resolvido: true } }).catch(() => {});
  }

  await gravarMemoria(memoria);

  return {
    estado, acao, conectado: status.conectado || religou, religou, webhookCorrigido, precisaQr,
    descricao: descreverConexao(memoria, agora), erro: erro ?? status.erro ?? null,
  };
}
