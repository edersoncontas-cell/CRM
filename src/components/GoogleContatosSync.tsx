"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { sincronizarContatosGoogleAction } from "@/lib/google-actions";
import type { ResumoSincronizacao } from "@/lib/google-contatos";
import { Contact, Loader2, RefreshCw, AlertCircle } from "lucide-react";

function quando(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} dia(s)`;
}

// Faixa da tela de Clientes: estado da sincronização com o Google Contatos
// e o botão para rodar agora. Escuro, no tom da página.
export function GoogleContatosSync({ conectado, resumo, totalGoogle }: { conectado: boolean; resumo: ResumoSincronizacao | null; totalGoogle: number }) {
  const [ultimo, setUltimo] = useState<ResumoSincronizacao | null>(resumo);
  const [rodando, start] = useTransition();

  function sincronizar() {
    start(async () => { setUltimo(await sincronizarContatosGoogleAction()); });
  }

  const estilo = { background: "#18181b", border: "1px solid #27272a" } as const;

  if (!conectado) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm" style={estilo}>
        <Contact size={18} className="text-zinc-500" />
        <span className="text-zinc-300">Lista de clientes ainda não está ligada ao <b>Google Contatos</b>.</span>
        <Link href="/configuracoes" className="rounded-lg bg-[#ffcb2d] px-3 py-1.5 text-xs font-bold text-black hover:brightness-95">Conectar conta Google</Link>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm" style={estilo}>
      <Contact size={18} className="text-[#ffcb2d]" />
      <div className="min-w-0 flex-1 text-zinc-300">
        <b className="text-white">Google Contatos</b>
        {ultimo?.ok ? (
          <> · sincronizado {quando(ultimo.em)} · {ultimo.lidos} contato(s) lido(s)
            {ultimo.criados > 0 && <>, <span className="text-emerald-400">{ultimo.criados} cliente(s) novo(s)</span></>}
            {ultimo.atualizados > 0 && <>, {ultimo.atualizados} atualizado(s)</>}
            {ultimo.enviados > 0 && <>, {ultimo.enviados} enviado(s) ao Google</>}
            {ultimo.pendentesEnvio > 0 && <>, {ultimo.pendentesEnvio} ainda por enviar</>}
          </>
        ) : ultimo?.erro ? (
          <span className="text-red-400"> · <AlertCircle size={13} className="inline" /> {ultimo.erro}</span>
        ) : (
          <> · ainda não sincronizado</>
        )}
        <span className="text-zinc-500"> · {totalGoogle} cliente(s) ligado(s) a um contato · automático a cada hora</span>
      </div>
      <button onClick={sincronizar} disabled={rodando} className="inline-flex items-center gap-1.5 rounded-lg bg-[#ffcb2d] px-3 py-1.5 text-xs font-bold text-black hover:brightness-95 disabled:opacity-60">
        {rodando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {rodando ? "Sincronizando…" : "Sincronizar agora"}
      </button>
    </div>
  );
}
