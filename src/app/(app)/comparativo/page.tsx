import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { MaquinaPicker } from "@/components/MaquinaPicker";
import { ComparativoIA } from "@/components/ComparativoIA";
import {
  concorrentesSimilares, vantagemContra, delta, CATEGORIAS, type MaquinaComparavel,
} from "@/lib/comparativo";
import { Swords, Trophy, Weight, Gauge } from "lucide-react";

export const dynamic = "force-dynamic";

function peso(v: number | null) {
  return v == null ? "—" : `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`;
}

export default async function ComparativoPage({
  searchParams,
}: {
  searchParams: { maquina?: string; modelo?: string };
}) {
  const todas = (await db.maquina.findMany({ orderBy: [{ categoria: "asc" }, { pesoOperacional: "asc" }] })) as MaquinaComparavel[];
  const minhas = todas.filter((m) => m.proprio);

  const porModelo = searchParams.modelo
    ? minhas.find((m) => m.modelo.toLowerCase().includes(searchParams.modelo!.toLowerCase()) || searchParams.modelo!.toLowerCase().includes(m.modelo.toLowerCase().split(" ")[0]))
    : undefined;
  const minha =
    todas.find((m) => m.id === searchParams.maquina && m.proprio) ?? porModelo ?? minhas[0];

  if (!minha) {
    return (
      <div>
        <PageHeader titulo="Comparativo de máquinas" />
        <Card><p className="text-sm text-slate-400">Cadastre suas máquinas para comparar.</p></Card>
      </div>
    );
  }

  const concorrentes = concorrentesSimilares(minha, todas);

  return (
    <div>
      <PageHeader
        titulo="Comparativo de máquinas"
        subtitulo="Sua máquina vs concorrentes da mesma categoria e faixa de peso — com argumentos prontos"
      />

      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium text-slate-700">Selecione sua máquina</label>
        <MaquinaPicker minhas={minhas} selecionada={minha.id} />
      </div>

      {/* Minha máquina em destaque */}
      <Card className="mb-6 border-brand-300 bg-gradient-to-br from-brand-700 to-brand-900 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge tom="yellow">{minha.marca}</Badge>
              <span className="text-xs text-brand-200">{CATEGORIAS[minha.categoria]}</span>
            </div>
            <h2 className="mt-1 text-2xl font-bold">{minha.modelo}</h2>
            <p className="mt-1 max-w-2xl text-sm text-brand-100">{minha.descricao}</p>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <div className="flex items-center gap-1 text-xs text-brand-200"><Weight size={12} /> Peso</div>
              <div className="text-lg font-bold">{peso(minha.pesoOperacional)}</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-xs text-brand-200"><Gauge size={12} /> Potência</div>
              <div className="text-lg font-bold">{minha.potencia ? `${minha.potencia} cv` : "—"}</div>
            </div>
          </div>
        </div>
        {minha.pontosFortes && (
          <div className="mt-3 rounded-lg bg-white/10 p-3 text-sm">
            <b className="text-agro-500">✓ Pontos fortes:</b> {minha.pontosFortes}
          </div>
        )}
        {minha.diferenciais && (
          <div className="mt-2 text-sm text-brand-100">
            <b>💬 Diferenciais:</b> {minha.diferenciais}
          </div>
        )}
      </Card>

      {/* Tabela comparativa */}
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
        <Swords size={18} className="text-red-500" /> Concorrentes na mesma faixa ({concorrentes.length})
      </h2>

      {concorrentes.length === 0 ? (
        <Card><p className="text-sm text-slate-400">Nenhum concorrente cadastrado nesta faixa ainda.</p></Card>
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
                {concorrentes.map((c, idx) => (
                  <tr key={c.id} className={`border-b transition-colors hover:bg-brand-50 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="py-2.5 font-medium text-slate-700">{c.marca} {c.modelo}</td>
                    <td className="py-2.5">{peso(c.pesoOperacional)}</td>
                    <td className="py-2.5">{c.potencia ? `${c.potencia} cv` : "—"}</td>
                    <td className="py-2.5 font-mono text-slate-500">{delta(minha.pesoOperacional, c.pesoOperacional)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Análise da IA usando as fichas técnicas */}
          <ComparativoIA
            minhaId={minha.id}
            minhaModelo={minha.modelo}
            concorrentes={concorrentes.map((c) => ({ id: c.id, marca: c.marca, modelo: c.modelo }))}
          />

          {/* Battlecards */}
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
            <Trophy size={18} className="text-agro-600" /> Argumentos prontos (por que a {minha.modelo} ganha)
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {concorrentes.map((c) => (
              <Card key={c.id}>
                <div className="mb-1 flex items-center gap-2">
                  <Badge tom="red">vs {c.marca} {c.modelo}</Badge>
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
