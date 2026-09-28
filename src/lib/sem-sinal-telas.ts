// AS TELAS DO CRM GUARDADAS NO APARELHO, para LER sem internet.
//
// O modo sem sinal (/sem-sinal) é onde se REGISTRA sem sinal. As demais telas
// (Dashboard, Negociações, Clientes, a ficha que ele abriu…) ficam guardadas
// como cópia: sem rede, o service worker abre a cópia daquela tela, e a tela
// avisa de quando ela é (components/SincronizadorOffline.tsx). Botão que grava
// não funciona na cópia — o aviso manda registrar pelo modo sem sinal.
//
// Antes disto, sem rede, QUALQUER tela ia para o modo sem sinal: ele via as
// visitas e mais nada do CRM ("funcionou somente a parte das visitas").
//
// Estas regras valem para DOIS lados: a tela e o service worker. O worker é
// um texto gerado em src/lib/sw-codigo.ts, que recebe estas listas e repete
// as funções pequenas (lá não dá para importar); o teste
// tests/sw-worker.test.ts roda o worker gerado e confere que os dois lados
// decidem igual.

import { GRUPOS } from "@/lib/menu";
import { diaBrasilia, type RegistroFila } from "@/lib/sem-sinal-regra";

/**
 * Guardadas e renovadas por trás, sem ele precisar abrir cada uma: são as que
 * ele consulta na rua. As outras ficam guardadas quando ele as abre.
 */
export const TELAS_PRINCIPAIS = ["/dashboard", "/negociacoes", "/visitas", "/clientes", "/alertas", "/pipeline"];

/**
 * Nunca viram cópia: o WhatsApp e a conexão são ao vivo (cópia mostraria
 * conversa velha como se fosse a de agora), as de sistema não servem na rua, e
 * as demais não são telas do CRM.
 */
export const TELAS_SEM_COPIA = [
  "/atendimento", "/conexao", "/configuracoes", "/cerebro", "/zeus", "/auditoria",
  "/login", "/sem-sinal", "/config-necessaria", "/api", "/_next",
];

/**
 * Cada cópia é refeita, no máximo, uma vez por hora. Refazer é montar a tela
 * de novo no servidor (consultas ao banco): mais que isso pesaria na cota do
 * banco grátis sem ganho na rua. O pacote do modo sem sinal (visitas,
 * clientes, funil) continua a cada 30 min.
 */
export const RENOVAR_TELA_MS = 60 * 60 * 1000;

/** Teto de cópias no aparelho; as principais nunca saem, as avulsas mais velhas sim. */
export const MAX_TELAS_GUARDADAS = 40;

/**
 * Mudou dado (arrastou um card, abriu negociação, o modo sem sinal subiu o
 * que foi feito na rua): as cópias ficaram velhas. Esperar a renovação de
 * hora em hora deixava a negociação de agora fora da cópia — e ele pode sair
 * do sinal logo em seguida. O worker renova as principais e a tela onde a
 * mudança aconteceu assim que a rajada acaba (15 s sem mudança), no máximo a
 * cada 3 min: dez cards arrastados seguidos são UMA renovação, não dez.
 */
export const ESPERA_DEPOIS_DA_MUDANCA_MS = 15 * 1000;
export const INTERVALO_RENOVACAO_POR_MUDANCA_MS = 3 * 60 * 1000;

/**
 * A subida do que foi feito no modo sem sinal (sai de /sem-sinal, que não é
 * cópia). Esta não espera o intervalo de 3 min: é a hora em que o sinal
 * voltou, e ele pode cair de novo logo.
 */
export const SUBIDA_SEM_SINAL = "/api/sem-sinal/sincronizar";

/** Gravam, mas não mudam nada que as telas mostram. */
export const GRAVA_SEM_MUDAR_TELA = ["/api/zeus/report-erro", "/api/push", "/api/auth"];

/**
 * Este POST numa rota (/api) deixa as cópias velhas? `tela` é a tela de onde
 * ele saiu. Das telas ao vivo (WhatsApp, Configurações) não conta: mensagem
 * enviada não muda as telas guardadas, e cada envio viraria uma renovação.
 * As AÇÕES da tela (server actions) seguem outra regra: acaoMudouDado.
 */
export function mudaAsCopias(caminhoPedido: string, tela: string | null): boolean {
  if (GRAVA_SEM_MUDAR_TELA.some((p) => caminhoPedido === p || caminhoPedido.startsWith(`${p}/`))) return false;
  if (caminhoPedido === SUBIDA_SEM_SINAL) return true;
  return telaGuardavel(tela ?? caminhoPedido);
}

/**
 * As fichas dos clientes cujo registro feito sem sinal acabou de subir: a
 * cópia delas (guardada antes) não tem a negociação ou a visita nova. A
 * subida avisa o worker para renová-las junto com as principais — a ficha não
 * é principal, e a subida sai de uma tela qualquer.
 */
export function fichasDoQueSubiu(registros: RegistroFila[]): string[] {
  const fichas = new Set<string>();
  for (const r of registros) {
    if (r.estado !== "enviado") continue;
    if (r.op.tipo === "negociacao.criar" || r.op.tipo === "visita.agendar") fichas.add(`/clientes/${r.op.clienteId}`);
  }
  return [...fichas].filter(telaGuardavel);
}

/**
 * Ação da tela (server action) que gravou. O POST sozinho não diz: o app pede
 * a lista de visitas do dia por uma ação AO ABRIR QUALQUER TELA — contar isso
 * faria cada abertura do app remontar as seis telas no servidor. O que diz é
 * a resposta: o Next manda x-action-revalidated = [[], 1, …] quando a ação
 * pediu para refazer telas (revalidatePath), e toda ação que grava faz isso
 * aqui. Formato desconhecido (Next novo) não conta: sobra a renovação de hora
 * em hora, que é como era — o teste confere o formato na versão instalada.
 * Quem lê é a própria tela (vigiarAcoesQueGravam), não o worker: o worker
 * não põe a mão no envio do que o CRM grava.
 */
