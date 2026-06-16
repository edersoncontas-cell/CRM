import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PostCard } from "@/components/MarketingWorkflow";
import { GerarPostForm } from "@/components/GerarPostForm";
import { Megaphone, Sparkles, Clock, CheckCircle, Send } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const [campanhas, municipios, maquinasLinhas] = await Promise.all([
    db.campanhaMarketing.findMany({
      orderBy: { criadoEm: "desc" },
      take: 50,
    }),
    db.municipio.findMany({ orderBy: { nome: "asc" }, select: { nome: true } }),
    db.maquina.findMany({
      where: { proprio: true },
      select: { marca: true, categoria: true },
    }),
  ]);

  const rascunhos = campanhas.filter((c) => c.status === "rascunho");
  const aprovados = campanhas.filter((c) => c.status === "aprovado");
  const enviados = campanhas.filter((c) => c.status === "enviado");
  const rejeitados = campanhas.filter((c) => c.status === "rejeitado");

  const nomesMusicipio = municipios.map((m) => m.nome);

  // Categorias únicas das minhas máquinas
  const categorias = [...new Set(maquinasLinhas.map((m) => m.categoria))].sort();
  const marcas = [...new Set(maquinasLinhas.map((m) => m.marca))];

  return (
    <div>
      {/* Hero banner */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-fuchsia-700 via-brand-700 to-brand-900 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xl font-bold">
              <Megaphone size={22} /> Marketing com IA
            </div>
            <p className="mt-1 text-sm text-brand-100">
              A IA gera posts criativos para Instagram e WhatsApp — você aprova ou pede mudança antes de enviar.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Stat icon={<Clock size={16} />} label="Aguardando aprovação" valor={rascunhos.length} cor="bg-amber-400/20 text-amber-200" />
            <Stat icon={<CheckCircle size={16} />} label="Aprovados" valor={aprovados.length} cor="bg-emerald-400/20 text-emerald-200" />
            <Stat icon={<Send size={16} />} label="Enviados este mês" valor={enviados.length} cor="bg-brand-400/20 text-brand-100" />
          </div>
        </div>
      </div>

      {/* Gerador de post */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <Sparkles size={18} className="text-fuchsia-600" /> Gerar novo post
        </div>
        <GerarPostForm categorias={categorias} marcas={marcas} />
      </div>

      {/* Pendentes de aprovação */}
      {rascunhos.length > 0 && (
        <Section titulo="✏️ Aguardando sua aprovação" subtitulo={`${rascunhos.length} post(s) gerado(s) pela IA`} destaque>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rascunhos.map((c) => (
              <PostCard key={c.id} campanha={c} municipios={nomesMusicipio} />
            ))}
          </div>
        </Section>
      )}

      {/* Aprovados — prontos para envio */}
      {aprovados.length > 0 && (
        <Section titulo="✅ Aprovados — prontos para enviar" subtitulo={`${aprovados.length} post(s) aguardando disparo`}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {aprovados.map((c) => (
              <PostCard key={c.id} campanha={c} municipios={nomesMusicipio} />
            ))}
          </div>
        </Section>
      )}

      {/* Enviados */}
      {enviados.length > 0 && (
        <Section titulo="📤 Histórico de envios" subtitulo={`${enviados.length} campanha(s) enviada(s)`}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {enviados.map((c) => (
              <PostCard key={c.id} campanha={c} municipios={nomesMusicipio} />
            ))}
          </div>
        </Section>
      )}

      {/* Rejeitados */}
      {rejeitados.length > 0 && (
        <Section titulo="❌ Rejeitados" subtitulo="Posts que não foram aprovados">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rejeitados.map((c) => (
              <PostCard key={c.id} campanha={c} municipios={nomesMusicipio} />
            ))}
          </div>
        </Section>
      )}

      {campanhas.length === 0 && (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <Megaphone size={40} className="mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">Nenhum post gerado ainda.</p>
          <p className="mt-1 text-sm text-slate-400">Use o gerador acima para criar seu primeiro post! 🚀</p>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon, label, valor, cor,
}: {
  icon: React.ReactNode; label: string; valor: number; cor: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${cor}`}>
      {icon}
      <div>
        <div className="text-xl font-bold leading-none">{valor}</div>
        <div className="text-xs opacity-80">{label}</div>
      </div>
    </div>
  );
}

function Section({
  titulo, subtitulo, children, destaque,
}: {
  titulo: string; subtitulo?: string; children: React.ReactNode; destaque?: boolean;
}) {
  return (
    <div className={`mb-8 ${destaque ? "rounded-2xl border-2 border-amber-200 bg-amber-50 p-5" : ""}`}>
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-800">{titulo}</h2>
        {subtitulo && <p className="text-xs text-slate-500">{subtitulo}</p>}
      </div>
      {children}
    </div>
  );
}
