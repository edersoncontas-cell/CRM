"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Sparkles, Send, X, Undo2, Loader2, CheckCircle2, AlertTriangle, Phone, Paperclip, Wand2, Cake, Megaphone, CalendarHeart, MapPin, Trash2, FileText, Film, CalendarClock,
} from "lucide-react";
import { WheelDatePicker, WheelTimePicker } from "@/components/WheelDatePicker";
import {
  programarEnvioAction, listarEnviosProgramadosAction, cancelarEnvioProgramadoAction,
  type EnvioProgramadoLista,
} from "@/lib/envio-programado-actions";
import { checarAgendamento, quandoPorExtenso, hojeEmBrasilia, MAX_CLIENTES_POR_ENVIO, cabemPorRodada, ondasEstimadas } from "@/lib/envio-programado";
import {
  listarPublicoAction, gerarTextoMensagemAction, enviarMensagemClientesAction, lerAutomaticoAniversarioAction, definirAutomaticoAniversarioAction,
  type ClienteAlvo,
} from "@/lib/mensagem-clientes-actions";
import type { ConfigAniversario } from "@/lib/aniversario-automatico";
import { personalizarTexto, dividirEmLotes } from "@/lib/abordagem-cidade-regra";
import {
  TIPOS_MENSAGEM, datasPorProximidade, rotuloDataComemorativa, publicosDoTipo, publicoPadrao, validarAnexo, BASES_ARTE, LIMITE_ANEXO_BYTES, JANELAS_ANIVERSARIO,
  type TipoMensagem, type Publico, type BaseArte, type TipoMidia,
} from "@/lib/mensagem-clientes-regra";
import { cn } from "@/lib/utils";

// Mensagem para clientes: escolhe o TIPO (visita, promoção, data
// comemorativa, aniversário) → o PÚBLICO (todos, uma cidade ou os
// aniversariantes) → tira da relação quem não quer → texto (digitado ou pela
// IA) e, se quiser, um anexo (arquivo do celular ou arte criada pelo Gemini)
// → manda para todos de uma vez, cada um com o próprio nome.

type Anexo = { id: string; tipo: TipoMidia; nome: string; preview: string | null; origem: "upload" | "gemini" };

const campo = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400";
const rotulo = "mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500";
const ICONE = { visita: MapPin, promocao: Megaphone, comemorativa: CalendarHeart, aniversario: Cake } as const;

