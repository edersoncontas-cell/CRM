// O ARMAZENAMENTO DO MODO SEM SINAL, no aparelho (IndexedDB).
//
// Duas gavetas:
//  - "pacote": o retrato baixado do servidor (uma entrada só, "atual").
//  - "fila":   o que o vendedor fez sem sinal, uma entrada por operação,
//              pela chave op.id.
//
// IndexedDB e não localStorage: o localStorage tem teto de ~5 MB e o pacote
// com milhares de clientes pode passar disso; e a fila é o trabalho dele na
// rua — perder por estouro de espaço seria o pior desfecho.
//
// Só roda no navegador. Toda função rejeita com mensagem legível quando o
// aparelho não deixa guardar (aba anônima, espaço cheio) — a tela mostra.

import type { PacoteSemSinal, RegistroFila } from "@/lib/sem-sinal-regra";

const NOME_BANCO = "crm-sem-sinal";
const VERSAO_BANCO = 1;
const GAVETA_PACOTE = "pacote";
const GAVETA_FILA = "fila";

/** Avisa as outras partes da tela (e as outras abas) que algo mudou. */
export const EVENTO_SEM_SINAL = "crm-sem-sinal";

let abrindo: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (abrindo) return abrindo;
  abrindo = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador não deixa o CRM guardar dados no aparelho."));
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(NOME_BANCO, VERSAO_BANCO);
    } catch (e) {
      reject(new Error(`O aparelho não deixou abrir o armazenamento (${(e as Error)?.message ?? e}).`));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(GAVETA_PACOTE)) db.createObjectStore(GAVETA_PACOTE);
      if (!db.objectStoreNames.contains(GAVETA_FILA)) db.createObjectStore(GAVETA_FILA, { keyPath: "op.id" });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Outra aba com versão nova pediu para atualizar: fecha e deixa.
      db.onversionchange = () => { db.close(); abrindo = null; };
      resolve(db);
    };
    req.onerror = () => reject(new Error(`O aparelho não deixou abrir o armazenamento (${req.error?.message ?? "sem motivo"}).`));
    req.onblocked = () => reject(new Error("Feche as outras abas do CRM e abra de novo."));
  }).catch((e) => { abrindo = null; throw e; });
  return abrindo;
}

function pedido<T>(gaveta: string, modo: IDBTransactionMode, fazer: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return abrir().then((db) => new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(gaveta, modo);
    let resultado: T | undefined;
    const r = fazer(tx.objectStore(gaveta));
    if (r) r.onsuccess = () => { resultado = r.result; };
    tx.oncomplete = () => resolve(resultado);
    tx.onerror = () => reject(new Error(`Não deu para guardar no aparelho (${tx.error?.message ?? "sem motivo"}).`));
    tx.onabort = () => reject(new Error(`Não deu para guardar no aparelho (${tx.error?.message ?? "espaço cheio?"}).`));
  }));
}

export async function lerPacote(): Promise<PacoteSemSinal | null> {
  const p = await pedido<PacoteSemSinal>(GAVETA_PACOTE, "readonly", (s) => s.get("atual"));
  return p ?? null;
}

export async function guardarPacote(p: PacoteSemSinal): Promise<void> {
  await pedido(GAVETA_PACOTE, "readwrite", (s) => { s.put(p, "atual"); });
  avisar();
}

export async function lerFila(): Promise<RegistroFila[]> {
  const lista = await pedido<RegistroFila[]>(GAVETA_FILA, "readonly", (s) => s.getAll());
  return lista ?? [];
}

export async function guardarRegistros(rs: RegistroFila[]): Promise<void> {
  if (!rs.length) return;
  await pedido(GAVETA_FILA, "readwrite", (s) => { for (const r of rs) s.put(r); });
  avisar();
}

export async function apagarRegistros(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await pedido(GAVETA_FILA, "readwrite", (s) => { for (const id of ids) s.delete(id); });
  avisar();
}

let canal: BroadcastChannel | null = null;
function canalDeAvisos(): BroadcastChannel | null {
  if (canal || typeof BroadcastChannel === "undefined") return canal;
  try { canal = new BroadcastChannel(EVENTO_SEM_SINAL); } catch { canal = null; }
  return canal;
}

function avisar(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENTO_SEM_SINAL));
  try { canalDeAvisos()?.postMessage("mudou"); } catch { /* aba fechando */ }
}

/** Chama `f` quando o pacote ou a fila mudarem (nesta aba ou em outra). */
export function aoMudar(f: () => void): () => void {
  window.addEventListener(EVENTO_SEM_SINAL, f);
  const c = canalDeAvisos();
  const doCanal = () => f();
  c?.addEventListener("message", doCanal);
  return () => {
    window.removeEventListener(EVENTO_SEM_SINAL, f);
    c?.removeEventListener("message", doCanal);
  };
}

/**
 * Pede ao navegador para não apagar os dados do CRM quando faltar espaço.
 * No app instalado na tela inicial o iPhone já não apaga; no navegador comum,
 * este pedido é o que existe.
 */
export function pedirArmazenamentoPersistente(): void {
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* sem suporte */ }
}
