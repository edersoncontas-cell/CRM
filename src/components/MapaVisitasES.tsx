"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Polyline } from "react-leaflet";
import L from "leaflet";
import type { GeoJsonObject } from "geojson";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { CENTRO_ES, LIMITES_ES } from "@/lib/municipios-es";

export type VisitaMapa = {
  id: string;
  clienteId: string;
  clienteNome: string;
  cidade: string | null;
  observacao: string | null;
  hora: string;
  dataIso: string; // YYYY-MM-DD (Brasília)
  lat: number | null;
  lng: number | null;
  status?: string;   // agendada | realizada | nao_realizada
  fixo?: boolean;    // compromisso fixo (reunião PME de segunda), sem cliente
};

export type DiaMapa = { iso: string; nome: string; label: string; ehHoje: boolean };

const URL_CONTORNO_ES = "https://servicodados.ibge.gov.br/api/v3/malhas/estados/32?formato=application/vnd.geo+json&qualidade=minima";

function iconeNumero(n: number, hoje: boolean): L.DivIcon {
  const tamanho = 30;
  return L.divIcon({
    className: "",
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho],
    popupAnchor: [0, -tamanho],
    html: `<div style="width:${tamanho}px;height:${tamanho}px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
      background:${hoje ? "#ffcb2d" : "#141416"};color:${hoje ? "#111" : "#ffcb2d"};font-weight:900;font-size:13px;border:2px solid ${hoje ? "#111" : "#ffcb2d"};box-shadow:0 4px 12px rgba(0,0,0,0.35);">
      <span style="transform:rotate(45deg)">${n}</span></div>`,
  });
}

export default function MapaVisitasES({ visitas, dias, diaInicial }: { visitas: VisitaMapa[]; dias: DiaMapa[]; diaInicial: string }) {
  const [dia, setDia] = useState(diaInicial);
  const [contorno, setContorno] = useState<GeoJsonObject | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch(URL_CONTORNO_ES).then((r) => (r.ok ? r.json() : null)).then((g) => { if (ativo && g) setContorno(g as GeoJsonObject); }).catch(() => {});
    return () => { ativo = false; };
  }, []);

  // Compromisso fixo (reunião de segunda) sempre primeiro; depois por hora.
  const doDia = useMemo(() => visitas.filter((v) => v.dataIso === dia).sort((a, b) => Number(!!b.fixo) - Number(!!a.fixo) || a.hora.localeCompare(b.hora)), [visitas, dia]);
  const comCoord = doDia.filter((v) => v.lat != null && v.lng != null);
  const semCoord = doDia.filter((v) => v.lat == null || v.lng == null);
  const diaSel = dias.find((d) => d.iso === dia);
  const rota = comCoord.map((v) => [v.lat!, v.lng!] as [number, number]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {dias.map((d) => {
          const n = visitas.filter((v) => v.dataIso === d.iso).length;
          return (
            <button key={d.iso} onClick={() => setDia(d.iso)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${dia === d.iso ? "bg-slate-900 text-agro-400" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`} style={{ minHeight: 34 }}>
              {d.nome} <span className="font-normal opacity-70">{d.label}</span>{n > 0 && <span className={`ml-1 rounded-full px-1.5 text-[10px] ${dia === d.iso ? "bg-agro-400 text-black" : "bg-slate-100 text-slate-600"}`}>{n}</span>}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
        <MapContainer center={CENTRO_ES} zoom={8} minZoom={6} maxBounds={LIMITES_ES} maxBoundsViscosity={0.8} scrollWheelZoom={false}
          style={{ height: 460, width: "100%", borderRadius: "1rem", border: "1px solid #e2e8f0" }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {contorno && <GeoJSON data={contorno} style={{ color: "#141416", weight: 1.2, fillColor: "#ffcb2d", fillOpacity: 0.06 }} interactive={false} />}
          {rota.length > 1 && <Polyline positions={rota} pathOptions={{ color: "#141416", weight: 2, dashArray: "6 6", opacity: 0.6 }} />}
          {comCoord.map((v, i) => (
            <Marker key={v.id} position={[v.lat!, v.lng!]} icon={iconeNumero(i + 1, !!diaSel?.ehHoje)}>
              <Popup>
                <div className="text-sm">
                  <b>{i + 1}. {v.clienteNome}</b><br />
                  {v.hora}{v.cidade ? ` · ${v.cidade}` : ""}<br />
                  {v.observacao && <span className="text-xs text-slate-600">{v.observacao}<br /></span>}
                  {!v.fixo && <Link href={`/clientes/${v.clienteId}`} className="text-brand-600 underline">Abrir cadastro</Link>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{diaSel ? `${diaSel.nome}, ${diaSel.label}` : "Dia"} · {doDia.length} visita(s)</div>
          {doDia.length === 0 ? (
            <p className="text-sm text-slate-400">Nada agendado neste dia.</p>
          ) : (
            <ol className="space-y-1.5">
              {doDia.map((v, i) => {
                const idx = comCoord.indexOf(v);
                return (
                  <li key={v.id} className={`flex items-start gap-2 rounded-xl p-2 text-xs ${v.fixo ? "bg-agro-400/20 ring-1 ring-agro-400/60" : v.status === "realizada" ? "bg-emerald-50" : v.status === "nao_realizada" ? "bg-red-50" : "bg-slate-50"}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${idx >= 0 ? "bg-slate-900 text-agro-400" : "bg-slate-200 text-slate-500"}`}>{idx >= 0 ? idx + 1 : "?"}</span>
                    <div className="min-w-0 flex-1">
                      {v.fixo
                        ? <span className="font-black uppercase tracking-wide text-slate-900">{v.clienteNome}</span>
                        : <Link href={`/clientes/${v.clienteId}`} className="font-semibold text-slate-800 hover:text-brand-600">{v.clienteNome}</Link>}
                      <div className="text-slate-500">{v.hora}{v.cidade ? ` · ${v.cidade}` : " · sem cidade"}{v.status === "realizada" ? " · ✓ realizada" : v.status === "nao_realizada" ? " · ✗ não realizada" : ""}</div>
                      {v.observacao && <div className="line-clamp-2 text-slate-500">{v.observacao}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {semCoord.length > 0 && <p className="mt-2 text-[11px] text-amber-700">{semCoord.length} visita(s) sem cidade reconhecida não aparecem no mapa. Informe a cidade ao cadastrar.</p>}
        </div>
      </div>
    </div>
  );
}
