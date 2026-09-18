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
      where: { dataNascimento: { not: null }, telefone: { not: null }, OR: [{ origem: null }, { origem: { not: "prospect_ia" } }] },
      select: { id: true, nome: true, telefone: true, dataNascimento: true, status: true },
    }),
    db.configuracao.findMany({ where: { chave: { startsWith: PREFIXO_ENVIADO } }, select: { chave: true, valor: true } }),
  ]);
  const enviadoNoAno = new Map(marcas.map((m) => [m.chave.slice(PREFIXO_ENVIADO.length), Number(m.valor) || null]));
  const ano = anoBrasilia(hoje);

  for (const c of clientes.filter((c) => deveMandarParabens(c, hoje, enviadoNoAno.get(c.id) ?? null))) {
    try {
      const res = await enviarResposta(c.id, personalizarTexto(cfg.texto, c.nome));
      if (!res.ok) { r.falhas.push({ nome: c.nome, erro: res.erro ?? "Falha ao enviar." }); continue; }
      await setConfig(`${PREFIXO_ENVIADO}${c.id}`, String(ano));
      await registrarAudit({
        acao: "mensagem_enviada", origem: "sistema", entidade: "Cliente", entidadeId: c.id,
        descricao: `Parabéns de aniversário enviado automaticamente para ${c.nome}.`,
      }).catch(() => {});
      r.enviados.push(c.nome);
    } catch (e) {
      r.falhas.push({ nome: c.nome, erro: e instanceof Error ? e.message : String(e) });
    }
    await new Promise((ok) => setTimeout(ok, 700));
  }
  return r;
}
