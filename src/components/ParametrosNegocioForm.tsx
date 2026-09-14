"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { salvarParametrosAction } from "@/lib/parametros-actions";
import type { Parametros } from "@/lib/parametros";
import { SlidersHorizontal, Loader2, Save } from "lucide-react";

const campo = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
const rotulo = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function ParametrosNegocioForm({ p }: { p: Parametros }) {
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    start(async () => {
      const r = await salvarParametrosAction(fd);
      setMsg(r.ok ? { ok: true, texto: "Parâmetros salvos. As telas e a IA já usam os novos valores." } : { ok: false, texto: r.erro ?? "Falha ao salvar." });
    });
  }

  return (
    <Card className="mb-6">
      <div className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
        <SlidersHorizontal size={18} className="text-brand-600" /> Parâmetros do negócio
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Comissão, meta, nomes, marcas, região e o número do briefing diário. Antes estavam fixos no código; agora valem em todas as telas e em todos os prompts da IA.
      </p>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className={rotulo} htmlFor="param-nomeCrm">Nome do CRM (menu e título)</label>
          <input id="param-nomeCrm" name="nomeCrm" defaultValue={p.nomeCrm} className={campo} />
        </div>
        <div>
          <label className={rotulo} htmlFor="param-nomeVendedor">Seu nome (como a IA se refere a você)</label>
          <input id="param-nomeVendedor" name="nomeVendedor" defaultValue={p.nomeVendedor} className={campo} />
        </div>
        <div>
          <label className={rotulo} htmlFor="param-nomeEmpresa">Empresa / concessionária</label>
          <input id="param-nomeEmpresa" name="nomeEmpresa" defaultValue={p.nomeEmpresa} className={campo} />
        </div>
        <div>
          <label className={rotulo} htmlFor="param-marcas">Marcas que você vende (para os prompts)</label>
          <input id="param-marcas" name="marcas" defaultValue={p.marcas} className={campo} />
        </div>
        <div>
          <label className={rotulo} htmlFor="param-regiao">Região de atuação (para os prompts)</label>
          <input id="param-regiao" name="regiao" defaultValue={p.regiao} className={campo} />
        </div>
        <div>
          <label className={rotulo} htmlFor="param-whatsappBriefing">WhatsApp que recebe o briefing diário (com DDI)</label>
          <input id="param-whatsappBriefing" name="whatsappBriefing" defaultValue={p.whatsappBriefing ?? ""} placeholder="5528999990000" inputMode="numeric" className={campo} />
        </div>
        <div>
          <label className={rotulo} htmlFor="param-taxa">Taxa de comissão (%)</label>
          <input id="param-taxa" name="taxaComissaoPct" defaultValue={(p.taxaComissao * 100).toString().replace(".", ",")} inputMode="decimal" className={campo} />
        </div>
        <div>
          <label className={rotulo} htmlFor="param-meta">Meta anual (máquinas)</label>
          <input id="param-meta" name="metaAnualVendas" type="number" min={1} defaultValue={p.metaAnualVendas} className={campo} />
        </div>
        <div className="flex items-center gap-3 md:col-span-2">
          <button type="submit" disabled={salvando} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-60">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar parâmetros
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.texto}</span>}
        </div>
      </form>
    </Card>
  );
}
