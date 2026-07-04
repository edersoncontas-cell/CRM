import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { MaquinaPicker } from "@/components/MaquinaPicker";
import { ComparativoConcorrentes } from "@/components/ComparativoConcorrentes";
import { NotasMaquina } from "@/components/NotasMaquina";
import { concorrentesSimilares, CATEGORIAS, type MaquinaComparavel } from "@/lib/comparativo";
import { Swords, Weight, Gauge } from "lucide-react";

export const dynamic = "force-dynamic";

function peso(v: number | null) {
  return v == null ? "—" : `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`;
}

export default async function ComparativoPage({
  searchParams,
}: {
  searchParams: { maquina?: string; modelo?: string; vs?: string };
}) {
  const [todas, notasRaw] = await Promise.all([
    db.maquina.findMany({ orderBy: [{ categoria: "asc" }, { pesoOperacional: "asc" }] }) as Promise<MaquinaComparavel[]>,
    db.notaMaquina.findMany({ orderBy: { criadoEm: "desc" } }),
  ]);
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

  const vsParam = (searchParams.vs ?? "").toLowerCase().trim();
  const todosConcorrentes = todas.filter((m) => !m.proprio);
  const concorrentesAuto = concorrentesSimilares(minha, todas);

  // ?vs=NomeConcorrente (deep link do funil/ficha do cliente): garante que o
  // concorrente citado entre na seleção inicial, mesmo fora da faixa de peso.
  const vsDestaque = vsParam
    ? todosConcorrentes.find(
        (c) => `${c.marca} ${c.modelo}`.toLowerCase().includes(vsParam) || vsParam.includes(c.marca.toLowerCase())
      )
    : undefined;

  const concorrentesAutoIds = concorrentesAuto.map((c) => c.id);
  if (vsDestaque && !concorrentesAutoIds.includes(vsDestaque.id)) {
    concorrentesAutoIds.unshift(vsDestaque.id);
  }

  const notas = notasRaw.map((n) => ({
    id: n.id,
    maquinaId: n.maquinaId,
    concorrenteId: n.concorrenteId,
    texto: n.texto,
    criadoEm: n.criadoEm.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        titulo="Comparativo de máquinas"
        subtitulo="Sua máquina vs concorrentes — sugestão automática por categoria/peso ou escolha manual, com argumentos prontos"
      />

      {vsDestaque && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 print:hidden">
          <Swords size={16} className="shrink-0 text-red-500" />
          <span className="text-sm text-red-700">
            Modo batalha ativado — mostrando <b>{minha.modelo}</b> vs{" "}
            <b>{vsDestaque.marca} {vsDestaque.modelo}</b> em destaque
          </span>
        </div>
      )}

      <div className="mb-6 print:hidden">
        <label className="mb-1 block text-sm font-medium text-slate-700">Selecione sua máquina (Marca → Modelo)</label>
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

      <NotasMaquina
        minhas={minhas.map((m) => ({ id: m.id, marca: m.marca, modelo: m.modelo }))}
        concorrentes={todosConcorrentes.map((m) => ({ id: m.id, marca: m.marca, modelo: m.modelo }))}
        notasIniciais={notas}
        minhaAtualId={minha.id}
      />

      <ComparativoConcorrentes
        minha={{
          id: minha.id,
          marca: minha.marca,
          modelo: minha.modelo,
          categoria: minha.categoria,
          pesoOperacional: minha.pesoOperacional,
          potencia: minha.potencia,
          consumoLitrosHora: minha.consumoLitrosHora ?? null,
          descricao: minha.descricao,
          pontosFortes: minha.pontosFortes,
          diferenciais: minha.diferenciais,
          especificacoes: minha.especificacoes ?? null,
          argumentos: minha.argumentos ?? null,
          imagemUrl: minha.imagemUrl ?? null,
        }}
        concorrentesAutoIds={concorrentesAutoIds}
        todosConcorrentes={todosConcorrentes.map((c) => ({
          id: c.id,
          marca: c.marca,
          modelo: c.modelo,
          categoria: c.categoria,
          pesoOperacional: c.pesoOperacional,
          potencia: c.potencia,
          consumoLitrosHora: c.consumoLitrosHora ?? null,
        }))}
        destaqueId={vsDestaque?.id}
      />
    </div>
  );
}
