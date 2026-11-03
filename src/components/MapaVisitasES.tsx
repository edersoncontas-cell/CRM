"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Polyline } from "react-leaflet";
import L from "leaflet";
import type { GeoJsonObject } from "geojson";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { urlContornoEstado, type MapaDaArea } from "@/lib/area-atuacao-regra";
import { UFS_COM_MALHA } from "@/lib/mapa-regioes-es";
import type { ObstaculoRotulo } from "@/lib/mapa-rotulos-es";
import { CamadaMunicipiosES } from "@/components/CamadaMunicipiosES";
import { LegendaMapaRegioes } from "@/components/LegendaMapaRegioes";
import { melhorRota, kmDoTrajeto, linkGoogleMaps, paradasForaDoLink, kmPorExtenso } from "@/lib/rota-visitas";
import { Navigation, Home } from "lucide-react";

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
/** Cidade de onde ele sai para a melhor rota do dia. */
export type CidadeOrigem = { nome: string; lat: number; lng: number };

// Preferências deste aparelho (cidade de saída, ida e volta).
// Só conveniência: sem armazenamento, a tela funciona com o padrão.
const CHAVE_ORIGEM = "crm.visitas.origemRota";
const CHAVE_VOLTAR = "crm.visitas.voltarRota";
function lerLocal(chave: string): string | null {
  try { return window.localStorage.getItem(chave); } catch { return null; }
}
function gravarLocal(chave: string, valor: string): void {
  try { window.localStorage.setItem(chave, valor); } catch { /* sem armazenamento: só não lembra */ }
}

const iconeOrigem = L.divIcon({
  className: "",
  iconSize: [46, 22],
  iconAnchor: [23, 11],
  html: `<div style="height:22px;padding:0 6px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#141416;color:#ffcb2d;font-weight:900;font-size:11px;border:2px solid #ffcb2d;box-shadow:0 2px 8px rgba(0,0,0,0.35);">Saída</div>`,
});

const TAMANHO_PIN = 30;

