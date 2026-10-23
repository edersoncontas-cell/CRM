"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui";
import { desconectarGoogleAction, sincronizarContatosGoogleAction, definirEnvioContatosGoogleAction } from "@/lib/google-actions";
import type { ResumoSincronizacao } from "@/lib/google-contatos";
import { dataCompleta, PASSOS_PUBLICAR_APP, textosReconectar, type SituacaoGoogle } from "@/lib/google-conexao-regra";
import { Calendar, CheckCircle2, Circle, Loader2, Contact, LogOut, ExternalLink, AlertTriangle, RefreshCw } from "lucide-react";

type Status = { configurado: boolean; conectado: boolean; email: string | null; conectadoEm: string | null; redirectUri: string };

// Os 3 passos que acabam com a queda semanal (app em modo de teste no Google Cloud).
function PassosPublicar({ aberto }: { aberto: boolean }) {
  return (
    <details open={aberto} className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600" data-google-passos>
      <summary className="cursor-pointer font-semibold text-slate-700">A conexão cai a cada 7 dias? Como acabar com isso (grátis, 2 minutos)</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-4">
        {PASSOS_PUBLICAR_APP.map((p) => <li key={p}>{p}</li>)}
      </ol>
    </details>
  );
}

export function GoogleIntegracaoCard({ status, feedback, msg, situacao, enviarAtivo }: { status: Status; feedback?: string; msg?: string; situacao: SituacaoGoogle<ResumoSincronizacao>; enviarAtivo: boolean }) {
  const router = useRouter();
  const [resultado, setResultado] = useState<ResumoSincronizacao | null>(null);
  const [falhaAcao, setFalhaAcao] = useState<string | null>(null);
  const reconectar = situacao.tipo === "reconectar";
  // O que acabou de rodar (botão) vale mais que o que veio da página — a menos
  // que a página já traga uma rodada mais nova (o cron rodou depois do clique).
  const daPagina = situacao.tipo === "conectado" ? situacao.ultimo : null;
  const ultimo = resultado && (!daPagina || resultado.em >= daPagina.em) ? resultado : daPagina;
  const [enviar, setEnviar] = useState(enviarAtivo);
  const [sincronizando, startSincronizar] = useTransition();
  const [desconectando, startDesconectar] = useTransition();
  const [salvandoEnvio, startEnvio] = useTransition();

  function sincronizar() {
    setFalhaAcao(null);
    startSincronizar(async () => {
      try {
        setResultado(await sincronizarContatosGoogleAction());
        // A rodada pode ter derrubado a conexão (ou reerguido): o card relê o estado.
        router.refresh();
      } catch {
        setFalhaAcao("Não consegui falar com o servidor. Confira a internet e tente de novo.");
      }
    });
  }

  function alternarEnvio(v: boolean) {
    setEnviar(v);
    startEnvio(async () => { await definirEnvioContatosGoogleAction(v); });
  }

  function desconectar() {
    if (!confirm("Desconectar a conta Google? As visitas já lançadas continuam na agenda; as novas param de ser enviadas e os contatos param de sincronizar.")) return;
    startDesconectar(async () => { await desconectarGoogleAction(); window.location.href = "/configuracoes"; });
  }

  return (
    <div id="google" className="scroll-mt-24">
    <Card className="mb-6">
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${reconectar ? "bg-red-100 text-red-600" : status.conectado ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"}`}>
          <Calendar size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">Google Agenda e Contatos</span>
            {reconectar ? (
              <Badge tom="red"><AlertTriangle size={12} className="mr-1 inline" /> reconexão necessária{status.email ? ` · ${status.email}` : ""}</Badge>
            ) : status.conectado ? (
              <Badge tom="green"><CheckCircle2 size={12} className="mr-1 inline" /> conectado{status.email ? ` · ${status.email}` : ""}</Badge>
            ) : (
              <Badge tom="slate"><Circle size={12} className="mr-1 inline" /> não conectado</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Toda visita criada no CRM entra na sua Google Agenda com lembrete; remover a visita apaga o evento.
            A lista de clientes fica igual ao seu Google Contatos: todo contato com telefone vira cliente (ou completa o cadastro
            de quem já existe com o mesmo número), a cada hora e no botão abaixo.
          </p>

          {feedback === "ok" && <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Conta Google conectada com sucesso.</p>}
          {feedback === "erro" && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Não foi possível conectar: {msg ?? "erro desconhecido"}.</p>}
          {feedback === "naoconfigurado" && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">Faltam as chaves GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no ambiente.</p>}

          {!status.configurado ? (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Como ativar (uma vez, 10 minutos, grátis):</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Crie a credencial OAuth no Google Cloud e ative as APIs Calendar e People.</li>
                <li>Cadastre este URI de redirecionamento: <code className="break-all rounded bg-white px-1">{status.redirectUri}</code></li>
                <li>Defina <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> e <code>GOOGLE_REDIRECT_URI</code> na Vercel e faça um redeploy.</li>
              </ol>
              <p className="mt-1">Passo a passo com telas em <code>docs/GOOGLE.md</code> no repositório.</p>
            </div>
          ) : situacao.tipo === "reconectar" ? (
            <>
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" data-google-estado="reconectar">
                <p className="font-semibold">{textosReconectar(situacao).titulo}</p>
                <p className="mt-0.5">{textosReconectar(situacao).efeito}</p>
                <p className="mt-0.5 text-xs text-red-600">{textosReconectar(situacao).causa}</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a href="/api/google/auth" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800">
                  <RefreshCw size={14} /> Reconectar com o Google
                </a>
                <button onClick={desconectar} disabled={desconectando} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                  {desconectando ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Desconectar
                </button>
              </div>
              <PassosPublicar aberto />
            </>
          ) : !status.conectado ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a href="/api/google/auth" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800">
                <ExternalLink size={14} /> Conectar com o Google
              </a>
              <span className="text-xs text-slate-400">Você escolhe a conta e aceita as permissões de agenda e contatos.</span>
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={sincronizar} disabled={sincronizando} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  {sincronizando ? <Loader2 size={14} className="animate-spin" /> : <Contact size={14} />} Sincronizar contatos agora
                </button>
                <button onClick={desconectar} disabled={desconectando} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                  {desconectando ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Desconectar
                </button>
                {status.conectadoEm && <span className="text-xs text-slate-400">conectado em {dataCompleta(status.conectadoEm)}</span>}
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={enviar} disabled={salvandoEnvio} onChange={(e) => alternarEnvio(e.target.checked)} className="mt-0.5" />
                <span>
                  <b>Enviar clientes do CRM para o Google Contatos</b> — quem você cadastra ou edita aqui (com nome e telefone) aparece na agenda do celular.
                  Contatos genéricos do WhatsApp (“Contato 5528…”) e prospects da IA não vão.
                  {" "}<span className="text-xs text-slate-400">Se a conta foi conectada antes desta versão, desconecte e conecte de novo para liberar a gravação.</span>
                </span>
              </label>
              <PassosPublicar aberto={false} />
            </>
          )}
          {falhaAcao && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{falhaAcao}</p>}
          {!reconectar && ultimo?.ok && (
            <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              Última sincronização {new Date(ultimo.em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}: {ultimo.lidos} contato(s) lido(s) · {ultimo.criados} cliente(s) novo(s) · {ultimo.atualizados} atualizado(s) · {ultimo.enviados} enviado(s) ao Google
              {ultimo.semTelefone > 0 && <> · {ultimo.semTelefone} sem telefone (ignorados)</>}
              {ultimo.pendentesEnvio > 0 && <> · {ultimo.pendentesEnvio} ainda por enviar (segue na próxima rodada)</>}
              {ultimo.asteriscoBloqueados > 0 && <> · <b>{ultimo.asteriscoBloqueados} marcado(s) com * ficaram de fora</b></>}
              {ultimo.asteriscoLiberados > 0 && <> · {ultimo.asteriscoLiberados} voltaram (asterisco removido)</>}
            </p>
          )}
          {!reconectar && ultimo && !ultimo.ok && ultimo.erro && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Falhou em {new Date(ultimo.em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}: {ultimo.erro}</p>}
          {situacao.tipo === "conectado" && !ultimo && <p className="mt-2 text-xs text-slate-400">Conectado em {dataCompleta(situacao.conectadoEm)} — a primeira sincronização roda em até 1 hora, ou use o botão acima.</p>}
        </div>
      </div>
    </Card>
    </div>
  );
}
