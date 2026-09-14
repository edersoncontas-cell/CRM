"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { FileDown, Loader2, ArrowLeft, Clock, Phone, MessageCircle } from "lucide-react";

type Linha = {
  conversaId: string;
  nome: string;
  telefone: string;
  resumo: string | null;
  mensagens: number;
  inicio: string;
  fim: string;
  duracaoTexto: string;
};

type Preset = "hoje" | "7" | "30" | "custom";

function hojeISO(deslocDias = 0): string {
  const d = new Date(Date.now() + deslocDias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function RelatorioConversasClient({ conversaId, conversaNome }: { conversaId: string | null; conversaNome: string | null }) {
  const [preset, setPreset] = useState<Preset>(conversaId ? "30" : "7");
  const [de, setDe] = useState(hojeISO(-7));
  const [ate, setAte] = useState(hojeISO());
  const [andamento, setAndamento] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);

  function periodo(): { de: string; ate: string } {
    const fim = `${preset === "custom" ? ate : hojeISO()}T23:59:59-03:00`;
    const iniData = preset === "hoje" ? hojeISO() : preset === "7" ? hojeISO(-7) : preset === "30" ? hojeISO(-30) : de;
    return { de: `${iniData}T00:00:00-03:00`, ate: fim };
  }

  function query(): string {
    const p = periodo();
    const q = new URLSearchParams({ de: p.de, ate: p.ate });
    if (conversaId) q.set("conversa", conversaId);
    return q.toString();
  }

  async function gerar() {
    setErro(null);
    setLinhas(null);
    setAndamento("Localizando conversas do período…");
    try {
      const p = periodo();
      // Prepara os resumos em lotes (cada chamada resume o que couber em ~40s).
      for (let i = 0; i < 40; i++) {
        const r = await fetch("/api/whatsapp/relatorio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ de: p.de, ate: p.ate, conversa: conversaId }),
        }).then((res) => res.json() as Promise<{ ok: boolean; total?: number; pendentes?: number; erro?: string }>);
        if (!r.ok) throw new Error(r.erro ?? "Falha ao preparar resumos.");
        const total = r.total ?? 0;
        const pendentes = r.pendentes ?? 0;
        if (total === 0) { setAndamento(null); setLinhas([]); return; }
        setAndamento(`Resumindo conversas com IA… ${total - pendentes}/${total}`);
        if (pendentes === 0) break;
      }

      setAndamento("Montando o PDF…");
      const prev = await fetch(`/api/whatsapp/relatorio?${query()}&formato=json`).then((res) => res.json() as Promise<{ ok: boolean; linhas: Linha[] }>);
      setLinhas(prev.linhas ?? []);
      // Baixa o PDF (a rota devolve como anexo — a página não sai daqui).
      window.location.assign(`/api/whatsapp/relatorio?${query()}`);
      setAndamento(null);
    } catch (e) {
      setAndamento(null);
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  const presets: { k: Preset; label: string }[] = [
    { k: "hoje", label: "Hoje" }, { k: "7", label: "Últimos 7 dias" }, { k: "30", label: "Últimos 30 dias" }, { k: "custom", label: "Período" },
  ];

  return (
    <div className="max-w-3xl">
      <Link href="/atendimento" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Voltar ao WhatsApp
      </Link>

      <Card className="mb-6">
        {conversaId && (
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
            <MessageCircle size={15} className="text-emerald-600" />
            Relatório somente da conversa com <b>{conversaNome}</b>.
            <Link href="/atendimento/relatorio" className="text-xs font-semibold text-brand-600 hover:underline">(todas as conversas)</Link>
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.k} onClick={() => setPreset(p.k)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${preset === p.k ? "bg-slate-900 text-agro-400" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="text-slate-500">De</label>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5" />
            <label className="text-slate-500">até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5" />
          </div>
        )}

        <button onClick={gerar} disabled={!!andamento}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {andamento ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          {andamento ?? "Gerar e baixar PDF"}
        </button>
        <p className="mt-2 text-xs text-slate-400">
          O resumo de cada conversa é feito pela IA uma única vez e reaproveitado — só é refeito se chegar mensagem nova.
        </p>
        {erro && <p className="mt-2 text-sm font-semibold text-red-600">{erro}</p>}
      </Card>

      {linhas && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-600">
            {linhas.length ? `${linhas.length} conversa(s) no relatório — o PDF foi baixado.` : "Nenhuma conversa com mensagens no período."}
          </div>
          {linhas.map((l, i) => (
            <Card key={l.conversaId}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-800">{i + 1}. {l.nome}</span>
                <Badge tom="slate"><Phone size={11} className="mr-1 inline" />{l.telefone}</Badge>
                <Badge tom="blue"><Clock size={11} className="mr-1 inline" />{l.duracaoTexto} · {l.mensagens} msg</Badge>
              </div>
              <div className="mb-2 text-xs text-slate-400">{fmt(l.inicio)} até {fmt(l.fim)}</div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{l.resumo ?? "Resumo ainda não gerado."}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
