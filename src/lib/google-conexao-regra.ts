// A CONEXÃO COM O GOOGLE (Agenda + Contatos) — a régua, sem banco.
//
// 22/10, print dele: a faixa de Clientes mostrava "Google Contatos · Token has
// been expired or revoked." e mais nada. Era o Google recusando renovar o
// acesso (invalid_grant) — e o CRM só repetia o texto cru, sem dizer o que
// fazer. Pior: o código antigo APAGAVA os tokens ao receber esse erro, então a
// conexão sumia em silêncio (o cron passava a "pular", as visitas deixavam de
// ir para a Agenda e ninguém era avisado).
//
// Causa mais provável: o app no Google Cloud está em modo de TESTE, e nesse
// modo o Google só vale o acesso por 7 DIAS. O passo a passo antigo
// (docs/GOOGLE.md) mandava deixar em teste — por isso caía toda semana.
//
// Agora a queda vira um estado com nome: o token fica guardado com o
// `problema`, e toda tela mostra "reconecte" + o botão. Daqui sai a decisão
// de qual estado é qual, usada pela faixa de Clientes, pelo card de
// Configurações, pelo aviso de Visitas e pelo cron (tests/google-conexao.test.ts).
//
// Puro: o componente "use client" importa daqui sem levar o Prisma junto.

export type ProblemaGoogle = { em: string; codigo: string; descricao: string };

/** O que a faixa e o card mostram. Frase fixa: o resumo da rodada guarda este texto. */
export const MENSAGEM_RECONECTAR = "A conexão com o Google expirou ou foi revogada. Reconecte a conta para voltar a sincronizar.";

/** O Google recusou renovar o acesso: só reconectando resolve (invalid_grant). */
export function ehErroDeReconexao(texto?: string | null): boolean {
  if (!texto) return false;
  return /invalid_grant|expired or revoked|expirou ou foi revogada/i.test(texto);
}

/** Prazo do refresh token de um app em modo de teste no Google Cloud. */
export const DIAS_MODO_TESTE = 7;

function ms(iso?: string | null): number {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : NaN;
}

/** Dias (com fração) entre duas datas ISO; null se alguma for inválida. */
export function diasEntre(de?: string | null, ate?: string | null): number | null {
  const a = ms(de), b = ms(ate);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return (b - a) / 86_400_000;
}

/**
 * A queda veio ~7 dias depois de conectar? Esse é o prazo do modo de teste do
 * Google. A margem existe porque a queda só aparece quando alguém tenta
 * renovar (o cron roda de hora em hora, então o atraso costuma ser pequeno).
 */
export function pareceModoTeste(conectadoEm?: string | null, caiuEm?: string | null): boolean {
  const d = diasEntre(conectadoEm, caiuEm);
  return d != null && d >= DIAS_MODO_TESTE - 1 && d <= DIAS_MODO_TESTE + 2;
}

type ResumoMin = { em: string; ok: boolean; erro?: string };
type TokensMin = { conectadoEm: string; email: string | null; problema?: ProblemaGoogle | null };

export type SituacaoGoogle<R extends ResumoMin = ResumoMin> =
  | { tipo: "nao_configurado" }
  | { tipo: "desconectado" }
  | { tipo: "reconectar"; email: string | null; desde: string | null; dias: number | null; modoTeste: boolean }
  | {
      tipo: "conectado";
      email: string | null;
      conectadoEm: string;
      // Última rodada que vale mostrar: a anterior à reconexão é de uma
      // conexão que já morreu — mostrar o erro dela como se fosse de agora
      // foi o que deixou o "Token has been expired" na tela depois de ele ter
      // conectado de novo.
      ultimo: R | null;
      aguardandoPrimeiraRodada: boolean;
    };

/**
 * Decide em que pé está a conexão. Padrão seguro: dado estranho (data
 * inválida, resumo de formato velho) nunca esconde um erro — mostra.
 */
