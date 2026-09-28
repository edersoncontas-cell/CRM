// A SINCRONIA DO MODO SEM SINAL, no navegador.
//
// Sobe a fila (o que ele fez sem sinal) e baixa o pacote (o retrato do CRM).
// Sempre nessa ordem: subir primeiro faz o pacote novo já vir com o que ele
// fez, e a tela não pisca.
//
// Quem chama: components/SincronizadorOffline.tsx (em toda tela do CRM, ao
// abrir, ao voltar a internet e a cada minuto enquanto houver pendente) e a
// própria tela do modo sem sinal (botão "Enviar agora").

import {
  VERSAO_PACOTE, pacoteVelho, proximoLote, aplicarResultados, registrosParaApagar, TENTATIVAS_ANTES_DE_ERRO,
  type PacoteSemSinal, type RespostaSincronia, type RegistroFila,
} from "@/lib/sem-sinal-regra";
import { lerFila, guardarRegistros, apagarRegistros, lerPacote, guardarPacote, EVENTO_SEM_SINAL } from "@/lib/sem-sinal-local";
import { restaurarSessao } from "@/lib/sessao-local";
import { telaGuardavel, nomeDaTela, ordenarTelas, fichasDoQueSubiu, acaoMudouDado, TELAS_PRINCIPAIS, type TelaGuardada } from "@/lib/sem-sinal-telas";

export const PAGINA_SEM_SINAL = "/sem-sinal";

type Pedido<T> =
  | { tipo: "ok"; dados: T }
  | { tipo: "sessao"; motivo: string }
  | { tipo: "rede"; motivo: string }
  | { tipo: "servidor"; motivo: string };

async function pedirUmaVez<T>(url: string, init?: RequestInit): Promise<Pedido<T>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store" });
  } catch {
    return { tipo: "rede", motivo: "Sem internet agora." };
  }
  let caminho = "";
  try { caminho = new URL(res.url).pathname; } catch { /* url vazia */ }
  // Cookie vencido: o middleware manda para /login e o fetch segue o desvio,
  // devolvendo a TELA de login com 200. Tratar isso como sucesso seria dizer
  // "enviado" sem ter enviado nada.
  if (res.status === 401 || (res.redirected && caminho.startsWith("/login"))) {
    return { tipo: "sessao", motivo: "A sessão deste aparelho saiu." };
  }
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) {
    return { tipo: "servidor", motivo: `Resposta inesperada do servidor (${res.status}).` };
  }
  let dados: unknown;
  try { dados = await res.json(); } catch { return { tipo: "rede", motivo: "A resposta se perdeu no caminho." }; }
  if (!res.ok) return { tipo: "servidor", motivo: (dados as { erro?: string } | null)?.erro ?? `Erro ${res.status} no servidor.` };
  return { tipo: "ok", dados: dados as T };
}

/** Pede; se a sessão tiver saído, repõe pelo token guardado e tenta mais uma vez. */
async function pedir<T>(url: string, init?: RequestInit): Promise<Pedido<T>> {
  const r = await pedirUmaVez<T>(url, init);
  if (r.tipo !== "sessao") return r;
  const s = await restaurarSessao();
  if (s === "rede") return { tipo: "rede", motivo: "Sem internet agora." };
  if (s !== "ok") return { tipo: "sessao", motivo: "A sessão deste aparelho saiu. Entre com a senha para enviar — o que você fez continua guardado." };
  return pedirUmaVez<T>(url, init);
}

function pacoteValido(p: unknown): p is PacoteSemSinal {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return o.versao === VERSAO_PACOTE && typeof o.geradoEm === "string"
    && ["visitas", "clientes", "negociacoes", "colunas", "municipios", "maquinas"].every((k) => Array.isArray(o[k]));
}

export type Problema = { tipo: "sessao" | "rede" | "servidor" | "aparelho"; motivo: string };

export type ResumoSincronia = {
  enviadas: number;
  recusadas: number;
  pacote: "baixado" | "pulado" | "falhou";
  problema: Problema | null;
  quando: number;
};

// Estado para a tela: está rodando? como foi a última?
let rodando = false;
let ultimo: ResumoSincronia | null = null;

export function estadoSincronia(): { rodando: boolean; ultimo: ResumoSincronia | null } {
  return { rodando, ultimo };
}

function avisarTela() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_SEM_SINAL));
}

let rodandoAqui = false;
type Trava = { request: (nome: string, op: { ifAvailable: boolean }, f: (lock: unknown) => Promise<unknown>) => Promise<unknown> };

/** Uma sincronia por vez, mesmo com duas abas abertas. */
async function comTrava<T>(f: () => Promise<T>): Promise<T | "ocupado"> {
  const locks = (navigator as Navigator & { locks?: Trava }).locks;
  if (locks?.request) {
    return (await locks.request("crm-sem-sinal", { ifAvailable: true }, async (lock) => (lock ? f() : "ocupado"))) as T | "ocupado";
  }
  if (rodandoAqui) return "ocupado";
  rodandoAqui = true;
  try { return await f(); } finally { rodandoAqui = false; }
}

