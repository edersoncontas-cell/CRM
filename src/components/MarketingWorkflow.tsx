"use client";

import { useState, useTransition } from "react";
import {
  Check, X, MessageSquare, Send, Sparkles, ChevronDown, ChevronUp,
  Copy, CheckCheck, Loader2, Trash2,
} from "lucide-react";
import {
  aprovarCampanha, rejeitarCampanha, pedirAlteracaoCampanha,
  enviarCampanha, excluirCampanha,
} from "@/lib/marketing-actions";

type Campanha = {
  id: string;
  tipo: string;
  titulo: string;
  conteudo: string;
  hashtags: string | null;
  canalAlvo: string;
  status: string;
  marca: string | null;
  categoria: string | null;
  feedbackEderson: string | null;
  totalEnviado: number;
  enviadoEm: Date | null;
  criadoEm: Date;
};

const COR_STATUS: Record<string, string> = {
  rascunho: "bg-amber-100 text-amber-800 border-amber-200",
  aprovado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  enviado: "bg-brand-100 text-brand-800 border-brand-200",
  rejeitado: "bg-red-100 text-red-700 border-red-200",
};

const EMOJI_STATUS: Record<string, string> = {
  rascunho: "✏️",
  aprovado: "✅",
  enviado: "📤",
  rejeitado: "❌",
};

const LABEL_TIPO: Record<string, string> = {
  diario: "📅 Diário",
  segunda: "🚀 Segunda-feira",
  sexta: "🎯 Sexta-feira",
  mensal_inicio: "📆 Início do mês",
  mensal_fim: "⏰ Fim do mês",
  avulso: "⚡ Avulso",
};

export function PostCard({
  campanha,
  municipios,
}: {
  campanha: Campanha;
  municipios: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [abaAberta, setAbaAberta] = useState<"feedback" | "envio" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [municipioFiltro, setMunicipioFiltro] = useState("");
  const [marcaFiltro, setMarcaFiltro] = useState(campanha.marca ?? "");
  const [totalEnviando, setTotalEnviando] = useState<number | null>(null);

  const copiarTexto = () => {
    const texto = campanha.conteudo + (campanha.hashtags ? "\n\n" + campanha.hashtags : "");
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleAprovar = () => {
    startTransition(() => aprovarCampanha(campanha.id));
    setAbaAberta(null);
  };

  const handleRejeitar = () => {
    startTransition(() => rejeitarCampanha(campanha.id));
  };

  const handleExcluir = () => {
    startTransition(() => excluirCampanha(campanha.id));
  };

  const handlePedirAlteracao = () => {
    if (!feedback.trim()) return;
    startTransition(() => pedirAlteracaoCampanha(campanha.id, feedback));
    setFeedback("");
    setAbaAberta(null);
  };

  const handleEnviar = async () => {
    const count = await enviarCampanha(campanha.id, {
      marca: marcaFiltro || undefined,
      municipioFiltro: municipioFiltro || undefined,
    });
    setTotalEnviando(count ?? 0);
    setAbaAberta(null);
  };

  return (
    <div className={`rounded-2xl border-2 bg-white shadow-sm transition-all ${COR_STATUS[campanha.status]}`}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold">
            {LABEL_TIPO[campanha.tipo] ?? campanha.tipo}
          </span>
          {campanha.marca && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${campanha.marca === "Dynapac" ? "bg-red-600 text-white" : "bg-brand-600 text-white"}`}>
              {campanha.marca}
            </span>
          )}
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${COR_STATUS[campanha.status]}`}>
          {EMOJI_STATUS[campanha.status]} {campanha.status}
        </span>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <h3 className="mb-2 text-base font-bold text-slate-800">{campanha.titulo}</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{campanha.conteudo}</p>
        {campanha.hashtags && (
          <p className="mt-2 text-xs text-brand-500">{campanha.hashtags}</p>
        )}
        {campanha.feedbackEderson && (
          <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            💬 Feedback anterior: &ldquo;{campanha.feedbackEderson}&rdquo;
          </div>
        )}
        {campanha.status === "enviado" && (
          <div className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
            📤 Enviado para {campanha.totalEnviado} contato(s) em{" "}
            {campanha.enviadoEm
              ? new Date(campanha.enviadoEm).toLocaleDateString("pt-BR")
              : "—"}
          </div>
        )}
      </div>

      {/* Actions */}
      {campanha.status === "rascunho" && (
        <div className="border-t border-current/10 p-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleAprovar}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Aprovar
            </button>
            <button
              onClick={() => setAbaAberta(abaAberta === "feedback" ? null : "feedback")}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              <MessageSquare size={14} />
              Pedir alteração
              {abaAberta === "feedback" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              onClick={copiarTexto}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {copiado ? <CheckCheck size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copiado ? "Copiado!" : "Copiar"}
            </button>
            <button
              onClick={handleRejeitar}
              disabled={isPending}
              className="ml-auto flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-50"
            >
              <X size={14} /> Rejeitar
            </button>
          </div>

          {abaAberta === "feedback" && (
            <div className="mt-3">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Ex: 'Quero mais emojis e um tom mais urgente' ou 'Foca no custo-benefício da Dynapac CA3500'"
                rows={3}
                className="w-full rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={handlePedirAlteracao}
                disabled={!feedback.trim() || isPending}
                className="mt-2 flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Regenerar com IA
              </button>
            </div>
          )}
        </div>
      )}

      {campanha.status === "aprovado" && (
        <div className="border-t border-current/10 p-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAbaAberta(abaAberta === "envio" ? null : "envio")}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Send size={14} />
              Enviar agora
              {abaAberta === "envio" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              onClick={copiarTexto}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {copiado ? <CheckCheck size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copiado ? "Copiado!" : "Copiar texto"}
            </button>
          </div>

          {abaAberta === "envio" && (
            <div className="mt-3 rounded-xl bg-brand-50 p-4">
              <p className="mb-3 text-sm font-semibold text-brand-800">
                Filtrar destinatários
              </p>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Marca</label>
                  <select
                    value={marcaFiltro}
                    onChange={(e) => setMarcaFiltro(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    <option value="">Todos os contatos</option>
                    <option value="New Holland">Interesse New Holland</option>
                    <option value="Dynapac">Interesse Dynapac</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Cidade</label>
                  <select
                    value={municipioFiltro}
                    onChange={(e) => setMunicipioFiltro(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    <option value="">Todas as cidades</option>
                    {municipios.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-white p-2 text-xs text-slate-500">
                📱 O envio em massa via WhatsApp será ativado quando o WhatsApp Business estiver conectado.
                Por enquanto, os destinatários são registrados e você pode copiar o texto para enviar manualmente.
              </div>
              <button
                onClick={handleEnviar}
                disabled={isPending}
                className="mt-3 flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Confirmar envio
              </button>
              {totalEnviando !== null && (
                <p className="mt-2 text-sm font-medium text-brand-700">
                  ✅ Registrado para {totalEnviando} contato(s)!
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {(campanha.status === "rejeitado") && (
        <div className="border-t border-current/10 p-3">
          <button
            onClick={handleExcluir}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-50"
          >
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}
