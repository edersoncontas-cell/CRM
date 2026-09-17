"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadCloud, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { prepararImportacaoAction } from "@/lib/whatsapp-importacao-actions";

// Puxa para o Atendimento as conversas que a Evolution guardou do celular.
//
// Duas coisas que faziam o botão "não trazer nada":
//  1. a data de corte (16/09) barrava todo o histórico — agora o vendedor
//     escolhe "a partir de" qual dia quer, e o corte recua junto;
//  2. a instância não pedia o histórico completo ao celular — o preparo liga
//     isso antes de importar (vale a partir do próximo pareamento).

function diasAtras(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function ddmm(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

type Resultado = { tipo: "ok" | "aviso" | "erro"; texto: string; detalhe?: string };

export function ImportarAtendimento({ dataCorte }: { dataCorte: string | null }) {
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [desde, setDesde] = useState(dataCorte ?? diasAtras(30));
  const router = useRouter();

  async function importar() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) { setResultado({ tipo: "erro", texto: "Escolha o dia a partir do qual importar." }); return; }
    const recuaCorte = !!dataCorte && desde < dataCorte;
    const pergunta = recuaCorte
      ? `Importar as conversas do celular a partir de ${ddmm(desde)}?\n\nA data de corte (${ddmm(dataCorte!)}) vai recuar para ${ddmm(desde)} — conversas que você apagou à mão continuam apagadas.`
      : `Importar as conversas do celular a partir de ${ddmm(desde)}? Pode levar 1-2 minutos.`;
    if (!confirm(pergunta)) return;

    setRodando(true);
    setResultado(null);
    setProgresso("Preparando a conexão…");

    // 1) Liga o histórico completo na instância e vê se a Evolution tem algo.
    const preparo = await prepararImportacaoAction().catch(() => null);
    const historicoLigadoAgora = preparo?.historico?.ok === true && preparo.historico.jaEstava === false;
    if (preparo && preparo.conversasGuardadas === 0) {
      setRodando(false);
      setProgresso(null);
      setResultado({
        tipo: "aviso",
        texto: "A Evolution ainda não tem nenhuma conversa guardada — o celular só manda o histórico na hora de parear.",
        detalhe: `${historicoLigadoAgora ? "Acabei de ligar o histórico completo na instância. " : ""}Clique em Desconectar lá em cima, leia o QR de novo, espere 1–2 minutos e volte aqui para importar.`,
      });
      return;
    }

    // 2) Importa em lotes.
    let page = 1, chats = 0, msgs = 0, criadas = 0, semNada = 0, more = true, guard = 0;
    while (more && guard < 80) {
      guard++;
      const r = await fetch("/api/whatsapp/import-history", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, pageSize: 5, messagesPerChat: 300, desde }),
      }).then((res) => res.json()).catch(() => null);
      if (!r?.ok) {
        setResultado({ tipo: "erro", texto: "A importação parou no meio.", detalhe: `Lote ${page}: a Evolution não respondeu ou está desconectada. O que já veio ficou salvo — pode clicar de novo.` });
        setRodando(false); setProgresso(null);
        router.refresh();
        return;
      }
      chats += r.chatsProcessed; msgs += r.messagesImported; criadas += r.conversationsCreated ?? 0; semNada += r.chatsIgnoradosAntigos ?? 0;
      more = r.hasMore; page = r.nextPage;
      setProgresso(`Importando… ${chats} conversas lidas, ${msgs} mensagens novas`);
    }

    setRodando(false);
    setProgresso(null);
    const partes = [`${msgs} mensagem(ns) nova(s) em ${chats - semNada} conversa(s)`];
    if (criadas) partes.push(`${criadas} conversa(s) nova(s) no Atendimento`);
    if (semNada) partes.push(`${semNada} sem nada desde ${ddmm(desde)}`);
    setResultado({
      tipo: msgs > 0 ? "ok" : "aviso",
      texto: msgs > 0 ? "Importação concluída." : "Nada novo para importar.",
      detalhe: partes.join(" · ") + (historicoLigadoAgora
        ? " Liguei o histórico completo na instância: para o celular mandar as conversas antigas, desconecte e leia o QR de novo uma vez."
        : msgs === 0 && chats > 0
        ? " Se no celular há conversas mais antigas que não vieram, desconecte e leia o QR de novo — é no pareamento que o celular manda o histórico."
        : ""),
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Trazer a partir de
          <input
            type="date"
            value={desde}
            max={diasAtras(0)}
            onChange={(e) => setDesde(e.target.value)}
            disabled={rodando}
            className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-brand-400"
          />
        </label>
        <button
          onClick={importar}
          disabled={rodando}
          className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60"
        >
          {rodando ? <Loader2 size={15} className="animate-spin" /> : <DownloadCloud size={15} />}
          {progresso ?? "Importar conversas do celular"}
        </button>
      </div>
      {dataCorte && desde < dataCorte && !rodando && (
        <p className="text-[11px] text-amber-700">
          Antes da data de corte ({ddmm(dataCorte)}): ao importar, o corte recua para {ddmm(desde)}.
        </p>
      )}
      {resultado && (
        <div className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
          resultado.tipo === "ok" ? "bg-green-50 text-green-800" : resultado.tipo === "aviso" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"
        }`}>
          {resultado.tipo === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <div>
            <b>{resultado.texto}</b>
            {resultado.detalhe && <div className="mt-0.5 text-xs opacity-90">{resultado.detalhe}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