// Foto do celular vem com 3–8 MB; para o WhatsApp 1600px em JPEG basta e
// passa folgado no limite da Vercel.
async function comprimirImagem(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const MAX = 1600;
    const escala = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    if (escala === 1 && file.size <= 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

function Chip({ ativo, onClick, children, disabled }: { ativo: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50",
        ativo ? "bg-slate-900 text-agro-400" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
    >
      {children}
    </button>
  );
}

export function MensagemClientes({ cidades }: { cidades: { id: string; nome: string; total: number }[] }) {
  const [tipo, setTipo] = useState<TipoMensagem>("visita");
  const [publico, setPublico] = useState<Publico>(publicoPadrao("visita"));
  const [titulo, setTitulo] = useState("");
  const [clientes, setClientes] = useState<ClienteAlvo[]>([]);
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [carregando, iniciarCarga] = useTransition();
  const datas = datasPorProximidade();
  const [dataId, setDataId] = useState(datas[0].id);
  const [promocao, setPromocao] = useState("");
  const [texto, setTexto] = useState("");
  const [origemTexto, setOrigemTexto] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [anexo, setAnexo] = useState<Anexo | null>(null);
  const [subindo, setSubindo] = useState(false);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);
  const [arteAberta, setArteAberta] = useState(false);
  const [instrucoesArte, setInstrucoesArte] = useState("");
  const [baseArte, setBaseArte] = useState<BaseArte>("escavadeira");
  const [gerandoArte, setGerandoArte] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Programar o envio. O padrão é "agora": agendar é a exceção.
  const [quando, setQuando] = useState<"agora" | "depois">("agora");
  const [diaEnvio, setDiaEnvio] = useState(hojeEmBrasilia());
  const [horaEnvio, setHoraEnvio] = useState("09:00");
  const [pickerEnvio, setPickerEnvio] = useState<"data" | "hora" | null>(null);
  const [erroAgenda, setErroAgenda] = useState<string | null>(null);
  const [agendado, setAgendado] = useState<string | null>(null);
  const [programados, setProgramados] = useState<EnvioProgramadoLista[]>([]);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ enviados: number; falhas: { nome: string; erro: string }[] } | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  // Parabéns automático (todo dia às 8h): ligado/desligado + texto modelo.
  const [automatico, setAutomatico] = useState<ConfigAniversario | null>(null);
  const [salvandoAuto, setSalvandoAuto] = useState(false);
  const [avisoAuto, setAvisoAuto] = useState<string | null>(null);
  // A lista de programados é carregada ao abrir: ele precisa VER o que já
  // marcou antes de marcar mais um.
  useEffect(() => {
    let vivo = true;
    listarEnviosProgramadosAction()
      .then((r) => { if (vivo) setProgramados(r); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (tipo !== "aniversario" || automatico) return;
    lerAutomaticoAniversarioAction().then(setAutomatico).catch(() => null);
  }, [tipo, automatico]);

  async function salvarAutomatico(ativo: boolean) {
    if (!automatico) return;
    setSalvandoAuto(true); setAvisoAuto(null);
    // O texto que está na caixa vira o modelo do automático (se tiver algo).
    const r: { ok: boolean; erro?: string; config?: ConfigAniversario } = await definirAutomaticoAniversarioAction({ ativo, texto: texto.trim() || automatico.texto })
      .catch(() => ({ ok: false, erro: "Não consegui salvar agora." }));
    setSalvandoAuto(false);
    if (!r.ok || !r.config) { setAvisoAuto(r.erro ?? "Não consegui salvar agora."); return; }
    setAutomatico(r.config);
    setAvisoAuto(ativo ? "Ligado: todo dia às 8h os aniversariantes recebem este texto, cada um com o próprio primeiro nome." : "Desligado.");
  }

  const dataSel = datas.find((d) => d.id === dataId) ?? datas[0];
  const cidadeNome = publico.modo === "cidade" ? (cidades.find((c) => c.id === publico.municipioId)?.nome ?? "") : "";
  const modos = publicosDoTipo(tipo);
  const aceitaAnexo = tipo !== "visita";

  function carregar(p: Publico) {
    setRemovidos(new Set()); // trocar o público devolve quem tinha saído
    setResultado(null);
    setClientes([]);
    setTitulo("");
    if (p.modo === "cidade" && !p.municipioId) return;
    iniciarCarga(async () => {
      const r = await listarPublicoAction(p);
      setTitulo(r.titulo);
      setClientes(r.clientes);
    });
  }
  function escolherTipo(t: TipoMensagem) {
    setTipo(t);
    setTexto(""); setOrigemTexto(null); setAnexo(null); setErroAnexo(null); setArteAberta(false);
    const p = publicoPadrao(t);
    setPublico(p);
    carregar(p);
  }
  function escolherPublico(p: Publico) { setPublico(p); carregar(p); }
  function tirar(id: string) { setRemovidos((s) => new Set(s).add(id)); }
  function devolver(id: string) { setRemovidos((s) => { const n = new Set(s); n.delete(id); return n; }); }

  async function gerar() {
    setGerando(true);
    const r = await gerarTextoMensagemAction({ tipo, cidade: cidadeNome || undefined, dataId, promocao }).catch(() => null);
    setGerando(false);
    if (!r) { setOrigemTexto("Não consegui gerar agora — escreva o texto."); return; }
    setTexto(r.texto);
    setOrigemTexto(r.geradoPorIA ? "Texto gerado pela IA — revise e ajuste como quiser." : "IA indisponível: usei o modelo padrão — ajuste como quiser.");
  }

  async function escolherArquivo(file: File | null) {
    if (!file) return;
    setErroAnexo(null);
    const blob = await comprimirImagem(file);
    const mime = blob.type || file.type;
    const problema = validarAnexo(mime, blob.size);
    if (problema) { setErroAnexo(problema); return; }
    setSubindo(true);
    const fd = new FormData();
    fd.set("arquivo", new File([blob], file.name, { type: mime }));
    const r = await fetch("/api/midia/upload", { method: "POST", body: fd }).then((res) => res.json()).catch(() => null);
    setSubindo(false);
    if (!r?.ok) { setErroAnexo(r?.erro ?? "Não consegui subir o arquivo."); return; }
    setAnexo({ id: r.id, tipo: r.tipo, nome: r.nome, preview: r.preview, origem: "upload" });
    setArteAberta(false);
  }

  async function criarArte() {
    setGerandoArte(true);
    setErroAnexo(null);
    const r = await fetch("/api/midia/gerar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, instrucoes: instrucoesArte, dataId, promocao, base: baseArte }),
    }).then((res) => res.json()).catch(() => null);
    setGerandoArte(false);
    if (!r?.ok) { setErroAnexo(r?.erro ?? "A IA não conseguiu criar a arte agora."); return; }
    setAnexo({ id: r.id, tipo: "image", nome: r.nome, preview: r.preview, origem: "gemini" });
  }

  const naLista = clientes.filter((c) => !removidos.has(c.id));
  const foraDaLista = clientes.filter((c) => removidos.has(c.id));
  const comTelefone = naLista.filter((c) => c.telefone);
  const semTelefone = naLista.filter((c) => !c.telefone);
  const exemplo = comTelefone[0] ?? naLista[0];
  const podeEnviar = !enviando && !subindo && comTelefone.length > 0 && (texto.trim() !== "" || !!anexo);

  // "deixa a opção de programar a postagem, com a data e a hora padrão horário
  // de brasilia." Os seletores já são os do CRM (roda de dia/hora), e a regra
  // do fuso mora em lib/envio-programado.ts.
  async function programar() {
    if (!podeEnviar) return;
    const check = checarAgendamento(diaEnvio, horaEnvio);
    if (!check.ok) { setErroAgenda(check.erro); return; }
    const ok = confirm(`Programar para ${quandoPorExtenso(check.quando)} (horário de Brasília), para ${comTelefone.length} cliente(s)?`);
    if (!ok) return;
    setErroAgenda(null);
    setEnviando(true);
    const r = await programarEnvioAction(comTelefone.map((c) => c.id), texto, anexo?.id ?? null, diaEnvio, horaEnvio)
      .catch(() => ({ ok: false, erro: "Falha ao programar." }));
    setEnviando(false);
    if (!r.ok) { setErroAgenda(r.erro ?? "Não deu para programar."); return; }
    setAgendado(("quandoTexto" in r && r.quandoTexto) || quandoPorExtenso(check.quando));
    setProgramados(await listarEnviosProgramadosAction().catch(() => []));
  }

  async function cancelarProgramado(id: string) {
    if (!confirm("Cancelar este envio programado?")) return;
    await cancelarEnvioProgramadoAction(id).catch(() => null);
    setProgramados(await listarEnviosProgramadosAction().catch(() => []));
  }

  async function enviar() {
    if (!podeEnviar) return;
    const previa = texto.trim() ? personalizarTexto(texto, exemplo?.nome ?? "") : "(só o anexo)";
    const ok = confirm(`Mandar pelo WhatsApp para ${comTelefone.length} cliente(s) (${titulo})?${anexo ? `\n\nCom anexo: ${anexo.nome}` : ""}\n\n${previa}`);
    if (!ok) return;
    setEnviando(true);
    setResultado(null);
    const total = { enviados: 0, falhas: [] as { nome: string; erro: string }[] };
    let feitos = 0;
    for (const lote of dividirEmLotes(comTelefone.map((c) => c.id), 3)) {
      setProgresso(`Enviando… ${feitos}/${comTelefone.length}`);
      const r = await enviarMensagemClientesAction(lote, texto, anexo?.id ?? null).catch((e) => ({
        enviados: [] as string[],
        falhas: lote.map((id) => ({ id, nome: comTelefone.find((c) => c.id === id)?.nome ?? id, erro: e instanceof Error ? e.message : "falha" })),
      }));
      total.enviados += r.enviados.length;
      total.falhas.push(...r.falhas.map((f) => ({ nome: f.nome, erro: f.erro })));
      feitos += lote.length;
    }
    setProgresso(null);
    setEnviando(false);
    setResultado(total);
  }

  const placeholder =
    tipo === "visita" && !cidadeNome ? "Escolha a cidade primeiro." :
    `Escreva a mensagem (use {nome} onde entra o primeiro nome) ou clique em "Gerar texto com IA".`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {/* Tipo */}
      <div className="mb-4">
        <div className={rotulo}>O que você vai mandar</div>
        <div className="flex flex-wrap gap-2">
          {TIPOS_MENSAGEM.map((t) => {
            const Icone = ICONE[t.id];
            return (
              <Chip key={t.id} ativo={tipo === t.id} onClick={() => escolherTipo(t.id)} disabled={enviando}>
                <Icone size={13} /> {t.nome}
              </Chip>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-slate-400">{TIPOS_MENSAGEM.find((t) => t.id === tipo)?.descricao}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* Coluna 1: público + relação */}
        <div>
          <div className={rotulo}>Para quem</div>
          {modos.length > 1 && (
            <div className="mb-2 flex flex-wrap gap-2">
              <Chip ativo={publico.modo === "todos"} onClick={() => escolherPublico({ modo: "todos" })} disabled={enviando}>Todos os clientes</Chip>
              <Chip ativo={publico.modo === "cidade"} onClick={() => escolherPublico({ modo: "cidade", municipioId: "" })} disabled={enviando}>Por cidade</Chip>
            </div>
          )}
          {publico.modo === "cidade" && (
            <select value={publico.municipioId} onChange={(e) => escolherPublico({ modo: "cidade", municipioId: e.target.value })} disabled={enviando} className={campo}>
              <option value="">— Escolher a cidade —</option>
              {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.total}</option>)}
            </select>
          )}
          {publico.modo === "aniversariantes" && (
            <div className="flex flex-wrap gap-2">
              {JANELAS_ANIVERSARIO.map((d) => (
                <Chip key={d} ativo={publico.dias === d} onClick={() => escolherPublico({ modo: "aniversariantes", dias: d })} disabled={enviando}>
                  {d === 0 ? "Hoje" : `Próximos ${d} dias`}
                </Chip>
              ))}
            </div>
          )}

          {carregando && <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Loader2 size={12} className="animate-spin" /> Buscando clientes…</p>}

          {!carregando && (publico.modo !== "cidade" || publico.municipioId) && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
                <span>Na relação · {naLista.length}</span>
                {semTelefone.length > 0 && <span className="normal-case font-semibold text-amber-600">{semTelefone.length} sem telefone</span>}
              </div>
              {naLista.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-400">
                  {clientes.length > 0 ? "Você tirou todo mundo da relação." :
                    publico.modo === "aniversariantes" ? "Nenhum aniversariante nesse período. A data de nascimento entra no cadastro do cliente — ou a IA registra sozinha quando o cliente manda CNH/contrato no WhatsApp." :
                    "Nenhum cliente aqui."}
                </p>
              ) : (
                <ul className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
                  {naLista.map((c) => (
                    <li key={c.id} className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${c.telefone ? "border-slate-100 bg-white" : "border-amber-100 bg-amber-50/60"}`}>
                      <div className="min-w-0 flex-1">
                        <Link href={`/clientes/${c.id}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-600">{c.nome}</Link>
                        <p className="truncate text-[11px] text-slate-400">
                          {c.telefone ? <><Phone size={9} className="inline" /> {c.telefone}</> : "sem telefone"}
                          {publico.modo === "todos" && c.cidade ? ` · ${c.cidade}` : ""}
                          {c.aniversario && (publico.modo === "aniversariantes" || c.aniversario.diasAte <= 7)
                            ? ` · 🎂 ${c.aniversario.diaMes}${c.aniversario.diasAte === 0 ? " (hoje)" : c.aniversario.diasAte === 1 ? " (amanhã)" : ` (em ${c.aniversario.diasAte} dias)`}`
                            : c.ultimaVisita ? ` · visitado em ${c.ultimaVisita}` : c.visitado ? " · já visitado" : " · nunca visitado"}
                        </p>
                      </div>
                      <button type="button" onClick={() => tirar(c.id)} title="Tirar da relação (não apaga o cliente)" className="rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {foraDaLista.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Fora da relação desta vez · {foraDaLista.length}</div>
                  <ul className="space-y-1">
                    {foraDaLista.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-400">
                        <span className="min-w-0 flex-1 truncate line-through">{c.nome}</span>
                        <button type="button" onClick={() => devolver(c.id)} className="flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Undo2 size={11} /> voltar</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Coluna 2: conteúdo + envio */}
        <div>
          {tipo === "comemorativa" && (
            <div className="mb-3">
              <label className={rotulo}>Data</label>
              <select value={dataId} onChange={(e) => setDataId(e.target.value)} disabled={enviando} className={campo}>
                {datas.map((d) => <option key={d.id} value={d.id}>{d.nome} · {rotuloDataComemorativa(d)}</option>)}
              </select>
            </div>
          )}
          {tipo === "aniversario" && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-amber-800">Envio automático · todo dia às 8h</div>
                  <p className="mt-0.5 text-[11px] text-amber-800/80">Quem faz aniversário no dia recebe o texto abaixo pelo WhatsApp, só com o primeiro nome (&quot;DUDA RETRO ROSSI&quot; vira &quot;Duda&quot;). Uma vez por ano, por cliente.</p>
                </div>
                {automatico ? (
                  <button
                    type="button"
                    onClick={() => salvarAutomatico(!automatico.ativo)}
                    disabled={salvandoAuto}
                    className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-60",
                      automatico.ativo ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-900 text-agro-400 hover:bg-slate-800")}
                  >
                    {salvandoAuto ? <Loader2 size={12} className="animate-spin" /> : <Cake size={12} />}
                    {automatico.ativo ? "Ligado · desligar" : "Ligar automático"}
                  </button>
                ) : <span className="text-[11px] text-amber-700">carregando…</span>}
              </div>
              {automatico && (
                <div className="mt-2 rounded-lg bg-white/70 px-2.5 py-2 text-xs text-slate-700">
                  <span className="font-semibold text-slate-500">Texto do automático: </span>
                  <span className="whitespace-pre-wrap">{automatico.texto}</span>
                  {texto.trim() && texto.trim() !== automatico.texto && (
                    <button type="button" onClick={() => salvarAutomatico(automatico.ativo)} disabled={salvandoAuto} className="ml-2 font-semibold text-brand-700 hover:underline disabled:opacity-50">
                      usar o texto da caixa abaixo
                    </button>
                  )}
                </div>
              )}
              {avisoAuto && <p className="mt-1 text-[11px] font-semibold text-amber-800">{avisoAuto}</p>}
            </div>
          )}
          {tipo === "promocao" && (
            <div className="mb-3">
              <label className={rotulo}>O que é a promoção / divulgação</label>
              <input value={promocao} onChange={(e) => setPromocao(e.target.value)} disabled={enviando} placeholder="ex: taxa zero na retro B95C até o fim do mês" className={campo} />
            </div>
          )}

          {aceitaAnexo && (
            <div className="mb-3">
              <div className={rotulo}>Imagem, vídeo ou arte</div>
              {anexo ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {anexo.preview
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={anexo.preview} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    : <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-white text-slate-400">{anexo.tipo === "video" ? <Film size={26} /> : <FileText size={26} />}</div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{anexo.nome}</p>
                    <p className="text-[11px] text-slate-400">{anexo.origem === "gemini" ? "Arte criada pela IA" : anexo.tipo === "image" ? "Imagem" : anexo.tipo === "video" ? "Vídeo" : "PDF"} · vai junto da mensagem</p>
                    {anexo.origem === "gemini" && (
                      <button type="button" onClick={criarArte} disabled={gerandoArte || enviando} className="mt-1 text-[11px] font-semibold text-brand-700 hover:underline disabled:opacity-50">
                        {gerandoArte ? "Criando outra…" : "Criar outra versão"}
                      </button>
                    )}
                  </div>
                  <button type="button" onClick={() => setAnexo(null)} disabled={enviando} title="Tirar o anexo" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={15} /></button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <input ref={arquivoRef} type="file" accept="image/*,video/mp4,video/quicktime,application/pdf" className="hidden" onChange={(e) => { void escolherArquivo(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                  <button type="button" onClick={() => arquivoRef.current?.click()} disabled={subindo || enviando}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {subindo ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />} {subindo ? "Subindo…" : "Anexar do celular / computador"}
                  </button>
                  <button type="button" onClick={() => setArteAberta((v) => !v)} disabled={enviando}
                    className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50", arteAberta ? "border-slate-900 bg-slate-900 text-agro-400" : "border-slate-300 text-slate-700 hover:bg-slate-50")}>
                    <Wand2 size={12} /> Criar arte com IA
                  </button>
                </div>
              )}
              {arteAberta && !anexo && (
                <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <textarea value={instrucoesArte} onChange={(e) => setInstrucoesArte(e.target.value)} rows={2} disabled={gerandoArte}
                    placeholder={tipo === "promocao" ? "ex: escavadeira em obra ao pôr do sol, com o texto 'Taxa zero'" : tipo === "aniversario" ? "ex: bolo com uma mini escavadeira em cima" : "ex: escavadeira enfeitada de Natal, clima de fim de ano"}
                    className={campo} />
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={baseArte} onChange={(e) => setBaseArte(e.target.value as BaseArte)} disabled={gerandoArte} className="rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700">
                      {BASES_ARTE.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                    </select>
                    <button type="button" onClick={criarArte} disabled={gerandoArte}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
                      {gerandoArte ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {gerandoArte ? "Criando a arte (até 1 min)…" : "Criar arte"}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">O Gemini monta a arte com a foto da máquina como base. Não gostou? Crie outra versão ou anexe um arquivo seu.</p>
                </div>
              )}
              {erroAnexo && <p className="mt-1 text-[11px] text-red-600">{erroAnexo}</p>}
              {!anexo && !arteAberta && !erroAnexo && <p className="mt-1 text-[11px] text-slate-400">Opcional. Foto é comprimida sozinha; vídeo e PDF até {LIMITE_ANEXO_BYTES / 1024 / 1024} MB.</p>}
            </div>
          )}

          <div className="mb-1 flex items-center justify-between gap-2">
            <label className={rotulo.replace("mb-1 block ", "")}>{anexo ? "Mensagem (vai de legenda)" : "Mensagem para todos"}</label>
            <button type="button" onClick={gerar} disabled={gerando || enviando || (tipo === "visita" && !cidadeNome)} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {gerando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Gerar texto com IA
            </button>
          </div>
          <textarea
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setOrigemTexto(null); }}
            rows={5}
            disabled={enviando}
            placeholder={placeholder}
            className={campo}
          />
          <p className="mt-1 text-[11px] text-slate-400">{origemTexto ?? "Dica: {nome} vira o primeiro nome de cada cliente."}</p>

          {exemplo && (texto.trim() || anexo) && (
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Como {exemplo.nome.split(" ")[0]} vai receber</div>
              <div className="flex gap-3">
                {anexo?.preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={anexo.preview} alt="" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
                )}
                <p className="whitespace-pre-wrap text-sm text-slate-700">{texto.trim() ? personalizarTexto(texto, exemplo.nome) : <span className="text-slate-400">(só o anexo, sem texto)</span>}</p>
              </div>
            </div>
          )}

          {/* Agora ou depois. O padrão é AGORA: programar é a exceção, e uma
              tela que já abre no modo programado faria o vendedor agendar sem
              querer uma mensagem que ele queria mandar na hora. */}
          <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
            {([["agora", "Enviar agora"], ["depois", "Programar"]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => { setQuando(id); setErroAgenda(null); }}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${quando === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {quando === "depois" && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPickerEnvio("data")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700">
                  <span className="block text-[11px] font-semibold text-slate-400">Dia</span>
                  {new Date(`${diaEnvio}T12:00:00`).toLocaleDateString("pt-BR")}
                </button>
                <button type="button" onClick={() => setPickerEnvio("hora")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700">
                  <span className="block text-[11px] font-semibold text-slate-400">Hora (Brasília)</span>
                  {horaEnvio}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                A mensagem sai <b>a partir</b> do horário escolhido — o robô confere de 15 em 15 minutos, então pode
                sair alguns minutos depois. Nunca antes.
              </p>
              {/* Lista grande não cabe numa rodada só: ele precisa saber que
                  vai levar horas ANTES de programar, e não descobrir vendo o
                  contador subir devagar. */}
              {comTelefone.length > cabemPorRodada() && (
                <p className="mt-1 text-[11px] text-slate-500">
                  São {comTelefone.length} — o robô manda aos poucos, para o WhatsApp não bloquear o seu número.
                  Leva umas <b>{ondasEstimadas(comTelefone.length)} rodadas</b> (cerca de {ondasEstimadas(comTelefone.length) * 15} min) para
                  terminar, e a lista aqui embaixo mostra quantos já saíram.
                </p>
              )}
              {comTelefone.length > MAX_CLIENTES_POR_ENVIO && (
                <p className="mt-1 text-xs text-red-600">No máximo {MAX_CLIENTES_POR_ENVIO} clientes por envio.</p>
              )}
              {erroAgenda && <p className="mt-1 text-xs text-red-600">{erroAgenda}</p>}
            </div>
          )}

          <button
            type="button"
            onClick={quando === "depois" ? programar : enviar}
            disabled={!podeEnviar}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50"
          >
            {enviando ? <Loader2 size={15} className="animate-spin" /> : quando === "depois" ? <CalendarClock size={15} /> : <Send size={15} />}
            {progresso ?? (quando === "depois"
              ? (comTelefone.length ? `Programar para ${comTelefone.length} cliente(s)` : "Programar envio")
              : (comTelefone.length ? `Enviar para ${comTelefone.length} cliente(s) · ${titulo}` : "Enviar pelo WhatsApp"))}
          </button>

          {agendado && (
            <div className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">
              <div className="flex items-center gap-1.5 font-bold"><CheckCircle2 size={15} /> Programado para {agendado}</div>
              <p className="mt-1 text-xs opacity-80">Você pode cancelar na lista abaixo enquanto não sair.</p>
            </div>
          )}

          {programados.length > 0 && (
            <div className="mt-4">
              <div className={rotulo}>Envios programados</div>
              <ul className="space-y-1.5">
                {programados.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <CalendarClock size={13} className="shrink-0 text-slate-400" />
                    <b className="text-slate-700">{p.quandoTexto}</b>
                    <span className="text-slate-500">{p.total} cliente(s)</span>
                    {p.temAnexo && <span className="text-slate-400">· com anexo</span>}
                    <span className={`rounded-full px-1.5 py-0.5 font-bold ${
                      p.status === "pendente" ? "bg-amber-100 text-amber-700" :
                      p.status === "enviado" ? "bg-green-100 text-green-700" :
                      p.status === "cancelado" ? "bg-slate-200 text-slate-600" : "bg-red-100 text-red-700"}`}>
                      {p.status === "pendente" ? (p.enviados > 0 ? "saindo" : "aguardando") : p.status}
                    </span>
                    {/* Lista grande sai em ondas de 15 em 15 min: entre uma e
                        outra o envio volta a "pendente". Sem mostrar o quanto
                        já saiu, ele leria "aguardando" achando que nada foi. */}
                    {p.enviados > 0 && (
                      <span className="text-slate-500">
                        {p.status === "enviado" ? `${p.enviados} enviada(s)` : `${p.enviados} de ${p.total} enviada(s)`}
                        {p.falhas ? ` · ${p.falhas} falhou(aram)` : ""}
                      </span>
                    )}
                    {p.status === "pendente" && (
                      <button type="button" onClick={() => cancelarProgramado(p.id)} className="ml-auto font-semibold text-red-600 hover:underline">
                        cancelar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultado && (
            <div className={`mt-3 rounded-xl p-3 text-sm ${resultado.falhas.length === 0 ? "bg-green-50 text-green-800" : resultado.enviados === 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
              <div className="flex items-center gap-1.5 font-bold">
                {resultado.falhas.length === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                {resultado.enviados} enviada(s){resultado.falhas.length ? ` · ${resultado.falhas.length} falhou(aram)` : ""}
              </div>
              {resultado.falhas.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {resultado.falhas.map((f, i) => <li key={i}><b>{f.nome}</b>: {f.erro}</li>)}
                </ul>
              )}
              {resultado.enviados > 0 && <p className="mt-1 text-xs opacity-80">As respostas chegam no <Link href="/atendimento" className="underline">Atendimento</Link>.</p>}
            </div>
          )}
        </div>
      </div>

      {pickerEnvio === "data" && (
        <WheelDatePicker title="Dia do envio" valueISO={diaEnvio} onClose={() => setPickerEnvio(null)} onConfirm={(v) => { setDiaEnvio(v); setPickerEnvio(null); setErroAgenda(null); }} />
      )}
      {pickerEnvio === "hora" && (
        <WheelTimePicker title="Hora do envio (Brasília)" valueHM={horaEnvio} onClose={() => setPickerEnvio(null)} onConfirm={(v) => { setHoraEnvio(v); setPickerEnvio(null); setErroAgenda(null); }} />
      )}
    </div>
  );
}
