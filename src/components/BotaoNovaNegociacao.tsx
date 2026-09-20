"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { FormNovaNegociacao } from "@/components/FormNovaNegociacao";

// O botão "Gerar Negociação" da ficha do cliente.
//
// FormNovaNegociacao é um modal CONTROLADO (precisa de onFechar), então quem o
// abre tem de guardar o estado. Isso vivia dentro do card "Resumo do Cliente",
// que saiu a pedido do vendedor; o botão em si não era o problema e continua
// útil, então virou este componente próprio — pequeno e sem nada além disso.

type ColunaOpcao = { id: string; titulo: string; papel: string | null };
type MaquinaPropria = { marca: string; modelo: string };

export function BotaoNovaNegociacao({
  clienteId,
  colunas,
  maquinasProprias,
}: {
  clienteId: string;
  colunas: ColunaOpcao[];
  maquinasProprias: MaquinaPropria[];
}) {
  const [aberto, setAberto] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
      >
        <PlusCircle size={14} /> Gerar Negociação
      </button>
      {aberto && (
        <FormNovaNegociacao
          titulo="Gerar Negociação"
          clienteIdFixo={clienteId}
          colunas={colunas}
          maquinasProprias={maquinasProprias}
          onFechar={() => setAberto(false)}
          onSucesso={() => { setAberto(false); router.refresh(); }}
        />
      )}
    </>
  );
}