function iconeNumero(n: number, hoje: boolean): L.DivIcon {
  const tamanho = TAMANHO_PIN;
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

export type AgendaProxima = {
  iso: string;
  rotulo: string;
  ehHoje: boolean;
  itens: { id: string; titulo: string; hora: string; cidade: string | null; tipo: "visita" | "evento" | "reuniao"; clienteId: string | null; status: string | null }[];
};

export default function MapaVisitasES({ visitas, dias, diaInicial, proximos7 = [], mapa, origens = [] }: { visitas: VisitaMapa[]; dias: DiaMapa[]; diaInicial: string; proximos7?: AgendaProxima[]; mapa: MapaDaArea; origens?: CidadeOrigem[] }) {
  const [dia, setDia] = useState(diaInicial);
  const [origemNome, setOrigemNome] = useState("");
  const [voltar, setVoltar] = useState(true);

  // Preferências guardadas neste aparelho (lidas só no navegador).
  useEffect(() => {
    const o = lerLocal(CHAVE_ORIGEM);
    if (o && origens.some((c) => c.nome === o)) setOrigemNome(o);
    const v = lerLocal(CHAVE_VOLTAR);
    if (v === "0") setVoltar(false);
  }, [origens]);

  const [contornos, setContornos] = useState<GeoJsonObject[]>([]);

  // Divisas entre as cidades: vão junto com o código (ES). Só o estado SEM
  // divisas no código busca o contorno do IBGE.
  const comDivisas = mapa.estados.some((e) => UFS_COM_MALHA.includes(e.uf));
  const codigos = mapa.estados.filter((e) => !UFS_COM_MALHA.includes(e.uf)).map((e) => e.codigo).join(",");
  useEffect(() => {
    let ativo = true;
    Promise.all(codigos.split(",").filter(Boolean).map((c) =>
      fetch(urlContornoEstado(Number(c))).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    )).then((gs) => { if (ativo) setContornos(gs.filter(Boolean) as GeoJsonObject[]); });
    return () => { ativo = false; };
  }, [codigos]);

  // Compromisso fixo (reunião de segunda) sempre primeiro; depois por hora.
  const doDia = useMemo(() => visitas.filter((v) => v.dataIso === dia).sort((a, b) => Number(!!b.fixo) - Number(!!a.fixo) || a.hora.localeCompare(b.hora)), [visitas, dia]);
  const comCoord = useMemo(() => doDia.filter((v) => v.lat != null && v.lng != null), [doDia]);
  const semCoord = doDia.filter((v) => v.lat == null || v.lng == null);
  const diaSel = dias.find((d) => d.iso === dia);
  // ── MELHOR ROTA ─────────────────────────────────────────────────────
  // Sem cidade de saída, vale a ordem dos horários (como sempre foi). Com
  // ela, a ordem que anda menos — em linha reta; quem calcula a estrada é o
  // Google Maps, pelo botão.
  const origem = origens.find((c) => c.nome === origemNome) ?? null;
  const pontosDia = useMemo(() => comCoord.map((v) => ({ lat: v.lat!, lng: v.lng! })), [comCoord]);
  const sugestao = useMemo(() => (origem && pontosDia.length ? melhorRota(origem, pontosDia, voltar) : null), [origem, pontosDia, voltar]);
  const ordem = useMemo(() => sugestao?.ordem ?? comCoord.map((_, i) => i), [sugestao, comCoord]);
  const kmHorarios = origem && pontosDia.length ? kmDoTrajeto(origem, pontosDia, pontosDia.map((_, i) => i), voltar) : null;
  const economia = sugestao && kmHorarios != null ? kmHorarios - sugestao.km : 0;
  const mudouOrdem = !!sugestao && sugestao.ordem.some((i, pos) => i !== pos);
  const linkMaps = origem ? linkGoogleMaps(origem, ordem.map((i) => pontosDia[i]), voltar) : null;
  const foraDoLink = paradasForaDoLink(ordem.length, voltar);
  const posicao = useMemo(() => new Map(ordem.map((i, pos) => [i, pos + 1])), [ordem]);

  const rota = useMemo(() => {
    const paradas = ordem.map((i) => [pontosDia[i].lat, pontosDia[i].lng] as [number, number]);
    if (!origem) return paradas;
    const o: [number, number] = [origem.lat, origem.lng];
    return voltar ? [o, ...paradas, o] : [o, ...paradas];
  }, [ordem, pontosDia, origem, voltar]);

  // Pins e a saída ficam por cima do mapa: o nome da cidade não pode ser escrito embaixo deles.
  const obstaculos = useMemo<ObstaculoRotulo[]>(
    () => [
      ...comCoord.map((v) => ({ lng: v.lng!, lat: v.lat!, esq: -(TAMANHO_PIN / 2 + 2), dir: TAMANHO_PIN / 2 + 2, cima: -(TAMANHO_PIN + 4), baixo: 2 })),
      ...(origem ? [{ lng: origem.lng, lat: origem.lat, esq: -25, dir: 25, cima: -13, baixo: 13 }] : []),
    ],
    [comCoord, origem],
  );

  function escolherOrigem(nome: string) { setOrigemNome(nome); gravarLocal(CHAVE_ORIGEM, nome); }
  function trocarVoltar(v: boolean) { setVoltar(v); gravarLocal(CHAVE_VOLTAR, v ? "1" : "0"); }

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
      {/* MELHOR ROTA DO DIA — "com a opção de colocar a cidade de origem". */}
      <div className="mb-2 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Navigation size={15} className="shrink-0 text-slate-500" />
          <label htmlFor="origem-rota" className="text-xs font-bold text-slate-700">Melhor rota — saindo de</label>
          <select id="origem-rota" value={origemNome} onChange={(e) => escolherOrigem(e.target.value)}
            className="min-w-0 max-w-full flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 sm:flex-none">
            <option value="">— escolha a cidade —</option>
            {origens.map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={voltar} onChange={(e) => trocarVoltar(e.target.checked)} className="h-4 w-4" />
            voltar para ela no fim
          </label>
        </div>
        {!origens.length ? (
          <p className="mt-2 text-xs text-amber-700">Sem lista de cidades da área de atuação — confira em Configurações → Área de atuação.</p>
        ) : !origem ? (
          <p className="mt-2 text-xs text-slate-500">Escolha de onde você sai e o CRM põe as visitas do dia na ordem que anda menos. O aparelho lembra a escolha.</p>
        ) : !comCoord.length ? (
          <p className="mt-2 text-xs text-slate-500">Nenhuma visita com cidade reconhecida em {diaSel ? `${diaSel.nome} ${diaSel.label}` : "neste dia"} — nada para ordenar.</p>
        ) : (
          <div className="mt-2">
            <ol className="max-h-40 space-y-1 overflow-y-auto pr-1 text-xs text-slate-700">
              <li className="flex items-center gap-1.5 font-semibold"><Home size={12} className="shrink-0" /> {origem.nome}</li>
              {ordem.map((i, pos) => {
                const v = comCoord[i];
                return (
                  <li key={v.id} className="flex items-baseline gap-1.5">
                    <span className="w-5 shrink-0 text-right font-black">{pos + 1}.</span>
                    <span className="min-w-0 truncate"><b>{v.clienteNome}</b>{v.cidade ? ` · ${v.cidade}` : ""}</span>
                    <span className="ml-auto shrink-0 text-slate-400">marcada {v.hora}</span>
                  </li>
                );
              })}
              {voltar && <li className="flex items-center gap-1.5 text-slate-500"><Home size={12} className="shrink-0" /> volta para {origem.nome}</li>}
            </ol>
            <p className="mt-2 text-xs text-slate-600">
              Cerca de <b>{kmPorExtenso(sugestao!.km)}</b> em linha reta (na estrada é mais){" "}
              {mudouOrdem && economia >= 1
                ? <>— <b className="text-green-700">{kmPorExtenso(economia)} a menos</b> que seguir a ordem dos horários.</>
                : "— a ordem dos horários já é a melhor."}
            </p>
            {mudouOrdem && <p className="mt-1 text-[11px] text-amber-700">A ordem sugerida olha só a distância: confira se ela bate com os horários que você combinou.</p>}
            {!sugestao!.exata && <p className="mt-1 text-[11px] text-slate-500">Com mais de 8 paradas, a ordem é uma boa aproximação, não a melhor garantida.</p>}
            {linkMaps && (
              <a href={linkMaps} target="_blank" rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-agro-400 hover:bg-slate-800">
                <Navigation size={13} /> Abrir rota no Google Maps
              </a>
            )}
            {foraDoLink > 0 && <p className="mt-1 text-[11px] text-amber-700">O link do Maps leva até 9 paradas no meio: {foraDoLink} ficaram de fora — adicione no app.</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <MapContainer bounds={mapa.inicial} minZoom={4} zoomSnap={0.25} maxBounds={mapa.limites} maxBoundsViscosity={0.8} scrollWheelZoom={false}
            style={{ height: 460, width: "100%", borderRadius: "1rem", border: "1px solid #e2e8f0" }}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {comDivisas && <CamadaMunicipiosES atendidos={mapa.atendidos} obstaculos={obstaculos} rota={rota} />}
            {contornos.map((c, i) => <GeoJSON key={i} data={c} style={{ color: "#141416", weight: 1.2, fillColor: "#ffcb2d", fillOpacity: 0.06 }} interactive={false} />)}
            {rota.length > 1 && (
              origem
                ? <Polyline positions={rota} pathOptions={{ color: "#141416", weight: 3, opacity: 0.75 }} />
                : <Polyline positions={rota} pathOptions={{ color: "#141416", weight: 2, dashArray: "6 6", opacity: 0.6 }} />
            )}
            {origem && <Marker position={[origem.lat, origem.lng]} icon={iconeOrigem} zIndexOffset={500} />}
            {comCoord.map((v, i) => (
              <Marker key={v.id} position={[v.lat!, v.lng!]} icon={iconeNumero(posicao.get(i) ?? i + 1, !!diaSel?.ehHoje)} zIndexOffset={1000}>
                <Popup>
                  <div className="text-sm">
                    <b>{posicao.get(i) ?? i + 1}. {v.clienteNome}</b><br />
                    {v.hora}{v.cidade ? ` · ${v.cidade}` : ""}<br />
                    {v.observacao && <span className="text-xs text-slate-600">{v.observacao}<br /></span>}
                    {!v.fixo && <Link href={`/clientes/${v.clienteId}`} className="text-brand-600 underline">Abrir cadastro</Link>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          {comDivisas && <LegendaMapaRegioes atendidos={mapa.atendidos} texto="var(--sobre-fundo-texto)" />}
        </div>
        {/* OS PRÓXIMOS 7 DIAS, e não só o dia aberto.
            "eu quero que mostre os compromissos ou visitas dos próximos 7
            dias". As abas do mapa cobrem segunda a sexta DESTA semana; a
            semana que vem — justamente a que serve para se organizar —
            ficava invisível, e num dia vazio o card não dizia nada. Aqui
            entram visita, evento e a reunião fixa da PME, atravessando a
            virada da semana e do mês. A lista rola por dentro: o card não
            estica a página. */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Próximos 7 dias</div>
          {proximos7.every((d) => d.itens.length === 0) ? (
            <p className="text-sm text-slate-400">Nada agendado nos próximos 7 dias.</p>
          ) : (
            <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
              {proximos7.filter((d) => d.itens.length > 0).map((d) => (
                <div key={d.iso}>
                  <div className="mb-1 text-[11px] font-black uppercase tracking-wide text-slate-400">
                    {d.ehHoje ? "Hoje" : d.rotulo}
                    {d.ehHoje && <span className="ml-1 font-normal text-slate-300">· {d.rotulo}</span>}
                  </div>
                  <ol className="space-y-1.5">
                    {d.itens.map((it) => (
                      <li key={it.id} className={`rounded-xl p-2 text-xs ${it.tipo === "evento" ? "bg-sky-50 ring-1 ring-sky-200" : it.tipo === "reuniao" ? "bg-agro-400/20 ring-1 ring-agro-400/60" : it.status === "realizada" ? "bg-emerald-50" : "bg-slate-50"}`}>
                        {it.clienteId
                          ? <Link href={`/clientes/${it.clienteId}`} className="font-semibold text-slate-800 hover:text-brand-600">{it.titulo}</Link>
                          : <span className={`font-black uppercase tracking-wide ${it.tipo === "evento" ? "text-sky-900" : "text-slate-900"}`}>{it.titulo}</span>}
                        <div className="text-slate-500">
                          {it.hora ? it.hora : "dia inteiro"}
                          {it.cidade ? ` · ${it.cidade}` : ""}
                          {it.status === "realizada" ? " · ✓ realizada" : ""}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
          {semCoord.length > 0 && <p className="mt-2 text-[11px] text-amber-700">{semCoord.length} visita(s) do dia aberto sem cidade reconhecida não aparecem no mapa. Informe a cidade ao cadastrar.</p>}
        </div>
      </div>
    </div>
  );
}
