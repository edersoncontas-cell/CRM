import { AlertTriangle, Database, ExternalLink, Stethoscope } from "lucide-react";
import type { SaudeBanco } from "@/lib/saude-banco";

// A tela que aparece no lugar do CRM quando o banco não está de pé.
//
// Ela existe para NÃO repetir o dia em que a única informação disponível era
// "Algo deu errado nesta página". Aqui aparece o motivo por extenso, o que
// fazer, e o caminho para o diagnóstico completo — tudo legível no celular,
// porque é lá que ele descobre o problema, na rua.

export function BancoForaDoAr({ saude }: { saude: Extract<SaudeBanco, { ok: false }> }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-5 px-1 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
        <Database size={30} className="text-red-500" />
      </div>

      <div>
        <h1 className="text-xl font-bold text-red-500">{saude.titulo}</h1>
        <p className="mt-2 text-sm text-[var(--sobre-fundo-mudo)]">
          Não é a sua internet e não é o CRM: é o banco de dados onde ficam os clientes,
          as negociações e as conversas. Enquanto ele não voltar, nenhuma tela carrega.
        </p>
      </div>

      <div className="w-full rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-left">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-red-500">
          <AlertTriangle size={13} /> O que o banco respondeu
        </div>
        <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-[var(--sobre-fundo-texto)]">
          {saude.motivo}
        </pre>
      </div>

      <div className="w-full rounded-xl border border-[var(--funil-card-borda)] p-3 text-left text-sm">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--sobre-fundo-mudo)]">
          O que fazer agora
        </div>
        {saude.somenteLeitura ? (
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[13px] text-[var(--sobre-fundo-texto)]">
            <li>Abra o painel do Neon e veja o aviso de cota do projeto.</li>
            <li>
              Em <b>Settings → Storage / History retention</b>, baixar a retenção de histórico
              libera espaço na hora — é o que mais ocupa depois de uma migração grande.
            </li>
            <li>Volte aqui e recarregue. Assim que ele aceitar gravar, o CRM volta sozinho.</li>
          </ol>
        ) : (
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[13px] text-[var(--sobre-fundo-texto)]">
            <li>Abra o painel do Neon e veja se o projeto está suspenso ou com aviso de cota.</li>
            <li>Se estiver suspenso, ele acorda sozinho na primeira conexão — recarregue esta página.</li>
            <li>Continuando, abra o diagnóstico abaixo e mande a tela inteira para o Claude.</li>
          </ol>
        )}
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <a
          href="/api/diag"
          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
        >
          <Stethoscope size={15} /> Ver o diagnóstico completo
        </a>
        <a
          href="https://console.neon.tech"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--funil-card-borda)] px-4 py-2.5 text-sm font-bold text-[var(--sobre-fundo-texto)]"
        >
          <ExternalLink size={15} /> Abrir o painel do Neon
        </a>
      </div>
    </div>
  );
}
