"use client";

import { useMemo } from "react";
import { Handshake, CheckCircle2 } from "lucide-react";
import { useFilaSemSinal, useOnline } from "@/components/sem-sinal/useSemSinal";
import { SeloSincronia } from "@/components/sem-sinal/ListasSemSinal";
import { negociacoesForaDaTela, formatarReais } from "@/lib/sem-sinal-regra";
import { PAGINA_SEM_SINAL } from "@/lib/sem-sinal-sincronia";

// AS NEGOCIAÇÕES FEITAS NO MODO SEM SINAL, na tela de Negociações (e na ficha
// do cliente) — com e sem internet.
//
// A tela vem do servidor (ou da cópia guardada, sem sinal) e não sabe do que
// ele abriu na rua e ainda não subiu. Sem este bloco, a negociação nova só
// aparecia no modo sem sinal: em Negociações ela "sumia" até subir e a cópia
// ser refeita. Aqui ela aparece à parte, dizendo em que pé está.
//
// Vazio (o normal) e lendo: nada aparece. Aparelho que não deixa ler o
// armazenamento também não guardou nada pelo modo sem sinal — não há o que
// avisar.
export function NegociacoesFeitasSemSinal({ montadaEm, clienteId }: { montadaEm: number; clienteId?: string }) {
  const fila = useFilaSemSinal();
  const online = useOnline();
  const lista = useMemo(() => (fila ? negociacoesForaDaTela(fila, montadaEm, clienteId) : []), [fila, montadaEm, clienteId]);
  if (!lista.length) return null;

  // Na ficha, abaixo vem a lista do cliente; em Negociações, o funil.
  const abaixo = clienteId ? "na lista abaixo" : "no funil abaixo";
  const esperando = lista.filter((r) => r.estado === "pendente").length;
  const recusadas = lista.filter((r) => r.estado === "erro").length;
  const frase = esperando
    ? online
      ? `Ainda não estão ${abaixo}: estão subindo para o CRM agora.`
      : `Ainda não estão ${abaixo}: ficam guardadas neste aparelho e sobem sozinhas quando a internet voltar.`
    : recusadas
      ? "O CRM não aceitou — o motivo está em cada uma. Dá para corrigir e tentar de novo em Pendentes."
      : online
        ? `Já subiram para o CRM, mas esta tela é de antes delas. Atualize para vê-las ${clienteId ? "na lista" : "no funil"}.`
        : "Já subiram para o CRM, mas esta tela guardada é de antes delas.";

  return (
    <section aria-label="Negociações feitas sem sinal" className="mb-4 rounded-2xl border border-amber-300 bg-white p-3 text-slate-800 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <Handshake size={15} className="shrink-0 text-amber-600" /> Feitas sem sinal neste aparelho
        </h2>
        <span className="shrink-0 text-[11px] text-slate-500">{lista.length}</span>
      </div>
      <p className="mt-0.5 text-xs leading-snug text-slate-600">{frase}</p>
      {/* Lista em card: altura fixa com rolagem por dentro (celular, na rua). */}
      <ul className="mt-2 max-h-60 divide-y divide-slate-100 overflow-y-auto">
        {lista.map((r) => {
          const maquina = [r.op.marca, r.op.maquinaModelo].filter(Boolean).join(" ");
          return (
            <li key={r.op.id} className="py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="break-words text-sm font-semibold text-slate-900">{r.op.clienteNome}</span>
                {r.estado === "enviado" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 size={11} /> já subiu
                  </span>
                ) : (
                  <SeloSincronia sync={r.estado} />
                )}
              </div>
              <div className="text-xs text-slate-600">
                {maquina || "máquina não informada"} · {formatarReais(r.op.valor)} · {r.op.estagio}
              </div>
              {r.estado === "erro" && r.erro && <div className="mt-0.5 break-words text-xs font-semibold text-red-700">Não subiu: {r.erro}</div>}
            </li>
          );
        })}
      </ul>
      {recusadas > 0 && (
        <a href={`${PAGINA_SEM_SINAL}?aba=pendentes`} className="mt-1 inline-block text-xs font-bold text-red-700 underline">
          Abrir Pendentes
        </a>
      )}
    </section>
  );
}
