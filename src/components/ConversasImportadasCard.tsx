"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { lerImportadasAction, repararImportadasAction } from "@/lib/whatsapp-importadas-actions";
import type { ResumoImportadas } from "@/lib/whatsapp-importadas";
import { FileUp, Loader2, Wrench } from "lucide-react";

// Espaço de configuração do WhatsApp: conversas que vieram de arquivo
// exportado e ficaram sem contato — o CRM não sabia de quem eram e não
// deixava responder.
export function ConversasImportadasCard({ inicial }: { inicial: ResumoImportadas }) {
  const [resumo, setResumo] = useState<ResumoImportadas>(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function reparar() {
    if (ocupado || resumo.total === 0) return;
    if (!window.confirm(`Consertar ${resumo.comCliente} conversa(s) importada(s)? Elas passam a usar o telefone do cadastro e, quando já existe conversa daquele cliente, o histórico é juntado numa só. Nenhuma mensagem é apagada.`)) return;
    setOcupado(true); setAviso(null);
    try {
      const r = await repararImportadasAction();
      setResumo(await lerImportadasAction());
      setAviso(
        r.vinculadas + r.mescladas === 0
          ? "Nada a consertar: nenhuma delas tem cliente com o mesmo nome cadastrado."
          : `${r.vinculadas} vinculada(s) ao cadastro · ${r.mescladas} juntada(s) à conversa que já existia (${r.mensagensMovidas} mensagem(ns) movidas)${r.semCadastro ? ` · ${r.semCadastro} sem cadastro de mesmo nome` : ""}.`
      );
    } catch {
      setAviso("Não consegui consertar agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card className="mt-6">
      <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
        <FileUp size={18} className="text-brand-600" /> Conversas importadas sem contato
      </div>
      <p className="text-sm text-slate-600">
        O arquivo exportado do WhatsApp não traz o telefone, só o nome. As conversas importadas antes desta correção ficaram sem cadastro e
        com um telefone de faz de conta — por isso o CRM não reconhecia o contato nem deixava responder. O conserto procura o cliente de
        mesmo nome, passa a usar o telefone dele e, se já existir conversa daquele cliente, junta o histórico numa só.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={reparar} disabled={ocupado || resumo.comCliente === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
          {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
          {resumo.comCliente > 0 ? `Consertar ${resumo.comCliente}` : "Nada a consertar"}
        </button>
        <span className="text-xs text-slate-500">
          {resumo.total === 0
            ? "Nenhuma conversa importada pendente."
            : `${resumo.total} conversa(s) importada(s) sem telefone real · ${resumo.comCliente} com cliente de mesmo nome${resumo.semCliente ? ` · ${resumo.semCliente} sem cadastro correspondente` : ""}.`}
        </span>
      </div>
      {resumo.semCliente > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          As que não têm cadastro de mesmo nome ficam como estão. Cadastre o cliente com o nome exato que aparece na conversa (em Clientes) e
          rode o conserto de novo.
        </p>
      )}
      {aviso && <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{aviso}</div>}
    </Card>
  );
}
