// Parabéns automático: todo dia às 8h (Brasília) quem faz aniversário recebe
// a mensagem pelo WhatsApp, só com o primeiro nome ("DUDA RETRO ROSSI" →
// "Duda"). Liga/desliga e o texto ficam em Configuracao; cada envio é
// marcado por cliente+ano para o cron poder rodar mais de uma vez no dia.

import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";
import { enviarResposta } from "@/lib/actions";
import { registrarAudit } from "@/lib/audit";
import { lerParametros } from "@/lib/parametros";
import { personalizarTexto } from "@/lib/abordagem-cidade-regra";
import { anoBrasilia, deveMandarParabens } from "@/lib/aniversario-regra";
import { modeloPadrao } from "@/lib/mensagem-clientes-regra";
import { porQueNaoEnviar, pausaHumanaMs } from "@/lib/envio-limites";
import { lerLimitesEnvio, enviadasHoje } from "@/lib/envio-guarda";

const CHAVE_ATIVO = "aniversario.automatico";
const CHAVE_TEXTO = "aniversario.automatico.texto";
const PREFIXO_ENVIADO = "aniversario.enviado.";

export type ConfigAniversario = { ativo: boolean; texto: string };

export async function textoPadraoAniversario(): Promise<string> {
  const p = await lerParametros().catch(() => null);
  return modeloPadrao("aniversario", { vendedor: p?.nomeVendedor, marcas: p?.marcas });
}

export async function lerConfigAniversario(): Promise<ConfigAniversario> {
  const [ativo, texto] = await Promise.all([getConfig(CHAVE_ATIVO), getConfig(CHAVE_TEXTO)]);
  return { ativo: ativo === "1", texto: texto?.trim() || (await textoPadraoAniversario()) };
}

export async function definirConfigAniversario(c: ConfigAniversario): Promise<ConfigAniversario> {
  const texto = c.texto.trim();
  await Promise.all([setConfig(CHAVE_ATIVO, c.ativo ? "1" : "0"), setConfig(CHAVE_TEXTO, texto)]);
  await registrarAudit({
    acao: "perfil_atualizado", origem: "usuario",
    descricao: c.ativo ? "Parabéns automático de aniversário LIGADO (todo dia às 8h)." : "Parabéns automático de aniversário desligado.",
  }).catch(() => {});
  return lerConfigAniversario();
}

export type ResultadoAniversarios = { ativo: boolean; enviados: string[]; falhas: { nome: string; erro: string }[] };

export async function enviarAniversariosDoDia(hoje = new Date()): Promise<ResultadoAniversarios> {
  const cfg = await lerConfigAniversario();
  const r: ResultadoAniversarios = { ativo: cfg.ativo, enviados: [], falhas: [] };
  if (!cfg.ativo) return r;

  const [clientes, marcas] = await Promise.all([
    db.cliente.findMany({
      // naoPerturbe vale AQUI também. Quem respondeu SAIR e continua
      // recebendo "parabéns" no aniversário é o caso que mais vira denúncia:
      // ele pediu para parar e o sistema ignorou.
      //
      // O que NÃO se aplica aqui é a peneira de contato frio da campanha.
      // Parabéns é outra coisa: são 3 ou 4 por dia espalhados pelo ano, para
      // cliente do cadastro dele, com o nome da pessoa. O perfil de risco não
      // tem nada a ver com 1.298 promoções de uma vez — e cortar isso custaria
      // relacionamento de verdade sem proteger o número.
      where: { dataNascimento: { not: null }, telefone: { not: null }, naoPerturbe: false, OR: [{ origem: null }, { origem: { not: "prospect_ia" } }] },
      select: { id: true, nome: true, telefone: true, dataNascimento: true, status: true },
    }),
    db.configuracao.findMany({ where: { chave: { startsWith: PREFIXO_ENVIADO } }, select: { chave: true, valor: true } }),
  ]);
  const enviadoNoAno = new Map(marcas.map((m) => [m.chave.slice(PREFIXO_ENVIADO.length), Number(m.valor) || null]));
  const ano = anoBrasilia(hoje);

  // As mesmas travas do envio em massa: o WhatsApp conta o número que sai,
  // não o motivo — parabéns automático de madrugada é assinatura de robô
  // igual a qualquer outro disparo.
  const lim = await lerLimitesEnvio();
  let jaHoje = await enviadasHoje(hoje);

  for (const c of clientes.filter((c) => deveMandarParabens(c, hoje, enviadoNoAno.get(c.id) ?? null))) {
    // Não marca como enviado ao parar: o cron roda de novo no mesmo dia e
    // pega de onde ficou, dentro da janela.
    if (porQueNaoEnviar(new Date(), jaHoje, lim)) break;
    try {
      const res = await enviarResposta(c.id, personalizarTexto(cfg.texto, c.nome));
      if (!res.ok) { r.falhas.push({ nome: c.nome, erro: res.erro ?? "Falha ao enviar." }); continue; }
      await setConfig(`${PREFIXO_ENVIADO}${c.id}`, String(ano));
      await registrarAudit({
        acao: "mensagem_enviada", origem: "sistema", entidade: "Cliente", entidadeId: c.id,
        descricao: `Parabéns de aniversário enviado automaticamente para ${c.nome}.`,
      }).catch(() => {});
      r.enviados.push(c.nome);
      jaHoje += 1;
    } catch (e) {
      r.falhas.push({ nome: c.nome, erro: e instanceof Error ? e.message : String(e) });
    }
    await new Promise((ok) => setTimeout(ok, pausaHumanaMs(lim)));
  }
  return r;
}
