// Regras puras da volta do banco provisório para o principal (sem banco,
// testáveis). O motor que lê e grava está em lib/trazer-provisorio.ts.
//
// A situação: o banco principal (Neon) ficou suspenso e o CRM rodou uma
// semana num banco provisório (Supabase), que nasceu vazio. Nele o vendedor
// reimportou os clientes (com ids novos), recebeu conversas e criou
// negociações. Na volta, tudo isso tem de ser SOMADO ao principal:
//   - o que já existe lá (mesmo cliente, mesma conversa) não duplica — o id
//     do provisório passa a apontar para o do principal;
//   - o que é novo entra com o mesmo id, e por isso rodar de novo não traz
//     nada duas vezes;
//   - nada do que vem pode fazer o WhatsApp mandar mensagem sozinho, nem
//     afrouxar trava nenhuma (CLAUDE.md §3: o padrão nunca pode ser o que machuca).

import { chaveTelefone, telefoneEfetivo } from "@/lib/clientes-duplicados-regra";
import { chaveNome } from "@/lib/google-contatos-util";
import { chaveCanonicaTelefone } from "@/lib/whatsapp-routing";
import { lerHistorico, type Registro } from "@/lib/frase-dia-regra";

export type Linha = Record<string, unknown>;

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const data = (v: unknown): number => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" || typeof v === "number") {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
};
const vazio = (v: unknown) => v === null || v === undefined || (typeof v === "string" && !v.trim());

// ── Clientes ────────────────────────────────────────────────────────────────
// Mesmo cliente = mesmo contato do Google, ou mesmo telefone (em qualquer
// formato), ou mesmo nome quando um dos dois não tem telefone — a mesma regra
// da unificação de duplicados (lib/clientes-duplicados-regra.ts).

export function chavesDoClienteNoProvisorio(c: Linha): string[] {
  const chaves: string[] = [];
  const g = texto(c.googleContatoId);
  if (g) chaves.push(`g:${g}`);
  const tel = chaveTelefone(telefoneEfetivo({ nome: String(c.nome ?? ""), telefone: texto(c.telefone) }));
  if (tel) chaves.push(`t:${tel}`);
  const nome = chaveNome(String(c.nome ?? ""));
  // Sem telefone: casa com qualquer cadastro do mesmo nome. Com telefone: só
  // com cadastro do mesmo nome que NÃO tem telefone (nome igual com números
  // diferentes são pessoas diferentes).
  if (nome) chaves.push(tel ? `np:${nome}` : `n:${nome}`);
  return chaves;
}

// Índice chave → id do principal. Chave que aponta para mais de um cadastro
// é ambígua e não é usada: melhor trazer um cadastro a mais (que a unificação
// de duplicados junta depois, com desfazer) do que grudar em quem não é.
export function indiceDeClientes(principal: Linha[]): Map<string, string> {
  const vistos = new Map<string, string | null>();
  const por = (k: string, id: string) => {
    const atual = vistos.get(k);
    if (atual === undefined) vistos.set(k, id);
    else if (atual !== id) vistos.set(k, null);
  };
  for (const c of principal) {
    const id = String(c.id);
    const g = texto(c.googleContatoId);
    if (g) por(`g:${g}`, id);
    const tel = chaveTelefone(telefoneEfetivo({ nome: String(c.nome ?? ""), telefone: texto(c.telefone) }));
    if (tel) por(`t:${tel}`, id);
    const nome = chaveNome(String(c.nome ?? ""));
    if (nome) {
      por(`n:${nome}`, id);
      if (!tel) por(`np:${nome}`, id);
    }
  }
  const indice = new Map<string, string>();
  for (const [k, id] of vistos) if (id) indice.set(k, id);
  return indice;
}

