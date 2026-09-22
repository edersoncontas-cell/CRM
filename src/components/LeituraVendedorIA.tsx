"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui";
import { lerLeituraVendedorAction, gerarLeituraVendedorAction, type EstadoLeitura } from "@/lib/orientador-vendedor-actions";
import type { LeituraIA } from "@/lib/orientador-vendedor-ia";

// A LEITURA COM IA, em cima do diagnóstico que já está na tela.
//
// O botão é obrigatório e é o ponto: ele paga só o Gemini Plus, e tela que
// chama IA sozinha a cada carregamento gasta cota dele sem ele pedir. A
// leitura fica guardada — enquanto os números não mudarem, reler não custa
// chamada nova; quando mudam, a tela avisa e ele decide se refaz.
//
// O bloco inteiro é opcional por natureza: tudo acima dele (perfil, funil,
// sinais, plano) vale sem IA nenhuma. Se não houver provedor, ou se a chamada
// falhar, a página continua completa.
export function LeituraVendedorIA() {
  const [estado, setEstado] = useState<EstadoLeitura | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, startTransition] = useTransition();

  // Falha na leitura do que está guardado NÃO pode sumir com o bloco. Sumir em
  // silêncio é o pior desfecho possível: ele não vê o botão, não vê erro, e
  // conclui que o CRM não tem isso — não tem como nem reclamar do que não
  // aparece. Na dúvida, mostra o botão e deixa ele tentar.
  useEffect(() => {
    lerLeituraVendedorAction()
      .then(setEstado)
      .catch((e) => {
        console.error("[leitura-vendedor] ler:", e);
        setEstado({ leitura: null, desatualizada: false, temIA: true });
        setErro("Não deu para buscar a leitura guardada. Dá para gerar uma nova.");
      });
  }, []);

  function gerar() {
    setErro(null);
    startTransition(async () => {
      const r = await gerarLeituraVendedorAction().catch(() => ({ ok: false, erro: "Falha ao chamar a IA." }));
      if (!r.ok || !("leitura" in r) || !r.leitura) { setErro(r.erro ?? "Não deu para gerar."); return; }
      setEstado((e) => ({ leitura: r.leitura as LeituraIA, desatualizada: false, temIA: e?.temIA ?? true }));
    });
  }

  if (!estado) return null;

  if (!estado.temIA) {
    return (
      <Card className="mb-4">
        <div className="flex items-start gap-2.5">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <div className="text-sm font-bold text-slate-700">Leitura com IA</div>
            <p className="mt-1 text-xs text-slate-500">
              Com um provedor de IA configurado, esta parte vira uma conversa sobre os seus números — o que eles
              significam e o que fazer nas próximas duas semanas. Cole a chave em Configurações para ligar.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const { leitura, desatualizada } = estado;

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <Sparkles size={16} className="text-brand-600" /> A leitura dos seus números
        </div>
        {leitura && (
          <button
            type="button"
            onClick={gerar}
            disabled={gerando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {gerando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {gerando ? "Escrevendo…" : "Gerar de novo"}
          </button>
        )}
      </div>

      {!leitura ? (
        <>
          <p className="mb-3 mt-1.5 text-xs text-slate-500">
            Os números acima já estão medidos. A IA lê esses mesmos números — nenhum outro — e escreve o que eles
            dizem do seu jeito de vender e o que fazer nas próximas duas semanas. Gasta uma chamada da sua cota.
          </p>
          <button
            type="button"
            onClick={gerar}
            disabled={gerando}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-60"
          >
            {gerando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {gerando ? "Escrevendo…" : "Ler meus números com IA"}
          </button>
        </>
      ) : (
        <>
          {desatualizada && (
            <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-50 p-2.5 text-xs font-semibold text-amber-900">
              <AlertTriangle size={13} className="mt-px shrink-0" />
              Seus números mudaram desde esta leitura. Gere de novo para ela bater com o que está na tela.
            </p>
          )}
          <div className="mt-3 space-y-2.5">
            {leitura.texto.split("\n\n").map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-slate-700">{p}</p>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Escrito por IA em {new Date(leitura.em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}, a partir
            dos números desta tela. É leitura, não verdade absoluta — o que manda é o que você viu na rua.
          </p>
        </>
      )}

      {erro && <p className="mt-2.5 text-xs font-semibold text-red-600">{erro}</p>}
    </Card>
  );
}
