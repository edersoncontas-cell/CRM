"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { reiniciarZapi, desconectarZapi } from "@/lib/actions";
import {
  Smartphone, RefreshCw, QrCode, CheckCircle2, AlertTriangle, LogOut, Loader2,
} from "lucide-react";

type Status = {
  configurado: boolean;
  conectado: boolean;
  precisaQrCode: boolean;
  telefone?: string | null;
  erro?: string | null;
};

export function ConexaoWhatsApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [carregandoQr, setCarregandoQr] = useState(false);
  const [pending, startTransition] = useTransition();

  const buscarStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/zapi/status", { cache: "no-store" });
      const data = (await res.json()) as Status;
      setStatus(data);
      return data;
    } catch {
      setStatus({ configurado: true, conectado: false, precisaQrCode: true, erro: "Falha ao consultar status." });
      return null;
    }
  }, []);

  const buscarQr = useCallback(async () => {
    setCarregandoQr(true);
    try {
      const res = await fetch("/api/zapi/qr", { cache: "no-store" });
      const data = (await res.json()) as { imagem: string | null };
      setQr(data.imagem);
    } catch {
      setQr(null);
    } finally {
      setCarregandoQr(false);
    }
  }, []);

  // Polling: status a cada 5s. Enquanto precisar de QR, atualiza o QR a cada 20s.
  useEffect(() => {
    let ativo = true;
    let qrTick = 0;

    const loop = async () => {
      const s = await buscarStatus();
      if (!ativo || !s) return;
      if (s.configurado && !s.conectado) {
        // Atualiza o QR na primeira vez e a cada ~20s (4 ciclos de 5s).
        if (qrTick % 4 === 0) await buscarQr();
        qrTick++;
      } else {
        setQr(null);
      }
    };

    loop();
    const id = setInterval(loop, 5000);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [buscarStatus, buscarQr]);

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" /> Consultando status…
      </div>
    );
  }

  // Z-API não configurada: instruções de setup.
  if (!status.configurado) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="mb-2 flex items-center gap-2 font-semibold text-amber-800">
          <AlertTriangle size={18} /> Z-API ainda não configurada
        </div>
        <p className="text-sm text-amber-700">
          Para conectar o WhatsApp pelo CRM, crie uma instância em{" "}
          <a href="https://z-api.io" target="_blank" rel="noreferrer" className="font-semibold underline">z-api.io</a>{" "}
          e adicione estas variáveis de ambiente no Vercel:
        </p>
        <ul className="mt-3 space-y-1 text-sm text-amber-800">
          <li><code className="rounded bg-amber-100 px-1.5 py-0.5">ZAPI_INSTANCE_ID</code></li>
          <li><code className="rounded bg-amber-100 px-1.5 py-0.5">ZAPI_INSTANCE_TOKEN</code></li>
          <li><code className="rounded bg-amber-100 px-1.5 py-0.5">ZAPI_CLIENT_TOKEN</code> <span className="text-amber-600">(token de segurança da conta)</span></li>
        </ul>
        <p className="mt-3 text-xs text-amber-600">
          Depois, no painel da Z-API, configure o webhook &quot;Ao receber&quot; apontando para
          <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5">…/api/zapi/webhook</code>
          e faça um redeploy.
        </p>
      </div>
    );
  }

  // Conectado.
  if (status.conectado) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="mb-1 flex items-center gap-2 text-lg font-bold text-green-700">
          <CheckCircle2 size={22} /> WhatsApp conectado
        </div>
        <p className="flex items-center gap-2 text-sm text-green-700">
          <Smartphone size={15} />
          {status.telefone ? `Número ${status.telefone}` : "Seu número está pareado e recebendo mensagens."}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          As mensagens recebidas entram no <b>/inbox</b> e são analisadas pela IA automaticamente.
        </p>
        <button
          onClick={() => startTransition(async () => { await desconectarZapi(); await buscarStatus(); })}
          disabled={pending}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Desconectar
        </button>
      </div>
    );
  }

  // Precisa escanear o QR.
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
        <QrCode size={18} className="text-brand-600" /> Escaneie para conectar
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-56 w-56 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
          {carregandoQr && !qr ? (
            <Loader2 size={28} className="animate-spin text-slate-300" />
          ) : qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code do WhatsApp" className="h-52 w-52 rounded-lg" />
          ) : (
            <div className="px-4 text-center text-sm text-slate-400">
              QR indisponível. Clique em &quot;Gerar novo QR&quot;.
            </div>
          )}
        </div>
        <ol className="flex-1 space-y-2 text-sm text-slate-600">
          <li>1. Abra o <b>WhatsApp</b> no seu celular.</li>
          <li>2. Toque em <b>Configurações → Aparelhos conectados</b>.</li>
          <li>3. Toque em <b>Conectar um aparelho</b>.</li>
          <li>4. Aponte a câmera para este QR Code.</li>
          <li className="text-xs text-slate-400">A página detecta a conexão sozinha em alguns segundos.</li>
        </ol>
      </div>

      {status.erro && (
        <p className="mt-3 text-xs text-amber-600">Z-API: {status.erro}</p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={buscarQr}
          disabled={carregandoQr}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {carregandoQr ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />} Gerar novo QR
        </button>
        <button
          onClick={() => startTransition(async () => { await reiniciarZapi(); await buscarQr(); })}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-60"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Reiniciar instância
        </button>
      </div>
    </div>
  );
}
