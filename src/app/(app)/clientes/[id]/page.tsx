import { db } from "@/lib/db";
import { papelDaColuna } from "@/lib/pipeline";
import { Card, Badge } from "@/components/ui";
import { formatCurrency, formatDate, iniciais, diasDesde } from "@/lib/utils";
import { EditarClienteForm } from "@/components/EditarClienteForm";
import { VisitasCliente } from "@/components/VisitasCliente";
import { HistoricoVisitasCliente } from "@/components/HistoricoVisitasCliente";
import { BotaoNovaNegociacao } from "@/components/BotaoNovaNegociacao";
import { AgendarVisitaDialog } from "@/components/AgendarVisitaDialog";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { linhaDoTempoCliente } from "@/lib/linha-tempo";
import { LinhaTempoCliente } from "@/components/LinhaTempoCliente";
import { notFound, redirect } from "next/navigation";
import { clienteRedirecionado } from "@/lib/clientes-duplicados";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Bot, Clock, MessageCircle, Truck, Compass, Target, HeartHandshake, Cake, Handshake } from "lucide-react";
import { diaMes, idadeEm, diasAteAniversario, descreverOrigem } from "@/lib/aniversario-regra";
import { ehTelefoneReal } from "@/lib/telefone-valido";
import { maquinaDaNegociacao, pagamentoDaNegociacao, entradaDaNegociacao } from "@/lib/negociacao-verificada";

export const dynamic = "force-dynamic";

