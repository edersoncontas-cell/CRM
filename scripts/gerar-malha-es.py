#!/usr/bin/env python3
"""Gera src/lib/malha-es.json — as divisas dos 78 municípios do Espírito Santo.

Fonte: malha municipal do IBGE (qualidade mínima) na versão em GeoJSON do
repositório público tbrugz/geodata-br (geojs-32-mun.json). O CRM não busca isso
na internet ao abrir o mapa: o arquivo gerado vai junto com o código, então o
mapa funciona com sinal ruim e não depende de serviço de terceiro.

Uso (da raiz do repositório):
  curl -sSL https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-32-mun.json -o /tmp/geojs-32-mun.json
  python3 scripts/gerar-malha-es.py /tmp/geojs-32-mun.json

O que faz: guarda só `id` (código IBGE) e `nome`, arredonda as coordenadas a
4 casas (~11 m — invisível no mapa) e tira pontos repetidos. Sem simplificar a
forma: o ponto compartilhado por dois municípios arredonda igual nos dois, então
a divisa não abre fresta entre vizinhos. `tests/mapa-regioes-es.test.ts` confere
o resultado (78 municípios com o nome igual ao do CRM, anéis fechados, dentro do ES).
"""
import json
import sys
from pathlib import Path

CASAS = 4
# O arquivo de origem escreve esse município sem acento; o CRM (e o IBGE) com.
CORRIGIR_NOME = {"Atilio Vivacqua": "Atílio Vivácqua"}
SAIDA = Path(__file__).resolve().parent.parent / "src" / "lib" / "malha-es.json"


def anel(pontos):
    out = []
    for x, y in pontos:
        q = [round(x, CASAS), round(y, CASAS)]
        if not out or out[-1] != q:
            out.append(q)
    if out[0] != out[-1]:
        out.append(list(out[0]))
    return out


def main(origem: str) -> None:
    dados = json.loads(Path(origem).read_text(encoding="utf-8"))
    feicoes = []
    for f in dados["features"]:
        g = f["geometry"]
        poligonos = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        novos = [[anel(r) for r in p] for p in poligonos]
        geom = {"type": "Polygon", "coordinates": novos[0]} if len(novos) == 1 else {"type": "MultiPolygon", "coordinates": novos}
        feicoes.append({"type": "Feature", "properties": {"id": str(f["properties"]["id"]), "nome": CORRIGIR_NOME.get(f["properties"]["name"], f["properties"]["name"])}, "geometry": geom})
    feicoes.sort(key=lambda f: f["properties"]["id"])
    SAIDA.write_text(json.dumps({"type": "FeatureCollection", "features": feicoes}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(feicoes)} municípios -> {SAIDA} ({SAIDA.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
