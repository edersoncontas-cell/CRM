"use client";

import { useState, useTransition, useRef } from "react";
import { Sparkles, Loader2, ImagePlus, X } from "lucide-react";
import { gerarPostAction } from "@/lib/marketing-actions";

const TIPOS = [
  { valor: "diario", label: "📅 Dica diária" },
  { valor: "segunda", label: "🚀 Segunda-feira" },
  { valor: "sexta", label: "🎯 Sexta-feira" },
  { valor: "mensal_inicio", label: "📆 Início do mês" },
  { valor: "mensal_fim", label: "⏰ Fim do mês" },
  { valor: "avulso", label: "⚡ Avulso" },
];

const CANAIS = [
  { valor: "ambos", label: "📱 WhatsApp + Instagram" },
  { valor: "whatsapp", label: "💬 WhatsApp" },
  { valor: "instagram", label: "📸 Instagram" },
];

type MaquinaInfo = {
  marca: string;
  modelo: string;
  categoria: string;
};

export function GerarPostForm({
  categorias,
  marcas,
  maquinas,
}: {
  categorias: string[];
  marcas: string[];
  maquinas: MaquinaInfo[];
}) {
  const [isPending, startTransition] = useTransition();
  const [gerado, setGerado] = useState(false);
  const [marcaSelecionada, setMarcaSelecionada] = useState("");
  const [modeloSelecionado, setModeloSelecionado] = useState("");
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemBase64, setImagemBase64] = useState<string | null>(null);
  const [imagemMime, setImagemMime] = useState<string>("image/jpeg");
  const inputFileRef = useRef<HTMLInputElement>(null);

  const modelosFiltrados = marcaSelecionada
    ? [...new Set(
        maquinas
          .filter((m) => m.marca === marcaSelecionada)
          .map((m) => m.modelo)
      )].sort()
    : [];

  const handleMarcaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMarcaSelecionada(e.target.value);
    setModeloSelecionado("");
  };

  const handleImagemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type || "image/jpeg";
    setImagemMime(mime);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagemPreview(dataUrl);
      const base64 = dataUrl.split(",")[1] ?? "";
      setImagemBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const removerImagem = () => {
    setImagemPreview(null);
    setImagemBase64(null);
    if (inputFileRef.current) inputFileRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (imagemBase64) {
      fd.set("imagemBase64", imagemBase64);
      fd.set("imagemMime", imagemMime);
    }
    startTransition(async () => {
      await gerarPostAction(fd);
      setGerado(true);
      setTimeout(() => setGerado(false), 3000);
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-brand-50 p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo de post</label>
        <select
          name="tipo"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Marca</label>
        <select
          name="marca"
          value={marcaSelecionada}
          onChange={handleMarcaChange}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
        >
          <option value="">Qualquer</option>
          {marcas.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Modelo</label>
        <select
          name="modelo"
          value={modeloSelecionado}
          onChange={(e) => setModeloSelecionado(e.target.value)}
          disabled={!marcaSelecionada || modelosFiltrados.length === 0}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">
            {!marcaSelecionada
              ? "Selecione uma marca"
              : modelosFiltrados.length === 0
              ? "Nenhum modelo"
              : "Qualquer modelo"}
          </option>
          {modelosFiltrados.map((modelo) => (
            <option key={modelo} value={modelo}>{modelo}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Categoria</label>
        <select
          name="categoria"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
        >
          <option value="">Qualquer</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Canal</label>
        <select
          name="canal"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
        >
          {CANAIS.map((c) => (
            <option key={c.valor} value={c.valor}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="w-full">
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          📷 Foto da máquina <span className="font-normal text-slate-400">(opcional — a IA usará a imagem)</span>
        </label>
        {imagemPreview ? (
          <div className="relative inline-block">
            <img
              src={imagemPreview}
              alt="Preview"
              className="h-28 w-auto rounded-xl border border-fuchsia-300 object-cover shadow"
            />
            <button
              type="button"
              onClick={removerImagem}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-fuchsia-300 bg-white px-4 py-3 text-sm text-slate-500 transition hover:border-fuchsia-500 hover:text-fuchsia-600">
            <ImagePlus size={18} />
            <span>Clique para adicionar uma foto</span>
            <input
              ref={inputFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImagemChange}
            />
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:from-fuchsia-700 hover:to-brand-700 disabled:opacity-60"
      >
        {isPending ? (
          <><Loader2 size={16} className="animate-spin" />Gerando…</>
        ) : gerado ? (
          <><Sparkles size={16} />Post criado! ✅</>
        ) : (
          <><Sparkles size={16} />Gerar post com IA</>
        )}
      </button>
    </form>
  );
}
