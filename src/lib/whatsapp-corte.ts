// Exclusão definitiva e data de corte das conversas de WhatsApp (servidor).
// As regras puras ficam em whatsapp-corte-regra.ts.

import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";
import { limiteMensagens, limiteImportacao, ultimaExclusaoQueVale, mensagemAntiga, inicioDoDiaBrasilia } from "@/lib/whatsapp-corte-regra";

export const CHAVE_DATA_CORTE = "whatsapp.dataCorte";
const CACHE_MS = 30_000;
let cacheCorte: { valor: Date | null; em: number } | null = null;

export async function dataCorteWhatsApp(): Promise<Date | null> {
  if (cacheCorte && Date.now() - cacheCorte.em < CACHE_MS) return cacheCorte.valor;
  const raw = await getConfig(CHAVE_DATA_CORTE).catch(() => null);
  const d = raw ? new Date(raw) : null;
  const valor = d && !isNaN(d.getTime()) ? d : null;
  cacheCorte = { valor, em: Date.now() };
  return valor;
}

export async function definirDataCorte(data: Date | null): Promise<void> {
  if (data) await setConfig(CHAVE_DATA_CORTE, data.toISOString());
  else await db.configuracao.deleteMany({ where: { chave: CHAVE_DATA_CORTE } });
  cacheCorte = null;
}

function chavesTelefone(phone: string, lid?: string | null): string[] {
  const chaves = new Set<string>();
  if (phone.startsWith("imp:")) return [phone];
  const digitos = phone.replace(/\D/g, "");
  if (digitos) chaves.add(digitos);
  else if (phone) chaves.add(phone);
  if (lid) chaves.add(lid);
  return Array.from(chaves);
}

export async function registrarExclusaoConversa(
  conv: { externalPhone: string; lid?: string | null },
  quando = new Date(),
  motivo: "manual" | "corte" = "manual",
): Promise<void> {
  const chaves = chavesTelefone(conv.externalPhone, conv.lid);
  if (!chaves.length) return;
  await Promise.all(chaves.map((telefone) =>
    db.conversaExcluida.upsert({
      where: { telefone },
      update: { excluidaEm: quando, motivo },
      create: { telefone, excluidaEm: quando, motivo },
    }),
  ));
}

/**
 * Telefones que o vendedor apagou À MÃO (motivo "manual"), em um Set pronto
 * para consulta. Não entram as exclusões feitas pela data de corte: aquelas
 * são limpeza automática de histórico velho, não uma decisão dele.
 *
 * Uma consulta só, e o casamento é por VARIANTE do número — a conversa pode
 * ter voltado gravada com o 9º dígito diferente de como foi apagada.
 */
export async function telefonesApagadosPeloVendedor(): Promise<Set<string>> {
  const rows = await db.conversaExcluida.findMany({ where: { motivo: "manual" }, select: { telefone: true } });
  const set = new Set<string>();
  for (const r of rows) {
    set.add(r.telefone);
    for (const v of phoneLookupVariants(r.telefone)) set.add(v);
  }
  return set;
}

/** Este telefone está na lista dos apagados à mão? */
export function foiApagadoPeloVendedor(phone: string, apagados: Set<string>): boolean {
  if (!apagados.size) return false;
  if (apagados.has(phone)) return true;
  return phoneLookupVariants(phone).some((v) => apagados.has(v));
}

// Momento da última exclusão desta conversa (por telefone ou lid), se houve.
// Com `ignorarCorte`, as exclusões feitas pela data de corte não contam (o
// vendedor está importando de antes do corte e quer essas conversas de volta).
export async function excluidaEm(phone: string, lid?: string | null, ignorarCorte = false): Promise<Date | null> {
  const chaves = new Set<string>(chavesTelefone(phone, lid));
  for (const v of phoneLookupVariants(phone)) chaves.add(v);
  if (!chaves.size) return null;
  const rows = await db.conversaExcluida.findMany({ where: { telefone: { in: Array.from(chaves) } }, select: { excluidaEm: true, motivo: true } });
  return ultimaExclusaoQueVale(rows, ignorarCorte);
}

// Data a partir da qual mensagens deste contato entram no CRM (corte global
// ou exclusão da conversa, o que for mais recente). null = tudo entra.
export async function limiteMensagensContato(phone: string, lid?: string | null): Promise<Date | null> {
  const [corte, exclusao] = await Promise.all([dataCorteWhatsApp(), excluidaEm(phone, lid)]);
  return limiteMensagens(corte, exclusao);
}

// Mesma coisa para a importação de histórico com "a partir de" escolhido pelo
// vendedor: a data dele manda, e o corte automático não barra o que ele pediu.
export async function limiteImportacaoContato(phone: string, desde: Date | null): Promise<Date | null> {
  const [corte, exclusao] = await Promise.all([dataCorteWhatsApp(), excluidaEm(phone, null, desde !== null)]);
  return limiteImportacao(desde, corte, exclusao);
}

export { mensagemAntiga };

// Depois de apagar conversas: se o cliente não tem mais nenhuma, os alertas
// dele não fazem sentido e ele sai do "aguardando resposta".
export async function limparRastroDeClientes(clienteIds: string[]): Promise<void> {
  const ids = Array.from(new Set(clienteIds.filter(Boolean)));
  if (!ids.length) return;
  const comConversa = await db.whatsAppConversation.findMany({ where: { clienteId: { in: ids } }, select: { clienteId: true }, distinct: ["clienteId"] });
  const ainda = new Set(comConversa.map((c) => c.clienteId));
  const semConversa = ids.filter((id) => !ainda.has(id));
  if (!semConversa.length) return;
  await db.alerta.updateMany({ where: { clienteId: { in: semConversa }, resolvido: false }, data: { resolvido: true } }).catch(() => {});
  await db.cliente.updateMany({ where: { id: { in: semConversa } }, data: { aguardandoResposta: false } }).catch(() => {});
}

// Primeira execução (manutenção v24): fixa o corte em 16/09/2026 e apaga o
// que é anterior. Depois disso a data só muda pela tela de Configurações.
export const DATA_CORTE_INICIAL = "2026-09-16";

export async function aplicarCorteInicialWhatsApp(): Promise<void> {
  if (await getConfig(CHAVE_DATA_CORTE)) return;
  const corte = inicioDoDiaBrasilia(DATA_CORTE_INICIAL);
  await definirDataCorte(corte);
  await apagarConversasAnteriores(corte);
}

export type ResultadoLimpezaConversas = { conversas: number; clientesAfetados: number };

export async function contarConversasAnteriores(data: Date): Promise<number> {
  return db.whatsAppConversation.count({ where: { lastMessageAt: { lt: data } } });
}

// Apaga toda conversa cuja última mensagem é anterior à data (mensagens vão
// por cascade), registra a exclusão de cada uma e limpa alertas/pendências.
export async function apagarConversasAnteriores(data: Date): Promise<ResultadoLimpezaConversas> {
  const alvos = await db.whatsAppConversation.findMany({
    where: { lastMessageAt: { lt: data } },
    select: { id: true, externalPhone: true, lid: true, clienteId: true },
  });
  if (!alvos.length) return { conversas: 0, clientesAfetados: 0 };
  await db.whatsAppConversation.deleteMany({ where: { id: { in: alvos.map((a) => a.id) } } });
  for (const a of alvos) await registrarExclusaoConversa(a, data, "corte").catch(() => {});
  const clientes = alvos.map((a) => a.clienteId).filter((id): id is string => !!id);
  await limparRastroDeClientes(clientes);
  return { conversas: alvos.length, clientesAfetados: new Set(clientes).size };
}
