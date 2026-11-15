import Link from "next/link";
import { Snowflake, ArrowRight } from "lucide-react";
import { Painel, Anel } from "@/components/dashboard-ui";
import { temaDashAtual } from "@/lib/tema-servidor";
import { formatCurrency } from "@/lib/utils";
import { fmtDiaBR } from "@/lib/fuso-brasilia";
import { DIAS_PARADO, type DadosMeuMes } from "@/lib/meu-mes-regra";

// Bloco "Meu mês" no topo do Dashboard (Etapa 4). Só aparece com o recurso de
// Metas ligado. Componente de servidor: recebe os dados prontos da página.

export function MeuMes({ dados, erro, semContato30 }: { dados: DadosMeuMes | null; erro: boolean; semContato30: number }) {
  const T = temaDashAtual();

  // Falhou: o bloco DIZ que falhou (sumir em silêncio seria pior).
  if (erro || !dados) {
    return (
      <Painel titulo="Meu mês">
        <p role="alert" className="text-sm" style={{ color: T.vermelho }}>
          Não foi possível montar o seu mês agora. Os outros painéis abaixo continuam valendo; atualize a página para tentar de novo.
        </p>
      </Painel>
    );
  }

  const p = dados.progresso;
  const pct = Math.round(p.pct * 100);
  const bateu = p.bateu;
  const ritmo = p.ritmo === "adiantado" ? { t: "Adiantado", c: T.verde }
    : p.ritmo === "atrasado" ? { t: "Atrasado", c: T.vermelho }
    : p.ritmo === "no_ritmo" ? { t: "No ritmo", c: T.ciano } : null;

  return (
    <Painel
      titulo={`Meu mês · ${dados.rotuloMes}`}
      acao={<Link href="/metas" className="shrink-0 text-[11px] font-bold underline" style={{ color: T.ciano }}>Metas</Link>}
    >
      {/* Anel + frase da meta */}
      <div className="flex items-center gap-4">
        <Anel id="meumes" valor={p.atual} max={dados.meta.meta} cor1={bateu ? T.verde : T.rosa} cor2={bateu ? T.ciano : T.violeta} tamanho={104}>
          <span className="text-3xl font-black leading-none">{p.atual}</span>
          <span className="text-[10px]" style={{ color: T.mudo }}>/{dados.meta.meta}</span>
        </Anel>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black leading-tight">
            {bateu ? "Meta do mês batida" : `Você está em ${pct}%`}
            {ritmo && <span className="ml-2 rounded-full px-2 py-0.5 align-middle text-[10px] font-black uppercase tracking-wide" style={{ background: T.sobre2, color: ritmo.c }}>{ritmo.t}</span>}
          </p>
          <p className="mt-1 text-sm" style={{ color: T.texto2 }}>
            {bateu ? "Todas as máquinas da meta já foram faturadas." : <>Faltam <strong style={{ color: T.texto }}>{p.falta}</strong> máquina{p.falta === 1 ? "" : "s"} · {p.diasRestantes} dia{p.diasRestantes === 1 ? "" : "s"} restante{p.diasRestantes === 1 ? "" : "s"}</>}
          </p>
          {dados.meta.supermeta != null && (
            <p className="text-xs" style={{ color: T.mudo }}>
              Supermeta {dados.meta.supermeta}: {p.bateuSupermeta ? "batida" : `faltam ${p.faltaSupermeta}`}
            </p>
          )}
          <p className="text-xs" style={{ color: T.mudo }}>{formatCurrency(dados.faturadoNoMes)} faturados no mês</p>
        </div>
      </div>

      {dados.meta.origem === "parametros" && (
        <p className="mt-3 text-xs" style={{ color: T.amarelo }}>
          Meta estimada pela sua meta anual dividida por 12.{" "}
          <Link href="/metas" className="font-bold underline">Defina a meta do mês em Metas</Link>.
        </p>
      )}
      {dados.incentivo && <p className="mt-3 text-sm" style={{ color: T.texto2 }}>{dados.incentivo}</p>}

      {/* Três listas curtas, com rolagem interna (celular na rua) */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Lista titulo="Últimas vendas" vazio="Nenhuma venda faturada ainda.">
          {dados.ultimasVendas.map((v) => (
            <Linha key={v.id} href={`/clientes/${v.clienteId}`} titulo={v.cliente} sub={`${v.maquina} · ${fmtDiaBR(v.quando)}`} lado={v.valor > 0 ? formatCurrency(v.valor) : "—"} />
          ))}
        </Lista>
        <Lista titulo="Últimas prospecções" vazio="Nenhuma negociação aberta ainda.">
          {dados.ultimasProspeccoes.map((n) => (
            <Linha key={n.id} href={`/clientes/${n.clienteId}`} titulo={n.cliente} sub={`${n.maquina} · ${n.estagio}`} lado={fmtDiaBR(n.quando)} />
          ))}
        </Lista>
        <Lista titulo="Negócios abertos — próximo passo" vazio="Nenhum negócio aberto no funil.">
          {dados.abertos.map((n) => (
            <Linha
              key={n.id} href={`/clientes/${n.clienteId}`} titulo={n.cliente}
              sub={n.proximoPasso ?? "Sem próximo passo definido — abra o cliente e defina"}
              subCor={n.proximoPasso ? undefined : T.amarelo}
              lado={n.parado ? `${n.diasSemContato} d parado` : n.valor != null ? formatCurrency(n.valor) : ""}
              ladoCor={n.parado ? T.vermelho : undefined}
            />
          ))}
        </Lista>
      </div>
      {dados.totalParados > 0 && (
        <p className="mt-1 text-[11px]" style={{ color: T.mudo }}>
          Parado = {DIAS_PARADO} dias ou mais sem contato. {dados.totalParados} no funil; os mais antigos aparecem primeiro.
        </p>
      )}

      {/* Os alertas moram na Central; aqui só o atalho, sem duplicar */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs" style={{ borderColor: T.borda }}>
        {semContato30 > 0 && (
          <Link href="/alertas?grupo=semcontato" className="inline-flex items-center gap-1 font-bold" style={{ color: T.amarelo }}>
            <Snowflake size={13} /> {semContato30} cliente{semContato30 === 1 ? "" : "s"} há 30+ dias sem contato
          </Link>
        )}
        <Link href="/alertas" className="inline-flex items-center gap-1 font-bold" style={{ color: T.ciano }}>
          Central de alertas <ArrowRight size={13} />
        </Link>
      </div>
    </Painel>
  );
}

function Lista({ titulo, vazio, children }: { titulo: string; vazio: string; children: React.ReactNode[] }) {
  const T = temaDashAtual();
  return (
    <div className="min-w-0 rounded-xl p-3" style={{ background: T.sobre }}>
      <h3 className="mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: T.texto2 }}>{titulo}</h3>
      {children.length === 0 ? (
        <p className="text-xs" style={{ color: T.mudo }}>{vazio}</p>
      ) : (
        <ul className="max-h-60 space-y-1.5 overflow-y-auto pr-1">{children}</ul>
      )}
    </div>
  );
}

function Linha({ href, titulo, sub, lado, subCor, ladoCor }: { href: string; titulo: string; sub: string; lado: string; subCor?: string; ladoCor?: string }) {
  const T = temaDashAtual();
  return (
    <li>
      <Link href={href} className="flex items-start justify-between gap-2 rounded-lg px-2 py-1.5" style={{ background: T.sobre }}>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{titulo}</span>
          <span className="line-clamp-2 text-xs" style={{ color: subCor ?? T.mudo }}>{sub}</span>
        </span>
        {lado && <span className="shrink-0 text-xs font-bold" style={{ color: ladoCor ?? T.texto2 }}>{lado}</span>}
      </Link>
    </li>
  );
}
