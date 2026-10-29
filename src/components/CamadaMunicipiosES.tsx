"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { GeoJSON, Pane, useMap } from "react-leaflet";
import type { Layer, LeafletEvent, LeafletMouseEvent, PathOptions, Tooltip } from "leaflet";
import type { Feature, GeoJsonObject } from "geojson";
import malha from "@/lib/malha-es.json";
import { COR_DIVISA, direcaoDaDica, estiloDoMunicipio, estiloRealce, rotuloDoMunicipio, Z_CONTORNO_ESTADO, Z_MUNICIPIOS, type CaixaDoMapa } from "@/lib/mapa-regioes-es";
import { botoesDoContainer, semIlhotas, type FeicaoMalha, type ObstaculoRotulo } from "@/lib/mapa-rotulos-es";
import { RotulosMunicipiosES } from "@/components/RotulosMunicipiosES";

// As divisas entre as cidades do ES: colorida (a cor da região, como no Mapa do
// Turismo Capixaba) onde ele atende, cinza escuro onde não atende, divisa preta,
// preenchimento opaco e o nome de cada cidade escrito dentro dela. O desenho vem
// junto com o código (malha-es.json) — não depende de internet nem de serviço de
// terceiro; só os azulejos do OpenStreetMap por baixo precisam de sinal.
//
// Camadas (de baixo para cima; as alturas estão em lib/mapa-regioes-es.ts, com
// teste de ordem): azulejos (200) → contorno grosso do estado → cidades → nomes →
// rotas/pins/cifrões (400/600). As cidades ficam em camadas PRÓPRIAS, e não na das
// rotas (400): lista nova recria a camada das cidades e, na camada das rotas, ela
// nasceria POR CIMA do trajeto do dia. Pins e popups das visitas e o cifrão das
// vendas continuam recebendo o clique por cima.

const DADOS = malha as unknown as GeoJsonObject;
// O traço grosso do contorno não vai nas ilhotas (viravam bolhas pretas no mar).
const DADOS_CONTORNO = { type: "FeatureCollection", features: semIlhotas((malha as unknown as { features: FeicaoMalha[] }).features) } as unknown as GeoJsonObject;
// Objeto fixo: o react-leaflet reaplica o estilo toda vez que a referência muda.
const ESTILO_CONTORNO: PathOptions = { color: COR_DIVISA, weight: 4, opacity: 1, fill: false };
/** O aparelho não tem mouse (celular/tablet): não existe "passar por cima", só tocar. */
const semMouse = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(hover: none)").matches;
const nomeDe = (f?: Feature) => String((f?.properties as { nome?: unknown } | null | undefined)?.nome ?? "");

