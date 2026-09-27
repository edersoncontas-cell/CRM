import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { PilotoCategoriaBotao } from "@/components/PilotoCategoriaBotao";
import { calcularNumerosPiloto, type NumerosPiloto, type ItemConversa } from "@/lib/piloto";
import {
  DIAS_PILOTO, diasDoPiloto, duracaoCurta, porcento, criterioMotivos, criterioEsfriando, criterioConversas,
  HORARIO_COMERCIAL, DIAS_ESFRIANDO, type SituacaoCriterio, type GrupoEsperas,
} from "@/lib/piloto-regra";
import { limparErro } from "@/lib/erro-legivel";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  FlaskConical, Timer, Sparkles, MessagesSquare, CheckCircle2, XCircle, MinusCircle, AlertTriangle, ChevronRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

// NÚMEROS DO PILOTO — o que volta para a diretoria depois dos 60 dias.
//
// A proposta (docs/APRESENTACAO-DIRETORIA.md, 4.4) prometeu três números que
// o CRM não calculava: tempo até a primeira resposta, negociações abertas pela
// IA e conversas de venda que viraram negociação. Mais os critérios para
// seguir (seção 10), para a decisão sair de uma tela só.
//
// Cada número vem com a regra de como é contado, na tela. A diretoria vai
// perguntar "o que conta como resposta?" — e a resposta não pode depender de
// quem estiver na sala lembrar.
//
// Listas em quadro de altura travada: ele usa o CRM no celular.
const quadroRolagem = "max-h-64 overflow-y-auto rounded-lg border border-slate-100";

export default async function PilotoPage({ searchParams }: { searchParams: { dias?: string } }) {
  await garantirManutencaoSeNecessario();
  const dias = diasDoPiloto(searchParams.dias);

  let numeros: NumerosPiloto | null = null;
  let falha: string | null = null;
  try {
    numeros = await calcularNumerosPiloto(dias);
  } catch (e) {
    console.error("[piloto] cálculo falhou:", e);
    falha = limparErro(e);
  }

  return (
    <div>
      <PageHeader
        titulo="Números do piloto"
        subtitulo={`O que volta para a diretoria no fim do piloto, nos últimos ${dias} dias. Cada número diz, embaixo, como é contado.`}
        acao={<SeletorDias dias={dias} />}
      />

      {falha || !numeros ? (
        <Card>
          <div className="flex gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" />
            <div className="min-w-0 text-sm">
              <div className="font-semibold text-red-700">Não consegui calcular os números agora.</div>
              <p className="mt-1 break-words text-slate-600">Motivo: {(falha ?? "sem resposta do cálculo").replace(/\.+$/, "")}.</p>
              <p className="mt-1 text-slate-500">
                Nada foi alterado. Tente de novo em alguns minutos; se continuar, abra{" "}
                <a href="/api/diag" className="font-semibold text-brand-700 underline">/api/diag</a> para ver qual peça caiu.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Conteudo n={numeros} />
      )}
    </div>
  );
}

function SeletorDias({ dias }: { dias: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {DIAS_PILOTO.map((d) => (
        <Link key={d} href={`/piloto?dias=${d}`}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
            d === dias ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
          )}>
          {d} dias
        </Link>
      ))}
    </div>
  );
}

