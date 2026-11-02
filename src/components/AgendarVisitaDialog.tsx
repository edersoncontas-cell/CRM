"use client";

import { useState } from "react";
import { linkWhatsApp } from "@/lib/whatsapp-link";
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

// O CRM não manda mais mensagem de conversa (02/11): o botão abre o WhatsApp
// do celular na conversa do cliente com o convite já escrito. A resposta dele
// chega ao CRM pelo webhook, e a IA continua achando o dia e a hora nela.
export function AgendarVisitaDialog({
  clienteNome,
  clienteTelefone,
}: {
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const link = linkWhatsApp(clienteTelefone, mensagem);

  function abrir() {
    setMensagem(mensagemPadrao(clienteNome));
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
  }

  function enviar() {
    if (!link) return;
    window.open(link, "_blank", "noopener");
    setAberto(false);
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
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              {!clienteTelefone && (
                <div className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                  ⚠️ Nenhum telefone válido no cadastro. Adicione o número antes.
                </div>
              )}

              <label className="mb-2 block text-sm font-medium text-slate-700">
                Mensagem para <span className="text-brand-700">{primeiroNome(clienteNome)}</span>
              </label>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
              />
              <p className="mt-2 text-xs text-slate-400">
                💡 Abre o WhatsApp do seu celular com o texto pronto — é só apertar enviar lá. Quando o cliente responder com dia e horário, a IA detecta e registra na agenda e no pipeline.
              </p>

            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                onClick={fechar}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={enviar}
                disabled={!mensagem.trim() || !link}
                className="flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1da851] disabled:opacity-50"
              >
                <MessageCircle size={15} />
                Abrir no WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