export function CamadaMunicipiosES({ atendidos, obstaculos, rota }: { atendidos: string[] | null; obstaculos?: ObstaculoRotulo[]; rota?: [number, number][] }) {
  const mapa = useMap();
  const conjunto = useMemo(() => (atendidos ? new Set(atendidos) : null), [atendidos]);
  // O Leaflet liga o tooltip uma vez, ao criar a camada: lista nova = camada nova.
  const chave = atendidos ? `${atendidos.length}:${[...atendidos].sort().join("|")}` : "desconhecido";
  // Função de estilo ESTÁVEL (só muda com a lista): a cada render do pai o react-leaflet
  // reaplicaria o estilo nas 78 cidades e desfaria o realce da cidade sob o mouse.
  const estiloBase = useCallback((f?: Feature) => estiloDoMunicipio(nomeDe(f), conjunto) as PathOptions, [conjunto]);

  // Os botões do mapa (+ / − e os créditos) ficam POR CIMA da dica (z-index deles é maior que o do
  // painel das dicas): a dica evita o retângulo deles, em px do contêiner (o mesmo sistema do
  // `containerPoint` do Leaflet: sem a borda e com a escala descontadas).
  const botoesDoMapa = useCallback((): CaixaDoMapa[] => {
    const container = mapa.getContainer();
    return botoesDoContainer(container, container.querySelectorAll(".leaflet-control"), { x: 0, y: 0 }, 4);
  }, [mapa]);

  // Celular (sem mouse): a dica abre no toque e FICA aberta até ele tocar em outra cidade, tocar no
  // mapa vazio, mover o mapa ou girar o aparelho (a posição dela foi calculada para o tamanho antigo). O Leaflet fecha a dica no "mouseout", e o Chromium em modo celular
  // manda um logo depois do toque (conferido: antes desta mudança a dica abria e sumia na hora) —
  // e é pela dica que ele lê o nome das cidades onde o texto não cabe.
  const aberta = useRef<{ camada: Layer; clique: unknown } | null>(null);
  useEffect(() => {
    const fechar = (e: LeafletEvent) => {
      const atual = aberta.current;
      if (!atual) return;
      const clique = (e as LeafletMouseEvent).originalEvent;
      if (clique && clique === atual.clique) return; // é o MESMO clique que acabou de abrir a dica
      atual.camada.closeTooltip();
      aberta.current = null;
    };
    mapa.on("click movestart zoomstart resize", fechar);
    return () => { mapa.off("click movestart zoomstart resize", fechar); };
  }, [mapa]);

  return (
    <>
      {/* Contorno do estado: o mesmo desenho, em traço grosso, por BAIXO das cidades.
          As cidades (opacas) cobrem a metade de dentro do traço, inclusive nas divisas
          entre elas; só a metade de FORA aparece — o estado ganha uma borda preta mais
          forte que as divisas internas. Sem a lista (cidades quase transparentes) o
          traço grosso apareceria por dentro: não desenha. A camada fica sempre montada
          (só o desenho some): montar e desmontar a camada deixava um renderizador SVG
          órfão no mapa a cada vez que a lista alternava entre ausente e presente. */}
      <Pane name="estado-base" style={{ zIndex: Z_CONTORNO_ESTADO }}>
        {conjunto && <GeoJSON data={DADOS_CONTORNO} style={ESTILO_CONTORNO} interactive={false} />}
      </Pane>
      <Pane name="municipios" style={{ zIndex: Z_MUNICIPIOS }}>
        <GeoJSON
          key={chave}
          data={DADOS}
          style={estiloBase}
          onEachFeature={(f: Feature, camada: Layer) => {
            const nome = nomeDe(f);
            const base = estiloDoMunicipio(nome, conjunto) as PathOptions;
            const realce = estiloRealce(estiloDoMunicipio(nome, conjunto)) as PathOptions;
            const c = camada as Layer & { setStyle: (o: PathOptions) => void; bringToFront: () => void };
            // A seta é um pseudo-elemento fixo no meio da dica: com a dica deslocada ela apontava para
            // outra cidade. `--seta` (lido em globals.css) a empurra de volta para o dedo. No primeiro
            // "mouseover" a dica ainda não existe no DOM — quem aplica é o "tooltipopen".
            let seta = 0;
            const aplicarSeta = (dica: Tooltip | null | undefined) => dica?.getElement()?.style.setProperty("--seta", `${seta}px`);
            // A direção da dica sai de onde está o dedo/mouse (cidade colada na borda tinha a dica
            // cortada). Estes ouvintes entram ANTES do bindTooltip: o Leaflet dispara na ordem em que
            // foram ligados, então a direção já está certa quando ele posiciona a dica.
            const abrirOndeCabe = (e: LeafletMouseEvent) => {
              const dica = c.getTooltip();
              if (!dica || !e.containerPoint) return;
              // Se a conta falhar, a dica abre onde o Leaflet a puser (em cima): uma exceção aqui interromperia os
              // ouvintes seguintes — inclusive o que ABRE a dica — e a cidade ficaria muda.
              try {
                const tam = mapa.getSize();
                const onde = direcaoDaDica(e.containerPoint.x, e.containerPoint.y, tam.x, tam.y, botoesDoMapa());
                dica.options.direction = onde.direcao;
                dica.options.offset = onde.deslocamento;
                seta = onde.seta;
                aplicarSeta(dica);
              } catch { /* dica no lugar padrão */ }
            };
            c.on({ mouseover: abrirOndeCabe, mousemove: abrirOndeCabe, click: abrirOndeCabe, tooltipopen: () => aplicarSeta(c.getTooltip()) });
            c.bindTooltip(rotuloDoMunicipio(nome, conjunto), { sticky: true, direction: "top", className: "tip-municipio" });
            if (semMouse()) {
              c.off("mouseout", c.closeTooltip); // quem fecha é o próximo toque (efeito acima), não o "mouseout"
              // Registra a dica aberta no toque (compat: "mouseover" + "click") e também no "mouseover" sozinho
              // (tablet com mouse): sem isso ela nunca fechava, já que o "mouseout" não a fecha mais.
              const marcar = (e: LeafletMouseEvent) => {
                if (aberta.current && aberta.current.camada !== c) aberta.current.camada.closeTooltip();
                aberta.current = { camada: c, clique: e.originalEvent };
              };
              c.on({ mouseover: marcar, click: marcar });
            }
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
