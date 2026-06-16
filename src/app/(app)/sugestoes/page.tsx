import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { resolverSugestao } from "@/lib/actions";
import { Sparkles, Check, X, Phone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SugestoesPage() {
  const sugestoes = await db.sugestaoVinculo.findMany({
    where: { status: "pendente" },
    include: { clienteSugerido: true },
    orderBy: { confianca: "desc" },
  });

  return (
    <div>
      <PageHeader
        titulo="Sugestões inteligentes"
        subtitulo="Como no Google Fotos: confirme com 1 clique a quem pertence cada contato"
      />

      {sugestoes.length === 0 ? (
        <Card><p className="text-sm text-slate-400">Sem sugestões pendentes. Tudo identificado! ✨</p></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sugestoes.map((s) => (
            <Card key={s.id}>
              <div className="mb-3 flex items-center gap-2">
                <Sparkles size={18} className="text-agro-600" />
                <span className="text-sm font-semibold text-slate-700">Contato não identificado</span>
                <Badge tom={s.confianca >= 70 ? "green" : "yellow"}>{s.confianca}% confiança</Badge>
              </div>

              <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
                <Phone size={14} /> {s.telefone}
                {s.nomeDetectado && <span className="text-slate-400">· detectado: <b>{s.nomeDetectado}</b></span>}
              </div>

              {s.textoContexto && (
                <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs italic text-slate-500">
                  &ldquo;{s.textoContexto}&rdquo;
                </p>
              )}

              <div className="mb-3 text-sm">
                {s.clienteSugerido ? (
                  <span className="text-slate-600">
                    Vincular a <b className="text-brand-700">{s.clienteSugerido.nome}</b>?
                  </span>
                ) : (
                  <span className="text-slate-600">
                    Criar novo cliente <b className="text-brand-700">{s.nomeDetectado ?? "(sem nome)"}</b>?
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <form action={resolverSugestao.bind(null, s.id, "confirmar")} className="flex-1">
                  <button className="flex w-full items-center justify-center gap-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700">
                    <Check size={15} /> Confirmar
                  </button>
                </form>
                <form action={resolverSugestao.bind(null, s.id, "rejeitar")} className="flex-1">
                  <button className="flex w-full items-center justify-center gap-1 rounded-lg bg-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-300">
                    <X size={15} /> Rejeitar
                  </button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
