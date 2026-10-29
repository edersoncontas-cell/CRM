"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import malha from "@/lib/malha-es.json";
import { alturaDaLinha, botoesDoContainer, calcularRotulos, desprojetar, FAMILIA_ROTULO, PESO_ROTULO, type FeicaoMalha, type ObstaculoRotulo } from "@/lib/mapa-rotulos-es";
import { corDoTexto, COR_NAO_ATENDO, regiaoDoMunicipio, chaveMunicipio, TEXTO_ESCURO, Z_NOMES } from "@/lib/mapa-regioes-es";

// O nome de cada cidade escrito DENTRO dela, só onde cabe (regras em
// lib/mapa-rotulos-es.ts). Fica numa camada própria, acima das divisas e abaixo
// dos pins/cifrões, e não recebe toque: o toque vai para a cidade (dica com o nome,
// a região e se ele atende). Sem a lista das cidades que ele atende não há cor de
// fundo para combinar o texto — nesse caso o mapa fica sem nomes.
//
// Se a conta falhar, o mapa NÃO cai: ficam as cores e a dica, e o contêiner marca
// data-rotulos="erro" (o teste de tela lê isso).

const FEICOES = (malha as unknown as { features: FeicaoMalha[] }).features;
const PANE = "rotulos-municipios";

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function RotulosMunicipiosES({ atendidos, obstaculos, rota }: { atendidos: string[] | null; obstaculos?: ObstaculoRotulo[]; rota?: [number, number][] }) {
  const mapa = useMap();

  useEffect(() => {
    const container = mapa.getContainer();
    if (!atendidos) { container.dataset.rotulos = "sem-lista"; return; }

    const conjunto = new Set(atendidos);
    const painel = mapa.getPane(PANE) ?? mapa.createPane(PANE);
    painel.style.zIndex = String(Z_NOMES);
    painel.style.pointerEvents = "none";
    const grupo = L.layerGroup().addTo(mapa);

    // Mede com a MESMA letra que vai na tela.
    const ctx = document.createElement("canvas").getContext("2d");
    const memo = new Map<string, number>();
    const medir = (texto: string, fonte: number) => {
      const k = `${fonte}|${texto}`;
      let v = memo.get(k);
      if (v === undefined) {
        if (ctx) ctx.font = `${PESO_ROTULO} ${fonte}px ${FAMILIA_ROTULO}`;
        v = ctx ? ctx.measureText(texto).width : texto.length * fonte * 0.62;
        memo.set(k, v);
      }
      return v;
    };

    const desenhar = () => {
      grupo.clearLayers();
      try {
        const zoom = mapa.getZoom();
        // O nome fica INTEIRO dentro da parte visível (com 4 px de folga): cortado pela borda do mapa é o "não enquadrado".
        const tela = mapa.getPixelBounds();
        const x0 = tela.min!.x;
        const y0 = tela.min!.y;
        const folga = 4;
        const visao = { x0: x0 + folga, y0: y0 + folga, x1: tela.max!.x - folga, y1: tela.max!.y - folga };
        // Os botões do mapa (+ / − e os créditos) também ficam por cima: o nome não vai embaixo deles.
        const obstaculosPx = botoesDoContainer(container, container.querySelectorAll(".leaflet-control"), { x: x0, y: y0 }, 3);
        const rotulos = calcularRotulos({ feicoes: FEICOES, zoom, visao, obstaculos, obstaculosPx, rota, medir });
        for (const r of rotulos) {
          const fundo = conjunto.has(chaveMunicipio("ES", r.nome)) ? regiaoDoMunicipio(r.nome).cor : COR_NAO_ATENDO;
          const cor = corDoTexto(fundo);
          const halo = cor === TEXTO_ESCURO ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.6)";
          const [lng, lat] = desprojetar(Math.round(r.x), Math.round(r.y), zoom);
          const icone = L.divIcon({
            className: "rotulo-municipio",
            iconSize: [r.largura, r.altura],
            iconAnchor: [r.largura / 2, r.altura / 2],
            html: `<span style="font:${PESO_ROTULO} ${r.fonte}px/${alturaDaLinha(r.fonte)}px ${FAMILIA_ROTULO};color:${cor};text-shadow:0 0 3px ${halo}">${r.linhas.map(escapar).join("<br>")}</span>`,
          });
          L.marker([lat, lng], { icon: icone, pane: PANE, interactive: false, keyboard: false }).addTo(grupo);
        }
        container.dataset.rotulos = "ok";
        container.dataset.rotulosQtd = String(rotulos.length);
        container.dataset.rotulosZoom = String(zoom);
      } catch {
        grupo.clearLayers();
        container.dataset.rotulos = "erro";
        container.dataset.rotulosQtd = "0";
      }
    };

    // zoomend e moveend vêm em sequência: junta num desenho só.
    let quadro = 0;
    const agendar = () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(desenhar); };
    const esconder = () => grupo.clearLayers();
    mapa.on("zoomstart", esconder);
    mapa.on("zoomend moveend", agendar);
    desenhar();
    return () => {
      cancelAnimationFrame(quadro);
      mapa.off("zoomstart", esconder);
      mapa.off("zoomend moveend", agendar);
      grupo.remove();
    };
  }, [mapa, atendidos, obstaculos, rota]);

  return null;
}
