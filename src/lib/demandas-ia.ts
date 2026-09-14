// Demanda por áudio (ou frase solta): a IA lê o recado do vendedor e monta a
// demanda com título, data, cliente, cidade e prioridade. Usada pela rota
// /api/demandas/audio (que transcreve antes) e pode receber texto direto.

import { db } from "@/lib/db";
import { llmTexto } from "@/lib/ai";

export type DemandaInterpretada = {
  titulo: string;
  descricao: string | null;
  data: string | null;      // AAAA-MM-DD
  cliente: string | null;
  cidade: string | null;
  prioridade: "alta" | "normal" | "baixa";
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function hojeBrasilia(): { iso: string; extenso: string } {
  const agora = new Date();
  const iso = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  const extenso = agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  return { iso, extenso };
}

export async function interpretarDemanda(texto: string, nomesClientes: string[]): Promise<DemandaInterpretada> {
  const hoje = hojeBrasilia();
  const system = `Você transforma um recado falado por um vendedor de máquinas pesadas (Espírito Santo) em UMA demanda (tarefa).
Hoje é ${hoje.extenso} (${hoje.iso}). Devolva SOMENTE um JSON válido:
{
  "titulo": string,            // curto e imperativo, até 80 caracteres, sem a data dentro (ex.: "Entregar óleo 68 no Adrian Radael")
  "descricao": string|null,    // detalhes que não couberam no título; null se não houver
  "data": "AAAA-MM-DD"|null,   // resolva "amanhã", "sexta", "semana que vem", "dia 20"; null se não citou data
  "cliente": string|null,      // nome do cliente citado; se bater com um da lista, use EXATAMENTE o nome da lista
  "cidade": string|null,       // cidade citada, se houver
  "prioridade": "alta"|"normal"|"baixa"  // alta se disse urgente/hoje/importante; baixa se disse "quando der"
}
Não invente nada que não foi dito. Se a fala tiver várias coisas, escolha a principal e ponha o resto em descricao.
Clientes cadastrados (para bater o nome): ${nomesClientes.slice(0, 400).join("; ") || "(nenhum)"}`;
  const raw = await llmTexto(system, texto, { maxTokens: 400, json: true });
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const p = JSON.parse(json) as Partial<DemandaInterpretada>;
  const data = typeof p.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.data) ? p.data : null;
  return {
    titulo: (typeof p.titulo === "string" && p.titulo.trim()) ? p.titulo.trim().slice(0, 160) : texto.trim().slice(0, 160),
    descricao: typeof p.descricao === "string" && p.descricao.trim() ? p.descricao.trim() : null,
    data,
    cliente: typeof p.cliente === "string" && p.cliente.trim() ? p.cliente.trim() : null,
    cidade: typeof p.cidade === "string" && p.cidade.trim() ? p.cidade.trim() : null,
    prioridade: p.prioridade === "alta" || p.prioridade === "baixa" ? p.prioridade : "normal",
  };
}

// Interpreta e grava. Devolve o que foi criado para a tela confirmar.
export async function criarDemandaPorTexto(texto: string): Promise<{ id: string; titulo: string; quando: string; clienteNome: string | null; cidade: string | null; prioridade: string }> {
  const clientes = await db.cliente.findMany({ select: { id: true, nome: true }, orderBy: { ultimoContato: "desc" }, take: 400 });
  const d = await interpretarDemanda(texto, clientes.map((c) => c.nome));

  let cliente: { id: string; nome: string } | null = null;
  if (d.cliente) {
    const alvo = semAcento(d.cliente);
    cliente = clientes.find((c) => semAcento(c.nome) === alvo)
      ?? clientes.find((c) => semAcento(c.nome).includes(alvo) || alvo.includes(semAcento(c.nome)))
      ?? null;
  }
  const dueDate = d.data ? new Date(`${d.data}T00:00:00-03:00`) : null;
  const descricao = [d.descricao, !cliente && d.cliente ? `Cliente citado: ${d.cliente}` : null, `Recado: "${texto.trim().slice(0, 300)}"`].filter(Boolean).join("\n");
  const t = await db.tarefaKanban.create({
    data: {
      titulo: d.titulo, descricao, clienteId: cliente?.id ?? null, cidade: d.cidade, dueDate, prioridade: d.prioridade,
      origem: "audio", coluna: "demandas",
    },
  });
  const quando = dueDate ? dueDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }) : "sem prazo";
  return { id: t.id, titulo: t.titulo, quando, clienteNome: cliente?.nome ?? null, cidade: d.cidade, prioridade: d.prioridade };
}
