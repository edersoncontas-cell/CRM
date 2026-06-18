"use client";

import { useState, useTransition } from "react";
import { enviarResposta } from "@/lib/actions";
import { Calendar, MessageCircle, X } from "lucide-react";

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return "bom dia";
  if (hora >= 12 && hora < 18) return "boa tarde";
  return "boa noite";
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0];
}

function mensagemPadrao(nomeCliente: string): string {
  const s = saudacao();
  const nome = primeiroNome(nomeCliente);
  const saudacaoFormatada = s.charAt(0).toUpperCase() + s.slice(1);
  return `${saudacaoFormatada} ${nome}, estou planejando de passar na região esta semana e gostaria de fazer uma visita, qual o melhor dia posso te encontrar? Você prefere na parte da manhã ou de tarde?`;
}

export function AgendarVisitaDialog({
  clienteId,
  clienteNome,
  clienteTelefone,
}: {
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [enviando, startEnviar] = useTransition();
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  function abrir() {
    setMensagem(mensagemPadrao(clienteNome));
    setResultado(null);
    setAberto(true);
  }

  function fechar() {
    if (enviando) return;
    setAberto(false);
    setResultado(null);
  }

  function enviar() {
    setResultado(null);
    startEnviar(async () => {
      const r = await enviarResposta(clienteId, mensagem);
      if (r.ok) {
        setResultado({ ok: true, msg: "✅ Mensagem enviada! Quando o cliente responder com o dia e horário, o CRM adiciona automaticamente à agenda e ao pipeline." });
        setTimeout(() => { setAberto(false); setResultado(null); }, 3500);
      } else {
        setResultado({ ok: false, msg: r.erro ?? "Erro ao enviar." });
      }
    });
  }

  return (
    <>
      <button
        onClick={abrir}
        className="inline-flex items-center gap-1.5 rounded-lg bg-agro-400 px-3 py-1.5 text-sm font-semibold text-black transition hover:brightness-105"
      >
        <Calendar size={14} /> Agendar visita
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) fechar(); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-agro-600" />
                <span className="font-semibold text-slate-800">Agendar visita</span>
              </div>
              <button
                onClick={fechar}
                disabled={enviando}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              {!clienteTelefone && (
                <div className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                  ⚠️ Nenhum telefone cadastrado. Adicione o número antes de enviar.
                </div>
              )}

              <label className="mb-2 block text-sm font-medium text-slate-700">
                Mensagem para <span className="text-brand-700">{primeiroNome(clienteNome)}</span>
              </label>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={5}
                disabled={enviando}
                className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
              />
              <p className="mt-2 text-xs text-slate-400">
                💡 Quando o cliente responder com dia e horário, a IA detecta automaticamente e registra na agenda e no pipeline.
              </p>

              {resultado && (
                <div
                  className={`mt-3 rounded-xl px-4 py-3 text-sm ${
                    resultado.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                  }`}
                >
                  {resultado.msg}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                onClick={fechar}
                disabled={enviando}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={enviar}
                disabled={enviando || !mensagem.trim() || !clienteTelefone}
                className="flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1da851] disabled:opacity-50"
              >
                <MessageCircle size={15} />
                {enviando ? "Enviando…" : "Enviar pelo WhatsApp"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
