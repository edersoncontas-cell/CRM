"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
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

  // Filtra modelos pela marca selecionada
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
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
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo de post</label>label>
                      <select
                                  name="tipo"
                                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
                                >
                        {TIPOS.map((t) => (
                                              <option key={t.valor} value={t.valor}>{t.label}</option>option>
                                            ))}
                      </select>select>
              </div>div>
        
              <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Marca</label>label>
                      <select
                                  name="marca"
                                  value={marcaSelecionada}
                                  onChange={handleMarcaChange}
                                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
                                >
                                <option value="">Qualquer</option>option>
                        {marcas.map((m) => (
                                              <option key={m} value={m}>{m}</option>option>
                                            ))}
                      </select>select>
              </div>div>
        
              <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Modelo</label>label>
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
                                </option>option>
                        {modelosFiltrados.map((modelo) => (
                                              <option key={modelo} value={modelo}>{modelo}</option>option>
                                            ))}
                      </select>select>
              </div>div>
        
              <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Categoria</label>label>
                      <select
                                  name="categoria"
                                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
                                >
                                <option value="">Qualquer</option>option>
                        {categorias.map((c) => (
                                              <option key={c} value={c}>{c}</option>option>
                                            ))}
                      </select>select>
              </div>div>
        
              <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Canal</label>label>
                      <select
                                  name="canal"
                                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
                                >
                        {CANAIS.map((c) => (
                                              <option key={c.valor} value={c.valor}>{c.label}</option>option>
                                            ))}
                      </select>select>
              </div>div>
        
              <button
                        type="submit"
                        disabled={isPending}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:from-fuchsia-700 hover:to-brand-700 disabled:opacity-60"
                      >
                {isPending ? (
                                  <><Loader2 size={16} className="animate-spin" />Gerando…</>>
                                ) : gerado ? (
                                  <><Sparkles size={16} />Post criado! ✅</>>
                                ) : (
                                  <><Sparkles size={16} />Gerar post com IA</>>
                                )}
              </button>button>
        </form>form>
      );
}</></></></form>
