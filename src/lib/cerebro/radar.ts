// Radar de inovação: toda noite o Cérebro sai pelo mundo procurando o que
// existe de novo que possa deixar cada sessão do CRM melhor — layout,
// integração, IA de texto/imagem/vídeo, jeito novo de vender. Devolve uma
// relação com a melhoria, o benefício para o vendedor e o tamanho do ganho.
//
// Usa o Gemini com busca (grounding) quando a chave está configurada; sem
// busca, ainda funciona com o conhecimento do modelo. Sem nenhuma chave de
// IA, o radar simplesmente não roda (e diz isso na tela).

import { db } from "@/lib/db";
import { GEMINI_MODELOS_CHAT } from "@/lib/ai/config";
import { gerarConteudoGemini } from "@/lib/ai/gemini-modelos";
import { llmTexto, iaHabilitada } from "@/lib/ai";
import { SESSOES } from "@/lib/cerebro/sessoes";
import { lerParametros } from "@/lib/parametros";

export type IdeiaRadar = {
  id: string;
  criadoEm: string;
  sessao: string;
  sessaoNome: string;
  titulo: string;
  melhoria: string;
  beneficio: string;
  ganho: string;
  esforco: "baixo" | "medio" | "alto";
  fonte: string | null;
  status: "nova" | "aplicar" | "aplicada" | "descartada";
};

const ESFORCOS = ["baixo", "medio", "alto"] as const;

function instrucao(nomeVendedor: string, marcas: string): string {
  return `Você é o setor de inovação do CRM de ${nomeVendedor}, vendedor de máquinas pesadas (${marcas}) no sul do Espírito Santo.
Sua missão: vasculhar o que existe HOJE no mundo — ferramentas, integrações, modelos de IA (texto, imagem, vídeo, voz),
padrões de interface, práticas de venda B2B — e propor melhorias CONCRETAS para as sessões deste CRM.

Sessões do CRM (use o id exatamente como está):
${SESSOES.map((s) => `- ${s.id}: ${s.nome} — ${s.papel}`).join("\n")}

Regras:
- Proponha só o que dá para implementar num app Next.js hospedado de graça (Vercel Hobby, Postgres Neon, Evolution API no WhatsApp).
- Prefira o que é gratuito ou tem camada gratuita de verdade. Se custar, diga quanto.
- Nada de ideia genérica ("usar IA", "melhorar a UX"). Cada ideia precisa dizer O QUE muda na tela ou no fluxo.
- Nunca invente produto, preço ou recurso que não existe. Se não tiver certeza da fonte, deixe "fonte" como null.
- Responda em português do Brasil, sem emojis.

Devolva SOMENTE um JSON válido:
{"ideias":[{"sessao":"<id da sessão>","titulo":"<curto e direto>","melhoria":"<o que muda no CRM, em 1-2 frases>","beneficio":"<o que o vendedor ganha na prática>","ganho":"<tamanho do ganho: tempo economizado, mais conversão, menos erro>","esforco":"baixo|medio|alto","fonte":"<url ou null>"}]}
Traga de 4 a 8 ideias, cada uma de uma sessão diferente sempre que possível.`;
}

// Gemini com busca do Google (grounding). Se a busca não estiver disponível
// para a chave, a própria API responde sem ela — e o resultado continua útil.
async function pesquisarComGemini(system: string, pedido: string): Promise<string> {
  // Lista do CHAT (Flash primeiro): a busca do Google pede o modelo mais
  // capaz, e o radar roda uma vez por dia — a cota pesa pouco aqui.
  const { data } = await gerarConteudoGemini(GEMINI_MODELOS_CHAT, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: pedido }] }],
    tools: [{ google_search: {} }],
    generationConfig: { maxOutputTokens: 3000, temperature: 0.6 },
  }, { timeoutMs: 55_000 });
  const d = data as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return d.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

