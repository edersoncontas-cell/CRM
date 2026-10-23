import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { diaMes, type SituacaoGoogle } from "@/lib/google-conexao-regra";

// Aviso da tela de Visitas: com a conexão do Google caída, a visita nova NÃO
// vai para a Google Agenda — e ninguém percebia (só aparecia na tela de
// Clientes). Some sozinho quando a conta é reconectada. Mesmo traço da faixa
// de Clientes: escuro, borda vermelha.
export function AvisoGoogleReconectar({ situacao }: { situacao: SituacaoGoogle | null }) {
  if (!situacao || situacao.tipo !== "reconectar") return null;
  const quando = diaMes(situacao.desde);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm" style={{ background: "#18181b", border: "1px solid #7f1d1d" }} role="alert" data-google-estado="reconectar">
      <AlertCircle size={18} className="mt-0.5 shrink-0 self-start text-red-400" />
      <div className="min-w-0 flex-1 basis-64 text-zinc-300">
        <b className="text-white">As visitas novas não estão entrando na sua Google Agenda</b>
        <p className="mt-0.5 text-xs text-zinc-400">
          A conexão com o Google expirou{quando ? ` em ${quando}` : ""}. As visitas continuam salvas aqui no CRM; só o lembrete na Agenda parou — e as marcadas enquanto estiver caída não entram sozinhas na Agenda depois de reconectar.{" "}
          <Link href="/configuracoes#google" className="text-[#ffcb2d] underline">Ver os passos</Link>
        </p>
      </div>
      <a href="/api/google/auth" className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#ffcb2d] px-3 py-1.5 text-xs font-bold text-black hover:brightness-95 max-sm:w-full">
        <RefreshCw size={14} /> Reconectar com o Google
      </a>
    </div>
  );
}