function Conteudo({ n }: { n: NumerosPiloto }) {
  const c = n.criterios;
  const pctConversas = porcento(n.conversas.comNegociacao, n.conversas.venda);
  const comMotivo = c.perdidas - c.perdidasSemMotivo;

  return (
    <div className="space-y-4">
      {/* ── A frase da reunião ── */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-xl bg-slate-900 p-2.5 text-agro-400"><FlaskConical size={20} /></div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">A frase da reunião</div>
            {n.ia.total > 0 ? (
              <p className="mt-1 text-base leading-snug text-slate-800 sm:text-lg">
                Nos últimos {n.dias} dias, o CRM abriu <b>{n.ia.total} negociaç{n.ia.total === 1 ? "ão" : "ões"} sozinho</b>, a partir
                da conversa{n.ia.somaValor > 0 ? <>, somando <b>{formatCurrency(n.ia.somaValor)}</b> no funil</> : null}.
                {n.ia.semValor > 0 && (
                  <span className="block text-xs text-slate-500">
                    {n.ia.semValor} delas ainda sem valor: a soma cresce quando o valor é preenchido.
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm leading-snug text-slate-600">
                Nos últimos {n.dias} dias, o CRM ainda não abriu negociação sozinho. Ele abre quando a conversa do WhatsApp já fala de
                máquina e de forma de pagamento ou de visita.
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">O custo mensal para completar a frase está na proposta (seção 5.2), não no CRM.</p>
          </div>
        </div>
      </Card>

      {/* ── Critérios para seguir ── */}
      <Card>
        <h2 className="text-sm font-bold text-slate-800">Critérios para seguir (seção 10 da proposta)</h2>
        <ul className="mt-2 divide-y divide-slate-100">
          <Criterio
            situacao={criterioMotivos(c.perdidas, c.perdidasSemMotivo)}
            titulo="1. Todas as vendas perdidas com motivo"
            detalhe={c.perdidas
              ? <>{comMotivo} de {c.perdidas} com motivo{c.perdidasSemMotivo > 0 && <> · <Link href="/vendas-perdidas" className="font-semibold text-brand-700 underline">{c.perdidasSemMotivo} sem motivo</Link></>}</>
              : "Nenhuma venda perdida no período."}
          />
          <Criterio
            situacao={criterioEsfriando(c.esfriandoInicio?.n ?? null, c.esfriandoHoje)}
            titulo={`2. Negociações esfriando (${DIAS_ESFRIANDO}+ dias sem contato) caindo pela metade`}
            detalhe={c.esfriandoInicio
              ? <>No começo ({formatDate(c.esfriandoInicio.dia + "T12:00:00-03:00")}): {c.esfriandoInicio.n} · hoje: {c.esfriandoHoje}</>
              : <>Hoje: {c.esfriandoHoje}. O CRM anota esse número uma vez por dia{c.anotadoDesde ? ` desde ${formatDate(c.anotadoDesde + "T12:00:00-03:00")}` : ""}; a comparação aparece quando houver anotação do começo do período.</>}
          />
          <Criterio
            situacao={criterioConversas(n.conversas.venda, n.conversas.comNegociacao)}
            titulo="3. A maioria das conversas de venda registrada como negociação"
            detalhe={n.conversas.venda
              ? <>{pctConversas}% ({n.conversas.comNegociacao} de {n.conversas.venda}) — precisa passar de 50%</>
              : "Nenhuma conversa de venda no período."}
          />
          <Criterio
            situacao="sem_dado"
            titulo="4. Os vendedores querendo continuar"
            detalhe="Não sai de número: é a conversa com eles no fim do piloto."
          />
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <CardRespostas n={n} />
        <CardIA n={n} />
      </div>
      <CardConversas n={n} />
    </div>
  );
}

function Criterio({ situacao, titulo, detalhe }: { situacao: SituacaoCriterio; titulo: string; detalhe: React.ReactNode }) {
  const icone = situacao === "ok"
    ? <CheckCircle2 size={18} className="text-emerald-600" />
    : situacao === "falta"
      ? <XCircle size={18} className="text-red-600" />
      : <MinusCircle size={18} className="text-slate-400" />;
  const rotulo = situacao === "ok" ? "cumprido" : situacao === "falta" ? "ainda não" : "sem medida";
  return (
    <li className="flex gap-2.5 py-2">
      <span className="mt-0.5 shrink-0" title={rotulo}>{icone}</span>
      <div className="min-w-0 text-sm">
        <div className="font-semibold text-slate-800">
          {titulo} <span className={cn("ml-1 whitespace-nowrap text-[11px] font-bold uppercase",
            situacao === "ok" ? "text-emerald-700" : situacao === "falta" ? "text-red-700" : "text-slate-400")}>{rotulo}</span>
        </div>
        <div className="text-xs text-slate-500">{detalhe}</div>
      </div>
    </li>
  );
}

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="text-lg font-bold leading-tight text-slate-900">{valor}</div>
      <div className="text-[11px] leading-tight text-slate-500">{rotulo}</div>
    </div>
  );
}

function Regra({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-3 text-xs text-slate-500">
      <summary className="cursor-pointer font-semibold text-slate-600">Como é contado</summary>
      <div className="mt-1 space-y-1 leading-snug">{children}</div>
    </details>
  );
}

function linhaUmaHora(g: GrupoEsperas): string {
  if (!g.baseUmaHora) return "sem resposta para medir ainda";
  return `${porcento(g.ateUmaHora, g.baseUmaHora)}% respondidas em até 1 hora (${g.ateUmaHora} de ${g.baseUmaHora})`;
}

function CardRespostas({ n }: { n: NumerosPiloto }) {
  const r = n.respostas;
  const total = r.noHorario.total + r.foraDoHorario.total;
  return (
    <Card>
      <div className="flex items-center gap-2 font-semibold text-slate-700">
        <Timer size={18} className="text-brand-600" /> Tempo até a primeira resposta
      </div>

      {total === 0 ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Nenhum cliente escreveu em conversa de venda nos últimos {n.dias} dias.
          {n.conversas.foraDaConta.total > 0 && (
            <span className="block text-xs text-slate-500">
              {n.conversas.foraDaConta.total} conversa(s) com mensagem no período não estão marcadas como venda — veja o quadro de conversas abaixo.
            </span>
          )}
        </p>
      ) : (
        <>
          <div className="mt-2">
            <div className="text-3xl font-bold leading-none text-slate-900">{duracaoCurta(r.noHorario.medianaMin)}</div>
            <div className="mt-1 text-xs text-slate-500">
              no horário comercial (mediana de {r.noHorario.respondidas} resposta{r.noHorario.respondidas === 1 ? "" : "s"}) · {linhaUmaHora(r.noHorario)}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Numero valor={duracaoCurta(r.foraDoHorario.medianaMin)} rotulo={`fora do horário (${r.foraDoHorario.respondidas})`} />
            <Numero valor={duracaoCurta(r.primeiroContato.medianaMin)} rotulo={`cliente que chamou pela 1ª vez (${r.primeiroContato.respondidas})`} />
            <Numero valor={String(r.semResposta)} rotulo="ainda sem resposta" />
          </div>

          {n.esperando.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold text-slate-600">Esperando resposta agora</div>
              <ul className={quadroRolagem}>
                {n.esperando.map((e) => (
                  <li key={e.conversaId} className="border-b border-slate-100 last:border-0">
                    <Link href={`/atendimento?conversa=${e.conversaId}`} className="flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-slate-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-slate-700">{e.nome}</span>
                        <span className="block truncate text-[11px] text-slate-500">
                          esperando há {duracaoCurta((new Date(n.fim).getTime() - new Date(e.desde).getTime()) / 60_000)} · desde {formatDateTime(e.desde)}
                        </span>
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-slate-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {n.mensagensTruncadas && (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Muitas mensagens no período: a conta leu as primeiras 60 mil. Escolha um período menor para o número exato.
        </p>
      )}
      {r.dispensadas > 0 && (
        <p className="mt-2 text-xs text-slate-500">{r.dispensadas} conversa(s) marcada(s) como respondida(s) sem mensagem ficaram fora da conta.</p>
      )}

      <Regra>
        <p>Conta cada vez que o cliente escreve numa conversa de venda e fica esperando: do primeiro recado até a primeira mensagem sua, pelo CRM ou pelo celular. Três recados seguidos são uma espera só.</p>
        <p>Não contam como resposta: envio em massa, parabéns automático e mensagem que falhou. Recado só de cortesia (“ok”, “obrigado”, figurinha) não abre espera.</p>
        <p>Horário comercial: segunda a sexta, das {HORARIO_COMERCIAL.inicio}h às {HORARIO_COMERCIAL.fim}h de Brasília. A mediana é o tempo do meio: metade das respostas saiu mais rápido que ele.</p>
        <p>Ligação não aparece aqui: se resolveu por telefone, marque a conversa como respondida no Atendimento e ela sai da conta.</p>
      </Regra>
    </Card>
  );
}

const ROTULO_STATUS: Record<string, { texto: string; cor: string }> = {
  aberta: { texto: "aberta", cor: "bg-brand-50 text-brand-700" },
  ganha: { texto: "ganha", cor: "bg-emerald-50 text-emerald-700" },
  perdida: { texto: "perdida", cor: "bg-red-50 text-red-700" },
};

function CardIA({ n }: { n: NumerosPiloto }) {
  const ia = n.ia;
  return (
    <Card>
      <div className="flex items-center gap-2 font-semibold text-slate-700">
        <Sparkles size={18} className="text-brand-600" /> Negociações abertas pela IA
      </div>

      {ia.total === 0 ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Nenhuma nos últimos {n.dias} dias. A IA abre sozinha quando a conversa já fala de máquina e de forma de pagamento ou de visita
          e o cliente ainda não tem negociação aberta.
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-3xl font-bold leading-none text-slate-900">{ia.total}</div>
            <div className="text-xs text-slate-500">{ia.somaValor > 0 ? <>somando <b className="text-slate-700">{formatCurrency(ia.somaValor)}</b></> : "sem valor preenchido ainda"}{ia.semValor > 0 && ia.somaValor > 0 ? ` · ${ia.semValor} sem valor` : ""}</div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <Numero valor={String(ia.abertas)} rotulo="abertas" />
            <Numero valor={String(ia.ganhas)} rotulo="viraram venda" />
            <Numero valor={String(ia.perdidas)} rotulo="perdidas" />
            <Numero valor={String(ia.apagadas)} rotulo="apagadas depois" />
          </div>
          <ul className={cn(quadroRolagem, "mt-3")}>
            {ia.lista.map((x) => (
              <li key={x.id} className="border-b border-slate-100 last:border-0">
                <Link href={`/clientes/${x.clienteId}`} className="flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-slate-700">{x.cliente}</span>
                    <span className="block truncate text-[11px] text-slate-500">{x.maquina ?? "máquina não informada"} · {formatDate(x.abertaEm)}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-700">{x.valor ? formatCurrency(x.valor) : "—"}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", ROTULO_STATUS[x.status]?.cor ?? "bg-slate-100 text-slate-600")}>
                    {ROTULO_STATUS[x.status]?.texto ?? x.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Regra>
        <p>Conta a negociação que o CRM abriu sozinho ao ler a conversa do WhatsApp, no período. A que você pediu ao Cérebro não entra: foi pedido seu.</p>
        <p>O valor é o de hoje: se você corrigiu depois, vale o corrigido. “Apagadas depois” são as que você excluiu do funil.</p>
      </Regra>
    </Card>
  );
}

function ListaConversas({ itens, paraVenda }: { itens: ItemConversa[]; paraVenda: boolean }) {
  return (
    <ul className={quadroRolagem}>
      {itens.map((c) => (
        <li key={c.id} className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-1.5 last:border-0">
          <Link href={`/atendimento?conversa=${c.id}`} className="min-w-0 flex-1 hover:underline">
            <span className="block truncate text-sm text-slate-700">{c.nome}</span>
            <span className="block truncate text-[11px] text-slate-500">
              {formatDateTime(c.ultimaDoCliente)}
              {!c.temCadastro && " · sem cadastro"}
              {!paraVenda && ` · ${c.category ?? "sem classificação"}`}
            </span>
          </Link>
          <PilotoCategoriaBotao conversaId={c.id} paraVenda={paraVenda} />
        </li>
      ))}
    </ul>
  );
}

function CardConversas({ n }: { n: NumerosPiloto }) {
  const cv = n.conversas;
  const pct = porcento(cv.comNegociacao, cv.venda);
  const faltam = cv.venda - cv.comNegociacao;
  return (
    <Card>
      <div className="flex items-center gap-2 font-semibold text-slate-700">
        <MessagesSquare size={18} className="text-brand-600" /> Conversas de venda que viraram negociação
      </div>

      {cv.venda === 0 ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Nenhuma conversa de venda com mensagem do cliente nos últimos {n.dias} dias.
          {cv.foraDaConta.total > 0 && ` ${cv.foraDaConta.total} conversa(s) ficaram de fora por não estarem marcadas como venda — confira abaixo.`}
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-3xl font-bold leading-none text-slate-900">{pct}%</div>
            <div className="text-xs text-slate-500">{cv.comNegociacao} de {cv.venda} conversas de venda têm negociação registrada</div>
          </div>
          {faltam > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold text-slate-600">
                Sem negociação ({faltam}){cv.semCadastro > 0 && <span className="font-normal text-slate-500"> · {cv.semCadastro} sem cadastro</span>}
                {faltam > cv.semNegociacao.length && <span className="font-normal text-slate-500"> · as {cv.semNegociacao.length} mais recentes</span>}
              </div>
              <ListaConversas itens={cv.semNegociacao} paraVenda={false} />
            </div>
          )}
        </>
      )}

      {cv.foraDaConta.total > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">
            {cv.foraDaConta.total} conversa(s) não entram na conta
            <span className="font-normal text-slate-500">
              {" "}({[cv.foraDaConta.outro && `${cv.foraDaConta.outro} marcadas como outro assunto`, cv.foraDaConta.semClassificacao && `${cv.foraDaConta.semClassificacao} sem classificação`].filter(Boolean).join(", ")})
            </span>
          </summary>
          <p className="mt-1 text-xs text-slate-500">
            Se alguma é de venda, toque em “É venda”: ela entra nesta conta e no tempo de resposta.
            {cv.foraDaConta.marcadasAMao > 0 && ` ${cv.foraDaConta.marcadasAMao} ${cv.foraDaConta.marcadasAMao === 1 ? "foi tirada" : "foram tiradas"} à mão (“Não é venda”) — tirar conversa da conta sobe a porcentagem, por isso o número fica à vista.`}
          </p>
          <div className="mt-1"><ListaConversas itens={cv.foraDaConta.lista} paraVenda /></div>
        </details>
      )}

      <Regra>
        <p>Conversa de venda: conversa individual (grupo não entra) que a IA classificou como cliente ou lead, ou que você marcou como venda, com mensagem do cliente no período. Conversa que você apagou não volta para a conta.</p>
        <p>Tem negociação quando o cadastro ligado à conversa tem negociação aberta no período, ou encerrada (ganha ou perdida) dentro dele. Venda antiga lançada só para histórico não conta.</p>
        <p>A classificação é o palpite da IA na primeira mensagem. “Não é venda” e “É venda” corrigem o palpite, e a IA não troca mais.</p>
      </Regra>
    </Card>
  );
}