// O que o cadastro do provisório acrescenta a quem já existe no principal.
// Nunca apaga nem troca o que o principal já tinha, com três exceções, todas
// no sentido de proteger: "não perturbe" marcado lá vale aqui (a pessoa pediu
// para sair da lista — perder isso é mandar campanha para quem respondeu
// SAIR); o contato mais recente vence; "já comprou" e "visitado" só ligam.
const CAMPOS_COMPLETAR = [
  "telefone", "email", "endereco", "municipioId", "perfilIA", "origem", "fotoUrl", "observacoes",
  "perfilDISC", "abordagemIA", "dataCompra", "maquinaComprada", "interesseFuturoData", "interesseFuturoNota",
  "proximaVisita", "proximaVisitaNota", "resumoMaquinas", "resumoValor", "resumoEntrada", "resumoCondicao",
  "resumoTexto", "googleContatoId", "googleSincronizadoEm", "dataNascimento", "dataNascimentoOrigem", "indicadoPorId",
] as const;

export function completarCliente(principal: Linha, provisorio: Linha): Linha {
  const patch: Linha = {};
  for (const campo of CAMPOS_COMPLETAR) {
    if (vazio(principal[campo]) && !vazio(provisorio[campo])) patch[campo] = provisorio[campo];
  }
  for (const campo of ["jaComprou", "visitado", "interesseFuturo"] as const) {
    if (provisorio[campo] === true && principal[campo] !== true) patch[campo] = true;
  }
  if (provisorio.naoPerturbe === true && principal.naoPerturbe !== true) {
    patch.naoPerturbe = true;
    patch.naoPerturbeEm = provisorio.naoPerturbeEm ?? null;
    patch.naoPerturbeMotivo = provisorio.naoPerturbeMotivo ?? null;
  }
  if (data(provisorio.ultimoContato) > data(principal.ultimoContato)) {
    patch.ultimoContato = provisorio.ultimoContato;
    patch.aguardandoResposta = provisorio.aguardandoResposta === true;
  }
  if (principal.status === "potencial" && texto(provisorio.status) && provisorio.status !== "potencial") {
    patch.status = provisorio.status;
  }
  return patch;
}

// ── Conversas do WhatsApp ───────────────────────────────────────────────────
// Mesma conversa = mesmo número (o principal tem o número como único). A
// chave canônica cobre o mesmo número escrito com e sem o 9º dígito.

export function chavesDaConversa(c: Linha): string[] {
  const tel = String(c.externalPhone ?? "");
  const chaves = [`e:${tel}`];
  if (c.isGroup !== true) {
    const canon = chaveCanonicaTelefone(tel);
    if (canon) chaves.push(`c:${canon}`);
  }
  return chaves;
}

export function completarConversa(principal: Linha, provisorio: Linha): Linha {
  const patch: Linha = {};
  for (const campo of ["clienteId", "contactName", "lid", "contactPhotoUrl", "category"] as const) {
    if (vazio(principal[campo]) && !vazio(provisorio[campo])) patch[campo] = provisorio[campo];
  }
  // Quem conversou por último decide se o assunto está encerrado.
  if (data(provisorio.lastMessageAt) > data(principal.lastMessageAt)) {
    patch.lastMessageAt = provisorio.lastMessageAt;
    patch.encerrada = provisorio.encerrada === true;
  }
  return patch;
}

// Conversa nova: sem a resposta automática agendada. Trazer centenas de
// conversas com o agendamento ligado faria o CRM analisar todas de uma vez
// (gasto de IA) logo depois da volta. A próxima mensagem agenda de novo.
export function tratarConversaNova(c: Linha): Linha {
  return { ...c, agnesScheduledAt: null };
}

// Mensagens: a mesma mensagem tem o mesmo id do WhatsApp; sem ele, o mesmo
// texto no mesmo instante, na mesma conversa e na mesma direção.
export function chaveDaMensagem(m: Linha): string {
  const zid = texto(m.zapiMessageId);
  if (zid) return `z:${zid}`;
  const quando = m.sentAt instanceof Date ? m.sentAt.toISOString() : String(m.sentAt ?? "");
  return `m:${m.conversationId}|${m.direction}|${quando}|${String(m.body ?? "").slice(0, 200)}`;
}