async function subirFila(): Promise<{ enviadas: number; recusadas: number; problema: Problema | null }> {
  let enviadas = 0, recusadas = 0;
  const subiram: RegistroFila[] = [];
  try {
    // Teto de rodadas: uma fila enorme sobe em partes, e a próxima chamada
    // continua de onde parou.
    for (let rodada = 0; rodada < 12; rodada++) {
      const fila = await lerFila();
      const lote = proximoLote(fila);
      if (!lote.length) break;
      const r = await pedir<RespostaSincronia>("/api/sem-sinal/sincronizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: lote.map((x) => x.op) }),
      });
      if (r.tipo !== "ok") {
        // Erro do servidor na rodada inteira: conta tentativa só na primeira do
        // lote (é a que o servidor aplica primeiro). Sem isso, uma operação
        // problemática travaria a fila para sempre; contando em todas, as
        // inocentes virariam erro junto.
        if (r.tipo === "servidor") {
          const [primeira] = lote;
          const tentativas = primeira.tentativas + 1;
          await guardarRegistros([{
            ...primeira, tentativas,
            ...(tentativas >= TENTATIVAS_ANTES_DE_ERRO ? { estado: "erro" as const } : {}),
            erro: r.motivo,
          }]);
        }
        return { enviadas, recusadas, problema: r };
      }
      const mudados = aplicarResultados(fila, r.dados);
      await guardarRegistros(mudados);
      subiram.push(...mudados.filter((m) => m.estado === "enviado"));
      enviadas += mudados.filter((m) => m.estado === "enviado").length;
      recusadas += mudados.filter((m) => m.estado === "erro").length;
      // O servidor mandou parar (prazo, falha no meio): fica para a próxima.
      const parou = r.dados.resultados.find((x) => !x.ok && x.transitorio);
      if (parou) return { enviadas, recusadas, problema: { tipo: "servidor", motivo: parou.erro ?? "O servidor pediu para continuar depois." } };
    }
    return { enviadas, recusadas, problema: null };
  } finally {
    // As fichas dos clientes do que subiu: a cópia delas é de antes.
    if (subiram.length) avisarTelasMudaram(fichasDoQueSubiu(subiram), true);
  }
}

async function baixarPacote(): Promise<Problema | null> {
  const r = await pedir<unknown>("/api/sem-sinal/pacote");
  if (r.tipo !== "ok") return r;
  if (!pacoteValido(r.dados)) return { tipo: "servidor", motivo: "O pacote veio num formato que esta versão não entende. Recarregue o CRM." };
  await guardarPacote(r.dados);
  // Enviados que o pacote novo já contém podem sair da fila.
  const fila = await lerFila();
  await apagarRegistros(registrosParaApagar(fila, r.dados, Date.now()));
  return null;
}

/**
 * Sobe o que estiver pendente e, se for o caso, baixa o pacote.
 *  baixar "sempre"   → baixa (botão "Baixar agora", volta da internet).
 *  baixar "se_velho" → só se o guardado tiver mais de 30 min.
 * Depois de subir alguma coisa, baixa sempre: a tela precisa do retrato novo.
 */
export async function sincronizar(opcoes: { baixar: "sempre" | "se_velho" | "nunca" }): Promise<ResumoSincronia | "ocupado"> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const r: ResumoSincronia = { enviadas: 0, recusadas: 0, pacote: "pulado", problema: { tipo: "rede", motivo: "Sem internet agora." }, quando: Date.now() };
    ultimo = r;
    avisarTela();
    return r;
  }
  const saida = await comTrava(async () => {
    rodando = true;
    avisarTela();
    try {
      const subida = await subirFila();
      let pacote: ResumoSincronia["pacote"] = "pulado";
      let problema = subida.problema;
      const precisa = subida.enviadas > 0 || opcoes.baixar === "sempre"
        || (opcoes.baixar === "se_velho" && pacoteVelho(await lerPacote(), Date.now()));
      // Sem internet ou sessão fora, nem tenta baixar.
      if (precisa && (!problema || problema.tipo === "servidor")) {
        const p = await baixarPacote();
        pacote = p ? "falhou" : "baixado";
        problema = problema ?? p;
      }
      return { enviadas: subida.enviadas, recusadas: subida.recusadas, pacote, problema, quando: Date.now() } satisfies ResumoSincronia;
    } catch (e) {
      // O que sobra aqui é o armazenamento do aparelho (IndexedDB) falhando.
      return {
        enviadas: 0, recusadas: 0, pacote: "falhou" as const, quando: Date.now(),
        problema: { tipo: "aparelho" as const, motivo: e instanceof Error ? e.message : String(e) },
      };
    } finally {
      rodando = false;
    }
  });
  if (saida !== "ocupado") ultimo = saida;
  avisarTela();
  return saida;
}