function extrairIdeias(raw: string): Omit<IdeiaRadar, "id" | "criadoEm" | "sessaoNome" | "status">[] {
  const ini = raw.indexOf("{");
  const fim = raw.lastIndexOf("}");
  if (ini === -1 || fim === -1) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(ini, fim + 1));
  } catch {
    return [];
  }
  const lista = (parsed as { ideias?: unknown }).ideias;
  if (!Array.isArray(lista)) return [];
  const idsValidos = new Set(SESSOES.map((s) => s.id));
  const texto = (v: unknown, max = 400): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

  return lista
    .map((i) => {
      const o = i as Record<string, unknown>;
      const sessao = texto(o.sessao, 40);
      const esforco = ESFORCOS.includes(texto(o.esforco, 10) as (typeof ESFORCOS)[number]) ? (texto(o.esforco, 10) as IdeiaRadar["esforco"]) : "medio";
      const fonte = texto(o.fonte, 300);
      return {
        sessao: idsValidos.has(sessao) ? sessao : "crm",
        titulo: texto(o.titulo, 120),
        melhoria: texto(o.melhoria),
        beneficio: texto(o.beneficio),
        ganho: texto(o.ganho, 200),
        esforco,
        fonte: fonte.startsWith("http") ? fonte : null,
      };
    })
    .filter((i) => i.titulo && i.melhoria && i.beneficio);
}

// Uma rodada do radar. Devolve quantas ideias novas entraram.
export async function rodarRadarInovacao(): Promise<{ ok: boolean; novas: number; erro?: string }> {
  if (!iaHabilitada()) return { ok: false, novas: 0, erro: "Nenhuma chave de IA configurada." };
  const p = await lerParametros();
  const system = instrucao(p.nomeVendedor, p.marcas);

  // Não repetir o que já foi proposto: manda os títulos recentes junto.
  const recentes = await db.ideiaInovacao.findMany({
    orderBy: { criadoEm: "desc" }, take: 40, select: { titulo: true },
  }).catch(() => [] as { titulo: string }[]);
  const pedido = [
    `Data de hoje: ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
    "Procure novidades REAIS e recentes (ferramentas, APIs, modelos, integrações, padrões de interface) que sirvam para este CRM.",
    recentes.length ? `Já foram propostas antes (não repita): ${recentes.map((r) => r.titulo).join("; ")}.` : "",
  ].filter(Boolean).join("\n");

  let raw = "";
  try {
    raw = process.env.GEMINI_API_KEY
      ? await pesquisarComGemini(system, pedido)
      : await llmTexto(system, pedido, { maxTokens: 3000, json: true });
  } catch (e) {
    // Gemini com busca indisponível: tenta o caminho normal (qualquer provedor).
    try {
      raw = await llmTexto(system, pedido, { maxTokens: 3000, json: true });
    } catch (e2) {
      return { ok: false, novas: 0, erro: (e2 instanceof Error ? e2.message : String(e2)).slice(0, 200) };
    }
    void e;
  }

  const ideias = extrairIdeias(raw);
  if (!ideias.length) return { ok: false, novas: 0, erro: "A pesquisa não voltou nenhuma ideia aproveitável." };

  // Não grava título repetido (a IA às vezes insiste na mesma ideia).
  const jaTem = new Set(recentes.map((r) => r.titulo.toLowerCase()));
  const novas = ideias.filter((i) => !jaTem.has(i.titulo.toLowerCase()));
  if (novas.length) {
    await db.ideiaInovacao.createMany({
      data: novas.map((i) => ({
        sessao: i.sessao, titulo: i.titulo, melhoria: i.melhoria,
        beneficio: i.beneficio, ganho: i.ganho, esforco: i.esforco, fonte: i.fonte,
      })),
    });
  }
  return { ok: true, novas: novas.length };
}

export async function listarIdeias(status?: IdeiaRadar["status"], limite = 60): Promise<IdeiaRadar[]> {
  const linhas = await db.ideiaInovacao.findMany({
    where: status ? { status } : {},
    orderBy: { criadoEm: "desc" },
    take: limite,
  });
  const nome = new Map(SESSOES.map((s) => [s.id, s.nome]));
  return linhas.map((l) => ({
    id: l.id,
    criadoEm: l.criadoEm.toISOString(),
    sessao: l.sessao,
    sessaoNome: nome.get(l.sessao) ?? "CRM (geral)",
    titulo: l.titulo,
    melhoria: l.melhoria,
    beneficio: l.beneficio,
    ganho: l.ganho,
    esforco: (ESFORCOS.includes(l.esforco as (typeof ESFORCOS)[number]) ? l.esforco : "medio") as IdeiaRadar["esforco"],
    fonte: l.fonte,
    status: l.status as IdeiaRadar["status"],
  }));
}

export async function definirStatusIdeia(id: string, status: IdeiaRadar["status"]): Promise<void> {
  await db.ideiaInovacao.update({ where: { id }, data: { status } });
}
