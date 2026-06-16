"use client";

import dynamic from "next/dynamic";
import type { PontoMapa } from "./MapaClientes";

// Leaflet só funciona no cliente — carrega sem SSR.
const Mapa = dynamic(() => import("./MapaClientes"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
      Carregando mapa...
    </div>
  ),
});

export function MapaWrapper({ pontos }: { pontos: PontoMapa[] }) {
  return <Mapa pontos={pontos} />;
}