/** Tenta de novo uma operação recusada: volta a ser pendente. */
export async function tentarDeNovo(r: RegistroFila): Promise<void> {
  await guardarRegistros([{ ...r, estado: "pendente", erro: null, tentativas: 0 }]);
}

export async function descartar(r: RegistroFila): Promise<void> {
  await apagarRegistros([r.op.id]);
}

/**
 * Pede ao service worker para guardar a tela do modo sem sinal e as cópias
 * das telas principais (cada uma no máximo 1×/hora — lib/sem-sinal-telas.ts).
 * Sem isto, abrir o CRM sem internet cai na página de erro do navegador. Não
 * espera: se o worker ainda não está ativo, fica para a próxima tela. A
 * resposta chega por mensagem ("sem-sinal-preparado" e "telas-guardadas").
 */
export function prepararModoSemSinal(forcar = false): void {
  try {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.active?.postMessage({ tipo: "preparar-sem-sinal", forcar }))
      .catch(() => {});
  } catch { /* sem service worker */ }
}

/**
 * Avisa o worker que o dado mudou e estas telas ficaram velhas (a tela onde
 * uma ação gravou; as fichas dos clientes do que subiu do modo sem sinal): ele
 * renova as principais e estas logo em seguida. `urgente` (a subida): não
 * espera o intervalo entre renovações. Sem worker, fica para a de hora em hora.
 */
export function avisarTelasMudaram(caminhos: string[], urgente = false): void {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.active?.postMessage({ tipo: "telas-mudaram", caminhos, urgente }))
      .catch(() => {});
  } catch { /* sem service worker */ }
}

/**
 * Observa as ações da tela (server actions) e chama `aoGravar` quando uma
 * delas gravou (acaoMudouDado). Só observa: o pedido e a resposta seguem os
 * mesmos, e qualquer falha daqui é engolida — nunca atrapalha o que grava.
 * Devolve quem desfaz.
 */
export function vigiarAcoesQueGravam(alvo: { fetch: typeof fetch }, aoGravar: () => void): () => void {
  const original = alvo.fetch;
  const vigiado: typeof fetch = async (entrada, init) => {
    const res = await original(entrada, init);
    try {
      const cabecalhos = new Headers(init?.headers ?? (entrada instanceof Request ? entrada.headers : undefined));
      if (cabecalhos.has("Next-Action") && acaoMudouDado(res.headers.get("x-action-revalidated"))) aoGravar();
    } catch { /* só observa */ }
    return res;
  };
  alvo.fetch = vigiado;
  return () => { if (alvo.fetch === vigiado) alvo.fetch = original; };
}

/**
 * A tela aberta por dentro do app (sem recarregar) não passa pelo worker como
 * página inteira: ele pede de novo ao servidor para guardar a cópia — só se a
 * que houver tiver mais de uma hora. Endereço com filtro (?…) não vira cópia.
 */
export function guardarTelaAtual(caminho: string, busca: string): void {
  try {
    if (busca || !telaGuardavel(caminho) || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.active?.postMessage({ tipo: "guardar-tela", caminho }))
      .catch(() => {});
  } catch { /* sem service worker */ }
}

/** A tela do modo sem sinal já está guardada neste aparelho? */
export async function modoSemSinalGuardado(): Promise<boolean | null> {
  try {
    if (typeof caches === "undefined") return null;
    return Boolean(await caches.match(PAGINA_SEM_SINAL, { ignoreSearch: true }));
  } catch {
    return null;
  }
}

/**
 * As telas do CRM com cópia neste aparelho (lidas direto do cache, sem
 * depender do worker acordado). null = o aparelho não deixa ler o cache.
 */
export async function telasGuardadas(): Promise<TelaGuardada[] | null> {
  try {
    if (typeof caches === "undefined") return null;
    const porCaminho = new Map<string, TelaGuardada>();
    for (const nome of await caches.keys()) {
      if (!nome.startsWith("crm-")) continue;
      const cache = await caches.open(nome);
      for (const req of await cache.keys()) {
        const caminho = new URL(req.url).pathname;
        if (!telaGuardavel(caminho) || /\.[a-z0-9]+$/i.test(caminho)) continue;
        const res = await cache.match(req);
        if (!res?.headers.get("x-tela")) continue;
        const em = Number(res.headers.get("x-guardado-em") ?? 0);
        const atual = porCaminho.get(caminho);
        if (atual && atual.guardadaEm >= em) continue;
        let titulo = "";
        try { titulo = decodeURIComponent(res.headers.get("x-titulo") ?? ""); } catch { /* título estranho */ }
        porCaminho.set(caminho, { caminho, nome: nomeDaTela(caminho, titulo), guardadaEm: em, principal: TELAS_PRINCIPAIS.includes(caminho) });
      }
    }
    return ordenarTelas([...porCaminho.values()]);
  } catch {
    return null;
  }
}
