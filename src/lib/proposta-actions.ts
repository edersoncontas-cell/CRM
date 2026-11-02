"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lerParametros } from "@/lib/parametros";
import { normalizarDados, calcPadrao, type DadosProposta } from "@/lib/proposta";
import type { ContextoProposta } from "@/lib/proposta-pdf";
import { registrarAudit } from "@/lib/audit";

// Proposta inicial: puxa o que já existe na negociação, no cadastro do cliente,
// na ficha da máquina e na análise do Orientador. Tudo editável depois.
export async function carregarProposta(negociacaoId: string): Promise<{ dados: DadosProposta; contexto: ContextoProposta; enviadaEm: string | null } | null> {
  const neg = await db.negociacao.findUnique({
    where: { id: negociacaoId },
    include: { cliente: { include: { municipio: true, orientador: true, frota: true } }, proposta: true },
  });
  if (!neg) return null;
  const [p, ficha] = await Promise.all([
    lerParametros(),
    neg.maquinaModelo ? db.maquina.findFirst({ where: { modelo: neg.maquinaModelo, proprio: true } }) : Promise.resolve(null),
  ]);

  const maquina = [neg.marca, neg.maquinaModelo].filter(Boolean).join(" ") || null;
  const frota = neg.cliente.frota.map((f) => `${f.marca} ${f.modelo}`).join(", ");
  const validade = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const calc = calcPadrao();
  calc.atual.rotulo = frota ? `${neg.cliente.frota[0].marca} ${neg.cliente.frota[0].modelo} (atual)` : "Máquina atual";
  calc.nova.rotulo = maquina ?? "Máquina nova";
  calc.nova.valor = neg.valor ?? ficha?.valorInicial ?? 0;
  if (ficha?.consumoLitrosHora) calc.nova.consumoLh = ficha.consumoLitrosHora;
  if (neg.crdParcelaValor) calc.nova.parcelaMes = neg.crdParcelaValor;

  const base: DadosProposta = {
    titulo: `Proposta ${maquina ?? ""} para ${neg.cliente.nome}`.replace(/\s+/g, " ").trim(),
    situacaoAtual: neg.cliente.orientador?.resumoNegociacao ?? neg.cliente.resumoTexto?.split("\n").slice(-3).join(" ") ?? (frota ? `Frota atual: ${frota}.` : ""),
    solucao: [maquina ? `${maquina}.` : "", ficha?.pontosFortes ? `Pontos fortes: ${ficha.pontosFortes}` : "", ficha?.aplicacoes ? `Aplicação: ${ficha.aplicacoes.split("\n")[0]}` : ""].filter(Boolean).join(" "),
    retorno: "",
    condicao: {
      valor: neg.valor ?? ficha?.valorInicial ?? 0,
      entradaValor: neg.entradaValor ?? 0,
      usadaDescricao: "",
      instrumento: neg.tipoPagamento === "consorcio" ? "Consórcio" : neg.tipoPagamento === "crd_pme" ? "CRD PME" : neg.tipoPagamento === "avista" ? "À vista" : neg.bancoFinanciamento ? `Financiamento ${neg.bancoFinanciamento}` : "Finame",
      parcelas: neg.crdSaldoParcelasQtd ?? 60,
      parcelaValor: neg.crdParcelaValor ?? 0,
      carenciaDias: 90,
      entregaDias: 15,
      garantiaMeses: 12,
      inclusos: "Entrega técnica e treinamento do operador",
    },
    prova: "",
    validade,
    proximoPasso: "Revisamos juntos a proposta e, estando de acordo, encaminhamos a documentação ao banco no mesmo dia.",
    calc,
  };

  let dados = base;
  if (neg.proposta) {
    try { dados = normalizarDados(JSON.parse(neg.proposta.dados), base); } catch { dados = base; }
  }
  const contexto: ContextoProposta = {
    nomeEmpresa: p.nomeEmpresa,
    nomeVendedor: p.nomeVendedor,
    telefoneVendedor: p.whatsappBriefing,
    clienteNome: neg.cliente.nome,
    clienteMunicipio: neg.cliente.municipio?.nome ?? null,
    clienteTelefone: neg.cliente.telefone,
    maquina,
    numero: neg.id.slice(-6).toUpperCase(),
  };
  return { dados, contexto, enviadaEm: neg.proposta?.enviadaEm?.toISOString() ?? null };
}

export async function salvarPropostaAction(negociacaoId: string, dados: DadosProposta): Promise<{ ok: boolean; erro?: string }> {
  const neg = await db.negociacao.findUnique({ where: { id: negociacaoId }, select: { id: true, clienteId: true } });
  if (!neg) return { ok: false, erro: "Negociação não encontrada." };
  const valor = JSON.stringify(dados);
  await db.proposta.upsert({ where: { negociacaoId }, update: { dados: valor }, create: { negociacaoId, dados: valor } });
  // Mantém a negociação coerente com a proposta (valor e entrada).
  await db.negociacao.update({
    where: { id: negociacaoId },
    data: { ...(dados.condicao.valor > 0 ? { valor: dados.condicao.valor } : {}), ...(dados.condicao.entradaValor > 0 ? { entradaValor: dados.condicao.entradaValor } : {}) },
  }).catch(() => {});
  revalidatePath(`/negociacoes/${negociacaoId}/proposta`);
  revalidatePath("/negociacoes");
  return { ok: true };
}

// O CRM não manda mais nada pela conversa (02/11): a tela abre o WhatsApp do
// celular com a legenda pronta e ele anexa o PDF lá. Isto só registra QUANDO
// ele foi mandar, para a negociação não perder a data — sem enviar nada.
export async function marcarPropostaEnviadaAction(negociacaoId: string): Promise<{ ok: boolean; erro?: string }> {
  const neg = await db.negociacao.findUnique({ where: { id: negociacaoId }, select: { clienteId: true, cliente: { select: { nome: true } } } });
  if (!neg) return { ok: false, erro: "Negociação não encontrada." };
  try {
    await db.proposta.update({ where: { negociacaoId }, data: { enviadaEm: new Date() } });
    await db.negociacao.update({ where: { id: negociacaoId }, data: { ultimoContato: new Date() } }).catch(() => {});
    await registrarAudit({ acao: "mensagem_enviada", origem: "usuario", descricao: `Proposta aberta no WhatsApp do celular para ${neg.cliente.nome}.`, entidade: "Negociacao", entidadeId: negociacaoId, clienteId: neg.clienteId }).catch(() => {});
    revalidatePath(`/negociacoes/${negociacaoId}/proposta`);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
