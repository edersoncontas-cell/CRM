"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { limparContatosIndesejadosAction } from "@/lib/bloqueio-actions";
import type { ResultadoLimpeza } from "@/lib/contatos-bloqueados";
import { Ban, Loader2 } from "lucide-react";

type Recente = { nome: string | null; telefone: string; motivo: string | null; criadoEm: string };

export function ContatosBloqueadosCard({ termos, palavras, total, recentes }: { termos: string[]; palavras: string[]; total: number; recentes: Recente[] }) {
  const [resultado, setResultado] = useState<ResultadoLimpeza | null>(null);
  const [rodando, start] = useTransition();

  function limpar() {
    start(async () => { setResultado(await limparContatosIndesejadosAction()); });
  }

  return (
    <Card className="mt-6">
      <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
        <Ban size={18} className="text-red-500" /> Contatos que não são clientes
      </div>
      <p className="text-sm text-slate-600">
        Contatos cujo nome contém um destes termos nunca entram no CRM (WhatsApp, importação ou Google Contatos) e, se já
        existirem, são apagados com todo o histórico: conversas, mensagens, negociações e visitas. O telefone fica bloqueado
        para não voltar, e nada deles conta nos relatórios. A limpeza roda sozinha a cada hora.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[...termos, ...palavras].map((t) => (
          <span key={t} className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">{t}</span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={limpar} disabled={rodando} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
          {rodando ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Limpar agora
        </button>
        <span className="text-xs text-slate-500">{total} telefone(s) bloqueado(s)</span>
      </div>
      {resultado && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Apagados: {resultado.clientes} cliente(s), {resultado.conversas} conversa(s) e {resultado.mensagens} mensagem(ns) · {resultado.bloqueados} telefone(s) bloqueado(s) agora.
          {resultado.clientes + resultado.conversas === 0 && " Nada a apagar: o CRM já estava limpo."}
        </p>
      )}
      {recentes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {recentes.map((r) => (
            <li key={r.telefone}>
              <span className="font-semibold text-slate-700">{r.nome ?? "(sem nome)"}</span> · {r.telefone}{r.motivo ? ` · termo "${r.motivo}"` : ""} · {new Date(r.criadoEm).toLocaleDateString("pt-BR")}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
