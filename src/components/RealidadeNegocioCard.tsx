"use client";

// Card de Configurações com as regras da realidade do negócio — as mesmas da
// Academia. Fica nos dois lugares de propósito: quem descobre a regra
// treinando cadastra ali mesmo, e quem procura configuração acha aqui.

import { useState } from "react";
import { Card } from "@/components/ui";
import { Settings2, Plus, Trash2, Loader2, CheckCircle2, Wand2 } from "lucide-react";
import { adicionarRealidadeAction, removerRealidadeAction, escreverRegraComIAAction } from "@/lib/academia/acoes";
import type { RegraNegocio } from "@/lib/contexto-negocio";

export function RealidadeNegocioCard({ inicial, temIA }: { inicial: RegraNegocio[]; temIA: boolean }) {
  const [regras, setRegras] = useState(inicial);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar(comIA: boolean) {
    setOcupado(true); setErro(null);
    let final = texto;
    if (comIA) {
      const r = await escreverRegraComIAAction(texto);
      if (r.ok && r.texto) final = r.texto;
    }
    const r = await adicionarRealidadeAction(final);
    setOcupado(false);
    if (!r.ok || !r.regras) { setErro(r.erro ?? "Não consegui salvar."); return; }
    setRegras(r.regras);
    setTexto("");
  }

  async function remover(id: string) {
    setRegras(await removerRealidadeAction(id));
  }

  return (
    <Card className="mt-6">
      <div className="mb-1 flex items-center gap-2">
        <Settings2 size={18} className="shrink-0 text-violet-600" />
        <h2 className="text-sm font-bold text-slate-800">A realidade do seu negócio</h2>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        As regras que a IA inteira tem de seguir — Academia, Orientador do WhatsApp, Cérebro e Marketing.
        É aqui que se corrige o que um conteúdo de vendas ensina mas não vale aqui (por exemplo, aceitar máquina
        do cliente como entrada).
      </p>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: não trabalhamos com máquina como entrada; a entrada é em dinheiro"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400"
        />
        <div className="flex gap-2">
          <button onClick={() => adicionar(false)} disabled={ocupado || texto.trim().length < 10} className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Guardar
          </button>
          {temIA && (
            <button onClick={() => adicionar(true)} disabled={ocupado || texto.trim().length < 10} title="A IA deixa a regra clara antes de guardar" className="inline-flex items-center gap-1 rounded-xl border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-700 disabled:opacity-50">
              <Wand2 size={13} /> Escrever melhor
            </button>
          )}
        </div>
      </div>
      {erro && <p className="mb-2 text-xs text-red-600">{erro}</p>}

      <ul className="space-y-1.5">
        {regras.map((r) => (
          <li key={r.id} className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5 text-sm text-slate-700">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-violet-500" />
            <span className="flex-1">{r.texto}</span>
            <button onClick={() => remover(r.id)} title="Remover" className="shrink-0 text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
          </li>
        ))}
        {regras.length === 0 && <li className="text-xs text-slate-500">Nenhuma regra cadastrada.</li>}
      </ul>
    </Card>
  );
}
