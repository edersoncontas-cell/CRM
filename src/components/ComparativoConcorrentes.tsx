"use client";

import { useState, useTransition } from "react";
import { Card, Badge } from "@/components/ui";
import { ComparativoIA } from "@/components/ComparativoIA";
import { ComparativoCombustivel } from "@/components/ComparativoCombustivel";
import { gerarResumoDiferenciaisAction, gerarComparativoCompletoAction } from "@/lib/actions";
import { delta, vantagemContra, CATEGORIAS } from "@/lib/comparativo";
import { Swords, Trophy, Plus, X, Sparkles, Printer, RotateCcw } from "lucide-react";

type MaquinaLite = {
  id: string;
  marca: string;
  modelo: string;
  categoria: string;
  pesoOperacional: number | null;
  potencia: number | null;
  consumoLitrosHora: number | null;
};

type Minha = MaquinaLite & {
  descricao: string | null;
  pontosFortes: string | null;
  diferenciais: string | null;
  especificacoes: string | null;
  argumentos: string | null;
  imagemUrl: string | null;
};

function peso(v: number | null) {
  return v == null ? "—" : `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`;
}

// Comparativo 2.0 (item J): concorrente automático por categoria/peso continua
// como estado inicial, mas o vendedor pode adicionar QUALQUER concorrente
// cadastrado (Marca → Modelo) e comparar com vários ao mesmo tempo.
export function ComparativoConcorrentes({
  minha,
  concorrentesAutoIds,
  todosConcorrentes,
  destaqueId,
}: {
  minha: Minha;
  concorrentesAutoIds: string[];
  todosConcorrentes: MaquinaLite[];
  destaqueId?: string;
}) {
  const [selecionados, setSelecionados] = useState<string[]>(concorrentesAutoIds);
  const [marcaAdd, setMarcaAdd] = useState("");
  const [modeloAddId, setModeloAddId] = useState("");

  const [resumo, setResumo] = useState<string | null>(null);
  const [erroResumo, setErroResumo] = useState<string | null>(null);
  const [pendingResumo, startResumo] = useTransition();

  const [completo, setCompleto] = useState<string | null>(null);
  const [erroCompleto, setErroCompleto] = useState<string | null>(null);
  const [pendingCompleto, startCompleto] = useTransition();

  const concorrentes = todosConcorrentes.filter((c) => selecionados.includes(c.id));
  const marcasConcorrentes = Array.from(new Set(todosConcorrentes.map((c) => c.marca))).sort();
  const modelosDaMarca = todosConcorrentes.filter((c) => c.marca === marcaAdd);

  function adicionar() {
    if (modeloAddId && !selecionados.includes(modeloAddId)) {
      setSelecionados((s) => [...s, modeloAddId]);
    }
    setModeloAddId("");
  }

  function remover(id: string) {
    setSelecionados((s) => s.filter((x) => x !== id));
  }

  function restaurarAutomatico() {
    setSelecionados(concorrentesAutoIds);
  }

  function gerarResumo() {
    setErroResumo(null);
    startResumo(async () => {
      const r = await gerarResumoDiferenciaisAction(minha.id, selecionados);
      if (!r.ok) { setErroResumo(r.erro ?? "Erro ao gerar."); return; }
      setResumo(r.texto ?? "");
    });
  }

  function gerarCompleto() {
    setErroCompleto(null);
    startCompleto(async () => {
      const r = await gerarComparativoCompletoAction(minha.id, selecionados);
      if (!r.ok) { setErroCompleto(r.erro ?? "Erro ao gerar."); return; }
      setCompleto(r.texto ?? "");
    });
  }

  return (
    <div>
      {/* Seletor manual de concorrentes */}
      <Card className="mb-6 print:hidden">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-slate-700">
            <Swords size={18} className="text-red-500" /> Concorrentes no comparativo ({concorrentes.length})
          </h2>
          {selecionados.join(",") !== concorrentesAutoIds.join(",") && (
            <button onClick={restaurarAutomatico} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
              <RotateCcw size={12} /> Restaurar sugestão automática
            </button>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {concorrentes.length === 0 && <p className="text-sm text-slate-400">Nenhum concorrente selecionado.</p>}
          {concorrentes.map((c) => (
            <span
              key={c.id}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                c.id === destaqueId ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {c.id === destaqueId && "⚔️ "}
              {c.marca} {c.modelo}
              <button onClick={() => remover(c.id)} className="text-slate-400 hover:text-red-500" title="Remover">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Marca</label>
            <select
              value={marcaAdd}
              onChange={(e) => { setMarcaAdd(e.target.value); setModeloAddId(""); }}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
            >
              <option value="">— Selecionar —</option>
              {marcasConcorrentes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Modelo</label>
            <select
              value={modeloAddId}
              onChange={(e) => setModeloAddId(e.target.value)}
              disabled={!marcaAdd}
              className="min-w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500 disabled:opacity-50"
            >
              <option value="">— Selecionar —</option>
              {modelosDaMarca.map((m) => <option key={m.id} value={m.id}>{m.modelo}</option>)}
            </select>
          </div>
          <button
            onClick={adicionar}
            disabled={!modeloAddId}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </Card>

      {concorrentes.length === 0 ? (
        <Card><p className="text-sm text-slate-400">Nenhum concorrente selecionado ainda.</p></Card>
      ) : (
        <>
          <Card className="mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-400">
                  <th className="py-2">Marca / Modelo</th>
                  <th className="py-2">Peso</th>
                  <th className="py-2">Potência</th>
                  <th className="py-2">Δ Peso vs {minha.modelo}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b bg-brand-50 font-semibold">
                  <td className="py-2 text-brand-800">⭐ {minha.marca} {minha.modelo}</td>
                  <td className="py-2">{peso(minha.pesoOperacional)}</td>
                  <td className="py-2">{minha.potencia ? `${minha.potencia} cv` : "—"}</td>
                  <td className="py-2 text-slate-400">—</td>
                </tr>
                {concorrentes.map((c) => (
                  <tr key={c.id} className={`border-b transition-colors ${c.id === destaqueId ? "bg-red-50 font-semibold" : "hover:bg-brand-50"}`}>
                    <td className="py-2.5 font-medium text-slate-700">
                      {c.id === destaqueId && <span className="mr-1 text-red-500">⚔️</span>}
                      {c.marca} {c.modelo}
                    </td>
                    <td className="py-2.5">{peso(c.pesoOperacional)}</td>
                    <td className="py-2.5">{c.potencia ? `${c.potencia} cv` : "—"}</td>
                    <td className="py-2.5 font-mono text-slate-500">{delta(minha.pesoOperacional, c.pesoOperacional)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ComparativoCombustivel
            minhaModelo={minha.modelo}
            minhaConsumo={minha.consumoLitrosHora ?? null}
            concorrentes={concorrentes.map((c) => ({ id: c.id, marca: c.marca, modelo: c.modelo, consumo: c.consumoLitrosHora ?? null }))}
          />

          {/* Resumo de diferenciais COM benefício (item J.3) */}
          <Card className="mb-6 border-emerald-200 bg-emerald-50/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-600" />
                <div>
                  <div className="font-semibold text-slate-700">Resumo de diferenciais com benefício</div>
                  <div className="text-xs text-slate-500">Para cada diferencial real, o benefício prático e a melhor aplicação.</div>
                </div>
              </div>
              <button
                onClick={gerarResumo}
                disabled={pendingResumo}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Sparkles size={14} />
                {pendingResumo ? "Gerando..." : resumo ? "Gerar de novo" : "Gerar resumo"}
              </button>
            </div>
            {erroResumo && <p className="mt-3 text-sm text-red-600">{erroResumo}</p>}
            {resumo && <p className="mt-4 whitespace-pre-wrap rounded-xl border border-emerald-200 bg-white p-3 text-sm text-slate-700">{resumo}</p>}
          </Card>

          <ComparativoIA
            minhaId={minha.id}
            minhaModelo={minha.modelo}
            concorrentes={concorrentes.map((c) => ({ id: c.id, marca: c.marca, modelo: c.modelo }))}
          />

          {/* Comparativo completo (item J.5) */}
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-agro-600" />
                <div>
                  <div className="font-semibold text-slate-700">Gerar comparativo completo</div>
                  <div className="text-xs text-slate-500">Tabela + pontos fortes com benefício + objeções + conclusão, pronto para imprimir/PDF.</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {completo && (
                  <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <Printer size={14} /> Imprimir / PDF
                  </button>
                )}
                <button
                  onClick={gerarCompleto}
                  disabled={pendingCompleto}
                  className="flex items-center gap-2 rounded-xl bg-agro-500 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-agro-600 disabled:opacity-60"
                >
                  <Trophy size={14} />
                  {pendingCompleto ? "Gerando..." : completo ? "Gerar de novo" : "Gerar comparativo completo"}
                </button>
              </div>
            </div>
            {erroCompleto && <p className="mt-3 text-sm text-red-600 print:hidden">{erroCompleto}</p>}
            {completo && (
              <div className="mt-4">
                <div className="mb-4 flex items-center gap-3">
                  {minha.imagemUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={minha.imagemUrl} alt={minha.modelo} className="h-20 w-28 rounded-lg object-cover" />
                  )}
                  <div>
                    <Badge tom="yellow">{minha.marca}</Badge>
                    <h3 className="mt-1 text-xl font-bold text-slate-800">{minha.modelo}</h3>
                    <p className="text-xs text-slate-500">{CATEGORIAS[minha.categoria] ?? minha.categoria} vs {concorrentes.map((c) => `${c.marca} ${c.modelo}`).join(", ")}</p>
                  </div>
                </div>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-slate-700">{completo}</div>
              </div>
            )}
          </Card>

          {/* Argumentos prontos (templates rápidos, sem IA) */}
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-700 print:hidden">
            <Trophy size={18} className="text-agro-600" /> Argumentos prontos (por que a {minha.modelo} ganha)
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 print:hidden">
            {concorrentes.map((c) => (
              <Card key={c.id} className={c.id === destaqueId ? "border-red-300 ring-2 ring-red-100" : ""}>
                <div className="mb-1 flex items-center gap-2">
                  <Badge tom="red">vs {c.marca} {c.modelo}</Badge>
                  {c.id === destaqueId && <Badge tom="yellow">⚔️ batalha atual</Badge>}
                </div>
                <p className="text-sm text-slate-600">{vantagemContra(minha, c)}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
