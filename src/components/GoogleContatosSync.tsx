"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sincronizarContatosGoogleAction } from "@/lib/google-actions";
import type { ResumoSincronizacao } from "@/lib/google-contatos";
import { dataCompleta, textosReconectar, type SituacaoGoogle } from "@/lib/google-conexao-regra";
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
//
// Quatro estados (lib/google-conexao-regra.ts): sem Google ligado, conectado,
// conectado com a última rodada falhando, e CAÍDO (o Google recusou renovar o
// acesso) — este último dizia só "Token has been expired or revoked." sem
// nenhum botão; agora diz o que aconteceu e traz o "Reconectar".
export function GoogleContatosSync({ situacao, totalGoogle }: { situacao: SituacaoGoogle<ResumoSincronizacao>; totalGoogle: number }) {
  const router = useRouter();
  const [resultado, setResultado] = useState<ResumoSincronizacao | null>(null);
  const [falhaAcao, setFalhaAcao] = useState<string | null>(null);
  const [rodando, start] = useTransition();

  function sincronizar() {
    setFalhaAcao(null);
    start(async () => {
      try {
        setResultado(await sincronizarContatosGoogleAction());
        // A rodada pode ter derrubado a conexão (ou reerguido): a faixa relê o estado.
        router.refresh();
      } catch {
        setFalhaAcao("Não consegui falar com o servidor. Confira a internet e tente de novo.");
      }
    });
  }

  const estilo = { background: "#18181b", border: "1px solid #27272a" } as const;

  if (situacao.tipo === "nao_configurado" || situacao.tipo === "desconectado") {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm" style={estilo}>
        <Contact size={18} className="text-zinc-500" />
        <span className="text-zinc-300">Lista de clientes ainda não está ligada ao <b>Google Contatos</b>.</span>
        <Link href="/configuracoes#google" className="rounded-lg bg-[#ffcb2d] px-3 py-1.5 text-xs font-bold text-black hover:brightness-95">Conectar conta Google</Link>
      </div>
    );
  }

  if (situacao.tipo === "reconectar") {
    const t = textosReconectar(situacao);
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm" style={{ background: "#18181b", border: "1px solid #7f1d1d" }} role="alert" data-google-estado="reconectar">
        <AlertCircle size={18} className="mt-0.5 shrink-0 self-start text-red-400" />
        <div className="min-w-0 flex-1 basis-64">
          <div><b className="text-white">Google Contatos</b> <span className="text-red-400">· {t.titulo}</span></div>
          <p className="mt-0.5 text-xs text-zinc-300">{t.efeito}</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {t.causa}{" "}
            <Link href="/configuracoes#google" className="text-[#ffcb2d] underline">Ver os passos</Link>
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{totalGoogle} cliente(s) continuam ligados a um contato.</p>
        </div>
        <a href="/api/google/auth" className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#ffcb2d] px-3 py-1.5 text-xs font-bold text-black hover:brightness-95 max-sm:w-full">
          <RefreshCw size={14} /> Reconectar com o Google
        </a>
      </div>
    );
  }

  // Conectado. O que acabou de rodar (botão) vale mais que o que veio da página
  // — a menos que a página já traga uma rodada mais nova (o cron rodou depois do clique).
  const ultimo = resultado && (!situacao.ultimo || resultado.em >= situacao.ultimo.em) ? resultado : situacao.ultimo;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm" style={estilo} data-google-estado="conectado">
      <Contact size={18} className="text-[#ffcb2d]" />
      <div className="min-w-0 flex-1 basis-64 text-zinc-300">
        <b className="text-white">Google Contatos</b>
        {falhaAcao ? (
          <span className="text-red-400"> · <AlertCircle size={13} className="inline" /> {falhaAcao}</span>
        ) : ultimo?.ok ? (
          <> · sincronizado {quando(ultimo.em)} · {ultimo.lidos} contato(s) lido(s)
            {ultimo.criados > 0 && <>, <span className="text-emerald-400">{ultimo.criados} cliente(s) novo(s)</span></>}
            {ultimo.atualizados > 0 && <>, {ultimo.atualizados} atualizado(s)</>}
            {ultimo.enviados > 0 && <>, {ultimo.enviados} enviado(s) ao Google</>}
            {ultimo.pendentesEnvio > 0 && <>, {ultimo.pendentesEnvio} ainda por enviar</>}
          </>
        ) : ultimo?.erro ? (
          <span className="text-red-400"> · <AlertCircle size={13} className="inline" /> falhou {quando(ultimo.em)}: {ultimo.erro}</span>
        ) : (
          <> · conectado em {dataCompleta(situacao.conectadoEm)} · ainda não sincronizou</>
        )}
        <span className="text-zinc-500"> · {totalGoogle} cliente(s) ligado(s) a um contato · automático a cada hora</span>
      </div>
      <button onClick={sincronizar} disabled={rodando} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#ffcb2d] px-3 py-1.5 text-xs font-bold text-black hover:brightness-95 disabled:opacity-60">
        {rodando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {rodando ? "Sincronizando…" : "Sincronizar agora"}
      </button>
    </div>
  );
}
