"use client";

import dynamic from "next/dynamic";
import type { PontoVenda } from "@/lib/vendas-dashboard";
import type { MapaDaArea } from "@/lib/area-atuacao-regra";
import { SemMapaSemInternet } from "@/components/SemMapaSemInternet";

// Leaflet só funciona no cliente — carrega sem SSR.
const Mapa = dynamic(() => import("./MapaVendasES"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl text-sm" style={{ background: "#1d1038", color: "#7d6ba3" }}>
      Carregando mapa…
    </div>
  ),
});

// `isolate`: os z-index internos do Leaflet (até 1000) ficam presos aqui e
// param de competir com o resto da página.
export function MapaVendasWrapper(props: { pontosIniciais: PontoVenda[]; pontosTudoIniciais: PontoVenda[]; ano: number; mapa: MapaDaArea }) {
  return (
    <div className="isolate relative z-0">
      {/* Sem internet o arquivo do mapa não chega: só ele avisa, a tela fica. */}
      <SemMapaSemInternet altura={420}>
        <Mapa {...props} />
      </SemMapaSemInternet>
    </div>
  );
}
