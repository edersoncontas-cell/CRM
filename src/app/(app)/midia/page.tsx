import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { gerarMidiaAction } from "@/lib/midia-actions";
import { Megaphone, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MidiaPage() {
  const [posts, maquinas] = await Promise.all([
    db.midiaPost.findMany({ orderBy: { criadoEm: "desc" }, include: { maquina: true } }),
    db.maquina.findMany({ orderBy: { modelo: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Mídia & Marketing"
        subtitulo="Posts chamativos a cada 15 dias para atrair clientes"
        acao={
          <form action={gerarMidiaAction}>
            <select name="maquinaId" className="mr-2 rounded-lg border border-slate-300 px-2 py-2 text-sm">
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>{m.modelo}</option>
              ))}
            </select>
            <button className="inline-flex items-center gap-2 rounded-lg bg-agro-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              <Sparkles size={16} /> Gerar post
            </button>
          </form>
        }
      />

      {posts.length === 0 ? (
        <Card><p className="text-sm text-slate-400">Nenhum post ainda. Gere o primeiro acima! 📣</p></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-brand-600">
                  <Megaphone size={16} />
                  {p.maquina && <Badge tom="blue">{p.maquina.modelo}</Badge>}
                </div>
                <Badge tom={p.status === "publicado" ? "green" : p.status === "agendado" ? "yellow" : "slate"}>
                  {p.status}
                </Badge>
              </div>
              <h3 className="font-semibold text-slate-800">{p.titulo}</h3>
              <p className="mt-2 flex-1 whitespace-pre-wrap text-sm text-slate-600">{p.conteudo}</p>
              <div className="mt-3 text-xs text-slate-400">
                {p.agendadoPara ? `Agendado: ${formatDate(p.agendadoPara)}` : `Criado: ${formatDate(p.criadoEm)}`}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
