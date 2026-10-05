#!/usr/bin/env python3
"""Gera src/lib/municipios-brasil.json — os 5.570 municípios do Brasil, por UF,
com coordenada da sede e código IBGE. É a base da área de atuação configurável
(Configurações → Área de atuação): qualquer estado pode ser escolhido.

Fonte: kelvins/municipios-brasileiros (licença MIT, © 2016 Kelvin S. do Prado),
https://github.com/kelvins/municipios-brasileiros — csv/municipios.csv e
csv/estados.csv, copiados em scripts/dados/. Para atualizar: baixe os dois CSV de
novo para scripts/dados/ e rode `python3 scripts/gerar-municipios-brasil.py`.

Formato: {"estados": [[uf, nome, lat, lng, codigo_ibge_da_uf], ...],
          "municipios": {uf: [[nome, lat, lng, ibge], ...]}}  (por nome, pt-BR)
"""
import csv, json, os, locale

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

def ler(nome):
    with open(os.path.join(AQUI, "dados", nome), encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

estados = ler("estados.csv")
uf_por_codigo = {e["codigo_uf"]: e["uf"] for e in estados}

def chave(s):
    import unicodedata
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()

# Nome oficial do IBGE onde a fonte veio sem acento (achado ao comparar com a
# lista que o CRM já usava para o ES).
CORRECOES = {3200706: "Atílio Vivácqua"}

municipios = {}
for m in ler("municipios.csv"):
    m["nome"] = CORRECOES.get(int(m["codigo_ibge"]), m["nome"])
    uf = uf_por_codigo[m["codigo_uf"]]
    municipios.setdefault(uf, []).append([m["nome"], round(float(m["latitude"]), 4), round(float(m["longitude"]), 4), int(m["codigo_ibge"])])
for uf in municipios:
    municipios[uf].sort(key=lambda x: chave(x[0]))

saida = {
    "estados": sorted([[e["uf"], e["nome"], float(e["latitude"]), float(e["longitude"]), int(e["codigo_uf"])] for e in estados], key=lambda x: chave(x[1])),
    "municipios": dict(sorted(municipios.items())),
}
destino = os.path.join(RAIZ, "src", "lib", "municipios-brasil.json")
with open(destino, "w", encoding="utf-8") as f:
    json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
total = sum(len(v) for v in municipios.values())
print(f"{len(estados)} estados, {total} municípios → {os.path.relpath(destino, RAIZ)} ({os.path.getsize(destino)//1024} KB)")
