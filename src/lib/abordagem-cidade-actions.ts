"use server";

// Abordagem por cidade (tela de Visitas): lista os clientes de uma cidade,
// gera (ou aceita) um texto e manda pelo WhatsApp para todos, para fechar
// visitas na semana seguinte. O envio reaproveita enviarResposta — a mensagem
// entra na conversa do Atendimento e a resposta do cliente continua a thread.

import { db } from "@/lib/db";
import { llmTexto, iaHabilitada } from "@/lib/ai";
import { enviarResposta } from "@/lib/actions";
import { semCodigoPais, diasDesde } from "@/lib/utils";
import { personalizarTexto, modeloAbordagemPadrao, periodoSemanaQueVem } from "@/lib/abordagem-cidade-regra";

export type ClienteAbordagem = {
  id: string;
  nome: string;
  telefone: string | null;
  visitado: boolean;
  status: string;
  diasSemContato: number | null;
  ultimaVisita: string | null; // dd/mm/aaaa
};

export async function listarClientesDaCidadeAction(municipioId: string): Promise<{ cidade: string; clientes: ClienteAbordagem[] }> {
  const municipio = await db.municipio.findUnique({ where: { id: municipioId }, select: { nome: true } });
  if (!municipio) return { cidade: "", clientes: [] };
  const rows = await db.cliente.findMany({
    where: { municipioId, origem: { not: "prospect_ia" } },
    select: {
      id: true, nome: true, telefone: true, visitado: true, status: true, ultimoContato: true,
      visitas: { where: { status: "realizada" }, orderBy: { data: "desc" }, take: 1, select: { data: true } },
    },
    orderBy: { nome: "asc" },
  });
  return {
    cidade: municipio.nome,
    clientes: rows.map((c) => ({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone ? semCodigoPais(c.telefone) : null,
      visitado: c.visitado,
      status: c.status,
      diasSemContato: c.ultimoContato ? diasDesde(c.ultimoContato) : null,
      ultimaVisita: c.visitas[0] ? c.visitas[0].data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null,
    })),
  };
}

export async function gerarTextoAbordagemAction(cidade: string): Promise<{ texto: string; geradoPorIA: boolean }> {
  const periodo = periodoSemanaQueVem();
  const padrao = modeloAbordagemPadrao(cidade, periodo);
  if (!iaHabilitada()) return { texto: padrao, geradoPorIA: false };
  try {
    const texto = await llmTexto(
      `Você escreve mensagens de WhatsApp para o Edy, vendedor de máquinas pesadas (New Holland Construction e Dynapac) no sul do Espírito Santo.
Ele vai estar em ${cidade} ${periodo} e quer marcar visitas com clientes de lá.
Escreva UMA mensagem curta (3 a 5 frases), tom simples e próximo, como quem já conhece o cliente, sem parecer propaganda.
Use exatamente "{nome}" onde entra o primeiro nome do cliente (uma vez, na saudação).
Diga que ele vai estar na cidade ${periodo}, ofereça passar lá para conversar sobre máquinas/operação e termine perguntando qual dia fica melhor.
Sem emojis em excesso (no máximo um), sem título, sem aspas, sem assinatura além do nome Edy. Devolva só a mensagem.`,
      `Cidade: ${cidade}. Período: ${periodo}.`,
      { maxTokens: 300 }
    );
    const limpo = texto.trim().replace(/^["“]|["”]$/g, "");
    if (!limpo || !/\{nome\}/i.test(limpo)) return { texto: padrao, geradoPorIA: false };
    return { texto: limpo, geradoPorIA: true };
  } catch (e) {
    console.error("[abordagem-cidade] IA falhou, usando modelo padrão:", e instanceof Error ? e.message : e);
    return { texto: padrao, geradoPorIA: false };
  }
}

export type ResultadoEnvioAbordagem = { enviados: string[]; falhas: { id: string; nome: string; erro: string }[] };

// Manda para um LOTE de clientes (a tela chama em lotes pequenos). Cada um
// recebe o texto com o próprio nome. Uma pausa curta entre envios, para não
// parecer disparo automático para o WhatsApp.
export async function enviarAbordagemAction(clienteIds: string[], texto: string): Promise<ResultadoEnvioAbordagem> {
  const base = texto.trim();
  const r: ResultadoEnvioAbordagem = { enviados: [], falhas: [] };
  if (!base) return r;
  const ids = Array.from(new Set(clienteIds)).slice(0, 5);
  const clientes = await db.cliente.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } });
  const porId = new Map(clientes.map((c) => [c.id, c]));
  for (let i = 0; i < ids.length; i++) {
    const c = porId.get(ids[i]);
    if (!c) { r.falhas.push({ id: ids[i], nome: ids[i], erro: "Cliente não encontrado." }); continue; }
    try {
      const res = await enviarResposta(c.id, personalizarTexto(base, c.nome));
      if (res.ok) r.enviados.push(c.id);
      else r.falhas.push({ id: c.id, nome: c.nome, erro: res.erro ?? "Falha ao enviar." });
    } catch (e) {
      r.falhas.push({ id: c.id, nome: c.nome, erro: e instanceof Error ? e.message : String(e) });
    }
    if (i < ids.length - 1) await new Promise((ok) => setTimeout(ok, 700));
  }
  return r;
}