export function situacaoGoogle<R extends ResumoMin>(e: { configurado: boolean; tokens: TokensMin | null; resumo: R | null }): SituacaoGoogle<R> {
  if (!e.configurado) return { tipo: "nao_configurado" };
  const t = e.tokens;
  if (!t) return { tipo: "desconectado" };

  const emResumo = ms(e.resumo?.em);
  const emConexao = ms(t.conectadoEm);
  // Datas que não dá para comparar: não esconde nada.
  const velho = !!e.resumo && !Number.isNaN(emResumo) && !Number.isNaN(emConexao) && emResumo < emConexao;
  const resumo = e.resumo && !velho ? e.resumo : null;

  // Conta conectada antes desta versão: o token continua gravado, sem a marca
  // do problema, e a única pista é o erro da última rodada.
  let problema: ProblemaGoogle | null = t.problema ?? null;
  if (!problema && resumo && !resumo.ok && ehErroDeReconexao(resumo.erro)) {
    problema = { em: resumo.em, codigo: "invalid_grant", descricao: resumo.erro ?? "" };
  }

  if (problema) {
    return {
      tipo: "reconectar",
      email: t.email,
      desde: problema.em,
      dias: diasEntre(t.conectadoEm, problema.em),
      modoTeste: pareceModoTeste(t.conectadoEm, problema.em),
    };
  }
  return { tipo: "conectado", email: t.email, conectadoEm: t.conectadoEm, ultimo: resumo, aguardandoPrimeiraRodada: velho || !e.resumo };
}

/** "15/10" no fuso de Brasília. Sem data válida, string vazia. */
export function diaMes(iso?: string | null): string {
  const t = ms(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

/** "15/10/2026" no fuso de Brasília. */
export function dataCompleta(iso?: string | null): string {
  const t = ms(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export type TextosReconectar = { titulo: string; efeito: string; causa: string };

/** Os textos da tela de reconexão (uma só redação para a faixa, o card e o aviso de Visitas). */
export function textosReconectar(s: Extract<SituacaoGoogle, { tipo: "reconectar" }>): TextosReconectar {
  const quando = diaMes(s.desde);
  const dias = s.dias != null ? Math.round(s.dias) : null;
  return {
    titulo: quando ? `A conexão com o Google expirou em ${quando}` : "A conexão com o Google expirou",
    efeito: "Enquanto não reconectar, os contatos do Google não sincronizam e as visitas novas não entram na sua Google Agenda.",
    // Hipótese, não fato: o CRM não sabe se o app está em teste, só vê quantos
    // dias a conexão durou.
    causa: s.modoTeste && dias != null
      ? `Caiu ${dias} dias depois de conectar — é o prazo típico de app em modo de teste no Google. Para não cair mais, publique o app no Google Cloud e reconecte. Se o app já está publicado, veja em myaccount.google.com/permissions se o acesso foi removido.`
      : "O Google recusou renovar o acesso: a permissão foi removida em myaccount.google.com/permissions, o administrador do Google Workspace bloqueou o app, ou o app está em modo de teste (nele o acesso vale só 7 dias).",
  };
}

/** Os 3 passos para a conexão deixar de cair a cada 7 dias (grátis, sem verificação do Google). */
export const PASSOS_PUBLICAR_APP: string[] = [
  "Abra console.cloud.google.com, escolha o projeto do CRM e vá em Google Auth Platform → Público-alvo (antes chamado “Tela de permissão OAuth”; em inglês, Audience).",
  "Em Status da publicação (Publishing status: Testing), clique em Publicar app (Publish app) e confirme. É grátis e não precisa enviar para verificação do Google.",
  "Volte aqui e clique em “Reconectar com o Google”. Se o Google mostrar “O Google não verificou este app”, clique em Avançado → Acessar (é o seu próprio app).",
];

/**
 * Volta do banco provisório: o token do principal está CAÍDO e o do provisório
 * funciona (ele pode ter conectado o Google enquanto o CRM rodava lá)? Então o
 * do provisório vale. Em qualquer outro caso devolve null e o principal manda,
 * como com toda configuração. Antes, a linha caída era apagada e o token do
 * provisório entrava sozinho; agora ela continua existindo e precisa desta
 * regra para não bloquear a volta.
 */
export function googleQueVemNaVolta(principal: string | null | undefined, provisorio: string | null | undefined): string | null {
  try {
    const p = JSON.parse(principal ?? "null") as { problema?: { em?: unknown } } | null;
    const v = JSON.parse(provisorio ?? "null") as { refreshToken?: unknown; problema?: unknown } | null;
    if (!p || typeof p !== "object" || !p.problema || typeof p.problema.em !== "string") return null;
    if (!v || typeof v !== "object" || typeof v.refreshToken !== "string" || !v.refreshToken || v.problema) return null;
    return provisorio ?? null;
  } catch {
    return null;
  }
}