// Mensagem que falhou ao sair seria reenviada pela rotina de nova tentativa
// (pega FAILED com menos de 3 tentativas). Vinda do provisório, ela chega com
// as tentativas esgotadas: continua visível, e não sai sozinha.
export function tratarMensagem(m: Linha): Linha {
  if (m.direction === "OUT" && m.sendStatus === "FAILED" && Number(m.retryCount ?? 0) < 3) {
    return { ...m, retryCount: 3 };
  }
  return m;
}

// Envio em massa que ainda ia sair (ou estava saindo) chega CANCELADO. A lista
// continua lá para ele ver e, se quiser, programar de novo.
export const AVISO_ENVIO_CANCELADO = "Veio do banco provisório na volta para o principal e foi cancelado — não sai sozinho.";
export function tratarEnvio(e: Linha): Linha {
  if (e.status === "pendente" || e.status === "enviando") return { ...e, status: "cancelado", erro: AVISO_ENVIO_CANCELADO };
  return e;
}

// ── Configurações ───────────────────────────────────────────────────────────
// Só entra chave que o principal NÃO tem — o que ele configurou lá vale. E
// algumas nunca vêm: as travas (envio do WhatsApp e IA paga) nascem no lado
// seguro e só ele muda, na tela; marcas de manutenção e contadores do dia são
// de cada banco.
const CONFIG_NUNCA = [
  "whatsapp.pausa.", "ia.somente_gratuitos", "manutencao.", "provisorio.", "zeus.ia_usada.",
  "autofix.cota", "whatsapp.vigia", "whatsapp.qr.", "diag.", "orientador.analises.", "limpeza.bloqueio.",
];
export function configPodeVir(chave: string): boolean {
  return !CONFIG_NUNCA.some((p) => chave === p || chave.startsWith(p));
}

// O histórico da motivação do dia é o que impede a mesma mensagem de voltar.
// Os dois bancos têm uma parte dele: junta os dois, em ordem de data.
export const CHAVE_HISTORICO_FRASE = "frase_dia.historico";
export function juntarHistoricoFrase(principal: string | null, provisorio: string | null, max = 400): string {
  const ler = (s: string | null): Registro[] => {
    try { return lerHistorico(JSON.parse(s ?? "[]")); } catch { return []; }
  };
  const todos = [...ler(principal), ...ler(provisorio)];
  const vistos = new Set<string>();
  const unicos = todos.filter((r) => {
    const k = `${r.d ?? ""}|${r.f}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  unicos.sort((a, b) => (a.d ?? "").localeCompare(b.d ?? ""));
  return JSON.stringify(unicos.slice(-max));
}

// ── Os dois endereços ───────────────────────────────────────────────────────
// Nunca mostramos o endereço (tem senha dentro). Só o suficiente para saber
// se os dois são o mesmo banco e de que provedor é cada um.

function partes(url: string | undefined | null): { host: string; banco: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return { host: u.hostname.replace("-pooler.", ".").toLowerCase(), banco: u.pathname.replace(/^\//, "") || "postgres" };
  } catch {
    return null;
  }
}

export function mesmoBanco(a: string | undefined | null, b: string | undefined | null): boolean {
  const pa = partes(a), pb = partes(b);
  return !!pa && !!pb && pa.host === pb.host && pa.banco === pb.banco;
}

export function provedorDoEndereco(url: string | undefined | null): string {
  const p = partes(url);
  if (!p) return "desconhecido";
  if (p.host.endsWith("neon.tech")) return "Neon";
  if (p.host.includes("supabase")) return "Supabase";
  if (p.host === "localhost" || p.host === "127.0.0.1") return "local";
  return "outro provedor";
}