export function acaoMudouDado(cabecalho: string | null): boolean {
  if (!cabecalho) return false;
  try {
    const v: unknown = JSON.parse(cabecalho);
    return Array.isArray(v) && v[1] === 1;
  } catch {
    return false;
  }
}

/**
 * Montada no servidor mais que isto antes de o aparelho abri-la: é cópia.
 * Folga para relógio de celular adiantado — cópia de 2 minutos atrás é
 * praticamente a tela de agora.
 */
export const COPIA_DEPOIS_DE_MS = 3 * 60 * 1000;

/**
 * O layout do app só põe esta marca quando o banco respondeu. Sem ela, a
 * resposta é a tela de "banco fora do ar" — e guardar ISSO por cima de uma
 * cópia boa tiraria do aparelho justamente o que ele precisa sem sinal.
 */
export const MARCA_TELA_OK = 'data-crm-tela="ok"';

export function telaGuardavel(caminho: string): boolean {
  if (!caminho.startsWith("/") || caminho === "/") return false;
  return !TELAS_SEM_COPIA.some((p) => caminho === p || caminho.startsWith(`${p}/`));
}

/**
 * Pedaço da tela que caiu no servidor e foi deixado para o navegador: o React
 * marca com <template data-dgst="código do erro">. O mapa (que só desenha no
 * navegador, de propósito) usa a mesma marca com BAILOUT_TO_CLIENT_SIDE_RENDERING
 * — isso não é erro. E "data-dgst" solto aparece no próprio script do React
 * ($RC), em toda tela que carrega por partes.
 */
export const PEDACO_QUE_CAIU = /<template data-dgst="(?!BAILOUT_TO_CLIENT_SIDE_RENDERING")/;

/**
 * A tela veio inteira? Marca do layout presente e nenhum sinal de erro do
 * React no meio ($RX é o script que ele manda quando um pedaço que carregava
 * por partes falhou no servidor).
 */
export function telaSaudavel(html: string): boolean {
  return html.includes(MARCA_TELA_OK) && !html.includes("$RX=") && !PEDACO_QUE_CAIU.test(html);
}

/** Esta página é uma cópia guardada? (montada bem antes de o aparelho abri-la) */
export function ehCopia(renderizadoEm: number | null | undefined, abertoEm: number): boolean {
  return typeof renderizadoEm === "number" && Number.isFinite(renderizadoEm) && abertoEm - renderizadoEm > COPIA_DEPOIS_DE_MS;
}

const ROTULOS = new Map(GRUPOS.flatMap((g) => g.links.map((l) => [l.href, l.label] as const)));

/** Nome da tela para ele: o do menu; a ficha, pelo título dela. */
export function nomeDaTela(caminho: string, titulo?: string | null): string {
  const doMenu = ROTULOS.get(caminho);
  if (doMenu) return doMenu;
  const t = (titulo ?? "").trim();
  if (t) return t;
  return caminho;
}

export type TelaGuardada = { caminho: string; nome: string; guardadaEm: number; principal: boolean };

/** Principais primeiro, na ordem do menu; depois as avulsas, da mais nova. */
export function ordenarTelas(telas: TelaGuardada[]): TelaGuardada[] {
  const pos = (c: string) => {
    const i = TELAS_PRINCIPAIS.indexOf(c);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...telas].sort((a, b) => pos(a.caminho) - pos(b.caminho) || b.guardadaEm - a.guardadaEm);
}

/** "hoje às 14:32", "ontem às 09:10", "há 3 dias (25/09 às 18:00)". */
export function quandoFoi(momento: string | number, agora: number): string {
  const t = typeof momento === "number" ? momento : Date.parse(momento);
  if (!Number.isFinite(t)) return "em data desconhecida";
  const hora = new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const dia = diaBrasilia(t);
  const hoje = diaBrasilia(agora);
  if (dia === hoje) return `hoje às ${hora}`;
  const dias = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${dia}T12:00:00Z`)) / 86_400_000);
  if (dias === 1) return `ontem às ${hora}`;
  return `há ${dias} dias (${dia.slice(8, 10)}/${dia.slice(5, 7)} às ${hora})`;
}

/** Para a etiqueta da tela guardada: "14:32" (hoje), "ontem", "25/09". */
export function horaCurta(momento: number, agora: number): string {
  if (!Number.isFinite(momento) || momento <= 0) return "?";
  const dia = diaBrasilia(momento);
  const hoje = diaBrasilia(agora);
  if (dia === hoje) return new Date(momento).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const dias = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${dia}T12:00:00Z`)) / 86_400_000);
  if (dias === 1) return "ontem";
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/** Por que o worker mandou para o modo sem sinal em vez de abrir a tela. */
export type MotivoDesvio = "sem-copia" | "nao-guarda";

export function avisoDoDesvio(motivo: string | null, de: string | null): string | null {
  if (!de || (motivo !== "sem-copia" && motivo !== "nao-guarda")) return null;
  const nome = nomeDaTela(de.split("?")[0]);
  const rotulo = nome.startsWith("/") ? "Essa tela" : `“${nome}”`;
  return motivo === "nao-guarda"
    ? `${rotulo} só funciona com internet — ela não fica guardada no aparelho.`
    : `${rotulo} ainda não tem cópia neste aparelho. Ela fica guardada quando você a abre com internet.`;
}
