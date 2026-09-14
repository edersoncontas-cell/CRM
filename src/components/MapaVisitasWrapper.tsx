"use client";

import dynamic from "next/dynamic";
import type { VisitaMapa, DiaMapa } from "./MapaVisitasES";

const Mapa = dynamic(() => import("./MapaVisitasES"), {
  ssr: false,
  loading: () => <div className="flex h-[460px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400">Carregando mapa do Espírito Santo…</div>,
});

export function MapaVisitasWrapper(props: { visitas: VisitaMapa[]; dias: DiaMapa[]; diaInicial: string }) {
  return <Mapa {...props} />;
}
