"use client";

import { useState, useTransition } from "react";
import { Card, Badge } from "@/components/ui";
import { desconectarGoogleAction, importarContatosGoogleAction } from "@/lib/google-actions";
import { Calendar, CheckCircle2, Circle, Loader2, Contact, LogOut, ExternalLink } from "lucide-react";

type Status = { configurado: boolean; conectado: boolean; email: string | null; conectadoEm: string | null; redirectUri: string };

export function GoogleIntegracaoCard({ status, feedback, msg }: { status: Status; feedback?: string; msg?: string }) {
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [importando, startImportar] = useTransition();
  const [desconectando, startDesconectar] = useTransition();

  function importar() {
    setErro(null); setResultado(null);
    startImportar(async () => {
      const r = await importarContatosGoogleAction();
      if (!r.ok) { setErro(r.erro ?? "Falha ao importar."); return; }
      setResultado(`${r.total} contato(s) lido(s) do Google · ${r.clientes} cliente(s) e ${r.conversas} conversa(s) receberam nome.`);
    });
  }

  function desconectar() {
    if (!confirm("Desconectar a conta Google? As visitas já lançadas continuam na agenda; as novas param de ser enviadas.")) return;
    startDesconectar(async () => { await desconectarGoogleAction(); window.location.href = "/configuracoes"; });
  }

  return (
    <Card className="mb-6">
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${status.conectado ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"}`}>
          <Calendar size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">Google Agenda e Contatos</span>
            {status.conectado ? (
              <Badge tom="green"><CheckCircle2 size={12} className="mr-1 inline" /> conectado{status.email ? ` · ${status.email}` : ""}</Badge>
            ) : (
              <Badge tom="slate"><Circle size={12} className="mr-1 inline" /> não conectado</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Toda visita criada no CRM (formulário, voz, IA ou WhatsApp) entra na sua Google Agenda com lembrete; remover a visita apaga o evento.
            Os nomes dos seus contatos do Google preenchem clientes e conversas que ficaram como “Contato 5528…”.
          </p>

          {feedback === "ok" && <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Conta Google conectada com sucesso.</p>}
          {feedback === "erro" && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Não foi possível conectar: {msg ?? "erro desconhecido"}.</p>}
          {feedback === "naoconfigurado" && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">Faltam as chaves GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no ambiente.</p>}

          {!status.configurado ? (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Como ativar (uma vez, 10 minutos, grátis):</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Crie a credencial OAuth no Google Cloud e ative as APIs Calendar e People.</li>
                <li>Cadastre este URI de redirecionamento: <code className="rounded bg-white px-1">{status.redirectUri}</code></li>
                <li>Defina <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> e <code>GOOGLE_REDIRECT_URI</code> na Vercel e faça um redeploy.</li>
              </ol>
              <p className="mt-1">Passo a passo com telas em <code>docs/GOOGLE.md</code> no repositório.</p>
            </div>
          ) : !status.conectado ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a href="/api/google/auth" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800">
                <ExternalLink size={14} /> Conectar com o Google
              </a>
              <span className="text-xs text-slate-400">Você escolhe a conta e aceita as permissões de agenda e leitura de contatos.</span>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={importar} disabled={importando} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {importando ? <Loader2 size={14} className="animate-spin" /> : <Contact size={14} />} Importar nomes dos contatos
              </button>
              <button onClick={desconectar} disabled={desconectando} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                {desconectando ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Desconectar
              </button>
              {status.conectadoEm && <span className="text-xs text-slate-400">conectado em {new Date(status.conectadoEm).toLocaleDateString("pt-BR")}</span>}
            </div>
          )}
          {resultado && <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{resultado}</p>}
          {erro && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        </div>
      </div>
    </Card>
  );
}
