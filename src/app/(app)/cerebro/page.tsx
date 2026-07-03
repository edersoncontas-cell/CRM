import { db } from "@/lib/db";
import { garantirRegioes } from "@/lib/regioes";
import { CerebroChat } from "@/components/CerebroChat";
import { Brain } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CerebroPage() {
  await garantirRegioes();

  const [totalClientes, negsAbertas, negsGanhas, negsPerdidas, audits] = await Promise.all([
    db.cliente.count(),
    db.negociacao.count({ where: { status: "aberta" } }),
    db.negociacao.count({ where: { status: "ganha" } }),
    db.negociacao.count({ where: { status: "perdida" } }),
    db.auditLog.findMany({
      orderBy: { criadoEm: "desc" },
      take: 30,
      select: { id: true, acao: true, descricao: true, criadoEm: true, origem: true, entidade: true },
    }),
  ]);

  return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-6 p-6 md:-m-8 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "rgba(191,222,77,0.15)", border: "1px solid rgba(191,222,77,0.3)" }}>
          <Brain size={24} style={{ color: "#BFDE4D" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Cérebro IA</h1>
          <p className="text-xs text-zinc-500">Controle total · análise · autonomia sem limites</p>
        </div>
      </div>

      {/* Métricas rápidas */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Clientes", valor: totalClientes, cor: "#60a5fa" },
          { label: "Negoc. abertas", valor: negsAbertas, cor: "#BFDE4D" },
          { label: "Vendas faturadas", valor: negsGanhas, cor: "#4ade80" },
          { label: "Perdidas", valor: negsPerdidas, cor: "#f87171" },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl p-4" style={{ background: "#18181b", border: "1px solid #27272a" }}>
            <div className="text-2xl font-black" style={{ color: m.cor }}>{m.valor}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chat principal */}
        <div className="lg:col-span-2">
          <CerebroChat />
        </div>

        {/* Auditoria lateral */}
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "#18181b", border: "1px solid #27272a" }}>
          <div className="text-sm font-bold text-white mb-3">Auditoria — últimas ações</div>
          {audits.length === 0 ? (
            <p className="text-xs text-zinc-600">Nenhuma ação registrada ainda.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {audits.map((a) => (
                <div key={a.id} className="rounded-xl px-3 py-2 text-xs" style={{ background: "#09090b", border: "1px solid #27272a" }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold" style={{ color: a.origem === "ia" ? "#BFDE4D" : a.origem === "usuario" ? "#60a5fa" : "#a1a1aa" }}>
                      {a.origem === "ia" ? "🤖 IA" : a.origem === "usuario" ? "👤 Usuário" : "⚙️ Sistema"}
                    </span>
                    <span className="text-zinc-600">{new Date(a.criadoEm).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">{a.descricao}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
