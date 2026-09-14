"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from "react-leaflet";
import L from "leaflet";
import type { GeoJsonObject } from "geojson";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { CENTRO_ES, LIMITES_ES } from "@/lib/municipios-es";
import { T } from "@/lib/dash-tema";
import type { PontoVenda } from "@/lib/vendas-dashboard";

// Contorno do estado (IBGE, gratuito, sem chave). Se a busca falhar, o mapa
// segue só com os azulejos escuros — nada quebra.
const URL_CONTORNO_ES = "https://servicodados.ibge.gov.br/api/v3/malhas/estados/32?formato=application/vnd.geo+json&qualidade=minima";

function iconeCifrao(vendas: number, max: number): L.DivIcon {
  const tamanho = Math.round(26 + (vendas / max) * 22);
  return L.divIcon({
    className: "",
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
    popupAnchor: [0, -tamanho / 2],
    html: `<div style="width:${tamanho}px;height:${tamanho}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;
      background:radial-gradient(circle at 30% 30%, #ffe27a, #ffb81c 60%, #e09e00);color:#111;font-weight:900;font-size:${Math.round(tamanho * 0.55)}px;
      box-shadow:0 0 0 3px rgba(255,184,28,0.25), 0 6px 16px rgba(0,0,0,0.5);border:2px solid #fff3c4;">$</div>`,
  });
}

export default function MapaVendasES({
  pontosIniciais, pontosTudoIniciais, ano,
}: { pontosIniciais: PontoVenda[]; pontosTudoIniciais: PontoVenda[]; ano: number }) {
  const [modo, setModo] = useState<"ano" | "tudo">("ano");
  const [pontosAno, setPontosAno] = useState(pontosIniciais);
  const [pontosTudo, setPontosTudo] = useState(pontosTudoIniciais);
  const [contorno, setContorno] = useState<GeoJsonObject | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  useEffect(() => { setPontosAno(pontosIniciais); }, [pontosIniciais]);
  useEffect(() => { setPontosTudo(pontosTudoIniciais); }, [pontosTudoIniciais]);

  useEffect(() => {
    let ativo = true;
    fetch(URL_CONTORNO_ES).then((r) => (r.ok ? r.json() : null)).then((g) => { if (ativo && g) setContorno(g as GeoJsonObject); }).catch(() => {});
    return () => { ativo = false; };
  }, []);

  // Atualização "ao vivo": a cada 60s e sempre que a aba volta ao foco.
  useEffect(() => {
    let ativo = true;
    const buscar = async () => {
      try {
        const [a, t] = await Promise.all([
          fetch(`/api/dashboard/vendas-mapa?ano=${ano}`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`/api/dashboard/vendas-mapa`, { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (!ativo) return;
        if (a?.ok) setPontosAno(a.pontos);
        if (t?.ok) setPontosTudo(t.pontos);
        setAtualizadoEm(new Date());
      } catch { /* mantém os pontos atuais */ }
    };
    const id = setInterval(buscar, 60_000);
    const aoFocar = () => { if (document.visibilityState === "visible") buscar(); };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoFocar);
    return () => { ativo = false; clearInterval(id); window.removeEventListener("focus", aoFocar); document.removeEventListener("visibilitychange", aoFocar); };
  }, [ano]);

  const pontos = modo === "ano" ? pontosAno : pontosTudo;
  const max = useMemo(() => Math.max(1, ...pontos.map((p) => p.vendas)), [pontos]);
  const totalVendas = pontos.reduce((s, p) => s + p.vendas, 0);
  const totalValor = pontos.reduce((s, p) => s + p.valor, 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: T.sobreEscuro }}>
          {(["ano", "tudo"] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)}
              className="rounded-md px-2.5 py-1 text-xs font-bold"
              style={modo === m ? { background: T.rosa, color: "#fff", boxShadow: `0 0 12px ${T.rosa}66` } : { color: T.texto2 }}>
              {m === "ano" ? String(ano) : "Todas"}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{ color: T.texto2 }}>
          {pontos.length} cidade{pontos.length === 1 ? "" : "s"} · {totalVendas} venda{totalVendas === 1 ? "" : "s"} · {formatCurrency(totalValor)}
          {atualizadoEm && <span style={{ color: T.mudo }}> · atualizado {atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
        </span>
      </div>
      <MapContainer
        center={CENTRO_ES}
        zoom={7}
        minZoom={6}
        maxBounds={LIMITES_ES}
        maxBoundsViscosity={0.8}
        scrollWheelZoom={false}
        style={{ height: 420, width: "100%", borderRadius: "1rem", background: T.fundoSolido, border: `1px solid ${T.borda}` }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {contorno && (
          <GeoJSON data={contorno} style={{ color: T.rosa, weight: 1.5, fillColor: T.violeta, fillOpacity: 0.10 }} interactive={false} />
        )}
        {pontos.map((p) => (
          <Marker key={p.municipioId} position={[p.lat, p.lng]} icon={iconeCifrao(p.vendas, max)}>
            <Popup maxWidth={320}>
              <div className="text-sm">
                <b>{p.nome}</b><br />
                {p.vendas} venda{p.vendas === 1 ? "" : "s"} · {formatCurrency(p.valor)}
                {p.ultimaVenda && <span className="text-xs text-slate-500"> · última em {new Date(p.ultimaVenda).toLocaleDateString("pt-BR")}</span>}
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t border-slate-200 pt-2">
                  {(p.clientes ?? []).map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-2 text-xs leading-tight">
                      <span className="min-w-0">
                        <Link href={`/clientes/${c.id}`} className="font-semibold text-slate-800 hover:underline">{c.nome}</Link>
                        {c.modelos.length > 0 && <span className="block text-[11px] text-slate-500">{c.modelos.join(", ")}</span>}
                      </span>
                      <span className="shrink-0 text-right font-bold text-emerald-700">{formatCurrency(c.valor)}{c.qtd > 1 ? <span className="block text-[10px] font-semibold text-slate-500">{c.qtd} máquinas</span> : null}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/clientes?municipio=${p.municipioId}`} className="mt-2 inline-block text-xs text-brand-600 underline">Todos os clientes de {p.nome}</Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {pontos.length === 0 && (
        <p className="mt-2 text-xs" style={{ color: T.mudo }}>
          Nenhuma venda faturada com município no cadastro do cliente {modo === "ano" ? `em ${ano}` : ""}. Preencha a cidade no cadastro e o cifrão aparece aqui.
        </p>
      )}
    </div>
  );
}
