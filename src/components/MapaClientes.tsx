"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export interface PontoMapa {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  clientes: number;
  pipeline: number;
}

export default function MapaClientes({ pontos }: { pontos: PontoMapa[] }) {
  const max = Math.max(1, ...pontos.map((p) => p.clientes));

  return (
    <MapContainer
      center={[-20.85, -41.2]}
      zoom={9}
      scrollWheelZoom
      style={{ height: "70vh", width: "100%", borderRadius: "0.75rem" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pontos.map((p) => {
        const raio = 8 + (p.clientes / max) * 22;
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={p.clientes > 0 ? raio : 6}
            pathOptions={{
              color: p.clientes > 0 ? "#1a63f5" : "#94a3b8",
              fillColor: p.clientes > 0 ? "#2f82ff" : "#cbd5e1",
              fillOpacity: 0.6,
              weight: 2,
            }}
          >
            <Tooltip>{p.nome} · {p.clientes} cliente(s)</Tooltip>
            <Popup>
              <div className="text-sm">
                <b>{p.nome}</b>
                <br />
                {p.clientes} cliente(s)
                <br />
                Pipeline: {formatCurrency(p.pipeline)}
                <br />
                <Link href={`/clientes?municipio=${p.id}`} className="text-brand-600 underline">
                  Ver clientes
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
