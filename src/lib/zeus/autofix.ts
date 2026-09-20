// Autoconserto: quando o ZEUS detecta uma falha, abre um chamado no GitHub e
// o Claude Code entra, diagnostica, corrige e abre um Pull Request.
//
// Como funciona, de ponta a ponta:
//   1. algo quebra no CRM  ->  zeusReport()  ->  registrarZeusEvent()
//   2. se for a PRIMEIRA vez daquele erro, esta camada abre uma issue no
//      repositório com a etiqueta "zeus-falha"
//   3. .github/workflows/zeus-autofix.yml acorda com a issue e roda o Claude
//   4. o Claude devolve um Pull Request; quem decide se entra é você
//
// Por que só na primeira vez: registrarZeusEvent já junta repetição no mesmo
// ZeusEvent (campo "ocorrencias"). O mesmo erro pipocando mil vezes — cota de
// IA estourada, Evolution fora do ar — é UMA falha, não mil. Sem isso, um erro
// em laço abriria centenas de issues em minutos.
//
// REGRA DE OURO DESTE ARQUIVO: nada aqui pode derrubar o CRM. Abrir chamado é
// acessório; se falhar, falha calado no log. O usuário não pode perder uma
// mensagem de WhatsApp porque o GitHub estava fora do ar.

import { db } from "@/lib/db";

const ETIQUETA = "zeus-falha";
const CHAVE_COTA = "autofix.cota";
const TIMEOUT_MS = 8_000;

/** Teto diário de chamados. Válvula de segurança contra erro em laço. */
export const TETO_DIARIO = Number(process.env.ZEUS_AUTOFIX_MAX_DIA ?? 20);

export function autofixHabilitado(): boolean {
  return !!process.env.ZEUS_AUTOFIX_TOKEN && !!process.env.ZEUS_AUTOFIX_REPO;
}

