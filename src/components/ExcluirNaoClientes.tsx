"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, Ban } from "lucide-react";
import { excluirNaoClientes } from "@/lib/actions";

/**
 * Exclui de uma vez os cadastros marcados como "Não é cliente".
 *
 *   "Quero que os contatos classificados como não clientes sejam excluídos,
 *    ao google contatos realizar novamente a sincronização, ele não pode
 *    voltar"
 *
 * Duas decisões que valem explicar:
 *
 * 1) NÃO é automático. O status "nao_cliente" também é posto sozinho, por
 *    termo no nome ("pme", "hotel", "contador"…), e apagar em cima de um
 *    palpite desses levaria junto cadastro bom — uma terraplanagem chamada
 *    "Hotel Ltda", por exemplo. A aba mostra quem são; o vendedor olha e
 *    manda.
 *
 * 2) A exclusão grava a LÁPIDE de cada um: telefone, nome e id no Google.
 *    Sem isso a rodada seguinte do Google (de hora em hora) recriaria todos,
 *    e excluir viraria tarefa recorrente. Quem se arrepender libera em
 *    Configurações › Contatos que não são clientes.
 */
export function ExcluirNaoClientes({ total }: { total: number }) {
  const [confirmando, setConfirmando] = useState(false);
  const [feito, setFeito] = useState<number | null>(null);
  const [excluindo, start] = useTransition();

  // Nada marcado e nada excluído nesta visita: não há o que dizer.
  if (total === 0 && feito == null) return null;

  if (feito != null) {
    return (
      <p className="mb-4 rounded-xl border border-emerald-800/40 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-200">
        {feito} cadastro(s) excluído(s). Nenhum deles volta pela sincronização do Google — se algum foi engano, libere em
        <b> Configurações › Contatos que não são clientes</b>.
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-800/40 bg-red-900/20 px-3 py-2.5">
        <p className="min-w-0 flex-1 text-xs text-red-100">
          <b>{total} cadastro(s)</b> marcados como &quot;não é cliente&quot;. Excluir apaga cada um com o histórico e registra que ele
          <b> não pode voltar</b> na próxima sincronização do Google Contatos.
        </p>
        <button
          onClick={() => setConfirmando(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700"
        >
          <Trash2 size={14} /> Excluir todos
        </button>
      </div>

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmando(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <Ban size={18} className="text-red-600" />
              <h2 className="text-lg font-bold text-slate-800">Excluir os não clientes</h2>
            </div>
            <p className="text-sm text-slate-600">
              Vão sair <b>{total} cadastro(s)</b>, com conversas, negociações e visitas de cada um. E cada um fica registrado para
              <b> não voltar</b> pelo Google Contatos.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Confira a lista antes: o rótulo &quot;não é cliente&quot; também é posto automaticamente por palavra no nome.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmando(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                disabled={excluindo}
                onClick={() => start(async () => {
                  const r = await excluirNaoClientes();
                  setFeito(r.excluidos);
                  setConfirmando(false);
                })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {excluindo ? "Excluindo…" : `Excluir ${total}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
