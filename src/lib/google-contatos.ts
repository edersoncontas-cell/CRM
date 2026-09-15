// Sincronização Google Contatos ↔ lista de clientes do CRM.
//
//   Google → CRM (sempre que roda): todo contato com telefone vira cliente
//   (ou se liga ao cliente com o mesmo número); nome real substitui o
//   "Contato 5528…"; e-mail, endereço e município completam o que falta.
//   CRM → Google (opcional, chave google.contatos.enviar = "on"): clientes
//   cadastrados no CRM que ainda não existem no Google são criados lá.
//
// Roda pelo botão em Clientes/Configurações, pelo /api/cron/google-contatos
// (a cada hora, via /api/cron/tudo) e, no envio inverso, logo depois de
// cadastrar/editar um cliente. O resumo da última rodada fica em
// Configuracao (google.contatos.ultima) para a tela mostrar.

import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";
import { googleConfigurado, lerTokensGoogle, listarContatosGoogle, criarContatoGoogle, atualizarContatoGoogle } from "@/lib/integrations/google";
import { planejarSincronizacao, clientesParaEnviar, nomeGenerico, type ClienteResumo } from "@/lib/google-contatos-util";
import { deveDescartarContato } from "@/lib/utils";

const CHAVE_ULTIMA = "google.contatos.ultima";
const CHAVE_ENVIAR = "google.contatos.enviar";
// Limite de contatos criados no Google por rodada (a API aceita ~90 gravações/min).
const LIMITE_ENVIO_POR_RODADA = 80;

export type ResumoSincronizacao = {
  em: string;
  ok: boolean;
  erro?: string;
  lidos: number;
  criados: number;
  atualizados: number;
  enviados: number;
  ignorados: number;
  semTelefone: number;
  pendentesEnvio: number;
};

export async function lerResumoSincronizacaoGoogle(): Promise<ResumoSincronizacao | null> {
  try {
    const raw = await getConfig(CHAVE_ULTIMA);
    return raw ? (JSON.parse(raw) as ResumoSincronizacao) : null;
  } catch {
    return null;
  }
}

export async function envioParaGoogleAtivo(): Promise<boolean> {
  return (await getConfig(CHAVE_ENVIAR).catch(() => null)) === "on";
}

export async function definirEnvioParaGoogle(ativo: boolean): Promise<void> {
  await setConfig(CHAVE_ENVIAR, ativo ? "on" : "off");
}

export async function googleContatosDisponivel(): Promise<boolean> {
  return googleConfigurado() && !!(await lerTokensGoogle());
}

const SELECAO_CLIENTE = { id: true, nome: true, telefone: true, email: true, endereco: true, municipioId: true, origem: true, googleContatoId: true } as const;

// Rodada completa. Nunca lança: o erro vai para o resumo.
export async function sincronizarContatosGoogle(): Promise<ResumoSincronizacao> {
  const agora = new Date();
  const base: ResumoSincronizacao = { em: agora.toISOString(), ok: false, lidos: 0, criados: 0, atualizados: 0, enviados: 0, ignorados: 0, semTelefone: 0, pendentesEnvio: 0 };
  if (!(await googleContatosDisponivel())) return gravar({ ...base, erro: "Conta Google não conectada." });

  try {
    const [contatos, clientes, municipios] = await Promise.all([
      listarContatosGoogle(),
      db.cliente.findMany({ select: SELECAO_CLIENTE }) as Promise<ClienteResumo[]>,
      db.municipio.findMany({ select: { id: true, nome: true } }),
    ]);
    const plano = planejarSincronizacao(contatos, clientes, municipios);

    // Google → CRM
    for (const c of plano.criar) {
      await db.cliente.create({ data: { ...c, origem: "google", googleSincronizadoEm: agora } });
    }
    for (const a of plano.atualizar) {
      await db.cliente.update({ where: { id: a.id }, data: { ...a.dados, googleSincronizadoEm: agora } });
    }

    // CRM → Google (opcional)
    let enviados = 0, pendentesEnvio = 0;
    if (await envioParaGoogleAtivo()) {
      const ligados = new Set([...plano.atualizar.map((a) => a.id)]);
      const candidatos = clientesParaEnviar(clientes.filter((c) => !ligados.has(c.id)), Number.MAX_SAFE_INTEGER);
      const lote = candidatos.slice(0, LIMITE_ENVIO_POR_RODADA);
      pendentesEnvio = Math.max(0, candidatos.length - lote.length);
      for (const c of lote) {
        const id = await criarContatoGoogle({ nome: c.nome, telefone: c.telefone, email: c.email });
        await db.cliente.update({ where: { id: c.id }, data: { googleContatoId: id, googleSincronizadoEm: agora } });
        enviados++;
      }
    }

    return gravar({ ...base, ok: true, lidos: contatos.length, criados: plano.criar.length, atualizados: plano.atualizar.length, enviados, ignorados: plano.ignorados, semTelefone: plano.semTelefone, pendentesEnvio });
  } catch (e) {
    return gravar({ ...base, erro: e instanceof Error ? e.message : String(e) });
  }

  async function gravar(r: ResumoSincronizacao): Promise<ResumoSincronizacao> {
    await setConfig(CHAVE_ULTIMA, JSON.stringify(r)).catch(() => {});
    return r;
  }
}

// Envio inverso de UM cliente (chamado depois de cadastrar/editar no CRM).
// Silencioso quando o envio está desligado ou o Google não está conectado.
export async function enviarClienteParaGoogle(clienteId: string): Promise<void> {
  if (!(await envioParaGoogleAtivo()) || !(await googleContatosDisponivel())) return;
  const c = await db.cliente.findUnique({ where: { id: clienteId }, select: SELECAO_CLIENTE });
  if (!c || !c.telefone || nomeGenerico(c.nome) || deveDescartarContato(c.nome) || c.origem === "prospect_ia") return;
  const dados = { nome: c.nome, telefone: c.telefone, email: c.email };
  if (c.googleContatoId) {
    const existe = await atualizarContatoGoogle(c.googleContatoId, dados);
    if (existe) { await db.cliente.update({ where: { id: c.id }, data: { googleSincronizadoEm: new Date() } }); return; }
  }
  const id = await criarContatoGoogle(dados);
  await db.cliente.update({ where: { id: c.id }, data: { googleContatoId: id, googleSincronizadoEm: new Date() } });
}
