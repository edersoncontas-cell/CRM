"use client";

import dynamic from "next/dynamic";
import type { VisitaMapa, DiaMapa } from "./MapaVisitasES";

const Mapa = dynamic(() => import("./MapaVisitasES"), {
  ssr: false,
  loading: () => <div className="flex h-[460px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400">Carregando mapa do Espírito Santo…</div>,
});

// `isolate` prende os z-index do Leaflet (que chegam a 1000 nos controles)
// dentro deste bloco. Sem isso eles competiam com o resto da página e o mapa
// cobria qualquer janela aberta por cima — o formulário de nova visita ficava
// atrás dele.
export function MapaVisitasWrapper(props: { visitas: VisitaMapa[]; dias: DiaMapa[]; diaInicial: string }) {
  return (
    <div className="isolate relative z-0">
      <Mapa {...props} />
    </div>
  );
}