// ── Limpeza do que vai para o GitHub ────────────────────────────────────────
//
// A issue é pública para quem tem acesso ao repositório, e o texto vem de
// stack trace e de detalhe de erro — onde cabe de tudo: chave de API, token,
// string de conexão do banco, telefone de cliente. Nada disso pode viajar.
// A lista é propositalmente exagerada: apagar demais só atrapalha a leitura,
// apagar de menos vaza credencial.
const SEGREDOS: [RegExp, string][] = [
  [/\b(sk|rk)-[A-Za-z0-9_-]{16,}/g, "[chave removida]"],
  [/\bAIza[A-Za-z0-9_-]{20,}/g, "[chave Google removida]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "[token GitHub removido]"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, "[token removido]"],
  // O (?!\[) impede esta regra de reprocessar o que as de cima já limparam:
  // sem ele, "API_KEY=[chave Google removida]" virava
  // "API_KEY: [removido] Google removida]" — a chave saía, mas o texto ficava
  // mastigado e ninguém entendia mais o erro.
  // Esta linha é feia porque cada pedaço dela tapa um vazamento que o teste
  // pegou de verdade:
  //   "? antes e depois do [:=] — o detalhe do erro é gravado como JSON
  //     (registrarZeusEvent faz JSON.stringify), então a forma mais comum não é
  //     `apiKey=x` e sim `{"apiKey":"x"}`. Sem as aspas, a mais provável de
  //     todas escapava inteira.
  //   (?:bearer|basic|token)\s+ — "Authorization: Bearer xyz" deixava o xyz
  //     passar, porque o \S+ casava com a palavra "Bearer" e parava ali.
  //   [^"\s,}]+ em vez de \S+ — para parar na aspa de fechamento e não engolir
  //     o resto do JSON.
  //
  // O (?!\[) impede esta regra de reprocessar o que as de cima já limparam:
  // sem ele, "API_KEY=[chave Google removida]" virava
  // "API_KEY: [removido] Google removida]" — a chave saía, mas o texto ficava
  // mastigado e ninguém entendia mais o erro.
  [/(bearer|authorization|api[_-]?key|token|secret|senha|password)"?\s*[:=]\s*"?(?!\[)(?:(?:bearer|basic|token)\s+)?[^"\s,}]+/gi, "$1: [removido]"],
  [/\b[a-z]+:\/\/[^\s:@/]+:[^\s@/]+@/gi, "[conexão removida]@"],
  [/\b\d{10,13}@[cs]\.us\b/g, "[telefone removido]"],
  [/\b(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, "[telefone removido]"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[e-mail removido]"],
];

/** Tira credencial e dado pessoal de qualquer texto que vá para o GitHub. */
export function redigir(texto: string): string {
  let t = texto;
  for (const [re, por] of SEGREDOS) t = t.replace(re, por);
  return t;
}

/**
 * Assinatura estável da falha: o mesmo defeito, com ids e números diferentes,
 * tem de virar o MESMO chamado. Sem isso, "Erro no cliente cmu9pfk39…" e
 * "Erro no cliente cmxyz12…" pareceriam dois problemas.
 */
export function assinaturaFalha(titulo: string): string {
  return titulo
    .replace(/\b[0-9a-f]{16,}\b/gi, "<id>")
    .replace(/\bc[a-z0-9]{20,}\b/gi, "<id>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export type FalhaZeus = {
  titulo: string;
  severidade: string;
  contexto?: string | null;
  mensagem?: string | null;
  stack?: string | null;
  ocorrencias?: number;
};

/** Título da issue — curto, e igual para a mesma falha. */
export function tituloDoChamado(f: FalhaZeus): string {
  return `[ZEUS] ${redigir(f.titulo).slice(0, 120)}`;
}

/**
 * Corpo da issue: o que o Claude precisa para consertar sem adivinhar, e nada
 * além disso. Tudo passa pela limpeza antes.
 */
export function corpoDoChamado(f: FalhaZeus): string {
  const partes = [
    "O ZEUS detectou uma falha em produção no CRM e abriu este chamado sozinho.",
    "",
    `**Onde:** ${redigir(f.contexto ?? "não informado")}`,
    `**Severidade:** ${f.severidade}`,
    `**Vezes que aconteceu:** ${f.ocorrencias ?? 1}`,
    `**Assinatura:** \`${assinaturaFalha(f.titulo)}\``,
    "",
    "**Mensagem do erro**",
    "```",
    redigir((f.mensagem ?? f.titulo).slice(0, 1500)),
    "```",
  ];
  if (f.stack?.trim()) {
    partes.push("", "**Pilha**", "```", redigir(f.stack.slice(0, 3000)), "```");
  }
  partes.push(
    "",
    "---",
    "**O que fazer:** achar a causa raiz, corrigir, cobrir com teste e abrir um Pull Request.",
    "Não publique direto na produção — quem decide o merge é o dono do CRM.",
    "",
    "_Texto gerado automaticamente. Credenciais, telefones e e-mails foram removidos antes de chegar aqui._",
  );
  return partes.join("\n");
}

/**
 * Cota do dia. Mesmo com "todo erro na hora", um erro em laço não pode abrir
 * chamado sem fim — nem encher o repositório, nem gastar execução de workflow.
 * Guardada em Configuracao para valer entre os servidores sem servidor da
 * Vercel, que não compartilham memória.
 */
async function consumirCota(): Promise<boolean> {
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    const atual = await db.configuracao.findUnique({ where: { chave: CHAVE_COTA } });
    const [dia, qtdTexto] = (atual?.valor ?? "").split("|");
    const qtd = dia === hoje ? Number(qtdTexto) || 0 : 0;
    if (qtd >= TETO_DIARIO) return false;
    await db.configuracao.upsert({
      where: { chave: CHAVE_COTA },
      create: { chave: CHAVE_COTA, valor: `${hoje}|1` },
      update: { valor: `${hoje}|${qtd + 1}` },
    });
    return true;
  } catch (e) {
    // Sem conseguir contar, não arrisca: melhor não abrir do que abrir sem teto.
    console.error("[autofix] cota:", e);
    return false;
  }
}

async function gh(caminho: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com/repos/${process.env.ZEUS_AUTOFIX_REPO}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.ZEUS_AUTOFIX_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * Já existe chamado aberto para esta mesma falha? A assinatura vai no corpo
 * justamente para dar essa busca — dois chamados do mesmo defeito viram dois
 * PRs conflitantes.
 */
async function jaTemChamado(assinatura: string): Promise<boolean> {
  const r = await gh(`/issues?state=open&labels=${ETIQUETA}&per_page=100`);
  if (!r.ok) return false;
  const issues = (await r.json()) as { body?: string }[];
  return issues.some((i) => (i.body ?? "").includes(`\`${assinatura}\``));
}

/**
 * Abre o chamado. Nunca lança: devolve o motivo de não ter aberto, para o log.
 */
export async function abrirChamadoDeFalha(f: FalhaZeus): Promise<{ aberto: boolean; motivo?: string; url?: string }> {
  if (!autofixHabilitado()) return { aberto: false, motivo: "desligado (falta ZEUS_AUTOFIX_TOKEN/REPO)" };
  try {
    const assinatura = assinaturaFalha(f.titulo);
    if (await jaTemChamado(assinatura)) return { aberto: false, motivo: "já existe chamado aberto para esta falha" };
    if (!(await consumirCota())) return { aberto: false, motivo: `teto de ${TETO_DIARIO} chamados por dia atingido` };

    const r = await gh("/issues", {
      method: "POST",
      body: JSON.stringify({ title: tituloDoChamado(f), body: corpoDoChamado(f), labels: [ETIQUETA] }),
    });
    if (!r.ok) {
      return { aberto: false, motivo: `GitHub respondeu ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}` };
    }
    const issue = (await r.json()) as { html_url?: string };
    console.warn("[autofix] chamado aberto:", issue.html_url);
    return { aberto: true, url: issue.html_url };
  } catch (e) {
    return { aberto: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
