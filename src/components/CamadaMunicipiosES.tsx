"use client";

import { useMemo } from "react";
import { GeoJSON } from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";
import type { Feature, GeoJsonObject } from "geojson";
import malha from "@/lib/malha-es.json";
import { estiloDoMunicipio, rotuloDoMunicipio } from "@/lib/mapa-regioes-es";

// As divisas entre as cidades do ES: colorida (a cor da região, como no Mapa do
// Turismo Capixaba) onde ele atende, cinza onde não atende. O desenho vem junto
// com o código (malha-es.json) — não depende de internet nem de serviço de
// terceiro; só os azulejos do OpenStreetMap por baixo precisam de sinal.
//
// Fica na camada de baixo do Leaflet: os pins e popups das visitas e o cifrão
// das vendas continuam recebendo o clique por cima.

const DADOS = malha as unknown as GeoJsonObject;
const nomeDe = (f?: Feature) => String((f?.properties as { nome?: unknown } | null | undefined)?.nome ?? "");

export function CamadaMunicipiosES({ atendidos }: { atendidos: string[] | null }) {
  const conjunto = useMemo(() => (atendidos ? new Set(atendidos) : null), [atendidos]);
  // O Leaflet liga o tooltip uma vez, ao criar a camada: lista nova = camada nova.
  const chave = atendidos ? `${atendidos.length}:${[...atendidos].sort().join("|")}` : "desconhecido";

  return (
    <GeoJSON
      key={chave}
      data={DADOS}
      style={(f) => estiloDoMunicipio(nomeDe(f), conjunto) as PathOptions}
      onEachFeature={(f: Feature, camada: Layer) => {
        const nome = nomeDe(f);
        const base = estiloDoMunicipio(nome, conjunto) as PathOptions;
        const c = camada as Layer & { setStyle: (o: PathOptions) => void; bringToFront: () => void };
        c.bindTooltip(rotuloDoMunicipio(nome, conjunto), { sticky: true, direction: "top", className: "tip-municipio" });
        c.on({
          mouseover: () => { c.setStyle({ weight: 2.5, opacity: 1, fillOpacity: Math.min(0.9, (base.fillOpacity ?? 0.5) + 0.15) }); c.bringToFront(); },
          mouseout: () => c.setStyle(base),
        });
      }}
    />
  );
}
