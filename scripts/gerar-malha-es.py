#!/usr/bin/env python3
"""Gera src/lib/malha-es.json — as divisas dos 78 municípios do Espírito Santo.

Fonte: malha municipal do IBGE (qualidade mínima) na versão em GeoJSON do
repositório público tbrugz/geodata-br (geojs-32-mun.json). O CRM não busca isso
na internet ao abrir o mapa: o arquivo gerado vai junto com o código, então o
mapa funciona com sinal ruim e não depende de serviço de terceiro.

Uso (da raiz do repositório):
  curl -sSL https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-32-mun.json -o /tmp/geojs-32-mun.json
  python3 scripts/gerar-malha-es.py /tmp/geojs-32-mun.json

O que faz: arruma os anéis (ilhas viram polígonos próprios), guarda `id` (código IBGE), `nome` e `c` (o ponto do município mais
longe de qualquer divisa — onde o nome da cidade é escrito no mapa), arredonda as
coordenadas a 4 casas (~11 m — invisível no mapa) e tira pontos repetidos. Sem
simplificar a forma: o ponto compartilhado por dois municípios arredonda igual nos
dois, então a divisa não abre fresta entre vizinhos. `tests/mapa-regioes-es.test.ts`
confere o resultado (78 municípios com o nome igual ao do CRM, anéis fechados,
dentro do ES, `c` dentro do município).
"""
import heapq
import json
import math
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


def _dist2_segmento(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx or dy:
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        ax, ay = ax + dx * t, ay + dy * t
    return (px - ax) ** 2 + (py - ay) ** 2


def _distancia_com_sinal(x, y, aneis):
    """Distância do ponto até a borda: positiva dentro do polígono, negativa fora."""
    dentro = False
    menor = math.inf
    for a in aneis:
        j = len(a) - 1
        for i in range(len(a)):
            ax, ay = a[i]
            bx, by = a[j]
            if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
                dentro = not dentro
            menor = min(menor, _dist2_segmento(x, y, ax, ay, bx, by))
            j = i
    d = math.sqrt(menor)
    return d if dentro else -d


def _area(a):
    return abs(sum(a[i][0] * a[i + 1][1] - a[i + 1][0] * a[i][1] for i in range(len(a) - 1))) / 2


def _dentro_do_anel(x, y, a):
    dentro = False
    j = len(a) - 1
    for i in range(len(a)):
        ax, ay = a[i]
        bx, by = a[j]
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            dentro = not dentro
        j = i
    return dentro


def normalizar(poligonos):
    """Arruma a estrutura dos anéis: cada contorno de fora vira um polígono e cada buraco
    fica no polígono que o contém.

    A fonte põe, em Vitória, Vila Velha, Guarapari e Ibiraçu, as ilhas e o contorno
    principal como anéis soltos do MESMO polígono (e o principal por último) — em GeoJSON o
    primeiro anel é o de fora e os outros são buracos, então "o maior anel" não era o
    primeiro. O desenho saía certo (o preenchimento par-ímpar pinta cada anel), mas qualquer
    conta que parta do anel de fora (caixa da cidade, onde escrever o nome) errava. Um anel
    dentro de nenhum outro é de fora; dentro de um, é buraco; dentro de um buraco, é ilha de
    novo."""
    aneis = [r for p in poligonos for r in p]
    n = len(aneis)

    def dentro(i, j):  # o anel i está dentro do anel j? (maioria dos vértices, por causa dos que caem na borda)
        pts = aneis[i][:-1]
        return sum(1 for x, y in pts if _dentro_do_anel(x, y, aneis[j])) * 2 > len(pts)

    continentes = [[j for j in range(n) if j != i and _area(aneis[j]) > _area(aneis[i]) and dentro(i, j)] for i in range(n)]
    fora = [i for i in range(n) if len(continentes[i]) % 2 == 0]
    resultado = {i: [aneis[i]] for i in fora}
    for i in range(n):
        if len(continentes[i]) % 2 == 1:
            dono = min((j for j in continentes[i] if j in resultado), key=lambda j: _area(aneis[j]))
            resultado[dono].append(aneis[i])
    return [resultado[i] for i in sorted(fora, key=lambda i: -_area(aneis[i]))]


def ponto_do_nome(poligonos, precisao=1e-5):
    """Polo de inacessibilidade (algoritmo "polylabel" do Mapbox): o ponto do maior
    pedaço do município que fica mais longe de qualquer divisa (ilha inclusive). Dá o centro "visual"
    mesmo em município torto, onde o centro da caixa cai fora."""
    aneis = poligonos[0]  # o maior contorno de fora (normalizar ordena por área)
    xs = [x for x, _ in aneis[0]]
    ys = [y for _, y in aneis[0]]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    lado = min(maxx - minx, maxy - miny)
    if lado == 0:
        return [round(minx, CASAS), round(miny, CASAS)]
    h = lado / 2
    contador = 0
    fila = []

    def celula(cx, cy, hh):
        d = _distancia_com_sinal(cx, cy, aneis)
        return (-(d + hh * math.sqrt(2)), cx, cy, hh, d)

    x = minx
    while x < maxx:
        y = miny
        while y < maxy:
            c = celula(x + h, y + h, h)
            heapq.heappush(fila, (c[0], contador, c))
            contador += 1
            y += lado
        x += lado
    melhor = celula((minx + maxx) / 2, (miny + maxy) / 2, 0)
    while fila:
        _, _, c = heapq.heappop(fila)
        if c[4] > melhor[4]:
            melhor = c
        if -c[0] - melhor[4] <= precisao:
            continue
        hh = c[3] / 2
        for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            n = celula(c[1] + dx * hh, c[2] + dy * hh, hh)
            heapq.heappush(fila, (n[0], contador, n))
            contador += 1
    return [round(melhor[1], CASAS), round(melhor[2], CASAS)]


def main(origem: str) -> None:
    dados = json.loads(Path(origem).read_text(encoding="utf-8"))
    feicoes = []
    for f in dados["features"]:
        g = f["geometry"]
        poligonos = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        novos = normalizar([[anel(r) for r in p] for p in poligonos])
        geom = {"type": "Polygon", "coordinates": novos[0]} if len(novos) == 1 else {"type": "MultiPolygon", "coordinates": novos}
        props = {"id": str(f["properties"]["id"]), "nome": CORRIGIR_NOME.get(f["properties"]["name"], f["properties"]["name"]), "c": ponto_do_nome(novos)}
        feicoes.append({"type": "Feature", "properties": props, "geometry": geom})
    feicoes.sort(key=lambda f: f["properties"]["id"])
    SAIDA.write_text(json.dumps({"type": "FeatureCollection", "features": feicoes}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(feicoes)} municípios -> {SAIDA} ({SAIDA.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
