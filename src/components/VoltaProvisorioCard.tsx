"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { DatabaseBackup, Loader2, Search, ArrowDownToLine, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { EstadoProvisorio } from "@/lib/trazer-provisorio-estado";
import type { ResultadoEtapa, ResultadoVolta } from "@/lib/trazer-provisorio";

function fmtData(d: string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

const NAO_VEM_LEGIVEL: Record<string, string> = {
  UnificacaoClientes: "unificações de duplicados",
  LimpezaClientes: "limpezas de cadastros",
  ClienteRedirecionamento: "redirecionamentos dessas operações",
};

// A volta do banco provisório para o principal. Aparece sempre (mesmo sem
// provisório configurado) para o caminho existir quando precisar; os estados
// dizem o que falta — nunca some em silêncio.
export function VoltaProvisorioCard({ inicial }: { inicial: EstadoProvisorio }) {
  const [estado, setEstado] = useState(inicial);
  const [previa, setPrevia] = useState<ResultadoEtapa[] | null>(null);
  const [ocupado, setOcupado] = useState<"previa" | "trazer" | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<ResultadoEtapa[] | null>(null);
  const [proxima, setProxima] = useState(0);

  const novas = previa?.reduce((s, e) => s + e.novas, 0) ?? 0;
  const jaTrazidas = previa?.reduce((s, e) => s + e.jaTrazidas, 0) ?? 0;
  const erros = previa?.filter((e) => e.erro) ?? [];
  // Até 3 erros na tela; os avisos (não são erro) aparecem todos.
  const comAviso = [...erros.slice(0, 3), ...(previa?.filter((e) => e.observacao && !e.erro) ?? [])];

  async function verPrevia() {
    setOcupado("previa"); setErro(null);
    try {
      const r = await fetch("/api/admin/trazer-provisorio?previa=1", { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { estado?: EstadoProvisorio; previa?: ResultadoVolta; erro?: string };
      if (j.estado) setEstado(j.estado);
      if (!r.ok || j.erro || !j.previa) {
        setErro(j.erro === "mesmo-banco"
          ? "O banco em uso ainda é o provisório. Troque o DATABASE_URL para o principal na Vercel e republique."
          : `Não consegui comparar os dois bancos: ${j.erro ?? `resposta ${r.status}`}`);
        return;
      }
      setPrevia(j.previa.etapas);
    } catch {
      setErro("Não consegui falar com o CRM. Confira a internet e tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  async function trazer() {
    if (!window.confirm(`Trazer ${novas} registro(s) do banco provisório para o principal? O que já existe no principal não é duplicado nem apagado, e nada sai pelo WhatsApp.`)) return;
    setOcupado("trazer"); setErro(null); setFeito(null);
    const acumulado: ResultadoEtapa[] = [];
    let inicio = proxima;
    try {
      for (let i = 0; i < 60; i++) {
        setProgresso(`Trazendo… etapa ${Math.min(inicio + 1, estado.totalEtapas)} de ${estado.totalEtapas}`);
        const r = await fetch("/api/admin/trazer-provisorio", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inicio }),
        });
        const j = (await r.json().catch(() => ({}))) as Partial<ResultadoVolta> & { erro?: string };
        if (!r.ok || j.erro) throw new Error(j.erro ?? `resposta ${r.status}`);
        acumulado.push(...(j.etapas ?? []));
        const comErro = (j.etapas ?? []).find((e) => e.erro);
        inicio = j.proxima ?? inicio;
        setProxima(inicio);
        if (comErro) throw new Error(`${comErro.rotulo}: ${comErro.erro}`);
        if (j.concluido) break;
      }
      setFeito(acumulado);
      setProxima(0);
      await verPrevia();
    } catch (e) {
      setFeito(acumulado);
      setErro(`Parou no meio: ${e instanceof Error ? e.message : String(e)}. O que já entrou não duplica — toque em "Continuar" para seguir de onde parou.`);
    } finally {
      setOcupado(null); setProgresso(null);
    }
  }

  const gravadas = feito?.reduce((s, e) => s + e.gravadas, 0) ?? 0;
  const completados = feito?.reduce((s, e) => s + e.atualizadas, 0) ?? 0;

  // id: o aviso do Atendimento ("as conversas do provisório ainda não
  // vieram") traz direto para cá.
  return (
    <div id="trazer-provisorio" className="scroll-mt-24">
    <Card className="mt-6">
      <div className="mb-1.5 flex items-center gap-2 font-semibold text-slate-700">
        <DatabaseBackup size={18} className="text-brand-600" /> Trazer os dados do banco provisório
      </div>
      <p className="text-xs leading-snug text-slate-500">
        Quando o banco principal cai e o CRM roda num banco provisório, o que você cadastrou lá volta por aqui. Soma ao principal
        sem duplicar: o mesmo cliente, a mesma conversa e a mesma mensagem viram um só. Nada é apagado, nenhuma trava é afrouxada e
        nada sai pelo WhatsApp (envios pendentes chegam cancelados).
      </p>

      {!estado.configurado ? (
        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Nenhum banco provisório configurado — não há nada para trazer.
          <span className="block text-xs text-slate-500">Para usar: na Vercel, a variável DATABASE_URL_PROVISORIO com o endereço do banco provisório.</span>
        </div>
      ) : estado.mesmoBanco ? (
        <div className="mt-2 flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            O banco em uso ainda é o provisório ({estado.provisorio}). Primeiro troque o DATABASE_URL e o DATABASE_URL_UNPOOLED para o
            principal na Vercel e republique; depois volte aqui.
          </span>
        </div>
      ) : (
        <>
          <div className="mt-2 text-xs text-slate-500">
            Principal em uso: <b className="text-slate-700">{estado.principal}</b> · provisório: <b className="text-slate-700">{estado.provisorio}</b>
            {estado.ultima && (
              <span className="block">
                Última vez: {fmtData(estado.ultima.quando)} — {estado.ultima.concluido ? "concluída" : "parou no meio"}, {estado.ultima.gravadas} registro(s).
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={verPrevia} disabled={ocupado !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
              {ocupado === "previa" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              {ocupado === "previa" ? "Comparando os dois bancos…" : previa ? "Comparar de novo" : "Ver o que vai ser trazido"}
            </button>
            {previa && novas > 0 && erros.length === 0 && (
              <button type="button" onClick={trazer} disabled={ocupado !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
                {ocupado === "trazer" ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />}
                {ocupado === "trazer" ? progresso ?? "Trazendo…" : proxima > 0 ? "Continuar de onde parou" : `Trazer ${novas} registro(s)`}
              </button>
            )}
          </div>

          {previa && erros.length > 0 && (
            <div className="mt-2 flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                {erros.length} parte(s) não deu para comparar{erros.length > 3 ? " (as 3 primeiras abaixo)" : ""}. O resultado desta
                comparação não está completo — confira o motivo e compare de novo.
              </span>
            </div>
          )}

          {previa && novas === 0 && !erro && erros.length === 0 && (
            <div className="mt-2 flex gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>
                {jaTrazidas > 0 ? "Tudo o que estava no provisório já está no principal." : "O provisório não tem nada que falte no principal."}
                {" "}Pode tirar a variável DATABASE_URL_PROVISORIO da Vercel quando quiser.
              </span>
            </div>
          )}

          {previa && (
            <div className="mt-2 max-h-72 overflow-y-auto rounded-lg bg-slate-50 p-2 text-xs">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[11px] text-slate-500">
                    <th className="py-1 pr-2 font-semibold">O quê</th>
                    <th className="py-1 pr-2 text-right font-semibold">entra</th>
                    <th className="py-1 text-right font-semibold">já está no principal</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.filter((e) => e.noProvisorio > 0 || e.erro).map((e) => (
                    <tr key={e.tabela} className="border-t border-slate-200/70">
                      <td className="py-1 pr-2 text-slate-700">{e.rotulo}</td>
                      <td className={`py-1 pr-2 text-right font-semibold ${e.novas ? "text-slate-900" : "text-slate-400"}`}>{e.novas}</td>
                      <td className="py-1 text-right text-slate-500">{e.jaExistiam + e.jaTrazidas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {previa && (
            <>
              {/* Fora da rolagem: aviso escondido no fim da tabela não é aviso. */}
              {comAviso.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {comAviso.map((e) => (
                    <li key={e.tabela} className={`rounded-md px-2 py-1 ${e.erro ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                      <b>{e.rotulo}:</b> {e.erro ?? e.observacao}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Não vêm: {estado.naoVem.map((t) => NAO_VEM_LEGIVEL[t] ?? t).join(", ")} feitas no provisório (os ids delas são de lá).
                Cliente apagado no provisório continua no principal.
              </p>
            </>
          )}

          {feito && (gravadas > 0 || completados > 0) && (
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {erro ? "Até aqui" : "Pronto"}: {gravadas} registro(s) novo(s) no principal e {completados} registro(s) completado(s).
            </div>
          )}
        </>
      )}

      {erro && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
    </Card>
    </div>
  );
}
