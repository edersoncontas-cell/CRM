"use client";

import { useRef, useState, useTransition } from "react";
import {
  criarMaquinaUsada, editarMaquinaUsada, definirStatusUsada, excluirMaquinaUsada,
} from "@/lib/actions";
import { formatCurrency } from "@/lib/utils";
import {
  Plus, X, Pencil, Trash2, MapPin, Clock, Calendar, Share2, Check, Search, Truck, Camera,
} from "lucide-react";

// Comprime a foto no navegador (redimensiona p/ no máx. 1000px e exporta JPEG)
// e devolve uma data URL — assim guardamos a imagem sem precisar de servidor de arquivos.
function comprimirFoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("falha ao ler"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("imagem inválida"));
      img.onload = () => {
        const MAX = 1000;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width >= height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("sem canvas"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export type Usada = {
  id: string;
  marca: string;
  modelo: string;
  categoria: string;
  ano: number | null;
  horimetro: number | null;
  preco: number | null;
  estado: string;
  localizacao: string | null;
  descricao: string | null;
  fotoUrl: string | null;
  status: string;
};

const CATEGORIAS = [
  ["escavadeira", "Escavadeira"],
  ["miniescavadeira", "Mini Escavadeira"],
  ["retroescavadeira", "Retroescavadeira"],
  ["pacarregadeira", "Pá Carregadeira"],
  ["minicarregadeira", "Minicarregadeira"],
  ["motoniveladora", "Motoniveladora"],
  ["rolo", "Rolo Compactador"],
  ["caminhao", "Caminhão"],
  ["outro", "Outro"],
] as const;

const CAT_LABEL = Object.fromEntries(CATEGORIAS) as Record<string, string>;
const ESTADO_LABEL: Record<string, string> = { seminova: "Seminova", boa: "Boa", regular: "Regular" };
const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  disponivel: { label: "Disponível", cls: "bg-green-100 text-green-700" },
  reservada: { label: "Reservada", cls: "bg-amber-100 text-amber-700" },
  vendida: { label: "Vendida", cls: "bg-slate-200 text-slate-500" },
};

function horas(h: number | null) {
  return h != null ? `${h.toLocaleString("pt-BR")} h` : "—";
}

export function MaquinasUsadasClient({ maquinas }: { maquinas: Usada[] }) {
  const [filtro, setFiltro] = useState<"todas" | "disponivel" | "reservada" | "vendida">("todas");
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<Usada | null>(null);

  const lista = maquinas.filter((m) => {
    if (filtro !== "todas" && m.status !== filtro) return false;
    if (busca) {
      const q = busca.toLowerCase();
      return `${m.marca} ${m.modelo} ${CAT_LABEL[m.categoria] ?? ""} ${m.localizacao ?? ""}`.toLowerCase().includes(q);
    }
    return true;
  });

  const disponiveis = maquinas.filter((m) => m.status === "disponivel");
  const valorEstoque = disponiveis.reduce((s, m) => s + (m.preco ?? 0), 0);

  return (
    <div>
      {/* Resumo */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Resumo titulo="No estoque" valor={String(maquinas.length)} />
        <Resumo titulo="Disponíveis" valor={String(disponiveis.length)} cor="text-green-600" />
        <Resumo titulo="Reservadas" valor={String(maquinas.filter((m) => m.status === "reservada").length)} cor="text-amber-600" />
        <Resumo titulo="Valor do estoque" valor={formatCurrency(valorEstoque)} cor="text-brand-700" />
      </div>

      {/* Barra: filtro + busca + novo */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-xl border border-slate-200">
          {(["todas", "disponivel", "reservada", "vendida"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-2 text-sm font-semibold transition ${filtro === f ? "bg-brand-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              {f === "todas" ? "Todas" : STATUS_INFO[f].label}
            </button>
          ))}
        </div>
        <div className="relative min-w-40 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar modelo, marca, cidade…"
            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <button
          onClick={() => setNovo(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={16} /> Nova máquina
        </button>
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <Truck size={36} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">
            {maquinas.length === 0 ? "Nenhuma máquina usada no estoque ainda." : "Nenhuma máquina nesse filtro."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((m) => (
            <CardUsada key={m.id} m={m} onEditar={() => setEditando(m)} />
          ))}
        </div>
      )}

      {(novo || editando) && (
        <ModalUsada maquina={editando} onClose={() => { setNovo(false); setEditando(null); }} />
      )}
    </div>
  );
}

function Resumo({ titulo, valor, cor = "text-slate-800" }: { titulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
      <div className={`text-base font-bold leading-tight sm:text-lg ${cor}`}>{valor}</div>
      <div className="mt-1 text-xs text-slate-500">{titulo}</div>
    </div>
  );
}

function CardUsada({ m, onEditar }: { m: Usada; onEditar: () => void }) {
  const [pend, start] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const status = STATUS_INFO[m.status] ?? STATUS_INFO.disponivel;

  function copiarAnuncio() {
    const linhas = [
      `🚜 *${m.marca} ${m.modelo}*`,
      CAT_LABEL[m.categoria] ? `Categoria: ${CAT_LABEL[m.categoria]}` : "",
      m.ano ? `Ano: ${m.ano}` : "",
      m.horimetro != null ? `Horímetro: ${horas(m.horimetro)}` : "",
      `Estado: ${ESTADO_LABEL[m.estado] ?? m.estado}`,
      m.localizacao ? `Local: ${m.localizacao}` : "",
      m.preco ? `💰 ${formatCurrency(m.preco)}` : "",
      m.descricao ? `\n${m.descricao}` : "",
      `\nFalar comigo 👇`,
    ].filter(Boolean);
    navigator.clipboard?.writeText(linhas.join("\n")).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${m.status === "vendida" ? "opacity-70" : ""}`}>
      {/* Foto */}
      <div className="relative h-40 bg-slate-100">
        {m.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.fotoUrl} alt={`${m.marca} ${m.modelo}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <Truck size={42} />
          </div>
        )}
        <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold ${status.cls}`}>
          {status.label}
        </span>
      </div>

      {/* Corpo */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-slate-900">{m.marca} {m.modelo}</div>
            <div className="text-xs text-slate-400">{CAT_LABEL[m.categoria] ?? m.categoria}</div>
          </div>
          <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {ESTADO_LABEL[m.estado] ?? m.estado}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          {m.ano && <span className="flex items-center gap-1"><Calendar size={12} /> {m.ano}</span>}
          {m.horimetro != null && <span className="flex items-center gap-1"><Clock size={12} /> {horas(m.horimetro)}</span>}
          {m.localizacao && <span className="flex items-center gap-1"><MapPin size={12} /> {m.localizacao}</span>}
        </div>

        {m.descricao && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{m.descricao}</p>}

        <div className="mt-3 text-xl font-bold text-emerald-600">
          {m.preco ? formatCurrency(m.preco) : "Sob consulta"}
        </div>

        {/* Status rápido */}
        <div className="mt-3 flex gap-1">
          {(["disponivel", "reservada", "vendida"] as const).map((s) => (
            <button
              key={s}
              onClick={() => start(() => definirStatusUsada(m.id, s).then(() => {}))}
              disabled={pend}
              className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                m.status === s ? STATUS_INFO[s].cls : "bg-slate-50 text-slate-400 hover:bg-slate-100"
              }`}
            >
              {STATUS_INFO[s].label}
            </button>
          ))}
        </div>

        {/* Ações */}
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <button onClick={copiarAnuncio} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#25D366]/10 py-1.5 text-xs font-semibold text-[#1da851] hover:bg-[#25D366]/20">
            {copiado ? <><Check size={13} /> Copiado!</> : <><Share2 size={13} /> Anúncio WhatsApp</>}
          </button>
          <button onClick={onEditar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Editar">
            <Pencil size={15} />
          </button>
          <button
            onClick={() => { if (confirm(`Excluir ${m.marca} ${m.modelo} do estoque?`)) start(() => excluirMaquinaUsada(m.id).then(() => {})); }}
            disabled={pend}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
            title="Excluir"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalUsada({ maquina, onClose }: { maquina: Usada | null; onClose: () => void }) {
  const [pend, start] = useTransition();
  const [foto, setFoto] = useState(maquina?.fotoUrl ?? "");
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ed = maquina;

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErroFoto(null);
    try {
      const dataUrl = await comprimirFoto(file);
      setFoto(dataUrl);
    } catch {
      setErroFoto("Não consegui processar a imagem. Tente outra foto.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        action={async (fd) => {
          start(async () => {
            if (ed) await editarMaquinaUsada(ed.id, fd);
            else await criarMaquinaUsada(fd);
            onClose();
          });
        }}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{ed ? "Editar máquina usada" : "Nova máquina usada"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Marca *"><input name="marca" required defaultValue={ed?.marca ?? ""} placeholder="New Holland" className={inp} /></Campo>
          <Campo label="Modelo *"><input name="modelo" required defaultValue={ed?.modelo ?? ""} placeholder="E215C" className={inp} /></Campo>
          <Campo label="Categoria">
            <select name="categoria" defaultValue={ed?.categoria ?? "outro"} className={inp}>
              {CATEGORIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Campo>
          <Campo label="Estado">
            <select name="estado" defaultValue={ed?.estado ?? "boa"} className={inp}>
              <option value="seminova">Seminova</option>
              <option value="boa">Boa</option>
              <option value="regular">Regular</option>
            </select>
          </Campo>
          <Campo label="Ano"><input name="ano" inputMode="numeric" defaultValue={ed?.ano ?? ""} placeholder="2019" className={inp} /></Campo>
          <Campo label="Horímetro (h)"><input name="horimetro" inputMode="numeric" defaultValue={ed?.horimetro ?? ""} placeholder="4500" className={inp} /></Campo>
          <Campo label="Preço (R$)"><input name="preco" inputMode="numeric" defaultValue={ed?.preco ?? ""} placeholder="320000" className={inp} /></Campo>
          <Campo label="Status">
            <select name="status" defaultValue={ed?.status ?? "disponivel"} className={inp}>
              <option value="disponivel">Disponível</option>
              <option value="reservada">Reservada</option>
              <option value="vendida">Vendida</option>
            </select>
          </Campo>
          <Campo label="Localização" full><input name="localizacao" defaultValue={ed?.localizacao ?? ""} placeholder="Cachoeiro de Itapemirim" className={inp} /></Campo>

          {/* Foto da máquina (tirada/escolhida no celular) */}
          <div className="col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Foto da máquina</span>
            <input type="hidden" name="fotoUrl" value={foto} />
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={aoEscolherFoto} className="hidden" />
            {foto ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto} alt="Prévia" className="h-40 w-full rounded-xl border border-slate-200 object-cover" />
                <button
                  type="button"
                  onClick={() => setFoto("")}
                  className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80"
                  title="Remover foto"
                >
                  <X size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-black/80"
                >
                  <Camera size={13} /> Trocar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-6 text-sm font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-600"
              >
                <Camera size={18} /> Tirar / escolher foto
              </button>
            )}
            {erroFoto && <p className="mt-1 text-xs text-red-500">{erroFoto}</p>}
          </div>

          <Campo label="Descrição" full>
            <textarea name="descricao" rows={3} defaultValue={ed?.descricao ?? ""} placeholder="Detalhes, manutenções, pneus, opcionais…" className={`${inp} resize-none`} />
          </Campo>
        </div>

        <button disabled={pend} className="mt-5 w-full rounded-lg bg-black py-2.5 font-bold text-agro-400 hover:bg-brand-800 disabled:opacity-60">
          {pend ? "Salvando…" : ed ? "Salvar alterações" : "Adicionar ao estoque"}
        </button>
      </form>
    </div>
  );
}

const inp = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function Campo({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