export default async function ClienteDetalhe({ params }: { params: { id: string } }) {
  await garantirManutencaoSeNecessario();

  const [cliente, municipios, maquinas, colunasFunil] = await Promise.all([
    db.cliente.findUnique({
      where: { id: params.id },
      include: {
        municipio: true,
        indicadoPor: true,
        indicados: true,
        visitas: { orderBy: { data: "desc" } },
        negociacoes: { orderBy: { criadoEm: "desc" } },
      },
    }),
    db.municipio.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, foraDeArea: true } }),
    db.maquina.findMany({ select: { id: true, marca: true, modelo: true, categoria: true, proprio: true }, orderBy: [{ marca: "asc" }, { modelo: "asc" }] }),
    db.colunaFunil.findMany({ orderBy: { ordem: "asc" }, select: { id: true, titulo: true, papel: true } }).then((cs) => cs.filter((c) => papelDaColuna(c) !== "perdida")),
  ]);
  if (!cliente) {
    // Cadastro que sumiu numa unificação de duplicados: o link antigo abre
    // o cadastro que ficou.
    const destino = await clienteRedirecionado(params.id);
    if (destino) redirect(`/clientes/${destino}`);
    notFound();
  }

  // Busca frota e conversa WA via raw query (tabelas novas)
  type FrotaRow = { id: string; marca: string; modelo: string };
  type ConvRow = { id: string };
  const [frotaRows, waConv, orientador, ultimoContatoPosVenda, linhaTempo] = await Promise.all([
    db.$queryRawUnsafe<FrotaRow[]>(`SELECT id, marca, modelo FROM "ClienteMaquina" WHERE "clienteId" = $1 ORDER BY "criadoEm" ASC`, cliente.id).catch(() => [] as FrotaRow[]),
    db.whatsAppConversation.findFirst({ where: { clienteId: cliente.id }, select: { id: true } }).catch(() => null as ConvRow | null),
    db.orientadorAnalise.findUnique({ where: { clienteId: cliente.id } }),
    cliente.jaComprou
      ? db.posVendaContato.findFirst({ where: { clienteId: cliente.id }, orderBy: { data: "desc" } })
      : Promise.resolve(null),
    linhaDoTempoCliente(cliente.id).catch(() => []),
  ]);

  const status = (cliente as { status?: string }).status ?? (cliente.jaComprou ? "cliente" : "potencial");
  const diasSemContato = cliente.ultimoContato ? diasDesde(cliente.ultimoContato) : null;

  const statusBadge =
    status === "cliente" ? { label: "✓ Cliente", tom: "green" as const } :
    status === "nao_cliente" ? { label: "Não é cliente", tom: "red" as const } :
    { label: "Potencial", tom: "yellow" as const };

  // Dados do resumo (campos novos podem ser undefined)
  const resumo = {
    maquinas: (cliente as { resumoMaquinas?: string }).resumoMaquinas ?? null,
    valor: (cliente as { resumoValor?: number }).resumoValor ?? null,
    entrada: (cliente as { resumoEntrada?: number }).resumoEntrada ?? null,
    condicao: (cliente as { resumoCondicao?: string }).resumoCondicao ?? null,
    texto: (cliente as { resumoTexto?: string }).resumoTexto ?? null,
    proximaVisita: (cliente as { proximaVisita?: Date }).proximaVisita ?? null,
    proximaVisitaNota: (cliente as { proximaVisitaNota?: string }).proximaVisitaNota ?? null,
  };
  const perfilDISC = cliente.perfilDISC ?? null;
  const abordagemIA = cliente.abordagemIA ?? null;

  // O botão WhatsApp da ficha.
  //
  //   "ao clicar em whatsapp quando o cliente não tiver uma conversa aberta,
  //    abrir uma nova já na janela para enviar uma mensagem para ele"
  //
  // Sem conversa, ele largava o vendedor em /atendimento — a lista inteira,
  // sem dizer o que fazer. E é justamente o cliente NOVO, sem conversa, que
  // mais precisa da primeira mensagem.
  //
  // O caminho ?cliente= já existe e faz tudo: procura a conversa do cliente,
  // CRIA uma se não houver e leva direto para ela, com a caixa de escrever
  // aberta (ver conversaDoCliente em atendimento/page.tsx). Havendo conversa,
  // vai direto pelo id — é um redirecionamento a menos.
  //
  // Sem telefone de verdade não há conversa possível: aí o botão diz isso, em
  // vez de fingir que leva a algum lugar.
  // A negociação aberta mais recente — é sobre ela que o Orientador fala.
  const negociacaoAberta = cliente.negociacoes.find((n) => n.status === "aberta") ?? null;

  const podeAbrirWhatsApp = ehTelefoneReal(cliente.telefone);
  const waHref = waConv ? `/atendimento?conversa=${waConv.id}` : `/atendimento?cliente=${cliente.id}`;

  return (
    <div>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
        <ArrowLeft size={16} /> Voltar
      </Link>

      {/* Header do cliente */}
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
          {iniciais(cliente.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{cliente.nome}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {cliente.telefone && (
              <span className="flex items-center gap-1"><Phone size={14} /> {cliente.telefone}</span>
            )}
            {cliente.email && (
              <span className="flex items-center gap-1"><Mail size={14} /> {cliente.email}</span>
            )}
            {cliente.municipio && (
              <span className="flex items-center gap-1"><MapPin size={14} /> {cliente.municipio.nome}</span>
            )}
            {cliente.dataNascimento && (
              <span className="flex items-center gap-1" title={descreverOrigem(cliente.dataNascimentoOrigem) ?? undefined}>
                <Cake size={14} /> {diaMes(cliente.dataNascimento)} · {idadeEm(cliente.dataNascimento, new Date())} anos
                {diasAteAniversario(cliente.dataNascimento, new Date()) <= 7 && <Badge tom="yellow">🎂 aniversário {diasAteAniversario(cliente.dataNascimento, new Date()) === 0 ? "hoje" : `em ${diasAteAniversario(cliente.dataNascimento, new Date())} dia(s)`}</Badge>}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tom={statusBadge.tom}>{statusBadge.label}</Badge>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={12} />
              {cliente.ultimoContato ? `último contato há ${diasSemContato}d` : "sem contato registrado"}
            </span>
            {cliente.aguardandoResposta ? <Badge tom="red">aguardando seu retorno</Badge> : <Badge tom="green">sem pendências</Badge>}
            {cliente.interesseFuturo && (
              <Badge tom="yellow">
                ⏳ interesse futuro{cliente.interesseFuturoNota ? ` — ${cliente.interesseFuturoNota}` : ""}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
          <AgendarVisitaDialog
            clienteId={cliente.id}
            clienteNome={cliente.nome}
            clienteTelefone={cliente.telefone}
          />
          {podeAbrirWhatsApp ? (
            <Link
              href={waHref}
              title={waConv ? "Abrir a conversa deste cliente" : "Abrir uma conversa nova com este cliente"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-sm font-semibold text-agro-400 hover:bg-brand-800"
            >
              <MessageCircle size={14} /> WhatsApp
            </Link>
          ) : (
            <span
              title="Este cadastro não tem telefone válido. Preencha em “Editar dados” para abrir a conversa."
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-400"
            >
              <MessageCircle size={14} /> WhatsApp
            </span>
          )}
          <EditarClienteForm
            cliente={{
              id: cliente.id,
              nome: cliente.nome,
              telefone: cliente.telefone,
              email: cliente.email,
              municipioId: cliente.municipioId,
              status,
              interesseFuturo: cliente.interesseFuturo,
              interesseFuturoData: cliente.interesseFuturoData
                ? cliente.interesseFuturoData.toISOString().slice(0, 10)
                : null,
              interesseFuturoNota: cliente.interesseFuturoNota,
              dataNascimento: cliente.dataNascimento ? cliente.dataNascimento.toISOString().slice(0, 10) : null,
              dataNascimentoOrigem: cliente.dataNascimentoOrigem,
            }}
            municipios={municipios}
            maquinas={maquinas}
            frotaAtual={frotaRows}
          />
        </div>
      </div>

      {/* Card indicações */}
      {(cliente.indicadoPor || cliente.indicados.length > 0) && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {cliente.indicadoPor && (
              <span className="text-slate-700">🤝 Indicado por <b>{cliente.indicadoPor.nome}</b></span>
            )}
            {cliente.indicados.length > 0 && (
              <span className="text-slate-700">⭐ Já indicou <b>{cliente.indicados.length}</b> cliente(s)</span>
            )}
          </div>
        </Card>
      )}

      {/* O QUE O ORIENTADOR APUROU sobre este cliente.
          
          "no cadastro precisa estar atualizado o que o orientador de vendas
           recolheu de informações."

          O que ele apurou, e não a análise inteira: a leitura completa fica no
          Atendimento, ao lado da conversa, que é onde ela funciona. Aqui vale
          o que se consulta de cabeça fria — em que pé está, o que já está
          confirmado da negociação, o que o cliente objetou, o que ficou
          combinado e o que falta. Com o link para a conversa, para ler o resto
          onde ele tem sentido. */}
      {orientador && (
        <Card className="mb-6 border-slate-200">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Compass size={17} className="text-brand-600" />
            <span className="font-semibold text-slate-700">O que o Orientador apurou</span>
            <Badge tom="slate">{orientador.estagioVenda}</Badge>
            {orientador.temperatura && <Badge tom={orientador.temperatura.includes("quente") ? "red" : orientador.temperatura === "fria" ? "slate" : "yellow"}>{orientador.temperatura.replace("_", " ")}</Badge>}
            {orientador.probabilidadeFechamento != null && (
              <Badge tom="green">{orientador.probabilidadeFechamento}% de chance de fechar</Badge>
            )}
            {podeAbrirWhatsApp && (
              <Link href={waHref} className="ml-auto text-xs font-semibold text-brand-600 hover:underline">abrir a conversa</Link>
            )}
          </div>
          {orientador.resumoNegociacao && <p className="mb-2 text-sm text-slate-600">{orientador.resumoNegociacao}</p>}

          {/* Os fatos confirmados da negociação aberta — a mesma régua do
              painel do Atendimento (lib/negociacao-verificada.ts): ✓ é o que o
              cliente disse, ○ é o que ainda falta perguntar. */}
          {negociacaoAberta && (
            <div className="mb-2 grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg bg-slate-50 p-2.5 text-sm sm:grid-cols-2">
              {([
                ["Máquina", maquinaDaNegociacao(negociacaoAberta.marca, negociacaoAberta.maquinaModelo), "modelo ainda não definido"],
                ["Valor", negociacaoAberta.valor ? formatCurrency(negociacaoAberta.valor) : null, "ainda não negociado"],
                ["Entrada", entradaDaNegociacao(negociacaoAberta.entradaValor, negociacaoAberta.entradaPercentual), "ainda não definida"],
                ["Pagamento", pagamentoDaNegociacao(negociacaoAberta.tipoPagamento, negociacaoAberta.condicaoPagamento), "ainda não definido"],
              ] as const).map(([rotulo, valor, falta]) => (
                <div key={rotulo} className={`flex gap-1.5 ${valor ? "text-slate-700" : "text-slate-400"}`}>
                  <span className="w-3 shrink-0 text-center font-bold">{valor ? "✓" : "○"}</span>
                  <span>{rotulo}: {valor ? <b className="text-slate-900">{valor}</b> : falta}</span>
                </div>
              ))}
            </div>
          )}

          {([
            ["Objeções", orientador.objecoes],
            ["Já combinado", orientador.combinados],
            ["Ainda pendente", orientador.pendencias],
          ] as const).filter(([, lista]) => lista?.length).map(([titulo, lista]) => (
            <div key={titulo} className="mb-1.5 text-sm">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{titulo}</span>
              <ul className="mt-0.5 list-disc pl-5 text-slate-600">
                {lista.slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </div>
          ))}

          {orientador.proximaAcao && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-brand-50 p-2 text-sm text-brand-800">
              <Target size={14} className="mt-0.5 shrink-0" />
              <span>{orientador.proximaAcao}</span>
            </div>
          )}

          {orientador.notaVendedor && (
            <p className="mt-2 rounded-lg bg-violet-50 p-2 text-xs text-violet-900">
              <b>Você ensinou:</b> {orientador.notaVendedor}
            </p>
          )}

          <p className="mt-2 text-[11px] text-slate-400">
            Leitura de {formatDate(orientador.atualizadoEm)}.
          </p>
        </Card>
      )}

      {/* Pós-venda */}
      {cliente.jaComprou && (
        <Card className="mb-6 border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <HeartHandshake size={17} className="text-brand-600" />
            <span className="font-semibold text-slate-700">Pós-venda</span>
            <Badge tom={ultimoContatoPosVenda ? "slate" : "yellow"}>
              {ultimoContatoPosVenda ? `Último contato ${formatDate(ultimoContatoPosVenda.data)}` : "Sem contato pós-venda registrado"}
            </Badge>
            <Link href="/pos-venda" className="ml-auto text-xs font-semibold text-brand-600 hover:underline">ver setor de pós-venda</Link>
          </div>
        </Card>
      )}

      {/* Perfil IA */}
      {cliente.perfilIA && (
        <Card className="mb-6 border-brand-200 bg-brand-50">
          <div className="flex items-start gap-2">
            <Bot size={18} className="mt-0.5 text-brand-600" />
            <div>
              <div className="text-sm font-semibold text-brand-800">Perfil pela IA</div>
              <p className="text-sm text-slate-600">{cliente.perfilIA}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Próxima visita */}
      {resumo.proximaVisita && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            📅 Próxima visita: <span className="font-normal">{formatDate(resumo.proximaVisita)}</span>
            {resumo.proximaVisitaNota && <span className="font-normal text-amber-700">— {resumo.proximaVisitaNota}</span>}
          </div>
        </Card>
      )}

      {/* Frota */}
      {frotaRows.length > 0 && (
        <Card className="mb-6">
          <div className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
            <Truck size={17} className="text-brand-600" /> Frota do cliente
          </div>
          <div className="flex flex-wrap gap-2">
            {frotaRows.map((f) => (
              <span key={f.id} className="rounded-lg bg-brand-50 border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700">
                {f.marca} — {f.modelo}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Visitas: agendar (em cima) e o histórico completo (embaixo).
          
          O "Modo Campo — Registrar visita por voz" e o "Next Best Action" saíram
          daqui a pedido. O Modo Campo não foi jogado fora: o motor dele agora
          roda no lembrete das visitas do dia, que é onde a visita de fato
          termina — dentro da ficha ele estava num lugar onde o vendedor não
          passa quando está na rua. */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VisitasCliente
          clienteId={cliente.id}
          visitas={cliente.visitas.map((v) => ({
            id: v.id,
            data: v.data.toISOString(),
            observacao: v.observacao,
          }))}
        />
        <HistoricoVisitasCliente
          visitas={cliente.visitas.map((v) => ({
            id: v.id, data: v.data, status: v.status, observacao: v.observacao,
          }))}
        />
      </div>

      {/* Negociações deste cliente.
          
          Estavam escondidas lá no fim do card "Resumo do Cliente" que saiu.
          Não foram elas que incomodaram — o que incomodou era o log de
          "Conversa registrada (sem dados estruturados detectados)" repetido
          doze vezes. Então voltam por si, num card que diz o que é. */}
      <Card className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <Handshake size={17} className="text-brand-600" /> Negociações
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{cliente.negociacoes.length}</span>
          </div>
          <BotaoNovaNegociacao
            clienteId={cliente.id}
            colunas={colunasFunil}
            maquinasProprias={maquinas.filter((m) => m.proprio).map((m) => ({ marca: m.marca, modelo: m.modelo }))}
          />
        </div>
        {cliente.negociacoes.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma negociação ainda.</p>
        ) : (
          <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {cliente.negociacoes.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <Link href={`/negociacoes`} className="font-semibold text-slate-800 hover:underline">
                  {n.maquinaModelo ?? "máquina a definir"}
                </Link>
                {n.valor != null && <span className="text-slate-600">{formatCurrency(n.valor)}</span>}
                <Badge tom={n.status === "aberta" ? "yellow" : n.status === "ganha" ? "green" : "slate"}>{n.status}</Badge>
                <span className="text-xs text-slate-400">{n.estagio}</span>
                {n.motivoPerda && <span className="text-xs text-red-500">{n.motivoPerda}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Linha do tempo: tudo o que aconteceu com este cliente, em ordem */}
      <div className="mb-6">
        <LinhaTempoCliente eventos={linhaTempo} />
      </div>

    </div>
  );
}
