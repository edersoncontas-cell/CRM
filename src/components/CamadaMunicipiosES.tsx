"use client";

import { useMemo } from "react";
import { GeoJSON, Pane } from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";
import type { Feature, GeoJsonObject } from "geojson";
import malha from "@/lib/malha-es.json";
import { COR_DIVISA, estiloDoMunicipio, estiloRealce, rotuloDoMunicipio } from "@/lib/mapa-regioes-es";
import { semIlhotas, type FeicaoMalha, type ObstaculoRotulo } from "@/lib/mapa-rotulos-es";
import { RotulosMunicipiosES } from "@/components/RotulosMunicipiosES";

// As divisas entre as cidades do ES: colorida (a cor da região, como no Mapa do
// Turismo Capixaba) onde ele atende, cinza escuro onde não atende, divisa preta,
// preenchimento opaco e o nome de cada cidade escrito dentro dela. O desenho vem
// junto com o código (malha-es.json) — não depende de internet nem de serviço de
// terceiro; só os azulejos do OpenStreetMap por baixo precisam de sinal.
//
// Camadas (de baixo para cima): azulejos (200) → contorno grosso do estado (340)
// → cidades (350) → nomes (380) → rotas/pins/cifrões (400/600). As cidades ficam
// em camadas PRÓPRIAS, e não na das rotas (400): lista nova recria a camada das
// cidades e, na camada das rotas, ela nasceria POR CIMA do trajeto do dia. Pins e
// popups das visitas e o cifrão das vendas continuam recebendo o clique por cima.

const DADOS = malha as unknown as GeoJsonObject;
// O traço grosso do contorno não vai nas ilhotas (viravam bolhas pretas no mar).
const DADOS_CONTORNO = { type: "FeatureCollection", features: semIlhotas((malha as unknown as { features: FeicaoMalha[] }).features) } as unknown as GeoJsonObject;
const nomeDe = (f?: Feature) => String((f?.properties as { nome?: unknown } | null | undefined)?.nome ?? "");

export function CamadaMunicipiosES({ atendidos, obstaculos, rota }: { atendidos: string[] | null; obstaculos?: ObstaculoRotulo[]; rota?: [number, number][] }) {
  const conjunto = useMemo(() => (atendidos ? new Set(atendidos) : null), [atendidos]);
  // O Leaflet liga o tooltip uma vez, ao criar a camada: lista nova = camada nova.
  const chave = atendidos ? `${atendidos.length}:${[...atendidos].sort().join("|")}` : "desconhecido";

  return (
    <>
      {/* Contorno do estado: o mesmo desenho, em traço grosso, por BAIXO das cidades.
          As cidades (opacas) cobrem a metade de dentro do traço, inclusive nas divisas
          entre elas; só a metade de FORA aparece — o estado ganha uma borda preta mais
          forte que as divisas internas. Sem a lista (cidades quase transparentes) o
          traço grosso apareceria por dentro: não desenha. */}
      {conjunto && (
        <Pane name="estado-base" style={{ zIndex: 340 }}>
          <GeoJSON data={DADOS_CONTORNO} style={() => ({ color: COR_DIVISA, weight: 4, opacity: 1, fill: false })} interactive={false} />
        </Pane>
      )}
      <Pane name="municipios" style={{ zIndex: 350 }}>
        <GeoJSON
          key={chave}
          data={DADOS}
          style={(f) => estiloDoMunicipio(nomeDe(f), conjunto) as PathOptions}
          onEachFeature={(f: Feature, camada: Layer) => {
            const nome = nomeDe(f);
            const base = estiloDoMunicipio(nome, conjunto) as PathOptions;
            const realce = estiloRealce(estiloDoMunicipio(nome, conjunto)) as PathOptions;
            const c = camada as Layer & { setStyle: (o: PathOptions) => void; bringToFront: () => void };
            c.bindTooltip(rotuloDoMunicipio(nome, conjunto), { sticky: true, direction: "top", className: "tip-municipio" });
            c.on({
              mouseover: () => { c.setStyle(realce); c.bringToFront(); },
              mouseout: () => c.setStyle(base),
            });
          }}
        />
      </Pane>
      <RotulosMunicipiosES atendidos={atendidos} obstaculos={obstaculos} rota={rota} />
    </>
  );
}
